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
import {
  FieldX,
  FieldNumber,
  FieldSelect,
  FieldDate,
  FieldTextarea,
  FieldUpload,
} from "@/components/field";
import { DeleteButton } from "@/components/button";
import { ArrowLeft, Save, Loader2, Plus } from "lucide-vue-next";
import { useAuthStore } from "@/stores/auth";
import { useApi } from "@/composables/useApi";
import {
  createSupplierQuotation,
  updateSupplierQuotation,
  getSupplierQuotationById,
  getSupplierQuotationList,
  type SupplierQuotationDetail,
} from "./service";
import AuditInfo from '@/components/AuditInfo.vue'
import { getRfqById, getRfqListForSupplierQuotation } from "../t_rfq/service";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  ChevronDown,
  Check,
  Search as SearchIcon,
  X,
} from "lucide-vue-next";

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
const isInitialLoad = ref(true);
const isEditMode = computed(
  () => !!route.params.id && route.name === "SupplierQuotationForm",
);
const isViewMode = computed(() => route.name === "SupplierQuotationView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);
const DEFAULT_NON_PPN_ID = "dc697972-3785-4f50-98ff-dfa6a1f9d6fa";
const DEFAULT_CURRENCY_ID = "78d1dba6-f299-42bb-8caf-4e68d657fad8";

// ============================================================================
// SUPER ADMIN CHECK (mengikuti konsep yang konsisten)
// ============================================================================
const isSuperAdmin = computed(() => {
  const user = authStore.user;
  if (!user || !user.tipe) return false;
  return user.tipe.value1?.toUpperCase() === "SUPER ADMIN";
});

// ============================================================================
// UNIT BISNIS — Company display untuk non-Super Admin (dari SelectRespo)
// ============================================================================
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
  if (isViewMode.value) return "Detail Supplier Quotation";
  if (isCopyMode.value) return "Salin Supplier Quotation";
  if (isEditMode.value) return "Edit Supplier Quotation";
  return "Supplier Quotation";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Supplier Quotation";
  if (isCopyMode.value)
    return "Buat Supplier Quotation baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Supplier Quotation";
  return "Buat data Supplier Quotation baru";
});

// ============================================================================
// FORM VALUES
// ============================================================================
const values = reactive<any>({
  m_unit_bisnis_id: "",
  t_rfq_id: "",
  m_currency_id: DEFAULT_CURRENCY_ID,
  ppn_type: DEFAULT_NON_PPN_ID,
  m_supplier_id: "",
  ppn: 0,
  no_supplier_quotation: "",
  lampiran: "",
  catatan: "",
  // UI ONLY
  tgl_quotation: new Date().toISOString().split("T")[0],
});

// Validation state
const errors = reactive<Record<string, string>>({});

// Audit info
const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

// Detail arrays
const detailArr = ref<SupplierQuotationDetail[]>([]);
// RFQ Suppliers list
const rfqSuppliers = ref<any[]>([]);
const rawRfqDetails = ref<any[]>([]);
const selectedRfqNo = ref("");

// RFQ Selection Modal State
const isRfqSelectorOpen = ref(false);
const rfqSearch = ref("");
const rfqList = ref<any[]>([]);
const rfqLoading = ref(false);
const expandedRfqs = ref<Set<string>>(new Set());
const skipNextRfqDetailFetch = ref(false);

// Currency
const selectedCurrencyData = ref<any>(null);

const activeCurrencyDetailId = computed(() => {
  if (
    selectedCurrencyData.value &&
    selectedCurrencyData.value.m_currency_ds &&
    selectedCurrencyData.value.m_currency_ds.length > 0
  ) {
    const activeDetail = selectedCurrencyData.value.m_currency_ds.find(
      (d: any) => d.is_active === true,
    );
    return (
      activeDetail?.id ||
      selectedCurrencyData.value.m_currency_ds[0]?.id ||
      null
    );
  }
  return null;
});

