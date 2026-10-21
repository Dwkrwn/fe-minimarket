<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed } from "vue";
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
  FieldDate,
  FieldSelect,
  FieldTextarea,
  FieldPopup,
  FieldNumber,
} from "@/components/field";
import { ButtonMultiSelect, DeleteButton } from "@/components/button";
import { ArrowLeft, Save, Loader2 } from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createTPurchaseRequestClose,
  updateTPurchaseRequestClose,
  getTPurchaseRequestCloseById,
  getPrSisa,
  approveTPurchaseRequestClose,
  getPROutstandingList,
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
  () => !!route.params.id && route.name === "TPurchaseRequestCloseForm",
);
const isViewMode = computed(() => route.name === "TPurchaseRequestCloseView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);

// Check if current user is Super Admin
const isSuperAdmin = computed(() => authStore.isSuperAdmin);

// Super Admin confirmation dialog state
const isSuperAdminDialogOpen = ref(false);

// Warning dialog state for qty_prc > qty_po
const isQtyWarningDialogOpen = ref(false);
const itemsWithExcessQty = ref<any[]>([]);
// Map to track which items have shown warning (key: index, value: boolean)
const warningShownMap = new Map<number, boolean>();

// Sisa PR data & validation dialog (hard block)
const sisaPrData = ref<any[]>([]);
const isSisaPrErrorDialogOpen = ref(false);
const itemsExceedSisaPr = ref<any[]>([]);

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Purchase Request Close";
  if (isCopyMode.value) return "Salin Purchase Request Close";
  if (isEditMode.value) return "Edit Purchase Request Close";
  return "Tambah Purchase Request Close Baru";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Purchase Request Close";
  if (isCopyMode.value)
    return "Buat Purchase Request Close baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Purchase Request Close";
  return "Buat Purchase Request Close baru";
});

// Form values - sesuai struktur t_purchase_request_close
let values = reactive({
  no_preq_close: "",
  tgl_close: new Date().toISOString().split("T")[0],
  t_purchase_request_id: "",
  m_unit_bisnis_id: "",
  alasan: "",
  catatan: "",
  status: "DRAFT",
  created_by: authStore.user?.id || "",
});

// Display-only fields (tidak disimpan ke DB)
const displayFields = reactive({
  diminta_oleh: "",
  divisi_request: "",
  no_pr: "", // Untuk menampilkan nomor PR yang dipilih
});

// ============================================================================
// COMPUTED - COMPANY INFO FROM SELECTRESPO (Unit Bisnis)
// ============================================================================
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

// Temp penampung data API mentah sebelum dimasukkan
let initialValues: Record<string, any> = {};

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

// Selected PR data untuk auto-fill display fields
const selectedPR = ref<any>(null);

// Detail items array untuk t_purchase_request_close_ds
const detailItems = ref<any[]>([]);

// Selected PO ID from Purchase Request
const selectedPOId = ref<string>("");

// Loading state for fetching PO details
const loadingPODetails = ref(false);

const hasPO = computed(() => !!selectedPOId.value);

const detailColspan = computed(() => {
  return isReadOnly.value ? 8 : 9;
});

// Exclude already selected PR detail items in multi select
const excludedPRDetailIds = computed(() =>
  detailItems.value
    .map((item: any) => item.t_purchase_request_d_id)
    .filter((id: any) => !!id),
);

// ============================================================================
// DETAIL METHODS
// ============================================================================
const removeDetailItem = (index: number) => {
  detailItems.value.splice(index, 1);
  warningShownMap.delete(index);
  toast.info("Detail item dihapus");
};

// Handle qty_prc change with real-time validation
const getMaxQty = (item: any) => {
  if (item.qty_po && item.qty_po > 0) return item.qty_po;
  return item.qty_pr || 0;
};

const findOutstandingRow = (item: any) => {
  const outstList = (selectedPR.value as any)?.details_outstanding || [];
  const detailId = item?.t_purchase_request_d_id || item?.id || null;
  if (detailId) {
    const foundByDetail = outstList.find(
      (d: any) => d.t_purchase_request_d_id === detailId,
    );
    if (foundByDetail) return foundByDetail;
  }
  const itemId = item?.m_items_id || item?.m_item?.id || null;
  if (itemId) {
    return outstList.find((d: any) => d.m_items_id === itemId) || null;
  }
  return null;
};

const getQtyPrOts = (item: any): number | null => {
  const raw = item?.qty_pr_ots;
  if (raw === null || raw === undefined || raw === "") return null;
  const num = Number(raw);
  return Number.isNaN(num) ? 0 : num;
};

const findSisaRow = (item: any) => {
  const detailId = item?.t_purchase_request_d_id || item?.id || null;
  if (detailId) {
    const foundByDetail = sisaPrData.value.find(
      (s: any) => s.t_purchase_request_d_id === detailId,
    );
    if (foundByDetail) return foundByDetail;
  }
  const itemId = item?.m_items_id || item?.m_item?.id || null;
  if (itemId) {
    return sisaPrData.value.find((s: any) => s.m_items_id === itemId) || null;
  }
  return null;
};

