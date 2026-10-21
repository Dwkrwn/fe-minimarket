<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, onMounted, computed } from "vue";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  FieldX,
  FieldStatus,
  FieldMultiSelect,
  FieldNumber,
  FieldSelect,
} from "@/components/field";
import {
  ArrowLeft,
  History,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createCustomerGroup,
  updateCustomerGroup,
  getCustomerGroupById,
} from "./service";
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
const expandedDetails = ref<Record<string, boolean>>({});
const company = ref<Record<string, any> | null>(null);
const isEditMode = computed(
  () => !!route.params.id && route.name === "CustomerGroupForm",
);
const isViewMode = computed(() => route.name === "CustomerGroupView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Customer Group";
  if (isCopyMode.value) return "Salin Customer Group";
  if (isEditMode.value) return "Edit Customer Group";
  return "Tambah Customer Group Baru";
});

// Check if current user is Super Admin
const isSuperAdmin = computed(() => {
  const user = authStore.user;
  if (!user || !user.tipe) return false;
  return user.tipe.value1?.toUpperCase() === "SUPER ADMIN";
});

type AllowedUnitBisnisOption = {
  id: string;
  nama_comp: string;
  m_company_id: string;
  m_company: {
    id: string;
    nama: string;
  } | null;
};

type CompanyOption = {
  id: string;
  nama: string;
};

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Customer Group";
  if (isCopyMode.value)
    return "Buat Customer Group baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Customer Group";
  return "Buat Customer Group baru";
});

// Form values - SAMA SEPERTI Form.txt
let values = reactive({
  kode: "",
  nama: "",
  catatan: "",
  company_id: "",
  m_customer_group_ubs: [] as Array<Record<string, any>>,
  m_unit_bisnis_list: [] as Array<Record<string, any>>,
  kredit_limit_total: 0,
  kredit_limit_sisa: 0,
  kredit_limit_terpakai: 0,
  is_active: true,
});

// Computed for Unit Bisnis MultiSelect (Array of IDs <-> Array of Objects)
const unit_bisnis_ids_computed = computed({
  get: () =>
    (values.m_customer_group_ubs || [])
      .map(
        (item: any) =>
          item.m_unit_bisnis_id ||
          item.unit_bisnis_id ||
          item.m_unit_bisnis?.id ||
          item.m_unit_bisni?.id,
      )
      .filter((id: any) => !!id) as string[],
  set: (newIds: string[]) => {
    const oldIds = (values.m_customer_group_ubs || [])
      .map((item: any) => item.m_unit_bisnis_id || item.unit_bisnis_id)
      .filter((id: any) => !!id);

    const sanitizedNewIds = !isSuperAdmin.value
      ? newIds.filter((id: string) => {
          return allowedUnitBisnisIdSet.value?.has(id) || oldIds.includes(id);
        })
      : newIds;

    const removedIds = oldIds.filter(
      (id: string) => !sanitizedNewIds.includes(id),
    );
    const addedIds = sanitizedNewIds.filter(
      (id: string) => !oldIds.includes(id),
    );

    // Update m_customer_group_ubs
    values.m_customer_group_ubs = sanitizedNewIds.map((id) => ({
      m_unit_bisnis_id: id,
    }));

    // Hapus dari detailArr
    removedIds.forEach((id: string) => {
      const idx = detailArr.value.findIndex((d) => d.m_unit_bisnis_id === id);
      if (idx !== -1) detailArr.value.splice(idx, 1);
    });

    // Tambah ke detailArr
    addedIds.forEach((id: string) => {
      const nama =
        unitBisnisNameMap.value[id] ||
        getUnitBisnisOptions.value.find((o) => o.id === id)?.nama_comp ||
        "-";
      detailArr.value.push({
        m_unit_bisnis_id: id,
        nama_comp: nama,
        kredit_limit_total: 0,
        kredit_limit_terpakai: 0,
        kredit_limit_sisa: 0,
        customers: [],
      });
    });
  },
});

