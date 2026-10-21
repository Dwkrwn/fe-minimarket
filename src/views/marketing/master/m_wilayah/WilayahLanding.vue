<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { LMap, LMarker, LPopup, LTileLayer } from '@vue-leaflet/vue-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { MapPinned, Building2, Map, Users, RefreshCw, LineChart, X } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getWilayahCustomerCounts } from './service'

type GroupBy = 'provinsi' | 'kota' | 'kecamatan'

interface WilayahCount {
  wilayah: string
  total: number
}

interface WilayahMarker extends WilayahCount {
  lat: number
  lng: number
}

interface UnitBisnisOption {
  id: string
  nama_comp: string
  total_customers: number
}

const loading = ref(false)
const geocoding = ref(false)
const groupBy = ref<GroupBy>('kota')
const selectedUnitBisnisId = ref('')
const searchQuery = ref('')

const totals = ref<{ totalCustomers: number; totalWilayah: number }>({
  totalCustomers: 0,
  totalWilayah: 0,
})

const countRows = ref<WilayahCount[]>([])
const markers = ref<WilayahMarker[]>([])
const unitBisnisOptions = ref<UnitBisnisOption[]>([])
const geocodeCache = ref<Record<string, { lat: number; lng: number }>>({})

const mapZoom = ref(5)
const mapCenter = ref<[number, number]>([-2.5489, 118.0149])

const markerIconByTotal = (total: number): any =>
  L.divIcon({
    className: 'wilayah-count-marker',
    html: `<div class="marker-wrap"><span>${total}</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -30],
    shadowUrl: markerShadow,
  })

const selectedUnitBisnisName = computed(() => {
  if (!selectedUnitBisnisId.value) return 'Semua Unit Bisnis'
  const found = unitBisnisOptions.value.find((u) => u.id === selectedUnitBisnisId.value)
  return found?.nama_comp || 'Unit Bisnis'
})

const filteredRows = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase()
  if (!keyword) return countRows.value
  return countRows.value.filter((row) => row.wilayah.toLowerCase().includes(keyword))
})

const filteredMarkers = computed(() => {
  const allowed = new Set(filteredRows.value.map((row) => row.wilayah))
  return markers.value.filter((marker) => allowed.has(marker.wilayah))
})

const topRows = computed(() =>
  [...filteredRows.value]
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)
)

const chartValues = computed(() => topRows.value.map((row) => row.total))
const chartMax = computed(() => Math.max(...chartValues.value, 1))
const chartMin = computed(() => Math.min(...chartValues.value, 0))
const hoveredPointIndex = ref<number | null>(null)

const linePoints = computed(() => {
  const rows = topRows.value
  if (!rows.length) return [] as Array<{ x: number; y: number; label: string; value: number }>

  const width = 100
  const minY = 14
  const maxY = 76
  const usableHeight = maxY - minY
  const denominator = Math.max(rows.length - 1, 1)

  return rows.map((row, index) => {
    const x = (index / denominator) * width
    const y = maxY - (row.total / chartMax.value) * usableHeight
    return {
      x,
      y,
      label: row.wilayah,
      value: row.total,
    }
  })
})

const formatXAxisLabel = (label: string): string => {
  if (label.length <= 12) return label
  return `${label.slice(0, 12)}...`
}

const pointColorByValue = (value: number): string => {
  const ratio = Math.max(0, Math.min(1, value / chartMax.value))
  // rendah -> kuning, tinggi -> biru tua
  const hue = 50 + ratio * 160
  const sat = 86
  const light = 56 - ratio * 18
  return `hsl(${hue}, ${sat}%, ${light}%)`
}

const pointStrokeByValue = (value: number): string => {
  const ratio = Math.max(0, Math.min(1, value / chartMax.value))
  const hue = 45 + ratio * 165
  return `hsl(${hue}, 92%, 33%)`
}

const hoveredPoint = computed(() => {
  if (hoveredPointIndex.value === null) return null
  const point = linePoints.value[hoveredPointIndex.value]
  if (!point) return null
  return {
    ...point,
    rank: hoveredPointIndex.value + 1,
    color: pointColorByValue(point.value),
  }
})

const linePath = computed(() => {
  if (!linePoints.value.length) return ''
  return linePoints.value.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
})

const areaPath = computed(() => {
  if (!linePoints.value.length) return ''
  const first = linePoints.value[0]
  const last = linePoints.value[linePoints.value.length - 1]
  if (!first || !last) return ''
  const core = linePoints.value.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  return `${core} L ${last.x} 100 L ${first.x} 100 Z`
})

const geocodeWilayah = async (wilayah: string): Promise<{ lat: number; lng: number } | null> => {
  const cached = geocodeCache.value[wilayah]
  if (cached) return cached

  try {
    const q = encodeURIComponent(`${wilayah}, Indonesia`)
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`)
    const result = await response.json()
    if (!Array.isArray(result) || result.length === 0) return null

    const lat = Number(result[0].lat)
    const lng = Number(result[0].lon)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null

    geocodeCache.value[wilayah] = { lat, lng }
    return { lat, lng }
  } catch {
    return null
  }
}

