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
  Download,
  FileUp,
  Edit,
  Copy,
  RefreshCw,
  X,
  Check,
  Plus,
  Info,
  Eye,
  Send,
  QrCode,
  Filter,
  Activity,
} from "lucide-vue-next";
import { apiCall } from "@/lib/api";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import DataTable from "@/components/table/DataTable.vue";
import { FieldSelect, FieldDate, FieldMultiSelect } from "@/components/field";
import Tabs from "@/components/ui/tabs/Tabs.vue";
import TabsList from "@/components/ui/tabs/TabsList.vue";
import TabsTrigger from "@/components/ui/tabs/TabsTrigger.vue";
import TabsContent from "@/components/ui/tabs/TabsContent.vue";
import { useActionButtons } from "@/composables/useActionButtons";
import { usePermission } from "@/composables/usePermission";
import {
  getItemsList,
  deleteItems,
  deleteDraftItems,
  updateItems,
  type ItemsItem,
} from "./service";
import { useDataTableFilters } from "@/composables/useDataTableFilters";
import { jsPDF } from "jspdf";

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

import { useAuthStore } from "@/stores/auth";
import { useApi } from "@/composables/useApi";
import { getApprovalStatusBadgeClass, getApprovalStatusFilterClass } from "@/lib/approvalStatus";
const authStore = useAuthStore();
const { API_BASE_URL } = useApi();

const {
  tableColumnFilters,
  tableColumnFilterOperators,
  tableWhereClause,
  handleTableFilterChange,
  resetFilters: resetTableFilters,
} = useDataTableFilters(async () => {
  menuData.value = [];
  currentPage.value = 1;
  hasMoreData.value = true;
  await fetchMenuData(1, true);
});

// ============================================================================
// DELETE DIALOG STATE
// ============================================================================
const isDeleteDialogOpen = ref(false);
const itemToDelete = ref<ItemsItem | null>(null);
const itemsToDelete = ref<ItemsItem[]>([]);
const isDeleting = ref(false);

// ============================================================================
// POST DIALOG STATE
// ============================================================================
const isPostDialogOpen = ref(false);
const itemToPost = ref<ItemsItem | null>(null);
const isPosting = ref(false);

// ============================================================================
// STATUS DIALOG STATE
// ============================================================================
const isStatusDialogOpen = ref(false);
const statusToChange = ref<boolean | null>(null);
const isUpdatingStatus = ref(false);

// ============================================================================
// QR CODE DIALOG STATE
// ============================================================================
const isQrDialogOpen = ref(false);
const itemForQr = ref<ItemsItem | null>(null);

