<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  LayoutDashboard,
  Settings2,
  RefreshCw,
  TrendingUp,
  Users,
  Package,
  ShoppingCart,
  Boxes,
  Grid,
  BarChart3,
  LineChart,
  PieChart
} from 'lucide-vue-next'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/auth'
import DynamicChart from '@/components/dashboard/DynamicChart.vue'
import {
  dashboardService,
  DEFAULT_PRESET_WIDGETS,
  type DashboardWidget,
  type RoleItem
} from '@/views/setup/m_dashboard/dashboardService'

const router = useRouter()
const authStore = useAuthStore()

const loading = ref(true)
const refreshing = ref(false)
const roles = ref<RoleItem[]>([])
const selectedRoleId = ref<string>('all')

const dashboardTitle = ref('Dashboard')
const dashboardDesc = ref("Selamat datang kembali! Berikut ringkasan operasional terkini.")
const widgets = ref<DashboardWidget[]>([])
const metricsData = ref<any>(null)

// Current user role info
const isSuperAdmin = computed(() => authStore.isSuperAdmin)

// Separate widgets by type for structured clean layout
const kpiWidgets = computed(() => widgets.value.filter(w => w.type === 'kpi'))
const contentWidgets = computed(() => widgets.value.filter(w => w.type !== 'kpi'))

// Fetch config for selected role
async function loadDashboardConfig(roleId?: string | null) {
  try {
    const targetRoleId = roleId && roleId !== 'all' ? roleId : null
    const record = await dashboardService.fetchConfig(targetRoleId)

    if (record && Array.isArray(record.config) && record.config.length > 0) {
      dashboardTitle.value = record.nama_dashboard || 'Dashboard'
      dashboardDesc.value = record.deskripsi || 'Ringkasan operasional dan kinerja sistem'
      widgets.value = record.config
    } else {
      // Fallback to preset
      dashboardTitle.value = 'Dashboard Operasional'
      dashboardDesc.value = 'Ringkasan operasional dan kinerja sistem'
      widgets.value = [...DEFAULT_PRESET_WIDGETS]
    }
  } catch (err) {
    console.error('Error loading dashboard config:', err)
    widgets.value = [...DEFAULT_PRESET_WIDGETS]
  }
}

// Fetch live metrics
async function loadMetrics() {
  try {
    metricsData.value = await dashboardService.fetchMetrics()
  } catch (err) {
    console.error('Error loading metrics:', err)
  }
}

// Refresh all
async function refreshDashboard() {
  refreshing.value = true
  await Promise.all([
    loadDashboardConfig(selectedRoleId.value),
    loadMetrics()
  ])
  refreshing.value = false
}

// Handle role switcher change
async function onRoleChange() {
  loading.value = true
  await loadDashboardConfig(selectedRoleId.value)
  loading.value = false
}

// Chart Data Resolver
function getChartDataForMetric(metricKey: string) {
  const m = metricsData.value
  if (!m) {
    return {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'],
      data: [12, 19, 8, 15, 22, 30]
    }
  }

  switch (metricKey) {
    case 'wo_status': {
      const rows = m.charts?.wo_status || []
      return {
        labels: rows.map((r: any) => r.status),
        data: rows.map((r: any) => r.count)
      }
    }
    case 'wo_monthly': {
      const rows = m.charts?.wo_monthly || []
      return {
        labels: rows.map((r: any) => r.period),
        data: rows.map((r: any) => r.count)
      }
    }
    case 'po_monthly': {
      const rows = m.charts?.po_monthly || []
      return {
        labels: rows.map((r: any) => r.period),
        data: rows.map((r: any) => r.count)
      }
    }
    case 'po_status': {
      const rows = m.charts?.po_status || []
      return {
        labels: rows.map((r: any) => r.status),
        data: rows.map((r: any) => r.count)
      }
    }
    case 'pres_monthly': {
      const rows = m.charts?.pres_monthly || []
      return {
        labels: rows.map((r: any) => r.period),
        data: rows.map((r: any) => r.count)
      }
    }
    case 'item_groups': {
      const rows = m.charts?.item_groups || []
      return {
        labels: rows.map((r: any) => r.name),
        data: rows.map((r: any) => r.count)
      }
    }
    case 'top_suppliers': {
      const rows = m.charts?.top_suppliers || []
      return {
        labels: rows.length > 0 ? rows.map((r: any) => r.name) : ['Supplier Utama', 'Supplier Mitra'],
        data: rows.length > 0 ? rows.map((r: any) => r.count) : [10, 5]
      }
    }
    default:
      return {
        labels: ['Data 1', 'Data 2', 'Data 3', 'Data 4'],
        data: [10, 25, 18, 30]
      }
  }
}

