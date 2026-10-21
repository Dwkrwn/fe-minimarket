<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, computed, onMounted, onUnmounted, TransitionGroup } from 'vue';
import { useRouter } from 'vue-router';
import { Search, Trash2, FileDown, Edit, Copy, RefreshCw, X, Plus, Info } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import GlobalDialog from '@/components/dialog/GlobalDialog.vue';
import DataTable from '@/components/table/DataTable.vue';
import { DeleteButton, ExportButton, EditButton, CopyButton, ViewButton, PostButton, PrintButton } from '@/components/button';
import { FieldX } from '@/components/field';
import { useActionButtons } from '@/composables/useActionButtons';
import { usePermission } from '@/composables/usePermission';
import { useApi } from '@/composables/useApi';
import { useAuthStore } from '@/stores/auth';
import { getQcList, deleteQc, postQc, type QcItem } from './service';

// ============================================================================
// COMPOSABLES & STORES
// ============================================================================
const router = useRouter();
const { selectedItem, isActive, selectItem, deselectItem, handleEdit, handleDelete, handleCopy } = useActionButtons();
const { currentMenuId, canCreate, canUpdate, canDelete, canPrint, isSuperAdmin } = usePermission();
const { API_BASE_URL } = useApi();
const authStore = useAuthStore();

// ============================================================================
// DELETE DIALOG STATE
// ============================================================================
const isDeleteDialogOpen = ref(false);
const itemToDelete = ref<QcItem | null>(null);
const isDeleting = ref(false);

// Check if selected item has locked status (POST)
const isStatusLocked = computed(() => {
  if (!selectedItem.value) return false;
  const status = selectedItem.value.status?.toUpperCase();
  return status === 'POST';
});

// Check if item can be edited/deleted (has selection AND status is not locked)
// Exception: Super Admin can always edit/delete
const canEditOrDelete = computed(() => {
  if (isSuperAdmin.value) return isActive.value;
  return isActive.value && !isStatusLocked.value;
});

// Helper function to check if specific item has locked status
const isItemStatusLocked = (item: QcItem) => {
  const status = item.status?.toUpperCase();
  return status === 'POST';
};

// Helper function to check if item can be deleted (only DRAFT for non-Super Admin)
const canDeleteItem = (item: QcItem) => {
  if (isSuperAdmin.value) return true;
  const status = item.status?.toUpperCase();
  return status === 'DRAFT';
};

