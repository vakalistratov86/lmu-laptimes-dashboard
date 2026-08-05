// Интеграция со Steam Store API (appdetails) для вкладки "LMU Steam".
// Кэш в памяти + фолбэк на статические данные при недоступности источника —
// та же схема, что в server/eventsParser.ts (см. getSpecialEvents()).

import { logger } from "./logger";
import { STEAM_BASE_APPID, findSteamContent } from "./steamCatalog";
import type { SteamAppCard, SteamCatalogResponse, SteamPriceInfo } from "@shared/steamTypes";

/**
 * Регион Steam-магазина для цен/валюты (`cc=`). Необязательная переменная
 * окружения — без неё используется "ru" (согласовано с пользователем).
 */
export const STEAM_STORE_REGION = process.env.STEAM_STORE_REGION?.trim() || "ru";
const STEAM_STORE_LANGUAGE = STEAM_STORE_REGION === "ru" ? "russian" : "english";

const APPDETAILS_URL = "https://store.steampowered.com/api/appdetails";

// Steam appdetails — публичный, но неофициальный (не документированный
// Valve) эндпоинт: типизируем только те поля, которые реально используем,
// остальное поведение защищаем optional chaining / дефолтами ниже.
interface SteamPriceOverviewRaw {
  currency?: string;
  initial?: number;
  final?: number;
  discount_percent?: number;
}

interface SteamAppDataRaw {
  type?: string;
  name?: string;
  steam_appid?: number;
  is_free?: boolean;
  dlc?: number[];
  header_image?: string;
  short_description?: string;
  release_date?: { coming_soon?: boolean; date?: string };
  price_overview?: SteamPriceOverviewRaw;
}

interface SteamAppDetailsRaw {
  success: boolean;
  data?: SteamAppDataRaw;
}

async function fetchAppDetails(appid: number): Promise<SteamAppDataRaw | null> {
  const url = `${APPDETAILS_URL}?appids=${appid}&cc=${STEAM_STORE_REGION}&l=${STEAM_STORE_LANGUAGE}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "LMU-Dashboard/1.0 (steam-catalog-bot)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as Record<string, SteamAppDetailsRaw>;
  const entry = json[String(appid)];
  if (!entry?.success || !entry.data) return null;
  return entry.data;
}

/**
 * Чистая функция трансформации: сырой ответ Steam appdetails -> карточка
 * приложения для клиента. Обогащает трассами/машинами из статического
 * каталога (server/steamCatalog.ts) по appid (базовая игра) или по
 * названию (DLC) — appid DLC не хардкодится нигде в коде, только приходит
 * от Steam динамически (см. fetchLiveCatalog).
 */
export function normalizeSteamApp(appid: number, kind: "game" | "dlc", data: SteamAppDataRaw): SteamAppCard {
  const name = data.name?.trim() || `Steam App ${appid}`;
  const priceOverview = data.price_overview;
  const price: SteamPriceInfo | null = priceOverview
    ? {
        currency: priceOverview.currency ?? "RUB",
        initialCents: priceOverview.initial ?? priceOverview.final ?? 0,
        finalCents: priceOverview.final ?? priceOverview.initial ?? 0,
        discountPercent: priceOverview.discount_percent ?? 0,
      }
    : null;
  const content = findSteamContent(appid, name);
  // "... Season Pass" / "... Track Pass" — не отдельный контент-пак, а
  // подписка/пропуск на весь DLC-контент сезона/категории (доступ ко всем
  // паками, включая ещё не вышедшие, по мере релиза), поэтому размечается
  // отдельно от обычного kind="dlc" (см. shared/steamTypes.ts).
  const isPass = kind === "dlc" && /\bpass\b/i.test(name);

  return {
    appid,
    kind,
    name,
    headerImage: data.header_image ?? "",
    shortDescription: data.short_description ?? "",
    storeUrl: `https://store.steampowered.com/app/${appid}/`,
    isFree: data.is_free ?? false,
    releaseDate: data.release_date?.date ?? null,
    price,
    tracks: content?.tracks ?? [],
    cars: content?.cars ?? [],
    isPass,
    includedDlc: content?.includedDlc ?? [],
    isUnmappedContent: content === null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Ограничиваем параллельность запросов к DLC, чтобы не словить рейт-лимит
// Steam (не документирован официально, на практике — не более пары
// одновременных запросов с одного IP на высокой частоте).
const DLC_FETCH_CONCURRENCY = 3;
const DLC_FETCH_BATCH_DELAY_MS = 300;

async function fetchLiveCatalog(): Promise<SteamCatalogResponse> {
  const baseData = await fetchAppDetails(STEAM_BASE_APPID);
  if (!baseData) throw new Error("Steam appdetails не вернул данные по базовой игре LMU");
  const baseCard = normalizeSteamApp(STEAM_BASE_APPID, "game", baseData);

  // Список DLC — всегда живой, из ответа Steam, не хардкодится: новый DLC
  // появляется в dlc[] в день релиза и на ближайшем обновлении кэша сам
  // становится новой карточкой без изменений кода (см. §3.13 REQUIREMENTS.md).
  const dlcAppIds = baseData.dlc ?? [];

  const dlcCards: SteamAppCard[] = [];
  for (let i = 0; i < dlcAppIds.length; i += DLC_FETCH_CONCURRENCY) {
    const batch = dlcAppIds.slice(i, i + DLC_FETCH_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (appid) => {
        try {
          const data = await fetchAppDetails(appid);
          return data ? normalizeSteamApp(appid, "dlc", data) : null;
        } catch (err) {
          logger.warn(
            { appid, error: err instanceof Error ? err.message : String(err) },
            "Не удалось получить данные DLC из Steam — пропущено в этом обновлении каталога",
          );
          return null;
        }
      }),
    );
    dlcCards.push(...results.filter((card): card is SteamAppCard => card !== null));
    if (i + DLC_FETCH_CONCURRENCY < dlcAppIds.length) await sleep(DLC_FETCH_BATCH_DELAY_MS);
  }

  return {
    fetchedAt: new Date().toISOString(),
    source: "live",
    region: STEAM_STORE_REGION,
    items: [baseCard, ...dlcCards],
  };
}

