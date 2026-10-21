<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import {
  ref,
  reactive,
  onBeforeMount,
  computed,
  watch,
  readonly,
  isReadonly,
} from "vue";
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
import { ButtonMultiSelect } from "@/components/button";
import { DeleteButton } from "@/components/button";
import { ArrowLeft, Save, Loader2 } from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import {
  FieldX,
  FieldNumber,
  FieldStatus,
  FieldDate,
  FieldSelect,
  FieldPopup,
  FieldTextarea,
  FieldMultiUpload,
} from "@/components/field";
import { useAuthStore } from "@/stores/auth";
import {
  createPurchaseOrderSubcon,
  updatePurchaseOrderSubcon,
  getPurchaseOrderSubconById,
  getPRSubconBahan,
  getPRSubconJadi,
  getPRSubconJasa,
  getStockGudangId,
} from "./service";
import AuditInfo from '@/components/AuditInfo.vue'
import Badge from "@/components/ui/badge/Badge.vue";

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
  () => !!route.params.id && route.name === "PurchaseOrderSubconForm",
);
const isViewMode = computed(() => route.name === "PurchaseOrderSubconView");
const copySourceId = computed(() =>
  String(route.query.copy || route.query.source || ""),
);
const isCopyMode = computed(
  () =>
    route.query.action === "copy" ||
    !!route.query.copy ||
    !!route.query.source,
);
const isStatusLocked = computed(() => {
  if (!isEditMode.value) return false;
  const status = (values.status || "").toUpperCase();
  return !(status === "DRAFT" || status === "REVISI");
});
const isReadOnly = computed(
  () =>
    isViewMode.value ||
    route.meta.readOnly === true ||
    isStatusLocked.value,
);
const menuId = computed(() => route.params.id as string);

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Purchase Order Subcon";
  if (isCopyMode.value) return "Salin Purchase Order Subcon";
  if (isEditMode.value) return "Edit Purchase Order Subcon";
  return "Tambah Purchase Order Subcon Baru";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Purchase Order Subcon";
  if (isCopyMode.value)
    return "Buat Purchase Order Subcon baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Purchase Order Subcon";
  return "Buat Purchase Order Subcon baru";
});

const DEFAULT_CURRENCY_ID = "32a9973a-29cd-4eaf-9849-0175d0542f81";

const setCurrencyDetailFromData = (currency: any) => {
  const details = currency?.m_currency_ds || currency?.m_currency_d || [];
  const activeDetail =
    details.find((detail: any) => detail.is_active === true) || details[0];
  values.m_currency_d_id = activeDetail?.id || "";
};

const fetchCurrencyDetail = async (currencyId: string) => {
  if (!currencyId) {
    values.m_currency_d_id = "";
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
      setCurrencyDetailFromData(result.data);
    }
  } catch (error) {
    console.error("Failed to fetch currency detail:", error);
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

    if (
      result.status === "success" &&
      Array.isArray(result.data) &&
      result.data.length > 0
    ) {
      const idrCurrency = result.data[0];
      values.m_currency_id = idrCurrency.id;
      setCurrencyDetailFromData(idrCurrency);
      return;
    }
  } catch (error) {
    console.error("Failed to fetch default IDR currency:", error);
  }

  values.m_currency_id = DEFAULT_CURRENCY_ID;
  await fetchCurrencyDetail(DEFAULT_CURRENCY_ID);
};

const handleCurrencyInput = async (currencyId: string) => {
  if (!currencyId) {
    await fetchDefaultIDRCurrency();
    return;
  }
  values.m_currency_id = currencyId;
  await fetchCurrencyDetail(currencyId);
};

const handleCurrencySelect = (item: any) => {
  if (item) {
    setCurrencyDetailFromData(item);
    return;
  }
  void fetchDefaultIDRCurrency();
};

// Form values - SAMA SEPERTI Form.txt
let values = reactive({
  m_unit_bisnis_id: "",
  tgl_po: new Date().toISOString().split("T")[0],
  m_supplier_id: "",
  t_purchase_request_subcon_id: "",
  top_id: "",
  ppn_id: "dc697972-3785-4f50-98ff-dfa6a1f9d6fa", // Default: NON PPN
  pph_id: "", // PPH selection from m_general
  m_ekspedisi_id: "",
  no_po: "",
  catatan: "",
  total: 0,
  total_ppn: 0,
  tota_pph: 0, // PPH calculation
  grand_total: 0,
  persen_pph: 0,
  m_currency_id: "",
  m_currency_d_id: "",
  status: "DRAFT",
  status_transksi: "OUTSTANDING",
  // status_transksi: 0,
  gudang_id: "",
  alamat_gudang: "",
  dp: 0,
  dp_persen: 0,
  exchange_rate: 1,
  m_gudang_id: '',
  cara_kirim: "Dikirim Perusahaan",
  created_by: authStore.user?.id || authStore.user?.username || "",
});

const caraKirimOptions = [
  { value: "Dikirim Perusahaan", label: "Dikirim Perusahaan" },
  { value: "Ekspedisi Luar", label: "Ekspedisi Luar" },
];

// Ref untuk menampilkan persentase PPN
const ppnPercentage = ref("0");
// Track PPN type: INCLUDE or EXCLUDE
const ppnType = ref<"INCLUDE" | "EXCLUDE">("EXCLUDE");

// PPH percentage (can be 0%, 2%, 3%, etc.)
const pphPercentage = ref("0");

// Check if current user is Super Admin
const isSuperAdmin = computed(() => {
  const user = authStore.user;
  if (!user || !user.tipe) return false;
  return user.tipe.value1?.toUpperCase() === "SUPER ADMIN";
});

const selectedUnitBisnis = ref<any | null>(null);

// Unit bisnis display for non-super admin from selected respo fallback.
const fallbackUnitBisnisNameDisplay = computed(() => {
  if (!isSuperAdmin.value) {
    try {
      const selectRespo = localStorage.getItem("SelectRespo");
      if (selectRespo) {
        const parsed = JSON.parse(selectRespo);
        return parsed.companyName || parsed.nama_comp || "";
      }
    } catch (e) {
      console.error("Failed to parse SelectRespo:", e);
    }
  }
  return "";
});

const unitBisnisNameDisplay = computed(() => {
  return (
    selectedUnitBisnis.value?.nama_comp ||
    selectedUnitBisnis.value?.nama_unit_bisnis ||
    selectedUnitBisnis.value?.nama ||
    fallbackUnitBisnisNameDisplay.value ||
    ""
  );
});

const selectedCompanyNameDisplay = computed(() => {
  return (
    selectedUnitBisnis.value?.m_company?.nama ||
    selectedUnitBisnis.value?.company?.nama ||
    selectedUnitBisnis.value?.company_name ||
    "-"
  );
});

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {};

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

// Detail arrays - DYNAMIC GENERATION
interface DetailItem {
  qty_po?: number;
  qty_jasa?: number;
  qty_po_bahan?: number;
  harga?: number;
  disc_1?: number;
  disc_2?: number;
  disc_3?: number;
  amt_disc?: number;
}

const detailArr = ref<any[]>([]);
const detailArr2 = ref<any[]>([]);
const detailArr3 = ref<any[]>([]);

const fetchUnitBisnisById = async (unitBisnisId: string) => {
  if (!unitBisnisId) return null;

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
    return result.status === "success" ? result.data : null;
  } catch (error) {
    console.error("Failed to fetch unit bisnis detail:", error);
    return null;
  }
};

const handleUnitBisnisSelected = (unitBisnis: any | null) => {
  selectedUnitBisnis.value = unitBisnis || null;
  values.m_gudang_id = "";
  detailArr.value = [];
  detailArr2.value = [];
  detailArr3.value = [];
};

// ============================================================================
// DETAIL METHODS - DYNAMIC GENERATION
// ============================================================================

const addDetailArr = () => {
  detailArr.value.push({
    kode: "",
    nama_material: "",
    qty: 0,
    uom: "",
    catatan: "",
  });
};

const removeDetailArr = (index: number) => {
  detailArr.value.splice(index, 1);
  toast.info("Detail dihapus");
};

const addDetailArr2 = () => {
  detailArr2.value.push({
    kode: "",
    nama_item: "",
    qty: 0,
    uom: "",
    catatan: "",
  });
};

const removeDetailArr2 = (index: number) => {
  detailArr2.value.splice(index, 1);
  toast.info("Detail dihapus");
};

