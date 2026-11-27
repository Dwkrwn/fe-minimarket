import { apiCall, apiPath } from "@/lib/api";

const BASE_PATH = apiPath("/v1/inventory/category-racks");

export type ZoneType = "GUDANG" | "RAK";

export interface CategoryRack {
  id: string;
  kode: string;
  nama: string;
  tipe_zona: ZoneType;
  lokasi?: string | null;
  catatan?: string | null;
  is_active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryRackPayload {
  kode: string;
  nama: string;
  tipe_zona: ZoneType;
  lokasi?: string | null;
  catatan?: string | null;
  is_active?: boolean;
}

export interface CategoryRackQuery {
  tipe_zona?: ZoneType;
  is_active?: boolean;
  search?: string;
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

export async function getCategoryRacks(query: CategoryRackQuery = {}): Promise<CategoryRack[]> {
  const params = new URLSearchParams();
  if (query.tipe_zona) params.append("tipe_zona", query.tipe_zona);
  if (query.is_active !== undefined) params.append("is_active", String(query.is_active));
  if (query.search?.trim()) params.append("search", query.search.trim());

  const suffix = params.toString() ? `?${params.toString()}` : "";
  const res = await apiCall<ApiResponse<CategoryRack[]>>(`${BASE_PATH}${suffix}`, {
    method: "GET",
  });
  return res.data || [];
}

export async function getNextCategoryRackCode(tipe_zona: ZoneType): Promise<string> {
  try {
    const res = await apiCall<ApiResponse<{ kode: string }>>(`${BASE_PATH}/next-code?tipe_zona=${tipe_zona}`, {
      method: "GET",
    });
    if (res.data?.kode) return res.data.kode;
  } catch (err) {
    console.warn("Gagal mengambil kode berikutnya dari endpoint, menggunakan kalkulasi lokal:", err);
  }

  // Fallback lokal jika endpoint belum tersedia (First Missing Gap)
  try {
    const all = await getCategoryRacks({ tipe_zona });
    const prefix = tipe_zona === "GUDANG" ? "GDG" : "RAK";
    const regex = new RegExp(`^${prefix}-(\\d+)$`, "i");
    const usedNumbers = new Set<number>();
    for (const r of all) {
      const match = r.kode ? r.kode.match(regex) : null;
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
    return tipe_zona === "GUDANG" ? "GDG-001" : "RAK-001";
  }
}

export async function getCategoryRackById(id: string): Promise<CategoryRack> {
  try {
    const res = await apiCall<ApiResponse<CategoryRack>>(`${BASE_PATH}/${id}`, {
      method: "GET",
    });
    if (res.data) return res.data;
  } catch {
    // fallback if GET by id endpoint not present
  }
  const all = await getCategoryRacks();
  const found = all.find((r) => r.id === id);
  if (!found) throw new Error("Data Kategori / Rak tidak ditemukan");
  return found;
}

export async function createCategoryRack(payload: CategoryRackPayload): Promise<CategoryRack> {
  const res = await apiCall<ApiResponse<CategoryRack>>(BASE_PATH, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateCategoryRack(
  id: string,
  payload: Partial<CategoryRackPayload>,
): Promise<CategoryRack> {
  const res = await apiCall<ApiResponse<CategoryRack>>(`${BASE_PATH}/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteCategoryRack(id: string): Promise<void> {
  await apiCall(`${BASE_PATH}/${id}`, { method: "DELETE" });
}
