<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Component } from 'vue'
import { useRouter } from 'vue-router'
import {
  Settings2,
  RefreshCw,
  AlertTriangle,
  Clock3,
  ShoppingCart,
  ReceiptText,
  Wallet,
  Package,
  Boxes,
  Users,
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
  presetForRole,
  type DashboardMetrics,
  type DashboardScope,
  type DashboardWidget,
  type RoleItem,
} from '@/views/setup/m_dashboard/dashboardService'
import {
  formatKpi,
  formatNumber,
  formatWaktu,
  getChartData,
  getKpiValue,
  getTableRows,
  spanClass,
  statusClass,
  statusLabel,
  visibleWidgets,
} from '@/lib/dashboardMapper'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const refreshing = ref(false)
const loadError = ref('')
const roles = ref<RoleItem[]>([])
const selectedRoleId = ref<string>('all')

const dashboardTitle = ref('Dashboard Toko')
const dashboardDesc = ref('Ringkasan penjualan, pembelian, dan aktivitas toko.')
const configuredWidgets = ref<DashboardWidget[]>([])
const metricsData = ref<DashboardMetrics | null>(null)

const defaultScope = computed<DashboardScope>(() => ({
  role_key: authStore.user?.role?.system_key || null,
  role_label: authStore.user?.role?.nama_role || null,
  is_manager: authStore.isManager,
  timezone: 'Asia/Jakarta',
}))
const scope = computed<DashboardScope>(() => metricsData.value?.scope || defaultScope.value)
const roleKey = computed(() => scope.value.role_key || '')
const isManager = computed(() => scope.value.is_manager)

// Konfigurasi diambil per role login. Hanya Admin/Super Admin yang boleh
// berpindah role untuk melihat konfigurasi peran lain.
const configRoleId = computed(() =>
  isManager.value
    ? selectedRoleId.value === 'all'
      ? null
      : selectedRoleId.value
    : authStore.user?.role?.id || null
)

const widgets = computed(() => visibleWidgets(configuredWidgets.value, scope.value))
const kpiWidgets = computed(() => widgets.value.filter((w) => w.type === 'kpi'))
const contentWidgets = computed(() => widgets.value.filter((w) => w.type !== 'kpi'))

const ICON_BY_METRIC: Record<string, Component> = {
  sales_today: Wallet,
  avg_basket: ShoppingCart,
  unpaid_amount: Wallet,
  transactions_today: ReceiptText,
  open_shifts: Clock3,
  my_shift_status: Clock3,
  po_pending: Package,
  goods_receipt_today: Boxes,
  unpaid_invoices: Wallet,
  returns_issued: Package,
}

function iconForMetric(metric: string): Component {
  return ICON_BY_METRIC[metric] || Grid
}

function tableHasAmount(metric: string): boolean {
  if (roleKey.value === 'KASIR') return false
  return getTableRows(metricsData.value, metric).some(
    (row) => typeof row.amount === 'number'
  )
}

async function loadMetrics() {
  try {
    metricsData.value = await dashboardService.fetchMetrics()
    loadError.value = ''
  } catch (err) {
    metricsData.value = null
    loadError.value = err instanceof Error ? err.message : 'Gagal memuat data dashboard'
  }
}

async function loadDashboardConfig() {
  const selectedRole = roles.value.find((r) => r.id === selectedRoleId.value)
  const key =
    isManager.value && selectedRoleId.value !== 'all' && selectedRole?.system_key
      ? selectedRole.system_key
      : roleKey.value
  dashboardTitle.value =
    key === 'KASIR' ? 'Dashboard Kasir' : key === 'GUDANG' ? 'Dashboard Gudang' : 'Dashboard Toko'
  dashboardDesc.value =
    key === 'KASIR'
      ? 'Informasi shift dan struk yang Anda buat.'
      : key === 'GUDANG'
        ? 'Ringkasan pembelian dan penerimaan barang.'
        : 'Ringkasan penjualan, pembelian, dan aktivitas toko.'
  configuredWidgets.value = [...presetForRole(key)]

  try {
    const record = await dashboardService.fetchConfig(configRoleId.value)
    if (record && record.is_active !== false && Array.isArray(record.config) && record.config.length > 0) {
      dashboardTitle.value = record.nama_dashboard || dashboardTitle.value
      dashboardDesc.value = record.deskripsi || dashboardDesc.value
      configuredWidgets.value = record.config
    }
  } catch (err) {
    console.error('Gagal memuat pengaturan dashboard:', err)
  }
}

