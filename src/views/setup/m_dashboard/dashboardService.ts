import { apiCall, apiPath } from '@/lib/api'

export type WidgetType = 'kpi' | 'bar' | 'line' | 'doughnut' | 'pie' | 'area' | 'table'
export type ColorTheme = 'blue' | 'emerald' | 'purple' | 'amber' | 'rose'
export type RoleKey = 'ADMIN' | 'SUPER_ADMIN' | 'KASIR' | 'GUDANG'

export interface DashboardWidget {
  id: string
  title: string
  subtitle?: string
  type: WidgetType
  metric: string
  grid_span: number // 3: 1/4 col, 4: 1/3 col, 6: 1/2 col, 8: 2/3 col, 12: full
  color: ColorTheme
  is_active?: boolean
}

export interface RoleItem {
  id: string
  nama_role: string
  kode_role?: string | null
  system_key?: string | null
}

export interface DashboardConfigRecord {
  id?: string
  m_role_id?: string | null
  nama_dashboard: string
  deskripsi?: string | null
  config: DashboardWidget[]
  is_active: boolean
  createdAt?: string
  updatedAt?: string
}

export interface DashboardScope {
  role_key: string | null
  role_label: string | null
  is_manager: boolean
  timezone: string
}

export interface DailyPoint {
  period: string
  label: string
  count: number
  total: number
}

export interface CategoryPoint {
  label: string
  count: number
  total?: number
}

export interface RecentRow {
  no: string
  waktu: string
  keterangan: string
  status: string
  amount?: number
  metode_bayar?: string
  no_po?: string
}

export interface DashboardMetrics {
  generated_at: string
  scope: DashboardScope
  summary: {
    sales_today?: number
    transactions_today?: number
    avg_basket?: number
    open_shifts?: number
    po_pending?: number
    goods_receipt_today?: number
    unpaid_invoices?: number
    unpaid_amount?: number
    returns_issued?: number
    my_shift_status?: { status: string; no_shift: string | null; opened_at: string | null }
    [key: string]: unknown
  }
  charts: {
    sales_daily?: DailyPoint[]
    payment_methods?: CategoryPoint[]
    po_status?: CategoryPoint[]
    receiving_daily?: DailyPoint[]
  }
  recent: {
    orders?: RecentRow[]
    goods_receipts?: RecentRow[]
    purchase_orders?: RecentRow[]
  }
}

interface ApiEnvelope<T> {
  status: string
  data: T
  message?: string
}

export interface MetricMeta {
  key: string
  label: string
  category: 'Ringkasan KPI' | 'Penjualan & Shift' | 'Pembelian & Penerimaan' | 'Aktivitas'
  supportedTypes: WidgetType[]
  defaultType: WidgetType
  description: string
  roles: RoleKey[]
}

// Katalog metrik minimarket. `roles` dipakai FE untuk menyembunyikan widget
// yang tidak boleh dilihat peran tertentu (blind closing Kasir & Gudang).
const ADMIN: RoleKey[] = ['ADMIN', 'SUPER_ADMIN']
const GUDANG: RoleKey[] = ['ADMIN', 'SUPER_ADMIN', 'GUDANG']
const KASIR: RoleKey[] = ['ADMIN', 'SUPER_ADMIN', 'KASIR']

