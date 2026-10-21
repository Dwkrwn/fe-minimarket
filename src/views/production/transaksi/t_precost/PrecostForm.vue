<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import AuditInfo from '@/components/AuditInfo.vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { FieldX, FieldSelect, FieldNumber, FieldPopup } from '@/components/field'
import { Trash2, ArrowLeft, Save, Loader2, Plus, History, Search, ExternalLink, Check, RotateCcw, X, Calculator, ChevronDown, ChevronUp, ChevronRight, Info, Sparkles, Layers, SlidersHorizontal, Link2, AlertTriangle, Scale, FileSpreadsheet, FlaskConical, GripVertical } from 'lucide-vue-next'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ButtonMultiSelect } from '@/components/button'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { usePermission } from '@/composables/usePermission'
import {
  createPrecost,
  updatePrecost,
  getPrecostById,
} from './service'

// ============================================================================
// SETUP
// ============================================================================
const authStore = useAuthStore()
const { isSuperAdmin } = usePermission()
const { API_BASE_URL } = useApi()
const router = useRouter()
const route = useRoute()

const flagOptions = [
  { label: 'INTERNAL', value: 'INTERNAL' },
  { label: 'EKSTERNAL', value: 'EKSTERNAL' },
]

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false)
const auditMeta = ref<any>({})
const isEditMode = computed(() => !!route.params.id && route.name === 'PrecostForm')
const isViewMode = computed(() => route.name === 'PrecostView')
const isCopyMode = computed(() => !!route.query.copy || (route.query.action === 'copy' && !!route.query.source))
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)

const isUnitBisnisReadonly = computed(() => !isSuperAdmin.value || isEditMode.value || isViewMode.value)

const getSelectRespoData = () => {
  try {
    const raw = localStorage.getItem('SelectRespo')
    if (!raw) return null
    return JSON.parse(raw)
  } catch (err) {
    console.error('Failed to parse SelectRespo:', err)
    return null
  }
}

const applyCurrentUserUnitBisnis = () => {
  if (isSuperAdmin.value) return
  const selectRespo = getSelectRespoData()
  const ubId = selectRespo?.companyId || selectRespo?.m_unit_bisnis_id || selectRespo?.unitBisnisId || ""
  if (ubId) {
    values.m_unit_bisnis_id = String(ubId)
    fetchUnitBisnisCompanyName(String(ubId))
  }
}

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Precost'
  if (isCopyMode.value) return 'Salin Precost'
  if (isEditMode.value) return 'Edit Precost'
  return 'Tambah Precost Baru'
})

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Precost'
  if (isCopyMode.value) return 'Buat Precost baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Precost'
  return 'Buat Precost baru'
})

const getTodayDateString = () => {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Form values
const values = reactive({
  id: '',
  m_unit_bisnis_id: '',
  no: '',
  flag: 'INTERNAL',
  type: 'GENERAL' as 'GENERAL' | 'CHEMICAL' | 'SPESIFIK',
  date: getTodayDateString(),
  m_cust_id: '',
  shipto_id: '',
  name: '',
  address: '',
  m_item_id: '',
  item_type_id: '',
  qty: 1,
  unit_id: '',
  mtr_amt: 0,
  ohd_pct: 0,
  ohd_amt: 0,
  dl_pct: 0,
  dl_amt: 0,
  tot_cogm: 0,
  mkt_pct: 0,
  mkt_amt: 0,
  adm_pct: 0,
  adm_amt: 0,
  tot_unit_cost: 0,
  pack_amt: 0,
  dlv_amt: 0,
  tot_other_cost: 0,
  tot_brutto: 0,
  profit_pct: 0,
  profit_amt: 0,
  tot_netto: 0,
  price: 0,
  benchmark: 0,
  profit_bmk: 0,
  selisih: 0,
  notes: '',
  status: 'DRAFT',
  batch_weight: 0,
  base_resin: 0,
  total_volume: 0,
  sg_compound: 0,
  total_biaya_material: 0,
  harga_per_kg_compound: 0,
  hose_weight: 0,
  hpp_material: 0,
  hpp_material_ppn: 0,
})

const isInternal = computed(() => values.flag === 'INTERNAL')

const typeOptions = [
  { label: 'General (Produk Standar)', value: 'GENERAL' },
  { label: 'Chemical (Formulasi Compound / WIP)', value: 'CHEMICAL' },
  { label: 'Spesifik (Spesifikasi Teknis Selang)', value: 'SPESIFIK' },
]

const isTypeGeneral = computed(() => (values.type || 'GENERAL').toUpperCase() === 'GENERAL')
const isTypeChemical = computed(() => (values.type || '').toUpperCase() === 'CHEMICAL')
const isTypeSpesifik = computed(() => (values.type || '').toUpperCase() === 'SPESIFIK')

const handleTypeChange = async (newType: string) => {
  values.type = (newType || 'GENERAL') as 'GENERAL' | 'CHEMICAL' | 'SPESIFIK'
  if (values.type === 'SPESIFIK') {
    if (layerGroups.value.length === 0) {
      initLayerGroups()
    }
    syncSpekWeightToQty()
  } else if (values.type === 'CHEMICAL') {
    if (!isItemTypeWip.value) {
      try {
        const res = await apiCall<any>(`/dynamic/m_general?filter_column_group=TIPE_ITEM&where=key1:WIP&no_pagination=true`)
        const wipItem = res?.data?.[0]
        if (wipItem) {
          values.item_type_id = wipItem.id
          selectedItemTypeName.value = wipItem.value1 || 'WIP'
          selectedItemTypeKey.value = wipItem.key1 || 'WIP'
        }
      } catch (err) {
        console.error('Failed to set WIP item type for Chemical:', err)
      }
    }
  }
}

// Display names for select inputs
const selectedUnitBisnisCompanyName = ref('')
const selectedUnitBisnisName = ref('')
const selectedCustomerName = ref('')
const selectedShipToName = ref('')
const selectedItemName = ref('')
const selectedItemUomName = ref('')
const selectedItemTypeName = ref('')
const selectedItemTypeKey = ref('')

/** PHR & Formula Compound hanya ada saat tipe item produk adalah WIP */
const isItemTypeWip = computed(() => {
  const key = (selectedItemTypeKey.value || '').toUpperCase()
  const name = (selectedItemTypeName.value || '').toUpperCase()
  return key === 'WIP' || name === 'WIP' || name.includes('WORK IN PROCESS')
})

const showPhr = computed(() => {
  return isItemTypeWip.value
})

const detailArr = ref<any[]>([])

const spekArr = ref<any[]>([])

export interface LayerGroupParam {
  id?: string
  nama_parameter: string // param_id (FK m_spec)
  nama_parameter_display: string
  value: string
  satuan: string // unit_id (FK UOM)
  satuan_display: string
  notes?: string
  is_calculated?: boolean
  is_linked?: boolean
  link_source?: string
  calc_key?: string
  short_label?: string
  placeholder?: string
  formula_text?: string
}

export interface LayerGroupRow {
  local_id: string
  layer_id: string // FK m_layer di m_general
  layer_display: string
  params: LayerGroupParam[]
}

const layerGroups = ref<LayerGroupRow[]>([])
const showCalculationPanel = ref(true)

const newSpekRow = () => ({
  id: '',
  layer_id: '',
  layer_display: '',
  param_id: '',
  param_display: '',
  value: '',
  unit_id: '',
  unit_display: '',
  notes: '',
  // Formula fields (runtime only, not saved to DB)
  is_calculated: false,
  is_linked: false,
  link_source: '',
  formula_text: '',
})

const addSpekRow = () => {
  spekArr.value.push(newSpekRow())
}

const removeSpekRow = (index: number) => {
  spekArr.value.splice(index, 1)
}

// ============================================================================
// MASTER GENERAL MAPPING & PRESET DEFINITIONS
// ============================================================================
const rawLayers = ref<any[]>([])
const rawSpecs = ref<any[]>([])
const rawUoms = ref<any[]>([])
const layerMap = ref<Record<string, string>>({})
const spekMap = ref<Record<string, string>>({})
const uomMap = ref<Record<string, string>>({})

const LAYER_PARAM_TEMPLATES: Record<string, Array<{
  specCode: string
  specName: string
  shortLabel: string
  uom: string
  defaultValue: string
  isCalculated?: boolean
  isLinked?: boolean
  linkSource?: string
  calcKey?: string
  formulaText?: string
}>> = {
  SPEC: [
    { specCode: 'SP001', specName: 'SIZE (inch)', shortLabel: 'Ukuran', uom: 'inch', defaultValue: '', formulaText: 'Input Manual' },
    { specCode: 'SP002', specName: 'INNER DIAMETER (mm)', shortLabel: 'ID', uom: 'mm', defaultValue: '', isLinked: true, linkSource: 'TUBE ID', formulaText: 'Ambil dari TUBE ID' },
    { specCode: 'SP003', specName: 'OUTER DIAMETER (mm)', shortLabel: 'OD', uom: 'mm', defaultValue: '', isLinked: true, linkSource: 'COVER OD', formulaText: 'Ambil dari Lapisan Terluar OD' },
    { specCode: 'SP004', specName: 'LENGTH (M)', shortLabel: 'Panjang', uom: 'M', defaultValue: '', formulaText: 'Input Manual (M)' },
  ],
  TUBE: [
    { specCode: 'SP002', specName: 'INNER DIAMETER (mm)', shortLabel: 'ID', uom: 'mm', defaultValue: '', formulaText: 'Input Manual (mm)' },
    { specCode: 'SP003', specName: 'OUTER DIAMETER (mm)', shortLabel: 'OD', uom: 'mm', defaultValue: '', isCalculated: true, calcKey: 'tube_od', formulaText: 'Rumus: ID + (2 × Thick)' },
    { specCode: 'SP005', specName: 'THICKNESS (mm)', shortLabel: 'Thick', uom: 'mm', defaultValue: '', formulaText: 'Input Manual (mm)' },
    { specCode: 'SP006', specName: 'WEIGHT/M (kg)', shortLabel: 'Berat/M', uom: 'Kg', defaultValue: '', isCalculated: true, calcKey: 'tube_weight', formulaText: 'Rumus: π × ((OD²-ID²)/4) × SG × 10⁻³ × Panjang (dikurangi Kawat bila ada Spring)' },
    { specCode: 'SP007', specName: 'PRICE/M (Rp)', shortLabel: 'Harga/M', uom: 'Rp', defaultValue: '', isCalculated: true, calcKey: 'tube_cost', formulaText: 'Rumus: Berat/M × Harga Compound' },
  ],
  COVER_TUBE: [
    { specCode: 'SP002', specName: 'INNER DIAMETER (mm)', shortLabel: 'ID', uom: 'mm', defaultValue: '', isLinked: true, linkSource: 'TUBE OD', formulaText: 'Ambil dari Lapisan Sebelumnya (OD)' },
    { specCode: 'SP003', specName: 'OUTER DIAMETER (mm)', shortLabel: 'OD', uom: 'mm', defaultValue: '', isCalculated: true, calcKey: 'cover_tube_od', formulaText: 'Rumus: ID + (2 × Thick)' },
    { specCode: 'SP005', specName: 'THICKNESS (mm)', shortLabel: 'Thick', uom: 'mm', defaultValue: '', formulaText: 'Input Manual (mm)' },
    { specCode: 'SP006', specName: 'WEIGHT/M (kg)', shortLabel: 'Berat/M', uom: 'Kg', defaultValue: '', isCalculated: true, calcKey: 'cover_tube_weight', formulaText: 'Rumus: π × ((OD²-ID²)/4) × SG × 10⁻³ × Panjang' },
    { specCode: 'SP007', specName: 'PRICE/M (Rp)', shortLabel: 'Harga/M', uom: 'Rp', defaultValue: '', isCalculated: true, calcKey: 'cover_tube_cost', formulaText: 'Rumus: Berat/M × Harga Compound CT' },
  ],
  COVER: [
    { specCode: 'SP002', specName: 'INNER DIAMETER (mm)', shortLabel: 'ID', uom: 'mm', defaultValue: '', isLinked: true, linkSource: 'TUBE OD', formulaText: 'Ambil dari Lapisan Sebelumnya (OD)' },
    { specCode: 'SP003', specName: 'OUTER DIAMETER (mm)', shortLabel: 'OD', uom: 'mm', defaultValue: '', isCalculated: true, calcKey: 'cover_od', formulaText: 'Rumus: ID + (2 × Thick)' },
    { specCode: 'SP005', specName: 'THICKNESS (mm)', shortLabel: 'Thick', uom: 'mm', defaultValue: '', formulaText: 'Input Manual (mm)' },
    { specCode: 'SP006', specName: 'WEIGHT/M (kg)', shortLabel: 'Berat/M', uom: 'Kg', defaultValue: '', isCalculated: true, calcKey: 'cover_weight', formulaText: 'Rumus: π × ((OD²-ID²)/4) × SG × 10⁻³ × Panjang' },
    { specCode: 'SP007', specName: 'PRICE/M (Rp)', shortLabel: 'Harga/M', uom: 'Rp', defaultValue: '', isCalculated: true, calcKey: 'cover_cost', formulaText: 'Rumus: Berat/M × Harga Compound' },
  ],
  YARN: [
    { specCode: 'SP002', specName: 'INNER DIAMETER (mm)', shortLabel: 'ID', uom: 'mm', defaultValue: '', isLinked: true, linkSource: 'TUBE OD', formulaText: 'Ambil dari Lapisan Sebelumnya (OD)' },
    { specCode: 'SP003', specName: 'OUTER DIAMETER (mm)', shortLabel: 'OD', uom: 'mm', defaultValue: '', isCalculated: true, calcKey: 'yarn_od', formulaText: 'Rumus: ID + (4 × P)' },
    { specCode: 'SP005', specName: 'THICKNESS (mm)', shortLabel: 'P', uom: 'mm', defaultValue: '', formulaText: 'Pitch / Tebal P (mm)' },
    { specCode: 'SP0013', specName: 'DENIER (D)', shortLabel: 'Denier', uom: 'D', defaultValue: '', formulaText: 'Ukuran Benang (Contoh: 1100, 300)' },
    { specCode: 'SP0014', specName: 'CARRIER (KLOS)', shortLabel: 'Carrier', uom: 'Strands', defaultValue: '', formulaText: 'Jumlah Klos Benang (Contoh: 24, 18)' },
    { specCode: 'SP0015', specName: 'BRAID ANGLE (DEG)', shortLabel: 'Sudut (°)', uom: 'Deg', defaultValue: '40', formulaText: 'Sudut Anyaman Mesin (Default: 40°)' },
    { specCode: 'SP006', specName: 'WEIGHT/M (kg)', shortLabel: 'Berat/M', uom: 'Kg', defaultValue: '', isCalculated: true, calcKey: 'yarn_weight', formulaText: 'Rumus: (Denier×Klos/9.000.000)/cos(Sudut)/(1-Loss)' },
    { specCode: 'SP007', specName: 'PRICE/M (Rp)', shortLabel: 'Harga/M', uom: 'Rp', defaultValue: '', isCalculated: true, calcKey: 'yarn_cost', formulaText: 'Rumus: Berat/M × Harga Benang' },
  ],
  SPRING: [
    { specCode: 'SP005', specName: 'THICKNESS (mm)', shortLabel: 'Tebal Kawat', uom: 'mm', defaultValue: '2', formulaText: 'Diameter Kawat Baja (Contoh: 2 mm)' },
    { specCode: 'SP0016', specName: 'PITCH (mm)', shortLabel: 'Jarak Kawat', uom: 'mm', defaultValue: '5', formulaText: 'Jarak Spasi Antar Kawat (Contoh: 5 mm)' },
    { specCode: 'SP004', specName: 'LENGTH (M)', shortLabel: 'Panjang Kawat', uom: 'M', defaultValue: '', isCalculated: true, calcKey: 'spring_length', formulaText: 'Rumus: (1000/(Jarak+Tebal)) × (OD × π / 1000)' },
    { specCode: 'SP006', specName: 'WEIGHT/M (kg)', shortLabel: 'Berat Kawat', uom: 'Kg', defaultValue: '', isCalculated: true, calcKey: 'spring_weight', formulaText: 'Rumus: (Tebal² × π × 7.8 × Panjang) / 4000' },
    { specCode: 'SP007', specName: 'PRICE/M (Rp)', shortLabel: 'Harga Kawat', uom: 'Rp', defaultValue: '', isCalculated: true, calcKey: 'spring_cost', formulaText: 'Rumus: Berat Kawat × Harga Kawat/kg' },
  ],
  ROD: [
    { specCode: 'SP005', specName: 'THICKNESS (mm)', shortLabel: 'OD Rod', uom: 'mm', defaultValue: '6', formulaText: 'Diameter Rod Rigid (Contoh: 6 mm)' },
    { specCode: 'SP0016', specName: 'PITCH (mm)', shortLabel: 'Pitch', uom: 'mm', defaultValue: '10', formulaText: 'Pitch Spiral Rod (Contoh: 10 mm)' },
    { specCode: 'SP004', specName: 'LENGTH (M)', shortLabel: 'Panjang Rod', uom: 'M', defaultValue: '', isCalculated: true, calcKey: 'rod_length', formulaText: 'Rumus: (Tube ID + 1) × π × (1000/Pitch) / 1000' },
    { specCode: 'SP006', specName: 'WEIGHT/M (kg)', shortLabel: 'Berat Rod', uom: 'Kg', defaultValue: '', isCalculated: true, calcKey: 'rod_weight', formulaText: 'Rumus: (OD_Rod/2)² × π × SG_Rod × Panjang / 1000' },
    { specCode: 'SP007', specName: 'PRICE/M (Rp)', shortLabel: 'Harga Rod', uom: 'Rp', defaultValue: '', isCalculated: true, calcKey: 'rod_cost', formulaText: 'Rumus: Berat Rod × Harga Compound Rod' },
  ],
  HOSE: [
    { specCode: 'SP006', specName: 'WEIGHT/M (kg)', shortLabel: 'Berat/M', uom: 'Kg', defaultValue: '', isCalculated: true, calcKey: 'hose_weight', formulaText: 'Rumus: Akumulasi seluruh lapisan fisik aktif (kg)' },
  ],
  BAHAN_BAKU: [
    { specCode: 'SP008', specName: 'PRICE EXCLUDE/M (Rp)', shortLabel: 'Harga Exclude/M', uom: 'Rp', defaultValue: '', isCalculated: true, calcKey: 'mat_price_exclude', formulaText: 'Rumus: Total Biaya Material Exclude PPN' },
    { specCode: 'SP009', specName: 'PRICE INCLUDE/M (Rp)', shortLabel: 'Harga Include/M', uom: 'Rp', defaultValue: '', isCalculated: true, calcKey: 'mat_price_include', formulaText: 'Rumus: Exclude × 1,11 (PPN 11%)' },
  ],
}

export interface HosePresetDef {
  id: string
  name: string
  layers: Array<{ key: string; code: string; name: string }>
}

const HOSE_PRESETS: HosePresetDef[] = [
  {
    id: 'STANDAR_3L',
    name: 'Selang Anyam 3-Layer (Hyprex / Benang)',
    layers: [
      { key: 'SPEC', code: 'LY001', name: 'SPEC' },
      { key: 'TUBE', code: 'LY002', name: 'TUBE' },
      { key: 'YARN', code: 'LY004', name: 'YARN' },
      { key: 'COVER', code: 'LY003', name: 'COVER' },
      { key: 'HOSE', code: 'LY005', name: 'HOSE' },
      { key: 'BAHAN_BAKU', code: 'LY007', name: 'BAHAN BAKU MATERIAL' },
    ],
  },
  {
    id: 'LPG_4L',
    name: 'Selang LPG 4-Layer (Tube + Cover Tengah + Benang + Cover Luar)',
    layers: [
      { key: 'SPEC', code: 'LY001', name: 'SPEC' },
      { key: 'TUBE', code: 'LY002', name: 'TUBE' },
      { key: 'COVER_TUBE', code: 'LY006', name: 'COVER TUBE' },
      { key: 'YARN', code: 'LY004', name: 'YARN' },
      { key: 'COVER', code: 'LY003', name: 'COVER' },
      { key: 'HOSE', code: 'LY005', name: 'HOSE' },
      { key: 'BAHAN_BAKU', code: 'LY007', name: 'BAHAN BAKU MATERIAL' },
    ],
  },
  {
    id: 'SPRING_HOSE',
    name: 'Selang Spring (Tube + Kawat Baja Spiral)',
    layers: [
      { key: 'SPEC', code: 'LY001', name: 'SPEC' },
      { key: 'TUBE', code: 'LY002', name: 'TUBE' },
      { key: 'SPRING', code: 'LY009', name: 'SPRING' },
      { key: 'HOSE', code: 'LY005', name: 'HOSE' },
      { key: 'BAHAN_BAKU', code: 'LY007', name: 'BAHAN BAKU MATERIAL' },
    ],
  },
  {
    id: 'SPIRAL_ROD',
    name: 'Selang Spiral (Tube + Rod PVC Rigid)',
    layers: [
      { key: 'SPEC', code: 'LY001', name: 'SPEC' },
      { key: 'TUBE', code: 'LY002', name: 'TUBE' },
      { key: 'ROD', code: 'LY008', name: 'ROD' },
      { key: 'HOSE', code: 'LY005', name: 'HOSE' },
      { key: 'BAHAN_BAKU', code: 'LY007', name: 'BAHAN BAKU MATERIAL' },
    ],
  },
  {
    id: 'SINGLE_DOF',
    name: 'Selang Single Layer (Dof)',
    layers: [
      { key: 'SPEC', code: 'LY001', name: 'SPEC' },
      { key: 'TUBE', code: 'LY002', name: 'TUBE' },
      { key: 'HOSE', code: 'LY005', name: 'HOSE' },
      { key: 'BAHAN_BAKU', code: 'LY007', name: 'BAHAN BAKU MATERIAL' },
    ],
  },
]

const selectedHosePresetId = ref('STANDAR_3L')
const DEFAULT_LAYER_ORDER = HOSE_PRESETS[0].layers

const findLayerItem = (code: string, name: string) => {
  const codeL = code.toLowerCase().trim()
  const nameL = name.toLowerCase().trim()
  return rawLayers.value.find((l: any) =>
    (l.key1 || '').toLowerCase().trim() === codeL ||
    (l.code || '').toLowerCase().trim() === codeL
  ) || rawLayers.value.find((l: any) =>
    (l.value1 || '').toLowerCase().trim() === nameL
  ) || rawLayers.value.find((l: any) => {
    const val = (l.value1 || '').toLowerCase().trim()
    if (nameL === 'cover' && val.includes('cover tube')) return false
    if (nameL === 'tube' && val.includes('cover tube')) return false
    return val.includes(nameL)
  })
}

const findSpecItem = (code: string, name: string) => {
  const codeL = code.toLowerCase().trim()
  const nameL = name.toLowerCase().trim()
  return rawSpecs.value.find((s: any) =>
    (s.key1 || '').toLowerCase().trim() === codeL ||
    (s.code || '').toLowerCase().trim() === codeL
  ) || rawSpecs.value.find((s: any) =>
    (s.value1 || '').toLowerCase().trim() === nameL
  ) || rawSpecs.value.find((s: any) => {
    const val = (s.value1 || '').toLowerCase().trim()
    if (nameL.includes('denier') && val.includes('denier')) return true
    if (nameL.includes('carrier') && (val.includes('carrier') || val.includes('klos'))) return true
    if (nameL.includes('angle') && (val.includes('angle') || val.includes('sudut'))) return true
    if (nameL.includes('pitch') && val.includes('pitch')) return true
    return val.includes(nameL)
  })
}

const findUomItem = (uomName: string) => {
  const uL = uomName.toLowerCase().trim()
  return rawUoms.value.find((u: any) =>
    (u.value1 || '').toLowerCase().trim() === uL
  )
}

const getLayerBadgeClass = (display: string) => {
  const k = getLayerKeyFromDisplay(display)
  switch (k) {
    case 'SPEC':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
    case 'TUBE':
      return 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700'
    case 'COVER_TUBE':
      return 'bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-700'
    case 'YARN':
      return 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-700'
    case 'SPRING':
      return 'bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-700'
    case 'ROD':
      return 'bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-700'
    case 'COVER':
      return 'bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-700'
    case 'HOSE':
      return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-muted dark:text-slate-200 dark:border-slate-700'
    case 'BAHAN_BAKU':
      return 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700'
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-muted dark:text-slate-300'
  }
}

const physicalLayers = computed(() => {
  return layerGroups.value.filter(g => {
    const k = getLayerKeyFromDisplay(g.layer_display)
    return k !== 'SPEC' && k !== 'HOSE' && k !== 'BAHAN_BAKU'
  })
})

const getPhysicalLayerNumber = (grp: LayerGroupRow) => {
  const idx = physicalLayers.value.findIndex(g => g.local_id === grp.local_id)
  return idx >= 0 ? idx + 1 : null
}

const getLayerRoleName = (display: string, grp?: LayerGroupRow) => {
  const k = getLayerKeyFromDisplay(display)
  switch (k) {
    case 'SPEC':
      return 'Dimensi Produk (Header)'
    case 'TUBE': {
      const num = grp ? getPhysicalLayerNumber(grp) : 1
      return `Lapisan Fisik #${num ?? 1} (Inner Tube)`
    }
    case 'COVER_TUBE': {
      const num = grp ? getPhysicalLayerNumber(grp) : 2
      return `Lapisan Fisik #${num ?? 2} (Cover Tengah)`
    }
    case 'YARN': {
      const num = grp ? getPhysicalLayerNumber(grp) : 2
      return `Lapisan Fisik #${num ?? 2} (Anyaman Benang)`
    }
    case 'SPRING': {
      const num = grp ? getPhysicalLayerNumber(grp) : 2
      return `Lapisan Fisik #${num ?? 2} (Kawat Baja Spiral)`
    }
    case 'ROD': {
      const num = grp ? getPhysicalLayerNumber(grp) : 2
      return `Lapisan Fisik #${num ?? 2} (Rod PVC Rigid)`
    }
    case 'COVER': {
      const num = grp ? getPhysicalLayerNumber(grp) : 3
      return `Lapisan Fisik #${num ?? 3} (Outer Cover)`
    }
    case 'HOSE':
      return 'Ringkasan: Total Berat Selang'
    case 'BAHAN_BAKU':
      return 'Ringkasan: Total Biaya Material'
    default:
      return 'Lapisan Tambahan'
  }
}

// ============================================================================
// KALKULASI COMPOUND & MATERIAL (PHR, VOLUME, SG, HARGA BB)
// ============================================================================
const baseResinKg = computed(() => {
  const mains = detailArr.value.filter((d) => d.is_main === true)
  return round2(mains.reduce((sum, d) => sum + (Number(d.qty) || 0), 0))
})

const getMatActual = (d: any): number => {
  if (d?.berat_bersih != null && d.berat_bersih !== '') return Number(d.berat_bersih)
  if (d?.m_item?.berat_bersih != null && d.m_item.berat_bersih !== '') return Number(d.m_item.berat_bersih)
  return 0
}

const getMatBeratJenis = (d: any): number => {
  if (d?.berat_jenis != null && d.berat_jenis !== 0 && d.berat_jenis !== '') return Number(d.berat_jenis)
  if (d?.m_item?.berat_jenis != null && d.m_item.berat_jenis !== '') return Number(d.m_item.berat_jenis)
  return 0
}

const getMatVolume = (d: any): number => {
  if (d?.volume !== undefined && d?.volume !== null && d?.volume !== '' && !isNaN(Number(d.volume)) && Number(d.volume) > 0) {
    return Number(d.volume)
  }
  const kg = Number(d.qty) || 0
  const sg = getMatBeratJenis(d)
  if (sg <= 0) return 0
  return Number((kg / sg).toFixed(3))
}

const getMatPhr = (d: any): number => {
  const kg = Number(d.qty) || 0
  if (baseResinKg.value <= 0) return 0
  return round2((kg / baseResinKg.value) * 100)
}

const batchWeightKg = computed(() => {
  return round2(detailArr.value.reduce((sum, d) => sum + (Number(d.qty) || 0), 0))
})

const totalVolume = computed(() => {
  return round2(
    detailArr.value.reduce((sum, d) => sum + (getMatVolume(d) || 0), 0)
  )
})

const totalHargaMaterial = computed(() => {
  return round2(detailArr.value.reduce((sum, d) => sum + (Number(d.amount) || (Number(d.qty) || 0) * (Number(d.price) || 0)), 0))
})

const sgCompound = computed(() => {
  if (!totalVolume.value || totalVolume.value <= 0) return 0
  return Number((batchWeightKg.value / totalVolume.value).toFixed(4))
})

const hargaPerKgCompound = computed(() => {
  if (!batchWeightKg.value || batchWeightKg.value <= 0) return 0
  return round2(totalHargaMaterial.value / batchWeightKg.value)
})

/** Daftar material yang belum memiliki Berat Jenis (SG) di Master Item */
const materialsWithoutSg = computed(() => {
  return detailArr.value.filter((d) => d.m_item_id && getMatBeratJenis(d) <= 0)
})

/**
 * Parse angka dengan dukungan koma maupun titik dan pecahan (misal 3/8)
 */
const parseCommaNumber = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0
  let str = String(val).trim()
  if (str.includes('/')) {
    const parts = str.split('/')
    if (parts.length === 2 && parts[0] && parts[1]) {
      const num = parseFloat(parts[0].replace(',', '.'))
      const den = parseFloat(parts[1].replace(',', '.'))
      if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den
    }
  }
  str = str.replace(',', '.')
  const n = parseFloat(str)
  return isNaN(n) ? 0 : n
}

