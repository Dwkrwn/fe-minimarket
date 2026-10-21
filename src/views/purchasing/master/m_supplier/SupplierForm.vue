<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed, watchEffect } from "vue";
import { useRouter, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { apiCall } from "@/lib/api";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import {
  FieldX,
  FieldNumber,
  FieldDate,
  FieldPopup,
  FieldSelect,
  FieldStatus,
  FieldUpload,
} from "@/components/field";
import {
  Trash2,
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Send,
} from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import { Switch } from "@/components/ui/switch";
import {
  createSupplier,
  updateSupplier,
  getSupplierById,
  getSupplierList,
  type SupplierDRekening,
  type SupplierDAlamat,
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
  () => !!route.params.id && route.name === "SupplierForm",
);
const isViewMode = computed(() => route.name === "SupplierView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const isSuperAdmin = computed(() => {
  const user = authStore.user;
  if (!user || !user.tipe) return false;
  return user.tipe.value1?.toUpperCase() === "SUPER ADMIN";
});
const isSuperAdminDialogOpen = ref(false);
const isDuplicateDialogOpen = ref(false);
const duplicateSupplierNames = ref<string[]>([]);
const pendingSavePayload = ref<any | null>(null);
const menuId = computed(() => route.params.id as string);

// ============================================================================
// CRITICAL FIELD CHANGE APPROVAL STATE
// ============================================================================
// Fields yang wajib approval saat diubah (edit mode)
const CRITICAL_FIELDS = [
  "npwp_supp",
  "m_coa_id",
  "m_currency_id",
  "top_number",
] as const;

// Untuk track snapshot rekening awal (sebelum edit)
const initialRekeningSnapshot = ref<string>("");

const isCriticalChangeDialogOpen = ref(false);
const criticalChangeMessage = ref("");
const pendingCriticalPayload = ref<any | null>(null);
const criticalChangeSummary = ref<string[]>([]);

/** Ambil snapshot rekening sebagai string JSON untuk perbandingan */
const getRekeningSnapshot = (arr: SupplierDRekening[]): string =>
  JSON.stringify(
    arr.map((r) => ({
      bank: r.bank || "",
      nama_rek: r.nama_rek || "",
      swift_code: normalizeSwiftCode(r.swift_code),
      no_rek: r.no_rek ?? null,
      is_default: Boolean(r.is_default),
    }))
  );

/** Cek apakah ada perubahan field critical */
const detectCriticalChanges = (): string[] => {
  const changes: string[] = [];

  const labelMap: Record<string, string> = {
    npwp_supp: "NPWP",
    m_coa_id: "COA (Rekening Akuntansi)",
    m_currency_id: "Mata Uang",
    top_number: "Term of Payment",
  };

  // Cek field scalar
  for (const field of CRITICAL_FIELDS) {
    const oldVal = String(initialValues[field] ?? "").trim();
    const newVal = String(values[field as keyof typeof values] ?? "").trim();
    if (oldVal !== newVal) {
      changes.push(labelMap[field] || field);
    }
  }

  // Cek perubahan rekening
  const currentSnapshot = getRekeningSnapshot(rekeningArr.value);
  if (initialRekeningSnapshot.value && currentSnapshot !== initialRekeningSnapshot.value) {
    changes.push("Data Rekening Bank");
  }

  return changes;
};

/** Computed per-field: apakah field kritis ini sudah berubah dari nilai awal (reaktif) */
const isCriticalFieldChanged = computed(() => {
  if (!isEditMode.value || isSuperAdmin.value || !isStatusWarning.value) {
    return { npwp_supp: false, m_coa_id: false, m_currency_id: false, top_number: false };
  }
  return {
    npwp_supp:
      String(initialValues.npwp_supp ?? "").trim() !== String(values.npwp_supp ?? "").trim(),
    m_coa_id:
      String(initialValues.m_coa_id ?? "").trim() !== String(values.m_coa_id ?? "").trim(),
    m_currency_id:
      String(initialValues.m_currency_id ?? "").trim() !== String(values.m_currency_id ?? "").trim(),
    top_number:
      String(initialValues.top_number ?? "").trim() !== String(values.top_number ?? "").trim(),
  };
});

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Supplier";
  if (isCopyMode.value) return "Salin Supplier";
  if (isEditMode.value) return "Edit Supplier";
  return "Tambah Supplier Baru";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Supplier";
  if (isCopyMode.value) return "Buat Supplier baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Supplier";
  return "Buat Supplier aplikasi baru";
});

// Reactive form values - main supplier fields
let values = reactive({
  kode_supplier: "",
  nama_supp: "",
  tipe_supp_id: "",
  alamat_supp: "",
  negara_supp: "",
  provinsi_supp: "",
  kota_supp: "",
  kecamatan_supp: "",
  kodepos: "",
  no_telp: "",
  no_fax: "",
  email: "",
  website: "",
  cp1: "",
  no_cp1: "",
  cp2: "",
  no_cp2: "",
  npwp_supp: "",
  foto_npwp: "",
  is_tax: false,
  is_vendor_group: false,
  top_number: "",
  m_currency_id: "",
  m_coa_id: "",
  catatan: "",
  is_active: true,
});
const duplicateDialogDescription = computed(() =>
  `Supplier dengan nama "${values.nama_supp}" sudah terdaftar. Apakah Anda tetap ingin menyimpan data ini?`,
);

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {};

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

// Status data yang dimuat dari API (untuk kondisi warning)
const loadedStatus = ref<string>("");

// Computed: apakah status data yang dimuat adalah IN APPROVAL, APPROVED, atau REVISI
const isStatusWarning = computed(() => {
  const s = loadedStatus.value.toUpperCase();
  return s === "IN APPROVAL" || s === "APPROVED" || s === "REVISI";
});

// Detail arrays
const rekeningArr = ref<SupplierDRekening[]>([]);
const alamatArr = ref<SupplierDAlamat[]>([]);

// Rekening validation errors - track errors per row
const rekeningErrors = reactive<
  Record<number, { noRek?: string; swiftCode?: string }>
>({});

// Computed for tipe supplier
const tipeSupplierValue = ref<string>("");
const tipeSupplierID = ref<string>(""); // Store ID for safer comparison

// Tipe supplier IDs (from API)
const TIPE_LOKAL_ID = "5f08d2e5-9566-4f36-8437-5007513df077";
const TIPE_LUAR_ID = "3aeed7fb-d3b3-4368-a243-86dd867ccc6a";

// Computed for labels based on tipe supplier
const isLokal = computed(() => tipeSupplierID.value === TIPE_LOKAL_ID);
const labelProvinsi = computed(() =>
  isLokal.value ? "Provinsi" : "State/Province",
);
const labelKota = computed(() => (isLokal.value ? "Kota/Kabupaten" : "City"));
const labelKecamatan = computed(() =>
  isLokal.value ? "Kecamatan" : "District",
);
const labelAlamat = computed(() => (isLokal.value ? "Alamat" : "Address"));
const labelKodePos = computed(() =>
  isLokal.value ? "Kode Pos" : "Postal Code",
);

// ============================================================================
// DETAIL METHODS
// ============================================================================
const addRekening = () => {
  rekeningArr.value.push({
    bank: "",
    nama_rek: "",
    swift_code: "",
    no_rek: null,
    is_default: false,
  });
};

// Validasi nomor rekening - tidak boleh 0 atau kosong
const validateRekeningNoRek = (index: number, value: any) => {
  const num = Number(String(value ?? "").trim());
  if (!Number.isFinite(num) || num === 0 || num < 0) {
    rekeningErrors[index] = rekeningErrors[index] || {};
    rekeningErrors[index].noRek = "No Rekening tidak boleh kosong, 0, atau negatif";
    return false;
  } else {
    if (rekeningErrors[index]) {
      rekeningErrors[index].noRek = undefined;
    }
    return true;
  }
};

const SWIFT_CODE_REGEX = /^[A-Z0-9]{8}([A-Z0-9]{3})?$/;

const normalizeSwiftCode = (value: unknown) => String(value ?? "").trim().toUpperCase();

