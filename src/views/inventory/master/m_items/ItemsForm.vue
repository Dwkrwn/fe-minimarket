<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, onMounted, computed, watch, nextTick } from "vue";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FieldX,
  FieldStatus,
  FieldMultiUpload,
  FieldSelect,
  FieldNumber,
  FieldMultiSelect,
} from "@/components/field";
import {
  createItems,
  updateItems,
  getItemsById,
  type UnitBisnis,
  validateItemName,
  checkItemHasStockTransactions,
} from "./service";
import RakSelection from "./RakSelection.vue";
import {
  ArrowLeft,
  Save,
  Loader2,
  Trash2,
  Eye,
  GripVertical,
  AlertTriangle,
  Lock,
} from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import ViewButton from "@/components/button/ViewButton.vue";
import AuditInfo from "@/components/AuditInfo.vue";
import Tabs from "@/components/ui/tabs/Tabs.vue";
import TabsList from "@/components/ui/tabs/TabsList.vue";
import TabsTrigger from "@/components/ui/tabs/TabsTrigger.vue";
import TabsContent from "@/components/ui/tabs/TabsContent.vue";

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
  () => !!route.params.id && route.name === "ItemsForm",
);
const isViewMode = computed(() => route.name === "ItemsView");
const isCopyMode = computed(
  () => route.query.action === "copy" && !!route.query.source,
);
const isReadOnly = computed(
  () => isViewMode.value || route.meta.readOnly === true,
);
const menuId = computed(() => route.params.id as string);
const isHydratingItemForm = ref(false);
const initialStatus = ref<string>("DRAFT");

// ============================================================================
// UNIT BISNIS READONLY — locked saat Edit Mode dan View Mode
// ============================================================================
const isUnitBisnisReadonly = computed(
  () => isEditMode.value || isViewMode.value,
);
const isSuperAdmin = computed(() => authStore.isSuperAdmin);
const isCompanyUnitReadonly = computed(
  () => isUnitBisnisReadonly.value || !isSuperAdmin.value,
);
const shouldUseCurrentUserCompanyUnit = computed(
  () => !isSuperAdmin.value && !isEditMode.value && !isViewMode.value,
);

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Items";
  if (isCopyMode.value) return "Salin Items";
  if (isEditMode.value) return "Edit Items";
  return "Tambah Items Baru";
});
const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Items";
  if (isCopyMode.value) return "Buat Items baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data Items";
  return "Buat Items aplikasi baru";
});

// Reactive form values with defaults
let values = reactive({
  kode_item: "",
  nama_item: "",
  nama_spek: "",
  tipe_barang: "barang dagang",
  spesifikasi: "",

  // UUIDs for groups (new structure)
  group1_id: "",
  group2_id: "",
  group3_id: "",
  group4_id: "",
  group5_id: "",
  group6_id: "",

  tipe_id: "",
  kategori_id: "",
  company_id: "",
  uom_id: "",
  ukuran_id: "",
  ukuran: null as number | null,

  // Other fields
  catatan: "",
  status: "DRAFT",
  is_active: true,
  is_skip: false,

  hs_code: "",
  berat_bersih: 0 as number | null,
  berat_jenis: null as number | null,
  toleransi: 0,

  is_batch: false,
  is_sepuh: false,
  is_potong: false,
  is_import: false,
  qc_tipe: "" as string,

  // Arrays
  m_items_images: [] as { m_items_id?: string; gambar: string }[],
  m_items_unit_bisnis: [] as {
    items_id?: string;
    unit_bisnis_id?: string;
    company_id?: string | null;
  }[],
  m_items_unit_bisnis_list: [] as any[], // Helper for View Mode display
  m_items_gudangs: [] as {
    id?: string;
    items_id?: string;
    gudang_id: string;
    safety_stok: number;
    stok_optimum: number;
  }[],
  m_items_raks: [] as {
    id?: string;
    items_id?: string;
    rak_d_id?: string;
    is_default?: boolean;
    sequence?: number | null;
  }[],
  m_items_conversions: [] as {
    id?: string;
    uom_id?: string;
    qty?: number;
    uom_konversi_id?: string;
    items_id?: string;
  }[],

  // Relations objects for View Mode
  mi_company: null as any,
  mi_tipe: null as any,
  kategori: null as any,
  group1: null as any,
  group2: null as any,
  group3: null as any,
  group4: null as any,
  group5: null as any,
  group6: null as any,
  mi_uom: null as any,
  mi_ukuran: null as any,
});

const selectedCompanyIds = ref<string[]>([]);
const companyMasterList = ref<any[]>([]);
const unitBisnisNestedData = ref<UnitBisnis[]>([]);

const extractUnitsFromCompany = (comp: any): any[] => {
  if (!comp) return [];
  const raw = comp.m_unit_bisni ?? comp.m_unit_bisnis;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object" && raw.id) return [raw];
  return [];
};