export const METRIC_CATALOG: MetricMeta[] = [
  // Ringkasan KPI
  {
    key: 'sales_today',
    label: 'Omzet 7 Hari',
    category: 'Ringkasan KPI',
    supportedTypes: ['kpi'],
    defaultType: 'kpi',
    description: 'Total penjualan COMPLETED 7 hari terakhir (WIB)',
    roles: ADMIN
  },
  {
    key: 'transactions_today',
    label: 'Transaksi 7 Hari',
    category: 'Ringkasan KPI',
    supportedTypes: ['kpi'],
    defaultType: 'kpi',
    description: 'Jumlah struk penjualan 7 hari terakhir',
    roles: ADMIN
  },
  {
    key: 'avg_basket',
    label: 'Rata-rata Keranjang',
    category: 'Ringkasan KPI',
    supportedTypes: ['kpi'],
    defaultType: 'kpi',
    description: 'Omzet dibagi jumlah transaksi',
    roles: ADMIN
  },
  {
    key: 'open_shifts',
    label: 'Shift OPEN',
    category: 'Ringkasan KPI',
    supportedTypes: ['kpi'],
    defaultType: 'kpi',
    description: 'Jumlah shift kasir yang masih berjalan',
    roles: ADMIN
  },
  {
    key: 'my_shift_status',
    label: 'Shift Saya',
    category: 'Ringkasan KPI',
    supportedTypes: ['kpi'],
    defaultType: 'kpi',
    description: 'Status shift OPEN milik kasir yang sedang login',
    roles: KASIR
  },
  {
    key: 'po_pending',
    label: 'PO Menunggu',
    category: 'Ringkasan KPI',
    supportedTypes: ['kpi'],
    defaultType: 'kpi',
    description: 'PO berstatus ORDERED / PARTIAL_RECEIVED',
    roles: GUDANG
  },
  {
    key: 'goods_receipt_today',
    label: 'Penerimaan 7 Hari',
    category: 'Ringkasan KPI',
    supportedTypes: ['kpi'],
    defaultType: 'kpi',
    description: 'Jumlah goods receipt aktif 7 hari terakhir',
    roles: GUDANG
  },
  {
    key: 'unpaid_invoices',
    label: 'Invoice Belum Lunas',
    category: 'Ringkasan KPI',
    supportedTypes: ['kpi'],
    defaultType: 'kpi',
    description: 'Invoice pembelian berstatus UNPAID / OVERDUE',
    roles: ADMIN
  },
  {
    key: 'unpaid_amount',
    label: 'Nilai Utang Pembelian',
    category: 'Ringkasan KPI',
    supportedTypes: ['kpi'],
    defaultType: 'kpi',
    description: 'Total net payable invoice belum lunas',
    roles: ADMIN
  },
  {
    key: 'returns_issued',
    label: 'Retur Pembelian',
    category: 'Ringkasan KPI',
    supportedTypes: ['kpi'],
    defaultType: 'kpi',
    description: 'Jumlah retur pembelian berstatus ISSUED',
    roles: GUDANG
  },

  // Penjualan & shift
  {
    key: 'sales_daily',
    label: 'Tren Penjualan Harian',
    category: 'Penjualan & Shift',
    supportedTypes: ['bar', 'line', 'area'],
    defaultType: 'bar',
    description: 'Omzet per hari 7 hari terakhir (WIB)',
    roles: ADMIN
  },
  {
    key: 'payment_methods',
    label: 'Metode Pembayaran',
    category: 'Penjualan & Shift',
    supportedTypes: ['doughnut', 'pie', 'bar'],
    defaultType: 'doughnut',
    description: 'Distribusi transaksi berdasarkan metode bayar',
    roles: ADMIN
  },

  // Pembelian & penerimaan
  {
    key: 'po_status',
    label: 'Status Purchase Order',
    category: 'Pembelian & Penerimaan',
    supportedTypes: ['doughnut', 'pie', 'bar'],
    defaultType: 'doughnut',
    description: 'Distribusi PO berdasarkan status',
    roles: GUDANG
  },
  {
    key: 'receiving_daily',
    label: 'Tren Penerimaan Barang',
    category: 'Pembelian & Penerimaan',
    supportedTypes: ['bar', 'line', 'area'],
    defaultType: 'bar',
    description: 'Jumlah goods receipt per hari 7 hari terakhir',
    roles: ADMIN
  },

  // Aktivitas
  {
    key: 'recent_orders',
    label: 'Struk Penjualan Terbaru',
    category: 'Aktivitas',
    supportedTypes: ['table'],
    defaultType: 'table',
    description: '5 transaksi terakhir (Kasir hanya melihat struk miliknya)',
    roles: KASIR
  },
  {
    key: 'recent_goods_receipts',
    label: 'Penerimaan Barang Terbaru',
    category: 'Aktivitas',
    supportedTypes: ['table'],
    defaultType: 'table',
    description: '5 goods receipt terakhir beserta supplier',
    roles: GUDANG
  },
  {
    key: 'recent_purchase_orders',
    label: 'Purchase Order Terbaru',
    category: 'Aktivitas',
    supportedTypes: ['table'],
    defaultType: 'table',
    description: '5 PO terakhir beserta supplier dan status',
    roles: GUDANG
  }
]

