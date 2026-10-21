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
  FieldX,
  FieldStatus,
  FieldSelect,
  FieldUpload,
} from "@/components/field";
import { createGudang, updateGudang, getGudangById } from "./service";
import { ArrowLeft, Save, Loader2 } from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import AuditInfo from "@/components/AuditInfo.vue";

const authStore = useAuthStore();
const { API_BASE_URL } = useApi();

// Check if user is super admin
const isSuperAdmin = computed(() => authStore.isSuperAdmin);

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
// COMPOSABLES & STORES
// ============================================================================
const router = useRouter();
const route = useRoute();

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false);
const isEditMode = computed(
  () => !!route.params.id && route.name === "GudangForm",
);
const isViewMode = computed(() => route.name === "GudangView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);
const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Gudang";
  if (isCopyMode.value) return "Salin Gudang";
  if (isEditMode.value) return "Edit Gudang";
  return "Tambah Gudang Baru";
});
const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Gudang";
  if (isCopyMode.value) return "Buat Gudang baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Gudang";
  return "Buat Gudang baru";
});

// Reactive form values with defaults - sesuai API spec
let values = reactive({
  kode_gudang: "",
  nama_gudang: "",
  alamat_gudang: "",
  provinsi: "",
  kota: "",
  kecamatan: "",
  kode_pos: "",
  m_unit_bisnis_id: "",
  foto_gudang: "",
  catatan: "",
  is_active: true,
  is_gudang_transit: false,
  flag: "INV",
});

const flagOptions = [
  { label: "PROD", value: "PROD" },
  { label: "INV", value: "INV" },
];

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {};

const handleKodePosInput = (value: string) => {
  values.kode_pos = String(value || "").replace(/\D/g, "");
};

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    kode_gudang: "",
    nama_gudang: "",
    alamat_gudang: "",
    provinsi: "",
    kota: "",
    kecamatan: "",
    kode_pos: "",
    m_unit_bisnis_id: "",
    foto_gudang: "",
    catatan: "",
    is_active: true,
    is_gudang_transit: false,
    flag: "INV",
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
    const res = await getGudangById(sourceId);

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

    if (initialValues.is_gudang_transit !== undefined) {
      const v = initialValues.is_gudang_transit;
      initialValues.is_gudang_transit = v === true || v === 1 || v === "1";
    } else {
      initialValues.is_gudang_transit = false;
    }

    // Mode copy: hapus id dan timestamps agar jadi create baru
    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
      delete (initialValues as any).kode_gudang; // Kode akan di-generate ulang
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
        description: "Silakan edit dan simpan sebagai Gudang baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Gudang", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () => router.push("/inventory/master/m_gudang"),
      },
    });
    setTimeout(() => router.push("/inventory/master/m_gudang"), 2000);
  } finally {
    loading.value = false;
  }
});