const buildMarkers = async () => {
  geocoding.value = true
  try {
    const nextMarkers: WilayahMarker[] = []
    const rows = filteredRows.value.slice(0, 30)

    for (const row of rows) {
      const point = await geocodeWilayah(row.wilayah)
      if (!point) continue
      nextMarkers.push({ wilayah: row.wilayah, total: row.total, lat: point.lat, lng: point.lng })
    }

    markers.value = nextMarkers
  } finally {
    geocoding.value = false
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const response = await getWilayahCustomerCounts(groupBy.value, selectedUnitBisnisId.value || undefined)
    if (response.status !== 'success') {
      throw new Error('Gagal memuat data wilayah')
    }

    countRows.value = (response.data || []).map((item) => ({
      wilayah: String(item.wilayah || '-'),
      total: Number(item.total || 0),
    }))

    totals.value = {
      totalCustomers: Number(response.meta?.total_customers || 0),
      totalWilayah: Number(response.meta?.total_wilayah || 0),
    }

    if (response.unit_bisnis_options?.length) {
      unitBisnisOptions.value = response.unit_bisnis_options
    }

    await buildMarkers()
  } catch (error) {
    toast.error('Gagal memuat data map wilayah', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
    })
  } finally {
    loading.value = false
  }
}

const handleRefresh = async () => {
  await loadData()
  toast.success('Data map wilayah berhasil dimuat ulang')
}

const focusMarker = (marker: WilayahMarker) => {
  mapCenter.value = [marker.lat, marker.lng]
  mapZoom.value = 10
}

onMounted(async () => {
  await loadData()
})
</script>

