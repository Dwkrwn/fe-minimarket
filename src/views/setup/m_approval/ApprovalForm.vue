<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed, watchEffect } from "vue";
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
  FieldNumber,
  FieldStatus,
  FieldSelect,
  FieldPopup,
} from "@/components/field";
import { ButtonMultiSelect } from "@/components/button";
import { DeleteButton } from "@/components/button";
import { Trash2 } from "lucide-vue-next";
import { ArrowLeft, Save, Loader2 } from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { apiCall } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import {
  createApproval,
  updateApproval,
  getApprovalById,
  type ApprovalDItem,
} from "./service";

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
  () => !!route.params.id && route.name === "ApprovalForm",
);
const isViewMode = computed(() => route.name === "ApprovalView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Approval";
  if (isCopyMode.value) return "Salin Approval";
  if (isEditMode.value) return "Edit Approval";
  return "Tambah Approval Baru";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Approval";
  if (isCopyMode.value) return "Buat Approval baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Approval";
  return "Buat Approval aplikasi baru";
});

// Format helper for Indonesian thousand separators
const formatIdNumber = (val: any) => {
  const n = Number(
    String(val ?? "")
      .toString()
      .replace(/\./g, ""),
  );
  if (isNaN(n)) return "0";
  return new Intl.NumberFormat("id-ID").format(n);
};

// Format Rupiah with Rp prefix
const formatIDR = (val: any) => {
  const n = Number(
    String(val ?? "")
      .toString()
      .replace(/\./g, ""),
  );
  if (isNaN(n)) return "Rp 0";
  return `Rp ${new Intl.NumberFormat("id-ID").format(n)}`;
};

// Format percent with leading % as requested
const formatPercentPrefix = (val: any) => {
  const n = Number(
    String(val ?? "")
      .toString()
      .replace(/\./g, ""),
  );
  if (isNaN(n)) return "% 0";
  return `% ${new Intl.NumberFormat("id-ID").format(n)}`;
};

// Form values - m_approval schema
let values = reactive({
  kode_approval: "",
  nama_approval: "",
  m_menu_id: "",
  catatan: "",
  is_use_limit: false,
  min_val: 0,
  max_val: 0,
  is_active: true,
});

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {};

// Detail arrays - m_approval_ds (approval workflow details)
const detailArr = ref<ApprovalDItem[]>([]);

// Cache TIPE APPROVAL options to resolve id -> label (e.g., MENGAJUKAN)
const tipeApprovalMap = ref<Record<string, string>>({});

// Check if a tipe by id is MENGAJUKAN (using direct ID comparison)
const MENGAJUKAN_ID = "2c04a45b-94c1-4f18-8803-61d48636d2e9";
const isMengajukanById = (id?: string | number) => {
  if (!id) return false;
  return String(id) === MENGAJUKAN_ID;
};

// Check if the current detail row should have level disabled
const isLevelDisabled = (detail: any) => {
  // Use id->label map so UI reacts instantly to selection changes
  return isMengajukanById(detail?.tipe_approval_id);
};

// Handle tipe change: set id and enforce level=0 when MENGAJUKAN, level=1 when others
const handleTipeChange = (detail: any, tipeId: string) => {
  detail.tipe_approval_id = tipeId;
  // Clear stale included relation label to avoid mismatch
  if (detail.tipe) detail.tipe = undefined;
  if (isMengajukanById(tipeId)) {
    detail.level = 0;
    toast.info("Level otomatis diset ke 0 untuk tipe MENGAJUKAN");
  } else {
    // Untuk tipe selain MENGAJUKAN, minimal level = 1
    if (!detail.level || detail.level < 1) {
      detail.level = 1;
      toast.info("Level otomatis diset ke 1 untuk tipe MENYETUJUI");
    }
  }
};

