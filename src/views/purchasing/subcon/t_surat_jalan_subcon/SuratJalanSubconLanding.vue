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
  Truck,
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
  PostButton,
  PrintButton,
} from "@/components/button";
import { FieldX } from "@/components/field";
import { useActionButtons } from "@/composables/useActionButtons";
import { usePermission } from "@/composables/usePermission";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  getSuratJalanSubconList,
  deleteSuratJalanSubcon,
  postSuratJalanSubcon,
  waitingShippingCostSuratJalanSubcon,
  type SuratJalanSubconItem,
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
const itemToDelete = ref<SuratJalanSubconItem | null>(null);
const isDeleting = ref(false);

// ============================================================================
// BULK DELETE STATE
// ============================================================================
const selectedItems = ref<SuratJalanSubconItem[]>([]);
const isBulkDeleteDialogOpen = ref(false);
const isBulkDeleting = ref(false);

const hasBulkSelection = computed(() => selectedItems.value.filter((i) => normalizeStatus(i.status) === "DRAFT").length > 1);

const bulkDeletableItems = computed(() =>
  selectedItems.value.filter((item) => canDeleteItem(item)),
);

const bulkDeleteDialogDescription = computed(() => {
  const total = selectedItems.value.length;
  const deletable = bulkDeletableItems.value.length;
  const skipped = total - deletable;

  if (deletable === 0) {
    return `Tidak ada item yang dapat dihapus. ${total} item yang dipilih memiliki status yang tidak memperbolehkan penghapusan (hanya DRAFT yang dapat dihapus).`;
  }

  let desc = `Anda akan menghapus ${deletable} dari ${total} item yang dipilih. Tindakan ini tidak dapat dibatalkan.`;
  if (skipped > 0) {
    desc += ` ${skipped} item dengan status selain DRAFT akan dilewati.`;
  }
  return desc;
});

const openBulkDeleteDialog = () => {
  if (selectedItems.value.length === 0) {
    toast.error("Pilih minimal satu item terlebih dahulu");
    return;
  }
  if (bulkDeletableItems.value.length === 0) {
    toast.error("Tidak ada item yang dapat dihapus", {
      description: "Hanya item dengan status DRAFT yang dapat dihapus",
    });
    return;
  }
  isBulkDeleteDialogOpen.value = true;
};

const confirmBulkDelete = async () => {
  if (bulkDeletableItems.value.length === 0) return;

  isBulkDeleting.value = true;
  const errors: string[] = [];
  const deletedIds: string[] = [];

  for (const item of bulkDeletableItems.value) {
    try {
      const response = await deleteSuratJalanSubcon(item.id);
      if (response.status === "success") {
        deletedIds.push(item.id);
      } else {
        errors.push(item.no_sj_subcon || item.id);
      }
    } catch {
      errors.push(item.no_sj_subcon || item.id);
    }
  }

  if (deletedIds.length > 0) {
    menuData.value = menuData.value.filter((m) => !deletedIds.includes(m.id));
  }

  isBulkDeleteDialogOpen.value = false;
  selectedItems.value = [];
  deselectItem();

  if (errors.length === 0) {
    toast.success(`${deletedIds.length} item berhasil dihapus`);
  } else if (deletedIds.length > 0) {
    toast.warning(`${deletedIds.length} item dihapus, ${errors.length} gagal`, {
      description: `Gagal menghapus: ${errors.join(", ")}`,
    });
  } else {
    toast.error("Gagal menghapus semua item yang dipilih");
  }

  isBulkDeleting.value = false;
};

const cancelBulkDelete = () => {
  isBulkDeleteDialogOpen.value = false;
};

const selectionAnchor = ref<SuratJalanSubconItem | null>(null);

