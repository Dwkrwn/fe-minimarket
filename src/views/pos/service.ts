import { apiCall, apiPath } from "@/lib/api";
import type {
  ActiveShiftOrders,
  ApiResponse,
  CloseShiftPayload,
  CloseShiftResult,
  CheckoutPayload,
  DailySalesReport,
  InventoryItem,
  OpenShiftPayload,
  PosOrder,
  PosShift,
  RakStockRow,
  ShiftReport,
} from "./types";

const POS_ENDPOINT = (path: string) => `${apiPath("/v1/pos")}${path}`;
const INVENTORY_ENDPOINT = (path: string) => `${apiPath("/v1/inventory")}${path}`;

const LAST_CLOSED_SHIFT_KEY = "pos_last_closed_shift_id";

// -----------------------------------------------------------------------------
// 2.1 Buka Shift & shift aktif
// -----------------------------------------------------------------------------
export async function getActiveShift(): Promise<PosShift | null> {
  const res = await apiCall<ApiResponse<PosShift | null>>(
    POS_ENDPOINT("/shifts/active"),
    { method: "GET" },
  );
  return res.data ?? null;
}

export async function openShift(payload: OpenShiftPayload): Promise<PosShift> {
  const res = await apiCall<ApiResponse<PosShift>>(POS_ENDPOINT("/shifts/open"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

// Riwayat transaksi shift aktif milik kasir yang sedang login.
// Tidak mengirim shift_id dari client: scope ditentukan server dari user.
export interface ActiveShiftOrdersOptions {
  limit?: number;
  cursor?: string | null;
}

export async function getActiveShiftOrders(
  options: ActiveShiftOrdersOptions = {},
): Promise<ActiveShiftOrders> {
  const params = new URLSearchParams();
  params.set("limit", String(options.limit ?? 20));
  if (options.cursor) params.set("cursor", options.cursor);

  const res = await apiCall<ApiResponse<ActiveShiftOrders>>(
    `${POS_ENDPOINT("/shifts/active/orders")}?${params.toString()}`,
    { method: "GET" },
  );
  return res.data;
}

// -----------------------------------------------------------------------------
// 1.1 Mesin Kasir / checkout
// -----------------------------------------------------------------------------
export async function checkout(payload: CheckoutPayload): Promise<PosOrder> {
  const res = await apiCall<ApiResponse<PosOrder>>(POS_ENDPOINT("/checkout"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

// -----------------------------------------------------------------------------
// 2.2 Tutup Shift
// -----------------------------------------------------------------------------
export async function closeShift(
  shiftId: string,
  payload: CloseShiftPayload,
): Promise<CloseShiftResult> {
  const res = await apiCall<ApiResponse<CloseShiftResult>>(
    POS_ENDPOINT(`/shifts/${shiftId}/close`),
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  saveLastClosedShiftId(res.data?.id ?? shiftId);
  return res.data;
}

// -----------------------------------------------------------------------------
// 3.1 Laporan shift terkini
// -----------------------------------------------------------------------------
export async function getShiftReport(shiftId: string): Promise<ShiftReport> {
  const res = await apiCall<ApiResponse<ShiftReport>>(
    POS_ENDPOINT(`/shifts/${shiftId}/report`),
    { method: "GET" },
  );
  return res.data;
}

export function saveLastClosedShiftId(shiftId: string): void {
  try {
    sessionStorage.setItem(LAST_CLOSED_SHIFT_KEY, shiftId);
  } catch {
    /* storage bisa diblokir; laporan masih bisa dibuka lewat ?shift= */
  }
}

export function getLastClosedShiftId(): string | null {
  try {
    return sessionStorage.getItem(LAST_CLOSED_SHIFT_KEY);
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// 3.2 Rekap penjualan harian toko
// -----------------------------------------------------------------------------
export interface DailySalesOptions {
  days_window?: number;
  trigger_auto_pr?: boolean;
}

export async function getDailySales(
  options: DailySalesOptions = {},
): Promise<DailySalesReport> {
  const params = new URLSearchParams();
  params.set("days_window", String(options.days_window ?? 1));
  params.set("trigger_auto_pr", options.trigger_auto_pr ? "true" : "false");

  const res = await apiCall<ApiResponse<DailySalesReport>>(
    `${POS_ENDPOINT("/reports/daily-sales")}?${params.toString()}`,
    { method: "GET" },
  );
  return res.data;
}

// -----------------------------------------------------------------------------
// Katalog produk untuk kasir (sumber: modul Inventory, lokasi RAK)
// -----------------------------------------------------------------------------
export async function getRakCatalog(search = ""): Promise<RakStockRow[]> {
  const params = new URLSearchParams({ location: "RAK" });
  if (search.trim()) params.set("search", search.trim());

  const res = await apiCall<ApiResponse<RakStockRow[]>>(
    `${INVENTORY_ENDPOINT("/stocks")}?${params.toString()}`,
    { method: "GET" },
  );
  return res.data || [];
}

/**
 * Cari barang hasil scan. Utama lewat posisi stok RAK; bila barang belum punya
 * slot rak, fallback ke master item agar pesan "stok rak 0" tetap informatif.
 */
export async function findRakItemByBarcode(
  barcode: string,
): Promise<RakStockRow | null> {
  const keyword = barcode.trim();
  if (!keyword) return null;

  const rows = await getRakCatalog(keyword);
  const exact = rows.find(
    (row) =>
      String(row.item?.barcode || "").toLowerCase() === keyword.toLowerCase(),
  );
  if (exact) return exact;

  try {
    const res = await apiCall<ApiResponse<InventoryItem>>(
      `${INVENTORY_ENDPOINT("/items/barcode")}/${encodeURIComponent(keyword)}`,
      { method: "GET" },
    );
    const item = res.data;
    if (!item) return null;

    const rak = (item.stocks || []).find((stock) => stock.location === "RAK");
    return {
      id: rak?.id ?? `fallback-${item.id}`,
      item_id: item.id,
      location: "RAK",
      qty: rak?.qty ?? 0,
      item,
    };
  } catch {
    return null;
  }
}
