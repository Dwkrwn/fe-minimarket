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
  ExportButton,
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
import { getApprovalStatusBadgeClass } from "@/lib/approvalStatus";
import { getCustomerList, deleteCustomer, type CustomerItem } from "./service";

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

const getRespoUnitBisnisIdFromSelectRespo = (): string | undefined => {
  try {
    const selectRespo = localStorage.getItem("SelectRespo");
    if (!selectRespo) return undefined;
    const parsed = JSON.parse(selectRespo);
    return (
      parsed.companyId ||
      parsed.m_unit_bisnis_id ||
      parsed.unitBisnisId ||
      undefined
    );
  } catch (error) {
    console.error("Failed to parse SelectRespo:", error);
    return undefined;
  }
};

// ============================================================================
// DELETE DIALOG STATE
// ============================================================================
const isDeleteDialogOpen = ref(false);
const itemToDelete = ref<CustomerItem | null>(null);
const isDeleting = ref(false);
const isSendApprovalDialogOpen = ref(false);
const itemToSendApproval = ref<CustomerItem | null>(null);
const approvalCatatan = ref("");
const isSendingApproval = ref(false);

const currentApprovalInfo = computed(() => {
  const approvalList = authStore.getApprovalList();
  return approvalList.find(
    (approval: any) =>
      approval.path === "/marketing/master/m_customer" &&
      approval.tipe_approve?.toUpperCase() === "MENGAJUKAN",
  );
});

const isItemStatusLocked = (item: CustomerItem) => {
  const status = (item as any).status?.toUpperCase();
  return (
    status === "IN APPROVAL" || status === "APPROVED" || status === "REJECT"
  );
};

