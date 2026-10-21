<script setup lang="ts">

// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed, watch } from "vue";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FieldX,
  FieldNumber,
  FieldPopup,
  FieldSelect,
  FieldDate,
  FieldTextarea,
} from "@/components/field";
import { DeleteButton, ButtonMultiSelect } from "@/components/button";
import { ArrowLeft, Save, Loader2, RefreshCw } from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createTPurchaseInvoice,
  updateTPurchaseInvoice,
  approveTPurchaseInvoice,
  getTPurchaseInvoiceById,
} from "./service";
import AuditInfo from '@/components/AuditInfo.vue'
import { apiCall } from "@/lib/api";
// ============================================================================
// SETUP
// ============================================================================
const authStore = useAuthStore();
const { API_BASE_URL } = useApi();
const router = useRouter();
const route = useRoute();

// =====================
// MISSING REFS
// =====================
// Main detail items for invoice lines
const detailItems = ref<DetailItem[]>([]);
// PPN and PPH percentage (string for input compatibility)
const ppnPercentage = ref<string>("0");
const pphPercentage = ref<string>("0");
// PPN type (INCLUDE/EXCLUDE)
const ppnType = ref<"INCLUDE" | "EXCLUDE">("EXCLUDE");
// Selected PO currency code
const selectedPOCurrencyCode = ref<string>("IDR");
// Allowed PO IDs (for PO selection logic)
const allowedPOIds = ref<string[]>([]);

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false);
const isEditMode = computed(
  () => !!route.params.id && route.name === "TPurchaseInvoiceForm",
);
const isViewMode = computed(() => route.name === "TPurchaseInvoiceView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Purchase Invoice";
  if (isCopyMode.value) return "Salin Purchase Invoice";
  if (isEditMode.value) return "Edit Purchase Invoice";
  return "Tambah Purchase Invoice Baru";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Purchase Invoice";
  if (isCopyMode.value)
    return "Buat Purchase Invoice baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Purchase Invoice";
  return "Buat Purchase Invoice baru";
});

// Super Admin check
const isSuperAdmin = computed(() => {
  const user = authStore.user as any;
  return user?.tipe?.value1?.toUpperCase() === "SUPER ADMIN";
});

// Super Admin dialog state
const isSuperAdminDialogOpen = ref(false);
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

const handleUnitBisnisSelected = (unitBisnis: any | null) => {
  selectedUnitBisnis.value = unitBisnis || null;
};

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

// Form values
const values = reactive({
  no_pi: "",
  tgl_pi: new Date().toISOString().split("T")[0],
  status: "DRAFT",
  m_supplier_id: "",
  t_purchase_order_id: "",
  t_penerimaan_barang_id: "",
  tgl_jatuh_tempo: "",
  top_id: "", // always string
  ppn_id: "dc697972-3785-4f50-98ff-dfa6a1f9d6fa", // always string
  pph_id: "3ab07ab2-f94c-4638-9535-7eac0865c858", // always string
  m_currency_id: "", // always string
  m_currency_d_id: "", // always string
  m_unit_bisnis_id: "", // always string
  exchange_rate: 1,
  catatan: "",
  seri_pajak: 0,
  dpp_lainnya: 0,
  created_by: authStore.user?.id || "",
});

// Detail items interface
interface DetailItem {
  id?: string;
  t_purchase_order_d_id?: string;
  t_penerimaan_barang_id?: string;
  t_penerimaan_barang_d_id?: string;
  m_items_id?: string;
  t_purchase_order_id?: string;
  uom_id?: string;
  // Display fields
  kode_item?: string;
  nama_item?: string;
  no_pb?: string;
  no_po?: string;
  qty_diterima?: number;
  qty_retur?: number;
  qty_pi?: number;
  // Pricing and discount fields
  harga?: number;
  disc_1?: number;
  disc_2?: number;
  amt_disc?: number;
  // PPN & PPH per item
  ppn_id?: string;
  ppn_percentage?: string;
  ppn_type?: 'INCLUDE' | 'EXCLUDE';
  ppn_amt?: number;
  pph_id?: string;
  pph_percentage?: string;
  pph_amt?: number;
  // Calculated fields
  total_diskon?: number;
  total?: number;
  // Misc fields
  satuan?: string;
  catatan?: string | null;
  qty_po?: number;
  qty_sisa?: number;
}

// Ref untuk menyimpan data currency yang dipilih
const selectedCurrencyData = ref<any>(null);

// Flag untuk skip currency fetch ketika data sudah ada dari PO atau saved PI
let skipNextCurrencyFetch = false;

// Track apakah currency data dari saved PI (untuk view/edit)
const isCurrencyFromSavedPI = ref(false);

// Track apakah data diisi dari PB (untuk disable ToP, PPH, PPN, Currency)
const isDataFromPB = ref(false);

// Track currency ID saat load - untuk detect perubahan user
let initialCurrencyId = "";

// ============================================================================
// COMPUTED TOTALS
// ============================================================================
// Subtotal sebelum diskon (Qty PI × Harga)
const subtotal = computed(() => {
  return detailItems.value.reduce((sum, item) => {
    const qty = item.qty_pi || 0;
    const harga = item.harga || 0;
    return sum + qty * harga;
  }, 0);
});

// Total setelah diskon (akumulasi per-barang)
const total = computed(() => {
  return detailItems.value.reduce((sum, item) => {
    return sum + (item.total || 0);
  }, 0);
});

const totalDiskon = computed(() => {
  return detailItems.value.reduce((sum, item) => {
    return sum + (item.total_diskon || 0);
  }, 0);
});

// Total PPN = sum per-item (setiap item bisa punya PPN berbeda)
const totalPpn = computed(() => {
  return detailItems.value.reduce((sum, item) => {
    return sum + calculateLinePpn(item);
  }, 0);
});

// Total PPH = sum per-item
const totalPph = computed(() => {
  return detailItems.value.reduce((sum, item) => {
    const lineTotal = calculateLineTotal(item);
    const rawPct = item.pph_percentage !== undefined && item.pph_percentage !== null && item.pph_percentage !== ''
      ? item.pph_percentage
      : (pphPercentage.value || '0');
    const rate = Number(rawPct) / 100;
    return sum + lineTotal * rate;
  }, 0);
});

// Effective PPN % untuk label di summary
// Ambil dari item pertama yang punya ppn_percentage > 0, fallback ke header ref
const effectivePpnPercentage = computed(() => {
  const item = detailItems.value.find(i => Number(i.ppn_percentage || 0) > 0);
  return item ? String(item.ppn_percentage) : ppnPercentage.value;
});

// Effective PPH % untuk label di summary
const effectivePphPercentage = computed(() => {
  const item = detailItems.value.find(i => Number(i.pph_percentage || 0) > 0);
  return item ? String(item.pph_percentage) : pphPercentage.value;
});

// DPP Nilai Lain = Total setelah diskon × 11/12
const dppLainnyaValue = computed(() => {
  return total.value * (11 / 12);
});

// Update values.dpp_lainnya saat calculated value berubah
watch(dppLainnyaValue, (newValue) => {
  values.dpp_lainnya = newValue;
});

// Grand Total = sum(lineGrandTotal per-item) - total PPH
// calculateLineGrandTotal sudah termasuk PPN tapi BELUM dikurangi PPH
// PPH dikurangi satu kali di sini di level keseluruhan
const grandTotal = computed(() => {
  const sumBeforePph = detailItems.value.reduce((sum, item) => {
    return sum + calculateLineGrandTotal(item);
  }, 0);
  return sumBeforePph - totalPph.value;
});

// ============================================================================
// COMPUTED - SELISIH KURS & EXCHANGE RATE
// ============================================================================
// Exchange rate dari API atau default
const exchangeRateDisplay = computed(() => {
  try {
    if (
      selectedCurrencyData.value &&
      selectedCurrencyData.value.m_currency_ds &&
      selectedCurrencyData.value.m_currency_ds.length > 0
    ) {
      // Jika dari saved PI, selalu gunakan item pertama (yang sudah di-wrap dalam array)
      if (isCurrencyFromSavedPI.value) {
        return Number(selectedCurrencyData.value.m_currency_ds[0].rate) || 1;
      }

      // Jika dari API (create mode), cari yang active
      let activeRate = selectedCurrencyData.value.m_currency_ds.find(
        (d: any) => d.is_active === true,
      );

      // Untuk IDR/Rupiah, jika tidak ada yang is_active = true, cari yang is_active = null
      if (!activeRate && isCurrencyRupiah.value) {
        activeRate = selectedCurrencyData.value.m_currency_ds.find(
          (d: any) => d.is_active === null,
        );
      }

      if (activeRate) {
        return Number(activeRate.rate) || 1;
      }
      // Fallback to first rate if no active rate found
      return Number(selectedCurrencyData.value.m_currency_ds[0].rate) || 1;
    }
  } catch (error) {
    console.error("Error in exchangeRateDisplay computed:", error);
  }
  return 1;
});

