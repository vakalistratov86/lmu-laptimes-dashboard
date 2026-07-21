import { Dumbbell, Timer, Trophy } from "lucide-react";
import { formatDurationMin } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import type { SessionCategory } from "@/lib/classStyles";

const ACTIVITY_ICON: Record<SessionCategory, typeof Dumbbell> = {
  practice: Dumbbell,
  qualify: Timer,
  race: Trophy,
};

const ACTIVITY_CLASS: Record<SessionCategory, string> = {
  practice: "bg-blue-500/10 text-blue-500 dark:text-blue-400",
  qualify: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  race: "bg-red-500/10 text-red-600 dark:text-red-400",
};

interface ActivityTileProps {
  category: SessionCategory;
  label: string;
  count: number;
  minutes: number;
  locale: "ru" | "en";
}

/** Плитка активности по типу сессии — count + суммарное время. Используется на Обзоре и в Сессиях. */
export function ActivityTile({ category, label, count, minutes, locale }: ActivityTileProps) {
  const { t } = useLanguage();
  const Icon = ACTIVITY_ICON[category];
  return (
    <div className={`flex flex-col gap-2 rounded-md p-3.5 ${ACTIVITY_CLASS[category]}`}>
      <div className="flex items-center gap-1.5 text-xs font-semibold">
        <Icon size={13} />
        {label}
      </div>
      <div className="font-data text-2xl font-bold leading-none tabular-nums">{count}</div>
      <div className="font-data text-[11px] tabular-nums opacity-80">
        {formatDurationMin(minutes, locale)} {t("overview.activityTotal")}
      </div>
    </div>
  );
}