<template>
  <div class="bg-background p-4 lg:p-6 space-y-5">
    <div class="rounded-2xl border border-border bg-card shadow-sm p-4 lg:p-5">
      <div class="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-extrabold tracking-tight text-foreground">Map Wilayah Customer</h1>
          <p class="text-muted-foreground mt-1">Dashboard persebaran customer per wilayah dan unit bisnis</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <select v-model="selectedUnitBisnisId" class="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground" @change="loadData">
            <option value="">Semua Unit Bisnis</option>
            <option v-for="opt in unitBisnisOptions" :key="opt.id" :value="opt.id">
              {{ opt.nama_comp }} ({{ opt.total_customers }})
            </option>
          </select>

          <select v-model="groupBy" class="h-11 rounded-xl border border-border bg-background px-3 text-sm text-foreground" @change="loadData">
            <option value="provinsi">Provinsi</option>
            <option value="kota">Kota</option>
            <option value="kecamatan">Kecamatan</option>
          </select>

          <Button variant="outline" size="icon" class="h-11 w-11 rounded-xl border-border" :disabled="loading" @click="handleRefresh">
            <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
          </Button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        <div class="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-cyan-50 p-4 text-slate-900">
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold uppercase tracking-wide text-sky-700">Unit Bisnis</p>
            <Building2 class="h-4 w-4 text-sky-600" />
          </div>
          <p class="mt-2 text-sm font-semibold text-slate-900 truncate">{{ selectedUnitBisnisName }}</p>
        </div>

        <div class="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-lime-50 p-4 text-slate-900">
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total Customer</p>
            <Users class="h-4 w-4 text-emerald-600" />
          </div>
          <p class="mt-2 text-2xl font-bold text-slate-900">{{ totals.totalCustomers }}</p>
        </div>

        <div class="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4 text-slate-900">
          <div class="flex items-center justify-between">
            <p class="text-xs font-semibold uppercase tracking-wide text-violet-700">Total Wilayah</p>
            <Map class="h-4 w-4 text-violet-600" />
          </div>
          <p class="mt-2 text-2xl font-bold text-slate-900">{{ totals.totalWilayah }}</p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <Card class="xl:col-span-8 rounded-2xl border-border shadow-sm bg-card">
        <CardContent class="p-3 lg:p-4">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm font-semibold text-foreground flex items-center gap-2">
              <MapPinned class="h-4 w-4 text-sky-600" /> Peta Persebaran
            </p>
            <p class="text-xs text-muted-foreground">Marker: {{ filteredMarkers.length }}</p>
          </div>

          <div class="h-[58vh] rounded-xl overflow-hidden border border-border">
            <LMap :zoom="mapZoom" :center="mapCenter" :use-global-leaflet="false" style="height: 100%; width: 100%">
              <LTileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />

              <LMarker
                v-for="marker in filteredMarkers"
                :key="`${marker.wilayah}-${groupBy}-${selectedUnitBisnisId}`"
                :lat-lng="[marker.lat, marker.lng]"
                :icon="markerIconByTotal(marker.total)"
              >
                <LPopup>
                  <div class="font-semibold">{{ marker.wilayah }}</div>
                  <div>Jumlah Customer: {{ marker.total }}</div>
                  <div class="text-xs text-muted-foreground">Unit Bisnis: {{ selectedUnitBisnisName }}</div>
                </LPopup>
              </LMarker>
            </LMap>
          </div>

          <p class="text-xs text-muted-foreground mt-2">{{ geocoding ? 'Menentukan titik peta wilayah...' : 'Klik wilayah di panel kanan untuk fokus ke marker.' }}</p>
        </CardContent>
      </Card>

      <Card class="xl:col-span-4 rounded-2xl border-border shadow-sm bg-card">
        <CardContent class="p-4 mt-4 space-y-3">
          <div class="relative">
            <Input v-model="searchQuery" placeholder="Cari wilayah..." class="h-11 rounded-xl border-border bg-background pr-10 text-foreground" />
            <Button
              v-if="searchQuery"
              type="button"
              size="icon"
              variant="ghost"
              class="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-white"
              @click="searchQuery = ''"
            >
              <X class="h-4 w-4" />
            </Button>
          </div>

          <div class="max-h-[56vh] overflow-auto space-y-2 pr-1">
            <button
              v-for="row in filteredRows"
              :key="`${row.wilayah}-${groupBy}`"
              class="w-full text-left rounded-xl border border-border bg-background p-3 hover:border-sky-300 hover:shadow-sm transition"
              type="button"
              @click="() => {
                const marker = filteredMarkers.find((m) => m.wilayah === row.wilayah)
                if (marker) focusMarker(marker)
              }"
            >
              <div class="font-semibold text-foreground">{{ row.wilayah }}</div>
              <div class="mt-2 flex items-center gap-2">
                <Badge variant="secondary" class="bg-muted text-muted-foreground">{{ row.total }} customer</Badge>
              </div>
            </button>

            <div v-if="filteredRows.length === 0" class="text-sm text-muted-foreground py-6 text-center">Tidak ada wilayah</div>
          </div>
        </CardContent>
      </Card>
    </div>

    <Card class="rounded-2xl border-border shadow-sm bg-card">
      <CardContent class="p-4 lg:p-5 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <LineChart class="h-4 w-4 text-sky-600" />
            <h2 class="text-lg font-semibold text-foreground">Line Chart Persebaran Wilayah</h2>
          </div>
          <span class="text-xs text-muted-foreground">Top 10 wilayah</span>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div class="xl:col-span-9 rounded-xl border border-border bg-gradient-to-b from-sky-50/40 to-background dark:from-slate-900/40 p-3">
            <svg viewBox="0 0 100 130" class="w-full h-[390px]" @mouseleave="hoveredPointIndex = null">
              <defs>
                <linearGradient id="lineArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.35" />
                  <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0.02" />
                </linearGradient>
              </defs>

              <line x1="0" y1="100" x2="100" y2="100" stroke="#cbd5e1" stroke-width="0.4" />
              <line x1="0" y1="75" x2="100" y2="75" stroke="#e2e8f0" stroke-width="0.35" />
              <line x1="0" y1="50" x2="100" y2="50" stroke="#e2e8f0" stroke-width="0.35" />
              <line x1="0" y1="25" x2="100" y2="25" stroke="#e2e8f0" stroke-width="0.35" />

              <path v-if="areaPath" :d="areaPath" fill="url(#lineArea)" />
              <path v-if="linePath" :d="linePath" fill="none" stroke="#0ea5e9" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" />

              <g v-for="(point, index) in linePoints" :key="`pt-${point.label}`">
                <circle
                  :cx="point.x"
                  :cy="point.y"
                  r="5.5"
                  fill="transparent"
                  class="cursor-pointer"
                  @mouseenter="hoveredPointIndex = index"
                />
                <circle
                  :cx="point.x"
                  :cy="point.y"
                  r="2.7"
                  :fill="pointColorByValue(point.value)"
                  :stroke="pointStrokeByValue(point.value)"
                  stroke-width="1.2"
                  class="pointer-events-none"
                />
              </g>

              <g v-for="point in linePoints" :key="`x-label-${point.label}`">
                <text
                  :x="point.x"
                  y="116"
                  text-anchor="middle"
                  font-size="3.8"
                  fill="#64748b"
                  :transform="`rotate(-90 ${point.x} 116)`"
                >
                  {{ formatXAxisLabel(point.label) }}
                </text>
              </g>
            </svg>

            <div v-if="hoveredPoint" class="mt-3 rounded-lg border border-border bg-background px-3 py-2">
              <div class="text-xs text-muted-foreground">Detail Titik (hover)</div>
              <div class="mt-1 flex items-center gap-2">
                <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: hoveredPoint.color }" />
                <span class="text-sm font-semibold text-foreground">#{{ hoveredPoint.rank }} {{ hoveredPoint.label }}</span>
                <span class="text-sm font-bold text-foreground ml-auto">{{ hoveredPoint.value }} customer</span>
              </div>
            </div>
          </div>

          <div class="xl:col-span-3 rounded-xl border border-border p-3 bg-background">
            <p class="text-xs uppercase tracking-wide text-muted-foreground">Insight</p>
            <div class="mt-3 space-y-3 text-sm">
              <div>
                <p class="text-muted-foreground">Top Wilayah</p>
                <p class="font-semibold text-foreground">{{ topRows[0]?.wilayah || '-' }}</p>
              </div>
              <div>
                <p class="text-muted-foreground">Nilai Tertinggi</p>
                <p class="font-semibold text-foreground">{{ chartMax }}</p>
              </div>
              <div>
                <p class="text-muted-foreground">Nilai Terendah</p>
                <p class="font-semibold text-foreground">{{ chartMin }}</p>
              </div>
              <div>
                <p class="text-muted-foreground">Titik Data</p>
                <p class="font-semibold text-foreground">{{ topRows.length }}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
:deep(.wilayah-count-marker .marker-wrap) {
  width: 36px;
  height: 36px;
  border-radius: 9999px;
  background: linear-gradient(135deg, #0ea5e9, #0284c7);
  border: 2px solid #ffffff;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  box-shadow: 0 8px 18px rgba(14, 165, 233, 0.35);
}

:deep(.wilayah-count-marker .marker-wrap span) {
  line-height: 1;
}
</style>
