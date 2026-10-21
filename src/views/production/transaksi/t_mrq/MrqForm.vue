<script setup lang="ts">
import AuditInfo from '@/components/AuditInfo.vue'
const auditMeta = ref<any>({})

import { ref, reactive, onBeforeMount, computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldNumber, FieldPopup, FieldSelect, FieldTextarea, FieldX } from "@/components/field";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import { apiCall } from "@/lib/api";
import ButtonMultiSelect from "@/components/button/ButtonMultiSelect.vue";
import { createMrq, getMrqById, updateMrq, getWoMaterialsForMrq, type MrqDetailItem, type MrqItem } from "./service";

import { usePermission } from "@/composables/usePermission";

const authStore = useAuthStore();
const { isSuperAdmin } = usePermission();
const { API_BASE_URL } = useApi();
const router = useRouter();
const route = useRoute();

const loading = ref(false);
const isEditMode = computed(() => !!route.params.id && route.name === "MrqForm");
const isViewMode = computed(() => route.name === "MrqView");
const copySourceId = computed(() => {
  const source = route.query.source || route.query.copy;
  return Array.isArray(source) ? source[0] : source;
});
const isCopyMode = computed(() => !!copySourceId.value);
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true || ['POST', 'CONFIRM', 'APPROVED', 'IN APPROVAL', 'REJECT'].includes((values.status || '').toUpperCase()));
const isUnitBisnisReadonly = computed(() => !isSuperAdmin.value || isEditMode.value || isViewMode.value);
const menuId = computed(() => route.params.id as string);

const selectedWoItemLabel = ref("");
const selectedWoRoutingLabel = ref("");
const selectedWoLabel = ref("");
const selectedUnitBisnisCompanyName = ref("");

const fetchUnitBisnisCompanyName = async (unitBisnisId: string) => {
  if (!unitBisnisId) {
    selectedUnitBisnisCompanyName.value = "";
    return;
  }
  try {
    const res = await apiCall<{ status: string; data: any }>(`/dynamic/m_unit_bisnis/${unitBisnisId}?join=true`);
    if (res.status === "success" && res.data) {
      selectedUnitBisnisCompanyName.value = res.data.m_company?.nama_company || res.data.m_company?.nama || "";
    }
  } catch (error) {
    console.error("Gagal mengambil nama company unit bisnis", error);
  }
};

const handleUnitBisnisSelected = (item: any) => {
  if (item) {
    selectedUnitBisnisCompanyName.value = item.m_company?.nama_company || item.m_company?.nama || "";
  } else {
    selectedUnitBisnisCompanyName.value = "";
  }
};

const getSelectRespoData = () => {
  try {
    const raw = localStorage.getItem('SelectRespo');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse SelectRespo:', err);
    return null;
  }
};

const applyCurrentUserUnitBisnis = () => {
  if (isSuperAdmin.value) return;
  const selectRespo = getSelectRespoData();
  const ubId = selectRespo?.companyId || selectRespo?.m_unit_bisnis_id || selectRespo?.unitBisnisId || "";
  if (ubId) {
    values.m_unit_bisnis_id = String(ubId);
    fetchUnitBisnisCompanyName(String(ubId));
  }
};

const handleWoSelected = (item: any) => {
  if (item) {
    values.m_unit_bisnis_id = item.m_unit_bisnis_id || "";
    (values as any).m_unit_bisni = item.m_unit_bisni || null;
    selectedWoLabel.value = item.no || "";
    if (values.m_unit_bisnis_id) {
      fetchUnitBisnisCompanyName(values.m_unit_bisnis_id);
    }
  } else {
    values.m_unit_bisnis_id = "";
    (values as any).m_unit_bisni = null;
    selectedUnitBisnisCompanyName.value = "";
    selectedWoLabel.value = "";
  }
};

const handleWoItemFullSelected = (item: any) => {
  if (item) {
    selectedWoItemLabel.value = item.m_item ? `${item.m_item.kode_item || item.m_item.kode || item.m_item.kode_ite || '-'} - ${item.m_item.nama_item || item.m_item.nama || item.m_item.nama_ite || '-'}` : item.id;
  } else {
    selectedWoItemLabel.value = "";
  }
};

const handleWoRoutingFullSelected = (item: any) => {
  if (item) {
    selectedWoRoutingLabel.value = item.wo_sd_routing ? `${item.wo_sd_routing.code || '-'} (${item.m_item?.kode_item || item.m_item?.kode || '-'})` : item.id;
  } else {
    selectedWoRoutingLabel.value = "";
  }
};

