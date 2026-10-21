<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, computed, onMounted, onUnmounted, TransitionGroup } from "vue";
import { useRouter } from "vue-router";
import {
  Search,
  Trash2,
  FileDown,
  FileUp,
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
import { Skeleton } from "@/components/ui/skeleton";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import DataTable from "@/components/table/DataTable.vue";
import {
  DeleteButton,
  ExportButton,
  EditButton,
  CopyButton,
  ViewButton,
} from "@/components/button";
import { useActionButtons } from "@/composables/useActionButtons";
import { usePermission } from "@/composables/usePermission";
import {
  getTransformList,
  deleteTransform,
  type TransformItem,
} from "./service";
import { useAuthStore } from "@/stores/auth";
import { useApi } from "@/composables/useApi";

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
  canRead,
  canCreate,
  canUpdate,
  canDelete,
  canPrint,
  isSuperAdmin,
} = usePermission();

const authStore = useAuthStore();
const { API_BASE_URL } = useApi();

const isExporting = ref(false);
const isImporting = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

// ============================================================================
// DELETE DIALOG STATE
// ============================================================================
const isDeleteDialogOpen = ref(false);
const itemToDelete = ref<TransformItem | null>(null);
const isDeleting = ref(false);

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<TransformItem[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const hasMoreData = ref(true);

// ============================================================================
// FILTER & SEARCH STATE
// ============================================================================
const filterStatus = ref<"Aktif" | "Nonaktif" | null>(null);
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

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const columns = [
  {
    key: "transform_no",
    label: "No. Transform",
    filterable: true,
    width: "180px",
  },
  {
    key: "m_item.nama_item",
    label: "Item",
    filterable: true,
    width: "250px",
    valueGetter: (item: any) => item.m_item?.nama_item || item.m_item?.nama || "",
    renderHtml: (item: any) =>
      item.m_item?.nama_item || item.m_item?.nama || "-",
  },
  { 
    key: "m_general.value1", 
    label: "Tipe", 
    filterable: true, 
    width: "150px",
    valueGetter: (item: any) => item.m_general?.value1 || "",
    renderHtml: (item: any) => item.m_general?.value1 || "-",
  },
  { key: "note", label: "Catatan", filterable: true, width: "200px" },
  {
    key: "is_active",
    label: "Status",
    filterable: false,
    width: "120px",
    renderHtml: (item: TransformItem) => {
      const isActive = item.is_active;
      const text = isActive ? "Aktif" : "Nonaktif";
      const colorClass = isActive
        ? "text-green-600 dark:text-green-400"
        : "text-red-600 dark:text-red-400";
      return `<span class="font-bold ${colorClass}">${text}</span>`;
    },
  },
];

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================
/** Filter m_transform data berdasarkan status and relation fallback */
const filteredData = computed(() => {
  return menuData.value.filter((item: TransformItem) => {
    const matchStatus =
      filterStatus.value === null
        ? true
        : filterStatus.value === "Aktif"
          ? item.is_active === true
          : item.is_active === false;

    // Client-side fallback for relational columns if there are multiple
    const colFilters = tableColumnFilters.value;
    const relationParts = Object.entries(colFilters).filter(
      ([key, val]) => key.includes(".") && val?.trim()
    );

    let matchRelations = true;
    if (relationParts.length > 1) {
      const fallbackParts = relationParts.slice(1);
      matchRelations = fallbackParts.every(([key, val]) => {
        let objValue: any = item;
        const parts = key.split(".");
        for (const part of parts) {
          objValue = objValue?.[part];
        }
        // Extra check for m_item.nama_item vs m_item.nama since backend might return either
        if (key === "m_item.nama_item" && !objValue) {
          objValue = item.m_item?.nama;
        }
        const strVal = String(objValue || "").toLowerCase();
        return strVal.includes(val.trim().toLowerCase());
      });
    }

    return matchStatus && matchRelations;
  });
});

/** Deskripsi dialog delete */
const deleteDialogDescription = computed(() => {
  if (!itemToDelete.value) return "";
  return `Apakah Anda yakin ingin menghapus Transform "${(itemToDelete.value as any).transform_no}"? Tindakan ini tidak dapat dibatalkan.`;
});

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
/** Trigger delete dialog */
const deleteSelected = () => {
  // Check permission
  if (!canDelete.value) {
    toast.error("Akses Ditolak", {
      description: "Anda tidak memiliki izin untuk menghapus data",
    });
    return;
  }

  const item = handleDelete();
  if (!item) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  itemToDelete.value = item;
  isDeleteDialogOpen.value = true;
};

/** Konfirmasi delete - hit API dan update UI */
const confirmDelete = async () => {
  if (!itemToDelete.value) return;

  isDeleting.value = true;
  try {
    const response = await deleteTransform(itemToDelete.value.id);

    if (response.status === "success") {
      // Remove item from list
      menuData.value = menuData.value.filter(
        (m: TransformItem) => m.id !== itemToDelete.value!.id,
      );

      toast.success(
        `Transform "${(itemToDelete.value as any).transform_no}" berhasil dihapus`,
        {
          description: response.message || "Item telah dihapus dari database",
        },
      );

      // Clear selection
      deselectItem();
      isDeleteDialogOpen.value = false;
    } else {
      toast.error("Gagal menghapus Transform", {
        description: response.message || "Terjadi kesalahan saat menghapus",
      });
    }
  } catch (error) {
    toast.error("Gagal menghapus Transform", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    isDeleting.value = false;
    isDeleteDialogOpen.value = false
    itemToDelete.value = null;
  }
};

const cancelDelete = () => {
  isDeleteDialogOpen.value = false;
  itemToDelete.value = null;
};

// ============================================================================
// EXPORT & IMPORT FUNCTIONS
// ============================================================================
/** Export m_transform data */
const handleExport = async () => {
  isExporting.value = true;
  try {
    let apiUrl = `${API_BASE_URL}/fn/m_transform/exportExcel`;
    
    const params = new URLSearchParams();
    if (searchQuery.value) {
      params.append("search", searchQuery.value);
    }
    if (filterStatus.value) {
      params.append("is_active", filterStatus.value === "Aktif" ? "true" : "false");
    }
    
    const queryString = params.toString();
    if (queryString) {
      apiUrl += `?${queryString}`;
    }

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${authStore.token}` },
    });

    if (!response.ok) throw new Error("Gagal mengexport data");

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transform_export_${new Date().getTime()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast.success("Export berhasil", {
      description: "Data Transform berhasil diexport",
    });
  } catch (error) {
    toast.error("Gagal export data", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    isExporting.value = false;
  }
};

const handleImportClick = () => {
  fileInputRef.value?.click();
};

const handleFileSelected = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;

  if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
    toast.error("Format file tidak valid", {
      description: "Silakan pilih file Excel (.xlsx atau .xls)",
    });
    return;
  }

  isImporting.value = true;
  try {
    const formData = new FormData();
    formData.append("excelData", file);

    const response = await fetch(`${API_BASE_URL}/fn/m_transform/importExcel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authStore.token}` },
      body: formData,
    });

    const result = await response.json();

    if (result.status === "success" || result.message === "Excel imported") {
      toast.success("Import berhasil", {
        description: result.message || "Data berhasil diimport",
      });
      await handleRefresh();
    } else {
      toast.error("Gagal import data", {
        description: result.message || "Terjadi kesalahan saat import",
      });
    }
  } catch (error) {
    toast.error("Gagal import data", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    isImporting.value = false;
    if (fileInputRef.value) {
      fileInputRef.value.value = "";
    }
  }
};

/** View Transform item details */
const viewItem = (item?: any) => {
  if (item) {
    selectItem(item, 0);
  }

  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  // Navigate to view page (read-only mode)
  router.push(`/inventory/master/m_transform/view/${selectedItem.value.id}`);
};

/** Edit Transform item */
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
  const selectedItemData = handleEdit(item);
  if (!selectedItemData) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }
  // Navigate to edit form
  router.push(`/inventory/master/m_transform/form/${selectedItemData.id}`);
};

/** Copy Transform item - duplicate data tanpa ID untuk create new */
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
  if (!selectedItemData) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  // Navigate ke form create dengan data yang sama (tanpa ID)
  // Query param action=copy akan trigger mode copy di form
  router.push({
    path: "/inventory/master/m_transform/form",
    query: {
      action: "copy",
      source: selectedItemData.id,
    },
  });

  toast.success(`Menyalin data "${selectedItemData.transform_no}"`, {
    description: "Silakan edit dan simpan sebagai Transform baru",
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

  router.push("/inventory/master/m_transform/form");
};

// ============================================================================
// API & DATA FETCHING FUNCTIONS
// ============================================================================
/** Fetch m_transform data dari API with search support */
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
  if (page === 1 || resetData) {
    loading.value = true;
  } else {
    loadingMore.value = true;
  }

  try {
    // Split column filters: relation cols (contain '.') -> search+searchfield, direct cols -> filter_column_{key}
    const colFilters = tableColumnFilters.value;
    const directColumnFilters: Record<string, string> = {};
    const relationSearchParts: Array<{ field: string; value: string }> = [];

    Object.entries(colFilters).forEach(([key, value]) => {
      if (!value?.trim()) return;
      if (key.includes(".")) {
        relationSearchParts.push({ field: key, value: value.trim() });
      } else {
        directColumnFilters[`filter_column_${key}`] = value.trim();
      }
    });

    const globalSearchFields = [
      "transform_no",
      "note",
      "m_general.value1",
      "m_items.nama_item",
    ].join(",");

    let effectiveSearch = searchApiQuery.value || undefined;
    let effectiveSearchFields = searchApiQuery.value ? globalSearchFields : undefined;

    if (relationSearchParts.length > 0) {
      const firstRelation = relationSearchParts[0]!;
      // Fix frontend typo "m_item" to actual backend alias "m_items"
      let field = firstRelation.field;
      if (field.startsWith("m_item.")) {
        field = field.replace("m_item.", "m_items.");
      }
      effectiveSearch = firstRelation.value;
      effectiveSearchFields = field;

      if (searchApiQuery.value) {
        effectiveSearch = searchApiQuery.value;
        effectiveSearchFields = [globalSearchFields, field].join(",");
      }
    }

    // Call API with search parameters
    const response = await getTransformList(
      page,
      pageSize.value,
      "createdAt",
      "DESC",
      effectiveSearch,
      effectiveSearchFields,
      directColumnFilters
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
    toast.error("Gagal memuat data Transform", {
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
  menuData.value = [];
  currentPage.value = 1;
  hasMoreData.value = true;
  deselectItem();

  // Reload data
  await fetchMenuData(1, true);

  toast.success("Data berhasil dimuat ulang");
};

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
  deselectItem();

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
  deselectItem();
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
            <h1 class="text-lg font-bold">Master Transform</h1>
            <p class="text-xs text-muted-foreground">Kelola data Transform</p>
          </div>
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

        <!-- Filter Status Buttons -->
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7"
            :class="
              filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''
            "
            @click="filterStatus = null"
          >
            All
          </Button>

          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7"
            :class="
              filterStatus === 'Aktif' ? 'bg-green-100 text-green-800 border-green-500 hover:bg-green-200' : ''
            "
            @click="filterStatus = filterStatus === 'Aktif' ? null : 'Aktif'"
          >
            Aktif
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7"
            :class="
              filterStatus === 'Nonaktif' ? 'bg-red-100 text-red-800 border-red-500 hover:bg-red-200' : ''
            "
            @click="
              filterStatus = filterStatus === 'Nonaktif' ? null : 'Nonaktif'
            "
          >
            Nonaktif
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
          class="cursor-pointer hover:shadow-md transition-all"
          @click="selectItem(item, 0)"
        >
          <CardContent class="pt-3 pb-2 space-y-2">
            <!-- Name & Status Row -->
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm truncate">
                  {{ item.transform_no || "-" }}
                </div>
                <div class="text-xs text-muted-foreground truncate">
                  {{ item.m_item?.nama_item || item.m_item?.nama || "-" }}
                </div>
              </div>
              <Badge
                :variant="item.is_active ? 'default' : 'secondary'"
                class="text-xs shrink-0"
              >
                {{ item.is_active ? "Aktif" : "Nonaktif" }}
              </Badge>
            </div>

            <!-- Details -->
            <div class="text-xs space-y-1 text-muted-foreground">
              <div v-if="item.tipe">
                <span class="font-medium">Tipe:</span>
                {{ item.m_general?.value1 }}
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-1 justify-end pt-2 border-t">
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
                @click.stop="editItem(item)"
              />
              <CopyButton
                v-permission="{ menuId: currentMenuId, action: 'create' }"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                @click.stop="copyItem(item)"
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
        <h1 class="text-2xl font-bold">Master Transform</h1>
        <p class="text-sm text-muted-foreground">Kelola data Transform</p>
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
          All
        </Button>

        <Button
          variant="outline"
          size="sm"
          :class="filterStatus === 'Aktif' ? 'bg-green-100 text-green-800 border-green-500 hover:bg-green-200' : ''"
          @click="filterStatus = filterStatus === 'Aktif' ? null : 'Aktif'"
        >
          Aktif
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="
            filterStatus === 'Nonaktif' ? 'bg-red-100 text-red-800 border-red-500 hover:bg-red-200' : ''
          "
          @click="
            filterStatus = filterStatus === 'Nonaktif' ? null : 'Nonaktif'
          "
        >
          Nonaktif
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
            :disabled="!isActive"
            @click="deleteSelected"
          />
          <ViewButton :disabled="!isActive" @click="viewItem()" />
          <EditButton
            v-permission="{ menuId: currentMenuId, action: 'update' }"
            :disabled="!isActive"
            @click="editItem()"
          />
          <CopyButton
            v-permission="{ menuId: currentMenuId, action: 'create' }"
            :disabled="!isActive"
            @click="copyItem()"
          />

          <!-- Divider -->
          <div class="w-px h-6 bg-border mx-1" />

          <!-- Export -->
          <Button
            v-if="canCreate || canRead"
            variant="outline"
            size="default"
            @click="handleExport"
            :disabled="isExporting"
            class="gap-2"
            title="Export semua data"
          >
            <FileDown class="h-4 w-4" />
          </Button>

          <!-- Import -->
          <Button
            v-if="canCreate"
            variant="outline"
            size="default"
            @click="handleImportClick"
            :disabled="isImporting"
            class="gap-2"
            title="Import data dari Excel"
          >
            <FileUp class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>

    <!-- TABLE -->
    <DataTable
      :data="filteredData"
      :columns="columns"
      :loading="loading"
      :loading-more="loadingMore"
      :has-more="hasMoreData"
      :row-select-mode="true"
      :api-filter-mode="true"
      @load-more="handleLoadMore"
      @row-select="(item) => selectItem(item, 0)"
      @row-deselect="deselectItem"
      @filter-change="handleTableFilterChange"
    >
      <template #empty> Tidak ada data Transform </template>
    </DataTable>
  </div>

  <!-- ================================================================ -->
  <!-- DELETE CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isDeleteDialogOpen"
    title="Hapus Transform"
    :description="deleteDialogDescription"
    type="danger"
    confirm-text="Hapus"
    cancel-text="Batal"
    :is-loading="isDeleting"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
    @update:open="isDeleteDialogOpen = $event"
  />

  <input
    ref="fileInputRef"
    type="file"
    accept=".xlsx,.xls"
    style="display: none"
    @change="handleFileSelected"
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
