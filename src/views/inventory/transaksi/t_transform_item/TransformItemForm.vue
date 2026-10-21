<script setup lang="ts">
import { ref, reactive, onBeforeMount, computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
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
  FieldDate,
  FieldTextarea,
  FieldPopup,
} from "@/components/field";
import { ButtonMultiSelect, DeleteButton } from "@/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Save, Loader2, Send, Plus, AlertCircle } from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createTransformItem,
  updateTransformItem,
  getTransformItemById,
  approveTransformItem,
  getTransformItemLogs,
} from "./service";
import { _BOOLEAN_MIXED_GRID_OPTIONS } from "ag-grid-community";
import AuditInfo from "@/components/AuditInfo.vue";

const authStore = useAuthStore();
const { API_BASE_URL } = useApi();
const router = useRouter();
const route = useRoute();

const loading = ref(false);
const isEditMode = computed(
  () => !!route.params.id && route.name === "TransformItemForm",
);
const isViewMode = computed(() => route.name === "TransformItemView");
const isCopyMode = computed(
  () =>
    !!route.query.copy ||
    (route.query.action === "copy" && !!route.query.source),
);
const menuId = computed(() => route.params.id as string);

const isSuperAdmin = computed(() => {
  const user = authStore.user;
  if (!user || !user.tipe) return false;
  return user.tipe.value1?.toUpperCase() === "SUPER ADMIN";
});

// Status locked: IN APPROVAL, APPROVED, REJECT → tidak bisa edit (kecuali Super Admin)
const isStatusLocked = computed(() => {
  const status = values.status?.toUpperCase();
  return (
    status === "IN APPROVAL" || status === "APPROVED" || status === "REJECT"
  );
});

// Status REVISI → perlu re-approval saat save (kecuali Super Admin)
const isRevisiStatus = computed(() => {
  if (isSuperAdmin.value) return false;
  return values.status?.toUpperCase() === "REVISI";
});

const isReadOnly = computed(() => {
  if (isSuperAdmin.value)
    return isViewMode.value || route.meta.readOnly === true;
  return (
    isViewMode.value || route.meta.readOnly === true || isStatusLocked.value
  );
});

const companyNameDisplay = computed(() => {
  if (!isSuperAdmin.value) {
    try {
      const selectRespo = localStorage.getItem("SelectRespo");
      if (selectRespo) {
        const parsed = JSON.parse(selectRespo);
        return parsed.companyName || "-";
      }
    } catch {
      // ignore
    }
  }
  return "-";
});

// Nama company (perusahaan induk) dari Unit Bisnis yang dipilih.
// Tampil sebagai field readonly ketika Super Admin memilih Unit Bisnis.
// Diisi langsung dari data relasi m_company yang ikut terkirim
// (FieldSelect m_unit_bisnis di-join dengan m_company).
const selectedUnitBisnisCompanyName = ref<string>("");

const handleUnitBisnisSelected = (item: any) => {
  selectedUnitBisnisCompanyName.value =
    item?.m_company?.nama || item?.m_company?.kode || "";
};

