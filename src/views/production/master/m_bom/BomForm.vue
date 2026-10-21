<script setup lang="ts">
import AuditInfo from '@/components/AuditInfo.vue'
const auditMeta = ref<any>({})

// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, computed, onBeforeMount, watch, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trash2,
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Calculator,
  HelpCircle,
  FileSpreadsheet,
  Info,
  BookOpen,
  Layers,
  SlidersHorizontal,
  Sparkles,
  Ruler,
  Eye,
  Check,
  RotateCcw,
  RotateCw,
  Link2,
  Package,
  FlaskConical,
  ChevronUp,
  GripVertical,
} from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import { FieldSelect, FieldX, FieldNumber, FieldTextarea, FieldStatus, FieldPopup, FieldDate } from "@/components/field";
import { createBom, updateBom, getBomById, isBomUsed } from "./service";
import { getPrecostById } from "@/views/production/transaksi/t_precost/service";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DataTableMultiSelect from "@/components/table/DataTableMultiSelect.vue";

const router = useRouter();
const route = useRoute();
const { API_BASE_URL } = useApi();
const authStore = useAuthStore();

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false);

const isEditMode = computed(() => !!route.params.id && route.name === "BomForm");
const isViewMode = computed(() => route.name === "BomView");
const isCopyMode = computed(() => route.query.action === "copy" && !!route.query.source);
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true);
const menuId = computed(() => route.params.id as string);

// BOM yang sudah dipakai (approve/post di Work Order) hanya boleh ubah status
const bomUsed = ref(false);
const bomUsedLoading = ref(false);
const isUsedLocked = computed(() => isEditMode.value && !isCopyMode.value && bomUsed.value);
const locked = computed(() => isReadOnly.value || isUsedLocked.value);

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail BOM";
  if (isCopyMode.value) return "Salin BOM";
  if (isEditMode.value) return "Edit BOM";
  return "Tambah BOM";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data BOM";
  if (isCopyMode.value) return "Buat BOM baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data BOM";
  return "Buat data BOM baru";
});

// Check if user is super admin
const isSuperAdmin = computed(() => authStore.isSuperAdmin);

// Get company name from SelectRespo for non-super admin
const companyNameDisplay = computed(() => {
  if (!isSuperAdmin.value) {
    try {
      const selectRespo = localStorage.getItem("SelectRespo");
      if (selectRespo) {
        const parsed = JSON.parse(selectRespo);
        return parsed.companyName || "-";
      }
    } catch (e) {
      console.error("Failed to parse SelectRespo:", e);
    }
  }
  return "-";
});

const getTodayDateString = () => {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ============================================================================
// FORM VALUES
// ============================================================================
const values = reactive({
  m_unit_bisnis_id: "",
  m_unit_bisnis: null as any,
  no: "",
  date: getTodayDateString(),
  type: "GENERAL" as "GENERAL" | "CHEMICAL" | "SPESIFIK",
  flag: "",
  m_item_id: "",
  t_precost_id: "",
  t_precost: null as any,
  m_item: null as any,
  qty: 1,
  unit_id: "",
  unit: null as any,
  labor_cost_type: "Unit",
  labor_cost: 0,
  overhead_type: "Unit",
  overhead_cost: 0,
  notes: "",
  status: true,
  version: "V1",
  is_specific: false,
  batch_weight: 0,
  base_resin: 0,
  total_volume: 0,
  sg_compound: 0,
  total_biaya_material: 0,
  harga_per_kg_compound: 0,
  hose_weight: 0,
  hpp_material: 0,
  hpp_material_ppn: 0,
});

const isTypeGeneral = computed(() => (values.type || 'GENERAL').toUpperCase() === 'GENERAL');
const isTypeChemical = computed(() => (values.type || '').toUpperCase() === 'CHEMICAL');
const isTypeSpesifik = computed(() => (values.type || '').toUpperCase() === 'SPESIFIK');

const typeOptions = [
  { label: 'General (Produk Standar)', value: 'GENERAL' },
  { label: 'Chemical (Formulasi Compound / WIP)', value: 'CHEMICAL' },
  { label: 'Spesifik (Spesifikasi Teknis Selang)', value: 'SPESIFIK' },
];

const handleTypeChange = (newType: string) => {
  const t = (newType || 'GENERAL').toUpperCase() as 'GENERAL' | 'CHEMICAL' | 'SPESIFIK';
  values.type = t;
  values.is_specific = (t === 'SPESIFIK');
  if (t === 'CHEMICAL') {
    values.flag = 'WIP';
  } else if (values.flag === 'WIP') {
    values.flag = 'FINISHED GOOD';
  }
  if (t === 'SPESIFIK') {
    syncSpekWeightToQty();
  }
};

const errors = reactive({
  m_unit_bisnis_id: "",
  flag: "",
  m_item_id: "",
  qty: "",
  t_precost_id: "",
  unit_id: "",
  routings: [] as string[],
});

// ============================================================================
// BOM DETAIL STATE
// ============================================================================
interface Material {
  _from_precost?: boolean;
  item_type_id: string;
  id?: string;
  item_type: any;
  m_item_id: string;
  m_item: any;
  is_main: boolean;
  qty: number;
  unit_id: string;
  unit: any;
  weight: number;
  phr: number;
  berat_jenis?: number; // Berat jenis auto-ambil dari master item m_items
  harga_satuan: number; // Harga beli/KG untuk kalkulasi compound
  notes: string;
  bom_mat_type?: any;
  bom_mat_unit?: any;
}

interface BomRow {
  _expanded?: boolean;
  id?: string;
  sequence: number;
  is_final: boolean;
  m_routing_id: string;
  m_routing: any;
  to_routing_id: string;
  to_routing: any;
  m_mesin_id: string;
  m_mesin: any;
  output_type: string;
  output_type_label: string;
  m_item_id: string;
  m_item: any;
  qty: number;
  unit_id: string;
  unit: any;
  time: number;
  notes: string;
  materials: Material[];
}

const bomDetails = ref<BomRow[]>([]);

const newBomRow = (): BomRow => ({
  _expanded: true,
  sequence: bomDetails.value.length + 1,
  is_final: true,
  m_routing_id: "",
  m_routing: null,
  to_routing_id: "",
  to_routing: null,
  m_mesin_id: "",
  m_mesin: null,
  output_type: "",
  m_item_id: "",
  m_item: null,
  qty: 1,
  unit_id: "",
  unit: null,
  time: 0,
  notes: "",
  output_type_label: "",
  materials: [],
});

const newMaterial = (): Material => ({
  item_type_id: "",
  item_type: null,
  m_item_id: "",
  m_item: null,
  is_main: false,
  qty: 1,
  unit_id: "",
  unit: null,
  weight: 0,
  phr: 0,
  berat_jenis: 0,
  harga_satuan: 0,
  notes: "",
});

// Co-Product State
interface CoProduct {
  sequence: number;
  item_type_id: string;
  item_type: any;
  m_item_id: string;
  m_item: any;
}

const coProducts = ref<CoProduct[]>([]);

const newCoProduct = (): CoProduct => ({
  sequence: coProducts.value.length + 1,
  item_type_id: "",
  item_type: null,
  m_item_id: "",
  m_item: null,
});

// Detail Spek State
interface DetailSpek {
  id?: string;
  _from_precost?: boolean;
  layer_id: string;
  layer_display: string;
  nama_parameter: string;
  nama_parameter_display: string;
  value: string;
  satuan: string;
  satuan_display: string;
  notes: string;
}

const uomMap = ref<Record<string, string>>({});
const spekMap = ref<Record<string, string>>({});
const layerMap = ref<Record<string, string>>({});

const rawLayers = ref<any[]>([]);
const rawSpecs = ref<any[]>([]);
const rawUoms = ref<any[]>([]);

const spekViewMode = ref<'matrix' | 'cards'>('matrix');
const showCalculationPanel = ref(true);

const detailSpek = ref<DetailSpek[]>([]);

// ============================================================================
// STRUKTUR DETAIL SPEK PER LAPISAN (LAYER TERSUSUN KE BAWAH)
// ============================================================================
export interface LayerGroupParam {
  id?: string;
  nama_parameter: string; // param_id (FK m_spec)
  nama_parameter_display: string;
  value: string;
  satuan: string; // unit_id (FK UOM)
  satuan_display: string;
  notes?: string;
  is_calculated?: boolean; // Hasil kalkulasi rumus -> Kuning
  is_linked?: boolean;     // Auto ambil dari layer/kolom lain -> Hijau
  link_source?: string;    // Sumber referensi (misal 'TUBE ID', 'COVER OD', 'TUBE OD')
  calc_key?: string;
  short_label?: string;
  placeholder?: string;
  formula_text?: string;   // Penjelasan rumus atau asal usul nilai
}

export interface LayerGroupRow {
  local_id: string;
  layer_id: string; // FK m_layer di m_general
  layer_display: string;
  params: LayerGroupParam[];
}

const layerGroups = ref<LayerGroupRow[]>([]);

const LAYER_PARAM_TEMPLATES: Record<string, Array<{
  specCode: string;
  specName: string;
  shortLabel: string;
  uom: string;
  defaultValue: string;
  isCalculated?: boolean;
  isLinked?: boolean;
  linkSource?: string;
  calcKey?: string;
  formulaText?: string;
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
};

export interface HosePresetDef {
  id: string;
  name: string;
  layers: Array<{ key: string; code: string; name: string }>;
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
];

const selectedHosePresetId = ref('STANDAR_3L');
const DEFAULT_LAYER_ORDER = HOSE_PRESETS[0].layers;

// ============================================================================
// GRID DIMENSI SELANG PER LAYER (GAYA EXCEL)
// ============================================================================
interface LayerDimensionRow {
  layer_id: string;
  layer_display?: string;
  id_val: number | '';
  thick_val: number | '';
  od_val: number | '';
  notes: string;
}

const getLayerBadgeClass = (display: string) => {
  const k = getLayerKeyFromDisplay(display);
  switch (k) {
    case 'SPEC':
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
    case 'TUBE':
      return 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700';
    case 'COVER_TUBE':
      return 'bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-700';
    case 'YARN':
      return 'bg-sky-50 text-sky-800 border-sky-300 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-700';
    case 'SPRING':
      return 'bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-700';
    case 'ROD':
      return 'bg-teal-50 text-teal-800 border-teal-300 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-700';
    case 'COVER':
      return 'bg-indigo-50 text-indigo-800 border-indigo-300 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-700';
    case 'HOSE':
      return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-muted dark:text-slate-200 dark:border-slate-700';
    case 'BAHAN_BAKU':
      return 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-muted dark:text-slate-300';
  }
};

const physicalLayers = computed(() => {
  return layerGroups.value.filter(g => {
    const k = getLayerKeyFromDisplay(g.layer_display);
    return k !== 'SPEC' && k !== 'HOSE' && k !== 'BAHAN_BAKU';
  });
});

const getPhysicalLayerNumber = (grp: LayerGroupRow) => {
  const idx = physicalLayers.value.findIndex(g => g.local_id === grp.local_id);
  return idx >= 0 ? idx + 1 : null;
};

const getLayerRoleName = (display: string, grp?: LayerGroupRow) => {
  const k = getLayerKeyFromDisplay(display);
  switch (k) {
    case 'SPEC':
      return 'Dimensi Produk (Header)';
    case 'TUBE': {
      const num = grp ? getPhysicalLayerNumber(grp) : 1;
      return `Lapisan Fisik #${num ?? 1} (Inner Tube)`;
    }
    case 'COVER_TUBE': {
      const num = grp ? getPhysicalLayerNumber(grp) : 2;
      return `Lapisan Fisik #${num ?? 2} (Cover Tengah)`;
    }
    case 'YARN': {
      const num = grp ? getPhysicalLayerNumber(grp) : 2;
      return `Lapisan Fisik #${num ?? 2} (Anyaman Benang)`;
    }
    case 'SPRING': {
      const num = grp ? getPhysicalLayerNumber(grp) : 2;
      return `Lapisan Fisik #${num ?? 2} (Kawat Baja Spiral)`;
    }
    case 'ROD': {
      const num = grp ? getPhysicalLayerNumber(grp) : 2;
      return `Lapisan Fisik #${num ?? 2} (Rod PVC Rigid)`;
    }
    case 'COVER': {
      const num = grp ? getPhysicalLayerNumber(grp) : 3;
      return `Lapisan Fisik #${num ?? 3} (Outer Cover)`;
    }
    case 'HOSE':
      return 'Ringkasan: Total Berat Selang';
    case 'BAHAN_BAKU':
      return 'Ringkasan: Total Biaya Material';
    default:
      return 'Lapisan Tambahan';
  }
};

const layerDimensions = ref<LayerDimensionRow[]>([]);

const defaultLayerRows = (): LayerDimensionRow[] => [
  {
    layer_id: '5b2c00a5-fefe-4c49-91b7-e712c13fbde3', // TUBE
    layer_display: 'TUBE',
    id_val: '',
    thick_val: '',
    od_val: '',
    notes: '',
  },
  {
    layer_id: '114e98e3-fdf3-48a1-b804-7f790dc92b79', // COVER
    layer_display: 'COVER',
    id_val: '',
    thick_val: '',
    od_val: '',
    notes: '',
  },
];

const newDetailSpek = (override?: Partial<DetailSpek>): DetailSpek => ({
  layer_id: "",
  layer_display: "",
  nama_parameter: "",
  nama_parameter_display: "",
  value: "",
  satuan: "",
  satuan_display: "",
  notes: "",
  ...override,
});

const addDetailSpekRow = () => {
  detailSpek.value.push(newDetailSpek());
};

const removeDetailSpekRow = (index: number) => {
  detailSpek.value.splice(index, 1);
};

/**
 * Helper untuk parse angka dengan dukungan koma maupun titik,
 * serta konversi pecahan otomatis (misal 3/8 -> 0.375)
 */
const parseCommaNumber = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  let str = String(val).trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 2) {
      const num = parseFloat(parts[0].replace(',', '.'));
      const den = parseFloat(parts[1].replace(',', '.'));
      if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den;
    }
  }
  str = str.replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const formatCommaNumber = (num: number | string, maxDecimals = 4): string => {
  if (num === undefined || num === null || num === '') return '';
  const parsed = typeof num === 'number' ? num : parseCommaNumber(num);
  if (isNaN(parsed)) return '';
  if (parsed === 0) return '0';
  const rounded = Number(parsed.toFixed(maxDecimals));
  return String(rounded).replace('.', ',');
};

/** Helper kategori badge untuk parameter spesifikasi */
const getParamCategoryBadge = (paramName: string) => {
  if (!paramName) return null;
  const lower = paramName.toLowerCase();
  if (lower.includes('diameter') || lower.includes('thick') || lower.includes('tebal') || lower.includes('size') || lower.includes('dimensi')) {
    return { label: 'Dimensi', cls: 'bg-blue-100/80 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800' };
  }
  if (lower.includes('klos') || lower.includes('carrier') || lower.includes('braid') || lower.includes('anyam') || lower.includes('pitch') || lower.includes('angle') || lower.includes('sudut')) {
    return { label: 'Anyaman', cls: 'bg-orange-100/80 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800' };
  }
  if (lower.includes('phr') || lower.includes('gravity') || lower.includes('sg') || lower.includes('volume') || lower.includes('compound')) {
    return { label: 'Compound', cls: 'bg-purple-100/80 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800' };
  }
  if (lower.includes('weight') || lower.includes('berat') || lower.includes('panjang') || lower.includes('length')) {
    return { label: 'Fisik', cls: 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
  }
  if (lower.includes('pressure') || lower.includes('tekanan') || lower.includes('burst') || lower.includes('working')) {
    return { label: 'Tekanan', cls: 'bg-amber-100/80 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800' };
  }
  return { label: 'Spek', cls: 'bg-slate-100 text-slate-600 dark:bg-muted dark:text-slate-300 border-slate-200 dark:border-border' };
};

/** Handler ketika parameter spek dipilih (auto-suggest satuan jika kosong) */
const onParamChange = (row: DetailSpek, paramId: string, itemFull?: any) => {
  row.nama_parameter = paramId;
  const paramDisplay = itemFull?.value1 || spekMap.value[paramId] || '';
  row.nama_parameter_display = paramDisplay;

  if (!row.satuan) {
    const lower = paramDisplay.toLowerCase();
    if (lower.includes('diameter') || lower.includes('thick') || lower.includes('tebal') || lower.includes('size')) {
      const mmEntry = Object.entries(uomMap.value).find(([_, v]) => (v || '').toLowerCase() === 'mm');
      if (mmEntry) {
        row.satuan = mmEntry[0];
        row.satuan_display = mmEntry[1];
      }
    } else if (lower.includes('klos') || lower.includes('carrier') || lower.includes('bobbin')) {
      const klosEntry = Object.entries(uomMap.value).find(([_, v]) => (v || '').toLowerCase().includes('klos') || (v || '').toLowerCase() === 'pcs');
      if (klosEntry) {
        row.satuan = klosEntry[0];
        row.satuan_display = klosEntry[1];
      }
    } else if (lower.includes('sudut') || lower.includes('angle')) {
      const degEntry = Object.entries(uomMap.value).find(([_, v]) => (v || '').toLowerCase().includes('deg') || (v || '').includes('°'));
      if (degEntry) {
        row.satuan = degEntry[0];
        row.satuan_display = degEntry[1];
      }
    } else if (lower.includes('pitch')) {
      const mmEntry = Object.entries(uomMap.value).find(([_, v]) => (v || '').toLowerCase() === 'mm');
      if (mmEntry) {
        row.satuan = mmEntry[0];
        row.satuan_display = mmEntry[1];
      }
    } else if (lower.includes('weight') || lower.includes('berat')) {
      const kgEntry = Object.entries(uomMap.value).find(([_, v]) => (v || '').toLowerCase() === 'kg');
      if (kgEntry) {
        row.satuan = kgEntry[0];
        row.satuan_display = kgEntry[1];
      }
    } else if (lower.includes('phr') || lower.includes('%')) {
      const phrEntry = Object.entries(uomMap.value).find(([_, v]) => (v || '').toLowerCase().includes('phr') || (v || '').includes('%'));
      if (phrEntry) {
        row.satuan = phrEntry[0];
        row.satuan_display = phrEntry[1];
      }
    } else if (lower.includes('pressure') || lower.includes('tekanan') || lower.includes('bar')) {
      const barEntry = Object.entries(uomMap.value).find(([_, v]) => (v || '').toLowerCase().includes('bar') || (v || '').toLowerCase().includes('psi'));
      if (barEntry) {
        row.satuan = barEntry[0];
        row.satuan_display = barEntry[1];
      }
    }
  }

  // Auto-sync jika baris ini parameter klos atau sudut
  syncBraidParamsFromDetailSpek();
};

/** Shortcut: Muat preset parameter selang standar (TUBE & COVER: ID, Thickness, OD) */
const addHosePreset = () => {
  const findParam = (kw: string) => Object.entries(spekMap.value).find(([_, v]) => (v || '').toLowerCase().includes(kw))?.[0] || '';
  const findLayer = (kw: string) => {
    const entries = Object.entries(layerMap.value);
    const target = kw.toLowerCase().trim();
    // Prioritaskan exact match
    const exact = entries.find(([_, v]) => (v || '').toLowerCase().trim() === target);
    if (exact) return exact[0];

    // Jika mencari tube, pastikan TIDAK mengandung kata cover atau outer
    if (target === 'tube') {
      const pureTube = entries.find(([_, v]) => {
        const val = (v || '').toLowerCase().trim();
        return val.includes('tube') && !val.includes('cover') && !val.includes('outer') && !val.includes('luar');
      });
      if (pureTube) return pureTube[0];
    }

    // Jika mencari cover
    if (target === 'cover') {
      const pureCover = entries.find(([_, v]) => (v || '').toLowerCase().trim().includes('cover'));
      if (pureCover) return pureCover[0];
    }

    return entries.find(([_, v]) => (v || '').toLowerCase().includes(target))?.[0] || '';
  };
  const findUom = (kw: string) => Object.entries(uomMap.value).find(([_, v]) => (v || '').toLowerCase() === kw)?.[0] || '';

  const idParam = findParam('inner diameter');
  const thickParam = findParam('thickness');
  const odParam = findParam('outer diameter');
  const tubeLayer = findLayer('tube');
  const coverLayer = findLayer('cover');
  const mmUom = findUom('mm');

  const presetRows: DetailSpek[] = [
    {
      layer_id: tubeLayer,
      layer_display: layerMap.value[tubeLayer] || 'TUBE',
      nama_parameter: idParam,
      nama_parameter_display: spekMap.value[idParam] || 'INNER DIAMETER',
      value: '',
      satuan: mmUom,
      satuan_display: uomMap.value[mmUom] || 'mm',
      notes: '',
    },
    {
      layer_id: tubeLayer,
      layer_display: layerMap.value[tubeLayer] || 'TUBE',
      nama_parameter: thickParam,
      nama_parameter_display: spekMap.value[thickParam] || 'THICKNESS',
      value: '',
      satuan: mmUom,
      satuan_display: uomMap.value[mmUom] || 'mm',
      notes: '',
    },
    {
      layer_id: tubeLayer,
      layer_display: layerMap.value[tubeLayer] || 'TUBE',
      nama_parameter: odParam,
      nama_parameter_display: spekMap.value[odParam] || 'OUTER DIAMETER',
      value: '',
      satuan: mmUom,
      satuan_display: uomMap.value[mmUom] || 'mm',
      notes: '',
    },
    {
      layer_id: coverLayer,
      layer_display: layerMap.value[coverLayer] || 'COVER',
      nama_parameter: thickParam,
      nama_parameter_display: spekMap.value[thickParam] || 'THICKNESS',
      value: '',
      satuan: mmUom,
      satuan_display: uomMap.value[mmUom] || 'mm',
      notes: '',
    },
    {
      layer_id: coverLayer,
      layer_display: layerMap.value[coverLayer] || 'COVER',
      nama_parameter: odParam,
      nama_parameter_display: spekMap.value[odParam] || 'OUTER DIAMETER',
      value: '',
      satuan: mmUom,
      satuan_display: uomMap.value[mmUom] || 'mm',
      notes: '',
    },
  ];

  detailSpek.value.push(...presetRows);
  toast.success('Preset parameter selang (TUBE & COVER) berhasil ditambahkan');
};

const findLayerItem = (code: string, name: string) => {
  const codeL = code.toLowerCase().trim();
  const nameL = name.toLowerCase().trim();
  return rawLayers.value.find((l: any) =>
    (l.key1 || '').toLowerCase().trim() === codeL ||
    (l.code || '').toLowerCase().trim() === codeL
  ) || rawLayers.value.find((l: any) =>
    (l.value1 || '').toLowerCase().trim() === nameL
  ) || rawLayers.value.find((l: any) => {
    const val = (l.value1 || '').toLowerCase().trim();
    if (nameL === 'cover' && val.includes('cover tube')) return false;
    if (nameL === 'tube' && val.includes('cover tube')) return false;
    return val.includes(nameL);
  });
};

const findSpecItem = (code: string, name: string) => {
  const codeL = code.toLowerCase().trim();
  const nameL = name.toLowerCase().trim();
  return rawSpecs.value.find((s: any) =>
    (s.key1 || '').toLowerCase().trim() === codeL ||
    (s.code || '').toLowerCase().trim() === codeL
  ) || rawSpecs.value.find((s: any) =>
    (s.value1 || '').toLowerCase().trim() === nameL
  ) || rawSpecs.value.find((s: any) => {
    const val = (s.value1 || '').toLowerCase().trim();
    if (nameL.includes('denier') && val.includes('denier')) return true;
    if (nameL.includes('carrier') && (val.includes('carrier') || val.includes('klos'))) return true;
    if (nameL.includes('angle') && (val.includes('angle') || val.includes('sudut'))) return true;
    if (nameL.includes('pitch') && val.includes('pitch')) return true;
    return val.includes(nameL);
  });
};

const findUomItem = (uomName: string) => {
  const uL = uomName.toLowerCase().trim();
  return rawUoms.value.find((u: any) =>
    (u.value1 || '').toLowerCase().trim() === uL
  ) || rawUoms.value.find((u: any) =>
    (u.value1 || '').toLowerCase().includes(uL)
  );
};

const getLayerKeyFromDisplay = (name: string): string => {
  const n = (name || '').toLowerCase().trim();
  if (n === 'spec' || n.includes('ukuran')) return 'SPEC';
  if (n.includes('cover tube') || n.includes('middle') || n.includes('tengah')) return 'COVER_TUBE';
  if (n === 'tube' || (n.includes('tube') && !n.includes('cover'))) return 'TUBE';
  if (n === 'cover' || (n.includes('cover') && !n.includes('tube'))) return 'COVER';
  if (n.includes('spring') || n.includes('kawat')) return 'SPRING';
  if (n.includes('rod') || n.includes('rigid')) return 'ROD';
  if (n.includes('yarn') || n.includes('benang') || n.includes('braid')) return 'YARN';
  if (n.includes('hose') || n.includes('selang')) return 'HOSE';
  if (n.includes('bahan') || n.includes('material') || n.includes('baku')) return 'BAHAN_BAKU';
  return '';
};

const getShortParamLabel = (fullName: string): string => {
  const n = (fullName || '').toLowerCase().trim();
  if (n.includes('size') || n.includes('ukuran')) return 'Ukuran';
  if (n.includes('inner') || n.includes('id') || n.includes('dalam')) return 'ID';
  if (n.includes('outer') || n.includes('od') || n.includes('luar')) return 'OD';
  if (n.includes('length') || n.includes('panjang')) return 'Panjang';
  if (n.includes('thick') || n.includes('tebal')) return 'Thick';
  if (n.includes('weight') || n.includes('berat')) return 'Berat/M';
  if (n.includes('exclude')) return 'Harga Exclude/M';
  if (n.includes('include')) return 'Harga Include/M';
  if (n.includes('price') || n.includes('harga')) return 'Harga/M';
  return fullName || 'Parameter';
};

/**
 * Sinkronisasi seluruh layerGroups ke array flat detailSpek untuk disimpan ke DB
 */
const syncGroupsToDetailSpek = () => {
  const flat: DetailSpek[] = [];
  layerGroups.value.forEach((grp) => {
    grp.params.forEach((p) => {
      const dbValue = p.value !== undefined && p.value !== null && p.value !== ''
        ? String(p.value).trim().replace(',', '.')
        : '';
      flat.push({
        id: p.id,
        layer_id: grp.layer_id,
        layer_display: grp.layer_display || layerMap.value[grp.layer_id] || '',
        nama_parameter: p.nama_parameter,
        nama_parameter_display: p.nama_parameter_display || spekMap.value[p.nama_parameter] || '',
        value: dbValue,
        satuan: p.satuan,
        satuan_display: p.satuan_display || uomMap.value[p.satuan] || '',
        notes: p.notes || '',
      });
    });
  });
  detailSpek.value = flat;
  syncDetailSpekToLayerDims();
};

/**
 * Inisialisasi layerGroups dari detailSpek atau template default (SPEC, TUBE, COVER, YARN, HOSE, BAHAN BAKU)
 * Selalu memastikan seluruh 6 lapisan standar seperti di Excel tersedia secara default.
 */
const initLayerGroups = (forceReset = false) => {
  if (forceReset) {
    selectedHosePresetId.value = 'STANDAR_3L';
  }
  // 1. Selalu buat struktur 6 layer standar Excel sesuai urutan
  const standardRows: LayerGroupRow[] = [];
  const standardMap = new Map<string, LayerGroupRow>();

  DEFAULT_LAYER_ORDER.forEach((def, idx) => {
    const matchedLayer = findLayerItem(def.code, def.name);
    const layerId = matchedLayer?.id || '';
    const layerDisplay = matchedLayer?.value1 || def.name;

    const template = LAYER_PARAM_TEMPLATES[def.key] || [];
    const params: LayerGroupParam[] = template.map((t) => {
      const matchedSpec = findSpecItem(t.specCode, t.specName);
      const matchedUom = findUomItem(t.uom);
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
      };
    });

    const grpRow: LayerGroupRow = {
      local_id: `grp_std_${def.key}_${Date.now()}_${idx}`,
      layer_id: layerId,
      layer_display: layerDisplay,
      params,
    };

    standardRows.push(grpRow);
    standardMap.set(def.key, grpRow);
    if (layerId) standardMap.set(layerId, grpRow);
  });

  // Jika forceReset (klik tombol Reset Standar) atau detailSpek belum ada data, gunakan 6 layer standar
  if (detailSpek.value.length === 0 || forceReset) {
    layerGroups.value = standardRows;
    syncGroupsToDetailSpek();
    return;
  }

  // 2. Jika ada data detailSpek yang dimuat dari DB (mode Edit / View / Copy),
  //    Gabungkan nilai dari DB ke dalam 6 layer standar Excel.
  const customGroups: LayerGroupRow[] = [];
  const customMap = new Map<string, LayerGroupRow>();

  detailSpek.value.forEach((s) => {
    const sLayerId = s.layer_id || '';
    const sLayerName = s.layer_display || layerMap.value[sLayerId] || '';
    const lKey = getLayerKeyFromDisplay(sLayerName);

    // Cari grup standar yang cocok
    let targetGrp = (sLayerId && standardMap.get(sLayerId)) || (lKey && standardMap.get(lKey)) || null;

    if (targetGrp) {
      if (sLayerId && !targetGrp.layer_id) {
        targetGrp.layer_id = sLayerId;
        targetGrp.layer_display = sLayerName || targetGrp.layer_display;
      }

      // Cari parameter yang cocok di targetGrp.params
      const sParamId = s.nama_parameter;
      const sParamName = (s.nama_parameter_display || spekMap.value[sParamId] || '').toLowerCase();

      const pIdx = targetGrp.params.findIndex((p) => {
        if (sParamId && p.nama_parameter && sParamId === p.nama_parameter) return true;
        const pName = (p.nama_parameter_display || spekMap.value[p.nama_parameter] || '').toLowerCase();
        if (sParamName && pName) {
          if (sParamName === pName) return true;
          if (sParamName.includes('inner') && pName.includes('inner')) return true;
          if (sParamName.includes('outer') && pName.includes('outer')) return true;
          if (sParamName.includes('thick') && pName.includes('thick')) return true;
        }
        return false;
      });

      if (pIdx >= 0) {
        // Timpa nilai dengan data tersimpan di DB
        const existingParam = targetGrp.params[pIdx];
        existingParam.id = s.id;
        if (s.value !== undefined && s.value !== null && s.value !== '') {
          existingParam.value = String(s.value).replace('.', ',');
        }
        if (s.satuan) {
          existingParam.satuan = s.satuan;
          existingParam.satuan_display = s.satuan_display || uomMap.value[s.satuan] || existingParam.satuan_display;
        }
        if (s.notes) existingParam.notes = s.notes;
      } else {
        // Parameter tambahan yang disimpan di DB
        targetGrp.params.push({
          id: s.id,
          nama_parameter: s.nama_parameter,
          nama_parameter_display: s.nama_parameter_display || spekMap.value[s.nama_parameter] || '',
          value: s.value !== undefined && s.value !== null && s.value !== '' ? String(s.value).replace('.', ',') : '',
          satuan: s.satuan,
          satuan_display: s.satuan_display || uomMap.value[s.satuan] || '',
          notes: s.notes || '',
          is_calculated: false,
          short_label: getShortParamLabel(s.nama_parameter_display || spekMap.value[s.nama_parameter] || ''),
        });
      }
    } else {
      // Layer non-standar dari DB (misal custom layer seperti COVER TUBE)
      const cKey = sLayerId || sLayerName;
      let custGrp = customMap.get(cKey);
      if (!custGrp) {
        custGrp = {
          local_id: `grp_cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          layer_id: sLayerId,
          layer_display: sLayerName,
          params: [],
        };
        customMap.set(cKey, custGrp);
        customGroups.push(custGrp);
      }

      custGrp.params.push({
        id: s.id,
        nama_parameter: s.nama_parameter,
        nama_parameter_display: s.nama_parameter_display || spekMap.value[s.nama_parameter] || '',
        value: s.value !== undefined && s.value !== null && s.value !== '' ? String(s.value).replace('.', ',') : '',
        satuan: s.satuan,
        satuan_display: s.satuan_display || uomMap.value[s.satuan] || '',
        notes: s.notes || '',
        is_calculated: false,
        short_label: getShortParamLabel(s.nama_parameter_display || spekMap.value[s.nama_parameter] || ''),
      });
    }
  });

  // Gabungkan 6 layer standar Excel dengan custom layer (jika ada)
  layerGroups.value = [...standardRows, ...customGroups];
  autoChainHoseParams();
  syncGroupsToDetailSpek();
};

/** Tambah baris lapisan baru ke bawah */
const addLayerGroup = () => {
  layerGroups.value.push({
    local_id: `grp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    layer_id: '',
    layer_display: '',
    params: [],
  });
  syncGroupsToDetailSpek();
  toast.info('Lapisan layer baru berhasil ditambahkan.');
};

/** Hapus baris lapisan */
const removeLayerGroup = (idx: number) => {
  layerGroups.value.splice(idx, 1);
  autoChainHoseParams();
  syncGroupsToDetailSpek();
  syncSpekWeightToQty();
  toast.success('Lapisan layer berhasil dihapus.');
};

// ============================================================================
// DRAG & DROP & GESER URUTAN (SEQUENCE) LAPISAN LAYER & PARAMETER
// ============================================================================
const draggedLayerIndex = ref<number | null>(null);
const dropTargetLayerIndex = ref<number | null>(null);

const onLayerDragStart = (e: DragEvent, index: number) => {
  if (isReadOnly.value || locked.value) return;
  draggedLayerIndex.value = index;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `layer:${index}`);
  }
};

const onLayerDragOver = (e: DragEvent, index: number) => {
  if (draggedLayerIndex.value === null || draggedLayerIndex.value === index) return;
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }
  dropTargetLayerIndex.value = index;
};