const handleSelectionChange = (items: SuratJalanSubconItem[]) => {
  if (items.length === 0) {
    selectionAnchor.value = null;
    selectedItems.value = [];
    deselectItem();
    return;
  }

  const firstItem = items[0];
  if (!firstItem) return;
  const prevAnchor = selectionAnchor.value;
  const anchor: SuratJalanSubconItem =
    prevAnchor && items.some((i) => i.id === prevAnchor.id) ? prevAnchor : firstItem;
  selectionAnchor.value = anchor;

  const isDraft = (item?: SuratJalanSubconItem | null) =>
    normalizeStatus(item?.status) === "DRAFT";

  // Anchor bukan DRAFT -> hanya boleh 1 item terpilih.
  if (!isDraft(anchor)) {
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

  // Anchor DRAFT -> hanya boleh memilih sesama DRAFT.
  const draftOnly = items.filter(isDraft);
  if (items.some((i) => !isDraft(i))) {
    toast.warning("Tidak dapat memilih item lain", {
      description: "Hanya item berstatus DRAFT yang dapat dipilih bersama.",
    });
  }
  const allowed = draftOnly.length > 0 ? draftOnly : [anchor];
  selectedItems.value = allowed;
  selectItem(allowed[allowed.length - 1] ?? anchor, 0);
};

// ============================================================================
// POST DIALOG STATE
// ============================================================================
const isPostDialogOpen = ref(false);
const itemToPost = ref<SuratJalanSubconItem | null>(null);
const isPosting = ref(false);

// ============================================================================
// WAITING BIAYA KIRIM DIALOG STATE
// ============================================================================
const isWaitingShippingCostDialogOpen = ref(false);
const itemToWaitingShippingCost = ref<SuratJalanSubconItem | null>(null);
const isWaitingShippingCost = ref(false);

// Check if selected item has locked status (POST)
const isStatusLocked = computed(() => {
  if (!selectedItem.value) return false;
  return normalizeStatus(selectedItem.value.status) === "POST";
});

const normalizeStatus = (status?: string | null) => {
  return (status || "").toUpperCase().replace(/\s+/g, "_");
};

const selectedStatus = computed(() =>
  normalizeStatus(selectedItem.value?.status),
);
const isSelectedDraft = computed(() => selectedStatus.value === "DRAFT");

// Check if item can be edited/deleted (has selection AND status is not locked)
// Exception: Super Admin can always edit/delete
const canEditOrDelete = computed(() => {
  // if (isSuperAdmin.value) return isActive.value;
  return isActive.value && isSelectedDraft.value;
});

// Helper function to check if specific item has locked status
const isItemStatusLocked = (item: SuratJalanSubconItem) => {
  return normalizeStatus(item.status) === "POST";
};

// Helper function to check if item can be deleted (only DRAFT for non-Super Admin)
const canDeleteItem = (item: SuratJalanSubconItem) => {
  // if (isSuperAdmin.value) return true;
  return normalizeStatus(item.status) === "DRAFT";
};

// Helper function to check if item can be edited (only DRAFT)
const canEditItem = (item: SuratJalanSubconItem) => {
  return normalizeStatus(item.status) === "DRAFT";
};

// Helper: normalize boolean-ish value from API
const toBooleanLike = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "1", "yes", "y"].includes(normalized);
  }
  return false;
};

// Helper: check apakah item perlu biaya kirim (is_ekspedisi = true)
const isEkspedisiItem = (item?: SuratJalanSubconItem | null) => {
  if (!item) return false;
  return toBooleanLike((item as any).is_ekspedisi);
};

const selectedNeedBiayaKirim = computed(() =>
  isEkspedisiItem(selectedItem.value),
);

// Check if selected item can be printed (only POST)
const canPrintSelected = computed(() => {
  if (selectedItems.value.length !== 1) return false;
  return normalizeStatus(selectedItems.value[0]?.status) === "POST";
});

// ============================================================================
// DATA & API STATE
// ============================================================================
type SuratJalanSubconDisplayItem = SuratJalanSubconItem & {
  unit_bisnis_name?: string;
  supplier_name?: string;
  pengiriman_info?: string;
};

