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
  FieldX,
  FieldSelect,
  FieldDate,
  FieldNumber,
  FieldTextarea,
} from "@/components/field";
import { ButtonMultiSelect } from "@/components/button";
import { Trash2, ArrowLeft, Save, Loader2 } from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createPackingPlan,
  updatePackingPlan,
  getPackingPlanById,
} from "./service";

// ============================================================================
// SETUP
// ============================================================================
const authStore = useAuthStore();
const { API_BASE_URL } = useApi();
const router = useRouter();
const route = useRoute();

// Check if user is super admin
const isSuperAdmin = computed(() => {
  const user = authStore.user;
  if (!user || !user.tipe) return false;
  return user.tipe.value1?.toUpperCase() === "SUPER ADMIN";
});

// Get company name from SelectRespo for non-super admin
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
// STATE
// ============================================================================
const loading = ref(false);
const isEditMode = computed(
  () => !!route.params.id && route.name === "PackingPlanForm",
);
const isViewMode = computed(() => route.name === "PackingPlanView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Packing List";
  if (isCopyMode.value) return "Salin Packing List";
  if (isEditMode.value) return "Edit Packing List";
  return "Tambah Packing List";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Packing List";
  if (isCopyMode.value) return "Buat Packing List baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Packing List";
  return "Buat data packing list baru";
});

// Form values - sesuai struktur t_packing_plan
let values = reactive({
  no_packing_list: "",
  m_unit_bisnis_id: "",
  m_gudang_id: "",
  tgl_packing_list: new Date().toISOString().split("T")[0],
  pic_id: "",
  catatan: "",
  status: "DRAFT",
  is_active: true,
});

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {};

// Detail items - t_packing_plan_d
const detailItems = ref<any[]>([]);

const getItemSource = (item: any) =>
  item?.m_item || item?.m_items || item?.t_so_d?.m_item || item?.t_so_d?.m_items || {};

const getUomName = (item: any) => {
  const source = getItemSource(item);
  return (
    source?.uom?.value1 ||
    source?.m_general?.value1 ||
    item?.uom?.value1 ||
    item?.uom ||
    item?.satuan ||
    "-"
  );
};

