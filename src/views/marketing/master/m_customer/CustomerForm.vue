<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FieldX,
  FieldNumber,
  FieldStatus,
  FieldSelect,
  FieldPopup,
  FieldTextarea,
  FieldUpload,
  MapPicker,
} from "@/components/field";
import { ButtonMultiSelect } from "@/components/button";
import { DeleteButton } from "@/components/button";
import { Trash2 } from "lucide-vue-next";
import {
  ArrowLeft,
  Clock3,
  Save,
  Loader2,
  Settings,
  ChevronDown,
  ChevronRight,
  Info,
} from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createCustomer,
  updateCustomer,
  getCustomerById,
  createCustomerChangeLog,
  createCustomerChangeNotification,
} from "./service";
import FieldMultiSelect from "@/components/field/FieldMultiSelect.vue";
import AuditInfo from "@/components/AuditInfo.vue";
import FieldMultiUpload from "@/components/field/FieldMultiUpload.vue";
import Badge from "@/components/ui/badge/Badge.vue";

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
  () => !!route.params.id && route.name === "CustomerForm",
);
const isViewMode = computed(() => route.name === "CustomerView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);
const isSuperAdmin = computed(() => authStore.isSuperAdmin);
const isCreditLimitHistoryOpen = ref(false);
const creditLimitHistoriesLoading = ref(false);
const creditLimitHistories = ref<any[]>([]);
const creditLimitHistoryFilterUnit = ref<string>("");

const creditLimitHistoryUnitOptions = computed(() => {
  const map = new Map<string, string>();
  for (const item of creditLimitHistories.value) {
    const ub = item.cl_history_customer_ub?.m_unit_bisni;
    if (ub?.id) map.set(ub.id, ub.nama_comp || ub.nama_unit_bisnis || "-");
  }
  return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
});

const filteredCreditLimitHistories = computed(() => {
  if (!creditLimitHistoryFilterUnit.value) return creditLimitHistories.value;
  return creditLimitHistories.value.filter(
    (item) =>
      item.cl_history_customer_ub?.unit_bisnis_id === creditLimitHistoryFilterUnit.value ||
      item.cl_history_customer_ub?.m_unit_bisni?.id === creditLimitHistoryFilterUnit.value,
  );
});

const isSettingCreditOpen = ref(false);
const isSettingTopOpen = ref(false);
const unitBisnisOptions = ref<any[]>([]);
const company = ref<Record<string, any> | null>(null);
const hasShownNoUnitBisnisToast = ref(false);
const unitBisnisNameMap = ref<Record<string, string>>({});

type AllowedUnitBisnisOption = {
  id: string;
  nama_comp: string;
  m_company_id: string;
  m_company: { id: string; nama: string } | null;
};

type CompanyOption = {
  id: string;
  nama: string;
};

type CustomerUnitBisnisItem = {
  id?: string;
  customer_id?: string;
  customer_ub_id?: string;
  unit_bisnis_id?: string;
  m_unit_bisnis?: {
    id?: string;
    nama_comp?: string;
    nama_unit_bisnis?: string;
  };
  unit_bisnis?: { id?: string; nama_comp?: string; nama_unit_bisnis?: string };
  m_unit_bisni?: { id?: string; nama_comp?: string; nama_unit_bisnis?: string };
  kredit_limit?: number;
  sisa_kredit_limit?: number;
  top?: number;
  kredit_limit_terpakai?: number;
};

type CreditLimitSettingItem = {
  unit_bisnis_id: string;
  nama_unit_bisnis: string;
  kredit_limit: number;
  sisa_kredit_limit: number;
  kredit_limit_terpakai: number;
  m_unit_bisnis?: {
    id?: string;
    nama_comp?: string;
    nama_unit_bisnis?: string;
  };
  unit_bisnis?: { id?: string; nama_comp?: string; nama_unit_bisnis?: string };
};

type topSettingsItem = {
  unit_bisnis_id: string;
  nama_unit_bisnis: string;
  top: number;
  m_unit_bisnis?: {
    id?: string;
    nama_comp?: string;
    nama_unit_bisnis?: string;
  };
  unit_bisnis?: { id?: string; nama_comp?: string; nama_unit_bisnis?: string };
};

const creditLimitSettings = ref<CreditLimitSettingItem[]>([]);
const creditLimitSettingsSnapshot = ref<CreditLimitSettingItem[]>([]);
const topSettings = ref<topSettingsItem[]>([]);
const topSettingsSnapshot = ref<topSettingsItem[]>([]);
const isUpdateDataDialogOpen = ref(false);
const isSendApprovalDialogOpen = ref(false);
const isSendingApproval = ref(false);
const approvalCatatan = ref("");
const pendingCustomerChangePayload = ref<Record<string, any> | null>(null);
const pendingCustomerChangeLogs = ref<
  {
    customer_ub_id?: string;
    change_values: { field: string; old_value: unknown; new_value: unknown }[];
  }[]
>([]);
const isCustomerUpdateMode = ref(false);
const updateDataOptions = reactive({
  creditLimit: false,
  top: false,
  otherData: false,
});

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Customer";
  if (isCopyMode.value) return "Salin Customer";
  if (isEditMode.value) return "Edit Customer";
  return "Tambah Customer Baru";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Customer";
  if (isCopyMode.value) return "Buat Customer baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Customer";
  return "Buat Customer baru";
});

const currentApprovalInfo = computed(() => {
  const approvalList = authStore.getApprovalList();
  return approvalList.find(
    (approval: any) =>
      approval.path === "/marketing/master/m_customer" &&
      approval.tipe_approve?.toUpperCase() === "MENGAJUKAN",
  );
});

const isApproved = computed(() => {
  // Ambil nilai status saat ini (pastikan string-nya aman dari perbedaan huruf besar/kecil)
  const currentStatus = values.status || initialValues?.status || "";
  return currentStatus.toUpperCase() === "APPROVED";
});

const canUseCustomerUpdateFlow = computed(
  () => isViewMode.value && isApproved.value,
);

const isCustomerUpdateActive = computed(
  () => canUseCustomerUpdateFlow.value && isCustomerUpdateMode.value,
);

const isOtherDataUpdateActive = computed(
  () => isCustomerUpdateActive.value && updateDataOptions.otherData,
);

const isUnitBisnisReadonly = computed(() => {
  if (canUseCustomerUpdateFlow.value) return true;

  //Jika bukan superadmin, field unit bisnis selalu readonly
  if (!isSuperAdmin.value) return true;
  return isReadOnly.value;
});

const isGeneralReadonly = computed(() => {
  if (canUseCustomerUpdateFlow.value) {
    return !isCustomerUpdateMode.value || !updateDataOptions.otherData;
  }

  return isReadOnly.value;
});

const isCreditLimitReadonly = computed(() => {
  if (isCustomerUpdateActive.value) {
    return updateDataOptions.otherData || !updateDataOptions.creditLimit;
  }
  if (isReadOnly.value) return true;
  if (!canUseCustomerUpdateFlow.value) return false;

  return (
    !isCustomerUpdateMode.value ||
    updateDataOptions.otherData ||
    !updateDataOptions.creditLimit
  );
});

const isTopReadonly = computed(() => {
  if (isCustomerUpdateActive.value) {
    return updateDataOptions.otherData || !updateDataOptions.top;
  }
  if (isReadOnly.value) return true;
  if (!canUseCustomerUpdateFlow.value) return false;
  return (
    !isCustomerUpdateMode.value ||
    updateDataOptions.otherData ||
    !updateDataOptions.top
  );
});

const isFinanceReadonly = computed(
  () => isCreditLimitReadonly.value && isTopReadonly.value,
);