const exchangeRateDate = computed(() => {
  try {
    // Ambil tanggal mulai dari m_currency_ds yang aktif
    if (
      selectedCurrencyData.value &&
      selectedCurrencyData.value.m_currency_ds &&
      selectedCurrencyData.value.m_currency_ds.length > 0
    ) {
      // Cari yang is_active = true
      const activeRate = selectedCurrencyData.value.m_currency_ds.find(
        (d: any) => d.is_active === true,
      );
      const dateString =
        activeRate?.tgl_mulai ||
        selectedCurrencyData.value.m_currency_ds[0].tgl_mulai;
      if (dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString("id-ID", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }
    }
  } catch (error) {
    console.error("Error in exchangeRateDate computed:", error);
  }
  return new Date().toLocaleDateString("id-ID", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
});

// Currency symbol dan name untuk display
const currencySymbol = computed(() => {
  try {
    const code = selectedCurrencyData.value?.money?.value5 || "IDR";
    const name =
      selectedCurrencyData.value?.money?.value1 || "Indonesian Rupiah";

    // Force 'Rp' untuk Rupiah (IDR)
    if (
      code === "IDR" ||
      code === "Rupiah" ||
      name.toLowerCase().includes("rupiah")
    ) {
      return "Rp";
    }

    return selectedCurrencyData.value?.money?.value2 || "Rp";
  } catch (error) {
    console.error("Error in currencySymbol computed:", error);
    return "Rp";
  }
});
const currencyName = computed(() => {
  try {
    return selectedCurrencyData.value?.money?.value1 || "Indonesian Rupiah";
  } catch (error) {
    console.error("Error in currencyName computed:", error);
    return "Indonesian Rupiah";
  }
});
const currencyCode = computed(() => {
  try {
    return selectedCurrencyData.value?.money?.value5 || "IDR";
  } catch (error) {
    console.error("Error in currencyCode computed:", error);
    return "IDR";
  }
});

// Check if selected currency is Rupiah (IDR)
const isCurrencyRupiah = computed(() => {
  return currencyCode.value === "IDR" || !values.m_currency_id;
});

// Toggle breakdown kurs
const showBreakdownKurs = ref(false);

// Loading state untuk refresh currency
const isRefreshingCurrency = ref(false);

// Get m_currency_d_id yang aktif (is_active = true atau null untuk IDR)
const activeCurrencyDetailId = computed(() => {
  try {
    if (
      selectedCurrencyData.value &&
      selectedCurrencyData.value.m_currency_ds &&
      selectedCurrencyData.value.m_currency_ds.length > 0
    ) {
      // Cari detail currency yang is_active = true
      let activeDetail = selectedCurrencyData.value.m_currency_ds.find(
        (d: any) => d.is_active === true,
      );

      // Jika tidak ada yang is_active = true, untuk IDR/Rupiah terima juga is_active = null
      if (!activeDetail && isCurrencyRupiah.value) {
        activeDetail = selectedCurrencyData.value.m_currency_ds.find(
          (d: any) => d.is_active === null,
        );
      }

      if (activeDetail) {
        return activeDetail.id;
      }

      // Fallback: jika tidak ada yang aktif, gunakan yang pertama
      console.warn("No active currency detail found, using first available");
      return selectedCurrencyData.value.m_currency_ds[0]?.id || null;
    }
  } catch (error) {
    console.error("Error in activeCurrencyDetailId computed:", error);
  }
  return null;
});

// Helper function untuk format currency dengan symbol dinamis
const formatCurrency = (amount: number): string => {
  const formatted = amount.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${currencySymbol.value} ${formatted}`;
};

// Helper function untuk format ke Rupiah (untuk ringkasan total)
const formatRupiah = (amount: number): string => {
  // Handle null, undefined, or NaN values
  if (amount === null || amount === undefined || isNaN(amount)) {
    return "Rp 0";
  }
  const formatted = amount.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `Rp ${formatted}`;
};

// Kurs PO (kurs saat PO dibuat) - akan diisi dari data PO
const kursPO = ref(0);

// Subtotal dalam Rupiah (sebelum diskon) menggunakan Kurs PO
const subtotalInRupiah = computed(() => {
  const rate = kursPO.value || 1;
  return subtotal.value * rate;
});

// Total dalam Rupiah (setelah diskon) menggunakan Kurs PO
const totalInRupiah = computed(() => {
  const rate = kursPO.value || 1;
  return total.value * rate;
});

const totalDiskonInRupiah = computed(() => {
  const rate = kursPO.value || 1;
  const result = totalDiskon.value * rate;
  return isNaN(result) ? 0 : result;
});

const totalPpnInRupiah = computed(() => {
  const rate = kursPO.value || 1;
  return totalPpn.value * rate;
});

const totalPphInRupiah = computed(() => {
  const rate = kursPO.value || 1;
  return totalPph.value * rate;
});

const grandTotalInRupiah = computed(() => {
  const rate = kursPO.value || 1;
  return grandTotal.value * rate;
});

// Total PI dengan kurs PO (saat PO dibuat)
const totalPIKursSebelumnya = computed(() => {
  // Grand Total × Kurs PO = Nilai Rupiah saat PO dibuat
  // Jika kursPO = 0 (belum ada data PI), tampilkan 0
  return kursPO.value !== 0 ? grandTotal.value * kursPO.value : 0;
});

// Total PI dengan kurs sekarang (saat PI dibuat)
const totalPIKursSekarang = computed(() => {
  // Grand Total × Kurs PI Sekarang = Nilai Rupiah saat ini
  return grandTotal.value * (exchangeRateDisplay.value || 1);
});

// Selisih kurs dalam Rupiah antara Grand Total PI (kurs sekarang) vs kurs PO
const selisihKurs = computed(() => {
  return totalPIKursSekarang.value - totalPIKursSebelumnya.value;
});

// Selisih Kurs PI vs PO yang ditampilkan ke user (nominal IDR)
const selisihKursPIvsPO = computed(() => {
  return totalPIKursSekarang.value - grandTotalInRupiah.value;
});

// Opsional: selisih rate per unit (tidak ditampilkan sebagai Rupiah)
const selisihRatePIvsPO = computed(() => {
  return exchangeRateDisplay.value - kursPO.value;
});

// Helper: Calculate line total discount for display
const calculateLineDiscount = (item: DetailItem): number => {
  const qty = item.qty_pi || 0;
  const price = item.harga || 0;
  const disc1 = item.disc_1 || 0;
  const disc2 = item.disc_2 || 0;
  const line = qty * price;
  const discAmount1 = line * (disc1 / 100);
  const afterDisc1 = line - discAmount1;
  const discAmount2 = afterDisc1 * (disc2 / 100);
  const manualDisc = item.amt_disc || 0;
  return discAmount1 + discAmount2 + manualDisc;
};

// Helper: Calculate line total (after discounts) - ini adalah subtotal setelah diskon
const calculateLineTotal = (item: DetailItem): number => {
  const qty = item.qty_pi || 0;
  const price = item.harga || 0;
  const disc1 = item.disc_1 || 0;
  const disc2 = item.disc_2 || 0;
  const line = qty * price;
  const discAmount1 = line * (disc1 / 100);
  const afterDisc1 = line - discAmount1;
  const discAmount2 = afterDisc1 * (disc2 / 100);
  const manualDisc = item.amt_disc || 0;
  return afterDisc1 - discAmount2 - manualDisc;
};

const calculateLinePpn = (item: DetailItem): number => {
  const lineTotal = calculateLineTotal(item);
  // Parse percentage — accept both string "11" and number 11
  const rawPct = item.ppn_percentage !== undefined && item.ppn_percentage !== null && item.ppn_percentage !== ''
    ? item.ppn_percentage
    : (ppnPercentage.value || "0");
  const rate = Number(rawPct) / 100;
  const type = item.ppn_type || ppnType.value || "EXCLUDE";

  if (!rate || rate === 0) {
    if (item.ppn_amt) return item.ppn_amt;
    return 0;
  }

  if (type === "INCLUDE") {
    // PPN sudah termasuk dalam harga: PPN = (lineTotal / (1 + rate)) * rate
    return (lineTotal / (1 + rate)) * rate;
  }
  // PPN di luar harga: PPN = lineTotal * rate
  return lineTotal * rate;
};

// Helper: Calculate line grand total (after PPN, before PPH)
// PPH dikurangi di level grand total keseluruhan, bukan per-baris
const calculateLineGrandTotal = (item: DetailItem): number => {
  const lineTotal = calculateLineTotal(item);
  const linePpn = calculateLinePpn(item);
  const rawPct = item.ppn_percentage !== undefined && item.ppn_percentage !== null && item.ppn_percentage !== ''
    ? item.ppn_percentage
    : (ppnPercentage.value || "0");
  const rate = Number(rawPct) / 100;
  const type = item.ppn_type || ppnType.value || "EXCLUDE";

  if (type === "INCLUDE" && rate > 0) {
    // Jika INCLUDE: grand total = lineTotal (PPN sudah di dalam)
    return lineTotal;
  }
  // Jika EXCLUDE: grand total = lineTotal + PPN
  return lineTotal + linePpn;
};

// Update line totals when values change
const updateLineTotal = (item: DetailItem) => {
  item.total_diskon = calculateLineDiscount(item);
  item.total = calculateLineTotal(item);
};

// Handlers for per-line PPH/PPN selection
// Gunakan assignment langsung agar Vue bisa track perubahan reactive
const handleLinePphSelect = (item: DetailItem, selected: any) => {
  if (selected) {
    // value3 bisa berupa string atau number — pastikan konversi ke string
    item.pph_percentage = selected.value3 !== undefined && selected.value3 !== null
      ? String(selected.value3)
      : "0";
  } else {
    item.pph_percentage = "0";
  }
  updateLineTotal(item);
};

const handleLinePpnSelect = (item: DetailItem, selected: any) => {
  if (selected) {
    // value3 = persentase, value4 = tipe (INCLUDE/EXCLUDE)
    item.ppn_percentage = selected.value3 !== undefined && selected.value3 !== null
      ? String(selected.value3)
      : "0";
    // value4 bisa berisi "INCLUDE PPN 11%" atau "EXCLUDE" — ambil kata pertama jika perlu
    const rawType = String(selected.value4 || "").toUpperCase();
    item.ppn_type = rawType.includes("INCLUDE") ? "INCLUDE" : "EXCLUDE";
  } else {
    item.ppn_percentage = "0";
    item.ppn_type = "EXCLUDE";
  }
  updateLineTotal(item);
};

// Temp penampung data API
let initialValues: Record<string, any> = {};

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

// ============================================================================
// COMPUTED - PO API CONFIG
// ============================================================================
// API config untuk No. PO berdasarkan mode:
// - Edit/View mode: gunakan dynamic API untuk read data yang sudah tersimpan
// - Create mode: gunakan fn API untuk filter PO berdasarkan PB
const poApiConfig = computed(() => {
  // Jika edit mode atau view mode, gunakan dynamic API
  if (isEditMode.value || isViewMode.value) {
    return {
      url: `${API_BASE_URL}/dynamic/t_purchase_order`,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authStore.token}`,
      }, 
      params: {
        searchfield: "no_po",
        include: "m_currency>money,m_currency_d,m_general",
      },
      onsuccess: (response: any) => {
        response.hasNext = response.pagination?.next_page ? true : false;
        return response;
      },
    };
  }

  // Create mode: gunakan fn API untuk filter berdasarkan PB
  return {
    url: `${API_BASE_URL}/fn/t_purchase_order/getPObyPB`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authStore.token}`,
    },
    params: {
      t_penerimaan_barangs_id: selectedPBItems.value.map(pb => pb.id).join(","),
      searchfield: "no_po",
      ...(values.m_unit_bisnis_id && {
        filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
      }),
    },
    onsuccess: (response: any) => {
      response.hasNext = response.pagination?.next_page ? true : false;
      return response;
    },
  };
});

// ============================================================================
// HANDLERS
// ============================================================================
const handleSupplierSelect = (item: any) => {
  // console.log('Supplier selected:', item)
  // Clear related fields when supplier changes
  values.t_penerimaan_barang_id = "";
  selectedPBItems.value = [];
  values.t_purchase_order_id = "";
  detailItems.value = [];
  allowedPOIds.value = [];
  
  // Set TOP dari supplier
  if (item && item.top_id) {
    values.top_id = item.top_id;
    
    // Hitung tgl jatuh tempo jika ada top_supp
    if (item.termin && item.termin.value1) {
      const topMatch = item.termin.value1.match(/(\d+)/);
      if (topMatch) {
        const days = parseInt(topMatch[1]);
        const piDate = new Date(values.tgl_pi || new Date());
        piDate.setDate(piDate.getDate() + days);
        const year = piDate.getFullYear();
        const month = String(piDate.getMonth() + 1).padStart(2, "0");
        const date = String(piDate.getDate()).padStart(2, "0");
        values.tgl_jatuh_tempo = `${year}-${month}-${date}`;
      }
    }
  } else {
    values.top_id = "";
    values.tgl_jatuh_tempo = "";
  }

  if (item) {
    toast.info("No. PB direset karena supplier berubah");
  }
};

const handlePOSelect = (item: any) => {
  // console.log('PO selected:', item)

  // Jangan clear PB - PO dipilih terakhir jadi tidak ngaruh ke PB
  // Set t_purchase_order_id agar field PO dan field terkait terisi otomatis
  if (item && item.id) {
    values.t_purchase_order_id = item.id;
  }
  // Clear items saja untuk reload
  detailItems.value = [];

  // Set flag untuk skip next currency fetch PERTAMA KALI (sebelum ubah m_currency_id)
  skipNextCurrencyFetch = true;

  // Auto-fill supplier dari PO
  if (item && item.m_supplier_id) {
    values.m_supplier_id = item.m_supplier_id;
  }

  // Auto-fill ToP, PPH, PPN, Mata Uang dari PO
  if (item) {
    // ToP
    if (item.top_id) {
      values.top_id = item.top_id;
    }

    // PPH
    if (item.pph_id) {
      values.pph_id = item.pph_id;
    }
    // Extract PPH percentage from pph_po object
    // console.log('pph_po:', item.pph_po)
    if (item.pph_po && item.pph_po.value3) {
      pphPercentage.value = item.pph_po.value3;
      // console.log('PPH percentage set to:', item.pph_po.value3)
    } else {
      pphPercentage.value = "0";
    }

    // PPN
    if (item.ppn_id) {
      values.ppn_id = item.ppn_id;
    }
    // Extract PPN percentage from ppn_po object
    // console.log('ppn_po:', item.ppn_po)
    if (item.ppn_po && item.ppn_po.value3) {
      ppnPercentage.value = item.ppn_po.value3;
      // Load PPN type (INCLUDE or EXCLUDE) dari value4
      ppnType.value =
        (item.ppn_po.value4 as "INCLUDE" | "EXCLUDE") || "EXCLUDE";
      // console.log('PPN percentage set to:', item.ppn_po.value3)
    } else {
      ppnPercentage.value = "0";
      ppnType.value = "EXCLUDE";
    }

    // Set selectedCurrencyData dari PO TERLEBIH DAHULU (sebelum ubah m_currency_id)
    if (item.uang_po) {
      selectedCurrencyData.value = item.uang_po;
      // console.log('Currency data from PO:', item.uang_po)

      // Set m_currency_d_id dari det_uang_po di level PO (bukan dari uang_po.m_currency_ds)
      if (item.det_uang_po && item.det_uang_po.id) {
        values.m_currency_d_id = item.det_uang_po.id;
        // console.log('m_currency_d_id set to:', item.det_uang_po.id)
        // console.log('Exchange rate:', item.det_uang_po.rate)
      } else if (item.m_currency_d_id) {
        // Fallback: gunakan m_currency_d_id langsung dari PO
        values.m_currency_d_id = item.m_currency_d_id;
        // console.log('m_currency_d_id set to (fallback):', item.m_currency_d_id)
      } else {
        console.error("m_currency_d_id not found in PO - REQUIRED FIELD!");
      }
    } else {
      console.error("uang_po not found in PO data - REQUIRED FIELD!");
    }

    // Store currency code from PO for formatting
    if (item.uang_po && item.uang_po.money && item.uang_po.money.value5) {
      selectedPOCurrencyCode.value = item.uang_po.money.value5; // e.g., 'SGD', 'IDR', 'USD'
      // console.log('Currency code set to:', selectedPOCurrencyCode.value)
    } else {
      selectedPOCurrencyCode.value = "IDR";
    }

    // Set kursPO dari det_uang_po (rate yang digunakan saat PO dibuat)
    if (item.det_uang_po && item.det_uang_po.rate) {
      kursPO.value = Number(item.det_uang_po.rate) || 0;
      // console.log('Kurs PO set to:', kursPO.value)
    } else {
      kursPO.value = 0;
    }

    // Mata Uang - SET PALING AKHIR (agar watcher skip dengan flag)
    if (item.m_currency_id) {
      values.m_currency_id = item.m_currency_id;
    }

    // Calculate Tgl. Jatuh Tempo = Tgl. PI + ToP days
    if (item.top_po && item.top_po.value1) {
      // Extract number of days from value1 (e.g., "45 HARI" -> 45)
      const topMatch = item.top_po.value1.match(/(\d+)/);
      if (topMatch) {
        const days = parseInt(topMatch[1]);
        // Get today's date (from tgl_pi or current date)
        const piDate = new Date(values.tgl_pi || new Date());
        piDate.setDate(piDate.getDate() + days);
        // Format as YYYY-MM-DD
        const year = piDate.getFullYear();
        const month = String(piDate.getMonth() + 1).padStart(2, "0");
        const date = String(piDate.getDate()).padStart(2, "0");
        values.tgl_jatuh_tempo = `${year}-${month}-${date}`;
      }
    }

    // Auto-map detail items dari t_purchase_order_ds
    if (item.t_purchase_order_ds && Array.isArray(item.t_purchase_order_ds)) {
      detailItems.value = item.t_purchase_order_ds
        .filter((pod: any) => pod.t_penerimaan_barang_d) // Hanya ambil yang ada PB-nya
        .map((pod: any) => {
          const pbd = pod.t_penerimaan_barang_d || {};
          const mItem = pbd.m_item || {};
          const uom = mItem.mi_uom || {};

          const newItem: DetailItem = {
            t_purchase_order_id: pod.t_purchase_order_id,
            t_purchase_order_d_id: pod.id,
            t_penerimaan_barang_id: values.t_penerimaan_barang_id,
            t_penerimaan_barang_d_id: pbd.id,
            m_items_id: pod.m_items_id || pbd.m_items_id,
            uom_id: uom.id,

            // Display fields dari m_item
            kode_item: mItem.kode_item || "-",
            nama_item: mItem.nama_item || "-",
            satuan: uom.value1 || "-",

            // Qty dari PB detail
            qty_diterima: Number(pbd.qty_diterima) || 0,
            qty_retur: 0,
            qty_pi: Number(pbd.qty_diterima) || 0,

            // Price & discount dari PO detail
            harga: Number(pod.harga) || 0,
            disc_1: Number(pod.disc_1) || 0,
            disc_2: Number(pod.disc_2) || 0,
            amt_disc: Number(pod.amt_disc) || 0,

            // Calculated fields (will be updated by updateLineTotal)
            total_diskon: 0,
            total: 0,

            catatan: pbd.catatan || "",
          };

          // Calculate line totals
          updateLineTotal(newItem);

          return newItem;
        });

      if (detailItems.value.length > 0) {
        toast.success("Detail items berhasil dimuat", {
          description: `${detailItems.value.length} item dari PO berhasil ditambahkan`,
        });
      }
    }
  }
};

const selectedPBItems = ref<any[]>([]);

const handlePBSelect = async (items: any[]) => {
  selectedPBItems.value = items;
  values.t_purchase_order_id = "";
  detailItems.value = [];

  if (items && items.length > 0) {
    isDataFromPB.value = true;
    loading.value = true;
    try {
      for (const pb of items) {
        await autoLoadPBItems(pb);
      }
    } finally {
      loading.value = false;
    }
  } else {
    isDataFromPB.value = false;
  }
};

// Auto-load all items from a selected Penerimaan Barang object
const autoLoadPBItems = async (pb: any) => {
  if (!pb) return;

  const pbId = pb.id;
  const noPb = pb.no_penerimaan || "";
  const pbItems: any[] = pb.t_penerimaan_barang_ds || [];

  if (pbItems.length === 0) {
    toast.warning("Tidak ada item", {
      description: `PB ${noPb} tidak memiliki item detail`,
    });
    return;
  }

  // Get PO data from first item's t_purchase_order (for header values)
  const firstItem = pbItems[0];
  const poData = firstItem?.t_purchase_order || null;
  const poId = firstItem?.t_purchase_order_id || null;

  // Set header values from PO (hanya currency & TOP, bukan PPH/PPN)
  if (poData) {
    // TOP: hanya set jika belum ada (supplier mungkin sudah mengisi)
    if (!values.top_id && poData.top_id) values.top_id = poData.top_id;

    // Currency: set dari PO
    if (poData.m_currency_id) {
      skipNextCurrencyFetch = true;
      values.m_currency_id = poData.m_currency_id;
    }
    if (poData.m_currency_d_id) values.m_currency_d_id = poData.m_currency_d_id;
    if (poData.exchange_rate) {
      values.exchange_rate = Number(poData.exchange_rate) || 1;
      kursPO.value = Number(poData.exchange_rate) || 1;
    }
  }

  // Map items from t_penerimaan_barang_ds
  pbItems.forEach((item: any) => {
    const pod = item.t_purchase_order_d;
    // PO bisa ada di item.t_purchase_order atau di pod.t_purchase_order
    const po = item.t_purchase_order || pod?.t_purchase_order;

    // Resolve ppn_po dan pph_po dari PO
    const ppnPo = po?.ppn_po;
    const pphPo = po?.pph_po;

    const ppnPercentageItem = (ppnPo?.value3 !== undefined && ppnPo?.value3 !== null)
      ? String(ppnPo.value3)
      : '0';
    const ppnTypeItem: 'INCLUDE' | 'EXCLUDE' = ppnPo?.value4
      ? (String(ppnPo.value4).toUpperCase().includes('INCLUDE') ? 'INCLUDE' : 'EXCLUDE')
      : 'EXCLUDE';
    const pphPercentageItem = (pphPo?.value3 !== undefined && pphPo?.value3 !== null)
      ? String(pphPo.value3)
      : '0';

    const newItem: DetailItem = {
      t_purchase_order_id: po?.id || pod?.t_purchase_order_id,
      t_purchase_order_d_id: item.t_purchase_order_d_id,
      t_penerimaan_barang_id: pbId,
      t_penerimaan_barang_d_id: item.id,
      m_items_id: item.m_items_id,
      uom_id: item.m_item?.mi_uom?.id || pod?.m_item?.mi_uom?.id,
      kode_item: item.m_item?.kode_item || pod?.m_item?.kode_item || "-",
      nama_item: item.m_item?.nama_item || pod?.m_item?.nama_item || "-",
      no_pb: noPb,
      no_po: po?.no_po || "",
      // Auto value PPN/PPH from PO
      ppn_id: po?.ppn_id || "",
      ppn_percentage: ppnPercentageItem,
      ppn_type: ppnTypeItem,
      pph_id: po?.pph_id || "",
      pph_percentage: pphPercentageItem,
      qty_diterima: item.qty_diterima || 0,
      qty_retur: item.qty_return_pb_approved || 0,
      qty_pi: item.qty_sisa_invoice || 0,
      satuan: item.m_item?.mi_uom?.value1 || "-",
      harga: Number(pod?.harga) || 0,
      disc_1: Number(pod?.disc_1) || 0,
      disc_2: Number(pod?.disc_2) || 0,
      amt_disc: Number(pod?.amt_disc) || 0,
      total_diskon: 0,
      total: 0,
      catatan: "",
    };
    detailItems.value.push(newItem);
    updateLineTotal(newItem);
  });

  // Sync header-level ppn/pph percentage dari item pertama (untuk label % di ringkasan)
  const firstPbItem = pbItems[0];
  const firstPod = firstPbItem?.t_purchase_order_d;
  const firstPo = firstPbItem?.t_purchase_order || firstPod?.t_purchase_order;
  if (firstPo) {
    if (firstPo.ppn_po?.value3 !== undefined && firstPo.ppn_po?.value3 !== null) {
      ppnPercentage.value = String(firstPo.ppn_po.value3);
      ppnType.value = String(firstPo.ppn_po.value4 || '').toUpperCase().includes('INCLUDE') ? 'INCLUDE' : 'EXCLUDE';
    }
    if (firstPo.pph_po?.value3 !== undefined && firstPo.pph_po?.value3 !== null) {
      pphPercentage.value = String(firstPo.pph_po.value3);
    }
  }

  toast.success("Items berhasil dimuat", {
    description: `${pbItems.length} item dari ${noPb} berhasil ditambahkan`,
  });
};


const handlePphSelect = (item: any) => {
  if (item && item.value3) {
    pphPercentage.value = item.value3;
  } else if (item === null) {
    pphPercentage.value = "0";
  }
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

// ============================================================================
// ERRORS
// ============================================================================
const errors = reactive({
  m_supplier_id: "",
  t_penerimaan_barang_id: "",
});

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    no_pi: "",
    tgl_pi: new Date().toISOString().split("T")[0],
    status: "DRAFT",
    m_supplier_id: "",
    t_purchase_order_id: "",
    t_penerimaan_barang_id: "",
    tgl_jatuh_tempo: "",
    top_id: "",
    ppn_id: "dc697972-3785-4f50-98ff-dfa6a1f9d6fa",
    pph_id: "3ab07ab2-f94c-4638-9535-7eac0865c858",
    m_currency_id: "",
    m_currency_d_id: "",
    m_unit_bisnis_id: "",
    exchange_rate: 1,
    catatan: "",
    created_by: authStore.user?.id || "",
  });

  detailItems.value = [];
  selectedPBItems.value = [];
  pphPercentage.value = "0";
  ppnPercentage.value = "0";

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
    // Create mode: auto-load default IDR currency
    if (!values.m_currency_id) {
      await fetchDefaultIDRCurrency();
    }
    return;
  }

  loading.value = true;
  try {
    const res = await getTPurchaseInvoiceById(sourceId);

    if (res.status !== "success") throw new Error("Gagal memuat data");
    initialValues = res.data;

    auditMeta.value = {
      created_by: initialValues.created_by || initialValues.createdBy || null,
      createdAt: initialValues.createdAt || null,
      updated_by: initialValues.updated_by || initialValues.update_by || initialValues.edited_by || null,
      updatedAt: initialValues.updatedAt || null,
    };

    // Mode copy
    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
      delete (initialValues as any).no_pi;
      values.status = "DRAFT";
    }

    // Assign values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        (values as any)[key] = initialValues[key];
      }
    }

    // Load PPH, PPN, ToP, dan Kurs PO dari t_purchase_order
    // Ambil t_purchase_order_id dari detail item pertama
    const firstDetail = (initialValues as any).t_purchase_invoice_ds?.[0];
    const poId = firstDetail?.t_penerimaan_barang_d?.t_purchase_order_id;

    // Tentukan kursPO dari data PO pertama
    const dsArray = (initialValues as any).t_purchase_invoice_d || (initialValues as any).t_purchase_invoice_ds;
    if (poId && dsArray && dsArray.length > 0) {
      const firstPod = dsArray[0]?.t_purchase_order_d || {};
      const tpo = firstPod.t_purchase_order || {};
      if (tpo.exchange_rate) {
        kursPO.value = Number(tpo.exchange_rate) || 1;
      }
    }

    // Save initial currency ID untuk detect perubahan user di edit mode
    initialCurrencyId = values.m_currency_id;

    // Load currency data - gunakan data dari PI yang tersimpan untuk view/edit
    if (values.m_currency_id) {
      // Jika ada m_currency_d dan m_currency (saved currency detail dari PI), gunakan itu
      if (
        (initialValues as any).m_currency_d &&
        (initialValues as any).m_currency
      ) {
        isCurrencyFromSavedPI.value = true;

        // Build selectedCurrencyData dari m_currency dan m_currency_d yang tersimpan
        selectedCurrencyData.value = {
          id: (initialValues as any).m_currency.id,
          kode_currency: (initialValues as any).m_currency.kode_currency,
          nama_currency: (initialValues as any).m_currency.nama_currency,
          money: (initialValues as any).m_currency.money,
          m_currency_ds: [
            {
              id: (initialValues as any).m_currency_d.id,
              tgl_mulai: (initialValues as any).m_currency_d.tgl_mulai,
              rate: (initialValues as any).m_currency_d.rate,
              is_active: (initialValues as any).m_currency_d.is_active,
            },
          ],
        };

        console.log(
          "Currency data loaded from saved PI:",
          selectedCurrencyData.value,
        );
      } else {
        // Fallback: fetch dari API jika tidak ada m_currency_d
        isCurrencyFromSavedPI.value = false;
        await fetchCurrencyData(values.m_currency_id);
      }

      // Pastikan m_currency_d_id ter-set dengan benar setelah load currency data
      if (!values.m_currency_d_id && activeCurrencyDetailId.value) {
        values.m_currency_d_id = activeCurrencyDetailId.value;
        console.log(
          "m_currency_d_id auto-set after currency data loaded:",
          values.m_currency_d_id,
        );
      }
    }

    // Load detail items dari t_purchase_invoice_d (atau ds)
    if (dsArray && Array.isArray(dsArray)) {
      detailItems.value = dsArray.map(
        (ds: any) => {
          const pbd = ds.tpenerimaan_bd || ds.t_penerimaan_barang_d || {};
          const pod = ds.t_purchase_order_d || {};
          const po = pod.t_purchase_order || {};
          const item = ds.m_item || ds.m_items || {};
          const pbs = ds.tpenerimaan_barangs || ds.t_penerimaan_barangs || {};
          const uom = item.mi_uom || ds.pi_d_uom || {};

          return {
            id: ds.id,
            t_purchase_invoice_id: ds.t_purchase_invoice_id,
            t_purchase_order_id: ds.t_purchase_order_id || pod.t_purchase_order_id,
            t_purchase_order_d_id: ds.t_purchase_order_d_id,
            t_penerimaan_barang_id: ds.t_penerimaan_barang_id,
            t_penerimaan_barang_d_id: ds.t_penerimaan_barang_d_id,
            uom_id: ds.uom_id || uom.id,

            // Item info dari t_purchase_order_d / invoice_d
            m_items_id: ds.m_items_id || pod.m_items_id,
            qty_po: pod.qty_po || 0,
            harga: Number(ds.harga) || Number(pod.harga) || 0,
            disc_1: Number(ds.r_disc1) || Number(pod.disc_1) || 0,
            disc_2: Number(ds.r_disc2) || Number(pod.disc_2) || 0,
            amt_disc: Number(ds.disc_amt) || Number(pod.amt_disc) || 0,

            // Item info dari t_penerimaan_barang_d
            qty_diterima: pbd.qty_diterima || 0,
            qty_sisa: pbd.qty_sisa || 0,

            // Values dari detail invoice (yang sudah disimpan)
            qty_retur: ds.qty_retur || 0,
            qty_pi: ds.qty_pi || 0,
            total_diskon: 0,
            total: 0,

            // Item details dari m_items
            catatan: ds.catatan || "",
            kode_item: item.kode_item || "-",
            nama_item: item.nama_item || "-",
            no_po: po.no_po || "",
            no_pb: pbs.no_penerimaan || "-",
            satuan: uom.value1 || "-",

            // PPN & PPH fields (newly added for per-item support)
            ppn_id: ds.ppn_id || po.ppn_id || "",
            ppn_percentage: String(ds.ppn_percentage || po.ppn_po?.value3 || "0"),
            ppn_type: (ds.ppn_type as 'INCLUDE' | 'EXCLUDE') || (po.ppn_po?.value4 as 'INCLUDE' | 'EXCLUDE') || "EXCLUDE",
            ppn_amt: Number(ds.ppn_amt) || 0,
            pph_id: ds.pph_id || po.pph_id || "",
            pph_percentage: String(ds.pph_percentage || po.pph_po?.value3 || "0"),
            pph_amt: Number(ds.pph_amt) || 0,
          } as DetailItem;
        },
      );

      // Fetch details untuk PPN dan PPH percentage agar terender dengan benar
      try {
        const uniquePpnIds = [...new Set(detailItems.value.map(i => i.ppn_id).filter(id => id))];
        const uniquePphIds = [...new Set(detailItems.value.map(i => i.pph_id).filter(id => id))];
        
        if (uniquePpnIds.length > 0 || uniquePphIds.length > 0) {
          const generalDataMap = new Map();
          
          for (const id of [...uniquePpnIds, ...uniquePphIds]) {
            if (!generalDataMap.has(id)) {
               const res:any = await apiCall(`${API_BASE_URL}/dynamic/m_general/${id}`, { method: 'GET' });
               if (res.status === 'success' && res.data) {
                 generalDataMap.set(id, res.data);
               }
            }
          }
          
          detailItems.value.forEach(item => {
            if (item.ppn_id && generalDataMap.has(item.ppn_id)) {
              const data = generalDataMap.get(item.ppn_id);
              item.ppn_percentage = String(data.value3 || "0");
              item.ppn_type = (data.value4 as 'INCLUDE' | 'EXCLUDE') || 'EXCLUDE';
            }
            if (item.pph_id && generalDataMap.has(item.pph_id)) {
              const data = generalDataMap.get(item.pph_id);
              item.pph_percentage = String(data.value3 || "0");
            }
            updateLineTotal(item);
          });
        } else {
          detailItems.value.forEach((item) => updateLineTotal(item));
        }
      } catch (e) {
        console.error("Failed to fetch PPN/PPH master details", e);
        detailItems.value.forEach((item) => updateLineTotal(item));
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

    if (isCopyModeLocal) {
      toast.success("Data berhasil disalin", {
        description: "Silakan edit dan simpan sebagai Purchase Invoice baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Purchase Invoice", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () => router.push("/purchasing/transaksi/t_purchase_invoice"),
      },
    });
    setTimeout(
      () => router.push("/purchasing/transaksi/t_purchase_invoice"),
      2000,
    );
  } finally {
    loading.value = false;
  }
});

// ============================================================================
// WATCHERS - MONITOR CURRENCY CHANGES
// ============================================================================
// Helper: Fetch option detail by id and push to options array if missing
async function fetchOptionDetail(
  apiUrl: string,
  id: string,
  optionsArray: { value: Array<{ id: string }> },
  token: string,
): Promise<void> {
  if (!id || optionsArray.value.some((opt: { id: string }) => opt.id === id))
    return;
  try {
    const response = await fetch(`${apiUrl}/${id}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    const result = await response.json();
    if (result.status === "success" && result.data) {
      optionsArray.value.push(result.data);
    }
  } catch (e) {
    // ignore
  }
}

