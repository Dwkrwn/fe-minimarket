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
  FieldDate,
  FieldNumber,
  FieldSelect,
  FieldPopup,
} from "@/components/field";
import { ButtonMultiSelect, DeleteButton } from "@/components/button";
import { ArrowLeft, Save, Loader2 } from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createPenerimaanSubcon,
  updatePenerimaanSubcon,
  getPenerimaanSubconById,
  type PoOutstandingItem,
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
  () => !!route.params.id && route.name === "PenerimaanSubconForm",
);
const isViewMode = computed(() => route.name === "PenerimaanSubconView");
const isCopyMode = computed(
  () =>
    (route.query.action === "copy" && !!route.query.source) ||
    !!route.query.copy,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Penerimaan Subcon";
  if (isCopyMode.value) return "Salin Penerimaan Subcon";
  if (isEditMode.value) return "Edit Penerimaan Subcon";
  return "Tambah Penerimaan Subcon";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Penerimaan Subcon";
  if (isCopyMode.value)
    return "Buat Penerimaan Subcon baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Penerimaan Subcon";
  return "Buat data Penerimaan Subcon baru";
});

const normalizeStatus = (status?: string) =>
  (status || "DRAFT")
    .toUpperCase()
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const defaultUnitBisnisId = ref<string | undefined>(undefined);
const isUnitBisnisLocked = computed(() => !!defaultUnitBisnisId.value);

const getDefaultUnitBisnisId = (): string | undefined => {
  try {
    const selectRespo = localStorage.getItem("SelectRespo");
    if (!selectRespo) return undefined;
    const parsed = JSON.parse(selectRespo);
    return parsed?.companyId || parsed?.m_unit_bisnis_id || undefined;
  } catch {
    return undefined;
  }
};

// Form values
let values = reactive({
  m_unit_bisnis_id: "" as string | undefined,
  tgl_penerimaan: new Date().toISOString().slice(0, 10),
  no_penerimaan: "",
  m_supplier_id: "" as string | undefined,
  m_gudang_id: "" as string | undefined,
  t_sj_id: "" as string | undefined,
  catatan: "",
  status: "DRAFT",
});

// Display names for lookup fields
const supplierName = ref("");
const gudangName = ref("");
const companyName = ref("");
const rackOptions = ref<{ id: string; label: string }[]>([]);

// Temp penampung data API mentah
let initialValues: Record<string, any> = {};

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

// Detail arrays - Penerimaan Subcon Detail
const detailArrJadi = ref<any[]>([]);
const detailArrJasa = ref<any[]>([]);
const canOpenPoList = computed(
  () => !!values.m_unit_bisnis_id && !!values.m_supplier_id,
);

const excludedPoIds = computed(() => {
  const jadiPoIds = detailArrJadi.value
    .map((d: any) => d.t_purchase_order_subcon_id)
    .filter(Boolean);
  const jasaPoIds = detailArrJasa.value
    .map((d: any) => d.t_purchase_order_subcon_id)
    .filter(Boolean);
  return Array.from(new Set([...jadiPoIds, ...jasaPoIds]));
});

// ============================================================================
// DETAIL METHODS
// ============================================================================
const addDetailArrJadi = () => {
  detailArrJadi.value.push({
    m_items_id: null,
    uom_id: null,
    t_po_subcon_jadi_id: null,
    t_purchase_order_subcon_jadi_id: null,
    rak_d_id: null,
    no_po: "",
    tgl_po: "",
    kode: "",
    nama_item: "",
    qty_diterima: 0,
    qty_po_ots: 0,
    qty_po: 0,
    qty_ots: 0,
    uom: "",
    rak_label: "",
    catatan: "",
  });
};

const removeJasaByPoId = (poId: string | null | undefined) => {
  if (!poId) return 0;

  const totalBefore = detailArrJasa.value.length;
  detailArrJasa.value = detailArrJasa.value.filter(
    (detail: any) => detail.t_purchase_order_subcon_id !== poId,
  );

  return totalBefore - detailArrJasa.value.length;
};

const removeDetailArrJadi = (index: number) => {
  const removedDetail = detailArrJadi.value[index];
  const removedPoId = removedDetail?.t_purchase_order_subcon_id;

  detailArrJadi.value.splice(index, 1);

  const hasRemainingJadiFromSamePo = removedPoId
    ? detailArrJadi.value.some(
        (detail: any) => detail.t_purchase_order_subcon_id === removedPoId,
      )
    : false;

  const removedJasaCount = !hasRemainingJadiFromSamePo
    ? removeJasaByPoId(removedPoId)
    : 0;

  toast.info(
    removedJasaCount > 0
      ? `Detail finish goods dihapus dan ${removedJasaCount} detail jasa dari PO yang sama ikut dibersihkan`
      : "Detail finish goods dihapus",
  );
};