// Untuk mode Edit/View/Copy, FieldSelect tidak meng-emit valueFull saat
// load awal, jadi ambil nama company-nya via API sekali saja.
const fetchUnitBisnisCompanyName = async (unitBisnisId: string) => {
  if (!unitBisnisId) {
    selectedUnitBisnisCompanyName.value = "";
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_unit_bisnis/${unitBisnisId}?join=true`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    const result = await response.json();
    if (result?.status === "success" && result.data) {
      selectedUnitBisnisCompanyName.value =
        result.data?.m_company?.nama ||
        result.data?.m_company?.kode ||
        "-";
    }
  } catch {
    // ignore, field will just stay empty
  }
};

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Transform Item";
  if (isCopyMode.value) return "Salin Transform Item";
  if (isEditMode.value) return "Edit Transform Item";
  return "Tambah Transform Item";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Transform Item";
  if (isCopyMode.value)
    return "Buat Transform Item baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Transform Item";
  return "Buat data Transform Item baru";
});

let values = reactive({
  no_transform_item: "",
  m_unit_bisnis_id: "",
  transform_no: "",
  m_transform_id: "",
  tgl_transform: new Date().toISOString().split("T")[0],
  jenis_transform: "",
  warehouse: "",
  item_id: "",
  stock_gudang_id: "",
  batch: "",
  qty: 1,
  satuan_id: "",
  pic_id: "",
  status: "DRAFT",
  catatan: "",
  created_by: authStore.user?.id || "",
});

let initialValues: Record<string, any> = {};
const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});
const detailItems = ref<any[]>([]);
const headerItemIsBatch = ref<boolean>(false);

const defaultBatchPreview = computed(() => {
  const no = values.no_transform_item?.trim() || "No Transform";
  const tgl = values.tgl_transform ? values.tgl_transform.split("T")[0] : "";
  if (tgl) {
    const parts = tgl.split("-");
    if (parts.length === 3) {
      return `${no} ${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return no ? `${no} + Tgl` : "No Transform + Tgl";
});
const mainItemLabel = ref("-");
const selectedCutItemLength = ref(0);
const isSuperAdminDialogOpen = ref(false);

const detailLog = ref<any[]>([]);
const loadingLog = ref(false);

const loadTransformItemLogs = async (itemId?: string) => {
  const targetId = itemId || menuId.value;
  if (!targetId) return;
  loadingLog.value = true;
  try {
    const result = await getTransformItemLogs(targetId);
    if (result.status === "success" && Array.isArray(result.data)) {
      detailLog.value = result.data;
    }
  } catch (e) {
    console.error("Failed to load transform item logs", e);
  } finally {
    loadingLog.value = false;
  }
};

const formatLogDate = (dateVal: any): string => {
  if (!dateVal) return "-";
  try {
    const date = new Date(dateVal);
    if (isNaN(date.getTime())) return String(dateVal);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return String(dateVal);
  }
};

const getLogUser = (log: any): string => {
  return (
    log.user_default?.name ||
    log.user?.name ||
    log.created_by_user?.name ||
    log.updated_by_user?.name ||
    log.user_name ||
    log.created_by_name ||
    "-"
  );
};

const parseLogData = (data: any): Record<string, any> | null => {
  if (!data) return null;
  if (typeof data === "object") return data;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  return null;
};

const formatFieldKey = (key: string): string => {
  return key
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

const rackOptions = ref<{ id: string; label: string }[]>([]);
const rackOptionsByItemId = ref<Record<string, { id: string; label: string }[]>>(
  {},
);
const selectedItemIds = computed(() => {
  return detailItems.value.map((item: any) => item.item_id).filter(Boolean);
});
const selectedJenisTransform = ref<Record<string, any> | null>(null);
const selectedSatuan = ref<Record<string, any> | null>(null);

const isRemoveTransform = computed(() => {
  const code = String(selectedJenisTransform.value?.code || "").toUpperCase();
  const label = String(selectedJenisTransform.value?.value1 || "").toUpperCase();
  return code === "REMOVE" || label === "REMOVE";
});
const isCutTransform = computed(() => {
  const code = String(selectedJenisTransform.value?.code || "").toUpperCase();
  const label = String(selectedJenisTransform.value?.value1 || "").toUpperCase();
  return code === "CUT" || label === "CUT";
});
const isConversionTransform = computed(() => {
  const code = String(selectedJenisTransform.value?.code || "").toUpperCase();
  const label = String(selectedJenisTransform.value?.value1 || "").toUpperCase();
  return (
    code === "CONVERSION" ||
    code === "KONVERSI" ||
    code === "CONVERT" ||
    label === "CONVERSION" ||
    label === "KONVERSI" ||
    label.includes("CONVER") ||
    label.includes("KONVER")
  );
});

const isSameUom = (
  headerSatuanId: string | null | undefined,
  headerSatuanName: string | null | undefined,
  detailUomId: string | null | undefined,
  detailUomName: string | null | undefined,
): boolean => {
  if (
    headerSatuanId &&
    detailUomId &&
    String(headerSatuanId).trim() !== "" &&
    String(detailUomId).trim() !== ""
  ) {
    if (
      String(headerSatuanId).trim().toLowerCase() ===
      String(detailUomId).trim().toLowerCase()
    ) {
      return true;
    }
  }

  const normHeader = String(headerSatuanName || "").trim().toUpperCase();
  const normDetail = String(detailUomName || "").trim().toUpperCase();

  if (normHeader && normDetail && normHeader !== "-" && normDetail !== "-") {
    if (normHeader === normDetail) {
      return true;
    }
  }

  return false;
};

const handleSatuanSelect = (item: any) => {
  selectedSatuan.value = item || null;
  if (errors.satuan_id) {
    errors.satuan_id = "";
  }
  validateConversionUomConflict();
};

const validateConversionUomConflict = (): boolean => {
  if (!isConversionTransform.value) {
    if (errors.satuan_id?.includes("UoM detail") || errors.satuan_id?.includes("UoM item detail")) {
      errors.satuan_id = "";
    }
    Object.keys(detailErrors.value).forEach((k) => {
      const idx = Number(k);
      if (detailErrors.value[idx]?.uom) {
        delete detailErrors.value[idx].uom;
      }
    });
    return true;
  }

  const headerSatuanId = values.satuan_id;
  const headerSatuanName =
    selectedSatuan.value?.value1 || selectedSatuan.value?.code || "";

  if (!headerSatuanName && !headerSatuanId) {
    return true;
  }

  let hasConflict = false;
  const conflictingKodes: string[] = [];

  detailItems.value.forEach((item: any, idx: number) => {
    const detailUomId = item.uom_id;
    const detailUomName = item.uom;

    if (isSameUom(headerSatuanId, headerSatuanName, detailUomId, detailUomName)) {
      hasConflict = true;
      conflictingKodes.push(item.kode_item || `Baris ${idx + 1}`);
      if (!detailErrors.value[idx]) {
        detailErrors.value[idx] = {};
      }
      detailErrors.value[idx].uom = `UoM (${detailUomName}) tidak boleh sama dengan satuan header (${headerSatuanName})`;
    } else {
      if (detailErrors.value[idx]?.uom) {
        delete detailErrors.value[idx].uom;
      }
    }
  });

  if (hasConflict) {
    errors.satuan_id = `Satuan header (${headerSatuanName}) tidak boleh sama dengan UoM detail: ${conflictingKodes.join(", ")}`;
    return false;
  } else {
    if (
      errors.satuan_id?.includes("UoM detail") ||
      errors.satuan_id?.includes("UoM item detail")
    ) {
      errors.satuan_id = "";
    }
    return true;
  }
};


// Revisi confirmation dialog state
const isRevisiDialogOpen = ref(false);
const approvalMessage = ref("");
const approvalMessageError = ref("");
const toBool = (value: any) =>
  value === true ||
  value === 1 ||
  value === "1" ||
  String(value).toLowerCase() === "true";

const toNumber = (value: any): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const clean = String(value ?? "").replace(/[^0-9,.-]/g, "");
  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getItemLength = (item: any): number =>
  toNumber(
    item?.ukuran ??
      item?.panjang ??
      item?.m_item?.ukuran ??
      item?.item?.ukuran ??
      item?.m_items?.ukuran,
  );

const cutTotalLength = computed(
  () => selectedCutItemLength.value * (Number(values.qty) || 0),
);

const cutUsedLength = computed(() =>
  detailItems.value.reduce((total, item: any) => {
    return total + toNumber(item.panjang) * (Number(item.qty_transform) || 0);
  }, 0),
);

const cutRemainingLengthRaw = computed(
  () => cutTotalLength.value - cutUsedLength.value,
);

const cutRemainingLength = computed(() =>
  Math.max(cutRemainingLengthRaw.value, 0),
);

const cutToleranceLength = computed(() => cutTotalLength.value * 0.02);

const cutMinimumUsedLength = computed(() =>
  Math.max(cutTotalLength.value - cutToleranceLength.value, 0),
);

const formatNumber = (value: number): string =>
  Number.isFinite(value)
    ? new Intl.NumberFormat("id-ID", {
        maximumFractionDigits: 3,
      }).format(value)
    : "0";

const getRakLabelById = (rakDId?: string): string => {
  if (!rakDId) return "-";
  const fromHeader = rackOptions.value.find((r) => r.id === rakDId)?.label;
  if (fromHeader) return fromHeader;
  const allDetailOptions = Object.values(rackOptionsByItemId.value).flat();
  return allDetailOptions.find((r) => r.id === rakDId)?.label || "-";
};

const fetchRackOptionsByGudang = async (gudangId: string, itemId?: string) => {
  if (!gudangId || !itemId) {
    rackOptions.value = [];
    return;
  }

  try {
    const params = new URLSearchParams({
      filter_column_m_gudang_id: gudangId,
      filter_column_m_items_id: itemId,
      join: "subhead,sub",
      no_pagination: "true",
    });
    const response = await fetch(
      `${API_BASE_URL}/dynamic/stock_gudang?${params.toString()}`,
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

    const rows = Array.isArray(result.data)
      ? result.data
      : result.data
        ? [result.data]
        : [];

    const optionsMap = new Map<string, { id: string; label: string }>();

    rows.forEach((row: any) => {
      const stockGudangId = row?.id;
      const rakDetail = row?.m_rak_d || row?.rak_detail || null;
      const rakMaster = rakDetail?.m_rak || row?.m_rak || null;
      const rakKode = rakDetail?.kode || row?.kode_rak_d || "-";
      const rakNama = rakMaster?.nama_rak || row?.nama_rak_master || "-";

      if (!stockGudangId) return;
      if (!optionsMap.has(stockGudangId)) {
        optionsMap.set(stockGudangId, {
          id: stockGudangId,
          label: `${rakKode} (${rakNama})`,
        });
      }
    });

    rackOptions.value = Array.from(optionsMap.values());
  } catch (error) {
    rackOptions.value = [];
    console.error("Failed to fetch rack options by gudang:", error);
  }
};

watch(
  () => values.stock_gudang_id,
  async (newVal) => {
    if (!newVal) {
      values.batch = "";
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE_URL}/fn/stock_gudang/getBatchesByStockGudang?stock_gudang_id=${newVal}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authStore.token}`,
          },
        },
      );
      const json = await res.json();
      if (json.status === "success" && Array.isArray(json.data) && json.data.length > 0) {
        values.batch = json.data[0] || "";
      } else {
        values.batch = "";
      }
    } catch (e) {
      console.error("Failed to fetch batch for stock_gudang", e);
    }
  },
);

watch(
  () => values.satuan_id,
  async (newSatuanId) => {
    if (
      newSatuanId &&
      (!selectedSatuan.value || selectedSatuan.value.id !== newSatuanId)
    ) {
      try {
        const res = await fetch(
          `${API_BASE_URL}/dynamic/m_general/${newSatuanId}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authStore.token}`,
            },
          },
        );
        const result = await res.json();
        if (result?.status === "success" && result.data) {
          selectedSatuan.value = result.data;
        }
      } catch {
        // ignore
      }
    } else if (!newSatuanId) {
      selectedSatuan.value = null;
    }
    if (errors.satuan_id && !errors.satuan_id.includes("UoM detail")) {
      errors.satuan_id = "";
    }
    validateConversionUomConflict();
  },
);


const fetchRackOptionsForItemDetail = async (gudangId: string, itemId?: string) => {
  if (!gudangId || !itemId) return [];

  const cacheKey = String(itemId);
  if (rackOptionsByItemId.value[cacheKey]) {
    return rackOptionsByItemId.value[cacheKey];
  }

  try {
    const params = new URLSearchParams({
      filter_column_m_gudang_id: gudangId,
      filter_column_m_items_id: itemId,
      join: "subhead,sub",
      no_pagination: "true",
    });
    const response = await fetch(
      `${API_BASE_URL}/dynamic/stock_gudang?${params.toString()}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );

    const result = await response.json();
    if (result.status !== "success" || !result.data) {
      rackOptionsByItemId.value[cacheKey] = [];
      return [];
    }

    const rows = Array.isArray(result.data)
      ? result.data
      : result.data
        ? [result.data]
        : [];
    const optionsMap = new Map<string, { id: string; label: string }>();

    rows.forEach((row: any) => {
      const stockGudangId = row?.id;
      const rakDetail = row?.m_rak_d || row?.rak_detail || null;
      const rakMaster = rakDetail?.m_rak || row?.m_rak || null;
      const rakKode = rakDetail?.kode || row?.kode_rak_d || "-";
      const rakNama = rakMaster?.nama_rak || row?.nama_rak_master || "-";

      if (!stockGudangId) return;
      if (!optionsMap.has(stockGudangId)) {
        optionsMap.set(stockGudangId, {
          id: stockGudangId,
          label: `${rakKode} (${rakNama})`,
        });
      }
    });

    const options = Array.from(optionsMap.values());
    rackOptionsByItemId.value[cacheKey] = options;
    return options;
  } catch (error) {
    console.error("Failed to fetch rack options for detail item:", error);
    rackOptionsByItemId.value[cacheKey] = [];
    return [];
  }
};

const getRackOptionsForItem = (itemId?: string) => {
  if (!itemId) return [];
  return rackOptionsByItemId.value[String(itemId)] || [];
};

const getDisplayRakDetail = (item: any) => {
  const rakKode = String(item?.rak_kode || "").trim();
  if (rakKode && rakKode !== "-") return rakKode;
  return getRakLabelById(item?.stock_gudang_id);
};

const removeDetailItem = (index: number) => {
  detailItems.value.splice(index, 1);
  const newDetailErrors: Record<number, any> = {};
  Object.keys(detailErrors.value).forEach((k) => {
    const i = Number(k);
    if (i < index) {
      newDetailErrors[i] = detailErrors.value[i];
    } else if (i > index) {
      newDetailErrors[i - 1] = detailErrors.value[i];
    }
  });
  detailErrors.value = newDetailErrors;
  validateConversionUomConflict();
  toast.info("Item detail dihapus");
};

