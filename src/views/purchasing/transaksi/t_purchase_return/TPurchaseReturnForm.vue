<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed, watch, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FieldX,
  FieldNumber,
  FieldPopup,
  FieldSelect,
  FieldDate,
  FieldRadio,
  FieldUpload,
} from "@/components/field";
import { ButtonMultiSelect } from "@/components/button";
import {
  ArrowLeft,
  Save,
  Loader2,
  Trash2,
  ChevronDown,
  Eye,
  X,
} from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createTPurchaseReturn,
  updateTPurchaseReturn,
  approveTPurchaseReturn,
  getTPurchaseReturnById,
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
  () => !!route.params.id && route.name === "TPurchaseReturnForm",
);
const isViewMode = computed(() => route.name === "TPurchaseReturnView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);

const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const todayDate = formatLocalDate(new Date());

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Purchase Return";
  if (isCopyMode.value) return "Salin Purchase Return";
  if (isEditMode.value) return "Edit Purchase Return";
  return "Tambah Purchase Return Baru";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Purchase Return";
  if (isCopyMode.value)
    return "Buat Purchase Return baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Purchase Return";
  return "Buat Purchase Return baru";
});

// Super Admin check
const isSuperAdmin = computed(() => {
  const user = authStore.user as any;
  return user?.tipe?.value1?.toUpperCase() === "SUPER ADMIN";
});

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

// Form values
const values = reactive({
  no_return: "",
  tgl_retur: todayDate,
  status: "DRAFT",
  m_unit_bisnis_id: "",
  m_supplier_id: "",
  top_id: "",
  nama_supp:"",
  m_gudang_id: "",
  tiper_retur: "",
  m_currency_id: "", // Selected by user
  m_currency_d_id: "", // Active currency detail (exchange rate)
  catatan: "",
  total: 0,
  total_diskon: 0,
  total_ppn: 0,
  total_pph: 0,
  grand_total: 0,
  dpp_lainnya: 0,
  created_by: authStore.user?.id || "",
  is_pi_pb: false,
});

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {};

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

// Detail items
const detailItems = ref<any[]>([]);

// Ref untuk menyimpan data currency yang dipilih
const selectedCurrencyData = ref<any>(null);


// Breakdown section toggle
const isBreakdownOpen = ref(false);

// 🔧 Flag untuk skip watcher saat initial load (prevent reset detail items)
const isInitialLoad = ref(true);

// Radio options untuk is_pi_pb (Referensi PB atau PI)
const referensiOptions = [
  { label: "PB (Penerimaan Barang)", value: "true" },
  { label: "PI (Purchase Invoice)", value: "false" },
];

const normalizePpnType = (value?: string): "INCLUDE" | "EXCLUDE" => {
  const raw = String(value || "").toUpperCase();
  return raw.includes("INCLUDE") ? "INCLUDE" : "EXCLUDE";
};

const toNumber = (value: any): number => Number(value) || 0;

const getPiBaseQty = (item: any): number =>
  toNumber(item.base_qty_pi ?? item.qty_pi);

const getPiEffectiveQty = (item: any): number => {
  const qtyRetur = toNumber(item.qty_retur);
  return qtyRetur > 0 ? qtyRetur : getPiBaseQty(item);
};

const getPiProrateRatio = (item: any): number => {
  const baseQty = getPiBaseQty(item);
  if (baseQty <= 0) return 0;
  return getPiEffectiveQty(item) / baseQty;
};

const hasPiBaseFinancials = (item: any): boolean => {
  if (getPiBaseQty(item) <= 0) return false;
  return (
    toNumber(item.base_subtotal) > 0 ||
    toNumber(item.base_disc_total) > 0 ||
    toNumber(item.base_ppn_amt) > 0 ||
    toNumber(item.base_pph_amt) > 0 ||
    toNumber(item.base_grand_total) > 0
  );
};

// ============================================================================
// COMPUTED - CURRENCY & EXCHANGE RATE
// ============================================================================
// Exchange rate dari API atau default
const exchangeRateDisplay = computed(() => {
  if (
    selectedCurrencyData.value &&
    selectedCurrencyData.value.m_currency_ds &&
    selectedCurrencyData.value.m_currency_ds.length > 0
  ) {
    const activeRate = selectedCurrencyData.value.m_currency_ds.find(
      (d: any) => d.is_active === true,
    );
    if (activeRate) {
      return Number(activeRate.rate) || 1;
    }
    return Number(selectedCurrencyData.value.m_currency_ds[0].rate) || 1;
  }
  return 1;
});

const exchangeRateDateTime = computed(() => {
  if (
    selectedCurrencyData.value &&
    selectedCurrencyData.value.m_currency_ds &&
    selectedCurrencyData.value.m_currency_ds.length > 0
  ) {
    const rateData = selectedCurrencyData.value.m_currency_ds[0];
    const date = new Date(rateData.tgl_mulai);
    const dateStr = date.toLocaleDateString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const timeStr = date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${dateStr} ${timeStr}`;
  }
  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${dateStr} ${timeStr}`;
});

const currencyName = computed(
  () => selectedCurrencyData.value?.money?.value1 || "",
);
const currencyCode = computed(
  () => selectedCurrencyData.value?.money?.value5 || "",
);
const currencySymbol = computed(
  () => selectedCurrencyData.value?.money?.value2 || "",
);
const isCurrencyRupiah = computed(() => {
  const code = currencyCode.value.toUpperCase();
  return code === "IDR" || code === "RP" || code === "RUPIAH";
});

const effectivePpnPercentage = computed(() => {
  const item = detailItems.value.find(
    (i: any) => Number(i.ppn_percentage || 0) > 0,
  );
  return item ? String(item.ppn_percentage) : "0";
});

const effectivePphPercentage = computed(() => {
  const item = detailItems.value.find(
    (i: any) => Number(i.pph_percentage || 0) > 0,
  );
  return item ? String(item.pph_percentage) : "0";
});

const effectivePpnType = computed<"INCLUDE" | "EXCLUDE">(() => {
  const item = detailItems.value.find(
    (i: any) => Number(i.ppn_percentage || 0) > 0,
  );
  return (item?.ppn_type as "INCLUDE" | "EXCLUDE") || "EXCLUDE";
});

// Computed untuk konversi is_pi_pb boolean <-> string (untuk FieldRadio)
const referensiValue = computed({
  get: () => String(values.is_pi_pb),
  set: (val: string) => {
    values.is_pi_pb = val === "true";
  },
});

// Gudang API config - filtered by m_unit_bisnis_id and m_supplier_id
const gudangApiConfig = computed(() => {
  const params: any = {
    searchfield: "kode_gudang,nama_gudang",
    filter_column_is_active: "true",
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
    onsuccess: (response: any) => {
      response.hasNext = response.pagination?.next_page ? true : false;
      return response;
    },
  };
});

// Tipe Retur API config - filter out GANTI BARANG when PI is selected
const tipeReturApiConfig = computed(() => {
  // Force reactivity by reading is_pi_pb
  const isPB = values.is_pi_pb;

  const params: any = {
    no_pagination: "true",
    selectfield: "id,value1",
    filter_column_group: "TIPE_RETUR",
    filter_column_is_active: "true",
  };

  // Jika PI (is_pi_pb === false), exclude "GANTI BARANG" via notin parameter
  if (!isPB) {
    params.notin = "value1:GANTI BARANG";
  }

  return {
    url: `${API_BASE_URL}/dynamic/m_general`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authStore.token}`,
    },
    params,
    onsuccess: (response: any) => {
      response.hasNext = response.pagination?.next_page ? true : false;
      return response;
    },
  };
});

// Alasan Return API config
const alasanReturnApiConfig = {
  url: `${API_BASE_URL}/dynamic/m_general`,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authStore.token}`,
  },
  params: {
    no_pagination: "true",
    selectfield: "id,value1",
    filter_column_key1: "alasan_return",
    filter_column_is_active: "true",
  },
};

// ============================================================================
// ERRORS
// ============================================================================
const errors = reactive({
  m_supplier_id: "",
  m_gudang_id: "",
  tiper_retur: "",
});

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    no_return: "",
    tgl_retur: new Date().toISOString().split("T")[0],
    status: "DRAFT",
    m_unit_bisnis_id: "",
    m_supplier_id: "",
    top_id: "",
    m_gudang_id: "",
    tiper_retur: "",
    m_currency_id: "", // Will be set from PB/PI selection
    m_currency_d_id: "",
    catatan: "",
    total: 0,
    total_diskon: 0,
    total_ppn: 0,
    total_pph: 0,
    grand_total: 0,
    dpp_lainnya: 0,
    created_by: authStore.user?.id || "",
    is_pi_pb: false,
  });

  // Reset errors
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });

  // Reset detail items
  detailItems.value = [];
};

const getRackDisplay = (source: any): string => {
  const directName = source?.nama_rak_detail || source?.rak_display;
  if (directName) return String(directName);

  const rakDetail = source?.m_rak_d;
  if (rakDetail?.kode) {
    return `${rakDetail.kode} (${rakDetail?.m_rak?.nama_rak || "-"})`;
  }

  const nestedRakDetail = source?.t_penerimaan_barang_d?.m_rak_d;
  if (nestedRakDetail?.kode) {
    return `${nestedRakDetail.kode} (${nestedRakDetail?.m_rak?.nama_rak || "-"})`;
  }

  const nestedRakDetailAlt = source?.tpenerimaan_bd?.m_rak_d;
  if (nestedRakDetailAlt?.kode) {
    return `${nestedRakDetailAlt.kode} (${nestedRakDetailAlt?.m_rak?.nama_rak || "-"})`;
  }

  return "-";
};

