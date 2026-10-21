<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from '@/components/ui/textarea'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FieldX,
  FieldNumber,
  FieldPopup,
  FieldSelect,
  FieldStatus,
  FieldTextarea,
  FieldDate
} from "@/components/field";
import { ButtonMultiSelect, DeleteButton } from "@/components/button";
import HistoryDialog from "@/components/dialog/HistoryDialog.vue";
import {
  ArrowLeft,
  Save,
  Loader2,
  Trash2,
  ChevronDown,
  History,
  FileDown,
  Upload,
  ArrowLeftRight,
} from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createTPurchaseOrder,
  updateTPurchaseOrder,
  getTPurchaseOrderById,
  exportPurchaseOrderDetailExcel,
  importPurchaseOrderDetailExcel,
  getPrSisa,
  approveTPurchaseOrder,
  type TPurchaseOrderDetail,
} from "./service";
import AuditInfo from '@/components/AuditInfo.vue'

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
  () => !!route.params.id && route.name === "TPurchaseOrderForm",
);
const isViewMode = computed(() => route.name === "TPurchaseOrderView");
console.log(route.query);
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);

// ============================================================================
// SUPER ADMIN CHECK (konsisten dengan form lain)
// ============================================================================
const isSuperAdmin = computed(() => {
  const user = authStore.user;
  if (!user || !user.tipe) return false;
  return user.tipe.value1?.toUpperCase() === "SUPER ADMIN";
});

// ============================================================================
// UNIT BISNIS — Company display
// ============================================================================
// Untuk non-Super Admin: nama company dari SelectRespo (akun login)
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
// Hanya diisi & ditampilkan saat Super Admin memilih Unit Bisnis.
const selectedUnitBisnisCompanyName = ref<string>("");

const handleUnitBisnisSelected = (item: any) => {
  selectedUnitBisnisCompanyName.value =
    item?.m_company?.nama || item?.m_company?.kode || "";
};

// Untuk mode Edit/View/Copy: FieldSelect tidak emit valueFull saat load awal,
// ambil nama company via API sekali saja.
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

// ============================================================================
// PAGE META
// ============================================================================
const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Purchase Order";
  if (isCopyMode.value) return "Salin Purchase Order";
  if (isEditMode.value) return "Edit Purchase Order";
  return "Tambah Purchase Order Baru";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Purchase Order";
  if (isCopyMode.value) return "Buat Purchase Order baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Purchase Order";
  return "Buat Purchase Order baru";
});

// Form values
const values = reactive({
  no_po: "",
  tgl_po: new Date().toISOString().split("T")[0],
  status: "DRAFT",
  status_transaksi: "",
  is_import: false,
  no_pr:"",
  m_supplier_id: "",
  supplier_quotation_id: "",
  purchase_request_id: "",
  gudang_id: "",
  alamat_gudang: "",
  top_id: "",
  ppn_id: "dc697972-3785-4f50-98ff-dfa6a1f9d6fa", // Default: NON PPN
  pph_id: "", // PPH selection from m_general
  tipe_item_id: "",
  catatan: "",
  catatan_bonus: "",
  dp: 0,
  dp_persen: 0,
  m_currency_id: "",
  m_currency_d_id: "", // Active currency detail ID untuk exchange rate
  exchange_rate: 1, // Manual input exchange rate
  m_unit_bisnis_id: "",
  total: 0,
  total_diskon: 0,
  total_ppn: 0,
  total_pph: 0, // PPH calculation
  grand_total: 0,
  created_by: authStore.user?.id || authStore.user?.username || "",
  ekspedisi_id: "",
  need_biaya_kirim: false,
});

// Ref untuk menampilkan persentase PPN
const ppnPercentage = ref("0");

// Track PPN type: INCLUDE or EXCLUDE
const ppnType = ref<"INCLUDE" | "EXCLUDE">("EXCLUDE");

// PPH percentage (can be 0%, 2%, 3%, etc.)
const pphPercentage = ref("0");

// Track supplier tax status to enable/disable PPH and PPN fields
const supplierIsTax = ref(true);

// Track selected PR's is_rfq status
const selectedPrIsRfq = ref(false);
const supplierQuotationOptions = ref<any[]>([]);
const loadingSqOptions = ref(false);

// Flag: data diambil dari Supplier Quotation
const isFromSq = computed(() => !!values.supplier_quotation_id);

// Breakdown section toggle
const isBreakdownOpen = ref(false);

// Detail items interface
interface DetailItem {
  id?: string;
  t_purchase_order_id?: string;
  t_purchase_request_d_id?: string;
  m_items_id?: string;
  no_pr?: string;
  kode_item?: string;
  nama_item?: string;
  qty_pr?: number;
  satuan?: string;
  diminta_oleh?: string;
  prioritas?: string;
  catatan_item?: string;
  qty_po?: number;
  qty_ots?: number;
  qty_pr_ots?: number;
  harga?: number;
  sq_price?: number;
  disc_1?: number;
  disc_2?: number;
  disc_3?: number;
  amt_disc?: number;
  sub_total?: number;
  disc_total?: number;
  ppn_total?: number;
  pph_total?: number;
  total_stlh_pajak?: number;
  catatan?: string;
  created_by?: string;
  updated_by?: string;
}

// Audit info
const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

// Detail items
const detailItems = ref<DetailItem[]>([]);
const selectedItemIds = computed(() =>
  detailItems.value
    .map((item) => item.t_purchase_request_d_id)
    .filter((id): id is string => Boolean(id))
);

// Super Admin dialog state
const isSuperAdminDialogOpen = ref(false);

// Warning dialog for price over SQ price
const isOverSqPriceDialogOpen = ref(false);
const itemsWithLowerPo = ref<DetailItem[]>([]);
const itemsWithOverSqPrice = ref<DetailItem[]>([]);

// Track warning yang sudah ditampilkan untuk setiap item
const warningShownMap = new Map<number, boolean>();

// History dialog state
const isHistoryDialogOpen = ref(false);
const selectedItemForHistory = ref<DetailItem | null>(null);
const historyLoading = ref(false);
const historyHarga = ref<any[]>([]);
const historyStock = ref<any[]>([]);
const historyQuotation = ref<any[]>([]);

// Unit Conversion dialog state
const isConversionDialogOpen = ref(false);
const selectedItemForConversion = ref<DetailItem | null>(null);
const conversionLoading = ref(false);
const conversionData = ref<any[]>([]);

// Sisa PR data
const sisaPrData = ref<any[]>([]);

// ============================================================================
// COMPUTED TOTALS
// ============================================================================
const subtotal = computed(() => {
  return detailItems.value.reduce((sum, item) => {
    return sum + calculateLineSubtotal(item);
  }, 0);
});

const total = computed(() => {
  return subtotal.value - totalDiskon.value;
});

const totalDiskon = computed(() => {
  return detailItems.value.reduce((sum, item) => {
    const qty = item.qty_po || 0;
    const price = item.harga || 0;
    const disc1 = item.disc_1 || 0;
    const disc2 = item.disc_2 || 0;
    const disc3 = item.disc_3 || 0;
    const line = qty * price;
    const discAmount1 = line * (disc1 / 100);
    const afterDisc1 = line - discAmount1;
    const discAmount2 = afterDisc1 * (disc2 / 100);
    const afterDisc2 = afterDisc1 - discAmount2;
    const discAmount3 = afterDisc2 * (disc3 / 100);
    const manualDisc = item.amt_disc || 0;
    return sum + discAmount1 + discAmount2 + discAmount3 + manualDisc;
  }, 0);
});

const totalPpn = computed(() => {
  const rate = Number(ppnPercentage.value || "0") / 100;
  if (rate === 0) return 0;
  if (ppnType.value === "INCLUDE") {
    return (total.value / (1 + rate)) * rate;
  }
  return total.value * rate;
});

const totalPph = computed(() => {
  const rate = Number(pphPercentage.value || "0") / 100;
  if (rate === 0) return 0;
  const ppnRate = Number(ppnPercentage.value || "0") / 100;
  const baseAmount =
    ppnType.value === "INCLUDE" && ppnRate > 0
      ? total.value / (1 + ppnRate)
      : total.value;
  return baseAmount * rate;
});

const grandTotal = computed(() => {
  const rate = Number(ppnPercentage.value || "0") / 100;
  if (ppnType.value === "INCLUDE" && rate > 0) {
    return total.value - totalPph.value;
  }
  return total.value + totalPpn.value - totalPph.value;
});

// ============================================================================
// CURRENCY & EXCHANGE RATE
// ============================================================================
const selectedCurrencyData = ref<any>(null);

const currencySymbol = computed(() => {
  const code = selectedCurrencyData.value?.money?.value5 || "IDR";
  const name = selectedCurrencyData.value?.money?.value1 || "Indonesian Rupiah";
  if (code === "IDR" || code === "Rupiah" || name.toLowerCase().includes("rupiah")) {
    return "Rp";
  }
  return selectedCurrencyData.value?.money?.value2 || "Rp";
});
const currencyName = computed(
  () => selectedCurrencyData.value?.money?.value1 || "Indonesian Rupiah",
);
const currencyCode = computed(
  () => selectedCurrencyData.value?.money?.value5 || "IDR",
);

const isCurrencyFromSavedPO = ref(false);
let initialCurrencyId = "";

const getDetailTipeItemId = (detail: any): string => {
  return (
    detail?.m_item?.mi_tipe?.id ||
    detail?.m_item?.tipe_id ||
    detail?.m_item?.mi_tipe_id ||
    detail?.m_items?.mi_tipe?.id ||
    detail?.m_items?.tipe_id ||
    detail?.m_items?.mi_tipe_id ||
    detail?.t_purchase_request_d?.m_item?.mi_tipe?.id ||
    detail?.t_purchase_request_d?.m_item?.tipe_id ||
    detail?.t_purchase_request_d?.m_item?.mi_tipe_id ||
    detail?.t_purchase_request_d?.m_items?.mi_tipe?.id ||
    detail?.t_purchase_request_d?.m_items?.tipe_id ||
    detail?.t_purchase_request_d?.m_items?.mi_tipe_id ||
    detail?.tipe_item?.id ||
    detail?.tipe_item_id ||
    ""
  );
};

const fetchTipeItemIdByItemId = async (itemId: string): Promise<string> => {
  if (!itemId) return "";
  try {
    const response = await fetch(`${API_BASE_URL}/dynamic/m_items/${itemId}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authStore.token}`,
      },
    });
    const result = await response.json();
    if (result?.status === "success" && result?.data) {
      return (
        result.data?.mi_tipe?.id ||
        result.data?.tipe_id ||
        result.data?.mi_tipe_id ||
        ""
      );
    }
  } catch (error) {
    console.error("Failed to fetch tipe item from m_items:", error);
  }
  return "";
};

const exchangeRateDisplay = computed(() => {
  if (values.exchange_rate && values.exchange_rate > 0) {
    return values.exchange_rate;
  }
  if (selectedCurrencyData.value?.m_currency_ds?.length > 0) {
    if (isCurrencyFromSavedPO.value) {
      return Number(selectedCurrencyData.value.m_currency_ds[0].rate) || 1;
    }
    const activeRate = selectedCurrencyData.value.m_currency_ds.find(
      (d: any) => d.is_active === true,
    );
    if (activeRate) return Number(activeRate.rate) || 1;
    return Number(selectedCurrencyData.value.m_currency_ds[0].rate) || 1;
  }
  return 1;
});