const onLayerDragLeave = () => {
  dropTargetLayerIndex.value = null;
};

const onLayerDrop = (targetIndex: number) => {
  if (draggedLayerIndex.value === null || draggedLayerIndex.value === targetIndex) {
    draggedLayerIndex.value = null;
    dropTargetLayerIndex.value = null;
    return;
  }

  const fromIdx = draggedLayerIndex.value;
  const items = [...layerGroups.value];
  const [draggedItem] = items.splice(fromIdx, 1);
  if (draggedItem) {
    items.splice(targetIndex, 0, draggedItem);
    layerGroups.value = items;
    autoChainHoseParams();
    syncGroupsToDetailSpek();
    syncSpekWeightToQty();
    const layerName = draggedItem.layer_display || `Layer #${targetIndex + 1}`;
    toast.success(`Urutan "${layerName}" dipindahkan dari posisi ${fromIdx + 1} ke posisi ${targetIndex + 1}`);
  }

  draggedLayerIndex.value = null;
  dropTargetLayerIndex.value = null;
};

const moveLayerUp = (index: number) => {
  if (index <= 0 || isReadOnly.value || locked.value) return;
  const items = [...layerGroups.value];
  const [item] = items.splice(index, 1);
  if (item) {
    items.splice(index - 1, 0, item);
    layerGroups.value = items;
    autoChainHoseParams();
    syncGroupsToDetailSpek();
    syncSpekWeightToQty();
  }
};

const moveLayerDown = (index: number) => {
  if (index >= layerGroups.value.length - 1 || isReadOnly.value || locked.value) return;
  const items = [...layerGroups.value];
  const [item] = items.splice(index, 1);
  if (item) {
    items.splice(index + 1, 0, item);
    layerGroups.value = items;
    autoChainHoseParams();
    syncGroupsToDetailSpek();
    syncSpekWeightToQty();
  }
};

// Drag & drop antar / dalam parameter kartu
const draggedParamInfo = ref<{ grpIdx: number; paramIdx: number } | null>(null);
const dropTargetParamInfo = ref<{ grpIdx: number; paramIdx: number } | null>(null);

const onParamDragStart = (e: DragEvent, grpIdx: number, paramIdx: number) => {
  if (isReadOnly.value || locked.value) return;
  e.stopPropagation();
  draggedParamInfo.value = { grpIdx, paramIdx };
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `param:${grpIdx}:${paramIdx}`);
  }
};

const onParamDragOver = (e: DragEvent, grpIdx: number, paramIdx: number) => {
  if (!draggedParamInfo.value) return;
  if (draggedParamInfo.value.grpIdx === grpIdx && draggedParamInfo.value.paramIdx === paramIdx) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move';
  }
  dropTargetParamInfo.value = { grpIdx, paramIdx };
};

const onParamDragLeave = () => {
  dropTargetParamInfo.value = null;
};

const onParamDrop = (grpIdx: number, targetPIdx: number) => {
  if (!draggedParamInfo.value) return;
  const { grpIdx: fromGIdx, paramIdx: fromPIdx } = draggedParamInfo.value;

  if (fromGIdx === grpIdx && fromPIdx === targetPIdx) {
    draggedParamInfo.value = null;
    dropTargetParamInfo.value = null;
    return;
  }

  const sourceGrp = layerGroups.value[fromGIdx];
  const targetGrp = layerGroups.value[grpIdx];
  if (sourceGrp && targetGrp) {
    const [movedParam] = sourceGrp.params.splice(fromPIdx, 1);
    if (movedParam) {
      targetGrp.params.splice(targetPIdx, 0, movedParam);
      autoChainHoseParams();
      syncGroupsToDetailSpek();
      syncSpekWeightToQty();
      toast.success('Posisi parameter berhasil diubah');
    }
  }

  draggedParamInfo.value = null;
  dropTargetParamInfo.value = null;
};

/** Handler ketika dropdown layer diganti */
const onLayerChange = (grp: LayerGroupRow, newLayerId: string, itemFull?: any) => {
  grp.layer_id = newLayerId;
  const lDisplay = itemFull?.value1 || layerMap.value[newLayerId] || '';
  grp.layer_display = lDisplay;

  const key = getLayerKeyFromDisplay(lDisplay);
  const template = LAYER_PARAM_TEMPLATES[key];
  if (template && template.length > 0) {
    const existingValByLabel = new Map<string, string>();
    grp.params.forEach(p => {
      const k = (p.short_label || p.nama_parameter_display || '').toLowerCase();
      if (p.value !== undefined && p.value !== null && p.value !== '') {
        existingValByLabel.set(k, p.value);
      }
    });

    grp.params = template.map((t) => {
      const matchedSpec = findSpecItem(t.specCode, t.specName);
      const matchedUom = findUomItem(t.uom);
      const existingVal = existingValByLabel.get((t.shortLabel || t.specName).toLowerCase());
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
      };
    });
    toast.info(`Parameter standar untuk layer ${lDisplay} telah dimuat otomatis.`);
  }

  syncGroupsToDetailSpek();
  autoChainHoseParams();
  syncSpekWeightToQty();
};

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
  });
  syncGroupsToDetailSpek();
};

/** Hapus parameter dari suatu layer */
const removeParamFromGroup = (grp: LayerGroupRow, pIdx: number) => {
  grp.params.splice(pIdx, 1);
  autoChainHoseParams();
  syncGroupsToDetailSpek();
  syncSpekWeightToQty();
};

/** Handler ketika parameter spek diubah dari dropdown m_spec */
const onParamChangeInGroup = (p: LayerGroupParam, paramId: string, itemFull?: any, grp?: LayerGroupRow) => {
  p.nama_parameter = paramId;
  p.nama_parameter_display = itemFull?.value1 || spekMap.value[paramId] || '';
  p.short_label = getShortParamLabel(p.nama_parameter_display);

  const lower = (p.nama_parameter_display || '').toLowerCase();
  const lKey = grp ? getLayerKeyFromDisplay(grp.layer_display) : '';

  // Deteksi kategori: Kalkulasi (Kuning) vs Auto Ambil (Hijau) vs Manual
  if (lower.includes('weight') || lower.includes('berat') || lower.includes('price') || lower.includes('harga') || lower.includes('exclude') || lower.includes('include')) {
    p.is_calculated = true;
    p.is_linked = false;
    p.link_source = '';
  } else if ((lKey === 'TUBE' || lKey === 'COVER' || lKey === 'YARN') && (lower.includes('outer') || lower.includes('od'))) {
    p.is_calculated = true;
    p.is_linked = false;
    p.link_source = '';
  } else if (lKey === 'SPEC' && (lower.includes('inner') || lower.includes('id'))) {
    p.is_linked = true;
    p.is_calculated = false;
    p.link_source = 'TUBE ID';
  } else if (lKey === 'SPEC' && (lower.includes('outer') || lower.includes('od'))) {
    p.is_linked = true;
    p.is_calculated = false;
    p.link_source = 'COVER OD';
  } else if ((lKey === 'COVER' || lKey === 'YARN') && (lower.includes('inner') || lower.includes('id'))) {
    p.is_linked = true;
    p.is_calculated = false;
    p.link_source = 'TUBE OD';
  } else {
    p.is_calculated = false;
    p.is_linked = false;
    p.link_source = '';
  }

  if (!p.satuan) {
    if (lower.includes('diameter') || lower.includes('thick') || lower.includes('tebal') || lower.includes('size') || lower.includes('id') || lower.includes('od') || lower.includes('panjang')) {
      const mm = Object.entries(uomMap.value).find(([_, v]) => (v || '').toLowerCase() === 'mm');
      if (mm) { p.satuan = mm[0]; p.satuan_display = mm[1]; }
    } else if (lower.includes('weight') || lower.includes('berat')) {
      const kg = Object.entries(uomMap.value).find(([_, v]) => (v || '').toLowerCase() === 'kg');
      if (kg) { p.satuan = kg[0]; p.satuan_display = kg[1]; }
    }
  }

  syncGroupsToDetailSpek();
};

/** Handler ketika satuan parameter diubah dari dropdown UOM */
const onParamUomChange = (p: LayerGroupParam, uomId: string, itemFull?: any) => {
  p.satuan = uomId;
  p.satuan_display = itemFull?.value1 || uomMap.value[uomId] || '';
  syncGroupsToDetailSpek();
};

const formulaSgTube = ref(1.30);    // SG Tube compound (default Excel)
const formulaSgCoverTube = ref(1.466); // SG Cover Tube compound (default Excel LPG Rp 20.198 / SG 1.466)
const formulaSgCover = ref(1.08);   // SG Cover compound (default Excel)
const formulaSgRod = ref(1.408);    // SG Rod spiral compound (default Excel Rod SG 1.408)
const formulaHargaTube = ref(23238); // Harga perkilo sekali masak tube compound (default Excel Rp 23.238)
const formulaHargaCoverTube = ref(20198); // Harga perkilo cover tube compound
const formulaHargaCover = ref(34814); // Harga perkilo sekali masak cover compound (default Excel Rp 34.814)
const formulaHargaRod = ref(22858);   // Harga perkilo rod compound
const formulaHargaWire = ref(100000); // Harga kawat spring/kg (default Rp 100.000)
const formulaHargaYarn = ref(60000);  // Harga benang PET/kg (default Rp 60.000)

const chemicalTubeSource = ref<'BOM' | 'PRECOST'>('BOM');
const selectedChemicalTubeId = ref('');
const selectedChemicalTubeData = ref<any>(null);

const chemicalCoverSource = ref<'BOM' | 'PRECOST'>('BOM');
const selectedChemicalCoverId = ref('');
const selectedChemicalCoverData = ref<any>(null);

const onFormulaSgTubeChange = (val: any) => {
  formulaSgTube.value = Number(val) || 0;
  autoChainHoseParams();
  syncGroupsToDetailSpek();
  syncSpekWeightToQty();
};

const onFormulaSgCoverChange = (val: any) => {
  formulaSgCover.value = Number(val) || 0;
  autoChainHoseParams();
  syncGroupsToDetailSpek();
  syncSpekWeightToQty();
};

const onFormulaHargaTubeChange = (val: any) => {
  formulaHargaTube.value = Number(val) || 0;
  autoChainHoseParams();
  syncGroupsToDetailSpek();
  syncSpekWeightToQty();
};

const onFormulaHargaCoverChange = (val: any) => {
  formulaHargaCover.value = Number(val) || 0;
  autoChainHoseParams();
  syncGroupsToDetailSpek();
  syncSpekWeightToQty();
};

const handleChemicalTubeSelected = (item: any) => {
  if (item && item.id) {
    selectedChemicalTubeId.value = item.id;
    selectedChemicalTubeData.value = item;
    if (item.sg_compound !== undefined && item.sg_compound !== null && Number(item.sg_compound) > 0) {
      formulaSgTube.value = Number(item.sg_compound);
    }
    if (item.harga_per_kg_compound !== undefined && item.harga_per_kg_compound !== null && Number(item.harga_per_kg_compound) > 0) {
      formulaHargaTube.value = Number(item.harga_per_kg_compound);
    }
  } else {
    selectedChemicalTubeId.value = '';
    selectedChemicalTubeData.value = null;
  }
  autoChainHoseParams();
  syncGroupsToDetailSpek();
  syncSpekWeightToQty();
};

const handleChemicalCoverSelected = (item: any) => {
  if (item && item.id) {
    selectedChemicalCoverId.value = item.id;
    selectedChemicalCoverData.value = item;
    if (item.sg_compound !== undefined && item.sg_compound !== null && Number(item.sg_compound) > 0) {
      formulaSgCover.value = Number(item.sg_compound);
    }
    if (item.harga_per_kg_compound !== undefined && item.harga_per_kg_compound !== null && Number(item.harga_per_kg_compound) > 0) {
      formulaHargaCover.value = Number(item.harga_per_kg_compound);
    }
  } else {
    selectedChemicalCoverId.value = '';
    selectedChemicalCoverData.value = null;
  }
  autoChainHoseParams();
  syncGroupsToDetailSpek();
  syncSpekWeightToQty();
};

const onChemicalTubeSourceChange = (src: 'BOM' | 'PRECOST') => {
  chemicalTubeSource.value = src;
  selectedChemicalTubeId.value = '';
  selectedChemicalTubeData.value = null;
};

const onChemicalCoverSourceChange = (src: 'BOM' | 'PRECOST') => {
  chemicalCoverSource.value = src;
  selectedChemicalCoverId.value = '';
  selectedChemicalCoverData.value = null;
};

const selectedTubeMaterialKey = ref('');
const selectedCoverTubeMaterialKey = ref('');
const selectedCoverMaterialKey = ref('');
const selectedRodMaterialKey = ref('');
const selectedSpringMaterialKey = ref('');
const selectedYarnMaterialKey = ref('');

const makeBomMaterialOptions = () => {
  return (allMaterials.value || []).map((m: any, mIdx: number) => {
    const val = m.m_item_id || m.m_item?.nama_item || String(mIdx);
    const name = m.m_item?.nama_item || m.m_item?.kode_item || `Material #${mIdx + 1}`;
    const sg = getMatBeratJenis(m);
    const price = Number(m.harga_satuan || 0).toLocaleString('id-ID');
    return {
      id: val,
      nama_item: `${name} (SG: ${sg}, Rp ${price}/kg)`,
    };
  });
};

const tubeMaterialOptions = computed(() => makeBomMaterialOptions());
const coverTubeMaterialOptions = computed(() => makeBomMaterialOptions());
const coverMaterialOptions = computed(() => makeBomMaterialOptions());
const rodMaterialOptions = computed(() => makeBomMaterialOptions());
const springMaterialOptions = computed(() => makeBomMaterialOptions());
const yarnMaterialOptions = computed(() => makeBomMaterialOptions());

const selectedTubeMaterialDisplay = computed(() => {
  if (!selectedTubeMaterialKey.value) return '';
  const opt = tubeMaterialOptions.value.find((o: any) => o.id === selectedTubeMaterialKey.value);
  return opt ? opt.nama_item : selectedTubeMaterialKey.value;
});

const selectedCoverTubeMaterialDisplay = computed(() => {
  if (!selectedCoverTubeMaterialKey.value) return '';
  const opt = coverTubeMaterialOptions.value.find((o: any) => o.id === selectedCoverTubeMaterialKey.value);
  return opt ? opt.nama_item : selectedCoverTubeMaterialKey.value;
});

const selectedCoverMaterialDisplay = computed(() => {
  if (!selectedCoverMaterialKey.value) return '';
  const opt = coverMaterialOptions.value.find((o: any) => o.id === selectedCoverMaterialKey.value);
  return opt ? opt.nama_item : selectedCoverMaterialKey.value;
});

const selectedRodMaterialDisplay = computed(() => {
  if (!selectedRodMaterialKey.value) return '';
  const opt = rodMaterialOptions.value.find((o: any) => o.id === selectedRodMaterialKey.value);
  return opt ? opt.nama_item : selectedRodMaterialKey.value;
});

const selectedSpringMaterialDisplay = computed(() => {
  if (!selectedSpringMaterialKey.value) return '';
  const opt = springMaterialOptions.value.find((o: any) => o.id === selectedSpringMaterialKey.value);
  return opt ? opt.nama_item : selectedSpringMaterialKey.value;
});

const selectedYarnMaterialDisplay = computed(() => {
  if (!selectedYarnMaterialKey.value) return '';
  const opt = yarnMaterialOptions.value.find((o: any) => o.id === selectedYarnMaterialKey.value);
  return opt ? opt.nama_item : selectedYarnMaterialKey.value;
});

const onTubeMaterialSelectChange = (matKey: string) => {
  selectedTubeMaterialKey.value = matKey || '';
  if (!matKey) {
    formulaSgTube.value = 0;
    formulaHargaTube.value = 0;
    selectedChemicalTubeData.value = null;
    autoChainHoseParams();
    syncGroupsToDetailSpek();
    syncSpekWeightToQty();
    return;
  }
  const mat = allMaterials.value.find((d) => (d.m_item_id || d.m_item?.nama_item) === matKey);
  if (mat) {
    const sg = getMatBeratJenis(mat);
    const harga = Number(mat.harga_satuan) || 0;
    if (sg > 0) formulaSgTube.value = sg;
    if (harga > 0) formulaHargaTube.value = harga;
    selectedChemicalTubeData.value = {
      m_item: mat.m_item || { nama_item: mat.m_item_id },
      no: mat.notes || mat.m_item_id,
    };
    autoChainHoseParams();
    syncGroupsToDetailSpek();
    syncSpekWeightToQty();
    toast.success(`Kompon Tube dihubungkan ke material: ${mat.m_item?.nama_item || mat.m_item_id}`);
  }
};

const onCoverTubeMaterialSelectChange = (matKey: string) => {
  selectedCoverTubeMaterialKey.value = matKey || '';
  if (!matKey) {
    formulaSgCoverTube.value = 0;
    formulaHargaCoverTube.value = 0;
    autoChainHoseParams();
    syncGroupsToDetailSpek();
    syncSpekWeightToQty();
    return;
  }
  const mat = allMaterials.value.find((d) => (d.m_item_id || d.m_item?.nama_item) === matKey);
  if (mat) {
    const sg = getMatBeratJenis(mat);
    const harga = Number(mat.harga_satuan) || 0;
    if (sg > 0) formulaSgCoverTube.value = sg;
    if (harga > 0) formulaHargaCoverTube.value = harga;
    autoChainHoseParams();
    syncGroupsToDetailSpek();
    syncSpekWeightToQty();
    toast.success(`Kompon Cover Tube dihubungkan ke material: ${mat.m_item?.nama_item || mat.m_item_id}`);
  }
};

const onCoverMaterialSelectChange = (matKey: string) => {
  selectedCoverMaterialKey.value = matKey || '';
  if (!matKey) {
    formulaSgCover.value = 0;
    formulaHargaCover.value = 0;
    selectedChemicalCoverData.value = null;
    autoChainHoseParams();
    syncGroupsToDetailSpek();
    syncSpekWeightToQty();
    return;
  }
  const mat = allMaterials.value.find((d) => (d.m_item_id || d.m_item?.nama_item) === matKey);
  if (mat) {
    const sg = getMatBeratJenis(mat);
    const harga = Number(mat.harga_satuan) || 0;
    if (sg > 0) formulaSgCover.value = sg;
    if (harga > 0) formulaHargaCover.value = harga;
    selectedChemicalCoverData.value = {
      m_item: mat.m_item || { nama_item: mat.m_item_id },
      no: mat.notes || mat.m_item_id,
    };
    autoChainHoseParams();
    syncGroupsToDetailSpek();
    syncSpekWeightToQty();
    toast.success(`Kompon Cover dihubungkan ke material: ${mat.m_item?.nama_item || mat.m_item_id}`);
  }
};

const onRodMaterialSelectChange = (matKey: string) => {
  selectedRodMaterialKey.value = matKey || '';
  if (!matKey) {
    formulaSgRod.value = 0;
    formulaHargaRod.value = 0;
    autoChainHoseParams();
    syncGroupsToDetailSpek();
    syncSpekWeightToQty();
    return;
  }
  const mat = allMaterials.value.find((d) => (d.m_item_id || d.m_item?.nama_item) === matKey);
  if (mat) {
    const sg = getMatBeratJenis(mat);
    const harga = Number(mat.harga_satuan) || 0;
    if (sg > 0) formulaSgRod.value = sg;
    if (harga > 0) formulaHargaRod.value = harga;
    autoChainHoseParams();
    syncGroupsToDetailSpek();
    syncSpekWeightToQty();
    toast.success(`Material Spiral Rod dihubungkan ke: ${mat.m_item?.nama_item || mat.m_item_id}`);
  }
};

const onSpringMaterialSelectChange = (matKey: string) => {
  selectedSpringMaterialKey.value = matKey || '';
  if (!matKey) {
    formulaHargaWire.value = 0;
    autoChainHoseParams();
    syncGroupsToDetailSpek();
    syncSpekWeightToQty();
    return;
  }
  const mat = allMaterials.value.find((d) => (d.m_item_id || d.m_item?.nama_item) === matKey);
  if (mat) {
    const harga = Number(mat.harga_satuan) || 0;
    if (harga > 0) formulaHargaWire.value = harga;
    autoChainHoseParams();
    syncGroupsToDetailSpek();
    syncSpekWeightToQty();
    toast.success(`Material Kawat Spring dihubungkan ke: ${mat.m_item?.nama_item || mat.m_item_id}`);
  }
};

const onYarnMaterialSelectChange = (matKey: string) => {
  selectedYarnMaterialKey.value = matKey || '';
  if (!matKey) {
    formulaHargaYarn.value = 0;
    autoChainHoseParams();
    syncGroupsToDetailSpek();
    syncSpekWeightToQty();
    return;
  }
  const mat = allMaterials.value.find((d) => (d.m_item_id || d.m_item?.nama_item) === matKey);
  if (mat) {
    const harga = Number(mat.harga_satuan) || 0;
    if (harga > 0) formulaHargaYarn.value = harga;
    autoChainHoseParams();
    syncGroupsToDetailSpek();
    syncSpekWeightToQty();
    toast.success(`Material Benang dihubungkan ke: ${mat.m_item?.nama_item || mat.m_item_id}`);
  }
};

watch(
  allMaterials,
  (arr) => {
    if (!selectedTubeMaterialKey.value) {
      const tubeMat = arr.find((d) => (d.m_item?.nama_item || '').toLowerCase().includes('tube') || (d.notes || '').toLowerCase().includes('tube'));
      if (tubeMat) {
        selectedTubeMaterialKey.value = tubeMat.m_item_id || tubeMat.m_item?.nama_item || '';
        const sg = getMatBeratJenis(tubeMat);
        const harga = Number(tubeMat.harga_satuan) || 0;
        if (sg > 0) formulaSgTube.value = sg;
        if (harga > 0) formulaHargaTube.value = harga;
      }
    }
    if (!selectedCoverTubeMaterialKey.value) {
      const ctMat = arr.find((d) => (d.m_item?.nama_item || '').toLowerCase().includes('cover tube') || (d.m_item?.nama_item || '').toLowerCase().includes('middle'));
      if (ctMat) {
        selectedCoverTubeMaterialKey.value = ctMat.m_item_id || ctMat.m_item?.nama_item || '';
        const sg = getMatBeratJenis(ctMat);
        const harga = Number(ctMat.harga_satuan) || 0;
        if (sg > 0) formulaSgCoverTube.value = sg;
        if (harga > 0) formulaHargaCoverTube.value = harga;
      }
    }
    if (!selectedCoverMaterialKey.value) {
      const coverMat = arr.find((d) => (d.m_item?.nama_item || '').toLowerCase().includes('cover') || (d.notes || '').toLowerCase().includes('cover'));
      if (coverMat) {
        selectedCoverMaterialKey.value = coverMat.m_item_id || coverMat.m_item?.nama_item || '';
        const sg = getMatBeratJenis(coverMat);
        const harga = Number(coverMat.harga_satuan) || 0;
        if (sg > 0) formulaSgCover.value = sg;
        if (harga > 0) formulaHargaCover.value = harga;
      }
    }
    if (!selectedRodMaterialKey.value) {
      const rodMat = arr.find((d) => (d.m_item?.nama_item || '').toLowerCase().includes('rod') || (d.m_item?.nama_item || '').toLowerCase().includes('spiral'));
      if (rodMat) {
        selectedRodMaterialKey.value = rodMat.m_item_id || rodMat.m_item?.nama_item || '';
        const sg = getMatBeratJenis(rodMat);
        const harga = Number(rodMat.harga_satuan) || 0;
        if (sg > 0) formulaSgRod.value = sg;
        if (harga > 0) formulaHargaRod.value = harga;
      }
    }
    if (!selectedSpringMaterialKey.value) {
      const springMat = arr.find((d) => (d.m_item?.nama_item || '').toLowerCase().includes('spring') || (d.m_item?.nama_item || '').toLowerCase().includes('kawat'));
      if (springMat) {
        selectedSpringMaterialKey.value = springMat.m_item_id || springMat.m_item?.nama_item || '';
        const harga = Number(springMat.harga_satuan) || 0;
        if (harga > 0) formulaHargaWire.value = harga;
      }
    }
    if (!selectedYarnMaterialKey.value) {
      const yarnMat = arr.find((d) => (d.m_item?.nama_item || '').toLowerCase().includes('yarn') || (d.m_item?.nama_item || '').toLowerCase().includes('benang'));
      if (yarnMat) {
        selectedYarnMaterialKey.value = yarnMat.m_item_id || yarnMat.m_item?.nama_item || '';
        const harga = Number(yarnMat.harga_satuan) || 0;
        if (harga > 0) formulaHargaYarn.value = harga;
      }
    }
  },
  { deep: true }
);

const onHargaSekaliMasakChange = (val: any) => {
  const num = Number(val) || 0;
  values.harga_per_kg_compound = num;
  if (isTypeSpesifik.value) {
    if (formulaHargaTube.value === 0 || formulaHargaTube.value === 23238) {
      formulaHargaTube.value = num;
    }
    autoChainHoseParams();
    syncGroupsToDetailSpek();
    syncSpekWeightToQty();
  }
};

/**
 * Sinkronisasi otomatis antar layer (fleksibel dinamis):
 * Mendukung multiple Tube, multiple Yarn, Cover Tube, Spring (Kawat), Spiral (Rod), Cover,
 * serta menangani jika ada layer yang dihapus / disesuaikan:
 */