const menuData = ref<SuratJalanSubconDisplayItem[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const hasMoreData = ref(true);

// ============================================================================
// FILTER & SEARCH STATE
// ============================================================================
const filterStatus = ref<"DRAFT" | "WAITING_BIAYA_KIRIM" | "POST" | null>(null);
const searchQuery = ref("");
const searchApiQuery = ref(""); // Untuk API search
const isSearching = ref(false);
const tableColumnFilters = ref<Record<string, string>>({});
const tableColumnFilterOperators = ref<Record<string, string>>({});
const tableDateRangeFilters = ref<Record<string, { from: string; to: string }>>(
  {},
);

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const getUnitBisnisName = (item: any) => {
  return (
    item.m_unit_bisni?.nama_comp ||
    item.m_unit_bisnis?.nama ||
    item.unit_bisnis ||
    "-"
  );
};

const getSupplierName = (item: any) => {
  return (
    item.m_supplier?.nama_supp ||
    item.m_supplier?.nama ||
    item.supplier?.nama_supp ||
    "-"
  );
};

const getEkspedisiName = (item: any) => {
  return item.m_ekspedisi?.nama || item.supir || "-";
};

const normalizeSuratJalanSubconRow = (
  item: SuratJalanSubconItem,
): SuratJalanSubconDisplayItem => ({
  ...item,
  unit_bisnis_name: getUnitBisnisName(item),
  supplier_name: getSupplierName(item),
  pengiriman_info: getEkspedisiName(item),
});

const formatCurrency = (value: any) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toLocaleString("id-ID");
};

