<script setup lang="ts">
import { ref, reactive, onBeforeMount, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FieldX,
  FieldDate,
  FieldSelect,
  FieldPopup,
  FieldNumber,
} from "@/components/field";
import { ButtonMultiSelect } from "@/components/button";
import { ArrowLeft, Save, Loader2 } from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createPurchaseInvoiceSubcon,
  updatePurchaseInvoiceSubcon,
  getPurchaseInvoiceSubconById,
} from "./service";
import AuditInfo from '@/components/AuditInfo.vue'

const authStore = useAuthStore();
const { API_BASE_URL } = useApi();
const router = useRouter();
const route = useRoute();
const loading = ref(false);

const isEditMode = computed(
  () => !!route.params.id && route.name === "PurchaseInvoiceSubconForm",
);
const isViewMode = computed(() => route.name === "PurchaseInvoiceSubconView");
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

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail PI Subcon";
  if (isEditMode.value) return "Edit PI Subcon";
  return "Tambah PI Subcon";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data PI Subcon";
  if (isEditMode.value) return "Perbarui data PI Subcon";
  return "Buat data PI Subcon baru";
});

let values = reactive({
  m_unit_bisnis_id: "" as string,
  tgl_pi: new Date().toISOString().slice(0, 10),
  no_pi_subcon: "",
  m_supplier_id: "" as string,
  t_penerimaan_id: "" as string,
  top_id: "" as string,
  no_referensi: "" as string,
  catatan: "",
  dpp_lainnya: 0,
  total: 0,
  total_diskon: 0,
  total_ppn: 0,
  total_pph: 0,
  grand_total: 0,
  status: "DRAFT",
  pph_id: "",
  ppn_id: "",
});

const noReferensiName = ref("");
const companyName = ref("");
let initialValues: Record<string, any> = {};

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

type PoTaxInfo = { ppnPct: number; pphPct: number; ppnType: string };

const detailArr = ref<any[]>([]);
const detailArr2 = ref<any[]>([]);
const poTaxMap = ref<Record<string, PoTaxInfo>>({});
const selectedPenerimaanItems = ref<any[]>([]);

// Ref untuk menampilkan persentase PPN
const ppnPercentage = ref("0");
// Track PPN type: INCLUDE or EXCLUDE
const ppnType = ref<"INCLUDE" | "EXCLUDE">("EXCLUDE");

// PPH percentage (can be 0%, 2%, 3%, etc.)
const pphPercentage = ref("0");

const errors = reactive({
  m_supplier_id: "",
  top_id: "",
  ppn_id: "",
  pph_id: "",
});

const topOptions = [
  "7 Hari",
  "14 Hari",
  "30 Hari",
  "45 Hari",
  "60 Hari",
  "90 Hari",
  "Cash",
];