// Helper function to check if item can be edited (only DRAFT for non-Super Admin)
const canEditItem = (item: QcItem) => {
  if (isSuperAdmin.value) return true;
  const status = item.status?.toUpperCase();
  return status === 'DRAFT';
};

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<QcItem[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const hasMoreData = ref(true);

// ============================================================================
// FILTER & SEARCH STATE
// ============================================================================
const filterStatus = ref<'DRAFT' | 'POST' | null>(null);
const searchQuery = ref('');
const searchApiQuery = ref('');
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
const tableWhereClause = ref('');

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const columns = [
  { key: 'no', label: 'No. QC', filterable: true, width: '160px' },
  {
    key: 'date',
    label: 'Tanggal',
    filterable: true,
    filterType: 'date' as const,
    width: '120px',
    renderHtml: (item: QcItem) => {
      return item.date ? new Date(item.date).toLocaleDateString('id-ID') : '-';
    },
  },
  {
    key: 'flag',
    label: 'Flag',
    filterable: true,
    width: '120px',
    renderHtml: (item: QcItem) => {
      return item.flag || '-';
    },
  },
  {
    key: 'ref_table',
    label: 'Tipe Ref',
    filterable: true,
    width: '150px',
    renderHtml: (item: QcItem) => {
      if (item.ref_table === 't_penerimaan_barangs') return 'Penerimaan Barang';
      if (item.ref_table === 't_pres') return 'Production Result';
      if (item.ref_table === 't_wo') return 'Work Order';
      return item.ref_table || '-';
    },
  },
  {
    key: 'm_gudang.nama_gudang',
    label: 'Warehouse',
    filterable: true,
    width: '160px',
    valueGetter: (item: QcItem) => item.m_gudang?.nama_gudang || item.m_gudang?.nama || '',
    renderHtml: (item: QcItem) => {
      return item.m_gudang?.nama_gudang || item.m_gudang?.nama || '-';
    },
  },
  {
    key: 'm_kary.nama_kary',
    label: 'PIC',
    filterable: true,
    width: '160px',
    valueGetter: (item: QcItem) => item.m_kary?.nama_kary || '',
    renderHtml: (item: QcItem) => {
      return item.m_kary?.nama_kary || '-';
    },
  },
  { key: 'notes', label: 'Catatan', filterable: true, width: '220px' },
  {
    key: 'status',
    label: 'Status',
    filterable: true,
    width: '120px',
    renderHtml: (item: QcItem) => {
      const status = item.status || 'DRAFT';
      const badgeClass = getStatusStyle(status);
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${status}</span>`;
    },
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
const getStatusStyle = (status: string) => {
  const statusUpper = (status || '').toUpperCase();
  switch (statusUpper) {
    case 'DRAFT':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    case 'POST':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
};

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================
const filteredData = computed(() => {
  return menuData.value.filter((item) => {
    let matchStatus = true;
    if (filterStatus.value) {
      const itemStatus = (item.status || '').toUpperCase();
      matchStatus = itemStatus === filterStatus.value;
    }

    const colFilters = tableColumnFilters.value;
    const relationParts = Object.entries(colFilters).filter(
        ([key, val]) => key.includes(".") && val?.trim()
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

const canViewAllData = computed(() => {
  if (isSuperAdmin.value) return true;
  const tipeUser = authStore.user?.tipe?.value1?.toUpperCase();
  if (!tipeUser) return false;
  const allowedTypes = ['SUPER ADMIN', 'DEVELOPER', 'ADMIN'];
  return allowedTypes.some((type) => tipeUser.includes(type));
});

const deleteDialogDescription = computed(() => {
  if (!itemToDelete.value) return '';
  return `Apakah Anda yakin ingin menghapus Quality Control "${itemToDelete.value.no || 'tanpa nomor'}"? Tindakan ini tidak dapat dibatalkan.`;
});

// ============================================================================
// NAVIGATION FUNCTIONS
// ============================================================================
const createNew = () => {
  router.push('/production/transaksi/t_qc/form');
};

const editItem = (item?: QcItem) => {
  const target = item || selectedItem.value;
  if (target && ['POST', 'CONFIRM', 'APPROVED', 'IN APPROVAL', 'REJECT'].includes(target.status?.toUpperCase())) {
    toast.error('Akses Ditolak', { description: 'Data dengan status POST tidak dapat diedit.' });
    return;
  }
  if (item) {
    selectItem(item, 0);
  }

  if (!selectedItem.value) {
    toast.error('Pilih item terlebih dahulu');
    return;
  }

  if (!canEditItem(selectedItem.value)) {
    toast.error('Tidak dapat mengedit', {
      description: `Data dengan status ${selectedItem.value.status} tidak dapat diubah`,
    });
    return;
  }

  router.push(`/production/transaksi/t_qc/form/${selectedItem.value.id}`);
};

const copyItem = (item?: QcItem) => {
  if (item) {
    selectItem(item, 0);
  }

  if (!selectedItem.value) {
    toast.error('Pilih item terlebih dahulu');
    return;
  }

  router.push({
    path: '/production/transaksi/t_qc/form',
    query: { copy: selectedItem.value.id },
  });
};

const viewItem = (item?: QcItem) => {
  if (item) {
    selectItem(item, 0);
  }

  if (!selectedItem.value) {
    toast.error('Pilih item terlebih dahulu');
    return;
  }

  router.push(`/production/transaksi/t_qc/view/${selectedItem.value.id}`);
};

const printItem = (item?: QcItem) => {
  const target = item || selectedItem.value;
  if (!target) {
    toast.error('Pilih data Quality Control terlebih dahulu');
    return;
  }
  if (item) {
    selectItem(item, 0);
  }
  router.push({
    name: 'QcPrint',
    params: { id: target.id },
  });
};

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
const deleteSelected = (item?: QcItem) => {
  const target = item || selectedItem.value;
  if (target && ['POST', 'CONFIRM', 'APPROVED', 'IN APPROVAL', 'REJECT'].includes(target.status?.toUpperCase())) {
    toast.error('Akses Ditolak', { description: 'Data dengan status POST tidak dapat dihapus.' });
    return;
  }
  if (item) {
    selectItem(item, 0);
    itemToDelete.value = item;
  } else {
    itemToDelete.value = selectedItem.value;
  }

  if (!itemToDelete.value) {
    toast.error('Pilih item terlebih dahulu');
    return;
  }

  if (!canDeleteItem(itemToDelete.value)) {
    toast.error('Tidak dapat menghapus', {
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
    const response = await deleteQc(itemToDelete.value.id);

    if (response.status === 'success' || response.message) {
      menuData.value = menuData.value.filter((m: QcItem) => m.id !== itemToDelete.value!.id);
      toast.success('Quality Control berhasil dihapus');
      isDeleteDialogOpen.value = false;
      deselectItem();
    } else {
      toast.error('Gagal menghapus Quality Control', {
        description: response.message || 'Terjadi kesalahan saat menghapus data',
      });
    }
  } catch (error) {
    toast.error('Gagal menghapus Quality Control', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
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
const isPostDialogOpen = ref(false);
const itemToPost = ref<QcItem | null>(null);
const isPosting = ref(false);

const postSelected = (item?: QcItem) => {
  if (!canUpdate.value) {
    toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk memposting data' });
    return;
  }
  if (item) selectItem(item, 0);

  const activeItem = item || selectedItem.value;
  if (!activeItem) {
    toast.error('Pilih item terlebih dahulu');
    return;
  }

  if (activeItem.status?.toUpperCase() !== 'DRAFT') {
    toast.error('Akses Ditolak', { description: 'Hanya data DRAFT yang dapat diposting' });
    return;
  }

  itemToPost.value = activeItem;
  isPostDialogOpen.value = true;
};

const confirmPost = async () => {
  if (!itemToPost.value?.id) return;
  isPosting.value = true;
  try {
    const response = await postQc(itemToPost.value.id);
    if (response.status === 'success' || response.message) {
      const index = menuData.value.findIndex((m: QcItem) => m.id === itemToPost.value!.id);
      if (index !== -1) {
        const currentItem = menuData.value[index];
        if (currentItem) {
          menuData.value[index] = { ...currentItem, status: 'POST' };
        }
      }
      toast.success('Quality Control berhasil diposting');
      isPostDialogOpen.value = false;
      deselectItem();
      fetchMenuData(currentPage.value, true);
    } else {
      toast.error('Gagal memposting Quality Control', {
        description: response.message || 'Terjadi kesalahan saat memposting data',
      });
    }
  } catch (e) {
    toast.error('Gagal memposting Quality Control', {
      description: e instanceof Error ? e.message : 'Terjadi kesalahan',
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
// API DATA FETCHING
// ============================================================================
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
  if (page === 1 || resetData) {
    loading.value = true;
  } else {
    loadingMore.value = true;
  }

  try {
    if (resetData) {
      menuData.value = [];
    }

    const colFilters = { ...tableColumnFilters.value };
    let whereClauses: string[] = [];
    if (tableWhereClause.value) whereClauses.push(tableWhereClause.value);

    const finalWhere = whereClauses.length > 0 ? whereClauses.join('|') : undefined;

    const allColumnFilters: Record<string, string> = {};
    Object.entries(colFilters).forEach(([key, value]) => {
      if (value?.trim()) {
        allColumnFilters[key] = value.trim();
      }
    });

    const globalSearchFields = [
      "no",
      "notes",
      "flag",
      "ref_table",
      "$m_gudang.nama_gudang$",
      "$m_kary.nama_kary$"
    ].join(",");

    let effectiveSearch = searchApiQuery.value || undefined;
    let effectiveSearchFields = searchApiQuery.value ? globalSearchFields : undefined;

    const response = await getQcList(
      page, 
      pageSize.value, 
      'createdAt', 
      'DESC', 
      effectiveSearch, 
      effectiveSearchFields, 
      Object.keys(allColumnFilters).length > 0 ? allColumnFilters : undefined, 
      tableColumnFilterOperators.value,
      finalWhere
    );

    if (response.status === 'success' && response.data) {
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
    toast.error('Gagal memuat data Quality Control', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
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
    toast.success('Pencarian selesai', {
      description: `Ditemukan ${menuData.value.length} hasil`,
    });
  }

  isSearching.value = false;
};

const clearSearch = async () => {
  searchQuery.value = '';
  searchApiQuery.value = '';
  await handleApiSearch();
};

let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const handleTableFilterChange = (filters: { column: Record<string, string>; operator: Record<string, string>; dateRange: Record<string, { from: string; to: string }>; where: string }) => {
  tableColumnFilters.value = filters.column;
  tableColumnFilterOperators.value = filters.operator;
  tableDateRangeFilters.value = filters.dateRange;
  tableWhereClause.value = filters.where;

  if (filterDebounceTimer) {
    clearTimeout(filterDebounceTimer);
  }

  filterDebounceTimer = setTimeout(async () => {
    menuData.value = [];
    currentPage.value = 1;
    hasMoreData.value = true;

    await fetchMenuData(1, true);
  }, 500);
};

const handleRefresh = async () => {
  searchQuery.value = '';
  searchApiQuery.value = '';
  tableColumnFilters.value = {};
  tableColumnFilterOperators.value = {};
  tableDateRangeFilters.value = {};
  tableWhereClause.value = '';
  menuData.value = [];
  currentPage.value = 1;
  hasMoreData.value = true;
  deselectItem();

  await fetchMenuData(1, true);
  toast.success('Data berhasil dimuat ulang');
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
  window.addEventListener('scroll', handleWindowScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleWindowScroll);
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
            <h1 class="text-lg font-bold">Transaksi Quality Control</h1>
            <p class="text-xs text-muted-foreground">Kelola data Quality Control</p>
          </div>
          <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading" class="h-8 w-8">
            <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
          </Button>
        </div>

        <!-- Filter Status Buttons -->
        <div class="flex items-center gap-2 overflow-x-auto">
          <Button variant="outline" size="sm" class="text-xs h-7 whitespace-nowrap" :class="filterStatus === 'DRAFT' ? 'border-gray-500 bg-gray-100 text-gray-800' : ''" @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'">
            DRAFT
          </Button>
          <Button variant="outline" size="sm" class="text-xs h-7 whitespace-nowrap" :class="filterStatus === 'POST' ? 'border-green-500 bg-green-100 text-green-800' : ''" @click="filterStatus = filterStatus === 'POST' ? null : 'POST'">
            POST
          </Button>
        </div>

        <!-- Search Input -->
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Search..." class="pl-9 pr-8 h-8 text-sm" @keyup.enter="handleApiSearch" :disabled="isSearching" />
          <Button v-if="searchQuery" @click="clearSearch" size="icon" variant="ghost" class="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8">
            <X class="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>

    <!-- MOBILE CARDS LIST -->
    <div class="p-4 space-y-3">
      <div v-if="loading && menuData.length === 0" class="space-y-3">
        <Card v-for="i in 3" :key="`skeleton-${i}`">
          <CardContent class="pt-4 space-y-2">
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-3 w-1/2" />
          </CardContent>
        </Card>
      </div>

      <div v-else-if="filteredData.length === 0" class="text-center py-8 text-muted-foreground">
        <p class="text-sm">Tidak ada data Quality Control</p>
      </div>

      <TransitionGroup name="list" tag="div" class="space-y-3">
        <Card v-for="item in filteredData" :key="item.id" :class="selectedItem?.id === item.id ? 'ring-2 ring-primary' : ''" class="cursor-pointer" @click="selectItem(item, 0)">
          <CardContent class="p-4 space-y-2">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-semibold text-sm">{{ item.no || 'Tanpa Nomor' }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ item.date ? new Date(item.date).toLocaleDateString('id-ID') : '-' }}
                </p>
              </div>
              <Badge :class="getStatusStyle(item.status || 'DRAFT')" class="text-xs shrink-0">
                {{ item.status || 'DRAFT' }}
              </Badge>
            </div>

            <div class="text-xs space-y-1 text-muted-foreground">
              <div><span class="font-medium">Flag:</span> {{ item.flag || '-' }}</div>
              <div><span class="font-medium">Tipe Ref:</span> {{ item.ref_table === 't_penerimaan_barangs' ? 'Penerimaan Barang' : item.ref_table === 't_pres' ? 'Production Result' : item.ref_table === 't_wo' ? 'Work Order' : item.ref_table || '-' }}</div>
              <div><span class="font-medium">Warehouse:</span> {{ item.m_gudang?.nama_gudang || '-' }}</div>
              <div><span class="font-medium">PIC:</span> {{ item.m_kary?.nama_kary || '-' }}</div>
              <div v-if="item.notes" class="truncate"><span class="font-medium">Catatan:</span> {{ item.notes }}</div>
            </div>

            <div class="flex items-center gap-1 justify-end pt-2 border-t">
              <ViewButton variant="ghost" size="sm" class="h-7 w-7" @click.stop="viewItem(item)" />
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
              <EditButton v-permission="{ menuId: currentMenuId, action: 'update' }" variant="ghost" size="sm" class="h-7 w-7" :status="item.status" :disabled="!canEditItem(item)" @click.stop="editItem(item)" />
              <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }" variant="ghost" size="sm" class="h-7 w-7" @click.stop="copyItem(item)" />
              <PrintButton v-permission="{ menuId: currentMenuId, action: 'print' }" variant="ghost" size="sm" class="h-7 w-7" @click.stop="printItem(item)" />
              <PostButton v-permission="{ menuId: currentMenuId, action: 'update' }" variant="ghost" size="sm" class="h-7 w-7" :showLabel="false" :disabled="item.status?.toUpperCase() !== 'DRAFT'" @click.stop="() => postSelected(item)" />
            </div>
          </CardContent>
        </Card>
      </TransitionGroup>

      <div v-if="loadingMore" class="space-y-3 mt-3">
        <Card v-for="i in 2" :key="`skeleton-more-${i}`">
          <CardContent class="pt-3 space-y-2">
            <Skeleton class="h-4 w-3/4" />
            <Skeleton class="h-3 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>

    <teleport to="body">
      <Button v-permission="{ menuId: currentMenuId, action: 'create' }" @click="createNew" class="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-6 lg:hidden h-14 w-14 rounded-full shadow-lg z-50" size="icon">
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
        <h1 class="text-2xl font-bold">Transaksi Quality Control</h1>
        <p class="text-sm text-muted-foreground">Kelola data Quality Control</p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading" class="shrink-0" title="Refresh data">
          <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
        </Button>
        <Button v-if="currentMenuId" v-permission="{ menuId: currentMenuId, action: 'create' }" @click="createNew" class="gap-2 whitespace-nowrap shrink-0"> Create New </Button>
        <Button v-else @click="createNew" class="gap-2 whitespace-nowrap shrink-0"> Create New </Button>
      </div>
    </div>

    <!-- FILTER BAR -->
    <div class="flex flex-col gap-3 bg-muted/50 p-4 rounded-lg">
      <!-- Filter Status Row -->
      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-sm font-medium">Status:</span>
        <Button variant="outline" size="sm" :class="filterStatus === 'DRAFT' ? 'border-gray-500 bg-gray-100 text-gray-800' : ''" @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'"> DRAFT </Button>
        <Button variant="outline" size="sm" :class="filterStatus === 'POST' ? 'border-green-500 bg-green-100 text-green-800' : ''" @click="filterStatus = filterStatus === 'POST' ? null : 'POST'"> POST </Button>
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
          <DeleteButton v-permission="{ menuId: currentMenuId, action: 'delete' }" :status="selectedItem?.status" :disabled="!canEditOrDelete" @click="() => deleteSelected()" />
          <ViewButton :disabled="!isActive" @click="viewItem()" />
          <EditButton v-permission="{ menuId: currentMenuId, action: 'update' }" :status="selectedItem?.status" :disabled="!canEditOrDelete" @click="editItem()" />
          <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }" :disabled="!isActive" @click="copyItem()" />
          <PrintButton v-permission="{ menuId: currentMenuId, action: 'print' }" :disabled="!isActive" @click="printItem()" />
          <PostButton v-permission="{ menuId: currentMenuId, action: 'update' }" :disabled="!isActive || (selectedItem && selectedItem.status?.toUpperCase() !== 'DRAFT')" @click="() => postSelected()" />
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
      @load-more="handleLoadMore"
      @row-select="(item) => selectItem(item, 0)"
      @row-deselect="deselectItem"
      @filter-change="handleTableFilterChange"
    >
      <template #empty> Tidak ada data Quality Control </template>
    </DataTable>
  </div>

  <!-- ================================================================ -->
  <!-- DELETE CONFIRMATION DIALOG -->
  <!-- ================================================================ -->
  <GlobalDialog
    :open="isDeleteDialogOpen"
    title="Hapus Quality Control"
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
    title="POST Quality Control"
    :description="`Apakah Anda yakin ingin POST Quality Control &quot;${itemToPost?.no || 'tanpa nomor'}&quot;? Setelah di-POST, data tidak bisa diedit atau dihapus lagi.`"
    type="warning"
    confirm-text="POST"
    cancel-text="Batal"
    :is-loading="isPosting"
    @confirm="confirmPost"
    @cancel="cancelPost"
    @update:open="isPostDialogOpen = $event"
  />
</template>
