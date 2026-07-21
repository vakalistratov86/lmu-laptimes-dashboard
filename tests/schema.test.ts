import { describe, it, expect } from 'vitest';
import {
  insertTrackSchema,
  insertDriverSchema,
  insertLapTimeSchema,
  insertSessionSchema,
  insertSessionResultSchema,
} from '../shared/schema';

describe('Zod-схемы (shared/schema)', () => {

  // ── insertTrackSchema ─────────────────────────────────────────────────────
  describe('insertTrackSchema', () => {
    const validTrack = {
      name: 'Le Mans',
      country: 'FR',
      lengthKm: 13.626,
      turns: 38,
      layout: 'Full',
    };

    it('принимает корректные данные трассы', () => {
      expect(() => insertTrackSchema.parse(validTrack)).not.toThrow();
    });

    it('принимает пустую строку name (min() не задан в схеме)', () => {
      // drizzle-zod генерирует z.string() без min() — пустая строка проходит тип
      expect(() => insertTrackSchema.parse({ ...validTrack, name: '' })).not.toThrow();
    });

    it('отклоняет name как число', () => {
      expect(() => insertTrackSchema.parse({ ...validTrack, name: 123 })).toThrow();
    });

    it('отклоняет отсутствие обязательного поля country', () => {
      const { country, ...rest } = validTrack;
      expect(() => insertTrackSchema.parse(rest)).toThrow();
    });

    it('lengthKm принимает float', () => {
      const result = insertTrackSchema.parse(validTrack);
      expect(result.lengthKm).toBe(13.626);
    });

    it('turns должно быть числом', () => {
      expect(() => insertTrackSchema.parse({ ...validTrack, turns: 'много' })).toThrow();
    });

    it('отклоняет отсутствие name', () => {
      const { name, ...rest } = validTrack;
      expect(() => insertTrackSchema.parse(rest)).toThrow();
    });

    it('отклоняет отсутствие layout', () => {
      const { layout, ...rest } = validTrack;
      expect(() => insertTrackSchema.parse(rest)).toThrow();
    });

    it('отклоняет lengthKm как строку', () => {
      expect(() => insertTrackSchema.parse({ ...validTrack, lengthKm: '13.6' })).toThrow();
    });
  });

  // ── insertDriverSchema ────────────────────────────────────────────────────
  describe('insertDriverSchema', () => {
    const validDriver = {
      name: 'Nikita Mazepin',
      team: 'Haas',
      country: 'RU',
    };

    it('принимает корректные данные пилота', () => {
      expect(() => insertDriverSchema.parse(validDriver)).not.toThrow();
    });

    it('отклоняет отсутствие team', () => {
      const { team, ...rest } = validDriver;
      expect(() => insertDriverSchema.parse(rest)).toThrow();
    });

    it('отклоняет числовой name', () => {
      expect(() => insertDriverSchema.parse({ ...validDriver, name: 42 })).toThrow();
    });

    it('отклоняет отсутствие country', () => {
      const { country, ...rest } = validDriver;
      expect(() => insertDriverSchema.parse(rest)).toThrow();
    });

    it('отклоняет числовой team', () => {
      expect(() => insertDriverSchema.parse({ ...validDriver, team: 99 })).toThrow();
    });
  });

  // ── insertLapTimeSchema ───────────────────────────────────────────────────
  describe('insertLapTimeSchema', () => {
    const validLap = {
      trackId: 1,
      driverId: 1,
      carClass: 'Hypercar',
      car: 'Toyota GR010',
      lapMs: 101907,
      sector1Ms: 27440,
      sector2Ms: 51667,
      sector3Ms: 22800,
      conditions: 'Сухо',
      tyre: 'Soft',
      date: '2026-07-14',
    };

    it('принимает корректный круг', () => {
      expect(() => insertLapTimeSchema.parse(validLap)).not.toThrow();
    });

    it('отклоняет lapMs как строку', () => {
      expect(() => insertLapTimeSchema.parse({ ...validLap, lapMs: '101907' })).toThrow();
    });

    it('отклоняет отсутствие trackId', () => {
      const { trackId, ...rest } = validLap;
      expect(() => insertLapTimeSchema.parse(rest)).toThrow();
    });

    it('отклоняет отсутствие driverId', () => {
      const { driverId, ...rest } = validLap;
      expect(() => insertLapTimeSchema.parse(rest)).toThrow();
    });

    it('sessionId опционален — принимает undefined', () => {
      expect(() => insertLapTimeSchema.parse({ ...validLap, sessionId: undefined })).not.toThrow();
    });

    it('sessionId принимает число', () => {
      expect(() => insertLapTimeSchema.parse({ ...validLap, sessionId: 5 })).not.toThrow();
    });

    it('отклоняет sector1Ms как строку', () => {
      expect(() => insertLapTimeSchema.parse({ ...validLap, sector1Ms: '27440' })).toThrow();
    });
  });

  // ── insertSessionSchema ───────────────────────────────────────────────────
  describe('insertSessionSchema', () => {
    const validSession = {
      trackId: 1,
      event: '6 Hours of Le Mans',
      sessionType: 'Race',
      venue: 'Le Mans',
      dateTime: '2026-07-14T15:00:00.000Z',
      fileName: 'race_results.xml',
      driverCount: 30,
      lapCount: 600,
    };

    it('принимает корректную сессию', () => {
      expect(() => insertSessionSchema.parse(validSession)).not.toThrow();
    });

    it('gameVersion опционален', () => {
      expect(() => insertSessionSchema.parse({ ...validSession, gameVersion: undefined })).not.toThrow();
    });

    it('gameVersion принимает строку', () => {
      const result = insertSessionSchema.parse({ ...validSession, gameVersion: '2.00' });
      expect(result.gameVersion).toBe('2.00');
    });

    it('отклоняет отсутствие event', () => {
      const { event, ...rest } = validSession;
      expect(() => insertSessionSchema.parse(rest)).toThrow();
    });

    it('отклоняет driverCount как строку', () => {
      expect(() => insertSessionSchema.parse({ ...validSession, driverCount: 'много' })).toThrow();
    });

    it('отклоняет отсутствие trackId', () => {
      const { trackId, ...rest } = validSession;
      expect(() => insertSessionSchema.parse(rest)).toThrow();
    });

    it('отклоняет отсутствие fileName', () => {
      const { fileName, ...rest } = validSession;
      expect(() => insertSessionSchema.parse(rest)).toThrow();
    });
  });

  // ── insertSessionResultSchema ─────────────────────────────────────────────
  describe('insertSessionResultSchema', () => {
    const validResult = {
      sessionId: 1,
      driverId: 1,
      position: 1,
      classPosition: 1,
      carClass: 'Hypercar',
      car: 'Toyota GR010',
      team: 'Toyota Gazoo Racing',
      laps: 30,
      pitstops: 2,
    };

    it('принимает корректный результат сессии', () => {
      expect(() => insertSessionResultSchema.parse(validResult)).not.toThrow();
    });

    it('isPlayer по умолчанию = 0', () => {
      const result = insertSessionResultSchema.parse(validResult);
      expect(result.isPlayer).toBe(0);
    });

    it('bestLapMs опционален', () => {
      expect(() => insertSessionResultSchema.parse({ ...validResult, bestLapMs: undefined })).not.toThrow();
    });

    it('bestLapMs принимает число', () => {
      const result = insertSessionResultSchema.parse({ ...validResult, bestLapMs: 101907 });
      expect(result.bestLapMs).toBe(101907);
    });

    it('carNumber опционален', () => {
      expect(() => insertSessionResultSchema.parse({ ...validResult, carNumber: undefined })).not.toThrow();
    });

    it('отклоняет отсутствие sessionId', () => {
      const { sessionId, ...rest } = validResult;
      expect(() => insertSessionResultSchema.parse(rest)).toThrow();
    });

    it('отклоняет position как строку', () => {
      expect(() => insertSessionResultSchema.parse({ ...validResult, position: 'первый' })).toThrow();
    });
  });
});
