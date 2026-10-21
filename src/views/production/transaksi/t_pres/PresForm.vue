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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiCall } from '@/lib/api';
import { FieldX, FieldDate, FieldDateTime, FieldSelect, FieldPopup, FieldTextarea, FieldTagInput } from '@/components/field';
import { ButtonMultiSelect } from '@/components/button';
import { Trash2, ArrowLeft, Save, Loader2, Plus } from 'lucide-vue-next';
import { useApi } from '@/composables/useApi';
import { useAuthStore } from '@/stores/auth';
import { usePermission } from '@/composables/usePermission';
import { createPres, updatePres, getPresById } from './service';

// ============================================================================
// SETUP
// ============================================================================
const authStore = useAuthStore();
const { isSuperAdmin } = usePermission();
const { API_BASE_URL } = useApi();
const router = useRouter();
const route = useRoute();

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
  const selectRespo = getSelectRespoData();
  const ubId = selectRespo?.m_unit_bisnis_id || selectRespo?.unitBisnisId || selectRespo?.companyId || '';
  if (ubId) {
    values.m_unit_bisnis_id = String(ubId);
    fetchUnitBisnisCompanyName(String(ubId));
  }
};

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false);
const isEditMode = computed(() => !!route.params.id && route.name === 'PresForm');
const isViewMode = computed(() => route.name === 'PresView');
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source);
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true || ['POST', 'CONFIRM', 'APPROVED', 'IN APPROVAL', 'REJECT'].includes((values.status || '').toUpperCase()));
const menuId = computed(() => route.params.id as string);

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Production Result';
  if (isCopyMode.value) return 'Salin Production Result';
  if (isEditMode.value) return 'Edit Production Result';
  return 'Tambah Production Result Baru';
});

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Production Result';
  if (isCopyMode.value) return 'Buat Production Result baru dari data yang disalin';
  if (isEditMode.value) return 'Perbarui data Production Result';
  return 'Buat Production Result baru';
});

// Form values mapping to t_pres schema columns
let values = reactive({
  id: '',
  m_unit_bisnis_id: '',
  no: '',
  date: new Date().toISOString().split('T')[0],
  flag: 'FG',
  t_wo_id: '',
  t_wo_d_item_id: '',
  t_wo_sd_routing_id: '',
  machine_id: '',
  to_warehouse_id: '',
  shift: '',
  date_start: '',
  date_end: '',
  total_time: '',
  is_overtime: false,
  overtime_reason: '',
  notes: '',
  status: 'DRAFT',
});

// Display labels for popup fields
const selectedWoLabel = ref('');
const selectedWoItemLabel = ref('');
const selectedWoRoutingLabel = ref('');
const selectedWoBomId = ref('');
const selectedUnitBisnisLabel = ref('');
const selectedUnitBisnisCompanyName = ref('');

// Detail arrays
const detailArr = ref<any[]>([]); // Result details
const detailArr2 = ref<any[]>([]); // Usage details
const detailArr3 = ref<any[]>([]); // Problem details

function formatBatchDate(dateVal: any): string {
  if (!dateVal) return '';
  const str = String(dateVal).split('T')[0] || '';
  if (str.includes('-')) {
    const parts = str.split('-');
    const [first, second, third] = parts;
    if (first && second && third) {
      if (first.length === 4) {
        return `${third}${second}${first}`;
      } else {
        return `${first}${second}${third}`;
      }
    }
  }
  if (str.includes('/')) {
    const parts = str.split('/');
    const [first, second, third] = parts;
    if (first && second && third) {
      if (third.length === 4) {
        return `${first}${second}${third}`;
      } else if (first.length === 4) {
        return `${third}${second}${first}`;
      }
    }
  }
  const clean = str.replace(/[^0-9]/g, '');
  if (clean.length >= 8) {
    if (clean.startsWith('20') || clean.startsWith('19')) {
      return `${clean.slice(6, 8)}${clean.slice(4, 6)}${clean.slice(0, 4)}`;
    }
    return clean.slice(0, 8);
  }
  return clean;
}

const defaultBatchPreview = computed(() => {
  const docPrefix = 'PRES';
  const no = (values.no || '').trim() || docPrefix;
  const formattedDate = formatBatchDate(values.date);
  return formattedDate ? `${no}-${formattedDate}` : no;
});

// Auto sync batch in detailArr if using default or empty
watch(defaultBatchPreview, (newBatch, oldBatch) => {
  if (!newBatch) return;
  detailArr.value.forEach((d: any) => {
    if (!d.batch || d.batch === oldBatch || d.batch === '-' || d.batch.startsWith('PRES-')) {
      const isBatch = Boolean(d.is_batch ?? d.m_item?.is_batch);
      if (isBatch) {
        d.batch = newBatch;
      }
    }
  });
});

// ============================================================================
// COMPUTED - AUTOMATIC DURATION
// ============================================================================
const safeParseDate = (val: any) => {
  if (!val) return null;
  if (val instanceof Date) return val;
  const str = String(val).trim();
  if (!str) return null;
  const formatted = str.includes('T') ? str : str.replace(' ', 'T');
  const d = new Date(formatted);
  return isNaN(d.getTime()) ? null : d;
};

