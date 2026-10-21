<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  TransitionGroup,
  watch,
} from "vue";
import { useRouter } from "vue-router";
import {
  Search,
  Trash2,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
} from "@/components/ui/dialog";
import { FieldX } from "@/components/field";
import DataTable from "@/components/table/DataTable.vue";
import {
  BulkDeleteButton,
  DeleteButton,
  EditButton,
  CopyButton,
  ViewButton,
  SendApprovalButton,
  HistoryApprovalButton,
  OutstandingButton,
  PrintButton,
} from "@/components/button";
import { useActionButtons } from "@/composables/useActionButtons";
import { usePermission } from "@/composables/usePermission";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  getTPurchaseOrderList,
  deleteTPurchaseOrder,
  bulkDeleteTPurchaseOrder,
  type TPurchaseOrderItem,
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
const itemToDelete = ref<TPurchaseOrderItem | null>(null);
const itemsToDelete = ref<TPurchaseOrderItem[]>([]);
const isDeleting = ref(false);

// ============================================================================
// SEND APPROVAL DIALOG STATE
// ============================================================================
const isSendApprovalDialogOpen = ref(false);
const itemToSendApproval = ref<TPurchaseOrderItem | null>(null);
const approvalCatatan = ref("");
const isSendingApproval = ref(false);

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<TPurchaseOrderItem[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const hasMoreData = ref(true);
const dataTableRef = ref<any>(null);

// ============================================================================
// BULK SELECTION STATE
// ============================================================================
const selectedItems = ref<TPurchaseOrderItem[]>([]);
const isMobileSelectionMode = ref(false);
const canPrintSelected = computed(() => {
  return selectedItems.value.length === 1 && !!selectedItems.value[0]?.id;
});

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

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const columns = [
  { key: "no_po", label: "No. PO", filterable: true, width: "140px" },
  {
    key: "tgl_po",
    label: "Tanggal PO",
    filterable: true,
    filterType: "date" as const,
    width: "120px",
    renderHtml: (item: TPurchaseOrderItem) => {
      return item.tgl_po
        ? new Date(item.tgl_po).toLocaleDateString("id-ID")
        : "-";
    },
  },
  {
    key: "m_unit_bisni.nama_comp",
    label: "Unit Bisnis",
    filterable: true,
    width: "180px",
    renderHtml: (item: any) => {
      return item.m_unit_bisni?.nama_comp || "-";
    },
  },
  {
    key: "po_tipe_item.value1",
    label: "Tipe",
    filterable: true,
    width: "150px",
    renderHtml: (item: TPurchaseOrderItem) => {
      return item.po_tipe_item?.value1 || "-";
    },
  },
  {
    key: "m_supplier.nama_supp",
    label: "Supplier",
    filterable: true,
    width: "200px",
    renderHtml: (item: any) => {
      return item.m_supplier?.nama_supp || "-";
    },
  },
  {
    key: "top_id",
    label: "ToP",
    filterable: false,
    width: "100px",
    valueGetter: (item: any) => {
      return item.top_po?.value1 || "";
    },
    renderHtml: (item: any) => {
      // API returns top_po as relation name
      return item.top_po?.value1 || "-";
    },
  },
  {
    key: "grand_total",
    label: "Grand Total",
    filterable: false,
    width: "220px",
    renderHtml: (item: TPurchaseOrderItem) => {
      // Get currency info from uang_po.money
      const currencySymbol = item.uang_po?.money?.value2 || "Rp";
      const currencyName = item.uang_po?.money?.value1 || "Indonesian Rupiah";

      const formatted = item.grand_total
        ? new Intl.NumberFormat("id-ID", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(Number(item.grand_total))
        : "0";

      return `<div class="flex flex-col gap-0.5 min-w-0">
                <span class="font-bold text-sm whitespace-nowrap">${currencySymbol} ${formatted}</span>
                <span class="text-xs text-muted-foreground truncate" title="${currencyName}">(${currencyName})</span>
            </div>`;
    },
  },
  {
    key: "status",
    label: "Status",
    filterable: true,
    width: "120px",
    renderHtml: (item: TPurchaseOrderItem) => {
      const status = item.status || "DRAFT";
      const badgeClass = getStatusStyle(status);
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${status}</span>`;
    },
  },
  {
    key: "status_transaksi",
    label: "Status Transaksi",
    filterable: true,
    width: "140px",
    renderHtml: (item: any) => {
      const statusTransaksi = item.status_transaksi || "-";
      if (statusTransaksi === "-") return statusTransaksi;

      // Styling untuk status transaksi
      let badgeClass = "";
      const statusUpper = statusTransaksi.toUpperCase();

      // Check untuk pattern INVOICED (termasuk INVOICED 1/2, dst)
      if (statusUpper === "INVOICED" || statusUpper.startsWith("INVOICED ")) {
        badgeClass =
          "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      } else {
        switch (statusUpper) {
          case "OUTSTANDING":
            badgeClass =
              "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300";
            break;
          case "PARTIAL":
            badgeClass =
              "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
            break;
          case "RECEIVED":
            badgeClass =
              "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
            break;
          default:
            badgeClass =
              "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
        }
      }
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${statusTransaksi}</span>`;
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
/** Filter t_purchase_order data by status */
const filteredData = computed(() => {
  return menuData.value.filter((item) => {
    let matchStatus = true;
    if (filterStatus.value) {
      const itemStatus = (item.status || "").toUpperCase();
      matchStatus = itemStatus === filterStatus.value;
    }

    const colFilters = tableColumnFilters.value;
    const relationParts = Object.entries(colFilters).filter(
      ([key, val]) => key.includes(".") && val?.trim(),
    );

    let matchRelations = true;
    if (relationParts.length > 0) {
      matchRelations = relationParts.every(([key, val]) => {
        let objValue: any = item;
        const parts = key.split(".");
        for (const part of parts) {
          objValue = objValue?.[part];
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
  if (itemsToDelete.value.length > 1) {
    return `Apakah Anda yakin ingin menghapus ${itemsToDelete.value.length} Purchase Order berstatus DRAFT? Tindakan ini tidak dapat dibatalkan.`;
  }
  if (!itemToDelete.value) return "";
  return `Apakah Anda yakin ingin menghapus Purchase Order "${itemToDelete.value.no_po || "tanpa nomor"}"? Tindakan ini tidak dapat dibatalkan.`;
});

/** Check if selected item can be deleted (only DRAFT can be deleted) */
const canDeleteItem = computed(() => {
  if (!selectedItem.value) return false;
  const status = (selectedItem.value.status || "").toUpperCase();
  // APPROVED, IN APPROVAL, REVISI, REJECT tidak bisa dihapus
  return status === "DRAFT";
});

/** Check if selected item can be edited */
const canEditItem = computed(() => {
  if (!selectedItem.value) return false;
  const status = (selectedItem.value.status || "").toUpperCase();
  // APPROVED, REJECT, IN APPROVAL tidak bisa di-edit
  // Hanya DRAFT dan REVISI yang bisa di-edit
  return status === "DRAFT" || status === "REVISI";
});

/** Check if a specific item can be deleted */
const canDeleteItemByStatus = (item: TPurchaseOrderItem) => {
  const status = (item.status || "").toUpperCase();
  return status === "DRAFT";
};

const isDraftItem = (item: TPurchaseOrderItem | null | undefined) => {
  return Boolean(item && canDeleteItemByStatus(item));
};

const selectedDraftCount = computed(
  () => selectedItems.value.filter((item) => isDraftItem(item)).length,
);

/** Check if a specific item can be edited */
const canEditItemByStatus = (item: TPurchaseOrderItem) => {
  const status = (item.status || "").toUpperCase();
  return status === "DRAFT" || status === "REVISI";
};

/** Deskripsi dialog send approval */
const sendApprovalDialogDescription = computed(() => {
  if (!itemToSendApproval.value) return "";
  return `Kirim Purchase Order "${itemToSendApproval.value.no_po || "tanpa nomor"}" untuk approval?`;
});

/** Get current approval info from authStore */
const currentApprovalInfo = computed(() => {
  const approvalList = authStore.getApprovalList();
  return approvalList.find(
    (approval: any) =>
      approval.path === "/purchasing/transaksi/t_purchase_order" &&
      approval.tipe_approve?.toUpperCase() === "MENGAJUKAN",
  );
});

// ============================================================================
// NAVIGATION FUNCTIONS
// ============================================================================
/** Navigate to create form */
const createNew = () => {
  router.push("/purchasing/transaksi/t_purchase_order/form");
};

/** Navigate to edit form */
const editItem = (item?: TPurchaseOrderItem) => {
  if (item) {
    selectItem(item, 0);
  }

  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  // Check if item can be edited based on status
  const status = (selectedItem.value.status || "").toUpperCase();
  if (
    status === "APPROVED" ||
    status === "REJECT" ||
    status === "IN APPROVAL"
  ) {
    toast.error("Tidak dapat mengedit", {
      description: `Purchase Order dengan status ${status} tidak dapat diedit`,
    });
    return;
  }

  router.push(
    `/purchasing/transaksi/t_purchase_order/form/${selectedItem.value.id}`,
  );
};

/** Navigate to copy (new form with data) */
const copyItem = (item?: TPurchaseOrderItem) => {
  if (item) {
    selectItem(item, 0);
  }

  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  router.push({
    path: "/purchasing/transaksi/t_purchase_order/form",
    query: {
      action: "copy",
      source: selectedItem.value.id,
    },
  });
};

/** View TPurchaseOrder item details */
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
    `/purchasing/transaksi/t_purchase_order/view/${selectedItem.value.id}`,
  );
};

const openPDF = async (item?: TPurchaseOrderItem, withHarga: boolean = true) => {
  if (!canPrint.value) {
    toast.error("Akses Ditolak", {
      description: "Anda tidak memiliki izin untuk mencetak data",
    });
    return;
  }

  if (!item && selectedItems.value.length > 1) {
    toast.error("Pilih satu data saja", {
      description: "Print hanya dapat dilakukan untuk satu Purchase Order",
    });
    return;
  }

  const targetItem = item || selectedItems.value[0] || selectedItem.value;

  if (!targetItem) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  selectItem(targetItem, 0);

  router.push({
    name: "TPurchaseOrderPrint",
    params: {
      id: targetItem.id,
    },
    query: {
      withHarga: String(withHarga),
    },
  });
};

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
/** Open delete confirmation dialog */
const deleteSelected = (item?: TPurchaseOrderItem | Event) => {
  const explicitItem = item && !(item instanceof Event) ? item : undefined;
  const candidateItems =
    selectedItems.value.length > 1
      ? selectedItems.value
      : explicitItem
        ? [explicitItem]
        : selectedItems.value.length === 1
          ? selectedItems.value
          : selectedItem.value
            ? [selectedItem.value]
            : [];

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
      description: "Hanya Purchase Order dengan status DRAFT yang dapat dihapus",
    });
    return;
  }

  itemsToDelete.value = deletableItems;
  itemToDelete.value = deletableItems.length === 1 ? deletableItems[0] : null;
  isDeleteDialogOpen.value = true;
};

/** Confirm delete - call API */
const confirmDelete = async () => {
  const targetItems = itemsToDelete.value.length
    ? itemsToDelete.value
    : itemToDelete.value
      ? [itemToDelete.value]
      : [];
  const targetIds = targetItems.map((item) => item.id).filter(Boolean) as string[];
  if (targetIds.length === 0) return;

  isDeleting.value = true;
  try {
    const response =
      targetIds.length > 1
        ? await bulkDeleteTPurchaseOrder(targetIds)
        : await deleteTPurchaseOrder(targetIds[0]!);

    if (response.status === "success") {
      // Remove from list
      const deletedIds = new Set(targetIds);
      menuData.value = menuData.value.filter(
        (m: TPurchaseOrderItem) => !deletedIds.has(m.id || ""),
      );

      toast.success(
        targetIds.length > 1
          ? `${targetIds.length} Purchase Order berhasil dihapus`
          : "Purchase Order berhasil dihapus",
      );
      isDeleteDialogOpen.value = false;
      clearAllSelection();
    } else {
      toast.error("Gagal menghapus Purchase Order", {
        description: response.message || "Terjadi kesalahan saat menghapus",
      });
    }
  } catch (error) {
    toast.error("Gagal menghapus Purchase Order", {
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
const openSendApprovalDialog = (item?: TPurchaseOrderItem) => {
  if (item) {
    selectItem(item, 0);
  }

  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  // Validasi data required sebelum memunculkan modal
  const requiredFields = [
    { key: "m_currency_id", label: "Currency" },
    // { key: "ekspedisi_id", label: "Ekspedisi" },
  ];

  const missingFields = requiredFields.filter(
    (field) => !selectedItem.value![field.key as keyof TPurchaseOrderItem],
  );

  if (missingFields.length > 0) {
    const missingLabels = missingFields.map((f) => f.label).join(", ");
    toast.error("Data PO Belum Lengkap", {
      description: `Harap lengkapi data berikut sebelum mengirim approval: ${missingLabels}. Silakan edit PO terlebih dahulu.`,
    });
    return;
  }

  itemToSendApproval.value = selectedItem.value;
  approvalCatatan.value = "";
  isSendApprovalDialogOpen.value = true;
};

/** Confirm send approval - hit API POST t_purchase_order_notifikasi */
const confirmSendApproval = async () => {
  if (!itemToSendApproval.value || !itemToSendApproval.value.id) return;

  isSendingApproval.value = true;
  try {
    // Get approval data from localStorage
    const approvalList = authStore.getApprovalList();
    const currentApproval = approvalList.find(
      (approval: any) =>
        approval.path === "/purchasing/transaksi/t_purchase_order" &&
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
      t_purchase_order_id: itemToSendApproval.value.id,
      approval_message: approvalCatatan.value.trim() || null,
    };

    // Call API POST /dynamic/t_purchase_order_notifikasi
    const response = await fetch(
      `${API_BASE_URL}/dynamic/t_purchase_order_notifikasi`,
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
        (m: TPurchaseOrderItem) => m.id === itemToSendApproval.value!.id,
      );
      if (itemIndex !== -1) {
        const updatedItem = {
          ...menuData.value[itemIndex],
          status: "IN APPROVAL",
        } as TPurchaseOrderItem;
        menuData.value.splice(itemIndex, 1, updatedItem);
      }

      toast.success("Approval berhasil dikirim", {
        description: `Purchase Order "${itemToSendApproval.value.no_po || "tanpa nomor"}" telah dikirim untuk approval`,
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
// API DATA FETCHING
// ============================================================================
/** Fetch t_purchase_order data from API */
const fetchMenuData = async (
  page: number = 1,
  resetData: boolean = false,
  whereClause?: string,
) => {
  // Set loading state
  if (page === 1) {
    loading.value = true;
  } else {
    loadingMore.value = true;
  }

  try {
    // Reset data jika resetData = true
    if (resetData) {
      menuData.value = [];
    }

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

    // Prepare column filters with proper API field names
    const apiColumnFilters: ColumnFilters = {};
    const apiColumnFilterOperators: ColumnFilterOperators = {};

    // Add company filter for non-SUPER ADMIN
    if (companyFilter) {
      apiColumnFilters["m_unit_bisnis_id"] = companyFilter;
    }

    Object.entries(tableColumnFilters.value).forEach(([key, value]) => {
      if (value && value.trim()) {
        // Find column to get apiFilterField
        const col = columns.find((c) => c.key === key);
        const filterKey = (col as any)?.apiFilterField || key;
        apiColumnFilters[filterKey] = value;

        // Add corresponding operator if available
        if (tableColumnFilterOperators.value[key]) {
          apiColumnFilterOperators[filterKey] =
            tableColumnFilterOperators.value[key];
        }
      }
    });

    const response = await getTPurchaseOrderList({
      page,
      paginate: pageSize.value,
      search: searchApiQuery.value || undefined,
      searchfield: searchApiQuery.value ? "no_po,catatan,$m_unit_bisni.nama_comp$,$m_supplier.nama_supp$" : undefined,
      include:
        "m_supplier:id|nama_supp,m_general:group|value1,m_unit_bisnis:id|nama_comp,m_currency>money,m_currency_d,m_general:id|value1",
      filters:
        Object.keys(apiColumnFilters).length > 0 ? apiColumnFilters : undefined,
      filterOperators:
        Object.keys(apiColumnFilterOperators).length > 0
          ? apiColumnFilterOperators
          : undefined,
      where: whereClause || undefined,
    });

    if (response.status === "success" && response.data) {
      if (page === 1) {
        // Replace data untuk page pertama
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
    toast.error("Gagal memuat data Purchase Order", {
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

/** Helper function to build WHERE clause from date range filters */
const buildWhereClauseFromDateFilters = (
  dateFilters: DateRangeFilters,
): string => {
  const conditions: string[] = [];

  Object.entries(dateFilters).forEach(([key, filter]) => {
    if (!filter) return;

    // Find column to get proper field name
    const col = columns.find((c) => c.key === key);
    const fieldName = (col as any)?.apiFilterField || key;

    if (filter.from) {
      conditions.push(`${fieldName}>=${filter.from}`);
    }
    if (filter.to) {
      conditions.push(`${fieldName}<=${filter.to}`);
    }
  });

  return conditions.length > 0 ? conditions.join("|") : "";
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

    const dateWhere = buildWhereClauseFromDateFilters(filters.dateRange);
    const combinedWhere = [dateWhere, filters.where].filter(Boolean).join("|");

    // Use WHERE clause dari DataTable
    await fetchMenuData(1, true, combinedWhere);
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
  clearAllSelection(true);

  // Reload data
  await fetchMenuData(1, true);

  toast.success("Data berhasil dimuat ulang");
};

const selectionAnchor = ref<TPurchaseOrderItem | null>(null);

const isDraftStatus = (item?: TPurchaseOrderItem | null) =>
  (item?.status || "").toUpperCase() === "DRAFT";

const handleSelectionChange = (items: TPurchaseOrderItem[]) => {
  if (items.length === 0) {
    selectionAnchor.value = null;
    selectedItems.value = [];
    deselectItem();
    return;
  }

  const firstItem = items[0];
  if (!firstItem) return;
  const prevAnchor = selectionAnchor.value;
  const anchor: TPurchaseOrderItem =
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

const toggleMobileItemSelection = (item: TPurchaseOrderItem) => {
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

/**
 * Apply default filters
 * Format:
 * - filterValue: { [columnKey]: "value" }
 * - filterOperator: { [columnKey]: "operator" (optional, default ~* for text match) }
 * - whereClause: WHERE clause string untuk complex filtering (e.g., date ranges)
 *
 * Example 1 - Simple filter:
 * applyDefaultFilters(
 *   { no_po: 'CBM-TBBSP-2511-0001' },
 *   { no_po: '~*' }
 * )
 *
 * Example 2 - Multiple filters + WHERE clause:
 * applyDefaultFilters(
 *   { no_po: 'CBM-TBBSP-2511', m_supplier: 'PT. ABC' },
 *   { no_po: '~*', m_supplier: '~*' },
 *   'tgl_po>=2025-11-01|tgl_po<2026-01-01'
 * )
 */
const applyDefaultFilters = async (
  filters: Record<string, string>,
  operators?: Record<string, string>,
  whereClause?: string,
) => {
  // Set default filters
  tableColumnFilters.value = filters;
  tableColumnFilterOperators.value = operators || {};

  // Reset to page 1
  menuData.value = [];
  currentPage.value = 1;
  hasMoreData.value = true;
  clearAllSelection(true);

  // Fetch data with filters and where clause
  await fetchMenuData(1, true, whereClause);
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
            <h1 class="text-lg font-bold">Transaksi Purchase Order</h1>
            <p class="text-xs text-muted-foreground">
              Kelola Purchase Order aplikasi
            </p>
          </div>
          <div class="flex items-center gap-2">
            <OutstandingButton
              endpoint="t_purchase_order"
              view-path="/purchasing/transaksi/t_purchase_order"
              title="Purchase Order Outstanding"
              size="sm"
              join
              include="m_supplier:id|nama_supp,m_unit_bisnis:id|nama_comp,m_general:group|value1,m_currency>money,m_currency_d,m_general:id|value1"
              :columns="[
                { key: 'no_po', label: 'No PO', width: '150px' },
                { key: 'tgl_po', label: 'Tanggal PO', width: '120px', fallbackKeys: ['createdAt'] },
                { key: 'm_supplier.nama_supp', label: 'Supplier', width: '180px', fallbackKeys: ['m_supplier_id'] },
                { key: 'catatan', label: 'Catatan', width: '200px' },
              ]"
            />
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
            <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading" class="h-8 w-8">
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
          <Button variant="outline" size="sm" class="text-xs h-7 whitespace-nowrap" :class="getApprovalStatusFilterClass('DRAFT', filterStatus === 'DRAFT')" @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'">
            DRAFT
          </Button>
          <Button variant="outline" size="sm" class="text-xs h-7 whitespace-nowrap" :class="getApprovalStatusFilterClass('IN APPROVAL', filterStatus === 'IN APPROVAL')" @click="
              filterStatus =
              filterStatus === 'IN APPROVAL' ? null : 'IN APPROVAL'
              ">
            IN APPROVAL
          </Button>
          <Button variant="outline" size="sm" class="text-xs h-7 whitespace-nowrap" :class="getApprovalStatusFilterClass('APPROVED', filterStatus === 'APPROVED')" @click="
              filterStatus = filterStatus === 'APPROVED' ? null : 'APPROVED'
              ">
            APPROVED
          </Button>
          <Button variant="outline" size="sm" class="text-xs h-7 whitespace-nowrap" :class="getApprovalStatusFilterClass('REJECT', filterStatus === 'REJECT')" @click="filterStatus = filterStatus === 'REJECT' ? null : 'REJECT'">
            REJECT
          </Button>
          <Button variant="outline" size="sm" class="text-xs h-7 whitespace-nowrap" :class="getApprovalStatusFilterClass('REVISI', filterStatus === 'REVISI')" @click="filterStatus = filterStatus === 'REVISI' ? null : 'REVISI'">
            REVISI
          </Button>
        </div>

        <!-- Search Input -->
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Search..." class="pl-9 pr-8 h-8 text-sm"
            @keyup.enter="handleApiSearch" :disabled="isSearching" />
          <Button v-if="searchQuery" @click="clearSearch" size="icon" variant="ghost"
            class="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8">
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
            <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="clearAllSelection()">
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
            isMobileSelectionMode && isItemSelected(item.id) ? 'border-primary ring-2 ring-primary/20 shadow-sm' : '',
          ]"
          @click="isMobileSelectionMode ? toggleMobileItemSelection(item) : selectItem(item, 0)"
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
                    {{ item.no_po || "Tanpa Nomor" }}
                  </div>
                  <div class="text-xs text-muted-foreground truncate">
                    {{
                      item.tgl_po
                        ? new Date(item.tgl_po).toLocaleDateString("id-ID")
                        : "-"
                    }}
                  </div>
                </div>
              </div>
              <Badge :class="getStatusStyle(item.status || 'DRAFT')" class="text-xs shrink-0">
                {{ item.status || "DRAFT" }}
              </Badge>
            </div>

            <!-- Details -->
            <div class="text-xs space-y-1 text-muted-foreground">
              <div v-if="(item as any).m_unit_bisni?.nama_comp" class="truncate">
                <span class="font-medium">Company:</span>
                {{ (item as any).m_unit_bisni.nama_comp }}
              </div>
              <div class="truncate">
                <span class="font-medium">Tipe:</span>
                {{ item.po_tipe_item?.value1 || "-" }}
              </div>
              <div v-if="(item as any).m_supplier?.nama_supp" class="truncate">
                <span class="font-medium">Supplier:</span>
                {{ (item as any).m_supplier.nama_supp }}
              </div>
              <div v-if="(item as any).top_po?.value1" class="truncate">
                <span class="font-medium">ToP:</span>
                {{ (item as any).top_po.value1 }}
              </div>
              <div class="truncate">
                <span class="font-medium">Grand Total:</span>
                <span class="font-bold">{{
                  item.grand_total
                    ? new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(Number(item.grand_total))
                    : "Rp 0"
                }}</span>
              </div>
            </div>

            <!-- Action Buttons -->
            <div v-if="!isMobileSelectionMode" class="flex items-center gap-1 justify-end pt-2 border-t">
              <ViewButton variant="ghost" size="sm" class="h-7 w-7" @click.stop="viewItem(item)" />
              <DeleteButton
                v-permission="{ menuId: currentMenuId, action: 'delete' }" 
                variant="ghost" size="sm" class="h-7 w-7"
                :status="item.status"
                @click.stop="
                  () => {
                    selectItem(item, 0);
                    deleteSelected();
                  }
                " />
              <EditButton 
                v-permission="{ menuId: currentMenuId, action: 'update' }"
                variant="ghost" size="sm" class="h-7 w-7" 
                :status="item.status"
                @click.stop="editItem(item)" />
              <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }" variant="ghost" size="sm"
                class="h-7 w-7" @click.stop="copyItem(item)" />
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <PrintButton v-permission="{ menuId: currentMenuId, action: 'print' }" variant="ghost" size="sm"
                    class="h-7 w-7" />
                </DropdownMenuTrigger>

                <DropdownMenuContent @click.stop>
                  <DropdownMenuItem @click="openPDF(item, true)">
                    Export dengan Harga
                  </DropdownMenuItem>
                  <DropdownMenuItem @click="openPDF(item, false)">
                    Export tanpa Harga
                  </DropdownMenuItem>
                </DropdownMenuContent>
                </DropdownMenu>
                <SendApprovalButton path="/purchasing/transaksi/t_purchase_order" :status="item.status" variant="ghost"
                  size="sm" :showLabel="false" class="h-7 w-7" @click.stop="openSendApprovalDialog(item)" />
                <HistoryApprovalButton :record-id="item.id || ''" notification-endpoint="t_purchase_order_notifikasi"
                  foreign-key-column="t_purchase_order_id" :record-label="item.no_po || 'Tanpa Nomor'"
                  :document-status="item.status" :created-by-tipe-user="(item as any).po_ctr?.tipe_user?.value1"
                  :created-by-name="(item as any).po_ctr?.username" :created-at="item.createdAt" variant="ghost"
                  size="sm" :show-label="false" class="h-7 w-7" @click.stop />
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
      <Button v-permission="{ menuId: currentMenuId, action: 'create' }" @click="createNew"
        class="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-6 lg:hidden h-14 w-14 rounded-full shadow-lg z-50"
        size="icon">
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
        <h1 class="text-2xl font-bold">Transaksi Purchase Order</h1>
        <p class="text-sm text-muted-foreground">
          Kelola Purchase Order aplikasi
        </p>
      </div>
      <div class="flex items-center gap-2">
        <OutstandingButton
          endpoint="t_purchase_order"
          view-path="/purchasing/transaksi/t_purchase_order"
          title="Purchase Order Outstanding"
          join
          include="m_supplier:id|nama_supp,m_unit_bisnis:id|nama_comp,m_general:group|value1,m_currency>money,m_currency_d,m_general:id|value1"
          :columns="[
            { key: 'no_po', label: 'No PO', width: '150px' },
            { key: 'tgl_po', label: 'Tanggal PO', width: '120px', fallbackKeys: ['createdAt'] },
            { key: 'm_unit_bisni.nama_comp', label: 'Company', width: '180px', fallbackKeys: ['m_unit_bisni.nama_comp', 'm_unit_bisnis_id'] },
            { key: 'm_supplier.nama_supp', label: 'Supplier', width: '180px', fallbackKeys: ['m_supplier_id'] },
            { key: 'total', label: 'Total', width: '140px' },
            { key: 'catatan', label: 'Catatan', width: '200px' },
          ]"
        />
        <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading" class="shrink-0"
          title="Refresh data">
          <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
        </Button>
        <Button v-if="currentMenuId" v-permission="{ menuId: currentMenuId, action: 'create' }" @click="createNew"
          class="gap-2 whitespace-nowrap shrink-0">
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
        <Button variant="outline" size="sm" :class="getApprovalStatusFilterClass('DRAFT', filterStatus === 'DRAFT')" @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'">
          DRAFT
        </Button>
        <Button variant="outline" size="sm" :class="getApprovalStatusFilterClass('IN APPROVAL', filterStatus === 'IN APPROVAL')" @click="
            filterStatus = filterStatus === 'IN APPROVAL' ? null : 'IN APPROVAL'
            ">
          IN APPROVAL
        </Button>
        <Button variant="outline" size="sm" :class="getApprovalStatusFilterClass('APPROVED', filterStatus === 'APPROVED')" @click="
            filterStatus = filterStatus === 'APPROVED' ? null : 'APPROVED'
            ">
          APPROVED
        </Button>
        <Button variant="outline" size="sm" :class="getApprovalStatusFilterClass('REJECT', filterStatus === 'REJECT')" @click="filterStatus = filterStatus === 'REJECT' ? null : 'REJECT'">
          REJECT
        </Button>
        <Button variant="outline" size="sm" :class="getApprovalStatusFilterClass('REVISI', filterStatus === 'REVISI')" @click="filterStatus = filterStatus === 'REVISI' ? null : 'REVISI'">
          REVISI
        </Button>
      </div>

      <!-- Search & Action Buttons Row -->
      <div class="flex items-center gap-2">
        <!-- Search -->
        <div class="flex items-center gap-2 w-1/5">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="searchQuery" placeholder="Search..." class="pl-9 pr-8" @keyup.enter="handleApiSearch"
              :disabled="isSearching" />
            <Button v-if="searchQuery" @click="clearSearch" size="icon" variant="ghost"
              class="absolute right-0 top-1/2 -translate-y-1/2">
              <X class="h-4 w-4" />
            </Button>
          </div>
          <Button @click="handleApiSearch" size="icon" variant="secondary" :disabled="isSearching">
            <Search class="h-4 w-4" />
          </Button>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2">
          <DeleteButton v-permission="{ menuId: currentMenuId, action: 'delete' }"
            :status="selectedItem?.status"
            :disabled="!isActive || !canDeleteItem" @click="() => deleteSelected()" />
          <BulkDeleteButton
            v-if="selectedItems.length > 1"
            v-permission="{ menuId: currentMenuId, action: 'delete' }"
            :count="selectedDraftCount"
            :disabled="selectedDraftCount === 0"
            @click="deleteSelected"
          />
          <ViewButton :disabled="!isActive" @click="viewItem()" />
          <EditButton v-permission="{ menuId: currentMenuId, action: 'update' }" 
            :status="selectedItem?.status"
            :disabled="!isActive || !canEditItem"
            @click="editItem()" />
          <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }" :disabled="!isActive"
            @click="copyItem()" />
          <!-- <ExportButton :disabled="!isActive" @click="openPDF()" /> -->
          <DropdownMenu>
            <DropdownMenuTrigger :disabled="!canPrintSelected">
              <PrintButton
                v-permission="{ menuId: currentMenuId, action: 'print' }"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                :disabled="!canPrintSelected"
              />
            </DropdownMenuTrigger>

            <DropdownMenuContent @click.stop v-if="canPrintSelected">
              <DropdownMenuItem @click="openPDF(undefined, true)">
                Export dengan Harga
              </DropdownMenuItem>
              <DropdownMenuItem @click="openPDF(undefined, false)">
                Export tanpa Harga
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <SendApprovalButton path="/purchasing/transaksi/t_purchase_order" :status="selectedItem?.status"
            variant="default" size="default" :showLabel="true" :disabled="!isActive"
            @click="openSendApprovalDialog()" />
          <HistoryApprovalButton :record-id="selectedItem?.id || ''" notification-endpoint="t_purchase_order_notifikasi"
            foreign-key-column="t_purchase_order_id" :record-label="selectedItem?.no_po || 'Tanpa Nomor'"
            :document-status="selectedItem?.status" :created-by-tipe-user="(selectedItem as any)?.po_ctr?.tipe_user?.value1
              " :created-by-name="(selectedItem as any)?.po_ctr?.username" :created-at="selectedItem?.createdAt"
            variant="outline" size="default" :show-label="true" :disabled="!isActive" />
        </div>
      </div>
    </div>

    <!-- TABLE -->
    <DataTable ref="dataTableRef" :data="filteredData" :columns="columns" :loading="loading" :loading-more="loadingMore"
      :has-more="hasMoreData" :row-select-mode="true" :multi-select-mode="true"
      :selected-items="selectedItems" :selection-checkbox-visible="() => true" :show-select-all="isDraftFilterActive"
      :api-filter-mode="true" @load-more="handleLoadMore" @selection-change="handleSelectionChange"
      @row-select="(item) => selectItem(item, 0)" @row-deselect="deselectItem" @filter-change="handleTableFilterChange"
      @refresh-requested="handleRefresh">
      <template #empty> Tidak ada data Purchase Order </template>
    </DataTable>
  </div>

  <!-- ================================================================ -->
  <!-- DELETE CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog :open="isDeleteDialogOpen" title="Hapus Purchase Order" :description="deleteDialogDescription"
    type="danger" confirm-text="Hapus" cancel-text="Batal" :is-loading="isDeleting" @confirm="confirmDelete"
    @cancel="cancelDelete" @update:open="isDeleteDialogOpen = $event" />

  <!-- ================================================================ -->
  <!-- SEND APPROVAL CONFIRMATION DIALOG -->
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
          <p class="text-sm font-medium">Purchase Order:</p>
          <p class="text-sm text-muted-foreground">
            {{ itemToSendApproval.no_po || "Tanpa Nomor" }}
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
          <FieldX id="approval-catatan" type="textarea" v-model="approvalCatatan" label="Catatan Approval"
            placeholder="Masukkan catatan untuk approval (opsional)"
            hints="Catatan ini akan dikirim ke penerima approval" :disabled="isSendingApproval" :rows="4" />
        </div>
      </div>

      <DialogFooter class="gap-2">
        <Button variant="outline" @click="cancelSendApproval" :disabled="isSendingApproval">
          Batal
        </Button>
        <Button variant="default" @click="confirmSendApproval" :disabled="isSendingApproval" class="gap-2">
          <span v-if="isSendingApproval">Mengirim...</span>
          <span v-else>Kirim</span>
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