export const DEFAULT_PRESET_WIDGETS: DashboardWidget[] = [
  { id: 'kpi-1', title: 'Omzet 7 Hari', type: 'kpi', metric: 'sales_today', grid_span: 3, color: 'emerald' },
  { id: 'kpi-2', title: 'Transaksi 7 Hari', type: 'kpi', metric: 'transactions_today', grid_span: 3, color: 'blue' },
  { id: 'kpi-3', title: 'Rata-rata Keranjang', type: 'kpi', metric: 'avg_basket', grid_span: 3, color: 'purple' },
  { id: 'kpi-4', title: 'Shift OPEN', type: 'kpi', metric: 'open_shifts', grid_span: 3, color: 'amber' },
  { id: 'chart-1', title: 'Tren Penjualan Harian', subtitle: 'Omzet 7 hari terakhir (WIB)', type: 'bar', metric: 'sales_daily', grid_span: 6, color: 'emerald' },
  { id: 'chart-2', title: 'Metode Pembayaran', subtitle: 'Distribusi transaksi', type: 'doughnut', metric: 'payment_methods', grid_span: 6, color: 'blue' },
  { id: 'chart-3', title: 'Status Purchase Order', subtitle: 'Distribusi status order pembelian', type: 'doughnut', metric: 'po_status', grid_span: 6, color: 'amber' },
  { id: 'chart-4', title: 'Tren Penerimaan Barang', subtitle: 'Goods receipt 7 hari terakhir', type: 'bar', metric: 'receiving_daily', grid_span: 6, color: 'purple' },
  { id: 'tbl-1', title: 'Struk Penjualan Terbaru', subtitle: '5 transaksi terakhir', type: 'table', metric: 'recent_orders', grid_span: 6, color: 'blue' },
  { id: 'tbl-2', title: 'Penerimaan Barang Terbaru', subtitle: '5 goods receipt terakhir', type: 'table', metric: 'recent_goods_receipts', grid_span: 6, color: 'emerald' }
]

export const CASHIER_PRESET_WIDGETS: DashboardWidget[] = [
  { id: 'kpi-shift', title: 'Shift Saya', type: 'kpi', metric: 'my_shift_status', grid_span: 6, color: 'blue' },
  { id: 'tbl-struk', title: 'Struk Saya Terbaru', subtitle: 'Transaksi yang Anda buat', type: 'table', metric: 'recent_orders', grid_span: 12, color: 'emerald' }
]

export const WAREHOUSE_PRESET_WIDGETS: DashboardWidget[] = [
  { id: 'kpi-po', title: 'PO Menunggu', type: 'kpi', metric: 'po_pending', grid_span: 4, color: 'amber' },
  { id: 'kpi-gr', title: 'Penerimaan 7 Hari', type: 'kpi', metric: 'goods_receipt_today', grid_span: 4, color: 'emerald' },
  { id: 'kpi-ret', title: 'Retur Pembelian', type: 'kpi', metric: 'returns_issued', grid_span: 4, color: 'rose' },
  { id: 'chart-po', title: 'Status Purchase Order', subtitle: 'Distribusi status order pembelian', type: 'doughnut', metric: 'po_status', grid_span: 6, color: 'blue' },
  { id: 'tbl-gr', title: 'Penerimaan Barang Terbaru', subtitle: '5 goods receipt terakhir', type: 'table', metric: 'recent_goods_receipts', grid_span: 6, color: 'emerald' },
  { id: 'tbl-po', title: 'Purchase Order Terbaru', subtitle: '5 PO terakhir', type: 'table', metric: 'recent_purchase_orders', grid_span: 12, color: 'amber' }
]

export function presetForRole(roleKey?: string | null): DashboardWidget[] {
  if (roleKey === 'KASIR') return CASHIER_PRESET_WIDGETS
  if (roleKey === 'GUDANG') return WAREHOUSE_PRESET_WIDGETS
  return DEFAULT_PRESET_WIDGETS
}

export const dashboardService = {
  async fetchRoles(): Promise<RoleItem[]> {
    try {
      const res = await apiCall<ApiEnvelope<RoleItem[]>>(apiPath('/v1/dashboard/roles'))
      return Array.isArray(res.data) ? res.data : []
    } catch (err) {
      console.error('Error fetching roles:', err)
      return []
    }
  },

  async fetchConfig(roleId?: string | null): Promise<DashboardConfigRecord | null> {
    try {
      const query = roleId ? `?m_role_id=${encodeURIComponent(roleId)}` : ''
      const res = await apiCall<ApiEnvelope<DashboardConfigRecord | null>>(
        apiPath(`/v1/dashboard/config${query}`)
      )
      return res.data ?? null
    } catch (err) {
      console.error('Error fetching dashboard config:', err)
      return null
    }
  },

  async saveConfig(payload: {
    m_role_id?: string | null
    nama_dashboard: string
    deskripsi?: string
    config: DashboardWidget[]
    is_active?: boolean
  }) {
    return apiCall<ApiEnvelope<DashboardConfigRecord>>(apiPath('/v1/dashboard/config'), {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },

  async fetchMetrics(): Promise<DashboardMetrics | null> {
    try {
      const res = await apiCall<ApiEnvelope<DashboardMetrics>>(
        apiPath('/v1/dashboard/metrics')
      )
      return res.data ?? null
    } catch (err) {
      console.error('Error fetching metrics:', err)
      throw err
    }
  }
}
