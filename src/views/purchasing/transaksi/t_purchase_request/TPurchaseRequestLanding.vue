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
  FilterX,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  OutstandingButton,
} from "@/components/button";
import { FieldX } from "@/components/field";
import { useActionButtons } from "@/composables/useActionButtons";
import { usePermission } from "@/composables/usePermission";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  bulkDeleteTPurchaseRequest,
  getTPurchaseRequestList,
  deleteTPurchaseRequest,
  type TPurchaseRequestItem,
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
const itemToDelete = ref<TPurchaseRequestItem | null>(null);
const itemsToDelete = ref<TPurchaseRequestItem[]>([]);
const isDeleting = ref(false);

// ============================================================================
// SEND APPROVAL DIALOG STATE
// ============================================================================
const isSendApprovalDialogOpen = ref(false);
const itemToSendApproval = ref<TPurchaseRequestItem | null>(null);
const approvalCatatan = ref("");
const isSendingApproval = ref(false);

// Get current approval info from localStorage
const currentApprovalInfo = computed(() => {
  const approvalList = authStore.getApprovalList();
  return approvalList.find(
    (approval: any) =>
      approval.path === "/purchasing/transaksi/t_purchase_request" &&
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
const canEditSelection = computed(() => isActive.value && !isStatusLocked.value);
const canDeleteSelection = computed(
  () => isActive.value && isDraftItem(selectedItem.value),
);

// Helper function to check if specific item has locked status (IN APPROVAL, APPROVED, REJECT)
const isItemStatusLocked = (item: TPurchaseRequestItem) => {
  const status = item.status?.toUpperCase();
  return (
    status === "IN APPROVAL" || status === "APPROVED" || status === "REJECT"
  );
};

const isDraftItem = (item: TPurchaseRequestItem | null | undefined) => {
  return (item?.status || "DRAFT").toUpperCase() === "DRAFT";
};

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<TPurchaseRequestItem[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const hasMoreData = ref(true);
const dataTableRef = ref<any>(null);

// ============================================================================
// BULK SELECTION STATE
// ============================================================================
const selectedItems = ref<TPurchaseRequestItem[]>([]);
const isMobileSelectionMode = ref(false);
const selectedDraftCount = computed(
  () => selectedItems.value.filter((item) => isDraftItem(item)).length,
);

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
const filterRfq = ref<"all" | "rfq" | "non_rfq">("all");

watch(filterRfq, () => {
  clearAllSelection();
  menuData.value = [];
  currentPage.value = 1;
  hasMoreData.value = true;
  fetchMenuData(1, true);
});

watch(filterStatus, () => {
  clearAllSelection(true);
});

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
const tableWhereClause = ref("");

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const columns = [
  {
    key: "m_unit_bisni.nama_comp",
    label: "Unit Bisnis",
    filterable: true,
    width: "250px",
    renderHtml: (item: any) => {
      return item.m_unit_bisni?.nama_comp || "-";
    },
  },
  { key: "no_pr", label: "No PR", filterable: true, width: "200px" },
  {
    key: "tgl_pr",
    label: "Tanggal PR",
    filterable: true,
    filterType: "date" as const,
    width: "150px",
  },
  {
    key: "tgl_butuh",
    label: "Tanggal Dibutuhkan",
    filterable: true,
    filterType: "date" as const,
    width: "150px",
  },
  { key: "catatan", label: "Catatan", filterable: true, width: "250px" },
  {
    key: "is_rfq",
    label: "RFQ",
    width: "100px",
    renderHtml: (item: TPurchaseRequestItem) => {
      const text = item.is_rfq ? "YA" : "TIDAK";
      return `<span class="text-sm font-medium text-foreground">${text}</span>`;
    },
  },
  {
    key: "status",
    label: "Status",
    filterable: true,
    width: "150px",
    renderHtml: (item: TPurchaseRequestItem) => {
      const status = item.status || "DRAFT";
      const badgeClass = getStatusStyle(status);
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${status}</span>`;
    },
  },
  {
    key: "status_transaksi",
    label: "Status PO",
    filterable: true,
    width: "150px",
    renderHtml: (item: TPurchaseRequestItem) => {
      const statusTransaksi = (item as any).status_transaksi || "OUTSTANDING";
      const badgeClass = getStatusTransaksiStyle(statusTransaksi);
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${statusTransaksi}</span>`;
    },
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/** Get status badge styling */
const getStatusStyle = getApprovalStatusBadgeClass;

/** Get status transaksi badge styling */
const getStatusTransaksiStyle = (status: string) => {
  const statusUpper = (status || "").toUpperCase();
  switch (statusUpper) {
    case "OUTSTANDING":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
    case "PROGRESS":
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case "PARTIAL":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
    case "DONE":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case "CLOSED":
      return "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-300";
    default:
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
  }
};

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================
/**
 * TIPE USER IDs (from m_general table)
 * - SUPER ADMIN: f2fa9b8c-d4ca-4fd0-abfa-944370031519
 * - DEVELOPER: 57211e47-f042-47fc-b268-ec96cb4fab17
 * - ADMIN PURCHASING: 8884046c-4c2d-462d-a058-79035629892a
 * - USER PURCHASING: 55af2f1a-c654-4482-8d69-e6c3b0ee353d
 * - ADMIN MARKETING: fd09abc2-bc85-416c-8066-0f67bd5ab2b6
 * - USER MARKETING: 5e3fc77d-8eeb-4b46-a528-a1c081cfbf85
 * - ADMIN INVENTORY: 0d145ddb-885a-4172-9612-f9a146eddffa
 * - USER INVENTORY: 78982adb-59c9-4855-8f16-5dccb8dfc462
 * - ADMIN PRODUKSI: 9ba53fc4-e4f0-4c77-b752-4f9acee76828
 */
const TIPE_USER_IDS = {
  SUPER_ADMIN: "f2fa9b8c-d4ca-4fd0-abfa-944370031519",
  DEVELOPER: "57211e47-f042-47fc-b268-ec96cb4fab17",
  ADMIN_PURCHASING: "8884046c-4c2d-462d-a058-79035629892a",
  USER_PURCHASING: "55af2f1a-c654-4482-8d69-e6c3b0ee353d",
};

/** Check if user can view all data (SUPER ADMIN, DEVELOPER, ADMIN PURCHASING) */
const canViewAllData = computed(() => {
  const tipeUserId = authStore.tipeUser?.id;
  if (!tipeUserId) return false;
  return [
    TIPE_USER_IDS.SUPER_ADMIN,
    TIPE_USER_IDS.DEVELOPER,
    TIPE_USER_IDS.ADMIN_PURCHASING,
  ].includes(tipeUserId);
});

/** Filter t_purchase_request data by status */
const filteredData = computed(() => {
  if (!filterStatus.value) return menuData.value;

  return menuData.value.filter((item) => {
    const itemStatus = (item.status || "").toUpperCase();
    return itemStatus === filterStatus.value;
  });
});

/** Count per status dari data yang sudah di-load */
const statusCounts = computed(() => {
  const counts: Record<string, number> = {
    DRAFT: 0,
    "IN APPROVAL": 0,
    APPROVED: 0,
    REJECT: 0,
    REVISI: 0,
  };
  menuData.value.forEach((item) => {
    const s = (item.status || "DRAFT").toUpperCase();
    if (s in counts) counts[s] = (counts[s] || 0) + 1;
  });
  return counts;
});

/** Deskripsi dialog delete */
const deleteDialogDescription = computed(() => {
  if (itemsToDelete.value.length > 1) {
    return `Apakah Anda yakin ingin menghapus ${itemsToDelete.value.length} Purchase Request terpilih? Tindakan ini tidak dapat dibatalkan.`;
  }

  if (itemsToDelete.value.length === 1) {
    const item = itemsToDelete.value[0];
    return `Apakah Anda yakin ingin menghapus Purchase Request "${item?.no_pr || "tanpa nomor"}"? Tindakan ini tidak dapat dibatalkan.`;
  }

  if (!itemToDelete.value) return "";
  return `Apakah Anda yakin ingin menghapus Purchase Request "${itemToDelete.value.no_pr || "tanpa nomor"}"? Tindakan ini tidak dapat dibatalkan.`;
});

/** Deskripsi dialog send approval */
const sendApprovalDialogDescription = computed(() => {
  if (!itemToSendApproval.value) return "";
  return `Kirim Purchase Request "${itemToSendApproval.value.no_pr || "tanpa nomor"}" untuk proses approval?`;
});

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
/** Trigger delete dialog */
const deleteSelected = (item?: TPurchaseRequestItem | Event) => {
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
      description:
        "Hanya Purchase Request dengan status DRAFT yang dapat dihapus",
    });
    return;
  }

  itemsToDelete.value = deletableItems;
  itemToDelete.value = deletableItems.length === 1 ? deletableItems[0] : null;
  isDeleteDialogOpen.value = true;
};

/** Konfirmasi delete - hit API dan update UI */
const confirmDelete = async () => {
  const targets = itemsToDelete.value.length
    ? itemsToDelete.value
    : itemToDelete.value
      ? [itemToDelete.value]
      : [];

  if (targets.length === 0) return;

  isDeleting.value = true;
  try {
    const validTargets = targets.filter((target) => !!target.id);
    const successIds: string[] = [];
    let failedCount = 0;

    if (validTargets.length > 1) {
      const response = await bulkDeleteTPurchaseRequest(
        validTargets.map((target) => target.id as string),
      );

      if (response.status === "success") {
        successIds.push(
          ...validTargets.map((target) => target.id as string),
        );
      } else {
        failedCount = validTargets.length;
      }
    } else {
      const results = await Promise.allSettled(
        validTargets.map((target) => deleteTPurchaseRequest(target.id as string)),
      );

      results.forEach((result, index) => {
        const target = validTargets[index];
        if (
          result.status === "fulfilled" &&
          result.value.status === "success" &&
          target?.id
        ) {
          successIds.push(target.id);
        } else {
          failedCount++;
        }
      });
    }

    if (successIds.length > 0) {
      menuData.value = menuData.value.filter(
        (menuItem: TPurchaseRequestItem) => !successIds.includes(menuItem.id || ""),
      );
      selectedItems.value = selectedItems.value.filter(
        (selected) => !successIds.includes(selected.id || ""),
      );

      clearAllSelection(true);

      toast.success(
        successIds.length === 1
          ? "Purchase Request berhasil dihapus"
          : `${successIds.length} Purchase Request berhasil dihapus`,
        {
          description:
            successIds.length === 1
              ? "1 item telah dihapus dari database"
              : `${successIds.length} item telah dihapus dari database`,
        },
      );
    }

    if (failedCount > 0) {
      toast.error("Sebagian Purchase Request gagal dihapus", {
        description: `${failedCount} item gagal dihapus`,
      });
    }

    isDeleteDialogOpen.value = false;
  } catch (error) {
    toast.error("Gagal menghapus TPurchaseRequest", {
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
const openSendApprovalDialog = (item?: TPurchaseRequestItem) => {
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

/** Confirm send approval - hit API POST t_purchase_request_notifikasi */
const confirmSendApproval = async () => {
  if (!itemToSendApproval.value || !itemToSendApproval.value.id) return;

  isSendingApproval.value = true;
  try {
    // Get approval data from localStorage
    const approvalList = authStore.getApprovalList();
    const currentApproval = approvalList.find(
      (approval: any) =>
        approval.path === "/purchasing/transaksi/t_purchase_request" &&
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
      t_purchase_request_id: itemToSendApproval.value.id,
      approval_message: approvalCatatan.value.trim() || null,
    };

    // Call API POST /dynamic/t_purchase_request_notifikasi
    const response = await fetch(
      `${API_BASE_URL}/dynamic/t_purchase_request_notifikasi`,
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
        (m: TPurchaseRequestItem) => m.id === itemToSendApproval.value!.id,
      );
      if (itemIndex !== -1) {
        const updatedItem = {
          ...menuData.value[itemIndex],
          status: "IN APPROVAL",
        } as TPurchaseRequestItem;
        menuData.value.splice(itemIndex, 1, updatedItem);
      }

      toast.success("Approval berhasil dikirim", {
        description: `Purchase Request "${itemToSendApproval.value.no_pr || "tanpa nomor"}" telah dikirim untuk approval`,
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
/** Export t_purchase_request data */
const exportData = () => {
  toast.info("Export feature coming soon");
};

/** View TPurchaseRequest item details */
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
    `/purchasing/transaksi/t_purchase_request/view/${selectedItem.value.id}`,
  );
};

/** Edit TPurchaseRequest item */
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

  // Check if status is locked (IN APPROVAL, APPROVED, REJECT)
  const targetItem = item || selectedItem.value;
  if (targetItem && isItemStatusLocked(targetItem)) {
    toast.error("Tidak dapat mengedit", {
      description: `Data dengan status ${targetItem.status} tidak dapat diubah`,
    });
    return;
  }

  const selectedItemData = handleEdit(item);
  if (!selectedItemData) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }
  // Navigate to edit form
  router.push(
    `/purchasing/transaksi/t_purchase_request/form/${selectedItemData.id}`,
  );
};

/** Copy TPurchaseRequest item - duplicate data tanpa ID untuk create new */
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
    path: "/purchasing/transaksi/t_purchase_request/form",
    query: {
      action: "copy",
      source: selectedItemData.id,
    },
  });

  toast.success(`Menyalin data "${selectedItemData.name}"`, {
    description: "Silakan edit dan simpan sebagai TPurchaseRequest baru",
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

  router.push("/purchasing/transaksi/t_purchase_request/form");
};

// ============================================================================
// API & DATA FETCHING FUNCTIONS
// ============================================================================
/** Fetch t_purchase_request data dari API with search support and dynamic filters */
const fetchMenuData = async (
  page: number = 1,
  resetData: boolean = false,
) => {
  if (page === 1 || resetData) {
    loading.value = true;
  } else {
    loadingMore.value = true;
  }

  try {
    // Get company filter (only for non-SUPER ADMIN and non-ADMIN PURCHASING)
    let companyFilter: string | undefined = undefined;
    const userRole = authStore.tipeUser?.value1?.trim().toUpperCase();
    const canViewAllCompanies =
      userRole === "SUPER ADMIN" || userRole === "ADMIN PURCHASING";

    if (!canViewAllCompanies) {
      const selectRespo = localStorage.getItem("SelectRespo");
      if (selectRespo) {
        const respoData = JSON.parse(selectRespo);
        companyFilter = respoData.companyId || undefined;
      }
    }

    // Determine if user should see all data or only their own
    const filterCreatedBy = canViewAllData.value
      ? undefined
      : authStore.currentUser?.id;

    // Prepare column filters with proper API field names
    const apiColumnFilters: ColumnFilters = {};
    const apiColumnFilterOperators: ColumnFilterOperators = {};

    // Add company filter for non-SUPER ADMIN
    if (companyFilter) {
      apiColumnFilters["m_unit_bisnis_id"] = companyFilter;
    }

    Object.entries(tableColumnFilters.value).forEach(([key, value]) => {
      if (value && value.trim()) {
        const filterKey = key;
        apiColumnFilters[filterKey] = value;

        // Add corresponding operator if available
        if (tableColumnFilterOperators.value[key]) {
          apiColumnFilterOperators[filterKey] =
            tableColumnFilterOperators.value[key];
        }
      }
    });

    // Process RFQ filter dropdown
    if (filterRfq.value !== "all") {
      apiColumnFilters["is_rfq"] = filterRfq.value === "rfq" ? "true" : "false";
      apiColumnFilterOperators["is_rfq"] = "=";
    }

    // Call API with search parameters and created_by filter
    const response = await getTPurchaseRequestList(
      page,
      pageSize.value,
      "createdAt",
      "DESC",
      searchApiQuery.value || undefined,
      searchApiQuery.value
        ? "no_pr,catatan,req_user_by,req_type_user"
        : undefined,
      filterCreatedBy,
      Object.keys(apiColumnFilters).length > 0 ? apiColumnFilters : undefined,
      Object.keys(apiColumnFilterOperators).length > 0
        ? apiColumnFilterOperators
        : undefined,
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
    toast.error("Gagal memuat data TPurchaseRequest", {
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
  clearAllSelection();

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

/** Handle API search - triggered by Enter or Search button */
const handleApiSearch = async () => {
  if (isSearching.value) return;

  isSearching.value = true;
  searchApiQuery.value = searchQuery.value;
  clearAllSelection(true);

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

/** Handle refresh - reload data from scratch */
const handleRefresh = async () => {
  // Reset state
  searchQuery.value = "";
  searchApiQuery.value = "";
  menuData.value = [];
  currentPage.value = 1;
  hasMoreData.value = true;
  clearAllSelection(true);

  // Reload data
  await fetchMenuData(1, true);

  toast.success("Data berhasil dimuat ulang");
};

/** Clear all filters and reset to initial state */
const clearAllFilters = async () => {
  filterStatus.value = null;
  filterRfq.value = "all";
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

  // Reset AG Grid column filters
  dataTableRef.value?.resetFilters?.();

  await fetchMenuData(1, true);

  toast.success("Semua filter telah direset");
};

const selectionAnchor = ref<TPurchaseRequestItem | null>(null);

const isDraftStatus = (item?: TPurchaseRequestItem | null) =>
  (item?.status || "").toUpperCase() === "DRAFT";

const handleSelectionChange = (items: TPurchaseRequestItem[]) => {
  if (items.length === 0) {
    selectionAnchor.value = null;
    selectedItems.value = [];
    deselectItem();
    return;
  }

  const firstItem = items[0];
  if (!firstItem) return;
  const prevAnchor = selectionAnchor.value;
  const anchor: TPurchaseRequestItem =
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

const isItemSelected = (itemId?: string) => {
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

const toggleMobileItemSelection = (item: TPurchaseRequestItem) => {
  if (!isDraftItem(item)) return;
  if (!item.id) return;

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
  <div class="lg:hidden flex flex-col min-h-screen pb-36">
    <!-- STICKY HEADER -->
    <div class="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
      <div class="p-4 space-y-3">
        <!-- Title & Refresh -->
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-lg font-bold">Transaksi Purchase Request</h1>
            <p class="text-xs text-muted-foreground">
              Kelola Purchase Request aplikasi
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
            <OutstandingButton
              endpoint="t_purchase_request"
              view-path="/purchasing/transaksi/t_purchase_request"
              title="Purchase Request Outstanding"
              size="sm"
              :columns="[
                { key: 'no_pr', label: 'No PR', width: '150px' },
                { key: 'tgl_pr', label: 'Tanggal PR', width: '120px' },
                { key: 'req_user_by', label: 'Request By', width: '150px' },
                { key: 'catatan', label: 'Catatan', width: '200px' },
              ]"
            />
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
            DRAFT <span v-if="(statusCounts?.['DRAFT'] || 0) > 0" class="ml-1 opacity-75">({{ statusCounts?.['DRAFT'] }})</span>
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
            IN APPROVAL <span v-if="(statusCounts?.['IN APPROVAL'] || 0) > 0" class="ml-1 opacity-75">({{ statusCounts?.['IN APPROVAL'] }})</span>
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
            APPROVED <span v-if="(statusCounts?.['APPROVED'] || 0) > 0" class="ml-1 opacity-75">({{ statusCounts?.['APPROVED'] }})</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7 whitespace-nowrap"
            :class="getApprovalStatusFilterClass('REJECT', filterStatus === 'REJECT')"
            @click="filterStatus = filterStatus === 'REJECT' ? null : 'REJECT'"
          >
            REJECT <span v-if="(statusCounts?.['REJECT'] || 0) > 0" class="ml-1 opacity-75">({{ statusCounts?.['REJECT'] }})</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7 whitespace-nowrap"
            :class="getApprovalStatusFilterClass('REVISI', filterStatus === 'REVISI')"
            @click="filterStatus = filterStatus === 'REVISI' ? null : 'REVISI'"
          >
            REVISI <span v-if="(statusCounts?.['REVISI'] || 0) > 0" class="ml-1 opacity-75">({{ statusCounts?.['REVISI'] }})</span>
          </Button>
        </div>

        <!-- Search & RFQ Filter Row -->
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
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
          <Select v-model="filterRfq">
            <SelectTrigger class="w-[110px] h-8 bg-background text-foreground border border-input rounded-md px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
              <SelectValue placeholder="RFQ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="rfq">RFQ</SelectItem>
              <SelectItem value="non_rfq">Non RFQ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div
          v-if="isMobileSelectionMode"
          class="flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2"
        >
          <span class="text-xs text-muted-foreground">
            {{ selectedItems.length }} item dipilih
          </span>
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
            isMobileSelectionMode
              ? 'hover:border-primary/60'
              : 'hover:shadow-md',
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
                    {{ item.no_pr || "Tanpa Nomor" }}
                  </div>
                  <div class="text-xs text-muted-foreground truncate">
                    {{
                      item.tgl_pr
                        ? new Date(item.tgl_pr).toLocaleDateString("id-ID")
                        : "-"
                    }}
                  </div>
                </div>
              </div>
              <Badge
                :class="getStatusStyle(item.status || 'DRAFT')"
                class="text-xs shrink-0"
              >
                {{ item.status || "DRAFT" }}
              </Badge>
            </div>

            <!-- Details -->
            <div class="text-xs space-y-1 text-muted-foreground">
              <div>
                <span class="font-medium">Tgl Butuh:</span>
                {{
                  item.tgl_butuh
                    ? new Date(item.tgl_butuh).toLocaleDateString("id-ID")
                    : "-"
                }}
              </div>
              <div v-if="item.catatan" class="truncate">
                <span class="font-medium">Catatan:</span> {{ item.catatan }}
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
              <DeleteButton
                v-permission="{ menuId: currentMenuId, action: 'delete' }"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                :status="item.status"
                :disabled="!isDraftItem(item)"
                @click.stop="deleteSelected(item)"
              />
              <EditButton
                v-permission="{ menuId: currentMenuId, action: 'update' }"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                :status="item.status"
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
                path="/purchasing/transaksi/t_purchase_request"
                :status="item.status"
                variant="ghost"
                size="sm"
                :showLabel="false"
                class="h-7 w-7"
                @click.stop="openSendApprovalDialog(item)"
              />
              <HistoryApprovalButton
                :record-id="item.id || ''"
                notification-endpoint="t_purchase_request_notifikasi"
                foreign-key-column="t_purchase_request_id"
                :record-label="item.no_pr || 'Tanpa Nomor'"
                :document-status="item.status"
                :created-by-tipe-user="(item as any).req_type_user"
                :created-by-name="(item as any).req_user_by"
                :created-at="item.createdAt"
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

      <div
        v-if="isMobileSelectionMode"
        class="fixed inset-x-4 bottom-4 z-50 rounded-2xl border bg-background/95 p-3 shadow-lg backdrop-blur"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-medium">
              {{ selectedItems.length }} item dipilih
            </p>
            <p class="text-xs text-muted-foreground">
              {{ selectedDraftCount }} item DRAFT siap dihapus
            </p>
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              class="h-9 px-3"
              @click="clearAllSelection()"
            >
              Clear
            </Button>
            <BulkDeleteButton
              v-if="selectedItems.length > 1"
              v-permission="{ menuId: currentMenuId, action: 'delete' }"
              size="sm"
              :count="selectedDraftCount"
              :disabled="selectedDraftCount === 0"
              @click="deleteSelected"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- FAB Button - Teleport -->
    <teleport to="body">
      <Button
        v-if="!isMobileSelectionMode"
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
        <h1 class="text-2xl font-bold">Transaksi Purchase Request</h1>
        <p class="text-sm text-muted-foreground">
          Kelola Purchase Request aplikasi
        </p>
      </div>
      <div class="flex items-center gap-2">
        <OutstandingButton
          endpoint="t_purchase_request"
          view-path="/purchasing/transaksi/t_purchase_request"
          title="Purchase Request Outstanding"
          :columns="[
            { key: 'no_pr', label: 'No PR', width: '150px' },
            { key: 'tgl_pr', label: 'Tanggal PR', width: '120px' },
            { key: 'tgl_butuh', label: 'Tgl Butuh', width: '120px' },
            { key: 'req_user_by', label: 'Request By', width: '150px' },
            { key: 'catatan', label: 'Catatan', width: '200px' },
          ]"
        />
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
          DRAFT <span v-if="(statusCounts?.['DRAFT'] || 0) > 0" class="ml-1 opacity-75">({{ statusCounts?.['DRAFT'] }})</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="getApprovalStatusFilterClass('IN APPROVAL', filterStatus === 'IN APPROVAL')"
          @click="
            filterStatus = filterStatus === 'IN APPROVAL' ? null : 'IN APPROVAL'
          "
        >
          IN APPROVAL <span v-if="(statusCounts?.['IN APPROVAL'] || 0) > 0" class="ml-1 opacity-75">({{ statusCounts?.['IN APPROVAL'] }})</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="getApprovalStatusFilterClass('APPROVED', filterStatus === 'APPROVED')"
          @click="
            filterStatus = filterStatus === 'APPROVED' ? null : 'APPROVED'
          "
        >
          APPROVED <span v-if="(statusCounts?.['APPROVED'] || 0) > 0" class="ml-1 opacity-75">({{ statusCounts?.['APPROVED'] }})</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="getApprovalStatusFilterClass('REJECT', filterStatus === 'REJECT')"
          @click="filterStatus = filterStatus === 'REJECT' ? null : 'REJECT'"
        >
          REJECT <span v-if="(statusCounts?.['REJECT'] || 0) > 0" class="ml-1 opacity-75">({{ statusCounts?.['REJECT'] }})</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="getApprovalStatusFilterClass('REVISI', filterStatus === 'REVISI')"
          @click="filterStatus = filterStatus === 'REVISI' ? null : 'REVISI'"
        >
          REVISI <span v-if="(statusCounts?.['REVISI'] || 0) > 0" class="ml-1 opacity-75">({{ statusCounts?.['REVISI'] }})</span>
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
            :disabled="!canDeleteSelection"
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
            :disabled="!canEditSelection"
            @click="editItem()"
          />
          <CopyButton
            v-permission="{ menuId: currentMenuId, action: 'create' }"
            :disabled="!isActive"
            @click="copyItem()"
          />
          <SendApprovalButton
            path="/purchasing/transaksi/t_purchase_request"
            :status="selectedItem?.status"
            variant="default"
            size="default"
            :showLabel="true"
            :disabled="!isActive"
            @click="openSendApprovalDialog()"
          />
          <HistoryApprovalButton
            :record-id="selectedItem?.id || ''"
            notification-endpoint="t_purchase_request_notifikasi"
            foreign-key-column="t_purchase_request_id"
            :record-label="selectedItem?.no_pr || 'Tanpa Nomor'"
            :document-status="selectedItem?.status"
            :created-by-tipe-user="(selectedItem as any)?.req_type_user"
            :created-by-name="(selectedItem as any)?.req_user_by"
            :created-at="selectedItem?.createdAt"
            variant="outline"
            size="default"
            :show-label="true"
            :disabled="!isActive"
          />
          <Select v-model="filterRfq">
            <SelectTrigger class="w-[140px] h-10 bg-background text-foreground border border-input rounded-md px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
              <SelectValue placeholder="RFQ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua RFQ</SelectItem>
              <SelectItem value="rfq">RFQ</SelectItem>
              <SelectItem value="non_rfq">Non RFQ</SelectItem>
            </SelectContent>
          </Select>
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
      @selection-change="handleSelectionChange"
      @row-select="(item) => selectItem(item, 0)"
      @row-deselect="deselectItem"
      @filter-change="handleTableFilterChange"
      @refresh-requested="handleRefresh"
    >
      <template #empty> Tidak ada data TPurchaseRequest </template>
    </DataTable>

    <div
      v-if="selectedItems.length > 0"
      class="mt-2 flex items-center justify-between rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground"
    >
      <span>{{ selectedItems.length }} item dipilih</span>
      <Button variant="ghost" size="sm" class="h-7" @click="clearAllSelection()">
        Clear Selection
      </Button>
    </div>
  </div>

  <!-- ================================================================ -->
  <!-- DELETE CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isDeleteDialogOpen"
    title="Hapus TPurchaseRequest"
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
          <p class="text-sm font-medium">Purchase Request:</p>
          <p class="text-sm text-muted-foreground">
            {{ itemToSendApproval.no_pr || "Tanpa Nomor" }}
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
