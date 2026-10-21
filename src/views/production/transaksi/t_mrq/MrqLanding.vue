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
import { DeleteButton, ExportButton, EditButton, CopyButton, ViewButton, PostButton, SendApprovalButton, HistoryApprovalButton } from '@/components/button'
import { FieldX } from '@/components/field'
import { useActionButtons } from '@/composables/useActionButtons'
import { usePermission } from '@/composables/usePermission'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { getMrqList, deleteMrq, postMrq, checkMrqQtyIsOver, sendMrqApproval, updateMrqStatus, type MrqItem } from './service'
import { getApprovalStatusBadgeClass, getApprovalStatusFilterClass } from '@/lib/approvalStatus'

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
const itemToDelete = ref<MrqItem | null>(null)
const isDeleting = ref(false)

// ============================================================================
// SEND APPROVAL DIALOG STATE
// ============================================================================
const isSendApprovalDialogOpen = ref(false)
const itemToSendApproval = ref<MrqItem | null>(null)
const approvalCatatan = ref('')
const isSendingApproval = ref(false)

// Get current approval info from localStorage
const currentApprovalInfo = computed(() => {
    const approvalList = authStore.getApprovalList()
    return approvalList.find((approval: any) =>
        approval.path === '/production/transaksi/t_mrq' &&
        approval.tipe_approve?.toUpperCase() === 'MENGAJUKAN'
    )
})

// Check if selected item has locked status (POST)
const isStatusLocked = computed(() => {
    if (!selectedItem.value) return false
    const status = selectedItem.value.status?.toUpperCase()
    return status === 'POST' || status === 'APPROVED' || status === 'REJECTED'
})

// Check if item can be edited/deleted (has selection AND status is not locked)
// Exception: Super Admin can always edit/delete
const canEditOrDelete = computed(() => {
    if (isSuperAdmin.value) return isActive.value
    return isActive.value && !isStatusLocked.value
})

// Helper function to check if specific item has locked status
const isItemStatusLocked = (item: MrqItem) => {
    const status = item.status?.toUpperCase()
    return status === 'POST'
}

// Helper function to check if item can be deleted (only DRAFT for non-Super Admin)
const canDeleteItem = (item: MrqItem) => {
    if (isSuperAdmin.value) return true
    const status = item.status?.toUpperCase()
    return status === 'DRAFT'
}

// Helper function to check if item can be edited (only DRAFT for non-Super Admin)
const canEditItem = (item: MrqItem) => {
    if (isSuperAdmin.value) return true
    const status = item.status?.toUpperCase()
    return status === 'DRAFT' || status === 'REVISI'
}

// Helper function to check if item can send approval (only DRAFT, REVISI)
const canSendApprovalItem = (item: MrqItem) => {
    const status = item.status?.toUpperCase()
    return status === 'DRAFT' || status === 'REVISI'
}

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<MrqItem[]>([])
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

type ColumnFilters = Record<string, string>
type ColumnFilterOperators = Record<string, string>
type DateRangeFilters = Record<string, { from: string; to: string }>

const tableColumnFilters = ref<ColumnFilters>({})
const tableColumnFilterOperators = ref<ColumnFilterOperators>({})
const tableDateRangeFilters = ref<DateRangeFilters>({})
const tableWhereClause = ref('')

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const getMrqNo = (item: MrqItem | null | undefined) => item?.no || item?.no_t_mrq || 'Tanpa Nomor'
const getMrqDate = (item: MrqItem | null | undefined) => item?.date || item?.tgl_t_mrq || ''
const getMrqNotes = (item: MrqItem | null | undefined) => item?.notes || item?.catatan || ''

