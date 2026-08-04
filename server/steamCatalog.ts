import type { SteamContentEntry } from "@shared/steamTypes";

/**
 * Статический каталог игрового контента (трассы/машины) по игре и её DLC.
 *
 * Steam Store API (appdetails) отдаёт только метаданные магазина (название,
 * цену, скидку, описание, обложку) — он НЕ знает, какие трассы/машины
 * открывает конкретный DLC, это игровой контент. Поэтому список ниже
 * курируется вручную (по данным официального гайда LMU и профильных
 * DLC-обзоров) и требует ручного обновления при выходе новых DLC — то же
 * принятое ограничение, что и у STATIC_EVENTS_2026 (server/eventsParser.ts)
 * и DAILY_RACES_STATIC.
 *
 * DLC сопоставляются не по appid, а по регэкспу на живое название (`name`),
 * которое Steam всегда отдаёт корректно на момент запроса — в отличие от
 * appid, который пришлось бы угадывать без доступа к странице DLC Steam
 * (см. server/steamApi.ts, раздел "Известное ограничение" ниже). Список DLC
 * как таковой не хардкодится — он приходит от Steam (`dlc: number[]` в
 * ответе appdetails базовой игры) при каждом обновлении кэша; этот каталог
 * лишь обогащает уже известные Steam-ом карточки содержимым, когда матчинг
 * успешен. Появившийся у Steam новый DLC, для которого здесь пока нет
 * записи, всё равно попадает в список карточек — просто без списка трасс/
 * машин (см. `isUnmappedContent` в shared/steamTypes.ts).
 */

export const STEAM_BASE_APPID = 2399420;

interface SteamContentCatalogEntry {
  /** Регэкспы для сопоставления с живым SteamAppCard.name, регистронезависимо */
  matchNamePatterns: RegExp[];
  tracks: string[];
  cars: SteamContentEntry[];
}

/** Контент базовой игры (запуск LMU, до первых DLC) */
const BASE_GAME_CONTENT: SteamContentCatalogEntry = {
  matchNamePatterns: [/^le mans ultimate$/i],
  tracks: [
    "Le Mans",
    "Sebring",
    "Spa-Francorchamps",
    "Bahrain",
    "Bahrain Outer Circuit",
    "Monza",
    "Fuji Speedway",
    "Portimão",
    "Silverstone",
    "Barcelona",
    "Paul Ricard",
  ],
  cars: [
    { carClass: "Hypercar", name: "Toyota GR010 HYBRID" },
    { carClass: "Hypercar", name: "Ferrari 499P" },
    { carClass: "Hypercar", name: "Porsche 963" },
    { carClass: "Hypercar", name: "Cadillac V-Series.R" },
    { carClass: "Hypercar", name: "Peugeot 9X8" },
    { carClass: "Hypercar", name: "BMW M Hybrid V8" },
    { carClass: "Hypercar", name: "Vanwall Vandervell 680" },
    { carClass: "LMP2", name: "Oreca 07" },
  ],
};

/**
 * Известные на момент реализации DLC. Список заведомо неполон — сетевые
 * ограничения текущей среды разработки не позволили обратиться к странице
 * DLC на Steam (store.steampowered.com) и к профильным вики/гайдам за
 * исчерпывающим перечнем (см. PR-описание) — данные ниже собраны через
 * веб-поиск и ограничены тем, что удалось подтвердить текстом источника.
 * Остальные существующие DLC отобразятся карточкой (имя/цена/обложка живые
 * из Steam), но без списка трасс/машин, пока запись не будет добавлена сюда.
 */
const DLC_CONTENT_CATALOG: SteamContentCatalogEntry[] = [
  {
    matchNamePatterns: [/season pack ?1\b/i, /tifosi italia/i],
    tracks: ["Imola"],
    cars: [{ carClass: "Hypercar", name: "Lamborghini SC63" }],
  },
  {
    matchNamePatterns: [/season pack ?3\b/i],
    tracks: ["Interlagos"],
    cars: [
      { carClass: "LMGT3", name: "BMW M4 LMGT3" },
      { carClass: "LMGT3", name: "Chevrolet Corvette Z06 LMGT3.R" },
      { carClass: "LMGT3", name: "Ferrari 296 LMGT3" },
    ],
  },
  {
    matchNamePatterns: [/season pack ?4\b/i],
    tracks: [],
    cars: [
      { carClass: "LMGT3", name: "Porsche 911 GT3 R (LMGT3)" },
      { carClass: "LMGT3", name: "Aston Martin Vantage AMR LMGT3" },
    ],
  },
  {
    matchNamePatterns: [/season pack ?5\b/i],
    tracks: ["Lusail"],
    cars: [
      { carClass: "LMGT3", name: "Lexus RC F GT3" },
      { carClass: "LMGT3", name: "Lamborghini Huracán GT3 EVO2" },
    ],
  },
  {
    // Бандл всех пяти Season Pack — по данным гайда включает 4 доп. трассы
    // (Imola/COTA/Interlagos/Lusail); машины уже перечислены в отдельных
    // Season Pack выше, здесь не дублируются, чтобы не показывать одну и ту
    // же машину сразу в двух карточках.
    matchNamePatterns: [/2024 season pass/i],
    tracks: ["Imola", "COTA", "Interlagos", "Lusail"],
    cars: [],
  },
  {
    // Агрегированный список — по гайду ELMS Season Pass добавляет три шасси
    // LMP3, без надёжного подтверждения, какой конкретно под-пак (1/2/3)
    // добавил какую машину, поэтому отдельные ELMS Pack N здесь не размечены.
    matchNamePatterns: [/elms season pass/i],
    tracks: [],
    cars: [
      { carClass: "LMP3", name: "Ligier JS P325" },
      { carClass: "LMP3", name: "Ginetta G61-LT-P3 Evo" },
      { carClass: "LMP3", name: "Duqueine D09" },
    ],
  },
  {
    matchNamePatterns: [/us track pack[^0-9]*1\b/i],
    tracks: ["Daytona International Speedway", "WeatherTech Raceway Laguna Seca"],
    cars: [],
  },
];

/** Возвращает контент (трассы/машины) для appid+название, либо null если не размечено. */
export function findSteamContent(appid: number, name: string): { tracks: string[]; cars: SteamContentEntry[] } | null {
  if (appid === STEAM_BASE_APPID) {
    return { tracks: BASE_GAME_CONTENT.tracks, cars: BASE_GAME_CONTENT.cars };
  }
  const entry = DLC_CONTENT_CATALOG.find((e) => e.matchNamePatterns.some((pattern) => pattern.test(name)));
  return entry ? { tracks: entry.tracks, cars: entry.cars } : null;
}
