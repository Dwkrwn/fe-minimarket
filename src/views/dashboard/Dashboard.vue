<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Settings2,
  RefreshCw,
  Users,
  Package,
  ShoppingCart,
  Boxes,
  Grid,
  BarChart3,
  LineChart,
  PieChart,
} from 'lucide-vue-next'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth'
import DynamicChart from '@/components/dashboard/DynamicChart.vue'
import {
  dashboardService,
  DEFAULT_PRESET_WIDGETS,
  type DashboardWidget,
  type RoleItem,
} from '@/views/setup/m_dashboard/dashboardService'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const refreshing = ref(false)
const roles = ref<RoleItem[]>([])
const selectedRoleId = ref<string>('all')

const dashboardTitle = ref('Dasbor')
const dashboardDesc = ref('Ringkasan kegiatan toko hari ini.')
const widgets = ref<DashboardWidget[]>([])
const metricsData = ref<any>(null)

const kpiWidgets = computed(() => widgets.value.filter(w => w.type === 'kpi'))
const contentWidgets = computed(() => widgets.value.filter(w => w.type !== 'kpi'))

async function loadDashboardConfig(roleId?: string | null) {
  try {
    const targetRoleId = roleId && roleId !== 'all' ? roleId : null
    const record = authStore.user?.capabilities?.dashboard ? await dashboardService.fetchConfig(targetRoleId) : null

    if (record && Array.isArray(record.config) && record.config.length > 0) {
      dashboardTitle.value = record.nama_dashboard || 'Dasbor'
      dashboardDesc.value = record.deskripsi || 'Ringkasan kegiatan toko.'
      widgets.value = record.config
    } else {
      dashboardTitle.value = 'Dasbor Toko'
      dashboardDesc.value = 'Ringkasan kegiatan toko dan persediaan.'
      widgets.value = [...DEFAULT_PRESET_WIDGETS]
    }
  } catch (err) {
    console.error('Gagal memuat pengaturan dasbor:', err)
    widgets.value = [...DEFAULT_PRESET_WIDGETS]
  }
}

async function loadMetrics() {
  if (!authStore.user?.capabilities?.dashboard) return
  try {
    metricsData.value = await dashboardService.fetchMetrics()
  } catch (err) {
    console.error('Gagal memuat data dasbor:', err)
  }
}

async function refreshDashboard() {
  refreshing.value = true
  await Promise.all([
    loadDashboardConfig(selectedRoleId.value),
    loadMetrics(),
  ])
  refreshing.value = false
}

async function onRoleChange() {
  loading.value = true
  await loadDashboardConfig(selectedRoleId.value)
  loading.value = false
}

function getChartDataForMetric(metricKey: string) {
  const m = metricsData.value
  if (!m) {
    return {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'],
      data: [12, 19, 8, 15, 22, 30],
    }
  }

  switch (metricKey) {
    case 'wo_status': {
      const rows = m.charts?.wo_status || []
      return {
        labels: rows.map((r: any) => r.status),
        data: rows.map((r: any) => r.count),
      }
    }
    case 'wo_monthly': {
      const rows = m.charts?.wo_monthly || []
      return {
        labels: rows.map((r: any) => r.period),
        data: rows.map((r: any) => r.count),
      }
    }
    case 'po_monthly': {
      const rows = m.charts?.po_monthly || []
      return {
        labels: rows.map((r: any) => r.period),
        data: rows.map((r: any) => r.count),
      }
    }
    case 'po_status': {
      const rows = m.charts?.po_status || []
      return {
        labels: rows.map((r: any) => r.status),
        data: rows.map((r: any) => r.count),
      }
    }
    case 'pres_monthly': {
      const rows = m.charts?.pres_monthly || []
      return {
        labels: rows.map((r: any) => r.period),
        data: rows.map((r: any) => r.count),
      }
    }
    case 'item_groups': {
      const rows = m.charts?.item_groups || []
      return {
        labels: rows.map((r: any) => r.name),
        data: rows.map((r: any) => r.count),
      }
    }
    case 'top_suppliers': {
      const rows = m.charts?.top_suppliers || []
      return {
        labels: rows.length > 0 ? rows.map((r: any) => r.name) : ['Supplier Utama', 'Supplier Mitra'],
        data: rows.length > 0 ? rows.map((r: any) => r.count) : [10, 5],
      }
    }
    default:
      return {
        labels: ['Data 1', 'Data 2', 'Data 3', 'Data 4'],
        data: [10, 25, 18, 30],
      }
  }
}