const autoChainHoseParams = (triggerGroup?: LayerGroupRow, triggerParam?: LayerGroupParam) => {
  const getParam = (grp: LayerGroupRow | undefined, kw: string) => {
    if (!grp) return undefined;
    return grp.params.find(p => (p.nama_parameter_display || spekMap.value[p.nama_parameter] || '').toLowerCase().includes(kw));
  };

  const specGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'SPEC');
  const hoseGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'HOSE');
  const bbGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'BAHAN_BAKU');

  const specId = getParam(specGrp, 'inner') || getParam(specGrp, 'id');
  const specOd = getParam(specGrp, 'outer') || getParam(specGrp, 'od');

  // SPEC LENGTH (Panjang dalam Meter - Kolom E32 di Excel)
  const sLength = parseCommaNumber(getParam(specGrp, 'length')?.value || getParam(specGrp, 'panjang')?.value) || 1;

  // Ambil semua group lapisan fisik (selain SPEC, HOSE, BAHAN_BAKU)
  const physicalGroups = layerGroups.value.filter(g => {
    const k = getLayerKeyFromDisplay(g.layer_display);
    return k !== 'SPEC' && k !== 'HOSE' && k !== 'BAHAN_BAKU' && g.params.length > 0;
  });

  const trigKey = triggerGroup ? getLayerKeyFromDisplay(triggerGroup.layer_display) : '';
  const trigParamName = (triggerParam?.nama_parameter_display || '').toLowerCase();

  // 1. Sinkronisasi Lapisan Fisik Pertama <=> SPEC ID
  if (physicalGroups.length > 0) {
    const firstGrp = physicalGroups[0];
    const firstId = getParam(firstGrp, 'inner') || getParam(firstGrp, 'id') || getParam(firstGrp, 'dalam');

    if (trigKey === 'SPEC' && (trigParamName.includes('inner') || trigParamName.includes('id'))) {
      if (firstId && triggerParam?.value) {
        firstId.value = triggerParam.value;
      }
    } else if (triggerGroup === firstGrp && (trigParamName.includes('inner') || trigParamName.includes('id'))) {
      if (specId && triggerParam?.value) {
        specId.value = triggerParam.value;
      }
    } else if (firstId?.value && specId && !specId.value) {
      specId.value = firstId.value;
    } else if (specId?.value && firstId && !firstId.value) {
      firstId.value = specId.value;
    }
  }

  // 2. Iterasi mengalir dari lapisan dalam ke lapisan luar
  let prevOd = 0;
  let totalHoseWeight = 0;
  let totalMatCostExclude = 0;

  // Deteksi bila selang memiliki lapisan SPRING (kawat baja)
  const springGrp = physicalGroups.find(g => getLayerKeyFromDisplay(g.layer_display) === 'SPRING');
  const wireThickVal = springGrp ? parseCommaNumber(getParam(springGrp, 'thick')?.value || getParam(springGrp, 'tebal')?.value) : 0;
  const wirePitchVal = springGrp ? parseCommaNumber(getParam(springGrp, 'pitch')?.value || getParam(springGrp, 'jarak')?.value) : 0;

  physicalGroups.forEach((grp, idx) => {
    const lKey = getLayerKeyFromDisplay(grp.layer_display);
    const isYarn = lKey === 'YARN';
    const isCover = lKey === 'COVER';
    const isCoverTube = lKey === 'COVER_TUBE';
    const isSpring = lKey === 'SPRING';
    const isRod = lKey === 'ROD';

    const idParam = getParam(grp, 'inner') || getParam(grp, 'id') || getParam(grp, 'dalam');
    const thickParam = getParam(grp, 'thick') || getParam(grp, 'tebal') || (isYarn ? grp.params.find(p => (p.nama_parameter_display || '').toLowerCase() === 'p') : undefined);
    const odParam = getParam(grp, 'outer') || getParam(grp, 'od') || getParam(grp, 'luar');
    const weightParam = getParam(grp, 'weight') || getParam(grp, 'berat');
    const priceParam = getParam(grp, 'price') || getParam(grp, 'harga');

    // Tentukan ID lapisan saat ini
    let curId = 0;
    if (idx === 0) {
      curId = parseCommaNumber(idParam?.value) || parseCommaNumber(specId?.value);
      if (idParam && curId > 0 && !idParam.value) {
        idParam.value = formatCommaNumber(curId, 2);
      }
    } else {
      // Lapisan ke-2 dan seterusnya mengambil OD dari lapisan sebelumnya
      curId = prevOd;
      if (idParam && curId > 0 && !isSpring) {
        idParam.value = formatCommaNumber(curId, 2);
      }
    }

    const thickVal = parseCommaNumber(thickParam?.value);

    // Hitung OD lapisan saat ini
    let curOd = 0;
    if (isYarn) {
      if (curId > 0 && thickVal > 0) {
        curOd = curId + 4 * thickVal;
      }
    } else if (isRod) {
      // Sesuai rumus spiral hose: OD = Tube_ID + ((OD_Rod + 1) * 2)
      const baseId = parseCommaNumber(specId?.value) || curId;
      if (baseId > 0 && thickVal > 0) {
        curOd = baseId + (thickVal + 1) * 2;
      }
    } else if (isSpring) {
      curOd = prevOd > 0 ? prevOd : (parseCommaNumber(specOd?.value) || (curId > 0 ? curId + 2 * thickVal : 0));
    } else {
      if (curId > 0 && thickVal > 0) {
        curOd = curId + 2 * thickVal;
      }
    }

    if (curOd > 0 && odParam) {
      odParam.value = formatCommaNumber(curOd, 2);
    } else if (!curOd && odParam?.value) {
      curOd = parseCommaNumber(odParam.value);
    }

    // Update prevOd untuk lapisan berikutnya
    if (curOd > 0 && !isSpring) {
      prevOd = curOd;
    } else if (curId > 0 && !isSpring) {
      prevOd = curId;
    }

    // Hitung Berat & Biaya lapisan saat ini
    if (isYarn) {
      const denierVal = parseCommaNumber(getParam(grp, 'denier')?.value);
      const carrierVal = parseCommaNumber(getParam(grp, 'carrier')?.value || getParam(grp, 'klos')?.value);
      const angleVal = parseCommaNumber(getParam(grp, 'angle')?.value || getParam(grp, 'sudut')?.value) || 40;
      const costYarnPerKg = formulaHargaYarn.value > 0 ? formulaHargaYarn.value : 60000;

      let yarnWeight = 0;
      if (denierVal > 0 && carrierVal > 0) {
        const straightBase = (denierVal * carrierVal) / 9000000;
        const rad = (angleVal * Math.PI) / 180;
        const pathFactor = Math.cos(rad) !== 0 ? 1 / Math.cos(rad) : 1.3054;
        yarnWeight = Number(((straightBase * pathFactor) / (1 - 0.05)).toFixed(4));
      } else {
        yarnWeight = parseCommaNumber(weightParam?.value);
        if ((thickVal > 0 || curId > 0) && (!yarnWeight || yarnWeight === 0)) {
          yarnWeight = 0.001;
        }
      }

      const yarnCost = yarnWeight > 0 ? round2(costYarnPerKg * yarnWeight * sLength) : 0;
      const layerWeightTotal = yarnWeight > 0 ? Number((yarnWeight * sLength).toFixed(4)) : 0;
      if (weightParam && yarnWeight > 0) weightParam.value = formatCommaNumber(yarnWeight, 4);
      if (priceParam) priceParam.value = yarnCost > 0 ? formatCommaNumber(yarnCost, 2) : '';
      totalHoseWeight += layerWeightTotal;
      totalMatCostExclude += yarnCost;
    } else if (isSpring) {
      const wireThick = thickVal > 0 ? thickVal : 2;
      const wirePitch = parseCommaNumber(getParam(grp, 'pitch')?.value || getParam(grp, 'jarak')?.value) || 5;
      const tubeOdTarget = curOd > 0 ? curOd : (parseCommaNumber(specOd?.value) || 35);
      const wireLengthParam = getParam(grp, 'length') || getParam(grp, 'panjang');

      const turns = (wirePitch + wireThick > 0) ? (1000 / (wirePitch + wireThick)) : 0;
      const wireLen = (turns > 0 && tubeOdTarget > 0) ? Number(((turns * (tubeOdTarget * Math.PI)) / 1000).toFixed(2)) : 0;
      if (wireLengthParam && wireLen > 0) wireLengthParam.value = formatCommaNumber(wireLen, 2);

      const wireWeight = (wireLen > 0 && wireThick > 0) ? Number(((wireThick * wireThick * Math.PI * 7.8 * wireLen) / 4000).toFixed(4)) : 0;
      const costWirePerKg = formulaHargaWire.value > 0 ? formulaHargaWire.value : 100000;
      const wireCost = wireWeight > 0 ? round2(wireWeight * costWirePerKg * sLength) : 0;
      const layerWeightTotal = wireWeight > 0 ? Number((wireWeight * sLength).toFixed(4)) : 0;

      if (weightParam && wireWeight > 0) weightParam.value = formatCommaNumber(wireWeight, 4);
      if (priceParam) priceParam.value = wireCost > 0 ? formatCommaNumber(wireCost, 2) : '';
      totalHoseWeight += layerWeightTotal;
      totalMatCostExclude += wireCost;
    } else if (isRod) {
      const rodOd = thickVal > 0 ? thickVal : 6;
      const rodPitch = parseCommaNumber(getParam(grp, 'pitch')?.value || getParam(grp, 'jarak')?.value) || 10;
      const tubeIdTarget = parseCommaNumber(specId?.value) || (curId > 0 ? curId : 52);
      const rodLengthParam = getParam(grp, 'length') || getParam(grp, 'panjang');

      const jlhLilitan = rodPitch > 0 ? 1000 / rodPitch : 0;
      const rodLen = jlhLilitan > 0 ? Number((((tubeIdTarget + 1) * Math.PI * jlhLilitan) / 1000).toFixed(2)) : 0;
      if (rodLengthParam && rodLen > 0) rodLengthParam.value = formatCommaNumber(rodLen, 2);

      const sgRod = formulaSgRod.value > 0 ? formulaSgRod.value : 1.408;
      const costRodPerKg = formulaHargaRod.value > 0 ? formulaHargaRod.value : 22858;
      const rodWeight = (rodLen > 0 && rodOd > 0) ? Number((((rodOd / 2) * (rodOd / 2) * Math.PI * sgRod * rodLen) / 1000).toFixed(4)) : 0;
      const rodCost = rodWeight > 0 ? round2(rodWeight * costRodPerKg * sLength) : 0;
      const layerWeightTotal = rodWeight > 0 ? Number((rodWeight * sLength).toFixed(4)) : 0;

      if (weightParam && rodWeight > 0) weightParam.value = formatCommaNumber(rodWeight, 4);
      if (priceParam) priceParam.value = rodCost > 0 ? formatCommaNumber(rodCost, 2) : '';
      totalHoseWeight += layerWeightTotal;
      totalMatCostExclude += rodCost;
    } else {
      let sg = 1.30;
      let costKg = 23238;
      if (isCoverTube) {
        sg = formulaSgCoverTube.value > 0 ? formulaSgCoverTube.value : 1.466;
        costKg = formulaHargaCoverTube.value > 0 ? formulaHargaCoverTube.value : 20198;
      } else if (isCover) {
        sg = formulaSgCover.value > 0 ? formulaSgCover.value : (sgCompound.value > 0 ? sgCompound.value : 1.08);
        costKg = formulaHargaCover.value > 0 ? formulaHargaCover.value : (hargaPerKgCompound.value > 0 ? hargaPerKgCompound.value : 34814);
      } else {
        sg = formulaSgTube.value > 0 ? formulaSgTube.value : (sgCompound.value > 0 ? sgCompound.value : 1.30);
        costKg = formulaHargaTube.value > 0 ? formulaHargaTube.value : (hargaPerKgCompound.value > 0 ? hargaPerKgCompound.value : 23238);
      }

      let layerWeight = 0;
      let layerCost = 0;
      if (curOd > curId && curId > 0) {
        const area = (Math.PI * (curOd * curOd - curId * curId)) / 4;
        let grossWeight = area * sg * 1e-3 * sLength;

        // Bila layer TUBE dan terdapat kawat baja SPRING tertanam di dalamnya, kurangi volume kawat
        if (lKey === 'TUBE' && springGrp && wireThickVal > 0) {
          const wPitch = wirePitchVal > 0 ? wirePitchVal : 5;
          const wTurns = (wPitch + wireThickVal > 0) ? (1000 / (wPitch + wireThickVal)) : 0;
          const wLen = curOd > 0 && wTurns > 0 ? ((wTurns * curOd * Math.PI) / 1000) : 0;
          const wireDisplacementKg = (wireThickVal * wireThickVal * Math.PI * wLen * sg * sLength) / 4000;
          grossWeight = Math.max(0, grossWeight - wireDisplacementKg);
        }

        layerWeight = Number(grossWeight.toFixed(4));
        layerCost = round2(layerWeight * costKg);
      }
      if (weightParam) weightParam.value = layerWeight > 0 ? formatCommaNumber(layerWeight, 4) : '';
      if (priceParam) priceParam.value = layerCost > 0 ? formatCommaNumber(layerCost, 2) : '';
      totalHoseWeight += layerWeight;
      totalMatCostExclude += layerCost;
    }
  });

  // 3. Update SPEC OD dari lapisan fisik terluar
  if (prevOd > 0 && specOd) {
    specOd.value = formatCommaNumber(prevOd, 2);
  }

  // 4. Update HOSE TOTAL BERAT
  const hoseWeightParam = getParam(hoseGrp, 'weight') || getParam(hoseGrp, 'berat');
  const finalHoseWeight = Number(totalHoseWeight.toFixed(4));
  if (hoseWeightParam) hoseWeightParam.value = finalHoseWeight > 0 ? formatCommaNumber(finalHoseWeight, 4) : '';

  // 5. Update BAHAN BAKU MATERIAL EXCLUDE & INCLUDE
  const bbExcludeParam = getParam(bbGrp, 'exclude');
  const bbIncludeParam = getParam(bbGrp, 'include');
  const matCostExclude = round2(totalMatCostExclude);
  const matCostInclude = round2(matCostExclude * 1.11);
  if (bbExcludeParam) bbExcludeParam.value = matCostExclude > 0 ? formatCommaNumber(matCostExclude, 2) : '';
  if (bbIncludeParam) bbIncludeParam.value = matCostInclude > 0 ? formatCommaNumber(matCostInclude, 2) : '';
};

/** Terapkan Preset Lapisan Selang (3-Layer Anyam, 4-Layer LPG, Spring Kawat, Spiral Rod, Dof) */
const applyHosePreset = (presetId: string) => {
  const preset = HOSE_PRESETS.find(p => p.id === presetId);
  if (!preset) return;
  selectedHosePresetId.value = presetId;

  // Preserve existing inputs (like Size inch, Length M, Tube ID, Thickness, etc.)
  const existingParamMap = new Map<string, string>();
  layerGroups.value.forEach(g => {
    const gKey = getLayerKeyFromDisplay(g.layer_display);
    g.params.forEach(p => {
      const pName = (p.nama_parameter_display || '').toLowerCase();
      if (p.value !== undefined && p.value !== null && p.value !== '') {
        if (p.calc_key) existingParamMap.set(`${gKey}:::calc_${p.calc_key}`, p.value);
        if (p.short_label) existingParamMap.set(`${gKey}:::lbl_${p.short_label.toLowerCase()}`, p.value);
        existingParamMap.set(`${gKey}:::name_${pName}`, p.value);
        if (p.nama_parameter) existingParamMap.set(`${gKey}:::id_${p.nama_parameter}`, p.value);
      }
    });
  });

  const standardRows: LayerGroupRow[] = [];
  preset.layers.forEach((def, idx) => {
    const matchedLayer = findLayerItem(def.code, def.name);
    const layerId = matchedLayer?.id || '';
    const layerDisplay = matchedLayer?.value1 || def.name;

    const template = LAYER_PARAM_TEMPLATES[def.key] || [];
    const params: LayerGroupParam[] = template.map((t) => {
      const matchedSpec = findSpecItem(t.specCode, t.specName);
      const matchedUom = findUomItem(t.uom);

      let existingVal: string | undefined;
      if (t.calcKey) existingVal = existingParamMap.get(`${def.key}:::calc_${t.calcKey}`);
      if (existingVal === undefined && t.shortLabel) existingVal = existingParamMap.get(`${def.key}:::lbl_${t.shortLabel.toLowerCase()}`);
      if (existingVal === undefined) existingVal = existingParamMap.get(`${def.key}:::name_${t.specName.toLowerCase()}`);
      if (existingVal === undefined && matchedSpec?.id) existingVal = existingParamMap.get(`${def.key}:::id_${matchedSpec.id}`);

      const finalVal = existingVal !== undefined && existingVal !== ''
        ? existingVal
        : (t.defaultValue ? String(t.defaultValue).replace('.', ',') : '');

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
      };
    });

    standardRows.push({
      local_id: `grp_preset_${def.key}_${Date.now()}_${idx}`,
      layer_id: layerId,
      layer_display: layerDisplay,
      params,
    });
  });

  layerGroups.value = standardRows;
  autoChainHoseParams();
  syncGroupsToDetailSpek();
  syncSpekWeightToQty();
  toast.success(`Preset "${preset.name}" berhasil diterapkan!`);
};

const onPresetSelectChange = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  if (target && target.value) {
    applyHosePreset(target.value);
  }
};

/** Helper untuk menampilkan keterangan asal usul / rumus parameter */
const getFormulaDesc = (grp: LayerGroupRow, p: LayerGroupParam): string => {
  if (p.formula_text) return p.formula_text;
  const grpKey = getLayerKeyFromDisplay(grp.layer_display);
  const pName = (p.nama_parameter_display || spekMap.value[p.nama_parameter] || '').toLowerCase();

  if (p.is_linked) {
    if (p.link_source) return `Ambil dari ${p.link_source}`;
    if (grpKey === 'SPEC' && pName.includes('inner')) return 'Ambil dari TUBE ID';
    if (grpKey === 'SPEC' && pName.includes('outer')) return 'Ambil dari COVER OD';
    if (grpKey === 'COVER' && pName.includes('inner')) return 'Ambil dari TUBE OD';
    if (grpKey === 'YARN' && pName.includes('inner')) return 'Ambil dari COVER ID';
    return 'Auto Ambil';
  }

  if (p.is_calculated) {
    if (grpKey === 'TUBE') {
      if (pName.includes('outer') || pName.includes('od')) return 'Rumus: ID + (2 × Thick)';
      if (pName.includes('weight') || pName.includes('berat')) return 'Rumus: π × ((OD²-ID²)/4) × SG × 10⁻³ × Panjang (dikurangi Kawat bila ada Spring)';
      if (pName.includes('price') || pName.includes('harga')) return 'Rumus: Berat/M × Harga Compound';
    }
    if (grpKey === 'COVER_TUBE') {
      if (pName.includes('outer') || pName.includes('od')) return 'Rumus: ID + (2 × Thick)';
      if (pName.includes('weight') || pName.includes('berat')) return 'Rumus: π × ((OD²-ID²)/4) × SG × 10⁻³ × Panjang';
      if (pName.includes('price') || pName.includes('harga')) return 'Rumus: Berat/M × Harga Compound CT';
    }
    if (grpKey === 'COVER') {
      if (pName.includes('outer') || pName.includes('od')) return 'Rumus: ID + (2 × Thick)';
      if (pName.includes('weight') || pName.includes('berat')) return 'Rumus: π × ((OD²-ID²)/4) × SG × 10⁻³ × Panjang';
      if (pName.includes('price') || pName.includes('harga')) return 'Rumus: Berat/M × Harga Compound';
    }
    if (grpKey === 'SPRING') {
      if (pName.includes('length') || pName.includes('panjang')) return 'Rumus: (1000/(Jarak+Tebal)) × (OD × π / 1000)';
      if (pName.includes('weight') || pName.includes('berat')) return 'Rumus: (Tebal² × π × 7.8 × Panjang) / 4000';
      if (pName.includes('price') || pName.includes('harga')) return 'Rumus: Berat Kawat × Harga Kawat/kg';
    }
    if (grpKey === 'ROD') {
      if (pName.includes('length') || pName.includes('panjang')) return 'Rumus: (Tube ID + 1) × π × (1000/Pitch) / 1000';
      if (pName.includes('weight') || pName.includes('berat')) return 'Rumus: (OD_Rod/2)² × π × SG_Rod × Panjang / 1000';
      if (pName.includes('price') || pName.includes('harga')) return 'Rumus: Berat Rod × Harga Compound Rod';
    }
    if (grpKey === 'YARN') {
      if (pName.includes('outer') || pName.includes('od')) return 'Rumus: ID + (4 × P)';
      if (pName.includes('weight') || pName.includes('berat')) return 'Rumus: (Denier×Carrier/9.000.000)/cos(Sudut)/(1-Loss)';
      if (pName.includes('price') || pName.includes('harga')) return 'Rumus: Berat/M × Harga Benang';
    }
    if (grpKey === 'HOSE') {
      if (pName.includes('weight') || pName.includes('berat')) return 'Rumus: Akumulasi seluruh lapisan fisik aktif (kg)';
    }
    if (grpKey === 'BAHAN_BAKU') {
      if (pName.includes('exclude')) return 'Rumus: Total Biaya Material Exclude PPN';
      if (pName.includes('include')) return 'Rumus: Exclude × 1,11 (PPN 11%)';
    }
    return 'Terhitung Rumus';
  }

  return '';
};

/** Handler ketika nilai parameter diinput / diubah */
const onParamValueChange = (grp: LayerGroupRow, p: LayerGroupParam, rawVal: string) => {
  let val = rawVal;

  // Jika input pecahan lengkap seperti '3/8', langsung konversi ke desimal berkoma
  if (val.includes('/')) {
    const parts = val.split('/');
    if (parts.length === 2 && parts[1].trim() !== '') {
      const num = parseFloat(parts[0].replace(',', '.'));
      const den = parseFloat(parts[1].replace(',', '.'));
      if (!isNaN(num) && !isNaN(den) && den !== 0) {
        val = String(Number((num / den).toFixed(4))).replace('.', ',');
      }
    }
  }

  // Otomatis ubah titik '.' menjadi koma ','
  val = val.replace(/\./g, ',');

  // Hanya perbolehkan angka, minus, dan koma (mencegah karakter slash atau huruf)
  val = val.replace(/[^0-9,-]/g, '');

  p.value = val;

  // Jalankan rantai sinkronisasi dimensi seperti di Excel
  autoChainHoseParams(grp, p);

  syncGroupsToDetailSpek();
  syncSpekWeightToQty();
};

/** Handler blur untuk memastikan nilai bersih dan terformat koma */
const onParamValueBlur = (grp: LayerGroupRow, p: LayerGroupParam) => {
  if (!p.value) return;
  let val = String(p.value).trim();
  if (val.includes('/')) {
    const parts = val.split('/');
    if (parts.length === 2) {
      const num = parseFloat(parts[0].replace(',', '.'));
      const den = parseFloat(parts[1].replace(',', '.'));
      if (!isNaN(num) && !isNaN(den) && den !== 0) {
        p.value = formatCommaNumber(num / den, 4);
      }
    }
  } else {
    p.value = val.replace(/\./g, ',');
  }
  autoChainHoseParams(grp, p);
  syncGroupsToDetailSpek();
};

/** Kompatibilitas alias */
const ensureExcelSpecStructure = (forceReset = false) => {
  initLayerGroups(forceReset);
};

const getColsForLayerGroup = (groupKey: string) => {
  return EXCEL_COLUMNS
    .map((col, idx) => ({ ...col, colIndex: idx }))
    .filter(col => col.layerKey === groupKey);
};

// ============================================================================
// FUNCTIONS
// ============================================================================
const toggleRowExpand = (index: number) => {
  if (bomDetails.value[index]) {
    bomDetails.value[index]._expanded = !bomDetails.value[index]._expanded;
  }
};

const ensureFinalRoute = () => {
  bomDetails.value.forEach((row, idx) => {
    row.is_final = idx === bomDetails.value.length - 1;
    if (row.is_final) {
      row.output_type = selectedTipeId.value;
      row.m_item_id = values.m_item_id;
      row.m_item = values.m_item ? { ...values.m_item } : null;
      row.qty = values.qty;
      row.unit_id = values.unit_id;
      row.unit = values.unit ? { ...values.unit } : null;
    }
  });
};

const mapPrecostDetailToMaterial = (d: any): Material => ({
  _from_precost: true,
  item_type_id: d.item_type_id || d.m_item?.tipe_id || "",
  item_type: d.item_type_precost || d.m_item?.mi_tipe || null,
  bom_mat_type: d.item_type_precost || d.m_item?.mi_tipe || null,
  m_item_id: d.m_item_id,
  m_item: d.m_item || null,
  is_main: !!d.is_main,
  qty: Number(d.qty) || 0,
  unit_id: d.unit_id || d.m_item?.uom_id || "",
  unit: d.unit_precost || d.m_item?.mi_uom || null,
  bom_mat_unit: d.unit_precost || d.m_item?.mi_uom || null,
  weight: round2(
    (Number(d.qty) || 0) * (Number(d.m_item?.berat_bersih) || 0)
  ),
  phr: 0,
  berat_jenis: d.berat_jenis != null && d.berat_jenis !== 0 
    ? Number(d.berat_jenis) 
    : (d.m_item?.berat_jenis != null ? Number(d.m_item.berat_jenis) : 0),
  harga_satuan: Number(d.price) || 0,
  notes: d.notes || "",
});

const autoPopulatePrecostMaterials = (targetIdx = 0): number => {
  if (!precostDetails.value.length) return 0;

  if (bomDetails.value.length === 0) {
    addBomRow();
    return bomDetails.value[0]?.materials.length || 0;
  }

  const targetRow = bomDetails.value[targetIdx];
  if (!targetRow) return 0;

  // Bersihkan baris material kosong jika ada
  targetRow.materials = (targetRow.materials || []).filter((m) => !!m.m_item_id);

  let addedCount = 0;
  precostDetails.value.forEach((d) => {
    if (!d.m_item_id) return;
    if (targetRow.materials.some((m) => m.m_item_id === d.m_item_id)) return;
    targetRow.materials.push(mapPrecostDetailToMaterial(d));
    addedCount++;
  });

  ensureFinalRoute();
  autoChainHoseParams();
  return addedCount;
};

const addBomRow = () => {
  const newRow = newBomRow();
  // Jika ada Pre-Costing terpilih dan belum ada routing manapun yang memiliki material,
  // otomatis masukkan material dari Pre-Costing ke routing row baru ini
  if ((values.t_precost_id || values.t_precost?.id) && precostDetails.value.length > 0) {
    const anyHasMaterial = bomDetails.value.some((r) =>
      (r.materials || []).some((m) => m._from_precost || m.m_item_id)
    );
    if (!anyHasMaterial) {
      newRow.materials = precostDetails.value
        .filter((d) => !!d.m_item_id)
        .map(mapPrecostDetailToMaterial);
    }
  }
  bomDetails.value.push(newRow);
  ensureFinalRoute();
  autoChainHoseParams();
};

const addMaterialRow = (parentIndex: number) => {
  bomDetails.value[parentIndex]?.materials.push(newMaterial());
};

const removeBomRow = (index: number) => {
  bomDetails.value.splice(index, 1);
  bomDetails.value = bomDetails.value.map((row, idx) => ({
    ...row,
    sequence: idx + 1,
  }));
  ensureFinalRoute();
};

const removeMaterialRow = (pIdx: number, mIdx: number) => {
  bomDetails.value[pIdx]?.materials.splice(mIdx, 1);
};

const addCoProductRow = () => {
  coProducts.value.push(newCoProduct());
};

const removeCoProductRow = (index: number) => {
  coProducts.value.splice(index, 1);
  coProducts.value = coProducts.value.map((row, idx) => ({
    ...row,
    sequence: idx + 1,
  }));
};

const toggleIsFinal = (idx: number) => {
  const row = bomDetails.value[idx];
  if (!row) return;
  row.is_final = !row.is_final;
  if (row.is_final) {
    row.output_type = selectedTipeId.value;
    row.m_item_id = values.m_item_id;
    row.m_item = values.m_item ? { ...values.m_item } : null;
    row.qty = values.qty;
    row.unit_id = values.unit_id;
    row.unit = values.unit ? { ...values.unit } : null;
  } else {
    row.m_item_id = "";
    row.m_item = null;
    row.qty = 1;
    row.unit_id = "";
    row.unit = null;
    row.output_type = "";
  }
  ensureFinalRoute();
};


const onOutputTypeChange = (idx: number, v: string) => {
  const row = bomDetails.value[idx];
  if (!row) return;
  row.output_type = v;
  row.m_item_id = "";
  row.m_item = null;
};

// ============================================================================
// HELPERS
// ============================================================================
const round2 = (value: number) => Number(Number(value || 0).toFixed(2));

// ============================================================================
// PRECOSTING REFERENCE
// ============================================================================
const precostDetails = ref<any[]>([]);
const precostSpeks = ref<any[]>([]);
const precostDetailsLoading = ref(false);
const precostDialogOpen = ref(false);
const precostTargetIdx = ref<number | null>(null);
const selectedPrecostRows = ref<any[]>([]);

