import { describe, it, expect } from 'vitest';
import {
  normalizeRosterNames,
  rosterOverlapRatio,
  decideSupersedeAction,
  ROSTER_OVERLAP_THRESHOLD,
} from '../server/sessionSupersede';

describe('normalizeRosterNames', () => {
  it('схлопывает регистр и лишние пробелы к одному ключу', () => {
    const a = normalizeRosterNames(['  Vasiliy   Kalistratov ']);
    const b = normalizeRosterNames(['vasiliy kalistratov']);
    expect(a).toEqual(b);
  });

  it('разные пилоты дают разные ключи', () => {
    const set = normalizeRosterNames(['Driver A', 'Driver B']);
    expect(set.size).toBe(2);
  });
});

describe('rosterOverlapRatio', () => {
  it('100% пересечение (реальные данные — 31 одинаковый пилот в обоих дампах)', () => {
    const names = Array.from({ length: 31 }, (_, i) => `Driver ${i}`);
    const a = normalizeRosterNames(names);
    const b = normalizeRosterNames(names);
    expect(rosterOverlapRatio(a, b)).toBe(1);
  });

  it('пустое множество с любой из сторон -> 0, а не NaN', () => {
    const empty = normalizeRosterNames([]);
    const some = normalizeRosterNames(['Driver A']);
    expect(rosterOverlapRatio(empty, some)).toBe(0);
    expect(rosterOverlapRatio(some, empty)).toBe(0);
    expect(rosterOverlapRatio(empty, empty)).toBe(0);
  });

  it('16 из 31 общих пилотов (>= порога 0.5)', () => {
    const shared = Array.from({ length: 16 }, (_, i) => `Driver ${i}`);
    const a = normalizeRosterNames([...shared, ...Array.from({ length: 15 }, (_, i) => `A-only-${i}`)]);
    const b = normalizeRosterNames([...shared, ...Array.from({ length: 15 }, (_, i) => `B-only-${i}`)]);
    // min(|A|,|B|) = 31, пересечение = 16 -> 16/31 ≈ 0.516
    expect(rosterOverlapRatio(a, b)).toBeGreaterThanOrEqual(ROSTER_OVERLAP_THRESHOLD);
  });

  it('15 из 31 общих пилотов (< порога 0.5)', () => {
    const shared = Array.from({ length: 15 }, (_, i) => `Driver ${i}`);
    const a = normalizeRosterNames([...shared, ...Array.from({ length: 16 }, (_, i) => `A-only-${i}`)]);
    const b = normalizeRosterNames([...shared, ...Array.from({ length: 16 }, (_, i) => `B-only-${i}`)]);
    expect(rosterOverlapRatio(a, b)).toBeLessThan(ROSTER_OVERLAP_THRESHOLD);
  });
});

describe('decideSupersedeAction', () => {
  it('новый файл полнее (реальные цифры: 71 vs 17) -> REPLACE', () => {
    expect(decideSupersedeAction(71, 17)).toBe('REPLACE');
  });

  it('новый файл менее полон, чем уже сохранённый (17 vs 71) -> SKIP', () => {
    expect(decideSupersedeAction(17, 71)).toBe('SKIP');
  });

  it('равное число кругов -> SKIP (тай-брейк: не заменять ради нулевого выигрыша)', () => {
    expect(decideSupersedeAction(40, 40)).toBe('SKIP');
  });
});
