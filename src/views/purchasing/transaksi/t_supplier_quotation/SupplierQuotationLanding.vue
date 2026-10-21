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
  Upload,
  AlertTriangle,
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
import { FieldSelect } from "@/components/field";
import { useApi } from "@/composables/useApi";
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
import { getApprovalStatusBadgeClass, getApprovalStatusFilterClass } from "@/lib/approvalStatus";
import {
  getSupplierQuotationList,
  deleteSupplierQuotation,
  bulkDeleteSupplierQuotation,
  postSupplierQuotation,
  importExcel,
  validateImportExcel,
  type SupplierQuotationItem,
} from "./service";

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

// ============================================================================
// DELETE DIALOG STATE
// ============================================================================
const isDeleteDialogOpen = ref(false);
const itemToDelete = ref<SupplierQuotationItem | null>(null);
const itemsToDelete = ref<SupplierQuotationItem[]>([]);
const isDeleting = ref(false);

// ============================================================================
// POST DIALOG STATE
// ============================================================================
const isPostDialogOpen = ref(false);
const itemToPost = ref<SupplierQuotationItem | null>(null);
const isPosting = ref(false);

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<SupplierQuotationItem[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const hasMoreData = ref(true);
const dataTableRef = ref<any>(null);

// ============================================================================
// BULK SELECTION STATE
// ============================================================================
const selectedItems = ref<SupplierQuotationItem[]>([]);
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
const tableWhereFilter = ref("");

const addDays = (dateString: string, days: number) => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year || 1970, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + days);

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const buildSupplierQuotationDateWhere = (
  dateRange: Record<string, { from: string; to: string }>,
) => {
  const conditions: string[] = [];

  Object.entries(dateRange).forEach(([key, filter]) => {
    const from = filter?.from?.trim();
    const to = filter?.to?.trim();
    if (!from && !to) return;

    if (key === "createdAt") {
      if (from) {
        conditions.push(`${key}>=${from}`);
      }
      if (to) {
        conditions.push(`${key}<${addDays(to, 1)}`);
      } else if (from) {
        conditions.push(`${key}<${addDays(from, 1)}`);
      }
      return;
    }

    if (from && to) {
      conditions.push(`${key}>=${from}`);
      conditions.push(`${key}<=${to}`);
    } else if (from) {
      conditions.push(`${key}=${from}`);
    } else if (to) {
      conditions.push(`${key}<=${to}`);
    }
  });

  return conditions.join("|");
};