// Handle level input with validation for MENGAJUKAN and MENYETUJUI types
const handleLevelInput = (detail: any, newValue: string) => {
  const numValue = Number(newValue);

  // If tipe is MENGAJUKAN, always force to 0
  if (isMengajukanById(detail?.tipe_approval_id)) {
    if (numValue !== 0) {
      toast.warning("Peringatan: Level untuk tipe MENGAJUKAN harus 0", {
        description: "Level otomatis dikembalikan ke 0",
      });
      detail.level = 0;
      return;
    }
  } else {
    // If tipe is not MENGAJUKAN (MENYETUJUI), minimal level = 1
    if (numValue < 1) {
      toast.warning("Peringatan: Level untuk tipe MENYETUJUI minimal 1", {
        description: "Level otomatis diset ke 1",
      });
      detail.level = 1;
      return;
    }
  }

  detail.level = numValue;
};

// ============================================================================
// DETAIL METHODS - m_approval_ds
// ============================================================================

const addDetailArr = () => {
  detailArr.value.push({
    level: 0,
    tipe_approval_id: MENGAJUKAN_ID, // Default to MENGAJUKAN
    // max_disc_value: 0, // reserved for DB compat
    is_full: false,
    is_active: true,
    tipe_approval: "USER", // NEW: default USER
    respo_id: "", // NEW
    approval_role: null, // NEW
  });

  toast.info("Detail approval ditambahkan dengan tipe MENGAJUKAN (Level 0)");
};

const removeDetailArr = (index: number) => {
  detailArr.value.splice(index, 1);
  toast.info("Detail approval dihapus");
};

const handleApproverTypeChange = (detail: any, value: string) => {
  detail.tipe_approval = value === "RESPO" ? "RESPO" : "USER";

  if (detail.tipe_approval === "USER") {
    detail.respo_id = "";
    detail.respo = undefined;
    return;
  }

  detail.user_default_id = "";
  detail.user = undefined;
};

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    kode_approval: "",
    nama_approval: "",
    m_menu_id: "",
    catatan: "",
    is_use_limit: false,
    min_val: 0,
    max_val: 0,
    is_active: true,
  });

  // Reset errors
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });

  // Reset detail arrays - DYNAMIC
  detailArr.value = [];
};

// ============================================================================
// LIFECYCLE HOOKS - LOAD DATA BEFORE MOUNT
// ============================================================================
onBeforeMount(async () => {
  onReset();

  // Prefetch TIPE APPROVAL list to map id -> label (ALWAYS load, even for create mode)
  try {
    const tipeRes: any = await apiCall(
      `/dynamic/m_general?no_pagination=true&selectfield=id,value1&filter_column_group=TIPE%20APPROVAL&filter_column_is_active=true`,
    );
    const list: any[] = Array.isArray(tipeRes?.data) ? tipeRes.data : [];
    tipeApprovalMap.value = list.reduce(
      (acc: Record<string, string>, x: any) => {
        if (x?.id) acc[String(x.id)] = x?.value1 ?? "";
        return acc;
      },
      {},
    );
  } catch (e) {
    tipeApprovalMap.value = {};
  }

  // Check if copy mode via query param
  const isCopyModeLocal = route.query.action === "copy" && route.query.source;
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value;

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return;
  }

  loading.value = true;
  try {
    const res = await getApprovalById(sourceId);

    if (res.status !== "success") throw new Error("Gagal memuat data");
    initialValues = res.data;

    // Minimal normalisasi
    if (initialValues.is_active !== undefined) {
      const v = initialValues.is_active;
      initialValues.is_active = v === true || v === 1 || v === "1";
    } else {
      initialValues.is_active = true;
    }

    // Load detail items - m_approval_ds
    if (
      initialValues.m_approval_ds &&
      Array.isArray(initialValues.m_approval_ds)
    ) {
      detailArr.value = initialValues.m_approval_ds.map((item: any) => ({
        level: item.level ?? 0,
        m_unit_bisnis_id: item.m_unit_bisnis_id ?? "",
        // max_disc_value: item.max_disc_value ?? 0, // reserved for DB compat
        is_full: item.is_full ?? false,
        user_default_id: item.user_default_id ?? "",
        tipe_approval_id: item.tipe_approval_id ?? "",
        is_active: item.is_active ?? true,
        // Map backend relations to local display keys
        unit_bisnis: item.company_approval, // from m_unit_bisnis include
        user: item.user, // from user_default include
        tipe: item.tipe_approv, // from m_general include
        tipe_approval: item.tipe_approval ?? "USER",
        respo_id: item.respo_id ?? "",
        approval_role: item.approval_role ?? null,
        respo: item.respo ?? null,
      }));

      // Enforce rule: if tipe is MENGAJUKAN, force level=0
      detailArr.value.forEach((d) => {
        if (isMengajukanById(d?.tipe_approval_id)) {
          d.level = 0;
        }
      });
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

    // Assign header-level fields (diluar dynamic loop karena mungkin belum ada di data lama)
    values.is_use_limit = initialValues.is_use_limit ?? false;
    values.min_val = Number(initialValues.min_val ?? 0);
    values.max_val = Number(initialValues.max_val ?? 0);

    if (isCopyModeLocal) {
      toast.success("Data berhasil disalin", {
        description: "Silakan edit dan simpan sebagai Approval baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Approval", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () => router.push("/setup/m_approval"),
      },
    });
    setTimeout(() => router.push("/setup/m_approval"), 2000);
  } finally {
    loading.value = false;
  }
});