const formatCommaNumber = (num: number | string, maxDecimals = 4): string => {
  if (num === undefined || num === null || num === '') return ''
  const parsed = typeof num === 'number' ? num : parseCommaNumber(num)
  if (isNaN(parsed)) return ''
  if (parsed === 0) return '0'
  const rounded = Number(parsed.toFixed(maxDecimals))
  return String(rounded).replace('.', ',')
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Formula panel state */
const showFormulaPanel = ref(false)
const formulaSgTube        = ref(1.30)   // SG Tube compound (default Excel)
const formulaSgCoverTube    = ref(1.466)  // SG Cover Tube / Middle compound (default Excel LPG Rp 20.198 / SG 1.466)
const formulaSgCover       = ref(1.08)   // SG Cover compound (default Excel)
const formulaSgRod         = ref(1.408)  // SG Rod spiral compound (default Excel Rod SG 1.408)
const formulaHargaTube     = ref(23238)  // Harga perkilo tube compound
const formulaHargaCoverTube = ref(20198)  // Harga perkilo cover tube compound
const formulaHargaCover    = ref(34814)  // Harga perkilo cover compound
const formulaHargaRod      = ref(22858)  // Harga perkilo rod compound
const formulaHargaWire     = ref(100000) // Harga kawat spring/kg (default Rp 100.000)
const formulaHargaYarn     = ref(60000)  // Harga benang PET/kg (default Rp 60.000)

const selectedChemicalTubeId = ref('')
const selectedChemicalTubeData = ref<any>(null)
const selectedChemicalCoverTubeId = ref('')
const selectedChemicalCoverTubeData = ref<any>(null)
const selectedChemicalCoverId = ref('')
const selectedChemicalCoverData = ref<any>(null)
const selectedChemicalRodId = ref('')
const selectedChemicalRodData = ref<any>(null)

const onFormulaSgTubeChange = (val: any) => {
  formulaSgTube.value = Number(val) || 0
  autoChainHoseParams()
  syncGroupsToSpekArr()
  syncSpekToMaterialQuantities()
}

const onFormulaSgCoverChange = (val: any) => {
  formulaSgCover.value = Number(val) || 0
  autoChainHoseParams()
  syncGroupsToSpekArr()
  syncSpekToMaterialQuantities()
}

const onFormulaHargaTubeChange = (val: any) => {
  formulaHargaTube.value = Number(val) || 0
  autoChainHoseParams()
  syncGroupsToSpekArr()
  syncSpekToMaterialQuantities()
}

const onFormulaHargaCoverChange = (val: any) => {
  formulaHargaCover.value = Number(val) || 0
  autoChainHoseParams()
  syncGroupsToSpekArr()
  syncSpekToMaterialQuantities()
}

const handleChemicalTubeSelected = (item: any) => {
  if (item && item.id) {
    selectedChemicalTubeId.value = item.id
    selectedChemicalTubeData.value = item
    if (item.sg_compound !== undefined && item.sg_compound !== null && Number(item.sg_compound) > 0) {
      formulaSgTube.value = Number(item.sg_compound)
    }
    if (item.harga_per_kg_compound !== undefined && item.harga_per_kg_compound !== null && Number(item.harga_per_kg_compound) > 0) {
      formulaHargaTube.value = Number(item.harga_per_kg_compound)
    }
  } else {
    selectedChemicalTubeId.value = ''
    selectedChemicalTubeData.value = null
  }
  autoChainHoseParams()
  syncGroupsToSpekArr()
  syncSpekToMaterialQuantities()
}

const handleChemicalCoverSelected = (item: any) => {
  if (item && item.id) {
    selectedChemicalCoverId.value = item.id
    selectedChemicalCoverData.value = item
    if (item.sg_compound !== undefined && item.sg_compound !== null && Number(item.sg_compound) > 0) {
      formulaSgCover.value = Number(item.sg_compound)
    }
    if (item.harga_per_kg_compound !== undefined && item.harga_per_kg_compound !== null && Number(item.harga_per_kg_compound) > 0) {
      formulaHargaCover.value = Number(item.harga_per_kg_compound)
    }
  } else {
    selectedChemicalCoverId.value = ''
    selectedChemicalCoverData.value = null
  }
  autoChainHoseParams()
  syncGroupsToSpekArr()
  syncSpekToMaterialQuantities()
}

const onHargaSekaliMasakChange = (val: any) => {
  const num = Number(val) || 0
  values.harga_per_kg_compound = num
  if (isTypeSpesifik.value) {
    if (formulaHargaTube.value === 0 || formulaHargaTube.value === 23238) {
      formulaHargaTube.value = num
    }
    autoChainHoseParams()
    syncGroupsToSpekArr()
    syncSpekToMaterialQuantities()
  }
}

const SPEK_ALIASES: Record<string, string[]> = {
  id: ['inner diameter', 'inner dia', 'diameter dalam', 'id', 'i.d', 'i.d.'],
  od: ['outer diameter', 'outer dia', 'diameter luar', 'od', 'o.d', 'o.d.'],
  thick: ['thickness', 'thick', 'tebal', 'ketebalan', 'wall thickness', 'wall thick'],
  length: ['length', 'panjang'],
  weight: ['weight', 'berat'],
  price: ['price', 'harga'],
}

const getLayerKeyFromDisplay = (name: string): string => {
  const n = (name || '').toLowerCase().trim()
  if (n === 'spec' || n.includes('ukuran')) return 'SPEC'
  if (n.includes('cover tube') || n.includes('cover tengah') || n.includes('middle') || n.includes('ct-') || n.includes('ly006')) return 'COVER_TUBE'
  if (n.includes('spring') || n.includes('kawat') || n.includes('ly009')) return 'SPRING'
  if (n.includes('rod') || n.includes('spiral') || n.includes('ly008')) return 'ROD'
  if (n === 'tube' || (n.includes('tube') && !n.includes('cover'))) return 'TUBE'
  if (n === 'cover' || (n.includes('cover') && !n.includes('tube'))) return 'COVER'
  if (n.includes('yarn') || n.includes('benang') || n.includes('braid')) return 'YARN'
  if (n.includes('hose') || n.includes('selang')) return 'HOSE'
  if (n.includes('bahan') || n.includes('material') || n.includes('baku')) return 'BAHAN_BAKU'
  return ''
}

const getShortParamLabel = (fullName: string): string => {
  const n = (fullName || '').toLowerCase().trim()
  if (n.includes('size') || n.includes('ukuran')) return 'Ukuran'
  if (n.includes('inner') || n.includes('id') || n.includes('dalam')) return 'ID'
  if (n.includes('outer') || n.includes('od') || n.includes('luar')) return 'OD'
  if (n.includes('length') || n.includes('panjang')) return 'Panjang'
  if (n.includes('thick') || n.includes('tebal')) return 'Thick'
  if (n.includes('weight') || n.includes('berat')) return 'Berat/M'
  if (n.includes('exclude')) return 'Harga Exclude/M'
  if (n.includes('include')) return 'Harga Include/M'
  if (n.includes('price') || n.includes('harga')) return 'Harga/M'
  if (n.includes('denier')) return 'Denier'
  if (n.includes('carrier') || n.includes('klos')) return 'Carrier'
  if (n.includes('angle') || n.includes('sudut')) return 'Sudut (°)'
  if (n.includes('pitch')) return 'Pitch'
  return fullName || 'Parameter'
}

/**
 * Helper untuk menampilkan keterangan asal usul / rumus parameter (persis BOM & Excel)
 */
const getFormulaDesc = (grp: LayerGroupRow, p: LayerGroupParam): string => {
  if (p.formula_text) return p.formula_text
  const grpKey = getLayerKeyFromDisplay(grp.layer_display)
  const pName = (p.nama_parameter_display || spekMap.value[p.nama_parameter] || '').toLowerCase()

  if (p.is_linked) {
    if (p.link_source) return `Ambil dari ${p.link_source}`
    if (grpKey === 'SPEC' && pName.includes('inner')) return 'Ambil dari TUBE ID'
    if (grpKey === 'SPEC' && pName.includes('outer')) return 'Ambil dari Lapisan Terluar OD'
    if (grpKey === 'COVER_TUBE' && pName.includes('inner')) return 'Ambil dari TUBE OD'
    if (grpKey === 'COVER' && pName.includes('inner')) return 'Ambil dari OD Lapisan Sebelumnya'
    if (grpKey === 'YARN' && pName.includes('inner')) return 'Ambil dari OD Lapisan Sebelumnya'
    return 'Auto Ambil'
  }

  if (p.is_calculated) {
    if (grpKey === 'TUBE') {
      if (pName.includes('outer') || pName.includes('od')) return 'Rumus: ID + (2 × Thick)'
      if (pName.includes('weight') || pName.includes('berat')) return 'Rumus: π × ((OD²-ID²)/4) × SG × 10⁻³ × Panjang (dikurangi Kawat bila ada Spring)'
      if (pName.includes('price') || pName.includes('harga')) return 'Rumus: Berat/M × Harga Compound'
    }
    if (grpKey === 'COVER_TUBE') {
      if (pName.includes('outer') || pName.includes('od')) return 'Rumus: ID + (2 × Thick)'
      if (pName.includes('weight') || pName.includes('berat')) return 'Rumus: π × ((OD²-ID²)/4) × SG × 10⁻³ × Panjang'
      if (pName.includes('price') || pName.includes('harga')) return 'Rumus: Berat/M × Harga Compound CT'
    }
    if (grpKey === 'COVER') {
      if (pName.includes('outer') || pName.includes('od')) return 'Rumus: ID + (2 × Thick)'
      if (pName.includes('weight') || pName.includes('berat')) return 'Rumus: π × ((OD²-ID²)/4) × SG × 10⁻³ × Panjang'
      if (pName.includes('price') || pName.includes('harga')) return 'Rumus: Berat/M × Harga Compound'
    }
    if (grpKey === 'YARN') {
      if (pName.includes('outer') || pName.includes('od')) return 'Rumus: ID + (4 × P)'
      if (pName.includes('weight') || pName.includes('berat')) return 'Rumus Tekstil: (Denier×Klos/9.000.000)/cos(Sudut)/(1-Loss)'
      if (pName.includes('price') || pName.includes('harga')) return 'Rumus: Berat/M × Harga Benang'
    }
    if (grpKey === 'SPRING') {
      if (pName.includes('length') || pName.includes('panjang')) return 'Rumus: (1000/(Jarak+Tebal)) × (OD × π / 1000)'
      if (pName.includes('weight') || pName.includes('berat')) return 'Rumus: (Tebal² × π × 7.8 × Panjang) / 4000'
      if (pName.includes('price') || pName.includes('harga')) return 'Rumus: Berat Kawat × Harga Kawat/kg'
    }
    if (grpKey === 'ROD') {
      if (pName.includes('length') || pName.includes('panjang')) return 'Rumus: (Tube ID + 1) × π × (1000/Pitch) / 1000'
      if (pName.includes('weight') || pName.includes('berat')) return 'Rumus: (OD_Rod/2)² × π × SG_Rod × Panjang / 1000'
      if (pName.includes('price') || pName.includes('harga')) return 'Rumus: Berat Rod × Harga Compound Rod'
    }
    if (grpKey === 'HOSE') {
      if (pName.includes('weight') || pName.includes('berat')) return 'Rumus: Akumulasi seluruh lapisan fisik (kg)'
    }
    if (grpKey === 'BAHAN_BAKU') {
      if (pName.includes('exclude')) return 'Rumus: Total Biaya Material Exclude PPN'
      if (pName.includes('include')) return 'Rumus: Exclude × 1,11 (PPN 11%)'
    }
    return 'Terhitung Rumus'
  }

  return ''
}

/**
 * Sinkronisasi seluruh layerGroups ke array flat spekArr untuk disimpan ke DB
 */
const syncGroupsToSpekArr = () => {
  const flat: any[] = []
  layerGroups.value.forEach((grp) => {
    grp.params.forEach((p) => {
      const dbValue = p.value !== undefined && p.value !== null && p.value !== ''
        ? String(p.value).trim().replace(',', '.')
        : ''
      flat.push({
        id: p.id,
        layer_id: grp.layer_id,
        layer_display: grp.layer_display || layerMap.value[grp.layer_id] || '',
        param_id: p.nama_parameter,
        param_display: p.nama_parameter_display || spekMap.value[p.nama_parameter] || '',
        value: dbValue ? dbValue.replace('.', ',') : '',
        unit_id: p.satuan,
        unit_display: p.satuan_display || uomMap.value[p.satuan] || '',
        notes: p.notes || '',
        is_calculated: p.is_calculated || false,
        is_linked: p.is_linked || false,
        link_source: p.link_source || '',
        formula_text: p.formula_text || getFormulaDesc(grp, p),
      })
    })
  })
  spekArr.value = flat
}

/**
 * Inisialisasi layerGroups dari spekArr atau template default (SPEC, TUBE, COVER, YARN, HOSE, BAHAN BAKU)
 * Selalu memastikan seluruh 6 lapisan standar seperti di Excel & BOM tersedia.
 */
const initLayerGroups = (forceReset = false) => {
  if (forceReset) {
    selectedHosePresetId.value = 'STANDAR_3L'
  }
  const standardRows: LayerGroupRow[] = []
  const standardMap = new Map<string, LayerGroupRow>()

  DEFAULT_LAYER_ORDER.forEach((def, idx) => {
    const matchedLayer = findLayerItem(def.code, def.name)
    const layerId = matchedLayer?.id || ''
    const layerDisplay = matchedLayer?.value1 || def.name

    const template = LAYER_PARAM_TEMPLATES[def.key] || []
    const params: LayerGroupParam[] = template.map((t) => {
      const matchedSpec = findSpecItem(t.specCode, t.specName)
      const matchedUom = findUomItem(t.uom)
      return {
        nama_parameter: matchedSpec?.id || '',
        nama_parameter_display: matchedSpec?.value1 || t.specName,
        value: t.defaultValue ? String(t.defaultValue).replace('.', ',') : '',
        satuan: matchedUom?.id || '',
        satuan_display: matchedUom?.value1 || t.uom,
        notes: '',
        is_calculated: t.isCalculated || false,
        is_linked: t.isLinked || false,
        link_source: t.linkSource || '',
        calc_key: t.calcKey,
        short_label: t.shortLabel,
        placeholder: '0',
        formula_text: t.formulaText || '',
      }
    })

    const grpRow: LayerGroupRow = {
      local_id: `grp_std_${def.key}_${Date.now()}_${idx}`,
      layer_id: layerId,
      layer_display: layerDisplay,
      params,
    }

    standardRows.push(grpRow)
    standardMap.set(def.key, grpRow)
    if (layerId) standardMap.set(layerId, grpRow)
  })

  if (spekArr.value.length === 0 || forceReset) {
    layerGroups.value = standardRows
    syncGroupsToSpekArr()
    return
  }

  const customGroups: LayerGroupRow[] = []
  const customMap = new Map<string, LayerGroupRow>()

  spekArr.value.forEach((s) => {
    const sLayerId = s.layer_id || ''
    const sLayerName = s.layer_display || layerMap.value[sLayerId] || ''
    const lKey = getLayerKeyFromDisplay(sLayerName)

    let targetGrp = (sLayerId && standardMap.get(sLayerId)) || (lKey && standardMap.get(lKey)) || null

    if (targetGrp) {
      if (sLayerId && !targetGrp.layer_id) {
        targetGrp.layer_id = sLayerId
        targetGrp.layer_display = sLayerName || targetGrp.layer_display
      }

      const sParamId = s.param_id || s.nama_parameter
      const sParamName = (s.param_display || s.nama_parameter_display || spekMap.value[sParamId] || '').toLowerCase()

      const pIdx = targetGrp.params.findIndex((p: LayerGroupParam) => {
        if (sParamId && p.nama_parameter && sParamId === p.nama_parameter) return true
        const pName = (p.nama_parameter_display || spekMap.value[p.nama_parameter] || '').toLowerCase()
        if (sParamName && pName) {
          if (sParamName === pName) return true
          if (sParamName.includes('inner') && pName.includes('inner')) return true
          if (sParamName.includes('outer') && pName.includes('outer')) return true
          if (sParamName.includes('thick') && pName.includes('thick')) return true
        }
        return false
      })

      if (pIdx >= 0) {
        const existingParam = targetGrp.params[pIdx]
        existingParam.id = s.id
        if (s.value !== undefined && s.value !== null && s.value !== '') {
          existingParam.value = String(s.value).replace('.', ',')
        }
        if (s.unit_id || s.satuan) {
          existingParam.satuan = s.unit_id || s.satuan
          existingParam.satuan_display = s.unit_display || s.satuan_display || uomMap.value[existingParam.satuan] || existingParam.satuan_display
        }
        if (s.notes) existingParam.notes = s.notes
      } else {
        targetGrp.params.push({
          id: s.id,
          nama_parameter: sParamId,
          nama_parameter_display: s.param_display || s.nama_parameter_display || spekMap.value[sParamId] || '',
          value: s.value !== undefined && s.value !== null && s.value !== '' ? String(s.value).replace('.', ',') : '',
          satuan: s.unit_id || s.satuan || '',
          satuan_display: s.unit_display || s.satuan_display || uomMap.value[s.unit_id || s.satuan] || '',
          notes: s.notes || '',
          is_calculated: false,
          short_label: getShortParamLabel(s.param_display || s.nama_parameter_display || spekMap.value[sParamId] || ''),
        })
      }
    } else {
      const cKey = sLayerId || sLayerName
      let custGrp = customMap.get(cKey)
      if (!custGrp) {
        custGrp = {
          local_id: `grp_cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          layer_id: sLayerId,
          layer_display: sLayerName,
          params: [],
        }
        customMap.set(cKey, custGrp)
        customGroups.push(custGrp)
      }

      custGrp.params.push({
        id: s.id,
        nama_parameter: s.param_id || s.nama_parameter,
        nama_parameter_display: s.param_display || s.nama_parameter_display || spekMap.value[s.param_id || s.nama_parameter] || '',
        value: s.value !== undefined && s.value !== null && s.value !== '' ? String(s.value).replace('.', ',') : '',
        satuan: s.unit_id || s.satuan || '',
        satuan_display: s.unit_display || s.satuan_display || uomMap.value[s.unit_id || s.satuan] || '',
        notes: s.notes || '',
        is_calculated: false,
        short_label: getShortParamLabel(s.param_display || s.nama_parameter_display || spekMap.value[s.param_id || s.nama_parameter] || ''),
      })
    }
  })

  layerGroups.value = [...standardRows, ...customGroups]
  autoChainHoseParams()
  syncGroupsToSpekArr()
}

/** Terapkan preset standar 6 layer selang (SPEC, TUBE, COVER, YARN, HOSE, BAHAN BAKU) */
const applyStandardSpekPreset = () => {
  if (layerGroups.value.length > 0) {
    if (!confirm('Ganti detail spek yang ada dengan preset standar 6 layer selang?')) {
      return
    }
  }
  initLayerGroups(true)
  toast.success('Preset standar 6 layer selang berhasil dimuat')
}

/** Tambah baris lapisan baru ke bawah */
const addLayerGroup = () => {
  layerGroups.value.push({
    local_id: `grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    layer_id: '',
    layer_display: '',
    params: [],
  })
  syncGroupsToSpekArr()
  toast.info('Lapisan layer baru berhasil ditambahkan.')
}

/** Hapus baris lapisan */
const removeLayerGroup = (idx: number) => {
  layerGroups.value.splice(idx, 1)
  autoChainHoseParams()
  syncGroupsToSpekArr()
  syncSpekToMaterialQuantities()
  syncSpekWeightToQty()
  toast.success('Lapisan layer berhasil dihapus.')
}

// ============================================================================
// DRAG & DROP & GESER URUTAN (SEQUENCE) LAPISAN LAYER & PARAMETER
// ============================================================================
const draggedLayerIndex = ref<number | null>(null)
const dropTargetLayerIndex = ref<number | null>(null)

const onLayerDragStart = (e: DragEvent, index: number) => {
  if (isReadOnly.value) return
  draggedLayerIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `layer:${index}`)
  }
}

const onLayerDragOver = (e: DragEvent, index: number) => {
  if (draggedLayerIndex.value === null || draggedLayerIndex.value === index) return
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  dropTargetLayerIndex.value = index
}

const onLayerDragLeave = () => {
  dropTargetLayerIndex.value = null
}

const onLayerDrop = (targetIndex: number) => {
  if (draggedLayerIndex.value === null || draggedLayerIndex.value === targetIndex) {
    draggedLayerIndex.value = null
    dropTargetLayerIndex.value = null
    return
  }

  const fromIdx = draggedLayerIndex.value
  const items = [...layerGroups.value]
  const [draggedItem] = items.splice(fromIdx, 1)
  if (draggedItem) {
    items.splice(targetIndex, 0, draggedItem)
    layerGroups.value = items
    autoChainHoseParams()
    syncGroupsToSpekArr()
    syncSpekToMaterialQuantities()
    syncSpekWeightToQty()
    calculateCosts()
    const layerName = draggedItem.layer_display || `Layer #${targetIndex + 1}`
    toast.success(`Urutan "${layerName}" dipindahkan dari posisi ${fromIdx + 1} ke posisi ${targetIndex + 1}`)
  }

  draggedLayerIndex.value = null
  dropTargetLayerIndex.value = null
}

const moveLayerUp = (index: number) => {
  if (index <= 0 || isReadOnly.value) return
  const items = [...layerGroups.value]
  const [item] = items.splice(index, 1)
  if (item) {
    items.splice(index - 1, 0, item)
    layerGroups.value = items
    autoChainHoseParams()
    syncGroupsToSpekArr()
    syncSpekToMaterialQuantities()
    syncSpekWeightToQty()
    calculateCosts()
  }
}

const moveLayerDown = (index: number) => {
  if (index >= layerGroups.value.length - 1 || isReadOnly.value) return
  const items = [...layerGroups.value]
  const [item] = items.splice(index, 1)
  if (item) {
    items.splice(index + 1, 0, item)
    layerGroups.value = items
    autoChainHoseParams()
    syncGroupsToSpekArr()
    syncSpekToMaterialQuantities()
    syncSpekWeightToQty()
    calculateCosts()
  }
}

// Drag & drop antar / dalam parameter kartu
const draggedParamInfo = ref<{ grpIdx: number; paramIdx: number } | null>(null)
const dropTargetParamInfo = ref<{ grpIdx: number; paramIdx: number } | null>(null)

const onParamDragStart = (e: DragEvent, grpIdx: number, paramIdx: number) => {
  if (isReadOnly.value) return
  e.stopPropagation()
  draggedParamInfo.value = { grpIdx, paramIdx }
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `param:${grpIdx}:${paramIdx}`)
  }
}

const onParamDragOver = (e: DragEvent, grpIdx: number, paramIdx: number) => {
  if (!draggedParamInfo.value) return
  if (draggedParamInfo.value.grpIdx === grpIdx && draggedParamInfo.value.paramIdx === paramIdx) return
  e.preventDefault()
  e.stopPropagation()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
  dropTargetParamInfo.value = { grpIdx, paramIdx }
}

const onParamDragLeave = () => {
  dropTargetParamInfo.value = null
}

const onParamDrop = (grpIdx: number, targetPIdx: number) => {
  if (!draggedParamInfo.value) return
  const { grpIdx: fromGIdx, paramIdx: fromPIdx } = draggedParamInfo.value

  if (fromGIdx === grpIdx && fromPIdx === targetPIdx) {
    draggedParamInfo.value = null
    dropTargetParamInfo.value = null
    return
  }

  const sourceGrp = layerGroups.value[fromGIdx]
  const targetGrp = layerGroups.value[grpIdx]
  if (sourceGrp && targetGrp) {
    const [movedParam] = sourceGrp.params.splice(fromPIdx, 1)
    if (movedParam) {
      targetGrp.params.splice(targetPIdx, 0, movedParam)
      autoChainHoseParams()
      syncGroupsToSpekArr()
      syncSpekToMaterialQuantities()
      syncSpekWeightToQty()
      toast.success('Posisi parameter berhasil diubah')
    }
  }

  draggedParamInfo.value = null
  dropTargetParamInfo.value = null
}

/** Handler ketika dropdown layer diganti */
const onLayerChange = (grp: LayerGroupRow, newLayerId: string, itemFull?: any) => {
  grp.layer_id = newLayerId
  const lDisplay = itemFull?.value1 || layerMap.value[newLayerId] || ''
  grp.layer_display = lDisplay

  const key = getLayerKeyFromDisplay(lDisplay)
  const template = LAYER_PARAM_TEMPLATES[key]
  if (template && template.length > 0) {
    const existingValByLabel = new Map<string, string>()
    grp.params.forEach(p => {
      const k = (p.short_label || p.nama_parameter_display || '').toLowerCase()
      if (p.value !== undefined && p.value !== null && p.value !== '') {
        existingValByLabel.set(k, p.value)
      }
    })

    grp.params = template.map((t) => {
      const matchedSpec = findSpecItem(t.specCode, t.specName)
      const matchedUom = findUomItem(t.uom)
      const existingVal = existingValByLabel.get((t.shortLabel || t.specName).toLowerCase())
      return {
        nama_parameter: matchedSpec?.id || '',
        nama_parameter_display: matchedSpec?.value1 || t.specName,
        value: existingVal !== undefined ? existingVal : (t.defaultValue ? String(t.defaultValue).replace('.', ',') : ''),
        satuan: matchedUom?.id || '',
        satuan_display: matchedUom?.value1 || t.uom,
        notes: '',
        is_calculated: t.isCalculated || false,
        is_linked: t.isLinked || false,
        link_source: t.linkSource || '',
        calc_key: t.calcKey,
        short_label: t.shortLabel,
        placeholder: '0',
        formula_text: t.formulaText || '',
      }
    })
    toast.info(`Parameter standar untuk layer ${lDisplay} telah dimuat otomatis.`)
  }

  syncGroupsToSpekArr()
  autoChainHoseParams()
  syncSpekToMaterialQuantities()
  syncSpekWeightToQty()
}

/** Tambah parameter ke suatu layer */
const addParamToGroup = (grp: LayerGroupRow) => {
  grp.params.push({
    nama_parameter: '',
    nama_parameter_display: '',
    value: '',
    satuan: '',
    satuan_display: '',
    notes: '',
    is_calculated: false,
    short_label: '',
    placeholder: '0',
  })
  syncGroupsToSpekArr()
}

/** Hapus parameter dari suatu layer */
const removeParamFromGroup = (grp: LayerGroupRow, pIdx: number) => {
  grp.params.splice(pIdx, 1)
  autoChainHoseParams()
  syncGroupsToSpekArr()
  syncSpekToMaterialQuantities()
  syncSpekWeightToQty()
}

/** Handler ketika parameter spek diubah dari dropdown m_spec */
const onParamChangeInGroup = (p: LayerGroupParam, paramId: string, itemFull?: any, grp?: LayerGroupRow) => {
  p.nama_parameter = paramId
  p.nama_parameter_display = itemFull?.value1 || spekMap.value[paramId] || ''
  p.short_label = getShortParamLabel(p.nama_parameter_display)

  const lower = (p.nama_parameter_display || '').toLowerCase()
  const lKey = grp ? getLayerKeyFromDisplay(grp.layer_display) : ''

  if (lower.includes('weight') || lower.includes('berat') || lower.includes('price') || lower.includes('harga') || lower.includes('exclude') || lower.includes('include')) {
    p.is_calculated = true
    p.is_linked = false
    p.link_source = ''
  } else if ((lKey === 'TUBE' || lKey === 'COVER' || lKey === 'YARN') && (lower.includes('outer') || lower.includes('od'))) {
    p.is_calculated = true
    p.is_linked = false
    p.link_source = ''
  } else if (lKey === 'SPEC' && (lower.includes('inner') || lower.includes('id'))) {
    p.is_linked = true
    p.is_calculated = false
    p.link_source = 'TUBE ID'
  } else if (lKey === 'SPEC' && (lower.includes('outer') || lower.includes('od'))) {
    p.is_linked = true
    p.is_calculated = false
    p.link_source = 'COVER OD'
  } else if ((lKey === 'COVER' || lKey === 'YARN') && (lower.includes('inner') || lower.includes('id'))) {
    p.is_linked = true
    p.is_calculated = false
    p.link_source = 'TUBE OD'
  } else {
    p.is_calculated = false
    p.is_linked = false
    p.link_source = ''
  }

  if (!p.satuan) {
    if (lower.includes('diameter') || lower.includes('thick') || lower.includes('tebal') || lower.includes('size') || lower.includes('id') || lower.includes('od') || lower.includes('panjang')) {
      const mm = Object.entries(uomMap.value).find(([_, v]) => (v || '').toLowerCase() === 'mm')
      if (mm) { p.satuan = mm[0]; p.satuan_display = mm[1] }
    } else if (lower.includes('weight') || lower.includes('berat')) {
      const kg = Object.entries(uomMap.value).find(([_, v]) => (v || '').toLowerCase() === 'kg')
      if (kg) { p.satuan = kg[0]; p.satuan_display = kg[1] }
    }
  }

  syncGroupsToSpekArr()
}

