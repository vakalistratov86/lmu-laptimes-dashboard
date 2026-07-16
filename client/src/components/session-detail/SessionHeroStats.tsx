/**
 * SD-6: KPI-блок статистики сессии.
 * Отображает массив метрик SessionHeroStatItem в виде карточек.
 */
import type { SessionHeroStatItem } from './types';

interface SessionHeroStatsProps {
  stats: SessionHeroStatItem[];
  /** Дополнительная метаинформация: событие, пилоты, круги, версия. */
  meta?: {
    event?: string | null;
    driverCount?: number | null;
    lapCount?: number | null;
    gameVersion?: string | null;
  };
}

export function SessionHeroStats({ stats, meta }: SessionHeroStatsProps) {
  return (
    <div className="space-y-3">
      {/* KPI-карточки */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-lg border border-border bg-card px-4 py-3 space-y-0.5"
            >
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className="font-semibold text-sm truncate">{s.value}</p>
              {s.subLabel && (
                <p className="text-xs text-muted-foreground truncate">{s.subLabel}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Мета-строка */}
      {meta && (
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          {meta.event && <span>{meta.event}</span>}
          {meta.driverCount != null && <span>Пилотов: {meta.driverCount}</span>}
          {meta.lapCount != null && <span>Кругов: {meta.lapCount}</span>}
          {meta.gameVersion && <span>Версия: {meta.gameVersion}</span>}
        </div>
      )}
    </div>
  );
}
