// Контракт сервер/клиент для вкладки "LMU Steam" (карточки игры/DLC LMU
// из Steam Store API). Не привязан к таблице БД (кэш живёт в памяти
// процесса на сервере, см. server/steamApi.ts) — отдельный от shared/schema.ts
// файл, чтобы не смешивать с Drizzle-схемой.

export interface SteamPriceInfo {
  /** ISO-код валюты магазина, напр. "RUB" */
  currency: string;
  /** Цена до скидки, в минимальных единицах валюты (копейки/центы) */
  initialCents: number;
  /** Цена со скидкой; равна initialCents, если скидки нет */
  finalCents: number;
  /** 0..100 */
  discountPercent: number;
}

export interface SteamContentEntry {
  /** "Hypercar" | "LMP2" | "LMP3" | "LMGT3" | ... — сырая строка класса из каталога контента */
  carClass: string;
  name: string;
}

export interface SteamAppCard {
  appid: number;
  kind: "game" | "dlc";
  name: string;
  headerImage: string;
  shortDescription: string;
  storeUrl: string;
  isFree: boolean;
  /** Дата релиза из Steam (release_date.date), null если Steam её не отдал */
  releaseDate: string | null;
  /** null — бесплатно либо цена недоступна в выбранном регионе */
  price: SteamPriceInfo | null;
  tracks: string[];
  cars: SteamContentEntry[];
  /**
   * true для DLC-продуктов вида "... Season Pass"/"... Track Pass" (`kind`
   * остаётся "dlc" — так их классифицирует сам Steam). Это не отдельный
   * контент-пак, а подписка/пропуск, дающий доступ ко всем DLC-пакам
   * сезона/категории по мере их выхода — `tracks`/`cars` для такой карточки
   * в каталоге (server/steamCatalog.ts) намеренно совпадают с объединением
   * уже перечисленных отдельных паков, а не описывают собственный контент.
   */
  isPass: boolean;
  /**
   * true, если для этого приложения нет записи в статическом каталоге
   * контента (server/steamCatalog.ts) — свежедобавленный Steam-ом DLC,
   * который уже виден в списке (см. §3.13 REQUIREMENTS.md), но чьё
   * игровое содержимое (трассы/машины) ещё не размечено вручную.
   */
  isUnmappedContent: boolean;
}

export interface SteamCatalogResponse {
  fetchedAt: string;
  source: "live" | "static";
  /** Регион магазина Steam, для которого запрошены цены (cc=...) */
  region: string;
  /** items[0] — базовая игра, далее DLC в порядке ответа Steam */
  items: SteamAppCard[];
}
