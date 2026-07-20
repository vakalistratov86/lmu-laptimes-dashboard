import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";
import type { Track, DriverEnriched, LapTimeEnriched, SessionEnriched, TelemetrySession } from "@shared/schema";

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

// ── Телеметрия ────────────────────────────────────────────────────

export function useTelemetrySessions() {
  return useQuery<TelemetrySession[]>({ queryKey: ["/api/telemetry/sessions"] });
}

export type TelemetryChannelInfo = {
  id: number;
  name: string;
  kind: string;
  frequencyHz: number | null;
  unit: string | null;
  sampleCount: number;
};

export type TelemetrySessionDetail = {
  session: TelemetrySession;
  channels: TelemetryChannelInfo[];
};

export function useTelemetrySession(id: number | undefined) {
  return useQuery<TelemetrySessionDetail>({
    queryKey: ["/api/telemetry/sessions", id],
    enabled: id != null && !Number.isNaN(id),
  });
}

export type TelemetryLap = {
  lapNumber: number;
  startTs: number;
  endTs: number;
  durationSec: number;
};

export function useTelemetryLaps(id: number | undefined) {
  return useQuery<TelemetryLap[]>({
    queryKey: ["/api/telemetry/sessions", id, "laps"],
    enabled: id != null && !Number.isNaN(id),
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/telemetry/sessions/${id}/laps`);
      return res.json();
    },
  });
}

export type TelemetryLapPoint = {
  seq: number;
  t: number;
  lapDist: number | null;
  lat: number | null;
  lon: number | null;
  throttle: number | null;
  brake: number | null;
  speedKph: number | null;
};

export type TelemetryLapSeries = {
  lapNumber: number;
  startTs: number;
  endTs: number;
  points: TelemetryLapPoint[];
};

export function useTelemetryLapSeries(id: number | undefined, lapNumber: number | undefined) {
  return useQuery<TelemetryLapSeries>({
    queryKey: ["/api/telemetry/sessions", id, "laps", lapNumber, "series"],
    enabled: id != null && !Number.isNaN(id) && lapNumber != null && !Number.isNaN(lapNumber),
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/telemetry/sessions/${id}/laps/${lapNumber}/series`);
      return res.json();
    },
  });
}

export type { Track, DriverEnriched as Driver, LapTimeEnriched, SessionEnriched };
