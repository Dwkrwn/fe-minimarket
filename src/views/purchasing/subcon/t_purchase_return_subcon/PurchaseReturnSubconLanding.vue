<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, computed, onMounted, onUnmounted, TransitionGroup } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Trash2, FileDown, Edit, Copy, RefreshCw, X, Plus, Info } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import DataTable from '@/components/table/DataTable.vue'
import { DeleteButton, ExportButton, EditButton, CopyButton, ViewButton, SendApprovalButton, HistoryApprovalButton } from '@/components/button'
import { FieldX } from '@/components/field'
import { useActionButtons } from '@/composables/useActionButtons'
import { usePermission } from '@/composables/usePermission'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { getPurchaseReturnSubconList, deletePurchaseReturnSubcon, type PurchaseReturnSubconItem } from './service'
import { getApprovalStatusBadgeClass, getApprovalStatusFilterClass } from "@/lib/approvalStatus";

// ============================================================================
// COMPOSABLES & STORES
// ============================================================================
const router = useRouter()
const { selectedItem, isActive, selectItem, deselectItem, handleEdit, handleDelete, handleCopy } = useActionButtons()
const { currentMenuId, canCreate, canUpdate, canDelete, canPrint, isSuperAdmin } = usePermission()
const { API_BASE_URL } = useApi()
const authStore = useAuthStore()

// ============================================================================
// DELETE DIALOG STATE
// ============================================================================
const isDeleteDialogOpen = ref(false)
const itemToDelete = ref<PurchaseReturnSubconItem | null>(null)
const isDeleting = ref(false)

// ============================================================================
// SEND APPROVAL DIALOG STATE
// ============================================================================
const isSendApprovalDialogOpen = ref(false)
const itemToSendApproval = ref<PurchaseReturnSubconItem | null>(null)
const approvalCatatan = ref('')
const isSendingApproval = ref(false)
const approvalPath = '/purchasing/subcon/t_purchase_return_subcon'

const normalizeApprovalPath = (path?: string | null) => {
    const cleaned = (path || '').trim().replace(/\/+$/, '').toLowerCase()
    if (!cleaned) return ''
    return cleaned.startsWith('/') ? cleaned : `/${cleaned}`
}
const isMengajukanType = (tipe?: string | null) => (tipe || '').trim().toUpperCase() === 'MENGAJUKAN'

// Get current approval info from localStorage
const currentApprovalInfo = computed(() => {
    const approvalList = authStore.getApprovalList()
    return approvalList.find((approval: any) =>
        normalizeApprovalPath(approval.path) === normalizeApprovalPath(approvalPath) &&
        isMengajukanType(approval.tipe_approve)
    )
})

// Check if selected item has locked status (IN APPROVAL, APPROVED or REJECT)
const isStatusLocked = computed(() => {
    if (!selectedItem.value) return false
    const status = selectedItem.value.status?.toUpperCase()
    return status === 'IN APPROVAL' || status === 'APPROVED' || status === 'REJECT'
})

// Check if item can be edited/deleted (has selection AND status is not locked)
const canEditOrDelete = computed(() => {
    return isActive.value && !isStatusLocked.value
})

// Helper function to check if specific item has locked status
const isItemStatusLocked = (item: PurchaseReturnSubconItem) => {
    const status = item.status?.toUpperCase()
    return status === 'IN APPROVAL' || status === 'APPROVED' || status === 'REJECT'
}

// Helper function to check if item can be deleted
const canDeleteItem = (item: PurchaseReturnSubconItem) => {
    const status = item.status?.toUpperCase()
    return status === 'DRAFT' || status === 'REVISI'
}

// Helper function to check if item can be edited
const canEditItem = (item: PurchaseReturnSubconItem) => {
    const status = item.status?.toUpperCase()
    return status === 'DRAFT' || status === 'REVISI'
}

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<PurchaseReturnSubconItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const hasMoreData = ref(true)

// ============================================================================
// FILTER & SEARCH STATE
// ============================================================================
const filterStatus = ref<'DRAFT' | 'IN APPROVAL' | 'REJECT' | 'REVISI' | 'APPROVED' | null>(null)
const searchQuery = ref('')
const searchApiQuery = ref('') // Untuk API search
const isSearching = ref(false)
const tableColumnFilters = ref<Record<string, string>>({})
const tableColumnFilterOperators = ref<Record<string, string>>({})
const tableDateRangeFilters = ref<Record<string, { from: string, to: string }>>({})

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const getUnitBisnisName = (item: any) => item.m_unit_bisni?.nama_comp || item.m_unit_bisnis?.nama_comp || item.m_unit_bisni?.nama || item.m_unit_bisnis?.nama || '-'
const getSupplierName = (item: any) => item.m_supplier?.nama_supp || item.m_supplier?.nama || '-'
const getNoRetur = (item: any) => item.no_retur_subcon || item.no_t_purchase_return_subcon || 'Tanpa Nomor'
const getTglRetur = (item: any) => item.tgl_retur || item.tgl_t_purchase_return_subcon || null