const apiHeaders = computed(() => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${authStore.token}`,
}));

const penerimaanParams = computed(() => ({
  searchfield: "no_penerimaan",
  ...(values.m_unit_bisnis_id
    ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id }
    : {}),
  ...(values.m_supplier_id
    ? { filter_column_m_supplier_id: values.m_supplier_id }
    : {}),
}));

const initializeUnitBisnis = () => {
  if (isSuperAdmin.value) return;
  try {
    const selectRespo = localStorage.getItem("SelectRespo");
    if (!selectRespo) return;
    const parsed = JSON.parse(selectRespo);
    const unitBisnisId = parsed.companyId || parsed.m_unit_bisnis_id || "";
    if (unitBisnisId) values.m_unit_bisnis_id = unitBisnisId;
  } catch {
    // ignore
  }
};

const getNettoFg = () => 0;
const getLineTotalJasa = (d: {
  qty_jasa?: number;
  harga?: number;
  discount_amount?: number;
}) => {
  const qty = Number(d.qty_jasa) || 0;
  const harga = Number(d.harga) || 0;
  const discount = Number(d.discount_amount) || 0;
  return Math.max(qty * harga - discount, 0);
};

const getDefaultPoTax = (): PoTaxInfo => ({
  ppnPct: 0,
  pphPct: 0,
  ppnType: "EXCLUDE",
});

const getHeaderTax = (): PoTaxInfo => ({
  ppnPct: Number(ppnPercentage.value) || 0,
  pphPct: Number(pphPercentage.value) || 0,
  ppnType: ppnType.value,
});

const getDetailTax = (poId: string | null | undefined): PoTaxInfo => {
  const headerTax = getHeaderTax();
  if (!poId)
    return headerTax.ppnPct || headerTax.pphPct ? headerTax : getDefaultPoTax();

  const poTax = poTaxMap.value[poId];
  if (poTax && (poTax.ppnPct > 0 || poTax.pphPct > 0)) return poTax;
  if (headerTax.ppnPct > 0 || headerTax.pphPct > 0) return headerTax;
  return poTax || getDefaultPoTax();
};

const getPpnForJasa = (d: any) => {
  const base = getLineTotalJasa(d);
  const tax = getDetailTax(d.t_purchase_order_subcon_id);
  if (tax.ppnPct <= 0) return 0;
  if (String(tax.ppnType).toUpperCase().includes("INCLUDE")) {
    return (base * tax.ppnPct) / (100 + tax.ppnPct);
  }
  return (base * tax.ppnPct) / 100;
};

const getPphForJasa = (d: any) => {
  const base = getLineTotalJasa(d);
  const tax = getDetailTax(d.t_purchase_order_subcon_id);
  return (base * tax.pphPct) / 100;
};

const getTotalAfterTaxForJasa = (d: any) => {
  const lineTotal = getLineTotalJasa(d);
  const tax = getDetailTax(d.t_purchase_order_subcon_id);
  const ppnAmount = getPpnForJasa(d);
  const pphAmount = getPphForJasa(d);

  if (String(tax.ppnType).toUpperCase().includes("INCLUDE") && tax.ppnPct > 0) {
    return lineTotal - pphAmount;
  }

  return lineTotal + ppnAmount - pphAmount;
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

const dppCalc = computed(() =>
  detailArr2.value.reduce((s, d) => s + getLineTotalJasa(d), 0),
);
// const dppLainnyaCalc = computed(() => Number(values.dpp_lainnya) || 0);
const totalCalc = computed(() => dppCalc.value);
const totalDiskonCalc = computed(() => Number(values.total_diskon) || 0);
const totalPpnCalc = computed(() =>
  detailArr2.value.reduce((s, d) => s + getPpnForJasa(d), 0),
);
const totalPphCalc = computed(() =>
  detailArr2.value.reduce((s, d) => s + getPphForJasa(d), 0),
);
const grandTotalCalc = computed(
  () =>
    totalCalc.value -
    totalDiskonCalc.value +
    totalPpnCalc.value -
    totalPphCalc.value,
);

const fetchPOTax = async (poId: string) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/dynamic/t_purchase_order_subcon/${poId}?include=po_sc_ppn,po_sc_pph`,
      { headers: apiHeaders.value },
    );
    if (!response.ok) return getDefaultPoTax();
    const payload = await response.json();
    const data = payload?.data || {};
    const ppnPct = Number(data?.po_sc_ppn?.value3 ?? 0) || 0;
    const pphPct =
      Number(data?.po_sc_pph?.value3 ?? data?.persen_pph ?? 0) || 0;
    const ppnType = String(data?.po_sc_ppn?.value4 || "EXCLUDE").toUpperCase();
    return { ppnPct, pphPct, ppnType } satisfies PoTaxInfo;
  } catch {
    return getDefaultPoTax();
  }
};

const syncPoTaxes = async () => {
  const poIds = Array.from(
    new Set(
      [...detailArr.value, ...detailArr2.value]
        .map((d: any) => d.t_purchase_order_subcon_id)
        .filter(Boolean),
    ),
  ) as string[];

  const map: Record<string, PoTaxInfo> = {};
  await Promise.all(
    poIds.map(async (poId) => {
      map[poId] = await fetchPOTax(poId);
    }),
  );
  poTaxMap.value = map;
};

const resetPenerimaanState = () => {
  values.t_penerimaan_id = "";
  selectedPenerimaanItems.value = [];
  detailArr.value = [];
  detailArr2.value = [];
  poTaxMap.value = {};
};

const onSelectPenerimaan = async (items: any[]) => {
  const selected = Array.isArray(items) ? items[0] : null;
  if (!selected) return;
  selectedPenerimaanItems.value = [selected];
  values.t_penerimaan_id = selected.id || "";
  await handlePenerimaanSelect(selected);
};