const createCutDetailItem = () => ({
  panjang: "",
  qty_transform: 0,
  stock_gudang_id: "",
  item_id: "",
  is_acuan: false,
  batch: "",
  catatan: "",
  created_by: authStore.user?.id || "",
});

const addCutDetailItem = () => {
  detailItems.value.push(createCutDetailItem());
  if (errors.detailItems) {
    errors.detailItems = "";
  }
};

const handleJenisTransformSelect = (item: any) => {
  const previousCode = String(
    selectedJenisTransform.value?.code || selectedJenisTransform.value?.value1 || "",
  ).toUpperCase();
  const nextCode = String(item?.code || item?.value1 || "").toUpperCase();

  selectedJenisTransform.value = item || null;
  if (errors.jenis_transform) {
    errors.jenis_transform = "";
  }

  if (previousCode && previousCode !== nextCode) {
    clearTransformReferenceAndDetails();
    values.satuan_id = "";
    selectedSatuan.value = null;
  }
  validateConversionUomConflict();
};

const handleAddDetailItems = (items: any[]) => {
  const headerSatuanId = values.satuan_id;
  const headerSatuanName =
    selectedSatuan.value?.value1 || selectedSatuan.value?.code || "";

  const rejectedItems: { kode: string; uom: string }[] = [];
  let addedCount = 0;

  items.forEach((item) => {
    const detailItemId = item.item_id || item.m_items_id || item.id;
    if (detailItems.value.some((d: any) => d.item_id === detailItemId)) {
      return;
    }

    const detailUomId =
      item?.m_item?.uom_id ||
      item?.m_item?.mi_uom?.id ||
      item?.m_item?.uom?.id ||
      item?.uom_id ||
      "";
    const detailUomName =
      item?.m_item?.mi_uom?.value1 ||
      item?.m_item?.uom?.value1 ||
      item?.m_item?.m_general?.value1 ||
      item?.uom ||
      "-";

    // Pada jenis transform Conversion, satuan detail tidak boleh sama dengan satuan header
    if (isConversionTransform.value && (headerSatuanName || headerSatuanId)) {
      if (isSameUom(headerSatuanId, headerSatuanName, detailUomId, detailUomName)) {
        rejectedItems.push({
          kode: item?.m_item?.kode_item || item?.kode_item || "Item",
          uom: detailUomName,
        });
        return;
      }
    }

    detailItems.value.push({
      m_transform_d_id: item.id,
      item_id: detailItemId,
      qty_transform: 0,
      stock_gudang_id: "",
      batch: "",
      is_batch: Boolean(item?.m_item?.is_batch),
      is_acuan: toBool(item.is_acuan),
      catatan: "",
      created_by: authStore.user?.id || "",
      kode_item: item?.m_item?.kode_item || item?.kode_item || "-",
      nama_item: item?.m_item?.nama_item || item?.nama_item || "-",
      uom: detailUomName,
      uom_id: detailUomId,
    });
    addedCount++;

    if (values.warehouse) {
      fetchRackOptionsForItemDetail(values.warehouse, detailItemId);
    }
  });

  if (rejectedItems.length > 0) {
    const listNames = rejectedItems
      .map((r) => `${r.kode} (UoM: ${r.uom})`)
      .join(", ");
    toast.error("Validasi UoM Gagal", {
      description: `Pada jenis transform Conversion, satuan detail tidak boleh sama dengan satuan header (${headerSatuanName || "Header"}). Item ditolak: ${listNames}`,
      duration: 6000,
    });
  }

  if (addedCount > 0 && errors.detailItems) {
    errors.detailItems = "";
  }
  validateConversionUomConflict();
};

const clearTransformReferenceAndDetails = () => {
  values.m_transform_id = "";
  values.transform_no = "";
  values.item_id = "";
  values.stock_gudang_id = "";
  detailItems.value = [];
  detailErrors.value = {};
  rackOptions.value = [];
  rackOptionsByItemId.value = {};
  mainItemLabel.value = "-";
  selectedCutItemLength.value = 0;
};

const onReset = () => {
  Object.assign(values, {
    no_transform_item: "",
    m_unit_bisnis_id: "",
    tgl_transform: new Date().toISOString().split("T")[0],
    jenis_transform: "",
    warehouse: "",
    item_id: "",
    stock_gudang_id: "",
    qty: 1,
    satuan_id: "",
    pic_id: "",
    status: "DRAFT",
    catatan: "",
    created_by: authStore.user?.id || "",
  });

  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });

  detailItems.value = [];
  rackOptions.value = [];
  rackOptionsByItemId.value = {};
  mainItemLabel.value = "-";
  selectedCutItemLength.value = 0;
};

onBeforeMount(async () => {
  onReset();

  if (
    !isSuperAdmin.value &&
    !(isEditMode.value || isViewMode.value || isCopyMode.value)
  ) {
    try {
      const selectRespo = localStorage.getItem("SelectRespo");
      if (selectRespo) {
        const parsed = JSON.parse(selectRespo);
        if (parsed.companyId) {
          values.m_unit_bisnis_id = parsed.companyId;
        }
      }
    } catch {
      // ignore
    }
  }

  const sourceId = route.query.copy
    ? String(route.query.copy)
    : route.query.action === "copy" && route.query.source
      ? String(route.query.source)
      : menuId.value;

  if (!(isEditMode.value || isViewMode.value || isCopyMode.value)) {
    return;
  }

  loading.value = true;
  try {
    const res = await getTransformItemById(sourceId);
    if (res.status !== "success") throw new Error("Gagal memuat data");

    loadTransformItemLogs(sourceId);

    initialValues = res.data;
    auditMeta.value = {
      created_by: initialValues.created_by,
      createdAt: initialValues.createdAt,
      updated_by: initialValues.update_by || initialValues.updated_by,
      updatedAt: initialValues.updatedAt,
    };
    values.m_unit_bisnis_id = initialValues.m_unit_bisnis_id || "";
    if (isSuperAdmin.value && values.m_unit_bisnis_id) {
      fetchUnitBisnisCompanyName(values.m_unit_bisnis_id);
    }
    values.no_transform_item =
      initialValues.no_transform_item ||
      initialValues.no_t_transform_item ||
      "";
    values.transform_no = initialValues?.m_transform?.transform_no || "";
    values.m_transform_id = initialValues.m_transform_id || "";
    values.tgl_transform = initialValues.tgl_transform
      ? String(initialValues.tgl_transform).split(" ")[0]
      : values.tgl_transform;
    values.jenis_transform = initialValues.jenis_transform || "";
    selectedJenisTransform.value =
      initialValues.jenis_transform_rel ||
      initialValues.jenis_trans_item ||
      initialValues.m_jenis_transform ||
      null;
    values.warehouse =
      initialValues.warehouse || initialValues.m_gudang_id || "";
    values.item_id = initialValues.item_id || "";
    values.stock_gudang_id = initialValues.stock_gudang_id || "";
    values.batch = initialValues.batch || "";
    headerItemIsBatch.value = Boolean(
      initialValues.m_item?.is_batch || initialValues.item?.is_batch,
    );
    values.qty = Number(initialValues.qty || 0);
    values.satuan_id = initialValues.satuan_id || "";
    selectedSatuan.value =
      initialValues.satuan ||
      initialValues.m_general ||
      initialValues.general_satuan ||
      null;
    values.pic_id = initialValues.pic_id || initialValues.pic_opname_id || "";
    values.status = initialValues.status || "DRAFT";
    values.catatan = initialValues.catatan || "";

    mainItemLabel.value =
      initialValues.m_item?.nama_item ||
      initialValues.item?.nama_item ||
      initialValues.m_item?.kode_item ||
      initialValues.item?.kode_item ||
      "-";
    selectedCutItemLength.value = getItemLength(initialValues);

    const rawDetails =
      initialValues.t_transform_item_d ||
      initialValues.t_transform_item_ds ||
      [];
    const detailArray = Array.isArray(rawDetails)
      ? rawDetails
      : rawDetails
        ? [rawDetails]
        : [];
    detailItems.value = detailArray.map((d: any) => ({
      ...d,
      qty_transform: Number(d.qty_transform || 0),
      panjang: d.panjang || "",
      item_id: d.item_id || d.m_items_id || "",
      stock_gudang_id: d.stock_gudang_id || "",
      batch: d.batch || "",
      is_batch: Boolean(
        d.m_item?.is_batch ||
          d.item_transform?.is_batch ||
          d.item?.is_batch,
      ),
      is_acuan: toBool(d.is_acuan),
      kode_item:
        d.m_item?.kode_item ||
        d.item_transform?.kode_item ||
        d.item?.kode_item ||
        "-",
      nama_item:
        d.m_item?.nama_item ||
        d.item_transform?.nama_item ||
        d.item?.nama_item ||
        "-",
      uom:
        d.m_item?.mi_uom?.value1 ||
        d.m_item?.uom?.value1 ||
        d.m_item?.m_general?.value1 ||
        d.item_transform?.mi_uom?.value1 ||
        d.item_transform?.uom?.value1 ||
        d.item_transform?.m_general?.value1 ||
        "-",
      rak_kode:
        d.rak?.kode ||
        d.m_rak_d?.kode ||
        d.rak_detail?.kode ||
        d.m_rak?.kode_rak ||
        "",
    }));

    if (values.warehouse && values.item_id) {
      await fetchRackOptionsByGudang(values.warehouse, values.item_id);
    }
    if (values.warehouse) {
      const uniqueItemIds = Array.from(
        new Set(detailItems.value.map((item: any) => item.item_id).filter(Boolean)),
      );
      await Promise.all(
        uniqueItemIds.map((id: string) =>
          fetchRackOptionsForItemDetail(values.warehouse, id),
        ),
      );
    }

    if (isCopyMode.value) {
      values.no_transform_item = "";
      values.status = "DRAFT";

      detailItems.value = detailItems.value.map((item: any) => {
        const { id, t_transform_item_id, createdAt, updatedAt, ...rest } = item;
        return {
          ...rest,
          created_by: authStore.user?.id || "",
        };
      });

      toast.success("Data berhasil disalin", {
        description: "Silakan edit dan simpan sebagai Transform Item baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Transform Item", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () => router.push("/inventory/transaksi/t_transform_item"),
      },
    });
    setTimeout(() => router.push("/inventory/transaksi/t_transform_item"), 1500);
  } finally {
    loading.value = false;
  }
});