const addDetailArr3 = () => {
  detailArr3.value.push({
    kode: "",
    nama_jasa: "",
    qty: 0,
    uom: "",
    harga: 0,
    catatan: "",
  });
};

const mapDetailBahan = (item: any) => ({
  id: item.id,
  kode: item.kode_item || item.kode || item.code || "-",
  nama_material: item.nama_material || item.nama_item || item.value1 || "-",
  qty: Number(item.qty) || 1,
  uom: item.uom || item.uom_name || item.value2 || "-",
  catatan: "",
});

const mapDetailFinishGoods = (item: any) => ({
  id: item.id,
  kode: item.kode_item || item.kode || item.code || "-",
  nama_item: item.nama_item || item.nama_material || item.value1 || "-",
  qty: Number(item.qty) || 1,
  uom: item.uom || item.uom_name || item.value2 || "-",
  harga: Number(item.harga) || 0,
  catatan: "",
});

const mapDetailJasa = (item: any) => ({
  id: item.id,
  kode: item.kode_item || item.kode || item.code || "-",
  nama_jasa: item.nama_jasa || item.nama_item || item.value1 || "-",
  qty: Number(item.qty) || 1,
  uom: item.uom || item.uom_name || item.value2 || "-",
  harga: Number(item.harga) || 0,
  catatan: "",
});

const firstValue = (...values: any[]) =>
  values.find((value) => value !== undefined && value !== null && value !== "");

const getDetailList = (source: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    if (Array.isArray(source?.[key])) return source[key];
  }
  return [];
};

const getItemRelation = (detail: any) => {
  return firstValue(
    detail?.m_item,
    detail?.m_items,
    detail?.item,
    detail?.t_purchase_request_subcon_bahan?.m_item,
    detail?.t_purchase_request_subcon_bahan?.m_items,
    detail?.t_purchase_request_subcon_jadi?.m_item,
    detail?.t_purchase_request_subcon_jadi?.m_items,
    detail?.t_purchase_request_subcon_jasa?.m_item,
    detail?.t_purchase_request_subcon_jasa?.m_items,
    {},
  );
};

const getUomRelation = (detail: any) => {
  return firstValue(detail?.m_item.mi_uom, {});
};

const mapLoadedDetailBahan = (detail: any) => {
  const prDetail = firstValue(detail?.t_purchase_request_subcon_bahan, {});
  const item = getItemRelation(detail);
  const uom = getUomRelation(detail);

  return {
    ...detail,
    t_purchase_request_subcon_bahan_id: firstValue(
      detail.t_purchase_request_subcon_bahan_id,
      prDetail.id,
    ),
    t_purchase_request_subcon_id: firstValue(
      detail.t_purchase_request_subcon_id,
      prDetail.t_purchase_request_subcon_id,
    ),
    stock_gudang_id: firstValue(
      detail.stock_gudang_id,
      prDetail.stock_gudang_id,
    ),
    m_items_id: firstValue(detail.m_items_id, prDetail.m_items_id, item.id),
    qty_po_bahan:
      Number(
        firstValue(detail.qty_po_bahan, detail.qty, prDetail.qty_pr_bahan, 0),
      ) || 0,
    uom_id: firstValue(detail.uom_id, prDetail.uom_id),
    harga: Number(firstValue(detail.harga, 0)) || 0,
    catatan: firstValue(detail.catatan, prDetail.catatan, ""),
    kode: firstValue(
      detail.kode,
      detail.kode_item,
      item.kode_item,
      item.kode,
      item.code,
      "-",
    ),
    nama_material: firstValue(
      detail.nama_material,
      detail.nama_item,
      item.nama_item,
      item.nama_material,
      item.value1,
      "-",
    ),
    uom: firstValue(detail.uom_name, detail.satuan, uom.value1),
  };
};

const mapLoadedDetailJadi = (detail: any) => {
  const prDetail = firstValue(detail?.t_purchase_request_subcon_jadi, {});
  const item = getItemRelation(detail);
  const uom = getUomRelation(detail);

  return {
    ...detail,
    t_purchase_request_subcon_jadi_id: firstValue(
      detail.t_purchase_request_subcon_jadi_id,
      prDetail.id,
    ),
    t_purchase_request_subcon_id: firstValue(
      detail.t_purchase_request_subcon_id,
      prDetail.t_purchase_request_subcon_id,
    ),
    m_items_id: firstValue(detail.m_items_id, prDetail.m_items_id, item.id),
    qty_po:
      Number(firstValue(detail.qty_po, detail.qty, prDetail.qty_pr_jadi, 0)) ||
      0,
    qty_ots:
      Number(firstValue(detail.qty_ots, 0)) ||
      0,
    uom_id: firstValue(detail.uom_id, prDetail.uom_id),
    harga: Number(firstValue(detail.harga, 0)) || 0,
    subtotal: Number(firstValue(detail.subtotal, detail.sub_total, 0)) || 0,
    catatan: firstValue(detail.catatan, prDetail.catatan, ""),
    kode: firstValue(detail.kode, detail.kode_item, item.kode_item, "-"),
    nama_item: firstValue(detail.nama_item, item.nama_item, "-"),
    // Perbaikan mapping UOM
    uom: firstValue(
      detail.uom_name,
      detail.satuan,
      uom.value1, // Jalur yang benar berdasarkan JSON Anda (mi_uom -> value1)
      item.uom?.value1,
      "-",
    ),
  };
};

const mapLoadedDetailJasa = (detail: any) => {
  const prDetail = firstValue(detail?.t_purchase_request_subcon_jasa, {});
  const item = getItemRelation(detail);
  const uom = getUomRelation(detail);

  return {
    ...detail,
    t_purchase_request_subcon_jasa_id: firstValue(
      detail.t_purchase_request_subcon_jasa_id,
      prDetail.id,
    ),
    t_purchase_request_subcon_id: firstValue(
      detail.t_purchase_request_subcon_id,
      prDetail.t_purchase_request_subcon_id,
    ),
    m_items_id: firstValue(detail.m_items_id, prDetail.m_items_id, item.id),
    qty_jasa:
      Number(
        firstValue(detail.qty_jasa, detail.qty, prDetail.qty_pr_jasa, 0),
      ) || 0,
    qty_ots: Number(firstValue(detail.qty_ots, 0)) || 0,
    uom_id: firstValue(detail.uom_id, prDetail.uom_id),
    harga: Number(firstValue(detail.harga, 0)) || 0,
    subtotal: Number(firstValue(detail.subtotal, detail.sub_total, 0)) || 0,
    catatan: firstValue(detail.catatan, prDetail.catatan, ""),
    kode: firstValue(
      detail.kode,
      detail.kode_item,
      item.kode_item,
      item.kode,
      item.code,
      "-",
    ),
    nama_item: firstValue(
      detail.nama_item,
      detail.nama_jasa,
      item.nama_item,
      item.nama_jasa,
      item.value1,
      "-",
    ),
    uom: firstValue(
      detail.uom_name,
      detail.satuan,
      typeof uom === "string" ? uom : "",
      uom.value1,
      uom.nama_satuan,
      uom.value2,
      "-",
    ),
  };
};

const getNetto = (detail: {
  qty_po?: number;
  qty_jasa?: number;
  qty_po_bahan?: number;
  harga?: number;
}) => {
  const qty =
    Number(
      firstValue(detail.qty_po, detail.qty_jasa, detail.qty_po_bahan, 0),
    ) || 0;
  const harga = Number(detail.harga) || 0;
  return qty * harga;
};

const getDisplayPpnAmount = (item: any): number => {
  const stored = firstValue(item?.ppn_amount, item?.ppn_total);
  if (stored !== undefined && stored !== null && stored !== "") {
    return Number(stored) || 0;
  }
  return calculateLinePpn(item);
};

const getDisplayPphAmount = (item: any): number => {
  const stored = firstValue(item?.pph_amount, item?.tota_pph);
  if (stored !== undefined && stored !== null && stored !== "") {
    return Number(stored) || 0;
  }
  return calculateLinePph(item);
};

const getDisplayTotalAfterTax = (item: any): number => {
  const stored = firstValue(item?.total_stlh_pajak, item?.grand_total);
  if (stored !== undefined && stored !== null && stored !== "") {
    return Number(stored) || 0;
  }
  return calculateLineTotalAfterTax(item);
};

