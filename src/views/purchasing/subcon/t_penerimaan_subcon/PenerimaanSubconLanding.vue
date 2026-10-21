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
import { useAuthStore } from '@/stores/auth'
import { getPenerimaanSubconList, deletePenerimaanSubcon, postPenerimaanSubcon, type PenerimaanSubconFilter, type PenerimaanSubconItem } from './service'
import { getApprovalStatusBadgeClass, getApprovalStatusFilterClass } from "@/lib/approvalStatus";

// ============================================================================
// COMPOSABLES & STORES
// ============================================================================
const router = useRouter()
const { selectedItem, isActive, selectItem, deselectItem, handleEdit, handleDelete, handleCopy } = useActionButtons()
const { currentMenuId, canCreate, canUpdate, canDelete, canPrint, isSuperAdmin } = usePermission()
const authStore = useAuthStore()

// ============================================================================
// DELETE DIALOG STATE
// ============================================================================
const isDeleteDialogOpen = ref(false)
const itemToDelete = ref<PenerimaanSubconItem | null>(null)
const isDeleting = ref(false)

const isPosting = ref(false)

const normalizeStatus = (status?: string) =>
    (status || 'DRAFT')
        .toUpperCase()
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

const isPostedStatus = (status?: string) => normalizeStatus(status) === 'POST'

// Check if item can be edited/deleted based on row action rule
const canEditOrDelete = computed(() => {
    if (!selectedItem.value || !isActive.value) return false
    return canEditItem(selectedItem.value) && canDeleteItem(selectedItem.value)
})

// Helper function to check if item can be deleted (only DRAFT)
const canDeleteItem = (item: PenerimaanSubconItem) => {
    const status = normalizeStatus(item.status)
    if (isPostedStatus(status)) return false
    return status === 'DRAFT'
}

// Helper function to check if item can be edited (only DRAFT)
const canEditItem = (item: PenerimaanSubconItem) => {
    const status = normalizeStatus(item.status)
    if (isPostedStatus(status)) return false
    return status === 'DRAFT'
}

const canPostItem = (item: PenerimaanSubconItem) => {
    const status = normalizeStatus(item.status)
    return status === 'DRAFT'
}

// ============================================================================
// BULK DELETE STATE
// ============================================================================
const selectedRows = ref<PenerimaanSubconItem[]>([])
const isBulkDeleteDialogOpen = ref(false)
const isBulkDeleting = ref(false)

// Item yang bisa dihapus = hanya yang DRAFT
const bulkDeletableItems = computed(() =>
    selectedRows.value.filter((item) => canDeleteItem(item))
)

// Tombol bulk delete hanya muncul jika ada LEBIH DARI 1 item yang berstatus DRAFT
const showBulkDeleteButton = computed(() => bulkDeletableItems.value.length > 1)

const bulkDeleteDialogDescription = computed(() => {
    const count = bulkDeletableItems.value.length
    const skipped = selectedRows.value.length - count
    let desc = `Apakah Anda yakin ingin menghapus ${count} Penerimaan Subcon yang dipilih? Tindakan ini tidak dapat dibatalkan.`
    if (skipped > 0) {
        desc += ` (${skipped} item yang tidak berstatus DRAFT akan dilewati)`
    }
    return desc
})

const selectionAnchor = ref<PenerimaanSubconItem | null>(null)

const isDraftStatus = (item?: PenerimaanSubconItem | null) =>
    (item?.status || '').toUpperCase() === 'DRAFT'

const handleSelectionChange = (items: PenerimaanSubconItem[]) => {
    if (items.length === 0) {
        selectionAnchor.value = null
        selectedRows.value = []
        deselectItem()
        return
    }

    const firstItem = items[0]
    if (!firstItem) return
    const prevAnchor = selectionAnchor.value
    const anchor: PenerimaanSubconItem =
        prevAnchor && items.some((i) => i.id === prevAnchor.id) ? prevAnchor : firstItem
    selectionAnchor.value = anchor

    // Anchor bukan DRAFT -> hanya boleh 1 item terpilih.
    if (!isDraftStatus(anchor)) {
        const anchorItem = items.find((i) => i.id === anchor.id) || anchor
        if (items.length > 1) {
            toast.warning('Tidak dapat memilih item lain', {
                description: `Item berstatus ${anchor.status} hanya dapat dipilih sendiri.`
            })
        }
        selectedRows.value = [anchorItem]
        selectItem(anchorItem, 0)
        return
    }

    // Anchor DRAFT -> hanya boleh memilih sesama DRAFT.
    const draftOnly = items.filter(isDraftStatus)
    if (items.some((i) => !isDraftStatus(i))) {
        toast.warning('Tidak dapat memilih item lain', {
            description: 'Hanya item berstatus DRAFT yang dapat dipilih bersama.'
        })
    }
    const allowed = draftOnly.length > 0 ? draftOnly : [anchor]
    selectedRows.value = allowed
    selectItem(allowed[allowed.length - 1] ?? anchor, 0)
}