function getKpiValueForMetric(metricKey: string): { value: string | number; note?: string; icon: any } {
  const sum = metricsData.value?.summary
  if (!sum) return { value: '0', icon: Grid }

  switch (metricKey) {
    case 'wo_total':
      return { value: sum.total_wo, note: 'Pekerjaan produksi', icon: Boxes }
    case 'po_total':
      return { value: sum.total_po, note: 'Pesanan pembelian', icon: ShoppingCart }
    case 'items_total':
      return { value: sum.total_items, note: 'Produk aktif', icon: Package }
    case 'suppliers_total':
      return { value: sum.total_suppliers, note: 'Pemasok terdaftar', icon: Users }
    case 'customers_total':
      return { value: sum.total_customers, note: 'Pelanggan terdaftar', icon: Users }
    case 'users_total':
      return { value: sum.total_users, note: 'Akun pengguna', icon: Users }
    case 'pres_total':
      return { value: sum.total_pres, note: 'Hasil produksi', icon: Boxes }
    case 'treq_total':
      return { value: sum.total_treq, note: 'Permintaan transfer', icon: Package }
    default:
      return { value: '0', icon: Grid }
  }
}

function getTableDataForMetric(metricKey: string) {
  const rec = metricsData.value?.recent
  if (!rec) return []
  if (metricKey === 'recent_wo') return rec.wo || []
  if (metricKey === 'recent_po') return rec.po || []
  if (metricKey === 'recent_pres') return rec.pres || []
  return []
}

const STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Disetujui',
  DRAFT: 'Draf',
  PENDING: 'Menunggu',
  PROCESS: 'Diproses',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
  COMPLETED: 'Selesai',
  DONE: 'Selesai',
  PAID: 'Lunas',
  UNPAID: 'Belum dibayar',
  RECEIVED: 'Diterima',
}

function statusLabel(status?: string) {
  const key = String(status || '').toUpperCase()
  return STATUS_LABELS[key] || (status ? status : 'Draf')
}

function statusClass(status?: string) {
  const key = String(status || '').toUpperCase()
  if (['APPROVED', 'COMPLETED', 'DONE', 'PAID', 'RECEIVED'].includes(key)) {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
  }
  if (['REJECTED', 'CANCELLED'].includes(key)) {
    return 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300'
  }
  if (['DRAFT', 'PENDING'].includes(key)) {
    return 'bg-muted text-muted-foreground'
  }
  return 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
}

function formatNumber(val: number | string) {
  if (typeof val === 'number') {
    return val.toLocaleString('id-ID')
  }
  return val
}

// Kelas kolom statis agar terbaca oleh Tailwind
const SPAN_CLASSES: Record<number, string> = {
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  9: 'lg:col-span-9',
  12: 'lg:col-span-12',
}

function spanClass(span?: number) {
  return SPAN_CLASSES[Number(span) || 6] || 'lg:col-span-6'
}

