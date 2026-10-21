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
  FieldSelect,
  FieldNumber,
  FieldStatus,
  FieldDate,
  FieldCombo,
  FieldPopup,
} from "@/components/field";
import { ButtonMultiSelect } from "@/components/button";
import { DeleteButton } from "@/components/button";
import { Trash2 } from "lucide-vue-next";
import { ArrowLeft, Save, Loader2 } from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import { createTransform, updateTransform, getTransformById } from "./service";
import AuditInfo from "@/components/AuditInfo.vue";

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
  () => !!route.params.id && route.name === "TransformForm",
);
const isViewMode = computed(() => route.name === "TransformView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);

// Super Admin check
const isSuperAdmin = computed(() => {
  const user = authStore.user as any;
  if (!user || !user.tipe) return false;
  return user?.tipe?.value1?.toUpperCase() === "SUPER ADMIN";
});

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

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Transform";
  if (isCopyMode.value) return "Salin Transform";
  if (isEditMode.value) return "Edit Transform";
  return "Tambah Transform Baru";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Transform";
  if (isCopyMode.value) return "Buat Transform baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Transform";
  return "Buat Transform baru";
});

// Form values
let values = reactive({
  m_unit_bisnis_id: "",
  tanggal: new Date().toISOString().split("T")[0],
  transform_no: "",
  item_id: "",
  item_name: "",
  note: "",
  tipe: "",
  tipe_id: "",
  is_active: true,
});

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {};

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

// Detail arrays
const detailArr = ref<any[]>([]);
const selectedTransformType = ref<Record<string, any> | null>(null);
const isConversionTransform = computed(() => {
  const code = String(selectedTransformType.value?.code || "").toUpperCase();
  const label = String(selectedTransformType.value?.value1 || values.tipe || "").toUpperCase();
  return code === "CONVERSION" || label === "CONVERSION";
});

const handleTransformTypeChange = (item: any) => {
  selectedTransformType.value = item || null;
  values.tipe = item?.value1 || "";
};

// ============================================================================
// DETAIL METHODS
// ============================================================================

const handleAddDetailItems = (items: any[]) => {
  if (!Array.isArray(items) || items.length === 0) return;

  for (const item of items) {
    if (detailArr.value.some((detail) => detail.item_id === item.id)) {
      toast.warning(`Item "${item.nama_item}" sudah ada di dalam list`);
      continue;
    }
    detailArr.value.push({
      item_id: item.id,
      kode: item.kode_item,
      nama: item.nama_item,
      is_acuan: false,
      catatan: "",
    });
  }
};

const removeDetailArr = (index: number) => {
  detailArr.value.splice(index, 1);
  toast.info("Detail dihapus");
};

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    m_unit_bisnis_id: "",
    tanggal: new Date(),
    transform_no: "",
    item_id: "",
    item_name: "",
    note: "",
    tipe: "",
    tipe_id: "",
    is_active: true,
  });

  // Reset errors
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });

  // Reset detail arrays
  detailArr.value = [];
  selectedTransformType.value = null;
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
    const res = await getTransformById(sourceId);

    if (res.status !== "success") throw new Error("Gagal memuat data");
    initialValues = res.data;

    auditMeta.value = {
      created_by: initialValues.created_by || initialValues.createdBy || null,
      createdAt: initialValues.createdAt || null,
      updated_by: initialValues.updated_by || initialValues.update_by || initialValues.edited_by || null,
      updatedAt: initialValues.updatedAt || null,
    };

    // Minimal normalisasi
    if (initialValues.is_active !== undefined) {
      const v = initialValues.is_active;
      initialValues.is_active = v === true || v === 1 || v === "1";
    } else {
      initialValues.is_active = true;
    }
    if (initialValues.tanggal) {
      initialValues.tanggal = new Date(initialValues.tanggal);
    }

    // Load detail items
    if (initialValues.m_transform_ds) {
      detailArr.value = initialValues.m_transform_ds.map((d: any) => ({
        ...d,
        id: isCopyModeLocal ? undefined : d.id,
        kode: d.m_item?.kode_item || "-",
        nama: d.m_item?.nama_item || "-",
        createdAt: isCopyModeLocal ? undefined : d.createdAt,
        updatedAt: isCopyModeLocal ? undefined : d.updatedAt,
      }));
    }

    // Mode copy: hapus id dan timestamps agar jadi create baru
    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).transform_no;
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

    if (initialValues.m_item) {
      values.item_name =
        initialValues.m_item.nama_item || initialValues.m_item.nama || "";
    }
    selectedTransformType.value =
      initialValues.m_general ||
      (initialValues.tipe
        ? { value1: String(initialValues.tipe) }
        : null);
    if (!values.tipe && selectedTransformType.value?.value1) {
      values.tipe = String(selectedTransformType.value.value1);
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
        description: "Silakan edit dan simpan sebagai Transform baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Transform", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () => router.push("/inventory/master/m_transform"),
      },
    });
    setTimeout(() => router.push("/inventory/master/m_transform"), 2000);
  } finally {
    loading.value = false;
  }
});