// KPI Value Resolver
function getKpiValueForMetric(metricKey: string): { value: string | number; change?: string; icon: any } {
  const sum = metricsData.value?.summary
  if (!sum) return { value: '0', icon: Grid }

  switch (metricKey) {
    case 'wo_total':
      return { value: sum.total_wo, change: '+14% dari bln lalu', icon: Boxes }
    case 'po_total':
      return { value: sum.total_po, change: '+8% dari bln lalu', icon: ShoppingCart }
    case 'items_total':
      return { value: sum.total_items, change: 'Master Produk Aktif', icon: Package }
    case 'suppliers_total':
      return { value: sum.total_suppliers, change: 'Pemasok Terdaftar', icon: Users }
    case 'customers_total':
      return { value: sum.total_customers, change: 'Pelanggan Terdaftar', icon: Users }
    case 'users_total':
      return { value: sum.total_users, change: 'Akun Terdaftar', icon: Users }
    case 'pres_total':
      return { value: sum.total_pres, change: 'Output Produksi', icon: Boxes }
    case 'treq_total':
      return { value: sum.total_treq, change: 'Permintaan Transfer', icon: Package }
    default:
      return { value: '0', icon: Grid }
  }
}

// Table Data Resolver
function getTableDataForMetric(metricKey: string) {
  const rec = metricsData.value?.recent
  if (!rec) return []
  if (metricKey === 'recent_wo') return rec.wo || []
  if (metricKey === 'recent_po') return rec.po || []
  if (metricKey === 'recent_pres') return rec.pres || []
  return []
}

// Format numbers
function formatNumber(val: number | string) {
  if (typeof val === 'number') {
    return val.toLocaleString('id-ID')
  }
  return val
}

