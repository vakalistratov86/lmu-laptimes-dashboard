import type { SteamContentEntry } from "@shared/steamTypes";

/**
 * Статический каталог игрового контента (трассы/машины) по игре и её DLC.
 *
 * Steam Store API (appdetails) отдаёт только метаданные магазина (название,
 * цену, скидку, описание, обложку) — он НЕ знает, какие трассы/машины
 * открывает конкретный DLC, это игровой контент. Поэтому список ниже
 * курируется вручную (по официальным анонсам Studio 397/Motorsport Games,
 * гайду guide.lemansultimate.com и профильным DLC-обзорам — traxion.gg,
 * racecontrol.gg, dailysportscar.com) и требует ручного обновления при
 * выходе новых DLC — то же принятое ограничение, что и у STATIC_EVENTS_2026
 * (server/eventsParser.ts) и DAILY_RACES_STATIC.
 *
 * Каждая запись сопоставляется в первую очередь по подтверждённому appid
 * (взят из реальных Steam-ссылок в источниках), и только для записей без
 * подтверждённого appid — по регэкспу на живое название (`name`) как
 * запасной вариант. Список DLC как таковой не хардкодится — он приходит от
 * Steam (`dlc: number[]` в ответе appdetails базовой игры) при каждом
 * обновлении кэша; этот каталог лишь обогащает уже известные Steam-ом
 * карточки содержимым, когда матчинг успешен. Появившийся у Steam новый
 * DLC, для которого здесь пока нет записи, всё равно попадает в список
 * карточек — просто без списка трасс/машин (см. `isUnmappedContent` в
 * shared/steamTypes.ts).
 */

export const STEAM_BASE_APPID = 2399420;

interface SteamContentCatalogEntry {
  /** Подтверждённый appid DLC на Steam, если удалось найти прямую ссылку в источниках */
  appid?: number;
  /** Регэкспы для сопоставления с живым SteamAppCard.name, регистронезависимо — запасной вариант без appid */
  matchNamePatterns?: RegExp[];
  /** Отображаемое имя этого отдельного пака — используется, когда на него ссылается Season/Track Pass через includesAppIds. Для самих Pass-записей не задаётся. */
  packName?: string;
  tracks: string[];
  cars: SteamContentEntry[];
  /**
   * Только для Season Pass/Track Pass (см. `isPass` в shared/steamTypes.ts):
   * названия отдельных DLC-паков, УЖЕ вышедших и входящих в подписку —
   * заполняется автоматически (см. resolvePassEntry() ниже), вручную не
   * задаётся.
   */
  includedDlc?: string[];
  /**
   * Только для Season Pass/Track Pass: appid'ы отдельных паков, входящих в
   * подписку. `tracks`/`cars`/`includedDlc` для такой записи ВЫЧИСЛЯЮТСЯ
   * объединением содержимого этих паков (см. resolvePassEntry()), а не
   * прописываются вручную — так подписка не может разойтись с фактическим
   * содержимым паков и никогда не включает ещё не вышедший контент: appid
   * пака добавляется сюда только после того, как для него самого появилась
   * отдельная запись в этом каталоге (т.е. он уже вышел).
   */
  includesAppIds?: number[];
}

/**
 * Контент базовой игры на сегодня (запуск в раннем доступе в феврале 2024 с
 * ростером 2023 сезона WEC + бесплатные обновления до v1.0 в июле 2025) —
 * то есть то, что получает покупатель без единого платного DLC.
 *
 * Трассы: официально заявленные "семь площадок календаря WEC-2023" на
 * запуске (Ле-Ман, Себринг, Спа, Бахрейн, Монца, Фудзи, Портимау) — состав
 * не менялся с релиза. Хайперкары 2023-го сезона (Toyota/Ferrari/Porsche/
 * Cadillac/Peugeot/Glickenhaus/Vanwall) + LMP2 (Oreca 07) были в игре с
 * раннего доступа; Aston Martin Valkyrie AMR LMH, BMW M Hybrid V8 LMDh и
 * три LMGT3 (Mercedes-AMG, Ford Mustang, McLaren 720S Evo) добавлены
 * бесплатными обновлениями к релизу v1.0.
 *
 * Silverstone/Paul Ricard/Circuit de Barcelona-Catalunya НЕ входят сюда —
 * несмотря на бесплатные обновления конфигураций (доп. layout'ы) для уже
 * купивших, сами эти трассы — платный контент ELMS Pack 1/2/3 (см. ниже).
 */
