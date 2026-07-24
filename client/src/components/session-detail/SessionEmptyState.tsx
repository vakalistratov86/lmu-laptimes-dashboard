/**
 * SD-10: Пустое состояние — сессия не найдена.
 */
import { Link } from "wouter";
import { SearchX } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface SessionEmptyStateProps {
  backHref: string;
}

export function SessionEmptyState({ backHref }: SessionEmptyStateProps) {
  const { t } = useLanguage();
  return (
    <div className="space-y-4">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← {t("sessionDetail.back")}
      </Link>

      <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-card p-16 text-center">
        <SearchX size={40} className="text-muted-foreground/40" />
        <div className="space-y-1">
          <p className="font-semibold">{t("sessionDetail.notFound")}</p>
          <p className="text-sm text-muted-foreground max-w-xs">{t("sessionDetail.notFoundBody")}</p>
        </div>
        <Link href={backHref} className="text-sm text-primary underline-offset-4 hover:underline">
          {t("sessionDetail.notFoundBack")}
        </Link>
      </div>
    </div>
  );
}
