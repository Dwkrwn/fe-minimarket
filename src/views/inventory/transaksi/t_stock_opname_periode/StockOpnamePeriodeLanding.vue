<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { Search, X } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DataTable from "@/components/table/DataTable.vue";
import { DeleteButton, EditButton, PrintButton, ViewButton } from "@/components/button";
import { useAuthStore } from "@/stores/auth";
import { deletePeriode, getPeriodeList, type StockOpnamePeriodeItem } from "./service";

const router = useRouter();
const authStore = useAuthStore();
const rows = ref<StockOpnamePeriodeItem[]>([]);
const loading = ref(false);
const selected = ref<StockOpnamePeriodeItem | null>(null);
const searchQuery = ref("");
const searchApiQuery = ref("");
const isSearching = ref(false);
const filterStatus = ref<"OPEN" | "LOCKED" | null>(null);

interface ColumnFilters {
  [key: string]: string;
}
interface ColumnFilterOperators {
  [key: string]: string;
}
interface DateRangeFilter {
  from: string;
  to: string;
}
interface DateRangeFilters {
  [key: string]: DateRangeFilter;
}

const tableColumnFilters = ref<ColumnFilters>({});
const tableColumnFilterOperators = ref<ColumnFilterOperators>({});
const tableDateRangeFilters = ref<DateRangeFilters>({});

type PeriodeApiFilter = {
  key: string;
  value: string;
  operator?: string;
};

const SEARCH_FIELDS = [
  "no_periode_opname",
  "catatan",
].join(",");

const getLockStatus = (row: any) => (row?.is_locked ? "LOCKED" : "OPEN");
const getLockFilterValue = (status: "OPEN" | "LOCKED") =>
  status === "LOCKED" ? "true" : "false";
const getLockSearchValue = (value: string) => {
  const normalized = value.trim().toUpperCase();
  if (normalized === "LOCK" || normalized === "LOCKED") return "true";
  if (normalized === "OPEN") return "false";
  return null;
};
const getDurationFilter = (value: string) => {
  const match = value.trim().match(/^(<=|>=|<|>|=)\s*(\d+(?:[.,]\d+)?)\s*(hari|day|days)?$/i);
  if (!match) return null;

  const operator = match[1];
  const duration = match[2];
  if (!operator || !duration) return null;

  return {
    operator,
    value: duration.replace(",", "."),
  };
};
const formatDate = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("id-ID");
};
const getUnitBisnisName = (row: any) =>
  row?.m_unit_bisni?.nama_comp ||
  row?.m_unit_bisnis?.nama_comp ||
  row?.m_unit_bisnis?.nama ||
  "";
const normalizeSearchText = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const matchesSearchQuery = (row: StockOpnamePeriodeItem, keyword: string) => {
  const query = normalizeSearchText(keyword);
  if (!query) return true;

  const searchableValues = [
    row.no_periode_opname,
    getUnitBisnisName(row),
    row.tgl_mulai,
    formatDate(row.tgl_mulai),
    row.tgl_akhir,
    formatDate(row.tgl_akhir),
    row.durasi_manual_hari,
    `${row.durasi_manual_hari ?? ""} hari`,
    row.catatan,
    getLockStatus(row),
    row.print_count,
  ];

  return searchableValues.some((value) =>
    normalizeSearchText(value).includes(query),
  );
};

const columns = [
  { key: "no_periode_opname", label: "No. Periode", filterable: true, width: "180px" },
  {
    key: "m_unit_bisni.nama_comp",
    label: "Unit Bisnis",
    filterable: true,
    width: "180px",
    valueGetter: (row: any) =>
      row?.m_unit_bisni?.nama_comp ||
      row?.m_unit_bisnis?.nama_comp ||
      "",
    renderHtml: (row: any) =>
      row?.m_unit_bisni?.nama_comp ||
      row?.m_unit_bisnis?.nama_comp ||
      "-",
  },
  {
    key: "tgl_mulai",
    label: "Tgl Mulai",
    filterable: true,
    filterType: "date" as const,
    width: "140px",
  },
  {
    key: "tgl_akhir",
    label: "Tgl Akhir",
    filterable: true,
    filterType: "date" as const,
    width: "140px",
  },
  { key: "durasi_manual_hari", label: "Durasi (Hari)", filterable: true, width: "120px" },
  {
    key: "lock_status",
    label: "Lock",
    filterable: true,
    width: "110px",
    renderHtml: (row: any) =>
      row?.is_locked
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800">LOCKED</span>`
        : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">OPEN</span>`,
  },
  { key: "print_count", label: "Print BA", filterable: false, width: "100px" },
];