// Options array for each select
const optionsTop = ref([]);
const optionsPph = ref([]);
const optionsPpn = ref([]);
const optionsCurrency = ref([]);

// Watchers to ensure label always shown for readonly select
watch(
  () => values.top_id || "",
  async (id: string) => {
    if (!id) return;
    // @ts-ignore
    await fetchOptionDetail(
      `${API_BASE_URL}/dynamic/m_general`,
      id,
      optionsTop,
      authStore.token ?? "",
    );
  },
);
watch(
  () => values.pph_id || "",
  async (id: string) => {
    if (!id) return;
    // @ts-ignore
    await fetchOptionDetail(
      `${API_BASE_URL}/dynamic/m_general`,
      id,
      optionsPph,
      authStore.token ?? "",
    );
  },
);
watch(
  () => values.ppn_id || "",
  async (id: string) => {
    if (!id) return;
    // @ts-ignore
    await fetchOptionDetail(
      `${API_BASE_URL}/dynamic/m_general`,
      id,
      optionsPpn,
      authStore.token ?? "",
    );
  },
);
watch(
  () => values.m_currency_id || "",
  async (id: string) => {
    if (!id) return;
    // @ts-ignore
    await fetchOptionDetail(
      `${API_BASE_URL}/dynamic/m_currency`,
      id,
      optionsCurrency,
      authStore.token ?? "",
    );
  },
);
watch(
  () => values.m_unit_bisnis_id || "",
  async (id: string) => {
    await fetchSelectedUnitBisnis(id);
  },
  { immediate: true },
);
// Helper function untuk fetch currency data
const fetchCurrencyData = async (currencyId: string) => {
  if (!currencyId) {
    selectedCurrencyData.value = null;
    return;
  }

  console.log("Fetching currency data for ID:", currencyId);

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

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log("Currency fetch response:", result);

    if (result.status === "success" && result.data) {
      selectedCurrencyData.value = result.data;
      console.log("Currency data loaded successfully:", result.data);

      // Auto-set m_currency_d_id dari active currency detail jika belum ada
      if (!values.m_currency_d_id && activeCurrencyDetailId.value) {
        values.m_currency_d_id = activeCurrencyDetailId.value;
        console.log(
          "m_currency_d_id auto-set to active:",
          activeCurrencyDetailId.value,
        );
      } else if (!activeCurrencyDetailId.value) {
        console.warn(
          "No active currency detail found for currency:",
          currencyId,
        );
        console.log("Available currency details:", result.data?.m_currency_ds);

        // Untuk IDR, tetap coba set dari detail pertama yang tersedia
        if (isCurrencyRupiah.value && result.data?.m_currency_ds?.length > 0) {
          const firstDetail = result.data.m_currency_ds[0];
          if (firstDetail && firstDetail.id && !values.m_currency_d_id) {
            values.m_currency_d_id = firstDetail.id;
            console.log(
              "m_currency_d_id auto-set to first available for IDR:",
              values.m_currency_d_id,
            );
          }
        }
      }
    } else {
      console.error(
        "Failed to fetch currency data - invalid response:",
        result,
      );
      selectedCurrencyData.value = null;
      toast.error("Gagal memuat data currency", {
        description: result.message || "Response tidak valid dari server",
      });
    }
  } catch (error) {
    console.error("Failed to fetch currency data - network error:", error);
    selectedCurrencyData.value = null;
    toast.error("Gagal memuat data currency", {
      description:
        error instanceof Error ? error.message : "Terjadi kesalahan jaringan",
    });
  }
};

