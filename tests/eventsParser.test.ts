import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getSpecialEvents, invalidateCache } from '../server/eventsParser';

describe('eventsParser', () => {

  beforeEach(() => {
    invalidateCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('invalidateCache', () => {
    it('сбрасывает кэш — следующий вызов делает новый запрос', async () => {
      // Подменяем fetch чтобы вернуть ошибку (упадём на fallback-статику)
      const mockFetch = vi.fn().mockRejectedValue(new Error('network error'));
      vi.stubGlobal('fetch', mockFetch);

      await getSpecialEvents();
      const callsAfterFirst = mockFetch.mock.calls.length;

      // После инвалидации fetch должен вызваться снова
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

    it('каждое событие имеет поле id', async () => {
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
      }
    });

    it('у событий есть положительное duration', async () => {
      const result = await getSpecialEvents();
      for (const event of result.events) {
        expect(event.duration).toBeGreaterThan(0);
      }
    });

    it('у каждого события есть массив classes', async () => {
      const result = await getSpecialEvents();
      for (const event of result.events) {
        expect(Array.isArray(event.classes)).toBe(true);
        expect(event.classes.length).toBeGreaterThan(0);
      }
    });

    it('fetchedAt — валидная ISO-дата', async () => {
      const result = await getSpecialEvents();
      expect(() => new Date(result.fetchedAt)).not.toThrow();
      expect(new Date(result.fetchedAt).getTime()).not.toBeNaN();
    });

    it('возвращает кэшированный результат при повторном вызове', async () => {
      const first = await getSpecialEvents();
      const second = await getSpecialEvents();
      // При кэше ссылки должны совпадать
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

    it('dateIso имеет формат YYYY-MM-DD', async () => {
      const result = await getSpecialEvents();
      const isoRe = /^\d{4}-\d{2}-\d{2}$/;
      for (const e of result.events) {
        expect(e.dateIso).toMatch(isoRe);
      }
    });
  });

  describe('getSpecialEvents — кэширование', () => {
    it('не вызывает fetch повторно пока кэш живёт', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('offline'));
      vi.stubGlobal('fetch', mockFetch);

      await getSpecialEvents();
      await getSpecialEvents();
      await getSpecialEvents();

      // fetch должен быть вызван ровно 1 раз
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