const fetchCompanyMaster = async () => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_company?no_pagination=true&selectfield=id,kode,nama&searchfield=kode,nama`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    const result = await response.json();
    if (result.status === "success" && Array.isArray(result.data)) {
      companyMasterList.value = result.data;
    }
  } catch (e) {
    console.error("Failed to load company master list", e);
  }
};

const getCompanyIdForUnit = (unitBisnisId: string): string | null => {
  if (!unitBisnisId) return null;

  // 1. Check in companyMasterList (c.m_unit_bisni / c.m_unit_bisnis)
  for (const c of companyMasterList.value) {
    const units = extractUnitsFromCompany(c);
    for (const u of units) {
      if (String(u.id) === String(unitBisnisId)) {
        return String(c.id);
      }
    }
  }

  // 2. Check in unitBisnisNestedData
  const foundInNested = unitBisnisNestedData.value.find(
    (unit) => String(unit.id) === String(unitBisnisId),
  );
  if (foundInNested?.company_id) return String(foundInNested.company_id);

  // 3. Check in values.m_items_unit_bisnis_list
  const foundInList = (values.m_items_unit_bisnis_list || []).find(
    (u: any) => String(u.unit_bisnis_id || u.id) === String(unitBisnisId),
  );
  const listCompanyId =
    foundInList?.company_id ||
    foundInList?.m_unit_bisnis?.company_id ||
    foundInList?.unit_bisnis?.company_id;
  if (listCompanyId) return String(listCompanyId);

  // 4. Check in values.m_items_unit_bisnis
  const foundInValues = (values.m_items_unit_bisnis || []).find(
    (u: any) => String(u.unit_bisnis_id) === String(unitBisnisId) && u.company_id,
  );
  if (foundInValues?.company_id) return String(foundInValues.company_id);

  return null;
};

// Computed for Company MultiSelect Options (Only contains Company data)
const getCompanyOptions = computed(() => {
  const map = new Map<string, any>();

  for (const c of companyMasterList.value) {
    if (c?.id) {
      map.set(String(c.id), {
        id: String(c.id),
        nama: c.nama || c.kode || "-",
        kode: c.kode,
      });
    }
  }

  if (values.mi_company?.id && !map.has(String(values.mi_company.id))) {
    map.set(String(values.mi_company.id), {
      id: String(values.mi_company.id),
      nama: values.mi_company.nama || values.mi_company.kode || "-",
      kode: values.mi_company.kode,
    });
  }

  for (const ub of values.m_items_unit_bisnis_list || []) {
    const cId = ub.company_id || ub.m_unit_bisnis?.company_id || ub.unit_bisnis?.company_id;
    const cNama =
      ub.company?.nama ||
      ub.m_company?.nama ||
      ub.m_unit_bisnis?.company?.nama ||
      ub.unit_bisnis?.company?.nama;
    if (cId && cNama && !map.has(String(cId))) {
      map.set(String(cId), {
        id: String(cId),
        nama: cNama,
      });
    }
  }

  return Array.from(map.values());
});

// Helper to get unit bisnis options belonging to a company
const getUnitsForCompany = (companyId: string): { id: string; nama_comp: string }[] => {
  const unitsMap = new Map<string, { id: string; nama_comp: string }>();

  // 1. From companyMasterList (c.m_unit_bisni / c.m_unit_bisnis)
  const foundComp = companyMasterList.value.find((c) => String(c.id) === String(companyId));
  if (foundComp) {
    const units = extractUnitsFromCompany(foundComp);
    for (const u of units) {
      if (u?.id) {
        unitsMap.set(String(u.id), {
          id: String(u.id),
          nama_comp: u.nama_comp || u.nama || "-",
        });
      }
    }
  }

  // 2. From unitBisnisNestedData
  for (const ub of unitBisnisNestedData.value) {
    if (String(ub.company_id || "") === String(companyId) && ub.id) {
      if (!unitsMap.has(String(ub.id))) {
        unitsMap.set(String(ub.id), {
          id: String(ub.id),
          nama_comp: ub.nama_comp || "-",
        });
      }
    }
  }

  return Array.from(unitsMap.values());
};

// Computed for Unit Bisnis MultiSelect (Array of IDs <-> Array of Objects)
const unit_bisnis_ids_computed = computed({
  get: () =>
    (values.m_items_unit_bisnis || [])
      .map((item: any) => item.unit_bisnis_id)
      .filter((id: any) => !!id) as string[],
  set: (newIds: string[]) => {
    values.m_items_unit_bisnis = newIds.map((id) => ({
      unit_bisnis_id: id,
      company_id: getCompanyIdForUnit(id),
    }));
    if (newIds.length > 0) {
      errors.unit_bisnis = "";
    }
  },
});

// Unit Bisnis Options filtered by selected companies
const filteredUnitBisnisOptions = computed(() => {
  if (selectedCompanyIds.value.length === 0) {
    return [];
  }

  const selectedSet = new Set(selectedCompanyIds.value.map(String));
  const optionMap = new Map<string, { id: string; company_id: string; nama_comp: string }>();

  // 1. From companyMasterList (c.m_unit_bisni / c.m_unit_bisnis)
  for (const c of companyMasterList.value) {
    if (c?.id && selectedSet.has(String(c.id))) {
      const units = extractUnitsFromCompany(c);
      for (const u of units) {
        if (u?.id) {
          optionMap.set(String(u.id), {
            id: String(u.id),
            company_id: String(c.id),
            nama_comp: u.nama_comp || u.nama || "-",
          });
        }
      }
    }
  }

  // 2. From unitBisnisNestedData
  for (const ub of unitBisnisNestedData.value) {
    if (ub.id && ub.company_id && selectedSet.has(String(ub.company_id))) {
      const existing = optionMap.get(String(ub.id));
      optionMap.set(String(ub.id), {
        id: String(ub.id),
        company_id: String(ub.company_id),
        nama_comp: existing?.nama_comp || ub.nama_comp || "-",
      });
    }
  }

  return Array.from(optionMap.values());
});

// Helper computed to provide options for FieldMultiSelect (especially for read-only mode)
const getUnitBisnisOptions = computed(() => {
  const optionMap = new Map<string, any>();

  for (const opt of filteredUnitBisnisOptions.value) {
    if (opt?.id) optionMap.set(String(opt.id), opt);
  }

  for (const i of values.m_items_unit_bisnis_list || []) {
    const unitId = i.unit_bisnis_id || i.id;
    if (unitId && !optionMap.has(String(unitId))) {
      optionMap.set(String(unitId), {
        id: String(unitId),
        company_id:
          i.company_id ||
          i.m_unit_bisnis?.company_id ||
          i.unit_bisnis?.company_id ||
          getCompanyIdForUnit(unitId) ||
          "",
        nama_comp:
          i.m_unit_bisnis?.nama_comp ||
          i.unit_bisnis?.nama_comp ||
          i.nama_comp ||
          "-",
      });
    }
  }

  return Array.from(optionMap.values());
});

const handleCompanyChange = (newCompanyIds: (string | number)[]) => {
  const stringIds = (newCompanyIds || []).map(String);
  selectedCompanyIds.value = stringIds;
  values.company_id = stringIds[0] || "";
  if (stringIds.length > 0) {
    errors.company = "";
  }

  const allowedCompanySet = new Set(stringIds);

  // 1. Filter out units that no longer belong to selected companies
  const currentUnits = values.m_items_unit_bisnis || [];
  const remainingUnits = currentUnits.filter((u) => {
    const cId = u.company_id || getCompanyIdForUnit(u.unit_bisnis_id || "");
    return cId ? allowedCompanySet.has(cId) : false;
  });

  // 2. For newly selected companies, auto-select their units
  const existingUnitIdSet = new Set(remainingUnits.map((u) => u.unit_bisnis_id));
  const unitsToAdd: { unit_bisnis_id: string; company_id: string | null }[] = [];

  for (const cId of stringIds) {
    const unitsForCompany = getUnitsForCompany(cId);
    for (const u of unitsForCompany) {
      if (u.id && !existingUnitIdSet.has(u.id)) {
        unitsToAdd.push({
          unit_bisnis_id: u.id,
          company_id: cId,
        });
        existingUnitIdSet.add(u.id);
      }
    }
  }

  values.m_items_unit_bisnis = [...remainingUnits, ...unitsToAdd];
  if (values.m_items_unit_bisnis.length > 0) {
    errors.unit_bisnis = "";
  }
};

const getCurrentUserCompanyUnit = () => {
  if (isSuperAdmin.value) return null;

  try {
    const selectRespo = localStorage.getItem("SelectRespo");
    if (!selectRespo) return null;

    const parsed = JSON.parse(selectRespo);
    const unitBisnisId = parsed.companyId ? String(parsed.companyId) : "";
    const matchedUnit = unitBisnisNestedData.value.find(
      (unit) => unitBisnisId && String(unit.id) === unitBisnisId,
    );
    const companyIdSource = parsed.companyLegalId || matchedUnit?.company_id;
    const companyId = companyIdSource ? String(companyIdSource) : "";

    return {
      companyId,
      unitBisnisId,
      unitBisnisName:
        parsed.unitBisnisName || parsed.companyName || matchedUnit?.nama_comp || "",
    };
  } catch (error) {
    console.error("Failed to parse SelectRespo:", error);
    return null;
  }
};

const applyCurrentUserCompanyUnit = () => {
  if (!shouldUseCurrentUserCompanyUnit.value) return;

  const defaults = getCurrentUserCompanyUnit();
  if (!defaults?.unitBisnisId) return;

  if (defaults.companyId) {
    selectedCompanyIds.value = [defaults.companyId];
  }
  values.company_id = defaults.companyId || "";
  values.m_items_unit_bisnis = [
    {
      unit_bisnis_id: defaults.unitBisnisId,
      company_id: defaults.companyId || null,
    },
  ];
  values.m_items_unit_bisnis_list = [
    {
      unit_bisnis_id: defaults.unitBisnisId,
      company_id: defaults.companyId || null,
      m_unit_bisnis: {
        id: defaults.unitBisnisId,
        company_id: defaults.companyId || null,
        nama_comp: defaults.unitBisnisName || "-",
      },
    },
  ];
};

watch(
  () => selectedCompanyIds.value,
  (newCompanyIds) => {
    values.company_id = newCompanyIds?.[0] || "";
  },
  { deep: true },
);

// Computed for Rak IDs (Array of Strings <-> Array of Objects { rak_d_id })
const normalizeItemRakDetails = (
  rows: any[],
): {
  id?: string;
  items_id?: string;
  rak_d_id?: string;
  is_default?: boolean;
  sequence?: number | null;
}[] => {
  const seen = new Set<string>();
  const normalized: {
    id?: string;
    items_id?: string;
    rak_d_id?: string;
    is_default?: boolean;
    sequence?: number | null;
  }[] = [];

  for (const row of rows || []) {
    const rakId = row?.rak_d_id;
    if (!rakId || seen.has(rakId)) continue;
    seen.add(rakId);

    normalized.push({
      id: row?.id,
      items_id: row?.items_id,
      rak_d_id: rakId,
      is_default: !!row?.is_default,
      sequence:
        row?.sequence === null || row?.sequence === undefined
          ? null
          : Number(row.sequence),
    });
  }

  return normalized;
};

const rak_ids_computed = computed({
  get: () =>
    (values.m_items_raks || [])
      .map((item: any) => item.rak_d_id)
      .filter((id: any) => !!id) as string[],
  set: (newIds: string[]) => {
    const existingByRakId = new Map(
      (values.m_items_raks || [])
        .filter((item) => !!item?.rak_d_id)
        .map((item) => [item.rak_d_id as string, item]),
    );

    values.m_items_raks = newIds.map((id) => {
      const existing = existingByRakId.get(id);
      if (existing) {
        return {
          ...existing,
          rak_d_id: id,
          is_default: !!existing.is_default,
          sequence:
            existing.sequence === null || existing.sequence === undefined
              ? null
              : Number(existing.sequence),
        };
      }
      return {
        rak_d_id: id,
        is_default: false,
        sequence: null,
      };
    });

    normalizeAllDefaultSequences();
  },
});

// Duplicate Check State
const isDuplicateModalOpen = ref(false);
const duplicateExactMatches = ref<any[]>([]);
const duplicatePartialMatches = ref<any[]>([]);
const generatedNamaItem = ref("");
const targetSaveStatus = ref("");
const selectedTipeItem = ref<any>(null);

const isTipeJasa = computed(() => {
  const tipeValue = selectedTipeItem.value?.value1 ?? values.mi_tipe?.value1;
  return String(tipeValue ?? "").trim().toUpperCase() === "JASA";
});

const isTipeBeratJenis = computed(() => {
  const tipeValue = String(
    selectedTipeItem.value?.value1 ??
      selectedTipeItem.value?.code ??
      values.mi_tipe?.value1 ??
      values.mi_tipe?.code ??
      "",
  )
    .trim()
    .toUpperCase();

  return (
    tipeValue.includes("AVALAN") ||
    tipeValue.includes("WORK IN PROGRESS") ||
    tipeValue === "WIP" ||
    tipeValue.includes("RAW MATERIAL")
  );
});

watch(
  () => values.is_import,
  (val) => {
    if (!val) {
      errors.hs_code = "";
    }
  },
);

const handleTipeItemChange = (value: string) => {
  values.tipe_id = value;
  if (value) {
    errors.tipe_item = "";
  } else {
    selectedTipeItem.value = null;
  }
};

const handleTipeItemValueFull = (option: any = null) => {
  selectedTipeItem.value = option;
  if (option) {
    errors.tipe_item = "";
  }
};

watch(
  () => isTipeJasa.value,
  (isJasa) => {
    if (isJasa) {
      errors.group2 = "";
      errors.group3 = "";
      errors.ukuran = "";
    }
  },
);

watch(
  () => values.tipe_id,
  () => {
    if (!values.tipe_id) {
      selectedTipeItem.value = null;
    }
  },
);

watch(
  () => values.mi_tipe,
  (newVal) => {
    if (newVal) {
      selectedTipeItem.value = newVal;
    }
  },
  { immediate: true },
);

watch(
  () => values.kategori_id,
  (newValue, oldValue) => {
    if (isHydratingItemForm.value) return;
    if (newValue === oldValue) return;
    values.group1_id = "";
    values.group1 = null;
    values.group2_id = "";
    values.group2 = null;
    values.group3_id = "";
    values.group3 = null;
    values.group4_id = "";
    values.group4 = null;
    values.group5_id = "";
    values.group5 = null;
    values.group6_id = "";
    values.group6 = null;
    values.ukuran_id = "";
    values.ukuran = null;
    values.mi_ukuran = null;
  },
);

watch(
  () => values.group1_id,
  (newValue, oldValue) => {
    if (isHydratingItemForm.value) return;
    if (newValue === oldValue) return;
    values.group2_id = "";
    values.group2 = null;
    values.group3_id = "";
    values.group3 = null;
    values.group4_id = "";
    values.group4 = null;
    values.group5_id = "";
    values.group5 = null;
    values.group6_id = "";
    values.group6 = null;
    values.ukuran_id = "";
    values.ukuran = null;
    values.mi_ukuran = null;
  },
);

watch(
  () => values.group2_id,
  (newValue, oldValue) => {
    if (isHydratingItemForm.value) return;
    if (newValue === oldValue) return;
    values.group3_id = "";
    values.group3 = null;
    values.group4_id = "";
    values.group4 = null;
    values.group5_id = "";
    values.group5 = null;
    values.group6_id = "";
    values.group6 = null;
    values.ukuran_id = "";
    values.ukuran = null;
    values.mi_ukuran = null;
  },
);

watch(
  () => values.group3_id,
  (newValue, oldValue) => {
    if (isHydratingItemForm.value) return;
    if (newValue === oldValue) return;
    values.group4_id = "";
    values.group4 = null;
    values.group5_id = "";
    values.group5 = null;
    values.group6_id = "";
    values.group6 = null;
    values.ukuran_id = "";
    values.ukuran = null;
    values.mi_ukuran = null;
  },
);

watch(
  () => values.group4_id,
  (newValue, oldValue) => {
    if (isHydratingItemForm.value) return;
    if (newValue === oldValue) return;
    values.group5_id = "";
    values.group5 = null;
    values.group6_id = "";
    values.group6 = null;
  },
);

watch(
  () => values.group5_id,
  (newValue, oldValue) => {
    if (isHydratingItemForm.value) return;
    if (newValue === oldValue) return;
    values.group6_id = "";
    values.group6 = null;
  },
);

const handleUkuranChange = (value: string) => {
  values.ukuran_id = value || "";
  if (value) {
    errors.ukuran = "";
  } else {
    values.mi_ukuran = null;
    values.ukuran = null;
  }
};

const handleUkuranValueFull = (item: any) => {
  values.mi_ukuran = item || null;
  values.ukuran_id = item?.id ? String(item.id) : values.ukuran_id;
  values.ukuran = getUkuranNumericValue(item);
};

const formatUkuranDisplay = (item: any) => {
  const ukuranValue =
    item?.ukuran ??
    item?.nama_ukuran ??
    item?.m_g_ukuran?.name ??
    item?.m_group_ukuran?.nama_ukuran ??
    item?.mi_ukuran?.name ??
    item?.mi_ukuran?.value1 ??
    item?.group_ukuran ??
    item?.size;

  if (ukuranValue === null || ukuranValue === undefined || ukuranValue === "") {
    return values.ukuran !== null && values.ukuran !== undefined ? String(values.ukuran) : "-";
  }

  return String(ukuranValue);
};

const formatCodeNameLabel = (item: any) => {
  if (!item) return "-";
  const code = item.code?.trim?.() || item.code || "";
  const name = item.name?.trim?.() || item.name || item.value1 || "";
  return code && name ? `${code} - ${name}` : code || name || "-";
};

const formatPanjangNameLabel = (item: any) => {
  if (!item) return "-";
  const panjang =
    item.panjang === null || item.panjang === undefined || item.panjang === ""
      ? ""
      : String(item.panjang);
  const name = item.name?.trim?.() || item.name || item.value1 || "";
  return panjang && name ? `${panjang} - ${name}` : panjang || name || "-";
};

const isEmptyAutoNamePart = (value: string) => {
  const normalized = value.trim();
  return !normalized || /^[-\s]+$/.test(normalized);
};

const getNameOnlyLabel = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const normalized = String(value).replace(/\s+/g, " ").trim();
  if (isEmptyAutoNamePart(normalized)) return "";

  const parts = normalized
    .split(/\s+-\s+/)
    .map((part) => part.trim())
    .filter((part) => !isEmptyAutoNamePart(part));

  return parts.length > 0 ? parts[parts.length - 1] : normalized;
};

const getAutoNamePart = (item: any) => {
  if (!item) return "";
  if (typeof item === "string" || typeof item === "number") {
    return getNameOnlyLabel(item);
  }

  return getNameOnlyLabel(
    item.name ??
      item.value1 ??
      item.nama_ukuran ??
      item.nama_item ??
      item.display_name ??
      item.label ??
      "",
  );
};

const getSelectedAutoNamePart = (item: any, selectedId: string) => {
  if (!item || !selectedId) return "";
  return String(item.id || "") === String(selectedId) ? getAutoNamePart(item) : "";
};

const getRelationRecord = (source: Record<string, any>, ...keys: string[]) => {
  for (const key of keys) {
    const value = source?.[key];
    if (value) return value;
  }
  return null;
};

const getRelationId = (
  source: Record<string, any>,
  idKey: string,
  ...relationKeys: string[]
) => {
  const directId = source?.[idKey];
  if (directId !== undefined && directId !== null && String(directId).trim() !== "") {
    return String(directId);
  }

  const relation = getRelationRecord(source, ...relationKeys);
  if (relation?.id !== undefined && relation?.id !== null && String(relation.id).trim() !== "") {
    return String(relation.id);
  }

  return "";
};

const getUkuranNumericValue = (item?: any) => {
  if (!item) return null;

  const panjang = item?.panjang ?? item?.ukuran ?? item?.size ?? null;
  if (panjang === null || panjang === undefined || panjang === "") {
    return null;
  }

  const numericValue = Number(panjang);
  return Number.isNaN(numericValue) ? null : numericValue;
};

const mapCodeNameOptions = (response: any) => {
  if (response?.status === "success" && Array.isArray(response.data)) {
    return {
      ...response,
      data: response.data.map((item: any) => ({
        ...item,
        display_name: formatCodeNameLabel(item),
      })),
    };
  }
  return response;
};

const mapUkuranOptions = (response: any) => {
  if (response?.status === "success" && Array.isArray(response.data)) {
    return {
      ...response,
      data: response.data.map((item: any) => ({
        ...item,
        display_name: formatPanjangNameLabel(item),
      })),
    };
  }
  return response;
};

const resolveUkuranSelection = async (
  group3Id?: string,
  panjang?: number | null,
  ukuranId?: string,
) => {
  if (!group3Id && !ukuranId) return;
  try {
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_g_ukuran?no_pagination=true&filter_column_status=POST&filter_column_is_active=true${group3Id ? `&where_g3_standard_id=${group3Id}` : ""}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    const result = await response.json();
    if (result.status === "success" && Array.isArray(result.data)) {
      const matched =
        result.data.find((item: any) => ukuranId && String(item.id) === String(ukuranId)) ||
        result.data.find(
          (item: any) =>
            panjang !== null &&
            panjang !== undefined &&
            Number(item.panjang) === Number(panjang),
        );
      if (matched) {
        values.ukuran_id = matched.id ? String(matched.id) : "";
        values.mi_ukuran = matched;
        values.ukuran =
          matched?.panjang === null ||
          matched?.panjang === undefined ||
          matched?.panjang === ""
            ? null
            : Number(matched.panjang);
      }
    }
  } catch (error) {
    console.error("Failed to resolve ukuran selection", error);
  }
};

const hydrateDuplicateMatchItems = async (items: any[]) => {
  const hydratedItems = await Promise.all(
    (items || []).map(async (item) => {
      const itemId =
        item?.id || item?.m_items_id || item?.items_id || item?.item_id || "";

      if (!itemId) {
        return item;
      }

      if (
        item.ukuran !== undefined &&
        item.ukuran !== null &&
        item.ukuran !== ""
      ) {
        return item;
      }

      try {
        const response = await getItemsById(itemId);
        if (response.status === "success" && response.data) {
          return {
            ...item,
            ...response.data,
            id: response.data.id || item.id || itemId,
          };
        }
      } catch (error) {
        console.error("Failed to hydrate duplicate item:", error);
      }

      return item;
    }),
  );

  return hydratedItems;
};

// Temp penampung data API mentah sebelum dimasukkan (dinamis)
let initialValues: Record<string, any> = {};

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

const detailLog = ref<any[]>([]);
const loadingLog = ref(false);

// ============================================================================
// LOAD LOG DATA
// ============================================================================
const loadItemLogs = async (itemId: string) => {
  if (!itemId) return;
  loadingLog.value = true;
  try {
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_items_logs?filter_column_items_id=${itemId}&order_by=createdAt&order_type=DESC&join=true`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    const result = await response.json();
    if (result.status === "success" && Array.isArray(result.data)) {
      detailLog.value = result.data;
    }
  } catch (e) {
    console.error("Failed to load item logs", e);
  } finally {
    loadingLog.value = false;
  }
};