const addDetailArrJasa = () => {
  detailArrJasa.value.push({
    m_items_id: null,
    uom_id: null,
    t_po_subcon_jasa_id: null,
    t_purchase_order_subcon_jasa_id: null,
    rak_d_id: null,
    no_po: "",
    tgl_po: "",
    kode: "",
    nama_item: "",
    qty_diterima: 0,
    qty_po_ots: 0,
    qty_po: 0,
    qty_ots: 0,
    uom: "",
    catatan: "",
  });
};

const removeDetailArrJasa = (index: number) => {
  detailArrJasa.value.splice(index, 1);
  toast.info("Detail dihapus");
};

const toNumber = (value: unknown) => Number(value ?? 0);

const getQtyLimit = (detail: any) => {
  const qtyPoOts = toNumber(detail.qty_po_ots);
  if (qtyPoOts > 0 || qtyPoOts === 0) return qtyPoOts;

  return toNumber(detail.qty_po);
};

const getDisplayQtyOts = (detail: any) => {
  const qtyPoOts = toNumber(detail.qty_po_ots);
  if (isReadOnly.value) {
    return qtyPoOts;
  }

  const qtyDiterima = toNumber(detail.qty_diterima);

  return Math.max(qtyPoOts - qtyDiterima, 0);
};

const getDisplayQtyOtsJasa = (detail: any) => {
  const qtyPoOts = toNumber(detail.qty_po_ots);
  if (isReadOnly.value) {
    return qtyPoOts;
  }

  const qtyDiterima = toNumber(detail.qty_diterima);
  return Math.max(qtyPoOts - qtyDiterima, 0);
};

const createOutstandingItemsMap = (
  outstandingItems: PoOutstandingItem[] = [],
) =>
  new Map(
    outstandingItems
      .map((item) => ({
        ...item,
        po_jadi_ref_id:
          item?.t_po_subcon_jadi_id ||
          item?.t_purchase_order_subcon_jadi_id ||
          null,
      }))
      .filter((item) => !!item.po_jadi_ref_id)
      .map((item) => [item.po_jadi_ref_id, item]),
  );

const mapDetailFromPOJadi = (
  item: any,
  poHeader?: any,
  outstanding?: PoOutstandingItem,
) => ({
  t_purchase_order_subcon_id:
    item.t_purchase_order_subcon_id ||
    poHeader?.id ||
    item.t_purchase_order_subcon?.id ||
    null,
  t_po_subcon_jadi_id:
    item.t_po_subcon_jadi_id ||
    item.t_purchase_order_subcon_jadi_id ||
    item.id_t_purchase_order_subcon_jadi ||
    item.t_purchase_order_subcon_jadi?.id ||
    item.id ||
    null,
  t_purchase_order_subcon_jadi_id:
    item.t_po_subcon_jadi_id ||
    item.t_purchase_order_subcon_jadi_id ||
    item.id_t_purchase_order_subcon_jadi ||
    item.t_purchase_order_subcon_jadi?.id ||
    item.id ||
    null,
  m_items_id: item.m_items_id || item.id_items || null,
  uom_id: item.uom_id || null,
  rak_d_id: item.rak_d_id || null,
  no_po:
    item.no_t_purchase_order_subcon ||
    poHeader?.no_po ||
    item.t_purchase_order_subcon?.no_po ||
    item.no_po ||
    "-",
  tgl_po:
    item.tgl_t_purchase_order_subcon ||
    poHeader?.tgl_po ||
    item.t_purchase_order_subcon?.tgl_po ||
    item.tgl_po ||
    "",
  kode: item.kode || item.kode_item || item.m_item?.kode_item || "-",
  nama_item:
    item.nama_item ||
    item.nama_material ||
    item.value1 ||
    item.m_item?.nama_item ||
    "-",
  qty_diterima: Number(item.qty_po ?? item.qty ?? 0),
  qty_po_ots: Number(outstanding?.qty_po ?? item.qty_po ?? item.qty ?? 0),
  qty_po: Number(item.qty_po ?? item.qty ?? 0),
  qty_ots: Number(outstanding?.qty_sisa ?? 0),
  uom:
    item.uom ||
    item.po_sc_j_uom?.value1 ||
    item.m_item?.mi_uom?.value1 ||
    item.uom_name ||
    "-",
  rak_label: item.rak_d_id
    ? `${item.m_rak_d?.kode || "-"} (${item.m_rak_d?.m_rak?.nama_rak || "-"})`
    : "",
  catatan: "",
});

