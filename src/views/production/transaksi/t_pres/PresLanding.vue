<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, computed, onMounted, onUnmounted, TransitionGroup } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Trash2, FileDown, Edit, Copy, RefreshCw, X, Plus } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import DataTable from '@/components/table/DataTable.vue'
import { DeleteButton, ExportButton, EditButton, CopyButton, ViewButton, PostButton } from '@/components/button'
import { useActionButtons } from '@/composables/useActionButtons'
import { usePermission } from '@/composables/usePermission'
import { getApprovalStatusBadgeClass, getApprovalStatusFilterClass } from '@/lib/approvalStatus'
import { getPresList, deletePres, postPres, getPresById, type PresItem } from './service'

// ============================================================================
// COMPOSABLES & STORES
// ============================================================================
const router = useRouter()
const { selectedItem, isActive, selectItem, deselectItem, handleEdit, handleDelete, handleCopy } = useActionButtons()
const { currentMenuId, canCreate, canUpdate, canDelete, canPrint, isSuperAdmin } = usePermission()

// ============================================================================
// DELETE DIALOG STATE
// ============================================================================
const isDeleteDialogOpen = ref(false)
const itemToDelete = ref<PresItem | null>(null)
const isDeleting = ref(false)

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<PresItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const hasMoreData = ref(true)

// ============================================================================
// FILTER & SEARCH STATE
// ============================================================================
const filterStatus = ref<'Draft' | 'Post' | null>(null)

// ============================================================================
// STATUS STYLE HELPER
// ============================================================================
const getStatusStyle = (status: string) => {
  const statusUpper = (status || '').toUpperCase()
  switch (statusUpper) {
    case 'DRAFT':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    case 'POST':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
    case 'IN APPROVAL':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
    case 'APPROVED':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'REJECT':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    case 'REVISI':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
  }
}
const searchQuery = ref('')
const searchApiQuery = ref('') // Untuk API search
const isSearching = ref(false)

// Column filters for API-based filtering
interface ColumnFilters { [key: string]: string }
interface ColumnFilterOperators { [key: string]: string }
interface DateRangeFilter { from: string; to: string }
interface DateRangeFilters { [key: string]: DateRangeFilter }
const tableColumnFilters = ref<ColumnFilters>({})
const tableColumnFilterOperators = ref<ColumnFilterOperators>({})
const tableDateRangeFilters = ref<DateRangeFilters>({})
const tableWhereClause = ref('')

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const columns = [
    { 
        key: 'no', 
        label: 'No. Prod. Result', 
        filterable: true, 
        width: '180px',
        renderHtml: (item: PresItem) => item.no || item.group || '-'
    },
    { 
        key: 'date', 
        label: 'Tanggal', 
        filterable: true, 
        filterType: 'date' as const,
        width: '130px',
        renderHtml: (item: PresItem) => item.date 
            ? new Date(item.date).toLocaleDateString('id-ID') 
            : (item.key1 ? new Date(item.key1).toLocaleDateString('id-ID') : '-')
    },
    { 
        key: 't_wo.no', 
        label: 'No. SPK', 
        filterable: true, 
        width: '160px',
        valueGetter: (item: PresItem) => item.t_wo?.no || item.no_spk || item.code || '',
        renderHtml: (item: PresItem) => item.t_wo?.no || item.no_spk || item.code || '-'
    },
    { 
        key: 'm_gudang.nama_gudang', 
        label: 'Warehouse', 
        filterable: true, 
        width: '150px',
        valueGetter: (item: PresItem) => item.m_gudang?.nama_gudang || item.warehouse || item.value2 || '',
        renderHtml: (item: PresItem) => item.m_gudang?.nama_gudang || item.warehouse || item.value2 || '-'
    },
    { 
        key: 'notes', 
        label: 'Catatan', 
        filterable: true, 
        width: '200px',
        renderHtml: (item: PresItem) => item.notes || item.catatan || item.value3 || '-'
    },
    {
        key: 'status',
        label: 'Status',
        filterable: false,
        width: '120px',
        renderHtml: (item: PresItem) => {
            const status = item.status || 'DRAFT'
            let badgeColor = 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
            
            if (status.toUpperCase() === 'APPROVED' || status.toUpperCase() === 'POST') {
                badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900'
            } else if (status.toUpperCase() === 'IN APPROVAL') {
                badgeColor = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900'
            } else if (status.toUpperCase() === 'REJECT') {
                badgeColor = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900'
            } else if (status.toUpperCase() === 'REVISI') {
                badgeColor = 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-900'
            }
            
            return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeColor}">${status}</span>`
        }
    }
]

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================
/** Filter t_pres data berdasarkan status and relations (search handled by API) */
const filteredData = computed(() => {
    return menuData.value.filter((item: PresItem) => {
        const matchStatus = filterStatus.value === null
            ? true
            : item.status?.toUpperCase() === filterStatus.value.toUpperCase()

        // Client-side fallback for relational columns if there are multiple
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

        return matchStatus && matchRelations
    })
})