const initializeTaxStateFromLoadedData = (data: Record<string, any>) => {
  const loadedPpn = firstValue(
    data.po_sc_ppn,
    data.ppn_po,
    data.ppn,
    data.m_ppn,
  );
  const loadedPph = firstValue(
    data.po_sc_pph,
    data.pph_po,
    data.pph,
    data.m_pph,
  );

  if (data.persen_pph !== undefined && data.persen_pph !== null) {
    pphPercentage.value = String(data.persen_pph || "0");
  } else if (loadedPph?.value3 !== undefined && loadedPph?.value3 !== null) {
    pphPercentage.value = String(loadedPph.value3 || "0");
  }

  if (loadedPpn?.value3 !== undefined && loadedPpn?.value3 !== null) {
    ppnPercentage.value = String(loadedPpn.value3 || "0");
    if (loadedPpn.value4 === "INCLUDE") {
      ppnType.value = "INCLUDE";
    } else if (
      typeof loadedPpn.value1 === "string" &&
      loadedPpn.value1.toUpperCase().includes("INCLUDE")
    ) {
      ppnType.value = "INCLUDE";
    } else {
      ppnType.value = "EXCLUDE";
    }
  }
};

const removeDetailArr3 = (index: number) => {
  detailArr3.value.splice(index, 1);
  toast.info("Detail dihapus");
};

// Helper: Calculate line subtotal (qty x price, before any discounts)
const calculateLineSubtotal = (item: DetailItem): number => {
  const qty =
    Number(firstValue(item.qty_po, item.qty_jasa, item.qty_po_bahan, 0)) || 0;
  const price = Number(item.harga) || 0;
  return qty * price;
};

// Helper: Calculate line discount (if any fields exist)
const calculateLineDiscount = (item: DetailItem): number => {
  const qty =
    Number(firstValue(item.qty_po, item.qty_jasa, item.qty_po_bahan, 0)) || 0;
  const price = Number(item.harga) || 0;
  const disc1 = Number(item.disc_1) || 0;
  const disc2 = Number(item.disc_2) || 0;
  const disc3 = Number(item.disc_3) || 0;
  const line = qty * price;
  const discAmount1 = line * (disc1 / 100);
  const afterDisc1 = line - discAmount1;
  const discAmount2 = afterDisc1 * (disc2 / 100);
  const afterDisc2 = afterDisc1 - discAmount2;
  const discAmount3 = afterDisc2 * (disc3 / 100);
  const manualDisc = Number(item.amt_disc) || 0;
  return discAmount1 + discAmount2 + discAmount3 + manualDisc;
};

// Helper: Calculate line total after discount
const calculateLineTotal = (item: DetailItem): number => {
  return calculateLineSubtotal(item) - calculateLineDiscount(item);
};

// Helper: Calculate line PPN based on current PPN type
const calculateLinePpn = (item: DetailItem): number => {
  const rate = Number(ppnPercentage.value || "0") / 100;
  if (rate === 0) return 0;
  const lineTotal = calculateLineTotal(item);
  if (ppnType.value === "INCLUDE") {
    return (lineTotal / (1 + rate)) * rate;
  }
  return lineTotal * rate;
};

// Helper: Calculate line PPH
const calculateLinePph = (item: DetailItem): number => {
  const rate = Number(pphPercentage.value || "0") / 100;
  if (rate === 0) return 0;
  const lineTotal = calculateLineTotal(item);
  const ppnRate = Number(ppnPercentage.value || "0") / 100;
  const baseAmount =
    ppnType.value === "INCLUDE" && ppnRate > 0
      ? lineTotal / (1 + ppnRate)
      : lineTotal;
  return baseAmount * rate;
};

// Helper: Calculate line total after tax (PPN/PPH)
const calculateLineTotalAfterTax = (item: DetailItem): number => {
  const lineTotal = calculateLineTotal(item);
  const linePpn = calculateLinePpn(item);
  const linePph = calculateLinePph(item);
  const rate = Number(ppnPercentage.value || "0") / 100;

  if (ppnType.value === "INCLUDE" && rate > 0) {
    return lineTotal - linePph;
  }

  return lineTotal + linePpn - linePph;
};

// ============================================================================
// COMPUTED TOTALS
// ============================================================================
// SUBTOTAL / DPP: Sum of all detail subtotals (bahan, finish goods, jasa)
const subtotal = computed(() => {
  const allDetails = [
    ...detailArr.value,
    ...detailArr2.value,
    ...detailArr3.value,
  ];

  return allDetails.reduce((sum, item) => {
    return sum + calculateLineSubtotal(item);
  }, 0);
});

const totalDiskon = computed(() => {
  return detailArr.value.reduce((sum, item) => {
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

// TOTAL: Subtotal minus total discounts
const total = computed(() => {
  return subtotal.value - totalDiskon.value;
});

const totalPpn = computed(() => {
  const storedHeaderTotal = Number(initialValues?.total_ppn || 0);
  const storedDetailTotal = [...detailArr2.value, ...detailArr3.value].reduce(
    (sum, item) => sum + Number(item?.ppn_amount || 0),
    0,
  );
  const rate = Number(ppnPercentage.value || "0") / 100;

  if (rate === 0) return storedHeaderTotal || storedDetailTotal || 0;

  // INCLUDE PPN: Total sudah termasuk PPN, jadi perlu diekstrak
  // Formula: PPN = Total / (1 + rate) × rate
  if (ppnType.value === "INCLUDE") {
    return (total.value / (1 + rate)) * rate;
  }

  // EXCLUDE PPN: Total belum termasuk PPN, jadi ditambah
  // Formula: PPN = Total × rate
  return total.value * rate;
});

const totalPph = computed(() => {
  const storedHeaderTotal = Number(
    firstValue(initialValues?.tota_pph, initialValues?.total_pph, 0),
  );
  const storedDetailTotal = [...detailArr2.value, ...detailArr3.value].reduce(
    (sum, item) => sum + Number(item?.pph_amount || 0),
    0,
  );
  const rate = Number(pphPercentage.value || "0") / 100;

  if (rate === 0) return storedHeaderTotal || storedDetailTotal || 0;

  // PPH dihitung dari DPP (total setelah diskon)
  const ppnRate = Number(ppnPercentage.value || "0") / 100;
  const baseAmount =
    ppnType.value === "INCLUDE" && ppnRate > 0
      ? total.value / (1 + ppnRate)
      : total.value;
  return baseAmount * rate;
});

const grandTotal = computed(() => {
  const rate = Number(ppnPercentage.value || "0") / 100;

  // INCLUDE PPN: Grand Total = Total (sudah termasuk PPN) - PPH
  if (ppnType.value === "INCLUDE" && rate > 0) {
    return total.value - totalPph.value;
  }

  // EXCLUDE PPN or NON PPN: Grand Total = Total + PPN - PPH
  return total.value + totalPpn.value - totalPph.value;
});

// DPP (Dasar Pengenaan Pajak)
const dppValue = computed(() => {
  const rate = Number(ppnPercentage.value || "0") / 100;
  if (ppnType.value === "INCLUDE" && rate > 0) {
    return total.value / (1 + rate);
  }
  return total.value;
});

const toNullIfEmpty = (value: any) => (value === "" ? null : value);
const toNumber = (value: any, fallback = 0) => Number(value || fallback);
const getExistingDetailId = (detail: any) =>
  detail?.t_purchase_order_subcon_id ? toNullIfEmpty(detail.id) : undefined;

const cleanPayloadObject = (payload: Record<string, any>) =>
  Object.fromEntries(
    Object.entries(payload)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, toNullIfEmpty(value)]),
  );

const mapBahanPayload = (detail: any, currentUserId: string) =>
  cleanPayloadObject({
    id: getExistingDetailId(detail),
    t_purchase_order_subcon_id: toNullIfEmpty(detail.t_purchase_order_subcon_id),
    t_purchase_request_subcon_bahan_id: toNullIfEmpty(
      detail.t_purchase_request_subcon_bahan_id,
    ),
    m_items_id: toNullIfEmpty(detail.m_items_id),
    qty_po_bahan: toNumber(detail.qty_po_bahan),
    catatan: toNullIfEmpty(detail.catatan),
    created_by: toNullIfEmpty(detail.created_by || currentUserId),
    updated_by: toNullIfEmpty(currentUserId),
    uom_id: toNullIfEmpty(detail.uom_id),
    stock_gudang_id: toNullIfEmpty(detail.stock_gudang_id),
  });

const mapJadiPayload = (detail: any, currentUserId: string) => {
  const subtotalValue = calculateLineTotal(detail);

  return cleanPayloadObject({
    id: getExistingDetailId(detail),
    t_purchase_order_subcon_id: toNullIfEmpty(detail.t_purchase_order_subcon_id),
    t_purchase_request_subcon_jadi_id: toNullIfEmpty(
      detail.t_purchase_request_subcon_jadi_id,
    ),
    m_items_id: toNullIfEmpty(detail.m_items_id),
    qty_po: toNumber(detail.qty_po),
    qty_ots: toNumber(detail.qty_po),
    catatan: toNullIfEmpty(detail.catatan),
    created_by: toNullIfEmpty(detail.created_by || currentUserId),
    updated_by: toNullIfEmpty(currentUserId),
    uom_id: toNullIfEmpty(detail.uom_id),
    total_stlh_pajak: calculateLineTotalAfterTax(detail),
  });
};

const mapJasaPayload = (detail: any, currentUserId: string) => {
  const subtotalValue = calculateLineTotal(detail);

  return cleanPayloadObject({
    id: getExistingDetailId(detail),
    t_purchase_order_subcon_id: toNullIfEmpty(detail.t_purchase_order_subcon_id),
    t_purchase_request_subcon_jasa_id: toNullIfEmpty(
      detail.t_purchase_request_subcon_jasa_id,
    ),
    m_items_id: toNullIfEmpty(detail.m_items_id),
    qty_jasa: toNumber(detail.qty_jasa),
    qty_ots: toNumber(detail.qty_jasa),
    subtotal: subtotalValue,
    harga: toNumber(detail.harga),
    catatan: toNullIfEmpty(detail.catatan),
    created_by: toNullIfEmpty(detail.created_by || currentUserId),
    updated_by: toNullIfEmpty(currentUserId),
    uom_id: toNullIfEmpty(detail.uom_id),
    ppn_amount: calculateLinePpn(detail),
    pph_amount: calculateLinePph(detail),
    total_stlh_pajak: calculateLineTotalAfterTax(detail),
  });
};

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    m_unit_bisnis_id: "",
    tgl_po: new Date().toISOString().split("T")[0],
    m_supplier_id: "",
    t_purchase_request_subcon_id: "",
    top_id: "",
    ppn_id: "dc697972-3785-4f50-98ff-dfa6a1f9d6fa", // Default: NON PPN
    pph_id: "", // PPH selection from m_general
    is_ekspedisi: "",
    m_ekspedisi_id: "",
    no_po: "",
    catatan: "",
    total: 0,
    total_ppn: 0,
    tota_pph: 0, // PPH calculation
    grand_total: 0,
    persen_pph: 0,
    m_currency_id: "",
    m_currency_d_id: "",
    status: "DRAFT",
    status_transksi: "OUTSTANDING",
    gudang_id: "",
    alamat_gudang: "",
    dp: 0,
    m_gudang_id: "",
    dp_persen: 0,
    exchange_rate: 1,
    cara_kirim: "Dikirim Perusahaan",
    created_by: authStore.user?.id || authStore.user?.username || "",
  });

  // Reset errors
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });

  // Reset detail arrays - DYNAMIC
  detailArr.value = [];
  detailArr2.value = [];
  detailArr3.value = [];
  selectedUnitBisnis.value = null;
};