const mapDetailFromPOJasa = (item: any, poHeader?: any) => ({
  t_purchase_order_subcon_id:
    item.t_purchase_order_subcon_id ||
    poHeader?.id ||
    item.t_purchase_order_subcon?.id ||
    null,
  t_po_subcon_jasa_id:
    item.t_po_subcon_jasa_id ||
    item.t_purchase_order_subcon_jasa_id ||
    item.id_t_purchase_order_subcon_jasa ||
    item.t_purchase_order_subcon_jasa?.id ||
    item.id ||
    null,
  t_purchase_order_subcon_jasa_id:
    item.t_po_subcon_jasa_id ||
    item.t_purchase_order_subcon_jasa_id ||
    item.id_t_purchase_order_subcon_jasa ||
    item.t_purchase_order_subcon_jasa?.id ||
    item.id ||
    null,
  m_items_id: item.m_items_id || item.id_items || null,
  uom_id: item.uom_id || null,
  rak_d_id: item.rak_d_id || null,
  no_po:
    item.no_t_purchase_order_subcon ||
    poHeader?.no_po ||
    item.t_purchase_order_subcon?.no_po ||
    item.no_po ||
    "-",
  tgl_po:
    item.tgl_t_purchase_order_subcon ||
    poHeader?.tgl_po ||
    item.t_purchase_order_subcon?.tgl_po ||
    item.tgl_po ||
    "",
  kode: item.kode || item.kode_item || item.m_item?.kode_item || "-",
  nama_item:
    item.nama_item ||
    item.nama_material ||
    item.value1 ||
    item.m_item?.nama_item ||
    "-",
  qty_diterima: Number(item.qty_jasa ?? item.qty_po ?? item.qty ?? 0),
  qty_po_ots: Number(item.qty_jasa ?? item.qty_po ?? item.qty ?? 0),
  qty_po: Number(item.qty_jasa ?? item.qty_po ?? item.qty ?? 0),
  qty_ots: Number(item.qty_jasa ?? item.qty_po ?? item.qty ?? 0),
  uom:
    item.uom ||
    item.m_general?.value1 ||
    item.m_item?.mi_uom?.value1 ||
    item.uom_name ||
    "-",
  catatan: "",
});

const mapLoadedDetailJadi = (detail: any) => {
  const itemRef = detail.m_items || detail.m_item || null;
  const poRef =
    detail.t_purchase_order_subcon ||
    detail.t_purchase_order_subcon_jadi?.t_purchase_order_subcon ||
    null;

  return {
    ...detail,
    t_purchase_order_subcon_id:
      detail.t_purchase_order_subcon_id ||
      poRef?.id ||
      detail.t_purchase_order_subcon_jadi?.t_purchase_order_subcon_id ||
      null,
    t_po_subcon_jadi_id:
      detail.t_po_subcon_jadi_id ||
      detail.t_purchase_order_subcon_jadi_id ||
      detail.id_t_purchase_order_subcon_jadi ||
      detail.po_jadi_id ||
      detail.t_purchase_order_subcon_jadi?.id ||
      null,
    t_purchase_order_subcon_jadi_id:
      detail.t_po_subcon_jadi_id ||
      detail.t_purchase_order_subcon_jadi_id ||
      detail.id_t_purchase_order_subcon_jadi ||
      detail.po_jadi_id ||
      detail.t_purchase_order_subcon_jadi?.id ||
      null,
    m_items_id: detail.m_items_id || itemRef?.id || null,
    uom_id: detail.uom_id || detail.m_general?.id || null,
    no_po: detail.no_po || poRef?.no_po || "-",
    tgl_po: detail.tgl_po || poRef?.tgl_po || "",
    kode: detail.kode || itemRef?.kode_item || "-",
    nama_item: detail.nama_item || itemRef?.nama_item || "-",
    qty_diterima: Number(detail.qty_diterima ?? 0),
    qty_po_ots: Number(
      detail.qty_po_ots ?? detail.qty_ots ?? detail.qty_po ?? 0,
    ),
    qty_po: Number(detail.qty_po ?? detail.qty_po_ots ?? 0),
    qty_ots: Number(detail.qty_ots ?? detail.qty_po_ots ?? 0),
    uom: detail.uom || detail.m_general?.value1 || "-",
    rak_label:
      detail.rak_label ||
      (detail.m_rak_d?.kode
        ? `${detail.m_rak_d.kode} (${detail.m_rak_d?.m_rak?.nama_rak || "-"})`
        : ""),
    catatan: detail.catatan ?? "",
  };
};