const getUnitBisnisOptions = computed(() => {
  return (values.m_unit_bisnis_list || []).map((i: any) => ({
    id: i.m_unit_bisnis_id || i.unit_bisnis_id || i.id,
    nama_comp:
      i.m_unit_bisni?.nama_comp ||
      i.m_unit_bisnis?.nama_comp ||
      i.unit_bisnis?.nama_comp ||
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

  return Array.from(ids);
});

const allowedUnitBisnisMetadata = computed<AllowedUnitBisnisOption[]>(() => {
  if (isSuperAdmin.value) return [];

  const options = new Map<string, AllowedUnitBisnisOption>();
  for (const userDetail of authStore.userDetails || []) {
    if (!userDetail?.is_active) continue;
    const respo = userDetail.m_respo;
    if (!respo?.is_active) continue;
    const unitBisnisFromRespo: any = respo.unit_bisnis;
    const companyFromRespo: any = respo.unit_bisnis?.m_company;

    const id = respo.m_unit_bisnis_id?.trim();
    if (!id) continue;

    const nama =
      unitBisnisFromRespo?.nama_comp?.trim() ||
      options.get(id)?.nama_comp ||
      id;
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
          ? {
              id: companyId,
              nama: companyName || companyId,
            }
          : null,
    });
  }

  return Array.from(options.values());
});

const allowedUnitBisnisIdSet = computed<Set<string> | null>(() => {
  if (isSuperAdmin.value) return null;
  return new Set(allowedUnitBisnisIds.value || []);
});

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

const companyOptions = computed<CompanyOption[]>(() => {
  const options = new Map<string, CompanyOption>();

  getUnitBisnisOptions.value.forEach((unitBisnis) => {
    const companyId = unitBisnis.m_company_id?.trim();
    if (!companyId) return;

    options.set(companyId, {
      id: companyId,
      nama:
        unitBisnis.m_company?.nama || options.get(companyId)?.nama || companyId,
    });
  });

  if (company.value?.id && !options.has(company.value.id)) {
    options.set(company.value.id, {
      id: company.value.id,
      nama: company.value.nama || company.value.id,
    });
  }

  return Array.from(options.values());
});

const filteredUnitBisnisOptions = computed(() => {
  const selectedCompanyId = values.company_id?.trim();
  if (!selectedCompanyId) return getUnitBisnisOptions.value;

  const selectedIds = new Set(unit_bisnis_ids_computed.value);
  return getUnitBisnisOptions.value.filter((option) => {
    return (
      option.m_company_id === selectedCompanyId || selectedIds.has(option.id)
    );
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

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {};

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

// Name map for unit bisnis (digunakan untuk lookup nama saat multi-select berubah)
const unitBisnisNameMap = ref<Record<string, string>>({});

// Detail arrays - DYNAMIC GENERATION
const detailArr = ref<any[]>([]);
const hasShownNoUnitBisnisToast = ref(false);

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const formatNumberId = (value: unknown) =>
  toNumber(value).toLocaleString("id-ID");

const formatTanggal = (value: string) => {
  if (!value || value === "-") return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
};

const kreditLimitTotal = computed(() =>
  detailArr.value.reduce(
    (sum, item) => sum + toNumber(item.kredit_limit_total),
    0,
  ),
);

const kreditLimitSisaTotal = computed(
  () => kreditLimitTotal.value - kreditLimitTerpakaiTotal.value,
);

const kreditLimitTerpakaiTotal = computed(() =>
  detailArr.value.reduce((sum, item) => {
    return sum + toNumber(item.kredit_limit_terpakai);
  }, 0),
);

const toggleDetail = (key: string) => {
  expandedDetails.value[key] = !expandedDetails.value[key];
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
    .filter((option) => option.m_company_id === normalizedCompanyId)
    .map((option) => option.id);

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

  if (!isEditMode.value && !isViewMode.value) {
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

const fetchAllowedUnitBisnisOptions = async () => {
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

  values.m_unit_bisnis_list = unitBisnisList.map((ub) => ({
    id: ub.id,
    nama_comp: ub.nama_comp,
    m_company_id: ub.m_company_id,
    m_company: ub.m_company,
  }));

  // Kalau user punya respo (non-superadmin dgn unit bisnis) → auto-select
  // Kalau ga punya respo (superadmin / tanpa unit bisnis) → kosong, manual pilih
  const hasRespoData =
    !isSuperAdmin.value &&
    allowedUnitBisnisIds.value &&
    allowedUnitBisnisIds.value.length > 0;

  if (hasRespoData) {
    syncCompanySelectionFromUnitBisnis(true);

    const defaultCompanyId = values.company_id?.trim();
    const defaultUnitBisnisList = defaultCompanyId
      ? unitBisnisList.filter((ub) => ub.m_company_id === defaultCompanyId)
      : unitBisnisList;

    values.m_customer_group_ubs = defaultUnitBisnisList.map((ub) => ({
      m_unit_bisnis_id: ub.id,
    }));
    detailArr.value = defaultUnitBisnisList.map((ub) => ({
      m_unit_bisnis_id: ub.id,
      nama_comp: ub.nama_comp,
      kredit_limit_total: 0,
      kredit_limit_terpakai: 0,
      kredit_limit_sisa: 0,
      customers: [],
    }));
  } else {
    // User tanpa respo — kosongin, harus pilih manual
    setCompanyFromSelection("");
    values.m_customer_group_ubs = [];
    detailArr.value = [];
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

  mergedOptions.forEach((ub) => {
    unitBisnisNameMap.value[ub.id] = ub.nama_comp;
  });

  syncCompanySelectionFromUnitBisnis();
};

// ============================================================================
// HISTORY DIALOG
// ============================================================================
const historyDialogOpen = ref(false);
const historyLoading = ref(false);
const historyData = ref<any[]>([]);
const selectedCustomerName = ref("");
const selectedCustomerId = ref("");

const historyPagination = reactive({
  total: 0,
  page: 1,
  totalPages: 1,
  limit: 10,
});

const historyPageItems = computed(() => {
  const totalPages = Math.max(historyPagination.totalPages, 1);
  const currentPage = historyPagination.page;
  const pages = new Set<number>([1, totalPages, currentPage]);
  for (let offset = 1; offset <= 1; offset++) {
    if (currentPage - offset > 1) pages.add(currentPage - offset);
    if (currentPage + offset < totalPages) pages.add(currentPage + offset);
  }
  return Array.from(pages)
    .sort((a, b) => a - b)
    .reduce<Array<{ type: "page" | "ellipsis"; value: number }>>(
      (acc, page, index, array) => {
        const previousPage = array[index - 1];
        if (previousPage !== undefined && page - previousPage > 1) {
          acc.push({ type: "ellipsis", value: page });
        }
        acc.push({ type: "page", value: page });
        return acc;
      },
      [],
    );
});

const fetchHistory = async (customerGroupDId: string, page = 1) => {
  if (!customerGroupDId) return;
  historyLoading.value = true;
  try {
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_customer_group_history?filter_column_m_customer_group_d_id=${customerGroupDId}&page=${page}&limit=${historyPagination.limit}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    const result = await response.json();
    if (result.status === "success") {
      historyData.value = result.data || [];
      if (result.pagination) {
        historyPagination.total = result.pagination.total || 0;
        historyPagination.page = result.pagination.page || page;
        historyPagination.totalPages = result.pagination.totalPages || 1;
        historyPagination.limit = result.pagination.limit || 10;
      }
    } else {
      toast.error("Gagal memuat history");
    }
  } catch (error) {
    toast.error("Gagal memuat history", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    historyLoading.value = false;
  }
};

const openHistory = async (cust: any) => {
  selectedCustomerName.value = cust.nama_customer || "-";
  selectedCustomerId.value = cust.id || cust.m_customer_id || "";
  historyPagination.page = 1;
  historyPagination.total = 0;
  historyPagination.totalPages = 1;
  historyDialogOpen.value = true;
  await fetchHistory(selectedCustomerId.value, 1);
};

const handleHistoryPageChange = (page: number) => {
  if (
    page < 1 ||
    page > historyPagination.totalPages ||
    page === historyPagination.page ||
    historyLoading.value
  )
    return;
  fetchHistory(selectedCustomerId.value, page);
};

// ============================================================================
// DETAIL METHODS - DYNAMIC GENERATION
// ============================================================================

const addDetailArr = () => {
  detailArr.value.push({
    name: "",
    value: 0,
    is_active: true,
  });
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
    kode: "",
    nama: "",
    catatan: "",
    company_id: "",
    m_customer_group_ubs: [],
    m_unit_bisnis_list: [],
    kredit_limit_total: 0,
    kredit_limit_sisa: 0,
    kredit_limit_terpakai: 0,
    is_active: true,
  });

  // Reset errors
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });

  // Reset detail arrays - DYNAMIC
  detailArr.value = [];
  company.value = null;
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
    const res = await getCustomerGroupById(sourceId);

    if (res.status !== "success") throw new Error("Gagal memuat data");
    initialValues = res.data;

    auditMeta.value = {
      created_by: initialValues.created_by || initialValues.createdBy || null,
      createdAt: initialValues.createdAt,
      updated_by:
        initialValues.updated_by ||
        initialValues.update_by ||
        initialValues.edited_by ||
        null,
      updatedAt: initialValues.updatedAt,
    };

    // Minimal normalisasi
    if (initialValues.is_active !== undefined) {
      const v = initialValues.is_active;
      initialValues.is_active = v === true || v === 1 || v === "1";
    } else {
      initialValues.is_active = true;
    }

    // Load detail items - DYNAMIC

    if (initialValues.m_customer_group_ubs) {
      detailArr.value = initialValues.m_customer_group_ubs.map((d: any) => {
        return {
          id: d.id ?? d.m_unit_bisnis_id ?? d.unit_bisnis_id,
          m_unit_bisnis_id:
            d.m_unit_bisnis_id || d.unit_bisnis_id || d.m_unit_bisnis?.id,
          nama_comp:
            d.m_unit_bisni?.nama_comp ||
            d.m_unit_bisnis?.nama_comp ||
            d.unit_bisnis?.nama_comp ||
            d.nama_comp ||
            "-",
          kredit_limit_total: toNumber(d.kredit_limit_total),
          kredit_limit_sisa: toNumber(d.kredit_limit_sisa),
          kredit_limit_terpakai: toNumber(d.kredit_limit_terpakai),
          is_active: d.is_active ?? true,
          customers: (d.customer_g_details || []).map((c: any) => ({
            id: c.id ?? c.m_customer_id,
            m_customer_id: c.m_customer_id ?? c.m_customer?.id,
            kode_customer:
              c.m_customer?.kode_customer ||
              c.m_customer?.kode_custome ||
              c.kode_customer ||
              c.kode_custome ||
              "-",
            nama_customer:
              c.m_customer?.nama_customer ||
              c.m_customer?.nama_custome ||
              c.nama_customer ||
              c.nama_custome ||
              "-",
            kredit_limit: toNumber(c.kredit_limit),
            kredit_limit_sisa: toNumber(c.kredit_limit_sisa),
            kredit_limit_terpakai: toNumber(c.kredit_limit_terpakai),
          })),
        };
      });

      // Populate name map dari data yang sudah dimuat
      if (initialValues.m_customer_group_ubs) {
        initialValues.m_customer_group_ubs.forEach((d: any) => {
          const id =
            d.m_unit_bisnis_id || d.unit_bisnis_id || d.m_unit_bisnis?.id;
          const nama =
            d.m_unit_bisni?.nama_comp ||
            d.m_unit_bisnis?.nama_comp ||
            d.unit_bisnis?.nama_comp ||
            d.nama_comp ||
            "-";
          if (id) unitBisnisNameMap.value[id] = nama;
        });
      }

      values.m_unit_bisnis_list = initialValues.m_customer_group_ubs.map(
        (d: any) => ({
          m_unit_bisnis_id:
            d.m_unit_bisnis_id || d.unit_bisnis_id || d.m_unit_bisnis?.id,
          m_unit_bisni: d.m_unit_bisni,
          m_unit_bisnis: d.m_unit_bisnis,
          unit_bisnis: d.unit_bisnis,
          m_company:
            d.m_company ||
            d.m_unit_bisni?.m_company ||
            d.m_unit_bisnis?.m_company ||
            d.unit_bisnis?.m_company ||
            null,
          m_company_id:
            d.m_company_id ||
            d.m_company?.id ||
            d.m_unit_bisni?.m_company?.id ||
            d.m_unit_bisnis?.m_company?.id ||
            d.unit_bisnis?.m_company?.id ||
            "",
          nama_comp:
            d.m_unit_bisni?.nama_comp ||
            d.m_unit_bisnis?.nama_comp ||
            d.unit_bisnis?.nama_comp ||
            d.nama_comp ||
            "-",
        }),
      );
    }

    // Mode copy: hapus id, timestamps, dan sub detail agar jadi create baru
    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
      if (initialValues.m_customer_group_ubs) {
        initialValues.m_customer_group_ubs.forEach((d: any) => {
          delete d.id;
          delete d.createdAt;
          delete d.updatedAt;
          d.customer_g_details = [];
        });
      }
      detailArr.value.forEach((d) => {
        delete d.id;
        d.customers = [];
      });
    }

    // Assign hanya key yang sudah ada di state reactive values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        // @ts-ignore dynamic assign
        values[key] = initialValues[key];
      }
    }

    syncCompanySelectionFromUnitBisnis();

    if (!isSuperAdmin.value) {
      await mergeAllowedUnitBisnisIntoFormOptions();
    }

    if (isCopyModeLocal) {
      toast.success("Data berhasil disalin", {
        description: "Silakan edit dan simpan sebagai Customer Group baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
    }
  } catch (error) {
    toast.error("Gagal memuat data Customer Group", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () => router.push("/marketing/master/m_customer_group"),
      },
    });
    setTimeout(() => router.push("/marketing/master/m_customer_group"), 2000);
  } finally {
    loading.value = false;
  }
});

