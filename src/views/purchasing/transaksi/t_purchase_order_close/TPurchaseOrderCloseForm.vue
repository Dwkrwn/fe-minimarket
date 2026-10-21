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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FieldX, FieldNumber, FieldPopup, FieldDate, FieldSelect } from "@/components/field";
import { ButtonMultiSelect, DeleteButton } from "@/components/button";
import { ArrowLeft, Save, Loader2 } from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createTPurchaseOrderClose,
  updateTPurchaseOrderClose,
  getTPurchaseOrderCloseById,
  getPoOutstanding,
  getPoDetailSisa,
  approveTPurchaseOrderClose,
  type TPurchaseOrderCloseDetail,
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
  () => !!route.params.id && route.name === "TPurchaseOrderCloseForm",
);
const isViewMode = computed(() => route.name === "TPurchaseOrderCloseView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Purchase Order Close";
  if (isCopyMode.value) return "Salin Purchase Order Close";
  if (isEditMode.value) return "Edit Purchase Order Close";
  return "Tambah Purchase Order Close Baru";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Purchase Order Close";
  if (isCopyMode.value)
    return "Buat Purchase Order Close baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Purchase Order Close";
  return "Buat Purchase Order Close baru";
});

// Super Admin check
const isSuperAdmin = computed(() => {
  const user = authStore.user as any;
  return user?.tipe?.value1?.toUpperCase() === "SUPER ADMIN";
});

// Super Admin dialog state
const isSuperAdminDialogOpen = ref(false);

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
  no_po_close: "",
  tgl_po_close: new Date().toISOString().split("T")[0],
  status: "DRAFT",
  m_unit_bisnis_id: "",
  t_purchase_order_id: "",
  alasan: "",
  catatan: "",
  created_by: authStore.user?.id || "",
});

// Display values dari relasi
const supplierName = ref("");
const noPO = ref("");
const selectedPOId = ref(""); // ID PO yang dipilih untuk ButtonMultiSelect

// Temp data
let initialValues: Record<string, any> = {};

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

// Detail arrays
const detailItems = ref<TPurchaseOrderCloseDetail[]>([]);

// Detail validation errors - track per item index
const detailErrors = reactive<Record<number, { qtyClose?: string }>>({});

// Validate qty_close - warning if 0, error if > max
const validateQtyClose = (index: number, value: number, maxQty: number) => {
  if (!detailErrors[index]) {
    detailErrors[index] = {};
  }

  if (value === 0) {
    detailErrors[index].qtyClose = "Qty Close tidak boleh 0";
  } else if (value < 0) {
    detailErrors[index].qtyClose = "Qty Close tidak boleh negatif";
  } else if (value > maxQty) {
    detailErrors[index].qtyClose = `Qty Close tidak boleh melebihi Qty Sisa (${maxQty})`;
  } else {
    detailErrors[index].qtyClose = undefined;
  }
};

// ============================================================================
// WATCH - Auto clamp qty_close to not exceed qty_sisa
// ============================================================================
watch(
  detailItems,
  (items) => {
    items.forEach((item) => {
      const qtyClose = item.qty_close || 0;
      const qtySisa = item.qty_sisa ?? item.qty_po ?? 0;
      if (qtyClose < 0) {
        item.qty_close = 0;
      }
      if (qtySisa > 0 && qtyClose > qtySisa) {
        item.qty_close = qtySisa;
      }
    });
  },
  { deep: true },
);

