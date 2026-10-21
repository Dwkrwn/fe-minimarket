<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import {
  ref,
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  TransitionGroup,
  watch,
} from "vue";
import { useRouter } from "vue-router";
import {
  Search,
  Trash2,
  FileDown,
  Edit,
  Copy,
  RefreshCw,
  X,
  Plus,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import DataTable from "@/components/table/DataTable.vue";
import {
  BulkDeleteButton,
  DeleteButton,
  ExportButton,
  EditButton,
  CopyButton,
  ViewButton,
  PostButton,
} from "@/components/button";
import { useActionButtons } from "@/composables/useActionButtons";
import { usePermission } from "@/composables/usePermission";
import {
  getRfqList,
  deleteRfq,
  bulkDeleteRfq,
  updateRfq,
  exportRfq,
  type RfqItem,
} from "./service";
import { getApprovalStatusBadgeClass, getApprovalStatusFilterClass } from "@/lib/approvalStatus";
import { formatDate } from "@/lib/date";

// ============================================================================
// COMPOSABLES & STORES
// ============================================================================
const router = useRouter();
const {
  selectedItem,
  isActive,
  selectItem,
  deselectItem,
  handleEdit,
  handleDelete,
  handleCopy,
} = useActionButtons();
const {
  currentMenuId,
  canCreate,
  canUpdate,
  canDelete,
  canPrint,
  isSuperAdmin,
} = usePermission();

// ============================================================================
// DELETE DIALOG STATE
// ============================================================================
const isDeleteDialogOpen = ref(false);
const itemToDelete = ref<RfqItem | null>(null);
const itemsToDelete = ref<RfqItem[]>([]);
const isDeleting = ref(false);

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<RfqItem[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const hasMoreData = ref(true);
const dataTableRef = ref<any>(null);

// ============================================================================
// BULK SELECTION STATE
// ============================================================================
const selectedItems = ref<RfqItem[]>([]);
const isMobileSelectionMode = ref(false);

// ============================================================================
// FILTER & SEARCH STATE
// ============================================================================
const filterStatus = ref<"DRAFT" | "POST" | null>(null);
const isDraftFilterActive = computed(() => filterStatus.value === "DRAFT");
const searchQuery = ref("");
const searchApiQuery = ref(""); // Untuk API search
const isSearching = ref(false);

// Column filters for API-based filtering
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
const tableWhereClause = ref("");

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================


/** Get status badge styling */
const getStatusStyle = getApprovalStatusBadgeClass;

const columns = [
  {
    key: "m_unit_bisni.nama_comp",
    label: "Unit Bisnis",
    filterable: true,
    width: "150px",
    renderHtml: (item: any) => item.m_unit_bisni?.nama_comp || "-",
  },
  { key: "no_rfq", label: "No. RFQ", filterable: true, width: "180px" },
  {
    key: "createdAt",
    label: "Tgl RFQ",
    filterable: true,
    filterType: "date" as const,
    width: "120px",
  },
  {
    key: "tgl_mulai",
    label: "Tgl Mulai",
    filterable: true,
    filterType: "date" as const,
    width: "130px",
  },
  {
    key: "tgl_akhir",
    label: "Tgl Berakhir",
    filterable: true,
    filterType: "date" as const,
    width: "130px",
  },
  {
    key: "currency_id", // Assuming filtering builds query on this key? Or 'm_currency.nama_currency'?
    // Usually filtering uses exact column name in DB. 'currency_id' is safe.
    // But for display we invoke renderHtml or nested key if supported.
    label: "Currency",
    filterable: true,
    width: "100px",
    valueGetter: (item: any) =>
      item.m_currency?.nama_currency || item.m_currency?.code || "",
    renderHtml: (item: any) =>
      item.m_currency?.nama_currency || item.m_currency?.code || "-",
  },
  { key: "catatan", label: "Catatan", filterable: true, width: "200px" },
  {
    key: "status",
    label: "Status",
    filterable: true, // Filterable usually
    width: "120px",
    renderHtml: (item: RfqItem) => {
      const status = item.status || "DRAFT";
      const badgeClass = getStatusStyle(status);
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${status}</span>`;
    },
  },
];

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================
/** Filter RFQ data berdasarkan status (DRAFT/POST) */
const filteredData = computed(() => {
  return menuData.value.filter((item: RfqItem) => {
    const matchStatus =
      filterStatus.value === null ? true : item.status === filterStatus.value;

    return matchStatus;
  });
});

const getNormalizedStatus = (status?: string | null) =>
  (status || "").toUpperCase();
const isLockedStatus = (status?: string | null) =>
  ["POST", "APPROVED"].includes(getNormalizedStatus(status));
const isSelectedItemLocked = computed(() =>
  isLockedStatus(selectedItem.value?.status),
);

const isDraftItem = (item: RfqItem | null | undefined) =>
  getNormalizedStatus(item?.status || "DRAFT") === "DRAFT";

const selectedDraftCount = computed(
  () => selectedItems.value.filter((item) => isDraftItem(item)).length,
);

const canExportStatus = (status?: string | null) =>
  getNormalizedStatus(status) === "POST";

/** Deskripsi dialog delete */
const deleteDialogDescription = computed(() => {
  if (itemsToDelete.value.length > 1) {
    return `Apakah Anda yakin ingin menghapus ${itemsToDelete.value.length} RFQ berstatus DRAFT? Tindakan ini tidak dapat dibatalkan.`;
  }
  if (!itemToDelete.value) return "";
  return `Apakah Anda yakin ingin menghapus Rfq dengan No RFQ "${itemToDelete.value.no_rfq}"? Tindakan ini tidak dapat dibatalkan.`;
});

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
/** Trigger delete dialog */
const deleteSelected = (item?: RfqItem | Event) => {
  // Check permission
  if (!canDelete.value) {
    toast.error("Akses Ditolak", {
      description: "Anda tidak memiliki izin untuk menghapus data",
    });
    return;
  }

  const explicitItem = item && !(item instanceof Event) ? item : undefined;
  const candidateItems =
    selectedItems.value.length > 1
      ? selectedItems.value
      : explicitItem
        ? [explicitItem]
        : selectedItems.value.length === 1
          ? selectedItems.value
          : (() => {
              const selectedSingle = handleDelete();
              return selectedSingle ? [selectedSingle] : [];
            })();

  if (candidateItems.length === 0) {
    toast.error("Pilih minimal 1 item terlebih dahulu");
    return;
  }

  const deletableItems = candidateItems.filter((candidate) =>
    isDraftItem(candidate),
  );
  const skippedItems = candidateItems.filter(
    (candidate) => !isDraftItem(candidate),
  );

  if (skippedItems.length > 0) {
    toast.warning("Sebagian item tidak bisa dihapus", {
      description: `${skippedItems.length} item non-DRAFT diabaikan`,
    });
  }

  if (deletableItems.length === 0) {
    toast.error("Tidak dapat menghapus", {
      description: "Hanya RFQ dengan status DRAFT yang dapat dihapus",
    });
    return;
  }

  itemsToDelete.value = deletableItems;
  itemToDelete.value = deletableItems.length === 1 ? deletableItems[0] : null;
  isDeleteDialogOpen.value = true;
};

/** Konfirmasi delete - hit API dan update UI */
const confirmDelete = async () => {
  const targetItems = itemsToDelete.value.length
    ? itemsToDelete.value
    : itemToDelete.value
      ? [itemToDelete.value]
      : [];
  const targetIds = targetItems.map((item) => item.id).filter(Boolean).map(String);
  if (targetIds.length === 0) return;

  isDeleting.value = true;
  try {
    const response =
      targetIds.length > 1
        ? await bulkDeleteRfq(targetIds)
        : await deleteRfq(targetIds[0]!);

    if (response.status === "success") {
      // Remove item from list
      const deletedIds = new Set(targetIds);
      menuData.value = menuData.value.filter(
        (m: RfqItem) => !deletedIds.has(String(m.id || "")),
      );

      toast.success(
        targetIds.length > 1
          ? `${targetIds.length} RFQ berhasil dihapus`
          : `RFQ No "${targetItems[0]?.no_rfq}" berhasil dihapus`,
        {
          description: response.message || "Item telah dihapus dari database",
        },
      );

      // Clear selection
      clearAllSelection();
      isDeleteDialogOpen.value = false;
    } else {
      toast.error("Gagal menghapus RFQ", {
        description: response.message || "Terjadi kesalahan saat menghapus",
      });
    }
  } catch (error) {
    toast.error("Gagal menghapus RFQ", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    isDeleting.value = false;
    itemToDelete.value = null;
    itemsToDelete.value = [];
  }
};

const cancelDelete = () => {
  isDeleteDialogOpen.value = false;
  itemToDelete.value = null;
  itemsToDelete.value = [];
};

// ============================================================================
// POST / SEND APPROVAL FUNCTIONS
// ============================================================================
const isPostDialogOpen = ref(false);
const itemToPost = ref<RfqItem | null>(null);
const isPosting = ref(false);

const resolveRfqActionItem = (item?: RfqItem | Event | null) => {
  if (!item || item instanceof Event) return selectedItem.value;
  return item;
};

const postDialogDescription = computed(() => {
  if (!itemToPost.value) return "";
  return `Apakah Anda yakin ingin memposting RFQ "${itemToPost.value.no_rfq || "-"}"? Status akan berubah menjadi POST.`;
});

const openPostDialog = (item?: RfqItem | Event) => {
  const targetItem = resolveRfqActionItem(item);

  if (targetItem) {
    selectItem(targetItem, 0);
  }

  if (!targetItem) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  // Check if status is already POST or APPROVED or REJECT or VOID
  const status = getNormalizedStatus(targetItem.status);
  if (
    status === "POST" ||
    status === "APPROVED" ||
    status === "REJECTED" ||
    status === "VOID"
  ) {
    toast.warning(`Item sudah berstatus ${status}`);
    return;
  }

  itemToPost.value = targetItem;
  isPostDialogOpen.value = true;
};

const confirmPost = async () => {
  const item = itemToPost.value;
  if (!item?.id) return;

  isPosting.value = true;
  try {
    const response = await updateRfq(String(item.id), { status: "POST" });

    if (response.status === "success") {
      const updatedItem: RfqItem = {
        ...item,
        ...(response.data || {}),
        status: response.data?.status || "POST",
        no_rfq: response.data?.no_rfq || item.no_rfq,
      };

      menuData.value = menuData.value.map((menuItem: RfqItem) =>
        String(menuItem.id || "") === String(item.id)
          ? { ...menuItem, ...updatedItem }
          : menuItem,
      );

      toast.success(`RFQ "${updatedItem.no_rfq || "-"}" berhasil diposting`);
      isPostDialogOpen.value = false;
      itemToPost.value = null;
      clearAllSelection();
      await nextTick();
      dataTableRef.value?.gridApi?.refreshCells?.({ force: true });
    } else {
      toast.error("Gagal memposting RFQ", {
        description: (response as any).message || "Terjadi kesalahan",
      });
    }
  } catch (error) {
    toast.error("Gagal memposting RFQ", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    isPosting.value = false;
    itemToPost.value = null;
  }
};

const cancelPost = () => {
  isPostDialogOpen.value = false;
  itemToPost.value = null;
};

// ============================================================================
// EXPORT & EDIT FUNCTIONS
// ============================================================================
/** Export t_rfq data */
const exportData = async (item?: any) => {
  // Determine target item
  const target = item || selectedItem.value;

  if (!target) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  // Check if item is selected if called from toolbar
  if (!item && !selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  // Check status
  const status = getNormalizedStatus(target.status);
  if (!canExportStatus(status)) {
    toast.error("Hanya data dengan status POST yang dapat diexport");
    return;
  }

  const toastId = toast.loading("Mengunduh file export...");

  try {
    const noRfq = target.no_rfq;
    if (!noRfq) throw new Error("No RFQ tidak valid");

    const { blob, filename } = await exportRfq(noRfq);

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `RFQ-${noRfq}`;
    document.body.appendChild(a);
    a.click();

    // Cleanup
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast.success(`Export ${noRfq} berhasil diunduh`, { id: toastId });
  } catch (error) {
    console.error("Export error:", error);
    toast.error("Gagal melakukan export RFQ", {
      description:
        error instanceof Error ? error.message : "Terjadi kesalahan sistem",
      id: toastId,
    });
  }
};

/** View Rfq item details */
const viewItem = (item?: any) => {
  if (item) {
    selectItem(item, 0);
  }

  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  // Navigate to view page (read-only mode)
  if (selectedItem.value?.id) {
    router.push(
      `/purchasing/transaksi/t_rfq/view/${String(selectedItem.value.id)}`,
    );
  }
};

/** Edit Rfq item */
const editItem = (item?: any) => {
  // Check permission
  if (!canUpdate.value) {
    toast.error("Akses Ditolak", {
      description: "Anda tidak memiliki izin untuk mengubah data",
    });
    return;
  }

  if (item) {
    selectItem(item, 0);
  }

  const target = item || selectedItem.value;
  if (target) {
    const status = getNormalizedStatus(target.status);
    if (isLockedStatus(status)) {
      toast.error("Tidak dapat mengedit", {
        description: `Data dengan status ${status} tidak dapat diubah`,
      });
      return;
    }
  }

  const selectedItemData = handleEdit(item);
  if (!selectedItemData?.id) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }
  // Navigate to edit form
  router.push(
    `/purchasing/transaksi/t_rfq/form/${String(selectedItemData.id)}`,
  );
};

/** Copy Rfq item - duplicate data tanpa ID untuk create new */
const copyItem = (item?: any) => {
  // Check permission (copy requires create permission)
  if (!canCreate.value) {
    toast.error("Akses Ditolak", {
      description: "Anda tidak memiliki izin untuk membuat data baru",
    });
    return;
  }

  if (item) {
    selectItem(item, 0);
  }
  const selectedItemData = handleCopy(item);
  if (!selectedItemData?.id) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  // Navigate ke form create dengan data yang sama (tanpa ID)
  // Query param action=copy akan trigger mode copy di form
  router.push({
    path: "/purchasing/transaksi/t_rfq/form",
    query: {
      action: "copy",
      source: String(selectedItemData.id),
    },
  });

  toast.success(`Menyalin data "${selectedItemData.no_rfq || ""}"`, {
    description: "Silakan edit dan simpan sebagai Rfq baru",
  });
  deselectItem();
};

/** Navigasi ke form create baru */
const createNew = () => {
  // Check permission
  if (!canCreate.value) {
    toast.error("Akses Ditolak", {
      description: "Anda tidak memiliki izin untuk membuat data baru",
    });
    return;
  }

  router.push("/purchasing/transaksi/t_rfq/form");
};

// ============================================================================
// API & DATA FETCHING FUNCTIONS
// ============================================================================
/** Fetch t_rfq data dari API with search support */
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
  if (page === 1 || resetData) {
    loading.value = true;
  } else {
    loadingMore.value = true;
  }

  try {
    // Call API with search parameters
    const allowedFilterKeys = new Set([
      "no_rfq",
      "catatan",
      "status",
      "currency_id",
    ]);

    const filterParams: Record<string, string> = {};
    Object.entries(tableColumnFilters.value).forEach(([key, value]) => {
      if (!value || !allowedFilterKeys.has(key)) return;
      filterParams[`filter_column_${key}`] = value;
      filterParams[`filter_operator_${key}`] = "=";
    });

    const response = await getRfqList(
      page,
      pageSize.value,
      "createdAt",
      "DESC",
      searchApiQuery.value || undefined,
      searchApiQuery.value ? "no_rfq,catatan" : undefined,
      "m_unit_bisnis,m_currency",
      Object.keys(filterParams).length > 0 ? filterParams : undefined,
      tableWhereClause.value || undefined,
    );

    if (response.status === "success") {
      if (page === 1 || resetData) {
        menuData.value = response.data;
      } else {
        // Append data untuk infinite scroll
        menuData.value.push(...response.data);
      }

      // Check if there's more data to load
      if (response.pagination) {
        hasMoreData.value = response.pagination.next_page !== null;
      }
    }
  } catch (error) {
    toast.error("Gagal memuat data Rfq", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
};

/** Handle load more triggered dari DataTable infinite scroll */
const handleLoadMore = () => {
  currentPage.value++;
  fetchMenuData(currentPage.value);
};

/** Handle API search - triggered by Enter or Search button */
const handleApiSearch = async () => {
  if (isSearching.value) return;

  isSearching.value = true;
  searchApiQuery.value = searchQuery.value;

  // Reset to page 1 when searching
  menuData.value = [];
  currentPage.value = 1;
  hasMoreData.value = true;

  await fetchMenuData(1, true);

  if (searchQuery.value.trim()) {
    toast.success("Pencarian selesai", {
      description: `Ditemukan ${menuData.value.length} hasil`,
    });
  }

  isSearching.value = false;
};

/** Clear search and reload all data */
const clearSearch = async () => {
  searchQuery.value = "";
  searchApiQuery.value = "";
  await handleApiSearch();
};

/** Handle table filter change from DataTable */
let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const handleTableFilterChange = (filters: {
  column: Record<string, string>;
  operator: Record<string, string>;
  dateRange: Record<string, { from: string; to: string }>;
  where: string;
}) => {
  // Update local filter state
  tableColumnFilters.value = filters.column;
  tableColumnFilterOperators.value = filters.operator;
  tableDateRangeFilters.value = filters.dateRange;
  tableWhereClause.value = filters.where;

  // Debounce API call
  if (filterDebounceTimer) {
    clearTimeout(filterDebounceTimer);
  }

  filterDebounceTimer = setTimeout(async () => {
    // Reset to page 1 when filtering
    menuData.value = [];
    currentPage.value = 1;
    hasMoreData.value = true;

    await fetchMenuData(1, true);
  }, 500); // 500ms debounce
};

/** Handle refresh - reload data from scratch */
const handleRefresh = async () => {
  // Reset state
  searchQuery.value = "";
  searchApiQuery.value = "";
  tableColumnFilters.value = {};
  tableColumnFilterOperators.value = {};
  tableDateRangeFilters.value = {};
  tableWhereClause.value = "";
  menuData.value = [];
  currentPage.value = 1;
  hasMoreData.value = true;
  clearAllSelection(true);

  // Reload data
  await fetchMenuData(1, true);

  toast.success("Data berhasil dimuat ulang");
};

const selectionAnchor = ref<RfqItem | null>(null);

const isDraftStatus = (item?: RfqItem | null) =>
  (item?.status || "").toUpperCase() === "DRAFT";

const handleSelectionChange = (items: RfqItem[]) => {
  if (items.length === 0) {
    selectionAnchor.value = null;
    selectedItems.value = [];
    deselectItem();
    return;
  }

  const firstItem = items[0];
  if (!firstItem) return;
  const prevAnchor = selectionAnchor.value;
  const anchor: RfqItem =
    prevAnchor && items.some((i) => i.id === prevAnchor.id) ? prevAnchor : firstItem;
  selectionAnchor.value = anchor;

  if (!isDraftStatus(anchor)) {
    const anchorItem = items.find((i) => i.id === anchor.id) || anchor;
    if (items.length > 1) {
      toast.warning("Tidak dapat memilih item lain", {
        description: `Item berstatus ${anchor.status} hanya dapat dipilih sendiri.`,
      });
    }
    selectedItems.value = [anchorItem];
    selectItem(anchorItem, 0);
    return;
  }

  const draftOnly = items.filter(isDraftStatus);
  if (items.some((i) => !isDraftStatus(i))) {
    toast.warning("Tidak dapat memilih item lain", {
      description: "Hanya item berstatus DRAFT yang dapat dipilih bersama.",
    });
  }
  const allowed = draftOnly.length > 0 ? draftOnly : [anchor];
  selectedItems.value = allowed;
  selectItem(allowed[allowed.length - 1] ?? anchor, 0);
};

const clearAllSelection = (exitMobileMode: boolean = false) => {
  selectedItems.value = [];
  dataTableRef.value?.clearSelection?.();
  deselectItem();

  if (exitMobileMode) {
    isMobileSelectionMode.value = false;
  }
};

const isItemSelected = (itemId?: string | number) => {
  if (!itemId) return false;
  return selectedItems.value.some((selected) => selected.id === itemId);
};

const toggleMobileSelectionMode = () => {
  if (isMobileSelectionMode.value) {
    clearAllSelection(true);
    return;
  }

  if (!isDraftFilterActive.value) {
    toast.info("Pilih filter DRAFT untuk memilih item");
    return;
  }

  clearAllSelection();
  isMobileSelectionMode.value = true;
};

const toggleMobileItemSelection = (item: RfqItem) => {
  if (!isDraftItem(item) || !item.id) return;

  const index = selectedItems.value.findIndex(
    (selected) => selected.id === item.id,
  );
  if (index !== -1) {
    selectedItems.value.splice(index, 1);
  } else {
    selectedItems.value.push(item);
  }

  deselectItem();
};

watch(filterStatus, () => {
  clearAllSelection(true);
});

/** Infinite scroll handler untuk mobile (window scroll) */
const handleWindowScroll = () => {
  if (loadingMore.value || !hasMoreData.value) return;

  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const windowHeight = window.innerHeight;
  const docHeight = document.documentElement.scrollHeight;

  // Trigger load more when near bottom of page
  if (docHeight - scrollTop - windowHeight < 100) {
    currentPage.value++;
    fetchMenuData(currentPage.value);
  }
};

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================
/** Load data saat component mount */
onMounted(async () => {
  // Reset state saat mount untuk avoid stale data
  menuData.value = [];
  currentPage.value = 1;
  hasMoreData.value = true;
  clearAllSelection(true);

  await fetchMenuData(1);

  // Add window scroll listener untuk infinite scroll di mobile
  window.addEventListener("scroll", handleWindowScroll, { passive: true });
});

/** Cleanup listeners dan state saat component unmount */
onUnmounted(() => {
  // Remove scroll listener
  window.removeEventListener("scroll", handleWindowScroll);

  // Clear data untuk prevent memory leak
  menuData.value = [];
  clearAllSelection(true);
});
</script>

<template>
  <!-- ================================================================ -->
  <!-- MOBILE VIEW (LG:HIDDEN) -->
  <!-- ================================================================ -->
  <div class="lg:hidden flex flex-col min-h-screen pb-28">
    <!-- STICKY HEADER -->
    <div class="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
      <div class="p-4 space-y-3">
        <!-- Title & Refresh -->
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-lg font-bold">Transaksi RFQ</h1>
            <p class="text-xs text-muted-foreground">Kelola data RFQ</p>
          </div>
          <div class="flex items-center gap-2">
            <Button
              v-if="isDraftFilterActive"
              v-permission="{ menuId: currentMenuId, action: 'delete' }"
              variant="outline"
              size="sm"
              class="h-8 px-3 text-xs"
              @click="toggleMobileSelectionMode"
            >
              {{ isMobileSelectionMode ? "Selesai" : "Pilih" }}
            </Button>
            <Button
              variant="outline"
              size="icon"
              @click="handleRefresh"
              :disabled="loading"
              class="h-8 w-8"
            >
              <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
            </Button>
          </div>
        </div>

        <!-- Filter Status Buttons -->
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7 whitespace-nowrap"
            :class="filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
            @click="filterStatus = null"
          >
            ALL
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7"
            :class="getApprovalStatusFilterClass('DRAFT', filterStatus === 'DRAFT')"
            @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'"
          >
            DRAFT
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7"
            :class="
              getApprovalStatusFilterClass('POST', filterStatus === 'POST')
            "
            @click="filterStatus = filterStatus === 'POST' ? null : 'POST'"
          >
            POST
          </Button>
        </div>

        <!-- Search Input -->
        <div class="relative">
          <Search
            class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          />
          <Input
            v-model="searchQuery"
            placeholder="Search..."
            class="pl-9 pr-8 h-8 text-sm"
            @keyup.enter="handleApiSearch"
            :disabled="isSearching"
          />
          <Button
            v-if="searchQuery"
            @click="clearSearch"
            size="icon"
            variant="ghost"
            class="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8"
          >
            <X class="h-4 w-4" />
          </Button>
        </div>

        <div
          v-if="isMobileSelectionMode"
          class="flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2"
        >
          <span class="text-xs text-muted-foreground">
            {{ selectedItems.length }} item dipilih
          </span>
          <div class="flex items-center gap-2">
            <BulkDeleteButton
              v-if="selectedItems.length > 1"
              v-permission="{ menuId: currentMenuId, action: 'delete' }"
              :count="selectedDraftCount"
              :disabled="selectedDraftCount === 0"
              @click="deleteSelected"
            />
            <Button
              variant="ghost"
              size="sm"
              class="h-7 px-2 text-xs"
              @click="clearAllSelection()"
            >
              Clear
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- CONTENT AREA -->
    <div class="flex-1 overflow-y-auto px-4 pt-3">
      <!-- Loading Skeletons -->
      <div v-if="loading && menuData.length === 0" class="space-y-3">
        <Card v-for="i in 3" :key="`skeleton-${i}`">
          <CardContent class="pt-3 space-y-2">
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-3 w-full" />
            <Skeleton class="h-3 w-2/3" />
          </CardContent>
        </Card>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredData.length === 0" class="text-center py-8">
        <p class="text-sm text-muted-foreground">Tidak ada data</p>
      </div>

      <!-- Card List with Animation -->
      <TransitionGroup v-else name="list" tag="div" class="space-y-3">
        <Card
          v-for="item in filteredData"
          :key="item.id"
          class="cursor-pointer transition-all"
          :class="[
            isMobileSelectionMode ? 'hover:border-primary/60' : 'hover:shadow-md',
            isMobileSelectionMode && isItemSelected(item.id)
              ? 'border-primary ring-2 ring-primary/20 shadow-sm'
              : '',
          ]"
          @click="
            isMobileSelectionMode
              ? toggleMobileItemSelection(item)
              : selectItem(item, 0)
          "
        >
          <CardContent class="pt-3 pb-2 space-y-2">
            <!-- Name & Status Row -->
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-start gap-3 flex-1 min-w-0">
                <Checkbox
                  v-if="isMobileSelectionMode && isDraftItem(item)"
                  :model-value="isItemSelected(item.id)"
                  class="mt-0.5"
                  @click.stop
                  @update:model-value="toggleMobileItemSelection(item)"
                />
                <div class="min-w-0">
                  <div class="font-semibold text-sm truncate">
                    {{ item.no_rfq || "-" }}
                  </div>
                  <div class="text-xs text-muted-foreground truncate">
                    {{ item.m_unit_bisnis?.nama_comp || "-" }}
                  </div>
                </div>
              </div>
              <Badge variant="outline" class="text-xs shrink-0">
                {{ item.status || "DRAFT" }}
              </Badge>
            </div>

            <!-- Details -->
            <div class="text-xs space-y-1 text-muted-foreground">
              <div>
                <span class="font-medium">Tgl RFQ:</span>
                {{ item.createdAt ? formatDate(item.createdAt) : "-" }}
              </div>
              <div>
                <span class="font-medium">Periode:</span>
                {{ item.tgl_mulai ? formatDate(item.tgl_mulai) : "-" }} -
                {{ item.tgl_akhir ? formatDate(item.tgl_akhir) : "-" }}
              </div>
              <div>
                <span class="font-medium">Catatan:</span>
                {{ item.catatan || "-" }}
              </div>
            </div>

            <!-- Action Buttons -->
            <div v-if="!isMobileSelectionMode" class="flex items-center gap-1 justify-end pt-2 border-t">
              <ViewButton
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                @click.stop="viewItem(item)"
              />
              <DeleteButton
                v-permission="{ menuId: currentMenuId, action: 'delete' }"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                :status="item.status"
                @click.stop="
                  () => {
                    selectItem(item, 0);
                    deleteSelected();
                  }
                "
              />
              <EditButton
                v-permission="{ menuId: currentMenuId, action: 'update' }"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                :status="item.status"
                @click.stop="editItem(item)"
              />
              <CopyButton
                v-permission="{ menuId: currentMenuId, action: 'create' }"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                @click.stop="copyItem(item)"
              />
              <ExportButton
                :disabled="!canExportStatus(item.status)"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                @click.stop="exportData(item)"
              />
              <SendApprovalButton
                :ignore-permission="true"
                label="Post"
                :status="item.status"
                :show-label="false"
                variant="ghost"
                size="sm"
                :disabled="
                  !isActive ||
                  isSelectedItemLocked ||
                  selectedItem?.status?.toUpperCase() !== 'DRAFT'
                "
                class="h-7 w-7 text-blue-600"
                @click.stop="openPostDialog(item)"
              />
            </div>
          </CardContent>
        </Card>
      </TransitionGroup>

      <!-- Load More Indicator -->
      <div v-if="loadingMore" class="space-y-3 mt-3">
        <Card v-for="i in 2" :key="`skeleton-more-${i}`">
          <CardContent class="pt-3 space-y-2">
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-3 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- FAB Button - Teleport -->
    <teleport to="body">
      <Button
        v-permission="{ menuId: currentMenuId, action: 'create' }"
        @click="createNew"
        class="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-6 lg:hidden h-14 w-14 rounded-full shadow-lg z-50"
        size="icon"
      >
        <Plus class="h-6 w-6" />
      </Button>
    </teleport>
  </div>

  <!-- ================================================================ -->
  <!-- DESKTOP VIEW (HIDDEN LG:FLEX) -->
  <!-- ================================================================ -->
  <div class="hidden lg:flex lg:flex-col lg:gap-4 lg:p-6">
    <!-- HEADER -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold">Transaksi RFQ</h1>
        <p class="text-sm text-muted-foreground">Kelola data RFQ</p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          @click="handleRefresh"
          :disabled="loading"
          class="shrink-0"
          title="Refresh data"
        >
          <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
        </Button>
        <Button
          v-if="currentMenuId"
          v-permission="{ menuId: currentMenuId, action: 'create' }"
          @click="createNew"
          class="gap-2 whitespace-nowrap shrink-0"
        >
          Create New
        </Button>
        <Button
          v-else
          @click="createNew"
          class="gap-2 whitespace-nowrap shrink-0"
        >
          Create New
        </Button>
      </div>
    </div>

    <!-- FILTER BAR -->
    <div class="flex flex-col gap-3 bg-muted/50 p-4 rounded-lg">
      <!-- Filter Status Row -->
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium">Status:</span>
        <Button
          variant="outline"
          size="sm"
          :class="filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
          @click="filterStatus = null"
        >
          ALL
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="filterStatus === 'DRAFT' ? 'bg-gray-700 text-white border-gray-800' : ''"
          @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'"
        >
          DRAFT
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="getApprovalStatusFilterClass('POST', filterStatus === 'POST')"
          @click="filterStatus = filterStatus === 'POST' ? null : 'POST'"
        >
          POST
        </Button>
      </div>

      <!-- Search & Action Buttons Row -->
      <div class="flex items-center gap-2">
        <!-- Search -->
        <div class="flex items-center gap-2 w-1/5">
          <div class="relative flex-1">
            <Search
              class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            />
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

        <!-- Action Buttons -->
        <div class="flex items-center gap-2">
          <DeleteButton
            v-permission="{ menuId: currentMenuId, action: 'delete' }"
            :status="selectedItem?.status"
            :disabled="!isActive || !isDraftItem(selectedItem)"
            @click="deleteSelected"
          />
          <BulkDeleteButton
            v-if="selectedItems.length > 1"
            v-permission="{ menuId: currentMenuId, action: 'delete' }"
            :count="selectedDraftCount"
            :disabled="selectedDraftCount === 0"
            @click="deleteSelected"
          />
          <ViewButton :disabled="!isActive" @click="viewItem()" />
          <EditButton
            v-permission="{ menuId: currentMenuId, action: 'update' }"
            :status="selectedItem?.status"
            :disabled="!isActive || isSelectedItemLocked"
            @click="editItem()"
          />
          <CopyButton
            v-permission="{ menuId: currentMenuId, action: 'create' }"
            :disabled="!isActive"
            @click="copyItem()"
          />
          <ExportButton
            :disabled="!isActive || !canExportStatus(selectedItem?.status)"
            @click="exportData()"
          />
          <SendApprovalButton
            :ignore-permission="true"
            label="Post"
            :status="selectedItem?.status"
            :disabled="
              !isActive ||
              isSelectedItemLocked ||
              selectedItem?.status?.toUpperCase() !== 'DRAFT'
            "
            @click="openPostDialog"
          />
        </div>
      </div>
    </div>
  </div>

  <!-- POST CONFIRMATION DIALOG -->
  <GlobalDialog
    :open="isPostDialogOpen"
    title="Post RFQ"
    :description="postDialogDescription"
    confirm-text="Post"
    cancel-text="Batal"
    :is-loading="isPosting"
    @confirm="confirmPost"
    @cancel="cancelPost"
    @update:open="isPostDialogOpen = $event"
  />

  <!-- TABLE -->
  <DataTable
    ref="dataTableRef"
    :data="filteredData"
    :columns="columns"
    :loading="loading"
    :loading-more="loadingMore"
    :has-more="hasMoreData"
    :row-select-mode="true"
    :multi-select-mode="true"
    :selected-items="selectedItems"
    :selection-checkbox-visible="() => true"
    :show-select-all="isDraftFilterActive"
    :api-filter-mode="true"
    @load-more="handleLoadMore"
    @selection-change="handleSelectionChange"
    @row-select="(item) => selectItem(item, 0)"
    @row-deselect="deselectItem"
    @filter-change="handleTableFilterChange"
  >
    <template #empty> Tidak ada data Rfq </template>
  </DataTable>

  <!-- ================================================================ -->
  <!-- DELETE CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isDeleteDialogOpen"
    title="Hapus Rfq"
    :description="deleteDialogDescription"
    type="danger"
    confirm-text="Hapus"
    cancel-text="Batal"
    :is-loading="isDeleting"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
    @update:open="isDeleteDialogOpen = $event"
  />
</template>

<style scoped>
/* TransitionGroup animations for list items */
.list-move {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.list-enter-active {
  transition: all 0.4s ease-out;
}

.list-leave-active {
  transition: all 0.3s ease-in;
  position: absolute;
}

.list-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.list-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