async function refreshDashboard() {
  refreshing.value = true
  await Promise.all([loadMetrics(), loadDashboardConfig()])
  refreshing.value = false
}

async function onRoleChange() {
  loading.value = true
  await loadDashboardConfig()
  loading.value = false
}

onMounted(async () => {
  loading.value = true
  try {
    // Metrik dimuat lebih dulu agar title/preset mengikuti scope dari backend.
    await loadMetrics()
    if (authStore.isManager) {
      roles.value = await dashboardService.fetchRoles().catch(() => [])
      if (authStore.user?.role?.id) selectedRoleId.value = authStore.user.role.id
    }
    await loadDashboardConfig()
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
          v-if="isManager && roles.length > 0"
          class="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm"
        >
          <span class="text-muted-foreground">Tampilan</span>
          <select
            v-model="selectedRoleId"
            class="cursor-pointer bg-transparent font-medium text-foreground focus:outline-none"
            @change="onRoleChange"
          >
            <option value="all">Konfigurasi global</option>
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
          v-if="isManager"
          type="button"
          class="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          @click="router.push('/setup/m_dashboard')"
        >
          <Settings2 class="h-4 w-4 text-muted-foreground" />
          <span class="hidden sm:inline">Atur dashboard</span>
        </button>
      </div>
    </div>

    <!-- Gagal memuat data metrik -->
    <div
      v-if="loadError"
      class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <div class="flex items-center gap-2">
        <AlertTriangle class="h-4 w-4 shrink-0" />
        <span>Data dashboard tidak dapat dimuat: {{ loadError }}</span>
      </div>
      <button type="button" class="font-semibold underline" @click="refreshDashboard">Coba lagi</button>
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
        <div v-for="i in 2" :key="i" class="h-80 rounded-xl border border-border bg-card p-5">
          <Skeleton class="mb-4 h-5 w-40 rounded" />
          <Skeleton class="h-56 w-full rounded-lg" />
        </div>
      </div>
    </div>

    <!-- Isi dashboard -->
    <div v-else class="space-y-5">
      <div
        v-if="widgets.length === 0"
        class="rounded-xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground"
      >
        Belum ada widget yang dapat ditampilkan untuk peran ini.
      </div>

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
                {{ formatKpi(getKpiValue(metricsData, w.metric)) }}
              </p>
            </div>
            <div class="rounded-lg bg-primary/10 p-2.5 text-primary">
              <component :is="iconForMetric(w.metric)" class="h-5 w-5" />
            </div>
          </div>
          <p v-if="getKpiValue(metricsData, w.metric).note" class="mt-3 text-xs text-muted-foreground">
            {{ getKpiValue(metricsData, w.metric).note }}
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
                v-if="getChartData(metricsData, w.metric).labels.length > 0"
                :type="w.type as any"
                :labels="getChartData(metricsData, w.metric).labels"
                :data="getChartData(metricsData, w.metric).data"
                :color-theme="w.color"
                :height="280"
              />
              <div v-else class="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                Belum ada data untuk grafik ini.
              </div>
            </div>
          </div>

          <!-- Tabel aktivitas -->
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
                    <th class="px-2 pb-3">Nomor / Waktu</th>
                    <th class="px-2 pb-3">Keterangan</th>
                    <th v-if="tableHasAmount(w.metric)" class="px-2 pb-3 text-right">Nominal</th>
                    <th class="px-2 pb-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  <tr
                    v-for="(row, rIdx) in getTableRows(metricsData, w.metric)"
                    :key="rIdx"
                    class="hover:bg-muted/40"
                  >
                    <td class="px-2 py-3">
                      <div class="font-mono font-medium text-primary">{{ row.no || row.no_po || '-' }}</div>
                      <div class="text-xs text-muted-foreground">{{ formatWaktu(row.waktu) }}</div>
                    </td>
                    <td class="px-2 py-3 text-muted-foreground">{{ row.keterangan || '-' }}</td>
                    <td v-if="tableHasAmount(w.metric)" class="px-2 py-3 text-right font-medium">
                      {{ formatNumber(row.amount || 0) }}
                    </td>
                    <td class="px-2 py-3 text-right">
                      <span
                        class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                        :class="statusClass(row.status)"
                      >
                        {{ statusLabel(row.status) }}
                      </span>
                    </td>
                  </tr>
                  <tr v-if="getTableRows(metricsData, w.metric).length === 0">
                    <td :colspan="tableHasAmount(w.metric) ? 4 : 3" class="py-8 text-center text-sm text-muted-foreground">
                      Tidak ada aktivitas terkini.
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