const validateRekeningSwiftCode = (index: number, value: unknown) => {
  const swiftCode = normalizeSwiftCode(value);

  if (!swiftCode) {
    if (rekeningErrors[index]) {
      rekeningErrors[index].swiftCode = undefined;
    }
    return true;
  }

  if (!SWIFT_CODE_REGEX.test(swiftCode)) {
    rekeningErrors[index] = rekeningErrors[index] || {};
    rekeningErrors[index].swiftCode =
      "Swift Code harus 8 atau 11 karakter huruf/angka";
    return false;
  }

  if (rekeningErrors[index]) {
    rekeningErrors[index].swiftCode = undefined;
  }
  return true;
};

const removeRekening = (index: number) => {
  rekeningArr.value.splice(index, 1);
  // Clean up error for removed index
  delete rekeningErrors[index];
  toast.info("Rekening dihapus");
};

const handleDefaultRekening = (index: number) => {
  // If checkbox is checked, uncheck all others
  if (rekeningArr.value[index]?.is_default === true) {
    rekeningArr.value.forEach((rek, idx) => {
      if (idx !== index) {
        rek.is_default = false;
      }
    });
  }
};

const addAlamat = () => {
  alamatArr.value.push({
    jenis_almt_id: "",
    alamat: "",
    provinsi: "",
    kota: "",
    kecamatan: "",
    kodepos: "",
    telp: "",
    fax: "",
    email: "",
    nama_pic: "",
    catatan: "",
  });
};

const removeAlamat = (index: number) => {
  alamatArr.value.splice(index, 1);
  toast.info("Alamat tambahan dihapus");
};

// ============================================================================
// WATCH FOR TIPE SUPPLIER CHANGES
// ============================================================================
watchEffect(async () => {
  if (values.tipe_supp_id) {
    try {
      // Fetch tipe supplier value
      const response: any = await apiCall(
        `/dynamic/m_general/${values.tipe_supp_id}`,
      );
      if (response?.data) {
        const prevID = tipeSupplierID.value;
        tipeSupplierID.value = response.data.id || values.tipe_supp_id;
        tipeSupplierValue.value = response.data.value1 || "";

        // Auto-fill based on LOKAL or LUAR (using ID for safety)
        if (tipeSupplierID.value === TIPE_LOKAL_ID) {
          values.negara_supp = "INDONESIA";
        } else if (tipeSupplierID.value === TIPE_LUAR_ID) {
          // Clear negara if switching to LUAR
          if (values.negara_supp === "INDONESIA") {
            values.negara_supp = "";
          }
          // Clear cascading fields when switching from LOKAL to LUAR
          if (prevID === TIPE_LOKAL_ID) {
            values.provinsi_supp = "";
            values.kota_supp = "";
            values.kecamatan_supp = "";

            // Clear all alamat detail cascading fields
            alamatArr.value.forEach((almt) => {
              almt.provinsi = "";
              almt.kota = "";
              almt.kecamatan = "";
            });
          }
        }
      }
    } catch (error) {
      console.error("Error fetching tipe supplier:", error);
    }
  }
});

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    kode_supplier: "",
    nama_supp: "",
    tipe_supp_id: "",
    alamat_supp: "",
    negara_supp: "",
    provinsi_supp: "",
    kota_supp: "",
    kecamatan_supp: "",
    kodepos: "",
    no_telp: "",
    no_fax: "",
    email: "",
    website: "",
    cp1: "",
    no_cp1: "",
    cp2: "",
    no_cp2: "",
    npwp_supp: "",
    foto_npwp: "",
    is_tax: false,
    is_vendor_group: false,
    top_number: "",
    m_currency_id: "",
    m_coa_id: "",
    catatan: "",
    is_active: true,
  });

  // Reset errors
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });

  // Reset rekening errors
  Object.keys(rekeningErrors).forEach((key) => {
    delete rekeningErrors[Number(key)];
  });

  // Reset detail arrays
  rekeningArr.value = [];
  alamatArr.value = [];
};

// ============================================================================
// LIFECYCLE HOOKS - LOAD DATA BEFORE MOUNT
// ============================================================================
onBeforeMount(async () => {
  onReset();

  // Check if copy mode via query param
  const isCopyModeLocal = route.query.action === "copy" && route.query.source;
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value;

  // Set default tipe_supp_id to LOKAL if creating new
  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    try {
      const response: any = await apiCall(
        "/dynamic/m_general?no_pagination=true&selectfield=id,value1&filter_column_group=TIPE%20SUPPLIER&filter_column_is_active=true",
      );
      if (response?.data && Array.isArray(response.data)) {
        const lokalItem = response.data.find(
          (item: any) => item.id === TIPE_LOKAL_ID,
        );
        if (lokalItem) {
          values.tipe_supp_id = lokalItem.id;
          values.negara_supp = "INDONESIA";
          tipeSupplierValue.value = lokalItem.value1 || "LOKAL";
          tipeSupplierID.value = lokalItem.id;
        }
      }
    } catch (error) {
      console.error("Error setting default tipe supplier:", error);
    }
    return;
  }

  loading.value = true;
  try {
    const res = await getSupplierById(sourceId);

    if (res.status !== "success") throw new Error("Gagal memuat data");
    initialValues = res.data;

    auditMeta.value = {
      created_by: initialValues.created_by,
      createdAt: initialValues.createdAt,
      updated_by: initialValues.update_by || initialValues.updated_by,
      updatedAt: initialValues.updatedAt,
    };

    // Simpan status data yang dimuat untuk kondisi warning
    loadedStatus.value = String(initialValues.status ?? "");

    // Minimal normalisasi
    if (initialValues.is_active !== undefined) {
      const v = initialValues.is_active;
      initialValues.is_active = v === true || v === 1 || v === "1";
    } else {
      initialValues.is_active = true;
    }

    if (initialValues.is_tax !== undefined) {
      const v = initialValues.is_tax;
      initialValues.is_tax = v === true || v === 1 || v === "1";
    } else {
      initialValues.is_tax = false;
    }

    if (initialValues.is_vendor_group !== undefined) {
      const v = initialValues.is_vendor_group;
      initialValues.is_vendor_group = v === true || v === 1 || v === "1";
    } else {
      initialValues.is_vendor_group = false;
    }

    if (initialValues.top_number !== undefined && initialValues.top_number !== null) {
      initialValues.top_number = String(initialValues.top_number);
    } else {
      initialValues.top_number = "";
    }

    // Mode copy: hapus id dan timestamps agar jadi create baru
    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
      delete (initialValues as any).created_by;
      delete (initialValues as any).updated_by;
    }

    // Assign hanya key yang sudah ada di state reactive values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore dynamic assign
        values[key] = initialValues[key];
      }
    }

    console.log("API RESPONSE (GET Supplier):", initialValues);
    console.log("Nilai foto_npwp yang diterima:", initialValues.foto_npwp);

    // Load detail arrays
    if (
      initialValues.m_supplier_d_rekenings &&
      Array.isArray(initialValues.m_supplier_d_rekenings)
    ) {
      rekeningArr.value = initialValues.m_supplier_d_rekenings.map((d: any) => {
        const swiftCode = normalizeSwiftCode(d.swift_code);
        if (isCopyModeLocal) {
          const {
            id,
            createdAt,
            updatedAt,
            created_by,
            updated_by,
            m_supplier_id,
            ...rest
          } = d;
          return {
            ...rest,
            swift_code: swiftCode,
            is_default:
              d.is_default === true ||
              d.is_default === 1 ||
              d.is_default === "1",
          };
        }
        return {
          ...d,
          swift_code: swiftCode,
          is_default:
            d.is_default === true || d.is_default === 1 || d.is_default === "1",
        };
      });

      // Simpan snapshot rekening awal untuk deteksi perubahan kritis (hanya edit/view, bukan copy)
      if (!isCopyModeLocal) {
        initialRekeningSnapshot.value = getRekeningSnapshot(rekeningArr.value);
      }
    }

    if (
      initialValues.m_supplier_d_alamats &&
      Array.isArray(initialValues.m_supplier_d_alamats)
    ) {
      alamatArr.value = initialValues.m_supplier_d_alamats.map((d: any) => {
        const mapped = {
          jenis_almt_id: d.jenis_almt_id || "",
          alamat: d.alamat || "",
          provinsi: d.provinsi || "",
          kota: d.kota || "",
          kecamatan: d.kecamatan || "",
          kodepos: d.kodepos || "",
          telp: d.telp || "",
          fax: d.fax || "",
          email: d.email || "",
          nama_pic: d.nama_pic || "",
          catatan: d.catatan || "",
        };
        if (!isCopyModeLocal) {
          return { id: d.id, ...mapped };
        }
        return mapped;
      });
    }

    if (isCopyModeLocal) {
      toast.success("Data berhasil disalin", {
        description: "Silakan edit dan simpan sebagai Supplier baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Supplier", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () => router.push("/purchasing/master/m_supplier"),
      },
    });
    setTimeout(() => router.push("/purchasing/master/m_supplier"), 2000);
  } finally {
    loading.value = false;
  }
});