const openBulkDeleteDialog = () => {
    if (bulkDeletableItems.value.length === 0) {
        toast.error('Tidak ada item yang dapat dihapus', {
            description: 'Hanya item berstatus DRAFT yang dapat dihapus'
        })
        return
    }
    isBulkDeleteDialogOpen.value = true
}

const confirmBulkDelete = async () => {
    if (bulkDeletableItems.value.length === 0) return

    isBulkDeleting.value = true
    const toDelete = [...bulkDeletableItems.value]
    const errors: string[] = []

    for (const item of toDelete) {
        try {
            const response = await deletePenerimaanSubcon(item.id)
            if (response.status === 'success') {
                menuData.value = menuData.value.filter((m) => m.id !== item.id)
            } else {
                errors.push(item.no_penerimaan || item.id)
            }
        } catch {
            errors.push(item.no_penerimaan || item.id)
        }
    }

    isBulkDeleting.value = false
    isBulkDeleteDialogOpen.value = false
    selectedRows.value = []
    deselectItem()

    if (errors.length === 0) {
        toast.success(`${toDelete.length} item berhasil dihapus`)
    } else {
        toast.warning('Beberapa item gagal dihapus', {
            description: `Gagal: ${errors.join(', ')}`
        })
    }
}

const cancelBulkDelete = () => {
    isBulkDeleteDialogOpen.value = false
}

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<PenerimaanSubconItem[]>([])
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
const tableColumnFilters = ref<Record<string, string>>({})
const tableColumnFilterOperators = ref<Record<string, string>>({})
const tableDateRangeFilters = ref<Record<string, { from: string; to: string }>>({})
const tableWhereFilter = ref('')

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const getUnitBisnisName = (item: any) => {
    return item.m_unit_bisni?.nama_comp || item.m_unit_bisnis?.nama_comp || item.m_unit_bisnis?.nama || item.unit_bisnis || '-'
}

const getSupplierName = (item: any) => {
    return item.m_supplier?.nama_supp || item.m_supplier?.nama || item.supplier?.nama_supp || '-'
}

const formatCurrency = (value: any) => {
    const num = Number(value)
    if (!Number.isFinite(num)) return '-'
    return num.toLocaleString('id-ID')
}

