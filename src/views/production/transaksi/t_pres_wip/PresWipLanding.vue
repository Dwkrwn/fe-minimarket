<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, computed, onMounted, onUnmounted, TransitionGroup } from 'vue'
import { useRouter } from 'vue-router'
import { Search, RefreshCw, X, Plus } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import DataTable from '@/components/table/DataTable.vue'
import { DeleteButton, EditButton, CopyButton, ViewButton, PostButton } from '@/components/button'
import { useActionButtons } from '@/composables/useActionButtons'
import { usePermission } from '@/composables/usePermission'
import { getApprovalStatusBadgeClass, getApprovalStatusFilterClass } from '@/lib/approvalStatus'
import { getPresWipList, deletePresWip, postPresWip, type PresWipItem } from './service'
import { useAuthStore } from '@/stores/auth'

// ============================================================================
// COMPOSABLES & STORES
// ============================================================================
const router = useRouter()
const { selectedItem, isActive, selectItem, deselectItem } = useActionButtons()
const { currentMenuId, isSuperAdmin } = usePermission()
const authStore = useAuthStore()

// ============================================================================
// DELETE DIALOG STATE
// ============================================================================
const isDeleteDialogOpen = ref(false)
const itemToDelete = ref<PresWipItem | null>(null)
const itemToSendApproval = ref<PresWipItem | null>(null)
const isDeleting = ref(false)

// Check if selected item has locked status (IN APPROVAL, APPROVED or REJECT)
const isStatusLocked = computed(() => {
    if (!selectedItem.value) return false
    const status = selectedItem.value.status?.toUpperCase()
    return status === 'IN APPROVAL' || status === 'APPROVED' || status === 'REJECT'
})

// Check if item can be edited/deleted (has selection AND status is not locked)
// Exception: Super Admin can always edit/delete
const canEditOrDelete = computed(() => {
    if (isSuperAdmin.value) return isActive.value
    return isActive.value && !isStatusLocked.value
})

// Helper function to check if item can be deleted (only DRAFT, REVISI for non-Super Admin)
const canDeleteItem = (item: PresWipItem) => {
    if (isSuperAdmin.value) return true
    const status = item.status?.toUpperCase()
    return status === 'DRAFT' || status === 'REVISI'
}

// Helper function to check if item can be edited (only DRAFT, REVISI for non-Super Admin)
const canEditItem = (item: PresWipItem) => {
    if (isSuperAdmin.value) return true
    const status = item.status?.toUpperCase()
    return status === 'DRAFT' || status === 'REVISI'
}

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<PresWipItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const hasMoreData = ref(true)

// ============================================================================
// FILTER & SEARCH STATE
// ============================================================================
const filterStatus = ref<'DRAFT' | 'POST' | null>(null)
const searchQuery = ref('')
const searchApiQuery = ref('') // Untuk API search
const isSearching = ref(false)

