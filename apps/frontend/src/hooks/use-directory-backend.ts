import { useQuery } from "@tanstack/react-query";
import { fetchBackendParsed } from "../shared/api-client";
import { formatBackendRequestError } from "../shared/api-error";

export type MuassasahOption = {
  id: string;
  name: string;
  isActive: boolean;
  driverCount: number;
  vehicleCount: number;
};

export type DriverOption = {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  isProblematic: boolean;
  isActive: boolean;
  muassasahId: string | null;
  muassasahName: string | null;
};

export type VehicleOption = {
  id: string;
  plateNumber: string;
  note: string | null;
  isProblematic: boolean;
  isActive: boolean;
  muassasahId: string | null;
  muassasahName: string | null;
};

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function mapMuassasah(record: Record<string, unknown>): MuassasahOption | null {
  const id = readString(record.id);
  const name = readString(record.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    isActive: record.isActive !== false,
    driverCount: typeof record.driverCount === "number" ? record.driverCount : 0,
    vehicleCount: typeof record.vehicleCount === "number" ? record.vehicleCount : 0,
  };
}

function mapDriver(record: Record<string, unknown>): DriverOption | null {
  const id = readString(record.id);
  const name = readString(record.name);
  if (!id || !name) return null;
  return {
    id,
    name,
    phone: typeof record.phone === "string" ? record.phone : null,
    note: typeof record.note === "string" ? record.note : null,
    isProblematic: record.isProblematic === true,
    isActive: record.isActive !== false,
    muassasahId: typeof record.muassasahId === "string" ? record.muassasahId : null,
    muassasahName: typeof record.muassasahName === "string" ? record.muassasahName : null,
  };
}

function mapVehicle(record: Record<string, unknown>): VehicleOption | null {
  const id = readString(record.id);
  const plateNumber = readString(record.plateNumber);
  if (!id || !plateNumber) return null;
  return {
    id,
    plateNumber,
    note: typeof record.note === "string" ? record.note : null,
    isProblematic: record.isProblematic === true,
    isActive: record.isActive !== false,
    muassasahId: typeof record.muassasahId === "string" ? record.muassasahId : null,
    muassasahName: typeof record.muassasahName === "string" ? record.muassasahName : null,
  };
}

// ----- Muassasah -----

export async function fetchMuassasah(): Promise<MuassasahOption[]> {
  const { response, payload } = await fetchBackendParsed("/directory/muassasah", { cache: "no-store" });
  if (!response.ok || !Array.isArray(payload)) throw new Error(`Muassasah fetch failed (${response.status}).`);
  return payload.map((item) => mapMuassasah(item as Record<string, unknown>)).filter((x): x is MuassasahOption => x !== null);
}

export async function createMuassasah(name: string): Promise<void> {
  const result = await fetchBackendParsed("/directory/muassasah", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name.trim() }),
  });
  if (!result.response.ok)
    throw new Error(formatBackendRequestError(result.response.status, result.payload, result.responseText, "Muassasah save failed"));
}

export async function updateMuassasah(id: string, patch: { name?: string; isActive?: boolean }): Promise<void> {
  const result = await fetchBackendParsed(`/directory/muassasah/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!result.response.ok)
    throw new Error(formatBackendRequestError(result.response.status, result.payload, result.responseText, "Muassasah update failed"));
}

export async function deleteMuassasah(id: string): Promise<void> {
  const result = await fetchBackendParsed(`/directory/muassasah/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!result.response.ok)
    throw new Error(formatBackendRequestError(result.response.status, result.payload, result.responseText, "Muassasah delete failed"));
}

// ----- Drivers -----

export async function fetchDrivers(muassasahId?: string): Promise<DriverOption[]> {
  const path = muassasahId ? `/directory/drivers?muassasahId=${encodeURIComponent(muassasahId)}` : "/directory/drivers";
  const { response, payload } = await fetchBackendParsed(path, { cache: "no-store" });
  if (!response.ok || !Array.isArray(payload)) throw new Error(`Driver fetch failed (${response.status}).`);
  return payload.map((item) => mapDriver(item as Record<string, unknown>)).filter((x): x is DriverOption => x !== null);
}