const handleMaterialsAdded = (items: any[]) => {
  items.forEach((item) => {
    const matId = item.t_wo_sd_material_id || item.id || "";
    if (!matId) return;
    const exists = detailItems.value.some((d) => d.t_wo_sd_material_id === matId);
    if (exists) return;

    const uomDisplay = item.uom || item.m_item?.mi_uom?.value1 || item.unit?.value1 || "";

    detailItems.value.push({
      sequence: detailItems.value.length + 1,
      t_wo_sd_material_id: matId,
      m_item_id: item.m_item_id || item.m_item?.id || "",
      qty_wo: item.qty ?? item.qty_wo ?? "",
      qty_sdh_request: item.qty_sdh_request ?? item.qty_request_sdh ?? 0,
      qty_available: item.qty_available !== undefined && item.qty_available !== null ? item.qty_available : (item.qty || ""),
      qty_stock: item.qty_stock !== undefined && item.qty_stock !== null ? item.qty_stock : 0,
      qty_request: 0, // default 0, user wajib input sendiri
      unit_id: item.unit_id || "",
      uom: uomDisplay,
      qty_confirm: item.qty_confirm || "",
      notes: item.notes || "",
      m_item: item.m_item || item.m_items || (item.nama_material ? { kode_item: item.kode_item, nama_item: item.nama_item } : null),
      m_general: uomDisplay ? { value1: uomDisplay } : (item.m_item?.mi_uom || null),
      t_wo: selectedWoLabel.value ? { no: selectedWoLabel.value } : null,
    });
  });
};

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Material Request";
  if (isCopyMode.value) return "Salin MRQ";
  if (isEditMode.value) return "Edit Material Request";
  return "Tambah Material Request Baru";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Material Request";
  if (isCopyMode.value) return "Buat MRQ baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Material Request";
  return "Buat Material Request baru";
});

const values = reactive({
  m_unit_bisnis_id: "",
  warehouse_id: "",
  date: new Date().toISOString().split("T")[0],
  t_wo_id: "",
  t_wo_d_item_id: "",
  t_wo_sd_routing_id: "",
  no: "",
  status: "DRAFT",
  notes: "",
});

const errors = reactive({
  m_unit_bisnis_id: "",
  warehouse_id: "",
  date: "",
});

const detailItems = ref<MrqDetailItem[]>([]);

const asArray = (value: unknown) => (Array.isArray(value) ? value : []);

const toNumberOrUndefined = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const addDetailItem = () => {
  detailItems.value.push({
    sequence: detailItems.value.length + 1,
    t_wo_sd_material_id: "",
    m_item_id: "",
    qty_request: "",
    unit_id: "",
    qty_confirm: "",
    notes: "",
  });
};

const removeDetailItem = (index: number) => {
  detailItems.value.splice(index, 1);
  detailItems.value = detailItems.value.map((row, idx) => ({ ...row, sequence: idx + 1 }));
};

const resetForm = () => {
  Object.assign(values, {
    m_unit_bisnis_id: "",
    warehouse_id: "",
    date: new Date().toISOString().split("T")[0],
    t_wo_id: "",
    t_wo_d_item_id: "",
    t_wo_sd_routing_id: "",
    no: "",
    status: "DRAFT",
    notes: "",
  });
  Object.assign(errors, {
    m_unit_bisnis_id: "",
    warehouse_id: "",
    date: "",
  });
  detailItems.value = [];
  selectedUnitBisnisCompanyName.value = "";
  applyCurrentUserUnitBisnis();
};