const mapLoadedDetailJasa = (detail: any) => {
  const itemRef = detail.m_items || detail.m_item || null;
  const poRef =
    detail.t_purchase_order_subcon ||
    detail.t_purchase_order_subcon_jasa?.t_purchase_order_subcon ||
    null;

  return {
    ...detail,
    t_purchase_order_subcon_id:
      detail.t_purchase_order_subcon_id ||
      poRef?.id ||
      detail.t_purchase_order_subcon_jasa?.t_purchase_order_subcon_id ||
      null,
    t_po_subcon_jasa_id:
      detail.t_po_subcon_jasa_id ||
      detail.t_purchase_order_subcon_jasa_id ||
      detail.id_t_purchase_order_subcon_jasa ||
      detail.po_jasa_id ||
      detail.t_purchase_order_subcon_jasa?.id ||
      null,
    t_purchase_order_subcon_jasa_id:
      detail.t_po_subcon_jasa_id ||
      detail.t_purchase_order_subcon_jasa_id ||
      detail.id_t_purchase_order_subcon_jasa ||
      detail.po_jasa_id ||
      detail.t_purchase_order_subcon_jasa?.id ||
      null,
    m_items_id: detail.m_items_id || itemRef?.id || null,
    uom_id: detail.uom_id || detail.m_general?.id || null,
    no_po: detail.no_po || poRef?.no_po || "-",
    tgl_po: detail.tgl_po || poRef?.tgl_po || "",
    kode: detail.kode || itemRef?.kode_item || "-",
    nama_item: detail.nama_item || itemRef?.nama_item || "-",
    qty_diterima: Number(detail.qty_diterima ?? 0),
    qty_po_ots: Number(
      detail.qty_po_ots ?? detail.qty_ots ?? detail.qty_po ?? 0,
    ),
    qty_po: Number(detail.qty_po ?? detail.qty_po_ots ?? 0),
    qty_ots: Number(detail.qty_ots ?? detail.qty_po_ots ?? 0),
    uom: detail.uom || detail.m_general?.value1 || "-",
    catatan: detail.catatan ?? "",
  };
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

    let poRows = [...pos];
    const hasEmbeddedDetails = poRows.every(
      (po: any) =>
        Array.isArray(po?.t_purchase_order_subcon_jadis) ||
        Array.isArray(po?.t_purchase_order_subcon_jasas),
    );

    // Fallback: jika popup belum bawa detail PO lengkap, fetch sekali ke endpoint yang sama by ids
    if (!hasEmbeddedDetails) {
      const poIdsParam = selectedPoIds.join(",");
      const res = await fetch(
        `${API_BASE_URL}/fn/t_purchase_order_subcon/getPoForPenerimaan?no_pagination=true&po_ids=${encodeURIComponent(poIdsParam)}`,
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
      if (data.status !== "success") return;
      poRows = Array.isArray(data.data) ? data.data : [];
    }

    detailArrJadi.value = detailArrJadi.value.filter(
      (d: any) => !selectedPoIds.includes(d.t_purchase_order_subcon_id),
    );
    detailArrJasa.value = detailArrJasa.value.filter(
      (d: any) => !selectedPoIds.includes(d.t_purchase_order_subcon_id),
    );

    const jadis: any[] = [];
    const jasas: any[] = [];

    poRows.forEach((po: any) => {
      const poJadis = Array.isArray(po?.t_purchase_order_subcon_jadis)
        ? po.t_purchase_order_subcon_jadis
        : [];
      const poJasas = Array.isArray(po?.t_purchase_order_subcon_jasas)
        ? po.t_purchase_order_subcon_jasas
        : [];
      const outstandingItemsMap = createOutstandingItemsMap(
        Array.isArray(po?.outstanding_items) ? po.outstanding_items : [],
      );

      poJadis.forEach((item: any) => {
        const mapped = mapDetailFromPOJadi(
          item,
          po,
          outstandingItemsMap.get(item.id),
        );
        jadis.push(mapped);
        detailArrJadi.value.push(mapped);
      });

      poJasas.forEach((item: any) => {
        const mapped = mapDetailFromPOJasa(item, po);
        jasas.push(mapped);
        detailArrJasa.value.push(mapped);
      });
    });

    if (jadis.length === 0 && jasas.length === 0) {
      toast.info("PO terpilih tidak memiliki detail finish goods/jasa");
    }
  } catch (error) {
    console.error("Error fetching jadi/jasa for PO:", error);
    toast.error("Gagal mengambil detail PO");
  } finally {
    loading.value = false;
  }
};

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  defaultUnitBisnisId.value = getDefaultUnitBisnisId();
  Object.assign(values, {
    m_unit_bisnis_id: defaultUnitBisnisId.value,
    tgl_penerimaan: new Date().toISOString().slice(0, 10),
    no_penerimaan: "",
    m_supplier_id: undefined,
    m_gudang_id: undefined,
    t_sj_id: undefined,
    catatan: "",
    status: "DRAFT",
  });
  supplierName.value = "";
  gudangName.value = "";
  companyName.value = "";
  rackOptions.value = [];
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });
  detailArrJadi.value = [];
  detailArrJasa.value = [];
};

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================
onBeforeMount(async () => {
  onReset();

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
    const res = await getPenerimaanSubconById(sourceId);
    if (res.status !== "success") throw new Error("Gagal memuat data");
    initialValues = res.data;

    auditMeta.value = {
      created_by: initialValues.created_by || initialValues.createdBy || null,
      createdAt: initialValues.createdAt || null,
      updated_by: initialValues.updated_by || initialValues.update_by || initialValues.edited_by || null,
      updatedAt: initialValues.updatedAt || null,
    };

    if (isEditMode.value && normalizeStatus(initialValues.status) === "POST") {
      toast.error("Data sudah di-POST", {
        description:
          "Data yang sudah POST tidak bisa diedit, dialihkan ke mode view",
      });
      router.replace(`/purchasing/subcon/t_penerimaan_subcon/view/${sourceId}`);
      return;
    }

    // Load detail items
    if (Array.isArray(initialValues.t_penerimaan_barang_subcon_jadis)) {
      detailArrJadi.value = initialValues.t_penerimaan_barang_subcon_jadis.map(
        (d: any) => mapLoadedDetailJadi(d),
      );
    }
    if (Array.isArray(initialValues.t_penerimaan_barang_subcon_jasas)) {
      detailArrJasa.value = initialValues.t_penerimaan_barang_subcon_jasas.map(
        (d: any) => mapLoadedDetailJasa(d),
      );
    }

    // Mode copy: hapus id dan timestamps
    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
      delete (initialValues as any).no_penerimaan;
    }

    // Assign ke values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore dynamic assign
        values[key] = initialValues[key];
      }
    }
    // normalize aliases from API
    values.m_gudang_id =
      initialValues.m_gudang_id ||
      initialValues.gudang_id ||
      values.m_gudang_id;

    // Set display names
    if (initialValues.m_supplier) {
      supplierName.value =
        initialValues.m_supplier.nama_supp ||
        initialValues.m_supplier.nama ||
        "";
    }
    if (initialValues.m_gudang) {
      gudangName.value =
        initialValues.m_gudang.nama_gudang || initialValues.m_gudang.nama || "";
    }
    companyName.value =
      initialValues.m_unit_bisnis?.m_company?.nama ||
      initialValues.m_unit_bisnis?.m_company?.name ||
      "";

    if (values.m_gudang_id) {
      await fetchRackOptionsByGudang(values.m_gudang_id);
    }

    if (isCopyModeLocal) {
      toast.success("Data berhasil disalin", {
        description: "Silakan edit dan simpan sebagai Penerimaan Subcon baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Penerimaan Subcon", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () => router.push("/purchasing/subcon/t_penerimaan_subcon"),
      },
    });
    setTimeout(
      () => router.push("/purchasing/subcon/t_penerimaan_subcon"),
      2000,
    );
  } finally {
    loading.value = false;
  }
});

