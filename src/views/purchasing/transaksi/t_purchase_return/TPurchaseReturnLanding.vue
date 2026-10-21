<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, computed, onMounted, onUnmounted, TransitionGroup, watch } from "vue";
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
  FileText,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  BulkDeleteButton,
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
  getTPurchaseReturnList,
  deleteTPurchaseReturn,
  bulkDeleteTPurchaseReturn,
  type TPurchaseReturnItem,
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
// DELETE DIALOG STATE
// ============================================================================
const isDeleteDialogOpen = ref(false);
const itemToDelete = ref<TPurchaseReturnItem | null>(null);
const itemsToDelete = ref<TPurchaseReturnItem[]>([]);
const isDeleting = ref(false);

// ============================================================================
// SEND APPROVAL DIALOG STATE
// ============================================================================
const isSendApprovalDialogOpen = ref(false);
const itemToSendApproval = ref<TPurchaseReturnItem | null>(null);
const approvalCatatan = ref("");
const isSendingApproval = ref(false);

// Get current approval info from localStorage
const currentApprovalInfo = computed(() => {
  const approvalList = authStore.getApprovalList();
  return approvalList.find(
    (approval: any) =>
      approval.path === "/purchasing/transaksi/t_purchase_return" &&
      approval.tipe_approve?.toUpperCase() === "MENGAJUKAN",
  );
});

