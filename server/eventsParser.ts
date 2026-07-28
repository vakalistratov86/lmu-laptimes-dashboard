// Парсер Special Events с официального сайта Le Mans Ultimate
// Источник: https://lemansultimate.com/special-events-calendar-q3-4-2026/

import { logger } from "./logger";

export interface SpecialEvent {
  id: string;
  weekOf: string; // «w/c DD/MM» из оригинала
  dateIso: string; // ISO-дата понедельника недели (YYYY-MM-DD)
  duration: number; // часов
  track: string; // название трассы
  trackTba: boolean; // true если трасса ещё не объявлена
  classes: string[]; // Hypercar, LMGT3 и т.д.
  isFeatured: boolean; // 24h Le Mans и другие «звёздные» события
  sourceUrl: string;
  fetchedAt: string; // ISO-дата последнего обновления
}

interface ParsedRaw {
  events: SpecialEvent[];
  fetchedAt: string;
  sourceUrl: string;
  /**
   * "live" — успешно распарсено с сайта; "static" — сеть/парсинг подвели,
   * отданы захардкоженные STATIC_EVENTS_2026. Без этого поля со стороны
   * пользователя нет способа отличить свежие данные от замороженного
   * фоллбэка — кнопка «Обновить» выглядит нерабочей, хотя на деле каждый
   * раз стабильно не удаётся достучаться до источника.
   */
  source: "live" | "static";
}

const SOURCE_URL = "https://lemansultimate.com/special-events-calendar-q3-4-2026/";

// Жёстко закодированные данные из официального расписания Q3/Q4 2026.
// Метод refreshEvents() пытается получить свежие данные с сайта;
// при ошибке возвращает эти статические данные.
const STATIC_EVENTS_2026: Omit<SpecialEvent, "fetchedAt" | "sourceUrl">[] = [
  // JUNE
  {
    id: "2026-06-23",
    weekOf: "w/c 23/6",
    dateIso: "2026-06-23",
    duration: 6,
    track: "Le Mans",
    trackTba: false,
    classes: ["Hypercar", "WEC LMP2", "LMGT3"],
    isFeatured: false,
  },
  // JULY
  {
    id: "2026-07-07",
    weekOf: "w/c 7/7",
    dateIso: "2026-07-07",
    duration: 4,
    track: "Imola",
    trackTba: false,
    classes: ["ELMS LMP2", "LMP3", "LMGT3"],
    isFeatured: false,
  },
  {
    id: "2026-07-14",
    weekOf: "w/c 14/7",
    dateIso: "2026-07-14",
    duration: 6,
    track: "Interlagos",
    trackTba: false,
    classes: ["Hypercar", "LMGT3"],
    isFeatured: false,
  },
  {
    id: "2026-07-28",
    weekOf: "w/c 28/7",
    dateIso: "2026-07-28",
    duration: 4,
    track: "WeatherTech Raceway Laguna Seca",
    trackTba: false,
    classes: ["Hypercar", "WEC LMP2", "LMGT3"],
    isFeatured: false,
  },
  // AUGUST
  {
    id: "2026-08-11",
    weekOf: "w/c 11/8",
    dateIso: "2026-08-11",
    duration: 8,
    track: "Daytona International Speedway",
    trackTba: false,
    classes: ["Hypercar", "WEC LMP2", "LMGT3"],
    isFeatured: false,
  },
  {
    id: "2026-08-25",
    weekOf: "w/c 25/8",
    dateIso: "2026-08-25",
    duration: 4,
    track: "Spa",
    trackTba: false,
    classes: ["ELMS LMP2", "LMP3", "LMGT3"],
    isFeatured: false,
  },
  // SEPTEMBER
  {
    id: "2026-09-08",
    weekOf: "w/c 8/9",
    dateIso: "2026-09-08",
    duration: 6,
    track: "COTA",
    trackTba: false,
    classes: ["Hypercar", "LMGT3"],
    isFeatured: false,
  },
  {
    id: "2026-09-15",
    weekOf: "w/c 15/9",
    dateIso: "2026-09-15",
    duration: 4,
    track: "Silverstone",
    trackTba: false,
    classes: ["ELMS LMP2", "LMP3", "LMGT3"],
    isFeatured: false,
  },
  {
    id: "2026-09-22",
    weekOf: "w/c 22/9",
    dateIso: "2026-09-22",
    duration: 4,
    track: "TBA",
    trackTba: true,
    classes: ["Hypercar", "LMGT3"],
    isFeatured: false,
  },
  {
    id: "2026-09-29",
    weekOf: "w/c 29/9",
    dateIso: "2026-09-29",
    duration: 6,
    track: "Fuji",
    trackTba: false,
    classes: ["Hypercar", "LMGT3"],
    isFeatured: false,
  },
  // OCTOBER
  {
    id: "2026-10-06",
    weekOf: "w/c 6/10",
    dateIso: "2026-10-06",
    duration: 10,
    track: "TBA",
    trackTba: true,
    classes: ["Hypercar", "WEC LMP2", "LMGT3"],
    isFeatured: false,
  },
  {
    id: "2026-10-13",
    weekOf: "w/c 13/10",
    dateIso: "2026-10-13",
    duration: 4,
    track: "Portimao",
    trackTba: false,
    classes: ["ELMS LMP2", "LMP3", "LMGT3"],
    isFeatured: false,
  },
  {
    id: "2026-10-20",
    weekOf: "w/c 20/10",
    dateIso: "2026-10-20",
    duration: 24,
    track: "Le Mans",
    trackTba: false,
    classes: ["Hypercar", "WEC LMP2", "LMGT3"],
    isFeatured: true,
  },
  // NOVEMBER
  {
    id: "2026-11-10",
    weekOf: "w/c 10/11",
    dateIso: "2026-11-10",
    duration: 8,
    track: "Bahrain",
    trackTba: false,
    classes: ["Hypercar", "LMGT3"],
    isFeatured: false,
  },
  // DECEMBER
  {
    id: "2026-12-01",
    weekOf: "w/c 1/12",
    dateIso: "2026-12-01",
    duration: 6,
    track: "Silverstone",
    trackTba: false,
    classes: ["Hypercar", "LMGT3"],
    isFeatured: false,
  },
  {
    id: "2026-12-15",
    weekOf: "w/c 15/12",
    dateIso: "2026-12-15",
    duration: 6,
    track: "TBA",
    trackTba: true,
    classes: ["Hypercar", "WEC LMP2", "LMGT3"],
    isFeatured: false,
  },
];