// Nested data for Rak Selection
const uomMasterOptions = ref<any[]>([]);

// Rak Summary Modal
const isRakSummaryOpen = ref(false);

const dragState = ref<{ gudangId: string; fromIndex: number } | null>(null);

type SelectedRakRow = {
  relation: {
    id?: string;
    items_id?: string;
    rak_d_id?: string;
    is_default?: boolean;
    sequence?: number | null;
  };
  unitBisnisId: string;
  unitBisnisName: string;
  gudangId: string;
  gudangName: string;
  rakName: string;
  rakId: string;
  rakDetailId: string;
  kode: string;
  baris: number | string;
  kolom: number | string;
};

const rakMetaById = computed(() => {
  const meta = new Map<
    string,
    Omit<SelectedRakRow, "relation"> & {
      sequence: number | null;
      is_default: boolean;
    }
  >();

  for (const ub of unitBisnisNestedData.value) {
    for (const g of ub.m_gudangs || []) {
      for (const r of g.m_raks || []) {
        for (const rd of r.m_rak_ds || []) {
          meta.set(rd.id, {
            unitBisnisId: ub.id,
            unitBisnisName: ub.nama_comp,
            gudangId: g.id,
            gudangName: g.nama_gudang,
            rakName: r.nama_rak,
            rakId: r.id,
            rakDetailId: rd.id,
            kode: rd.kode,
            baris: rd.baris ?? "-",
            kolom: rd.kolom ?? "-",
            sequence: null,
            is_default: false,
          });
        }
      }
    }
  }

  return meta;
});

const selectedRakRows = computed<SelectedRakRow[]>(() => {
  return (values.m_items_raks || [])
    .map((relation) => {
      const rakId = relation.rak_d_id;
      if (!rakId) return null;
      const meta = rakMetaById.value.get(rakId);
      if (!meta) return null;

      return {
        relation,
        unitBisnisId: meta.unitBisnisId,
        unitBisnisName: meta.unitBisnisName,
        gudangId: meta.gudangId,
        gudangName: meta.gudangName,
        rakName: meta.rakName,
        rakId: meta.rakId,
        rakDetailId: meta.rakDetailId,
        kode: meta.kode,
        baris: meta.baris,
        kolom: meta.kolom,
      };
    })
    .filter((row): row is SelectedRakRow => !!row);
});

const compareDefaultRows = (a: SelectedRakRow, b: SelectedRakRow) => {
  const seqA = a.relation.sequence ?? Number.MAX_SAFE_INTEGER;
  const seqB = b.relation.sequence ?? Number.MAX_SAFE_INTEGER;
  if (seqA !== seqB) return seqA - seqB;
  return a.kode.localeCompare(b.kode);
};

const getDefaultRowsByGudang = (gudangId: string) => {
  return selectedRakRows.value
    .filter((row) => row.gudangId === gudangId && row.relation.is_default)
    .sort(compareDefaultRows);
};

const getDefaultRowIndex = (gudangId: string, rakDetailId: string) => {
  return getDefaultRowsByGudang(gudangId).findIndex(
    (row) => row.rakDetailId === rakDetailId,
  );
};

const normalizeDefaultSequencesForGudang = (gudangId: string) => {
  const rows = getDefaultRowsByGudang(gudangId);
  rows.forEach((row, index) => {
    row.relation.sequence = index + 1;
  });
};

function normalizeAllDefaultSequences() {
  const gudangIds = new Set(
    selectedRakRows.value
      .filter((row) => row.relation.is_default)
      .map((row) => row.gudangId),
  );
  gudangIds.forEach((gudangId) => normalizeDefaultSequencesForGudang(gudangId));
}

// ============================================================================
// GUDANG STOK HELPERS (safety_stok & stok_optimum per gudang)
// ============================================================================
const getGudangStokEntry = (gudangId: string) => {
  return values.m_items_gudangs.find((g) => g.gudang_id === gudangId);
};

const getGudangSafetyStok = (gudangId: string): number => {
  return getGudangStokEntry(gudangId)?.safety_stok ?? 0;
};

const getGudangStokOptimum = (gudangId: string): number => {
  return getGudangStokEntry(gudangId)?.stok_optimum ?? 0;
};

const setGudangStok = (
  gudangId: string,
  field: "safety_stok" | "stok_optimum",
  value: number,
) => {
  const existing = values.m_items_gudangs.find((g) => g.gudang_id === gudangId);
  if (existing) {
    existing[field] = value;
  } else {
    const newEntry = { gudang_id: gudangId, safety_stok: 0, stok_optimum: 0 };
    newEntry[field] = value;
    values.m_items_gudangs.push(newEntry);
  }
};

const handleDefaultToggle = (rakDetailId: string, checked: boolean) => {
  const relation = (values.m_items_raks || []).find(
    (row) => row.rak_d_id === rakDetailId,
  );
  if (!relation) return;

  relation.is_default = checked;
  if (!checked) {
    relation.sequence = null;
  }

  const meta = rakMetaById.value.get(rakDetailId);
  if (!meta) return;

  normalizeDefaultSequencesForGudang(meta.gudangId);
};

const handleDefaultToggleChange = (rakDetailId: string, event: Event) => {
  const checked = (event.target as HTMLInputElement)?.checked ?? false;
  handleDefaultToggle(rakDetailId, checked);
};

const onDefaultDragStart = (
  event: DragEvent,
  gudangId: string,
  fromIndex: number,
) => {
  if (isReadOnly.value) return;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.dropEffect = "move";
    event.dataTransfer.setData("text/plain", `${gudangId}:${fromIndex}`);
  }
  dragState.value = { gudangId, fromIndex };
};

const onDefaultDrop = (event: DragEvent, gudangId: string, toIndex: number) => {
  event.preventDefault();
  if (isReadOnly.value || !dragState.value) return;
  if (dragState.value.gudangId !== gudangId) {
    dragState.value = null;
    return;
  }

  const rows = getDefaultRowsByGudang(gudangId);
  const fromIndex = dragState.value.fromIndex;
  if (
    fromIndex < 0 ||
    fromIndex >= rows.length ||
    toIndex < 0 ||
    toIndex >= rows.length
  ) {
    dragState.value = null;
    return;
  }

  const [moved] = rows.splice(fromIndex, 1);
  if (!moved) {
    dragState.value = null;
    return;
  }
  rows.splice(toIndex, 0, moved);
  rows.forEach((row, index) => {
    row.relation.sequence = index + 1;
  });

  dragState.value = null;
};

const onDefaultDragOver = (event: DragEvent) => {
  if (isReadOnly.value) return;
  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
};

const defaultRakGroups = computed(() => {
  const grouped = new Map<
    string,
    {
      gudangId: string;
      gudangName: string;
      unitBisnisName: string;
      items: SelectedRakRow[];
    }
  >();

  for (const row of selectedRakRows.value.filter(
    (item) => item.relation.is_default,
  )) {
    if (!grouped.has(row.gudangId)) {
      grouped.set(row.gudangId, {
        gudangId: row.gudangId,
        gudangName: row.gudangName,
        unitBisnisName: row.unitBisnisName,
        items: [],
      });
    }
    grouped.get(row.gudangId)!.items.push(row);
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      items: group.items.sort(compareDefaultRows),
    }))
    .sort((a, b) => a.gudangName.localeCompare(b.gudangName));
});

const selectedRakGroups = computed(() => {
  const grouped = new Map<
    string,
    {
      gudangId: string;
      gudangName: string;
      unitBisnisName: string;
      items: SelectedRakRow[];
    }
  >();

  for (const row of selectedRakRows.value) {
    if (!grouped.has(row.gudangId)) {
      grouped.set(row.gudangId, {
        gudangId: row.gudangId,
        gudangName: row.gudangName,
        unitBisnisName: row.unitBisnisName,
        items: [],
      });
    }
    grouped.get(row.gudangId)!.items.push(row);
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      items: group.items.sort((a, b) => {
        const aDefault = !!a.relation.is_default;
        const bDefault = !!b.relation.is_default;

        if (aDefault && bDefault) {
          const seqA = a.relation.sequence ?? Number.MAX_SAFE_INTEGER;
          const seqB = b.relation.sequence ?? Number.MAX_SAFE_INTEGER;
          if (seqA !== seqB) return seqA - seqB;
          return a.kode.localeCompare(b.kode);
        }

        if (aDefault !== bDefault) {
          return aDefault ? -1 : 1;
        }

        return a.kode.localeCompare(b.kode);
      }),
    }))
    .sort((a, b) => a.gudangName.localeCompare(b.gudangName));
});

// Ensure m_items_gudang entry exists whenever a gudang appears in rak selection
watch(
  () => selectedRakGroups.value.map((g) => g.gudangId),
  (newGudangIds) => {
    for (const gudangId of newGudangIds) {
      if (!values.m_items_gudangs.find((g) => g.gudang_id === gudangId)) {
        values.m_items_gudangs.push({
          gudang_id: gudangId,
          safety_stok: 0,
          stok_optimum: 0,
        });
      }
    }
  },
  { deep: true },
);

// Computed: flatten selected rak details with full hierarchy info
const selectedRakSummary = computed(() => {
  return selectedRakRows.value.map((row, index) => ({
    no: index + 1,
    unitBisnis: row.unitBisnisName,
    gudang: row.gudangName,
    rak: row.rakName,
    kode: row.kode,
    baris: row.baris,
    kolom: row.kolom,
    isDefault: !!row.relation.is_default,
    sequence: row.relation.sequence ?? "-",
  }));
});

// ============================================================================
// DETAIL METHODS - DYNAMIC GENERATION
// ============================================================================

const hasStockTransactions = ref(false);
const isCheckingStockTransactions = ref(false);
const originalConversions = ref<any[]>([]);
const activeDetailTab = ref("detailUnitKonversi");

const isConversionRowLocked = (detail: any) => {
  if (!hasStockTransactions.value) return false;
  if (isReadOnly.value) return true;
  if (detail?.id) return true;
  return originalConversions.value.some(
    (orig) => orig.id && String(orig.id) === String(detail?.id),
  );
};

const addUnitKonversi = () => {
  if (!values.m_items_conversions) values.m_items_conversions = [];
  values.m_items_conversions.push({
    uom_id: values.uom_id || "",
    qty: 0,
    uom_konversi_id: "",
  });
};

const removeUnitKonversi = (index: number) => {
  const row = values.m_items_conversions?.[index];
  if (row && isConversionRowLocked(row)) {
    toast.error(
      "Item ini sudah memiliki transaksi stok. Perubahan tidak diperbolehkan, buat saja satuan yang baru !!",
    );
    return;
  }
  if (values.m_items_conversions) {
    values.m_items_conversions.splice(index, 1);
    toast.info("Detail dihapus");
  }
};

const getUomLabelById = (id?: string) => {
  if (!id) return "-";
  const selected = uomMasterOptions.value.find(
    (item) => String(item.id) === String(id),
  );
  return selected?.value1 || "-";
};

const getConversionFormula = (detail: {
  uom_id?: string;
  qty?: number;
  uom_konversi_id?: string;
}) => {
  const uomDasar = getUomLabelById(detail?.uom_id);
  const uomKonversi = getUomLabelById(detail?.uom_konversi_id);
  const qty =
    detail?.qty === null ||
    detail?.qty === undefined ||
    Number.isNaN(Number(detail?.qty))
      ? ""
      : String(Number(detail.qty));

  if (uomDasar === "-" || uomKonversi === "-" || !qty) {
    return "-";
  }

  return `(1 ${uomDasar} = ${qty} ${uomKonversi})`;
};

// ============================================================================
// AUTO-GENERATE NAMA ITEM FROM GROUPS AND UKURAN
// ============================================================================
const groupNameCache = new Map<string, string>();

