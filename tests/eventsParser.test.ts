import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getSpecialEvents, invalidateCache } from '../server/eventsParser';

describe('eventsParser', () => {

  beforeEach(() => {
    invalidateCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── invalidateCache ────────────────────────────────────────────────────────
  describe('invalidateCache', () => {
    it('сбрасывает кэш — следующий вызов делает новый запрос', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('network error'));
      vi.stubGlobal('fetch', mockFetch);

      await getSpecialEvents();
      const callsAfterFirst = mockFetch.mock.calls.length;

      invalidateCache();
      await getSpecialEvents();

      expect(mockFetch.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    });

    it('после сброса возвращает актуальные статические данные', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
      invalidateCache();
      const result = await getSpecialEvents();
      expect(result.events.length).toBeGreaterThan(0);
    });
  });

  // ── Fallback на статику ────────────────────────────────────────────────────
  describe('getSpecialEvents — fallback на статику', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    });

    it('возвращает объект с полем events', async () => {
      const result = await getSpecialEvents();
      expect(result).toHaveProperty('events');
    });

    it('events — непустой массив', async () => {
      const result = await getSpecialEvents();
      expect(result.events.length).toBeGreaterThan(0);
    });

    it('каждое событие имеет строковое поле id', async () => {
      const result = await getSpecialEvents();
      for (const event of result.events) {
        expect(event).toHaveProperty('id');
        expect(typeof event.id).toBe('string');
      }
    });

    it('каждое событие имеет поле track', async () => {
      const result = await getSpecialEvents();
      for (const event of result.events) {
        expect(event).toHaveProperty('track');
        expect(typeof event.track).toBe('string');
      }
    });

    it('у событий есть положительное duration', async () => {
      const result = await getSpecialEvents();
      for (const event of result.events) {
        expect(event.duration).toBeGreaterThan(0);
      }
    });

    it('у каждого события есть непустой массив classes', async () => {
      const result = await getSpecialEvents();
      for (const event of result.events) {
        expect(Array.isArray(event.classes)).toBe(true);
        expect(event.classes.length).toBeGreaterThan(0);
      }
    });

    it('fetchedAt — валидная ISO-дата', async () => {
      const result = await getSpecialEvents();
      expect(new Date(result.fetchedAt).getTime()).not.toBeNaN();
    });

    it('sourceUrl — непустая строка', async () => {
      const result = await getSpecialEvents();
      expect(typeof result.sourceUrl).toBe('string');
      expect(result.sourceUrl.length).toBeGreaterThan(0);
    });

    it('каждое событие имеет sourceUrl', async () => {
      const result = await getSpecialEvents();
      for (const event of result.events) {
        expect(typeof event.sourceUrl).toBe('string');
        expect(event.sourceUrl.length).toBeGreaterThan(0);
      }
    });

    it('возвращает кэшированный результат при повторном вызове', async () => {
      const first = await getSpecialEvents();
      const second = await getSpecialEvents();
      expect(first).toBe(second);
    });

    it('событие с 24h Le Mans имеет isFeatured = true', async () => {
      const result = await getSpecialEvents();
      const featured = result.events.filter((e) => e.isFeatured);
      expect(featured.length).toBeGreaterThan(0);
      expect(featured.some((e) => e.duration >= 24)).toBe(true);
    });

    it('trackTba = true у событий с трассой «TBA»', async () => {
      const result = await getSpecialEvents();
      const tbaEvents = result.events.filter((e) => e.trackTba);
      for (const e of tbaEvents) {
        expect(e.track.toUpperCase()).toContain('TBA');
      }
    });

    it('trackTba = false у событий с известной трассой', async () => {
      const result = await getSpecialEvents();
      const knownTrack = result.events.find((e) => !e.trackTba);
      expect(knownTrack).toBeDefined();
      expect(knownTrack!.track.toUpperCase()).not.toContain('TBA');
    });

    it('dateIso имеет формат YYYY-MM-DD', async () => {
      const result = await getSpecialEvents();
      const isoRe = /^\d{4}-\d{2}-\d{2}$/;
      for (const e of result.events) {
        expect(e.dateIso).toMatch(isoRe);
      }
    });

    it('weekOf начинается с «w/c»', async () => {
      const result = await getSpecialEvents();
      for (const e of result.events) {
        expect(e.weekOf).toMatch(/^w\/c /);
      }
    });

    it('у каждого события isFeatured — булево значение', async () => {
      const result = await getSpecialEvents();
      for (const e of result.events) {
        expect(typeof e.isFeatured).toBe('boolean');
      }
    });

    it('id совпадает с dateIso', async () => {
      const result = await getSpecialEvents();
      for (const e of result.events) {
        expect(e.id).toBe(e.dateIso);
      }
    });
  });

  // ── Кэширование ────────────────────────────────────────────────────────────
  describe('getSpecialEvents — кэширование', () => {
    it('не вызывает fetch повторно пока кэш живёт', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('offline'));
      vi.stubGlobal('fetch', mockFetch);

      await getSpecialEvents();
      await getSpecialEvents();
      await getSpecialEvents();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('после invalidateCache fetch вызывается снова', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('offline'));
      vi.stubGlobal('fetch', mockFetch);

      await getSpecialEvents();
      invalidateCache();
      await getSpecialEvents();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ── Успешный fetch (HTML-парсинг) ─────────────────────────────────────────
  describe('getSpecialEvents — успешный fetch', () => {
    it('при успешном fetch возвращает данные (не пустой массив)', async () => {
      const fakeHtml = `
        <html><body>
          <p>w/c 14/7 – 6 Hours Interlagos – Hypercar, LMGT3</p>
          <p>w/c 28/7 – 4 Hours TBA – Hypercar, WEC LMP2, LMGT3</p>
          <p>w/c 20/10 – 24 Hours Le Mans – Hypercar, WEC LMP2, LMGT3</p>
          <p>w/c 8/9 – 6 Hours COTA – Hypercar, LMGT3</p>
          <p>w/c 6/10 – 10 Hours TBA – Hypercar, WEC LMP2, LMGT3</p>
          <p>w/c 10/11 – 8 Hours Bahrain – Hypercar, LMGT3</p>
        </body></html>
      `;
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => fakeHtml,
      }));

      const result = await getSpecialEvents();
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.source).toBe('live');
    });

    it('распознаёт строки с длинным тире (—) вместо короткого (–)', async () => {
      const fakeHtml = `
        <html><body>
          <p>w/c 14/7 — 6 Hours Interlagos — Hypercar, LMGT3</p>
          <p>w/c 28/7 — 4 Hours Silverstone — Hypercar, WEC LMP2, LMGT3</p>
          <p>w/c 20/10 — 24 Hours Le Mans — Hypercar, WEC LMP2, LMGT3</p>
          <p>w/c 8/9 — 6 Hours COTA — Hypercar, LMGT3</p>
          <p>w/c 6/10 — 10 Hours TBA — Hypercar, WEC LMP2, LMGT3</p>
          <p>w/c 10/11 — 8 Hours Bahrain — Hypercar, LMGT3</p>
        </body></html>
      `;
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => fakeHtml,
      }));

      const result = await getSpecialEvents();
      const jul28 = result.events.find((e) => e.dateIso.endsWith('-07-28'));
      expect(jul28?.track).toBe('Silverstone');
      expect(jul28?.trackTba).toBe(false);
    });

    it('при HTTP-ошибке (не ok) fallback на статику', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => '',
      }));

      const result = await getSpecialEvents();
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.source).toBe('static');
    });

    it('при слишком малом числе распознанных событий fallback на статику', async () => {
      // Только 1 строка — меньше порога 5
      const fakeHtml = `<p>w/c 14/7 – 6 Hours Interlagos – Hypercar</p>`;
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        text: async () => fakeHtml,
      }));

      const result = await getSpecialEvents();
      // Должны получить статику (>= 5 событий)
      expect(result.events.length).toBeGreaterThanOrEqual(5);
      expect(result.source).toBe('static');
    });
  });
});