const columns = [
    {
        key: 'no',
        label: 'No. Material Request',
        filterable: true,
        width: '150px',
        renderHtml: (item: MrqItem) => getMrqNo(item)
    },
    {
        key: 'date',
        label: 'Tanggal',
        filterable: false,
        width: '150px',
        renderHtml: (item: MrqItem) => {
            const date = getMrqDate(item)
            return date ? new Date(date).toLocaleDateString('id-ID') : '-'
        }
    },
    {
        key: 'm_unit_bisni.nama_comp',
        label: 'Unit Bisnis',
        filterable: true,
        width: '200px',
        valueGetter: (item: any) => item.m_unit_bisni?.nama_comp || item.m_unit_bisnis?.nama_comp || item.m_unit_bisni?.nama || '',
        renderHtml: (item: any) => item.m_unit_bisni?.nama_comp || item.m_unit_bisnis?.nama_comp || item.m_unit_bisni?.nama || '-'
    },
    {
        key: 'm_gudang.nama_gudang',
        label: 'Gudang',
        filterable: true,
        width: '200px',
        valueGetter: (item: any) => item.m_gudang?.nama_gudang || item.m_gudang?.nama || '',
        renderHtml: (item: any) => item.m_gudang?.nama_gudang || item.m_gudang?.nama || '-'
    },
    {
        key: 'notes',
        label: 'Catatan',
        filterable: true,
        width: '250px',
        renderHtml: (item: MrqItem) => getMrqNotes(item) || '-'
    },
    {
        key: 'status',
        label: 'Status',
        filterable: true,
        width: '150px',
        renderHtml: (item: MrqItem) => {
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
const getStatusStyle = getApprovalStatusBadgeClass

// ============================================================================
// COMPUTED PROPERTIES
// ============================================================================
/** Filter t_mrq data by status and relations */
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
    return `Apakah Anda yakin ingin menghapus Mrq "${getMrqNo(itemToDelete.value)}"? Tindakan ini tidak dapat dibatalkan.`
})

/** Deskripsi dialog send approval */
const sendApprovalDialogDescription = computed(() => {
    if (!itemToSendApproval.value) return ''
    return `Kirim Mrq "${getMrqNo(itemToSendApproval.value)}" untuk approval?`
})

// ============================================================================
// NAVIGATION FUNCTIONS
// ============================================================================
/** Navigate to create form */
const createNew = () => {
    router.push('/production/transaksi/t_mrq/form')
}

/** Navigate to edit form */
const editItem = (item?: MrqItem) => {
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

    router.push(`/production/transaksi/t_mrq/form/${selectedItem.value.id}`)
}

/** Navigate to copy (new form with data) */
const copyItem = (item?: MrqItem) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    router.push({
        path: '/production/transaksi/t_mrq/form',
        query: { copy: selectedItem.value.id }
    })
}

