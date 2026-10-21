<script setup lang="ts">
import AuditInfo from '@/components/AuditInfo.vue';

// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { toast } from 'vue-sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldX, FieldSelect, FieldPopup, FieldNumber } from '@/components/field';
import { ButtonMultiSelect } from '@/components/button';
import { ArrowLeft, Save, Loader2, Plus, Trash2, ChevronRight, ChevronDown, RotateCcw, Printer } from 'lucide-vue-next';
import { useApi } from '@/composables/useApi';
import { useAuthStore } from '@/stores/auth';
import { usePermission } from '@/composables/usePermission';
import { apiCall } from '@/lib/api';
import {
  createQc,
  updateQc,
  getQcById,
  detectAndMergeDuplicateItems,
  calculateSampleCount,
  type QcItem,
  type QcDetailItem,
  type QcSampleItem,
  type QcSubDetailCrit,
  type MItemRef,
  type MGeneralRef,
  type SourceRow,
  type UnitBisnisRef,
  type KaryawanRef,
  type GudangRef,
  type RefOption,
  type RoutingNode,
  type DynamicResponse,
  type PenerimaanDetailData,
  type PresDetailData,
  type WoDetailData,
  type WoDetailRow,
  type WoRoutingRow,
  type SaveQcPayload,
  type QcFormValues,
} from './service';
import type { AuditMeta } from '@/components/AuditInfo.vue';

// ============================================================================
// SETUP & PERMISSIONS
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
const auditMeta = ref<AuditMeta>({});
const isEditMode = computed(() => !!route.params.id && route.name === 'QcForm');
const isViewMode = computed(() => route.name === 'QcView');
const isCopyMode = computed(() => route.query.copy !== undefined || (route.query.action === 'copy' && !!route.query.source));
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true || ((values.flag || 'INCOMING') !== 'INLINE' && ['POST', 'CONFIRM', 'APPROVED', 'IN APPROVAL', 'REJECT'].includes((values.status || '').toUpperCase())));
const menuId = computed(() => route.params.id as string);

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Quality Control';
  if (isCopyMode.value) return 'Salin Quality Control';
  if (isEditMode.value) return 'Edit Quality Control';
  return 'Tambah Quality Control Baru';
});

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Quality Control';
  if (isCopyMode.value) return 'Buat Quality Control baru dari data yang disalin';
  if (isEditMode.value) return 'Perbarui data Quality Control';
  return 'Buat Quality Control baru';
});

const getTodayDateString = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getCurrentDateTimeString = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

// Form values matching backend schema
const values = reactive<QcFormValues>({
  id: '',
  m_unit_bisnis_id: '',
  no: '',
  date: getTodayDateString(),
  flag: 'INCOMING' as 'INCOMING' | 'INLINE' | 'FINAL',
  ref_table: 't_penerimaan_barangs',
  ref_id: '',
  m_warehouse_id: '',
  pic_id: '',
  notes: '',
  status: 'DRAFT' as 'DRAFT' | 'POST',
  sample_pct: '',
});

// Display state for popup fields
const selectedUnitBisnisCompanyName = ref<string>('');
const selectedRefNo = ref<string>('');
const selectedWarehouseName = ref<string>('');
const selectedPicName = ref<string>('');

// Dependent display state based on flag
const selectedPoNo = ref<string>('');
const selectedSupplierName = ref<string>('');
const selectedWoNo = ref<string>('');
const selectedItemName = ref<string>('');
const selectedRoutingName = ref<string>('');
const selectedWoQty = ref<number>(0);

// Sumber referensi untuk INLINE = flag pada t_pres: 'FG' atau 'WIP' (tidak ada tabel t_pres_wip)
const inlineRefSource = ref<'FG' | 'WIP'>('WIP');

const updateRefTableForFlag = () => {
  if (values.flag === 'INCOMING') values.ref_table = 't_penerimaan_barangs';
  else if (values.flag === 'FINAL') values.ref_table = 't_wo';
  else values.ref_table = 't_pres'; // INLINE (FG/WIP) merujuk ke t_pres
};

const resetRefDependent = () => {
  values.ref_id = '';
  selectedRefNo.value = '';
  selectedWarehouseName.value = '';
  values.m_warehouse_id = '';
  selectedPoNo.value = '';
  selectedSupplierName.value = '';
  selectedWoNo.value = '';
  selectedItemName.value = '';
  selectedRoutingName.value = '';
  selectedWoQty.value = 0;
  detailArr.value = [];
  expandedItems.value = {};
};

// Detail arrays
const detailArr = ref<QcDetailItem[]>([]);
const expandedItems = ref<Record<number, boolean>>({});

const toggleItemExpand = (idx: number) => {
  expandedItems.value[idx] = !expandedItems.value[idx];
};

// Errors object
const errors = reactive({
  m_unit_bisnis_id: '',
  date: '',
  flag: '',
  ref_id: '',
  m_warehouse_id: '',
  pic_id: '',
  sample_pct: '',
});