// ============================================================================
// COMPUTED API CONFIG FOR PO SELECTION
// ============================================================================
const poSelectionApiConfig = computed(() => {
  const params: Record<string, any> = {
    searchfield: "no_po",
  };

  if (values.m_unit_bisnis_id && values.m_unit_bisnis_id.trim() !== "") {
    params["filter_column_t_purchase_order.m_unit_bisnis_id"] =
      values.m_unit_bisnis_id;
  }

  return {
    url: `${API_BASE_URL}/fn/t_purchase_order/getPoOutstanding`,
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

// Computed: API config for ButtonMultiSelect — uses GetDetail endpoint
const detailItemsApiConfig = computed(() => ({
  url: `${API_BASE_URL}/fn/t_purchase_order_d/GetDetail`,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authStore.token}`,
  },
  params: {
    filter_column_t_purchase_order_id: selectedPOId.value,
    page: 1,
    paginate: 50,
  },
  onsuccess: (response: any) => {
    response.hasNext = response.pagination?.next_page ? true : false;
    return response;
  },
}));

// Handle adding detail items — qty_sisa comes from GetDetail API response
const handleAddDetailItems = (items: any[]) => {
  items.forEach((item) => {
    if (
      !detailItems.value.find((d: any) => d.t_purchase_order_d_id === item.id)
    ) {
      const itemObj = item.m_item || item.m_items || {};
      const newIndex = detailItems.value.length;
      detailItems.value.push({
        t_purchase_order_d_id: item.id,
        m_items_id: item.m_items_id,
        qty_close: 0,
        qty_sisa: item.qty_sisa || 0,
        catatan: "",
        kode_item: itemObj.kode_item || "-",
        nama_item: itemObj.nama_item || "-",
        qty_po: item.qty_po || 0,
        satuan:
          itemObj.uom?.value1 ||
          itemObj.mi_uom?.value1 ||
          itemObj.m_general?.value1 ||
          "-",
      });
      // Validate initial 0 value
      const maxQty = (item.qty_sisa ?? item.qty_po ?? 0);
      validateQtyClose(newIndex, 0, maxQty);
    }
  });
};

// ============================================================================
// DETAIL METHODS
// ============================================================================
const removeDetailItem = (index: number) => {
  detailItems.value.splice(index, 1);
  // Clean up error for removed index
  delete detailErrors[index];
  toast.info("Detail item dihapus");
};

// ============================================================================
// HANDLERS
// ============================================================================
// Handle PO select from FieldPopup - Load PO details
const handlePOSelect = async (po: any) => {
  if (po) {
    noPO.value = po.no_po || "";
    supplierName.value = po.m_supplier?.nama_supp || po.supplier || "";
    selectedPOId.value = po.id || ""; // Simpan ID PO ke ref

    // Clear detail items when PO changes
    if (detailItems.value.length > 0) {
      detailItems.value = [];
      toast.info("Detail item direset karena PO berubah");
    }
  } else {
    noPO.value = "";
    supplierName.value = "";
    selectedPOId.value = "";
    detailItems.value = [];
  }
};

// Handle company select
const handleCompanySelect = (company: any) => {
  if (company) {
    // Clear PO when company changes
    if (values.t_purchase_order_id) {
      values.t_purchase_order_id = "";
      noPO.value = "";
      supplierName.value = "";
      selectedPOId.value = "";
      detailItems.value = [];
      toast.info("PO dan detail direset karena unit bisnis berubah");
    }
  }
};

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    no_po_close: "",
    tgl_po_close: new Date().toISOString().split("T")[0],
    status: "DRAFT",
    m_unit_bisnis_id: "",
    t_purchase_order_id: "",
    alasan: "",
    catatan: "",
    created_by: authStore.user?.id || "",
  });

  supplierName.value = "";
  noPO.value = "";
  selectedPOId.value = "";
  detailItems.value = [];

  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });

  // Reset detail errors
  Object.keys(detailErrors).forEach((key) => {
    delete detailErrors[Number(key)];
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
    return;
  }

  loading.value = true;
  try {
    const res = await getTPurchaseOrderCloseById(sourceId);

    if (res.status !== "success") throw new Error("Gagal memuat data");
    initialValues = res.data;

    auditMeta.value = {
      created_by: initialValues.created_by || initialValues.createdBy || null,
      createdAt: initialValues.createdAt || null,
      updated_by: initialValues.updated_by || initialValues.update_by || initialValues.edited_by || null,
      updatedAt: initialValues.updatedAt || null,
    };

    // Load detail items - handle both singular and plural
    const detailData =
      initialValues.t_purchase_order_close_ds ||
      initialValues.t_purchase_order_close_d;
    if (detailData && Array.isArray(detailData)) {
      detailItems.value = detailData.map((d: any) => ({
        id: d.id,
        t_purchase_order_close_id: d.t_purchase_order_close_id,
        t_purchase_order_d_id: d.t_purchase_order_d_id || d.t_purchase_order_d,
        m_items_id: d.m_items_id,
        qty_close: d.qty_close || 0,
        qty_sisa: d.qty_sisa || 0,
        catatan: d.catatan || "",
        // Display fields from relations
        kode_item:
          d.m_items?.kode_item || d.m_item?.kode_item || d.kode_item || "-",
        nama_item:
          d.m_items?.nama_item || d.m_item?.nama_item || d.nama_item || "-",
        qty_po: d.t_purchase_order_d?.qty_po || d.qty_po || 0,
        satuan:
          d.m_items?.mi_uom?.value1 ||
          d.m_item?.mi_uom?.value1 ||
          d.m_items?.m_general?.value1 ||
          d.m_item?.m_general?.value1 ||
          d.satuan ||
          "-",
      }));

      // Fetch qty_sisa terkini dari GetDetail API untuk setiap item
      const fetchSisaPromises = detailItems.value.map(async (item, index) => {
        if (item.t_purchase_order_d_id) {
          const detailFromAPI = await getPoDetailSisa(
            item.t_purchase_order_d_id,
          );
          if (detailFromAPI && detailItems.value[index]) {
            detailItems.value[index]!.qty_sisa = detailFromAPI.qty_sisa ?? 0;
            if (!detailItems.value[index]!.qty_po) {
              detailItems.value[index]!.qty_po = detailFromAPI.qty_po || 0;
            }
          }
        }
      });
      await Promise.all(fetchSisaPromises);
    }

    // Load supplier and PO info from relation
    if (initialValues.t_purchase_order) {
      noPO.value = initialValues.t_purchase_order.no_po || "";
      selectedPOId.value =
        initialValues.t_purchase_order.id ||
        initialValues.t_purchase_order_id ||
        "";
      if (initialValues.t_purchase_order.m_supplier) {
        supplierName.value =
          initialValues.t_purchase_order.m_supplier.nama_supp || "";
      }
    } else if (initialValues.t_purchase_order_id) {
      // Fallback jika relasi tidak di-load
      selectedPOId.value = initialValues.t_purchase_order_id;
    }

    // Mode copy
    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
      delete (initialValues as any).no_po_close;
      // Reset generated and audit fields for copied data.
      initialValues.status = "DRAFT";
      initialValues.created_by = authStore.user?.id || "";

      // Clear detail IDs for copy
      detailItems.value = detailItems.value.map((item) => ({
        ...item,
        id: undefined,
        t_purchase_order_close_id: undefined,
      }));
    }

    // Check if trying to edit an APPROVED item - redirect to view
    if (
      isEditMode.value &&
      (initialValues.status === "APPROVED" ||
        initialValues.status === "IN APPROVAL")
    ) {
      toast.error("Tidak dapat mengedit", {
        description: `Data dengan status ${initialValues.status} tidak bisa diedit. Membuka halaman view...`,
      });
      setTimeout(
        () =>
          router.replace(
            `/purchasing/transaksi/t_purchase_order_close/view/${menuId.value}`,
          ),
        1500,
      );
      return;
    }

    // Assign values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        (values as any)[key] = initialValues[key];
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
        description: "Silakan edit dan simpan sebagai PO Close baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data PO Close", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () =>
          router.push("/purchasing/transaksi/t_purchase_order_close"),
      },
    });
    setTimeout(
      () => router.push("/purchasing/transaksi/t_purchase_order_close"),
      2000,
    );
  } finally {
    loading.value = false;
  }
});

// Errors object
const errors = reactive({
  m_unit_bisnis_id: "",
  t_purchase_order_id: "",
  alasan: "",
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

  if (!values.t_purchase_order_id?.trim()) {
    errors.t_purchase_order_id = "Purchase Order wajib dipilih";
    invalid = true;
  }
  if (!values.alasan?.trim()) {
    errors.alasan = "Alasan wajib diisi";
    invalid = true;
  }

  const emptyQtyCloseItems = detailItems.value.filter(
    (item) => Number(item.qty_close || 0) <= 0,
  );
  if (emptyQtyCloseItems.length > 0) {
    const itemNames = emptyQtyCloseItems
      .map((item) => `${item.kode_item} (${item.nama_item})`)
      .join("\n• ");
    invalid = true;
    toast.error("❌ Validasi Qty Close Gagal", {
      description: `Qty Close wajib lebih dari 0 pada item:\n• ${itemNames}`,
    });
    return;
  }

  // Validasi qty_close tidak boleh melebihi qty_sisa
  const invalidQtyItems = detailItems.value.filter(
    (item) => (item.qty_close || 0) > (item.qty_sisa ?? item.qty_po ?? 0),
  );
  if (invalidQtyItems.length > 0) {
    const itemNames = invalidQtyItems.map((item) => item.kode_item).join(", ");
    toast.error("Validasi gagal", {
      description: `Qty Close tidak boleh melebihi Qty Sisa pada item: ${itemNames}`,
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
    const currentUserId = authStore.user?.id || null;

    // Helper: Convert empty string to null for UUID fields
    const toNullIfEmpty = (value: string | null | undefined): string | null => {
      return value && value.trim() !== "" ? value : null;
    };

    // Super Admin: status langsung APPROVED
    const payload: any = {
      ...values,
      status: isSuperAdmin.value ? "APPROVED" : values.status || "DRAFT",
      m_unit_bisnis_id: toNullIfEmpty(values.m_unit_bisnis_id),
      t_purchase_order_id: toNullIfEmpty(values.t_purchase_order_id),
      tgl_po_close: values.tgl_po_close || null,
      alasan: values.alasan?.trim() || null,
      catatan: values.catatan?.trim() || null,
      ...(isEditMode.value
        ? { updated_by: currentUserId, edited_by: currentUserId }
        : { created_by: currentUserId, updated_by: currentUserId, edited_by: currentUserId }),
      t_purchase_order_close_ds: detailItems.value.map((item) => {
        return {
          ...(item.id && { id: item.id }),
          m_items_id: toNullIfEmpty(item.m_items_id),
          t_purchase_order_d_id: toNullIfEmpty(item.t_purchase_order_d_id),
          qty_close: item.qty_close || 0,
          catatan: item.catatan?.trim() || null,
        };
      }),
    };

    // Remove fields that auto-generated by system
    delete payload.no_po_close;

    let savedId: string | undefined;

    if (isEditMode.value) {
      await updateTPurchaseOrderClose(menuId.value, payload);
      savedId = menuId.value;
      toast.success("PO Close berhasil diperbarui", {
        description: `PO Close ${values.no_po_close || ""} telah diperbarui`,
      });
    } else {
      const res = await createTPurchaseOrderClose(payload);
      savedId = (res as any)?.data?.id;
      toast.success("PO Close berhasil dibuat", {
        description: "PO Close baru telah ditambahkan",
      });
    }

    // Jika Super Admin: panggil fn approve dengan level tertinggi
    if (isSuperAdmin.value && savedId) {
      try {
        const allApprovals = authStore
          .getApprovalList()
          .filter(
            (a: any) =>
              a.path === "/purchasing/transaksi/t_purchase_order_close",
          );
        const maxLevel =
          allApprovals.length > 0
            ? Math.max(...allApprovals.map((a: any) => a.level ?? 0))
            : 1;
        await approveTPurchaseOrderClose(
          savedId,
          null,
          maxLevel,
          "Auto approved by Super Admin",
        );
      } catch (approvalErr) {
        console.warn("Failed to call PO Close approve endpoint:", approvalErr);
      }
    }
    router.replace(
      "/purchasing/transaksi/t_purchase_order_close?reload=" + Date.now(),
    );
  } catch (error) {
    toast.error(
      isEditMode.value
        ? "Gagal memperbarui PO Close"
        : "Gagal membuat PO Close",
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
  router.push("/purchasing/transaksi/t_purchase_order_close");
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
          <CardTitle>Informasi Purchase Order Close</CardTitle>
          <CardDescription>
            Isi data PO Close dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <!-- Grid 2 Columns for Desktop (LEFT & RIGHT) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <!-- ============ LEFT COLUMN ============ -->
            <!-- Company / Unit Bisnis Field -->
            <FieldSelect
              v-if="isSuperAdmin"
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              v-model="values.m_unit_bisnis_id"
              :errorText="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih Unit Bisnis"
              displayField="nama_comp"
              valueField="id"
              :clearable="!isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'nama_comp,kode_comp',
                  filter_column_is_active: true,
                  no_pagination: 'true',
                },
              }"
              @update:valueFull="handleCompanySelect"
            />
            <!-- Display company name for non-super admin -->
            <FieldX
              v-else
              id="company_display"
              label="Unit Bisnis"
              :value="companyNameDisplay"
              disabled
              readonly
              placeholder="Unit Bisnis"
            />

            <!-- ============ RIGHT COLUMN ============ -->
            <!-- Status Field (FieldX readonly) -->
            <FieldX
              id="status"
              label="Status"
              :value="values.status || 'DRAFT'"
              disabled
              readonly
            />

            <!-- ============ LEFT COLUMN ============ -->
            <!-- No. PO Close Field - Auto Generate -->
            <FieldX
              id="no_po_close"
              label="No. PO Closing"
              :value="values.no_po_close || ''"
              disabled
              readonly
              placeholder="Auto generate by system"
            />

            <!-- ============ RIGHT COLUMN ============ -->
            <!-- Tanggal PO Close -->
            <FieldDate
              id="tgl_po_close"
              label="Tgl. PO Closing"
              v-model="values.tgl_po_close"
               :required="!isReadOnly"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
              placeholder="Tanggal hari ini"
            />

            <!-- ============ LEFT COLUMN ============ -->
            <!-- Purchase Order Field -->
            <FieldPopup
              id="t_purchase_order_id"
              label="No. PO"
              v-model="values.t_purchase_order_id"
              :displayValue="noPO"
              :errorname="errors.t_purchase_order_id ? 'failed' : ''"
              :hints="errors.t_purchase_order_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih PO"
              @update:valueFull="handlePOSelect"
              :api="poSelectionApiConfig"
              :columns="[
                { key: 'no_po', label: 'No. PO', width: '150px' },
                { key: 'tgl_po', label: 'Tgl. PO', width: '120px' },
                { key:'gudang', label:'Gudang', width:'120px' },
                {
                  key: 'supplier',
                  label: 'Supplier',
                  render: (item: any) => item.supplier || '-',
                },
              ]"
              displayField="no_po"
              valueField="id"
            />

            <!-- ============ RIGHT COLUMN ============ -->
            <!-- Supplier Field - Display Only from PO -->
            <FieldX
              id="supplier_display"
              label="Supplier"
              :value="supplierName"
              disabled
              readonly
              placeholder="Supplier dari PO yang dipilih"
            />

            <!-- ============ LEFT COLUMN ============ -->
            <!-- Alasan Field -->
            <FieldX
              id="alasan"
              label="Alasan"
              :value="values.alasan"
              @input="(v) => (values.alasan = v)"
              :errorname="errors.alasan ? 'failed' : ''"
              :hints="errors.alasan"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Masukkan alasan close PO"
            />

            <!-- ============ RIGHT COLUMN ============ -->
            <!-- Catatan Field -->
            <FieldX
              id="catatan"
              label="Catatan"
              :value="values.catatan"
              @input="(v) => (values.catatan = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Catatan tambahan (opsional)"
            />
          </div>
        </CardContent>
      </Card>

      <!-- DETAIL TABS -->
      <Tabs default-value="detail_items" class="w-full">
        <TabsList
          class="w-full overflow-x-auto flex justify-start scrollbar-hide"
        >
          <TabsTrigger value="detail_items">Detail Item Close</TabsTrigger>
        </TabsList>

        <!-- TAB CONTENT: DETAIL ITEMS -->
        <TabsContent value="detail_items" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Item Close</CardTitle>
                  <CardDescription>{{
                    isReadOnly
                      ? "Daftar item yang di-close pada Purchase Order"
                      : "Pilih item dari Purchase Order yang akan di-close"
                  }}</CardDescription>
                </div>
                <ButtonMultiSelect
                  v-if="!isReadOnly && selectedPOId"
                  :key="`btn-multi-${selectedPOId}`"
                  title="Pilih Item PO"
                  @add="handleAddDetailItems"
                  :api="detailItemsApiConfig"
                  :columns="[
                    {
                      key: 'kode_item',
                      label: 'Kode Item',
                      width: '130px',
                      render: (item: any) => item.m_item?.kode_item || '-',
                    },
                    {
                      key: 'nama_item',
                      label: 'Nama Item',
                      width: '200px',
                      render: (item: any) => item.m_item?.nama_item || '-',
                    },
                    { key: 'qty_po', label: 'Qty PO', width: '90px' },
                    // {
                    //   key: 'qty_diterima',
                    //   label: 'Qty Diterima',
                    //   width: '100px',
                    //   render: (item: any) => item.qty_diterima || 0,
                    // },
                    {
                      key: 'qty_sisa',
                      label: 'Qty Sisa',
                      width: '90px',
                      render: (item: any) => item.qty_sisa || 0,
                    },
                    {
                      key: 'satuan',
                      label: 'Satuan',
                      width: '80px',
                      render: (item: any) => item.m_item?.uom?.value1 || '-',
                    },
                  ]"
                  :disabled="loading"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div
                v-if="!values.t_purchase_order_id"
                class="text-center py-8 text-muted-foreground"
              >
                {{
                  isReadOnly
                    ? "Tidak ada Purchase Order terkait"
                    : "Pilih Purchase Order terlebih dahulu untuk menambahkan detail item"
                }}
              </div>
              <div v-else class="border rounded-lg overflow-x-auto">
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
                        Kode Item
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Nama Item
                      </th>
                      <th
                        class="px-3 py-2 text-right font-medium text-xs sm:text-sm"
                      >
                        Qty PO
                      </th>
                      <th
                        class="px-3 py-2 text-right font-medium text-xs sm:text-sm"
                      >
                        Qty Sisa
                      </th>
                        <th
                        class="px-3 py-2 text-right font-medium text-xs sm:text-sm"
                      >
                        Qty Close
                      </th>
                      <th
                        class="px-3 py-2 text-center font-medium text-xs sm:text-sm"
                      >
                        Satuan
                      </th>
                    
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Catatan
                      </th>
                      <th
                        v-if="!isReadOnly"
                        class="px-3 py-2 text-center font-medium text-xs sm:text-sm"
                      >
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailItems.length === 0">
                      <td
                        :colspan="isReadOnly ? 8 : 9"
                        class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                      >
                        {{
                          isReadOnly
                            ? "Tidak ada detail item"
                            : 'Belum ada item dipilih. Klik "Pilih Item PO" untuk menambahkan.'
                        }}
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, idx) in detailItems"
                      :key="detail.t_purchase_order_d_id || idx"
                      class="border-t hover:bg-muted/50"
                    >
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ idx + 1 }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.kode_item }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.nama_item }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm text-right">
                        {{ detail.qty_po }}
                      </td>
                      <td
                        class="px-3 py-2 text-xs sm:text-sm text-right font-medium"
                        :class="{
                          'text-red-600 dark:text-red-400': isReadOnly
                            ? (detail.qty_sisa ?? 0) < 0
                            : (detail.qty_sisa ?? 0) - (detail.qty_close || 0) <
                              0,
                          'text-blue-600 dark:text-blue-400': isReadOnly
                            ? (detail.qty_sisa ?? 0) >= 0
                            : (detail.qty_sisa ?? 0) -
                                (detail.qty_close || 0) >=
                              0,
                        }"
                      >
                        {{
                          isReadOnly
                            ? (detail.qty_sisa ?? 0)
                            : (detail.qty_sisa ?? 0) - (detail.qty_close || 0)
                        }}
                      </td>

                      <td class="px-3 py-2">
                        <div v-if="!isReadOnly" class="space-y-1">
                          <div class="flex justify-end">
                            <FieldNumber
                              :key="`qty-close-${idx}`"
                              :value="detail.qty_close ?? 0"
                              @update:modelValue="
                                (v: string | number) => {
                                  const cleanValue = String(v)
                                    .replace(/\./g, '')
                                    .replace(/,/g, '.')
                                    .replace(/-/g, '');
                                  const numValue = Number(cleanValue);
                                  const maxQty =
                                    detail.qty_sisa ?? detail.qty_po ?? 0;
                                  
                                  // Allow 0, but clamp negative and over-max
                                  if (numValue < 0) {
                                    detail.qty_close = 0;
                                  } else if (numValue > maxQty) {
                                    detail.qty_close = maxQty;
                                  } else {
                                    detail.qty_close = numValue;
                                  }
                                  
                                  // Validate and show warning
                                  validateQtyClose(idx, detail.qty_close, maxQty);
                                }
                              "
                              @blur="
                                () => {
                                  const maxQty = detail.qty_sisa ?? detail.qty_po ?? 0;
                                  if ((detail.qty_close ?? 0) < 0) {
                                    detail.qty_close = 0;
                                  }
                                  if ((detail.qty_close ?? 0) > maxQty) {
                                    detail.qty_close = maxQty;
                                  }
                                  validateQtyClose(idx, detail.qty_close ?? 0, maxQty);
                                }
                              "
                              :min="0"
                              :max="detail.qty_sisa ?? detail.qty_po ?? 0"
                              :disabled="loading"
                              :errorname="detailErrors[idx]?.qtyClose ? 'failed' : ''"
                              class="w-24"
                            />
                          </div>
                          <p v-if="detailErrors[idx]?.qtyClose" class="text-xs text-destructive text-right">
                            {{ detailErrors[idx].qtyClose }}
                          </p>
                        </div>
                        <span v-else class="text-xs sm:text-sm">{{ detail.qty_close ?? 0 }}</span>
                      </td>
                      
                      <td class="px-3 py-2 text-xs sm:text-sm text-center">
                        {{ detail.satuan }}
                      </td>
                   
                      <td class="px-3 py-2">
                        <FieldX
                          v-if="!isReadOnly"
                          :value="detail.catatan || ''"
                          @input="(v) => (detail.catatan = v)"
                          :disabled="loading"
                          placeholder="Catatan"
                          class="w-full min-w-32"
                        />
                        <span v-else class="text-xs sm:text-sm">{{
                          detail.catatan || "-"
                        }}</span>
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                        <DeleteButton
                          variant="ghost"
                          size="sm"
                          @click="removeDetailItem(idx)"
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

    <!-- ================================================================ -->
    <!-- SUPER ADMIN CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <Dialog
      :open="isSuperAdminDialogOpen"
      @update:open="isSuperAdminDialogOpen = $event"
    >
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Konfirmasi Super Admin</DialogTitle>
          <DialogDescription>
            Anda login sebagai Super Admin. Data akan langsung disimpan dengan
            status <strong>APPROVED</strong>.
          </DialogDescription>
        </DialogHeader>
        <div class="py-4">
          <p class="text-sm text-muted-foreground">
            Apakah Anda yakin ingin menyimpan PO Close ini dengan status
            APPROVED?
          </p>
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
            @click="confirmSuperAdminSave"
            :disabled="loading"
            class="gap-2"
          >
            <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
            Ya, Simpan dengan APPROVED
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

/* Hide scrollbar but keep scrollable functionality */
.scrollbar-hide {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}

.scrollbar-hide::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}
</style>
