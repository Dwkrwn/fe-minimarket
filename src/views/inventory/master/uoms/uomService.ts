import { apiCall, apiPath } from "@/lib/api";

const BASE_PATH = apiPath("/v1/inventory/uoms");

export interface Uom {
  id: string;
  kode_uom: string;
  nama_uom: string;
  satuan_dasar: string;
  satuan_beli: string;
  rasio_konversi: number;
  catatan?: string | null;
  is_active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UomPayload {
  kode_uom: string;
  nama_uom: string;
  satuan_dasar: string;
  satuan_beli: string;
  rasio_konversi: number;
  catatan?: string | null;
  is_active?: boolean;
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export async function getUoms(search?: string): Promise<Uom[]> {
  const params = new URLSearchParams();
  if (search?.trim()) params.append("search", search.trim());

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiCall<ApiResponse<Uom[]>>(`${BASE_PATH}${suffix}`, {
    method: "GET",
  });
  return res.data || [];
}

export async function getUomById(id: string): Promise<Uom> {
  try {
    const res = await apiCall<ApiResponse<Uom>>(`${BASE_PATH}/${id}`, {
      method: "GET",
    });
    if (res.data) return res.data;
  } catch {
    // fallback if GET by id endpoint not present
  }
  const all = await getUoms();
  const match = all.find((u) => u.id === id);
  if (!match) throw new Error("Data Satuan & Konversi tidak ditemukan");
  return match;
}

export async function createUom(payload: UomPayload): Promise<Uom> {
  const res = await apiCall<ApiResponse<Uom>>(BASE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateUom(id: string, payload: Partial<UomPayload>): Promise<Uom> {
  const res = await apiCall<ApiResponse<Uom>>(`${BASE_PATH}/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteUom(id: string): Promise<void> {
  await apiCall(`${BASE_PATH}/${id}`, { method: "DELETE" });
}
