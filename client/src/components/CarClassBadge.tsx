import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getClassBadgeClass, getClassDisplayLabel } from "@/lib/classStyles";

interface CarClassBadgeProps {
  /** Сырое значение car_class из БД (или уже каноническая метка) — normalizeCarClass внутри classStyles.ts решает и цвет, и подпись. */
  carClass?: string | null;
  className?: string;
}

/**
 * Единая плашка класса машины: один источник правды (classStyles.ts) для
 * цвета и подписи, вместо того чтобы каждая страница отдельно склеивала
 * getClassBadgeClass()/getClassDisplayLabel() с <Badge>. Используется в
 * Sessions, Tracks, TrackDetail, Overview, Leaderboards, DriverProfile,
 * SessionResultsTable, SessionDriverDetailCard.
 */
export function CarClassBadge({ carClass, className }: CarClassBadgeProps) {
  return (
    <Badge variant="outline" className={cn(getClassBadgeClass(carClass), className)}>
      {getClassDisplayLabel(carClass)}
    </Badge>
  );
}
