/**
 * Тесты для runImport() — ветка ZERO_LAPS (#122 follow-up).
 *
 * Раньше файл, в котором парсер не нашёл ни одного <Driver> (parseRaceResults
 * вернул null), считался "ошибкой" ("Не похоже на лог результатов LMU/rFactor"),
 * а не пропуском — хотя семантически это тот же случай "нечего импортировать",
 * что и файл с участниками, но без единого круга. Оба случая должны throw'ить
 * ошибку с code === 'ZERO_LAPS' ДО открытия транзакции БД.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { db } = vi.hoisted(() => {
  const db = {
    transaction: vi.fn(async () => {
      throw new Error("db.transaction() должна не вызываться для файла без участников/кругов");
    }),
  };
  return { db };
});
vi.mock("../server/storage", () => ({ db }));

const { parseRaceResults } = vi.hoisted(() => ({ parseRaceResults: vi.fn() }));
vi.mock("../server/logParser", () => ({ parseRaceResults }));

const { findSupersedeCandidate, deleteSupersededSessionData, decideSupersedeAction } = vi.hoisted(() => ({
  findSupersedeCandidate: vi.fn(),
  deleteSupersededSessionData: vi.fn(),
  decideSupersedeAction: vi.fn(),
}));
vi.mock("../server/sessionSupersede", () => ({
  findSupersedeCandidate,
  deleteSupersededSessionData,
  decideSupersedeAction,
}));

import { runImport } from "../server/importWorker";

/** Минимальный, но структурно валидный ParsedSession для тестов, идущих внутрь транзакции. */
function makeParsedSession() {
  return {
    venue: "Bahrain International Circuit",
    course: "Bahrain International Circuit",
    event: "8 Hours of Bahrain",
    sessionType: "Гонка (Race)",
    trackLengthM: 5386.8,
    gameVersion: "1.3000",
    dateTimeIso: "2026-02-08T18:14:43.000Z",
    dateTimeUnix: 1770563683,
    logFormatVersion: "1.1",
    setting: "Multiplayer",
    raceLaps: 0,
    raceTimeMin: 130,
    mechFailRate: null,
    damageMult: null,
    fuelMult: null,
    tireMult: null,
    vehiclesAllowed: null,
    parcFerme: null,
    fixedSetups: null,
    freeSettings: null,
    fixedUpgrades: null,
    tireWarmers: null,
    dedicated: null,
    sessionDurationMin: 130,
    sessionMaxLaps: null,
    mostLapsCompleted: 71,
    drivers: [
      { name: "Driver A", lapList: [{ num: 1, lapMs: 100000 }] },
      { name: "Driver B", lapList: [{ num: 1, lapMs: 101000 }] },
    ],
    incidents: [],
    sectorBests: [],
    trackLimits: [],
  } as any;
}

/** tx-мок для findOrCreateTrack: сразу отдаёт точное совпадение по названию/layout, без insert. */
function makeTxWithExistingTrack() {
  function chain(rows: any[]): any {
    const p = Promise.resolve(rows);
    return Object.assign(p, {
      from: vi.fn(() => chain(rows)),
      where: vi.fn(() => chain(rows)),
    });
  }
  const existingTrack = {
    id: 42,
    name: "Bahrain",
    country: "Бахрейн",
    lengthKm: 5.4,
    turns: 15,
    layout: "Bahrain International Circuit",
  };
  return {
    select: vi.fn(() => chain([existingTrack])),
    insert: vi.fn(() => {
      throw new Error("tx.insert не должен вызываться в этом сценарии");
    }),
    delete: vi.fn(() => {
      throw new Error("tx.delete не должен вызываться в этом сценарии");
    }),
  };
}

