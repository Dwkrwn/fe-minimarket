<script setup lang="ts">
import AuditInfo from '@/components/AuditInfo.vue';
const auditMeta = ref<any>({});

// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { toast } from 'vue-sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FieldX, FieldSelect, FieldStatus, FieldPopup } from '@/components/field';
import { apiCall } from '@/lib/api';
import { ButtonMultiSelect } from '@/components/button';
import { DeleteButton } from '@/components/button';
import { ArrowLeft, Save, Loader2, Plus, ChevronRight, ChevronDown, Trash2 } from 'lucide-vue-next';
import { useApi } from '@/composables/useApi';
import { useAuthStore } from '@/stores/auth';
import { createWoWip, updateWoWip, getWoWipById, type WoWipItemDetail as WoItemDetail, type WoWipItemRouting as WoItemRouting, type WoWipItemMaterial as WoItemMaterial } from './service';
import GlobalDialog from '@/components/dialog/GlobalDialog.vue';
import { getWoById } from '../t_wo/service';
import { usePermission } from '@/composables/usePermission';

// ============================================================================
// SETUP
// ============================================================================
const authStore = useAuthStore();
const { isSuperAdmin } = usePermission();
const { API_BASE_URL } = useApi();
const router = useRouter();
const route = useRoute();

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false);
const tipeItemMap = ref<Record<string, string>>({});
const isEditMode = computed(() => !!route.params.id && route.name === 'WoWipForm');
const isViewMode = computed(() => route.name === 'WoWipView');
const isCopyMode = computed(() => route.query.copy !== undefined || (route.query.action === 'copy' && !!route.query.source));
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true || ['POST', 'CONFIRM', 'APPROVED', 'IN APPROVAL', 'REJECT'].includes((values.status || '').toUpperCase()));
const menuId = computed(() => route.params.id as string);

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Work Order WIP';
  if (isCopyMode.value) return 'Salin Wo Wip';
  if (isEditMode.value) return 'Edit Work Order WIP';
  return 'Tambah Work Order WIP Baru';
});

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Wo Wip';
  if (isCopyMode.value) return 'Buat Wo Wip baru dari data yang disalin';
  if (isEditMode.value) return 'Perbarui data Work Order WIP';
  return 'Buat Wo Wip baru';
});

const getTodayDateString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Helper formatting datetime untuk input datetime-local (YYYY-MM-DDTHH:mm)
const toDateTimeLocalValue = (val?: string | Date | null): string => {
  if (!val) return '';
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return `${trimmed}T08:00`;
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }
  const d = typeof val === 'string' ? new Date(val) : val;
  if (!d || isNaN(d.getTime())) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

// Format tampilan tanggal + jam menit untuk mode readonly / tabel (DD/MM/YYYY HH:mm)
const formatDateTimeDisplay = (val?: string | null): string => {
  if (!val) return '-';
  const dtStr = toDateTimeLocalValue(val);
  if (!dtStr) return String(val);
  const [datePart, timePart] = dtStr.split('T');
  if (!datePart || !timePart) return String(val);
  const [yyyy, mm, dd] = datePart.split('-');
  return `${dd}/${mm}/${yyyy} ${timePart}`;
};

// Hitung Plan End = Plan Start + time (menit) dari detail BOM
const calcPlanFinish = (planStart: string, timeMinutes: number | string): string => {
  if (!planStart) return '';
  const minutes = Number(timeMinutes || 0);
  const normalizedStart = toDateTimeLocalValue(planStart);
  if (!normalizedStart) return '';
  const [datePart, timePart] = normalizedStart.split('T');
  const [yyyy, mm, dd] = datePart.split('-').map(Number);
  const [hh, min] = timePart.split(':').map(Number);
  const start = new Date(yyyy, mm - 1, dd, hh, min, 0);
  if (isNaN(start.getTime())) return '';
  start.setMinutes(start.getMinutes() + minutes);
  return toDateTimeLocalValue(start);
};

// Durasi dalam menit asli sesuai BOM / routing / selisih plan start & finish
const routingDurasiMenit = (r: any): number => {
  const time = Number(r?.time || 0);
  if (time > 0) return time;
  const speed = Number(r?.speed || 0);
  const qty = Number(r?.qty || 0);
  if (speed > 0) {
    return Math.round(qty / speed);
  }
  if (r?.plan_start && r?.plan_finish) {
    const start = new Date(r.plan_start).getTime();
    const finish = new Date(r.plan_finish).getTime();
    if (!isNaN(start) && !isNaN(finish) && finish > start) {
      return Math.round((finish - start) / 60000);
    }
  }
  return 0;
};

// Penjelas durasi dalam jam: ≈ X Jam
const routingDurasiJamText = (r: any): string => {
  const minutes = routingDurasiMenit(r);
  if (minutes <= 0) return '≈ 0 Jam';
  const jam = minutes / 60;
  const formattedJam = jam.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `≈ ${formattedJam} Jam`;
};

// Durasi (jam) fallback kompatibilitas
const routingDurasiJam = (r: any): string => {
  const minutes = routingDurasiMenit(r);
  if (minutes <= 0) return '0';
  const jam = minutes / 60;
  return jam % 1 === 0 ? String(jam) : jam.toFixed(2);
};

// Penjelas speed mesin dalam jam: ≈ X Jam
const routingSpeedJamText = (r: any): string => {
  const speed = Number(r?.speed || 0);
  if (speed <= 0) return '≈ 0 Jam';
  const speedJam = speed / 60;
  const formattedSpeed = speedJam.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `≈ ${formattedSpeed} Jam`;
};

// Form values matching backend schema
const values = reactive({
  no: '',
  date: getTodayDateString(),
  m_unit_bisnis_id: '',
  flag: 'WIP',
  wo_ref_id: '',
  ref_type: 't_io',
  ref_so_id: '',
  ref_io_id: '',
  m_customer_id: '',
  notes: '',
  status: 'DRAFT',
});