const fetchGroupName = async (
  groupId: string,
  endpoint: string,
): Promise<string> => {
  if (!groupId) return "";
  const cacheKey = `${endpoint}:${groupId}`;
  if (groupNameCache.has(cacheKey)) {
    return groupNameCache.get(cacheKey)!;
  }
  try {
    const response = await fetch(
      `${API_BASE_URL}${endpoint}?filter_column_id=${groupId}&no_pagination=true`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    const result = await response.json();
    if (result.status === "success" && result.data?.[0]) {
      const name = result.data[0].name || result.data[0].value1 || "";
      groupNameCache.set(cacheKey, name);
      return name;
    }
  } catch (e) {
    console.error("Failed to fetch group name", e);
  }
  return "";
};

const autoNameRequestId = ref(0);

watch(
  [
    () => values.kategori_id,
    () => values.group1_id,
    () => values.group2_id,
    () => values.group3_id,
    () => values.group4_id,
    () => values.group5_id,
    () => values.group6_id,
    () => values.ukuran_id,
    () => values.ukuran,
    () => values.mi_ukuran,
  ],
  async () => {
    if (isViewMode.value) return;

    const requestId = ++autoNameRequestId.value;

    const groupParts: string[] = [];

    if (values.kategori_id) {
      const name =
        getSelectedAutoNamePart(values.kategori, values.kategori_id) ||
        getAutoNamePart(await fetchGroupName(values.kategori_id, "/dynamic/m_g_category"));
      if (name) groupParts.push(name);
    }
    if (values.group1_id) {
      const name =
        getSelectedAutoNamePart(values.group1, values.group1_id) ||
        getAutoNamePart(await fetchGroupName(values.group1_id, "/dynamic/m_g1_type"));
      if (name) groupParts.push(name);
    }
    if (values.group2_id) {
      const name =
        getSelectedAutoNamePart(values.group2, values.group2_id) ||
        getAutoNamePart(await fetchGroupName(values.group2_id, "/dynamic/m_g2_material"));
      if (name) groupParts.push(name);
    }
    if (values.group3_id) {
      const name =
        getSelectedAutoNamePart(values.group3, values.group3_id) ||
        getAutoNamePart(await fetchGroupName(values.group3_id, "/dynamic/m_g3_standard"));
      if (name) groupParts.push(name);
    }
    if (values.group4_id) {
      const name =
        getSelectedAutoNamePart(values.group4, values.group4_id) ||
        getAutoNamePart(await fetchGroupName(values.group4_id, "/dynamic/m_g4_subtype"));
      if (name) groupParts.push(name);
    }
    if (values.group5_id) {
      const name =
        getSelectedAutoNamePart(values.group5, values.group5_id) ||
        getAutoNamePart(await fetchGroupName(values.group5_id, "/dynamic/m_g5_finishing"));
      if (name) groupParts.push(name);
    }
    if (values.group6_id) {
      const name =
        getSelectedAutoNamePart(values.group6, values.group6_id) ||
        getAutoNamePart(await fetchGroupName(values.group6_id, "/dynamic/m_g6_merk"));
      if (name) groupParts.push(name);
    }

    const ukuranStr =
      getAutoNamePart(values.mi_ukuran) ??
      (values.ukuran !== null && values.ukuran !== undefined
        ? getNameOnlyLabel(values.ukuran)
        : "");
    if (ukuranStr) {
      groupParts.push(ukuranStr);
    }

    if (requestId !== autoNameRequestId.value) return;

    values.nama_item = groupParts.join(" ");
  },
  { immediate: false },
);

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  selectedCompanyIds.value = [];

  Object.assign(values, {
    kode_item: "",
    nama_item: "",
    nama_spek: "",
    tipe_barang: "barang dagang",
    spesifikasi: "",

    group1_id: "",
    group2_id: "",
    group3_id: "",
    group4_id: "",
    group5_id: "",
    group6_id: "",

    tipe_id: "",
    kategori_id: "",
    company_id: "",
    uom_id: "",
    ukuran_id: "",
    ukuran: null,

    catatan: "",
    status: "DRAFT",
    is_active: true,
    is_skip: false,

    is_batch: false,
    is_potong: false,
    is_sepuh: false,
    is_import: false,
    qc_tipe: "",

    hs_code: "",
    berat_bersih: 0,
    berat_jenis: null,
    toleransi: 0,

    m_items_images: [],
    m_items_unit_bisnis: [],
    m_items_unit_bisnis_list: [],
    m_items_gudangs: [],
    m_items_raks: [],
    m_items_conversions: [],
    mi_ukuran: null,
  });

  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });
};

// ============================================================================
// LIFECYCLE HOOKS - LOAD DATA BEFORE MOUNT
// ============================================================================
onBeforeMount(async () => {
  onReset();
  await fetchCompanyMaster();
  applyCurrentUserCompanyUnit();

  const isCopyModeLocal = route.query.action === "copy" && route.query.source;
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value;

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return;
  }

  loading.value = true;
  try {
    isHydratingItemForm.value = true;
    const res = await getItemsById(sourceId);

    if (res.status !== "success") throw new Error("Gagal memuat data");
    initialValues = res.data;

    auditMeta.value = {
      created_by: initialValues.created_by,
      createdAt: initialValues.createdAt,
      updated_by: initialValues.update_by || initialValues.updated_by,
      updatedAt: initialValues.updatedAt,
    };

    if (initialValues.is_active !== undefined) {
      const v = initialValues.is_active;
      initialValues.is_active = v === true || v === 1 || v === "1";
    } else {
      initialValues.is_active = true;
    }

    // Mode copy cleanup
    if (isCopyModeLocal) {
      delete (initialValues as any).id;
      delete (initialValues as any).createdAt;
      delete (initialValues as any).updatedAt;
      initialValues.kode_item = "";
      initialValues.status = "DRAFT";
      initialValues.is_skip = false;
      initialValues.is_batch = false;
      initialValues.is_sepuh = false;
      initialValues.is_potong = false;
      initialValues.qc_tipe = "";
      if (initialValues.m_items_images) {
        initialValues.m_items_images = initialValues.m_items_images.map(
          (img: any) => ({ gambar: img.gambar }),
        );
      }
      if (initialValues.m_items_unit_bisnis) {
        initialValues.m_items_unit_bisnis =
          initialValues.m_items_unit_bisnis.map((d: any) => ({
            unit_bisnis_id: d.unit_bisnis_id,
          }));
      }
      if (initialValues.m_items_raks) {
        initialValues.m_items_raks = initialValues.m_items_raks.map(
          (d: any) => ({
            rak_d_id: d.rak_d_id,
            is_default: !!d.is_default,
            sequence:
              d.sequence === null || d.sequence === undefined
                ? null
                : Number(d.sequence),
          }),
        );
      }
      if (initialValues.m_items_conversions) {
        initialValues.m_items_conversions =
          initialValues.m_items_conversions.map((d: any) => ({
            id: isCopyModeLocal ? undefined : d.id,
            items_id: isCopyModeLocal ? undefined : d.items_id,
            uom_id: d.uom_id,
            qty: d.qty,
            uom_konversi_id: d.uom_konversi_id,
          }));
      }
      if (initialValues.m_items_gudangs) {
        initialValues.m_items_gudangs = initialValues.m_items_gudangs.map(
          (d: any) => ({
            gudang_id: d.gudang_id,
            safety_stok: d.safety_stok ?? 0,
            stok_optimum: d.stok_optimum ?? 0,
          }),
        );
      }
    }

    // Assign values
    values.kode_item = initialValues.kode_item || "";
    values.nama_item = initialValues.nama_item || "";
    values.nama_spek = initialValues.nama_spek || initialValues.nama_merk || "";
    values.tipe_barang = initialValues.tipe_barang || "barang dagang";
    values.spesifikasi = initialValues.spesifikasi || "";

    values.tipe_id = initialValues.tipe_id || "";
    values.kategori_id = getRelationId(
      initialValues,
      "kategori_id",
      "mi_kategori",
      "kategori",
      "m_g_category",
    );
    values.group1_id = getRelationId(initialValues, "group1_id", "group1", "m_g1_type");
    values.group2_id = getRelationId(initialValues, "group2_id", "group2", "m_g2_material");
    values.group3_id = getRelationId(initialValues, "group3_id", "group3", "m_g3_standard");
    values.group4_id = getRelationId(initialValues, "group4_id", "group4", "m_g4_subtype");
    values.group5_id = getRelationId(initialValues, "group5_id", "group5", "m_g5_finishing");
    values.group6_id = getRelationId(initialValues, "group6_id", "group6", "m_g6_merk");
    values.uom_id = initialValues.uom_id || "";
    values.mi_ukuran =
      getRelationRecord(initialValues, "mi_ukuran", "m_g_ukuran", "ukuran_rel") || null;
    values.ukuran_id = getRelationId(
      initialValues,
      "ukuran_id",
      "mi_ukuran",
      "m_g_ukuran",
      "ukuran_rel",
    );
    values.ukuran = getUkuranNumericValue(values.mi_ukuran) ?? getUkuranNumericValue(initialValues);

    // Assign Relations
    values.mi_tipe = initialValues.mi_tipe || null;
    selectedTipeItem.value = initialValues.mi_tipe || null;
    values.kategori = getRelationRecord(initialValues, "mi_kategori", "kategori", "m_g_category");
    values.group1 = getRelationRecord(initialValues, "group1", "m_g1_type");
    values.group2 = getRelationRecord(initialValues, "group2", "m_g2_material");
    values.group3 = getRelationRecord(initialValues, "group3", "m_g3_standard");
    values.group4 = getRelationRecord(initialValues, "group4", "m_g4_subtype");
    values.group5 = getRelationRecord(initialValues, "group5", "m_g5_finishing");
    values.group6 = getRelationRecord(initialValues, "group6", "m_g6_merk");
    values.mi_uom = initialValues.mi_uom || null;
    if (values.mi_ukuran?.id) {
      values.ukuran_id = String(values.mi_ukuran.id);
    }
    await resolveUkuranSelection(values.group3_id, values.ukuran, values.ukuran_id);

    values.hs_code = initialValues.hs_code || "";
    values.berat_bersih = Number(initialValues.berat_bersih) || 0;
    values.berat_jenis =
      initialValues.berat_jenis !== null &&
      initialValues.berat_jenis !== undefined &&
      initialValues.berat_jenis !== ""
        ? Number(initialValues.berat_jenis)
        : null;
    values.toleransi = Number(initialValues.toleransi) || 0;
    values.is_batch = !!initialValues.is_batch;
    values.is_sepuh = !!initialValues.is_sepuh;
    values.is_potong = !!initialValues.is_potong;
    values.is_import = !!initialValues.is_import;
    values.qc_tipe = initialValues.qc_tipe || "";
    values.catatan = initialValues.catatan || "";
    values.status = initialValues.status || "DRAFT";
    values.is_active = initialValues.is_active ?? true;
    values.is_skip = initialValues.is_skip ?? false;

    // Arrays
    values.m_items_images = initialValues.m_items_images || [];
    values.m_items_unit_bisnis = (initialValues.m_items_unit_bisnis || []).map(
      (ub: any) => ({
        items_id: ub.items_id,
        unit_bisnis_id: ub.unit_bisnis_id,
        company_id:
          ub.company_id ||
          ub.m_unit_bisnis?.company_id ||
          ub.unit_bisnis?.company_id ||
          null,
      }),
    );
    values.m_items_unit_bisnis_list = initialValues.m_items_unit_bisnis || [];

    const extractedCompanyIds = new Set<string>();
    if (initialValues.company_id) {
      extractedCompanyIds.add(String(initialValues.company_id));
    }
    for (const ub of values.m_items_unit_bisnis) {
      const cId = ub.company_id || getCompanyIdForUnit(ub.unit_bisnis_id || "");
      if (cId) {
        extractedCompanyIds.add(String(cId));
      }
    }
    selectedCompanyIds.value = Array.from(extractedCompanyIds);
    values.company_id = selectedCompanyIds.value[0] || "";
    values.mi_company = initialValues.mi_company || null;
    if (isCopyModeLocal) {
      applyCurrentUserCompanyUnit();
    }
    values.m_items_gudangs = initialValues.m_items_gudangs || [];
    values.m_items_raks = normalizeItemRakDetails(
      initialValues.m_items_raks || [],
    );
    normalizeAllDefaultSequences();
    values.m_items_conversions = initialValues.m_items_conversions || [];
    originalConversions.value = JSON.parse(
      JSON.stringify(values.m_items_conversions),
    );

    if (isCopyModeLocal) {
      hasStockTransactions.value = false;
      toast.success("Data berhasil disalin", {
        description: "Silakan edit dan simpan sebagai Items baru",
      });
    } else {
      toast.success("Data berhasil dimuat");
      if (!isCopyModeLocal && sourceId) {
        await loadItemLogs(sourceId);
        isCheckingStockTransactions.value = true;
        try {
          hasStockTransactions.value =
            await checkItemHasStockTransactions(sourceId);
        } catch (e) {
          console.error("Gagal mengecek histori transaksi stok:", e);
        } finally {
          isCheckingStockTransactions.value = false;
        }
      }
    }
    await nextTick();
  } catch (error) {
    toast.error("Gagal memuat data Items", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
      action: {
        label: "Kembali",
        onClick: () => router.push("/inventory/master/m_items"),
      },
    });
    setTimeout(() => router.push("/inventory/master/m_items"), 2000);
  } finally {
    isHydratingItemForm.value = false;
    loading.value = false;
  }
});

// ============================================================================
// LOAD UNIT BISNIS DEFAULTS (CREATE MODE ONLY)
// ============================================================================

