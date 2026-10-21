<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed, watchEffect } from "vue";
import { useRouter, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  FieldTextarea,
  FieldDate,
  FieldSelect,
  FieldPopup,
  FieldRadio,
} from "@/components/field";
import { DeleteButton } from "@/components/button";
import { ArrowLeft, Save, Loader2 } from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createBiayaKirimSubcon,
  updateBiayaKirimSubcon,
  getBiayaKirimSubconById,
} from "./service";
import AuditInfo from '@/components/AuditInfo.vue'

// ============================================================================
// SETUP
// ============================================================================
const authStore = useAuthStore();
const currentUserId = computed(
  () => authStore.user?.id || authStore.user?.username || null
);
const { API_BASE_URL } = useApi();
const router = useRouter();
const route = useRoute();

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false);
const isEditMode = computed(
  () => !!route.params.id && route.name === "BiayaKirimSubconForm",
);
const isViewMode = computed(() => route.name === "BiayaKirimSubconView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);
const isSuperAdmin = computed(() => !!authStore.isSuperAdmin);
const companyNameDisplay = computed(() => {
  if (isSuperAdmin.value) return "-";
  try {
    const selectRespo = localStorage.getItem("SelectRespo");
    if (!selectRespo) return "-";
    const parsed = JSON.parse(selectRespo);
    return parsed.companyName || parsed.nama_comp || "-";
  } catch {
    return "-";
  }
});
const selectedPurchaseOrderId = ref<string | undefined>(undefined);
const detailSyncState = ref(
  new Map<
    string,
    {
      qty_po: number;
      qty_by_kirim: number;
    }
  >(),
);

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Biaya Kirim Subcon";
  if (isCopyMode.value) return "Salin Biaya Kirim Subcon";
  if (isEditMode.value) return "Edit Biaya Kirim Subcon";
  return "Tambah Biaya Kirim Subcon Baru";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Biaya Kirim Subcon";
  if (isCopyMode.value)
    return "Buat Biaya Kirim Subcon baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Biaya Kirim Subcon";
  return "Buat Biaya Kirim Subcon baru";
});

const getDefaultCompanyIdFromRespo = () => {
  if (isSuperAdmin.value) return "";
  try {
    const selectRespo = localStorage.getItem("SelectRespo");
    if (!selectRespo) return "";
    const parsed = JSON.parse(selectRespo);
    return parsed?.companyId || "";
  } catch {
    return "";
  }
};

// Form values - SAMA SEPERTI Form.txt
let values = reactive({
  tipe_transaksi: "SJ",
  m_unit_bisnis_id: "",
  m_supplier_id: "",
  tgl_biaya_kirim_subcon: new Date().toISOString().split("T")[0],
  no_biaya_kirim_subcon: "",
  t_sj_subcon_id: "",
  m_ekspedisi_id: "",
  m_coa_id: "",
  ppn_id: "",
  ppn_persen: 0,
  ppn_key1: "",
  pph_id: "",
  pph_persen: 0,
  harga_biaya_kirim: 0,
  total_berat: 0,
  catatan: "",
  status: "DRAFT",
  is_active: true,
});

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {};

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

// Detail arrays - DYNAMIC GENERATION
const detailArr = ref<any[]>([]);

// Round a number to 2 decimal places consistently
const round2 = (v: number) => {
  return Number(Number(v || 0).toFixed(2));
};

const initializeUnitBisnis = () => {
  if (isSuperAdmin.value) return;
  try {
    const selectRespo = localStorage.getItem("SelectRespo");
    if (!selectRespo) return;
    const parsed = JSON.parse(selectRespo);
    const unitBisnisId = parsed.companyId || parsed.m_unit_bisnis_id || "";
    if (unitBisnisId) {
      values.m_unit_bisnis_id = unitBisnisId;
    }
  } catch {
    // ignore parse error
  }
};

// ============================================================================
// DETAIL METHODS - DYNAMIC GENERATION
// ============================================================================

