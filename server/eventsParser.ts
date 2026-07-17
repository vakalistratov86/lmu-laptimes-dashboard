// Парсер Special Events с официального сайта Le Mans Ultimate
// Источник: https://lemansultimate.com/special-events-calendar-q3-4-2026/

export interface SpecialEvent {
  id: string;
  weekOf: string;       // «w/c DD/MM» из оригинала
  dateIso: string;      // ISO-дата понедельника недели (YYYY-MM-DD)
  duration: number;     // часов
  track: string;        // название трассы
  trackTba: boolean;    // true если трасса ещё не объявлена
  classes: string[];    // Hypercar, LMGT3 и т.д.
  isFeatured: boolean;  // 24h Le Mans и другие «звёздные» события
  sourceUrl: string;
  fetchedAt: string;    // ISO-дата последнего обновления
}

interface ParsedRaw {
  events: SpecialEvent[];
  fetchedAt: string;
  sourceUrl: string;
}

const SOURCE_URL = "https://lemansultimate.com/special-events-calendar-q3-4-2026/";

// Жёстко закодированные данные из официального расписания Q3/Q4 2026.
// Метод refreshEvents() пытается получить свежие данные с сайта;
// при ошибке возвращает эти статические данные.
const STATIC_EVENTS_2026: Omit<SpecialEvent, "fetchedAt" | "sourceUrl">[] = [
  // JUNE
  { id: "2026-06-23", weekOf: "w/c 23/6",  dateIso: "2026-06-23", duration: 6,  track: "Le Mans",    trackTba: false, classes: ["Hypercar", "WEC LMP2", "LMGT3"], isFeatured: false },
  // JULY
  { id: "2026-07-07", weekOf: "w/c 7/7",   dateIso: "2026-07-07", duration: 4,  track: "Imola",     trackTba: false, classes: ["ELMS LMP2", "LMP3", "LMGT3"],    isFeatured: false },
  { id: "2026-07-14", weekOf: "w/c 14/7",  dateIso: "2026-07-14", duration: 6,  track: "Interlagos",trackTba: false, classes: ["Hypercar", "LMGT3"],              isFeatured: false },
  { id: "2026-07-28", weekOf: "w/c 28/7",  dateIso: "2026-07-28", duration: 4,  track: "TBA",       trackTba: true,  classes: ["Hypercar", "WEC LMP2", "LMGT3"], isFeatured: false },
  // AUGUST
  { id: "2026-08-11", weekOf: "w/c 11/8",  dateIso: "2026-08-11", duration: 8,  track: "TBA",       trackTba: true,  classes: ["Hypercar", "WEC LMP2", "LMGT3"], isFeatured: false },
  { id: "2026-08-25", weekOf: "w/c 25/8",  dateIso: "2026-08-25", duration: 4,  track: "Spa",        trackTba: false, classes: ["ELMS LMP2", "LMP3", "LMGT3"],    isFeatured: false },
  // SEPTEMBER
  { id: "2026-09-08", weekOf: "w/c 8/9",   dateIso: "2026-09-08", duration: 6,  track: "COTA",       trackTba: false, classes: ["Hypercar", "LMGT3"],              isFeatured: false },
  { id: "2026-09-15", weekOf: "w/c 15/9",  dateIso: "2026-09-15", duration: 4,  track: "Silverstone",trackTba: false, classes: ["ELMS LMP2", "LMP3", "LMGT3"],    isFeatured: false },
  { id: "2026-09-22", weekOf: "w/c 22/9",  dateIso: "2026-09-22", duration: 4,  track: "TBA",        trackTba: true,  classes: ["Hypercar", "LMGT3"],              isFeatured: false },
  { id: "2026-09-29", weekOf: "w/c 29/9",  dateIso: "2026-09-29", duration: 6,  track: "Fuji",       trackTba: false, classes: ["Hypercar", "LMGT3"],              isFeatured: false },
  // OCTOBER
  { id: "2026-10-06", weekOf: "w/c 6/10",  dateIso: "2026-10-06", duration: 10, track: "TBA",        trackTba: true,  classes: ["Hypercar", "WEC LMP2", "LMGT3"], isFeatured: false },
  { id: "2026-10-13", weekOf: "w/c 13/10", dateIso: "2026-10-13", duration: 4,  track: "Portimao",   trackTba: false, classes: ["ELMS LMP2", "LMP3", "LMGT3"],    isFeatured: false },
  { id: "2026-10-20", weekOf: "w/c 20/10", dateIso: "2026-10-20", duration: 24, track: "Le Mans",    trackTba: false, classes: ["Hypercar", "WEC LMP2", "LMGT3"], isFeatured: true  },
  // NOVEMBER
  { id: "2026-11-10", weekOf: "w/c 10/11", dateIso: "2026-11-10", duration: 8,  track: "Bahrain",    trackTba: false, classes: ["Hypercar", "LMGT3"],              isFeatured: false },
  // DECEMBER
  { id: "2026-12-01", weekOf: "w/c 1/12",  dateIso: "2026-12-01", duration: 6,  track: "Silverstone",trackTba: false, classes: ["Hypercar", "LMGT3"],              isFeatured: false },
  { id: "2026-12-15", weekOf: "w/c 15/12", dateIso: "2026-12-15", duration: 6,  track: "TBA",        trackTba: true,  classes: ["Hypercar", "WEC LMP2", "LMGT3"], isFeatured: false },
];