// Кэш в памяти
let cache: ParsedRaw | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 часов — для успешного ответа
const CACHE_TTL_ERROR_MS = 5 * 60 * 1000; // 5 минут — после сетевой ошибки (#52)

export async function getSpecialEvents(): Promise<ParsedRaw> {
  const now = Date.now();
  if (cache && now < cacheExpiry) return cache;

  try {
    cache = await fetchAndParse();
    cacheExpiry = now + CACHE_TTL_MS;
  } catch (err) {
    // При любой ошибке сети возвращаем статические данные,
    // но выставляем короткий TTL чтобы система быстро восстановилась (#52)
    // Логируем, иначе живой скрейп может молча не работать сколь угодно
    // долго, показывая устаревший захардкоженный STATIC_EVENTS_2026 без
    // единого следа в логах.
    logger.error(
      { sourceUrl: SOURCE_URL, error: err instanceof Error ? err.message : String(err) },
      "Не удалось получить/распарсить Special Events — используются статические данные",
    );
    const fetchedAt = new Date().toISOString();
    cache = {
      events: STATIC_EVENTS_2026.map((e) => ({ ...e, fetchedAt, sourceUrl: SOURCE_URL })),
      fetchedAt,
      sourceUrl: SOURCE_URL,
      source: "static",
    };
    cacheExpiry = now + CACHE_TTL_ERROR_MS;
  }
  return cache!;
}

/**
 * fix(#77): Определяет год для события через скользящее 12-месячное окно.
 * Если кандидатная дата в текущем году уже прошла — берём следующий год.
 * Это корректно обрабатывает граничные месяцы (декабрь/январь).
 *
 * fix: раньше сравнивался всегда 1-й день месяца, а не сам день события —
 * из-за этого ЛЮБОЕ событие текущего месяца (кроме 1-го числа) считалось
 * "уже прошедшим" и получало год+1, даже если оно ещё не наступило. Теперь
 * сравниваем настоящий день события с началом сегодняшнего дня (полночь),
 * а не с точным текущим моментом — иначе событие, датированное сегодняшним
 * числом, тоже считалось бы "прошедшим" в любое время после полуночи.
 *
 * fix: перенос на год+1 срабатывал для ЛЮБОГО кандидата раньше сегодня —
 * в т.ч. для событий, случившихся всего несколько дней/недель назад в этом
 * же году (страница календаря покрывает конкретный год целиком, включая
 * уже прошедшие месяцы — см. STATIC_EVENTS_2026). Из-за этого прошедшее
 * событие получало год+1 и в UI превращалось в "будущее через ~11 мес."
 * вместо корректного "N дней назад". Год+1 нужен только для настоящего
 * перехода через Новый год (например, страница в декабре уже содержит
 * события января следующего сезона) — такой разрыв всегда намного больше
 * полугода, поэтому используем порог в 183 дня, чтобы отличить его от
 * недавно прошедшего события того же года.
 */