// Errors
const errors = reactive({
  m_unit_bisnis_id: "",
  m_supplier_id: "",
  m_gudang_id: "",
});

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });
  let invalid = false;
  if (!values.m_unit_bisnis_id) {
    errors.m_unit_bisnis_id = "Unit Bisnis wajib diisi";
    invalid = true;
  }
  if (!values.m_supplier_id) {
    errors.m_supplier_id = "Supplier wajib diisi";
    invalid = true;
  }
  if (!values.m_gudang_id) {
    errors.m_gudang_id = "Gudang wajib diisi";
    invalid = true;
  }
  const invalidJadiRak = detailArrJadi.value.some((d: any) => !d.rak_d_id);
  if (invalidJadiRak) {
    invalid = true;
    toast.error("Validasi gagal", {
      description: "Rak Detail wajib diisi untuk semua detail finish goods",
    });
  }
  const invalidJadiQty = detailArrJadi.value.some(
    (d: any) => Number(d.qty_diterima ?? 0) > getQtyLimit(d),
  );
  const invalidJasaQty = detailArrJasa.value.some(
    (d: any) => Number(d.qty_diterima ?? 0) > getQtyLimit(d),
  );
  if (invalidJadiQty || invalidJasaQty) {
    invalid = true;
    toast.error("Validasi gagal", {
      description:
        "Qty diterima tidak boleh lebih besar dari batas qty yang tersedia",
    });
  }
  if (invalid) {
    if (!(invalidJadiQty || invalidJasaQty || invalidJadiRak)) {
      toast.error("Validasi gagal", {
        description: "Mohon lengkapi semua field yang wajib diisi",
      });
    }
    return;
  }

  loading.value = true;
  try {
    const payload: any = {
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      tgl_penerimaan: values.tgl_penerimaan || null,
      no_penerimaan: values.no_penerimaan || null,
      m_supplier_id: values.m_supplier_id || null,
      m_gudang_id: values.m_gudang_id || null,
      created_by: isEditMode.value ? (initialValues?.created_by || authStore.user?.id || null) : (authStore.user?.id || null),
      updated_by: authStore.user?.id || null,
      edited_by: authStore.user?.id || null,
      catatan: values.catatan?.trim() || null,
      status: values.status || "DRAFT",
      t_penerimaan_barang_subcon_jadis: detailArrJadi.value.map((d: any) => ({
        id: d.id,
        uom_id: d.uom_id || null,
        t_penerimaan_barang_subcon_id:
          d.t_penerimaan_barang_subcon_id || d.t_penerimaan_subcon_id || null,
        t_purchase_order_subcon_id: d.t_purchase_order_subcon_id || null,
        t_po_subcon_jadi_id:
          d.t_po_subcon_jadi_id || d.t_purchase_order_subcon_jadi_id || null,
        t_purchase_order_subcon_jadi_id:
          d.t_po_subcon_jadi_id || d.t_purchase_order_subcon_jadi_id || null,
        qty_diterima: Number(d.qty_diterima ?? d.qty_pb ?? d.qty_po ?? 0),
        qty_po: Number(d.qty_po ?? d.qty_po_ots ?? 0),
        m_items_id: d.m_items_id || null,
        rak_d_id: d.rak_d_id || null,
        qty_po_ots: Number(d.qty_po_ots ?? d.qty_po ?? 0),
        qty_ots: Number(d.qty_diterima ?? d.qty_pb ?? d.qty_po ?? 0),
        catatan: d.catatan ?? "",
      })),
      t_penerimaan_barang_subcon_jasas: detailArrJasa.value.map((d: any) => ({
        id: d.id,
        uom_id: d.uom_id || null,
        t_penerimaan_barang_subcon_id: d.t_penerimaan_barang_subcon_id || null,
        t_purchase_order_subcon_id: d.t_purchase_order_subcon_id || null,
        t_po_subcon_jasa_id:
          d.t_po_subcon_jasa_id || d.t_purchase_order_subcon_jasa_id || null,
        t_purchase_order_subcon_jasa_id:
          d.t_po_subcon_jasa_id || d.t_purchase_order_subcon_jasa_id || null,
        qty_diterima: Number(
          d.qty_diterima ?? d.qty_pb ?? d.qty_po ?? d.qty_jasa ?? 0,
        ),
        qty_po: Number(d.qty_po ?? d.qty_po_ots ?? d.qty_jasa ?? 0),
        m_items_id: d.m_items_id || null,
        rak_d_id: d.rak_d_id || null,
        qty_po_ots: Number(d.qty_po_ots ?? d.qty_po ?? d.qty_jasa ?? 0),
        qty_ots: Number(
          d.qty_diterima ?? d.qty_pb ?? d.qty_po ?? d.qty_jasa ?? 0,
        ),
        catatan: d.catatan ?? "",
      })),
      // keep shape aligned with backend contract (with-details)
      t_purchase_invoice_subcon_jadis: [],
      t_purchase_invoice_subcon_jasas: [],
    };

    if (isEditMode.value) {
      await updatePenerimaanSubcon(menuId.value, payload);
      toast.success("Penerimaan Subcon berhasil diperbarui");
    } else {
      await createPenerimaanSubcon(payload);
      toast.success("Penerimaan Subcon berhasil dibuat");
    }
    router.replace(
      "/purchasing/subcon/t_penerimaan_subcon?reload=" + Date.now(),
    );
  } catch (error) {
    toast.error(
      isEditMode.value
        ? "Gagal memperbarui Penerimaan Subcon"
        : "Gagal membuat Penerimaan Subcon",
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
  router.push("/purchasing/subcon/t_penerimaan_subcon");
};

// ============================================================================
// CARA KIRIM OPTIONS
// ============================================================================
const caraKirimOptions = [
  { value: "Dikirim Perusahaan", label: "Dikirim Perusahaan" },
  { value: "Dikirim Supplier", label: "Dikirim Supplier" },
  { value: "Diambil Sendiri", label: "Diambil Sendiri" },
];

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID");
};