/**
 * Минимальный фолбэк, когда Steam недоступен и живого кэша ещё не было ни
 * разу: только базовая игра (её appid и игровой контент нам достоверно
 * известны независимо от Steam), без цены — не выдумываем то, что реально
 * не знаем (см. §3.12 REQUIREMENTS.md).
 */
function buildStaticFallback(): SteamCatalogResponse {
  const content = findSteamContent(STEAM_BASE_APPID, "Le Mans Ultimate");
  const baseCard: SteamAppCard = {
    appid: STEAM_BASE_APPID,
    kind: "game",
    name: "Le Mans Ultimate",
    headerImage: `https://cdn.akamai.steamstatic.com/steam/apps/${STEAM_BASE_APPID}/header.jpg`,
    shortDescription: "",
    storeUrl: `https://store.steampowered.com/app/${STEAM_BASE_APPID}/`,
    isFree: false,
    releaseDate: null,
    price: null,
    tracks: content?.tracks ?? [],
    cars: content?.cars ?? [],
    isPass: false,
    includedDlc: [],
    isUnmappedContent: false,
  };
  return {
    fetchedAt: new Date().toISOString(),
    source: "static",
    region: STEAM_STORE_REGION,
    items: [baseCard],
  };
}

let cache: SteamCatalogResponse | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 часов — для успешного ответа
const CACHE_TTL_ERROR_MS = 5 * 60 * 1000; // 5 минут — после сетевой ошибки, для быстрого восстановления

export async function fetchSteamCatalog(): Promise<SteamCatalogResponse> {
  const now = Date.now();
  if (cache && now < cacheExpiry) return cache;

  try {
    cache = await fetchLiveCatalog();
    cacheExpiry = now + CACHE_TTL_MS;
  } catch (err) {
    logger.error(
      { error: err instanceof Error ? err.message : String(err) },
      "Не удалось получить каталог Steam для LMU — используются сохранённые/статические данные",
    );
    // Отдаём последний успешный кэш, если он есть (пусть и просроченный) —
    // лучше слегка устаревшие данные, чем пустая страница на временный сбой.
    if (!cache) cache = buildStaticFallback();
    cacheExpiry = now + CACHE_TTL_ERROR_MS;
  }
  return cache;
}

/** Сбрасывает кэш без сетевого запроса (аналог invalidateCache() в eventsParser.ts) — используется тестами и refreshSteamCatalog(). */
export function invalidateSteamCatalogCache(): void {
  cache = null;
  cacheExpiry = 0;
}

export async function refreshSteamCatalog(): Promise<SteamCatalogResponse> {
  invalidateSteamCatalogCache();
  return fetchSteamCatalog();
}
