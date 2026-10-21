<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, computed, onMounted, onUnmounted, TransitionGroup } from "vue";
import { useRouter } from "vue-router";
import { Search, RefreshCw, X, Plus, Trash2 } from "lucide-vue-next";
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
  EditButton,
  CopyButton,
  ViewButton,
  PostButton,
} from "@/components/button";
import { useActionButtons } from "@/composables/useActionButtons";
import { usePermission } from "@/composables/usePermission";
import {
  getBiayaKirimSubconList,
  deleteBiayaKirimSubcon,
  postBiayaKirimSubcon,
  type BiayaKirimSubconItem,
} from "./service";
import { getApprovalStatusBadgeClass, getApprovalStatusFilterClass } from "@/lib/approvalStatus";

const router = useRouter();
const { selectedItem, isActive, selectItem, deselectItem } = useActionButtons();
const { currentMenuId, canCreate, canUpdate, canDelete } = usePermission();

// DELETE DIALOG STATE
const isDeleteDialogOpen = ref(false);
const itemToDelete = ref<BiayaKirimSubconItem | null>(null);
const isDeleting = ref(false);

const canDeleteItem = (item: BiayaKirimSubconItem) => {
  const status = item.status?.toUpperCase();
  return status !== "POST";
};

// BULK DELETE STATE
const selectedRows = ref<BiayaKirimSubconItem[]>([]);
const isBulkDeleteDialogOpen = ref(false);
const isBulkDeleting = ref(false);

const bulkDeletableItems = computed(() =>
  selectedRows.value.filter((item) => canDeleteItem(item)),
);

// Tombol bulk delete hanya muncul jika > 1 item non-POST terselect
const showBulkDeleteButton = computed(() =>
  selectedRows.value.filter((i) => i.status?.toUpperCase() !== "POST").length > 1,
);

const bulkDeleteDialogDescription = computed(() => {
  const count = bulkDeletableItems.value.length;
  const skipped = selectedRows.value.length - count;
  let desc = `Apakah Anda yakin ingin menghapus ${count} Biaya Kirim Subcon yang dipilih? Tindakan ini tidak dapat dibatalkan.`;
  if (skipped > 0) {
    desc += ` (${skipped} item dengan status POST akan dilewati)`;
  }
  return desc;
});

const selectionAnchor = ref<BiayaKirimSubconItem | null>(null);

const isDraftStatus = (item?: BiayaKirimSubconItem | null) =>
  (item?.status || "").toUpperCase() === "DRAFT";

