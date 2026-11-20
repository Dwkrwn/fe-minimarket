// =============================================================================
// POS (TRANSAKSI) - TIPE KONTRAK FE
// Mengikuti bentuk respons nyata server/modules/pos/pos.service.js
// =============================================================================

export type PaymentMethod = "TUNAI" | "QRIS" | "EDC" | "TRANSFER";

export type ShiftStatus = "OPEN" | "CLOSED";

export interface PosShiftUser {
  id: string;
  name: string;
  username?: string;
}

export interface PosShift {
  id: string;
  no_shift: string;
  user_id: string;
  modal_awal: number | string;
  /** Hanya dikirim untuk manager (blind closing). */
  total_tunai?: number | string;
  /** Hanya dikirim untuk manager (blind closing). */
  total_non_tunai?: number | string;
  uang_fisik_laci?: number | string | null;
  modal_akhir?: number | string | null;
  selisih?: number | string | null;
  status: ShiftStatus;
  catatan?: string | null;
  opened_at: string;
  closed_at?: string | null;
  orders?: PosOrder[];
  user?: PosShiftUser;
}

export interface PosOrderDetail {
  id: string;
  order_id?: string;
  item_id: string;
  qty_pcs: number;
  harga_satuan: number | string;
  diskon: number | string;
  subtotal: number | string;
  item?: InventoryItem;
}

export interface PosOrder {
  id: string;
  no_struk: string;
  shift_id: string;
  user_id: string;
  total_amount: number | string;
  bayar: number | string;
  kembalian: number | string;
  metode_bayar: PaymentMethod;
  status: string;
  catatan?: string | null;
  createdAt: string;
  details: PosOrderDetail[];
}

/**
 * Satu transaksi pada riwayat shift aktif. Bentuknya sengaja sama dengan
 * PosOrder agar bisa langsung dicetak ulang tanpa mapping tambahan.
 */
export interface PosHistoryOrder extends PosOrder {
  item_count: number;
}

/**
 * GET /v1/pos/shifts/active/orders — sengaja TANPA agregat kas (blind closing).
 */
export interface ActiveShiftOrders {
  no_shift: string | null;
  orders: PosHistoryOrder[];
  has_more: boolean;
  next_cursor: string | null;
}

export type RekonsiliasiStatus = "SEIMBANG" | "LEBIH_KAS" | "KURANG_KAS";

export interface CloseShiftResult extends PosShift {
  ekspektasi_kas_laci: number;
  status_rekonsiliasi: RekonsiliasiStatus;
}

export interface ShiftReport {
  shift_id: string;
  no_shift: string;
  kasir: string;
  status: ShiftStatus;
  opened_at: string;
  closed_at: string | null;
  total_transaksi: number;
  modal_awal: number;
  total_omzet: number;
  omzet_per_metode: Record<PaymentMethod, number>;
  rekonsiliasi_kas: {
    modal_awal: number;
    penjualan_tunai: number;
    ekspektasi_kas_laci: number;
    uang_fisik_laci: number | null;
    selisih_kas: number | null;
  };
}

export interface DailySalesStockEvaluation {
  item_id: string;
  barcode: string;
  nama_barang: string;
  penjualan_periode_pcs: number;
  kecepatan_jual_harian: number;
  total_stok_toko_pcs: number;
  batas_rop_pcs: number;
  status_stok: "PERLU_RESTOCK" | "AMAN";
  auto_pr: Record<string, unknown> | null;
}

export interface DailySalesReport {
  rekap_penjualan_toko: {
    periode_hari: number;
    total_omzet: number;
    total_transaksi: number;
  };
  evaluasi_stok_rop: DailySalesStockEvaluation[];
  antrean_auto_pr_baru: Array<Record<string, unknown>>;
}

// -----------------------------------------------------------------------------
// Inventory (sumber data produk untuk mesin kasir)
// -----------------------------------------------------------------------------

export interface InventoryUom {
  id: string;
  kode_uom: string;
  nama_uom: string;
}

export interface InventoryCategoryRack {
  id: string;
  kode: string;
  nama: string;
  tipe_zona: "GUDANG" | "RAK";
}

export interface InventoryStock {
  id: string;
  item_id: string;
  location: "GUDANG" | "RAK";
  qty: number;
}

export interface InventoryItem {
  id: string;
  barcode: string;
  nama_barang: string;
  harga_jual: number | string;
  is_active: boolean;
  uom?: InventoryUom | null;
  category_rack?: InventoryCategoryRack | null;
  stocks?: InventoryStock[];
}

/** Baris GET /v1/inventory/stocks?location=RAK */
export interface RakStockRow {
  id: string;
  item_id: string;
  location: "RAK";
  qty: number;
  category_rack_id?: string | null;
  item: InventoryItem;
  category_rack?: InventoryCategoryRack | null;
}

// -----------------------------------------------------------------------------
// Payload & pembantu tampilan
// -----------------------------------------------------------------------------

export interface CheckoutItemPayload {
  item_id: string;
  qty_pcs: number;
  diskon?: number;
}

export interface CheckoutPayload {
  shift_id: string;
  items: CheckoutItemPayload[];
  bayar: number;
  metode_bayar: PaymentMethod;
  catatan?: string;
}

export interface OpenShiftPayload {
  modal_awal: number;
  catatan?: string;
}

export interface CloseShiftPayload {
  uang_fisik_laci: number;
  catatan?: string;
}

export interface CartItem {
  item_id: string;
  barcode: string;
  nama_barang: string;
  harga_jual: number;
  qty_pcs: number;
  diskon: number;
  stok_rak: number;
  satuan: string;
}

export interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}