watch(
  () => values.m_unit_bisnis_id,
  async (unitBisnisId) => {
    if (!unitBisnisId) {
      selectedUnitBisnis.value = null;
      return;
    }

    const selectedId = String(selectedUnitBisnis.value?.id || "");
    if (
      selectedId === String(unitBisnisId) &&
      selectedUnitBisnis.value?.m_company
    ) {
      return;
    }

    selectedUnitBisnis.value = await fetchUnitBisnisById(unitBisnisId);
  },
);

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
      // ignore parse error
    }
  }

  // Check if copy mode via query param
  const isCopyModeLocal =
    route.query.action === "copy" || !!route.query.copy || !!route.query.source;
  const hasCopySource = isCopyModeLocal && !!copySourceId.value;
  const sourceId = hasCopySource ? copySourceId.value : menuId.value;

  if (!(isEditMode.value || isViewMode.value || hasCopySource)) {
    if (!values.m_currency_id) {
      await fetchDefaultIDRCurrency();
    } else if (!values.m_currency_d_id) {
      await fetchCurrencyDetail(values.m_currency_id);
    }
    return;
  }

  loading.value = true;
  try {
    const res = await getPurchaseOrderSubconById(sourceId);

    if (res.status !== "success") throw new Error("Gagal memuat data");
    initialValues = res.data;

    auditMeta.value = {
      created_by: initialValues.created_by,
      createdAt: initialValues.createdAt,
      updated_by: initialValues.update_by || initialValues.updated_by,
      updatedAt: initialValues.updatedAt,
    };

    // Minimal normalisasi
    if (initialValues.is_active !== undefined) {
      const v = initialValues.is_active;
      initialValues.is_active = v === true || v === 1 || v === "1";
    } else {
      initialValues.is_active = true;
    }

    // Load detail items dari response edit/detail dan normalisasi ke field tabel.
    detailArr.value = getDetailList(initialValues, [
      "t_purchase_order_subcon_bahans",
    ]).map(mapLoadedDetailBahan);

    detailArr2.value = getDetailList(initialValues, [
      "t_purchase_order_subcon_jadis",
    ]).map(mapLoadedDetailJadi);

    detailArr3.value = getDetailList(initialValues, [
      "t_purchase_order_subcon_jasas",
    ]).map(mapLoadedDetailJasa);
    // Mode copy: hapus id dan timestamps agar jadi create baru
    if (hasCopySource) {
      delete (initialValues as any).id;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
      delete (initialValues as any).t_purchase_request_subcon_id;
      // Sesuai kebutuhan: saat copy, detail PO Subcon dikosongkan
      detailArr.value = [];
      detailArr2.value = [];
      detailArr3.value = [];
    }

    // Assign hanya key yang sudah ada di state reactive values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore dynamic assign
        values[key] = initialValues[key];
      }
    }

    // Block edit untuk record dengan status terkunci (bukan DRAFT/REVISI)
    if (isEditMode.value && isStatusLocked.value) {
      toast.error("Tidak dapat mengedit", {
        description: `Data dengan status ${values.status} tidak dapat diubah`,
      });
      router.replace("/purchasing/subcon/t_purchase_order_subcon");
      return;
    }

    selectedUnitBisnis.value =
      initialValues.m_unit_bisnis ||
      initialValues.m_unit_bisni ||
      initialValues.unit_bisnis ||
      selectedUnitBisnis.value;

    initializeTaxStateFromLoadedData(initialValues);

    if (!values.m_currency_id) {
      await fetchDefaultIDRCurrency();
    } else if (!values.m_currency_d_id) {
      await fetchCurrencyDetail(values.m_currency_id);
    }

    if (values.dp && grandTotal.value > 0) {
      values.dp_persen = Number(
        ((Number(values.dp) / grandTotal.value) * 100).toFixed(2),
      );
    }

    if (hasCopySource) {
      toast.success("Data berhasil disalin", {
        description:
          "Silakan edit dan simpan sebagai Purchase Order Subcon baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Purchase Order Subcon", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () =>
          router.push("/purchasing/subcon/t_purchase_order_subcon"),
      },
    });
    setTimeout(
      () => router.push("/purchasing/subcon/t_purchase_order_subcon"),
      2000,
    );
  } finally {
    loading.value = false;
  }
});

// Errors object (manual validation) - SAMA SEPERTI Form.txt
const errors = reactive({
  m_supplier_id: "",
  m_unit_bisnis_id: "",
  m_gudang_id: "",
  cara_kirim: "",
  top_id: "",
  ppn_id: "",
  pph_id: "",
  m_ekspedisi_id: "",
});

