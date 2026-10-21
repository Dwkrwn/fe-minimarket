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
  Edit,
  Copy,
  RefreshCw,
  X,
  Plus,
  Info,
  FilterX,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import DataTable from "@/components/table/DataTable.vue";
import {
  DeleteButton,
  EditButton,
  CopyButton,
  ViewButton,
  SendApprovalButton,
  HistoryApprovalButton,
} from "@/components/button";
import { FieldX } from "@/components/field";
import { useActionButtons } from "@/composables/useActionButtons";
import { usePermission } from "@/composables/usePermission";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  getApprovalStatusBadgeClass,
  getApprovalStatusFilterClass,
} from "@/lib/approvalStatus";
import { getSupplierList, deleteSupplier, type SupplierItem } from "./service";

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
const { API_BASE_URL } = useApi();
const authStore = useAuthStore();

// ============================================================================
// DELETE DIALOG STATE
// ============================================================================
const isDeleteDialogOpen = ref(false);
const itemToDelete = ref<SupplierItem | null>(null);
const isDeleting = ref(false);

// ============================================================================
// SEND APPROVAL DIALOG STATE
// ============================================================================
const isSendApprovalDialogOpen = ref(false);
const itemToSendApproval = ref<SupplierItem | null>(null);
const approvalCatatan = ref("");
const isSendingApproval = ref(false);

// Get current approval info from localStorage
const currentApprovalInfo = computed(() => {
  const approvalList = authStore.getApprovalList();
  return approvalList.find(
    (approval: any) =>
      approval.path === "/purchasing/master/m_supplier" &&
      approval.tipe_approve?.toUpperCase() === "MENGAJUKAN",
  );
});

// Supplier yang sudah APPROVED tetap boleh diedit karena data seperti alamat
// dapat berubah sewaktu-waktu. Hanya data yang masih dalam proses approval
// atau ditolak yang dikunci dari edit.
const isItemEditLocked = (item: SupplierItem) => {
  const status = (item as any).status?.toUpperCase();
  return status === "REJECT";
};

const isSelectedItemEditLocked = computed(() => {
  if (!selectedItem.value) return false;
  return isItemEditLocked(selectedItem.value as SupplierItem);
});

const canEditSelected = computed(
  () => isActive.value && !isSelectedItemEditLocked.value,
);

const canDeleteItem = (item: SupplierItem) => {
  return (item as any).status?.toUpperCase() === "DRAFT";
};

