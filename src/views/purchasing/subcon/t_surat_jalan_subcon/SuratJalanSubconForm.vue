<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed, watch } from "vue";
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
  FieldDate,
  FieldSelect,
  FieldPopup,
  FieldTextarea,
} from "@/components/field";
import { ButtonMultiSelect } from "@/components/button";
import { DeleteButton } from "@/components/button";
import { ArrowLeft, Save, Loader2 } from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createSuratJalanSubcon,
  updateSuratJalanSubcon,
  getSuratJalanSubconById,
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
  () => !!route.params.id && route.name === "SuratJalanSubconForm",
);
const isViewMode = computed(() => route.name === "SuratJalanSubconView");
const isCopyMode = computed(
  () =>
    (route.query.action === "copy" && !!route.query.source) ||
    !!route.query.copy,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);
const currentUserId = computed(() => authStore.user?.id || null);

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Surat Jalan Subcon";
  if (isCopyMode.value) return "Salin Surat Jalan Subcon";
  if (isEditMode.value) return "Edit Surat Jalan Subcon";
  return "Tambah Surat Jalan Subcon Baru";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Surat Jalan Subcon";
  if (isCopyMode.value)
    return "Buat Surat Jalan Subcon baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Surat Jalan Subcon";
  return "Buat Surat Jalan Subcon baru";
});

// Form values - SAMA SEPERTI Form.txt
let values = reactive({
  m_unit_bisnis_id: "",
  tgl_sj_subcon: new Date().toISOString().split("T")[0],
  no_sj_subcon: "",
  m_supplier_id: "",
  is_ekspedisi: "false",
  ekspedisi_id: "",
  supir: "",
  kendaraan_id: "",
  alamat: "",
  gudang_id: "",
  catatan: "",
  status: "DRAFT",
  is_active: true,
});

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
const detailArr = ref<any[]>([]);
const collapsedPoIds = ref<string[]>([]);

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
  values.gudang_id = "";
  detailArr.value = [];
  collapsedPoIds.value = [];
};

const excludedPoIds = computed(() =>
  Array.from(
    new Set(
      detailArr.value
        .map((d: any) => d.t_purchase_order_subcon_id || d.t_purchase_order_id)
        .filter(Boolean),
    ),
  ),
);
const canOpenPoList = computed(
  () => !!values.m_unit_bisnis_id && !!values.m_supplier_id,
);

const normalizeIsEkspedisiValue = (value: any) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return ["true", "1", "yes", "y"].includes(normalized) ? "true" : "false";
};

const normalizeRelationId = (...candidates: any[]) => {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined || candidate === "") {
      continue;
    }

    if (typeof candidate === "object") {
      const nestedId = candidate.id ?? candidate.value;
      if (nestedId !== null && nestedId !== undefined && nestedId !== "") {
        return String(nestedId);
      }
      continue;
    }

    return String(candidate);
  }

  return "";
};

const getSupplierDisplayName = (...candidates: any[]) => {
  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined || candidate === "") {
      continue;
    }

    if (typeof candidate === "object") {
      const nestedName =
        candidate.nama_supp ??
        candidate.nama_supplier ??
        candidate.nama ??
        candidate.label ??
        candidate.value;
      if (nestedName !== null && nestedName !== undefined && nestedName !== "") {
        return String(nestedName);
      }
      continue;
    }

    return String(candidate);
  }

  return "";
};

const poHeaderFilters = computed(() => {
  const params: Record<string, any> = {
    searchfield: "no_po",
    filter_column_status: "APPROVED",
    filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
    filter_column_m_supplier_id: values.m_supplier_id,
  };

  const isEkspedisi = normalizeIsEkspedisiValue(values.is_ekspedisi) === "true";
  params.filter_column_is_ekspedisi = isEkspedisi;

  if (values.gudang_id?.trim()) {
    params.filter_column_m_gudang_id = values.gudang_id.trim();
  }

  if (isEkspedisi && values.ekspedisi_id?.trim()) {
    params.filter_column_m_ekspedisi_id = values.ekspedisi_id.trim();
    // Jika pilih ekspedisi, endpoint expects is_ekspedisi=true
    params.filter_column_is_ekspedisi = true;
  }

  return params;
});

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
  }).format(value);
};