const soColumns = [
  { field: 'no', headerName: 'No. SO', width: '200px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'date', headerName: 'Tgl SO', width: '120px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'customer', headerName: 'Customer', width: '200px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'grand_total', headerName: 'Grand Total', width: '150px', sortable: true },
  { field: 'status', headerName: 'Status', width: '120px', sortable: true },
];

const ioColumns = [
  { field: 'no', headerName: 'No. Internal Order', width: '200px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'date', headerName: 'Date', width: '120px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'm_kary.nama_kary', headerName: 'PIC', width: '180px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'notes', headerName: 'Notes', width: '200px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'status', headerName: 'Status', width: '120px', sortable: true },
];

const itemColumns = [
  { field: 'kode_item', headerName: 'Kode Material', width: '180px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'nama_item', headerName: 'Nama Material', width: '220px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'qty_so_ots', headerName: 'Qty', width: '100px', sortable: true },
];

const bomColumns = [
  { field: 'no', headerName: 'No. BOM', width: '160px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'm_item.kode_item', headerName: 'Kode Item', width: '140px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'm_item.nama_item', headerName: 'Nama Item', width: '220px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'qty', headerName: 'Qty', width: '80px', sortable: true },
  { field: 'm_general.value1', headerName: 'Unit', width: '80px', sortable: true },
  { field: 'notes', headerName: 'Notes', width: '180px', sortable: true, filterable: true, filter: 'ColFilter' },
];

const woRefColumns = [
  { field: 'no', headerName: 'No. WO', width: '200px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'date', headerName: 'Date', width: '120px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'status', headerName: 'Status', width: '120px', sortable: true },
];

// Parent company display state
const selectedUnitBisnisCompanyName = ref<string>('');

const handleUnitBisnisSelected = (item: any) => {
  selectedUnitBisnisCompanyName.value = item?.m_company?.nama || item?.m_company?.kode || '';
};

const handleWoRefSelected = async (item: any) => {
  if (!item) {
    values.ref_type = 't_io';
    values.ref_so_id = '';
    values.ref_io_id = '';
    values.m_customer_id = '';
    (values as any).t_io = null;
    (values as any).t_sales_order = null;
    (values as any).m_customer = null;
    (values as any).wo_ref = null;
    return;
  }

  values.ref_type = item.ref_type || 't_io';
  if (item.ref_type === 't_sales_order') {
    values.ref_so_id = item.wo_ref_id || item.ref_so_id || '';
    values.ref_io_id = '';
  } else if (item.ref_type === 't_io') {
    values.ref_io_id = item.wo_ref_id || item.ref_io_id || '';
    values.ref_so_id = '';
  } else {
    values.ref_so_id = item.ref_so_id || '';
    values.ref_io_id = item.ref_io_id || '';
  }
  values.m_customer_id = item.m_customer_id || '';

  try {
    loading.value = true;
    const res = await getWoById(item.id);
    if (res.status === 'success') {
      (values as any).wo_ref = res.data;
      (values as any).t_io = (res.data as any).t_io || null;
      (values as any).t_sales_order = (res.data as any).t_sales_order || null;
      (values as any).m_customer = (res.data as any).m_customer || null;
      (values as any).m_unit_bisni = (res.data as any).m_unit_bisni || null;
    }
  } catch (error) {
    console.error('Failed to load parent WO details:', error);
  } finally {
    loading.value = false;
  }
};

const handleRefTypeChange = (newType: string) => {
  values.ref_type = newType;
  values.ref_so_id = '';
  values.ref_io_id = '';
  values.m_customer_id = '';
};

const fetchUnitBisnisCompanyName = async (unitBisnisId: string) => {
  if (!unitBisnisId) {
    selectedUnitBisnisCompanyName.value = '';
    return;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/dynamic/m_unit_bisnis/${unitBisnisId}?join=true`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
    });
    const result = await response.json();
    if (result?.status === 'success' && result.data) {
      selectedUnitBisnisCompanyName.value = result.data?.m_company?.nama || result.data?.m_company?.kode || '-';
    }
  } catch (err) {
    console.error('Gagal mengambil nama company:', err);
  }
};

const isUnitBisnisReadonly = computed(() => {
  return !isSuperAdmin.value || isEditMode.value || isViewMode.value;
});

const getSelectRespoData = () => {
  try {
    const raw = localStorage.getItem('SelectRespo');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse SelectRespo:', err);
    return null;
  }
};

const applyCurrentUserUnitBisnis = () => {
  if (isSuperAdmin.value) return;
  const selectRespo = getSelectRespoData();
  const ubId = selectRespo?.companyId || selectRespo?.m_unit_bisnis_id || selectRespo?.unitBisnisId || '';
  if (ubId) {
    values.m_unit_bisnis_id = String(ubId);
    fetchUnitBisnisCompanyName(String(ubId));
  }
};

// Temp penampung data API mentah
let initialValues: Record<string, any> = {};

// Detail arrays
const detailArr = ref<WoItemDetail[]>([]);

watch(
  () => detailArr.value,
  (newDetailArr) => {
    if (!newDetailArr) return;
    newDetailArr.forEach((item) => {
      (item.t_wo_sd_routings || []).forEach((routing) => {
        // Auto-calc plan_finish = plan_start + time (menit) untuk routing BOM
        if (routing.is_bom && routing.plan_start) {
          routing.plan_finish = calcPlanFinish(routing.plan_start, routing.time || 0);
        }

        (routing.t_wo_sd_materials || []).forEach((material) => {
          const qty = Number(material.qty || 0);
          const beratBersih = Number(material.m_item?.berat_bersih ?? 0);
          const pct = Number(material.waste_pct || 0);

          // Weight = qty * m_item.berat_bersih
          const calculatedWeight = qty * beratBersih;
          material.weight = isNaN(calculatedWeight) ? 0 : Number(calculatedWeight.toFixed(2));

          // waste_qty = qty * waste_pct / 100
          const calculatedWaste = (qty * pct) / 100;
          material.waste_qty = isNaN(calculatedWaste) ? 0 : Number(calculatedWaste.toFixed(2));
        });
      });
    });
  },
  { deep: true },
);

// Inline Accordion Expand States
const expandedItemIdx = ref<number | null>(null);
const expandedRoutingIdx = ref<number | null>(null);

// Inline search filters
const searchItemQuery = ref('');
const searchRoutingQuery = ref('');
const searchMaterialQuery = ref('');

const filteredDetailItems = computed(() => {
  if (!searchItemQuery.value) return detailArr.value;
  const q = searchItemQuery.value.toLowerCase();
  return detailArr.value.filter((row) => {
    const code = (row.m_item?.kode_item || row.m_item?.kode || '').toLowerCase();
    const name = (row.m_item?.nama_item || row.m_item?.nama || '').toLowerCase();
    const bomCode = (row.m_bom?.no || row.m_bom_id || '').toLowerCase();
    return code.includes(q) || name.includes(q) || bomCode.includes(q);
  });
});

const getFilteredRoutings = (row: any) => {
  if (!searchRoutingQuery.value) return row.t_wo_sd_routings || [];
  const q = searchRoutingQuery.value.toLowerCase();
  return (row.t_wo_sd_routings || []).filter((r: any) => {
    const routeName = (r.m_routing?.nama || r.m_routing_id || '').toLowerCase();
    const nextRouteName = (r.to_routing?.nama || r.to_routing_id || '').toLowerCase();
    const machineName = (r.m_machine?.nama || r.m_machine_id || '').toLowerCase();
    const outputType = (r.output_type || '').toLowerCase();
    return routeName.includes(q) || nextRouteName.includes(q) || machineName.includes(q) || outputType.includes(q);
  });
};

const getFilteredMaterials = (rRow: any) => {
  if (!searchMaterialQuery.value) return rRow.t_wo_sd_materials || [];
  const q = searchMaterialQuery.value.toLowerCase();
  return (rRow.t_wo_sd_materials || []).filter((m: any) => {
    const matName = (m.m_item?.nama_item || m.m_item_id || '').toLowerCase();
    const type = (m.as_type_sd_wo?.value1 || m.item_type_label || m.item_type_id || '').toLowerCase();
    return matName.includes(q) || type.includes(q);
  });
};

const routingMaterialTotals = (rRow: any) => {
  const rows = getFilteredMaterials(rRow);
  let qty = 0;
  let waste = 0;
  let final = 0;
  for (const m of rows) {
    qty += Number(m.qty) || 0;
    waste += Number(m.waste_qty) || 0;
    final += Number(m.qty || 0) + Number(m.waste_qty || 0);
  }
  return { qty: Number(qty.toFixed(2)), waste: Number(waste.toFixed(2)), final: Number(final.toFixed(2)) };
};

const getOriginalItemIdx = (row: WoItemDetail) => {
  return detailArr.value.indexOf(row);
};

const getOriginalRoutingIdx = (row: WoItemDetail, rRow: any) => {
  return (row.t_wo_sd_routings || []).indexOf(rRow);
};

const getOriginalMaterialIdx = (rRow: any, mRow: any) => {
  return (rRow.t_wo_sd_materials || []).indexOf(mRow);
};

const toggleItemExpand = (idx: number) => {
  if (expandedItemIdx.value === idx) {
    expandedItemIdx.value = null;
    expandedRoutingIdx.value = null;
  } else {
    expandedItemIdx.value = idx;
    expandedRoutingIdx.value = null;
  }
};

const toggleRoutingExpand = (rIdx: number) => {
  if (expandedRoutingIdx.value === rIdx) {
    expandedRoutingIdx.value = null;
  } else {
    expandedRoutingIdx.value = rIdx;
  }
};

// Inline additions
const addRoutingRowInline = (itemIdx: number) => {
  const item = detailArr.value[itemIdx];
  if (!item) return;
  if (!item.t_wo_sd_routings) {
    item.t_wo_sd_routings = [];
  }
  item.t_wo_sd_routings.push({
    sequence: item.t_wo_sd_routings.length + 1,
    m_routing_id: '',
    to_routing_id: '',
    is_final: false,
    m_machine_id: '',
    speed: 0,
    qty: 0,
    output_type: '',
    m_item_id: '',
    is_bom: false,
    time: 0,
    plan_start: '',
    plan_finish: '',
    real_start: '',
    real_finish: '',
    qty_result: 0,
    notes: '',
    t_wo_sd_materials: [],
  });
  expandedRoutingIdx.value = item.t_wo_sd_routings.length - 1;
};

const getSelectedRoutingIds = (row: WoItemDetail) => {
  return (row.t_wo_sd_routings || []).map((r: any) => r.m_routing_id).filter(Boolean);
};

const handleRoutingSelected = (mRouting: any, rRow: any) => {
  if (mRouting) {
    if (mRouting.m_routing_d_mesins && mRouting.m_routing_d_mesins.length > 0) {
      rRow.m_machine_id = mRouting.m_routing_d_mesins[0].m_mesin_id || '';
    } else {
      rRow.m_machine_id = '';
    }
  }
};

const handleWipItemFullSelected = (item: any, rRow: any) => {
  if (item) {
    rRow.m_item_id = item.id;
    rRow.output_type = item.tipe_id || item.mi_tipe?.id || item.m_general?.id || '';
    rRow.output_type_label = item.mi_tipe?.value1 || tipeItemMap.value[rRow.output_type || ''] || '';
    rRow.unit_id = item.uom_id || '';
  } else {
    rRow.m_item_id = '';
    rRow.output_type = '';
    rRow.output_type_label = '';
    rRow.unit_id = '';
  }
};

const handleMaterialSelected = (item: any, mRow: any) => {
  if (item) {
    mRow.m_item = item;
    mRow.m_item_id = item.id;
    mRow.item_type_id = item.tipe_id || item.mi_tipe?.id || item.m_general?.id || '';
    mRow.item_type_label = item.mi_tipe?.value1 || tipeItemMap.value[mRow.item_type_id || ''] || '';
  } else {
    mRow.m_item = null;
    mRow.m_item_id = '';
    mRow.item_type_id = '';
    mRow.item_type_label = '';
  }
  fetchMaterialStock(mRow);
};

// Ambil total stok item di SEMUA gudang (jumlah free_stock per gudang),
// lalu isi qty_stock pada baris material.
const fetchMaterialStock = async (mRow: any) => {
  const itemId = mRow?.m_item_id;
  if (!itemId) {
    mRow.qty_stock = undefined;
    return;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/fn/m_gudang/getFreeStock?m_item_id=${encodeURIComponent(itemId)}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
    });
    const result = await response.json();
    const rows = Array.isArray(result?.data) ? result.data : [];
    const total = rows.reduce((sum: number, r: any) => sum + Number(r?.free_stock || 0), 0);
    mRow.qty_stock = total;
  } catch (err) {
    console.error('Gagal mengambil stok material:', err);
    mRow.qty_stock = undefined;
  }
};

// Scan semua baris material yang belum punya stok dan muat stoknya.
const refreshMaterialStock = async () => {
  const pending: any[] = [];
  detailArr.value.forEach((item) => {
    (item.t_wo_sd_routings || []).forEach((routing) => {
      (routing.t_wo_sd_materials || []).forEach((material) => {
        if (material.m_item_id && material.qty_stock === undefined) {
          pending.push(material);
        }
      });
    });
  });
  await Promise.all(pending.map((m) => fetchMaterialStock(m)));
};

const addSelectedRoutings = (itemIdx: number, selected: any[]) => {
  const item = detailArr.value[itemIdx];
  if (!item) return;
  if (!item.t_wo_sd_routings) {
    item.t_wo_sd_routings = [];
  }
  const routings = item.t_wo_sd_routings;
  selected.forEach((mRouting) => {
    let autoMachineId = '';
    if (mRouting.m_routing_d_mesins && mRouting.m_routing_d_mesins.length > 0) {
      autoMachineId = mRouting.m_routing_d_mesins[0].m_mesin_id || '';
    }

    routings.push({
      sequence: routings.length + 1,
      m_routing_id: mRouting.id,
      to_routing_id: '',
      is_final: false,
      m_machine_id: autoMachineId,
      speed: 0,
      qty: 0,
      output_type: '',
      m_item_id: '',
      is_bom: false,
      time: 0,
      plan_start: '',
      plan_finish: '',
      real_start: '',
      real_finish: '',
      qty_result: 0,
      notes: '',
      m_routing: {
        id: mRouting.id,
        nama: mRouting.name || mRouting.nama || '',
        kode: mRouting.code || mRouting.kode || '',
      },
      t_wo_sd_materials: [],
    });
  });
  if (routings.length > 0) {
    expandedRoutingIdx.value = routings.length - 1;
  }
};

const removeRoutingRowInline = (itemIdx: number, rIdx: number) => {
  const item = detailArr.value[itemIdx];
  if (!item || !item.t_wo_sd_routings) return;
  item.t_wo_sd_routings.splice(rIdx, 1);
  item.t_wo_sd_routings.forEach((r, i) => {
    r.sequence = i + 1;
  });
  if (expandedRoutingIdx.value === rIdx) {
    expandedRoutingIdx.value = null;
  } else if (expandedRoutingIdx.value !== null && expandedRoutingIdx.value > rIdx) {
    expandedRoutingIdx.value--;
  }
  toast.info('Langkah routing dihapus');
};

const addMaterialRowInline = (itemIdx: number, routingIdx: number) => {
  const item = detailArr.value[itemIdx];
  if (!item) return;
  const routing = item.t_wo_sd_routings?.[routingIdx];
  if (!routing) return;
  if (!routing.t_wo_sd_materials) {
    routing.t_wo_sd_materials = [];
  }
  routing.t_wo_sd_materials.push({
    sequence: routing.t_wo_sd_materials.length + 1,
    item_type_id: '',
    m_item_id: '',
    is_main: false,
    qty: 0,
    unit_id: '',
    weight: 0,
    waste_pct: 0,
    waste_qty: 0,
    qty_request: 0,
    qty_stock: undefined,
    notes: '',
  });
};

const removeMaterialRowInline = (itemIdx: number, routingIdx: number, mIdx: number) => {
  const item = detailArr.value[itemIdx];
  if (!item) return;
  const routing = item.t_wo_sd_routings?.[routingIdx];
  if (!routing || !routing.t_wo_sd_materials) return;
  routing.t_wo_sd_materials.splice(mIdx, 1);
  routing.t_wo_sd_materials.forEach((m, i) => {
    m.sequence = i + 1;
  });
  toast.info('Material kebutuhan dihapus');
};

// References Handlers
const handleRefSoSelected = (item: any) => {
  if (item) {
    values.m_customer_id = item.m_customer_id || item.customer_id || '';
  }
};

const handleRefIoSelected = (item: any) => {
  if (item) {
    values.m_customer_id = item.m_customer_id || item.customer_id || '';
  }
};

const itemOptions = computed(() => {
  const parentWo = (values as any).wo_ref;
  if (!parentWo || !Array.isArray(parentWo.t_wo_d_items)) return [];
  return parentWo.t_wo_d_items.map((d: any) => {
    const itemObj = d.m_item || d.m_items || {};
    return {
      id: itemObj.id,
      kode_item: itemObj.kode_item,
      nama_item: itemObj.nama_item,
      uom_id: itemObj.uom_id,
      tipe_id: itemObj.tipe_id,
      displayLabel: `${itemObj.kode_item || '-'} - ${itemObj.nama_item || '-'}`,
      qty_so_ots: d.qty || 0,
      originalDetail: d,
    };
  });
});

const selectedItemId = computed({
  get: () => detailArr.value[0]?.m_item_id || '',
  set: (val: string) => {},
});

const handleItemDropdownSelected = (item: any) => {
  if (!item) {
    detailArr.value = [];
    return;
  }

  const parentWo = (values as any).wo_ref;
  const matchingDetail = parentWo?.t_wo_d_items?.find((d: any) => d.m_item_id === item.id || d.id === item.id) || item.originalDetail;

  detailArr.value = [
    {
      m_item_id: item.id,
      m_item: {
        id: item.id,
        kode_item: item.kode_item,
        nama_item: item.nama_item,
        uom_id: item.uom_id,
        tipe_id: item.tipe_id,
      },
      m_bom_id: matchingDetail?.m_bom_id || '',
      m_bom: matchingDetail?.m_bom || null,
      qty: matchingDetail?.qty || item.qty_so_ots || 0,
      unit_id: item.uom_id || '',
      item_type_id: item.tipe_id || '',
      qty_accum: item.qty_so_ots || 0,
      finish_date: matchingDetail?.finish_date || '',
      notes: matchingDetail?.notes || '',
      t_wo_sd_routings: Array.isArray(matchingDetail?.t_wo_sd_routings)
        ? matchingDetail.t_wo_sd_routings.map((r: any) => ({
            sequence: r.sequence,
            m_routing_id: r.m_routing_id,
            to_routing_id: r.to_routing_id,
            is_final: r.is_final,
            m_machine_id: r.m_machine_id,
            speed: r.speed,
            output_type: r.output_type,
            output_type_label: tipeItemMap.value[r.output_type || ''] || '',
            m_item_id: r.m_item_id,
            qty: r.qty,
            unit_id: r.unit_id,
            is_bom: r.is_bom || false,
            time: r.time || 0,
            plan_start: r.plan_start,
            plan_finish: r.plan_finish,
            notes: r.notes,
            m_routing: r.m_routing || null,
            to_routing: r.to_routing || null,
            m_mesin: r.m_mesin || r.m_machine || null,
            m_machine: r.m_machine || r.m_mesin || null,
            t_wo_sd_materials: Array.isArray(r.t_wo_sd_materials)
              ? r.t_wo_sd_materials.map((m: any) => ({
                  sequence: m.sequence,
                  item_type_id: m.item_type_id,
                  m_item_id: m.m_item_id,
                  is_main: m.is_main,
                  qty: m.qty,
                  unit_id: m.unit_id,
                  weight: m.weight,
                  waste_pct: m.waste_pct,
                  waste_qty: m.waste_qty,
                  qty_request: m.qty_request,
                  qty_stock: undefined,
                  notes: m.notes,
                  m_item: m.m_item || null,
                }))
              : [],
          }))
        : [],
    },
  ];

  refreshMaterialStock().catch(() => {});
};

const handleBomSelected = async (row: any, bomItem: any) => {
  if (!bomItem) {
    row.m_bom_id = '';
    row.m_bom = null;
    row.t_wo_sd_routings = [];
    return;
  }

  try {
    loading.value = true;
    const include =
      'm_bom_d_routing@m_bom_d_routings>m_items@m_item,m_bom_d_routing@m_bom_d_routings>m_mesin,m_bom_d_routing@m_bom_d_routings>m_routing@bom_routing,m_bom_d_routing@m_bom_d_routings>m_routing@bom_to_routing,m_bom_d_routing@m_bom_d_routings>m_general@bom_r_output,m_bom_d_routing@m_bom_d_routings>m_general@bom_r_unit,m_bom_sd_material@m_bom_sd_materials>m_items@m_item,m_bom_sd_material@m_bom_sd_materials>m_general@bom_mat_type,m_bom_sd_material@m_bom_sd_materials>m_general@bom_mat_unit';
    const response = await apiCall<{ status: string; data: any }>(`/dynamic/m_bom/${bomItem.id}?join=true&include=${encodeURIComponent(include)}`, {
      method: 'GET',
    });

    if (response.status === 'success' && response.data) {
      const bomData = response.data;
      row.m_bom = bomData;

      const qtyWo = Number(row.qty || 0);
      const qtyBom = Number(bomData.qty || 1);
      const multiplier = qtyBom > 0 ? qtyWo / qtyBom : 1;

      // Map routings & nested materials
      const routings = Array.isArray(bomData.m_bom_d_routings) ? bomData.m_bom_d_routings : [];
      const materials = Array.isArray(bomData.m_bom_sd_materials) ? bomData.m_bom_sd_materials : [];

      row.t_wo_sd_routings = routings.map((r: any) => {
        const stepMaterials = materials.filter((m: any) => m.m_bom_d_routing_id === r.id);

        // Standard time (menit) rata-rata dari detail BOM
        const routingTime = Number(r.time || 0);

        return {
          sequence: r.sequence,
          m_routing_id: r.m_routing_id,
          to_routing_id: r.to_routing_id,
          is_final: r.is_final,
          m_machine_id: r.m_mesin_id || null,
          speed: 0,
          output_type: r.output_type || null,
          output_type_label: tipeItemMap.value[r.output_type || ''] || '',
          m_item_id: r.m_item_id || null,
          qty: Number(r.qty || 0) * multiplier,
          unit_id: r.unit_id || null,
          is_bom: true,
          time: routingTime,
          plan_start: '',
          plan_finish: '',
          notes: r.notes || '',
          m_routing: r.bom_routing || null,
          to_routing: r.bom_to_routing || null,
          m_machine: r.m_mesin || null,
          m_general_output: r.bom_r_output || null,
          m_general_unit: r.bom_r_unit || null,
          t_wo_sd_materials: stepMaterials.map((m: any) => {
            const rawWeight = Number(m.weight || 0);
            const qtyMat = Number(m.qty || 0) * multiplier;
            return {
              sequence: m.sequence,
              item_type_id: m.item_type_id || null,
              m_item_id: m.m_item_id || null,
              is_main: m.is_main,
              qty: qtyMat,
              unit_id: m.unit_id || null,
              weight: qtyMat * rawWeight,
              waste_pct: 0,
              waste_qty: 0,
              qty_request: 0,
              qty_stock: undefined,
              notes: m.notes || '',
              m_item: m.m_item || null,
              m_general_unit: m.bom_mat_unit || null,
              as_type_sd_wo: m.bom_mat_type || null,
            };
          }),
        };
      });

      toast.success(`BOM "${bomData.no}" berhasil dimuat. ${row.t_wo_sd_routings.length} proses ditambahkan.`);

      refreshMaterialStock().catch(() => {});
    }
  } catch (error) {
    console.error('Failed to load BOM details:', error);
    toast.error('Gagal memuat detail BOM');
  } finally {
    loading.value = false;
  }
};

const handleQtyChange = (row: any) => {
  const bomData = row.m_bom;
  if (!bomData || !Array.isArray(row.t_wo_sd_routings)) return;

  const qtyWo = Number(row.qty || 0);
  const qtyBom = Number(bomData.qty || 1);
  const multiplier = qtyBom > 0 ? qtyWo / qtyBom : 1;

  row.t_wo_sd_routings.forEach((r: any, idx: number) => {
    const origRouting = bomData.m_bom_d_routings?.[idx] || r;
    r.qty = Number(origRouting.qty || 0) * multiplier;

    if (Array.isArray(r.t_wo_sd_materials)) {
      r.t_wo_sd_materials.forEach((m: any, mIdx: number) => {
        const origMaterial = bomData.m_bom_sd_materials?.find((bomM: any) => bomM.sequence === m.sequence && bomM.m_item_id === m.m_item_id) || m;
        const rawWeight = Number(origMaterial.weight || 0);
        m.qty = Number(origMaterial.qty || 0) * multiplier;
        m.weight = m.qty * rawWeight;
      });
    }
  });
};

// Multi Select Items logic
const selectedItemIds = computed(() => {
  return detailArr.value.map((row) => row.m_item_id).filter(Boolean) as string[];
});

const addSelectedItems = (items: any[]) => {
  items.forEach((item) => {
    if (!detailArr.value.find((d: any) => d.m_item_id === item.id)) {
      detailArr.value.push({
        m_item_id: item.id,
        m_item: item,
        m_bom_id: '',
        qty: 0,
        unit_id: item.uom_id || '',
        item_type_id: item.tipe_id || '',
        qty_accum: 0,
        finish_date: '',
        notes: '',
        t_wo_sd_routings: [],
      });
    }
  });
};

const removeDetailArr = (index: number) => {
  detailArr.value.splice(index, 1);
  if (expandedItemIdx.value === index) {
    expandedItemIdx.value = null;
    expandedRoutingIdx.value = null;
  } else if (expandedItemIdx.value !== null && expandedItemIdx.value > index) {
    expandedItemIdx.value--;
  }
  toast.info('Item detail dihapus');
};

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    no: '',
    date: getTodayDateString(),
    m_unit_bisnis_id: '',
    flag: 'WIP',
    wo_ref_id: '',
    ref_type: 't_io',
    ref_so_id: '',
    ref_io_id: '',
    m_customer_id: '',
    notes: '',
    status: 'DRAFT',
  });

  // Reset errors
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = '';
  });

  detailArr.value = [];
  expandedItemIdx.value = null;
  expandedRoutingIdx.value = null;
  searchItemQuery.value = '';
  searchRoutingQuery.value = '';
  searchMaterialQuery.value = '';
  applyCurrentUserUnitBisnis();
};

// ============================================================================
// LIFECYCLE HOOKS - LOAD DATA BEFORE MOUNT
// ============================================================================
onBeforeMount(async () => {
  onReset();

  // Preload peta label TIPE ITEM utk resolve label type saat create
  try {
    const resTipe = await fetch(`${API_BASE_URL}/dynamic/m_general?no_pagination=true&selectfield=id,value1&filter_column_group=TIPE%20ITEM`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
    });
    const result = await resTipe.json();
    if (result.status === 'success' && Array.isArray(result.data)) {
      result.data.forEach((g: any) => {
        tipeItemMap.value[g.id] = g.value1;
      });
    }
  } catch (error) {
    console.error('Failed to fetch TIPE ITEM map', error);
  }

  const isCopyModeLocal = route.query.copy !== undefined || (route.query.action === 'copy' && route.query.source);
  const sourceId = route.query.copy ? String(route.query.copy) : isCopyModeLocal ? String(route.query.source) : menuId.value;

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return;
  }

  loading.value = true;
  try {
    const res = await getWoWipById(sourceId);
    if (res && res.data) {
      const rawData = res.data as any;
      auditMeta.value = {
        created_by: rawData.created_by,
        createdAt: rawData.createdAt,
        updated_by: rawData.update_by || rawData.updated_by,
        updatedAt: rawData.updatedAt,
      };
    }

    if (res.status !== 'success') throw new Error('Gagal memuat data');
    initialValues = res.data;

    // Load nested detail items
    let rawDetails = initialValues.t_wo_wip_d_items || initialValues.t_wo_d_items;
    let isFallback = false;
    if ((!rawDetails || rawDetails.length === 0) && initialValues.wo_ref?.t_wo_d_items) {
      rawDetails = initialValues.wo_ref.t_wo_d_items;
      isFallback = true;
    }
    if (rawDetails) {
      detailArr.value = rawDetails.map((row: any) => ({
        id: isFallback ? undefined : row.id,
        t_wo_wip_id: row.t_wo_wip_id || row.t_wo_id,
        sequence: row.sequence,
        ref_type: row.ref_type,
        ref_so_id: row.ref_so_id,
        ref_io_id: row.ref_io_id,
        item_type_id: row.item_type_id,
        m_item_id: row.m_item_id,
        m_bom_id: row.m_bom_id,
        qty: row.qty ?? 0,
        unit_id: row.unit_id,
        qty_accum: row.qty_accum ?? 0,
        finish_date: row.finish_date ? row.finish_date.split('T')[0] : '',
        notes: row.notes ?? '',
        m_item: row.m_item || row.m_items_m_item_id,
        m_bom: row.m_bom || row.m_bom_m_bom_id,
        m_general_item_type: row.m_item?.mi_tipe || null,
        m_general_unit: row.m_general_unit || row.m_general_unit_id || row.unit || row.m_general2,
        t_wo_sd_routings: (row.t_wo_wip_sd_routings || row.t_wo_sd_routings || []).map((r: any) => ({
          id: isFallback ? undefined : r.id,
          t_wo_id: r.t_wo_id,
          t_wo_wo_d_item_id: r.t_wo_wo_d_item_id || r.t_wo_d_item_id,
          sequence: r.sequence,
          m_routing_id: r.m_routing_id,
          to_routing_id: r.to_routing_id,
          is_final: r.is_final === true || r.is_final === 1 || r.is_final === 'true',
          m_machine_id: r.m_machine_id,
          speed: r.speed ?? 0,
          output_type: r.output_type,
          m_item_id: r.m_item_id,
          qty: r.qty ?? 0,
          unit_id: r.unit_id,
          is_bom: r.is_bom === true || r.is_bom === 1 || r.is_bom === 'true',
          time: r.time ? Number(r.time) : (r.plan_start && r.plan_finish ? Math.max(0, Math.round((new Date(r.plan_finish).getTime() - new Date(r.plan_start).getTime()) / 60000)) : 0),
          plan_start: toDateTimeLocalValue(r.plan_start),
          plan_finish: toDateTimeLocalValue(r.plan_finish),
          real_start: toDateTimeLocalValue(r.real_start),
          real_finish: toDateTimeLocalValue(r.real_finish),
          qty_result: r.qty_result ?? 0,
          notes: r.notes ?? '',
          m_routing: r.m_routing || r.m_routing_m_routing_id,
          to_routing: r.to_routing || r.m_routing_to_routing_id,
          m_machine: r.m_machine || r.m_mesin_m_machine_id,
          m_item: r.m_item || r.m_items_m_item_id,
          m_general_output: r.m_general_output || null,
          m_general_unit: r.m_general_unit || r.m_general_unit_id || r.unit || r.m_general2,
          output_type_label: (r.m_general_output as any)?.value1 || '',
          t_wo_sd_materials: (r.t_wo_wip_sd_materials || r.t_wo_sd_materials || []).map((m: any) => ({
            id: isFallback ? undefined : m.id,
            t_wo_wip_id: m.t_wo_wip_id || m.t_wo_id,
            t_wo_wip_sd_routing_id: m.t_wo_wip_sd_routing_id || m.t_wo_sd_routing_id,
            sequence: m.sequence,
            item_type_id: m.item_type_id,
            m_item_id: m.m_item_id,
            is_main: m.is_main === true || m.is_main === 1 || m.is_main === 'true',
            qty: m.qty ?? 0,
            unit_id: m.unit_id,
            weight: m.weight ?? 0,
            waste_pct: m.waste_pct ?? 0,
            waste_qty: m.waste_qty ?? 0,
            qty_request: m.qty_request ?? 0,
            notes: m.notes ?? '',
            qty_stock: undefined,
            m_item: m.m_item || m.m_items_m_item_id,
            as_type_sd_wo: m.as_type_sd_wo,
            m_general_unit: m.m_general_unit || m.m_general_unit_id || m.unit || m.m_general2,
            item_type_label: (m.as_type_sd_wo as any)?.value1 || '',
          })),
        })),
      }));
    }

    // Mode copy: hapus id dan timestamps agar jadi create baru
    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
      delete (initialValues as any).no;
      initialValues.date = getTodayDateString();

      detailArr.value = detailArr.value.map((row) => {
        const copyRow = { ...row };
        delete copyRow.id;
        delete copyRow.t_wo_id;
        delete copyRow.t_wo_wip_id;
        if (copyRow.t_wo_sd_routings) {
          copyRow.t_wo_sd_routings = copyRow.t_wo_sd_routings.map((r) => {
            const copyR = { ...r };
            delete copyR.id;
            delete copyR.t_wo_id;
            delete copyR.t_wo_d_item_id;
            delete copyR.t_wo_wo_d_item_id;
            if (copyR.t_wo_sd_materials) {
              copyR.t_wo_sd_materials = copyR.t_wo_sd_materials.map((m) => {
                const copyM = { ...m };
                delete copyM.id;
                delete copyM.t_wo_id;
                delete copyM.t_wo_wip_id;
                delete copyM.t_wo_sd_routing_id;
                delete copyM.t_wo_wip_sd_routing_id;
                return copyM;
              });
            }
            return copyR;
          });
        }
        return copyRow;
      });
    }

    // Assign main fields and relation objects
    for (const key in initialValues) {
      if (key === 'date') {
        const rawDate = initialValues[key];
        if (rawDate) {
          (values as any)[key] = rawDate.includes('T') ? rawDate.split('T')[0] : rawDate.split(' ')[0];
        } else {
          (values as any)[key] = '';
        }
      } else {
        // @ts-ignore dynamic assign
        (values as any)[key] = initialValues[key];
      }
    }

    // Map references from parent wo_ref
    const parentWo = initialValues.wo_ref;
    if (parentWo) {
      values.ref_type = parentWo.ref_type || 't_io';
      if (parentWo.ref_type === 't_sales_order') {
        values.ref_so_id = parentWo.wo_ref_id || '';
        values.ref_io_id = '';
      } else if (parentWo.ref_type === 't_io') {
        values.ref_io_id = parentWo.wo_ref_id || '';
        values.ref_so_id = '';
      }
      values.m_customer_id = parentWo.m_customer_id || '';

      // Copy relational objects for lazy-loaded select displays
      (values as any).t_io = parentWo.t_io || null;
      (values as any).t_sales_order = parentWo.t_sales_order || null;
      (values as any).m_customer = parentWo.m_customer || null;
    }

    if (values.m_unit_bisnis_id) {
      fetchUnitBisnisCompanyName(values.m_unit_bisnis_id);
    }

    refreshMaterialStock().catch(() => {});

    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai Wo Wip baru',
      });
    } else {
      toast.success('Data berhasil dimuat');
    }
  } catch (error) {
    toast.error('Gagal memuat data Wo Wip', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/production/transaksi/t_wo_wip'),
      },
    });
    setTimeout(() => router.push('/production/transaksi/t_wo_wip'), 2000);
  } finally {
    loading.value = false;
  }
});

// Errors object
const errors = reactive({
  date: '',
  m_customer_id: '',
  m_unit_bisnis_id: '',
  ref_so_id: '',
  ref_io_id: '',
  wo_ref_id: '',
});

const isWarningDialogOpen = ref(false);
const warningDialogList = ref<string[]>([]);

const confirmSave = async () => {
  isWarningDialogOpen.value = false;
  await performSave();
};

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = '';
  });
  let invalid = false;
  if (!values.wo_ref_id) {
    errors.wo_ref_id = 'Reference WO wajib dipilih';
    invalid = true;
  }
  if (!values.date) {
    errors.date = 'Tanggal wajib diisi';
    invalid = true;
  }
  if (!values.m_unit_bisnis_id) {
    errors.m_unit_bisnis_id = 'Unit Bisnis wajib dipilih';
    invalid = true;
  }

  if (values.ref_type === 't_sales_order' && !values.ref_so_id) {
    errors.ref_so_id = 'Referensi Sales Order wajib dipilih';
    invalid = true;
  }
  if (values.ref_type === 't_io' && !values.ref_io_id) {
    errors.ref_io_id = 'Referensi Internal Order wajib dipilih';
    invalid = true;
  }

  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' });
    return;
  }

  const dialogItems: string[] = [];
  let noWasteCount = 0;
  let stockWarnings: string[] = [];
  detailArr.value.forEach((item) => {
    (item.t_wo_sd_routings || []).forEach((routing) => {
      (routing.t_wo_sd_materials || []).forEach((material) => {
        if (material.m_item_id && (Number(material.waste_pct) || 0) === 0) {
          noWasteCount++;
        }
        const qtyFinal = Number(material.qty || 0) + Number(material.waste_qty || 0);
        const stock = Number(material.qty_stock ?? 0);
        if (material.m_item_id && stock > 0 && qtyFinal > stock) {
          const itemName = material.m_item?.nama_item || material.m_item?.nama_ite || material.m_item_id;
          stockWarnings.push(`${itemName}: Qty Final ${qtyFinal} > Stok ${stock}`);
        }
      });
    });
  });
  if (noWasteCount > 0) {
    dialogItems.push(`${noWasteCount} material tanpa Waste (%)`);
  }
  stockWarnings.forEach((w) => dialogItems.push(w));
  if (dialogItems.length > 0) {
    warningDialogList.value = dialogItems;
    isWarningDialogOpen.value = true;
    return;
  }

  await performSave();
};

/*
  // Validate detailArr items
  if (detailArr.value.length === 0) {
    toast.error('Validasi detail gagal', { description: 'Detail item minimal harus ada 1' })
    return
  }

  for (let i = 0; i < detailArr.value.length; i++) {
    const item = detailArr.value[i]
    if (!item) continue
    if (!item.m_item_id) {
      toast.error('Validasi detail gagal', { description: `Item pada baris ke-${i + 1} wajib diisi` })
      return
    }
    if (!item.m_bom_id) {
      toast.error('Validasi detail gagal', { description: `BOM pada baris ke-${i + 1} wajib diisi` })
      return
    }
    if (item.qty === undefined || item.qty === null || item.qty === '' || Number(item.qty) <= 0) {
      toast.error('Validasi detail gagal', { description: `Qty WO pada baris ke-${i + 1} harus lebih besar dari 0` })
      return
    }
    if (!item.unit_id) {
      toast.error('Validasi detail gagal', { description: `UoM pada baris ke-${i + 1} wajib diisi` })
      return
    }
    if (!item.finish_date) {
      toast.error('Validasi detail gagal', { description: `Finish Date pada baris ke-${i + 1} wajib diisi` })
      return
    }

    // Validate routing details
    for (let r = 0; r < (item.t_wo_sd_routings || []).length; r++) {
      const routing = item.t_wo_sd_routings![r]
      if (!routing) continue
      if (!routing.m_routing_id) {
        toast.error('Validasi routing gagal', { description: `Routing pada langkah ke-${r + 1} (item baris ${i + 1}) wajib diisi` })
        return
      }
      if (routing.qty === undefined || routing.qty === null || routing.qty === '' || Number(routing.qty) <= 0) {
        toast.error('Validasi routing gagal', { description: `Est. Qty Output pada langkah ke-${r + 1} (item baris ${i + 1}) harus lebih besar dari 0` })
        return
      }
      if (!routing.output_type) {
        toast.error('Validasi routing gagal', { description: `Tipe Output pada langkah ke-${r + 1} (item baris ${i + 1}) wajib diisi` })
        return
      }
      if (!routing.m_item_id) {
        toast.error('Validasi routing gagal', { description: `WIP/Item pada langkah ke-${r + 1} (item baris ${i + 1}) wajib diisi` })
        return
      }
      if (!routing.unit_id) {
        toast.error('Validasi routing gagal', { description: `UoM pada langkah ke-${r + 1} (item baris ${i + 1}) wajib diisi` })
        return
      }
      if (!routing.plan_start) {
        toast.error('Validasi routing gagal', { description: `Plan Start Date pada langkah ke-${r + 1} (item baris ${i + 1}) wajib diisi` })
        return
      }
      if (!routing.plan_finish) {
        toast.error('Validasi routing gagal', { description: `Plan End Date pada langkah ke-${r + 1} (item baris ${i + 1}) wajib diisi` })
        return
      }

      // Validate material subdetails
      for (let m = 0; m < (routing.t_wo_sd_materials || []).length; m++) {
        const material = routing.t_wo_sd_materials![m]
        if (!material) continue
        if (!material.item_type_id) {
          toast.error('Validasi material gagal', { description: `Tipe Material ke-${m + 1} (langkah ${r + 1}, item ${i + 1}) wajib diisi` })
          return
        }
        if (!material.m_item_id) {
          toast.error('Validasi material gagal', { description: `Material ke-${m + 1} (langkah ${r + 1}, item ${i + 1}) wajib diisi` })
          return
        }
        if (material.qty === undefined || material.qty === null || material.qty === '' || Number(material.qty) <= 0) {
          toast.error('Validasi material gagal', { description: `Qty Material ke-${m + 1} (langkah ${r + 1}, item ${i + 1}) harus lebih besar dari 0` })
          return
        }
        if (!material.unit_id) {
          toast.error('Validasi material gagal', { description: `UoM Material ke-${m + 1} (langkah ${r + 1}, item ${i + 1}) wajib diisi` })
          return
        }
      }
    }
  }
  */

const performSave = async () => {
  loading.value = true;
  try {
    const payload: any = {
      no: values.no || null,
      date: values.date || null,
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      flag: values.flag || null,
      wo_ref_id: values.wo_ref_id || null,
      ref_type: values.ref_type || null,
      ref_so_id: values.ref_so_id || null,
      ref_io_id: values.ref_io_id || null,
      m_customer_id: values.m_customer_id || null,
      notes: values.notes || null,
      status: values.status || 'DRAFT',
      t_wo_d_items: detailArr.value.map((row: any, index: number) => ({
        id: isCopyMode.value ? undefined : row.id,
        t_wo_wip_id: isCopyMode.value ? undefined : menuId.value || undefined,
        t_wo_id: isCopyMode.value ? undefined : menuId.value || undefined,
        sequence: index + 1,
        ref_type: row.ref_type || values.ref_type || null,
        ref_so_id: row.ref_so_id || values.ref_so_id || null,
        ref_io_id: row.ref_io_id || values.ref_io_id || null,
        item_type_id: row.item_type_id || null,
        m_item_id: row.m_item_id || null,
        m_bom_id: row.m_bom_id || null,
        qty: row.qty !== '' ? Number(row.qty) : 0,
        unit_id: row.unit_id || null,
        qty_accum: row.qty_accum !== '' ? Number(row.qty_accum) : 0,
        finish_date: row.finish_date || null,
        notes: row.notes || null,
        t_wo_sd_routings: (row.t_wo_sd_routings || []).map((r: any, rIdx: number) => ({
          id: isCopyMode.value ? undefined : r.id,
          t_wo_wip_id: isCopyMode.value ? undefined : menuId.value || undefined,
          t_wo_id: isCopyMode.value ? undefined : menuId.value || undefined,
          t_wo_d_item_id: isCopyMode.value ? undefined : row.id || undefined,
          t_wo_wo_d_item_id: isCopyMode.value ? undefined : row.id || undefined,
          sequence: rIdx + 1,
          m_routing_id: r.m_routing_id || null,
          to_routing_id: r.to_routing_id || null,
          is_final: r.is_final || false,
          m_machine_id: r.m_machine_id || null,
          speed: r.speed !== '' ? Number(r.speed) : 0,
          output_type: r.output_type || null,
          m_item_id: r.m_item_id || null,
          qty: r.qty !== '' ? Number(r.qty) : 0,
          unit_id: r.unit_id || null,
          is_bom: r.is_bom || false,
          time: r.time || 0,
          plan_start: r.plan_start || null,
          plan_finish: r.plan_finish || null,
          notes: r.notes || null,
          t_wo_sd_materials: (r.t_wo_sd_materials || []).map((m: any, mIdx: number) => ({
            id: isCopyMode.value ? undefined : m.id,
            t_wo_wip_id: isCopyMode.value ? undefined : menuId.value || undefined,
            t_wo_id: isCopyMode.value ? undefined : menuId.value || undefined,
            t_wo_wip_sd_routing_id: isCopyMode.value ? undefined : r.id || undefined,
            t_wo_sd_routing_id: isCopyMode.value ? undefined : r.id || undefined,
            sequence: mIdx + 1,
            item_type_id: m.item_type_id || null,
            m_item_id: m.m_item_id || null,
            is_main: m.is_main || false,
            qty: m.qty !== '' ? Number(m.qty) : 0,
            unit_id: m.unit_id || null,
            weight: m.weight !== '' ? Number(m.weight) : 0,
            waste_pct: m.waste_pct || 0,
            waste_qty: m.waste_qty || 0,
            qty_request: m.qty_request || 0,
            notes: m.notes || null,
          })),
        })),
      })),
    };

    if (isEditMode.value) {
      await updateWoWip(menuId.value, payload);
      toast.success('Work Order WIP berhasil diperbarui');
    } else {
      await createWoWip(payload);
      toast.success('Work Order WIP berhasil dibuat');
    }
    router.replace('/production/transaksi/t_wo_wip?reload=' + Date.now());
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Wo Wip' : 'Gagal membuat Wo Wip', { description: error instanceof Error ? error.message : 'Terjadi kesalahan' });
  } finally {
    loading.value = false;
  }
};

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/production/transaksi/t_wo_wip');
};
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

    <!-- ================================================================ -->
    <!-- FORM SECTION -->
    <!-- ================================================================ -->
    <form class="space-y-6" @submit.prevent>
      <!-- HEADER CARD -->
      <Card>
        <CardHeader>
          <CardTitle>Informasi Work Order</CardTitle>
          <CardDescription>Isi detail informasi Work Order</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Unit Bisnis selector -->
            <FieldSelect
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              :value="values.m_unit_bisnis_id"
              :display-value="(values as any).m_unit_bisni?.nama_comp || ''"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  searchfield: 'kode_unit_bisnis,nama_comp',
                  join: 'true',
                },
              }"
              display-field="nama_comp"
              value-field="id"
              placeholder="Pilih Unit Bisnis"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || !!values.wo_ref_id || isUnitBisnisReadonly"
              :readonly="isReadOnly || isUnitBisnisReadonly"
              :clearable="!values.wo_ref_id && !isUnitBisnisReadonly"
              :errorText="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id || 'Pilih unit bisnis untuk Wo ini'"
              @input="(v) => (values.m_unit_bisnis_id = v)"
              @update:valueFull="handleUnitBisnisSelected"
              class="w-full"
            />

            <!-- Company (readonly) -->
            <FieldX id="company_display" label="Company" :value="selectedUnitBisnisCompanyName || '-'" :disabled="true" :readonly="true" placeholder="-" class="w-full opacity-70 bg-slate-50 dark:bg-muted/50" />

            <!-- No Wo -->
            <FieldX
              id="no"
              label="No Wo"
              :value="values.no || 'Auto generate sistem'"
              :disabled="true"
              :readonly="true"
              placeholder="Auto generate sistem"
              hints="Nomor dibuat otomatis oleh sistem"
              class="w-full opacity-70 bg-slate-50 dark:bg-muted/50"
            />

            <!-- Tanggal -->
            <FieldX
              id="date"
              label="Tanggal"
              type="date"
              :value="values.date"
              :errorname="errors.date ? 'failed' : ''"
              @input="(v) => (values.date = v)"
              :hints="errors.date"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              class="w-full"
            />

            <!-- Reference WO -->
            <FieldPopup
              id="wo_ref_id"
              label="Reference WO"
              :value="values.wo_ref_id"
              :display-value="(values as any).wo_ref?.no || ''"
              :api="{
                url: `${API_BASE_URL}/dynamic/t_wo`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: {
                  filter_column_flag: 'FG',
                  filter_column_status: 'APPROVED',
                  join: 'true',
                  ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
                },
              }"
              displayField="no"
              valueField="id"
              :placeholder="values.m_unit_bisnis_id ? 'Pilih Reference WO' : 'Pilih Unit Bisnis terlebih dahulu'"
              :columns="woRefColumns"
              :clearable="true"
              :required="true"
              :disabled="loading || isReadOnly || !values.m_unit_bisnis_id"
              :readonly="isReadOnly"
              @input="
                (v: string) => {
                  values.wo_ref_id = v;
                  detailArr = [];
                }
              "
              @update:valueFull="handleWoRefSelected"
              class="w-full"
            />

            <!-- Item Popup -->
            <FieldPopup
              v-if="values.wo_ref_id"
              id="header_item_id"
              label="Item"
              :value="selectedItemId"
              :display-value="detailArr[0]?.m_item ? `${detailArr[0].m_item.kode_item || detailArr[0].m_item.kode || ''} - ${detailArr[0].m_item.nama_item || detailArr[0].m_item.nama || ''}` : ''"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="true"
              :required="!isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/t_wo_d_item`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: {
                  join: 'true',
                  filter_column_t_wo_id: values.wo_ref_id,
                },
                onsuccess: (response: any) => {
                  if (response.status === 'success' && Array.isArray(response.data)) {
                    response.data = response.data.map((d: any) => {
                      const itemObj = d.m_item || d.m_items || {};
                      return {
                        id: itemObj.id,
                        kode_item: itemObj.kode_item,
                        nama_item: itemObj.nama_item,
                        uom_id: itemObj.uom_id,
                        tipe_id: itemObj.tipe_id,
                        displayLabel: `${itemObj.kode_item || '-'} - ${itemObj.nama_item || '-'}`,
                        qty_so_ots: d.qty || 0,
                        originalDetail: d,
                      };
                    });
                  }
                  return response;
                },
              }"
              displayField="displayLabel"
              valueField="id"
              placeholder="Pilih Item"
              :columns="itemColumns"
              @update:valueFull="handleItemDropdownSelected"
              class="w-full"
            />

            <!-- Referensi (Radio Buttons) -->
            <div class="flex flex-col gap-2 w-full justify-center">
              <span class="text-xs font-semibold text-slate-700">Referensi <span class="text-red-500">*</span></span>
              <div class="flex items-center gap-6 h-9">
                <label class="flex items-center gap-2 text-sm text-slate-600 font-normal cursor-pointer select-none">
                  <input
                    type="radio"
                    name="ref_type"
                    value="t_io"
                    :checked="values.ref_type === 't_io'"
                    :disabled="loading || isReadOnly"
                    @change="handleRefTypeChange('t_io')"
                    class="h-4 w-4 border-slate-300 text-[#0F172A] focus:ring-[#0F172A]"
                  />
                  <span>Internal Order</span>
                </label>
                <label class="flex items-center gap-2 text-sm text-slate-600 font-normal cursor-pointer select-none">
                  <input
                    type="radio"
                    name="ref_type"
                    value="t_sales_order"
                    :checked="values.ref_type === 't_sales_order'"
                    :disabled="loading || isReadOnly"
                    @change="handleRefTypeChange('t_sales_order')"
                    class="h-4 w-4 border-slate-300 text-[#0F172A] focus:ring-[#0F172A]"
                  />
                  <span>Sales Order</span>
                </label>
              </div>
            </div>

            <!-- Referensi SO -->
            <FieldPopup
              v-if="values.ref_type === 't_sales_order'"
              id="ref_so_id"
              label="Referensi Sales Order"
              :value="values.ref_so_id"
              :display-value="(values as any).t_sales_order?.no || ''"
              :api="{
                url: `${API_BASE_URL}/dynamic/t_sales_order`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: {
                  searchfield: 'no',
                  join: 'true',
                  filter_column_status: 'APPROVED',
                  ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
                },
              }"
              displayField="no"
              valueField="id"
              placeholder="Pilih Sales Order"
              :columns="soColumns"
              :clearable="true"
              :errorText="errors.ref_so_id ? 'failed' : ''"
              :hints="errors.ref_so_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              @input="(v: string) => (values.ref_so_id = v)"
              @update:valueFull="handleRefSoSelected"
              class="w-full"
            />

            <!-- Referensi IO -->
            <FieldPopup
              v-if="values.ref_type === 't_io'"
              id="ref_io_id"
              label="Referensi Internal Order"
              :value="values.ref_io_id"
              :display-value="(values as any).t_io?.no || ''"
              :api="{
                url: `${API_BASE_URL}/dynamic/t_io`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: {
                  searchfield: 'no,notes',
                  join: 'true',
                  filter_column_status: 'APPROVED',
                  ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
                },
              }"
              displayField="no"
              valueField="id"
              placeholder="Pilih Internal Order"
              :columns="ioColumns"
              :clearable="true"
              :errorText="errors.ref_io_id ? 'failed' : ''"
              :hints="errors.ref_io_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              @input="(v: string) => (values.ref_io_id = v)"
              @update:valueFull="handleRefIoSelected"
              class="w-full"
            />

            <!-- Customer -->
            <FieldSelect
              id="m_customer_id"
              label="Customer"
              :value="values.m_customer_id"
              :display-value="(values as any).m_customer?.nama_customer || (values as any).m_customer?.name || ''"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_customer`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: { no_pagination: 'true', selectfield: 'id,kode_customer,nama_customer', searchfield: 'kode_customer,nama_customer' },
              }"
              display-field="nama_customer"
              value-field="id"
              placeholder="Pilih Customer"
              :clearable="true"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              @input="(v: string) => (values.m_customer_id = v)"
              class="w-full"
            />

            <!-- Status (readonly) -->
            <FieldX id="status" label="Status" :value="values.status || 'DRAFT'" :disabled="true" :readonly="true" placeholder="DRAFT" class="w-full opacity-70" />
          </div>

          <!-- Notes / Catatan -->
          <div class="mt-4">
            <FieldX id="notes" label="Catatan" :value="values.notes" @input="(v) => (values.notes = v)" :disabled="loading || isReadOnly" :readonly="isReadOnly" placeholder="Catatan tambahan" class="w-full" />
          </div>
        </CardContent>
      </Card>

      <!-- THREE LEVEL INLINE NESTED ACCORDION TABLE -->
      <Card class="overflow-hidden">
        <CardHeader class="border-b bg-slate-50/50 dark:bg-muted/40">
          <div class="flex items-center justify-between">
            <div>
              <CardTitle class="text-lg">Surat Perintah Kerja Detail</CardTitle>
              <CardDescription>Kelola detail items, routing steps, dan kebutuhan material secara inline</CardDescription>
            </div>
            <div class="flex items-center gap-3">
              <!-- Item selected via header dropdown -->
            </div>
          </div>
        </CardHeader>
        <CardContent class="p-0">
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-xs">
              <!-- LEVEL 1 HEADERS -->
              <thead class="bg-slate-50 dark:bg-muted/50 border-b border-slate-200 dark:border-border">
                <tr class="divide-x divide-slate-200 dark:divide-border">
                  <th class="w-12 py-2.5 px-3 text-center"></th>
                  <th class="w-12 py-2.5 px-3 text-left font-semibold text-slate-700 dark:text-slate-200">No</th>
                  <th class="min-w-[200px] py-2.5 px-3 text-left font-semibold text-slate-700 dark:text-slate-200">Item</th>
                  <th class="min-w-[150px] py-2.5 px-3 text-left font-semibold text-slate-700 dark:text-slate-200">No. BOM</th>
                  <th class="min-w-[100px] py-2.5 px-3 text-left font-semibold text-slate-700 dark:text-slate-200">Qty WO</th>
                  <th class="min-w-20 py-2.5 px-3 text-left font-semibold text-slate-700 dark:text-slate-200">UoM</th>
                  <th class="min-w-[130px] py-2.5 px-3 text-left font-semibold text-slate-700 dark:text-slate-200">Finish Date</th>
                  <th class="min-w-[180px] py-2.5 px-3 text-left font-semibold text-slate-700 dark:text-slate-200">Catatan</th>
                  <th v-if="false" class="w-16 py-2.5 px-3 text-center"></th>
                </tr>
              </thead>

              <!-- LEVEL 1 BODY -->
              <tbody>
                <template v-if="filteredDetailItems.length === 0">
                  <tr>
                    <td :colspan="isReadOnly ? 8 : 9" class="text-center py-12 text-slate-400 dark:text-muted-foreground bg-white dark:bg-card">Belum ada data detail item. Silakan pilih item untuk memulai.</td>
                  </tr>
                </template>
                <template v-else v-for="(row, idx) in filteredDetailItems" :key="idx">
                  <tr class="divide-x divide-slate-200 dark:divide-border border-b border-slate-200 dark:border-border align-middle bg-white dark:bg-card">
                    <!-- Expand Toggler -->
                    <td class="py-2 px-3 text-center">
                      <button
                        type="button"
                        class="h-5 w-5 rounded-full bg-[#1E88E5] text-white flex items-center justify-center cursor-pointer shadow-sm hover:bg-[#1565C0] transition mx-auto"
                        @click="toggleItemExpand(getOriginalItemIdx(row))"
                      >
                        <ChevronDown v-if="expandedItemIdx === getOriginalItemIdx(row)" class="h-3 w-3 stroke-[2.5]" />
                        <ChevronRight v-else class="h-3 w-3 stroke-[2.5]" />
                      </button>
                    </td>

                    <!-- No -->
                    <td class="py-2 px-3 font-medium text-slate-700 dark:text-slate-200">{{ getOriginalItemIdx(row) + 1 }}</td>

                    <!-- Item name -->
                    <td class="py-2 px-3">
                      <span class="font-medium text-xs">
                        {{ row.m_item?.kode_item || row.m_item?.kode || row.m_item?.kode_ite || '-' }}
                      </span>
                    </td>

                    <!-- BOM Lookup -->
                    <td class="py-2 px-3">
                      <!-- BOM Popup -->
                      <FieldPopup
                        v-if="!isReadOnly"
                        :id="`item_bom_${getOriginalItemIdx(row)}`"
                        :value="row.m_bom_id || ''"
                        :display-value="row.m_bom?.no || ''"
                        :api="{
                          url: `${API_BASE_URL}/dynamic/m_bom`,
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                          params: {
                            join: 'true',
                            filter_column_status: 'true',
                            include: 'm_items@m_item,m_general',
                            ...(row.m_item_id ? { filter_column_m_item_id: row.m_item_id } : {}),
                          },
                        }"
                        displayField="no"
                        valueField="id"
                        placeholder="Pilih BOM"
                        :columns="bomColumns"
                        :clearable="true"
                        @input="
                          (v: string) => {
                            row.m_bom_id = v;
                          }
                        "
                        @update:valueFull="(bomItem: any) => handleBomSelected(row, bomItem)"
                        class="w-full text-xs h-7 min-w-[140px]"
                      />
                      <span v-else class="text-xs">{{ row.m_bom?.no || row.m_bom_id || '-' }}</span>
                    </td>

                    <!-- Qty WO -->
                    <td class="py-2 px-3">
                      <input
                        v-if="!isReadOnly"
                        v-model="row.qty"
                        type="number"
                        step="any"
                        @input="handleQtyChange(row)"
                        class="w-20 px-2 py-1 border border-slate-200 dark:border-input rounded text-xs bg-white dark:bg-input/30 focus:outline-none focus:ring-1 focus:ring-primary text-right"
                      />
                      <span v-else class="text-right block w-full px-2">{{ row.qty || 0 }}</span>
                    </td>

                    <!-- Satuan / UoM -->
                    <td class="py-2 px-3">
                      <FieldSelect
                        v-if="!isReadOnly"
                        :id="`item_unit_${getOriginalItemIdx(row)}`"
                        :value="row.unit_id || ''"
                        :display-value="row.m_general_unit?.value1 || ''"
                        :api="{
                          url: `${API_BASE_URL}/dynamic/m_general`,
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                          params: { no_pagination: 'true', filter_column_group: 'UOM', selectfield: 'id,value1' },
                        }"
                        display-field="value1"
                        value-field="id"
                        placeholder="UOM"
                        @input="(v: string) => (row.unit_id = v)"
                        class="w-full text-xs h-7 min-w-[90px]"
                      />
                      <span v-else class="text-xs">{{ row.m_general_unit?.value1 || row.unit_id || '-' }}</span>
                    </td>

                    <!-- Finish Date -->
                    <td class="py-2 px-3">
                      <input
                        v-if="!isReadOnly"
                        v-model="row.finish_date"
                        type="date"
                        class="w-full min-w-[120px] px-2 py-1 border border-slate-200 dark:border-input rounded text-xs bg-white dark:bg-input/30 focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                      <span v-else class="text-xs">{{ row.finish_date ? new Date(row.finish_date).toLocaleDateString('id-ID') : '-' }}</span>
                    </td>

                    <!-- Catatan -->
                    <td class="py-2 px-3">
                      <input
                        v-if="!isReadOnly"
                        v-model="row.notes"
                        type="text"
                        class="w-full px-2 py-1 border border-slate-200 dark:border-input rounded text-xs bg-white dark:bg-input/30 focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Masukkan catatan"
                      />
                      <span v-else class="text-xs text-slate-500 dark:text-muted-foreground">{{ row.notes || '-' }}</span>
                    </td>

                    <!-- Delete main row -->
                    <td v-if="false" class="py-2 px-3 text-center">
                      <button type="button" class="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 p-1 rounded transition" @click="removeDetailArr(getOriginalItemIdx(row))">
                        <Trash2 class="h-4 w-4" />
                      </button>
                    </td>
                  </tr>

                  <!-- ======================================================== -->
                  <!-- LEVEL 2 TABLE (INLINE ACCORDION: t_wo_sd_routings) -->
                  <!-- ======================================================== -->
                  <tr v-if="expandedItemIdx === getOriginalItemIdx(row)" class="bg-slate-50/50 dark:bg-muted/20">
                    <td :colspan="isReadOnly ? 9 : 10" class="p-4 border-b border-slate-200 dark:border-border">
                      <div class="space-y-3 bg-white dark:bg-card p-4 border border-slate-200 dark:border-border rounded-lg shadow-sm">
                        <!-- TOP ACTION & SEARCH BAR -->
                        <div class="flex items-center justify-start gap-2 pb-1">
                          <input
                            v-model="searchRoutingQuery"
                            placeholder="Cari Routing..."
                            class="h-7 w-48 px-2.5 py-1 border border-slate-200 dark:border-input rounded-md text-[10px] focus:outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-input/30 shadow-sm font-normal"
                          />
                          <ButtonMultiSelect
                            v-if="!isReadOnly"
                            title="Pilih Routing"
                            :disabled="loading"
                            uniqueKey="id"
                            :excludeIds="getSelectedRoutingIds(row)"
                            :api="{
                              url: `${API_BASE_URL}/dynamic/m_routing`,
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                              params: { join: 'all', searchfield: 'code,name' },
                              onsuccess: (response: any) => {
                                response.hasNext = response.pagination?.next_page ? true : false;
                                return response;
                              },
                            }"
                            :columns="[
                              { field: 'code', headerName: 'Kode', width: '160px', sortable: true, filterable: true },
                              { field: 'name', headerName: 'Nama', flex: 1, sortable: true, filterable: true },
                            ]"
                            @add="(selected: any[]) => addSelectedRoutings(getOriginalItemIdx(row), selected)"
                            buttonClass="h-7 text-[10px] px-3 bg-primary text-white hover:bg-primary/95"
                          />
                        </div>

                        <!-- HEADER BAR -->
                        <div class="flex items-center justify-between border-b border-slate-200 dark:border-border pb-2 pt-1 border-t">
                          <h4 class="font-bold text-slate-800 dark:text-slate-100 text-xs flex items-center gap-1.5">
                            <span class="inline-block w-1.5 h-3 bg-[#1E88E5] rounded"></span>
                            Surat Perintah Kerja Detail (Langkah Routing)
                          </h4>
                        </div>

                        <!-- TABEL ROUTINGS (TAMPIL HANYA JIKA ADA DATA) -->
                        <div v-if="row.t_wo_sd_routings && row.t_wo_sd_routings.length > 0" class="overflow-x-auto border border-slate-200 dark:border-border rounded-md">
                          <table class="w-full text-[11px] border-collapse">
                            <!-- LEVEL 2 HEADERS -->
                            <thead class="bg-slate-50 dark:bg-muted/50 border-b border-slate-200 dark:border-border">
                              <tr class="divide-x divide-slate-200 dark:divide-border text-slate-600 dark:text-slate-300">
                                <th class="w-20 py-2 px-2 text-center"></th>
                                <th class="w-12 py-2 px-2 text-left font-semibold">No</th>
                                <th class="w-16 py-2 px-2 text-center font-semibold">Is Final</th>
                                <th class="min-w-[120px] py-2 px-2 text-left font-semibold">Route</th>
                                <th class="min-w-[120px] py-2 px-2 text-left font-semibold">To Route</th>
                                <th class="min-w-[110px] py-2 px-2 text-left font-semibold">Mesin</th>
                                <th class="min-w-[85px] py-2 px-2 text-right font-semibold">Speed (/Menit)</th>
                                <th class="min-w-[90px] py-2 px-2 text-left font-semibold">Est. Qty Output</th>
                                <th class="min-w-[100px] py-2 px-2 text-left font-semibold">Type Output</th>
                                <th class="min-w-[130px] py-2 px-2 text-left font-semibold">WIP/FG</th>
                                <th class="min-w-[165px] py-2 px-2 text-left font-semibold">Plan Start</th>
                                <th class="min-w-[165px] py-2 px-2 text-left font-semibold">Plan End</th>
                                <th class="min-w-[110px] py-2 px-2 text-right font-semibold">Durasi (Menit)</th>
                                <th class="min-w-20 py-2 px-2 text-left font-semibold">Qty Result</th>
                                <th class="min-w-[120px] py-2 px-2 text-left font-semibold">Catatan</th>
                              </tr>
                            </thead>

                            <!-- LEVEL 2 BODY -->
                            <tbody>
                              <template v-for="(rRow, rIdx) in getFilteredRoutings(row)" :key="rIdx">
                                <tr class="divide-x divide-slate-200 dark:divide-border border-b border-slate-200 dark:border-border align-middle bg-white dark:bg-card hover:bg-slate-50/20 dark:hover:bg-muted/20">
                                  <!-- Level 2 Actions (Toggle Expand & Delete) -->
                                  <td class="py-1.5 px-2 text-center flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      class="h-4.5 w-4.5 rounded-full bg-[#00ACC1] text-white flex items-center justify-center cursor-pointer shadow-sm hover:bg-[#00838F] transition"
                                      @click="toggleRoutingExpand(getOriginalRoutingIdx(row, rRow))"
                                    >
                                      <ChevronDown v-if="expandedRoutingIdx === getOriginalRoutingIdx(row, rRow)" class="h-2.5 w-2.5 stroke-3" />
                                      <ChevronRight v-else class="h-2.5 w-2.5 stroke-3" />
                                    </button>
                                    <button v-if="!isReadOnly" type="button" class="text-red-500 hover:text-red-700 transition" @click="removeRoutingRowInline(getOriginalItemIdx(row), getOriginalRoutingIdx(row, rRow))">
                                      <Trash2 class="h-3.5 w-3.5" />
                                    </button>
                                  </td>

                                  <!-- No -->
                                  <td class="py-1.5 px-2 text-slate-600 dark:text-slate-300 font-medium">{{ getOriginalRoutingIdx(row, rRow) + 1 }}</td>

                                  <!-- Is Final -->
                                  <td class="py-1.5 px-2 text-center">
                                    <input type="checkbox" v-model="rRow.is_final" :disabled="isReadOnly" class="rounded border-slate-300 dark:border-input text-primary focus:ring-primary h-3.5 w-3.5" />
                                  </td>

                                  <!-- Route (m_routing) -->
                                  <td class="py-1.5 px-2">
                                    <FieldSelect
                                      v-if="!isReadOnly"
                                      :id="`r_routing_${getOriginalItemIdx(row)}_${getOriginalRoutingIdx(row, rRow)}`"
                                      :value="rRow.m_routing_id || ''"
                                      :display-value="rRow.m_routing?.code || ''"
                                      :api="{
                                        url: `${API_BASE_URL}/dynamic/m_routing`,
                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                                        params: { no_pagination: 'true', join: 'all' },
                                      }"
                                      display-field="code"
                                      value-field="id"
                                      placeholder="Routing"
                                      @input="(v: string) => (rRow.m_routing_id = v)"
                                      @update:valueFull="(item) => handleRoutingSelected(item, rRow)"
                                      class="w-full text-[11px] h-7 min-w-[120px]"
                                    />
                                    <span v-else>{{ rRow.m_routing?.code || rRow.m_routing?.kode || rRow.m_routing_id || '-' }}</span>
                                  </td>

                                  <!-- To Route (m_routing) -->
                                  <td class="py-1.5 px-2">
                                    <FieldSelect
                                      v-if="!isReadOnly"
                                      :id="`r_to_routing_${getOriginalItemIdx(row)}_${getOriginalRoutingIdx(row, rRow)}`"
                                      :value="rRow.to_routing_id || ''"
                                      :display-value="rRow.to_routing?.code || ''"
                                      :api="{
                                        url: `${API_BASE_URL}/dynamic/m_routing`,
                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                                        params: { no_pagination: 'true', join: 'all' },
                                      }"
                                      display-field="code"
                                      value-field="id"
                                      placeholder="Next Route"
                                      :clearable="true"
                                      @input="(v: string) => (rRow.to_routing_id = v)"
                                      class="w-full text-[11px] h-7 min-w-[120px]"
                                    />
                                    <span v-else>{{ rRow.to_routing?.code || rRow.to_routing?.kode || rRow.to_routing_id || '-' }}</span>
                                  </td>

                                  <!-- Mesin (m_mesin) -->
                                  <td class="py-1.5 px-2">
                                    <FieldSelect
                                      v-if="!isReadOnly"
                                      :id="`r_machine_${getOriginalItemIdx(row)}_${getOriginalRoutingIdx(row, rRow)}`"
                                      :value="rRow.m_machine_id || ''"
                                      :display-value="rRow.m_machine?.name || rRow.m_machine?.nama || ''"
                                      :api="{
                                        url: `${API_BASE_URL}/dynamic/m_mesin`,
                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                                        params: { no_pagination: 'true', join: 'true' },
                                      }"
                                      display-field="name"
                                      value-field="id"
                                      placeholder="Mesin"
                                      :clearable="true"
                                      @input="(v: string) => (rRow.m_machine_id = v)"
                                      class="w-full text-[11px] h-7 min-w-[110px]"
                                    />
                                    <span v-else>{{ rRow.m_machine?.name || rRow.m_machine?.nama || rRow.m_machine_id || '-' }}</span>
                                  </td>

                                  <!-- Speed (/Menit + /Jam) -->
                                  <td class="py-1.5 px-2 text-right">
                                    <div class="flex flex-col items-end leading-tight px-1">
                                      <div v-if="!isReadOnly" class="flex items-center gap-1 justify-end">
                                        <input
                                          type="number"
                                          step="any"
                                          v-model="rRow.speed"
                                          class="w-[50px] px-1 py-0.5 border border-slate-200 dark:border-input bg-white dark:bg-input/30 rounded text-[11px] text-right focus:outline-none"
                                        />
                                        <span class="text-[10px] text-slate-400 dark:text-muted-foreground whitespace-nowrap">/mnt</span>
                                      </div>
                                      <span v-else class="font-medium text-slate-800 dark:text-slate-200">
                                        {{ Number(rRow.speed || 0).toLocaleString('id-ID') }} <span class="text-[10px] text-slate-500 font-normal">/mnt</span>
                                      </span>
                                      <span class="text-[10px] text-slate-500 dark:text-slate-400 font-normal whitespace-nowrap">
                                        {{ routingSpeedJamText(rRow) }}
                                      </span>
                                    </div>
                                  </td>

                                  <!-- Est. Qty Output -->
                                  <td class="py-1.5 px-2">
                                    <input
                                      v-if="!isReadOnly"
                                      type="number"
                                      v-model="rRow.qty"
                                      class="w-full px-1.5 py-0.5 border border-slate-200 dark:border-input bg-white dark:bg-input/30 rounded text-[11px] text-right focus:outline-none"
                                    />
                                    <span v-else class="text-right block px-1">{{ rRow.qty || 0 }}</span>
                                  </td>

                                  <!-- Type Output (m_general TIPE OUTPUT) -->
                                  <td class="py-1.5 px-2">
                                    <input
                                      type="text"
                                      :value="rRow.output_type_label || rRow.m_general_output?.value1 || rRow.m_item?.mi_tipe?.value1 || '-'"
                                      disabled
                                      readonly
                                      class="w-full px-2 py-1 border border-slate-200 dark:border-input rounded text-[11px] bg-slate-50 dark:bg-muted/50 text-slate-500 dark:text-muted-foreground cursor-not-allowed h-7 min-w-[90px]"
                                    />
                                  </td>

                                  <!-- WIP/FG (m_items) -->
                                  <td class="py-1.5 px-2">
                                    <FieldSelect
                                      v-if="!isReadOnly"
                                      :id="`r_wip_item_${getOriginalItemIdx(row)}_${getOriginalRoutingIdx(row, rRow)}`"
                                      :value="rRow.m_item_id || ''"
                                      :display-value="rRow.m_item?.nama_item || rRow.m_item?.nama || ''"
                                      :api="{
                                        url: `${API_BASE_URL}/dynamic/m_items`,
                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                                        params: {
                                          no_pagination: 'true',
                                          join: 'true',
                                          include: 'm_items_unit_bisnis',
                                          ...(values.m_unit_bisnis_id ? { 'filter_column_m_items_unit_bisnis.unit_bisnis_id': values.m_unit_bisnis_id } : {}),
                                        },
                                      }"
                                      display-field="nama_item"
                                      value-field="id"
                                      placeholder="Item WIP/FG"
                                      :clearable="true"
                                      @input="(v: string) => (rRow.m_item_id = v)"
                                      @update:valueFull="(item) => handleWipItemFullSelected(item, rRow)"
                                      class="w-full text-[11px] h-7 min-w-[130px]"
                                    />
                                    <span v-else>{{ rRow.m_item?.nama_item || rRow.m_item_id || '-' }}</span>
                                  </td>

                                  <!-- Plan Start -->
                                  <td class="py-1.5 px-2">
                                    <input
                                      v-if="!isReadOnly"
                                      type="datetime-local"
                                      v-model="rRow.plan_start"
                                      class="w-full px-1.5 py-0.5 border border-slate-200 dark:border-input bg-white dark:bg-input/30 rounded text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                    <span v-else class="text-xs font-mono">{{ formatDateTimeDisplay(rRow.plan_start) }}</span>
                                  </td>

                                  <!-- Plan End -->
                                  <td class="py-1.5 px-2">
                                    <!-- Routing BOM: read-only + auto-filled dari plan_start + time -->
                                    <input
                                      v-if="!isReadOnly && rRow.is_bom"
                                      type="datetime-local"
                                      :value="toDateTimeLocalValue(rRow.plan_finish)"
                                      readonly
                                      disabled
                                      class="w-full px-1.5 py-0.5 border border-slate-200 dark:border-input bg-slate-50 dark:bg-muted/50 rounded text-[11px] font-mono cursor-not-allowed opacity-75"
                                    />
                                    <!-- Routing manual: editable -->
                                    <input
                                      v-else-if="!isReadOnly"
                                      type="datetime-local"
                                      v-model="rRow.plan_finish"
                                      class="w-full px-1.5 py-0.5 border border-slate-200 dark:border-input bg-white dark:bg-input/30 rounded text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                    <span v-else class="text-xs font-mono">{{ formatDateTimeDisplay(rRow.plan_finish) }}</span>
                                  </td>

                                  <!-- Durasi (Menit + Jam) -->
                                  <td class="py-1.5 px-2 text-right">
                                    <div class="flex flex-col items-end leading-tight px-1">
                                      <span class="font-medium text-slate-800 dark:text-slate-200">
                                        {{ routingDurasiMenit(rRow).toLocaleString('id-ID') }} <span class="text-[10px] text-slate-500 font-normal">Mnt</span>
                                      </span>
                                      <span class="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                                        {{ routingDurasiJamText(rRow) }}
                                      </span>
                                    </div>
                                  </td>

                                  <!-- Qty Result (Readonly) -->
                                  <td class="py-1.5 px-2 text-right text-slate-500 dark:text-muted-foreground">0</td>

                                  <!-- Catatan -->
                                  <td class="py-1.5 px-2">
                                    <input v-if="!isReadOnly" type="text" v-model="rRow.notes" class="w-full px-1.5 py-0.5 border border-slate-200 dark:border-input bg-white dark:bg-input/30 rounded text-[11px]" />
                                    <span v-else>{{ rRow.notes || '-' }}</span>
                                  </td>
                                </tr>

                                <!-- ==================================================== -->
                                <!-- LEVEL 3 TABLE (INLINE ACCORDION: t_wo_sd_materials) -->
                                <!-- ==================================================== -->
                                <tr v-if="expandedRoutingIdx === getOriginalRoutingIdx(row, rRow) && expandedItemIdx === getOriginalItemIdx(row)" class="bg-[#F8FDFD] dark:bg-cyan-950/10">
                                  <td colspan="15" class="p-4 border-b border-slate-200 dark:border-border">
                                    <div class="space-y-3 bg-white dark:bg-card p-4 border border-cyan-100 dark:border-cyan-900/50 rounded-lg shadow-sm ml-6">
                                      <!-- TOP ACTION & SEARCH BAR -->
                                      <div class="flex items-center justify-start gap-2 pb-1">
                                        <input
                                          v-model="searchMaterialQuery"
                                          placeholder="Cari Material..."
                                          class="h-7 w-40 px-2.5 py-0.5 border border-cyan-200 dark:border-input rounded-md text-[9px] focus:outline-none focus:ring-1 focus:ring-cyan-500 bg-white dark:bg-input/30 shadow-sm font-normal"
                                        />
                                        <Button
                                          v-if="!isReadOnly"
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          class="h-7 text-[9px] border-cyan-100 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
                                          @click="addMaterialRowInline(getOriginalItemIdx(row), getOriginalRoutingIdx(row, rRow))"
                                        >
                                          <Plus class="h-3 w-3 mr-1" /> Tambah Material
                                        </Button>
                                      </div>

                                      <!-- HEADER BAR -->
                                      <div class="flex items-center justify-between border-b border-cyan-50 dark:border-cyan-900/40 pb-2 pt-1 border-t border-t-cyan-50 dark:border-t-cyan-900/40">
                                        <h5 class="font-bold text-cyan-800 dark:text-cyan-300 text-[11px] flex items-center gap-1.5">
                                          <span class="inline-block w-1.5 h-3 bg-[#00ACC1] rounded"></span>
                                          Kebutuhan Material
                                        </h5>
                                      </div>

                                      <!-- TABEL MATERIALS (TAMPIL HANYA JIKA ADA DATA) -->
                                      <div v-if="rRow.t_wo_sd_materials && rRow.t_wo_sd_materials.length > 0" class="overflow-x-auto border border-cyan-100 dark:border-cyan-900/50 rounded-md">
                                        <table class="w-full text-[10px] border-collapse">
                                          <!-- LEVEL 3 HEADERS -->
                                          <thead class="bg-cyan-50/50 dark:bg-cyan-950/30 border-b border-cyan-100 dark:border-cyan-900/50">
                                            <tr class="divide-x divide-cyan-100 dark:divide-cyan-900/50 text-cyan-900 dark:text-cyan-200">
                                              <th v-if="!isReadOnly" class="w-12 py-1.5 px-2 text-center"></th>
                                              <th class="w-10 py-1.5 px-2 text-left font-semibold">No</th>
                                              <th class="min-w-40 py-1.5 px-2 text-left font-semibold">Material</th>
                                              <th class="min-w-[120px] py-1.5 px-2 text-left font-semibold">Type</th>
                                              <th class="w-16 py-1.5 px-2 text-center font-semibold">Main</th>
                                              <th class="w-20 py-1.5 px-2 text-left font-semibold">Qty</th>
                                              <th class="w-20 py-1.5 px-2 text-left font-semibold">UoM</th>
                                              <th class="w-20 py-1.5 px-2 text-left font-semibold">Berat (Kg)</th>
                                              <th class="w-20 py-1.5 px-2 text-left font-semibold">Waste (%)</th>
                                              <th class="w-20 py-1.5 px-2 text-left font-semibold">Waste</th>
                                              <th class="w-20 py-1.5 px-2 text-left font-semibold">Qty Final</th>
                                              <th class="min-w-[140px] py-1.5 px-2 text-left font-semibold">Catatan</th>
                                            </tr>
                                          </thead>

                                          <!-- LEVEL 3 BODY -->
                                          <tbody>
                                            <tr
                                              v-for="(mRow, mIdx) in getFilteredMaterials(rRow)"
                                              :key="mIdx"
                                              class="divide-x divide-cyan-100 dark:divide-cyan-900/50 border-b border-cyan-100 dark:border-cyan-900/50 align-middle bg-white dark:bg-card"
                                            >
                                              <!-- Delete material row -->
                                              <td v-if="!isReadOnly" class="py-1.5 px-2 text-center">
                                                <button
                                                  type="button"
                                                  class="text-red-500 hover:text-red-700 dark:hover:bg-red-950/30 transition"
                                                  @click="removeMaterialRowInline(getOriginalItemIdx(row), getOriginalRoutingIdx(row, rRow), getOriginalMaterialIdx(rRow, mRow))"
                                                >
                                                  <Trash2 class="h-3.5 w-3.5" />
                                                </button>
                                              </td>

                                              <!-- No -->
                                              <td class="py-1.5 px-2 text-slate-500 dark:text-muted-foreground font-medium">{{ getOriginalMaterialIdx(rRow, mRow) + 1 }}</td>

                                              <!-- Material Item (m_items) -->
                                              <td class="py-1.5 px-2">
                                                <FieldSelect
                                                  v-if="!isReadOnly"
                                                  :id="`m_item_${getOriginalItemIdx(row)}_${getOriginalRoutingIdx(row, rRow)}_${getOriginalMaterialIdx(rRow, mRow)}`"
                                                  :value="mRow.m_item_id || ''"
                                                  :display-value="mRow.m_item?.nama_ite || mRow.m_item?.nama_item || ''"
                                                  :api="{
                                                    url: `${API_BASE_URL}/dynamic/m_items`,
                                                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                                                    params: {
                                                      no_pagination: 'true',
                                                      join: 'true',
                                                      searchfield: 'kode_item,nama_item',
                                                      include: 'm_items_unit_bisnis',
                                                      ...(values.m_unit_bisnis_id ? { 'filter_column_m_items_unit_bisnis.unit_bisnis_id': values.m_unit_bisnis_id } : {}),
                                                    },
                                                  }"
                                                  display-field="nama_item"
                                                  value-field="id"
                                                  placeholder="Material"
                                                  @input="(v: string) => (mRow.m_item_id = v)"
                                                  @update:valueFull="(item) => handleMaterialSelected(item, mRow)"
                                                  class="w-full text-[10px] h-7 min-w-[150px]"
                                                />
                                                <span v-else>{{ mRow.m_item?.nama_item || mRow.m_item_id || '-' }}</span>
                                              </td>

                                              <!-- Type (item_type_id: m_general TIPE ITEM) -->
                                              <td class="py-1.5 px-2">
                                                <input
                                                  type="text"
                                                  :value="mRow.item_type_label || mRow.as_type_sd_wo?.value1 || mRow.m_item?.mi_tipe?.value1 || '-'"
                                                  disabled
                                                  readonly
                                                  class="w-full px-2 py-1 border border-slate-200 rounded text-[10px] bg-slate-50 text-slate-500 cursor-not-allowed h-7 min-w-[100px] dark:bg-muted/50 dark:border-input"
                                                />
                                              </td>

                                              <!-- Main check -->
                                              <td class="py-1.5 px-2 text-center">
                                                <input type="checkbox" v-model="mRow.is_main" :disabled="isReadOnly" class="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 h-3 w-3" />
                                              </td>

                                              <!-- Qty -->
                                              <td class="py-1.5 px-2">
                                                <input
                                                  v-if="!isReadOnly"
                                                  type="number"
                                                  v-model="mRow.qty"
                                                  class="w-full px-1.5 py-0.5 border border-slate-200 rounded text-[10px] text-right focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:border-input"
                                                />
                                                <span v-else class="text-right block px-1">{{ mRow.qty || 0 }}</span>
                                              </td>

                                              <!-- UoM (m_general UOM) -->
                                              <td class="py-1.5 px-2">
                                                <FieldSelect
                                                  v-if="!isReadOnly"
                                                  :id="`m_unit_${getOriginalItemIdx(row)}_${getOriginalRoutingIdx(row, rRow)}_${getOriginalMaterialIdx(rRow, mRow)}`"
                                                  :value="mRow.unit_id || ''"
                                                  :display-value="mRow.m_general_unit?.value1 || ''"
                                                  :api="{
                                                    url: `${API_BASE_URL}/dynamic/m_general`,
                                                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                                                    params: { no_pagination: 'true', filter_column_group: 'UOM', selectfield: 'id,value1' },
                                                  }"
                                                  display-field="value1"
                                                  value-field="id"
                                                  placeholder="UOM"
                                                  @input="(v: string) => (mRow.unit_id = v)"
                                                  class="w-full bg-white text-[10px] h-7 min-w-[70px] dark:bg-muted/50"
                                                />
                                                <span v-else>{{ mRow.m_general_unit?.value1 || mRow.unit_id || '-' }}</span>
                                              </td>

                                              <!-- Berat -->
                                              <td class="py-1.5 px-2">
                                                <input
                                                  v-if="!isReadOnly"
                                                  type="number"
                                                  :value="mRow.weight"
                                                  :disabled="true"
                                                  class="w-full px-1.5 py-0.5 border border-slate-200 rounded text-[10px] text-right focus:outline-none bg-slate-50 text-slate-500 cursor-not-allowed dark:bg-muted/50 dark:border-input dark:text-muted-foreground"
                                                />
                                                <span v-else class="text-right block px-1">{{ mRow.weight || 0 }}</span>
                                              </td>

                                              <!-- Waste Pct -->
                                              <td class="py-1.5 px-2">
                                                <input v-if="!isReadOnly" type="number" v-model="mRow.waste_pct" class="w-full px-1.5 py-0.5 border border-slate-200 rounded text-[10px] text-right focus:outline-none dark:border-input" />
                                                <span v-else class="text-right block px-1">{{ mRow.waste_pct || 0 }}</span>
                                              </td>

                                              <!-- Waste Qty -->
                                              <td class="py-1.5 px-2">
                                                <input
                                                  v-if="!isReadOnly"
                                                  type="number"
                                                  :value="mRow.waste_qty"
                                                  :disabled="true"
                                                  class="w-full px-1.5 py-0.5 border border-slate-200 rounded text-[10px] text-right focus:outline-none bg-slate-50 text-slate-500 cursor-not-allowed dark:bg-muted dark:border-input dark:text-muted-foreground"
                                                />
                                                <span v-else class="text-right block px-1">{{ mRow.waste_qty || 0 }}</span>
                                              </td>

                                              <!-- Qty Final -->
                                              <td class="py-1.5 px-2">
                                                <span class="text-right block px-1 font-medium text-cyan-700 dark:text-cyan-300">{{ Number(mRow.qty || 0) + Number(mRow.waste_qty || 0) }}</span>
                                              </td>

                                              <!-- Catatan -->
                                              <td class="py-1.5 px-2">
                                                <input v-if="!isReadOnly" type="text" v-model="mRow.notes" class="w-full px-1.5 py-0.5 border border-slate-200 rounded text-[10px] dark:border-input" />
                                                <span v-else>{{ mRow.notes || '-' }}</span>
                                              </td>
                                            </tr>
                                          </tbody>
                                          <tfoot>
                                            <tr class="divide-x divide-cyan-100 dark:divide-cyan-900/50 bg-cyan-50/60 dark:bg-cyan-950/20 font-semibold text-cyan-900 dark:text-cyan-200">
                                              <td v-if="!isReadOnly" class="py-1.5 px-2"></td>
                                              <td colspan="4" class="py-1.5 px-2 text-right font-semibold text-[10px]">Total</td>
                                              <td class="py-1.5 px-2 text-right text-[10px]">{{ routingMaterialTotals(rRow).qty }}</td>
                                              <td class="py-1.5 px-2"></td>
                                              <td class="py-1.5 px-2"></td>
                                              <td class="py-1.5 px-2"></td>
                                              <td class="py-1.5 px-2 text-right text-[10px]">{{ routingMaterialTotals(rRow).waste }}</td>
                                              <td class="py-1.5 px-2 text-right text-[10px] font-medium text-cyan-700 dark:text-cyan-300">{{ routingMaterialTotals(rRow).final }}</td>
                                              <td class="py-1.5 px-2"></td>
                                            </tr>
                                          </tfoot>
                                        </table>
                                      </div>

                                      <!-- JIKA BELUM ADA DATA MATERIAL (DASHED BOX) -->
                                      <div v-else class="flex flex-col items-center justify-center py-4 border border-dashed border-cyan-100 rounded-lg bg-cyan-50/10 dark:bg-muted dark:border-input">
                                        <p class="text-[10px] text-cyan-700 mb-1.5">Belum ada kebutuhan material untuk step ini.</p>
                                        <Button
                                          v-if="!isReadOnly"
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          class="h-7 text-[9px] border-cyan-100 text-cyan-700 hover:bg-cyan-50"
                                          @click="addMaterialRowInline(getOriginalItemIdx(row), getOriginalRoutingIdx(row, rRow))"
                                        >
                                          <Plus class="h-3 w-3 mr-1" /> Tambah Material
                                        </Button>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              </template>
                            </tbody>
                          </table>
                        </div>

                        <!-- JIKA BELUM ADA DATA ROUTING (DASHED BOX) -->
                        <div v-else class="flex flex-col items-center justify-center py-6 border border-dashed border-slate-200 rounded-lg bg-slate-50/30 dark:bg-muted dark:border-input">
                          <p class="text-xs text-slate-500 mb-2">Belum ada langkah routing untuk item ini.</p>
                          <div class="flex items-center gap-2">
                            <ButtonMultiSelect
                              v-if="!isReadOnly"
                              title="Pilih Routing"
                              :disabled="loading"
                              uniqueKey="id"
                              :excludeIds="getSelectedRoutingIds(row)"
                              :api="{
                                url: `${API_BASE_URL}/dynamic/m_routing`,
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                                params: { join: 'all', searchfield: 'code,name' },
                                onsuccess: (response: any) => {
                                  response.hasNext = response.pagination?.next_page ? true : false;
                                  return response;
                                },
                              }"
                              :columns="[
                                { field: 'code', headerName: 'Kode', width: '160px', sortable: true, filterable: true },
                                { field: 'name', headerName: 'Nama', flex: 1, sortable: true, filterable: true },
                              ]"
                              @add="(selected: any[]) => addSelectedRoutings(getOriginalItemIdx(row), selected)"
                              buttonClass="h-7 text-[10px] px-3 bg-primary text-white hover:bg-primary/95"
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <!-- ACTION BUTTONS -->

      <AuditInfo v-if="isViewMode || isEditMode" :created-by="auditMeta.created_by" :created-at="auditMeta.createdAt" :updated-by="auditMeta.updated_by" :updated-at="auditMeta.updatedAt" class="mt-6" />

      <div class="flex items-center gap-3 justify-end pt-4">
        <Button type="button" variant="outline" @click="handleCancel" :disabled="loading">
          {{ isReadOnly ? 'Kembali' : 'Batal' }}
        </Button>
        <Button v-if="!isReadOnly" type="button" @click="onSave" :disabled="loading" class="gap-2">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          {{ isEditMode ? 'Perbarui' : 'Simpan' }}
        </Button>
      </div>
    </form>
  </div>

  <GlobalDialog
    :open="isWarningDialogOpen"
    type="warning"
    title="Perhatian"
    description="Masih bisa disimpan, tetapi mohon periksa kembali:"
    confirm-text="Tetap Simpan"
    cancel-text="Kembali"
    @confirm="confirmSave"
    @cancel="isWarningDialogOpen = false"
    @update:open="(v) => (isWarningDialogOpen = v)"
  >
    <ul class="list-disc pl-5 space-y-1 text-sm">
      <li v-for="(w, wi) in warningDialogList" :key="wi">{{ w }}</li>
    </ul>
  </GlobalDialog>
</template>

<style scoped>
.required::after {
  content: ' *';
  color: hsl(var(--destructive));
}
</style>