onMounted(async () => {
  loading.value = true
  try {
    roles.value = authStore.isManager ? await dashboardService.fetchRoles().catch(() => []) : []

    const user = authStore.currentUser
    if (user?.role) selectedRoleId.value = user.role.id
    if (user && user.user_details && user.user_details.length > 0) {
      const firstRespo = user.user_details[0]?.m_respo
      const firstRole = firstRespo?.m_respo_ds?.[0]?.m_role_id
      if (firstRole) {
        selectedRoleId.value = firstRole
      }
    }

    await Promise.all([
      loadDashboardConfig(selectedRoleId.value),
      loadMetrics(),
    ])
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen flex-1 space-y-6 bg-background p-4 text-foreground md:p-6 lg:p-8">
    <!-- Judul halaman -->
    <div class="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">{{ dashboardTitle }}</h1>
        <p class="mt-1 max-w-2xl text-sm text-muted-foreground">{{ dashboardDesc }}</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <label
          v-if="roles.length > 0"
          class="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
        >
          <span class="text-muted-foreground">Tampilan</span>
          <select
            v-model="selectedRoleId"
            class="cursor-pointer bg-transparent font-medium text-foreground focus:outline-none"
            @change="onRoleChange"
          >
            <option value="all">Semua peran</option>
            <option v-for="r in roles" :key="r.id" :value="r.id">
              {{ r.nama_role }}
            </option>
          </select>
        </label>

        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          :disabled="refreshing"
          @click="refreshDashboard"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': refreshing }" />
          <span class="hidden sm:inline">{{ refreshing ? 'Memuat...' : 'Muat ulang' }}</span>
        </button>

        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          @click="router.push('/setup/m_dashboard')"
        >
          <Settings2 class="h-4 w-4 text-muted-foreground" />
          <span class="hidden sm:inline">Atur dasbor</span>
        </button>
      </div>
    </div>

    <!-- Memuat data -->
    <div v-if="loading" class="space-y-5">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="i in 4" :key="i" class="rounded-xl border border-border bg-card p-5">
          <Skeleton class="h-4 w-28 rounded" />
          <Skeleton class="mt-3 h-8 w-20 rounded" />
          <Skeleton class="mt-3 h-3 w-32 rounded" />
        </div>
      </div>
      <div class="grid gap-4 lg:grid-cols-2">
        <div class="h-80 rounded-xl border border-border bg-card p-5">
          <Skeleton class="mb-4 h-5 w-40 rounded" />
          <Skeleton class="h-56 w-full rounded-lg" />
        </div>
        <div class="h-80 rounded-xl border border-border bg-card p-5">
          <Skeleton class="mb-4 h-5 w-40 rounded" />
          <Skeleton class="h-56 w-full rounded-lg" />
        </div>
      </div>
    </div>

    <!-- Isi dasbor -->
    <div v-else class="space-y-5">
      <!-- Ringkasan angka -->
      <div v-if="kpiWidgets.length > 0" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="(w, idx) in kpiWidgets"
          :key="w.id || idx"
          class="rounded-xl border border-border bg-card p-5"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm text-muted-foreground">{{ w.title }}</p>
              <p class="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {{ formatNumber(getKpiValueForMetric(w.metric).value) }}
              </p>
            </div>
            <div class="rounded-lg bg-primary/10 p-2.5 text-primary">
              <component :is="getKpiValueForMetric(w.metric).icon" class="h-5 w-5" />
            </div>
          </div>
          <p v-if="getKpiValueForMetric(w.metric).note" class="mt-3 text-xs text-muted-foreground">
            {{ getKpiValueForMetric(w.metric).note }}
          </p>
        </div>
      </div>

      <!-- Grafik dan tabel -->
      <div v-if="contentWidgets.length > 0" class="grid grid-cols-12 gap-4">
        <template v-for="(w, idx) in contentWidgets" :key="w.id || idx">
          <!-- Grafik -->
          <div
            v-if="['bar', 'line', 'doughnut', 'pie', 'area'].includes(w.type)"
            :class="spanClass(w.grid_span)"
            class="col-span-12 flex flex-col justify-between rounded-xl border border-border bg-card p-5"
          >
            <div>
              <div class="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 class="text-base font-semibold text-foreground">{{ w.title }}</h2>
                  <p v-if="w.subtitle" class="mt-0.5 text-sm text-muted-foreground">{{ w.subtitle }}</p>
                </div>
                <div class="rounded-lg bg-muted p-2 text-muted-foreground">
                  <component
                    :is="
                      w.type === 'bar' ? BarChart3 :
                      w.type === 'line' || w.type === 'area' ? LineChart : PieChart
                    "
                    class="h-4 w-4"
                  />
                </div>
              </div>

              <DynamicChart
                :type="w.type as any"
                :labels="getChartDataForMetric(w.metric).labels"
                :data="getChartDataForMetric(w.metric).data"
                :color-theme="w.color"
                :height="280"
              />
            </div>
          </div>

          <!-- Tabel -->
          <div
            v-else-if="w.type === 'table'"
            :class="spanClass(w.grid_span)"
            class="col-span-12 rounded-xl border border-border bg-card p-5"
          >
            <div class="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 class="text-base font-semibold text-foreground">{{ w.title }}</h2>
                <p v-if="w.subtitle" class="mt-0.5 text-sm text-muted-foreground">{{ w.subtitle }}</p>
              </div>
              <span class="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                Terbaru
              </span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-border text-xs font-medium text-muted-foreground">
                    <th class="px-2 pb-3">Nomor</th>
                    <th class="px-2 pb-3">Keterangan</th>
                    <th class="px-2 pb-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <tr
                    v-for="(row, rIdx) in getTableDataForMetric(w.metric)"
                    :key="rIdx"
                    class="hover:bg-muted/40"
                  >
                    <td class="px-2 py-3 font-mono font-medium text-primary">{{ row.no || row.no_po || '-' }}</td>
                    <td class="px-2 py-3 text-muted-foreground">{{ row.customer_name || row.supplier_name || row.shift || '-' }}</td>
                    <td class="px-2 py-3 text-right">
                      <span
                        class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                        :class="statusClass(row.status)"
                      >
                        {{ statusLabel(row.status) }}
                      </span>
                    </td>
                  </tr>
                  <tr v-if="getTableDataForMetric(w.metric).length === 0">
                    <td colspan="3" class="py-8 text-center text-sm text-muted-foreground">
                      Tidak ada transaksi terkini
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