// ============================================================================
// LOAD DEFAULT VALUES
// ============================================================================
// Load default Rupiah currency
const loadDefaultRupiahCurrency = async () => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_currency?no_pagination=true&selectfield=id,nama_currency,kode_currency&filter_column_is_active=true&include=m_currency_d,money`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    const result = await response.json();
    if (result.status === "success" && result.data && result.data.length > 0) {
      // Find Rupiah by checking money.value5 === 'IDR' or nama_currency contains 'Rupiah'
      const rupiahCurrency = result.data.find(
        (curr: any) =>
          curr.money?.value5 === "IDR" ||
          curr.nama_currency?.toLowerCase().includes("rupiah"),
      );
      if (rupiahCurrency) {
        values.m_currency_id = rupiahCurrency.id;
        selectedCurrencyData.value = rupiahCurrency;
        // Auto-set m_currency_d_id from active currency detail (first active or first available)
        const details = rupiahCurrency.m_currency_ds || [];
        const activeDetail = details.find((d: any) => d.is_active === true) || details[0];
        if (activeDetail && activeDetail.id) {
          values.m_currency_d_id = activeDetail.id;
        }
      }
    }
  } catch (error) {
    console.error("Error loading default Rupiah currency:", error);
  }
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
      console.error("Failed to parse SelectRespo:", e);
    }
  }

   // Create mode setup (currency will be set when needed)
   if (!isEditMode.value && !isViewMode.value && !isCopyMode.value) {
     // Load default IDR currency only for PI reference (PB doesn't need currency)
     if (!values.is_pi_pb) {
       await loadDefaultRupiahCurrency();
     }
     isInitialLoad.value = false;
     return;
   }

  // Check if copy mode via query param
  const isCopyModeLocal = route.query.action === "copy" && route.query.source;
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value;

  loading.value = true;
  try {
    const res = await getTPurchaseReturnById(sourceId, values.is_pi_pb);

    if (res.status !== "success") throw new Error("Gagal memuat data");
    initialValues = res.data;

    auditMeta.value = {
      created_by: initialValues.created_by,
      createdAt: initialValues.createdAt,
      updated_by: initialValues.update_by || initialValues.updated_by,
      updatedAt: initialValues.updatedAt,
    };

    // Minimal normalisasi
    if (initialValues.is_pi_pb !== undefined) {
      const v = initialValues.is_pi_pb;
      initialValues.is_pi_pb = v === true || v === 1 || v === "1";
    } else {
      initialValues.is_pi_pb = false;
    }

    // 🔧 PENTING: Set values.is_pi_pb SEBELUM load detail items
    // Ini memastikan watcher ter-trigger sekarang (dan di-skip karena isInitialLoad = true)
    // Bukan setelah detail items di-load yang akan menyebabkan reset
    values.is_pi_pb = initialValues.is_pi_pb;
    values.nama_supp = initialValues.m_supplier?.nama_supp

     // Load detail items - mapping data dari API response
     if (
       initialValues.t_purchase_return_d ||
       initialValues.t_purchase_return_ds
     ) {
       const rawDetails =
         initialValues.t_purchase_return_d ||
         initialValues.t_purchase_return_ds ||
         [];

       detailItems.value = rawDetails.map((item: any, idx: number) => {
         // ===================================================================
         // 🔍 MAPPING NESTED DATA BERDASARKAN REFERENSI (PB atau PI)
         // ===================================================================

         // 1. Master Item (selalu ada)
         const mItem = item.m_item || {};

         // 2. Mapping berdasarkan is_pi_pb (dengan type assertion untuk bypass TS error)
         let pbD: any = {}; // Penerimaan Barang Detail
         let piD: any = {}; // Purchase Invoice Detail
         let poD: any = {}; // Purchase Order Detail
         let noPenerimaan = "-";
         let noPo = "-";

         if (initialValues.is_pi_pb) {
           // ✅ MODE PB (is_pi_pb = true): Referensi dari Penerimaan Barang
           pbD = item.pb_d || {};
           poD = pbD.t_purchase_order || {};
           // Extract no_penerimaan from t_penerimaan_barang
           noPenerimaan = pbD.t_penerimaan_barang?.no_penerimaan || "-";
           noPo = poD?.no_po || "-";
         } else {
           // ✅ MODE PI (is_pi_pb = false): Referensi dari Purchase Invoice
           piD = item.pi_d || {};
           pbD = piD.t_penerimaan_barang_d || piD.tpenerimaan_bd || {};
           poD = piD.t_purchase_order || {};
           noPo = poD?.no_po || "-";
           // PI mode doesn't show no_penerimaan column
         }

         const po = poD?.t_purchase_order || poD || {};
         const ppnPo = po.ppn_po || {};
         const pphPo = po.pph_po || {};
         const ppnPercentageValue =
           item.ppn_percentage ?? ppnPo.value3 ?? "0";
         const pphPercentageValue =
           item.pph_percentage ?? pphPo.value3 ?? po.persen_pph ?? "0";
         const ppnTypeValue = normalizePpnType(
           item.ppn_type || ppnPo.value4 || ppnPo.value1,
         );
         const baseQtyPi = Number(piD.qty_pi || item.qty_pi || 0);
         const grossPiAmount =
           baseQtyPi * Number(piD.harga || item.harga || poD.harga || 0);
         const baseSubtotal = Number(
           piD.subtotal ?? item.base_subtotal ?? 0,
         );
         const derivedDiscTotal =
           grossPiAmount > 0 ? grossPiAmount - baseSubtotal : 0;
         const baseDiscTotal = Number(
           piD.total_diskon ??
             item.base_disc_total ??
             derivedDiscTotal,
         );
         const basePpnAmt = Number(
           piD.ppn_amt ?? item.base_ppn_amt ?? item.ppn_amt ?? 0,
         );
         const basePphAmt = Number(
           piD.pph_amt ?? item.base_pph_amt ?? item.pph_amt ?? 0,
         );
         const baseGrandTotal = Number(
           piD.grand_total ??
             item.base_grand_total ??
             baseSubtotal + basePpnAmt,
         );

         // ===================================================================
         // 🔄 MAPPING FIELDS KE DETAIL ITEM
         // ===================================================================
         const mappedItem = {
           id: item.id || undefined, // preserve t_purchase_return_d.id for edit mode
           t_purchase_return_id: item.t_purchase_return_id || undefined,
           m_items_id: item.m_items_id || mItem.id || "",
           t_penerimaan_barangs_id:
             pbD.t_penerimaan_barangs_id || item.t_penerimaan_barangs_id || null,
           t_purchase_invoice_id:
             piD.t_purchase_invoice_id || item.t_purchase_invoice_id || null,

           // Mapping dari m_item
           kode: mItem.kode_item || item.kode_item || item.kode || "",
           kode_item: mItem.kode_item || item.kode_item || "",
           nama_item: mItem.nama_item || item.nama_item || "",
           satuan:
             mItem.uom?.value1 || mItem.mi_uom?.value1 || item.satuan || "",
           rak_display:
             getRackDisplay(pbD) !== "-"
               ? getRackDisplay(pbD)
               : getRackDisplay(item),
           no_po: noPo,
           no_penerimaan: noPenerimaan,

           // Mapping qty dari relasi
           qty_pb: Number(pbD.qty_diterima || item.qty_pb || 0),
           qty_pi: Number(piD.qty_pi || item.qty_pi || 0),
           base_qty_pi: baseQtyPi,

           // Mapping diskon dari PO (fallback ke item langsung)
           disc_1: piD.r_disc1 ?? poD.disc_1 ?? item.disc_1 ?? "0",
           disc_2: piD.r_disc2 ?? poD.disc_2 ?? item.disc_2 ?? "0",
           disc_3: piD.r_disc3 ?? poD.disc_3 ?? item.disc_3 ?? "0",
           amt_disc:
             piD.disc_amt ??
             poD.amt_disc ??
             item.amt_disc ??
             item.disc_amt ??
             "0",

           // Harga dari item langsung atau PO (prioritas: item.harga > poD.harga)
           harga: Number(piD.harga || item.harga || poD.harga || 0),

           // Field lainnya
           qty_retur: Number(item.qty_retur || 0),
           batch: item.batch || pbD.batch || "",
           alasan: item.alasan || "",
           alasan_text: item.alasan_return?.value1 || "",
           catatan: item.catatan || "",

           // IDs untuk relasi
           t_purchase_invoice_d_id: item.t_purchase_invoice_d_id || null,
           t_penerimaan_barang_d_id: item.t_penerimaan_barang_d_id || null,
           m_satuan_id: mItem.uom?.id || item.m_satuan_id || "",
           uom_id: mItem.uom?.id || item.uom_id || item.m_satuan_id || "",

           // Foto bukti
           bukti_foto: item.bukti_foto || "",

           // PPN & PPH per item
           ppn_id: item.ppn_id || po.ppn_id || "",
           ppn_percentage: String(ppnPercentageValue || "0"),
           ppn_type: ppnTypeValue,
           ppn_amt: basePpnAmt,
           pph_id: item.pph_id || po.pph_id || "",
           pph_percentage: String(pphPercentageValue || "0"),
           pph_amt: basePphAmt,
           base_subtotal: baseSubtotal,
           base_disc_total: baseDiscTotal,
           base_ppn_amt: basePpnAmt,
           base_pph_amt: basePphAmt,
           base_grand_total: baseGrandTotal,

           // Calculated fields (akan di-recalculate setelah mapping)
           disc_total: 0,
           total: 0,
         };
         return mappedItem;
       });

       // Recalculate totals untuk setiap item
       detailItems.value.forEach((item: any, index: number) => {
         updateLineTotal(index);
       });
      }

     // Mode copy: hapus id, no_return, dan timestamps agar jadi create baru
    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).no_return;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;

      // Hapus id dari setiap detail item juga
      detailItems.value = detailItems.value.map((item: any) => {
        const { id, t_purchase_return_id, createdAt, updatedAt, ...rest } =
          item;
        return rest;
      });
    }

    // Assign hanya key yang sudah ada di state reactive values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // Konversi numeric fields ke Number
        const numericFields = [
          "total",
          "total_diskon",
          "total_ppn",
          "total_pph",
          "grand_total",
          "dpp_lainnya",
        ];
        if (numericFields.includes(key)) {
          // @ts-ignore dynamic assign
          values[key] = Number(initialValues[key]) || 0;
        } else {
          // @ts-ignore dynamic assign
          values[key] = initialValues[key];
        }
      }
    }

    // Load currency data if exists (use saved detail for edit mode)
    if (values.m_currency_id) {
      if (isEditMode.value || isCopyModeLocal) {
        // Edit/Copy mode: use saved m_currency_d from initialValues if available
        const savedCurrency = (initialValues as any).m_currency;
        const savedCurrencyDetail = (initialValues as any).m_currency_d;
        if (savedCurrency && savedCurrencyDetail) {
          selectedCurrencyData.value = {
            id: savedCurrency.id,
            kode_currency: savedCurrency.kode_currency,
            nama_currency: savedCurrency.nama_currency,
            money: savedCurrency.money,
            m_currency_ds: [
              {
                id: savedCurrencyDetail.id,
                tgl_mulai: savedCurrencyDetail.tgl_mulai,
                rate: savedCurrencyDetail.rate,
                is_active: savedCurrencyDetail.is_active,
              },
            ],
          };
          values.m_currency_d_id = savedCurrencyDetail.id;
        } else {
          // Fallback to fetch
          await handleCurrencySelect({ id: values.m_currency_id });
        }
      } else {
        // Create mode already handled in onBeforeMount; this block unlikely needed
        await handleCurrencySelect({ id: values.m_currency_id });
      }
    }

    // 🔧 PENTING: Set isInitialLoad = false SETELAH semua data di-assign
    // Ini mencegah watcher is_pi_pb me-reset detailItems saat initial load
    await nextTick();
    isInitialLoad.value = false;

    if (isCopyModeLocal) {
      toast.success("Data berhasil disalin", {
        description: "Silakan edit dan simpan sebagai Purchase Return baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Purchase Return", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () => router.push("/purchasing/transaksi/t_purchase_return"),
      },
    });
    setTimeout(
      () => router.push("/purchasing/transaksi/t_purchase_return"),
      2000,
    );
  } finally {
    loading.value = false;
  }
});

// ============================================================================
// HANDLERS
// ============================================================================
const handleSupplierSelect = (item: any) => {
  // Clear related fields when supplier changes
  // values.m_currency_id = ""; 
  // values.m_currency_d_id = "";
  // selectedCurrencyData.value = null;
  values.top_id = item?.top_id || "";
  detailItems.value = [];
  calculateGrandTotal();
  if (item) {
    toast.info("Detail items direset karena supplier berubah");
  }
};

// Helper: construct photo URL for detail row bukti_foto
const getDetailPhotoUrl = (value: string): string => {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("blob:") || value.startsWith("data:")) return value;
  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, "");
  if (value.startsWith("uploads/")) return `${baseUrl}/${value}`;
  return `${baseUrl}/uploads/${value}`;
};

// Preview foto popup state
const previewFotoUrl = ref("");
const showFotoPreview = ref(false);

const openFotoPreview = (bukti_foto: string) => {
  previewFotoUrl.value = getDetailPhotoUrl(bukti_foto);
  showFotoPreview.value = true;
};

const handleCurrencySelect = async (item: any) => {
  if (item && item.id) {
    try {
      // Fetch currency data dengan exchange rate
      const response = await fetch(
        `${API_BASE_URL}/dynamic/m_currency/${item.id}?include=m_currency_d,money`,
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
        // Set m_currency_d_id dari active detail (atau first available)
        const details = result.data?.m_currency_ds || [];
        const activeDetail = details.find((d: any) => d.is_active === true) || details[0];
        if (activeDetail && activeDetail.id) {
          values.m_currency_d_id = activeDetail.id;
        }
      }
    } catch (error) {
      console.error("Error fetching currency:", error);
    }
  } else {
    selectedCurrencyData.value = null;
    values.m_currency_d_id = "";
  }
};

const mapPbHeaderToReturnDetails = (header: any) => {
  const details = header.t_penerimaan_barang_ds || [];
  if (!details.length) return [];

  return details.map((detail: any) => ({
    ...detail,
    no_penerimaan: header.no_penerimaan,
    tgl_penerimaan: header.tgl_penerimaan,
    m_supplier: header.m_supplier,
    no_sj_supp: header.no_sj_supp,
    t_penerimaan_barang_ds: header.t_penerimaan_barang_ds,
    t_penerimaan_barang_d_id: detail.id,
    id: detail.id,
  }));
};

const mapPiHeaderToReturnDetails = (header: any) => {
  const details = header.t_purchase_invoice_ds || [];
  if (!details.length) return [];

  return details.map((detail: any) => {
    const penerimaanDetail =
      detail.tpenerimaan_bd || detail.t_penerimaan_barang_d || {};

    return {
      ...detail,
      no_pi: header.no_pi,
      tgl_pi: header.tgl_pi,
      tgl_jatuh_tempo: header.tgl_jatuh_tempo,
      m_supplier: header.m_supplier,
      m_currency: header.m_currency,
      m_currency_id: header.m_currency_id,
      m_currency_d_id: header.m_currency_d_id,
      po_ppn_id: header.po_ppn_id,
      po_pph_id: header.po_pph_id,
      po_ppn: header.po_ppn,
      po_pph: header.po_pph,
      persen_pph: header.persen_pph,
      t_purchase_invoice_id: header.id,
      t_purchase_invoice_d_id: detail.t_purchase_invoice_d_id || detail.id,
      t_penerimaan_barang_d_id:
        detail.t_penerimaan_barang_d_id || penerimaanDetail.id || null,
    };
  });
};

const normalizeReturnPopupResponse = (response: any) => {
  if (!response.data || !Array.isArray(response.data)) {
    return response;
  }

  if (values.is_pi_pb) {
    const existingPbDetailIds = new Set(
      detailItems.value.map((d: any) => d.t_penerimaan_barang_d_id),
    );

    response.data = response.data.filter((header: any) => {
      const details = header.t_penerimaan_barang_ds || [];
      if (!details.length) return false;

      return details.some((detail: any) => !existingPbDetailIds.has(detail.id));
    });

    return response;
  }

  const existingPiDetailIds = new Set(
    detailItems.value.map((d: any) => d.t_purchase_invoice_d_id).filter(Boolean),
  );

  response.data = response.data.filter((header: any) => {
    const details = header.t_purchase_invoice_ds || [];
    if (!details.length) return false;

    return details.some((detail: any) => {
      const detailId = detail.t_purchase_invoice_d_id || detail.id;
      return !existingPiDetailIds.has(detailId);
    });
  });

  return response;
};




const handleAddDetailItems = (items: any[]) => {
  const selectableItems = values.is_pi_pb
    ? items.flatMap((header: any) => mapPbHeaderToReturnDetails(header))
    : items.flatMap((header: any) => mapPiHeaderToReturnDetails(header));

  const referenceKey = values.is_pi_pb
    ? "t_penerimaan_barang_d_id"
    : "t_purchase_invoice_d_id";
  const existingIds = new Set(
    detailItems.value.map((detail: any) => detail[referenceKey]),
  );
  const newItems = selectableItems.filter((item: any) => {
    const referenceId = item[referenceKey] || item.id;
    return !existingIds.has(referenceId);
  });

  if (newItems.length === 0) {
    toast.warning("Tidak ada item baru", {
      description: "Semua item yang dipilih sudah ada di detail",
    });
    return;
  }

  if (newItems.length < selectableItems.length) {
    toast.info("Beberapa item dilewati", {
      description: `${selectableItems.length - newItems.length} item sudah ada di detail`,
    });
  }

  newItems.forEach((item: any) => {
    const penerimaanDetail =
      item.tpenerimaan_bd || item.t_penerimaan_barang_d || {};
    const noPb =
      item.no_penerimaan ||
      item.no_pb ||
      penerimaanDetail?.t_penerimaan_barang?.no_penerimaan ||
      "";

    const masterItem = item.m_item || item.m_items || {};
    const poDetail = item.t_purchase_order_d || {};
    const poHeader = item.t_purchase_order || poDetail.t_purchase_order || {};
    const ppnPo = poHeader.ppn_po || {};
    const pphPo = poHeader.pph_po || {};
    const ppnPercentageValue = item.ppn_percentage ?? ppnPo.value3 ?? "0";
    const pphPercentageValue =
      item.pph_percentage ?? pphPo.value3 ?? poHeader.persen_pph ?? "0";
    const ppnTypeValue = normalizePpnType(
      item.ppn_type || ppnPo.value4 || ppnPo.value1,
    );
    const qtyPiSource = Number(item.qty_pi || 0);
    const hargaSource = Number(item.harga || poDetail.harga || 0);
    const grossPiAmount = qtyPiSource * hargaSource;
    const baseSubtotal = Number(item.subtotal ?? item.total ?? 0);
    const derivedDiscTotal =
      grossPiAmount > 0 ? grossPiAmount - baseSubtotal : 0;
    const baseDiscTotal = Number(
      item.total_diskon ?? item.disc_total ?? derivedDiscTotal,
    );
    const basePpnAmt = Number(item.ppn_amt ?? 0);
    const basePphAmt = Number(item.pph_amt ?? 0);
    const baseGrandTotal = Number(
      item.grand_total ?? baseSubtotal + basePpnAmt,
    );

    const newItem: any = {
      m_items_id: masterItem.id || item.m_items_id || "",
      t_penerimaan_barangs_id:
        item.t_penerimaan_barangs_id || item.t_penerimaan_barang_id || null,
      batch: item.batch || penerimaanDetail?.batch || "",
      kode: masterItem.kode_item || item.kode_item || "-",
      nama_item: masterItem.nama_item || item.nama_item || "-",
      no_po: poHeader.no_po || "-",
      no_penerimaan: noPb,
      qty_pb: values.is_pi_pb
        ? Number(item.qty_pb || item.qty_diterima || 0)
        : Number(
            penerimaanDetail?.qty_diterima ||
              item.qty_pb ||
              0,
          ),
      qty_pi: values.is_pi_pb ? 0 : qtyPiSource,
      base_qty_pi: values.is_pi_pb ? 0 : qtyPiSource,
      qty_retur: values.is_pi_pb ? Number(item.qty_sisa_return || 0) : 0,
      qty_sisa_return: Number(item.qty_sisa_return || 0),
      m_satuan_id: masterItem.uom_id || item.m_satuan_id || "",
      uom_id: masterItem.uom_id || item.uom_id || item.m_satuan_id || "",
      rak_display: getRackDisplay(item),
      satuan: masterItem.mi_uom?.value1 || masterItem.uom?.value1 || "",
      harga: values.is_pi_pb
        ? Number(poDetail.harga || item.harga || 0)
        : hargaSource,
      disc_1: values.is_pi_pb
        ? poDetail.disc_1 || item.disc_1 || "0"
        : item.r_disc1 ?? poDetail.disc_1 ?? item.disc_1 ?? "0",
      disc_2: values.is_pi_pb
        ? poDetail.disc_2 || item.disc_2 || "0"
        : item.r_disc2 ?? poDetail.disc_2 ?? item.disc_2 ?? "0",
      disc_3: values.is_pi_pb
        ? poDetail.disc_3 || item.disc_3 || "0"
        : item.r_disc3 ?? poDetail.disc_3 ?? item.disc_3 ?? "0",
      amt_disc: values.is_pi_pb
        ? poDetail.amt_disc || item.amt_disc || "0"
        : item.disc_amt ?? poDetail.amt_disc ?? item.disc_amt ?? "0",
      disc_total: 0,
      total: 0,
      alasan: "",
      alasan_text: "",
      catatan: "",
      bukti_foto: "",
      ppn_id: item.ppn_id || poHeader.ppn_id || "",
      ppn_percentage: String(ppnPercentageValue || "0"),
      ppn_type: ppnTypeValue,
      ppn_amt: values.is_pi_pb ? 0 : basePpnAmt,
      pph_id: item.pph_id || poHeader.pph_id || "",
      pph_percentage: String(pphPercentageValue || "0"),
      pph_amt: values.is_pi_pb ? 0 : basePphAmt,
      base_subtotal: values.is_pi_pb ? 0 : baseSubtotal,
      base_disc_total: values.is_pi_pb ? 0 : baseDiscTotal,
      base_ppn_amt: values.is_pi_pb ? 0 : basePpnAmt,
      base_pph_amt: values.is_pi_pb ? 0 : basePphAmt,
      base_grand_total: values.is_pi_pb ? 0 : baseGrandTotal,
    };

    if (values.is_pi_pb) {
      newItem.t_penerimaan_barang_d_id =
        item.t_penerimaan_barang_d_id || item.id || null;
    } else {
      newItem.t_purchase_invoice_d_id =
        item.t_purchase_invoice_d_id || item.id || null;
      newItem.t_penerimaan_barang_d_id =
        item.t_penerimaan_barang_d_id ||
        penerimaanDetail?.id ||
        null;
      newItem.t_purchase_invoice_id =
        item.t_purchase_invoice_id || null;
    }

    detailItems.value.push(newItem);
  });

  detailItems.value.forEach((_: any, index: number) => updateLineTotal(index));
  toast.success(`${newItems.length} item berhasil ditambahkan`);
};

const getUniqueReferenceId = (items: any[], key: string) => {
  const ids = Array.from(
    new Set(items.map((item: any) => item[key]).filter(Boolean)),
  );
  return ids.length === 1 ? ids[0] : null;
};

const getUniqueValueOrNull = (items: any[], key: string) => {
  const values = Array.from(
    new Set(items.map((item: any) => item[key]).filter(Boolean)),
  );
  return values.length === 1 ? values[0] : null;
};

// ============================================================================
// SAVE HANDLER - SAMA SEPERTI Form.txt + DETAIL
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });
  let invalid = false;

  if (!values.tgl_retur || values.tgl_retur < todayDate) {
    toast.error("Validasi gagal", {
      description: "Tanggal Return tidak boleh lebih awal dari hari ini",
    });
    return;
  }

  if (!values.m_supplier_id?.trim()) {
    errors.m_supplier_id = "Supplier wajib diisi";
    invalid = true;
  }
  if (!values.m_gudang_id?.trim()) {
    errors.m_gudang_id = "Gudang wajib diisi";
    invalid = true;
  }
  if (!values.tiper_retur?.trim()) {
    errors.tiper_retur = "Tipe Retur wajib diisi";
    invalid = true;
  }

  if (invalid) {
    toast.error("Validasi gagal", {
      description: "Mohon lengkapi semua field yang wajib diisi",
    });
    return;
  }

  // Validasi detail items
  if (detailItems.value.length === 0) {
    toast.error("Validasi gagal", {
      description: "Detail item tidak boleh kosong. Tambahkan minimal 1 item.",
    });
    return;
  }

  // Validasi qty_retur dan harga
  const invalidQtyItems = detailItems.value.filter(
    (item: any) => !item.qty_retur || item.qty_retur <= 0,
  );
  if (invalidQtyItems.length > 0) {
    const itemNames = invalidQtyItems
      .map((item: any) => item.kode || item.nama_item)
      .join(", ");
    toast.error("Validasi gagal", {
      description: `Qty Retur harus lebih dari 0 pada item: ${itemNames}`,
    });
    return;
  }

  // Validasi harga untuk mode PI (is_pi_pb = false)
  if (!values.is_pi_pb) {
    const invalidHargaItems = detailItems.value.filter(
      (item: any) => !item.harga || item.harga <= 0,
    );
    if (invalidHargaItems.length > 0) {
      const itemNames = invalidHargaItems
        .map((item: any) => item.kode || item.nama_item)
        .join(", ");
    toast.error("Validasi gagal", {
      description: `Harga harus lebih dari 0 pada item: ${itemNames}`,
    });
    return;
  }
  }

  // Validasi alasan
  const invalidAlasanItems = detailItems.value.filter(
    (item: any) => !item.alasan || !item.alasan.trim(),
  );
  if (invalidAlasanItems.length > 0) {
    const itemNames = invalidAlasanItems
      .map((item: any) => item.kode || item.nama_item)
      .join(", ");
    toast.error("Validasi gagal", {
      description: `Alasan wajib diisi pada item: ${itemNames}`,
    });
    return;
  }

  loading.value = true;
  try {
    const isPBReference = values.is_pi_pb;
    const headerPbId = getUniqueReferenceId(
      detailItems.value,
      "t_penerimaan_barangs_id",
    );
    const headerPiId = getUniqueReferenceId(
      detailItems.value,
      "t_purchase_invoice_id",
    );
    // const headerPpnId = getUniqueValueOrNull(detailItems.value, "ppn_id");
    // const headerPphId = getUniqueValueOrNull(detailItems.value, "pph_id");

    // Clean payload: convert empty strings to null + TAMBAH DETAIL
    const payload: any = {
      no_return: values.no_return?.trim() || null,
      tgl_retur: values.tgl_retur || null,
      status: values.status || "DRAFT",
      m_unit_bisnis_id: values.m_unit_bisnis_id?.trim() || null,
      m_supplier_id: values.m_supplier_id?.trim() || null,
      top_id: values.top_id?.trim() || null,
      t_penerimaan_barangs_id: isPBReference ? headerPbId : null,
      t_purchase_invoice_id: isPBReference ? null : headerPiId,
      m_gudang_id: values.m_gudang_id?.trim() || null,
      tiper_retur: values.tiper_retur?.trim() || null,
      m_currency_id: isPBReference ? null : values.m_currency_id?.trim() || null,
      m_currency_d_id: isPBReference
        ? null
        : values.m_currency_d_id?.trim() || null,
      catatan: values.catatan?.trim() || null,
      total: isPBReference ? null : values.total || 0,
      total_diskon: isPBReference ? null : values.total_diskon || 0,
      total_ppn: isPBReference ? null : values.total_ppn || 0,
      total_pph: isPBReference ? null : values.total_pph || 0,
      grand_total: isPBReference ? null : values.grand_total || 0,
      dpp_lainnya: isPBReference ? null : values.dpp_lainnya || 0,
      created_by: values.created_by,
      updated_by: isEditMode.value ? authStore.user?.id || null : null,
      is_pi_pb: values.is_pi_pb || false,
      t_purchase_return_ds: detailItems.value.map((item: any) => {
        const subtotal = isPBReference ? null : Number(item.total) || 0;
        const ppnAmt = isPBReference ? null : calculateLinePpn(item);
        const pphAmt = isPBReference ? null : calculateLinePph(item);
        const lineGrandTotal = isPBReference
          ? null
          : calculateLineGrandTotal(item);
        const cleanItem: any = {
          ...(item.id ? { id: item.id } : {}),
          ...(item.t_purchase_return_id
            ? { t_purchase_return_id: item.t_purchase_return_id }
            : {}),
          m_items_id: item.m_items_id || null,
          qty_retur: Number(item.qty_retur) || 0,
          qty_pb: Number(item.qty_pb) || 0,
          qty_pi: isPBReference ? null : Number(item.qty_pi) || 0,
          harga: isPBReference ? null : Number(item.harga) || 0,
          batch: item.batch || null,
          alasan: item.alasan?.trim() || null,
          catatan: item.catatan?.trim() || null,
          t_purchase_invoice_d_id: isPBReference
            ? null
            : item.t_purchase_invoice_d_id || null,
          ppn_id: isPBReference ? null : item.ppn_id || null,
          pph_id: isPBReference ? null : item.pph_id || null,
          t_penerimaan_barang_d_id: item.t_penerimaan_barang_d_id || null,
          bukti_foto: item.bukti_foto || null,
          uom_id: item.uom_id || item.m_satuan_id || null,
          r_disc1: isPBReference ? null : Number(item.disc_1) || 0,
          r_disc2: isPBReference ? null : Number(item.disc_2) || 0,
          r_disc3: isPBReference ? null : Number(item.disc_3) || 0,
          disc_amt: isPBReference ? null : Number(item.amt_disc) || 0,
          total_diskon: isPBReference ? null : Number(item.disc_total) || 0,
          subtotal: subtotal,
          ppn_amt: ppnAmt,
          pph_amt: pphAmt,
          grand_total: lineGrandTotal,
        };

        return cleanItem;
      }),
    };

    let savedId: string | undefined = isEditMode.value
      ? menuId.value
      : undefined;

    if (isEditMode.value) {
      await updateTPurchaseReturn(menuId.value, payload as any);
      toast.success("Purchase Return berhasil diperbarui", {
        description: `Purchase Return "${values.no_return}" telah diperbarui`,
      });
    } else {
      const res = await createTPurchaseReturn(payload as any);
      savedId = (res as any)?.data?.id;
      toast.success("Purchase Return berhasil dibuat", {
        description: `Purchase Return "${values.no_return}" telah ditambahkan`,
      });
    }

    // Jika Super Admin: panggil fn approve dengan level tertinggi
    if (isSuperAdmin.value && savedId) {
      try {
        const allApprovals = authStore
          .getApprovalList()
          .filter(
            (a: any) => a.path === "/purchasing/transaksi/t_purchase_return",
          );
        const maxLevel =
          allApprovals.length > 0
            ? Math.max(...allApprovals.map((a: any) => a.level ?? 0))
            : 1;
        await approveTPurchaseReturn(
          savedId,
          null,
          maxLevel,
          "Auto approved by Super Admin",
        );
      } catch (approvalErr) {
        console.warn(
          "Failed to call Purchase Return approve endpoint:",
          approvalErr,
        );
      }
    }

    router.replace(
      "/purchasing/transaksi/t_purchase_return?reload=" + Date.now(),
    );
  } catch (error) {
    toast.error(
      isEditMode.value
        ? "Gagal memperbarui Purchase Return"
        : "Gagal membuat Purchase Return",
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
// DETAIL ITEMS HANDLERS
// ============================================================================
const updateLineTotal = (index: number) => {
  const item = detailItems.value[index];

  if (values.is_pi_pb) {
    item.disc_total = 0;
    item.total = 0;
    calculateGrandTotal();
    return;
  }

  if (hasPiBaseFinancials(item)) {
    const ratio = getPiProrateRatio(item);
    item.disc_total = toNumber(item.base_disc_total) * ratio;
    item.total = toNumber(item.base_subtotal) * ratio;
    item.ppn_amt = toNumber(item.base_ppn_amt) * ratio;
    item.pph_amt = toNumber(item.base_pph_amt) * ratio;
    calculateGrandTotal();
    return;
  }

  // Ensure proper number conversion
  const qty = getPiEffectiveQty(item);
  const harga = toNumber(item.harga);
  const disc1Persen = toNumber(item.disc_1);
  const disc2Persen = toNumber(item.disc_2);
  const disc3Persen = toNumber(item.disc_3);
  const baseQty = getPiBaseQty(item);
  const ratio = baseQty > 0 ? qty / baseQty : 1;
  const discAmount = toNumber(item.amt_disc) * ratio;

  // Jika qty_retur = 0 atau harga = 0, set semua ke 0
  if (qty === 0 || harga === 0) {
    item.disc_total = 0;
    item.total = 0;
    calculateGrandTotal();
    return;
  }

  // Perhitungan sesuai form purchasing lain:
  const subtotal = qty * harga;
  const disc1 = subtotal * (disc1Persen / 100);
  const afterDisc1 = subtotal - disc1;
  const disc2 = afterDisc1 * (disc2Persen / 100);
  const afterDisc2 = afterDisc1 - disc2;
  const disc3 = afterDisc2 * (disc3Persen / 100);

  item.disc_total = disc1 + disc2 + disc3 + discAmount;
  item.total = subtotal - item.disc_total;

  calculateGrandTotal();
};

const handleLinePphSelect = (item: any, selected: any) => {
  if (selected) {
    item.pph_percentage =
      selected.value3 !== undefined && selected.value3 !== null
        ? String(selected.value3)
        : "0";
  } else {
    item.pph_percentage = "0";
  }
  calculateGrandTotal();
};

const handleLinePpnSelect = (item: any, selected: any) => {
  if (selected) {
    item.ppn_percentage =
      selected.value3 !== undefined && selected.value3 !== null
        ? String(selected.value3)
        : "0";
    const rawType = String(selected.value4 || selected.value1 || "");
    item.ppn_type = normalizePpnType(rawType);
  } else {
    item.ppn_percentage = "0";
    item.ppn_type = "EXCLUDE";
  }
  calculateGrandTotal();
};

const getLineDppBase = (item: any): number => {
  if (values.is_pi_pb) return 0;
  return Number(item.total) || 0;
};

// Helper: Calculate line PPN
const calculateLinePpn = (item: any): number => {
  if (values.is_pi_pb) return 0;
  if (hasPiBaseFinancials(item)) {
    return toNumber(item.base_ppn_amt) * getPiProrateRatio(item);
  }
  const lineTotal = Number(item.total) || 0;
  const rate = Number(item.ppn_percentage || 0) / 100;
  const type = (item.ppn_type as "INCLUDE" | "EXCLUDE") || "EXCLUDE";

  if (!rate || rate === 0) return 0;

  if (type === "INCLUDE") {
    return (lineTotal / (1 + rate)) * rate;
  }

  return lineTotal * rate;
};

const calculateLinePph = (item: any): number => {
  if (values.is_pi_pb) return 0;
  if (hasPiBaseFinancials(item)) {
    return toNumber(item.base_pph_amt) * getPiProrateRatio(item);
  }
  const base = Number(item.total) || 0;
  const rate = Number(item.pph_percentage || 0) / 100;
  if (!rate || rate === 0) return 0;
  return base * rate;
};

// Helper: Calculate line Grand Total (after PPN)
const calculateLineGrandTotal = (item: any): number => {
  if (values.is_pi_pb) return 0;
  if (hasPiBaseFinancials(item)) {
    return toNumber(item.base_grand_total) * getPiProrateRatio(item);
  }
  const lineTotal = Number(item.total) || 0;
  const linePpn = calculateLinePpn(item);
  const rate = Number(item.ppn_percentage || 0) / 100;
  const type = (item.ppn_type as "INCLUDE" | "EXCLUDE") || "EXCLUDE";

  // INCLUDE PPN: Grand Total = lineTotal (sudah termasuk PPN)
  if (type === "INCLUDE" && rate > 0) {
    return lineTotal;
  }

  // EXCLUDE PPN or NON PPN: Grand Total = lineTotal + PPN
  return lineTotal + linePpn;
};

const deleteDetailItem = (index: number) => {
  detailItems.value.splice(index, 1);
  toast.success("Item berhasil dihapus");
  calculateGrandTotal();
};

const calculateGrandTotal = () => {
  if (values.is_pi_pb) {
    values.total = 0;
    values.total_diskon = 0;
    values.total_ppn = 0;
    values.total_pph = 0;
    values.grand_total = 0;
    values.dpp_lainnya = 0;
    return;
  }

  const totalBruto = detailItems.value.reduce(
    (sum, item) => sum + (Number(item.total) || 0),
    0,
  );
  const totalDiskon = detailItems.value.reduce(
    (sum, item) => sum + (Number(item.disc_total) || 0),
    0,
  );
  const totalPpn = detailItems.value.reduce(
    (sum, item) => sum + calculateLinePpn(item),
    0,
  );
  const totalPph = detailItems.value.reduce(
    (sum, item) => sum + calculateLinePph(item),
    0,
  );
  const grandBeforePph = detailItems.value.reduce(
    (sum, item) => sum + calculateLineGrandTotal(item),
    0,
  );

  values.total = totalBruto;
  values.total_diskon = totalDiskon;
  values.total_ppn = totalPpn;
  values.total_pph = totalPph;
  values.grand_total = grandBeforePph - totalPph;
  values.dpp_lainnya = !values.is_pi_pb ? totalBruto * (11 / 12) : 0;
};

// ============================================================================
// WATCHERS
// ============================================================================
// Watch untuk is_pi_pb - reset field yang tidak relevan ketika berubah
// 🔧 PERBAIKAN: Skip watcher saat initial load agar tidak reset detail items
watch(
  () => values.is_pi_pb,
  async (newVal, oldVal) => {
    // Skip jika masih initial load (saat data dari API di-assign)
    if (isInitialLoad.value) {
      return;
    }

    if (newVal !== oldVal) {
      // Reset supplier karena API-nya berbeda untuk PB dan PI
      values.m_supplier_id = "";
      errors.m_supplier_id = "";

      // Reset Gudang
      values.m_gudang_id = "";
      errors.m_gudang_id = "";

      // Reset currency karena item akan berubah
      values.m_currency_id = "";
      values.m_currency_d_id = "";
      selectedCurrencyData.value = null;

      // Jika berubah ke PI (newVal = false), load default IDR currency
      if (!newVal) {
        await loadDefaultRupiahCurrency();
      }

      if (!newVal) {
        // Reset tipe retur karena GANTI BARANG tidak diperbolehkan untuk PI
        values.tiper_retur = "";
        errors.tiper_retur = "";
      }

      // Reset detail items
      detailItems.value = [];
      calculateGrandTotal();
      toast.info(`Referensi berubah ke ${newVal ? "PB" : "PI"}`, {
        description: "Field terkait telah direset",
      });
    }
  },
);

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push("/purchasing/transaksi/t_purchase_return");
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
          <CardTitle>Informasi Purchase Return</CardTitle>
          <CardDescription>
            Isi data Purchase Return dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Company (Unit Bisnis) - Super Admin Only -->
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
                    no_pagination: 'true',
                  },
                }"
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

            <!-- Status -->
            <FieldX
              id="status"
              label="Status"
              :value="values.status"
              disabled
              readonly
              placeholder="Status PR"
            />

            <!-- No. Purchase Return (Auto, Readonly) -->
            <FieldX
              id="no_return"
              label="No. Purchase Return"
              :value="values.no_return"
              disabled
              readonly
              placeholder="Auto generate by system"
            />

            <!-- Tanggal Return -->
            <FieldDate
              id="tgl_retur"
              label="Tanggal Return"
              v-model="values.tgl_retur"
              :min="todayDate"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih tanggal return"
              hints="Tanggal dilakukannya purchase return"
            />

            <!-- Referensi (PB atau PI) -->
            <FieldRadio
              id="is_pi_pb"
              label="Referensi"
              v-model="referensiValue"
              :options="referensiOptions"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              direction="horizontal"
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
              :displayValue="values.nama_supp || ''"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/fn/t_purchase_return/getSupplierReturLists`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  is_pb: values.is_pi_pb,
                },
                onsuccess: (response: any) => {
                  response.hasNext = false;
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
                  filterable: false,
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

            <!-- ToP (Termin Pembayaran) -->
            <FieldSelect
              v-if="!values.is_pi_pb"
              id="top_id"
              label="ToP"
              :value="values.top_id"
              @input="(v: string) => (values.top_id = v)"
              :disabled="isReadOnly"
              :readonly="isReadOnly"
              :clearable="false"
              placeholder="Pilih ToP"
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

            <!-- Tipe Retur -->
            <FieldSelect
              id="tiper_retur"
              label="Tipe Retur"
              :value="values.tiper_retur"
              @input="
                (v: string) => {
                  values.tiper_retur = v;
                  errors.tiper_retur = '';
                }
              "
              @update:valueFull="
                (item: any) => {
                  // Prevent GANTI BARANG selection when PI mode
                  if (
                    !values.is_pi_pb &&
                    item?.value1?.toUpperCase() === 'GANTI BARANG'
                  ) {
                    toast.error('Tipe Retur tidak valid', {
                      description:
                        'GANTI BARANG tidak diperbolehkan untuk Purchase Invoice (PI)',
                    });
                    values.tiper_retur = '';
                    return;
                  }
                  values.tiper_retur = item?.id || '';
                  errors.tiper_retur = '';
                }
              "
              :errorText="errors.tiper_retur ? 'failed' : ''"
              :hints="errors.tiper_retur"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              placeholder="Pilih Tipe Retur"
              displayField="value1"
              valueField="id"
              :api="tipeReturApiConfig"
              :key="`tipe-retur-${values.is_pi_pb}`"
            />

            <!-- Mata Uang -->
            <FieldSelect
              v-if="!values.is_pi_pb"
              id="m_currency_id"
              label="Mata Uang"
              v-model="values.m_currency_id"
              @update:valueFull="handleCurrencySelect"
              :disabled="loading || isReadOnly"
              :clearable="false"
              placeholder="Pilih Mata Uang"
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
                },
              }"
            />

            <!-- Catatan -->
            <div class="space-y-2 md:col-span-2">
              <Label for="catatan">Catatan</Label>
              <textarea
                id="catatan"
                v-model="values.catatan"
                :disabled="isReadOnly"
                rows="3"
                class="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Masukkan catatan (opsional)"
              ></textarea>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- DETAIL ITEMS CARD -->
      <Card>
        <CardHeader class="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Purchase Return Detail</CardTitle>
            <CardDescription> Daftar item yang akan diretur </CardDescription>
          </div>
         <ButtonMultiSelect
  v-if="!isReadOnly"
  title="Pilih Item"
  @add="handleAddDetailItems"
  :api="{
    url: values.is_pi_pb
      ? `${API_BASE_URL}/fn/t_penerimaan_barangs/GetAllDataPB`
      : `${API_BASE_URL}/fn/t_purchase_invoice/getAllPIcanReturn`,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`,
    },
    params: values.is_pi_pb
      ? {
          searchfield: 'm_items.kode_item,m_items.nama_item',
          ...(values.m_unit_bisnis_id && {
            filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
          }),
          ...(values.m_supplier_id && {
            filter_column_m_supplier_id: values.m_supplier_id,
          }),
          ...(values.m_gudang_id && {
            filter_column_m_gudang_id: values.m_gudang_id,
          }),
        }
      : {
          ...(values.m_unit_bisnis_id && {
            filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
          }),
          ...(values.m_supplier_id && {
            filter_column_m_supplier_id: values.m_supplier_id,
          }),
        },
    onsuccess: (response: any) => normalizeReturnPopupResponse(response),
  }"
  :columns="
    values.is_pi_pb
      ? [
          {
            field: 'no_penerimaan',
            headerName: 'No. Penerimaan',
            filterable: true,
            sortable: true,
            filter: 'ColFilter',
          },
          {
            field: 'tgl_penerimaan',
            headerName: 'Tanggal',
            sortable: true,
            filterable: false,
          },
          {
            field: 'm_supplier.nama_supp',
            headerName: 'Supplier',
            filterable: true,
            sortable: true,
            filter: 'ColFilter',
            render: (row: any) => row.m_supplier?.nama_supp || '-',
          },
          {
            field: 'no_sj_supp',
            headerName: 'No. SJ',
            filterable: true,
            sortable: true,
            filter: 'ColFilter',
          },
          {
            field: 't_penerimaan_barang_ds',
            headerName: 'Total Items',
            sortable: false,
            filterable: false,
            render: (row: any) => row.t_penerimaan_barang_ds?.length || 0,
          },
        ]
      : [
          {
            field: 'no_pi',
            headerName: 'No. Purchase Invoice',
            filterable: true,
            sortable: true,
            filter: 'ColFilter',
          },
          {
            field: 'tgl_pi',
            headerName: 'Tanggal',
            sortable: true,
            filterable: false,
          },
          {
            field: 'tgl_jatuh_tempo',
            headerName: 'Tanggal Jatuh Tempo',
            sortable: true,
            filterable: false,
          },
          {
            field: 'm_supplier.nama_supp',
            headerName: 'Supplier',
            filterable: true,
            sortable: true,
            filter: 'ColFilter',
            render: (row: any) => row.m_supplier?.nama_supp || '-',
          },
          {
            field: 'grand_total',
            headerName: 'Grand Total',
            sortable: true,
            render: (row: any) =>
              row.m_currency
                ? `${Number(row.grand_total || 0).toLocaleString('id-ID', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}`
                : Number(row.grand_total || 0).toLocaleString('id-ID', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  }),
          },
          {
            field: 't_purchase_invoice_ds',
            headerName: 'Total Items',
            sortable: false,
            filterable: false,
            render: (row: any) => row.t_purchase_invoice_ds?.length || 0,
          },
        ]
  "
  :disabled="
    loading ||
    !values.m_unit_bisnis_id ||
    !values.m_supplier_id ||
    !values.m_gudang_id
  "
/>
        </CardHeader>
        <CardContent>
          <div class="rounded-md border overflow-x-auto">
            <table class="w-full text-sm">
               <thead class="bg-muted/50">
                 <tr class="border-b">
                   <th class="px-4 py-3 text-left font-medium w-12">No</th>
                   <th class="px-4 py-3 text-left font-medium">Kode</th>
                   <th class="px-4 py-3 text-left font-medium">Nama Item</th>
                   <th class="px-4 py-3 text-left font-medium">No PO</th>
                   <th v-if="values.is_pi_pb" class= "px-4 py-3 text-left font-medium">No PB</th>
                   <th class="px-4 py-3 text-left font-medium">Rak</th>
                   <th class="px-4 py-3 text-left font-medium">Batch</th>
                   <th class="px-4 py-3 text-left font-medium">Qty PB</th>
                   <th v-if="!values.is_pi_pb" class="px-4 py-3 text-left font-medium">Qty PI</th>
                   <th class="px-4 py-3 text-left font-medium">Qty Retur</th>
                   <th class="px-4 py-3 text-left font-medium">Satuan</th>
                   <th v-if="!values.is_pi_pb" class="px-4 py-3 text-left font-medium">Harga</th>
                   <th v-if="!values.is_pi_pb" class="px-4 py-3 text-left font-medium">Disc. 1 %</th>
                   <th v-if="!values.is_pi_pb" class="px-4 py-3 text-left font-medium">Disc. 2 %</th>
                   <th v-if="!values.is_pi_pb" class="px-4 py-3 text-left font-medium">Disc. 3 %</th>
                   <th v-if="!values.is_pi_pb" class="px-4 py-3 text-left font-medium">Disc. Amount</th>
                   <th v-if="!values.is_pi_pb" class="px-4 py-3 text-left font-medium">Total Diskon</th>
                   <th v-if="!values.is_pi_pb" class="px-4 py-3 text-left font-medium">Subtotal</th>
                   <th v-if="!values.is_pi_pb" class="px-4 py-3 text-left font-medium">PPH</th>
                   <th v-if="!values.is_pi_pb" class="px-4 py-3 text-left font-medium">PPN</th>
                   <th v-if="!values.is_pi_pb" class="px-4 py-3 text-left font-medium">Grand Total</th>
                   <th class="px-4 py-3 text-left font-medium">Alasan</th>
                   <th class="px-4 py-3 text-left font-medium">Catatan</th>
                   <th class="px-4 py-3 text-left font-medium min-w-[180px]">
                     Foto
                   </th>
                   <th
                     v-if="!isReadOnly"
                     class="px-4 py-3 text-center font-medium w-24"
                   >
                     Aksi
                   </th>
                 </tr>
               </thead>
              <tbody>
                 <tr v-if="detailItems.length === 0" class="border-b">
                   <td
                     :colspan="isReadOnly
                       ? (values.is_pi_pb ? 12 : 23)
                       : (values.is_pi_pb ? 13 : 24)"
                     class="px-4 py-8 text-center text-muted-foreground"
                   >
                     Belum ada item. Klik "Add to List" untuk menambahkan item.
                   </td>
                 </tr>
                <tr
                  v-for="(item, index) in detailItems"
                  :key="index"
                  class="border-b hover:bg-muted/50"
                >
                  <td class="px-4 py-3 text-center">{{ index + 1 }}</td>
                  <td class="px-4 py-3">{{ item.kode }}</td>
                  <td class="px-4 py-3">{{ item.nama_item }}</td>
                  <td class="px-4 py-3">{{ item.no_po || "-" }}</td>
                  <td v-if="values.is_pi_pb" class="px-4 py-3">{{ item.no_penerimaan || "-" }}</td>
                  <td class="px-4 py-3">{{ item.rak_display || "-" }}</td>
                   <td class="px-4 py-3 font-mono text-xs">{{ item.batch || "-" }}</td>
                   <td class="px-4 py-3 text-right">{{ item.qty_pb || 0 }}</td>
                   <td v-if="!values.is_pi_pb" class="px-4 py-3 text-right">{{ item.qty_pi || 0 }}</td>
                   <td class="px-2 py-2 text-right">
                    <FieldNumber
                      v-if="!isReadOnly"
                      :id="`qty_retur_${index}`"
                      :model-value="item.qty_retur ?? 0"
                      @update:model-value="
                        (value) => {
                          const v =
                            value === '' || value == null ? 0 : Number(value);
                          item.qty_retur = isNaN(v) ? 0 : v;
                          updateLineTotal(index);
                        }
                      "
                      :min="0"
                      :max="
                        item.qty_sisa_return ||
                        (values.is_pi_pb ? item.qty_pb : item.qty_pi)
                      "
                      placeholder="0"
                      class="w-20"
                    />
                    <span v-else class="font-semibold">{{
                      item.qty_retur || 0
                    }}</span>
                  </td>
                  <td class="px-4 py-3">{{ item.satuan }}</td>
                  <td v-if="!values.is_pi_pb" class="px-2 py-2 text-right">
                    <FieldNumber
                      v-if="!isReadOnly"
                      type="decimal"
                      :id="`harga_${index}`"
                      :model-value="item.harga ?? 0"
                      @update:model-value="
                        (value) => {
                          const v =
                            value === '' || value == null ? 0 : Number(value);
                          item.harga = isNaN(v) ? 0 : v;
                          updateLineTotal(index);
                        }
                      "
                      :min="0"
                      placeholder="0"
                      class="w-28"
                    />
                    <span v-else>{{
                      (item.harga || 0).toLocaleString("id-ID")
                    }}</span>
                  </td>
                  <td v-if="!values.is_pi_pb" class="px-4 py-3 text-right">
                    {{ item.disc_1 || "0" }}%
                  </td>
                  <td v-if="!values.is_pi_pb" class="px-4 py-3 text-right">
                    {{ item.disc_2 || "0" }}%
                  </td>
                  <td v-if="!values.is_pi_pb" class="px-4 py-3 text-right">
                    {{ item.disc_3 || "0" }}%
                  </td>
                  <td v-if="!values.is_pi_pb" class="px-4 py-3 text-right">
                    {{ Number(item.amt_disc || 0).toLocaleString("id-ID") }}
                  </td>
                  <td v-if="!values.is_pi_pb" class="px-4 py-3 text-right text-destructive">
                    {{ Number(item.disc_total || 0).toLocaleString("id-ID") }}
                  </td>
                   <td v-if="!values.is_pi_pb" class="px-4 py-3 text-right font-medium">
                     {{ (item.total || 0).toLocaleString("id-ID") }}
                   </td>
                   <td v-if="!values.is_pi_pb" class="px-2 py-2">
                     <div class="flex flex-col gap-1">
                       <FieldSelect
                         v-model="item.pph_id"
                         @update:valueFull="(selected: any) => handleLinePphSelect(item, selected)"
                         class="w-full"
                         :disabled="isReadOnly"
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
                       <span class="text-[10px] text-orange-500 font-medium">
                         {{ calculateLinePph(item).toLocaleString("id-ID") }}
                       </span>
                     </div>
                   </td>
                   <td v-if="!values.is_pi_pb" class="px-2 py-2">
                     <div class="flex flex-col gap-1">
                       <FieldSelect
                         v-model="item.ppn_id"
                         @update:valueFull="(selected: any) => handleLinePpnSelect(item, selected)"
                         class="w-full"
                         :disabled="isReadOnly"
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
                             selectfield: 'id,value1,value3,value4',
                             search: 'PPN',
                             searchfield: 'group',
                           },
                         }"
                       />
                       <span class="text-[10px] text-blue-600 font-medium">
                         {{ calculateLinePpn(item).toLocaleString("id-ID") }}
                       </span>
                     </div>
                   </td>
                   <td v-if="!values.is_pi_pb" class="px-4 py-3 text-right font-semibold">
                     {{ calculateLineGrandTotal(item).toLocaleString("id-ID") }}
                   </td>
                   <td class="px-2 py-2">
                    <FieldSelect
                      v-if="!isReadOnly"
                      :id="`alasan_${index}`"
                      :value="item.alasan"
                      @input="(v: string) => (item.alasan = v)"
                      placeholder="Pilih alasan"
                      class="w-48 text-xs"
                      displayField="value1"
                      valueField="id"
                      :api="alasanReturnApiConfig"
                      :required="true"
                      :clearable="false"
                    />
                    <span v-else class="text-sm">{{
                      item.alasan_text || "-"
                    }}</span>
                  </td>
                  <td class="px-2 py-2">
                    <FieldX
                      v-if="!isReadOnly"
                      :id="`catatan_${index}`"
                      :modelValue="item.catatan"
                      @update:modelValue="(v: string) => (item.catatan = v)"
                      placeholder="Catatan detail"
                      class="w-36 text-xs"
                      :disabled="isReadOnly"
                    />
                    <span v-else class="text-sm">{{
                      item.catatan || "-"
                    }}</span>
                  </td>
                  <td class="px-2 py-2">
                    <div v-if="!isReadOnly">
                      <FieldUpload
                        :id="`bukti_foto_${index}`"
                        label=""
                        :value="item.bukti_foto"
                        @input="(v: string) => (item.bukti_foto = v)"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        accept="image/*"
                        hints="Max 5MB"
                      />
                    </div>
                    <div v-else>
                      <Button
                        v-if="item.bukti_foto"
                        type="button"
                        variant="outline"
                        size="sm"
                        class="gap-1.5 text-xs"
                        @click="openFotoPreview(item.bukti_foto)"
                      >
                        <Eye class="h-3.5 w-3.5" />
                        Lihat Foto
                      </Button>
                      <span v-else class="text-sm text-muted-foreground"
                        >-</span
                      >
                    </div>
                  </td>
                  <td v-if="!isReadOnly" class="px-4 py-3">
                    <div class="flex items-center justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        @click="deleteDetailItem(index)"
                        class="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 class="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- SUMMARY TOTALS (selalu tampil) -->
          <div v-if="!values.is_pi_pb" class="mt-6">
            <!-- Exchange Rate Info (if currency selected) -->
            <div
              v-if="values.m_currency_id && selectedCurrencyData"
              class="p-4 bg-card rounded-lg border shadow-sm mb-4"
            >
              <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p class="text-muted-foreground text-xs">Currency</p>
                  <p class="font-semibold">{{ currencyName }}</p>
                  <p class="text-xs text-muted-foreground">
                    {{ currencyCode }}
                  </p>
                </div>
                <div>
                  <p class="text-muted-foreground text-xs">Exchange Rate</p>
                  <p class="font-bold text-primary text-lg">
                    {{
                      exchangeRateDisplay.toLocaleString("id-ID", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })
                    }}
                  </p>
                  <p class="text-xs text-muted-foreground">Rp / Unit</p>
                </div>
                <div>
                  <p class="text-muted-foreground text-xs">Updated</p>
                  <p class="font-semibold text-xs">
                    {{ exchangeRateDateTime }}
                  </p>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- COLUMN 1: Nilai dalam Mata Uang Asli -->
            <div class="space-y-1 rounded-lg border bg-muted/40 p-4 text-sm">
              <div class="pb-2 mb-2 border-b font-semibold text-foreground">
                {{ currencySymbol }} {{ currencyCode }}
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">Total Diskon</span>
                <span class="font-semibold text-destructive">{{
                  values.total_diskon.toLocaleString("id-ID")
                }}</span>
              </div>
              <div class="h-px bg-border my-1"></div>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">Total</span>
                <span class="font-semibold">{{
                  values.total.toLocaleString("id-ID")
                }}</span>
              </div>
              <div
                v-if="!values.is_pi_pb && values.dpp_lainnya > 0"
                class="flex items-center justify-between text-purple-600"
              >
                <span class="text-muted-foreground">DPP Nilai Lain</span>
                <span class="font-semibold">{{
                  values.dpp_lainnya.toLocaleString("id-ID", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                }}</span>
               </div>
               <div v-if="!values.is_pi_pb" class="flex items-center justify-between">
                 <span class="text-muted-foreground">Total PPN</span>
                 <span class="flex items-center gap-2">
                   <span class="text-xs text-muted-foreground">{{
                      (effectivePpnPercentage || "0") + "%"
                   }}</span>
                   <span class="font-semibold">{{
                     values.total_ppn.toLocaleString("id-ID")
                   }}</span>
                 </span>
               </div>
               <div v-if="!values.is_pi_pb" class="flex items-center justify-between">
                 <span class="text-muted-foreground">Total PPH</span>
                 <span class="flex items-center gap-2">
                   <span class="text-xs text-muted-foreground">{{
                      (effectivePphPercentage || "0") + "%"
                   }}</span>
                   <span class="font-semibold">{{
                     values.total_pph.toLocaleString("id-ID")
                   }}</span>
                 </span>
               </div>
              <div class="h-px bg-border my-1"></div>
              <div class="flex items-center justify-between">
                <span class="font-semibold">Grand Total</span>
                <span class="text-base font-bold text-primary">{{
                  values.grand_total.toLocaleString("id-ID")
                }}</span>
              </div>
            </div>

            <!-- COLUMN 2: Nilai dalam Rupiah (jika currency bukan Rupiah) -->
            <div
              v-if="values.m_currency_id && !isCurrencyRupiah"
              class="space-y-1 rounded-lg border bg-muted/40 p-4 text-sm"
            >
              <div class="pb-2 mb-2 border-b font-semibold text-foreground">
                IDR (Rupiah)
              </div>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">Total Diskon</span>
                <span class="font-semibold text-destructive">{{
                  (values.total_diskon * exchangeRateDisplay).toLocaleString(
                    "id-ID",
                  )
                }}</span>
              </div>
              <div class="h-px bg-border my-1"></div>
              <div class="flex items-center justify-between">
                <span class="text-muted-foreground">Total</span>
                <span class="font-semibold">{{
                  (values.total * exchangeRateDisplay).toLocaleString("id-ID")
                }}</span>
              </div>
              <div
                v-if="!values.is_pi_pb && values.dpp_lainnya > 0"
                class="flex items-center justify-between text-purple-600"
              >
                <span class="text-muted-foreground">DPP Nilai Lain</span>
                <span class="font-semibold">{{
                  (values.dpp_lainnya * exchangeRateDisplay).toLocaleString(
                    "id-ID",
                    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                  )
                }}</span>
               </div>
               <div v-if="!values.is_pi_pb" class="flex items-center justify-between">
                 <span class="text-muted-foreground">Total PPN</span>
                 <span class="flex items-center gap-2">
                   <span class="text-xs text-muted-foreground">{{
                      (effectivePpnPercentage || "0") + "%"
                   }}</span>
                   <span class="font-semibold">{{
                     (values.total_ppn * exchangeRateDisplay).toLocaleString(
                       "id-ID",
                     )
                   }}</span>
                 </span>
               </div>
               <div v-if="!values.is_pi_pb" class="flex items-center justify-between">
                 <span class="text-muted-foreground">Total PPH</span>
                 <span class="flex items-center gap-2">
                   <span class="text-xs text-muted-foreground">{{
                      (effectivePphPercentage || "0") + "%"
                   }}</span>
                   <span class="font-semibold">{{
                     (values.total_pph * exchangeRateDisplay).toLocaleString(
                       "id-ID",
                     )
                   }}</span>
                 </span>
               </div>
              <div class="h-px bg-border my-1"></div>
              <div class="flex items-center justify-between">
                <span class="font-semibold">Grand Total</span>
                <span class="text-base font-bold text-primary">{{
                  (values.grand_total * exchangeRateDisplay).toLocaleString(
                    "id-ID",
                  )
                }}</span>
              </div>
            </div>
            </div>
          </div>

          <!-- BREAKDOWN CALCULATION DETAIL -->
          <div v-if="!values.is_pi_pb" class="mt-6 border-t pt-6">
            <button
              type="button"
              @click="isBreakdownOpen = !isBreakdownOpen"
              class="flex items-center gap-3 w-full mb-4 hover:opacity-80 transition-opacity"
            >
              <ChevronDown
                :class="[
                  'h-5 w-5 transition-transform',
                  isBreakdownOpen ? 'rotate-180' : '',
                ]"
              />
              <h3 class="font-semibold text-foreground">
                Breakdown Perhitungan
              </h3>
            </button>

            <div
              v-if="isBreakdownOpen"
              :class="
                isCurrencyRupiah
                  ? 'grid grid-cols-1'
                  : 'grid grid-cols-1 md:grid-cols-2 gap-6'
              "
            >
              <!-- Currency Symbol Breakdown (Hidden for Rupiah) -->
              <div
                v-if="!isCurrencyRupiah"
                class="space-y-3 p-4 rounded-lg border bg-card"
              >
                <div class="font-semibold text-foreground pb-3 border-b">
                  {{ currencySymbol }} {{ currencyCode }} - Perhitungan
                </div>

                <!-- Item Details -->
                <div class="text-sm space-y-2">
                  <div class="flex justify-between text-muted-foreground">
                    <span>Subtotal (Qty Retur × Harga):</span>
                    <span>{{
                      (
                        detailItems.reduce(
                          (sum, item) => sum + (item.total || 0),
                          0,
                        ) + values.total_diskon
                      ).toLocaleString("id-ID")
                    }}</span>
                  </div>

                  <!-- Total Discount Amount -->
                  <div
                    class="flex justify-between font-medium bg-destructive/5 p-2 rounded"
                  >
                    <span>Total Diskon:</span>
                    <span class="text-destructive"
                      >-{{ values.total_diskon.toLocaleString("id-ID") }}</span
                    >
                  </div>

                  <!-- Total after discount -->
                  <div class="flex justify-between font-medium border-t pt-2">
                    <span>Total (setelah diskon):</span>
                    <span>{{ values.total.toLocaleString("id-ID") }}</span>
                  </div>

                  <!-- DPP Nilai Lain (khusus PI mode) -->
                  <div
                    v-if="!values.is_pi_pb && values.dpp_lainnya > 0"
                    class="text-xs bg-purple-50 dark:bg-purple-900/20 p-2 rounded space-y-1"
                  >
                    <div class="font-medium">
                      DPP Nilai Lain (Total × 11/12):
                    </div>
                    <div class="flex justify-between">
                      <span
                        >{{ values.total.toLocaleString("id-ID") }} ×
                        11/12</span
                      >
                      <span class="text-purple-600">{{
                        values.dpp_lainnya.toLocaleString("id-ID", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      }}</span>
                    </div>
                  </div>

                   <!-- PPN Calculation -->
                   <div
                     v-if="!values.is_pi_pb && effectivePpnPercentage !== '0'"
                     class="text-xs bg-blue-50 dark:bg-blue-900/20 p-2 rounded space-y-1"
                   >
                     <div class="font-medium">
                       PPN ({{ effectivePpnPercentage }}%) - {{ effectivePpnType }}:
                     </div>
                     <div
                       v-if="effectivePpnType === 'INCLUDE'"
                       class="flex justify-between"
                     >
                       <span
                         >{{ values.total.toLocaleString("id-ID") }} /
                         {{ (1 + Number(effectivePpnPercentage) / 100).toFixed(2) }} ×
                         {{ effectivePpnPercentage }}%</span
                       >
                       <span class="text-blue-600">(sudah include)</span>
                     </div>
                     <div v-else class="flex justify-between">
                       <span
                         >{{ values.total.toLocaleString("id-ID") }} ×
                         {{ effectivePpnPercentage }}%</span
                       >
                       <span class="text-blue-600"
                         >+{{ values.total_ppn.toLocaleString("id-ID") }}</span
                       >
                     </div>
                     <div class="text-muted-foreground">
                       = {{ values.total_ppn.toLocaleString("id-ID") }}
                     </div>
                   </div>

                   <!-- PPH Calculation -->
                   <div
                     v-if="!values.is_pi_pb && effectivePphPercentage !== '0'"
                     class="text-xs bg-orange-50 dark:bg-orange-900/20 p-2 rounded space-y-1"
                   >
                    <div class="font-medium">PPH ({{ effectivePphPercentage }}%):</div>
                    <div class="flex justify-between">
                      <span
                        >{{ values.total.toLocaleString("id-ID") }} ×
                        {{ effectivePphPercentage }}%</span
                      >
                      <span class="text-orange-600"
                        >-{{ values.total_pph.toLocaleString("id-ID") }}</span
                      >
                    </div>
                  </div>

                  <!-- Grand Total Formula -->
                  <div class="border-t pt-2 font-semibold text-base">
                    <div class="flex justify-between text-primary">
                      <span>Grand Total:</span>
                      <span>{{
                        values.grand_total.toLocaleString("id-ID")
                      }}</span>
                    </div>
                    <div class="text-xs text-muted-foreground mt-1">
                      <span
                        v-if="effectivePpnType === 'INCLUDE' && effectivePpnPercentage !== '0'"
                        >= Total (sudah include PPN) - PPH</span
                      >
                      <span v-else>= Total + PPN - PPH</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- IDR Breakdown (always show, or only show for non-Rupiah) -->
              <div
                :class="
                  isCurrencyRupiah
                    ? ''
                    : 'space-y-3 p-4 rounded-lg border bg-card'
                "
                class="space-y-3 p-4 rounded-lg border bg-card"
              >
                <div class="font-semibold text-foreground pb-3 border-b">
                  IDR (Rupiah) - Perhitungan ×
                  {{
                    exchangeRateDisplay.toLocaleString("id-ID", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  }}
                </div>

                <!-- Item Details in IDR -->
                <div class="text-sm space-y-2">
                  <div class="flex justify-between text-muted-foreground">
                    <span>Subtotal × Exchange Rate:</span>
                    <span>{{
                      (
                        (detailItems.reduce(
                          (sum, item) => sum + (item.total || 0),
                          0,
                        ) +
                          values.total_diskon) *
                        exchangeRateDisplay
                      ).toLocaleString("id-ID")
                    }}</span>
                  </div>

                  <!-- Total Discount Amount -->
                  <div
                    class="flex justify-between font-medium bg-destructive/5 p-2 rounded"
                  >
                    <span>Total Diskon:</span>
                    <span class="text-destructive"
                      >-{{
                        (
                          values.total_diskon * exchangeRateDisplay
                        ).toLocaleString("id-ID")
                      }}</span
                    >
                  </div>

                  <!-- Total after discount -->
                  <div class="flex justify-between font-medium border-t pt-2">
                    <span>Total (setelah diskon):</span>
                    <span>{{
                      (values.total * exchangeRateDisplay).toLocaleString(
                        "id-ID",
                      )
                    }}</span>
                  </div>

                  <!-- DPP Nilai Lain (khusus PI mode) -->
                  <div
                    v-if="!values.is_pi_pb && values.dpp_lainnya > 0"
                    class="text-xs bg-purple-50 dark:bg-purple-900/20 p-2 rounded space-y-1"
                  >
                    <div class="font-medium">
                      DPP Nilai Lain (Total × 11/12):
                    </div>
                    <div class="flex justify-between">
                      <span
                        >{{
                          (values.total * exchangeRateDisplay).toLocaleString(
                            "id-ID",
                          )
                        }}
                        × 11/12</span
                      >
                      <span class="text-purple-600">{{
                        (
                          values.dpp_lainnya * exchangeRateDisplay
                        ).toLocaleString("id-ID", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      }}</span>
                    </div>
                  </div>

                   <!-- PPN Calculation -->
                   <div
                     v-if="!values.is_pi_pb && effectivePpnPercentage !== '0'"
                     class="text-xs bg-blue-50 dark:bg-blue-900/20 p-2 rounded space-y-1"
                   >
                    <div class="font-medium">
                      PPN ({{ effectivePpnPercentage }}%) - {{ effectivePpnType }}:
                    </div>
                    <div
                      v-if="effectivePpnType === 'INCLUDE'"
                      class="flex justify-between"
                    >
                      <span
                        >{{
                          (values.total * exchangeRateDisplay).toLocaleString(
                            "id-ID",
                          )
                        }}
                        / {{ (1 + Number(effectivePpnPercentage) / 100).toFixed(2) }} ×
                        {{ effectivePpnPercentage }}%</span
                      >
                      <span class="text-blue-600">(sudah include)</span>
                    </div>
                    <div v-else class="flex justify-between">
                      <span
                        >{{
                          (values.total * exchangeRateDisplay).toLocaleString(
                            "id-ID",
                          )
                        }}
                        × {{ effectivePpnPercentage }}%</span
                      >
                      <span class="text-blue-600"
                        >+{{
                          (
                            values.total_ppn * exchangeRateDisplay
                          ).toLocaleString("id-ID")
                        }}</span
                      >
                    </div>
                    <div class="text-muted-foreground">
                      =
                      {{
                        (values.total_ppn * exchangeRateDisplay).toLocaleString(
                          "id-ID",
                        )
                      }}
                    </div>
                  </div>

                   <!-- PPH Calculation -->
                   <div
                     v-if="!values.is_pi_pb && effectivePphPercentage !== '0'"
                     class="text-xs bg-orange-50 dark:bg-orange-900/20 p-2 rounded space-y-1"
                   >
                    <div class="font-medium">PPH ({{ effectivePphPercentage }}%):</div>
                    <div class="flex justify-between">
                      <span
                        >{{
                          (values.total * exchangeRateDisplay).toLocaleString(
                            "id-ID",
                          )
                        }}
                        × {{ effectivePphPercentage }}%</span
                      >
                      <span class="text-orange-600"
                        >-{{
                          (
                            values.total_pph * exchangeRateDisplay
                          ).toLocaleString("id-ID")
                        }}</span
                      >
                    </div>
                  </div>

                  <!-- Grand Total Formula -->
                  <div class="border-t pt-2 font-semibold text-base">
                    <div class="flex justify-between text-primary">
                      <span>Grand Total:</span>
                      <span>{{
                        (
                          values.grand_total * exchangeRateDisplay
                        ).toLocaleString("id-ID")
                      }}</span>
                    </div>
                    <div class="text-xs text-muted-foreground mt-1">
                      <span
                        v-if="effectivePpnType === 'INCLUDE' && effectivePpnPercentage !== '0'"
                        >= Total (sudah include PPN) - PPH</span
                      >
                      <span v-else>= Total + PPN - PPH</span>
                    </div>
                  </div>
                </div>
              </div>
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

      <!-- ACTION BUTTONS -->
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

  <!-- Preview Foto Popup -->
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="showFotoPreview"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        @click="showFotoPreview = false"
      >
        <div
          class="relative max-w-[95vw] max-h-[95vh] flex flex-col items-center justify-center"
        >
          <Button
            variant="ghost"
            size="icon"
            class="absolute -top-2 -right-2 text-white hover:bg-white/20 z-10"
            @click="showFotoPreview = false"
          >
            <X class="h-6 w-6" />
          </Button>
          <div class="rounded-lg bg-white dark:bg-gray-900 p-4 overflow-hidden">
            <img
              :src="previewFotoUrl"
              alt="Bukti Foto"
              class="max-w-[90vw] max-h-[85vh] w-auto h-auto object-contain"
              @click.stop
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.required::after {
  content: " *";
  color: hsl(var(--destructive));
}

/* Hide scrollbar but keep scrollable functionality */
.scrollbar-hide {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}

.scrollbar-hide::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