/** Deskripsi dialog delete */
const deleteDialogDescription = computed(() => {
    if (!itemToDelete.value) return ''
    return `Apakah Anda yakin ingin menghapus Pres dengan No. "${itemToDelete.value.group}"? Tindakan ini tidak dapat dibatalkan.`
})

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
/** Trigger delete dialog */
const deleteSelected = () => {
    const target = selectedItem.value;
    if (target && ['POST', 'CONFIRM', 'APPROVED', 'IN APPROVAL', 'REJECT'].includes(target.status?.toUpperCase())) {
        toast.error('Akses Ditolak', { description: 'Data dengan status POST/CONFIRM/APPROVED tidak dapat dihapus.' });
        return;
    }
    // Check permission
    if (!canDelete.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk menghapus data'
        })
        return
    }
    
    const item = handleDelete()
    if (!item) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    itemToDelete.value = item
    isDeleteDialogOpen.value = true
}

/** Konfirmasi delete - hit API dan update UI */
const confirmDelete = async () => {
    if (!itemToDelete.value) return

    isDeleting.value = true
    try {
        const response = await deletePres(itemToDelete.value.id)

        if (response.status === 'success') {
            // Remove item from list
            menuData.value = menuData.value.filter((m: PresItem) => m.id !== itemToDelete.value!.id)

            toast.success(`Pres "${itemToDelete.value.group}" berhasil dihapus`, {
                description: response.message || 'Item telah dihapus dari database'
            })

            // Clear selection
            deselectItem()
            isDeleteDialogOpen.value = false
        } else {
            toast.error('Gagal menghapus Production Result', {
                description: response.message || 'Terjadi kesalahan saat menghapus'
            })
        }
    } catch (error) {
        toast.error('Gagal menghapus Production Result', {
            description: error instanceof Error ? error.message : 'Terjadi kesalahan'
        })
    } finally {
        isDeleting.value = false
        itemToDelete.value = null
    }
}

const cancelDelete = () => {
    isDeleteDialogOpen.value = false
    itemToDelete.value = null
}

// ============================================================================
// POST FUNCTIONS
// ============================================================================
const isPostDialogOpen = ref(false)
const itemToPost = ref<PresItem | null>(null)
const isPosting = ref(false)

const postSelected = (item?: PresItem) => {
    if (!canUpdate.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk memposting data'
        })
        return
    }

    const targetItem = item || selectedItem.value as PresItem
    if (!targetItem) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    if (targetItem.status === 'POST') {
        toast.error('Item sudah di-POST', {
            description: 'Data yang sudah di-POST tidak bisa diposting lagi'
        })
        return
    }

    itemToPost.value = targetItem
    isPostDialogOpen.value = true
}