const BASE_GAME_CONTENT: SteamContentCatalogEntry = {
  tracks: [
    "Le Mans",
    "Sebring",
    "Spa-Francorchamps",
    "Bahrain",
    "Bahrain Outer Circuit",
    "Monza",
    "Fuji Speedway",
    "Portimão",
  ],
  cars: [
    { carClass: "Hypercar", name: "Toyota GR010 HYBRID" },
    { carClass: "Hypercar", name: "Ferrari 499P" },
    { carClass: "Hypercar", name: "Porsche 963" },
    { carClass: "Hypercar", name: "Cadillac V-Series.R" },
    { carClass: "Hypercar", name: "Peugeot 9X8" },
    { carClass: "Hypercar", name: "Glickenhaus 007 LMH" },
    { carClass: "Hypercar", name: "Vanwall Vandervell 680" },
    { carClass: "Hypercar", name: "Aston Martin Valkyrie AMR LMH" },
    { carClass: "Hypercar", name: "BMW M Hybrid V8" },
    { carClass: "LMP2", name: "Oreca 07" },
    { carClass: "LMGT3", name: "Mercedes-AMG LMGT3" },
    { carClass: "LMGT3", name: "Ford Mustang GT3" },
    { carClass: "LMGT3", name: "McLaren 720S LMGT3 Evo" },
  ],
};

/**
 * Известные на момент реализации DLC. Список заведомо неполон — не
 * анонсированные на сегодня будущие паки (напр. US Track Pack 2/3, точные
 * трассы которых на момент написания ещё официально не раскрыты) сюда не
 * включены. Остальные существующие DLC отобразятся карточкой (имя/цена/
 * обложка живые из Steam), но без списка трасс/машин, пока запись не будет
 * добавлена сюда.
 */
const DLC_CONTENT_CATALOG_BASE: SteamContentCatalogEntry[] = [
  {
    // Le Mans Ultimate - 2024 Pack 1 ("Tifosi Italia"), июль 2024
    appid: 2973290,
    matchNamePatterns: [/2024\D*pack\D*1\b/i, /season pack ?1\b/i, /tifosi italia/i],
    packName: "2024 Pack 1",
    tracks: ["Imola"],
    cars: [{ carClass: "Hypercar", name: "Lamborghini SC63 LMDh" }],
  },
  {
    // Le Mans Ultimate - 2024 Pack 2, октябрь 2024
    appid: 3151390,
    matchNamePatterns: [/2024\D*pack\D*2\b/i, /season pack ?2\b/i],
    packName: "2024 Pack 2",
    tracks: ["COTA"],
    cars: [
      { carClass: "Hypercar", name: "Alpine A424 LMDh" },
      { carClass: "Hypercar", name: "Isotta Fraschini Tipo 6 Competizione" },
    ],
  },
  {
    // Le Mans Ultimate - 2024 Pack 3, декабрь 2024 (первые LMGT3 в игре)
    appid: 3260810,
    matchNamePatterns: [/2024\D*pack\D*3\b/i, /season pack ?3\b/i],
    packName: "2024 Pack 3",
    tracks: ["Interlagos"],
    cars: [
      { carClass: "LMGT3", name: "BMW M4 LMGT3" },
      { carClass: "LMGT3", name: "Chevrolet Corvette Z06 LMGT3.R" },
      { carClass: "LMGT3", name: "Ferrari 296 LMGT3" },
    ],
  },
  {
    // Le Mans Ultimate - 2024 Pack 4, начало 2025 — без новой трассы
    appid: 3260820,
    matchNamePatterns: [/2024\D*pack\D*4\b/i, /season pack ?4\b/i],
    packName: "2024 Pack 4",
    tracks: [],
    cars: [
      { carClass: "LMGT3", name: "Porsche 911 GT3 R (992) LMGT3" },
      { carClass: "LMGT3", name: "Aston Martin Vantage AMR LMGT3" },
    ],
  },
  {
    // Le Mans Ultimate - 2024 Pack 5, июнь 2025 — завершает контент сезона 2024
    appid: 3511300,
    matchNamePatterns: [/2024\D*pack\D*5\b/i, /season pack ?5\b/i],
    packName: "2024 Pack 5",
    tracks: ["Lusail"],
    cars: [
      { carClass: "LMGT3", name: "Lexus RC F LMGT3" },
      { carClass: "LMGT3", name: "Lamborghini Huracán GT3 EVO2" },
    ],
  },
  {
    // Le Mans Ultimate - 2024 Season Pass — не отдельный контент-пак, а
    // подписка/пропуск на весь сезон 2024 (isPass=true, см. server/steamApi.ts).
    // tracks/cars/includedDlc вычисляются автоматически из паков ниже —
    // см. includesAppIds и resolvePassEntry().
    appid: 2997280,
    matchNamePatterns: [/2024 season pass/i],
    tracks: [],
    cars: [],
    includesAppIds: [2973290, 3151390, 3260810, 3260820, 3511300],
  },
  {
    // Le Mans Ultimate - ELMS Pack 1, 23.09.2025
    appid: 3954000,
    matchNamePatterns: [/elms pack ?1\b/i],
    packName: "ELMS Pack 1",
    tracks: ["Silverstone"],
    cars: [{ carClass: "LMP3", name: "Ligier JS P325" }],
  },
  {
    // Le Mans Ultimate - ELMS Pack 2, 09.12.2025
    appid: 3954010,
    matchNamePatterns: [/elms pack ?2\b/i],
    packName: "ELMS Pack 2",
    tracks: ["Paul Ricard"],
    cars: [{ carClass: "LMP3", name: "Ginetta G61-LT-P3 Evo" }],
  },
  {
    // Le Mans Ultimate - ELMS Pack 3, 31.03.2026 — завершает грид LMP3
    appid: 3954020,
    matchNamePatterns: [/elms pack ?3\b/i],
    packName: "ELMS Pack 3",
    tracks: ["Barcelona"],
    cars: [{ carClass: "LMP3", name: "Duqueine D09" }],
  },
  {
    // Le Mans Ultimate - ELMS Season Pass — подписка на ELMS Pack 1-3
    // (isPass=true). tracks/cars/includedDlc вычисляются автоматически —
    // см. includesAppIds и resolvePassEntry().
    appid: 3948300,
    matchNamePatterns: [/elms season pass/i],
    tracks: [],
    cars: [],
    includesAppIds: [3954000, 3954010, 3954020],
  },
  {
    // Le Mans Ultimate - US Track Pack 1, 28.07.2026 — первый из 3 паков
    appid: 4694190,
    matchNamePatterns: [/us track pack[^0-9]*1\b/i],
    packName: "US Track Pack 1",
    tracks: ["Daytona International Speedway", "WeatherTech Raceway Laguna Seca"],
    cars: [],
  },
  {
    // Le Mans Ultimate - US Track Pass — подписка на все 3 будущих US Track
    // Pack (isPass=true). Всего анонсировано 6 трасс, но на сегодня вышел
    // только Pack 1 — Pack 2 (~сентябрь 2026) и Pack 3 (Q4 2026) ещё не
    // выпущены, поэтому их appid здесь отсутствуют: includesAppIds ссылается
    // только на уже вышедший Pack 1, и tracks/cars/includedDlc вычисляются
    // из него одного (resolvePassEntry() ниже) — не выдумываем недоступный
    // контент (см. §3.12 REQUIREMENTS.md). Appid Pack 2/3 нужно добавить
    // сюда, когда они сами появятся отдельными записями в этом каталоге.
    appid: 4906890,
    matchNamePatterns: [/us track pass/i],
    tracks: [],
    cars: [],
    includesAppIds: [4694190],
  },
];

