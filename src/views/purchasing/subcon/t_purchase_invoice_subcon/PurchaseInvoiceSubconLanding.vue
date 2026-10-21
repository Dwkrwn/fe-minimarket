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
import {
  getPurchaseInvoiceSubconList,
  deletePurchaseInvoiceSubcon,
  type PurchaseInvoiceSubconFilter,
  type PurchaseInvoiceSubconItem,
} from "./service";
import { getApprovalStatusBadgeClass, getApprovalStatusFilterClass } from "@/lib/approvalStatus";

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
// HELPER FUNCTIONS
// ============================================================================
const getPINumber = (item: any) =>
  item?.no_pi_subcon || item?.no_pi || item?.no_t_purchase_invoice_subcon || "Tanpa Nomor";

// Helper function to check if item can be deleted (only DRAFT / REVISI)
const canDeleteItem = (item: PurchaseInvoiceSubconItem) => {
  const status = item.status?.toUpperCase();
  return status === "DRAFT" || status === "REVISI";
};

// Helper function to check if item can be edited (only DRAFT / REVISI)
const canEditItem = (item: PurchaseInvoiceSubconItem) => {
  const status = item.status?.toUpperCase();
  return status === "DRAFT" || status === "REVISI";
};

// Helper function to check if specific item has locked status
const isItemStatusLocked = (item: PurchaseInvoiceSubconItem) => {
  const status = item.status?.toUpperCase();
  return (
    status === "IN APPROVAL" || status === "APPROVED" || status === "REJECT"
  );
};

// ============================================================================
// DELETE DIALOG STATE
// ============================================================================
const isDeleteDialogOpen = ref(false);
const itemToDelete = ref<PurchaseInvoiceSubconItem | null>(null);
const isDeleting = ref(false);

// ============================================================================
// BULK DELETE STATE
// ============================================================================
const selectedRows = ref<PurchaseInvoiceSubconItem[]>([]);
const isBulkDeleteDialogOpen = ref(false);
const isBulkDeleting = ref(false);

/** Computed: rows yang bisa dihapus dari selection (hanya DRAFT / REVISI) */
const bulkDeletableRows = computed(() =>
  selectedRows.value.filter((item) => canDeleteItem(item)),
);

/** Tombol bulk delete hanya muncul jika ada LEBIH DARI 1 item DRAFT/REVISI yang dipilih */
const showBulkDeleteButton = computed(() => bulkDeletableRows.value.length > 1);

/** Computed: deskripsi dialog bulk delete */
const bulkDeleteDialogDescription = computed(() => {
  const total = selectedRows.value.length;
  const deletable = bulkDeletableRows.value.length;
  const skipped = total - deletable;
  let desc = `Anda akan menghapus ${deletable} data Purchase Invoice Subcon yang berstatus DRAFT atau REVISI.`;
  if (skipped > 0) {
    desc += ` ${skipped} data dengan status lain akan dilewati.`;
  }
  desc += " Tindakan ini tidak dapat dibatalkan.";
  return desc;
});

/** Handle selectionChange dari DataTable (multi-select) */
const selectionAnchor = ref<PurchaseInvoiceSubconItem | null>(null);

const isDraftStatus = (item?: PurchaseInvoiceSubconItem | null) =>
  (item?.status || "").toUpperCase() === "DRAFT";