const groupedDetailsByPo = computed(() => {
  const groupMap = new Map<string, any>();
  const result: any[] = [];

  detailArr.value.forEach((detail: any) => {
    const poId =
      detail.t_purchase_order_subcon_id ||
      detail.t_purchase_order_id ||
      "NO_PO";
    const poNo = detail.no_po || "-";
    const key = `${poId}::${poNo}`;

    if (!groupMap.has(key)) {
      const group = {
        key,
        poId,
        no_po: poNo,
        items: [] as any[],
      };
      groupMap.set(key, group);
      result.push(group);
    }

    groupMap.get(key).items.push(detail);
  });

  return result;
});

// ============================================================================
// DETAIL METHODS - DYNAMIC GENERATION
// ============================================================================

const addDetailArr = () => {
  detailArr.value.push({
    no_po: "",
    kode: "",
    nama_item: "",
    qty_sj: 0,
    qty_po: 0,
    uom: "",
    catatan: "",
  });
};

const mapDetailSuratJalan = (bahan: any) => {
  const rakDetail = bahan.stock_gudang?.m_rak_d;
  const rakKode = rakDetail?.kode || "-";
  const rakNama = rakDetail?.m_rak?.nama_rak;
  const rakDisplay = rakNama ? `${rakKode} (${rakNama})` : rakKode;

  return {
    // keep source detail id for dedupe/render key; backend will ignore unknown key on save if needed
    source_bahan_id: bahan.id,
    t_purchase_order_id: bahan.t_purchase_order_subcon_id,
    t_purchase_order_bahan_id: bahan.id,
    stock_gudang_id: bahan.stock_gudang_id || null,
    m_items_id: bahan.m_items_id || bahan.m_item_id,
    uom_id: bahan.uom_id || bahan.m_item?.uom_id || bahan.po_sc_b_uom?.id,

    t_purchase_order_subcon_id: bahan.t_purchase_order_subcon_id, // keep for removing tied items
    no_po:
      bahan.t_purchase_order_subcon?.no_po ||
      bahan.t_purchase_order_subcon?.id ||
      "-",
    kode: bahan.m_item?.kode_item || "-",
    nama_item: bahan.m_item?.nama_item || "-",
    qty_po: Number(bahan.qty_po_bahan) || 0,
    qty_sj: Number(bahan.qty_po_bahan) || 0,
    uom:
      bahan.po_sc_b_uom?.value1 ||
      bahan.m_item?.uom?.value1 ||
      bahan.po_sc_b_create_1?.value1 ||
      bahan.m_item?.uom_id ||
      bahan.uom ||
      "-",
    rak: rakDisplay,
    catatan: "",
  };
};