const confirmPost = async () => {
    const item = itemToPost.value
    if (!item) return

    isPosting.value = true
    try {
        const response = await postPres(item.id)

        if (response.status === 'success') {
            // Update status in list
            menuData.value = menuData.value.map((m: PresItem) => {
                if (m.id === item.id) {
                    return {
                        ...m,
                        status: 'POST',
                        is_active: true
                    }
                }
                return m
            })

            toast.success(`Production Result "${item.no || item.group || '-'}" berhasil di-POST`, {
                description: 'Data telah dikunci dan tidak dapat diubah lagi.'
            })

            isPostDialogOpen.value = false
            itemToPost.value = null
            deselectItem()
        } else {
            toast.error('Gagal memposting Production Result', {
                description: response.data?.message || 'Terjadi kesalahan saat memposting'
            })
        }
    } catch (error) {
        toast.error('Gagal memposting Production Result', {
            description: error instanceof Error ? error.message : 'Terjadi kesalahan'
        })
    } finally {
        isPosting.value = false
        itemToPost.value = null
    }
}

const cancelPost = () => {
    isPostDialogOpen.value = false
    itemToPost.value = null
}

// ============================================================================
// EXPORT & EDIT FUNCTIONS
// ============================================================================
/** Export t_pres data */
const exportData = () => {
    toast.info('Export feature coming soon')
}

/** View Pres item details */
const viewItem = (item?: any) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    // Navigate to view page (read-only mode)
    router.push(`/production/transaksi/t_pres/view/${selectedItem.value.id}`)
}

/** Edit Production Result item */
const editItem = (item?: any) => {
    const target = item || selectedItem.value;
    if (target && ['POST', 'CONFIRM', 'APPROVED', 'IN APPROVAL', 'REJECT'].includes(target.status?.toUpperCase())) {
        toast.error('Akses Ditolak', { description: 'Data dengan status POST/CONFIRM/APPROVED tidak dapat diedit.' });
        return;
    }
    // Check permission
    if (!canUpdate.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk mengubah data'
        })
        return
    }
    
    if (item) {
        selectItem(item, 0)
    }
    const selectedItemData = handleEdit(item)
    if (!selectedItemData) {
        toast.error('Pilih item terlebih dahulu')
        return
    }
    // Navigate to edit form
    router.push(`/production/transaksi/t_pres/form/${selectedItemData.id}`)
}

/** Copy Pres item - duplicate data tanpa ID untuk create new */
const copyItem = (item?: any) => {
    // Check permission (copy requires create permission)
    if (!canCreate.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk membuat data baru'
        })
        return
    }
    
    if (item) {
        selectItem(item, 0)
    }
    const selectedItemData = handleCopy(item)
    if (!selectedItemData) {
        toast.error('Pilih item terlebih dahulu')
        return
    }
    
    // Navigate ke form create dengan data yang sama (tanpa ID)
    // Query param action=copy akan trigger mode copy di form
    router.push({
        path: '/production/transaksi/t_pres/form',
        query: { 
            action: 'copy',
            source: selectedItemData.id 
        }
    })
    
    toast.success(`Menyalin data "${selectedItemData.name}"`, {
        description: 'Silakan edit dan simpan sebagai Pres baru'
    })
    deselectItem()
}

/** Navigasi ke form create baru */
const createNew = () => {
    // Check permission
    if (!canCreate.value) {
        toast.error('Akses Ditolak', {
            description: 'Anda tidak memiliki izin untuk membuat data baru'
        })
        return
    }
    
    router.push('/production/transaksi/t_pres/form')
}

