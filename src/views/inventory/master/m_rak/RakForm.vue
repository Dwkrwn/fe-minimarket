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
  FieldNumber,
  FieldStatus,
  FieldSelect,
  FieldTextarea,
} from "@/components/field";
import { ArrowLeft, Save, Loader2 } from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import { createRak, updateRak, getRakById } from "./service";
import AuditInfo from "@/components/AuditInfo.vue";

// ============================================================================
// SETUP
// ============================================================================
const authStore = useAuthStore();
const { API_BASE_URL } = useApi();
const router = useRouter();
const route = useRoute();

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
// STATE
// ============================================================================
const loading = ref(false);
const isEditMode = computed(
  () => !!route.params.id && route.name === "RakForm",
);
const isViewMode = computed(() => route.name === "RakView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Rak";
  if (isCopyMode.value) return "Salin Rak";
  if (isEditMode.value) return "Edit Rak";
  return "Tambah Rak Baru";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Rak";
  if (isCopyMode.value) return "Buat Rak baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Rak";
  return "Buat Rak baru";
});

// Form values - sesuai struktur m_rak
let values = reactive({
  kode_rak: "",
  nama_rak: "",
  m_unit_bisnis_id: "",
  m_gudang_id: "",
  jumlah_baris: null as number | null,
  jumlah_kolom: null as number | null,
  catatan: "",
  is_active: true,
  is_rak_opname: false,
});

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {};

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

// Detail array - m_rak_d
const detailArr = ref<any[]>([]);

// ============================================================================
// DETAIL METHODS - m_rak_d
// ============================================================================

const normalizePositiveInteger = (value: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : null;
};

// const buildDetailCode = (baris: number, kolom: number) => `B-${baris}-${kolom}`;
const buildDetailCode = (nama_blok:string, baris: number, kolom: number) => `${nama_blok}-${baris}-${kolom}`;

const syncDetailArr = () => {
  const nama_blok = values.nama_rak;
  const jumlahBaris = normalizePositiveInteger(values.jumlah_baris);
  const jumlahKolom = normalizePositiveInteger(values.jumlah_kolom);

  if (!jumlahBaris || !jumlahKolom) {
    detailArr.value = [];
    return;
  }

  const existingDetails = new Map(
    detailArr.value.map((detail) => [`${detail.baris}-${detail.kolom}`, detail]),
  );

  const nextDetails = [];

  for (let baris = 1; baris <= jumlahBaris; baris += 1) {
    for (let kolom = 1; kolom <= jumlahKolom; kolom += 1) {
      const key = `${baris}-${kolom}`;
      const existingDetail = existingDetails.get(key);
      nextDetails.push({
        id: existingDetail?.id,
        kode: existingDetail?.kode || buildDetailCode(values.nama_rak, baris, kolom),
        baris,
        kolom,
        is_active: existingDetail?.is_active ?? true,
      });
    }
  }

  detailArr.value = nextDetails;
};

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    kode_rak: "",
    nama_rak: "",
    m_unit_bisnis_id: "",
    m_gudang_id: "",
    jumlah_baris: null,
    jumlah_kolom: null,
    catatan: "",
    is_active: true,
    is_rak_opname: false,
  });

  // Reset errors
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });

  // Reset detail arrays
  detailArr.value = [];
};