const currencySelectOptions = computed(() => {
  if (!selectedCurrencyData.value) return [];
  return [
    {
      id: selectedCurrencyData.value.id,
      nama_currency:
        selectedCurrencyData.value.nama_currency ||
        selectedCurrencyData.value.money?.value1 ||
        "Indonesian Rupiah",
      kode_currency:
        selectedCurrencyData.value.kode_currency ||
        selectedCurrencyData.value.money?.value5 ||
        "IDR",
    },
  ];
});

// ============================================================================
// CURRENCY METHODS
// ============================================================================
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
        const activeRate = result.data.m_currency_ds?.find(
          (d: any) => d.is_active === true,
        );
        values.exchange_rate = activeRate ? Number(activeRate.rate) || 1 : 1;
      }
    }
  } catch (error) {
    console.error("Failed to fetch currency data:", error);
  }
};

watch(
  () => values.m_currency_id,
  (newCurrencyId, oldCurrencyId) => {
    if (!newCurrencyId) {
      selectedCurrencyData.value = null;
      return;
    }
    if (newCurrencyId !== oldCurrencyId) {
      fetchCurrencyData(newCurrencyId);
    }
  },
);

// ============================================================================
// RESET
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    m_unit_bisnis_id: "",
    t_rfq_id: "",
    m_currency_id: DEFAULT_CURRENCY_ID,
    ppn_type: DEFAULT_NON_PPN_ID,
    m_supplier_id: "",
    ppn: 0,
    no_supplier_quotation: "",
    lampiran: "",
    catatan: "",
    tgl_quotation: new Date().toISOString().split("T")[0],
  });
  detailArr.value = [];
  rfqSuppliers.value = [];
  selectedUnitBisnisCompanyName.value = "";
  Object.keys(errors).forEach((key) => delete errors[key]);
};

// ============================================================================
// RFQ METHODS
// ============================================================================
watch(
  () => values.t_rfq_id,
  async (newVal, oldVal) => {
    if (skipNextRfqDetailFetch.value) {
      skipNextRfqDetailFetch.value = false;
      return;
    }
    if (newVal && newVal !== oldVal && !loading.value && !isInitialLoad.value) {
      await loadRfqDetails(newVal);
    }
  },
);

watch(
  () => values.m_supplier_id,
  () => {
    if (!isInitialLoad.value) {
      populateDetails();
    }
  },
);

const applyRfqDetails = (rfq: any, preserveDetails = false) => {
  if (!rfq) return;

  rawRfqDetails.value = rfq.t_rfq_items_ds || rfq.t_rfq_items_d || [];
  selectedRfqNo.value = rfq.no_rfq || "";

  if (rfq.m_unit_bisnis_id) values.m_unit_bisnis_id = rfq.m_unit_bisnis_id;
  if (rfq.currency_id) values.m_currency_id = rfq.currency_id;

  const rfqSupplierDetails = rfq.t_rfq_supplier_ds || rfq.t_rfq_supplier_d || [];
  rfqSuppliers.value = rfqSupplierDetails
    .map((supplierDetail: any) => supplierDetail.m_supplier || supplierDetail.m_suppliers)
    .filter((supplier: any) => !!supplier)
    .map((supplier: any) => ({
      id: supplier.id,
      nama_supp: supplier.nama_supp || supplier.nama || "Unknown",
    }))
    .filter(
      (supplier: any, index: number, suppliers: any[]) =>
        suppliers.findIndex((item) => item.id === supplier.id) === index,
    );

  if (
    values.m_supplier_id &&
    !rfqSuppliers.value.some((supplier) => supplier.id === values.m_supplier_id)
  ) {
    values.m_supplier_id = "";
  }

  if (rfqSuppliers.value.length === 1 && !values.m_supplier_id) {
    values.m_supplier_id = rfqSuppliers.value[0].id;
  }

  if (!preserveDetails) {
    populateDetails();
  }
};