const fetchPrecostDetails = async (precostId: string) => {
  if (!precostId) {
    precostDetails.value = [];
    precostSpeks.value = [];
    return;
  }
  precostDetailsLoading.value = true;
  try {
    const res = await getPrecostById(precostId);
    if (res.status === "success" && res.data) {
      precostDetails.value = ((res.data as any).t_precost_ds || []) as any[];
      precostSpeks.value =
        ((res.data as any).t_precost_d_speks ||
          (res.data as any).t_precost_d_spek ||
          []) as any[];
      if ((res.data as any).type) {
        handleTypeChange((res.data as any).type);
      }
    } else {
      precostDetails.value = [];
      precostSpeks.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch precost details", error);
    precostDetails.value = [];
    precostSpeks.value = [];
  } finally {
    precostDetailsLoading.value = false;
  }
};

/** Auto-fill spek dari Pre-Costing yang dipilih ke layer & parameter BOM */
const applyPrecostSpeks = () => {
  const speks = (precostSpeks.value || [])
    .slice()
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  if (!speks.length) return 0;

  // Pastikan layerGroups standar sudah ada
  if (layerGroups.value.length === 0) {
    initLayerGroups();
  }

  let appliedCount = 0;

  speks.forEach((s) => {
    const sLayerId = s.layer_id || "";
    const sLayerName = s.m_layer?.value1 || layerMap.value[sLayerId] || "";
    const lKey = getLayerKeyFromDisplay(sLayerName);

    // Cari group yang cocok
    let targetGrp = layerGroups.value.find((g) => {
      if (sLayerId && g.layer_id === sLayerId) return true;
      if (lKey && getLayerKeyFromDisplay(g.layer_display) === lKey) return true;
      return false;
    });

    const sParamId = s.param_id || "";
    const sParamName = (s.param_display || s.m_spec?.value1 || spekMap.value[sParamId] || "").toLowerCase().trim();
    const sVal = s.value != null ? formatCommaNumber(s.value, 4) : "";

    if (targetGrp) {
      if (sLayerId && !targetGrp.layer_id) {
        targetGrp.layer_id = sLayerId;
        targetGrp.layer_display = sLayerName || targetGrp.layer_display;
      }

      // Cari param yang cocok di dalam targetGrp
      const targetParam = targetGrp.params.find((p) => {
        if (sParamId && p.nama_parameter === sParamId) return true;
        const pName = (p.nama_parameter_display || spekMap.value[p.nama_parameter] || "").toLowerCase().trim();
        if (sParamName && pName) {
          if (sParamName === pName) return true;
          if (sParamName.includes("inner") && pName.includes("inner")) return true;
          if (sParamName.includes("outer") && pName.includes("outer")) return true;
          if (sParamName.includes("thick") && pName.includes("thick")) return true;
          if (sParamName.includes("weight") && pName.includes("weight")) return true;
          if (sParamName.includes("price") && pName.includes("price")) return true;
        }
        return false;
      });

      if (targetParam) {
        if (sVal !== "") targetParam.value = sVal;
        if (s.unit_id) {
          targetParam.satuan = s.unit_id;
          targetParam.satuan_display = uomMap.value[s.unit_id] || s.m_uom?.value1 || targetParam.satuan_display;
        }
        if (s.notes) targetParam.notes = s.notes;
        (targetParam as any)._from_precost = true;
        appliedCount++;
      } else {
        targetGrp.params.push({
          _from_precost: true,
          nama_parameter: sParamId,
          nama_parameter_display: spekMap.value[sParamId] || s.m_spec?.value1 || sParamName,
          value: sVal,
          satuan: s.unit_id || "",
          satuan_display: uomMap.value[s.unit_id] || s.m_uom?.value1 || "",
          notes: s.notes || "",
          is_calculated: false,
          short_label: getShortParamLabel(spekMap.value[sParamId] || sParamName),
          placeholder: "0",
          formula_text: "Dari Pre-Costing",
        });
        appliedCount++;
      }
    } else {
      const newGrp: LayerGroupRow = {
        local_id: `grp_precost_${Date.now()}_${appliedCount}`,
        layer_id: sLayerId,
        layer_display: sLayerName || "Layer",
        params: [{
          _from_precost: true,
          nama_parameter: sParamId,
          nama_parameter_display: spekMap.value[sParamId] || s.m_spec?.value1 || sParamName,
          value: sVal,
          satuan: s.unit_id || "",
          satuan_display: uomMap.value[s.unit_id] || s.m_uom?.value1 || "",
          notes: s.notes || "",
          is_calculated: false,
          short_label: getShortParamLabel(spekMap.value[sParamId] || sParamName),
          placeholder: "0",
          formula_text: "Dari Pre-Costing",
        }],
      };
      layerGroups.value.push(newGrp);
      appliedCount++;
    }
  });

  syncGroupsToDetailSpek();
  syncDetailSpekToLayerDims();
  autoChainHoseParams();

  return appliedCount;
};

const handlePrecostSelected = async (item: any) => {
  values.t_precost = item;
  if (item) {
    values.t_precost_id = item.id;
    values.m_item_id = item.m_item_id || "";
    values.m_item = item.m_item || null;
    values.qty = Number(item.qty) || values.qty;
    values.unit_id = item.unit_id || item.m_item?.uom_id || "";

    // Auto-isi jenis BOM dari Pre-Costing
    if (item.type) {
      handleTypeChange(item.type);
    }

    if (item.harga_per_kg_compound && Number(item.harga_per_kg_compound) > 0) {
      values.harga_per_kg_compound = Number(item.harga_per_kg_compound);
      formulaHargaTube.value = Number(item.harga_per_kg_compound);
    }

    await fetchPrecostDetails(item.id);

    if (isTypeSpesifik.value) {
      const addedCount = applyPrecostSpeks();
      if (addedCount > 0) {
        toast.success(`${addedCount} parameter spek dari Pre-Costing diterapkan & formula dihitung`);
      }
    }

    const addedMatCount = autoPopulatePrecostMaterials(0);
    if (addedMatCount > 0) {
      toast.success(`${addedMatCount} material dari Pre-Costing otomatis diterapkan ke BOM`);
    }
  } else {
    let removedCount = 0;
    bomDetails.value.forEach((row) => {
      const before = row.materials.length;
      row.materials = row.materials.filter((m) => !m._from_precost);
      removedCount += before - row.materials.length;
    });
    bomDetails.value = bomDetails.value.filter(
      (row) => row.materials.length > 0 || row.m_routing_id
    );
    const beforeSpek = detailSpek.value.length;
    detailSpek.value = detailSpek.value.filter((s) => !(s as any)._from_precost);
    const removedSpek = beforeSpek - detailSpek.value.length;
    values.t_precost_id = "";
    values.t_precost = null;
    values.m_item_id = "";
    values.m_item = null;
    values.qty = 1;
    values.unit_id = "";
    values.unit = null;
    precostDetails.value = [];
    precostSpeks.value = [];
    selectedPrecostRows.value = [];
    ensureFinalRoute();
    initLayerGroups(true);
    syncDetailSpekToLayerDims();
    autoChainHoseParams();
    if (removedCount > 0) {
      toast.info(`${removedCount} material dari Pre-Costing dihapus`);
    }
    if (removedSpek > 0) {
      toast.info(`${removedSpek} detail spek dari Pre-Costing dihapus`);
    }
  }
};

/** Item / Qty / UoM terkunci saat diisi dari Pre-Costing */
const isPrecostLocked = computed(() => !!values.t_precost_id);

const openPrecostDetailDialog = (idx: number) => {
  if (!values.t_precost_id) return;
  precostTargetIdx.value = idx;
  selectedPrecostRows.value = [];
  precostDialogOpen.value = true;
};

/** Material precosting yang belum ada di routing tujuan (anti duplikat) */
const availablePrecostDetails = computed(() => {
  const targetIdx = precostTargetIdx.value;
  const existingIds =
    targetIdx === null
      ? []
      : (bomDetails.value[targetIdx]?.materials || [])
          .map((m) => m.m_item_id)
          .filter((id: string) => !!id);
  return precostDetails.value.filter(
    (d) => d.m_item_id && !existingIds.includes(d.m_item_id)
  );
});

const onPrecostSelectionChange = (items: any[]) => {
  selectedPrecostRows.value = items;
};

const confirmAddPrecostMaterials = () => {
  const targetIdx = precostTargetIdx.value;
  if (targetIdx === null) return;
  const row = bomDetails.value[targetIdx];
  if (!row) return;

  // Bersihkan baris placeholder kosong jika ada
  row.materials = (row.materials || []).filter((m) => !!m.m_item_id);

  let addedCount = 0;
  let skippedCount = 0;
  selectedPrecostRows.value.forEach((d) => {
    if (!d.m_item_id) return;
    // Rule: tidak boleh ada material yang sama dalam 1 routing
    if ((row.materials || []).some((m) => m.m_item_id === d.m_item_id)) {
      skippedCount++;
      return;
    }
    row.materials.push(mapPrecostDetailToMaterial(d));
    addedCount++;
  });

  if (addedCount > 0) {
    toast.success(`${addedCount} material dari Pre-Costing ditambahkan`, {
      description:
        skippedCount > 0
          ? `${skippedCount} material dilewati karena sudah ada di routing ini`
          : undefined,
    });
  } else {
    toast.info("Tidak ada material baru yang ditambahkan");
  }
  precostDialogOpen.value = false;
  selectedPrecostRows.value = [];
  autoChainHoseParams();
};

// ============================================================================
// COMPUTED
// ============================================================================
const totalKgMaterial = computed(() => {
  return bomDetails.value.reduce((total, row) => {
    return (
      total +
      (row.materials || [])
        .filter((mat) => mat.is_main === true)
        .reduce((sub, mat) => {
          // Pakai weight tersimpan kalau ada, fallback ke qty × berat_bersih dari m_item
          const w = Number(mat.weight) || round2((Number(mat.qty) || 0) * (Number(mat.m_item?.berat_bersih) || 0));
          return sub + w;
        }, 0)
    );
  }, 0);
});

// WIP mode: Qty header otomatis dari total qty semua main material di semua routing
const isWipMode = computed(() => values.flag === 'WIP' || isTypeChemical.value);

const totalQtyMainMaterial = computed(() => {
  if (!isWipMode.value) return null;
  return bomDetails.value.reduce((total, row) => {
    return (
      total +
      (row.materials || [])
        .filter((mat) => mat.is_main === true)
        .reduce((sub, mat) => sub + (Number(mat.qty) || 0), 0)
    );
  }, 0);
});

// Auto-sync qty header dari total qty main material saat WIP mode
watch(totalQtyMainMaterial, (newVal) => {
  if (isWipMode.value && newVal !== null) {
    values.qty = newVal;
  }
});

// Helper: hitung PHR per material row dalam satu routing
// PHR = (qty material / qty main material dalam routing ini) × 100
const getPHR = (routingIdx: number, mat: any): number => {
  const mainQty = (bomDetails.value[routingIdx]?.materials || [])
    .filter((m) => m.is_main === true)
    .reduce((sum, m) => sum + (Number(m.qty) || 0), 0);
  if (!mainQty) return 0;
  return round2(((Number(mat.qty) || 0) / mainQty) * 100);
};

/** Ambil berat aktual/bersih material dari master item m_item */
const getMatActual = (mat: any): number => {
  if (mat?.berat_bersih != null && mat.berat_bersih !== '') return Number(mat.berat_bersih);
  if (mat?.m_item?.berat_bersih != null && mat.m_item.berat_bersih !== '') return Number(mat.m_item.berat_bersih);
  return 0;
};

/** Ambil berat jenis material (prioritaskan mat.berat_jenis tersimpan, fallback ke master m_item.berat_jenis) */
const getMatBeratJenis = (mat: any): number => {
  if (mat?.berat_jenis != null && mat.berat_jenis !== 0 && mat.berat_jenis !== '') return Number(mat.berat_jenis);
  if (mat?.m_item?.berat_jenis != null && mat.m_item.berat_jenis !== '') return Number(mat.m_item.berat_jenis);
  return 0;
};

const getMatVolume = (mat: any): number => {
  if (mat?.volume !== undefined && mat?.volume !== null && mat?.volume !== '' && !isNaN(Number(mat.volume)) && Number(mat.volume) > 0) {
    return Number(mat.volume);
  }
  const kg = Number(mat.qty) || 0;
  const sg = getMatBeratJenis(mat);
  if (sg <= 0) return 0;
  return Number((kg / sg).toFixed(3));
};

/** Format angka rupiah / ribuan Indonesia */
const formatRupiahNumber = (val: number | string): string => {
  if (val === undefined || val === null || val === '') return '0';
  const num = typeof val === 'number' ? val : Number(val);
  if (isNaN(num)) return '0';
  return num.toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

/** Total Qty per routing */
const getRoutingTotalQty = (materials: Material[]) => {
  return round2((materials || []).reduce((sum, m) => sum + (Number(m.qty) || 0), 0));
};

/** Total PHR per routing */
const getRoutingTotalPhr = (routingIdx: number) => {
  return round2((bomDetails.value[routingIdx]?.materials || []).reduce((sum, m) => sum + getPHR(routingIdx, m), 0));
};

/** Total Harga BB per routing (Σ Qty × Harga/KG) */
const getRoutingTotalHargaBb = (materials: Material[]) => {
  return round2((materials || []).reduce((sum, m) => sum + ((Number(m.qty) || 0) * (Number(m.harga_satuan) || 0)), 0));
};

const hasFinalRoute = computed(() => bomDetails.value.some((r) => r.is_final));

// ============================================================================
// KALKULASI COMPOUND (dari rumus Excel: PHR, Volume, SG Compound, Harga/KG)
// ============================================================================

/**
 * Kumpulkan semua material dari semua routing (flatten).
 * Setiap baris berisi: qty (KG), SG (berat_jenis), harga_beli dari m_item.
 */
const allMaterials = computed(() =>
  bomDetails.value.flatMap((row) => row.materials || [])
);

/** Total KG semua material (batch weight) */
const batchWeightKg = computed(() =>
  allMaterials.value.reduce((sum, mat) => sum + (Number(mat.qty) || 0), 0)
);

/** KG material PVC/base resin (is_main = true) untuk referensi PHR */
const baseResinKg = computed(() => {
  const mains = allMaterials.value.filter((m) => m.is_main === true);
  return mains.reduce((sum, m) => sum + (Number(m.qty) || 0), 0);
});

/**
 * Detail per material untuk tampilan tabel PHR/Volume/Harga
 * PHR   = (KG_mat / KG_base) × 100
 * Volume= KG_mat / SG_mat
 * Harga = KG_mat × harga_satuan (diinput user)
 */
const compoundMaterialRows = computed(() =>
  allMaterials.value.map((mat) => {
    const kg    = Number(mat.qty) || 0;
    const sg    = getMatBeratJenis(mat);
    const harga = Number(mat.harga_satuan) || 0;
    const phr   = baseResinKg.value > 0 ? round2((kg / baseResinKg.value) * 100) : 0;
    const vol   = getMatVolume(mat);
    const totalHarga = round2(kg * harga);
    return {
      nama: mat.m_item?.nama_item || mat.m_item_id || '-',
      kg,
      phr,
      sg,
      vol,
      harga,
      totalHarga,
      isMain: mat.is_main,
    };
  })
);

/** Total Volume dari semua material */
const totalVolume = computed(() =>
  compoundMaterialRows.value.reduce((sum, r) => sum + r.vol, 0)
);

/** Total Harga BB (biaya bahan baku) */
const totalHargaBB = computed(() =>
  compoundMaterialRows.value.reduce((sum, r) => sum + r.totalHarga, 0)
);

/**
 * SG Compound = ΣKG / ΣVolume
 * (Specific Gravity campuran keseluruhan)
 */
const sgCompound = computed(() => {
  if (!totalVolume.value) return 0;
  return Number((batchWeightKg.value / totalVolume.value).toFixed(4));
});

/**
 * Harga/KG Compound = ΣHarga_BB / ΣKG
 */
const hargaPerKgCompound = computed(() => {
  if (!batchWeightKg.value) return 0;
  return round2(totalHargaBB.value / batchWeightKg.value);
});

/** Total PHR dari semua material */
const totalPHR = computed(() =>
  round2(compoundMaterialRows.value.reduce((sum, r) => sum + r.phr, 0))
);

/** Daftar material yang belum memiliki Berat Jenis (SG) di Master Item */
const materialsWithoutSg = computed(() =>
  allMaterials.value.filter((m) => m.m_item_id && getMatBeratJenis(m) <= 0)
);

const handleRoutingMaterialSelected = (mat: any, item: any) => {
  mat.m_item = item;
  mat.unit_id = item?.uom_id;
  mat.weight = round2((Number(mat.qty) || 0) * (Number(item?.berat_bersih) || 0));
  const actualVal = item?.berat_bersih != null && item?.berat_bersih !== '' ? Number(item.berat_bersih) : 0;
  const sgVal = item?.berat_jenis != null && item?.berat_jenis !== '' ? Number(item.berat_jenis) : 0;
  mat.berat_bersih = actualVal;
  mat.berat_jenis = sgVal;
  if (item && sgVal <= 0) {
    toast.warning(`Item "${item.nama_item || item.kode_item}" belum memiliki Berat Jenis (SG) di Master Item. Harap lengkapi di Master Item agar Volume & SG Compound akurat.`);
  }
};

/** Toggle panduan catatan rumus */
const showFormulaGuide = ref(false);

/** Helper identifikasi badge parameter spek (ID, OD, Thickness) */
const getSpekTypeBadge = (paramName: string) => {
  if (!paramName) return null;
  const name = paramName.toLowerCase().trim();
  if (SPEK_ALIASES.id.some(a => name === a || name.startsWith(a))) {
    return { label: 'Inner Ø (ID)', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800' };
  }
  if (SPEK_ALIASES.od.some(a => name === a || name.startsWith(a))) {
    return { label: 'Outer Ø (OD)', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
  }
  if (SPEK_ALIASES.thick.some(a => name === a || name.startsWith(a))) {
    return { label: 'Thickness (T)', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800' };
  }
  return null;
};

// ============================================================================
// KALKULASI SELANG (dari dimensi di Detail Spek)
// ============================================================================

/** Helper: ambil value numerik dari detail spek berdasarkan nama parameter (case-insensitive) */
/**
 * Helper: ambil value numerik dari detail spek.
 * Mendukung alias agar nama parameter yang beragam tetap ter-match.
 */
const SPEK_ALIASES: Record<string, string[]> = {
  id: ['inner diameter', 'inner dia', 'diameter dalam', 'id', 'i.d', 'i.d.'],
  od: ['outer diameter', 'outer dia', 'diameter luar', 'od', 'o.d', 'o.d.'],
  thick: ['thickness', 'thick', 'tebal', 'ketebalan', 'wall thickness', 'wall thick'],
  klos: ['jumlah klos', 'carrier count', 'klos', 'carrier', 'klos kawat', 'bobbin'],
  angle: ['sudut anyaman', 'braid angle', 'sudut lilitan', 'angle', 'sudut'],
  pitch: ['pitch anyaman', 'braid pitch', 'pitch', 'pitch heliks'],
};

const getSpekValue = (key: string): number => {
  const aliases = SPEK_ALIASES[key] || [key];
  const row = detailSpek.value.find((s) => {
    const disp = (s.nama_parameter_display || spekMap.value[s.nama_parameter] || '').toLowerCase().trim();
    return aliases.some((alias) => disp === alias || disp.startsWith(alias));
  });
  return parseCommaNumber(row?.value);
};

/** Helper untuk mengambil nilai parameter numerik spesifik per layer dari detailSpek */
const getLayerParamValue = (layerKeywords: string[], paramKeys: string[], excludeKeywords: string[] = []): number => {
  const row = detailSpek.value.find((s) => {
    const lName = (s.layer_display || layerMap.value[s.layer_id] || '').toLowerCase().trim();
    if (excludeKeywords.some((ek) => lName.includes(ek.toLowerCase()))) return false;
    const matchLayer = layerKeywords.some((lk) => lName.includes(lk.toLowerCase()));
    if (!matchLayer) return false;

    const pName = (s.nama_parameter_display || spekMap.value[s.nama_parameter] || '').toLowerCase().trim();
    return paramKeys.some((pk) => {
      const aliases = SPEK_ALIASES[pk] || [pk];
      return aliases.some((a) => pName === a || pName.startsWith(a));
    });
  });
  return parseCommaNumber(row?.value);
};

/** Berat / Meter per lapisan selang (kg/m) */
const getLayerWeightPerMeter = (ld: LayerDimensionRow): number => {
  const od = Number(ld.od_val) || 0;
  const id = Number(ld.id_val) || 0;
  const sg = sgCompound.value || 0;
  if (!od || !id || !sg || od <= id) return 0;
  const area = (Math.PI * (od * od - id * id)) / 4;
  return Number((area * sg * 1e-3).toFixed(6));
};

/** Sinkronisasi layerDimensions ke detailSpek (untuk disimpan ke DB) */
const syncLayerDimsToDetailSpek = () => {
  const idParamId = Object.entries(spekMap.value).find(([_, v]) => (v || '').toLowerCase().includes('inner diameter'))?.[0] || '7b43e9e1-f345-453d-894c-482457b6478f';
  const thickParamId = Object.entries(spekMap.value).find(([_, v]) => (v || '').toLowerCase().includes('thickness'))?.[0] || '4aefed0f-3bd2-45e7-9be5-f8bc96cc767a';
  const odParamId = Object.entries(spekMap.value).find(([_, v]) => (v || '').toLowerCase().includes('outer diameter'))?.[0] || '4930bbf6-fd52-433b-ae0f-0fc0e7fcfc84';

  const otherRows = detailSpek.value.filter((s) => {
    const pName = (s.nama_parameter_display || spekMap.value[s.nama_parameter] || '').toLowerCase().trim();
    const isDim = SPEK_ALIASES.id.some((a) => pName === a || pName.startsWith(a)) ||
                  SPEK_ALIASES.thick.some((a) => pName === a || pName.startsWith(a)) ||
                  SPEK_ALIASES.od.some((a) => pName === a || pName.startsWith(a));
    return !isDim;
  });

  const newDimRows: DetailSpek[] = [];

  layerDimensions.value.forEach((ld) => {
    if (!ld.layer_id && ld.id_val === '' && ld.thick_val === '' && ld.od_val === '') return;
    const lDisplay = ld.layer_display || layerMap.value[ld.layer_id] || '';

    if (ld.id_val !== '' && Number(ld.id_val) > 0) {
      newDimRows.push({
        layer_id: ld.layer_id,
        layer_display: lDisplay,
        nama_parameter: idParamId,
        nama_parameter_display: spekMap.value[idParamId] || 'INNER DIAMETER',
        value: String(ld.id_val),
        satuan: '',
        satuan_display: 'mm',
        notes: ld.notes || '',
      });
    }

    if (ld.thick_val !== '' && Number(ld.thick_val) > 0) {
      newDimRows.push({
        layer_id: ld.layer_id,
        layer_display: lDisplay,
        nama_parameter: thickParamId,
        nama_parameter_display: spekMap.value[thickParamId] || 'THICKNESS',
        value: String(ld.thick_val),
        satuan: '',
        satuan_display: 'mm',
        notes: ld.notes || '',
      });
    }

    if (ld.od_val !== '' && Number(ld.od_val) > 0) {
      newDimRows.push({
        layer_id: ld.layer_id,
        layer_display: lDisplay,
        nama_parameter: odParamId,
        nama_parameter_display: spekMap.value[odParamId] || 'OUTER DIAMETER',
        value: String(ld.od_val),
        satuan: '',
        satuan_display: 'mm',
        notes: ld.notes || '',
      });
    }
  });

  detailSpek.value = [...newDimRows, ...otherRows];
};

/** Parse detailSpek dari database ke format grid layerDimensions */
const syncDetailSpekToLayerDims = () => {
  if (detailSpek.value.length === 0) {
    if (layerDimensions.value.length === 0) {
      layerDimensions.value = defaultLayerRows();
    }
    return;
  }

  const groupMap = new Map<string, { layer_display: string; id_val: number | ''; thick_val: number | ''; od_val: number | ''; notes: string }>();

  detailSpek.value.forEach((s) => {
    const pName = (s.nama_parameter_display || spekMap.value[s.nama_parameter] || '').toLowerCase().trim();
    const isId = SPEK_ALIASES.id.some((a) => pName === a || pName.startsWith(a));
    const isThick = SPEK_ALIASES.thick.some((a) => pName === a || pName.startsWith(a));
    const isOd = SPEK_ALIASES.od.some((a) => pName === a || pName.startsWith(a));
    if (!isId && !isThick && !isOd) return;

    const layerKey = s.layer_id || s.layer_display || 'default';
    if (!groupMap.has(layerKey)) {
      groupMap.set(layerKey, {
        layer_display: s.layer_display || layerMap.value[s.layer_id] || '',
        id_val: '',
        thick_val: '',
        od_val: '',
        notes: s.notes || '',
      });
    }
    const entry = groupMap.get(layerKey)!;
    const val = parseCommaNumber(s.value);
    if (isId) {
      entry.id_val = val || '';
    } else if (isThick) {
      entry.thick_val = val || '';
    } else if (isOd) {
      entry.od_val = val || '';
    }
    if (s.notes && !entry.notes) entry.notes = s.notes;
  });

  const parsedRows: LayerDimensionRow[] = [];
  groupMap.forEach((entry, layerKey) => {
    if (entry.id_val !== '' || entry.thick_val !== '' || entry.od_val !== '' || (layerKey !== 'default' && layerKey !== '')) {
      parsedRows.push({
        layer_id: layerKey === 'default' ? '' : layerKey,
        layer_display: entry.layer_display,
        id_val: entry.id_val,
        thick_val: entry.thick_val,
        od_val: entry.od_val,
        notes: entry.notes,
      });
    }
  });

  if (parsedRows.length > 0) {
    layerDimensions.value = parsedRows;
  } else if (layerDimensions.value.length === 0) {
    layerDimensions.value = defaultLayerRows();
  }

  syncBraidParamsFromDetailSpek();
};

/** Handler perubahan nilai dimensi layer dengan kalkulasi timbal balik otomatis */
const onLayerDimChange = (row: LayerDimensionRow, field: 'id' | 'thick' | 'od') => {
  const id = Number(row.id_val) || 0;
  const thick = Number(row.thick_val) || 0;
  const od = Number(row.od_val) || 0;

  if (field === 'id' || field === 'thick') {
    if (id > 0 && thick > 0) {
      row.od_val = Number((id + 2 * thick).toFixed(4));
    } else if (id > 0 && od > 0 && od > id) {
      row.thick_val = Number(((od - id) / 2).toFixed(4));
    }
  } else if (field === 'od') {
    if (od > 0 && id > 0 && od > id) {
      row.thick_val = Number(((od - id) / 2).toFixed(4));
    } else if (od > 0 && thick > 0 && od > 2 * thick) {
      row.id_val = Number((od - 2 * thick).toFixed(4));
    }
  }

  // Auto-chain ke layer berikutnya jika ID layer berikutnya masih kosong
  const idx = layerDimensions.value.indexOf(row);
  if (idx >= 0 && idx < layerDimensions.value.length - 1) {
    const nextRow = layerDimensions.value[idx + 1];
    if (nextRow && (!nextRow.id_val || nextRow.id_val === 0) && row.od_val) {
      nextRow.id_val = row.od_val;
      if (Number(nextRow.thick_val) > 0) {
        nextRow.od_val = Number((Number(nextRow.id_val) + 2 * Number(nextRow.thick_val)).toFixed(4));
      }
    }
  }

  syncLayerDimsToDetailSpek();
};

const addLayerDimensionRow = () => {
  const prevRow = layerDimensions.value[layerDimensions.value.length - 1];
  const nextId = prevRow && prevRow.od_val ? prevRow.od_val : '';
  layerDimensions.value.push({
    layer_id: '',
    layer_display: '',
    id_val: nextId,
    thick_val: '',
    od_val: '',
    notes: '',
  });
  syncLayerDimsToDetailSpek();
};

const removeLayerDimensionRow = (idx: number) => {
  layerDimensions.value.splice(idx, 1);
  syncLayerDimsToDetailSpek();
};

/** ID (Inner Diameter) dalam mm dari Detail Spek */
const spekIDRaw = computed(() => getSpekValue('id'));
/** OD (Outer Diameter) dalam mm dari Detail Spek */
const spekODRaw = computed(() => getSpekValue('od'));
/** Thickness dalam mm dari Detail Spek */
const spekThickRaw = computed(() => getSpekValue('thick'));

/** ID efektif: dari layer paling dalam (inner tube) atau spek */
const spekIDEffective = computed(() => {
  const tubeIdFromSpek = getLayerParamValue(['tube', 'inner'], ['id'], ['cover', 'outer', 'luar']);
  if (tubeIdFromSpek > 0) return tubeIdFromSpek;
  const firstWithID = layerDimensions.value.find((ld) => {
    const l = (ld.layer_display || '').toLowerCase();
    return (l.includes('tube') || l.includes('inner')) && !l.includes('cover') && Number(ld.id_val) > 0;
  });
  if (firstWithID) return Number(firstWithID.id_val);
  if (spekIDRaw.value > 0) return spekIDRaw.value;
  if (spekODRaw.value > 0 && spekThickRaw.value > 0 && spekODRaw.value > spekThickRaw.value * 2) {
    return Number((spekODRaw.value - spekThickRaw.value * 2).toFixed(4));
  }
  return 0;
});

/** OD efektif: dari layer paling luar (outer cover) atau spek */
const spekODEffective = computed(() => {
  const coverOdFromSpek = getLayerParamValue(['cover', 'outer'], ['od']);
  if (coverOdFromSpek > 0) return coverOdFromSpek;
  const tubeOdFromSpek = getLayerParamValue(['tube', 'inner'], ['od'], ['cover', 'outer', 'luar']);
  const lastWithOD = [...layerDimensions.value].reverse().find((ld) => Number(ld.od_val) > 0);
  if (lastWithOD) return Number(lastWithOD.od_val);
  if (spekODRaw.value > 0) return spekODRaw.value;
  if (tubeOdFromSpek > 0) return tubeOdFromSpek;
  if (spekIDRaw.value > 0 && spekThickRaw.value > 0) {
    return Number((spekIDRaw.value + spekThickRaw.value * 2).toFixed(4));
  }
  return 0;
});

/** Thickness efektif selang */
const spekThickEffective = computed(() => {
  if (spekODEffective.value > 0 && spekIDEffective.value > 0 && spekODEffective.value > spekIDEffective.value) {
    return Number(((spekODEffective.value - spekIDEffective.value) / 2).toFixed(4));
  }
  if (spekThickRaw.value > 0) return spekThickRaw.value;
  return 0;
});

/** Alias spekID dan spekThick */
const spekID = spekIDEffective;
const spekThick = spekThickEffective;

// ============================================================================
// VISUALISASI & SIMULASI REKAYASA SELANG (HOSE BRAID & CONSTRUCTION PREVIEW)
// ============================================================================
const activeHoseView = ref<'braid' | 'helix' | 'crossSection'>('helix');
const braidAngle = ref<number>(54.7); // Sudut anyaman kawat/benang (derajat, default netral 54.7°)
const carrierCount = ref<number>(24); // Jumlah klos / carrier benang/kawat
const wireDiameter = ref<number>(0.35); // Diameter kawat/benang (mm)
const formulaDetailId = ref<string>(""); // ID detail m_bom_d_formula jika tersimpan

/** Harga beli PET Yarn per KG (Rp 50.000 / KG di Excel LPG RED Kolom U32) */
const hargaPerKgYarn = ref<number>(50000);

/** Dimensi & Berat Lapisan TUBE (Kompon Bagian Dalam - Excel LPG RED Kolom G-K) */
const tubeDim = computed(() => {
  // Hanya ambil spek Tube murni (tidak boleh mengandung 'cover' / 'outer')
  const idFromSpek = getLayerParamValue(['tube', 'inner', 'dalam'], ['id'], ['cover', 'outer', 'luar']);
  const thickFromSpek = getLayerParamValue(['tube', 'inner', 'dalam'], ['thick'], ['cover', 'outer', 'luar']);
  const odFromSpek = getLayerParamValue(['tube', 'inner', 'dalam'], ['od'], ['cover', 'outer', 'luar']);

  const tubeLayer = layerDimensions.value.find((ld) => {
    const l = (ld.layer_display || '').toLowerCase();
    return (l.includes('tube') || l.includes('inner')) && !l.includes('cover') && !l.includes('outer');
  });
  const idFromLd = tubeLayer && Number(tubeLayer.id_val) > 0 ? Number(tubeLayer.id_val) : 0;
  const thickFromLd = tubeLayer && Number(tubeLayer.thick_val) > 0 ? Number(tubeLayer.thick_val) : 0;
  const odFromLd = tubeLayer && Number(tubeLayer.od_val) > 0 ? Number(tubeLayer.od_val) : 0;

  let id = idFromSpek || idFromLd || spekIDRaw.value || 0;
  let thick = thickFromSpek || thickFromLd || 0;
  let od = odFromSpek || odFromLd || 0;

  // Timbal balik hitung otomatis jika 2 dari 3 parameter ada:
  if (id > 0 && thick > 0 && !od) {
    od = Number((id + 2 * thick).toFixed(2));
  } else if (id > 0 && od > id && !thick) {
    thick = Number(((od - id) / 2).toFixed(2));
  } else if (od > 0 && thick > 0 && !id && od > 2 * thick) {
    id = Number((od - 2 * thick).toFixed(2));
  } else if (!thick && spekThickRaw.value > 0) {
    thick = Number((spekThickRaw.value * (1 / 3)).toFixed(2));
    if (id > 0 && !od) od = Number((id + 2 * thick).toFixed(2));
  }

  const sg = sgCompound.value || 0;
  const sLength = getLayerParamValue(['spec'], ['length', 'panjang']) || 1;
  const isValidDim = id > 0 && od > id;
  const area = isValidDim ? (Math.PI * (od * od - id * id)) / 4 : 0;
  const weight = sg > 0 && area > 0 ? Number((area * sg * 1e-3 * sLength).toFixed(4)) : 0;
  const cost = round2(weight * hargaPerKgCompound.value);
  const odCalculated = id > 0 && thick > 0 ? Number((id + 2 * thick).toFixed(2)) : 0;
  return { id, thick, od, weight, cost, isValidDim, odCalculated };
});

/** Diameter tengah penguat (Mean Helix Ø dalam mm) = Permukaan luar Tube (tempat anyaman benang melilit) */
const meanHelixDiameter = computed(() => {
  if (tubeDim.value.od > 0) return tubeDim.value.od;
  const id = spekIDEffective.value || 9.5;
  const od = spekODEffective.value || 15.0;
  return Number(((id + od) / 2).toFixed(1));
});

/** Pitch heliks (P dalam mm) = π × D_m / tan(angle) */
const braidPitch = computed(() => {
  const dm = meanHelixDiameter.value;
  const rad = (braidAngle.value * Math.PI) / 180;
  const tanVal = Math.tan(rad);
  if (!tanVal) return 0;
  return Number(((Math.PI * dm) / tanVal).toFixed(1));
});

/** Panjang 1 kawat/benang per 1 meter selang (meter / meter selang) */
const singleWireLengthPerMeter = computed(() => {
  const dm = meanHelixDiameter.value;
  const p = braidPitch.value;
  if (!p) return 0;
  const keliling = Math.PI * dm;
  const lenOneTurn = Math.sqrt(keliling * keliling + p * p);
  return Number((lenOneTurn / p).toFixed(3));
});

/** Total panjang benang/kawat seluruh klos per 1 meter selang (meter) */
const totalWireLengthPerMeterHose = computed(() => {
  return Number((singleWireLengthPerMeter.value * carrierCount.value).toFixed(2));
});

/** Berat benang PET per meter selang (Excel Kolom T32: 0.001 kg = 1 gram/meter) */
/** Terhubung dinamis dengan total panjang benang dari simulasi klos & sudut */
const yarnWeightPerMeter = computed(() => {
  if (!totalWireLengthPerMeterHose.value || carrierCount.value <= 0) return 0.001;
  const benchmarkMeter = 24 * 1.25; // Benchmark 24 klos
  const scale = totalWireLengthPerMeterHose.value / benchmarkMeter;
  return Number((0.001 * Math.max(0.4, Math.min(3.5, scale))).toFixed(4));
});

/** Biaya PET Yarn per meter selang (Rp) = Harga BB Yarn/KG × Berat Yarn/M (Excel Kolom U32) */
const yarnCostPerMeter = computed(() => {
  return round2(yarnWeightPerMeter.value * hargaPerKgYarn.value);
});

/** Dimensi Lapisan PET YARN (Excel Kolom Q-U) */
const yarnDim = computed(() => {
  const idFromSpek = getLayerParamValue(['yarn', 'benang', 'kawat', 'anyaman', 'braid'], ['id']);
  const thickFromSpek = getLayerParamValue(['yarn', 'benang', 'kawat', 'anyaman', 'braid'], ['thick']);
  const odFromSpek = getLayerParamValue(['yarn', 'benang', 'kawat', 'anyaman', 'braid'], ['od']);

  // ID Yarn: menempel di atas permukaan luar Tube
  const id = idFromSpek || tubeDim.value.od || 0;
  // Tebal Yarn (P di Excel Kolom S32 = 0.1 mm)
  const thick = thickFromSpek > 0 ? thickFromSpek : 0.1;
  // OD Yarn (Excel Kolom R32 = ID + 4 * P)
  const od = odFromSpek > 0 ? odFromSpek : (id > 0 ? Number((id + 4 * thick).toFixed(2)) : 0);

  const hasHose = tubeDim.value.id > 0 || tubeDim.value.od > 0 || coverDim.value.od > 0;
  const weight = hasHose ? yarnWeightPerMeter.value : 0;
  const cost = hasHose ? yarnCostPerMeter.value : 0;
  return { id, thick, od, weight, cost };
});

/** Dimensi & Berat Lapisan COVER (Kompon Bagian Luar - Excel LPG RED Kolom L-P) */
const coverDim = computed(() => {
  const idFromSpek = getLayerParamValue(['cover', 'outer', 'luar'], ['id']);
  const thickFromSpek = getLayerParamValue(['cover', 'outer', 'luar'], ['thick']);
  const odFromSpek = getLayerParamValue(['cover', 'outer', 'luar'], ['od']);

  const coverLayer = layerDimensions.value.find((ld) => {
    const l = (ld.layer_display || '').toLowerCase();
    return l.includes('cover') || l.includes('outer') || l.includes('luar');
  });
  const idFromLd = coverLayer && Number(coverLayer.id_val) > 0 ? Number(coverLayer.id_val) : 0;
  const thickFromLd = coverLayer && Number(coverLayer.thick_val) > 0 ? Number(coverLayer.thick_val) : 0;
  const odFromLd = coverLayer && Number(coverLayer.od_val) > 0 ? Number(coverLayer.od_val) : 0;

  // ID Cover secara fisik menempel di atas OD Tube
  let id = idFromSpek || idFromLd || (tubeDim.value.od > 0 ? tubeDim.value.od : 0);
  let thick = thickFromSpek || thickFromLd || 0;
  let od = odFromSpek || odFromLd || (spekODRaw.value > id ? spekODRaw.value : 0);

  if (id > 0 && thick > 0 && !od) {
    od = Number((id + 2 * thick).toFixed(2));
  } else if (id > 0 && od > id && !thick) {
    thick = Number(((od - id) / 2).toFixed(2));
  } else if (!thick && spekThickRaw.value > 0 && od > id) {
    thick = Number(((od - id) / 2).toFixed(2));
  }

  const sg = sgCompound.value || 0;
  const sLength = getLayerParamValue(['spec'], ['length', 'panjang']) || 1;
  const isValidDim = id > 0 && od > id;
  const area = isValidDim ? (Math.PI * (od * od - id * id)) / 4 : 0;
  const weight = sg > 0 && area > 0 ? Number((area * sg * 1e-3 * sLength).toFixed(4)) : 0;
  const cost = round2(weight * hargaPerKgCompound.value);
  const odCalculated = id > 0 && thick > 0 ? Number((id + 2 * thick).toFixed(2)) : 0;
  return { id, thick, od, weight, cost, isValidDim, odCalculated };
});

/** Pemicu kalkulasi manual / refresh kalkulasi (Format Excel LPG RED) */
const triggerRecalculate = () => {
  if (layerGroups.value.length === 0) {
    initLayerGroups();
  }

  // Jalankan rantai sinkronisasi dimensi antar layer (Excel)
  autoChainHoseParams();

  // Cari grup berdasarkan key layer
  const specGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'SPEC');
  const tubeGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'TUBE');
  const coverGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'COVER');
  const yarnGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'YARN');
  const hoseGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'HOSE');
  const bbGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'BAHAN_BAKU');

  // 1. Ambil nilai input dari SPEC
  const sId = parseCommaNumber(specGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('inner') || (p.nama_parameter_display || '').toLowerCase().includes('id'))?.value);
  const sOd = parseCommaNumber(specGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('outer') || (p.nama_parameter_display || '').toLowerCase().includes('od'))?.value);

  // 2. Tube Dimensi
  const tIdParam = tubeGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('inner') || (p.nama_parameter_display || '').toLowerCase().includes('id'));
  const tThickParam = tubeGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('thick') || (p.nama_parameter_display || '').toLowerCase().includes('tebal'));
  const tOdParam = tubeGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('outer') || (p.nama_parameter_display || '').toLowerCase().includes('od'));

  let tId = parseCommaNumber(tIdParam?.value) || sId;
  let tThick = parseCommaNumber(tThickParam?.value);
  let tOd = parseCommaNumber(tOdParam?.value) || (tId > 0 && tThick > 0 ? tId + 2 * tThick : 0);
  if (tId > 0 && tThick > 0 && tOd <= tId) tOd = Number((tId + 2 * tThick).toFixed(2));
  if (tIdParam && tId > 0) tIdParam.value = formatCommaNumber(tId, 2);
  if (tOdParam && tOd > 0) tOdParam.value = formatCommaNumber(tOd, 2);
  if (tThickParam && tThick > 0) tThickParam.value = formatCommaNumber(tThick, 2);

  // 3. Cover Dimensi
  const cIdParam = coverGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('inner') || (p.nama_parameter_display || '').toLowerCase().includes('id'));
  const cThickParam = coverGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('thick') || (p.nama_parameter_display || '').toLowerCase().includes('tebal'));
  const cOdParam = coverGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('outer') || (p.nama_parameter_display || '').toLowerCase().includes('od'));

  let cId = parseCommaNumber(cIdParam?.value) || tOd;
  let cOd = parseCommaNumber(cOdParam?.value) || sOd;
  let cThick = parseCommaNumber(cThickParam?.value) || (cOd > cId && cId > 0 ? Number(((cOd - cId) / 2).toFixed(2)) : 0);
  if (cId > 0 && cThick > 0 && cOd <= cId) cOd = Number((cId + 2 * cThick).toFixed(2));
  if (cIdParam && cId > 0) cIdParam.value = formatCommaNumber(cId, 2);
  if (cOdParam && cOd > 0) cOdParam.value = formatCommaNumber(cOd, 2);
  if (cThickParam && cThick > 0) cThickParam.value = formatCommaNumber(cThick, 2);

  // 4. Yarn Dimensi
  const yIdParam = yarnGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('inner') || (p.nama_parameter_display || '').toLowerCase().includes('id'));
  const yPParam = yarnGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('thick') || (p.nama_parameter_display || '').toLowerCase().includes('tebal') || (p.nama_parameter_display || '').toLowerCase() === 'p');
  const yOdParam = yarnGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('outer') || (p.nama_parameter_display || '').toLowerCase().includes('od'));

  let yId = parseCommaNumber(yIdParam?.value) || tOd;
  let yP = parseCommaNumber(yPParam?.value);
  let yOd = parseCommaNumber(yOdParam?.value) || (yId > 0 && yP > 0 ? Number((yId + 4 * yP).toFixed(2)) : 0);
  if (yIdParam && yId > 0) yIdParam.value = formatCommaNumber(yId, 2);
  if (yOdParam && yOd > 0) yOdParam.value = formatCommaNumber(yOd, 2);
  if (yPParam && yP > 0) yPParam.value = formatCommaNumber(yP, 2);

  // 5. SG & Harga Compound
  const sgTube = formulaSgTube.value > 0 ? formulaSgTube.value : (sgCompound.value > 0 ? sgCompound.value : 1.30);
  const costKgTube = formulaHargaTube.value > 0 ? formulaHargaTube.value : (hargaPerKgCompound.value > 0 ? hargaPerKgCompound.value : 23238);
  const sgCover = formulaSgCover.value > 0 ? formulaSgCover.value : (sgCompound.value > 0 ? sgCompound.value : 1.08);
  const costKgCover = formulaHargaCover.value > 0 ? formulaHargaCover.value : (hargaPerKgCompound.value > 0 ? hargaPerKgCompound.value : 34814);

  // 6. Tube & Cover Kalkulasi (dengan pengali Length di Spec)
  const sLength = parseCommaNumber(specGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('length') || (p.nama_parameter_display || '').toLowerCase().includes('panjang'))?.value) || 1;

  const tubeArea = (tOd > tId && tId > 0) ? (Math.PI * (tOd * tOd - tId * tId)) / 4 : 0;
  const tubeWeight = tubeArea > 0 ? Number((tubeArea * sgTube * 1e-3 * sLength).toFixed(4)) : 0;
  const tubeCost = tubeWeight > 0 ? round2(tubeWeight * costKgTube) : 0;
  const tWeightParam = tubeGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('weight') || (p.nama_parameter_display || '').toLowerCase().includes('berat'));
  const tCostParam = tubeGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('price') || (p.nama_parameter_display || '').toLowerCase().includes('harga'));
  if (tWeightParam) tWeightParam.value = tubeWeight > 0 ? formatCommaNumber(tubeWeight, 4) : '';
  if (tCostParam) tCostParam.value = tubeCost > 0 ? formatCommaNumber(tubeCost, 2) : '';

  // 7. Cover Kalkulasi
  const coverArea = (cOd > cId && cId > 0) ? (Math.PI * (cOd * cOd - cId * cId)) / 4 : 0;
  const coverWeight = coverArea > 0 ? Number((coverArea * sgCover * 1e-3 * sLength).toFixed(4)) : 0;
  const coverCost = coverWeight > 0 ? round2(coverWeight * costKgCover) : 0;
  const cWeightParam = coverGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('weight') || (p.nama_parameter_display || '').toLowerCase().includes('berat'));
  const cCostParam = coverGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('price') || (p.nama_parameter_display || '').toLowerCase().includes('harga'));
  if (cWeightParam) cWeightParam.value = coverWeight > 0 ? formatCommaNumber(coverWeight, 4) : '';
  if (cCostParam) cCostParam.value = coverCost > 0 ? formatCommaNumber(coverCost, 2) : '';

  // 8. Yarn Kalkulasi
  const yWeightParam = yarnGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('weight') || (p.nama_parameter_display || '').toLowerCase().includes('berat'));
  const yCostParam = yarnGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('price') || (p.nama_parameter_display || '').toLowerCase().includes('harga'));
  let yarnWeight = parseCommaNumber(yWeightParam?.value);
  if ((yP > 0 || yId > 0) && (tubeWeight > 0 || coverWeight > 0) && (!yarnWeight || yarnWeight === 0)) yarnWeight = 0.001;
  const yarnCost = yarnWeight > 0 ? round2(50000 * yarnWeight * sLength) : 0;
  if (yWeightParam && yarnWeight > 0) yWeightParam.value = formatCommaNumber(yarnWeight, 4);
  if (yCostParam) yCostParam.value = yarnCost > 0 ? formatCommaNumber(yarnCost, 2) : '';

  // 9. Hose Total Berat
  const hoseWeight = Number((tubeWeight + coverWeight + yarnWeight).toFixed(4));
  const hWeightParam = hoseGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('weight') || (p.nama_parameter_display || '').toLowerCase().includes('berat'));
  if (hWeightParam) hWeightParam.value = hoseWeight > 0 ? formatCommaNumber(hoseWeight, 4) : '';

  // 10. Bahan Baku Material
  const matCostExclude = round2(tubeCost + coverCost + yarnCost);
  const matCostInclude = round2(matCostExclude * 1.11);
  const bbExcludeParam = bbGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('exclude'));
  const bbIncludeParam = bbGrp?.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('include'));
  if (bbExcludeParam) bbExcludeParam.value = matCostExclude > 0 ? formatCommaNumber(matCostExclude, 2) : '';
  if (bbIncludeParam) bbIncludeParam.value = matCostInclude > 0 ? formatCommaNumber(matCostInclude, 2) : '';

  syncGroupsToDetailSpek();
  syncSpekWeightToQty();

  // Buka panel hasil kalkulasi jika ada nilai terhitung
  if (tubeWeight > 0 || coverWeight > 0 || hoseWeight > 0) {
    showCalculationPanel.value = true;
    toast.success("Kalkulasi berhasil dihitung! Nilai Berat/M dan Harga/M telah otomatis dimunculkan.");

    nextTick(() => {
      const el = document.getElementById('panel-hasil-kalkulasi');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  } else {
    toast.info("Silakan isi dimensi ID, OD, atau Tebal terlebih dahulu untuk menjalankan kalkulasi.");
  }
};

/** Perbaiki dimensi selang otomatis jika ada OD <= ID atau OD belum sinkron dengan ID & Tebal */
const autoFixHoseDimensions = () => {
  let changed = false;

  const tubeGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'TUBE');
  const coverGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'COVER');

  if (tubeGrp) {
    const idParam = tubeGrp.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('inner') || (p.nama_parameter_display || '').toLowerCase().includes('id'));
    const thickParam = tubeGrp.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('thick') || (p.nama_parameter_display || '').toLowerCase().includes('tebal'));
    const odParam = tubeGrp.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('outer') || (p.nama_parameter_display || '').toLowerCase().includes('od'));

    const id = parseCommaNumber(idParam?.value);
    const thick = parseCommaNumber(thickParam?.value);
    const od = parseCommaNumber(odParam?.value);
    if (id > 0 && thick > 0 && (od <= id || od === 0)) {
      if (odParam) {
        odParam.value = formatCommaNumber(id + 2 * thick, 2);
        changed = true;
      }
    }
  }

  if (coverGrp) {
    const idParam = coverGrp.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('inner') || (p.nama_parameter_display || '').toLowerCase().includes('id'));
    const thickParam = coverGrp.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('thick') || (p.nama_parameter_display || '').toLowerCase().includes('tebal'));
    const odParam = coverGrp.params.find(p => (p.nama_parameter_display || '').toLowerCase().includes('outer') || (p.nama_parameter_display || '').toLowerCase().includes('od'));

    const id = parseCommaNumber(idParam?.value);
    const thick = parseCommaNumber(thickParam?.value);
    const od = parseCommaNumber(odParam?.value);
    if (id > 0 && thick > 0 && (od <= id || od === 0)) {
      if (odParam) {
        odParam.value = formatCommaNumber(id + 2 * thick, 2);
        changed = true;
      }
    }
  }

  syncGroupsToDetailSpek();

  if (changed) {
    toast.success("Dimensi selang berhasil disesuaikan otomatis (OD = ID + 2×Thick)");
  } else {
    toast.info("Kalkulasi selang sudah mutakhir");
  }
};