const canDeleteSelected = computed(
  () =>
    isActive.value &&
    !!selectedItem.value &&
    canDeleteItem(selectedItem.value as SupplierItem),
);

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<SupplierItem[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const hasMoreData = ref(true);

// ============================================================================
// FILTER & SEARCH STATE
// ============================================================================
const filterStatus = ref<"Aktif" | "Nonaktif" | null>(null);
const filterApprovalStatus = ref<
  "DRAFT" | "IN APPROVAL" | "APPROVED" | "REJECT" | "REVISI" | null
>(null);
const searchQuery = ref("");
const searchApiQuery = ref(""); // Untuk API search
const isSearching = ref(false);

// Column filters for API-based filtering
interface ColumnFilters {
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
const tableDateRangeFilters = ref<DateRangeFilters>({});

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const columns = [
  {
    key: "kode_supplier",
    label: "Kode",
    filterable: true,
    align: "left" as const,
    width: "100px",
    render: (item: SupplierItem) => item.kode_supplier || "-",
  },
  {
    key: "nama_supp",
    align: "left" as const,
    label: "Nama Supplier",
    filterable: true,
    width: "180px",
    wrapText: true,
  },
  {
    key: "tipe_supp.value1",
    label: "Tipe",
    filterable: false,
    width: "90px",
    renderHtml: (item: SupplierItem) => {
      const tipe = item.tipe_supp?.value1 || "-";
      const colorClass =
        tipe === "LOKAL"
          ? "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100"
          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}">${tipe}</span>`;
    },
  },
  { key: "kota_supp", label: "Kota", filterable: true, width: "100px" },
  {
    key: "cp1",
    label: "Contact Person",
    filterable: true,
    width: "130px",
    wrapText: true,
  },
  { key: "no_cp1", label: "No. Telp", filterable: true, width: "120px" },
  {
    key: "status",
    label: "Status Approval",
    filterable: true,
    width: "150px",
    renderHtml: (item: any) => {
      const status = item.status || "DRAFT";
      const badgeClass = getApprovalStatusBadgeClass(status);
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${status}</span>`;
    },
  },
  {
    key: "is_active",
    label: "Status Aktif",
    filterable: false,
    width: "100px",
    renderHtml: (item: SupplierItem) => {
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
/** Filter m_supplier data berdasarkan status only (search handled by API) */
const filteredData = computed(() => {
  return menuData.value.filter((item: SupplierItem) => {
    const matchStatus =
      filterStatus.value === null
        ? true
        : filterStatus.value === "Aktif"
          ? item.is_active === true
          : item.is_active === false;

    const matchApproval =
      filterApprovalStatus.value === null
        ? true
        : (item as any).status?.toUpperCase() ===
          filterApprovalStatus.value.toUpperCase();

    return matchStatus && matchApproval;
  });
});

/** Deskripsi dialog delete */
const deleteDialogDescription = computed(() => {
  if (!itemToDelete.value) return "";
  const identifier =
    itemToDelete.value.kode_supplier || itemToDelete.value.nama_supp;
  return `Apakah Anda yakin ingin menghapus Supplier "${identifier}"? Tindakan ini tidak dapat dibatalkan.`;
});

/** Deskripsi dialog send approval */
const sendApprovalDialogDescription = computed(() => {
  if (!itemToSendApproval.value) return "";
  const identifier =
    itemToSendApproval.value.kode_supplier ||
    itemToSendApproval.value.nama_supp;
  return `Kirim Supplier "${identifier}" untuk proses approval?`;
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

  // Only DRAFT can be deleted
  const status = (item as any).status?.toUpperCase();
  if (status && status !== "DRAFT") {
    toast.error("Tidak dapat menghapus", {
      description: "Hanya Supplier dengan status DRAFT yang dapat dihapus",
    });
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
    const response = await deleteSupplier(itemToDelete.value.id);

    if (response.status === "success") {
      // Remove item from list
      menuData.value = menuData.value.filter(
        (m: SupplierItem) => m.id !== itemToDelete.value!.id,
      );

      const identifier =
        itemToDelete.value.kode_supplier || itemToDelete.value.nama_supp;
      toast.success(`Supplier "${identifier}" berhasil dihapus`, {
        description: response.message || "Item telah dihapus dari database",
      });

      // Clear selection
      deselectItem();
      isDeleteDialogOpen.value = false;
    } else {
      toast.error("Gagal menghapus Supplier", {
        description: response.message || "Terjadi kesalahan saat menghapus",
      });
    }
  } catch (error) {
    toast.error("Gagal menghapus Supplier", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    isDeleting.value = false;
    itemToDelete.value = null;
  }
};

const cancelDelete = () => {
  isDeleteDialogOpen.value = false;
  itemToDelete.value = null;
};

// ============================================================================
// SEND APPROVAL FUNCTIONS
// ============================================================================
/** Open send approval dialog */
const openSendApprovalDialog = (item?: SupplierItem) => {
  if (item) {
    selectItem(item, 0);
  }

  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  itemToSendApproval.value = selectedItem.value;
  approvalCatatan.value = "";
  isSendApprovalDialogOpen.value = true;
};

/** Confirm send approval - hit API POST m_supplier_notifikasi */
const confirmSendApproval = async () => {
  if (!itemToSendApproval.value || !itemToSendApproval.value.id) return;

  isSendingApproval.value = true;
  try {
    // Get approval data from localStorage
    const approvalList = authStore.getApprovalList();
    const currentApproval = approvalList.find(
      (approval: any) =>
        approval.path === "/purchasing/master/m_supplier" &&
        approval.tipe_approve?.toUpperCase() === "MENGAJUKAN",
    );

    if (!currentApproval) {
      toast.error("Gagal mengirim approval", {
        description: "Anda tidak memiliki hak untuk mengajukan approval",
      });
      isSendingApproval.value = false;
      return;
    }

    // Validate approval data
    if (
      currentApproval.level === null ||
      currentApproval.level === undefined ||
      !currentApproval.sender_id
    ) {
      toast.error("Data approval tidak lengkap", {
        description:
          "Konfigurasi approval tidak valid. Silakan hubungi administrator.",
        duration: 6000,
      });
      isSendingApproval.value = false;
      return;
    }

    // Prepare payload
    const payload = {
      approval_level: currentApproval.level,
      sender_id: currentApproval.sender_id,
      m_supplier_id: itemToSendApproval.value.id,
      approval_message: approvalCatatan.value.trim() || null,
    };

    // Call API POST /dynamic/m_supplier_notifikasi
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

    if (result.status === "success") {
      // Update status item di list
      const itemIndex = menuData.value.findIndex(
        (m: SupplierItem) => m.id === itemToSendApproval.value!.id,
      );
      if (itemIndex !== -1) {
        (menuData.value[itemIndex] as any).status = "IN APPROVAL";
      }

      const identifier =
        itemToSendApproval.value.kode_supplier ||
        itemToSendApproval.value.nama_supp;
      toast.success("Approval berhasil dikirim", {
        description: `Supplier "${identifier}" telah dikirim untuk approval`,
      });

      isSendApprovalDialogOpen.value = false;
      deselectItem();
    } else {
      toast.error("Gagal mengirim approval", {
        description:
          result.message || "Terjadi kesalahan saat mengirim approval",
      });
    }
  } catch (error) {
    toast.error("Gagal mengirim approval", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    isSendingApproval.value = false;
    itemToSendApproval.value = null;
    approvalCatatan.value = "";
  }
};

const cancelSendApproval = () => {
  isSendApprovalDialogOpen.value = false;
  itemToSendApproval.value = null;
  approvalCatatan.value = "";
};

// ============================================================================
// EXPORT & EDIT FUNCTIONS
// ============================================================================
/** Export m_supplier data */
const exportData = () => {
  toast.info("Export feature coming soon");
};

/** View Supplier item details */
const viewItem = (item?: any) => {
  if (item) {
    selectItem(item, 0);
  }

  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  // Navigate to view page (read-only mode)
  router.push(`/purchasing/master/m_supplier/view/${selectedItem.value.id}`);
};

/** Edit Supplier item */
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

  // Check if status is locked for edit (IN APPROVAL, REJECT)
  const targetItem = item || selectedItem.value;
  if (targetItem && isItemEditLocked(targetItem)) {
    toast.error("Tidak dapat mengedit", {
      description: `Data dengan status ${(targetItem as any).status} tidak dapat diubah`,
    });
    return;
  }

  const selectedItemData = handleEdit(item);
  if (!selectedItemData) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }
  // Navigate to edit form
  router.push(`/purchasing/master/m_supplier/form/${selectedItemData.id}`);
};

/** Copy Supplier item - duplicate data tanpa ID untuk create new */
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
    path: "/purchasing/master/m_supplier/form",
    query: {
      action: "copy",
      source: selectedItemData.id,
    },
  });

  const identifier =
    selectedItemData.kode_supplier || selectedItemData.nama_supp;
  toast.success(`Menyalin data "${identifier}"`, {
    description: "Silakan edit dan simpan sebagai Supplier baru",
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

  router.push("/purchasing/master/m_supplier/form");
};

// ============================================================================
// API & DATA FETCHING FUNCTIONS
// ============================================================================
/** Fetch m_supplier data dari API with search support */
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
  if (page === 1 || resetData) {
    loading.value = true;
  } else {
    loadingMore.value = true;
  }

  try {
    // Prepare column filters with proper API field names
    const apiColumnFilters: ColumnFilters = {};
    Object.entries(tableColumnFilters.value).forEach(([key, value]) => {
      if (value && value.trim()) {
        const col = columns.find((c) => c.key === key);
        const filterKey = (col as any)?.apiFilterField || key;
        apiColumnFilters[filterKey] = value;
      }
    });

    // Call API with search and filter parameters
    const response = await getSupplierList(
      page,
      pageSize.value,
      "createdAt",
      "DESC",
      searchApiQuery.value || undefined,
      searchApiQuery.value
        ? "kode_supplier,nama_supp,kota_supp,cp1,no_telp"
        : undefined,
      Object.keys(apiColumnFilters).length > 0 ? apiColumnFilters : undefined,
    );

    if (response.status === "success") {
      if (page === 1 || resetData) {
        menuData.value = response.data;
        // Clear selection when data is refreshed
        if (resetData) {
          deselectItem();
        }
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
    toast.error("Gagal memuat data Supplier", {
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
  dateRange: Record<string, { from: string; to: string }>;
}) => {
  // Update local filter state
  tableColumnFilters.value = filters.column;
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
  tableDateRangeFilters.value = {};
  menuData.value = [];
  currentPage.value = 1;
  hasMoreData.value = true;
  deselectItem();

  // Reload data
  await fetchMenuData(1, true);

  toast.success("Data berhasil dimuat ulang");
};

/** Clear all filters and reset to initial state */
const clearAllFilters = async () => {
  // Reset all filter states
  filterStatus.value = null;
  filterApprovalStatus.value = null;
  searchQuery.value = "";
  searchApiQuery.value = "";
  tableColumnFilters.value = {};
  tableDateRangeFilters.value = {};
  
  // Reset pagination
  menuData.value = [];
  currentPage.value = 1;
  hasMoreData.value = true;
  
  // Reload data
  await fetchMenuData(1, true);

  toast.success("Semua filter telah direset");
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
            <h1 class="text-lg font-bold">Master Supplier</h1>
            <p class="text-xs text-muted-foreground">
              Kelola Supplier aplikasi
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              @click="clearAllFilters"
              :disabled="loading"
              class="h-8 w-8"
              title="Reset semua filter"
            >
              <FilterX class="h-4 w-4" />
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
        <!-- Filter Approval Status Buttons -->
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-medium text-muted-foreground">
            Approval:
          </span>

          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7 whitespace-nowrap transition-all duration-200"
            :class="
              filterApprovalStatus === null
                ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200'
                : ''
            "
            @click="filterApprovalStatus = null"
          >
            ALL
          </Button>
          <Button
            v-for="s in [
              'DRAFT',
              'IN APPROVAL',
              'APPROVED',
              'REJECT',
              'REVISI',
            ]"
            :key="s"
            variant="outline"
            size="sm"
            class="text-xs h-7 whitespace-nowrap transition-all duration-200"
            :class="getApprovalStatusFilterClass(s, filterApprovalStatus === s)"
            @click="
              filterApprovalStatus =
                filterApprovalStatus === s ? null : (s as any)
            "
          >
            {{ s }}
          </Button>
        </div>

        <!-- Filter Status Aktif/Nonaktif -->
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
                  {{ item.nama_supp || "-" }}
                </div>
                <div class="text-xs text-muted-foreground truncate">
                  {{ item.kode_supplier || "-" }}
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
              <div v-if="item.kota_supp">
                <span class="font-medium">Kota:</span> {{ item.kota_supp }}
              </div>
              <div v-if="item.cp1">
                <span class="font-medium">Contact Person:</span> {{ item.cp1 }}
              </div>
              <div v-if="item.no_cp1">
                <span class="font-medium">No. Telp:</span> {{ item.no_cp1 }}
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
                :disabled="!canDeleteItem(item)"
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
                :disabled="isItemEditLocked(item)"
                @click.stop="editItem(item)"
              />
              <CopyButton
                v-permission="{ menuId: currentMenuId, action: 'create' }"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                @click.stop="copyItem(item)"
              />
              <SendApprovalButton
                path="/purchasing/master/m_supplier"
                :status="(item as any).status"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                :showLabel="false"
                :disabled="false"
                @click.stop="
                  () => {
                    selectItem(item, 0);
                    openSendApprovalDialog(item);
                  }
                "
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
  <div class="hidden lg:block p-6 space-y-6 mx-auto">
    <!-- HEADER -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold">Master Supplier</h1>
        <p class="text-sm text-muted-foreground">Kelola Supplier aplikasi</p>
      </div>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          @click="clearAllFilters"
          :disabled="loading"
          class="shrink-0"
          title="Reset semua filter"
        >
          <FilterX class="h-4 w-4" />
        </Button>
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
      <!-- Filter Approval Status Buttons -->
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-sm font-medium">Approval:</span>
        <Button
          variant="outline"
          size="sm"
          class="text-sm h-7 whitespace-nowrap transition-all duration-200"
          :class="
            filterApprovalStatus === null
              ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200'
              : ''
          "
          @click="filterApprovalStatus = null"
        >
          ALL
        </Button>
        <Button
          v-for="s in ['DRAFT', 'IN APPROVAL', 'APPROVED', 'REJECT', 'REVISI']"
          :key="s"
          variant="outline"
          size="sm"
          class="text-sm h-7 whitespace-nowrap transition-all duration-200"
          :class="getApprovalStatusFilterClass(s, filterApprovalStatus === s)"
          @click="
            filterApprovalStatus =
              filterApprovalStatus === s ? null : (s as any)
          "
        >
          {{ s }}
        </Button>
      </div>

      <!-- Filter Status Row -->
      <div class="flex items-center gap-2 flex-wrap">
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
            :disabled="!canDeleteSelected"
            @click="deleteSelected"
          />
          <ViewButton :disabled="!isActive" @click="viewItem()" />
          <EditButton
            v-permission="{ menuId: currentMenuId, action: 'update' }"
            :disabled="!canEditSelected"
            @click="editItem()"
          />
          <CopyButton
            v-permission="{ menuId: currentMenuId, action: 'create' }"
            :disabled="!isActive"
            @click="copyItem()"
          />
          <SendApprovalButton
            path="/purchasing/master/m_supplier"
            :status="selectedItem?.status"
            variant="default"
            size="default"
            :showLabel="true"
            :disabled="!isActive"
            @click="openSendApprovalDialog()"
          />
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
      :row-height="45"
      @load-more="handleLoadMore"
      @row-select="(item) => selectItem(item, 0)"
      @row-deselect="deselectItem"
      @filter-change="handleTableFilterChange"
    >
      <template #empty> Tidak ada data Supplier </template>
    </DataTable>
  </div>

  <!-- ================================================================ -->
  <!-- DELETE CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isDeleteDialogOpen"
    title="Hapus Supplier"
    :description="deleteDialogDescription"
    type="danger"
    confirm-text="Hapus"
    cancel-text="Batal"
    :is-loading="isDeleting"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
    @update:open="isDeleteDialogOpen = $event"
  />

  <!-- ================================================================ -->
  <!-- SEND APPROVAL DIALOG -->
  <!-- ================================================================ -->
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
          <DialogTitle class="text-lg">Kirim Approval</DialogTitle>
        </div>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- ITEM INFO -->
        <div v-if="itemToSendApproval" class="p-3 bg-muted rounded-md">
          <p class="text-sm font-medium">Supplier:</p>
          <p class="text-sm text-muted-foreground">
            {{
              itemToSendApproval.kode_supplier ||
              itemToSendApproval.nama_supp ||
              "Tanpa Kode"
            }}
          </p>
        </div>

        <!-- SENDER INFO -->
        <div v-if="currentApprovalInfo" class="space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">Pengirim:</p>
            <p class="text-sm text-muted-foreground">
              {{ currentApprovalInfo.sender_name }}
            </p>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">Tipe Approval:</p>
            <p class="text-sm font-medium text-primary">
              {{ currentApprovalInfo.tipe_approve }}
            </p>
          </div>
        </div>

        <!-- CATATAN APPROVAL -->
        <div class="border-t pt-4">
          <FieldX
            id="approval-catatan"
            type="textarea"
            v-model="approvalCatatan"
            label="Catatan Approval"
            placeholder="Masukkan catatan untuk approval (opsional)"
            hints="Catatan ini akan dikirim ke penerima approval"
            :disabled="isSendingApproval"
            :rows="4"
          />
        </div>
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
          <span v-if="isSendingApproval">Mengirim...</span>
          <span v-else>Send</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
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