const addDetailArr = () => {
  detailArr.value.push({
    no_po: "",
    supplier: "",
    barang: "",
    qty_po: 0,
    qty_by_kirim: 0,
    unit: "",
    catatan: "",
  });
};

const handleSuratJalanSelect = (item: any) => {
  displayValues.suratJalan = item?.no_sj_subcon || "";
  values.m_ekspedisi_id = item?.m_ekspedisi_id || item?.m_ekspedisi?.id || "";
  displayValues.ekspedisi =
    item?.m_ekspedisi?.nama || item?.nama_ekspedisi || "";
  detailArr.value = [];
  if (!item) {
    displayValues.suratJalan = "";
    values.m_ekspedisi_id = "";
    displayValues.ekspedisi = "";
    return;
  }
  const bahanList = item.t_sj_subcon_ds || [];
  detailArr.value = bahanList.map((bahan: any) => {
    const qtyPo = Number(bahan.qty_po) || 0;
    const qtyByKirim = round2(Number(bahan.qty_sj) || qtyPo);

    return {
      t_sj_gudang_subcon_d_id: bahan.id,
      t_purchase_order_id:
        bahan.t_purchase_order_subcon?.id || bahan.t_purchase_order_id || null,
      t_purchase_order_bahan_id:
        bahan.t_purchase_order_subcon_bahan_id || bahan.id || null,
      m_items_id: bahan.m_items_id,
      barang: bahan.m_item?.nama_item || bahan.nama_item || "-",
      no_po: bahan.t_purchase_order_subcon?.no_po || "-",
      qty_po: qtyPo,
      qty_by_kirim: qtyByKirim,
      uom_id: bahan.uom_id || bahan.m_uom_id || null,
      unit: bahan.m_general?.value1 || "-",
      catatan: "",
    };
  });
  values.total_berat = round2(
    detailArr.value.reduce((sum, item) => sum + getQtyByKirim(item), 0),
  );
};

const getQtyByKirim = (detail: any) => {
  const qtyByKirim = Number(detail.qty_by_kirim) || 0;
  return round2(qtyByKirim);
};

const isIncludePpn = (overrides?: { ppn_key1?: string }) => {
  return (
    String(overrides?.ppn_key1 ?? values.ppn_key1 ?? "").toUpperCase() === "INC"
  );
};

const removeDetailArr = (index: number) => {
  detailArr.value.splice(index, 1);
  toast.info("Detail dihapus");
};

const getDetailKey = (detail: any, index: number) =>
  String(detail?.id || detail?.t_sj_gudang_subcon_d_id || index);

watchEffect(() => {
  detailArr.value.forEach((detail, index) => {
    const key = getDetailKey(detail, index);
    const qtyPo = Number(detail.qty_po) || 0;
    const qtyByKirim = Number(detail.qty_by_kirim) || 0;
    detail.qty_po = qtyPo;
    detail.qty_by_kirim = qtyByKirim;

    detailSyncState.value.set(key, {
      qty_po: qtyPo,
      qty_by_kirim: qtyByKirim,
    });
  });
});

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    tipe_transaksi: "SJ",
    m_unit_bisnis_id: "",
    m_supplier_id: "",
    tgl_biaya_kirim_subcon: new Date().toISOString().split("T")[0],
    no_biaya_kirim_subcon: "",
    m_ekspedisi_id: "",
    m_coa_id: "",
    ppn_id: "",
    ppn_persen: 0,
    pph_id: "",
    pph_persen: 0,
    harga_biaya_kirim: 0,
    total_berat: 0,
    catatan: "",
    status: "DRAFT",
    is_active: true,
  });

  // Non-super admin mengikuti company dari respo aktif
  const defaultCompanyId = getDefaultCompanyIdFromRespo();
  if (defaultCompanyId) {
    values.m_unit_bisnis_id = defaultCompanyId;
  }

  // Reset errors
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });

  // Reset detail arrays - DYNAMIC
  detailArr.value = [];

  // Reset popup display labels
  displayValues.supplier = "";
  displayValues.suratJalan = "";
  displayValues.ekspedisi = "";
  displayValues.coa = "";
  displayValues.company_name = "";
};

