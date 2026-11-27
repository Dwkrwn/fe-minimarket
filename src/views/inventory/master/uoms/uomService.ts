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

export async function getNextUomCode(satuan_beli: string): Promise<string> {
  const clean = satuan_beli.trim();
  if (!clean) return "UOM-001";

  try {
    const res = await apiCall<ApiResponse<{ kode: string }>>(`${BASE_PATH}/next-code?satuan_beli=${encodeURIComponent(clean)}`, {
      method: "GET",
    });
    if (res.data?.kode) return res.data.kode;
  } catch (err) {
    console.warn("Gagal mengambil kode UOM berikutnya dari endpoint, menggunakan kalkulasi lokal:", err);
  }

  try {
    const all = await getUoms(clean);
    const prefix = clean.toUpperCase().replace(/[^A-Z0-9]/g, "") || "UOM";
    const regex = new RegExp(`^${prefix}-(\\d+)$`, "i");
    const usedNumbers = new Set<number>();
    for (const u of all) {
      const match = u.kode_uom ? u.kode_uom.match(regex) : null;
      if (match && match[1]) {
        usedNumbers.add(parseInt(match[1], 10));
      }
    }
    let nextNum = 1;
    while (usedNumbers.has(nextNum)) {
      nextNum++;
    }
    return `${prefix}-${String(nextNum).padStart(3, "0")}`;
  } catch {
    const prefix = clean.toUpperCase().replace(/[^A-Z0-9]/g, "") || "UOM";
    return `${prefix}-001`;
  }
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
