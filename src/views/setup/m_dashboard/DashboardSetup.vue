<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import {
  LayoutDashboard,
  Plus,
  Save,
  RotateCcw,
  Eye,
  Settings2,
  Trash2,
  ArrowUp,
  ArrowDown,
  Edit,
  BarChart3,
  LineChart,
  PieChart,
  Grid,
  CheckCircle2,
  Boxes,
  Table as TableIcon,
  Sparkles,
  Layers,
  Maximize2
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import DynamicChart from '@/components/dashboard/DynamicChart.vue'
import {
  dashboardService,
  METRIC_CATALOG,
  DEFAULT_PRESET_WIDGETS,
  type DashboardMetrics,
  type DashboardScope,
  type DashboardWidget,
  type RoleItem,
  type WidgetType,
  type ColorTheme,
  type MetricMeta
} from './dashboardService'
import {
  formatKpi,
  formatWaktu,
  getChartData,
  getKpiValue,
  getTableRows,
  spanClass,
  statusClass,
  statusLabel,
  visibleWidgets
} from '@/lib/dashboardMapper'

const authStore = useAuthStore()
const canEdit = computed(() => authStore.isManager)

// State
const loadingRoles = ref(true)
const loadingConfig = ref(false)
const saving = ref(false)
const roles = ref<RoleItem[]>([])
const selectedRoleId = ref<string>('all') // 'all' or specific role UUID

const dashboardName = ref('Dashboard Default')
const dashboardDesc = ref('Konfigurasi tata letak dashboard dan grafik')
const dashboardActive = ref(true)
const widgets = ref<DashboardWidget[]>([...DEFAULT_PRESET_WIDGETS])

const activeTab = ref<'editor' | 'preview'>('editor')

// Metrics live data
const metricsData = ref<DashboardMetrics | null>(null)
const loadingMetrics = ref(false)

// Modal Widget Builder State
const isModalOpen = ref(false)
const editingWidgetIndex = ref<number | null>(null)

const formWidget = ref<DashboardWidget>({
  id: '',
  title: '',
  subtitle: '',
  type: 'bar',
  metric: 'sales_daily',
  grid_span: 6,
  color: 'blue',
  is_active: true
})

// Current selected role object
const currentRole = computed(() => {
  if (selectedRoleId.value === 'all') return null
  return roles.value.find(r => r.id === selectedRoleId.value) || null
})

// Pratinjau mengikuti role yang dipilih, sehingga widget penjualan tidak
// tampil untuk Kasir/Gudang (backend juga tidak mengirim datanya).
const previewScope = computed<DashboardScope>(() => {
  if (selectedRoleId.value === 'all') {
    return {
      role_key: canEdit.value ? null : authStore.user?.role?.system_key || null,
      role_label: canEdit.value ? null : authStore.user?.role?.nama_role || null,
      is_manager: canEdit.value,
      timezone: 'Asia/Jakarta'
    }
  }
  const role = currentRole.value
  const key = role?.system_key || ''
  return {
    role_key: key || null,
    role_label: role?.nama_role || null,
    is_manager: ['ADMIN', 'SUPER_ADMIN'].includes(key),
    timezone: 'Asia/Jakarta'
  }
})
const previewWidgets = computed(() => visibleWidgets(widgets.value, previewScope.value))

// Current metric meta
const currentMetricMeta = computed<MetricMeta | undefined>(() => {
  return METRIC_CATALOG.find(m => m.key === formWidget.value.metric)
})

// Grouped metric catalog
const metricCategories = computed(() => {
  const groups: Record<string, MetricMeta[]> = {}
  METRIC_CATALOG.forEach((m) => {
    if (!groups[m.category]) groups[m.category] = []
    groups[m.category]?.push(m)
  })
  return groups
})

// Types available for current metric
const availableTypesForMetric = computed<WidgetType[]>(() => {
  return currentMetricMeta.value?.supportedTypes || ['bar', 'line', 'doughnut', 'pie', 'area', 'kpi', 'table']
})

// Load roles
async function loadRoles() {
  if (!canEdit.value) {
    roles.value = []
    loadingRoles.value = false
    return
  }
  loadingRoles.value = true
  try {
    roles.value = await dashboardService.fetchRoles()
  } finally {
    loadingRoles.value = false
  }
}

// Load config for role
async function loadConfigForRole(roleId: string) {
  loadingConfig.value = true
  try {
    const targetRoleId = roleId === 'all' ? null : roleId
    const record = await dashboardService.fetchConfig(targetRoleId)

    if (record) {
      dashboardName.value = record.nama_dashboard || (targetRoleId ? `Dashboard ${currentRole.value?.nama_role || ''}` : 'Dashboard Global')
      dashboardDesc.value = record.deskripsi || ''
      dashboardActive.value = record.is_active ?? true
      widgets.value = Array.isArray(record.config) && record.config.length > 0 ? record.config : [...DEFAULT_PRESET_WIDGETS]
    } else {
      if (targetRoleId && currentRole.value) {
        dashboardName.value = `Dashboard ${currentRole.value.nama_role}`
        dashboardDesc.value = `Konfigurasi dashboard untuk peran ${currentRole.value.nama_role}`
      } else {
        dashboardName.value = 'Dashboard Global'
        dashboardDesc.value = 'Dashboard umum untuk seluruh pengguna'
      }
      widgets.value = [...DEFAULT_PRESET_WIDGETS]
    }
  } catch (err: any) {
    toast.error('Gagal memuat konfigurasi dashboard: ' + err.message)
  } finally {
    loadingConfig.value = false
  }
}

// Load live metrics
async function loadMetrics() {
  loadingMetrics.value = true
  try {
    metricsData.value = await dashboardService.fetchMetrics()
  } catch (err: any) {
    toast.error('Gagal memuat data pratinjau: ' + err.message)
  } finally {
    loadingMetrics.value = false
  }
}

// Switch role
function onRoleChange() {
  loadConfigForRole(selectedRoleId.value)
}

// Reset to default
function resetToPreset() {
  if (confirm('Apakah Anda yakin ingin mereset susunan widget ke preset default?')) {
    widgets.value = JSON.parse(JSON.stringify(DEFAULT_PRESET_WIDGETS))
    toast.info('Susunan widget direset ke template default.')
  }
}

// Save config
async function saveDashboard() {
  if (!canEdit.value) {
    toast.error('Hanya Admin / Super Admin yang dapat menyimpan konfigurasi dashboard')
    return
  }
  saving.value = true
  try {
    const targetRoleId = selectedRoleId.value === 'all' ? null : selectedRoleId.value
    await dashboardService.saveConfig({
      m_role_id: targetRoleId,
      nama_dashboard: dashboardName.value,
      deskripsi: dashboardDesc.value,
      config: widgets.value,
      is_active: dashboardActive.value
    })
    toast.success('Pengaturan dashboard berhasil disimpan ke database!')
  } catch (err: any) {
    toast.error('Gagal menyimpan dashboard: ' + err.message)
  } finally {
    saving.value = false
  }
}

// Widget management
function openAddWidgetModal() {
  editingWidgetIndex.value = null
  formWidget.value = {
    id: 'widget-' + Date.now(),
    title: 'Grafik Baru',
    subtitle: '',
    type: 'bar',
    metric: 'sales_daily',
    grid_span: 6,
    color: 'blue',
    is_active: true
  }
  isModalOpen.value = true
}

function openEditWidgetModal(index: number) {
  editingWidgetIndex.value = index
  formWidget.value = JSON.parse(JSON.stringify(widgets.value[index]))
  isModalOpen.value = true
}

function deleteWidget(index: number) {
  widgets.value.splice(index, 1)
  toast.success('Widget berhasil dihapus')
}

function moveWidget(index: number, direction: 'up' | 'down') {
  const current = widgets.value[index]
  if (!current) return

  if (direction === 'up' && index > 0) {
    const previous = widgets.value[index - 1]
    if (!previous) return
    widgets.value[index] = previous
    widgets.value[index - 1] = current
  } else if (direction === 'down' && index < widgets.value.length - 1) {
    const next = widgets.value[index + 1]
    if (!next) return
    widgets.value[index] = next
    widgets.value[index + 1] = current
  }
}

function onMetricSelect(metricKey: string) {
  formWidget.value.metric = metricKey
  const meta = METRIC_CATALOG.find(m => m.key === metricKey)
  if (meta) {
    if (!formWidget.value.title || formWidget.value.title === 'Grafik Baru' || formWidget.value.title.startsWith('Widget')) {
      formWidget.value.title = meta.label
    }
    if (!meta.supportedTypes.includes(formWidget.value.type)) {
      formWidget.value.type = meta.defaultType
    }
    if (meta.defaultType === 'kpi') {
      formWidget.value.grid_span = 3
    }
  }
}

function saveWidgetFromModal() {
  if (!formWidget.value.title.trim()) {
    toast.error('Judul widget harus diisi')
    return
  }

  if (editingWidgetIndex.value !== null) {
    widgets.value[editingWidgetIndex.value] = { ...formWidget.value }
    toast.success('Widget berhasil diperbarui')
  } else {
    widgets.value.push({ ...formWidget.value })
    toast.success('Widget baru berhasil ditambahkan')
  }

  isModalOpen.value = false
}

// Helpers for badges
function getTypeLabel(type: WidgetType) {
  switch (type) {
    case 'kpi': return 'Kartu KPI'
    case 'bar': return 'Bar Chart'
    case 'line': return 'Line Chart'
    case 'doughnut': return 'Doughnut Chart'
    case 'pie': return 'Pie Chart'
    case 'area': return 'Area Chart'
    case 'table': return 'Tabel Data'
  }
}

function getGridSpanLabel(span: number) {
  switch (span) {
    case 3: return '1/4 Layar (Col 3)'
    case 4: return '1/3 Layar (Col 4)'
    case 6: return '1/2 Layar (Col 6)'
    case 8: return '2/3 Layar (Col 8)'
    case 12: return 'Layar Penuh (Col 12)'
    default: return `${span} Col`
  }
}

onMounted(() => {
  loadRoles()
  loadConfigForRole('all')
  loadMetrics()
})
</script>

<template>
  <div class="flex-1 space-y-6 p-6 md:p-8 bg-background min-h-screen text-foreground transition-colors duration-200">
    <!-- Header Page -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
      <div>
        <div class="flex items-center gap-2.5">
          <div class="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <LayoutDashboard class="h-6 w-6" />
          </div>
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-foreground">Setting Dashboard per Role</h1>
            <p class="text-muted-foreground text-sm mt-0.5">
              Sesuaikan komponen ringkasan, jenis grafik, dan data yang tampil pada dashboard untuk masing-masing role.
            </p>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2 flex-wrap">
        <button
          @click="resetToPreset"
          :disabled="!canEdit"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors shadow-xs disabled:opacity-50"
          title="Kembalikan susunan widget ke preset awal"
        >
          <RotateCcw class="h-4 w-4 text-muted-foreground" />
          Reset Default
        </button>

        <button
          @click="openAddWidgetModal"
          :disabled="!canEdit"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
        >
          <Plus class="h-4 w-4" />
          Tambah Widget
        </button>

        <button
          @click="saveDashboard"
          :disabled="saving || !canEdit"
          class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-xs"
        >
          <Save class="h-4 w-4" />
          {{ saving ? 'Menyimpan...' : 'Simpan Konfigurasi' }}
        </button>
      </div>
    </div>

    <!-- Pengaman akses: konfigurasi hanya untuk Admin / Super Admin -->
    <div
      v-if="!canEdit"
      class="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <span>Hanya Admin / Super Admin yang dapat mengubah konfigurasi dashboard. Halaman ini hanya menampilkan pratinjau.</span>
    </div>

    <!-- Role Selector & Basic Settings Card -->
    <div class="bg-card rounded-xl border border-border p-5 shadow-sm space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <!-- Role Dropdown -->
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Pilih Role Pengguna
          </label>
          <select
            v-model="selectedRoleId"
            @change="onRoleChange"
            class="w-full h-10 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors font-medium text-foreground"
          >
            <option value="all" class="bg-card text-foreground">🌐 Default / Global (Untuk Semua Role)</option>
            <option v-for="r in roles" :key="r.id" :value="r.id" class="bg-card text-foreground">
              👤 Role: {{ r.nama_role }} {{ r.kode_role ? `(${r.kode_role})` : '' }}
            </option>
          </select>
        </div>

        <!-- Dashboard Name -->
        <div>
          <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Nama Dashboard
          </label>
          <input
            v-model="dashboardName"
            type="text"
            placeholder="Contoh: Dashboard Toko"
            class="w-full h-10 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-foreground"
          />
        </div>

        <!-- Status Toggle & Tabs -->
        <div class="flex items-center justify-between gap-4 h-10">
          <label class="flex items-center gap-2 cursor-pointer text-sm font-medium text-foreground select-none">
            <input
              v-model="dashboardActive"
              type="checkbox"
              class="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            Aktifkan untuk Role Ini
          </label>

          <!-- View Mode Tabs -->
          <div class="inline-flex rounded-lg border border-border bg-muted p-0.5">
            <button
              @click="activeTab = 'editor'"
              :class="activeTab === 'editor' ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all"
            >
              <Settings2 class="h-3.5 w-3.5" />
              Kelola Widget ({{ widgets.length }})
            </button>
            <button
              @click="activeTab = 'preview'"
              :class="activeTab === 'preview' ? 'bg-card text-foreground shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all"
            >
              <Eye class="h-3.5 w-3.5" />
              Pratinjau Live
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 1: KELOLA WIDGET (EDITOR) -->
    <div v-if="activeTab === 'editor'" class="space-y-4">
      <div v-if="loadingConfig" class="py-12 text-center text-muted-foreground">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
        <p class="text-sm">Memuat pengaturan widget...</p>
      </div>

      <div v-else-if="widgets.length === 0" class="bg-card rounded-xl border border-dashed border-border p-12 text-center">
        <div class="w-12 h-12 rounded-full bg-muted text-muted-foreground mx-auto flex items-center justify-center mb-3">
          <Layers class="h-6 w-6" />
        </div>
        <h3 class="text-base font-semibold text-foreground">Belum ada widget yang dikonfigurasi</h3>
        <p class="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          Tambahkan widget grafik atau kartu metrik untuk role ini dengan tombol di bawah.
        </p>
        <button
          @click="openAddWidgetModal"
          :disabled="!canEdit"
          class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          <Plus class="h-4 w-4" />
          Tambah Widget Pertama
        </button>
      </div>

      <!-- Widgets Grid in Editor -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="(w, idx) in widgets"
          :key="w.id || idx"
          class="bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
          :class="{
            'border-l-4 border-l-blue-500': w.color === 'blue',
            'border-l-4 border-l-emerald-500': w.color === 'emerald',
            'border-l-4 border-l-purple-500': w.color === 'purple',
            'border-l-4 border-l-amber-500': w.color === 'amber',
            'border-l-4 border-l-rose-500': w.color === 'rose',
          }"
        >
          <!-- Top Card info -->
          <div>
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-muted-foreground">#{{ idx + 1 }}</span>
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider"
                  :class="{
                    'bg-blue-500/15 text-blue-600 dark:text-blue-400': w.color === 'blue',
                    'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400': w.color === 'emerald',
                    'bg-purple-500/15 text-purple-600 dark:text-purple-400': w.color === 'purple',
                    'bg-amber-500/15 text-amber-600 dark:text-amber-400': w.color === 'amber',
                    'bg-rose-500/15 text-rose-600 dark:text-rose-400': w.color === 'rose',
                  }"
                >
                  <component
                    :is="
                      w.type === 'bar' ? BarChart3 :
                      w.type === 'line' || w.type === 'area' ? LineChart :
                      w.type === 'doughnut' || w.type === 'pie' ? PieChart :
                      w.type === 'table' ? TableIcon : Grid
                    "
                    class="h-3 w-3"
                  />
                  {{ getTypeLabel(w.type) }}
                </span>
              </div>

              <!-- Reorder & Action Buttons -->
              <div class="flex items-center gap-1">
                <button
                  @click="moveWidget(idx, 'up')"
                  :disabled="idx === 0"
                  class="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                  title="Pindah ke Atas"
                >
                  <ArrowUp class="h-3.5 w-3.5" />
                </button>
                <button
                  @click="moveWidget(idx, 'down')"
                  :disabled="idx === widgets.length - 1"
                  class="p-1 text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors"
                  title="Pindah ke Bawah"
                >
                  <ArrowDown class="h-3.5 w-3.5" />
                </button>
                <button
                  @click="openEditWidgetModal(idx)"
                  class="p-1 text-primary hover:text-primary/80 transition-colors ml-1"
                  title="Edit Widget"
                >
                  <Edit class="h-3.5 w-3.5" />
                </button>
                <button
                  @click="deleteWidget(idx)"
                  class="p-1 text-rose-500 hover:text-rose-700 transition-colors"
                  title="Hapus Widget"
                >
                  <Trash2 class="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <!-- Title & Subtitle -->
            <h3 class="text-sm font-bold text-foreground mt-2 line-clamp-1">{{ w.title }}</h3>
            <p class="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {{ w.subtitle || METRIC_CATALOG.find(m => m.key === w.metric)?.label || '-' }}
            </p>
          </div>

          <!-- Bottom Badges -->
          <div class="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span class="inline-flex items-center gap-1 font-medium bg-muted px-2 py-0.5 rounded text-[11px] text-foreground">
              <Maximize2 class="h-2.5 w-2.5" />
              {{ getGridSpanLabel(w.grid_span) }}
            </span>

            <span class="capitalize text-muted-foreground text-[11px] font-medium flex items-center gap-1">
              <span
                class="inline-block w-2 h-2 rounded-full"
                :class="{
                  'bg-blue-500': w.color === 'blue',
                  'bg-emerald-500': w.color === 'emerald',
                  'bg-purple-500': w.color === 'purple',
                  'bg-amber-500': w.color === 'amber',
                  'bg-rose-500': w.color === 'rose',
                }"
              ></span>
              {{ w.color }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: PRATINJAU LANGSUNG (LIVE PREVIEW) -->
    <div v-else-if="activeTab === 'preview'" class="space-y-6">
      <div class="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
        <div class="flex items-center gap-2 text-foreground text-sm">
          <Sparkles class="h-4 w-4 text-primary shrink-0" />
          <span>Pratinjau langsung dashboard untuk role <strong>{{ currentRole ? currentRole.nama_role : 'Global / Default' }}</strong> dengan data aktual sistem.</span>
        </div>
        <button
          @click="loadMetrics"
          class="text-xs font-semibold text-primary hover:underline"
        >
          Refresh Data
        </button>
      </div>

      <div
        v-if="previewWidgets.length === 0"
        class="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground"
      >
        Tidak ada widget yang dapat dipratinjau untuk role ini.
      </div>

      <!-- Live Dashboard Grid -->
      <div class="grid grid-cols-12 gap-4">
        <template v-for="w in previewWidgets" :key="w.id">
          <!-- KPI Card Widget -->
          <div
            v-if="w.type === 'kpi'"
            :class="['col-span-12', spanClass(w.grid_span)]"
            class="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <div class="flex items-center justify-between">
              <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">{{ w.title }}</p>
              <div
                class="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                :class="{
                  'bg-blue-500': w.color === 'blue',
                  'bg-emerald-500': w.color === 'emerald',
                  'bg-purple-500': w.color === 'purple',
                  'bg-amber-500': w.color === 'amber',
                  'bg-rose-500': w.color === 'rose',
                }"
              >
                <Grid class="h-4 w-4" />
              </div>
            </div>
            <div class="mt-3">
              <p class="text-2xl font-bold text-foreground">
                {{ formatKpi(getKpiValue(metricsData, w.metric)) }}
              </p>
              <p v-if="getKpiValue(metricsData, w.metric).note" class="text-xs mt-1 text-muted-foreground">
                {{ getKpiValue(metricsData, w.metric).note }}
              </p>
            </div>
          </div>

          <!-- Chart Widget -->
          <div
            v-else-if="['bar', 'line', 'doughnut', 'pie', 'area'].includes(w.type)"
            :class="['col-span-12', spanClass(w.grid_span)]"
            class="bg-card rounded-xl border border-border p-5 shadow-sm"
          >
            <div class="flex items-center justify-between mb-4">
              <div>
                <h3 class="text-sm font-bold text-foreground">{{ w.title }}</h3>
                <p v-if="w.subtitle" class="text-xs text-muted-foreground mt-0.5">{{ w.subtitle }}</p>
              </div>
              <span
                class="text-[11px] font-semibold px-2 py-0.5 rounded capitalize"
                :class="{
                  'bg-blue-500/15 text-blue-600 dark:text-blue-400': w.color === 'blue',
                  'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400': w.color === 'emerald',
                  'bg-purple-500/15 text-purple-600 dark:text-purple-400': w.color === 'purple',
                  'bg-amber-500/15 text-amber-600 dark:text-amber-400': w.color === 'amber',
                  'bg-rose-500/15 text-rose-600 dark:text-rose-400': w.color === 'rose',
                }"
              >
                {{ getTypeLabel(w.type) }}
              </span>
            </div>

            <!-- Render DynamicChart -->
            <DynamicChart
              v-if="getChartData(metricsData, w.metric).labels.length > 0"
              :type="w.type as any"
              :labels="getChartData(metricsData, w.metric).labels"
              :data="getChartData(metricsData, w.metric).data"
              :color-theme="w.color"
              :height="260"
            />
            <div v-else class="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
              Belum ada data untuk grafik ini.
            </div>
          </div>

          <!-- Table Widget -->
          <div
            v-else-if="w.type === 'table'"
            :class="['col-span-12', spanClass(w.grid_span)]"
            class="bg-card rounded-xl border border-border p-5 shadow-sm"
          >
            <div class="flex items-center justify-between mb-3">
              <div>
                <h3 class="text-sm font-bold text-foreground">{{ w.title }}</h3>
                <p v-if="w.subtitle" class="text-xs text-muted-foreground mt-0.5">{{ w.subtitle }}</p>
              </div>
              <span class="text-[11px] font-semibold px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                Tabel Aktivitas
              </span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs">
                <thead>
                  <tr class="border-b border-border text-muted-foreground">
                    <th class="pb-2 font-medium">Nomor</th>
                    <th class="pb-2 font-medium">Keterangan / Partner</th>
                    <th class="pb-2 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border text-foreground">
                  <tr
                    v-for="(row, rIdx) in getTableRows(metricsData, w.metric)"
                    :key="rIdx"
                    class="hover:bg-muted/40 transition-colors"
                  >
                    <td class="py-2.5 font-semibold text-foreground">
                      <div>{{ row.no || row.no_po || '-' }}</div>
                      <div class="text-[10px] font-normal text-muted-foreground">{{ formatWaktu(row.waktu) }}</div>
                    </td>
                    <td class="py-2.5 text-muted-foreground">{{ row.keterangan || '-' }}</td>
                    <td class="py-2.5 text-right">
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold" :class="statusClass(row.status)">
                        {{ statusLabel(row.status) }}
                      </span>
                    </td>
                  </tr>
                  <tr v-if="getTableRows(metricsData, w.metric).length === 0">
                    <td colspan="3" class="py-4 text-center text-muted-foreground">Tidak ada data transaksi terbaru</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- MODAL: WIDGET BUILDER -->
    <div
      v-if="isModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
    >
      <div
        class="bg-card text-card-foreground rounded-2xl shadow-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <!-- Modal Header -->
        <div class="p-5 border-b border-border flex items-center justify-between bg-muted/20">
          <div class="flex items-center gap-2">
            <div class="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Boxes class="h-5 w-5" />
            </div>
            <div>
              <h2 class="text-lg font-bold text-foreground">
                {{ editingWidgetIndex !== null ? 'Edit Widget Dashboard' : 'Tambah Widget Baru' }}
              </h2>
              <p class="text-xs text-muted-foreground">Sesuaikan sumber data, tipe visualisasi, dan tata letak.</p>
            </div>
          </div>
          <button
            @click="isModalOpen = false"
            class="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
          >
            ✕
          </button>
        </div>

        <!-- Modal Body Form -->
        <div class="p-6 space-y-5">
          <!-- 1. Widget Title & Subtitle -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Judul Widget <span class="text-rose-500">*</span>
              </label>
              <input
                v-model="formWidget.title"
                type="text"
                class="w-full h-10 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors font-medium text-foreground"
                placeholder="Contoh: Tren Penjualan Harian"
              />
            </div>
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Keterangan / Subtitle (Opsional)
              </label>
              <input
                v-model="formWidget.subtitle"
                type="text"
                class="w-full h-10 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-foreground"
                placeholder="Contoh: Omzet 7 hari terakhir (WIB)"
              />
            </div>
          </div>

          <!-- 2. Select Metric / Data Source -->
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Pilih Sumber Data / Metrik
            </label>
            <div class="space-y-3">
              <div v-for="(metrics, cat) in metricCategories" :key="cat" class="space-y-1.5">
                <span class="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{{ cat }}</span>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    v-for="m in metrics"
                    :key="m.key"
                    type="button"
                    @click="onMetricSelect(m.key)"
                    :class="formWidget.metric === m.key ? 'border-primary bg-primary/10 ring-1 ring-primary text-foreground font-semibold' : 'border-border bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground'"
                    class="p-2.5 rounded-lg border text-left flex items-start justify-between gap-2 transition-all cursor-pointer"
                  >
                    <div>
                      <p class="text-xs font-medium">{{ m.label }}</p>
                      <p class="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{{ m.description }}</p>
                    </div>
                    <CheckCircle2
                      v-if="formWidget.metric === m.key"
                      class="h-4 w-4 text-primary shrink-0 mt-0.5"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. Choose Chart Type -->
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Pilih Jenis Visualisasi / Grafik
            </label>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                v-for="t in ['bar', 'line', 'doughnut', 'pie', 'area', 'kpi', 'table']"
                :key="t"
                type="button"
                @click="formWidget.type = t as WidgetType"
                :class="formWidget.type === t ? 'border-primary bg-primary/10 ring-1 ring-primary font-semibold text-primary' : 'border-border bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground'"
                class="p-2.5 rounded-lg border text-center flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <component
                  :is="
                    t === 'bar' ? BarChart3 :
                    t === 'line' || t === 'area' ? LineChart :
                    t === 'doughnut' || t === 'pie' ? PieChart :
                    t === 'table' ? TableIcon : Grid
                  "
                  class="h-5 w-5"
                />
                <span class="text-xs capitalize">{{ getTypeLabel(t as any) }}</span>
              </button>
            </div>
          </div>

          <!-- 4. Grid Width & Color Theme -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Grid Width -->
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Ukuran Lebar Widget
              </label>
              <select
                v-model.number="formWidget.grid_span"
                class="w-full h-10 px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-foreground"
              >
                <option :value="3" class="bg-card text-foreground">1/4 Layar (3 Kolom) - Cocok untuk KPI</option>
                <option :value="4" class="bg-card text-foreground">1/3 Layar (4 Kolom)</option>
                <option :value="6" class="bg-card text-foreground">1/2 Layar (6 Kolom) - Standar Berdampingan</option>
                <option :value="8" class="bg-card text-foreground">2/3 Layar (8 Kolom) - Grafik Utama</option>
                <option :value="12" class="bg-card text-foreground">Layar Penuh (12 Kolom)</option>
              </select>
            </div>

            <!-- Color Palette -->
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Warna Tema
              </label>
              <div class="flex items-center gap-2 h-10">
                <button
                  v-for="color in ['blue', 'emerald', 'purple', 'amber', 'rose']"
                  :key="color"
                  type="button"
                  @click="formWidget.color = color as ColorTheme"
                  :class="{
                    'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110': formWidget.color === color,
                    'bg-blue-500': color === 'blue',
                    'bg-emerald-500': color === 'emerald',
                    'bg-purple-500': color === 'purple',
                    'bg-amber-500': color === 'amber',
                    'bg-rose-500': color === 'rose',
                  }"
                  class="w-7 h-7 rounded-full cursor-pointer transition-all"
                  :title="color"
                ></button>
                <span class="text-xs text-muted-foreground capitalize ml-2 font-medium">Tema: {{ formWidget.color }}</span>
              </div>
            </div>
          </div>

          <!-- 5. Mini Live Preview -->
          <div class="pt-3 border-t border-border">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold text-muted-foreground uppercase tracking-wider">Mini Preview</span>
              <span class="text-[11px] text-muted-foreground">Tampilan grafis waktu-nyata</span>
            </div>
            <div class="p-4 bg-muted/40 rounded-xl border border-border">
              <div v-if="formWidget.type === 'kpi'" class="bg-card p-4 rounded-lg border border-border shadow-xs max-w-xs">
                <p class="text-xs text-muted-foreground font-medium uppercase">{{ formWidget.title }}</p>
                <p class="text-2xl font-bold text-foreground mt-2">
                  {{ formatKpi(getKpiValue(metricsData, formWidget.metric)) }}
                </p>
                <p v-if="getKpiValue(metricsData, formWidget.metric).note" class="text-xs text-emerald-500 dark:text-emerald-400 font-semibold mt-1">
                  {{ getKpiValue(metricsData, formWidget.metric).note }}
                </p>
              </div>

              <div v-else-if="formWidget.type === 'table'" class="bg-card p-3 rounded-lg border border-border shadow-xs text-xs text-muted-foreground text-center">
                📋 Widget tabel akan menampilkan 5 catatan data terbaru saat aktif.
              </div>

              <div v-else class="bg-card p-4 rounded-lg border border-border shadow-xs">
                <DynamicChart
                  v-if="getChartData(metricsData, formWidget.metric).labels.length > 0"
                  :type="formWidget.type as any"
                  :labels="getChartData(metricsData, formWidget.metric).labels"
                  :data="getChartData(metricsData, formWidget.metric).data"
                  :color-theme="formWidget.color"
                  :height="180"
                />
                <div v-else class="flex h-[180px] items-center justify-center text-xs text-muted-foreground">
                  Belum ada data untuk grafik ini.
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="p-5 bg-muted/20 border-t border-border flex items-center justify-end gap-2 rounded-b-2xl">
          <button
            @click="isModalOpen = false"
            class="px-4 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors"
          >
            Batal
          </button>
          <button
            @click="saveWidgetFromModal"
            class="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            {{ editingWidgetIndex !== null ? 'Perbarui Widget' : 'Tambahkan ke Dashboard' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