// Enforce: whenever tipe is MENGAJUKAN, force level to 0; otherwise enforce minimal level = 1
watchEffect(() => {
  detailArr.value.forEach((d) => {
    if (isMengajukanById(d?.tipe_approval_id)) {
      if (d.level !== 0) {
        d.level = 0;
      }
    } else {
      // Untuk tipe selain MENGAJUKAN, minimal level = 1
      if ((d.level ?? 0) < 1) {
        d.level = 1;
      }
    }

    if (d.tipe_approval === "RESPO") {
      d.user_default_id = "";
      d.user = undefined;
    } else {
      d.tipe_approval = "USER";
      d.respo_id = "";
      d.respo = undefined;
    }
  });
});

// Errors object (manual validation)
const errors = reactive({
  kode_approval: "",
  nama_approval: "",
  m_menu_id: "",
  catatan: "",
  is_use_limit: "",
  min_val: "",
  max_val: "",
});

// ============================================================================
// SAVE HANDLER - SAMA SEPERTI Form.txt + DETAIL
// ============================================================================
const onSave = async () => {
  // Validasi required
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });
  let invalid = false;
  if (!values.nama_approval?.trim()) {
    errors.nama_approval = "Nama Approval wajib diisi";
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
    // Helper to normalize empty string to null
    const toNull = (v: any) => (v === "" || v === undefined ? null : v);

    // Build detail payload: remove view-only props and normalize empties/numbers
    const details = detailArr.value.map((d) => ({
      level: Number(d.level ?? 0),
      m_unit_bisnis_id: toNull(d.m_unit_bisnis_id),
      // max_disc_value: Number(d.max_disc_value ?? 0), // reserved for DB compat
      is_full: d.is_full === true,
      user_default_id: toNull(d.user_default_id),
      tipe_approval_id: toNull(d.tipe_approval_id),
      is_active: d.is_active !== false,
      tipe_approval: d.tipe_approval ?? "USER",
      respo_id: d.tipe_approval === "RESPO" ? d.respo_id || null : null,
      approval_role: d.approval_role || null,
    }));

    // Clean payload: convert empty strings to null + include sanitized details
    const payload: any = {
      kode_approval: values.kode_approval?.trim() || null,
      nama_approval: values.nama_approval?.trim() || null,
      m_menu_id: values.m_menu_id?.trim() || null,
      catatan: values.catatan?.trim() || null,
      is_use_limit: values.is_use_limit ?? false,
      min_val: values.is_use_limit ? Number(values.min_val ?? 0) : null,
      max_val: values.is_use_limit ? Number(values.max_val ?? 0) : null,
      is_active: values.is_active,
      // Detail fields - m_approval_ds
      m_approval_ds: details,
    };

    console.log("Payload to save:", payload);
    if (isEditMode.value) {
      await updateApproval(menuId.value, payload as any);
      toast.success("Approval berhasil diperbarui", {
        description: `Approval "${values.nama_approval}" telah diperbarui`,
      });
    } else {
      await createApproval(payload as any);
      toast.success("Approval berhasil dibuat", {
        description: `Approval "${values.nama_approval}" telah ditambahkan`,
      });
    }
    router.replace("/setup/m_approval?reload=" + Date.now());
  } catch (error) {
    toast.error(
      isEditMode.value
        ? "Gagal memperbarui Approval"
        : "Gagal membuat Approval",
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
  router.push("/setup/m_approval");
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
          <CardTitle>Informasi Approval</CardTitle>
          <CardDescription>
            Isi data Approval dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Kode Approval Field (Auto-generated, readonly) -->
            <FieldX
              id="kode_approval"
              label="Kode Approval (Opsional)"
              :value="values.kode_approval"
              :errorname="errors.kode_approval ? 'failed' : ''"
              @input="(v) => (values.kode_approval = v)"
              :hints="
                errors.kode_approval ||
                'Kode akan digenerate otomatis oleh sistem'
              "
              :required="false"
              :disabled="true"
              :readonly="true"
              placeholder="Auto-generated"
              class="w-full"
            />

            <!-- Nama Approval Field -->
            <FieldX
              id="nama_approval"
              label="Nama Approval"
              :value="values.nama_approval"
              :errorname="errors.nama_approval ? 'failed' : ''"
              @input="(v) => (values.nama_approval = v)"
              :hints="errors.nama_approval"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Contoh: Approval Pembelian"
              class="w-full"
            />

            <!-- Menu Field -->
            <FieldPopup
              id="m_menu_id"
              label="Menu"
              :value="values.m_menu_id"
              @input="(v: string) => (values.m_menu_id = v)"
              :errorText="errors.m_menu_id ? 'failed' : ''"
              :hints="errors.m_menu_id || 'Pilih menu terkait approval'"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              displayField="path"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_menu`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'name',
                  filter_column_is_active: 'true',
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
                  field: 'name',
                  headerName: 'Nama Menu',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'modul',
                  headerName: 'Modul',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'sub_modul',
                  headerName: 'Sub Modul',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'path',
                  headerName: 'Path Menu',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
              ]"
              placeholder="Pilih menu"
              :clearable="true"
              class="w-full"
            />
          </div>

          <!-- Catatan Field (Full Width) -->
          <FieldX
            id="catatan"
            type="textarea"
            label="Catatan (Opsional)"
            v-model="values.catatan"
            :hints="
              errors.catatan ||
              'Catatan atau deskripsi tambahan untuk approval ini'
            "
            :required="false"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            placeholder="Masukkan catatan atau deskripsi"
            :rows="4"
          />

          <div class="flex items-center gap-5">
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
            <!-- Transaction Limit Toggle -->
            <FieldStatus
              label="Gunakan Limit Transaksi"
              name="is_use_limit"
              v-model="values.is_use_limit"
              :disabled="loading"
              :readonly="isReadOnly"
              active-text="Aktif"
              inactive-text="Tidak Aktif"
            />

            <!-- Transaction Limit Settings -->
            <div
              v-if="values.is_use_limit"
              class="w-full flex items-center space-x-4"
            >
              <FieldNumber
                id="min_val"
                label="Minimal Nominal"
                v-model="values.min_val"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="0"
                class="w-full"
              />
              <FieldNumber
                id="max_val"
                label="Maksimal Nominal"
                v-model="values.max_val"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="0"
                class="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- DETAIL TABS (di bawah header card) -->
      <Tabs default-value="detail1" class="w-full">
        <TabsList
          class="w-full overflow-x-auto flex justify-start scrollbar-hide"
        >
          <TabsTrigger value="detail1">Detail Approval</TabsTrigger>
        </TabsList>

        <!-- DETAIL TAB CONTENTS - DYNAMIC GENERATION -->

        <!-- TAB CONTENT: DETAIL 1 (m_approval_ds - Approval Workflow) -->
        <TabsContent value="detail1" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Approval Workflow</CardTitle>
                  <CardDescription
                    >Kelola level approval dengan approver, unit bisnis, dan
                    aturan transaksi
                  </CardDescription>
                </div>
                <Button
                  v-if="!isReadOnly"
                  @click="addDetailArr"
                  size="sm"
                  variant="outline"
                >
                  + Tambah Level
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <div class="min-w-[150%]">
                  <table class="w-full text-sm">
                    <thead class="bg-muted">
                      <tr>
                        <th class="px-2 py-2 text-left font-medium text-xs">
                          No
                        </th>
                        <th
                          v-if="!isReadOnly"
                          class="px-2 py-2 text-left font-medium text-xs"
                        >
                          Aksi
                        </th>

                        <th class="px-2 py-2 text-left font-medium text-xs">
                          Level
                        </th>

                        <th class="px-3 py-2 text-left font-medium text-xs">
                          Tipe
                        </th>
                        <th class="px-3 py-2 text-left font-medium text-xs">
                          Tipe Approver
                        </th>
                        <th class="px-3 py-2 text-left font-medium text-xs">
                          User
                        </th>
                        <th class="px-3 py-2 text-left font-medium text-xs">
                          Respo
                        </th>
                        <!-- <th class="px-3 py-2 text-left font-medium text-xs">
                          Role Approval
                        </th> -->

                        <!-- <th class="px-2 py-2 text-left font-medium text-xs">
                          Max Disc Rp
                        </th> -->

                        <th class="px-2 py-2 text-left font-medium text-xs">
                          Full
                        </th>
                        <th class="px-2 py-2 text-left font-medium text-xs">
                          Aktif
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-if="detailArr.length === 0">
                        <td
                          colspan="12"
                          class="text-center py-8 text-muted-foreground text-xs"
                        >
                          Belum ada detail approval. Level 0 = Submitter, Level
                          1-100 = Approver
                        </td>
                      </tr>
                      <tr
                        v-for="(detail, index) in detailArr"
                        :key="index"
                        class="border-t hover:bg-muted/50"
                      >
                        <!-- No -->
                        <td
                          class="px-2 py-2 text-xs text-center whitespace-nowrap"
                        >
                          {{ index + 1 }}
                        </td>
                        <!-- Actions -->
                        <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            @click="removeDetailArr(index)"
                            class="h-7 w-7"
                          >
                            <Trash2 class="h-3 w-3 text-destructive" />
                          </Button>
                        </td>

                        <!-- Level -->
                        <td class="px-2 py-2 text-xs min-w-20">
                          <FieldNumber
                            v-if="!isReadOnly"
                            :id="`level_${index}`"
                            :value="detail.level ?? 0"
                            @input="(v: string) => handleLevelInput(detail, v)"
                            :min="
                              isMengajukanById(detail.tipe_approval_id) ? 0 : 1
                            "
                            :max="100"
                            :placeholder="
                              isMengajukanById(detail.tipe_approval_id)
                                ? '0'
                                : '1-100'
                            "
                            :disabled="isLevelDisabled(detail)"
                            :readonly="isLevelDisabled(detail)"
                            class="text-xs"
                          />
                          <span v-else class="block text-center">{{
                            detail.level ?? 0
                          }}</span>
                        </td>

                        <!-- Tipe Approval -->
                        <td class="px-2 py-2 text-xs min-w-[150px]">
                          <FieldSelect
                            v-if="!isReadOnly"
                            :id="`tipe_${index}`"
                            :value="detail.tipe_approval_id ?? ''"
                            @input="(v: string) => handleTipeChange(detail, v)"
                            :clearable="false"
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
                                selectfield: 'id,value1',
                                filter_column_group: 'TIPE APPROVAL',
                                filter_column_is_active: 'true',
                              },
                            }"
                            placeholder="Pilih tipe"
                            class="text-xs"
                          />
                          <span v-else class="text-xs">{{
                            detail.tipe?.value1 ?? "-"
                          }}</span>
                        </td>

                        <!-- Tipe Approver: USER / RESPO -->
                        <td class="px-2 py-2 text-xs min-w-[120px]">
                          <select
                            v-if="!isReadOnly"
                            :value="detail.tipe_approval ?? 'USER'"
                            class="w-full px-2 py-1 text-xs border rounded bg-background focus:ring-2 focus:ring-primary"
                            @change="
                              (event) =>
                                handleApproverTypeChange(
                                  detail,
                                  (event.target as HTMLSelectElement).value,
                                )
                            "
                          >
                            <option value="USER">User</option>
                            <option value="RESPO">Respo</option>
                          </select>
                          <span v-else class="text-xs">{{
                            detail.tipe_approval ?? "USER"
                          }}</span>
                        </td>

                        <!-- User Default -->
                        <td class="px-2 py-2 text-xs min-w-[150px]">
                          <FieldSelect
                            v-if="
                              !isReadOnly &&
                              (detail.tipe_approval ?? 'USER') === 'USER'
                            "
                            :id="`user_${index}`"
                            :value="detail.user_default_id ?? ''"
                            @input="(v: string) => (detail.user_default_id = v)"
                            :clearable="true"
                            displayField="name"
                            valueField="id"
                            :api="{
                              url: `${API_BASE_URL}/dynamic/user_default`,
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${authStore.token}`,
                              },
                              params: {
                                no_pagination: 'true',
                                selectfield: 'id,name',
                                filter_column_is_active: 'true',
                              },
                            }"
                            placeholder="Pilih user"
                            class="text-xs"
                          />
                          <span
                            v-else-if="
                              isReadOnly &&
                              (detail.tipe_approval ?? 'USER') === 'USER'
                            "
                            class="text-xs"
                            >{{ detail.user?.name ?? "-" }}</span
                          >
                          <span v-else class="text-xs text-muted-foreground"
                            >-</span
                          >
                        </td>

                        <!-- Respo (hanya tampil jika tipe_approval = RESPO) -->
                        <td class="px-2 py-2 text-xs min-w-[150px]">
                          <FieldSelect
                            v-if="
                              !isReadOnly && detail.tipe_approval === 'RESPO'
                            "
                            :id="`respo_${index}`"
                            :value="detail.respo_id ?? ''"
                            @input="(v: string) => (detail.respo_id = v)"
                            :clearable="true"
                            displayField="nama"
                            valueField="id"
                            :api="{
                              url: `${API_BASE_URL}/dynamic/m_respo`,
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${authStore.token}`,
                              },
                              params: {
                                no_pagination: 'true',
                                selectfield: 'id,nama',
                                filter_column_is_active: 'true',
                              },
                            }"
                            placeholder="Pilih respo"
                            class="text-xs"
                          />
                          <span v-else-if="isReadOnly" class="text-xs">{{
                            detail.respo?.nama ?? "-"
                          }}</span>
                          <span v-else class="text-xs text-muted-foreground"
                            >-</span
                          >
                        </td>

                        <!-- Role Approval: GUDANG_TUJUAN / GUDANG_ASAL / - -->
                        <!-- <td class="px-2 py-2 text-xs min-w-[140px]">
                          <select
                            v-if="!isReadOnly"
                            v-model="detail.approval_role"
                            class="w-full px-2 py-1 text-xs border rounded bg-background focus:ring-2 focus:ring-primary"
                          >
                            <option :value="null">-</option>
                            <option value="GUDANG_TUJUAN">Gudang Tujuan</option>
                            <option value="GUDANG_ASAL">Gudang Asal</option>
                          </select>
                          <span v-else class="text-xs">{{ detail.approval_role ?? '-' }}</span>
                        </td> -->

                        <!-- Max Disc Value (reserved, not actively used) -->
                        <!-- <td class="px-2 py-2 text-xs min-w-[120px]">
                          <FieldNumber
                            v-if="!isReadOnly"
                            :id="`disc_val_${index}`"
                            :value="detail.max_disc_value ?? 0"
                            @input="
                              (v: string) => (detail.max_disc_value = Number(v))
                            "
                            placeholder="0"
                            class="text-xs"
                          />
                          <span v-else class="block">{{
                            formatIDR(detail.max_disc_value ?? 0)
                          }}</span>
                        </td>

                        <!-- Is Full -->
                        <td class="px-2 py-2 text-center">
                          <input
                            v-if="!isReadOnly"
                            v-model="detail.is_full"
                            type="checkbox"
                            class="rounded cursor-pointer"
                          />
                          <span v-else>{{ detail.is_full ? "✓" : "-" }}</span>
                        </td>

                        <!-- Is Active -->
                        <td class="px-2 py-2 text-center">
                          <input
                            v-if="!isReadOnly"
                            v-model="detail.is_active"
                            type="checkbox"
                            class="rounded cursor-pointer"
                          />
                          <span v-else>{{ detail.is_active ? "✓" : "-" }}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
  -ms-overflow-style: none;
  /* IE and Edge */
  scrollbar-width: none;
  /* Firefox */
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
  /* Chrome, Safari, Opera */
}
</style>