onMounted(async () => {
  loading.value = true
  try {
    // 1. Load roles
    roles.value = await dashboardService.fetchRoles()

    // 2. Identify user role
    const user = authStore.currentUser
    if (user && user.user_details && user.user_details.length > 0) {
      const firstRespo = user.user_details[0]?.m_respo
      const firstRole = firstRespo?.m_respo_ds?.[0]?.m_role_id
      if (firstRole) {
        selectedRoleId.value = firstRole
      }
    }

    // 3. Load config and metrics
    await Promise.all([
      loadDashboardConfig(selectedRoleId.value),
      loadMetrics()
    ])
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="flex-1 space-y-6 p-6 md:p-8 bg-background min-h-screen text-foreground transition-colors duration-200">
    <!-- Hero Header Banner (Droitdash SaaS elevated style) -->
    <div
      class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-3xl border border-border/80 bg-gradient-to-r from-card via-card to-primary/5 shadow-xs"
      v-motion
      :initial="{ opacity: 0, y: -10 }"
      :enter="{ opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } }"
    >
      <div>
        <div class="flex items-center gap-3">
          <div class="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
            <LayoutDashboard class="h-6 w-6" />
          </div>
          <div>
            <h1 class="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">{{ dashboardTitle }}</h1>
            <p class="text-xs md:text-sm text-muted-foreground mt-0.5">{{ dashboardDesc }}</p>
          </div>
        </div>
      </div>

      <!-- Controls & Switcher -->
      <div class="flex items-center gap-2 flex-wrap">
        <!-- Role Quick Switcher -->
        <div v-if="roles.length > 0" class="flex items-center gap-2 bg-background/80 border border-border/80 rounded-2xl px-3.5 py-2 shadow-xs">
          <span class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Role:</span>
          <select
            v-model="selectedRoleId"
            @change="onRoleChange"
            class="text-xs font-semibold text-foreground bg-transparent focus:outline-none cursor-pointer"
          >
            <option value="all" class="bg-card text-foreground">🌐 Default (Semua Role)</option>
            <option v-for="r in roles" :key="r.id" :value="r.id" class="bg-card text-foreground">
              {{ r.nama_role }}
            </option>
          </select>
        </div>

        <!-- Refresh Button -->
        <button
          @click="refreshDashboard"
          :disabled="refreshing"
          class="inline-flex items-center justify-center p-2.5 rounded-2xl border border-border/80 bg-background/80 text-foreground hover:bg-muted/80 transition-all shadow-xs disabled:opacity-50"
          title="Segarkan Data"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': refreshing }" />
        </button>

        <!-- Setting Dashboard Navigation Link -->
        <button
          @click="router.push('/setup/m_dashboard')"
          class="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border border-border/80 bg-background/80 hover:bg-muted/80 text-foreground text-xs font-semibold transition-all shadow-xs"
        >
          <Settings2 class="h-4 w-4 text-muted-foreground" />
          Setting Dashboard
        </button>
      </div>
    </div>

    <!-- Loading Skeleton -->
    <div v-if="loading" class="space-y-6">
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div v-for="i in 4" :key="i" class="rounded-2xl border border-border/80 bg-card p-6 shadow-xs">
          <Skeleton class="h-4 w-28 rounded-lg" />
          <Skeleton class="h-8 w-20 mt-3 rounded-lg" />
          <Skeleton class="h-3 w-32 mt-2 rounded-lg" />
        </div>
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <div class="rounded-2xl border border-border/80 bg-card p-6 shadow-xs h-80">
          <Skeleton class="h-6 w-40 mb-4 rounded-lg" />
          <Skeleton class="h-56 w-full rounded-xl" />
        </div>
        <div class="rounded-2xl border border-border/80 bg-card p-6 shadow-xs h-80">
          <Skeleton class="h-6 w-40 mb-4 rounded-lg" />
          <Skeleton class="h-56 w-full rounded-xl" />
        </div>
      </div>
    </div>

    <!-- Main Dynamic Dashboard Content -->
    <div v-else class="space-y-6">
      <!-- 1. KPI Summary Cards Grid (Droitdash clean metric cards) -->
      <div v-if="kpiWidgets.length > 0" class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="(w, idx) in kpiWidgets"
          :key="w.id || idx"
          v-motion
          :initial="{ opacity: 0, y: 15 }"
          :enter="{ opacity: 1, y: 0, transition: { delay: idx * 60 } }"
          class="rounded-2xl border border-border/80 bg-card text-card-foreground shadow-xs p-6 hover:shadow-md transition-all relative overflow-hidden group"
          :class="{
            'hover:border-blue-500/50': w.color === 'blue',
            'hover:border-emerald-500/50': w.color === 'emerald',
            'hover:border-purple-500/50': w.color === 'purple',
            'hover:border-amber-500/50': w.color === 'amber',
            'hover:border-rose-500/50': w.color === 'rose',
          }"
        >
          <!-- Top subtle ambient highlight line -->
          <div
            class="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r"
            :class="{
              'from-blue-500 to-indigo-500': w.color === 'blue',
              'from-emerald-500 to-teal-500': w.color === 'emerald',
              'from-purple-500 to-pink-500': w.color === 'purple',
              'from-amber-500 to-orange-500': w.color === 'amber',
              'from-rose-500 to-red-500': w.color === 'rose',
            }"
          ></div>

          <div class="flex items-center justify-between">
            <p class="text-xs font-bold uppercase tracking-wider text-muted-foreground">{{ w.title }}</p>
            <div
              class="w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs transition-transform group-hover:scale-110"
              :class="{
                'bg-blue-500/10 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400': w.color === 'blue',
                'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400': w.color === 'emerald',
                'bg-purple-500/10 text-purple-500 dark:bg-purple-500/20 dark:text-purple-400': w.color === 'purple',
                'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20 dark:text-amber-400': w.color === 'amber',
                'bg-rose-500/10 text-rose-500 dark:bg-rose-500/20 dark:text-rose-400': w.color === 'rose',
              }"
            >
              <component :is="getKpiValueForMetric(w.metric).icon" class="h-5 w-5" />
            </div>
          </div>
          <div class="mt-4">
            <p class="text-3xl font-extrabold tracking-tight text-foreground font-mono">
              {{ formatNumber(getKpiValueForMetric(w.metric).value) }}
            </p>
            <div class="mt-2 flex items-center justify-between">
              <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <TrendingUp class="h-3 w-3" />
                {{ getKpiValueForMetric(w.metric).change }}
              </span>
              <span class="text-[11px] text-muted-foreground">vs minggu lalu</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. Dynamic Charts & Tables Grid -->
      <div v-if="contentWidgets.length > 0" class="grid grid-cols-12 gap-5">
        <template v-for="(w, idx) in contentWidgets" :key="w.id || idx">
          <!-- Charts (Bar, Line, Doughnut, Pie, Area) -->
          <div
            v-if="['bar', 'line', 'doughnut', 'pie', 'area'].includes(w.type)"
            :class="`col-span-12 lg:col-span-${w.grid_span || 6}`"
            v-motion
            :initial="{ opacity: 0, y: 20 }"
            :enter="{ opacity: 1, y: 0, transition: { delay: 150 + idx * 50 } }"
            class="rounded-2xl border border-border/80 bg-card p-6 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
          >
            <div>
              <div class="flex items-center justify-between mb-5">
                <div>
                  <h3 class="text-base font-bold tracking-tight text-foreground">{{ w.title }}</h3>
                  <p v-if="w.subtitle" class="text-xs text-muted-foreground mt-0.5">{{ w.subtitle }}</p>
                </div>
                <div
                  class="p-2 rounded-xl border border-border/60"
                  :class="{
                    'bg-blue-500/10 text-blue-500 dark:text-blue-400': w.color === 'blue',
                    'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400': w.color === 'emerald',
                    'bg-purple-500/10 text-purple-500 dark:text-purple-400': w.color === 'purple',
                    'bg-amber-500/10 text-amber-500 dark:text-amber-400': w.color === 'amber',
                    'bg-rose-500/10 text-rose-500 dark:text-rose-400': w.color === 'rose',
                  }"
                >
                  <component
                    :is="
                      w.type === 'bar' ? BarChart3 :
                      w.type === 'line' || w.type === 'area' ? LineChart : PieChart
                    "
                    class="h-4 w-4"
                  />
                </div>
              </div>

              <!-- Render Dynamic Chart -->
              <DynamicChart
                :type="w.type as any"
                :labels="getChartDataForMetric(w.metric).labels"
                :data="getChartDataForMetric(w.metric).data"
                :color-theme="w.color"
                :height="280"
              />
            </div>
          </div>

          <!-- Table Widget (Droitdash clean orders list style) -->
          <div
            v-else-if="w.type === 'table'"
            :class="`col-span-12 lg:col-span-${w.grid_span || 6}`"
            v-motion
            :initial="{ opacity: 0, y: 20 }"
            :enter="{ opacity: 1, y: 0, transition: { delay: 150 + idx * 50 } }"
            class="rounded-2xl border border-border/80 bg-card p-6 shadow-xs hover:shadow-md transition-shadow"
          >
            <div class="flex items-center justify-between mb-5">
              <div>
                <h3 class="text-base font-bold tracking-tight text-foreground">{{ w.title }}</h3>
                <p v-if="w.subtitle" class="text-xs text-muted-foreground mt-0.5">{{ w.subtitle }}</p>
              </div>
              <span class="text-xs font-bold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                Terbaru
              </span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="border-b border-border/80 text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                    <th class="pb-3 px-2">Nomor Referensi</th>
                    <th class="pb-3 px-2">Keterangan / Relasi</th>
                    <th class="pb-3 px-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border/60 text-foreground">
                  <tr
                    v-for="(row, rIdx) in getTableDataForMetric(w.metric)"
                    :key="rIdx"
                    class="hover:bg-muted/30 transition-colors"
                  >
                    <td class="py-3.5 px-2 font-mono font-bold text-primary">{{ row.no || row.no_po || '-' }}</td>
                    <td class="py-3.5 px-2 text-muted-foreground font-medium">{{ row.customer_name || row.supplier_name || row.shift || '-' }}</td>
                    <td class="py-3.5 px-2 text-right">
                      <span
                        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                        :class="
                          row.status === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' :
                          row.status === 'DRAFT' ? 'bg-muted text-muted-foreground border border-border/80' :
                          'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        "
                      >
                        <span class="h-1.5 w-1.5 rounded-full" :class="row.status === 'APPROVED' ? 'bg-emerald-500' : row.status === 'DRAFT' ? 'bg-muted-foreground' : 'bg-amber-500'" />
                        {{ row.status || 'DRAFT' }}
                      </span>
                    </td>
                  </tr>
                  <tr v-if="getTableDataForMetric(w.metric).length === 0">
                    <td colspan="3" class="py-8 text-center text-muted-foreground">Tidak ada transaksi terkini</td>
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