const handleSelectionChange = (items: PurchaseInvoiceSubconItem[]) => {
  if (items.length === 0) {
    selectionAnchor.value = null;
    selectedRows.value = [];
    deselectItem();
    return;
  }

  const firstItem = items[0];
  if (!firstItem) return;
  const prevAnchor = selectionAnchor.value;
  const anchor: PurchaseInvoiceSubconItem =
    prevAnchor && items.some((i) => i.id === prevAnchor.id) ? prevAnchor : firstItem;
  selectionAnchor.value = anchor;

  if (!isDraftStatus(anchor)) {
    const anchorItem = items.find((i) => i.id === anchor.id) || anchor;
    if (items.length > 1) {
      toast.warning("Tidak dapat memilih item lain", {
        description: `Item berstatus ${anchor.status} hanya dapat dipilih sendiri.`,
      });
    }
    selectedRows.value = [anchorItem];
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
  selectedRows.value = allowed;
  selectItem(allowed[allowed.length - 1] ?? anchor, 0);
};

/** Buka dialog bulk delete */
const openBulkDeleteDialog = () => {
  if (bulkDeletableRows.value.length === 0) {
    toast.error("Tidak ada data yang dapat dihapus", {
      description: "Pilih data dengan status DRAFT atau REVISI",
    });
    return;
  }
  isBulkDeleteDialogOpen.value = true;
};

/** Konfirmasi bulk delete */
const confirmBulkDelete = async () => {
  if (bulkDeletableRows.value.length === 0) return;

  isBulkDeleting.value = true;
  const toDelete = [...bulkDeletableRows.value];
  const results = { success: 0, failed: 0 };

  try {
    for (const item of toDelete) {
      try {
        const response = await deletePurchaseInvoiceSubcon(item.id);
        if (response.status === "success") {
          menuData.value = menuData.value.filter((m) => m.id !== item.id);
          results.success++;
        } else {
          results.failed++;
        }
      } catch {
        results.failed++;
      }
    }

    if (results.success > 0) {
      toast.success(`${results.success} data berhasil dihapus`, {
        description:
          results.failed > 0 ? `${results.failed} data gagal dihapus` : undefined,
      });
    } else {
      toast.error("Semua data gagal dihapus");
    }
  } finally {
    isBulkDeleting.value = false;
    isBulkDeleteDialogOpen.value = false;
    selectedRows.value = [];
    deselectItem();
  }
};

const cancelBulkDelete = () => {
  isBulkDeleteDialogOpen.value = false;
};

// ============================================================================
// SEND APPROVAL DIALOG STATE
// ============================================================================
const isSendApprovalDialogOpen = ref(false);
const itemToSendApproval = ref<PurchaseInvoiceSubconItem | null>(null);
const approvalCatatan = ref("");
const isSendingApproval = ref(false);

// Get current approval info from localStorage
const currentApprovalInfo = computed(() => {
  const approvalList = authStore.getApprovalList();
  return approvalList.find(
    (approval: any) =>
      approval.path === "/purchasing/subcon/t_purchase_invoice_subcon" &&
      approval.tipe_approve?.toUpperCase() === "MENGAJUKAN",
  );
});

// Check if selected item has locked status (IN APPROVAL, APPROVED or REJECT)
const isStatusLocked = computed(() => {
  if (!selectedItem.value) return false;
  const status = selectedItem.value.status?.toUpperCase();
  return (
    status === "IN APPROVAL" || status === "APPROVED" || status === "REJECT"
  );
});

// Check if item can be edited/deleted (has selection AND status is not locked)
const canEditOrDelete = computed(() => {
  return isActive.value && !isStatusLocked.value;
});

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<PurchaseInvoiceSubconItem[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const hasMoreData = ref(true);

// ============================================================================
// FILTER & SEARCH STATE
// ============================================================================
const filterStatus = ref<
  "DRAFT" | "IN APPROVAL" | "REJECT" | "REVISI" | "APPROVED" | null
>(null);
const searchQuery = ref("");
const searchApiQuery = ref(""); // Untuk API search
const isSearching = ref(false);

// ============================================================================
// FILTER STATE FOR API-BASED FILTERING
// ============================================================================
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
const tableWhereFilter = ref("");

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const getUnitBisnisName = (item: any) => {
  return item.m_unit_bisni?.nama_comp || item.m_unit_bisni?.nama || "-";
};
const getSupplierName = (item: any) => {
  return item.m_supplier?.nama_supp || item.m_supplier?.nama || "-";
};
const formatCurrency = (value: any) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toLocaleString("id-ID");
};

const columns = [
  {
    key: "m_unit_bisnis",
    label: "Unit Bisnis",
    filterable: true,
    width: "160px",
    render: (item: PurchaseInvoiceSubconItem) => getUnitBisnisName(item),
  },
  {
    key: "no_pi_subcon",
    label: "No. PI Subcon",
    filterable: true,
    width: "180px",
    render: (item: PurchaseInvoiceSubconItem) => getPINumber(item),
  },
  {
    key: "tgl_pi",
    label: "Tgl PI Subcon",
    filterable: true,
    filterType: "date" as const,
    width: "140px",
    renderHtml: (item: PurchaseInvoiceSubconItem) => {
      return item.tgl_pi
        ? new Date(item.tgl_pi).toLocaleDateString("id-ID")
        : "-";
    },
  },
  {
    key: "m_supplier.nama_supp",
    label: "Supplier",
    filterable: true,
    width: "200px",
    render: (item: PurchaseInvoiceSubconItem) => getSupplierName(item),
  },
  {
    key: "grand_total",
    label: "Grand Total",
    filterable: false,
    width: "150px",
    align: "right" as const,
    render: (item: PurchaseInvoiceSubconItem) =>
      formatCurrency((item as any).grand_total),
  },
  { key: "catatan", label: "Catatan", filterable: true, width: "180px" },
  {
    key: "status",
    label: "Status",
    filterable: true,
    width: "140px",
    renderHtml: (item: PurchaseInvoiceSubconItem) => {
      const status = item.status || "DRAFT";
      const badgeClass = getStatusStyle(status);
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${status}</span>`;
    },
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/** Get status badge styling */
const getStatusStyle = getApprovalStatusBadgeClass;

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================
/** Filter t_purchase_invoice_subcon data by status */
const filteredData = computed(() => {
  if (!filterStatus.value) return menuData.value;

  return menuData.value.filter((item) => {
    const itemStatus = (item.status || "").toUpperCase();
    return itemStatus === filterStatus.value;
  });
});

/**
 * Check if user can view all data
 */
const canViewAllData = computed(() => {
  if (isSuperAdmin.value) return true;
  const tipeUser = authStore.user?.tipe?.value1?.toUpperCase();
  if (!tipeUser) return false;
  const allowedTypes = ["SUPER ADMIN", "DEVELOPER", "ADMIN"];
  return allowedTypes.some((type) => tipeUser.includes(type));
});

/** Deskripsi dialog delete */
const deleteDialogDescription = computed(() => {
  if (!itemToDelete.value) return "";
  return `Apakah Anda yakin ingin menghapus Purchase Invoice Subcon "${getPINumber(itemToDelete.value) || "tanpa nomor"}"? Tindakan ini tidak dapat dibatalkan.`;
});

/** Deskripsi dialog send approval */
const sendApprovalDialogDescription = computed(() => {
  if (!itemToSendApproval.value) return "";
  return `Kirim Purchase Invoice Subcon "${getPINumber(itemToSendApproval.value) || "tanpa nomor"}" untuk approval?`;
});

// ============================================================================
// NAVIGATION FUNCTIONS
// ============================================================================
const createNew = () => {
  router.push("/purchasing/subcon/t_purchase_invoice_subcon/form");
};

const editItem = (item?: PurchaseInvoiceSubconItem) => {
  if (item) selectItem(item, 0);
  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }
  if (!canEditItem(selectedItem.value)) {
    toast.error("Tidak dapat mengedit", {
      description: `Data dengan status ${selectedItem.value.status} tidak dapat diubah`,
    });
    return;
  }
  router.push(`/purchasing/subcon/t_purchase_invoice_subcon/form/${selectedItem.value.id}`);
};

const copyItem = (item?: PurchaseInvoiceSubconItem) => {
  if (item) selectItem(item, 0);
  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }
  router.push({
    path: "/purchasing/subcon/t_purchase_invoice_subcon/form",
    query: { action: "copy", source: selectedItem.value.id },
  });
};

const viewItem = (item?: any) => {
  if (item) selectItem(item, 0);
  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }
  router.push(`/purchasing/subcon/t_purchase_invoice_subcon/view/${selectedItem.value.id}`);
};

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
const deleteSelected = (item?: PurchaseInvoiceSubconItem) => {
  if (item) {
    selectItem(item, 0);
    itemToDelete.value = item;
  } else {
    itemToDelete.value = selectedItem.value;
  }
  if (!itemToDelete.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }
  if (!canDeleteItem(itemToDelete.value)) {
    toast.error("Tidak dapat menghapus", {
      description: `Data dengan status ${itemToDelete.value.status} tidak dapat dihapus`,
    });
    itemToDelete.value = null;
    return;
  }
  isDeleteDialogOpen.value = true;
};

const confirmDelete = async () => {
  if (!itemToDelete.value?.id) return;
  isDeleting.value = true;
  try {
    const response = await deletePurchaseInvoiceSubcon(itemToDelete.value.id);
    if (response.status === "success") {
      menuData.value = menuData.value.filter(
        (m: PurchaseInvoiceSubconItem) => m.id !== itemToDelete.value!.id,
      );
      toast.success("Purchase Invoice Subcon berhasil dihapus");
      isDeleteDialogOpen.value = false;
      deselectItem();
    } else {
      toast.error("Gagal menghapus Purchase Invoice Subcon", {
        description: response.message || "Terjadi kesalahan saat menghapus",
      });
    }
  } catch (error) {
    toast.error("Gagal menghapus Purchase Invoice Subcon", {
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
const openSendApprovalDialog = (item?: PurchaseInvoiceSubconItem) => {
  if (item) selectItem(item, 0);
  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }
  itemToSendApproval.value = selectedItem.value;
  approvalCatatan.value = "";
  isSendApprovalDialogOpen.value = true;
};

const confirmSendApproval = async () => {
  if (!itemToSendApproval.value || !itemToSendApproval.value.id) return;
  isSendingApproval.value = true;
  try {
    const approvalList = authStore.getApprovalList();
    const currentApproval = approvalList.find(
      (approval: any) =>
        approval.path === "/purchasing/subcon/t_purchase_invoice_subcon" &&
        approval.tipe_approve?.toUpperCase() === "MENGAJUKAN",
    );
    if (!currentApproval) {
      toast.error("Gagal mengirim approval", {
        description: "Anda tidak memiliki hak untuk mengajukan approval",
      });
      isSendingApproval.value = false;
      return;
    }
    if (
      currentApproval.level === null ||
      currentApproval.level === undefined ||
      !currentApproval.sender_id
    ) {
      toast.error("Data approval tidak lengkap", {
        description:
          "Field yang hilang. Silakan hubungi administrator untuk melengkapi data approval Anda.",
        duration: 6000,
      });
      isSendingApproval.value = false;
      return;
    }
    const payload = {
      approval_level: currentApproval.level,
      sender_id: currentApproval.sender_id,
      t_purchase_invoice_subcon_id: itemToSendApproval.value.id,
      approval_message: approvalCatatan.value.trim() || null,
    };
    const response = await fetch(
      `${API_BASE_URL}/dynamic/t_purchase_invoice_subcon_notifikasi`,
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
      const itemIndex = menuData.value.findIndex(
        (m: PurchaseInvoiceSubconItem) => m.id === itemToSendApproval.value!.id,
      );
      if (itemIndex !== -1) {
        const updatedItem = {
          ...menuData.value[itemIndex],
          status: "IN APPROVAL",
        } as PurchaseInvoiceSubconItem;
        menuData.value.splice(itemIndex, 1, updatedItem);
      }
      toast.success("Approval berhasil dikirim", {
        description: `Purchase Invoice Subcon "${getPINumber(itemToSendApproval.value) || "tanpa nomor"}" telah dikirim untuk approval`,
      });
      isSendApprovalDialogOpen.value = false;
      deselectItem();
    } else {
      toast.error("Gagal mengirim approval", {
        description: result.message || "Terjadi kesalahan saat mengirim approval",
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
// API DATA FETCHING
// ============================================================================
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
  if (page === 1 || resetData) {
    loading.value = true;
  } else {
    loadingMore.value = true;
  }
  try {
    if (resetData) menuData.value = [];
    const apiFilters: PurchaseInvoiceSubconFilter[] = [];

    Object.entries(tableColumnFilters.value).forEach(([key, value]) => {
      if (value && value.trim()) {
        apiFilters.push({
          key,
          value: value.trim(),
          operator: tableColumnFilterOperators.value[key],
        });
      }
    });

    const response = await getPurchaseInvoiceSubconList(
      page,
      pageSize.value,
      "createdAt",
      "DESC",
      searchApiQuery.value || undefined,
      searchApiQuery.value ? "no_pi_subcon,catatan,m_unit_bisnis.nama_comp,m_supplier.nama_supp" : undefined,
      undefined,
      apiFilters.length > 0 ? apiFilters : undefined,
      tableWhereFilter.value || undefined,
    );
    if (response.status === "success" && response.data) {
      if (page === 1 || resetData) {
        menuData.value = response.data;
      } else {
        menuData.value.push(...response.data);
      }
      if (response.pagination) {
        hasMoreData.value = response.pagination.next_page !== null;
      }
    }
  } catch (error) {
    toast.error("Gagal memuat data Purchase Invoice Subcon", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
};

const handleLoadMore = () => {
  currentPage.value++;
  fetchMenuData(currentPage.value);
};

const handleApiSearch = async () => {
  if (isSearching.value) return;
  isSearching.value = true;
  searchApiQuery.value = searchQuery.value;
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

const clearSearch = async () => {
  searchQuery.value = "";
  searchApiQuery.value = "";
  await handleApiSearch();
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
  tableWhereFilter.value = filters.where;
  if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
  filterDebounceTimer = setTimeout(async () => {
    menuData.value = [];
    currentPage.value = 1;
    hasMoreData.value = true;
    await fetchMenuData(1, true);
  }, 500);
};

const handleRefresh = async () => {
  searchQuery.value = "";
  searchApiQuery.value = "";
  tableColumnFilters.value = {};
  tableColumnFilterOperators.value = {};
  tableDateRangeFilters.value = {};
  tableWhereFilter.value = "";
  menuData.value = [];
  currentPage.value = 1;
  hasMoreData.value = true;
  deselectItem();
  selectedRows.value = [];
  await fetchMenuData(1, true);
  toast.success("Data berhasil dimuat ulang");
};

const handleWindowScroll = () => {
  if (loadingMore.value || !hasMoreData.value) return;
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const windowHeight = window.innerHeight;
  const docHeight = document.documentElement.scrollHeight;
  if (docHeight - scrollTop - windowHeight < 100) {
    currentPage.value++;
    fetchMenuData(currentPage.value);
  }
};

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================
onMounted(async () => {
  menuData.value = [];
  currentPage.value = 1;
  hasMoreData.value = true;
  deselectItem();
  await fetchMenuData(1);
  window.addEventListener("scroll", handleWindowScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener("scroll", handleWindowScroll);
  menuData.value = [];
  selectedRows.value = [];
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
            <h1 class="text-lg font-bold">Transaksi Purchase Invoice Subcon</h1>
            <p class="text-xs text-muted-foreground">
              Kelola data Purchase Invoice Subcon
            </p>
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
        <div class="flex items-center gap-2 overflow-x-auto">
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
            class="text-xs h-7 whitespace-nowrap"
            :class="getApprovalStatusFilterClass('DRAFT', filterStatus === 'DRAFT')"
            @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'"
          >DRAFT</Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7 whitespace-nowrap"
            :class="getApprovalStatusFilterClass('IN APPROVAL', filterStatus === 'IN APPROVAL')"
            @click="
              filterStatus =
                filterStatus === 'IN APPROVAL' ? null : 'IN APPROVAL'
            "
          >
            IN APPROVAL
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7 whitespace-nowrap"
            :class="getApprovalStatusFilterClass('APPROVED', filterStatus === 'APPROVED')"
            @click="
              filterStatus = filterStatus === 'APPROVED' ? null : 'APPROVED'
            "
          >
            APPROVED
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7 whitespace-nowrap"
            :class="getApprovalStatusFilterClass('REJECT', filterStatus === 'REJECT')"
            @click="filterStatus = filterStatus === 'REJECT' ? null : 'REJECT'"
          >REJECT</Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7 whitespace-nowrap"
            :class="getApprovalStatusFilterClass('REVISI', filterStatus === 'REVISI')"
            @click="filterStatus = filterStatus === 'REVISI' ? null : 'REVISI'"
          >REVISI</Button>
        </div>

        <!-- Search Input -->
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                <div class="font-semibold text-sm truncate">{{ getPINumber(item) }}</div>
                <div class="text-xs text-muted-foreground truncate">
                  {{ item.tgl_pi ? new Date(item.tgl_pi).toLocaleDateString("id-ID") : "-" }}
                </div>
              </div>
              <Badge :class="getStatusStyle(item.status || 'DRAFT')" class="text-xs shrink-0">
                {{ item.status || "DRAFT" }}
              </Badge>
            </div>

            <!-- Details -->
            <div class="text-xs space-y-1 text-muted-foreground">
              <div class="truncate">
                <span class="font-medium">Supplier:</span>
                {{ (item as any).m_supplier?.nama_supp || (item as any).m_supplier?.nama || "-" }}
              </div>
              <div v-if="(item as any).grand_total" class="truncate">
                <span class="font-medium">Grand Total:</span>
                {{ Number((item as any).grand_total).toLocaleString("id-ID") }}
              </div>
              <div v-if="item.catatan" class="truncate">
                <span class="font-medium">Catatan:</span> {{ item.catatan }}
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-1 justify-end pt-2 border-t">
              <ViewButton variant="ghost" size="sm" class="h-7 w-7" @click.stop="viewItem(item)" />
              <DeleteButton
                v-permission="{ menuId: currentMenuId, action: 'delete' }"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                :status="item.status"
                :disabled="!canDeleteItem(item)"
                @click.stop="() => { selectItem(item, 0); deleteSelected(); }"
              />
              <EditButton
                v-permission="{ menuId: currentMenuId, action: 'update' }"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                :status="item.status"
                :disabled="!canEditItem(item)"
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
                path="/purchasing/subcon/t_purchase_invoice_subcon"
                :status="item.status"
                variant="ghost"
                size="sm"
                :showLabel="false"
                class="h-7 w-7"
                @click.stop="openSendApprovalDialog(item)"
              />
              <HistoryApprovalButton
                :record-id="item.id || ''"
                notification-endpoint="t_purchase_invoice_subcon_notifikasi"
                foreign-key-column="t_purchase_invoice_subcon_id"
                :record-label="getPINumber(item)"
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
        <h1 class="text-2xl font-bold">Transaksi Purchase Invoice Subcon</h1>
        <p class="text-sm text-muted-foreground">Kelola data Purchase Invoice Subcon</p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading" class="shrink-0" title="Refresh data">
          <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
        </Button>
        <Button v-if="currentMenuId" v-permission="{ menuId: currentMenuId, action: 'create' }" @click="createNew" class="gap-2 whitespace-nowrap shrink-0">
          Create New
        </Button>
        <Button v-else @click="createNew" class="gap-2 whitespace-nowrap shrink-0">
          Create New
        </Button>
      </div>
    </div>

    <!-- FILTER BAR -->
    <div class="flex flex-col gap-3 bg-muted/50 p-4 rounded-lg">
      <!-- Filter Status Row -->
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-sm font-medium">Status:</span>
        <Button
          variant="outline"
          size="sm"
          class="text-xs h-8 whitespace-nowrap"
          :class="filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
          @click="filterStatus = null"
        >
          ALL
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="getApprovalStatusFilterClass('DRAFT', filterStatus === 'DRAFT')"
          @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'"
        >
          DRAFT
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="getApprovalStatusFilterClass('IN APPROVAL', filterStatus === 'IN APPROVAL')"
          @click="
            filterStatus = filterStatus === 'IN APPROVAL' ? null : 'IN APPROVAL'
          "
        >
          IN APPROVAL
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="getApprovalStatusFilterClass('APPROVED', filterStatus === 'APPROVED')"
          @click="
            filterStatus = filterStatus === 'APPROVED' ? null : 'APPROVED'
          "
        >
          APPROVED
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="getApprovalStatusFilterClass('REJECT', filterStatus === 'REJECT')"
          @click="filterStatus = filterStatus === 'REJECT' ? null : 'REJECT'"
        >
          REJECT
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="getApprovalStatusFilterClass('REVISI', filterStatus === 'REVISI')"
          @click="filterStatus = filterStatus === 'REVISI' ? null : 'REVISI'"
        >
          REVISI
        </Button>
      </div>

      <!-- Search & Action Buttons Row -->
      <div class="flex items-center gap-2">
        <!-- Search -->
        <div class="flex items-center gap-2 w-1/5">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="searchQuery" placeholder="Search..." class="pl-9 pr-8" @keyup.enter="handleApiSearch" :disabled="isSearching" />
            <Button v-if="searchQuery" @click="clearSearch" size="icon" variant="ghost" class="absolute right-0 top-1/2 -translate-y-1/2">
              <X class="h-4 w-4" />
            </Button>
          </div>
          <Button @click="handleApiSearch" size="icon" variant="secondary" :disabled="isSearching">
            <Search class="h-4 w-4" />
          </Button>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2">
          <!-- Bulk Delete Button: hanya muncul jika ada lebih dari 1 item DRAFT/REVISI yang dipilih -->
          <Button
            v-if="showBulkDeleteButton"
            v-permission="{ menuId: currentMenuId, action: 'delete' }"
            variant="destructive"
            size="sm"
            class="gap-2 whitespace-nowrap"
            :disabled="isBulkDeleting"
            @click="openBulkDeleteDialog"
          >
            <Trash2 class="h-4 w-4" />
            Bulk Delete ({{ bulkDeletableRows.length }})
          </Button>
          <DeleteButton v-permission="{ menuId: currentMenuId, action: 'delete' }" 
            :status="selectedItem?.status"
            :disabled="!canEditOrDelete" @click="deleteSelected()" />
          <ViewButton :disabled="!isActive" @click="viewItem()" />
          <EditButton v-permission="{ menuId: currentMenuId, action: 'update' }" 
            :status="selectedItem?.status"
            :disabled="!canEditOrDelete" @click="editItem()" />
          <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }" :disabled="!isActive" @click="copyItem()" />
          <SendApprovalButton
            path="/purchasing/subcon/t_purchase_invoice_subcon"
            :status="selectedItem?.status"
            variant="default"
            size="default"
            :showLabel="true"
            :disabled="!isActive"
            @click="openSendApprovalDialog()"
          />
          <HistoryApprovalButton
            :record-id="selectedItem?.id || ''"
            notification-endpoint="t_purchase_invoice_subcon_notifikasi"
            foreign-key-column="t_purchase_invoice_subcon_id"
            :record-label="getPINumber(selectedItem)"
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
      :multi-select-mode="true"
      :selected-items="selectedRows"
      :api-filter-mode="true"
      @load-more="handleLoadMore"
      @row-select="(item) => selectItem(item, 0)"
      @row-deselect="deselectItem"
      @filter-change="handleTableFilterChange"
      @selection-change="handleSelectionChange"
    >
      <template #empty>Tidak ada data Purchase Invoice Subcon</template>
    </DataTable>
  </div>

  <!-- ================================================================ -->
  <!-- DELETE CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isDeleteDialogOpen"
    title="Hapus Purchase Invoice Subcon"
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
  <Dialog :open="isSendApprovalDialogOpen" @update:open="isSendApprovalDialogOpen = $event">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <div class="flex items-center gap-3 mb-2">
          <div class="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50">
            <Info class="w-5 h-5 text-blue-600" />
          </div>
          <DialogTitle class="text-lg">Kirim Approval</DialogTitle>
        </div>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- ITEM INFO -->
        <div v-if="itemToSendApproval" class="p-3 bg-muted rounded-md">
          <p class="text-sm font-medium">Purchase Invoice Subcon:</p>
          <p class="text-sm text-muted-foreground">{{ getPINumber(itemToSendApproval) }}</p>
        </div>

        <!-- SENDER INFO -->
        <div v-if="currentApprovalInfo" class="space-y-3">
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">Pengirim:</p>
            <p class="text-sm text-muted-foreground">{{ currentApprovalInfo.sender_name }}</p>
          </div>
          <div class="flex items-center justify-between">
            <p class="text-sm font-medium">Tipe Approval:</p>
            <p class="text-sm font-medium text-primary">{{ currentApprovalInfo.tipe_approve }}</p>
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
        <Button variant="outline" @click="cancelSendApproval" :disabled="isSendingApproval">Batal</Button>
        <Button variant="default" @click="confirmSendApproval" :disabled="isSendingApproval" class="gap-2">
          <span v-if="isSendingApproval">Mengirim...</span>
          <span v-else>Send</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- ================================================================ -->
  <!-- BULK DELETE CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isBulkDeleteDialogOpen"
    title="Bulk Hapus Purchase Invoice Subcon"
    :description="bulkDeleteDialogDescription"
    type="danger"
    confirm-text="Hapus Semua"
    cancel-text="Batal"
    :is-loading="isBulkDeleting"
    @confirm="confirmBulkDelete"
    @cancel="cancelBulkDelete"
    @update:open="isBulkDeleteDialogOpen = $event"
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