const loadRfqDetails = async (rfqId: string, preserveDetails = false) => {
  if (loading.value && !preserveDetails) return;

  const toastId = !preserveDetails ? toast.loading("Memuat detail RFQ...") : undefined;
  try {
    const res = await getRfqById(rfqId);
    if (res.status === "success" && res.data) {
      applyRfqDetails(res.data, preserveDetails);
      if (toastId) toast.success("Detail RFQ berhasil dimuat", { id: toastId });
    }
  } catch (error) {
    console.error(error);
    if (toastId) toast.error("Gagal memuat detail RFQ", { id: toastId });
  }
};

const populateDetails = () => {
  if (!rawRfqDetails.value || rawRfqDetails.value.length === 0) {
    detailArr.value = [];
    return;
  }

  const selectedSupplierId = values.m_supplier_id;
  if (!selectedSupplierId) {
    detailArr.value = [];
    return;
  }

  detailArr.value = rawRfqDetails.value.map((d: any) => ({
    rfq_items_d_id: d.id,
    uom_id: d.uom_id,
    min_qty: d.qty || 0,
    price: 0,
    start_date: values.tgl_quotation,
    end_date: values.tgl_quotation,
    catatan: "",
    no_rfq: selectedRfqNo.value,
    kode_item: d.m_items?.kode_item || d.m_item?.kode_item || "-",
    nama_item: d.m_items?.nama_item || d.m_item?.nama_item || "-",
    uom_name: d.m_general?.value1 || "-",
  }));
};

const openRfqSelector = () => {
  if (isReadOnly.value) return;
  isRfqSelectorOpen.value = true;
  fetchRfqSelectionList();
};

const fetchRfqSelectionList = async () => {
  rfqLoading.value = true;
  try {
    const filter_column = {
      filter_column_status: "POST",
      filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id || undefined,
    };
    const res = await getRfqListForSupplierQuotation(
      1,
      20,
      "createdAt",
      "DESC",
      rfqSearch.value,
      "no_rfq",
      filter_column,
    );
    if (res.status === "success") {
      rfqList.value = res.data;
    }
  } catch (e) {
    console.error(e);
    toast.error("Gagal memuat list RFQ");
  } finally {
    rfqLoading.value = false;
  }
};

const toggleRfqExpand = (id: string) => {
  if (expandedRfqs.value.has(id)) {
    expandedRfqs.value.delete(id);
  } else {
    expandedRfqs.value.add(id);
  }
};