// Кэш в памяти
let cache: ParsedRaw | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;       // 6 часов — для успешного ответа
const CACHE_TTL_ERROR_MS = 5 * 60 * 1000;       // 5 минут — после сетевой ошибки (#52)

export async function getSpecialEvents(): Promise<ParsedRaw> {
  const now = Date.now();
  if (cache && now < cacheExpiry) return cache;

  try {
    cache = await fetchAndParse();
    cacheExpiry = now + CACHE_TTL_MS;
  } catch {
    // При любой ошибке сети возвращаем статические данные,
    // но выставляем короткий TTL чтобы система быстро восстановилась (#52)
    const fetchedAt = new Date().toISOString();
    cache = {
      events: STATIC_EVENTS_2026.map((e) => ({ ...e, fetchedAt, sourceUrl: SOURCE_URL })),
      fetchedAt,
      sourceUrl: SOURCE_URL,
    };
    cacheExpiry = now + CACHE_TTL_ERROR_MS;
  }
  return cache!;
}

/**
 * Определяет год для события по номеру месяца.
 * Если месяц события меньше текущего месяца — считаем следующий год
 * (событие ещё впереди, просто в начале следующего года). (#53)
 */
function resolveYear(month: number): number {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-based
  const currentYear = now.getFullYear();
  // Если месяц уже прошёл в текущем году — это следующий год
  return month < currentMonth ? currentYear + 1 : currentYear;
}

async function fetchAndParse(): Promise<ParsedRaw> {
  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "LMU-Dashboard/1.0 (special-events-bot)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const fetchedAt = new Date().toISOString();

  // Простой регулярный парсинг структуры страницы
  // Паттерн: «w/c DD/MM – N Hours Track – Classes»
  const lineRe = /w\/c\s+(\d+\/(\d+))\s*[–\-]\s*(\d+)\s*Hours\s+([^–\-<\n]+?)\s*[–\-]\s*([^<\n]+)/gi;
  const events: SpecialEvent[] = [];
  let match;

  while ((match = lineRe.exec(html)) !== null) {
    const [, weekOf, monthStr, durationStr, trackRaw, classesRaw] = match;
    const duration = parseInt(durationStr, 10);
    const track = trackRaw.trim();
    const trackTba = /tba/i.test(track);
    const classes = classesRaw.split(",").map((c) => c.trim()).filter(Boolean);
    const month = parseInt(monthStr, 10);
    const dayStr = weekOf.split("/")[0];
    const day = parseInt(dayStr, 10);
    // Используем resolveYear() для корректного определения года (#53)
    const year = resolveYear(month);
    const dateIso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const id = dateIso;
    const isFeatured = duration >= 24 || /24\s*h/i.test(trackRaw);

    events.push({
      id, weekOf: `w/c ${weekOf}`, dateIso, duration, track, trackTba,
      classes, isFeatured, sourceUrl: SOURCE_URL, fetchedAt,
    });
  }

  // Если парсинг не дал результатов — fallback на статику
  if (events.length < 5) {
    return {
      events: STATIC_EVENTS_2026.map((e) => ({ ...e, fetchedAt, sourceUrl: SOURCE_URL })),
      fetchedAt,
      sourceUrl: SOURCE_URL,
    };
  }

  return { events, fetchedAt, sourceUrl: SOURCE_URL };
}

export function invalidateCache() {
  cache = null;
  cacheExpiry = 0;
}