const fetchData = async () => {
  loading.value = true;
  try {
    let companyId: string | undefined = undefined;
    const userType = authStore.user?.tipe?.value1?.toUpperCase() || "";
    if (!userType.includes("SUPER ADMIN") && !userType.includes("DEVELOPER")) {
      const selectRespo = localStorage.getItem("SelectRespo");
      if (selectRespo) companyId = JSON.parse(selectRespo).companyId;
    }

    const apiFilters: PeriodeApiFilter[] = [];
    const relationSearchParts: Array<{ field: string; value: string }> = [];

    Object.entries(tableColumnFilters.value).forEach(([key, value]) => {
      if (value && value.trim()) {
        if (key.includes(".")) {
          let backendField = key;
          if (key === "m_unit_bisni.nama_comp") {
             backendField = "m_unit_bisni.nama_comp";
          }
          relationSearchParts.push({ field: backendField, value: value.trim() });
          return;
        }

        const isLockStatusFilter = key === "lock_status";
        const normalizedValue = value.trim().toUpperCase();
        const durationFilter =
          key === "durasi_manual_hari" ? getDurationFilter(value) : null;
        apiFilters.push({
          key: isLockStatusFilter ? "is_locked" : key,
          value: isLockStatusFilter
            ? String(normalizedValue === "LOCKED" || normalizedValue === "LOCK")
            : durationFilter
              ? durationFilter.value
            : value.trim(),
          operator: isLockStatusFilter
            ? "="
            : durationFilter
              ? durationFilter.operator
              : tableColumnFilterOperators.value[key],
        });
      }
    });

    // Build where clause for date range filters (same approach as PO/PR Subcon)
    const whereClause = Object.entries(tableDateRangeFilters.value)
      .filter(([, filter]) => filter?.from || filter?.to)
      .map(([key, filter]) => {
        const conditions: string[] = [];
        if (filter.from) conditions.push(`${key} >= '${filter.from}'`);
        if (filter.to) conditions.push(`${key} <= '${filter.to}'`);
        return conditions.join("|");
      })
      .filter(Boolean)
      .join("|");

    if (filterStatus.value) {
      apiFilters.push({
        key: "is_locked",
        value: getLockFilterValue(filterStatus.value),
        operator: "=",
      });
    }

    const lockSearchValue = getLockSearchValue(searchApiQuery.value);
    if (lockSearchValue !== null) {
      apiFilters.push({
        key: "is_locked",
        value: lockSearchValue,
        operator: "=",
      });
    }

    const durationSearchFilter = getDurationFilter(searchApiQuery.value);
    if (durationSearchFilter) {
      apiFilters.push({
        key: "durasi_manual_hari",
        value: durationSearchFilter.value,
        operator: durationSearchFilter.operator,
      });
    }

    let apiSearchQuery =
      lockSearchValue === null && !durationSearchFilter ? searchApiQuery.value : "";
    let apiSearchFields = apiSearchQuery ? SEARCH_FIELDS : undefined;

    if (relationSearchParts.length > 0) {
      const firstRelation = relationSearchParts[0]!;
      apiSearchQuery = firstRelation.value;
      apiSearchFields = firstRelation.field;

      if (searchApiQuery.value && lockSearchValue === null && !durationSearchFilter) {
        apiSearchQuery = searchApiQuery.value;
        apiSearchFields = [SEARCH_FIELDS, firstRelation.field].join(",");
      }
    }

    const res = await getPeriodeList(
      1,
      apiSearchQuery || filterStatus.value ? 9999 : 200,
      companyId,
      apiFilters.length > 0 ? apiFilters : undefined,
      undefined,
      apiSearchQuery || undefined,
      apiSearchFields,
      whereClause || undefined,
    );
    const mappedRows = (res.data || []).map((row: any) => ({
      ...row,
      lock_status: getLockStatus(row),
    }));

    let finalRows = mappedRows.filter((row: any) =>
      filterStatus.value ? getLockStatus(row) === filterStatus.value : true
    );

    if (searchApiQuery.value) {
      finalRows = finalRows.filter((row: any) =>
        matchesSearchQuery(row, searchApiQuery.value)
      );
    }

    if (relationSearchParts.length > 0) {
      relationSearchParts.forEach((part) => {
        const keyword = part.value.toLowerCase();
        finalRows = finalRows.filter((row: any) => {
          if (part.field === "m_unit_bisni.nama_comp" || part.field === "m_unit_bisni.nama_comp") {
            const name = getUnitBisnisName(row).toLowerCase();
            return name.includes(keyword);
          }
          return true;
        });
      });
    }

    rows.value = finalRows;
  } catch (error) {
    toast.error("Gagal load periode");
  } finally {
    loading.value = false;
  }
};