const exchangeRateDateTime = computed(() => {
  if (selectedCurrencyData.value?.m_currency_ds?.length > 0) {
    const rateData = selectedCurrencyData.value.m_currency_ds[0];
    const date = new Date(rateData.tgl_mulai);
    const dateStr = date.toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric" });
    const timeStr = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    return `${dateStr} ${timeStr}`;
  }
  const now = new Date();
  return `${now.toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric" })} ${now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;
});

const activeCurrencyDetailId = computed(() => {
  if (selectedCurrencyData.value?.m_currency_ds?.length > 0) {
    const activeDetail = selectedCurrencyData.value.m_currency_ds.find(
      (d: any) => d.is_active === true,
    );
    return activeDetail?.id || selectedCurrencyData.value.m_currency_ds[0]?.id || null;
  }
  return null;
});

const formatCurrency = (amount: number): string => {
  const formatted = amount.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${currencySymbol.value} ${formatted}`;
};

const isCurrencyRupiah = computed(() => {
  return (
    !values.m_currency_id ||
    currencyCode.value === "IDR" ||
    currencyCode.value === "Rupiah" ||
    currencyName.value.toLowerCase().includes("rupiah")
  );
});

const exchangeRate = computed(() => exchangeRateDisplay.value);

const handleExchangeRateChange = (value: any) => {
  const numValue = Number(value) || 1;
  values.exchange_rate = numValue <= 0 ? 1 : numValue;
};

const handlePphPercentageChange = (value: any) => {
  const numValue = Number(value) || 0;
  pphPercentage.value = String(numValue);
};

// ============================================================================
// SUPPLIER TYPE ID MAPPING
// ============================================================================
const supplierTipeSuppParams = computed(() => ({
  "filter_column_tipe_supp.group": "TIPE SUPPLIER",
  "filter_column_tipe_supp.value1": values.is_import ? "LUAR" : "LOKAL",
}));

// ============================================================================
// DP CALCULATION
// ============================================================================
const handleDpNominalChange = (value: any) => {
  const numValue = Number(value) || 0;
  values.dp = numValue;
  if (grandTotal.value && grandTotal.value > 0) {
    values.dp_persen = Number(((numValue / grandTotal.value) * 100).toFixed(2));
  } else {
    values.dp_persen = 0;
  }
};

const handleDpPersenChange = (value: any) => {
  const numValue = Number(value) || 0;
  values.dp_persen = numValue;
  if (grandTotal.value && grandTotal.value > 0) {
    values.dp = Math.round((grandTotal.value * numValue) / 100);
  } else {
    values.dp = 0;
  }
};

watch(grandTotal, (newTotal) => {
  if (newTotal > 0 && values.dp > 0) {
    values.dp_persen = Number(((values.dp / newTotal) * 100).toFixed(2));
  } else if (newTotal === 0) {
    values.dp_persen = 0;
  }
});

const gudangApiConfig = computed(() => ({
  url: `${API_BASE_URL}/dynamic/m_gudang`,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authStore.token}`,
  },
  params: {
    searchfield: "nama_gudang,kode_gudang",
    filter_column_is_active: true,
    ...(values.m_unit_bisnis_id
      ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id }
      : {}),
  },
  onsuccess: (response: any) => {
    response.hasNext = response.pagination?.next_page ? true : false;
    return response;
  },
}));

// ============================================================================
// LINE CALCULATION HELPERS
// ============================================================================
const calculateLineSubtotal = (item: DetailItem): number => {
  return (item.qty_po || 0) * (item.harga || 0);
};

const calculateLineDiscount = (item: DetailItem): number => {
  const qty = item.qty_po || 0;
  const price = item.harga || 0;
  const line = qty * price;
  const d1 = line * ((item.disc_1 || 0) / 100);
  const d2 = (line - d1) * ((item.disc_2 || 0) / 100);
  const d3 = (line - d1 - d2) * ((item.disc_3 || 0) / 100);
  return d1 + d2 + d3 + (item.amt_disc || 0);
};

const calculateLineTotal = (item: DetailItem): number => {
  return calculateLineSubtotal(item) - calculateLineDiscount(item);
};

const calculateLinePpn = (item: DetailItem): number => {
  const lineTotal = calculateLineTotal(item);
  const rate = Number(ppnPercentage.value || "0") / 100;
  if (rate === 0) return 0;
  if (ppnType.value === "INCLUDE") return (lineTotal / (1 + rate)) * rate;
  return lineTotal * rate;
};

const calculateLinePph = (item: DetailItem): number => {
  const lineTotal = calculateLineTotal(item);
  const rate = Number(pphPercentage.value || "0") / 100;
  if (rate === 0) return 0;
  const ppnRate = Number(ppnPercentage.value || "0") / 100;
  const baseAmount =
    ppnType.value === "INCLUDE" && ppnRate > 0
      ? lineTotal / (1 + ppnRate)
      : lineTotal;
  return baseAmount * rate;
};

const calculateLineGrandTotal = (item: DetailItem): number => {
  const lineTotal = calculateLineTotal(item);
  const linePpn = calculateLinePpn(item);
  const linePph = calculateLinePph(item);
  const rate = Number(ppnPercentage.value || "0") / 100;
  if (ppnType.value === "INCLUDE" && rate > 0) return lineTotal - linePph;
  return lineTotal + linePpn - linePph;
};

// ============================================================================
// SISA PR METHODS
// ============================================================================
const fetchSisaPrData = async () => {
  if (!values.purchase_request_id) {
    sisaPrData.value = [];
    return;
  }
  try {
    const excludeId = isEditMode.value ? menuId.value : undefined;
    const res = await getPrSisa(values.purchase_request_id, excludeId, true);
    if (res.status === "success") {
      sisaPrData.value = res.data;
    }
  } catch (error) {
    console.error("Failed to fetch sisa PR:", error);
    sisaPrData.value = [];
  }
};

const getSisaQty = (item: DetailItem): number => {
  if (item.qty_pr_ots !== undefined && item.qty_pr_ots !== null) {
    return Number(item.qty_pr_ots) || 0;
  }
  const sisa = sisaPrData.value.find(
    (s: any) => s.m_items_id === item.m_items_id,
  );
  if (sisa?.qty_outstanding !== undefined && sisa?.qty_outstanding !== null) {
    return Number(sisa.qty_outstanding) || 0;
  }
  if (sisa?.sisa_pr !== undefined && sisa?.sisa_pr !== null) {
    return Number(sisa.sisa_pr) || 0;
  }
  return Number(item.qty_pr) || 0;
};

const getDisplaySisaPr = (item: DetailItem): number => {
  const base = getSisaQty(item);
  if (isReadOnly.value) return base;
  const remaining = base - (Number(item.qty_po) || 0);
  return remaining >= 0 ? remaining : 0;
};

const getSisaQtyFromRaw = (item: any): number => {
  if (item.qty_pr_ots !== undefined && item.qty_pr_ots !== null) return Number(item.qty_pr_ots) || 0;
  if (item.qty_outstanding !== undefined && item.qty_outstanding !== null) return Number(item.qty_outstanding) || 0;
  const sisa = sisaPrData.value.find((s: any) => s.m_items_id === item.m_items_id);
  if (sisa?.qty_outstanding !== undefined && sisa?.qty_outstanding !== null) return Number(sisa.qty_outstanding) || 0;
  if (sisa?.sisa_pr !== undefined && sisa?.sisa_pr !== null) return Number(sisa.sisa_pr) || 0;
  return Number(item.qty_pr) || 0;
};

const getInitialQtyPo = (item: any): number => {
  const sisa = getSisaQtyFromRaw(item);
  const qtyPr = item.qty_pr || 0;
  return sisa < qtyPr ? sisa : qtyPr;
};

const normalizePrSisaItem = (item: any) => {
  const dottedMItem = {
    id: item?.["m_item.id"] || null,
    kode_item: item?.["m_item.kode_item"] || "-",
    nama_item: item?.["m_item.nama_item"] || "-",
    mi_tipe: item?.["m_item.mi_tipe.id"]
      ? { id: item?.["m_item.mi_tipe.id"] || "", value1: item?.["m_item.mi_tipe.value1"] || "-" }
      : undefined,
    mi_uom: item?.["m_item.mi_uom.value1"]
      ? { value1: item?.["m_item.mi_uom.value1"] }
      : undefined,
  };
  const dottedPr = item?.["t_purchase_request.id"]
    ? {
        id: item?.["t_purchase_request.id"],
        no_pr: item?.["t_purchase_request.no_pr"] || "-",
        req_type_user: item?.["t_purchase_request.req_type_user"] || "",
        req_user_by: item?.["t_purchase_request.req_user_by"] || "",
      }
    : {};
  const dottedUom = item?.["prqd_uom.value1"]
    ? { id: item?.["prqd_uom.id"] || null, value1: item?.["prqd_uom.value1"] }
    : undefined;
  const normalizedId =
    item?.id || item?.t_purchase_request_d_id || item?.purchase_request_detail_id || item?.t_pr_d_id || null;
  const normalizedItem =
    item?.m_item || item?.m_items || dottedMItem || {
      id: item?.m_items_id || item?.m_item_id || null,
      kode_item: item?.kode_item || "-",
      nama_item: item?.nama_item || "-",
      mi_tipe: item?.mi_tipe || item?.tipe_item || (item?.tipe_item_id || item?.tipe_item_name
        ? { id: item?.tipe_item_id || item?.tipe_item?.id || "", value1: item?.tipe_item_name || item?.tipe_item?.value1 || "-" }
        : undefined),
      mi_uom: item?.mi_uom || item?.prqd_uom || (item?.satuan ? { value1: item.satuan } : undefined),
    };
  const normalizedPr =
    item?.t_purchase_request || dottedPr || (item?.no_pr || item?.req_type_user || item?.req_user_by || item?.prioritas
      ? {
          no_pr: item?.no_pr || "-",
          req_type_user: item?.req_type_user || "",
          req_user_by: item?.req_user_by || "",
          m_general: item?.prioritas ? { value1: item.prioritas } : undefined,
        }
      : {});
  const normalizedUom =
    item?.prqd_uom || dottedUom || item?.uom || item?.m_item?.mi_uom || item?.m_items?.mi_uom ||
    (item?.satuan ? { value1: item.satuan } : undefined);
  return {
    ...item,
    id: normalizedId,
    t_purchase_request_d_id: normalizedId,
    m_items_id: item?.m_items_id || normalizedItem?.id || item?.m_item_id || null,
    qty_pr: Number(item?.qty_pr || 0),
    qty_pr_ots:
      item?.qty_pr_ots !== undefined && item?.qty_pr_ots !== null ? Number(item.qty_pr_ots) || 0
      : item?.qty_outstanding !== undefined && item?.qty_outstanding !== null ? Number(item.qty_outstanding) || 0
      : item?.sisa_pr !== undefined && item?.sisa_pr !== null ? Number(item.sisa_pr) || 0
      : 0,
    qty_outstanding:
      item?.qty_outstanding !== undefined && item?.qty_outstanding !== null ? Number(item.qty_outstanding) || 0
      : item?.qty_pr_ots !== undefined && item?.qty_pr_ots !== null ? Number(item.qty_pr_ots) || 0
      : item?.sisa_pr !== undefined && item?.sisa_pr !== null ? Number(item.sisa_pr) || 0
      : 0,
    m_item: normalizedItem,
    t_purchase_request: normalizedPr,
    prqd_uom: normalizedUom,
    catatan: item?.catatan || item?.catatan_item || "",
  };
};

const getPrSisaPopupParams = () => ({
  purchase_request_id: values.purchase_request_id,
  exclude_zero: true,
  ...(isEditMode.value && menuId.value ? { exclude_po_id: menuId.value } : {}),
});

const filterSisaItems = (data: any[]): any[] => {
  return data.filter((item: any) => getSisaQtyFromRaw(item) !== 0);
};

const renderSisaPrHtml = (item: any): string => {
  const sisa = getSisaQtyFromRaw(item);
  const color = sisa !== 0 ? "#22c55e" : "#ef4444";
  return `<span style="color: ${color}; font-weight: 600">${sisa}</span>`;
};

// ============================================================================
// DETAIL METHODS
// ============================================================================
const removeDetailItem = (index: number) => {
  detailItems.value.splice(index, 1);
  toast.info("Detail item dihapus");
};

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    no_po: "",
    tgl_po: new Date().toISOString().split("T")[0],
    status: "DRAFT",
    status_transaksi: "",
    is_import: false,
    m_supplier_id: "",
    supplier_quotation_id: "",
    purchase_request_id: "",
    gudang_id: "",
    alamat_gudang: "",
    top_id: "",
    ppn_id: "dc697972-3785-4f50-98ff-dfa6a1f9d6fa",
    pph_id: "",
    tipe_item_id: null,
    catatan: "",
    catatan_bonus: "",
    dp: 0,
    m_currency_id: "",
    m_currency_d_id: "",
    exchange_rate: 1,
    m_unit_bisnis_id: "",
    total: 0,
    total_diskon: 0,
    total_ppn: 0,
    total_pph: 0,
    grand_total: 0,
    created_by: authStore.user?.id || authStore.user?.username || "",
    ekspedisi_id: "",
    need_biaya_kirim: false,
  });
  detailItems.value = [];
  ppnPercentage.value = "0";
  pphPercentage.value = "0";
  selectedPrIsRfq.value = false;
  supplierQuotationOptions.value = [];
  selectedUnitBisnisCompanyName.value = "";
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });
};

// ============================================================================
// CURRENCY DATA FETCHING
// ============================================================================
const DEFAULT_CURRENCY_ID = "32a9973a-29cd-4eaf-9849-0175d0542f81";

const fetchCurrencyData = async (currencyId: string) => {
  if (!currencyId) {
    selectedCurrencyData.value = null;
    return;
  }
  try {
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_currency/${currencyId}?include=m_currency_d,money`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    const result = await response.json();
    if (result.status === "success") {
      selectedCurrencyData.value = result.data;
      if (activeCurrencyDetailId.value) {
        values.m_currency_d_id = activeCurrencyDetailId.value;
      }
      if (!values.exchange_rate || values.exchange_rate === 1) {
        const activeRate = result.data.m_currency_ds?.find((d: any) => d.is_active === true);
        values.exchange_rate = activeRate ? Number(activeRate.rate) || 1 : 1;
      }
    }
  } catch (error) {
    console.error("Failed to fetch currency data:", error);
  }
};

const fetchDefaultIDRCurrency = async () => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_currency?no_pagination=true&join=true&filter_column_money.code=IDR`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    const result = await response.json();
    if (result.status === "success" && Array.isArray(result.data) && result.data.length > 0) {
      const idrCurrency = result.data[0];
      values.m_currency_id = idrCurrency.id;
      selectedCurrencyData.value = idrCurrency;
      const activeDetail =
        idrCurrency.m_currency_ds?.find((detail: any) => detail.is_active === true) ||
        idrCurrency.m_currency_ds?.[0];
      values.m_currency_d_id = activeDetail?.id || "";
      values.exchange_rate = activeDetail ? Number(activeDetail.rate) || 1 : 1;
      return;
    }
  } catch (error) {
    console.error("Failed to fetch default IDR currency:", error);
  }
  values.m_currency_id = DEFAULT_CURRENCY_ID;
  await fetchCurrencyData(DEFAULT_CURRENCY_ID);
};

watch(
  () => values.m_currency_id,
  (newCurrencyId) => {
    if (isEditMode.value && newCurrencyId !== initialCurrencyId) {
      isCurrencyFromSavedPO.value = false;
      fetchCurrencyData(newCurrencyId);
      return;
    }
    if ((isEditMode.value || isViewMode.value) && isCurrencyFromSavedPO.value) return;
    fetchCurrencyData(newCurrencyId);
  },
);

// Watch m_unit_bisnis_id: saat Super Admin ubah Unit Bisnis, reset gudang
watch(
  () => values.m_unit_bisnis_id,
  (newVal, oldVal) => {
    if (oldVal && newVal !== oldVal) {
      values.gudang_id = "";
      values.alamat_gudang = "";
    }
  },
);

watch(
  () => values.is_import,
  (newVal) => {
    if (newVal) values.need_biaya_kirim = true;
    if (isEditMode.value || isViewMode.value || isCopyMode.value) return;
    values.m_supplier_id = "";
    values.top_id = "";
    values.m_currency_id = "";
    supplierIsTax.value = true;
    selectedCurrencyData.value = null;
  },
);

// ============================================================================
// LIFECYCLE HOOKS - LOAD DATA BEFORE MOUNT
// ============================================================================
onBeforeMount(async () => {
  onReset();

  // Non-Super Admin: auto-fill Unit Bisnis dari SelectRespo
  if (!isSuperAdmin.value) {
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

  const isCopyModeLocal = route.query.action === "copy" && route.query.source;
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value;

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    if (!values.m_currency_id) await fetchDefaultIDRCurrency();
    return;
  }

  loading.value = true;
  try {
    const res = await getTPurchaseOrderById(sourceId);
    if (res.status !== "success") throw new Error("Gagal memuat data");
    const initialValues: Record<string, any> = res.data;

    auditMeta.value = {
      created_by: initialValues.created_by,
      createdAt: initialValues.createdAt,
      updated_by: initialValues.update_by || initialValues.updated_by,
      updatedAt: initialValues.updatedAt,
    };

    // Load detail items
    if (initialValues.t_purchase_order_ds) {
      detailItems.value = initialValues.t_purchase_order_ds.map((detail: any) => ({
        id: detail.id,
        t_purchase_order_id: detail.t_purchase_order_id,
        t_purchase_request_d_id: detail.t_purchase_request_d_id,
        m_items_id: detail.m_items_id,
        no_pr: initialValues.t_purchase_request?.no_pr || detail.t_purchase_request_d?.t_purchase_request?.no_pr || detail.no_pr || "-",
        kode_item: detail.m_item?.kode_item || detail.kode_item || "-",
        nama_item: detail.m_item?.nama_item || detail.nama_item || "-",
        qty_pr: detail.t_purchase_request_d?.qty_pr || detail.qty_pr || 0,
        satuan: detail.t_purchase_request_d?.prqd_uom?.value1 || detail.uom || detail.satuan || detail.m_item?.uom?.value1 || "-",
        diminta_oleh: initialValues.t_purchase_request?.req_user_by || detail.diminta_oleh || "-",
        prioritas: initialValues.t_purchase_request?.prioritas || detail.prioritas || "-",
        catatan_item: detail.t_purchase_request_d?.catatan || detail.alasan || detail.catatan_item || "",
        qty_po: detail.qty_po,
        qty_ots: detail.qty_ots !== undefined && detail.qty_ots !== null ? parseFloat(detail.qty_ots) : undefined,
        qty_pr_ots: detail.qty_pr_ots !== undefined && detail.qty_pr_ots !== null ? parseFloat(detail.qty_pr_ots) : undefined,
        harga: parseFloat(detail.harga || "0"),
        sq_price: detail.sq_price ? parseFloat(detail.sq_price) : undefined,
        disc_1: parseFloat(detail.disc_1 || "0"),
        disc_2: parseFloat(detail.disc_2 || "0"),
        disc_3: parseFloat(detail.disc_3 || "0"),
        amt_disc: parseFloat(detail.amt_disc || "0"),
        sub_total: parseFloat(detail.sub_total || "0"),
        disc_total: parseFloat(detail.disc_total || "0"),
        ppn_total: parseFloat(detail.ppn_total || "0"),
        pph_total: parseFloat(detail.pph_total || "0"),
        total_stlh_pajak: parseFloat(detail.total_stlh_pajak || "0"),
        catatan: detail.catatan || "",
        created_by: detail.created_by || "",
        updated_by: detail.updated_by || "",
      }));
    }

    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
      if (detailItems.value.length > 0) {
        detailItems.value = detailItems.value.map((item) => ({
          ...item,
          id: undefined,
          t_purchase_order_id: undefined,
          created_by: authStore.user?.id || authStore.user?.username || "",
          updated_by: "",
        }));
      }
    }

    // Assign values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        if (key === "tgl_po" && !initialValues[key]) {
          (values as any)[key] = new Date().toISOString().split("T")[0];
        } else {
          (values as any)[key] = initialValues[key];
        }
      }
    }

    values.m_supplier_id = initialValues.m_supplier_id || "";
    values.supplier_quotation_id = initialValues.supplier_quotation_id || "";
    values.purchase_request_id = initialValues.purchase_request_id || "";
    values.no_pr = initialValues.t_purchase_request?.no_pr || "";

    if (values.dp && grandTotal.value > 0) {
      values.dp_persen = Number(((values.dp / grandTotal.value) * 100).toFixed(2));
    }
    values.gudang_id = initialValues.gudang_id || "";
    values.alamat_gudang = initialValues.m_gudang?.alamat_gudang || values.alamat_gudang || "";
    values.top_id = initialValues.top_id || "";
    values.ppn_id = initialValues.ppn_id || "dc697972-3785-4f50-98ff-dfa6a1f9d6fa";
    values.pph_id = initialValues.pph_id || "";
    values.m_currency_id = initialValues.m_currency_id || "32a9973a-29cd-4eaf-9849-0175d0542f81";
    values.ekspedisi_id = initialValues.ekspedisi_id || "";
    values.m_currency_d_id = initialValues.m_currency_d_id || "";
    values.exchange_rate = initialValues.exchange_rate || 1;
    values.tipe_item_id = initialValues.tipe_item_id || "";
    values.status_transaksi = initialValues.status_transaksi || "";
    values.is_import = initialValues.is_import === true;

    // Super Admin: ambil nama company dari Unit Bisnis yang tersimpan
    if (isSuperAdmin.value && values.m_unit_bisnis_id) {
      fetchUnitBisnisCompanyName(values.m_unit_bisnis_id);
    }

    // Jika m_unit_bisnis_id null dan non-super-admin, gunakan dari SelectRespo
    if (!values.m_unit_bisnis_id && !isSuperAdmin.value) {
      try {
        const selectRespo = localStorage.getItem("SelectRespo");
        if (selectRespo) {
          const parsed = JSON.parse(selectRespo);
          if (parsed.companyId) values.m_unit_bisnis_id = parsed.companyId;
        }
      } catch {
        // ignore
      }
    }

    // Auto-detect tipe_item_id dari detail jika kosong
    if (isEditMode.value && !values.tipe_item_id && initialValues.t_purchase_order_ds?.length > 0) {
      const firstTipeItemId = initialValues.t_purchase_order_ds
        .map((detail: any) => getDetailTipeItemId(detail))
        .find((id: string) => !!id);
      if (firstTipeItemId) {
        values.tipe_item_id = firstTipeItemId;
      } else {
        const firstItemId = initialValues.t_purchase_order_ds
          .map((detail: any) => detail?.m_items_id || detail?.m_item_id || "")
          .find((id: string) => !!id);
        if (firstItemId) {
          const tipeFromItem = await fetchTipeItemIdByItemId(firstItemId);
          if (tipeFromItem) values.tipe_item_id = tipeFromItem;
        }
      }
    }

    initialCurrencyId = values.m_currency_id;

    if (initialValues.persen_pph !== undefined && initialValues.persen_pph !== null) {
      pphPercentage.value = String(initialValues.persen_pph || "0");
    } else if (initialValues.pph_percentage) {
      pphPercentage.value = String(initialValues.pph_percentage || "0");
    }

    if (values.purchase_request_id) {
      try {
        const prRes = await fetch(
          `${API_BASE_URL}/dynamic/t_purchase_request/${values.purchase_request_id}?selectfield=id,is_rfq`,
          {
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${authStore.token}` },
          },
        );
        const prData = await prRes.json();
        if (prData.status === "success" && prData.data) {
          selectedPrIsRfq.value = prData.data.is_rfq === true;
          if (prData.data.is_rfq) {
            await fetchSupplierQuotationOptions(values.purchase_request_id, values.m_supplier_id);
          } else if (initialValues.supplier_quotation_id && values.m_supplier_id) {
            selectedPrIsRfq.value = true;
            await fetchSupplierQuotationOptions("", values.m_supplier_id);
          }
          if (initialValues.supplier_quotation_id) {
            values.supplier_quotation_id = initialValues.supplier_quotation_id;
          }
        }
      } catch (e) {
        console.error("Failed to load PR is_rfq status:", e);
      }
    }

    if (initialValues.ppn_po) {
      ppnPercentage.value = initialValues.ppn_po.value3 || "0";
      ppnType.value = (initialValues.ppn_po.value4 as "INCLUDE" | "EXCLUDE") || "EXCLUDE";
    }

    if (initialValues.m_supplier) {
      supplierIsTax.value = initialValues.m_supplier.is_tax !== false;
    }

    // Load currency dari saved PO
    if (values.m_currency_id) {
      if (initialValues.det_uang_po && initialValues.uang_po) {
        isCurrencyFromSavedPO.value = true;
        selectedCurrencyData.value = {
          id: initialValues.uang_po.id,
          kode_currency: initialValues.uang_po.kode_currency,
          nama_currency: initialValues.uang_po.nama_currency,
          money: initialValues.uang_po.money,
          m_currency_ds: [{
            id: initialValues.det_uang_po.id,
            tgl_mulai: initialValues.det_uang_po.tgl_mulai,
            rate: initialValues.det_uang_po.rate,
            is_active: initialValues.det_uang_po.is_active,
          }],
        };
      } else {
        isCurrencyFromSavedPO.value = false;
        await fetchCurrencyData(values.m_currency_id);
      }
    }

    if (values.purchase_request_id) {
      await fetchSisaPrData();
    }

    if (isCopyModeLocal) {
      toast.success("Data berhasil disalin", {
        description: "Silakan edit dan simpan sebagai Purchase Order baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Purchase Order", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () => router.push("/purchasing/transaksi/t_purchase_order"),
      },
    });
    setTimeout(() => router.push("/purchasing/transaksi/t_purchase_order"), 2000);
  } finally {
    loading.value = false;
  }
});