const columns = [
  {
    key: "no_sj_subcon",
    label: "No. SJ Subcon",
    filterable: true,
    width: "160px",
  },
  {
    key: "unit_bisnis_name",
    label: "Unit Bisnis",
    filterable: true,
    width: "170px",
    render: (item: SuratJalanSubconItem) => getUnitBisnisName(item),
  },
  {
    key: "tgl_sj_subcon",
    label: "Tgl SJ Subcon",
    filterable: true,
    filterType: "date" as const,
    width: "150px",
    renderHtml: (item: SuratJalanSubconItem) => {
      return item.tgl_sj_subcon
        ? new Date(item.tgl_sj_subcon).toLocaleDateString("id-ID")
        : "-";
    },
  },
  {
    key: "supplier_name",
    label: "Supplier",
    filterable: true,
    width: "200px",
    render: (item: SuratJalanSubconItem) => getSupplierName(item),
  },
  {
    key: "pengiriman_info",
    label: "Informasi Pengiriman",
    filterable: false,
    width: "200px",
    align: "left" as const,
    render: (item: SuratJalanSubconItem) => getEkspedisiName(item),
  },
  { key: "catatan", label: "Catatan", filterable: true, width: "250px" },
  {
    key: "status",
    label: "Status",
    filterable: true,
    width: "140px",
    renderHtml: (item: SuratJalanSubconItem) => {
      const status = item.status || "DRAFT";
      const badgeClass = getStatusStyle(status);
      const displayStatus =
        status === "WAITING_BIAYA_KIRIM" ? "WAITING BIAYA KIRIM" : status;
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${displayStatus}</span>`;
    },
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/** Get status badge styling */
const getStatusStyle = getApprovalStatusBadgeClass;

// Helper function untuk client-side search di semua field
const searchInItem = (item: SuratJalanSubconItem, query: string): boolean => {
  if (!query.trim()) return true;

  const searchTerm = query.toLowerCase().trim();

  // Search di semua field yang didefinisikan
  const searchableValues = [
    item.no_sj_subcon,
    item.tgl_sj_subcon,
    item.catatan,
    item.status,
    item.unit_bisnis,
    (item as SuratJalanSubconDisplayItem).unit_bisnis_name,
    (item as SuratJalanSubconDisplayItem).supplier_name,
    (item as SuratJalanSubconDisplayItem).pengiriman_info,
    getUnitBisnisName(item),
    getSupplierName(item),
    getEkspedisiName(item),
    item.supir,
    (item as any).no_resi,
    (item as any).m_kendaraan?.no_polisi,
  ].filter(Boolean);

  return searchableValues.some(value =>
    String(value).toLowerCase().includes(searchTerm)
  );
};

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================
/** Filter t_surat_jalan_subcon data by status and search */
const filteredData = computed(() => {
  let result = menuData.value;

  // Apply status filter
  if (filterStatus.value) {
    result = result.filter((item) => {
      const itemStatus = (item.status || "").toUpperCase();
      return itemStatus === filterStatus.value;
    });
  }

  // Apply client-side search as fallback/additional filter
  if (searchApiQuery.value.trim()) {
    result = result.filter((item) => searchInItem(item, searchApiQuery.value));
  }

  return result;
});

/**
 * Check if user can view all data
 * SUPER ADMIN dan DEVELOPER dapat melihat semua data
 * User biasa hanya melihat data yang dibuat sendiri
 */
const canViewAllData = computed(() => {
  // Super Admin dari usePermission sudah handle pengecekan
  if (isSuperAdmin.value) return true;

  // Atau cek berdasarkan tipe user value1
  const tipeUser = authStore.user?.tipe?.value1?.toUpperCase();
  if (!tipeUser) return false;

  // Daftar tipe user yang bisa lihat semua data
  // Sesuaikan dengan kebutuhan module
  const allowedTypes = ["SUPER ADMIN", "DEVELOPER", "ADMIN"];
  return allowedTypes.some((type) => tipeUser.includes(type));
});

/** Deskripsi dialog delete */
const deleteDialogDescription = computed(() => {
  if (!itemToDelete.value) return "";
  return `Apakah Anda yakin ingin menghapus Surat Jalan Subcon "${itemToDelete.value.no_sj_subcon || "tanpa nomor"}"? Tindakan ini tidak dapat dibatalkan.`;
});

// ============================================================================
// NAVIGATION FUNCTIONS
// ============================================================================
/** Navigate to create form */
const createNew = () => {
  router.push("/purchasing/subcon/t_surat_jalan_subcon/form");
};

/** Navigate to edit form */
const editItem = (item?: SuratJalanSubconItem) => {
  if (item) {
    selectItem(item, 0);
  }

  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  // Check if item can be edited (only DRAFT, REVISI for non-Super Admin)
  if (!canEditItem(selectedItem.value)) {
    toast.error("Tidak dapat mengedit", {
      description: `Data dengan status ${selectedItem.value.status} tidak dapat diubah`,
    });
    return;
  }

  router.push(
    `/purchasing/subcon/t_surat_jalan_subcon/form/${selectedItem.value.id}`,
  );
};

/** Navigate to copy (new form with data) */
const copyItem = (item?: SuratJalanSubconItem) => {
  if (item) {
    selectItem(item, 0);
  }

  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  router.push({
    path: "/purchasing/subcon/t_surat_jalan_subcon/form",
    query: { action: "copy", source: selectedItem.value.id },
  });
};

/** View SuratJalanSubcon item details */
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
    `/purchasing/subcon/t_surat_jalan_subcon/view/${selectedItem.value.id}`,
  );
};

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
/** Open delete confirmation dialog */
const deleteSelected = (item?: SuratJalanSubconItem) => {
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

  // Check if item can be deleted (only DRAFT, REVISI for non-Super Admin)
  if (!canDeleteItem(itemToDelete.value)) {
    toast.error("Tidak dapat menghapus", {
      description: `Data dengan status ${itemToDelete.value.status} tidak dapat dihapus`,
    });
    itemToDelete.value = null;
    return;
  }

  isDeleteDialogOpen.value = true;
};

/** Confirm delete - call API */
const confirmDelete = async () => {
  if (!itemToDelete.value?.id) return;

  isDeleting.value = true;
  try {
    const response = await deleteSuratJalanSubcon(itemToDelete.value.id);

    if (response.status === "success") {
      // Remove from list
      menuData.value = menuData.value.filter(
        (m: SuratJalanSubconItem) => m.id !== itemToDelete.value!.id,
      );

      toast.success("Surat Jalan Subcon berhasil dihapus");
      isDeleteDialogOpen.value = false;
      deselectItem();
    } else {
      toast.error("Gagal menghapus Surat Jalan Subcon", {
        description: response.message || "Terjadi kesalahan saat menghapus",
      });
    }
  } catch (error) {
    toast.error("Gagal menghapus Surat Jalan Subcon", {
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
// POST FUNCTIONS
// ============================================================================
const postSelected = (item?: SuratJalanSubconItem) => {
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

  const statusUpper = normalizeStatus(targetItem.status);

  if (statusUpper === "POST") {
    toast.error("Item sudah di-POST", {
      description: "Data yang sudah POST tidak bisa diubah lagi",
    });
    return;
  }

  if (statusUpper === "WAITING_BIAYA_KIRIM") {
    toast.error("Tidak dapat POST", {
      description: "Data masih menunggu biaya kirim",
    });
    return;
  }

  if (isEkspedisiItem(targetItem)) {
    toast.error("Tidak dapat POST", {
      description:
        "Data ekspedisi harus masuk status Waiting Biaya Kirim terlebih dahulu",
    });
    return;
  }

  itemToPost.value = targetItem;
  isPostDialogOpen.value = true;
};

const confirmPost = async () => {
  if (!itemToPost.value?.id) return;

  isPosting.value = true;
  try {
    const response = await postSuratJalanSubcon(itemToPost.value.id);

    if (
      response.status === "success" ||
      response.message === "Data posted successfully"
    ) {
      toast.success(
        `Surat Jalan Subcon "${itemToPost.value.no_sj_subcon || itemToPost.value.id}" berhasil di-POST`,
        {
          description: "Data tidak bisa diedit atau dihapus lagi",
        },
      );

      const targetId = itemToPost.value.id;
      menuData.value = menuData.value.map((item) =>
        item.id === targetId ? { ...item, status: "POST" } : item,
      );

      deselectItem();
      isPostDialogOpen.value = false;
    } else {
      toast.error("Gagal POST Surat Jalan Subcon", {
        description:
          response.message || response.error || "Terjadi kesalahan saat POST",
      });
    }
  } catch (error) {
    toast.error("Gagal POST Surat Jalan Subcon", {
      description:
        error instanceof Error ? error.message : "Terjadi kesalahan sistem",
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
// WAITING BIAYA KIRIM FUNCTIONS
// ============================================================================
const waitingShippingCostSelected = (item?: SuratJalanSubconItem) => {
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

  if (!isEkspedisiItem(targetItem)) {
    toast.error("Tidak dapat diproses", {
      description: "Item ini tidak memerlukan biaya kirim",
    });
    return;
  }

  const statusUpper = normalizeStatus(targetItem.status);
  if (statusUpper === "WAITING_BIAYA_KIRIM") {
    toast.error("Item sudah berstatus Waiting Biaya Kirim");
    return;
  }

  if (statusUpper === "POST") {
    toast.error("Tidak dapat diproses", {
      description: "Data yang sudah POST tidak bisa diubah lagi",
    });
    return;
  }

  itemToWaitingShippingCost.value = targetItem;
  isWaitingShippingCostDialogOpen.value = true;
};

const confirmWaitingShippingCost = async () => {
  if (!itemToWaitingShippingCost.value?.id) return;

  isWaitingShippingCost.value = true;
  try {
    const response = await waitingShippingCostSuratJalanSubcon(
      itemToWaitingShippingCost.value.id,
    );

    if (response.status === "success") {
      const targetId = itemToWaitingShippingCost.value.id;
      menuData.value = menuData.value.map((item) =>
        item.id === targetId
          ? { ...item, status: "WAITING_BIAYA_KIRIM" }
          : item,
      );

      toast.success(
        `Surat Jalan Subcon "${itemToWaitingShippingCost.value.no_sj_subcon || itemToWaitingShippingCost.value.id}" berhasil diset ke Waiting Biaya Kirim`,
      );

      deselectItem();
      isWaitingShippingCostDialogOpen.value = false;
    } else {
      toast.error("Gagal mengubah status", {
        description:
          response.message ||
          response.error ||
          "Terjadi kesalahan saat update status",
      });
    }
  } catch (error) {
    toast.error("Gagal mengubah status", {
      description:
        error instanceof Error ? error.message : "Terjadi kesalahan sistem",
    });
  } finally {
    isWaitingShippingCost.value = false;
    itemToWaitingShippingCost.value = null;
  }
};

const cancelWaitingShippingCost = () => {
  isWaitingShippingCostDialogOpen.value = false;
  itemToWaitingShippingCost.value = null;
};

// ============================================================================
// API DATA FETCHING
// ============================================================================
/** Fetch t_surat_jalan_subcon data from API */
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
  // Set loading state
  if (page === 1 || resetData) {
    loading.value = true;
  } else {
    loadingMore.value = true;
  }

  try {
    // Reset data jika resetData = true
    if (resetData) {
      menuData.value = [];
    }

    // Determine if user should see all data or only their own
    const filterCreatedBy = canViewAllData.value
      ? undefined
      : authStore.user?.id;

    // Build where clause dari date range filter
    const whereClause = Object.entries(tableDateRangeFilters.value)
      .filter(([, filter]) => filter?.from || filter?.to)
      .map(([key, filter]) => {
        const conditions: string[] = [];
        if (filter.from) conditions.push(`${key} >= '${filter.from}'`);
        if (filter.to) conditions.push(`${key} <= '${filter.to}'`);
        return conditions.join("|");
      })
      .filter(Boolean)
      .join("|");

    const searchTerm = searchApiQuery.value?.trim() || undefined;
    const effectivePageSize = searchTerm ? 1000 : pageSize.value;

    const response = await getSuratJalanSubconList(
      page,
      effectivePageSize,
      "createdAt",
      "DESC",
      undefined,
      undefined,
      filterCreatedBy,
      whereClause || undefined,
    );

    if (response.status === "success" && response.data) {
      const normalizedData = response.data.map(normalizeSuratJalanSubconRow);

      if (page === 1 || resetData) {
        // Replace data untuk page pertama
        menuData.value = normalizedData;
      } else {
        // Append data untuk infinite scroll
        menuData.value.push(...normalizedData);
      }

      // Check if there's more data to load
      if (searchTerm) {
        hasMoreData.value = false;
      } else if (response.pagination) {
        hasMoreData.value = response.pagination.next_page !== null;
      }
    }
  } catch (error) {
    toast.error("Gagal memuat data Surat Jalan Subcon", {
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
  // Always set searchApiQuery, even if it's empty (to trigger reload)
  searchApiQuery.value = searchQuery.value.trim();

  // Reset to page 1 when searching
  menuData.value = [];
  currentPage.value = 1;
  hasMoreData.value = true;

  await fetchMenuData(1, true);

  if (searchQuery.value.trim()) {
    toast.success("Pencarian selesai", {
      description: `Ditemukan ${filteredData.value.length} hasil`,
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

// ** Haanle Print Out - generate PDF dan open di new tab */
const printItem = (item?: any) => {
  if (!canPrint.value) {
    toast.error("Akses Ditolak", {
      description: "Anda tidak memiliki izin untuk mencetak data",
    });
    return;
  }

  if (!item && selectedItems.value.length > 1) {
    toast.error("Pilih satu data saja", {
      description: "Print hanya dapat dilakukan untuk satu Surat Jalan Subcon",
    });
    return;
  }

  const targetItem = item || selectedItems.value[0] || selectedItem.value;

  if (!targetItem) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  if (normalizeStatus(targetItem.status) !== "POST") {
    toast.error("Data belum di-POST", {
      description: "Hanya data dengan status POST yang bisa dicetak",
    });
    return;
  }

  selectItem(targetItem, 0);
  router.push(`/purchasing/subcon/t_surat_jalan_subcon/print/${targetItem.id}`);
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
  selectedItems.value = [];
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
  selectedItems.value = [];
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
  selectedItems.value = [];
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
            <h1 class="text-lg font-bold">Transaksi Surat Jalan Subcon</h1>
            <p class="text-xs text-muted-foreground">
              Kelola data Surat Jalan Subcon
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
          >
            DRAFT
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7 whitespace-nowrap"
            :class="
              filterStatus === 'POST'
                ? 'border-green-500 bg-green-100 text-green-800'
                : ''
            "
            @click="filterStatus = filterStatus === 'POST' ? null : 'POST'"
          >
            POST
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="text-xs h-7 whitespace-nowrap"
            :class="
              filterStatus === 'WAITING_BIAYA_KIRIM'
                ? 'border-blue-500 bg-blue-100 text-blue-800'
                : ''
            "
            @click="
              filterStatus =
                filterStatus === 'WAITING_BIAYA_KIRIM'
                  ? null
                  : 'WAITING_BIAYA_KIRIM'
            "
          >
            WAITING BIAYA KIRIM
          </Button>
        </div>

        <!-- Search Input -->
        <div class="relative">
          <Search
            class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
          />
          <Input
            v-model="searchQuery"
            placeholder="Cari No. SJ, Supplier, Unit Bisnis, Catatan..."
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
                  {{ item.no_sj_subcon || "Tanpa Nomor" }}
                </div>
                <div class="text-xs text-muted-foreground truncate">
                  {{
                    item.tgl_sj_subcon
                      ? new Date(item.tgl_sj_subcon).toLocaleDateString("id-ID")
                      : "-"
                  }}
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
              <div v-if="item.catatan" class="truncate">
                <span class="font-medium">Catatan:</span> {{ item.catatan }}
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
                :status="item.status"
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
              <PostButton
                v-if="!isEkspedisiItem(item)"
                variant="ghost"
                size="sm"
                class="h-7 w-7 text-blue-600"
                :showLabel="false"
                :disabled="normalizeStatus(item.status) !== 'DRAFT'"
                @click.stop="postSelected(item)"
              />

              <PrintButton
                v-permission="{ menuId: currentMenuId, action: 'print' }"
                variant="ghost"
                size="sm"
                class="h-7 w-7"
                :disabled="item.status?.toUpperCase() !== 'POST'"
                @click.stop="
                  () => {
                    selectItem(item, 0);
                    printItem(item);
                  }
                "
              />
              <Button
                v-if="isEkspedisiItem(item)"
                v-permission="{ menuId: currentMenuId, action: 'update' }"
                variant="ghost"
                size="icon"
                class="h-7 w-7"
                :disabled="normalizeStatus(item.status) !== 'DRAFT'"
                title="Send Biaya Kirim"
                @click.stop="waitingShippingCostSelected(item)"
              >
                <Truck class="h-4 w-4" />
              </Button>
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
        <h1 class="text-2xl font-bold">Transaksi Surat Jalan Subcon</h1>
        <p class="text-sm text-muted-foreground">
          Kelola data Surat Jalan Subcon
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
          :class="
            filterStatus === 'POST'
              ? 'border-green-500 bg-green-100 text-green-800'
              : ''
          "
          @click="filterStatus = filterStatus === 'POST' ? null : 'POST'"
        >
          POST
        </Button>
        <Button
          variant="outline"
          size="sm"
          :class="
            filterStatus === 'WAITING_BIAYA_KIRIM'
              ? 'border-blue-500 bg-blue-100 text-blue-800'
              : ''
          "
          @click="
            filterStatus =
              filterStatus === 'WAITING_BIAYA_KIRIM'
                ? null
                : 'WAITING_BIAYA_KIRIM'
          "
        >
          WAITING BIAYA KIRIM
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
              placeholder="Cari No. SJ, Supplier, Unit Bisnis, Catatan..."
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
            :disabled="!canEditOrDelete"
            @click="deleteSelected()"
          />
          <!-- BULK DELETE BUTTON -->
          <Button
            v-if="hasBulkSelection"
            v-permission="{ menuId: currentMenuId, action: 'delete' }"
            variant="destructive"
            size="sm"
            class="gap-2"
            @click="openBulkDeleteDialog"
          >
            <Trash2 class="h-4 w-4" />
            Bulk Delete ({{ selectedItems.length }})
          </Button>
          <ViewButton :disabled="!isActive" @click="viewItem()" />
          <EditButton
            v-permission="{ menuId: currentMenuId, action: 'update' }"
            :status="selectedItem?.status"
            :disabled="!canEditOrDelete"
            @click="editItem()"
          />
          <CopyButton
            v-permission="{ menuId: currentMenuId, action: 'create' }"
            :disabled="!isActive"
            @click="copyItem()"
          />
          <PrintButton
            v-permission="{ menuId: currentMenuId, action: 'print' }"
            :disabled="!canPrintSelected"
            @click="() => printItem()"
          />
          <PostButton
            v-if="!selectedNeedBiayaKirim && isSelectedDraft"
            variant="default"
            size="default"
            :showLabel="true"
            :disabled="!canEditOrDelete"
            @click="postSelected()"
          />

          <Button
            v-else-if="selectedNeedBiayaKirim && isSelectedDraft"
            v-permission="{ menuId: currentMenuId, action: 'update' }"
            variant="default"
            :disabled="!canEditOrDelete"
            class="gap-2"
            @click="waitingShippingCostSelected()"
          >
            <Truck class="h-4 w-4" />
            Send Biaya Kirim
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
      :multi-select-mode="true"
      :selected-items="selectedItems"
      :api-filter-mode="true"
      @load-more="handleLoadMore"
      @row-select="(item) => selectItem(item, 0)"
      @row-deselect="deselectItem"
      @filter-change="handleTableFilterChange"
      @selection-change="handleSelectionChange"
    >
      <template #empty> Tidak ada data Surat Jalan Subcon </template>
    </DataTable>
  </div>

  <!-- ================================================================ -->
  <!-- DELETE CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isDeleteDialogOpen"
    title="Hapus Surat Jalan Subcon"
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
  <!-- BULK DELETE CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isBulkDeleteDialogOpen"
    title="Hapus Beberapa Surat Jalan Subcon"
    :description="bulkDeleteDialogDescription"
    type="danger"
    confirm-text="Hapus Semua"
    cancel-text="Batal"
    :is-loading="isBulkDeleting"
    @confirm="confirmBulkDelete"
    @cancel="cancelBulkDelete"
    @update:open="isBulkDeleteDialogOpen = $event"
  />

  <!-- ================================================================ -->
  <!-- POST CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isPostDialogOpen"
    title="Post Surat Jalan Subcon"
    :description="`Apakah Anda yakin ingin memposting Surat Jalan Subcon '${itemToPost?.no_sj_subcon || 'Tanpa Nomor'}'? Setelah diposting, data tidak dapat diubah atau dihapus.`"
    type="warning"
    confirm-text="Post"
    cancel-text="Batal"
    :is-loading="isPosting"
    @confirm="confirmPost"
    @cancel="cancelPost"
    @update:open="isPostDialogOpen = $event"
  />

  <!-- ================================================================ -->
  <!-- WAITING BIAYA KIRIM CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isWaitingShippingCostDialogOpen"
    title="Waiting Biaya Kirim"
    :description="`Apakah Anda yakin ingin mengubah status Surat Jalan Subcon '${itemToWaitingShippingCost?.no_sj_subcon || 'Tanpa Nomor'}' menjadi WAITING_BIAYA_KIRIM?`"
    type="warning"
    confirm-text="Set Waiting"
    cancel-text="Batal"
    :is-loading="isWaitingShippingCost"
    @confirm="confirmWaitingShippingCost"
    @cancel="cancelWaitingShippingCost"
    @update:open="isWaitingShippingCostDialogOpen = $event"
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