const normalizeDetailItems = (rows: any[] = []) =>
  rows.map((row: any, index: number) => {
    const woSdMat = row.t_wo_sd_material || {};
    const qtyWo = woSdMat.qty;
    const qtySdhRequest = woSdMat.qty_request ?? 0;
    const qtyAvailable = qtyWo !== undefined && qtyWo !== null ? (Number(qtyWo) - Number(qtySdhRequest)) : undefined;
    const uomDisplay = row.uom || row.m_item?.mi_uom?.value1 || row.t_wo_sd_material?.m_item?.mi_uom?.value1 || row.m_general?.value1 || "";

    return {
      id: row.id,
      t_mrq_id: row.t_mrq_id,
      sequence: row.sequence ?? index + 1,
      t_wo_sd_material_id: row.t_wo_sd_material_id ?? "",
      m_item_id: row.m_item_id ?? row.m_items_id ?? row.m_item?.id ?? row.m_items?.id ?? "",
      qty_wo: qtyWo,
      qty_sdh_request: qtySdhRequest,
      qty_available: qtyAvailable,
      qty_stock: row.qty_stock !== undefined && row.qty_stock !== null && row.qty_stock !== "" ? Number(row.qty_stock) : undefined,
      qty_request: row.qty_request ?? "",
      unit_id: row.unit_id ?? row.m_general?.id ?? "",
      uom: uomDisplay,
      qty_confirm: row.qty_confirm ?? "",
      notes: row.notes ?? row.note ?? row.catatan ?? "",
      m_item: row.m_item ?? row.m_items ?? row.t_wo_sd_material?.m_item,
      m_general: uomDisplay ? { value1: uomDisplay } : (row.m_item?.mi_uom || row.t_wo_sd_material?.m_item?.mi_uom || row.m_general || null),
      t_wo: row.t_wo || row.t_wo_sd_material?.t_wo || null,
    };
  });

const syncDetailStocks = async () => {
  if (!values.t_wo_id || !values.t_wo_d_item_id || !values.t_wo_sd_routing_id) return;
  if (!detailItems.value || detailItems.value.length === 0) return;

  try {
    const res = await getWoMaterialsForMrq({
      t_wo_id: values.t_wo_id,
      t_wo_d_item_id: values.t_wo_d_item_id,
      t_wo_sd_routing_id: values.t_wo_sd_routing_id,
      show_all: true,
    });

    if (res.status === "success" && Array.isArray(res.data)) {
      const stockMap = new Map<string, any>();
      res.data.forEach((item: any) => {
        if (item.t_wo_sd_material_id) stockMap.set(item.t_wo_sd_material_id, item);
        if (item.id) stockMap.set(item.id, item);
        if (item.m_item_id) stockMap.set(item.m_item_id, item);
      });

      detailItems.value.forEach((detail) => {
        const matched = (detail.t_wo_sd_material_id && stockMap.get(detail.t_wo_sd_material_id)) ||
                        (detail.m_item_id && stockMap.get(detail.m_item_id));
        if (matched) {
          detail.qty_stock = matched.qty_stock !== undefined && matched.qty_stock !== null ? matched.qty_stock : 0;
          if (detail.qty_available === undefined || detail.qty_available === null || detail.qty_available === "") {
            detail.qty_available = matched.qty_available;
          }
          if (detail.qty_sdh_request === undefined || detail.qty_sdh_request === null || detail.qty_sdh_request === "") {
            detail.qty_sdh_request = matched.qty_sdh_request;
          }
          if (detail.qty_wo === undefined || detail.qty_wo === null || detail.qty_wo === "") {
            detail.qty_wo = matched.qty_wo ?? matched.qty;
          }
        }
      });
    }
  } catch (err) {
    console.error("Gagal memuat stok material dari popup WO available:", err);
  }
};

watch(
  () => [values.t_wo_id, values.t_wo_d_item_id, values.t_wo_sd_routing_id],
  () => {
    if (detailItems.value.length > 0) {
      syncDetailStocks();
    }
  }
);