// ============================================================================
// API & DATA FETCHING FUNCTIONS
// ============================================================================
/** Fetch t_pres data dari API with search support */
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
    if (page === 1 || resetData) {
        loading.value = true
    } else {
        loadingMore.value = true
    }

    try {
        const colFilters = { ...tableColumnFilters.value }
        let whereClauses: string[] = []
        if (tableWhereClause.value) whereClauses.push(tableWhereClause.value)

        const finalWhere = whereClauses.length > 0 ? whereClauses.join('|') : undefined

        // Generate filter_column_* keys for all columns (including relations)
        const allColumnFilters: Record<string, string> = {};
        Object.entries(colFilters).forEach(([key, value]) => {
            if (value?.trim()) {
                // Fix alias if necessary
                let backendField = key;
                if (backendField.startsWith("m_unit_bisni.")) {
                    backendField = backendField.replace("m_unit_bisni.", "m_unit_bisni.");
                }
                allColumnFilters[`filter_column_${backendField}`] = value.trim();
            }
        });

        const globalSearchFields = [
            "no",
            "notes",
            "$t_wo.no$",
            "$m_gudang.nama_gudang$"
        ].join(",");

        let effectiveSearch = searchApiQuery.value || undefined;
        let effectiveSearchFields = searchApiQuery.value ? globalSearchFields : undefined;

        const filterCreatedBy = undefined // pres doesn't have created_by filter yet
        
        // Call API with search parameters
        const response = await getPresList(
            page, 
            pageSize.value, 
            'createdAt', 
            'DESC',
            effectiveSearch,
            effectiveSearchFields,
            filterCreatedBy,
            Object.keys(allColumnFilters).length > 0 ? allColumnFilters : undefined,
            finalWhere
        )
        
        if (response.status === 'success') {
            const mappedData = (response.data || []).map((item: any) => ({
                ...item,
                group: item.no || item.group || '-',
                code: item.t_wo?.no || item.code || '-',
                key1: item.date ? new Date(item.date).toLocaleDateString('id-ID') : (item.key1 || '-'),
                value1: item.t_wo_sd_routing?.m_routing?.nama || item.routing || item.value1 || '-',
                is_active: item.status === 'POST' || item.is_active === true
            }))
            
            if (page === 1 || resetData) {
                menuData.value = mappedData
            } else {
                // Append data untuk infinite scroll
                menuData.value.push(...mappedData)
            }

            // Check if there's more data to load
            if (response.pagination) {
                hasMoreData.value = response.pagination.next_page !== null
            }
        }
    } catch (error) {
        toast.error('Gagal memuat data Pres', {
            description: error instanceof Error ? error.message : 'Terjadi kesalahan'
        })
    } finally {
        loading.value = false
        loadingMore.value = false
    }
}

/** Handle load more triggered dari DataTable infinite scroll */
const handleLoadMore = () => {
    currentPage.value++
    fetchMenuData(currentPage.value)
}

/** Handle API search - triggered by Enter or Search button */
const handleApiSearch = async () => {
    if (isSearching.value) return
    
    isSearching.value = true
    searchApiQuery.value = searchQuery.value
    
    // Reset to page 1 when searching
    menuData.value = []
    currentPage.value = 1
    hasMoreData.value = true
    
    await fetchMenuData(1, true)
    
    if (searchQuery.value.trim()) {
        toast.success('Pencarian selesai', {
            description: `Ditemukan ${menuData.value.length} hasil`
        })
    }
    
    isSearching.value = false
}

/** Clear search and reload all data */
const clearSearch = async () => {
    searchQuery.value = ''
    searchApiQuery.value = ''
    await handleApiSearch()
}

/** Handle table filter change from DataTable */
let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null
const handleTableFilterChange = (filters: { 
    column: Record<string, string>
    operator: Record<string, string>
    dateRange: Record<string, { from: string, to: string }>
    where: string
}) => {
    // Update local filter state
    tableColumnFilters.value = filters.column
    tableColumnFilterOperators.value = filters.operator
    tableDateRangeFilters.value = filters.dateRange
    tableWhereClause.value = filters.where

    // Debounce API call
    if (filterDebounceTimer) {
        clearTimeout(filterDebounceTimer)
    }

    filterDebounceTimer = setTimeout(async () => {
        // Reset to page 1 when filtering
        menuData.value = []
        currentPage.value = 1
        hasMoreData.value = true

        await fetchMenuData(1, true)
    }, 500) // 500ms debounce
}