export async function createDriver(payload: {
  name: string;
  phone?: string;
  note?: string;
  isProblematic?: boolean;
  muassasahId?: string;
}): Promise<void> {
  const result = await fetchBackendParsed("/directory/drivers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: payload.name.trim(),
      phone: payload.phone?.trim() || undefined,
      note: payload.note?.trim() || undefined,
      isProblematic: payload.isProblematic ?? false,
      muassasahId: payload.muassasahId || undefined,
    }),
  });
  if (!result.response.ok)
    throw new Error(formatBackendRequestError(result.response.status, result.payload, result.responseText, "Driver save failed"));
}

export async function updateDriver(
  id: string,
  patch: { name?: string; phone?: string; note?: string; isProblematic?: boolean; muassasahId?: string | null; isActive?: boolean },
): Promise<void> {
  const result = await fetchBackendParsed(`/directory/drivers/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!result.response.ok)
    throw new Error(formatBackendRequestError(result.response.status, result.payload, result.responseText, "Driver update failed"));
}

export async function deleteDriver(id: string): Promise<void> {
  const result = await fetchBackendParsed(`/directory/drivers/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!result.response.ok)
    throw new Error(formatBackendRequestError(result.response.status, result.payload, result.responseText, "Driver delete failed"));
}

// ----- Vehicles -----

export async function fetchVehicles(muassasahId?: string): Promise<VehicleOption[]> {
  const path = muassasahId ? `/directory/vehicles?muassasahId=${encodeURIComponent(muassasahId)}` : "/directory/vehicles";
  const { response, payload } = await fetchBackendParsed(path, { cache: "no-store" });
  if (!response.ok || !Array.isArray(payload)) throw new Error(`Vehicle fetch failed (${response.status}).`);
  return payload.map((item) => mapVehicle(item as Record<string, unknown>)).filter((x): x is VehicleOption => x !== null);
}

export async function createVehicle(payload: {
  plateNumber: string;
  note?: string;
  isProblematic?: boolean;
  muassasahId?: string;
}): Promise<void> {
  const result = await fetchBackendParsed("/directory/vehicles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      plateNumber: payload.plateNumber.trim(),
      note: payload.note?.trim() || undefined,
      isProblematic: payload.isProblematic ?? false,
      muassasahId: payload.muassasahId || undefined,
    }),
  });
  if (!result.response.ok)
    throw new Error(formatBackendRequestError(result.response.status, result.payload, result.responseText, "Vehicle save failed"));
}

export async function updateVehicle(
  id: string,
  patch: { plateNumber?: string; note?: string; isProblematic?: boolean; muassasahId?: string | null; isActive?: boolean },
): Promise<void> {
  const result = await fetchBackendParsed(`/directory/vehicles/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!result.response.ok)
    throw new Error(formatBackendRequestError(result.response.status, result.payload, result.responseText, "Vehicle update failed"));
}

export async function deleteVehicle(id: string): Promise<void> {
  const result = await fetchBackendParsed(`/directory/vehicles/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!result.response.ok)
    throw new Error(formatBackendRequestError(result.response.status, result.payload, result.responseText, "Vehicle delete failed"));
}

export function useMuassasahQuery() {
  return useQuery({ queryKey: ["directory", "muassasah"], queryFn: fetchMuassasah, staleTime: 60_000 });
}

export function useDriversQuery(muassasahId?: string) {
  return useQuery({
    queryKey: ["directory", "drivers", muassasahId ?? "all"],
    queryFn: () => fetchDrivers(muassasahId),
    staleTime: 60_000,
  });
}

export function useVehiclesQuery(muassasahId?: string) {
  return useQuery({
    queryKey: ["directory", "vehicles", muassasahId ?? "all"],
    queryFn: () => fetchVehicles(muassasahId),
    staleTime: 60_000,
  });
}
