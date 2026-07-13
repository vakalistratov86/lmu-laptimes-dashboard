import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";
import type { Track, Driver, LapTimeEnriched, SessionEnriched } from "@shared/schema";

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
  return useQuery<Driver[]>({ queryKey: ["/api/drivers"] });
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

export function useSessionLaps(sessionId: number | undefined) {
  return useQuery<LapTimeEnriched[]>({
    queryKey: ["/api/laps", "session", sessionId],
    enabled: sessionId != null && !Number.isNaN(sessionId),
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/laps?sessionId=${sessionId}`);
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

export type { Track, Driver, LapTimeEnriched, SessionEnriched };