// ============================================================================
// LIFECYCLE HOOKS - LOAD DATA BEFORE MOUNT
// ============================================================================
onBeforeMount(async () => {
  onReset();
  initializeUnitBisnis();

  // Check if copy mode via query param
  const isCopyModeLocal = route.query.action === "copy" && route.query.source;
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value;

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return;
  }

  loading.value = true;
  try {
    const res = await getBiayaKirimSubconById(sourceId);

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
    if (initialValues.t_biaya_kirim_subcon_ds) {
      detailArr.value = initialValues.t_biaya_kirim_subcon_ds.map(
        (item: any) => {
          const { id, ...rest } = item; // buang id
          return {
            ...rest,
            barang: item.m_item?.nama_item || "-",
            no_po:
              item.t_sj_subcon_d?.t_purchase_order_subcon?.no_po ||
              item.t_purchase_order_subcon?.no_po ||
              "-",
            unit: item.m_general?.value1 || "-",
            t_purchase_order_id:
              item.t_purchase_order_id ||
              item.t_sj_subcon_d?.t_purchase_order_subcon?.id ||
              null,
            t_purchase_order_bahan_id:
              item.t_purchase_order_bahan_id ||
              item.t_sj_gudang_subcon_d_id ||
              item.t_sj_subcon_d?.id ||
              null,
            qty_by_kirim: Number(item.qty_by_kirim ?? item.qty_sj ?? 0),
            qty_po: Number(item.qty_po ?? 0),
          };
        },
      );
    }

    displayValues.ekspedisi =
      initialValues.m_ekspedisi?.nama ||
      initialValues.ekspedisi?.nama ||
      initialValues.nama_ekspedisi ||
      "";
    displayValues.supplier =
      initialValues.m_supplier?.nama_supp ||
      initialValues.supplier?.nama_supp ||
      initialValues.nama_supp ||
      "";
    displayValues.coa =
      initialValues.m_coa?.nama_coa ||
      initialValues.m_coa?.nama ||
      initialValues.nama_coa ||
      "";
    displayValues.suratJalan =
      initialValues.t_sj_subcon?.no_sj_subcon ||
      initialValues.no_sj_subcon ||
      "";
    displayValues.company_name = 
      initialValues.m_unit_bisnis?.m_company?.nama || 
      initialValues.m_unit_bisnis?.m_company?.name || 
      "";

    // Mode copy: hapus id dan timestamps agar jadi create baru
    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
      initialValues.status = "DRAFT";
    }
    initialValues.ppn_key1 = initialValues.bk_sc_ppn?.key1 || "";
    initialValues.ppn_persen = Number(initialValues.bk_sc_ppn?.value3) || 0;
    initialValues.pph_persen = Number(initialValues.bk_sc_pph?.value3) || 0;

    // Assign hanya key yang sudah ada di state reactive values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore dynamic assign
        values[key] = initialValues[key];
      }
    }

    if (isCopyModeLocal) {
      toast.success("Data berhasil disalin", {
        description: "Silakan edit dan simpan sebagai Biaya Kirim Subcon baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Biaya Kirim Subcon", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () => router.push("/purchasing/subcon/t_biaya_kirim_subcon"),
      },
    });
    setTimeout(
      () => router.push("/purchasing/subcon/t_biaya_kirim_subcon"),
      2000,
    );
  } finally {
    loading.value = false;
  }
});

// Errors object (manual validation) - SAMA SEPERTI Form.txt
const errors = reactive({
  tipe_transaksi: "",
  m_unit_bisnis_id: "",
  m_supplier_id: "",
  tgl_biaya_kirim_subcon: "",
  no_biaya_kirim_subcon: "",
  m_ekspedisi_id: "",
  m_coa_id: "",
  ppn_id: "",
  pph_id: "",
  harga_biaya_kirim: "",
  total_berat: "",
  catatan: "",
});