const columns = [
    { key: 'm_unit_bisnis', label: 'Unit Bisnis', filterable: true, width: '170px', render: (item: PenerimaanSubconItem) => getUnitBisnisName(item) },
    { key: 'no_penerimaan', label: 'No. Penerimaan Subcon', filterable: true, width: '200px' },
    {
        key: 'tgl_penerimaan',
        label: 'Tgl PB Subcon',
        filterable: true,
        filterType: 'date' as const,
        width: '150px',
        renderHtml: (item: PenerimaanSubconItem) => {
            return item.tgl_penerimaan ? new Date(item.tgl_penerimaan).toLocaleDateString('id-ID') : '-'
        }
    },
    { key: 'm_supplier', label: 'Supplier', filterable: true, width: '200px', render: (item: PenerimaanSubconItem) => getSupplierName(item) },
    { key: 'catatan', label: 'Catatan', filterable: true, width: '200px' },
    {
        key: 'status',
        label: 'Status',
        filterable: true,
        width: '140px',
        renderHtml: (item: PenerimaanSubconItem) => {
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
const getStatusStyle = getApprovalStatusBadgeClass;

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================
/** Filter t_penerimaan_subcon data by status */
const filteredData = computed(() => {
  if (!filterStatus.value) return menuData.value

  return menuData.value.filter(item => {
    const itemStatus = (item.status || '').toUpperCase()
    return itemStatus === filterStatus.value
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
    return `Apakah Anda yakin ingin menghapus Penerimaan Subcon "${itemToDelete.value.no_penerimaan || 'tanpa nomor'}"? Tindakan ini tidak dapat dibatalkan.`
})

// ============================================================================
// NAVIGATION FUNCTIONS
// ============================================================================
/** Navigate to create form */
const createNew = () => {
    router.push('/purchasing/subcon/t_penerimaan_subcon/form')
}

/** Navigate to edit form */
const editItem = (item?: PenerimaanSubconItem) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    // Check if item can be edited (only DRAFT)
    if (!canEditItem(selectedItem.value)) {
        const statusLabel = selectedItem.value.status || 'DRAFT'
        toast.error('Tidak dapat mengedit', {
            description: `Data dengan status ${statusLabel} tidak dapat diubah`
        })
        return
    }

    router.push(`/purchasing/subcon/t_penerimaan_subcon/form/${selectedItem.value.id}`)
}

/** Navigate to copy (new form with data) */
const copyItem = (item?: PenerimaanSubconItem) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    router.push({
        path: '/purchasing/subcon/t_penerimaan_subcon/form',
        query: { copy: selectedItem.value.id }
    })
}

/** View PenerimaanSubcon item details */
const viewItem = (item?: any) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    // Navigate to view page (read-only mode)
    router.push(`/purchasing/subcon/t_penerimaan_subcon/view/${selectedItem.value.id}`)
}

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
/** Open delete confirmation dialog */
const deleteSelected = (item?: PenerimaanSubconItem) => {
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

    // Check if item can be deleted (only DRAFT)
    if (!canDeleteItem(itemToDelete.value)) {
        const statusLabel = itemToDelete.value.status || 'DRAFT'
        toast.error('Tidak dapat menghapus', {
            description: `Data dengan status ${statusLabel} tidak dapat dihapus`
        })
        itemToDelete.value = null
        return
    }

    isDeleteDialogOpen.value = true
}

/** Confirm delete - call API */
const confirmDelete = async () => {
    const target = itemToDelete.value
    if (!target?.id) {
        toast.error('Data yang akan dihapus tidak valid')
        return
    }

    isDeleting.value = true
    try {
        const response = await deletePenerimaanSubcon(target.id)

        if (response.status === 'success') {
            // Remove from list
            menuData.value = menuData.value.filter((m: PenerimaanSubconItem) => m.id !== target.id)

            toast.success('Penerimaan Subcon berhasil dihapus')
            isDeleteDialogOpen.value = false
            itemToDelete.value = null
            deselectItem()
        } else {
            toast.error('Gagal menghapus Penerimaan Subcon', {
                description: response.message || 'Terjadi kesalahan saat menghapus'
            })
        }
    } catch (error) {
        toast.error('Gagal menghapus Penerimaan Subcon', {
            description: error instanceof Error ? error.message : 'Terjadi kesalahan'
        })
    } finally {
        isDeleting.value = false
    }
}

const cancelDelete = () => {
    isDeleteDialogOpen.value = false
    itemToDelete.value = null
}

const postItem = async (item?: PenerimaanSubconItem) => {
    const target = item || selectedItem.value
    if (!target?.id) {
        toast.error('Pilih item terlebih dahulu')
        return
    }
    if (!canPostItem(target)) {
        toast.error('Tidak dapat post', {
            description: `Data dengan status ${target.status || 'DRAFT'} tidak dapat dipost`
        })
        return
    }
    isPosting.value = true
    try {
        const result = await postPenerimaanSubcon(target.id)
        if (result.status === 'success') {
            const idx = menuData.value.findIndex((m: PenerimaanSubconItem) => m.id === target.id)
            if (idx !== -1) {
                menuData.value.splice(idx, 1, { ...menuData.value[idx], status: 'POST' } as PenerimaanSubconItem)
            }
            toast.success('Penerimaan Subcon berhasil dipost')
            deselectItem()
        } else {
            toast.error('Gagal post Penerimaan Subcon', {
                description: result.message || 'Terjadi kesalahan saat post'
            })
        }
    } catch (error) {
        toast.error('Gagal post Penerimaan Subcon', {
            description: error instanceof Error ? error.message : 'Terjadi kesalahan'
        })
    } finally {
        isPosting.value = false
    }
}

// ============================================================================
// API DATA FETCHING
// ============================================================================
/** Fetch t_penerimaan_subcon data from API */
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

        // Determine if user should see all data or only their own
        const filterCreatedBy = canViewAllData.value ? undefined : authStore.user?.id
        const apiFilters: PenerimaanSubconFilter[] = []

        Object.entries(tableColumnFilters.value).forEach(([key, value]) => {
            if (value && value.trim()) {
                apiFilters.push({
                    key,
                    value: value.trim(),
                    operator: tableColumnFilterOperators.value[key]
                })
            }
        })

        const response = await getPenerimaanSubconList(
            page,
            pageSize.value,
            'createdAt',
            'DESC',
            searchApiQuery.value || undefined,
            searchApiQuery.value
                ? 'no_penerimaan,catatan,m_unit_bisnis.nama_comp,m_supplier.nama_supp'
                : undefined,
            filterCreatedBy,
            apiFilters.length > 0 ? apiFilters : undefined,
            tableWhereFilter.value || undefined
        )

        if (response.status === 'success' && response.data) {
            if (page === 1 || resetData) {
                // Replace data untuk page pertama
                menuData.value = response.data
            } else {
                // Append data untuk infinite scroll
                menuData.value.push(...response.data)
            }

            // Check if there's more data to load
            if (response.pagination) {
                hasMoreData.value = response.pagination.next_page !== null
            }
        }
    } catch (error) {
        toast.error('Gagal memuat data Penerimaan Subcon', {
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
    tableWhereFilter.value = filters.where

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
    tableWhereFilter.value = ''
    menuData.value = []
    currentPage.value = 1
    hasMoreData.value = true
    deselectItem()
    selectedRows.value = []

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
    selectedRows.value = []
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
                        <h1 class="text-lg font-bold">Transaksi Penerimaan Subcon</h1>
                        <p class="text-xs text-muted-foreground">Kelola data Penerimaan Subcon</p>
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
                        :class="getApprovalStatusFilterClass('POST', filterStatus === 'POST')"
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
                                <div class="font-semibold text-sm truncate">{{ item.no_penerimaan || 'Tanpa Nomor' }}</div>
                                <div class="text-xs text-muted-foreground truncate">
                                    {{ item.tgl_penerimaan ? new Date(item.tgl_penerimaan).toLocaleDateString('id-ID') : '-' }}
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
                            <div class="truncate">
                                <span class="font-medium">Supplier:</span> {{ item.m_supplier?.nama_supp || item.m_supplier?.nama || '-' }}
                            </div>
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
                                :menu-id="currentMenuId"
                                variant="ghost"
                                size="sm"
                                :show-label="false"
                                class="h-7 w-7 text-blue-600"
                                :disabled="!canPostItem(item) || isPosting"
                                :loading="isPosting"
                                @click.stop="postItem(item)"
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
                <h1 class="text-2xl font-bold">Transaksi Penerimaan Subcon</h1>
                <p class="text-sm text-muted-foreground">Kelola data Penerimaan Subcon</p>
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
                <Button
                  variant="outline"
                  size="sm"
                  class="text-xs h-8 whitespace-nowrap"
                  :class="filterStatus === null ? 'bg-blue-100 text-blue-800 border-blue-500 hover:bg-blue-200' : ''"
                  @click="filterStatus = null"
                >
                  ALL
                </Button>
                <Button variant="outline" size="sm"
                    :class="getApprovalStatusFilterClass('DRAFT', filterStatus === 'DRAFT')"
                    @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'">
                    DRAFT
                </Button>
                <Button variant="outline" size="sm"
                    :class="getApprovalStatusFilterClass('POST', filterStatus === 'POST')"
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
                    <!-- Bulk Delete Button - hanya muncul jika lebih dari 1 item berstatus DRAFT dipilih -->
                    <Button
                        v-if="showBulkDeleteButton"
                        v-permission="{ menuId: currentMenuId, action: 'delete' }"
                        variant="destructive"
                        size="sm"
                        class="gap-2 whitespace-nowrap"
                        :disabled="isBulkDeleting"
                        @click="openBulkDeleteDialog"
                    >
                        <Trash2 class="h-4 w-4" />
                        Bulk Delete ({{ bulkDeletableItems.length }})
                    </Button>
                    <DeleteButton v-permission="{ menuId: currentMenuId, action: 'delete' }" 
                        :status="selectedItem?.status"
                        :disabled="!canEditOrDelete"
                        @click="() => deleteSelected()" />
                    <ViewButton :disabled="!isActive" @click="viewItem()" />
                    <EditButton v-permission="{ menuId: currentMenuId, action: 'update' }" 
                        :status="selectedItem?.status"
                        :disabled="!canEditOrDelete"
                        @click="editItem()" />
                    <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }" :disabled="!isActive"
                        @click="copyItem()" />
                    <PostButton
                        :menu-id="currentMenuId"
                        variant="default"
                        size="default"
                        :disabled="!selectedItem || !canPostItem(selectedItem) || isPosting"
                        :loading="isPosting"
                        @click="postItem()"
                    />
                </div>
            </div>
        </div>

        <!-- TABLE -->
        <DataTable :data="filteredData" :columns="columns" :loading="loading" :loading-more="loadingMore"
            :has-more="hasMoreData" :row-select-mode="true" :multi-select-mode="true" :selected-items="selectedRows"
            :api-filter-mode="true" @load-more="handleLoadMore"
            @row-select="(item) => selectItem(item, 0)" @row-deselect="deselectItem"
            @filter-change="handleTableFilterChange" @selection-change="handleSelectionChange">
            <template #empty>
                Tidak ada data Penerimaan Subcon
            </template>
        </DataTable>
    </div>

    <!-- ================================================================ -->
    <!-- DELETE CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <GlobalDialog
        :open="isDeleteDialogOpen"
        title="Hapus Penerimaan Subcon"
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
        title="Hapus Penerimaan Subcon"
        :description="bulkDeleteDialogDescription"
        type="danger"
        confirm-text="Hapus Semua"
        cancel-text="Batal"
        :is-loading="isBulkDeleting"
        @confirm="confirmBulkDelete"
        @cancel="cancelBulkDelete"
        @update:open="isBulkDeleteDialogOpen = $event"
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