// Errors object
const errors = reactive({
  m_supplier_id: "",
  top_id: "",
  ppn_id: "",
  pph_id: "",
  tipe_item: "",
  ekspedisi_id: "",
});

// ============================================================================
// QTY & HARGA VALIDATION
// ============================================================================
const hargaOverSqWarningMap = new Map<number, boolean>();

const handleQtyPoChange = (item: DetailItem, value: any, itemIndex: number) => {
  const v = value === "" || value == null ? 0 : Number(value);
  if (!isNaN(v) && v < 1) {
    item.qty_po = 1;
    toast.warning("Qty PO tidak boleh 0 atau minus", {
      description: `${item.nama_item || "Item"}: Qty PO minimal 1`,
      duration: 3000,
    });
    return;
  }
  const sisaQty = getSisaQty(item);
  if (!isNaN(v) && v > sisaQty) {
    item.qty_po = sisaQty;
    toast.warning(`Qty PO melebihi Sisa PR`, {
      description: `${item.nama_item || "Item"}: Qty dikembalikan ke maksimal Sisa PR (${sisaQty})`,
      duration: 4000,
    });
    warningShownMap.delete(itemIndex);
    return;
  }
  item.qty_po = isNaN(v) ? 0 : v;
  const qtyPo = item.qty_po || 0;
  const qtyPr = item.qty_pr || 0;
  if (qtyPo >= qtyPr) { warningShownMap.delete(itemIndex); return; }
  if (qtyPo < qtyPr && qtyPo > 0 && !warningShownMap.has(itemIndex)) {
    toast.warning(`Qty PO lebih kecil dari PR`, {
      description: `${item.nama_item || "Item"}: Qty PO (${qtyPo}) < Qty PR (${qtyPr}). Selisih: ${qtyPr - qtyPo}`,
      duration: 3000,
    });
    warningShownMap.set(itemIndex, true);
  }
};

