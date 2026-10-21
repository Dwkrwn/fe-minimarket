import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { toast } from "vue-sonner";
import { useAuthStore } from "@/stores/auth";
import {
  getStockGudangList,
  getGudangList,
  getStockSummary,
  getStockHistory,
  type StockGudangItem,
  type Gudang,
  type RakGroup,
  type StockHistory,
  type HistoryPagination,
  type Pagination,
  type StockSummary,
} from "./service";

export function useInfoStockView() {
  const authStore = useAuthStore();
  const isExporting = ref(false);
  const stockData = ref<StockGudangItem[]>([]);
  const gudangData = ref<Gudang[]>([]);
  const loading = ref(false);
  const loadingSummary = ref(false);
  const searchQuery = ref("");
  const lockFilter = ref<"all" | "locked">("all");
  const searchDebounce = ref<ReturnType<typeof setTimeout> | null>(null);

  const summary = ref<StockSummary>({
    low_stock: 0,
    over_stock: 0,
    per_gudang: [],
  });

  const selectedGudangId = ref<string | null>(null);

  const pagination = ref<Pagination>({
    total: 0,
    page: 1,
    totalPages: 1,
    limit: 20,
    currentRowsCount: 0,
    next_page: null,
    prev_page: null,
  });
  const currentPage = ref(1);
  const pageSize = ref(20);

  const expandedRaks = ref<Set<string>>(new Set());

  const showInfoDialog = ref(false);
  const selectedItem = ref<StockGudangItem | null>(null);
  const stockHistory = ref<StockHistory[]>([]);
  const loadingHistory = ref(false);
  const historyPage = ref(1);
  const historyPageSize = ref(10);
  const historyPagination = ref<HistoryPagination>({
    total: 0,
    page: 1,
    paginate: 10,
    total_pages: 1,
  });
  const historySearch = ref("");
  const historySearchField = ref<"no_transaksi" | "asal" | "tujuan">(
    "no_transaksi",
  );
  const historyType = ref("");
  const historySearchDebounce = ref<ReturnType<typeof setTimeout> | null>(null);

  const rakGroups = computed((): RakGroup[] => {
    const map = new Map<string, RakGroup>();

    for (const item of stockData.value) {
      const rakId = item.m_rak_d?.m_rak?.id ?? "no_rak";
      const rakNama = item.m_rak_d?.m_rak?.nama_rak ?? "Tanpa Rak";
      const rakKode = item.m_rak_d?.m_rak?.kode_rak ?? "-";

      if (!map.has(rakId)) {
        map.set(rakId, {
          rakId,
          rakNama,
          rakKode,
          totalItemsInRak: item.total_items_in_rak ?? 0,
          items: [],
          isExpanded: expandedRaks.value.has(rakId),
        });
      }
      const group = map.get(rakId)!;
      if (!group.totalItemsInRak && item.total_items_in_rak) {
        group.totalItemsInRak = item.total_items_in_rak;
      }
      group.items.push(item);
    }

    return Array.from(map.values()).sort((a, b) =>
      a.rakNama.localeCompare(b.rakNama),
    );
  });

  const totalItems = computed(() => pagination.value.total);
  const totalPages = computed(() => pagination.value.totalPages);

  const selectedGudang = computed(
    () => gudangData.value.find((g) => g.id === selectedGudangId.value) ?? null,
  );

  const activeSummary = computed<StockSummary>(() => {
    if (!selectedGudangId.value) return summary.value;
    const gudangSummary = summary.value.per_gudang.find(
      (g) => g.id === selectedGudangId.value,
    );
    if (!gudangSummary) return summary.value;
    return {
      low_stock: gudangSummary.low_stock,
      over_stock: gudangSummary.over_stock,
      per_gudang: summary.value.per_gudang,
    };
  });

  const showTable = computed(() => selectedGudangId.value !== null);

  const stockGaugePercent = computed(() => {
    if (!selectedItem.value) return 0;
    const optimum = parseInt(selectedItem.value?.stok_optimum || "0");
    const free = selectedItem.value.free_stock || 0;
    if (optimum <= 0) return Math.min(free > 0 ? 50 : 0, 100);
    return Math.min(Math.round((free / optimum) * 100), 100);
  });

  const stockGaugeColor = computed(() => {
    if (!selectedItem.value) return "bg-muted";
    const status = getStockStatus(
      selectedItem.value.free_stock,
      selectedItem.value?.safety_stok,
      selectedItem.value?.stok_optimum,
      selectedItem.value?.status_stok,
    );
    if (status === "low") return "bg-destructive";
    if (status === "over") return "bg-primary";
    return "bg-emerald-500";
  });

  const toggleRak = (rakId: string) => {
    if (expandedRaks.value.has(rakId)) {
      expandedRaks.value.delete(rakId);
    } else {
      expandedRaks.value.add(rakId);
    }
    expandedRaks.value = new Set(expandedRaks.value);
  };

  const expandAll = () => {
    expandedRaks.value = new Set(rakGroups.value.map((r) => r.rakId));
  };

  const collapseAll = () => {
    expandedRaks.value = new Set();
  };

  const allExpanded = computed(() => {
    if (rakGroups.value.length === 0) return false;
    return rakGroups.value.every((r) => expandedRaks.value.has(r.rakId));
  });

  const toggleAll = () => {
    if (allExpanded.value) {
      collapseAll();
    } else {
      expandAll();
    }
  };

  const getStockStatus = (
    freeStock: number,
    safetyStok?: string,
    stokOptimum?: string,
    backendStatus?: string,
  ) => {
    const normalized = (backendStatus || "").toUpperCase();
    if (normalized.includes("LOW")) return "low";
    if (normalized.includes("OVER")) return "over";
    if (normalized.includes("NORMAL")) return "normal";

    const safety = parseInt(safetyStok || "0");
    const optimum = parseInt(stokOptimum || "0");
    if (freeStock <= safety) return "low";
    if (optimum > 0 && freeStock >= optimum) return "over";
    return "normal";
  };

  const getStockColorClass = (item: StockGudangItem): string => {
    const status = getStockStatus(
      item.free_stock,
      item.safety_stok,
      item.stok_optimum,
      item.status_stok,
    );
    if (status === "low") return "text-destructive font-bold";
    if (status === "over") return "text-primary font-bold";
    return "text-foreground font-bold";
  };

  const getStatusText = (item: StockGudangItem): string => {
    const status = getStockStatus(
      item.free_stock,
      item.safety_stok,
      item.stok_optimum,
      item.status_stok,
    );
    if (status === "low") return "LOW STOCK";
    if (status === "over") return "OVERSTOCK";
    return "NORMAL";
  };

  const getStatusBadgeClass = (item: StockGudangItem): string => {
    const status = getStockStatus(
      item.free_stock,
      item.safety_stok,
      item.stok_optimum,
      item.status_stok,
    );
    const base =
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium";
    if (status === "low") return `${base} bg-destructive/10 text-destructive`;
    if (status === "over") return `${base} bg-primary/10 text-primary`;
    return `${base} bg-muted text-muted-foreground`;
  };

  const getLockStatusText = (item: StockGudangItem): string =>
    item.is_opname ? "DILOCK" : "FREE";

  const getLockStatusBadgeClass = (item: StockGudangItem): string => {
    const base =
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium";
    if (item.is_opname) return `${base} bg-destructive/10 text-destructive dark:text-white`;
    return `${base} bg-blue-100 text-blue-700`;
  };

  const fetchStockData = async (page: number = 1) => {
    if (!selectedGudangId.value) return;
    loading.value = true;
    try {
      const response = await getStockGudangList({
        page,
        paginate: pageSize.value,
        gudangId: selectedGudangId.value,
        search: searchQuery.value.trim() || undefined,
        isOpname: lockFilter.value === "locked" ? true : undefined,
      });

      if (response.status === "success") {
        stockData.value = response.data;
        pagination.value = response.pagination;
        currentPage.value = response.pagination.page;

        expandedRaks.value = new Set();
      }
    } catch (error) {
      toast.error("Gagal memuat data stock", {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      });
    } finally {
      loading.value = false;
    }
  };

  const selectGudang = (gudangId: string) => {
    selectedGudangId.value = gudangId;
    searchQuery.value = "";
    currentPage.value = 1;
    fetchStockData(1);
    setTimeout(() => {
      document
        .getElementById("stock-table-section")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const closeTable = () => {
    selectedGudangId.value = null;
    stockData.value = [];
  };

  const handleGudangChange = (val: unknown) => {
    const id = val ? String(val) : null;
    selectedGudangId.value = id;
    currentPage.value = 1;
    if (id) fetchStockData(1);
    else stockData.value = [];
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages.value) return;
    fetchStockData(page);
  };

  const handleSearch = () => {
    if (searchDebounce.value) clearTimeout(searchDebounce.value);
    searchDebounce.value = setTimeout(() => {
      currentPage.value = 1;
      fetchStockData(1);
    }, 400);
  };

  const handleLockFilterChange = (e: Event) => {
    const value = (e.target as HTMLSelectElement).value;
    lockFilter.value = value === "locked" ? "locked" : "all";
    currentPage.value = 1;
    if (selectedGudangId.value) {
      fetchStockData(1);
    }
  };

  const handleRefresh = async () => {
    searchQuery.value = "";
    lockFilter.value = "all";
    selectedGudangId.value = null;
    stockData.value = [];
    currentPage.value = 1;
    loadingSummary.value = true;
    try {
      const respoData = localStorage.getItem("SelectRespo");
      const companyId = respoData ? JSON.parse(respoData).companyId : null;
      summary.value = await getStockSummary(companyId);
    } finally {
      loadingSummary.value = false;
    }
    toast.success("Data berhasil dimuat ulang");
  };

  const handleExport = async (type: "low" | "over" | "all") => {
    isExporting.value = true;
    try {
      const respoData = localStorage.getItem("SelectRespo");
      const companyId = respoData ? JSON.parse(respoData).companyId : null;
      const gudangId = selectedGudangId.value || undefined;

      const params = new URLSearchParams();
      if (type) params.append("type", type);
      if (gudangId) params.append("m_gudang_id", gudangId);
      if (companyId) params.append("m_unit_bisnis_id", companyId);

      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/fn/stock_gudang/exportExcel?${params}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Gagal mengexport data");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `stock_status_${type}_${new Date().getTime()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      const typeText =
        type === "low" ? "Low Stock" : type === "over" ? "Over Stock" : "Semua";
      toast.success("Export berhasil", {
        description: `Data ${typeText} berhasil diexport`,
      });
    } catch (error) {
      toast.error("Gagal export data", {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      });
    } finally {
      isExporting.value = false;
    }
  };

  const transformHistoryData = (raw: StockHistory[]): StockHistory[] => {
    return raw.map((h) => ({
      ...h,
      qty_masuk: h.direction === "MASUK" ? h.qty : 0,
      qty_keluar: h.direction === "KELUAR" ? h.qty : 0,
    }));
  };

  const openInfoDialog = async (item: StockGudangItem) => {
    selectedItem.value = item;
    showInfoDialog.value = true;
    historyPage.value = 1;
    historySearch.value = "";
    historySearchField.value = "no_transaksi";
    historyType.value = "";
    await fetchStockHistory(item.id, 1);
  };

  const fetchStockHistory = async (stockGudangId: string, page: number) => {
    loadingHistory.value = true;
    try {
      const searchVal = historySearch.value.trim() || undefined;

      console.log("Fetching history with params:", {
        stockGudangId,
        page,
        search: searchVal,
      });
      const res = await getStockHistory({
        stockGudangId,
        page,
        paginate: historyPageSize.value,
        searchField: historySearchField.value,
        search: searchVal,
        type: historyType.value || undefined,
      });
      stockHistory.value = transformHistoryData(res.data ?? []);
      historyPagination.value = res.pagination;
      historyPage.value = res.pagination.page;
    } catch {
      toast.error("Gagal memuat history");
      stockHistory.value = [];
    } finally {
      loadingHistory.value = false;
    }
  };

  const handleHistoryPageChange = (page: number) => {
    if (!selectedItem.value) return;
    if (page < 1 || page > historyPagination.value.total_pages) return;
    fetchStockHistory(selectedItem.value.id, page);
  };

  const handleHistorySearch = () => {
    if (historySearchDebounce.value) clearTimeout(historySearchDebounce.value);
    historySearchDebounce.value = setTimeout(() => {
      if (!selectedItem.value) return;
      historyPage.value = 1;
      fetchStockHistory(selectedItem.value.id, 1);
    }, 400);
  };

  const handleHistoryPageSizeChange = (e: Event) => {
    historyPageSize.value = Number((e.target as HTMLSelectElement).value);
    if (!selectedItem.value) return;
    historyPage.value = 1;
    fetchStockHistory(selectedItem.value.id, 1);
  };

  const handleHistorySearchFieldChange = (e: Event) => {
    historySearchField.value = (e.target as HTMLSelectElement).value as
      | "no_transaksi"
      | "asal"
      | "tujuan";
    if (!historySearch.value.trim() || !selectedItem.value) return;
    historyPage.value = 1;
    fetchStockHistory(selectedItem.value.id, 1);
  };

  const handleHistoryTypeChange = (e: Event) => {
    historyType.value = (e.target as HTMLSelectElement).value;
    if (!selectedItem.value) return;
    historyPage.value = 1;
    fetchStockHistory(selectedItem.value.id, 1);
  };

  const handleHistoryRefresh = () => {
    if (!selectedItem.value) return;
    fetchStockHistory(selectedItem.value.id, historyPage.value);
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const d = String(date.getDate()).padStart(2, "0");
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const y = date.getFullYear();
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${d}/${m}/${y} | ${h}:${min}`;
  };

  onMounted(async () => {
    loadingSummary.value = true;
    try {
      gudangData.value = await getGudangList();
      const respoData = localStorage.getItem("SelectRespo");
      const companyId = respoData ? JSON.parse(respoData).companyId : null;
      summary.value = await getStockSummary(companyId);
    } finally {
      loadingSummary.value = false;
    }
  });

  onBeforeUnmount(() => {
    if (searchDebounce.value) clearTimeout(searchDebounce.value);
    if (historySearchDebounce.value) clearTimeout(historySearchDebounce.value);
  });

  return {
    stockData,
    gudangData,
    loading,
    loadingSummary,
    searchQuery,
    lockFilter,
    summary,
    selectedGudangId,
    pagination,
    currentPage,
    pageSize,
    expandedRaks,
    showInfoDialog,
    selectedItem,
    stockHistory,
    loadingHistory,
    historyPage,
    historyPageSize,
    historyPagination,
    historySearch,
    historySearchField,
    historyType,
    rakGroups,
    totalItems,
    totalPages,
    selectedGudang,
    activeSummary,
    showTable,
    stockGaugePercent,
    stockGaugeColor,
    toggleRak,
    expandAll,
    collapseAll,
    allExpanded,
    toggleAll,
    getStockStatus,
    getStockColorClass,
    getStatusText,
    getStatusBadgeClass,
    getLockStatusText,
    getLockStatusBadgeClass,
    fetchStockData,
    selectGudang,
    closeTable,
    handleGudangChange,
    handlePageChange,
    handleSearch,
    handleLockFilterChange,
    handleRefresh,
    isExporting,
    handleExport,
    transformHistoryData,
    openInfoDialog,
    fetchStockHistory,
    handleHistoryPageChange,
    handleHistorySearch,
    handleHistoryPageSizeChange,
    handleHistorySearchFieldChange,
    handleHistoryTypeChange,
    handleHistoryRefresh,
    formatDateTime,
  };
}