/** Get status badge styling */
const getStatusStyle = (status: string) => getApprovalStatusBadgeClass(status);

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const columns = [
  {
    key: "m_unit_bisni.nama_comp",
    label: "Unit Bisnis",
    filterable: true,
    width: "150px",
    renderHtml: (item: any) =>
      item.m_unit_bisni?.nama_comp || "-",
  },
  {
    key: "no_supplier_quotation",
    label: "No. SQ",
    filterable: true,
    width: "180px",
  },
  {
    key: "createdAt",
    label: "Tgl SQ",
    filterable: true,
    filterType: "date" as const,
    width: "120px",
    renderHtml: (item: any) => {
      const date = item.createdAt;
      return date ? new Date(date).toLocaleDateString("id-ID") : "-";
    },
  },
  {
    key: "t_rfq.no_rfq",
    label: "No. RFQ",
    filterable: true,
    width: "180px",
    renderHtml: (item: any) => item.t_rfq?.no_rfq || "-",
  },
  {
    key: "m_supplier.nama_supp",
    label: "Supplier",
    filterable: true,
    width: "200px",
    renderHtml: (item: any) => item.m_supplier?.nama_supp || "-",
  },
  { key: "catatan", label: "Catatan", filterable: true, width: "200px" },
  {
    key: "status",
    label: "Status",
    filterable: false,
    width: "120px",
    renderHtml: (item: any) => {
      const status = item.status || "DRAFT";
      const badgeClass = getStatusStyle(status);
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${status}</span>`;
    },
  },
];

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================
/** Filter t_supplier_quotation data berdasarkan status only (search handled by API) */
const filteredData = computed(() => {
  return menuData.value.filter((item: SupplierQuotationItem) => {
    const matchStatus =
      filterStatus.value === null ? true : item.status === filterStatus.value;

    return matchStatus;
  });
});

const isPostedStatus = (status?: string | null) => {
  return (status || "").toUpperCase() === "POST";
};

const isSelectedItemPosted = computed(() =>
  isPostedStatus(selectedItem.value?.status),
);

const isDraftItem = (item: SupplierQuotationItem | null | undefined) => {
  return (item?.status || "DRAFT").toUpperCase() === "DRAFT";
};

const selectedDraftCount = computed(
  () => selectedItems.value.filter((item) => isDraftItem(item)).length,
);

/** Deskripsi dialog delete */
const deleteDialogDescription = computed(() => {
  if (itemsToDelete.value.length > 1) {
    return `Apakah Anda yakin ingin menghapus ${itemsToDelete.value.length} Supplier Quotation berstatus DRAFT? Tindakan ini tidak dapat dibatalkan.`;
  }

  if (!itemToDelete.value) return "";
  return `Apakah Anda yakin ingin menghapus Supplier Quotation "${itemToDelete.value.no_supplier_quotation}"? Tindakan ini tidak dapat dibatalkan.`;
});

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
/** Trigger delete dialog */
const deleteSelected = (item?: SupplierQuotationItem | Event) => {
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
      description: "Hanya Supplier Quotation dengan status DRAFT yang dapat dihapus",
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
  const targetIds = targetItems
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id));

  if (targetIds.length === 0) return;

  isDeleting.value = true;
  try {
    const response =
      targetIds.length > 1
        ? await bulkDeleteSupplierQuotation(targetIds)
        : await deleteSupplierQuotation(targetIds[0]!);

    if (response.status === "success") {
      // Remove item from list
      const deletedIds = new Set(targetIds);
      menuData.value = menuData.value.filter(
        (m: SupplierQuotationItem) => !deletedIds.has(m.id || ""),
      );

      toast.success(
        targetIds.length > 1
          ? `${targetIds.length} Supplier Quotation berhasil dihapus`
          : `Supplier Quotation "${targetItems[0]?.no_supplier_quotation}" berhasil dihapus`,
        {
          description: response.message || "Item telah dihapus dari database",
        },
      );

      // Clear selection
      clearAllSelection();
      deselectItem();
      isDeleteDialogOpen.value = false;
    } else {
      toast.error("Gagal menghapus Supplier Quotation", {
        description: response.message || "Terjadi kesalahan saat menghapus",
      });
    }
  } catch (error) {
    toast.error("Gagal menghapus Supplier Quotation", {
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
// POST FUNCTIONS
// ============================================================================
/** Trigger post dialog */
const postSelected = (item?: SupplierQuotationItem) => {
  // Check permission
  if (!canUpdate.value) {
    toast.error("Akses Ditolak", {
      description: "Anda tidak memiliki izin untuk mengubah data",
    });
    return;
  }

  const targetItem = item || selectedItem.value;
  if (!targetItem) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  // Check if already POST
  if (isPostedStatus(targetItem.status)) {
    toast.error("Item sudah di-POST", {
      description: "Data yang sudah POST tidak bisa diubah lagi",
    });
    return;
  }

  itemToPost.value = targetItem;
  isPostDialogOpen.value = true;
};

/** Konfirmasi post - hit API dan update UI */
const confirmPost = async () => {
  if (!itemToPost.value) return;

  isPosting.value = true;
  try {
    const response = await postSupplierQuotation(itemToPost.value.id!);

    if (response.status === "success") {
      toast.success(
        `Supplier Quotation "${itemToPost.value.no_supplier_quotation || "tanpa nomor"}" berhasil di-POST`,
        {
          description: "Data tidak bisa diedit atau dihapus lagi",
        },
      );

      // Clear selection
      clearAllSelection();
      deselectItem();
      isPostDialogOpen.value = false;

      // Refresh data
      await fetchMenuData(1);
    } else {
      toast.error("Gagal POST Supplier Quotation", {
        description: response.message || "Terjadi kesalahan saat POST",
      });
    }
  } catch (error) {
    toast.error("Gagal POST Supplier Quotation", {
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
/** Export t_supplier_quotation data */
const exportData = () => {
  toast.info("Export feature coming soon");
};

/** View SupplierQuotation item details */
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
    `/purchasing/transaksi/t_supplier_quotation/view/${selectedItem.value.id}`,
  );
};

/** Edit SupplierQuotation item */
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

  // Check if item is POST - cannot edit POST items
  if (isPostedStatus(selectedItemData.status)) {
    toast.error("Tidak dapat mengedit", {
      description: "Data yang sudah POST tidak bisa diedit",
    });
    return;
  }

  // Navigate to edit form
  router.push(
    `/purchasing/transaksi/t_supplier_quotation/form/${selectedItemData.id}`,
  );
};

/** Copy SupplierQuotation item - duplicate data tanpa ID untuk create new */
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
    path: "/purchasing/transaksi/t_supplier_quotation/form",
    query: {
      action: "copy",
      source: selectedItemData.id,
    },
  });

  toast.success(`Menyalin data "${selectedItemData.no_supplier_quotation}"`, {
    description: "Silakan edit dan simpan sebagai SupplierQuotation baru",
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

  router.push("/purchasing/transaksi/t_supplier_quotation/form");
};

// ============================================================================
// IMPORT FUNCTIONS
// ============================================================================
// ============================================================================
// IMPORT FUNCTIONS
// ============================================================================
const showImportDialog = ref(false);
const importFile = ref<File | null>(null);
const importSupplierId = ref("");
const fileInput = ref<HTMLInputElement | null>(null);

// Duplicate validation dialog
const showDuplicateDialog = ref(false);
const duplicateData = ref<any>(null);
const isImporting = ref(false);

// Validation error dialog
const showValidationErrorDialog = ref(false);
const validationErrorData = ref<any>(null);

// Check if validation error is critical (code 400 or data already POST)
const isCriticalValidationError = computed(() => {
  console.log("🔍 Computing isCriticalValidationError");
  console.log("🔍 validationErrorData.value:", validationErrorData.value);

  if (!validationErrorData.value) {
    console.log("🔍 No validationErrorData, return false");
    return false;
  }

  console.log(
    "🔍 validationErrorData.value.code:",
    validationErrorData.value.code,
  );
  console.log("🔍 Type of code:", typeof validationErrorData.value.code);

  // Check if error code is 400 (support both number and string)
  const code = validationErrorData.value.code;
  if (code === 400 || code === "400" || Number(code) === 400) {
    console.log("🔍 Code is 400, return TRUE");
    return true;
  }

  // Check if error message contains keywords indicating data already exists in POST status
  const message = (validationErrorData.value.message || "").toLowerCase();
  if (
    message.includes("status post") ||
    message.includes("sudah memiliki quotation") ||
    message.includes("tidak dapat diubah")
  ) {
    console.log("🔍 Message contains critical keywords, return TRUE");
    return true;
  }

  console.log("🔍 Not critical, return FALSE");
  return false;
});

const handleOpenImportDialog = () => {
  showImportDialog.value = true;
  importFile.value = null;
  importSupplierId.value = "";
};

const handleCloseImportDialog = () => {
  showImportDialog.value = false;
  importFile.value = null;
  importSupplierId.value = "";
  validationErrorData.value = null;
  if (fileInput.value) {
    fileInput.value.value = "";
  }
};

const onFileSelect = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    const file = target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      toast.error("Format file tidak valid", {
        description: "Harap upload file Excel (.xlsx atau .xls)",
      });
      target.value = "";
      return;
    }
    importFile.value = file;
  }
};

const triggerFileSelect = () => {
  fileInput.value?.click();
};

const handleImportSubmit = async () => {
  if (!importFile.value) {
    toast.error("Pilih file terlebih dahulu");
    return;
  }

  if (!importSupplierId.value) {
    toast.error("Pilih Supplier terlebih dahulu");
    return;
  }

  loading.value = true;
  try {
    // Step 1: Validate data untuk check duplikasi
    const validationResponse = await validateImportExcel(
      importFile.value,
      importSupplierId.value,
    );

    console.log("🔍 Validation Response:", validationResponse);
    console.log("🔍 Response code:", validationResponse.code);
    console.log("🔍 Response success:", validationResponse.success);

    // Check for successful validation (success === true OR status === 'success')
    const isSuccess =
      validationResponse.success === true ||
      validationResponse.status === "success";
    const isError =
      validationResponse.success === false ||
      validationResponse.code === 400 ||
      validationResponse.status === "error";

    console.log("🔍 isSuccess:", isSuccess, "isError:", isError);

    if (isSuccess && !isError) {
      // Check if there are duplicates
      if (
        validationResponse.hasDuplicates ||
        (validationResponse.duplicateItems &&
          validationResponse.duplicateItems.length > 0)
      ) {
        // Ada duplikasi, tampilkan dialog konfirmasi
        duplicateData.value = validationResponse;
        showDuplicateDialog.value = true;
        showImportDialog.value = false;
        loading.value = false;
      } else {
        // Tidak ada duplikasi, langsung import
        await proceedWithImport();
      }
    } else {
      // Validasi gagal - tampilkan error di dialog
      console.log(
        "🔍 RAW validationResponse:",
        JSON.stringify(validationResponse, null, 2),
      );

      // Pastikan semua property dari response disimpan termasuk code
      validationErrorData.value = {
        success: validationResponse.success,
        code: validationResponse.code,
        message: validationResponse.message,
        errors: validationResponse.errors,
        data: validationResponse.data,
        status:
          validationResponse.status ||
          (validationResponse.success === false ? "error" : "unknown"),
      };
      console.log(
        "🔍 Set validationErrorData:",
        JSON.stringify(validationErrorData.value, null, 2),
      );
      console.log(
        "🔍 validationErrorData.code:",
        validationErrorData.value.code,
      );
      showValidationErrorDialog.value = true;
      showImportDialog.value = false;
      loading.value = false;
    }
  } catch (error: any) {
    // Error exception - tampilkan di dialog
    validationErrorData.value = {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat validasi",
      errors: [],
      code: error?.code || error?.response?.status,
    };
    showValidationErrorDialog.value = true;
    showImportDialog.value = false;
    loading.value = false;
  }
};

/** Proceed with actual import (after validation or user confirmation) */
const proceedWithImport = async () => {
  if (!importFile.value || !importSupplierId.value) return;

  isImporting.value = true;
  loading.value = true;
  try {
    const response = await importExcel(
      importFile.value,
      importSupplierId.value,
    );

    // API returns t_supplier_quotation_id, not id
    const importedId =
      response.data?.t_supplier_quotation_id || response.data?.id;

    if (response.status === "success" && importedId) {
      toast.success("Import berhasil", {
        description: "Data berhasil diimport, mengarahkan ke halaman edit...",
      });

      // Close dialogs
      showImportDialog.value = false;
      showDuplicateDialog.value = false;

      // Reset state
      importFile.value = null;
      importSupplierId.value = "";
      duplicateData.value = null;

      // Redirect to edit page
      router.push(
        `/purchasing/transaksi/t_supplier_quotation/form/${importedId}`,
      );
    } else {
      toast.error("Gagal import", {
        description: response.message || "Terjadi kesalahan saat import",
      });
    }
  } catch (error) {
    toast.error("Gagal import", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    isImporting.value = false;
    loading.value = false;
    if (fileInput.value) fileInput.value.value = "";
  }
};

/** Cancel import when duplicates found */
const cancelImport = () => {
  showDuplicateDialog.value = false;
  showImportDialog.value = false;
  importFile.value = null;
  importSupplierId.value = "";
  duplicateData.value = null;

  if (fileInput.value) fileInput.value.value = "";

  toast.info("Import dibatalkan");
};

/** Cancel when validation error occurs */
const cancelValidationError = () => {
  showValidationErrorDialog.value = false;
  showImportDialog.value = true; // Kembali ke dialog import
  validationErrorData.value = null;
};

/** Proceed with import despite validation errors */
const proceedWithValidationError = async () => {
  showValidationErrorDialog.value = false;
  await proceedWithImport();
};

// ============================================================================
// API & DATA FETCHING FUNCTIONS
// ============================================================================
/** Fetch t_supplier_quotation data dari API with search support */
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
  if (page === 1 || resetData) {
    loading.value = true;
  } else {
    loadingMore.value = true;
  }

  try {
    const apiParams: Record<string, any> = {
      include: "m_unit_bisnis,t_rfq,m_supplier",
    };

    Object.entries(tableColumnFilters.value).forEach(([key, value]) => {
      if (value && value.trim()) {
        apiParams[`filter_column_${key}`] = value.trim();
      }
    });

    if (tableWhereFilter.value) {
      apiParams.where = tableWhereFilter.value;
    }

    // Call API with search parameters
    const response = await getSupplierQuotationList(
      page,
      pageSize.value,
      "createdAt",
      "DESC",
      searchApiQuery.value || undefined,
      searchApiQuery.value
        ? "no_supplier_quotation,catatan,$m_unit_bisni.nama_comp$,$t_rfq.no_rfq$,$m_supplier.nama_supp$"
        : undefined,
      apiParams,
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
    toast.error("Gagal memuat data SupplierQuotation", {
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
  const dateWhere = buildSupplierQuotationDateWhere(filters.dateRange);
  tableWhereFilter.value = [dateWhere, filters.where].filter(Boolean).join("|");

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
  tableWhereFilter.value = "";
  menuData.value = [];
  currentPage.value = 1;
  hasMoreData.value = true;
  deselectItem();
  clearAllSelection(true);

  // Reload data
  await fetchMenuData(1, true);

  toast.success("Data berhasil dimuat ulang");
};

const selectionAnchor = ref<SupplierQuotationItem | null>(null);

const isDraftStatus = (item?: SupplierQuotationItem | null) =>
  (item?.status || "").toUpperCase() === "DRAFT";

const handleSelectionChange = (items: SupplierQuotationItem[]) => {
  if (items.length === 0) {
    selectionAnchor.value = null;
    selectedItems.value = [];
    deselectItem();
    return;
  }

  const firstItem = items[0];
  if (!firstItem) return;
  const prevAnchor = selectionAnchor.value;
  const anchor: SupplierQuotationItem =
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

const toggleMobileItemSelection = (item: SupplierQuotationItem) => {
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
            <h1 class="text-lg font-bold">Transaksi Supplier Quotation</h1>
            <p class="text-xs text-muted-foreground">
              Kelola data Supplier Quotation
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
            placeholder="Cari no. SQ, RFQ, supplier, company, catatan..."
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
                    {{ item.no_supplier_quotation || "-" }}
                  </div>
                  <div class="text-xs text-muted-foreground truncate">
                    {{ item.m_supplier?.nama_supp || "-" }}
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
              <div v-if="item.t_rfq">
                <span class="font-medium">RFQ:</span> {{ item.t_rfq.no_rfq }}
              </div>
              <div v-if="item.createdAt">
                <span class="font-medium">Date:</span>
                {{ new Date(item.createdAt).toLocaleDateString("id-ID") }}
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
              <PostButton
                v-if="item.status === 'DRAFT'"
                v-permission="{ menuId: currentMenuId, action: 'update' }"
                variant="ghost"
                size="sm"
                :show-label="false"
                class="h-7 w-7 text-blue-600"
                @click.stop="
                  () => {
                    selectItem(item, 0);
                    postSelected();
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
  <div class="hidden lg:flex lg:flex-col lg:gap-4 lg:p-6">
    <!-- HEADER -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold">Transaksi Supplier Quotation</h1>
        <p class="text-sm text-muted-foreground">
          Kelola data Supplier Quotation
        </p>
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
        <!-- Import Button -->
        <input
          type="file"
          ref="fileInput"
          class="hidden"
          accept=".xlsx, .xls"
          @change="onFileSelect"
        />
        <Button
          variant="outline"
          @click="handleOpenImportDialog"
          :disabled="loading"
          class="gap-2 whitespace-nowrap shrink-0"
        >
          <FileDown class="h-4 w-4" />
          Import Excel
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
              placeholder="Cari no. SQ, RFQ, supplier, company, catatan..."
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
            :disabled="!isActive || isSelectedItemPosted"
            @click="editItem()"
          />
          <CopyButton
            v-permission="{ menuId: currentMenuId, action: 'create' }"
            :disabled="!isActive"
            @click="copyItem()"
          />
          <PostButton
            v-permission="{ menuId: currentMenuId, action: 'update' }"
            :disabled="
              !isActive ||
              isSelectedItemPosted ||
              selectedItem?.status?.toUpperCase() !== 'DRAFT'
            "
            @click="postSelected()"
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
      <template #empty> Tidak ada data Supplier Quotation </template>
    </DataTable>
  </div>

  <!-- ================================================================ -->
  <!-- DELETE CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isDeleteDialogOpen"
    title="Hapus Supplier Quotation"
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
  <!-- POST CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isPostDialogOpen"
    title="POST Supplier Quotation"
    :description="`Apakah Anda yakin ingin POST Supplier Quotation &quot;${itemToPost?.no_supplier_quotation || 'tanpa nomor'}&quot;? Setelah di-POST, data tidak bisa diedit atau dihapus lagi.`"
    type="warning"
    confirm-text="POST"
    cancel-text="Batal"
    :is-loading="isPosting"
    @confirm="confirmPost"
    @cancel="cancelPost"
    @update:open="isPostDialogOpen = $event"
  />

  <!-- ================================================================ -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="showImportDialog"
    title="Import Excel"
    description="Pilih Supplier dan file Excel untuk diimport"
    confirm-text="Import"
    cancel-text="Batal"
    :is-loading="loading"
    @confirm="handleImportSubmit"
    @cancel="handleCloseImportDialog"
    @update:open="
      (val) => {
        if (!val) handleCloseImportDialog();
      }
    "
    class="z-50"
  >
    <div class="space-y-4 py-4">
      <!-- Supplier Selection -->
      <FieldSelect
        id="import_supplier"
        label="Supplier"
        v-model="importSupplierId"
        :api="{ url: `${API_BASE_URL}/dynamic/m_supplier` }"
        placeholder="Pilih Supplier"
        valueField="id"
        displayField="nama_supp"
        :required="true"
        class="w-full"
      />

      <!-- File Input Area -->
      <div class="space-y-2">
        <label
          class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          File Excel
        </label>
        <div
          class="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
          :class="{ 'border-primary bg-primary/5': importFile }"
          @click="triggerFileSelect"
        >
          <Upload
            v-if="!importFile"
            class="h-8 w-8 text-muted-foreground mb-2"
          />
          <FileDown v-else class="h-8 w-8 text-primary mb-2" />

          <div class="text-sm text-center">
            <span v-if="!importFile" class="text-muted-foreground"
              >Klik untuk pilih file Excel (.xlsx, .xls)</span
            >
            <span v-else class="font-medium text-foreground">{{
              importFile.name
            }}</span>
          </div>
        </div>
      </div>
    </div>
  </GlobalDialog>

  <!-- ================================================================ -->
  <!-- DUPLICATE DATA CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="showDuplicateDialog"
    title="Data Duplikat Ditemukan"
    description="Ditemukan data yang sama dalam file Excel. Apakah Anda ingin melanjutkan import dan menimpa data yang ada, atau membatalkan proses import?"
    type="warning"
    confirm-text="Lanjut Import"
    cancel-text="Batal"
    :is-loading="isImporting"
    @confirm="proceedWithImport"
    @cancel="cancelImport"
    @update:open="showDuplicateDialog = $event"
    class="z-50"
  >
    <div v-if="duplicateData" class="space-y-3 py-4">
      <div class="text-sm text-muted-foreground">
        <p class="mb-2">
          {{
            duplicateData.message || "Beberapa data sudah ada dalam database."
          }}
        </p>
        <p
          v-if="
            duplicateData.duplicateItems &&
            duplicateData.duplicateItems.length > 0
          "
          class="font-medium"
        >
          {{ duplicateData.duplicateItems.length }} item duplikat ditemukan
        </p>
      </div>

      <!-- Optional: Display duplicate items list -->
      <div
        v-if="
          duplicateData.duplicateItems &&
          duplicateData.duplicateItems.length > 0
        "
        class="max-h-48 overflow-y-auto bg-muted/50 rounded-md p-3 space-y-1"
      >
        <div
          v-for="(item, idx) in duplicateData.duplicateItems.slice(0, 10)"
          :key="idx"
          class="text-xs text-muted-foreground"
        >
          • {{ item.nama_item || item.kode_item || `Item ${Number(idx) + 1}` }}
        </div>
        <div
          v-if="duplicateData.duplicateItems.length > 10"
          class="text-xs text-muted-foreground italic"
        >
          ... dan {{ duplicateData.duplicateItems.length - 10 }} item lainnya
        </div>
      </div>
    </div>
  </GlobalDialog>

  <!-- ================================================================ -->
  <!-- VALIDATION ERROR DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="showValidationErrorDialog"
    title="Validasi Excel Gagal"
    description="File Excel mengandung error atau data tidak valid. Silakan periksa detail error di bawah ini."
    type="danger"
    v-bind="isCriticalValidationError ? {} : { confirmText: 'Yakin Upload' }"
    cancel-text="Batal"
    :is-loading="isImporting"
    @confirm="proceedWithValidationError"
    @cancel="cancelValidationError"
    @update:open="showValidationErrorDialog = $event"
    class="z-50"
  >
    <div v-if="validationErrorData" class="space-y-3 py-4">
      <!-- Error Message -->
      <div class="text-sm">
        <div
          class="flex items-start gap-2 p-3 bg-destructive/10 rounded-md mb-3"
        >
          <AlertTriangle class="h-5 w-5 text-destructive mt-0.5 shrink-0" />
          <div class="flex-1">
            <p class="font-medium text-destructive mb-1">
              {{ validationErrorData.message || "Terjadi kesalahan validasi" }}
            </p>
            <p
              v-if="
                validationErrorData.errors &&
                validationErrorData.errors.length > 0
              "
              class="text-xs text-muted-foreground"
            >
              {{ validationErrorData.errors.length }} error ditemukan
            </p>
            <p
              v-else-if="
                validationErrorData.duplicateItems &&
                validationErrorData.duplicateItems.length > 0
              "
              class="text-xs text-muted-foreground"
            >
              {{ validationErrorData.duplicateItems.length }} item bermasalah
            </p>
          </div>
        </div>
      </div>

      <!-- Error List - handle both errors array and duplicateItems array -->
      <div
        v-if="
          (validationErrorData.errors &&
            validationErrorData.errors.length > 0) ||
          (validationErrorData.duplicateItems &&
            validationErrorData.duplicateItems.length > 0)
        "
        class="max-h-64 overflow-y-auto bg-muted/50 rounded-md p-3 space-y-2"
      >
        <!-- Display errors array -->
        <template
          v-if="
            validationErrorData.errors && validationErrorData.errors.length > 0
          "
        >
          <div
            v-for="(error, idx) in validationErrorData.errors"
            :key="`error-${idx}`"
            class="text-sm border-l-2 border-destructive pl-3 py-1"
          >
            <div class="font-medium text-foreground">
              {{
                error.field ||
                error.row ||
                error.line ||
                `Baris ${Number(idx) + 1}`
              }}
            </div>
            <div class="text-xs text-muted-foreground">
              {{
                typeof error === "string"
                  ? error
                  : error.message || error.error || JSON.stringify(error)
              }}
            </div>
          </div>
        </template>

        <!-- Display duplicateItems array (fallback) -->
        <template
          v-else-if="
            validationErrorData.duplicateItems &&
            validationErrorData.duplicateItems.length > 0
          "
        >
          <div
            v-for="(item, idx) in validationErrorData.duplicateItems.slice(
              0,
              20,
            )"
            :key="`dup-${idx}`"
            class="text-sm border-l-2 border-amber-500 pl-3 py-1"
          >
            <div class="font-medium text-foreground">
              {{
                item.kode_item || item.nama_item || `Item ${Number(idx) + 1}`
              }}
            </div>
            <div class="text-xs text-muted-foreground">
              {{ item.error || item.message || "Data sudah ada" }}
            </div>
          </div>
          <div
            v-if="validationErrorData.duplicateItems.length > 20"
            class="text-xs text-muted-foreground italic px-3"
          >
            ... dan {{ validationErrorData.duplicateItems.length - 20 }} item
            lainnya
          </div>
        </template>
      </div>

      <!-- Warning footer -->
      <div
        v-if="!isCriticalValidationError"
        class="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-md border border-amber-200 dark:border-amber-900"
      >
        <p class="text-xs text-amber-800 dark:text-amber-200">
          <strong>Peringatan:</strong> Jika Anda memilih "Yakin Upload", data
          akan tetap diupload meskipun ada error. Ini dapat menyebabkan data
          tidak lengkap atau error di sistem.
        </p>
      </div>

      <!-- Critical Error Notice -->
      <div
        v-else
        class="mt-4 p-3 bg-destructive/10 rounded-md border border-destructive/30"
      >
        <p class="text-xs text-destructive">
          <strong>Data Tidak Dapat Diupload:</strong> Error ini bersifat kritis
          dan tidak memungkinkan untuk melanjutkan upload. Silakan perbaiki file
          Excel atau data yang sudah ada terlebih dahulu.
        </p>
      </div>
    </div>
  </GlobalDialog>
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