// Get base sisa PR for a specific item (from closing detail / sisa / outstanding)
const getBaseSisaQty = (item: any): number => {
  const qtyPrOts = getQtyPrOts(item);
  if (qtyPrOts !== null) return qtyPrOts;

  const sisaRow = findSisaRow(item);
  console.log("sisaRow:", sisaRow, "sisaPrData:", sisaPrData.value);
  if (sisaRow?.qty_outstanding !== undefined && sisaRow?.qty_outstanding !== null) {
    return Number(sisaRow.qty_outstanding) || 0;
  }
  if (sisaRow?.sisa_pr !== undefined && sisaRow?.sisa_pr !== null) {
    return Number(sisaRow.sisa_pr) || 0;
  }
  const outst = findOutstandingRow(item);
  if (outst?.qty_outstanding !== undefined && outst?.qty_outstanding !== null) {
    return Number(outst.qty_outstanding) || 0;
  }
  if (item?.qty_outstanding !== undefined) {
    return Number(item.qty_outstanding) || 0;
  }
  return 0;
};

const getDisplaySisaQty = (item: any): number => {
  const base = getBaseSisaQty(item);
  if (isReadOnly.value) {
    return base; // Di Readonly, tampilkan base sisa murni
  }

  // Di Create / Edit mode, tampilkan sisa dinamis (mengurangi nilai inputan)
  const prc = Number(item?.qty_prc) || 0;
  const remaining = base - prc;
  return remaining >= 0 ? remaining : 0;
};

const ensureOutstandingDetails = async (prId: string) => {
  if (!prId) return;
  if (isEditMode.value || isViewMode.value || isCopyMode.value) return;
  if (selectedPR.value?.details_outstanding?.length) return;

  try {
    const res = await getPROutstandingList({
      order_by: "createdAt",
      order_type: "DESC",
      paginate: 1,
      filter_column_id: prId,
    });
    if (res.status === "success" && res.data && res.data.length > 0) {
      const pr = res.data[0];
      selectedPR.value = {
        ...(selectedPR.value || {}),
        details_outstanding: pr.details_outstanding || [],
        qty_pr_total: pr.qty_pr_total,
        qty_po_total: pr.qty_po_total,
        qty_close_total: pr.qty_close_total,
        qty_outstanding_total: pr.qty_outstanding_total,
      };
    }
  } catch (error) {
    console.warn("Failed to fetch PR outstanding list:", error);
  }
};

const fetchSisaPrData = async (prId: string) => {
  if (!prId) {
    sisaPrData.value = [];
    return;
  }

  try {
    const excludeId =
      isEditMode.value || isViewMode.value ? menuId.value : undefined;
    const res = await getPrSisa(prId, excludeId);
    if (res.status === "success") {
      sisaPrData.value = res.data || [];
    }
  } catch (error) {
    console.error("Failed to fetch sisa PR:", error);
    sisaPrData.value = [];
  }
};

const handleQtyPrcChange = (
  item: any,
  value: string | number,
  index: number,
) => {
  let numValue = typeof value === "string" ? parseFloat(value) || 0 : value;
  numValue = Math.max(0, numValue);

  const sisaQty = getBaseSisaQty(item);

  // Check if qty_prc exceeds sisa PR
  if (numValue > sisaQty) {
    numValue = sisaQty;
    // Only show toast once per correction cycle
    if (!warningShownMap.get(index)) {
      toast.warning("Qty PR Closing melebihi Sisa PR", {
        description: `${item.nama_item}: Qty dikembalikan ke maksimal Sisa PR (${sisaQty})`,
        duration: 4000,
      });
      warningShownMap.set(index, true);
    }
  } else {
    // Reset warning flag when qty is corrected
    if (warningShownMap.get(index)) {
      warningShownMap.delete(index);
    }
  }

  item.qty_prc = numValue;
};

// Check if any qty_prc exceeds sisa PR (HARD BLOCK - cannot save)
const checkSisaPrExcess = (): boolean => {
  const excess = detailItems.value
    .filter((item: any) => {
      const sisa = getBaseSisaQty(item);
      return item.qty_prc > sisa;
    })
    .map((item: any) => ({
      ...item,
      sisa_pr: getBaseSisaQty(item),
      selisih: item.qty_prc - getBaseSisaQty(item),
    }));

  if (excess.length > 0) {
    itemsExceedSisaPr.value = excess;
    return true;
  }

  return false;
};

// Check if any qty_prc exceeds qty_po before save (soft warning)
const checkQtyExcess = (): boolean => {
  const excess = detailItems.value.filter(
    (item: any) => item.qty_prc > getMaxQty(item),
  );

  if (excess.length > 0) {
    itemsWithExcessQty.value = excess;
    return true;
  }

  return false;
};

// Confirm to proceed with excess qty
const confirmQtyExcess = async () => {
  isQtyWarningDialogOpen.value = false;
  await proceedWithSave();
};

// Cancel save if user doesn't want to proceed
const cancelQtyExcess = () => {
  isQtyWarningDialogOpen.value = false;
  toast.info("Penyimpanan dibatalkan", {
    description: "Silakan perbaiki qty PR Closing yang melebihi Qty PO",
  });
};

// Helper: render Qty Sisa for PR popup column (avoids > in template)
const renderSisaPrcHtml = (item: any): string => {
  const qty = getBaseSisaQty(item);
  return `<span style="color:#22c55e;font-weight:600">${qty}</span>`;
};