const displayValues = reactive({
  supplier: "",
  suratJalan: "",
  ekspedisi: "",
  coa: "",
  company_name: "",
});

const SJParams = computed(() => ({
  // default searchfield sesuai endpoint available SJ biaya kirim
  searchfield: "no_sj_subcon",
  ...(values.m_unit_bisnis_id?.trim()
    ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id.trim() }
    : {}),
  ...(values.m_supplier_id?.trim()
    ? { filter_column_m_supplier_id: values.m_supplier_id.trim() }
    : {}),
}));

const suratJalanColumns = [
  {
    field: "no_sj_subcon",
    headerName: "No. Surat Jalan",
    width: "150px",
  },
  {
    field: "alamat",
    headerName: "Alamat",
    width: "160px",
  },
  {
    field: "tgl_sj_subcon",
    headerName: "Tgl. Surat Jalan",
    width: "150px",
  },
  {
    field: "m_supplier.nama_supp",
    headerName: "Supplier",
    width: "160px",
  },
  {
    field: "m_gudang.nama_gudang",
    headerName: "Gudang",
    width: "160px",
  },
  {
    field: "pengirim_display",
    headerName: "Pengirim",
    width: "200px",
    renderHtml: (item: any) => {
      const isEkspedisi =
        item?.is_ekspedisi === true ||
        String(item?.is_ekspedisi).toLowerCase() === "true" ||
        Number(item?.is_ekspedisi) === 1;
      const ekspedisiName =
        item?.m_ekspedisi?.nama || item?.nama_ekspedisi || "-";
      const supirName = item?.supir || "-";
      const text = isEkspedisi ? ekspedisiName : supirName;
      return `<div>${text || "-"}</div>`;
    },
  },

];

const tipeTransaksiOptions = [
  // { value: "PENERIMAAN", label: "Penerimaan" },
  { value: "SJ", label: "Pengiriman" },
];

const totalDpp = computed(() => {
  const harga = Number(values.harga_biaya_kirim) || 0;
  return round2(harga);
});

const isPpnInclude = computed(
  () => (values.ppn_key1 || "").toUpperCase() === "INC",
);
const ppnTotal = computed(() => {
  const rate = Number(values.ppn_persen) || 0;
  if (!rate) return 0;
  const val = isPpnInclude.value
    ? (totalDpp.value * rate) / (100 + rate)
    : (totalDpp.value * rate) / 100;
  return round2(val);
});

const pphTotal = computed(() => {
  const pphRate = Number(values.pph_persen) || 0;
  if (!pphRate) return 0;

  const ppnRate = Number(values.ppn_persen) || 0;
  const baseAmount =
    isPpnInclude.value && ppnRate > 0
      ? totalDpp.value / (1 + ppnRate / 100)
      : totalDpp.value;
  return round2((baseAmount * pphRate) / 100);
});

const grandTotal = computed(() => {
  if (isPpnInclude.value) {
    return round2(totalDpp.value - pphTotal.value);
  }
  return round2(totalDpp.value + ppnTotal.value - pphTotal.value);
});