const selectRfq = (rfq: any) => {
  skipNextRfqDetailFetch.value = true;
  values.m_supplier_id = "";
  values.t_rfq_id = rfq.id;
  applyRfqDetails(rfq);
  isRfqSelectorOpen.value = false;
};

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================
onBeforeMount(async () => {
  onReset();

  // Non-Super Admin: set Unit Bisnis otomatis dari company akun login
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

  if (isEditMode.value || isViewMode.value || isCopyModeLocal) {
    loading.value = true;
    try {
      const res = await getSupplierQuotationById(sourceId);
      if (res.status === "success") {
        const data = res.data;

        auditMeta.value = {
          created_by: data.created_by || data.createdBy || null,
          createdAt: data.createdAt || null,
          updated_by: data.updated_by || data.update_by || data.edited_by || null,
          updatedAt: data.updatedAt || null,
        };

        // Check if trying to edit a POST item - redirect to view
        if (isEditMode.value && data.status === "POST") {
          toast.error("Tidak dapat mengedit", {
            description:
              "Data yang sudah POST tidak bisa diedit. Membuka halaman view...",
          });
          setTimeout(
            () =>
              router.replace(
                `/purchasing/transaksi/t_supplier_quotation/view/${menuId.value}`,
              ),
            1500,
          );
          return;
        }

        const fmtDate = (d: any) => (d ? String(d).split(/[T ]/)[0] : "");

        Object.assign(values, {
          m_unit_bisnis_id: data.m_unit_bisnis_id,
          t_rfq_id: data.t_rfq_id,
          m_currency_id: data.m_currency_id,
          ppn_type: data.ppn_type,
          m_supplier_id: data.m_supplier_id,
          ppn: data.ppn || 0,
          no_supplier_quotation: isCopyModeLocal ? "" : data.no_supplier_quotation,
          lampiran: data.lampiran,
          catatan: data.catatan,
          tgl_quotation: fmtDate(data.createdAt || new Date().toISOString()),
          status: isCopyModeLocal ? "DRAFT" : data.status || "DRAFT",
        });

        // Super Admin: ambil nama company dari Unit Bisnis yang tersimpan
        if (isSuperAdmin.value && values.m_unit_bisnis_id) {
          fetchUnitBisnisCompanyName(values.m_unit_bisnis_id);
        }

        // Load RFQ details
        if (data.t_rfq_id) {
          selectedRfqNo.value = data.t_rfq?.no_rfq || "";
          try {
            await loadRfqDetails(data.t_rfq_id, true);
          } catch (e) {
            console.warn("Failed to load RFQ details for edit mode:", e);
          }
        }

        // Ensure supplier exists in rfqSuppliers list
        if (data.m_supplier) {
          const supplierData = {
            id: data.m_supplier_id,
            nama_supp: data.m_supplier.nama_supp || data.m_supplier.nama || "Unknown Supplier",
          };
          const existing = rfqSuppliers.value.find((s) => s.id === data.m_supplier_id);
          if (!existing) {
            rfqSuppliers.value.push(supplierData);
          }
        }

        // Map details
        let details: any[] = [];
        if (Array.isArray(data.t_supplier_quotation_ds)) {
          details = data.t_supplier_quotation_ds;
        } else if (data.t_supplier_quotation_ds) {
          details = [data.t_supplier_quotation_ds];
        }

        if (details.length > 0) {
          detailArr.value = details.map((d: any) => ({
            id: isCopyModeLocal ? undefined : d.id,
            t_supplier_quotation_id: d.t_supplier_quotation_id,
            rfq_items_d_id: d.rfq_items_d_id || d.rfq_d_id,
            uom_id: d.uom_id,
            start_date: fmtDate(d.start_date || d.tgl_mulai),
            end_date: fmtDate(d.end_date || d.tgl_akhir),
            min_qty: Number(d.min_qty) || 0,
            price: Number(d.price) || 0,
            catatan: d.catatan || "",
            no_rfq: data.t_rfq?.no_rfq || selectedRfqNo.value,
            kode_item:
              d.t_rfq_items_d?.m_item?.kode_item ||
              d.t_rfq_items_d?.m_items?.kode_item ||
              d.kode_item ||
              "-",
            nama_item:
              d.t_rfq_items_d?.m_item?.nama_item ||
              d.t_rfq_items_d?.m_items?.nama_item ||
              d.nama_item ||
              "-",
            uom_name: d.t_rfq_items_d?.m_general?.value1 || d.uom_name || "-",
          }));
        }
      }
    } catch (e) {
      toast.error("Gagal memuat data");
      router.push("/purchasing/transaksi/t_supplier_quotation");
    } finally {
      loading.value = false;
      isInitialLoad.value = false;
    }
  } else {
    await fetchDefaultIDRCurrency();
    isInitialLoad.value = false;
  }
});