const mapLoadedDetailSuratJalan = (detail: any) => {
  const itemRel = detail.m_item || detail.m_items;
  const poRel = detail.t_purchase_order_subcon || detail.t_purchase_order;
  const poBahanRel =
    detail.t_purchase_order_subcon_bahan || detail.t_purchase_order_bahan;
  const uomRel = detail.m_general || detail.po_sc_b_uom || itemRel?.uom;
  const stockRel = detail.stock_gudang;
  const rakDetail = stockRel?.m_rak_d;
  const rakKode = rakDetail?.kode || "-";
  const rakNama = rakDetail?.m_rak?.nama_rak;
  const rakDisplay = rakNama ? `${rakKode} (${rakNama})` : rakKode;

  const qtyPo = Number(detail.qty_po ?? poBahanRel?.qty_po_bahan ?? 0);
  const qtySj = Number(
    detail.qty_sj ?? detail.qty_po ?? poBahanRel?.qty_po_bahan ?? 0,
  );

  return {
    ...detail,
    t_purchase_order_subcon_id:
      detail.t_purchase_order_subcon_id ||
      detail.t_purchase_order_id ||
      poRel?.id ||
      poBahanRel?.t_purchase_order_subcon_id ||
      poBahanRel?.t_purchase_order_s ||
      null,
    m_items_id: detail.m_items_id || itemRel?.id || null,
    stock_gudang_id: detail.stock_gudang_id || detail.stock_gudang?.id || null,
    uom_id: detail.uom_id || uomRel?.id || itemRel?.uom_id || null,
    no_po: detail.no_po || poRel?.no_po || poRel?.id || "-",
    kode: detail.kode || itemRel?.kode_item || "-",
    nama_item: detail.nama_item || itemRel?.nama_item || "-",
    qty_po: qtyPo,
    qty_sj: qtySj,
    uom: detail.uom || uomRel?.value1 || itemRel?.uom_id || "-",
    rak: detail.rak || rakDisplay,
    catatan: detail.catatan ?? "",
  };
};

const isPoCollapsed = (poId: string) => collapsedPoIds.value.includes(poId);

const togglePoGroup = (poId: string) => {
  if (isPoCollapsed(poId)) {
    collapsedPoIds.value = collapsedPoIds.value.filter((id) => id !== poId);
    return;
  }
  collapsedPoIds.value.push(poId);
};

const removePoGroup = (poId: string) => {
  detailArr.value = detailArr.value.filter((d: any) => {
    const itemPoId = d.t_purchase_order_subcon_id || d.t_purchase_order_id;
    return itemPoId !== poId;
  });
  collapsedPoIds.value = collapsedPoIds.value.filter((id) => id !== poId);
  toast.info("Semua detail PO berhasil dihapus");
};