/** Handler ketika satuan parameter diubah dari dropdown UOM */
const onParamUomChange = (p: LayerGroupParam, uomId: string, itemFull?: any) => {
  p.satuan = uomId
  p.satuan_display = itemFull?.value1 || uomMap.value[uomId] || ''
  syncGroupsToSpekArr()
}

/**
 * Sinkronisasi otomatis antar layer (fleksibel dinamis):
 * Mendukung multiple Tube (Tube 1, Tube 2), multiple Yarn (Yarn 1, Yarn 2), Cover (atau double Cover),
 * serta menangani jika ada layer yang dihapus (misal selang tanpa benang / tanpa cover):
 * 1. Urutan fisik mengalir dari lapisan terdalam ke terluar (inside-out) sesuai urutan group aktif.
 * 2. Lapisan pertama ID terhubung dengan SPEC ID.
 * 3. Setiap lapisan berikutnya mengambil ID dari OD lapisan sebelumnya: ID[k] = OD[k-1].
 * 4. Untuk polimer (Tube/Cover): OD = ID + 2 * Thick. Berat = π * ((OD² - ID²)/4) * SG * 10⁻³ * Length.
 * 5. Untuk benang (Yarn): OD = ID + 4 * P. Biaya = 50.000 * Berat * Length.
 * 6. SPEC OD mengambil OD dari lapisan fisik terluar (paling bawah).
 * 7. SPEC ID mengambil ID dari lapisan fisik terdalam (paling atas).
 * 8. HOSE WEIGHT/M = Akumulasi berat seluruh lapisan fisik yang aktif.
 * 9. BAHAN BAKU EXCLUDE/INCLUDE = Akumulasi biaya seluruh lapisan fisik yang aktif.
 */
const autoChainHoseParams = (triggerGroup?: LayerGroupRow, triggerParam?: LayerGroupParam) => {
  const getParam = (grp: LayerGroupRow | undefined, kw: string) => {
    if (!grp) return undefined
    return grp.params.find(p => (p.nama_parameter_display || spekMap.value[p.nama_parameter] || '').toLowerCase().includes(kw))
  }

  const specGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'SPEC')
  const hoseGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'HOSE')
  const bbGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'BAHAN_BAKU')

  const specId = getParam(specGrp, 'inner') || getParam(specGrp, 'id')
  const specOd = getParam(specGrp, 'outer') || getParam(specGrp, 'od')

  // SPEC LENGTH (Panjang dalam Meter - Kolom E32 di Excel)
  const sLength = parseCommaNumber(getParam(specGrp, 'length')?.value || getParam(specGrp, 'panjang')?.value) || 1

  // Ambil semua group lapisan fisik (selain SPEC, HOSE, BAHAN_BAKU)
  const physicalGroups = layerGroups.value.filter(g => {
    const k = getLayerKeyFromDisplay(g.layer_display)
    return k !== 'SPEC' && k !== 'HOSE' && k !== 'BAHAN_BAKU' && g.params.length > 0
  })

  const trigKey = triggerGroup ? getLayerKeyFromDisplay(triggerGroup.layer_display) : ''
  const trigParamName = (triggerParam?.nama_parameter_display || '').toLowerCase()

  // 1. Sinkronisasi Lapisan Fisik Pertama <=> SPEC ID
  if (physicalGroups.length > 0) {
    const firstGrp = physicalGroups[0]
    const firstId = getParam(firstGrp, 'inner') || getParam(firstGrp, 'id') || getParam(firstGrp, 'dalam')

    if (trigKey === 'SPEC' && (trigParamName.includes('inner') || trigParamName.includes('id'))) {
      if (firstId && triggerParam?.value) {
        firstId.value = triggerParam.value
      }
    } else if (triggerGroup === firstGrp && (trigParamName.includes('inner') || trigParamName.includes('id'))) {
      if (specId && triggerParam?.value) {
        specId.value = triggerParam.value
      }
    } else if (firstId?.value && specId && !specId.value) {
      specId.value = firstId.value
    } else if (specId?.value && firstId && !firstId.value) {
      firstId.value = specId.value
    }
  }

  // 2. Iterasi mengalir dari lapisan dalam ke lapisan luar
  let prevOd = 0
  let totalHoseWeight = 0
  let totalMatCostExclude = 0

  // Deteksi bila selang memiliki lapisan SPRING (kawat baja)
  const springGrp = physicalGroups.find(g => getLayerKeyFromDisplay(g.layer_display) === 'SPRING')
  const wireThickVal = springGrp ? parseCommaNumber(getParam(springGrp, 'thick')?.value || getParam(springGrp, 'tebal')?.value) : 0
  const wirePitchVal = springGrp ? parseCommaNumber(getParam(springGrp, 'pitch')?.value || getParam(springGrp, 'jarak')?.value) : 0

  physicalGroups.forEach((grp, idx) => {
    const lKey = getLayerKeyFromDisplay(grp.layer_display)
    const isYarn = lKey === 'YARN'
    const isCover = lKey === 'COVER'
    const isCoverTube = lKey === 'COVER_TUBE'
    const isSpring = lKey === 'SPRING'
    const isRod = lKey === 'ROD'

    const idParam = getParam(grp, 'inner') || getParam(grp, 'id') || getParam(grp, 'dalam')
    const thickParam = getParam(grp, 'thick') || getParam(grp, 'tebal') || (isYarn ? grp.params.find(p => (p.nama_parameter_display || '').toLowerCase() === 'p') : undefined)
    const odParam = getParam(grp, 'outer') || getParam(grp, 'od') || getParam(grp, 'luar')
    const weightParam = getParam(grp, 'weight') || getParam(grp, 'berat')
    const priceParam = getParam(grp, 'price') || getParam(grp, 'harga')

    // Tentukan ID lapisan saat ini
    let curId = 0
    if (idx === 0) {
      curId = parseCommaNumber(idParam?.value) || parseCommaNumber(specId?.value)
      if (idParam && curId > 0 && !idParam.value) {
        idParam.value = formatCommaNumber(curId, 2)
      }
    } else {
      // Lapisan ke-2 dan seterusnya mengambil OD dari lapisan sebelumnya
      curId = prevOd
      if (idParam && curId > 0 && !isSpring) {
        idParam.value = formatCommaNumber(curId, 2)
      }
    }

    const thickVal = parseCommaNumber(thickParam?.value)

    // Hitung OD lapisan saat ini
    let curOd = 0
    if (isYarn) {
      if (curId > 0 && thickVal > 0) {
        curOd = curId + 4 * thickVal
      }
    } else if (isRod) {
      // Sesuai rumus spiral hose: OD = Tube_ID + ((OD_Rod + 1) * 2)
      const baseId = parseCommaNumber(specId?.value) || curId
      if (baseId > 0 && thickVal > 0) {
        curOd = baseId + (thickVal + 1) * 2
      }
    } else if (isSpring) {
      curOd = prevOd > 0 ? prevOd : (parseCommaNumber(specOd?.value) || (curId > 0 ? curId + 2 * thickVal : 0))
    } else {
      if (curId > 0 && thickVal > 0) {
        curOd = curId + 2 * thickVal
      }
    }

    if (curOd > 0 && odParam) {
      odParam.value = formatCommaNumber(curOd, 2)
    } else if (!curOd && odParam?.value) {
      curOd = parseCommaNumber(odParam.value)
    }

    // Update prevOd untuk lapisan berikutnya
    if (curOd > 0 && !isSpring) {
      prevOd = curOd
    } else if (curId > 0 && !isSpring) {
      prevOd = curId
    }

    // Hitung Berat & Biaya lapisan saat ini
    if (isYarn) {
      const denierVal = parseCommaNumber(getParam(grp, 'denier')?.value)
      const carrierVal = parseCommaNumber(getParam(grp, 'carrier')?.value || getParam(grp, 'klos')?.value)
      const angleVal = parseCommaNumber(getParam(grp, 'angle')?.value || getParam(grp, 'sudut')?.value) || 40
      const costYarnPerKg = formulaHargaYarn.value > 0 ? formulaHargaYarn.value : 60000

      let yarnWeight = 0
      if (denierVal > 0 && carrierVal > 0) {
        const straightBase = (denierVal * carrierVal) / 9000000
        const rad = (angleVal * Math.PI) / 180
        const pathFactor = Math.cos(rad) !== 0 ? 1 / Math.cos(rad) : 1.3054
        yarnWeight = Number(((straightBase * pathFactor) / (1 - 0.05)).toFixed(4))
      } else {
        yarnWeight = parseCommaNumber(weightParam?.value)
        if ((thickVal > 0 || curId > 0) && (!yarnWeight || yarnWeight === 0)) {
          yarnWeight = 0.001
        }
      }

      const yarnCost = yarnWeight > 0 ? round2(costYarnPerKg * yarnWeight * sLength) : 0
      const layerWeightTotal = yarnWeight > 0 ? Number((yarnWeight * sLength).toFixed(4)) : 0
      if (weightParam && yarnWeight > 0) weightParam.value = formatCommaNumber(yarnWeight, 4)
      if (priceParam) priceParam.value = yarnCost > 0 ? formatCommaNumber(yarnCost, 2) : ''
      totalHoseWeight += layerWeightTotal
      totalMatCostExclude += yarnCost
    } else if (isSpring) {
      const wireThick = thickVal > 0 ? thickVal : 2
      const wirePitch = parseCommaNumber(getParam(grp, 'pitch')?.value || getParam(grp, 'jarak')?.value) || 5
      const tubeOdTarget = curOd > 0 ? curOd : (parseCommaNumber(specOd?.value) || 35)
      const wireLengthParam = getParam(grp, 'length') || getParam(grp, 'panjang')

      const turns = (wirePitch + wireThick > 0) ? (1000 / (wirePitch + wireThick)) : 0
      const wireLen = (turns > 0 && tubeOdTarget > 0) ? Number(((turns * (tubeOdTarget * Math.PI)) / 1000).toFixed(2)) : 0
      if (wireLengthParam && wireLen > 0) wireLengthParam.value = formatCommaNumber(wireLen, 2)

      const wireWeight = (wireLen > 0 && wireThick > 0) ? Number(((wireThick * wireThick * Math.PI * 7.8 * wireLen) / 4000).toFixed(4)) : 0
      const costWirePerKg = formulaHargaWire.value > 0 ? formulaHargaWire.value : 100000
      const wireCost = wireWeight > 0 ? round2(wireWeight * costWirePerKg * sLength) : 0
      const layerWeightTotal = wireWeight > 0 ? Number((wireWeight * sLength).toFixed(4)) : 0

      if (weightParam && wireWeight > 0) weightParam.value = formatCommaNumber(wireWeight, 4)
      if (priceParam) priceParam.value = wireCost > 0 ? formatCommaNumber(wireCost, 2) : ''
      totalHoseWeight += layerWeightTotal
      totalMatCostExclude += wireCost
    } else if (isRod) {
      const rodOd = thickVal > 0 ? thickVal : 6
      const rodPitch = parseCommaNumber(getParam(grp, 'pitch')?.value || getParam(grp, 'jarak')?.value) || 10
      const tubeIdTarget = parseCommaNumber(specId?.value) || (curId > 0 ? curId : 52)
      const rodLengthParam = getParam(grp, 'length') || getParam(grp, 'panjang')

      const jlhLilitan = rodPitch > 0 ? 1000 / rodPitch : 0
      const rodLen = jlhLilitan > 0 ? Number((((tubeIdTarget + 1) * Math.PI * jlhLilitan) / 1000).toFixed(2)) : 0
      if (rodLengthParam && rodLen > 0) rodLengthParam.value = formatCommaNumber(rodLen, 2)

      const sgRod = formulaSgRod.value > 0 ? formulaSgRod.value : 1.408
      const costRodPerKg = formulaHargaRod.value > 0 ? formulaHargaRod.value : 22858
      const rodWeight = (rodLen > 0 && rodOd > 0) ? Number((((rodOd / 2) * (rodOd / 2) * Math.PI * sgRod * rodLen) / 1000).toFixed(4)) : 0
      const rodCost = rodWeight > 0 ? round2(rodWeight * costRodPerKg * sLength) : 0
      const layerWeightTotal = rodWeight > 0 ? Number((rodWeight * sLength).toFixed(4)) : 0

      if (weightParam && rodWeight > 0) weightParam.value = formatCommaNumber(rodWeight, 4)
      if (priceParam) priceParam.value = rodCost > 0 ? formatCommaNumber(rodCost, 2) : ''
      totalHoseWeight += layerWeightTotal
      totalMatCostExclude += rodCost
    } else {
      let sg = 1.30
      let costKg = 23238
      if (isCoverTube) {
        sg = formulaSgCoverTube.value > 0 ? formulaSgCoverTube.value : 1.466
        costKg = formulaHargaCoverTube.value > 0 ? formulaHargaCoverTube.value : 20198
      } else if (isCover) {
        sg = formulaSgCover.value > 0 ? formulaSgCover.value : (sgCompound.value > 0 ? sgCompound.value : 1.08)
        costKg = formulaHargaCover.value > 0 ? formulaHargaCover.value : (hargaPerKgCompound.value > 0 ? hargaPerKgCompound.value : 34814)
      } else {
        sg = formulaSgTube.value > 0 ? formulaSgTube.value : (sgCompound.value > 0 ? sgCompound.value : 1.30)
        costKg = formulaHargaTube.value > 0 ? formulaHargaTube.value : (hargaPerKgCompound.value > 0 ? hargaPerKgCompound.value : 23238)
      }

      let layerWeight = 0
      let layerCost = 0
      if (curOd > curId && curId > 0) {
        const area = (Math.PI * (curOd * curOd - curId * curId)) / 4
        let grossWeight = area * sg * 1e-3 * sLength

        // Bila layer TUBE dan terdapat kawat baja SPRING tertanam di dalamnya, kurangi volume kawat
        if (lKey === 'TUBE' && springGrp && wireThickVal > 0) {
          const wPitch = wirePitchVal > 0 ? wirePitchVal : 5
          const wTurns = (wPitch + wireThickVal > 0) ? (1000 / (wPitch + wireThickVal)) : 0
          const wLen = curOd > 0 && wTurns > 0 ? ((wTurns * curOd * Math.PI) / 1000) : 0
          const wireDisplacementKg = (wireThickVal * wireThickVal * Math.PI * wLen * sg * sLength) / 4000
          grossWeight = Math.max(0, grossWeight - wireDisplacementKg)
        }

        layerWeight = Number(grossWeight.toFixed(4))
        layerCost = round2(layerWeight * costKg)
      }
      if (weightParam) weightParam.value = layerWeight > 0 ? formatCommaNumber(layerWeight, 4) : ''
      if (priceParam) priceParam.value = layerCost > 0 ? formatCommaNumber(layerCost, 2) : ''
      totalHoseWeight += layerWeight
      totalMatCostExclude += layerCost
    }
  })

  // 3. Update SPEC OD dari lapisan fisik terluar
  if (prevOd > 0 && specOd) {
    specOd.value = formatCommaNumber(prevOd, 2)
  }

  // 4. Update HOSE TOTAL BERAT
  const hoseWeightParam = getParam(hoseGrp, 'weight') || getParam(hoseGrp, 'berat')
  const finalHoseWeight = Number(totalHoseWeight.toFixed(4))
  if (hoseWeightParam) hoseWeightParam.value = finalHoseWeight > 0 ? formatCommaNumber(finalHoseWeight, 4) : ''

  // 5. Update BAHAN BAKU MATERIAL EXCLUDE & INCLUDE
  const bbExcludeParam = getParam(bbGrp, 'exclude')
  const bbIncludeParam = getParam(bbGrp, 'include')
  const matCostExclude = round2(totalMatCostExclude)
  const matCostInclude = round2(matCostExclude * 1.11)
  if (bbExcludeParam) bbExcludeParam.value = matCostExclude > 0 ? formatCommaNumber(matCostExclude, 2) : ''
  if (bbIncludeParam) bbIncludeParam.value = matCostInclude > 0 ? formatCommaNumber(matCostInclude, 2) : ''
}

/** Handler ketika nilai parameter diinput / diubah */
const onParamValueChange = (grp: LayerGroupRow, p: LayerGroupParam, rawVal: string) => {
  let val = rawVal

  if (val.includes('/')) {
    const parts = val.split('/')
    if (parts.length === 2 && parts[0] && parts[1] && parts[1].trim() !== '') {
      const num = parseFloat(parts[0].replace(',', '.'))
      const den = parseFloat(parts[1].replace(',', '.'))
      if (!isNaN(num) && !isNaN(den) && den !== 0) {
        val = String(Number((num / den).toFixed(4))).replace('.', ',')
      }
    }
  }

  val = val.replace(/\./g, ',')
  val = val.replace(/[^0-9,-]/g, '')

  p.value = val

  autoChainHoseParams(grp, p)
  syncGroupsToSpekArr()
  syncSpekToMaterialQuantities()
  syncSpekWeightToQty()
}

/** Handler blur untuk memastikan nilai bersih dan terformat koma */
const onParamValueBlur = (grp: LayerGroupRow, p: LayerGroupParam) => {
  if (!p.value) return
  let val = String(p.value).trim()
  if (val.includes('/')) {
    const parts = val.split('/')
    if (parts.length === 2 && parts[0] && parts[1]) {
      const num = parseFloat(parts[0].replace(',', '.'))
      const den = parseFloat(parts[1].replace(',', '.'))
      if (!isNaN(num) && !isNaN(den) && den !== 0) {
        p.value = formatCommaNumber(num / den, 4)
      }
    }
  } else {
    p.value = val.replace(/\./g, ',')
  }
  autoChainHoseParams(grp, p)
  syncGroupsToSpekArr()
}

/** Helper untuk mengambil nilai parameter numerik spesifik per layer */
const getLayerParamValue = (layerKeywords: string[], paramKeys: string[], excludeKeywords: string[] = []): number => {
  const row = spekArr.value.find((s) => {
    const lName = (s.layer_display || layerMap.value[s.layer_id] || '').toLowerCase().trim()
    if (excludeKeywords.some((ek) => lName.includes(ek.toLowerCase()))) return false
    const matchLayer = layerKeywords.some((lk) => lName.includes(lk.toLowerCase()))
    if (!matchLayer) return false

    const pName = (s.param_display || spekMap.value[s.param_id] || '').toLowerCase().trim()
    return paramKeys.some((pk) => {
      const aliases = SPEK_ALIASES[pk] || [pk]
      return aliases.some((a) => pName === a || pName.startsWith(a))
    })
  })
  return parseCommaNumber(row?.value)
}

/** Dimensi & Berat Lapisan TUBE */
const tubeDim = computed(() => {
  const id = getLayerParamValue(['tube', 'inner', 'dalam'], ['id'], ['cover', 'outer', 'luar'])
  const thick = getLayerParamValue(['tube', 'inner', 'dalam'], ['thick'], ['cover', 'outer', 'luar'])
  let od = getLayerParamValue(['tube', 'inner', 'dalam'], ['od'], ['cover', 'outer', 'luar'])

  if (id > 0 && thick > 0 && !od) {
    od = Number((id + 2 * thick).toFixed(2))
  }

  const sg = formulaSgTube.value > 0 ? formulaSgTube.value : (sgCompound.value > 0 ? sgCompound.value : 1.30)
  const costKg = formulaHargaTube.value > 0 ? formulaHargaTube.value : (hargaPerKgCompound.value > 0 ? hargaPerKgCompound.value : 23238)
  const sLength = getLayerParamValue(['spec'], ['length', 'panjang']) || 1
  const isValidDim = id > 0 && od > id
  const area = isValidDim ? (Math.PI * (od * od - id * id)) / 4 : 0
  const weight = sg > 0 && area > 0 ? Number((area * sg * 1e-3 * sLength).toFixed(4)) : 0
  const cost = round2(weight * costKg)
  const odCalculated = id > 0 && thick > 0 ? Number((id + 2 * thick).toFixed(2)) : 0
  return { id, thick, od, weight, cost, isValidDim, odCalculated }
})

/** Dimensi & Berat Lapisan COVER */
const coverDim = computed(() => {
  let id = getLayerParamValue(['cover', 'outer', 'luar'], ['id']) || (tubeDim.value.od > 0 ? tubeDim.value.od : 0)
  const thick = getLayerParamValue(['cover', 'outer', 'luar'], ['thick'])
  let od = getLayerParamValue(['cover', 'outer', 'luar'], ['od'])

  if (id > 0 && thick > 0 && !od) {
    od = Number((id + 2 * thick).toFixed(2))
  }

  const sLength = getLayerParamValue(['spec'], ['length', 'panjang']) || 1
  const sg = formulaSgCover.value > 0 ? formulaSgCover.value : (sgCompound.value > 0 ? sgCompound.value : 1.08)
  const costKg = formulaHargaCover.value > 0 ? formulaHargaCover.value : (hargaPerKgCompound.value > 0 ? hargaPerKgCompound.value : 34814)
  const isValidDim = id > 0 && od > id
  const area = isValidDim ? (Math.PI * (od * od - id * id)) / 4 : 0
  const weight = sg > 0 && area > 0 ? Number((area * sg * 1e-3 * sLength).toFixed(4)) : 0
  const cost = round2(weight * costKg)
  const odCalculated = id > 0 && thick > 0 ? Number((id + 2 * thick).toFixed(2)) : 0
  return { id, thick, od, weight, cost, isValidDim, odCalculated }
})

/** Dimensi & Berat Lapisan YARN */
const yarnDim = computed(() => {
  const id = getLayerParamValue(['yarn', 'benang', 'kawat', 'anyaman', 'braid'], ['id']) || tubeDim.value.od || 0
  const thick = getLayerParamValue(['yarn', 'benang', 'kawat', 'anyaman', 'braid'], ['thick']) || 0.1
  const od = getLayerParamValue(['yarn', 'benang', 'kawat', 'anyaman', 'braid'], ['od']) || (id > 0 ? Number((id + 4 * thick).toFixed(2)) : 0)
  const weightParam = getLayerParamValue(['yarn', 'benang', 'kawat', 'anyaman', 'braid'], ['weight', 'berat'])
  const hasHose = tubeDim.value.id > 0 || tubeDim.value.od > 0 || coverDim.value.od > 0 || id > 0
  const yarnWeight = weightParam > 0 ? weightParam : (hasHose ? 0.001 : 0)
  const sLength = getLayerParamValue(['spec'], ['length', 'panjang']) || 1
  const cost = round2(50000 * yarnWeight * sLength)
  return { id, thick, od, weight: yarnWeight, cost }
})

/** UOM Header yang dipilih pada item produk */
const headerUomName = computed(() => {
  return selectedItemUomName.value || uomMap.value[values.unit_id] || ''
})

const headerUomShort = computed(() => {
  const u = (headerUomName.value || '').trim()
  return u || ''
})

/** TOTAL BERAT SELANG / UNIT */
const totalHoseWeightPerMeter = computed(() => {
  const { tubeWeightPerM, coverWeightPerM, yarnWeightPerM } = getSpekCalculatedWeights()
  const w = tubeWeightPerM + coverWeightPerM + yarnWeightPerM
  if (w > 0) return Number(w.toFixed(4))
  return Number((tubeDim.value.weight + coverDim.value.weight + yarnDim.value.weight).toFixed(4))
})

/** TOTAL HARGA SELANG EXCLUDE PPN / METER */
const totalHoseCostExcludePerMeter = computed(() => {
  const bbGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'BAHAN_BAKU')
  const bbExclude = parseCommaNumber(bbGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('exclude'))?.value)
  if (bbExclude > 0) return bbExclude
  return round2(tubeDim.value.cost + coverDim.value.cost + yarnDim.value.cost)
})

/** TOTAL HARGA SELANG INCLUDE PPN 11% / METER */
const totalHoseCostIncludePerMeter = computed(() => {
  return round2(totalHoseCostExcludePerMeter.value * 1.11)
})

/** Pemicu kalkulasi manual / refresh kalkulasi */
const triggerRecalculate = () => {
  if (layerGroups.value.length === 0) {
    initLayerGroups()
  }

  autoChainHoseParams()
  syncGroupsToSpekArr()
  syncSpekToMaterialQuantities()
  syncSpekWeightToQty()

  const hoseGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'HOSE')
  const hWeight = parseCommaNumber(hoseGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('weight') || (p.nama_parameter_display || '').toLowerCase().includes('berat'))?.value)
  if (hWeight > 0) {
    showCalculationPanel.value = true
    toast.success('Kalkulasi berhasil dihitung! Nilai Berat/M dan Harga/M telah otomatis dimunculkan.')
    nextTick(() => {
      const el = document.getElementById('panel-hasil-kalkulasi')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    })
  } else {
    toast.info('Silakan isi dimensi ID, OD, atau Tebal terlebih dahulu untuk menjalankan kalkulasi.')
  }
}

/** Perbaiki dimensi selang otomatis jika ada OD <= ID atau OD belum sinkron dengan ID & Tebal */
const autoFixHoseDimensions = () => {
  let changed = false
  const tubeGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'TUBE')
  const coverGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'COVER')

  if (tubeGrp) {
    const idParam = tubeGrp.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('inner') || (p.nama_parameter_display || '').toLowerCase().includes('id'))
    const thickParam = tubeGrp.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('thick') || (p.nama_parameter_display || '').toLowerCase().includes('tebal'))
    const odParam = tubeGrp.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('outer') || (p.nama_parameter_display || '').toLowerCase().includes('od'))

    const id = parseCommaNumber(idParam?.value)
    const thick = parseCommaNumber(thickParam?.value)
    const od = parseCommaNumber(odParam?.value)
    if (id > 0 && thick > 0 && (od <= id || od === 0)) {
      if (odParam) {
        odParam.value = formatCommaNumber(id + 2 * thick, 2)
        changed = true
      }
    }
  }

  if (coverGrp) {
    const idParam = coverGrp.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('inner') || (p.nama_parameter_display || '').toLowerCase().includes('id'))
    const thickParam = coverGrp.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('thick') || (p.nama_parameter_display || '').toLowerCase().includes('tebal'))
    const odParam = coverGrp.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('outer') || (p.nama_parameter_display || '').toLowerCase().includes('od'))

    const id = parseCommaNumber(idParam?.value)
    const thick = parseCommaNumber(thickParam?.value)
    const od = parseCommaNumber(odParam?.value)
    if (id > 0 && thick > 0 && (od <= id || od === 0)) {
      if (odParam) {
        odParam.value = formatCommaNumber(id + 2 * thick, 2)
        changed = true
      }
    }
  }

  if (changed) {
    triggerRecalculate()
    toast.success('Dimensi selang berhasil diperbaiki otomatis')
  } else {
    toast.info('Dimensi selang sudah sesuai rumus')
  }
}

const syncCompoundToFormula = () => {
  if (sgCompound.value > 0) {
    formulaSgTube.value = Number(sgCompound.value.toFixed(2))
    formulaSgCover.value = Number(sgCompound.value.toFixed(2))
  }
  if (hargaPerKgCompound.value > 0) {
    formulaHargaTube.value = hargaPerKgCompound.value
    formulaHargaCover.value = hargaPerKgCompound.value
  }
  triggerRecalculate()
  toast.success('SG & Harga Compound diterapkan ke Formula Spek')
}

/**
 * Dapatkan kalkulasi berat material dari layer spesifikasi (Tube, Cover, Yarn)
 * Mengakumulasi seluruh lapisan fisik aktif (mendukung multiple Tube, multiple Yarn, double Cover, atau layer dihapus).
 */
const getSpekCalculatedWeights = () => {
  const getParam = (grp: LayerGroupRow | undefined, kw: string) => {
    if (!grp) return undefined
    return grp.params.find(p => (p.nama_parameter_display || spekMap.value[p.nama_parameter] || '').toLowerCase().includes(kw))
  }

  const specGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'SPEC')
  const sLength = parseCommaNumber(getParam(specGrp, 'length')?.value || getParam(specGrp, 'panjang')?.value) || 1
  const totalLengthM = sLength

  let totalTubeKg = 0
  let totalCoverTubeKg = 0
  let totalCoverKg = 0
  let totalYarnKg = 0
  let totalSpringKg = 0
  let totalRodKg = 0
  let tubeWeightPerM = 0
  let coverTubeWeightPerM = 0
  let coverWeightPerM = 0
  let yarnWeightPerM = 0
  let springWeightPerM = 0
  let rodWeightPerM = 0

  layerGroups.value.forEach(grp => {
    const lKey = getLayerKeyFromDisplay(grp.layer_display)
    const wVal = parseCommaNumber(getParam(grp, 'weight')?.value || getParam(grp, 'berat')?.value)
    if (wVal <= 0) return

    if (lKey === 'TUBE') {
      totalTubeKg += wVal
      tubeWeightPerM += wVal / totalLengthM
    } else if (lKey === 'COVER_TUBE') {
      totalCoverTubeKg += wVal
      coverTubeWeightPerM += wVal / totalLengthM
    } else if (lKey === 'COVER') {
      totalCoverKg += wVal
      coverWeightPerM += wVal / totalLengthM
    } else if (lKey === 'YARN') {
      totalYarnKg += wVal * totalLengthM
      yarnWeightPerM += wVal
    } else if (lKey === 'SPRING') {
      totalSpringKg += wVal * totalLengthM
      springWeightPerM += wVal
    } else if (lKey === 'ROD') {
      totalRodKg += wVal * totalLengthM
      rodWeightPerM += wVal
    }
  })

  return {
    sLength,
    totalLengthM,
    tubeWeightPerM: Number(tubeWeightPerM.toFixed(4)),
    coverTubeWeightPerM: Number(coverTubeWeightPerM.toFixed(4)),
    coverWeightPerM: Number(coverWeightPerM.toFixed(4)),
    yarnWeightPerM: Number(yarnWeightPerM.toFixed(4)),
    springWeightPerM: Number(springWeightPerM.toFixed(4)),
    rodWeightPerM: Number(rodWeightPerM.toFixed(4)),
    totalTubeKg: Number(totalTubeKg.toFixed(4)),
    totalCoverTubeKg: Number(totalCoverTubeKg.toFixed(4)),
    totalCoverKg: Number(totalCoverKg.toFixed(4)),
    totalYarnKg: Number(totalYarnKg.toFixed(4)),
    totalSpringKg: Number(totalSpringKg.toFixed(4)),
    totalRodKg: Number(totalRodKg.toFixed(4)),
  }
}

