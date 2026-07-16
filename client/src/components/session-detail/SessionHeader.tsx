/**
 * SD-5: Заголовок сессии.
 * Отображает тип сессии, название трека, курс и дату.
 */
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getSessionTypeBadgeClass } from '@/lib/classStyles';

interface SessionHeaderProps {
  trackName: string;
  sessionType: string;
  /** Нормализованный тип для стилей бейджа. */
  sessionTypeNorm: string;
  dateFormatted: string;
  courseLabel?: string | null;
  backHref: string;
}

export function SessionHeader({
  trackName,
  sessionType,
  sessionTypeNorm,
  dateFormatted,
  courseLabel,
  backHref,
}: SessionHeaderProps) {
  return (
    <div className="space-y-3">
      <Link
        href={backHref}
        data-testid="link-back"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={15} /> Все сессии
      </Link>

      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <Badge
          variant="outline"
          className={`text-xs ${getSessionTypeBadgeClass(sessionTypeNorm)}`}
        >
          {sessionType}
        </Badge>
        <h1
          className="font-display text-xl font-bold tracking-tight"
          data-testid="text-session-title"
        >
          {trackName}
          {courseLabel && (
            <span className="ml-2 text-base font-normal text-muted-foreground">
              · {courseLabel}
            </span>
          )}
        </h1>
        <span className="text-sm text-muted-foreground font-mono">{dateFormatted}</span>
      </div>
    </div>
  );
}