/** View Mrq item details */
const viewItem = (item?: any) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    // Navigate to view page (read-only mode)
    router.push(`/production/transaksi/t_mrq/view/${selectedItem.value.id}`)
}

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
/** Open delete confirmation dialog */
const deleteSelected = (item?: MrqItem) => {
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
        const response = await deleteMrq(itemToDelete.value.id)

        if (response.status === 'success') {
            // Remove from list
            menuData.value = menuData.value.filter((m: MrqItem) => m.id !== itemToDelete.value!.id)

            toast.success('Mrq berhasil dihapus')
            isDeleteDialogOpen.value = false
            deselectItem()
        } else {
            toast.error('Gagal menghapus Material Request', {
                description: response.message || 'Terjadi kesalahan saat menghapus'
            })
        }
    } catch (error) {
        toast.error('Gagal menghapus Material Request', {
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

const isPostDialogOpen = ref(false)
const itemToPost = ref<MrqItem | null>(null)
const isPosting = ref(false)

const postSelected = (item?: MrqItem) => {
    if (!canUpdate.value) {
        toast.error('Akses Ditolak', { description: 'Anda tidak memiliki izin untuk memposting data' })
        return
    }
    if (item) selectItem(item, 0)

    const activeItem = item || selectedItem.value
    if (!activeItem) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    if (activeItem.status !== 'DRAFT') {
        toast.error('Akses Ditolak', { description: 'Hanya data DRAFT yang dapat diposting' })
        return
    }

    itemToPost.value = activeItem
    isPostDialogOpen.value = true
}

const confirmPost = async () => {
    if (!itemToPost.value) return
    isPosting.value = true
    try {
        const response = await postMrq(itemToPost.value.id)
        if (response.status === 'success') {
            const index = menuData.value.findIndex(m => m.id === itemToPost.value!.id)
            if (index !== -1) {
                const currentItem = menuData.value[index]
                if (currentItem) {
                    menuData.value[index] = { ...currentItem, status: 'POST' }
                }
            }
            toast.success(`MRQ berhasil diposting`)
            isPostDialogOpen.value = false
            deselectItem()
        } else {
            toast.error('Gagal memposting Material Request')
        }
    } catch (e) {
        toast.error('Gagal memposting Material Request', { description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
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
// SEND APPROVAL FUNCTIONS
// ============================================================================
const openSendApprovalDialog = (item?: MrqItem) => {
    if (item) selectItem(item, 0)
    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }
    if (!canSendApprovalItem(selectedItem.value)) {
        toast.error('Tidak dapat mengirim approval', {
            description: `Data dengan status ${selectedItem.value.status} tidak dapat dikirim untuk approval`
        })
        return
    }
    itemToSendApproval.value = selectedItem.value
    approvalCatatan.value = ''
    isSendApprovalDialogOpen.value = true
}

const cancelSendApproval = () => {
    isSendApprovalDialogOpen.value = false
    itemToSendApproval.value = null
}

const confirmSendApproval = async () => {
    const target = itemToSendApproval.value
    if (!target?.id) return

    const approval = currentApprovalInfo.value
    if (!approval) {
        toast.error('Gagal mengirim approval', {
            description: 'Anda tidak memiliki hak untuk mengajukan approval'
        })
        return
    }
    if (approval.level === null || approval.level === undefined || !approval.sender_id) {
        toast.error('Data approval tidak lengkap', {
            description: 'Field yang hilang. Silakan hubungi administrator untuk melengkapi data approval Anda.',
            duration: 6000
        })
        return
    }

    isSendingApproval.value = true
    try {
        const mrqId = target.id
        const checkRes = await checkMrqQtyIsOver(mrqId)
        if (checkRes?.success !== true) {
            toast.error('Gagal memeriksa qty request', {
                description: checkRes?.message || 'Terjadi kesalahan saat memeriksa qty request'
            })
            return
        }
        const overflow = checkRes.needs_approval === true

        if (overflow) {
            const notifRes = await sendMrqApproval({
                t_mrq_id: mrqId,
                approval_level: approval.level,
                sender_id: approval.sender_id,
                approval_message: approvalCatatan.value.trim() || null,
            })
            if (notifRes.status !== 'success') {
                toast.error('Gagal mengirim approval', {
                    description: notifRes.message || 'Terjadi kesalahan saat mengirim approval'
                })
                return
            }
            await updateMrqStatus(mrqId, 'IN APPROVAL')
        } else {
            await updateMrqStatus(mrqId, 'APPROVED')
        }

        const itemIndex = menuData.value.findIndex((m: MrqItem) => m.id === mrqId)
        if (itemIndex !== -1) {
            const currentItem = menuData.value[itemIndex]
            if (currentItem) {
                menuData.value[itemIndex] = { ...currentItem, status: overflow ? 'IN APPROVAL' : 'APPROVED' }
            }
        }

        toast.success(overflow ? 'Approval berhasil dikirim' : 'MRQ langsung disetujui', {
            description: overflow
                ? checkRes.message || `Mrq "${getMrqNo(target)}" telah dikirim untuk approval`
                : `Mrq "${getMrqNo(target)}" disetujui karena qty request tidak melebihi qty available`
        })
        isSendApprovalDialogOpen.value = false
        itemToSendApproval.value = null
        deselectItem()
    } catch (error) {
        toast.error('Gagal mengirim approval', {
            description: error instanceof Error ? error.message : 'Terjadi kesalahan'
        })
    } finally {
        isSendingApproval.value = false
    }
}

// ============================================================================
// API DATA FETCHING
// ============================================================================
/** Fetch t_mrq data from API */
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

        const colFilters = { ...tableColumnFilters.value }
        let whereClauses: string[] = []
        if (tableWhereClause.value) whereClauses.push(tableWhereClause.value)

        const finalWhere = whereClauses.length > 0 ? whereClauses.join('|') : undefined

        // Generate filter_column_* keys for all columns (including relations)
        const allColumnFilters: Record<string, string> = {};
        Object.entries(colFilters).forEach(([key, value]) => {
            if (value?.trim()) {
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
            "$m_unit_bisni.nama_comp$",
            "$m_gudang.nama_gudang$"
        ].join(",");

        let effectiveSearch = searchApiQuery.value || undefined;
        let effectiveSearchFields = searchApiQuery.value ? globalSearchFields : undefined;

        const response = await getMrqList(
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
        toast.error('Gagal memuat data Mrq', {
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
                        <h1 class="text-lg font-bold">Transaksi Material Request</h1>
                        <p class="text-xs text-muted-foreground">Kelola data Material Request</p>
                    </div>
                    <Button variant="outline" size="icon" @click="handleRefresh" :disabled="loading" class="h-8 w-8">
                        <RefreshCw :class="['h-4 w-4', loading && 'animate-spin']" />
                    </Button>
                </div>

                <!-- Filter Status Buttons -->
                <div class="flex items-center gap-2 overflow-x-auto">
                    <Button variant="outline" size="sm" class="text-xs h-7 whitespace-nowrap"
                        :class="getApprovalStatusFilterClass('ALL', filterStatus === null)"
                        @click="filterStatus = null">
                        ALL
                    </Button>
                    <Button variant="outline" size="sm" class="text-xs h-7 whitespace-nowrap"
                        :class="getApprovalStatusFilterClass('DRAFT', filterStatus === 'DRAFT')"
                        @click="filterStatus = filterStatus === 'DRAFT' ? null : 'DRAFT'">
                        DRAFT
                    </Button>
                    <Button variant="outline" size="sm" class="text-xs h-7 whitespace-nowrap"
                        :class="getApprovalStatusFilterClass('POST', filterStatus === 'POST')"
                        @click="filterStatus = filterStatus === 'POST' ? null : 'POST'">
                        POST
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
                <Card v-for="item in filteredData" :key="item.id" class="cursor-pointer hover:shadow-md transition-all"
                    @click="selectItem(item, 0)">
                    <CardContent class="pt-3 pb-2 space-y-2">
                        <!-- Name & Status Row -->
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex-1 min-w-0">
                                <div class="font-semibold text-sm truncate">{{ getMrqNo(item) }}</div>
                                <div class="text-xs text-muted-foreground truncate">
                                    {{ getMrqDate(item) ? new Date(getMrqDate(item)).toLocaleDateString('id-ID') : '-'
                                    }}
                                </div>
                            </div>
                            <Badge :class="getStatusStyle(item.status || 'DRAFT')" class="text-xs shrink-0">
                                {{ item.status || 'DRAFT' }}
                            </Badge>
                        </div>

                        <!-- Details -->
                        <div class="text-xs space-y-1 text-muted-foreground">
                            <div v-if="item.m_unit_bisni" class="truncate">
                                <span class="font-medium">Unit Bisnis:</span> {{ item.m_unit_bisni?.nama_comp ||
                                item.m_unit_bisni?.nama || '-' }}
                            </div>
                            <div v-if="item.m_gudang" class="truncate">
                                <span class="font-medium">Gudang:</span> {{ item.m_gudang?.nama_gudang ||
                                item.m_gudang?.nama || '-' }}
                            </div>
                            <div v-if="getMrqNotes(item)" class="truncate">
                                <span class="font-medium">Catatan:</span> {{ getMrqNotes(item) }}
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="flex items-center gap-1 justify-end pt-2 border-t">
                            <ViewButton variant="ghost" size="sm" class="h-7 w-7" @click.stop="viewItem(item)" />
                            <DeleteButton v-permission="{ menuId: currentMenuId, action: 'delete' }" variant="ghost"
                                size="sm" class="h-7 w-7" :status="item.status" :disabled="!canDeleteItem(item)"
                                @click.stop="() => { selectItem(item, 0); deleteSelected() }" />
                            <EditButton v-permission="{ menuId: currentMenuId, action: 'update' }" variant="ghost"
                                size="sm" class="h-7 w-7" :status="item.status" :disabled="!canEditItem(item)"
                                @click.stop="editItem(item)" />
                            <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }" variant="ghost"
                                size="sm" class="h-7 w-7" @click.stop="copyItem(item)" />
                            <!-- <PostButton 
                                v-permission="{ menuId: currentMenuId, action: 'update' }"
                                variant="ghost" 
                                size="sm" 
                                :showLabel="false"
                                class="h-7 w-7"
                                 :disabled="!isActive || (selectedItem && selectedItem.status !== 'DRAFT' && selectedItem.status !== 'REVISI')"
                                @click.stop="() => { selectItem(item, 0); postSelected(item) }"
                            /> -->
                            <SendApprovalButton path="/production/transaksi/t_mrq" :status="item.status" variant="ghost"
                                size="sm" :showLabel="false" class="h-7 w-7" :disabled="!canSendApprovalItem(item)"
                                @click.stop="openSendApprovalDialog(item)" />
                            <HistoryApprovalButton :record-id="item.id || ''" notification-endpoint="t_mrq_notifikasi"
                                foreign-key-column="t_mrq_id" :record-label="item.no || 'Tanpa Nomor'" variant="ghost"
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
                <h1 class="text-2xl font-bold">Transaksi Material Request</h1>
                <p class="text-sm text-muted-foreground">Kelola data Material Request</p>
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
                <Button variant="outline" size="sm" :class="getApprovalStatusFilterClass('ALL', filterStatus === null)"
                    @click="filterStatus = null">
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
                    <DeleteButton v-permission="{ menuId: currentMenuId, action: 'delete' }"
                        :status="selectedItem?.status" :disabled="!canEditOrDelete" @click="() => deleteSelected()" />
                    <ViewButton :disabled="!isActive" @click="viewItem()" />
                    <EditButton v-permission="{ menuId: currentMenuId, action: 'update' }"
                        :status="selectedItem?.status" :disabled="!canEditItem" @click="editItem()" />
                    <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }" :disabled="!isActive"
                        @click="copyItem()" />
                    <!-- <PostButton 
                        v-permission="{ menuId: currentMenuId, action: 'update' }" 
                         :disabled="!isActive || (selectedItem && selectedItem.status !== 'DRAFT' && selectedItem.status !== 'REVISI')"
                        @click="() => postSelected()" 
                    /> -->
                    <SendApprovalButton path="/production/transaksi/t_mrq" :status="selectedItem?.status"
                        variant="default" size="default" :showLabel="true"
                        :disabled="!isActive || !canSendApprovalItem(selectedItem as any)"
                        @click="openSendApprovalDialog()" />
                    <HistoryApprovalButton :record-id="selectedItem?.id || ''" notification-endpoint="t_mrq_notifikasi"
                        foreign-key-column="t_mrq_id" :record-label="selectedItem?.no || 'Tanpa Nomor'" variant="outline"
                        size="default" :show-label="true"
                    :disabled="!isActive || !(selectedItem && ['POST', 'CONFIRM', 'APPROVED', 'IN APPROVAL', 'REJECT'].includes(selectedItem.status?.toUpperCase()))" />
                </div>
            </div>
        </div>

        <!-- TABLE -->
        <DataTable :data="filteredData" :columns="columns" :loading="loading" :loading-more="loadingMore"
            :has-more="hasMoreData" :row-select-mode="true" :api-filter-mode="true" @load-more="handleLoadMore"
            @row-select="(item) => selectItem(item, 0)" @row-deselect="deselectItem"
            @filter-change="handleTableFilterChange">
            <template #empty>
                Tidak ada data Material Request
            </template>
        </DataTable>
    </div>

    <!-- ================================================================ -->
    <!-- DELETE CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <GlobalDialog :open="isDeleteDialogOpen" title="Hapus Material Request" :description="deleteDialogDescription"
        type="danger" confirm-text="Hapus" cancel-text="Batal" :is-loading="isDeleting" @confirm="confirmDelete"
        @cancel="cancelDelete" @update:open="isDeleteDialogOpen = $event" />

    <!-- POST CONFIRMATION DIALOG -->
    <GlobalDialog :open="isPostDialogOpen" title="POST MRQ"
        :description="`Apakah Anda yakin ingin POST MRQ &quot;${getMrqNo(itemToPost)}&quot;? Setelah di-POST, data tidak bisa diedit atau dihapus lagi.`"
        type="warning" confirm-text="POST" cancel-text="Batal" :is-loading="isPosting" @confirm="confirmPost"
        @cancel="cancelPost" @update:open="isPostDialogOpen = $event" />

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
                <!-- MRQ INFO -->
                <div v-if="itemToSendApproval" class="p-3 bg-muted rounded-md">
                    <p class="text-sm font-medium">Material Request:</p>
                    <p class="text-sm text-muted-foreground">{{ getMrqNo(itemToSendApproval) }}</p>
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
                    <FieldX id="approval-catatan" type="textarea" v-model="approvalCatatan" label="Catatan Approval"
                        placeholder="Masukkan catatan untuk approval (opsional)"
                        hints="Catatan ini akan dikirim ke penerima approval" :disabled="isSendingApproval" :rows="4" />
                </div>
            </div>

            <DialogFooter class="gap-2">
                <Button variant="outline" @click="cancelSendApproval" :disabled="isSendingApproval">Batal</Button>
                <Button variant="default" @click="confirmSendApproval" :disabled="isSendingApproval" class="gap-2">
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