// ============================================================================
// SAVE
// ============================================================================
const onSave = async () => {
  let isValid = true;
  if (!values.t_rfq_id) {
    errors.t_rfq_id = "Wajib diisi";
    isValid = false;
  }
  if (!values.m_supplier_id) {
    errors.m_supplier_id = "Wajib diisi";
    isValid = false;
  }
  if (!values.ppn_type) {
    errors.ppn_type = "Wajib diisi";
    isValid = false;
  }

  if (!isValid) {
    toast.error("Gagal menyimpan", { description: "Mohon lengkapi field wajib *" });
    return;
  }

  if (detailArr.value.length === 0) {
    toast.error("Gagal menyimpan", { description: "Detail item tidak boleh kosong" });
    return;
  }

  const invalidDateItems = detailArr.value.filter((d) => {
    if (!d.start_date || !d.end_date) return false;

    const startDate = new Date(d.start_date).getTime();
    const endDate = new Date(d.end_date).getTime();

    return Number.isNaN(startDate) || Number.isNaN(endDate) || endDate < startDate;
  });
  if (invalidDateItems.length > 0) {
    toast.error("Tanggal tidak valid", {
      description: `${invalidDateItems.length} item memiliki End Date sebelum Start Date.`,
      duration: 5000,
    });
    return;
  }

  const invalidPriceItems = detailArr.value.filter(
    (d) => !d.price || Number(d.price) <= 0,
  );
  const invalidMinQtyItems = detailArr.value.filter(
    (d) => !d.min_qty || Number(d.min_qty) <= 0,
  );
  if (invalidMinQtyItems.length > 0) {
    toast.error("Minimum Qty tidak valid", {
      description: `${invalidMinQtyItems.length} item memiliki Minimum Qty kosong/0. Semua minimum qty harus lebih dari 0.`,
      duration: 5000,
    });
    return;
  }
  if (invalidPriceItems.length > 0) {
    toast.error("Harga tidak valid", {
      description: `${invalidPriceItems.length} item memiliki Harga = 0. Semua harga harus lebih dari 0.`,
      duration: 5000,
    });
    return;
  }

  loading.value = true;
  try {
    const payload = {
      ...values,
      t_supplier_quotation_ds: detailArr.value.map((d) => ({
        id: d.id,
        t_supplier_quotation_id:
          d.t_supplier_quotation_id ||
          (isEditMode.value ? menuId.value : undefined),
        rfq_items_d_id: d.rfq_items_d_id,
        uom_id: d.uom_id,
        start_date: d.start_date ? new Date(d.start_date).toISOString() : null,
        end_date: d.end_date ? new Date(d.end_date).toISOString() : null,
        min_qty: Number(d.min_qty),
        price: Number(d.price),
        catatan: d.catatan,
      })),
    };
    delete payload.tgl_quotation;

    if (isEditMode.value) {
      payload.updated_by = authStore.user?.id || null;
      await updateSupplierQuotation(menuId.value, payload);
      toast.success("Berhasil diperbarui");
    } else {
      payload.created_by = authStore.user?.id || null;
      payload.updated_by = authStore.user?.id || null;
      await createSupplierQuotation(payload);
      toast.success("Berhasil dibuat");
    }
    router.push("/purchasing/transaksi/t_supplier_quotation");
  } catch (e) {
    console.error(e);
    toast.error("Terjadi kesalahan saat menyimpan");
  } finally {
    loading.value = false;
  }
};

