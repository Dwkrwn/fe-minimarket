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
  FieldDate,
  FieldUpload,
  FieldPopup,
  FieldSelect,
  FieldNumber,
} from "@/components/field";
import { createKary, updateKary, getKaryById } from "./service";
import { ArrowLeft, Save, Loader2 } from "lucide-vue-next";
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
  () => !!route.params.id && route.name === "KaryForm",
);
const isViewMode = computed(() => route.name === "KaryView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);
const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Karyawan";
  if (isCopyMode.value) return "Salin Karyawan";
  if (isEditMode.value) return "Edit Karyawan";
  return "Tambah Karyawan Baru";
});
const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Karyawan";
  if (isCopyMode.value) return "Buat Karyawan baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Karyawan";
  return "Buat Karyawan aplikasi baru";
});

// Reactive form values with defaults
let values = reactive({
  nama_kary: "",
  kode_kary: "",
  tgl_lhr: "",
  tgl_bergabung: "",
  tempat_lhr: "",
  jenis_kelamin: "",
  status_kawin: "",
  no_ktp: "",
  no_tlp: "",
  email: "",
  company_id: "",
  jabatan_id: "",
  m_unit_bisnis_id: "",
  foto_ktp: "",
  catatan: "",
  is_sales: false, // Default false
  is_active: true, // Default true
});

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {};

// ============================================================================
// COMPUTED - UNIT BISNIS INFO FROM SELECTRESPO
// ============================================================================
const unitBisnisNameDisplay = computed(() => {
  // Untuk non-super admin, ambil unit bisnis dari SelectRespo
  if (!authStore.isSuperAdmin) {
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

const syncCompanyFromUnitBisnis = (selectedUnitBisnis: any) => {
  if (!selectedUnitBisnis) return;
  values.company_id =
    selectedUnitBisnis?.company_id ||
    selectedUnitBisnis?.m_company?.id ||
    selectedUnitBisnis?.m_company_id ||
    "";
};

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    nama_kary: "",
    kode_kary: "",
    tgl_lhr: "",
    tgl_bergabung: "",
    tempat_lhr: "",
    jenis_kelamin: "",
    status_kawin: "",
    no_ktp: "",
    no_tlp: "",
    email: "",
    company_id: "",
    jabatan_id: "",
    m_unit_bisnis_id: "",
    foto_ktp: "",
    catatan: "",
    is_sales: false, // Default false
    is_active: true, // Default true
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
  if (!authStore.isSuperAdmin) {
    try {
      const selectRespo = localStorage.getItem("SelectRespo");
      if (selectRespo) {
        const parsed = JSON.parse(selectRespo);
        if (parsed.companyId) {
          values.m_unit_bisnis_id = parsed.companyId;
        }
      }
    } catch (e) {
      console.error("Failed to parse SelectRespo:", e);
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
    const res = await getKaryById(sourceId);

    if (res.status !== "success") throw new Error("Gagal memuat data");
    initialValues = res.data;

    // Minimal normalisasi (tidak sekompleks normalizeIncoming sebelumnya)
    // Pastikan boolean (API sudah boolean, tapi jaga-jaga kalau 1/0)
    if (initialValues.is_active !== undefined) {
      const v = initialValues.is_active;
      initialValues.is_active = v === true || v === 1 || v === "1";
    } else {
      initialValues.is_active = true;
    }

    // Convert datetime to date only for tgl_lhr
    if (initialValues.tgl_lhr) {
      // Convert "2025-11-16 07:00:00" to "2025-11-16"
      initialValues.tgl_lhr = initialValues.tgl_lhr.split(" ")[0];
    }

    // Convert datetime to date only for tgl_bergabung
    if (initialValues.tgl_bergabung) {
      // Convert "2025-11-16 07:00:00" to "2025-11-16"
      initialValues.tgl_bergabung = initialValues.tgl_bergabung.split(" ")[0];
    }

    // Mode copy: hapus id dan timestamps agar jadi create baru
    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
    }

    if (!initialValues.company_id) {
      initialValues.company_id =
        initialValues.m_company?.id ||
        initialValues.m_unit_bisnis?.m_company?.id ||
        initialValues.m_unit_bisni?.m_company?.id ||
        "";
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
        description: "Silakan edit dan simpan sebagai Kary baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Kary", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () => router.push("/setup/m_kary"),
      },
    });
    setTimeout(() => router.push("/setup/m_kary"), 2000);
  } finally {
    loading.value = false;
  }
});