// Helper function untuk fetch default IDR currency
const fetchDefaultIDRCurrency = async () => {
  console.log("Fetching default IDR currency...");

  try {
    // Try multiple search strategies to find IDR
    const searchStrategies = [
       `${API_BASE_URL}/dynamic/m_currency?no_pagination=true&join=true&filter_column_money.code=IDR`,
    ];

    let result = null;
    for (const url of searchStrategies) {
      try {
        const response = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authStore.token}`,
          },
        });

        if (response.ok) {
          result = await response.json();
          if (
            result.status === "success" &&
            result.data &&
            result.data.length > 0
          ) {
            console.log("IDR currency found with strategy:", url);
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }

    if (
      result &&
      result.status === "success" &&
      result.data &&
      result.data.length > 0
    ) {
      const idrCurrency = result.data[0];
      values.m_currency_id = idrCurrency.id;
      selectedCurrencyData.value = idrCurrency;
      console.log("Default IDR currency loaded successfully:", idrCurrency);

      // Auto-set m_currency_d_id dari detail yang tersedia
      if (idrCurrency.m_currency_ds && idrCurrency.m_currency_ds.length > 0) {
        const firstDetail = idrCurrency.m_currency_ds[0];
        if (firstDetail && firstDetail.id) {
          values.m_currency_d_id = firstDetail.id;
          console.log(
            "IDR m_currency_d_id auto-set to:",
            values.m_currency_d_id,
          );
        }
      } else {
        console.warn("No currency details found for IDR currency");
      }

      // Silent success - no need to show notification
      console.log("✓ Mata uang default (IDR) berhasil dimuat");
    } else {
      // Silent fail - just log, don't show error to user
      console.warn(
        "IDR currency not found - user will need to select currency manually",
      );
    }
  } catch (error) {
    // Silent fail - just log, don't disturb user experience
    console.warn("Failed to fetch default IDR currency:", error);
  }
};

// Handler untuk refresh currency (sync dengan master currency terbaru)
const handleRefreshCurrency = async () => {
  if (!values.m_currency_id) {
    toast.error("Currency belum dipilih");
    return;
  }

  isRefreshingCurrency.value = true;
  try {
    // Reset flag untuk force fetch data baru
    isCurrencyFromSavedPI.value = false;

    // Fetch currency data terbaru dari master
    await fetchCurrencyData(values.m_currency_id);

    // Update m_currency_d_id dengan yang aktif
    if (activeCurrencyDetailId.value) {
      values.m_currency_d_id = activeCurrencyDetailId.value;
    }

    toast.success("Currency berhasil disinkronkan", {
      description: `Kurs terbaru: ${exchangeRateDisplay.value.toLocaleString("id-ID")} Rp/Unit`,
    });
  } catch (error) {
    toast.error("Gagal menyinkronkan currency", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    isRefreshingCurrency.value = false;
  }
};

watch(
  () => values.m_currency_id,
  (newCurrencyId, oldCurrencyId) => {
    console.log("Currency ID changed from", oldCurrencyId, "to", newCurrencyId);

    // Jika currency berubah dari initial value (user ubah), selalu fetch data currency yang baru
    if (isEditMode.value && newCurrencyId !== initialCurrencyId) {
      // User ubah currency di edit mode - reset flag dan fetch data yang baru
      console.log("Edit mode: fetching new currency data due to user change");
      isCurrencyFromSavedPI.value = false;
      fetchCurrencyData(newCurrencyId);
      return;
    }

    // Jangan fetch ulang jika sedang dalam mode view/edit dan sudah ada saved PI data (belum ada perubahan dari user)
    if ((isEditMode.value || isViewMode.value) && isCurrencyFromSavedPI.value) {
      console.log("Skipping fetch - using saved PI currency data");
      return;
    }

    // Skip fetch jika flag aktif (data sudah dari PO)
    if (skipNextCurrencyFetch) {
      skipNextCurrencyFetch = false; // Reset flag untuk fetch berikutnya
      console.log("Currency fetch skipped - data from PO used");
      return;
    }

    // Fetch untuk create mode atau jika currency diubah
    console.log("Fetching currency data for create mode or currency change");
    fetchCurrencyData(newCurrencyId)
      .then(() => {
        // Auto-set m_currency_d_id setelah fetch berhasil jika belum ada
        if (!values.m_currency_d_id && activeCurrencyDetailId.value) {
          values.m_currency_d_id = activeCurrencyDetailId.value;
          console.log(
            "m_currency_d_id auto-set after currency change:",
            activeCurrencyDetailId.value,
          );
        }
      })
      .catch((error) => {
        console.error("Error in currency watcher fetch:", error);
      });
  },
);

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

  // Validasi m_currency_d_id wajib ada
  if (!values.m_currency_d_id?.trim()) {
    // Debug info untuk troubleshooting
    console.error("Currency validation failed:", {
      m_currency_id: values.m_currency_id,
      selectedCurrencyData: selectedCurrencyData.value,
      activeCurrencyDetailId: activeCurrencyDetailId.value,
      isCurrencyRupiah: isCurrencyRupiah.value,
    });

    // Jika selectedCurrencyData null tapi m_currency_id ada, coba fetch ulang
    if (!selectedCurrencyData.value && values.m_currency_id) {
      console.log("Attempting to re-fetch currency data for validation...");
      try {
        await fetchCurrencyData(values.m_currency_id);
        // Tunggu sebentar untuk computed property ter-update
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error("Failed to re-fetch currency data:", error);
      }
    }

    // Coba auto-set dari activeCurrencyDetailId setelah possible re-fetch
    if (activeCurrencyDetailId.value) {
      values.m_currency_d_id = activeCurrencyDetailId.value;
      console.log("Auto-set m_currency_d_id to:", values.m_currency_d_id);
    } else {
      // Khusus untuk IDR/Rupiah, coba ambil detail pertama yang tersedia
      if (
        isCurrencyRupiah.value &&
        selectedCurrencyData.value?.m_currency_ds?.length > 0
      ) {
        // Untuk IDR, gunakan detail pertama yang tersedia
        const firstDetail = selectedCurrencyData.value.m_currency_ds[0];
        if (firstDetail && firstDetail.id) {
          values.m_currency_d_id = firstDetail.id;
          console.log(
            "Auto-set IDR m_currency_d_id to first available:",
            values.m_currency_d_id,
          );
          toast.info("Mata uang Rupiah menggunakan kurs default", {
            description:
              "Menggunakan detail kurs yang tersedia untuk mata uang dasar",
          });
        } else {
          console.error("No valid m_currency_ds available for IDR");
          toast.error("Validasi gagal", {
            description:
              "Data kurs mata uang IDR tidak tersedia atau tidak valid",
          });
          return;
        }
      } else if (selectedCurrencyData.value === null) {
        toast.error("Validasi gagal", {
          description:
            "Data mata uang tidak dapat dimuat. Silakan refresh halaman atau pilih mata uang kembali.",
        });
        return;
      } else {
        toast.error("Validasi gagal", {
          description:
            "Data exchange rate currency tidak ditemukan. Pastikan mata uang memiliki kurs yang valid dan aktif.",
        });
        return;
      }
    }
  }

  // Validasi detail items tidak boleh kosong
  if (detailItems.value.length === 0) {
    toast.error("Validasi gagal", {
      description: "Minimal ada 1 item detail yang harus ditambahkan",
    });
    return;
  }

  if (invalid) {
    toast.error("Validasi gagal", {
      description: "Mohon lengkapi semua field yang wajib diisi",
    });
    return;
  }

  // Jika Super Admin, tampilkan dialog konfirmasi dulu
  if (isSuperAdmin.value) {
    isSuperAdminDialogOpen.value = true;
    return;
  }

  // Lanjutkan proses save
  await proceedWithSave();
};

/** Proceed with save after validation/confirmation */
const proceedWithSave = async () => {
  loading.value = true;
  try {
    const currentUserId = authStore.user?.id || "";

    // Helper: Convert empty string to null for UUID fields
    const toNullIfEmpty = (value: string | null | undefined): string | null => {
      return value && value.trim() !== "" ? value : null;
    };

    const payload: any = {
      m_unit_bisnis_id: toNullIfEmpty(values.m_unit_bisnis_id),
      tgl_pi: values.tgl_pi || null,
      m_supplier_id: toNullIfEmpty(values.m_supplier_id),
      tgl_jatuh_tempo: values.tgl_jatuh_tempo || null,
      m_currency_id: toNullIfEmpty(values.m_currency_id),
      m_currency_d_id: toNullIfEmpty(values.m_currency_d_id),
      exchange_rate: exchangeRateDisplay.value || 1, // Default 1 untuk IDR
      // Store values in Rupiah (converted with exchange rate)
      total: totalInRupiah.value || null,
      total_diskon: totalDiskonInRupiah.value || null,
      total_ppn: totalPpnInRupiah.value || null,
      total_pph: totalPphInRupiah.value || null,
      grand_total: grandTotalInRupiah.value || null,
      // Super Admin: status langsung APPROVED, user biasa: DRAFT
      status: isSuperAdmin.value ? "APPROVED" : values.status || "DRAFT",
      no_pi: values.no_pi?.trim() || null,
      catatan: values.catatan?.trim() || null,
      seri_pajak: values.seri_pajak || 0,
      dpp_lainnya: dppLainnyaValue.value || 0,
      ...(isEditMode.value
        ? { updated_by: currentUserId, edited_by: currentUserId }
        : { created_by: currentUserId, updated_by: currentUserId, edited_by: currentUserId }),
      ...(isEditMode.value && { updatedAt: new Date().toISOString() }),
      t_purchase_invoice_ds: detailItems.value.map((item) => {
        const subtotal = calculateLineTotal(item);
        const ppn_amt = calculateLinePpn(item);
        const pph_amt = Math.round(subtotal * Number(item.pph_percentage || "0") / 100);
        const grand_total = calculateLineGrandTotal(item);
        
        return {
          ...(item.id && { id: item.id }),
          t_purchase_order_id: toNullIfEmpty(item.t_purchase_order_id),
          t_purchase_order_d_id: toNullIfEmpty(item.t_purchase_order_d_id),
          t_penerimaan_barang_id: toNullIfEmpty(item.t_penerimaan_barang_id),
          t_penerimaan_barang_d_id: toNullIfEmpty(item.t_penerimaan_barang_d_id),
          m_items_id: toNullIfEmpty(item.m_items_id),
          qty_diterima: item.qty_diterima || 0,
          qty_retur: item.qty_retur || 0,
          qty_pi: item.qty_pi || 0,
          uom_id: toNullIfEmpty(item.uom_id),
          harga: item.harga || 0,
          catatan: item.catatan?.trim() || null,
          r_disc1: item.disc_1 || 0,
          r_disc2: item.disc_2 || 0,
          disc_amt: item.amt_disc || 0,
          subtotal: subtotal,
          ppn_id: toNullIfEmpty(item.ppn_id),
          pph_id: toNullIfEmpty(item.pph_id),
          ppn_amt: ppn_amt,
          pph_amt: pph_amt,
          grand_total: grand_total,
        };
      }),
    };

    if (!isEditMode.value) {
      payload.created_by = currentUserId;
    }

    let savedId: string | undefined = isEditMode.value
      ? menuId.value
      : undefined;

    if (isEditMode.value) {
      await updateTPurchaseInvoice(menuId.value, payload);
      toast.success("Purchase Invoice berhasil diperbarui", {
        description: `Purchase Invoice ${values.no_pi || ""} telah diperbarui${isSuperAdmin.value ? " dengan status APPROVED" : ""}`,
      });
    } else {
      const res = await createTPurchaseInvoice(payload);
      savedId = (res as any)?.data?.id;
      toast.success("Purchase Invoice berhasil dibuat", {
        description: `Data Purchase Invoice baru telah ditambahkan${isSuperAdmin.value ? " dengan status APPROVED" : ""}`,
      });
    }

    // Jika Super Admin: panggil fn approve dengan level tertinggi
    if (isSuperAdmin.value && savedId) {
      try {
        const allApprovals = authStore
          .getApprovalList()
          .filter(
            (a: any) => a.path === "/purchasing/transaksi/t_purchase_invoice",
          );
        const maxLevel =
          allApprovals.length > 0
            ? Math.max(...allApprovals.map((a: any) => a.level ?? 0))
            : 1;
        await approveTPurchaseInvoice(
          savedId,
          null,
          maxLevel,
          "Auto approved by Super Admin",
        );
      } catch (approvalErr) {
        console.warn(
          "Failed to call Purchase Invoice approve endpoint:",
          approvalErr,
        );
      }
    }

    router.replace(
      "/purchasing/transaksi/t_purchase_invoice?reload=" + Date.now(),
    );
  } catch (error) {
    toast.error(
      isEditMode.value
        ? "Gagal memperbarui Purchase Invoice"
        : "Gagal membuat Purchase Invoice",
      {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      },
    );
  } finally {
    loading.value = false;
  }
};

/** Confirm Super Admin save */
const confirmSuperAdminSave = async () => {
  isSuperAdminDialogOpen.value = false;
  await proceedWithSave();
};

/** Cancel Super Admin save */
const cancelSuperAdminSave = () => {
  isSuperAdminDialogOpen.value = false;
};

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push("/purchasing/transaksi/t_purchase_invoice");
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
          <CardTitle>Informasi Purchase Invoice</CardTitle>
          <CardDescription
            >Isi data Purchase Invoice dengan lengkap dan benar</CardDescription
          >
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- LEFT COLUMN -->

            <!-- Company (Unit Bisnis) -->
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
                    include: 'm_company',
                  },
                }"
                @update:valueFull="handleUnitBisnisSelected"
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

            <!-- Status -->
            <FieldX
              id="status"
              label="Status"
              :value="values.status"
              disabled
              readonly
              placeholder="Status PI"
            />
            <!-- No. Purchase Invoice (Auto, Readonly) -->
            <FieldX
              id="no_pi"
              label="No. Purchase Invoice"
              :value="values.no_pi"
              disabled
              readonly
              placeholder="Auto generate by system"
            />

            <!-- Tgl. PI -->
            <FieldDate
              id="tgl_pi"
              label="Tgl. PI"
              :value="values.tgl_pi"
              @input="(v: string) => (values.tgl_pi = v)"
              :required="!isReadOnly"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
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
                  filter_column_is_active: 'true',
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
              id="top_id"
              label="ToP"
              :value="values.top_id"
              :disabled="isReadOnly || isDataFromPB"
              :readonly="isReadOnly || isDataFromPB"
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

            <!-- Tgl. Jatuh Tempo -->
            <FieldDate
              id="tgl_jatuh_tempo"
              label="Tgl. Jth Tempo"
              :value="values.tgl_jatuh_tempo"
              @input="(v: string) => (values.tgl_jatuh_tempo = v)"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
            />


            <!-- Mata Uang -->
            <div class="space-y-2">
              <div class="flex items-center gap-2">
                <FieldSelect
                  class="flex-1"
                  id="m_currency_id"
                  label="Mata Uang"
                  v-model="values.m_currency_id"
                  :disabled="isReadOnly"
                  :readonly="isReadOnly"
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
              </div>
            </div>

            <!-- Catatan -->
            <div class="space-y-2">
              <Label for="catatan">Catatan</Label>
              <textarea
                id="catatan"
                v-model="values.catatan"
                :disabled="isReadOnly"
                rows="2"
                placeholder="Catatan tambahan..."
                class="flex min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              ></textarea>
            </div>

            <!-- Seri Pajak -->
            <div class="space-y-2">
              <Label for="seri_pajak">Seri Pajak</Label>
              <FieldNumber
                id="seri_pajak"
                v-model="values.seri_pajak"
                type="decimal"
                placeholder="Masukkan seri pajak"
                :disabled="isReadOnly"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- DETAIL ITEMS CARD -->
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <div>
              <CardTitle>Purchase Invoice Detail</CardTitle>
              <CardDescription class="text-xs"
                >Items akan otomatis dimuat setelah memilih No.
                PB</CardDescription
              >
            </div>
            <div v-if="!isReadOnly">
              <ButtonMultiSelect
                id="select_multiple_pb"
                label="Pilih No. PB"
                :selected-items="selectedPBItems"
                @add="handlePBSelect"
                :disabled="loading || isReadOnly || !values.m_supplier_id"
                displayField="no_penerimaan"
                valueField="id"
                :api="{
                  url: `${API_BASE_URL}/fn/t_penerimaan_barangs/GetAllDataPB`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    searchfield: 'no_penerimaan,no_sj_supp,no_inv_supp',
                    include: 't_penerimaan_barang_d>t_purchase_order_d>t_purchase_order:id|no_po|ppn_id|pph_id|exchange_rate,t_penerimaan_barang_d>t_purchase_order_d>t_purchase_order>m_general:id|group|value1|value3|value4',
                    ...(values.m_unit_bisnis_id && {
                      filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
                    }),
                    ...(values.m_supplier_id && {
                      filter_column_m_supplier_id: values.m_supplier_id,
                    }),
                  },
                  onsuccess: (response: any) => {
                    response.hasNext = response.pagination?.next_page ? true : false;
                    return response;
                  },
                }"
                :columns="[
                  { field: 'no_penerimaan', headerName: 'No. Penerimaan', filterable: true, sortable: true, filter: 'ColFilter' },
                  { field: 'tgl_penerimaan', headerName: 'Tanggal', sortable: true, filterable: false },
                  { field: 'm_supplier.nama_supp', headerName: 'Supplier', filterable: true, sortable: true, filter: 'ColFilter', render: (row: any) => row.m_supplier?.nama_supp || '-' },
                  { field: 'no_sj_supp', headerName: 'No. SJ', filterable: true, sortable: true, filter: 'ColFilter' },
                  { field: 't_penerimaan_barang_ds', headerName: 'Total Items', sortable: false, filterable: false, render: (row: any) => row.t_penerimaan_barang_ds?.length || 0 },
                ]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="border rounded-lg overflow-x-auto">
            <div class="min-w-[150%]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-[50px]">No</TableHead>
                    <TableHead class="w-[120px]">Kode</TableHead>
                    <TableHead class="w-[200px]">Nama Item</TableHead>
                    <TableHead class="w-[150px]">No. PB</TableHead>
                    <TableHead class="w-[150px]">No. PO</TableHead>
                    <TableHead class="w-[90px]">Qty Diterima</TableHead>
                    <TableHead class="w-20">Qty Retur</TableHead>
                    <TableHead class="w-20">Qty PI</TableHead>
                    <TableHead class="w-[70px]">Satuan</TableHead>
                    <TableHead class="w-[120px]">Harga</TableHead>
                    <TableHead class="w-20">Disc. 1 %</TableHead>
                    <TableHead class="w-20">Disc. 2 %</TableHead>
                    <TableHead class="w-[110px]">Disc. Amount</TableHead>
                    <TableHead class="w-[110px]">Total Diskon</TableHead>
                    <TableHead class="w-[120px]">Total (DPP)</TableHead>
                    <TableHead class="w-[150px]">PPH</TableHead>
                    <TableHead class="w-[200px]">PPN</TableHead>
                    <TableHead class="w-[130px]">Grand Total</TableHead>
                    <TableHead class="w-[250px]">Catatan</TableHead>
                    <TableHead v-if="!isReadOnly" class="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="detailItems.length === 0">
                    <TableCell colspan="21" class="py-12">
                      <div
                        class="flex items-center justify-center text-muted-foreground"
                      >
                        <span v-if="detailItems.length === 0 && !isDataFromPB"
                          >Pilih No. PB untuk memuat items</span
                        >
                        <span v-else-if="loading">Memuat items...</span>
                        <span v-else>Tidak ada item tersedia</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow
                    v-else
                    v-for="(item, index) in detailItems"
                    :key="index"
                  >
                    <!-- No -->
                    <TableCell>{{ index + 1 }}</TableCell>

                    <!-- Kode -->
                    <TableCell>{{ item.kode_item || "-" }}</TableCell>

                    <!-- Nama Item -->
                    <TableCell>{{ item.nama_item || "-" }}</TableCell>

                    <!-- No. PB -->
                    <TableCell>{{ item.no_pb || "-" }}</TableCell>

                    <!-- No. PO -->
                    <TableCell>{{ item.no_po || "-" }}</TableCell>

                    <!-- Qty Diterima -->
                    <TableCell>{{ item.qty_diterima || 0 }}</TableCell>

                    <!-- Qty Retur -->
                    <TableCell>
                      <FieldNumber
                        :model-value="item.qty_retur ?? 0"
                        class="w-full"
                        :disabled="true"
                      />
                    </TableCell>

                    <!-- Qty PI -->
                    <TableCell>{{ item.qty_pi || 0 }}</TableCell>

                    <!-- Satuan -->
                    <TableCell>{{ item.satuan || "-" }}</TableCell>

                    <!-- Harga -->
                    <TableCell>
                      <FieldNumber
                        type="decimal"
                        :model-value="item.harga ?? 0"
                        class="w-full"
                        :disabled="true"
                      />
                    </TableCell>

                    <!-- Disc. 1% -->
                    <TableCell>
                      <FieldNumber
                        type="decimal"
                        :model-value="item.disc_1 ?? 0"
                        class="w-full"
                        :disabled="true"
                      />
                    </TableCell>

                    <!-- Disc. 2% -->
                    <TableCell>
                      <FieldNumber
                        type="decimal"
                        :model-value="item.disc_2 ?? 0"
                        class="w-full"
                        :disabled="true"
                      />
                    </TableCell>

                    <!-- Disc. Amount -->
                    <TableCell>
                      <FieldNumber
                        type="decimal"
                        :model-value="item.amt_disc ?? 0"
                        class="w-full"
                        :disabled="true"
                      />
                    </TableCell>

                    <!-- Total Diskon -->
                    <TableCell>
                      <span class="text-destructive font-medium">{{
                        formatCurrency(calculateLineDiscount(item))
                      }}</span>
                    </TableCell>

                    <!-- Subtotal (setelah diskon) -->
                    <TableCell>
                      <span class="font-semibold">{{
                        formatCurrency(calculateLineTotal(item))
                      }}</span>
                    </TableCell>

                    <!-- PPH Select -->
                    <TableCell>
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
                          {{ formatCurrency(calculateLineTotal(item) * Number(item.pph_percentage || '0') / 100) }}
                        </span>
                      </div>
                    </TableCell>

                    <!-- PPN Select -->
                    <TableCell>
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
                          {{ formatCurrency(calculateLinePpn(item)) }}
                        </span>
                      </div>
                    </TableCell>

                    <!-- Grand Total -->
                    <TableCell>
                      <span class="font-bold text-primary">{{
                        formatCurrency(calculateLineGrandTotal(item))
                      }}</span>
                    </TableCell>

                    <!-- Catatan -->
                    <TableCell>
                      <template v-if="!isReadOnly">
                        <FieldTextarea
                          :id="'catatan-' + index"
                          :value="item.catatan || ''"
                          @input="(v: string) => (item.catatan = v)"
                          placeholder="Catatan"
                          :disabled="loading"
                        />
                      </template>
                      <span v-else class="whitespace-pre-line">{{ item.catatan || "-" }}</span>
                    </TableCell>

                    <!-- Aksi -->
                    <TableCell v-if="!isReadOnly">
                      <DeleteButton
                        variant="ghost"
                        size="sm"
                        @click="detailItems.splice(index, 1)"
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <!-- Summary Section - 2 Column Layout -->
          <div class="mt-8">
            <!-- Perbandingan Kurs -->
            <div class="bg-card rounded-lg p-4 border shadow-sm mb-6">
              <div class="flex items-center justify-between mb-3">
                <h3
                  class="text-xs font-semibold text-primary uppercase tracking-wider"
                >
                  Perbandingan Kurs
                </h3>
                <!-- Tombol Refresh Currency - Hanya untuk mode Edit -->
                <Button
                  v-if="isEditMode && values.m_currency_id && !isCurrencyRupiah"
                  type="button"
                  variant="outline"
                  size="sm"
                  @click="handleRefreshCurrency"
                  :disabled="isRefreshingCurrency || loading"
                  class="gap-2"
                >
                  <RefreshCw
                    :class="[
                      'h-3.5 w-3.5',
                      isRefreshingCurrency ? 'animate-spin' : '',
                    ]"
                  />
                  <span class="text-xs">{{
                    isRefreshingCurrency ? "Syncing..." : "Sync Currency"
                  }}</span>
                </Button>
              </div>
              <div class="grid grid-cols-2 gap-6">
                <div>
                  <p class="text-muted-foreground text-xs mb-1">
                    Kurs PI (Aktif)
                  </p>
                  <p class="font-bold text-primary text-xl">
                    {{
                      exchangeRateDisplay.toLocaleString("id-ID", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })
                    }}
                  </p>
                  <p class="text-xs text-muted-foreground">Rp / Unit</p>
                  <p
                    v-if="!isCurrencyFromSavedPI"
                    class="text-xs text-green-600 dark:text-green-400 mt-1"
                  >
                    ✓ Synced
                  </p>
                  <p
                    v-else
                    class="text-xs text-amber-600 dark:text-amber-400 mt-1"
                  >
                    • Saved Rate
                  </p>
                </div>
                <div>
                  <p class="text-muted-foreground text-xs mb-1">Kurs PO</p>
                  <p class="font-bold text-xl">
                    {{
                      kursPO.toLocaleString("id-ID", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })
                    }}
                  </p>
                  <p class="text-xs text-muted-foreground">Rp / Unit</p>
                </div>
              </div>
            </div>

            <!-- Summary Grid: 2 Columns -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- COLUMN 1: Nilai dalam Currency Asing (jika bukan IDR) -->
              <div
                v-if="values.m_currency_id && !isCurrencyRupiah"
                class="space-y-1 rounded-lg border bg-muted/40 p-4 text-sm"
              >
                <div class="pb-2 mb-2 border-b font-semibold text-foreground">
                  {{ currencySymbol }} {{ currencyCode }}
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">Total Diskon</span>
                  <span class="font-semibold text-destructive">{{
                    totalDiskon.toLocaleString("id-ID", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  }}</span>
                </div>
                <div class="h-px bg-border my-1"></div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground"
                    >DPP
                    <span
                      v-if="effectivePpnPercentage !== '0'"
                      class="text-xs"
                      >(tagihan/1+Tarif pajak >=
                      {{ (subtotal - totalDiskon).toLocaleString("id-ID") }}/{{
                        1 + Number(effectivePpnPercentage || "0") / 100
                      }})</span
                    ></span
                  >
                  <span class="font-semibold">{{
                    total.toLocaleString("id-ID", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground"
                    >DPP Nilai Lain
                    <span class="text-xs">(DPP × 11/12)</span></span
                  >
                  <span class="font-semibold text-blue-600">{{
                    dppLainnyaValue.toLocaleString("id-ID", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  }}</span>
                </div>
                <div class="h-px bg-border my-1"></div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">Total PPN</span>
                  <span class="font-semibold">{{
                    totalPpn.toLocaleString("id-ID", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">Total PPH</span>
                  <span class="font-semibold">{{
                    totalPph.toLocaleString("id-ID", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  }}</span>
                </div>
                <div class="h-px bg-border my-1"></div>
                <div class="flex items-center justify-between">
                  <span class="font-semibold">Grand Total</span>
                  <span class="text-base font-bold text-primary">{{
                    grandTotal.toLocaleString("id-ID", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  }}</span>
                </div>
              </div>

              <!-- COLUMN 2: Nilai dalam Rupiah (Kurs PO) -->
              <div class="space-y-1 rounded-lg border bg-muted/40 p-4 text-sm">
                <div class="pb-2 mb-2 border-b font-semibold text-foreground">
                  IDR (Rupiah) - Kurs PO
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground">Total Diskon</span>
                  <span class="font-semibold text-destructive">{{
                    totalDiskonInRupiah.toLocaleString("id-ID")
                  }}</span>
                </div>
                <div class="h-px bg-border my-1"></div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground"
                    >DPP
                    <span
                      v-if="effectivePpnPercentage !== '0'"
                      class="text-xs"
                      >(tagihan/1+Tarif pajak >=
                      {{
                        ((subtotal - totalDiskon) * kursPO).toLocaleString(
                          "id-ID",
                        )
                      }}/{{ 1 + Number(effectivePpnPercentage || "0") / 100 }})</span
                    ></span
                  >
                  <span class="font-semibold">{{
                    totalInRupiah.toLocaleString("id-ID")
                  }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground"
                    >DPP Nilai Lain
                    <span class="text-xs">(DPP × 11/12)</span></span
                  >
                  <span class="font-semibold text-blue-600">{{
                    (
                      dppLainnyaValue * (kursPO || exchangeRateDisplay || 1)
                    ).toLocaleString("id-ID", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  }}</span>
                </div>
                <div class="h-px bg-border my-1"></div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground"
                    >PPN {{ effectivePpnPercentage }}%</span
                  >
                  <span class="font-semibold">{{
                    totalPpnInRupiah.toLocaleString("id-ID")
                  }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-muted-foreground"
                    >PPH {{ effectivePphPercentage }}%</span
                  >
                  <span class="font-semibold">{{
                    totalPphInRupiah.toLocaleString("id-ID")
                  }}</span>
                </div>
                <div class="h-px bg-border my-1"></div>
                <div class="flex items-center justify-between">
                  <span class="font-semibold">Grand Total</span>
                  <span class="text-base font-bold text-primary">{{
                    grandTotalInRupiah.toLocaleString("id-ID")
                  }}</span>
                </div>
              </div>
            </div>

            <!-- BREAKDOWN PERHITUNGAN - Comparison Kurs PO vs Kurs PI -->
            <div
              v-if="values.m_currency_id && !isCurrencyRupiah"
              class="mt-6 border-t pt-6"
            >
              <button
                @click="showBreakdownKurs = !showBreakdownKurs"
                class="flex items-center justify-between w-full text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <span class="flex items-center gap-2">
                  <span class="text-xs uppercase tracking-wider"
                    >Breakdown Perhitungan - Perbandingan Kurs</span
                  >
                </span>
                <span
                  :class="showBreakdownKurs ? 'rotate-180' : ''"
                  class="transition-transform"
                  >▼</span
                >
              </button>

              <div v-if="showBreakdownKurs" class="space-y-6">
                <!-- Comparison Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <!-- Kurs PO Breakdown -->
                  <div class="space-y-3 p-4 rounded-lg border bg-card">
                    <h4
                      class="text-xs font-semibold text-primary uppercase tracking-wider mb-3"
                    >
                      {{ currencySymbol }} {{ currencyCode }} - Kurs PO ({{
                        kursPO.toLocaleString("id-ID")
                      }})
                    </h4>

                    <div class="space-y-2 text-sm">
                      <div class="flex justify-between items-start">
                        <span class="text-muted-foreground"
                          >Subtotal (Qty PI × Harga):</span
                        >
                        <span class="font-mono text-xs">{{
                          subtotal.toLocaleString("id-ID", {
                            minimumFractionDigits: 2,
                          })
                        }}</span>
                      </div>

                      <div
                        class="pl-4 space-y-1 border-l-2 border-destructive/30"
                      >
                        <div class="flex justify-between items-center text-xs">
                          <span class="text-muted-foreground">Diskon 1%:</span>
                          <span class="font-mono text-destructive">{{
                            detailItems
                              .reduce(
                                (sum, item) =>
                                  sum +
                                  ((item.qty_pi || 0) *
                                    (item.harga || 0) *
                                    (item.disc_1 || 0)) /
                                    100,
                                0,
                              )
                              .toLocaleString("id-ID", {
                                minimumFractionDigits: 2,
                              })
                          }}</span>
                        </div>
                        <div class="flex justify-between items-center text-xs">
                          <span class="text-muted-foreground">Diskon 2%:</span>
                          <span class="font-mono text-destructive">{{
                            detailItems
                              .reduce((sum, item) => {
                                const line =
                                  (item.qty_pi || 0) * (item.harga || 0);
                                const discAmount1 =
                                  line * ((item.disc_1 || 0) / 100);
                                const afterDisc1 = line - discAmount1;
                                return (
                                  sum + afterDisc1 * ((item.disc_2 || 0) / 100)
                                );
                              }, 0)
                              .toLocaleString("id-ID", {
                                minimumFractionDigits: 2,
                              })
                          }}</span>
                        </div>
                      </div>

                      <div
                        class="flex justify-between items-start pt-2 border-t"
                      >
                        <span class="text-muted-foreground font-semibold"
                          >Total Diskon:</span
                        >
                        <span class="font-mono text-destructive font-semibold"
                          >-{{
                            totalDiskon.toLocaleString("id-ID", {
                              minimumFractionDigits: 2,
                            })
                          }}</span
                        >
                      </div>

                      <div
                        class="flex justify-between items-start pt-2 border-t"
                      >
                        <span class="text-muted-foreground"
                          >Total DPP:</span
                        >
                        <span class="font-mono font-semibold">{{
                          total.toLocaleString("id-ID", {
                            minimumFractionDigits: 2,
                          })
                        }}</span>
                      </div>

                      <div class="space-y-1 pt-2">
                        <div class="flex justify-between items-center text-xs">
                          <span class="text-muted-foreground"
                            >PPN ({{ effectivePpnPercentage }}%):</span
                          >
                          <span class="font-mono"
                            >+{{
                              totalPpn.toLocaleString("id-ID", {
                                minimumFractionDigits: 2,
                              })
                            }}</span
                          >
                        </div>
                        <div class="flex justify-between items-center text-xs">
                          <span class="text-muted-foreground"
                            >PPH ({{ effectivePphPercentage }}%):</span
                          >
                          <span class="font-mono text-destructive"
                            >-{{
                              totalPph.toLocaleString("id-ID", {
                                minimumFractionDigits: 2,
                              })
                            }}</span
                          >
                        </div>
                      </div>

                      <div
                        class="flex justify-between items-start pt-3 border-t-2 border-primary/20"
                      >
                        <span class="font-semibold">Grand Total:</span>
                        <div class="text-right">
                          <div class="font-mono text-primary font-bold">
                            {{
                              grandTotal.toLocaleString("id-ID", {
                                minimumFractionDigits: 2,
                              })
                            }}
                          </div>
                          <div class="text-xs text-muted-foreground">
                            = Total DPP + PPN - PPH
                          </div>
                        </div>
                      </div>

                      <div
                        class="flex justify-between items-start pt-2 bg-primary/5 p-2 rounded"
                      >
                        <span class="font-semibold text-xs"
                          >Grand Total (IDR):</span
                        >
                        <span class="font-mono font-bold text-primary">{{
                          grandTotalInRupiah.toLocaleString("id-ID")
                        }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Kurs PI Breakdown -->
                  <div class="space-y-3 p-4 rounded-lg border bg-card">
                    <h4
                      class="text-xs font-semibold text-primary uppercase tracking-wider mb-3"
                    >
                      {{ currencySymbol }} {{ currencyCode }} - Kurs PI ({{
                        exchangeRateDisplay.toLocaleString("id-ID")
                      }})
                    </h4>

                    <div class="space-y-2 text-sm">
                      <div class="flex justify-between items-start">
                        <span class="text-muted-foreground"
                          >Subtotal (Qty PI × Harga):</span
                        >
                        <span class="font-mono text-xs">{{
                          subtotal.toLocaleString("id-ID", {
                            minimumFractionDigits: 2,
                          })
                        }}</span>
                      </div>

                      <div
                        class="pl-4 space-y-1 border-l-2 border-destructive/30"
                      >
                        <div class="flex justify-between items-center text-xs">
                          <span class="text-muted-foreground">Diskon 1%:</span>
                          <span class="font-mono text-destructive">{{
                            detailItems
                              .reduce(
                                (sum, item) =>
                                  sum +
                                  ((item.qty_pi || 0) *
                                    (item.harga || 0) *
                                    (item.disc_1 || 0)) /
                                    100,
                                0,
                              )
                              .toLocaleString("id-ID", {
                                minimumFractionDigits: 2,
                              })
                          }}</span>
                        </div>
                        <div class="flex justify-between items-center text-xs">
                          <span class="text-muted-foreground">Diskon 2%:</span>
                          <span class="font-mono text-destructive">{{
                            detailItems
                              .reduce((sum, item) => {
                                const line =
                                  (item.qty_pi || 0) * (item.harga || 0);
                                const discAmount1 =
                                  line * ((item.disc_1 || 0) / 100);
                                const afterDisc1 = line - discAmount1;
                                return (
                                  sum + afterDisc1 * ((item.disc_2 || 0) / 100)
                                );
                              }, 0)
                              .toLocaleString("id-ID", {
                                minimumFractionDigits: 2,
                              })
                          }}</span>
                        </div>
                      </div>

                      <div
                        class="flex justify-between items-start pt-2 border-t"
                      >
                        <span class="text-muted-foreground font-semibold"
                          >Total Diskon:</span
                        >
                        <span class="font-mono text-destructive font-semibold"
                          >-{{
                            totalDiskon.toLocaleString("id-ID", {
                              minimumFractionDigits: 2,
                            })
                          }}</span
                        >
                      </div>

                      <div
                        class="flex justify-between items-start pt-2 border-t"
                      >
                        <span class="text-muted-foreground"
                          >Total DPP:</span
                        >
                        <span class="font-mono font-semibold">{{
                          total.toLocaleString("id-ID", {
                            minimumFractionDigits: 2,
                          })
                        }}</span>
                      </div>

                      <div class="space-y-1 pt-2">
                        <div class="flex justify-between items-center text-xs">
                          <span class="text-muted-foreground"
                            >PPN ({{ effectivePpnPercentage }}%):</span
                          >
                          <span class="font-mono"
                            >+{{
                              totalPpn.toLocaleString("id-ID", {
                                minimumFractionDigits: 2,
                              })
                            }}</span
                          >
                        </div>
                        <div class="flex justify-between items-center text-xs">
                          <span class="text-muted-foreground"
                            >PPH ({{ effectivePphPercentage }}%):</span
                          >
                          <span class="font-mono text-destructive"
                            >-{{
                              totalPph.toLocaleString("id-ID", {
                                minimumFractionDigits: 2,
                              })
                            }}</span
                          >
                        </div>
                      </div>

                      <div
                        class="flex justify-between items-start pt-3 border-t-2 border-primary/20"
                      >
                        <span class="font-semibold">Grand Total:</span>
                        <div class="text-right">
                          <div class="font-mono text-primary font-bold">
                            {{
                              grandTotal.toLocaleString("id-ID", {
                                minimumFractionDigits: 2,
                              })
                            }}
                          </div>
                          <div class="text-xs text-muted-foreground">
                            = Subtotal + PPN - PPH
                          </div>
                        </div>
                      </div>

                      <div
                        class="flex justify-between items-start pt-2 bg-primary/5 p-2 rounded"
                      >
                        <span class="font-semibold text-xs"
                          >Grand Total (IDR):</span
                        >
                        <span class="font-mono font-bold text-primary">{{
                          totalPIKursSekarang.toLocaleString("id-ID")
                        }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Selisih Grand Total & Selisih Rate -->
                <div class="p-4 rounded-lg border bg-card space-y-2">
                  <!-- Selisih Grand Total dalam IDR -->
                  <div>
                    <div class="flex justify-between items-center">
                      <span class="font-semibold"
                        >Selisih Grand Total PI vs PO (IDR):</span
                      >
                      <span
                        :class="
                          selisihKursPIvsPO >= 0
                            ? 'text-2xl font-bold text-green-600 dark:text-green-400'
                            : 'text-2xl font-bold text-red-600 dark:text-red-400'
                        "
                      >
                        {{ selisihKursPIvsPO >= 0 ? "+" : ""
                        }}{{ formatRupiah(selisihKursPIvsPO) }}
                      </span>
                    </div>
                    <div class="text-xs text-muted-foreground mt-1">
                      ({{ totalPIKursSekarang.toLocaleString("id-ID") }} -
                      {{ grandTotalInRupiah.toLocaleString("id-ID") }})
                    </div>
                  </div>

                  <div class="h-px bg-border"></div>

                  <!-- Selisih Kurs PI dan PO (Rate per Unit) -->
                  <div class="flex justify-between items-center">
                    <span class="font-semibold"
                      >Selisih Kurs PI dan PO (Rate):</span
                    >
                    <span
                      :class="
                        selisihRatePIvsPO >= 0
                          ? 'text-lg font-semibold text-green-600 dark:text-green-400'
                          : 'text-lg font-semibold text-red-600 dark:text-red-400'
                      "
                    >
                      {{
                        selisihRatePIvsPO.toLocaleString("id-ID", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      }}
                    </span>
                  </div>
                  <div class="text-xs text-muted-foreground">
                    ({{
                      exchangeRateDisplay.toLocaleString("id-ID", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    }}
                    -
                    {{
                      kursPO.toLocaleString("id-ID", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    }}) Rp / Unit
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

    <!-- ================================================================ -->
    <!-- SUPER ADMIN CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <Dialog
      :open="isSuperAdminDialogOpen"
      @update:open="isSuperAdminDialogOpen = $event"
    >
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <span class="text-yellow-600">⚠️</span>
            Konfirmasi Super Admin
          </DialogTitle>
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

          <div class="space-y-2 text-sm text-muted-foreground">
            <p>Informasi:</p>
            <ul class="list-disc list-inside space-y-1 ml-2">
              <li>
                Status akan langsung
                <span class="font-semibold text-green-600">APPROVED</span>
              </li>
              <li>Tidak perlu menunggu approval dari atasan</li>
              <li>Data dapat langsung digunakan untuk proses selanjutnya</li>
            </ul>
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
</style>
