<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  FieldX,
  FieldNumber,
  FieldStatus,
  FieldDateTime,
  FieldTextarea,
  FieldSelect,
} from "@/components/field";
import { DeleteButton, ButtonMultiSelect } from "@/components/button";
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  ChevronDown,
  ChevronRight,
  Trash2,
  X,
  RefreshCw,
  ShoppingCart,
} from "lucide-vue-next";
import TableSelectPagination from "@/components/table/TableSelectPagination.vue";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createRfq,
  updateRfq,
  getRfqById,
  type RfqItemDetail,
  type RfqSupplierDetail,
} from "./service";
import AuditInfo from '@/components/AuditInfo.vue'
import FieldDate from "@/components/field/FieldDate.vue";

// ============================================================================
// SETUP
// ============================================================================
const authStore = useAuthStore();
const { API_BASE_URL } = useApi();
const router = useRouter();
const route = useRoute();

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false);
const isEditMode = computed(
  () => !!route.params.id && route.name === "RfqForm",
);
const isViewMode = computed(() => route.name === "RfqView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail RFQ";
  if (isCopyMode.value) return "Salin RFQ";
  if (isEditMode.value) return "Edit RFQ";
  return "Tambah RFQ Baru";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data RFQ";
  if (isCopyMode.value) return "Buat RFQ baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data RFQ";
  return "Buat RFQ baru";
});

const isSuperAdmin = computed(() => {
  const user = authStore.user;
  if (!user || !user.tipe) return false;
  return user.tipe.value1?.toUpperCase() === "SUPER ADMIN";
});

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

// ============================================================================
// UNIT BISNIS -> COMPANY DISPLAY (Super Admin)
// ============================================================================
// Nama company (perusahaan induk) dari Unit Bisnis yang dipilih.
// Tampil sebagai field readonly saat Super Admin memilih Unit Bisnis.
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
        result.data?.m_company?.nama || result.data?.m_company?.kode || "-";
    }
  } catch {
    // ignore, field will just stay empty
  }
};

// Form values
let values = reactive({
  tgl_mulai: "",
  tgl_akhir: "",
  currency_id: "78d1dba6-f299-42bb-8caf-4e68d657fad8",
  m_unit_bisnis_id: "",
  createdBy: authStore.user?.id || "",
  status: "DRAFT",
  catatan: "",
  no_rfq: "",
  createdAt: "",
});

// Temp penampung data API mentah
let initialValues: Record<string, any> = {};

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

// Detail arrays with display properties
interface RfqDetailDisplay extends RfqItemDetail {
  _expanded?: boolean;
  no_pr_display?: string;
  item_code_display?: string;
  item_name_display?: string;
  uom_name_display?: string;
}

const detailArr = ref<RfqDetailDisplay[]>([]);
const supplierArr = ref<any[]>([]);

// Comparison Quotation State
const comparisonData = ref<any>(null);
const loadingComparison = ref(false);

const comparisonItems = computed(() => comparisonData.value?.items || []);
const hasComparisonItems = computed(() => comparisonItems.value.length > 0);
const isComparisonItemBlocked = (item: any) =>
  item?.is_pr_outstanding_empty === true;
const getComparisonItemOutstandingQty = (item: any) =>
  item?.qty_outstanding_pr ?? 0;
const allComparisonItemsBlocked = computed(
  () =>
    hasComparisonItems.value &&
    comparisonItems.value.every((item: any) => isComparisonItemBlocked(item)),
);

// Global search & sort for comparison items list
type GlobalSortKey =
  | "item_name"
  | "item_code"
  | "qty"
  | "total_price"
  | "supplier_count"
  | "";
interface GlobalFilterState {
  search: string;
  sortKey: GlobalSortKey;
  sortDir: "asc" | "desc";
}
const globalFilter = ref<GlobalFilterState>({
  search: "",
  sortKey: "",
  sortDir: "asc",
});

const toggleGlobalSort = (key: GlobalSortKey) => {
  if (globalFilter.value.sortKey === key) {
    globalFilter.value.sortDir =
      globalFilter.value.sortDir === "asc" ? "desc" : "asc";
  } else {
    globalFilter.value.sortKey = key;
    globalFilter.value.sortDir = "asc";
  }
};

const resetGlobalFilter = () => {
  globalFilter.value = { search: "", sortKey: "", sortDir: "asc" };
};

const filteredComparisonItems = computed(() => {
  if (!comparisonData.value?.items) return [];
  let items = [...comparisonData.value.items];

  // Global search: match item name or item code
  const search = globalFilter.value.search.trim().toLowerCase();
  if (search) {
    items = items.filter(
      (item: any) =>
        item.item_name?.toLowerCase().includes(search) ||
        item.item_code?.toLowerCase().includes(search),
    );
  }

  // Global sort
  if (globalFilter.value.sortKey) {
    const dir = globalFilter.value.sortDir === "asc" ? 1 : -1;
    items = items.slice().sort((a: any, b: any) => {
      let aVal: any;
      let bVal: any;
      const key = globalFilter.value.sortKey;
      if (key === "item_name") {
        aVal = (a.item_name || "").toLowerCase();
        bVal = (b.item_name || "").toLowerCase();
      } else if (key === "item_code") {
        aVal = (a.item_code || "").toLowerCase();
        bVal = (b.item_code || "").toLowerCase();
      } else if (key === "qty") {
        aVal = Number(a.qty) || 0;
        bVal = Number(b.qty) || 0;
      } else if (key === "total_price") {
        // Sum of all supplier prices for this item
        aVal = (a.supplier_quotes || []).reduce(
          (s: number, q: any) => s + (Number(q.price) || 0),
          0,
        );
        bVal = (b.supplier_quotes || []).reduce(
          (s: number, q: any) => s + (Number(q.price) || 0),
          0,
        );
      } else if (key === "supplier_count") {
        aVal = (a.supplier_quotes || []).length;
        bVal = (b.supplier_quotes || []).length;
      }
      if (aVal < bVal) return -dir;
      if (aVal > bVal) return dir;
      return 0;
    });
  }

  return items;
});

// Per-item search & sort state (keyed by rfq_items_d_id)
type ComparisonSortKey = "harga" | "supplier" | "qty" | "date" | "";
interface ItemFilterState {
  search: string;
  sortKey: ComparisonSortKey;
  sortDir: "asc" | "desc";
}
const itemFilterStates = ref<Record<string, ItemFilterState>>({});

const getItemFilterState = (itemId: string): ItemFilterState => {
  if (!itemFilterStates.value[itemId]) {
    itemFilterStates.value[itemId] = {
      search: "",
      sortKey: "",
      sortDir: "asc",
    };
  }
  return itemFilterStates.value[itemId];
};

const toggleItemSort = (itemId: string, key: ComparisonSortKey) => {
  const state = getItemFilterState(itemId);
  if (state.sortKey === key) {
    state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
  } else {
    state.sortKey = key;
    state.sortDir = "asc";
  }
};

const resetItemFilter = (itemId: string) => {
  itemFilterStates.value[itemId] = { search: "", sortKey: "", sortDir: "asc" };
};