const columns = [
    { key: 'm_unit_bisnis', label: 'Unit Bisnis', filterable: true, width: '160px', render: (item: PurchaseReturnSubconItem) => getUnitBisnisName(item) },
    { key: 'no_retur_subcon', label: 'No. Retur Subcon', filterable: true, width: '180px', render: (item: PurchaseReturnSubconItem) => getNoRetur(item) },
    {
        key: 'tgl_retur',
        label: 'Tgl PR Subcon',
        filterable: false,
        width: '140px',
        renderHtml: (item: PurchaseReturnSubconItem) => {
            const tgl = getTglRetur(item)
            return tgl ? new Date(tgl).toLocaleDateString('id-ID') : '-'
        }
    },
    { key: 'm_supplier', label: 'Supplier', filterable: true, width: '200px', render: (item: PurchaseReturnSubconItem) => getSupplierName(item) },
    { key: 'catatan', label: 'Catatan', filterable: true, width: '180px' },
    {
        key: 'status',
        label: 'Status',
        filterable: true,
        width: '140px',
        renderHtml: (item: PurchaseReturnSubconItem) => {
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
/** Filter t_purchase_return_subcon data by status */
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
    return `Apakah Anda yakin ingin menghapus Purchase Return Subcon "${getNoRetur(itemToDelete.value) || 'tanpa nomor'}"? Tindakan ini tidak dapat dibatalkan.`
})

/** Deskripsi dialog send approval */
const sendApprovalDialogDescription = computed(() => {
    if (!itemToSendApproval.value) return ''
    return `Kirim Purchase Return Subcon "${getNoRetur(itemToSendApproval.value) || 'tanpa nomor'}" untuk approval?`
})

// ============================================================================
// NAVIGATION FUNCTIONS
// ============================================================================
/** Navigate to create form */
const createNew = () => {
    router.push('/purchasing/subcon/t_purchase_return_subcon/form')
}

/** Navigate to edit form */
const editItem = (item?: PurchaseReturnSubconItem) => {
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

    router.push(`/purchasing/subcon/t_purchase_return_subcon/form/${selectedItem.value.id}`)
}

/** Navigate to copy (new form with data) */
const copyItem = (item?: PurchaseReturnSubconItem) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    router.push({
        path: '/purchasing/subcon/t_purchase_return_subcon/form',
        query: { copy: selectedItem.value.id }
    })
}