// ============================================================================
// REFERENCE DIALOG STATE (untuk lihat referensi PO, PR, dll)
// ============================================================================
const isReferenceDialogOpen = ref(false);
const referenceData = ref<any>(null);
const isLoadingReference = ref(false);

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<TPurchaseReturnItem[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const hasMoreData = ref(true);
const dataTableRef = ref<any>(null);

// ============================================================================
// BULK SELECTION STATE
// ============================================================================
const selectedItems = ref<TPurchaseReturnItem[]>([]);
const isMobileSelectionMode = ref(false);

// ============================================================================
// FILTER & SEARCH STATE
// ============================================================================
const filterStatus = ref<
  "DRAFT" | "IN APPROVAL" | "REJECT" | "REVISI" | "APPROVED" | null
>(null);
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

const getReferensiReturnLabel = (item: TPurchaseReturnItem) =>
  item.is_pi_pb ? "Penerimaan Barang" : "Purchase Invoice";

const normalizePurchaseReturnRow = (item: TPurchaseReturnItem) =>
  ({
    ...item,
    referensi_return: getReferensiReturnLabel(item),
  }) as TPurchaseReturnItem & { referensi_return: string };

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const columns = [
  { key: "no_return", label: "No. Return", filterable: true, width: "150px" },
  {
    key: "tgl_retur",
    label: "Tgl Return",
    filterable: true,
    filterType: "date" as const,
    width: "150px",
    renderHtml: (item: TPurchaseReturnItem) => {
      return item.tgl_retur
        ? new Date(item.tgl_retur).toLocaleDateString("id-ID")
        : "-";
    },
  },
  {
    key: "m_supplier.nama_supp",
    label: "Supplier",
    filterable: true,
    width: "200px",
  },
  {
    key: "referensi_return",
    label: "Referensi Return",
    filterable: false,
    width: "150px",
    renderHtml: (item: TPurchaseReturnItem) => {
      return getReferensiReturnLabel(item);
    },
  },
  {
    key: "t_pr_retur.value1",
    label: "Tipe Retur",
    filterable: false,
    width: "150px",
  },
  { key: "catatan", label: "Catatan", filterable: true, width: "200px" },
  {
    key: "status",
    label: "Status",
    filterable: false,
    width: "120px",
    renderHtml: (item: TPurchaseReturnItem) => {
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
/** Filter t_purchase_return data by status */
const filteredData = computed(() => {
  let data = menuData.value;

  // Filter by status
  if (filterStatus.value) {
    data = data.filter((item: TPurchaseReturnItem) => {
      const itemStatus = (item.status || "").toUpperCase();
      return itemStatus === filterStatus.value;
    });
  }

  return data;
});

/** Deskripsi dialog delete */
const deleteDialogDescription = computed(() => {
  if (itemsToDelete.value.length > 1) {
    return `Apakah Anda yakin ingin menghapus ${itemsToDelete.value.length} Purchase Return berstatus DRAFT? Tindakan ini tidak dapat dibatalkan.`;
  }

  if (!itemToDelete.value) return "";
  return `Apakah Anda yakin ingin menghapus Purchase Return dengan nomor "${itemToDelete.value.no_return}"? Tindakan ini tidak dapat dibatalkan.`;
});

/** Deskripsi dialog send approval */
const sendApprovalDialogDescription = computed(() => {
  if (!itemToSendApproval.value) return "";
  return `Kirim Purchase Return "${itemToSendApproval.value.no_return || "tanpa nomor"}" untuk proses approval?`;
});

/** Cek apakah selected item terkunci untuk edit/delete/send approval */
const isLockedStatus = (status?: string | null) => {
  const normalizedStatus = (status || "").toUpperCase();
  return (
    normalizedStatus === "IN APPROVAL" ||
    normalizedStatus === "APPROVED" ||
    normalizedStatus === "APPROVED SYSTEM"
  );
};

/** Cek apakah selected item terkunci untuk copy */
const isCopyLockedStatus = (status?: string | null) => {
  const normalizedStatus = (status || "").toUpperCase();
  return normalizedStatus === "IN APPROVAL";
};

const isSelectedItemApproved = computed(() => {
  if (!selectedItem.value) return false;
  return isLockedStatus(selectedItem.value.status);
});

const isSelectedItemCopyLocked = computed(() => {
  if (!selectedItem.value) return false;
  return isCopyLockedStatus(selectedItem.value.status);
});

const isDraftItem = (item: TPurchaseReturnItem | null | undefined) => {
  return (item?.status || "DRAFT").toUpperCase() === "DRAFT";
};

const selectedDraftCount = computed(
  () => selectedItems.value.filter((item) => isDraftItem(item)).length,
);

/** Get badge variant based on status */
const getStatusBadgeVariant = (status?: string) => {
  const statusUpper = (status || "").toUpperCase();
  switch (statusUpper) {
    case "DRAFT":
      return "secondary";
    case "IN APPROVAL":
      return "default";
    case "APPROVED":
      return "default";
    case "REJECT":
      return "destructive";
    case "REVISI":
      return "secondary";
    default:
      return "secondary";
  }
};

/** Get badge color classes based on status */
const getStatusColorClass = (status?: string) => {
  const statusUpper = (status || "").toUpperCase();
  switch (statusUpper) {
    case "DRAFT":
      return "bg-gray-100 text-gray-800 border-gray-300";
    case "IN APPROVAL":
      return "bg-blue-100 text-blue-800 border-blue-300";
    case "APPROVED":
      return "bg-green-100 text-green-800 border-green-300";
    case "REJECT":
      return "bg-red-100 text-red-800 border-red-300";
    case "REVISI":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
};

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
/** Trigger delete dialog */
const deleteSelected = (item?: TPurchaseReturnItem | Event) => {
  // Check permission
  if (!canDelete.value) {
    toast.error("Akses Ditolak", {
      description: "Anda tidak memiliki izin untuk menghapus data",
    });
    return;
  }

  const explicitItem = item && !(item instanceof Event) ? item : undefined;
  const selectedActionItem = explicitItem ? undefined : handleDelete();
  const candidateItems =
    selectedItems.value.length > 1
      ? selectedItems.value
      : explicitItem
        ? [explicitItem]
        : selectedItems.value.length === 1
          ? selectedItems.value
          : selectedActionItem
            ? [selectedActionItem]
            : [];

  if (!candidateItems.length) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  const deletableItems = candidateItems.filter((candidate) =>
    isDraftItem(candidate),
  );
  const skippedItems = candidateItems.filter(
    (candidate) => !isDraftItem(candidate),
  );

  if (!deletableItems.length) {
    toast.error("Tidak dapat menghapus", {
      description: "Bulk delete hanya tersedia untuk data berstatus DRAFT",
    });
    return;
  }

  if (skippedItems.length > 0) {
    toast.warning("Sebagian data dilewati", {
      description: `${skippedItems.length} data tidak berstatus DRAFT dan tidak akan dihapus`,
    });
  }

  itemsToDelete.value = deletableItems;
  itemToDelete.value = deletableItems.length === 1 ? deletableItems[0] : null;
  isDeleteDialogOpen.value = true;
};

/** Konfirmasi delete - hit API dan update UI */
const confirmDelete = async () => {
  const targetItems =
    itemsToDelete.value.length > 0
      ? itemsToDelete.value
      : itemToDelete.value
        ? [itemToDelete.value]
        : [];
  const targetIds = targetItems
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id));

  if (!targetIds.length) return;

  isDeleting.value = true;
  try {
    const response =
      targetIds.length > 1
        ? await bulkDeleteTPurchaseReturn(targetIds)
        : await deleteTPurchaseReturn(targetIds[0]!);

    if (response.status === "success") {
      // Remove item from list
      menuData.value = menuData.value.filter(
        (m: TPurchaseReturnItem) => !targetIds.includes(m.id || ""),
      );

      const successMessage =
        targetIds.length > 1
          ? `${targetIds.length} Purchase Return berhasil dihapus`
          : `Purchase Return nomor "${targetItems[0]?.no_return}" berhasil dihapus`;

      toast.success(successMessage, {
        description: response.message || "Item telah dihapus dari database",
      });

      // Clear selection
      clearAllSelection();
      deselectItem();
      isDeleteDialogOpen.value = false;
    } else {
      toast.error("Gagal menghapus Purchase Return", {
        description: response.message || "Terjadi kesalahan saat menghapus",
      });
    }
  } catch (error) {
    toast.error("Gagal menghapus Purchase Return", {
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
// SEND APPROVAL FUNCTIONS
// ============================================================================
/** Open send approval dialog */
const openSendApprovalDialog = (item?: TPurchaseReturnItem) => {
  if (item) {
    selectItem(item, 0);
  }

  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  // Check if item is already APPROVED
  const itemStatus = (selectedItem.value.status || "").toUpperCase();
  if (isLockedStatus(itemStatus)) {
    toast.error("Tidak dapat mengirim approval", {
      description: `Data dengan status ${itemStatus} tidak dapat dikirim ulang`,
    });
    return;
  }

  itemToSendApproval.value = selectedItem.value;
  approvalCatatan.value = "";
  isSendApprovalDialogOpen.value = true;
};

/** Confirm send approval - hit API POST t_purchase_return_notifikasi */
const confirmSendApproval = async () => {
  if (!itemToSendApproval.value || !itemToSendApproval.value.id) return;

  isSendingApproval.value = true;
  try {
    // Get approval data from localStorage
    const approvalList = authStore.getApprovalList();
    const currentApproval = approvalList.find(
      (approval: any) =>
        approval.path === "/purchasing/transaksi/t_purchase_return" &&
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
          "Field yang hilang. Silakan hubungi administrator untuk melengkapi data approval Anda.",
        duration: 6000,
      });
      isSendingApproval.value = false;
      return;
    }

    // Prepare payload
    const payload = {
      approval_level: currentApproval.level,
      sender_id: currentApproval.sender_id,
      t_purchase_return_id: itemToSendApproval.value.id,
      approval_message: approvalCatatan.value.trim() || null,
    };

    // Call API POST /dynamic/t_purchase_return_notifikasi
    const response = await fetch(
      `${API_BASE_URL}/dynamic/t_purchase_return_notifikasi`,
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
        (m: TPurchaseReturnItem) => m.id === itemToSendApproval.value!.id,
      );
      if (itemIndex !== -1) {
        const updatedItem = normalizePurchaseReturnRow({
          ...menuData.value[itemIndex],
          status: "IN APPROVAL",
        } as TPurchaseReturnItem);
        menuData.value.splice(itemIndex, 1, updatedItem);
      }

      toast.success("Approval berhasil dikirim", {
        description: `Purchase Return "${itemToSendApproval.value.no_return || "tanpa nomor"}" telah dikirim untuk approval`,
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
// REFERENCE FUNCTIONS (CEK PO, PR, dll)
// ============================================================================
/** Open reference dialog - untuk melihat referensi PO, PR, dll */
const openReferenceDialog = async (item?: TPurchaseReturnItem) => {
  if (item) {
    selectItem(item, 0);
  }

  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  isLoadingReference.value = true;
  isReferenceDialogOpen.value = true;
  referenceData.value = null;

  try {
    // Fetch reference data dari API
    const response = await fetch(
      `${API_BASE_URL}/dynamic/t_purchase_return_notifikasi/checkReturnReferences?id=${selectedItem.value.id}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );

    const result = await response.json();

    if (result.status === "success") {
      referenceData.value = result;
    } else {
      // Fallback: ambil data dari item langsung jika API tidak ada
      referenceData.value = {
        status: "success",
        purchase_return: {
          id: selectedItem.value.id,
          no_return: selectedItem.value.no_return,
          status: selectedItem.value.status,
          supplier: selectedItem.value.m_supplier,
        },
        references: {
          purchase_order: selectedItem.value.t_purchase_order
            ? {
                id: selectedItem.value.t_purchase_order.id,
                no_po: selectedItem.value.t_purchase_order.no_po,
                tgl_po: selectedItem.value.t_purchase_order.tgl_po,
                status: selectedItem.value.t_purchase_order.status,
              }
            : null,
          purchase_request: null,
          purchase_request_close: null,
        },
      };
    }
  } catch (error) {
    // Fallback jika API error
    referenceData.value = {
      status: "success",
      purchase_return: {
        id: selectedItem.value.id,
        no_return: selectedItem.value.no_return,
        status: selectedItem.value.status,
        supplier: selectedItem.value.m_supplier,
      },
      references: {
        purchase_order: selectedItem.value.t_purchase_order
          ? {
              id: selectedItem.value.t_purchase_order.id,
              no_po: selectedItem.value.t_purchase_order.no_po,
              tgl_po: selectedItem.value.t_purchase_order.tgl_po,
              status: selectedItem.value.t_purchase_order.status,
            }
          : null,
        purchase_request: null,
        purchase_request_close: null,
      },
    };
  } finally {
    isLoadingReference.value = false;
  }
};

const closeReferenceDialog = () => {
  isReferenceDialogOpen.value = false;
  referenceData.value = null;
};

/** Navigate to PO detail */
const goToPurchaseOrder = (poId: string) => {
  if (poId) {
    router.push(`/purchasing/transaksi/t_purchase_order/view/${poId}`);
  }
};

/** Navigate to PR detail */
const goToPurchaseRequest = (prId: string) => {
  if (prId) {
    router.push(`/purchasing/transaksi/t_purchase_request/view/${prId}`);
  }
};

// ============================================================================
// EXPORT & EDIT FUNCTIONS
// ============================================================================
/** Export t_purchase_return data */
const exportData = () => {
  toast.info("Export feature coming soon");
};

/** View TPurchaseReturn item details */
const viewItem = (item?: any) => {
  if (item) {
    selectItem(item, 0);
  }

  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  // Navigate to view page (read-only mode)
  router.push(
    `/purchasing/transaksi/t_purchase_return/view/${selectedItem.value.id}`,
  );
};

/** Edit TPurchaseReturn item */
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

  // Block edit jika status APPROVED atau APPROVED SYSTEM
  const itemStatus = (selectedItemData.status || "").toUpperCase();
  if (isLockedStatus(itemStatus)) {
    toast.error("Tidak dapat mengedit", {
      description: `Data dengan status ${itemStatus} tidak dapat diubah`,
    });
    return;
  }

  // Navigate to edit form
  router.push(
    `/purchasing/transaksi/t_purchase_return/form/${selectedItemData.id}`,
  );
};

/** Copy TPurchaseReturn item - duplicate data tanpa ID untuk create new */
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

  // Block copy jika status masih IN APPROVAL
  const itemStatus = (selectedItemData.status || "").toUpperCase();
  if (isCopyLockedStatus(itemStatus)) {
    toast.error("Tidak dapat menyalin", {
      description: `Data dengan status ${itemStatus} tidak dapat disalin`,
    });
    return;
  }

  // Navigate ke form create dengan data yang sama (tanpa ID)
  // Query param action=copy akan trigger mode copy di form
  router.push({
    path: "/purchasing/transaksi/t_purchase_return/form",
    query: {
      action: "copy",
      source: selectedItemData.id,
    },
  });

  toast.success(`Menyalin data "${selectedItemData.name}"`, {
    description: "Silakan edit dan simpan sebagai TPurchaseReturn baru",
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

  router.push("/purchasing/transaksi/t_purchase_return/form");
};

// ============================================================================
// API & DATA FETCHING FUNCTIONS
// ============================================================================
/** Fetch t_purchase_return data dari API with search support */
const fetchMenuData = async (page: number = 1, resetData: boolean = false, whereClause?: string) => {
  if (page === 1 || resetData) {
    loading.value = true;
  } else {
    loadingMore.value = true;
  }

  try {
    // Call API with search parameters
    const response = await getTPurchaseReturnList(
      page,
      pageSize.value,
      "createdAt",
      "DESC",
      searchApiQuery.value || undefined,
      searchApiQuery.value
        ? "no_return,catatan,m_supplier.nama_supp,t_pr_retur.value1,status"
        : undefined,
      Object.keys(tableColumnFilters.value).length > 0 ? tableColumnFilters.value : undefined,
      Object.keys(tableColumnFilterOperators.value).length > 0 ? tableColumnFilterOperators.value : undefined,
      whereClause
    );

    if (response.status === "success") {
      const normalizedData = response.data.map(normalizePurchaseReturnRow);
      if (page === 1 || resetData) {
        menuData.value = normalizedData;
      } else {
        // Append data untuk infinite scroll
        menuData.value.push(...normalizedData);
      }

      // Check if there's more data to load
      if (response.pagination) {
        hasMoreData.value = response.pagination.next_page !== null;
      }
    }
  } catch (error) {
    toast.error("Gagal memuat data TPurchaseReturn", {
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

    await fetchMenuData(1, true, filters.where);
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
  clearAllSelection(true);

  // Reload data
  await fetchMenuData(1, true);

  toast.success("Data berhasil dimuat ulang");
};

const selectionAnchor = ref<TPurchaseReturnItem | null>(null);

const isDraftStatus = (item?: TPurchaseReturnItem | null) =>
  (item?.status || "").toUpperCase() === "DRAFT";

const handleSelectionChange = (items: TPurchaseReturnItem[]) => {
  if (items.length === 0) {
    selectionAnchor.value = null;
    selectedItems.value = [];
    deselectItem();
    return;
  }

  const firstItem = items[0];
  if (!firstItem) return;
  const prevAnchor = selectionAnchor.value;
  const anchor: TPurchaseReturnItem =
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
  itemsToDelete.value = [];
  itemToDelete.value = null;
  dataTableRef.value?.clearSelection?.();
  deselectItem();
  if (exitMobileMode) {
    isMobileSelectionMode.value = false;
  }
};

const isItemSelected = (itemId?: string) => {
  if (!itemId) return false;
  return selectedItems.value.some((item) => item.id === itemId);
};

const toggleMobileSelectionMode = () => {
  if (isMobileSelectionMode.value) {
    clearAllSelection(true);
    return;
  }

  if (!isDraftFilterActive.value) return;
  isMobileSelectionMode.value = true;
  clearAllSelection();
};

const toggleMobileItemSelection = (item: TPurchaseReturnItem) => {
  if (!isDraftItem(item) || !item.id) return;

  const exists = isItemSelected(item.id);
  selectedItems.value = exists
    ? selectedItems.value.filter((selected) => selected.id !== item.id)
    : [...selectedItems.value, item];

  if (!exists) {
    selectItem(item, 0);
  } else if (selectedItem.value?.id === item.id) {
    const nextItem = selectedItems.value[selectedItems.value.length - 1];
    nextItem ? selectItem(nextItem, 0) : deselectItem();
  }
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
  deselectItem();
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
  deselectItem();
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
            <h1 class="text-lg font-bold">Transaksi Purchase Return</h1>
            <p class="text-xs text-muted-foreground">
              Kelola data Purchase Return
            </p>
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
          >
            DRAFT
          </Button>
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
          >
            REJECT
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7 whitespace-nowrap"
            :class="getApprovalStatusFilterClass('REVISI', filterStatus === 'REVISI')"
            @click="filterStatus = filterStatus === 'REVISI' ? null : 'REVISI'"
          >
            REVISI
          </Button>
        </div>

        <!-- Search Input -->
        <div class="relative">
          <Search
            class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          />
          <Input
            v-model="searchQuery"
            placeholder="Cari no. return, supplier, tipe retur, catatan, status..."
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
            isMobileSelectionMode ? toggleMobileItemSelection(item) : selectItem(item, 0)
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
                    {{ item.no_return || "-" }}
                  </div>
                  <div class="text-xs text-muted-foreground truncate">
                    {{ item.m_supplier?.nama_supp || "-" }}
                  </div>
                </div>
              </div>
              <Badge
                :class="getStatusColorClass(item.status)"
                class="text-xs shrink-0 border"
              >
                {{ item.status || "DRAFT" }}
              </Badge>
            </div>

            <!-- Details -->
            <div class="text-xs space-y-1 text-muted-foreground">
              <div v-if="item.t_pr_retur?.value1">
                <span class="font-medium">Tipe Retur:</span>
                {{ item.t_pr_retur.value1 }}
              </div>
              <div v-if="item.grand_total">
                <span class="font-medium">Grand Total:</span> Rp
                {{
                  (typeof item.grand_total === "string"
                    ? parseFloat(item.grand_total)
                    : item.grand_total
                  ).toLocaleString("id-ID")
                }}
              </div>
            </div>

            <!-- Action Buttons -->
            <div
              v-if="!isMobileSelectionMode"
              class="flex items-center gap-1 justify-end pt-2 border-t"
            >
              <ViewButton
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                @click.stop="viewItem(item)"
              />
              <!-- <Button 
                                variant="ghost" 
                                size="sm" 
                                class="h-7 w-7 p-0"
                                title="Lihat Referensi"
                                @click.stop="openReferenceDialog(item)"
                            >
                                <FileText class="h-4 w-4" />
                            </Button> -->
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
                :disabled="isLockedStatus(item.status)"
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
                path="/purchasing/transaksi/t_purchase_return"
                :status="item.status"
                variant="ghost"
                size="sm"
                :showLabel="false"
                class="h-7 w-7"
                @click.stop="openSendApprovalDialog(item)"
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
        <h1 class="text-2xl font-bold">Transaksi Purchase Return</h1>
        <p class="text-sm text-muted-foreground">Kelola data Purchase Return</p>
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
          @click="filterStatus = filterStatus === 'APPROVED' ? null : 'APPROVED'"
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
            <Search
              class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
            />
            <Input
              v-model="searchQuery"
              placeholder="Cari no. return, supplier, tipe retur, catatan, status..."
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
            :disabled="!isActive || isSelectedItemApproved"
            @click="editItem()"
          />
          <CopyButton
            v-permission="{ menuId: currentMenuId, action: 'create' }"
            :disabled="!isActive || isSelectedItemCopyLocked"
            @click="copyItem()"
          />
          <!-- <Button 
                        variant="outline" 
                        size="default"
                        :disabled="!isActive"
                        @click="openReferenceDialog()"
                        class="gap-2"
                        title="Lihat Referensi PO/PR"
                    >
                        <FileText class="h-4 w-4" />
                        <span>Referensi</span>
                    </Button> -->
          <SendApprovalButton
            path="/purchasing/transaksi/t_purchase_return"
            :status="selectedItem?.status"
            variant="default"
            size="default"
            :showLabel="true"
            :disabled="!isActive || isSelectedItemApproved"
            @click="openSendApprovalDialog()"
          />
          <HistoryApprovalButton
            :recordId="selectedItem?.id || ''"
            notificationEndpoint="t_purchase_return_notifikasi"
            foreignKeyColumn="t_purchase_return_id"
            :recordLabel="selectedItem?.no_return || ''"
            :documentStatus="selectedItem?.status || ''"
            variant="outline"
            size="default"
            :showLabel="true"
            :disabled="!isActive"
          />
        </div>
      </div>
    </div>

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
      @row-select="(item) => selectItem(item, 0)"
      @row-deselect="deselectItem"
      @selection-change="handleSelectionChange"
      @filter-change="handleTableFilterChange"
    >
      <template #empty> Tidak ada data Purchase Return </template>
    </DataTable>
  </div>

  <!-- ================================================================ -->
  <!-- DELETE CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isDeleteDialogOpen"
    title="Hapus Purchase Return"
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
          <p class="text-sm font-medium">Purchase Return:</p>
          <p class="text-sm text-muted-foreground">
            {{ itemToSendApproval.no_return || "Tanpa Nomor" }}
          </p>
          <p
            v-if="itemToSendApproval.m_supplier?.nama_supp"
            class="text-xs text-muted-foreground mt-1"
          >
            Supplier: {{ itemToSendApproval.m_supplier.nama_supp }}
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

  <!-- ================================================================ -->
  <!-- REFERENCE DIALOG (CEK PO, PR, dll) -->
  <!-- ================================================================ -->
  <Dialog
    :open="isReferenceDialogOpen"
    @update:open="isReferenceDialogOpen = $event"
  >
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <div class="flex items-center gap-3 mb-2">
          <div
            class="flex items-center justify-center w-10 h-10 rounded-full bg-green-50"
          >
            <FileText class="w-5 h-5 text-green-600" />
          </div>
          <DialogTitle class="text-lg">Referensi Dokumen</DialogTitle>
        </div>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <!-- Loading State -->
        <div v-if="isLoadingReference" class="space-y-3">
          <Skeleton class="h-20 w-full" />
          <Skeleton class="h-20 w-full" />
        </div>

        <!-- Reference Data -->
        <div v-else-if="referenceData" class="space-y-4">
          <!-- Purchase Return Info -->
          <div class="p-3 bg-muted rounded-md">
            <p class="text-sm font-medium mb-2">Purchase Return</p>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span class="text-muted-foreground">No:</span>
                <span class="ml-1 font-medium">{{
                  referenceData.purchase_return?.no_return || "-"
                }}</span>
              </div>
              <div>
                <span class="text-muted-foreground">Status:</span>
                <Badge
                  :class="
                    getStatusColorClass(referenceData.purchase_return?.status)
                  "
                  class="ml-1 text-xs"
                >
                  {{ referenceData.purchase_return?.status || "DRAFT" }}
                </Badge>
              </div>
            </div>
          </div>

          <!-- Purchase Order Reference -->
          <div
            v-if="referenceData.references?.purchase_order"
            class="p-3 border rounded-md"
          >
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm font-medium">Purchase Order (PO)</p>
              <Button
                variant="link"
                size="sm"
                class="h-auto p-0 text-xs"
                @click="
                  goToPurchaseOrder(referenceData.references.purchase_order.id)
                "
              >
                Lihat Detail →
              </Button>
            </div>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span class="text-muted-foreground">No PO:</span>
                <span class="ml-1 font-medium">{{
                  referenceData.references.purchase_order.no_po || "-"
                }}</span>
              </div>
              <div>
                <span class="text-muted-foreground">Tanggal:</span>
                <span class="ml-1">{{
                  referenceData.references.purchase_order.tgl_po
                    ? new Date(
                        referenceData.references.purchase_order.tgl_po,
                      ).toLocaleDateString("id-ID")
                    : "-"
                }}</span>
              </div>
              <div>
                <span class="text-muted-foreground">Status:</span>
                <Badge
                  :class="
                    getStatusColorClass(
                      referenceData.references.purchase_order.status,
                    )
                  "
                  class="ml-1 text-xs"
                >
                  {{ referenceData.references.purchase_order.status || "-" }}
                </Badge>
              </div>
              <div v-if="referenceData.references.purchase_order.supplier">
                <span class="text-muted-foreground">Supplier:</span>
                <span class="ml-1">{{
                  referenceData.references.purchase_order.supplier.name || "-"
                }}</span>
              </div>
            </div>
          </div>
          <div v-else class="p-3 border rounded-md border-dashed">
            <p class="text-sm text-muted-foreground text-center">
              Tidak ada referensi Purchase Order
            </p>
          </div>

          <!-- Purchase Request Reference -->
          <div
            v-if="referenceData.references?.purchase_request"
            class="p-3 border rounded-md"
          >
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm font-medium">Purchase Request (PR)</p>
              <Button
                variant="link"
                size="sm"
                class="h-auto p-0 text-xs"
                @click="
                  goToPurchaseRequest(
                    referenceData.references.purchase_request.id,
                  )
                "
              >
                Lihat Detail →
              </Button>
            </div>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span class="text-muted-foreground">No PR:</span>
                <span class="ml-1 font-medium">{{
                  referenceData.references.purchase_request.no_return || "-"
                }}</span>
              </div>
              <div>
                <span class="text-muted-foreground">Tanggal:</span>
                <span class="ml-1">{{
                  referenceData.references.purchase_request.tgl_pr
                    ? new Date(
                        referenceData.references.purchase_request.tgl_pr,
                      ).toLocaleDateString("id-ID")
                    : "-"
                }}</span>
              </div>
              <div>
                <span class="text-muted-foreground">Status:</span>
                <Badge
                  :class="
                    getStatusColorClass(
                      referenceData.references.purchase_request.status,
                    )
                  "
                  class="ml-1 text-xs"
                >
                  {{ referenceData.references.purchase_request.status || "-" }}
                </Badge>
              </div>
              <div v-if="referenceData.references.purchase_request.req_user_by">
                <span class="text-muted-foreground">Requester:</span>
                <span class="ml-1">{{
                  referenceData.references.purchase_request.req_user_by || "-"
                }}</span>
              </div>
            </div>
          </div>

          <!-- Purchase Request Close Reference -->
          <div
            v-if="referenceData.references?.purchase_request_close"
            class="p-3 border rounded-md bg-yellow-50"
          >
            <p class="text-sm font-medium mb-2">Purchase Request Close</p>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span class="text-muted-foreground">No:</span>
                <span class="ml-1 font-medium">{{
                  referenceData.references.purchase_request_close
                    .no_preq_close || "-"
                }}</span>
              </div>
              <div>
                <span class="text-muted-foreground">Status:</span>
                <Badge
                  :class="
                    getStatusColorClass(
                      referenceData.references.purchase_request_close.status,
                    )
                  "
                  class="ml-1 text-xs"
                >
                  {{
                    referenceData.references.purchase_request_close.status ||
                    "-"
                  }}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <!-- No Data -->
        <div v-else class="text-center py-8">
          <p class="text-sm text-muted-foreground">Tidak ada data referensi</p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="closeReferenceDialog"> Tutup </Button>
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
