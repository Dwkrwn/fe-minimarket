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
import { Label } from "@/components/ui/label";
import {
  FieldX,
  FieldStatus,
  FieldPopup,
  FieldNumber,
  FieldDate,
  FieldTextarea,
} from "@/components/field";
import { createCoa, updateCoa, getCoaById } from "./service";
import { ArrowLeft, Save, Loader2 } from "lucide-vue-next";
import AuditInfo from "@/components/AuditInfo.vue";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const { API_BASE_URL } = useApi();
// ============================================================================
// COMPOSABLES & STORES
// ============================================================================
const router = useRouter();
const route = useRoute();

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false);
const isEditMode = computed(
  () => !!route.params.id && route.name === "CoaForm",
);
const isViewMode = computed(() => route.name === "CoaView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);
const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Coa";
  if (isCopyMode.value) return "Salin Coa";
  if (isEditMode.value) return "Edit Coa";
  return "Tambah Coa Baru";
});
const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Coa";
  if (isCopyMode.value) return "Buat Coa baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Coa";
  return "Buat Coa baru";
});

// Reactive form values with defaults
let values = reactive({
  kategori_id: "",
  has_parent: false,
  kode: "",
  level: 0,
  parent_id: "",
  nama: "",
  tipe_id: "",
  catatan: "",
  status: true, // Default true
});

// Display values for FieldPopup (to show text instead of ID)
const displayValues = reactive({
  kategori: "",
  tipe_id: "",
  parent: "",
});

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {};

const auditMeta = ref<{
  created_by?: string | null;
  createdAt?: string | null;
  updated_by?: string | null;
  updatedAt?: string | null;
}>({});

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    kategori_id: "",
    has_parent: false,
    kode: "",
    level: 0,
    parent_id: "",
    nama: "",
    tipe_id: "",
    catatan: "",
    status: true, // Default true
  });

  // Reset display values
  Object.assign(displayValues, {
    kategori: "",
    tipe_id: "",
    parent: "",
  });

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

  // Check if copy mode via query param
  const isCopyModeLocal = route.query.action === "copy" && route.query.source;
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value;

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return;
  }

  loading.value = true;
  try {
    const res = await getCoaById(sourceId);

    if (res.status !== "success") throw new Error("Gagal memuat data");
    initialValues = res.data;

    auditMeta.value = {
      created_by: initialValues.created_by || initialValues.user_created_by?.id || (initialValues as any).createdBy || null,
      createdAt: initialValues.createdAt || null,
      updated_by: initialValues.updated_by || initialValues.user_updated_by?.id || initialValues.update_by || (initialValues as any).updatedBy || (initialValues as any).edited_by || null,
      updatedAt: initialValues.updatedAt || null,
    };

    // Minimal normalisasi (tidak sekompleks normalizeIncoming sebelumnya)
    // Pastikan boolean (API sudah boolean, tapi jaga-jaga kalau 1/0)
    if (initialValues.status !== undefined) {
      const v = initialValues.status;
      initialValues.status = v === true || v === 1 || v === "1";
    } else {
      initialValues.status = true;
    }

    // Normalize has_parent boolean value
    if (initialValues.has_parent !== undefined) {
      const v = initialValues.has_parent;
      initialValues.has_parent = v === true || v === 1 || v === "1";
    } else {
      initialValues.has_parent = false;
    }

    // Extract display values from nested objects (API returns join=true data)
    if (initialValues.coa_kategori?.value1) {
      displayValues.kategori = initialValues.coa_kategori.value1;
    }
    if (initialValues.coa_tipe?.value1) {
      displayValues.tipe_id = initialValues.coa_tipe.value1;
    }
    if (initialValues.coa_parent?.nama) {
      displayValues.parent = initialValues.coa_parent.nama;
    } else if (initialValues.coa_parentssss?.nama) {
      displayValues.parent = initialValues.coa_parentssss.nama;
    }

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

    if (initialValues.level !== undefined && initialValues.level !== null) {
      values.level = Number(initialValues.level);
    } else {
      values.level = values.has_parent && values.parent_id ? 1 : 0;
    }

    if (isCopyModeLocal) {
      toast.success("Data berhasil disalin", {
        description: "Silakan edit dan simpan sebagai Coa baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Coa", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () => router.push("/accounting/master/m_coa"),
      },
    });
    setTimeout(() => router.push("/accounting/master/m_coa"), 2000);
  } finally {
    loading.value = false;
  }
});