/** Handler ketika nilai input angka pada Detail Spek berubah */
const onValueChange = (row: DetailSpek, val: string | number) => {
  row.value = val;
  syncDetailSpekToLayerDims();
  syncBraidParamsFromDetailSpek();
};

/** TOTAL BERAT SELANG / METER (Excel Kolom V32 = Tube + Cover + PET Yarn) */
/** UOM Header yang dipilih pada item produk */
const headerUomName = computed(() => {
  return uomMap.value[values.unit_id] || values.unit?.value1 || '';
});

const headerUomShort = computed(() => {
  const u = (headerUomName.value || '').trim();
  return u || '';
});

const totalHoseWeightPerMeter = computed(() => {
  const specGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'SPEC');
  const sLength = parseCommaNumber(
    specGrp?.params.find(p => (p.nama_parameter_display || spekMap.value[p.nama_parameter] || '').toLowerCase().includes('length') || (p.nama_parameter_display || spekMap.value[p.nama_parameter] || '').toLowerCase().includes('panjang'))?.value
  ) || 1;
  const hoseGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'HOSE');
  const hWeightVal = parseCommaNumber(
    hoseGrp?.params.find(p => (p.nama_parameter_display || spekMap.value[p.nama_parameter] || '').toLowerCase().includes('weight') || (p.nama_parameter_display || spekMap.value[p.nama_parameter] || '').toLowerCase().includes('berat'))?.value
  );
  if (hWeightVal > 0 && sLength > 0) {
    return Number((hWeightVal / sLength).toFixed(4));
  }
  const w = tubeDim.value.weight + coverDim.value.weight + yarnDim.value.weight;
  return Number(w.toFixed(4));
});

/** Total berat selang terhitung dari spesifikasi (kg) */
const spekTotalHoseWeight = computed(() => {
  const hoseGrp = layerGroups.value.find(g => getLayerKeyFromDisplay(g.layer_display) === 'HOSE');
  const hWeightVal = parseCommaNumber(
    hoseGrp?.params.find(p => (p.nama_parameter_display || spekMap.value[p.nama_parameter] || '').toLowerCase().includes('weight') || (p.nama_parameter_display || spekMap.value[p.nama_parameter] || '').toLowerCase().includes('berat'))?.value
  );
  if (hWeightVal > 0) {
    return Number(hWeightVal.toFixed(4));
  }

  // Hanya jika dimensi Tube atau Cover sudah terisi nyata
  if ((tubeDim.value.weight > 0 || coverDim.value.weight > 0) && totalHoseWeightPerMeter.value > 0) {
    return Number(totalHoseWeightPerMeter.value.toFixed(4));
  }

  return 0;
});

/** Sinkronkan berat spesifikasi ke field Qty header jika tipe SPESIFIK */
const syncSpekWeightToQty = () => {
  if (!isTypeSpesifik.value || isPrecostLocked.value) return;
  const weight = spekTotalHoseWeight.value;
  values.qty = weight > 0 ? weight : 0;
};

// Auto-sync Qty header dari total berat spesifikasi saat tipe SPESIFIK
watch(spekTotalHoseWeight, (newWeight) => {
  if (isTypeSpesifik.value && !isPrecostLocked.value) {
    values.qty = newWeight > 0 ? newWeight : 0;
  }
});

/** TOTAL HARGA SELANG EXCLUDE PPN / METER (Excel Kolom W32 = Tube + Cover + PET Yarn) */
const totalHoseCostExcludePerMeter = computed(() => {
  return round2(tubeDim.value.cost + coverDim.value.cost + yarnDim.value.cost);
});

/** TOTAL HARGA SELANG INCLUDE PPN 11% / METER (Excel Kolom X32 = Harga Exclude × 1.11) */
const totalHoseCostIncludePerMeter = computed(() => {
  return round2(totalHoseCostExcludePerMeter.value * 1.11);
});

/** Alias kompatibilitas */
const beratPerMeter = totalHoseWeightPerMeter;
const hargaPerMeter = totalHoseCostExcludePerMeter;

/** Apakah ada data compound (material) yang cukup untuk kalkulasi */
const hasCompoundData = computed(() => batchWeightKg.value > 0);

/** Braid Coverage Factor (% tutupan kawat pada permukaan selang) */
const braidCoveragePercent = computed(() => {
  const dm = meanHelixDiameter.value;
  const c = carrierCount.value;
  const d = wireDiameter.value;
  const rad = (braidAngle.value * Math.PI) / 180;
  const cosVal = Math.cos(rad);
  if (!dm || !cosVal) return 0;

  // F = (C * d) / (2 * pi * Dm * cos(theta))
  const F = (c * d) / (2 * Math.PI * dm * cosVal);
  if (F >= 1) return 99.5;
  // K = (2F - F^2) * 100%
  const K = (2 * F - F * F) * 100;
  return Number(Math.min(99.5, Math.max(15, K)).toFixed(1));
});

/** Panjang 1 gelombang visual (wavelength) di canvas SVG (proporsional thd sudut) */
const helixWavelengthPx = computed(() => {
  const rad = (braidAngle.value * Math.PI) / 180;
  const tanVal = Math.tan(rad);
  // Sudut 30° -> wavelength panjang (~200px), Sudut 60° -> wavelength rapat (~75px)
  return Number((120 / tanVal).toFixed(1));
});

/** Posisi awal dan akhir penunjuk garis dimensi Pitch di canvas */
const pitchDimStart = computed(() => 160);
const pitchDimEnd = computed(() => pitchDimStart.value + helixWavelengthPx.value);

/** SVG Sine Wave Path untuk Helix/Spiral View (bereaksi realtime terhadap sudut!) */
const helixWavePath = computed(() => {
  const startX = 60;
  const endX = 580;
  const cy = 70;
  const amp = 36;
  const wPx = helixWavelengthPx.value;
  const points: string[] = [];
  const step = 2;
  for (let x = startX; x <= endX; x += step) {
    const angle = ((x - startX) / wPx) * 2 * Math.PI;
    const y = cy + amp * Math.sin(angle);
    if (x === startX) {
      points.push(`M ${x} ${y.toFixed(2)}`);
    } else {
      points.push(`L ${x} ${y.toFixed(2)}`);
    }
  }
  return points.join(' ');
});

/** SVG Braid Lines untuk Diamond Lattice View (bereaksi dinamis terhadap sudut & jumlah klos!) */
const braidPatternLines = computed(() => {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const angleDeg = braidAngle.value;
  const rad = (angleDeg * Math.PI) / 180;
  const h = 100;
  // dx menentukan kemiringan garis (kemiringan sudut terhadap sumbu horizontal X)
  const dx = h / Math.tan(rad);

  // Spacing antar kawat ditentukan oleh jumlah klos (carrierCount):
  // 16 klos -> spacing 35px (longgar)
  // 24 klos -> spacing 24px (standar)
  // 32 klos -> spacing 18px (rapat)
  // 48 klos -> spacing 12px (sangat padat)
  const baseSpacing = (480 / carrierCount.value) * 1.25;
  const spacing = Math.max(8, Math.min(50, baseSpacing));

  // Anyaman miring kanan (+)
  for (let x = -300; x <= 900; x += spacing) {
    lines.push({ x1: x, y1: 20, x2: x + dx, y2: 120 });
  }
  // Anyaman miring kiri (-)
  for (let x = -300; x <= 900; x += spacing) {
    lines.push({ x1: x, y1: 20, x2: x - dx, y2: 120 });
  }
  return lines;
});

/** Reset nilai simulasi kawat/anyaman ke standar pabrik (24 klos & sudut netral 54.7°) */
const resetBraidSimulation = () => {
  carrierCount.value = 24;
  braidAngle.value = 54.7;
  toast.info('Simulasi dikembalikan ke konfigurasi standar (24 klos, sudut netral 54.7°)');
};

/** Cek apakah ada baris parameter spek yang belum dipilih parameternya */
const hasEmptySpekRows = computed(() => {
  return detailSpek.value.some((s) => !s.nama_parameter);
});

/** Bersihkan baris-baris parameter spek yang kosong/tidak valid */
const cleanEmptySpekRows = () => {
  const before = detailSpek.value.length;
  detailSpek.value = detailSpek.value.filter((s) => !!s.nama_parameter);
  const diff = before - detailSpek.value.length;
  if (diff > 0) {
    toast.success(`${diff} baris parameter kosong berhasil dibersihkan`);
  }
};

/** Baca parameter anyaman dari detailSpek jika memang dimasukkan di tabel spek atas */
const syncBraidParamsFromDetailSpek = () => {
  detailSpek.value.forEach((s) => {
    const pName = (s.nama_parameter_display || spekMap.value[s.nama_parameter] || '').toLowerCase().trim();
    if (pName.includes('klos') || pName.includes('carrier') || pName.includes('bobbin')) {
      const val = Number(s.value);
      if (val > 0) carrierCount.value = val;
    } else if (pName.includes('sudut') || pName.includes('braid angle') || pName.includes('lilitan')) {
      const val = Number(s.value);
      if (val >= 10 && val <= 85) braidAngle.value = val;
    }
  });
};

/** Apakah ada data dimensi yang cukup untuk kalkulasi selang */
const hasHoseData = computed(() => {
  const idVal = tubeDim.value.id || spekIDEffective.value;
  const odVal = coverDim.value.od || tubeDim.value.od || spekODEffective.value;
  return idVal > 0 && odVal > 0;
});

/** Watcher agar perubahan detailSpek langsung tersinkronkan ke layerDimensions dan simulator kawat */
watch(
  detailSpek,
  () => {
    syncDetailSpekToLayerDims();
    syncBraidParamsFromDetailSpek();
  },
  { deep: true }
);

const flagToTipeItem = {
  "FINISHED GOOD": "FG",
  "WIP": "WIP"
};

const tipeItemMap = ref<Record<string, string>>({});

const selectedTipeId = computed(() => {
  if (!values.flag) return '';
  const key1 = flagToTipeItem[values.flag as keyof typeof flagToTipeItem];
  return tipeItemMap.value[key1] || '';
});

