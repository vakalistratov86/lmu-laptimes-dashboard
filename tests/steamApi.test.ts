import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  normalizeSteamApp,
  fetchSteamCatalog,
  refreshSteamCatalog,
  invalidateSteamCatalogCache,
} from "../server/steamApi";
import { STEAM_BASE_APPID } from "../server/steamCatalog";

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

/** Строит мок fetch, отвечающий на appdetails?appids=N по карте appid -> raw data (либо null для success:false). */
function mockAppDetailsFetch(byAppId: Record<number, unknown | null>) {
  return vi.fn(async (url: string) => {
    const match = /appids=(\d+)/.exec(url);
    const appid = match ? Number(match[1]) : NaN;
    if (!(appid in byAppId)) return jsonResponse({}, false, 404);
    const data = byAppId[appid];
    return jsonResponse({ [String(appid)]: data === null ? { success: false } : { success: true, data } });
  });
}

describe("steamApi", () => {
  beforeEach(() => {
    invalidateSteamCatalogCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ── normalizeSteamApp — чистая функция трансформации ────────────────────
  describe("normalizeSteamApp", () => {
    it("парсит цену со скидкой", () => {
      const card = normalizeSteamApp(STEAM_BASE_APPID, "game", {
        name: "Le Mans Ultimate",
        price_overview: { currency: "RUB", initial: 219900, final: 164900, discount_percent: 25 },
      });
      expect(card.price).toEqual({ currency: "RUB", initialCents: 219900, finalCents: 164900, discountPercent: 25 });
    });

    it("price === null при отсутствии price_overview", () => {
      const card = normalizeSteamApp(123, "dlc", { name: "Some DLC" });
      expect(card.price).toBeNull();
    });

    it("isFree=true при is_free", () => {
      const card = normalizeSteamApp(123, "dlc", { name: "Some Free DLC", is_free: true });
      expect(card.isFree).toBe(true);
    });

    it("базовая игра получает трассы/машины из статического каталога, isUnmappedContent=false", () => {
      const card = normalizeSteamApp(STEAM_BASE_APPID, "game", { name: "Le Mans Ultimate" });
      expect(card.tracks.length).toBeGreaterThan(0);
      expect(card.cars.length).toBeGreaterThan(0);
      expect(card.isUnmappedContent).toBe(false);
    });

    it("неизвестный DLC получает пустые списки и isUnmappedContent=true", () => {
      const card = normalizeSteamApp(999999, "dlc", { name: "Совершенно новый DLC, которого нет в каталоге" });
      expect(card.tracks).toEqual([]);
      expect(card.cars).toEqual([]);
      expect(card.isUnmappedContent).toBe(true);
    });

    it("известный DLC (2024 Season Pack 3) сопоставляется по названию", () => {
      const card = normalizeSteamApp(555, "dlc", { name: "Le Mans Ultimate - 2024 Season Pack 3" });
      expect(card.tracks).toContain("Interlagos");
      expect(card.cars.length).toBeGreaterThan(0);
      expect(card.isUnmappedContent).toBe(false);
    });

    it("releaseDate === null, если Steam не отдал release_date.date", () => {
      const card = normalizeSteamApp(123, "dlc", { name: "Some DLC" });
      expect(card.releaseDate).toBeNull();
    });

    it("isPass=true для DLC вида «... Season Pass» — это подписка на DLC сезона, не отдельный контент", () => {
      const card = normalizeSteamApp(2997280, "dlc", { name: "Le Mans Ultimate - 2024 Season Pass" });
      expect(card.isPass).toBe(true);
    });

    it("isPass=true для DLC вида «... Track Pass»", () => {
      const card = normalizeSteamApp(4906890, "dlc", { name: "Le Mans Ultimate - US Track Pass" });
      expect(card.isPass).toBe(true);
    });

    it("isPass=false для обычного контент-пака без слова Pass в названии", () => {
      const card = normalizeSteamApp(2973290, "dlc", { name: "Le Mans Ultimate - 2024 Pack 1" });
      expect(card.isPass).toBe(false);
    });

    it("isPass всегда false для базовой игры (kind=game)", () => {
      const card = normalizeSteamApp(STEAM_BASE_APPID, "game", { name: "Le Mans Ultimate - Season Pass Edition" });
      expect(card.isPass).toBe(false);
    });
  });

  // ── fetchSteamCatalog — живой сценарий ───────────────────────────────────
  describe("fetchSteamCatalog — успешный сценарий", () => {
    it("собирает базовую игру и все DLC из dlc[]", async () => {
      vi.stubGlobal(
        "fetch",
        mockAppDetailsFetch({
          [STEAM_BASE_APPID]: { name: "Le Mans Ultimate", dlc: [111, 222] },
          111: { name: "DLC One" },
          222: { name: "DLC Two" },
        }),
      );

      const result = await fetchSteamCatalog();
      expect(result.source).toBe("live");
      expect(result.items).toHaveLength(3);
      expect(result.items[0].kind).toBe("game");
      expect(result.items.slice(1).every((i) => i.kind === "dlc")).toBe(true);
    });

    it("пропускает DLC с success:false, не проваливая весь запрос", async () => {
      vi.stubGlobal(
        "fetch",
        mockAppDetailsFetch({
          [STEAM_BASE_APPID]: { name: "Le Mans Ultimate", dlc: [111, 222] },
          111: { name: "DLC One" },
          222: null,
        }),
      );

      const result = await fetchSteamCatalog();
      expect(result.items).toHaveLength(2);
      expect(result.items.map((i) => i.appid)).toEqual([STEAM_BASE_APPID, 111]);
    });

    it("кэширует ответ — повторный вызов не бьёт в сеть снова", async () => {
      const mockFetch = mockAppDetailsFetch({ [STEAM_BASE_APPID]: { name: "Le Mans Ultimate", dlc: [] } });
      vi.stubGlobal("fetch", mockFetch);

      await fetchSteamCatalog();
      const callsAfterFirst = mockFetch.mock.calls.length;
      await fetchSteamCatalog();
      expect(mockFetch.mock.calls.length).toBe(callsAfterFirst);
    });
  });

  // ── fetchSteamCatalog — недоступность Steam ──────────────────────────────
  describe("fetchSteamCatalog — Steam недоступен", () => {
    it("без предыдущего кэша отдаёт статический фолбэк с source=static", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

      const result = await fetchSteamCatalog();
      expect(result.source).toBe("static");
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items[0].appid).toBe(STEAM_BASE_APPID);
    });
  });

  // ── refreshSteamCatalog / invalidateSteamCatalogCache ────────────────────
  describe("refreshSteamCatalog", () => {
    it("сбрасывает кэш и делает новый запрос", async () => {
      const mockFetch = mockAppDetailsFetch({ [STEAM_BASE_APPID]: { name: "Le Mans Ultimate", dlc: [] } });
      vi.stubGlobal("fetch", mockFetch);

      await fetchSteamCatalog();
      const callsAfterFirst = mockFetch.mock.calls.length;
      await refreshSteamCatalog();
      expect(mockFetch.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });
  });
});
