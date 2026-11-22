import { apiCall, apiPath } from '@/lib/api'

export interface StockAlertUom {
  id?: string
  kode_uom?: string
  nama_uom?: string
  satuan_dasar?: string
}

/** Field ringkas sesuai kontrak GET /v1/notifications/stock-alerts. */
export interface StockAlertNotification {
  id: string
  notification_type: 'stock'
  alert_type: 'LOW_STOCK' | 'EXPIRED'
  item_id: string
  kode_item: string | null
  nama_item: string
  uom: StockAlertUom | null
  stok: number
  batas: number
  rop_pcs: number
  safety_stock: number
  max_stock: number
  suggested_qty: number
  lokasi: string
  no_batch: string | null
  expired_date: string | null
  hari_menuju_expired: number | null
  tingkat: 'kritis' | 'warning' | string
}

export interface StockAlertsMeta {
  days: number
  expired_supported: boolean
  expired_reason?: string
}

export interface StockAlertsSnapshot {
  items: StockAlertNotification[]
  meta: StockAlertsMeta | null
  generatedAt: string | null
  counts: { min_stock: number; expired: number; total: number }
}

interface StockAlertsEnvelope {
  status: string
  data: {
    min_stock: any[]
    expired: any[]
  }
  counts?: StockAlertsSnapshot['counts']
  meta?: StockAlertsMeta
  generated_at?: string
}

const STOCK_ROLE_KEYS = ['ADMIN', 'SUPER_ADMIN', 'GUDANG']
const CACHE_TTL_MS = 10_000

let cache: { expiresAt: number; snapshot: StockAlertsSnapshot } | null = null
let inFlight: Promise<StockAlertsSnapshot> | null = null

function getSystemKey(): string | null {
  try {
    const authData = localStorage.getItem('auth_bb')
    if (!authData) return null
    const parsed = JSON.parse(authData)
    return parsed?.user?.role?.system_key || null
  } catch {
    return null
  }
}

/** Gate sisi klien; backend tetap menjadi otoritas lewat requireRoles. */
export function canViewStockAlerts(): boolean {
  return STOCK_ROLE_KEYS.includes(getSystemKey() || '')
}

function normalizeLowStock(row: any): StockAlertNotification {
  return {
    id: String(row.id || `min-stock:${row.item_id}`),
    notification_type: 'stock',
    alert_type: 'LOW_STOCK',
    item_id: String(row.item_id || ''),
    kode_item: row.kode_item || row.barcode || null,
    nama_item: row.nama_item || row.nama_barang || '-',
    uom: row.uom || null,
    stok: Number(row.stok ?? 0),
    batas: Number(row.batas ?? 0),
    rop_pcs: Number(row.rop_pcs ?? 0),
    safety_stock: Number(row.safety_stock ?? 0),
    max_stock: Number(row.max_stock ?? 0),
    suggested_qty: Number(row.suggested_qty ?? 0),
    lokasi: row.lokasi || 'SEMUA',
    no_batch: row.no_batch ?? null,
    expired_date: row.expired_date ?? null,
    hari_menuju_expired: row.hari_menuju_expired ?? null,
    tingkat: row.tingkat || 'warning',
  }
}

function normalizeExpired(row: any, index: number): StockAlertNotification {
  return {
    id: String(row.id || `expired:${row.no_batch || row.item_id || index}`),
    notification_type: 'stock',
    alert_type: 'EXPIRED',
    item_id: String(row.item_id || ''),
    kode_item: row.kode_item || row.no_batch || null,
    nama_item: row.nama_item || row.nama_barang || '-',
    uom: row.uom || null,
    stok: Number(row.stok ?? 0),
    batas: 0,
    rop_pcs: 0,
    safety_stock: 0,
    max_stock: 0,
    suggested_qty: 0,
    lokasi: row.lokasi || 'SEMUA',
    no_batch: row.no_batch ?? null,
    expired_date: row.expired_date ?? null,
    hari_menuju_expired: row.hari_menuju_expired ?? null,
    tingkat: row.tingkat || 'expired',
  }
}

const EMPTY_SNAPSHOT: StockAlertsSnapshot = {
  items: [],
  meta: null,
  generatedAt: null,
  counts: { min_stock: 0, expired: 0, total: 0 },
}

export async function getStockAlerts(
  forceRefresh = false,
): Promise<StockAlertsSnapshot> {
  if (!canViewStockAlerts()) return EMPTY_SNAPSHOT

  const now = Date.now()
  if (!forceRefresh && cache && cache.expiresAt > now) return cache.snapshot
  if (!forceRefresh && inFlight) return inFlight

  const request = (async () => {
    const response = await apiCall<StockAlertsEnvelope>(
      apiPath('/v1/notifications/stock-alerts'),
      { method: 'GET' },
    )

    const minStock = (response.data?.min_stock || []).map(normalizeLowStock)
    const expired = (response.data?.expired || []).map(normalizeExpired)
    const snapshot: StockAlertsSnapshot = {
      items: [...minStock, ...expired],
      meta: response.meta || null,
      generatedAt: response.generated_at || null,
      counts: response.counts || {
        min_stock: minStock.length,
        expired: expired.length,
        total: minStock.length + expired.length,
      },
    }

    cache = { expiresAt: Date.now() + CACHE_TTL_MS, snapshot }
    return snapshot
  })()

  inFlight = request
  try {
    return await request
  } finally {
    if (inFlight === request) inFlight = null
  }
}

export function clearStockAlertsCache() {
  cache = null
  inFlight = null
}
