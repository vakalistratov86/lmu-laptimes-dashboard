/**
 * SD-10: Пустое состояние — сессия не найдена.
 */
import { Link } from 'wouter';
import { SearchX } from 'lucide-react';

interface SessionEmptyStateProps {
  backHref: string;
}

export function SessionEmptyState({ backHref }: SessionEmptyStateProps) {
  return (
    <div className="space-y-4">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Все сессии
      </Link>

      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-16 text-center">
        <SearchX size={40} className="text-muted-foreground/40" />
        <div className="space-y-1">
          <p className="font-semibold">Сессия не найдена</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Возможно, сессия была удалена или указан неверный идентификатор.
          </p>
        </div>
        <Link
          href={backHref}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Вернуться к списку сессий
        </Link>
      </div>
    </div>
  );
}