// Errors object (manual validation) - SAMA SEPERTI Form.txt
// Errors object (manual validation)
const errors = reactive({
  nama_supp: "",
  tipe_supp_id: "",
  alamat_supp: "",
  negara_supp: "",
  provinsi_supp: "",
  kota_supp: "",
  cp1: "",
  no_cp1: "",
  rekening: "",
  m_currency_id: "",
  email: "",
});

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Helper to convert empty strings to null
const toNull = (val?: string | null) => (val?.trim() ? val.trim() : null);

// ============================================================================
// ============================================================================
// SAVE HANDLER
// ============================================================================
const normalizeName = (name?: string | null) =>
  (name || "").trim().toLowerCase().replace(/\s+/g, " ");

const validateSupplierForm = () => {
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });

  let invalid = false;
  if (!values.nama_supp?.trim()) {
    errors.nama_supp = "Nama supplier wajib diisi";
    invalid = true;
  }
  if (!values.tipe_supp_id?.trim()) {
    errors.tipe_supp_id = "Tipe supplier wajib dipilih";
    invalid = true;
  }
  if (!values.alamat_supp?.trim()) {
    errors.alamat_supp = "Alamat wajib diisi";
    invalid = true;
  }
  if (!values.negara_supp?.trim()) {
    errors.negara_supp = "Negara wajib diisi";
    invalid = true;
  }
  if (!values.provinsi_supp?.trim()) {
    errors.provinsi_supp = "Provinsi wajib diisi";
    invalid = true;
  }
  if (!values.kota_supp?.trim()) {
    errors.kota_supp = "Kota/Kabupaten wajib diisi";
    invalid = true;
  }
  if (!values.cp1?.trim()) {
    errors.cp1 = "Contact person wajib diisi";
    invalid = true;
  }
  if (!values.no_cp1?.trim()) {
    errors.no_cp1 = "No telp contact person wajib diisi";
    invalid = true;
  }
  if (!values.m_currency_id?.trim()) {
    errors.m_currency_id = "Mata uang wajib dipilih";
    invalid = true;
  }

  if (values.email?.trim() && !EMAIL_REGEX.test(values.email.trim())) {
    errors.email = "Format email tidak valid";
    invalid = true;
  }

  if (rekeningArr.value.length === 0) {
    errors.rekening = "Minimal 1 rekening harus diisi";
    invalid = true;
  } else {
    const invalidSwiftCodes = rekeningArr.value.filter((r, idx) => {
      const swiftCode = normalizeSwiftCode(r.swift_code);
      return !validateRekeningSwiftCode(idx, swiftCode);
    });

    const incompleteRekenings = rekeningArr.value.filter((r) => {
      const hasBank = r.bank?.trim();
      const noRekStr = String(r.no_rek ?? "").trim();
      const hasNoRek =
        noRekStr !== "" && noRekStr !== "0" && Number(noRekStr) > 0;
      return !hasBank || !hasNoRek;
    });

    if (incompleteRekenings.length > 0) {
      errors.rekening =
        "Semua rekening yang ditambahkan harus diisi lengkap (Bank dan No Rekening)";
      invalid = true;
      toast.error("Validasi Rekening Gagal", {
        description:
          "Terdapat rekening yang belum diisi lengkap:\n• Nama Bank harus diisi\n• No Rekening harus diisi dan tidak boleh bernilai 0 atau negatif",
      });
    } else if (invalidSwiftCodes.length > 0) {
      errors.rekening = "Format Swift Code tidak valid";
      invalid = true;
      toast.error("Validasi Rekening Gagal", {
        description: "Swift Code harus berisi 8 atau 11 karakter huruf/angka.",
      });
    } else {
      const defaultCount = rekeningArr.value.filter(
        (r) => r.is_default === true,
      ).length;
      if (defaultCount === 0) {
        errors.rekening = "Minimal 1 rekening harus dijadikan default";
        invalid = true;
        toast.error("Validasi Rekening Gagal", {
          description: "Pilih minimal 1 rekening sebagai default.",
        });
      } else if (defaultCount > 1) {
        errors.rekening = "Hanya boleh ada 1 rekening default";
        invalid = true;
        toast.error("Validasi Rekening Gagal", {
          description: "Hanya 1 rekening yang boleh dijadikan default.",
        });
      }
    }
  }

  if (invalid) {
    toast.error("Validasi gagal", {
      description: "Mohon lengkapi semua field yang wajib diisi",
    });
    return false;
  }

  return true;
};

const buildSupplierPayload = () => {
  const toNumberOrNull = (val?: number | string | null) => {
    const str = String(val ?? "").trim();
    if (str === "") return null;
    const num = Number(str);
    return Number.isNaN(num) ? null : num;
  };

  const rekenings = rekeningArr.value.map((d) => ({
    bank: toNull(d.bank),
    nama_rek: toNull(d.nama_rek),
    swift_code: toNull(normalizeSwiftCode(d.swift_code)),
    no_rek: toNumberOrNull(d.no_rek),
    is_default: Boolean(d.is_default),
  }));

  const alamats = alamatArr.value.map((d) => ({
    jenis_almt_id: toNull(d.jenis_almt_id),
    alamat: toNull(d.alamat),
    provinsi: toNull(d.provinsi),
    kota: toNull(d.kota),
    kecamatan: toNull(d.kecamatan),
    kodepos: toNull(d.kodepos),
    telp: toNull(d.telp),
    fax: toNull(d.fax),
    email: toNull(d.email),
    nama_pic: toNull(d.nama_pic),
    catatan: toNull(d.catatan),
  }));

  return {
    nama_supp: values.nama_supp.trim(),
    tipe_supp_id: values.tipe_supp_id,
    alamat_supp: values.alamat_supp.trim(),
    negara_supp: values.negara_supp.trim(),
    provinsi_supp: values.provinsi_supp.trim(),
    kota_supp: values.kota_supp.trim(),
    kecamatan_supp: toNull(values.kecamatan_supp),
    kodepos: toNull(values.kodepos),
    no_telp: toNull(values.no_telp),
    no_fax: toNull(values.no_fax),
    email: toNull(values.email),
    website: toNull(values.website),
    cp1: values.cp1.trim(),
    no_cp1: values.no_cp1.trim(),
    cp2: toNull(values.cp2),
    no_cp2: toNull(values.no_cp2),
    npwp_supp: toNull(values.npwp_supp),
    foto_npwp: toNull(values.foto_npwp),
    is_tax: Boolean(values.is_tax),
    is_vendor_group: Boolean(values.is_vendor_group),
    top_number:
      values.top_number !== "" &&
      values.top_number !== null &&
      values.top_number !== undefined
        ? Number(values.top_number)
        : null,
    m_currency_id: toNull(values.m_currency_id),
    m_coa_id: toNull(values.m_coa_id),
    catatan: toNull(values.catatan),
    is_active: Boolean(values.is_active),
    m_supplier_d_rekenings: rekenings,
    m_supplier_d_alamats: alamats,
  };
};

const findDuplicateSupplierNames = async () => {
  const currentName = normalizeName(values.nama_supp);
  if (!currentName) return [];

  const response = await getSupplierList(
    1,
    20,
    "createdAt",
    "DESC",
    values.nama_supp.trim(),
    "nama_supp",
  );

  return (response.data || [])
    .filter((item: any) => normalizeName(item.nama_supp) === currentName)
    .filter((item: any) => !isEditMode.value || item.id !== menuId.value)
    .map((item: any) => item.nama_supp);
};

const continueSaveFlow = async (payload: any) => {
  pendingSavePayload.value = payload;

  if (isSuperAdmin.value) {
    isSuperAdminDialogOpen.value = true;
    return;
  }

  await proceedWithSave(payload);
};

