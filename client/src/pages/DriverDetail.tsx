import { useRoute, Link } from "wouter";
import { ChevronLeft } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { DriverProfile } from "@/components/DriverProfile";

export default function DriverDetail() {
  const { t } = useLanguage();
  const [, params] = useRoute("/drivers/:id");
  const id = params ? Number(params.id) : undefined;

  return (
    <div className="space-y-5">
      <Link
        href="/leaderboards"
        data-testid="link-back-leaderboards"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft size={16} /> {t("driverDetail.back")}
      </Link>

      <DriverProfile driverId={id} />
    </div>
  );
}