// ============================================================================
// LIFECYCLE HOOKS - LOAD DATA BEFORE MOUNT
// ============================================================================
import { getGudangListNoPagination } from "../m_gudang/service";
const gudangOptions = ref<any[]>([]);
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

  // Fetch Gudang options for dropdown
  try {
    const resGudang = await getGudangListNoPagination();
    if (resGudang.status === "success") {
      gudangOptions.value = resGudang.data;
    }
  } catch (e) {
    // ignore error
  }

  // Check if copy mode via query param
  const isCopyModeLocal = route.query.action === "copy" && route.query.source;
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value;

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return;
  }

  loading.value = true;
  try {
    const res = await getRakById(sourceId);

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

    if (initialValues.is_rak_opname !== undefined) {
      const v = initialValues.is_rak_opname;
      initialValues.is_rak_opname = v === true || v === 1 || v === "1";
    } else {
      initialValues.is_rak_opname = false;
    }

    const loadedDetails =
      initialValues.m_rak_ds && Array.isArray(initialValues.m_rak_ds)
        ? initialValues.m_rak_ds.map((item: any) => ({
            id: isCopyModeLocal ? undefined : item.id,
            kode: item.kode || "",
            baris:
              typeof item.baris === "number"
                ? item.baris
                : Number(item.baris) || 0,
            kolom:
              typeof item.kolom === "number"
                ? item.kolom
                : Number(item.kolom) || 0,
            is_active: true,
          }))
        : [];

    // Mode copy: hapus id dan timestamps agar jadi create baru
    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
      delete (initialValues as any).created_by;
      delete (initialValues as any).update_by;
    }

    // Assign hanya key yang sudah ada di state reactive values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore dynamic assign
        values[key] = initialValues[key];
      }
    }

    detailArr.value = loadedDetails;
    syncDetailArr();

    if (isCopyModeLocal) {
      toast.success("Data berhasil disalin", {
        description: "Silakan edit dan simpan sebagai Rak baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Rak", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () => router.push("/inventory/master/m_rak"),
      },
    });
    setTimeout(() => router.push("/inventory/master/m_rak"), 2000);
  } finally {
    loading.value = false;
  }
});

// Errors object (manual validation)
const errors = reactive({
  nama_rak: "",
  m_unit_bisnis_id: "",
  m_gudang_id: "",
  jumlah_baris: "",
  jumlah_kolom: "",
});

