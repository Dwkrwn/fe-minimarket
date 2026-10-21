<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FieldX,
  FieldNumber,
  FieldSelect,
  FieldPopup,
  FieldTextarea,
  FieldDate,
  FieldStatus,
} from "@/components/field";
import { ButtonMultiSelect, DeleteButton } from "@/components/button";
import { ArrowLeft, Save, Loader2, History } from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createTPenerimaan,
  updateTPenerimaan,
  getTPenerimaanById,
  type TPenerimaanBarangDetail,
  type TPenerimaanBarangBonus,
} from "./service";
import AuditInfo from '@/components/AuditInfo.vue'

// =====================================================================fc=======
// SETUP
// ============================================================================
const authStore = useAuthStore();
const { API_BASE_URL } = useApi();
const router = useRouter();
const route = useRoute();

// ============================================================================
// STATE
// ============================================================================
const MIN_QTY_DITERIMA = 1;
const loading = ref(false);
const isEditMode = computed(
  () => !!route.params.id && route.name === "TPenerimaanForm",
);
const isViewMode = computed(() => route.name === "TPenerimaanView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Penerimaan Barang";
  if (isCopyMode.value) return "Salin Penerimaan Barang";
  if (isEditMode.value) return "Edit Penerimaan Barang";
  return "Tambah Penerimaan Barang Baru";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Penerimaan Barang";
  if (isCopyMode.value)
    return "Buat Penerimaan Barang baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Penerimaan Barang";
  return "Buat Penerimaan Barang baru";
});

// Super Admin check
const isSuperAdmin = computed(() => {
  const user = authStore.user as any;
  return user?.tipe?.value1?.toUpperCase() === "SUPER ADMIN";
});
const selectedUnitBisnis = ref<any | null>(null);

// Company info dari SelectRespo (untuk non-super admin)
const companyNameDisplay = computed(() => {
  if (!isSuperAdmin.value) {
    try {
      const selectRespo = localStorage.getItem("SelectRespo");
      if (selectRespo) {
        const parsed = JSON.parse(selectRespo);
        return parsed.companyName || "";
      }
    } catch (e) {
      console.error("Failed to parse SelectRespo:", e);
    }
  }
  return "";
});

const selectedCompanyNameDisplay = computed(() => {
  return (
    selectedUnitBisnis.value?.m_company?.nama ||
    selectedUnitBisnis.value?.company?.nama ||
    selectedUnitBisnis.value?.m_company?.name ||
    "-"
  );
});

const fetchSelectedUnitBisnis = async (unitBisnisId?: string | null) => {
  if (!unitBisnisId) {
    selectedUnitBisnis.value = null;
    return;
  }

  if (selectedUnitBisnis.value?.id === unitBisnisId) return;

  try {
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_unit_bisnis/${unitBisnisId}?include=m_company`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    const result = await response.json();
    selectedUnitBisnis.value = result.status === "success" ? result.data : null;
  } catch (error) {
    console.error("Failed to load selected unit bisnis company:", error);
    selectedUnitBisnis.value = null;
  }
};

// Gudang API config - filtered by m_unit_bisnis_id
const gudangApiConfig = computed(() => {
  const params: any = {
    filter_column_is_active: true,
    selectfield: "id,nama_gudang,kode_gudang",
    include: "m_unit_bisnis:id|nama_comp",
  };

  // Filter by company if selected
  if (values.m_unit_bisnis_id) {
    params.filter_column_m_unit_bisnis_id = values.m_unit_bisnis_id;
  }

  return {
    url: `${API_BASE_URL}/dynamic/m_gudang`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authStore.token}`,
    },
    params,
  };
});

