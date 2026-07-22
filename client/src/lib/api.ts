import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";
import type { Track, DriverEnriched, LapTimeEnriched, SessionEnriched, DriverIncidentsResponse } from "@shared/schema";

export function useTracks() {
  return useQuery<Track[]>({ queryKey: ["/api/tracks"] });
}

export function useTrack(id: number | undefined) {
  return useQuery<Track>({
    queryKey: ["/api/tracks", id],
    enabled: id != null && !Number.isNaN(id),
  });
}

export function useDrivers() {
  return useQuery<DriverEnriched[]>({ queryKey: ["/api/drivers"] });
}

export function useDriverIncidents(id: number | undefined) {
  return useQuery<DriverIncidentsResponse>({
    queryKey: ["/api/drivers", id, "incidents"],
    enabled: id != null && !Number.isNaN(id),
  });
}

export function useLaps(filter?: {
  trackId?: number;
  driverId?: number;
  carClass?: string;
  conditions?: string;
}) {
  const params = new URLSearchParams();
  if (filter?.trackId) params.set("trackId", String(filter.trackId));
  if (filter?.driverId) params.set("driverId", String(filter.driverId));
  if (filter?.carClass) params.set("carClass", filter.carClass);
  if (filter?.conditions) params.set("conditions", filter.conditions);
  const qs = params.toString();
  return useQuery<LapTimeEnriched[]>({
    queryKey: ["/api/laps", qs],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/laps${qs ? `?${qs}` : ""}`);
      return res.json();
    },
  });
}

/**
 * #121: личный лучший круг каждого пилота на каждой трассе в каждом классе —
 * бесконечно не растёт с числом кругов (в отличие от useLaps() без фильтра).
 * Используется там, где раньше грузился весь /api/laps ради кросс-пилотного
 * сравнения: Leaderboards, Overview, Tracks, сравнение с рекордом трассы
 * в профиле пилота.
 */
export function useBestLaps(filter?: {
  trackId?: number;
  driverId?: number;
  carClass?: string;
}) {
  const params = new URLSearchParams();
  if (filter?.trackId) params.set("trackId", String(filter.trackId));
  if (filter?.driverId) params.set("driverId", String(filter.driverId));
  if (filter?.carClass) params.set("carClass", filter.carClass);
  const qs = params.toString();
  return useQuery<LapTimeEnriched[]>({
    queryKey: ["/api/laps/best", qs],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/laps/best${qs ? `?${qs}` : ""}`);
      return res.json();
    },
  });
}

export function useSessions() {
  return useQuery<SessionEnriched[]>({ queryKey: ["/api/sessions"] });
}

/**
 * Возвращает детальные данные по кругам сессии из таблицы session_laps.
 * Используется вкладками «Круги», «Секторы» и «Прогресс» на странице SessionDetail.
 * Ранее хук обращался к /api/laps?sessionId=X (таблица lap_times), что давало
 * пустой массив для сессий импортированных из XML, т.к. валидные круги там
 * сохраняются только в session_laps.
 */
export function useSessionLaps(sessionId: number | undefined) {
  return useQuery<any[]>({
    queryKey: ["/api/sessions", sessionId, "laps"],
    enabled: sessionId != null && !Number.isNaN(sessionId),
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sessions/${sessionId}/laps`);
      return res.json();
    },
  });
}

export function useSession(id: number | undefined) {
  return useQuery<SessionEnriched>({
    queryKey: ["/api/sessions", id],
    enabled: id != null && !Number.isNaN(id),
  });
}

export type ImportFileResult = {
  fileName: string;
  ok: boolean;
  message: string;
  sessionId?: number;
  event?: string;
  venue?: string;
  laps?: number;
  drivers?: number;
};

export type ImportResponse = {
  imported: number;
  skipped: number;
  totalLaps: number;
  results: ImportFileResult[];
};

export type { Track, DriverEnriched as Driver, LapTimeEnriched, SessionEnriched };