const canEditOrDelete = computed(() => {
  if (!selectedItem.value) return false;
  return !isItemStatusLocked(selectedItem.value as CustomerItem);
});

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<CustomerItem[]>([]);
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
// HELPER FUNCTIONS
// ============================================================================
/** Get status badge styling */
const getStatusStyle = getApprovalStatusBadgeClass;

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const columns = [
  { key: "kode_customer", label: "Kode", filterable: true, width: "150px" },
  {
    key: "nama_customer",
    label: "Nama Customer",
    filterable: true,
    width: "250px",
  },
  { key: "alamat", label: "Alamat", filterable: true, width: "300px" },
  { key: "no_telp_office", label: "Telepon", filterable: true, width: "150px" },
  { key: "email", label: "Email", filterable: true, width: "200px" },
  {
    key: "status",
    label: "Status",
    filterable: true,
    width: "140px",
    renderHtml: (item: CustomerItem) => {
      const status = item.status || "DRAFT";
      const badgeClass = getStatusStyle(status);
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${status}</span>`;
    },
  },
  {
    key: "is_active",
    label: "Active",
    filterable: false,
    width: "120px",
    renderHtml: (item: CustomerItem) => {
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
/** Filter m_customer data berdasarkan status only (search handled by API) */
const filteredData = computed(() => {
  return menuData.value.filter((item: CustomerItem) => {
    const matchStatus =
      filterStatus.value === null
        ? true
        : filterStatus.value === "Aktif"
          ? item.is_active === true
          : item.is_active === false;

    return matchStatus;
  });
});

/** Deskripsi dialog delete */
const deleteDialogDescription = computed(() => {
  if (!itemToDelete.value) return "";
  return `Apakah Anda yakin ingin menghapus Customer "${itemToDelete.value.nama_customer || itemToDelete.value.kode_customer}"? Tindakan ini tidak dapat dibatalkan.`;
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
  if (isItemStatusLocked(item)) {
    toast.error("Tidak dapat menghapus", {
      description: "Data dengan status approval terkunci tidak dapat dihapus",
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
    const response = await deleteCustomer(itemToDelete.value.id);

    if (response.status === "success") {
      // Remove item from list
      menuData.value = menuData.value.filter(
        (m: CustomerItem) => m.id !== itemToDelete.value!.id,
      );

      toast.success(
        `Customer "${itemToDelete.value.nama_customer || itemToDelete.value.kode_customer}" berhasil dihapus`,
        {
          description: response.message || "Item telah dihapus dari database",
        },
      );

      // Clear selection
      deselectItem();
      isDeleteDialogOpen.value = false;
    } else {
      toast.error("Gagal menghapus Customer", {
        description: response.message || "Terjadi kesalahan saat menghapus",
      });
    }
  } catch (error) {
    toast.error("Gagal menghapus Customer", {
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

const openSendApprovalDialog = (item?: CustomerItem) => {
  if (item) {
    selectItem(item, 0);
  }
  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }
  itemToSendApproval.value = selectedItem.value as CustomerItem;
  approvalCatatan.value = "";
  isSendApprovalDialogOpen.value = true;
};

const confirmSendApproval = async () => {
  if (!itemToSendApproval.value?.id) return;

  isSendingApproval.value = true;
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

    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_customer_notifikasi`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({
          approval_level: currentApproval.level,
          sender_id: currentApproval.sender_id,
          m_customer_id: itemToSendApproval.value.id,
          approval_message: approvalCatatan.value.trim() || null,
        }),
      },
    );
    const result = await response.json();

    if (result.status === "success") {
      const itemIndex = menuData.value.findIndex(
        (m: CustomerItem) => m.id === itemToSendApproval.value!.id,
      );
      if (itemIndex !== -1) {
        const updatedItem = {
          ...menuData.value[itemIndex],
          status: "IN APPROVAL",
        } as CustomerItem;
        menuData.value.splice(itemIndex, 1, updatedItem);
      }
      toast.success("Approval berhasil dikirim", {
        description: `Customer "${itemToSendApproval.value.nama_customer || itemToSendApproval.value.kode_customer || ""}" telah dikirim untuk approval`,
      });

      isSendApprovalDialogOpen.value = false;
      deselectItem();
      // await handleRefresh();
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
/** Export m_customer data */
const exportData = () => {
  toast.info("Export feature coming soon");
};

/** View Customer item details */
const viewItem = (item?: any) => {
  if (item) {
    selectItem(item, 0);
  }

  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  // Navigate to view page (read-only mode)
  router.push(`/marketing/master/m_customer/view/${selectedItem.value.id}`);
};

/** Edit Customer item */
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
  const targetItem = (item || selectedItem.value) as CustomerItem | null;
  if (targetItem && isItemStatusLocked(targetItem)) {
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
  router.push(`/marketing/master/m_customer/form/${selectedItemData.id}`);
};

/** Copy Customer item - duplicate data tanpa ID untuk create new */
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
    path: "/marketing/master/m_customer/form",
    query: {
      action: "copy",
      source: selectedItemData.id,
    },
  });

  toast.success(
    `Menyalin data "${selectedItemData.nama_customer || selectedItemData.kode_customer}"`,
    {
      description: "Silakan edit dan simpan sebagai Customer baru",
    },
  );
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

  router.push("/marketing/master/m_customer/form");
};