const onSave = async () => {
  if (!validateSupplierForm()) return;

  const payload = buildSupplierPayload();
  loading.value = true;
  try {
    const duplicateNames = await findDuplicateSupplierNames();
    if (duplicateNames.length > 0) {
      duplicateSupplierNames.value = duplicateNames;
      pendingSavePayload.value = payload;
      isDuplicateDialogOpen.value = true;
      return;
    }
  } catch (error) {
    toast.error("Gagal mengecek duplikasi nama Supplier", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
    return;
  } finally {
    loading.value = false;
  }

  await continueSaveFlow(payload);
};

const proceedWithSave = async (payloadParam?: any) => {
  // Guard terakhir: no_rek tidak boleh kosong atau <= 0 (mis. 0)
  const hasInvalidNoRek = rekeningArr.value.some((r) => {
    const num = Number(String(r.no_rek ?? "").trim());
    return !Number.isFinite(num) || num <= 0;
  });
  if (hasInvalidNoRek) {
    isSuperAdminDialogOpen.value = false;
    errors.rekening = "No Rekening tidak boleh kosong atau bernilai 0";
    toast.error("❌ Validasi Rekening Gagal", {
      description: "No Rekening tidak boleh kosong, 0, atau negatif. Silakan periksa kembali data rekening Anda.",
    });
    return;
  }

  // Cek perubahan field kritis saat edit mode (kecuali Super Admin)
  if (isEditMode.value && !isSuperAdmin.value) {
    const changes = detectCriticalChanges();
    if (changes.length > 0) {
      criticalChangeSummary.value = changes;
      criticalChangeMessage.value = "";
      pendingCriticalPayload.value = payloadParam || buildSupplierPayload();
      isCriticalChangeDialogOpen.value = true;
      return;
    }
  }

  loading.value = true;
  try {
    const payload: any = payloadParam || buildSupplierPayload();

    // Kode supplier: jangan kirim saat create, kirim saat edit
    if (isEditMode.value) {
      payload.kode_supplier = toNull(values.kode_supplier);
      payload.updated_by = authStore.user?.id || null;
      if (isSuperAdmin.value) payload.status = "APPROVED";
      console.log("Payload UPDATE:", JSON.stringify(payload, null, 2));
      await updateSupplier(menuId.value, payload);
      if (isSuperAdmin.value) {
        toast.success("Supplier berhasil diperbarui", {
          description: `Supplier "${values.nama_supp}" langsung APPROVED oleh Super Admin`,
        });
      } else {
        toast.success("Supplier berhasil diperbarui", {
          description: `Supplier "${values.nama_supp}" telah diperbarui`,
        });
      }
    } else {
      payload.created_by = authStore.user?.id || null;
      payload.status = isSuperAdmin.value ? "APPROVED" : "DRAFT";
      console.log("Payload CREATE:", JSON.stringify(payload, null, 2));
      await createSupplier(payload);
      if (isSuperAdmin.value) {
        toast.success("Supplier berhasil dibuat", {
          description: `Supplier "${values.nama_supp}" langsung APPROVED oleh Super Admin`,
        });
      } else {
        toast.success("Supplier berhasil dibuat", {
          description: `Supplier "${values.nama_supp}" telah ditambahkan`,
        });
      }
    }
    router.replace("/purchasing/master/m_supplier?reload=" + Date.now());
  } catch (error) {
    toast.error(
      isEditMode.value
        ? "Gagal memperbarui Supplier"
        : "Gagal membuat Supplier",
      {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      },
    );
  } finally {
    loading.value = false;
    pendingSavePayload.value = null;
  }
};

// ============================================================================
// CRITICAL FIELD CHANGE APPROVAL — SEND NOTIFICATION
// ============================================================================
const autoSendCriticalChangeApproval = async (supplierId: string, supplierName: string, changeMessage: string) => {
  const approvalList = authStore.getApprovalList();
  const currentApproval = approvalList.find(
    (a: any) =>
      a.path === "/purchasing/master/m_supplier" &&
      a.tipe_approve?.toUpperCase() === "MENGAJUKAN",
  );

  if (!currentApproval) {
    console.warn("[Supplier] Tidak ada approval MENGAJUKAN untuk path m_supplier, skip send notifikasi.");
    return;
  }

  if (
    currentApproval.level === null ||
    currentApproval.level === undefined ||
    !currentApproval.sender_id
  ) {
    throw new Error("Data approval tidak lengkap. Silakan hubungi administrator.");
  }

  const payload = {
    approval_level: currentApproval.level,
    sender_id: currentApproval.sender_id,
    m_supplier_id: supplierId,
    approval_message: changeMessage.trim() || null,
  };

  const response = await fetch(
    `${API_BASE_URL}/dynamic/m_supplier_notifikasi`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify(payload),
    },
  );

  const result = await response.json();
  if (result.status !== "success") {
    throw new Error(result.message || "Gagal mengirim notifikasi approval perubahan kritis");
  }
};