// ============================================================================
// SAVE HANDLER - SAMA SEPERTI Form.txt + DETAIL
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });
  let invalid = false;
  if (!values.tipe_transaksi?.trim()) {
    errors.tipe_transaksi = "Tipe wajib diisi";
    invalid = true;
  }
  if (!values.m_unit_bisnis_id?.trim()) {
    errors.m_unit_bisnis_id = "Unit Bisnis wajib diisi";
    invalid = true;
  }
  if (!values.m_supplier_id?.trim()) {
    errors.m_supplier_id = "Supplier wajib diisi";
    invalid = true;
  }
  if (!values.tgl_biaya_kirim_subcon?.trim()) {
    errors.tgl_biaya_kirim_subcon = "Tanggal wajib diisi";
    invalid = true;
  }
  if (!values.m_coa_id?.trim()) {
    errors.m_coa_id = "COA Biaya wajib diisi";
    invalid = true;
  }
  if (!Number(values.harga_biaya_kirim)) {
    errors.harga_biaya_kirim = "Harga biaya kirim tidak boleh 0";
    invalid = true;
  }
  if (invalid) {
    toast.error("Validasi gagal", {
      description: "Mohon lengkapi semua field yang wajib diisi",
    });
    return;
  }

  loading.value = true;
  try {
    // Clean payload: convert empty strings to null + TAMBAH DETAIL
    const payload: any = {
      tipe_transaksi: values.tipe_transaksi?.trim() || null,
      m_unit_bisnis_id: values.m_unit_bisnis_id?.trim() || null,
      t_sj_subcon_id: values.t_sj_subcon_id?.trim() || null,
      m_supplier_id: values.m_supplier_id?.trim() || null,
      tgl_biaya_kirim_subcon: values.tgl_biaya_kirim_subcon?.trim() || null,
      no_biaya_kirim_subcon: values.no_biaya_kirim_subcon?.trim() || null,
      m_ekspedisi_id: values.m_ekspedisi_id?.trim() || null,
      m_coa_id: values.m_coa_id?.trim() || null,
      ppn_id: values.ppn_id?.trim() || null,
      ppn_persen: Number(values.ppn_persen) || 0,
      ppn_key1: values.ppn_key1?.trim() || null,
      pph_id: values.pph_id?.trim() || null,
      pph_persen: Number(values.pph_persen) || 0,
      harga_biaya_kirim: Number(values.harga_biaya_kirim) || 0,
      total_berat: Number(values.total_berat) || 0,
      created_by: currentUserId.value || null,
      updated_by: currentUserId.value || null,
      catatan: values.catatan?.trim() || null,
      status: values.status || "DRAFT",
      is_active: values.is_active,
      // Detail fields - DYNAMIC
      t_biaya_kirim_subcon_ds: detailArr.value.map((item: any) => {
        const detailCreatedBy = item.created_by || currentUserId.value;
        return {
          id: item.id || undefined,
          t_penerimaan_barang_subcon_d_id:
            item.t_penerimaan_barang_subcon_d_id || null,
          t_sj_gudang_subcon_d_id: item.t_sj_gudang_subcon_d_id || null,
          t_purchase_order_id: item.t_purchase_order_id || null,
          t_purchase_order_bahan_id:
            item.t_purchase_order_bahan_id || null,
          created_by: detailCreatedBy || null,
          updated_by: currentUserId.value || null,
          m_items_id: item.m_items_id || null,
          qty_po: Number(item.qty_po) || 0,
          qty_by_kirim: Number(item.qty_by_kirim) || 0,
          uom_id: item.uom_id || null,
          catatan: item.catatan || null,
        };
      }),
      total_dpp: round2(totalDpp.value),
      total_ppn: round2(ppnTotal.value),
      total_pph: round2(pphTotal.value),
      grand_total: round2(grandTotal.value),
    };

    if (isEditMode.value) {
      await updateBiayaKirimSubcon(menuId.value, payload as any);
      toast.success("Biaya Kirim Subcon berhasil diperbarui", {
        description: `No. Biaya Kirim Subcon "${values.no_biaya_kirim_subcon}" telah diperbarui`,
      });
    } else {
      await createBiayaKirimSubcon(payload as any);
      toast.success("Biaya Kirim Subcon berhasil dibuat", {
        description: `No. Biaya Kirim Subcon "${values.no_biaya_kirim_subcon}" telah ditambahkan`,
      });
    }
    router.replace(
      "/purchasing/subcon/t_biaya_kirim_subcon?reload=" + Date.now(),
    );
  } catch (error) {
    toast.error(
      isEditMode.value
        ? "Gagal memperbarui Biaya Kirim Subcon"
        : "Gagal membuat Biaya Kirim Subcon",
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
  router.push("/purchasing/subcon/t_biaya_kirim_subcon");
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
          <CardTitle>Informasi Biaya Kirim Subcon</CardTitle>
          <CardDescription>
            Isi data BiayaKirimSubcon dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <FieldRadio
            id="tipe_transaksi"
            label=""
            v-model="values.tipe_transaksi"
            :options="tipeTransaksiOptions"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            direction="horizontal"
          />

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FieldSelect
              v-if="isSuperAdmin"
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              v-model="values.m_unit_bisnis_id"
              :errorText="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih unit bisnis"
              displayField="nama_comp"
              valueField="id"
              @update:valueFull="
                (item) => {
                  values.t_sj_subcon_id = '';
                  detailArr = [];
                  displayValues.company_name = item?.m_company?.nama || item?.m_company?.name || '';
                }
              "
              :api="{
                url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  searchfield: 'nama_comp,nama',
                  filter_column_is_active: true,
                  join: true,
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page
                    ? true
                    : false;
                  return response;
                },
              }"
            />
            <FieldX
              v-else
              id="m_unit_bisnis_display"
              label="Unit Bisnis"
              :value="companyNameDisplay"
              :disabled="true"
              :readonly="true"
              placeholder="Auto dari akun"
              hints="Unit bisnis dari respo yang dipilih"
            />

            <!-- Readonly Company -->
            <FieldX
              id="company_name_display"
              label="Company"
              :value="displayValues.company_name"
              :disabled="true"
              :readonly="true"
              placeholder="Pilih Unit Bisnis terlebih dahulu"
              class="w-full"
            />

            <!-- No. Biaya Kirim Subcon -->
            <FieldX
              id="no_biaya_kirim_subcon"
              label="No. Biaya Kirim Subcon"
              v-model="values.no_biaya_kirim_subcon"
              :errorname="errors.no_biaya_kirim_subcon ? 'failed' : ''"
              :hints="errors.no_biaya_kirim_subcon"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="!isReadOnly"
              placeholder="Auto generate sistem"
              class="w-full"
            />

            <FieldDate
              id="tgl_biaya_kirim_subcon"
              label="Tanggal Biaya Kirim Subcon"
              v-model="values.tgl_biaya_kirim_subcon"
              :errorname="errors.tgl_biaya_kirim_subcon ? 'failed' : ''"
              :hints="errors.tgl_biaya_kirim_subcon"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              class="w-full"
            />

            <FieldPopup
              id="m_supplier_id"
              label="Supplier"
              v-model="values.m_supplier_id"
              :displayValue="displayValues.supplier"
              :errorText="errors.m_supplier_id ? 'failed' : ''"
              :hints="errors.m_supplier_id"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :required="!isReadOnly"
              :clearable="!isReadOnly"
              placeholder="Pilih supplier"
              displayField="nama_supp"
              valueField="id"
              @update:valueFull="
                (item: any) => {
                  displayValues.supplier = item?.nama_supp || '';
                  values.m_ekspedisi_id = '';
                  displayValues.ekspedisi = '';
                  values.t_sj_subcon_id = '';
                  displayValues.suratJalan = '';
                  detailArr = [];
                }
              "
              :api="{
                url: `${API_BASE_URL}/dynamic/m_supplier`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  selectfield:
                    'id,nama_supp,alamat_supp,no_telp,top_id,is_tax,is_active,m_currency_id',
                  searchfield: 'nama_supp,alamat_supp,no_telp',
                  filter_column_is_active: true,
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
                { field: 'nama_supp', headerName: 'Nama Supplier', flex: 1 },
                { field: 'alamat_supp', headerName: 'Alamat', width: '250px' },
                { field: 'no_telp', headerName: 'No. Telp', width: '150px' },
              ]"
            />

            <FieldPopup
              id="surat_jalan_subcon"
              label="Surat Jalan Subcon"
              :required="!isReadOnly"
              v-model="values.t_sj_subcon_id"
              :displayValue="displayValues.suratJalan"
              :disabled="
                loading ||
                isReadOnly ||
                !values.m_unit_bisnis_id ||
                !values.m_supplier_id
              "
              :readonly="isReadOnly"
              placeholder="Pilih Surat Jalan Subcon"
              :hints="
                !values.m_unit_bisnis_id || !values.m_supplier_id
                  ? 'Pilih unit bisnis dan supplier terlebih dahulu'
                  : ''
              "
              displayField="no_sj_subcon"
              valueField="id"
              @update:valueFull="handleSuratJalanSelect"
              :api="{
                url: `${API_BASE_URL}/fn/t_sj_subcon/getSjAvailableForBiayaKirim`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: SJParams,
              }"
              :columns="suratJalanColumns"
            />

            <FieldPopup
              id="m_ekspedisi_id"
              label="Ekspedisi"
              v-model="values.m_ekspedisi_id"
              :displayValue="displayValues.ekspedisi"
              :errorText="errors.m_ekspedisi_id ? 'failed' : ''"
              :hints="errors.m_ekspedisi_id"
              :required="!isReadOnly"
              :disabled="true"
              :readonly="true"
              :clearable="false"
              placeholder="Auto dari Surat Jalan Subcon"
              displayField="nama"
              valueField="id"
              @update:valueFull="
                (item: any) => (displayValues.ekspedisi = item?.nama || '')
              "
              :api="{
                url: `${API_BASE_URL}/dynamic/m_ekspedisi`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'nama,kode_ekspedisi',
                  filter_column_is_active: true,
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
                  field: 'kode_ekspedisi',
                  headerName: 'Kode Ekspedisi',
                  width: '150px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'nama',
                  headerName: 'Nama Ekspedisi',
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
            />

            <FieldPopup
              id="m_coa_id"
              label="COA Biaya"
              v-model="values.m_coa_id"
              :displayValue="displayValues.coa"
              :errorText="errors.m_coa_id ? 'failed' : ''"
              :hints="errors.m_coa_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              placeholder="Pilih COA"
              displayField="nama"
              valueField="id"
              @update:valueFull="
                (item: any) =>
                  (displayValues.coa = item?.nama_coa || item?.nama || '')
              "
              :api="{
                url: `${API_BASE_URL}/dynamic/m_coa`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'kode,nama',
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page
                    ? true
                    : false;
                  return response;
                },
              }"
              :columns="[
                { field: 'kode', headerName: 'Kode', width: '120px' },
                { field: 'nama', headerName: 'Nama COA', flex: 1 },
              ]"
            />

            <div class="grid grid-cols-2 gap-3 items-end">
              <FieldSelect
                id="ppn_id"
                label="Tipe PPN"
                v-model="values.ppn_id"
                :errorText="errors.ppn_id ? 'failed' : ''"
                :hints="errors.ppn_id"
                :required="false"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="Pilih"
                displayField="value1"
                valueField="id"
                @update:valueFull="
                  (item: any) => {
                    values.ppn_persen = Number(item?.value3) || 0;
                    values.ppn_key1 = item?.key1 || '';
                  }
                "
                @update:modelValue="
                  (value: any) => {
                    if (!value) {
                      values.ppn_persen = 0;
                      values.ppn_key1 = '';
                    }
                  }
                "
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_general`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    searchfield: 'value1',
                    filter_column_group: 'PPN',
                    filter_column_is_active: true,
                  },
                  onsuccess: (response: any) => {
                    response.hasNext = response.pagination?.next_page
                      ? true
                      : false;
                    return response;
                  },
                }"
              />
              <FieldNumber
                id="ppn_persen"
                label=""
                v-model="values.ppn_persen"
                :disabled="true"
              />
            </div>

            <div class="grid grid-cols-2 gap-3 items-end">
              <FieldSelect
                id="pph_id"
                label="Tipe PPH"
                v-model="values.pph_id"
                :errorText="errors.pph_id ? 'failed' : ''"
                :hints="errors.pph_id"
                :required="false"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="Pilih"
                displayField="value1"
                valueField="id"
                @update:valueFull="
                  (item: any) => (values.pph_persen = Number(item?.value3) || 0)
                "
                @update:modelValue="
                  (value: any) => {
                    if (!value) {
                      values.pph_persen = 0;
                    }
                  }
                "
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_general`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    searchfield: 'value1',
                    filter_column_group: 'PPH',
                    filter_column_is_active: true,
                  },
                  onsuccess: (response: any) => {
                    response.hasNext = response.pagination?.next_page
                      ? true
                      : false;
                    return response;
                  },
                }"
              />
              <FieldNumber
                id="pph_persen"
                label=""
                v-model="values.pph_persen"
                :disabled="true"
              />
            </div>

            <FieldNumber
              id="total_berat"
              label="Total Berat (KG)"
              v-model="values.total_berat"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :min="0"
              class="w-full"
            />

            <FieldNumber
              id="harga_biaya_kirim"
              label="Harga Biaya Kirim"
              v-model="values.harga_biaya_kirim"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :min="0"
              class="w-full"
            />

            <FieldTextarea
              id="catatan"
              label="Catatan"
              v-model="values.catatan"
              :errorname="errors.catatan ? 'failed' : ''"
              :hints="errors.catatan"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Catatan"
              :rows="3"
              class=""
            />
          </div>
        </CardContent>
      </Card>

      <!-- DETAIL SECTION -->
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <div>
              <CardTitle>Biaya Kirim Subcon Detail</CardTitle>
              <CardDescription>Kelola detail biaya kirim</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div class="border rounded-lg max-w-full overflow-x-auto scrollbar-hide">
            <table class="w-full min-w-[1600px] text-sm">
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
                    No. PO
                  </th>
                  <th
                    class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                  >
                    Barang
                  </th>
                  <th
                    class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                  >
                    Qty PO
                  </th>
                  <th
                    class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                  >
                    Qty By Kirim
                  </th>
                  <th
                    class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                  >
                    Unit
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
                    :colspan="isReadOnly ? 7 : 8"
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
                  <td class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                    {{ idx + 1 }}
                  </td>
                  <td class="px-3 py-2 text-xs sm:text-sm">
                    {{ detail.no_po }}
                  </td>
                  <td class="px-3 py-2 text-xs sm:text-sm">
                    {{ detail.barang }}
                  </td>

                  <td class="px-3 py-2 text-xs sm:text-sm">
                    {{ detail.qty_po }}
                  </td>
                  <td class="px-3 py-2 text-xs sm:text-sm">
                    <FieldNumber
                      v-model="detail.qty_by_kirim"
                      :disabled="loading"
                      :readonly="true"
                      :min="0"
                      class="w-24"
                    />
                  </td>
                  <td class="px-3 py-2 text-xs sm:text-sm">
                    {{ detail.unit }}
                  </td>
                  <td class="px-3 py-2 text-xs sm:text-sm">
                    <FieldTextarea
                      v-model="detail.catatan"
                      :disabled="loading || isReadOnly"
                      :readonly="isReadOnly"
                      placeholder="Catatan"
                      :rows="2"
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

          <div class="mt-4 border rounded-lg overflow-hidden">
            <div class="grid grid-cols-2 text-sm">
              <div class="px-4 py-2 border-b">Subtotal (DPP)</div>
              <div class="px-4 py-2 border-b text-right">
                {{ totalDpp.toLocaleString("id-ID") }}
              </div>
              <div class="px-4 py-2 border-b">
                Total PPN {{ Number(values.ppn_persen || 0) }}%
              </div>
              <div class="px-4 py-2 border-b text-right">
                {{ ppnTotal.toLocaleString("id-ID") }}
              </div>
              <div class="px-4 py-2 border-b">
                Total PPH {{ Number(values.pph_persen || 0) }}%
              </div>
              <div class="px-4 py-2 border-b text-right">
                {{ pphTotal.toLocaleString("id-ID") }}
              </div>
              <div class="px-4 py-2">Grand Total</div>
              <div class="px-4 py-2 text-right font-medium">
                {{ grandTotal.toLocaleString("id-ID") }}
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
  </div>
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
</style>