const handlePenerimaanSelect = async (item: any) => {
  detailArr.value = [];
  detailArr2.value = [];
  poTaxMap.value = {};
  if (!item) return;

  const jadiList = item.jadis || [];
  const jasaList = item.jasas || [];
  detailArr.value = jadiList.map((jadi: any) => ({
    t_purchase_order_subcon_id: jadi.t_purchase_order_subcon_id || null,
    t_purchase_order_subcon_jadi_id:
      jadi.t_purchase_order_subcon_jadi_id || null,
    t_penerimaan_barang_subcon_jadi_id: jadi.id || null,
    t_penerimaan_barang_subcon_id: jadi.t_penerimaan_barang_subcon_id || null,
    no_po: jadi.t_purchase_order_subcon?.no_po || "",
    no_penerimaan: item.no_penerimaan || item.no_t_penerimaan_subcon || "",
    m_items_id: jadi.m_items_id || null,
    kode: jadi.m_item?.kode_item || "",
    finish_goods: jadi.m_item?.nama_item || "",
    qty: Number(jadi.qty_diterima) || 0,
    uom: jadi.m_general?.value1 || "",
    uom_id: jadi.uom_id || null,
    harga: Number(jadi.t_purchase_order_subcon_jadi?.harga ?? 0) || 0,
    catatan: jadi.catatan || "",
  }));

  detailArr2.value = jasaList.map((jasa: any) => ({
    t_purchase_order_subcon_id: jasa.t_purchase_order_subcon_id || null,
    t_purchase_order_subcon_jasa_id:
      jasa.t_purchase_order_subcon_jasa_id || null,
    t_penerimaan_barang_subcon_jasa_id: jasa.id || null,
    t_penerimaan_barang_subcon_id: jasa.t_penerimaan_barang_subcon_id || null,
    no_po: jasa.t_purchase_order_subcon?.no_po || "",
    m_items_id: jasa.m_items_id || null,
    kode: jasa.m_item?.kode_item || "",
    material: jasa.m_item?.nama_item || "",
    jasa: jasa.nama_jasa || jasa.jasa || "",
    qty_jasa: Number(jasa.qty_diterima) || 0,
    uom: jasa.m_general?.value1 || "",
    uom_id: jasa.uom_id || null,
    harga: Number(jasa.t_purchase_order_subcon_jasa?.harga ?? 0) || 0,
    discount_amount: 0,
    total: 0,
    catatan: jasa.catatan || "",
    ppn_amount: jasa.t_purchase_order_subcon_jasa?.ppn_amount || 0,
    pph_amount: jasa.t_purchase_order_subcon_jasa?.pph_amount || 0,
    total_stlh_pajak: jasa.t_purchase_order_subcon_jasa?.total_stlh_pajak || 0,
  }));

  // detailArr.value = await Promise.all(
  //   detailArr.value.map(async (detail) => {
  //     let nextDetail = { ...detail };
  //     if (
  //       !nextDetail.t_purchase_order_subcon_id &&
  //       nextDetail.t_purchase_order_subcon_jadi_id
  //     ) {
  //       const po = await fetchPurchaseOrderSubconId(
  //         "jadi",
  //         nextDetail.t_purchase_order_subcon_jadi_id,
  //       );
  //       nextDetail = {
  //         ...nextDetail,
  //         t_purchase_order_subcon_id: po?.id || null,
  //         no_po: po?.no_po || nextDetail.no_po || "",
  //       };
  //     }
  //     if (
  //       (!Number(nextDetail.harga) || Number(nextDetail.harga) <= 0) &&
  //       nextDetail.t_purchase_order_subcon_jadi_id
  //     ) {
  //       const hargaPo = await fetchPurchaseOrderSubconDetailHarga(
  //         "jadi",
  //         nextDetail.t_purchase_order_subcon_jadi_id,
  //       );
  //       nextDetail.harga = Number(hargaPo) || 0;
  //     }
  //     return nextDetail;
  //   }),
  // );

  // detailArr2.value = await Promise.all(
  //   detailArr2.value.map(async (detail) => {
  //     let nextDetail = { ...detail };
  //     if (
  //       !nextDetail.t_purchase_order_subcon_id &&
  //       nextDetail.t_purchase_order_subcon_jasa_id
  //     ) {
  //       const po = await fetchPurchaseOrderSubconId(
  //         "jasa",
  //         nextDetail.t_purchase_order_subcon_jasa_id,
  //       );
  //       nextDetail = {
  //         ...nextDetail,
  //         t_purchase_order_subcon_id: po?.id || null,
  //         no_po: po?.no_po || nextDetail.no_po || "",
  //       };
  //     }
  //     if (
  //       (!Number(nextDetail.harga) || Number(nextDetail.harga) <= 0) &&
  //       nextDetail.t_purchase_order_subcon_jasa_id
  //     ) {
  //       const hargaPo = await fetchPurchaseOrderSubconDetailHarga(
  //         "jasa",
  //         nextDetail.t_purchase_order_subcon_jasa_id,
  //       );
  //       nextDetail.harga = Number(hargaPo) || 0;
  //     }
  //     return nextDetail;
  //   }),
  // );

  await syncPoTaxes();
};