const onSelectPO = async (pos: any[]) => {
  if (!canOpenPoList.value) {
    toast.info("Pilih Unit Bisnis dan Supplier terlebih dahulu");
    return;
  }

  if (!pos || pos.length === 0) return;

  loading.value = true;
  try {
    const selectedPoIds = pos.map((po: any) => po?.id).filter(Boolean);
    if (selectedPoIds.length === 0) return;

    // Source detail dari custom endpoint agar langsung by selected PO
    const poIdsParam = selectedPoIds.join(",");
    const res = await fetch(
      `${API_BASE_URL}/fn/t_purchase_order_subcon/getPoBahanList?po_ids=${encodeURIComponent(poIdsParam)}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await res.text();
      throw new Error(
        `Response bukan JSON (status ${res.status}): ${text.slice(0, 120)}`,
      );
    }

    const data = await res.json();
    if (data.status !== "success" || !Array.isArray(data.data)) return;

    const mappedByPo = new Map(pos.map((po: any) => [po.id, po]));
    const selectedBahan = data.data;

    // Replace only rows from selected PO so UI always follows latest bahan API result
    detailArr.value = detailArr.value.filter(
      (d: any) => !selectedPoIds.includes(d.t_purchase_order_subcon_id),
    );

    selectedBahan.forEach((bahan: any) => {
      if (
        bahan.t_purchase_order_subcon &&
        !bahan.t_purchase_order_subcon.no_po
      ) {
        bahan.t_purchase_order_subcon.no_po = mappedByPo.get(
          bahan.t_purchase_order_subcon_id,
        )?.no_po;
      }
      detailArr.value.push(mapDetailSuratJalan(bahan));
      collapsedPoIds.value = collapsedPoIds.value.filter(
        (id) => id !== bahan.t_purchase_order_subcon_id,
      );
    });

    if (selectedBahan.length === 0) {
      toast.info("PO terpilih tidak memiliki data bahan");
    }
  } catch (error) {
    console.error("Error fetching bahan for PO:", error);
    toast.error("Gagal mengambil data bahan PO");
  } finally {
    loading.value = false;
  }
};

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    m_unit_bisnis_id: "",
    tgl_sj_subcon: new Date().toISOString().split("T")[0],
    no_sj_subcon: "",
    m_supplier_id: "",
    is_ekspedisi: "false",
    ekspedisi_id: "",
    supir: "",
    kendaraan_id: "",
    alamat: "",
    gudang_id: "",
    catatan: "",
    status: "DRAFT",
    is_active: true,
  });

  // Reset errors
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });

  // Reset detail arrays - DYNAMIC
  detailArr.value = [];
  collapsedPoIds.value = [];
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
    (route.query.action === "copy" && route.query.source) || !!route.query.copy;
  const sourceId = isCopyModeLocal
    ? String(route.query.source || route.query.copy)
    : menuId.value;

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return;
  }

  loading.value = true;
  try {
    const res = await getSuratJalanSubconById(sourceId);

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

    // Load detail items - DYNAMIC

    const detailSource =
      initialValues.t_sj_subcon_ds || initialValues.t_sj_subcon_d || [];
    detailArr.value = Array.isArray(detailSource)
      ? detailSource.map((d: any) => mapLoadedDetailSuratJalan(d))
      : [];

    displayValues.supplier = getSupplierDisplayName(
      initialValues.m_supplier,
      initialValues.supplier,
      initialValues.m_supplier_id,
      initialValues.nama_supp,
    );
    displayValues.ekspedisi =
      initialValues.m_ekspedisi?.nama ||
      initialValues.ekspedisi?.nama ||
      initialValues.nama_ekspedisi ||
      "";
    displayValues.kendaraan =
      initialValues.m_kendaraan?.no_polisi ||
      initialValues.kendaraan?.no_polisi ||
      initialValues.no_polisi ||
      "";

    // Mode copy: hapus id dan timestamps agar jadi create baru
    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
    }

    // Assign hanya key yang sudah ada di state reactive values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        if (
          key === "m_supplier_id" &&
          initialValues[key] !== null &&
          typeof initialValues[key] === "object"
        ) {
          continue;
        }
        // @ts-ignore dynamic assign
        values[key] = initialValues[key];
      }
    }

    values.m_supplier_id = normalizeRelationId(
      initialValues.m_supplier_id,
      initialValues.m_supplier,
      initialValues.supplier,
    );

    selectedUnitBisnis.value =
      initialValues.m_unit_bisnis ||
      initialValues.m_unit_bisni ||
      initialValues.unit_bisnis ||
      selectedUnitBisnis.value;

    values.is_ekspedisi = normalizeIsEkspedisiValue(values.is_ekspedisi);

    if (isCopyModeLocal) {
      toast.success("Data berhasil disalin", {
        description: "Silakan edit dan simpan sebagai Surat Jalan Subcon baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Surat Jalan Subcon", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () => router.push("/purchasing/subcon/t_surat_jalan_subcon"),
      },
    });
    setTimeout(
      () => router.push("/purchasing/subcon/t_surat_jalan_subcon"),
      2000,
    );
  } finally {
    loading.value = false;
  }
});

// Errors object (manual validation) - SAMA SEPERTI Form.txt
const errors = reactive({
  m_unit_bisnis_id: "",
  tgl_sj_subcon: "",
  no_sj_subcon: "",
  m_supplier_id: "",
  is_ekspedisi: "",
  ekspedisi_id: "",
  supir: "",
  kendaraan_id: "",
  alamat: "",
  gudang_id: "",
  catatan: "",
});

const displayValues = reactive({
  supplier: "",
  ekspedisi: "",
  kendaraan: "",
});

const caraKirimOptions = [
  { value: "false", label: "Dikirim Perusahaan" },
  { value: "true", label: "Ekspedisi Luar" },
];

const ekspedisiColumns = [
  {
    field: "nama",
    headerName: "Nama Ekspedisi",
    width: "150px",
    sortable: true,
    filterable: true,
    filter: "ColFilter",
  },
  {
    field: "kode_ekspedisi",
    headerName: "Kode Ekspedisi",
    width: "150px",
    sortable: true,
    filterable: true,
    filter: "ColFilter",
  },
  {
    field: "kota_tujuan",
    headerName: "Kota Tujuan",
    width: "180px",
    sortable: false,
    filterable: false,
    renderHtml: (item: any) => {
      const text = item.kota_tujuan || "-";
      return `<div style='white-space: normal; word-wrap: break-word; overflow-wrap: break-word; max-width: 180px; line-height: 1.4;'>${text}</div>`;
    },
  },
  {
    field: "alamat",
    headerName: "Alamat",
    width: "180px",
    sortable: true,
    filterable: true,
    filter: "ColFilter",
    renderHtml: (item: any) => {
      const text = item.alamat || "-";
      return `<div style='white-space: normal; word-wrap: break-word; overflow-wrap: break-word; max-width: 180px; line-height: 1.4;'>${text}</div>`;
    },
  },
  {
    field: "telepon",
    headerName: "No. Telp",
    width: "120px",
    sortable: true,
    filterable: true,
    filter: "ColFilter",
  },
  {
    field: "cp_kantor",
    headerName: "CP Kantor",
    width: "100px",
    sortable: true,
    filterable: true,
    filter: "ColFilter",
  },
];

const poMultiSelectColumns = [
  { field: "no_po", headerName: "No. PO", width: "180px" },
  { field: "tgl_po", headerName: "Tgl PO", width: "130px" },
  { field: "no_pr_subcon", headerName: "No. PR Subcon", width: "220px" },
  { field: "supplier_name", headerName: "Supplier", width: "200px" },
  { field: "created_by_name", headerName: "Dibuat Oleh", width: "160px" },
  {
    field: "grand_total",
    headerName: "Grand Total",
    width: "180px",
    renderHtml: (item: any) => {
      const value = item.grand_total || 0;
      return `<div style="text-align: left; font-weight: 500; font-color: #333;">${formatCurrency(value)}</div>`;
    },
  },
];

// ============================================================================
// SAVE HANDLER - SAMA SEPERTI Form.txt + DETAIL
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });
  let invalid = false;
  if (!values.m_unit_bisnis_id?.trim()) {
    errors.m_unit_bisnis_id = "Unit Bisnis wajib diisi";
    invalid = true;
  }
  if (!values.tgl_sj_subcon?.trim()) {
    errors.tgl_sj_subcon = "Tanggal wajib diisi";
    invalid = true;
  }
  if (!values.m_supplier_id?.trim()) {
    errors.m_supplier_id = "Supplier wajib diisi";
    invalid = true;
  }
  if (
    normalizeIsEkspedisiValue(values.is_ekspedisi) === "true" &&
    !values.ekspedisi_id?.trim()
  ) {
    errors.ekspedisi_id = "Ekspedisi wajib diisi";
    invalid = true;
  }
  if (normalizeIsEkspedisiValue(values.is_ekspedisi) !== "true") {
    if (!values.supir?.trim()) {
      errors.supir = "Supir wajib diisi";
      invalid = true;
    }
    if (!values.kendaraan_id?.trim()) {
      errors.kendaraan_id = "No. Polisi wajib diisi";
      invalid = true;
    }
  }
  if (!values.alamat?.trim()) {
    errors.alamat = "Alamat wajib diisi";
    invalid = true;
  }
  if (!values.gudang_id?.trim()) {
    errors.gudang_id = "Gudang wajib diisi";
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
    const cleanedDetails = detailArr.value.map((d: any) => {
      const qtyPo = Number(d.qty_po) || 0;
      const qtySj = Number(d.qty_sj ?? d.qty_po) || 0;

      return {
        id: d.id,
        t_sj_subcon_id: d.t_sj_subcon_id,
        m_items_id: d.m_items_id,
        t_purchase_order_id:
          d.t_purchase_order_id || d.t_purchase_order_subcon_id,
        t_purchase_order_bahan_id: d.t_purchase_order_bahan_id,
        qty_po: qtyPo,
        qty_sj: qtySj,
        catatan: d.catatan ?? "",
        stock_gudang_id: d.stock_gudang_id || d.stock_gudang?.id || null,
        uom_id: d.uom_id || null,
      };
    });

    // Clean payload: convert empty strings to null + TAMBAH DETAIL
    const payload: any = {
      m_unit_bisnis_id: values.m_unit_bisnis_id?.trim() || null,
      tgl_sj_subcon: values.tgl_sj_subcon?.trim() || null,
      no_sj_subcon: values.no_sj_subcon?.trim() || null,
      m_supplier_id: values.m_supplier_id?.trim() || null,
      created_by: currentUserId.value,
      updated_by: currentUserId.value,
      is_ekspedisi: normalizeIsEkspedisiValue(values.is_ekspedisi) === "true",
      ekspedisi_id: values.ekspedisi_id?.trim() || null,
      supir: values.supir?.trim() || null,
      kendaraan_id: values.kendaraan_id?.trim() || null,
      alamat: values.alamat?.trim() || null,
      gudang_id: values.gudang_id?.trim() || null,
      catatan: values.catatan?.trim() || null,
      status: values.status || "DRAFT",
      is_active: values.is_active,
      // Detail fields - DYNAMIC
      t_sj_subcon_ds: cleanedDetails,
    };

    if (isEditMode.value) {
      await updateSuratJalanSubcon(menuId.value, payload as any);
      toast.success("Surat Jalan Subcon berhasil diperbarui", {
        description: `No. Surat Jalan Subcon "${values.no_sj_subcon}" telah diperbarui`,
      });
    } else {
      await createSuratJalanSubcon(payload as any);
      toast.success("Surat Jalan Subcon berhasil dibuat", {
        description: `No. Surat Jalan Subcon "${values.no_sj_subcon}" telah ditambahkan`,
      });
    }
    router.replace(
      "/purchasing/subcon/t_surat_jalan_subcon?reload=" + Date.now(),
    );
  } catch (error) {
    toast.error(
      isEditMode.value
        ? "Gagal memperbarui Surat Jalan Subcon"
        : "Gagal membuat Surat Jalan Subcon",
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
  router.push("/purchasing/subcon/t_surat_jalan_subcon");
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
          <CardTitle>Informasi Surat Jalan Subcon</CardTitle>
          <CardDescription>
            Isi data SuratJalanSubcon dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              v-if="!isSuperAdmin"
              id="m_unit_bisnis_display"
              label="Unit Bisnis"
              :value="unitBisnisNameDisplay"
              :disabled="true"
              :readonly="true"
              placeholder="Unit Bisnis dari respo"
              hints="Unit Bisnis otomatis dari respo yang dipilih"
            />

            <FieldX
              id="company_display"
              label="Company"
              :value="selectedCompanyNameDisplay"
              :disabled="true"
              :readonly="true"
              placeholder="Company dari Unit Bisnis"
              hints="Company otomatis dari Unit Bisnis yang dipilih"
            />

            <FieldX
              id="no_sj_subcon"
              label="No. Surat Jalan Subcon"
              v-model="values.no_sj_subcon"
              hints="Nomor akan digenerate otomatis oleh sistem"
              :disabled="true"
              :readonly="true"
              placeholder="Auto generate"
              class="w-full"
            />

            <FieldDate
              id="tgl_sj_subcon"
              label="Tanggal Surat Jalan Subcon"
              v-model="values.tgl_sj_subcon"
              :errorname="errors.tgl_sj_subcon ? 'failed' : ''"
              :hints="errors.tgl_sj_subcon"
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
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              placeholder="Pilih supplier"
              displayField="nama_supp"
              valueField="id"
              @update:valueFull="
                (item: any) => (displayValues.supplier = item?.nama_supp || '')
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

            <FieldSelect
              id="gudang_id"
              label="Gudang"
              v-model="values.gudang_id"
              :errorText="errors.gudang_id ? 'failed' : ''"
              :hints="errors.gudang_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih gudang"
              displayField="nama_gudang"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_gudang`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'nama_gudang,kode_gudang',
                  filter_column_is_active: true,
                  filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page
                    ? true
                    : false;
                  return response;
                },
              }"
            />

            <FieldSelect
              id="is_ekspedisi"
              label="Cara Kirim"
              v-model="values.is_ekspedisi"
              :options="caraKirimOptions"
              :errorText="errors.is_ekspedisi ? 'failed' : ''"
              :hints="errors.is_ekspedisi"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih cara kirim"
            />

            <FieldPopup
              v-if="normalizeIsEkspedisiValue(values.is_ekspedisi) === 'true'"
              id="ekspedisi_id"
              label="Ekspedisi"
              v-model="values.ekspedisi_id"
              :displayValue="displayValues.ekspedisi"
              :errorText="errors.ekspedisi_id ? 'failed' : ''"
              :hints="errors.ekspedisi_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              placeholder="Pilih ekspedisi"
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
              :columns="ekspedisiColumns"
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

            <FieldX
              v-if="normalizeIsEkspedisiValue(values.is_ekspedisi) !== 'true'"
              id="supir"
              label="Supir"
              v-model="values.supir"
              :errorname="errors.supir ? 'failed' : ''"
              :hints="errors.supir"
              :required="
                !isReadOnly &&
                normalizeIsEkspedisiValue(values.is_ekspedisi) !== 'true'
              "
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Nama supir"
              class="w-full"
            />

            <FieldPopup
              v-if="normalizeIsEkspedisiValue(values.is_ekspedisi) !== 'true'"
              id="kendaraan_id"
              label="No. Polisi"
              v-model="values.kendaraan_id"
              :displayValue="displayValues.kendaraan"
              :errorText="errors.kendaraan_id ? 'failed' : ''"
              :hints="errors.kendaraan_id"
              :required="
                !isReadOnly &&
                normalizeIsEkspedisiValue(values.is_ekspedisi) !== 'true'
              "
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              placeholder="Pilih kendaraan"
              displayField="no_polisi"
              valueField="id"
              @update:valueFull="
                (item: any) => (displayValues.kendaraan = item?.no_polisi || '')
              "
              :api="{
                url: `${API_BASE_URL}/dynamic/m_kendaraan?join=true`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'no_polisi,nama_kendaraan,kode_kendaraan',
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
                  field: 'no_polisi',
                  headerName: 'No. Polisi',
                  width: '130px',
                },
                { field: 'kode_kendaraan', headerName: 'Kode', width: '130px' },
                {
                  field: 'nama_kendaraan',
                  headerName: 'Nama Kendaraan',
                  flex: 1,
                },
                {
                  field: 'jenis_kendaraan.value1',
                  headerName: 'Jenis',
                  width: '150px',
                },
              ]"
            />

            <FieldX
              id="alamat"
              label="Dikirim ke"
              v-model="values.alamat"
              :errorname="errors.alamat ? 'failed' : ''"
              :hints="errors.alamat"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Alamat tujuan"
              class="w-full"
            />

            <!-- Catatan -->
            <FieldTextarea
              id="catatan"
              label="Catatan"
              v-model="values.catatan"
              :errorname="errors.catatan ? 'failed' : ''"
              :hints="errors.catatan"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Catatan tambahan..."
              :rows="3"
              class="md:col-span-2"
            />
          </div>
        </CardContent>
      </Card>

      <!-- DETAIL SECTION -->
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <div>
              <CardTitle>Surat Jalan Subcon Detail</CardTitle>
              <CardDescription
                >Kelola detail barang dengan multi select</CardDescription
              >
            </div>
            <ButtonMultiSelect
              v-if="!isReadOnly && canOpenPoList"
              title="+ Add to List"
              @add="onSelectPO"
              :exclude-ids="excludedPoIds"
              :api="{
                url: `${API_BASE_URL}/fn/t_purchase_order_subcon/getAvailablePoForSJ`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: poHeaderFilters,
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page
                    ? true
                    : false;
                  if (response.data) {
                    response.data = response.data.map((item: any) => ({
                      ...item,
                      no_pr_subcon:
                        item.t_purchase_request_subcon?.no_pr_subcon || '-',
                      supplier_name: item.m_supplier?.nama_supp || '-',
                      created_by_name:
                        item.user_default?.name ||
                        item.created_by_user?.name ||
                        item.po_sc_ctr?.name ||
                        '-',
                    }));
                  }
                  return response;
                },
              }"
              :columns="poMultiSelectColumns"
              :disabled="loading"
            />
            <p
              v-if="!isReadOnly && !canOpenPoList"
              class="text-xs text-muted-foreground"
            >
              Pilih Unit Bisnis dan Supplier untuk menampilkan daftar PO.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div class="border rounded-lg overflow-auto">
            <table class="w-full min-w-[1360px] text-sm">
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
                    Kode
                  </th>
                  <th
                    class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                  >
                    Nama Item
                  </th>
                  <th
                    class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                  >
                    Qty SJ
                  </th>
                  <th
                    class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                  >
                    UoM
                  </th>
                  <th
                    class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                  >
                    Rak
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
                    :colspan="isReadOnly ? 8 : 9"
                    class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                  >
                    Belum ada item dipilih. Klik "Add to List" untuk
                    menambahkan.
                  </td>
                </tr>
                <template
                  v-for="(group, groupIdx) in groupedDetailsByPo"
                  :key="group.key"
                >
                  <tr class="border-t bg-muted/30">
                    <td
                      class="px-3 py-2 text-xs sm:text-sm font-semibold whitespace-nowrap"
                    >
                      {{ groupIdx + 1 }}
                    </td>
                    <td class="px-3 py-2 text-xs sm:text-sm font-semibold">
                      <button
                        type="button"
                        class="inline-flex items-center gap-2 hover:underline"
                        @click="togglePoGroup(group.poId)"
                      >
                        <span>{{ isPoCollapsed(group.poId) ? "+" : "-" }}</span>
                        <span>{{ group.no_po }}</span>
                      </button>
                    </td>
                    <td
                      colspan="6"
                      class="px-3 py-2 text-xs sm:text-sm text-muted-foreground"
                    >
                      {{ group.items.length }} item bahan
                    </td>
                    <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                      <DeleteButton
                        variant="ghost"
                        size="sm"
                        @click="removePoGroup(group.poId)"
                      />
                    </td>
                  </tr>

                  <tr
                    v-for="(detail, itemIdx) in group.items"
                    v-show="!isPoCollapsed(group.poId)"
                    :key="
                      detail.source_bahan_id ||
                      detail.t_purchase_order_bahan_id ||
                      detail.id ||
                      `${group.key}-${itemIdx}`
                    "
                    class="border-t hover:bg-muted/50"
                  >
                    <td
                      class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                    ></td>
                    <td class="px-3 py-2 text-xs sm:text-sm"></td>
                    <td class="px-3 py-2 text-xs sm:text-sm">
                      {{ detail.kode }}
                    </td>
                    <td class="px-3 py-2 text-xs sm:text-sm">
                      {{ detail.nama_item }}
                    </td>
                    <td class="px-3 py-2 text-xs sm:text-sm">
                      <FieldNumber
                        v-model="detail.qty_sj"
                        :disabled="loading || isReadOnly"
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
                      {{ detail.rak || "-" }}
                    </td>
                    <td class="px-3 py-2 text-xs sm:text-sm">
                      <FieldTextarea
                        v-model="detail.catatan"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        placeholder="Catatan"
                        class="min-w-[260px]"
                        :rows="2"
                      />
                    </td>
                    <td v-if="!isReadOnly" class="px-2 py-2 text-center"></td>
                  </tr>
                </template>
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