const computedDurasi = computed(() => {
  if (!values.date_start || !values.date_end) return '';
  try {
    const start = safeParseDate(values.date_start);
    const end = safeParseDate(values.date_end);
    if (!start || !end) return '';
    const diff = end.getTime() - start.getTime();
    if (diff < 0) return '';

    // Sum non-running problem intervals
    let nonRunningMs = 0;
    detailArr3.value.forEach((p: any) => {
      const isRunning = p.is_running === true || p.is_running === 'true' || p.is_running === 1 || p.mesin_running === true || p.mesin_running === 'true' || p.mesin_running === 1;
      if (!isRunning && p.start && p.end) {
        const pStart = safeParseDate(p.start);
        const pEnd = safeParseDate(p.end);
        if (pStart && pEnd) {
          const pDiff = pEnd.getTime() - pStart.getTime();
          if (pDiff > 0) {
            nonRunningMs += pDiff;
          }
        }
      }
    });

    let finalDiff = diff - nonRunningMs;
    if (finalDiff < 0) finalDiff = 0;

    const h = Math.floor(finalDiff / 3600000);
    const m = Math.floor((finalDiff % 3600000) / 60000);
    const s = Math.floor((finalDiff % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  } catch (e) {
    return '';
  }
});

const selectedRoutingStep = ref<any>(null);

const isMachineRequired = computed(() => {
  if (!selectedRoutingStep.value) return false;
  const r = selectedRoutingStep.value;
  const isMesin = r.is_mesin ?? r.is_machine ?? r.m_routing?.is_mesin ?? r.m_routing?.is_machine;
  if (isMesin === false || isMesin === 0 || isMesin === 'false') return false;
  return true;
});

const computedIsOvertime = computed(() => {
  if (!values.date_start || !values.date_end || !selectedRoutingStep.value) return false;

  const start = safeParseDate(values.date_start);
  const end = safeParseDate(values.date_end);
  if (!start || !end) return false;
  const totalDurationMs = end.getTime() - start.getTime();
  if (totalDurationMs <= 0) return false;

  // Subtract non-running problems
  let nonRunningMs = 0;
  detailArr3.value.forEach((p: any) => {
    const isRunning = p.is_running === true || p.is_running === 'true' || p.is_running === 1 || p.mesin_running === true || p.mesin_running === 'true' || p.mesin_running === 1;
    if (!isRunning && p.start && p.end) {
      const pStart = safeParseDate(p.start);
      const pEnd = safeParseDate(p.end);
      if (pStart && pEnd) {
        const pDiff = pEnd.getTime() - pStart.getTime();
        if (pDiff > 0) {
          nonRunningMs += pDiff;
        }
      }
    }
  });

  const actualDurationMs = totalDurationMs - nonRunningMs;

  // Calculate plan duration
  const pStart = safeParseDate(selectedRoutingStep.value.plan_start);
  const pFinish = safeParseDate(selectedRoutingStep.value.plan_finish);

  if (!pStart || !pFinish) return false;
  const planDurationMs = pFinish.getTime() - pStart.getTime();

  return actualDurationMs > planDurationMs;
});

watch(computedDurasi, (newVal) => {
  values.total_time = newVal;
});

watch(computedIsOvertime, (newVal) => {
  values.is_overtime = newVal;
});

// ============================================================================
// MULTI SELECT CONFIGURATION
// ============================================================================
const resultMultiSelectApi = computed(() => {
  if (!values.t_wo_id) return undefined;
  return {
    url: `${API_BASE_URL}/dynamic/t_wo_d_item`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`,
    },
    params: {
      no_pagination: 'true',
      join: 'true',
      filter_column_t_wo_id: values.t_wo_id,
    },
  };
});

const resultMultiSelectColumns = [
  { field: 'm_item.kode_item', headerName: 'Kode Item', width: '150px', sortable: true, filterable: true, valueGetter: (params: any) => params.data?.m_item?.kode_item || '-' },
  { field: 'm_item.nama_item', headerName: 'Nama Item', width: '250px', sortable: true, filterable: true, valueGetter: (params: any) => params.data?.m_item?.nama_item || '-' },
  { field: 'qty', headerName: 'Qty WO', width: '120px' },
];

// IDs already in detail tables — used to exclude from popup
const selectedResultIds = computed(() => detailArr.value.map((d: any) => d.t_wo_d_item_id).filter(Boolean));
const selectedMaterialIds = computed(() => detailArr2.value.map((d: any) => d.t_mtf_d_id).filter(Boolean));

const materialMultiSelectApi = computed(() => {
  if (!values.t_wo_id) return undefined;
  return {
    url: `${API_BASE_URL}/dynamic/t_mtf_d`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`,
    },
    params: {
      no_pagination: 'true',
      join: 'true',
      'filter_column_t_mtf.t_wo_id': values.t_wo_id,
      ...(values.t_wo_d_item_id ? { 'filter_column_t_mtf.t_wo_d_item_id': values.t_wo_d_item_id } : {}),
      ...(values.t_wo_sd_routing_id ? { 'filter_column_t_mtf.t_wo_sd_routing_id': values.t_wo_sd_routing_id } : {}),
    },
  };
});

const materialMultiSelectColumns = [
  { field: 't_mtf.no', headerName: 'No. Transfer', width: '180px', sortable: true, filterable: true, valueGetter: (params: any) => params.data?.t_mtf?.no || '-' },
  { field: 'm_item.kode_item', headerName: 'Kode Material', width: '150px', sortable: true, filterable: true, valueGetter: (params: any) => params.data?.m_item?.kode_item || '-' },
  { field: 'm_item.nama_item', headerName: 'Nama Material', width: '250px', sortable: true, filterable: true, valueGetter: (params: any) => params.data?.m_item?.nama_item || '-' },
  { field: 'batch', headerName: 'Batch', width: '150px', sortable: true, filterable: true, valueGetter: (params: any) => params.data?.batch || '-' },
  { field: 'm_general.value1', headerName: 'UoM', width: '90px', valueGetter: (params: any) => params.data?.m_general?.value1 || '-' },
  { field: 'qty_confirm', headerName: 'Qty Confirm', width: '120px' },
  { field: 'qty_usage', headerName: 'Qty Usage', width: '120px' },
];

const handleResultsAdded = (selectedItems: any[]) => {
  selectedItems.forEach((item) => {
    if (!detailArr.value.find((d: any) => d.t_wo_d_item_id === item.id)) {
      const qtyWo = parseFloat(item.qty) || 0;
      const qtyReal = parseFloat(item.qty_accum) || 0;
      const defaultQty = qtyWo - qtyReal;
      const isBatch = Boolean(item.m_item?.is_batch ?? item.is_batch);
      detailArr.value.push({
        t_wo_d_item_id: item.id,
        item_type_id: item.item_type_id,
        m_item_id: item.m_item_id,
        m_item: item.m_item,
        is_batch: isBatch,
        tipe_item: item.item_type_id || '',
        tipe_item_label: item.as_item_type_wod?.value1 || '',
        no_wip_fg: item.m_item_id,
        batch: isBatch ? defaultBatchPreview.value || '' : '',
        qty_spk: qtyWo,
        qty_realisasi: 0,
        qty: 0,
        uom: item.unit_id || '',
        uom_label: item.as_unit_wod?.value1 || '',
        unit_id: item.unit_id || '',
        catatan: '',
      });
    }
  });
  toast.success(`${selectedItems.length} item berhasil ditambahkan ke Result`);
};

// Co-Product: ambil dari m_bom_d_coproduct berdasarkan m_bom_id dari t_wo_d_item WO header
const coProductMultiSelectApi = computed(() => {
  if (!selectedWoBomId.value) return undefined;
  return {
    url: `${API_BASE_URL}/dynamic/m_bom_d_coproduct`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`,
    },
    params: {
      no_pagination: 'true',
      join: 'true',
      filter_column_bom_id: selectedWoBomId.value,
    },
  };
});

const coProductMultiSelectColumns = [
  { field: 'm_item.kode_item', headerName: 'Kode Item', width: '150px', sortable: true, filterable: true, valueGetter: (params: any) => params.data?.m_item?.kode_item || '-' },
  { field: 'm_item.nama_item', headerName: 'Nama Item', width: '250px', sortable: true, filterable: true, valueGetter: (params: any) => params.data?.m_item?.nama_item || '-' },
  { field: 'bom_cp_type.value1', headerName: 'Tipe Item', width: '120px', valueGetter: (params: any) => params.data?.bom_cp_type?.value1 || params.data?.m_general?.value1 || '-' },
];

const handleCoProductAdded = (selectedItems: any[]) => {
  selectedItems.forEach((item) => {
    const isBatch = Boolean(item.m_item?.is_batch);
    const uomId = item.m_item?.uom_id || '';
    const row = reactive({
      t_wo_d_item_id: null,
      item_type_id: item.item_type_id || '',
      m_item_id: item.m_item_id,
      m_item: item.m_item,
      is_batch: isBatch,
      is_co_product: true,
      tipe_item: item.item_type_id || '',
      tipe_item_label: item.bom_cp_type?.value1 || item.m_general?.value1 || '',
      no_wip_fg: item.m_item_id,
      batch: isBatch ? defaultBatchPreview.value || '' : '',
      qty_spk: 0,
      qty_realisasi: 0,
      qty: 0,
      uom: uomId,
      uom_label: item.m_item?.mi_uom?.value1 || '',
      unit_id: uomId,
      catatan: '',
    });

    // Fetch UoM label jika belum tersedia dari join
    if (uomId && !row.uom_label) {
      apiCall(`/dynamic/m_general/${uomId}`)
        .then((r: any) => {
          if (r.status === 'success' && r.data) {
            row.uom_label = r.data.value1 || '';
          }
        })
        .catch(() => {});
    }

    detailArr.value.push(row);
  });
  toast.success(`${selectedItems.length} co-product berhasil ditambahkan ke Result`);
};

const handlePemakaianBahanAdded = (selectedItems: any[]) => {
  selectedItems.forEach((item) => {
    if (!detailArr2.value.find((d: any) => d.t_mtf_d_id === item.id)) {
      const qtyConfirm = parseFloat(item.qty_confirm || item.qty_transfer) || 0;
      const qtyUsage = parseFloat(item.qty_usage) || 0;
      const qtyAvailable = qtyConfirm - qtyUsage;
      const uomLabel = item.m_general?.value1 || item.m_general_unit?.value1 || item.uom_label || '';
      const uomId = item.uom_id || item.unit_id || '';
      const batchVal = item.batch && item.batch !== '-' ? item.batch : '';
      const row = reactive({
        t_mtf_d_id: item.id,
        m_item_id: item.m_item_id,
        m_item: item.m_item,
        no_material_transfer: item.id,
        no_material_transfer_label: item.t_mtf?.no || '',
        nama_material: item.m_item_id,
        batch: batchVal,
        qty: 0,
        qty_stock: qtyAvailable > 0 ? qtyAvailable : 0,
        uom: uomId,
        unit_id: uomId,
        uom_label: uomLabel,
        waste_persen: 0,
        waste: 0,
        catatan: '',
      });

      if (!row.batch && item.m_item_id) {
        const whId = values.to_warehouse_id;
        const filterWh = whId ? `&filter_column_stock_gudang.m_gudang_id=${whId}` : '';
        apiCall(`/dynamic/stock_gudang_d?filter_column_m_items_id=${item.m_item_id}${filterWh}&order_by=createdAt&order_type=DESC&limit=1`)
          .then((res: any) => {
            if (res?.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
              const b = res.data[0]?.batch;
              if (b && b !== '-') row.batch = b;
            }
          })
          .catch(() => {});
      }

      if (uomId && !uomLabel) {
        apiCall(`/dynamic/m_general/${uomId}`).then((r: any) => {
          if (r.status === 'success' && r.data) {
            row.uom_label = r.data.value1 || '';
          }
        });
      }

      detailArr2.value.push(row);
    }
  });
  toast.success(`${selectedItems.length} material berhasil ditambahkan`);
};

// ============================================================================
// DETAIL METHODS
// ============================================================================
const addDetailArr = () => {
  detailArr.value.push({
    tipe_item: '',
    no_wip_fg: '',
    is_batch: true,
    batch: defaultBatchPreview.value || '',
    qty_spk: 0,
    qty_realisasi: 0,
    qty: 0,
    uom: '',
    catatan: '',
  });
};

const removeDetailArr = (index: number) => {
  detailArr.value.splice(index, 1);
  toast.info('Detail Result dihapus');
};

const addDetailArr2 = () => {
  detailArr2.value.push({
    no_material_transfer: '',
    nama_material: '',
    qty: 0,
    uom: '',
    waste_persen: 0,
    waste: 0,
    catatan: '',
  });
};

const removeDetailArr2 = (index: number) => {
  detailArr2.value.splice(index, 1);
  toast.info('Detail Pemakaian Bahan dihapus');
};

const addDetailArr3 = () => {
  detailArr3.value.push({
    problem_start: '',
    problem_end: '',
    mesin_running: true,
    total_problem_menit: 0,
    catatan: '',
  });
};

const removeDetailArr3 = (index: number) => {
  detailArr3.value.splice(index, 1);
  toast.info('Detail Problem dihapus');
};

const fetchUnitBisnisCompanyName = async (unitBisnisId: string) => {
  if (!unitBisnisId) {
    selectedUnitBisnisLabel.value = '';
    selectedUnitBisnisCompanyName.value = '';
    return;
  }
  try {
    const response = await fetch(`${API_BASE_URL}/dynamic/m_unit_bisnis/${unitBisnisId}?join=true&include=m_company`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
    });
    const result = await response.json();
    if (result?.status === 'success' && result.data) {
      selectedUnitBisnisLabel.value = result.data.nama_comp || '';
      selectedUnitBisnisCompanyName.value = result.data?.m_company?.nama || result.data?.m_company?.kode || '-';
    }
  } catch (err) {
    console.error('Gagal mengambil nama company:', err);
  }
};

// ============================================================================
// POPUP EVENT HANDLERS
// ============================================================================
const handleUnitBisnisSelected = (item: any) => {
  if (item) {
    values.m_unit_bisnis_id = item.id || '';
    selectedUnitBisnisLabel.value = item.nama_comp || '';
    selectedUnitBisnisCompanyName.value = item.m_company?.nama || item.m_company?.kode || '';
    if (!selectedUnitBisnisCompanyName.value && item.id) {
      fetchUnitBisnisCompanyName(item.id);
    }
  } else {
    values.m_unit_bisnis_id = '';
    selectedUnitBisnisLabel.value = '';
    selectedUnitBisnisCompanyName.value = '';
  }
  // Clear WO references if Unit Bisnis changes
  values.t_wo_id = '';
  values.t_wo_d_item_id = '';
  values.t_wo_sd_routing_id = '';
  selectedWoLabel.value = '';
  selectedWoItemLabel.value = '';
  selectedWoRoutingLabel.value = '';
};

const handleWoSelected = async (item: any) => {
  if (item) {
    values.t_wo_id = item.id || '';
    selectedWoLabel.value = item.no || '';

    // Auto fill unit bisnis from WO
    if (item.m_unit_bisnis_id) {
      values.m_unit_bisnis_id = item.m_unit_bisnis_id;
      if (item.m_unit_bisni) {
        selectedUnitBisnisLabel.value = item.m_unit_bisni.nama_comp || '';
        selectedUnitBisnisCompanyName.value = item.m_unit_bisni.m_company?.nama || item.m_unit_bisni.m_company?.kode || '';
        if (!selectedUnitBisnisCompanyName.value) {
          fetchUnitBisnisCompanyName(item.m_unit_bisnis_id);
        }
      } else {
        fetchUnitBisnisCompanyName(item.m_unit_bisnis_id);
      }
    }

    try {
      const res = await apiCall<{ status: string; data: any }>(`/fn/t_wo/getWoDetail?id=${item.id}`);
      if (res.status === 'success' && res.data) {
        const fullWo = res.data;
        if (fullWo.t_wo_d_items && fullWo.t_wo_d_items.length > 0) {
          const dItem = fullWo.t_wo_d_items[0];
          values.t_wo_d_item_id = dItem.id;
          selectedWoBomId.value = dItem.m_bom_id || '';
          selectedWoItemLabel.value = dItem.m_item ? `${dItem.m_item.kode_item || dItem.m_item.kode || '-'} - ${dItem.m_item.nama_item || dItem.m_item.nama || '-'}` : dItem.id;

          if (dItem.t_wo_sd_routings && dItem.t_wo_sd_routings.length > 0) {
            const routing = dItem.t_wo_sd_routings[0];
            values.t_wo_sd_routing_id = routing.id;
            selectedWoRoutingLabel.value = routing.m_routing ? `${routing.m_routing.code || '-'}` : routing.id;
            selectedRoutingStep.value = routing;
            values.machine_id = routing.m_machine_id || '';
          } else {
            values.t_wo_sd_routing_id = '';
            selectedWoRoutingLabel.value = '';
            selectedRoutingStep.value = null;
            values.machine_id = '';
          }
        } else {
          values.t_wo_d_item_id = '';
          selectedWoBomId.value = '';
          selectedWoItemLabel.value = '';
          values.t_wo_sd_routing_id = '';
          selectedWoRoutingLabel.value = '';
        }
      }
    } catch (error) {
      console.error('Gagal memuat detail Work Order terpilih', error);
    }
  } else {
    values.t_wo_id = '';
    selectedWoLabel.value = '';
    values.t_wo_d_item_id = '';
    selectedWoBomId.value = '';
    selectedWoItemLabel.value = '';
    values.t_wo_sd_routing_id = '';
    selectedWoRoutingLabel.value = '';
  }
};

const handleWoRoutingFullSelected = (item: any) => {
  selectedRoutingStep.value = item || null;
  if (item) {
    values.t_wo_sd_routing_id = item.id || '';
    selectedWoRoutingLabel.value = item.m_routing?.code || '';
    values.machine_id = item.m_machine_id || '';
  } else {
    values.t_wo_sd_routing_id = '';
    selectedWoRoutingLabel.value = '';
    values.machine_id = '';
  }
};

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    id: '',
    m_unit_bisnis_id: '',
    no: '',
    date: new Date().toISOString().split('T')[0],
    flag: 'FG',
    t_wo_id: '',
    t_wo_d_item_id: '',
    t_wo_sd_routing_id: '',
    machine_id: '',
    to_warehouse_id: '',
    shift: '',
    date_start: '',
    date_end: '',
    total_time: '',
    is_overtime: false,
    overtime_reason: '',
    notes: '',
    status: 'DRAFT',
  });

  selectedWoLabel.value = '';
  selectedWoItemLabel.value = '';
  selectedWoRoutingLabel.value = '';
  selectedUnitBisnisLabel.value = '';
  selectedUnitBisnisCompanyName.value = '';

  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = '';
  });

  detailArr.value = [];
  detailArr2.value = [];
  detailArr3.value = [];
  applyCurrentUserUnitBisnis();
};

// ============================================================================
// LIFECYCLE HOOKS - LOAD DATA BEFORE MOUNT
// ============================================================================
onBeforeMount(async () => {
  onReset();

  const isCopyModeLocal = route.query.action === 'copy' && route.query.source;
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value;

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return;
  }

  loading.value = true;
  try {
    const res = await getPresById(sourceId);
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

    const raw: any = res.data || {};
    values.id = raw.id ?? '';
    values.m_unit_bisnis_id = raw.m_unit_bussiness_id ?? raw.m_unit_bisnis_id ?? '';
    values.no = raw.no ?? '';
    values.date = (raw.date || '').slice(0, 10);
    values.flag = raw.flag ?? 'FG';
    values.t_wo_id = raw.t_wo_id ?? '';
    values.t_wo_d_item_id = raw.t_wo_d_item_id ?? '';
    values.t_wo_sd_routing_id = raw.t_wo_sd_routing_id ?? '';
    values.machine_id = raw.machine_id ?? '';
    values.to_warehouse_id = raw.to_warehouse_id ?? '';
    values.shift = raw.shift ?? '';
    values.date_start = raw.date_start ? raw.date_start.replace(' ', 'T') : '';
    values.date_end = raw.date_end ? raw.date_end.replace(' ', 'T') : '';
    values.total_time = raw.total_time ?? '';
    values.is_overtime = raw.is_overtime === true;
    values.overtime_reason = Array.isArray(raw.overtime_reason) ? raw.overtime_reason.join(', ') : (raw.overtime_reason ?? '');
    values.notes = raw.notes ?? '';
    values.status = raw.status ?? 'DRAFT';

    // Muat Statistik QC segera setelah id diketahui
    refreshStatqcTab();

    // Set labels
    if (raw.m_unit_bisni) {
      selectedUnitBisnisLabel.value = raw.m_unit_bisni.nama_comp || '';
      selectedUnitBisnisCompanyName.value = raw.m_unit_bisni.m_company?.nama || raw.m_unit_bisni.m_company?.kode || '';
      if (!selectedUnitBisnisCompanyName.value && values.m_unit_bisnis_id) {
        fetchUnitBisnisCompanyName(values.m_unit_bisnis_id);
      }
    } else if (values.m_unit_bisnis_id) {
      fetchUnitBisnisCompanyName(values.m_unit_bisnis_id);
    }
    if (raw.t_wo) {
      selectedWoLabel.value = raw.t_wo.no || '';
    }
    if (raw.t_wo_d_item_id) {
      apiCall(`/dynamic/t_wo_d_item/${raw.t_wo_d_item_id}?join=true`).then((r: any) => {
        if (r.status === 'success' && r.data) {
          const dItem = r.data;
          selectedWoItemLabel.value = dItem.m_item ? `${dItem.m_item.kode_item || dItem.m_item.kode || '-'} - ${dItem.m_item.nama_item || dItem.m_item.nama || '-'}` : dItem.id;
        }
      });
    }
    if (raw.t_wo_sd_routing_id) {
      apiCall(`/dynamic/t_wo_sd_routing/${raw.t_wo_sd_routing_id}`).then((r: any) => {
        if (r.status === 'success' && r.data) {
          selectedRoutingStep.value = r.data;
          const routingId = r.data.m_routing_id;
          if (routingId) {
            apiCall(`/dynamic/m_routing/${routingId}`).then((mr: any) => {
              if (mr.status === 'success' && mr.data) {
                selectedWoRoutingLabel.value = mr.data.code || mr.data.nama || routingId;
              }
            });
          }
        }
      });
    }

    // Detail arrays
    const resultRaw = raw.t_pres_d_items || raw.Result || [];
    detailArr.value = resultRaw.map((item: any) => {
      const isBatch = Boolean(item.is_batch ?? item.m_item?.is_batch ?? item.batch);
      const rawBatch = item.batch && item.batch !== '-' ? item.batch : '';
      const batchVal = rawBatch || (isBatch ? defaultBatchPreview.value || '' : '');
      const row = reactive({
        ...item,
        is_batch: isBatch,
        batch: isBatch ? batchVal : '',
        tipe_item: item.item_type_id || item.tipe_item || '',
        tipe_item_label: item.tipe_item_label || '',
        no_wip_fg: item.m_item_id || item.no_wip_fg || '',
        qty_spk: item.qty_spk ?? (item.t_wo_d_item ? parseFloat(item.t_wo_d_item.qty) || 0 : 0),
        qty_realisasi: 0,
        qty: item.qty ?? 0,
        uom: item.unit_id || item.uom || '',
        uom_label: item.m_general?.value1 || item.uom_label || '',
        catatan: item.notes || item.catatan || '',
      });

      // Fetch Tipe Item Label if empty and UUID is valid
      if (row.tipe_item && !row.tipe_item_label) {
        apiCall(`/dynamic/m_general/${row.tipe_item}`).then((r: any) => {
          if (r.status === 'success' && r.data) {
            row.tipe_item_label = r.data.value1 || '';
          }
        });
      }

      // Fetch UoM Label if empty and UUID is valid
      if (row.uom && !row.uom_label) {
        apiCall(`/dynamic/m_general/${row.uom}`).then((r: any) => {
          if (r.status === 'success' && r.data) {
            row.uom_label = r.data.value1 || '';
          }
        });
      }

      return row;
    });

    const usageRaw = raw.t_pres_d_usages || raw.PemakaianBahan || [];
    detailArr2.value = usageRaw.map((usg: any) => {
      const row = reactive({
        ...usg,
        no_material_transfer: usg.t_mtf_d_id || usg.no_material_transfer || '',
        no_material_transfer_label: usg.no_material_transfer_label || usg.t_mtf_d?.t_mtf?.no || usg.t_mtf?.no || '',
        nama_material: usg.m_item_id || usg.nama_material || '',
        batch: usg.batch && usg.batch !== '-' ? usg.batch : usg.t_mtf_d?.batch && usg.t_mtf_d.batch !== '-' ? usg.t_mtf_d.batch : '',
        uom: usg.unit_id || usg.uom || '',
        uom_label: usg.m_general_unit?.value1 || usg.m_general?.value1 || usg.uom_label || '',
        waste_persen: usg.waste_pct || usg.waste_persen || 0,
        waste: usg.waste_qty || usg.waste || 0,
        catatan: usg.notes || usg.catatan || '',
      });

      // Fetch UoM Label if empty and UUID is valid
      if (row.uom && !row.uom_label) {
        apiCall(`/dynamic/m_general/${row.uom}`).then((r: any) => {
          if (r.status === 'success' && r.data) {
            row.uom_label = r.data.value1 || '';
          }
        });
      }

      return row;
    });

    const problemRaw = raw.t_pres_d_problems || raw.Problem || [];
    detailArr3.value = problemRaw.map((prob: any) => ({
      ...prob,
      problem_start: prob.start || prob.problem_start || '',
      problem_end: prob.end || prob.problem_end || '',
      mesin_running: prob.is_running === true || prob.is_running === 'true' || prob.is_running === 1 || prob.mesin_running === true || prob.mesin_running === 'true' || prob.mesin_running === 1,
      total_problem_menit: prob.total_time || prob.total_problem_menit || '',
      kategori_problem: prob.problem_reason_id || prob.kategori_problem || '',
      catatan: prob.notes || prob.catatan || '',
    }));

    if (isCopyModeLocal) {
      values.id = '';
      values.no = '';
      values.status = 'DRAFT';
      detailArr.value = detailArr.value.map((row) => ({ ...row, id: undefined, t_pres_id: undefined }));
      detailArr2.value = detailArr2.value.map((row) => ({ ...row, id: undefined, t_pres_id: undefined }));
      detailArr3.value = detailArr3.value.map((row) => ({ ...row, id: undefined, t_pres_id: undefined }));
      toast.success('Data berhasil disalin', { description: 'Silakan edit dan simpan sebagai Production Result baru' });
    } else {
      toast.success('Data berhasil dimuat');
    }
  } catch (error) {
    toast.error('Gagal memuat data Production Result', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
    });
    setTimeout(() => router.push('/production/transaksi/t_pres'), 2000);
  } finally {
    loading.value = false;
  }
});

// Errors object
const errors = reactive({
  m_unit_bisnis_id: '',
  date: '',
  t_wo_id: '',
  t_wo_sd_routing_id: '',
  machine_id: '',
  to_warehouse_id: '',
  date_start: '',
  date_end: '',
  overtime_reason: '',
});

// ============================================================================
// SAVE HANDLER
// ============================================================================
// ============================================================================
// STATISTIK QC (FG) — log QC yang mereferensikan Production Result FG ini
// ============================================================================
const qcLogs = ref<any[]>([]);
const loadingStatqc = ref(false);
const hasQcLogs = computed(() => qcLogs.value.length > 0);

// ============================================================================
// STATISTIK QC — statistik qty pass/reject & batch TIDAK disimpan di header
// t_qc; keduanya hidup di level detail:
//   - qty_pass / qty_reject  -> di t_qc_d_items (agregat per header QC)
//   - batch                  -> di t_pres_d_items yang direferensikan lewat
//                                t_qc_d_items.ref_id (ref_table = t_pres_d_items)
// Di sini header QC di-enrich: _qtyPass/_qtyReject/_batch supaya tabel
// Statistik QC bisa tampil dengan data nyata (bukan '-')
// ============================================================================
const qcBatchMap = ref<Record<string, string>>({});
const qcBatchFlagMap = ref<Record<string, boolean>>({});
const qcIdSet = () => new Set<string>();

const detailItemsOf = (qc: any): any[] => {
  if (!qc) return [];
  if (Array.isArray(qc.t_qc_d_items)) return qc.t_qc_d_items;
  if (Array.isArray(qc.t_qc_d_item)) return qc.t_qc_d_item;
  if (Array.isArray(qc.d_items)) return qc.d_items;
  return [];
};

const enrichStatqcRows = async (rows: any[]): Promise<any[]> => {
  if (!Array.isArray(rows)) return Array.isArray(rows) ? rows : [];
  const refIds = new Set<string>();
  rows.forEach((qc) => {
    detailItemsOf(qc).forEach((it) => {
      const rt = String(it?.ref_table || '');
      if (/^t_pres_d_item?$/.test(rt) && it?.ref_id) refIds.add(String(it.ref_id));
    });
  });

  // fetch batch per baris t_pres_d_items yang direferensikan (paling banyak
  // 1 item referensi per header QC; unik-kan ref_id utk hindari duplikasi)
  const unresolved = [...refIds].filter((id) => qcBatchMap.value[id] === undefined);
  await Promise.all(
    unresolved.map(async (idRef) => {
      try {
        const res: any = await apiCall(`/dynamic/t_pres_d_item/${idRef}?join=true`);
        if (res?.status === 'success' && res?.data) {
          const b = res.data.batch ?? res.data.batch_no ?? res.data.no_batch ?? '';
          qcBatchMap.value = { ...qcBatchMap.value, [idRef]: String(b || '') };
          qcBatchFlagMap.value = { ...qcBatchFlagMap.value, [idRef]: Boolean(res?.data?.is_batch ?? res?.data?.m_item?.is_batch ?? res?.data?.isBatch ?? false) };
        } else {
          qcBatchMap.value = { ...qcBatchMap.value, [idRef]: '' };
        }
      } catch (e) {
        qcBatchMap.value = { ...qcBatchMap.value, [idRef]: '' };
      }
    }),
  );

  return rows.map((qc) => {
    const det = detailItemsOf(qc);
    const pass = det.reduce((sum, it) => sum + (parseFloat(String(it?.qty_pass ?? it?.qty_ok ?? 0)) || 0), 0);
    const rej = det.reduce((sum, it) => sum + (parseFloat(String(it?.qty_reject ?? it?.qty_ng ?? 0)) || 0), 0);
    const firstRef = det.find((it) => /^t_pres_d_items?$/.test(String(it?.ref_table || '')) && it?.ref_id);
    const batch = firstRef ? qcBatchMap.value[String(firstRef.ref_id)] || '' : '';
    return {
      ...qc,
      _qtyPass: pass || null,
      _qtyReject: rej || null,
      _batch: firstRef && qcBatchFlagMap.value[String(firstRef.ref_id)] ? batch || qc?.batch || '' : '',
    };
  });
};

const refreshStatqcTab = async () => {
  qcLogs.value = [];
  if (!values.id) {
    qcLogs.value = [];
    return;
  }
  try {
    loadingStatqc.value = true;
    // Gabung 2 sumber: QC berbasis pres (INLINE + FINAL lama) dan
    // FINAL berbasis WO (gaya baru, via t_wo_id) — satu tabel
    const [presRes, woRes]: any[] = await Promise.all([
      apiCall(`/dynamic/t_qc?filter_column_ref_table=t_pres&filter_column_ref_id=${values.id}&filter_column_status=POST&join=ALL`),
      values.t_wo_id ? apiCall(`/dynamic/t_qc?filter_column_ref_table=t_wo&filter_column_ref_id=${values.t_wo_id}&filter_column_flag=FINAL&filter_column_status=POST&join=ALL`) : Promise.resolve(null),
    ]);
    const rowsOf = (res: any) => (res && res.status === 'success' ? (Array.isArray(res.data) ? res.data : res.data?.rows || []) : []);
    const seenIds = new Set<string>();
    const qcRows = [...rowsOf(presRes), ...rowsOf(woRes)]
      .filter((qc: any) => String(qc?.status || '').toUpperCase() === 'POST')
      .filter((qc: any) => {
        const key = String(qc?.id || '');
        if (!key || seenIds.has(key)) return false;
        seenIds.add(key);
        return true;
      });
    qcLogs.value = await enrichStatqcRows(qcRows);
  } catch (e) {
    qcLogs.value = [];
  } finally {
    loadingStatqc.value = false;
  }
};

const onSave = async () => {
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = '';
  });
  let invalid = false;
  if (!values.m_unit_bisnis_id) {
    errors.m_unit_bisnis_id = 'Unit bisnis wajib diisi';
    invalid = true;
  }
  if (!values.date) {
    errors.date = 'Tanggal wajib diisi';
    invalid = true;
  }
  if (!values.t_wo_id) {
    errors.t_wo_id = 'No. WO wajib diisi';
    invalid = true;
  }
  if (!values.t_wo_sd_routing_id) {
    errors.t_wo_sd_routing_id = 'Route wajib diisi';
    invalid = true;
  }
  if (isMachineRequired.value && !values.machine_id) {
    errors.machine_id = 'Mesin wajib diisi';
    invalid = true;
  }
  if (!values.to_warehouse_id) {
    errors.to_warehouse_id = 'Gudang wajib diisi';
    invalid = true;
  }
  if (!values.date_start) {
    errors.date_start = 'Process Start wajib diisi';
    invalid = true;
  }
  if (!values.date_end) {
    errors.date_end = 'Process End wajib diisi';
    invalid = true;
  }
  if (values.is_overtime && !values.overtime_reason?.trim()) {
    errors.overtime_reason = 'Alasan lembur wajib diisi jika terdeteksi overtime';
    invalid = true;
  }

  if (values.date_start && values.date_end) {
    const start = new Date(values.date_start);
    const end = new Date(values.date_end);
    const diff = end.getTime() - start.getTime();
    if (diff < 0) {
      errors.date_end = 'Process End tidak boleh mendahului Process Start';
      invalid = true;
    }
  }

  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' });
    return;
  }

  // Validasi detail Result: qty harus lebih dari 0 (sesuai ketentuan, Qty awal terisi Qty WO - Realisasi, tapi bisa diganti)
  for (let i = 0; i < detailArr.value.length; i++) {
    const d = detailArr.value[i]!;
    const rowNum = i + 1;
    const qtyVal = Number(d.qty ?? 0);
    if (qtyVal <= 0) {
      toast.error('Validasi detail gagal', { description: `Baris ${rowNum} (Result): Qty harus lebih dari 0` });
      return;
    }
  }

  // Validasi detail Pemakaian Bahan: qty tidak boleh 0 dan tidak melebihi qty_stock (outstanding)
  for (let i = 0; i < detailArr2.value.length; i++) {
    const d = detailArr2.value[i]!;
    const rowNum = i + 1;
    const qtyVal = Number(d.qty ?? 0);
    if (qtyVal <= 0) {
      toast.error('Validasi detail gagal', { description: `Baris ${rowNum} (Pemakaian Bahan): Qty harus lebih dari 0` });
      return;
    }
    const qtyOs = Number(d.qty_stock ?? 0);
    if (qtyOs > 0 && qtyVal > qtyOs) {
      toast.error('Validasi detail gagal', { description: `Baris ${rowNum} (Pemakaian Bahan): Qty (${qtyVal}) tidak boleh melebihi Qty Outstanding (${qtyOs})` });
      return;
    }
  }

  loading.value = true;
  try {
    const payload = {
      ...values,
      date_start: values.date_start ? new Date(values.date_start).toISOString() : undefined,
      date_end: values.date_end ? new Date(values.date_end).toISOString() : undefined,
      Result: detailArr.value.map((item) => {
        const isB = Boolean(item.is_batch ?? item.m_item?.is_batch ?? item.batch);
        const isPlaceholder = !values.no && item.batch && (item.batch.startsWith('PRES-') || item.batch.startsWith('PRES-WIP-')) && item.batch.split('-').length === 2;
        return {
          ...item,
          batch: isB ? (isPlaceholder ? null : item.batch || defaultBatchPreview.value || null) : null,
        };
      }),
      PemakaianBahan: detailArr2.value.map((usg) => ({
        ...usg,
        batch: usg.batch || null,
      })),
      Problem: detailArr3.value,
    };

    if (isEditMode.value) {
      await updatePres(menuId.value, payload);
      toast.success('Production Result berhasil diperbarui');
    } else {
      await createPres(payload);
      toast.success('Production Result berhasil dibuat');
    }
    router.replace('/production/transaksi/t_pres?reload=' + Date.now());
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Production Result' : 'Gagal membuat Production Result', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
    });
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  router.push('/production/transaksi/t_pres');
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
      <div class="flex-1">
        <h1 class="text-2xl font-bold text-foreground">
          {{ pageTitle }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ pageDescription }}
        </p>
      </div>
      <Badge variant="outline" class="border-blue-200 bg-blue-50 text-blue-600 font-semibold px-3 py-1 text-xs uppercase">
        {{ values.status }}
      </Badge>
    </div>

    <!-- ================================================================ -->
    <!-- FORM SECTION -->
    <!-- ================================================================ -->
    <form class="space-y-6" @submit.prevent>
      <!-- HEADER CARD -->
      <Card>
        <CardHeader>
          <CardTitle>Informasi Production Result</CardTitle>
          <CardDescription> Isi data Production Result dengan lengkap dan benar </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- 2-Column Layout to reduce empty space -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-5">
            <!-- ======================== PANEL KIRI ======================== -->
            <div class="space-y-5">
              <!-- Unit Bisnis & Company Side-by-Side -->
              <div class="grid grid-cols-2 gap-4">
                <FieldSelect
                  id="m_unit_bisnis_id"
                  label="Unit Bisnis"
                  :value="values.m_unit_bisnis_id"
                  :display-value="selectedUnitBisnisLabel"
                  :errorText="errors.m_unit_bisnis_id ? 'failed' : ''"
                  :hints="errors.m_unit_bisnis_id || 'Pilih unit bisnis'"
                  :disabled="loading || isReadOnly || isEditMode || isUnitBisnisReadonly"
                  :readonly="isReadOnly || isEditMode || isUnitBisnisReadonly"
                  :clearable="true"
                  :required="!isReadOnly"
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
                      include: 'm_company',
                    },
                  }"
                  display-field="nama_comp"
                  value-field="id"
                  placeholder="Pilih Unit Bisnis"
                  @input="(v) => (values.m_unit_bisnis_id = v)"
                  @update:valueFull="handleUnitBisnisSelected"
                  class="w-full"
                />

                <FieldX id="company_display" label="Company" :value="selectedUnitBisnisCompanyName || '-'" :disabled="true" :readonly="true" placeholder="-" class="w-full opacity-70" />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <FieldX
                  id="no"
                  label="No. Production Result"
                  :value="values.no || 'Auto Generate'"
                  :required="false"
                  :disabled="true"
                  :readonly="true"
                  placeholder="Auto Generate"
                  hints="Nomor dibuat otomatis oleh sistem"
                  class="w-full opacity-70"
                />
                <FieldX
                  id="date"
                  label="Tanggal"
                  type="date"
                  v-model="values.date"
                  :errorname="errors.date ? 'failed' : ''"
                  :hints="errors.date || 'Tanggal pelaksanaan produksi'"
                  :required="!isReadOnly"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  class="w-full"
                />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <FieldSelect
                  id="shift"
                  label="Shift"
                  v-model="values.shift"
                  :required="!isReadOnly"
                  :hints="'Pilih shift kerja'"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  :clearable="true"
                  :options="[
                    { value: 'PAGI', label: 'PAGI' },
                    { value: 'SIANG', label: 'SIANG' },
                    { value: 'MALAM', label: 'MALAM' },
                  ]"
                  placeholder="Pilih Shift"
                  class="w-full"
                />

                <FieldSelect
                  id="to_warehouse_id"
                  label="Gudang Tujuan"
                  :value="values.to_warehouse_id"
                  :errorText="errors.to_warehouse_id ? 'failed' : ''"
                  :hints="errors.to_warehouse_id || 'Pilih gudang tujuan'"
                  :required="!isReadOnly"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  :clearable="true"
                  display-field="nama_gudang"
                  value-field="id"
                  placeholder="Pilih Gudang"
                  :api="{
                    url: `${API_BASE_URL}/dynamic/m_gudang`,
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authStore.token}`,
                    },
                    params: {
                      no_pagination: 'true',
                      searchfield: 'nama_gudang,kode_gudang',
                      filter_column_flag: 'PROD',
                      ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
                    },
                  }"
                  @input="(v) => (values.to_warehouse_id = v)"
                  class="w-full"
                />
              </div>

              <FieldTextarea id="notes" label="Catatan" v-model="values.notes" :disabled="loading || isReadOnly" :readonly="isReadOnly" placeholder="Tambahkan catatan jika ada" :rows="4" class="w-full" />
            </div>

            <!-- ======================== PANEL KANAN ======================== -->
            <div class="space-y-5">
              <div class="grid grid-cols-2 gap-4">
                <FieldPopup
                  id="t_wo_id"
                  label="No. WO"
                  :value="values.t_wo_id"
                  :disabled="loading || isReadOnly || isEditMode"
                  :readonly="isReadOnly || isEditMode"
                  :clearable="true"
                  :display-value="selectedWoLabel"
                  :api="{
                    url: `${API_BASE_URL}/dynamic/t_wo`,
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authStore.token}`,
                    },
                    params: {
                      searchfield: 'no,notes,notes',
                      order_by: 'createdAt',
                      order_type: 'DESC',
                      join: 'true',
                      filter_column_status: 'APPROVED',
                      filter_column_flag: values.flag || 'FG',
                      ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
                    },
                  }"
                  valueField="id"
                  displayField="no"
                  placeholder="Pilih WO"
                  :columns="[
                    { field: 'no', headerName: 'No. WO', width: '200px', sortable: true, filterable: true, filter: 'ColFilter' },
                    { field: 'm_customer.nama_customer', headerName: 'Customer', width: '200px', sortable: true, filterable: true, filter: 'ColFilter', valueGetter: (params: any) => params.data?.m_customer?.nama_customer || '-' },
                    { field: 'date', headerName: 'Tanggal WO', width: '150px', sortable: true, filterable: true, filter: 'ColFilter', valueGetter: (params: any) => (params.data?.date ? params.data.date.slice(0, 10) : '-') },
                    { field: 'status', headerName: 'Status', width: '120px', sortable: true, filterable: true, filter: 'ColFilter' },
                    { field: 'notes', headerName: 'Catatan', width: '250px', sortable: true, filterable: true, filter: 'ColFilter', valueGetter: (params: any) => params.data?.notes || '-' },
                  ]"
                  @input="(v) => (values.t_wo_id = v)"
                  @update:valueFull="handleWoSelected"
                  class="w-full"
                />

                <FieldX id="t_wo_d_item_id" label="Item WO" :value="selectedWoItemLabel" :readonly="true" placeholder="-" class="w-full opacity-70" />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <FieldPopup
                  id="t_wo_sd_routing_id"
                  label="Route WO"
                  :value="values.t_wo_sd_routing_id"
                  :disabled="loading || isReadOnly || !values.t_wo_id"
                  :readonly="isReadOnly"
                  :clearable="true"
                  :display-value="selectedWoRoutingLabel"
                  :api="{
                    url: `${API_BASE_URL}/dynamic/t_wo_sd_routing`,
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authStore.token}`,
                    },
                    params: {
                      searchfield: 'notes',
                      order_by: 'sequence',
                      order_type: 'ASC',
                      join: 'true',
                      ...(values.t_wo_id ? { filter_column_t_wo_id: values.t_wo_id } : {}),
                      ...(values.t_wo_d_item_id ? { filter_column_t_wo_d_item_id: values.t_wo_d_item_id } : {}),
                    },
                  }"
                  valueField="id"
                  displayField="m_routing.code"
                  placeholder="Pilih Route"
                  :columns="[
                    { field: 'sequence', headerName: 'Seq', width: '90px', sortable: true },
                    { field: 'm_routing.code', headerName: 'Kode Routing', width: '150px', sortable: true },
                    { field: 'm_item.kode_item', headerName: 'Item Output', width: '150px', sortable: true },
                    { field: 'qty', headerName: 'Qty', width: '120px', sortable: true },
                  ]"
                  @input="(v) => (values.t_wo_sd_routing_id = v)"
                  @update:valueFull="handleWoRoutingFullSelected"
                  class="w-full"
                />

                <FieldSelect
                  id="machine_id"
                  label="Mesin"
                  :value="values.machine_id"
                  :errorText="errors.machine_id ? 'failed' : ''"
                  :hints="errors.machine_id || 'Pilih mesin'"
                  :required="isMachineRequired && !isReadOnly"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  :clearable="true"
                  display-field="name"
                  value-field="id"
                  placeholder="Pilih Mesin"
                  :api="{
                    url: `${API_BASE_URL}/dynamic/m_mesin`,
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authStore.token}`,
                    },
                    params: {
                      no_pagination: 'true',
                      searchfield: 'name,code',
                    },
                  }"
                  @input="(v) => (values.machine_id = v)"
                  class="w-full"
                />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <FieldDateTime
                  id="date_start"
                  label="Process Start"
                  v-model="values.date_start"
                  :errorname="errors.date_start ? 'failed' : ''"
                  :hints="errors.date_start || 'Mulai proses'"
                  :required="!isReadOnly"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  class="w-full"
                />
                <FieldDateTime
                  id="date_end"
                  label="Process End"
                  v-model="values.date_end"
                  :errorname="errors.date_end ? 'failed' : ''"
                  :hints="errors.date_end || 'Selesai proses'"
                  :required="!isReadOnly"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  class="w-full"
                />
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <FieldX id="total_time" label="Jumlah Jam (Durasi)" v-model="values.total_time" :required="false" :disabled="true" :readonly="true" placeholder="00:00:00" class="w-full" />

                <div class="flex items-center space-x-3 pt-6">
                  <div class="flex items-center space-x-2">
                    <input id="is_overtime" type="checkbox" :checked="values.is_overtime" disabled class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary opacity-70 cursor-not-allowed" />
                    <label for="is_overtime" class="text-sm font-medium text-foreground cursor-not-allowed opacity-70">Lembur (Overtime)</label>
                  </div>
                </div>
              </div>

              <div v-if="values.is_overtime" class="w-full">
                <FieldX
                  id="overtime_reason"
                  label="Alasan Lembur"
                  v-model="values.overtime_reason"
                  :required="!isReadOnly"
                  :errorname="errors.overtime_reason ? 'failed' : ''"
                  :hints="errors.overtime_reason || 'Masukkan alasan lembur'"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  placeholder="Masukkan alasan lembur..."
                  class="w-full"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- DETAIL TABS -->
      <Tabs default-value="detail1" class="w-full">
        <TabsList class="w-full flex justify-start scrollbar-hide border-b">
          <TabsTrigger value="detail1" class="px-4 py-2 text-sm">Result</TabsTrigger>
          <TabsTrigger value="detail2" class="px-4 py-2 text-sm">Pemakaian Bahan</TabsTrigger>
          <TabsTrigger value="detail3" class="px-4 py-2 text-sm">Problem</TabsTrigger>
          <TabsTrigger value="statqc" class="px-4 py-2 text-sm gap-2">
            Statistik QC
            <span v-if="hasQcLogs" class="inline-flex items-center justify-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">{{ qcLogs.length }}</span>
          </TabsTrigger>
        </TabsList>

        <!-- TAB CONTENT: RESULT -->
        <TabsContent value="detail1" class="space-y-4 mt-4">
          <Card>
            <CardHeader class="pb-3">
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle class="text-base">Result Details</CardTitle>
                  <CardDescription class="text-xs">Daftar item output hasil produksi</CardDescription>
                </div>
                <div class="flex items-center gap-2">
                  <ButtonMultiSelect v-if="!isReadOnly" title="Add Co-Product" :disabled="loading || !selectedWoBomId" @add="handleCoProductAdded" :api="coProductMultiSelectApi" :columns="coProductMultiSelectColumns" uniqueKey="id" />
                  <ButtonMultiSelect
                    v-if="!isReadOnly"
                    title="Pilih Item Result"
                    :disabled="loading || !values.t_wo_id"
                    @add="handleResultsAdded"
                    :api="resultMultiSelectApi"
                    :columns="resultMultiSelectColumns"
                    :excludeIds="selectedResultIds"
                    uniqueKey="id"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto bg-card">
                <table class="w-full text-xs sm:text-sm">
                  <thead class="bg-slate-50 dark:bg-slate-900 border-b">
                    <tr>
                      <th class="px-3 py-2 text-center font-medium text-slate-500 w-[50px]">No</th>
                      <th class="px-3 py-2 text-left font-medium text-slate-500 min-w-[120px]">Tipe Item</th>
                      <th class="px-3 py-2 text-left font-medium text-slate-500 min-w-[200px]">No. WIP/FG (Item)</th>
                      <th class="px-3 py-2 text-left font-medium text-slate-500 min-w-[100px]">Batch</th>
                      <th class="px-3 py-2 text-right font-medium text-slate-500 min-w-[90px]">Qty WO</th>
                      <th class="px-3 py-2 text-right font-medium text-slate-500 min-w-[90px]">Qty Realisasi</th>
                      <th class="px-3 py-2 text-right font-medium text-slate-500 min-w-[90px]">Qty</th>
                      <th class="px-3 py-2 text-left font-medium text-slate-500 min-w-20">UoM</th>
                      <th class="px-3 py-2 text-left font-medium text-slate-500">Catatan</th>
                      <th v-if="!isReadOnly" class="px-2 py-2 text-center font-medium text-slate-500 w-20">Aksi</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    <tr v-if="detailArr.length === 0">
                      <td :colspan="isReadOnly ? 9 : 10" class="text-center py-6 text-muted-foreground text-xs">Belum ada item Result. Klik "Pilih Item Result"</td>
                    </tr>
                    <tr v-for="(detail, index) in detailArr" :key="index" class="hover:bg-slate-50/55 dark:hover:bg-slate-900/55">
                      <td class="px-3 py-2 text-center text-xs whitespace-nowrap">{{ index + 1 }}</td>
                      <td class="px-3 py-2 text-xs font-medium text-slate-700">
                        {{ detail.m_general_item_type?.value1 || detail.tipe_item_label || detail.tipe_item || '-' }}
                      </td>
                      <td class="px-3 py-2">
                        <FieldSelect
                          v-if="!isReadOnly"
                          id="no_wip_fg_select"
                          :value="detail.no_wip_fg"
                          :display-value="detail.m_item ? `${detail.m_item.kode_item || detail.m_item.kode || ''} - ${detail.m_item.nama_item || detail.m_item.nama || ''}` : ''"
                          :disabled="loading"
                          :clearable="true"
                          display-field="nama_item"
                          value-field="id"
                          placeholder="Pilih Item..."
                          :api="{
                            url: `${API_BASE_URL}/dynamic/m_items`,
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${authStore.token}`,
                            },
                            params: {
                              no_pagination: 'true',
                              join: 'true',
                            },
                          }"
                          @input="(v) => (detail.no_wip_fg = v)"
                          @update:valueFull="
                            (item) => {
                              if (item) {
                                detail.m_item = item;
                                detail.uom = item.mi_uom?.value1 || item.uom_id || '';
                                detail.tipe_item = item.mi_tipe?.value1 || detail.tipe_item || 'Finish Good';
                              }
                            }
                          "
                          class="w-full min-w-[180px]"
                        />
                        <span v-else class="text-xs">{{ detail.m_item ? `${detail.m_item.kode_item || detail.m_item.kode || ''} - ${detail.m_item.nama_item || detail.m_item.nama || ''}` : detail.no_wip_fg || '-' }}</span>
                      </td>
                      <td class="px-3 py-2">
                        <template v-if="detail.is_batch ?? detail.m_item?.is_batch">
                          <input v-if="!isReadOnly" v-model="detail.batch" type="text" class="w-full px-2 py-1 text-xs border rounded bg-background font-mono" :placeholder="defaultBatchPreview || 'No Prod Result + Tgl'" />
                          <span v-else-if="detail.batch || defaultBatchPreview" class="text-xs font-mono bg-muted px-2 py-1 rounded">
                            {{ detail.batch || defaultBatchPreview }}
                          </span>
                          <span v-else class="text-muted-foreground text-xs">-</span>
                        </template>
                        <span v-else class="text-muted-foreground text-xs">-</span>
                      </td>
                      <td class="px-3 py-2 text-right">
                        <span class="text-xs">{{ detail.qty_spk ?? 0 }}</span>
                      </td>
                      <td class="px-3 py-2 text-right">
                        <span class="text-xs">{{ detail.qty_realisasi ?? 0 }}</span>
                      </td>
                      <td class="px-3 py-2">
                        <input v-if="!isReadOnly" v-model.number="detail.qty" type="number" min="0" class="w-full px-2 py-1 text-xs border rounded text-right bg-background" placeholder="0" />
                        <span v-else class="block text-right text-xs">{{ detail.qty ?? 0 }}</span>
                      </td>
                      <td class="px-3 py-2 text-xs font-medium text-slate-700">
                        {{ detail.m_general_unit?.value1 || detail.uom_label || detail.uom || '-' }}
                      </td>
                      <td class="px-3 py-2">
                        <input v-if="!isReadOnly" v-model="detail.catatan" type="text" class="w-full px-2 py-1 text-xs border rounded bg-background" placeholder="Catatan" />
                        <span v-else class="text-xs">{{ detail.catatan || '-' }}</span>
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center whitespace-nowrap">
                        <Button @click="removeDetailArr(index)" size="icon" variant="ghost" class="h-7 w-7 text-rose-600 hover:text-rose-700">
                          <Trash2 class="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- TAB CONTENT: PEMAKAIAN BAHAN -->
        <TabsContent value="detail2" class="space-y-4 mt-4">
          <Card>
            <CardHeader class="pb-3">
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle class="text-base">Pemakaian Bahan Details</CardTitle>
                  <CardDescription class="text-xs">Daftar pemakaian bahan baku/material</CardDescription>
                </div>
                <div class="flex items-center gap-2">
                  <ButtonMultiSelect
                    v-if="!isReadOnly"
                    title="Pilih Material"
                    :disabled="loading || !values.t_wo_id"
                    @add="handlePemakaianBahanAdded"
                    :api="materialMultiSelectApi"
                    :columns="materialMultiSelectColumns"
                    :excludeIds="selectedMaterialIds"
                    uniqueKey="id"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto bg-card">
                <table class="w-full text-xs sm:text-sm">
                  <thead class="bg-slate-50 dark:bg-slate-900 border-b">
                    <tr>
                      <th class="px-3 py-2 text-center font-medium text-slate-500 w-[50px]">No</th>
                      <th class="px-3 py-2 text-left font-medium text-slate-500 min-w-[130px]">No. Material Transfer</th>
                      <th class="px-3 py-2 text-left font-medium text-slate-500 min-w-[200px]">Nama Material (Item)</th>
                      <th class="px-3 py-2 text-left font-medium text-slate-500 min-w-[140px]">Batch</th>
                      <th class="px-3 py-2 text-right font-medium text-slate-500 min-w-[90px]">Qty</th>
                      <th class="px-3 py-2 text-left font-medium text-slate-500 min-w-20">UoM</th>
                      <th class="px-3 py-2 text-right font-medium text-slate-500 min-w-[90px]">Waste %</th>
                      <th class="px-3 py-2 text-right font-medium text-slate-500 min-w-[90px]">Waste Qty</th>
                      <th class="px-3 py-2 text-left font-medium text-slate-500">Catatan</th>
                      <th v-if="!isReadOnly" class="px-2 py-2 text-center font-medium text-slate-500 w-20">Aksi</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    <tr v-if="detailArr2.length === 0">
                      <td :colspan="isReadOnly ? 9 : 10" class="text-center py-6 text-muted-foreground text-xs">Belum ada item Pemakaian Bahan. Klik "Pilih Material"</td>
                    </tr>
                    <tr v-for="(detail, index) in detailArr2" :key="index" class="hover:bg-slate-50/55 dark:hover:bg-slate-900/55">
                      <td class="px-3 py-2 text-center text-xs whitespace-nowrap">{{ index + 1 }}</td>
                      <td class="px-3 py-2">
                        <input v-if="!isReadOnly" v-model="detail.no_material_transfer" type="text" class="w-full px-2 py-1 text-xs border rounded bg-background" placeholder="No. MT" />
                        <span v-else class="text-xs">{{ detail.no_material_transfer_label || detail.no_material_transfer || '-' }}</span>
                      </td>
                      <td class="px-3 py-2">
                        <FieldSelect
                          v-if="!isReadOnly"
                          id="nama_material_select"
                          :value="detail.nama_material"
                          :display-value="detail.m_item ? `${detail.m_item.kode_item || detail.m_item.kode || ''} - ${detail.m_item.nama_item || detail.m_item.nama || ''}` : ''"
                          :disabled="loading"
                          :clearable="true"
                          display-field="nama_item"
                          value-field="id"
                          placeholder="Pilih Material..."
                          :api="{
                            url: `${API_BASE_URL}/dynamic/m_items`,
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${authStore.token}`,
                            },
                            params: {
                              no_pagination: 'true',
                              join: 'true',
                            },
                          }"
                          @input="(v) => (detail.nama_material = v)"
                          @update:valueFull="
                            (item) => {
                              if (item) {
                                detail.m_item = item;
                                detail.uom = item.uom_id || item.unit_id || '';
                                detail.unit_id = detail.uom;
                                detail.uom_label = item.mi_uom?.value1 || item.m_general?.value1 || '';
                                if (detail.uom && !detail.uom_label) {
                                  apiCall(`/dynamic/m_general/${detail.uom}`).then((r: any) => {
                                    if (r.status === 'success' && r.data) {
                                      detail.uom_label = r.data.value1 || '';
                                    }
                                  });
                                }
                              }
                            }
                          "
                          class="w-full min-w-[180px]"
                        />
                        <span v-else class="text-xs">{{ detail.m_item ? `${detail.m_item.kode_item || detail.m_item.kode || ''} - ${detail.m_item.nama_item || detail.m_item.nama || ''}` : detail.nama_material || '-' }}</span>
                      </td>
                      <td class="px-3 py-2">
                        <span v-if="detail.batch && detail.batch !== '-'" class="font-mono text-xs bg-muted px-2 py-1 rounded">
                          {{ detail.batch }}
                        </span>
                        <span v-else class="text-muted-foreground text-xs">-</span>
                      </td>
                      <td class="px-3 py-2">
                        <input
                          v-if="!isReadOnly"
                          v-model.number="detail.qty"
                          @input="detail.waste_persen = detail.qty ? Number(((Number(detail.waste || 0) / Number(detail.qty)) * 100).toFixed(2)) : 0"
                          type="number"
                          min="0"
                          class="w-full px-2 py-1 text-xs border rounded text-right bg-background"
                          placeholder="0"
                        />
                        <span v-else class="block text-right text-xs">{{ detail.qty ?? 0 }}</span>
                      </td>
                      <td class="px-3 py-2">
                        <span class="px-3 py-2 text-xs text-slate-500 uppercase">{{ detail.uom_label || detail.uom || '-' }}</span>
                      </td>
                      <td class="px-3 py-2">
                        <input :value="detail.waste_persen ?? 0" disabled readonly type="number" class="w-full px-2 py-1 text-xs border rounded text-right bg-muted cursor-not-allowed" placeholder="0" />
                      </td>
                      <td class="px-3 py-2">
                        <input
                          v-if="!isReadOnly"
                          v-model.number="detail.waste"
                          @input="detail.waste_persen = detail.qty ? Number(((Number(detail.waste || 0) / Number(detail.qty)) * 100).toFixed(2)) : 0"
                          type="number"
                          min="0"
                          class="w-full px-2 py-1 text-xs border rounded text-right bg-background"
                          placeholder="0"
                        />
                        <span v-else class="block text-right text-xs">{{ detail.waste ?? 0 }}</span>
                      </td>
                      <td class="px-3 py-2">
                        <input v-if="!isReadOnly" v-model="detail.catatan" type="text" class="w-full px-2 py-1 text-xs border rounded bg-background" placeholder="Catatan" />
                        <span v-else class="text-xs">{{ detail.catatan || '-' }}</span>
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center whitespace-nowrap">
                        <Button @click="removeDetailArr2(index)" size="icon" variant="ghost" class="h-7 w-7 text-rose-600 hover:text-rose-700">
                          <Trash2 class="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- TAB CONTENT: PROBLEM -->
        <TabsContent value="statqc" class="space-y-4 mt-4">
          <Card>
            <CardHeader class="pb-3">
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle class="text-base">Statistik QC</CardTitle>
                  <CardDescription class="text-xs">Riwayat Quality Control yang mereferensikan Production Result FG ini</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div v-if="loadingStatqc" class="flex items-center justify-center py-10">
                <Loader2 class="h-6 w-6 animate-spin" />
              </div>
              <div v-else-if="!qcLogs.length" class="flex flex-col items-center justify-center py-10 text-center">
                <p class="text-sm font-medium text-slate-600">Belum ada data Statistik QC</p>
                <p class="text-xs text-slate-400 mt-1">QC muncul di sini setelah inspeksi Quality Control diposting yang mereferensikan Production Result FG ini</p>
              </div>
              <div v-else class="border rounded-lg overflow-x-auto">
                <table class="w-full text-xs sm:text-sm">
                  <thead class="bg-slate-50 dark:bg-slate-900 border-b">
                    <tr>
                      <th class="px-3 py-2 text-center font-medium text-slate-500 w-10">No</th>
                      <th class="px-3 py-2 text-left font-medium text-slate-500 min-w-[140px]">No. QC</th>
                      <th class="px-3 py-2 text-left font-medium text-slate-500 min-w-[120px]">Batch</th>
                      <th class="px-3 py-2 text-center font-medium text-slate-500 min-w-20">Flag</th>
                      <th class="px-3 py-2 text-right font-medium text-slate-500 min-w-[90px]">Qty Pass</th>
                      <th class="px-3 py-2 text-right font-medium text-slate-500 min-w-[90px]">Qty Reject</th>
                      <th class="px-3 py-2 text-center font-medium text-slate-500 min-w-20">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    <tr v-for="(qc, i) in qcLogs" :key="qc.id || i" class="hover:bg-slate-50/55 dark:hover:bg-slate-900/55">
                      <td class="px-3 py-2 text-center text-slate-500">{{ i + 1 }}</td>
                      <td class="px-3 py-2 font-medium text-slate-700">{{ qc.no || qc.qc_no || '-' }}</td>
                      <td class="px-3 py-2 font-mono text-slate-600">{{ qc._batch || qc.batch || '-' }}</td>
                      <td class="px-3 py-2 text-center">
                        <Badge v-if="qc.flag" :variant="String(qc.flag).toUpperCase() === 'FG' ? 'default' : 'secondary'" class="text-[10px]">{{ qc.flag }}</Badge>
                      </td>
                      <td class="px-3 py-2 text-right font-mono text-slate-700">{{ qc._qtyPass ?? '-' }}</td>
                      <td class="px-3 py-2 text-right font-mono text-slate-700">{{ qc._qtyReject ?? '-' }}</td>
                      <td class="px-3 py-2 text-center">
                        <Badge :variant="String(qc.status || '').toUpperCase() === 'POST' ? 'default' : 'secondary'" class="text-[10px]">{{ qc.status || 'DRAFT' }}</Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detail3" class="space-y-4 mt-4">
          <Card>
            <CardHeader class="pb-3">
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle class="text-base">Problem Details</CardTitle>
                  <CardDescription class="text-xs">Daftar problem/kendala selama proses produksi</CardDescription>
                </div>
                <Button v-if="!isReadOnly" @click="addDetailArr3" size="sm" variant="outline" class="gap-1 text-xs"> <Plus class="h-3 w-3" /> Tambah Problem </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto bg-card">
                <table class="w-full text-xs sm:text-sm">
                  <thead class="bg-slate-50 dark:bg-slate-900 border-b">
                    <tr>
                      <th class="px-3 py-2 text-center font-medium text-slate-500 w-[50px]">No</th>
                      <th class="px-3 py-2 text-left font-medium text-slate-500 min-w-[150px]">Kategori Problem</th>
                      <th class="px-3 py-2 text-left font-medium text-slate-500 min-w-[150px]">Problem Start</th>
                      <th class="px-3 py-2 text-left font-medium text-slate-500 min-w-[150px]">Problem End</th>
                      <th class="px-3 py-2 text-center font-medium text-slate-500 min-w-[90px]">Mesin Running</th>
                      <th class="px-3 py-2 text-right font-medium text-slate-500 min-w-[90px]">Total Menit</th>
                      <th class="px-3 py-2 text-left font-medium text-slate-500">Catatan</th>
                      <th v-if="!isReadOnly" class="px-2 py-2 text-center font-medium text-slate-500 w-20">Aksi</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y">
                    <tr v-if="detailArr3.length === 0">
                      <td :colspan="isReadOnly ? 7 : 8" class="text-center py-6 text-muted-foreground text-xs">Belum ada problem dilaporkan. Klik "+ Tambah Problem"</td>
                    </tr>
                    <tr v-for="(detail, index) in detailArr3" :key="index" class="hover:bg-slate-50/55 dark:hover:bg-slate-900/55">
                      <td class="px-3 py-2 text-center text-xs whitespace-nowrap">{{ index + 1 }}</td>
                      <td class="px-3 py-2">
                        <input v-if="!isReadOnly" v-model="detail.kategori_problem" type="text" class="w-full px-2 py-1 text-xs border rounded bg-background" placeholder="Kategori" />
                        <span v-else class="text-xs">{{ detail.kategori_problem || '-' }}</span>
                      </td>
                      <td class="px-3 py-2">
                        <input v-if="!isReadOnly" v-model="detail.problem_start" type="datetime-local" class="w-full px-2 py-1 text-xs border rounded bg-background" />
                        <span v-else class="text-xs">{{ detail.problem_start ? new Date(detail.problem_start).toLocaleString('id-ID') : '-' }}</span>
                      </td>
                      <td class="px-3 py-2">
                        <input v-if="!isReadOnly" v-model="detail.problem_end" type="datetime-local" class="w-full px-2 py-1 text-xs border rounded bg-background" />
                        <span v-else class="text-xs">{{ detail.problem_end ? new Date(detail.problem_end).toLocaleString('id-ID') : '-' }}</span>
                      </td>
                      <td class="px-3 py-2 text-center">
                        <input v-if="!isReadOnly" v-model="detail.mesin_running" type="checkbox" class="h-4 w-4 rounded" />
                        <Badge v-else :variant="detail.mesin_running ? 'default' : 'destructive'" class="text-[10px]" :class="detail.mesin_running ? 'bg-green-500 hover:bg-green-600 text-white' : ''">
                          {{ detail.mesin_running ? 'YA' : 'TIDAK' }}
                        </Badge>
                      </td>
                      <td class="px-3 py-2">
                        <input v-if="!isReadOnly" v-model.number="detail.total_problem_menit" type="number" min="0" class="w-full px-2 py-1 text-xs border rounded text-right bg-background" placeholder="0" />
                        <span v-else class="block text-right text-xs">{{ detail.total_problem_menit ?? 0 }}</span>
                      </td>
                      <td class="px-3 py-2">
                        <input v-if="!isReadOnly" v-model="detail.catatan" type="text" class="w-full px-2 py-1 text-xs border rounded bg-background" placeholder="Catatan" />
                        <span v-else class="text-xs">{{ detail.catatan || '-' }}</span>
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center whitespace-nowrap">
                        <Button @click="removeDetailArr3(index)" size="icon" variant="ghost" class="h-7 w-7 text-rose-600 hover:text-rose-700">
                          <Trash2 class="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <!-- BUTTON ACTIONS -->

      <AuditInfo v-if="isViewMode || isEditMode" :created-by="auditMeta.created_by" :created-at="auditMeta.createdAt" :updated-by="auditMeta.updated_by" :updated-at="auditMeta.updatedAt" class="mt-6" />

      <div class="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6 border-t">
        <Button type="button" variant="outline" @click="handleCancel" :disabled="loading" class="w-full sm:w-auto"> Batal </Button>
        <Button v-if="!isReadOnly" type="button" @click="onSave" :disabled="loading" class="gap-2 w-full sm:w-auto">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          Simpan Production Result
        </Button>
      </div>
    </form>
  </div>
</template>
