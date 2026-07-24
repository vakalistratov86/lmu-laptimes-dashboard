/**
 * Обнаружение сессий-продолжений при реконнекте.
 *
 * При дисконнекте/реконнекте пилота выделенный сервер LMU пишет НОВЫЙ файл
 * RaceResults.xml вместо дополнения старого — на реальных логах подтверждено,
 * что второй дамп полностью повторяет ростер первого, а круги каждого пилота
 * только растут (полный суперсет). Устойчивого тега-идентификатора сессии
 * (SessionID/GUID) в формате нет — ни корневой, ни вложенный <DateTime>
 * не совпадают между дампами одной и той же реальной сессии. Поэтому
 * "это тот же самый забег" определяется по содержимому: совпадают event
 * (TrackEvent) + точный sessionType + trackId + пересечение состава пилотов,
 * в пределах разумного временного окна (иначе одноимённое регулярное
 * событие турнира недели спустя ложно склеится с прошлым).
 */
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import {
  sessions,
  sessionResults,
  drivers,
  sessionLaps,
  lapTimes,
  sessionIncidents,
  sessionSectorBests,
  sessionTrackLimits,
} from "@shared/schema";
import type { Session } from "@shared/schema";
import { normalizeDriverNameForStorage } from "./normalizer";

/** |A∩B| / min(|A|,|B|) — доля меньшего ростера, встретившаяся в обоих составах. */
export const ROSTER_OVERLAP_THRESHOLD = 0.5;

/** Реконнект — это минуты/часы; разные даты одного турнира — дни/недели. */
export const SUPERSEDE_MAX_GAP_MS = 24 * 60 * 60 * 1000;

export function normalizeRosterNames(names: string[]): Set<string> {
  return new Set(names.map((n) => normalizeDriverNameForStorage(n).toLowerCase()));
}

export function rosterOverlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const name of a) {
    if (b.has(name)) intersection++;
  }
  return intersection / Math.min(a.size, b.size);
}

export type SupersedeAction = "REPLACE" | "SKIP";

/**
 * Сравнение "полноты" двух дампов одной сессии по суммарному количеству
 * распарсенных кругов. Равенство считается SKIP — заменять ради нулевого
 * выигрыша в полноте не имеет смысла (та же логика, что и "новый файл менее
 * полон, чем уже сохранённый").
 */
export function decideSupersedeAction(newTotalParsedLaps: number, candidateLapCount: number): SupersedeAction {
  return newTotalParsedLaps > candidateLapCount ? "REPLACE" : "SKIP";
}

export interface SupersedeCandidate {
  session: Session;
  overlap: number;
}

export interface SupersedeMatchParams {
  event: string;
  sessionType: string;
  trackId: number;
  newDriverNames: string[];
  newDateTimeIso: string;
}

/**
 * Ищет уже сохранённую в БД сессию, являющуюся, вероятно, более ранним (или
 * более поздним) дампом ТОЙ ЖЕ реальной сессии, что и только что
 * распарсенный файл. Возвращает null, если подходящего кандидата нет, или
 * если два лучших кандидата набрали одинаковый overlap (безопаснее
 * импортировать как новую сессию, чем гадать, какую из существующих
 * заменять).
 */
export async function findSupersedeCandidate(
  tx: any,
  params: SupersedeMatchParams,
): Promise<SupersedeCandidate | null> {
  const newTime = Date.parse(params.newDateTimeIso);
  const lowerBound = Number.isFinite(newTime) ? new Date(newTime - SUPERSEDE_MAX_GAP_MS).toISOString() : undefined;
  const upperBound = Number.isFinite(newTime) ? new Date(newTime + SUPERSEDE_MAX_GAP_MS).toISOString() : undefined;

  const whereConditions = [
    eq(sessions.event, params.event),
    eq(sessions.sessionType, params.sessionType),
    eq(sessions.trackId, params.trackId),
  ];
  if (lowerBound && upperBound) {
    whereConditions.push(gte(sessions.dateTime, lowerBound), lte(sessions.dateTime, upperBound));
  }

  const candidateSessions: Session[] = await tx
    .select()
    .from(sessions)
    .where(and(...whereConditions));
  if (candidateSessions.length === 0) return null;

  const candidateIds = candidateSessions.map((s) => s.id);
  const rosterRows: { sessionId: number; driverName: string }[] = await tx
    .select({ sessionId: sessionResults.sessionId, driverName: drivers.name })
    .from(sessionResults)
    .innerJoin(drivers, eq(sessionResults.driverId, drivers.id))
    .where(inArray(sessionResults.sessionId, candidateIds));

  const rosterBySessionId = new Map<number, string[]>();
  for (const row of rosterRows) {
    const list = rosterBySessionId.get(row.sessionId) ?? [];
    list.push(row.driverName);
    rosterBySessionId.set(row.sessionId, list);
  }

  const newRoster = normalizeRosterNames(params.newDriverNames);

  let best: SupersedeCandidate | null = null;
  let bestSecondOverlap = -1;
  for (const session of candidateSessions) {
    const roster = normalizeRosterNames(rosterBySessionId.get(session.id) ?? []);
    const overlap = rosterOverlapRatio(newRoster, roster);
    if (overlap < ROSTER_OVERLAP_THRESHOLD) continue;
    if (!best || overlap > best.overlap) {
      bestSecondOverlap = best ? best.overlap : bestSecondOverlap;
      best = { session, overlap };
    } else if (overlap > bestSecondOverlap) {
      bestSecondOverlap = overlap;
    }
  }

  if (!best) return null;
  // Два кандидата с (почти) одинаковым overlap — неоднозначно, какой из них
  // заменять. Безопаснее impортировать как новую сессию.
  if (Math.abs(best.overlap - bestSecondOverlap) < 1e-9) return null;

  return best;
}

/**
 * Удаляет все данные заменяемой (менее полной) сессии — тот же набор таблиц
 * и порядок, что и полная очистка БД (DELETE /api/import/all в routes.ts),
 * только со скоупом по конкретному sessionId. Не трогает import_jobs (старая
 * задача останется с "мёртвым" session_id — осознанно принято, это чисто
 * информационное поле, никто на него не джойнится) и не трогает drivers/tracks
 * (общие для всех сессий).
 */
export async function deleteSupersededSessionData(tx: any, sessionId: number): Promise<void> {
  await tx.delete(sessionTrackLimits).where(eq(sessionTrackLimits.sessionId, sessionId));
  await tx.delete(sessionSectorBests).where(eq(sessionSectorBests.sessionId, sessionId));
  await tx.delete(sessionIncidents).where(eq(sessionIncidents.sessionId, sessionId));
  await tx.delete(sessionLaps).where(eq(sessionLaps.sessionId, sessionId));
  await tx.delete(lapTimes).where(eq(lapTimes.sessionId, sessionId));
  await tx.delete(sessionResults).where(eq(sessionResults.sessionId, sessionId));
  await tx.delete(sessions).where(eq(sessions.id, sessionId));
}