const handleCancel = () =>
  router.push("/purchasing/transaksi/t_supplier_quotation");
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
        <h1 class="text-2xl font-bold">{{ pageTitle }}</h1>
        <p class="text-sm text-muted-foreground">{{ pageDescription }}</p>
      </div>
    </div>

    <!-- ================================================================ -->
    <!-- FORM -->
    <!-- ================================================================ -->
    <form @submit.prevent="onSave" class="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Supplier Quotation</CardTitle>
          <CardDescription>Informasi umum quotation dari supplier</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">

          <!-- Baris 1: Unit Bisnis, (Company), Tanggal, No. SQ -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Super Admin: FieldSelect Unit Bisnis + Company readonly -->
            <template v-if="isSuperAdmin">
              <FieldSelect
                id="m_unit_bisnis_id"
                label="Unit Bisnis"
                v-model="values.m_unit_bisnis_id"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    searchfield: 'nama_comp',
                    filter_column_is_active: true,
                    no_pagination: 'true',
                    join: 'true',
                  },
                }"
                displayField="nama_comp"
                valueField="id"
                placeholder="Pilih unit bisnis"
                :clearable="true"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                @update:value-full="handleUnitBisnisSelected"
              />

              <!-- Company dari Unit Bisnis yang dipilih -->
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

            <!-- Tanggal -->
            <FieldDate
              label="Tanggal"
              v-model="values.tgl_quotation"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
            />

            <!-- No. Supplier Quotation -->
            <FieldX
              label="No. Supplier Quotation"
              v-model="values.no_supplier_quotation"
              placeholder="Auto Generated"
              :disabled="true"
              :readonly="true"
              hints="Nomor dibuat otomatis oleh sistem"
            />
          </div>

          <!-- Baris 2: No. RFQ, Supplier -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- No RFQ -->
            <div class="space-y-2">
              <label class="text-sm font-medium leading-none">
                No. RFQ <span class="text-red-500">*</span>
              </label>
              <div class="flex gap-2">
                <Input
                  :value="selectedRfqNo || 'Pilih RFQ'"
                  readonly
                  :class="['cursor-pointer flex-1', !selectedRfqNo && 'text-muted-foreground']"
                  @click="openRfqSelector"
                  :disabled="loading || isReadOnly"
                />
                <Button
                  type="button"
                  variant="outline"
                  @click="openRfqSelector"
                  :disabled="loading || isReadOnly"
                >
                  Pilih
                </Button>
              </div>
              <p v-if="errors.t_rfq_id" class="text-sm font-medium text-destructive">
                {{ errors.t_rfq_id }}
              </p>
            </div>

            <!-- Supplier -->
            <FieldSelect
              label="Supplier"
              v-model="values.m_supplier_id"
              :options="rfqSuppliers"
              displayField="nama_supp"
              valueField="id"
              :disabled="loading || isReadOnly || rfqSuppliers.length === 0"
              :readonly="isReadOnly"
              :required="!isReadOnly"
              :errorText="errors.m_supplier_id ? 'failed' : ''"
              :hints="errors.m_supplier_id || (rfqSuppliers.length === 0 ? 'Pilih RFQ terlebih dahulu' : 'Pilih supplier')"
            />
          </div>

          <!-- Baris 3: Tipe PPN, PPN %, Currency -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Tipe PPN -->
            <FieldSelect
              label="Tipe PPN"
              v-model="values.ppn_type"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: { searchfield: 'value1', filter_column_group: 'PPN' },
              }"
              displayField="value1"
              valueField="id"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :required="!isReadOnly"
              :errorText="errors.ppn_type ? 'failed' : ''"
              :hints="errors.ppn_type"
              @update:valueFull="(item: any) => (values.ppn = item?.value3 || 0)"
            />

            <!-- PPN % -->
            <FieldNumber
              label="PPN %"
              v-model="values.ppn"
              suffix="%"
              :disabled="true"
              :readonly="true"
              hints="Diisi otomatis dari Tipe PPN"
            />

            <!-- Currency -->
            <FieldSelect
              id="m_currency_id"
              label="Currency"
              v-model="values.m_currency_id"
              @input="(v: string) => (values.m_currency_id = v)"
              :options="currencySelectOptions"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_currency`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  searchfield: 'nama_currency',
                  selectfield: 'id,nama_currency,kode_currency',
                  include: 'm_currency_d,money',
                  filter_column_is_active: true,
                },
              }"
              placeholder="Pilih Mata Uang"
              displayField="nama_currency"
              valueField="id"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
            />
          </div>

          <!-- Baris 4: Lampiran, Catatan -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Lampiran -->
            <FieldUpload
              id="lampiran"
              label="Lampiran"
              :value="values.lampiran"
              @input="(v) => (values.lampiran = v)"
              :hints="'.jpg, .png, .pdf, max 5MB'"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              accept="image/*,.pdf"
              class="w-full"
            />

            <!-- Catatan -->
            <FieldTextarea
              label="Catatan"
              v-model="values.catatan"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Catatan tambahan"
              :rows="3"
            />
          </div>
        </CardContent>
      </Card>

      <!-- ================================================================ -->
      <!-- DETAIL CARD -->
      <!-- ================================================================ -->
      <Card>
        <CardHeader>
          <CardTitle>Supplier Quotation Detail</CardTitle>
          <CardDescription>Item yang ditawarkan supplier</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="rounded-md border overflow-x-auto w-full">
            <table class="w-full text-sm">
              <thead class="bg-muted/50">
                <tr>
                  <th class="p-2 text-left w-12">No</th>
                  <th class="p-2 text-left min-w-[150px]">No RFQ</th>
                  <th class="p-2 text-left min-w-[100px]">Kode</th>
                  <th class="p-2 text-left min-w-[150px]">Nama Item</th>
                  <th class="p-2 text-left min-w-[80px]">UoM</th>
                  <th class="p-2 text-left min-w-[180px]">Start Date</th>
                  <th class="p-2 text-left min-w-[180px]">End Date</th>
                  <th class="p-2 text-left min-w-[100px]">Min Qty</th>
                  <th class="p-2 text-left min-w-[120px]">Harga</th>
                  <th class="p-2 text-left min-w-[150px]">Catatan</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="detailArr.length === 0">
                  <td colspan="10" class="p-8 text-center text-muted-foreground">
                    <span v-if="!values.t_rfq_id">Pilih RFQ untuk memuat item.</span>
                    <span v-else-if="!values.m_supplier_id">Pilih Supplier untuk melihat item yang diminta.</span>
                    <span v-else>Tidak ada item untuk supplier ini dalam RFQ terpilih.</span>
                  </td>
                </tr>
                <tr
                  v-for="(item, idx) in detailArr"
                  :key="idx"
                  class="border-t hover:bg-muted/10"
                >
                  <td class="p-2 text-center">{{ idx + 1 }}</td>
                  <td class="p-2">
                    <span class="truncate">{{ item.no_rfq || "-" }}</span>
                  </td>
                  <td class="p-2 font-mono">{{ item.kode_item }}</td>
                  <td class="p-2">{{ item.nama_item }}</td>
                  <td class="p-2">{{ item.uom_name }}</td>
                  <td class="p-2">
                    <FieldDate
                      label=""
                      v-model="item.start_date"
                      :disabled="loading || isReadOnly"
                      :clearable="false"
                    />
                  </td>
                  <td class="p-2">
                    <FieldDate
                      label=""
                      v-model="item.end_date"
                      :disabled="loading || isReadOnly"
                      :clearable="false"
                    />
                  </td>
                  <td class="p-2">
                    <FieldNumber
                      v-model="item.min_qty"
                      :disabled="isReadOnly"
                      :min="1"
                    />
                  </td>
                  <td class="p-2">
                    <FieldNumber
                      v-model="item.price"
                      :disabled="isReadOnly"
                      :min="1"
                      :class="
                        !isReadOnly && (!item.price || item.price <= 0)
                          ? 'border-destructive ring-1 ring-destructive'
                          : ''
                      "
                    />
                    <p
                      v-if="!isReadOnly && (!item.price || item.price <= 0)"
                      class="text-xs text-destructive mt-0.5"
                    >
                      Wajib &gt; 0
                    </p>
                  </td>
                  <td class="p-2">
                    <FieldX
                      v-model="item.catatan"
                      :disabled="isReadOnly"
                      placeholder="Catatan"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
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
        <div class="mr-auto text-sm text-muted-foreground hidden sm:block" v-if="values.createdAt">
          Created at {{ new Date(values.createdAt).toLocaleString() }}
        </div>
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
          type="submit"
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
    <!-- RFQ SELECTOR DIALOG -->
    <!-- ================================================================ -->
    <Dialog :open="isRfqSelectorOpen" @update:open="isRfqSelectorOpen = $event">
      <DialogContent
        class="max-w-[95vw] w-full max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden"
      >
        <DialogHeader class="p-6 pb-2 shrink-0">
          <DialogTitle>Pilih No. RFQ</DialogTitle>
          <DialogDescription>Pilih RFQ untuk membuat quotation supplier</DialogDescription>

          <div class="relative mt-4">
            <SearchIcon class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              v-model="rfqSearch"
              placeholder="Cari No RFQ..."
              class="pl-9 pr-24"
              @keyup.enter="fetchRfqSelectionList"
            />
            <Button
              v-if="rfqSearch"
              type="button"
              size="icon"
              variant="ghost"
              class="absolute right-14 top-1 h-7 w-7 text-muted-foreground hover:text-white"
              @click="rfqSearch = ''; fetchRfqSelectionList()"
            >
              <X class="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              class="absolute right-1 top-1 h-7"
              @click="fetchRfqSelectionList"
            >
              Cari
            </Button>
          </div>
        </DialogHeader>

        <div class="flex-1 overflow-y-auto p-6 pt-2">
          <div v-if="rfqLoading" class="flex justify-center py-8">
            <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
          </div>

          <div
            v-else-if="rfqList.length === 0"
            class="text-center py-8 text-muted-foreground"
          >
            Tidak ada data RFQ ditemukan
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="rfq in rfqList"
              :key="rfq.id"
              class="border rounded-lg overflow-hidden transition-all"
              :class="{ 'border-primary bg-primary/5': values.t_rfq_id === rfq.id }"
            >
              <!-- Header Row -->
              <div
                class="flex items-center p-3 gap-3 hover:bg-muted/50 cursor-pointer select-none"
                @click="toggleRfqExpand(rfq.id)"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-6 w-6 shrink-0 p-0"
                  @click.stop="toggleRfqExpand(rfq.id)"
                >
                  <ChevronDown v-if="expandedRfqs.has(rfq.id)" class="h-4 w-4" />
                  <ChevronRight v-else class="h-4 w-4" />
                </Button>

                <div class="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div class="font-medium">{{ rfq.no_rfq }}</div>
                  <div class="text-sm text-muted-foreground md:text-center">
                    {{ rfq.m_unit_bisni?.nama_comp || "-" }}
                  </div>
                  <div class="text-sm text-muted-foreground md:text-right">
                    {{ new Date(rfq.createdAt).toLocaleDateString("id-ID") }}
                  </div>
                </div>

                <Button
                  size="sm"
                  :variant="values.t_rfq_id === rfq.id ? 'default' : 'outline'"
                  @click.stop="selectRfq(rfq)"
                >
                  {{ values.t_rfq_id === rfq.id ? "Terpilih" : "Pilih" }}
                </Button>
              </div>

              <!-- Expanded Items -->
              <div
                v-if="expandedRfqs.has(rfq.id)"
                class="border-t bg-muted/20 p-3 space-y-2 animate-in slide-in-from-top-2"
              >
                <div class="text-xs font-semibold text-muted-foreground mb-2">
                  Daftar Item:
                </div>
                <div class="grid gap-1">
                  <div
                    v-for="item in rfq.t_rfq_items_ds || rfq.t_rfq_ds || []"
                    :key="item.id"
                    class="grid grid-cols-[1fr,auto] gap-2 text-sm bg-background border rounded px-3 py-2"
                  >
                    <div>
                      <span class="font-medium mr-2">{{
                        item.m_items?.kode_item || item.m_item?.kode_item
                      }}</span>
                      <span>{{
                        item.m_items?.nama_item || item.m_item?.nama_item
                      }}</span>
                    </div>
                    <div class="text-muted-foreground">
                      {{ item.qty || item.min_qty }}
                      {{ item.m_general?.value1 || item.uom_name }}
                    </div>
                  </div>
                  <div
                    v-if="!(rfq.t_rfq_items_ds?.length || rfq.t_rfq_ds?.length)"
                    class="text-xs text-muted-foreground italic"
                  >
                    Tidak ada item
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
table th {
  white-space: nowrap;
}
</style>