const errors = reactive({
  m_unit_bisnis_id: "",
  tgl_transform: "",
  m_transform_id: "",
  jenis_transform: "",
  warehouse: "",
  item_id: "",
  stock_gudang_id: "",
  qty: "",
  satuan_id: "",
  pic_id: "",
  detailItems: "",
});

const detailErrors = ref<
  Record<
    number,
    {
      panjang?: string;
      qty_transform?: string;
      uom?: string;
      stock_gudang_id?: string;
    }
  >
>({});


// ============================================================================
// APPROVAL FUNCTIONS
// ============================================================================

const validateApprovalData = () => {
  const approvalList = authStore.getApprovalList();

  if (!approvalList || approvalList.length === 0) {
    return {
      valid: false,
      error: "Data approval tidak ditemukan di sistem",
      detail:
        "Silakan logout dan login kembali untuk memuat ulang data approval Anda.",
    };
  }

  const currentApproval = approvalList.find(
    (approval: any) =>
      approval.path === "/inventory/transaksi/t_transform_item" &&
      approval.tipe_approve?.toUpperCase() === "MENGAJUKAN",
  );

  if (!currentApproval) {
    return {
      valid: false,
      error: "Hak akses approval tidak ditemukan",
      detail:
        "Anda tidak memiliki hak untuk mengajukan approval pada halaman Transform Item. Tipe approval yang dibutuhkan: MENGAJUKAN",
    };
  }

  const missingFields = [];
  if (currentApproval.level === null || currentApproval.level === undefined)
    missingFields.push("level");
  if (!currentApproval.sender_id) missingFields.push("sender_id");

  if (missingFields.length > 0) {
    return {
      valid: false,
      error: "Data approval tidak lengkap",
      detail: `Field yang kosong: ${missingFields.join(", ")}. Silakan hubungi administrator.`,
    };
  }

  return { valid: true };
};

const autoSendApproval = async (
  transformItemId: string,
  noTransform: string,
  message?: string,
) => {
  try {
    const approvalList = authStore.getApprovalList();

    if (!approvalList || approvalList.length === 0) {
      throw new Error("Data approval tidak ditemukan. Silakan login ulang.");
    }

    const currentApproval = approvalList.find(
      (approval: any) =>
        approval.path === "/inventory/transaksi/t_transform_item" &&
        approval.tipe_approve?.toUpperCase() === "MENGAJUKAN",
    );

    if (!currentApproval) {
      throw new Error(
        "Anda tidak memiliki hak untuk mengajukan approval pada halaman ini. Tipe approval yang dibutuhkan: MENGAJUKAN",
      );
    }

    if (
      currentApproval.level === null ||
      currentApproval.level === undefined ||
      !currentApproval.sender_id
    ) {
      throw new Error(
        "Data approval tidak lengkap. Silakan hubungi administrator.",
      );
    }

    const payload = {
      approval_level: currentApproval.level,
      sender_id: currentApproval.sender_id,
      t_transform_item_id: transformItemId,
      approval_message: message?.trim() || null,
    };

    const response = await fetch(
      `${API_BASE_URL}/dynamic/t_transform_item_notifikasi`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify(payload),
      },
    );

    const result = await response.json();

    if (result.status === "success") {
      toast.success("Approval berhasil dikirim", {
        description: `Transform Item "${noTransform}" telah dikirim untuk approval`,
      });
    } else {
      throw new Error(
        result.message || "Terjadi kesalahan saat mengirim approval",
      );
    }
  } catch (error) {
    console.error("❌ Auto send approval error:", error);
    throw error;
  }
};

const onSave = async () => {
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });
  detailErrors.value = {};

  let invalid = false;

  if (!values.m_unit_bisnis_id) {
    errors.m_unit_bisnis_id = "Unit Bisnis wajib diisi";
    invalid = true;
  }
  if (!values.tgl_transform) {
    errors.tgl_transform = "Tanggal transform wajib diisi";
    invalid = true;
  }
  if (!values.jenis_transform) {
    errors.jenis_transform = "Jenis transform wajib diisi";
    invalid = true;
  }
  if (!values.warehouse) {
    errors.warehouse = "Warehouse wajib diisi";
    invalid = true;
  }

  if (!isRemoveTransform.value && !isCutTransform.value) {
    if (!values.m_transform_id) {
      errors.m_transform_id = "Pilih item wajib dipilih";
      invalid = true;
    }
  } else if (isCutTransform.value) {
    if (!values.item_id) {
      errors.item_id = "Item potong wajib dipilih";
      invalid = true;
    }
    if (!values.stock_gudang_id) {
      errors.stock_gudang_id = "Rak detail header wajib dipilih untuk CUT";
      invalid = true;
    }
  }

  if (!values.qty || values.qty <= 0) {
    errors.qty = "Qty wajib lebih dari 0";
    invalid = true;
  }

  if (isConversionTransform.value && !values.satuan_id) {
    errors.satuan_id = "Satuan wajib diisi untuk jenis transform Conversion";
    invalid = true;
  }

  if (!values.pic_id) {
    errors.pic_id = "PIC wajib diisi";
    invalid = true;
  }

  if (!isRemoveTransform.value) {
    if (detailItems.value.length === 0) {
      errors.detailItems = isCutTransform.value
        ? "Minimal harus ada 1 baris detail CUT"
        : "Minimal harus ada 1 item detail yang ditambahkan";
      invalid = true;
    } else {
      for (let i = 0; i < detailItems.value.length; i++) {
        const item = detailItems.value[i];
        if (!detailErrors.value[i]) {
          detailErrors.value[i] = {};
        }

        if (isCutTransform.value) {
          if (!String(item.panjang || "").trim()) {
            detailErrors.value[i].panjang = "Panjang wajib diisi";
            invalid = true;
          } else if (toNumber(item.panjang) <= 0) {
            detailErrors.value[i].panjang = "Panjang harus > 0";
            invalid = true;
          }
        }

        if (!item.qty_transform || Number(item.qty_transform) <= 0) {
          detailErrors.value[i].qty_transform = "Qty wajib > 0";
          invalid = true;
        }

        if (isConversionTransform.value) {
          const headerSatuanId = values.satuan_id;
          const headerSatuanName =
            selectedSatuan.value?.value1 || selectedSatuan.value?.code || "";
          if (isSameUom(headerSatuanId, headerSatuanName, item.uom_id, item.uom)) {
            detailErrors.value[i].uom = `UoM (${item.uom}) tidak boleh sama dengan satuan header (${headerSatuanName})`;
            invalid = true;
          }
        }
      }
    }
  }

  if (isConversionTransform.value && !validateConversionUomConflict()) {
    invalid = true;
  }

  if (isCutTransform.value && cutUsedLength.value > cutTotalLength.value) {
    toast.error("Validasi gagal", {
      description: `Total panjang detail CUT tidak boleh melebihi ukuran header (${formatNumber(cutTotalLength.value)})`,
    });
    return;
  }

  if (
    isCutTransform.value &&
    cutTotalLength.value > 0 &&
    cutUsedLength.value < cutMinimumUsedLength.value
  ) {
    toast.error("Validasi gagal", {
      description: `Total panjang detail CUT minimal ${formatNumber(cutMinimumUsedLength.value)} (ukuran header - 2%)`,
    });
    return;
  }

  if (invalid) {
    toast.error("Validasi gagal", {
      description: "Mohon periksa dan lengkapi field/detail yang bermasalah",
    });
    return;
  }

  if (isSuperAdmin.value) {
    isSuperAdminDialogOpen.value = true;
    return;
  }

  await proceedWithSave();
};