// Watcher has_parent: auto-reset jika dimatikan
watch(
  () => values.has_parent,
  (hasParent) => {
    if (!hasParent) {
      values.parent_id = "";
      displayValues.parent = "";
      values.level = 0;
      errors.parent_id = "";
    }
  },
);

const handleParentSelected = async (item: any) => {
  displayValues.parent = item?.nama || "";
  errors.parent_id = "";
  if (item && item.level !== undefined && item.level !== null && !isNaN(Number(item.level))) {
    values.level = Number(item.level) + 1;
  } else if (values.parent_id) {
    try {
      const res = await getCoaById(values.parent_id);
      if (res.status === "success" && res.data) {
        values.level = Number(res.data.level ?? 0) + 1;
      } else {
        values.level = 1;
      }
    } catch {
      values.level = 1;
    }
  } else {
    values.level = 0;
  }
};

// Errors object (manual validation)
const errors = reactive({
  kategori_id: "",
  kode: "",
  level: "",
  nama: "",
  tipe_id: "",
  parent_id: "",
});

// ============================================================================
// SAVE HANDLER (langsung simpan, tetap validasi required)
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });
  let invalid = false;
  if (!values.kategori_id) {
    errors.kategori_id = "Kategori wajib diisi";
    invalid = true;
  }
  if (!values.kode?.trim()) {
    errors.kode = "Kode wajib diisi";
    invalid = true;
  }
  if (!values.nama?.trim()) {
    errors.nama = "Nama COA wajib diisi";
    invalid = true;
  }
  if (!values.tipe_id) {
    errors.tipe_id = "Tipe wajib diisi";
    invalid = true;
  }
  if (values.has_parent && !values.parent_id) {
    errors.parent_id = "Parent COA wajib dipilih jika memiliki parent";
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
    const currentUserId = authStore.user?.id || null;
    const computedLevel = values.has_parent && values.parent_id ? Number(values.level || 1) : 0;
    values.level = computedLevel;

    // Clean payload: convert empty strings to null
    const payload = {
      kategori_id: values.kategori_id || null,
      has_parent: values.has_parent, // Boolean value, don't use || false
      kode: values.kode?.trim() || null,
      level: computedLevel,
      parent_id: values.has_parent ? (values.parent_id || null) : null,
      nama: values.nama?.trim() || null,
      tipe_id: values.tipe_id || null,
      catatan: values.catatan?.trim() || null,
      status: values.status,
      created_by: isEditMode.value ? (auditMeta.value.created_by || currentUserId) : currentUserId,
      updated_by: currentUserId,
    };

    if (isEditMode.value) {
      await updateCoa(menuId.value, payload as any);
      toast.success("COA berhasil diperbarui", {
        description: `COA "${values.nama}" telah diperbarui`,
      });
    } else {
      await createCoa(payload as any);
      toast.success("COA berhasil dibuat", {
        description: `COA "${values.nama}" telah ditambahkan`,
      });
    }
    router.replace("/accounting/master/m_coa?reload=" + Date.now());
  } catch (error) {
    toast.error(
      isEditMode.value ? "Gagal memperbarui Coa" : "Gagal membuat Coa",
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
  router.push("/accounting/master/m_coa");
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
      <Card>
        <CardHeader>
          <CardTitle>Informasi Coa</CardTitle>
          <CardDescription>
            Isi data Coa dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Status Field -->
            <FieldStatus
              label="Status"
              name="status"
              v-model="values.status"
              :disabled="loading"
              :readonly="isReadOnly"
              active-text="Aktif"
              inactive-text="Tidak Aktif"
            />

            <!-- Kategori Field -->
            <FieldPopup
              id="kategori_id"
              label="Kategori"
              :value="values.kategori_id"
              :displayValue="displayValues.kategori"
              :errorText="errors.kategori_id ? 'failed' : ''"
              @input="
                (v: string) => {
                  values.kategori_id = v;
                  if (!v) displayValues.kategori = '';
                }
              "
              @update:valueFull="
                (item: any) => {
                  displayValues.kategori = item?.value1 || '';
                }
              "
              :hints="errors.kategori_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              placeholder="Pilih Kategori"
              displayField="value1"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'value1,key1',
                  filter_column_group: 'KATEGORI COA',
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
                  field: 'key1',
                  headerName: 'Key',
                  width: '120px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'value1',
                  headerName: 'Kategori',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
              ]"
            />

            <!-- COA Parent Checkbox -->
            <div class="space-y-2">
              <Label class="text-sm font-medium">COA Parent</Label>
              <div class="flex items-center space-x-2">
                <input
                  type="checkbox"
                  v-model="values.has_parent"
                  :disabled="loading || isReadOnly"
                  class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                />
                <Label
                  class="text-sm font-normal leading-none cursor-pointer"
                  @click="
                    !loading &&
                    !isReadOnly &&
                    (values.has_parent = !values.has_parent)
                  "
                >
                  Ya
                </Label>
              </div>
            </div>

            <!-- Parent COA Field (Tampil jika COA Parent dicentang) -->
            <FieldPopup
              v-if="values.has_parent"
              id="parent_id"
              label="Parent COA"
              :value="values.parent_id"
              :displayValue="displayValues.parent"
              :errorText="errors.parent_id ? 'failed' : ''"
              :hints="errors.parent_id"
              :required="!isReadOnly"
              @input="
                (v: string) => {
                  values.parent_id = v;
                  if (!v) {
                    displayValues.parent = '';
                    values.level = 0;
                  } else {
                    errors.parent_id = '';
                  }
                }
              "
              @update:valueFull="handleParentSelected"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              placeholder="Pilih Parent COA"
              displayField="nama"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_coa`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'nama,kode',
                  filter_column_status: 'true',
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
                  field: 'kode',
                  headerName: 'Kode',
                  width: '120px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'nama',
                  headerName: 'Nama COA',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'level',
                  headerName: 'Level',
                  width: '80px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
              ]"
            />

            <!-- Kode Field -->
            <FieldX
              id="kode"
              label="Kode"
              :value="values.kode"
              :errorname="errors.kode ? 'failed' : ''"
              @input="(v) => (values.kode = v)"
              :hints="errors.kode"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Contoh: 005"
              class="w-full"
            />

            <!-- Nama COA Field -->
            <FieldX
              id="nama"
              label="Nama COA"
              :value="values.nama"
              :errorname="errors.nama ? 'failed' : ''"
              @input="(v) => (values.nama = v)"
              :hints="errors.nama"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Masukkan nama COA"
              class="w-full"
            />

            <!-- Level Field (Auto & Readonly) -->
            <FieldNumber
              id="level"
              label="Level"
              :value="values.level"
              :errorname="errors.level ? 'failed' : ''"
              :hints="errors.level"
              :required="false"
              :disabled="true"
              :readonly="true"
              placeholder="0"
              class="w-full"
            />

            <!-- Tipe Field -->
            <FieldPopup
              id="tipe_id"
              label="Tipe"
              :value="values.tipe_id"
              :displayValue="displayValues.tipe_id"
              :errorText="errors.tipe_id ? 'failed' : ''"
              @input="
                (v: string) => {
                  values.tipe_id = v;
                  if (!v) displayValues.tipe_id = '';
                }
              "
              @update:valueFull="
                (item: any) => {
                  displayValues.tipe_id = item?.value1 || '';
                }
              "
              :hints="errors.tipe_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              placeholder="Pilih Tipe"
              displayField="value1"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'value1,key1',
                  filter_column_group: 'TIPE COA',
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
                  field: 'key1',
                  headerName: 'Key',
                  width: '120px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'value1',
                  headerName: 'Tipe',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
              ]"
            />

          </div>

          <!-- Catatan (Full Width) -->
          <FieldTextarea
            id="catatan"
            label="Catatan"
            :value="values.catatan"
            @input="(v) => (values.catatan = v)"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            placeholder="Tambahkan sesuatu"
            class="w-full"
          />
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
</style>