/** Handle refresh - reload data from scratch */
const handleRefresh = async () => {
    // Reset state
    searchQuery.value = ''
    searchApiQuery.value = ''
    tableColumnFilters.value = {}
    tableColumnFilterOperators.value = {}
    tableDateRangeFilters.value = {}
    tableWhereClause.value = ''
    menuData.value = []
    currentPage.value = 1
    hasMoreData.value = true
    deselectItem()
    
    // Reload data
    await fetchMenuData(1, true)
    
    toast.success('Data berhasil dimuat ulang')
}

/** Infinite scroll handler untuk mobile (window scroll) */
const handleWindowScroll = () => {
    if (loadingMore.value || !hasMoreData.value) return

    const scrollTop = window.scrollY || document.documentElement.scrollTop
    const windowHeight = window.innerHeight
    const docHeight = document.documentElement.scrollHeight

    // Trigger load more when near bottom of page
    if (docHeight - scrollTop - windowHeight < 100) {
        currentPage.value++
        fetchMenuData(currentPage.value)
    }
}

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================
/** Load data saat component mount */
onMounted(async () => {
    // Reset state saat mount untuk avoid stale data
    menuData.value = []
    currentPage.value = 1
    hasMoreData.value = true
    deselectItem()

    await fetchMenuData(1)

    // Add window scroll listener untuk infinite scroll di mobile
    window.addEventListener('scroll', handleWindowScroll, { passive: true })
})

