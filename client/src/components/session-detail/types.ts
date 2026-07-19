/**
 * SD-1: Barrel-файл локальных типов для компонентов session-detail.
 * Реэкспортирует все props / view-model типы, используемые внутри feature-папки.
 */

// ── Вкладки ──────────────────────────────────────────────────────────────────

/** Допустимые ключи вкладок страницы SessionDetail. Вкладка «sectors» удалена. */
export type SessionTabKey = 'results' | 'laps' | 'lapProgress';

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

/** Строка в таблице итогов сессии. */
export interface SessionResultRowView {
  position: number;
  driverName: string;
  carNumber: string | number;
  teamName?: string | null;
  carModel?: string | null;
  /** Отформатированное лучшее время круга. */
  bestLapTime: string;
  /** Отставание от лидера. */
  gap?: string | null;
  /** Интервал до предыдущего гонщика. */
  interval?: string | null;
  /** Количество пит-стопов. */
  pitStops?: number | null;
  totalLaps?: number | null;
  /** Признак флага финиша (DNS / DNF / DSQ…). */
  finishStatus?: string | null;
  /** 1 — живой игрок, 0 / null — ИИ. */
  isPlayer?: number | null;
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
  /** Является ли круг пит-лапом. */
  isPitLap?: boolean;
  // ── SD-18: Дополнительные столбцы ─────────────────────────────────────────
  /** Максимальная скорость на круге (км/ч или строка «—»). */
  maxSpeed: string;
  /** Остаток топлива на конец круга (литры или строка «—»). */
  fuelRemaining: string;
  /** Износ шин FL/FR/RL/RR (строки в %). */
  tyreWear: TyreWear | null;
  /** Тип/состав шин (например «Soft», «Medium», «Hard» или строка из данных). */
  tyreType: string;
}

/** Группа кругов одного пилота. */
export interface DriverLapsGroupView {
  driverName: string;
  carNumber: string | number;
  bestLapTime: string;
  laps: DriverLapRowView[];
  /** 1 — живой игрок, 0 / null — ИИ. */
  isPlayer?: number | null;
}

// ── Секторы ──────────────────────────────────────────────────────────────────

/** Лучшие времена по секторам для одного пилота. */
export interface DriverSectorSummary {
  driverName: string;
  carNumber: string | number;
  /** Лучшие времена секторов [S1, S2, S3] в виде строк. */
  bestSectors: [string, string, string];
  /** Теоретически лучший круг (сумма лучших секторов). */
  theoreticalBest: string;
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

/** Серия данных одного пилота для графика прогресса по кругам. */
export interface LapProgressSeries {
  driverName: string;
  carNumber: string | number;
  points: LapProgressPoint[];
}
