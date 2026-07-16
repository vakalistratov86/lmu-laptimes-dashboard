/**
 * SD-2: Доменная view-model страницы SessionDetail.
 * Не содержит зависимостей на React / JSX.
 */
import type {
  SessionHeroStatItem,
  SessionResultRowView,
  SessionTabItem,
  LapProgressSeries,
  DriverSectorSummary,
  DriverLapsGroupView,
} from '@/components/session-detail/types';

/** Нормализованный тип сессии, используемый в заголовке и UX-логике. */
export type NormalizedSessionType =
  | 'race'
  | 'qualify'
  | 'superpole'
  | 'warmup'
  | 'practice';

/** Полная view-model, которую ожидает страница SessionDetail. */
export interface SessionDetailViewModel {
  /** Данные для шапки страницы. */
  header: {
    /** Ссылка «Назад» (например, /sessions или /event/:id). */
    backHref: string;
    /** Оригинальное название типа сессии из источника данных. */
    sessionType: string;
    /** Нормализованный тип для иконок / лейблов. */
    normalizedSessionType: NormalizedSessionType;
    trackName: string;
    /** Дополнительный вариант трассы (конфигурация, инвертированная и т.п.). */
    courseLabel?: string | null;
    /** Отформатированная дата и время сессии. */
    dateTimeLabel: string;
    /** Название мероприятия / чемпионата. */
    eventName?: string | null;
  };

  /** KPI-метрики в герой-блоке (победитель, fastest lap, polman…). */
  heroStats: SessionHeroStatItem[];

  /** Строки итоговой таблицы. */
  results: SessionResultRowView[];

  /** Набор вкладок с учётом доступности данных о кругах. */
  tabs: SessionTabItem[];

  /** Серии для графика «Время круга по лапам». */
  lapProgress: LapProgressSeries[];

  /** Сводка по лучшим секторам для каждого пилота. */
  sectors: DriverSectorSummary[];

  /** Круги, сгруппированные по пилотам. */
  driverLaps: DriverLapsGroupView[];

  /** Флаг: присутствуют ли данные о кругах в этой сессии. */
  hasLapData: boolean;
}