const proceedWithSave = async () => {
  // If editing REVISI status → validate approval data then show revisi dialog
  if (isEditMode.value && isRevisiStatus.value) {
    const approvalValidation = validateApprovalData();
    if (!approvalValidation.valid) {
      toast.error(approvalValidation.error || "Validasi approval gagal", {
        description: approvalValidation.detail,
        duration: 6000,
      });
      return;
    }
    isRevisiDialogOpen.value = true;
    return;
  }

  loading.value = true;

  try {
    const payload: any = {
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      tgl_transform: values.tgl_transform || null,
      m_transform_id:
        isRemoveTransform.value || isCutTransform.value
          ? null
          : values.m_transform_id || null,
      jenis_transform: values.jenis_transform || null,
      warehouse: values.warehouse || null,
      item_id: values.item_id || null,
      stock_gudang_id: values.stock_gudang_id || null,
      batch: values.batch || null,
      qty: Number(values.qty) || 0,
      satuan_id: values.satuan_id || null,
      pic_id: values.pic_id || null,
      is_pemotongan: isCutTransform.value,
      status: isSuperAdmin.value ? "APPROVED" : values.status || "DRAFT",
      catatan: values.catatan || null,
      no_transform_item: values.no_transform_item || null,
      t_transform_item_ds: (isRemoveTransform.value ? [] : detailItems.value).map((item: any) => ({
        ...(item.id && { id: item.id }),
        qty_transform: Number(item.qty_transform) || 0,
        panjang: isCutTransform.value ? String(item.panjang || "").trim() : null,
        m_transform_d_id: item.m_transform_d_id || null,
        t_transform_item_id:
          item.t_transform_item_id || (isEditMode.value ? menuId.value : null),
        item_id: isCutTransform.value ? null : item.item_id || null,
        stock_gudang_id:
          isCutTransform.value ? null : item.stock_gudang_id || null,
        batch: item.batch?.trim() || null,
        catatan: item.catatan || null,
        ...(isEditMode.value
          ? { updated_by: authStore.user?.id || "" }
          : { created_by: authStore.user?.id || "" }),
      })),
    };

    let savedId: string | undefined;

    if (isEditMode.value) {
      payload.updated_by = authStore.user?.id || "";
      await updateTransformItem(menuId.value, payload);
      savedId = menuId.value;
      toast.success("Transform Item berhasil diperbarui");
    } else {
      payload.created_by = authStore.user?.id || "";
      const res = await createTransformItem(payload);
      savedId = (res as any)?.data?.id;
      toast.success("Transform Item berhasil dibuat");
    }

    if (isSuperAdmin.value && savedId) {
      try {
        const allApprovals = authStore
          .getApprovalList()
          .filter((a: any) => a.path === "/inventory/transaksi/t_transform_item");
        const maxLevel =
          allApprovals.length > 0
            ? Math.max(...allApprovals.map((a: any) => a.level ?? 0))
            : 1;
        await approveTransformItem(
          savedId,
          null,
          maxLevel,
          "Auto approved by Super Admin",
        );
      } catch (approvalErr) {
        console.warn("Failed to call approve endpoint:", approvalErr);
      }
    }

    router.replace("/inventory/transaksi/t_transform_item?reload=" + Date.now());
  } catch (error) {
    toast.error(
      isEditMode.value
        ? "Gagal memperbarui Transform Item"
        : "Gagal membuat Transform Item",
      {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      },
    );
  } finally {
    loading.value = false;
  }
};

const confirmSuperAdminSave = async () => {
  isSuperAdminDialogOpen.value = false;
  await proceedWithSave();
};

const cancelSuperAdminSave = () => {
  isSuperAdminDialogOpen.value = false;
};

// ============================================================================
// REVISI DIALOG HANDLERS
// ============================================================================

const cancelRevisiSave = () => {
  isRevisiDialogOpen.value = false;
  approvalMessage.value = "";
  approvalMessageError.value = "";
};