/** View PurchaseReturnSubcon item details */
const viewItem = (item?: any) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    // Navigate to view page (read-only mode)
    router.push(`/purchasing/subcon/t_purchase_return_subcon/view/${selectedItem.value.id}`)
}

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
/** Open delete confirmation dialog */
const deleteSelected = (item?: PurchaseReturnSubconItem) => {
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
        const response = await deletePurchaseReturnSubcon(itemToDelete.value.id)

        if (response.status === 'success') {
            // Remove from list
            menuData.value = menuData.value.filter((m: PurchaseReturnSubconItem) => m.id !== itemToDelete.value!.id)

            toast.success('Purchase Return Subcon berhasil dihapus')
            isDeleteDialogOpen.value = false
            deselectItem()
        } else {
            toast.error('Gagal menghapus Purchase Return Subcon', {
                description: response.message || 'Terjadi kesalahan saat menghapus'
            })
        }
    } catch (error) {
        toast.error('Gagal menghapus Purchase Return Subcon', {
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
// SEND APPROVAL FUNCTIONS
// ============================================================================
/** Open send approval dialog */
const openSendApprovalDialog = (item?: PurchaseReturnSubconItem) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    itemToSendApproval.value = selectedItem.value
    approvalCatatan.value = ''
    isSendApprovalDialogOpen.value = true
}

/** Confirm send approval - hit API POST t_purchase_return_subcon_notifikasi */
const confirmSendApproval = async () => {
    if (!itemToSendApproval.value || !itemToSendApproval.value.id) return

    isSendingApproval.value = true
    try {
        // Get approval data from localStorage
        const approvalList = authStore.getApprovalList()
        const currentApproval = approvalList.find((approval: any) =>
            normalizeApprovalPath(approval.path) === normalizeApprovalPath(approvalPath) &&
            isMengajukanType(approval.tipe_approve)
        )

        if (!currentApproval) {
            toast.error('Gagal mengirim approval', {
                description: 'Anda tidak memiliki hak untuk mengajukan approval'
            })
            isSendingApproval.value = false
            return
        }

        // Validate approval data
        if (currentApproval.level === null || currentApproval.level === undefined || !currentApproval.sender_id) {
            toast.error('Data approval tidak lengkap', {
                description: 'Field yang hilang. Silakan hubungi administrator untuk melengkapi data approval Anda.',
                duration: 6000
            })
            isSendingApproval.value = false
            return
        }

        // Prepare payload
        const payload = {
            approval_level: currentApproval.level,
            sender_id: currentApproval.sender_id,
            t_purchase_return_subcon_id: itemToSendApproval.value.id,
            approval_message: approvalCatatan.value.trim() || null
        }

        // Call API POST /dynamic/t_purchase_return_subcon_notifikasi
        const response = await fetch(
            `${API_BASE_URL}/dynamic/t_purchase_return_subcon_notifikasi`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authStore.token}`
                },
                body: JSON.stringify(payload)
            }
        )

        const result = await response.json()

        if (result.status === 'success') {
            // Update status item di list
            const itemIndex = menuData.value.findIndex((m: PurchaseReturnSubconItem) => m.id === itemToSendApproval.value!.id)
            if (itemIndex !== -1) {
                const updatedItem = { ...menuData.value[itemIndex], status: 'IN APPROVAL' } as PurchaseReturnSubconItem
                menuData.value.splice(itemIndex, 1, updatedItem)
            }

            toast.success('Approval berhasil dikirim', {
                description: `Purchase Return Subcon "${getNoRetur(itemToSendApproval.value) || 'tanpa nomor'}" telah dikirim untuk approval`
            })

            isSendApprovalDialogOpen.value = false
            deselectItem()
        } else {
            toast.error('Gagal mengirim approval', {
                description: result.message || 'Terjadi kesalahan saat mengirim approval'
            })
        }
    } catch (error) {
        toast.error('Gagal mengirim approval', {
            description: error instanceof Error ? error.message : 'Terjadi kesalahan'
        })
    } finally {
        isSendingApproval.value = false
        itemToSendApproval.value = null
        approvalCatatan.value = ''
    }
}

const cancelSendApproval = () => {
    isSendApprovalDialogOpen.value = false
    itemToSendApproval.value = null
    approvalCatatan.value = ''
}

// ============================================================================
// API DATA FETCHING
// ============================================================================
/** Fetch t_purchase_return_subcon data from API */
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

        // // Determine if user should see all data or only their own
        // const filterCreatedBy = canViewAllData.value ? undefined : authStore.user?.id

        const response = await getPurchaseReturnSubconList(
            page,
            pageSize.value,
            'createdAt',
            'DESC',
            searchApiQuery.value || undefined,
            searchApiQuery.value ? 'no_retur_subcon,no_t_purchase_return_subcon,catatan' : undefined,
            // filterCreatedBy
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
        toast.error('Gagal memuat data Purchase Return Subcon', {
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
                        <h1 class="text-lg font-bold">Transaksi Purchase Return Subcon</h1>
                        <p class="text-xs text-muted-foreground">Kelola data Purchase Return Subcon</p>
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
                        :class="getApprovalStatusFilterClass('IN APPROVAL', filterStatus === 'IN APPROVAL')"
                        @click="filterStatus = filterStatus === 'IN APPROVAL' ? null : 'IN APPROVAL'"
                    >
                        IN APPROVAL
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        class="text-xs h-7 whitespace-nowrap"
                        :class="getApprovalStatusFilterClass('APPROVED', filterStatus === 'APPROVED')"
                        @click="filterStatus = filterStatus === 'APPROVED' ? null : 'APPROVED'"
                    >
                        APPROVED
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        class="text-xs h-7 whitespace-nowrap"
                        :class="getApprovalStatusFilterClass('REJECT', filterStatus === 'REJECT')"
                        @click="filterStatus = filterStatus === 'REJECT' ? null : 'REJECT'"
                    >
                        REJECT
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        class="text-xs h-7 whitespace-nowrap"
                        :class="getApprovalStatusFilterClass('REVISI', filterStatus === 'REVISI')"
                        @click="filterStatus = filterStatus === 'REVISI' ? null : 'REVISI'"
                    >
                        REVISI
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
                                <div class="font-semibold text-sm truncate">{{ getNoRetur(item) }}</div>
                                <div class="text-xs text-muted-foreground truncate">
                                    {{ getTglRetur(item) ? new Date(getTglRetur(item) as string).toLocaleDateString('id-ID') : '-' }}
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
                                <span class="font-medium">Supplier:</span> {{ (item as any).m_supplier?.nama_supp || (item as any).m_supplier?.nama || '-' }}
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
                            <SendApprovalButton
                                path="/purchasing/subcon/t_purchase_return_subcon"
                                :status="item.status"
                                :ignore-permission="true"
                                variant="ghost"
                                size="sm"
                                :showLabel="false"
                                class="h-7 w-7"
                                @click.stop="openSendApprovalDialog(item)"
                            />
                            <HistoryApprovalButton
                                :record-id="item.id || ''"
                                notification-endpoint="t_purchase_return_subcon_notifikasi"
                                foreign-key-column="t_purchase_return_subcon_id"
                                :record-label="getNoRetur(item)"
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
                <h1 class="text-2xl font-bold">Transaksi Purchase Return Subcon</h1>
                <p class="text-sm text-muted-foreground">Kelola data Purchase Return Subcon</p>
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
                    :class="getApprovalStatusFilterClass('IN APPROVAL', filterStatus === 'IN APPROVAL')"
                    @click="filterStatus = filterStatus === 'IN APPROVAL' ? null : 'IN APPROVAL'">
                    IN APPROVAL
                </Button>
                <Button variant="outline" size="sm"
                    :class="getApprovalStatusFilterClass('APPROVED', filterStatus === 'APPROVED')"
                    @click="filterStatus = filterStatus === 'APPROVED' ? null : 'APPROVED'">
                    APPROVED
                </Button>
                <Button variant="outline" size="sm"
                    :class="getApprovalStatusFilterClass('REJECT', filterStatus === 'REJECT')"
                    @click="filterStatus = filterStatus === 'REJECT' ? null : 'REJECT'">
                    REJECT
                </Button>
                <Button variant="outline" size="sm"
                    :class="getApprovalStatusFilterClass('REVISI', filterStatus === 'REVISI')"
                    @click="filterStatus = filterStatus === 'REVISI' ? null : 'REVISI'">
                    REVISI
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
                    <SendApprovalButton
                        path="/purchasing/subcon/t_purchase_return_subcon"
                        :status="selectedItem?.status"
                        :ignore-permission="true"
                        variant="default"
                        size="default"
                        :showLabel="true"
                        :disabled="!isActive"
                        @click="openSendApprovalDialog()"
                    />
                    <HistoryApprovalButton
                        :record-id="selectedItem?.id || ''"
                        notification-endpoint="t_purchase_return_subcon_notifikasi"
                        foreign-key-column="t_purchase_return_subcon_id"
                        :record-label="selectedItem ? getNoRetur(selectedItem) : 'Tanpa Nomor'"
                        variant="outline"
                        size="default"
                        :show-label="true"
                        :disabled="!isActive"
                    />
                </div>
            </div>
        </div>

        <!-- TABLE -->
        <DataTable :data="filteredData" :columns="columns" :loading="loading" :loading-more="loadingMore"
            :has-more="hasMoreData" :row-select-mode="true" :api-filter-mode="true" @load-more="handleLoadMore"
            @row-select="(item) => selectItem(item, 0)" @row-deselect="deselectItem"
            @filter-change="handleTableFilterChange">
            <template #empty>
                Tidak ada data Purchase Return Subcon
            </template>
        </DataTable>
    </div>

    <!-- ================================================================ -->
    <!-- DELETE CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <GlobalDialog
        :open="isDeleteDialogOpen"
        title="Hapus Purchase Return Subcon"
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
                    <p class="text-sm font-medium">Purchase Return Subcon:</p>
                    <p class="text-sm text-muted-foreground">{{ getNoRetur(itemToSendApproval) }}</p>
                </div>

                <!-- SENDER INFO -->
                <div v-if="currentApprovalInfo" class="space-y-3">
                    <div class="flex items-center justify-between">
                        <p class="text-sm font-medium">Pengirim:</p>
                        <p class="text-sm text-muted-foreground">{{ currentApprovalInfo.sender_name }}</p>
                    </div>

                    <div class="flex items-center justify-between">
                        <p class="text-sm font-medium">Tipe Approval:</p>
                        <p class="text-sm font-medium text-primary">{{ currentApprovalInfo.tipe_approve }}</p>
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
