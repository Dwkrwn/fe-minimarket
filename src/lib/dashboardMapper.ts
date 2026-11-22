/**
 * Pemetaan data GET /v1/dashboard/metrics ke widget UI.
 * Dipakai bersama oleh halaman Dashboard dan Atur dashboard (pratinjau),
 * supaya angka, grafik, dan tabel tidak punya dua sumber kebenaran.
 */
import {
  METRIC_CATALOG,
  type DailyPoint,
  type CategoryPoint,
  type DashboardMetrics,
  type DashboardScope,
  type DashboardWidget,
  type RecentRow,
} from '@/views/setup/m_dashboard/dashboardService'

export interface ChartData {
  labels: string[]
  data: number[]
}

export interface KpiData {
  value: string | number
  note?: string
  isMoney?: boolean
}

const MONEY_METRICS = new Set(['sales_today', 'avg_basket', 'unpaid_amount'])

const COUNT_LABELS: Record<string, string> = {
  transactions_today: 'Struk 7 hari terakhir',
  open_shifts: 'Shift kasir berjalan',
  po_pending: 'Menunggu penerimaan',
  goods_receipts_today: 'Goods receipt aktif',
  goods_receipt_today: 'Goods receipt aktif',
  unpaid_invoices: 'Perlu ditindaklanjuti',
  returns_issued: 'Retur diterbitkan',
}

export function formatNumber(val: number | string | null | undefined): string {
  const num = typeof val === 'number' ? val : Number(val || 0)
  return num.toLocaleString('id-ID')
}

export function formatRupiah(val: number | string | null | undefined): string {
  return `Rp ${formatNumber(val)}`
}

export function formatKpi(data: KpiData): string {
  return typeof data.value === 'number' && data.isMoney
    ? formatRupiah(data.value)
    : typeof data.value === 'number'
      ? formatNumber(data.value)
      : String(data.value)
}

export function getKpiValue(
  metrics: DashboardMetrics | null,
  metricKey: string
): KpiData {
  const sum = metrics?.summary
  const readNumber = (key: string) => {
    const raw = sum?.[key]
    return typeof raw === 'number' ? raw : 0
  }

  switch (metricKey) {
    case 'my_shift_status': {
      const shift = sum?.my_shift_status
      const status = shift?.status || 'NONE'
      const value = status === 'OPEN' ? 'Berjalan' : status === 'NONE' ? 'Belum dibuka' : status
      return {
        value,
        note: shift?.no_shift ? `Shift ${shift.no_shift}` : 'Buka shift di halaman kasir',
      }
    }
    case 'sales_today':
      return { value: readNumber('sales_today'), note: '7 hari terakhir', isMoney: true }
    case 'avg_basket':
    case 'unpaid_amount':
      return { value: readNumber(metricKey), note: '7 hari terakhir', isMoney: MONEY_METRICS.has(metricKey) }
    case 'transactions_today':
    case 'open_shifts':
    case 'po_pending':
    case 'goods_receipt_today':
    case 'unpaid_invoices':
    case 'returns_issued':
      return { value: readNumber(metricKey), note: COUNT_LABELS[metricKey] }
    default:
      return { value: 0 }
  }
}

function categoryData(points: CategoryPoint[] | undefined): ChartData {
  const rows = points || []
  return {
    labels: rows.map((row) => row.label),
    data: rows.map((row) => Number(row.count || 0)),
  }
}

function dailyData(points: DailyPoint[] | undefined, useAmount = false): ChartData {
  const rows = points || []
  return {
    labels: rows.map((row) => row.label),
    data: rows.map((row) => Number(useAmount ? row.total || 0 : row.count || 0)),
  }
}

export function getChartData(
  metrics: DashboardMetrics | null,
  metricKey: string
): ChartData {
  const charts = metrics?.charts
  switch (metricKey) {
    case 'sales_daily':
      return dailyData(charts?.sales_daily, true)
    case 'receiving_daily':
      return dailyData(charts?.receiving_daily)
    case 'payment_methods':
      return categoryData(charts?.payment_methods)
    case 'po_status':
      return categoryData(charts?.po_status)
    default:
      return { labels: [], data: [] }
  }
}

export function getTableRows(
  metrics: DashboardMetrics | null,
  metricKey: string
): RecentRow[] {
  const recent = metrics?.recent
  switch (metricKey) {
    case 'recent_orders':
      return recent?.orders || []
    case 'recent_goods_receipts':
      return recent?.goods_receipts || []
    case 'recent_purchase_orders':
      return recent?.purchase_orders || []
    default:
      return []
  }
}

/** Widget yang tidak boleh dilihat role ini disembunyikan sebelum dirender. */
export function scopeAllowsMetric(
  metricKey: string,
  scope: DashboardScope | undefined
): boolean {
  if (!scope) return true
  if (scope.is_manager) return true
  const meta = METRIC_CATALOG.find((item) => item.key === metricKey)
  if (!meta) return true
  return meta.roles.includes(scope.role_key as never)
}

export function visibleWidgets(
  widgets: DashboardWidget[],
  scope: DashboardScope | undefined
): DashboardWidget[] {
  return widgets.filter(
    (widget) => widget.is_active !== false && scopeAllowsMetric(widget.metric, scope)
  )
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Berjalan',
  CLOSED: 'Ditutup',
  NONE: 'Belum dibuka',
  COMPLETED: 'Selesai',
  VOID: 'Dibatalkan',
  ORDERED: 'Dipesan',
  PARTIAL_RECEIVED: 'Sebagian diterima',
  RECEIVED: 'Diterima',
  VERIFIED: 'Diverifikasi',
  ISSUED: 'Diterbitkan',
  UNPAID: 'Belum lunas',
  OVERDUE: 'Jatuh tempo',
  PAID: 'Lunas',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
}

export function statusLabel(status?: string | null): string {
  const key = String(status || '').toUpperCase()
  return STATUS_LABELS[key] || (status ? status : '-')
}

export function statusClass(status?: string | null): string {
  const key = String(status || '').toUpperCase()
  if (['COMPLETED', 'RECEIVED', 'VERIFIED', 'PAID', 'APPROVED', 'CLOSED'].includes(key)) {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
  }
  if (['VOID', 'REJECTED', 'CANCELLED', 'OVERDUE'].includes(key)) {
    return 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300'
  }
  if (['OPEN', 'UNPAID', 'ISSUED'].includes(key)) {
    return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
  }
  return 'bg-muted text-muted-foreground'
}

// Kelas statis agar terbaca oleh Tailwind (tidak dipakai template string dinamis).
const SPAN_CLASSES: Record<number, string> = {
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  8: 'lg:col-span-8',
  9: 'lg:col-span-9',
  12: 'lg:col-span-12',
}

export function spanClass(span?: number): string {
  return SPAN_CLASSES[Number(span) || 6] || 'lg:col-span-6'
}

export function formatWaktu(iso?: string | null): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