watch(
  () => [values.jumlah_baris, values.jumlah_kolom, values.nama_rak],
  () => {
    syncDetailArr();
  },
);

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });
  let invalid = false;

  if (!values.nama_rak?.trim()) {
    errors.nama_rak = "Nama Blok wajib diisi";
    invalid = true;
  }
  if (isSuperAdmin.value && !values.m_unit_bisnis_id?.trim()) {
    errors.m_unit_bisnis_id = "Unit Bisnis wajib dipilih";
    invalid = true;
  }
  if (!values.m_gudang_id?.trim()) {
    errors.m_gudang_id = "Gudang wajib dipilih";
    invalid = true;
  }
  if (!normalizePositiveInteger(values.jumlah_baris)) {
    errors.jumlah_baris = "Jumlah baris wajib diisi";
    invalid = true;
  }
  if (!normalizePositiveInteger(values.jumlah_kolom)) {
    errors.jumlah_kolom = "Jumlah rak wajib diisi";
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
    const payload: any = {
      kode_rak: values.kode_rak?.trim() || null,
      nama_rak: values.nama_rak?.trim() || null,
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      m_gudang_id: values.m_gudang_id || null,
      jumlah_baris: normalizePositiveInteger(values.jumlah_baris),
      jumlah_kolom: normalizePositiveInteger(values.jumlah_kolom),
      catatan: values.catatan?.trim() || null,
      is_active: values.is_active,
      is_rak_opname: values.is_rak_opname,
      // Detail fields - m_rak_d
      m_rak_d: detailArr.value.length > 0 ? detailArr.value : undefined,
    };

    if (isEditMode.value) {
      payload.updated_by = authStore.user?.id || null;
      payload.update_by = authStore.user?.id || null;
      await updateRak(menuId.value, payload as any);
      toast.success("Rak berhasil diperbarui", {
        description: `Rak "${values.nama_rak}" telah diperbarui`,
      });
    } else {
      payload.created_by = authStore.user?.id || null;
      payload.updated_by = authStore.user?.id || null;
      payload.update_by = authStore.user?.id || null;
      await createRak(payload as any);
      toast.success("Rak berhasil dibuat", {
        description: `Rak "${values.nama_rak}" telah ditambahkan`,
      });
    }
    router.replace("/inventory/master/m_rak?reload=" + Date.now());
  } catch (error) {
    toast.error(
      isEditMode.value ? "Gagal memperbarui Rak" : "Gagal membuat Rak",
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
  router.push("/inventory/master/m_rak");
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
          <CardTitle>Informasi Rak</CardTitle>
          <CardDescription>
            Isi data Rak dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Kode Rak Field -->
            <FieldX
              id="kode_rak"
              label="Kode Rak (Opsional)"
              :value="values.kode_rak"
              @input="(v) => (values.kode_rak = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Kode akan digenerate otomatis jika kosong"
              class="w-full"
            />

            <!-- Nama Rak Field -->
            <FieldX
              id="nama_rak"
              label="Nama Blok"
              :value="values.nama_rak"
              :errorname="errors.nama_rak ? 'failed' : ''"
              @input="(v) => (values.nama_rak = v)"
              :hints="errors.nama_rak"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Contoh: Rak A1"
              class="w-full"
            />

            <!-- Unit Bisnis Field - Only for Super Admin -->
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

            <!-- Unit Bisnis Field - Display Only for Non-Super Admin -->
            <FieldX
              v-else
              id="company_display"
              label="Unit Bisnis"
              :value="companyNameDisplay"
              :disabled="true"
              :readonly="true"
              class="w-full"
            />

            <!-- Gudang Field -->
            <FieldSelect
              id="m_gudang_id"
              label="Gudang"
              :value="values.m_gudang_id"
              :errorname="errors.m_gudang_id ? 'failed' : ''"
              @input="(v) => (values.m_gudang_id = v)"
              :hints="
                errors.m_gudang_id ||
                (!values.m_unit_bisnis_id
                  ? 'Pilih Unit Bisnis terlebih dahulu'
                  : '')
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

            <!-- Jumlah Baris Field -->
            <FieldNumber
              id="jumlah_baris"
              label="Jumlah Baris"
              :value="values.jumlah_baris"
              :min="1"
              :errorname="errors.jumlah_baris ? 'failed' : ''"
              @input="
                (v) => (values.jumlah_baris = v === '' ? null : Number(v))
              "
              :hints="errors.jumlah_baris || 'Jumlah baris rak wajib diisi'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="0"
              class="w-full"
            />

            <!-- Jumlah Kolom Field -->
            <FieldNumber
              id="jumlah_kolom"
              label="Jumlah Kolom"
              :value="values.jumlah_kolom"
              :min="1"
              :errorname="errors.jumlah_kolom ? 'failed' : ''"
              @input="
                (v) => (values.jumlah_kolom = v === '' ? null : Number(v))
              "
              :hints="errors.jumlah_kolom || 'Jumlah rak per baris wajib diisi'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="0"
              class="w-full"
            />

            <!-- Catatan Field - Full Width -->
            <div class="md:col-span-2">
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
          </div>

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
              label="Rak Opname"
              name="is_rak_opname"
              v-model="values.is_rak_opname"
              :disabled="loading"
              :readonly="isReadOnly"
              active-text="Ya"
              inactive-text="Tidak"
            />
          </div>
        </CardContent>
      </Card>

      <!-- DETAIL SECTION-->
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Detail Rak</CardTitle>
            <CardDescription>
              Detail lokasi dibuat otomatis dari jumlah baris dan jumlah rak
            </CardDescription>
          </div>
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
                    Kode
                  </th>
                  <th
                    class="px-3 py-2 text-center font-medium text-xs sm:text-sm"
                  >
                    Baris
                  </th>
                  <th
                    class="px-3 py-2 text-center font-medium text-xs sm:text-sm"
                  >
                    Kolom
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="detailArr.length === 0">
                  <td
                    :colspan="4"
                    class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                  >
                    Isi jumlah baris dan jumlah rak untuk membuat detail otomatis
                  </td>
                </tr>
                <tr
                  v-for="(detail, index) in detailArr"
                  :key="index"
                  class="border-t hover:bg-muted/50"
                >
                  <td class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                    {{ index + 1 }}
                  </td>
                  <td class="px-3 py-2 text-xs sm:text-sm">
                    <input
                      v-if="!isReadOnly"
                      v-model="detail.kode"
                      type="text"
                      class="w-full px-2 py-1 border rounded text-xs sm:text-sm"
                      placeholder="Kode lokasi"
                    />
                    <span v-else>{{ detail.kode }}</span>
                  </td>
                  <td class="px-3 py-2 text-xs sm:text-sm">
                    <span class="block text-center">{{ detail.baris }}</span>
                  </td>
                  <td class="px-3 py-2 text-xs sm:text-sm">
                    <span class="block text-center">{{ detail.kolom }}</span>
                  </td>
                </tr>
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