/** Cleanup listeners dan state saat component unmount */
onUnmounted(() => {
    // Remove scroll listener
    window.removeEventListener('scroll', handleWindowScroll)
    
    // Clear data untuk prevent memory leak
    menuData.value = []
    deselectItem()
})
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
                        <h1 class="text-lg font-bold">Transaksi Production Result</h1>
                        <p class="text-xs text-muted-foreground">Kelola data transaksi Production Result</p>
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
                    <span class="text-xs font-medium">Filter Status :</span>
                    <Button 
                        variant="outline" 
                        size="sm"
                        class="text-xs h-7"
                        :class="filterStatus === 'Draft' ? 'border-primary text-primary' : ''"
                        @click="filterStatus = filterStatus === 'Draft' ? null : 'Draft'"
                    >
                        Draft
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm"
                        class="text-xs h-7"
                        :class="filterStatus === 'Post' ? 'border-primary text-primary' : ''"
                        @click="filterStatus = filterStatus === 'Post' ? null : 'Post'"
                    >
                        Post
                    </Button>
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
                                <div class="font-semibold text-sm truncate">{{ item.no || item.group || 'Tanpa Nomor' }}</div>
                                <div class="text-xs text-muted-foreground">
                                    {{ item.date ? new Date(item.date).toLocaleDateString('id-ID') : (item.key1 ? new Date(item.key1).toLocaleDateString('id-ID') : '-') }}
                                </div>
                            </div>
                            <Badge 
                                :class="getStatusStyle(item.status || (item.is_active ? 'POST' : 'DRAFT'))"
                                class="text-xs shrink-0"
                            >
                                {{ item.status || (item.is_active ? 'POST' : 'DRAFT') }}
                            </Badge>
                        </div>

                        <!-- Details -->
                        <div class="text-xs space-y-1 text-muted-foreground">
                            <div>
                                <span class="font-medium">No. SPK:</span> {{ item.t_wo?.no || item.no_spk || item.code || '-' }}
                            </div>
                            <div>
                                <span class="font-medium">Warehouse:</span> {{ item.m_gudang?.nama_gudang || item.warehouse || item.value2 || '-' }}
                            </div>
                            <div>
                                <span class="font-medium">Catatan:</span> {{ item.notes || item.catatan || item.value3 || '-' }}
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
                                @click.stop="() => { selectItem(item, 0); deleteSelected() }" 
                            />
                            <EditButton 
                                v-permission="{ menuId: currentMenuId, action: 'update' }"
                                variant="ghost" 
                                size="sm" 
                                class="h-7 w-7"
                                :status="item.status"
                                @click.stop="editItem(item)" 
                             :disabled="['POST', 'CONFIRM', 'APPROVED', 'IN APPROVAL', 'REJECT'].includes(item.status?.toUpperCase() || '')" />
                            <CopyButton 
                                v-permission="{ menuId: currentMenuId, action: 'create' }"
                                variant="ghost" 
                                size="sm" 
                                class="h-7 w-7"
                                @click.stop="copyItem(item)" 
                            />
                            <PostButton 
                                v-permission="{ menuId: currentMenuId, action: 'update' }"
                                variant="ghost" 
                                size="sm" 
                                class="h-7 w-7"
                                :showLabel="false"
                                :disabled="!isActive || (selectedItem && selectedItem.status !== 'DRAFT' && selectedItem.status !== 'REVISI')"
                                @click.stop="() => { selectItem(item, 0); postSelected(item) }" 
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
                <h1 class="text-2xl font-bold">Transaksi Production Result</h1>
                <p class="text-sm text-muted-foreground">Kelola data transaksi Production Result</p>
            </div>
            <div class="flex items-center gap-2">
                <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading" class="shrink-0"
                    title="Refresh data">
                    <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
                </Button>
                <Button v-if="currentMenuId" v-permission="{ menuId: currentMenuId, action: 'create' }"
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
                <span class="text-sm font-medium">Filter Status :</span>
                <Button variant="outline" size="sm"
                    :class="filterStatus === 'Draft' ? 'border-primary text-primary' : ''"
                    @click="filterStatus = filterStatus === 'Draft' ? null : 'Draft'">
                    Draft
                </Button>
                <Button variant="outline" size="sm"
                    :class="filterStatus === 'Post' ? 'border-primary text-primary' : ''"
                    @click="filterStatus = filterStatus === 'Post' ? null : 'Post'">
                    Post
                </Button>
            </div>

            <!-- Search & Action Buttons Row -->
            <div class="flex items-center gap-2">
                <!-- Search -->
                <div class="flex items-center gap-2 w-1/5">
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

                <!-- Action Buttons -->
                <div class="flex items-center gap-2">
                    <DeleteButton 
                        v-permission="{ menuId: currentMenuId, action: 'delete' }" 
                        :status="selectedItem?.status"
                        :disabled="!isActive"
                        @click="deleteSelected" />
                    <ViewButton  :disabled="!isActive" @click="viewItem()" />
                    <EditButton 
                        v-permission="{ menuId: currentMenuId, action: 'update' }" 
                        :status="selectedItem?.status"
                        :disabled="!isActive"
                        @click="editItem()" />
                    <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }"  :disabled="!isActive"
                        @click="copyItem()" />
                    <PostButton v-permission="{ menuId: currentMenuId, action: 'update' }" 
                         :disabled="!isActive || (selectedItem && selectedItem.status !== 'DRAFT' && selectedItem.status !== 'REVISI')"
                        @click="() => postSelected()" />
                </div>
            </div>
        </div>

        <!-- TABLE -->
        <DataTable :data="filteredData" :columns="columns" :loading="loading" :loading-more="loadingMore"
            :has-more="hasMoreData" :row-select-mode="true" :api-filter-mode="true" @load-more="handleLoadMore"
            @row-select="(item) => selectItem(item, 0)" @row-deselect="deselectItem"
            @filter-change="handleTableFilterChange">
            <template #empty>
                Tidak ada data Production Result
            </template>
        </DataTable>
    </div>

    <!-- ================================================================ -->
    <!-- DELETE CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <GlobalDialog 
        :open="isDeleteDialogOpen" 
        title="Hapus Production Result" 
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
        title="POST Production Result" 
        :description="`Apakah Anda yakin ingin POST Production Result &quot;${itemToPost?.no || itemToPost?.group || 'tanpa nomor'}&quot;? Setelah di-POST, data tidak bisa diedit atau dihapus lagi.`" 
        type="warning"
        confirm-text="POST" 
        cancel-text="Batal" 
        :is-loading="isPosting" 
        @confirm="confirmPost"
        @cancel="cancelPost" 
        @update:open="isPostDialogOpen = $event" 
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