const handleHargaChange = (item: DetailItem, value: any, itemIndex: number) => {
  const v = value === "" || value == null ? 0 : Number(value);
  item.harga = isNaN(v) ? 0 : Math.max(0, v);
  if (item.harga === 0) {
    toast.warning("Harga tidak boleh 0", {
      description: `${item.nama_item || "Item"}: Harga harus diisi dengan nilai lebih dari 0`,
      duration: 3000,
    });
    return;
  }
  if (item.sq_price && item.sq_price > 0 && item.harga > item.sq_price) {
    if (!hargaOverSqWarningMap.has(itemIndex)) {
      toast.warning("Harga melebihi harga Supplier Quotation", {
        description: `${item.nama_item || "Item"}: Harga PO (${item.harga.toLocaleString("id-ID")}) > Harga SQ (${item.sq_price.toLocaleString("id-ID")}). Selisih: ${(item.harga - item.sq_price).toLocaleString("id-ID")}`,
        duration: 4000,
      });
      hargaOverSqWarningMap.set(itemIndex, true);
    }
  } else {
    hargaOverSqWarningMap.delete(itemIndex);
  }
};

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  Object.keys(errors).forEach((key) => { errors[key as keyof typeof errors] = ""; });
  let invalid = false;
  if (!values.m_supplier_id?.trim()) { errors.m_supplier_id = "Supplier wajib dipilih"; invalid = true; }
  if (invalid) {
    toast.error("Validasi gagal", { description: "Mohon lengkapi semua field yang wajib diisi" });
    return;
  }
  if (detailItems.value.length === 0) {
    toast.error("Detail item wajib diisi", {
      description: "Pilih minimal satu item terlebih dahulu sebelum menyimpan Purchase Order",
    });
    return;
  }
  const invalidQtyItems = detailItems.value.filter((item) => !item.qty_po || Number(item.qty_po) <= 0);
  if (invalidQtyItems.length > 0) {
    toast.error("Qty item tidak valid", {
      description: `${invalidQtyItems.length} item masih memiliki Qty PO kosong atau 0`,
      duration: 6000,
    });
    return;
  }
  const zeroHargaItems = detailItems.value.filter((item) => !item.harga || item.harga === 0);
  const zeroQtyItems = detailItems.value.filter((item) => !item.qty_po || Number(item.qty_po) <= 0);
  if (zeroQtyItems.length > 0) {
    toast.error("Qty PO tidak boleh 0", {
      description: `${zeroQtyItems.length} item masih memiliki Qty PO kosong/0: ${zeroQtyItems.map((i) => i.nama_item || "-").join(", ")}`,
      duration: 6000,
    });
    return;
  }
  if (zeroHargaItems.length > 0) {
    toast.error("Harga item tidak boleh 0", {
      description: `${zeroHargaItems.length} item masih memiliki harga 0: ${zeroHargaItems.map((i) => i.nama_item || "-").join(", ")}`,
      duration: 6000,
    });
    return;
  }
  const overSqPriceItems = detailItems.value.filter(
    (item) => item.sq_price && item.sq_price > 0 && (item.harga || 0) > item.sq_price,
  );
  if (overSqPriceItems.length > 0) {
    itemsWithOverSqPrice.value = overSqPriceItems;
    isOverSqPriceDialogOpen.value = true;
    return;
  }
  if (isSuperAdmin.value) { isSuperAdminDialogOpen.value = true; return; }
  await proceedWithSave();
};

const proceedWithSave = async () => {
  loading.value = true;
  try {
    const currentUserId = authStore.user?.id || authStore.user?.username || "";
    const toNullIfEmpty = (value: string | null | undefined): string | null =>
      value && value.trim() !== "" ? value : null;

    const payload: any = {
      ...values,
      status: isSuperAdmin.value ? "APPROVED" : values.status || "DRAFT",
      status_transaksi: isEditMode.value ? values.status_transaksi || "OUTSTANDING" : "OUTSTANDING",
      m_supplier_id: toNullIfEmpty(values.m_supplier_id),
      supplier_quotation_id: toNullIfEmpty(values.supplier_quotation_id),
      purchase_request_id: toNullIfEmpty(values.purchase_request_id),
      gudang_id: toNullIfEmpty(values.gudang_id),
      top_id: toNullIfEmpty(values.top_id),
      ppn_id: toNullIfEmpty(values.ppn_id),
      pph_id: toNullIfEmpty(values.pph_id),
      m_currency_id: toNullIfEmpty(values.m_currency_id),
      m_currency_d_id: toNullIfEmpty(values.m_currency_d_id),
      exchange_rate: values.exchange_rate || 1,
      pph_percentage: Number(pphPercentage.value) || 0,
      persen_pph: Number(pphPercentage.value) || 0,
      m_unit_bisnis_id: toNullIfEmpty(values.m_unit_bisnis_id),
      ekspedisi_id: toNullIfEmpty(values.ekspedisi_id),
      total: total.value,
      total_diskon: totalDiskon.value,
      total_ppn: totalPpn.value,
      total_pph: totalPph.value,
      grand_total: grandTotal.value,
      ...(isEditMode.value && { updated_by: currentUserId }),
      t_purchase_order_ds: detailItems.value.map((item) => ({
        ...(item.id && { id: item.id }),
        t_purchase_order_id: toNullIfEmpty(item.t_purchase_order_id),
        t_purchase_request_d_id: toNullIfEmpty(item.t_purchase_request_d_id),
        m_items_id: toNullIfEmpty(item.m_items_id),
        qty_po: item.qty_po,
        qty_ots: item.qty_po,
        qty_pr_ots: getSisaQty(item),
        harga: item.harga,
        sq_price: item.sq_price ?? null,
        disc_1: item.disc_1,
        disc_2: item.disc_2,
        disc_3: item.disc_3,
        amt_disc: item.amt_disc,
        sub_total: calculateLineSubtotal(item),
        disc_total: calculateLineDiscount(item),
        ppn_total: calculateLinePpn(item),
        pph_total: calculateLinePph(item),
        total_stlh_pajak: calculateLineGrandTotal(item),
        catatan: item.catatan,
        created_by: currentUserId,
        ...(isEditMode.value && { updated_by: currentUserId }),
      })),
    };

    if (!isEditMode.value) payload.created_by = currentUserId;

    let savedId: string | undefined;
    if (isEditMode.value) {
      await updateTPurchaseOrder(menuId.value, payload);
      savedId = menuId.value;
      toast.success("Purchase Order berhasil diperbarui");
    } else {
      const res = await createTPurchaseOrder(payload);
      savedId = (res as any)?.data?.id;
      toast.success("Purchase Order berhasil dibuat");
    }

    if (isSuperAdmin.value && savedId) {
      try {
        const allApprovals = authStore.getApprovalList().filter(
          (a: any) => a.path === "/purchasing/transaksi/t_purchase_order",
        );
        const maxLevel = allApprovals.length > 0 ? Math.max(...allApprovals.map((a: any) => a.level ?? 0)) : 1;
        await approveTPurchaseOrder(savedId, null, maxLevel, "Auto approved by Super Admin");
      } catch (approvalErr) {
        console.warn("Failed to call PO approve endpoint:", approvalErr);
      }
    }

    router.replace("/purchasing/transaksi/t_purchase_order?reload=" + Date.now());
  } catch (error) {
    toast.error(
      isEditMode.value ? "Gagal memperbarui Purchase Order" : "Gagal membuat Purchase Order",
      { description: error instanceof Error ? error.message : "Terjadi kesalahan" },
    );
  } finally {
    loading.value = false;
  }
};

const confirmSuperAdminSave = async () => { isSuperAdminDialogOpen.value = false; await proceedWithSave(); };
const cancelSuperAdminSave = () => { isSuperAdminDialogOpen.value = false; };
const confirmOverSqPrice = async () => {
  isOverSqPriceDialogOpen.value = false;
  if (isSuperAdmin.value) { isSuperAdminDialogOpen.value = true; return; }
  await proceedWithSave();
};
const cancelOverSqPrice = () => { isOverSqPriceDialogOpen.value = false; };
const handleCancel = () => { router.push("/purchasing/transaksi/t_purchase_order"); };

// ============================================================================
// PR & SUPPLIER QUOTATION HANDLERS
// ============================================================================
const handlePrSelect = async (item: any) => {
  if (item) {
    values.purchase_request_id = item.id;
    selectedPrIsRfq.value = item.is_rfq === true;
    if (item.m_unit_bisnis_id) values.m_unit_bisnis_id = item.m_unit_bisnis_id;
    if (item.m_gudang_id) {
      values.gudang_id = item.m_gudang_id;
      values.alamat_gudang = item.m_gudang?.alamat_gudang || "";
    }
    if (item.is_rfq) {
      await fetchSupplierQuotationOptions(item.id);
    } else {
      values.supplier_quotation_id = "";
      supplierQuotationOptions.value = [];
    }
    await fetchSisaPrData();
  } else {
    values.purchase_request_id = "";
    selectedPrIsRfq.value = false;
    values.supplier_quotation_id = "";
    supplierQuotationOptions.value = [];
    sisaPrData.value = [];
  }
};