onBeforeMount(async () => {
  resetForm();

  const isCopyModeLocal = !!copySourceId.value;
  const sourceId = isCopyModeLocal ? String(copySourceId.value) : menuId.value;

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) return;

  loading.value = true;
  try {
    const res = await getMrqById(sourceId);
    if (res && res.data) {
      const rawData = res.data as any;
      auditMeta.value = {
        created_by: rawData.created_by,
        createdAt: rawData.createdAt,
        updated_by: rawData.update_by || rawData.updated_by,
        updatedAt: rawData.updatedAt,
      }
    }
    
    if (res.status !== "success") throw new Error("Gagal memuat data");

    const raw: any = res.data || {};
    values.m_unit_bisnis_id = raw.m_unit_bisnis_id ?? "";
    if (values.m_unit_bisnis_id) {
      fetchUnitBisnisCompanyName(values.m_unit_bisnis_id);
    }
    values.warehouse_id = raw.warehouse_id ?? "";
    values.date = (raw.date || raw.tgl_t_mrq || "").slice(0, 10);
    values.t_wo_id = raw.t_wo_id ?? "";
    selectedWoLabel.value = raw.t_wo?.no || "";
    values.t_wo_d_item_id = raw.t_wo_d_item_id ?? "";
    values.t_wo_sd_routing_id = raw.t_wo_sd_routing_id ?? "";

    if (raw.t_wo_d_item_id) {
      try {
        const woItemRes = await apiCall<{ status: string; data: any }>(`/dynamic/t_wo_d_item/${raw.t_wo_d_item_id}?join=true`);
        if (woItemRes.status === "success" && woItemRes.data) {
          const item = woItemRes.data;
          selectedWoItemLabel.value = item.m_item ? `${item.m_item.kode_item || item.m_item.kode || item.m_item.kode_ite || '-'} - ${item.m_item.nama_item || item.m_item.nama || item.m_item.nama_ite || '-'}` : item.id;
        }
      } catch (e) {
        selectedWoItemLabel.value = raw.t_wo_d_item_id;
      }
    } else {
      selectedWoItemLabel.value = "";
    }

    if (raw.t_wo_sd_routing_id) {
      try {
        const routingRes = await apiCall<{ status: string; data: any }>(`/dynamic/t_wo_sd_routing/${raw.t_wo_sd_routing_id}?join=true`);
        if (routingRes.status === "success" && routingRes.data) {
          const rObj = routingRes.data;
          selectedWoRoutingLabel.value = rObj.wo_sd_routing ? `${rObj.wo_sd_routing.code || '-'} (${rObj.m_item?.kode_item || rObj.m_item?.kode || '-'})` : rObj.id;
        }
      } catch (e) {
        selectedWoRoutingLabel.value = raw.t_wo_sd_routing_id;
      }
    } else {
      selectedWoRoutingLabel.value = "";
    }

    values.no = raw.no ?? raw.no_t_mrq ?? "";
    values.status = raw.status ?? "DRAFT";
    values.notes = raw.notes ?? raw.catatan ?? "";

    detailItems.value = normalizeDetailItems(asArray(raw.t_mrq_ds || raw.t_mrq_d || raw.t_mrq_details));

    // Sinkronisasi stok agar selalu menampilkan stok mutakhir gudang saat view / edit
    await syncDetailStocks();

    if (isCopyModeLocal) {
      values.no = "";
      detailItems.value = detailItems.value.map((row) => {
        const copy = { ...row };
        delete copy.id;
        delete copy.t_mrq_id;
        return copy;
      });
    }

    toast.success(isCopyModeLocal ? "Data berhasil disalin" : "Data berhasil dimuat");
  } catch (error) {
    toast.error("Gagal memuat data MRQ", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
    setTimeout(() => router.push("/production/transaksi/t_mrq"), 2000);
  } finally {
    loading.value = false;
  }
});

const buildDetailPayload = () =>
  detailItems.value
    .filter((row) => row.t_wo_sd_material_id || row.m_item_id || row.qty_request || row.unit_id || row.qty_confirm || row.notes?.trim())
    .map((row, index) => ({
      sequence: index + 1,
      t_wo_sd_material_id: row.t_wo_sd_material_id || undefined,
      m_item_id: row.m_item_id || undefined,
      qty_request: toNumberOrUndefined(row.qty_request),
      unit_id: row.unit_id || undefined,
      qty_confirm: toNumberOrUndefined(row.qty_confirm),
      notes: row.notes?.trim() || undefined,
    }));