// Ekspedisi API config
const ekspedisiApiConfig = computed(() => {
  return {
    url: `${API_BASE_URL}/dynamic/m_ekspedisi`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authStore.token}`,
    },
    params: {
      filter_column_is_active: true,
      selectfield: "id,nama,tujuan_kirim,telepon",
    },
  };
});

// Form values
const values = reactive({
  no_penerimaan: "",
  tgl_penerimaan: new Date().toISOString().split("T")[0],
  status: "DRAFT",
  m_supplier_id: "",
  m_gudang_id: "",
  m_unit_bisnis_id: "",
  tgl_sj_supp: "",
  tgl_inv_supp: "",
  no_sj_supp: "",
  no_inv_supp: "",
  no_kontainer: "",
  nopol: "",
  ekspedisi_pb: "",
  catatan: "",
  created_by: authStore.user?.id || "",
  need_biaya_kirim: false,
});

// Supplier display name untuk header
const supplierName = ref("");

// Temp data
let initialValues: Record<string, any> = {};

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

// Detail arrays
const detailItems = ref<TPenerimaanBarangDetail[]>([]);
const bonusItems = ref<TPenerimaanBarangBonus[]>([]);
const rackOptions = ref<{ id: string; label: string }[]>([]);
const defaultRackCache = ref<Map<string, string | null>>(new Map());

// Flag to track if we're loading data (to prevent watch from interfering)
const isLoadingData = ref(false);

// State untuk tracking item yang dipilih untuk melihat history
const selectedItemForHistory = ref<string | null>(null);

// ============================================================================
// NEED BIAYA KIRIM - Confirm change when detail items exist
// ============================================================================
const isConfirmChangeFlagDialogOpen = ref(false);
const pendingNeedBiayaKirimValue = ref<boolean>(false);

const handleNeedBiayaKirimChange = (newValue: boolean) => {
  // If detail items are already filled, show confirmation dialog first
  if (detailItems.value.length > 0) {
    pendingNeedBiayaKirimValue.value = newValue;
    isConfirmChangeFlagDialogOpen.value = true;
    return;
  }
  // No detail items yet — apply directly
  values.need_biaya_kirim = newValue;
};

const confirmChangeFlagAndClearDetails = () => {
  values.need_biaya_kirim = pendingNeedBiayaKirimValue.value;
  detailItems.value = [];
  isConfirmChangeFlagDialogOpen.value = false;
  toast.info("Flagging diubah, semua detail item telah dihapus");
};

const cancelChangeFlag = () => {
  isConfirmChangeFlagDialogOpen.value = false;
};

// ============================================================================
// WATCH - Auto clamp qty_diterima to not exceed qty_sisa (only in add/new mode)
// ============================================================================
watch(
  detailItems,
  (items) => {
    // Skip auto-clamping when loading existing data
    if (isLoadingData.value) return;

    // Only auto-clamp in add/new mode to prevent exceeding available qty_sisa
    items.forEach((item) => {
      const qtyDiterima = item.qty_diterima || 0;
      const maxQtyDiterima = getMaxQtyDiterima(item);
      if (qtyDiterima > maxQtyDiterima) {
        item.qty_diterima = maxQtyDiterima;
      }
    });
  },
  { deep: true },
);

watch(
  () => values.m_unit_bisnis_id || "",
  async (id: string) => {
    await fetchSelectedUnitBisnis(id);
  },
  { immediate: true },
);

// ============================================================================// ============================================================================
// FETCH DETAIL FROM GetDetail API
// ============================================================================
/**
 * Fetch detail items dari API GetDetail untuk mendapatkan qty_sisa dan history_penerimaan yang akurat
 * Jika tidak ditemukan di GetDetail (qty_sisa = 0), coba GetDetailDone
 */
const fetchDetailFromGetDetailAPI = async (
  t_purchase_order_d_id: string,
): Promise<any | null> => {
  try {
    // Try GetDetail first (for items with qty_sisa > 0)
    let response = await fetch(
      `${API_BASE_URL}/fn/t_purchase_order_d/GetDetail?filter_column_id=${t_purchase_order_d_id}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    let result = await response.json();

    if (result.status === "success" && result.data && result.data.length > 0) {
      return result.data[0];
    }

    // If not found in GetDetail, try GetDetailDone (for items with qty_sisa = 0)
    response = await fetch(
      `${API_BASE_URL}/fn/t_purchase_order_d/GetDetailDone?filter_column_id=${t_purchase_order_d_id}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    result = await response.json();

    if (result.status === "success" && result.data && result.data.length > 0) {
      return result.data[0];
    }

    return null;
  } catch (error) {
    console.error("Failed to fetch detail from GetDetail API:", error);
    return null;
  }
};

// ============================================================================
// DETAIL METHODS
// ============================================================================
const removeDetailItem = (index: number) => {
  const item = detailItems.value[index];
  // Clear selected history if removing the selected item
  if (item?.t_purchase_order_d_id === selectedItemForHistory.value) {
    selectedItemForHistory.value = null;
  }
  detailItems.value.splice(index, 1);

  // Reset ekspedisi if all detail items are removed
  if (detailItems.value.length === 0) {
    values.ekspedisi_pb = "";
  }

  toast.info("Detail item dihapus");
};

// Toggle history visibility for specific item
const toggleHistoryView = (t_purchase_order_d_id: string | undefined) => {
  if (!t_purchase_order_d_id) return;

  if (selectedItemForHistory.value === t_purchase_order_d_id) {
    selectedItemForHistory.value = null; // Close if already open
  } else {
    selectedItemForHistory.value = t_purchase_order_d_id; // Open for this item
    // Scroll to history section after a short delay
    setTimeout(() => {
      const historyCard = document.getElementById("history-penerimaan-section");
      if (historyCard) {
        historyCard.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  }
};

// Computed: Get the selected item for history display
const selectedItemWithHistory = computed(() => {
  // Jika tidak ada item yang dipilih, return null (history tidak ditampilkan)
  if (!selectedItemForHistory.value) return null;

  // Cari item yang dipilih berdasarkan t_purchase_order_d_id
  const foundItem = detailItems.value.find(
    (item) => item.t_purchase_order_d_id === selectedItemForHistory.value,
  );

  // Return item jika ditemukan DAN memiliki history_penerimaan
  if (
    foundItem &&
    foundItem.history_penerimaan &&
    foundItem.history_penerimaan.length > 0
  ) {
    return foundItem;
  }

  // Jika tidak memenuhi kriteria, return null
  return null;
});

const removeBonusItem = (index: number) => {
  bonusItems.value.splice(index, 1);
  toast.info("Bonus item dihapus");
};

const getRackLabelById = (rakId?: string) => {
  if (!rakId) return "-";
  return rackOptions.value.find((r) => r.id === rakId)?.label || "-";
};

const fetchRackOptionsByGudang = async (gudangId: string) => {
  if (!gudangId) {
    rackOptions.value = [];
    return;
  }

  try {
    const include = encodeURIComponent("m_rak>m_rak_d");
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_gudang/${gudangId}?include=${include}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    const result = await response.json();

    if (result.status !== "success" || !result.data) {
      rackOptions.value = [];
      return;
    }

    const gudang = result.data;
    const rawRaks = gudang.m_raks || gudang.m_rak || [];
    const raks = Array.isArray(rawRaks) ? rawRaks : rawRaks ? [rawRaks] : [];

    rackOptions.value = raks.flatMap((rak: any) => {
      const rawDetails = rak.m_rak_ds || rak.m_rak_d || [];
      const details = Array.isArray(rawDetails)
        ? rawDetails
        : rawDetails
          ? [rawDetails]
          : [];

      return details.map((detail: any) => ({
        id: detail.id,
        label: `${detail.kode || "-"} (${rak.nama_rak || "-"})`,
      }));
    });
  } catch (error) {
    rackOptions.value = [];
    console.error("Failed to fetch rack options by gudang:", error);
  }
};

const fetchDefaultRackIdForItem = async (
  itemId?: string,
  gudangId?: string,
): Promise<string | null> => {
  if (!itemId || !gudangId) return null;

  const cacheKey = `${itemId}:${gudangId}`;
  if (defaultRackCache.value.has(cacheKey)) {
    return defaultRackCache.value.get(cacheKey) || null;
  }

  try {
    const include = encodeURIComponent("m_rak_d>m_rak");
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_items_rak?no_pagination=true&filter_column_items_id=${itemId}&filter_column_is_default=true&include=${include}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    const result = await response.json();

    if (result.status !== "success" || !Array.isArray(result.data)) {
      defaultRackCache.value.set(cacheKey, null);
      return null;
    }

    const candidates = result.data
      .filter((row: any) => {
        const gudangFromRow =
          row.m_rak_d?.m_rak?.m_gudang_id || row.m_rak_d?.m_rak?.gudang_id;
        return gudangFromRow === gudangId;
      })
      .sort((a: any, b: any) => {
        const seqA = a.sequence ?? Number.MAX_SAFE_INTEGER;
        const seqB = b.sequence ?? Number.MAX_SAFE_INTEGER;
        return seqA - seqB;
      });

    const selectedRackId = candidates[0]?.rak_d_id || null;
    defaultRackCache.value.set(cacheKey, selectedRackId);
    return selectedRackId;
  } catch (error) {
    console.error("Failed to fetch default rack for item:", error);
    defaultRackCache.value.set(cacheKey, null);
    return null;
  }
};

const applyDefaultRackToDetails = async (overwriteAll: boolean = false) => {
  const gudangId = values.m_gudang_id;
  if (!gudangId || detailItems.value.length === 0) return;

  let emptyCount = 0;
  for (const item of detailItems.value) {
    if (!overwriteAll && item.rak_d_id) continue;
    const defaultRackId = await fetchDefaultRackIdForItem(
      item.m_items_id,
      gudangId,
    );
    item.rak_d_id = defaultRackId || "";
    if (!defaultRackId) emptyCount++;
  }

  if (emptyCount > 0) {
    toast.info("Sebagian item tidak punya rak default", {
      description: `${emptyCount} item perlu pilih rak manual`,
    });
  }
};

const handleAddDetailItems = async (items: any[]) => {
  if (!Array.isArray(items) || items.length === 0) return;

  const addedItems: TPenerimaanBarangDetail[] = [];

  for (const detail of items) {
    const exists = detailItems.value.find(
      (d) => d.t_purchase_order_d_id === detail.id,
    );
    if (exists) continue;

    const defaultRackId = await fetchDefaultRackIdForItem(
      detail.m_items_id,
      values.m_gudang_id,
    );

    addedItems.push({
      t_purchase_order_id: detail.t_purchase_order_id,
      t_purchase_order_d_id: detail.id,
      m_items_id: detail.m_items_id,
      rak_d_id: defaultRackId || "",
      batch: "",
      is_batch: Boolean(detail.m_item?.is_batch),
      qty_diterima: 0,
      qty_sisa: detail.qty_sisa || 0,
      catatan: "",
      catatan_bonus: detail.t_purchase_order?.catatan_bonus || "-",
      no_po: detail.t_purchase_order?.no_po || "-",
      kode_item: detail.m_item?.kode_item || "-",
      nama_item: detail.m_item?.nama_item || "-",
      qty_po: detail.qty_po || 0,
      satuan: detail.m_item?.uom?.value1 || "-",
      history_penerimaan: detail.history_penerimaan || [],
    });
  }

  if (addedItems.length > 0) {
    // Auto-fill ekspedisi dari PO pertama jika detailItems masih kosong
    if (detailItems.value.length === 0 && items.length > 0) {
      const firstItem = items[0];
      const ekspedisiId = firstItem.t_purchase_order?.ekspedisi_id;
      if (ekspedisiId && ekspedisiId !== "-" && !values.ekspedisi_pb) {
        values.ekspedisi_pb = ekspedisiId;
        toast.info("Ekspedisi diisi otomatis dari PO", {
          description: `Ekspedisi: ${firstItem.t_purchase_order?.ekspedisi || "-"}`,
        });
      }
    }

    detailItems.value.push(...addedItems);
    const noDefaultCount = addedItems.filter((i) => !i.rak_d_id).length;
    if (noDefaultCount > 0) {
      toast.info("Rak default tidak ditemukan", {
        description: `${noDefaultCount} item harus pilih rak manual`,
      });
    }
  }
};

// ============================================================================
// HELPER: Batch & Sisa Qty
// ============================================================================
const defaultBatchPreview = computed(() => {
  const no = values.no_penerimaan?.trim() || "No PB";
  const tgl = values.tgl_penerimaan ? values.tgl_penerimaan.split("T")[0] : "";
  if (tgl) {
    const parts = tgl.split("-");
    if (parts.length === 3) {
      return `${no} ${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return no ? `${no} + Tgl` : "No PB + Tgl";
});

const getMaxQtyDiterima = (item: any): number => {
  if (item.qty_po_ots !== undefined && item.qty_po_ots !== null) {
    return Number(item.qty_po_ots) || 0;
  }

  return Number(item.qty_sisa) || 0;
};

const normalizeQtyDiterima = (
  value: string | number | undefined,
  maxQty: number,
): number | undefined => {
  const cleanValue = String(value).replace(/\./g, "").replace(/,/g, ".");
  if (!cleanValue.trim()) return undefined;

  const numericValue = Number(cleanValue);
  if (!Number.isFinite(numericValue)) return undefined;

  const nonNegativeValue = Math.max(0, numericValue);
  return maxQty > 0 ? Math.min(nonNegativeValue, maxQty) : 0;
};

const getDisplaySisaQty = (item: any): number => {
  const baseSisa = getMaxQtyDiterima(item);

  if (isReadOnly.value) {
    return baseSisa;
  }

  const diterima = Number(item.qty_diterima) || 0;
  return Math.max(0, baseSisa - diterima);
};

// ============================================================================
// HANDLERS
// ============================================================================
// Handle company select (for Super Admin)
const handleCompanySelect = (company: any) => {
  selectedUnitBisnis.value = company || null;

  // Reset gudang when company changes
  if (values.m_gudang_id) {
    values.m_gudang_id = "";
    toast.info("Gudang direset karena unit bisnis berubah");
  }
};

// Handle supplier select from FieldPopup
const handleSupplierSelect = (supplier: any) => {
  if (supplier) {
    supplierName.value = supplier.nama_supp || "";
  } else {
    supplierName.value = "";
  }
  // Clear detail items and ekspedisi when supplier changes
  if (detailItems.value.length > 0) {
    detailItems.value = [];
    values.ekspedisi_pb = "";
    toast.info("Detail item dan ekspedisi direset karena supplier berubah");
  }
};

// Handle gudang select
const handleGudangSelect = (gudang: any) => {
  const gudangId = gudang?.id || values.m_gudang_id;
  if (!gudangId) {
    rackOptions.value = [];
    detailItems.value = detailItems.value.map((item) => ({
      ...item,
      rak_d_id: "",
    }));
    return;
  }

  defaultRackCache.value.clear();
  fetchRackOptionsByGudang(gudangId);
  applyDefaultRackToDetails(true);
};

// Computed: Get IDs of already selected items to exclude from popup
const excludedDetailItemIds = computed(() => {
  return detailItems.value
    .map((item) => item.t_purchase_order_d_id)
    .filter((id): id is string => !!id);
});

// Computed: Get IDs of already selected bonus items to exclude from popup
const excludedBonusItemIds = computed(() => {
  return bonusItems.value
    .map((item) => item.m_items_id)
    .filter((id): id is string => !!id);
});

// Computed: Unique PO + catatan_bonus summary (deduplicated by no_po)
const uniquePoCatatanBonus = computed(() => {
  const seen = new Map<string, string>();
  for (const item of detailItems.value) {
    const noPo = item.no_po || "-";
    const catatan = item.catatan_bonus || "";
    if (catatan && catatan !== "-" && !seen.has(noPo)) {
      seen.set(noPo, catatan);
    }
  }
  return Array.from(seen.entries()).map(([no_po, catatan_bonus]) => ({
    no_po,
    catatan_bonus,
  }));
});

// Computed: Detail Items API config with dynamic filter
const detailItemsApiConfig = computed(() => {
  const excludedIds = excludedDetailItemIds.value;
  const baseParams: any = {
    page: 1,
    paginate: 20,
    m_supplier_id: values.m_supplier_id,
  };

  if (values.need_biaya_kirim) {
    baseParams["filter_column_t_purchase_order.need_biaya_kirim"] = true;
  }

  if(values.m_supplier_id){
    baseParams['filter_column_t_purchase_order.m_supplier_id'] = values.m_supplier_id
  }

  if(values.m_gudang_id){
    baseParams['filter_column_t_purchase_order.gudang_id'] = values.m_gudang_id
  }

  if(values.m_unit_bisnis_id){
    baseParams['filter_column_t_purchase_order.m_unit_bisnis_id'] = values.m_unit_bisnis_id
  }
  return {
    url: `${API_BASE_URL}/fn/t_purchase_order_d/GetDetail`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authStore.token}`,
    },
    params: baseParams,
    onsuccess: (response: any) => {
      response.hasNext = response.pagination?.next_page ? true : false;
      return response;
    },
  };
});

// Computed: Bonus Items API config with dynamic filter
const bonusItemsApiConfig = computed(() => {
  const excludedIds = excludedBonusItemIds.value;
  const baseParams: any = {
    include: "m_general:id|value1",
    searchfield: "kode_item,nama_item",
    filter_column_status: "POST",
    filter_column_is_active: true,
    order_by: "createdAt",
    order_type: "DESC",
  };

  // if (excludedIds.length > 0) {
  //   baseParams['notin'] = excludedIds.join(',')
  // }

  return {
    url: `${API_BASE_URL}/dynamic/m_items`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authStore.token}`,
    },
    params: baseParams,
    onsuccess: (response: any) => {
      response.hasNext = response.pagination?.next_page ? true : false;
      return response;
    },
  };
});

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    no_penerimaan: "",
    tgl_penerimaan: new Date().toISOString().split("T")[0],
    status: "DRAFT",
    m_supplier_id: "",
    m_gudang_id: "",
    m_unit_bisnis: "",
    tgl_sj_supp: "",
    tgl_inv_supp: "",
    no_sj_supp: "",
    no_inv_supp: "",
    no_kontainer: "",
    nopol: "",
    ekspedisi_pb: "",
    catatan: "",
    created_by: authStore.user?.id || "",
    need_biaya_kirim: false,
  });

  supplierName.value = "";
  detailItems.value = [];
  bonusItems.value = [];

  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });
};