// ============================================================================
// RACK API CONFIG (per item, filtered by gudang)
// ============================================================================
const getRakApiConfig = () => ({
  url: `${API_BASE_URL}/dynamic/m_rak_d`,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authStore.token}`,
  },
  params: {
    no_pagination: "true",
    selectfield: "id,kode",
    filter_column_is_active: true,
    ...(values.m_gudang_id
      ? { "include[m_rak][filter][m_gudang_id]": values.m_gudang_id }
      : {}),
  },
});

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    no_packing_list: "",
    m_unit_bisnis_id: "",
    m_gudang_id: "",
    tgl_packing_list: new Date().toISOString().split("T")[0],
    pic_id: "",
    catatan: "",
    status: "DRAFT",
    is_active: true,
  });

  // Reset errors
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });

  // Reset detail items
  detailItems.value = [];
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
    const res = await getPackingPlanById(sourceId);

    if (res.status !== "success") throw new Error("Gagal memuat data");
    initialValues = res.data;

    // Minimal normalisasi
    if (initialValues.is_active !== undefined) {
      const v = initialValues.is_active;
      initialValues.is_active = v === true || v === 1 || v === "1";
    } else {
      initialValues.is_active = true;
    }

    // Load detail items
    if (initialValues.t_packing_plan_ds || initialValues.t_packing_plan_d) {
      const rawDetails =
        initialValues.t_packing_plan_ds ||
        (Array.isArray(initialValues.t_packing_plan_d)
          ? initialValues.t_packing_plan_d
          : [initialValues.t_packing_plan_d]);
      detailItems.value = rawDetails.map((item: any) => ({
        id: isCopyModeLocal ? undefined : item.id,
        t_so_d_id: item.t_so_d_id || null,
        no_so: item.t_so_d?.t_so?.no_so || item.no_so || "-",
        customer:
          item.t_so_d?.t_so?.m_customer?.nama_customer || item.customer || "-",
        m_items_id: item.m_items_id || getItemSource(item)?.id || null,
        kode_item: getItemSource(item)?.kode_item || item.kode_item || "-",
        nama_item: getItemSource(item)?.nama_item || item.nama_item || "-",
        qty_so: Number(item.qty_so || item.t_so_d?.qty_so || 0),
        qty_packing: Number(item.qty_packing || 0),
        uom: getUomName(item),
        rak_d_id: item.rak_d_id || "",
        rak_display: item.m_rak_d?.kode || item.rak_display || "",
        catatan: item.catatan || "",
      }));
    }

    // Mode copy: hapus id dan timestamps agar jadi create baru
    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).no_packing_list;
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

    if (isCopyModeLocal) {
      toast.success("Data berhasil disalin", {
        description: "Silakan edit dan simpan sebagai Packing Plan baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Packing Plan", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () => router.push("/inventory/transaksi/t_packing_plan"),
      },
    });
    setTimeout(() => router.push("/inventory/transaksi/t_packing_plan"), 2000);
  } finally {
    loading.value = false;
  }
});

// Watch gudang change → reset rak_d_id di semua detail item
watch(
  () => values.m_gudang_id,
  () => {
    detailItems.value.forEach((item) => {
      item.rak_d_id = "";
      item.rak_display = "";
    });
  },
);

// Errors object (manual validation)
const errors = reactive({
  m_unit_bisnis_id: "",
  m_gudang_id: "",
  tgl_packing_list: "",
  pic_id: "",
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
  if (isSuperAdmin.value && !values.m_unit_bisnis_id) {
    errors.m_unit_bisnis_id = "Unit Bisnis wajib dipilih";
    invalid = true;
  }
  if (!values.m_gudang_id) {
    errors.m_gudang_id = "Gudang wajib dipilih";
    invalid = true;
  }
  if (!values.tgl_packing_list) {
    errors.tgl_packing_list = "Tanggal Packing List wajib diisi";
    invalid = true;
  }
  if (!values.pic_id) {
    errors.pic_id = "PIC wajib dipilih";
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
    const payload: any = {
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      m_gudang_id: values.m_gudang_id || null,
      tgl_packing_list: values.tgl_packing_list || null,
      pic_id: values.pic_id || null,
      catatan: values.catatan?.trim() || null,
      status: values.status || "DRAFT",
      is_active: values.is_active,
      // Detail items
      t_packing_plan_details:
        detailItems.value.length > 0
          ? detailItems.value.map((item) => ({
              id: item.id,
              t_so_d_id: item.t_so_d_id || null,
              m_items_id: item.m_items_id || getItemSource(item)?.id || null,
              qty_so: item.qty_so ?? 0,
              qty_packing: item.qty_packing ?? 0,
              rak_d_id: item.rak_d_id || null,
              catatan: item.catatan?.trim() || null,
            }))
          : undefined,
    };

    if (isEditMode.value) {
      await updatePackingPlan(menuId.value, payload as any);
      toast.success("Packing List berhasil diperbarui", {
        description: `Packing List telah diperbarui`,
      });
    } else {
      await createPackingPlan(payload as any);
      toast.success("Packing List berhasil dibuat", {
        description: `Packing List baru telah ditambahkan`,
      });
    }
    router.replace("/inventory/transaksi/t_packing_plan?reload=" + Date.now());
  } catch (error) {
    toast.error(
      isEditMode.value
        ? "Gagal memperbarui Packing Plan"
        : "Gagal membuat Packing Plan",
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
  router.push("/inventory/transaksi/t_packing_plan");
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
    <!-- Form tanpa submit default; penyimpanan melalui tombol onSave -->
    <form class="space-y-6" @submit.prevent>
      <!-- HEADER CARD (tanpa tab) -->
      <Card>
        <CardHeader>
          <CardTitle>Informasi Packing List</CardTitle>
          <CardDescription>
            Isi data Packing List dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="grid grid-cols-2 gap-6">
              <!-- Unit Bisnis - Super Admin: Select, User Biasa: Auto dari SelectRespo -->
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
                    selectfield: 'id,nama_comp',
                    filter_column_is_active: 'true',
                  },
                }"
                valueField="id"
                displayField="nama_comp"
                placeholder="Pilih unit bisnis"
                :clearable="true"
                class="w-full"
              />
              <FieldX
                v-else
                id="m_unit_bisnis_display"
                label="Unit Bisnis"
                :value="companyNameDisplay"
                :disabled="true"
                :readonly="true"
                placeholder="Unit bisnis dari respo"
                hints="Unit bisnis otomatis dari respo yang dipilih"
                class="w-full"
              />

              <!-- Tanggal Packing List -->
              <FieldDate
                id="tgl_packing_list"
                label="Tanggal Packing List"
                v-model="values.tgl_packing_list"
                :errorname="errors.tgl_packing_list ? 'failed' : ''"
                :hints="errors.tgl_packing_list"
                :required="!isReadOnly"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="Pilih tanggal"
                class="w-full"
              />
            </div>

            <!-- No. Packing List (Auto Generated - Read Only) -->
            <FieldX
              id="no_packing_list"
              label="No. Packing List"
              :value="values.no_packing_list"
              :disabled="true"
              :readonly="true"
              placeholder="Auto Generated"
              hints="Nomor akan digenerate otomatis oleh sistem"
              class="w-full"
            />

            <div class="grid grid-cols-2 gap-6">
              <!-- Gudang Field -->
              <FieldSelect
                id="m_gudang_id"
                label="Gudang"
                v-model="values.m_gudang_id"
                :errorname="errors.m_gudang_id ? 'failed' : ''"
                :hints="
                  errors.m_gudang_id ||
                  (!values.m_unit_bisnis_id
                    ? 'Pilih Unit Bisnis terlebih dahulu'
                    : 'Pilih gudang')
                "
                :required="!isReadOnly"
                :disabled="loading || isReadOnly || !values.m_unit_bisnis_id"
                :readonly="isReadOnly"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_gudang`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    filter_column_is_active: true,
                    selectfield: 'id,nama_gudang,kode_gudang',
                    filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
                  },
                }"
                valueField="id"
                displayField="nama_gudang"
                placeholder="Pilih Gudang"
                :clearable="true"
                class="w-full"
              />

              <!-- PIC Field -->
              <FieldSelect
                id="pic_id"
                label="PIC"
                v-model="values.pic_id"
                :errorname="errors.pic_id ? 'failed' : ''"
                :hints="
                  errors.pic_id ||
                  (!values.m_unit_bisnis_id
                    ? 'Pilih Unit Bisnis terlebih dahulu'
                    : 'Pilih karyawan sebagai PIC')
                "
                :required="!isReadOnly"
                :disabled="loading || isReadOnly || !values.m_unit_bisnis_id"
                :readonly="isReadOnly"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_kary`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    no_pagination: 'true',
                    selectfield: 'id,nama_kary,kode_kary',
                    filter_column_is_active: 'true',
                    filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
                  },
                }"
                valueField="id"
                displayField="nama_kary"
                placeholder="Pilih PIC"
                :clearable="true"
                class="w-full"
              />
            </div>

            <!-- Catatan Field -->
            <FieldTextarea
              id="catatan"
              label="Catatan (Opsional)"
              :value="values.catatan"
              @input="(v) => (values.catatan = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Catatan tambahan"
              class="w-full"
            />
          </div>
        </CardContent>
      </Card>

      <!-- ================================================================ -->
      <!-- DETAIL CARD - Packing List Detail -->
      <!-- ================================================================ -->
      <Card>
        <CardHeader class="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Packing List Detail</CardTitle>
            <CardDescription
              >Daftar item SO yang akan di-packing</CardDescription
            >
          </div>
          <ButtonMultiSelect
            v-if="!isReadOnly"
            title="+ Add to List"
            @add="
              (items: any[]) => {
                const existingIds = new Set(
                  detailItems.map((d: any) => d.t_so_d_id),
                );
                const newItems = items.filter(
                  (item: any) => !existingIds.has(item.id),
                );
                if (newItems.length === 0) {
                  toast.warning('Tidak ada item baru', {
                    description: 'Semua item yang dipilih sudah ada di detail',
                  });
                  return;
                }
                if (newItems.length < items.length) {
                  toast.info('Beberapa item dilewati', {
                    description: `${items.length - newItems.length} item sudah ada di detail`,
                  });
                }
                newItems.forEach((item: any) => {
                  detailItems.push({
                    id: undefined,
                    t_so_d_id: item.id,
                    no_so: item.t_so?.no_so || item.no_so || '-',
                    customer:
                      item.t_so?.m_customer?.nama_customer ||
                      item.customer ||
                      '-',
                    m_items_id: item.m_items_id || getItemSource(item)?.id || null,
                    kode_item:
                      getItemSource(item)?.kode_item || item.kode_item || '-',
                    nama_item:
                      getItemSource(item)?.nama_item || item.nama_item || '-',
                    qty_so: Number(item.qty_so || 0),
                    qty_packing: 0,
                    uom: getUomName(item),
                    rak_d_id: '',
                    catatan: '',
                  });
                });
                toast.success(`${newItems.length} item berhasil ditambahkan`);
              }
            "
            :api="{
              url: `${API_BASE_URL}/dynamic/t_so_d`,
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authStore.token}`,
              },
              params: {
                include: 't_so>m_customer,m_item>uom,m_items>uom',
                searchfield: 't_so.no_so,m_item.kode_item,m_item.nama_item',
                filter_column_is_active: true,
                ...(values.m_unit_bisnis_id && {
                  filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
                }),
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
                field: 'no_so',
                headerName: 'No. SO',
                width: '160px',
                sortable: true,
                render: (item: any) => item.t_so?.no_so || item.no_so || '-',
              },
              {
                field: 'customer',
                headerName: 'Customer',
                width: '180px',
                sortable: false,
                render: (item: any) =>
                  item.t_so?.m_customer?.nama_customer || item.customer || '-',
              },
              {
                field: 'kode_item',
                headerName: 'Kode',
                width: '130px',
                sortable: false,
                render: (item: any) =>
                  getItemSource(item)?.kode_item || item.kode_item || '-',
              },
              {
                field: 'nama_item',
                headerName: 'Nama Item',
                flex: 1,
                sortable: false,
                render: (item: any) =>
                  getItemSource(item)?.nama_item || item.nama_item || '-',
              },
              {
                field: 'qty_so',
                headerName: 'Qty SO',
                width: '100px',
                sortable: false,
              },
              {
                field: 'uom',
                headerName: 'UoM',
                width: '80px',
                sortable: false,
                render: getUomName,
              },
            ]"
            :disabled="loading"
          />
        </CardHeader>
        <CardContent>
          <div class="border rounded-lg overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted">
                <tr>
                  <th
                    class="px-3 py-2 text-left font-medium text-xs whitespace-nowrap"
                  >
                    No
                  </th>
                  <th
                    class="px-3 py-2 text-left font-medium text-xs whitespace-nowrap"
                  >
                    No. SO
                  </th>
                  <th
                    class="px-3 py-2 text-left font-medium text-xs whitespace-nowrap"
                  >
                    Customer
                  </th>
                  <th
                    class="px-3 py-2 text-left font-medium text-xs whitespace-nowrap"
                  >
                    Kode
                  </th>
                  <th
                    class="px-3 py-2 text-left font-medium text-xs whitespace-nowrap"
                  >
                    Nama Item
                  </th>
                  <th
                    class="px-3 py-2 text-right font-medium text-xs whitespace-nowrap"
                  >
                    Qty SO
                  </th>
                  <th
                    class="px-3 py-2 text-right font-medium text-xs whitespace-nowrap"
                  >
                    Qty Packing
                  </th>
                  <th
                    class="px-3 py-2 text-left font-medium text-xs whitespace-nowrap"
                  >
                    UoM
                  </th>
                  <th
                    class="px-3 py-2 text-left font-medium text-xs whitespace-nowrap min-w-[180px]"
                  >
                    Rak
                  </th>
                  <th
                    class="px-3 py-2 text-left font-medium text-xs whitespace-nowrap min-w-[150px]"
                  >
                    Catatan
                  </th>
                  <th
                    v-if="!isReadOnly"
                    class="px-2 py-2 text-center font-medium text-xs whitespace-nowrap"
                  >
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="detailItems.length === 0">
                  <td
                    :colspan="isReadOnly ? 10 : 11"
                    class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                  >
                    Belum ada item. Klik "+ Add to List" untuk menambahkan.
                  </td>
                </tr>
                <tr
                  v-for="(item, index) in detailItems"
                  :key="index"
                  class="border-t hover:bg-muted/50"
                >
                  <td class="px-3 py-2 text-xs whitespace-nowrap">
                    {{ index + 1 }}
                  </td>
                  <td class="px-3 py-2 text-xs whitespace-nowrap">
                    {{ item.no_so }}
                  </td>
                  <td class="px-3 py-2 text-xs whitespace-nowrap">
                    {{ item.customer }}
                  </td>
                  <td class="px-3 py-2 text-xs whitespace-nowrap">
                    {{ item.kode_item }}
                  </td>
                  <td class="px-3 py-2 text-xs">{{ item.nama_item }}</td>
                  <td class="px-3 py-2 text-xs text-right whitespace-nowrap">
                    {{ item.qty_so }}
                  </td>
                  <td class="px-3 py-2 text-xs">
                    <FieldNumber
                      v-if="!isReadOnly"
                      :id="`qty_packing_${index}`"
                      :value="item.qty_packing"
                      @input="
                        (v: any) => {
                          item.qty_packing =
                            v === '' || v == null ? 0 : Number(v);
                        }
                      "
                      :min="0"
                      placeholder="0"
                      class="w-20"
                    />
                    <span v-else class="block text-right">{{
                      item.qty_packing
                    }}</span>
                  </td>
                  <td class="px-3 py-2 text-xs whitespace-nowrap">
                    {{ item.uom }}
                  </td>
                  <td class="px-3 py-2 text-xs min-w-[180px]">
                    <FieldSelect
                      v-if="!isReadOnly"
                      :id="`rak_${index}`"
                      :value="item.rak_d_id"
                      @input="(v: string) => (item.rak_d_id = v)"
                      @update:valueFull="
                        (full: any) => {
                          item.rak_display = full?.kode || '';
                        }
                      "
                      :api="getRakApiConfig()"
                      displayField="kode"
                      valueField="id"
                      :disabled="loading || !values.m_gudang_id"
                      :readonly="isReadOnly"
                      :hints="!values.m_gudang_id ? 'Pilih Gudang dahulu' : ''"
                      placeholder="Pilih Rak"
                      :clearable="true"
                      class="w-full"
                    />
                    <span v-else>{{
                      item.rak_display || item.rak_d_id || "-"
                    }}</span>
                  </td>
                  <td class="px-3 py-2 text-xs min-w-[150px]">
                    <input
                      v-if="!isReadOnly"
                      v-model="item.catatan"
                      type="text"
                      class="w-full px-2 py-1 border rounded text-xs bg-background"
                      placeholder="Catatan"
                    />
                    <span v-else>{{ item.catatan || "-" }}</span>
                  </td>
                  <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-7 w-7 text-destructive hover:text-destructive"
                      @click="
                        () => {
                          detailItems.splice(index, 1);
                          toast.info('Item dihapus');
                        }
                      "
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