const handleSelectionChange = (items: BiayaKirimSubconItem[]) => {
  if (items.length === 0) {
    selectionAnchor.value = null;
    selectedRows.value = [];
    deselectItem();
    return;
  }

  const firstItem = items[0];
  if (!firstItem) return;
  const prevAnchor = selectionAnchor.value;
  const anchor: BiayaKirimSubconItem =
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

const openBulkDeleteDialog = () => {
  if (bulkDeletableItems.value.length === 0) {
    toast.error("Tidak ada item yang dapat dihapus", {
      description: "Item dengan status POST tidak dapat dihapus",
    });
    return;
  }
  isBulkDeleteDialogOpen.value = true;
};

const confirmBulkDelete = async () => {
  if (bulkDeletableItems.value.length === 0) return;

  isBulkDeleting.value = true;
  const toDelete = [...bulkDeletableItems.value];
  const errors: string[] = [];

  for (const item of toDelete) {
    try {
      const response = await deleteBiayaKirimSubcon(item.id);
      if (response.status === "success") {
        menuData.value = menuData.value.filter((m) => m.id !== item.id);
      } else {
        errors.push(item.no_biaya_kirim_subcon || item.id);
      }
    } catch {
      errors.push(item.no_biaya_kirim_subcon || item.id);
    }
  }

  isBulkDeleting.value = false;
  isBulkDeleteDialogOpen.value = false;
  selectedRows.value = [];
  deselectItem();

  if (errors.length === 0) {
    toast.success(`${toDelete.length} item berhasil dihapus`);
  } else {
    toast.warning("Beberapa item gagal dihapus", {
      description: `Gagal: ${errors.join(", ")}`,
    });
  }
};

const cancelBulkDelete = () => {
  isBulkDeleteDialogOpen.value = false;
};

// POST DIALOG STATE
const isPostDialogOpen = ref(false);
const itemToPost = ref<BiayaKirimSubconItem | null>(null);
const isPosting = ref(false);

const canEditItem = (item: BiayaKirimSubconItem) => {
  const status = item.status?.toUpperCase();
  return status !== "POST";
};

const canEditOrDelete = computed(() => {
  if (!selectedItem.value) return false;
  return isActive.value && selectedItem.value.status?.toUpperCase() !== "POST";
});

// DATA & API STATE
const menuData = ref<BiayaKirimSubconItem[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const hasMoreData = ref(true);

interface ColumnFilters { [key: string]: string; }
interface ColumnFilterOperators { [key: string]: string; }
interface DateRangeFilter { from: string; to: string; }
interface DateRangeFilters { [key: string]: DateRangeFilter; }
const tableColumnFilters = ref<ColumnFilters>({});
const tableColumnFilterOperators = ref<ColumnFilterOperators>({});
const tableDateRangeFilters = ref<DateRangeFilters>({});

const filterStatus = ref<"DRAFT" | "POST" | null>(null);
const searchQuery = ref("");
const searchApiQuery = ref("");
const isSearching = ref(false);

const getUnitBisnisName = (item: any) => {
  return item.m_unit_bisni?.nama_comp || item.m_unit_bisni?.nama || item.unit_bisnis || "-";
};

const getEkspedisiName = (item: any) => {
  return item.m_ekspedisi?.nama || item.ekspedisi?.nama || item.nama_ekspedisi || "-";
};

const formatCurrency = (value: any) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";
  return num.toLocaleString("id-ID");
};

const columns = [
  { key: "m_unit_bisnis", label: "Unit Bisnis", filterable: true, width: "170px", render: (item: BiayaKirimSubconItem) => getUnitBisnisName(item) },
  { key: "no_biaya_kirim_subcon", label: "No. Biaya Subcon", filterable: true, width: "170px" },
  { key: "tgl_biaya_kirim_subcon", label: "Tgl BS", filterable: true, filterType: "date" as const, width: "140px",
    renderHtml: (item: BiayaKirimSubconItem) => item.tgl_biaya_kirim_subcon ? new Date(item.tgl_biaya_kirim_subcon).toLocaleDateString("id-ID") : "-" },
  { key: "m_ekspedisi", label: "Ekspedisi", filterable: true, width: "180px", render: (item: BiayaKirimSubconItem) => getEkspedisiName(item) },
  { key: "grand_total", label: "Grand Total", filterable: false, width: "160px", align: "right" as const, render: (item: BiayaKirimSubconItem) => formatCurrency((item as any).grand_total) },
  { key: "total_berat", label: "Total (KG)", filterable: false, width: "120px", align: "right" as const, render: (item: BiayaKirimSubconItem) => formatCurrency((item as any).total_berat) },
  { key: "catatan", label: "Catatan", filterable: true, width: "250px" },
  { key: "status", label: "Status", filterable: true, width: "140px",
    renderHtml: (item: BiayaKirimSubconItem) => {
      const status = item.status || "DRAFT";
      const badgeClass = getStatusStyle(status);
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${status}</span>`;
    }
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/** Get status badge styling */
const getStatusStyle = getApprovalStatusBadgeClass;

const filteredData = computed(() => {
  if (!filterStatus.value) return menuData.value;
  return menuData.value.filter((item) => (item.status || "").toUpperCase() === filterStatus.value);
});

const deleteDialogDescription = computed(() => {
  if (!itemToDelete.value) return "";
  return `Apakah Anda yakin ingin menghapus Biaya Kirim Subcon "${itemToDelete.value.no_biaya_kirim_subcon || "tanpa nomor"}"? Tindakan ini tidak dapat dibatalkan.`;
});

const postDialogDescription = computed(() => {
  if (!itemToPost.value) return "";
  return `Apakah Anda yakin ingin memposting Biaya Kirim Subcon "${itemToPost.value.no_biaya_kirim_subcon || "tanpa nomor"}"? Setelah diposting, data tidak dapat diubah atau dihapus.`;
});

const createNew = () => { router.push("/purchasing/subcon/t_biaya_kirim_subcon/form"); };

const editItem = (item?: BiayaKirimSubconItem) => {
  if (item) selectItem(item, 0);
  if (!selectedItem.value) { toast.error("Pilih item terlebih dahulu"); return; }
  if (!canEditItem(selectedItem.value)) {
    toast.error("Tidak dapat mengedit", { description: `Data dengan status ${selectedItem.value.status} tidak dapat diubah` });
    return;
  }
  router.push(`/purchasing/subcon/t_biaya_kirim_subcon/form/${selectedItem.value.id}`);
};

const copyItem = (item?: BiayaKirimSubconItem) => {
  if (item) selectItem(item, 0);
  if (!selectedItem.value) { toast.error("Pilih item terlebih dahulu"); return; }
  router.push({ path: "/purchasing/subcon/t_biaya_kirim_subcon/form", query: { action: "copy", source: selectedItem.value.id } });
};

const viewItem = (item?: any) => {
  if (item) selectItem(item, 0);
  if (!selectedItem.value) { toast.error("Pilih item terlebih dahulu"); return; }
  router.push(`/purchasing/subcon/t_biaya_kirim_subcon/view/${selectedItem.value.id}`);
};

const deleteSelected = (item?: BiayaKirimSubconItem) => {
  if (item) { selectItem(item, 0); itemToDelete.value = item; } else { itemToDelete.value = selectedItem.value; }
  if (!itemToDelete.value) { toast.error("Pilih item terlebih dahulu"); return; }
  if (!canDeleteItem(itemToDelete.value)) {
    toast.error("Tidak dapat menghapus", { description: `Data dengan status ${itemToDelete.value.status} tidak dapat dihapus` });
    itemToDelete.value = null;
    return;
  }
  isDeleteDialogOpen.value = true;
};

const confirmDelete = async () => {
  if (!itemToDelete.value?.id) return;
  isDeleting.value = true;
  try {
    const response = await deleteBiayaKirimSubcon(itemToDelete.value.id);
    if (response.status === "success") {
      menuData.value = menuData.value.filter((m: BiayaKirimSubconItem) => m.id !== itemToDelete.value!.id);
      toast.success("Biaya Kirim Subcon berhasil dihapus");
      isDeleteDialogOpen.value = false;
      deselectItem();
    } else {
      toast.error("Gagal menghapus Biaya Kirim Subcon", { description: response.message || "Terjadi kesalahan saat menghapus" });
    }
  } catch (error) {
    toast.error("Gagal menghapus Biaya Kirim Subcon", { description: error instanceof Error ? error.message : "Terjadi kesalahan" });
  } finally {
    isDeleting.value = false;
    itemToDelete.value = null;
  }
};

const cancelDelete = () => { isDeleteDialogOpen.value = false; itemToDelete.value = null; };

const postSelected = (item?: BiayaKirimSubconItem) => {
  if (!canUpdate.value) { toast.error("Akses Ditolak", { description: "Anda tidak memiliki izin untuk memposting data" }); return; }
  if (item) selectItem(item, 0);
  if (!selectedItem.value) { toast.error("Pilih item terlebih dahulu"); return; }
  if (selectedItem.value.status?.toUpperCase() === "POST") {
    toast.error("Item sudah di-POST", { description: "Data yang sudah POST tidak bisa diubah lagi" });
    return;
  }
  itemToPost.value = selectedItem.value;
  isPostDialogOpen.value = true;
};

const confirmPost = async () => {
  if (!itemToPost.value?.id) return;
  isPosting.value = true;
  try {
    const response = await postBiayaKirimSubcon(itemToPost.value.id);
    if (response.status !== "success") throw new Error("Gagal memposting data");
    const itemIndex = menuData.value.findIndex((m: BiayaKirimSubconItem) => m.id === itemToPost.value!.id);
    if (itemIndex !== -1) {
      const updatedItem = { ...menuData.value[itemIndex], status: response.data?.status || "POST" } as BiayaKirimSubconItem;
      menuData.value.splice(itemIndex, 1, updatedItem);
    }
    toast.success("Biaya Kirim Subcon berhasil di-POST", { description: "Data tidak bisa diedit atau dihapus lagi" });
    isPostDialogOpen.value = false;
    deselectItem();
  } catch (error) {
    toast.error("Gagal POST Biaya Kirim Subcon", { description: error instanceof Error ? error.message : "Terjadi kesalahan" });
  } finally {
    isPosting.value = false;
    itemToPost.value = null;
  }
};

const cancelPost = () => { isPostDialogOpen.value = false; itemToPost.value = null; };

const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
  if (page === 1 || resetData) { loading.value = true; } else { loadingMore.value = true; }
  try {
    if (resetData) menuData.value = [];
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
    const response = await getBiayaKirimSubconList(
      page, pageSize.value, "createdAt", "DESC",
      searchApiQuery.value || undefined,
      searchApiQuery.value
        ? "no_biaya_kirim_subcon,catatan,m_unit_bisnis.nama_comp,m_ekspedisi.nama,m_ekspedisi.kode_ekspedisi"
        : undefined,
      whereClause || undefined,
    );
    if (response.status === "success" && response.data) {
      if (page === 1 || resetData) { menuData.value = response.data; } else { menuData.value.push(...response.data); }
      if (response.pagination) { hasMoreData.value = response.pagination.next_page !== null; }
    }
  } catch (error) {
    toast.error("Gagal memuat data Biaya Kirim Subcon", { description: error instanceof Error ? error.message : "Terjadi kesalahan" });
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
};

const handleLoadMore = () => { currentPage.value++; fetchMenuData(currentPage.value); };

const handleApiSearch = async () => {
  if (isSearching.value) return;
  isSearching.value = true;
  searchApiQuery.value = searchQuery.value;
  menuData.value = [];
  currentPage.value = 1;
  hasMoreData.value = true;
  await fetchMenuData(1, true);
  if (searchQuery.value.trim()) toast.success("Pencarian selesai", { description: `Ditemukan ${menuData.value.length} hasil` });
  isSearching.value = false;
};

const clearSearch = async () => { searchQuery.value = ""; searchApiQuery.value = ""; await handleApiSearch(); };

let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const handleTableFilterChange = (filters: { column: Record<string, string>; operator: Record<string, string>; dateRange: Record<string, { from: string; to: string }>; where: string; }) => {
  tableColumnFilters.value = filters.column;
  tableColumnFilterOperators.value = filters.operator;
  tableDateRangeFilters.value = filters.dateRange;
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
  if (docHeight - scrollTop - windowHeight < 100) { currentPage.value++; fetchMenuData(currentPage.value); }
};

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
  <!-- MOBILE VIEW -->
  <div class="lg:hidden flex flex-col min-h-screen pb-28">
    <div class="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
      <div class="p-4 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-lg font-bold">Transaksi Biaya Kirim Subcon</h1>
            <p class="text-xs text-muted-foreground">Kelola data Biaya Kirim Subcon</p>
          </div>
          <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading" class="h-8 w-8">
            <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
          </Button>
        </div>
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
        </div>
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Search..." class="pl-9 pr-8 h-8 text-sm" @keyup.enter="handleApiSearch" :disabled="isSearching" />
          <Button v-if="searchQuery" @click="clearSearch" size="icon" variant="ghost" class="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8">
            <X class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto px-4 pt-3">
      <div v-if="loading && menuData.length === 0" class="space-y-3">
        <Card v-for="i in 3" :key="`skeleton-${i}`"><CardContent class="pt-3 space-y-2"><Skeleton class="h-4 w-3/4" /><Skeleton class="h-3 w-full" /><Skeleton class="h-3 w-2/3" /></CardContent></Card>
      </div>
      <div v-else-if="filteredData.length === 0" class="text-center py-8">
        <p class="text-sm text-muted-foreground">Tidak ada data</p>
      </div>
      <TransitionGroup v-else name="list" tag="div" class="space-y-3">
        <Card v-for="item in filteredData" :key="item.id" class="cursor-pointer hover:shadow-md transition-all" @click="selectItem(item, 0)">
          <CardContent class="pt-3 pb-2 space-y-2">
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm truncate">{{ item.no_biaya_kirim_subcon || "Tanpa Nomor" }}</div>
                <div class="text-xs text-muted-foreground truncate">{{ item.tgl_biaya_kirim_subcon ? new Date(item.tgl_biaya_kirim_subcon).toLocaleDateString("id-ID") : "-" }}</div>
              </div>
              <Badge :class="getStatusStyle(item.status || 'DRAFT')" class="text-xs shrink-0">{{ item.status || "DRAFT" }}</Badge>
            </div>
            <div class="text-xs space-y-1 text-muted-foreground">
              <div v-if="item.catatan" class="truncate"><span class="font-medium">Catatan:</span> {{ item.catatan }}</div>
            </div>
            <div class="flex items-center gap-1 justify-end pt-2 border-t">
              <ViewButton variant="ghost" size="sm" class="h-7 w-7" @click.stop="viewItem(item)" />
              <DeleteButton v-permission="{ menuId: currentMenuId, action: 'delete' }" variant="ghost" size="sm" class="h-7 w-7" 
                :status="item.status"
                :disabled="!canDeleteItem(item)"
                @click.stop="() => { selectItem(item, 0); deleteSelected(); }" />
              <EditButton v-permission="{ menuId: currentMenuId, action: 'update' }" variant="ghost" size="sm" class="h-7 w-7" 
                :status="item.status"
                :disabled="!canEditItem(item)" @click.stop="editItem(item)" />
              <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }" variant="ghost" size="sm" class="h-7 w-7" @click.stop="copyItem(item)" />
              <PostButton variant="ghost" size="sm" :show-label="false" class="h-7 w-7 text-blue-600" :disabled="item.status?.toUpperCase() === 'POST'" @click.stop="postSelected(item)" />
            </div>
          </CardContent>
        </Card>
      </TransitionGroup>
      <div v-if="loadingMore" class="space-y-3 mt-3">
        <Card v-for="i in 2" :key="`skeleton-more-${i}`"><CardContent class="pt-3 space-y-2"><Skeleton class="h-4 w-3/4" /><Skeleton class="h-3 w-full" /></CardContent></Card>
      </div>
    </div>
    <teleport to="body">
      <Button v-permission="{ menuId: currentMenuId, action: 'create' }" @click="createNew"
        class="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-6 lg:hidden h-14 w-14 rounded-full shadow-lg z-50" size="icon">
        <Plus class="h-6 w-6" />
      </Button>
    </teleport>
  </div>

  <!-- DESKTOP VIEW -->
  <div class="hidden lg:flex lg:flex-col lg:gap-4 lg:p-6">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-bold">Transaksi Biaya Kirim Subcon</h1>
        <p class="text-sm text-muted-foreground">Kelola data Biaya Kirim Subcon</p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading" class="shrink-0" title="Refresh data">
          <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
        </Button>
        <Button v-if="currentMenuId" v-permission="{ menuId: currentMenuId, action: 'create' }" @click="createNew" class="gap-2 whitespace-nowrap shrink-0">Create New</Button>
        <Button v-else @click="createNew" class="gap-2 whitespace-nowrap shrink-0">Create New</Button>
      </div>
    </div>
    <div class="flex flex-col gap-3 bg-muted/50 p-4 rounded-lg">
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
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2 w-1/5">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="searchQuery" placeholder="Search..." class="pl-9 pr-8" @keyup.enter="handleApiSearch" :disabled="isSearching" />
            <Button v-if="searchQuery" @click="clearSearch" size="icon" variant="ghost" class="absolute right-0 top-1/2 -translate-y-1/2"><X class="h-4 w-4" /></Button>
          </div>
          <Button @click="handleApiSearch" size="icon" variant="secondary" :disabled="isSearching"><Search class="h-4 w-4" /></Button>
        </div>
        <div class="flex items-center gap-2">
          <!-- Bulk Delete Button - hanya muncul jika > 1 item non-POST terselect -->
          <Button v-if="showBulkDeleteButton" v-permission="{ menuId: currentMenuId, action: 'delete' }"
            variant="destructive" size="sm" class="gap-2 whitespace-nowrap" :disabled="isBulkDeleting" @click="openBulkDeleteDialog">
            <Trash2 class="h-4 w-4" />
            Bulk Delete ({{ bulkDeletableItems.length }})
          </Button>
          <DeleteButton v-permission="{ menuId: currentMenuId, action: 'delete' }" 
            :status="selectedItem?.status"
            :disabled="!canEditOrDelete" @click="deleteSelected()" />
          <ViewButton :disabled="!isActive" @click="viewItem()" />
          <EditButton v-permission="{ menuId: currentMenuId, action: 'update' }" 
            :status="selectedItem?.status"
            :disabled="!canEditOrDelete" @click="editItem()" />
          <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }" :disabled="!isActive" @click="copyItem()" />
          <PostButton variant="default" size="default" :disabled="!isActive || selectedItem?.status?.toUpperCase() === 'POST'" @click="postSelected()" />
        </div>
      </div>
    </div>
    <DataTable :data="filteredData" :columns="columns" :loading="loading" :loading-more="loadingMore" :has-more="hasMoreData"
      :row-select-mode="true" :multi-select-mode="true" :selected-items="selectedRows" :api-filter-mode="true"
      @load-more="handleLoadMore" @row-select="(item) => selectItem(item, 0)" @row-deselect="deselectItem"
      @filter-change="handleTableFilterChange" @selection-change="handleSelectionChange">
      <template #empty>Tidak ada data Biaya Kirim Subcon</template>
    </DataTable>
  </div>

  <GlobalDialog :open="isDeleteDialogOpen" title="Hapus Biaya Kirim Subcon" :description="deleteDialogDescription"
    type="danger" confirm-text="Hapus" cancel-text="Batal" :is-loading="isDeleting"
    @confirm="confirmDelete" @cancel="cancelDelete" @update:open="isDeleteDialogOpen = $event" />

  <GlobalDialog :open="isPostDialogOpen" title="Post Biaya Kirim Subcon" :description="postDialogDescription"
    type="warning" confirm-text="Post" cancel-text="Batal" :is-loading="isPosting"
    @confirm="confirmPost" @cancel="cancelPost" @update:open="isPostDialogOpen = $event" />

  <GlobalDialog :open="isBulkDeleteDialogOpen" title="Hapus Biaya Kirim Subcon" :description="bulkDeleteDialogDescription"
    type="danger" confirm-text="Hapus Semua" cancel-text="Batal" :is-loading="isBulkDeleting"
    @confirm="confirmBulkDelete" @cancel="cancelBulkDelete" @update:open="isBulkDeleteDialogOpen = $event" />
</template>

<style scoped>
.list-move { transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
.list-enter-active { transition: all 0.4s ease-out; }
.list-leave-active { transition: all 0.3s ease-in; position: absolute; }
.list-enter-from { opacity: 0; transform: translateY(20px); }
.list-leave-to { opacity: 0; transform: translateY(-20px); }
</style>