// ============================================================================
// LIFECYCLE HOOKS - LOAD DATA BEFORE MOUNT
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
      // ignore
    }
  }

  const isCopyModeLocal = route.query.action === "copy" && route.query.source;
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value;

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return;
  }

  loading.value = true;
  isLoadingData.value = true;
  try {
    const res = await getTPenerimaanById(sourceId);

    if (res.status !== "success") throw new Error("Gagal memuat data");
    initialValues = res.data;

    auditMeta.value = {
      created_by: initialValues.created_by || initialValues.createdBy || null,
      createdAt: initialValues.createdAt || null,
      updated_by: initialValues.updated_by || initialValues.update_by || initialValues.edited_by || null,
      updatedAt: initialValues.updatedAt || null,
    };

    // Load detail items - API returns both t_penerimaan_barang_d (singular object) and t_penerimaan_barang_ds (array)
    const detailData =
      initialValues.t_penerimaan_barang_ds ||
      (initialValues.t_penerimaan_barang_d
        ? [initialValues.t_penerimaan_barang_d]
        : null);
    // Get current penerimaan ID untuk match dengan history
    const currentPenerimaanId = initialValues.id;

    if (detailData && Array.isArray(detailData)) {
      // First, map basic data - use qty_sisa from database for existing data
      const mappedItems = detailData.map((d: any) => ({
        id: d.id,
        t_penerimaan_barang_id: d.t_penerimaan_barang_id,
        t_purchase_order_id: d.t_purchase_order_id,
        t_purchase_order_d_id: d.t_purchase_order_d_id,
        m_items_id: d.m_items_id,
        rak_d_id: d.rak_d_id || "",
        batch: d.batch || "",
        is_batch: Boolean(d.m_item?.is_batch),
        qty_diterima: d.qty_diterima || 0,
        qty_po_ots: d.qty_po_ots,
        // qty_sisa akan diupdate dari history_penerimaan yang match
        qty_sisa: d.qty_sisa || 0,
        catatan: d.catatan || "",
        catatan_bonus: d.t_purchase_order?.catatan_bonus || "",
        // Display fields from relations
        no_po: d.t_purchase_order?.no_po || "-",
        kode_item: d.m_item?.kode_item || "-",
        nama_item: d.m_item?.nama_item || "-",
        qty_po: d.t_purchase_order_d?.qty_po || 0,
        satuan:
          d.m_item?.uom?.value1 ||
          d.m_item?.m_general?.value1 ||
          d.m_item?.mi_uom?.value1 ||
          "-",
        nama_rak_detail: d.m_rak_d?.kode
          ? `${d.m_rak_d.kode} (${d.m_rak_d?.m_rak?.nama_rak || "-"})`
          : "",
        history_penerimaan: [] as any[],
      }));

      detailItems.value = mappedItems;

      // Fetch history_penerimaan from GetDetail API for each item
      const fetchPromises = mappedItems.map(async (item, index) => {
        if (item.t_purchase_order_d_id) {
          const detailFromAPI = await fetchDetailFromGetDetailAPI(
            item.t_purchase_order_d_id,
          );
          if (detailFromAPI && detailItems.value[index]) {
            // Update qty_po dari API jika belum ada
            if (!detailItems.value[index]!.qty_po) {
              detailItems.value[index]!.qty_po = detailFromAPI.qty_po || 0;
            }

            // Get history_penerimaan dan sort berdasarkan no_penerimaan ascending
            const historyData = detailFromAPI.history_penerimaan || [];
            // Sort history: yang lebih dulu (no_penerimaan lebih kecil) jadi #1
            historyData.sort((a: any, b: any) => {
              const noPenA = a.no_penerimaan || "";
              const noPenB = b.no_penerimaan || "";
              return noPenA.localeCompare(noPenB);
            });
            detailItems.value[index]!.history_penerimaan = historyData;

            // Cari index penerimaan current di history (sorted)
            const currentIndex = historyData.findIndex(
              (h: any) => h.t_penerimaan_id === currentPenerimaanId,
            );

            if (currentIndex !== -1) {
              // Qty Sisa SEBELUM penerimaan ini
              if (currentIndex === 0) {
                // Penerimaan pertama: qty_sisa sebelum = qty_po (belum ada yang diterima)
                detailItems.value[index]!.qty_sisa = detailFromAPI.qty_po || 0;
              } else {
                // Penerimaan ke-n: qty_sisa sebelum = qty_sisa SETELAH penerimaan sebelumnya
                // qty_sisa dari penerimaan sebelumnya adalah sisa setelah penerimaan tersebut
                const prevHistory = historyData[currentIndex - 1];
                detailItems.value[index]!.qty_sisa = prevHistory.qty_sisa ?? 0;
              }
            } else {
              // Data baru (draft) - gunakan qty_sisa dari API GetDetail
              // Untuk data baru, qty_sisa dari API adalah sisa terakhir setelah semua penerimaan sebelumnya
              if (historyData.length > 0) {
                // Ada history penerimaan sebelumnya, gunakan qty_sisa dari penerimaan terakhir
                const lastHistory = historyData[historyData.length - 1];
                detailItems.value[index]!.qty_sisa =
                  lastHistory.qty_sisa ?? detailFromAPI.qty_sisa ?? 0;
              } else {
                // Belum ada penerimaan sama sekali, qty_sisa = qty_po
                detailItems.value[index]!.qty_sisa = detailFromAPI.qty_po || 0;
              }
            }
          }
        }
      });

      // Wait for all fetch operations to complete
      await Promise.all(fetchPromises);
    }

    // Load bonus items - API returns t_penerimaan_barang_bonus or t_penerimaan_barang_bonu (with typo)
    // Can be an array or a single object
    const bonusData =
      initialValues.t_penerimaan_barang_bonuss ||
      initialValues.t_penerimaan_barang_bonus ||
      initialValues.t_penerimaan_barang_bonu;
    if (bonusData) {
      // Convert to array if it's a single object
      const bonusArray = Array.isArray(bonusData) ? bonusData : [bonusData];

      bonusItems.value = bonusArray.map((b: any) => ({
        id: b.id,
        t_penerimaan_barang_id: b.t_penerimaan_barang_id,
        m_items_id: b.m_items_id,
        qty_terima: b.qty_terima || 0,
        qty_uom: b.qty_uom || "",
        catatan: b.catatan || "",
        kode_item: b.m_item?.kode_item || "-",
        nama_item: b.m_item?.nama_item || "-",
      }));
    }

    // Load supplier name from relation
    if (initialValues.m_supplier) {
      supplierName.value = initialValues.m_supplier.nama_supp || "";
    }

    // Mode copy
    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
      delete (initialValues as any).no_penerimaan;
      // Reset status to DRAFT when copying
      values.status = "DRAFT";
    }

    // Check if trying to edit a POST item - redirect to view
    if (isEditMode.value && initialValues.status === "POST") {
      toast.error("Tidak dapat mengedit", {
        description:
          "Data yang sudah POST tidak bisa diedit. Membuka halaman view...",
      });
      setTimeout(
        () =>
          router.replace(
            `/purchasing/transaksi/t_penerimaan/view/${menuId.value}`,
          ),
        1500,
      );
      return;
    }

    // Assign values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        (values as any)[key] = initialValues[key];
      }
    }

    // Unit bisnis fallback
    if (!values.m_unit_bisnis_id && !isSuperAdmin.value) {
      try {
        const selectRespo = localStorage.getItem("SelectRespo");
        if (selectRespo) {
          const parsed = JSON.parse(selectRespo);
          if (parsed.companyId) {
            values.m_unit_bisnis_id = parsed.companyId;
          }
        }
      } catch (e) {
        // ignore
      }
    }

    if (values.m_gudang_id) {
      await fetchRackOptionsByGudang(values.m_gudang_id);
      await applyDefaultRackToDetails(false);
    }

    if (isCopyModeLocal) {
      toast.success("Data berhasil disalin", {
        description: "Silakan edit dan simpan sebagai Penerimaan baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Penerimaan", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () => router.push("/purchasing/transaksi/t_penerimaan"),
      },
    });
    setTimeout(() => router.push("/purchasing/transaksi/t_penerimaan"), 2000);
  } finally {
    loading.value = false;
    isLoadingData.value = false;
  }
});