// Errors object (manual validation)
const errors = reactive({
  nama_kary: "",
  kode_kary: "",
  email: "",
  no_ktp: "",
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
  if (!values.nama_kary?.trim()) {
    errors.nama_kary = "Nama karyawan wajib diisi";
    invalid = true;
  }
  // Email format validation if provided
  if (values.email?.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(values.email)) {
      errors.email = "Format email tidak valid";
      invalid = true;
    }
  }
  // KTP validation: if filled, must be exactly 16 digits
  if (values.no_ktp?.trim()) {
    const ktpDigits = values.no_ktp.trim().replace(/\D/g, ""); // Remove non-digits
    if (ktpDigits.length !== 16) {
      errors.no_ktp = "Nomor KTP harus 16 digit";
      invalid = true;
    }
  }
  if (invalid) {
    toast.error("Validasi gagal", {
      description: "Mohon lengkapi semua field yang wajib diisi dengan benar",
    });
    return;
  }

  loading.value = true;
  try {
    // Clean payload: convert empty strings to null
    const payload = {
      nama_kary: values.nama_kary?.trim() || null,
      kode_kary: values.kode_kary?.trim() || null,
      tgl_lhr: values.tgl_lhr || null,
      tgl_bergabung: values.tgl_bergabung || null,
      tempat_lhr: values.tempat_lhr?.trim() || null,
      jenis_kelamin: values.jenis_kelamin || null,
      status_kawin: values.status_kawin || null,
      no_ktp: values.no_ktp?.trim() || null,
      no_tlp: values.no_tlp?.trim() || null,
      email: values.email?.trim() || null,
      company_id: values.company_id || null,
      jabatan_id: values.jabatan_id || null,
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      foto_ktp: values.foto_ktp?.trim() || null,
      catatan: values.catatan?.trim() || null,
      is_sales: values.is_sales,
      is_active: values.is_active,
    };

    if (isEditMode.value) {
      await updateKary(menuId.value, payload as any);
      toast.success("Karyawan berhasil diperbarui", {
        description: `Data ${values.nama_kary} telah diperbarui`,
      });
    } else {
      await createKary(payload as any);
      toast.success("Karyawan berhasil dibuat", {
        description: `Data ${values.nama_kary} telah ditambahkan`,
      });
    }
    router.replace("/setup/m_kary?reload=" + Date.now());
  } catch (error) {
    toast.error(
      isEditMode.value ? "Gagal memperbarui Kary" : "Gagal membuat Kary",
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
  router.push("/setup/m_kary");
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
          <CardTitle>Informasi Kary</CardTitle>
          <CardDescription>
            Isi data Kary dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Kode Karyawan -->
            <FieldX
              id="kode_kary"
              label="Kode Karyawan"
              :value="values.kode_kary"
              :errorname="errors.kode_kary ? 'failed' : ''"
              @input="(v) => (values.kode_kary = v)"
              :hints="errors.kode_kary || 'Kode otomatis dari sistem'"
              :required="false"
              :disabled="loading"
              :readonly="true"
              placeholder="Auto-generated"
              class="w-full"
            />

            <!-- Company -->
            <FieldPopup
              v-if="authStore.isSuperAdmin"
              id="company_id"
              label="Company"
              :value="values.company_id"
              @input="
                (v: string) => {
                  const isChanged = values.company_id !== v;
                  values.company_id = v;
                  if (isChanged) {
                    values.m_unit_bisnis_id = '';
                  }
                }
              "
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              hints="Pilih master company"
              :clearable="true"
              displayField="nama"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_company`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'kode,nama,alamat,kota',
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
                  key: 'index',
                  label: 'No',
                  width: '60px',
                  sortable: false,
                  filterable: false,
                  render: (item: any, index: number) => index + 1,
                },
                {
                  field: 'kode',
                  headerName: 'Kode',
                  width: '150px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'nama',
                  headerName: 'Nama Company',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'kota',
                  headerName: 'Kota',
                  width: '150px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'telepon',
                  headerName: 'Telepon',
                  width: '150px',
                  sortable: true,
                  filterable: false,
                },
              ]"
              placeholder="Pilih company"
              class="w-full"
            />

            <!-- Unit Bisnis - Auto-fill untuk non-super admin -->
            <div v-if="!authStore.isSuperAdmin" class="w-full">
              <FieldX
                id="m_unit_bisnis_display"
                label="Unit Bisnis"
                :value="unitBisnisNameDisplay"
                :disabled="true"
                :readonly="true"
                placeholder="Unit bisnis dari respo"
                class="w-full"
                hints="Unit bisnis otomatis dari respo yang dipilih"
              />
            </div>
            <FieldPopup
              v-else
              id="m_unit_bisnis_id"
              label="Unit Bisnis (Opsional)"
              :value="values.m_unit_bisnis_id"
              @input="(v: string) => (values.m_unit_bisnis_id = v)"
              @update:valueFull="
                (obj: any) => {
                  syncCompanyFromUnitBisnis(obj);
                }
              "
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              hints="Pilih unit bisnis/cabang, boleh dikosongkan jika tidak diperlukan"
              :clearable="true"
              displayField="nama_comp"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'kode_unit_bisnis,nama_comp,pic',
                  ...(values.company_id
                    ? { filter_column_company_id: values.company_id }
                    : {}),
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
                  key: 'index',
                  label: 'No',
                  width: '60px',
                  sortable: false,
                  filterable: false,
                  render: (item: any, index: number) => index + 1,
                },
                {
                  field: 'kode_unit_bisnis',
                  headerName: 'Kode',
                  width: '150px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'nama_comp',
                  headerName: 'Nama Unit Bisnis',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'pic',
                  headerName: 'PIC',
                  width: '120px',
                  sortable: true,
                  filterable: false,
                },
                {
                  field: 'kota',
                  headerName: 'Kota',
                  width: '150px',
                  sortable: true,
                  filterable: false,
                },
              ]"
              placeholder="Pilih unit bisnis"
              class="w-full"
            />

            <!-- Tanggal Lahir -->
            <FieldDate
              id="tgl_bergabung"
              label="Tanggal Bergabung"
              v-model="values.tgl_bergabung"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih tanggal bergabung karyawan"
              class="w-full"
              clearable
            />

            <!-- Nama Karyawan -->
            <FieldX
              id="nama_kary"
              label="Nama Karyawan"
              :value="values.nama_kary"
              :errorname="errors.nama_kary ? 'failed' : ''"
              @input="(v) => (values.nama_kary = v)"
              :hints="errors.nama_kary"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Masukkan nama lengkap"
              class="w-full"
            />

            <!-- Tanggal Lahir -->
            <FieldDate
              id="tgl_lhr"
              label="Tanggal Lahir"
              v-model="values.tgl_lhr"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih tanggal lahir"
              class="w-full"
              clearable
            />

            <!-- Tempat Lahir -->
            <FieldX
              id="tempat_lhr"
              label="Tempat Lahir"
              :value="values.tempat_lhr"
              @input="(v) => (values.tempat_lhr = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Contoh: Jakarta"
              class="w-full"
            />

            <!-- Jenis Kelamin -->
            <FieldSelect
              id="jenis_kelamin"
              label="Jenis Kelamin"
              v-model="values.jenis_kelamin"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih jenis kelamin"
              :options="[
                { value: 'LAKI LAKI', label: 'LAKI LAKI' },
                { value: 'PEREMPUAN', label: 'PEREMPUAN' },
              ]"
              class="w-full"
            />

            <!-- Status Kawin -->
            <FieldSelect
              id="status_kawin"
              label="Status Perkawinan"
              v-model="values.status_kawin"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih status perkawinan"
              :options="[
                { value: 'BELUM KAWIN', label: 'BELUM KAWIN' },
                { value: 'KAWIN', label: 'KAWIN' },
                { value: 'DUDA', label: 'DUDA' },
                { value: 'JANDA', label: 'JANDA' },
              ]"
              class="w-full"
            />

            <!-- Nomor KTP -->
            <FieldX
              id="no_ktp"
              type="number"
              label="Nomor KTP"
              :value="values.no_ktp"
              :errorname="errors.no_ktp ? 'failed' : ''"
              @input="(v) => (values.no_ktp = v)"
              :hints="errors.no_ktp || '16 digit nomor KTP'"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="16 digit nomor KTP"
              class="w-full"
            />

            <!-- Nomor Telepon -->
            <FieldX
              id="no_tlp"
              type="tel"
              label="Nomor Telepon"
              :value="values.no_tlp"
              @input="(v) => (values.no_tlp = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Contoh: +62 812-3456-7890"
              class="w-full"
              hints="Hanya angka, +, -, spasi, dan kurung"
            />

            <!-- Email -->
            <FieldX
              id="email"
              label="Email"
              :value="values.email"
              :errorname="errors.email ? 'failed' : ''"
              @input="(v) => (values.email = v)"
              :hints="errors.email"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="email@example.com"
              class="w-full"
            />

            <!-- Jenis Karyawan -->
            <FieldSelect
              id="jabatan_id"
              label="Jenis Karyawan"
              :value="values.jabatan_id"
              @input="(v: string) => (values.jabatan_id = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih jenis karyawan"
              displayField="value1"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: (() => {
                  const params: Record<string, string> = {
                    no_pagination: 'true',
                    selectfield: 'id,value1',
                    filter_column_group: 'jenis_kary',
                    filter_column_is_active: 'true',
                  };
                  // Filter berdasarkan unit bisnis untuk non-super admin
                  if (!authStore.isSuperAdmin && values.m_unit_bisnis_id) {
                    params.filter_column_m_unit_bisnis_id =
                      values.m_unit_bisnis_id;
                  }
                  return params;
                })(),
              }"
              clearable
              class="w-full"
            />

            <!-- Foto KTP (Full Width) -->
            <FieldUpload
              id="foto_ktp"
              label="Foto KTP"
              :value="values.foto_ktp"
              @input="(v) => (values.foto_ktp = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              hints="Upload file gambar KTP (max 5MB)"
              accept="image/*"
            />
          </div>

          <!-- Catatan (Full Width) -->
          <FieldX
            id="catatan"
            type="textarea"
            label="Catatan"
            v-model="values.catatan"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            placeholder="Catatan tambahan tentang karyawan"
            :rows="4"
          />

          <!-- Sales Status -->
          <FieldStatus
            label="Karyawan Sales"
            name="is_sales"
            v-model="values.is_sales"
            :disabled="loading"
            :readonly="isReadOnly"
            active-text="Ya"
            inactive-text="Tidak"
          />

          <!-- Status -->
          <FieldStatus
            label="Status Aktif"
            name="is_active"
            v-model="values.is_active"
            :disabled="loading"
            :readonly="isReadOnly"
            active-text="Aktif"
            inactive-text="Tidak Aktif"
          />
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
</style>
