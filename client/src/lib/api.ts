import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./queryClient";
import type { Track, Driver, LapTimeEnriched } from "@shared/schema";

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

export type { Track, Driver, LapTimeEnriched };