const fetchSupplierQuotationOptions = async (purchaseRequestId: string, mSupplierId?: string) => {
  if (!purchaseRequestId && !mSupplierId) { supplierQuotationOptions.value = []; return; }
  loadingSqOptions.value = true;
  try {
    let filterQuery = "";
    if (purchaseRequestId) {
      filterQuery = `&filter_column_t_supplier_quotation_d.t_rfq_items_d.purchase_request_id=${purchaseRequestId}`;
    }
    if (mSupplierId) filterQuery += `&filter_column_m_supplier_id=${mSupplierId}`;
    const response = await fetch(
      `${API_BASE_URL}/dynamic/t_supplier_quotation?include=t_supplier_quotation_d>t_rfq_items_d,m_supplier&no_pagination=true${filterQuery}`,
      { headers: { "Content-Type": "application/json", Authorization: `Bearer ${authStore.token}` } },
    );
    const result = await response.json();
    if (result.status === "success" && Array.isArray(result.data)) {
      supplierQuotationOptions.value = result.data.map((sq: any) => ({
        id: sq.id,
        label: `${sq.no_supplier_quotation || "-"} - ${sq.m_supplier?.nama_supp || "Unknown Supplier"}`,
      }));
    } else {
      supplierQuotationOptions.value = [];
    }
  } catch (error) {
    console.error("Failed to fetch supplier quotation options:", error);
    supplierQuotationOptions.value = [];
  } finally {
    loadingSqOptions.value = false;
  }
};

const handleSqSelect = async (sqId: string) => {
  values.supplier_quotation_id = sqId;
  if (!sqId) return;
  const toastId = toast.loading("Memuat data Supplier Quotation...");
  try {
    const includes = [
      "t_supplier_quotation_d",
      "t_supplier_quotation_d>t_rfq_items_d>m_items>m_general",
      "t_supplier_quotation_d>t_rfq_items_d>m_general",
      "t_supplier_quotation_d>t_rfq_items_d>t_purchase_request",
      "m_supplier",
      "m_currency",
    ].join(",");
    const response = await fetch(
      `${API_BASE_URL}/dynamic/t_supplier_quotation/${sqId}?include=${includes}`,
      { headers: { "Content-Type": "application/json", Authorization: `Bearer ${authStore.token}` } },
    );
    const result = await response.json();
    if (result.status === "success" && result.data) {
      const sq = result.data;
      if (sq.m_supplier_id) {
        values.m_supplier_id = sq.m_supplier_id;
        if (sq.m_supplier) {
          supplierIsTax.value = sq.m_supplier.is_tax !== false;
          values.top_id = sq.m_supplier.top_id || values.top_id || "";
        }
      }
      if (sq.ppn_type) {
        values.ppn_id = sq.ppn_type;
        handlePpnSelect({ value1: sq.m_general?.value1, value3: sq.ppn?.toString() });
      }
      const sqDetails = sq.t_supplier_quotation_ds || [];
      if (sqDetails.length > 0) {
        const firstMItem = sqDetails[0]?.t_rfq_items_d?.m_items || sqDetails[0]?.t_rfq_items_d?.m_item;
        if (firstMItem?.mi_tipe?.id) values.tipe_item_id = firstMItem.mi_tipe.id;
        const currentUserId = authStore.user?.id || authStore.user?.username || "";
        detailItems.value = sqDetails.map((d: any) => {
          const rfqD = d.t_rfq_items_d || {};
          const mItem = rfqD.m_items || rfqD.m_item || {};
          const uom = rfqD.m_general || {};
          const pr = rfqD.t_purchase_request || {};
          return {
            t_purchase_request_d_id: rfqD.id || null,
            m_items_id: mItem.id || rfqD.m_item_id || null,
            no_pr: pr.no_pr || "-",
            kode_item: mItem.kode_item || "-",
            nama_item: mItem.nama_item || "-",
            qty_pr: rfqD.qty || d.min_qty || 0,
            satuan: uom.value1 || "-",
            diminta_oleh: "-",
            prioritas: "-",
            catatan_item: "",
            qty_po: d.min_qty || rfqD.qty || 0,
            harga: Number(d.price) || 0,
            sq_price: Number(d.price) || 0,
            disc_1: 0, disc_2: 0, disc_3: 0, amt_disc: 0,
            sub_total: 0, disc_total: 0, ppn_total: 0, total_stlh_pajak: 0,
            catatan: d.catatan || "",
            created_by: currentUserId,
            updated_by: "",
          } as DetailItem;
        });
        toast.success(`${sqDetails.length} item berhasil dimuat dari Supplier Quotation`, { id: toastId });
      } else {
        toast.warning("Supplier Quotation tidak memiliki detail item", { id: toastId });
      }
    } else {
      toast.error("Gagal memuat data Supplier Quotation", { id: toastId });
    }
  } catch (error) {
    console.error("Failed to load SQ data:", error);
    toast.error("Gagal memuat data Supplier Quotation", { id: toastId });
  }
};

// ============================================================================
// HANDLERS
// ============================================================================
const handleSupplierSelect = (item: any) => {
  if (item) {
    values.top_id = item.top_id || "";
    values.m_currency_id = item.m_currency_id || values.m_currency_id || "";
  } else {
    values.top_id = "";
    values.m_currency_id = "";
  }
  if (item && typeof item.is_tax !== "undefined") {
    supplierIsTax.value = item.is_tax;
    if (!item.is_tax) {
      values.ppn_id = "dc697972-3785-4f50-98ff-dfa6a1f9d6fa";
      ppnPercentage.value = "0";
    }
  }
};

const handlePpnSelect = (item: any) => {
  if (item && item.value3) {
    ppnPercentage.value = item.value3;
    ppnType.value = item.value1?.includes("INCLUDE") ? "INCLUDE" : "EXCLUDE";
  } else if (item === null) {
    ppnPercentage.value = "0";
    ppnType.value = "EXCLUDE";
  }
};

const handlePphSelect = (item: any) => {
  if (item && item.value3) {
    pphPercentage.value = item.value3;
  } else if (item === null) {
    pphPercentage.value = "0";
  }
};

// ============================================================================
// UNIT CONVERSION HANDLERS
// ============================================================================
const openConversionDialog = async (item: DetailItem) => {
  if (!item.m_items_id) { toast.warning("Item tidak memiliki data konversi"); return; }
  selectedItemForConversion.value = item;
  isConversionDialogOpen.value = true;
  await fetchItemConversion(item);
};
const closeConversionDialog = () => {
  isConversionDialogOpen.value = false;
  selectedItemForConversion.value = null;
  conversionData.value = [];
};
const fetchItemConversion = async (item: DetailItem) => {
  if (!item.m_items_id) return;
  conversionLoading.value = true;
  try {
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_items_conversion?join=true&filter_column_items_id=${item.m_items_id}`,
      { headers: { "Content-Type": "application/json", Authorization: `Bearer ${authStore.token}` } },
    );
    if (!response.ok) throw new Error("Gagal mengambil data konversi");
    const result = await response.json();
    conversionData.value = (result.status === "success" && Array.isArray(result.data)) ? result.data : [];
  } catch (error) {
    toast.error("Gagal memuat data konversi", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
    conversionData.value = [];
  } finally {
    conversionLoading.value = false;
  }
};

// ============================================================================
// HISTORY HANDLERS
// ============================================================================
const openHistoryDialog = async (item: DetailItem) => {
  selectedItemForHistory.value = item;
  isHistoryDialogOpen.value = true;
  await fetchItemHistory(item);
};
const closeHistoryDialog = () => {
  isHistoryDialogOpen.value = false;
  selectedItemForHistory.value = null;
  historyHarga.value = [];
  historyStock.value = [];
  historyQuotation.value = [];
};
const fetchItemHistory = async (item: DetailItem) => {
  if (!item.m_items_id) { toast.warning("Item tidak memiliki ID"); return; }
  historyLoading.value = true;
  try {
    const [hargaRes, stockRes, quotationRes] = await Promise.all([
      fetch(`${API_BASE_URL}/dynamic/t_purchase_order_d?filter_column_m_items_id=${item.m_items_id}&include=t_purchase_order,t_purchase_order>m_supplier&order=createdAt:desc&paginate=10`, { headers: { "Content-Type": "application/json", Authorization: `Bearer ${authStore.token}` } }),
      fetch(`${API_BASE_URL}/dynamic/t_stock_mutation?filter_column_m_items_id=${item.m_items_id}&include=m_gudang&order=createdAt:desc&paginate=10`, { headers: { "Content-Type": "application/json", Authorization: `Bearer ${authStore.token}` } }),
      fetch(`${API_BASE_URL}/dynamic/t_supplier_quotation_d?filter_column_t_rfq_d.m_items_id=${item.m_items_id}&include=t_supplier_quotation>m_supplier,t_rfq_d&order=createdAt:desc&paginate=10`, { headers: { "Content-Type": "application/json", Authorization: `Bearer ${authStore.token}` } }),
    ]);
    const [hargaData, stockData, quotationData] = await Promise.all([hargaRes.json(), stockRes.json(), quotationRes.json()]);
    if (hargaData.status === "success") historyHarga.value = hargaData.data || [];
    if (stockData.status === "success") historyStock.value = stockData.data || [];
    if (quotationData.status === "success") historyQuotation.value = quotationData.data || [];
  } catch (error) {
    toast.error("Gagal memuat history item", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    historyLoading.value = false;
  }
};

// ============================================================================
// EXCEL EXPORT & IMPORT HANDLERS
// ============================================================================
const isExporting = ref(false);
const isImporting = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

const handleExportExcel = async () => {
  if (!values.purchase_request_id) {
    toast.error("Pilih Purchase Request terlebih dahulu");
    return;
  }
  isExporting.value = true;
  const toastId = toast.loading("Mengunduh Excel...");
  try {
    const prDetailIds = detailItems.value.map((item) => item.t_purchase_request_d_id).filter((id): id is string => !!id);
    const blob = await exportPurchaseOrderDetailExcel(values.purchase_request_id, prDetailIds.length > 0 ? prDetailIds : undefined);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `PO_Items_${values.purchase_request_id || "export"}_${new Date().getTime()}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast.success("Excel berhasil diunduh", { id: toastId });
  } catch (error) {
    toast.error("Gagal mengunduh Excel", { id: toastId, description: error instanceof Error ? error.message : "Terjadi kesalahan" });
  } finally {
    isExporting.value = false;
  }
};