// ============================================================================
// HANDLER - Auto-fill display fields ketika PR dipilih via FieldPopup
// ============================================================================
const handlePRSelect = async (prData: any) => {
  if (prData) {
    selectedPR.value = prData;
    displayFields.diminta_oleh = prData.req_user_by || "-";
    displayFields.divisi_request =
      prData.m_unit_bisni?.nama_comp || prData.unit_bisnis_name || "-";
    displayFields.no_pr = prData.no_pr || "-";

    await ensureOutstandingDetails(prData.id);
    await fetchSisaPrData(prData.id);

    // Simpan t_purchase_order_id untuk filter getPoDetail
    selectedPOId.value = prData.t_purchase_order_id || "";

    // Auto-fetch PO details jika ada PO ID (hanya untuk mode create)
    if (!isEditMode.value && selectedPOId.value) {
      await fetchPODetails(selectedPOId.value);
    } else if (!isEditMode.value) {
      // Tidak ada PO → user bisa pilih item PR via ButtonMultiSelect
      detailItems.value = [];
    }
  } else {
    // Cleared
    selectedPR.value = null;
    displayFields.diminta_oleh = "-";
    displayFields.divisi_request = "-";
    displayFields.no_pr = "-";
    selectedPOId.value = "";
    detailItems.value = [];
    sisaPrData.value = [];
  }
};