const onSave = async () => {
  Object.assign(errors, {
    m_unit_bisnis_id: "",
    warehouse_id: "",
    date: "",
  });

  // Validasi material duplikat dari WO yang sama
  const seenMaterialIds = new Set<string>();
  for (let i = 0; i < detailItems.value.length; i++) {
    const item = detailItems.value[i];
    if (!item) continue;
    if (item.t_wo_sd_material_id) {
      if (seenMaterialIds.has(item.t_wo_sd_material_id)) {
        toast.error("Validasi Gagal", {
          description: "Tidak boleh menambahkan detail Material yang sama dalam satu transaksi",
        });
        loading.value = false;
        return;
      }
      seenMaterialIds.add(item.t_wo_sd_material_id);
    }

    const qtyReq = Number(item.qty_request || 0);
    if (qtyReq <= 0) {
      toast.error("Validasi Gagal", {
        description: `Baris ${i + 1}: Qty Request harus lebih besar dari 0`,
      });
      loading.value = false;
      return;
    }
  }

  loading.value = true;
  try {
    const payload: Partial<MrqItem> = {
      m_unit_bisnis_id: values.m_unit_bisnis_id || undefined,
      warehouse_id: values.warehouse_id || undefined,
      date: values.date || undefined,
      t_wo_id: values.t_wo_id || undefined,
      t_wo_d_item_id: values.t_wo_d_item_id || undefined,
      t_wo_sd_routing_id: values.t_wo_sd_routing_id || undefined,
      no: values.no?.trim() || undefined,
      status: values.status || "DRAFT",
      notes: values.notes?.trim() || undefined,
      t_mrq_d: buildDetailPayload(),
    };

    if (isEditMode.value) {
      await updateMrq(menuId.value, payload);
      toast.success("MRQ berhasil diperbarui");
    } else {
      await createMrq(payload);
      toast.success("MRQ berhasil dibuat");
    }
    router.replace("/production/transaksi/t_mrq?reload=" + Date.now());
  } catch (error) {
    toast.error(isEditMode.value ? "Gagal memperbarui MRQ" : "Gagal membuat MRQ", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  router.push("/production/transaksi/t_mrq");
};
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="icon" @click="handleCancel">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div>
        <h1 class="text-2xl font-bold text-foreground">{{ pageTitle }}</h1>
        <p class="text-sm text-muted-foreground">{{ pageDescription }}</p>
      </div>
    </div>

    <form class="space-y-6" @submit.prevent>
      <Card>
        <CardHeader>
          <CardTitle>Informasi Material Request</CardTitle>
          <CardDescription>Isi data Material Request dengan lengkap dan benar</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FieldSelect
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              :value="values.m_unit_bisnis_id"
              :display-value="(values as any).m_unit_bisni?.nama_comp || ''"
              :errorText="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id || 'Pilih unit bisnis untuk MRQ ini'"
              :required="false"
              :disabled="loading || isReadOnly || isUnitBisnisReadonly"
              :readonly="isReadOnly || isUnitBisnisReadonly"
              :clearable="!isUnitBisnisReadonly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  searchfield: 'kode_unit_bisnis,nama_comp',
                  join: 'true',
                },
              }"
              display-field="nama_comp"
              value-field="id"
              placeholder="Pilih Unit Bisnis"
              @input="(v) => (values.m_unit_bisnis_id = v)"
              @update:valueFull="handleUnitBisnisSelected"
            />

            <!-- Company (readonly) -->
            <FieldX
              id="company_display"
              label="Company"
              :value="selectedUnitBisnisCompanyName || '-'"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              class="opacity-70 bg-slate-50 dark:bg-muted/50"
            />

            <!-- No MRQ -->
            <FieldX
              id="no"
              label="No MRQ"
              :value="values.no || 'Auto Generate'"
              :disabled="true"
              :readonly="true"
              placeholder="Auto Generate"
              class="opacity-70 bg-slate-50 dark:bg-muted/50"
            />

            <!-- Tanggal -->
            <FieldX
              id="date"
              label="Tanggal"
              :value="values.date"
              :errorname="errors.date ? 'failed' : ''"
              :hints="errors.date"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              type="date"
              @input="(v) => (values.date = v)"
            />

            <!-- Warehouse -->
            <FieldSelect
              id="warehouse_id"
              label="Warehouse"
              :value="values.warehouse_id"
              :errorText="errors.warehouse_id ? 'failed' : ''"
              :hints="errors.warehouse_id"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="true"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_gudang`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  selectfield: 'id,kode_gudang,nama_gudang',
                  searchfield: 'kode_gudang,nama_gudang',
                },
              }"
              display-field="nama_gudang"
              value-field="id"
              placeholder="Pilih Warehouse"
              @input="(v) => (values.warehouse_id = v)"
            />

             <FieldPopup
              id="t_wo_id"
              label="Work Order"
              :value="values.t_wo_id"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="true"
              :display-value="selectedWoLabel"
              :api="{
                url: `${API_BASE_URL}/dynamic/t_wo`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'no,notes,catatan',
                  order_by: 'createdAt',
                  order_type: 'DESC',
                  join: 'true',
                  include: 'm_customer',
                  filter_column_status: 'APPROVED',
                  ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
                },
              }"
              valueField="id"
              displayField="no"
              placeholder="Pilih Work Order"
              :columns="[
                { field: 'no', headerName: 'No WO', width: '180px', sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'date', headerName: 'Date', width: '150px', sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'm_customer.nama_customer', headerName: 'Customer', width: '200px', sortable: true, filterable: true, filter: 'ColFilter' },
                { field: 'status', headerName: 'Status', width: '120px', sortable: true, filterable: true, filter: 'ColFilter' },
              ]"
              @input="(v) => {
                values.t_wo_id = v;
                values.t_wo_d_item_id = '';
                values.t_wo_sd_routing_id = '';
              }"
              @update:valueFull="handleWoSelected"
            />


            <FieldPopup
              id="t_wo_d_item_id"
              label="WO Item"
              :value="values.t_wo_d_item_id"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="true"
              :display-value="selectedWoItemLabel"
              :api="{
                url: `${API_BASE_URL}/dynamic/t_wo_d_item`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'notes',
                  order_by: 'sequence',
                  order_type: 'ASC',
                  join: 'true',
                  ...(values.t_wo_id ? { filter_column_t_wo_id: values.t_wo_id } : {}),
                },
              }"
              valueField="id"
              displayField="id"
              placeholder="Pilih WO Item"
              :columns="[
                { field: 'sequence', headerName: 'Seq', width: '90px', sortable: true },
                { field: 'm_item.kode_item', headerName: 'Kode Item', width: '150px', sortable: true },
                { field: 'm_item.nama_item', headerName: 'Nama Item', width: '220px', sortable: true },
                { field: 'qty', headerName: 'Qty', width: '120px', sortable: true },
                { field: 'notes', headerName: 'Notes', flex: 1, sortable: true, filterable: true, filter: 'ColFilter' },
              ]"
              @input="(v) => {
                values.t_wo_d_item_id = v;
                values.t_wo_sd_routing_id = '';
              }"
              @update:valueFull="handleWoItemFullSelected"
            />

            <FieldPopup
              id="t_wo_sd_routing_id"
              label="WO Routing"
              :value="values.t_wo_sd_routing_id"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="true"
              :display-value="selectedWoRoutingLabel"
              :api="{
                url: `${API_BASE_URL}/dynamic/t_wo_sd_routing`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'notes',
                  order_by: 'sequence',
                  order_type: 'ASC',
                  join: 'true',
                  ...(values.t_wo_id ? { filter_column_t_wo_id: values.t_wo_id } : {}),
                  ...(values.t_wo_d_item_id ? { filter_column_t_wo_d_item_id: values.t_wo_d_item_id } : {}),
                },
              }"
              valueField="id"
              displayField="id"
              placeholder="Pilih WO Routing"
              :columns="[
                { field: 'sequence', headerName: 'Seq', width: '90px', sortable: true },
                { field: 'wo_sd_routing.code', headerName: 'Kode Routing', width: '150px', sortable: true },
                { field: 'm_item.kode_item', headerName: 'Item Output', width: '150px', sortable: true },
                { field: 'qty', headerName: 'Qty', width: '120px', sortable: true },
                { field: 'notes', headerName: 'Notes', flex: 1, sortable: true, filterable: true, filter: 'ColFilter' },
              ]"
              @input="(v) => (values.t_wo_sd_routing_id = v)"
              @update:valueFull="handleWoRoutingFullSelected"
            />
            <FieldX
              id="status"
              label="Status"
              :value="values.status || 'DRAFT'"
              :disabled="true"
              :readonly="true"
              placeholder="DRAFT"
              class="opacity-70"
            />
          </div>

          <FieldTextarea
            id="notes"
            label="Catatan"
            :value="values.notes"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            placeholder="Catatan"
            :rows="3"
            @input="(v) => (values.notes = v)"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div class="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Detail Material Request</CardTitle>
              <CardDescription>Kelola detail material yang diminta</CardDescription>
            </div>
            <div v-if="!isReadOnly" class="flex items-center gap-2">
              <ButtonMultiSelect
                title="+ Add Material WO"
                buttonClass="h-9"
                :disabled="loading || !values.t_wo_sd_routing_id"
                :excludeIds="detailItems.map(d => d.t_wo_sd_material_id || '').filter(id => !!id)"
                searchKey="tipe_material,nama_material,kode_item,nama_item,notes"
                uniqueKey="t_wo_sd_material_id"
                :api="{
                  url: `${API_BASE_URL}/fn/t_wo/QtyAvailableForMRQ`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    t_wo_id: values.t_wo_id,
                    t_wo_d_item_id: values.t_wo_d_item_id,
                    t_wo_sd_routing_id: values.t_wo_sd_routing_id,
                  }
                }"
                :columns="[
                  { checkboxSelection: true, headerCheckboxSelection: true, width: '50px' },
                  { field: 'tipe_material', headerName: 'Tipe Material', width: '140px', sortable: true, filterable: true, filter: 'ColFilter' },
                  { field: 'nama_material', headerName: 'Nama Material', width: '220px', sortable: true, filterable: true, filter: 'ColFilter' },
                  { field: 'uom', headerName: 'UOM', width: '100px', sortable: true },
                  { field: 'qty', headerName: 'Qty WO', width: '100px', sortable: true },
                  { field: 'qty_sdh_request', headerName: 'Qty Sdh Request', width: '140px', sortable: true },
                  { field: 'qty_available', headerName: 'Qty Available', width: '120px', sortable: true },
                  { field: 'qty_stock', headerName: 'Qty Stock', width: '110px', sortable: true },
                  { field: 'qty_request', headerName: 'Qty Request', width: '120px', sortable: true },
                ]"
                @add="handleMaterialsAdded"
              />

            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div class="border rounded-lg overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted">
                <tr>
                  <th class="px-3 py-2 text-left font-medium w-12">No</th>
                  <th class="px-3 py-2 text-left font-medium min-w-[180px]">Material WO</th>
                  <th class="px-3 py-2 text-left font-medium min-w-[200px]">Item</th>
                  <th class="px-3 py-2 text-right font-medium w-28">Qty Available</th>
                  <th class="px-3 py-2 text-right font-medium w-28">Qty Stock</th>
                  <th class="px-3 py-2 text-right font-medium w-36">Qty Request</th>
                  <th class="px-3 py-2 text-left font-medium w-24">UoM</th>
                  <!-- <th class="px-3 py-2 text-right font-medium w-32">Qty Confirm</th> -->
                  <th class="px-3 py-2 text-left font-medium min-w-[180px]">Catatan</th>
                  <th v-if="!isReadOnly" class="px-2 py-2 text-center font-medium w-16">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="detailItems.length === 0">
                  <td :colspan="isReadOnly ? 9 : 10" class="text-center py-8 text-muted-foreground">
                    Belum ada detail material.
                  </td>
                </tr>
                <tr v-for="(detail, idx) in detailItems" :key="detail.id || idx" class="border-t hover:bg-muted/50">
                  <td class="px-3 py-2">{{ idx + 1 }}</td>
                  <td class="px-3 py-2">
                     <FieldPopup
                       v-if="!isReadOnly"
                       :id="`material_${idx}`"
                       :value="detail.t_wo_sd_material_id || ''"
                       :disabled="loading || isReadOnly || !values.t_wo_sd_routing_id"
                       :readonly="isReadOnly"
                       :clearable="true"
                       :display-value="detail.t_wo?.no || selectedWoLabel || ''"
                       :api="{
                         url: `${API_BASE_URL}/fn/t_wo/QtyAvailableForMRQ`,
                         headers: {
                           'Content-Type': 'application/json',
                           Authorization: `Bearer ${authStore.token}`,
                         },
                         params: {
                           t_wo_id: values.t_wo_id,
                           t_wo_d_item_id: values.t_wo_d_item_id,
                           t_wo_sd_routing_id: values.t_wo_sd_routing_id,
                         },
                       }"
                       valueField="t_wo_sd_material_id"
                       displayField="t_wo_sd_material_id"
                       placeholder="Pilih Material WO"
                       :columns="[
                         { field: 'tipe_material', headerName: 'Tipe Material', width: '130px', sortable: true, filterable: true, filter: 'ColFilter' },
                         { field: 'nama_material', headerName: 'Nama Material', width: '200px', sortable: true, filterable: true, filter: 'ColFilter' },
                         { field: 'uom', headerName: 'UOM', width: '90px', sortable: true },
                         { field: 'qty', headerName: 'Qty WO', width: '90px', sortable: true },
                         { field: 'qty_sdh_request', headerName: 'Qty Sdh Request', width: '120px', sortable: true },
                         { field: 'qty_available', headerName: 'Qty Available', width: '110px', sortable: true },
                         { field: 'qty_stock', headerName: 'Qty Stock', width: '100px', sortable: true },
                       ]"
                       @input="(v) => (detail.t_wo_sd_material_id = v)"
                       @update:valueFull="(item) => {
                         detail.m_item_id = item?.m_item_id || item?.m_items_id || detail.m_item_id || ''
                         detail.qty_wo = item?.qty ?? item?.qty_wo ?? detail.qty_wo ?? ''
                         detail.qty_sdh_request = item?.qty_sdh_request ?? item?.qty_request_sdh ?? detail.qty_sdh_request ?? 0
                         detail.qty_available = item?.qty_available !== undefined && item?.qty_available !== null ? item.qty_available : (item?.qty || detail.qty_available || '')
                         detail.qty_stock = item?.qty_stock !== undefined && item?.qty_stock !== null ? item.qty_stock : (detail.qty_stock ?? 0)
                         detail.qty_request = 0 // default 0, user wajib input sendiri
                         detail.unit_id = item?.unit_id || detail.unit_id || ''
                         detail.uom = item?.uom || item?.m_item?.mi_uom?.value1 || item?.unit?.value1 || detail.uom || ''
                         detail.m_item = item?.m_item || item?.m_items || (item?.nama_material ? { kode_item: item.kode_item, nama_item: item.nama_item } : null)
                         detail.t_wo = item?.t_wo || (selectedWoLabel ? { no: selectedWoLabel } : null)
                         detail.m_general = detail.uom ? { value1: detail.uom } : (item?.m_item?.mi_uom || null)
                       }"
                     />
                     <span v-else>{{ detail.t_wo?.no || selectedWoLabel || "-" }}</span>
                  </td>

                  <td class="px-3 py-2">
                    <span class="text-slate-700">
                      {{
                        detail.m_item
                          ? `${detail.m_item.kode || detail.m_item.kode_item || "-"} - ${detail.m_item.nama || detail.m_item.nama_item || "-"}`
                          : detail.m_item_id || "-"
                      }}
                    </span>
                  </td>

                  <!-- Qty WO Available -->
                  <td class="px-3 py-2 text-right">
                    <span class="font-medium text-slate-700">
                      {{ detail.qty_available !== undefined && detail.qty_available !== null && detail.qty_available !== '' ? detail.qty_available : '-' }}
                    </span>
                  </td>

                  <!-- Qty Stock -->
                  <td class="px-3 py-2 text-right">
                    <span class="font-medium text-slate-700">
                      {{ detail.qty_stock !== undefined && detail.qty_stock !== null && detail.qty_stock !== '' ? detail.qty_stock : '0' }}
                    </span>
                  </td>

                  <!-- Qty Request -->
                  <td class="px-3 py-2">
                    <FieldNumber
                      :id="`qty_request_${idx}`"
                      :model-value="Number(detail.qty_request || 0)"
                      :disabled="loading || isReadOnly"
                      :readonly="isReadOnly"
                      type="decimal"
                      class="w-full min-w-[120px]"
                      input-class="text-right"
                      @update:model-value="(v) => (detail.qty_request = v)"
                    />
                  </td>

                  <!-- UOM -->
                  <td class="px-3 py-2">
                    <span>{{ detail.uom || detail.m_item?.mi_uom?.value1 || detail.m_general?.value1 || detail.unit_id || "-" }}</span>
                  </td>

                  <!-- Qty Confirm -->
                  <!-- <td class="px-3 py-2">
                    <FieldNumber
                      :id="`qty_confirm_${idx}`"
                      :model-value="Number(detail.qty_confirm || 0)"
                      :disabled="loading || isReadOnly"
                      :readonly="isReadOnly"
                      type="decimal"
                      class="w-full min-w-[120px]"
                      @update:model-value="(v) => (detail.qty_confirm = v)"
                    />
                  </td> -->

                  <!-- Catatan -->
                  <td class="px-3 py-2">
                    <input
                      v-if="!isReadOnly"
                      v-model="detail.notes"
                      type="text"
                      class="w-full px-2 py-1 border rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="Catatan"
                    />
                    <span v-else>{{ detail.notes || "-" }}</span>
                  </td>
                  <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                    <Button type="button" variant="ghost" size="icon" class="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" @click="removeDetailItem(idx)">
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      
      <AuditInfo
        v-if="isViewMode || isEditMode"
        :created-by="auditMeta.created_by"
        :created-at="auditMeta.createdAt"
        :updated-by="auditMeta.updated_by"
        :updated-at="auditMeta.updatedAt"
        class="mt-6"
      />

      <div class="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-end sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t sm:border-0 -mx-6 px-6 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:static">
        <Button type="button" variant="outline" @click="handleCancel" :disabled="loading" class="w-full sm:w-auto">
          {{ isReadOnly ? "Kembali" : "Batal" }}
        </Button>
        <Button v-if="!isReadOnly" type="button" @click="onSave" :disabled="loading" class="gap-2 w-full sm:w-auto">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          {{ isEditMode ? "Perbarui" : "Simpan" }}
        </Button>
      </div>
    </form>
  </div>
</template>