const onReset = () => {
  Object.assign(values, {
    m_unit_bisnis_id: "",
    tgl_pi: new Date().toISOString().slice(0, 10),
    no_pi_subcon: "",
    m_supplier_id: "",
    t_penerimaan_id: "",
    top_id: "",
    no_referensi: "",
    catatan: "",
    dpp_lainnya: 0,
    total: 0,
    total_diskon: 0,
    total_ppn: 0,
    total_pph: 0,
    grand_total: 0,
    status: "DRAFT",
  });
  noReferensiName.value = "";
  companyName.value = "";
  errors.m_supplier_id = "";
  errors.top_id = "";
  selectedPenerimaanItems.value = [];
  detailArr.value = [];
  detailArr2.value = [];
  poTaxMap.value = {};
};

onBeforeMount(async () => {
  onReset();
  initializeUnitBisnis();
  const isCopyModeLocal = route.query.action === "copy" && route.query.source;
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value;
  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) return;

  loading.value = true;
  try {
    const res = await getPurchaseInvoiceSubconById(sourceId);
    if (res.status !== "success") throw new Error("Gagal memuat data");
    initialValues = res.data;

    auditMeta.value = {
      created_by: initialValues.created_by || initialValues.createdBy || null,
      createdAt: initialValues.createdAt || null,
      updated_by: initialValues.updated_by || initialValues.update_by || initialValues.edited_by || null,
      updatedAt: initialValues.updatedAt || null,
    };

    if (initialValues.t_purchase_invoice_subcon_jadis) {
      detailArr.value = initialValues.t_purchase_invoice_subcon_jadis.map(
        (item: any) => {
          const { id, ...rest } = item;
          return {
            ...rest,
            kode: item.m_item?.kode_item || "",
            finish_goods: item.m_item?.nama_item || "-",
            no_po: item.t_purchase_order_subcon?.no_po || "-",
            no_penerimaan: item.t_penerimaan_barang_subcon?.no_p || "-",
            uom: item.m_general?.value1 || "-",
            harga: Number(item.harga) || 0,
            qty: Number(item.qty) || 0,
            catatan: item.note || item.catatan || "",
          };
        },
      );
    }

    if (initialValues.t_purchase_invoice_subcon_jasas) {
      detailArr2.value = initialValues.t_purchase_invoice_subcon_jasas.map(
        (item: any) => {
          const { id, ...rest } = item;
          return {
            ...rest,
            kode: item.m_item?.kode_item || "",
            material: item.m_item?.nama_item || "-",
            no_po: item.t_purchase_order_subcon?.no_po || "-",
            uom: item.m_general?.value1 || "-",
            harga: Number(item.harga) || 0,
            qty_jasa: Number(item.qty_jasa) || 0,
            discount_amount:
              Number(item.discount_amount ?? item.diskon_amount) || 0,
            catatan: item.catatan || "",
            ppn_amount: Number(item.ppn_amount) || 0,
            pph_amount: Number(item.pph_amount) || 0,
            total_stlh_pajak: Number(item.total_stlh_pajak) || 0,
          };
        },
      );
    }

    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
      delete (initialValues as any).no_pi_subcon;
    }

    for (const k in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, k)) {
        (values as any)[k] = initialValues[k];
      }
    }

    if (
      initialValues.persen_ppn !== undefined &&
      initialValues.persen_ppn !== null
    ) {
      ppnPercentage.value = String(initialValues.persen_ppn || "0");
    }
    if (
      initialValues.persen_pph !== undefined &&
      initialValues.persen_pph !== null
    ) {
      pphPercentage.value = String(initialValues.persen_pph || "0");
    }
    if (initialValues.ppn_key1) {
      ppnType.value = String(initialValues.ppn_key1)
        .toUpperCase()
        .includes("INCLUDE")
        ? "INCLUDE"
        : "EXCLUDE";
    }

    if (initialValues.t_penerimaan_barang_subcon) {
      selectedPenerimaanItems.value = [
        {
          id: initialValues.t_penerimaan_barang_subcon.id,
          no_penerimaan: initialValues.t_penerimaan_barang_subcon.no_penerimaan,
        },
      ];
    }
    companyName.value =
      initialValues.m_unit_bisnis?.m_company?.nama ||
      initialValues.m_unit_bisnis?.m_company?.name ||
      "";

    await syncPoTaxes();
    toast.success(
      isCopyModeLocal ? "Data berhasil disalin" : "Data berhasil dimuat",
    );
  } catch (e) {
    toast.error("Gagal memuat data", {
      description: e instanceof Error ? e.message : "Terjadi kesalahan",
    });
    setTimeout(
      () => router.push("/purchasing/subcon/t_purchase_invoice_subcon"),
      2000,
    );
  } finally {
    loading.value = false;
  }
});