describe("runImport — файлы без данных для импорта (ZERO_LAPS)", () => {
  it("бросает ZERO_LAPS, если parseRaceResults вернул null (0 участников в сессии)", async () => {
    parseRaceResults.mockReturnValueOnce(null);

    await expect(
      runImport({ id: "job-1", fileHash: "hash-1", fileName: "no-drivers.xml", content: "<x/>" }),
    ).rejects.toMatchObject({ code: "ZERO_LAPS" });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("бросает ZERO_LAPS, если участники есть, но ни у одного нет кругов", async () => {
    parseRaceResults.mockReturnValueOnce({
      drivers: [
        { name: "Driver A", lapList: [] },
        { name: "Driver B", lapList: [] },
      ],
    } as any);

    await expect(
      runImport({ id: "job-2", fileHash: "hash-2", fileName: "zero-laps.xml", content: "<x/>" }),
    ).rejects.toMatchObject({ code: "ZERO_LAPS" });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("сообщения для двух ZERO_LAPS-сценариев различаются (для читаемого журнала)", async () => {
    parseRaceResults.mockReturnValueOnce(null);
    let noDriversMessage = "";
    try {
      await runImport({ id: "job-3", fileHash: "hash-3", fileName: "a.xml", content: "<x/>" });
    } catch (e) {
      noDriversMessage = (e as Error).message;
    }

    parseRaceResults.mockReturnValueOnce({ drivers: [{ name: "Driver A", lapList: [] }] } as any);
    let zeroLapsMessage = "";
    try {
      await runImport({ id: "job-4", fileHash: "hash-4", fileName: "b.xml", content: "<x/>" });
    } catch (e) {
      zeroLapsMessage = (e as Error).message;
    }

    expect(noDriversMessage).not.toBe(zeroLapsMessage);
    expect(noDriversMessage).toContain("участни");
    expect(zeroLapsMessage).toContain("0 кругов");
  });
});

describe("runImport — реконнект: замена/пропуск сессии-продолжения (server/sessionSupersede.ts)", () => {
  beforeEach(() => {
    findSupersedeCandidate.mockReset();
    deleteSupersededSessionData.mockReset();
    decideSupersedeAction.mockReset();
  });

  it("SUPERSEDED: найден более полный кандидат -> бросает до вставки, tx.insert/delete не вызываются", async () => {
    parseRaceResults.mockReturnValueOnce(makeParsedSession());
    const candidateSession = { id: 7, lapCount: 71 };
    findSupersedeCandidate.mockResolvedValueOnce({ session: candidateSession, overlap: 1 });
    decideSupersedeAction.mockReturnValueOnce("SKIP");

    const tx = makeTxWithExistingTrack();
    db.transaction.mockImplementationOnce(async (fn: any) => fn(tx));

    await expect(
      runImport({ id: "job-10", fileHash: "hash-10", fileName: "reconnect-early.xml", content: "<x/>" }),
    ).rejects.toMatchObject({
      code: "SUPERSEDED",
      existingSessionId: 7,
      existingLapCount: 71,
      newLapCount: 2,
    });

    expect(deleteSupersededSessionData).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it("REPLACE: найден менее полный кандидат -> удаляет его данные внутри той же транзакции перед вставкой новой сессии", async () => {
    parseRaceResults.mockReturnValueOnce(makeParsedSession());
    const candidateSession = { id: 5, lapCount: 1 };
    findSupersedeCandidate.mockResolvedValueOnce({ session: candidateSession, overlap: 1 });
    decideSupersedeAction.mockReturnValueOnce("REPLACE");

    const tx = makeTxWithExistingTrack();
    // В REPLACE-сценарии tx.insert() вызывается — переопределяем "бросающий" insert
    // из общего хелпера на минимально работоспособный (сессия + пилоты + круги).
    let insertedSession: any = null;
    tx.insert = vi.fn((_table: any) => ({
      values: vi.fn((payload: any) => ({
        returning: vi.fn(() => {
          const row = { id: 999, lapCount: 0, ...(Array.isArray(payload) ? payload[0] : payload) };
          if (insertedSession === null) insertedSession = row;
          return Promise.resolve([row]);
        }),
      })),
    }));
    tx.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve(undefined)) })) }));
    db.transaction.mockImplementationOnce(async (fn: any) => fn(tx));

    const result = await runImport({
      id: "job-11",
      fileHash: "hash-11",
      fileName: "reconnect-full.xml",
      content: "<x/>",
    });

    expect(deleteSupersededSessionData).toHaveBeenCalledWith(tx, 5);
    expect(result.replacedSessionId).toBe(5);
    expect(result.replacedLapCount).toBe(1);
    expect(result.sessionId).toBe(999);
  });
});