const itemApiParams = computed(() => {
  const p: Record<string, any> = {
    searchfield: 'kode_item,nama_item',
    include: 'm_general',
    filter_column_is_active: 'true',
  };
  if (selectedTipeId.value) {
    p.filter_column_tipe_id = selectedTipeId.value;
  }
  return p;
});

watch(
  () => values.flag,
  (newVal, oldVal) => {
    if (oldVal && newVal !== oldVal) {
      values.m_item_id = '';
      values.m_item = null;
    }
    ensureFinalRoute();
  }
);

watch(
  () => [values.m_item_id, values.unit_id, values.qty],
  () => {
    ensureFinalRoute();
  }
);

const totalMenit = computed(() => {
  return bomDetails.value.reduce((sum, row) => sum + (Number(row.time) || 0), 0);
});

const totalOverhead = computed(() => {
  return (Number(values.overhead_cost) || 0) * totalMenit.value;
});

const totalLabor = computed(() => {
  return (Number(values.labor_cost) || 0) * totalMenit.value;
});

const selectedMaterialIdsByRouting = computed(() => {
  const result: Record<number, string[]> = {};
  bomDetails.value.forEach((row, idx) => {
    result[idx] = (row.materials || [])
      .map((m) => m.m_item_id)
      .filter((id) => !!id);
  });
  return result;
});

