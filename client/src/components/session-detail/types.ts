/**
 * SD-1: Barrel-файл локальных типов для компонентов session-detail.
 * Реэкспортирует все props / view-model типы, используемые внутри feature-папки.
 */

// ── Вкладки ──────────────────────────────────────────────────────────────────

/** Допустимые ключи вкладок страницы SessionDetail. */
export type SessionTabKey = 'results' | 'laps' | 'sectors' | 'lapProgress';

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
}

// ── Круги по пилотам ─────────────────────────────────────────────────────────

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
}

/** Группа кругов одного пилота. */
export interface DriverLapsGroupView {
  driverName: string;
  carNumber: string | number;
  bestLapTime: string;
  laps: DriverLapRowView[];
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
