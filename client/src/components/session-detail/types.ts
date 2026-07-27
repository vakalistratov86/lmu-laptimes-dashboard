/**
 * SD-1: Barrel-файл локальных типов для компонентов session-detail.
 * Реэкспортирует все props / view-model типы, используемые внутри feature-папки.
 */

// ── Вкладки ──────────────────────────────────────────────────────────────────

/** Допустимые ключи вкладок страницы SessionDetail. */
export type SessionTabKey = "results" | "laps" | "lapProgress";

/** Элемент навигационной вкладки. */
export interface SessionTabItem {
  key: SessionTabKey;
  label: string;
  /** Показывать вкладку, только когда есть данные о кругах. */
  requiresLapData?: boolean;
}

// ── Герой-статистика ─────────────────────────────────────────────────────────

/** Одна KPI-метрика в герой-блоке сессии. */
export interface SessionHeroStatItem {
  label: string;
  value: string;
  /** Опциональный подзаголовок (имя гонщика, название команды…). */
  subLabel?: string | null;
}

// ── Таблица результатов ──────────────────────────────────────────────────────

/**
 * Строка в таблице итогов сессии — ОДНА МАШИНА/КОМАНДА, не один пилот.
 * Командная гонка со сменой пилота даёт несколько session_results (по одному
 * на реального пилота) с одинаковым carNumber — buildResultRows() схлопывает
 * их в одну строку с суммарной статистикой (см. server/importWorker.ts про
 * происхождение driverCount/стинтов). Кто именно вёл какой круг — смотри
 * вкладку "Круги" (DriverLapRowView.driverName), не эту таблицу.
 */
export interface SessionResultRowView {
  position: number;
  /** Ключ группировки/выбора строки — carNumber (или синтетический фолбэк). */
  carKey: string;
  /** Имя пилота (driverCount === 1) или название команды (driverCount > 1). */
  driverName: string;
  /** Сколько разных реальных пилотов сидело за рулём этой машины за сессию. */
  driverCount: number;
  carNumber: string | number;
  teamName?: string | null;
  carModel?: string | null;
  /** Отформатированное лучшее время круга — минимум среди всех пилотов машины. */
  bestLapTime: string;
  /** Отставание от лидера. */
  gap?: string | null;
  /** Интервал до предыдущего гонщика. */
  interval?: string | null;
  /** Суммарное количество пит-стопов по всем пилотам машины. */
  pitStops?: number | null;
  /** Суммарное количество кругов по всем пилотам машины. */
  totalLaps?: number | null;
  /** Признак флага финиша (DNS / DNF / DSQ…). */
  finishStatus?: string | null;
  /** 1 — за рулём был живой игрок (хотя бы один из пилотов машины), 0 / null — ИИ. */
  isPlayer?: number | null;
  /** Класс машины (Hypercar / LMP2 / GT3…). */
  carClass?: string | null;
}

// ── Круги по пилотам ─────────────────────────────────────────────────────────

/** Износ шин по четырём колёсам (FL/FR/RL/RR) в процентах. */
export interface TyreWear {
  fl: string;
  fr: string;
  rl: string;
  rr: string;
}

/** Один круг конкретного пилота. */
export interface DriverLapRowView {
  lapNumber: number;
  lapTime: string;
  /** Является ли круг персональным лучшим. */
  isPersonalBest: boolean;
  /** Является ли круг абсолютным лучшим в сессии. */
  isOverallBest: boolean;
  /** Сектора круга в виде отформатированных строк. */
  sectors: [string, string, string];
  /**
   * Лучший ли это сектор пилота за сессию (среди его собственных кругов),
   * по каждому из трёх секторов отдельно.
   */
  sectorsPersonalBest: [boolean, boolean, boolean];
  /**
   * Лучший ли это сектор среди ВСЕХ пилотов сессии, по каждому из трёх
   * секторов отдельно. Имеет приоритет над sectorsPersonalBest в отображении.
   */
  sectorsAbsoluteBest: [boolean, boolean, boolean];
  /** Является ли круг пит-лапом. */
  isPitLap?: boolean;
  // ── SD-18: Дополнительные столбцы ─────────────────────────────────────────
  /** Максимальная скорость на круге (км/ч или строка «—»). */
  maxSpeed: string;
  /** Остаток топлива на конец круга, % от полного бака (целое число или строка «—»). */
  fuelRemaining: string;
  /** Износ шин FL/FR/RL/RR — оставшийся ресурс в %, целое число. */
  tyreWear: TyreWear | null;
  /** Тип/состав шин (например «Soft», «Medium», «Hard» или строка из данных). */
  tyreType: string;
  /** Кто вёл машину на этом круге (командная гонка со сменой пилота). */
  driverName?: string;
  /** 1 — за рулём был живой игрок, 0 / null — ИИ (см. driverName). */
  isPlayer?: number | null;
}

/** Группа кругов одной МАШИНЫ (может объединять несколько реальных пилотов). */
export interface DriverLapsGroupView {
  carKey: string;
  /** Имя пилота (driverCount === 1) или сводное обозначение команды (driverCount > 1). */
  driverName: string;
  /** Сколько разных реальных пилотов вело эту машину за сессию. */
  driverCount: number;
  carNumber: string | number;
  bestLapTime: string;
  laps: DriverLapRowView[];
  /** 1 — живой игрок, 0 / null — ИИ. */
  isPlayer?: number | null;
  // ── SD-19: Агрегированная статистика по кругам пилота ─────────────────────
  /** Средний круг (без учёта пит-лапов). */
  avgLapTime: string;
  /** Худший (самый медленный) круг без учёта пит-лапов. */
  worstLapTime: string;
  /** Максимальная зафиксированная скорость за сессию (км/ч). */
  maxSpeedObserved: string;
  /** Уникальные типы/составы шин, использованные за сессию. */
  tyreTypesUsed: string[];
  /** Остаток топлива на первом зафиксированном круге, % от полного бака. */
  fuelStart: string;
  /** Остаток топлива на последнем зафиксированном круге, % от полного бака. */
  fuelEnd: string;
  /** Количество пит-лапов. */
  pitLapsCount: number;
}

// ── Секторы ──────────────────────────────────────────────────────────────────

/** Лучшие времена по секторам одной машины (сумма/минимум по всем её пилотам). */
export interface DriverSectorSummary {
  carKey: string;
  driverName: string;
  carNumber: string | number;
  /** Лучшие времена секторов [S1, S2, S3] в виде строк. */
  bestSectors: [string, string, string];
  /** Теоретически лучший круг (сумма лучших секторов). */
  theoreticalBest: string;
  /** Является ли каждый из секторов [S1, S2, S3] абсолютно лучшим в сессии. */
  sectorAbsoluteBest: [boolean, boolean, boolean];
  /** Является ли хотя бы один сектор абсолютно лучшим в сессии. */
  hasAbsoluteBest: boolean;
}

/** Абсолютный лучший по каждому сектору в сессии. */
export interface AbsoluteSectorBest {
  sector: 1 | 2 | 3;
  driverName: string;
  time: string;
}

// ── Прогресс по кругам (chart) ───────────────────────────────────────────────

/** Точка на графике прогресса по кругам. */
export interface LapProgressPoint {
  lap: number;
  /** Время круга в секундах (числовое для графика). */
  timeSeconds: number;
  /** Отформатированное время для подсказки. */
  timeFormatted: string;
}

/** Серия данных одной машины для графика прогресса по кругам. */
export interface LapProgressSeries {
  carKey: string;
  driverName: string;
  carNumber: string | number;
  points: LapProgressPoint[];
}