const onSave = async () => {
  errors.m_supplier_id = "";
  errors.top_id = "";

  let invalid = false;
  if (!values.m_supplier_id) {
    errors.m_supplier_id = "Supplier wajib diisi";
    invalid = true;
  }
  if (!values.top_id) {
    errors.top_id = "ToP wajib diisi";
    invalid = true;
  }

  if (invalid) {
    toast.error("Validasi gagal", {
      description: "Mohon lengkapi field wajib",
    });
    return;
  }

  loading.value = true;
  try {
    const payload: any = {
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      tgl_pi: values.tgl_pi || null,
      status: values.status || "DRAFT",
      t_penerimaan_id: values.t_penerimaan_id || null,
      m_supplier_id: values.m_supplier_id || null,
      top_id: values.top_id || null,
      ppn_id: values.ppn_id || null,
      persen_ppn: Number(ppnPercentage.value) || 0,
      pph_id: values.pph_id || null,
      ppn_key1: ppnType.value === "INCLUDE" ? "INCLUDE" : "EXCLUDE",
      persen_pph: Number(pphPercentage.value) || 0,
      no_referensi: values.no_referensi || null,
      catatan: values.catatan?.trim() || null,
      dpp_lainnya: dppCalc.value,
      total: totalCalc.value,
      total_diskon: totalDiskonCalc.value,
      total_ppn: totalPpnCalc.value,
      total_pph: totalPphCalc.value,
      grand_total: grandTotalCalc.value,
      t_purchase_invoice_subcon_jadis: detailArr.value.map((item) => ({
        t_purchase_order_subcon_id: item.t_purchase_order_subcon_id || null,
        t_purchase_order_subcon_jadi_id:
          item.t_purchase_order_subcon_jadi_id || null,
        t_penerimaan_barang_subcon_id:
          item.t_penerimaan_barang_subcon_id || null,
        t_penerimaan_barang_subcon_jadi_id:
          item.t_penerimaan_barang_subcon_jadi_id || null,
        m_items_id: item.m_items_id || null,
        qty: Number(item.qty) || 0,
        uom_id: item.uom_id || null,
        harga: 0,
        total: getNettoFg(),
        note: item.catatan || null,
      })),
      t_purchase_invoice_subcon_jasas: detailArr2.value.map((item) => ({
        t_purchase_order_subcon_id: item.t_purchase_order_subcon_id || null,
        t_purchase_order_subcon_jasa_id:
          item.t_purchase_order_subcon_jasa_id || null,
        t_penerimaan_barang_subcon_id:
          item.t_penerimaan_barang_subcon_id || null,
        t_penerimaan_barang_subcon_jasa_id:
          item.t_penerimaan_barang_subcon_jasa_id || null,
        m_items_id: item.m_items_id || null,
        qty_jasa: Number(item.qty_jasa) || 0,
        subtotal: getLineTotalJasa(item),
        harga: Number(item.harga) || 0,
        discount_amount: Number(item.discount_amount) || 0,
        catatan: item.catatan || null,
        uom_id: item.uom_id || null,
        ppn_amount: getPpnForJasa(item),
        pph_amount: getPphForJasa(item),
        total_stlh_pajak: getTotalAfterTaxForJasa(item),
      })),
    };

    if (isEditMode.value) {
      (payload as any).updated_by = authStore.user?.id || null;
      (payload as any).edited_by = authStore.user?.id || null;
      await updatePurchaseInvoiceSubcon(menuId.value, payload);
      toast.success("PI Subcon berhasil diperbarui");
    } else {
      (payload as any).created_by = authStore.user?.id || null;
      (payload as any).updated_by = authStore.user?.id || null;
      (payload as any).edited_by = authStore.user?.id || null;
      await createPurchaseInvoiceSubcon(payload);
      toast.success("PI Subcon berhasil dibuat");
    }

    router.replace(
      `/purchasing/subcon/t_purchase_invoice_subcon?reload=${Date.now()}`,
    );
  } catch (e) {
    toast.error(isEditMode.value ? "Gagal memperbarui" : "Gagal membuat", {
      description: e instanceof Error ? e.message : "Terjadi kesalahan",
    });
  } finally {
    loading.value = false;
  }
};