// ============================================================================
// SAVE HANDLER - SAMA SEPERTI Form.txt + DETAIL
// ============================================================================
const onSave = async () => {
  // reset error
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });

  let invalid = false;

  // VALIDATION
  if (!values.m_unit_bisnis_id?.trim()) {
    errors.m_unit_bisnis_id = "Unit Bisnis wajib diisi";
    invalid = true;
  }

  if (!values.m_supplier_id?.trim()) {
    errors.m_supplier_id = "Supplier wajib diisi";
    invalid = true;
  }

  if (!values.top_id?.trim()) {
    errors.top_id = "TOP wajib diisi";
    invalid = true;
  }

  if (!values.m_currency_id) {
    await fetchDefaultIDRCurrency();
  } else if (!values.m_currency_d_id) {
    await fetchCurrencyDetail(values.m_currency_id);
  }

  if (!values.m_currency_id || !values.m_currency_d_id) {
    toast.error("Currency wajib diisi", {
      description: "Mata uang dan detail kurs belum lengkap",
    });
    invalid = true;
  }

  // optional:
  // validasi detail minimal 1
  if (
    detailArr.value.length === 0 &&
    detailArr2.value.length === 0 &&
    detailArr3.value.length === 0
  ) {
    toast.error("Minimal harus ada 1 detail item");
    invalid = true;
  }

  const invalidHargaItems = [...detailArr3.value].filter(
    (item: any) => !item.harga || Number(item.harga) <= 0,
  );
  if (invalidHargaItems.length > 0) {
    toast.error("Harga wajib diisi", {
      description: `${invalidHargaItems.length} item belum memiliki harga`,
    });
    return;
  }

  if (invalid) {
    toast.error("Validasi gagal", {
      description: "Mohon lengkapi semua field yang wajib diisi",
    });
    return;
  }

  loading.value = true;

  try {
    const currentUserId = authStore.user?.id || authStore.user?.username || "";
    // 1. Susun Payload Awal
    const rawPayload: any = {
      no_po: values.no_po,
      tgl_po: values.tgl_po,
      m_supplier_id: values.m_supplier_id,
      t_purchase_request_subcon_id: values.t_purchase_request_subcon_id,
      top_id: values.top_id,
      pph_id: values.pph_id,
      ppn_id: values.ppn_id,
      catatan: values.catatan,
      created_by: values.created_by || currentUserId,
      updated_by: currentUserId,
      status: values.status || "DRAFT",
      m_unit_bisnis_id: values.m_unit_bisnis_id,
      total: Number(total.value || 0),
      total_ppn: Number(totalPpn.value || 0),
      tota_pph: Number(totalPph.value || 0),
      persen_pph: Number(pphPercentage.value || 0),
      grand_total: Number(grandTotal.value || 0),
      m_currency_d_id: values.m_currency_d_id,
      m_currency_id: values.m_currency_id,
      dp: Number(values.dp || 0),
      exchange_rate: Number(values.exchange_rate || 1),
      m_gudang_id: values.m_gudang_id || null,
      m_ekspedisi_id: values.m_ekspedisi_id,
      is_ekspedisi: values.cara_kirim?.toLowerCase() === "ekspedisi luar",
      status_transksi: values.status_transksi || "OUTSTANDING",

      // Detail Mapping
      t_purchase_order_subcon_bahans: detailArr.value.map((d: any) =>
        mapBahanPayload(d, currentUserId),
      ),
      t_purchase_order_subcon_jadis: detailArr2.value.map((d: any) =>
        mapJadiPayload(d, currentUserId),
      ),
      t_purchase_order_subcon_jasas: detailArr3.value.map((d: any) =>
        mapJasaPayload(d, currentUserId),
      ),
    };

    // 2. BERSIHKAN PAYLOAD (Solusi Error UUID & Numeric "")
    // Kita looping semua key, jika nilainya "" (string kosong), ubah ke null
    const payload = cleanPayloadObject(rawPayload);

    console.log("Payload yang dikirim ke API:", payload);

    // Debug payload sebelum dikirim
    console.log("Payload Final:", JSON.stringify(payload, null, 2));

    // Panggil service API Anda
    // await service.savePO(payload);

    if (isEditMode.value) {
      await updatePurchaseOrderSubcon(menuId.value, payload);

      toast.success("Purchase Order Subcon berhasil diperbarui", {
        description: `No. PO "${values.no_po}" berhasil diperbarui`,
      });
    } else {
      await createPurchaseOrderSubcon(payload);

      toast.success("Purchase Order Subcon berhasil dibuat", {
        description: "Data berhasil disimpan",
      });
    }

    router.replace(
      "/purchasing/subcon/t_purchase_order_subcon?reload=" + Date.now(),
    );
  } catch (error) {
    toast.error(
      isEditMode.value
        ? "Gagal memperbarui Purchase Order Subcon"
        : "Gagal membuat Purchase Order Subcon",
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
  router.push("/purchasing/subcon/t_purchase_order_subcon");
};

const handlePpnSelect = (item: any) => {
  if (item && item.value3) {
    ppnPercentage.value = item.value3;
    // Detect PPN type from value1 (label)
    if (item.value1 && item.value1.includes("INCLUDE")) {
      ppnType.value = "INCLUDE";
    } else {
      ppnType.value = "EXCLUDE";
    }
  } else if (item === null) {
    ppnPercentage.value = "0";
    ppnType.value = "EXCLUDE";
  }
};

const handlePphSelect = (item: any) => {
  if (item && item.value3) {
    // Set percentage dari value3, bisa diedit manual nanti
    pphPercentage.value = item.value3;
  } else if (item === null) {
    pphPercentage.value = "0";
  }
};

// Handler untuk manual PPH percentage change
const handlePphPercentageChange = (value: any) => {
  const numValue = Number(value) || 0;
  pphPercentage.value = String(numValue);
};

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
    // Round to whole number for nominal (usually IDR not decimal)
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

const handleSupplierSelect = (item: any) => {
  if (item) {
    values.top_id = item.top_id || "";
  } else {
    values.top_id = "";
  }
};

// Import fungsi service di atas terlebih dahulu
// import { getPRSubconBahan, getPRSubconJadi, getPRSubconJasa } from './service'

const handlePrSelect = async (item: any) => {
  if (!item) {
    values.t_purchase_request_subcon_id = "";
    detailArr.value = [];
    detailArr2.value = [];
    detailArr3.value = [];
    return;
  }

  values.t_purchase_request_subcon_id = item.id;
  values.m_gudang_id = item.m_gudang_id;
  loading.value = true;

  try {
    // Memanggil semua service secara paralel
    const [resBahan, resJadi, resJasa] = await Promise.all([
      getPRSubconBahan(item.id),
      getPRSubconJadi(item.id),
      getPRSubconJasa(item.id),
    ]);

    console.log("resBahan", resBahan);

    // 1. Map Detail Bahan
    if (resBahan.status === "success") {
      detailArr.value = resBahan.data.map((d: any) => ({
        t_purchase_request_subcon_bahan_id: d.id,
        t_purchase_request_subcon_id: d.t_purchase_request_subcon_id,
        stock_gudang_id: d.stock_gudang_id,
        m_items_id: d.m_items_id,
        qty_po_bahan: Number(d.qty_pr_bahan) || 0,
        uom_id: d.uom_id,
        harga: 0,
        catatan: d.catatan || "",
        // Field untuk tampilan di tabel
        kode: d.m_item?.kode_item || "-",
        nama_material: d.m_item?.nama_item || "-",
        uom: d.prqb_sc_uom?.value1 || "-",
      }));
    }

    // 2. Map Detail Barang Jadi
    if (resJadi.status === "success") {
      detailArr2.value = resJadi.data.map((d: any) => ({
        t_purchase_request_subcon_jadi_id: d.id,
        t_purchase_request_subcon_id: d.t_purchase_request_subcon_id,
        m_items_id: d.m_items_id,
        qty_po: Number(d.qty_pr_jadi) || 0,
        qty_ots: (Number(d.qty_ots) ? Number(d.qty_ots) : Number(d.qty_pr_jadi)) || 0,
        uom_id: d.uom_id,
        subtotal: 0,
        catatan: d.catatan || "",
        // Field untuk tampilan di tabel
        kode: d.m_item?.kode_item || "-",
        nama_item: d.m_item?.nama_item || "-",
        uom: d.prqj_sc_uom?.value1 || "-",
      }));
    }

    // 3. Map Detail Jasa
    if (resJasa.status === "success") {
      detailArr3.value = resJasa.data.map((d: any) => ({
        t_purchase_request_subcon_jasa_id: d.id,
        m_items_id: d.m_items_id,
        qty_jasa: Number(d.qty_pr_jasa) || 0,
        qty_ots: (Number(d.qty_ots) ? Number(d.qty_ots) : Number(d.qty_pr_jasa)) || 0,
        uom_id: d.uom_id,
        harga: 0,
        catatan: d.catatan || "",
        // Field untuk tampilan di tabel
        kode: d.m_item?.kode_item || "-",
        nama_item: d.m_item?.nama_item || "-",
        uom: d.m_general?.value1 || "-",
      }));
    }

    toast.success("Berhasil memuat semua detail dari PR");
  } catch (error) {
    console.error("Error fetching PR details:", error);
    toast.error("Gagal mengambil data detail PR");
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
    <!-- ================================================================ -->
    <!-- HEADER SECTION -->
    <!-- ================================================================ -->
    <div class="flex items-center justify-between gap-4">
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
      <Badge variant="secondary" class="uppercase">{{
        values.status || "DRAFT"
      }}</Badge>
    </div>

    <!-- ================================================================ -->
    <!-- FORM SECTION -->
    <!-- ================================================================ -->
    <!-- Form tanpa submit default; penyimpanan melalui tombol onSave -->
    <form class="space-y-6" @submit.prevent>
      <!-- HEADER CARD (tanpa tab) -->
      <Card>
        <CardHeader>
          <CardTitle>Informasi Purchase Order Subcon</CardTitle>
          <CardDescription>
            Isi data PurchaseOrderSubcon dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- company Field -->
              <div class="space-y-2">
                <FieldSelect
                  v-if="isSuperAdmin"
                  id="m_unit_bisnis_id"
                  label="Unit Bisnis"
                  v-model="values.m_unit_bisnis_id"
                  :errorname="errors.m_unit_bisnis_id ? 'failed' : ''"
                  :hints="errors.m_unit_bisnis_id"
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
                      join: 'true',
                      filter_column_is_active: 'true',
                    },
                  }"
                  @update:value-full="handleUnitBisnisSelected"
                  valueField="id"
                  displayField="nama_comp"
                  placeholder="Pilih Unit Bisnis"
                  :clearable="true"
                />
                <FieldX
                  v-else
                  id="m_unit_bisnis_display"
                  label="Unit Bisnis"
                  :value="unitBisnisNameDisplay"
                  :disabled="true"
                  :readonly="true"
                  placeholder="Unit Bisnis dari respo"
                  hints="Unit Bisnis otomatis dari respo yang dipilih"
                />
              </div>
              <div class="space-y-2">
                <FieldX
                  id="company_display"
                  label="Company"
                  :value="selectedCompanyNameDisplay"
                  :disabled="true"
                  :readonly="true"
                  placeholder="Company dari Unit Bisnis"
                  hints="Company otomatis dari Unit Bisnis yang dipilih"
                />
              </div>
              <div class="space-y-2">
                <!-- Tanggal PO -->
                <FieldDate
                  id="tgl_po"
                  label="Tanggal PO"
                  v-model="values.tgl_po"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  placeholder="Pilih Tanggal"
                />
              </div>
            </div>

            <!-- No PO (readonly) -->
            <div class="space-y-2">
              <Label>No. PO</Label>
              <Input
                v-model="values.no_po"
                readonly="true"
                disabled="true"
                placeholder="Auto generate by system"
                class="bg-muted"
              />
            </div>

            <!-- Supplier (Popup) -->
            <FieldPopup
              id="m_supplier_id"
              label="Supplier"
              :value="values.m_supplier_id"
              @input="
                (v: string) => {
                  values.m_supplier_id = v;
                  errors.m_supplier_id = '';
                  if (!v) handleSupplierSelect(null);
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
                  selectfield:
                    'id,nama_supp,alamat_supp,no_telp,top_id,is_tax,is_active,m_currency_id',
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
                  field: 'nama_supp',
                  headerName: 'Nama Supplier',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
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

            <!-- Purchase Request -->
            <FieldPopup
              id="t_purchase_request_subcon_id"
              label="No. PR"
              :value="values.t_purchase_request_subcon_id"
              @input="(v: string) => (values.t_purchase_request_subcon_id = v)"
              :disabled="loading || isReadOnly"
              :required="!isReadOnly"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              placeholder="Pilih Purchase Request"
              displayField="no_pr_subcon"
              @update:value-full="handlePrSelect"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/fn/t_purchase_request_subcon/getPRSubconOutstanding`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
                  searchfield: 'no_pr,catatan',
                  order_by: 'createdAt',
                  order_type: 'DESC',
                  paginate: 20,
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
                  field: 'no_pr_subcon',
                  headerName: 'No. PR. Subcon',
                  width: '200px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'm_unit_bisni.nama_unit_bisnis',
                  headerName: 'Unit Bisnis',
                  width: '150px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                  render: (item: any) => item.m_unit_bisni?.nama_comp || '-',
                },
                {
                  field: 'tgl_pr_subcon',
                  headerName: 'Tanggal',
                  width: '150px',
                  sortable: true,
                },
                {
                  field: 'catatan',
                  headerName: 'Catatan',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
              ]"
            />

                        <!-- Gudang -->
            <FieldSelect
              id="m_gudang_id"
              label="Gudang"
              v-model="values.m_gudang_id"
              :errorname="errors.m_gudang_id ? 'failed' : ''"
              :hints="
                errors.m_gudang_id ||
                (values.m_unit_bisnis_id
                  ? 'Pilih Gudang'
                  : 'Pilih Unit Bisnis terlebih dahulu')
              "
              :required="!isReadOnly"
              @update:value-full="
                (v) => {
                  detailArr = [];
                  detailArr2 = [];
                }
              "
              :disabled="true"
              :readonly="true"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_gudang`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'kode_gudang,nama_gudang',
                  filter_column_is_active: 'true',
                  filter_column_is_gudang_transit: false,
                  filter_column_m_unit_bisnis_id:
                    values.m_unit_bisnis_id || undefined,
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page
                    ? true
                    : false;
                  return response;
                },
              }"
              valueField="id"
              displayField="nama_gudang"
              placeholder="Pilih Gudang"
              :clearable="true"
              class="w-full"
              :key="`gudang-${values.m_unit_bisnis_id}`"
            />
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FieldSelect
                id="ppn_id"
                label="Tipe PPN"
                @update:valueFull="handlePpnSelect"
                :value="values.ppn_id"
                :errorText="errors.ppn_id ? 'failed' : ''"
                @input="(v: string) => (values.ppn_id = v)"
                :hints="errors.ppn_id"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                :clearable="true"
                placeholder="Pilih PPN"
                displayField="value1"
                valueField="id"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_general`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    no_pagination: 'true',
                    selectfield: 'id,value1,value3',
                    search: 'PPN',
                    searchfield: 'group',
                  },
                }"
              />
              <FieldX
                id="ppn_percentage"
                label="PPN (%)"
                :modelValue="ppnPercentage || '0'"
                readonly
                disabled
              />
            </div>

            <!-- PPH + PPH (%) in one row -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FieldSelect
                id="pph_id"
                label="Tipe PPH"
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
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    no_pagination: 'true',
                    selectfield: 'id,value1,value3',
                    search: 'PPH',
                    searchfield: 'group',
                  },
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

            <!-- TOP -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FieldSelect
                id="top_id"
                label="TOP (Termin Pembayaran)"
                :value="values.top_id"
                :required="!isReadOnly"
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
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    no_pagination: 'true',
                    selectfield: 'id,value1',
                    search: 'TERMIN',
                    searchfield: 'group',
                  },
                }"
              />

              <FieldSelect
                id="m_currency_id"
                label="Currency"
                v-model="values.m_currency_id"
                @input="handleCurrencyInput"
                @update:valueFull="handleCurrencySelect"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                :clearable="false"
                placeholder="Pilih Currency"
                displayField="nama_currency"
                valueField="id"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_currency`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    no_pagination: 'true',
                    selectfield: 'id,nama_currency,kode_currency',
                    include: 'm_currency_d,money',
                    filter_column_is_active: true,
                  },
                }"
              />
            </div>

            <!-- DP Amount (Down Payment) -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FieldNumber
                id="dp"
                label="DP (Down Payment) Nominal"
                :model-value="values.dp"
                @update:model-value="handleDpNominalChange"
                :disabled="isReadOnly"
                :min="0"
                type="decimal"
                placeholder="0"
              />
              <FieldNumber
                id="dp_persen"
                label="DP (Down Payment) %"
                :model-value="values.dp_persen"
                @update:model-value="handleDpPersenChange"
                :disabled="isReadOnly"
                :min="0"
                :max="100"
                type="decimal"
                placeholder="0"
                suffix="%"
              />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FieldSelect
                id="cara_kirim"
                label="Cara Kirim"
                v-model="values.cara_kirim"
                :options="caraKirimOptions"
                :errorText="errors.cara_kirim ? 'failed' : ''"
                :hints="errors.cara_kirim"
                :required="!isReadOnly"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="Pilih cara kirim"
              />

              <!-- Ekspedisi (Popup) -->
              <FieldPopup
                id="ekspedisi_id"
                label="Ekspedisi"
                :value="values.m_ekspedisi_id"
                @input="
                  (v: string) => {
                    values.m_ekspedisi_id = v;
                    errors.m_ekspedisi_id = '';
                  }
                "
                :errorText="errors.m_ekspedisi_id ? 'failed' : ''"
                :hints="errors.m_ekspedisi_id"
                :disabled="
                  loading ||
                  isReadOnly ||
                  values.cara_kirim?.toLowerCase() !== 'ekspedisi luar'
                "
                :readonly="isReadOnly"
                :clearable="!isReadOnly"
                :required="
                  !isReadOnly && values.cara_kirim === 'Ekspedisi Luar'
                "
                placeholder="Pilih Ekspedisi"
                displayField="nama"
                valueField="id"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_ekspedisi`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    searchfield: 'nama,kode_ekspedisi,alamat,telepon,cp_kantor',
                    filter_column_is_active: true,
                    include: 'm_tujuan_ekspedisi',
                  },
                  onsuccess: (response: any) => {
                    if (response.data && Array.isArray(response.data)) {
                      // Preprocessing: add formatted kota_tujuan field to each item
                      response.data = response.data.map((item: any) => {
                        if (
                          item.m_tujuan_ekspedisis &&
                          Array.isArray(item.m_tujuan_ekspedisis) &&
                          item.m_tujuan_ekspedisis.length > 0
                        ) {
                          item.kota_tujuan = item.m_tujuan_ekspedisis
                            .map(
                              (d: any) => `${d.nama_kota} (${d.nama_provinsi})`,
                            )
                            .join(', ');
                        } else {
                          item.kota_tujuan = item.tujuan_kirim || '-';
                        }
                        return item;
                      });
                    }
                    response.hasNext = response.pagination?.next_page
                      ? true
                      : false;
                    return response;
                  },
                }"
                :columns="[
                  {
                    field: 'nama',
                    headerName: 'Nama Ekspedisi',
                    width: '150px',
                    sortable: true,
                    filterable: true,
                    filter: 'ColFilter',
                  },
                  {
                    field: 'kode_ekspedisi',
                    headerName: 'Kode Ekspedisi',
                    width: '150px',
                    sortable: true,
                    filterable: true,
                    filter: 'ColFilter',
                  },
                  {
                    field: 'kota_tujuan',
                    headerName: 'Kota Tujuan',
                    width: '180px',
                    sortable: false,
                    filterable: false,
                    renderHtml: (item: any) => {
                      const text = item.kota_tujuan || '-';
                      return `<div style='white-space: normal; word-wrap: break-word; overflow-wrap: break-word; max-width: 180px; line-height: 1.4;'>${text}</div>`;
                    },
                  },
                  {
                    field: 'alamat',
                    headerName: 'Alamat',
                    width: '180px',
                    sortable: true,
                    filterable: true,
                    filter: 'ColFilter',
                    renderHtml: (item: any) => {
                      const text = item.alamat || '-';
                      return `<div style='white-space: normal; word-wrap: break-word; overflow-wrap: break-word; max-width: 180px; line-height: 1.4;'>${text}</div>`;
                    },
                  },
                  {
                    field: 'telepon',
                    headerName: 'No. Telp',
                    width: '120px',
                    sortable: true,
                    filterable: true,
                    filter: 'ColFilter',
                  },
                  {
                    field: 'cp_kantor',
                    headerName: 'CP Kantor',
                    width: '100px',
                    sortable: true,
                    filterable: true,
                    filter: 'ColFilter',
                  },
                ]"
                :customRender="
                  (item: any) => {
                    const cities =
                      item?.m_tujuan_ekspedisis &&
                      item.m_tujuan_ekspedisis.length > 0
                        ? item.m_tujuan_ekspedisis
                            .map(
                              (d: any) => `${d.nama_kota} (${d.nama_provinsi})`,
                            )
                            .join(', ')
                        : item?.tujuan_kirim || '';
                    return cities
                      ? `<div class='text-xs text-muted-foreground mt-1'>Tujuan: ${cities}</div>`
                      : '';
                  }
                "
              />
            </div>

            <FieldX
              id="status"
              label="Status"
              :value="values.status"
              :disabled="loading"
              :readonly="true"
              placeholder="Status PO"
              hints="Status akan otomatis berubah sesuai proses approval"
            />
            <!-- Catatan -->
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
        </CardContent>
      </Card>

      <!-- DETAIL TABS (di bawah header card) -->
      <Tabs default-value="detail1" class="w-full">
        <TabsList
          class="w-full overflow-x-auto flex justify-start scrollbar-hide"
        >
          <TabsTrigger value="detail1">Detail Bahan</TabsTrigger>
          <TabsTrigger value="detail2">Detail Finish Goods</TabsTrigger>
          <TabsTrigger value="detail3">Detail Jasa</TabsTrigger>
        </TabsList>

        <!-- DETAIL TAB CONTENTS - DYNAMIC GENERATION -->

        <!-- TAB CONTENT: DETAIL 1 (MULTI-SELECT) -->
        <TabsContent value="detail1" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Bahan</CardTitle>
                  <CardDescription
                    >Kelola item detail bahan dengan multi
                    select</CardDescription
                  >
                </div>
                <!-- <ButtonMultiSelect v-if="!isReadOnly" title="+ Add to List" @add="(items: any[]) => {
                  items.forEach(item => {
                    if (!detailArr.find((d: any) => d.id === item.id)) {
                      detailArr.push(mapDetailBahan(item))
                    }
                  })
                }" :api="{
                  url: `${API_BASE_URL}/dynamic/m_general`,
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authStore.token}`
                  },
                  params: {
                    searchfield: 'group,key1,code,value1',
                    filter_column_is_active: true
                  },
                  onsuccess: (response: any) => {
                    response.hasNext = response.pagination?.next_page ? true : false
                    return response
                  }
                }" :columns="[
                  {
                    field: 'kode',
                    headerName: 'Kode',
                    width: '150px',
                    sortable: true,
                    filterable: true
                  },
                  {
                    field: 'nama_item',
                    headerName: 'Nama Material',
                    flex: 1,
                    sortable: true,
                    filterable: true
                  },
                  {
                    field: 'uom',
                    headerName: 'UoM',
                    width: '100px',
                    sortable: false,
                    filterable: false
                  }
                ]" :disabled="loading" /> -->
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        No
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Kode
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Nama Material
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Qty
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        UoM
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Catatan
                      </th>
                      <th
                        v-if="!isReadOnly"
                        class="px-2 py-2 text-center font-medium text-xs sm:text-sm"
                      >
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr.length === 0">
                      <td
                        :colspan="isReadOnly ? 6 : 7"
                        class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                      >
                        Belum ada item dipilih. Klik "Add to List" untuk
                        menambahkan.
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, idx) in detailArr"
                      :key="detail.id || idx"
                      class="border-t hover:bg-muted/50"
                    >
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ idx + 1 }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.kode }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.nama_material }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldNumber
                          v-model="detail.qty_po_bahan"
                          :disabled="true"
                          :readonly="true"
                          :min="0"
                          placeholder="0"
                          class="w-24"
                        />
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.uom }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldX
                          v-model="detail.catatan"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          placeholder="Catatan"
                        />
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                        <DeleteButton
                          variant="ghost"
                          size="sm"
                          @click="removeDetailArr(idx)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- TAB CONTENT: DETAIL 2 (MULTI-SELECT) -->
        <TabsContent value="detail2" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Finish Goods</CardTitle>
                  <CardDescription
                    >Kelola item detail finish goods dengan multi
                    select</CardDescription
                  >
                </div>
                <!-- <ButtonMultiSelect v-if="!isReadOnly" title="+ Add to List" @add="(items: any[]) => {
                  items.forEach(item => {
                    if (!detailArr2.find((d: any) => d.id === item.id)) {
                      detailArr2.push(mapDetailFinishGoods(item))
                    }
                  })
                }" :api="{
                  url: `${API_BASE_URL}/dynamic/m_general`,
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authStore.token}`
                  },
                  params: {
                    searchfield: 'group,key1,code,value1',
                    filter_column_is_active: true
                  },
                  onsuccess: (response: any) => {
                    response.hasNext = response.pagination?.next_page ? true : false
                    return response
                  }
                }" :columns="[
                  {
                    field: 'kode',
                    headerName: 'Kode',
                    width: '150px',
                    sortable: true,
                    filterable: true
                  },
                  {
                    field: 'nama_item',
                    headerName: 'Nama Item',
                    flex: 1,
                    sortable: true,
                    filterable: true
                  },
                  {
                    field: 'uom',
                    headerName: 'UoM',
                    width: '100px',
                    sortable: false,
                    filterable: false
                  }
                ]" :disabled="loading" /> -->
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        No
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Kode
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Nama Item
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm w-20"
                      >
                        Qty
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm w-20"
                      >
                        Qty Ots.
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm w-16"
                      >
                        UoM
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm min-w-[220px]"
                      >
                        Catatan
                      </th>
                      <th
                        v-if="!isReadOnly"
                        class="px-2 py-2 text-center font-medium text-xs sm:text-sm"
                      >
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr2.length === 0">
                      <td
                        :colspan="isReadOnly ? 11 : 12"
                        class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                      >
                        Belum ada item dipilih. Klik "Add to List" untuk
                        menambahkan.
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, index) in detailArr2"
                      :key="detail.id || index"
                      class="border-t hover:bg-muted/50"
                    >
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ index + 1 }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.kode }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.nama_item }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm w-20">
                        <FieldNumber
                          v-model="detail.qty_po"
                          :disabled="true"
                          :readonly="true"
                          :min="0"
                          placeholder="0"
                          class="w-24"
                        />
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.qty_ots }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm w-16">
                        {{ detail.uom }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldX
                          v-model="detail.catatan"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          placeholder="Catatan"
                        />
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                        <DeleteButton
                          variant="ghost"
                          size="sm"
                          @click="removeDetailArr2(index)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- TAB CONTENT: DETAIL 3 (MULTI-SELECT) -->
        <TabsContent value="detail3" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Jasa</CardTitle>
                  <CardDescription
                    >Kelola item detail jasa dengan multi
                    select</CardDescription
                  >
                </div>
                <!-- <ButtonMultiSelect v-if="!isReadOnly" title="+ Add to List" @add="(items: any[]) => {
                  items.forEach(item => {
                    if (!detailArr3.find((d: any) => d.id === item.id)) {
                      detailArr3.push(mapDetailJasa(item))
                    }
                  })
                }" :api="{
                  url: `${API_BASE_URL}/dynamic/m_general`,
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authStore.token}`
                  },
                  params: {
                    searchfield: 'group,key1,code,value1',
                    filter_column_is_active: true
                  },
                  onsuccess: (response: any) => {
                    response.hasNext = response.pagination?.next_page ? true : false
                    return response
                  }
                }" :columns="[
                  {
                    field: 'kode',
                    headerName: 'Kode',
                    width: '150px',
                    sortable: true,
                    filterable: true
                  },
                  {
                    field: 'nama_jasa',
                    headerName: 'Nama Jasa',
                    flex: 1,
                    sortable: true,
                    filterable: true
                  },
                  {
                    field: 'uom',
                    headerName: 'UoM',
                    width: '100px',
                    sortable: false,
                    filterable: false
                  }
                ]" :disabled="loading" /> -->
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        No
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Kode
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Nama Jasa
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm w-20"
                      >
                        Qty
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm w-20"
                      >
                        Qty Ots.
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm w-16"
                      >
                        UoM
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm w-24"
                      >
                        Harga
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm w-28"
                      >
                        Total
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm w-24"
                      >
                        PPN
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm w-24"
                      >
                        PPH
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm w-32"
                      >
                        Total Stlh Pajak
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm min-w-[220px]"
                      >
                        Catatan
                      </th>
                      <th
                        v-if="!isReadOnly"
                        class="px-2 py-2 text-center font-medium text-xs sm:text-sm"
                      >
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr3.length === 0">
                      <td
                        :colspan="isReadOnly ? 11 : 12"
                        class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                      >
                        Belum ada item dipilih. Klik "Add to List" untuk
                        menambahkan.
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, index) in detailArr3"
                      :key="detail.id || index"
                      class="border-t hover:bg-muted/50"
                    >
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ index + 1 }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.kode }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.nama_item }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm w-20">
                        <FieldNumber
                          v-model="detail.qty_jasa"
                          :disabled="true"
                          :readonly="true"
                          :min="0"
                          placeholder="0"
                          class="w-24"
                        />
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.qty_ots }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm w-16">
                        {{ detail.uom }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm w-24">
                        <FieldNumber
                          v-model="detail.harga"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          :min="0"
                          placeholder="0"
                          :class="
                            !isReadOnly && (!detail.harga || detail.harga <= 0)
                              ? 'w-24 border-destructive focus-visible:ring-destructive'
                              : 'w-24'
                          "
                        />
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm w-28">
                        {{ getNetto(detail).toLocaleString("id-ID") }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm w-24">
                        {{ getDisplayPpnAmount(detail).toLocaleString("id-ID") }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm w-24">
                        {{ getDisplayPphAmount(detail).toLocaleString("id-ID") }}
                      </td>
                      <td
                        class="px-3 py-2 text-xs sm:text-sm w-32 text-primary font-semibold"
                      >
                        {{
                          getDisplayTotalAfterTax(detail).toLocaleString(
                            "id-ID",
                          )
                        }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldX
                          v-model="detail.catatan"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          placeholder="Catatan"
                        />
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                        <DeleteButton
                          variant="ghost"
                          size="sm"
                          @click="removeDetailArr3(index)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <!-- SUMMARY TOTALS -->
      <div
        class="mt-4 w-full max-w-xl overflow-hidden rounded-lg border bg-background text-sm"
      >
        <div
          class="grid grid-cols-[minmax(140px,1fr)_minmax(160px,2fr)] border-b"
        >
          <div class="px-4 py-2 text-muted-foreground">
            <div class="font-medium text-foreground">DPP</div>
            <div
              v-if="ppnType === 'INCLUDE' && Number(ppnPercentage || '0') > 0"
              class="text-xs text-muted-foreground"
            >
              (tagihan/1+Tarif pajak >=
              {{ total.toLocaleString("id-ID") }}/{{
                (1 + Number(ppnPercentage || "0") / 100).toFixed(2)
              }})
            </div>
          </div>
          <div class="px-4 py-2 text-right font-semibold">
            {{ dppValue.toLocaleString("id-ID") }}
          </div>
        </div>
        <div
          class="grid grid-cols-[minmax(140px,1fr)_minmax(160px,2fr)] border-b"
        >
          <div class="px-4 py-2 text-muted-foreground">
            Total PPN ({{ ppnPercentage || "0" }}%)
          </div>
          <div class="px-4 py-2 text-right font-semibold">
            {{ totalPpn.toLocaleString("id-ID") }}
          </div>
        </div>
        <div
          class="grid grid-cols-[minmax(140px,1fr)_minmax(160px,2fr)] border-b"
        >
          <div class="px-4 py-2 text-muted-foreground">
            Total PPH ({{ pphPercentage || "0" }}%)
          </div>
          <div class="px-4 py-2 text-right font-semibold">
            {{ totalPph.toLocaleString("id-ID") }}
          </div>
        </div>
        <div class="grid grid-cols-[minmax(140px,1fr)_minmax(160px,2fr)]">
          <div class="px-4 py-2 font-semibold">Grand Total</div>
          <div class="px-4 py-2 text-right font-bold">
            {{ grandTotal.toLocaleString("id-ID") }}
          </div>
        </div>
      </div>

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

/* Hide scrollbar but keep scrollable functionality */
.scrollbar-hide {
  -ms-overflow-style: none;
  /* IE and Edge */
  scrollbar-width: none;
  /* Firefox */
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
  /* Chrome, Safari, Opera */
}
</style>