const getRackLabelById = (rakId?: string | null) => {
  if (!rakId) return "-";
  return rackOptions.value.find((rack) => rack.id === rakId)?.label || "-";
};

const fetchRackOptionsByGudang = async (gudangId?: string) => {
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

const clampQtyDiterima = (detail: any) => {
  const maxQty = getQtyLimit(detail);
  const currentQty = Number(detail.qty_diterima ?? 0);
  if (currentQty > maxQty) {
    detail.qty_diterima = maxQty;
    toast.info(`Qty diterima tidak boleh lebih dari batas qty (${maxQty})`);
  }
};

watch(
  () => values.m_gudang_id,
  async (newGudangId, oldGudangId) => {
    if (newGudangId === oldGudangId) return;

    await fetchRackOptionsByGudang(newGudangId);

    const validRackIds = new Set(rackOptions.value.map((rack) => rack.id));
    detailArrJadi.value.forEach((detail: any) => {
      if (detail.rak_d_id && !validRackIds.has(detail.rak_d_id)) {
        detail.rak_d_id = null;
      }
    });
  },
);
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
      <!-- Status Badge -->
      <span
        class="px-3 py-1 text-xs font-semibold rounded border border-muted-foreground/30 bg-muted text-muted-foreground uppercase tracking-wide"
      >
        {{ values.status || "DRAFT" }}
      </span>
    </div>

    <!-- ================================================================ -->
    <!-- FORM SECTION -->
    <!-- ================================================================ -->
    <form class="space-y-6" @submit.prevent>
      <!-- HEADER CARD -->
      <Card>
        <CardContent class="pt-6 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Unit Bisnis -->
            <FieldSelect
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              v-model="values.m_unit_bisnis_id"
              :errorname="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || isUnitBisnisLocked"
              :readonly="isReadOnly || isUnitBisnisLocked"
              placeholder="Pilih Unit Bisnis"
              displayField="nama_comp"
              valueField="id"
              @update:valueFull="(item) => {
                companyName = item?.m_company?.nama || item?.m_company?.name || '';
              }"
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
                  join: true,
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page
                    ? true
                    : false;
                  return response;
                },
              }"
              class="w-full"
            />

            <!-- Readonly Company -->
            <FieldX
              id="company_name_display"
              label="Company"
              :value="companyName"
              :disabled="true"
              :readonly="true"
              placeholder="Pilih Unit Bisnis terlebih dahulu"
              class="w-full"
            />

            <!-- Tanggal Penerimaan -->
            <FieldDate
              id="tgl_penerimaan"
              label="Tanggal Penerimaan Subcon"
              v-model="values.tgl_penerimaan"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              class="w-full"
            />

            <!-- No. Penerimaan (auto-generated) -->
            <FieldX
              id="no_penerimaan"
              label="No. Penerimaan Subcon"
              :value="values.no_penerimaan"
              :disabled="true"
              :readonly="true"
              placeholder="Otomatis dibuat sistem"
              class="w-full"
            />

            <!-- Supplier -->
            <FieldPopup
              id="m_supplier_id"
              label="Supplier"
              v-model="values.m_supplier_id"
              :displayValue="supplierName"
              :errorText="errors.m_supplier_id ? 'failed' : ''"
              :hints="errors.m_supplier_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              placeholder="Pilih Supplier"
              displayField="nama_supp"
              valueField="id"
              @update:valueFull="
                (item: any) => (supplierName = item?.nama_supp || '')
              "
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
              class="w-full"
            />

            <!-- Gudang -->
            <FieldPopup
              id="m_gudang_id"
              label="Gudang"
              v-model="values.m_gudang_id"
              :displayValue="gudangName"
              :errorText="errors.m_gudang_id ? 'failed' : ''"
              :hints="errors.m_gudang_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              placeholder="Pilih Gudang"
              displayField="nama_gudang"
              valueField="id"
              @update:valueFull="
                (item: any) => (gudangName = item?.nama_gudang || '')
              "
              :api="{
                url: `${API_BASE_URL}/dynamic/m_gudang`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'nama_gudang,kode_gudang',
                  filter_column_is_active: true,
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
              :columns="[
                { field: 'kode_gudang', headerName: 'Kode', width: '120px' },
                { field: 'nama_gudang', headerName: 'Nama Gudang', flex: 1 },
                { field: 'kota', headerName: 'Kota', width: '150px' },
              ]"
              class="w-full"
            />

            <!-- Catatan -->
            <FieldX
              id="catatan"
              label="Catatan"
              type="textarea"
              :value="values.catatan"
              @input="(v) => (values.catatan = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Catatan"
              :rows="3"
              class="w-full md:col-span-2"
            />
          </div>
        </CardContent>
      </Card>

      <!-- ================================================================ -->
      <!-- DETAIL CARD -->
      <!-- ================================================================ -->
      <Tabs default-value="finish-goods" class="w-full">
        <TabsList class="inline-flex w-auto bg-muted p-1 rounded-xl mb-4 gap-1">
          <TabsTrigger value="finish-goods" class="px-5"
            >Detail Finish Goods</TabsTrigger
          >
          <TabsTrigger value="jasa" class="px-5">Detail Jasa</TabsTrigger>
        </TabsList>

        <TabsContent value="finish-goods" class="space-y-4 mt-4">
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
                <ButtonMultiSelect
                  v-if="!isReadOnly"
                  title="+ Add to List"
                  :excludeIds="excludedPoIds"
                  @add="onSelectPO"
                  :api="{
                    url: `${API_BASE_URL}/fn/t_purchase_order_subcon/getPoForPenerimaan`,
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authStore.token}`,
                    },
                    params: {
                      searchfield: 'no_po',
                      filter_column_status: 'APPROVED',
                      filter_column_m_unit_bisnis_id:
                        values.m_unit_bisnis_id || undefined,
                      filter_column_m_supplier_id:
                        values.m_supplier_id || undefined,
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
                      field: 'no_po',
                      headerName: 'No. PO',
                      width: '180px',
                      sortable: true,
                      filterable: true,
                    },
                    {
                      field: 'tgl_po',
                      headerName: 'Tgl. PO',
                      width: '130px',
                      sortable: true,
                      filterable: true,
                    },
                    {
                      field: 'm_supplier',
                      headerName: 'Supplier',
                      width: '200px',
                      render: (row: any) => row?.m_supplier?.nama_supp || '-',
                    },
                    {
                      field: 'grand_total',
                      headerName: 'Grand Total',
                      width: '150px',
                      render: (row: any) => row?.grand_total || '-',
                    },
                  ]"
                  :disabled="loading || !canOpenPoList"
                />
              </div>
              <p
                v-if="!canOpenPoList && !isReadOnly"
                class="text-xs text-muted-foreground mb-4"
              >
                Pilih Unit Bisnis dan Supplier untuk menampilkan daftar PO.
              </p>
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
                        No. PO
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Tgl. PO
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
                        Qty PB
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Qty PO
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Qty Ots
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        UoM
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Rak Detail
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Catatan
                      </th>
                      <th
                        v-if="!isReadOnly"
                        class="px-2 py-2 text-center font-medium text-xs sm:text-sm"
                      ></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArrJadi.length === 0">
                      <td
                        colspan="12"
                        class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                      >
                        Belum ada item finish goods. Klik "+ Add to List" untuk
                        menambahkan.
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, idx) in detailArrJadi"
                      :key="`jadi-${idx}`"
                      class="border-t hover:bg-muted/50"
                    >
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ idx + 1 }}
                      </td>
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ detail.no_po }}
                      </td>
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ formatDate(detail.tgl_po) }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.kode }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.nama_item }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldNumber
                          v-model="detail.qty_diterima"
                          @update:modelValue="() => clampQtyDiterima(detail)"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          :min="0"
                          placeholder="0"
                          class="w-20"
                        />
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.qty_po }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ getDisplayQtyOts(detail) }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.uom }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm min-w-[180px]">
                        <FieldSelect
                          v-if="!isReadOnly"
                          v-model="detail.rak_d_id"
                          :disabled="loading || !values.m_gudang_id"
                          valueField="id"
                          displayField="label"
                          placeholder="Pilih rak detail"
                          :options="rackOptions"
                        />
                        <span v-else>{{
                          getRackLabelById(detail.rak_d_id) !== "-"
                            ? getRackLabelById(detail.rak_d_id)
                            : detail.rak_label || "-"
                        }}</span>
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
                          @click="removeDetailArrJadi(idx)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jasa" class="space-y-4 mt-4">
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
                <ButtonMultiSelect
                  v-if="!isReadOnly"
                  title="+ Add to List"
                  :excludeIds="excludedPoIds"
                  @add="onSelectPO"
                  :api="{
                    url: `${API_BASE_URL}/fn/t_purchase_order_subcon/getPoForPenerimaan`,
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authStore.token}`,
                    },
                    params: {
                      searchfield: 'no_po',
                      filter_column_status: 'APPROVED',
                      filter_column_m_unit_bisnis_id:
                        values.m_unit_bisnis_id || undefined,
                      filter_column_m_supplier_id:
                        values.m_supplier_id || undefined,
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
                      field: 'no_po',
                      headerName: 'No. PO',
                      width: '180px',
                      sortable: true,
                      filterable: true,
                    },
                    {
                      field: 'tgl_po',
                      headerName: 'Tgl. PO',
                      width: '130px',
                      sortable: true,
                      filterable: true,
                    },
                    {
                      field: 'm_supplier',
                      headerName: 'Supplier',
                      width: '200px',
                      render: (row: any) => row?.m_supplier?.nama_supp || '-',
                    },
                    {
                      field: 'grand_total',
                      headerName: 'Grand Total',
                      width: '150px',
                      render: (row: any) => row?.grand_total || '-',
                    },
                  ]"
                  :disabled="loading || !canOpenPoList"
                />
              </div>
              <p
                v-if="!canOpenPoList && !isReadOnly"
                class="text-xs text-muted-foreground mb-4"
              >
                Pilih Unit Bisnis dan Supplier untuk menampilkan daftar PO.
              </p>
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
                        No. PO
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Tgl. PO
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
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Qty PB
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Qty PO
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Qty Ots
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
                      ></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArrJasa.length === 0">
                      <td
                        colspan="11"
                        class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                      >
                        Belum ada item jasa. Klik "+ Add to List" untuk
                        menambahkan.
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, idx) in detailArrJasa"
                      :key="`jasa-${idx}`"
                      class="border-t hover:bg-muted/50"
                    >
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ idx + 1 }}
                      </td>
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ detail.no_po }}
                      </td>
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ formatDate(detail.tgl_po) }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.kode }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.nama_item }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldNumber
                          v-model="detail.qty_diterima"
                          @update:modelValue="() => clampQtyDiterima(detail)"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          :min="0"
                          placeholder="0"
                          class="w-20"
                        />
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.qty_po }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ getDisplayQtyOtsJasa(detail) }}
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
                          @click="removeDetailArrJasa(idx)"
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
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