// Table filter state for DataTable column filters
const tableColumnFilters = ref<Record<string, string>>({})
const tableColumnFilterOperators = ref<Record<string, string>>({})
const tableDateRangeFilters = ref<Record<string, { from: string, to: string }>>({})
const tableWhereClause = ref('')

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const columns = [
    { 
        key: 'no', 
        label: 'No. Prod. Pres WIP', 
        filterable: true, 
        width: '180px',
        renderHtml: (item: PresWipItem) => item.no || item.no_t_pres_wip || item.code || '-'
    },
    { 
        key: 'date', 
        label: 'Tanggal', 
        filterable: true, 
        filterType: 'date' as const,
        width: '120px',
        renderHtml: (item: PresWipItem) => item.date 
            ? new Date(item.date).toLocaleDateString('id-ID') 
            : (item.tgl_t_pres_wip ? new Date(item.tgl_t_pres_wip).toLocaleDateString('id-ID') : '-')
    },
    { 
        key: 't_wo.no', 
        label: 'No. SPK', 
        filterable: true, 
        width: '150px',
        valueGetter: (item: PresWipItem) => item.t_wo?.no || item.no_spk || item.value2 || '',
        renderHtml: (item: PresWipItem) => item.t_wo?.no || item.no_spk || item.value2 || '-'
    },
    { 
        key: 'm_gudang.nama_gudang', 
        label: 'Warehouse', 
        filterable: true, 
        width: '180px',
        valueGetter: (item: PresWipItem) => item.m_gudang?.nama_gudang || item.warehouse || item.value4 || '',
        renderHtml: (item: PresWipItem) => item.m_gudang?.nama_gudang || item.warehouse || item.value4 || '-'
    },
    { 
        key: 'notes', 
        label: 'Catatan', 
        filterable: true, 
        width: '200px',
        renderHtml: (item: PresWipItem) => item.notes || item.catatan || item.value5 || '-'
    },
    { 
        key: 'status', 
        label: 'Status', 
        filterable: true, 
        width: '120px',
        renderHtml: (item: PresWipItem) => {
            const status = item.status || 'DRAFT'
            const badgeClass = getStatusStyle(status)
            return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}">${status}</span>`
        }
    }
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/** Get status badge styling */
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

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================
/** Filter t_pres_wip data by status and relations */
const filteredData = computed(() => {
  return menuData.value.filter(item => {
    // Status filter
    let matchStatus = true;
    if (filterStatus.value) {
      const itemStatus = (item.status || '').toUpperCase()
      matchStatus = itemStatus === filterStatus.value
    }

    // Client-side fallback for relational columns
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

/** 
 * Check if user can view all data
 * SUPER ADMIN dan DEVELOPER dapat melihat semua data
 * User biasa hanya melihat data yang dibuat sendiri
 */
const canViewAllData = computed(() => {
  // Super Admin dari usePermission sudah handle pengecekan
  if (isSuperAdmin.value) return true
  
  // Atau cek berdasarkan tipe user value1
  const tipeUser = authStore.user?.tipe?.value1?.toUpperCase()
  if (!tipeUser) return false
  
  // Daftar tipe user yang bisa lihat semua data
  // Sesuaikan dengan kebutuhan module
  const allowedTypes = ['SUPER ADMIN', 'DEVELOPER', 'ADMIN']
  return allowedTypes.some(type => tipeUser.includes(type))
})

/** Deskripsi dialog delete */
const deleteDialogDescription = computed(() => {
    if (!itemToDelete.value) return ''
    return `Apakah Anda yakin ingin menghapus Pres WIP "${itemToDelete.value.no_t_pres_wip || 'tanpa nomor'}"? Tindakan ini tidak dapat dibatalkan.`
})

/** Deskripsi dialog send approval */
const sendApprovalDialogDescription = computed(() => {
    if (!itemToSendApproval.value) return ''
    return `Kirim Pres WIP "${itemToSendApproval.value.no_t_pres_wip || 'tanpa nomor'}" untuk approval?`
})

// ============================================================================
// NAVIGATION FUNCTIONS
// ============================================================================
/** Navigate to create form */
const createNew = () => {
    router.push('/production/transaksi/t_pres_wip/form')
}

/** Navigate to edit form */
const editItem = (item?: PresWipItem) => {
    const target = item || selectedItem.value;
    if (target && ['POST', 'CONFIRM', 'APPROVED', 'IN APPROVAL', 'REJECT'].includes(target.status?.toUpperCase())) {
        toast.error('Akses Ditolak', { description: 'Data dengan status POST/CONFIRM/APPROVED tidak dapat diedit.' });
        return;
    }
    if (item) {
        selectItem(item, 0)
    }
    
    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    // Check if item can be edited (only DRAFT, REVISI for non-Super Admin)
    if (!canEditItem(selectedItem.value)) {
        toast.error('Tidak dapat mengedit', {
            description: `Data dengan status ${selectedItem.value.status} tidak dapat diubah`
        })
        return
    }

    router.push(`/production/transaksi/t_pres_wip/form/${selectedItem.value.id}`)
}

/** Navigate to copy (new form with data) */
const copyItem = (item?: PresWipItem) => {
    if (item) {
        selectItem(item, 0)
    }
    
    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    router.push({
        path: '/production/transaksi/t_pres_wip/form',
        query: { 
            action: 'copy',
            source: selectedItem.value.id 
        }
    })

    toast.success(`Menyalin data "${selectedItem.value.no_t_pres_wip || selectedItem.value.no || '-'}"`, {
        description: 'Silakan edit dan simpan sebagai Production Result WIP baru'
    })
    deselectItem()
}

/** View Pres WIP item details */
const viewItem = (item?: any) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    // Navigate to view page (read-only mode)
    router.push(`/production/transaksi/t_pres_wip/view/${selectedItem.value.id}`)
}

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
/** Open delete confirmation dialog */
const deleteSelected = (item?: PresWipItem) => {
    const target = item || selectedItem.value;
    if (target && ['POST', 'CONFIRM', 'APPROVED', 'IN APPROVAL', 'REJECT'].includes(target.status?.toUpperCase())) {
        toast.error('Akses Ditolak', { description: 'Data dengan status POST/CONFIRM/APPROVED tidak dapat dihapus.' });
        return;
    }
    if (item) {
        selectItem(item, 0)
        itemToDelete.value = item
    } else {
        itemToDelete.value = selectedItem.value
    }

    if (!itemToDelete.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    // Check if item can be deleted (only DRAFT, REVISI for non-Super Admin)
    if (!canDeleteItem(itemToDelete.value)) {
        toast.error('Tidak dapat menghapus', {
            description: `Data dengan status ${itemToDelete.value.status} tidak dapat dihapus`
        })
        itemToDelete.value = null
        return
    }

    isDeleteDialogOpen.value = true
}

/** Confirm delete - call API */
const confirmDelete = async () => {
    if (!itemToDelete.value?.id) return

    isDeleting.value = true
    try {
        const response = await deletePresWip(itemToDelete.value.id)
        
        if (response.status === 'success') {
            // Remove from list
            menuData.value = menuData.value.filter((m: PresWipItem) => m.id !== itemToDelete.value!.id)
            
            toast.success('Pres WIP berhasil dihapus')
            isDeleteDialogOpen.value = false
            deselectItem()
        } else {
            toast.error('Gagal menghapus Production Result WIP', {
                description: response.message || 'Terjadi kesalahan saat menghapus'
            })
        }
    } catch (error) {
        toast.error('Gagal menghapus Production Result WIP', {
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
const itemToPost = ref<PresWipItem | null>(null)
const isPosting = ref(false)

const postSelected = (item?: PresWipItem) => {
    const targetItem = item || selectedItem.value as PresWipItem
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
        const response = await postPresWip(item.id)

        if (response.status === 'success') {
            // Update status in list
            menuData.value = menuData.value.map((m: PresWipItem) => {
                if (m.id === item.id) {
                    return {
                        ...m,
                        status: 'POST',
                        is_active: true
                    }
                }
                return m
            })

            toast.success(`Production Result WIP "${item.no_t_pres_wip || item.no || '-'}" berhasil di-POST`, {
                description: 'Data telah dikunci dan tidak dapat diubah lagi.'
            })

            isPostDialogOpen.value = false
            itemToPost.value = null
            deselectItem()
        } else {
            toast.error('Gagal memposting Production Result WIP', {
                description: response.data?.message || 'Terjadi kesalahan saat memposting'
            })
        }
    } catch (error) {
        toast.error('Gagal memposting Production Result WIP', {
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
// API DATA FETCHING
// ============================================================================
/** Fetch t_pres_wip data from API */
const fetchMenuData = async (page: number = 1, resetData: boolean = false) => {
    // Set loading state
    if (page === 1 || resetData) {
        loading.value = true
    } else {
        loadingMore.value = true
    }

    try {
        // Reset data jika resetData = true
        if (resetData) {
            menuData.value = []
        }

        const colFilters = { ...tableColumnFilters.value }
        let whereClauses: string[] = []
        if (tableWhereClause.value) whereClauses.push(tableWhereClause.value)

        const finalWhere = whereClauses.length > 0 ? whereClauses.join('|') : undefined

        // Generate filter_column_* keys for all columns (including relations)
        const allColumnFilters: Record<string, string> = {};
        Object.entries(colFilters).forEach(([key, value]) => {
            if (value?.trim()) {
                allColumnFilters[`filter_column_${key}`] = value.trim();
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

        const response = await getPresWipList(
            page,
            pageSize.value,
            'createdAt',
            'DESC',
            effectiveSearch,
            effectiveSearchFields,
            undefined, // filterCreatedBy not implemented yet for pres_wip
            Object.keys(allColumnFilters).length > 0 ? allColumnFilters : undefined,
            finalWhere
        )

        if (response.status === 'success' && response.data) {
            const mappedData = (response.data || []).map((item: any) => ({
                ...item,
                no_t_pres_wip: item.no || item.no_t_pres_wip || item.code || '-',
                tgl_t_pres_wip: item.date || item.tgl_t_pres_wip || '-',
                catatan: item.notes || item.catatan || '-',
                is_active: item.status === 'POST' || item.is_active === true
            }))

            if (page === 1 || resetData) {
                // Replace data untuk page pertama
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
        toast.error('Gagal memuat data Pres WIP', {
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
                        <h1 class="text-lg font-bold">Transaksi Production Result WIP</h1>
                        <p class="text-xs text-muted-foreground">Kelola data Production Result WIP</p>
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
                        :class="filterStatus === 'DRAFT' ? 'border-gray-500 bg-gray-100 text-gray-800' : ''"
                        @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'"
                    >
                        DRAFT
                    </Button>
                    <Button 
                        variant="outline" 
                        size="sm"
                        class="text-xs h-7 whitespace-nowrap"
                        :class="filterStatus === 'POST' ? 'border-emerald-500 bg-emerald-100 text-emerald-800' : ''"
                        @click="filterStatus = filterStatus === 'POST' ? null : 'POST'"
                    >
                        POST
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
                                <div class="font-semibold text-sm truncate">{{ item.no || item.no_t_pres_wip || 'Tanpa Nomor' }}</div>
                                <div class="text-xs text-muted-foreground">
                                    {{ item.date ? new Date(item.date).toLocaleDateString('id-ID') : (item.tgl_t_pres_wip ? new Date(item.tgl_t_pres_wip).toLocaleDateString('id-ID') : '-') }}
                                </div>
                            </div>
                            <Badge 
                                :class="getStatusStyle(item.status || 'DRAFT')"
                                class="text-xs shrink-0"
                            >
                                {{ item.status || 'DRAFT' }}
                            </Badge>
                        </div>

                        <!-- Details -->
                        <div class="text-xs space-y-1 text-muted-foreground">
                            <div>
                                <span class="font-medium">No. SPK:</span> {{ item.t_wo?.no || item.no_spk || item.value2 || '-' }}
                            </div>
                            <div>
                                <span class="font-medium">Warehouse:</span> {{ item.m_gudang?.nama_gudang || item.warehouse || item.value4 || '-' }}
                            </div>
                            <div v-if="item.notes || item.catatan || item.value5">
                                <span class="font-medium">Catatan:</span> {{ item.notes || item.catatan || item.value5 }}
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
                                @click.stop="() => { selectItem(item, 0); deleteSelected() }" 
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
                                 v-permission="{ menuId: currentMenuId, action: 'update' }"
                                 variant="ghost" 
                                 size="sm" 
                                 class="h-7 w-7"
                                 :showLabel="false"
                                 :disabled="item.status === 'POST'"
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
                <h1 class="text-2xl font-bold">Transaksi Production Result WIP</h1>
                <p class="text-sm text-muted-foreground">Kelola data Production Result WIP</p>
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
            <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm font-medium">Status:</span>
                <Button variant="outline" size="sm"
                    :class="filterStatus === 'DRAFT' ? 'border-gray-500 bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' : ''"
                    @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'">
                    DRAFT
                </Button>
                <Button variant="outline" size="sm"
                    :class="filterStatus === 'POST' ? 'border-emerald-500 bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : ''"
                    @click="filterStatus = filterStatus === 'POST' ? null : 'POST'">
                    POST
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
                        :disabled="!canEditOrDelete"
                        @click="() => deleteSelected()" />
                    <ViewButton  :disabled="!isActive" @click="viewItem()" />
                    <EditButton 
                        v-permission="{ menuId: currentMenuId, action: 'update' }" 
                        :status="selectedItem?.status"
                        :disabled="!canEditOrDelete"
                        @click="editItem()" />
                     <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }"  :disabled="!isActive"
                         @click="copyItem()" />
                     <PostButton v-permission="{ menuId: currentMenuId, action: 'update' }" 
                          :disabled="!isActive || (selectedItem && selectedItem.status === 'POST')"
                         @click="() => postSelected()" />
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
            <template #empty>
                Tidak ada data Production Result WIP
            </template>
        </DataTable>
    </div>

    <!-- ================================================================ -->
    <!-- DELETE CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <GlobalDialog 
        :open="isDeleteDialogOpen" 
        title="Hapus Production Result WIP" 
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
        title="POST Production Result WIP" 
        :description="`Apakah Anda yakin ingin POST Production Result WIP &quot;${itemToPost?.no_t_pres_wip || itemToPost?.no || 'tanpa nomor'}&quot;? Setelah di-POST, data tidak bisa diedit atau dihapus lagi.`" 
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