const confirmRevisiSave = async () => {
  approvalMessageError.value = "";
  if (!approvalMessage.value?.trim()) {
    approvalMessageError.value = "Pesan Approval wajib diisi";
    return;
  }

  isRevisiDialogOpen.value = false;
  loading.value = true;

  try {
    const payload: any = {
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      tgl_transform: values.tgl_transform || null,
      jenis_transform: values.jenis_transform || null,
      warehouse: values.warehouse || null,
      item_id: values.item_id || null,
      stock_gudang_id: values.stock_gudang_id || null,
      batch: values.batch || null,
      qty: Number(values.qty) || 0,
      satuan_id: values.satuan_id || null,
      pic_id: values.pic_id || null,
      is_pemotongan: isCutTransform.value,
      status: "IN APPROVAL",
      catatan: values.catatan || null,
      no_transform_item: values.no_transform_item || null,
      updated_by: authStore.user?.id || "",
      t_transform_item_ds: (isRemoveTransform.value ? [] : detailItems.value).map((item: any) => ({
        ...(item.id && { id: item.id }),
        qty_transform: Number(item.qty_transform) || 0,
        panjang: isCutTransform.value ? String(item.panjang || "").trim() : null,
        t_transform_item_id: item.t_transform_item_id || menuId.value,
        item_id: isCutTransform.value ? null : item.item_id || null,
        stock_gudang_id:
          isCutTransform.value ? null : item.stock_gudang_id || null,
        batch: item.batch?.trim() || null,
        catatan: item.catatan || null,
        updated_by: authStore.user?.id || "",
      })),
    };

    await updateTransformItem(menuId.value, payload);

    await autoSendApproval(
      menuId.value,
      values.no_transform_item || "",
      approvalMessage.value,
    );

    toast.success("Transform Item berhasil diperbarui", {
      description: `Transform Item "${values.no_transform_item}" telah dikirim untuk approval`,
    });

    approvalMessage.value = "";
    router.replace("/inventory/transaksi/t_transform_item?reload=" + Date.now());
  } catch (error) {
    toast.error("Gagal memperbarui Transform Item", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  router.push("/inventory/transaksi/t_transform_item");
};

watch(isRemoveTransform, (next) => {
  if (!next) return;
  clearTransformReferenceAndDetails();
});
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="icon" @click="handleCancel">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div>
        <h1 class="text-2xl font-bold text-foreground">{{ pageTitle }}</h1>
        <p class="text-sm text-muted-foreground">{{ pageDescription }}</p>
      </div>
    </div>

    <form class="space-y-6" @submit.prevent>
      <Card>
        <CardHeader>
          <CardTitle>Informasi Transform Item</CardTitle>
          <CardDescription>
            Isi data Transform Item dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <template v-if="isSuperAdmin">
              <FieldSelect
                id="m_unit_bisnis_id"
                label="Unit Bisnis"
                v-model="values.m_unit_bisnis_id"
                :errorname="errors.m_unit_bisnis_id ? 'failed' : ''"
                :hints="errors.m_unit_bisnis_id || 'Pilih unit bisnis'"
                :required="!isReadOnly"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    no_pagination: 'true',
                    searchfield: 'nama_comp',
                    filter_column_is_active: true,
                    join: 'true',
                  },
                }"
                valueField="id"
                displayField="nama_comp"
                placeholder="Pilih unit bisnis"
                :clearable="true"
                @update:value-full="
                  (item) => {
                    handleUnitBisnisSelected(item);
                    errors.m_unit_bisnis_id = '';
                    values.warehouse = '';
                    clearTransformReferenceAndDetails();
                    fetchRackOptionsByGudang('', '');
                  }
                "
              />

              <!-- Asal Company dari Unit Bisnis yang dipilih (selalu tampil, readonly) -->
              <FieldX
                id="m_unit_bisnis_company_display"
                label="Company"
                :value="selectedUnitBisnisCompanyName || '-'"
                :disabled="true"
                :readonly="true"
                placeholder="-"
                hints="Company dari Unit Bisnis yang dipilih"
              />
            </template>

            <FieldX
              v-else
              id="m_unit_bisnis_id_display"
              label="Unit Bisnis"
              :value="companyNameDisplay"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              hints="Unit Bisnis dari akun Anda"
            />

            <FieldX
              id="no_transform_item"
              label="No. Transform Item"
              :value="values.no_transform_item || 'Auto generate'"
              :disabled="true"
              :readonly="true"
              placeholder="Auto generate"
            />

            <FieldDate
              id="tgl_transform"
              label="Tanggal Transform"
              v-model="values.tgl_transform"
              :errorname="errors.tgl_transform ? 'failed' : ''"
              :hints="errors.tgl_transform || 'Pilih tanggal transform'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih tanggal transform"
              @update:modelValue="() => (errors.tgl_transform = '')"
            />

            <FieldSelect
              id="jenis_transform"
              label="Jenis Transform"
              v-model="values.jenis_transform"
              :errorname="errors.jenis_transform ? 'failed' : ''"
              :hints="errors.jenis_transform || 'Pilih jenis transform'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'value1,code,group',
                  filter_column_is_active: true,
                  no_pagination: 'true',
                  filter_column_group: 'TIPE TRANSFORM',
                  filter_operator_group: '=',
                },
              }"
              valueField="id"
              displayField="value1"
              placeholder="Pilih jenis transform"
              :clearable="true"
              @update:valueFull="handleJenisTransformSelect"
            />

             <FieldSelect
              id="warehouse"
              label="Warehouse"
              v-model="values.warehouse"
              :errorname="errors.warehouse ? 'failed' : ''"
              :hints="
                errors.warehouse ||
                (!values.m_unit_bisnis_id
                  ? 'Pilih Unit Bisnis terlebih dahulu'
                  : 'Pilih warehouse')
              "
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || !values.m_unit_bisnis_id"
              :readonly="isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_gudang`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  selectfield: 'id,nama_gudang,kode_gudang',
                  filter_column_is_active: 'true',
                  filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
                },
              }"
              valueField="id"
              displayField="nama_gudang"
              placeholder="Pilih warehouse"
              :clearable="true"
              @update:modelValue="
                (newGudangId: string) => {
                  errors.warehouse = '';
                  clearTransformReferenceAndDetails();
                  fetchRackOptionsByGudang(newGudangId ?? '', '');
                }
              "
            />

            <FieldPopup
              v-if="!isRemoveTransform && !isCutTransform"
              id="m_transform_id"
              label="Pilih Item"
              :value="values.m_transform_id"
              @input="
                (v: string) => {
                  values.m_transform_id = v;
                  errors.m_transform_id = '';
                  if (!v) {
                    clearTransformReferenceAndDetails();
                    fetchRackOptionsByGudang(values.warehouse, '');
                  }
                }
              "
              @update:valueFull="
                (item: any) => {
                  if (item) {
                    values.m_transform_id = item.id;
                    values.item_id = item.item_id || item.m_items_id || '';
                    values.transform_no = item.transform_no;
                    values.stock_gudang_id = '';
                    detailItems = [];
                    rackOptionsByItemId = {};
                    mainItemLabel = `${item?.m_item?.nama_item || '-'}`;
                    fetchRackOptionsByGudang(values.warehouse, values.item_id);
                  }
                }
              "
              :errorText="errors.m_transform_id ? 'failed' : ''"
              :hints="
                errors.m_transform_id ||
                (!values.jenis_transform
                  ? 'Pilih Jenis Transform terlebih dahulu'
                  : !values.warehouse
                    ? 'Pilih warehouse terlebih dahulu'
                    : 'Pilih item')
              "
              :required="!isReadOnly"
              :disabled="
                loading || isReadOnly || !values.jenis_transform || !values.warehouse
              "
              :clearable="true"
              displayField="item_label"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_transform`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  gudang_id: values.warehouse,
                  searchfield: 'm_item.kode_item,m_item.nama_item',
                  filter_column_tipe_id: values.jenis_transform,
                  include: 'm_items',
                  no_pagination: 'true',
                },
                onsuccess: (response: any) => {
                  const rows = Array.isArray(response.data) ? response.data : [];
                  response.data = rows.map((row: any) => ({
                    ...row,
                    item_label: `${row?.m_item?.kode_item || '-'} - ${row?.m_item?.nama_item || '-'}`,
                  }));
                  response.hasNext = response.pagination?.next_page
                    ? true
                    : false;
                  return response;
                },
              }"
              :columns="[
                {
                  field: 'item_label',
                  headerName: 'Item',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                  render: (row: any) => `${row?.m_item?.kode_item || '-'} - ${row?.m_item?.nama_item || '-'}`,
                },
                {
                  field: 'transform_no',
                  headerName: 'No. Transform',
                  width: '120px',
                  sortable: true,
                  filterable: true,
                },
              ]"
            />

            <FieldPopup
              v-else-if="!isRemoveTransform && isCutTransform"
              id="cut_item_id"
              label="Pilih Item"
              :value="values.item_id"
              @input="
                (v: string) => {
                  values.item_id = v;
                  errors.item_id = '';
                  if (!v) {
                    clearTransformReferenceAndDetails();
                    fetchRackOptionsByGudang(values.warehouse, '');
                  }
                }
              "
              @update:valueFull="
                (item: any) => {
                  if (item) {
                    values.item_id = item.id;
                    values.m_transform_id = '';
                    values.transform_no = '';
                    values.stock_gudang_id = '';
                    detailItems = [];
                    rackOptionsByItemId = {};
                    mainItemLabel = `${item?.nama_item || '-'}`;
                    selectedCutItemLength = getItemLength(item);
                    headerItemIsBatch.value = Boolean(item?.is_batch);
                    values.satuan_id = item?.uom_id || values.satuan_id;
                    fetchRackOptionsByGudang(values.warehouse, values.item_id);
                  }
                }
              "
              :errorText="errors.item_id ? 'failed' : ''"
              :hints="
                errors.item_id ||
                (!values.jenis_transform
                  ? 'Pilih Jenis Transform terlebih dahulu'
                  : !values.warehouse
                    ? 'Pilih warehouse terlebih dahulu'
                    : 'Pilih item potong')
              "
              :required="!isReadOnly"
              :disabled="
                loading || isReadOnly || !values.jenis_transform || !values.warehouse
              "
              :clearable="true"
              displayField="item_label"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_items`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'kode_item,nama_item,ukuran',
                  filter_column_is_active: true,
                  filter_column_is_potong: true,
                  no_pagination: 'true',
                },
                onsuccess: (response: any) => {
                  const rows = Array.isArray(response.data) ? response.data : [];
                  response.data = rows.map((row: any) => ({
                    ...row,
                    item_label: `${row?.kode_item || '-'} - ${row?.nama_item || '-'}${row?.ukuran ? ` (${row.ukuran})` : ''}`,
                  }));
                  response.hasNext = response.pagination?.next_page
                    ? true
                    : false;
                  return response;
                },
              }"
              :columns="[
                {
                  field: 'kode_item',
                  headerName: 'Kode',
                  width: '140px',
                  sortable: true,
                  filterable: true,
                },
                {
                  field: 'nama_item',
                  headerName: 'Nama Item',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                },
                {
                  field: 'ukuran',
                  headerName: 'Panjang',
                  width: '120px',
                  sortable: true,
                  filterable: true,
                  render: (row: any) => row?.ukuran || '-',
                },
              ]"
            />

            <!-- <FieldX
              id="item_label"
              label="Item Terpilih"
              :value="mainItemLabel"
              :disabled="true"
              :readonly="true"
              placeholder="-"
            /> -->

            <FieldSelect
              id="stock_gudang_id"
              label="Rak Detail Header"
              v-model="values.stock_gudang_id"
              :disabled="loading || isReadOnly || rackOptions.length === 0"
              :readonly="isReadOnly"
              :options="rackOptions"
              :errorname="errors.stock_gudang_id ? 'failed' : ''"
              :hints="errors.stock_gudang_id || 'Pilih rak detail'"
              :required="isCutTransform"
              valueField="id"
              displayField="label"
              placeholder="Pilih rak detail"
              :clearable="true"
              @update:modelValue="() => (errors.stock_gudang_id = '')"
            />

            <FieldX
              id="batch_bahan"
              label="Batch Bahan"
              :value="values.batch || '-'"
              :disabled="true"
              :readonly="true"
              placeholder="-"
            />

            <FieldNumber
              id="qty"
              label="Qty"
              v-model="values.qty"
              :min="1"
              :errorname="errors.qty ? 'failed' : ''"
              :hints="errors.qty || 'Masukkan qty transform'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="0"
              @update:modelValue="() => (errors.qty = '')"
            />

            <FieldX
              v-if="isCutTransform && values.item_id"
              id="cut_sisa"
              label="Sisa"
              :value="formatNumber(cutRemainingLength)"
              :disabled="true"
              :readonly="true"
              :hints="`Header ${formatNumber(cutTotalLength)}. Detail min ${formatNumber(cutMinimumUsedLength)}, max ${formatNumber(cutTotalLength)}`"
              :errorname="cutUsedLength > cutTotalLength || (cutTotalLength > 0 && cutUsedLength < cutMinimumUsedLength) ? 'failed' : ''"
              placeholder="0"
            />

            <FieldSelect
              id="satuan_id"
              label="Satuan"
              v-model="values.satuan_id"
              :errorname="errors.satuan_id ? 'failed' : ''"
              :hints="
                errors.satuan_id ||
                (isConversionTransform
                  ? 'Pilih satuan konversi (wajib)'
                  : 'Pilih satuan')
              "
              :required="!isReadOnly && isConversionTransform"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'value1,code',
                  filter_column_group: 'UOM',
                  filter_column_is_active: 'true',
                },
              }"
              valueField="id"
              displayField="value1"
              placeholder="Pilih satuan"
              :clearable="true"
              @update:valueFull="handleSatuanSelect"
            />

            <FieldSelect
              id="pic_id"
              label="PIC"
              v-model="values.pic_id"
              :errorname="errors.pic_id ? 'failed' : ''"
              :hints="errors.pic_id || 'Pilih PIC'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_kary`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'nama_kary,kode_kary',
                  filter_column_is_active: true,
                },
              }"
              valueField="id"
              displayField="nama_kary"
              placeholder="Pilih PIC"
              :clearable="true"
              @update:modelValue="() => (errors.pic_id = '')"
            />

            <FieldX
              id="status"
              label="Status"
              :value="values.status"
              :disabled="true"
              :readonly="true"
              placeholder="DRAFT"
              hints="Status akan berubah sesuai proses approval"
            />

            <div class="md:col-span-2">
              <FieldTextarea
                id="catatan"
                label="Catatan (Opsional)"
                v-model="values.catatan"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="Catatan tambahan"
                :rows="3"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs default-value="items" class="w-full">
        <TabsList
          class="w-full overflow-x-auto flex justify-start scrollbar-hide"
        >
          <TabsTrigger value="items">Transform Item Detail</TabsTrigger>
          <TabsTrigger value="detailLog" @click="loadTransformItemLogs()">Log</TabsTrigger>
        </TabsList>

        <TabsContent
          v-if="!isRemoveTransform && !isCutTransform"
          value="items"
          class="space-y-4 mt-4"
        >
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Transform Item Detail</CardTitle>
                  <CardDescription>
                    {{
                      values.m_transform_id
                        ? "Kelola item detail transform"
                        : "Pilih item terlebih dahulu untuk memilih item detail"
                    }}
                  </CardDescription>
                </div>
                <div class="flex gap-2" v-if="!isReadOnly">
                  <ButtonMultiSelect
                    title="Add to List"
                    @add="handleAddDetailItems"
                    :api="{
                      url: `${API_BASE_URL}/dynamic/m_transform_d`,
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${authStore.token}`,
                      },
                      params: {
                        searchfield: 'm_item.kode_item,m_item.nama_item',
                        filter_column_m_transform_id: values.m_transform_id,
                        include: 'm_items>m_general',
                        no_pagination: 'true',
                      },
                      onsuccess: (response: any) => {
                        const rows = Array.isArray(response.data) ? response.data : [];
                        response.data = rows.map((row: any) => {
                          const itm = row.m_item || row.m_items || row.item || {};
                          const uomName =
                            itm?.mi_uom?.value1 ||
                            itm?.uom?.value1 ||
                            itm?.m_general?.value1 ||
                            row?.uom ||
                            '-';
                          return {
                            ...row,
                            item_id: row.item_id || row.m_items_id || row.id,
                            uom: uomName,
                          };
                        });
                        response.hasNext = response.pagination?.next_page
                          ? true
                          : false;
                        return response;
                      },
                    }"
                    :columns="[
                      {
                        field: 'm_item.kode_item',
                        headerName: 'Kode',
                        width: '150px',
                        sortable: true,
                        filterable: true,
                        render: (row: any) => row?.m_item?.kode_item || row?.kode_item || '-',
                      },
                      {
                        field: 'm_item.nama_item',
                        headerName: 'Nama Item',
                        width: '250px',
                        sortable: true,
                        filterable: true,
                        render: (row: any) => row?.m_item?.nama_item || row?.nama_item || '-',
                      },
                      {
                        field: 'uom',
                        headerName: 'UoM',
                        width: '100px',
                        sortable: false,
                        filterable: false,
                        render: (row: any) => row?.uom || '-',
                      },
                      {
                        field: 'is_acuan',
                        headerName: 'Acuan',
                        width: '90px',
                        sortable: false,
                        filterable: false,
                        render: (row: any) => (row?.is_acuan ? 'Ya' : 'Tidak'),
                      },
                    ]"
                    :excludeIds="selectedItemIds"
                    uniqueKey="item_id"
                    :disabled="loading || !values.m_transform_id"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div
                v-if="errors.detailItems"
                class="p-3 mb-4 rounded border border-destructive/50 bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2"
              >
                <AlertCircle class="h-4 w-4 shrink-0" />
                <span>{{ errors.detailItems }}</span>
              </div>

              <div class="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead class="w-12">No</TableHead>
                      <TableHead>Kode</TableHead>
                      <TableHead>Nama Item</TableHead>
                      <TableHead class="w-24">Acuan</TableHead>
                      <TableHead class="w-32">Qty TI</TableHead>
                      <TableHead class="w-36">UoM</TableHead>
                      <TableHead class="w-44">Rak Detail</TableHead>
                      <TableHead class="w-40">Batch</TableHead>
                      <TableHead>Catatan</TableHead>
                      <TableHead v-if="!isReadOnly" class="w-20 text-center"
                        >Aksi</TableHead
                      >
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    <TableRow v-if="detailItems.length === 0">
                      <TableCell
                        :colspan="isReadOnly ? 8 : 9"
                        class="text-center py-8 text-muted-foreground"
                      >
                        Belum ada item dipilih. Klik "Add to List" untuk
                        menambahkan.
                      </TableCell>
                    </TableRow>

                    <TableRow
                      v-for="(item, idx) in detailItems"
                      :key="item.item_id || idx"
                    >
                      <TableCell class="font-medium">{{ idx + 1 }}</TableCell>
                      <TableCell>{{ item.kode_item }}</TableCell>
                      <TableCell>{{ item.nama_item }}</TableCell>
                      <TableCell>{{ item.is_acuan ? "Ya" : "Tidak" }}</TableCell>
                      <TableCell>
                        <FieldNumber
                          v-model="item.qty_transform"
                          :min="1"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          :errorname="detailErrors[idx]?.qty_transform ? 'failed' : ''"
                          :hints="detailErrors[idx]?.qty_transform || ''"
                          placeholder="0"
                          @update:modelValue="
                            () => {
                              if (detailErrors[idx]?.qty_transform) {
                                delete detailErrors[idx].qty_transform;
                              }
                            }
                          "
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <span :class="detailErrors[idx]?.uom ? 'font-bold text-destructive' : ''">
                            {{ item.uom || "-" }}
                          </span>
                          <p
                            v-if="detailErrors[idx]?.uom"
                            class="text-xs text-destructive mt-1 font-medium leading-tight"
                          >
                            {{ detailErrors[idx]?.uom }}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <FieldX
                          v-if="isReadOnly"
                          :value="getDisplayRakDetail(item)"
                          :readonly="true"
                          :disabled="true"
                        />
                        <FieldSelect
                          v-else
                          :value="item.stock_gudang_id"
                          @update:modelValue="
                            (v: string) => {
                              item.stock_gudang_id = v;
                              if (detailErrors[idx]?.stock_gudang_id) {
                                delete detailErrors[idx].stock_gudang_id;
                              }
                            }
                          "
                          :options="getRackOptionsForItem(item.item_id)"
                          displayField="label"
                          valueField="id"
                          placeholder="Pilih rak detail"
                          :clearable="true"
                          :disabled="
                            loading || getRackOptionsForItem(item.item_id).length === 0
                          "
                        />
                      </TableCell>
                      <TableCell class="min-w-[150px]">
                        <template v-if="item.is_batch">
                          <FieldX
                            v-if="!isReadOnly"
                            :id="`batch-${idx}`"
                            :value="item.batch || ''"
                            @input="(v: any) => (item.batch = v)"
                            :disabled="loading"
                            :placeholder="defaultBatchPreview || 'No Transform + Tgl'"
                            class="w-full text-xs sm:text-sm"
                          />
                          <span v-else class="text-xs sm:text-sm font-mono">{{ item.batch || '-' }}</span>
                        </template>
                        <span v-else class="text-xs text-muted-foreground italic">-</span>
                      </TableCell>
                      <TableCell>
                        <FieldX
                          v-model="item.catatan"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          placeholder="Catatan"
                        />
                      </TableCell>
                      <TableCell v-if="!isReadOnly" class="text-center">
                        <DeleteButton
                          variant="ghost"
                          size="sm"
                          @click="removeDetailItem(idx)"
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          v-else-if="!isRemoveTransform && isCutTransform"
          value="items"
          class="space-y-4 mt-4"
        >
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Transform Item Detail</CardTitle>
                  <CardDescription>
                    Input panjang dan qty hasil CUT
                  </CardDescription>
                </div>
                <div class="flex gap-2" v-if="!isReadOnly">
                  <Button
                    type="button"
                    variant="outline"
                    class="gap-2"
                    :disabled="loading || !values.item_id"
                    @click="addCutDetailItem"
                  >
                    <Plus class="h-4 w-4" />
                    Tambah Baris
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div
                v-if="errors.detailItems"
                class="p-3 mb-4 rounded border border-destructive/50 bg-destructive/10 text-destructive text-sm font-medium flex items-center gap-2"
              >
                <AlertCircle class="h-4 w-4 shrink-0" />
                <span>{{ errors.detailItems }}</span>
              </div>

              <div class="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead class="w-12">No</TableHead>
                      <TableHead class="w-40">Panjang</TableHead>
                      <TableHead class="w-32">Qty</TableHead>
                      <TableHead class="w-40">Batch</TableHead>
                      <TableHead>Catatan</TableHead>
                      <TableHead v-if="!isReadOnly" class="w-20 text-center"
                        >Aksi</TableHead
                      >
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    <TableRow v-if="detailItems.length === 0">
                      <TableCell
                        :colspan="isReadOnly ? 5 : 6"
                        class="text-center py-8 text-muted-foreground"
                      >
                        Belum ada detail CUT. Klik "Tambah Baris" untuk
                        menambahkan.
                      </TableCell>
                    </TableRow>

                    <TableRow
                      v-for="(item, idx) in detailItems"
                      :key="item.id || idx"
                    >
                      <TableCell class="font-medium">{{ idx + 1 }}</TableCell>
                      <TableCell>
                        <FieldNumber
                          v-model="item.panjang"
                          type="decimal"
                          :min="0"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          :errorname="detailErrors[idx]?.panjang ? 'failed' : ''"
                          :hints="detailErrors[idx]?.panjang || ''"
                          placeholder="Masukkan panjang"
                          @update:modelValue="
                            () => {
                              if (detailErrors[idx]?.panjang) {
                                delete detailErrors[idx].panjang;
                              }
                            }
                          "
                        />
                      </TableCell>
                      <TableCell>
                        <FieldNumber
                          v-model="item.qty_transform"
                          :min="1"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          :errorname="detailErrors[idx]?.qty_transform ? 'failed' : ''"
                          :hints="detailErrors[idx]?.qty_transform || ''"
                          placeholder="0"
                          @update:modelValue="
                            () => {
                              if (detailErrors[idx]?.qty_transform) {
                                delete detailErrors[idx].qty_transform;
                              }
                            }
                          "
                        />
                      </TableCell>
                      <TableCell class="min-w-[150px]">
                        <template v-if="headerItemIsBatch">
                          <FieldX
                            v-if="!isReadOnly"
                            :id="`batch-cut-${idx}`"
                            :value="item.batch || ''"
                            @input="(v: any) => (item.batch = v)"
                            :disabled="loading"
                            :placeholder="defaultBatchPreview || 'No Transform + Tgl'"
                            class="w-full text-xs sm:text-sm"
                          />
                          <span v-else class="text-xs sm:text-sm font-mono">{{ item.batch || '-' }}</span>
                        </template>
                        <span v-else class="text-xs text-muted-foreground italic">-</span>
                      </TableCell>
                      <TableCell>
                        <FieldX
                          v-model="item.catatan"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          placeholder="Catatan"
                        />
                      </TableCell>
                      <TableCell v-if="!isReadOnly" class="text-center">
                        <DeleteButton
                          variant="ghost"
                          size="sm"
                          @click="removeDetailItem(idx)"
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- TAB CONTENT: Log -->
        <TabsContent value="detailLog" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Tabel Log</CardTitle>
                  <CardDescription>Lihat history perubahan pada item ini</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div v-if="loadingLog" class="text-center py-8 text-muted-foreground text-sm">
                Memuat log...
              </div>
              <div v-else class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm w-10">No</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm whitespace-nowrap">Tanggal</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm whitespace-nowrap">Edited By</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Deskripsi</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Perubahan</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailLog.length === 0">
                      <td colspan="5" class="text-center py-8 text-muted-foreground text-xs sm:text-sm">
                        Belum ada log
                      </td>
                    </tr>
                    <tr
                      v-for="(log, index) in detailLog"
                      :key="log.id || index"
                      class="border-t hover:bg-muted/50 align-top"
                    >
                      <td class="px-3 py-3 text-xs sm:text-sm whitespace-nowrap">{{ index + 1 }}</td>
                      <td class="px-3 py-3 text-xs sm:text-sm whitespace-nowrap">{{ formatLogDate(log.createdAt || log.created_at) }}</td>
                      <td class="px-3 py-3 text-xs sm:text-sm whitespace-nowrap">{{ getLogUser(log) }}</td>
                      <td class="px-3 py-3 text-xs sm:text-sm">{{ log.description || log.deskripsi || "-" }}</td>
                      <td class="px-3 py-3 text-xs sm:text-sm">
                        <span v-if="!log.old_data || Object.keys(log.old_data || {}).length === 0" class="text-green-600 font-medium">Item baru dibuat</span>
                        <template v-else>
                          <div class="space-y-1">
                            <template v-for="key in Object.keys(log.new_data || {})" :key="key">
                              <div
                                v-if="String(log.old_data[key] ?? '') !== String(log.new_data[key] ?? '') && key !== 'updatedAt' && key !== 'createdAt' && key !== 'updated_at' && key !== 'created_at'"
                                class="text-xs"
                              >
                                <span class="font-medium text-foreground">{{ formatFieldKey(key) }}:</span>
                                <span class="text-red-500 line-through ml-1">{{ log.old_data[key] ?? "-" }}</span>
                                <span class="mx-1 text-muted-foreground">→</span>
                                <span class="text-green-600">{{ log.new_data[key] ?? "-" }}</span>
                              </div>
                            </template>
                          </div>
                        </template>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AuditInfo
        v-if="(isViewMode || isEditMode) && !isCopyMode"
        :created-by="auditMeta.created_by"
        :created-at="auditMeta.createdAt"
        :updated-by="auditMeta.updated_by"
        :updated-at="auditMeta.updatedAt"
      />

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

    <!-- ================================================================ -->
    <!-- REVISI CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <Dialog
      :open="isRevisiDialogOpen"
      @update:open="isRevisiDialogOpen = $event"
    >
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Konfirmasi Penyimpanan</DialogTitle>
          <DialogDescription>
            Item ini memiliki status
            <span class="font-semibold text-yellow-600">REVISI</span>. Perubahan
            yang Anda simpan akan otomatis mengirim item ini ke proses approval
            kembali dan status akan berubah menjadi
            <span class="font-semibold text-blue-600">IN APPROVAL</span>.
          </DialogDescription>
        </DialogHeader>

        <div class="py-4 space-y-4">
          <div class="space-y-2 text-sm text-muted-foreground">
            <p>Setelah menyimpan:</p>
            <ul class="list-disc list-inside space-y-1 ml-2">
              <li>Perubahan data akan tersimpan</li>
              <li>Status berubah menjadi IN APPROVAL</li>
              <li>Notifikasi approval akan terkirim otomatis</li>
            </ul>
          </div>

          <div class="border-t pt-4">
            <FieldX
              id="approval-message"
              v-model="approvalMessage"
              label="Pesan Approval"
              placeholder="Masukkan pesan untuk approval"
              :hints="
                approvalMessageError ||
                'Pesan ini akan dikirim ke penerima approval'
              "
              :errorname="approvalMessageError ? 'failed' : ''"
              :required="true"
              :disabled="loading"
            />
          </div>
        </div>

        <DialogFooter class="gap-2">
          <Button
            variant="outline"
            @click="cancelRevisiSave"
            :disabled="loading"
          >
            Batal
          </Button>
          <Button
            variant="default"
            @click="confirmRevisiSave"
            :disabled="loading"
            class="gap-2"
          >
            <Send class="h-4 w-4" />
            <span>{{
              loading ? "Menyimpan..." : "Simpan & Kirim Approval"
            }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ================================================================ -->
    <!-- SUPER ADMIN CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <Dialog
      :open="isSuperAdminDialogOpen"
      @update:open="isSuperAdminDialogOpen = $event"
    >
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>Konfirmasi Super Admin</DialogTitle>
          <DialogDescription>
            Anda login sebagai
            <span class="font-semibold text-primary">SUPER ADMIN</span>.
          </DialogDescription>
        </DialogHeader>

        <div class="py-4 space-y-4">
          <div
            class="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
          >
            <p class="text-sm text-yellow-800 dark:text-yellow-200">
              Data yang Anda {{ isEditMode ? "perbarui" : "buat" }} akan
              langsung memiliki status
              <span class="font-bold text-green-600 dark:text-green-400"
                >APPROVED</span
              >
              tanpa melalui proses approval.
            </p>
          </div>
        </div>

        <DialogFooter class="gap-2">
          <Button
            variant="outline"
            @click="cancelSuperAdminSave"
            :disabled="loading"
          >
            Batal
          </Button>
          <Button
            variant="default"
            @click="confirmSuperAdminSave"
            :disabled="loading"
            class="gap-2 bg-green-600 hover:bg-green-700"
          >
            <Save class="h-4 w-4" />
            <span>{{
              loading ? "Menyimpan..." : "Ya, Simpan dengan APPROVED"
            }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.required::after {
  content: " *";
  color: hsl(var(--destructive));
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