onMounted(async () => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_general?no_pagination=true&filter_column_is_active=true&filter_column_group=UOM`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    const result = await response.json();
    if (result.status === "success" && Array.isArray(result.data)) {
      uomMasterOptions.value = result.data;
    }
  } catch (e) {
    console.error("Failed to load UoM master", e);
  }
});

onMounted(async () => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_unit_bisnis?no_pagination=true&filter_column_is_active=true&include=m_gudang>m_rak>m_rak_d`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    const result = await response.json();
    if (result.status === "success" && Array.isArray(result.data)) {
      unitBisnisNestedData.value = result.data.map((ub: any) => {
        let rawGudangs = ub.m_gudangs || ub.m_gudang;
        if (!Array.isArray(rawGudangs)) {
          rawGudangs = rawGudangs ? [rawGudangs] : [];
        }

        return {
          id: ub.id,
          company_id: ub.company_id || null,
          nama_comp: ub.nama_comp,
          m_gudangs: rawGudangs.map((g: any) => {
            let rawRaks = g.m_raks || g.m_rak;
            if (!Array.isArray(rawRaks)) {
              rawRaks = rawRaks ? [rawRaks] : [];
            }

            return {
              id: g.id,
              nama_gudang: g.nama_gudang,
              m_raks: rawRaks.map((r: any) => {
                let rawDetails = r.m_rak_ds || r.m_rak_d;
                if (!Array.isArray(rawDetails)) {
                  rawDetails = rawDetails ? [rawDetails] : [];
                }

                return {
                  id: r.id,
                  nama_rak: r.nama_rak,
                  m_rak_ds: rawDetails.map((rd: any) => ({
                    id: rd.id,
                    kode: rd.kode,
                    kolom: rd.kolom,
                    baris: rd.baris,
                  })),
                };
              }),
            };
          }),
        };
      });
      if (!isSuperAdmin.value) {
        applyCurrentUserCompanyUnit();
      } else if (isEditMode.value || isViewMode.value) {
        const currentSet = new Set(selectedCompanyIds.value);
        for (const ub of values.m_items_unit_bisnis || []) {
          const cId = ub.company_id || getCompanyIdForUnit(ub.unit_bisnis_id || "");
          if (cId) {
            ub.company_id = cId;
            currentSet.add(cId);
          }
        }
        selectedCompanyIds.value = Array.from(currentSet);
      } else if (selectedCompanyIds.value.length > 0 && values.m_items_unit_bisnis.length === 0) {
        handleCompanyChange(selectedCompanyIds.value);
      }
    }
  } catch (e) {
    console.error("Failed to load nested unit bisnis options", e);
  }
});

onMounted(async () => {
  if (companyMasterList.value.length === 0) {
    await fetchCompanyMaster();
  }
});

// Errors object (manual validation)
const errors = reactive({
  company: "",
  unit_bisnis: "",
  nama_item: "",
  tipe_item: "",
  kategori: "",
  group1: "",
  group2: "",
  group3: "",
  group4: "",
  group5: "",
  group6: "",
  uom: "",
  uomKonversi: "",
  qty: "",
  safety_stock: "",
  optimum_stock: "",
  berat_bersih: "",
  berat_jenis: "",
  toleransi: "",
  ukuran: "",
  catatan: "",
  hs_code: "",
});

// Per-gudang stok validation errors
const gudangStokErrors = ref<
  Record<string, { safety_stok: string; stok_optimum: string }>
>({});

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async (targetStatus: string) => {
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });
  let invalid = false;

  // 1. Company & Unit Bisnis
  if (isSuperAdmin.value && selectedCompanyIds.value.length === 0) {
    errors.company = "Company wajib dipilih";
    invalid = true;
  }
  if (!values.m_items_unit_bisnis || values.m_items_unit_bisnis.length === 0) {
    errors.unit_bisnis = "Unit Bisnis wajib dipilih";
    invalid = true;
  }

  // 2. Nama Item
  if (!values.nama_item?.trim()) {
    errors.nama_item = "Nama item wajib diisi";
    invalid = true;
  }

  // 3. Tipe Item
  if (!values.tipe_id?.trim()) {
    errors.tipe_item = "Tipe item wajib dipilih";
    invalid = true;
  }

  // 4. Kategori
  if (!values.kategori_id?.trim()) {
    errors.kategori = "Kategori wajib dipilih";
    invalid = true;
  }

  // 5. Group 1
  if (!values.group1_id?.trim()) {
    errors.group1 = "Group 1 wajib dipilih";
    invalid = true;
  }

  // Group 2, Group 3, Ukuran: Hanya wajib jika bukan JASA
  if (!isTipeJasa.value) {
    if (!values.group2_id?.trim()) {
      errors.group2 = "Group 2 wajib dipilih";
      invalid = true;
    }
    if (!values.group3_id?.trim()) {
      errors.group3 = "Group 3 wajib dipilih";
      invalid = true;
    }
    if (!values.ukuran_id?.trim()) {
      errors.ukuran = "Ukuran wajib dipilih";
      invalid = true;
    }
  }

  if (values.berat_bersih !== null && Number(values.berat_bersih) < 0) {
    errors.berat_bersih = "Berat bersih tidak boleh negatif";
    invalid = true;
  }

  if (values.berat_jenis !== null && Number(values.berat_jenis) < 0) {
    errors.berat_jenis = "Berat jenis tidak boleh negatif";
    invalid = true;
  }

  // HS Code wajib jika Is Import aktif
  if (values.is_import && !values.hs_code?.trim()) {
    errors.hs_code = "HS Code wajib diisi jika Is Import aktif";
    invalid = true;
  }

  gudangStokErrors.value = {};
  for (const g of values.m_items_gudangs) {
    const entry: { safety_stok: string; stok_optimum: string } = {
      safety_stok: "",
      stok_optimum: "",
    };
    if (!g.safety_stok || g.safety_stok <= 0) {
      entry.safety_stok = "Safety stok harus lebih dari 0";
      invalid = true;
    }
    if (!g.stok_optimum || g.stok_optimum <= 0) {
      entry.stok_optimum = "Stok optimum harus lebih dari 0";
      invalid = true;
    }
    if (entry.safety_stok || entry.stok_optimum) {
      gudangStokErrors.value[g.gudang_id] = entry;
    }
  }

  // 6. UOM
  if (!values.uom_id?.trim()) {
    errors.uom = "UoM wajib dipilih";
    invalid = true;
  }

  if (invalid) {
    toast.error("Validasi gagal", {
      description: "Mohon lengkapi semua field yang wajib diisi",
    });
    return;
  }

  targetSaveStatus.value = targetStatus;
  loading.value = true;
  try {
    if (isTipeJasa.value) {
      // Untuk tipe JASA, lewati validasi duplikasi kombinasi Group & Ukuran
      await performSave(targetSaveStatus.value);
      return;
    }
    const normalizedUkuranValue =
      values.ukuran !== null && values.ukuran !== undefined
        ? Number(values.ukuran)
        : getUkuranNumericValue(values.mi_ukuran);

    const validatePayload = {
      tipe_id: values.tipe_id || "",
      kategori_id: values.kategori_id || "",
      group1: values.group1_id || "",
      group2: values.group2_id || "",
      group3: values.group3_id || "",
      group4: values.group4_id || undefined,
      group5: values.group5_id || undefined,
      group6: values.group6_id || undefined,
      ukuran:
        normalizedUkuranValue !== null && normalizedUkuranValue !== undefined
          ? String(normalizedUkuranValue)
          : "",
      exclude_id: isEditMode.value ? menuId.value : undefined,
    };

    const validateRes = await validateItemName(validatePayload);

    if ((validateRes as any).success && validateRes.data) {
      generatedNamaItem.value = validateRes.data.nama_item || "";

      if (!validateRes.data.valid || validateRes.data.counts.partial > 0) {
        duplicateExactMatches.value = await hydrateDuplicateMatchItems(
          validateRes.data.exact_matches || [],
        );
        duplicatePartialMatches.value = await hydrateDuplicateMatchItems(
          validateRes.data.partial_matches || [],
        );
        isDuplicateModalOpen.value = true;
        loading.value = false;
        return;
      }
    }

    if ((validateRes as any).success === false) {
      const validateMessage = String((validateRes as any).message || "");
      if (validateMessage.includes("ID m_general tidak valid")) {
        toast.info("Validasi custom lama dilewati", {
          description:
            "Group item sekarang memakai master baru, jadi validasi lama m_general dilewati.",
        });
        await performSave(targetSaveStatus.value);
        return;
      }
    }

    await performSave(targetSaveStatus.value);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes("ID m_general tidak valid")) {
      toast.info("Validasi custom lama dilewati", {
        description:
          "Group item sekarang memakai master baru, jadi data tetap disimpan.",
      });
      await performSave(targetSaveStatus.value);
      return;
    }
    loading.value = false;
    toast.error("Gagal melakukan pengecekan duplikasi", {
      description: errorMessage,
    });
  }
};

const handleContinueSave = async () => {
  isDuplicateModalOpen.value = false;
  await performSave(targetSaveStatus.value);
};

const performSave = async (targetStatus: string) => {
  loading.value = true;
  try {
    // Form Guard: Proteksi Unit Konversi jika item sudah memiliki transaksi stok
    if (hasStockTransactions.value && originalConversions.value.length > 0) {
      for (const orig of originalConversions.value) {
        if (!orig.id) continue;
        const current = (values.m_items_conversions || []).find(
          (c) => String(c.id || "") === String(orig.id),
        );
        if (
          !current ||
          String(current.uom_id || "") !== String(orig.uom_id || "") ||
          Number(current.qty || 0) !== Number(orig.qty || 0) ||
          String(current.uom_konversi_id || "") !==
            String(orig.uom_konversi_id || "")
        ) {
          toast.error(
            "Item ini sudah memiliki transaksi stok. Perubahan tidak diperbolehkan, buat saja satuan yang baru !!",
          );
          activeDetailTab.value = "detailUnitKonversi";
          loading.value = false;
          return;
        }
      }
    }

    values.m_items_raks = normalizeItemRakDetails(values.m_items_raks || []);
    normalizeAllDefaultSequences();
    const normalizedUkuranId = values.ukuran_id?.trim() || values.mi_ukuran?.id || "";
    const normalizedUkuranValue =
      values.ukuran !== null && values.ukuran !== undefined
        ? Number(values.ukuran)
        : getUkuranNumericValue(values.mi_ukuran);

    const userId = authStore.user?.id || "";

    const payload: any = {
      group3_id: values.group3_id || null,
      group4_id: values.group4_id || null,
      group5_id: values.group5_id || null,
      group6_id: values.group6_id || null,
      ukuran_id: normalizedUkuranId || null,
      uom_id: values.uom_id || null,
      is_active: values.is_active,

      toleransi: values.toleransi,

      is_batch: values.is_batch || false,
      is_sepuh: values.is_sepuh || false,
      is_potong: values.is_potong || false,
      is_import: values.is_import || false,
      qc_tipe: values.qc_tipe || "",

      tipe_id: values.tipe_id || null,
      kategori_id: values.kategori_id || null,
      group1_id: values.group1_id || null,
      group2_id: values.group2_id || null,

      kode_item: values.kode_item?.trim() || null,
      nama_item: values.nama_item?.trim() || null,
      nama_spek: values.nama_spek?.trim() || null,
      berat_bersih: values.berat_bersih !== null && String(values.berat_bersih) !== "" ? Number(values.berat_bersih) : null,
      berat_jenis: values.berat_jenis !== null && String(values.berat_jenis) !== "" ? Number(values.berat_jenis) : null,
      catatan: values.catatan?.trim() || null,
      hs_code: values.hs_code?.trim() || null,
      ukuran: normalizedUkuranValue,

      // Details
      m_items_images: isEditMode.value
        ? (values.m_items_images || []).map((img) => ({
            ...((img as any).id && { id: (img as any).id }),
            ...(img.m_items_id && { m_items_id: img.m_items_id }),
            gambar: img.gambar,
          }))
        : (values.m_items_images || []).map((img) => ({ gambar: img.gambar })),

      m_items_unit_bisnis: (values.m_items_unit_bisnis || []).map((d) => ({
        unit_bisnis_id: d.unit_bisnis_id,
        company_id: d.company_id || getCompanyIdForUnit(d.unit_bisnis_id || "") || null,
      })),

      m_items_gudang: (values.m_items_gudangs || []).map((d) => ({
        ...(d.id && { id: d.id }),
        gudang_id: d.gudang_id,
        safety_stok: d.safety_stok ?? 0,
        stok_optimum: d.stok_optimum ?? 0,
      })),

      m_items_raks: (values.m_items_raks || []).map((d) => ({
        ...(d.id && { id: d.id }),
        rak_d_id: d.rak_d_id,
        is_default: !!d.is_default,
        sequence: d.is_default ? Number(d.sequence || 0) || 1 : null,
      })),

      m_items_conversions: (values.m_items_conversions || []).map((d) => ({
        ...(d.id && { id: d.id }),
        uom_id: d.uom_id,
        qty: d.qty,
        uom_konversi_id: d.uom_konversi_id,
      })),
    };

    payload.status = targetStatus;

    if (isEditMode.value) {
      payload.updated_by = userId;
      await updateItems(menuId.value, payload);
      toast.success("Items berhasil diperbarui", {
        description: `Item "${values.nama_item}" telah diperbarui`,
      });
    } else {
      payload.created_by = userId;
      payload.updated_by = userId;
      await createItems(payload);
      toast.success("Items berhasil dibuat", {
        description: `Item \"${values.nama_item}\" telah ditambahkan`,
      });
    }

    setTimeout(() => {
      router.replace("/inventory/master/m_items?reload=" + Date.now());
    }, 1000);
  } catch (error) {
    toast.error(
      isEditMode.value ? "Gagal memperbarui Items" : "Gagal membuat Items",
      {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      },
    );
  } finally {
    loading.value = false;
  }
};