const handleApiSearch = async () => {
  if (isSearching.value) return;

  isSearching.value = true;
  searchApiQuery.value = searchQuery.value;
  selected.value = null;

  try {
    await fetchData();

    if (searchQuery.value.trim()) {
      toast.success("Pencarian selesai", {
        description: `Ditemukan ${rows.value.length} hasil`,
      });
    }
  } finally {
    isSearching.value = false;
  }
};

const clearSearch = async () => {
  searchQuery.value = "";
  searchApiQuery.value = "";
  await handleApiSearch();
};

const setFilterStatus = async (status: "OPEN" | "LOCKED" | null) => {
  filterStatus.value = filterStatus.value === status ? null : status;
  selected.value = null;
  await fetchData();
};

let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const handleTableFilterChange = (filters: {
  column: Record<string, string>;
  operator: Record<string, string>;
  dateRange: Record<string, { from: string; to: string }>;
  where: string;
}) => {
  tableColumnFilters.value = filters.column;
  tableColumnFilterOperators.value = filters.operator;
  tableDateRangeFilters.value = filters.dateRange;
  selected.value = null;

  if (filterDebounceTimer) {
    clearTimeout(filterDebounceTimer);
  }

  filterDebounceTimer = setTimeout(() => {
    fetchData();
  }, 500);
};

const remove = async () => {
  if (!selected.value?.id) return;
  if (selected.value.is_locked) {
    toast.error("Periode sudah lock, tidak bisa dihapus");
    return;
  }
  try {
    await deletePeriode(selected.value.id);
    toast.success("Periode dihapus");
    await fetchData();
  } catch (error) {
    toast.error("Gagal hapus periode");
  }
};

onMounted(fetchData);
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">Periode Stock Opname</h1>
        <p class="text-sm text-muted-foreground">Grouping transaksi stock opname per periode</p>
      </div>
      <Button @click="router.push('/inventory/transaksi/t_stock_opname_periode/form')">Create New</Button>
    </div>

    <div class="flex flex-col gap-3 bg-muted/50 p-4 rounded-lg">
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-sm font-medium">Status:</span>
        <Button
          variant="outline"
          size="sm"
          :class="filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
          @click="setFilterStatus(null)"
        >
          ALL
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="filterStatus === 'OPEN' ? 'bg-green-100 text-green-800 border-green-500 hover:bg-green-200' : ''"
          @click="setFilterStatus('OPEN')"
        >
          OPEN
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="filterStatus === 'LOCKED' ? 'bg-red-100 text-red-800 border-red-500 hover:bg-red-200' : ''"
          @click="setFilterStatus('LOCKED')"
        >
          LOCKED
        </Button>
      </div>

      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2 w-full max-w-sm">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              v-model="searchQuery"
              placeholder="Search..."
              class="pl-9 pr-8"
              @keyup.enter="handleApiSearch"
              :disabled="isSearching"
            />
            <Button
              v-if="searchQuery"
              @click="clearSearch"
              size="icon"
              variant="ghost"
              class="absolute right-0 top-1/2 -translate-y-1/2"
            >
              <X class="h-4 w-4" />
            </Button>
          </div>
          <Button
            @click="handleApiSearch"
            size="icon"
            variant="secondary"
            :disabled="isSearching"
          >
            <Search class="h-4 w-4" />
          </Button>
        </div>

        <div class="flex items-center gap-2">
          <ViewButton :disabled="!selected" @click="selected && router.push(`/inventory/transaksi/t_stock_opname_periode/view/${selected.id}`)" />
          <EditButton :disabled="!selected || selected?.is_locked" @click="selected && router.push(`/inventory/transaksi/t_stock_opname_periode/form/${selected.id}`)" />
          <PrintButton :disabled="!selected" @click="selected && router.push(`/inventory/transaksi/t_stock_opname_periode/print/${selected.id}`)" />
          <DeleteButton :disabled="!selected" @click="remove" />
        </div>
      </div>
    </div>

    <DataTable
      :data="rows"
      :columns="columns"
      :loading="loading"
      :row-select-mode="true"
      :api-filter-mode="true"
      @row-select="(item) => (selected = item)"
      @row-deselect="selected = null"
      @filter-change="handleTableFilterChange"
    />
  </div>
</template>