/** Total berat selang terhitung dari spesifikasi (kg) */
const spekTotalHoseWeight = computed(() => {
  const { totalTubeKg, totalCoverTubeKg, totalCoverKg, totalYarnKg, totalSpringKg, totalRodKg } = getSpekCalculatedWeights()
  const sumMat = totalTubeKg + totalCoverTubeKg + totalCoverKg + totalYarnKg + totalSpringKg + totalRodKg
  if (sumMat > 0) return Number(sumMat.toFixed(4))

  const hoseGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'HOSE')
  const hWeightVal = parseCommaNumber(
    hoseGrp?.params.find(p => (p.nama_parameter_display || spekMap.value[p.nama_parameter] || '').toLowerCase().includes('weight') || (p.nama_parameter_display || spekMap.value[p.nama_parameter] || '').toLowerCase().includes('berat'))?.value
  )
  if (hWeightVal > 0) {
    return Number(hWeightVal.toFixed(4))
  }

  return 0
})

/** Sinkronkan berat spesifikasi ke field Qty header jika tipe SPESIFIK */
const syncSpekWeightToQty = () => {
  if (!isTypeSpesifik.value) return
  const weight = spekTotalHoseWeight.value
  values.qty = weight > 0 ? weight : 0
}

// Auto-sync Qty header dari total berat spesifikasi saat tipe SPESIFIK
watch(spekTotalHoseWeight, (newWeight) => {
  if (isTypeSpesifik.value) {
    values.qty = newWeight > 0 ? newWeight : 0
  }
})

/**
 * Sinkronisasi hasil perhitungan spek ke baris detail material yang memiliki spek_ref
 */
const syncSpekToMaterialQuantities = () => {
  if (!isTypeSpesifik.value) return
  syncSpekWeightToQty()
  const { totalTubeKg, totalCoverTubeKg, totalCoverKg, totalYarnKg, totalSpringKg, totalRodKg } = getSpekCalculatedWeights()

  let updated = false
  detailArr.value.forEach((d) => {
    if (d.spek_ref === 'TUBE' && totalTubeKg > 0) {
      d.qty = totalTubeKg
      d.amount = round2((Number(d.qty) || 0) * (Number(d.price) || 0))
      updated = true
    } else if (d.spek_ref === 'COVER_TUBE' && totalCoverTubeKg > 0) {
      d.qty = totalCoverTubeKg
      d.amount = round2((Number(d.qty) || 0) * (Number(d.price) || 0))
      updated = true
    } else if (d.spek_ref === 'COVER' && totalCoverKg > 0) {
      d.qty = totalCoverKg
      d.amount = round2((Number(d.qty) || 0) * (Number(d.price) || 0))
      updated = true
    } else if (d.spek_ref === 'YARN' && totalYarnKg > 0) {
      d.qty = totalYarnKg
      d.amount = round2((Number(d.qty) || 0) * (Number(d.price) || 0))
      updated = true
    } else if (d.spek_ref === 'SPRING' && totalSpringKg > 0) {
      d.qty = totalSpringKg
      d.amount = round2((Number(d.qty) || 0) * (Number(d.price) || 0))
      updated = true
    } else if (d.spek_ref === 'ROD' && totalRodKg > 0) {
      d.qty = totalRodKg
      d.amount = round2((Number(d.qty) || 0) * (Number(d.price) || 0))
      updated = true
    }
  })

  if (updated) {
    calculateCosts()
  }
}

const onDetailSpekRefChange = (detail: any, refType: string) => {
  detail.spek_ref = refType
  const { totalTubeKg, totalCoverTubeKg, totalCoverKg, totalYarnKg, totalSpringKg, totalRodKg } = getSpekCalculatedWeights()
  if (refType === 'TUBE' && totalTubeKg > 0) {
    detail.qty = totalTubeKg
  } else if (refType === 'COVER_TUBE' && totalCoverTubeKg > 0) {
    detail.qty = totalCoverTubeKg
  } else if (refType === 'COVER' && totalCoverKg > 0) {
    detail.qty = totalCoverKg
  } else if (refType === 'YARN' && totalYarnKg > 0) {
    detail.qty = totalYarnKg
  } else if (refType === 'SPRING' && totalSpringKg > 0) {
    detail.qty = totalSpringKg
  } else if (refType === 'ROD' && totalRodKg > 0) {
    detail.qty = totalRodKg
  }
  detail.amount = round2((Number(detail.qty) || 0) * (Number(detail.price) || 0))
  calculateCosts()
}

const applySpekMaterialsToDetailArr = () => {
  const { totalTubeKg, totalCoverTubeKg, totalCoverKg, totalYarnKg, totalSpringKg, totalRodKg } = getSpekCalculatedWeights()

  const ensureRow = (refKey: string, defaultName: string, calcQty: number) => {
    let row = detailArr.value.find((d) => d.spek_ref === refKey)
    if (!row) {
      row = {
        is_main: false,
        spek_ref: refKey,
        item_type_id: '',
        m_item_id: '',
        m_item: null,
        nama_item: defaultName,
        qty: calcQty > 0 ? calcQty : 1,
        unit_id: '',
        uom_name: 'KG',
        price: 0,
        amount: 0,
        notes: `Auto kalkulasi dari Spek ${refKey}`,
      }
      detailArr.value.push(row)
    } else {
      if (calcQty > 0) {
        row.qty = calcQty
        row.amount = round2((Number(row.qty) || 0) * (Number(row.price) || 0))
      }
    }
  }

  ensureRow('TUBE', 'Compound Tube', totalTubeKg)
  if (totalCoverTubeKg > 0) ensureRow('COVER_TUBE', 'Compound Cover Tube (Tengah)', totalCoverTubeKg)
  ensureRow('COVER', 'Compound Cover', totalCoverKg)
  if (totalYarnKg > 0) ensureRow('YARN', 'Benang / Yarn PET', totalYarnKg)
  if (totalSpringKg > 0) ensureRow('SPRING', 'Kawat Baja (Spring)', totalSpringKg)
  if (totalRodKg > 0) ensureRow('ROD', 'Rod Spiral Rigid', totalRodKg)

  calculateCosts()
  toast.success('Material seluruh lapisan aktif berhasil dihubungkan ke detail material!')
}

/**
 * Terapkan Standar Biaya Manufaktur HMI:
 * - Toleransi Waste : 5%
 * - Reject           : 5%
 * - Direct Labor     : Rp 2.000 / meter selang
 * - Listrik / Energi : Rp 1.000 / meter selang
 * - Total COGM       : Material + Waste(5%) + Reject(5%) + Labor + Listrik
 * - Selling Price    : COGM × 1.11 (PPN 11%)
 */
const applyHmiCostStandard = () => {
  const { totalLengthM } = getSpekCalculatedWeights()
  const sLength = totalLengthM > 0 ? totalLengthM : (Number(values.qty) || 1)

  // Direct labor: Rp 2.000 / meter
  const dlNominal = round2(2000 * sLength)
  values.dl_amt = dlNominal
  if (values.mtr_amt > 0) {
    values.dl_pct = round2((dlNominal / values.mtr_amt) * 100)
  }

  // Listrik & Overhead: Rp 1.000 / meter + Waste 5% + Reject 5% (Total Overhead 10% Material + Listrik)
  const wasteAmt = round2(0.05 * values.mtr_amt)
  const rejectAmt = round2(0.05 * values.mtr_amt)
  const listrikNominal = round2(1000 * sLength)
  const totalOhdAmt = round2(listrikNominal + wasteAmt + rejectAmt)
  values.ohd_amt = totalOhdAmt
  if (values.mtr_amt > 0) {
    values.ohd_pct = round2((totalOhdAmt / values.mtr_amt) * 100)
  }

  calculateCosts()

  // Set selling price ke HPP include PPN (11%)
  const cogm = Number(values.tot_cogm || 0)
  if (cogm > 0) {
    values.price = round2(cogm * 1.11)
  }

  toast.success(`Standar Biaya HMI diterapkan! (Labor: Rp 2.000/M, Listrik: Rp 1.000/M, Waste: 5%, Reject: 5%, PPN: 11%)`)
}

/** Terapkan langsung harga include PPN dari layer BAHAN BAKU ke Selling Price */
const applySpekPriceToSellingPrice = () => {
  const bbGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'BAHAN_BAKU')
  const bbInclude = parseCommaNumber(bbGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('include'))?.value)
  if (bbInclude > 0) {
    values.price = bbInclude
    calculateCosts()
    toast.success(`Harga Jual berhasil disinkronkan ke Rp ${bbInclude.toLocaleString('id-ID')} / meter (Include PPN)!`)
  } else {
    toast.info('Harga include PPN belum terhitung di tabel layer.')
  }
}

/** Terapkan Preset Lapisan Selang (3-Layer Anyam, 4-Layer LPG, Spring Kawat, Spiral Rod, Dof) */
const applyHosePreset = (presetId: string) => {
  const preset = HOSE_PRESETS.find(p => p.id === presetId)
  if (!preset) return
  selectedHosePresetId.value = presetId

  // Preserve existing inputs (like Size inch, Length M, Tube ID, Thickness, etc.)
  const existingParamMap = new Map<string, string>()
  layerGroups.value.forEach(g => {
    const gKey = getLayerKeyFromDisplay(g.layer_display)
    g.params.forEach(p => {
      const pName = (p.nama_parameter_display || '').toLowerCase()
      if (p.value !== undefined && p.value !== null && p.value !== '') {
        if (p.calc_key) existingParamMap.set(`${gKey}:::calc_${p.calc_key}`, p.value)
        if (p.short_label) existingParamMap.set(`${gKey}:::lbl_${p.short_label.toLowerCase()}`, p.value)
        existingParamMap.set(`${gKey}:::name_${pName}`, p.value)
        if (p.nama_parameter) existingParamMap.set(`${gKey}:::id_${p.nama_parameter}`, p.value)
      }
    })
  })

  const standardRows: LayerGroupRow[] = []
  preset.layers.forEach((def, idx) => {
    const matchedLayer = findLayerItem(def.code, def.name)
    const layerId = matchedLayer?.id || ''
    const layerDisplay = matchedLayer?.value1 || def.name

    const template = LAYER_PARAM_TEMPLATES[def.key] || []
    const params: LayerGroupParam[] = template.map((t) => {
      const matchedSpec = findSpecItem(t.specCode, t.specName)
      const matchedUom = findUomItem(t.uom)

      let existingVal: string | undefined
      if (t.calcKey) existingVal = existingParamMap.get(`${def.key}:::calc_${t.calcKey}`)
      if (existingVal === undefined && t.shortLabel) existingVal = existingParamMap.get(`${def.key}:::lbl_${t.shortLabel.toLowerCase()}`)
      if (existingVal === undefined) existingVal = existingParamMap.get(`${def.key}:::name_${t.specName.toLowerCase()}`)
      if (existingVal === undefined && matchedSpec?.id) existingVal = existingParamMap.get(`${def.key}:::id_${matchedSpec.id}`)

      const finalVal = existingVal !== undefined && existingVal !== ''
        ? existingVal
        : (t.defaultValue ? String(t.defaultValue).replace('.', ',') : '')

      return {
        nama_parameter: matchedSpec?.id || '',
        nama_parameter_display: matchedSpec?.value1 || t.specName,
        value: finalVal,
        satuan: matchedUom?.id || '',
        satuan_display: matchedUom?.value1 || t.uom,
        notes: '',
        is_calculated: t.isCalculated || false,
        is_linked: t.isLinked || false,
        link_source: t.linkSource || '',
        calc_key: t.calcKey,
        short_label: t.shortLabel,
        placeholder: '0',
        formula_text: t.formulaText || '',
      }
    })

    standardRows.push({
      local_id: `grp_preset_${def.key}_${Date.now()}_${idx}`,
      layer_id: layerId,
      layer_display: layerDisplay,
      params,
    })
  })

  layerGroups.value = standardRows
  autoChainHoseParams()
  syncGroupsToSpekArr()
  syncSpekToMaterialQuantities()
  calculateCosts()
  toast.success(`Preset "${preset.name}" berhasil diterapkan!`)
}

const onPresetSelectChange = (e: Event) => {
  const target = e.target as HTMLSelectElement
  if (target && target.value) {
    applyHosePreset(target.value)
  }
}

const runFormulaChain = () => {
  triggerRecalculate()
}

/** Auto-detect harga/kg compound dari detailArr berdasarkan nama item */
const autoDetectCompoundPrice = () => {
  if (hargaPerKgCompound.value > 0) {
    if (formulaHargaTube.value === 0) formulaHargaTube.value = hargaPerKgCompound.value
    if (formulaHargaCover.value === 0) formulaHargaCover.value = hargaPerKgCompound.value
  }
  if (sgCompound.value > 0) {
    if (formulaSgTube.value === 1.30) formulaSgTube.value = Number(sgCompound.value.toFixed(2))
    if (formulaSgCover.value === 1.08) formulaSgCover.value = Number(sgCompound.value.toFixed(2))
  }
  for (const d of detailArr.value) {
    const nama = (d.nama_item || d.m_item?.nama_item || '').toLowerCase()
    const price = Number(d.price || 0)
    if (price <= 0) continue
    if (nama.includes('tube') || nama.includes('inner')) {
      formulaHargaTube.value = price
    } else if (nama.includes('cover') || nama.includes('outer')) {
      formulaHargaCover.value = price
    } else if (nama.includes('benang') || nama.includes('yarn') || nama.includes('braid')) {
      formulaHargaYarn.value = price
    } else if (nama.includes('compound') && formulaHargaTube.value === 0) {
      formulaHargaTube.value = price
    }
  }
  toast.info('Harga & SG compound diambil dari detail material')
}

const selectedItemIds = computed(() => {
  return detailArr.value.map((row) => row.m_item_id).filter(Boolean) as string[]
})

const handleDetailMaterialSelected = (detail: any, item: any) => {
  detail.m_item = item
  detail.nama_item = item?.nama_item || ''
  detail.unit_id = item?.uom_id || ''
  detail.uom_name = item?.mi_uom?.value1 || ''
  const actualVal = item?.berat_bersih != null && item.berat_bersih !== '' ? Number(item.berat_bersih) : 0
  const sgVal = item?.berat_jenis != null && item.berat_jenis !== '' ? Number(item.berat_jenis) : 0
  detail.berat_bersih = actualVal
  detail.berat_jenis = sgVal
  if (item?.tipe_id && !detail.item_type_id) { detail.item_type_id = item.tipe_id }
  if (item?.mi_tipe) { detail.m_general_item_type = item.mi_tipe }
  if (item && sgVal <= 0) {
    toast.warning(`Item "${item.nama_item || item.kode_item}" belum memiliki Berat Jenis (SG) di Master Item. Harap lengkapi di Master Item agar Volume & SG Compound akurat.`)
  }
}

let initialValues: Record<string, any> = {}

// ============================================================================
// DATA FETCHERS FOR EDIT / VIEW MODE
// ============================================================================
const fetchUnitBisnisCompanyName = async (unitBisnisId: string) => {
  if (!unitBisnisId) {
    selectedUnitBisnisCompanyName.value = ""
    return
  }
  try {
    const response = await fetch(`${API_BASE_URL}/dynamic/m_unit_bisnis/${unitBisnisId}?join=true`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authStore.token}` },
    })
    const result = await response.json()
    if (result?.status === "success" && result.data) {
      selectedUnitBisnisCompanyName.value = result.data?.m_company?.nama || result.data?.m_company?.kode || "-"
    }
  } catch (err) {
    console.error("Gagal mengambil nama company:", err)
  }
}

const fetchCustomerName = async (customerId: string) => {
  if (!customerId) {
    selectedCustomerName.value = ""
    return
  }
  try {
    const response = await fetch(`${API_BASE_URL}/dynamic/m_customer/${customerId}`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authStore.token}` },
    })
    const result = await response.json()
    if (result?.status === "success" && result.data) {
      selectedCustomerName.value = result.data.nama_customer || ""
    }
  } catch (err) {
    console.error("Gagal mengambil nama customer:", err)
  }
}

const fetchShipToName = async (shipToId: string) => {
  if (!shipToId) {
    selectedShipToName.value = ""
    return
  }
  try {
    const response = await fetch(`${API_BASE_URL}/dynamic/m_customer_d_alamat/${shipToId}`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authStore.token}` },
    })
    const result = await response.json()
    if (result?.status === "success" && result.data) {
      selectedShipToName.value = `${result.data.nama} - ${result.data.alamat}`
    }
  } catch (err) {
    console.error("Gagal mengambil nama ship to:", err)
  }
}

const fetchItemDetails = async (itemId: string) => {
  if (!itemId) {
    selectedItemName.value = ""
    selectedItemUomName.value = ""
    return
  }
  try {
    const response = await fetch(`${API_BASE_URL}/dynamic/m_items/${itemId}?join=true`, {
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authStore.token}` },
    })
    const result = await response.json()
    if (result?.status === "success" && result.data) {
      selectedItemName.value = result.data.nama_item || ""
      selectedItemUomName.value = result.data.mi_uom?.value1 || ""
    }
  } catch (err) {
    console.error("Gagal mengambil detail item:", err)
  }
}

// ============================================================================
// SELECTION HANDLERS
// ============================================================================
const handleUnitBisnisSelected = (item: any) => {
  selectedUnitBisnisName.value = item?.nama_comp || ""
  selectedUnitBisnisCompanyName.value = item?.m_company?.nama || item?.m_company?.kode || ""
}

const handleCustomerSelected = (item: any) => {
  selectedCustomerName.value = item?.nama_customer || ""
  // Clear address fields
  values.shipto_id = ''
  values.name = ''
  values.address = ''
  selectedShipToName.value = ''
}

const handleFlagChange = (flag: string) => {
  values.flag = flag
  errors.m_cust_id = ''
}

const handleShipToSelected = (item: any) => {
  if (!item) {
    values.name = ''
    values.address = ''
    selectedShipToName.value = ''
    return
  }
  values.name = item.nama || ''
  values.address = item.alamat || ''
  selectedShipToName.value = `${item.nama} - ${item.alamat}`
}

const handleItemDropdownSelected = (item: any) => {
  if (!item) {
    values.unit_id = ''
    selectedItemName.value = ''
    selectedItemUomName.value = ''
    return
  }
  values.unit_id = item.uom_id || ''
  selectedItemName.value = item.nama_item || ''
  selectedItemUomName.value = item.mi_uom?.value1 || ''
  if (item.mi_tipe) {
    if (!selectedItemTypeName.value) selectedItemTypeName.value = item.mi_tipe.value1 || ''
    if (!selectedItemTypeKey.value) selectedItemTypeKey.value = item.mi_tipe.key1 || ''
  }
}

// ============================================================================
// CALCULATIONS & FORMULAS WATCHER
// ============================================================================
const calculateCosts = () => {
  // 1. Calculate detail amounts (qty * price)
  detailArr.value.forEach(d => {
    d.amount = Number((Number(d.qty || 0) * Number(d.price || 0)).toFixed(2))
  })

  // 2. Sum materials
  const mtr_amt = detailArr.value.reduce((sum, d) => sum + Number(d.amount || 0), 0)
  values.mtr_amt = Number(mtr_amt.toFixed(2))

  // 3. Overhead Amt
  values.ohd_amt = Number(((Number(values.ohd_pct || 0) / 100) * mtr_amt).toFixed(2))

  // 4. Direct Labor Amt
  values.dl_amt = Number(((Number(values.dl_pct || 0) / 100) * mtr_amt).toFixed(2))

  // 5. Total COGM
  const tot_cogm = mtr_amt + values.ohd_amt + values.dl_amt
  values.tot_cogm = Number(tot_cogm.toFixed(2))

  // 6. Marketing Amt
  values.mkt_amt = Number(((Number(values.mkt_pct || 0) / 100) * tot_cogm).toFixed(2))

  // 7. Administration Amt
  values.adm_amt = Number(((Number(values.adm_pct || 0) / 100) * tot_cogm).toFixed(2))

  // 8. Total Unit Cost
  const tot_unit_cost = tot_cogm + values.mkt_amt + values.adm_amt
  values.tot_unit_cost = Number(tot_unit_cost.toFixed(2))

  // 9. Total Other Cost
  const tot_other_cost = Number(values.pack_amt || 0) + Number(values.dlv_amt || 0)
  values.tot_other_cost = Number(tot_other_cost.toFixed(2))

  // 10. Total Brutto
  const tot_brutto = tot_unit_cost + tot_other_cost
  values.tot_brutto = Number(tot_brutto.toFixed(2))

  // 11. Profit Amt
  values.profit_amt = Number(((Number(values.profit_pct || 0) / 100) * tot_brutto).toFixed(2))

  // 12. Total Netto
  const tot_netto = tot_brutto + values.profit_amt
  values.tot_netto = Number(tot_netto.toFixed(2))

  // 13. Selling Price
  const qty = Number(values.qty || 0)
  values.price = qty > 0 ? Number((tot_netto / qty).toFixed(2)) : 0

  // 14. % Profit dari Benchmark
  const benchmark = Number(values.benchmark || 0)
  values.profit_bmk = benchmark > 0
    ? Number((((values.price - benchmark) / benchmark) * 100).toFixed(2))
    : 0

  // 15. Selisih dari Benchmark
  values.selisih = Number((values.price - benchmark).toFixed(2))

  // 16. Detail Total Compound
  values.batch_weight = batchWeightKg.value
  values.base_resin = baseResinKg.value
  values.total_volume = totalVolume.value
  values.sg_compound = sgCompound.value
  values.total_biaya_material = Number(mtr_amt.toFixed(2))
  values.harga_per_kg_compound = hargaPerKgCompound.value
}

watch(
  [
    () => detailArr.value,
    () => values.ohd_pct,
    () => values.dl_pct,
    () => values.mkt_pct,
    () => values.adm_pct,
    () => values.pack_amt,
    () => values.dlv_amt,
    () => values.profit_pct,
    () => values.qty,
    () => values.benchmark,
  ],
  () => {
    calculateCosts()
  },
  { deep: true, immediate: true }
)

// ============================================================================
// DETAIL TABLE ACTIONS
// ============================================================================
const addDetailRow = () => {
  detailArr.value.push({
    is_main: false,
    item_type_id: "",
    m_item_id: "",
    nama_item: "",
    qty: 0,
    unit_id: "",
    uom_name: "",
    price: 0,
    amount: 0,
    notes: "",
    m_general_item_type: null,
    m_item: null,
  })
}

const removeDetailRow = (index: number) => {
  detailArr.value.splice(index, 1)
  toast.info('Detail material dihapus')
}

// ============================================================================
// ============================================================================
// CHEMICAL PRECOST MODAL (BUTTON MULTI SELECT) STATE & ACTIONS
// ============================================================================
const selectedTubeMaterialKey = ref('')
const selectedCoverTubeMaterialKey = ref('')
const selectedCoverMaterialKey = ref('')
const selectedRodMaterialKey = ref('')
const selectedSpringMaterialKey = ref('')
const selectedYarnMaterialKey = ref('')

const makeMaterialOptions = () => {
  return (detailArr.value || []).map((m, mIdx) => {
    const val = m.m_item_id || m.nama_item || String(mIdx)
    const name = m.nama_item || m.m_item?.nama_item || `Material #${mIdx + 1}`
    const sg = getMatBeratJenis(m)
    const price = Number(m.price || 0).toLocaleString('id-ID')
    return {
      id: val,
      nama_item: `${name} (SG: ${sg}, Rp ${price}/kg)`,
    }
  })
}

const tubeMaterialOptions = computed(() => makeMaterialOptions())
const coverTubeMaterialOptions = computed(() => makeMaterialOptions())
const coverMaterialOptions = computed(() => makeMaterialOptions())
const rodMaterialOptions = computed(() => makeMaterialOptions())
const springMaterialOptions = computed(() => makeMaterialOptions())
const yarnMaterialOptions = computed(() => makeMaterialOptions())

const selectedTubeMaterialDisplay = computed(() => {
  if (!selectedTubeMaterialKey.value) return ''
  const opt = tubeMaterialOptions.value.find((o) => o.id === selectedTubeMaterialKey.value)
  return opt ? opt.nama_item : selectedTubeMaterialKey.value
})

const selectedCoverTubeMaterialDisplay = computed(() => {
  if (!selectedCoverTubeMaterialKey.value) return ''
  const opt = coverTubeMaterialOptions.value.find((o) => o.id === selectedCoverTubeMaterialKey.value)
  return opt ? opt.nama_item : selectedCoverTubeMaterialKey.value
})

const selectedCoverMaterialDisplay = computed(() => {
  if (!selectedCoverMaterialKey.value) return ''
  const opt = coverMaterialOptions.value.find((o) => o.id === selectedCoverMaterialKey.value)
  return opt ? opt.nama_item : selectedCoverMaterialKey.value
})

const selectedRodMaterialDisplay = computed(() => {
  if (!selectedRodMaterialKey.value) return ''
  const opt = rodMaterialOptions.value.find((o) => o.id === selectedRodMaterialKey.value)
  return opt ? opt.nama_item : selectedRodMaterialKey.value
})

const selectedSpringMaterialDisplay = computed(() => {
  if (!selectedSpringMaterialKey.value) return ''
  const opt = springMaterialOptions.value.find((o) => o.id === selectedSpringMaterialKey.value)
  return opt ? opt.nama_item : selectedSpringMaterialKey.value
})

const selectedYarnMaterialDisplay = computed(() => {
  if (!selectedYarnMaterialKey.value) return ''
  const opt = yarnMaterialOptions.value.find((o) => o.id === selectedYarnMaterialKey.value)
  return opt ? opt.nama_item : selectedYarnMaterialKey.value
})

const chemicalPrecostColumns = [
  { checkboxSelection: true, headerCheckboxSelection: true, width: '50px' },
  { field: 'no', headerName: 'No. Precost', width: '160px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'nama_kompon', headerName: 'Nama Kompon', width: '260px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'kode_item', headerName: 'Kode Item', width: '140px', sortable: true, filterable: true, filter: 'ColFilter' },
  {
    field: 'sg_compound',
    headerName: 'SG Compound',
    width: '130px',
    sortable: true,
    renderHtml: (item: any) => {
      const sg = Number(item.sg_compound) || 0
      return `<span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">${sg > 0 ? sg : '-'} kg/dm³</span>`
    }
  },
  {
    field: 'harga_per_kg_compound',
    headerName: 'Harga Perkilo',
    width: '140px',
    sortable: true,
    renderHtml: (item: any) => {
      const val = Number(item.harga_per_kg_compound) || 0
      return `<span class="font-mono font-bold text-amber-700 dark:text-amber-400">Rp ${val.toLocaleString('id-ID')}</span>`
    }
  },
  {
    field: 'batch_weight',
    headerName: 'Berat 1x Masak',
    width: '120px',
    sortable: true,
    renderHtml: (item: any) => item.batch_weight ? `${item.batch_weight} kg` : '-'
  },
  {
    field: 'date',
    headerName: 'Tanggal',
    width: '110px',
    sortable: true,
    renderHtml: (item: any) => item.date ? new Date(item.date).toLocaleDateString('id-ID') : '-'
  },
]