// Column configurations
const penerimaanColumns = [
  { field: 'no_penerimaan', headerName: 'No. Penerimaan', width: '200px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'tgl_penerimaan', headerName: 'Tgl Penerimaan', width: '130px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'm_gudang.nama_gudang', headerName: 'Gudang', width: '160px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'status', headerName: 'Status', width: '100px', sortable: true },
];

const presColumns = [
  { field: 'no', headerName: 'No. Production Result', width: '200px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 't_wo.no', headerName: 'No. WO', width: '180px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'date', headerName: 'Tanggal', width: '120px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'm_gudang.nama_gudang', headerName: 'Gudang Tujuan', width: '160px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'status', headerName: 'Status', width: '100px', sortable: true },
];

const woColumns = [
  { field: 'no', headerName: 'No. Work Order', width: '200px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'date', headerName: 'Tanggal', width: '130px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'status', headerName: 'Status', width: '100px', sortable: true },
];

const karyColumns = [
  {
    field: 'no_ktp',
    headerName: 'NIK / No. KTP',
    width: '180px',
    sortable: true,
    filterable: true,
    filter: 'ColFilter',
    valueGetter: (params: any) => params.data?.no_ktp || params.data?.kode_kary || '-',
  },
  {
    field: 'nama_kary',
    headerName: 'Nama Karyawan',
    width: '240px',
    sortable: true,
    filterable: true,
    filter: 'ColFilter',
  },
  {
    field: 'no_tlp',
    headerName: 'No. Telepon',
    width: '160px',
    sortable: true,
    filterable: true,
    filter: 'ColFilter',
    valueGetter: (params: any) => params.data?.no_tlp || '-',
  },
];

const warehouseColumns = [
  { field: 'kode_gudang', headerName: 'Kode Gudang', width: '140px', sortable: true, filterable: true, filter: 'ColFilter' },
  { field: 'nama_gudang', headerName: 'Nama Gudang', width: '220px', sortable: true, filterable: true, filter: 'ColFilter' },
];

// ============================================================================
// MULTI SELECT CONFIGURATION FOR DETAIL ITEMS
// ============================================================================
const detailMultiSelectApi = computed(() => {
  if (!values.ref_id) return undefined;

  if (values.flag === 'INCOMING') {
    return {
      url: `${API_BASE_URL}/dynamic/t_penerimaan_barang_d`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      params: {
        no_pagination: 'true',
        join: 'true',
        include: 'm_items>m_general@mi_uom,t_purchase_order',
        filter_column_t_penerimaan_barangs_id: values.ref_id,
      },
      onsuccess: (response: DynamicResponse<SourceRow[]>) => {
        if (response?.data && Array.isArray(response.data)) {
          const mapped = response.data.map((row: SourceRow) => {
            const itm: MItemRef = row.m_item || row.m_items || {};
            const uom = itm.mi_uom?.value1 || row.m_general?.value1 || '-';
            return {
              ...row,
              kode_item: itm.kode_item || '-',
              nama_item: itm.nama_item || '-',
              qc_tipe: (itm.qc_tipe || 'SAMPLING').toUpperCase(),
              qty_ref: parseFloat(String(row.qty_diterima ?? 0)),
              uom_name: uom,
            };
          });
          response.data = detectAndMergeDuplicateItems(mapped);
        }
        return response;
      },
    };
  }

  // FINAL (Lab Test): detail item dari Work Order (t_wo_d_item), qty_ref = qty WO
  if (values.flag === 'FINAL') {
    return {
      url: `${API_BASE_URL}/dynamic/t_wo_d_item`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      params: {
        no_pagination: 'true',
        join: 'true',
        include: 'm_items>m_general@mi_uom,m_general',
        filter_column_t_wo_id: values.ref_id,
      },
      onsuccess: (response: DynamicResponse<SourceRow[]>) => {
        if (response?.data && Array.isArray(response.data)) {
          const mapped = response.data.map((row: SourceRow) => {
            const itm: MItemRef = row.m_item || row.m_items || {};
            const uom = itm.mi_uom?.value1 || row.m_general?.value1 || '-';
            return {
              ...row,
              kode_item: itm.kode_item || '-',
              nama_item: itm.nama_item || '-',
              qc_tipe: (itm.qc_tipe || 'SAMPLING').toUpperCase(),
              qty_ref: parseFloat(String(row.qty ?? 0)),
              uom_name: uom,
            };
          });
          response.data = detectAndMergeDuplicateItems(mapped);
        }
        return response;
      },
    };
  }

  // INLINE: detail item dari Production Result (semua di t_pres_d_item;
  // pembeda FG vs WIP hanya di flag pada t_pres, bukan tabel terpisah)
  const parentKey = 't_pres_id';
  const srcTbl = 't_pres_d_item';

  return {
    url: `${API_BASE_URL}/dynamic/${srcTbl}`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`,
    },
    params: {
      no_pagination: 'true',
      join: 'true',
      include: 'm_items>m_general@mi_uom,m_general',
      [`filter_column_${parentKey}`]: values.ref_id,
    },
    onsuccess: (response: DynamicResponse<SourceRow[]>) => {
      if (response?.data && Array.isArray(response.data)) {
        const mapped = response.data.map((row: SourceRow) => {
          const itm: MItemRef = row.m_item || row.m_items || {};
          const uom = itm.mi_uom?.value1 || row.m_general?.value1 || '-';
          return {
            ...row,
            kode_item: itm.kode_item || '-',
            nama_item: itm.nama_item || '-',
            qc_tipe: (itm.qc_tipe || 'SAMPLING').toUpperCase(),
            qty_ref: parseFloat(String(row.qty ?? row.qty_result ?? 0)),
            uom_name: uom,
          };
        });
        response.data = detectAndMergeDuplicateItems(mapped);
      }
      return response;
    },
  };
});

const detailMultiSelectColumns = computed(() => {
  return [
    {
      field: 'kode_item',
      headerName: 'Kode Material',
      width: '160px',
      sortable: true,
      filterable: true,
      filter: 'ColFilter',
      valueGetter: (params: any) => params.data?.kode_item || params.data?.m_item?.kode_item || params.data?.m_items?.kode_item || '-',
    },
    {
      field: 'nama_item',
      headerName: 'Nama Material',
      width: '240px',
      sortable: true,
      filterable: true,
      filter: 'ColFilter',
      valueGetter: (params: any) => params.data?.nama_item || params.data?.m_item?.nama_item || params.data?.m_items?.nama_item || '-',
    },
    {
      field: 'qc_tipe',
      headerName: 'QC Type',
      width: '120px',
      sortable: true,
      valueGetter: (params: any) => params.data?.qc_tipe || (params.data?.m_item?.qc_tipe || params.data?.m_items?.qc_tipe || 'SAMPLING').toUpperCase(),
    },
    {
      field: 'qty_ref',
      headerName: 'Qty Reference',
      width: '130px',
      sortable: true,
      valueGetter: (params: any) => params.data?.qty_ref ?? params.data?.qty_diterima ?? params.data?.qty_confirm ?? params.data?.qty_transfer ?? 0,
    },
    {
      field: 'uom_name',
      headerName: 'UoM',
      width: '100px',
      sortable: true,
      valueGetter: (params: any) => params.data?.uom_name || params.data?.m_item?.mi_uom?.value1 || params.data?.m_items?.mi_uom?.value1 || params.data?.m_general?.value1 || '-',
    },
  ];
});

// Exclude ids of items already added to prevent duplicates (Rule 3)
const excludedDetailRefIds = computed(() => {
  const ids: string[] = [];
  detailArr.value.forEach((d) => {
    if (d.m_item_id) ids.push(d.m_item_id);
    if (d.ref_id) ids.push(d.ref_id);
    if (d.kode_item && d.kode_item !== '-') ids.push(d.kode_item);
  });
  return ids;
});

const isUnitBisnisReadonly = computed(() => {
  return !isSuperAdmin.value || isEditMode.value || isViewMode.value;
});

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

const handleUnitBisnisSelected = (item: UnitBisnisRef | null | undefined) => {
  values.m_unit_bisnis_id = item?.id || '';
  selectedUnitBisnisCompanyName.value = item?.m_company?.nama || item?.m_company?.kode || '';
  if (values.m_unit_bisnis_id) {
    errors.m_unit_bisnis_id = '';
  }
};

const handleFlagChange = (newFlag: 'INCOMING' | 'INLINE' | 'FINAL') => {
  if (values.flag === newFlag) return;

  values.flag = newFlag;
  updateRefTableForFlag();
  resetRefDependent();
};

const handleInlineRefSourceChange = (src: 'FG' | 'WIP') => {
  if (inlineRefSource.value === src) return;
  inlineRefSource.value = src;
  if (values.flag === 'INLINE') {
    updateRefTableForFlag();
    resetRefDependent();
  }
};

const getRoutingLabel = (routing?: RoutingNode | null) => {
  const routingMaster: RoutingNode = routing?.wo_sd_routing || routing?.m_routing || {};
  return routingMaster.code || routingMaster.name || routingMaster.nama || routingMaster.nama_routing || '-';
};

// Routing baris detail WO: key hasil JOIN mengikuti alias include (singular),
// baris client WO memakai plural — baca keduanya
const firstWoRoutingOf = (d: WoDetailRow | undefined): WoRoutingRow | undefined =>
  (d?.t_wo_sd_routing ?? d?.t_wo_sd_routings ?? [])[0];

const handleRefSelected = async (item: RefOption | null | undefined) => {
  if (!item) {
    values.ref_id = '';
    selectedRefNo.value = '';
    selectedWarehouseName.value = '';
    values.m_warehouse_id = '';
    selectedPoNo.value = '';
    selectedSupplierName.value = '';
    selectedWoNo.value = '';
    selectedItemName.value = '';
    selectedRoutingName.value = '';
    detailArr.value = [];
    expandedItems.value = {};
    return;
  }

  values.ref_id = item.id;
  if (values.ref_id) errors.ref_id = '';
  detailArr.value = [];
  expandedItems.value = {};

  if (values.flag === 'INCOMING') {
    values.ref_table = 't_penerimaan_barangs';
    selectedRefNo.value = item.no_penerimaan || '';
    values.m_warehouse_id = item.m_gudang_id || '';
    selectedWarehouseName.value = item.m_gudang?.nama_gudang || '';
    if (values.m_warehouse_id) errors.m_warehouse_id = '';
    selectedSupplierName.value = item.m_supplier?.nama || '';
    selectedPoNo.value = item.no_sj_supp || '-';

    try {
      const res = await apiCall<DynamicResponse<PenerimaanDetailData>>(`/dynamic/t_penerimaan_barangs/${item.id}?include=m_supplier,m_gudang,t_penerimaan_barang_d>m_items>m_general@mi_uom,t_penerimaan_barang_d>t_purchase_order`);
      if (res.status === 'success' && res.data) {
        const d = res.data;
        selectedSupplierName.value = d.m_supplier?.nama || selectedSupplierName.value;
        selectedWarehouseName.value = d.m_gudang?.nama_gudang || selectedWarehouseName.value;
        values.m_warehouse_id = d.m_gudang_id || values.m_warehouse_id;
        if (d.t_penerimaan_barang_ds && d.t_penerimaan_barang_ds.length > 0) {
          const po = d.t_penerimaan_barang_ds[0]?.t_purchase_order;
          if (po?.no_po || po?.no) selectedPoNo.value = po.no_po || po.no || '';
        }
      }
    } catch (err) {
      console.error('Failed to fetch full penerimaan detail:', err);
    }
  } else if (values.flag === 'FINAL') {
    // FINAL QC (Lab Test): referensi ke Work Order
    values.ref_table = 't_wo';
    selectedRefNo.value = item.no || '';
    // WO tidak membawa info gudang — warehouse dibiarkan (user pilih manual via popup)
    selectedWoNo.value = item.no || '';
    const woDets: WoDetailRow[] = item.t_wo_d_items || item.t_wo_ds || item.t_wo_d_item || [];
    selectedItemName.value = woDets[0]?.m_items?.nama_item || woDets[0]?.m_item?.nama_item || '-';
    selectedRoutingName.value = getRoutingLabel(firstWoRoutingOf(woDets[0]));
    selectedWoQty.value = woDets.reduce((s, d) => s + (parseFloat(String(d.qty)) || 0), 0);

    try {
      const res = await apiCall<DynamicResponse<WoDetailData>>(`/dynamic/t_wo/${item.id}?include=t_wo_d_item>m_items,t_wo_d_item>t_wo_sd_routing>m_routing`);
      if (res.status === 'success' && res.data) {
        const d = res.data;
        const dets: WoDetailRow[] = d.t_wo_d_items || d.t_wo_ds || d.t_wo_d_item || [];
        selectedRefNo.value = d.no || selectedRefNo.value;
        selectedWoNo.value = d.no || selectedWoNo.value;
        selectedItemName.value = dets[0]?.m_items?.nama_item || dets[0]?.m_item?.nama_item || selectedItemName.value;
        selectedRoutingName.value = getRoutingLabel(firstWoRoutingOf(dets[0])) || selectedRoutingName.value;
        selectedWoQty.value = dets.reduce((s, r) => s + (parseFloat(String(r.qty)) || 0), 0);
      }
    } catch (err) {
      console.error('Failed to fetch full Work Order detail:', err);
    }
  } else if (values.flag === 'INLINE') {
    values.ref_table = 't_pres';
    selectedRefNo.value = item.no || '';
    values.m_warehouse_id = item.to_warehouse_id || item.m_warehouse_id || '';
    selectedWarehouseName.value = item.m_gudang?.nama_gudang || '';
    selectedWoNo.value = item.t_wo?.no || '-';
    selectedItemName.value = item.t_wo_d_item?.m_items?.nama_item || item.t_wo_d_item?.m_item?.nama_item || '-';
    selectedRoutingName.value = getRoutingLabel(item.t_wo_sd_routing);

    try {
      const res = await apiCall<DynamicResponse<PresDetailData>>(`/dynamic/${values.ref_table}/${item.id}?include=t_wo,t_wo_d_item>m_items,t_wo_sd_routing>m_routing,m_gudang`);
      if (res.status === 'success' && res.data) {
        const d = res.data;
        selectedWoNo.value = d.t_wo?.no || selectedWoNo.value;
        selectedItemName.value = d.t_wo_d_item?.m_items?.nama_item || d.t_wo_d_item?.m_item?.nama_item || selectedItemName.value;
        selectedRoutingName.value = getRoutingLabel(d.t_wo_sd_routing) || selectedRoutingName.value;
        selectedWarehouseName.value = d.m_gudang?.nama_gudang || selectedWarehouseName.value;
        values.m_warehouse_id = d.to_warehouse_id || d.m_warehouse_id || values.m_warehouse_id;
      }
    } catch (err) {
      console.error('Failed to fetch full Production Result detail:', err);
    }
  }
};

const handlePicSelected = (item: KaryawanRef | null | undefined) => {
  values.pic_id = item?.id || '';
  selectedPicName.value = item?.nama_kary || '';
  if (values.pic_id) {
    errors.pic_id = '';
  }
};

const handleWarehouseSelected = (item: GudangRef | null | undefined) => {
  values.m_warehouse_id = item?.id || '';
  selectedWarehouseName.value = item?.nama_gudang || '';
  if (values.m_warehouse_id) {
    errors.m_warehouse_id = '';
  }
};

// Master QC Criteria from m_general
const masterQcCriteria = ref<MGeneralRef[]>([]);

const fetchMasterQcCriteria = async (): Promise<MGeneralRef[]> => {
  if (masterQcCriteria.value.length > 0) return masterQcCriteria.value;
  try {
    const res = await apiCall<DynamicResponse<MGeneralRef[]>>(
      '/dynamic/m_general?no_pagination=true&filter_column_group=QC_CRITERIA&selectfield=id,value1',
      { method: 'GET' }
    );
    if (res && Array.isArray(res.data)) {
      masterQcCriteria.value = res.data;
      return res.data;
    }
  } catch (err) {
    console.error('Failed to load master QC criteria:', err);
  }
  return [];
};

const syncMaterialSamples = (row: QcDetailItem) => {
  if (!row.samples) {
    row.samples = [];
  }
  const targetCount = calculateSampleCount(row.ref_qty, values.sample_pct);

  while (row.samples.length < targetCount) {
    const sIdx = row.samples.length;
    row.samples.push({
      sample_no: sIdx + 1,
      notes: `Sampel ${sIdx + 1}`,
      t_qc_sd_crits: [],
    });
  }

  if (row.samples.length > targetCount) {
    row.samples.splice(targetCount);
  }

  row.samples.forEach((s, idx) => {
    s.sample_no = idx + 1;
  });
};

const handleHeaderSamplePctChange = (val: string | number) => {
  values.sample_pct = val !== '' && val !== null && val !== undefined ? String(val) : '';
  const normalizedVal = String(values.sample_pct).replace(',', '.');
  const pct = parseFloat(normalizedVal);
  if (!isNaN(pct)) {
    if (pct < 0) values.sample_pct = '0';
    if (pct > 100) values.sample_pct = '100';
  }

  detailArr.value.forEach((row) => {
    syncMaterialSamples(row);
  });
};

const addManualSample = (row: QcDetailItem) => {
  if (!row.samples) row.samples = [];
  const sIdx = row.samples.length;
  row.samples.push({
    sample_no: sIdx + 1,
    notes: `Sampel ${sIdx + 1}`,
    t_qc_sd_crits: [],
  });
};

const removeSample = (row: QcDetailItem, sIdx: number) => {
  if (!row.samples || row.samples.length <= 1) return;
  row.samples.splice(sIdx, 1);
  row.samples.forEach((s, idx) => {
    s.sample_no = idx + 1;
  });
};

const addCriteriaToSample = (sample: QcSampleItem) => {
  if (!sample.t_qc_sd_crits) {
    sample.t_qc_sd_crits = [];
  }
  sample.t_qc_sd_crits.push({
    seq: sample.t_qc_sd_crits.length + 1,
    date: getCurrentDateTimeString(),
    m_qc_d_crit_id: '',
    qc_criteria: undefined,
    m_qc_d_opt_id: '',
    qc_value: undefined,
    note: '',
  });
};

const removeCriteriaFromSample = (sample: QcSampleItem, cIdx: number) => {
  if (!sample.t_qc_sd_crits) return;
  sample.t_qc_sd_crits.splice(cIdx, 1);
  sample.t_qc_sd_crits.forEach((c, i) => {
    c.seq = i + 1;
  });
};

const handleCriteriaSelect = (crit: QcSubDetailCrit, val: string, fullItem: MGeneralRef | null) => {
  crit.m_qc_d_crit_id = val || '';
  if (fullItem) crit.qc_criteria = fullItem;
};

const handleOptionSelect = (crit: QcSubDetailCrit, val: string, fullItem: MGeneralRef | null) => {
  crit.m_qc_d_opt_id = val || '';
  if (fullItem) crit.qc_value = fullItem;
};

// Detail item methods
const handleDetailsAdded = async (selectedRows: SourceRow[]) => {
  if (masterQcCriteria.value.length === 0) {
    await fetchMasterQcCriteria();
  }
  // Custom function mendeteksi dan menggabungkan item yang sama
  const consolidated = detectAndMergeDuplicateItems(selectedRows);
  let addedCount = 0;

  consolidated.forEach((row) => {
    const itemData: MItemRef = row.m_item || row.m_items || {};
    const itemId = row.m_items_id || row.m_item_id || itemData?.id;
    const itemCode = row.kode_item || itemData?.kode_item || '-';
    const itemName = row.nama_item || itemData?.nama_item || '-';
    const refQty = parseFloat(String(row.qty_ref ?? row.qty ?? row.qty_diterima ?? row.qty_confirm ?? row.qty_transfer ?? 0)) || 0;
    const uomName = row.uom_name || row.m_general?.value1 || itemData?.mi_uom?.value1 || '-';
    const unitId = row.unit_id || row.uom_id || itemData?.uom_id || '';
    const qcType = (row.qc_tipe || itemData?.qc_tipe || 'SAMPLING').toUpperCase();

    // Deteksi jika item yang sama sudah ada di tabel detail
    const existing = detailArr.value.find(
      (d) => (itemId && d.m_item_id === itemId) || (itemCode && itemCode !== '-' && d.kode_item === itemCode)
    );

    if (existing) {
      existing.ref_qty = Number(((parseFloat(String(existing.ref_qty)) || 0) + refQty).toFixed(4));
      syncMaterialSamples(existing);
      addedCount++;
      return;
    }

    const isIncoming = values.flag === 'INCOMING';
    const isFinal = values.flag === 'FINAL';
    const refTable = isIncoming ? 't_penerimaan_barang_d' : isFinal ? 't_wo_d_item' : 't_pres_d_item';

    const newIdx = detailArr.value.length;
    const newItem: QcDetailItem = {
      sequence: newIdx + 1,
      ref_table: refTable,
      ref_id: row.id,
      m_item_id: itemId,
      m_item: itemData,
      kode_item: itemCode,
      nama_item: itemName,
      qc_type: qcType,
      ref_qty: refQty,
      sample_pct: values.sample_pct || null,
      qty: 1,
      unit_id: unitId,
      uom_name: uomName,
      notes: '',
      samples: [],
      t_qc_sd_crits: [],
    };

    syncMaterialSamples(newItem);
    detailArr.value.push(newItem);
    expandedItems.value[newIdx] = true;
    addedCount++;
  });

  if (addedCount > 0) {
    toast.success(`${addedCount} Material berhasil ditambahkan`);
  }
};

const removeDetailArr = (index: number) => {
  detailArr.value.splice(index, 1);
  detailArr.value.forEach((d, i) => {
    d.sequence = i + 1;
  });
};

// ============================================================================
// DATA FETCHING FOR EDIT / VIEW / COPY
// ============================================================================
const fetchQcDetail = async (id: string) => {
  try {
    loading.value = true;
    const response = await getQcById(id);
    if (response.status === 'success' && response.data) {
      const data = response.data;
      auditMeta.value = {
        created_by: data.created_by,
        createdAt: data.createdAt,
        updated_by: data.updated_by,
        updatedAt: data.updatedAt,
      };

      values.id = isCopyMode.value ? '' : data.id;
      values.no = isCopyMode.value ? '' : data.no || '';
      values.date = (data.date ? String(data.date).split('T')[0] : '') || getTodayDateString();
      values.m_unit_bisnis_id = data.m_unit_bisnis_id || '';
      values.flag = data.flag === 'INLINE' || data.flag === 'FINAL' ? data.flag : 'INCOMING';
      if (values.flag === 'INLINE') {
        inlineRefSource.value = 'WIP';
        if (data.ref_id) {
          try {
            const refRes = await apiCall<DynamicResponse<{ flag?: string }>>(`/dynamic/t_pres/${data.ref_id}?include=flag`);
            if (refRes.status === 'success' && refRes.data?.flag) {
              inlineRefSource.value = refRes.data.flag === 'FG' ? 'FG' : 'WIP';
            }
          } catch {
            /* abaikan, default WIP */
          }
        }
      }
      updateRefTableForFlag();
      values.ref_table = data.ref_table || values.ref_table;
      values.ref_id = data.ref_id || '';
      values.m_warehouse_id = data.m_warehouse_id || '';
      values.pic_id = data.pic_id || '';
      values.notes = data.notes || '';
      values.status = isCopyMode.value ? 'DRAFT' : data.status === 'POST' ? 'POST' : 'DRAFT';
      values.sample_pct = data.sample_pct === null || data.sample_pct === undefined ? '0' : String(data.sample_pct);

      selectedUnitBisnisCompanyName.value = data.m_unit_bisnis?.m_company?.nama || '';
      selectedWarehouseName.value = data.m_gudang?.nama_gudang || '';
      selectedPicName.value = data.m_kary?.nama_kary || '';

      if (values.ref_id) {
        if (values.flag === 'INCOMING') {
          apiCall<DynamicResponse<PenerimaanDetailData>>(`/dynamic/t_penerimaan_barangs/${values.ref_id}?include=m_supplier,m_gudang,t_penerimaan_barang_d>t_purchase_order`).then((res) => {
            if (res.status === 'success' && res.data) {
              selectedRefNo.value = res.data.no_penerimaan || '';
              selectedSupplierName.value = res.data.m_supplier?.nama || '-';
              selectedPoNo.value = res.data.t_penerimaan_barang_ds?.[0]?.t_purchase_order?.no_po || res.data.t_penerimaan_barang_ds?.[0]?.t_purchase_order?.no || res.data.no_sj_supp || '-';
            }
          });
        } else if (values.flag === 'FINAL') {
          apiCall<DynamicResponse<WoDetailData>>(`/dynamic/t_wo/${values.ref_id}?include=t_wo_d_item>m_items,t_wo_d_item>t_wo_sd_routing>m_routing`).then((res) => {
            if (res.status === 'success' && res.data) {
              selectedRefNo.value = res.data.no || '';
              selectedWoNo.value = res.data.no || '';
              const dets: WoDetailRow[] = res.data.t_wo_d_items || res.data.t_wo_ds || res.data.t_wo_d_item || [];
              selectedItemName.value = dets[0]?.m_items?.nama_item || dets[0]?.m_item?.nama_item || '-';
              selectedRoutingName.value = getRoutingLabel(firstWoRoutingOf(dets[0]));
              selectedWoQty.value = dets.reduce((s, d) => s + (parseFloat(String(d.qty)) || 0), 0);
            }
          });
        } else if (values.flag === 'INLINE') {
          apiCall<DynamicResponse<PresDetailData>>(`/dynamic/${values.ref_table}/${values.ref_id}?include=t_wo,t_wo_d_item>m_items,t_wo_sd_routing>m_routing,m_gudang`).then((res) => {
            if (res.status === 'success' && res.data) {
              selectedRefNo.value = res.data.no || '';
              selectedWoNo.value = res.data.t_wo?.no || '-';
              selectedItemName.value = res.data.t_wo_d_item?.m_items?.nama_item || res.data.t_wo_d_item?.m_item?.nama_item || '-';
              selectedRoutingName.value = getRoutingLabel(res.data.t_wo_sd_routing);
            }
          });
        }
      }

      if (Array.isArray(data.t_qc_d_items)) {
        const materialMap = new Map<string, QcDetailItem>();

        data.t_qc_d_items.forEach((item: any, idx: number) => {
          const itemObj: MItemRef = item.m_items || item.m_item || {};
          const uomObj: MGeneralRef = item.m_general || itemObj.mi_uom || {};
          const qcType = (itemObj.qc_tipe || 'SAMPLING').toUpperCase();
          const itemId = item.m_item_id || itemObj.id || `item_${idx}`;
          const itemCode = itemObj.kode_item || item.kode_item || '-';
          const itemName = itemObj.nama_item || item.nama_item || '-';

          const crits: QcSubDetailCrit[] = Array.isArray(item.t_qc_sd_crits)
            ? item.t_qc_sd_crits.map((c: QcSubDetailCrit, cIdx: number) => ({
                id: isCopyMode.value ? undefined : c.id,
                seq: c.seq || cIdx + 1,
                date: c.date ? String(c.date).replace('Z', '') : getCurrentDateTimeString(),
                m_qc_d_crit_id: c.m_qc_d_crit_id || '',
                m_qc_d_opt_id: c.m_qc_d_opt_id || '',
                note: c.note || '',
                qc_criteria: c.qc_criteria || c.m_general_criteria,
                qc_value: c.qc_value || c.m_general_value,
              }))
            : [];

          const sampleItem: QcSampleItem = {
            id: isCopyMode.value ? undefined : item.id,
            sample_no: 1,
            notes: item.notes || `Sampel 1`,
            t_qc_sd_crits: crits,
          };

          if (!materialMap.has(itemId)) {
            const matRow: QcDetailItem = {
              id: isCopyMode.value ? undefined : item.id,
              sequence: materialMap.size + 1,
              ref_table: item.ref_table,
              ref_id: item.ref_id,
              m_item_id: item.m_item_id,
              m_item: itemObj,
              kode_item: itemCode,
              nama_item: itemName,
              qc_type: qcType,
              ref_qty: parseFloat(String(item.ref_qty ?? item.qty ?? 0)) || 0,
              sample_pct: values.sample_pct || '',
              unit_id: item.unit_id || itemObj.uom_id || '',
              uom_name: uomObj.value1 || '-',
              notes: item.notes || '',
              samples: [sampleItem],
            };
            materialMap.set(itemId, matRow);
          } else {
            const matRow = materialMap.get(itemId)!;
            sampleItem.sample_no = (matRow.samples?.length || 0) + 1;
            sampleItem.notes = item.notes || `Sampel ${sampleItem.sample_no}`;
            matRow.samples?.push(sampleItem);
          }
        });

        detailArr.value = Array.from(materialMap.values()).map((mat, mIdx) => {
          expandedItems.value[mIdx] = true;
          if (!mat.samples || mat.samples.length === 0) {
            syncMaterialSamples(mat);
          }
          return mat;
        });
      }
    }
  } catch (error: unknown) {
    toast.error('Gagal memuat detail Quality Control', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan pada server',
    });
  } finally {
    loading.value = false;
  }
};

// ============================================================================
// VALIDATION & SUBMISSION
// ============================================================================
const validateForm = (): boolean => {
  let isValid = true;

  errors.m_unit_bisnis_id = !values.m_unit_bisnis_id ? 'Unit Bisnis harus dipilih' : '';
  errors.date = !values.date ? 'Tanggal harus diisi' : '';
  errors.flag = !values.flag ? 'Flag harus dipilih' : '';
  errors.ref_id = !values.ref_id ? 'No Referensi harus dipilih' : '';
  errors.m_warehouse_id = !values.m_warehouse_id ? 'Warehouse harus dipilih' : '';
  errors.pic_id = !values.pic_id ? 'PIC harus dipilih' : '';
  errors.sample_pct = '';

  const missingFields: string[] = [];
  if (!values.m_unit_bisnis_id) missingFields.push('Unit Bisnis');
  if (!values.date) missingFields.push('Tanggal');
  if (!values.flag) missingFields.push('Flag');
  if (!values.ref_id) missingFields.push('No Referensi');
  if (!values.m_warehouse_id) missingFields.push('Warehouse');
  if (!values.pic_id) missingFields.push('PIC');

  if (missingFields.length > 0) {
    toast.error('Data Belum Lengkap', {
      description: `Harap lengkapi field wajib berikut: ${missingFields.join(', ')}`,
    });
    return false;
  }

  if (values.sample_pct !== undefined && values.sample_pct !== null && values.sample_pct !== '') {
    const pct = parseFloat(String(values.sample_pct).replace(',', '.'));
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error('% Sampling Tidak Valid', {
        description: '% Sampling harus berupa angka desimal antara 0–100',
      });
      return false;
    }
  }

  if (detailArr.value.length === 0) {
    toast.error('Detail Material Kosong', {
      description: 'Harap tambahkan minimal 1 item material untuk diinspeksi',
    });
    return false;
  }

  return isValid;
};

const onSave = async () => {
  if (!validateForm()) return;

  loading.value = true;
  try {
    const targetStatus = isEditMode.value ? values.status || 'DRAFT' : 'DRAFT';
    const parsedSamplePct = values.sample_pct !== '' && values.sample_pct !== null && values.sample_pct !== undefined
      ? parseFloat(String(values.sample_pct).replace(',', '.'))
      : null;
    const payloadItems: any[] = [];
    let globalSeq = 1;

    detailArr.value.forEach((material) => {
      const samples = material.samples && material.samples.length > 0
        ? material.samples
        : [{ sample_no: 1, notes: material.notes || 'Sampel 1', t_qc_sd_crits: [] }];

      samples.forEach((sample) => {
        payloadItems.push({
          ...(sample.id ? { id: sample.id } : {}),
          sequence: globalSeq++,
          ref_table: material.ref_table,
          ref_id: material.ref_id,
          m_item_id: material.m_item_id,
          qty: 1,
          qty_pass: null,
          qty_reject: null,
          unit_id: material.unit_id || null,
          notes: sample.notes || `Sampel ${sample.sample_no}`,
          sample_pct: parsedSamplePct,
          t_qc_sd_crits: (sample.t_qc_sd_crits || []).map((crit, cIdx) => ({
            ...(crit.id ? { id: crit.id } : {}),
            seq: cIdx + 1,
            date: crit.date || new Date().toISOString(),
            m_qc_d_crit_id: crit.m_qc_d_crit_id || null,
            m_qc_d_opt_id: crit.m_qc_d_opt_id || null,
            note: crit.note || '',
          })),
        });
      });
    });

    const payload: SaveQcPayload = {
      m_unit_bisnis_id: values.m_unit_bisnis_id,
      date: values.date,
      flag: values.flag,
      ref_table: values.ref_table,
      ref_id: values.ref_id,
      m_warehouse_id: values.m_warehouse_id,
      pic_id: values.pic_id,
      notes: values.notes,
      status: targetStatus,
      sample_pct: parsedSamplePct,
      t_qc_d_items: payloadItems,
    };

    if (isEditMode.value && values.id) {
      payload.id = values.id;
      payload.no = values.no;
      await updateQc(values.id, payload);
      toast.success('Quality Control berhasil diperbarui');
    } else {
      await createQc(payload);
      toast.success('Quality Control berhasil disimpan');
    }
    router.replace('/production/transaksi/t_qc?reload=' + Date.now());
  } catch (error: unknown) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Quality Control' : 'Gagal membuat Quality Control', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
    });
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  router.push('/production/transaksi/t_qc');
};

const handlePrintQc = () => {
  const qcId = values.id || route.params.id;
  if (!qcId) {
    toast.error('Data QC belum tersimpan untuk dicetak');
    return;
  }
  router.push({
    name: 'QcPrint',
    params: { id: String(qcId) },
  });
};

const applyCurrentUserUnitBisnis = () => {
  if (isSuperAdmin.value) return;
  try {
    const raw = localStorage.getItem('SelectRespo');
    if (!raw) return;
    const selectRespo = JSON.parse(raw);
    const ubId = selectRespo?.companyId || selectRespo?.m_unit_bisnis_id || selectRespo?.unitBisnisId || '';
    if (ubId) {
      values.m_unit_bisnis_id = String(ubId);
      fetchUnitBisnisCompanyName(String(ubId));
    }
  } catch (err) {
    console.error('Failed to parse SelectRespo:', err);
  }
};

// ============================================================================
// LIFECYCLE
// ============================================================================
onBeforeMount(async () => {
  await fetchMasterQcCriteria();
  const targetId = route.params.id || route.query.source || route.query.copy;
  if (targetId) {
    fetchQcDetail(String(targetId));
  } else {
    applyCurrentUserUnitBisnis();
  }
});
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
    <!-- ================================================================ -->
    <!-- HEADER SECTION -->
    <!-- ================================================================ -->
    <div class="flex items-center justify-between">
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
      <div class="flex items-center gap-2">
        <Button
          v-if="values.id"
          type="button"
          variant="outline"
          class="gap-2 border-primary text-primary hover:bg-primary/10"
          @click="handlePrintQc"
        >
          <Printer class="h-4 w-4" />
          Cetak QC Lapangan
        </Button>
      </div>
    </div>

    <!-- ================================================================ -->
    <!-- FORM SECTION -->
    <!-- ================================================================ -->
    <form class="space-y-6" @submit.prevent>
      <!-- HEADER CARD -->
      <Card>
        <CardHeader>
          <CardTitle>Informasi Quality Control</CardTitle>
          <CardDescription>Isi detail informasi Quality Control dengan lengkap</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Unit Bisnis selector -->
            <FieldSelect
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              :value="values.m_unit_bisnis_id"
              :display-value="values.m_unit_bisnis?.nama_comp || ''"
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
              :disabled="loading || isReadOnly || isUnitBisnisReadonly"
              :readonly="isReadOnly || isUnitBisnisReadonly"
              :clearable="!isUnitBisnisReadonly"
              :errorText="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id || 'Pilih unit bisnis untuk QC ini'"
              @input="(v) => (values.m_unit_bisnis_id = v)"
              @update:valueFull="handleUnitBisnisSelected"
              class="w-full"
            />

            <!-- Company (readonly) -->
            <FieldX id="company_display" label="Company" :value="selectedUnitBisnisCompanyName || '-'" :disabled="true" :readonly="true" placeholder="-" class="w-full opacity-70 bg-slate-50 dark:bg-muted/50" />

            <!-- No QC -->
            <FieldX
              id="no"
              label="No QC"
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
              :errorText="errors.date ? 'failed' : ''"
              @input="(v) => (values.date = v)"
              :hints="errors.date"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              class="w-full"
            />

            <!-- Flag (Radio Buttons) -->
            <div class="flex flex-col gap-2 w-full justify-center">
              <span class="text-xs font-semibold text-slate-700 dark:text-slate-200">Flag <span class="text-red-500">*</span></span>
              <div class="flex items-center gap-6 h-9">
                <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-normal cursor-pointer select-none">
                  <input
                    type="radio"
                    name="flag"
                    value="INCOMING"
                    :checked="values.flag === 'INCOMING'"
                    :disabled="loading || isReadOnly"
                    @change="handleFlagChange('INCOMING')"
                    class="h-4 w-4 border-slate-300 text-[#0F172A] focus:ring-[#0F172A]"
                  />
                  <span>Incoming</span>
                </label>
                <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-normal cursor-pointer select-none">
                  <input
                    type="radio"
                    name="flag"
                    value="INLINE"
                    :checked="values.flag === 'INLINE'"
                    :disabled="loading || isReadOnly"
                    @change="handleFlagChange('INLINE')"
                    class="h-4 w-4 border-slate-300 text-[#0F172A] focus:ring-[#0F172A]"
                  />
                  <span>Inline</span>
                </label>
                <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-normal cursor-pointer select-none">
                  <input type="radio" name="flag" value="FINAL" :checked="values.flag === 'FINAL'" :disabled="loading || isReadOnly" @change="handleFlagChange('FINAL')" class="h-4 w-4 border-slate-300 text-[#0F172A] focus:ring-[#0F172A]" />
                  <span>Final</span>
                </label>
              </div>
            </div>

            <!-- Referensi Penerimaan Barang (Incoming) -->
            <FieldPopup
              v-if="values.flag === 'INCOMING'"
              id="ref_id_incoming"
              label="No Reference (Penerimaan)"
              :value="values.ref_id"
              :display-value="selectedRefNo"
              :api="{
                url: `${API_BASE_URL}/dynamic/t_penerimaan_barangs`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: {
                  join: 'true',
                  include: 'm_supplier,m_gudang',
                  filter_column_status: 'POST',
                  ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
                },
              }"
              displayField="no_penerimaan"
              valueField="id"
              placeholder="Pilih Penerimaan Barang"
              :columns="penerimaanColumns"
              :clearable="true"
              :errorText="errors.ref_id ? 'failed' : ''"
              :hints="errors.ref_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              @update:valueFull="handleRefSelected"
              class="w-full"
            />

            <!-- Referensi Work Order (Final QC / Lab Test) -->
            <FieldPopup
              v-else-if="values.flag === 'FINAL'"
              id="ref_id_final"
              label="No Reference (Work Order)"
              :value="values.ref_id"
              :display-value="selectedRefNo"
              :api="{
                url: `${API_BASE_URL}/dynamic/t_wo`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: {
                  join: 'true',
                  filter_column_status: 'APPROVED',
                  ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
                },
              }"
              displayField="no"
              valueField="id"
              placeholder="Pilih Work Order"
              :columns="woColumns"
              :clearable="true"
              :errorText="errors.ref_id ? 'failed' : ''"
              :hints="errors.ref_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              @update:valueFull="handleRefSelected"
              class="w-full"
            />

            <!-- INLINE: pilih jenis Production Result (WIP / FG) lalu No Reference -->
            <template v-else-if="values.flag === 'INLINE'">
              <div class="flex flex-col gap-2 w-full justify-center">
                <span class="text-xs font-semibold text-slate-700 dark:text-slate-200">Jenis Production Result</span>
                <div class="flex items-center gap-6 h-9">
                  <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-normal cursor-pointer select-none">
                    <input
                      type="radio"
                      name="inline_ref_source"
                      value="WIP"
                      :checked="inlineRefSource === 'WIP'"
                      :disabled="loading || isReadOnly"
                      @change="handleInlineRefSourceChange('WIP')"
                      class="h-4 w-4 border-slate-300 text-[#0F172A] focus:ring-[#0F172A]"
                    />
                    <span>Pres WIP</span>
                  </label>
                  <label class="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 font-normal cursor-pointer select-none">
                    <input
                      type="radio"
                      name="inline_ref_source"
                      value="FG"
                      :checked="inlineRefSource === 'FG'"
                      :disabled="loading || isReadOnly"
                      @change="handleInlineRefSourceChange('FG')"
                      class="h-4 w-4 border-slate-300 text-[#0F172A] focus:ring-[#0F172A]"
                    />
                    <span>Pres FG</span>
                  </label>
                </div>
              </div>
              <FieldPopup
                id="ref_id_inline"
                label="No Reference (Production Result)"
                :value="values.ref_id"
                :display-value="selectedRefNo"
                :api="{
                  url: `${API_BASE_URL}/dynamic/t_pres`,
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                  params: {
                    join: 'true',
                    include: 't_wo,t_wo_d_item>m_items,t_wo_sd_routing>m_routing,m_gudang',
                    filter_column_flag: inlineRefSource,
                    filter_column_status: 'POST',
                    ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
                  },
                }"
                displayField="no"
                valueField="id"
                placeholder="Pilih Production Result"
                :columns="presColumns"
                :clearable="true"
                :errorText="errors.ref_id ? 'failed' : ''"
                :hints="errors.ref_id"
                :required="!isReadOnly"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                @update:valueFull="handleRefSelected"
                class="w-full"
              />
            </template>

            <!-- Dependent Fields: Incoming (No PO) -->
            <template v-if="values.flag === 'INCOMING'">
              <FieldX id="po_no" label="No PO" :value="selectedPoNo || '-'" :disabled="true" :readonly="true" class="w-full opacity-70 bg-slate-50 dark:bg-muted/50" />
            </template>

            <!-- Dependent Fields: Inline / Final (No WO, Item, Routing) -->
            <template v-else>
              <FieldX id="wo_no" label="No WO" :value="selectedWoNo || '-'" :disabled="true" :readonly="true" class="w-full opacity-70 bg-slate-50 dark:bg-muted/50" />
              <FieldX id="item_name" label="Item" :value="selectedItemName || '-'" :disabled="true" :readonly="true" class="w-full opacity-70 bg-slate-50 dark:bg-muted/50" />
              <FieldX id="routing_name" label="Routing" :value="selectedRoutingName || '-'" :disabled="true" :readonly="true" class="w-full opacity-70 bg-slate-50 dark:bg-muted/50" />
            </template>

            <!-- Warehouse (auto dari referensi; bisa pilih manual, mis. FINAL dari WO) -->
            <FieldPopup
              id="m_warehouse_id"
              label="Warehouse"
              :value="values.m_warehouse_id"
              :display-value="selectedWarehouseName"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_gudang`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: {
                  no_pagination: 'true',
                  ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {})
                },
              }"
              displayField="nama_gudang"
              valueField="id"
              placeholder="Pilih Warehouse"
              :columns="warehouseColumns"
              :clearable="true"
              :errorText="errors.m_warehouse_id ? 'failed' : ''"
              :hints="errors.m_warehouse_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              @input="(v: string) => { values.m_warehouse_id = v; if (v) errors.m_warehouse_id = ''; }"
              @update:valueFull="handleWarehouseSelected"
              class="w-full"
            />

            <!-- PIC -->
            <FieldPopup
              id="pic_id"
              label="PIC"
              :value="values.pic_id"
              :display-value="selectedPicName"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_kary`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: {
                  no_pagination: 'true',
                  searchfield: 'nama_kary,no_ktp,kode_kary',
                  filter_column_is_active: 'true',
                },
              }"
              displayField="nama_kary"
              valueField="id"
              placeholder="Pilih PIC"
              :columns="karyColumns"
              :clearable="true"
              :errorText="errors.pic_id ? 'failed' : ''"
              :hints="errors.pic_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              @input="(v: string) => (values.pic_id = v)"
              @update:valueFull="handlePicSelected"
              class="w-full"
            />

            <!-- % Sampling (Persentase Sampling di Header) -->
            <FieldNumber
              id="sample_pct"
              label="% Sampling"
              type="decimal"
              :min="0"
              :max="100"
              :use-grouping="false"
              :value="values.sample_pct ?? ''"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Contoh: 10"
              hints="Persentase sampling untuk menentukan jumlah item yang diuji (tipe desimal)"
              @input="handleHeaderSamplePctChange"
              class="w-full"
            />

            <!-- Status (readonly) -->
            <FieldX id="status" label="Status" :value="values.status || 'DRAFT'" :disabled="true" :readonly="true" placeholder="DRAFT" class="w-full opacity-70 bg-slate-50 dark:bg-muted/50" />
          </div>

          <!-- Notes / Catatan -->
          <div class="mt-4">
            <FieldX id="notes" label="Catatan" :value="values.notes" @input="(v) => (values.notes = v)" :disabled="loading || isReadOnly" :readonly="isReadOnly" placeholder="Catatan inspeksi QC..." class="w-full" />
          </div>
        </CardContent>
      </Card>

      <!-- NESTED ACCORDION TABLE FOR DETAIL ITEM & CRITERIA -->
      <Card class="overflow-hidden">
        <CardHeader class="border-b bg-slate-50/50 dark:bg-muted/40">
          <div class="flex items-center justify-between">
            <div>
              <CardTitle class="text-lg">Detail Item Quality Control</CardTitle>
              <CardDescription>Kelola detail item inspeksi QC dan kriteria pengujian secara inline</CardDescription>
            </div>
            <div class="flex items-center gap-3">
              <ButtonMultiSelect
                v-if="!isReadOnly"
                title="+ Pilih Material dari Referensi"
                :api="detailMultiSelectApi"
                :columns="detailMultiSelectColumns"
                :excludeIds="excludedDetailRefIds"
                :disabled="!values.ref_id || loading || isReadOnly"
                searchKey="kode_item,nama_item"
                displayKey="nama_item"
                uniqueKey="id"
                @add="handleDetailsAdded"
                buttonClass="h-8 text-xs px-3 bg-primary text-white hover:bg-primary/95"
              />
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
                  <th class="min-w-40 py-2.5 px-3 text-left font-semibold text-slate-700 dark:text-slate-200">Kode Material</th>
                  <th class="min-w-[220px] py-2.5 px-3 text-left font-semibold text-slate-700 dark:text-slate-200">Nama Material</th>
                  <th class="min-w-[100px] py-2.5 px-3 text-center font-semibold text-slate-700 dark:text-slate-200">QC Type</th>
                  <th class="min-w-[100px] py-2.5 px-3 text-right font-semibold text-slate-700 dark:text-slate-200">Qty Reference</th>
                  <th class="min-w-[120px] py-2.5 px-3 text-center font-semibold text-slate-700 dark:text-slate-200">Jml Item Sampel</th>
                  <th class="min-w-[90px] py-2.5 px-3 text-left font-semibold text-slate-700 dark:text-slate-200">UoM</th>
                  <th class="min-w-[180px] py-2.5 px-3 text-left font-semibold text-slate-700 dark:text-slate-200">Catatan</th>
                  <th v-if="!isReadOnly" class="w-16 py-2.5 px-3 text-center"></th>
                </tr>
              </thead>

              <!-- LEVEL 1 BODY -->
              <tbody>
                <template v-if="detailArr.length === 0">
                  <tr>
                    <td :colspan="isReadOnly ? 9 : 10" class="text-center py-12 text-slate-400 dark:text-muted-foreground bg-white dark:bg-card">
                      Belum ada material yang ditambahkan. Silakan pilih material dari referensi di atas.
                    </td>
                  </tr>
                </template>

                <template v-else v-for="(row, idx) in detailArr" :key="idx">
                  <tr class="divide-x divide-slate-200 dark:divide-border border-b border-slate-200 dark:border-border align-middle bg-white dark:bg-card">
                    <!-- Expand Toggler -->
                    <td class="py-2 px-3 text-center">
                      <button
                        type="button"
                        class="h-5 w-5 rounded-full bg-[#1E88E5] text-white flex items-center justify-center cursor-pointer shadow-sm hover:bg-[#1565C0] transition mx-auto"
                        @click="toggleItemExpand(idx)"
                      >
                        <ChevronDown v-if="expandedItems[idx]" class="h-3 w-3 stroke-[2.5]" />
                        <ChevronRight v-else class="h-3 w-3 stroke-[2.5]" />
                      </button>
                    </td>

                    <!-- No -->
                    <td class="py-2 px-3 font-medium text-slate-700 dark:text-slate-200">{{ idx + 1 }}</td>

                    <!-- Kode Material -->
                    <td class="py-2 px-3 font-mono text-xs font-semibold">{{ row.kode_item }}</td>

                    <!-- Nama Material -->
                    <td class="py-2 px-3 font-medium text-xs">{{ row.nama_item }}</td>

                    <!-- QC Type -->
                    <td class="py-2 px-3 text-center">
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold"
                        :class="row.qc_type === 'FULL' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'"
                      >
                        {{ row.qc_type }}
                      </span>
                    </td>

                    <!-- Qty Reference -->
                    <td class="py-2 px-3 text-right font-semibold text-slate-700 dark:text-slate-200">
                      {{ row.ref_qty }}
                    </td>

                    <!-- Jml Item Sampel Diuji -->
                    <td class="py-2 px-3 text-center">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary">
                        {{ row.samples?.length || 0 }} Sampel
                      </span>
                    </td>

                    <!-- Satuan / UoM -->
                    <td class="py-2 px-3 text-xs text-slate-600 dark:text-slate-300">
                      {{ row.uom_name || '-' }}
                    </td>

                    <!-- Catatan Material -->
                    <td class="py-2 px-3">
                      <input
                        v-if="!isReadOnly"
                        v-model="row.notes"
                        type="text"
                        class="w-full px-2 py-1 border border-slate-200 dark:border-input rounded text-xs bg-white dark:bg-input/30 focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Catatan material..."
                      />
                      <span v-else class="text-xs text-slate-500 dark:text-muted-foreground">{{ row.notes || '-' }}</span>
                    </td>

                    <!-- Delete Material Row -->
                    <td v-if="!isReadOnly" class="py-2 px-3 text-center">
                      <button type="button" class="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 p-1 rounded transition" @click="removeDetailArr(idx)">
                        <Trash2 class="h-4 w-4" />
                      </button>
                    </td>
                  </tr>

                  <!-- ======================================================== -->
                  <!-- LEVEL 2 TABLE (INLINE ACCORDION: SAMPLES KE BAWAH)      -->
                  <!-- ======================================================== -->
                  <tr v-if="expandedItems[idx]" class="bg-slate-50/50 dark:bg-muted/20">
                    <td :colspan="isReadOnly ? 9 : 10" class="p-4 border-b border-slate-200 dark:border-border">
                      <div class="space-y-4 bg-white dark:bg-card p-4 border border-slate-200 dark:border-border rounded-lg shadow-sm">
                        <!-- HEADER BAR INFORMASI MATERIAL & SAMPLING -->
                        <div class="border-b border-slate-100 dark:border-border pb-2.5">
                          <div>
                            <h4 class="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                              <span class="inline-block w-2 h-3.5 bg-primary rounded"></span>
                              Pemeriksaan Sampel QC: <span class="text-primary font-bold">{{ row.kode_item }}</span> - {{ row.nama_item }}
                            </h4>
                            <p class="text-[11px] text-muted-foreground mt-0.5">
                              Total Qty: <strong>{{ row.ref_qty }} {{ row.uom_name }}</strong> | Target Sampling ({{ values.sample_pct || 0 }}%): <strong>{{ row.samples?.length || 0 }} Item Diuji</strong>
                            </p>
                          </div>
                        </div>

                        <!-- ITEM-ITEM SAMPEL KE BAWAH (Item ke-1, Item ke-2, Item ke-3, dst) -->
                        <div class="space-y-3.5">
                          <div
                            v-for="(sample, sIdx) in row.samples"
                            :key="sIdx"
                            class="border border-slate-200 dark:border-border rounded-lg p-3 bg-slate-50/40 dark:bg-muted/10 space-y-2.5"
                          >
                            <!-- Header Item Sampel ke-X (Tombol Tambah Kriteria di sebelah kiri) -->
                            <div class="flex items-center justify-between">
                              <div class="flex items-center gap-2.5 flex-wrap">
                                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-[#1E88E5] text-white shadow-sm">
                                  Item ke-{{ sIdx + 1 }}
                                </span>
                                <Button
                                  v-if="!isReadOnly"
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  @click="addCriteriaToSample(sample)"
                                  class="h-6 px-2.5 text-[11px] gap-1 border-primary text-primary hover:bg-primary/10 font-semibold shadow-sm"
                                >
                                  <Plus class="h-3 w-3" />
                                  Tambah Kriteria
                                </Button>
                                <span class="text-xs font-medium text-slate-700 dark:text-slate-200">
                                  Pemeriksaan Fisik / Uji Kriteria Sampel #{{ sIdx + 1 }}
                                </span>
                                <span class="text-[11px] text-muted-foreground">
                                  ({{ sample.t_qc_sd_crits?.length || 0 }} kriteria)
                                </span>
                              </div>
                              <div v-if="!isReadOnly && row.samples && row.samples.length > 1" class="flex items-center">
                                <button
                                  type="button"
                                  @click="removeSample(row, sIdx)"
                                  class="text-red-500 hover:text-red-700 p-1 rounded transition"
                                  title="Hapus sampel ini"
                                >
                                  <Trash2 class="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            <!-- Tabel Kriteria Item ke-X (Kriteria manual, Dropdown nilai manual) -->
                            <div class="overflow-x-auto bg-white dark:bg-card rounded border border-slate-200 dark:border-border shadow-sm">
                              <table class="w-full border-collapse text-xs">
                                <thead class="bg-slate-100/70 dark:bg-muted/50 border-b border-slate-200 dark:border-border">
                                  <tr class="divide-x divide-slate-200 dark:divide-border text-left font-semibold text-slate-700 dark:text-slate-200">
                                    <th class="w-10 py-1.5 px-2 text-center">No</th>
                                    <th class="w-44 py-1.5 px-2">Waktu QC</th>
                                    <th class="min-w-[180px] py-1.5 px-2">Kriteria</th>
                                    <th class="min-w-[160px] py-1.5 px-2">Nilai</th>
                                    <th class="min-w-[180px] py-1.5 px-2">Keterangan</th>
                                    <th v-if="!isReadOnly" class="w-12 py-1.5 px-2 text-center"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr v-if="!sample.t_qc_sd_crits || sample.t_qc_sd_crits.length === 0">
                                    <td :colspan="isReadOnly ? 5 : 6" class="text-center py-3 text-slate-400 dark:text-muted-foreground text-[11px]">
                                      Belum ada kriteria pengujian untuk Item ke-{{ sIdx + 1 }}. Silakan klik "+ Tambah Kriteria" untuk menambah kriteria manual.
                                    </td>
                                  </tr>
                                  <tr
                                    v-else
                                    v-for="(crit, cIdx) in sample.t_qc_sd_crits"
                                    :key="cIdx"
                                    class="divide-x divide-slate-200 dark:divide-border border-b border-slate-200 dark:border-border align-middle bg-white dark:bg-card"
                                  >
                                    <!-- No -->
                                    <td class="py-1 px-2 text-center font-medium">{{ cIdx + 1 }}</td>

                                    <!-- Waktu QC -->
                                    <td class="py-1 px-2">
                                      <input
                                        v-if="!isReadOnly"
                                        type="datetime-local"
                                        v-model="crit.date"
                                        class="w-full px-2 py-0.5 border border-slate-200 dark:border-input rounded text-xs bg-white dark:bg-input/30 focus:outline-none focus:ring-1 focus:ring-primary"
                                      />
                                      <span v-else>{{ crit.date ? new Date(crit.date).toLocaleString('id-ID') : '-' }}</span>
                                    </td>

                                    <!-- Dropdown Manual Kriteria -->
                                    <td class="py-1 px-2">
                                      <FieldSelect
                                        v-if="!isReadOnly"
                                        :id="`crit_${row.m_item_id || idx}_${sIdx}_${cIdx}`"
                                        :value="crit.m_qc_d_crit_id"
                                        :display-value="crit.qc_criteria?.value1 || ''"
                                        :api="{
                                          url: `${API_BASE_URL}/dynamic/m_general`,
                                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                                          params: { no_pagination: 'true', filter_column_group: 'QC_CRITERIA', selectfield: 'id,value1' },
                                        }"
                                        display-field="value1"
                                        value-field="id"
                                        placeholder="Pilih Kriteria"
                                        @input="(v: string) => handleCriteriaSelect(crit, v, null)"
                                        @update:valueFull="(item: MGeneralRef | null) => handleCriteriaSelect(crit, crit.m_qc_d_crit_id || '', item)"
                                        class="w-full text-xs h-7 min-w-[150px]"
                                      />
                                      <span v-else>{{ crit.qc_criteria?.value1 || crit.m_qc_d_crit_id || '-' }}</span>
                                    </td>

                                    <!-- Dropdown Manual Nilai -->
                                    <td class="py-1 px-2">
                                      <FieldSelect
                                        v-if="!isReadOnly"
                                        :id="`val_${row.m_item_id || idx}_${sIdx}_${cIdx}`"
                                        :value="crit.m_qc_d_opt_id"
                                        :display-value="crit.qc_value?.value1 || ''"
                                        :api="{
                                          url: `${API_BASE_URL}/dynamic/m_general`,
                                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                                          params: { no_pagination: 'true', filter_column_group: 'QC_VALUE', selectfield: 'id,value1' },
                                        }"
                                        display-field="value1"
                                        value-field="id"
                                        placeholder="Pilih Nilai"
                                        @input="(v: string) => handleOptionSelect(crit, v, null)"
                                        @update:valueFull="(item: MGeneralRef | null) => handleOptionSelect(crit, crit.m_qc_d_opt_id || '', item)"
                                        class="w-full text-xs h-7 min-w-[140px]"
                                      />
                                      <span v-else>{{ crit.qc_value?.value1 || crit.m_qc_d_opt_id || '-' }}</span>
                                    </td>

                                    <!-- Keterangan -->
                                    <td class="py-1 px-2">
                                      <input
                                        v-if="!isReadOnly"
                                        type="text"
                                        v-model="crit.note"
                                        class="w-full px-2 py-0.5 border border-slate-200 dark:border-input rounded text-xs bg-white dark:bg-input/30 focus:outline-none focus:ring-1 focus:ring-primary"
                                        placeholder="Keterangan..."
                                      />
                                      <span v-else class="text-slate-500">{{ crit.note || '-' }}</span>
                                    </td>

                                    <!-- Hapus Kriteria Row -->
                                    <td v-if="!isReadOnly" class="py-1 px-2 text-center">
                                      <button
                                        type="button"
                                        class="text-red-500 hover:text-red-700 p-1 rounded transition"
                                        @click="removeCriteriaFromSample(sample, cIdx)"
                                      >
                                        <Trash2 class="h-3.5 w-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
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

      <!-- AUDIT INFO -->
      <AuditInfo v-if="isViewMode || isEditMode" :created-by="auditMeta.created_by" :created-at="auditMeta.createdAt" :updated-by="auditMeta.updated_by" :updated-at="auditMeta.updatedAt" class="mt-6" />

      <!-- BOTTOM ACTION BUTTONS -->
      <div class="flex items-center gap-3 justify-end pt-4">
        <Button
          v-if="values.id"
          type="button"
          variant="outline"
          class="gap-2 border-primary text-primary hover:bg-primary/10"
          @click="handlePrintQc"
        >
          <Printer class="h-4 w-4" />
          Cetak QC Lapangan
        </Button>
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
</template>

<style scoped>
.required::after {
  content: ' *';
  color: hsl(var(--destructive));
}
</style>