const confirmCriticalChangeSave = async () => {
  isCriticalChangeDialogOpen.value = false;
  const payload = pendingCriticalPayload.value;
  pendingCriticalPayload.value = null;
  if (!payload) return;

  // Tandai status IN APPROVAL karena ada perubahan field kritis
  payload.status = "IN APPROVAL";

  loading.value = true;
  try {
    payload.kode_supplier = toNull(values.kode_supplier);
    payload.updated_by = authStore.user?.id || null;
    await updateSupplier(menuId.value, payload);

    // Kirim notifikasi approval
    const changeSummary = criticalChangeSummary.value.join(", ");
    const message = criticalChangeMessage.value.trim()
      ? `Perubahan field kritis: ${changeSummary}. Catatan: ${criticalChangeMessage.value.trim()}`
      : `Perubahan field kritis: ${changeSummary}`;

    await autoSendCriticalChangeApproval(menuId.value, values.nama_supp, message);

    toast.success("Supplier diperbarui & menunggu approval", {
      description: `Perubahan pada field: ${changeSummary} membutuhkan approval. Status: IN APPROVAL.`,
    });

    router.replace("/purchasing/master/m_supplier?reload=" + Date.now());
  } catch (error) {
    toast.error("Gagal memperbarui Supplier", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    loading.value = false;
    criticalChangeSummary.value = [];
    criticalChangeMessage.value = "";
  }
};

const cancelCriticalChangeSave = () => {
  isCriticalChangeDialogOpen.value = false;
  pendingCriticalPayload.value = null;
  criticalChangeSummary.value = [];
  criticalChangeMessage.value = "";
};

// ============================================================================
// SUPER ADMIN DIALOG HANDLERS
// ============================================================================
const confirmSuperAdminSave = async () => {
  isSuperAdminDialogOpen.value = false;
  await proceedWithSave(pendingSavePayload.value || undefined);
};

const cancelSuperAdminSave = () => {
  isSuperAdminDialogOpen.value = false;
  pendingSavePayload.value = null;
};

const confirmDuplicateSave = async () => {
  isDuplicateDialogOpen.value = false;
  if (!pendingSavePayload.value) return;
  await continueSaveFlow(pendingSavePayload.value);
};

const cancelDuplicateSave = () => {
  isDuplicateDialogOpen.value = false;
  pendingSavePayload.value = null;
};

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push("/purchasing/master/m_supplier");
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
    <!-- FORM SECTION WITH TABS -->
    <!-- ================================================================ -->
    <form class="space-y-6" @submit.prevent>
      <Tabs default-value="info-utama" class="w-full">
        <TabsList
          class="w-full overflow-x-auto flex justify-start scrollbar-hide"
        >
          <TabsTrigger value="info-utama">Info Utama</TabsTrigger>
          <TabsTrigger value="rekening">Rekening</TabsTrigger>
          <TabsTrigger value="alamat">Alamat Tambahan</TabsTrigger>
        </TabsList>

        <!-- ============================================================ -->
        <!-- TAB: INFO UTAMA -->
        <!-- ============================================================ -->
        <TabsContent value="info-utama" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Informasi Supplier</CardTitle>
              <CardDescription>
                Isi data Supplier dengan lengkap dan benar
              </CardDescription>
            </CardHeader>
            <CardContent class="space-y-6">
              <!-- Grid 2 Columns for Desktop -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Kode Supplier (readonly/auto-generated) -->
                <FieldX
                  id="kode_supplier"
                  label="Kode Supplier"
                  :value="values.kode_supplier"
                  @input="(v) => (values.kode_supplier = v)"
                  :hints="'Auto-generated, readonly'"
                  :required="false"
                  :disabled="true"
                  :readonly="true"
                  placeholder="-"
                  class="w-full"
                />

                <!-- Nama Supplier -->
                <FieldX
                  id="nama_supp"
                  label="Nama Supplier"
                  :value="values.nama_supp"
                  :errorname="errors.nama_supp ? 'failed' : ''"
                  @input="(v) => (values.nama_supp = v)"
                  :hints="errors.nama_supp"
                  :required="!isReadOnly"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  placeholder="Contoh: PT Mitra Jaya"
                  class="w-full"
                />

                <!-- Tipe Supplier -->
                <FieldSelect
                  id="tipe_supp_id"
                  label="Tipe Supplier"
                  :value="values.tipe_supp_id"
                  @input="(v: string) => (values.tipe_supp_id = v)"
                  :errorText="errors.tipe_supp_id ? 'failed' : ''"
                  :hints="errors.tipe_supp_id || 'Pilih tipe supplier'"
                  :required="!isReadOnly"
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
                      filter_column_group: 'TIPE SUPPLIER',
                      filter_column_is_active: 'true',
                    },
                  }"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  placeholder="Pilih tipe supplier"
                  class="w-full"
                />

                <!-- Negara -->
                <FieldX
                  id="negara_supp"
                  label="Negara"
                  :value="values.negara_supp"
                  :errorname="errors.negara_supp ? 'failed' : ''"
                  @input="(v) => (values.negara_supp = v)"
                  :hints="
                    errors.negara_supp ||
                    (isLokal
                      ? 'Auto-filled: Indonesia'
                      : 'Masukkan nama negara')
                  "
                  :required="!isReadOnly"
                  :disabled="loading || isReadOnly || isLokal"
                  :readonly="isReadOnly || isLokal"
                  placeholder="Contoh: Indonesia"
                  class="w-full"
                />

                <!-- Provinsi -->
                <FieldSelect
                  v-show="isLokal"
                  id="provinsi_supp"
                  :label="labelProvinsi"
                  :value="values.provinsi_supp"
                  @input="
                    (v: any) => {
                      values.provinsi_supp = v;
                      values.kota_supp = '';
                      values.kecamatan_supp = '';
                    }
                  "
                  @update:valueFull="
                    (objVal: any) => {
                      if (!objVal) {
                        values.kota_supp = '';
                        values.kecamatan_supp = '';
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
                  :errorname="errors.provinsi_supp ? 'failed' : ''"
                  :hints="errors.provinsi_supp"
                  :required="!isReadOnly"
                  placeholder="Pilih Provinsi"
                  class="w-full"
                />
                <FieldX
                  v-show="!isLokal"
                  id="provinsi_supp"
                  :label="labelProvinsi"
                  :value="values.provinsi_supp"
                  :errorname="errors.provinsi_supp ? 'failed' : ''"
                  @input="(v) => (values.provinsi_supp = v)"
                  :hints="errors.provinsi_supp"
                  :required="!isReadOnly"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  placeholder="Example: California"
                  class="w-full"
                />

                <!-- Kota -->
                <FieldSelect
                  v-show="isLokal"
                  id="kota_supp"
                  :label="labelKota"
                  :value="values.kota_supp"
                  @input="
                    (v: any) => {
                      values.kota_supp = v;
                      values.kecamatan_supp = '';
                    }
                  "
                  @update:valueFull="
                    (objVal: any) => {
                      if (!objVal) values.kecamatan_supp = '';
                    }
                  "
                  :api="
                    {
                      url: 'https://backend.qqltech.com/kodepos/region/kabupaten-kota',
                      params: {
                        provinsi: values.provinsi_supp,
                        search: '',
                        searchfield: 'name',
                        selectfield: 'name,id',
                        paginate: 35,
                      },
                      fullUrl: true,
                    } as any
                  "
                  :bind="{
                    disabled: !values.provinsi_supp || loading || isReadOnly,
                    clearable: true,
                  }"
                  :errorname="errors.kota_supp ? 'failed' : ''"
                  :hints="errors.kota_supp"
                  :required="!isReadOnly"
                  placeholder="Pilih Kota/Kabupaten"
                  class="w-full"
                />
                <FieldX
                  v-show="!isLokal"
                  id="kota_supp"
                  :label="labelKota"
                  :value="values.kota_supp"
                  :errorname="errors.kota_supp ? 'failed' : ''"
                  @input="(v) => (values.kota_supp = v)"
                  :hints="errors.kota_supp"
                  :required="!isReadOnly"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  placeholder="Example: New York"
                  class="w-full"
                />

                <!-- Kecamatan -->
                <FieldSelect
                  v-show="isLokal"
                  id="kecamatan_supp"
                  :label="labelKecamatan + ' (Opsional)'"
                  :value="values.kecamatan_supp"
                  @input="(v: any) => (values.kecamatan_supp = v)"
                  :api="
                    {
                      url: 'https://backend.qqltech.com/kodepos/region/kecamatan',
                      params: { kota: values.kota_supp },
                      fullUrl: true,
                    } as any
                  "
                  valueField="key"
                  displayField="key"
                  :bind="{
                    disabled: !values.kota_supp || loading || isReadOnly,
                    clearable: true,
                  }"
                  placeholder="Pilih Kecamatan"
                  class="w-full"
                />
                <FieldX
                  v-show="!isLokal"
                  id="kecamatan_supp"
                  :label="labelKecamatan"
                  :value="values.kecamatan_supp"
                  @input="(v) => (values.kecamatan_supp = v)"
                  :required="false"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  placeholder="Example: Manhattan"
                  class="w-full"
                />

                <!-- Kode Pos -->
                <FieldX
                  id="kodepos"
                  :label="labelKodePos"
                  :value="values.kodepos"
                  @input="(v) => (values.kodepos = v)"
                  type="tel"
                  :required="false"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  :placeholder="isLokal ? 'Contoh: 12345' : 'Example: 10001'"
                  class="w-full"
                />

                <!-- Alamat (Textarea full width) -->
                <FieldX
                  id="alamat_supp"
                  type="textarea"
                  :label="labelAlamat"
                  v-model="values.alamat_supp"
                  :required="!isReadOnly"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  :placeholder="
                    isLokal
                      ? 'Alamat lengkap supplier'
                      : 'Full supplier address'
                  "
                  :rows="3"
                />

                <!-- No Telp -->
                <FieldX
                  id="no_telp"
                  label="No Telepon"
                  :value="values.no_telp"
                  @input="(v) => (values.no_telp = v)"
                  type="tel"
                  :required="false"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  placeholder="Contoh: 021-1234567"
                  class="w-full"
                />

                <!-- No Fax -->
                <FieldX
                  id="no_fax"
                  label="No Fax"
                  :value="values.no_fax"
                  @input="(v) => (values.no_fax = v)"
                  type="tel"
                  :required="false"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  placeholder="Contoh: 021-7654321"
                  class="w-full"
                />

                <!-- Email -->
                <FieldX
                  id="email"
                  label="Email"
                  :value="values.email"
                  @input="(v) => { values.email = v; errors.email = ''; }"
                  :required="false"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  placeholder="supplier@example.com"
                  class="w-full"
                  :errorname="errors.email ? 'failed' : ''"
                  :hints="errors.email"
                />

                <!-- Website -->
                <FieldX
                  id="website"
                  label="Website"
                  :value="values.website"
                  @input="(v) => (values.website = v)"
                  :required="false"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  placeholder="https://www.example.com"
                  class="w-full"
                />

                <!-- Contact Person 1 -->
                <FieldX
                  id="cp1"
                  label="Contact Person 1"
                  :value="values.cp1"
                  :errorname="errors.cp1 ? 'failed' : ''"
                  @input="(v) => (values.cp1 = v)"
                  :hints="errors.cp1"
                  :required="!isReadOnly"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  placeholder="Nama kontak utama"
                  class="w-full"
                />

                <!-- No CP 1 -->
                <FieldX
                  id="no_cp1"
                  label="No Telp CP 1"
                  :value="values.no_cp1"
                  :errorname="errors.no_cp1 ? 'failed' : ''"
                  @input="(v) => (values.no_cp1 = v)"
                  type="tel"
                  :hints="errors.no_cp1"
                  :required="!isReadOnly"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  placeholder="Contoh: 0812-3456-7890"
                  class="w-full"
                />

                <!-- Contact Person 2 -->
                <FieldX
                  id="cp2"
                  label="Contact Person 2"
                  :value="values.cp2"
                  @input="(v) => (values.cp2 = v)"
                  :required="false"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  placeholder="Nama kontak alternatif"
                  class="w-full"
                />

                <!-- No CP 2 -->
                <FieldX
                  id="no_cp2"
                  label="No Telp CP 2"
                  :value="values.no_cp2"
                  @input="(v) => (values.no_cp2 = v)"
                  type="tel"
                  :required="false"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  placeholder="Contoh: 0812-9876-5432"
                  class="w-full"
                />

                <!-- NPWP -->
                <!-- NPWP (field kritis) -->
                <div>
                  <FieldX
                    id="npwp_supp"
                    label="NPWP"
                    :value="values.npwp_supp"
                    @input="(v) => (values.npwp_supp = v)"
                    type="npwp"
                    :required="false"
                    :disabled="loading || isReadOnly"
                    :readonly="isReadOnly"
                    placeholder="Contoh: 12.345.678.9-012.000"
                    :class="[
                      'w-full',
                      isCriticalFieldChanged.npwp_supp && '[&_input]:border-yellow-400 dark:[&_input]:border-yellow-500'
                    ]"
                  />
                  <p v-if="isCriticalFieldChanged.npwp_supp" class="text-xs text-yellow-600 dark:text-yellow-400 mt-1 flex items-center gap-1">
                    <AlertTriangle class="h-3 w-3 shrink-0" />
                    Perubahan ini membutuhkan approval
                  </p>
                </div>

                <!-- Foto NPWP -->
                <FieldUpload
                  id="foto_npwp"
                  label="Foto NPWP"
                  :value="values.foto_npwp"
                  @input="(v) => (values.foto_npwp = v)"
                  :hints="'.webp .jpg, .png, max 5MB'"
                  :required="false"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  accept="uploads/*"
                  class="w-full"
                />

                <!-- Is Tax (Switch) -->
                <FieldStatus
                  label="Pajak"
                  name="is_tax"
                  v-model="values.is_tax"
                  :disabled="loading"
                  :readonly="isReadOnly"
                  active-text="Aktif"
                  inactive-text="Tidak Aktif"
                />

                <!-- Vendor Group (Switch) -->
                <FieldStatus
                  label="Vendor Group"
                  name="is_vendor_group"
                  v-model="values.is_vendor_group"
                  :disabled="loading"
                  :readonly="isReadOnly"
                  active-text="Ya"
                  inactive-text="Tidak"
                />

                <!-- TOP Number (field kritis) -->
                <div>
                  <FieldNumber
                    id="top_number"
                    label="ToP Number"
                    :value="values.top_number"
                    @input="(v: string | number) => (values.top_number = String(v ?? ''))"
                    :required="false"
                    :disabled="loading || isReadOnly"
                    :readonly="isReadOnly"
                    placeholder="Masukkan ToP number"
                    :class="[
                      'w-full',
                      isCriticalFieldChanged.top_number && '[&_input]:border-yellow-400 dark:[&_input]:border-yellow-500'
                    ]"
                  />
                  <p v-if="isCriticalFieldChanged.top_number" class="text-xs text-yellow-600 dark:text-yellow-400 mt-1 flex items-center gap-1">
                    <AlertTriangle class="h-3 w-3 shrink-0" />
                    Perubahan ini membutuhkan approval
                  </p>
                </div>

                <!-- Mata Uang / Currency (field kritis) -->
                <div>
                  <FieldSelect
                    id="m_currency_id"
                    label="Mata Uang / Currency"
                    :value="values.m_currency_id"
                    @input="
                      (v: string) => {
                        values.m_currency_id = v;
                        errors.m_currency_id = '';
                      }
                    "
                    :errorText="errors.m_currency_id ? 'failed' : ''"
                    :hints="errors.m_currency_id"
                    :required="true"
                    :clearable="true"
                    displayField="nama_currency"
                    valueField="id"
                    :api="{
                      url: `${API_BASE_URL}/dynamic/m_currency`,
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${authStore.token}`,
                      },
                      params: {
                        no_pagination: 'true',
                        selectfield: 'id,nama_currency',
                        filter_column_is_active: 'true',
                      },
                    }"
                    :disabled="loading || isReadOnly"
                    :readonly="isReadOnly"
                    placeholder="Pilih mata uang"
                    :class="[
                      'w-full',
                      isCriticalFieldChanged.m_currency_id && '[&_button[role=combobox]]:border-yellow-400 dark:[&_button[role=combobox]]:border-yellow-500'
                    ]"
                  />
                  <p v-if="isCriticalFieldChanged.m_currency_id" class="text-xs text-yellow-600 dark:text-yellow-400 mt-1 flex items-center gap-1">
                    <AlertTriangle class="h-3 w-3 shrink-0" />
                    Perubahan ini membutuhkan approval
                  </p>
                </div>

                <!-- COA (disabled with note, field kritis) -->
                <div>
                  <FieldPopup
                    id="m_coa_id"
                    label="Chart of Account (COA)"
                    :value="values.m_coa_id"
                    @input="(v: string) => (values.m_coa_id = v)"
                    :hints="'COA belum tersedia'"
                    :required="false"
                    :disabled="true"
                    :readonly="true"
                    placeholder="COA belum tersedia"
                    :class="[
                      'w-full',
                      isCriticalFieldChanged.m_coa_id && '[&_.border-input]:border-yellow-400 dark:[&_.border-input]:border-yellow-500'
                    ]"
                  />
                  <p v-if="isCriticalFieldChanged.m_coa_id" class="text-xs text-yellow-600 dark:text-yellow-400 mt-1 flex items-center gap-1">
                    <AlertTriangle class="h-3 w-3 shrink-0" />
                    Perubahan ini membutuhkan approval
                  </p>
                </div>

                <!-- Catatan (Textarea full width) -->
                <div class="md:col-span-2">
                  <FieldX
                    id="catatan"
                    type="textarea"
                    label="Catatan"
                    v-model="values.catatan"
                    :required="false"
                    :disabled="loading || isReadOnly"
                    :readonly="isReadOnly"
                    placeholder="Catatan tambahan"
                    :rows="3"
                  />
                </div>

                <!-- Status -->
                <div class="md:col-span-2">
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
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- ============================================================ -->
        <!-- TAB: REKENING -->
        <!-- ============================================================ -->
        <TabsContent value="rekening" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle
                    >Rekening Bank Supplier
                    <span class="text-destructive">*</span></CardTitle
                  >
                  <CardDescription>
                    Kelola data rekening bank untuk transfer pembayaran. Minimal
                    1 rekening wajib diisi dan 1 harus dijadikan default.
                  </CardDescription>
                  <p
                    v-if="errors.rekening"
                    class="text-sm text-destructive mt-1"
                  >
                    {{ errors.rekening }}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  @click="addRekening"
                  :disabled="loading || isReadOnly"
                >
                  <Plus class="h-4 w-4 mr-2" />
                  Tambah Rekening
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <!-- Critical field warning banner (hanya saat status IN APPROVAL atau APPROVED) -->
              <div
                v-if="isEditMode && !isReadOnly && isStatusWarning"
                class="mb-4 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20 px-4 py-3"
              >
                <AlertTriangle class="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                <p class="text-sm text-yellow-800 dark:text-yellow-300">
                  Perubahan data rekening akan membutuhkan proses approval.
                  Data akan berstatus <strong>IN APPROVAL</strong> hingga disetujui.
                </p>
              </div>
              <!-- Detail Table -->
              <div
                v-if="rekeningArr.length > 0"
                class="border rounded-lg overflow-hidden"
              >
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead class="bg-muted/50">
                      <tr>
                        <th class="px-4 py-3 text-left font-medium">Bank</th>
                        <th class="px-4 py-3 text-left font-medium">
                          Nama Rekening
                        </th>
                        <th class="px-4 py-3 text-left font-medium">
                          Swift Code
                        </th>
                        <th class="px-4 py-3 text-left font-medium">
                          No Rekening
                        </th>
                        <th class="px-4 py-3 text-left font-medium">Default</th>
                        <th class="px-4 py-3 text-center font-medium w-[100px]">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y">
                      <tr
                        v-for="(rek, idx) in rekeningArr"
                        :key="idx"
                        class="hover:bg-muted/30"
                      >
                        <td class="px-4 py-3">
                          <FieldX
                            :id="`rek_bank_${idx}`"
                            :value="rek.bank || ''"
                            @input="(v: string) => (rek.bank = v)"
                            :disabled="loading || isReadOnly"
                            :readonly="isReadOnly"
                            placeholder="Nama bank"
                            class="w-full min-w-[150px]"
                            :label="undefined"
                            :required="false"
                          />
                        </td>
                        <td class="px-4 py-3">
                          <FieldX
                            :id="`rek_nama_${idx}`"
                            :value="rek.nama_rek || ''"
                            @input="(v: string) => (rek.nama_rek = v)"
                            :disabled="loading || isReadOnly"
                            :readonly="isReadOnly"
                            placeholder="Nama rekening"
                            class="w-full min-w-[150px]"
                            :label="undefined"
                            :required="false"
                          />
                        </td>
                        <td class="px-4 py-3">
                          <div class="space-y-1">
                            <FieldX
                              :id="`rek_swift_${idx}`"
                              :value="rek.swift_code || ''"
                              @input="
                                (v: string) => {
                                  rek.swift_code = normalizeSwiftCode(v);
                                  validateRekeningSwiftCode(idx, rek.swift_code);
                                }
                              "
                              :disabled="loading || isReadOnly"
                              :readonly="isReadOnly"
                              placeholder="Swift code"
                              class="w-full min-w-[120px]"
                              :label="undefined"
                              :required="false"
                              :errorname="
                                rekeningErrors[idx]?.swiftCode ? 'failed' : ''
                              "
                            />
                            <p
                              v-if="rekeningErrors[idx]?.swiftCode"
                              class="text-xs text-destructive"
                            >
                              {{ rekeningErrors[idx].swiftCode }}
                            </p>
                          </div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="space-y-1">
                            <FieldNumber
                              :id="`rek_no_${idx}`"
                              :value="rek.no_rek"
                              @input="
                                (v: string | number) => {
                                  const str = String(v).trim();
                                  rek.no_rek = str === '' ? null : Number(str);
                                  validateRekeningNoRek(idx, rek.no_rek);
                                }
                              "
                              :min="1"
                              :disabled="loading || isReadOnly"
                              :readonly="isReadOnly"
                              placeholder="No rekening"
                              class="w-full min-w-[150px]"
                              :label="undefined"
                              :required="false"
                              :useSeparator="false"
                              :errorname="rekeningErrors[idx]?.noRek ? 'failed' : ''"
                            />
                            <p v-if="rekeningErrors[idx]?.noRek" class="text-xs text-destructive">
                              {{ rekeningErrors[idx].noRek }}
                            </p>
                          </div>
                        </td>
                        <td class="px-4 py-3 text-left">
                          <input
                            v-if="!isReadOnly"
                            v-model="rek.is_default"
                            type="checkbox"
                            class="rounded cursor-pointer"
                            :disabled="loading"
                            @change="handleDefaultRekening(idx)"
                          />
                          <span v-else>{{ rek.is_default ? "✓" : "-" }}</span>
                        </td>
                        <td class="px-4 py-3 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            @click="removeRekening(idx)"
                            :disabled="loading || isReadOnly"
                          >
                            <Trash2 class="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div v-else class="text-center py-8 text-muted-foreground">
                Belum ada data rekening. Klik tombol "Tambah Rekening" untuk
                menambahkan.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- ============================================================ -->
        <!-- TAB: ALAMAT TAMBAHAN -->
        <!-- ============================================================ -->
        <TabsContent value="alamat" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Alamat Tambahan Supplier</CardTitle>
                  <CardDescription>
                    Kelola alamat tambahan seperti kantor cabang atau gudang
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  @click="addAlamat"
                  :disabled="loading || isReadOnly"
                >
                  <Plus class="h-4 w-4 mr-2" />
                  Tambah Alamat
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <!-- Detail Cards for Alamat (better UX for many fields) -->
              <div v-if="alamatArr.length > 0" class="space-y-4">
                <Card
                  v-for="(almt, idx) in alamatArr"
                  :key="idx"
                  class="border-muted"
                >
                  <CardHeader class="pb-3">
                    <div class="flex items-center justify-between">
                      <CardTitle class="text-base"
                        >Alamat #{{ idx + 1 }}</CardTitle
                      >
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        @click="removeAlamat(idx)"
                        :disabled="loading || isReadOnly"
                      >
                        <Trash2 class="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <!-- Jenis Alamat -->
                      <FieldSelect
                        :id="`almt_jenis_${idx}`"
                        label="Jenis Alamat"
                        :value="almt.jenis_almt_id || ''"
                        @input="(v: string) => (almt.jenis_almt_id = v)"
                        :required="false"
                        :clearable="true"
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
                            filter_column_group: 'TIPE ALAMAT',
                            filter_column_is_active: 'true',
                          },
                        }"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        placeholder="Pilih jenis alamat"
                        class="w-full"
                      />

                      <!-- Nama PIC -->
                      <FieldX
                        :id="`almt_pic_${idx}`"
                        label="Nama PIC"
                        :value="almt.nama_pic || ''"
                        @input="(v: string) => (almt.nama_pic = v)"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        placeholder="Person in charge"
                        class="w-full"
                        :required="false"
                      />

                      <!-- Alamat (Textarea full width) -->
                      <div class="md:col-span-2">
                        <FieldX
                          :id="`almt_alamat_${idx}`"
                          type="textarea"
                          :label="labelAlamat"
                          v-model="almt.alamat"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          :placeholder="
                            isLokal ? 'Alamat lengkap' : 'Full address'
                          "
                          :rows="2"
                          :required="false"
                        />
                      </div>

                      <!-- Provinsi -->
                      <FieldSelect
                        v-show="isLokal"
                        :id="`almt_provinsi_${idx}`"
                        :label="labelProvinsi"
                        :value="almt.provinsi || ''"
                        @input="
                          (v: any) => {
                            almt.provinsi = v;
                            almt.kota = '';
                            almt.kecamatan = '';
                          }
                        "
                        @update:valueFull="
                          (objVal: any) => {
                            if (!objVal) {
                              almt.kota = '';
                              almt.kecamatan = '';
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
                        :bind="{
                          disabled: loading || isReadOnly,
                          clearable: true,
                        }"
                        :required="false"
                        placeholder="Pilih Provinsi"
                        class="w-full"
                      />
                      <FieldX
                        v-show="!isLokal"
                        :id="`almt_provinsi_${idx}`"
                        :label="labelProvinsi"
                        :value="almt.provinsi || ''"
                        @input="(v: string) => (almt.provinsi = v)"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        placeholder="Example: California"
                        class="w-full"
                        :required="false"
                      />

                      <!-- Kota -->
                      <FieldSelect
                        v-show="isLokal"
                        :id="`almt_kota_${idx}`"
                        :label="labelKota"
                        :value="almt.kota || ''"
                        @input="
                          (v: any) => {
                            almt.kota = v;
                            almt.kecamatan = '';
                          }
                        "
                        @update:valueFull="
                          (objVal: any) => {
                            if (!objVal) almt.kecamatan = '';
                          }
                        "
                        :api="
                          {
                            url: 'https://backend.qqltech.com/kodepos/region/kabupaten-kota',
                            params: {
                              provinsi: almt.provinsi,
                              search: '',
                              searchfield: 'name',
                              selectfield: 'name,id',
                              paginate: 35,
                            },
                            fullUrl: true,
                          } as any
                        "
                        :bind="{
                          disabled: !almt.provinsi || loading || isReadOnly,
                          clearable: true,
                        }"
                        :required="false"
                        placeholder="Pilih Kota/Kabupaten"
                        class="w-full"
                      />
                      <FieldX
                        v-show="!isLokal"
                        :id="`almt_kota_${idx}`"
                        :label="labelKota"
                        :value="almt.kota || ''"
                        @input="(v: string) => (almt.kota = v)"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        placeholder="Example: New York"
                        class="w-full"
                        :required="false"
                      />

                      <!-- Kecamatan -->
                      <FieldSelect
                        v-show="isLokal"
                        :id="`almt_kecamatan_${idx}`"
                        :label="labelKecamatan + ' (Opsional)'"
                        :value="almt.kecamatan || ''"
                        @input="(v: any) => (almt.kecamatan = v)"
                        :api="
                          {
                            url: 'https://backend.qqltech.com/kodepos/region/kecamatan',
                            params: { kota: almt.kota },
                            fullUrl: true,
                          } as any
                        "
                        valueField="key"
                        displayField="key"
                        :bind="{
                          disabled: !almt.kota || loading || isReadOnly,
                          clearable: true,
                        }"
                        placeholder="Pilih Kecamatan"
                        class="w-full"
                      />
                      <FieldX
                        v-show="!isLokal"
                        :id="`almt_kecamatan_${idx}`"
                        :label="labelKecamatan"
                        :value="almt.kecamatan || ''"
                        @input="(v: string) => (almt.kecamatan = v)"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        placeholder="Example: Manhattan"
                        class="w-full"
                        :required="false"
                      />

                      <!-- Kode Pos -->
                      <FieldX
                        :id="`almt_kodepos_${idx}`"
                        :label="labelKodePos"
                        :value="almt.kodepos || ''"
                        @input="(v: string) => (almt.kodepos = v)"
                        type="tel"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        :placeholder="
                          isLokal ? 'Contoh: 12345' : 'Example: 10001'
                        "
                        class="w-full"
                        :required="false"
                      />

                      <!-- Telepon -->
                      <FieldX
                        :id="`almt_telp_${idx}`"
                        label="Telepon"
                        :value="almt.telp || ''"
                        @input="(v: string) => (almt.telp = v)"
                        type="tel"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        placeholder="No telepon"
                        class="w-full"
                        :required="false"
                      />

                      <!-- Fax -->
                      <FieldX
                        :id="`almt_fax_${idx}`"
                        label="Fax"
                        :value="almt.fax || ''"
                        @input="(v: string) => (almt.fax = v)"
                        type="tel"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        placeholder="No fax"
                        class="w-full"
                        :required="false"
                      />

                      <!-- Email -->
                      <FieldX
                        :id="`almt_email_${idx}`"
                        label="Email"
                        :value="almt.email || ''"
                        @input="(v: string) => (almt.email = v)"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        placeholder="Email"
                        class="w-full"
                        :required="false"
                      />

                      <!-- Catatan (Textarea full width) -->
                      <div class="md:col-span-2">
                        <FieldX
                          :id="`almt_catatan_${idx}`"
                          type="textarea"
                          label="Catatan"
                          v-model="almt.catatan"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          placeholder="Catatan tambahan"
                          :rows="2"
                          :required="false"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div v-else class="text-center py-8 text-muted-foreground">
                Belum ada alamat tambahan. Klik tombol "Tambah Alamat" untuk
                menambahkan.
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
      <Card>
        <CardContent class="pt-6">
          <div class="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              @click="handleCancel"
              :disabled="loading"
            >
              Batal
            </Button>
            <Button
              v-if="!isReadOnly"
              type="button"
              @click="onSave"
              :disabled="loading"
            >
              <Loader2 v-if="loading" class="mr-2 h-4 w-4 animate-spin" />
              <Save v-else class="mr-2 h-4 w-4" />
              {{ isEditMode ? "Perbarui" : "Simpan" }}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>

    <!-- Super Admin Confirmation Dialog -->
    <Dialog
      :open="isSuperAdminDialogOpen"
      @update:open="(val) => (isSuperAdminDialogOpen = val)"
    >
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader class="flex flex-row items-center gap-3 space-y-0 pb-2">
          <div class="bg-primary/10 rounded-full p-2 shrink-0">
            <ShieldCheck class="h-5 w-5 text-primary" />
          </div>
          <div>
            <DialogTitle class="text-base font-semibold"
              >Konfirmasi Super Admin</DialogTitle
            >
            <DialogDescription class="text-xs mt-0.5">
              Data akan disimpan tanpa melalui proses approval
            </DialogDescription>
          </div>
        </DialogHeader>

        <div class="bg-muted/50 border rounded-lg px-4 py-3 space-y-1.5 my-2">
          <p class="text-sm text-muted-foreground">
            Status yang akan ditetapkan:
          </p>
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20"
          >
            <CheckCircle2 class="h-3.5 w-3.5" />
            APPROVED
          </span>
          <p class="text-xs text-muted-foreground pt-1">
            Anda login sebagai
            <strong class="text-foreground">Super Admin</strong>. Supplier ini
            akan langsung berstatus
            <strong class="text-foreground">APPROVED</strong>.
          </p>
        </div>

        <DialogFooter class="gap-2 pt-1">
          <Button variant="outline" @click="cancelSuperAdminSave">Batal</Button>
          <Button
            @click="confirmSuperAdminSave"
            :disabled="loading"
            class="gap-2"
          >
            <Save class="h-4 w-4" />
            Ya, Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <GlobalDialog
      :open="isDuplicateDialogOpen"
      title="Nama Supplier Sudah Ada"
      :description="duplicateDialogDescription"
      type="warning"
      confirm-text="Tetap Simpan"
      cancel-text="Batal"
      :is-loading="loading"
      @confirm="confirmDuplicateSave"
      @cancel="cancelDuplicateSave"
      @update:open="isDuplicateDialogOpen = $event"
    >
      <div v-if="duplicateSupplierNames.length" class="text-sm text-muted-foreground">
        Data yang sama: {{ duplicateSupplierNames.join(', ') }}
      </div>
    </GlobalDialog>

    <!-- Critical Field Change Approval Dialog -->
    <Dialog
      :open="isCriticalChangeDialogOpen"
      @update:open="(val) => { if (!val) cancelCriticalChangeSave() }"
    >
      <DialogContent class="sm:max-w-[480px]">
        <DialogHeader class="flex flex-row items-center gap-3 space-y-0 pb-2">
          <div class="bg-yellow-100 dark:bg-yellow-900/30 rounded-full p-2 shrink-0">
            <AlertTriangle class="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </div>
          <div>
            <DialogTitle class="text-base font-semibold">
              Perubahan Field Kritis Terdeteksi
            </DialogTitle>
            <DialogDescription class="text-xs mt-0.5">
              Perubahan ini membutuhkan proses approval sebelum berlaku
            </DialogDescription>
          </div>
        </DialogHeader>

        <div class="space-y-3 my-2">
          <!-- Daftar field yang berubah -->
          <div class="bg-muted/50 border rounded-lg px-4 py-3 space-y-2">
            <p class="text-sm font-medium">Field yang diubah:</p>
            <ul class="space-y-1">
              <li
                v-for="change in criticalChangeSummary"
                :key="change"
                class="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span class="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />
                {{ change }}
              </li>
            </ul>
            <p class="text-xs text-muted-foreground pt-1">
              Data akan disimpan dengan status
              <strong class="text-foreground">IN APPROVAL</strong>. Perubahan baru berlaku
              setelah disetujui oleh approver.
            </p>
          </div>

          <!-- Catatan perubahan -->
          <div class="space-y-1.5">
            <label class="text-sm font-medium">
              Catatan Perubahan <span class="text-muted-foreground">(opsional)</span>
            </label>
            <textarea
              v-model="criticalChangeMessage"
              class="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              placeholder="Jelaskan alasan perubahan data kritis ini..."
              :disabled="loading"
            />
          </div>
        </div>

        <DialogFooter class="gap-2 pt-1">
          <Button variant="outline" @click="cancelCriticalChangeSave" :disabled="loading">
            Batal
          </Button>
          <Button @click="confirmCriticalChangeSave" :disabled="loading" class="gap-2 bg-yellow-600 hover:bg-yellow-700 text-white">
            <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
            <Send v-else class="h-4 w-4" />
            Simpan & Kirim Approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
/* Hide scrollbar for Tabs */
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