const chemicalPrecostApi = computed(() => ({
  url: `${API_BASE_URL}/dynamic/t_precost`,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authStore.token}`,
  },
  params: {
    join: 'true',
    filter_column_type: 'CHEMICAL',
    filter_column_status: 'APPROVED',
    order_by: 'date',
    order_type: 'DESC',
    searchfield: 'no,name',
  },
  onsuccess: (res: any) => {
    if (res.status === 'success' && Array.isArray(res.data)) {
      return {
        ...res,
        data: res.data.map((item: any) => ({
          ...item,
          nama_kompon: item.m_item?.nama_item || item.name || '',
          kode_item: item.m_item?.kode_item || '',
        }))
      }
    }
    return res
  }
}))

const selectChemicalPrecostItem = (item: any, targetIdx: number | null = null) => {
  if (!item) return
  const namaItem = item.m_item?.nama_item || item.name || item.no || ''
  const lowerName = namaItem.toLowerCase()
  let refSpek = ''
  if (lowerName.includes('cover tube') || lowerName.includes('middle') || lowerName.includes('tengah')) {
    refSpek = 'COVER_TUBE'
  } else if (lowerName.includes('tube') || lowerName.includes('dalam') || lowerName.includes('inner')) {
    refSpek = 'TUBE'
  } else if (lowerName.includes('cover') || lowerName.includes('luar') || lowerName.includes('outer')) {
    refSpek = 'COVER'
  } else if (lowerName.includes('rod') || lowerName.includes('spiral')) {
    refSpek = 'ROD'
  } else if (lowerName.includes('spring') || lowerName.includes('kawat') || lowerName.includes('wire')) {
    refSpek = 'SPRING'
  } else if (lowerName.includes('yarn') || lowerName.includes('benang')) {
    refSpek = 'YARN'
  }

  const sg = Number(item.sg_compound) || 0
  const harga = Number(item.harga_per_kg_compound) || 0

  if (targetIdx !== null && detailArr.value[targetIdx]) {
    const row = detailArr.value[targetIdx]
    row.m_item_id = item.m_item_id || item.m_item?.id || ''
    row.nama_item = namaItem
    row.m_item = item.m_item || null
    row.item_type_id = item.m_item?.tipe_id || row.item_type_id || ''
    row.unit_id = item.unit_id || item.m_item?.uom_id || row.unit_id || ''
    row.uom_name = item.unit_precost?.value1 || item.m_item?.mi_uom?.value1 || 'KG'
    row.berat_jenis = sg
    row.price = harga
    if (refSpek && !row.spek_ref) row.spek_ref = refSpek
    row.notes = row.notes || ''
    row.chemical_precost_id = item.id
    row.chemical_precost_no = item.no
    row.amount = round2((Number(row.qty) || 0) * harga)
  } else {
    // Cek apakah ada baris kosong di awal/akhir yang belum terisi
    const emptyRowIdx = detailArr.value.findIndex(d => !d.m_item_id && !d.nama_item && (!d.qty || d.qty === 0))
    if (emptyRowIdx !== -1) {
      const row = detailArr.value[emptyRowIdx]
      row.m_item_id = item.m_item_id || item.m_item?.id || ''
      row.nama_item = namaItem
      row.m_item = item.m_item || null
      row.item_type_id = item.m_item?.tipe_id || row.item_type_id || ''
      row.unit_id = item.unit_id || item.m_item?.uom_id || row.unit_id || ''
      row.uom_name = item.unit_precost?.value1 || item.m_item?.mi_uom?.value1 || 'KG'
      row.berat_jenis = sg
      row.price = harga
      if (refSpek && !row.spek_ref) row.spek_ref = refSpek
      row.notes = row.notes || ''
      row.chemical_precost_id = item.id
      row.chemical_precost_no = item.no
      row.amount = round2((Number(row.qty) || 0) * harga)
    } else {
      // Tambah row baru
      detailArr.value.push({
        is_main: false,
        spek_ref: refSpek,
        item_type_id: item.m_item?.tipe_id || '',
        m_item_id: item.m_item_id || item.m_item?.id || '',
        nama_item: namaItem,
        m_item: item.m_item || null,
        qty: 0,
        unit_id: item.unit_id || item.m_item?.uom_id || '',
        uom_name: item.unit_precost?.value1 || item.m_item?.mi_uom?.value1 || 'KG',
        berat_jenis: sg,
        price: harga,
        volume: 0,
        amount: 0,
        notes: '',
        chemical_precost_id: item.id,
        chemical_precost_no: item.no,
      })
    }
  }

  if (refSpek === 'TUBE') {
    selectedChemicalTubeId.value = item.id
    selectedChemicalTubeData.value = item
    if (sg > 0) formulaSgTube.value = sg
    if (harga > 0) formulaHargaTube.value = harga
    selectedTubeMaterialKey.value = item.m_item_id || namaItem
  } else if (refSpek === 'COVER_TUBE') {
    selectedChemicalCoverTubeId.value = item.id
    selectedChemicalCoverTubeData.value = item
    if (sg > 0) formulaSgCoverTube.value = sg
    if (harga > 0) formulaHargaCoverTube.value = harga
    selectedCoverTubeMaterialKey.value = item.m_item_id || namaItem
  } else if (refSpek === 'COVER') {
    selectedChemicalCoverId.value = item.id
    selectedChemicalCoverData.value = item
    if (sg > 0) formulaSgCover.value = sg
    if (harga > 0) formulaHargaCover.value = harga
    selectedCoverMaterialKey.value = item.m_item_id || namaItem
  } else if (refSpek === 'ROD') {
    selectedChemicalRodId.value = item.id
    selectedChemicalRodData.value = item
    if (sg > 0) formulaSgRod.value = sg
    if (harga > 0) formulaHargaRod.value = harga
    selectedRodMaterialKey.value = item.m_item_id || namaItem
  } else if (refSpek === 'SPRING') {
    if (harga > 0) formulaHargaWire.value = harga
    selectedSpringMaterialKey.value = item.m_item_id || namaItem
  } else if (refSpek === 'YARN') {
    if (harga > 0) formulaHargaYarn.value = harga
    selectedYarnMaterialKey.value = item.m_item_id || namaItem
  }

  autoChainHoseParams()
  syncGroupsToSpekArr()
  syncSpekToMaterialQuantities()
  calculateCosts()
}

const handleChemicalPrecostsAdded = (items: any[]) => {
  if (!Array.isArray(items) || items.length === 0) return
  items.forEach((item) => {
    selectChemicalPrecostItem(item, null)
  })
  toast.success(`${items.length} Pre-Costing Chemical berhasil ditambahkan ke Detail Material!`)
}

const handleSingleRowChemicalPrecostAdded = (items: any[], targetIdx: number) => {
  if (!Array.isArray(items) || items.length === 0) return
  const item = items[0]
  selectChemicalPrecostItem(item, targetIdx)
  toast.success(`Pre-Costing Chemical "${item.no}" berhasil dimasukkan ke baris ${targetIdx + 1}!`)
}

const onTubeMaterialSelectChange = (matKey: string) => {
  selectedTubeMaterialKey.value = matKey || ''
  if (!matKey) {
    formulaSgTube.value = 0
    formulaHargaTube.value = 0
    selectedChemicalTubeData.value = null
    autoChainHoseParams()
    syncGroupsToSpekArr()
    syncSpekToMaterialQuantities()
    return
  }
  const mat = detailArr.value.find((d) => (d.m_item_id || d.nama_item) === matKey)
  if (mat) {
    mat.spek_ref = 'TUBE'
    const sg = getMatBeratJenis(mat)
    const harga = Number(mat.price) || 0
    if (sg > 0) formulaSgTube.value = sg
    if (harga > 0) formulaHargaTube.value = harga
    selectedChemicalTubeData.value = {
      m_item: mat.m_item || { nama_item: mat.nama_item },
      no: mat.chemical_precost_no || mat.nama_item,
    }
    autoChainHoseParams()
    syncGroupsToSpekArr()
    syncSpekToMaterialQuantities()
    toast.success(`Kompon Tube dihubungkan ke material: ${mat.nama_item}`)
  }
}

const onCoverTubeMaterialSelectChange = (matKey: string) => {
  selectedCoverTubeMaterialKey.value = matKey || ''
  if (!matKey) {
    formulaSgCoverTube.value = 0
    formulaHargaCoverTube.value = 0
    selectedChemicalCoverTubeData.value = null
    autoChainHoseParams()
    syncGroupsToSpekArr()
    syncSpekToMaterialQuantities()
    return
  }
  const mat = detailArr.value.find((d) => (d.m_item_id || d.nama_item) === matKey)
  if (mat) {
    mat.spek_ref = 'COVER_TUBE'
    const sg = getMatBeratJenis(mat)
    const harga = Number(mat.price) || 0
    if (sg > 0) formulaSgCoverTube.value = sg
    if (harga > 0) formulaHargaCoverTube.value = harga
    selectedChemicalCoverTubeData.value = {
      m_item: mat.m_item || { nama_item: mat.nama_item },
      no: mat.chemical_precost_no || mat.nama_item,
    }
    autoChainHoseParams()
    syncGroupsToSpekArr()
    syncSpekToMaterialQuantities()
    toast.success(`Kompon Cover Tube dihubungkan ke material: ${mat.nama_item}`)
  }
}

const onCoverMaterialSelectChange = (matKey: string) => {
  selectedCoverMaterialKey.value = matKey || ''
  if (!matKey) {
    formulaSgCover.value = 0
    formulaHargaCover.value = 0
    selectedChemicalCoverData.value = null
    autoChainHoseParams()
    syncGroupsToSpekArr()
    syncSpekToMaterialQuantities()
    return
  }
  const mat = detailArr.value.find((d) => (d.m_item_id || d.nama_item) === matKey)
  if (mat) {
    mat.spek_ref = 'COVER'
    const sg = getMatBeratJenis(mat)
    const harga = Number(mat.price) || 0
    if (sg > 0) formulaSgCover.value = sg
    if (harga > 0) formulaHargaCover.value = harga
    selectedChemicalCoverData.value = {
      m_item: mat.m_item || { nama_item: mat.nama_item },
      no: mat.chemical_precost_no || mat.nama_item,
    }
    autoChainHoseParams()
    syncGroupsToSpekArr()
    syncSpekToMaterialQuantities()
    toast.success(`Kompon Cover dihubungkan ke material: ${mat.nama_item}`)
  }
}

const onRodMaterialSelectChange = (matKey: string) => {
  selectedRodMaterialKey.value = matKey || ''
  if (!matKey) {
    formulaSgRod.value = 0
    formulaHargaRod.value = 0
    selectedChemicalRodData.value = null
    autoChainHoseParams()
    syncGroupsToSpekArr()
    syncSpekToMaterialQuantities()
    return
  }
  const mat = detailArr.value.find((d) => (d.m_item_id || d.nama_item) === matKey)
  if (mat) {
    mat.spek_ref = 'ROD'
    const sg = getMatBeratJenis(mat)
    const harga = Number(mat.price) || 0
    if (sg > 0) formulaSgRod.value = sg
    if (harga > 0) formulaHargaRod.value = harga
    selectedChemicalRodData.value = {
      m_item: mat.m_item || { nama_item: mat.nama_item },
      no: mat.chemical_precost_no || mat.nama_item,
    }
    autoChainHoseParams()
    syncGroupsToSpekArr()
    syncSpekToMaterialQuantities()
    toast.success(`Material Spiral Rod dihubungkan ke: ${mat.nama_item}`)
  }
}

const onSpringMaterialSelectChange = (matKey: string) => {
  selectedSpringMaterialKey.value = matKey || ''
  if (!matKey) {
    formulaHargaWire.value = 0
    autoChainHoseParams()
    syncGroupsToSpekArr()
    syncSpekToMaterialQuantities()
    return
  }
  const mat = detailArr.value.find((d) => (d.m_item_id || d.nama_item) === matKey)
  if (mat) {
    mat.spek_ref = 'SPRING'
    const harga = Number(mat.price) || 0
    if (harga > 0) formulaHargaWire.value = harga
    autoChainHoseParams()
    syncGroupsToSpekArr()
    syncSpekToMaterialQuantities()
    toast.success(`Material Kawat Spring dihubungkan ke: ${mat.nama_item}`)
  }
}

const onYarnMaterialSelectChange = (matKey: string) => {
  selectedYarnMaterialKey.value = matKey || ''
  if (!matKey) {
    formulaHargaYarn.value = 0
    autoChainHoseParams()
    syncGroupsToSpekArr()
    syncSpekToMaterialQuantities()
    return
  }
  const mat = detailArr.value.find((d) => (d.m_item_id || d.nama_item) === matKey)
  if (mat) {
    mat.spek_ref = 'YARN'
    const harga = Number(mat.price) || 0
    if (harga > 0) formulaHargaYarn.value = harga
    autoChainHoseParams()
    syncGroupsToSpekArr()
    syncSpekToMaterialQuantities()
    toast.success(`Material Benang dihubungkan ke: ${mat.nama_item}`)
  }
}

watch(
  detailArr,
  (arr) => {
    if (!selectedTubeMaterialKey.value) {
      const tubeMat = arr.find((d) => d.spek_ref === 'TUBE' || (d.nama_item || '').toLowerCase().includes('tube'))
      if (tubeMat) {
        selectedTubeMaterialKey.value = tubeMat.m_item_id || tubeMat.nama_item
        const sg = getMatBeratJenis(tubeMat)
        const harga = Number(tubeMat.price) || 0
        if (sg > 0) formulaSgTube.value = sg
        if (harga > 0) formulaHargaTube.value = harga
      }
    }
    if (!selectedCoverTubeMaterialKey.value) {
      const ctMat = arr.find((d) => d.spek_ref === 'COVER_TUBE' || (d.nama_item || '').toLowerCase().includes('cover tube') || (d.nama_item || '').toLowerCase().includes('middle'))
      if (ctMat) {
        selectedCoverTubeMaterialKey.value = ctMat.m_item_id || ctMat.nama_item
        const sg = getMatBeratJenis(ctMat)
        const harga = Number(ctMat.price) || 0
        if (sg > 0) formulaSgCoverTube.value = sg
        if (harga > 0) formulaHargaCoverTube.value = harga
      }
    }
    if (!selectedCoverMaterialKey.value) {
      const coverMat = arr.find((d) => d.spek_ref === 'COVER' || (d.nama_item || '').toLowerCase().includes('cover'))
      if (coverMat) {
        selectedCoverMaterialKey.value = coverMat.m_item_id || coverMat.nama_item
        const sg = getMatBeratJenis(coverMat)
        const harga = Number(coverMat.price) || 0
        if (sg > 0) formulaSgCover.value = sg
        if (harga > 0) formulaHargaCover.value = harga
      }
    }
    if (!selectedRodMaterialKey.value) {
      const rodMat = arr.find((d) => d.spek_ref === 'ROD' || (d.nama_item || '').toLowerCase().includes('rod') || (d.nama_item || '').toLowerCase().includes('spiral'))
      if (rodMat) {
        selectedRodMaterialKey.value = rodMat.m_item_id || rodMat.nama_item
        const sg = getMatBeratJenis(rodMat)
        const harga = Number(rodMat.price) || 0
        if (sg > 0) formulaSgRod.value = sg
        if (harga > 0) formulaHargaRod.value = harga
      }
    }
    if (!selectedSpringMaterialKey.value) {
      const springMat = arr.find((d) => d.spek_ref === 'SPRING' || (d.nama_item || '').toLowerCase().includes('spring') || (d.nama_item || '').toLowerCase().includes('kawat'))
      if (springMat) {
        selectedSpringMaterialKey.value = springMat.m_item_id || springMat.nama_item
        const harga = Number(springMat.price) || 0
        if (harga > 0) formulaHargaWire.value = harga
      }
    }
    if (!selectedYarnMaterialKey.value) {
      const yarnMat = arr.find((d) => d.spek_ref === 'YARN' || (d.nama_item || '').toLowerCase().includes('yarn') || (d.nama_item || '').toLowerCase().includes('benang'))
      if (yarnMat) {
        selectedYarnMaterialKey.value = yarnMat.m_item_id || yarnMat.nama_item
        const harga = Number(yarnMat.price) || 0
        if (harga > 0) formulaHargaYarn.value = harga
      }
    }
  },
  { deep: true }
)

// ============================================================================
// WIP HISTORY MODAL STATE & ACTIONS
// ============================================================================
const isWipHistoryOpen = ref(false)
const wipHistoryLoading = ref(false)
const wipHistoryList = ref<any[]>([])
const activeWipDetailIdx = ref<number | null>(null)
const activeWipDetailRow = ref<any>(null)
const wipSearchQuery = ref('')
const filterOnlySelectedWip = ref(true)

const isWipRow = (detail: any) => {
  if (!detail) return false
  const key1 = detail.m_general_item_type?.key1?.toUpperCase() || ''
  const val1 = detail.m_general_item_type?.value1?.toUpperCase() || ''
  const itemTypeKey = detail.m_item?.mi_tipe?.key1?.toUpperCase() || ''
  const itemTypeVal = detail.m_item?.mi_tipe?.value1?.toUpperCase() || ''
  const itemTypeId = detail.item_type_id || detail.m_item?.tipe_id || ''

  return (
    key1 === 'WIP' ||
    val1.includes('WORK IN PROCESS') ||
    val1.includes('WIP') ||
    itemTypeKey === 'WIP' ||
    itemTypeVal.includes('WORK IN PROCESS') ||
    itemTypeVal.includes('WIP') ||
    itemTypeId === '563f51d9-04d6-45b5-a7cb-70f4b1d62f14'
  )
}

const openWipHistory = async (detail: any, idx: number) => {
  if (!detail.m_item_id) {
    toast.warning('Silakan pilih kode material terlebih dahulu')
    return
  }
  activeWipDetailIdx.value = idx
  activeWipDetailRow.value = detail
  wipSearchQuery.value = ''
  isWipHistoryOpen.value = true
  await fetchWipHistory()
}

const fetchWipHistory = async () => {
  if (!activeWipDetailRow.value?.m_item_id) {
    wipHistoryList.value = []
    return
  }
  wipHistoryLoading.value = true
  try {
    const params = new URLSearchParams({
      join: 'true',
      filter_column_status: 'APPROVED',
      filter_column_m_item_id: activeWipDetailRow.value.m_item_id,
      no_pagination: 'true',
      order_by: 'date',
      order_type: 'DESC'
    })
    const response = await fetch(`${API_BASE_URL}/dynamic/t_precost?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`
      }
    })
    const res = await response.json()
    if (res.status === 'success' && Array.isArray(res.data)) {
      wipHistoryList.value = res.data.filter((p: any) => {
        const key1 = p.m_general?.key1?.toUpperCase() || ''
        const val1 = p.m_general?.value1?.toUpperCase() || ''
        const itemTypeKey = p.m_item?.mi_tipe?.key1?.toUpperCase() || ''
        const itemTypeVal = p.m_item?.mi_tipe?.value1?.toUpperCase() || ''
        const typeId = p.item_type_id || p.m_item?.tipe_id || ''
        return (
          key1 === 'WIP' ||
          val1.includes('WORK IN PROCESS') ||
          val1.includes('WIP') ||
          itemTypeKey === 'WIP' ||
          itemTypeVal.includes('WORK IN PROCESS') ||
          itemTypeVal.includes('WIP') ||
          typeId === '563f51d9-04d6-45b5-a7cb-70f4b1d62f14'
        )
      })
    } else {
      wipHistoryList.value = []
    }
  } catch (err) {
    console.error('Failed to fetch WIP history:', err)
    toast.error('Gagal memuat riwayat precosting WIP')
  } finally {
    wipHistoryLoading.value = false
  }
}

const filteredWipHistory = computed(() => {
  let list = wipHistoryList.value

  const q = wipSearchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter((p: any) => {
      const no = (p.no || '').toLowerCase()
      const custName = (p.m_customer?.nama_customer || p.name || '').toLowerCase()
      const itemCode = (p.m_item?.kode_item || '').toLowerCase()
      const itemName = (p.m_item?.nama_item || '').toLowerCase()
      return no.includes(q) || custName.includes(q) || itemCode.includes(q) || itemName.includes(q)
    })
  }

  return list
})

const applyWipPrecost = (precost: any) => {
  if (activeWipDetailIdx.value === null || !detailArr.value[activeWipDetailIdx.value]) {
    return
  }
  const targetDetail = detailArr.value[activeWipDetailIdx.value]

  if (precost.m_item_id) {
    targetDetail.m_item_id = precost.m_item_id
    targetDetail.m_item = precost.m_item
    targetDetail.nama_item = precost.m_item?.nama_item || ''
    targetDetail.unit_id = precost.unit_id || precost.m_item?.uom_id || ''
    targetDetail.uom_name = precost.m_item?.mi_uom?.value1 || ''
    if (precost.item_type_id && !targetDetail.item_type_id) {
      targetDetail.item_type_id = precost.item_type_id
    }
    if (precost.m_general) {
      targetDetail.m_general_item_type = precost.m_general
    }
  }

  const selectedPrice = Number(precost.price || precost.tot_unit_cost || 0)
  targetDetail.price = selectedPrice
  targetDetail.amount = Number((Number(targetDetail.qty || 0) * selectedPrice).toFixed(2))

  toast.success(`Berhasil menerapkan data dari ${precost.no}`)
  isWipHistoryOpen.value = false
}

// Errors object (manual validation)
const errors = reactive({
  flag: '',
  m_unit_bisnis_id: '',
  m_cust_id: '',
  m_item_id: '',
  qty: '',
})

// ============================================================================
// RESET FORM
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    id: '',
    m_unit_bisnis_id: '',
    no: '',
    flag: 'INTERNAL',
    date: getTodayDateString(),
    m_cust_id: '',
    shipto_id: '',
    name: '',
    address: '',
    m_item_id: '',
    item_type_id: '',
    qty: 1,
    unit_id: '',
    mtr_amt: 0,
    ohd_pct: 0,
    ohd_amt: 0,
    dl_pct: 0,
    dl_amt: 0,
    tot_cogm: 0,
    mkt_pct: 0,
    mkt_amt: 0,
    adm_pct: 0,
    adm_amt: 0,
    tot_unit_cost: 0,
    pack_amt: 0,
    dlv_amt: 0,
    tot_other_cost: 0,
    tot_brutto: 0,
    profit_pct: 0,
    profit_amt: 0,
    tot_netto: 0,
    price: 0,
    benchmark: 0,
    profit_bmk: 0,
    selisih: 0,
    notes: '',
    status: 'DRAFT',
    batch_weight: 0,
    base_resin: 0,
    total_volume: 0,
    sg_compound: 0,
    total_biaya_material: 0,
    harga_per_kg_compound: 0,
  })

  selectedUnitBisnisCompanyName.value = ''
  selectedUnitBisnisName.value = ''
  selectedCustomerName.value = ''
  selectedShipToName.value = ''
  selectedItemName.value = ''
  selectedItemUomName.value = ''
  selectedItemTypeName.value = ''
  selectedItemTypeKey.value = ''

  spekArr.value = []
  layerGroups.value = []

  errors.m_unit_bisnis_id = ''
  errors.m_cust_id = ''
  errors.m_item_id = ''
  errors.qty = ''
  errors.flag = ''

  detailArr.value = []
}

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================
onBeforeMount(async () => {
  onReset()

  // Load master general for layer, spec, uom mapping
  try {
    const [resLayer, resSpec, resUom] = await Promise.all([
      fetch(`${API_BASE_URL}/dynamic/m_general?filter_column_group=m_layer&no_pagination=true`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      }),
      fetch(`${API_BASE_URL}/dynamic/m_general?filter_column_group=m_spec&no_pagination=true`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      }),
      fetch(`${API_BASE_URL}/dynamic/m_general?filter_column_group=UOM&no_pagination=true`, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      }),
    ])
    const [layerData, specData, uomData] = await Promise.all([resLayer.json(), resSpec.json(), resUom.json()])
    if (layerData.status === 'success' && Array.isArray(layerData.data)) {
      rawLayers.value = layerData.data
      layerData.data.forEach((item: any) => { layerMap.value[item.id] = item.value1 })
    }
    if (specData.status === 'success' && Array.isArray(specData.data)) {
      rawSpecs.value = specData.data
      specData.data.forEach((item: any) => { spekMap.value[item.id] = item.value1 })
    }
    if (uomData.status === 'success' && Array.isArray(uomData.data)) {
      rawUoms.value = uomData.data
      uomData.data.forEach((item: any) => { uomMap.value[item.id] = item.value1 })
    }
  } catch (error) {
    console.error('Failed to load master layer/spec/uom', error)
  }

  const isCopyModeLocal = !!route.query.copy || (route.query.action === 'copy' && route.query.source)
  const sourceId = route.query.copy ? String(route.query.copy) : (isCopyModeLocal ? String(route.query.source) : menuId.value)
  
  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    applyCurrentUserUnitBisnis()
    initLayerGroups()
    return
  }
  
  loading.value = true
  try {
    const res = await getPrecostById(sourceId)
    if (res.status !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data

    if (!isCopyModeLocal) {
      auditMeta.value = {
        created_by: initialValues.precost_ctr?.name || initialValues.precost_ctr?.username || initialValues.created_by,
        createdAt: initialValues.createdAt,
        updated_by: initialValues.precost_updt?.name || initialValues.precost_updt?.username || initialValues.updated_by || initialValues.update_by,
        updatedAt: initialValues.updatedAt,
      }
    } else {
      auditMeta.value = {}
    }

    if (initialValues.t_precost_ds) {
      detailArr.value = initialValues.t_precost_ds.map((d: any) => {
        const copyD = { ...d }
        if (isCopyModeLocal) {
          delete copyD.id
          delete copyD.t_precost_id
        }
        let spekRef = d.spek_ref || ''
        if (!spekRef && d.notes) {
          if (d.notes.includes('[REF: TUBE]')) spekRef = 'TUBE'
          else if (d.notes.includes('[REF: COVER]')) spekRef = 'COVER'
          else if (d.notes.includes('[REF: YARN]')) spekRef = 'YARN'
        }
        return {
          ...copyD,
          spek_ref: spekRef,
          is_main: !!d.is_main,
          berat_jenis: d.berat_jenis != null && d.berat_jenis !== 0 ? Number(d.berat_jenis) : (d.m_item?.berat_jenis != null ? Number(d.m_item.berat_jenis) : 0),
          nama_item: d.m_item?.nama_item || '',
          uom_name: d.unit_precost?.value1 || d.m_item?.mi_uom?.value1 || '',
          m_general_item_type: d.item_type_precost || d.m_item?.mi_tipe || null,
        }
      })
    }

    const rawSpeks = initialValues.t_precost_d_speks || initialValues.t_precost_d_spek || []
    if (rawSpeks.length) {
      spekArr.value = (rawSpeks as any[])
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
        .map((s: any) => {
          const copyS = { ...s }
          if (isCopyModeLocal) {
            delete copyS.id
            delete copyS.precost_id
          }
          const layerDisplay = s.m_layer?.value1 || layerMap.value[s.layer_id] || ''
          const paramDisplay = s.m_spec?.value1 || s.param_spec?.value1 || spekMap.value[s.param_id] || ''
          const unitDisplay = s.m_uom?.value1 || s.m_general?.value1 || uomMap.value[s.unit_id] || ''
          return {
            ...copyS,
            layer_display: layerDisplay,
            param_display: paramDisplay,
            unit_display: unitDisplay,
            value: s.value != null ? String(s.value).replace('.', ',') : '',
          }
        })
    }
    initLayerGroups()

    if (isCopyModeLocal) {
      delete (initialValues as any).id
      delete (initialValues as any).no
      delete (initialValues as any).createdAt
      delete (initialValues as any).updatedAt
      initialValues.status = 'DRAFT'
    }

    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore dynamic assign
        values[key] = initialValues[key]
      }
    }

    if (initialValues.type) {
      values.type = initialValues.type
    } else if (rawSpeks && rawSpeks.length > 0) {
      values.type = 'SPESIFIK'
    } else if (initialValues.t_precost_ds?.some((d: any) => d.is_main)) {
      values.type = 'CHEMICAL'
    } else {
      values.type = 'GENERAL'
    }

    if (values.date) {
      values.date = values.date.slice(0, 10)
    }

    selectedUnitBisnisName.value = initialValues.m_unit_bisni?.nama_comp || ''
    if (values.m_unit_bisnis_id) {
      fetchUnitBisnisCompanyName(values.m_unit_bisnis_id)
    }
    selectedCustomerName.value = initialValues.m_customer?.nama_customer || ''
    selectedShipToName.value = initialValues.m_customer_d_alamat?.nama || ''
    selectedItemName.value = initialValues.m_item?.nama_item || ''
    selectedItemUomName.value = initialValues.m_item?.mi_uom?.value1 || ''

    if (initialValues.item_type_id) {
      values.item_type_id = initialValues.item_type_id
      const itGen = initialValues.m_general || initialValues.m_item?.mi_tipe
      selectedItemTypeName.value = itGen?.value1 || ''
      selectedItemTypeKey.value = itGen?.key1 || ''
      if (!selectedItemTypeName.value && values.item_type_id) {
        apiCall<any>(`/dynamic/m_general/${values.item_type_id}`).then((res) => {
          if (res?.data) {
            selectedItemTypeName.value = res.data.value1 || ''
            selectedItemTypeKey.value = res.data.key1 || ''
          }
        }).catch(() => {})
      }
    } else if (initialValues.m_item?.tipe_id) {
      values.item_type_id = initialValues.m_item.tipe_id
      selectedItemTypeName.value = initialValues.m_item?.mi_tipe?.value1 || ''
      selectedItemTypeKey.value = initialValues.m_item?.mi_tipe?.key1 || ''
    }

    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai Precost baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Precost', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/production/transaksi/t_precost')
      }
    })
    setTimeout(() => router.push('/production/transaksi/t_precost'), 2000)
  } finally {
    loading.value = false
  }
})

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  errors.flag = ''
  errors.m_unit_bisnis_id = ''
  errors.m_cust_id = ''
  errors.m_item_id = ''
  errors.qty = ''

  let invalid = false
  if (!values.flag) { errors.flag = 'Flag wajib diisi'; invalid = true }
  if (!values.m_unit_bisnis_id) { errors.m_unit_bisnis_id = 'Unit Bisnis wajib diisi'; invalid = true }
  if (values.flag !== 'INTERNAL' && !values.m_cust_id) { errors.m_cust_id = 'Customer wajib diisi'; invalid = true }
  if (!values.m_item_id) { errors.m_item_id = 'Item wajib diisi'; invalid = true }
  if (!values.qty || Number(values.qty) <= 0) {
    errors.qty = isTypeSpesifik.value
      ? 'Kalkulasi spesifikasi belum menghasilkan berat selang (Qty)'
      : 'Qty harus lebih besar dari 0'
    invalid = true
  }

  // Validate detail rows
  for (let i = 0; i < detailArr.value.length; i++) {
    const d = detailArr.value[i]
    if (!d.item_type_id) {
      toast.error('Detail Validasi Gagal', { description: `Baris ${i + 1}: Type Material wajib diisi` })
      return
    }
    if (!d.m_item_id) {
      toast.error('Detail Validasi Gagal', { description: `Baris ${i + 1}: Kode Material wajib diisi` })
      return
    }
    if (!d.qty || Number(d.qty) <= 0) {
      toast.error('Detail Validasi Gagal', { description: `Baris ${i + 1}: Qty wajib lebih besar dari 0` })
      return
    }
    if (!d.price || Number(d.price) <= 0) {
      toast.error('Detail Validasi Gagal', { description: `Baris ${i + 1}: Price wajib lebih besar dari 0` })
      return
    }
  }

  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  syncGroupsToSpekArr()

  loading.value = true
  try {
    const detailsPayload = detailArr.value.map((d, index) => ({
      id: isCopyMode.value ? undefined : (d.id || undefined),
      sequence: index + 1,
      is_main: showPhr.value ? !!d.is_main : false,
      item_type_id: d.item_type_id,
      m_item_id: d.m_item_id,
      qty: Number(d.qty),
      unit_id: d.unit_id,
      price: Number(d.price),
      amount: Number(d.amount),
      notes: d.notes || null,
      phr: showPhr.value ? (Number(getMatPhr(d)) || 0) : null,
      volume: Number(d.volume) || (getMatVolume(d) > 0 ? getMatVolume(d) : null),
    }))

    const payload: any = {
      ...values,
      type: values.type || 'GENERAL',
      batch_weight: showPhr.value ? (Number(batchWeightKg.value) || 0) : null,
      base_resin: showPhr.value ? (Number(baseResinKg.value) || 0) : null,
      total_volume: showPhr.value ? (Number(totalVolume.value) || 0) : null,
      sg_compound: showPhr.value ? (Number(sgCompound.value) || 0) : null,
      total_biaya_material: Number(totalHargaMaterial.value) || Number(values.mtr_amt) || 0,
      harga_per_kg_compound: showPhr.value ? (Number(hargaPerKgCompound.value) || 0) : null,
      hose_weight: isTypeSpesifik.value ? (Number(totalHoseWeightPerMeter.value) || 0) : (Number(values.hose_weight) || 0),
      hpp_material: isTypeSpesifik.value ? (Number(totalHoseCostExcludePerMeter.value) || 0) : (Number(values.hpp_material) || 0),
      hpp_material_ppn: isTypeSpesifik.value ? (Number(totalHoseCostIncludePerMeter.value) || 0) : (Number(values.hpp_material_ppn) || 0),
      m_cust_id: values.m_cust_id || null,
      shipto_id: values.shipto_id || null,
      name: values.name || null,
      address: values.address || null,
      notes: values.notes || null,
      qty: Number(values.qty),
      t_precost_ds: detailsPayload,
      t_precost_d_spek: isTypeSpesifik.value
        ? spekArr.value.map((s, index) => ({
            id: isEditMode.value ? (s.id || undefined) : undefined,
            precost_id: isEditMode.value ? menuId.value : undefined,
            sequence: index + 1,
            layer_id: s.layer_id || undefined,
            param_id: s.param_id || undefined,
            value: s.value !== undefined && s.value !== null && s.value !== '' ? String(s.value).trim().replace(',', '.') : undefined,
            unit_id: s.unit_id || undefined,
            notes: s.notes?.trim() || undefined,
          }))
        : [],
    }

    if (!isEditMode.value) {
      delete payload.id
      if (!payload.no) {
        delete payload.no
      }
    }

    if (isEditMode.value) {
      await updatePrecost(menuId.value, payload)
      toast.success('Precost berhasil diperbarui')
    } else {
      await createPrecost(payload)
      toast.success('Precost berhasil dibuat')
    }
    router.replace('/production/transaksi/t_precost?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Precost' : 'Gagal membuat Precost', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  router.push('/production/transaksi/t_precost')
}
</script>

<template>
  <div class="p-6 space-y-6 mx-auto max-w-[1400px]">
    <!-- ================================================================ -->
    <!-- HEADER SECTION -->
    <!-- ================================================================ -->
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="icon" @click="handleCancel">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div>
        <h1 class="text-2xl font-bold text-foreground">
          {{ pageTitle }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ pageDescription }}
        </p>
      </div>
    </div>

    <!-- ================================================================ -->
    <!-- FORM SECTION -->
    <!-- ================================================================ -->
    <form class="space-y-6" @submit.prevent>
      <!-- HEADER CARD -->
      <Card>
        <CardHeader>
          <CardTitle>Informasi Pre-Costing</CardTitle>
          <CardDescription>
            Isi data utama Pre-Costing
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">


          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Unit Bisnis -->
            <FieldSelect
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              :value="values.m_unit_bisnis_id"
              :display-value="selectedUnitBisnisName"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: { no_pagination: 'true', searchfield: 'kode_unit_bisnis,nama_comp', join: 'true' }
              }"
              display-field="nama_comp"
              value-field="id"
              placeholder="Pilih Unit Bisnis"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || isUnitBisnisReadonly"
              :readonly="isReadOnly || isUnitBisnisReadonly"
              :clearable="!isUnitBisnisReadonly"
              :errorText="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id || 'Pilih unit bisnis untuk transaksi'"
              @input="(v: string) => (values.m_unit_bisnis_id = v)"
              @update:valueFull="handleUnitBisnisSelected"
              class="w-full"
            />

            <!-- Company (readonly) -->
            <FieldX
              id="company_display"
              label="Company"
              :value="selectedUnitBisnisCompanyName || '-'"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              class="w-full opacity-70 bg-slate-50 dark:bg-muted/50"
            />

            <!-- Transaksi No -->
            <FieldX
              id="no"
              label="No. Transaksi"
              :value="values.no || 'Auto-Generated'"
              disabled
              readonly
              placeholder="Automated"
              class="w-full opacity-70 bg-slate-50 dark:bg-muted/50"
            />

            <!-- Date -->
            <FieldX
              id="date"
              label="Date"
              type="date"
              :value="values.date"
              @input="(v: string) => (values.date = v)"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              class="w-full"
            />

            <!-- Flag -->
            <FieldSelect
              id="flag"
              label="Flag"
              :value="values.flag"
              :options="flagOptions"
              :errorname="errors.flag ? 'failed' : ''"
              :hints="errors.flag || 'Pilih Flag (INTERNAL / EKSTERNAL)'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih Flag (INTERNAL / EKSTERNAL)"
              @input="handleFlagChange"
              class="w-full"
            />

            <!-- Tipe Pre-Costing -->
            <FieldSelect
              id="type"
              label="Tipe Pre-Costing"
              :value="values.type"
              :options="typeOptions"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih Tipe Pre-Costing"
              hints="General (Fitting), Chemical (WIP/PHR), Spesifik (Formula Spek)"
              @input="handleTypeChange"
              class="w-full"
            />

            <!-- Customer -->
            <FieldSelect
              id="m_cust_id"
              label="Customer"
              class="col-span-1"
              :value="values.m_cust_id"
              :display-value="selectedCustomerName"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_customer`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: { no_pagination: 'true', selectfield: 'id,kode_customer,nama_customer', searchfield: 'kode_customer,nama_customer' },
                onsuccess: (response: any) => {
                  if (response.data) {
                    response.data = response.data.map((item: any) => ({
                      ...item,
                      displayLabel: `${item.kode_customer} - ${item.nama_customer}`
                    }))
                  }
                  return response
                }
              }"
              display-field="displayLabel"
              value-field="id"
              placeholder="Pilih Customer"
              :required="!isReadOnly && !isInternal"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="true"
              :errorText="errors.m_cust_id ? 'failed' : ''"
              :hints="isInternal ? 'Opsional untuk Flag INTERNAL' : errors.m_cust_id"
              @input="(v: string) => (values.m_cust_id = v)"
              @update:valueFull="handleCustomerSelected"
            />

            <!-- Ship To -->
            <FieldSelect
              id="shipto_id"
              label="Ship To (Alamat Kirim)"
              :value="values.shipto_id"
              :display-value="selectedShipToName"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_customer_d_alamat`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: { 
                  no_pagination: 'true', 
                  filter_column_m_customer_id: values.m_cust_id || '00000000-0000-0000-0000-000000000000',
                  searchfield: 'nama,alamat' 
                },
                onsuccess: (response: any) => {
                  if (response.data) {
                    response.data = response.data.map((item: any) => ({
                      ...item,
                      displayLabel: `${item.nama} - ${item.alamat}`
                    }))
                  }
                  return response
                }
              }"
              display-field="displayLabel"
              value-field="id"
              placeholder="Pilih Alamat"
              :disabled="loading || isReadOnly || !values.m_cust_id"
              :readonly="isReadOnly"
              :clearable="true"
              @input="(v: string) => (values.shipto_id = v)"
              @update:valueFull="handleShipToSelected"
            />

            <!-- Name (Alamat) -->
            <FieldX
              id="name"
              label="Ship To Name"
              :value="values.name"
              disabled
              readonly
            />

            <!-- Address (Alamat) -->
            <FieldX
              id="address"
              label="Ship To Address"
              :value="values.address"
              disabled
              readonly
            />

            <!-- Tipe Item -->
            <FieldSelect
              id="item_type_id"
              label="Tipe Item"
              :value="values.item_type_id"
              :display-value="selectedItemTypeName"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: {
                  searchfield: 'value1',
                  filter_column_group: 'TIPE_ITEM',
                  filter_column_is_active: 'true',
                  no_pagination: 'true',
                  where: 'key1:WIP||key1:FG',
                },
              }"
              display-field="value1"
              value-field="id"
              placeholder="Pilih Tipe Item"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="true"
              @input="(v: string) => {
                values.item_type_id = v
                // Reset kode item jika tipe berubah
                values.m_item_id = ''
                selectedItemName = ''
                selectedItemUomName = ''
              }"
              @update:valueFull="(item: any) => {
                selectedItemTypeName = item?.value1 || ''
                selectedItemTypeKey = item?.key1 || ''
              }"
            />

            <!-- Kode Item -->
            <FieldPopup
              id="m_item_id"
              label="Kode Item"
              :value="values.m_item_id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_items`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: {
                  searchfield: 'kode_item,nama_item',
                  join: 'true',
                  ...(values.item_type_id ? { filter_column_tipe_id: values.item_type_id } : { 'filter_column_mi_tipe.key1': 'FG' }),
                }
              }"
              display-field="kode_item"
              value-field="id"
              :columns="[
                { key: 'kode_item', label: 'Kode Item', width: '150px' },
                { key: 'nama_item', label: 'Nama Item', width: '280px' },
                { key: 'berat_jenis', label: 'Berat Jenis', width: '110px' },
                { key: 'mi_uom.value1', label: 'Unit', width: '100px'}
              ]"
              :placeholder="!values.item_type_id ? 'Pilih tipe item dulu' : 'Pilih Item'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || !values.item_type_id"
              :readonly="isReadOnly"
              :clearable="true"
              :errorText="errors.m_item_id ? 'failed' : ''"
              :hints="errors.m_item_id || (!values.item_type_id ? 'Pilih tipe item terlebih dahulu' : 'Pilih kode item')"
              @input="(v: string) => (values.m_item_id = v)"
              @update:valueFull="handleItemDropdownSelected"
            />

            <!-- Nama Item -->
            <FieldX
              id="nama_item"
              label="Nama Item"
              :value="selectedItemName || '-'"
              disabled
              readonly
            />

            <!-- Qty -->
            <FieldNumber
              id="qty"
              label="Qty"
              type="decimal"
              :value="values.qty"
              :required="!isReadOnly && !isTypeSpesifik"
              :disabled="loading || isReadOnly || isTypeSpesifik"
              :readonly="isReadOnly || isTypeSpesifik"
              :errorname="errors.qty ? 'failed' : ''"
              :hints="errors.qty || (isTypeSpesifik ? 'Otomatis diambil dari kalkulasi total berat spesifikasi selang (kg)' : '')"
              @input="(v: any) => (values.qty = Number(v))"
            />

            <!-- UOM -->
            <FieldX
              id="unit"
              label="UOM"
              :value="selectedItemUomName || '-'"
              disabled
              readonly
            />

            <!-- Status -->
            <FieldX
              id="status_disp"
              label="Status"
              :value="values.status"
              disabled
              readonly
            />

            <!-- Harga Perkilo Sekali Masak (Hanya tampil pada tipe item WIP) -->
            <div v-if="showPhr" class="col-span-1 sm:col-span-1 lg:col-span-1">
              <FieldNumber
                id="harga_per_kg_compound"
                label="Harga Perkilo Sekali Masak"
                prefix="Rp"
                :value="values.harga_per_kg_compound || hargaPerKgCompound || 0"
                type="decimal"
                :min="0"
                :step="1"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                :hints="'Biaya per kg kompon sekali masak'"
                @input="(v: any) => onHargaSekaliMasakChange(v)"
              />
            </div>

            <!-- Notes (Menyatu dalam grid form) -->
            <div :class="showPhr ? 'col-span-1 sm:col-span-1 lg:col-span-1' : 'col-span-1 sm:col-span-2 lg:col-span-2'">
              <FieldX
                id="notes"
                label="Notes"
                :value="values.notes"
                @input="(v: string) => (values.notes = v)"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="Catatan tambahan"
              />
            </div>
          </div>

          <!-- ================= COMPACT ALL INFO RINGKASAN (HEADER) ================= -->
          <!-- Disatukan dalam 1 baris compact agar tidak dipisah dan hemat ruang -->
          <div class="rounded-lg border border-slate-200 dark:border-border bg-slate-50/70 dark:bg-muted/30 p-2.5">
            <div class="flex items-center justify-between gap-2 px-1 mb-1.5 flex-wrap">
              <div class="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Calculator class="h-3.5 w-3.5 text-primary" />
                <span>Ringkasan Biaya &amp; Harga Jual (All Info Ringkasan)</span>
                <span class="text-[10px] text-muted-foreground font-normal">(Tersinkron otomatis)</span>
              </div>
              <span class="text-[10.5px] font-semibold text-primary px-2 py-0.5 rounded bg-primary/10">
                Target: {{ values.qty || 0 }}{{ headerUomName ? ' ' + headerUomName : '' }}
              </span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs">
              <!-- 1. Total Material (HPP Mat) -->
              <div class="px-2.5 py-1.5 rounded-md bg-white dark:bg-card border shadow-2xs">
                <span class="text-muted-foreground block text-[10px] leading-tight">Total Material (HPP Mat)</span>
                <span class="font-bold text-xs text-foreground block mt-0.5 tabular-nums">
                  Rp {{ (values.mtr_amt || 0).toLocaleString('id-ID') }}
                </span>
              </div>

              <!-- 2. Unit Cost (HPP) -->
              <div class="px-2.5 py-1.5 rounded-md bg-white dark:bg-card border shadow-2xs">
                <span class="text-muted-foreground block text-[10px] leading-tight">Total Unit Cost (HPP{{ headerUomName ? ' / ' + headerUomName : '' }})</span>
                <span class="font-bold text-xs text-foreground block mt-0.5 tabular-nums">
                  Rp {{ (values.tot_unit_cost || 0).toLocaleString('id-ID') }}
                </span>
              </div>

              <!-- 3. Profit -->
              <div class="px-2.5 py-1.5 rounded-md bg-white dark:bg-card border shadow-2xs">
                <span class="text-muted-foreground block text-[10px] leading-tight">Profit ({{ values.profit_pct || 0 }}%)</span>
                <span class="font-bold text-xs text-emerald-700 dark:text-emerald-400 block mt-0.5 tabular-nums">
                  Rp {{ (values.profit_amt || 0).toLocaleString('id-ID') }}
                </span>
              </div>

              <!-- 4. Total COGS (Netto) -->
              <div class="px-2.5 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 shadow-2xs">
                <span class="text-emerald-700 dark:text-emerald-400 block text-[10px] font-bold uppercase tracking-wider leading-tight">Total COGS (Netto)</span>
                <span class="font-black text-xs text-emerald-900 dark:text-emerald-200 block mt-0.5 tabular-nums">
                  Rp {{ (values.tot_netto || 0).toLocaleString('id-ID') }}
                </span>
              </div>

              <!-- 5. Price per Unit -->
              <div class="px-2.5 py-1.5 rounded-md bg-primary/10 border border-primary/30 shadow-2xs">
                <span class="text-primary block text-[10px] font-bold uppercase tracking-wider leading-tight">Price{{ headerUomName ? ' / ' + headerUomName : ' / Unit' }}</span>
                <span class="font-black text-xs text-primary block mt-0.5 tabular-nums">
                  Rp {{ (values.price || 0).toLocaleString('id-ID') }}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- ================================================================ -->
      <!-- DETAIL MATERIAL CARD -->
      <!-- ================================================================ -->
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Detail Material</CardTitle>
            <CardDescription>Kelola bahan material penyusun (RM, WIP, SM)</CardDescription>
          </div>
          <div v-if="!isReadOnly" class="flex items-center gap-2">
            <ButtonMultiSelect
              v-if="isTypeSpesifik"
              title="+ Add Pre-Costing Chemical"
              buttonClass="h-9 gap-1.5 border-blue-500/80 bg-blue-50/70 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700 font-semibold shadow-2xs"
              :disabled="loading || isReadOnly"
              searchKey="no,name"
              uniqueKey="id"
              :api="chemicalPrecostApi"
              :columns="chemicalPrecostColumns"
              @add="handleChemicalPrecostsAdded"
            >
              <Button
                type="button"
                size="sm"
                variant="outline"
                class="gap-1.5 border-blue-500/80 bg-blue-50/70 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700 font-semibold shadow-2xs h-8"
                title="Pilih dan tambahkan bahan material dari dokumen Pre-Costing Chemical (Kompon Tube/Cover)"
              >
                <FlaskConical class="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Pilih Pre-Costing Chemical
              </Button>
            </ButtonMultiSelect>
            <Button
              type="button"
              size="sm"
              @click="addDetailRow"
              class="gap-1"
            >
              <Plus class="h-4 w-4" />
              Tambah Row
            </Button>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <!-- ===================== RINGKASAN COMPOUND & BAHAN BAKU (Hanya untuk Tipe Item WIP) ===================== -->
          <div v-if="showPhr" class="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
            <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div class="flex items-center gap-1.5">
                <Layers class="h-3.5 w-3.5 text-primary" />
                <span class="text-xs font-bold text-foreground">Ringkasan Compound &amp; Bahan Baku</span>
                <span class="text-[10px] text-muted-foreground">(PHR, SG Campuran, &amp; Harga/KG)</span>
              </div>
              <Button
                v-if="!isReadOnly"
                type="button"
                size="sm"
                variant="outline"
                class="h-7 px-2.5 gap-1.5 border-primary/40 text-primary hover:bg-primary/10 text-[11px]"
                @click="syncCompoundToFormula"
                title="Terapkan nilai SG dan Harga/KG compound hasil kalkulasi material ini ke Panel Formula Spek"
              >
                <Sparkles class="h-3 w-3" />
                Terapkan SG &amp; Harga ke Formula Spek
              </Button>
            </div>

            <!-- Warning jika ada material yang belum memiliki SG di master item -->
            <div v-if="materialsWithoutSg.length > 0" class="mb-2 p-2 rounded-md border border-amber-300 dark:border-amber-700/80 bg-amber-50/90 dark:bg-amber-950/40 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle class="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div class="flex-1 space-y-0.5">
                <div class="font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-1.5 text-[11px]">
                  <span>Peringatan: Berat Jenis (SG) &amp; Volume Belum Lengkap</span>
                  <span class="px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 text-[9.5px] font-bold">
                    {{ materialsWithoutSg.length }} Material Belum Ada SG
                  </span>
                </div>
                <p class="text-[11px] leading-tight text-amber-800 dark:text-amber-300">
                  Terdapat bahan baku yang <b>belum memiliki nilai Berat Jenis (SG) di Master Item</b>. Nilai Volume dan SG Compound belum akurat.
                </p>
                <div class="flex flex-wrap gap-1 pt-0.5">
                  <span v-for="mat in materialsWithoutSg" :key="mat.m_item_id" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/90 dark:bg-amber-900/60 border border-amber-300 text-amber-900 dark:text-amber-200 text-[10px] font-medium shadow-2xs">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    {{ mat.m_item?.nama_item || mat.nama_item || mat.m_item?.kode_item || mat.m_item_id }}
                  </span>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
              <div class="px-2 py-1.5 rounded-md bg-background border" title="Berat 1x Masak (Total KG Bahan Baku)">
                <span class="text-muted-foreground block text-[10px]">Berat 1x Masak</span>
                <span class="font-bold text-xs text-foreground">{{ batchWeightKg }} kg</span>
              </div>
              <div class="px-2 py-1.5 rounded-md bg-background border">
                <span class="text-muted-foreground block text-[10px]">Base Resin (Main)</span>
                <span class="font-bold text-xs text-foreground">{{ baseResinKg }} kg</span>
              </div>
              <div class="px-2 py-1.5 rounded-md bg-background border">
                <span class="text-muted-foreground block text-[10px]">Total Volume</span>
                <span class="font-bold text-xs text-foreground">{{ totalVolume }} dm³</span>
              </div>
              <div class="px-2 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <span class="text-emerald-700 dark:text-emerald-400 block text-[10px] font-medium">SG Compound</span>
                <span class="font-bold text-xs text-emerald-800 dark:text-emerald-300">{{ sgCompound > 0 ? sgCompound : '0' }} kg/dm³</span>
              </div>
              <div class="px-2 py-1.5 rounded-md bg-background border" title="Total Harga Bahan Baku 1x Masak">
                <span class="text-muted-foreground block text-[10px]">Total Biaya Sekali Masak</span>
                <span class="font-bold text-xs text-foreground">Rp {{ (totalHargaMaterial || 0).toLocaleString('id-ID') }}</span>
              </div>
              <div class="px-2 py-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" title="Sesuai Excel: Total Biaya / Berat 1x Masak">
                <span class="text-amber-700 dark:text-amber-400 block text-[10px] font-medium">Harga Perkilo Sekali Masak</span>
                <span class="font-bold text-xs text-amber-800 dark:text-amber-300">Rp {{ (hargaPerKgCompound || 0).toLocaleString('id-ID') }} /kg</span>
              </div>
            </div>
          </div>

          <!-- ===================== PANEL AUTO HITUNG SPEK UNTUK TIPE SPESIFIK ===================== -->
          <div v-if="isTypeSpesifik" id="panel-hasil-kalkulasi" class="p-2.5 rounded-lg border border-amber-200 dark:border-amber-800/80 bg-amber-50/60 dark:bg-amber-950/20">
            <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div class="flex items-center gap-1.5">
                <Sparkles class="h-3.5 w-3.5 text-amber-600" />
                <span class="text-xs font-bold text-foreground">Auto Kalkulasi Qty Material dari Spesifikasi</span>
                <span class="text-[10px] text-muted-foreground">(Rumus Selang: Tube, Cover, Yarn)</span>
              </div>
              <Button
                v-if="!isReadOnly"
                type="button"
                size="sm"
                variant="outline"
                class="h-7 px-2.5 gap-1.5 border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-100/50 text-[11px] font-semibold"
                @click="applySpekMaterialsToDetailArr"
                title="Hubungkan hasil kalkulasi Tube, Cover, Yarn langsung ke tabel detail material"
              >
                <Plus class="h-3 w-3" />
                Hubungkan Semua Lapisan ke Detail Material
              </Button>
            </div>
            <!-- Grid 6 Kolom Jejeran: Panjang, Tube, Cover, Yarn, Total Berat, HPP Material -->
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
              <div class="px-2 py-1.5 rounded-md bg-background border shadow-2xs">
                <span class="text-muted-foreground block text-[10px]">Total Panjang Produk</span>
                <span class="font-bold text-xs text-foreground">{{ getSpekCalculatedWeights().totalLengthM }} M</span>
              </div>
              <div class="px-2 py-1.5 rounded-md bg-background border shadow-2xs">
                <span class="text-muted-foreground block text-[10px]">Tube (Inner) Terhitung</span>
                <span class="font-bold text-xs text-amber-700 dark:text-amber-400">{{ getSpekCalculatedWeights().totalTubeKg }} kg</span>
                <span class="text-[9.5px] text-muted-foreground block">({{ getSpekCalculatedWeights().tubeWeightPerM }} kg/m)</span>
              </div>
              <div class="px-2 py-1.5 rounded-md bg-background border shadow-2xs">
                <span class="text-muted-foreground block text-[10px]">Cover (Outer) Terhitung</span>
                <span class="font-bold text-xs text-amber-700 dark:text-amber-400">{{ getSpekCalculatedWeights().totalCoverKg }} kg</span>
                <span class="text-[9.5px] text-muted-foreground block">({{ getSpekCalculatedWeights().coverWeightPerM }} kg/m)</span>
              </div>
              <div class="px-2 py-1.5 rounded-md bg-background border shadow-2xs">
                <span class="text-muted-foreground block text-[10px]">Yarn (Benang) Terhitung</span>
                <span class="font-bold text-xs text-amber-700 dark:text-amber-400">{{ getSpekCalculatedWeights().totalYarnKg }} kg</span>
                <span class="text-[9.5px] text-muted-foreground block">({{ getSpekCalculatedWeights().yarnWeightPerM }} kg/m)</span>
              </div>
              <div class="px-2 py-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 shadow-2xs">
                <div class="flex items-center justify-between">
                  <span class="text-emerald-700 dark:text-emerald-400 block text-[10px] font-bold uppercase tracking-wider">Total Berat</span>
                  <Scale class="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span class="font-bold text-xs text-emerald-800 dark:text-emerald-300 block mt-0.5">
                  {{ totalHoseWeightPerMeter.toFixed(4) }} <span class="text-[9px] font-normal text-emerald-600 dark:text-emerald-400">kg{{ headerUomShort ? '/' + headerUomShort : '' }}</span>
                </span>
                <span class="text-[9px] text-emerald-700/80 dark:text-emerald-400/80 block font-mono">
                  T:{{ tubeDim.weight.toFixed(3) }} | C:{{ coverDim.weight.toFixed(3) }} | Y:{{ yarnDim.weight.toFixed(3) }}
                </span>
              </div>
              <div class="px-2 py-1.5 rounded-md bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 shadow-2xs">
                <div class="flex items-center justify-between">
                  <span class="text-purple-700 dark:text-purple-400 block text-[10px] font-bold uppercase tracking-wider">HPP{{ headerUomName ? ' / ' + headerUomName : '' }}</span>
                  <Calculator class="h-3 w-3 text-purple-600 dark:text-purple-400" />
                </div>
                <span class="font-bold text-xs text-purple-900 dark:text-purple-200 block mt-0.5 tabular-nums">
                  Rp {{ totalHoseCostExcludePerMeter.toLocaleString('id-ID') }}
                </span>
                <span class="text-[9px] text-purple-600 dark:text-purple-400 block font-mono">
                  Inc PPN: Rp {{ totalHoseCostIncludePerMeter.toLocaleString('id-ID') }}
                </span>
              </div>
            </div>

            <!-- Sub info: Kompon Tube & Cover (SG & Harga) -->
            <div class="mt-1.5 pt-1.5 border-t border-amber-200/60 dark:border-amber-800/40 flex items-center justify-between flex-wrap gap-2 text-[10.5px]">
              <div class="flex items-center gap-2.5 text-slate-600 dark:text-slate-300 font-mono">
                <span class="font-semibold text-slate-800 dark:text-slate-200">Kompon Acuan:</span>
                <span>Tube: SG {{ formulaSgTube }} | Rp {{ Number(formulaHargaTube).toLocaleString('id-ID') }}/kg</span>
                <span class="text-slate-300 dark:text-slate-600">|</span>
                <span>Cover: SG {{ formulaSgCover }} | Rp {{ Number(formulaHargaCover).toLocaleString('id-ID') }}/kg</span>
              </div>
              <div class="text-[9.5px] text-muted-foreground font-mono">
                Breakdown: Tube Rp {{ tubeDim.cost.toLocaleString('id-ID') }} | Cover Rp {{ coverDim.cost.toLocaleString('id-ID') }} | Yarn Rp {{ yarnDim.cost.toLocaleString('id-ID') }}
              </div>
            </div>
          </div>

          <div class="border rounded-lg overflow-x-auto">
            <table class="w-full text-sm min-w-[1550px]">
              <thead class="bg-muted text-muted-foreground text-xs font-semibold uppercase">
                <tr>
                  <th class="px-3 py-3 text-center w-12 min-w-[48px]">No</th>
                  <th v-if="showPhr" class="px-3 py-3 text-center w-16 min-w-[64px]" title="Material Base Resin / Utama untuk referensi PHR">Main</th>
                  <th class="px-3 py-3 text-left w-[180px] min-w-[160px]">Tipe Item</th>
                  <th class="px-3 py-3 text-left w-[260px] min-w-[240px]">Kode Material</th>
                  <th class="px-3 py-3 text-left w-[220px] min-w-[200px]">Nama Material</th>
                  <th class="px-3 py-3 text-right w-[110px] min-w-[100px]">Qty</th>
                  <th class="px-3 py-3 text-center w-16 min-w-[60px]">UoM</th>
                  <th class="px-3 py-3 text-center w-[125px] min-w-[115px]" title="Specific Gravity / Berat Jenis (kg/dm³)">
                    <div class="flex items-center justify-center gap-1 text-emerald-700 dark:text-emerald-400">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>Berat Jenis (SG)</span>
                    </div>
                  </th>
                  <th class="px-3 py-3 text-center w-[120px] min-w-[110px]" title="Volume (dm³) = Qty (Kg) / Berat Jenis">
                    <div class="flex items-center justify-center gap-1 text-blue-700 dark:text-blue-400">
                      <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <span>Volume (dm³)</span>
                    </div>
                  </th>
                  <th v-if="showPhr" class="px-3 py-3 text-right w-[95px] min-w-[90px]" title="Parts per Hundred Rubber/Resin (%)">PHR</th>
                  <th class="px-3 py-3 text-right w-[160px] min-w-[150px]">Price</th>
                  <th class="px-3 py-3 text-right w-[160px] min-w-[150px]">Amount</th>
                  <th class="px-3 py-3 text-left w-[260px] min-w-[220px]">Notes</th>
                  <th v-if="!isReadOnly" class="px-3 py-3 text-center w-14 min-w-[56px]">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-if="detailArr.length === 0">
                  <td :colspan="showPhr ? 13 : 11" class="text-center py-8 text-muted-foreground">
                    Belum ada material ditambahkan. Klik "Tambah Row" di atas.
                  </td>
                </tr>
                <tr v-for="(detail, idx) in detailArr" :key="idx" class="hover:bg-muted/30">
                  <!-- No / Index -->
                  <td class="px-3 py-2 text-center text-xs font-medium w-12 min-w-[48px]">{{ idx + 1 }}</td>
                  
                  <!-- Is Main? (Hanya untuk Tipe Item WIP / PHR) -->
                  <td v-if="showPhr" class="px-3 py-2 text-center w-16 min-w-[64px]">
                    <input
                      type="checkbox"
                      v-model="detail.is_main"
                      :disabled="isReadOnly"
                      class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                    />
                  </td>

                  <!-- Type -->
                  <td class="px-3 py-2 w-[180px] min-w-[160px]">
                    <FieldSelect
                      v-if="!isReadOnly"
                      :id="`mat-type-${idx}`"
                      :value="detail.item_type_id || ''"
                      :api="{
                        url: `${API_BASE_URL}/dynamic/m_general`,
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${authStore.token}`,
                        },
                        params: {
                          searchfield: 'value1',
                          filter_column_group: 'TIPE_ITEM',
                          filter_column_is_active: 'true',
                          where: 'key1:RM||key1:WIP||key1:SM',
                          no_pagination: 'true',
                        },
                      }"
                      display-field="value1"
                      value-field="id"
                      placeholder="Pilih Tipe"
                      :disabled="loading || isReadOnly"
                      :readonly="isReadOnly"
                      :clearable="true"
                      @input="(v: string) => {
                        detail.item_type_id = v
                        // Reset material jika tipe berubah
                        detail.m_item_id = ''
                        detail.m_item = null
                        detail.nama_item = ''
                        detail.unit_id = ''
                        detail.uom_name = ''
                      }"
                      @update:valueFull="(item: any) => (detail.m_general_item_type = item)"
                      class="w-full min-w-[140px]"
                    />
                    <span v-else class="text-xs font-medium">
                      {{ detail.m_general_item_type?.value1 || detail.m_item?.mi_tipe?.value1 || '-' }}
                    </span>
                  </td>

                   <!-- Material Code Selector with History button -->
                  <td class="px-3 py-2 w-[270px] min-w-[250px]">
                    <div class="flex items-center gap-1.5 min-w-[230px]">
                      <ButtonMultiSelect
                        v-if="isTypeSpesifik && !isReadOnly"
                        title="Pilih Pre-Costing Chemical"
                        :singleSelect="true"
                        searchKey="no,name"
                        uniqueKey="id"
                        :api="chemicalPrecostApi"
                        :columns="chemicalPrecostColumns"
                        @add="(items) => handleSingleRowChemicalPrecostAdded(items, idx)"
                      >
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          class="h-9 w-9 shrink-0 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 border-blue-200 dark:border-blue-800 shadow-2xs"
                          title="Pilih bahan dari Pre-Costing Chemical"
                        >
                          <FlaskConical class="h-4 w-4" />
                        </Button>
                      </ButtonMultiSelect>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        class="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                        :class="{ 'opacity-40 cursor-not-allowed': !isWipRow(detail) || !detail.m_item_id }"
                        :disabled="!isWipRow(detail) || !detail.m_item_id"
                        :title="!isWipRow(detail) ? 'Hanya untuk material bertipe WORK IN PROCESS (WIP)' : (!detail.m_item_id ? 'Pilih kode material terlebih dahulu' : 'Lihat Riwayat Precosting WIP Approved')"
                        @click="openWipHistory(detail, idx)"
                      >
                        <History class="h-4 w-4" />
                      </Button>
                      <div class="flex-1 min-w-[160px]">
                        <FieldPopup
                          v-if="!isReadOnly"
                          :id="`mat-item-${idx}`"
                          :value="detail.m_item_id || ''"
                          :api="{
                            url: `${API_BASE_URL}/dynamic/m_items`,
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${authStore.token}`,
                            },
                            params: {
                              searchfield: 'kode_item,nama_item',
                              join: 'true',
                              filter_column_is_active: 'true',
                              ...(detail.item_type_id ? { filter_column_tipe_id: detail.item_type_id } : {}),
                            },
                          }"
                          display-field="kode_item"
                          value-field="id"
                          :columns="[
                            { key: 'kode_item', label: 'Kode Item', width: '140px' },
                            { key: 'nama_item', label: 'Nama Item', width: '220px' },
                            { key: 'berat_jenis', label: 'Berat Jenis', width: '110px' },
                            { key: 'mi_uom.value1', label: 'Unit', width: '90px' }
                          ]"
                          :placeholder="!detail.item_type_id ? 'Pilih tipe dulu' : 'Pilih Item'"
                          :disabled="loading || isReadOnly || !detail.item_type_id"
                          :readonly="isReadOnly"
                          :clearable="true"
                          @input="(v: string) => (detail.m_item_id = v)"
                          @update:valueFull="(item: any) => handleDetailMaterialSelected(detail, item)"
                          class="w-full"
                        />
                        <span v-else class="text-xs font-semibold">
                          {{ detail.m_item?.kode_item || detail.m_item?.kode || '-' }}
                        </span>
                        <div v-if="detail.chemical_precost_no" class="text-[9.5px] text-blue-700 dark:text-blue-400 font-semibold mt-0.5 flex items-center gap-1 font-mono">
                          <FlaskConical class="h-2.5 w-2.5" />
                          <span>Precost: {{ detail.chemical_precost_no }}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  <!-- Material Name (Readonly) -->
                  <td class="px-3 py-2 w-[220px] min-w-[200px]">
                    <FieldX
                      :id="`mat-name-${idx}`"
                      label=""
                      :value="detail.nama_item || detail.m_item?.nama_item || '-'"
                      :disabled="true"
                      :readonly="true"
                      class="w-full min-w-[180px]"
                    />
                  </td>

                  <!-- Qty -->
                  <td class="px-3 py-2 w-[110px] min-w-[100px]">
                    <FieldNumber
                      :id="`mat-qty-${idx}`"
                      :value="detail.qty ?? 0"
                      type="decimal"
                      :min="0"
                      :disabled="loading || isReadOnly"
                      @input="(v: string) => (detail.qty = Number(v))"
                      class="w-full min-w-[90px]"
                    />
                    <div v-if="isTypeSpesifik && detail.spek_ref" class="text-[9.5px] text-amber-700 dark:text-amber-400 font-semibold mt-0.5 flex items-center gap-0.5">
                      <Sparkles class="h-2.5 w-2.5" />
                      <span>Auto Spek</span>
                    </div>
                  </td>

                  <!-- UoM (Readonly) -->
                  <td class="px-3 py-2 text-center text-xs font-medium w-16 min-w-[60px]">{{ detail.uom_name || '-' }}</td>

                  <!-- SG / Berat Jenis (kg/dm³) dari Master Item -->
                  <td class="px-3 py-2 w-[125px] min-w-[115px]">
                    <div
                      v-if="getMatBeratJenis(detail) > 0"
                      class="w-full text-xs flex items-center justify-between px-2 py-1.5 bg-emerald-50/70 dark:bg-emerald-950/30 rounded border border-emerald-300/80 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 font-medium"
                      :title="'Auto ambil dari master item: ' + getMatBeratJenis(detail) + ' kg/dm³'"
                    >
                      <span class="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">SG</span>
                      <span class="font-bold">{{ formatCommaNumber(getMatBeratJenis(detail), 2) }}</span>
                    </div>
                    <div
                      v-else
                      class="w-full text-xs flex items-center justify-between px-2 py-1.5 bg-red-50 dark:bg-red-950/40 rounded border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 font-bold"
                      title="Data Berat Jenis di Master Item masih kosong (default 0). Harap lengkapi di Master Item."
                    >
                      <span class="text-[9px] uppercase">SG</span>
                      <span>0</span>
                    </div>
                  </td>

                  <!-- Volume (dm³) - Inputan -->
                  <td class="px-3 py-2 w-[125px] min-w-[115px]">
                    <FieldNumber
                      :id="`mat-volume-${idx}`"
                      :value="detail.volume !== undefined && detail.volume !== null && detail.volume !== '' ? detail.volume : (getMatVolume(detail) || 0)"
                      type="decimal"
                      :min="0"
                      :step="0.001"
                      :disabled="loading || isReadOnly"
                      :readonly="isReadOnly"
                      placeholder="0"
                      @input="(v: any) => {
                        detail.volume = v === '' || v == null ? null : Number(v)
                      }"
                      class="w-full min-w-[100px]"
                    />
                  </td>

                  <!-- PHR (%) (Hanya untuk Tipe Item WIP) -->
                  <td v-if="showPhr" class="px-3 py-2 w-[95px] min-w-[90px]">
                    <div
                      class="w-full min-w-[75px] text-xs text-right px-2 py-1 bg-slate-50 dark:bg-muted/50 rounded border border-slate-200 dark:border-border text-slate-700 dark:text-slate-200 font-mono"
                      :title="baseResinKg > 0 ? `(Qty ${detail.qty || 0} / Base ${baseResinKg}) × 100` : 'Centang checkbox Main pada material base resin terlebih dahulu'"
                    >
                      {{ getMatPhr(detail) }}%
                    </div>
                  </td>

                  <!-- Price -->
                  <td class="px-3 py-2 w-[160px] min-w-[150px]">
                    <FieldNumber
                      :id="`mat-price-${idx}`"
                      :value="detail.price ?? 0"
                      type="decimal"
                      :min="0"
                      :disabled="loading || isReadOnly"
                      @input="(v: string) => (detail.price = Number(v))"
                      class="w-full min-w-[130px]"
                    />
                  </td>

                  <!-- Amount (Readonly qty * price) -->
                  <td class="px-3 py-2 text-right text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap w-[160px] min-w-[150px]">
                    Rp {{ (detail.amount || 0).toLocaleString('id-ID') }}
                  </td>

                  <!-- Notes -->
                  <td class="px-3 py-2 w-[260px] min-w-[220px]">
                    <FieldX
                      :id="`mat-notes-${idx}`"
                      label=""
                      :value="detail.notes || ''"
                      :disabled="loading || isReadOnly"
                      placeholder="Notes"
                      @input="(v: string) => (detail.notes = v)"
                      class="w-full min-w-[200px]"
                    />
                  </td>

                  <!-- Delete Action -->
                  <td v-if="!isReadOnly" class="px-3 py-2 text-center w-14 min-w-[56px]">
                    <Button
                      variant="ghost"
                      size="icon"
                      class="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                      @click="removeDetailRow(idx)"
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <!-- ================================================================ -->
      <!-- DETAIL SPEK CARD (HANYA UNTUK TIPE SPESIFIK) -->
      <!-- ================================================================ -->
      <!-- ================================================================ -->
      <!-- KARTU TABEL SPESIFIKASI DINAMIS (FORMAT EXCEL LPG RED - PERSIS BOM) -->
      <!-- ================================================================ -->
      <Card v-if="isTypeSpesifik" class="overflow-hidden border-slate-200 dark:border-border shadow-xs">
        <CardHeader class="border-b bg-gradient-to-r from-slate-50 via-slate-50/70 to-blue-50/30 dark:from-muted/40 dark:via-muted/20 dark:to-blue-950/20 py-3.5 px-4">
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 rounded-lg">
                <SlidersHorizontal class="h-4 w-4" />
              </div>
              <div>
                <CardTitle class="text-[14px] font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  Detail Spesifikasi Pre-Costing
                </CardTitle>
                <CardDescription class="text-[11px] text-slate-500 dark:text-slate-400">
                  Parameter spesifikasi produk tersusun per lapisan (SPEC, TUBE, COVER, YARN, HOSE, MATERIAL) otomatis dari Master General.
                </CardDescription>
                <!-- Legend Kategori Warna -->
                <div class="flex flex-wrap items-center gap-2.5 pt-1.5 text-[10.5px]">
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-medium">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Hijau: Auto Ambil dari Kolom Lain</span>
                  </span>
                  <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-medium">
                    <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span>Kuning: Auto Kalkulasi (Rumus)</span>
                  </span>
                </div>
              </div>
            </div>

            <!-- Action Toolbar Atas -->
            <div class="flex flex-wrap items-center gap-2 shrink-0">
              <!-- Dropdown Preset Selang -->
              <div class="flex items-center gap-1.5 bg-slate-100 dark:bg-muted/60 p-0.5 px-2 rounded-md border border-slate-200 dark:border-border">
                <span class="text-[11px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">Preset:</span>
                <select
                  :value="selectedHosePresetId"
                  @change="onPresetSelectChange"
                  :disabled="loading || isReadOnly"
                  class="h-7 text-[11px] font-medium bg-transparent text-foreground focus:outline-none cursor-pointer"
                  title="Pilih preset jenis selang (Anyam 3-Layer, LPG 4-Layer, Spring Kawat, Spiral Rod, Dof)"
                >
                  <option v-for="p in HOSE_PRESETS" :key="p.id" :value="p.id" class="text-slate-900 bg-white">
                    {{ p.name }}
                  </option>
                </select>
              </div>

              <!-- Tombol Utama: Hitung Kalkulasi -->
              <Button type="button" @click="triggerRecalculate" size="sm"
                class="h-8 text-[12px] font-bold gap-1.5 bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                title="Jalankan kalkulasi dimensi selang & formula compound dan isi otomatis ke parameter">
                <Calculator class="h-3.5 w-3.5" /> Hitung Kalkulasi
              </Button>

              <!-- Tombol Tambah Layer Baru Ke Bawah -->
              <Button v-if="!isReadOnly" type="button" @click="addLayerGroup" size="sm" variant="outline"
                class="h-8 text-[11px] gap-1.5 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                title="Tambah lapisan spesifikasi baru ke bawah">
                <Plus class="h-3.5 w-3.5" /> + Tambah Layer
              </Button>

              <!-- Tombol Reset ke Template Standar Excel -->
              <Button v-if="!isReadOnly" type="button" @click="initLayerGroups(true)" size="sm" variant="outline"
                class="h-8 text-[11px] gap-1.5 border-slate-300 dark:border-border hover:bg-slate-100 dark:hover:bg-muted text-slate-600"
                title="Muat ulang lapisan standar (SPEC, TUBE, COVER, YARN, HOSE, MATERIAL)">
                <RotateCcw class="h-3.5 w-3.5 text-slate-500" /> Reset Standar
              </Button>
            </div>
          </div>

          <!-- Indikator Alur / Breadcrumb Susunan Lapisan Aktif Sesuai Preset -->
          <div class="mt-3 pt-2.5 border-t border-slate-200 dark:border-border flex flex-wrap items-center gap-1.5 text-[11px]">
            <span class="font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider mr-1">
              Struktur ({{ physicalLayers.length }} Lapisan Fisik):
            </span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
              📐 Dimensi SPEC
            </span>
            <span class="text-slate-400 font-bold text-[10px]">➔</span>
            <template v-for="(pGrp, pIdx) in physicalLayers" :key="pGrp.local_id">
              <span
                :class="[
                  'px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 shadow-2xs transition-all ring-1 ring-black/5',
                  getLayerBadgeClass(pGrp.layer_display)
                ]"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-current"></span>
                Lapisan {{ pIdx + 1 }}: {{ pGrp.layer_display }}
              </span>
              <span class="text-slate-400 font-bold text-[10px]">➔</span>
            </template>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-300 dark:bg-muted dark:text-slate-200 dark:border-slate-700">
              ⚖️ Total HOSE
            </span>
            <span class="text-slate-400 font-bold text-[10px]">➔</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700">
              💰 Total BIAYA
            </span>
          </div>
        </CardHeader>

        <CardContent class="p-4 space-y-3.5">
          <!-- ================= SUSUNAN LAYER TERSUSUN KE BAWAH ================= -->
          <div v-if="layerGroups.length === 0" class="text-center py-8 border border-dashed rounded-lg bg-slate-50/50 dark:bg-muted/10">
            <p class="text-[12px] text-slate-500 mb-2">Belum ada lapisan spek yang ditambahkan.</p>
            <Button v-if="!isReadOnly" type="button" size="sm" @click="initLayerGroups(true)" class="text-[11px] gap-1">
              <RotateCcw class="h-3 w-3" /> Muat Template Standar
            </Button>
          </div>

          <!-- Baris Lapisan Tersusun Ke Bawah (Dapat di-drag untuk reorder urutan/sequence) -->
          <div v-for="(grp, gIdx) in layerGroups" :key="grp.local_id"
            @dragover="onLayerDragOver($event, gIdx)"
            @dragleave="onLayerDragLeave"
            @drop="onLayerDrop(gIdx)"
            :class="[
              'border rounded-lg bg-white dark:bg-card overflow-hidden shadow-2xs transition-all duration-150',
              draggedLayerIndex === gIdx
                ? 'opacity-40 border-dashed border-blue-500 bg-blue-50/30 dark:bg-blue-950/20'
                : 'border-slate-200 dark:border-border',
              dropTargetLayerIndex === gIdx && draggedLayerIndex !== gIdx
                ? 'ring-2 ring-blue-500 border-blue-500 shadow-md scale-[1.003]'
                : ''
            ]">
            
            <!-- Header Baris Lapisan: Drag Handle, Nomor Sequence, Dropdown Layer, dan Aksi -->
            <div class="px-3.5 py-2.5 bg-slate-50/80 dark:bg-muted/40 border-b border-slate-200 dark:border-border flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2.5 flex-1 min-w-[280px]">
                <!-- Drag Handle & Nomor Sequence Layer -->
                <div
                  :draggable="!isReadOnly"
                  @dragstart="onLayerDragStart($event, gIdx)"
                  :class="[
                    'flex items-center gap-1 select-none py-1 px-1.5 rounded transition-all',
                    !isReadOnly ? 'cursor-grab active:cursor-grabbing hover:bg-blue-100/70 dark:hover:bg-blue-950/60 group' : ''
                  ]"
                  :title="!isReadOnly ? 'Tarik (drag) untuk memindahkan urutan/sequence layer ini' : (getPhysicalLayerNumber(grp) ? `Lapisan Fisik #${getPhysicalLayerNumber(grp)}` : grp.layer_display)">
                  <GripVertical v-if="!isReadOnly" class="h-4 w-4 text-slate-400 group-hover:text-blue-600 dark:text-slate-500 shrink-0" />
                  <span
                    :class="[
                      'h-6 rounded-full font-mono text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs transition-colors px-1.5',
                      getPhysicalLayerNumber(grp) !== null
                        ? 'bg-blue-600 text-white min-w-[28px]'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 min-w-[36px] text-[9px]'
                    ]"
                  >
                    {{ getPhysicalLayerNumber(grp) !== null ? `L${getPhysicalLayerNumber(grp)}` : (getLayerKeyFromDisplay(grp.layer_display) === 'SPEC' ? 'SPEC' : (getLayerKeyFromDisplay(grp.layer_display) === 'HOSE' ? 'HOSE' : 'BIAYA')) }}
                  </span>
                </div>

                <div class="w-56 max-w-full">
                  <FieldSelect
                    :id="`layer-select-${gIdx}`"
                    :value="grp.layer_id"
                    :api="{
                      url: `${API_BASE_URL}/dynamic/m_general`,
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                      params: { searchfield: 'value1', filter_column_group: 'm_layer', filter_column_is_active: 'true', no_pagination: 'true' },
                    }"
                    display-field="value1"
                    value-field="id"
                    placeholder="Pilih Layer"
                    :disabled="loading || isReadOnly"
                    :readonly="isReadOnly"
                    :clearable="false"
                    :display-value="grp.layer_display || layerMap[grp.layer_id] || ''"
                    @input="(v: string) => (grp.layer_id = v)"
                    @update:valueFull="(item: any) => onLayerChange(grp, grp.layer_id, item)"
                    class="w-full"
                  />
                </div>

                <!-- Badge Keterangan Peran Lapisan -->
                <span
                  :class="[
                    'text-[10px] font-bold px-2 py-0.5 rounded border shrink-0',
                    getLayerBadgeClass(grp.layer_display)
                  ]"
                >
                  {{ getLayerRoleName(grp.layer_display, grp) }}
                </span>
                <span class="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">
                  ({{ grp.params.length }} Param)
                </span>

                <!-- Dropdown Pilih Kompon Material dari Detail Material di Atas -->
                <div v-if="getLayerKeyFromDisplay(grp.layer_display) === 'TUBE'" class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-[10.5px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide shrink-0">Kompon Tube:</span>
                  <div class="w-[260px] sm:w-[320px] md:w-[360px]">
                    <FieldSelect
                      :id="`select-kompon-tube-${gIdx}`"
                      :value="selectedTubeMaterialKey"
                      :options="tubeMaterialOptions"
                      display-field="nama_item"
                      value-field="id"
                      placeholder="-- Pilih Kompon Tube --"
                      :display-value="selectedTubeMaterialDisplay"
                      :disabled="loading || isReadOnly"
                      :readonly="isReadOnly"
                      :clearable="true"
                      :bind="{ class: '!h-7 !text-[11px] !px-2 font-medium bg-blue-50/60 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100 hover:border-blue-400' }"
                      @input="(v: string) => onTubeMaterialSelectChange(v)"
                      class="w-full"
                    />
                  </div>
                  <span v-if="formulaSgTube > 0" class="text-[10px] text-blue-600 dark:text-blue-400 font-mono hidden md:inline shrink-0">
                    SG: {{ formulaSgTube }} | Rp {{ Number(formulaHargaTube).toLocaleString('id-ID') }}/kg
                  </span>
                </div>

                <div v-else-if="getLayerKeyFromDisplay(grp.layer_display) === 'COVER_TUBE'" class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-[10.5px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wide shrink-0">Kompon Cover Tube:</span>
                  <div class="w-[260px] sm:w-[320px] md:w-[360px]">
                    <FieldSelect
                      :id="`select-kompon-covertube-${gIdx}`"
                      :value="selectedCoverTubeMaterialKey"
                      :options="coverTubeMaterialOptions"
                      display-field="nama_item"
                      value-field="id"
                      placeholder="-- Pilih Kompon Cover Tube --"
                      :display-value="selectedCoverTubeMaterialDisplay"
                      :disabled="loading || isReadOnly"
                      :readonly="isReadOnly"
                      :clearable="true"
                      :bind="{ class: '!h-7 !text-[11px] !px-2 font-medium bg-amber-50/60 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100 hover:border-amber-400' }"
                      @input="(v: string) => onCoverTubeMaterialSelectChange(v)"
                      class="w-full"
                    />
                  </div>
                  <span v-if="formulaSgCoverTube > 0" class="text-[10px] text-amber-600 dark:text-amber-400 font-mono hidden md:inline shrink-0">
                    SG: {{ formulaSgCoverTube }} | Rp {{ Number(formulaHargaCoverTube).toLocaleString('id-ID') }}/kg
                  </span>
                </div>

                <div v-else-if="getLayerKeyFromDisplay(grp.layer_display) === 'COVER'" class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-[10.5px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide shrink-0">Kompon Cover:</span>
                  <div class="w-[260px] sm:w-[320px] md:w-[360px]">
                    <FieldSelect
                      :id="`select-kompon-cover-${gIdx}`"
                      :value="selectedCoverMaterialKey"
                      :options="coverMaterialOptions"
                      display-field="nama_item"
                      value-field="id"
                      placeholder="-- Pilih Kompon Cover --"
                      :display-value="selectedCoverMaterialDisplay"
                      :disabled="loading || isReadOnly"
                      :readonly="isReadOnly"
                      :clearable="true"
                      :bind="{ class: '!h-7 !text-[11px] !px-2 font-medium bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-100 hover:border-indigo-400' }"
                      @input="(v: string) => onCoverMaterialSelectChange(v)"
                      class="w-full"
                    />
                  </div>
                  <span v-if="formulaSgCover > 0" class="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono hidden md:inline shrink-0">
                    SG: {{ formulaSgCover }} | Rp {{ Number(formulaHargaCover).toLocaleString('id-ID') }}/kg
                  </span>
                </div>

                <div v-else-if="getLayerKeyFromDisplay(grp.layer_display) === 'ROD'" class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-[10.5px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wide shrink-0">Material Rod:</span>
                  <div class="w-[260px] sm:w-[320px] md:w-[360px]">
                    <FieldSelect
                      :id="`select-kompon-rod-${gIdx}`"
                      :value="selectedRodMaterialKey"
                      :options="rodMaterialOptions"
                      display-field="nama_item"
                      value-field="id"
                      placeholder="-- Pilih Material Rigid Rod --"
                      :display-value="selectedRodMaterialDisplay"
                      :disabled="loading || isReadOnly"
                      :readonly="isReadOnly"
                      :clearable="true"
                      :bind="{ class: '!h-7 !text-[11px] !px-2 font-medium bg-teal-50/60 dark:bg-teal-950/30 border-teal-300 dark:border-teal-700 text-teal-900 dark:text-teal-100 hover:border-teal-400' }"
                      @input="(v: string) => onRodMaterialSelectChange(v)"
                      class="w-full"
                    />
                  </div>
                  <span v-if="formulaSgRod > 0" class="text-[10px] text-teal-600 dark:text-teal-400 font-mono hidden md:inline shrink-0">
                    SG: {{ formulaSgRod }} | Rp {{ Number(formulaHargaRod).toLocaleString('id-ID') }}/kg
                  </span>
                </div>

                <div v-else-if="getLayerKeyFromDisplay(grp.layer_display) === 'SPRING'" class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-[10.5px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wide shrink-0">Material Kawat Spring:</span>
                  <div class="w-[260px] sm:w-[320px] md:w-[360px]">
                    <FieldSelect
                      :id="`select-kompon-spring-${gIdx}`"
                      :value="selectedSpringMaterialKey"
                      :options="springMaterialOptions"
                      display-field="nama_item"
                      value-field="id"
                      placeholder="-- Pilih Kawat Baja Spring --"
                      :display-value="selectedSpringMaterialDisplay"
                      :disabled="loading || isReadOnly"
                      :readonly="isReadOnly"
                      :clearable="true"
                      :bind="{ class: '!h-7 !text-[11px] !px-2 font-medium bg-purple-50/60 dark:bg-purple-950/30 border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-100 hover:border-purple-400' }"
                      @input="(v: string) => onSpringMaterialSelectChange(v)"
                      class="w-full"
                    />
                  </div>
                  <span v-if="formulaHargaWire > 0" class="text-[10px] text-purple-600 dark:text-purple-400 font-mono hidden md:inline shrink-0">
                    SG: 7.8 | Rp {{ Number(formulaHargaWire).toLocaleString('id-ID') }}/kg
                  </span>
                </div>

                <div v-else-if="getLayerKeyFromDisplay(grp.layer_display) === 'YARN'" class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-[10.5px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wide shrink-0">Material Benang:</span>
                  <div class="w-[260px] sm:w-[320px] md:w-[360px]">
                    <FieldSelect
                      :id="`select-kompon-yarn-${gIdx}`"
                      :value="selectedYarnMaterialKey"
                      :options="yarnMaterialOptions"
                      display-field="nama_item"
                      value-field="id"
                      placeholder="-- Pilih Benang Yarn --"
                      :display-value="selectedYarnMaterialDisplay"
                      :disabled="loading || isReadOnly"
                      :readonly="isReadOnly"
                      :clearable="true"
                      :bind="{ class: '!h-7 !text-[11px] !px-2 font-medium bg-sky-50/60 dark:bg-sky-950/30 border-sky-300 dark:border-sky-700 text-sky-900 dark:text-sky-100 hover:border-sky-400' }"
                      @input="(v: string) => onYarnMaterialSelectChange(v)"
                      class="w-full"
                    />
                  </div>
                  <span v-if="formulaHargaYarn > 0" class="text-[10px] text-sky-600 dark:text-sky-400 font-mono hidden md:inline shrink-0">
                    Rp {{ Number(formulaHargaYarn).toLocaleString('id-ID') }}/kg
                  </span>
                </div>
              </div>

              <!-- Aksi Layer: Tombol Geser Urutan, Tambah Param & Hapus Layer -->
              <div v-if="!isReadOnly" class="flex items-center gap-1.5 ml-auto">
                <!-- Tombol Navigasi Cepat Urutan Atas / Bawah -->
                <div class="flex items-center border border-slate-200 dark:border-border rounded bg-white dark:bg-card overflow-hidden shadow-2xs">
                  <button
                    type="button"
                    :disabled="gIdx === 0"
                    @click="moveLayerUp(gIdx)"
                    class="h-7 w-7 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-muted disabled:opacity-25 disabled:pointer-events-none transition-colors border-r border-slate-200 dark:border-border"
                    title="Pindahkan urutan layer ini ke atas">
                    <ChevronUp class="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    :disabled="gIdx === layerGroups.length - 1"
                    @click="moveLayerDown(gIdx)"
                    class="h-7 w-7 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-muted disabled:opacity-25 disabled:pointer-events-none transition-colors"
                    title="Pindahkan urutan layer ini ke bawah">
                    <ChevronDown class="h-3.5 w-3.5" />
                  </button>
                </div>

                <Button type="button" size="sm" variant="outline" @click="addParamToGroup(grp)"
                  class="h-7 text-[11px] gap-1 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-muted border-slate-200 dark:border-border">
                  <Plus class="h-3 w-3" /> + Param
                </Button>
                <Button type="button" size="sm" variant="ghost" @click="removeLayerGroup(gIdx)"
                  class="h-7 w-7 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded"
                  title="Hapus Lapisan Layer">
                  <Trash2 class="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <!-- Konten Parameter (Memanjang ke Kanan secara Grid Responsif) -->
            <div class="p-3">
              <div v-if="grp.params.length === 0" class="text-center py-3 text-[11px] text-slate-400">
                Belum ada parameter untuk layer ini. Klik <strong>+ Param</strong> atau ganti layer di dropdown atas.
              </div>
              <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3">
                <div v-for="(p, pIdx) in grp.params" :key="pIdx"
                  @dragover="onParamDragOver($event, gIdx, pIdx)"
                  @dragleave="onParamDragLeave"
                  @drop="onParamDrop(gIdx, pIdx)"
                  :class="[
                    'p-2 rounded-lg border text-[11px] flex flex-col justify-between transition-all relative shadow-2xs gap-1.5',
                    draggedParamInfo?.grpIdx === gIdx && draggedParamInfo?.paramIdx === pIdx
                      ? 'opacity-40 border-dashed border-blue-500 bg-blue-50/20'
                      : '',
                    dropTargetParamInfo?.grpIdx === gIdx && dropTargetParamInfo?.paramIdx === pIdx
                      ? 'ring-2 ring-blue-500 border-blue-500 scale-[1.02]'
                      : '',
                    p.is_linked
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 hover:border-emerald-400'
                      : p.is_calculated
                        ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 hover:border-amber-400'
                        : 'bg-white dark:bg-card border-slate-200 dark:border-border hover:border-slate-300'
                  ]">
                  
                  <!-- Header Param: Grip Handle + Dropdown Parameter (m_spec) + Compact Status Icon + Tombol Hapus -->
                  <div class="flex items-center gap-1.5 justify-between">
                    <span
                      v-if="!isReadOnly"
                      :draggable="!isReadOnly"
                      @dragstart="onParamDragStart($event, gIdx, pIdx)"
                      class="cursor-grab active:cursor-grabbing text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 p-0.5 rounded transition-colors"
                      title="Tarik untuk memindahkan urutan parameter">
                      <GripVertical class="h-3.5 w-3.5 shrink-0" />
                    </span>
                    <div class="flex-1 min-w-0">
                      <FieldSelect
                        :id="`param-spec-${gIdx}-${pIdx}`"
                        :value="p.nama_parameter"
                        :api="{
                          url: `${API_BASE_URL}/dynamic/m_general`,
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                          params: { searchfield: 'value1', filter_column_group: 'm_spec', filter_column_is_active: 'true', no_pagination: 'true' },
                        }"
                        display-field="value1"
                        value-field="id"
                        placeholder="Pilih Parameter"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        :clearable="false"
                        :bind="{ class: '!h-7 !text-[11px] !px-2 font-semibold' }"
                        :display-value="p.nama_parameter_display || spekMap[p.nama_parameter] || ''"
                        @input="(v: string) => (p.nama_parameter = v)"
                        @update:valueFull="(item: any) => onParamChangeInGroup(p, p.nama_parameter, item, grp)"
                        class="w-full"
                      />
                    </div>

                    <div class="flex items-center gap-1 shrink-0">
                      <!-- Status Indicator Icon with Tooltip -->
                      <span v-if="p.is_linked"
                        class="p-1 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 flex items-center justify-center cursor-help"
                        :title="`Auto mengambil data dari ${p.link_source || 'layer lain'}`">
                        <Link2 class="h-3 w-3" />
                      </span>

                      <span v-else-if="p.is_calculated"
                        class="p-1 rounded bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700 flex items-center justify-center cursor-help"
                        title="Dihitung otomatis berdasarkan rumus kalkulasi">
                        <Calculator class="h-3 w-3" />
                      </span>

                      <button v-if="!isReadOnly" type="button" @click="removeParamFromGroup(grp, pIdx)"
                        class="text-slate-300 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40" title="Hapus parameter ini">
                        <Trash2 class="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <!-- 1 BARIS: VALUE + SATUAN -->
                  <div class="flex items-center gap-1.5">
                    <div class="flex-1 min-w-0">
                      <input
                        type="text"
                        :value="p.value"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly || p.is_linked || p.is_calculated"
                        :placeholder="p.placeholder || '0'"
                        @input="(e) => onParamValueChange(grp, p, (e.target as HTMLInputElement).value)"
                        @blur="() => onParamValueBlur(grp, p)"
                        :class="[
                          'w-full h-8 text-[12px] px-2 rounded border focus:outline-none focus:ring-1 text-right font-mono transition-colors shadow-2xs',
                          p.is_linked
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/40 font-semibold text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 focus:ring-emerald-400'
                            : p.is_calculated
                              ? 'bg-amber-100/60 dark:bg-amber-950/40 font-bold text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800 focus:ring-amber-400'
                              : 'bg-white dark:bg-card text-slate-800 dark:text-slate-100 border-slate-200 dark:border-border focus:ring-blue-400'
                        ]"
                      />
                    </div>

                    <!-- Dropdown Satuan (UOM) -->
                    <div class="w-[85px] shrink-0">
                      <FieldSelect
                        :id="`param-uom-${gIdx}-${pIdx}`"
                        :value="p.satuan"
                        :api="{
                          url: `${API_BASE_URL}/dynamic/m_general`,
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                          params: { searchfield: 'value1', filter_column_group: 'UOM', filter_column_is_active: 'true', no_pagination: 'true' },
                        }"
                        display-field="value1"
                        value-field="id"
                        placeholder="Satuan"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        :clearable="false"
                        :bind="{ class: '!h-8 !text-[10.5px] !px-1.5 font-mono' }"
                        :display-value="p.satuan_display || uomMap[p.satuan] || ''"
                        @input="(v: string) => onParamUomChange(p, v)"
                        @update:valueFull="(item: any) => onParamUomChange(p, p.satuan, item)"
                        class="w-full"
                      />
                    </div>
                  </div>

                  <!-- BAWAHNYA: RUMUS / ASAL USUL NILAI -->
                  <div v-if="p.formula_text || getFormulaDesc(grp, p)"
                    :class="[
                      'text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 font-mono leading-tight',
                      p.is_linked
                        ? 'bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : p.is_calculated
                          ? 'bg-amber-100/70 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          : 'bg-slate-100 text-slate-600 dark:bg-muted dark:text-slate-300'
                    ]"
                    :title="`Asal usul nilai: ${getFormulaDesc(grp, p)}`">
                    <span class="font-semibold shrink-0">{{ p.is_linked ? '🔗' : '📐' }}</span>
                    <span class="truncate">{{ getFormulaDesc(grp, p) }}</span>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      <!-- ============ RINGKASAN HASIL KALKULASI DIMENSI (PERSIS BOM) ============ -->
      <div id="panel-hasil-kalkulasi" v-if="showCalculationPanel && (totalHoseWeightPerMeter > 0 || totalHoseCostExcludePerMeter > 0 || ((tubeDim.id > 0 && tubeDim.od <= tubeDim.id) || (coverDim.id > 0 && coverDim.od <= coverDim.id)))" class="space-y-3 pt-1">
        
        <!-- Alert Peringatan jika Dimensi Selang Keliru (OD <= ID) -->
        <div v-if="(tubeDim.id > 0 && tubeDim.od > 0 && tubeDim.od <= tubeDim.id) || (coverDim.id > 0 && coverDim.od > 0 && coverDim.od <= coverDim.id)"
          class="flex items-center justify-between text-[11px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-lg p-2.5 gap-2">
          <div class="flex items-center gap-2">
            <AlertTriangle class="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Perhatian Dimensi:</strong> Nilai Diameter Luar (OD) harus lebih besar dari Diameter Dalam (ID).
              <span v-if="tubeDim.id > 0 && tubeDim.od <= tubeDim.id" class="font-mono ml-1 text-amber-900 dark:text-amber-100 font-semibold">
                (Tube: ID {{ tubeDim.id }} mm, OD {{ tubeDim.od }} mm &rarr; Seharusnya OD &ge; {{ tubeDim.odCalculated || (tubeDim.id + 2 * (tubeDim.thick || 1)) }} mm).
              </span>
              <span v-if="coverDim.id > 0 && coverDim.od <= coverDim.id" class="font-mono ml-1 text-amber-900 dark:text-amber-100 font-semibold">
                (Cover: ID {{ coverDim.id }} mm, OD {{ coverDim.od }} mm &rarr; Seharusnya OD &ge; {{ coverDim.odCalculated || (coverDim.id + 2 * (coverDim.thick || 1)) }} mm).
              </span>
            </span>
          </div>
          <Button v-if="!isReadOnly" type="button" size="sm" @click="autoFixHoseDimensions"
            class="h-7 text-[11px] gap-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold shrink-0 shadow-2xs">
            <Sparkles class="h-3 w-3" /> Perbaiki Dimensi
          </Button>
        </div>
      </div>


      <!-- ================================================================ -->
      <!-- COST SUMMARY CARD -->
      <!-- ================================================================ -->
      <Card>
        <CardHeader class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>Cost Summary & Selling Price</CardTitle>
            <CardDescription>
              Formula penentuan harga pokok dan harga jual Pre-Costing
            </CardDescription>
          </div>
          <div v-if="!isReadOnly" class="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              @click="applyHmiCostStandard"
              class="h-8 text-[11px] font-semibold gap-1.5 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              title="Terapkan standar pabrik HMI: Labour Rp 2.000/M, Listrik Rp 1.000/M, Waste 5%, Reject 5%, PPN 11%"
            >
              <Sparkles class="h-3.5 w-3.5 text-emerald-600" /> Standar Biaya HMI
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              @click="applySpekPriceToSellingPrice"
              class="h-8 text-[11px] font-semibold gap-1.5 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/40"
              title="Salin harga per meter (+PPN 11%) dari tabel spek langsung ke Harga Jual"
            >
              <Check class="h-3.5 w-3.5 text-blue-600" /> Salin Harga Spek ke Jual
            </Button>
          </div>
        </CardHeader>
        <CardContent class="p-4 md:p-6 pt-0 md:pt-0">
          <div class="border rounded-md overflow-hidden w-full">
            <Table>
              <TableHeader class="bg-muted text-muted-foreground">
                <TableRow>
                  <TableHead class="pl-4">Komponen Biaya</TableHead>
                  <TableHead class="w-64">Input</TableHead>
                  <TableHead class="text-right w-64 pr-4">Nilai Rupiah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <!-- Material Cost -->
                <TableRow>
                  <TableCell class="font-medium py-3 pl-4">Material Cost (Total Bahan)</TableCell>
                  <TableCell></TableCell>
                  <TableCell class="text-right font-mono font-semibold py-3 pr-4 text-slate-700">
                    Rp {{ (values.mtr_amt || 0).toLocaleString('id-ID') }}
                  </TableCell>
                </TableRow>

                <!-- Overhead -->
                <TableRow>
                  <TableCell class="py-3 pl-4">Overhead Cost</TableCell>
                  <TableCell class="py-2">
                    <div class="flex items-center gap-2 w-full max-w-[280px]">
                      <FieldNumber
                        id="ohd_pct"
                        :value="values.ohd_pct ?? 0"
                        type="decimal"
                        :min="0"
                        :disabled="loading || isReadOnly"
                        placeholder="0"
                        @input="(v: string) => (values.ohd_pct = Number(v))"
                        class="w-28"
                      />
                      <span class="text-sm text-muted-foreground w-4 shrink-0 text-left">%</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground py-3 pr-4">
                    Rp {{ (values.ohd_amt || 0).toLocaleString('id-ID') }}
                  </TableCell>
                </TableRow>

                <!-- Direct Labor -->
                <TableRow>
                  <TableCell class="py-3 pl-4">Direct Labor</TableCell>
                  <TableCell class="py-2">
                    <div class="flex items-center gap-2 w-full max-w-[280px]">
                      <FieldNumber
                        id="dl_pct"
                        :value="values.dl_pct ?? 0"
                        type="decimal"
                        :min="0"
                        :disabled="loading || isReadOnly"
                        placeholder="0"
                        @input="(v: string) => (values.dl_pct = Number(v))"
                        class="w-28"
                      />
                      <span class="text-sm text-muted-foreground w-4 shrink-0 text-left">%</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground py-3 pr-4">
                    Rp {{ (values.dl_amt || 0).toLocaleString('id-ID') }}
                  </TableCell>
                </TableRow>

                <!-- Total COGM -->
                <TableRow class="bg-muted/50 font-semibold border-t-2 dark:bg-muted/30">
                  <TableCell class="py-3 pl-4">Total COGM (Netto)</TableCell>
                  <TableCell></TableCell>
                  <TableCell class="text-right font-mono py-3 pr-4 text-foreground font-bold">
                    Rp {{ (values.tot_cogm || 0).toLocaleString('id-ID') }}
                  </TableCell>
                </TableRow>

                <!-- Marketing -->
                <TableRow>
                  <TableCell class="py-3 pl-4">Marketing Cost</TableCell>
                  <TableCell class="py-2">
                    <div class="flex items-center gap-2 w-full max-w-[280px]">
                      <FieldNumber
                        id="mkt_pct"
                        :value="values.mkt_pct ?? 0"
                        type="decimal"
                        :min="0"
                        :disabled="loading || isReadOnly"
                        placeholder="0"
                        @input="(v: string) => (values.mkt_pct = Number(v))"
                        class="w-28"
                      />
                      <span class="text-sm text-muted-foreground w-4 shrink-0 text-left">%</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground py-3 pr-4">
                    Rp {{ (values.mkt_amt || 0).toLocaleString('id-ID') }}
                  </TableCell>
                </TableRow>

                <!-- Administration -->
                <TableRow>
                  <TableCell class="py-3 pl-4">Administration Cost</TableCell>
                  <TableCell class="py-2">
                    <div class="flex items-center gap-2 w-full max-w-[280px]">
                      <FieldNumber
                        id="adm_pct"
                        :value="values.adm_pct ?? 0"
                        type="decimal"
                        :min="0"
                        :disabled="loading || isReadOnly"
                        placeholder="0"
                        @input="(v: string) => (values.adm_pct = Number(v))"
                        class="w-28"
                      />
                      <span class="text-sm text-muted-foreground w-4 shrink-0 text-left">%</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground py-3 pr-4">
                    Rp {{ (values.adm_amt || 0).toLocaleString('id-ID') }}
                  </TableCell>
                </TableRow>

                <!-- Total Unit Cost -->
                <TableRow class="bg-muted/50 font-semibold border-t-2 dark:bg-muted/30">
                  <TableCell class="py-3 pl-4">Total Unit Cost (HPP{{ headerUomName ? ' / ' + headerUomName : '' }})</TableCell>
                  <TableCell></TableCell>
                  <TableCell class="text-right font-mono py-3 pr-4 text-foreground font-bold">
                    Rp {{ (values.tot_unit_cost || 0).toLocaleString('id-ID') }}
                  </TableCell>
                </TableRow>

                <!-- Packing Cost -->
                <TableRow>
                  <TableCell class="py-3 pl-4">Packing Cost</TableCell>
                  <TableCell class="py-2">
                    <div class="flex items-center gap-2 w-full max-w-[280px]">
                      <span class="text-sm text-muted-foreground w-6 shrink-0 text-right">Rp</span>
                      <FieldNumber
                        id="pack_amt"
                        :value="values.pack_amt ?? 0"
                        type="decimal"
                        :min="0"
                        :disabled="loading || isReadOnly"
                        placeholder="0"
                        @input="(v: string) => (values.pack_amt = Number(v))"
                        class="flex-1"
                      />
                    </div>
                  </TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground py-3 pr-4">
                    Rp {{ (values.pack_amt || 0).toLocaleString('id-ID') }}
                  </TableCell>
                </TableRow>

                <!-- Delivery Cost -->
                <TableRow>
                  <TableCell class="py-3 pl-4">Delivery Cost</TableCell>
                  <TableCell class="py-2">
                    <div class="flex items-center gap-2 w-full max-w-[280px]">
                      <span class="text-sm text-muted-foreground w-6 shrink-0 text-right">Rp</span>
                      <FieldNumber
                        id="dlv_amt"
                        :value="values.dlv_amt ?? 0"
                        type="decimal"
                        :min="0"
                        :disabled="loading || isReadOnly"
                        placeholder="0"
                        @input="(v: string) => (values.dlv_amt = Number(v))"
                        class="flex-1"
                      />
                    </div>
                  </TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground py-3 pr-4">
                    Rp {{ (values.dlv_amt || 0).toLocaleString('id-ID') }}
                  </TableCell>
                </TableRow>

                <!-- Total Other Cost -->
                <TableRow class="bg-muted/50 font-semibold border-t-2 dark:bg-muted/30">
                  <TableCell class="py-3 pl-4">Total Other Cost</TableCell>
                  <TableCell></TableCell>
                  <TableCell class="text-right font-mono py-3 pr-4 text-foreground font-bold">
                    Rp {{ (values.tot_other_cost || 0).toLocaleString('id-ID') }}
                  </TableCell>
                </TableRow>

                <!-- Total Brutto -->
                <TableRow class="bg-muted/50 font-semibold dark:bg-muted/30">
                  <TableCell class="py-3 pl-4">Total Brutto</TableCell>
                  <TableCell></TableCell>
                  <TableCell class="text-right font-mono py-3 pr-4 text-foreground font-bold">
                    Rp {{ (values.tot_brutto || 0).toLocaleString('id-ID') }}
                  </TableCell>
                </TableRow>

                <!-- Profit -->
                <TableRow>
                  <TableCell class="py-3 pl-4">Profit</TableCell>
                  <TableCell class="py-2">
                    <div class="flex items-center gap-2 w-full max-w-[280px]">
                      <FieldNumber
                        id="profit_pct"
                        :value="values.profit_pct ?? 0"
                        type="decimal"
                        :min="0"
                        :disabled="loading || isReadOnly"
                        placeholder="0"
                        @input="(v: string) => (values.profit_pct = Number(v))"
                        class="w-28"
                      />
                      <span class="text-sm text-muted-foreground w-4 shrink-0 text-left">%</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground py-3 pr-4">
                    Rp {{ (values.profit_amt || 0).toLocaleString('id-ID') }}
                  </TableCell>
                </TableRow>

                <!-- Total COGS / Netto -->
                <TableRow class="bg-muted/50 font-semibold border-t-2 dark:bg-muted/30">
                  <TableCell class="py-3 pl-4">Total COGS (Netto)</TableCell>
                  <TableCell></TableCell>
                  <TableCell class="text-right font-mono py-3 pr-4 text-foreground font-bold">
                    Rp {{ (values.tot_netto || 0).toLocaleString('id-ID') }}
                  </TableCell>
                </TableRow>

                <!-- Selling Price / Unit -->
                <TableRow class="bg-primary/5 font-bold border-t-2 text-primary border-primary/20">
                  <TableCell class="py-4 text-base pl-4">Selling Price{{ headerUomName ? ' / ' + headerUomName : ' / Unit' }}</TableCell>
                  <TableCell></TableCell>
                  <TableCell class="text-right font-mono text-lg py-4 pr-4 font-bold">
                    Rp {{ (values.price || 0).toLocaleString('id-ID') }}
                  </TableCell>
                </TableRow>

                <!-- Benchmark -->
                <TableRow>
                  <TableCell class="py-3 pl-4">Benchmark</TableCell>
                  <TableCell class="py-2">
                    <div class="flex items-center gap-2 w-full max-w-[280px]">
                      <span class="text-sm text-muted-foreground w-6 shrink-0 text-right">Rp</span>
                      <FieldNumber
                        id="benchmark"
                        :value="values.benchmark ?? 0"
                        type="decimal"
                        :min="0"
                        :disabled="loading || isReadOnly"
                        placeholder="0"
                        @input="(v: string) => (values.benchmark = Number(v))"
                        class="flex-1"
                      />
                    </div>
                  </TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground py-3 pr-4">
                    Rp {{ (values.benchmark || 0).toLocaleString('id-ID') }}
                  </TableCell>
                </TableRow>

                <!-- Selisih dari Benchmark -->
                <TableRow class="bg-muted/50 font-semibold border-t-2 dark:bg-muted/30">
                  <TableCell class="py-3 pl-4">Selisih dari Benchmark</TableCell>
                  <TableCell></TableCell>
                  <TableCell class="text-right font-mono py-3 pr-4 text-foreground font-bold"
                    :class="values.benchmark > 0 ? (values.selisih >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400') : ''">
                    {{ values.benchmark > 0 ? (values.selisih >= 0 ? '+' : '') + 'Rp ' + (values.selisih || 0).toLocaleString('id-ID') : '-' }}
                  </TableCell>
                </TableRow>

                <!-- % Profit dari Benchmark -->
                <TableRow class="bg-primary/5 font-bold border-t-2 text-primary border-primary/20">
                  <TableCell class="py-4 text-base pl-4">% Profit dari Benchmark</TableCell>
                  <TableCell></TableCell>
                  <TableCell class="text-right font-mono text-lg py-4 pr-4 font-bold"
                    :class="values.profit_bmk >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
                    {{ values.benchmark > 0 ? (values.profit_bmk >= 0 ? '+' : '') + (values.profit_bmk || 0).toLocaleString('id-ID') + '%' : '-' }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <!-- ================================================================ -->
      <!-- ACTION BUTTONS -->
      <!-- ================================================================ -->
      <AuditInfo
        v-if="isViewMode || isEditMode"
        :created-by="auditMeta.created_by"
        :created-at="auditMeta.createdAt"
        :updated-by="auditMeta.updated_by"
        :updated-at="auditMeta.updatedAt"
        class="mt-6"
      />

      <div
        class="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-end sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t sm:border-0 -mx-6 px-6 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:static">
        <Button type="button" variant="outline" @click="handleCancel" :disabled="loading" class="w-full sm:w-auto">
          {{ isReadOnly ? 'Kembali' : 'Batal' }}
        </Button>
        <Button v-if="!isReadOnly" type="button" @click="onSave" :disabled="loading" class="gap-2 w-full sm:w-auto">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          {{ isEditMode ? 'Perbarui' : 'Simpan' }}
        </Button>
      </div>
    </form>

    <!-- ================================================================ -->
    <!-- WIP HISTORY POPUP MODAL -->
    <!-- ================================================================ -->
    <Dialog :open="isWipHistoryOpen" @update:open="isWipHistoryOpen = $event">
      <DialogContent class="max-w-5xl! w-[95vw] max-h-[90vh] p-0 flex flex-col overflow-hidden">
        <!-- Modal Header -->
        <div class="px-6 py-4 border-b bg-muted/30 flex flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
                <History class="w-5 h-5" />
              </div>
              <div>
                <DialogTitle class="text-base font-semibold">Riwayat Precosting WIP (Approved)</DialogTitle>
                <DialogDescription class="text-xs text-muted-foreground mt-0.5">
                  Precosting approved untuk item:
                  <span class="font-semibold text-foreground font-mono ml-1">{{ activeWipDetailRow?.m_item?.kode_item }}</span>
                  <span v-if="activeWipDetailRow?.nama_item || activeWipDetailRow?.m_item?.nama_item"> - {{ activeWipDetailRow?.nama_item || activeWipDetailRow?.m_item?.nama_item }}</span>
                </DialogDescription>
              </div>
            </div>
          </div>

          <!-- Controls: Search & Refresh -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div class="relative flex-1 max-w-sm">
              <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                v-model="wipSearchQuery"
                placeholder="Cari No. Precost, Customer..."
                class="pl-8 h-9 text-xs"
              />
              <button
                v-if="wipSearchQuery"
                type="button"
                @click="wipSearchQuery = ''"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X class="h-3.5 w-3.5" />
              </button>
            </div>

            <div class="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="h-8 text-xs gap-1"
                :disabled="wipHistoryLoading"
                @click="fetchWipHistory"
              >
                <RotateCcw class="h-3.5 w-3.5" :class="{ 'animate-spin': wipHistoryLoading }" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <!-- Modal Body / Table -->
        <div class="flex-1 overflow-auto p-6">
          <div v-if="wipHistoryLoading" class="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 class="h-8 w-8 animate-spin text-primary" />
            <p class="text-sm">Memuat data riwayat WIP...</p>
          </div>

          <div v-else-if="filteredWipHistory.length === 0" class="py-12 text-center text-muted-foreground">
            <History class="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
            <p class="text-sm font-medium">Tidak ada data riwayat precosting approved untuk item {{ activeWipDetailRow?.m_item?.kode_item || '' }}</p>
            <p class="text-xs text-muted-foreground mt-1">
              Item WIP ini belum pernah disetujui (Approved) pada dokumen precosting sebelumnya.
            </p>
          </div>

          <div v-else class="border rounded-lg overflow-x-auto">
            <table class="w-full text-xs min-w-[850px]">
              <thead class="bg-muted/60 text-muted-foreground font-semibold uppercase text-[11px]">
                <tr>
                  <th class="px-3 py-2.5 text-left w-10">No</th>
                  <th class="px-3 py-2.5 text-left w-[170px]">No. Precost</th>
                  <th class="px-3 py-2.5 text-left w-[95px]">Tanggal</th>
                  <th class="px-3 py-2.5 text-left w-[150px]">Customer</th>
                  <th class="px-3 py-2.5 text-left w-[130px]">Kode Item</th>
                  <th class="px-3 py-2.5 text-left">Nama Material</th>
                  <th class="px-3 py-2.5 text-right w-[80px]">Qty</th>
                  <th class="px-3 py-2.5 text-right w-[110px]">HPP (Cost)</th>
                  <th class="px-3 py-2.5 text-right w-[120px]">Harga (Price)</th>
                  <th class="px-3 py-2.5 text-center w-[85px]">Status</th>
                  <th v-if="!isReadOnly" class="px-3 py-2.5 text-center w-[90px]">Aksi</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr
                  v-for="(hist, hIdx) in filteredWipHistory"
                  :key="hist.id"
                  class="hover:bg-muted/40 transition-colors"
                >
                  <td class="px-3 py-2 text-center font-mono text-muted-foreground">{{ hIdx + 1 }}</td>
                  <td class="px-3 py-2 font-medium font-mono text-primary flex items-center gap-1">
                    <span>{{ hist.no }}</span>
                    <a
                      :href="`/production/transaksi/t_precost/view/${hist.id}`"
                      target="_blank"
                      title="Lihat Detail Precosting"
                      class="text-muted-foreground hover:text-foreground inline-block ml-1"
                    >
                      <ExternalLink class="h-3 w-3" />
                    </a>
                  </td>
                  <td class="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {{ hist.date ? new Date(hist.date).toLocaleDateString('id-ID') : '-' }}
                  </td>
                  <td class="px-3 py-2 font-medium text-foreground">
                    {{ hist.m_customer?.nama_customer || hist.name || '-' }}
                  </td>
                  <td class="px-3 py-2 font-mono font-semibold">
                    {{ hist.m_item?.kode_item || '-' }}
                  </td>
                  <td class="px-3 py-2">
                    {{ hist.m_item?.nama_item || '-' }}
                  </td>
                  <td class="px-3 py-2 text-right whitespace-nowrap font-mono">
                    {{ (Number(hist.qty) || 0).toLocaleString('id-ID') }}
                    <span class="text-[10px] text-muted-foreground">{{ hist.m_item?.mi_uom?.value1 || '' }}</span>
                  </td>
                  <td class="px-3 py-2 text-right font-mono text-muted-foreground whitespace-nowrap">
                    Rp {{ (Number(hist.tot_unit_cost || hist.tot_cogm) || 0).toLocaleString('id-ID') }}
                  </td>
                  <td class="px-3 py-2 text-right font-mono font-bold text-foreground whitespace-nowrap">
                    Rp {{ (Number(hist.price) || 0).toLocaleString('id-ID') }}
                  </td>
                  <td class="px-3 py-2 text-center whitespace-nowrap">
                    <span class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                      {{ hist.status }}
                    </span>
                  </td>
                  <td v-if="!isReadOnly" class="px-3 py-2 text-center whitespace-nowrap">
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      class="h-7 text-xs px-2.5 gap-1"
                      @click="applyWipPrecost(hist)"
                    >
                      <Check class="h-3.5 w-3.5" />
                      Gunakan
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-6 py-3 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
          <span>Total: {{ filteredWipHistory.length }} data precosting approved</span>
          <Button type="button" variant="outline" size="sm" @click="isWipHistoryOpen = false">
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>

  </div>
</template>

<style scoped>
.required::after {
  content: " *";
  color: hsl(var(--destructive));
}
</style>