// Errors object (manual validation)
const errors = reactive({
  m_unit_bisnis_id: "",
  item_id: "",
  tipe_id: "",
  tipe: "",
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
  if (!values.m_unit_bisnis_id) {
    errors.m_unit_bisnis_id = "Unit Bisnis wajib diisi";
    invalid = true;
  }
  if (!values.item_id) {
    errors.item_id = "Item wajib diisi";
    invalid = true;
  }
  if (!values.tipe_id) {
    errors.tipe_id = "Jenis Transform wajib diisi";
    invalid = true;
  }

  if (!isConversionTransform.value) {
    const checkedCount = detailArr.value.filter(
      (detail) => detail.is_acuan,
    ).length;
    const uncheckedCount = detailArr.value.length - checkedCount;

    if (detailArr.value.length > 0 && uncheckedCount > 1) {
      toast.warning("Validasi detail gagal", {
        description: `Minimal ${Math.max(detailArr.value.length - 1, 0)} detail harus dicentang. Hanya 1 detail yang boleh tidak dicentang.`,
      });
      return;
    }
  }

  if (invalid) {
    toast.error("Validasi gagal", {
      description: "Mohon lengkapi semua field yang wajib diisi",
    });
    return;
  }

  loading.value = true;
  try {
    // Clean payload
    const payload: any = {
      ...values,
      m_transform_d: detailArr.value.map((d) => ({
        item_id: d.item_id,
        is_acuan: d.is_acuan,
        catatan: d.catatan,
      })),
    };

    if (isEditMode.value) {
      payload.updated_by = authStore.user?.id || null;
      await updateTransform(menuId.value, payload as any);
      toast.success("Transform berhasil diperbarui");
    } else {
      payload.created_by = authStore.user?.id || null;
      payload.updated_by = authStore.user?.id || null;
      await createTransform(payload as any);
      toast.success("Transform berhasil dibuat");
    }
    router.replace("/inventory/master/m_transform?reload=" + Date.now());
  } catch (error) {
    toast.error(
      isEditMode.value
        ? "Gagal memperbarui Transform"
        : "Gagal membuat Transform",
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
  router.push("/inventory/master/m_transform");
};

watch(isConversionTransform, (isConversion) => {
  if (!isConversion) return;
  detailArr.value = detailArr.value.map((d) => ({
    ...d,
    is_acuan: false,
  }));
});
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
          <CardTitle>Definisi Transform Item</CardTitle>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Unit Bisnis -->

            <FieldSelect
              v-if="isSuperAdmin"
              id="m_unit_bisnis_id"
              label="Company"
              v-model="values.m_unit_bisnis_id"
              :errorname="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id || 'Pilih company'"
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
                  searchfield: 'nama_comp',
                  filter_column_is_active: true,
                },
              }"
              valueField="id"
              displayField="nama_comp"
              placeholder="Pilih company"
              :clearable="true"
            />
            <FieldX
              v-else
              id="m_unit_bisnis_id_display"
              label="Company"
              :value="companyNameDisplay"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              hints="Company dari akun Anda"
            />

            <!-- No. Transform Item -->
            <FieldX
              id="transform_no"
              label="No. Definisi Transform Item"
              :value="values.transform_no"
              :disabled="true"
              :readonly="true"
              placeholder="Auto generate by system"
            />

            <!-- Item -->
            <FieldPopup
              id="item_id"
              label="Item"
              :value="values.item_id"
              :displayValue="values.item_name"
              @update:valueFull="
                (v: any) => {
                  values.item_id = v?.id || '';
                  values.item_name = v?.nama_item || v?.nama || '';
                }
              "
              :errorText="errors.item_id ? 'failed' : ''"
              :hints="errors.item_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              placeholder="Pilih Item"
              displayField="nama_item"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_items`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  include: 'm_general:id|value1',
                  searchfield: 'kode_item,nama_item',
                  join: 'true',
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
                  field: 'kode_item',
                  headerName: 'Kode Item',
                  width: '150px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'nama_item',
                  headerName: 'Nama Item',
                  width: '250px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'mi_uom.value1',
                  headerName: 'Satuan',
                  width: '80px',
                  sortable: false,
                  filterable: false,
                  render: (row: any) => row.mi_uom?.value1 || '-',
                },
              ]"
            />

            <FieldSelect
              id="tipe_id"
              label="Jenis Transform"
              v-model="values.tipe_id"
              :errorname="errors.tipe_id ? 'failed' : ''"
              :hints="errors.tipe_id || 'Pilih jenis transform'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'value1,code,group',
                  filter_column_is_active: true,
                  no_pagination: 'true',
                  filter_column_group: 'TIPE TRANSFORM',
                  filter_operator_group: '=',
                },
              }"
              valueField="id"
              displayField="value1"
              placeholder="Pilih jenis transform"
              :clearable="true"
              @update:valueFull="handleTransformTypeChange"
            />

            <!-- Catatan -->
            <FieldX
              id="note"
              label="Catatan"
              v-model="values.note"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Catatan"
            />

            <FieldStatus
              label="Status Aktif"
              name="is_active"
              v-model="values.is_active"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              activeText="Aktif"
              inactiveText="Nonaktif"
            />
          </div>
        </CardContent>
      </Card>

      <!-- DETAIL CARD -->

      <Tabs default-value="detail" class="w-full">
        <TabsList
          class="w-full overflow-x-auto flex justify-start scrollbar-hide"
        >
          <TabsTrigger value="detail">Detail Item</TabsTrigger>
        </TabsList>
        <TabsContent value="detail" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Definisi Transform Item Detail</CardTitle>
                  <CardDescription
                    >Kelola item detail transform</CardDescription
                  >
                </div>
                <ButtonMultiSelect
                  title="Add to Detail"
                  @add="handleAddDetailItems"
                  :api="{
                    url: `${API_BASE_URL}/dynamic/m_items`,
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authStore.token}`,
                    },
                    params: {
                      include: 'm_general:id|value1',
                      searchfield: 'kode_item,nama_item',
                      join: 'true',
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
                      field: 'kode_item',
                      headerName: 'Kode Item',
                      width: '150px',
                      sortable: true,
                      filterable: true,
                      filter: 'ColFilter',
                    },
                    {
                      field: 'nama_item',
                      headerName: 'Nama Item',
                      width: '250px',
                      sortable: true,
                      filterable: true,
                      filter: 'ColFilter',
                    },
                    {
                      field: 'mi_uom.value1',
                      headerName: 'Satuan',
                      width: '80px',
                      sortable: false,
                      filterable: false,
                      render: (row: any) => row.mi_uom?.value1 || '-',
                    },
                  ]"
                  :disabled="loading"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full">
                  <thead>
                    <tr class="border-b">
                      <th class="p-2 text-left w-10">No</th>
                      <th class="p-2 text-left">Kode</th>
                      <th class="p-2 text-left">Nama Item</th>
                      <th v-if="!isConversionTransform" class="p-2 text-left">Acuan Harga</th>
                      <th class="p-2 text-left">Catatan</th>
                      <th class="p-2 text-right w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr.length === 0">
                      <td
                        :colspan="isConversionTransform ? 5 : 6"
                        class="p-4 text-center text-muted-foreground"
                      >
                        Belum ada item detail.
                      </td>
                    </tr>
                    <tr
                      v-for="(item, index) in detailArr"
                      :key="item.item_id"
                      class="border-b"
                    >
                      <td class="p-2">{{ index + 1 }}</td>
                      <td class="p-2">{{ item.kode }}</td>
                      <td class="p-2">{{ item.nama }}</td>
                      <td v-if="!isConversionTransform" class="p-2">
                        <input
                          type="checkbox"
                          v-model="item.is_acuan"
                          :disabled="isReadOnly"
                        />
                      </td>
                      <td class="p-2">
                        <FieldX
                          v-model="item.catatan"
                          :readonly="isReadOnly"
                          placeholder="Catatan"
                        />
                      </td>
                      <td class="p-2 text-right">
                        <Button
                          v-if="!isReadOnly"
                          variant="ghost"
                          size="icon"
                          @click="removeDetailArr(index)"
                        >
                          <Trash2 class="h-4 w-4 text-destructive" />
                        </Button>
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
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}

.scrollbar-hide::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}
</style>