const handleImportExcelClick = () => {
  if (!values.purchase_request_id) { toast.error("Pilih Purchase Request terlebih dahulu"); return; }
  fileInputRef.value?.click();
};

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  const validTypes = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"];
  if (!validTypes.includes(file.type)) {
    toast.error("Format file tidak valid", { description: "Silakan upload file Excel (.xlsx atau .xls)" });
    target.value = "";
    return;
  }
  isImporting.value = true;
  const toastId = toast.loading("Mengimpor data Excel...");
  try {
    const formData = new FormData();
    formData.append("excelData", file);
    const response = await importPurchaseOrderDetailExcel(formData);
    if (response.status === "success" && response.data) {
      detailItems.value = [];
      const importedItems = Array.isArray(response.data) ? response.data : [response.data];
      importedItems.forEach((item: any) => {
        const satuan = item.satuan || item.uom || item.unit || item.prqd_uom?.value1 || item.m_item?.mi_uom?.value1 || "-";
        detailItems.value.push({
          t_purchase_request_d_id: item.t_purchase_request_d_id || null,
          m_items_id: item.m_items_id || null,
          no_pr: item.no_pr || "-",
          kode_item: item.kode_item || "-",
          nama_item: item.nama_item || "-",
          qty_pr: item.qty_pr || 0,
          satuan,
          diminta_oleh: item.diminta_oleh || "-",
          prioritas: item.prioritas || "-",
          catatan_item: item.catatan_item || "",
          qty_po: item.qty_po || 0,
          harga: item.harga || 0,
          disc_1: item.disc_1 || 0, disc_2: item.disc_2 || 0, disc_3: item.disc_3 || 0,
          amt_disc: item.amt_disc || 0, sub_total: item.sub_total || 0, disc_total: item.disc_total || 0,
          ppn_total: item.ppn_total || 0, total_stlh_pajak: item.total_stlh_pajak || 0, catatan: item.catatan || "",
        });
      });
      toast.success("Data Excel berhasil diimpor", { id: toastId, description: `${importedItems.length} item berhasil ditambahkan` });
    } else {
      throw new Error(response.message || "Gagal mengimpor data Excel");
    }
  } catch (error) {
    toast.error("Gagal mengimpor Excel", { id: toastId, description: error instanceof Error ? error.message : "Terjadi kesalahan" });
  } finally {
    isImporting.value = false;
    target.value = "";
  }
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
          <CardTitle>Informasi Purchase Order</CardTitle>
          <CardDescription>Isi data Purchase Order dengan lengkap dan benar</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">

          <!-- Baris 1: Unit Bisnis, Company, Tanggal PO, No. PO -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <!-- Super Admin: FieldSelect Unit Bisnis -->
            <FieldSelect
              v-if="isSuperAdmin"
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              :value="values.m_unit_bisnis_id"
              @input="(v: string) => (values.m_unit_bisnis_id = v)"
              @update:value-full="handleUnitBisnisSelected"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
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
                  searchfield: 'kode_unit_bisnis,nama_comp',
                  filter_column_is_active: 'true',
                  no_pagination: 'true',
                  join: 'true',
                },
              }"
            />

            <!-- Non-Super Admin: readonly dari akun -->
            <FieldX
              v-else
              id="m_unit_bisnis_display"
              label="Unit Bisnis"
              :value="companyNameDisplay"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              hints="Unit Bisnis dari akun Anda"
            />

            <!-- Company dari Unit Bisnis yang dipilih (Super Admin) atau dari akun (non-SA) -->
            <FieldX
              id="company_display"
              label="Company"
              :value="isSuperAdmin ? (selectedUnitBisnisCompanyName || '-') : companyNameDisplay"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              :hints="isSuperAdmin ? 'Company dari Unit Bisnis yang dipilih' : 'Company dari akun Anda'"
            />

            <!-- Tanggal PO -->
            <FieldDate
              id="tgl_po"
              label="Tanggal PO"
              v-model="values.tgl_po"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Tanggal hari ini"
              hints="Tanggal PO otomatis hari ini"
            />

            <!-- No PO (readonly) -->
            <div class="space-y-2">
              <Label>No. PO</Label>
              <Input
                v-model="values.no_po"
                readonly
                disabled
                placeholder="Auto generate by system"
                class="bg-muted"
              />
            </div>
          </div>

          <!-- Baris 2: Is Import, Need Biaya Kirim, Tipe Item -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FieldStatus
              id="is_import"
              label="Tipe Pembelian"
              :model-value="values.is_import"
              @update:model-value="values.is_import = $event"
              :disabled="loading"
              :readonly="isReadOnly"
              active-text="IMPORT"
              inactive-text="LOKAL"
            />
            <FieldStatus
              id="need_biaya_kirim"
              label="Need Biaya Kirim"
              :model-value="values.need_biaya_kirim"
              @update:model-value="values.need_biaya_kirim = $event"
              :disabled="loading || values.is_import"
              :readonly="isReadOnly || values.is_import"
              active-text="YES"
              inactive-text="NO"
            />
            <FieldSelect
              id="tipe_item_id"
              label="Tipe Item"
              :value="values.tipe_item_id"
              @input="(v: string) => (values.tipe_item_id = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih Tipe Item"
              displayField="value1"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: { filter_column_group: 'TIPE ITEM', where: 'is_active=true', order: 'value1:asc', no_pagination: 'true' },
              }"
            />
          </div>

          <!-- Baris 3: Purchase Request, Supplier Quotation (jika is_rfq) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FieldPopup
              id="purchase_request_id"
              label="Purchase Request"
              :value="values.purchase_request_id"
              @input="(v: string) => (values.purchase_request_id = v)"
              @update:valueFull="handlePrSelect"
              :displayValue="values.no_pr || ''"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              placeholder="Pilih Purchase Request"
              valueField="id"
              displayField="no_pr"
              :api="{
                url: `${API_BASE_URL}/fn/t_purchase_request/getPROutstandingList`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: { searchfield: 'no_pr,catatan', order_by: 'createdAt', order_type: 'DESC', paginate: 20 },
                onsuccess: (response: any) => { response.hasNext = response.pagination?.next_page ? true : false; return response; },
              }"
              :columns="[
                { field: 'no_pr', headerName: 'No PR', width: '200px', sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'm_unit_bisni.nama_comp', headerName: 'Unit Bisnis', width: '150px', sortable: true, filterable: true, filter: 'ColFilter', render: (item: any) => item.m_unit_bisni?.nama_comp || '-' },
                { field: 'tgl_pr', headerName: 'Tanggal', width: '150px', sortable: true },
                { field: 'req_user_by', headerName: 'Diminta Oleh', flex: 1, sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'is_rfq', headerName: 'RFQ', width: '80px', sortable: false, renderHtml: (item: any) => { const isYes = item.is_rfq === true || item.is_rfq === 'true'; return isYes ? `<span class='text-green-600 font-bold'>YES</span>` : `<span class='text-destructive font-bold'>NO</span>`; } },
                { field: 'catatan', headerName: 'Catatan', flex: 1, sortable: true, filterable: true, filter: 'ColFilter' },
              ]"
            />

            <FieldSelect
              v-if="selectedPrIsRfq"
              id="supplier_quotation_id"
              label="Supplier Quotation"
              :value="values.supplier_quotation_id"
              @input="(v: string) => handleSqSelect(v)"
              :disabled="loading || isReadOnly || loadingSqOptions"
              :readonly="isReadOnly"
              :clearable="true"
              placeholder="Pilih Supplier Quotation"
              displayField="label"
              valueField="id"
              :options="supplierQuotationOptions"
              :hints="loadingSqOptions ? 'Memuat data...' : supplierQuotationOptions.length === 0 ? 'Tidak ada Supplier Quotation untuk PR ini' : ''"
            />
          </div>

          <!-- Baris 4: Supplier, Ekspedisi -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FieldPopup
              id="m_supplier_id"
              label="Supplier"
              :value="values.m_supplier_id"
              @input="(v: string) => { values.m_supplier_id = v; errors.m_supplier_id = ''; }"
              @update:valueFull="handleSupplierSelect"
              :errorText="errors.m_supplier_id ? 'failed' : ''"
              :hints="isFromSq ? 'Otomatis dari Supplier Quotation' : errors.m_supplier_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || isFromSq"
              :readonly="isReadOnly || isFromSq"
              :clearable="!isReadOnly && !isFromSq"
              placeholder="Pilih Supplier"
              displayField="nama_supp"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_supplier`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: { searchfield: 'nama_supp,alamat_supp,no_telp', join: true, ...supplierTipeSuppParams, filter_column_is_active: true, selectfield: 'id,nama_supp,alamat_supp,no_telp,top_id,is_tax,is_active,m_currency_id' },
                onsuccess: (response: any) => { response.hasNext = response.pagination?.next_page ? true : false; return response; },
              }"
              :columns="[
                { field: 'nama_supp', headerName: 'Nama Supplier', flex: 1, sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'alamat_supp', headerName: 'Alamat', width: '250px', sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'no_telp', headerName: 'No. Telp', width: '150px', sortable: true, filterable: true, filter: 'ColFilter' },
              ]"
            />

            <FieldPopup
              id="ekspedisi_id"
              label="Ekspedisi"
              :value="values.ekspedisi_id"
              @input="(v: string) => { values.ekspedisi_id = v; errors.ekspedisi_id = ''; }"
              :errorText="errors.ekspedisi_id ? 'failed' : ''"
              :hints="errors.ekspedisi_id"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              placeholder="Pilih Ekspedisi"
              displayField="nama"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_ekspedisi`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: { searchfield: 'nama,kode_ekspedisi,alamat,telepon,cp_kantor', filter_column_is_active: true, include: 'm_tujuan_ekspedisi' },
                onsuccess: (response: any) => {
                  if (response.data && Array.isArray(response.data)) {
                    response.data = response.data.map((item: any) => {
                      item.kota_tujuan = item.m_tujuan_ekspedisis?.length > 0
                        ? item.m_tujuan_ekspedisis.map((d: any) => `${d.nama_kota} (${d.nama_provinsi})`).join(', ')
                        : item.tujuan_kirim || '-';
                      return item;
                    });
                  }
                  response.hasNext = response.pagination?.next_page ? true : false;
                  return response;
                },
              }"
              :columns="[
                { field: 'nama', headerName: 'Nama Ekspedisi', width: '150px', sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'kode_ekspedisi', headerName: 'Kode Ekspedisi', width: '150px', sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'kota_tujuan', headerName: 'Kota Tujuan', width: '180px', sortable: false, filterable: false, renderHtml: (item: any) => `<div style='white-space: normal; word-wrap: break-word; max-width: 180px; line-height: 1.4;'>${item.kota_tujuan || '-'}</div>` },
                { field: 'alamat', headerName: 'Alamat', width: '180px', sortable: true, filterable: true, filter: 'ColFilter', renderHtml: (item: any) => `<div style='white-space: normal; word-wrap: break-word; max-width: 180px; line-height: 1.4;'>${item.alamat || '-'}</div>` },
                { field: 'telepon', headerName: 'No. Telp', width: '120px', sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'cp_kantor', headerName: 'CP Kantor', width: '100px', sortable: true, filterable: true, filter: 'ColFilter' },
              ]"
            />
          </div>

          <!-- Baris 5: PPN, PPN%, PPH, PPH% (hanya non-import) -->
          <div v-if="!values.is_import" class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <FieldSelect
              id="ppn_id"
              label="PPN"
              :value="values.ppn_id"
              :errorText="errors.ppn_id ? 'failed' : ''"
              @input="(v: string) => (values.ppn_id = v)"
              @update:valueFull="handlePpnSelect"
              :hints="errors.ppn_id"
              :disabled="loading || isReadOnly || isFromSq || selectedPrIsRfq"
              :readonly="isReadOnly || isFromSq || selectedPrIsRfq"
              :clearable="false"
              placeholder="Pilih PPN"
              displayField="value1"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: { no_pagination: 'true', selectfield: 'id,value1,value3', search: 'PPN', searchfield: 'group' },
              }"
            />
            <FieldX
              id="ppn_percentage"
              label="PPN (%)"
              :modelValue="ppnPercentage || '0'"
              readonly
              disabled
              hints="Otomatis dari pilihan PPN"
            />
            <FieldSelect
              id="pph_id"
              label="PPH"
              :value="values.pph_id"
              :errorText="errors.pph_id ? 'failed' : ''"
              @input="(v: string) => (values.pph_id = v)"
              @update:valueFull="handlePphSelect"
              :hints="errors.pph_id"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="true"
              placeholder="Pilih PPH"
              displayField="value1"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: { no_pagination: 'true', selectfield: 'id,value1,value3', search: 'PPH', searchfield: 'group' },
              }"
            />
            <FieldNumber
              id="pph_percentage"
              label="PPH (%)"
              :model-value="Number(pphPercentage)"
              @update:model-value="handlePphPercentageChange"
              :disabled="isReadOnly"
              type="decimal"
              placeholder="0"
              suffix="%"
              hints="Otomatis dari pilihan PPH, bisa diedit manual"
            />
          </div>

          <!-- Baris 6: TOP, DP Nominal, DP % -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FieldSelect
              id="top_id"
              label="TOP (Termin Pembayaran)"
              :value="values.top_id"
              :errorText="errors.top_id ? 'failed' : ''"
              @input="(v: string) => (values.top_id = v)"
              :hints="errors.top_id"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="true"
              placeholder="Pilih TOP"
              displayField="value1"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: { no_pagination: 'true', selectfield: 'id,value1', search: 'TERMIN', searchfield: 'group' },
              }"
            />
            <FieldNumber
              id="dp"
              label="DP (Down Payment) Nominal"
              :model-value="values.dp"
              @update:model-value="handleDpNominalChange"
              :disabled="isReadOnly"
              type="decimal"
              placeholder="0"
            />
            <FieldNumber
              id="dp_persen"
              label="DP (Down Payment) %"
              :model-value="values.dp_persen"
              @update:model-value="handleDpPersenChange"
              :disabled="isReadOnly"
              type="decimal"
              placeholder="0"
              suffix="%"
            />
          </div>

          <!-- Baris 7: Gudang, Status -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FieldPopup
              id="gudang_id"
              label="Gudang"
              :value="values.gudang_id"
              @input="(v: string) => (values.gudang_id = v)"
              @update:valueFull="(item: any) => (values.alamat_gudang = item?.alamat_gudang || '')"
              :disabled="loading || isReadOnly || !values.m_unit_bisnis_id"
              :readonly="isReadOnly"
              :clearable="true"
              :placeholder="!values.m_unit_bisnis_id ? 'Pilih Unit Bisnis terlebih dahulu' : 'Pilih Gudang'"
              displayField="nama_gudang"
              valueField="id"
              :api="gudangApiConfig"
              :columns="[
                { field: 'kode_gudang', headerName: 'Kode', width: '120px', sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'nama_gudang', headerName: 'Nama Gudang', flex: 1, sortable: true, filterable: true, filter: 'ColFilter' },
              ]"
            />
            <FieldX
              id="status"
              label="Status"
              :value="values.status"
              :disabled="true"
              :readonly="true"
              placeholder="DRAFT"
              hints="Status akan otomatis berubah sesuai proses approval"
            />
          </div>

          <!-- Baris 8: Alamat Gudang, Catatan Bonus, Catatan -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FieldTextarea
              id="alamat_gudang"
              label="Alamat Gudang"
              :model-value="values.alamat_gudang"
              :disabled="true"
              :readonly="true"
              placeholder="Alamat Gudang otomatis terisi..."
              :rows="3"
            />
            <FieldTextarea
              id="catatan_bonus"
              label="Catatan Voucher Bonus"
              v-model="values.catatan_bonus"
              :disabled="isReadOnly"
              :readonly="isReadOnly"
              placeholder="Catatan Voucher Bonus..."
              :rows="3"
            />
            <FieldTextarea
              id="catatan"
              label="Catatan"
              v-model="values.catatan"
              :disabled="isReadOnly"
              :readonly="isReadOnly"
              placeholder="Catatan tambahan..."
              :rows="3"
            />
          </div>

          <!-- Baris 9: Currency, Exchange Rate (if import) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FieldSelect
              id="m_currency_id"
              label="Currency"
              :value="values.m_currency_id"
              @input="(v: string) => (values.m_currency_id = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="false"
              placeholder="Pilih Mata Uang"
              displayField="nama_currency"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_currency`,
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                params: { no_pagination: 'true', selectfield: 'id,nama_currency,kode_currency', include: 'm_currency_d,money', filter_column_is_active: true },
              }"
            />
            <FieldNumber
              v-if="values.is_import"
              id="exchange_rate"
              label="Exchange Rate"
              :model-value="values.exchange_rate"
              @update:model-value="handleExchangeRateChange"
              :disabled="isReadOnly"
              type="decimal"
              placeholder="1"
              hints="Masukkan nilai exchange rate secara manual (contoh: 15000 untuk 1 USD = Rp 15.000)"
            />
          </div>

          <!-- Currency Info -->
          <div
            v-if="values.m_currency_id && selectedCurrencyData"
            class="p-4 bg-card rounded-lg border shadow-sm"
          >
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p class="text-muted-foreground text-xs">Currency</p>
                <p class="font-semibold">{{ currencyName }}</p>
                <p class="text-xs text-muted-foreground">{{ currencyCode }}</p>
              </div>
              <div>
                <p class="text-muted-foreground text-xs">Exchange Rate (Active)</p>
                <p class="font-bold text-primary text-lg">
                  {{ exchangeRateDisplay.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) }}
                </p>
                <p class="text-xs text-muted-foreground">Rp / Unit</p>
              </div>
              <div>
                <p class="text-muted-foreground text-xs">Updated</p>
                <p class="font-semibold text-xs">{{ exchangeRateDateTime }}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- DETAIL ITEMS CARD -->
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <div>
              <CardTitle>Detail Purchase Order</CardTitle>
              <CardDescription>Daftar item dalam purchase order</CardDescription>
            </div>
            <div class="flex items-center gap-2">
              <input type="file" ref="fileInputRef" class="hidden" accept=".xlsx,.xls" @change="handleFileSelect" />
              <Button v-if="!isReadOnly && !values.supplier_quotation_id" variant="outline" size="sm" :disabled="!values.purchase_request_id || isExporting" @click="handleExportExcel" class="gap-2">
                <FileDown :class="['h-4 w-4', isExporting && 'animate-pulse']" />
                <span class="hidden sm:inline">Export</span>
              </Button>
              <Button v-if="!isReadOnly && !values.supplier_quotation_id" variant="outline" size="sm" :disabled="!values.purchase_request_id || isImporting" @click="handleImportExcelClick" class="gap-2">
                <Upload :class="['h-4 w-4', isImporting && 'animate-pulse']" />
                <span class="hidden sm:inline">Import</span>
              </Button>
              <ButtonMultiSelect
                v-if="!isReadOnly && !values.supplier_quotation_id"
                :disabled="!values.purchase_request_id"
                title="Pilih Items"
                @add="(items: any[]) => {
                  if (!items || items.length === 0) return;
                  const normalizedItems = items.map((item: any) => normalizePrSisaItem(item));
                  const firstItemTypeId = normalizedItems[0].m_item?.mi_tipe?.id;
                  const firstItemTypeName = normalizedItems[0].m_item?.mi_tipe?.value1;
                  const isAllSameType = normalizedItems.every((item: any) => item.m_item?.mi_tipe?.id === firstItemTypeId);
                  if (!isAllSameType) { toast.warning('Validasi Gagal', { description: 'Semua item yang dipilih harus memiliki Tipe Item yang sama.' }); return; }
                  if (values.tipe_item_id && values.tipe_item_id !== firstItemTypeId) { toast.warning('Validasi Gagal', { description: `Item yang dipilih harus bertipe yang sama dengan PO. Item yang anda pilih bertipe '${firstItemTypeName || '-'}'` }); return; }
                  if (!values.tipe_item_id && firstItemTypeId) values.tipe_item_id = firstItemTypeId;
                  normalizedItems.forEach((item: any) => {
                    const pr = item.t_purchase_request || {};
                    if (detailItems.some((d: any) => d.t_purchase_request_d_id === item.id)) return;
                    detailItems.push({
                      t_purchase_request_d_id: item.id,
                      m_items_id: item.m_items_id || null,
                      no_pr: pr.no_pr || '-',
                      kode_item: item.m_item?.kode_item || '-',
                      nama_item: item.m_item?.nama_item || '-',
                      qty_pr: item.qty_pr || 0,
                      satuan: item.prqd_uom?.value1 || '-',
                      diminta_oleh: `${pr.req_type_user || ''} - ${pr.req_user_by || ''}`.trim() || '-',
                      prioritas: pr.m_general?.value1 || '-',
                      catatan_item: item.catatan || '',
                      qty_po: getInitialQtyPo(item),
                      qty_pr_ots: getSisaQtyFromRaw(item),
                      harga: 0, disc_1: 0, disc_2: 0, disc_3: 0, amt_disc: 0,
                      sub_total: 0, disc_total: 0, ppn_total: 0, total_stlh_pajak: 0, catatan: '',
                    });
                  });
                }"
                :api="{
                  url: `${API_BASE_URL}/fn/t_purchase_request/getPrSisa`,
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
                  params: getPrSisaPopupParams(),
                  onsuccess: (response: any) => {
                    response.hasNext = false;
                    if (response.data && Array.isArray(response.data)) {
                      response.data = filterSisaItems(response.data.map((item: any) => normalizePrSisaItem(item)));
                    }
                    return response;
                  },
                }"
                :columns="[
                  { key: 't_purchase_request.no_pr', label: 'No PR', width: '150px', render: (item: any) => item.t_purchase_request?.no_pr || '-' },
                  { key: 'm_item.kode_item', label: 'Kode Item', width: '150px', render: (item: any) => item.m_item?.kode_item || '-' },
                  { key: 'm_item.nama_item', label: 'Nama Item', width: '250px', render: (item: any) => item.m_item.nama_item || '-' },
                  { key: 'qty_pr', label: 'Qty PR', width: '80px' },
                  { key: 'sisa_pr', label: 'Sisa PR', width: '80px', renderHtml: (item: any) => renderSisaPrHtml(item) },
                  { key: 'tipe_item', label: 'Tipe Item', width: '80px', render: (item: any) => item.m_item?.mi_tipe?.value1 || '-' },
                  { key: 'satuan', label: 'Satuan', width: '80px', render: (item: any) => item.prqd_uom?.value1 || '-' },
                ]"
                :excludeIds="selectedItemIds"
              />
              <p v-if="values.supplier_quotation_id" class="text-sm text-muted-foreground italic">
                Item otomatis dari Supplier Quotation
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="border rounded-lg overflow-x-auto">
            <div class="min-w-[150%]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-12">No</TableHead>
                    <TableHead class="w-32">No. PR</TableHead>
                    <TableHead class="w-28">Kode</TableHead>
                    <TableHead class="w-48">Nama Item</TableHead>
                    <TableHead class="w-20">Qty PR</TableHead>
                    <TableHead class="w-20">Sisa PR</TableHead>
                    <TableHead class="w-20">Qty PO</TableHead>
                    <TableHead v-if="isReadOnly" class="w-20">Sisa PO</TableHead>
                    <TableHead class="w-20">Satuan</TableHead>
                    <TableHead class="w-28">Harga</TableHead>
                    <TableHead class="w-20">Disc.1(%)</TableHead>
                    <TableHead class="w-20">Disc.2(%)</TableHead>
                    <TableHead class="w-20">Disc.3(%)</TableHead>
                    <TableHead class="w-28">Disc.Amt</TableHead>
                    <TableHead class="w-28">Total Diskon</TableHead>
                    <TableHead class="w-32">Subtotal</TableHead>
                    <TableHead class="w-28">PPN</TableHead>
                    <TableHead class="w-28">PPH</TableHead>
                    <TableHead class="w-32">Total Stlh Pajak</TableHead>
                    <TableHead class="w-28">Diminta Oleh</TableHead>
                    <TableHead class="w-36">Alasan Request</TableHead>
                    <TableHead class="w-36">Catatan</TableHead>
                    <TableHead v-if="!isReadOnly && !isFromSq" class="w-16">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="detailItems.length === 0">
                    <TableCell colspan="23" class="py-12 text-center text-muted-foreground">
                      Belum ada item. Klik tombol "Pilih Items" untuk menambah.
                    </TableCell>
                  </TableRow>
                  <TableRow v-else v-for="(item, index) in detailItems" :key="index">
                    <TableCell>{{ index + 1 }}</TableCell>
                    <TableCell>{{ item.no_pr || "-" }}</TableCell>
                    <TableCell>{{ item.kode_item || "-" }}</TableCell>
                    <TableCell>{{ item.nama_item || "-" }}</TableCell>
                    <TableCell>{{ item.qty_pr || 0 }}</TableCell>
                    <TableCell>
                      <span :class="getDisplaySisaPr(item) <= 0 && !isReadOnly ? 'text-destructive font-semibold' : 'text-green-600 dark:text-green-400 font-semibold'">
                        {{ getDisplaySisaPr(item) }}
                      </span>
                    </TableCell>
                    <TableCell>
                      <FieldNumber v-if="!isReadOnly && !isFromSq" :model-value="item.qty_po ?? 0" @update:model-value="(value) => handleQtyPoChange(item, value, index)" class="w-full" :disabled="loading" />
                      <span v-else>{{ item.qty_po || 0 }}</span>
                    </TableCell>
                    <TableCell v-if="isReadOnly"><span>{{ item.qty_ots }}</span></TableCell>
                    <TableCell>{{ item.satuan || "-" }}</TableCell>
                    <TableCell>
                      <FieldNumber v-if="!isReadOnly" :model-value="item.harga ?? 0" @update:model-value="(value) => handleHargaChange(item, value, index)" type="decimal" class="w-full" :class="!item.harga || item.harga === 0 ? 'border-destructive ring-1 ring-destructive' : ''" :disabled="loading" />
                      <span v-else>{{ item.harga?.toLocaleString("id-ID") || 0 }}</span>
                    </TableCell>
                    <TableCell>
                      <FieldNumber v-if="!isReadOnly && !isFromSq" :model-value="item.disc_1 ?? 0" @update:model-value="(value) => { const v = value === '' || value == null ? 0 : Number(value); item.disc_1 = isNaN(v) ? 0 : v; }" class="w-full" :disabled="loading" />
                      <span v-else>{{ item.disc_1 || 0 }}</span>
                    </TableCell>
                    <TableCell>
                      <FieldNumber v-if="!isReadOnly && !isFromSq" :model-value="item.disc_2 ?? 0" @update:model-value="(value) => { const v = value === '' || value == null ? 0 : Number(value); item.disc_2 = isNaN(v) ? 0 : v; }" class="w-full" :disabled="loading" />
                      <span v-else>{{ item.disc_2 || 0 }}</span>
                    </TableCell>
                    <TableCell>
                      <FieldNumber v-if="!isReadOnly && !isFromSq" :model-value="item.disc_3 ?? 0" @update:model-value="(value) => { const v = value === '' || value == null ? 0 : Number(value); item.disc_3 = isNaN(v) ? 0 : v; }" class="w-full" :disabled="loading" />
                      <span v-else>{{ item.disc_3 || 0 }}</span>
                    </TableCell>
                    <TableCell>
                      <FieldNumber v-if="!isReadOnly && !isFromSq" type="decimal" :model-value="item.amt_disc ?? 0" @update:model-value="(value) => { const v = value === '' || value == null ? 0 : Number(value); item.amt_disc = isNaN(v) ? 0 : v; }" class="w-full" :disabled="loading" />
                      <span v-else>{{ item.amt_disc?.toLocaleString("id-ID") || 0 }}</span>
                    </TableCell>
                    <TableCell><span class="text-destructive font-medium">{{ formatCurrency(calculateLineDiscount(item)) }}</span></TableCell>
                    <TableCell><span class="font-semibold">{{ formatCurrency(calculateLineTotal(item)) }}</span></TableCell>
                    <TableCell><span class="text-blue-600 dark:text-blue-400">{{ formatCurrency(calculateLinePpn(item)) }}</span></TableCell>
                    <TableCell><span class="text-red-600 dark:text-red-400">{{ formatCurrency(calculateLinePph(item)) }}</span></TableCell>
                    <TableCell><span class="font-bold text-primary">{{ formatCurrency(calculateLineGrandTotal(item)) }}</span></TableCell>
                    <TableCell>{{ item.diminta_oleh || "-" }}</TableCell>
                    <TableCell>
                      <FieldX v-if="!isReadOnly" :model-value="item.catatan_item || ''" @update:model-value="(value) => (item.catatan_item = String(value || ''))" class="w-full" :disabled="true" />
                      <span v-else>{{ item.catatan_item || "-" }}</span>
                    </TableCell>
                    <TableCell>
                      <FieldTextarea v-if="!isReadOnly && !isFromSq" :id="`catatan-${index}`" :value="item.catatan" @input="(v: string) => (item.catatan = v)" :disabled="loading" :readonly="isReadOnly" placeholder="Catatan" :rows="3" />
                      <span v-else class="whitespace-pre-line">{{ item.catatan || "-" }}</span>
                    </TableCell>
                    <TableCell v-if="!isReadOnly && !isFromSq">
                      <Button type="button" variant="ghost" size="sm" @click="removeDetailItem(index)" :disabled="loading">
                        <Trash2 class="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <!-- SUMMARY TOTALS -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1 rounded-lg border bg-muted/40 p-4 text-sm">
              <div class="pb-2 mb-2 border-b font-semibold text-foreground">{{ currencySymbol }} {{ currencyCode }}</div>
              <div class="flex items-center justify-between"><span class="text-muted-foreground">Total Diskon</span><span class="font-semibold text-destructive">{{ totalDiskon.toLocaleString("id-ID") }}</span></div>
              <div class="h-px bg-border my-1"></div>
              <div class="flex items-center justify-between"><span class="text-muted-foreground">Total</span><span class="font-semibold">{{ total.toLocaleString("id-ID") }}</span></div>
              <div class="flex items-center justify-between"><span class="text-muted-foreground">Total PPN</span><span class="flex items-center gap-2"><span class="text-xs text-muted-foreground">{{ (ppnPercentage || "0") + "%" }}</span><span class="font-semibold">{{ totalPpn.toLocaleString("id-ID") }}</span></span></div>
              <div class="flex items-center justify-between"><span class="text-muted-foreground">Total PPH</span><span class="flex items-center gap-2"><span class="text-xs text-muted-foreground">{{ (pphPercentage || "0") + "%" }}</span><span class="font-semibold text-red-600 dark:text-red-400">{{ totalPph.toLocaleString("id-ID") }}</span></span></div>
              <div class="h-px bg-border my-1"></div>
              <div class="flex items-center justify-between"><span class="font-semibold">Grand Total</span><span class="text-base font-bold text-primary">{{ grandTotal.toLocaleString("id-ID") }}</span></div>
            </div>

            <div v-if="values.m_currency_id && !isCurrencyRupiah" class="space-y-1 rounded-lg border bg-muted/40 p-4 text-sm">
              <div class="pb-2 mb-2 border-b font-semibold text-foreground">IDR (Rupiah)</div>
              <div class="flex items-center justify-between"><span class="text-muted-foreground">Total Diskon</span><span class="font-semibold text-destructive">{{ (totalDiskon * exchangeRate).toLocaleString("id-ID") }}</span></div>
              <div class="h-px bg-border my-1"></div>
              <div class="flex items-center justify-between"><span class="text-muted-foreground">Total</span><span class="font-semibold">{{ (total * exchangeRate).toLocaleString("id-ID") }}</span></div>
              <div class="flex items-center justify-between"><span class="text-muted-foreground">Total PPN</span><span class="font-semibold">{{ (totalPpn * exchangeRate).toLocaleString("id-ID") }}</span></div>
              <div class="flex items-center justify-between"><span class="text-muted-foreground">Total PPH</span><span class="font-semibold text-red-600 dark:text-red-400">{{ (totalPph * exchangeRate).toLocaleString("id-ID") }}</span></div>
              <div class="h-px bg-border my-1"></div>
              <div class="flex items-center justify-between"><span class="font-semibold">Grand Total</span><span class="text-base font-bold text-primary">{{ (grandTotal * exchangeRate).toLocaleString("id-ID") }}</span></div>
            </div>
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
      <div class="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-end sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t sm:border-0 -mx-6 px-6 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:static">
        <Button type="button" variant="outline" @click="handleCancel" :disabled="loading" class="w-full sm:w-auto">
          {{ isReadOnly ? "Kembali" : "Batal" }}
        </Button>
        <Button v-if="!isReadOnly" type="button" @click="onSave" :disabled="loading" class="gap-2 w-full sm:w-auto">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          {{ isEditMode ? "Update" : "Simpan" }}
        </Button>
      </div>
    </form>

    <!-- ================================================================ -->
    <!-- OVER SQ PRICE WARNING DIALOG -->
    <!-- ================================================================ -->
    <Dialog :open="isOverSqPriceDialogOpen" @update:open="isOverSqPriceDialogOpen = $event">
      <DialogContent class="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2 text-orange-600">
            <span class="text-2xl">⚠️</span>
            Peringatan: Harga Melebihi Harga Supplier Quotation
          </DialogTitle>
          <DialogDescription>Beberapa item memiliki harga yang melebihi harga yang telah disepakati dalam Supplier Quotation</DialogDescription>
        </DialogHeader>
        <div class="py-4 space-y-4">
          <div class="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
            <p class="text-sm text-orange-800 dark:text-orange-200 mb-2"><span class="font-bold">{{ itemsWithOverSqPrice.length }} item</span> memiliki harga PO yang melebihi harga Supplier Quotation.</p>
            <p class="text-xs text-orange-700 dark:text-orange-300">Apakah Anda yakin ingin melanjutkan penyimpanan?</p>
          </div>
          <div class="border rounded-lg overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-muted sticky top-0">
                <tr>
                  <th class="px-3 py-2 text-left font-semibold">Item</th>
                  <th class="px-3 py-2 text-right font-semibold">Harga SQ</th>
                  <th class="px-3 py-2 text-right font-semibold">Harga PO</th>
                  <th class="px-3 py-2 text-right font-semibold">Selisih</th>
                  <th class="px-3 py-2 text-right font-semibold">+%</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in itemsWithOverSqPrice" :key="index" class="border-t hover:bg-muted/50">
                  <td class="px-3 py-2"><div class="font-medium">{{ item.nama_item || "-" }}</div><div class="text-xs text-muted-foreground">{{ item.kode_item || "-" }}</div></td>
                  <td class="px-3 py-2 text-right font-medium text-green-600">{{ (item.sq_price || 0).toLocaleString("id-ID") }}</td>
                  <td class="px-3 py-2 text-right font-medium text-orange-600">{{ (item.harga || 0).toLocaleString("id-ID") }}</td>
                  <td class="px-3 py-2 text-right font-bold text-destructive">+{{ ((item.harga || 0) - (item.sq_price || 0)).toLocaleString("id-ID") }}</td>
                  <td class="px-3 py-2 text-right font-bold text-destructive">+{{ item.sq_price ? ((((item.harga || 0) - item.sq_price) / item.sq_price) * 100).toFixed(1) : "0" }}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <DialogFooter class="gap-2">
          <Button variant="outline" @click="cancelOverSqPrice" :disabled="loading">Kembali & Periksa</Button>
          <Button variant="default" @click="confirmOverSqPrice" :disabled="loading" class="gap-2 bg-orange-600 hover:bg-orange-700">
            <Save class="h-4 w-4" />
            <span>{{ loading ? "Menyimpan..." : "Ya, Tetap Simpan" }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ================================================================ -->
    <!-- SUPER ADMIN CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <Dialog :open="isSuperAdminDialogOpen" @update:open="isSuperAdminDialogOpen = $event">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <span class="text-yellow-600">⚠️</span>
            Konfirmasi Super Admin
          </DialogTitle>
          <DialogDescription>Anda login sebagai <span class="font-semibold text-primary">SUPER ADMIN</span>.</DialogDescription>
        </DialogHeader>
        <div class="py-4 space-y-4">
          <div class="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <p class="text-sm text-yellow-800 dark:text-yellow-200">
              Data yang Anda {{ isEditMode ? "perbarui" : "buat" }} akan langsung memiliki status
              <span class="font-bold text-green-600 dark:text-green-400">APPROVED</span> tanpa melalui proses approval.
            </p>
          </div>
          <div class="space-y-2 text-sm text-muted-foreground">
            <p>Informasi:</p>
            <ul class="list-disc list-inside space-y-1 ml-2">
              <li>Status akan langsung <span class="font-semibold text-green-600">APPROVED</span></li>
              <li>Tidak perlu menunggu approval dari atasan</li>
              <li>Data dapat langsung digunakan untuk proses selanjutnya</li>
            </ul>
          </div>
        </div>
        <DialogFooter class="gap-2">
          <Button variant="outline" @click="cancelSuperAdminSave" :disabled="loading">Batal</Button>
          <Button variant="default" @click="confirmSuperAdminSave" :disabled="loading" class="gap-2 bg-green-600 hover:bg-green-700">
            <Save class="h-4 w-4" />
            <span>{{ loading ? "Menyimpan..." : "Ya, Simpan dengan APPROVED" }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