// ============================================================================
// API & DATA FETCHING FUNCTIONS
// ============================================================================
/** Fetch m_customer data dari API with search support */
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
  if (page === 1 || resetData) {
    loading.value = true;
  } else {
    loadingMore.value = true;
  }

  try {
    // Call API with search parameters
    const response = await getCustomerList(
      page,
      pageSize.value,
      "createdAt",
      "DESC",
      searchApiQuery.value || undefined,
      searchApiQuery.value
        ? "kode_customer,nama_customer,alamat,email,no_telp_office"
        : undefined,
      getRespoUnitBisnisIdFromSelectRespo(),
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
    toast.error("Gagal memuat data Customer", {
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
            <h1 class="text-lg font-bold">Master Customer</h1>
            <p class="text-xs text-muted-foreground">Kelola data Customer</p>
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
              filterStatus === null
                ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200'
                : ''
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
              filterStatus === 'Aktif'
                ? 'bg-green-100 text-green-800 border-green-500 hover:bg-green-200'
                : ''
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
              filterStatus === 'Nonaktif'
                ? 'bg-red-100 text-red-800 border-red-500 hover:bg-red-200'
                : ''
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
                  {{ item.nama_customer || "-" }}
                </div>
                <div class="text-xs text-muted-foreground truncate">
                  {{ item.kode_customer || "-" }}
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
              <div v-if="item.alamat">
                <span class="font-medium">Alamat:</span> {{ item.alamat }}
              </div>
              <div v-if="item.no_telp_office">
                <span class="font-medium">Telepon:</span>
                {{ item.no_telp_office }}
              </div>
              <div v-if="item.email">
                <span class="font-medium">Email:</span> {{ item.email }}
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
                :disabled="isItemStatusLocked(item)"
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
                :disabled="isItemStatusLocked(item)"
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
                path="/marketing/master/m_customer"
                :status="(item as any).status"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                :showLabel="false"
                @click.stop="
                  () => {
                    selectItem(item, 0);
                    openSendApprovalDialog(item);
                  }
                "
              />
              <HistoryApprovalButton
                :record-id="item.id || ''"
                notification-endpoint="m_customer_notifikasi"
                foreign-key-column="m_customer_id"
                :record-label="item.nama_customer || 'Tanpa Nama'"
                :document-status="(item as any).status"
                :created-at="(item as any).createdAt"
                variant="ghost"
                size="sm"
                :show-label="false"
                class="h-7 w-7"
                @click.stop
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
        <h1 class="text-2xl font-bold">Master Customer</h1>
        <p class="text-sm text-muted-foreground">Kelola data Customer</p>
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
          :class="
            filterStatus === null
              ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200'
              : ''
          "
          @click="filterStatus = null"
        >
          All
        </Button>

        <Button
          variant="outline"
          size="sm"
          :class="
            filterStatus === 'Aktif'
              ? 'bg-green-100 text-green-800 border-green-500 hover:bg-green-200'
              : ''
          "
          @click="filterStatus = filterStatus === 'Aktif' ? null : 'Aktif'"
        >
          Aktif
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="
            filterStatus === 'Nonaktif'
              ? 'bg-red-100 text-red-800 border-red-500 hover:bg-red-200'
              : ''
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
            :disabled="!canEditOrDelete"
            @click="deleteSelected"
          />
          <ViewButton :disabled="!isActive" @click="viewItem()" />
          <EditButton
            v-permission="{ menuId: currentMenuId, action: 'update' }"
            :disabled="!canEditOrDelete"
            @click="editItem()"
          />
          <CopyButton
            v-permission="{ menuId: currentMenuId, action: 'create' }"
            :disabled="!isActive"
            @click="copyItem()"
          />
          <SendApprovalButton
            path="/marketing/master/m_customer"
            :status="selectedItem?.status"
            variant="default"
            size="default"
            :showLabel="true"
            :disabled="!isActive"
            @click="openSendApprovalDialog()"
          />
          <HistoryApprovalButton
            :record-id="selectedItem?.id || ''"
            notification-endpoint="m_customer_notifikasi"
            foreign-key-column="m_customer_id"
            :record-label="selectedItem?.nama_customer || 'Tanpa Nama'"
            :document-status="selectedItem?.status"
            :created-at="selectedItem?.createdAt"
            variant="outline"
            size="default"
            :show-label="true"
            :disabled="!isActive"
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
      max-height="calc(100vh - 250px)"
      @load-more="handleLoadMore"
      @row-select="(item) => selectItem(item, 0)"
      @row-deselect="deselectItem"
      @filter-change="handleTableFilterChange"
    >
      <template #empty> Tidak ada data Customer </template>
    </DataTable>
  </div>

  <!-- ================================================================ -->
  <!-- DELETE CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isDeleteDialogOpen"
    title="Hapus Customer"
    :description="deleteDialogDescription"
    type="danger"
    confirm-text="Hapus"
    cancel-text="Batal"
    :is-loading="isDeleting"
    @confirm="confirmDelete"
    @cancel="cancelDelete"
    @update:open="isDeleteDialogOpen = $event"
  />

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
        <div v-if="itemToSendApproval" class="p-3 bg-muted rounded-md">
          <p class="text-sm font-medium">Customer:</p>
          <p class="text-sm text-muted-foreground">
            {{
              itemToSendApproval.kode_customer ||
              itemToSendApproval.nama_customer ||
              "Tanpa Kode"
            }}
          </p>
        </div>

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