// ============================================================================
// ADVANCE FILTERS STATE
// ============================================================================
const isAdvanceFiltersOpen = ref(false);
const advanceFilters = ref({
  tipe_id: "",
  kategori_id: "",
  uom_id: "",
  group1_id: "",
  group2_id: "",
  group3_id: "",
  group4_id: "",
  group5_id: "",
  group6_id: "",
  created_date_start: "",
  created_date_end: "",
  updated_date_start: "",
  updated_date_end: "",
  has_barcode: "", // "", "yes", "no"
  // Company filter - array untuk multi-select
  filter_company_id: [] as string[],
});

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<ItemsItem[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const totalItems = ref(0);
const totalPages = ref(0);
const hasMoreData = ref(true);

// ============================================================================
// FILTER & SEARCH STATE
// ============================================================================
const filterStatus = ref<"Aktif" | "Nonaktif" | null>(null);
const filterApprovalStatus = ref<"DRAFT" | "POST" | null>(null);
const searchQuery = ref("");
const searchApiQuery = ref("");
const isSearching = ref(false);

// ============================================================================
// MULTI-SELECT STATE
// ============================================================================
const selectedItems = ref<ItemsItem[]>([]);
const fileInputRef = ref<HTMLInputElement | null>(null);
const dataTableRef = ref<any>(null);
const isExporting = ref(false);
const isImporting = ref(false);

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const columns = [
  {
    key: "kode_item",
    label: "Item Code",
    filterable: true,
    width: "140px",
  },
  {
    key: "nama_item",
    label: "Item Name",
    filterable: true,
    width: "250px",
  },
  {
    key: "mi_tipe.value1",
    label: "Item Type",
    filterable: true,
    width: "150px",
    renderHtml: (item: ItemsItem) => {
      return item.mi_tipe?.value1 || "-";
    },
  },
  {
    key: "mi_uom.value1",
    label: "UOM",
    filterable: true,
    width: "100px",
    renderHtml: (item: ItemsItem) => {
      return item.mi_uom?.value1 || "-";
    },
  },
  {
    key: "mi_kategori.name",
    label: "Item Category",
    filterable: true,
    width: "150px",
    renderHtml: (item: ItemsItem) => {
      return item.mi_kategori?.name || "-";
    },
  },
  {
    key: "is_active",
    label: "Active Status",
    filterable: false,
    width: "100px",
    renderHtml: (item: ItemsItem) => {
      const isActive = item.is_active;
      const text = isActive ? "Aktif" : "Nonaktif";
      const cls = isActive
        ? "border border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
        : "border border-gray-200 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200";
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}">${text}</span>`;
    },
  },
  {
    key: "is_sepuh",
    label: "IS SEPUH",
    filterable: false,
    width: "100px",
    renderHtml: (item: ItemsItem) => {
      const val = item.is_sepuh;
      const text = val ? "Ya" : "Tidak";
      const cls = val
        ? "border border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
        : "border border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200";
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}">${text}</span>`;
    },
  },
  {
    key: "is_potong",
    label: "IS POTONG",
    filterable: false,
    width: "100px",
    renderHtml: (item: ItemsItem) => {
      const val = item.is_potong;
      const text = val ? "Ya" : "Tidak";
      const cls = val
        ? "border border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
        : "border border-red-200 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200";
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}">${text}</span>`;
    },
  },
  {
    key: "status",
    label: "Approval Status",
    filterable: false,
    width: "120px",
    minWidth: 120,
    renderHtml: (item: ItemsItem) => {
      const status = (item.status || "DRAFT").toUpperCase();
      const badgeClass = getApprovalStatusBadgeClass(status);
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${status}</span>`;
    },
  },
];

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================
const filteredData = computed(() => {
  return menuData.value.filter((item: ItemsItem) => {
    const matchStatus =
      filterStatus.value === null
        ? true
        : filterStatus.value === "Aktif"
          ? item.is_active === true
          : item.is_active === false;

    const matchApprovalStatus =
      filterApprovalStatus.value === null
        ? true
        : item.status?.toUpperCase() === filterApprovalStatus.value;

    // Advance filters - Basic
    const matchTipe =
      !advanceFilters.value.tipe_id ||
      String(item.tipe_id) === String(advanceFilters.value.tipe_id);

    const matchKategori =
      !advanceFilters.value.kategori_id ||
      String(item.kategori_id) === String(advanceFilters.value.kategori_id);

    const matchUom =
      !advanceFilters.value.uom_id ||
      String(item.uom_id) === String(advanceFilters.value.uom_id);

    // Advance filters - Group Items
    const matchGroup1 =
      !advanceFilters.value.group1_id ||
      String(item.group1_id) === String(advanceFilters.value.group1_id);

    const matchGroup2 =
      !advanceFilters.value.group2_id ||
      String(item.group2_id) === String(advanceFilters.value.group2_id);

    const matchGroup3 =
      !advanceFilters.value.group3_id ||
      String(item.group3_id) === String(advanceFilters.value.group3_id);

    const matchGroup4 =
      !advanceFilters.value.group4_id ||
      String(item.group4_id) === String(advanceFilters.value.group4_id);

    const matchGroup5 =
      !advanceFilters.value.group5_id ||
      String(item.group5_id) === String(advanceFilters.value.group5_id);

    const matchGroup6 =
      !advanceFilters.value.group6_id ||
      String(item.group6_id) === String(advanceFilters.value.group6_id);

    // Advance filters - Date Range
    const matchCreatedDateStart =
      !advanceFilters.value.created_date_start ||
      new Date(item.createdAt || "") >= new Date(advanceFilters.value.created_date_start);

    const matchCreatedDateEnd =
      !advanceFilters.value.created_date_end ||
      new Date(item.createdAt || "") <= new Date(advanceFilters.value.created_date_end + "T23:59:59");

    const matchUpdatedDateStart =
      !advanceFilters.value.updated_date_start ||
      new Date(item.updatedAt || "") >= new Date(advanceFilters.value.updated_date_start);

    const matchUpdatedDateEnd =
      !advanceFilters.value.updated_date_end ||
      new Date(item.updatedAt || "") <= new Date(advanceFilters.value.updated_date_end + "T23:59:59");

    // Advance filters - Has Barcode
    const matchBarcode =
      !advanceFilters.value.has_barcode ||
      (advanceFilters.value.has_barcode === "yes" && item.kode_item) ||
      (advanceFilters.value.has_barcode === "no" && !item.kode_item);

    // Advance filters - Company (Multi-select)
    const matchCompany = (() => {
      const companyIds = advanceFilters.value.filter_company_id;
      // Jika tidak ada filter company dipilih, return true
      if (!companyIds || companyIds.length === 0) return true;
      
      // Cek apakah item memiliki minimal 1 unit bisnis yang match dengan salah satu company yang dipilih
      return item.m_items_unit_bisnis?.some((ub: any) => {
        // Handle both possible property names (m_unit_bisnis and m_unit_bisni - API typo)
        const ubCompanyId = ub.m_unit_bisnis?.company_id || ub.m_unit_bisni?.company_id || ub.company_id;
        return companyIds.some(selectedCompanyId => String(ubCompanyId) === String(selectedCompanyId));
      }) ?? false;
    })();

    return matchStatus && matchApprovalStatus && matchTipe && matchKategori && matchUom &&
           matchGroup1 && matchGroup2 && matchGroup3 && matchGroup4 && matchGroup5 && matchGroup6 &&
           matchCreatedDateStart && matchCreatedDateEnd && matchUpdatedDateStart && matchUpdatedDateEnd &&
           matchBarcode && matchCompany;
  });
});

const deleteDialogDescription = computed(() => {
  if (itemsToDelete.value.length > 1) {
    return `Apakah Anda yakin ingin menghapus ${itemsToDelete.value.length} item terpilih? Tindakan ini tidak dapat dibatalkan.`;
  }
  if (itemsToDelete.value.length === 1) {
    const item = itemsToDelete.value[0];
    return `Apakah Anda yakin ingin menghapus Items "${item?.nama_item}" (${item?.kode_item})? Tindakan ini tidak dapat dibatalkan.`;
  }
  if (itemToDelete.value) {
    return `Apakah Anda yakin ingin menghapus Items "${itemToDelete.value.nama_item}" (${itemToDelete.value.kode_item})? Tindakan ini tidak dapat dibatalkan.`;
  }
  return "";
});

const canEdit = (item: ItemsItem | null) => {
  if (!item) return false;
  return true;
};

const canDeleteItem = (item: ItemsItem | null) => {
  if (!item) return false;
  return item.status?.toUpperCase() === "DRAFT";
};

const canEditSelected = computed(() => canEdit(selectedItem.value));
const canDeleteSelected = computed(() => {
  if (selectedItems.value.length > 0) {
    return selectedItems.value.every((item) => canDeleteItem(item));
  }
  if (selectedItem.value) {
    return canDeleteItem(selectedItem.value);
  }
  return false;
});



// Active advance filters count
const activeAdvanceFiltersCount = computed(() => {
  let count = 0;
  
  // Count string filters
  if (advanceFilters.value.tipe_id) count++;
  if (advanceFilters.value.kategori_id) count++;
  if (advanceFilters.value.uom_id) count++;
  if (advanceFilters.value.group1_id) count++;
  if (advanceFilters.value.group2_id) count++;
  if (advanceFilters.value.group3_id) count++;
  if (advanceFilters.value.group4_id) count++;
  if (advanceFilters.value.group5_id) count++;
  if (advanceFilters.value.group6_id) count++;
  if (advanceFilters.value.created_date_start) count++;
  if (advanceFilters.value.created_date_end) count++;
  if (advanceFilters.value.updated_date_start) count++;
  if (advanceFilters.value.updated_date_end) count++;
  if (advanceFilters.value.has_barcode) count++;
  
  // Count company/unit bisnis filter (treated as 1 filter entry)
  if (advanceFilters.value.filter_company_id && advanceFilters.value.filter_company_id.length > 0) count++;
  
  return count;
});

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
const deleteSelected = () => {
  if (!canDelete.value) {
    toast.error("Akses Ditolak", {
      description: "Anda tidak memiliki izin untuk menghapus data",
    });
    return;
  }

  const candidateItems = selectedItems.value.length
    ? selectedItems.value
    : selectedItem.value
      ? [selectedItem.value]
      : [];

  if (candidateItems.length === 0) {
    toast.error("Pilih minimal 1 item untuk dihapus");
    return;
  }

  const deletableItems = candidateItems.filter((item) => canDeleteItem(item));
  const blockedItems = candidateItems.filter((item) => !canDeleteItem(item));

  if (blockedItems.length > 0) {
    toast.error("Item berstatus POST tidak dapat dihapus", {
      description: `${blockedItems.length} item berstatus POST tidak dapat dihapus, hanya bisa dinonaktifkan. Tombol hapus hanya untuk item DRAFT.`,
    });
  }

  if (deletableItems.length === 0) {
    toast.error("Item tidak dapat dihapus", {
      description: "Hanya item berstatus DRAFT dan belum pernah digunakan yang dapat dihapus. Item berstatus POST hanya bisa dinonaktifkan.",
    });
    return;
  }

  itemsToDelete.value = deletableItems;
  itemToDelete.value = deletableItems.length === 1 ? deletableItems[0] : null;
  isDeleteDialogOpen.value = true;
};

const confirmDelete = async () => {
  const targets = itemsToDelete.value.length
    ? itemsToDelete.value
    : itemToDelete.value
      ? [itemToDelete.value]
      : [];

  if (targets.length === 0) return;

  isDeleting.value = true;
  try {
    const results = await Promise.allSettled(
      targets
        .filter((item) => !!item.id)
        .map((item) => deleteItems(item.id as string)),
    );

    const successIds: string[] = [];
    let failedCount = 0;

    results.forEach((result, index) => {
      const target = targets[index];
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

    if (successIds.length > 0) {
      menuData.value = menuData.value.filter(
        (m: ItemsItem) => !successIds.includes(String(m.id)),
      );
      selectedItems.value = selectedItems.value.filter(
        (m) => !successIds.includes(String(m.id)),
      );
      dataTableRef.value?.clearSelection?.();
      deselectItem();

      toast.success("Hapus item berhasil", {
        description:
          successIds.length === 1
            ? "1 item berhasil dihapus"
            : `${successIds.length} item berhasil dihapus`,
      });
    }

    if (failedCount > 0) {
      toast.error("Sebagian item gagal dihapus", {
        description: `${failedCount} item gagal dihapus`,
      });
    }

    isDeleteDialogOpen.value = false;
  } catch (error) {
    toast.error("Gagal menghapus Items", {
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
const openPostDialog = (item?: ItemsItem) => {
  if (item) {
    selectItem(item, 0);
  }

  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  if (selectedItem.value.status?.toUpperCase() !== "DRAFT") {
    toast.error("Hanya item dengan status DRAFT yang bisa di POST");
    return;
  }

  itemToPost.value = selectedItem.value;
  isPostDialogOpen.value = true;
};

const confirmPost = async () => {
  if (!itemToPost.value || !itemToPost.value.id) return;

  isPosting.value = true;
  try {
    const payload = {
      ...itemToPost.value,
      status: "POST",
      updated_by: authStore.user?.id ? String(authStore.user.id) : "",
    };

    const response = await updateItems(itemToPost.value.id, payload);

    if (response.status === "success") {
      const itemIndex = menuData.value.findIndex(
        (m: ItemsItem) => m.id === itemToPost.value!.id,
      );
      if (itemIndex !== -1 && menuData.value[itemIndex]) {
        menuData.value[itemIndex].status = "POST";
      }

      toast.success("Item berhasil di POST", {
        description: `Item "${itemToPost.value.nama_item}" berhasil diposting`,
      });

      isPostDialogOpen.value = false;
      itemToPost.value = null;
      deselectItem();
    } else {
      toast.error("Gagal melakukan POST item", {
        description:
          response.message || "Terjadi kesalahan saat memposting item",
      });
    }
  } catch (error) {
    toast.error("Gagal melakukan POST item", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    isPosting.value = false;
  }
};

const cancelPost = () => {
  isPostDialogOpen.value = false;
  itemToPost.value = null;
};

const goToStockCard = () => {
  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }
  router.push({
    path: "/inventory/transaksi/stock_gudang_2",
    query: { search: selectedItem.value.kode_item },
  });
};

const openStatusDialog = (activeStatus: boolean) => {
  if (selectedItems.value.length === 0) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }
  statusToChange.value = activeStatus;
  isStatusDialogOpen.value = true;
};

const confirmStatusChange = async () => {
  if (statusToChange.value === null) return;
  isUpdatingStatus.value = true;
  const activeStatus = statusToChange.value;
  const actionText = activeStatus ? "mengaktifkan" : "menonaktifkan";

  try {
    const ids = selectedItems.value.map((item) => item.id);
    
    await apiCall(`/fn/m_items/bulkUpdateStatus`, {
      method: "POST",
      body: JSON.stringify({ ids, is_active: activeStatus }),
    });

    toast.success(`Berhasil ${actionText} ${selectedItems.value.length} item`);
    selectedItems.value = []; // Clear selection
    isStatusDialogOpen.value = false;
    await handleRefresh();
  } catch (error) {
    toast.error(`Gagal ${actionText} beberapa item`, {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    isUpdatingStatus.value = false;
  }
};

const cancelStatusChange = () => {
  isStatusDialogOpen.value = false;
  statusToChange.value = null;
};

// ============================================================================
// VIEW / EDIT / COPY FUNCTIONS
// ============================================================================
const viewItem = (item?: any) => {
  if (item) selectItem(item, 0);
  if (!selectedItem.value) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }
  router.push(`/inventory/master/m_items/view/${selectedItem.value.id}`);
};

const editItem = (item?: any) => {
  if (!canUpdate.value) {
    toast.error("Akses Ditolak", {
      description: "Anda tidak memiliki izin untuk mengubah data",
    });
    return;
  }

  if (item) selectItem(item, 0);
  const selectedItemData = handleEdit(item);
  if (!selectedItemData) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  router.push(`/inventory/master/m_items/form/${selectedItemData.id}`);
};

const copyItem = (item?: any) => {
  if (!canCreate.value) {
    toast.error("Akses Ditolak", {
      description: "Anda tidak memiliki izin untuk membuat data baru",
    });
    return;
  }

  if (item) selectItem(item, 0);
  const selectedItemData = handleCopy(item);
  if (!selectedItemData) {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  router.push({
    path: "/inventory/master/m_items/form",
    query: { action: "copy", source: selectedItemData.id },
  });

  toast.success(`Menyalin data "${selectedItemData.nama_item}"`, {
    description: "Silakan edit dan simpan sebagai Items baru",
  });
  deselectItem();
};

const createNew = () => {
  if (!canCreate.value) {
    toast.error("Akses Ditolak", {
      description: "Anda tidak memiliki izin untuk membuat data baru",
    });
    return;
  }
  router.push("/inventory/master/m_items/form");
};

// ============================================================================
// QR CODE FUNCTIONS
// ============================================================================
const getQrCodeValue = (item?: ItemsItem | null) => {
  return (item?.kode_item || "").trim();
};

const getQrCodeImageUrl = (item?: ItemsItem | null) => {
  const qrValue = getQrCodeValue(item);
  if (!qrValue) return "";
  return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&format=png&data=${encodeURIComponent(qrValue)}`;
};

const openQrDialog = (item?: ItemsItem) => {
  if (item) {
    itemForQr.value = item;
  } else if (selectedItem.value) {
    itemForQr.value = selectedItem.value as ItemsItem;
  } else {
    toast.error("Pilih item terlebih dahulu");
    return;
  }

  const qrValue = getQrCodeValue(itemForQr.value);
  if (!qrValue) {
    toast.error("Kode item tidak tersedia", {
      description: "QR code hanya bisa dibuat untuk item dengan kode item valid",
    });
    return;
  }

  isQrDialogOpen.value = true;
};

const downloadQrImage = async () => {
  const qrValue = getQrCodeValue(itemForQr.value);
  const imageUrl = getQrCodeImageUrl(itemForQr.value);

  if (!qrValue || !imageUrl) {
    toast.error("QR code tidak tersedia untuk diunduh");
    return;
  }

  try {
    // Create PDF
    const pdf = new jsPDF("portrait", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Add title
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text("QR Code - Item", pageWidth / 2, 20, { align: "center" });

    // Add item information
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("Kode Item:", 20, 40);
    pdf.setFont("helvetica", "normal");
    pdf.text(itemForQr.value?.kode_item || "-", 60, 40);

    pdf.setFont("helvetica", "bold");
    pdf.text("Nama Item:", 20, 50);
    pdf.setFont("helvetica", "normal");
    const namaItem = itemForQr.value?.nama_item || "-";
    const maxWidth = pageWidth - 65;
    const splitNama = pdf.splitTextToSize(namaItem, maxWidth);
    pdf.text(splitNama, 60, 50);

    // Add QR code image
    const qrSize = 120; // 120mm QR code
    const qrX = (pageWidth - qrSize) / 2;
    const qrY = 70;

    // Load image and add to PDF
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    await new Promise((resolve, reject) => {
      img.onload = () => {
        pdf.addImage(img, "PNG", qrX, qrY, qrSize, qrSize);
        resolve(true);
      };
      img.onerror = reject;
      img.src = imageUrl;
    });

    // Add footer text
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(qrValue, pageWidth / 2, qrY + qrSize + 15, { align: "center" });

    // Save PDF
    const safeCode = qrValue.replace(/[^a-zA-Z0-9-_]/g, "_");
    pdf.save(`qr-barcode-${safeCode}.pdf`);

    toast.success("PDF berhasil diunduh", {
      description: `QR Code untuk "${itemForQr.value?.nama_item}" berhasil disimpan`,
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    toast.error("Gagal membuat PDF", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  }
};

// ============================================================================
// API & DATA FETCHING FUNCTIONS
// ============================================================================
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
  if (page === 1 || resetData) {
    loading.value = true;
  } else {
    loadingMore.value = true;
  }

  currentPage.value = page;

  try {
    if (page === 1 || resetData) {
      try {
        await deleteDraftItems();
      } catch (error) {
        console.warn("Failed to delete draft items:", error);
      }
    }

    const response = await getItemsList(
      page,
      pageSize.value,
      "createdAt",
      "DESC",
      searchApiQuery.value || undefined,
      searchApiQuery.value ? "kode_item,nama_item" : undefined,
      "m_general@mi_tipe,m_general@mi_uom,m_g_category@mi_kategori,m_items_unit_bisnis>m_unit_bisnis",
      Object.keys(tableColumnFilters.value).length > 0 ? tableColumnFilters.value : undefined,
      Object.keys(tableColumnFilterOperators.value).length > 0 ? tableColumnFilterOperators.value : undefined,
      tableWhereClause.value || undefined,
    );

    if (response.status === "success") {
      const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 1024;
      if (page === 1 || resetData || isDesktop) {
        menuData.value = response.data || [];
      } else {
        menuData.value.push(...(response.data || []));
      }

      if (response.pagination) {
        totalItems.value = response.pagination.total || 0;
        totalPages.value = response.pagination.totalPages || 0;
        currentPage.value = response.pagination.page || page;
        pageSize.value = response.pagination.limit || pageSize.value;
        hasMoreData.value = response.pagination.next_page !== null;
      }
    }
  } catch (error) {
    toast.error("Gagal memuat data Items", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
};

const handlePageChange = async (newPage: number) => {
  await fetchMenuData(newPage, true);
};

const handlePageSizeChange = async (newSize: number) => {
  pageSize.value = newSize;
  currentPage.value = 1;
  await fetchMenuData(1, true);
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

const openAdvanceFilters = () => {
  isAdvanceFiltersOpen.value = true;
};

const applyAdvanceFilters = async () => {
  isAdvanceFiltersOpen.value = false;
  menuData.value = [];
  currentPage.value = 1;
  hasMoreData.value = true;
  await fetchMenuData(1, true);
  
  const activeFiltersCount = activeAdvanceFiltersCount.value;
  if (activeFiltersCount > 0) {
    const filterNames: string[] = [];
    if (advanceFilters.value.tipe_id) filterNames.push("Type");
    if (advanceFilters.value.kategori_id) filterNames.push("Category");
    if (advanceFilters.value.uom_id) filterNames.push("UOM");
    if (advanceFilters.value.group1_id) filterNames.push("Group 1");
    if (advanceFilters.value.group2_id) filterNames.push("Group 2");
    if (advanceFilters.value.group3_id) filterNames.push("Group 3");
    if (advanceFilters.value.group4_id) filterNames.push("Group 4");
    if (advanceFilters.value.group5_id) filterNames.push("Group 5");
    if (advanceFilters.value.group6_id) filterNames.push("Group 6");
    if (advanceFilters.value.created_date_start || advanceFilters.value.created_date_end) filterNames.push("Created Date");
    if (advanceFilters.value.updated_date_start || advanceFilters.value.updated_date_end) filterNames.push("Updated Date");
    if (advanceFilters.value.has_barcode) filterNames.push("Barcode");
    if (advanceFilters.value.filter_company_id && advanceFilters.value.filter_company_id.length > 0) {
      const companyCount = advanceFilters.value.filter_company_id.length;
      filterNames.push(`Company (${companyCount})`);
    }
    
    toast.success("Filter diterapkan", {
      description: `${activeFiltersCount} filter aktif: ${filterNames.join(", ")}`,
    });
  } else {
    toast.info("Tidak ada filter yang dipilih");
  }
};

const clearAdvanceFilters = async () => {
  advanceFilters.value = {
    tipe_id: "",
    kategori_id: "",
    uom_id: "",
    group1_id: "",
    group2_id: "",
    group3_id: "",
    group4_id: "",
    group5_id: "",
    group6_id: "",
    created_date_start: "",
    created_date_end: "",
    updated_date_start: "",
    updated_date_end: "",
    has_barcode: "",
    filter_company_id: [],
  };
  isAdvanceFiltersOpen.value = false;
  menuData.value = [];
  currentPage.value = 1;
  hasMoreData.value = true;
  await fetchMenuData(1, true);
  toast.success("Filter direset");
};

const handleRefresh = async () => {
  searchQuery.value = "";
  searchApiQuery.value = "";
  filterStatus.value = null;
  filterApprovalStatus.value = null;
  resetTableFilters();
  dataTableRef.value?.resetFilters?.();
  menuData.value = [];
  currentPage.value = 1;
  hasMoreData.value = true;
  deselectItem();
  selectedItems.value = [];

  await fetchMenuData(1, true);
  toast.success("Data berhasil dimuat ulang");
};

const handleWindowScroll = () => {
  if (typeof window !== 'undefined' && window.innerWidth >= 1024) return;
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
// IMPORT/EXPORT FUNCTIONS
// ============================================================================
const handleSelectionChange = (items: ItemsItem[]) => {
  selectedItems.value = items;
};

const handleExport = async () => {
  isExporting.value = true;
  try {
    let apiUrl = `${API_BASE_URL}/fn/m_items/exportExcel`;

    const params = new URLSearchParams();
    if (selectedItems.value.length > 0) {
      const ids = selectedItems.value.map((item) => item.id).join(",");
      params.append("id", ids);
    }
    if (searchQuery.value) {
      params.append("search", searchQuery.value);
    }
    if (filterStatus.value) {
      params.append("status", filterStatus.value);
    }

    const queryString = params.toString();
    if (queryString) {
      apiUrl += `?${queryString}`;
    }

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: { Authorization: `Bearer ${authStore.token}` },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || "Gagal mengexport data");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `items_export_${new Date().getTime()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    const exportCount =
      selectedItems.value.length > 0
        ? `${selectedItems.value.length} item`
        : "Semua data";
    toast.success("Export berhasil", {
      description: `${exportCount} berhasil diexport`,
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

    const response = await fetch(`${API_BASE_URL}/fn/m_items/importExcel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authStore.token}` },
      body: formData,
    });

    const result = await response.json();

    if (result.status === "success") {
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
    if (target) target.value = "";
  }
};

const clearAllSelection = () => {
  selectedItems.value = [];
  dataTableRef.value?.clearSelection();
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
            <h1 class="text-lg font-bold">Master Items</h1>
            <p class="text-xs text-muted-foreground">Kelola Items aplikasi</p>
          </div>
          <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading" class="h-8 w-8">
            <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
          </Button>
        </div>

        <!-- Filter Status Buttons -->
        <div class="flex items-center gap-2">
          <Button variant="outline" size="sm" class="text-xs h-7"
            :class="filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
            @click="filterStatus = null">
            All
          </Button>
          <Button variant="outline" size="sm" class="text-xs h-7"
            :class="filterStatus === 'Aktif' ? 'bg-green-100 text-green-800 border-green-500 hover:bg-green-200' : ''"
            @click="filterStatus = filterStatus === 'Aktif' ? null : 'Aktif'">
            Aktif
          </Button>
          <Button variant="outline" size="sm" class="text-xs h-7"
            :class="filterStatus === 'Nonaktif' ? 'bg-red-100 text-red-800 border-red-500 hover:bg-red-200' : ''"
            @click="filterStatus = filterStatus === 'Nonaktif' ? null : 'Nonaktif'">
            Nonaktif
          </Button>
        </div>

        <!-- Filter Status Approval Buttons -->
        <div class="flex items-center gap-2 overflow-x-auto">
          <Button variant="outline" size="sm" class="text-xs h-7 whitespace-nowrap"
            :class="filterApprovalStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
            @click="filterApprovalStatus = null">
            All
          </Button>
          <Button variant="outline" size="sm" class="text-xs h-7 whitespace-nowrap"
            :class="getApprovalStatusFilterClass('DRAFT', filterApprovalStatus === 'DRAFT')"
            @click="filterApprovalStatus = filterApprovalStatus === 'DRAFT' ? null : 'DRAFT'">
            Draft
          </Button>
          <Button variant="outline" size="sm" class="text-xs h-7 whitespace-nowrap"
            :class="getApprovalStatusFilterClass('POST', filterApprovalStatus === 'POST')"
            @click="filterApprovalStatus = filterApprovalStatus === 'POST' ? null : 'POST'">
            Post
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
        <Card v-for="item in filteredData" :key="item.id"
          class="cursor-pointer hover:shadow-md transition-all"
          @click="selectItem(item, 0)">
          <CardContent class="pt-3 pb-2 space-y-2">
            <!-- Name & Status Row -->
            <div class="flex items-center gap-2 justify-between mb-2">
              <div class="flex-1 min-w-0">
                <div class="font-semibold truncate">{{ item.nama_item }}</div>
                <div class="text-xs text-muted-foreground truncate">
                  {{ item.kode_item || "-" }}
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <Badge :variant="item.is_active ? 'default' : 'secondary'" class="text-xs">
                  {{ item.is_active ? "Aktif" : "Nonaktif" }}
                </Badge>
                <Badge v-if="item.status"
                  :variant="item.status?.toUpperCase() === 'POST' ? 'default' : 'outline'"
                  class="text-xs"
                  :class="{
                    'text-green-600': item.status?.toUpperCase() === 'POST',
                    'text-blue-600': item.status?.toUpperCase() === 'DRAFT',
                  }">
                  {{ item.status?.toUpperCase() }}
                </Badge>
              </div>
            </div>

            <!-- Details -->
            <div class="text-xs space-y-1 text-muted-foreground">
              <div v-if="item.mi_tipe">
                <span class="font-medium">Type:</span> {{ item.mi_tipe?.value1 }}
              </div>
              <div v-if="item.mi_uom">
                <span class="font-medium">UOM:</span> {{ item.mi_uom?.value1 }}
              </div>
              <div v-if="item.mi_kategori">
                <span class="font-medium">Category:</span> {{ item.mi_kategori?.value1 }}
              </div>
              <div class="flex items-center gap-3 pt-1">
                <div class="flex items-center gap-1">
                  <span class="font-medium">Sepuh:</span>
                  <Badge :variant="item.is_sepuh ? 'default' : 'secondary'" class="text-xs">
                    {{ item.is_sepuh ? "Ya" : "Tidak" }}
                  </Badge>
                </div>
                <div class="flex items-center gap-1">
                  <span class="font-medium">Potong:</span>
                  <Badge :variant="item.is_potong ? 'default' : 'secondary'" class="text-xs">
                    {{ item.is_potong ? "Ya" : "Tidak" }}
                  </Badge>
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-1 justify-end pt-2 border-t">
              <Button variant="ghost" size="icon" class="h-8 w-8 shrink-0" title="Lihat Detail"
                @click.stop="router.push(`/inventory/master/m_items/view/${item.id}`)">
                <Eye class="h-4 w-4" />
              </Button>
              <Button v-permission="{ menuId: currentMenuId, action: 'update' }"
                variant="ghost" size="icon" class="h-8 w-8 shrink-0" title="Edit"
                :disabled="!canEdit(item)"
                @click.stop="() => {
                  if (!canEdit(item)) {
                    toast.error('Tidak dapat mengedit', { description: `Item dengan status ${(item.status || '').toUpperCase()} tidak dapat diedit` });
                    return;
                  }
                  router.push(`/inventory/master/m_items/form/${item.id}`);
                }">
                <Edit class="h-4 w-4" />
              </Button>
              <Button v-permission="{ menuId: currentMenuId, action: 'create' }"
                variant="ghost" size="icon" class="h-8 w-8 shrink-0" title="Salin"
                @click.stop="router.push(`/inventory/master/m_items/form?action=copy&source=${item.id}`)">
                <Copy class="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" class="h-8 w-8 shrink-0" title="QR Code"
                @click.stop="openQrDialog(item)">
                <QrCode class="h-4 w-4" />
              </Button>
              <Button v-if="item.status?.toUpperCase() === 'DRAFT'"
                variant="outline" size="sm" class="gap-1 h-8 px-2"
                @click.stop="openPostDialog(item)">
                <Send class="h-3 w-3" />
                <span class="text-xs">Post</span>
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
        <h1 class="text-2xl font-bold">Master Items</h1>
        <p class="text-sm text-muted-foreground">Kelola Items aplikasi</p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading"
          class="shrink-0" title="Refresh data">
          <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
        </Button>
        <Button v-if="currentMenuId"
          v-permission="{ menuId: currentMenuId, action: 'create' }"
          @click="createNew" class="gap-2 whitespace-nowrap shrink-0">
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
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium">Status:</span>
        <Button variant="outline" size="sm"
          :class="filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
          @click="filterStatus = null">
          All
        </Button>
        <Button variant="outline" size="sm"
          :class="filterStatus === 'Aktif' ? 'bg-green-100 text-green-800 border-green-500 hover:bg-green-200' : ''"
          @click="filterStatus = filterStatus === 'Aktif' ? null : 'Aktif'">
          Aktif
        </Button>
        <Button variant="outline" size="sm"
          :class="filterStatus === 'Nonaktif' ? 'bg-red-100 text-red-800 border-red-500 hover:bg-red-200' : ''"
          @click="filterStatus = filterStatus === 'Nonaktif' ? null : 'Nonaktif'">
          Nonaktif
        </Button>
      </div>

      <!-- Filter Status Approval Row -->
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium">Status Approval:</span>
        <Button variant="outline" size="sm" class="text-xs h-8 whitespace-nowrap"
          :class="filterApprovalStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
          @click="filterApprovalStatus = null">
          All
        </Button>
        <Button variant="outline" size="sm"
          :class="getApprovalStatusFilterClass('DRAFT', filterApprovalStatus === 'DRAFT')"
          @click="filterApprovalStatus = filterApprovalStatus === 'DRAFT' ? null : 'DRAFT'">
          Draft
        </Button>
        <Button variant="outline" size="sm"
          :class="getApprovalStatusFilterClass('POST', filterApprovalStatus === 'POST')"
          @click="filterApprovalStatus = filterApprovalStatus === 'POST' ? null : 'POST'">
          Post
        </Button>
      </div>

      <!-- Search & Action Buttons Row -->
      <div class="flex items-center gap-2 flex-wrap">
        <!-- Search -->
        <div class="flex items-center gap-2 w-1/5 min-w-[200px]">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="searchQuery" placeholder="Search..." class="pl-9 pr-8"
              @keyup.enter="handleApiSearch" :disabled="isSearching" />
            <Button v-if="searchQuery" @click="clearSearch" size="icon" variant="ghost"
              class="absolute right-0 top-1/2 -translate-y-1/2">
              <X class="h-4 w-4" />
            </Button>
          </div>
          <Button @click="handleApiSearch" size="icon" variant="secondary" :disabled="isSearching">
            <Search class="h-4 w-4" />
          </Button>
        </div>

        <!-- Row Action Buttons -->
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Advance Filters -->
          <Button 
            variant="outline" 
            size="default" 
            @click="openAdvanceFilters()" 
            class="gap-2 relative"
            :title="'Advance Filters'">
            <Filter class="h-4 w-4" />
            <span v-if="activeAdvanceFiltersCount > 0" 
              class="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center font-semibold">
              {{ activeAdvanceFiltersCount }}
            </span>
          </Button>

          <!-- View -->
          <Button variant="outline" size="default" :disabled="!isActive" @click="viewItem()" class="gap-2"
            :title="'View'">
            <Eye class="h-4 w-4" />
          </Button>

          <!-- Delete -->
          <Button v-permission="{ menuId: currentMenuId, action: 'delete' }"
            variant="destructive" size="default" class="gap-2"
            :disabled="!canDeleteSelected"
            :title="!canDeleteSelected ? (selectedItems.length > 0 || selectedItem ? 'Item berstatus POST tidak dapat dihapus, hanya bisa dinonaktifkan' : 'Pilih item DRAFT yang akan dihapus') : 'Hapus item'"
            @click="deleteSelected">
            <Trash2 class="h-4 w-4" />
          </Button>

          <!-- Edit -->
          <Button v-permission="{ menuId: currentMenuId, action: 'update' }"
            variant="outline" size="default" class="gap-2"
            :disabled="!isActive || !canEditSelected"
            :title="'Edit'"
            @click="editItem()">
            <Edit class="h-4 w-4" />
          </Button>

          <!-- Copy -->
          <Button v-permission="{ menuId: currentMenuId, action: 'create' }"
            variant="outline" size="default" class="gap-2"
            :disabled="!isActive"
            :title="'Copy'"
            @click="copyItem()">
            <Copy class="h-4 w-4" />
          </Button>

          <!-- QR Code -->
          <Button variant="outline" size="default" class="gap-2"
            :disabled="!isActive"
            :title="'QR Code'"
            @click="openQrDialog()">
            <QrCode class="h-4 w-4" />
          </Button>

          <!-- Kartu Stok (hanya muncul jika item terpilih) -->
          <Button v-if="selectedItem"
            variant="outline" size="default"
            :disabled="!isActive"
            title="Lihat Kartu Stok"
            @click="goToStockCard()">
            <Activity class="h-4 w-4" />
          </Button>

          <!-- Post (hanya muncul jika item terpilih berstatus DRAFT) -->
          <Button v-if="selectedItem?.status?.toUpperCase() === 'DRAFT'"
            variant="default" size="default" class="gap-2"
            :disabled="!isActive"
            :title="selectedItems.length > 0 ? `Export ${selectedItems.length} item terpilih` : 'Post'"
            @click="openPostDialog()">
            <Send class="h-4 w-4" />
          </Button>

          <!-- Bulk Active / Inactive -->
          <Button
            v-if="canUpdate && selectedItems.length > 0"
            variant="outline"
            size="default"
            @click="openStatusDialog(true)"
            class="text-green-600 dark:text-green-400 border-green-200 hover:bg-green-50 dark:hover:bg-green-950 hover:text-green-700"
            title="Aktifkan item terpilih"
          >
            <Check class="h-4 w-4" />
          </Button>

          <Button
            v-if="canUpdate && selectedItems.length > 0"
            variant="outline"
            size="default"
            @click="openStatusDialog(false)"
            class="text-red-600 dark:text-red-400 border-red-200 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-700"
            title="Nonaktifkan item terpilih"
          >
            <X class="h-4 w-4" />
          </Button>

          <!-- Divider -->
          <div class="w-px h-6 bg-border mx-1" />

          <!-- Export -->
          <Button v-if="canCreate || canRead" variant="outline" size="default" @click="handleExport" :disabled="isExporting" class="gap-2"
            :title="selectedItems.length > 0 ? `Export ${selectedItems.length} item terpilih` : 'Export semua data'">
            <FileDown class="h-4 w-4" />
          </Button>

          <!-- Import -->
          <Button v-if="canCreate" variant="outline" size="default" @click="handleImportClick" :disabled="isImporting" class="gap-2"
            :title="selectedItems.length > 0 ? `Import ${selectedItems.length} item terpilih` : 'Import semua data'">
            <FileUp class="h-4 w-4" />
          </Button>
        </div>

        <!-- Selected Items Badge -->
        <Badge v-if="selectedItems.length > 0" variant="secondary" class="text-sm px-3 py-1">
          {{ selectedItems.length }} item dipilih
        </Badge>
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
      :current-page="currentPage"
      :total-pages="totalPages"
      :total-items="totalItems"
      :page-size="pageSize"
      :show-pagination="true"
      :multi-select-mode="true"
      :selected-items="selectedItems"
      :row-select-mode="true"
      :api-filter-mode="true"
      max-height="calc(100vh - 250px)"
      @page-change="handlePageChange"
      @page-size-change="handlePageSizeChange"
      @load-more="handleLoadMore"
      @selection-change="handleSelectionChange"
      @row-select="(item) => selectItem(item, 0)"
      @row-deselect="deselectItem"
      @filter-change="handleTableFilterChange">
      <template #empty>
        Tidak ada data Items
      </template>
    </DataTable>

    <!-- Selection Info -->
    <div v-if="selectedItems.length > 0"
      class="flex items-center justify-between text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg mt-2">
      <span>{{ selectedItems.length }} item dipilih</span>
      <Button variant="ghost" size="sm" @click="clearAllSelection" class="h-7">
        Clear Selection
      </Button>
    </div>

    <!-- Hidden File Input -->
    <input ref="fileInputRef" type="file" accept=".xlsx,.xls" style="display: none"
      @change="handleFileSelected" />
  </div>

  <!-- ================================================================ -->
  <!-- DELETE CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isDeleteDialogOpen"
    title="Hapus Items"
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
  <!-- STATUS CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isStatusDialogOpen"
    :title="statusToChange ? 'Aktifkan Items' : 'Nonaktifkan Items'"
    :description="`Apakah Anda yakin ingin ${statusToChange ? 'mengaktifkan' : 'menonaktifkan'} ${selectedItems.length} item terpilih?`"
    :type="statusToChange ? 'info' : 'warning'"
    :confirm-text="statusToChange ? 'Aktifkan' : 'Nonaktifkan'"
    cancel-text="Batal"
    :is-loading="isUpdatingStatus"
    @confirm="confirmStatusChange"
    @cancel="cancelStatusChange"
    @update:open="isStatusDialogOpen = $event"
  />

  <!-- ================================================================ -->
  <!-- POST CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <Dialog :open="isPostDialogOpen" @update:open="isPostDialogOpen = $event">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <div class="flex items-center gap-3 mb-2">
          <div class="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50">
            <Info class="w-5 h-5 text-blue-600" />
          </div>
          <DialogTitle class="text-lg">Kirim Post</DialogTitle>
        </div>
      </DialogHeader>

      <div class="space-y-4 py-4">
        <div v-if="itemToPost" class="p-3 bg-muted rounded-md text-center">
          <p class="text-sm font-medium">Apakah anda yakin ingin memposting item ini?</p>
          <p class="text-xl font-semibold mt-2 text-primary">{{ itemToPost.nama_item }}</p>
        </div>
      </div>

      <DialogFooter class="gap-2">
        <Button variant="outline" @click="cancelPost" :disabled="isPosting">Batal</Button>
        <Button variant="default" @click="confirmPost" :disabled="isPosting" class="gap-2">
          <span v-if="isPosting">Memposting...</span>
          <span v-else>Post</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- ================================================================ -->
  <!-- QR CODE DIALOG -->
  <!-- ================================================================ -->
  <Dialog :open="isQrDialogOpen" @update:open="isQrDialogOpen = $event">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="text-lg">QR Code Item</DialogTitle>
      </DialogHeader>

      <div class="space-y-4 py-2">
        <div v-if="itemForQr" class="text-center">
          <p class="font-semibold">{{ itemForQr.nama_item || "-" }}</p>
          <p class="text-sm text-muted-foreground font-mono">{{ itemForQr.kode_item || "-" }}</p>
        </div>

        <div class="rounded-md border bg-muted/30 p-3 flex items-center justify-center">
          <img v-if="getQrCodeImageUrl(itemForQr)"
            :src="getQrCodeImageUrl(itemForQr)"
            :alt="`QR ${itemForQr?.kode_item || 'item'}`"
            class="h-64 w-64 object-contain rounded bg-white p-2" />
        </div>
      </div>

      <DialogFooter class="gap-2">
        <Button variant="outline" @click="isQrDialogOpen = false">Tutup</Button>
        <Button class="gap-2" @click="downloadQrImage">
          <Download class="h-4 w-4" />
          Print Barcode
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- ================================================================ -->
  <!-- ADVANCE FILTERS DIALOG -->
  <!-- ================================================================ -->
  <Dialog :open="isAdvanceFiltersOpen" @update:open="isAdvanceFiltersOpen = $event">
    <DialogContent
      class="max-w-2xl max-h-[90vh] overflow-y-auto"
      @interact-outside="(e) => e.preventDefault()"
      @escape-key-down="(e) => e.preventDefault()"
    >
      <DialogHeader>
        <DialogTitle class="text-lg flex items-center gap-2">
          <Filter class="h-5 w-5" />
          Advanced Filters
        </DialogTitle>
        <DialogDescription>
          Filter data items berdasarkan kriteria yang lebih spesifik
        </DialogDescription>
      </DialogHeader>

      <Tabs default-value="basic" class="w-full">
        <TabsList class="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="dates">Dates</TabsTrigger>
          <TabsTrigger value="other">Other</TabsTrigger>
        </TabsList>

        <!-- TAB: Basic Filters -->
        <TabsContent value="basic" class="space-y-4 mt-4">
          <!-- Item Type Filter -->
          <FieldSelect
            id="filter_tipe_id"
            label="Item Type"
            :value="advanceFilters.tipe_id"
            @input="(v: string) => advanceFilters.tipe_id = v"
            :api="{
              url: `${API_BASE_URL}/dynamic/m_general`,
              params: {
                searchfield: 'value1',
                filter_column_group: 'TIPE_ITEM',
                filter_column_is_active: 'true',
                no_pagination: 'true',
              }
            }"
            displayField="value1"
            valueField="id"
            :clearable="true"
            placeholder="Pilih tipe item"
            class="w-full"
          />

          <!-- Item Category Filter -->
          <FieldSelect
            id="filter_kategori_id"
            label="Item Category"
            :value="advanceFilters.kategori_id"
            @input="(v: string) => advanceFilters.kategori_id = v"
            :api="{
              url: `${API_BASE_URL}/dynamic/m_g_category`,
              params: {
                searchfield: 'code,name,catatan',
                filter_column_status: 'POST',
                filter_column_is_active: 'true',
                no_pagination: 'true',
              }
            }"
            displayField="name"
            valueField="id"
            :clearable="true"
            placeholder="Pilih kategori item"
            class="w-full"
          />

          <!-- UOM Filter -->
          <FieldSelect
            id="filter_uom_id"
            label="UOM"
            :value="advanceFilters.uom_id"
            @input="(v: string) => advanceFilters.uom_id = v"
            :api="{
              url: `${API_BASE_URL}/dynamic/m_general`,
              params: {
                searchfield: 'value1',
                filter_column_group: 'UOM',
                filter_column_is_active: 'true',
                no_pagination: 'true',
              }
            }"
            displayField="value1"
            valueField="id"
            :clearable="true"
            placeholder="Pilih satuan"
            class="w-full"
          />
        </TabsContent>

        <!-- TAB: Group Items Filters -->
        <TabsContent value="groups" class="space-y-4 mt-4">
          <!-- Group 1 -->
          <FieldSelect
            id="filter_group1_id"
            label="Group Item 1"
            :value="advanceFilters.group1_id"
            @input="(v: string) => advanceFilters.group1_id = v"
            :api="{
              url: `${API_BASE_URL}/dynamic/m_g1_type`,
              params: {
                searchfield: 'code,name,catatan',
                filter_column_status: 'POST',
                filter_column_is_active: 'true',
                no_pagination: 'true',
              }
            }"
            displayField="name"
            valueField="id"
            :clearable="true"
            placeholder="Pilih group 1"
            class="w-full"
          />

          <!-- Group 2 -->
          <FieldSelect
            id="filter_group2_id"
            label="Group Item 2"
            :value="advanceFilters.group2_id"
            @input="(v: string) => advanceFilters.group2_id = v"
            :api="{
              url: `${API_BASE_URL}/dynamic/m_g2_material`,
              params: {
                searchfield: 'code,name,catatan',
                filter_column_status: 'POST',
                filter_column_is_active: 'true',
                no_pagination: 'true',
              }
            }"
            displayField="name"
            valueField="id"
            :clearable="true"
            placeholder="Pilih group 2"
            class="w-full"
          />

          <!-- Group 3 -->
          <FieldSelect
            id="filter_group3_id"
            label="Group Item 3"
            :value="advanceFilters.group3_id"
            @input="(v: string) => advanceFilters.group3_id = v"
            :api="{
              url: `${API_BASE_URL}/dynamic/m_g3_standard`,
              params: {
                searchfield: 'code,name,catatan',
                filter_column_status: 'POST',
                filter_column_is_active: 'true',
                no_pagination: 'true',
              }
            }"
            displayField="name"
            valueField="id"
            :clearable="true"
            placeholder="Pilih group 3"
            class="w-full"
          />

          <!-- Group 4 -->
          <FieldSelect
            id="filter_group4_id"
            label="Group Item 4"
            :value="advanceFilters.group4_id"
            @input="(v: string) => advanceFilters.group4_id = v"
            :api="{
              url: `${API_BASE_URL}/dynamic/m_g4_subtype`,
              params: {
                searchfield: 'code,name,catatan',
                filter_column_status: 'POST',
                filter_column_is_active: 'true',
                no_pagination: 'true',
              }
            }"
            displayField="name"
            valueField="id"
            :clearable="true"
            placeholder="Pilih group 4"
            class="w-full"
          />

          <!-- Group 5 -->
          <FieldSelect
            id="filter_group5_id"
            label="Group Item 5"
            :value="advanceFilters.group5_id"
            @input="(v: string) => advanceFilters.group5_id = v"
            :api="{
              url: `${API_BASE_URL}/dynamic/m_g5_finishing`,
              params: {
                searchfield: 'code,name,catatan',
                filter_column_status: 'POST',
                filter_column_is_active: 'true',
                no_pagination: 'true',
              }
            }"
            displayField="name"
            valueField="id"
            :clearable="true"
            placeholder="Pilih group 5"
            class="w-full"
          />

          <!-- Group 6 -->
          <FieldSelect
            id="filter_group6_id"
            label="Group Item 6"
            :value="advanceFilters.group6_id"
            @input="(v: string) => advanceFilters.group6_id = v"
            :api="{
              url: `${API_BASE_URL}/dynamic/m_g6_merk`,
              params: {
                searchfield: 'code,name,catatan',
                filter_column_status: 'POST',
                filter_column_is_active: 'true',
                no_pagination: 'true',
              }
            }"
            displayField="name"
            valueField="id"
            :clearable="true"
            placeholder="Pilih group 6"
            class="w-full"
          />
        </TabsContent>

        <!-- TAB: Date Filters -->
        <TabsContent value="dates" class="space-y-4 mt-4">
          <!-- Created Date Range -->
          <div class="space-y-2">
            <label class="text-sm font-medium">Created Date Range</label>
            <div class="grid grid-cols-2 gap-2">
              <FieldDate
                v-model="advanceFilters.created_date_start"
                label="Start Date"
                placeholder="From"
                :clearable="true"
              />
              <FieldDate
                v-model="advanceFilters.created_date_end"
                label="End Date"
                placeholder="To"
                :clearable="true"
              />
            </div>
          </div>

          <!-- Last Updated Date Range -->
          <div class="space-y-2">
            <label class="text-sm font-medium">Last Updated Date Range</label>
            <div class="grid grid-cols-2 gap-2">
              <FieldDate
                v-model="advanceFilters.updated_date_start"
                label="Start Date"
                placeholder="From"
                :clearable="true"
              />
              <FieldDate
                v-model="advanceFilters.updated_date_end"
                label="End Date"
                placeholder="To"
                :clearable="true"
              />
            </div>
          </div>
        </TabsContent>

        <!-- TAB: Other Filters -->
        <TabsContent value="other" class="space-y-4 mt-4">
          <!-- Barcode Available -->
          <FieldSelect
            v-model="advanceFilters.has_barcode"
            label="Barcode Available"
            placeholder="Pilih status barcode"
            :options="[
              { id: '', name: 'All' },
              { id: 'yes', name: 'Yes' },
              { id: 'no', name: 'No' },
            ]"
            display-field="name"
            value-field="id"
            :clearable="true"
          />

          <!-- Company (Multi-Select) -->
          <FieldMultiSelect
            id="filter_company_id"
            label="Company"
            v-model="advanceFilters.filter_company_id"
            :api="{
              url: `${API_BASE_URL}/dynamic/m_company`,
              params: {
                no_pagination: 'true',
                selectfield: 'id,kode,nama',
                searchfield: 'kode,nama',
              }
            }"
            displayField="nama"
            valueField="id"
            placeholder="Pilih satu atau lebih company"
            hints="Filter item berdasarkan company (bisa pilih lebih dari 1)"
            class="w-full"
          />
        </TabsContent>
      </Tabs>

      <DialogFooter class="flex gap-2 sm:justify-between mt-4">
        <Button variant="outline" @click="clearAdvanceFilters" class="gap-2">
          <X class="h-4 w-4" />
          Reset All
        </Button>
        <div class="flex gap-2">
          <Button variant="ghost" @click="isAdvanceFiltersOpen = false">
            Cancel
          </Button>
          <Button @click="applyAdvanceFilters" class="gap-2">
            <Filter class="h-4 w-4" />
            Apply Filters
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
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