// Errors object (manual validation) - SAMA SEPERTI Form.txt
const errors = reactive({
  m_customer_group_ubs: "",
  kode: "",
  nama: "",
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
  if (
    !values.m_customer_group_ubs ||
    values.m_customer_group_ubs.length === 0
  ) {
    errors.m_customer_group_ubs = "Minimal pilih satu Unit Bisnis";
    invalid = true;
  }
  if (!values.nama?.trim()) {
    errors.nama = "Nama Customer Group wajib diisi";
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
    const toNull = (val?: string | null) => (val?.trim() ? val.trim() : null);

    // Clean payload: convert empty strings to null + TAMBAH DETAIL
    const payloadUbs = values.m_customer_group_ubs.map((ub: any) => {
      const ubId = ub.m_unit_bisnis_id || ub.unit_bisnis_id;
      const detail = detailArr.value.find((d) => d.m_unit_bisnis_id === ubId);
      const kreditLimitTotalNum = toNumber(detail?.kredit_limit_total);
      const kreditLimitTerpakaiNum = toNumber(detail?.kredit_limit_terpakai);
      const kreditLimitSisaNum = Math.max(
        0,
        kreditLimitTotalNum - kreditLimitTerpakaiNum,
      );
      return {
        ...ub,
        kredit_limit_total: kreditLimitTotalNum,
        kredit_limit_terpakai: kreditLimitTerpakaiNum,
        kredit_limit_sisa: kreditLimitSisaNum,
      };
    });

    const payload: any = {
      kode: values.kode?.trim() || null,
      nama: values.nama?.trim() || null,
      kredit_limit_total: kreditLimitTotal.value,
      kredit_limit_sisa: kreditLimitSisaTotal.value,
      kredit_limit_terpakai: kreditLimitTerpakaiTotal.value,
      is_active: values.is_active,
      catatan: values.catatan,
      m_customer_group_ubs: payloadUbs,
    };

    const currentUserId = authStore.user?.id || null;

    if (isEditMode.value) {
      payload.updated_by = currentUserId;
      payload.update_by = currentUserId;
      await updateCustomerGroup(menuId.value, payload as any);
      toast.success("Customer Group berhasil diperbarui", {
        description: `Customer Group code "${values.kode}" telah diperbarui`,
      });
    } else {
      payload.created_by = currentUserId;
      payload.updated_by = currentUserId;
      payload.update_by = currentUserId;
      await createCustomerGroup(payload as any);
      toast.success("Customer Group berhasil dibuat", {
        description: `Customer Group code "${values.kode}" telah ditambahkan`,
      });
    }
    router.replace("/marketing/master/m_customer_group?reload=" + Date.now());
  } catch (error) {
    toast.error(
      isEditMode.value
        ? "Gagal memperbarui Customer Group"
        : "Gagal membuat Customer Group",
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
  router.push("/marketing/master/m_customer_group");
};

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
          <CardTitle>Informasi Customer Group</CardTitle>
          <CardDescription>
            Isi data CustomerGroup dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              :errorname="errors.m_customer_group_ubs ? 'failed' : ''"
              :hints="
                errors.m_customer_group_ubs ||
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
            <FieldX
              id="nama"
              label="Nama Customer Group"
              :value="values.nama"
              :errorname="errors.nama ? 'failed' : ''"
              @input="(v) => (values.nama = v)"
              :hints="errors.nama"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="loading || isReadOnly"
              placeholder="Masukan Nama Customer Group"
              class="w-full"
            />
          </div>

          <!-- Catatan (Textarea full width) -->
          <FieldX
            id="catatan"
            type="textarea"
            label="Catatan"
            v-model="values.catatan"
            :required="false"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            placeholder="Catatan tambahan..."
            :rows="2"
            class="w-full"
          />
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

      <!-- DETAIL TABS (di bawah header card) -->
      <Tabs v-if="detailArr.length > 0" default-value="detail1" class="w-full">
        <TabsList
          class="w-full overflow-x-auto flex justify-start scrollbar-hide"
        >
          <TabsTrigger value="detail1">Detail Customer Group</TabsTrigger>
        </TabsList>

        <!-- DETAIL TAB CONTENTS - DYNAMIC GENERATION -->

        <!-- TAB CONTENT: DETAIL 1 (MULTI-SELECT) -->
        <TabsContent value="detail1" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Customer Group</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div v-if="detailArr.length === 0" class="py-8 text-center">
                <p class="text-muted-foreground text-xs sm:text-sm">
                  Belum ada detail untuk ditampilkan.
                </p>
              </div>
              <div v-else class="border rounded-lg">
                <div
                  v-for="(detail, idx) in detailArr"
                  :key="detail.m_unit_bisnis_id || detail.id || idx"
                  class="border-b last:border-b-0"
                >
                  <div
                    class="p-4 hover:bg-muted/50 cursor-pointer"
                    @click="
                      toggleDetail(
                        detail.m_unit_bisnis_id || detail.id || `${idx}`,
                      )
                    "
                  >
                    <div class="flex w-full items-center justify-between gap-3">
                      <div
                        class="grid flex-1 gap-3 sm:grid-cols-[1fr_auto] sm:items-center"
                      >
                        <div class="min-w-0 text-left">
                          <div
                            class="text-[11px] uppercase tracking-wide text-muted-foreground"
                          >
                            Unit Bisnis
                          </div>
                          <div class="flex items-center gap-4">
                            <div
                              class="truncate text-sm font-semibold text-foreground"
                            >
                              {{ idx + 1 }}. {{ detail.nama_comp }}
                            </div>
                            <span
                              class="inline-flex items-center rounded-full bg-primary border px-2 py-0.5 text-[10px] font-medium text-primary-foreground shrink-0"
                            >
                              {{ detail.customers?.length || 0 }} customer
                            </span>
                          </div>
                        </div>
                        <div
                          class="grid grid-cols-3 items-center gap-4 text-xs sm:text-sm"
                        >
                          <div class="text-right" @click.stop>
                            <div class="text-muted-foreground">
                              Kredit Limit
                            </div>
                            <FieldNumber
                              v-model="detail.kredit_limit_total"
                              :min="0"
                              :disabled="loading || isReadOnly"
                              placeholder="0"
                              class="w-full text-right"
                            />
                          </div>
                          <div class="text-right">
                            <div class="text-muted-foreground">Terpakai</div>
                            <div class="font-semibold text-foreground">
                              {{ formatNumberId(detail.kredit_limit_terpakai) }}
                            </div>
                          </div>
                          <div class="text-right">
                            <div class="text-muted-foreground">Sisa</div>
                            <div class="font-semibold text-foreground">
                              {{
                                formatNumberId(
                                  toNumber(detail.kredit_limit_total) -
                                    toNumber(detail.kredit_limit_terpakai),
                                )
                              }}
                            </div>
                          </div>
                        </div>
                      </div>
                      <ChevronDown
                        :class="[
                          'h-5 w-5 text-muted-foreground transition-transform',
                          expandedDetails[
                            detail.m_unit_bisnis_id || detail.id || `${idx}`
                          ] && 'rotate-180',
                        ]"
                      />
                    </div>
                  </div>
                  <div
                    v-if="
                      expandedDetails[
                        detail.m_unit_bisnis_id || detail.id || `${idx}`
                      ]
                    "
                    class="p-4 pt-0"
                  >
                    <div class="border rounded-lg overflow-x-auto mt-3">
                      <table class="w-full text-sm">
                        <thead class="bg-muted/60 sticky top-0">
                          <tr>
                            <th
                              class="px-4 py-3 text-left font-semibold text-xs sm:text-sm text-muted-foreground"
                            >
                              No
                            </th>
                            <th
                              class="px-4 py-3 text-left font-semibold text-xs sm:text-sm text-muted-foreground"
                            >
                              Customer
                            </th>
                            <th
                              class="px-4 py-3 text-right font-semibold text-xs sm:text-sm text-muted-foreground"
                            >
                              Kredit Limit Customer
                            </th>
                            <th
                              class="px-4 py-3 text-right font-semibold text-xs sm:text-sm text-muted-foreground"
                            >
                              Terpakai
                            </th>
                            <th
                              class="px-4 py-3 text-right font-semibold text-xs sm:text-sm text-muted-foreground"
                            >
                              Sisa
                            </th>
                            <th
                              class="px-4 py-3 text-center font-semibold text-xs sm:text-sm text-muted-foreground"
                            >
                              Aksi
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-if="
                              !detail.customers || detail.customers.length === 0
                            "
                          >
                            <td
                              :colspan="6"
                              class="text-center py-10 text-muted-foreground text-xs sm:text-sm italic"
                            >
                              Belum ada customer untuk unit bisnis ini.
                            </td>
                          </tr>
                          <tr
                            v-for="(cust, cIdx) in detail.customers || []"
                            :key="cust.m_customer_id || cust.id || cIdx"
                            :class="[
                              'border-t transition-colors',
                              (cIdx as number) % 2 === 0
                                ? 'hover:bg-muted/20'
                                : 'bg-muted/5 hover:bg-muted/15',
                            ]"
                          >
                            <td
                              class="px-4 py-3 text-xs sm:text-sm font-medium text-muted-foreground"
                            >
                              {{ (cIdx as number) + 1 }}
                            </td>
                            <td class="px-4 py-3 text-xs sm:text-sm">
                              <div class="font-medium text-foreground">
                                {{ cust.nama_customer }}
                              </div>
                              <div class="text-xs text-muted-foreground">
                                {{ cust.kode_customer }}
                              </div>
                            </td>
                            <td
                              class="px-4 py-3 text-xs sm:text-sm text-right font-medium"
                            >
                              {{ formatNumberId(cust.kredit_limit) }}
                            </td>
                            <td
                              class="px-4 py-3 text-xs sm:text-sm text-right font-medium"
                            >
                              {{ formatNumberId(cust.kredit_limit_terpakai) }}
                            </td>
                            <td
                              class="px-4 py-3 text-xs sm:text-sm text-right font-medium"
                            >
                              {{ formatNumberId(cust.kredit_limit_sisa) }}
                            </td>
                            <td class="px-4 py-3 text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                class="h-7 w-7"
                                @click.stop="openHistory(cust)"
                                title="Lihat History"
                              >
                                <History class="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
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

    <!-- ================================================================ -->
    <!-- HISTORY DIALOG -->
    <!-- ================================================================ -->
    <Dialog v-model:open="historyDialogOpen">
      <DialogContent class="max-w-2xl">
        <DialogHeader>
          <DialogTitle>History Customer</DialogTitle>
          <DialogDescription>
            Riwayat kredit limit untuk
            <span class="font-medium text-foreground">{{
              selectedCustomerName
            }}</span>
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <!-- Summary -->
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">
              Total Data: {{ historyPagination.total }}
            </span>
            <span class="text-muted-foreground">
              Halaman {{ historyPagination.page }} /
              {{ historyPagination.totalPages }}
            </span>
          </div>

          <!-- Table -->
          <div class="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-12">No</TableHead>
                  <TableHead>Tanggal Berlaku</TableHead>
                  <TableHead class="text-right">Kredit Limit</TableHead>
                  <TableHead class="text-right"
                    >Kredit Limit Terpakai</TableHead
                  >
                  <TableHead class="text-right">Kredit Limit Sisa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="historyLoading">
                  <TableCell
                    colspan="5"
                    class="text-center py-8 text-muted-foreground"
                  >
                    Memuat data...
                  </TableCell>
                </TableRow>
                <TableRow v-else-if="historyData.length === 0">
                  <TableCell
                    colspan="5"
                    class="text-center py-8 text-muted-foreground"
                  >
                    Belum ada history
                  </TableCell>
                </TableRow>
                <TableRow
                  v-for="(row, index) in historyData"
                  :key="row.id"
                  class="transition-colors hover:bg-muted/20"
                >
                  <TableCell class="text-muted-foreground">
                    {{
                      (historyPagination.page - 1) * historyPagination.limit +
                      index +
                      1
                    }}
                  </TableCell>
                  <TableCell class="whitespace-nowrap">
                    {{ formatTanggal(row.tanggal_berlaku) }}
                  </TableCell>
                  <TableCell class="text-right font-medium">
                    {{ formatNumberId(row.kredit_limit) }}
                  </TableCell>
                  <TableCell class="text-right font-medium">
                    {{ formatNumberId(row.kredit_limit_terpakai) }}</TableCell
                  >
                  <TableCell class="text-right font-medium">
                    {{ formatNumberId(row.kredit_limit_sisa) }}</TableCell
                  >
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <!-- Pagination -->
          <div
            v-if="historyPagination.totalPages > 1"
            class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p class="text-xs text-muted-foreground">
              Menampilkan {{ historyData.length }} data dari total
              {{ historyPagination.total }} histori.
            </p>

            <div class="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-8 rounded-lg px-3"
                :disabled="historyPagination.page <= 1 || historyLoading"
                @click="handleHistoryPageChange(historyPagination.page - 1)"
              >
                Sebelumnya
              </Button>

              <template
                v-for="item in historyPageItems"
                :key="`${item.type}-${item.value}`"
              >
                <span
                  v-if="item.type === 'ellipsis'"
                  class="px-1 text-xs text-muted-foreground"
                >
                  ...
                </span>
                <Button
                  v-else
                  type="button"
                  size="sm"
                  :variant="
                    item.value === historyPagination.page
                      ? 'default'
                      : 'outline'
                  "
                  class="h-8 min-w-8 rounded-lg px-2.5"
                  :disabled="historyLoading"
                  @click="handleHistoryPageChange(item.value)"
                >
                  {{ item.value }}
                </Button>
              </template>

              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-8 rounded-lg px-3"
                :disabled="
                  historyPagination.page >= historyPagination.totalPages ||
                  historyLoading
                "
                @click="handleHistoryPageChange(historyPagination.page + 1)"
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="historyDialogOpen = false"
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