/**
 * Вычисляет tracks/cars/includedDlc записи Season/Track Pass как объединение
 * содержимого паков из `includesAppIds`. Пак, для которого ещё нет записи в
 * каталоге (ещё не вышел), просто пропускается — не подставляем то, чего
 * реально ещё нет в игре. Обычные (не-Pass) записи возвращаются как есть.
 */
function resolvePassEntry(entry: SteamContentCatalogEntry): SteamContentCatalogEntry {
  if (!entry.includesAppIds) return entry;

  const tracks = new Set<string>();
  const cars: SteamContentEntry[] = [];
  const seenCarKeys = new Set<string>();
  const includedDlc: string[] = [];

  for (const appid of entry.includesAppIds) {
    const source = DLC_CONTENT_CATALOG_BASE.find((e) => e.appid === appid);
    if (!source) continue; // пак ещё не вышел / не добавлен в каталог

    for (const track of source.tracks) tracks.add(track);
    for (const car of source.cars) {
      const key = `${car.carClass}|${car.name}`;
      if (!seenCarKeys.has(key)) {
        seenCarKeys.add(key);
        cars.push(car);
      }
    }
    if (source.packName) includedDlc.push(source.packName);
  }

  return { ...entry, tracks: [...tracks], cars, includedDlc };
}

const DLC_CONTENT_CATALOG: SteamContentCatalogEntry[] = DLC_CONTENT_CATALOG_BASE.map(resolvePassEntry);

export interface SteamFoundContent {
  tracks: string[];
  cars: SteamContentEntry[];
  /** Только для Season Pass/Track Pass — названия уже вышедших паков, входящих в подписку (см. SteamContentCatalogEntry.includedDlc) */
  includedDlc: string[];
}

/** Возвращает контент (трассы/машины/уже включённые DLC) для appid+название, либо null если не размечено. */
export function findSteamContent(appid: number, name: string): SteamFoundContent | null {
  if (appid === STEAM_BASE_APPID) {
    return { tracks: BASE_GAME_CONTENT.tracks, cars: BASE_GAME_CONTENT.cars, includedDlc: [] };
  }
  const byAppId = DLC_CONTENT_CATALOG.find((e) => e.appid === appid);
  if (byAppId) return { tracks: byAppId.tracks, cars: byAppId.cars, includedDlc: byAppId.includedDlc ?? [] };

  const byName = DLC_CONTENT_CATALOG.find((e) => e.matchNamePatterns?.some((pattern) => pattern.test(name)));
  return byName ? { tracks: byName.tracks, cars: byName.cars, includedDlc: byName.includedDlc ?? [] } : null;
}