// Errors object
const errors = reactive({
  m_supplier_id: "",
  m_gudang_id: "",
  no_sj_supp: "",
  tgl_sj_supp: "",
});

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  // Validasi
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });
  let invalid = false;

  if (!values.m_supplier_id?.trim()) {
    errors.m_supplier_id = "Supplier wajib dipilih";
    invalid = true;
  }
  if (!values.m_gudang_id?.trim()) {
    errors.m_gudang_id = "Gudang wajib dipilih";
    invalid = true;
  }
  if (!values.no_sj_supp?.trim()) {
    errors.no_sj_supp = "No. SJ Supplier wajib diisi";
    invalid = true;
  }
  if (!values.tgl_sj_supp) {
    errors.tgl_sj_supp = "Tgl. SJ Supplier wajib diisi";
    invalid = true;
  }

  if (invalid) {
    toast.error("Validasi gagal", {
      description: "Mohon lengkapi semua field yang wajib diisi",
    });
    return;
  }

  const emptyQtyItems = detailItems.value.filter(
    (item) => (Number(item.qty_diterima) || 0) < MIN_QTY_DITERIMA,
  );
  if (emptyQtyItems.length > 0) {
    const itemNames = emptyQtyItems
      .map((item) => item.kode_item || item.nama_item || "-")
      .join(", ");
    toast.warning("Qty Diterima belum valid", {
      description: `Qty Diterima wajib diisi minimal ${MIN_QTY_DITERIMA} pada item: ${itemNames}`,
    });
    return;
  }

  // Validasi qty_diterima tidak boleh melebihi qty sisa/OTS
  const invalidQtyItems = detailItems.value.filter(
    (item) => (Number(item.qty_diterima) || 0) > getMaxQtyDiterima(item),
  );
  if (invalidQtyItems.length > 0) {
    const itemNames = invalidQtyItems
      .map((item) => item.kode_item || item.nama_item || "-")
      .join(", ");
    toast.error("Validasi gagal", {
      description: `Qty Diterima tidak boleh melebihi Qty Sisa pada item: ${itemNames}`,
    });
    return;
  }

  const invalidRakItems = detailItems.value.filter((item) => !item.rak_d_id);
  if (invalidRakItems.length > 0) {
    const itemNames = invalidRakItems
      .map((item) => item.kode_item || item.nama_item || "-")
      .join(", ");
    toast.error("Validasi gagal", {
      description: `Detail rak wajib diisi untuk item: ${itemNames}`,
    });
    return;
  }

  const invalidBonusQtyItems = bonusItems.value.filter(
    (item) => Number(item.qty_terima || 0) <= 0,
  );
  if (invalidBonusQtyItems.length > 0) {
    const itemNames = invalidBonusQtyItems
      .map((item) => item.kode_item || item.nama_item || "-")
      .join(", ");
    toast.error("Qty bonus tidak boleh 0", {
      description: `Qty bonus wajib lebih dari 0 pada item: ${itemNames}`,
    });
    return;
  }

  loading.value = true;
  try {
    const currentUserId = authStore.user?.id || null;

    // Helper: Convert empty string to null for UUID fields
    const toNullIfEmpty = (value: string | null | undefined): string | null => {
      return value && value.trim() !== "" ? value : null;
    };

    const payload: any = {
      ...values,
      status: values.status || "DRAFT",
      m_supplier_id: toNullIfEmpty(values.m_supplier_id),
      m_gudang_id: toNullIfEmpty(values.m_gudang_id),
      m_unit_bisnis_id: toNullIfEmpty(values.m_unit_bisnis_id),
      tgl_inv_supp: values.tgl_inv_supp || null,
      no_inv_supp: values.no_inv_supp?.trim() || null,
      no_kontainer: values.no_kontainer?.trim() || null,
      nopol: values.nopol?.trim() || null,
      ekspedisi_pb: toNullIfEmpty(values.ekspedisi_pb),
      catatan: values.catatan?.trim() || null,
      ...(isEditMode.value
        ? { updated_by: currentUserId, edited_by: currentUserId }
        : { created_by: currentUserId, updated_by: currentUserId, edited_by: currentUserId }),
      t_penerimaan_barang_ds: detailItems.value.map((item) => ({
        ...(item.id && { id: item.id }),
        t_purchase_order_id: toNullIfEmpty(item.t_purchase_order_id),
        t_purchase_order_d_id: toNullIfEmpty(item.t_purchase_order_d_id),
        m_items_id: toNullIfEmpty(item.m_items_id),
        rak_d_id: toNullIfEmpty(item.rak_d_id),
        batch: item.is_batch ? (item.batch?.trim() || null) : null,
        qty_diterima: Number(item.qty_diterima) || 0,
        qty_ots: Number(item.qty_diterima) || 0, // qty_ots disamakan dengan qty_diterima saat create/update
        qty_sisa: item.qty_sisa || 0, // Simpan qty_sisa dari PO
        catatan: item.catatan?.trim() || null,
      })),
      t_penerimaan_barang_bonuss: bonusItems.value.map((item) => ({
        ...(item.id && { id: item.id }),
        m_items_id: toNullIfEmpty(item.m_items_id),
        qty_terima: item.qty_terima || 0,
        qty_uom: item.qty_uom?.trim() || null,
        catatan: item.catatan?.trim() || null,
      })),
    };

    if (!isEditMode.value) {
      payload.created_by = currentUserId;
    }

    if (isEditMode.value) {
      await updateTPenerimaan(menuId.value, payload);
      toast.success("Penerimaan Barang berhasil diperbarui", {
        description: `Penerimaan ${values.no_penerimaan || ""} telah diperbarui`,
      });
    } else {
      await createTPenerimaan(payload);
      toast.success("Penerimaan Barang berhasil dibuat", {
        description: "Data penerimaan baru telah ditambahkan",
      });
    }

    router.replace("/purchasing/transaksi/t_penerimaan?reload=" + Date.now());
  } catch (error) {
    toast.error(
      isEditMode.value
        ? "Gagal memperbarui Penerimaan"
        : "Gagal membuat Penerimaan",
      {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      },
    );
  } finally {
    loading.value = false;
  }
};

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push("/purchasing/transaksi/t_penerimaan");
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
        <h1 class="text-2xl font-bold text-foreground">{{ pageTitle }}</h1>
        <p class="text-sm text-muted-foreground">{{ pageDescription }}</p>
      </div>
    </div>

    <!-- ================================================================ -->
    <!-- FORM SECTION -->
    <!-- ================================================================ -->
    <form class="space-y-6" @submit.prevent>
      <!-- HEADER CARD -->
      <Card>
        <CardHeader>
          <CardTitle>Informasi Penerimaan Barang</CardTitle>
          <CardDescription
            >Isi data penerimaan barang dengan lengkap dan
            benar</CardDescription
          >
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Single Column Layout -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Company (Super Admin: Dropdown, User: readonly display) -->
            <div v-if="isSuperAdmin" class="space-y-2">
              <FieldSelect
                id="m_unit_bisnis_id"
                label="Unit Bisnis"
                v-model="values.m_unit_bisnis_id"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                :clearable="!isReadOnly"
                placeholder="Pilih Unit Bisnis"
                displayField="nama_comp"
                valueField="id"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    searchfield: 'kode_unit_bisnis,nama_comp,pic',
                    filter_column_is_active: true,
                    no_pagination: 'true',
                    include: 'm_company',
                  },
                }"
                @update:valueFull="handleCompanySelect"
              />
            </div>
            <div v-else>
              <FieldX
                id="company_display"
                label="Unit Bisnis"
                :value="companyNameDisplay"
                disabled
                readonly
              />
            </div>

            <FieldX
              id="company_readonly"
              label="Company"
              :value="selectedCompanyNameDisplay"
              disabled
              readonly
              placeholder="Company otomatis dari unit bisnis"
            />

            <!-- Status (Readonly, Default DRAFT) -->
            <FieldX
              id="status"
              label="Status"
              :value="values.status"
              disabled
              readonly
              placeholder="Status Penerimaan"
            />

            <!-- No. PB (Auto, Readonly) -->
            <FieldX
              id="no_penerimaan"
              label="No. PB"
              :value="values.no_penerimaan"
              disabled
              readonly
              placeholder="Auto generate by system"
            />

            <!-- Tgl. PB -->
            <FieldDate
              id="tgl_penerimaan"
              label="Tgl. PB"
              :value="values.tgl_penerimaan"
               :required="!isReadOnly"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
              placeholder="Tanggal hari ini"
            />

            <!-- Supplier (FieldPopup) -->
            <FieldPopup
              id="m_supplier_id"
              label="Supplier"
              :value="values.m_supplier_id"
              @input="
                (v: string) => {
                  values.m_supplier_id = v;
                  errors.m_supplier_id = '';
                }
              "
              @update:valueFull="handleSupplierSelect"
              :errorText="errors.m_supplier_id ? 'failed' : ''"
              :hints="errors.m_supplier_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              placeholder="Pilih Supplier"
              displayField="nama_supp"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_supplier`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'nama_supp,alamat_supp,no_telp',
                  include: 'm_general:id|value1',
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page
                    ? true
                    : false;
                  return response;
                },
              }"
              :columns="[
                {
                  field: 'nama_supp',
                  headerName: 'Nama Supplier',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'tipe_supp.value1',
                  headerName: 'Tipe Supplier',
                  width: '120px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                  render: (row: any) => row.tipe_supp?.value1 || '-',
                },
                {
                  field: 'alamat_supp',
                  headerName: 'Alamat',
                  width: '250px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'no_telp',
                  headerName: 'No. Telp',
                  width: '150px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
              ]"
            />

            <!-- Gudang (FieldSelect) - Filtered by Company -->
            <FieldSelect
              id="m_gudang_id"
              label="Gudang"
              :value="values.m_gudang_id"
              @input="
                (v: string) => {
                  values.m_gudang_id = v;
                  errors.m_gudang_id = '';
                }
              "
              @update:valueFull="handleGudangSelect"
              :errorText="errors.m_gudang_id ? 'failed' : ''"
              :hints="
                errors.m_gudang_id ||
                (values.m_unit_bisnis_id
                  ? 'Gudang difilter berdasarkan unit bisnis yang dipilih'
                  : 'Pilih unit bisnis terlebih dahulu')
              "
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || !values.m_unit_bisnis_id"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              :placeholder="
                values.m_unit_bisnis_id
                  ? 'Pilih Gudang'
                  : 'Pilih unit bisnis terlebih dahulu'
              "
              displayField="nama_gudang"
              valueField="id"
              :api="gudangApiConfig"
              :key="`gudang-${values.m_unit_bisnis_id}`"
            />

            <!-- No. Kontainer -->
            <FieldX
              id="no_kontainer"
              label="No. Kontainer"
              :value="values.no_kontainer"
              @input="(v: string) => (values.no_kontainer = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Masukkan no. kontainer"
            />

            <!-- Need Biaya Kirim -->
            <FieldStatus
              id="need_biaya_kirim"
              label="Need Biaya Kirim"
              :model-value="values.need_biaya_kirim"
              @update:model-value="handleNeedBiayaKirimChange"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              active-text="YES"
              inactive-text="NO"
            />

            <!-- No. SJ Supplier -->
            <FieldX
              id="no_sj_supp"
              label="No. SJ Supplier"
              :value="values.no_sj_supp"
              @input="
                (v: string) => {
                  values.no_sj_supp = v;
                  errors.no_sj_supp = '';
                }
              "
              :errorname="errors.no_sj_supp ? 'failed' : ''"
              :hints="errors.no_sj_supp"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Masukkan no. SJ supplier"
            />

            <!-- Tgl. SJ Supplier -->
            <FieldDate
              id="tgl_sj_supp"
              label="Tgl. SJ Supplier"
              :value="values.tgl_sj_supp"
              @input="
                (v: string) => {
                  values.tgl_sj_supp = v;
                  errors.tgl_sj_supp = '';
                }
              "
              :errorname="errors.tgl_sj_supp ? 'failed' : ''"
              :hints="errors.tgl_sj_supp"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :required="!isReadOnly"   
              placeholder="Pilih tanggal"
            />

            <!-- No. Invoice Supplier -->
            <FieldX
              id="no_inv_supp"
              label="No. Invoice Supplier"
              :value="values.no_inv_supp"
              @input="(v: string) => (values.no_inv_supp = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Masukkan no. invoice supplier"
            />

            <!-- Tgl. Invoice Supplier -->
            <FieldDate
              id="tgl_inv_supp"
              label="Tgl. Invoice Supplier"
              :value="values.tgl_inv_supp"
              @input="(v: string) => (values.tgl_inv_supp = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              placeholder="Pilih tanggal"
            />

            <!-- Nopol -->
            <FieldX
              id="nopol"
              label="Nopol"
              :value="values.nopol"
              @input="(v: string) => (values.nopol = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Masukkan nopol kendaraan"
            />

            <!-- Ekspedisi -->
            <FieldSelect
              id="ekspedisi_pb"
              label="Ekspedisi"
              :value="values.ekspedisi_pb"
              @input="
                (v: string) => {
                  values.ekspedisi_pb = v;
                }
              "
              displayField="nama"
              valueField="id"
              :api="ekspedisiApiConfig"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              placeholder="Pilih ekspedisi"
            />

            <!-- Catatan -->
            <FieldTextarea
              id="catatan"
              label="Catatan"
              :value="values.catatan"
              @input="(v: string) => (values.catatan = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Catatan tambahan"
              :rows="2"
            />
          </div>
        </CardContent>
      </Card>

      <!-- DETAIL TABS -->
      <Card>
        <CardHeader>
          <CardTitle>Penerimaan Barang Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs default-value="detail" class="w-full">
            <TabsList>
              <TabsTrigger value="detail">Detail Item</TabsTrigger>
              <TabsTrigger value="bonus">Bonus Item</TabsTrigger>
            </TabsList>

            <!-- TAB: Detail Item -->
            <TabsContent value="detail" class="space-y-4 mt-4">
              <div class="flex items-center justify-between">
                <p class="text-sm text-muted-foreground">
                  Item dari PO yang diterima
                </p>
                <ButtonMultiSelect
                  v-if="!isReadOnly && values.m_supplier_id"
                  title="Pilih Items dari PO"
                  @add="handleAddDetailItems"
                  :api="detailItemsApiConfig"
                  :columns="[
                    {
                      field: 't_purchase_order.no_po',
                      headerName: 'No. PO',
                      width: '150px',
                      sortable: true,
                      filterable: true,
                      filter: 'ColFilter',
                      render: (row: any) => row.t_purchase_order?.no_po || '-',
                    },
                    {
                      field: 'm_item.kode_item',
                      headerName: 'Kode Item',
                      width: '150px',
                      sortable: true,
                      filterable: true,
                      filter: 'ColFilter',
                      render: (row: any) => row.m_item?.kode_item || '-',
                    },
                    {
                      field: 'm_item.nama_item',
                      headerName: 'Nama Item',
                      width: '200px',
                      sortable: true,
                      filterable: true,
                      filter: 'ColFilter',
                      render: (row: any) => row.m_item?.nama_item || '-',
                    },
                    {
                      field: 'qty_po',
                      headerName: 'Qty PO',
                      width: '80px',
                      sortable: true,
                      filterable: false,
                    },
                    {
                      field: 'qty_diterima',
                      headerName: 'Qty Diterima',
                      width: '100px',
                      sortable: false,
                      filterable: false,
                      render: (row: any) => row.qty_diterima || 0,
                    },
                    {
                      field: 'qty_sisa',
                      headerName: 'Qty Sisa',
                      width: '80px',
                      sortable: false,
                      filterable: false,
                      render: (row: any) => row.qty_sisa || 0,
                    },
                    {
                      field: 'm_item.uom.value1',
                      headerName: 'Satuan',
                      width: '80px',
                      sortable: false,
                      filterable: false,
                      render: (row: any) => row.m_item?.uom?.value1 || '-',
                    },
                  ]"
                  :disabled="loading"
                />
                <span
                  v-if="!isReadOnly && !values.m_supplier_id"
                  class="text-sm text-muted-foreground italic"
                >
                  Pilih supplier terlebih dahulu
                </span>
              </div>

              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium">No</th>
                      <th class="px-3 py-2 text-left font-medium">No. PO</th>
                      <th class="px-3 py-2 text-left font-medium">Kode</th>
                      <th class="px-3 py-2 text-left font-medium">Nama Item</th>
                      <th class="px-3 py-2 text-right font-medium">Qty PO</th>
                      <th class="px-3 py-2 text-right font-medium">Qty Sisa</th>
                      <th class="px-3 py-2 text-right font-medium">
                        Qty Diterima
                      </th>
                      <th class="px-3 py-2 text-left font-medium">Satuan</th>
                      <th class="px-3 py-2 text-left font-medium">Rak</th>
                      <th class="px-3 py-2 text-left font-medium">Batch</th>
                      <th class="px-3 py-2 text-left font-medium">Catatan</th>
                      <th class="px-2 py-2 text-center font-medium w-20">
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailItems.length === 0">
                      <td
                        colspan="12"
                        class="text-center py-8 text-muted-foreground"
                      >
                        Belum ada item. Klik "+ Add to List" untuk menambahkan.
                      </td>
                    </tr>
                    <tr
                      v-for="(item, idx) in detailItems"
                      :key="item.t_purchase_order_d_id || idx"
                      class="border-t hover:bg-muted/50"
                    >
                      <td class="px-3 py-2">{{ idx + 1 }}</td>
                      <td class="px-3 py-2">{{ item.no_po }}</td>
                      <td class="px-3 py-2">{{ item.kode_item }}</td>
                      <td class="px-3 py-2">{{ item.nama_item }}</td>
                      <td class="px-3 py-2 text-right">{{ item.qty_po }}</td>
                      <td
                        class="px-3 py-2 text-right font-medium"
                        :class="getDisplaySisaQty(item) <= 0 && !isReadOnly ? 'text-red-600' : 'text-blue-600'"
                      >
                        {{ getDisplaySisaQty(item) }}
                      </td>
                      <td class="px-3 py-2">
                        <div v-if="!isReadOnly" class="flex flex-col gap-1">
                          <FieldNumber
                            :key="`qty-diterima-${idx}`"
                            :value="item.qty_diterima ?? ''"
                            @update:modelValue="
                              (v: string | number) => {
                                item.qty_diterima = normalizeQtyDiterima(
                                  v,
                                  getMaxQtyDiterima(item),
                                );
                              }
                            "
                            @blur="
                              () => {
                                item.qty_diterima = normalizeQtyDiterima(
                                  item.qty_diterima,
                                  getMaxQtyDiterima(item),
                                );
                              }
                            "
                            :min="0"
                            :max="getMaxQtyDiterima(item)"
                            :disabled="loading"
                            class="w-24 qty-diterima-input"
                          />
                        </div>
                        <span v-else class="text-xs sm:text-sm">{{
                          item.qty_diterima || 0
                        }}</span>
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ item.satuan }}
                      </td>
                      <td class="px-3 py-2 min-w-[220px]">
                        <template v-if="!isReadOnly">
                          <FieldSelect
                            :id="`rak-${idx}`"
                            :value="item.rak_d_id || ''"
                            @input="(v: string) => (item.rak_d_id = v)"
                            :options="rackOptions"
                            displayField="label"
                            valueField="id"
                            :disabled="loading || !values.m_gudang_id"
                            :readonly="isReadOnly"
                            placeholder="Pilih Rak"
                            class="w-full"
                          />
                        </template>
                        <span v-else class="text-xs sm:text-sm">{{
                          getRackLabelById(item.rak_d_id)
                        }}</span>
                      </td>
                      <td class="px-3 py-2 min-w-[170px]">
                        <template v-if="item.is_batch">
                          <template v-if="!isReadOnly">
                            <FieldText
                              :id="`batch-${idx}`"
                              :value="item.batch || ''"
                              @input="(v: string) => (item.batch = v)"
                              :disabled="loading"
                              :placeholder="defaultBatchPreview || 'No PB + Tgl'"
                              class="w-full text-xs sm:text-sm"
                            />
                          </template>
                          <span v-else class="text-xs sm:text-sm font-mono">{{
                            item.batch || '-'
                          }}</span>
                        </template>
                        <span v-else class="text-xs text-muted-foreground italic">-</span>
                      </td>
                      <td class="px-3 py-2">
                        <template v-if="!isReadOnly">
                          <FieldTextarea 
                            :id="`catatan-detail-${idx}`" 
                            :value="item.catatan"
                            @input="(v: string) => (item.catatan = v)"
                            :disabled="loading" 
                            placeholder="Catatan" 
                            :rows="3" 
                          />
                        </template>
                        <span v-else class="text-xs sm:text-sm whitespace-pre-line">{{ item.catatan || '-' }}</span>
                      </td>
                      <td class="px-2 py-2">
                        <div class="flex items-center gap-1 justify-center">
                          <Button
                            v-if="
                              item.history_penerimaan &&
                              item.history_penerimaan.length > 0
                            "
                            variant="ghost"
                            size="sm"
                            @click="
                              toggleHistoryView(item.t_purchase_order_d_id)
                            "
                            :class="{
                              'bg-primary/10 text-primary':
                                selectedItemForHistory ===
                                item.t_purchase_order_d_id,
                            }"
                            :title="
                              selectedItemForHistory ===
                              item.t_purchase_order_d_id
                                ? 'Tutup History'
                                : 'Lihat History'
                            "
                          >
                            <History class="h-4 w-4" />
                          </Button>
                          <DeleteButton
                            v-if="!isReadOnly"
                            variant="ghost"
                            size="sm"
                            @click="removeDetailItem(idx)"
                          />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- CATATAN BONUS SUMMARY -->
              <div
                v-if="uniquePoCatatanBonus.length > 0"
                class="mt-4 border rounded-lg p-4 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
              >
                <p
                  class="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2"
                >
                  📝 Catatan Bonus dari PO
                </p>
                <ul class="space-y-1">
                  <li
                    v-for="entry in uniquePoCatatanBonus"
                    :key="entry.no_po"
                    class="flex items-start gap-2 text-sm"
                  >
                    <span
                      class="font-medium text-amber-900 dark:text-amber-100 min-w-[100px]"
                      >{{ entry.no_po }}</span
                    >
                    <span class="text-muted-foreground">—</span>
                    <span class="text-amber-800 dark:text-amber-200">{{
                      entry.catatan_bonus
                    }}</span>
                  </li>
                </ul>
              </div>
            </TabsContent>

            <!-- TAB: Bonus Item -->
            <TabsContent value="bonus" class="space-y-4 mt-4">
              <div class="flex items-center justify-between">
                <p class="text-sm text-muted-foreground">
                  Item bonus yang diterima
                </p>
                <ButtonMultiSelect
                  v-if="!isReadOnly"
                  title="Pilih Bonus Item"
                  @add="
                    (items: any[]) => {
                      items.forEach((item: any) => {
                        // Check if not already added
                        const exists = bonusItems.find(
                          (b) => b.m_items_id === item.id,
                        );
                        if (!exists) {
                          bonusItems.push({
                            m_items_id: item.id,
                            qty_terima: 0,
                            qty_uom: item.mi_uom?.value1 || '',
                            catatan: '',
                            kode_item: item.kode_item || '-',
                            nama_item: item.nama_item || '-',
                          });
                        }
                      });
                    }
                  "
                  :api="bonusItemsApiConfig"
                  :columns="[
                    {
                      field: 'kode_item',
                      headerName: 'Kode Item',
                      width: '150px',
                      sortable: true,
                      filterable: true,
                      filter: 'ColFilter',
                    },
                    {
                      field: 'nama_item',
                      headerName: 'Nama Item',
                      width: '250px',
                      sortable: true,
                      filterable: true,
                      filter: 'ColFilter',
                    },
                    {
                      field: 'mi_uom.value1',
                      headerName: 'Satuan',
                      width: '80px',
                      sortable: false,
                      filterable: false,
                      render: (row: any) => row.mi_uom?.value1 || '-',
                    },
                  ]"
                  :disabled="loading"
                />
              </div>

              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium">No</th>
                      <th class="px-3 py-2 text-left font-medium">Kode</th>
                      <th class="px-3 py-2 text-left font-medium">Nama Item</th>
                      <th class="px-3 py-2 text-right font-medium">
                        Qty Diterima
                      </th>
                      <th class="px-3 py-2 text-left font-medium">Satuan</th>
                      <th class="px-3 py-2 text-left font-medium">Catatan</th>
                      <th
                        v-if="!isReadOnly"
                        class="px-2 py-2 text-center font-medium w-12"
                      ></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="bonusItems.length === 0">
                      <td
                        :colspan="isReadOnly ? 6 : 7"
                        class="text-center py-8 text-muted-foreground"
                      >
                        Belum ada bonus item. Klik "Pilih Bonus Item" untuk
                        menambahkan.
                      </td>
                    </tr>
                    <tr
                      v-for="(item, idx) in bonusItems"
                      :key="item.m_items_id || idx"
                      class="border-t hover:bg-muted/50"
                    >
                      <td class="px-3 py-2">{{ idx + 1 }}</td>
                      <td class="px-3 py-2">{{ item.kode_item }}</td>
                      <td class="px-3 py-2">{{ item.nama_item }}</td>
                      <td class="px-3 py-2">
                        <Input
                          v-model.number="item.qty_terima"
                          type="number"
                          min="1"
                          class="w-20 text-right"
                          :disabled="isReadOnly"
                          @input="
                            () => {
                              if ((Number(item.qty_terima) || 0) < 1) {
                                item.qty_terima = 1;
                              }
                            }
                          "
                        />
                      </td>
                      <td class="px-3 py-2">{{ item.qty_uom }}</td>
                      <td class="px-3 py-2">
                        <template v-if="!isReadOnly">
                          <FieldTextarea 
                            :id="`catatan-bonus-${idx}`" 
                            :value="item.catatan"
                            @input="(v: string) => (item.catatan = v)"
                            :disabled="loading" 
                            placeholder="Catatan" 
                            :rows="3" 
                          />
                        </template>
                        <span v-else class="text-xs sm:text-sm whitespace-pre-line">{{ item.catatan || '-' }}</span>
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                        <DeleteButton
                          variant="ghost"
                          size="sm"
                          @click="removeBonusItem(idx)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <!-- HISTORY PENERIMAAN -->
      <Card v-if="selectedItemWithHistory" id="history-penerimaan-section">
        <CardHeader>
          <div class="flex items-start justify-between">
            <div>
              <CardTitle>History Penerimaan</CardTitle>
              <CardDescription
                >Riwayat penerimaan barang yang sudah di-POST</CardDescription
              >
            </div>
            <Button
              variant="ghost"
              size="sm"
              @click="selectedItemForHistory = null"
            >
              <span class="text-xs">Tutup</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div class="space-y-6">
            <template
              v-for="(item, idx) in [selectedItemWithHistory]"
              :key="idx"
            >
              <div
                v-if="
                  item.history_penerimaan && item.history_penerimaan.length > 0
                "
                class="space-y-3"
              >
                <div class="flex items-center gap-2 pb-2 border-b">
                  <div class="flex-1">
                    <h3 class="font-semibold text-base">
                      {{ item.nama_item }}
                    </h3>
                    <p class="text-xs text-muted-foreground">
                      {{ item.kode_item }} • No. PO: {{ item.no_po }}
                    </p>
                  </div>
                  <div class="text-right">
                    <p class="text-xs text-muted-foreground">Total Diterima</p>
                    <p class="text-lg font-bold text-primary">
                      {{
                        item.history_penerimaan.reduce(
                          (sum, h) => sum + (h.qty_diterima || 0),
                          0,
                        )
                      }}
                      {{ item.satuan }}
                    </p>
                  </div>
                </div>
                <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  <Card
                    v-for="(history, hIdx) in item.history_penerimaan"
                    :key="hIdx"
                    class="border-l-4 border-l-primary"
                  >
                    <CardHeader class="pb-3">
                      <CardTitle
                        class="text-sm font-medium flex items-center justify-between"
                      >
                        <span>Penerimaan #{{ hIdx + 1 }}</span>
                        <span
                          class="text-xs font-normal text-muted-foreground"
                          >{{ history.no_penerimaan }}</span
                        >
                      </CardTitle>
                    </CardHeader>
                    <CardContent class="space-y-2">
                      <div
                        v-if="history.tanggal_penerimaan"
                        class="flex items-center justify-between text-sm pb-2 border-b"
                      >
                        <span class="text-muted-foreground">Tanggal:</span>
                        <span class="font-medium">{{
                          new Date(
                            history.tanggal_penerimaan,
                          ).toLocaleDateString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        }}</span>
                      </div>
                      <div class="flex items-center justify-between text-sm">
                        <span class="text-muted-foreground">Qty Diterima:</span>
                        <span class="font-semibold text-primary"
                          >{{ history.qty_diterima || 0 }}
                          {{ item.satuan }}</span
                        >
                      </div>
                      <div class="flex items-center justify-between text-sm">
                        <span class="text-muted-foreground">Qty Sisa:</span>
                        <span
                          class="font-semibold"
                          :class="
                            (history.qty_sisa || 0) > 0
                              ? 'text-orange-600'
                              : 'text-green-600'
                          "
                        >
                          {{ history.qty_sisa || 0 }} {{ item.satuan }}
                        </span>
                      </div>
                      <div v-if="history.gudang_id" class="pt-2 border-t">
                        <div class="text-xs text-muted-foreground mb-1">
                          Gudang:
                        </div>
                        <div class="text-sm font-medium">
                          {{ history.nama_gudang }}
                        </div>
                        <div class="text-xs text-muted-foreground">
                          {{ history.kode_gudang }}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </template>
          </div>
        </CardContent>
      </Card>

      <AuditInfo
        v-if="(isViewMode || isEditMode) && !isCopyMode"
        :created-by="auditMeta.created_by"
        :created-at="auditMeta.createdAt"
        :updated-by="auditMeta.updated_by"
        :updated-at="auditMeta.updatedAt"
      />

      <!-- ================================================================ -->
      <!-- ACTION BUTTONS -->
      <!-- ================================================================ -->
      <div
        class="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-end sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t sm:border-0 -mx-6 px-6 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:static"
      >
        <Button
          type="button"
          variant="outline"
          @click="handleCancel"
          :disabled="loading"
          class="w-full sm:w-auto"
        >
          {{ isReadOnly ? "Kembali" : "Batal" }}
        </Button>
        <Button
          v-if="!isReadOnly"
          type="button"
          @click="onSave"
          :disabled="loading"
          class="gap-2 w-full sm:w-auto"
        >
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          {{ isEditMode ? "Perbarui" : "Simpan" }}
        </Button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.required::after {
  content: " *";
  color: hsl(var(--destructive));
}

:deep(.qty-diterima-input input) {
  background-color: #ffffff !important;
  color: #0f172a !important;
  border-color: #94a3b8 !important;
}

:deep(.qty-diterima-input input:focus) {
  border-color: #0f3b70 !important;
  box-shadow: 0 0 0 2px rgba(15, 59, 112, 0.25) !important;
}
</style>