const handleCancel = () =>
  router.push("/purchasing/subcon/t_purchase_invoice_subcon");
const formatNum = (n: number) => Number(n || 0).toLocaleString("id-ID");
const createdByLabel = computed(() => {
  if (!initialValues.createdBy && !initialValues.createdAt) return "";
  const name =
    initialValues.createdBy?.name ||
    initialValues.createdBy?.username ||
    "admin";
  const dt = initialValues.createdAt
    ? new Date(initialValues.createdAt).toLocaleString("en-US")
    : "";
  return `Created By ${name} On ${dt}`;
});
</script>
<template>
  <div class="p-6 space-y-6 mx-auto">
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <Button variant="ghost" size="icon" @click="handleCancel">
          <ArrowLeft class="h-5 w-5" />
        </Button>
        <div>
          <h1 class="text-2xl font-bold">{{ pageTitle }}</h1>
          <p class="text-sm text-muted-foreground">{{ pageDescription }}</p>
        </div>
      </div>
      <span
        class="px-3 py-1 text-xs font-semibold rounded border bg-muted text-muted-foreground uppercase"
        >{{ values.status || "DRAFT" }}</span
      >
    </div>

    <form class="space-y-6" @submit.prevent>
      <Card>
        <CardContent class="pt-6 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldSelect
              v-if="isSuperAdmin"
              id="unit_bisnis"
              label="Unit Bisnis"
              v-model="values.m_unit_bisnis_id"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                headers: apiHeaders,
                params: {
                  no_pagination: 'true',
                  searchfield: 'nama_comp,nama',
                  filter_column_is_active: true,
                  join: true,
                },
                onsuccess: (r: any) => {
                  r.hasNext = !!r.pagination?.next_page;
                  return r;
                },
              }"
              @update:valueFull="(item) => {
                resetPenerimaanState();
                companyName = item?.m_company?.nama || item?.m_company?.name || '';
              }"
              displayField="nama_comp"
              valueField="id"
              placeholder="Pilih Unit Bisnis"
              class="w-full"
              :clearable="true"
            />
            <FieldX
              v-else
              id="unit_bisnis_display"
              label="Unit Bisnis"
              :value="companyNameDisplay"
              :disabled="true"
              :readonly="true"
              placeholder="Auto dari akun"
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

            <FieldDate
              id="tgl"
              label="Tanggal PI Subcon"
              type="date"
              :value="values.tgl_pi"
              @input="(v) => (values.tgl_pi = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              class="w-full"
            />
            <FieldX
              id="no_pi_subcon"
              label="No PI"
              :value="values.no_pi_subcon"
              :readonly="true"
              :disabled="true"
              placeholder="Auto Generate"
              class="w-full"
            />
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldPopup
              id="supplier"
              label="Supplier"
              v-model="values.m_supplier_id"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :errorText="errors.m_supplier_id ? 'failed' : ''"
              :hints="errors.m_supplier_id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_supplier`,
                headers: apiHeaders,
                params: {
                  searchfield: 'nama_supp',
                  filter_column_is_active: true,
                  join: true,
                },
              }"
              displayField="nama_supp"
              valueField="id"
              :columns="[
                {
                  field: 'nama_supp',
                  headerName: 'Nama Supplier',
                  sortable: true,
                  filterable: true,
                },
                { field: 'alamat_supp', headerName: 'Alamat', width: '240px' },
                { field: 'no_telp', headerName: 'No. Telp', width: '140px' },
                { field: 'termin.value1', headerName: 'TOP', width: '120px' },
              ]"
              placeholder="Pilih Supplier"
              class="w-full"
              @update:valueFull="
                (item: any) => {
                  resetPenerimaanState();
                  values.top_id = item?.top_id || '';
                }
              "
            />

            <div class="space-y-1">
              <FieldSelect
                id="top_id"
                label="ToP"
                :value="values.top_id"
                @input="(v: string) => (values.top_id = v)"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_general`,
                  headers: apiHeaders,
                  params: {
                    searchfield: 'value1',
                    filter_column_group: 'TERMIN',
                    filter_column_is_active: true,
                  },
                }"
                displayField="value1"
                valueField="id"
                placeholder="Pilih TOP"
              />
              <p v-if="errors.top_id" class="text-xs text-destructive mt-1">
                {{ errors.top_id }}
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
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

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              class="w-full"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div class="flex items-center justify-between gap-3">
            <div>
              <CardTitle>PI Subcon Detail</CardTitle>
              <CardDescription
                >Detail readonly dari Penerimaan Subcon (Finish Goods + Biaya
                Jasa)</CardDescription
              >
            </div>
            <ButtonMultiSelect
              v-if="!isReadOnly"
              title="+ Add to Detail"
              :selected-items="selectedPenerimaanItems"
              @add="onSelectPenerimaan"
              :disabled="
                loading || !values.m_unit_bisnis_id || !values.m_supplier_id
              "
              displayField="no_penerimaan"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/fn/t_penerimaan_barang_subcon/getListPbCanPi`,
                headers: apiHeaders,
                params: penerimaanParams,
              }"
              :columns="[
                {
                  field: 'no_penerimaan',
                  headerName: 'No. Penerimaan',
                  width: '180px',
                  sortable: true,
                  filterable: true,
                },
                {
                  field: 'm_supplier.nama_supp',
                  headerName: 'Supplier',
                  width: '180px',
                  sortable: true,
                  filterable: true,
                  render: (item: any) => item.m_supplier?.nama_supp || '-',
                },

                {
                  field: 'tgl_penerimaan',
                  headerName: 'Tanggal Penerimaan',
                  width: '180px',
                  sortable: true,
                  filterable: true,
                  render: (item: any) => item.tgl_penerimaan || '-',
                },
              ]"
            />
          </div>
          <p
            v-if="!values.m_unit_bisnis_id || !values.m_supplier_id"
            class="text-xs text-muted-foreground"
          >
            Pilih unit bisnis dan supplier terlebih dahulu untuk menampilkan
            penerimaan.
          </p>
        </CardHeader>
        <CardContent>
          <Tabs default-value="jasa" class="w-full">
            <TabsList class="mb-4">
              <TabsTrigger value="jasa">Detail Biaya Jasa</TabsTrigger>
              <TabsTrigger value="fg">Detail Finish Goods</TabsTrigger>
            </TabsList>

            <TabsContent value="jasa" class="mt-4">
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        No
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        No. PO
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        Kode
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        Material/Jasa
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        Qty
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        UoM
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        Harga
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        Diskon
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        Total
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        PPN
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        PPH
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        Total Setelah Pajak
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        Catatan
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr2.length === 0">
                      <td
                        colspan="13"
                        class="text-center py-8 text-muted-foreground text-xs"
                      >
                        Belum ada item dari penerimaan.
                      </td>
                    </tr>
                    <tr
                      v-for="(d, i) in detailArr2"
                      :key="i"
                      class="border-t hover:bg-muted/50"
                    >
                      <td class="px-3 py-2 text-xs">{{ i + 1 }}</td>
                      <td class="px-3 py-2 text-xs">{{ d.no_po }}</td>
                      <td class="px-3 py-2 text-xs">{{ d.kode }}</td>
                      <td class="px-3 py-2 text-xs">
                        {{ d.material || d.jasa }}
                      </td>
                      <td class="px-3 py-2 text-xs">
                        {{ formatNum(d.qty_jasa) }}
                      </td>
                      <td class="px-3 py-2 text-xs">{{ d.uom }}</td>
                      <td class="px-3 py-2 text-xs text-right">
                        {{ formatNum(d.harga) }}
                      </td>
                      <td class="px-3 py-2 text-xs text-right">
                        <FieldNumber
                          v-model="d.discount_amount"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          :min="0"
                          class="w-24"
                        />
                      </td>
                      <td class="px-3 py-2 text-xs text-right">
                        {{ formatNum(getLineTotalJasa(d)) }}
                      </td>
                      <td class="px-3 py-2 text-xs text-right">
                        {{ formatNum(getPpnForJasa(d)) }}
                      </td>
                      <td class="px-3 py-2 text-xs text-right">
                        {{ formatNum(getPphForJasa(d)) }}
                      </td>
                      <td class="px-3 py-2 text-xs text-right">
                        {{ formatNum(getTotalAfterTaxForJasa(d)) }}
                      </td>
                      <td class="px-3 py-2 text-xs min-w-[200px]">
                        <FieldX
                          type="textarea"
                          :value="d.catatan"
                          @input="(v) => (d.catatan = v)"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          :rows="2"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="fg" class="mt-4">
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        No
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        No. PO
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        No. Penerimaan
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        Kode
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        Finish Goods
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        Qty
                      </th>
                      <th class="px-3 py-2 text-left text-xs font-medium">
                        UoM
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr.length === 0">
                      <td
                        colspan="7"
                        class="text-center py-8 text-muted-foreground text-xs"
                      >
                        Belum ada item dari penerimaan.
                      </td>
                    </tr>
                    <tr
                      v-for="(d, i) in detailArr"
                      :key="i"
                      class="border-t hover:bg-muted/50"
                    >
                      <td class="px-3 py-2 text-xs">{{ i + 1 }}</td>
                      <td class="px-3 py-2 text-xs">{{ d.no_po }}</td>
                      <td class="px-3 py-2 text-xs">{{ d.no_penerimaan }}</td>
                      <td class="px-3 py-2 text-xs">{{ d.kode }}</td>
                      <td class="px-3 py-2 text-xs">{{ d.finish_goods }}</td>
                      <td class="px-3 py-2 text-xs">{{ formatNum(d.qty) }}</td>
                      <td class="px-3 py-2 text-xs">{{ d.uom }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>

          <div class="mt-6 grid grid-cols-2 gap-x-4 gap-y-1 max-w-xs">
            <span class="text-sm text-muted-foreground">DPP</span>
            <span class="text-sm text-right font-medium">{{
              formatNum(dppCalc)
            }}</span>
            <span class="text-sm text-muted-foreground">PPN</span>
            <span class="text-sm text-right font-medium">{{
              formatNum(totalPpnCalc)
            }}</span>
            <span class="text-sm text-muted-foreground">PPH</span>
            <span class="text-sm text-right font-medium">{{
              formatNum(totalPphCalc)
            }}</span>
            <span class="text-sm font-semibold border-t pt-1">Grand Total</span>
            <span class="text-sm text-right font-semibold border-t pt-1">{{
              formatNum(grandTotalCalc)
            }}</span>
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

      <div
        class="flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t -mx-6 px-6 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:static"
      >
        <span class="text-xs text-muted-foreground">{{ createdByLabel }}</span>
        <div class="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            @click="handleCancel"
            :disabled="loading"
            >{{ isReadOnly ? "Kembali" : "Batal" }}</Button
          >
          <Button
            v-if="!isReadOnly"
            type="button"
            @click="onSave"
            :disabled="loading"
            class="gap-2"
          >
            <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
            <Save v-else class="h-4 w-4" />
            {{ isEditMode ? "Perbarui" : "Simpan" }}
          </Button>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