function resolveYear(month: number, day: number): number {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const candidate = new Date(now.getFullYear(), month - 1, day);
  const daysPast = (todayMidnight.getTime() - candidate.getTime()) / 86_400_000;
  if (daysPast > 183) return now.getFullYear() + 1;
  return now.getFullYear();
}

// Именованные HTML-сущности, встречающиеся в разметке календаря
// (тире, неразрывный пробел и т.п.) — WordPress вставляет их вместо
// «сырых» символов, из-за чего матчинг по буквальным –/—/пробелам
// на непреобразованном HTML периодически отваливается при любой правке
// страницы редактором.
const HTML_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

// Блочные теги, чьи границы означают конец строки видимого текста (абзац,
// заголовок, элемент списка/таблицы, явный перенос). Всё остальное (span,
// strong, a, em и т.п.) — оформление внутри одной логической строки, не
// граница: если превратить в перенос и такие теги, регэксп события
// сломается на любом инлайн-выделении внутри трассы/классов.
const BLOCK_TAG_RE = /<\/?(?:p|div|h[1-6]|li|tr|br|section|article|table|ul|ol)(?:\s[^>]*)?\/?>/gi;

/**
 * Превращает произвольный HTML в список видимых текстовых строк —
 * границы строк те же, что видит глазами человек на странице (абзацы,
 * заголовки, элементы списков), сущности декодированы, лишние пробелы
 * схлопнуты. Парсинг ниже зависит только от этого текста, а не от
 * конкретных тегов/атрибутов вокруг него — те меняются при каждой правке
 * страницы редактором сайта, а видимый текстовый формат «w/c DD/MM –
 * N Hours Track – Classes», одно событие на строку, до сих пор оставался
 * стабильным (см. переданный пользователем текст текущей страницы).
 */
function htmlToLines(html: string): string[] {
  const text = html
    .replace(BLOCK_TAG_RE, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&(\w+);/g, (full, name) => HTML_ENTITIES[name.toLowerCase()] ?? full);

  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

// Паттерн одной строки-события: «w/c DD/MM – N Hours Track – Classes».
// Тире может быть коротким (–), длинным (—) или обычным дефисом (-).
const EVENT_RE = /^w\/c\s+(\d{1,2})\/(\d{1,2})\s*[–—-]\s*(\d+)\s*Hours\s+(.+?)\s*[–—-]\s*(.+)$/i;

async function fetchAndParse(): Promise<ParsedRaw> {
  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "LMU-Dashboard/1.0 (special-events-bot)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const fetchedAt = new Date().toISOString();

  const lines = htmlToLines(html);
  const events: SpecialEvent[] = [];

  for (const line of lines) {
    const match = EVENT_RE.exec(line);
    if (!match) continue;

    const [, dayStr, monthStr, durationStr, trackRaw, classesRaw] = match;
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    const duration = parseInt(durationStr, 10);
    const track = trackRaw.trim();
    const trackTba = /tba/i.test(track);
    const classes = classesRaw
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    // Используем resolveYear() для корректного определения года (#53)
    const year = resolveYear(month, day);
    const dateIso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isFeatured = duration >= 24;

    events.push({
      id: dateIso,
      weekOf: `w/c ${day}/${month}`,
      dateIso,
      duration,
      track,
      trackTba,
      classes,
      isFeatured,
      sourceUrl: SOURCE_URL,
      fetchedAt,
    });
  }

  // Если парсинг не дал результатов — fallback на статику.
  // Страница ответила 200, но видимый текст календаря, судя по всему,
  // сменил формат (не только разметку — htmlToFlatText+EVENT_RE от неё уже
  // не зависят) — это тоже стоит видеть в логах.
  if (events.length < 5) {
    logger.warn(
      { sourceUrl: SOURCE_URL, matchedEvents: events.length },
      "Special Events: найдено меньше 5 строк — похоже, изменился текстовый формат календаря на странице; используются статические данные",
    );
    return {
      events: STATIC_EVENTS_2026.map((e) => ({ ...e, fetchedAt, sourceUrl: SOURCE_URL })),
      fetchedAt,
      sourceUrl: SOURCE_URL,
      source: "static",
    };
  }

  return { events, fetchedAt, sourceUrl: SOURCE_URL, source: "live" };
}

export function invalidateCache() {
  cache = null;
  cacheExpiry = 0;
}