// Fetch PO Details and auto-populate detail items
const fetchPODetails = async (poId: string) => {
  if (!poId) return;

  loadingPODetails.value = true;
  try {
    const response = await fetch(
      `${API_BASE_URL}/fn/t_purchase_order/getPoDetail?filter_column_t_purchase_order_id=${poId}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );

    const result = await response.json();

    if (result.status === "success" && result.data && result.data.length > 0) {
      const poData = result.data[0];
      const poDetails = poData.t_purchase_order_ds || [];

      // Auto-populate detail items
      detailItems.value = poDetails.map((item: any) => {
        const outst =
          selectedPR.value?.details_outstanding?.find(
            (d: any) => d.m_items_id === item.m_items_id,
          ) || {};
        return {
          t_purchase_order_d_id: item.id,
          t_purchase_request_d_id: item.t_purchase_request_d_id || null,
          m_items_id: item.m_items_id || null,
          kode_item: item.kode_item || "-",
          nama_item: item.nama_item || "-",
          qty_pr: outst.qty_pr !== undefined ? outst.qty_pr : item.qty_pr || 0,
          qty_po:
            outst.qty_po_total !== undefined
              ? outst.qty_po_total
              : item.qty_po || 0,
          qty_close: outst.qty_close_total || 0,
          qty_sisa:
            outst.qty_outstanding !== undefined
              ? outst.qty_outstanding
              : item.qty_pr || 0,
          qty_prc: 0, // User akan input manual
          uom: item.satuan || "-",
          catatan: "",
          created_by: authStore.user?.id || "",
        };
      });

      toast.success("Data PO berhasil dimuat", {
        description: `${poDetails.length} item ditemukan`,
      });
    } else {
      detailItems.value = [];
      toast.info("Tidak ada detail PO ditemukan");
    }
  } catch (error) {
    toast.error("Gagal memuat detail PO", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
    detailItems.value = [];
  } finally {
    loadingPODetails.value = false;
  }
};

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    no_preq_close: "",
    tgl_close: new Date().toISOString().split("T")[0],
    t_purchase_request_id: "",
    m_unit_bisnis_id: "",
    alasan: "",
    catatan: "",
    status: "DRAFT",
    created_by: authStore.user?.id || "",
  });

  // Reset display fields
  displayFields.diminta_oleh = "";
  displayFields.divisi_request = "";
  displayFields.no_pr = "";
  selectedPR.value = null;

  // Reset company name display
  selectedUnitBisnisCompanyName.value = "";

  // Reset selected PO ID dan detail items
  selectedPOId.value = "";
  detailItems.value = [];

  // Reset errors
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
      // ignore parse error
    }
  }

  // Check if copy mode via query param
  const isCopyModeLocal = route.query.action === "copy" && route.query.source;
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value;

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return;
  }

  loading.value = true;
  try {
    const res = await getTPurchaseRequestCloseById(sourceId);

    if (res.status !== "success") throw new Error("Gagal memuat data");
    initialValues = res.data;

    auditMeta.value = {
      created_by: initialValues.created_by,
      createdAt: initialValues.createdAt,
      updated_by: initialValues.update_by || initialValues.updated_by,
      updatedAt: initialValues.updatedAt,
    };

    // Mode copy: hapus id dan timestamps agar jadi create baru
    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
    }

    // Assign hanya key yang sudah ada di state reactive values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore dynamic assign
        values[key] = initialValues[key];
      }
    }

    // Super Admin: ambil nama company dari Unit Bisnis yang tersimpan
    if (isSuperAdmin.value && values.m_unit_bisnis_id) {
      fetchUnitBisnisCompanyName(values.m_unit_bisnis_id);
    }

    // Load display fields dari relasi PR
    if (initialValues.t_purchase_request) {
      const pr = initialValues.t_purchase_request;
      displayFields.diminta_oleh = pr.req_user_by || pr.prq_ctr?.name || "-";
      displayFields.divisi_request = pr.m_unit_bisni?.nama_comp || "-";
      displayFields.no_pr = pr.no_pr || "-";
      selectedPR.value = pr;

      // Load t_purchase_order_id untuk filter getPoDetail
      selectedPOId.value = pr.t_purchase_order_id || "";
    }

    // Load detail items - mapping sesuai response API
    if (initialValues.t_purchase_request_close_ds) {
      // Ambil t_purchase_request_ds untuk mapping qty_pr
      const prDetails =
        initialValues.t_purchase_request?.t_purchase_request_ds || [];

      detailItems.value = initialValues.t_purchase_request_close_ds.map(
        (d: any) => {
          const outst =
            initialValues.t_purchase_request?.details_outstanding?.find(
              (do_item: any) => do_item.m_items_id === d.m_items_id,
            ) || {};
          // Cari qty_pr dari t_purchase_request_ds berdasarkan m_items_id
          const prDetail = prDetails.find(
            (pr: any) => pr.m_items_id === d.m_items_id,
          );
          const qtyPrValue =
            outst.qty_pr !== undefined ? outst.qty_pr : prDetail?.qty_pr || 0;
          const qtyPoValue =
            outst.qty_po_total !== undefined
              ? outst.qty_po_total
              : d.t_purchase_order_d?.qty_po || 0;
          const qtySisaEdit =
            outst.qty_outstanding !== undefined
              ? Number(outst.qty_outstanding)
              : 0;

          return {
            ...d,
            t_purchase_request_d_id:
              d.t_purchase_request_d_id ||
              d.t_purchase_order_d?.t_purchase_request_d_id ||
              prDetail?.id ||
              null,
            // m_item adalah alias dari m_items, uom adalah alias dari m_general
            kode_item: d.m_item?.kode_item || "-",
            nama_item: d.m_item?.nama_item || "-",
            qty_pr: qtyPrValue, // Qty PR dari t_purchase_request_ds
            qty_po: qtyPoValue,
            qty_close: outst.qty_close_total || 0,
            qty_sisa: qtySisaEdit + (d.qty_prc || 0),
            qty_prc: d.qty_prc || 0, // Qty PR Closing yang sudah diinput user
            uom: d.m_item?.mi_uom?.value1 || "-",
          };
        },
      );
    }

    if (selectedPR.value?.id) {
      if (isEditMode.value || isViewMode.value || isCopyMode.value) {
        await fetchSisaPrData(selectedPR.value.id);
      }
      await ensureOutstandingDetails(selectedPR.value.id);
    }

    if (isCopyModeLocal) {
      values.no_preq_close = "";
      values.status = "DRAFT";
      values.tgl_close = new Date().toISOString().split("T")[0];
      toast.success("Data berhasil disalin", {
        description:
          "Silakan edit dan simpan sebagai Purchase Request Close baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Purchase Request Close", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () =>
          router.push("/purchasing/transaksi/t_purchase_request_close"),
      },
    });
    setTimeout(
      () => router.push("/purchasing/transaksi/t_purchase_request_close"),
      2000,
    );
  } finally {
    loading.value = false;
  }
});

// Errors object
const errors = reactive({
  t_purchase_request_id: "",
  alasan: "",
  m_unit_bisnis_id: "",
});

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });
  let invalid = false;

  if (!values.t_purchase_request_id?.trim()) {
    errors.t_purchase_request_id = "Purchase Request wajib dipilih";
    invalid = true;
  }
  if (!values.alasan?.trim()) {
    errors.alasan = "Alasan wajib diisi";
    invalid = true;
  }
  // Unit Bisnis required untuk Super Admin yang harus pilih
  if (isSuperAdmin.value && !values.m_unit_bisnis_id?.trim()) {
    errors.m_unit_bisnis_id = "Unit Bisnis wajib dipilih";
    invalid = true;
  }

  if (invalid) {
    toast.error("Validasi gagal", {
      description: "Mohon lengkapi semua field yang wajib diisi",
    });
    return;
  }

  // Validasi: semua item yg sudah dipilih harus memiliki Qty PR Closing > 0
  const zeroQtyItems = detailItems.value.filter(
    (item: any) => !item.qty_prc || Number(item.qty_prc) <= 0,
  );
  if (zeroQtyItems.length > 0) {
    const names = zeroQtyItems
      .map((item: any) => item.nama_item || item.kode_item || "Item")
      .join(", ");
    toast.error("Qty PR Closing tidak boleh 0", {
      description: `Item berikut belum diisi qty closing-nya: ${names}`,
    });
    return;
  }

  // HARD BLOCK: Check if any qty_prc exceeds sisa PR
  if (checkSisaPrExcess()) {
    isSisaPrErrorDialogOpen.value = true;
    return;
  }

  // SOFT WARNING: Check if any qty_prc exceeds qty_po/qty_pr
  if (checkQtyExcess()) {
    isQtyWarningDialogOpen.value = true;
    return;
  }

  // Check if Super Admin - show confirmation dialog first
  if (isSuperAdmin.value) {
    isSuperAdminDialogOpen.value = true;
    return;
  }

  // Continue with normal save flow
  await proceedWithSave();
};

// Proceed with save after Super Admin confirmation or for normal users
const proceedWithSave = async () => {
  loading.value = true;
  try {
    const payload: any = {
      t_purchase_request_id: values.t_purchase_request_id,
      tgl_close: values.tgl_close,
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      alasan: values.alasan?.trim() || null,
      catatan: values.catatan?.trim() || null,
      status: isSuperAdmin.value ? "APPROVED" : values.status || "DRAFT",
      no_preq_close: values.no_preq_close || null,
      created_by: authStore.user?.id || "",
      // updated_by hanya saat edit
      ...(isEditMode.value && { updated_by: authStore.user?.id || "" }),
      // Detail items
      t_purchase_request_close_ds: detailItems.value.map((item: any) => ({
        ...(item.id && { id: item.id }),
        t_purchase_order_d_id: item.t_purchase_order_d_id || null,
        t_purchase_request_d_id: item.t_purchase_request_d_id || null,
        m_items_id: item.m_items_id,
        qty_prc: item.qty_prc || 0,
        catatan: item.catatan || null,
        created_by: item.created_by || authStore.user?.id || "",
        ...(isEditMode.value && { updated_by: authStore.user?.id || "" }),
      })),
    };

    let savedId: string | undefined;

    if (isEditMode.value) {
      await updateTPurchaseRequestClose(menuId.value, payload as any);
      savedId = menuId.value;
      toast.success("Purchase Request Close berhasil diperbarui", {
        description: `Data telah diperbarui`,
      });
    } else {
      const res = await createTPurchaseRequestClose(payload as any);
      savedId = (res as any)?.data?.id;
      toast.success("Purchase Request Close berhasil dibuat", {
        description: `Data telah ditambahkan`,
      });
    }

    // Jika Super Admin: panggil fn approve dengan level tertinggi
    if (isSuperAdmin.value && savedId) {
      try {
        const allApprovals = authStore
          .getApprovalList()
          .filter(
            (a: any) =>
              a.path === "/purchasing/transaksi/t_purchase_request_close",
          );
        const maxLevel =
          allApprovals.length > 0
            ? Math.max(...allApprovals.map((a: any) => a.level ?? 0))
            : 1;
        await approveTPurchaseRequestClose(
          savedId,
          null,
          maxLevel,
          "Auto approved by Super Admin",
        );
      } catch (approvalErr) {
        console.warn("Failed to call PR Close approve endpoint:", approvalErr);
      }
    }

    router.replace(
      "/purchasing/transaksi/t_purchase_request_close?reload=" + Date.now(),
    );
  } catch (error) {
    toast.error(isEditMode.value ? "Gagal memperbarui" : "Gagal membuat", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    loading.value = false;
  }
};

// ============================================================================
// SUPER ADMIN DIALOG HANDLERS
// ============================================================================
const confirmSuperAdminSave = async () => {
  isSuperAdminDialogOpen.value = false;
  await proceedWithSave();
};

const cancelSuperAdminSave = () => {
  isSuperAdminDialogOpen.value = false;
};

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push("/purchasing/transaksi/t_purchase_request_close");
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
      <Card>
        <CardHeader>
          <CardTitle>Informasi Purchase Request Close</CardTitle>
          <CardDescription>
            Isi data Purchase Request Close dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 3 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Unit Bisnis - Super Admin: Select, User Biasa: Auto dari auth -->
            <FieldSelect
              v-if="isSuperAdmin"
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              v-model="values.m_unit_bisnis_id"
              :errorname="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id || 'Pilih unit bisnis'"
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
                  searchfield: 'nama_comp',
                  filter_column_is_active: 'true',
                  join: 'true',
                },
              }"
              valueField="id"
              displayField="nama_comp"
              placeholder="Pilih unit bisnis"
              :clearable="true"
              @update:value-full="
                (item) => {
                  handleUnitBisnisSelected(item);
                  values.t_purchase_request_id = '';
                  displayFields.no_pr = '';
                  displayFields.diminta_oleh = '';
                  displayFields.divisi_request = '';
                  selectedPR = null;
                  detailItems = [];
                  sisaPrData = [];
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

            <!-- Tanggal Close (Readonly - hari ini) -->
            <FieldDate
              id="tgl_close"
              label="Tanggal Close"
              v-model="values.tgl_close"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Tanggal hari ini"
              hints="Tanggal close otomatis hari ini"
            />

            <!-- No Purchase Request Close (Auto Generated - Readonly) -->
            <FieldX
              id="no_preq_close"
              label="No Purchase Request Close"
              v-model="values.no_preq_close"
              :disabled="true"
              :readonly="true"
              placeholder="Auto generate"
              hints="Nomor akan digenerate otomatis oleh sistem"
            />

            <!-- Status (readonly, default DRAFT) -->
            <FieldX
              id="status"
              label="Status"
              :value="values.status"
              :disabled="true"
              :readonly="true"
              placeholder="Status"
              hints="Status akan otomatis berubah sesuai proses"
            />

            <!-- Purchase Request (Popup - Filter status APPROVED) -->
            <FieldPopup
              id="t_purchase_request_id"
              label="Purchase Request"
              :value="values.t_purchase_request_id"
              :displayValue="displayFields.no_pr"
              :disable="values.m_unit_bisnis_id || ''"
              @input="
                (v: string) => {
                  values.t_purchase_request_id = v;
                  errors.t_purchase_request_id = '';
                  if (!v) displayFields.no_pr = '';
                }
              "
              @update:valueFull="handlePRSelect"
              :errorText="errors.t_purchase_request_id ? 'failed' : ''"
              :hints="
                errors.t_purchase_request_id ||
                (!values.m_unit_bisnis_id
                  ? 'Pilih Unit Bisnis terlebih dahulu'
                  : 'Pilih Purchase Request yang akan di-close')
              "
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || !values.m_unit_bisnis_id"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              placeholder="Pilih Purchase Request"
              displayField="no_pr"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/fn/t_purchase_request/getPROutstandingList`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'no_pr,catatan',
                  order_by: 'createdAt',
                  order_type: 'DESC',
                  paginate: 20,
                  filter_column_m_unit_bisnis_id:
                    values.m_unit_bisnis_id || 'UNKNOWN_UB',
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
                  field: 'no_pr',
                  headerName: 'No PR',
                  width: '160px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'm_unit_bisni.nama_comp',
                  headerName: 'Company',
                  width: '150px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                  render: (item: any) => item.m_unit_bisni?.nama_comp || '-',
                },
                {
                  field: 'tgl_pr',
                  headerName: 'Tanggal PR',
                  width: '110px',
                  sortable: true,
                  filterable: false,
                },
                {
                  field: 'req_user_by',
                  headerName: 'Diminta Oleh',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'status',
                  headerName: 'Status',
                  width: '100px',
                  sortable: true,
                  filterable: false,
                },
              ]"
            />

            <!-- Diminta Oleh (Auto field dari PR) -->
            <FieldX
              id="diminta_oleh"
              label="Diminta Oleh"
              :value="displayFields.diminta_oleh || '-'"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              hints="Auto dari Purchase Request yang dipilih"
            />

            <!-- Divisi yang Request (Auto field dari PR) -->
            <FieldX
              id="divisi_request"
              label="Company/Divisi Request"
              :value="displayFields.divisi_request || '-'"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              hints="Auto dari Purchase Request yang dipilih"
            />

            <!-- Alasan (Required) -->
            <FieldX
              id="alasan"
              label="Alasan"
              v-model="values.alasan"
              :errorname="errors.alasan ? 'failed' : ''"
              :hints="errors.alasan || 'Masukkan alasan close'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Masukkan alasan close"
            />

            <!-- Catatan (Optional - spanning 2 columns) -->
            <div class="md:col-span-2">
              <FieldTextarea
                id="catatan"
                label="Catatan"
                v-model="values.catatan"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="Catatan tambahan (opsional)"
                :rows="3"
                hints="Catatan tambahan untuk Purchase Request Close ini"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- ================================================================ -->
      <!-- DETAIL ITEMS CARD -->
      <!-- ================================================================ -->
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <div>
              <CardTitle>Detail Items PR Closing</CardTitle>
              <CardDescription>
                Item dari Purchase Order akan otomatis dimuat jika PR sudah
                memiliki PO. Jika belum ada PO, pilih item dari PR.
              </CardDescription>
            </div>
            <ButtonMultiSelect
              v-if="
                !isReadOnly && values.t_purchase_request_id && !selectedPOId
              "
              :key="`btn-pr-close-${values.t_purchase_request_id}`"
              title="Pilih Item PR"
              :excludeIds="excludedPRDetailIds"
              @add="
                (items: any[]) => {
                  items.forEach((item) => {
                    const itemObj = item.m_item || item.m_items || {};
                    const outst =
                      selectedPR?.details_outstanding?.find(
                        (d: any) => d.m_items_id === item.m_items_id,
                      ) || {};
                    if (
                      !detailItems.find(
                        (d: any) => d.t_purchase_request_d_id === item.id,
                      )
                    ) {
                      detailItems.push({
                        t_purchase_request_d_id: item.id,
                        m_items_id: item.m_items_id,
                        kode_item: itemObj.kode_item || '-',
                        nama_item: itemObj.nama_item || '-',
                        qty_pr:
                          outst.qty_pr !== undefined
                            ? outst.qty_pr
                            : item.qty_pr || 0,
                        qty_po:
                          outst.qty_po_total !== undefined
                            ? outst.qty_po_total
                            : 0,
                        qty_close: outst.qty_close_total || 0,
                        qty_sisa: getBaseSisaQty(item),
                        qty_prc: 0,
                        uom:
                          itemObj.mi_uom?.value1 ||
                          itemObj.m_general?.value1 ||
                          '-',
                        catatan: '',
                        created_by: authStore.user?.id || '',
                      });
                    }
                  });
                }
              "
              :api="{
                url: `${API_BASE_URL}/dynamic/t_purchase_request_d`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  filter_column_t_purchase_request_id:
                    values.t_purchase_request_id,
                  include: 'm_items:id|kode_item|nama_item>m_general:id|value1',
                  no_pagination: 'true',
                  searchfield: 'm_item.nama_item,m_item.kode_item',
                },
                onsuccess: (response: any) => {
                  response.hasNext = !!response.pagination?.next_page;

                  if (response.data && Array.isArray(response.data)) {
                    response.data = response.data.filter((item: any) => {
                      const sisaQty = getBaseSisaQty(item);
                      return sisaQty > 0;
                    });
                  }

                  return response;
                },
              }"
              :columns="[
                {
                  key: 'm_item.kode_item',
                  label: 'Kode Item',
                  width: '130px',
                  render: (item: any) => item.m_item?.kode_item || '-',
                },
                {
                  key: 'm_item.nama_item',
                  label: 'Nama Item',
                  width: '200px',
                  render: (item: any) => item.m_item?.nama_item || '-',
                },
                { key: 'qty_pr', label: 'Qty PR', width: '100px' },
                {
                  key: 'qty_sisa',
                  label: 'Qty Sisa',
                  width: '100px',
                  renderHtml: (item: any) => renderSisaPrcHtml(item),
                },
                {
                  key: 'm_item.mi_uom.value1',
                  label: 'Satuan',
                  width: '80px',
                  render: (item: any) => item.m_item?.mi_uom?.value1 || '-',
                },
              ]"
              :disabled="loading"
            />
          </div>
        </CardHeader>
        <CardContent>
          <!-- Loading state -->
          <div
            v-if="loadingPODetails"
            class="text-center py-8 text-muted-foreground"
          >
            <Loader2 class="h-6 w-6 animate-spin mx-auto mb-2" />
            <p>Memuat detail Purchase Order...</p>
          </div>

          <!-- Message jika belum pilih PR -->
          <div
            v-else-if="!values.t_purchase_request_id"
            class="text-center py-8 text-muted-foreground"
          >
            Pilih Purchase Request terlebih dahulu untuk melihat item yang
            tersedia
          </div>

          <!-- Table Detail Items -->
          <div v-else class="border rounded-lg overflow-x-auto">
            <Table class="table-fixed w-full">
              <TableHeader>
                <TableRow class="bg-muted">
                  <TableHead class="w-[50px] text-center">No</TableHead>
                  <TableHead class="w-[120px]">Kode</TableHead>
                  <TableHead class="w-[200px]">Nama Item</TableHead>
                  <TableHead class="w-20 text-right">Qty PR</TableHead>
                  <TableHead class="w-24 text-right">Qty Sisa</TableHead>
                  <TableHead class="w-[100px] text-center"
                    >Qty PR Closing</TableHead
                  >
                  <TableHead class="w-[70px] text-center">Satuan</TableHead>
                  <TableHead class="w-[150px]">Catatan</TableHead>
                  <TableHead v-if="!isReadOnly" class="w-[50px] text-center"
                    >Aksi</TableHead
                  >
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="detailItems.length === 0">
                  <TableCell
                    :colspan="detailColspan"
                    class="text-center py-8 text-muted-foreground"
                  >
                    Tidak ada detail item. Item akan otomatis dimuat setelah
                    memilih Purchase Request.
                  </TableCell>
                </TableRow>
                <TableRow
                  v-for="(detail, idx) in detailItems"
                  :key="detail.t_purchase_order_d_id || idx"
                  class="hover:bg-muted/50"
                >
                  <TableCell class="text-center">{{ idx + 1 }}</TableCell>
                  <TableCell>{{ detail.kode_item }}</TableCell>
                  <TableCell>{{ detail.nama_item }}</TableCell>
                  <TableCell class="text-right">{{ detail.qty_pr }}</TableCell>
                  <TableCell class="text-right">{{
                    getDisplaySisaQty(detail)
                  }}</TableCell>
                  <TableCell class="text-center">
                    <FieldNumber
                      v-if="!isReadOnly"
                      :id="`qty_prc_${idx}`"
                      :modelValue="detail.qty_prc"
                      @update:modelValue="
                        (val: string | number) =>
                          handleQtyPrcChange(detail, val, idx)
                      "
                      :min="1"
                      :max="getBaseSisaQty(detail)"
                      placeholder="0"
                      class="w-24 mx-auto"
                    />
                    <span v-else>{{ detail.qty_prc }}</span>
                  </TableCell>
                  <TableCell class="text-center">{{ detail.uom }}</TableCell>
                  <TableCell>
                    <FieldX
                      v-if="!isReadOnly"
                      :id="`catatan_detail_${idx}`"
                      v-model="detail.catatan"
                      placeholder="Catatan"
                      class="w-full"
                    />
                    <span v-else>{{ detail.catatan || "-" }}</span>
                  </TableCell>
                  <TableCell v-if="!isReadOnly" class="text-center">
                    <DeleteButton
                      variant="ghost"
                      size="sm"
                      @click="removeDetailItem(idx)"
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
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
    <!-- QTY EXCESS WARNING DIALOG -->
    <!-- ================================================================ -->
    <Dialog
      :open="isQtyWarningDialogOpen"
      @update:open="isQtyWarningDialogOpen = $event"
    >
      <DialogContent class="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <span class="text-yellow-600">⚠️</span>
            Peringatan: Qty PR Closing Melebihi Qty Maksimum
          </DialogTitle>
          <DialogDescription>
            Beberapa item memiliki Qty PR Closing yang melebihi Qty maksimum
            (Qty PO atau Qty PR). Data tetap dapat disimpan, namun mohon periksa
            kembali.
          </DialogDescription>
        </DialogHeader>

        <div class="py-4 space-y-4">
          <div
            class="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
          >
            <p
              class="text-sm text-yellow-800 dark:text-yellow-200 font-semibold mb-2"
            >
              ⚠️ Item dengan Qty PR Closing > Qty Maksimum:
            </p>
            <div class="mt-3 border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow class="bg-yellow-100 dark:bg-yellow-900/30">
                    <TableHead class="w-[50px]">No</TableHead>
                    <TableHead class="w-[140px]">Kode Item</TableHead>
                    <TableHead>Nama Item</TableHead>
                    <TableHead class="text-right w-[100px]">Qty Maks</TableHead>
                    <TableHead class="text-right w-[120px]"
                      >Qty PR Closing</TableHead
                    >
                    <TableHead class="text-right w-[100px]">Selisih</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="(item, idx) in itemsWithExcessQty"
                    :key="idx"
                    class="hover:bg-yellow-50/50 dark:hover:bg-yellow-900/10"
                  >
                    <TableCell class="font-medium">{{ idx + 1 }}</TableCell>
                    <TableCell>{{ item.kode_item }}</TableCell>
                    <TableCell>{{ item.nama_item }}</TableCell>
                    <TableCell class="text-right">{{
                      getMaxQty(item)
                    }}</TableCell>
                    <TableCell
                      class="text-right font-semibold text-yellow-700 dark:text-yellow-400"
                    >
                      {{ item.qty_prc }}
                    </TableCell>
                    <TableCell
                      class="text-right font-semibold text-red-600 dark:text-red-400"
                    >
                      +{{ item.qty_prc - getMaxQty(item) }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div
            class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
          >
            <p class="text-sm text-blue-800 dark:text-blue-200">
              <strong>Catatan:</strong> Qty PR Closing yang melebihi Qty PO
              dapat mengindikasikan:
            </p>
            <ul
              class="list-disc list-inside space-y-1 ml-2 mt-2 text-sm text-blue-700 dark:text-blue-300"
            >
              <li>Ada kesalahan input data</li>
              <li>Qty PO perlu direvisi</li>
              <li>Perlu koordinasi dengan bagian Purchasing</li>
            </ul>
          </div>
        </div>

        <DialogFooter class="gap-2">
          <Button
            variant="outline"
            @click="cancelQtyExcess"
            :disabled="loading"
          >
            Batal & Perbaiki
          </Button>
          <Button
            variant="default"
            @click="confirmQtyExcess"
            :disabled="loading"
            class="gap-2 bg-yellow-600 hover:bg-yellow-700"
          >
            <Save class="h-4 w-4" />
            <span>{{ loading ? "Menyimpan..." : "Ya, Tetap Simpan" }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

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

    <!-- ================================================================ -->
    <!-- SISA PR EXCESS ERROR DIALOG (HARD BLOCK) -->
    <!-- ================================================================ -->
    <Dialog
      :open="isSisaPrErrorDialogOpen"
      @update:open="isSisaPrErrorDialogOpen = $event"
    >
      <DialogContent class="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <span class="text-red-600">🚫</span>
            Qty PR Closing Melebihi Sisa PR
          </DialogTitle>
          <DialogDescription>
            Beberapa item memiliki Qty PR Closing yang melebihi sisa PR yang
            tersedia. Perbaiki terlebih dahulu sebelum menyimpan.
          </DialogDescription>
        </DialogHeader>

        <div class="py-4 space-y-4">
          <div
            class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          >
            <p
              class="text-sm text-red-800 dark:text-red-200 font-semibold mb-2"
            >
              🚫 Item dengan Qty PR Closing > Sisa PR:
            </p>
            <div class="mt-3 border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow class="bg-red-100 dark:bg-red-900/30">
                    <TableHead class="w-[50px]">No</TableHead>
                    <TableHead class="w-[140px]">Kode Item</TableHead>
                    <TableHead>Nama Item</TableHead>
                    <TableHead class="text-right w-[100px]">Sisa PR</TableHead>
                    <TableHead class="text-right w-[120px]"
                      >Qty PR Closing</TableHead
                    >
                    <TableHead class="text-right w-[100px]"
                      >Kelebihan</TableHead
                    >
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="(item, idx) in itemsExceedSisaPr"
                    :key="idx"
                    class="hover:bg-red-50/50 dark:hover:bg-red-900/10"
                  >
                    <TableCell class="font-medium">{{ idx + 1 }}</TableCell>
                    <TableCell>{{ item.kode_item }}</TableCell>
                    <TableCell>{{ item.nama_item }}</TableCell>
                    <TableCell class="text-right">{{ item.sisa_pr }}</TableCell>
                    <TableCell
                      class="text-right font-semibold text-red-700 dark:text-red-400"
                    >
                      {{ item.qty_prc }}
                    </TableCell>
                    <TableCell
                      class="text-right font-semibold text-red-600 dark:text-red-400"
                    >
                      +{{ item.selisih }}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          <div
            class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
          >
            <p class="text-sm text-blue-800 dark:text-blue-200">
              <strong>Keterangan:</strong> Sisa PR dihitung dari:
            </p>
            <p class="text-sm text-blue-700 dark:text-blue-300 mt-1 ml-2">
              Sisa PR = Qty PR − Qty PO Approved − Qty yang sudah di-Close
              sebelumnya
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="default" @click="isSisaPrErrorDialogOpen = false">
            Mengerti, Perbaiki Data
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