const getFilteredQuotes = (item: any): any[] => {
  if (!item?.supplier_quotes) return [];
  const state = getItemFilterState(item.rfq_items_d_id);
  let quotes = [...item.supplier_quotes];

  // Filter by search
  const search = state.search.trim().toLowerCase();
  if (search) {
    quotes = quotes.filter(
      (q: any) =>
        q.supplier_name?.toLowerCase().includes(search) ||
        q.no_supplier_quotation?.toLowerCase().includes(search),
    );
  }

  // Sort
  if (state.sortKey) {
    quotes = quotes.sort((a: any, b: any) => {
      let aVal: any;
      let bVal: any;
      if (state.sortKey === "harga") {
        aVal = Number(a.price) || 0;
        bVal = Number(b.price) || 0;
      } else if (state.sortKey === "supplier") {
        aVal = (a.supplier_name || "").toLowerCase();
        bVal = (b.supplier_name || "").toLowerCase();
      } else if (state.sortKey === "qty") {
        aVal = Number(a.min_qty) || 0;
        bVal = Number(b.min_qty) || 0;
      } else if (state.sortKey === "date") {
        aVal = a.start_date ? new Date(a.start_date).getTime() : 0;
        bVal = b.start_date ? new Date(b.start_date).getTime() : 0;
      }
      if (aVal < bVal) return state.sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return state.sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }

  return quotes;
};

const prSelectionApi = computed(() => ({
  url: `${API_BASE_URL}/dynamic/t_purchase_request`,
  params: {
    filter_column_status: "APPROVED",
    filter_column_is_rfq: "true",
    filter_operator_is_rfq: "=",
    filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
    include: "t_purchase_request_d",
    searchfield: "no_pr,catatan,status",
    selectfield: "id,no_pr,tgl_pr,catatan,status",
    "filter_column_t_purchase_request_ds.qty_ots": 0,
    "filter_operator_t_purchase_request_ds.qty_ots": ">",
    order_by: "tgl_pr",
    order_type: "DESC",
  },
}));

// ============================================================================
// MODAL STATE & METHODS
// ============================================================================
const showAddDialog = ref(false);
const selectedPrId = ref("");
const selectedPrNo = ref("");
const prItemsKey = ref(0); // To force re-render/reload ButtonMultiSelect if needed

const openAddDialog = () => {
  showAddDialog.value = true;
  selectedPrId.value = "";
  selectedPrNo.value = "";
  prItemsKey.value++;
};

const onPrSelected = (val: string, fullObj: any) => {
  selectedPrId.value = val;
  if (fullObj) {
    selectedPrNo.value = fullObj.no_pr;
  }
  // Force reload of items list if using key (optionally)
  prItemsKey.value++;
};

const onAddItems = (items: any[]) => {
  addItemsFromSelection(items);
  showAddDialog.value = false;
};

// ============================================================================
// COMPARISON QUOTATION METHODS
// ============================================================================
const fetchComparisonData = async () => {
  if (!menuId.value) return;

  loadingComparison.value = true;
  try {
    const response = await fetch(
      `${API_BASE_URL}/fn/t_rfq/GetCompareItemSQ/?rfq_id=${menuId.value}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );

    const result = await response.json();

    if (result.success && result.data) {
      comparisonData.value = result.data;
    } else {
      toast.error("Gagal memuat data komparasi", {
        description: result.message || "Terjadi kesalahan",
      });
    }
  } catch (error) {
    console.error("Error fetching comparison data:", error);
    toast.error("Gagal memuat data komparasi", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    loadingComparison.value = false;
  }
};

// ============================================================================
// GENERATE PO METHODS & STATE
// ============================================================================
const showGeneratePoDialog = ref(false);
const selectedPoQuotes = ref<Record<string, any>>({}); // key: rfq_items_d_id
const selectedEligiblePoQuotesCount = computed(() =>
  Object.entries(selectedPoQuotes.value).filter(([itemId, quote]) => {
    if (!quote) return false;
    const item = comparisonItems.value.find(
      (comparisonItem: any) => comparisonItem.rfq_items_d_id === itemId,
    );
    return !!item && !isComparisonItemBlocked(item);
  }).length,
);

const uniqueSuppliers = computed(() => {
  if (!comparisonData.value || !comparisonData.value.items) return [];
  const suppliersMap = new Map();
  comparisonData.value.items.forEach((item: any) => {
    if (item.supplier_quotes) {
      item.supplier_quotes.forEach((sq: any) => {
        if (!suppliersMap.has(sq.supplier_quotation_id)) {
          suppliersMap.set(sq.supplier_quotation_id, {
            id: sq.supplier_quotation_id,
            name: sq.supplier_name,
          });
        }
      });
    }
  });
  return Array.from(suppliersMap.values());
});

const openGeneratePoDialog = () => {
  if (allComparisonItemsBlocked.value) {
    toast.info("PR Sudah Send Ke PO");
    return;
  }
  selectedPoQuotes.value = {};
  showGeneratePoDialog.value = true;
};

const getQuoteForItemAndSupplier = (item: any, supplierId: string) => {
  console.log("getquoteitem", item);
  return item.supplier_quotes?.find(
    (q: any) => q.supplier_quotation_id === supplierId,
  );
};

const onGeneratePoSubmit = async () => {
  const grouped: Record<string, any> = {};

  for (const itemId in selectedPoQuotes.value) {
    const quote = selectedPoQuotes.value[itemId];
    const item = comparisonData.value.items.find(
      (i: any) => i.rfq_items_d_id === itemId,
    );
    if (!item || !quote || isComparisonItemBlocked(item)) continue;

    const key = `${item.purchase_request_id}_${quote.supplier_quotation_id}`;
    if (!grouped[key]) {
      grouped[key] = {
        rfq_id: menuId.value,
        purchase_request_id: item.purchase_request_id,
        supplier_quotation_id: quote.supplier_quotation_id,
        lines: [],
      };
    }
    grouped[key].lines.push({
      rfq_items_d_id: item.rfq_items_d_id,
      supplier_quotation_d_id: quote.supplier_quotation_d_id,
      qty_po: item.qty, // user input qty could be custom, we use RFQ qty as fallback
      harga: quote.price,
    });
  }

  const payloads = Object.values(grouped);
  if (payloads.length === 0) {
    toast.error("Validasi gagal", {
      description: "Pilih setidaknya satu supplier untuk satu item",
    });
    return;
  }

  loading.value = true;
  let successCount = 0;
  let errorCount = 0;

  for (const payload of payloads) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/fn/t_purchase_order/createBulkPOFromSQ`,
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
      // result bisa .success (boolean) || .status === 'success' (string)
      if (result.success || result.status === "success") {
        successCount++;
      } else {
        console.error("Failed PO creation:", result);
        errorCount++;
      }
    } catch (error) {
      console.error("Error creating PO:", error);
      errorCount++;
    }
  }

  loading.value = false;

  if (successCount > 0) {
    toast.success(`Berhasil membuat ${successCount} Draft PO`);
    showGeneratePoDialog.value = false;
    if (errorCount > 0) {
      toast.warning(`Terdapat ${errorCount} PO yang gagal dibuat`);
    }
  } else if (errorCount > 0) {
    toast.error("Semua Generate PO Gagal");
  }
};

// ============================================================================
// DETAIL METHODS
// ============================================================================

const addItemsFromSelection = (items: any[]) => {
  let count = 0;
  let skipped = 0;
  items.forEach((item) => {
    const itemId = item.m_items_id || item.m_item?.id;
    const prId = item.t_purchase_request_id;
    const prDetailId =
      item.purchase_request_d_id ||
      item.t_purchase_request_d_id ||
      item.id;

    // Check availability
    const exists = detailArr.value.some(
      (d) =>
        (prDetailId && d.purchase_request_d_id === prDetailId) ||
        (!prDetailId &&
          d.item_id === itemId &&
          d.purchase_request_id === prId),
    );
    if (exists) {
      skipped++;
      return;
    }

    // Construct new detail item
    detailArr.value.push({
      item_id: itemId,
      qty: item.qty_pr || item.qty || 0,
      uom_id: item.uom_id || item.prqd_uom?.id || item.uom?.id,
      purchase_request_id: item.t_purchase_request_id, // Header ID from detail
      purchase_request_d_id: prDetailId,
      catatan: "",
      // Display props
      no_pr_display:
        item.t_purchase_request?.no_pr || selectedPrNo.value || "-",
      item_code_display:
        item.m_item?.kode_item || item.m_item?.code || "-",
      item_name_display:
        item.m_item?.nama_item || item.m_item?.nama || "-",
      uom_name_display:
        item.prqd_uom?.value1 ||
        item.prqd_uom?.name ||
        item.uom?.name ||
        item.m_general?.value1 ||
        "-",
    });
    count++;
  });
  if (count > 0) toast.success(`${count} item ditambahkan`);
  if (skipped > 0) toast.warning(`${skipped} item sudah ada di list`);
};

const removeDetailArr = (index: number) => {
  detailArr.value.splice(index, 1);
  toast.info("Item detail dihapus");
};

// Supplier Methods
const onAddSuppliers = (items: any[]) => {
  let count = 0;
  items.forEach((item) => {
    const exists = supplierArr.value.some((s) => s.supplier_id === item.id);
    if (!exists) {
      supplierArr.value.push({
        supplier_id: item.id,
        supplier_name: item.nama_supp || "-",
        supplier_code: item.kode_supplier || "-",
        catatan: "",
      });
      count++;
    }
  });
  if (count > 0) toast.success(`${count} supplier ditambahkan`);
};

const removeSupplier = (index: number) => {
  supplierArr.value.splice(index, 1);
  toast.info("Supplier dihapus");
};

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    tgl_mulai: new Date().toISOString().split("T")[0],
    tgl_akhir: new Date().toISOString().split("T")[0],
    createdAt: new Date().toISOString().split("T")[0],
    currency_id: "78d1dba6-f299-42bb-8caf-4e68d657fad8",
    m_unit_bisnis_id: "",
    createdBy: authStore.user?.id || "",
    status: "DRAFT",
    catatan: "",
    no_rfq: "",
  });

  // Reset company name display
  selectedUnitBisnisCompanyName.value = "";

  // Reset errors
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });

  detailArr.value = [];
  supplierArr.value = [];
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
      console.error("Failed to parse SelectRespo", e);
    }
  }

  const isCopyModeLocal = route.query.action === "copy" && route.query.source;
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value;

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return;
  }

  loading.value = true;
  try {
    const res = await getRfqById(sourceId);

    if (res.status !== "success") throw new Error("Gagal memuat data");
    initialValues = res.data;

    auditMeta.value = {
      created_by: initialValues.created_by || initialValues.createdBy || null,
      createdAt: initialValues.createdAt || null,
      updated_by: initialValues.updated_by || initialValues.update_by || initialValues.edited_by || null,
      updatedAt: initialValues.updatedAt || null,
    };

    // Load detail items
    const detailItems =
      initialValues.t_rfq_items_ds || initialValues.t_rfq_items_d;
    const detailSuppliers =
      initialValues.t_rfq_supplier_ds || initialValues.t_rfq_supplier_d;

    if (detailSuppliers) {
      supplierArr.value = detailSuppliers.map((s: any) => ({
        ...s,
        id: isCopyModeLocal ? undefined : s.id,
        supplier_id: s.supplier_id,
        supplier_name: s.m_supplier?.nama_supp || "-",
        supplier_code: s.m_supplier?.kode_supplier || "-",
        catatan: s.catatan || "",
      }));
    }

    if (detailItems) {
      detailArr.value = detailItems.map((d: any) => ({
        ...d,
        id: isCopyModeLocal ? undefined : d.id,
        // Map singular/plural relations
        m_item: d.m_items || d.m_item,
        prqd_uom: d.m_general || d.uom,

        // Map to new expected keys if coming from old structure or generic backend
        item_id: d.item_id || d.m_item_id || d.m_items?.id,
        purchase_request_id:
          d.purchase_request_id ||
          d.t_purchase_request_id ||
          d.t_purchase_request?.id,
        purchase_request_d_id:
          d.purchase_request_d_id ||
          d.t_purchase_request_d_id ||
          d.t_purchase_request_d?.id ||
          d.id,

        no_pr_display: d.t_purchase_request?.no_pr || "-",
        item_code_display:
          d.m_items?.kode_item ||
          d.m_item?.kode_item ||
          d.m_item?.code ||
          "-",
        item_name_display:
          d.m_items?.nama_item ||
          d.m_item?.nama_item ||
          d.m_item?.nama ||
          "-",
        uom_name_display:
          d.m_general?.value1 || d.prqd_uom?.value1 || d.uom?.name || "-",
      }));
    }

    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
      delete (initialValues as any).no_rfq;
      (initialValues as any).status = "DRAFT";
    }

    // Assign keys
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        let val = initialValues[key];
        // Convert strings to simple date YYYY-MM-DD
        if (
          ["tgl_mulai", "tgl_akhir", "createdAt"].includes(key) &&
          typeof val === "string"
        ) {
          val = val.substring(0, 10);
        }
        // @ts-ignore dynamic assign
        values[key] = val;
      }
    }

    // Super Admin: ambil nama company dari Unit Bisnis yang tersimpan
    if (isSuperAdmin.value && values.m_unit_bisnis_id) {
      fetchUnitBisnisCompanyName(values.m_unit_bisnis_id);
    }

    if (isCopyModeLocal) {
      toast.success("Data berhasil disalin");
    } else {
      toast.success("Data berhasil dimuat");
    }

    // Auto-fetch comparison data if in view mode
    if (isViewMode.value) {
      fetchComparisonData();
    }
  } catch (error) {
    toast.error("Gagal memuat data Rfq", {
      description:
        error instanceof Error ? error.message : "Terjadi kesalahan",
    });
    setTimeout(() => router.push("/purchasing/transaksi/t_rfq"), 2000);
  } finally {
    loading.value = false;
  }
});