watch(
  () => initialValues,
  (val) => {
    if (val && val.m_items_unit_bisnis) {
      values.m_items_unit_bisnis = val.m_items_unit_bisnis;
    }
  },
  { deep: true },
);

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push("/inventory/master/m_items");
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
          <CardTitle>Informasi Items</CardTitle>
          <CardDescription>
            Isi data Items dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">

            <!-- ============================================================ -->
            <!-- COMPANY — MultiSelect filter Unit Bisnis terkait             -->
            <!-- ============================================================ -->
            <FieldMultiSelect
              id="company_ids"
              label="Company"
              v-model="selectedCompanyIds"
              @change="handleCompanyChange"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_company`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  selectfield: 'id,kode,nama',
                  searchfield: 'kode,nama',
                },
              }"
              :options="getCompanyOptions"
              displayField="nama"
              valueField="id"
              :disabled="loading || isCompanyUnitReadonly"
              :readonly="isCompanyUnitReadonly"
              :required="isSuperAdmin && !isCompanyUnitReadonly"
              :errorText="errors.company ? 'failed' : ''"
              :hints="errors.company || (isEditMode ? 'Company tidak dapat diubah setelah item dibuat' : isViewMode ? '' : isSuperAdmin ? 'Pilih company untuk memfilter unit bisnis' : 'Company otomatis dari user login')"
              placeholder="Pilih company"
              class="w-full lg:col-span-6"
            />

            <!-- ============================================================ -->
            <!-- UNIT BISNIS — readonly saat Edit Mode & View Mode            -->
            <!-- ============================================================ -->
            <FieldMultiSelect
              id="unit_bisnis_ids"
              label="Unit Bisnis"
              v-model="unit_bisnis_ids_computed"
              :options="getUnitBisnisOptions"
              displayField="nama_comp"
              valueField="id"
              :required="isSuperAdmin && !isUnitBisnisReadonly"
              :disabled="loading || isCompanyUnitReadonly"
              :readonly="isCompanyUnitReadonly"
              :errorText="errors.unit_bisnis ? 'failed' : ''"
              :hints="errors.unit_bisnis || (isEditMode ? 'Unit Bisnis tidak dapat diubah setelah item dibuat' : isViewMode ? '' : isSuperAdmin ? 'Pilih unit bisnis' : 'Unit bisnis otomatis dari user login')"
              placeholder="Pilih unit bisnis"
              class="w-full lg:col-span-6"
            />

            <!-- Kode Item Field (Auto-generated, readonly) -->
            <FieldX
              id="kode_item"
              label="Kode Item"
              :value="values.kode_item"
              @input="(v) => (values.kode_item = v)"
              :errorname="''"
              :hints="'Auto-generated by system'"
              :required="false"
              :disabled="true"
              :readonly="true"
              placeholder="Auto-generated"
              class="w-full lg:col-span-6"
            />

            <!-- Nama Item Field (Required, auto-generated from groups) -->
            <FieldX
              id="nama_item"
              label="Nama Item"
              :value="values.nama_item"
              @input="(v) => (values.nama_item = v)"
              :errorname="errors.nama_item ? 'failed' : ''"
              :hints="errors.nama_item"
              :required="!isReadOnly"
              :disabled="true"
              :readonly="true"
              placeholder="Contoh: Baut M10x20"
              class="w-full lg:col-span-6"
            />

            <!-- Spek (Optional) -->
            <FieldX
              id="nama_spek"
              label="Spek"
              :value="values.nama_spek"
              @input="(v) => (values.nama_spek = v)"
              :errorname="''"
              :hints="'Opsional, untuk menyimpan spesifikasi item'"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Contoh: Grade A"
              class="w-full lg:col-span-6"
            />

            <!-- HS Code (Mandatory jika Is Import aktif) -->
            <FieldX
              id="hs_code"
              label="HS Code"
              :value="values.hs_code"
              @input="(v) => { values.hs_code = v; if (v) errors.hs_code = ''; }"
              :errorname="errors.hs_code ? 'failed' : ''"
              :hints="errors.hs_code || (values.is_import ? 'Wajib diisi karena Is Import aktif' : '')"
              :required="!!values.is_import && !isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Contoh: 123456789"
              class="w-full lg:col-span-6"
            />

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:col-span-12">
              <!-- Tipe Item (Required) -->
              <FieldX
                v-if="isReadOnly"
                id="tipe_id_view"
                label="Tipe Item"
                :value="values.mi_tipe?.value1 || '-'"
                :readonly="true"
                :disabled="true"
                :required="false"
                class="w-full"
              />
              <FieldSelect
                v-else
                id="tipe_id"
                label="Tipe Item"
                :value="values.tipe_id"
                @input="handleTipeItemChange"
                @update:valueFull="handleTipeItemValueFull"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_general`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    searchfield: 'value1',
                    filter_column_group: 'TIPE_ITEM',
                    filter_column_is_active: 'true',
                    no_pagination: 'true',
                  },
                }"
                displayField="value1"
                valueField="id"
                :errorText="errors.tipe_item ? 'failed' : ''"
                :hints="errors.tipe_item || 'Tipe item'"
                :required="!isReadOnly"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="Pilih tipe item"
                class="w-full"
              />

              <!-- QC Tipe -->
              <FieldSelect
                id="qc_tipe"
                label="QC Tipe"
                :value="values.qc_tipe"
                @input="(v: string) => (values.qc_tipe = v)"
                :options="[
                  { value: 'None', label: 'None' },
                  { value: 'Sampling', label: 'Sampling' },
                  { value: 'Full', label: 'Full' },
                ]"
                displayField="label"
                valueField="value"
                :clearable="false"
                :required="false"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="Pilih QC Tipe"
                class="w-full"
              />
            </div>
          </div>

          <!-- Kategori, Group 1, Group 2, Group 3 -->
          <div class="grid grid-cols-1 gap-4 md:grid-cols-4 lg:col-span-12">
            <!-- Kategori (required) -->
            <FieldX
              v-if="isReadOnly"
              id="kategori_id_view"
              label="Kategori"
              :value="formatCodeNameLabel(values.kategori)"
              :readonly="true"
              :disabled="true"
              :required="false"
              class="w-full"
            />
            <FieldSelect
              v-else
              id="kategori_id"
              label="Kategori"
              :value="values.kategori_id"
              @input="(v) => { values.kategori_id = v; if (v) errors.kategori = ''; }"
              @update:valueFull="(v) => (values.kategori = v)"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_g_category`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'code,name,catatan',
                  filter_column_status: 'POST',
                  filter_column_is_active: 'true',
                  no_pagination: 'true',
                },
                onsuccess: mapCodeNameOptions,
              }"
              displayField="display_name"
              valueField="id"
              :errorText="errors.kategori ? 'failed' : ''"
              :hints="errors.kategori"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih kategori"
              class="w-full"
            />

            <!-- Group 1 (Required) -->
            <FieldX
              v-if="isReadOnly"
              id="group1_id_view"
              label="Group Item 1"
              :value="formatCodeNameLabel(values.group1)"
              :readonly="true"
              :disabled="true"
              :required="false"
              class="w-full"
            />
            <FieldSelect
              v-else
              :key="`group1-${values.kategori_id}`"
              id="group1_id"
              label="Group Item 1"
              :value="values.group1_id"
              @input="(v) => { values.group1_id = v; if (v) errors.group1 = ''; }"
              @update:valueFull="(v) => (values.group1 = v)"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_g1_type`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'code,name,catatan',
                  filter_column_status: 'POST',
                  filter_column_is_active: 'true',
                  no_pagination: 'true',
                  ...(values.kategori_id ? { where_category_id: values.kategori_id } : {}),
                },
                onsuccess: mapCodeNameOptions,
              }"
              displayField="display_name"
              valueField="id"
              :errorText="errors.group1 ? 'failed' : ''"
              :hints="errors.group1"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || !values.kategori_id"
              :readonly="isReadOnly"
              placeholder="Pilih group 1"
              class="w-full"
            />

            <!-- Group 2 (Required except JASA) -->
            <FieldX
              v-if="isReadOnly"
              id="group2_id_view"
              label="Group Item 2"
              :value="formatCodeNameLabel(values.group2)"
              :readonly="true"
              :disabled="true"
              :required="false"
              class="w-full"
            />
            <FieldSelect
              v-else
              :key="`group2-${values.group1_id}`"
              id="group2_id"
              label="Group Item 2"
              :value="values.group2_id"
              @input="(v) => { values.group2_id = v; if (v) errors.group2 = ''; }"
              @update:valueFull="(v) => (values.group2 = v)"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_g2_material`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'code,name,catatan',
                  filter_column_status: 'POST',
                  filter_column_is_active: 'true',
                  no_pagination: 'true',
                  ...(values.group1_id ? { where_g1_type_id: values.group1_id } : {}),
                },
                onsuccess: mapCodeNameOptions,
              }"
              displayField="display_name"
              valueField="id"
              :errorText="errors.group2 ? 'failed' : ''"
              :hints="errors.group2 || (isTipeJasa ? 'Opsional untuk tipe Jasa' : '')"
              :required="!isTipeJasa && !isReadOnly"
              :disabled="loading || isReadOnly || !values.group1_id"
              :readonly="isReadOnly"
              placeholder="Pilih group 2"
              class="w-full"
            />

            <!-- Group 3 (Required except JASA) -->
            <FieldX
              v-if="isReadOnly"
              id="group3_id_view"
              label="Group Item 3"
              :value="formatCodeNameLabel(values.group3)"
              :readonly="true"
              :disabled="true"
              :required="false"
              class="w-full"
            />
            <FieldSelect
              v-else
              :key="`group3-${values.group2_id}`"
              id="group3_id"
              label="Group Item 3"
              :value="values.group3_id"
              @input="(v) => { values.group3_id = v; if (v) errors.group3 = ''; }"
              @update:valueFull="(v) => (values.group3 = v)"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_g3_standard`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'code,name,catatan',
                  filter_column_status: 'POST',
                  filter_column_is_active: 'true',
                  no_pagination: 'true',
                  ...(values.group2_id ? { where_g2_type_id: values.group2_id } : {}),
                },
                onsuccess: mapCodeNameOptions,
              }"
              displayField="display_name"
              valueField="id"
              :errorText="errors.group3 ? 'failed' : ''"
              :hints="errors.group3 || (isTipeJasa ? 'Opsional untuk tipe Jasa' : '')"
              :required="!isTipeJasa && !isReadOnly"
              :disabled="loading || isReadOnly || !values.group2_id"
              :readonly="isReadOnly"
              placeholder="Pilih group 3"
              class="w-full"
            />
          </div>

          <!-- Group 4, Group 5, Group 6, Ukuran -->
          <div class="grid grid-cols-1 gap-4 md:grid-cols-4 lg:col-span-12">
            <!-- Group 4 (Optional) -->
            <FieldX
              v-if="isReadOnly"
              id="group4_id_view"
              label="Group Item 4"
              :value="formatCodeNameLabel(values.group4)"
              :readonly="true"
              :disabled="true"
              :required="false"
              class="w-full"
            />
            <FieldSelect
              v-else
              :key="`group4-${values.group3_id}`"
              id="group4_id"
              label="Group Item 4"
              :value="values.group4_id"
              @input="(v) => (values.group4_id = v)"
              @update:valueFull="(v) => (values.group4 = v)"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_g4_subtype`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'code,name,catatan',
                  filter_column_status: 'POST',
                  filter_column_is_active: 'true',
                  no_pagination: 'true',
                  ...(values.group3_id ? { where_g3_standard_id: values.group3_id } : {}),
                },
                onsuccess: mapCodeNameOptions,
              }"
              displayField="display_name"
              valueField="id"
              :errorText="errors.group4 ? 'failed' : ''"
              :hints="errors.group4 || (isTipeJasa ? 'Opsional untuk tipe Jasa' : '')"
              :required="false"
              :disabled="loading || isReadOnly || !values.group3_id"
              :readonly="isReadOnly"
              placeholder="Pilih group 4"
              class="w-full"
            />

            <!-- Group 5 (Optional) -->
            <FieldX
              v-if="isReadOnly"
              id="group5_id_view"
              label="Group Item 5"
              :value="formatCodeNameLabel(values.group5)"
              :readonly="true"
              :disabled="true"
              :required="false"
              class="w-full"
            />
            <FieldSelect
              v-else
              :key="`group5-${values.group4_id}`"
              id="group5_id"
              label="Group Item 5"
              :value="values.group5_id"
              @input="(v) => (values.group5_id = v)"
              @update:valueFull="(v) => (values.group5 = v)"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_g5_finishing`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'code,name,catatan',
                  filter_column_status: 'POST',
                  filter_column_is_active: 'true',
                  no_pagination: 'true',
                  ...(values.group4_id ? { where_g4_subtype_id: values.group4_id } : {}),
                },
                onsuccess: mapCodeNameOptions,
              }"
              displayField="display_name"
              valueField="id"
              :errorText="errors.group5 ? 'failed' : ''"
              :hints="errors.group5 || (isTipeJasa ? 'Opsional untuk tipe Jasa' : '')"
              :required="false"
              :disabled="loading || isReadOnly || !values.group4_id"
              :readonly="isReadOnly"
              placeholder="Pilih group 5"
              class="w-full"
            />

            <!-- Group 6 (Optional) -->
            <FieldX
              v-if="isReadOnly"
              id="group6_id_view"
              label="Group Item 6"
              :value="formatCodeNameLabel(values.group6)"
              :readonly="true"
              :disabled="true"
              :required="false"
              class="w-full"
            />
            <FieldSelect
              v-else
              :key="`group6-${values.group5_id}`"
              id="group6_id"
              label="Group Item 6"
              :value="values.group6_id"
              @input="(v) => (values.group6_id = v)"
              @update:valueFull="(v) => (values.group6 = v)"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_g6_merk`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'code,name,catatan',
                  filter_column_status: 'POST',
                  filter_column_is_active: 'true',
                  no_pagination: 'true',
                  ...(values.group5_id ? { where_g5_finishing_id: values.group5_id } : {}),
                },
                onsuccess: mapCodeNameOptions,
              }"
              displayField="display_name"
              valueField="id"
              :errorText="errors.group6 ? 'failed' : ''"
              :hints="errors.group6 || (isTipeJasa ? 'Opsional untuk tipe Jasa' : '')"
              :required="false"
              :disabled="loading || isReadOnly || !values.group5_id"
              :readonly="isReadOnly"
              placeholder="Pilih group 6"
              class="w-full"
            />

            <!-- Ukuran (Wajib kecuali JASA) -->
            <FieldX
              v-if="isReadOnly"
              id="ukuran_view"
              label="Ukuran"
              :value="formatPanjangNameLabel(values.mi_ukuran) || formatUkuranDisplay(values)"
              :readonly="true"
              :disabled="true"
              :required="!isTipeJasa && !isReadOnly"
              class="w-full"
            />
            <FieldSelect
              v-else
              :key="`ukuran-${values.group3_id}`"
              id="ukuran"
              label="Ukuran"
              :value="values.ukuran_id || ''"
              @input="handleUkuranChange"
              @update:valueFull="handleUkuranValueFull"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_g_ukuran`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'code,name,catatan',
                  filter_column_status: 'POST',
                  filter_column_is_active: 'true',
                  no_pagination: 'true',
                  ...(values.group3_id ? { where_g3_standard_id: values.group3_id } : {}),
                },
                onsuccess: mapUkuranOptions,
              }"
              displayField="display_name"
              valueField="id"
              :errorText="errors.ukuran ? 'failed' : ''"
              :hints="errors.ukuran || (isTipeJasa ? 'Opsional untuk tipe Jasa' : '')"
              :required="!isTipeJasa && !isReadOnly"
              :disabled="loading || isReadOnly || !values.group3_id"
              :readonly="isReadOnly"
              placeholder="Pilih ukuran"
              class="w-full"
            />
          </div>

          <div
            class="grid grid-cols-1 gap-4 md:grid-cols-4 lg:col-span-12"
          >
            <!-- Berat Bersih(Kg) (Optional) -->
            <FieldNumber
              id="berat_bersih"
              label="Berat Bersih(Kg)"
              :value="values.berat_bersih"
              @input="(v) => (values.berat_bersih = v !== '' ? Number(v) : null)"
              type="decimal"
              :min="0"
              :use-grouping="false"
              :errorname="errors.berat_bersih ? 'failed' : ''"
              :hints="errors.berat_bersih"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="0"
              class="w-full"
            />
            <!-- Berat Jenis (Decimal) - Dibuka untuk semua tipe item -->
            <FieldNumber
              id="berat_jenis"
              label="Berat Jenis"
              :value="values.berat_jenis"
              @input="(v) => (values.berat_jenis = v !== '' && v !== null && v !== undefined ? Number(v) : null)"
              type="decimal"
              :min="0"
              :use-grouping="false"
              :errorname="errors.berat_jenis ? 'failed' : ''"
              :hints="errors.berat_jenis || 'Berat jenis (Specific Gravity)'"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="0"
              class="w-full"
            />
            <!-- UoM (Required) -->
            <FieldX
              v-if="isReadOnly"
              id="uom_id_view"
              label="UoM"
              :value="values.mi_uom?.value1 || '-'"
              :readonly="true"
              :disabled="true"
              :required="false"
              class="w-full"
            />
            <FieldSelect
              v-else
              id="uom_id"
              label="UoM"
              :value="values.uom_id"
              @input="(v) => { values.uom_id = v; if (v) errors.uom = ''; }"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'value1',
                  filter_column_is_active: 'true',
                  filter_column_group: 'UOM',
                  no_pagination: 'true',
                },
              }"
              displayField="value1"
              valueField="id"
              :errorText="errors.uom ? 'failed' : ''"
              :hints="errors.uom"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih UoM"
              class="w-full"
            />
            <!-- Toleransi(%) (Optional) -->
            <FieldNumber
              id="toleransi"
              label="Toleransi(%)"
              :value="values.toleransi"
              @input="(v) => (values.toleransi = Number(v))"
              :min="0"
              :errorname="errors.toleransi ? 'failed' : ''"
              :hints="errors.toleransi"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="0"
              class="w-full"
            />
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:col-span-12">
            <!-- Catatan (Optional, Textarea) -->
            <FieldX
              id="catatan"
              type="textarea"
              label="Catatan"
              :value="values.catatan"
              @input="(v) => (values.catatan = v)"
              :errorname="errors.catatan ? 'failed' : ''"
              :hints="errors.catatan"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Masukkan catatan"
              :rows="4"
              class="w-full"
            />

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div class="sm:col-span-2">
                <FieldMultiUpload
                  id="m_items_images"
                  label="Gambar Item"
                  :value="values.m_items_images"
                  @input="(v) => (values.m_items_images = v)"
                  :hints="'.jpg, .png, max 5MB per gambar'"
                  :required="false"
                  :disabled="loading || isReadOnly"
                  :readonly="isReadOnly"
                  accept="image/*"
                  :maxImages="10"
                  class="w-full"
                />
              </div>

              <FieldStatus
                label="Is Batch"
                name="is_batch"
                v-model="values.is_batch"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                class="w-full"
              />

              <FieldStatus
                label="Is Sepuh"
                name="is_sepuh"
                v-model="values.is_sepuh"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                class="w-full"
              />

              <FieldStatus
                label="Is Potong"
                name="is_potong"
                v-model="values.is_potong"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                class="w-full"
              />

              <FieldStatus
                label="Is Import"
                name="is_import"
                v-model="values.is_import"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
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
                class="w-full sm:col-span-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- DETAIL TABS -->
      <Tabs v-model="activeDetailTab" default-value="detailUnitKonversi" class="w-full">
        <TabsList class="w-full overflow-x-auto flex justify-start scrollbar-hide">
          <TabsTrigger value="detailUnitKonversi">Unit Konversi</TabsTrigger>
          <TabsTrigger value="rak">Rak</TabsTrigger>
          <TabsTrigger value="detailLog">Log</TabsTrigger>
        </TabsList>

        <!-- TAB CONTENT: Unit Konversi -->
        <TabsContent value="detailUnitKonversi" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Unit Konversi</CardTitle>
                  <CardDescription>Kelola konversi unit item</CardDescription>
                </div>
                <Button
                  v-if="!isReadOnly"
                  @click="addUnitKonversi"
                  size="sm"
                  variant="outline"
                >
                  + Tambah
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <!-- Warning Banner Transaksi Stok -->
              <div
                v-if="hasStockTransactions && (values.m_items_conversions || []).length > 0"
                class="mb-4 rounded-lg border-2 border-amber-500/60 bg-amber-50 dark:bg-amber-950/30 p-4 shadow-sm"
              >
                <div class="flex items-start gap-3">
                  <AlertTriangle class="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div class="space-y-1">
                    <h4 class="font-bold text-amber-900 dark:text-amber-200 text-sm md:text-base">
                      Peringatan: Transaksi Stok Terdeteksi
                    </h4>
                    <p class="text-amber-800 dark:text-amber-300 text-xs md:text-sm font-medium">
                      Item ini sudah memiliki transaksi stok. Perubahan tidak diperbolehkan, buat saja satuan yang baru !!
                    </p>
                  </div>
                </div>
              </div>

              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">No</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">UoM Dasar</th>
                      <th class="px-3 py-2 text-center font-medium text-xs sm:text-sm">Qty</th>
                      <th class="px-2 py-2 text-center font-medium text-xs sm:text-sm">UoM Konversi</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Formula</th>
                      <th v-if="!isReadOnly" class="px-2 py-2 text-center font-medium text-xs sm:text-sm">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="(values.m_items_conversions || []).length === 0">
                      <td
                        :colspan="isReadOnly ? 5 : 6"
                        class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                      >
                        Belum ada detail ditambahkan
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, index) in values.m_items_conversions"
                      :key="index"
                      class="border-t hover:bg-muted/50"
                      :class="{ 'bg-amber-500/5': isConversionRowLocked(detail) }"
                    >
                      <td class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                        <div class="flex items-center gap-1.5">
                          <span>{{ index + 1 }}</span>
                          <Lock
                            v-if="isConversionRowLocked(detail)"
                            class="h-3.5 w-3.5 text-amber-600 dark:text-amber-400"
                            title="Terkunci karena memiliki transaksi stok"
                          />
                        </div>
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldSelect
                          id="uom_id"
                          :value="detail.uom_id || ''"
                          @input="(v) => (detail.uom_id = String(v || ''))"
                          :options="uomMasterOptions"
                          displayField="value1"
                          valueField="id"
                          :errorText="errors.uom ? 'failed' : ''"
                          :hints="errors.uom"
                          :required="!isReadOnly"
                          :disabled="loading || isReadOnly || isConversionRowLocked(detail)"
                          :readonly="isReadOnly || isConversionRowLocked(detail)"
                          placeholder="Pilih UoM"
                          class="w-full"
                        />
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldNumber
                          id="qty"
                          :value="detail.qty"
                          @input="(v) => (detail.qty = Number(v))"
                          :min="0"
                          :errorname="errors.qty ? 'failed' : ''"
                          :hints="errors.qty"
                          :required="!isReadOnly"
                          :disabled="loading || isReadOnly || isConversionRowLocked(detail)"
                          :readonly="isReadOnly || isConversionRowLocked(detail)"
                          placeholder="0"
                          class="w-full"
                        />
                      </td>
                      <td class="px-2 py-2 text-center">
                        <FieldSelect
                          id="uomKonversi"
                          :value="detail.uom_konversi_id || ''"
                          @input="(v) => (detail.uom_konversi_id = String(v || ''))"
                          :options="uomMasterOptions"
                          displayField="value1"
                          valueField="id"
                          :errorText="errors.uomKonversi ? 'failed' : ''"
                          :hints="errors.uomKonversi"
                          :required="!isReadOnly"
                          :disabled="loading || isReadOnly || isConversionRowLocked(detail)"
                          :readonly="isReadOnly || isConversionRowLocked(detail)"
                          placeholder="Pilih UoM Konversi"
                          class="w-full"
                        />
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
                        <div class="flex items-center gap-2">
                          <span>{{ getConversionFormula(detail) }}</span>
                          <span
                            v-if="isConversionRowLocked(detail)"
                            class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                          >
                            Terkunci
                          </span>
                        </div>
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                        <Button
                          v-if="!isConversionRowLocked(detail)"
                          variant="ghost"
                          size="icon"
                          @click="removeUnitKonversi(index)"
                          class="h-7 w-7 sm:h-8 sm:w-8"
                          title="Hapus detail"
                        >
                          <Trash2 class="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
                        </Button>
                        <div
                          v-else
                          class="inline-flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 text-amber-600/70 hover:text-amber-700 cursor-not-allowed"
                          title="Item ini sudah memiliki transaksi stok. Perubahan tidak diperbolehkan, buat saja satuan yang baru !!"
                          @click="
                            toast.error(
                              'Item ini sudah memiliki transaksi stok. Perubahan tidak diperbolehkan, buat saja satuan yang baru !!',
                            )
                          "
                        >
                          <Lock class="h-4 w-4" />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- TAB CONTENT: RAK SELECTION -->
        <TabsContent value="rak" class="space-y-4 mt-4">
          <Card class="overflow-hidden">
            <CardHeader>
              <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div class="min-w-0">
                  <CardTitle>Lokasi Rak</CardTitle>
                  <CardDescription>Pilih lokasi penyimpanan item ini di warehouse.</CardDescription>
                </div>
                <Button
                  type="button"
                  size="sm"
                  class="w-full gap-2 sm:w-auto"
                  @click="isRakSummaryOpen = true"
                >
                  <Eye class="h-4 w-4" />
                  Lihat Rak Terpilih
                  <span
                    v-if="rak_ids_computed.length > 0"
                    class="ml-1 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-xs leading-none"
                  >
                    {{ rak_ids_computed.length }}
                  </span>
                </Button>
              </div>
            </CardHeader>
            <CardContent class="space-y-4 overflow-hidden">
              <RakSelection
                v-model="rak_ids_computed"
                :data="unitBisnisNestedData"
                :readOnly="isReadOnly"
              />

              <div class="max-h-[620px] space-y-4 overflow-y-auto pr-1">
                <div
                  v-if="selectedRakGroups.length === 0"
                  class="text-center py-8 text-muted-foreground text-sm border rounded-lg"
                >
                  Pilih rak terlebih dahulu, lalu centang default.
                </div>

                <div
                  v-for="group in selectedRakGroups"
                  :key="group.gudangId"
                  class="overflow-hidden rounded-lg border bg-background"
                >
                  <div class="flex flex-col gap-1 bg-muted px-3 py-2 text-sm font-medium sm:flex-row sm:items-center sm:justify-between">
                    <span class="min-w-0 truncate">{{ group.gudangName }}</span>
                    <span class="text-xs text-muted-foreground sm:text-right">{{ group.unitBisnisName }}</span>
                  </div>

                  <!-- Safety Stok & Stok Optimum per Gudang -->
                  <div class="px-3 py-3 border-t bg-muted/10">
                    <p class="text-xs font-medium text-muted-foreground mb-3">Setting Stok Gudang</p>
                    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <FieldNumber
                        :id="`safety_stok_${group.gudangId}`"
                        label="Safety Stok"
                        :value="getGudangSafetyStok(group.gudangId)"
                        @input="(v) => setGudangStok(group.gudangId, 'safety_stok', Number(v))"
                        :min="0"
                        :errorname="gudangStokErrors[group.gudangId]?.safety_stok ? 'failed' : ''"
                        :hints="gudangStokErrors[group.gudangId]?.safety_stok"
                        :required="!isReadOnly"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        placeholder="0"
                        class="w-full"
                      />
                      <FieldNumber
                        :id="`stok_optimum_${group.gudangId}`"
                        label="Stok Optimum"
                        :value="getGudangStokOptimum(group.gudangId)"
                        @input="(v) => setGudangStok(group.gudangId, 'stok_optimum', Number(v))"
                        :min="0"
                        :errorname="gudangStokErrors[group.gudangId]?.stok_optimum ? 'failed' : ''"
                        :hints="gudangStokErrors[group.gudangId]?.stok_optimum"
                        :required="!isReadOnly"
                        :disabled="loading || isReadOnly"
                        :readonly="isReadOnly"
                        placeholder="0"
                        class="w-full"
                      />
                    </div>
                  </div>

                  <div class="px-3 py-3">
                    <p class="text-xs font-medium text-muted-foreground mb-2">Setting Rak Default</p>
                    <div class="overflow-x-auto rounded-md border">
                      <table class="min-w-[560px] w-full text-sm">
                        <thead class="bg-muted/40">
                          <tr>
                            <th class="px-3 py-2 text-left font-medium text-xs w-16">#</th>
                            <th class="px-3 py-2 text-left font-medium text-xs">Kode</th>
                            <th class="px-3 py-2 text-left font-medium text-xs">Rak</th>
                            <th class="px-3 py-2 text-center font-medium text-xs w-28">Default</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="row in group.items"
                            :key="row.rakDetailId"
                            class="border-t hover:bg-muted/30"
                            :draggable="!isReadOnly && !!row.relation.is_default"
                            @dragstart="row.relation.is_default && onDefaultDragStart($event, group.gudangId, getDefaultRowIndex(group.gudangId, row.rakDetailId))"
                            @dragover="row.relation.is_default && onDefaultDragOver($event)"
                            @drop="row.relation.is_default && onDefaultDrop($event, group.gudangId, getDefaultRowIndex(group.gudangId, row.rakDetailId))"
                            @dragend="dragState = null"
                          >
                            <td class="px-3 py-2 text-xs text-muted-foreground">
                              <div class="flex items-center gap-1">
                                <GripVertical class="h-4 w-4" :class="row.relation.is_default ? '' : 'opacity-30'" />
                                {{ row.relation.is_default ? row.relation.sequence : "-" }}
                              </div>
                            </td>
                            <td class="px-3 py-2 text-xs font-mono whitespace-nowrap">{{ row.kode }}</td>
                            <td class="px-3 py-2 text-xs">
                              <div class="min-w-[180px]">
                                <span class="font-medium">{{ row.rakName }}</span>
                                <span class="text-muted-foreground ml-1">(B{{ row.baris }}:K{{ row.kolom }})</span>
                              </div>
                            </td>
                            <td class="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                :checked="!!row.relation.is_default"
                                :disabled="loading || isReadOnly"
                                @change="handleDefaultToggleChange(row.rakDetailId, $event)"
                                class="h-4 w-4 accent-primary"
                              />
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div
                  v-if="defaultRakGroups.length > 0"
                  class="text-xs text-muted-foreground border rounded-lg p-3"
                >
                  Drag &amp; drop berlaku untuk baris yang sudah dicentang default dalam gudang yang sama.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- TAB CONTENT: Log -->
        <TabsContent value="detailLog" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Tabel Log</CardTitle>
                  <CardDescription>Lihat history perubahan pada item ini</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div v-if="loadingLog" class="text-center py-8 text-muted-foreground text-sm">
                Memuat log...
              </div>
              <div v-else class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm w-10">No</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm whitespace-nowrap">Tanggal</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm whitespace-nowrap">Edited By</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Deskripsi</th>
                      <th class="px-3 py-2 text-left font-medium text-xs sm:text-sm">Perubahan</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailLog.length === 0">
                      <td colspan="5" class="text-center py-8 text-muted-foreground text-xs sm:text-sm">
                        Belum ada log
                      </td>
                    </tr>
                    <tr
                      v-for="(log, index) in detailLog"
                      :key="log.id || index"
                      class="border-t hover:bg-muted/50 align-top"
                    >
                      <td class="px-3 py-3 text-xs sm:text-sm whitespace-nowrap">{{ index + 1 }}</td>
                      <td class="px-3 py-3 text-xs sm:text-sm whitespace-nowrap">{{ log.createdAt }}</td>
                      <td class="px-3 py-3 text-xs sm:text-sm whitespace-nowrap">{{ log.user_default?.name ?? "-" }}</td>
                      <td class="px-3 py-3 text-xs sm:text-sm">{{ log.description }}</td>
                      <td class="px-3 py-3 text-xs sm:text-sm">
                        <span v-if="!log.old_data" class="text-green-600 font-medium">Item baru dibuat</span>
                        <template v-else>
                          <div class="space-y-1">
                            <template v-for="key in Object.keys(log.new_data || {})" :key="key">
                              <div
                                v-if="String(log.old_data[key] ?? '') !== String(log.new_data[key] ?? '') && key !== 'updatedAt' && key !== 'createdAt'"
                                class="text-xs"
                              >
                                <span class="font-medium text-foreground">{{ key }}:</span>
                                <span class="text-red-500 line-through ml-1">{{ log.old_data[key] ?? "-" }}</span>
                                <span class="mx-1 text-muted-foreground">→</span>
                                <span class="text-green-600">{{ log.new_data[key] ?? "-" }}</span>
                              </div>
                            </template>
                          </div>
                        </template>
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
        <template v-if="!isReadOnly">
          <Button
            type="button"
            variant="secondary"
            @click="onSave('DRAFT')"
            :disabled="loading"
            class="gap-2 w-full sm:w-auto"
          >
            <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
            <Save v-else class="h-4 w-4" />
            Simpan Draft
          </Button>
          <Button
            type="button"
            @click="onSave('POST')"
            :disabled="loading"
            class="gap-2 w-full sm:w-auto"
          >
            <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
            <Save v-else class="h-4 w-4" />
            Simpan & Post
          </Button>
        </template>
      </div>
    </form>

    <!-- DUPLICATE WARNING MODAL -->
    <Dialog v-model:open="isDuplicateModalOpen">
      <DialogContent class="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="text-xl flex items-center gap-2">
            <span class="text-2xl">⚠️</span>
            <span>Peringatan Item Duplikat!</span>
          </DialogTitle>
          <DialogDescription class="space-y-2 pt-2">
            <div class="text-sm">
              Nama item yang akan dibuat:
            </div>
            <div class="font-semibold text-foreground text-base bg-muted p-3 rounded-md border">
              {{ generatedNamaItem }}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4 py-4">
          <!-- Exact Matches -->
          <div
            v-if="duplicateExactMatches.length > 0"
            class="rounded-lg border-2 border-destructive bg-destructive/15 p-4"
          >
            <h4 class="text-base font-bold text-destructive mb-3 flex items-center gap-2">
              <span class="text-xl">🚫</span>
              <span>Duplikat Persis Ditemukan ({{ duplicateExactMatches.length }})</span>
            </h4>
            <p class="text-sm text-destructive/90 mb-4 leading-relaxed">
              <strong>PERINGATAN:</strong> Item dengan kombinasi <strong>nama item + tipe + kategori + ukuran</strong> yang <strong>sama persis</strong> sudah ada di sistem. Membuat item duplikat dapat menyebabkan konflik data.
            </p>
            <div class="border-2 border-destructive rounded-md max-h-[180px] overflow-y-auto bg-background">
              <table class="w-full text-sm">
                <thead class="bg-destructive/20 sticky top-0">
                  <tr>
                    <th class="px-3 py-2 text-left font-semibold text-xs text-destructive">Kode</th>
                    <th class="px-3 py-2 text-left font-semibold text-xs text-destructive">Nama Item</th>
                    <th class="px-3 py-2 text-left font-semibold text-xs text-destructive">Ukuran</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in duplicateExactMatches" :key="item.id" class="border-t hover:bg-muted/70">
                    <td class="px-3 py-2 text-xs font-mono font-medium">{{ item.kode_item || "-" }}</td>
                    <td class="px-3 py-2 text-xs">{{ item.nama_item }}</td>
                    <td class="px-3 py-2 text-xs font-medium">{{ formatUkuranDisplay(item) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Partial Matches -->
          <div 
            v-if="duplicatePartialMatches.length > 0"
            class="rounded-lg border-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30 p-4"
          >
            <h4 class="text-base font-bold text-yellow-700 dark:text-yellow-500 mb-3 flex items-center gap-2">
              <span class="text-xl">⚡</span>
              <span>Item Mirip Ditemukan ({{ duplicatePartialMatches.length }})</span>
            </h4>
            <p class="text-sm text-yellow-700 dark:text-yellow-400 mb-4 leading-relaxed">
              Item dengan <strong>nama yang hampir sama</strong> tetapi <strong>ukuran berbeda</strong> sudah ada di sistem. Pastikan item yang akan dibuat memang berbeda.
            </p>
            <div class="border-2 border-yellow-500 rounded-md max-h-[200px] overflow-y-auto bg-background">
              <table class="w-full text-sm">
                <thead class="bg-yellow-100 dark:bg-yellow-900/30 sticky top-0">
                  <tr>
                    <th class="px-3 py-2 text-left font-semibold text-xs text-yellow-700 dark:text-yellow-500">Kode</th>
                    <th class="px-3 py-2 text-left font-semibold text-xs text-yellow-700 dark:text-yellow-500">Nama Item</th>
                    <th class="px-3 py-2 text-left font-semibold text-xs text-yellow-700 dark:text-yellow-500">Ukuran</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in duplicatePartialMatches" :key="item.id" class="border-t hover:bg-muted/70">
                    <td class="px-3 py-2 text-xs font-mono font-medium">{{ item.kode_item || "-" }}</td>
                    <td class="px-3 py-2 text-xs">{{ item.nama_item }}</td>
                    <td class="px-3 py-2 text-xs font-medium">{{ formatUkuranDisplay(item) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Info Box -->
          <div class="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md p-3">
            <p class="text-xs text-blue-700 dark:text-blue-400">
              <strong>💡 Saran:</strong> Periksa kembali data item yang akan dibuat. Jika yakin item ini berbeda, klik tombol "Lanjut Simpan".
            </p>
          </div>
        </div>

        <DialogFooter class="flex sm:justify-between gap-2">
          <Button variant="outline" @click="isDuplicateModalOpen = false" class="gap-2">
            <span>←</span>
            Kembali & Periksa
          </Button>
          <Button
            v-if="duplicateExactMatches.length === 0"
            variant="default"
            @click="handleContinueSave"
            class="gap-2 bg-yellow-600 hover:bg-yellow-700"
          >
            <span>⚠️</span>
            Lanjut Simpan
          </Button>
          <Button 
            v-else 
            variant="destructive" 
            @click="handleContinueSave"
            class="gap-2"
          >
            <span>⚠️</span>
            Tetap Lanjut Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- RAK SUMMARY MODAL -->
    <Dialog v-model:open="isRakSummaryOpen">
      <DialogContent class="sm:max-w-[750px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rak Terpilih</DialogTitle>
          <DialogDescription>
            Daftar rak yang telah dipilih untuk item ini
            <span class="ml-1 font-semibold">({{ selectedRakSummary.length }} rak)</span>
          </DialogDescription>
        </DialogHeader>

        <div class="py-4">
          <div v-if="selectedRakSummary.length === 0" class="text-center py-10 text-muted-foreground text-sm">
            Belum ada rak yang dipilih
          </div>
          <div v-else class="border rounded-lg overflow-hidden">
            <table class="w-full text-sm">
              <thead class="bg-muted">
                <tr>
                  <th class="px-3 py-2 text-center font-medium text-xs w-10">No.</th>
                  <th class="px-3 py-2 text-left font-medium text-xs">Unit Bisnis</th>
                  <th class="px-3 py-2 text-left font-medium text-xs">Gudang</th>
                  <th class="px-3 py-2 text-left font-medium text-xs">Rak</th>
                  <th class="px-3 py-2 text-left font-medium text-xs">Kode</th>
                  <th class="px-3 py-2 text-center font-medium text-xs">Default</th>
                  <th class="px-3 py-2 text-center font-medium text-xs">Seq</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in selectedRakSummary"
                  :key="row.no"
                  class="border-t hover:bg-muted/50"
                >
                  <td class="px-3 py-2 text-xs text-center text-muted-foreground">{{ row.no }}</td>
                  <td class="px-3 py-2 text-xs font-medium">{{ row.unitBisnis }}</td>
                  <td class="px-3 py-2 text-xs">{{ row.gudang }}</td>
                  <td class="px-3 py-2 text-xs">{{ row.rak }}</td>
                  <td class="px-3 py-2 text-xs font-mono">{{ row.kode }}</td>
                  <td class="px-3 py-2 text-xs text-center">{{ row.isDefault ? "Ya" : "-" }}</td>
                  <td class="px-3 py-2 text-xs text-center">{{ row.sequence }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="isRakSummaryOpen = false">Tutup</Button>
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
</style>
