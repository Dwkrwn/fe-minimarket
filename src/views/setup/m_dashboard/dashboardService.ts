import { apiCall } from '@/lib/api'

export type WidgetType = 'kpi' | 'bar' | 'line' | 'doughnut' | 'pie' | 'area' | 'table'
export type ColorTheme = 'blue' | 'emerald' | 'purple' | 'amber' | 'rose'

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
  kode_role?: string
  catatan?: string
  is_active?: boolean
}

export interface DashboardConfigRecord {
  id?: string
  m_role_id?: string | null
  nama_dashboard: string
  deskripsi?: string
  config: DashboardWidget[]
  is_active: boolean
}

export interface MetricMeta {
  key: string
  label: string
  category: 'Produksi' | 'Purchasing' | 'Inventory' | 'Ringkasan KPI' | 'Aktivitas'
  supportedTypes: WidgetType[]
  defaultType: WidgetType
  description: string
}

export const METRIC_CATALOG: MetricMeta[] = [
  // Ringkasan KPI
  {
    key: 'wo_total',
    label: 'Total Work Order',
    category: 'Ringkasan KPI',
    supportedTypes: ['kpi'],
    defaultType: 'kpi',
    description: 'Jumlah total SPK / Work Order yang tercatat di sistem'
  },
  {
    key: 'po_total',
    label: 'Total Purchase Order',
    category: 'Ringkasan KPI',
    supportedTypes: ['kpi'],
    defaultType: 'kpi',
    description: 'Jumlah transaksi Purchase Order'
  },
  {
    key: 'items_total',
    label: 'Total Master Item / Produk',
    category: 'Ringkasan KPI',
    supportedTypes: ['kpi'],
    defaultType: 'kpi',
    description: 'Jumlah master barang dan komponen aktif'
  },
  {
    key: 'suppliers_total',
    label: 'Total Supplier Aktif',
    category: 'Ringkasan KPI',
    supportedTypes: ['kpi'],
    defaultType: 'kpi',
    description: 'Jumlah rekanan pemasok yang terdaftar'
  },
  {
    key: 'customers_total',
    label: 'Total Customer Aktif',
    category: 'Ringkasan KPI',
    supportedTypes: ['kpi'],
    defaultType: 'kpi',
    description: 'Jumlah pelanggan aktif terdaftar'
  },
  {
    key: 'users_total',
    label: 'Total User Sistem',
    category: 'Ringkasan KPI',
    supportedTypes: ['kpi'],
    defaultType: 'kpi',
    description: 'Jumlah user terdaftar dalam sistem'
  },
  {
    key: 'pres_total',
    label: 'Total Hasil Produksi',
    category: 'Ringkasan KPI',
    supportedTypes: ['kpi'],
    defaultType: 'kpi',
    description: 'Jumlah laporan produksi (Production Result) yang masuk'
  },
  {
    key: 'treq_total',
    label: 'Total Transfer Request',
    category: 'Ringkasan KPI',
    supportedTypes: ['kpi'],
    defaultType: 'kpi',
    description: 'Total pengajuan transfer material antargudang/WO'
  },

  // Produksi
  {
    key: 'wo_status',
    label: 'Status Work Order',
    category: 'Produksi',
    supportedTypes: ['doughnut', 'pie', 'bar'],
    defaultType: 'doughnut',
    description: 'Distribusi WO berdasarkan status (Draft, Post, Approved, WIP, Done)'
  },
  {
    key: 'wo_monthly',
    label: 'Tren Work Order Bulanan',
    category: 'Produksi',
    supportedTypes: ['bar', 'line', 'area'],
    defaultType: 'bar',
    description: 'Frekuensi penerbitan WO per bulan selama 12 bulan terakhir'
  },
  {
    key: 'pres_monthly',
    label: 'Tren Hasil Produksi Bulanan',
    category: 'Produksi',
    supportedTypes: ['line', 'area', 'bar'],
    defaultType: 'line',
    description: 'Output laporan penyelesaian produksi bulanan'
  },

  // Purchasing
  {
    key: 'po_monthly',
    label: 'Tren Purchase Order Bulanan',
    category: 'Purchasing',
    supportedTypes: ['bar', 'line', 'area'],
    defaultType: 'bar',
    description: 'Volume dan transaksi order pembelian per bulan'
  },
  {
    key: 'po_status',
    label: 'Distribusi Status PO',
    category: 'Purchasing',
    supportedTypes: ['doughnut', 'pie', 'bar'],
    defaultType: 'doughnut',
    description: 'Proporsi PO berstatus Draft, In Approval, Approved, Reject'
  },
  {
    key: 'top_suppliers',
    label: 'Top Supplier by Transaksi',
    category: 'Purchasing',
    supportedTypes: ['bar', 'doughnut'],
    defaultType: 'bar',
    description: 'Pemasok dengan volume order pembelian terbanyak'
  },

  // Inventory
  {
    key: 'item_groups',
    label: 'Status Item Master',
    category: 'Inventory',
    supportedTypes: ['doughnut', 'pie', 'bar'],
    defaultType: 'doughnut',
    description: 'Distribusi status master item'
  },

  // Aktivitas / Tabel
  {
    key: 'recent_wo',
    label: 'Daftar Work Order Terbaru',
    category: 'Aktivitas',
    supportedTypes: ['table'],
    defaultType: 'table',
    description: 'Tabel 5 Work Order terkini beserta status dan pelanggannya'
  },
  {
    key: 'recent_po',
    label: 'Daftar Purchase Order Terbaru',
    category: 'Aktivitas',
    supportedTypes: ['table'],
    defaultType: 'table',
    description: 'Tabel 5 Purchase Order terkini beserta nominal dan status'
  },
  {
    key: 'recent_pres',
    label: 'Daftar Hasil Produksi Terbaru',
    category: 'Aktivitas',
    supportedTypes: ['table'],
    defaultType: 'table',
    description: 'Tabel 5 laporan Production Result terbaru'
  }
]