// Errors object (manual validation)
const errors = reactive({
  nama_gudang: "",
  alamat_gudang: "",
  provinsi: "",
  kota: "",
  kecamatan: "",
  kode_pos: "",
  m_unit_bisnis_id: "",
  flag: "",
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

  if (!values.nama_gudang?.trim()) {
    errors.nama_gudang = "Nama Gudang wajib diisi";
    invalid = true;
  }
  if (!values.alamat_gudang?.trim()) {
    errors.alamat_gudang = "Alamat Gudang wajib diisi";
    invalid = true;
  }
  if (!values.provinsi?.trim()) {
    errors.provinsi = "Provinsi wajib diisi";
    invalid = true;
  }
  if (!values.kota?.trim()) {
    errors.kota = "Kota wajib diisi";
    invalid = true;
  }
  if (!values.kecamatan?.trim()) {
    errors.kecamatan = "Kecamatan wajib diisi";
    invalid = true;
  }
  if (!values.kode_pos?.trim()) {
    errors.kode_pos = "Kode Pos wajib diisi";
    invalid = true;
  }
  if (isSuperAdmin.value && !values.m_unit_bisnis_id?.trim()) {
    errors.m_unit_bisnis_id = "Unit Bisnis wajib dipilih";
    invalid = true;
  }
  if (!values.flag?.trim()) {
    errors.flag = "Flag wajib dipilih";
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
    // Clean payload: convert empty strings to null
    const payload = {
      nama_gudang: values.nama_gudang?.trim() || null,
      alamat_gudang: values.alamat_gudang?.trim() || null,
      provinsi: values.provinsi?.trim() || null,
      kota: values.kota?.trim() || null,
      kecamatan: values.kecamatan?.trim() || null,
      kode_pos: values.kode_pos?.trim() || null,
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      foto_gudang: values.foto_gudang || null,
      catatan: values.catatan?.trim() || null,
      is_active: values.is_active,
      is_gudang_transit: values.is_gudang_transit,
      flag: values.flag?.trim() || null,
    };

    if (isEditMode.value) {
      (payload as any).updated_by = authStore.user?.id || null;
      await updateGudang(menuId.value, payload as any);
      toast.success("Gudang berhasil diperbarui", {
        description: `Gudang "${values.nama_gudang}" telah diperbarui`,
      });
    } else {
      (payload as any).created_by = authStore.user?.id || null;
      (payload as any).updated_by = authStore.user?.id || null;
      await createGudang(payload as any);
      toast.success("Gudang berhasil dibuat", {
        description: `Gudang "${values.nama_gudang}" telah ditambahkan`,
      });
    }
    router.replace("/inventory/master/m_gudang?reload=" + Date.now());
  } catch (error) {
    toast.error(
      isEditMode.value ? "Gagal memperbarui Gudang" : "Gagal membuat Gudang",
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
  router.push("/inventory/master/m_gudang");
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
          <CardTitle>Informasi Gudang</CardTitle>
          <CardDescription>
            Isi data gudang dengan lengkap. Nama Gudang, Alamat, Provinsi, Kota,
            Kecamatan, dan Kode Pos wajib diisi.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
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

            <!-- Kode Gudang (Auto-generated, Read-only) -->
            <FieldX
              id="kode_gudang"
              label="Kode Gudang"
              :value="values.kode_gudang"
              @input="(v) => (values.kode_gudang = v)"
              :required="false"
              :disabled="true"
              :readonly="true"
              placeholder="Auto-generated by System"
              hints="Kode akan digenerate otomatis oleh sistem"
              class="w-full"
            />

            <!-- Nama Gudang (Required) -->
            <FieldX
              id="nama_gudang"
              label="Nama Gudang"
              :value="values.nama_gudang"
              :errorname="errors.nama_gudang ? 'failed' : ''"
              @input="(v) => (values.nama_gudang = v)"
              :hints="errors.nama_gudang"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Contoh: Gudang Utama Jakarta"
              class="w-full"
            />

            <!-- Flag Gudang (Required: PROD / INV) -->
            <FieldSelect
              id="flag"
              label="Flag"
              v-model="values.flag"
              :options="flagOptions"
              :errorname="errors.flag ? 'failed' : ''"
              :hints="errors.flag || 'Pilih flag gudang (PROD / INV)'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih Flag (PROD / INV)"
              class="w-full"
            />

            <!-- Provinsi (Required) - Cascading Select -->
            <FieldSelect
              id="provinsi"
              label="Provinsi"
              :value="values.provinsi"
              @input="
                (v: any) => {
                  values.provinsi = v;
                  values.kota = '';
                  values.kecamatan = '';
                }
              "
              @update:valueFull="
                (objVal: any) => {
                  if (!objVal) {
                    values.kota = '';
                    values.kecamatan = '';
                  }
                }
              "
              :api="
                {
                  url: 'https://backend.qqltech.com/kodepos/region/provinsi',
                  params: {
                    search: '',
                    searchfield: 'name',
                    selectfield: 'name,id',
                    paginate: 35,
                  },
                  fullUrl: true,
                } as any
              "
              :bind="{ disabled: loading || isReadOnly, clearable: true }"
              :errorname="errors.provinsi ? 'failed' : ''"
              :hints="errors.provinsi"
              :required="!isReadOnly"
              placeholder="Pilih Provinsi"
              class="w-full"
            />

            <!-- Kota (Required) - Dependent on Provinsi -->
            <FieldSelect
              id="kota"
              label="Kota"
              :value="values.kota"
              @input="
                (v: any) => {
                  values.kota = v;
                  values.kecamatan = '';
                }
              "
              @update:valueFull="
                (objVal: any) => {
                  if (!objVal) values.kecamatan = '';
                }
              "
              :api="
                {
                  url: 'https://backend.qqltech.com/kodepos/region/kabupaten-kota',
                  params: {
                    provinsi: values.provinsi,
                    search: '',
                    searchfield: 'name',
                    selectfield: 'name,id',
                    paginate: 35,
                  },
                  fullUrl: true,
                } as any
              "
              :bind="{
                disabled: !values.provinsi || loading || isReadOnly,
                clearable: true,
              }"
              :errorname="errors.kota ? 'failed' : ''"
              :hints="errors.kota"
              :required="!isReadOnly"
              placeholder="Pilih Kota"
              class="w-full"
            />

            <!-- Kecamatan (Required) - Dependent on Kota -->
            <FieldSelect
              id="kecamatan"
              label="Kecamatan"
              :value="values.kecamatan"
              @input="(v: any) => (values.kecamatan = v)"
              :api="
                {
                  url: 'https://backend.qqltech.com/kodepos/region/kecamatan',
                  params: { kota: values.kota },
                  fullUrl: true,
                } as any
              "
              valueField="key"
              displayField="key"
              :bind="{
                disabled: !values.kota || loading || isReadOnly,
                clearable: true,
              }"
              :errorname="errors.kecamatan ? 'failed' : ''"
              :hints="errors.kecamatan"
              :required="!isReadOnly"
              placeholder="Pilih Kecamatan"
              class="w-full"
            />

            <!-- Kode Pos (Required) -->
            <FieldX
              id="kode_pos"
              type="number"
              label="Kode Pos"
              :value="values.kode_pos"
              @input="handleKodePosInput"
              :errorname="errors.kode_pos ? 'failed' : ''"
              :hints="errors.kode_pos"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="12345"
              class="w-full"
            />
          </div>

          <!-- Alamat Gudang (Full Width, Required) - Textarea -->
          <FieldX
            id="alamat_gudang"
            type="textarea"
            label="Alamat Gudang"
            :value="values.alamat_gudang"
            @input="(v) => (values.alamat_gudang = v)"
            :errorname="errors.alamat_gudang ? 'failed' : ''"
            :hints="errors.alamat_gudang"
            :required="!isReadOnly"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            placeholder="Alamat lengkap gudang..."
            :rows="3"
            class="w-full"
          />

          <!-- Foto Gudang (Upload) -->
          <FieldUpload
            id="foto_gudang"
            label="Foto Gudang (Opsional)"
            :value="values.foto_gudang"
            @input="(v) => (values.foto_gudang = v)"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            hints="Upload file gambar gudang (max 5MB)"
            accept="image/*"
          />

          <!-- Catatan (Full Width, Optional) -->
          <FieldX
            id="catatan"
            type="textarea"
            label="Catatan (Opsional)"
            v-model="values.catatan"
            :required="false"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            placeholder="Catatan tambahan tentang gudang..."
            :rows="3"
          />

          <!-- Status -->
          <div class="flex flex-wrap gap-8 items-center">
            <FieldStatus
              label="Status Aktif"
              name="is_active"
              v-model="values.is_active"
              :disabled="loading"
              :readonly="isReadOnly"
              active-text="Aktif"
              inactive-text="Tidak Aktif"
            />
            <FieldStatus
              label="Gudang Transit"
              name="is_gudang_transit"
              v-model="values.is_gudang_transit"
              :disabled="loading"
              :readonly="isReadOnly"
              active-text="Ya"
              inactive-text="Tidak"
            />
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
</style>