// ============================================================================
// RESET FORM
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    m_unit_bisnis_id: "",
    m_unit_bisnis: null,
    no: "",
    date: new Date().toISOString().split('T')[0],
    flag: "",
    m_item_id: "",
    t_precost_id: "",
    t_precost: null,
    m_item: null,
    qty: 1,
    unit_id: "",
    unit: null,
    labor_cost_type: "Unit",
    labor_cost: 0,
    overhead_type: "Unit",
    overhead_cost: 0,
    notes: "",
    status: true,
    version: "V1",
    batch_weight: 0,
    base_resin: 0,
    total_volume: 0,
    sg_compound: 0,
    total_biaya_material: 0,
    harga_per_kg_compound: 0,
  });
  bomDetails.value = [];
  coProducts.value = [];
  detailSpek.value = [];
  ensureFinalRoute();
  Object.keys(errors).forEach((key) => {
    if (key === "routings") {
      errors.routings = [];
    } else {
      errors[key as Exclude<keyof typeof errors, "routings">] = "";
    }
  });
};

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================
onBeforeMount(async () => {
  onReset();

  // Auto-fill unit bisnis dari SelectRespo untuk non-super admin
  if (!isSuperAdmin.value) {
    try {
      const selectRespo = localStorage.getItem("SelectRespo");
      if (selectRespo) {
        const parsed = JSON.parse(selectRespo);
        if (parsed.companyId) {
          values.m_unit_bisnis_id = parsed.companyId;
        }
      }
    } catch (e) {
      // ignore parse error
    }
  }

  // Fetch tipe item mapping from m_general
  try {
    const resTipe = await fetch(
      `${API_BASE_URL}/dynamic/m_general?filter_column_group=TIPE_ITEM&no_pagination=true`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
      }
    );
    const result = await resTipe.json();
    if (result.status === 'success' && Array.isArray(result.data)) {
      result.data.forEach((item: any) => {
        tipeItemMap.value[item.key1] = item.id;
      });
    }
  } catch (error) {
    console.error('Failed to fetch tipe item mapping', error);
  }

  // Fetch UOM mapping from m_general
  try {
    const resUom = await fetch(
      `${API_BASE_URL}/dynamic/m_general?filter_column_group=UOM&no_pagination=true`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
      }
    );
    const uomResult = await resUom.json();
    if (uomResult.status === 'success' && Array.isArray(uomResult.data)) {
      rawUoms.value = uomResult.data;
      uomResult.data.forEach((item: any) => {
        uomMap.value[item.id] = item.value1;
      });
    }
  } catch (error) {
    console.error('Failed to fetch UOM mapping', error);
  }

  // Fetch spek parameter mapping from m_general (group: m_spec)
  try {
    const resSpek = await fetch(
      `${API_BASE_URL}/dynamic/m_general?filter_column_group=m_spec&no_pagination=true`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
      }
    );
    const spekResult = await resSpek.json();
    if (spekResult.status === 'success' && Array.isArray(spekResult.data)) {
      rawSpecs.value = spekResult.data;
      spekResult.data.forEach((item: any) => {
        spekMap.value[item.id] = item.value1;
      });
    }
  } catch (error) {
    console.error('Failed to fetch spek mapping', error);
  }

  // Fetch layer mapping from m_general (group: m_layer)
  try {
    const resLayer = await fetch(
      `${API_BASE_URL}/dynamic/m_general?filter_column_group=m_layer&no_pagination=true`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
      }
    );
    const layerResult = await resLayer.json();
    if (layerResult.status === 'success' && Array.isArray(layerResult.data)) {
      rawLayers.value = layerResult.data;
      layerResult.data.forEach((item: any) => {
        layerMap.value[item.id] = item.value1;
      });
    }
  } catch (error) {
    console.error('Failed to fetch layer mapping', error);
  }

  if (!(isEditMode.value || isViewMode.value || isCopyMode.value)) {
    initLayerGroups();
    syncDetailSpekToLayerDims();
    return;
  }

  loading.value = true;
  try {
    const sourceId = isCopyMode.value ? String(route.query.source) : menuId.value;
    const res = await getBomById(sourceId);
    if (res && res.data) {
      const rawData = res.data as any;
      auditMeta.value = {
        created_by: rawData.bom_ctr?.name || rawData.bom_ctr?.username || rawData.created_by,
        createdAt: rawData.createdAt,
        updated_by: rawData.bom_updt?.name || rawData.bom_updt?.username || rawData.update_by || rawData.updated_by,
        updatedAt: rawData.updatedAt,
      }
    }
    

    if (res.status !== "success") throw new Error("Gagal memuat data");

    const initialValues = res.data;

    // TODO: Map initialValues dari response ke values
    if (initialValues.m_bom_d_routings) {
      const rawMaterials = initialValues.m_bom_sd_materials || initialValues.m_bom_sd_material;
      const topMaterials = (Array.isArray(rawMaterials) ? rawMaterials : rawMaterials ? [rawMaterials] : []) as any[];
      bomDetails.value = [...initialValues.m_bom_d_routings]
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
        .map((row) => ({
          id: row.id || "",
          sequence: row.sequence || 0,
          m_routing_id: row.m_routing_id || "",
          to_routing_id: row.to_routing_id || "",
          qty: row.qty || 0,
          is_final: row.is_final || false,
          m_mesin_id: row.m_mesin_id || "",
          unit_id: row.unit_id || "",
          output_type: row.output_type || "",
          output_type_label: row.bom_r_output?.value1 || "",
          time: row.time || 0,
          notes: row.notes || "-",
          m_item_id: row.m_item_id || "",
          m_mesin: row.m_mesin || [],
          m_routing: row.bom_routing || [],
          to_routing: row.bom_to_routing || [],
          m_item: row.m_item || [],
          unit: row.bom_r_unit || [],
          materials: topMaterials
            .filter((mat) => mat.m_bom_d_routing_id === row.id)
            .map((mat) => ({
              id: mat.id || null,
              item_type_id: mat.item_type_id || "",
              item_type: mat.item_type || mat.bom_mat_type || null,
              m_item_id: mat.m_item_id || "",
              m_item: mat.m_item || null,
              is_main: mat.is_main || false,
              qty: mat.qty || 1,
              unit_id: mat.unit_id || "",
              unit: mat.bom_mat_unit || mat.m_general || null,
              weight: mat.weight
                ? Number(mat.weight)
                : round2((Number(mat.qty) || 0) * (Number(mat.m_item?.berat_bersih) || 0)),
              phr: Number(mat.phr) || 0,
              berat_jenis: mat.berat_jenis != null && mat.berat_jenis !== '' 
                ? Number(mat.berat_jenis) 
                : (mat.m_item?.berat_jenis != null ? Number(mat.m_item.berat_jenis) : 0),
              harga_satuan: Number(mat.harga_satuan) || 0,
              bom_mat_type: mat.bom_mat_type || null,
              bom_mat_unit: mat.bom_mat_unit || null,
              notes: mat.notes || "",
            })),
        }))
    }

    if (initialValues.m_bom_d_coproducts) {
      coProducts.value = (initialValues.m_bom_d_coproducts as any[])
        .sort((a: any, b: any) => (a.sequence ?? 0) - (b.sequence ?? 0))
        .map((cp: any) => ({
          sequence: cp.sequence || 0,
          item_type_id: cp.item_type_id || "",
          item_type: cp.bom_cp_type || null,
          m_item_id: cp.m_item_id || "",
          m_item: cp.m_item || null,
        }));
    }
    
    if (initialValues.m_bom_d_speks) {
      detailSpek.value = (initialValues.m_bom_d_speks as any[])
        .sort((a: any, b: any) => (a.sequence ?? 0) - (b.sequence ?? 0))
        .map((s: any) => ({
          id: s.id || "",
          layer_id: s.layer_id || "",
          layer_display: s.m_layer?.value1 || layerMap.value[s.layer_id] || "",
          nama_parameter: s.param_id || "",
          nama_parameter_display: spekMap.value[s.param_id] || "",
          value: s.value !== undefined && s.value !== null && s.value !== '' ? String(s.value).replace('.', ',') : "",
          satuan: s.unit_id || "",
          satuan_display: uomMap.value[s.unit_id] || "",
          notes: s.notes || "",
        }));
    }
    initLayerGroups();
    syncDetailSpekToLayerDims();

    // Restore detail formula & konfigurasi simulator kawat/anyaman dari tabel m_bom_d_formula
    const formulaRec = (initialValues as any).m_bom_d_formula ||
      ((initialValues as any).m_bom_d_formulas && (initialValues as any).m_bom_d_formulas[0]) ||
      null;
    if (formulaRec) {
      formulaDetailId.value = formulaRec.id || "";
      if (formulaRec.yarn_carrier_count && Number(formulaRec.yarn_carrier_count) > 0) {
        carrierCount.value = Number(formulaRec.yarn_carrier_count);
      }
      if (formulaRec.yarn_braid_angle && Number(formulaRec.yarn_braid_angle) > 0) {
        braidAngle.value = Number(formulaRec.yarn_braid_angle);
      }
    } else {
      // Fallback untuk backward compatibility
      if ((initialValues as any).yarn_carrier_count && Number((initialValues as any).yarn_carrier_count) > 0) {
        carrierCount.value = Number((initialValues as any).yarn_carrier_count);
      }
      if ((initialValues as any).yarn_braid_angle && Number((initialValues as any).yarn_braid_angle) > 0) {
        braidAngle.value = Number((initialValues as any).yarn_braid_angle);
      }
    }

    if (isCopyMode.value) {
      delete (initialValues as any).id;
      delete (initialValues as any).no;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
      values.no = "";
      formulaDetailId.value = "";

      bomDetails.value.forEach((r) => {
        delete (r as any).id;
        (r.materials || []).forEach((m) => {
          delete (m as any).id;
        });
      });

      detailSpek.value.forEach((s) => {
        delete (s as any).id;
      });
    }

    // Normalisasi format tanggal dari ISO timestamp ke YYYY-MM-DD
    if (initialValues.date) {
      initialValues.date = String(initialValues.date).replace('T', ' ').split(' ')[0];
    }

    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore dynamic assign
        values[key] = initialValues[key];
      }
    }
    if (isCopyMode.value) {
      values.no = "";
    }
    values.unit = initialValues?.m_general;
    values.t_precost = initialValues?.t_precost;
    values.date = (initialValues.date?.split('T')[0]) || "";

    // Pastikan type terinisialisasi dengan benar
    if ((initialValues as any).type) {
      values.type = (initialValues as any).type.toUpperCase();
      values.is_specific = (values.type === 'SPESIFIK');
    } else if ((initialValues as any).is_specific) {
      values.type = 'SPESIFIK';
    } else if ((initialValues as any).flag === 'WIP') {
      values.type = 'CHEMICAL';
    } else {
      values.type = 'GENERAL';
    }

    if (initialValues.harga_per_kg_compound && Number(initialValues.harga_per_kg_compound) > 0) {
      formulaHargaTube.value = Number(initialValues.harga_per_kg_compound);
    }

    // Muat detail material precosting agar tombol Add Detail tetap berfungsi
    if (values.t_precost_id) {
      try {
        const precostRes = await getPrecostById(values.t_precost_id);
        if (precostRes.status === "success" && precostRes.data) {
          precostDetails.value = ((precostRes.data as any).t_precost_ds || []) as any[];
          values.t_precost = precostRes.data;
        } else {
          throw new Error("Precost not found");
        }
      } catch {
        values.t_precost_id = "";
        values.t_precost = null;
        precostDetails.value = [];
        toast.warning("Pre-Costing yang dirujuk sudah tidak ada. Referensi telah dihapus.");
      }
    }

    ensureFinalRoute();
    console.log("uom routing", bomDetails.value)
  } catch (error) {
    toast.error("Gagal memuat data BOM", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    loading.value = false;
  }

  // Cek apakah BOM sudah dipakai di Work Order (hanya saat edit, bukan copy)
  if (isEditMode.value) {
    bomUsedLoading.value = true;
    try {
      bomUsed.value = await isBomUsed(menuId.value);
      console.log("bomUsed", bomUsed.value)
    } catch (error) {
      console.error("Failed to check BOM usage", error);
      bomUsed.value = false;
    } finally {
      bomUsedLoading.value = false;
    }
  }
});

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  Object.keys(errors).forEach((key) => {
    if (key === 'routings') {
      errors.routings = [];
    } else {
      (errors as any)[key] = "";
    }
  });

  // BOM sudah dipakai (approve/post): hanya boleh update status aktif/tidak aktif
  if (isUsedLocked.value) {
    loading.value = true;
    try {
      await updateBom(menuId.value, { status: values.status });
      toast.success("Status BOM berhasil diperbarui", {
        description: "Detail BOM tidak dapat diubah karena sudah dipakai",
      });
      router.replace("/production/master/m_bom?reload=" + Date.now());
    } catch (error) {
      toast.error("Gagal memperbarui status BOM", {
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
      });
    } finally {
      loading.value = false;
    }
    return;
  }

  let invalid = false;

  if (!values.m_unit_bisnis_id) {
    errors.m_unit_bisnis_id = "Company wajib dipilih";
    invalid = true;
  }

  if (!values.flag) {
    errors.flag = "Jenis BOM wajib dipilih";
    invalid = true;
  }

  if (!values.m_item_id) {
    errors.m_item_id = "Item wajib dipilih";
    invalid = true;
  }

  if (!values.qty || values.qty <= 0) {
    errors.qty = isTypeSpesifik.value
      ? "Kalkulasi spesifikasi belum menghasilkan berat selang (Qty)"
      : "Qty harus lebih dari 0";
    invalid = true;
  }

  if (!values.unit_id) {
    errors.unit_id = "Satuan wajib dipilih";
    invalid = true;
  }

  if (invalid) {
    toast.error("Validasi gagal", {
      description: "Mohon lengkapi semua field yang wajib diisi",
    });
    return;
  }

  // ========================================================================
  // ROUTING VALIDATIONS
  // ========================================================================
  const routingErrors: string[] = [];
  const expectedTipeId = selectedTipeId.value;

  for (let idx = 0; idx < bomDetails.value.length; idx++) {
    const row = bomDetails.value[idx];
    if (!row) continue;
    const rowNum = idx + 1;

    // Rule 1: route_id tidak boleh sama dengan to_route_id (kecuali final route)
    if (!row.is_final && row.m_routing_id && row.to_routing_id && row.m_routing_id === row.to_routing_id) {
      routingErrors.push(`Routing #${rowNum}: Route tidak boleh sama dengan To Route`);
    }

    // Rule 1b: m_routing_id wajib diisi
    if (!row.m_routing_id) {
      routingErrors.push(`Routing #${rowNum}: Route wajib dipilih`);
    }

    // Rule 2 & 3: Final route output_type harus sesuai flag BOM
    if (row.is_final && expectedTipeId && row.output_type && row.output_type !== expectedTipeId) {
      routingErrors.push(`Routing #${rowNum}: Output Type harus tipe ${values.flag === 'FINISHED GOOD' ? 'FG' : 'WIP'}`);
    }

    // Rule 5: Tidak boleh ada material duplikat dalam 1 routing
    const materialIds = (row.materials || [])
      .map((m) => m.m_item_id)
      .filter((id) => !!id);
    const uniqueMaterialIds = [...new Set(materialIds)];
    if (materialIds.length !== uniqueMaterialIds.length) {
      const duplicateNames = [
        ...new Set(
          materialIds
            .filter((id, i) => materialIds.indexOf(id) !== i)
            .map((id) => {
              const mat = (row.materials || []).find((m) => m.m_item_id === id);
              return mat?.m_item?.nama_item || "Material";
            })
        ),
      ];
      routingErrors.push(
        `Routing #${rowNum}: Tidak boleh ada material yang sama dalam 1 routing (${duplicateNames.join(", ")})`
      );
    }

    // Rule 5b: Minimal 1 material per routing
    if (!row.materials || row.materials.length === 0) {
      routingErrors.push(`Routing #${rowNum}: Minimal harus ada 1 material`);
    }

    // Rule 6: Jika routing pakai mesin (is_mesin = 1), m_mesin_id wajib diisi
    if (row.m_routing?.is_mesin === true && !row.m_mesin_id) {
      routingErrors.push(`Routing #${rowNum}: Mesin wajib dipilih untuk routing ini`);
    }
  }

  // Rule 7a: Hanya boleh ada 1 Final Routing
  const finalCount = bomDetails.value.filter((r) => r.is_final).length;
  if (finalCount > 1) {
    routingErrors.push("Hanya boleh ada 1 Final Routing");
  }

  // Rule 7b: Final Routing harus berada di posisi paling bawah
  if (finalCount === 1) {
    const lastIdx = bomDetails.value.length - 1;
    const finalIdx = bomDetails.value.findIndex((r) => r.is_final);
    if (finalIdx !== lastIdx) {
      routingErrors.push("Final Routing harus berada di posisi paling bawah");
    }
  }

  if (routingErrors.length > 0) {
    errors.routings = routingErrors;
    toast.error("Validasi gagal", {
      description: routingErrors[0],
    });
    return;
  }

  loading.value = true;
  try {
    const payload = {
      id: isEditMode.value ? menuId.value : undefined,
      m_unit_bisnis_id: values.m_unit_bisnis_id || undefined,
      no: isEditMode.value ? (values.no?.trim() || undefined) : undefined,
      date: values.date || undefined,
      status: values.status,
      m_item_id: values.m_item_id || undefined,
      qty: values.qty,
      unit_id: values.unit_id || undefined,
      t_precost_id: values.t_precost_id || undefined,
      overhead_cost: values.overhead_cost || undefined,
      labor_cost: values.labor_cost || undefined,
      main_weight: totalKgMaterial.value || undefined,
      total_overhead: totalOverhead.value || undefined,
      total_labor: totalLabor.value || undefined,
      notes: values.notes?.trim() || undefined,
      flag: values.flag?.trim() || undefined,
      type: values.type || 'GENERAL',
      is_specific: values.type === 'SPESIFIK',
      batch_weight: Number(batchWeightKg.value) || Number(values.batch_weight) || 0,
      base_resin: Number(baseResinKg.value) || Number(values.base_resin) || 0,
      total_volume: Number(totalVolume.value) || Number(values.total_volume) || 0,
      sg_compound: Number(sgCompound.value) || Number(values.sg_compound) || 0,
      total_biaya_material: Number(totalHargaBB.value) || Number(values.total_biaya_material) || 0,
      harga_per_kg_compound: isTypeChemical.value
        ? (Number(hargaPerKgCompound.value) || 0)
        : (Number(values.harga_per_kg_compound) || Number(formulaHargaTube.value) || 0),
      hose_weight: isTypeSpesifik.value ? (Number(totalHoseWeightPerMeter.value) || 0) : (Number(values.hose_weight) || 0),
      hpp_material: isTypeSpesifik.value ? (Number(totalHoseCostExcludePerMeter.value) || 0) : (Number(values.hpp_material) || 0),
      hpp_material_ppn: isTypeSpesifik.value ? (Number(totalHoseCostIncludePerMeter.value) || 0) : (Number(values.hpp_material_ppn) || 0),
      m_bom_d_routing: bomDetails.value.map((row, idx) => ({
        sequence: idx + 1,
        id: row.id || undefined,
        m_routing_id: row.m_routing_id || undefined,
        to_routing_id: row.to_routing_id || undefined,
        is_final: row.is_final,
        m_mesin_id: row.m_mesin_id || undefined,
        output_type: row.output_type || undefined,
        m_item_id: row.m_item_id || undefined,
        qty: row.qty,
        unit_id: row.unit_id || undefined,
        time: row.time || 0,
        notes: row.notes?.trim() || undefined,
        // m_bom_sd_materials: bomDetails.value.flatMap((row) =>
        m_bom_sd_material:
          (row.materials || []).map((mat, midx) => ({
            id: mat.id || undefined,
            sequence: midx + 1,
            m_bom_d_routing_id: row.id || null,
            item_type_id: mat.item_type_id || undefined,
            m_item_id: mat.m_item_id || undefined,
            is_main: mat.is_main,
            qty: mat.qty,
            unit_id: mat.unit_id || undefined,
            weight: isWipMode.value ? undefined : (mat.weight || undefined),
            phr: isWipMode.value ? (getPHR(idx, mat) || undefined) : undefined,
            berat_jenis: mat.berat_jenis != null && mat.berat_jenis !== 0 
              ? Number(mat.berat_jenis) 
              : (mat.m_item?.berat_jenis != null ? Number(mat.m_item.berat_jenis) : undefined),
            harga_satuan: mat.harga_satuan || undefined,
            volume: mat.volume != null && Number(mat.volume) > 0 ? Number(mat.volume) : (getMatVolume(mat) || undefined),
            notes: mat.notes?.trim() || undefined,
          })),
      })),

      m_bom_d_coproducts: coProducts.value.map((cp, idx) => ({
        sequence: idx + 1,
        item_type_id: cp.item_type_id || undefined,
        m_item_id: cp.m_item_id || undefined,
      })),

      m_bom_d_spek: isTypeSpesifik.value
        ? detailSpek.value.map((row, idx) => ({
            id: row.id || undefined,
            bom_id: isEditMode.value ? menuId.value : undefined,
            sequence: idx + 1,
            layer_id: row.layer_id || undefined,
            param_id: row.nama_parameter || undefined,
            value: row.value ? String(row.value).trim().replace(',', '.') : undefined,
            unit_id: row.satuan || undefined,
            notes: row.notes?.trim() || undefined,
          }))
        : [],

      // === DETAIL TABEL TERPISAH: m_bom_d_formula (EXCEL ROW 29-32) ===
      m_bom_d_formula: isTypeSpesifik.value ? {
        id: (formulaDetailId.value && !isCopyMode.value) ? formulaDetailId.value : undefined,
        m_bom_id: isEditMode.value ? menuId.value : undefined,

        // COMPOUND
        sg_compound: sgCompound.value > 0 ? sgCompound.value : undefined,
        harga_compound: hargaPerKgCompound.value > 0 ? hargaPerKgCompound.value : undefined,

        // TUBE
        tube_id: tubeDim.value.id > 0 ? tubeDim.value.id : undefined,
        tube_thick: tubeDim.value.thick > 0 ? tubeDim.value.thick : undefined,
        tube_od: tubeDim.value.od > 0 ? tubeDim.value.od : undefined,
        tube_weight_meter: tubeDim.value.weight > 0 ? tubeDim.value.weight : undefined,
        tube_cost_meter: tubeDim.value.cost > 0 ? tubeDim.value.cost : undefined,

        // PET YARN
        yarn_id: yarnDim.value.id > 0 ? yarnDim.value.id : undefined,
        yarn_thick: yarnDim.value.thick > 0 ? yarnDim.value.thick : undefined,
        yarn_od: yarnDim.value.od > 0 ? yarnDim.value.od : undefined,
        yarn_carrier_count: carrierCount.value > 0 ? carrierCount.value : undefined,
        yarn_braid_angle: braidAngle.value > 0 ? braidAngle.value : undefined,
        yarn_weight_meter: yarnDim.value.weight > 0 ? yarnDim.value.weight : undefined,
        yarn_cost_meter: yarnDim.value.cost > 0 ? yarnDim.value.cost : undefined,

        // COVER
        cover_id: coverDim.value.id > 0 ? coverDim.value.id : undefined,
        cover_thick: coverDim.value.thick > 0 ? coverDim.value.thick : undefined,
        cover_od: coverDim.value.od > 0 ? coverDim.value.od : undefined,
        cover_weight_meter: coverDim.value.weight > 0 ? coverDim.value.weight : undefined,
        cover_cost_meter: coverDim.value.cost > 0 ? coverDim.value.cost : undefined,

        // TOTAL SELANG (HOSE TOTAL)
        hose_weight_meter: totalHoseWeightPerMeter.value > 0 ? totalHoseWeightPerMeter.value : undefined,
        hose_cost_meter: totalHoseCostExcludePerMeter.value > 0 ? totalHoseCostExcludePerMeter.value : undefined,
        hose_cost_meter_inc_ppn: totalHoseCostIncludePerMeter.value > 0 ? totalHoseCostIncludePerMeter.value : undefined,
      } : undefined,
    };

    if (isEditMode.value) {
      await updateBom(menuId.value, payload);
      toast.success("BOM berhasil diperbarui");
    } else {
      await createBom(payload);
      toast.success("BOM berhasil dibuat");
    }

    router.replace("/production/master/m_bom?reload=" + Date.now());
  } catch (error) {
    toast.error(isEditMode.value ? "Gagal memperbarui BOM" : "Gagal membuat BOM", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => router.push("/production/master/m_bom");
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
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
    <form class="space-y-6" @submit.prevent>
      <!-- ================================================================ -->
      <!-- LOCKED BANNER: BOM sudah dipakai di Work Order -->
      <!-- ================================================================ -->
      <div
        v-if="isUsedLocked"
        class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40 p-4"
      >
        <AlertTriangle class="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p class="text-sm font-medium text-amber-800 dark:text-amber-300">
            BOM ini sudah dipakai pada Work Order.
          </p>
          <p class="text-sm text-amber-700 dark:text-amber-400">
            Detail BOM tidak dapat diubah. Hanya status Aktif/Tidak Aktif yang boleh diperbarui. Untuk perubahan, silakan buat BOM baru.
          </p>
        </div>
      </div>
      <!-- ================================================================ -->
      <!-- CARD 1: INFORMASI BOM -->
      <!-- ================================================================ -->
      <Card class="">
        <!-- <Card class="border-0 shadow-[0_1px_3px_rgba(0,0,0,0.05)] rounded-xl bg-white overflow-visible"> -->
        <CardHeader>
          <CardTitle>Informasi BOM</CardTitle>
          <CardDescription>
            Isi data BOM dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="p-8">


          <!-- Header -->
          <!-- Form Grid UI -->
          <div class="grid grid-cols-12 gap-x-8 gap-y-6">
            <div class="col-span-3">

              <FieldSelect v-if="isSuperAdmin" id="m_unit_bisnis_id" label="Unit Bisnis"
                v-model="values.m_unit_bisnis_id" :errorname="errors.m_unit_bisnis_id ? 'failed' : ''"
                :hints="errors.m_unit_bisnis_id || 'Pilih unit bisnis'" :required="!isReadOnly"
                :disabled="loading || locked" :readonly="locked" :api="{
                  url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    no_pagination: 'true',
                    selectfield: 'id,nama_comp',
                    filter_column_is_active: 'true',
                  },
                }" valueField="id" displayField="nama_comp" placeholder="Pilih unit bisnis" :clearable="true" />
              <FieldX v-else id="m_unit_bisnis_display" label="Unit Bisnis" :value="companyNameDisplay" :disabled="true"
                :readonly="true" placeholder="Auto dari akun" hints="Unit bisnis dari akun Anda" />

            </div>
            <div class="col-span-3">
              <FieldX id="no" label="Kode BOM" :value="values.no || 'Auto Generate'" :required="false" :disabled="true"
                :readonly="true" placeholder="Auto Generate" class="w-full opacity-70" />
            </div>
            
            <div class="col-span-3">
              <FieldDate id="date" label="Tanggal" :value="values.date" :required="!isReadOnly"
              :disabled="loading || locked" :readonly="locked" placeholder="Pilih tanggal" 
              @input="(v) => (values.date = v)" class="w-full" />
              <!-- <FieldDate 
                id="date" 
                label="Tanggal" 
                v-model="values.date" 
                :required="!isReadOnly"
                :disabled="loading || locked" 
                :readonly="locked" 
                placeholder="Pilih tanggal"
                class="w-full" 
              /> -->
            </div>
            <div class="col-span-3">
              <FieldSelect id="flag" label="Jenis BOM" :value="values.flag" :options="[
                { id: 'FINISHED GOOD', label: 'Finished Good' },
                { id: 'WIP', label: 'WIP' }
              ]" display-field="label" value-field="id" placeholder="Pilih Jenis BOM" :required="!isReadOnly"
                :disabled="loading || locked" :readonly="locked" :clearable="true"
                :errorText="errors.flag ? 'failed' : ''" :hints="errors.flag || 'Pilih jenis BOM'"
                @input="(v) => (values.flag = v)" class="w-full" />
            </div>

            <div class="col-span-6">
              <FieldPopup id="t_precost_id" label="No. Pre Costing" :value="values.t_precost_id" :api="{
                url: `${API_BASE_URL}/dynamic/t_precost`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'no,date,m_customer.nama_customer',
                  join: true,
                  filter_column_status: 'APPROVED'
                },
              }" display-field="no" value-field="id" :columns="[
                  { key: 'no', label: 'No. Pre Costing', width: '150px' },
                  { key: 'date', label: 'Tgl. Pre Costing', width: '300px' },
                  { key: 'm_customer.nama_customer', label: 'Customer', width: '150px' },
                  { key: 'm_item.nama_item', label: 'Item', width: '150px' },
                ]" placeholder="Pilih Pre-Costing" :required="false" :disabled="loading || locked"
                :readonly="locked" :clearable="true" :errorText="errors.t_precost_id ? 'failed' : ''"
                :hints="errors.t_precost_id || 'Pilih Pre-Costing untuk BOM ini'" @input="(v) => (values.t_precost_id = v)"
                @update:valueFull="handlePrecostSelected" class="w-full" />
            </div>

            <div class="col-span-6">
              <FieldPopup id="m_item_id" label="Item" :value="values.m_item_id" :api="{
                url: `${API_BASE_URL}/dynamic/m_items`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: itemApiParams,
              }" display-field="nama_item" value-field="id" :columns="[
                  { key: 'kode_item', label: 'Kode', width: '150px' },
                  { key: 'nama_item', label: 'Nama Item', width: '300px' },
                  { key: 'mi_uom.value1', label: 'Unit', width: '150px' },
                 ]" placeholder="Pilih Item" :required="!isReadOnly && !isPrecostLocked"
                 :disabled="loading || locked || isPrecostLocked || !values.flag"
                 :readonly="locked || isPrecostLocked || !values.flag" :clearable="true"
                 :display-value="values.m_item?.nama_item || values.m_item?.kode_item || ''"
                 :errorText="errors.m_item_id ? 'failed' : ''"
                 :hints="errors.m_item_id || (!values.flag ? 'Pilih Jenis BOM terlebih dahulu' : 'Pilih item produk untuk BOM ini')" @input="(v) => (values.m_item_id = v)"
                @update:valueFull="(item) => { values.m_item = item; values.unit_id = item?.uom_id }" class="w-full" />
            </div>
            <div class="col-span-3">
               <FieldNumber id="qty" label="Qty" :value="values.qty" :required="!isReadOnly && !isWipMode && !isTypeSpesifik"
                 :disabled="loading || locked || isPrecostLocked || !values.flag || isWipMode || isTypeSpesifik"
                 :readonly="locked || isPrecostLocked || !values.flag || isWipMode || isTypeSpesifik"
                 :errorText="errors.qty ? 'failed' : ''"
                 :hints="errors.qty || (!values.flag ? 'Pilih Jenis BOM terlebih dahulu' : isPrecostLocked ? 'Otomatis dari Pre-Costing' : isTypeSpesifik ? 'Otomatis diambil dari kalkulasi total berat spesifikasi selang (kg)' : isWipMode ? 'Otomatis dari total qty main material' : 'Jumlah produksi')" :min="0" type="decimal" :step="0.0001" @input="(v) => (values.qty = v === '' || v == null ? 0 : Number(v))"
                class="w-full" />
            </div>
            <div class="col-span-3">
              <FieldSelect id="unit_id" label="Satuan" :value="values.unit_id" :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'value1',
                  filter_column_group: 'UOM',
                  filter_column_is_active: 'true',
                  no_pagination: 'true',
                },
               }" display-field="value1" value-field="id" placeholder="Pilih Satuan" :required="!isReadOnly"
                 :disabled="loading || locked || isPrecostLocked || !values.flag"
                 :readonly="locked || isPrecostLocked || !values.flag" :clearable="true"
                 :display-value="uomMap[values.unit_id] || values.unit?.value1 || ''" :errorText="errors.unit_id ? 'failed' : ''"
                 :hints="errors.unit_id || (!values.flag ? 'Pilih Jenis BOM terlebih dahulu' : isPrecostLocked ? 'Otomatis dari Pre-Costing' : 'Satuan produk')" @input="(v) => (values.unit_id = v)"
                @update:valueFull="(item) => (values.unit = item)" class="w-full" />
            </div>
            <!-- <div class="col-span-6"></div> -->

            <div class="col-span-3">
              <FieldNumber id="labor_cost" label="Labor Cost" :value="values.labor_cost" :prefix="'Rp'"
                type="decimal" :min="0" :step="0.01"
                :required="false" :disabled="loading || locked" :readonly="locked"
                input-class="h-9 bg-white dark:bg-muted/50 text-right text-[13px] text-gray-700 dark:text-slate-200 disabled:bg-gray-100 dark:disabled:bg-slate-700 disabled:cursor-not-allowed"
                @input="(v) => (values.labor_cost = v === '' || v == null ? 0 : Number(v))" class="w-full" />
            </div>
            <div class="col-span-3">
              <FieldNumber id="overhead_cost" label="Overhead" :value="values.overhead_cost" :prefix="'Rp'"
                type="decimal" :min="0" :step="0.01"
                :required="false" :disabled="loading || locked" :readonly="locked"
                input-class="h-9 bg-white dark:bg-muted/50 text-right text-[13px] text-gray-700 dark:text-slate-200 disabled:bg-gray-100 dark:disabled:bg-slate-700 disabled:cursor-not-allowed"
                @input="(v) => (values.overhead_cost = v === '' || v == null ? 0 : Number(v))" class="w-full" />
            </div>

            <div class="col-span-6">
              <FieldTextarea id="notes" label="Catatan" :value="values.notes" :disabled="loading || locked"
                :readonly="locked"  ceholder="Catatan" :rows="3" @input="(v) => (values.notes = v)"
                class="w-full" />
            </div>

            <div class="col-span-3">
              <FieldSelect id="type" label="Tipe BOM" :value="values.type" :options="typeOptions"
                display-field="label" value-field="value" placeholder="Pilih Tipe BOM" :required="!isReadOnly"
                :disabled="loading || locked || isPrecostLocked" :readonly="locked || isPrecostLocked"
                :hints="isPrecostLocked ? 'Otomatis dari Pre-Costing' : 'Pilih tipe kalkulasi BOM'"
                @input="(v) => handleTypeChange(v)" class="w-full" />
            </div>

            <!-- Harga Perkilo Sekali Masak (Hanya tampil pada tipe CHEMICAL) -->
            <div v-if="isTypeChemical" class="col-span-3">
              <FieldNumber
                id="harga_per_kg_compound"
                label="Harga Perkilo Sekali Masak"
                prefix="Rp"
                :value="values.harga_per_kg_compound || (hargaPerKgCompound || 0)"
                type="decimal"
                :min="0"
                :step="1"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                :hints="'Sesuai Excel: Biaya per kg kompon sekali masak'"
                @input="(v: any) => onHargaSekaliMasakChange(v)"
                class="w-full"
              />
            </div>

            <div class="col-span-3">
              <FieldStatus label="Status" name="status" v-model="values.status" :disabled="loading"
                :readonly="isReadOnly" active-text="Aktif" inactive-text="Tidak Aktif" />
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- ================================================================ -->
      <!-- CARD 2: DETAIL BOM -->
      <!-- ================================================================ -->
      <!-- <Card class="border-0 shadow-[0_1px_3px_rgba(0,0,0,0.05)] rounded-xl bg-white overflow-hidden pb-6"> -->
      <!-- <div class="px-8 py-5 border-b border-gray-100">
          <h2 class="text-[15px] font-semibold text-gray-800">BOM Detail</h2>
        </div> -->

      <!-- Custom Tab Segment -->
      <!-- <div class="px-8 pt-5 pb-4">
          <div class="inline-flex bg-[#f1f5f9] p-1 rounded-lg border border-gray-100">
            <button type="button" @click="activeTab = 'bom'" :class="activeTab === 'bom'
                ? 'bg-white shadow-sm font-semibold text-gray-800 rounded-md'
                : 'text-gray-500 hover:text-gray-700 font-medium'
              " class="px-5 py-1.5 text-[13px] transition-all">
              BOM
            </button>
            <button type="button" @click="activeTab = 'co_product'" :class="activeTab === 'co_product'
                ? 'bg-white shadow-sm font-semibold text-gray-800 rounded-md'
                : 'text-gray-500 hover:text-gray-700 font-medium'
              " class="px-5 py-1.5 text-[13px] transition-all">
              Co-Product
            </button>
          </div>
        </div> -->
      <Tabs default-value="bom" class="w-full">
        <TabsList class="w-full overflow-x-auto flex justify-start scrollbar-hide">
          <TabsTrigger value="bom">BOM</TabsTrigger>
          <TabsTrigger value="coProduct">Co-Product</TabsTrigger>
          <TabsTrigger value="detailSpek" v-if="isTypeSpesifik">Detail Spek</TabsTrigger>
        </TabsList>

        <!-- ================= TAB: BOM ================= -->
        <!-- <div v-show="activeTab === 'bom'" class="px-8 space-y-4">
          <div>
            <Button type="button" @click="addBomRow"
              class="bg-[#2563eb] hover:bg-blue-700 text-white rounded-md h-8 text-[13px] font-medium px-4 flex items-center gap-1.5">
              <Plus class="h-4 w-4" /> Add Row
            </Button>
          </div> -->
        <TabsContent value="bom" class="space-y-4 mt-4">
          <Card>
            <CardHeader class="border-b bg-slate-50/50 dark:bg-muted/40">
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail BOM</CardTitle>
                  <CardDescription>Kelola detail BOM</CardDescription>
                </div>
                <Button v-if="!locked" @click="addBomRow" size="sm" variant="outline">
                  + Tambah
                </Button>
              </div>
            </CardHeader>
            <CardContent class="p-0">

              <div class="border-t border-slate-200 dark:border-border overflow-x-auto">
                <table class="w-full text-[13px] whitespace-nowrap border-collapse">
                  <thead class="bg-slate-50 dark:bg-muted/50 border-b border-slate-200 dark:border-border">
                    <tr class="text-slate-700 dark:text-slate-200 text-left font-semibold border-b border-slate-200 dark:border-border divide-x divide-slate-200 dark:divide-border">
                      <th class="px-3 py-2.5 w-16 text-center"></th>
                      <th class="px-2 py-2.5 text-center w-12 font-semibold">No</th>
                      <th class="px-2 py-2.5 text-center w-16 font-semibold">Is Final</th>
                      <th class="px-2 py-2.5 font-semibold">Route</th>
                      <th class="px-2 py-2.5 font-semibold">To Route</th>
                      <th class="px-2 py-2.5 font-semibold">Mesin</th>
                      <th class="px-2 py-2.5 font-semibold">Output Type</th>
                      <th class="px-2 py-2.5 font-semibold">WIP/Item</th>
                      <th class="px-2 py-2.5 min-w-[90px] w-[90px] font-semibold">Qty</th>
                      <th class="px-2 py-2.5 w-20 font-semibold">UoM</th>
                      <th class="px-2 py-2.5 w-24 font-semibold">Time (Menit)</th>
                      <th class="px-2 py-2.5 w-40 font-semibold">Catatan</th>
                    </tr>
                    <tr class="bg-slate-50/70 dark:bg-muted/30 border-b border-slate-200 dark:border-border divide-x divide-slate-200 dark:divide-border">
                      <td class="p-1"></td>
                      <td class="p-1"></td>
                      <td v-for="i in 10" :key="i" class="px-2 py-1.5">
                        <div
                          class="h-[26px] w-full border border-slate-200 dark:border-input rounded bg-white dark:bg-input/30 flex items-center justify-end px-2 text-slate-400 dark:text-muted-foreground">
                          <ChevronDown class="h-3.5 w-3.5" />
                        </div>
                      </td>
                    </tr>
                  </thead>
                  <tbody>
                    <template v-if="bomDetails.length === 0">
                      <tr>
                        <td colspan="12" class="text-center py-12 text-slate-400 dark:text-muted-foreground bg-white dark:bg-card">
                          Belum ada detail BOM ditambahkan
                        </td>
                      </tr>
                    </template>
                    <template v-else v-for="(row, idx) in bomDetails" :key="idx">
                      <tr class="bg-white dark:bg-card border-b border-slate-200 dark:border-border divide-x divide-slate-200 dark:divide-border hover:bg-slate-50/50 dark:hover:bg-muted/20">
                        <td class="px-3 py-2 align-middle text-center">
                          <div class="flex items-center justify-center gap-2">
                            <button type="button" @click="toggleRowExpand(idx)"
                              class="flex items-center justify-center w-4.5 h-4.5 rounded-full bg-[#00ACC1] text-white hover:bg-[#00838F] transition-colors focus:outline-none shadow-sm cursor-pointer">
                              <ChevronDown v-if="row._expanded" class="h-2.5 w-2.5 stroke-[3]" />
                              <ChevronRight v-else class="h-2.5 w-2.5 stroke-[3]" />
                            </button>
                            <button v-if="!locked" type="button" @click="removeBomRow(idx)"
                              class="text-red-500 hover:text-red-700 p-1 focus:outline-none transition">
                              <Trash2 class="h-[18px] w-[18px]" />
                            </button>
                          </div>
                        </td>

                        <td class="px-2 py-2 align-middle text-center text-slate-600 dark:text-slate-300 font-medium">
                          {{ idx + 1 }}
                        </td>
                        <td class="px-2 py-2 align-middle text-center">
                          <input type="checkbox" :checked="row.is_final"
                            :disabled="locked || idx !== bomDetails.length - 1" @change="toggleIsFinal(idx)"
                            class="w-4 h-4 rounded border-slate-300 dark:border-input text-blue-600 focus:ring-blue-500 cursor-pointer" />
                        </td>
                        <td class="px-2 py-2">
                          <FieldSelect :id="`route-${idx}`" :value="row.m_routing_id" :api="{
                            url: `${API_BASE_URL}/dynamic/m_routing`,
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${authStore.token}`,
                            },
                            params: {
                              no_pagination: 'true',
                              filter_column_status: true,
                              ...(row.to_routing_id ? {
                                filter_column_id: `${row.to_routing_id}`,
                                filter_operator_id: '<>'
                              } : {})
                            },
                          }" display-field="name" value-field="id" placeholder="Pilih Route"
                            :disabled="loading || locked" :readonly="locked" :clearable="true"
                            :display-value="row.m_routing?.name || ''" @input="(v) => (row.m_routing_id = v)"
                            @update:valueFull="(item) => (row.m_routing = item)" class="w-full" />
                        </td>
                        <td class="px-2 py-2">
                          <FieldSelect :id="`to-route-${idx}`" :value="row.to_routing_id" :api="{
                            url: `${API_BASE_URL}/dynamic/m_routing`,
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${authStore.token}`,
                            },
                            params: {
                              no_pagination: 'true',
                              filter_column_status: true,
                              ...(row.m_routing_id ? {
                                filter_column_id: `${row.m_routing_id}`,
                                filter_operator_id: '<>'
                              } : {})
                            },
                          }" display-field="name" value-field="id" placeholder="Pilih Route"
                            :disabled="loading || locked || row.is_final" :readonly="locked || row.is_final"
                            :clearable="true" :display-value="row.to_routing?.name || ''"
                            @input="(v) => (row.to_routing_id = v)"
                            @update:valueFull="(item) => (row.to_routing = item)" class="w-full" />
                        </td>
                        <td class="px-2 py-2">
                          <FieldSelect :id="`mesin-${idx}`" :value="row.m_mesin_id" :api="{
                            url: `${API_BASE_URL}/dynamic/m_mesin`,
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${authStore.token}`,
                            },
                            params: {
                              no_pagination: 'true',
                              filter_column_status: true,
                            },
                          }" display-field="name" value-field="id" placeholder="Pilih Mesin"
                            :disabled="loading || locked || row.m_routing?.is_mesin !== true" :readonly="locked"
                            :clearable="true" :display-value="row.m_mesin?.name || ''"
                            @input="(v) => (row.m_mesin_id = v)" @update:valueFull="(item) => (row.m_mesin = item)"
                            class="w-full" />
                        </td>
                        <td class="px-2 py-2">
                          <FieldSelect :id="`output-type-${idx}`" :value="row.output_type" :api="{
                            url: `${API_BASE_URL}/dynamic/m_general`,
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${authStore.token}`,
                            },
                            params: {
                              searchfield: 'value1',
                              filter_column_group: 'tipe_item',
                              filter_column_is_active: 'true',
                              where: `key1:WIP||key1:FG`,
                              no_pagination: 'true',
                            },
                          }" display-field="value1" value-field="id" placeholder="Pilih Output"
                            :display-value="row.output_type_label"
                            :disabled="loading || locked || row.is_final" :readonly="locked" :clearable="true"
                            @input="(v) => onOutputTypeChange(idx, v)" class="w-full" />
                        </td>
                        <td class="px-2 py-2">
                          <FieldPopup :id="`wip-item-${idx}`" :value="row.m_item_id" :api="{
                            url: `${API_BASE_URL}/dynamic/m_items`,
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${authStore.token}`,
                            },
                            params: {
                              searchfield: 'kode_item,nama_item',
                              filter_column_is_active: 'true',
                              ...(row.output_type ? { filter_column_tipe_id: row.output_type } : {}),
                            },
                          }" display-field="nama_item" value-field="id" :columns="[
                              { key: 'kode_item', label: 'Kode', width: '120px' },
                              { key: 'nama_item', label: 'Nama Item', width: '200px' },
                            ]" placeholder="Pilih Item" :disabled="loading || locked || row.is_final"
                            :readonly="locked || row.is_final" :clearable="true" @input="(v) => (row.m_item_id = v)"
                            @update:valueFull="(item) => { row.m_item = item; row.unit_id = item.uom_id }"
                            class="w-full" />
                        </td>
                        <td class="px-2 py-2 min-w-[90px] w-[90px]">
                          <FieldNumber type="decimal" :id="`qty-${idx}`" :value="row.qty"
                            :disabled="loading || locked || row.is_final" :readonly="locked || row.is_final"
                            :min="0" :step="0.01" @input="(v) => (row.qty = v === '' || v == null ? 0 : Number(v))" class="w-full" />
                        </td>
                        <td class="px-2 py-2">
                          <FieldSelect :id="`unit-${idx}`" :value="row.unit_id" :api="{
                            url: `${API_BASE_URL}/dynamic/m_general`,
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${authStore.token}`,
                            },
                            params: {
                              searchfield: 'value1',
                              filter_column_group: 'UOM',
                              filter_column_is_active: 'true',
                              no_pagination: 'true',
                            },
                          }" display-field="value1" value-field="id" placeholder="Pilih Satuan" :disabled="true"
                            :readonly="true" :clearable="true" :display-value="uomMap[row.unit_id] || row.unit?.value1 || ''"
                            @input="(v) => (row.unit_id = v)" @update:valueFull="(item) => (row.unit = item)"
                            class="w-full" />

                        </td>
                        <td class="px-2 py-2 min-w-[90px] w-[90px]">
                          <FieldNumber type="decimal" :id="`time-${idx}`" :value="row.time" :disabled="loading || isReadOnly"
                            :readonly="isReadOnly" :min="0" :step="0.01" @input="(v) => (row.time = v === '' || v == null ? 0 : Number(v))"
                            class="w-full" />
                        </td>
                        <td class="px-2 py-2">
                          <FieldX :id="`notes-${idx}`" :value="row.notes" :disabled="loading || locked"
                            :readonly="locked" placeholder="Catatan" @input="(v) => (row.notes = v)"
                            class="w-full" />
                        </td>
                      </tr>

                      <!-- Nested Detail Row -->
                      <tr v-if="row._expanded" class="bg-slate-50/50 dark:bg-muted/20">
                        <td colspan="11" class="p-4 border-b border-slate-200 dark:border-border">
                          <div class="space-y-3 bg-white dark:bg-card p-4 border border-cyan-100 dark:border-cyan-900/50 rounded-lg shadow-sm ml-24 mr-4">
                            <!-- TOP ACTION BAR -->
                            <div class="flex items-center justify-start gap-2 pb-1">
                              <Button 
                                v-if="!locked && values.t_precost_id" 
                                type="button" 
                                size="sm" 
                                variant="outline" 
                                class="h-7 text-[10px] border-cyan-100 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
                                @click="openPrecostDetailDialog(idx)"
                              >
                                <Plus class="h-3.5 w-3.5 mr-1" /> Add Material Pre-costing
                              </Button>
                              <Button 
                                v-if="!locked" 
                                type="button" 
                                size="sm" 
                                variant="outline" 
                                class="h-7 text-[10px] border-cyan-100 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
                                @click="addMaterialRow(idx)"
                              >
                                <Plus class="h-3.5 w-3.5 mr-1" /> Add Material
                              </Button>
                            </div>

                            <!-- HEADER BAR -->
                            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-cyan-50 dark:border-cyan-900/40 pb-2 pt-1 border-t border-t-cyan-50 dark:border-t-cyan-900/40 gap-2">
                              <h5 class="font-bold text-cyan-800 dark:text-cyan-300 text-[11px] flex items-center gap-1.5">
                                <span class="inline-block w-1.5 h-3 bg-[#00ACC1] rounded"></span>
                                Kebutuhan Material
                              </h5>
                            </div>
                            
                            <!-- TABEL MATERIALS (TAMPIL HANYA JIKA ADA DATA) -->
                            <div v-if="row.materials && row.materials.length > 0" class="overflow-x-auto border border-cyan-100 dark:border-cyan-900/50 rounded-md">
                              <table class="w-full text-[10px] border-collapse">
                                <thead class="bg-cyan-50/50 dark:bg-cyan-950/30 border-b border-cyan-100 dark:border-cyan-900/50">
                                  <tr class="divide-x divide-cyan-100 dark:divide-cyan-900/50 text-cyan-900 dark:text-cyan-200">
                                    <th v-if="!locked" class="w-12 py-1.5 px-2 text-center"></th>
                                    <th class="w-10 py-1.5 px-2 text-left font-semibold">No</th>
                                    <th class="min-w-[120px] py-1.5 px-2 text-left font-semibold">Tipe Material</th>
                                    <th class="min-w-[200px] py-1.5 px-2 text-left font-semibold">Material</th>
                                    <th v-if="isTypeChemical" class="w-16 py-1.5 px-2 text-center font-semibold">Main</th>
                                    <th class="min-w-[90px] py-1.5 px-2 text-left font-semibold">Qty</th>
                                    <th class="min-w-[90px] py-1.5 px-2 text-left font-semibold">UoM</th>
                                    <th class="min-w-[115px] py-1.5 px-2 text-center font-semibold" title="Volume (dm³) = Qty (Kg) / Berat Jenis">
                                      <div class="flex items-center justify-center gap-1 text-blue-700 dark:text-blue-400">
                                        <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                        <span>Volume (dm³)</span>
                                      </div>
                                    </th>
                                    <th class="min-w-[100px] py-1.5 px-2 text-left font-semibold">{{ isWipMode ? 'PHR (%)' : 'Berat (Kg)' }}</th>
                                    <th class="min-w-[125px] py-1.5 px-2 text-center font-semibold">
                                      <div class="flex items-center justify-center gap-1 text-emerald-700 dark:text-emerald-400">
                                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                        <span>Berat Jenis (Kg/dm³)</span>
                                      </div>
                                    </th>
                                    <th class="min-w-[110px] py-1.5 px-2 text-left font-semibold">Harga/KG (Rp)</th>
                                    <th class="min-w-[130px] py-1.5 px-2 text-left font-semibold">
                                      <div class="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                                        <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                        <span>Harga BB (Rp)</span>
                                      </div>
                                    </th>
                                    <th class="min-w-[130px] py-1.5 px-2 text-left font-semibold">Catatan</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr v-for="(mat, mIdx) in row.materials" :key="mIdx"
                                    class="divide-x divide-cyan-100 dark:divide-cyan-900/50 border-b border-cyan-100 dark:border-cyan-900/50 align-middle bg-white dark:bg-card hover:bg-slate-50/20 dark:hover:bg-muted/20">
                                    <td v-if="!locked" class="py-1.5 px-2 text-center">
                                      <button type="button" class="text-red-500 hover:text-red-700 dark:hover:bg-red-950/30 transition" @click="removeMaterialRow(idx, mIdx)">
                                        <Trash2 class="h-3.5 w-3.5" />
                                      </button>
                                    </td>
                                    <td class="py-1.5 px-2 text-slate-500 dark:text-muted-foreground font-medium">
                                      {{ mIdx + 1 }}
                                    </td>
                                    <td class="py-1.5 px-2">
                                      <FieldSelect :id="`mat-type-${idx}-${mIdx}`" :value="mat.item_type_id" :api="{
                                        url: `${API_BASE_URL}/dynamic/m_general`,
                                        headers: {
                                          'Content-Type': 'application/json',
                                          Authorization: `Bearer ${authStore.token}`,
                                        },
                                        params: {
                                          searchfield: 'value1',
                                          filter_column_group: 'TIPE_ITEM',
                                          filter_column_is_active: 'true',
                                          where: `key1:RM||key1:WIP||key1:SM`,
                                          no_pagination: 'true',
                                        },
                                      }" display-field="value1" value-field="id" placeholder="Pilih Tipe"
                                        :disabled="loading || locked" :readonly="locked" :clearable="true"
                                        @input="(v) => (mat.item_type_id = v)" :display-value="mat.bom_mat_type?.value1 || mat.item_type?.value1 || ''"
                                        @update:valueFull="(item) => (mat.item_type = item)" class="w-full text-[11px]" />
                                    </td>
                                    <td class="py-1.5 px-2">
                                      <FieldPopup :id="`mat-material-${idx}-${mIdx}`" :value="mat.m_item_id" :api="{
                                        url: `${API_BASE_URL}/dynamic/m_items`,
                                        headers: {
                                          'Content-Type': 'application/json',
                                          Authorization: `Bearer ${authStore.token}`,
                                        },
                                        params: {
                                          searchfield: 'kode_item,nama_item',
                                          filter_column_is_active: 'true',
                                          ...(mat.item_type_id ? { filter_column_tipe_id: mat.item_type_id } : {})
                                        },
                                       }" display-field="nama_item" value-field="id" :columns="[
                                            { key: 'kode_item', label: 'Kode', width: '120px' },
                                            { key: 'nama_item', label: 'Nama Item', width: '200px' },
                                            { key: 'berat_jenis', label: 'Berat Jenis', width: '90px' },
                                          ]" placeholder="Pilih Material"
                                          :disabled="loading || locked || !mat.item_type_id"
                                          :readonly="locked || !mat.item_type_id" :clearable="true"
                                          :display-value="mat.m_item?.nama_item || mat.m_item?.kode_item || ''"
                                          :hints="!mat.item_type_id ? 'Pilih Tipe terlebih dahulu' : ''"
                                          @input="(v) => (mat.m_item_id = v)"
                                         @update:valueFull="(item) => handleRoutingMaterialSelected(mat, item)"
                                         :excludeIds="selectedMaterialIdsByRouting[idx] || []"
                                         class="w-full text-[11px]" />
                                    </td>
                                    <td v-if="isTypeChemical" class="py-1.5 px-2 text-center align-middle">
                                      <input type="checkbox" v-model="mat.is_main" :disabled="locked"
                                        class="w-3.5 h-3.5 rounded border-slate-300 dark:border-input text-[#00ACC1] focus:ring-[#00ACC1] cursor-pointer" />
                                    </td>
                                    <td class="py-1.5 px-2">
                                      <FieldNumber type="decimal" :id="`mat-qty-${idx}-${mIdx}`" :value="mat.qty"
                                        :disabled="loading || locked" :readonly="locked" :min="0" :step="0.01"
                                        @input="(v) => {
                                          mat.qty = v === '' || v == null ? 0 : Number(v);
                                          mat.weight = round2((Number(v) || 0) * (Number(mat.m_item?.berat_bersih) || 0));
                                        }" class="w-full text-[11px]" />
                                    </td>
                                    <td class="py-1.5 px-2">
                                      <FieldSelect :id="`mat-unit-${idx}-${mIdx}`" :value="mat.unit_id" :api="{
                                        url: `${API_BASE_URL}/dynamic/m_general`,
                                        headers: {
                                          'Content-Type': 'application/json',
                                          Authorization: `Bearer ${authStore.token}`,
                                        },
                                        params: {
                                          searchfield: 'value1',
                                          filter_column_group: 'UOM',
                                          filter_column_is_active: 'true',
                                          no_pagination: 'true',
                                        },
                                      }" display-field="value1" value-field="id" placeholder="Pilih" :disabled="true"
                                        :readonly="true" :clearable="true" :display-value="uomMap[mat.unit_id] || mat.bom_mat_unit?.value1 || mat.unit?.value1 || ''"
                                        @input="(v) => (mat.unit_id = v)"
                                        @update:valueFull="(item) => (mat.bom_mat_unit = item)" class="w-full text-[11px]" />
                                    </td>
                                    <!-- Volume (dm³) - Inputan -->
                                    <td class="py-1.5 px-2 min-w-[115px]">
                                      <FieldNumber
                                        type="decimal"
                                        :id="`mat-volume-${idx}-${mIdx}`"
                                        :value="mat.volume !== undefined && mat.volume !== null && mat.volume !== '' ? mat.volume : (getMatVolume(mat) || 0)"
                                        :disabled="loading || locked"
                                        :readonly="locked"
                                        :min="0"
                                        :step="0.001"
                                        placeholder="0"
                                        @input="(v: any) => {
                                          mat.volume = v === '' || v == null ? null : Number(v)
                                        }"
                                        class="w-full text-[11px] min-w-[100px]"
                                      />
                                    </td>
                                    <td class="py-1.5 px-2">
                                      <template v-if="isWipMode">
                                        <div class="w-full text-[11px] text-right px-2 py-1 bg-slate-50 dark:bg-muted/50 rounded border border-slate-200 dark:border-border text-slate-700 dark:text-slate-200">
                                          {{ getPHR(idx, mat) }}
                                        </div>
                                      </template>
                                      <template v-else>
                                        <FieldNumber type="decimal" :id="`mat-weight-${idx}-${mIdx}`" :value="mat.weight"
                                          :disabled="loading || locked" :readonly="true" :min="0" :step="0.01"
                                          @input="(v) => (mat.weight = v === '' || v == null ? 0 : Number(v))" class="w-full text-[11px]" />
                                      </template>
                                    </td>
                                    <!-- Berat Jenis (Kg/dm³) - Auto Ambil dari Master Item -->
                                    <td class="py-1.5 px-2">
                                      <div
                                        v-if="getMatBeratJenis(mat) > 0"
                                        class="w-full text-[11px] flex items-center justify-between px-2 py-1 bg-emerald-50/70 dark:bg-emerald-950/30 rounded border border-emerald-300/80 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-300 font-medium"
                                        :title="'Auto ambil dari master item: ' + getMatBeratJenis(mat) + ' kg/dm³'"
                                      >
                                        <span class="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">SG</span>
                                        <span class="font-bold">{{ formatCommaNumber(getMatBeratJenis(mat), 2) }}</span>
                                      </div>
                                      <div
                                        v-else
                                        class="w-full text-[11px] flex items-center justify-between px-2 py-1 bg-red-50 dark:bg-red-950/40 rounded border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 font-bold"
                                        title="Data Berat Jenis di Master Item masih kosong (default 0)"
                                      >
                                        <span class="text-[9px] uppercase">SG</span>
                                        <span>0</span>
                                      </div>
                                    </td>
                                    <!-- Harga/KG (Rp) -->
                                    <td class="py-1.5 px-2">
                                      <FieldNumber type="decimal" :id="`mat-harga-${idx}-${mIdx}`" :value="mat.harga_satuan"
                                        :disabled="loading || locked" :readonly="locked" :min="0" :step="1"
                                        placeholder="0"
                                        @input="(v) => (mat.harga_satuan = v === '' || v == null ? 0 : Number(v))" class="w-full text-[11px]" />
                                    </td>
                                    <!-- Harga BB (Rp) - Terhitung Rumus Excel: Qty * Harga/KG (Warna Kuning/Amber) -->
                                    <td class="py-1.5 px-2">
                                      <div class="w-full text-[11px] flex items-center justify-between px-2 py-1 bg-amber-50/80 dark:bg-amber-950/40 rounded border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 font-bold"
                                        title="Rumus Excel: Qty × Harga/KG">
                                        <span class="text-[9px] text-amber-700 dark:text-amber-400 font-normal">Rp</span>
                                        <span>
                                          {{ formatRupiahNumber((Number(mat.qty) || 0) * (Number(mat.harga_satuan) || 0)) }}
                                        </span>
                                      </div>
                                    </td>
                                    <td class="py-1.5 px-2">
                                      <FieldX :id="`mat-notes-${idx}-${mIdx}`" :value="mat.notes"
                                        :disabled="loading || locked" :readonly="locked" placeholder="Catatan"
                                        @input="(v) => (mat.notes = v)" class="w-full text-[11px]" />
                                    </td>
                                  </tr>
                                </tbody>
                                <!-- TFOOT SUB-TOTAL PER ROUTING -->
                                <tfoot class="bg-cyan-50/60 dark:bg-cyan-950/40 border-t border-cyan-200 dark:border-cyan-800 text-[10px] font-semibold">
                                  <tr class="divide-x divide-cyan-100 dark:divide-cyan-900/50">
                                    <td :colspan="(locked ? 3 : 4) + (isTypeChemical ? 1 : 0)" class="py-2 px-2 text-right text-cyan-900 dark:text-cyan-200 uppercase tracking-wider font-bold">
                                      Total
                                    </td>
                                    <td class="py-2 px-2 text-right text-slate-900 dark:text-slate-100 font-bold">
                                      {{ formatCommaNumber(getRoutingTotalQty(row.materials), 2) }}
                                    </td>
                                    <td class="py-2 px-2 text-slate-400 text-center">-</td>
                                    <td class="py-2 px-2 text-right text-slate-700 dark:text-slate-300">
                                      <span v-if="isWipMode">{{ formatCommaNumber(getRoutingTotalPhr(idx), 2) }}%</span>
                                    </td>
                                    <td class="py-2 px-2 text-center text-emerald-700 dark:text-emerald-300 text-[9px]">
                                      Auto Item
                                    </td>
                                    <td class="py-2 px-2 text-slate-400 text-center">-</td>
                                    <td class="py-2 px-2 text-right font-bold text-amber-900 dark:text-amber-200 bg-amber-50/60 dark:bg-amber-950/30">
                                      Rp {{ formatRupiahNumber(getRoutingTotalHargaBb(row.materials)) }}
                                    </td>
                                    <td class="py-2 px-2"></td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                            <!-- EMPTY STATE -->
                            <div v-else class="text-center py-6 text-slate-400 dark:text-muted-foreground bg-slate-50/50 dark:bg-muted/20 rounded-md border border-dashed border-slate-200 dark:border-border text-[10px]">
                              Belum ada kebutuhan material untuk langkah routing ini.
                              <button v-if="!locked" type="button" class="text-cyan-600 dark:text-cyan-400 hover:underline ml-1 font-medium" @click="addMaterialRow(idx)">
                                Tambah Material
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
              <div v-if="errors.routings.length > 0" class="mt-3 space-y-1">
                <p v-for="(err, eIdx) in errors.routings" :key="eIdx" class="text-sm text-destructive">
                  {{ err }}
                </p>
              </div>
            </CardContent>
          </Card>

          <!-- ===================== RINGKASAN COMPOUND & BAHAN BAKU ===================== -->
          <div v-if="hasCompoundData || isWipMode" class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40">
            <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div class="flex items-center gap-2">
                <Layers class="h-4 w-4 text-primary" />
                <span class="text-sm font-semibold text-foreground">Ringkasan Compound & Bahan Baku</span>
                <span class="text-xs text-muted-foreground">(Kalkulasi PHR, SG Campuran, & Harga/KG)</span>
              </div>
            </div>

            <!-- Warning jika ada material yang belum memiliki SG di master item -->
            <div v-if="materialsWithoutSg.length > 0" class="mb-3 p-3 rounded-lg border border-amber-300 dark:border-amber-700/80 bg-amber-50/90 dark:bg-amber-950/40 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle class="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div class="flex-1 space-y-1">
                <div class="font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
                  <span>Peringatan: Berat Jenis (SG) & Volume Belum Lengkap</span>
                  <span class="px-1.5 py-0.2 rounded bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 text-[10px] font-bold">
                    {{ materialsWithoutSg.length }} Material Belum Ada SG
                  </span>
                </div>
                <p class="text-[11.5px] leading-relaxed text-amber-800 dark:text-amber-300">
                  Terdapat bahan baku yang <b>belum memiliki nilai Berat Jenis (SG) di Master Item</b>. Nilai <b>Volume</b> dan <b>SG Compound</b> belum bisa dihitung secara akurat.
                  Harap mengisi field <b>Berat Jenis</b> pada menu Master Item terkait.
                </p>
                <div class="flex flex-wrap gap-1.5 pt-0.5">
                  <span v-for="mat in materialsWithoutSg" :key="mat.m_item_id" class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/90 dark:bg-amber-900/60 border border-amber-300 text-amber-900 dark:text-amber-200 text-[10.5px] font-medium shadow-2xs">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    {{ mat.m_item?.nama_item || mat.m_item?.kode_item || mat.m_item_id }}
                  </span>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
              <div class="p-2.5 rounded-lg bg-background border" title="Berat 1x Masak (Batch Weight)">
                <span class="text-muted-foreground block text-[11px]">Berat 1x Masak (Batch Weight)</span>
                <span class="font-bold text-sm text-foreground">{{ batchWeightKg || values.batch_weight || 0 }} kg</span>
              </div>
              <div class="p-2.5 rounded-lg bg-background border">
                <span class="text-muted-foreground block text-[11px]">Base Resin (Main)</span>
                <span class="font-bold text-sm text-foreground">{{ baseResinKg || values.base_resin || 0 }} kg</span>
              </div>
              <div class="p-2.5 rounded-lg bg-background border">
                <span class="text-muted-foreground block text-[11px]">Total Volume</span>
                <span class="font-bold text-sm text-foreground">{{ formatCommaNumber(totalVolume || values.total_volume || 0, 2) }} dm³</span>
              </div>
              <div class="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <span class="text-emerald-700 dark:text-emerald-400 block text-[11px] font-medium">SG Compound</span>
                <span class="font-bold text-sm text-emerald-800 dark:text-emerald-300">{{ (sgCompound > 0 ? formatCommaNumber(sgCompound, 4) : formatCommaNumber(values.sg_compound, 4)) || '0' }} kg/dm³</span>
              </div>
              <div class="p-2.5 rounded-lg bg-background border" title="Total Harga Bahan Baku 1x Masak">
                <span class="text-muted-foreground block text-[11px]">Total Biaya Sekali Masak</span>
                <span class="font-bold text-sm text-foreground">Rp {{ (totalHargaBB || values.total_biaya_material || 0).toLocaleString('id-ID') }}</span>
              </div>
              <div class="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800" title="Sesuai Excel: Total Biaya / Berat 1x Masak">
                <span class="text-amber-700 dark:text-amber-400 block text-[11px] font-medium">Harga Perkilo Sekali Masak</span>
                <span class="font-bold text-sm text-amber-800 dark:text-amber-300">Rp {{ (hargaPerKgCompound || values.harga_per_kg_compound || 0).toLocaleString('id-ID') }} /kg</span>
              </div>
            </div>
          </div>
        </TabsContent>


        <!-- </div> -->

        <!-- ================= TAB: CO-PRODUCT ================= -->
        <TabsContent value="coProduct" class="space-y-4 mt-4">
          <Card class="overflow-hidden">
            <CardHeader class="border-b bg-slate-50/50 dark:bg-muted/40">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0">
                  <CardTitle>Co-Product</CardTitle>
                  <CardDescription>Kelola Detail Co-Product</CardDescription>
                </div>
                <Button v-if="!locked" type="button" @click="addCoProductRow" size="sm" variant="outline">
                  <Plus class="h-4 w-4" /> Tambah
                </Button>
              </div>
            </CardHeader>
            <CardContent class="space-y-4 p-0">
              <div class="p-4 space-y-4">
                <div class="border border-slate-200 dark:border-border rounded-md overflow-hidden">
                  <table class="w-full text-[13px] border-collapse">
                    <thead class="bg-slate-50 dark:bg-muted/50 border-b border-slate-200 dark:border-border">
                      <tr class="text-slate-700 dark:text-slate-200 text-left font-semibold border-b border-slate-200 dark:border-border divide-x divide-slate-200 dark:divide-border">
                        <th class="px-4 py-3 w-16 text-center font-semibold">No</th>
                        <th class="px-4 py-3 w-48 font-semibold">Item Type</th>
                        <th class="px-4 py-3 font-semibold">Item</th>
                        <th class="px-4 py-3 w-16 text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-if="coProducts.length === 0">
                        <td colspan="4" class="text-center py-8 text-slate-400 dark:text-muted-foreground bg-white dark:bg-card">
                          Belum ada item ditambahkan
                        </td>
                      </tr>
                      <tr v-for="(row, idx) in coProducts" :key="idx"
                        class="border-b border-slate-200 dark:border-border divide-x divide-slate-200 dark:divide-border last:border-0 hover:bg-slate-50/50 dark:hover:bg-muted/20 bg-white dark:bg-card">
                        <td class="px-4 py-3 text-center text-slate-600 dark:text-slate-300 font-medium">
                          {{ idx + 1 }}
                        </td>
                        <td class="px-2 py-2">
                          <FieldSelect :id="`cp-type-${idx}`" :value="row.item_type_id" :api="{
                            url: `${API_BASE_URL}/dynamic/m_general`,
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${authStore.token}`,
                            },
                            params: {
                              searchfield: 'value1',
                              filter_column_group: 'TIPE_ITEM',
                              filter_column_is_active: 'true',
                              where: `key1:WIP||key1:RM||key1:OS||key1:NS||key1:AV`,
                              no_pagination: 'true',
                            },
                          }" display-field="value1" value-field="id" placeholder="Pilih Tipe"
                            :disabled="loading || locked" :readonly="locked" :clearable="true"
                            @input="(v) => (row.item_type_id = v)" @update:valueFull="(item) => (row.item_type = item)"
                            class="w-full" />
                        </td>
                        <td class="px-2 py-2">
                          <FieldPopup :id="`cp-item-${idx}`" :value="row.m_item_id" :api="{
                            url: `${API_BASE_URL}/dynamic/m_items`,
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${authStore.token}`,
                            },
                            params: {
                              searchfield: 'kode_item,nama_item',
                              filter_column_is_active: 'true',
                              ...(row.item_type_id ? { filter_column_tipe_id: row.item_type_id } : {}),
                            },
                          }" display-field="nama_item" value-field="id" :columns="[
                      { key: 'kode_item', label: 'Kode', width: '120px' },
                      { key: 'nama_item', label: 'Nama Item', width: '200px' },
                    ]" placeholder="Pilih Item"
                            :disabled="loading || locked || !row.item_type_id"
                            :readonly="locked || !row.item_type_id" :clearable="true"
                            :hints="!row.item_type_id ? 'Pilih Tipe terlebih dahulu' : ''"
                            @input="(v) => (row.m_item_id = v)"
                            @update:valueFull="(item) => (row.m_item = item)" class="w-full" />
                        </td>
                        <td class="px-4 py-2 text-center align-middle">
                          <button v-if="!locked" type="button" @click="removeCoProductRow(idx)"
                            class="bg-[#ef4444] hover:bg-red-600 text-white p-1.5 rounded-md focus:outline-none">
                            <Trash2 class="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- ================= TAB: DETAIL SPEK ================= -->
        <TabsContent value="detailSpek" v-if="isTypeSpesifik" class="space-y-4 mt-4">
          <!-- ============ KARTU TABEL SPESIFIKASI DINAMIS (FORMAT EXCEL LPG RED) ============ -->
          <Card class="overflow-hidden border-slate-200 dark:border-border shadow-xs">
            <CardHeader class="border-b bg-gradient-to-r from-slate-50 via-slate-50/70 to-blue-50/30 dark:from-muted/40 dark:via-muted/20 dark:to-blue-950/20 py-3.5 px-4">
              <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div class="flex items-center gap-3">
                  <div class="p-2 bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 rounded-lg">
                    <SlidersHorizontal class="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle class="text-[14px] font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      Detail Spesifikasi BOM
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
                      :disabled="loading || isReadOnly || locked"
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
                      :draggable="!isReadOnly && !locked"
                      @dragstart="onLayerDragStart($event, gIdx)"
                      :class="[
                        'flex items-center gap-1 select-none py-1 px-1.5 rounded transition-all',
                        !isReadOnly && !locked ? 'cursor-grab active:cursor-grabbing hover:bg-blue-100/70 dark:hover:bg-blue-950/60 group' : ''
                      ]"
                      :title="!isReadOnly && !locked ? 'Tarik (drag) untuk memindahkan urutan/sequence layer ini' : (getPhysicalLayerNumber(grp) ? `Lapisan Fisik #${getPhysicalLayerNumber(grp)}` : grp.layer_display)">
                      <GripVertical v-if="!isReadOnly && !locked" class="h-4 w-4 text-slate-400 group-hover:text-blue-600 dark:text-slate-500 shrink-0" />
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

                    <div class="w-64 max-w-full">
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
                        @input="(v) => (grp.layer_id = v)"
                        @update:valueFull="(item) => onLayerChange(grp, grp.layer_id, item)"
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
                      ({{ grp.params.length }} Parameter)
                    </span>
                    <!-- Dropdown Pilih Kompon Material dari Kebutuhan Material di Atas -->
                    <div v-if="getLayerKeyFromDisplay(grp.layer_display) === 'TUBE'" class="flex items-center gap-1.5 flex-wrap">
                      <span class="text-[10.5px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide shrink-0">Kompon Tube:</span>
                      <div class="w-[260px] sm:w-[320px] md:w-[360px]">
                        <FieldSelect
                          :id="`select-kompon-tube-bom-${gIdx}`"
                          :value="selectedTubeMaterialKey"
                          :options="tubeMaterialOptions"
                          display-field="nama_item"
                          value-field="id"
                          placeholder="-- Pilih Kompon Tube --"
                          :display-value="selectedTubeMaterialDisplay"
                          :disabled="loading || locked"
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
                          :id="`select-kompon-covertube-bom-${gIdx}`"
                          :value="selectedCoverTubeMaterialKey"
                          :options="coverTubeMaterialOptions"
                          display-field="nama_item"
                          value-field="id"
                          placeholder="-- Pilih Kompon Cover Tube --"
                          :display-value="selectedCoverTubeMaterialDisplay"
                          :disabled="loading || locked"
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
                          :id="`select-kompon-cover-bom-${gIdx}`"
                          :value="selectedCoverMaterialKey"
                          :options="coverMaterialOptions"
                          display-field="nama_item"
                          value-field="id"
                          placeholder="-- Pilih Kompon Cover --"
                          :display-value="selectedCoverMaterialDisplay"
                          :disabled="loading || locked"
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
                          :id="`select-kompon-rod-bom-${gIdx}`"
                          :value="selectedRodMaterialKey"
                          :options="rodMaterialOptions"
                          display-field="nama_item"
                          value-field="id"
                          placeholder="-- Pilih Material Rigid Rod --"
                          :display-value="selectedRodMaterialDisplay"
                          :disabled="loading || locked"
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
                          :id="`select-kompon-spring-bom-${gIdx}`"
                          :value="selectedSpringMaterialKey"
                          :options="springMaterialOptions"
                          display-field="nama_item"
                          value-field="id"
                          placeholder="-- Pilih Kawat Baja Spring --"
                          :display-value="selectedSpringMaterialDisplay"
                          :disabled="loading || locked"
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
                          :id="`select-kompon-yarn-bom-${gIdx}`"
                          :value="selectedYarnMaterialKey"
                          :options="yarnMaterialOptions"
                          display-field="nama_item"
                          value-field="id"
                          placeholder="-- Pilih Benang Yarn --"
                          :display-value="selectedYarnMaterialDisplay"
                          :disabled="loading || locked"
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
                        :disabled="gIdx === 0 || locked"
                        @click="moveLayerUp(gIdx)"
                        class="h-7 w-7 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-muted disabled:opacity-25 disabled:pointer-events-none transition-colors border-r border-slate-200 dark:border-border"
                        title="Pindahkan urutan layer ini ke atas">
                        <ChevronUp class="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        :disabled="gIdx === layerGroups.length - 1 || locked"
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
                          v-if="!isReadOnly && !locked"
                          :draggable="!isReadOnly && !locked"
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
                            @input="(v) => (p.nama_parameter = v)"
                            @update:valueFull="(item) => onParamChangeInGroup(p, p.nama_parameter, item, grp)"
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

                      <!-- 1 BARIS AJA: VALUE + SATUAN -->
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

                        <!-- Dropdown Satuan (UOM) di sebelah kanan dalam 1 baris -->
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
                            @input="(v) => onParamUomChange(p, v)"
                            @update:valueFull="(item) => onParamUomChange(p, p.satuan, item)"
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

          <!-- ============ RINGKASAN HASIL KALKULASI (MINIMALIS & TIDAK BERLEBIHAN) ============ -->
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

            <!-- 2 Kartu Ringkasan Hasil Utama (Total Berat/M & Total HPP/M) -->
            <div v-if="totalHoseWeightPerMeter > 0 || totalHoseCostExcludePerMeter > 0"
              class="border border-emerald-200 dark:border-emerald-800/50 rounded-lg bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5">
              <div class="flex items-center justify-between pb-2 mb-2.5 border-b border-emerald-200/60 dark:border-emerald-800/40">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span class="text-[12px] font-bold text-emerald-950 dark:text-emerald-200">
                    Ringkasan Hasil Kalkulasi
                  </span>
                  <span class="text-[10px] text-slate-500 dark:text-slate-400">
                    (Nilai sudah otomatis dimasukkan ke kolom parameter layer di atas)
                  </span>
                </div>
                <button type="button" @click="showCalculationPanel = false" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[11px]">
                  Tutup &times;
                </button>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <!-- 1. Total Berat / UOM Header -->
                <div class="bg-white dark:bg-card border border-emerald-200/80 dark:border-emerald-900/60 rounded-md p-2.5 flex items-center justify-between">
                  <div>
                    <div class="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">
                      Total Berat Selang
                    </div>
                    <div class="text-[18px] font-black text-slate-900 dark:text-slate-100 tabular-nums">
                      {{ totalHoseWeightPerMeter.toFixed(4) }} <span class="text-[11px] font-normal text-slate-500">kg/{{ headerUomShort }}</span>
                    </div>
                    <div class="text-[9.5px] text-slate-400 font-mono">
                      Tube: {{ tubeDim.weight.toFixed(3) }} | Cover: {{ coverDim.weight.toFixed(3) }} | Yarn: {{ yarnDim.weight.toFixed(3) }}
                    </div>
                  </div>
                  <div class="p-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-md shrink-0">
                    <Scale class="h-4 w-4" />
                  </div>
                </div>

                <!-- 2. Total HPP / UOM Header (Exclude) -->
                <div class="bg-white dark:bg-card border border-purple-200/80 dark:border-purple-900/60 rounded-md p-2.5 flex items-center justify-between">
                  <div>
                    <div class="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-400 tracking-wider">
                      HPP Material{{ headerUomName ? ' / ' + headerUomName : '' }}
                    </div>
                    <div class="text-[18px] font-black text-purple-900 dark:text-purple-200 tabular-nums">
                      Rp {{ totalHoseCostExcludePerMeter.toLocaleString('id-ID') }}
                    </div>
                    <div class="text-[9.5px] text-purple-600 dark:text-purple-400 font-mono">
                      Inc PPN 11%: Rp {{ totalHoseCostIncludePerMeter.toLocaleString('id-ID') }}
                    </div>
                    <div class="text-[9px] text-slate-400 font-mono mt-0.5">
                      Tube: Rp {{ tubeDim.cost.toLocaleString('id-ID') }} | Cover: Rp {{ coverDim.cost.toLocaleString('id-ID') }} | Yarn: Rp {{ yarnDim.cost.toLocaleString('id-ID') }}
                    </div>
                  </div>
                  <div class="p-2 bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 rounded-md shrink-0">
                    <Calculator class="h-4 w-4" />
                  </div>
                </div>

                <!-- 3. Info SG Compound & Harga BB -->
                <div v-if="isTypeSpesifik" class="bg-white dark:bg-card border border-blue-200/80 dark:border-blue-900/60 rounded-md p-2.5 flex items-center justify-between">
                  <div>
                    <div class="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400 tracking-wider">
                      Kompon Tube & Cover
                    </div>
                    <div class="text-[10.5px] text-slate-700 dark:text-slate-300 font-mono mt-0.5">
                      Tube: SG {{ formulaSgTube }} | Rp {{ Number(formulaHargaTube).toLocaleString('id-ID') }}/kg
                    </div>
                    <div class="text-[10.5px] text-slate-700 dark:text-slate-300 font-mono">
                      Cover: SG {{ formulaSgCover }} | Rp {{ Number(formulaHargaCover).toLocaleString('id-ID') }}/kg
                    </div>
                  </div>
                  <div class="p-2 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-md shrink-0">
                    <FileSpreadsheet class="h-4 w-4" />
                  </div>
                </div>
                <div v-else-if="sgCompound > 0 || hargaPerKgCompound > 0" class="bg-white dark:bg-card border border-blue-200/80 dark:border-blue-900/60 rounded-md p-2.5 flex items-center justify-between">
                  <div>
                    <div class="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400 tracking-wider">
                      Kompon Compound
                    </div>
                    <div class="text-[14px] font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                      SG: {{ sgCompound }} <span class="text-[10px] font-normal text-slate-500">kg/dm³</span>
                    </div>
                    <div class="text-[10px] text-blue-700 dark:text-blue-300 font-medium">
                      Rp {{ hargaPerKgCompound.toLocaleString('id-ID') }}/kg
                    </div>
                  </div>
                  <div class="p-2 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-md shrink-0">
                    <FileSpreadsheet class="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>

          </div>



        </TabsContent>


        <!-- ================================================================ -->
        <!-- REKAP TOTAL DI BAWAH TABEL (PERSIS GAMBAR) -->
        <!-- ================================================================ -->
        <div class="pt-2 pb-2 w-[300px] border border-slate-200 dark:border-border rounded-lg overflow-hidden bg-white dark:bg-card mt-6 shadow-sm">
          <div class="flex justify-between items-center text-[13px] px-4 py-2 border-b border-slate-100 dark:border-border">
            <span class="text-slate-700 dark:text-slate-300">Total Kg Main Material</span>
            <span class="font-bold text-slate-900 dark:text-slate-100">{{ totalKgMaterial }} KG</span>
          </div>
          <div class="flex justify-between items-center text-[13px] px-4 py-2 border-b border-slate-100 dark:border-border">
            <span class="text-slate-700 dark:text-slate-300">Total Menit</span>
            <span class="font-bold text-slate-900 dark:text-slate-100">{{ totalMenit }} Menit</span>
          </div>
          <div class="flex justify-between items-center text-[13px] px-4 py-2 border-b border-slate-100 dark:border-border">
            <span class="text-slate-700 dark:text-slate-300">Total Overhead Cost</span>
            <span class="font-bold text-slate-900 dark:text-slate-100">Rp {{ totalOverhead.toLocaleString('id-ID') }}</span>
          </div>
          <div class="flex justify-between items-center text-[13px] px-4 py-2 border-b border-slate-100 dark:border-border">
            <span class="text-slate-700 dark:text-slate-300">Total Harga BB</span>
            <span class="font-bold text-amber-700 dark:text-amber-400">Rp {{ formatRupiahNumber(totalHargaBB) }}</span>
          </div>
          <div v-if="sgCompound > 0" class="flex justify-between items-center text-[13px] px-4 py-2 border-b border-slate-100 dark:border-border">
            <span class="text-slate-700 dark:text-slate-300">SG Compound</span>
            <span class="font-bold text-emerald-700 dark:text-emerald-400">{{ formatCommaNumber(sgCompound, 2) }} kg/dm³</span>
          </div>
          <div class="flex justify-between items-center text-[13px] px-4 py-2">
            <span class="text-slate-700 dark:text-slate-300">Total Labor Cost</span>
            <span class="font-bold text-slate-900 dark:text-slate-100">Rp {{ totalLabor.toLocaleString('id-ID') }}</span>
          </div>
        </div>
      </Tabs>



      <!-- ================================================================ -->
      <!-- BOTTOM ACTION BAR (PERSIS GAMBAR) -->
      <!-- ================================================================ -->
      <!-- <div class="flex flex-col gap-4 pb-12 mt-2">
    <div class="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-6 py-3.5 shadow-sm">
      <div class="text-[13px] text-gray-700 font-normal">
        Created By admin On 1/16/2026 8:42:53 AM
      </div>
      
      <AuditInfo
        v-if="isViewMode || isEditMode"
        :created-by="auditMeta.created_by"
        :created-at="auditMeta.createdAt"
        :updated-by="auditMeta.updated_by"
        :updated-at="auditMeta.updatedAt"
        class="mt-6"
      />

      <div class="flex items-center gap-3">
        <Button type="button" variant="outline" @click="handleCancel" :disabled="loading"
          class="h-8 px-5 text-[13px] border-gray-300 text-gray-700 font-normal bg-white hover:bg-gray-50 rounded-md shadow-sm">
          Batal
        </Button>
        
        <Button type="button" @click="onSave" :disabled="loading"
          class="gap-1.5 h-8 px-5 text-[13px] font-medium bg-[#38a169] hover:bg-[#2f855a] text-white border-0 rounded-md shadow-sm">
          <Loader2 v-if="loading" class="h-3.5 w-3.5 animate-spin" />
          <Save v-else class="h-3.5 w-3.5" />
          Simpan
        </Button>
      </div>
    </div>


    <div class="flex justify-between text-[11px] text-gray-500 px-2 font-normal">
      <span>
        Copyright © 2026
        <span class="text-blue-600 cursor-pointer hover:underline">Quantum Leap</span>. All rights reserved.
      </span>
      <span>Working Together, Growing Together</span>
    </div>
  </div> -->
      
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
    <!-- DIALOG: TAMBAH MATERIAL DARI PRE-COSTING -->
    <!-- ================================================================ -->
    <Dialog v-model:open="precostDialogOpen">
      <DialogContent class="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Tambah Material dari Pre-Costing</DialogTitle>
          <DialogDescription>
            Pilih material dari Pre-Costing<template v-if="values.t_precost?.no">&nbsp;{{ values.t_precost.no }}</template>&nbsp;untuk Routing #{{ (precostTargetIdx ?? 0) + 1 }}
          </DialogDescription>
        </DialogHeader>

        <DataTableMultiSelect
          :data="availablePrecostDetails"
          :columns="[
            { field: 'kode', label: 'Kode', width: '130px', render: (item: any) => item?.m_item?.kode_item || '-' },
            { field: 'nama', label: 'Nama Material', width: '240px', render: (item: any) => item?.m_item?.nama_item || '-' },
            { field: 'tipe', label: 'Tipe', width: '150px', render: (item: any) => item?.item_type_precost?.value1 || '-' },
            { field: 'qty', label: 'Qty', width: '70px', sortable: true, render: (item: any) => item?.qty ?? 0 },
            { field: 'uom', label: 'UoM', width: '80px', render: (item: any) => item?.unit_precost?.value1 || item?.m_item?.mi_uom?.value1 || '-' },
            { field: 'is_main', label: 'Main', width: '60px', render: (item: any) => (item?.is_main ? 'Ya' : '-') },
          ]"
          :loading="precostDetailsLoading"
          :has-more="false"
          max-height="400px"
          @selection-change="onPrecostSelectionChange"
        />

        <div
          v-if="!precostDetailsLoading && availablePrecostDetails.length === 0"
          class="text-center text-sm text-muted-foreground py-4 border border-dashed rounded-md"
        >
          Semua material Pre-Costing sudah ditambahkan ke routing ini.
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="precostDialogOpen = false">
            Batal
          </Button>
          <Button type="button" @click="confirmAddPrecostMaterials" :disabled="selectedPrecostRows.length === 0">
            Tambah
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
}

input[type="checkbox"] {
  accent-color: #3b82f6;
}
</style>