// Errors object
const errors = reactive({
  currency_id: "",
  m_unit_bisnis_id: "",
  tgl_mulai: "",
  tgl_akhir: "",
});

// Tanggal RFQ = hari ini (readonly)
const today = new Date().toISOString().slice(0, 10);

const getRfqDateOnly = () => {
  const sourceDate = values.createdAt || today;
  if (!sourceDate) return today;
  return sourceDate.includes("T")
    ? (sourceDate.split("T")[0] ?? today)
    : sourceDate;
};

// Handler validasi tgl_mulai
const handleTglMulaiChange = (val: string) => {
  values.tgl_mulai = val;
  errors.tgl_mulai = "";
  errors.tgl_akhir = "";
  const tglRfq = getRfqDateOnly();
  if (val && val < tglRfq) {
    errors.tgl_mulai = `Tanggal Mulai tidak boleh sebelum Tanggal RFQ (${tglRfq})`;
  }
  if (values.tgl_akhir && val && values.tgl_akhir < val) {
    errors.tgl_akhir = "Tanggal Akhir tidak boleh sebelum Tanggal Mulai";
  }
};

// Handler validasi tgl_akhir
const handleTglAkhirChange = (val: string) => {
  values.tgl_akhir = val;
  errors.tgl_akhir = "";
  if (values.tgl_mulai && val && val < values.tgl_mulai) {
    errors.tgl_akhir = "Tanggal Akhir tidak boleh sebelum Tanggal Mulai";
  }
};

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });
  let invalid = false;

  if (!values.currency_id?.trim()) {
    errors.currency_id = "Currency wajib diisi";
    invalid = true;
  }
  if (!values.m_unit_bisnis_id?.trim()) {
    errors.m_unit_bisnis_id = "Unit Bisnis wajib diisi";
    invalid = true;
  }

  // Validasi tanggal
  const tglRfq = getRfqDateOnly();
  if (values.tgl_mulai && values.tgl_mulai < tglRfq) {
    errors.tgl_mulai = `Tanggal Mulai tidak boleh sebelum Tanggal RFQ (${tglRfq})`;
    invalid = true;
  }
  if (
    values.tgl_akhir &&
    values.tgl_mulai &&
    values.tgl_akhir < values.tgl_mulai
  ) {
    errors.tgl_akhir = "Tanggal Akhir tidak boleh sebelum Tanggal Mulai";
    invalid = true;
  }

  if (invalid) {
    toast.error("Validasi gagal", {
      description: "Mohon lengkapi field yang wajib diisi",
    });
    return;
  }

  if (detailArr.value.length === 0) {
    toast.error("Validasi gagal", {
      description:
        "Item RFQ tidak boleh kosong, mohon pilih item terlebih dahulu",
    });
    return;
  }

  if (supplierArr.value.length === 0) {
    toast.error("Validasi gagal", {
      description:
        "Supplier penerima RFQ tidak boleh kosong, mohon pilih minimal satu supplier",
    });
    return;
  }

  loading.value = true;
  try {
    // Prepare payload with time restoration
    const appendTime = (dateStr: string, originalStr: any) => {
      if (!dateStr) return dateStr;
      if (originalStr && String(originalStr).startsWith(dateStr))
        return originalStr;
      // Append current time for new/changed dates
      const now = new Date();
      // Use ISO time part (HH:mm:ss.sssZ) - replacing date part of ISO string
      const iso = now.toISOString();
      const timePart = iso.split("T")[1];
      return `${dateStr}T${timePart}`;
    };

    const payload: any = {
      ...values,
      tgl_mulai: appendTime(values.tgl_mulai, initialValues.tgl_mulai),
      tgl_akhir: appendTime(values.tgl_akhir, initialValues.tgl_akhir),
      createdAt: appendTime(values.createdAt, initialValues.createdAt),

      t_rfq_items_ds: detailArr.value.map((d) => ({
        rfq_id: d.rfq_id,
        purchase_request_id: d.purchase_request_id,
        purchase_request_d_id: d.purchase_request_d_id,
        item_id: d.item_id,
        qty: d.qty,
        uom_id: d.uom_id,
        catatan: d.catatan,
        // include id for update
        id: d.id,
      })),

      t_rfq_supplier_ds: supplierArr.value.map((s) => ({
        supplier_id: s.supplier_id,
        catatan: s.catatan,
        id: s.id,
      })),
    };

    if (isEditMode.value) {
      payload.updated_by = authStore.user?.id || null;
      await updateRfq(menuId.value, payload);
      toast.success("Rfq berhasil diperbarui");
    } else {
      payload.created_by = authStore.user?.id || null;
      payload.updated_by = authStore.user?.id || null;
      await createRfq(payload);
      toast.success("Rfq berhasil dibuat");
    }
    router.replace("/purchasing/transaksi/t_rfq?reload=" + Date.now());
  } catch (error) {
    toast.error("Gagal menyimpan Rfq", {
      description:
        error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  router.push("/purchasing/transaksi/t_rfq");
};
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
    <!-- HEADER SECTION -->
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="icon" @click="handleCancel">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div class="flex-1">
        <h1 class="text-2xl font-bold text-foreground">{{ pageTitle }}</h1>
        <p class="text-sm text-muted-foreground">{{ pageDescription }}</p>
      </div>
    </div>

    <!-- FORM SECTION -->
    <form class="space-y-6" @submit.prevent>
      <!-- HEADER CARD -->
      <Card>
        <CardHeader>
          <CardTitle>Informasi RFQ</CardTitle>
          <CardDescription>Isi data Request For Quotation</CardDescription>
        </CardHeader>
        <CardContent class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Unit Bisnis - Super Admin: Select, User Biasa: Auto dari auth -->
            <FieldSelect
              v-if="isSuperAdmin"
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              v-model="values.m_unit_bisnis_id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                params: {
                  no_pagination: 'true',
                  searchfield: 'nama_comp',
                  filter_column_is_active: 'true',
                  join: 'true',
                },
              }"
              :errorname="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id || 'Pilih unit bisnis'"
              :required="!isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih Unit Bisnis"
              class="w-full"
              valueField="id"
              displayField="nama_comp"
              @update:value-full="
                (item) => {
                  handleUnitBisnisSelected(item);
                  detailArr = [];
                  supplierArr = [];
                }
              "
            />

            <FieldX
              v-else
              id="m_unit_bisnis_display"
              label="Unit Bisnis"
              :value="companyNameDisplay"
              :disabled="true"
              :readonly="true"
              placeholder="Auto dari akun"
              hints="Unit bisnis dari akun Anda"
            />

            <FieldDate
              id="tgl_rfq"
              label="Tanggal RFQ"
              v-model="values.createdAt"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              hints="Otomatis hari ini"
            />
          </div>

          <!-- Company - hanya tampil untuk Super Admin, menampilkan
               perusahaan induk dari Unit Bisnis yang dipilih -->
          <FieldX
            v-if="isSuperAdmin"
            id="m_unit_bisnis_company_display"
            label="Company"
            :value="selectedUnitBisnisCompanyName || '-'"
            :disabled="true"
            :readonly="true"
            placeholder="-"
            hints="Company dari Unit Bisnis yang dipilih"
          />

          <FieldX
            id="no_rfq"
            label="No RFQ"
            v-model="values.no_rfq"
            :readonly="true"
            placeholder="Auto Generated"
          />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FieldDate
              id="tgl_mulai"
              label="Tanggal Mulai"
              :modelValue="values.tgl_mulai"
              @update:modelValue="handleTglMulaiChange"
              :readonly="isReadOnly"
              :errorname="errors.tgl_mulai ? 'failed' : ''"
              :hints="
                errors.tgl_mulai || 'Mulai berlakunya RFQ (≥ Tanggal RFQ)'
              "
            />
            <FieldDate
              id="tgl_akhir"
              label="Tanggal Akhir"
              :modelValue="values.tgl_akhir"
              @update:modelValue="handleTglAkhirChange"
              :readonly="isReadOnly"
              :errorname="errors.tgl_akhir ? 'failed' : ''"
              :hints="
                errors.tgl_akhir || 'Akhir berlakunya RFQ (≥ Tanggal Mulai)'
              "
            />
          </div>

          <!-- field select ambil dari m_currency -->
          <FieldSelect
            id="currency_id"
            label="Currency"
            v-model="values.currency_id"
            :api="{ url: `${API_BASE_URL}/dynamic/m_currency` }"
            :errorname="errors.currency_id ? 'failed' : ''"
            :hints="errors.currency_id"
            :required="!isReadOnly"
            :readonly="isReadOnly"
            placeholder="Pilih Currency"
            valueField="id"
            displayField="nama_currency"
          />
          <FieldTextarea
            id="catatan"
            label="Catatan"
            v-model="values.catatan"
            :readonly="isReadOnly"
            placeholder="Catatan tambahan..."
          />
          <FieldX
            id="status"
            label="Status"
            v-model="values.status"
            :readonly="true"
            placeholder="Status"
          />
        </CardContent>
      </Card>

      <!-- DETAIL TABS -->
      <Tabs :default-value="isViewMode ? 'comparison' : 'item'" class="w-full">
        <TabsList
          :class="
            isViewMode ? 'grid w-full grid-cols-3' : 'grid w-full grid-cols-2'
          "
        >
          <TabsTrigger
            v-if="isViewMode"
            value="comparison"
            @click="fetchComparisonData"
            >Komparasi Quotation
          </TabsTrigger>
          <TabsTrigger value="item">Detail Item</TabsTrigger>
          <TabsTrigger value="supplier">Detail Supplier</TabsTrigger>
        </TabsList>

        <TabsContent value="item">
          <Card>
            <CardHeader class="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Detail Item</CardTitle>
                <CardDescription
                  >Daftar item RFQ dari Purchase Request</CardDescription
                >
              </div>
              <Button
                v-if="!isReadOnly"
                variant="outline"
                size="sm"
                @click="openAddDialog"
                :disabled="!values.m_unit_bisnis_id"
              >
                <Plus class="w-4 h-4 mr-2" />
                Tambah Item
              </Button>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th class="px-3 py-3 text-left font-medium">No</th>
                      <th class="px-3 py-3 text-left font-medium">No. PR</th>
                      <th class="px-3 py-3 text-left font-medium">Kode</th>
                      <th class="px-3 py-3 text-left font-medium">Nama Item</th>
                      <th class="px-3 py-3 text-left font-medium w-24">Qty</th>
                      <th class="px-3 py-3 text-left font-medium">UoM</th>
                      <th class="px-3 py-3 text-left font-medium">Catatan</th>
                      <th class="px-3 py-3 text-center font-medium w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr.length === 0">
                      <td
                        colspan="9"
                        class="text-center py-8 text-muted-foreground"
                      >
                        Belum ada item dipilih.
                      </td>
                    </tr>
                    <template v-for="(detail, index) in detailArr" :key="index">
                      <!-- MAIN ROW -->
                      <tr class="border-t hover:bg-muted/30">
                        <td class="px-3 py-3">{{ index + 1 }}</td>
                        <td class="px-3 py-3">{{ detail.no_pr_display }}</td>
                        <td class="px-3 py-3">
                          {{ detail.item_code_display }}
                        </td>
                        <td class="px-3 py-3 font-medium">
                          {{ detail.item_name_display }}
                        </td>
                        <td class="px-3 py-3">
                          <FieldNumber
                            id="qty"
                            v-model="detail.qty"
                            :min="0"
                            placeholder="0"
                            class="w-24"
                            :readonly="true"
                            :disabled="true"
                          />
                        </td>
                        <td class="px-3 py-3 bg-muted/20">
                          {{ detail.uom_name_display }}
                        </td>
                        <td class="px-3 py-3">
                          <input
                            type="text"
                            v-model="detail.catatan"
                            placeholder="Catatan"
                            class="flex h-8 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            :readonly="isReadOnly"
                          />
                        </td>
                        <td class="px-3 py-3 text-center">
                          <DeleteButton
                            v-if="!isReadOnly"
                            size="sm"
                            @click="removeDetailArr(index)"
                          />
                        </td>
                      </tr>
                    </template>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="supplier">
          <Card>
            <CardHeader class="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Detail Supplier</CardTitle>
                <CardDescription>Daftar supplier penerima RFQ</CardDescription>
              </div>
              <ButtonMultiSelect
                v-if="!isReadOnly"
                title="Pilih Supplier"
                :disabled="!values.m_unit_bisnis_id"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_supplier`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    searchfield: 'kode_supplier,nama_supp,alamat_supp',
                    selectfield: 'id,kode_supplier,nama_supp,alamat_supp',
                    filter_column_is_active: 'true',
                    join: true,
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
                    field: 'kode_supplier',
                    headerName: 'Kode',
                    width: '200px',
                  },
                  {
                    field: 'nama_supp',
                    headerName: 'Nama Supplier',
                    width: '400px',
                  },
                  {
                    field: 'alamat_supp',
                    headerName: 'Alamat',
                    width: '400px',
                  },
                ]"
                @add="onAddSuppliers"
              >
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  class="pointer-events-none"
                  :disabled="!values.m_unit_bisnis_id"
                >
                  <Plus class="w-4 h-4 mr-2" />
                  Tambah Supplier
                </Button>
              </ButtonMultiSelect>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th class="px-3 py-3 text-left font-medium w-10">No</th>
                      <th class="px-3 py-3 text-left font-medium">Supplier</th>
                      <th class="px-3 py-3 text-left font-medium">Catatan</th>
                      <th class="px-3 py-3 text-center font-medium w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="supplierArr.length === 0">
                      <td
                        colspan="4"
                        class="text-center py-8 text-muted-foreground"
                      >
                        Belum ada supplier dipilih.
                      </td>
                    </tr>
                    <tr
                      v-for="(supp, index) in supplierArr"
                      :key="index"
                      class="border-t hover:bg-muted/30"
                    >
                      <td class="px-3 py-3">{{ index + 1 }}</td>
                      <td class="px-3 py-3">
                        <div class="font-medium">{{ supp.supplier_name }}</div>
                        <div class="text-xs text-muted-foreground">
                          {{ supp.supplier_code }}
                        </div>
                      </td>
                      <td class="px-3 py-3">
                        <input
                          type="text"
                          v-model="supp.catatan"
                          placeholder="Catatan..."
                          class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          :readonly="isReadOnly"
                        />
                      </td>
                      <td class="px-3 py-3 text-center">
                        <Button
                          v-if="!isReadOnly"
                          variant="ghost"
                          size="icon"
                          class="h-8 w-8 text-destructive"
                          @click="removeSupplier(index)"
                        >
                          <Trash2 class="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent v-if="isViewMode" value="comparison">
          <Card>
            <CardHeader>
              <CardTitle>Komparasi Quotation</CardTitle>
              <CardDescription
                >Perbandingan quotation dari supplier untuk setiap item
                RFQ</CardDescription
              >
            </CardHeader>
            <CardContent>
              <div
                v-if="loadingComparison"
                class="flex items-center justify-center py-8"
              >
                <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
              <div
                v-else-if="!comparisonData"
                class="text-center py-8 text-muted-foreground"
              >
                <p>Belum ada data komparasi quotation.</p>
                <Button
                  variant="outline"
                  size="sm"
                  class="mt-4"
                  @click="fetchComparisonData"
                >
                  <RefreshCw class="w-4 h-4 mr-2" />
                  Muat Data
                </Button>
              </div>
              <div v-else class="space-y-4">
                <div
                  v-if="allComparisonItemsBlocked"
                  class="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
                >
                  PR Sudah Send Ke PO
                </div>
                <!-- ── Global Search & Sort Toolbar ── -->
                <div class="rounded-lg border bg-muted/20 px-4 py-3 space-y-2">
                  <p
                    class="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                  >
                    Filter & Urutan Global
                  </p>
                  <div
                    class="flex flex-col sm:flex-row gap-2 items-start sm:items-center"
                  >
                    <!-- Global Search -->
                    <div class="relative flex-1 w-full">
                      <svg
                        class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803a7.5 7.5 0 0 0 10.607 0Z"
                        />
                      </svg>
                      <input
                        v-model="globalFilter.search"
                        type="text"
                        placeholder="Cari nama item atau kode item..."
                        class="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-8 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      <button
                        v-if="globalFilter.search"
                        @click="globalFilter.search = ''"
                        class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X class="h-4 w-4" />
                      </button>
                    </div>
                    <!-- Global Sort Buttons -->
                    <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                      <span
                        class="text-xs text-muted-foreground font-medium whitespace-nowrap"
                        >Urutkan:</span
                      >
                      <button
                        v-for="sort in [
                          { key: 'item_name', label: 'Nama Item' },
                          { key: 'item_code', label: 'Kode' },
                          { key: 'qty', label: 'Qty' },
                          { key: 'total_price', label: 'Total Harga' },
                          { key: 'supplier_count', label: 'Jml. Supplier' },
                        ] as const"
                        :key="sort.key"
                        @click="toggleGlobalSort(sort.key)"
                        class="inline-flex items-center gap-0.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors"
                        :class="
                          globalFilter.sortKey === sort.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-foreground border-input hover:bg-muted'
                        "
                      >
                        {{ sort.label }}
                        <span v-if="globalFilter.sortKey === sort.key">
                          {{ globalFilter.sortDir === "asc" ? "↑" : "↓" }}
                        </span>
                      </button>
                      <button
                        v-if="globalFilter.sortKey || globalFilter.search"
                        @click="resetGlobalFilter()"
                        class="inline-flex items-center gap-1 px-2 py-1.5 rounded-md border border-input bg-background text-xs text-muted-foreground hover:bg-muted transition-colors"
                        title="Reset filter global"
                      >
                        <X class="h-3 w-3" />
                        Reset
                      </button>
                    </div>
                  </div>
                  <!-- Result count -->
                  <p class="text-xs text-muted-foreground">
                    Menampilkan
                    <strong>{{ filteredComparisonItems.length }}</strong> dari
                    <strong>{{ comparisonData.items?.length || 0 }}</strong>
                    item
                  </p>
                </div>

                <!-- No global result -->
                <div
                  v-if="filteredComparisonItems.length === 0"
                  class="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg text-sm"
                >
                  Tidak ada item yang cocok dengan pencarian.
                </div>

                <!-- Loop through items -->
                <div
                  v-for="(item, idx) in filteredComparisonItems"
                  :key="item.rfq_items_d_id"
                  class="border rounded-lg overflow-hidden"
                  :class="{
                    'border-amber-500/30 bg-amber-500/5':
                      isComparisonItemBlocked(item),
                  }"
                >
                  <!-- Item Header -->
                  <div class="bg-muted px-4 py-3">
                    <div class="flex items-center justify-between">
                      <div>
                        <div class="flex flex-wrap items-center gap-2">
                          <p class="font-semibold">{{ item.item_name }}</p>
                          <span
                            v-if="isComparisonItemBlocked(item)"
                            class="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300"
                          >
                            PR Sudah Send Ke PO
                          </span>
                        </div>
                        <p class="text-sm text-muted-foreground">
                          {{ item.item_code }}
                        </p>
                        <p class="text-xs text-muted-foreground mt-1">
                          Outstanding PR:
                          <strong>{{
                            getComparisonItemOutstandingQty(item)
                          }}</strong>
                        </p>
                      </div>
                      <div class="text-right">
                        <p class="text-sm font-medium">Qty: {{ item.qty }}</p>
                      </div>
                    </div>
                  </div>

                  <!-- Per-item Search & Sort Toolbar -->
                  <div
                    class="flex flex-col sm:flex-row gap-2 mt-3 items-start sm:items-center"
                  >
                    <!-- Search -->
                    <div class="relative flex-1 w-full">
                      <svg
                        class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803a7.5 7.5 0 0 0 10.607 0Z"
                        />
                      </svg>
                      <input
                        :value="getItemFilterState(item.rfq_items_d_id).search"
                        @input="
                          getItemFilterState(item.rfq_items_d_id).search = (
                            $event.target as HTMLInputElement
                          ).value
                        "
                        type="text"
                        placeholder="Cari supplier atau no. SQ..."
                        class="flex h-8 w-full rounded-md border border-input/60 bg-background/80 pl-8 pr-7 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      <button
                        v-if="getItemFilterState(item.rfq_items_d_id).search"
                        @click="
                          getItemFilterState(item.rfq_items_d_id).search = ''
                        "
                        class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X class="h-3 w-3" />
                      </button>
                    </div>
                    <!-- Sort Buttons -->
                    <div class="flex items-center gap-1.5 shrink-0">
                      <span
                        class="text-xs text-muted-foreground font-medium whitespace-nowrap"
                        >Urutkan:</span
                      >
                      <button
                        v-for="sort in [
                          { key: 'harga', label: 'Harga' },
                          { key: 'supplier', label: 'Supplier' },
                          { key: 'qty', label: 'Min Qty' },
                          { key: 'date', label: 'Tanggal' },
                        ] as const"
                        :key="sort.key"
                        @click="toggleItemSort(item.rfq_items_d_id, sort.key)"
                        class="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors"
                        :class="
                          getItemFilterState(item.rfq_items_d_id).sortKey ===
                          sort.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background/80 text-foreground border-input/60 hover:bg-muted'
                        "
                      >
                        {{ sort.label }}
                        <span
                          v-if="
                            getItemFilterState(item.rfq_items_d_id).sortKey ===
                            sort.key
                          "
                        >
                          {{
                            getItemFilterState(item.rfq_items_d_id).sortDir ===
                            "asc"
                              ? "↑"
                              : "↓"
                          }}
                        </span>
                      </button>
                      <button
                        v-if="
                          getItemFilterState(item.rfq_items_d_id).sortKey ||
                          getItemFilterState(item.rfq_items_d_id).search
                        "
                        @click="resetItemFilter(item.rfq_items_d_id)"
                        class="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-input/60 bg-background/80 text-xs text-muted-foreground hover:bg-muted transition-colors"
                        title="Reset filter"
                      >
                        <X class="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <!-- Supplier Quotes Table -->
                  <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead class="bg-muted/50">
                        <tr>
                          <th
                            class="px-3 py-2 text-left font-medium text-xs"
                          >
                            Supplier
                          </th>
                          <th
                            class="px-3 py-2 text-left font-medium text-xs"
                          >
                            No. SQ
                          </th>
                          <th
                            class="px-3 py-2 text-right font-medium text-xs"
                          >
                            Price
                          </th>
                          <th
                            class="px-3 py-2 text-right font-medium text-xs"
                          >
                            Min Qty
                          </th>
                          <th
                            class="px-3 py-2 text-left font-medium text-xs"
                          >
                            Currency
                          </th>
                          <th
                            class="px-3 py-2 text-left font-medium text-xs"
                          >
                            Start Date
                          </th>
                          <th
                            class="px-3 py-2 text-left font-medium text-xs"
                          >
                            End Date
                          </th>
                          <th
                            class="px-3 py-2 text-center font-medium text-xs"
                          >
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="getFilteredQuotes(item).length === 0">
                          <td
                            colspan="8"
                            class="text-center py-4 text-muted-foreground text-xs"
                          >
                            {{
                              getItemFilterState(item.rfq_items_d_id).search
                                ? "Tidak ada quotation yang cocok dengan pencarian."
                                : "Belum ada quotation dari supplier"
                            }}
                          </td>
                        </tr>
                        <tr
                          v-for="(quote, qIdx) in getFilteredQuotes(item)"
                          :key="quote.supplier_quotation_d_id"
                          class="border-t hover:bg-muted/20"
                        >
                          <td class="px-3 py-2">
                            <div class="font-medium">
                              {{ quote.supplier_name }}
                            </div>
                          </td>
                          <td class="px-3 py-2">
                            {{ quote.no_supplier_quotation }}
                          </td>
                          <td class="px-3 py-2 text-right font-semibold">
                            {{ Number(quote.price).toLocaleString("id-ID") }}
                          </td>
                          <td class="px-3 py-2 text-right">
                            {{ quote.min_qty }}
                          </td>
                          <td class="px-3 py-2">{{ quote.currency }}</td>
                          <td class="px-3 py-2">
                            {{
                              quote.start_date
                                ? new Date(
                                    quote.start_date,
                                  ).toLocaleDateString("id-ID")
                                : "-"
                            }}
                          </td>
                          <td class="px-3 py-2">
                            {{
                              quote.end_date
                                ? new Date(
                                    quote.end_date,
                                  ).toLocaleDateString("id-ID")
                                : "-"
                            }}
                          </td>
                          <td class="px-3 py-2 text-center">
                            <span
                              class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                              :class="
                                quote.status === 'POST'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              "
                            >
                              {{ quote.status }}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <!-- Item Note if exists -->
                  <div
                    v-if="item.note"
                    class="px-4 py-2 bg-muted/30 text-xs text-muted-foreground border-t"
                  >
                    <strong>Catatan:</strong> {{ item.note }}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <!-- CUSTOM ADD ITEM DIALOG (Step 1: PR Selection, Step 2: Item Selection) -->
      <Teleport to="body">
        <div
          v-if="showAddDialog"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
          <div
            class="bg-background rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div
              class="px-6 py-4 border-b flex items-center justify-between"
            >
              <h2 class="text-lg font-bold">
                Pilih Item dari Purchase Request
              </h2>
              <Button
                variant="ghost"
                size="icon"
                @click="showAddDialog = false"
              >
                <X class="w-5 h-5" />
              </Button>
            </div>

            <div class="p-6 flex-1 overflow-y-auto space-y-6">
              <!-- Step 1: Select PR -->
              <div class="space-y-4">
                <div class="flex flex-col gap-4">
                  <div class="flex-1">
                    <p class="text-sm font-medium mb-2">
                      Pilih Purchase Request
                    </p>
                    <div class="border rounded-md h-100">
                      <TableSelectPagination
                        :api="prSelectionApi"
                        :columns="[
                          {
                            field: 'no_pr',
                            headerName: 'No PR',
                            width: '200px',
                          },
                          {
                            field: 'tgl_pr',
                            headerName: 'Tanggal',
                            width: '150px',
                          },
                          { field: 'catatan', headerName: 'Keterangan' },
                          {
                            field: 'status',
                            headerName: 'Status',
                            width: '100px',
                          },
                        ]"
                        @select="
                          (item: any) => onPrSelected(item.id, item)
                        "
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Step 2: Select Items -->
              <div v-if="selectedPrId" class="pt-4 border-t">
                <p class="mb-4 text-sm text-muted-foreground">
                  Purchase Request terpilih:
                  <strong>{{ selectedPrNo }}</strong>. Silakan klik tombol di
                  bawah untuk memilih item.
                </p>

                <div class="flex justify-end">
                  <ButtonMultiSelect
                    :key="prItemsKey"
                    title="Pilih Item"
                    @add="onAddItems"
                    :api="{
                      url: `${API_BASE_URL}/dynamic/t_purchase_request_d`,
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${authStore.token}`,
                      },
                      params: {
                        include: 'm_items,t_purchase_request,m_general',
                        filter_column_t_purchase_request_id: selectedPrId,
                        filter_column_qty_ots: 0,
                        filter_operator_qty_ots: '>',
                        join: true,
                        searchfield:
                          'm_items.kode_item,m_items.nama_item,catatan',
                        selectfield:
                          'id,t_purchase_request_id,m_items_id,qty_pr,catatan,uom_id,qty_ots',
                      },
                      onsuccess: (response: any) => {
                        if (!Array.isArray(response.data))
                          response.data = [];
                        response.data = response.data.map((d: any) => ({
                          ...d,
                          m_item: d.m_items || d.m_item,
                          prqd_uom: d.m_general || d.prqd_uom,
                        }));
                        return response;
                      },
                    }"
                    :columns="[
                      {
                        field: 'm_item.kode_item',
                        headerName: 'Kode',
                        width: '120px',
                        sortable: true,
                        filterable: true,
                        renderHtml: (item: any) => {
                          return item.m_item?.kode_item || '-';
                        },
                      },
                      {
                        field: 'm_item.nama_item',
                        headerName: 'Nama Item',
                        width: '250px',
                        sortable: true,
                        filterable: true,
                        renderHtml: (item: any) => {
                          return item.m_item?.nama_item || '-';
                        },
                      },
                      {
                        field: 'qty_pr',
                        headerName: 'Qty PR',
                        width: '100px',
                        sortable: false,
                      },
                      {
                        field: 'prqd_uom.value1',
                        headerName: 'UoM',
                        width: '80px',
                        sortable: false,
                        renderHtml: (item: any) => {
                          return item.prqd_uom?.value1 || '-';
                        },
                      },
                    ]"
                  />
                </div>
              </div>
              <div
                v-else
                class="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg"
              >
                Silakan pilih Purchase Request terlebih dahulu.
              </div>
            </div>
          </div>
        </div>
      </Teleport>

      <!-- GENERATE PO DIALOG -->
      <Teleport to="body">
        <div
          v-if="showGeneratePoDialog"
          class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
          <div
            class="bg-background rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div
              class="px-6 py-4 border-b flex items-center justify-between bg-muted/30"
            >
              <h2 class="text-lg font-bold">Generate PO dari Quotation</h2>
              <Button
                variant="ghost"
                size="icon"
                @click="showGeneratePoDialog = false"
              >
                <X class="w-5 h-5" />
              </Button>
            </div>

            <div class="p-6 flex-1 overflow-y-auto">
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th
                        class="px-3 py-3 text-left font-medium sticky left-0 bg-muted z-10 w-64 shadow-sm border-r"
                      >
                        Item
                      </th>
                      <th
                        v-for="supp in uniqueSuppliers"
                        :key="supp.id"
                        class="px-3 py-3 text-center font-medium min-w-50 border-r last:border-r-0"
                      >
                        {{ supp.name }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="!comparisonData?.items?.length">
                      <td
                        :colspan="(uniqueSuppliers?.length || 0) + 1"
                        class="text-center py-8 text-muted-foreground"
                      >
                        Belum ada data quotation
                      </td>
                    </tr>
                    <tr
                      v-for="item in comparisonData?.items || []"
                      :key="item.rfq_items_d_id"
                      class="border-t hover:bg-muted/10"
                    >
                      <td
                        class="px-3 py-4 sticky left-0 bg-background z-10 border-r align-top shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]"
                      >
                        <div class="font-medium text-base">
                          {{ item.item_name }}
                        </div>
                        <div class="text-xs text-muted-foreground mb-1">
                          {{ item.item_code }}
                        </div>
                        <div class="text-xs">
                          Qty RFQ: <strong>{{ item.qty }}</strong>
                        </div>
                        <div
                          class="text-xs text-muted-foreground"
                          v-if="selectedPoQuotes[item.rfq_items_d_id]"
                        >
                          Terpilih:
                          <strong>{{
                            selectedPoQuotes[item.rfq_items_d_id].supplier_name
                          }}</strong>
                        </div>
                        <div
                          v-if="isComparisonItemBlocked(item)"
                          class="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-700 dark:text-amber-300"
                        >
                          PR Sudah Send Ke PO
                          <div>
                            Outstanding PR:
                            {{ getComparisonItemOutstandingQty(item) }}
                          </div>
                        </div>
                      </td>
                      <td
                        v-for="supp in uniqueSuppliers"
                        :key="supp.id"
                        class="px-3 py-4 text-center align-top border-r last:border-r-0 transition-colors"
                        :class="{
                          'bg-primary/5':
                            selectedPoQuotes[item.rfq_items_d_id]
                              ?.supplier_quotation_id === supp.id,
                        }"
                      >
                        <template
                          v-if="getQuoteForItemAndSupplier(item, supp.id)"
                        >
                          <label
                            :for="`item_${item.rfq_items_d_id}_supp_${supp.id}`"
                            class="flex flex-col items-center justify-center p-3 rounded-lg border border-transparent space-y-2"
                            :class="
                              isComparisonItemBlocked(item)
                                ? 'cursor-not-allowed opacity-60'
                                : 'cursor-pointer hover:border-border'
                            "
                          >
                            <div
                              class="font-semibold text-lg"
                              :class="{
                                'text-primary':
                                  selectedPoQuotes[item.rfq_items_d_id]
                                    ?.supplier_quotation_id === supp.id,
                              }"
                            >
                              {{
                                getQuoteForItemAndSupplier(item, supp.id).money
                              }}
                              {{
                                Number(
                                  getQuoteForItemAndSupplier(item, supp.id)
                                    .price,
                                ).toLocaleString("id-ID")
                              }}
                            </div>
                            <div class="text-xs text-muted-foreground">
                              Min Qty:
                              {{
                                getQuoteForItemAndSupplier(item, supp.id)
                                  .min_qty
                              }}
                            </div>
                            <!-- Pilihan Radio -->
                            <div
                              class="pt-2 flex items-center justify-center"
                            >
                              <input
                                type="radio"
                                :id="`item_${item.rfq_items_d_id}_supp_${supp.id}`"
                                :name="`item_${item.rfq_items_d_id}`"
                                :value="
                                  getQuoteForItemAndSupplier(item, supp.id)
                                "
                                v-model="
                                  selectedPoQuotes[item.rfq_items_d_id]
                                "
                                :disabled="isComparisonItemBlocked(item)"
                                class="w-5 h-5 text-primary accent-primary border-input"
                                :class="{
                                  'cursor-not-allowed opacity-50':
                                    isComparisonItemBlocked(item),
                                  'cursor-pointer':
                                    !isComparisonItemBlocked(item),
                                }"
                              />
                            </div>
                            <div
                              v-if="isComparisonItemBlocked(item)"
                              class="text-[11px] text-amber-700 dark:text-amber-300 text-center"
                            >
                              Tidak bisa digenerate ke PO
                            </div>
                          </label>
                        </template>
                        <template v-else>
                          <div
                            class="flex items-center justify-center h-full"
                          >
                            <span class="text-muted-foreground text-xs"
                              >-</span
                            >
                          </div>
                        </template>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div
              class="px-6 py-4 border-t bg-muted/30 flex justify-end gap-3 rounded-b-xl"
            >
              <Button
                variant="outline"
                @click="showGeneratePoDialog = false"
                >Batal</Button
              >
              <Button
                @click="onGeneratePoSubmit"
                :disabled="loading || selectedEligiblePoQuotesCount === 0"
              >
                <Loader2 v-if="loading" class="w-4 h-4 mr-2 animate-spin" />
                <ShoppingCart v-else class="w-4 h-4 mr-2" />
                Generate PO
              </Button>
            </div>
          </div>
        </div>
      </Teleport>

      <AuditInfo
        v-if="(isViewMode || isEditMode) && !isCopyMode"
        :created-by="auditMeta.created_by"
        :created-at="auditMeta.createdAt"
        :updated-by="auditMeta.updated_by"
        :updated-at="auditMeta.updatedAt"
      />

      <!-- ACTION BUTTONS -->
      <div
        class="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-end sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t"
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
          v-if="
            isViewMode &&
            !(hasComparisonItems && allComparisonItemsBlocked)
          "
          type="button"
          @click="openGeneratePoDialog"
          :disabled="
            !comparisonData ||
            !comparisonData.items ||
            comparisonData.items.length === 0
          "
          class="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
        >
          <ShoppingCart class="w-4 h-4 mr-2" />
          Generate PO
        </Button>
        <div
          v-else-if="
            isViewMode && hasComparisonItems && allComparisonItemsBlocked
          "
          class="w-full sm:w-auto rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300"
        >
          PR Sudah Send Ke PO
        </div>
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
/* Scoped styles */
</style>