// Computed untuk company name dari SelectRespo (untuk user non-super admin)
const companyNameDisplay = computed(() => {
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

// Form values sesuai wireframe
let values = reactive({
  m_unit_bisnis_id: "",
  company_id: "",
  status: "",
  kode_customer: "",
  tipe_customer: "",
  prefix: "",
  nama_customer: "",
  alias_customer: "",
  no_npwp: "",
  is_tax: false,
  // coa_id: '', // ABAIKAN DULU
  toleransi: 0,
  kredit_limit: 0,
  sisa_kredit_limit: 0,
  top_id: "",
  tolerance: "",
  cara_penagihan: "",
  customer_group_id: "",
  no_ktp: "",
  alamat: "",
  provinsi: "",
  kota: "",
  kecamatan: "",
  kodepos: "",
  kode_pos: "",
  email: "",
  website: "",
  no_telp_office: "",
  fax: "",
  cp_1: "",
  no_cp_1: "",
  email_cp_1: "",
  cp_2: "",
  no_cp_2: "",
  email_cp_2: "",
  lat: "",
  long: "",
  catatan: "",
  sales_area_id: "",
  sales_id: "",
  pengiriman_id: "",
  is_active: true,
  m_customer_unit_bisnis: [] as CustomerUnitBisnisItem[],
  m_unit_bisnis_list: [] as any[], // Helper for View Mode display
  sistem_pembayaran: "",
  merk_koli: "",
  parcel: "",
  m_customer_images: [] as { customer_id?: string; gambar: string }[],
  is_berikat: false,
});

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {};

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

// Detail arrays - DYNAMIC GENERATION
const detailArr = ref<any[]>([]);
const detailArr2 = ref<any[]>([]);
const detailArr3 = ref<any[]>([]);
const detailArr4 = ref<any[]>([]);
const detailArr5 = ref<any[]>([]);

// Expanded state for collapsible alamat
const expandedAlamats = ref<Set<number>>(new Set());
const expandedRekenings = ref<Set<number>>(new Set());
const sistemPembayaranValue = ref("");
const normalizeSistemPembayaranValue = (value: unknown) =>
  String(value || "")
    .trim()
    .toUpperCase();

const isPembayaranCAD = computed(() => sistemPembayaranValue.value === "CAD");

const applyTopBySistemPembayaran = () => {
  if (!isPembayaranCAD.value) {
    values.top_id = "0";
    errors.top_id = "";
  }
};

const formatDateTime = (value: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID");
};

const formatLimit = (value: unknown) => {
  const amount = Number(value);
  if (Number.isNaN(amount)) return "0";
  return new Intl.NumberFormat("id-ID").format(amount);
};

const toNumber = (value: unknown) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const calculateSisaKreditLimit = (
  kreditLimit: unknown,
  kreditLimitTerpakai: unknown,
) => Math.max(toNumber(kreditLimit) - toNumber(kreditLimitTerpakai), 0);

// const getUnitBisnisName = (
//   itemOrId: string | CustomerUnitBisnisItem | CreditLimitSettingItem,
// ) => {
//   const unitBisnisId =
//     typeof itemOrId === "string" ? itemOrId : itemOrId.unit_bisnis_id || "";

//   if (!unitBisnisId) return "-";

//   if (typeof itemOrId !== "string") {
//     const relationName =
//       itemOrId.m_unit_bisnis?.nama_comp ||
//       itemOrId.m_unit_bisnis?.nama_unit_bisnis ||
//       itemOrId.unit_bisnis?.nama_comp ||
//       itemOrId.unit_bisnis?.nama_unit_bisnis;
//     if (relationName) return relationName;
//   }

//   const option = unitBisnisOptions.value.find(
//     (unit) => unit.id === unitBisnisId,
//   );
//   if (option) {
//     return option.nama_comp || option.nama_unit_bisnis || option.nama || "-";
//   }

//   const existing = (values.m_customer_unit_bisnis || []).find(
//     (unit) => unit.unit_bisnis_id === unitBisnisId,
//   );
//   return (
//     existing?.m_unit_bisnis?.nama_comp ||
//     existing?.m_unit_bisnis?.nama_unit_bisnis ||
//     existing?.unit_bisnis?.nama_comp ||
//     existing?.unit_bisnis?.nama_unit_bisnis ||
//     "-"
//   );
// };
const getUnitBisnisName = (itemOrId: string | any) => {
  const unitBisnisId =
    typeof itemOrId === "string" ? itemOrId : itemOrId.unit_bisnis_id || "";
  if (!unitBisnisId) return "-";

  // 1. Prioritaskan data relasi yang sudah ada di dalam row itu sendiri (paling akurat)
  if (typeof itemOrId !== "string") {
    const relationName =
      itemOrId.m_unit_bisnis?.nama_comp ||
      itemOrId.unit_bisnis?.nama_comp ||
      itemOrId.m_unit_bisnis?.nama_unit_bisnis ||
      itemOrId.unit_bisnis?.nama_unit_bisnis;
    if (relationName) return relationName;
  }

  // 2. Jika SuperAdmin, cek di option (yang sudah di-load)
  const option = unitBisnisOptions.value.find(
    (unit) => unit.id === unitBisnisId,
  );
  if (option) return option.nama_comp || option.nama_unit_bisnis || "-";

  // 3. FALLBACK: Cari di values.m_customer_unit_bisnis (data yang sudah ditarik API)
  // Ini akan menyelesaikan masalah Non-SuperAdmin
  const existing = (values.m_customer_unit_bisnis || []).find(
    (unit) => unit.unit_bisnis_id === unitBisnisId,
  );

  return (
    existing?.m_unit_bisnis?.nama_comp ||
    existing?.unit_bisnis?.nama_comp ||
    existing?.m_unit_bisni?.nama_comp ||
    "-"
  );
};

const syncMainCreditValues = () => {
  values.kredit_limit = creditLimitSettings.value.reduce(
    (total, item) => total + toNumber(item.kredit_limit),
    0,
  );
  values.sisa_kredit_limit = creditLimitSettings.value.reduce(
    (total, item) => total + toNumber(item.sisa_kredit_limit),
    0,
  );
};

// Mengambil nama default dari akun user (untuk mode Create)
const getSelectRespoData = () => {
  try {
    const selectRespo = localStorage.getItem("SelectRespo");
    if (!selectRespo) return null;
    return JSON.parse(selectRespo);
  } catch {
    return null;
  }
};

const selectRespoUnitBisnisId = computed(() => {
  if (isSuperAdmin.value) return null;
  const data = getSelectRespoData();
  return (
    data?.companyId || data?.m_unit_bisnis_id || data?.unitBisnisId || null
  );
});

const selectRespoUnitBisnisName = computed(() => {
  if (isSuperAdmin.value) return "";
  const data = getSelectRespoData();
  return (
    data?.companyName ||
    data?.unitBisnisName ||
    data?.nama_comp ||
    data?.nama_unit_bisnis ||
    ""
  );
});

const isCustomerUnitBisnisOwnedByCurrentUser = (
  item: CustomerUnitBisnisItem | CreditLimitSettingItem | topSettingsItem,
) => {
  if (isSuperAdmin.value) return true;
  const allowedIds = allowedUnitBisnisIdSet.value;
  if (!allowedIds || allowedIds.size === 0) return false;

  const itemId =
    item.unit_bisnis_id || item.m_unit_bisnis?.id || item.unit_bisnis?.id;
  if (!itemId) return false;

  return allowedIds.has(itemId);
};

const isCreditLimitRowReadonly = (item: CreditLimitSettingItem) => {
  if (isCreditLimitReadonly.value) return true;
  return !isCustomerUnitBisnisOwnedByCurrentUser(item);
};

const isTopRowReadonly = (item: topSettingsItem) => {
  if (isTopReadonly.value) return true;
  return !isCustomerUnitBisnisOwnedByCurrentUser(item);
};

const isCreateMode = computed(
  () => !isEditMode.value && !isViewMode.value && !isCopyMode.value,
);

// const enforceUserUnitBisnisForNonSuperAdmin = () => {
//   const unitBisnisId = selectRespoUnitBisnisId.value;
//   if (!unitBisnisId) return;

//   const existingUnit = (values.m_customer_unit_bisnis || []).find((item: any) =>
//     item.unit_bisnis_id === unitBisnisId ||
//     item.m_unit_bisnis?.id === unitBisnisId ||
//     item.unit_bisnis?.id === unitBisnisId,
//   );

//   if (existingUnit) {
//     // Preserve the current user's unit row and drop any other units for non-superadmin users.
//     values.m_customer_unit_bisnis = [existingUnit];
//   } else if (isCreateMode.value) {
//     // Inject a single unit bisnis row in create mode for non-superadmin users.
//     values.m_customer_unit_bisnis = [
//       {
//         unit_bisnis_id: unitBisnisId,
//         m_unit_bisnis: {
//           id: unitBisnisId,
//           nama_comp: selectRespoUnitBisnisName.value || undefined,
//           nama_unit_bisnis: selectRespoUnitBisnisName.value || undefined,
//         },
//       } as CustomerUnitBisnisItem,
//     ];
//   } else {
//     // If editing and the current unit is missing, fallback to injecting the current user's unit.
//     values.m_customer_unit_bisnis = [
//       {
//         unit_bisnis_id: unitBisnisId,
//         m_unit_bisnis: {
//           id: unitBisnisId,
//           nama_comp: selectRespoUnitBisnisName.value || undefined,
//           nama_unit_bisnis: selectRespoUnitBisnisName.value || undefined,
//         },
//       } as CustomerUnitBisnisItem,
//     ];
//   }

//   syncCreditLimitSettings(false);
//   syncTopSettings(false);
// };

const fallbackUnitBisnisNameDisplay = computed(() => {
  if (isSuperAdmin.value) return "-";
  const name = selectRespoUnitBisnisName.value;
  return name ? name : "-";
});

// Menampilkan nama unit bisnis yang ada di Customer (dipisah koma jika multi)
const unitBisnisNameDisplay = computed(() => {
  // Jika sudah ada data unit bisnis di state (Edit Mode)
  if (
    values.m_customer_unit_bisnis &&
    values.m_customer_unit_bisnis.length > 0
  ) {
    return values.m_customer_unit_bisnis
      .map((item: any) => {
        return (
          item.m_unit_bisnis?.nama_comp ||
          item.m_unit_bisni?.nama_comp ||
          item.unit_bisnis?.nama_comp ||
          item.nama_comp ||
          "-"
        );
      })
      .filter((name) => name !== "-")
      .join(", "); // Output: "Surabaya, Jakarta"
  }

  // Jika masih kosong (Create Mode), pakai fallback dari akun
  return fallbackUnitBisnisNameDisplay.value;
});

const allowedUnitBisnisIds = computed<string[] | null>(() => {
  if (isSuperAdmin.value) return null;

  const ids = new Set<string>();
  for (const userDetail of authStore.userDetails || []) {
    if (!userDetail?.is_active) continue;
    const respo = userDetail.m_respo;
    if (!respo?.is_active) continue;

    const unitBisnisId = respo.m_unit_bisnis_id?.trim();
    if (unitBisnisId) {
      ids.add(unitBisnisId);
    }
  }

  // Fallback: cek SelectRespo localStorage kalo authStore.userDetails belum siap
  if (ids.size === 0) {
    const data = getSelectRespoData();
    const ubId =
      data?.companyId || data?.m_unit_bisnis_id || data?.unitBisnisId;
    if (ubId) ids.add(ubId);
  }

  return Array.from(ids);
});

const allowedUnitBisnisMetadata = computed<AllowedUnitBisnisOption[]>(() => {
  if (isSuperAdmin.value) return [];

  const options = new Map<string, AllowedUnitBisnisOption>();
  for (const userDetail of authStore.userDetails || []) {
    if (!userDetail?.is_active) continue;
    const respo = userDetail.m_respo;
    if (!respo?.is_active) continue;
    const ubFromRespo: any = respo.unit_bisnis;
    const companyFromRespo: any = respo.unit_bisnis?.m_company;

    const id = respo.m_unit_bisnis_id?.trim();
    if (!id) continue;

    const nama =
      ubFromRespo?.nama_comp?.trim() || options.get(id)?.nama_comp || id;
    const companyId =
      companyFromRespo?.id?.trim() || options.get(id)?.m_company_id || "";
    const companyName =
      companyFromRespo?.nama?.trim() || options.get(id)?.m_company?.nama || "";

    options.set(id, {
      id,
      nama_comp: nama,
      m_company_id: companyId,
      m_company:
        companyId || companyName
          ? { id: companyId, nama: companyName || companyId }
          : null,
    });
  }

  // Fallback: cek SelectRespo localStorage kalo authStore.userDetails belum siap
  if (options.size === 0) {
    const data = getSelectRespoData();
    const ubId =
      data?.companyId || data?.m_unit_bisnis_id || data?.unitBisnisId;
    if (ubId) {
      options.set(ubId, {
        id: ubId,
        nama_comp:
          data?.companyName || data?.unitBisnisName || data?.nama_comp || ubId,
        m_company_id: data?.companyLegalId || "",
        m_company:
          data?.companyLegalId || data?.companyLegalName
            ? {
                id: data.companyLegalId || "",
                nama: data.companyLegalName || "",
              }
            : null,
      });
    }
  }

  return Array.from(options.values());
});

const allowedUnitBisnisIdSet = computed<Set<string> | null>(() => {
  if (isSuperAdmin.value) return null;
  return new Set(allowedUnitBisnisIds.value || []);
});

const hasRespoData = computed(() => {
  if (isSuperAdmin.value) return false;
  return !!allowedUnitBisnisIds.value && allowedUnitBisnisIds.value.length > 0;
});

const companyOptions = computed<CompanyOption[]>(() => {
  const opts = new Map<string, CompanyOption>();

  getUnitBisnisOptions.value.forEach((ub: any) => {
    const cId = ub.m_company_id?.trim();
    if (!cId) return;

    opts.set(cId, {
      id: cId,
      nama: ub.m_company?.nama || opts.get(cId)?.nama || cId,
    });
  });

  if (company.value?.id && !opts.has(company.value.id)) {
    opts.set(company.value.id, {
      id: company.value.id,
      nama: company.value.nama || company.value.id,
    });
  }

  return Array.from(opts.values());
});

const filteredUnitBisnisOptions = computed(() => {
  const selectedCompanyId = values.company_id?.trim();
  if (!selectedCompanyId) return getUnitBisnisOptions.value;

  const selectedIds = new Set(unit_bisnis_ids_computed.value);
  return getUnitBisnisOptions.value.filter((opt: any) => {
    return opt.m_company_id === selectedCompanyId || selectedIds.has(opt.id);
  });
});

const unitBisnisFieldApiParams = computed(() => ({
  searchfield: "nama_unit_bisnis",
  filter_column_is_active: "true",
  no_pagination: "true",
  include: "m_company",
  ...(values.company_id ? { filter_column_company_id: values.company_id } : {}),
}));

const unitBisnisFieldApi = computed(() => {
  if (!isSuperAdmin.value) return undefined;

  return {
    url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authStore.token}`,
    },
    params: unitBisnisFieldApiParams.value,
  };
});

const badCredit = computed(
  () =>
    creditLimitSettings.value.length === 0 ||
    creditLimitSettings.value.some((item) => toNumber(item.kredit_limit) <= 0),
);

const badTop = computed(
  () =>
    topSettings.value.length === 0 ||
    topSettings.value.some((item) => toNumber(item.top) <= 0),
);

const cloneCreditLimitSettings = (items: CreditLimitSettingItem[]) =>
  items.map((item) => ({ ...item }));
const cloneTopSettings = (items: topSettingsItem[]) =>
  items.map((item) => ({ ...item }));

const resetUpdateDataOptions = () => {
  updateDataOptions.creditLimit = false;
  updateDataOptions.top = false;
  updateDataOptions.otherData = false;
};

const openUpdateDataDialog = () => {
  resetUpdateDataOptions();
  isUpdateDataDialogOpen.value = true;
};

const toggleFinanceUpdateOption = (field: "creditLimit" | "top") => {
  updateDataOptions.otherData = false;
  updateDataOptions[field] = !updateDataOptions[field];
};

const toggleOtherDataUpdateOption = () => {
  updateDataOptions.otherData = !updateDataOptions.otherData;
  if (updateDataOptions.otherData) {
    updateDataOptions.creditLimit = false;
    updateDataOptions.top = false;
  }
};

const confirmUpdateDataMode = () => {
  if (
    !updateDataOptions.creditLimit &&
    !updateDataOptions.top &&
    !updateDataOptions.otherData
  ) {
    toast.error("Pilih jenis data yang ingin diupdate");
    return;
  }

  isCustomerUpdateMode.value = true;
  isUpdateDataDialogOpen.value = false;
};

const sameChangeValue = (oldValue: unknown, newValue: unknown) =>
  JSON.stringify(oldValue ?? null) === JSON.stringify(newValue ?? null);

const getInitialUnitById = (unitBisnisId?: string) =>
  (initialValues.m_customer_unit_bisnis || []).find(
    (item: any) => item.unit_bisnis_id === unitBisnisId,
  );

const addChangeValue = (
  changes: { field: string; old_value: unknown; new_value: unknown }[],
  field: string,
  oldValue: unknown,
  newValue: unknown,
) => {
  if (!sameChangeValue(oldValue, newValue)) {
    changes.push({
      field,
      old_value: oldValue ?? null,
      new_value: newValue ?? null,
    });
  }
};

const buildCustomerChangeLogPayloads = (payload: Record<string, any>) => {
  const logs: {
    customer_ub_id?: string;
    change_values: { field: string; old_value: unknown; new_value: unknown }[];
  }[] = [];

  const financeChangeMap = new Map<
    string,
    {
      customer_ub_id?: string;
      change_values: {
        field: string;
        old_value: unknown;
        new_value: unknown;
      }[];
    }
  >();

  const getFinanceLog = (unitBisnisId: string) => {
    const existing = financeChangeMap.get(unitBisnisId);
    if (existing) return existing;

    const initialUnit = getInitialUnitById(unitBisnisId);
    const nextLog = {
      customer_ub_id:
        initialUnit?.customer_ub_id || initialUnit?.id || undefined,
      change_values: [] as {
        field: string;
        old_value: unknown;
        new_value: unknown;
      }[],
    };

    financeChangeMap.set(unitBisnisId, nextLog);
    return nextLog;
  };

  if (updateDataOptions.creditLimit) {
    creditLimitSettings.value.forEach((item) => {
      const oldUnit = getInitialUnitById(item.unit_bisnis_id);
      if (!item.unit_bisnis_id) return;

      const financeLog = getFinanceLog(item.unit_bisnis_id);
      addChangeValue(
        financeLog.change_values,
        "kredit_limit",
        toNumber(oldUnit?.kredit_limit),
        toNumber(item.kredit_limit),
      );
    });
  }

  if (updateDataOptions.top) {
    topSettings.value.forEach((item) => {
      const oldUnit = getInitialUnitById(item.unit_bisnis_id);
      if (!item.unit_bisnis_id) return;

      const financeLog = getFinanceLog(item.unit_bisnis_id);
      addChangeValue(
        financeLog.change_values,
        "top",
        toNumber(oldUnit?.top),
        toNumber(item.top),
      );
    });
  }

  financeChangeMap.forEach((log) => {
    if (log.change_values.length > 0) {
      logs.push(log);
    }
  });

  if (updateDataOptions.otherData) {
    const changes: { field: string; old_value: unknown; new_value: unknown }[] =
      [];
    const excludedFields = new Set([
      "kredit_limit",
      "sisa_kredit_limit",
      "m_customer_unit_bisnis",
    ]);

    Object.entries(payload).forEach(([field, newValue]) => {
      if (excludedFields.has(field)) return;
      addChangeValue(changes, field, initialValues[field], newValue);
    });

    if (changes.length > 0) {
      logs.push({ change_values: changes });
    }
  }

  return logs;
};

const resetCustomerChangeApprovalState = () => {
  isSendApprovalDialogOpen.value = false;
  approvalCatatan.value = "";
  pendingCustomerChangePayload.value = null;
  pendingCustomerChangeLogs.value = [];
};

const openSendApprovalDialog = (
  payload: Record<string, any>,
  changeLogs: {
    customer_ub_id?: string;
    change_values: { field: string; old_value: unknown; new_value: unknown }[];
  }[],
) => {
  pendingCustomerChangePayload.value = payload;
  pendingCustomerChangeLogs.value = changeLogs;
  approvalCatatan.value = "";
  isSendApprovalDialogOpen.value = true;
};

const confirmSendApproval = async () => {
  if (!menuId.value || !pendingCustomerChangePayload.value) return;

  isSendingApproval.value = true;
  loading.value = true;
  try {
    const currentApproval = currentApprovalInfo.value;
    if (!currentApproval) {
      toast.error("Gagal mengirim approval", {
        description: "Anda tidak memiliki hak untuk mengajukan approval",
      });
      return;
    }

    if (
      currentApproval.level === null ||
      currentApproval.level === undefined ||
      !currentApproval.sender_id
    ) {
      toast.error("Data approval tidak lengkap", {
        description:
          "Konfigurasi approval tidak valid. Silakan hubungi administrator.",
      });
      return;
    }

    const currentUserId = authStore.user?.id || authStore.user?.username || "";

    if (pendingCustomerChangeLogs.value.length === 0) {
      throw new Error("Tidak ada perubahan yang dapat diajukan");
    }

    for (const changeLog of pendingCustomerChangeLogs.value) {
      const changeLogResponse = await createCustomerChangeLog({
        customer_id: menuId.value,
        customer_ub_id: changeLog.customer_ub_id,
        change_values: changeLog.change_values,
        created_by: currentUserId,
        status: "IN APPROVAL",
      });

      if (changeLogResponse.status !== "success") {
        throw new Error("Gagal membuat change log customer");
      }

      const changeLogId = changeLogResponse.data?.id;
      if (!changeLogId) {
        throw new Error("Gagal mendapatkan ID change log customer");
      }

      const changeNotificationResponse = await createCustomerChangeNotification(
        {
          status: false,
          m_customer_log_id: changeLogId,
          sender_id: currentApproval.sender_id,
          approval_level: currentApproval.level,
          title: "Approval Perubahan Customer",
          approval_message:
            approvalCatatan.value.trim() ||
            `Pengajuan perubahan data customer ${values.nama_customer}`,
          status_name: "IN APPROVAL",
        },
      );

      if (changeNotificationResponse.status !== "success") {
        throw new Error(
          "Terjadi kesalahan saat mengirim approval perubahan customer",
        );
      }
    }

    toast.success("Pengajuan perubahan customer dikirim", {
      description: "Data perubahan menunggu approval",
    });

    isCustomerUpdateMode.value = false;
    resetUpdateDataOptions();
    resetCustomerChangeApprovalState();
    router.replace(`/marketing/master/m_customer?reload=${Date.now()}`);
  } catch (error) {
    toast.error("Gagal mengirim approval perubahan customer", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    isSendingApproval.value = false;
    loading.value = false;
  }
};

const cancelSendApproval = () => {
  if (isSendingApproval.value) return;
  resetCustomerChangeApprovalState();
};

const syncCreditLimitSettings = (preserveExisting = true) => {
  const existingMap = new Map(
    creditLimitSettings.value.map((item) => [item.unit_bisnis_id, item]),
  );
  const selectedUnits = values.m_customer_unit_bisnis || [];
  const fallbackTerpakai = Math.max(
    toNumber(values.kredit_limit) - toNumber(values.sisa_kredit_limit),
    0,
  );

  creditLimitSettings.value = selectedUnits
    .filter((item) => !!item.unit_bisnis_id)
    .map((item, index) => {
      const unitBisnisId = item.unit_bisnis_id as string;
      const existing = preserveExisting
        ? existingMap.get(unitBisnisId)
        : undefined;
      const initialKreditLimit =
        existing?.kredit_limit ??
        (item.kredit_limit !== undefined
          ? toNumber(item.kredit_limit)
          : index === 0
            ? toNumber(values.kredit_limit)
            : 0);
      const initialTerpakai =
        existing?.kredit_limit_terpakai ??
        (item.kredit_limit_terpakai !== undefined
          ? toNumber(item.kredit_limit_terpakai)
          : index === 0 && isEditMode.value
            ? fallbackTerpakai
            : 0);

      return {
        unit_bisnis_id: unitBisnisId,
        nama_unit_bisnis: getUnitBisnisName(item),
        kredit_limit: initialKreditLimit,
        kredit_limit_terpakai: initialTerpakai,
        sisa_kredit_limit: calculateSisaKreditLimit(
          initialKreditLimit,
          initialTerpakai,
        ),
      };
    });

  syncMainCreditValues();
};

const updateCreditLimitSetting = (
  index: number,
  field: "kredit_limit" | "kredit_limit_terpakai",
  rawValue: number | string,
) => {
  const current = creditLimitSettings.value[index];
  if (!current) return;

  current[field] = Math.max(toNumber(rawValue), 0);
  current.sisa_kredit_limit = calculateSisaKreditLimit(
    current.kredit_limit,
    current.kredit_limit_terpakai,
  );
  syncMainCreditValues();
};

const syncTopSettings = (preserveExisting = true) => {
  const existingMap = new Map(
    topSettings.value.map((item) => [item.unit_bisnis_id, item]),
  );
  const selectedUnits = values.m_customer_unit_bisnis || [];

  topSettings.value = selectedUnits
    .filter((item) => !!item.unit_bisnis_id)
    .map((item, index) => {
      const unitBisnisId = item.unit_bisnis_id as string;
      const existing = preserveExisting
        ? existingMap.get(unitBisnisId)
        : undefined;
      const initialTop =
        existing?.top ?? (item.top !== undefined ? toNumber(item.top) : 0);

      return {
        unit_bisnis_id: unitBisnisId,
        nama_unit_bisnis: getUnitBisnisName(item),
        top: initialTop,
      };
    });
};

const fetchCreditLimitHistories = async () => {
  if (!menuId.value) {
    creditLimitHistories.value = [];
    return;
  }

  creditLimitHistoriesLoading.value = true;
  try {
    const queryParams = new URLSearchParams({
      no_pagination: "true",
      filter_column_customer_id: menuId.value,
      include: "m_customer,user_default,m_customer_unit_bisnis>m_unit_bisnis",
      join: "true",
      order_by: "updatedAt",
      order_type: "DESC",
    });

    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_customer_cl_history?${queryParams.toString()}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );

    const result = await response.json();
    if (result.status === "success" && Array.isArray(result.data)) {
      creditLimitHistories.value = result.data;
      return;
    }

    creditLimitHistories.value = [];
    toast.error("Gagal memuat history credit limit");
  } catch (error) {
    creditLimitHistories.value = [];
    toast.error("Gagal memuat history credit limit", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    creditLimitHistoriesLoading.value = false;
  }
};

const openCreditLimitHistory = async () => {
  creditLimitHistoryFilterUnit.value = "";
  isCreditLimitHistoryOpen.value = true;
  await fetchCreditLimitHistories();
};

const openSettingCredit = async () => {
  syncCreditLimitSettings();
  creditLimitSettingsSnapshot.value = cloneCreditLimitSettings(
    creditLimitSettings.value,
  );
  isSettingCreditOpen.value = true;
};

const resetSettingCredit = () => {
  creditLimitSettings.value = cloneCreditLimitSettings(
    creditLimitSettingsSnapshot.value,
  );
  syncMainCreditValues();
  isSettingCreditOpen.value = false;
};

const saveSettingCredit = () => {
  syncMainCreditValues();
  creditLimitSettingsSnapshot.value = cloneCreditLimitSettings(
    creditLimitSettings.value,
  );
  isSettingCreditOpen.value = false;
};
const openSettingTop = async () => {
  syncTopSettings();
  topSettingsSnapshot.value = cloneTopSettings(topSettings.value);
  isSettingTopOpen.value = true;
};

const resetSettingTop = () => {
  topSettings.value = cloneTopSettings(topSettingsSnapshot.value);
  isSettingTopOpen.value = false;
};

const saveSettingTop = () => {
  topSettingsSnapshot.value = cloneTopSettings(topSettings.value);
  isSettingTopOpen.value = false;
};

const handleSistemPembayaranChange = (value: string) => {
  values.sistem_pembayaran = value;
  if (!value) {
    sistemPembayaranValue.value = "";
    return;
  }
  applyTopBySistemPembayaran();
};

const handleSistemPembayaranFullChange = (item: Record<string, any> | null) => {
  sistemPembayaranValue.value = normalizeSistemPembayaranValue(item?.value1);
  applyTopBySistemPembayaran();
};

// Computed for Unit Bisnis MultiSelect (Array of IDs <-> Array of Objects)
const unit_bisnis_ids_computed = computed({
  get: () =>
    (values.m_customer_unit_bisnis || [])
      .map((item: any) => item.unit_bisnis_id)
      .filter((id: any) => !!id) as string[],
  set: (newIds: string[]) => {
    const oldIds = unit_bisnis_ids_computed.value;
    const sanitizedNewIds = !isSuperAdmin.value
      ? newIds.filter((id: string) => {
          return allowedUnitBisnisIdSet.value?.has(id) || oldIds.includes(id);
        })
      : newIds;

    const existingMap = new Map(
      (values.m_customer_unit_bisnis || [])
        .filter((item) => !!item.unit_bisnis_id)
        .map((item) => [item.unit_bisnis_id as string, item]),
    );
    values.m_customer_unit_bisnis = sanitizedNewIds.map(
      (id) =>
        existingMap.get(id) ||
        ({ unit_bisnis_id: id } as CustomerUnitBisnisItem),
    );
    syncCreditLimitSettings();
  },
});

// Helper computed to provide options for FieldMultiSelect (especially for read-only mode)
const getUnitBisnisOptions = computed(() => {
  const fallbackOptions = (values.m_unit_bisnis_list || []).map((i: any) => ({
    id: i.unit_bisnis_id || i.m_unit_bisnis_id || i.id,
    nama_comp:
      i.m_unit_bisni?.nama_comp ||
      i.m_unit_bisnis?.nama_comp ||
      i.unit_bisnis?.nama_comp ||
      i.m_unit_bisni?.nama_unit_bisnis ||
      i.m_unit_bisnis?.nama_unit_bisnis ||
      i.unit_bisnis?.nama_unit_bisnis ||
      i.nama_comp ||
      "-",
    m_company_id:
      i.m_company_id ||
      i.m_company?.id ||
      i.m_unit_bisni?.m_company?.id ||
      i.m_unit_bisnis?.m_company?.id ||
      i.unit_bisnis?.m_company?.id ||
      "",
    m_company:
      i.m_company ||
      i.m_unit_bisni?.m_company ||
      i.m_unit_bisnis?.m_company ||
      i.unit_bisnis?.m_company ||
      null,
  }));

  return unitBisnisOptions.value.length > 0
    ? unitBisnisOptions.value.map((item) => ({
        id: item.id,
        nama_comp: item.nama_comp || item.nama_unit_bisnis || item.nama || "-",
        m_company_id: item.m_company_id || item.m_company?.id || "",
        m_company: item.m_company || null,
      }))
    : fallbackOptions;
});

// ============================================================================
// DETAIL METHODS - DYNAMIC GENERATION
// ============================================================================

const addDetailArr = () => {
  detailArr.value.push({
    tipe_id: "",
    nomor: "",
    alamat: "",
    nama: "",
    catatan: "",
    foto: "",
    is_active: true,
  });
};

const removeDetailArr = (index: number) => {
  detailArr.value.splice(index, 1);
  toast.info("Detail dihapus");
};

const addDetailArr2 = () => {
  const isFirstItem = detailArr2.value.length === 0;
  detailArr2.value.push({
    delivery_area: "",
    nama: "",
    alamat: "",
    provinsi: "",
    kota: "",
    kecamatan: "",
    kode_pos: "",
    telepon: "",
    fax: "",
    email: "",
    catatan: "",
    is_default: isFirstItem, // Auto-set default jika item pertama
    is_active: true,
  });
  if (isFirstItem) {
    toast.info("Alamat pertama otomatis dijadikan default");
  }
};

const removeDetailArr2 = (index: number) => {
  const wasDefault = detailArr2.value[index].is_default;
  detailArr2.value.splice(index, 1);
  // Jika yang dihapus adalah default dan masih ada item lain, set item pertama jadi default
  if (wasDefault && detailArr2.value.length > 0) {
    detailArr2.value[0].is_default = true;
    toast.info(
      "Alamat pertama dijadikan default karena default sebelumnya dihapus",
    );
  }
  toast.info("Alamat dihapus");
};

const toggleDefaultAlamat = (index: number) => {
  // Jika yang di-klik sudah default, tidak bisa di-unset
  if (detailArr2.value[index].is_default) {
    toast.warning("Tidak dapat menonaktifkan alamat default", {
      description:
        "Harus ada minimal 1 alamat default. Pilih alamat lain sebagai default terlebih dahulu.",
    });
    return;
  }
  // Set semua is_default jadi false, lalu set yang dipilih jadi true
  detailArr2.value.forEach((item, idx) => {
    item.is_default = idx === index;
  });
  toast.success("Alamat default berhasil diubah");
};

const toggleAlamat = (idx: number) => {
  if (expandedAlamats.value.has(idx)) {
    expandedAlamats.value.delete(idx);
  } else {
    expandedAlamats.value.add(idx);
  }
};

const toggleDefaultRekening = (index: number) => {
  // Jika yang di-klik sudah default, tidak bisa di-unset
  if (detailArr3.value[index].is_default) {
    toast.warning("Tidak dapat menonaktifkan rekening default", {
      description:
        "Harus ada minimal 1 rekening default. Pilih rekening lain sebagai default terlebih dahulu.",
    });
    return;
  }
  // Set semua is_default jadi false, lalu set yang dipilih jadi true
  detailArr3.value.forEach((item, idx) => {
    item.is_default = idx === index;
  });
  toast.success("Rekening default berhasil diubah");
};

const toggleRekening = (idx: number) => {
  if (expandedRekenings.value.has(idx)) {
    expandedRekenings.value.delete(idx);
  } else {
    expandedRekenings.value.add(idx);
  }
};

const addDetailArr3 = () => {
  const isFirstItem = detailArr3.value.length === 0;
  detailArr3.value.push({
    nama_bank: "",
    nomor_rekening: "",
    nama_rekening: "",
    catatan: "",
    is_default: isFirstItem, // Auto-set default jika item pertama
    is_active: true,
  });
  if (isFirstItem) {
    toast.info("Rekening pertama otomatis dijadikan default");
  }
};

const removeDetailArr3 = (index: number) => {
  const wasDefault = detailArr3.value[index].is_default;
  detailArr3.value.splice(index, 1);
  // Jika yang dihapus adalah default dan masih ada item lain, set item pertama jadi default
  if (wasDefault && detailArr3.value.length > 0) {
    detailArr3.value[0].is_default = true;
    toast.info(
      "Rekening pertama dijadikan default karena default sebelumnya dihapus",
    );
  }
  toast.info("Rekening dihapus");
};

const addDetailArr4 = () => {
  const isFirstItem = detailArr4.value.length === 0;
  detailArr4.value.push({
    jabatan: "",
    nama: "",
    tgl_lahir: "",
    nomor: "",
    email: "",
    is_default: isFirstItem,
    is_active: true,
  });
  if (isFirstItem) {
    toast.info("Kontak pertama otomatis dijadikan default");
  }
};

const removeDetailArr4 = (index: number) => {
  const wasDefault = detailArr4.value[index].is_default;
  detailArr4.value.splice(index, 1);
  if (wasDefault && detailArr4.value.length > 0) {
    detailArr4.value[0].is_default = true;
    toast.info(
      "Kontak pertama dijadikan default karena default sebelumnya dihapus",
    );
  }
  toast.info("Kontak dihapus");
};

const toggleDefaultKontak = (index: number) => {
  if (detailArr4.value[index].is_default) {
    toast.warning("Tidak dapat menonaktifkan kontak default", {
      description:
        "Harus ada minimal 1 kontak default. Pilih kontak lain sebagai default terlebih dahulu.",
    });
    return;
  }
  detailArr4.value.forEach((item, idx) => {
    item.is_default = idx === index;
  });
  toast.success("Kontak default berhasil diubah");
};

// Ekspedisi
const addDetailArr5 = () => {
  const isFirstItem = detailArr5.value.length === 0;
  detailArr5.value.push({
    m_ekspedisi_id: "",
    nama_ekspedisi: "", // Display only
    is_default: isFirstItem,
  });
  if (isFirstItem) {
    toast.info("Ekspedisi pertama otomatis dijadikan default");
  }
};

const removeDetailArr5 = (index: number) => {
  const wasDefault = detailArr5.value[index].is_default;
  detailArr5.value.splice(index, 1);
  if (wasDefault && detailArr5.value.length > 0) {
    detailArr5.value[0].is_default = true;
    toast.info(
      "Ekspedisi pertama dijadikan default karena default sebelumnya dihapus",
    );
  }
  toast.info("Ekspedisi dihapus");
};

const toggleDefaultEkspedisi = (index: number) => {
  if (detailArr5.value[index].is_default) {
    toast.warning("Tidak dapat menonaktifkan ekspedisi default", {
      description:
        "Harus ada minimal 1 ekspedisi default. Pilih ekspedisi lain sebagai default terlebih dahulu.",
    });
    return;
  }
  detailArr5.value.forEach((item, idx) => {
    item.is_default = idx === index;
  });
  toast.success("Ekspedisi default berhasil diubah");
};

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  // Reset reactive values to defaults
  Object.assign(values, {
    m_unit_bisnis_id: "",
    company_id: "",
    m_customer_unit_bisnis: [],
    m_unit_bisnis_list: [],
    kode_customer: "",
    tipe_customer: "",
    prefix: "",
    nama_customer: "",
    alias_customer: "",
    is_tax: false,
    toleransi: 0,
    kredit_limit: 0,
    sisa_kredit_limit: 0,
    top_id: "",
    tolerance: "",
    cara_penagihan: "",
    customer_group_id: "",
    no_ktp: "",
    alamat: "",
    provinsi: "",
    kota: "",
    kecamatan: "",
    kodepos: "",
    kode_pos: "",
    email: "",
    website: "",
    no_telp_office: "",
    fax: "",
    cp_1: "",
    no_cp_1: "",
    email_cp_1: "",
    cp_2: "",
    no_cp_2: "",
    email_cp_2: "",
    lat: "",
    long: "",
    catatan: "",
    sales_area_id: "",
    sales_id: "",
    pengiriman_id: "",
    is_active: true,
    parcel: "",
    sistem_pembayaran: "",
    m_customer_images: [],
    merk_koli: "",
  });
  creditLimitSettings.value = [];
  company.value = null;

  // Reset errors
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });

  // Reset detail arrays - DYNAMIC
  detailArr.value = [];
  detailArr2.value = [];
  detailArr3.value = [];
  detailArr4.value = [];
  detailArr5.value = [];
};

// ============================================================================
// HELPER FUNCTIONS — COMPANY & UNIT BISNIS SELECTION
// ============================================================================

const mergeUnitBisnisOptions = (
  ...sources: Array<Array<Record<string, any> | AllowedUnitBisnisOption>>
) => {
  const merged = new Map<string, AllowedUnitBisnisOption>();

  sources.flat().forEach((sourceItem) => {
    const item: any = sourceItem;
    const id =
      item?.id ||
      item?.m_unit_bisnis_id ||
      item?.unit_bisnis_id ||
      item?.m_unit_bisnis?.id ||
      item?.m_unit_bisni?.id;

    if (!id) return;

    const nama =
      item?.nama_comp ||
      item?.m_unit_bisni?.nama_comp ||
      item?.m_unit_bisnis?.nama_comp ||
      item?.unit_bisnis?.nama_comp ||
      merged.get(id)?.nama_comp ||
      id;
    const companyId =
      item?.m_company_id ||
      item?.m_company?.id ||
      item?.m_unit_bisni?.m_company?.id ||
      item?.m_unit_bisnis?.m_company?.id ||
      item?.unit_bisnis?.m_company?.id ||
      merged.get(id)?.m_company_id ||
      "";
    const companyName =
      item?.m_company?.nama ||
      item?.m_unit_bisni?.m_company?.nama ||
      item?.m_unit_bisnis?.m_company?.nama ||
      item?.unit_bisnis?.m_company?.nama ||
      merged.get(id)?.m_company?.nama ||
      "";

    merged.set(id, {
      id,
      nama_comp: nama,
      m_company_id: companyId,
      m_company:
        companyId || companyName
          ? {
              id: companyId,
              nama: companyName || companyId,
            }
          : null,
    });
  });

  return Array.from(merged.values());
};

const buildUnitBisnisApiUrl = (ids?: string[]) => {
  const params = new URLSearchParams({
    no_pagination: "true",
    filter_column_is_active: "true",
    include: "m_company",
  });

  if (ids?.length) {
    ids.forEach((id) => params.append("filter_column_id", id));
  }

  return `${API_BASE_URL}/dynamic/m_unit_bisnis?${params.toString()}`;
};

const setCompanyFromSelection = (companyId?: string | null) => {
  const normalizedCompanyId = companyId?.trim() || "";
  values.company_id = normalizedCompanyId;

  if (!normalizedCompanyId) {
    company.value = null;
    return;
  }

  const selectedCompany = companyOptions.value.find(
    (item) => item.id === normalizedCompanyId,
  );

  company.value = selectedCompany || {
    id: normalizedCompanyId,
    nama: normalizedCompanyId,
  };
};

const syncCompanySelectionFromUnitBisnis = (preferFirst = false) => {
  const companyIds = companyOptions.value.map((item) => item.id);
  const currentCompanyId = values.company_id?.trim();

  if (currentCompanyId && companyIds.includes(currentCompanyId)) {
    setCompanyFromSelection(currentCompanyId);
    return;
  }

  if (companyIds.length === 1) {
    setCompanyFromSelection(companyIds[0]);
    return;
  }

  if (preferFirst && companyIds.length > 0) {
    setCompanyFromSelection(companyIds[0]);
    return;
  }

  setCompanyFromSelection("");
};

const applyCompanyFilterToSelectedUnitBisnis = (companyId?: string | null) => {
  const normalizedCompanyId = companyId?.trim() || "";
  if (!normalizedCompanyId || isReadOnly.value) return;

  const availableIds = getUnitBisnisOptions.value
    .filter((option: any) => option.m_company_id === normalizedCompanyId)
    .map((option: any) => option.id);

  if (availableIds.length === 0) {
    unit_bisnis_ids_computed.value = [];
    return;
  }

  const selectedIds = unit_bisnis_ids_computed.value.filter((id) =>
    availableIds.includes(id),
  );

  if (selectedIds.length > 0) {
    unit_bisnis_ids_computed.value = selectedIds;
    return;
  }

  if (isCreateMode.value) {
    unit_bisnis_ids_computed.value = availableIds;
  } else {
    unit_bisnis_ids_computed.value = [];
  }
};

const handleCompanyChange = (selectedCompany: Record<string, any> | null) => {
  company.value = selectedCompany;
  const companyId = selectedCompany?.id || values.company_id;
  setCompanyFromSelection(companyId);
  applyCompanyFilterToSelectedUnitBisnis(companyId);
};

const fetchAllowedUnitBisnisOptions = async (): Promise<
  AllowedUnitBisnisOption[]
> => {
  if (isSuperAdmin.value) {
    const response = await fetch(buildUnitBisnisApiUrl(), {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authStore.token}`,
      },
    });
    const result = await response.json();

    if (result.status === "success" && Array.isArray(result.data)) {
      return mergeUnitBisnisOptions(
        result.data.map((ub: any) => ({
          id: ub.id,
          nama_comp: ub.nama_comp,
          m_company_id: ub.m_company?.id || "",
          m_company: ub.m_company
            ? {
                id: ub.m_company.id,
                nama: ub.m_company.nama,
              }
            : null,
        })),
      );
    }

    return [];
  }

  const allowedIds = allowedUnitBisnisIds.value || [];
  if (allowedIds.length === 0) {
    if (!hasShownNoUnitBisnisToast.value) {
      hasShownNoUnitBisnisToast.value = true;
      toast.warning("Unit bisnis tidak tersedia", {
        description:
          "Anda tidak memiliki unit bisnis dari respo aktif. Hubungi administrator jika ini tidak sesuai.",
      });
    }
    return [];
  }

  const metadataOptions = allowedUnitBisnisMetadata.value;
  const metadataMap = new Map(metadataOptions.map((ub) => [ub.id, ub]));

  const response = await fetch(buildUnitBisnisApiUrl(allowedIds), {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authStore.token}`,
    },
  });
  const result = await response.json();

  if (result.status === "success" && Array.isArray(result.data)) {
    const filteredUnitBisnis = result.data
      .filter((ub: any) => allowedIds.includes(ub.id))
      .map((ub: any) => ({
        id: ub.id,
        nama_comp: metadataMap.get(ub.id)?.nama_comp || ub.nama_comp || ub.id,
        m_company_id:
          ub.m_company?.id || metadataMap.get(ub.id)?.m_company_id || "",
        m_company: ub.m_company
          ? {
              id: ub.m_company.id,
              nama: ub.m_company.nama,
            }
          : metadataMap.get(ub.id)?.m_company || null,
      }));

    return mergeUnitBisnisOptions(filteredUnitBisnis, metadataOptions);
  }

  return mergeUnitBisnisOptions(metadataOptions);
};

const syncUnitBisnisState = (unitBisnisList: AllowedUnitBisnisOption[]) => {
  unitBisnisNameMap.value = {};
  unitBisnisList.forEach((ub) => {
    unitBisnisNameMap.value[ub.id] = ub.nama_comp;
  });

  // Populate unit bisnis options + m_unit_bisnis_list
  unitBisnisOptions.value = unitBisnisList;
  values.m_unit_bisnis_list = unitBisnisList.map((ub) => ({
    id: ub.id,
    nama_comp: ub.nama_comp,
    m_company_id: ub.m_company_id,
    m_company: ub.m_company,
  }));

  if (hasRespoData.value) {
    // User dengan respo: auto-select company & UB dari respo
    syncCompanySelectionFromUnitBisnis(true);

    const defaultCompanyId = values.company_id?.trim();
    const defaultUnitBisnisList = defaultCompanyId
      ? unitBisnisList.filter((ub) => ub.m_company_id === defaultCompanyId)
      : unitBisnisList;

    values.m_customer_unit_bisnis = defaultUnitBisnisList.map((ub) => ({
      unit_bisnis_id: ub.id,
      m_unit_bisnis: {
        id: ub.id,
        nama_comp: ub.nama_comp,
        nama_unit_bisnis: ub.nama_comp,
      },
    }));
    syncCreditLimitSettings(false);
    syncTopSettings(false);
  } else {
    // User tanpa respo: kosong, harus pilih manual
    setCompanyFromSelection("");
    values.m_customer_unit_bisnis = [];
    creditLimitSettings.value = [];
    topSettings.value = [];
  }
};

const loadCreateModeUnitBisnis = async () => {
  syncUnitBisnisState(await fetchAllowedUnitBisnisOptions());
};

const mergeAllowedUnitBisnisIntoFormOptions = async () => {
  const mergedOptions = mergeUnitBisnisOptions(
    values.m_unit_bisnis_list,
    await fetchAllowedUnitBisnisOptions(),
  );

  values.m_unit_bisnis_list = mergedOptions.map((ub) => ({
    id: ub.id,
    nama_comp: ub.nama_comp,
    m_company_id: ub.m_company_id,
    m_company: ub.m_company,
  }));
  unitBisnisOptions.value = mergedOptions;
  mergedOptions.forEach((ub) => {
    unitBisnisNameMap.value[ub.id] = ub.nama_comp;
  });
  syncCompanySelectionFromUnitBisnis();
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
    const res = await getCustomerById(sourceId);

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

    // Normalisasi is_tax
    if (initialValues.is_tax !== undefined) {
      const v = initialValues.is_tax;
      initialValues.is_tax = v === true || v === 1 || v === "1";
    } else {
      initialValues.is_tax = false;
    }

    // Load detail items - DYNAMIC (plural form from API)

    if (initialValues.m_customer_d_npwps) {
      detailArr.value = initialValues.m_customer_d_npwps;
    }
    if (initialValues.m_customer_d_alamats) {
      detailArr2.value = initialValues.m_customer_d_alamats;
    }
    if (initialValues.m_customer_d_rekenings) {
      detailArr3.value = initialValues.m_customer_d_rekenings;
    }
    if (initialValues.m_customer_d_kontaks) {
      detailArr4.value = initialValues.m_customer_d_kontaks;
    }
    if (initialValues.m_customer_d_ekspedisis) {
      detailArr5.value = initialValues.m_customer_d_ekspedisis.map(
        (item: any) => ({
          ...item,
          nama_ekspedisi: item.m_ekspedisi?.nama || item.nama_ekspedisi || "",
        }),
      );
    }

    // Mode copy: hapus id dan timestamps agar jadi create baru
    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).kode_customer;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
      if (initialValues.m_customer_images) {
        initialValues.m_customer_images = initialValues.m_customer_images.map(
          (img: any) => ({
            gambar: img.gambar,
          }),
        );
      }
      console.log("copyMode:", initialValues);
    }

    // Di onBeforeMount, setelah bagian initialValues.m_customer_unit_bisnis.map(...)
    console.log(
      "DEBUG - Nilai Unit Bisnis setelah fetch:",
      initialValues.m_customer_unit_bisnis,
    );

    // Assign hanya key yang sudah ada di state reactive values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore dynamic assign
        values[key] = initialValues[key];
      }
    }
    console.log(
      "DEBUG - Nilai di 'values.m_customer_unit_bisnis' setelah assignment:",
      values.m_customer_unit_bisnis,
    );
    values.m_customer_images = initialValues.m_customer_images || [];
    sistemPembayaranValue.value = normalizeSistemPembayaranValue(
      initialValues.cust_pembayaran_id?.value1 ||
        initialValues.cust_pembayaran?.value1 ||
        "",
    );
    applyTopBySistemPembayaran();

    if (initialValues.m_customer_unit_bisnis) {
      initialValues.m_customer_unit_bisnis =
        initialValues.m_customer_unit_bisnis.map((d: any) => ({
          customer_ub_id: d.customer_ub_id || d.id,
          unit_bisnis_id: d.unit_bisnis_id,
          m_unit_bisnis: d.m_unit_bisnis || d.unit_bisnis,
          unit_bisnis: d.unit_bisnis || d.m_unit_bisnis,
          kredit_limit: toNumber(d.kredit_limit),
          sisa_kredit_limit: toNumber(d.sisa_kredit_limit),
          kredit_limit_terpakai:
            d.kredit_limit_terpakai !== undefined
              ? toNumber(d.kredit_limit_terpakai)
              : Math.max(
                  toNumber(d.kredit_limit) - toNumber(d.sisa_kredit_limit),
                  0,
                ),
          top: toNumber(d.top),
        }));
    }

    syncCreditLimitSettings(false);

    if (!isSuperAdmin.value) {
      await mergeAllowedUnitBisnisIntoFormOptions();
    }

    // Extract prefix dari nama_customer saat read (e.g. "PT Nama Company" → prefix="PT", nama_customer="Nama Company")
    if (values.nama_customer) {
      const prefixes = ["PT", "CV", "UD"];
      for (const pfx of prefixes) {
        if (values.nama_customer.startsWith(pfx + " ")) {
          values.prefix = pfx;
          values.nama_customer = values.nama_customer.substring(pfx.length + 1);
          if (!values.tipe_customer) {
            values.tipe_customer = "Perusahaan";
          }
          break;
        }
      }
    }

    if (isCopyModeLocal) {
      toast.success("Data berhasil disalin", {
        description: "Silakan edit dan simpan sebagai Customer baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Customer", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () => router.push("/marketing/master/m_customer"),
      },
    });
    setTimeout(() => router.push("/marketing/master/m_customer"), 2000);
  } finally {
    loading.value = false;
  }
});

// ============================================================================
// LOAD UNIT BISNIS DEFAULTS (CREATE MODE)
// ============================================================================
onMounted(async () => {
  if (!isEditMode.value && !isViewMode.value && !isCopyMode.value) {
    try {
      await loadCreateModeUnitBisnis();
    } catch (e) {
      console.error("Failed to load default unit bisnis", e);
    }
  }
});

// Errors object (manual validation)
const errors = reactive({
  m_unit_bisnis_id: "",
  m_customer_unit_bisnis: "",
  prefix: "",
  nama_customer: "",
  alias_customer: "",
  no_ktp: "",
  alamat: "",
  cp_1: "",
  no_cp_1: "",
  no_npwp: "",
  kredit_limit: "",
  toleransi: "",
  pengiriman_id: "",
  cara_penagihan: "",
  sistem_pembayaran: "",
  parcel: "",
  m_customer_images: "",
  top_id: "",
});

const isRequiredValueEmpty = (value: unknown) =>
  value === "" || value === null || value === undefined;

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  const currentUserId = authStore.user?.id || null;
  // Validasi required
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });
  let invalid = false;
  const shouldValidateGeneral =
    !isCustomerUpdateActive.value || updateDataOptions.otherData;
  const shouldValidateCredit =
    !isCustomerUpdateActive.value || updateDataOptions.creditLimit;
  const shouldValidateTop =
    !isCustomerUpdateActive.value || updateDataOptions.top;

  // Validasi m_unit_bisnis_id - wajib untuk super admin
  // if (isSuperAdmin.value && !values.m_unit_bisnis_id?.trim()) {
  //   errors.m_unit_bisnis_id = "Unit Bisnis wajib dipilih";
  //   invalid = true;
  // }

  // === TAMBAHKAN VALIDASI UNIT BISNIS LIST DI SINI ===
  if (
    !values.m_customer_unit_bisnis ||
    values.m_customer_unit_bisnis.length === 0
  ) {
    // Pastikan key 'm_customer_unit_bisnis' ada di object errors kamu
    errors.m_customer_unit_bisnis = "Minimal pilih satu Unit Bisnis";
    invalid = true;
  }

  // Validasi nama_customer wajib diisi
  if (shouldValidateGeneral && !values.nama_customer?.trim()) {
    errors.nama_customer = "Nama Customer wajib diisi";
    invalid = true;
  }

  // Validasi no_ktp wajib diisi (hanya untuk tipe Individu)
  if (
    shouldValidateGeneral &&
    values.tipe_customer === "Individu" &&
    !values.no_ktp?.trim()
  ) {
    errors.no_ktp = "No KTP wajib diisi";
    invalid = true;
  }

  // Validasi alamat wajib diisi
  if (shouldValidateGeneral && !values.alamat?.trim()) {
    errors.alamat = "Alamat wajib diisi";
    invalid = true;
  }

  // Validasi cp_1 wajib diisi
  if (shouldValidateGeneral && !values.cp_1?.trim()) {
    errors.cp_1 = "Contact Person 1 wajib diisi";
    invalid = true;
  }

  // Validasi no_cp_1 wajib diisi
  if (shouldValidateGeneral && !values.no_cp_1?.trim()) {
    errors.no_cp_1 = "No Telp CP 1 wajib diisi";
    invalid = true;
  }

  if (shouldValidateCredit && badCredit.value) {
    errors.kredit_limit = "Kredit Limit wajib diisi";
    invalid = true;
  }

  if (shouldValidateGeneral && isRequiredValueEmpty(values.toleransi)) {
    errors.toleransi = "Tolerance wajib diisi";
    invalid = true;
  }
  if (shouldValidateTop && isPembayaranCAD.value && badTop.value) {
    errors.top_id = "ToP wajib diisi";
    invalid = true;
  }

  if (shouldValidateGeneral && !values.sistem_pembayaran?.trim()) {
    errors.sistem_pembayaran = "Sistem Pembayaran wajib dipilih";
    invalid = true;
  }

  if (shouldValidateGeneral && !values.pengiriman_id?.trim()) {
    errors.pengiriman_id = "Cara Pengiriman wajib dipilih";
    invalid = true;
  }

  if (shouldValidateGeneral && !values.cara_penagihan?.trim()) {
    errors.cara_penagihan = "Cara Penagihan wajib dipilih";
    invalid = true;
  }

  if (shouldValidateGeneral && !values.parcel?.trim()) {
    errors.parcel = "Jenis Parcel wajib dipilih";
    invalid = true;
  }

  if (
    shouldValidateGeneral &&
    (!values.m_customer_images || values.m_customer_images.length === 0)
  ) {
    errors.m_customer_images = "Lampiran Foto wajib diisi";
    invalid = true;
  }

  if (invalid) {
    toast.error("Validasi gagal", {
      description: "Mohon lengkapi semua field yang wajib diisi",
    });
    console.log(values);
    return;
  }

  loading.value = true;
  try {
    // Helper to convert empty strings to null
    const toNull = (val?: string | null) => (val?.trim() ? val.trim() : null);

    // Clean payload
    const payload: any = {
      m_unit_bisnis_id: toNull(values.m_unit_bisnis_id),
      tipe_customer: toNull(values.tipe_customer),
      prefix: toNull(values.prefix),
      // Prepend prefix ke nama_customer saat simpan (e.g. "PT Nama Company")
      nama_customer: values.prefix
        ? `${values.prefix} ${values.nama_customer.trim()}`
        : values.nama_customer.trim(),
      alias_customer: toNull(values.alias_customer),
      is_tax: Boolean(values.is_tax),
      toleransi: Number(values.toleransi) || 0,
      kredit_limit: Number(values.kredit_limit) || 0,
      sisa_kredit_limit: Number(values.sisa_kredit_limit) || 0,
      tolerance: toNull(values.tolerance),
      cara_penagihan: toNull(values.cara_penagihan),
      customer_group_id: toNull(values.customer_group_id),
      no_ktp: toNull(values.no_ktp),
      no_npwp: toNull(values.no_npwp),
      sistem_pembayaran: toNull(values.sistem_pembayaran),
      merk_koli: toNull(values.merk_koli),
      parcel: toNull(values.parcel),
      is_berikat: Boolean(values.is_tax && values.is_berikat),
      // Details
      m_customer_images: isEditMode.value
        ? (values.m_customer_images || []).map((img) => ({
            ...((img as any).id && { id: (img as any).id }),
            ...(img.customer_id && { customer_id: img.customer_id }),
            gambar: img.gambar,
          }))
        : (values.m_customer_images || []).map((img) => ({
            gambar: img.gambar,
          })),
      alamat: toNull(values.alamat),
      provinsi: toNull(values.provinsi),
      kota: toNull(values.kota),
      kecamatan: toNull(values.kecamatan),
      kodepos: toNull(values.kodepos),
      kode_pos: toNull(values.kode_pos),
      email: toNull(values.email),
      website: toNull(values.website),
      no_telp_office: toNull(values.no_telp_office),
      fax: toNull(values.fax),
      cp_1: values.cp_1.trim(),
      no_cp_1: values.no_cp_1.trim(),
      email_cp_1: toNull(values.email_cp_1),
      cp_2: toNull(values.cp_2),
      no_cp_2: toNull(values.no_cp_2),
      email_cp_2: toNull(values.email_cp_2),
      lat: toNull(values.lat),
      long: toNull(values.long),
      catatan: toNull(values.catatan),
      sales_area_id: toNull(values.sales_area_id),
      sales_id: toNull(values.sales_id),
      pengiriman_id: toNull(values.pengiriman_id),
      is_active: Boolean(values.is_active),
      m_customer_unit_bisnis: (values.m_customer_unit_bisnis || []).map((d) => {
        const creditSetting = creditLimitSettings.value.find(
          (item) => item.unit_bisnis_id === d.unit_bisnis_id,
        );
        const topSetting = topSettings.value.find(
          (item) => item.unit_bisnis_id === d.unit_bisnis_id,
        );
        return {
          customer_ub_id: d.customer_ub_id || d.id,
          unit_bisnis_id: d.unit_bisnis_id,
          kredit_limit: toNumber(creditSetting?.kredit_limit),
          sisa_kredit_limit: toNumber(creditSetting?.sisa_kredit_limit),
          kredit_limit_terpakai: toNumber(creditSetting?.kredit_limit_terpakai),
          top: toNumber(topSetting?.top),
        };
      }),
      ...(isEditMode.value && { updated_by: currentUserId }),

      // Detail fields - DYNAMIC (plural form to match API)
      m_customer_d_npwps: detailArr.value,
      m_customer_d_alamats: detailArr2.value,
      m_customer_d_rekenings: detailArr3.value,
      m_customer_d_kontaks: detailArr4.value,
      m_customer_d_ekspedisis: detailArr5.value,
    };

    if (!isEditMode.value) {
      payload.created_by = currentUserId;
      payload.updated_by = currentUserId;
      payload.sisa_kredit_limit = Number(values.kredit_limit) || 0;
    }

    if (isCustomerUpdateActive.value && updateDataOptions.otherData) {
      payload.kode_customer = toNull(values.kode_customer);
      await updateCustomer(menuId.value, payload as any);
      toast.success("Customer berhasil diperbarui", {
        description: `Customer "${values.nama_customer}" telah diperbarui`,
      });
      isCustomerUpdateMode.value = false;
      resetUpdateDataOptions();
      router.replace("/marketing/master/m_customer?reload=" + Date.now());
      return;
    }

    if (isCustomerUpdateActive.value) {
      const changeLogs = buildCustomerChangeLogPayloads(payload);
      if (changeLogs.length === 0) {
        toast.error("Tidak ada perubahan data", {
          description: "Ubah minimal satu field sebelum mengirim approval",
        });
        return;
      }

      openSendApprovalDialog(payload, changeLogs);
      return;
    }

    if (isEditMode.value) {
      // Include kode_customer saat update
      payload.kode_customer = toNull(values.kode_customer);
      await updateCustomer(menuId.value, payload as any);
      toast.success("Customer berhasil diperbarui", {
        description: `Customer "${values.nama_customer}" telah diperbarui`,
      });
    } else {
      await createCustomer(payload as any);
      toast.success("Customer berhasil dibuat", {
        description: `Customer "${values.nama_customer}" telah ditambahkan`,
      });
    }
    router.replace("/marketing/master/m_customer?reload=" + Date.now());
  } catch (error) {
    toast.error(
      isEditMode.value
        ? "Gagal memperbarui Customer"
        : "Gagal membuat Customer",
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
const resetCustomerUpdateFinanceDrafts = () => {
  syncCreditLimitSettings(false);
  creditLimitSettingsSnapshot.value = cloneCreditLimitSettings(
    creditLimitSettings.value,
  );
  syncMainCreditValues();

  syncTopSettings(false);
  topSettingsSnapshot.value = cloneTopSettings(topSettings.value);
};

const handleCancel = () => {
  if (isCustomerUpdateActive.value) {
    resetCustomerUpdateFinanceDrafts();
    isCustomerUpdateMode.value = false;
    resetUpdateDataOptions();
    return;
  }

  router.push("/marketing/master/m_customer");
};
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
    <!-- ================================================================ -->
    <!-- HEADER SECTION -->
    <!-- ================================================================ -->
    <div class="flex items-center justify-between gap-4">
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
      <Badge variant="secondary" class="uppercase">{{
        values.status || "DRAFT"
      }}</Badge>
    </div>

    <Dialog v-model:open="isUpdateDataDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Data Customer</DialogTitle>
          <DialogDescription>
            Pilih jenis perubahan yang akan diajukan.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3">
          <label
            class="flex items-center gap-3 rounded-md border px-3 py-2 text-sm font-medium cursor-pointer"
          >
            <input
              type="checkbox"
              class="h-4 w-4"
              :checked="updateDataOptions.creditLimit"
              @change="toggleFinanceUpdateOption('creditLimit')"
            />
            Kredit Limit
          </label>
          <label
            class="flex items-center gap-3 rounded-md border px-3 py-2 text-sm font-medium cursor-pointer"
          >
            <input
              type="checkbox"
              class="h-4 w-4"
              :checked="updateDataOptions.top"
              @change="toggleFinanceUpdateOption('top')"
            />
            ToP
          </label>
          <label
            class="flex items-center gap-3 rounded-md border px-3 py-2 text-sm font-medium cursor-pointer"
          >
            <input
              type="checkbox"
              class="h-4 w-4"
              :checked="updateDataOptions.otherData"
              @change="toggleOtherDataUpdateOption"
            />
            Data Lainnya
          </label>
        </div>

        <DialogFooter class="gap-2">
          <Button
            type="button"
            variant="outline"
            :disabled="loading"
            @click="isUpdateDataDialogOpen = false"
          >
            Batal
          </Button>
          <Button
            type="button"
            :disabled="loading"
            @click="confirmUpdateDataMode"
          >
            Lanjut
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog
      :open="isSendApprovalDialogOpen"
      @update:open="isSendApprovalDialogOpen = $event"
    >
      <DialogContent class="max-w-md">
        <DialogHeader>
          <div class="flex items-center gap-3 mb-2">
            <div
              class="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50"
            >
              <Info class="w-5 h-5 text-blue-600" />
            </div>
            <DialogTitle class="text-lg"
              >Kirim Approval Perubahan Customer</DialogTitle
            >
          </div>
          <DialogDescription>
            Tambahkan catatan approval bila diperlukan sebelum pengajuan
            perubahan customer dikirim.
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-2">
          <FieldX
            id="approval-catatan"
            v-model="approvalCatatan"
            type="textarea"
            label="Catatan Approval"
            placeholder="Masukkan catatan untuk approval (opsional)"
            hints="Catatan ini akan dikirim ke penerima approval"
            :disabled="isSendingApproval"
            :rows="4"
          />
        </div>

        <DialogFooter class="gap-2">
          <Button
            variant="outline"
            @click="cancelSendApproval"
            :disabled="isSendingApproval"
          >
            Batal
          </Button>
          <Button
            variant="default"
            @click="confirmSendApproval"
            :disabled="isSendingApproval"
            class="gap-2"
          >
            <Loader2 v-if="isSendingApproval" class="h-4 w-4 animate-spin" />
            <span>{{ isSendingApproval ? "Mengirim..." : "Send" }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ================================================================ -->
    <!-- FORM SECTION -->
    <!-- ================================================================ -->
    <!-- Form tanpa submit default; penyimpanan melalui tombol onSave -->
    <form class="space-y-6" @submit.prevent>
      <!-- HEADER CARD (tanpa tab) -->
      <Card>
        <CardHeader class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Informasi Customer</CardTitle>
            <CardDescription>
              Isi data Customer dengan lengkap dan benar
            </CardDescription>
          </div>
          <Button v-if="canUseCustomerUpdateFlow && !isCustomerUpdateActive" type="button"
            @click="openUpdateDataDialog" :disabled="loading" class="gap-2 shrink-0 w-full sm:w-auto">
            <Settings class="h-4 w-4" />
            Update Data
          </Button>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Unit Bisnis - Super Admin: Popup Select, User Biasa: Auto dari SelectRespo -->

            <!-- <FieldSelect
              v-if="isSuperAdmin"
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              v-model="values.m_unit_bisnis_id"
              :errorname="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id || 'Pilih unit bisnis'"
              :required="!isUnitBisnisReadonly"
              :disabled="loading || isUnitBisnisReadonly"
              :readonly="isUnitBisnisReadonly"
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
            /> -->
            <FieldSelect
              id="company"
              label="Company"
              v-model="values.company_id"
              displayField="nama"
              valueField="id"
              :options="companyOptions"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih company"
              @update:valueFull="handleCompanyChange"
            />

            <FieldMultiSelect
              id="unit_bisnis_ids"
              label="Unit Bisnis"
              v-model="unit_bisnis_ids_computed"
              :api="unitBisnisFieldApi"
              :options="filteredUnitBisnisOptions"
              displayField="nama_comp"
              valueField="id"
              :errorname="errors.m_customer_unit_bisnis ? 'failed' : ''"
              :hints="
                errors.m_customer_unit_bisnis ||
                (!isSuperAdmin && getUnitBisnisOptions.length === 0
                  ? 'Tidak ada unit bisnis dari respo aktif'
                  : 'Pilih unit bisnis')
              "
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih unit bisnis"
              class="w-full"
            />

            <!-- Kode Customer (Auto-generated, readonly) -->
            <FieldX
              id="kode_customer"
              label="Kode Customer"
              :value="values.kode_customer"
              :required="false"
              :disabled="true"
              :readonly="true"
              placeholder="Auto-generated by System"
              class="w-full"
            />
            <!-- Tipe Customer: tipe_customer, is_tax (checkbox), is_active (switch) dalam satu kolom -->
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
              <!-- Tipe Select -->
              <FieldSelect
                id="tipe_customer"
                :value="values.tipe_customer"
                @input="
                  (v: string) => {
                    values.tipe_customer = v;
                    // Reset prefix ketika tipe berubah ke Individu
                    if (v !== 'Perusahaan') {
                      values.prefix = '';
                    }
                  }
                "
                class="w-full min-w-0 flex-1"
                :options="[
                  { value: 'retail', label: 'Retail' },
                  { value: 'end-user', label: 'End User' },
                ]"
                placeholder="Pilih tipe Customer"
                :clearable="true"
                :disabled="loading || isGeneralReadonly"
                label="Tipe Customer"
              />

              <!-- Customer Group -->
              <FieldSelect
                id="customer_group_id"
                :value="values.customer_group_id"
                @input="(v: string) => (values.customer_group_id = v)"
                displayField="nama"
                valueField="id"
                class="w-full min-w-0 flex-1"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_customer_group`,
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
                placeholder="Pilih Customer Group"
                label="Customer Group"
                :clearable="true"
                :disabled="loading || isGeneralReadonly"
              />
            </div>

            <!-- Nama Customer: prefix (select) + nama_customer (input) dalam satu kolom -->
            <div class="w-full space-y-1">
              <label
                class="flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 mb-2 block"
              >
                Nama Customer
                <span
                  v-if="!isGeneralReadonly"
                  class="text-destructive ml-1 font-semibold"
                  >*</span
                >
              </label>
              <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
                <!-- Prefix (hanya tampil jika tipe = Perusahaan) -->
                <FieldSelect
                  id="prefix"
                  :value="values.prefix"
                  :clearable="true"
                  v-model="values.prefix"
                  :errorname="errors.prefix ? 'failed' : ''"
                  :disabled="isGeneralReadonly || loading"
                  :readonly="isGeneralReadonly || loading"
                  :options="[
                    { value: 'PT', label: 'PT' },
                    { value: 'CV', label: 'CV' },
                    { value: 'UD', label: 'UD' },
                  ]"
                  placeholder="PT/CV"
                  class="w-full sm:w-28 shrink-0"
                />
                <!-- Nama Customer -->
                <FieldX
                  id="nama_customer"
                  :value="values.nama_customer"
                  :errorname="errors.nama_customer ? 'failed' : ''"
                  @input="(v) => (values.nama_customer = v)"
                  :hints="errors.nama_customer"
                  :disabled="loading || isGeneralReadonly"
                  :readonly="isGeneralReadonly"
                  placeholder="Nama lengkap customer"
                  class="w-full min-w-0 flex-1"
                />
              </div>
            </div>

            <!-- Nama Customer Alias -->
            <FieldX
              id="alias_customer"
              :value="values.alias_customer"
              :errorname="errors.alias_customer ? 'failed' : ''"
              @input="(v) => (values.alias_customer = v)"
              :hints="errors.alias_customer"
              :disabled="loading || isGeneralReadonly"
              :readonly="isGeneralReadonly"
              label="Nama Alias Customer"
              placeholder="Nama Alias Customer"
              class="w-full"
            />

            <!-- No KTP - hanya tampil untuk tipe Individu -->
            <!-- <FieldX v-if="values.tipe_customer === 'Individu' || isGeneralReadonly" id="no_ktp" label="No KTP" type="decimal"
              :value="values.no_ktp" :errorname="errors.no_ktp ? 'failed' : ''" @input="(v) => (values.no_ktp = v)"
              :hints="errors.no_ktp" :required="!isGeneralReadonly && values.tipe_customer === 'Individu'"
              :disabled="loading || isGeneralReadonly" :readonly="isGeneralReadonly" placeholder="Nomor KTP" class="flex-1" /> -->
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div class="w-full min-w-0 space-y-1">
                <!-- Kredit Limit -->
                <label
                  class="flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 mb-2 block"
                >
                  Kredit Limit
                  <span
                    v-if="!isCreditLimitReadonly"
                    class="text-destructive ml-1 font-semibold"
                    >*</span
                  >
                </label>
                <div class="flex items-center gap-2">
                  <!-- <FieldNumber id="kredit_limit" v-model="values.kredit_limit" :min="0"
                  :required="true" :disabled="loading || isGeneralReadonly" :readonly="isGeneralReadonly" placeholder="0"
                  :errorname="errors.kredit_limit ? 'failed' : ''"
                  :hints="errors.kredit_limit || 'Nilai kredit limit default 0'" class="w-full" label="Kredit Limit" /> -->
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="h-10 flex-1 justify-between border px-3 shadow-xs"
                    :disabled="loading"
                    @click="openSettingCredit"
                  >
                    Setting Kredit Limit
                    <Settings class="h-5 w-5" />
                  </Button>
                  <!-- kredit limit history button -->
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="h-10 w-10 flex-shrink-0 border shadow-xs"
                    :disabled="loading || !menuId"
                    @click="openCreditLimitHistory"
                  >
                    <Clock3 class="h-5 w-5" />
                  </Button>
                  
                </div>
                <p
                  v-if="errors.kredit_limit"
                  class="text-sm text-destructive mt-1"
                >
                  {{ errors.kredit_limit }}
                </p>
              </div>
              <!-- Cara Penagihan Select -->

              <FieldSelect
                id="cara_penagihan"
                :value="values.cara_penagihan"
                :required="true"
                @input="(v: string) => (values.cara_penagihan = v)"
                displayField="value1"
                valueField="id"
                class="w-full min-w-0"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_general`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    no_pagination: 'true',
                    selectfield: 'id,value1',
                    filter_column_group: 'CARA PENAGIHAN',
                    filter_column_is_active: 'true',
                  },
                }"
                placeholder="Pilih Cara Penagihan"
                :clearable="true"
                :error-text="errors.cara_penagihan ? 'failed' : ''"
                :hints="errors.cara_penagihan"
                :disabled="loading || isGeneralReadonly"
                label="Cara Penagihan"
              />
            </div>

            <Dialog v-model:open="isCreditLimitHistoryOpen">
              <DialogContent class="sm:max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Credit Limit Histories</DialogTitle>
                  <DialogDescription>
                    Menampilkan perubahan credit limit customer.
                  </DialogDescription>
                </DialogHeader>

                <div v-if="creditLimitHistoryUnitOptions.length > 1" class="flex items-center gap-2 pb-2">
                  <label class="text-sm text-muted-foreground whitespace-nowrap">Filter Unit Bisnis:</label>
                  <select
                    v-model="creditLimitHistoryFilterUnit"
                    class="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Semua Unit</option>
                    <option v-for="opt in creditLimitHistoryUnitOptions" :key="opt.id" :value="opt.id">
                      {{ opt.name }}
                    </option>
                  </select>
                </div>

                <div class="max-h-[420px] overflow-auto border rounded-md">
                  <table class="w-full text-sm">
                    <thead class="bg-muted/50 sticky top-0">
                      <tr>
                        <th class="text-left px-3 py-2 font-medium border-r">No</th>
                        <th class="text-left px-3 py-2 font-medium border-r">Unit Bisnis</th>
                        <th class="text-left px-3 py-2 font-medium border-r">Old Limit</th>
                        <th class="text-left px-3 py-2 font-medium border-r">New Limit</th>
                        <th class="text-left px-3 py-2 font-medium border-r">Updated At</th>
                        <th class="text-left px-3 py-2 font-medium border-r">Editor</th>
                      </tr>
                    </thead>
                    <tbody v-if="creditLimitHistoriesLoading">
                      <tr>
                        <td colspan="6" class="px-3 py-6 text-center text-muted-foreground">
                          Memuat history...
                        </td>
                      </tr>
                    </tbody>
                    <tbody v-else-if="creditLimitHistories.length === 0">
                      <tr>
                        <td colspan="6" class="px-3 py-6 text-center text-muted-foreground">
                          Belum ada data history credit limit.
                        </td>
                      </tr>
                    </tbody>
                    <tbody v-else-if="filteredCreditLimitHistories.length === 0">
                      <tr>
                        <td colspan="6" class="px-3 py-6 text-center text-muted-foreground">
                          Tidak ada history untuk unit bisnis yang dipilih.
                        </td>
                      </tr>
                    </tbody>
                    <tbody v-else>
                      <tr v-for="(item, idx) in filteredCreditLimitHistories" :key="item.id || idx" class="border-t border-r">
                        <td class="px-3 py-2 border-r">{{ idx + 1 }}</td>
                        <td class="px-3 py-2 border-r whitespace-nowrap">
                          {{ item.cl_history_customer_ub?.m_unit_bisni?.nama_comp || "-" }}
                        </td>
                        <td class="px-3 py-2 border-r">{{ formatLimit(item.old_limit) }}</td>
                        <td class="px-3 py-2 border-r">{{ formatLimit(item.new_limit) }}</td>
                        <td class="px-3 py-2 border-r whitespace-nowrap">{{ formatDateTime(item.updatedAt) }}</td>
                        <td class="px-3 py-2 border-r">{{ item.cl_history_editor?.name || "-" }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog v-model:open="isSettingCreditOpen">
              <DialogContent class="sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Setting Kredit Limit</DialogTitle>
                  <DialogDescription>
                    Nilai Kredit Limit per Unit Bisnis.
                  </DialogDescription>
                </DialogHeader>

                <div class="max-h-[420px] overflow-auto border rounded-md">
                  <table class="w-full text-sm">
                    <thead class="bg-muted/50 sticky top-0">
                      <tr>
                        <th class="text-left px-3 py-2 font-medium border-r">
                          No
                        </th>
                        <th class="text-left px-3 py-2 font-medium border-r">
                          Unit Bisnis
                        </th>
                        <th class="text-left px-3 py-2 font-medium border-r">
                          Kredit Limit
                        </th>
                        <th class="text-left px-3 py-2 font-medium border-r">
                          Sisa Kredit Limit
                        </th>
                        <th class="text-left px-3 py-2 font-medium border-r">
                          Kredit Limit Terpakai
                        </th>
                      </tr>
                    </thead>
                    <tbody v-if="loading">
                      <tr>
                        <td
                          colspan="5"
                          class="px-3 py-6 text-center text-muted-foreground"
                        >
                          Memuat data unit bisnis...
                        </td>
                      </tr>
                    </tbody>
                    <tbody v-else-if="creditLimitSettings.length === 0">
                      <tr>
                        <td
                          colspan="5"
                          class="px-3 py-6 text-center text-muted-foreground"
                        >
                          Pilih minimal satu unit bisnis terlebih dahulu.
                        </td>
                      </tr>
                    </tbody>
                    <tbody v-else>
                      <tr
                        v-for="(item, idx) in creditLimitSettings"
                        :key="item.unit_bisnis_id || idx"
                        class="border-t border-r"
                      >
                        <td class="px-3 py-2 border-r">{{ idx + 1 }}</td>
                        <td class="px-3 py-2 border-r align-top min-w-48">
                          {{ item.nama_unit_bisnis }}
                        </td>
                        <td class="px-3 py-2 border-r min-w-44">
                          <FieldNumber
                            :id="`kredit_limit_${item.unit_bisnis_id}`"
                            :model-value="item.kredit_limit"
                            @update:model-value="
                              (value) =>
                                updateCreditLimitSetting(
                                  idx,
                                  'kredit_limit',
                                  value,
                                )
                            "
                            :min="0"
                            :disabled="
                              loading || isCreditLimitRowReadonly(item)
                            "
                            :readonly="isCreditLimitRowReadonly(item)"
                            placeholder="0"
                            class="w-full"
                          />
                        </td>
                        <td class="px-3 py-2 border-r min-w-44">
                          <FieldNumber
                            :id="`sisa_kredit_limit_${item.unit_bisnis_id}`"
                            :model-value="item.sisa_kredit_limit"
                            :min="0"
                            :disabled="true"
                            :readonly="true"
                            placeholder="0"
                            class="w-full"
                          />
                        </td>
                        <td class="px-3 py-2 border-r min-w-44">
                          <FieldNumber
                            :id="`kredit_limit_terpakai_${item.unit_bisnis_id}`"
                            :model-value="item.kredit_limit_terpakai"
                            @update:model-value="
                              (value) =>
                                updateCreditLimitSetting(
                                  idx,
                                  'kredit_limit_terpakai',
                                  value,
                                )
                            "
                            :min="0"
                            :disabled="true"
                            :readonly="true"
                            placeholder="0"
                            class="w-full"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <DialogFooter v-if="!isCreditLimitReadonly" class="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" :disabled="loading" @click="resetSettingCredit">
                    Kembali
                  </Button>
                  <Button
                    v-if="!isCreditLimitReadonly"
                    type="button"
                    :disabled="loading"
                    @click="saveSettingCredit"
                  >
                    Simpan
                  </Button>
                </DialogFooter>
                <DialogFooter v-else class="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" @click="resetSettingCredit">
                    Tutup
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog v-model:open="isSettingTopOpen">
              <DialogContent class="sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Setting Term of Payment (ToP)</DialogTitle>
                  <DialogDescription>
                    Nilai ToP per Unit Bisnis.
                  </DialogDescription>
                </DialogHeader>

                <div class="max-h-[420px] overflow-auto border rounded-md">
                  <table class="w-full text-sm">
                    <thead class="bg-muted/50 sticky top-0">
                      <tr>
                        <th class="text-left px-3 py-2 font-medium border-r">
                          No
                        </th>
                        <th class="text-left px-3 py-2 font-medium border-r">
                          Unit Bisnis
                        </th>
                        <th class="text-left px-3 py-2 font-medium border-r">
                          ToP (Hari)
                        </th>
                      </tr>
                    </thead>
                    <tbody v-if="loading">
                      <tr>
                        <td
                          colspan="5"
                          class="px-3 py-6 text-center text-muted-foreground"
                        >
                          Memuat data unit bisnis...
                        </td>
                      </tr>
                    </tbody>
                    <tbody v-else-if="topSettings.length === 0">
                      <tr>
                        <td
                          colspan="5"
                          class="px-3 py-6 text-center text-muted-foreground"
                        >
                          Pilih minimal satu unit bisnis terlebih dahulu.
                        </td>
                      </tr>
                    </tbody>
                    <tbody v-else>
                      <tr
                        v-for="(item, idx) in topSettings"
                        :key="item.unit_bisnis_id || idx"
                        class="border-t border-r"
                      >
                        <td class="px-3 py-2 border-r">{{ idx + 1 }}</td>
                        <td class="px-3 py-2 border-r align-top min-w-48">
                          {{ item.nama_unit_bisnis }}
                        </td>
                        <td class="px-3 py-2 border-r min-w-44">
                          <FieldNumber
                            :id="`top_${item.unit_bisnis_id}`"
                            :model-value="item.top"
                            @update:model-value="
                              (value) => {
                                if (topSettings[idx])
                                  topSettings[idx].top = Math.max(
                                    toNumber(value),
                                    0,
                                  );
                              }
                            "
                            :min="0"
                            :disabled="loading || isTopRowReadonly(item)"
                            :readonly="isTopRowReadonly(item)"
                            placeholder="0"
                            class="w-full"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <DialogFooter v-if="!isTopReadonly" class="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" :disabled="loading" @click="resetSettingTop">
                    Kembali
                  </Button>
                  <Button
                    v-if="!isTopReadonly"
                    type="button"
                    :disabled="loading"
                    @click="saveSettingTop"
                  >
                    Simpan
                  </Button>
                </DialogFooter>
                <DialogFooter v-else class="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" @click="resetSettingTop">
                    Tutup
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <!-- NPWP -->
            <!-- <FieldX id="no_npwp" :value="values.no_npwp" :errorname="errors.no_npwp ? 'failed' : ''"
              @input="(v) => (values.no_npwp = v)" :hints="errors.no_npwp" :disabled="loading || isGeneralReadonly"
              :readonly="isGeneralReadonly" label="No. NPWP" placeholder="Masukkan No. NPWP" class="flex-1" /> -->

            <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
              <!-- Sistem Pembayaran -->
              <FieldSelect
                id="sistem_pembayaran"
                :value="values.sistem_pembayaran"
                @input="handleSistemPembayaranChange"
                @update:valueFull="handleSistemPembayaranFullChange"
                displayField="value1"
                valueField="id"
                class="w-full min-w-0 flex-1"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_general`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    no_pagination: 'true',
                    selectfield: 'id,value1',
                    filter_column_group: 'SISTEM PEMBAYARAN',
                    filter_column_is_active: 'true',
                  },
                }"
                placeholder="Pilih Sistem Pembayaran"
                label="Sistem Pembayaran"
                :clearable="true"
                :required="true"
                :error-text="errors.sistem_pembayaran ? 'failed' : ''"
                :hints="errors.sistem_pembayaran"
                :disabled="loading || isGeneralReadonly"
              />
              <!-- Cara Pengiriman Select -->
              <FieldSelect
                id="pengiriman_id"
                :value="values.pengiriman_id"
                @input="(v: string) => (values.pengiriman_id = v)"
                displayField="value1"
                valueField="id"
                class="w-full min-w-0 flex-1"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_general`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    no_pagination: 'true',
                    selectfield: 'id,value1',
                    filter_column_group: 'TIPE PENGIRIMAN',
                    filter_column_is_active: 'true',
                  },
                }"
                placeholder="Pilih Cara Pengiriman"
                label="Cara Pengiriman"
                :clearable="true"
                :required="true"
                :error-text="errors.pengiriman_id ? 'failed' : ''"
                :hints="errors.pengiriman_id"
                :disabled="loading || isGeneralReadonly"
              />
            </div>

            <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div class="w-full min-w-0 flex-1 space-y-1">
                <!-- TOP -->
                <label
                  class="flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 mb-2 block"
                >
                  Setting ToP (Hari)
                  <span
                    v-if="!isTopReadonly"
                    class="text-destructive ml-1 font-semibold"
                    >*</span
                  >
                </label>
                <div class="flex justify-between space-x-1.5 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="w-full h-10 border shadow-xs justify-between px-3"
                    :disabled="loading || !isPembayaranCAD"
                    @click="openSettingTop"
                  >
                    Setting TOP
                    <Settings class="h-5 w-5" />
                  </Button>
                </div>
                <p v-if="errors.top_id" class="text-sm text-destructive mt-1">
                  {{ errors.top_id }}
                </p>
              </div>
              <!-- Tolerance Number -->
              <FieldNumber
                id="toleransi"
                label="Tolerance (hari)"
                v-model="values.toleransi"
                :min="0"
                :required="true"
                :errorname="errors.toleransi ? 'failed' : ''"
                :hints="errors.toleransi"
                :disabled="loading || isGeneralReadonly || !isPembayaranCAD"
                :readonly="isGeneralReadonly"
                placeholder="0"
                class="w-full min-w-0 flex-1"
              />
            </div>
            <!-- <div class="w-full space-y-1"> -->
            <div class="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              <!-- Dikenakan Pajak (checkbox) -->
              <div class="flex gap-3">
                <button
                  type="button"
                  role="checkbox"
                  :aria-checked="!!values.is_tax"
                  :disabled="loading || isGeneralReadonly"
                  @click="
                    () => {
                      if (!isGeneralReadonly && !loading) {
                        values.is_tax = !values.is_tax;
                        if (!values.is_tax) values.is_berikat = false;
                      }
                    }
                  "
                  :class="[
                    'relative inline-flex h-6 w-6 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shadow-sm border-2',
                    !!values.is_tax
                      ? 'bg-primary border-primary'
                      : 'bg-input border-input',
                    loading || isGeneralReadonly
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer',
                  ]"
                >
                  <svg
                    v-if="!!values.is_tax"
                    class="h-4 w-4 text-background"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="3"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </button>
                <span class="text-sm font-semibold"> Pajak </span>
              </div>
              <!-- Kawasan Berikat (checkbox) -->
              <div class="flex gap-3">
                <button
                  type="button"
                  role="checkbox"
                  :aria-checked="!!values.is_berikat"
                  :disabled="loading || isGeneralReadonly || !values.is_tax"
                  @click="
                    () => {
                      if (!isGeneralReadonly && !loading && values.is_tax)
                        values.is_berikat = !values.is_berikat;
                    }
                  "
                  :class="[
                    'relative inline-flex h-6 w-6 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 shadow-sm border-2',
                    !!values.is_berikat
                      ? 'bg-primary border-primary'
                      : 'bg-input border-input',
                    loading || isGeneralReadonly || !values.is_tax
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer',
                  ]"
                >
                  <svg
                    v-if="!!values.is_berikat"
                    class="h-4 w-4 text-background"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="3"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </button>
                <span class="text-sm font-semibold"> Kawasan Berikat </span>
              </div>
            </div>
            <!-- </div> -->

            <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
              <!-- MERK KOLI -->
              <FieldX
                id="merk_koli"
                :value="values.merk_koli"
                @input="(v) => (values.merk_koli = v)"
                :disabled="loading || isGeneralReadonly"
                :readonly="isGeneralReadonly"
                label="Merk Koli"
                placeholder="Masukkan Merk Koli"
                class="w-full sm:w-1/2"
              />
              <!-- parcel Select -->
              <FieldSelect
                id="parcel"
                :value="values.parcel"
                @input="
                  (v: string) => {
                    values.parcel = v;
                  }
                "
                class="w-full sm:w-1/2"
                :options="[
                  { value: 'Imlek', label: 'Imlek' },
                  { value: 'Natal', label: 'Natal' },
                  { value: 'Lebaran', label: 'Lebaran' },
                ]"
                placeholder="Pilih tipe parcel"
                :clearable="true"
                :disabled="loading || isGeneralReadonly"
                label="Jenis Parcel"
                :required="true"
                :error-text="errors.parcel ? 'failed' : ''"
                :hints="errors.parcel"
              />
            </div>

            <div class="flex flex-col gap-4 sm:flex-row sm:items-start">
              <!-- Sales Select -->
              <FieldSelect
                id="sales_id"
                :value="values.sales_id"
                @input="(v: string) => (values.sales_id = v)"
                displayField="nama_kary"
                valueField="id"
                class="w-full min-w-0"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_kary`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    no_pagination: 'true',
                    selectfield: 'id,nama_kary',
                    filter_column_is_active: 'true',
                    filter_column_is_sales: 'true',
                  },
                }"
                placeholder="Pilih Sales"
                label="Sales"
                :clearable="true"
                :disabled="loading || isGeneralReadonly"
              />
              <!-- Status Aktif (switch) -->
              <FieldStatus
                label="Status"
                name="is_active"
                class="w-full min-w-0"
                v-model="values.is_active"
                :disabled="loading"
                :readonly="isGeneralReadonly"
                active-text="Aktif"
                inactive-text="Tidak Aktif"
              />
            </div>

            <!-- Catatan (Textarea full width) -->
            <FieldX
              id="catatan"
              type="textarea"
              label="Catatan"
              v-model="values.catatan"
              :required="false"
              :disabled="loading || isGeneralReadonly"
              :readonly="isGeneralReadonly"
              placeholder="Catatan tambahan..."
              :rows="3"
              class="w-full"
            />

            <!-- ─── SECTION DIVIDER: Alamat Customer ─── -->
            <div class="md:col-span-2">
              <hr class="mb-4" />
              <h3 class="text-base font-semibold text-foreground">
                Alamat Customer
              </h3>
            </div>

            <div class="w-full md:col-span-2">
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <!-- Provinsi (Cascading Select) -->
                <FieldSelect
                  id="provinsi"
                  label="Provinsi"
                  :value="values.provinsi"
                  @input="
                    (v: any) => {
                      values.provinsi = v;
                      values.kota = '';
                      values.kecamatan = '';
                      values.kodepos = '';
                    }
                  "
                  @update:valueFull="
                    (objVal: any) => {
                      if (!objVal) {
                        values.kota = '';
                        values.kecamatan = '';
                        values.kodepos = '';
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
                    disabled: loading || isGeneralReadonly,
                    clearable: true,
                  }"
                  placeholder="Pilih Provinsi"
                  class="w-full"
                />
                <!-- Kota (Dependent on Provinsi) -->
                <FieldSelect
                  id="kota"
                  label="Kota"
                  :value="values.kota"
                  @input="
                    (v: any) => {
                      values.kota = v;
                      values.kecamatan = '';
                      values.kodepos = '';
                    }
                  "
                  @update:valueFull="
                    (objVal: any) => {
                      if (!objVal) {
                        values.kecamatan = '';
                        values.kodepos = '';
                      }
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
                    disabled: !values.provinsi || loading || isGeneralReadonly,
                    clearable: true,
                  }"
                  placeholder="Pilih Kota"
                  class="w-full"
                />
                <!-- Kecamatan (Dependent on Kota) -->
                <FieldSelect
                  id="kecamatan"
                  label="Kecamatan"
                  :value="values.kecamatan"
                  @input="
                    (v: any) => {
                      values.kecamatan = v;
                      values.kodepos = '';
                    }
                  "
                  @update:valueFull="
                    (objVal: any) => {
                      if (!objVal) {
                        values.kodepos = '';
                      }
                    }
                  "
                  :api="
                    {
                      url: 'https://backend.qqltech.com/kodepos/region/kecamatan',
                      params: {
                        kota: values.kota,
                      },
                      fullUrl: true,
                    } as any
                  "
                  valueField="key"
                  displayField="key"
                  :bind="{
                    disabled: !values.kota || loading || isGeneralReadonly,
                    clearable: true,
                  }"
                  placeholder="Pilih Kecamatan"
                  class="w-full"
                />
                <!-- Kode Pos (Dependent on Kecamatan) -->
                <FieldSelect
                  id="kodepos"
                  label="Kode Pos"
                  :value="values.kodepos"
                  @input="(v: any) => (values.kodepos = v)"
                  :api="
                    {
                      url: 'https://backend.qqltech.com/kodepos/region/kelurahan',
                      params: {
                        kota: values.kota,
                        kecamatan: values.kecamatan || '',
                      },
                      fullUrl: true,
                    } as any
                  "
                  valueField="kodepos"
                  displayField="kodepos"
                  :bind="{
                    disabled: !values.kecamatan || loading || isGeneralReadonly,
                    clearable: true,
                  }"
                  placeholder="Pilih Kode Pos"
                  class="w-full"
                />
              </div>
            </div>

            <!-- Alamat (full width) -->
            <FieldX
              id="alamat"
              type="textarea"
              label="Alamat"
              :value="values.alamat"
              :errorname="errors.alamat ? 'failed' : ''"
              @input="(v) => (values.alamat = v)"
              :hints="
                errors.alamat || 'Dapat diisi manual atau dari Map Picker'
              "
              :required="!isGeneralReadonly"
              :disabled="loading || isGeneralReadonly"
              :readonly="isGeneralReadonly"
              placeholder="Alamat lengkap"
              :rows="3"
              class="w-full md:col-span-2"
            />

            <div class="w-full md:col-span-2">
              <div class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
                <MapPicker
                  :latitude="values.lat"
                  :longitude="values.long"
                  :address="values.alamat"
                  :disabled="loading"
                  :readonly="isGeneralReadonly"
                  button-text="Pilih Lokasi di Peta"
                  button-variant="outline"
                  @update:latitude="(v: string) => (values.lat = v)"
                  @update:longitude="(v: string) => (values.long = v)"
                  @update:address="(v: string) => (values.alamat = v)"
                />

                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FieldX
                    id="lat"
                    label="Latitude"
                    :value="values.lat"
                    :required="false"
                    :disabled="true"
                    :readonly="true"
                    placeholder="Akan diisi dari Map Picker"
                    class="w-full"
                    hints="Otomatis dari Map Picker"
                  />
                  <FieldX
                    id="long"
                    label="Longitude"
                    :value="values.long"
                    :required="false"
                    :disabled="true"
                    :readonly="true"
                    placeholder="Akan diisi dari Map Picker"
                    class="w-full"
                    hints="Otomatis dari Map Picker"
                  />
                  <FieldMultiUpload
                    id="m_customer_image"
                    label="Lampiran Foto"
                    :value="values.m_customer_images"
                    @input="(v) => (values.m_customer_images = v)"
                    :errorname="errors.m_customer_images ? 'failed' : ''"
                    :hints="
                      errors.m_customer_images || '.jpg, .png, max 5MB per gambar'
                    "
                    :required="true"
                    :disabled="loading || isGeneralReadonly"
                    :readonly="isGeneralReadonly"
                    accept="image/*"
                    :maxImages="3"
                    class="w-full sm:col-span-2"
                  />
                </div>
              </div>
            </div>
            <!-- ─── SECTION DIVIDER: Kontak Customer ─── -->
            <div class="md:col-span-2">
              <hr class="mb-4" />
              <h3 class="text-base font-semibold text-foreground">
                Kontak Customer
              </h3>
            </div>

            <!-- Kolom Kiri: No Telp Kantor + Email + CP1 + CP2 (stacked) -->
            <div class="flex flex-col gap-4 sm:flex-row">
              <FieldX
                id="no_telp_office"
                label="No Telepon Kantor"
                type="decimal"
                :value="values.no_telp_office"
                @input="(v) => (values.no_telp_office = v)"
                :required="false"
                :disabled="loading || isGeneralReadonly"
                :readonly="isGeneralReadonly"
                placeholder="Contoh: 021-1234567"
                class="w-full"
              />
              <FieldX
                id="email"
                label="Email"
                type="email"
                :value="values.email"
                @input="(v) => (values.email = v)"
                :required="false"
                :disabled="loading || isGeneralReadonly"
                :readonly="isGeneralReadonly"
                placeholder="email@example.com"
                class="w-full"
              />
            </div>
            <div class="flex flex-col gap-4 sm:flex-row">
              <FieldX
                id="cp_1"
                label="Contact Person 1"
                :value="values.cp_1"
                :errorname="errors.cp_1 ? 'failed' : ''"
                @input="(v) => (values.cp_1 = v)"
                :hints="errors.cp_1"
                :required="!isGeneralReadonly"
                :disabled="loading || isGeneralReadonly"
                :readonly="isGeneralReadonly"
                placeholder="Nama kontak utama"
                class="w-full"
              />
              <FieldX
                id="cp_2"
                label="Contact Person 2"
                :value="values.cp_2"
                @input="(v) => (values.cp_2 = v)"
                :required="false"
                :disabled="loading || isGeneralReadonly"
                :readonly="isGeneralReadonly"
                placeholder="Nama kontak alternatif"
                class="w-full"
              />
            </div>

            <!-- Kolom Kanan: Fax + Website + No CP1 + No CP2 (stacked) -->
            <div class="flex flex-col gap-4 sm:flex-row">
              <FieldX
                id="fax"
                label="Fax"
                type="decimal"
                :value="values.fax"
                @input="(v) => (values.fax = v)"
                :required="false"
                :disabled="loading || isGeneralReadonly"
                :readonly="isGeneralReadonly"
                placeholder="Contoh: 021-7654321"
                class="w-full"
              />
              <FieldX
                id="website"
                label="Website"
                :value="values.website"
                @input="(v) => (values.website = v)"
                :required="false"
                :disabled="loading || isGeneralReadonly"
                :readonly="isGeneralReadonly"
                placeholder="https://www.example.com"
                class="w-full"
              />
            </div>
            <div class="flex flex-col gap-4 sm:flex-row">
              <FieldX
                id="no_cp_1"
                label="No Telp CP 1"
                type="decimal"
                :value="values.no_cp_1"
                :errorname="errors.no_cp_1 ? 'failed' : ''"
                @input="(v) => (values.no_cp_1 = v)"
                :hints="errors.no_cp_1"
                :required="!isGeneralReadonly"
                :disabled="loading || isGeneralReadonly"
                :readonly="isGeneralReadonly"
                placeholder="Contoh: 0812-3456-7890"
                class="w-full"
              />
              <FieldX
                id="no_cp_2"
                label="No Telp CP 2"
                type="decimal"
                :value="values.no_cp_2"
                @input="(v) => (values.no_cp_2 = v)"
                :required="false"
                :disabled="loading || isGeneralReadonly"
                :readonly="isGeneralReadonly"
                placeholder="Contoh: 0812-9876-5432"
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
          <TabsTrigger value="detail1">Alamat Pengiriman</TabsTrigger>
          <TabsTrigger value="detail2">Rekening</TabsTrigger>
          <TabsTrigger value="detail3">NPWP/KTP</TabsTrigger>
          <TabsTrigger value="detail4">Kontak</TabsTrigger>
          <TabsTrigger value="detail5">Ekspedisi</TabsTrigger>
        </TabsList>

        <!-- DETAIL TAB CONTENTS - DYNAMIC GENERATION -->

        <!-- TAB CONTENT: DETAIL 2 (m_customer_d_alamat) -->
        <TabsContent value="detail1" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Alamat</CardTitle>
                  <CardDescription
                    >Kelola alamat customer (kantor, cabang, gudang,
                    dll)</CardDescription
                  >
                </div>
                <Button
                  v-if="!isGeneralReadonly"
                  @click="addDetailArr2"
                  size="sm"
                  variant="outline"
                >
                  + Tambah Alamat
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div class="space-y-3">
                <div
                  v-if="detailArr2.length === 0"
                  class="text-center py-8 text-muted-foreground"
                >
                  Belum ada alamat ditambahkan
                </div>

                <!-- Loop through alamat items dengan Collapsible -->
                <div v-for="(detail, index) in detailArr2" :key="index">
                  <Collapsible
                    :open="expandedAlamats.has(index)"
                    @update:open="toggleAlamat(index)"
                  >
                    <Card
                      class="border-2"
                      :class="{ 'border-primary': detail.is_default }"
                    >
                      <!-- Collapsible Trigger Header -->
                      <CollapsibleTrigger class="w-full">
                        <CardHeader
                          class="py-4 cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <div class="flex items-center justify-between gap-4">
                            <div class="flex items-center gap-3 flex-1 min-w-0">
                              <ChevronRight
                                v-if="!expandedAlamats.has(index)"
                                class="h-5 w-5 text-muted-foreground flex-shrink-0"
                              />
                              <ChevronDown
                                v-else
                                class="h-5 w-5 text-muted-foreground flex-shrink-0"
                              />
                              <div class="flex items-center gap-2 flex-wrap">
                                <div class="text-sm font-semibold">
                                  {{ detail.nama || `Alamat #${index + 1}` }}
                                </div>
                                <div
                                  v-if="detail.is_default"
                                  class="px-2 py-1 bg-primary text-primary-foreground text-xs rounded-full"
                                >
                                  Default
                                </div>
                              </div>
                              <span
                                v-if="detail.kota"
                                class="text-xs text-muted-foreground"
                                >• {{ detail.kota }}</span
                              >
                            </div>
                            <Button
                              v-if="!isGeneralReadonly"
                              variant="ghost"
                              size="icon"
                              @click.stop="removeDetailArr2(index)"
                              class="h-8 w-8 flex-shrink-0"
                            >
                              <Trash2 class="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>

                      <!-- Collapsible Content -->
                      <CollapsibleContent>
                        <CardContent class="space-y-4 pt-3 border-t">
                          <!-- Grid 2 Columns -->
                          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FieldSelect
                              :id="`alamat_delivery_area_${index}`"
                              label="Delivery Area"
                              :value="detail.delivery_area"
                              @input="(v: string) => (detail.delivery_area = v)"
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
                                  filter_column_group: 'DELIVERY AREA',
                                  filter_column_is_active: 'true',
                                },
                              }"
                              placeholder="Pilih Delivery Area"
                              :disabled="loading || isGeneralReadonly"
                              :clearable="true"
                              class="w-full"
                            />
                            <!-- Nama Alamat -->
                            <FieldX
                              :id="`alamat_nama_${index}`"
                              label="Nama Alamat"
                              :value="detail.nama"
                              @input="(v) => (detail.nama = v)"
                              :disabled="loading || isGeneralReadonly"
                              :readonly="isGeneralReadonly"
                              placeholder="Contoh: Kantor Pusat, Cabang Jakarta, Gudang Surabaya"
                              class="w-full"
                            />

                            <!-- Provinsi -->
                            <FieldSelect
                              :id="`alamat_provinsi_${index}`"
                              label="Provinsi"
                              :value="detail.provinsi"
                              @input="
                                (v: any) => {
                                  detail.provinsi = v;
                                  detail.kota = '';
                                  detail.kecamatan = '';
                                }
                              "
                              @update:valueFull="
                                (objVal: any) => {
                                  if (!objVal) {
                                    detail.kota = '';
                                    detail.kecamatan = '';
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
                                disabled: loading || isGeneralReadonly,
                                clearable: true,
                              }"
                              placeholder="Pilih Provinsi"
                              class="w-full"
                            />

                            <!-- Kota -->
                            <FieldSelect
                              :id="`alamat_kota_${index}`"
                              label="Kota"
                              :value="detail.kota"
                              @input="
                                (v: any) => {
                                  detail.kota = v;
                                  detail.kecamatan = '';
                                }
                              "
                              @update:valueFull="
                                (objVal: any) => {
                                  if (!objVal) detail.kecamatan = '';
                                }
                              "
                              :api="
                                {
                                  url: 'https://backend.qqltech.com/kodepos/region/kabupaten-kota',
                                  params: {
                                    provinsi: detail.provinsi,
                                    search: '',
                                    searchfield: 'name',
                                    selectfield: 'name,id',
                                    paginate: 35,
                                  },
                                  fullUrl: true,
                                } as any
                              "
                              :bind="{
                                disabled:
                                  !detail.provinsi ||
                                  loading ||
                                  isGeneralReadonly,
                                clearable: true,
                              }"
                              placeholder="Pilih Kota"
                              class="w-full"
                            />

                            <!-- Kecamatan -->
                            <FieldSelect
                              :id="`alamat_kecamatan_${index}`"
                              label="Kecamatan"
                              :value="detail.kecamatan"
                              @input="(v: any) => (detail.kecamatan = v)"
                              :api="
                                {
                                  url: 'https://backend.qqltech.com/kodepos/region/kecamatan',
                                  params: { kota: detail.kota },
                                  fullUrl: true,
                                } as any
                              "
                              valueField="key"
                              displayField="key"
                              :bind="{
                                disabled:
                                  !detail.kota || loading || isGeneralReadonly,
                                clearable: true,
                              }"
                              placeholder="Pilih Kecamatan"
                              class="w-full"
                            />

                            <!-- Kode Pos -->
                            <FieldSelect
                              :id="`alamat_kode_pos_${index}`"
                              label="Kode Pos"
                              :value="detail.kode_pos"
                              @input="(v: any) => (detail.kode_pos = v)"
                              :api="
                                {
                                  url: 'https://backend.qqltech.com/kodepos/region/kelurahan',
                                  params: {
                                    kota: detail.kota,
                                    kecamatan: detail.kecamatan || '',
                                  },
                                  fullUrl: true,
                                } as any
                              "
                              valueField="kodepos"
                              displayField="kodepos"
                              :bind="{
                                disabled:
                                  !detail.kecamatan ||
                                  loading ||
                                  isGeneralReadonly,
                                clearable: true,
                              }"
                              placeholder="Pilih Kode Pos"
                              class="w-full"
                            />

                            <!-- Telepon -->
                            <FieldX
                              :id="`alamat_telepon_${index}`"
                              label="Telepon"
                              type="decimal"
                              :value="detail.telepon"
                              @input="(v) => (detail.telepon = v)"
                              :disabled="loading || isGeneralReadonly"
                              :readonly="isGeneralReadonly"
                              placeholder="021-1234567"
                              class="w-full"
                            />

                            <!-- Fax -->
                            <FieldX
                              :id="`alamat_fax_${index}`"
                              label="Fax"
                              type="decimal"
                              :value="detail.fax"
                              @input="(v) => (detail.fax = v)"
                              :disabled="loading || isGeneralReadonly"
                              :readonly="isGeneralReadonly"
                              placeholder="021-7654321"
                              class="w-full"
                            />

                            <!-- Email -->
                            <FieldX
                              :id="`alamat_email_${index}`"
                              label="Email"
                              type="email"
                              :value="detail.email"
                              @input="(v) => (detail.email = v)"
                              :disabled="loading || isGeneralReadonly"
                              :readonly="isGeneralReadonly"
                              placeholder="cabang@example.com"
                              class="w-full"
                            />
                          </div>

                          <!-- Alamat Lengkap (Full Width) -->
                          <FieldX
                            :id="`alamat_alamat_${index}`"
                            type="textarea"
                            label="Alamat Lengkap"
                            :value="detail.alamat"
                            @input="(v) => (detail.alamat = v)"
                            :disabled="loading || isGeneralReadonly"
                            :readonly="isGeneralReadonly"
                            placeholder="Jalan, nomor, RT/RW, kelurahan, dan detail lainnya"
                            :rows="2"
                            class="w-full"
                          />

                          <!-- Catatan (Full Width) -->
                          <FieldX
                            :id="`alamat_catatan_${index}`"
                            type="textarea"
                            label="Catatan"
                            :value="detail.catatan"
                            @input="(v) => (detail.catatan = v)"
                            :disabled="loading || isGeneralReadonly"
                            :readonly="isGeneralReadonly"
                            placeholder="Catatan tambahan untuk alamat ini"
                            :rows="2"
                            class="w-full"
                          />

                          <!-- Checkboxes: is_default & is_active -->
                          <div class="flex items-center gap-6">
                            <label
                              class="flex items-center gap-2 cursor-pointer"
                            >
                              <input
                                v-if="!isGeneralReadonly"
                                type="checkbox"
                                :checked="detail.is_default"
                                @click.prevent="toggleDefaultAlamat(index)"
                                class="rounded cursor-pointer"
                              />
                              <input
                                v-else
                                type="checkbox"
                                :checked="detail.is_default"
                                disabled
                                class="rounded"
                              />
                              <span class="text-sm font-medium"
                                >Alamat Default</span
                              >
                            </label>

                            <label
                              class="flex items-center gap-2 cursor-pointer"
                            >
                              <input
                                v-if="!isGeneralReadonly"
                                v-model="detail.is_active"
                                type="checkbox"
                                class="rounded cursor-pointer"
                              />
                              <input
                                v-else
                                type="checkbox"
                                :checked="detail.is_active"
                                disabled
                                class="rounded"
                              />
                              <span class="text-sm font-medium">Aktif</span>
                            </label>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- TAB CONTENT: DETAIL 3 (m_customer_d_rekening) -->
        <TabsContent value="detail2" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Rekening Bank</CardTitle>
                  <CardDescription
                    >Kelola rekening bank customer</CardDescription
                  >
                </div>
                <Button
                  v-if="!isGeneralReadonly"
                  @click="addDetailArr3"
                  size="sm"
                  variant="outline"
                >
                  + Tambah Rekening
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div class="space-y-3">
                <div
                  v-if="detailArr3.length === 0"
                  class="text-center py-8 text-muted-foreground"
                >
                  Belum ada rekening ditambahkan
                </div>

                <!-- Loop through rekening items dengan Collapsible -->
                <div v-for="(detail, index) in detailArr3" :key="index">
                  <Collapsible
                    :open="expandedRekenings.has(index)"
                    @update:open="toggleRekening(index)"
                  >
                    <Card
                      class="border-2"
                      :class="{ 'border-primary': detail.is_default }"
                    >
                      <!-- Collapsible Trigger Header -->
                      <CollapsibleTrigger class="w-full">
                        <CardHeader
                          class="py-4 cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                          <div class="flex items-center justify-between gap-4">
                            <div class="flex items-center gap-3 flex-1 min-w-0">
                              <ChevronRight
                                v-if="!expandedRekenings.has(index)"
                                class="h-5 w-5 text-muted-foreground flex-shrink-0"
                              />
                              <ChevronDown
                                v-else
                                class="h-5 w-5 text-muted-foreground flex-shrink-0"
                              />
                              <div class="flex items-center gap-2 flex-wrap">
                                <div class="text-sm font-semibold">
                                  {{
                                    detail.nama_bank || `Rekening #${index + 1}`
                                  }}
                                </div>
                                <div
                                  v-if="detail.is_default"
                                  class="px-2 py-1 bg-primary text-primary-foreground text-xs rounded-full"
                                >
                                  Default
                                </div>
                              </div>
                              <span
                                v-if="detail.nomor_rekening"
                                class="text-xs text-muted-foreground"
                                >• {{ detail.nomor_rekening }}</span
                              >
                            </div>
                            <Button
                              v-if="!isGeneralReadonly"
                              variant="ghost"
                              size="icon"
                              @click.stop="removeDetailArr3(index)"
                              class="h-8 w-8 flex-shrink-0"
                            >
                              <Trash2 class="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>

                      <!-- Collapsible Content -->
                      <CollapsibleContent>
                        <CardContent class="space-y-4 pt-5 border-t">
                          <!-- Grid 2 Columns -->
                          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <!-- Nama Bank -->
                            <FieldX
                              :id="`rek_nama_bank_${index}`"
                              label="Nama Bank"
                              :value="detail.nama_bank"
                              @input="(v) => (detail.nama_bank = v)"
                              :disabled="loading || isGeneralReadonly"
                              :readonly="isGeneralReadonly"
                              placeholder="Contoh: BCA, Mandiri, BNI"
                              class="w-full"
                            />

                            <!-- Nomor Rekening -->
                            <FieldX
                              :id="`rek_nomor_${index}`"
                              label="Nomor Rekening"
                              type="decimal"
                              :value="detail.nomor_rekening"
                              @input="(v) => (detail.nomor_rekening = v)"
                              :disabled="loading || isGeneralReadonly"
                              :readonly="isGeneralReadonly"
                              placeholder="1234567890"
                              class="w-full"
                            />

                            <!-- Nama Rekening -->
                            <div class="md:col-span-2">
                              <FieldX
                                :id="`rek_nama_rekening_${index}`"
                                label="Nama Rekening"
                                :value="detail.nama_rekening"
                                @input="(v) => (detail.nama_rekening = v)"
                                :disabled="loading || isGeneralReadonly"
                                :readonly="isGeneralReadonly"
                                placeholder="Nama pemilik rekening sesuai buku tabungan"
                                class="w-full"
                              />
                            </div>
                          </div>

                          <!-- Catatan (Full Width) -->
                          <FieldX
                            :id="`rek_catatan_${index}`"
                            type="textarea"
                            label="Catatan"
                            :value="detail.catatan"
                            @input="(v) => (detail.catatan = v)"
                            :disabled="loading || isGeneralReadonly"
                            :readonly="isGeneralReadonly"
                            placeholder="Catatan tambahan untuk rekening ini"
                            :rows="2"
                            class="w-full"
                          />

                          <!-- Checkboxes: is_default & is_active -->
                          <div class="flex items-center gap-6">
                            <label
                              class="flex items-center gap-2 cursor-pointer"
                            >
                              <input
                                v-if="!isGeneralReadonly"
                                type="checkbox"
                                :checked="detail.is_default"
                                @click.prevent="toggleDefaultRekening(index)"
                                class="rounded cursor-pointer"
                              />
                              <input
                                v-else
                                type="checkbox"
                                :checked="detail.is_default"
                                disabled
                                class="rounded"
                              />
                              <span class="text-sm font-medium"
                                >Rekening Default</span
                              >
                            </label>

                            <label
                              class="flex items-center gap-2 cursor-pointer"
                            >
                              <input
                                v-if="!isGeneralReadonly"
                                v-model="detail.is_active"
                                type="checkbox"
                                class="rounded cursor-pointer"
                              />
                              <input
                                v-else
                                type="checkbox"
                                :checked="detail.is_active"
                                disabled
                                class="rounded"
                              />
                              <span class="text-sm font-medium">Aktif</span>
                            </label>
                          </div>
                        </CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- TAB CONTENT: DETAIL 1 (m_customer_d_npwp) -->
        <TabsContent value="detail3" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail NPWP/Identitas</CardTitle>
                  <CardDescription
                    >Kelola data NPWP dan identitas lainnya</CardDescription
                  >
                </div>
                <Button
                  v-if="!isGeneralReadonly"
                  @click="addDetailArr"
                  size="sm"
                  variant="outline"
                >
                  + Tambah
                </Button>
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
                        Tipe Identitas
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Nomor
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Nama
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Alamat
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Catatan
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        File/Dokumen
                      </th>
                      <th
                        class="px-2 py-2 text-center font-medium text-xs sm:text-sm"
                      >
                        Aktif
                      </th>
                      <th
                        v-if="!isGeneralReadonly"
                        class="px-2 py-2 text-center font-medium text-xs sm:text-sm"
                      >
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr.length === 0">
                      <td
                        colspan="8"
                        class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                      >
                        Belum ada detail ditambahkan
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, index) in detailArr"
                      :key="index"
                      class="border-t hover:bg-muted/50"
                    >
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ index + 1 }}
                      </td>

                      <!-- Tipe Identitas (FieldSelect from m_general TIPE_IDENTITAS) -->
                      <td class="px-3 py-2 text-xs sm:text-sm min-w-[200px]">
                        <FieldSelect
                          v-if="!isGeneralReadonly"
                          :id="`detail_tipe_id_${index}`"
                          :value="detail.tipe_id"
                          @input="(v: string) => (detail.tipe_id = v)"
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
                              filter_column_group: 'TIPE IDENTITAS',
                              filter_column_is_active: 'true',
                            },
                          }"
                          placeholder="Pilih tipe"
                          :clearable="true"
                          class="w-full"
                        />
                        <span v-else class="text-xs">{{ detail.tipe_id }}</span>
                      </td>

                      <!-- Nomor -->
                      <td class="px-3 py-2 text-xs sm:text-sm min-w-[180px]">
                        <FieldX
                          v-if="!isGeneralReadonly"
                          :id="`detail_nomor_${index}`"
                          type="decimal"
                          :value="detail.nomor"
                          @input="(v) => (detail.nomor = v)"
                          placeholder="Nomor"
                          class="w-full [&_input]:text-xs [&_input]:sm:text-sm [&_input]:px-2 [&_input]:py-1"
                        />
                        <span v-else>{{ detail.nomor }}</span>
                      </td>

                      <!-- Nama -->
                      <td class="px-3 py-2 text-xs sm:text-sm min-w-[200px]">
                        <input
                          v-if="!isGeneralReadonly"
                          v-model="detail.nama"
                          type="text"
                          class="w-full px-2 py-1 border rounded text-xs sm:text-sm"
                          placeholder="Nama"
                        />
                        <span v-else>{{ detail.nama }}</span>
                      </td>

                      <!-- Alamat -->
                      <td class="px-3 py-2 text-xs sm:text-sm min-w-[250px]">
                        <input
                          v-if="!isGeneralReadonly"
                          v-model="detail.alamat"
                          type="text"
                          class="w-full px-2 py-1 border rounded text-xs sm:text-sm"
                          placeholder="Alamat"
                        />
                        <span v-else>{{ detail.alamat }}</span>
                      </td>

                      <!-- Catatan -->
                      <td class="px-3 py-2 text-xs sm:text-sm min-w-[200px]">
                        <input
                          v-if="!isGeneralReadonly"
                          v-model="detail.catatan"
                          type="text"
                          class="w-full px-2 py-1 border rounded text-xs sm:text-sm"
                          placeholder="Catatan"
                        />
                        <span v-else>{{ detail.catatan }}</span>
                      </td>

                      <!-- File/Dokumen -->
                      <td class="px-3 py-2 text-xs sm:text-sm min-w-[200px]">
                        <FieldUpload
                          :id="`detail_file_${index}`"
                          label=""
                          :value="detail.foto"
                          @update:value="(v: string) => (detail.foto = v)"
                          :disabled="loading || isGeneralReadonly"
                          :readonly="isGeneralReadonly"
                          accept=".jpg,.jpeg,.png"
                          class="w-full"
                        />
                      </td>

                      <!-- Is Active -->
                      <td class="px-2 py-2 text-center">
                        <input
                          v-if="!isGeneralReadonly"
                          v-model="detail.is_active"
                          type="checkbox"
                          class="rounded cursor-pointer"
                        />
                        <span v-else>{{ detail.is_active ? "✓" : "-" }}</span>
                      </td>

                      <!-- Action Button -->
                      <td
                        v-if="!isGeneralReadonly"
                        class="px-2 py-2 text-center"
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          @click="removeDetailArr(index)"
                          class="h-7 w-7 sm:h-8 sm:w-8"
                        >
                          <Trash2
                            class="h-3 w-3 sm:h-4 sm:w-4 text-destructive"
                          />
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- TAB CONTENT: DETAIL 4 (m_customer_d_media_sosial) -->
        <TabsContent value="detail4" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Kontak</CardTitle>
                  <CardDescription
                    >Kelola detail Kontak customer</CardDescription
                  >
                </div>
                <Button
                  v-if="!isGeneralReadonly"
                  @click="addDetailArr4"
                  size="sm"
                  variant="outline"
                >
                  + Tambah Kontak
                </Button>
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
                        Jabatan
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Nama
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Ulang Tahun
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        No. Telepon
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Email
                      </th>
                      <th
                        class="px-2 py-2 text-center font-medium text-xs sm:text-sm"
                      >
                        Default
                      </th>
                      <!-- <th class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Aktif</th> -->
                      <th
                        v-if="!isGeneralReadonly"
                        class="px-2 py-2 text-center font-medium text-xs sm:text-sm"
                      >
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr4.length === 0">
                      <td
                        colspan="7"
                        class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                      >
                        Belum ada Kontak ditambahkan
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, index) in detailArr4"
                      :key="index"
                      class="border-t hover:bg-muted/50"
                    >
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ index + 1 }}
                      </td>

                      <!-- Media Sosial / Platform -->
                      <td class="px-3 py-2 text-xs sm:text-sm min-w-[150px]">
                        <input
                          v-if="!isGeneralReadonly"
                          v-model="detail.jabatan"
                          type="text"
                          class="w-full px-2 py-1 border rounded text-xs sm:text-sm"
                          placeholder="Masukan jabatan"
                        />
                        <span v-else>{{ detail.jabatan }}</span>
                      </td>

                      <!-- Nama Akun -->
                      <td class="px-3 py-2 text-xs sm:text-sm min-w-[180px]">
                        <input
                          v-if="!isGeneralReadonly"
                          v-model="detail.nama"
                          type="text"
                          class="w-full px-2 py-1 border rounded text-xs sm:text-sm"
                          placeholder="masukan nama kontak"
                        />
                        <span v-else>{{ detail.nama }}</span>
                      </td>

                      <!-- URL -->
                      <td class="px-3 py-2 text-xs sm:text-sm min-w-[250px]">
                        <input
                          v-if="!isGeneralReadonly"
                          v-model="detail.tgl_lahir"
                          type="date"
                          class="w-full px-2 py-1 border rounded text-xs sm:text-sm"
                          placeholder="28/08/2004"
                        />
                        <span v-else>{{ detail.tgl_lahir }}</span>
                      </td>

                      <!-- No. Telepon -->
                      <td class="px-3 py-2 text-xs sm:text-sm min-w-[250px]">
                        <input
                          v-if="!isGeneralReadonly"
                          v-model="detail.nomor"
                          class="w-full px-2 py-1 border rounded text-xs sm:text-sm"
                          placeholder="masukan no. telepon"
                        />
                        <span v-else>{{ detail.nomor }}</span>
                      </td>

                      <!-- Email -->
                      <td class="px-3 py-2 text-xs sm:text-sm min-w-[250px]">
                        <input
                          v-if="!isGeneralReadonly"
                          v-model="detail.email"
                          class="w-full px-2 py-1 border rounded text-xs sm:text-sm"
                          placeholder="admin@admin.com"
                        />
                        <span v-else>{{ detail.email }}</span>
                      </td>

                      <!-- Is Default -->
                      <td class="px-2 py-2 text-center">
                        <label
                          class="flex items-center justify-center cursor-pointer"
                        >
                          <input
                            v-if="!isGeneralReadonly"
                            type="checkbox"
                            :checked="detail.is_default"
                            @click.prevent="toggleDefaultKontak(index)"
                            class="rounded cursor-pointer"
                          />
                          <input
                            v-else
                            type="checkbox"
                            :checked="detail.is_default"
                            disabled
                            class="rounded"
                          />
                        </label>
                      </td>

                      <!-- Action Button -->
                      <td
                        v-if="!isGeneralReadonly"
                        class="px-2 py-2 text-center"
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          @click="removeDetailArr4(index)"
                          class="h-7 w-7 sm:h-8 sm:w-8"
                        >
                          <Trash2
                            class="h-3 w-3 sm:h-4 sm:w-4 text-destructive"
                          />
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- TAB CONTENT: DETAIL 5 (m_customer_d_ekspedisi) -->
        <TabsContent value="detail5" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Ekspedisi</CardTitle>
                  <CardDescription>Kelola ekspedisi customer</CardDescription>
                </div>
                <Button
                  v-if="!isGeneralReadonly"
                  @click="addDetailArr5"
                  size="sm"
                  variant="outline"
                >
                  + Tambah Ekspedisi
                </Button>
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
                        Nama Ekspedisi
                      </th>
                      <th
                        class="px-2 py-2 text-center font-medium text-xs sm:text-sm"
                      >
                        Default
                      </th>
                      <th
                        v-if="!isGeneralReadonly"
                        class="px-2 py-2 text-center font-medium text-xs sm:text-sm"
                      >
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr5.length === 0">
                      <td
                        colspan="4"
                        class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                      >
                        Belum ada ekspedisi ditambahkan
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, index) in detailArr5"
                      :key="index"
                      class="border-t hover:bg-muted/50"
                      :class="{ 'bg-primary/5': detail.is_default }"
                    >
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ index + 1 }}
                      </td>

                      <!-- Nama Ekspedisi -->
                      <td class="px-3 py-2 text-xs sm:text-sm min-w-[250px]">
                        <FieldSelect
                          v-if="!isGeneralReadonly"
                          :id="`ekspedisi_id_${index}`"
                          :value="detail.m_ekspedisi_id"
                          @input="(v: string) => (detail.m_ekspedisi_id = v)"
                          @update:valueFull="
                            (item: any) => {
                              detail.m_ekspedisi_id = item?.id || '';
                              detail.nama_ekspedisi = item?.nama || '';
                            }
                          "
                          displayField="nama"
                          valueField="id"
                          :api="{
                            url: `${API_BASE_URL}/dynamic/m_ekspedisi`,
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
                          placeholder="Pilih ekspedisi"
                          :clearable="true"
                          class="w-full"
                        />
                        <span v-else>{{
                          detail.nama_ekspedisi ||
                          detail.m_ekspedisi?.nama ||
                          "-"
                        }}</span>
                      </td>

                      <!-- Is Default -->
                      <td class="px-2 py-2 text-center">
                        <div class="flex items-center justify-center gap-1">
                          <input
                            v-if="!isGeneralReadonly"
                            type="checkbox"
                            :checked="detail.is_default"
                            @click.prevent="toggleDefaultEkspedisi(index)"
                            class="rounded cursor-pointer"
                          />
                          <input
                            v-else
                            type="checkbox"
                            :checked="detail.is_default"
                            disabled
                            class="rounded"
                          />
                          <span
                            v-if="detail.is_default"
                            class="px-1.5 py-0.5 bg-primary text-primary-foreground text-xs rounded-full"
                            >Default</span
                          >
                        </div>
                      </td>

                      <!-- Action Button -->
                      <td
                        v-if="!isGeneralReadonly"
                        class="px-2 py-2 text-center"
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          @click="removeDetailArr5(index)"
                          class="h-7 w-7 sm:h-8 sm:w-8"
                        >
                          <Trash2
                            class="h-3 w-3 sm:h-4 sm:w-4 text-destructive"
                          />
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
        <Button v-if="!canUseCustomerUpdateFlow || isCustomerUpdateActive" type="button" @click="onSave"
          :disabled="loading || (canUseCustomerUpdateFlow && !isCustomerUpdateActive)" class="gap-2 w-full sm:w-auto">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          {{
            isOtherDataUpdateActive
              ? "Simpan Perubahan"
              : isCustomerUpdateActive
                ? "Send for Approval"
                : isEditMode
                  ? "Perbarui"
                  : "Simpan"
          }}
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