// Preset default widgets
export const DEFAULT_PRESET_WIDGETS: DashboardWidget[] = [
  { id: 'kpi-1', title: 'Total Work Order', type: 'kpi', metric: 'wo_total', grid_span: 3, color: 'blue' },
  { id: 'kpi-2', title: 'Total Purchase Order', type: 'kpi', metric: 'po_total', grid_span: 3, color: 'emerald' },
  { id: 'kpi-3', title: 'Total Produk Master', type: 'kpi', metric: 'items_total', grid_span: 3, color: 'amber' },
  { id: 'kpi-4', title: 'Total Hasil Produksi', type: 'kpi', metric: 'pres_total', grid_span: 3, color: 'purple' },
  { id: 'chart-1', title: 'Status Work Order', subtitle: 'Distribusi status pekerjaan produksi', type: 'doughnut', metric: 'wo_status', grid_span: 6, color: 'blue' },
  { id: 'chart-2', title: 'Tren Purchase Order Bulanan', subtitle: 'Jumlah transaksi PO per bulan', type: 'bar', metric: 'po_monthly', grid_span: 6, color: 'emerald' },
  { id: 'chart-3', title: 'Hasil Produksi Bulanan', subtitle: 'Perkembangan output produksi', type: 'line', metric: 'pres_monthly', grid_span: 6, color: 'purple' },
  { id: 'chart-4', title: 'Distribusi Status PO', subtitle: 'Perbandingan status order pembelian', type: 'bar', metric: 'po_status', grid_span: 6, color: 'amber' },
  { id: 'tbl-1', title: 'Work Order Terbaru', subtitle: '5 data WO terakhir', type: 'table', metric: 'recent_wo', grid_span: 6, color: 'blue' },
  { id: 'tbl-2', title: 'Hasil Produksi Terbaru', subtitle: '5 data produksi terakhir', type: 'table', metric: 'recent_pres', grid_span: 6, color: 'purple' },
]

export const dashboardService = {
  async fetchRoles(): Promise<RoleItem[]> {
    try {
      const res: any = await apiCall('/dynamic/m_role?order_by=nama_role&order_type=ASC')
      if (res && res.data) {
        return res.data
      }
      return []
    } catch (err) {
      console.error('Error fetching roles:', err)
      return []
    }
  },

  async fetchConfig(roleId?: string | null): Promise<DashboardConfigRecord | null> {
    try {
      const url = roleId ? `/fn/m_dashboard/getConfig?m_role_id=${roleId}` : '/fn/m_dashboard/getConfig'
      const res: any = await apiCall(url)
      if (res && res.data) {
        return res.data
      }
      return null
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
    return await apiCall('/fn/m_dashboard/saveConfig', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  },

  async fetchMetrics() {
    try {
      const res: any = await apiCall('/fn/m_dashboard/getMetrics')
      if (res && res.data) {
        return res.data
      }
      return null
    } catch (err) {
      console.error('Error fetching metrics:', err)
      return null
    }
  }
}
