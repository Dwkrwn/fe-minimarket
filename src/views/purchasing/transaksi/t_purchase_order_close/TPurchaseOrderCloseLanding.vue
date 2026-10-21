<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, computed, onMounted, onUnmounted, TransitionGroup, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Trash2, FileDown, Edit, Copy, RefreshCw, X, Plus, Info, Send } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import DataTable from '@/components/table/DataTable.vue'
import { BulkDeleteButton, DeleteButton, ExportButton, EditButton, CopyButton, ViewButton, SendApprovalButton, HistoryApprovalButton } from '@/components/button'
import { FieldX } from '@/components/field'
import { useActionButtons } from '@/composables/useActionButtons'
import { usePermission } from '@/composables/usePermission'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { getTPurchaseOrderCloseList, deleteTPurchaseOrderClose, bulkDeleteTPurchaseOrderClose, type TPurchaseOrderCloseItem } from './service'
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
const itemToDelete = ref<TPurchaseOrderCloseItem | null>(null)
const itemsToDelete = ref<TPurchaseOrderCloseItem[]>([])
const isDeleting = ref(false)

// ============================================================================
// SEND APPROVAL DIALOG STATE
// ============================================================================
const isSendApprovalDialogOpen = ref(false)
const itemToSendApproval = ref<TPurchaseOrderCloseItem | null>(null)
const isSendingApproval = ref(false)
const approvalCatatan = ref('')

// ============================================================================
// STATUS-BASED PERMISSION LOGIC
// ============================================================================
/**
 * STATUS RULES (Berlaku untuk SEMUA user termasuk Super Admin):
 * - DRAFT: Bisa Edit, Delete, Copy, View, Send Approval
 * - IN APPROVAL: Hanya bisa View, Copy, History (tidak bisa edit/delete/send)
 * - APPROVED: Hanya bisa View, Copy, History (tidak bisa edit/delete/send)
 * - REJECT: Hanya bisa View, Copy, History (tidak bisa edit/delete/send)
 * - REVISI: Bisa Edit, Delete, Copy, View, Send Approval (untuk kirim ulang)
 *
 * SUPER ADMIN: Sama seperti user biasa, mengikuti aturan status
 */

// Check if selected item has locked status (IN APPROVAL, APPROVED, REJECT)
const isStatusLocked = computed(() => {
    if (!selectedItem.value) return false
    const status = selectedItem.value.status?.toUpperCase()
    return status === 'IN APPROVAL' || status === 'APPROVED' || status === 'REJECT'
})

// Check if selected item can be deleted
// DRAFT, REVISI = bisa delete, yang lain tidak
const canDeleteSelected = computed(() => {
    if (!selectedItem.value) return false
    const status = (selectedItem.value.status || '').toUpperCase()
    return status === 'DRAFT' || status === 'REVISI'
})

// Check if selected item can be edited
// DRAFT, REVISI = bisa edit, yang lain tidak
const canEditSelected = computed(() => {
    if (!selectedItem.value) return false
    const status = (selectedItem.value.status || '').toUpperCase()
    return status === 'DRAFT' || status === 'REVISI'
})

// Check if selected item can send approval
// Hanya DRAFT dan REVISI yang bisa kirim approval
// Super Admin juga perlu send approval (sama seperti user biasa)
const canSendApprovalSelected = computed(() => {
    if (!selectedItem.value) return false
    const status = (selectedItem.value.status || '').toUpperCase()
    return status === 'DRAFT' || status === 'REVISI'
})

// Legacy computed for backward compatibility
const canEditOrDelete = computed(() => {
    return isActive.value && !isStatusLocked.value
})

// ============================================================================
// HELPER FUNCTIONS FOR ITEM-LEVEL CHECKS
// ============================================================================
/** Helper function to check if item has locked status */
const isItemStatusLocked = (item: TPurchaseOrderCloseItem) => {
    const status = item.status?.toUpperCase()
    return status === 'IN APPROVAL' || status === 'APPROVED' || status === 'REJECT'
}

/** Helper function to check if item can be deleted (only DRAFT, REVISI allowed) */
const canDeleteItem = (item: TPurchaseOrderCloseItem) => {
    const status = (item.status || '').toUpperCase()
    return status === 'DRAFT' || status === 'REVISI'
}

/** Helper function to check if item can be edited (DRAFT and REVISI allowed) */
const canEditItem = (item: TPurchaseOrderCloseItem) => {
    const status = (item.status || '').toUpperCase()
    return status === 'DRAFT' || status === 'REVISI'
}

/** Helper function to check if item can send approval (DRAFT and REVISI allowed) */
const canSendApproval = (item: TPurchaseOrderCloseItem) => {
    const status = (item.status || '').toUpperCase()
    return status === 'DRAFT' || status === 'REVISI'
}

// Get current approval info for sending approval
const currentApprovalInfo = computed(() => {
    const approvalList = authStore.getApprovalList()
    return approvalList.find((approval: any) =>
        approval.path === '/purchasing/transaksi/t_purchase_order_close' &&
        approval.tipe_approve?.toUpperCase() === 'MENGAJUKAN'
    )
})

// ============================================================================
// DATA & API STATE
// ============================================================================
const menuData = ref<TPurchaseOrderCloseItem[]>([])
const loading = ref(false)
const loadingMore = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)
const hasMoreData = ref(true)
const dataTableRef = ref<any>(null)

// ============================================================================
// BULK SELECTION STATE
// ============================================================================
const selectedItems = ref<TPurchaseOrderCloseItem[]>([])
const isMobileSelectionMode = ref(false)

// ============================================================================
// FILTER & SEARCH STATE
// ============================================================================
const filterStatus = ref<'DRAFT' | 'IN APPROVAL' | 'REJECT' | 'REVISI' | 'APPROVED' | null>(null)
const isDraftFilterActive = computed(() => filterStatus.value === 'DRAFT')
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
const tableWhereFilter = ref('')

// ============================================================================
// TABLE COLUMNS CONFIGURATION
// ============================================================================
const columns = [
    { key: 'no_po_close', label: 'No PO Close', filterable: true, width: '150px' },
    {
        key: 'tgl_po_close',
        label: 'Tanggal',
        filterable: true,
        filterType: 'date' as const,
        width: '120px',
        renderHtml: (item: TPurchaseOrderCloseItem) => {
            return item.tgl_po_close ? new Date(item.tgl_po_close).toLocaleDateString('id-ID') : '-'
        }
    },
    {
        key: 't_purchase_order.no_po',
        label: 'No. PO',
        filterable: true,
        width: '150px',
        renderHtml: (item: TPurchaseOrderCloseItem) => {
            return item.t_purchase_order?.no_po || '-'
        }
    },
    {
        key: 't_purchase_order.m_supplier.nama_supp',
        label: 'Supplier',
        filterable: true,
        width: '200px',
        renderHtml: (item: TPurchaseOrderCloseItem) => {
            return item.t_purchase_order?.m_supplier?.nama_supp || '-'
        }
    },
    { key: 'alasan', label: 'Alasan', filterable: true, width: '200px' },
    { key: 'catatan', label: 'Catatan', filterable: true, width: '200px' },
    {
        key: 'status',
        label: 'Status',
        filterable: true,
        width: '100px',
        renderHtml: (item: TPurchaseOrderCloseItem) => {
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
/** Filter t_purchase_order_close data by status */
const filteredData = computed(() => {
  if (!filterStatus.value) return menuData.value

  return menuData.value.filter(item => {
    const itemStatus = (item.status || '').toUpperCase()
    return itemStatus === filterStatus.value
  })
})

const isDraftItem = (item: TPurchaseOrderCloseItem | null | undefined) => {
    return (item?.status || 'DRAFT').toUpperCase() === 'DRAFT'
}

const selectedDraftCount = computed(
    () => selectedItems.value.filter((item) => isDraftItem(item)).length,
)

/**
 * Check if user can view all data
 * SUPER ADMIN dan DEVELOPER dapat melihat semua data
 * User biasa hanya melihat data yang dibuat sendiri
 */
const canViewAllData = computed(() => {
  // Super Admin dari usePermission sudah handle pengecekan
  if (isSuperAdmin) return true

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
    if (itemsToDelete.value.length > 1) {
        return `Apakah Anda yakin ingin menghapus ${itemsToDelete.value.length} Purchase Order Close berstatus DRAFT? Tindakan ini tidak dapat dibatalkan.`
    }
    if (!itemToDelete.value) return ''
    return `Apakah Anda yakin ingin menghapus Purchase Order Close "${itemToDelete.value.no_po_close || 'tanpa nomor'}"? Tindakan ini tidak dapat dibatalkan.`
})

/** Deskripsi dialog send approval */
const sendApprovalDialogDescription = computed(() => {
    if (!itemToSendApproval.value) return ''
    return `Kirim Purchase Order Close "${itemToSendApproval.value.no_po_close || 'tanpa nomor'}" untuk approval?`
})

// ============================================================================
// NAVIGATION FUNCTIONS
// ============================================================================
/** Navigate to create form */
const createNew = () => {
    router.push('/purchasing/transaksi/t_purchase_order_close/form')
}

/** Navigate to edit form */
const editItem = (item?: TPurchaseOrderCloseItem) => {
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

    router.push(`/purchasing/transaksi/t_purchase_order_close/form/${selectedItem.value.id}`)
}

/** Navigate to copy (new form with data) */
const copyItem = (item?: TPurchaseOrderCloseItem) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    router.push({
        path: '/purchasing/transaksi/t_purchase_order_close/form',
        query: {
            action: 'copy',
            source: selectedItem.value.id
        }
    })
}

/** View TPurchaseOrderClose item details */
const viewItem = (item?: any) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    // Navigate to view page (read-only mode)
    router.push(`/purchasing/transaksi/t_purchase_order_close/view/${selectedItem.value.id}`)
}

// ============================================================================
// DELETE FUNCTIONS
// ============================================================================
/** Open delete confirmation dialog */
const deleteSelected = (item?: TPurchaseOrderCloseItem | Event) => {
    const explicitItem = item && !(item instanceof Event) ? item : undefined
    const candidateItems =
        selectedItems.value.length > 1
            ? selectedItems.value
            : explicitItem
              ? [explicitItem]
              : selectedItems.value.length === 1
                ? selectedItems.value
                : selectedItem.value
                  ? [selectedItem.value]
                  : []

    if (candidateItems.length === 0) {
        toast.error('Pilih minimal 1 item terlebih dahulu')
        return
    }

    const deletableItems = candidateItems.filter((candidate) => isDraftItem(candidate))
    const skippedItems = candidateItems.filter((candidate) => !isDraftItem(candidate))

    if (skippedItems.length > 0) {
        toast.warning('Sebagian item tidak bisa dihapus', {
            description: `${skippedItems.length} item non-DRAFT diabaikan`,
        })
    }

    if (deletableItems.length === 0) {
        toast.error('Tidak dapat menghapus', {
            description: `Hanya Purchase Order Close dengan status DRAFT yang dapat dihapus`
        })
        return
    }

    itemsToDelete.value = deletableItems
    itemToDelete.value = deletableItems.length === 1 ? deletableItems[0] : null
    isDeleteDialogOpen.value = true
}

/** Confirm delete - call API */
const confirmDelete = async () => {
    const targetItems = itemsToDelete.value.length
        ? itemsToDelete.value
        : itemToDelete.value
          ? [itemToDelete.value]
          : []
    const targetIds = targetItems.map((item) => item.id).filter(Boolean) as string[]
    if (targetIds.length === 0) return

    isDeleting.value = true
    try {
        const response = targetIds.length > 1
            ? await bulkDeleteTPurchaseOrderClose(targetIds)
            : await deleteTPurchaseOrderClose(targetIds[0]!)

        if (response.status === 'success') {
            // Remove from list
            const deletedIds = new Set(targetIds)
            menuData.value = menuData.value.filter((m: TPurchaseOrderCloseItem) => !deletedIds.has(m.id || ''))

            toast.success(targetIds.length > 1 ? `${targetIds.length} Purchase Order Close berhasil dihapus` : 'Purchase Order Close berhasil dihapus')
            isDeleteDialogOpen.value = false
            clearAllSelection()
        } else {
            toast.error('Gagal menghapus Purchase Order Close', {
                description: response.message || 'Terjadi kesalahan saat menghapus'
            })
        }
    } catch (error) {
        toast.error('Gagal menghapus Purchase Order Close', {
            description: error instanceof Error ? error.message : 'Terjadi kesalahan'
        })
    } finally {
        isDeleting.value = false
        itemToDelete.value = null
        itemsToDelete.value = []
    }
}

const cancelDelete = () => {
    isDeleteDialogOpen.value = false
    itemToDelete.value = null
    itemsToDelete.value = []
}

// ============================================================================
// SEND APPROVAL FUNCTIONS
// ============================================================================
/** Open send approval dialog */
const openSendApprovalDialog = (item?: TPurchaseOrderCloseItem) => {
    if (item) {
        selectItem(item, 0)
    }

    if (!selectedItem.value) {
        toast.error('Pilih item terlebih dahulu')
        return
    }

    // Check if item can send approval (only DRAFT/REVISI allowed)
    if (!canSendApproval(selectedItem.value)) {
        toast.error('Tidak dapat mengirim approval', {
            description: `Hanya Purchase Order Close dengan status DRAFT atau REVISI yang dapat dikirim untuk approval`
        })
        return
    }

    itemToSendApproval.value = selectedItem.value
    approvalCatatan.value = ''
    isSendApprovalDialogOpen.value = true
}

/** Confirm send approval - hit API POST t_purchase_order_close_notifikasi */
const confirmSendApproval = async () => {
    if (!itemToSendApproval.value || !itemToSendApproval.value.id) return

    isSendingApproval.value = true
    try {
        // Get approval data from localStorage
        const approvalList = authStore.getApprovalList()
        const currentApproval = approvalList.find((approval: any) =>
            approval.path === '/purchasing/transaksi/t_purchase_order_close' &&
            approval.tipe_approve?.toUpperCase() === 'MENGAJUKAN'
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
            t_purchase_order_close_id: itemToSendApproval.value.id,
            approval_message: approvalCatatan.value.trim() || null
        }

        // Call API POST /dynamic/t_purchase_order_close_notifikasi
        const response = await fetch(
            `${API_BASE_URL}/dynamic/t_purchase_order_close_notifikasi`,
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
            const itemIndex = menuData.value.findIndex((m: TPurchaseOrderCloseItem) => m.id === itemToSendApproval.value!.id)
            if (itemIndex !== -1) {
                const updatedItem = { ...menuData.value[itemIndex], status: 'IN APPROVAL' } as TPurchaseOrderCloseItem
                menuData.value.splice(itemIndex, 1, updatedItem)
            }

            toast.success('Approval berhasil dikirim', {
                description: `Purchase Order Close "${itemToSendApproval.value.no_po_close || 'tanpa nomor'}" telah dikirim untuk approval`
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
/** Fetch t_purchase_order_close data from API */
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

        // Get company filter (only for non-SUPER ADMIN and non-ADMIN PURCHASING)
        let companyFilter: string | undefined = undefined
        const userRole = authStore.tipeUser?.value1?.trim().toUpperCase()
        const canViewAllCompanies = userRole === 'SUPER ADMIN' || userRole === 'ADMIN PURCHASING'

        if (!canViewAllCompanies) {
            const selectRespo = localStorage.getItem('SelectRespo')
            if (selectRespo) {
                const respoData = JSON.parse(selectRespo)
                companyFilter = respoData.companyId || undefined
            }
        }

        // Prepare column filters (add company filter for non-SUPER ADMIN)
        const filters: Record<string, string> = companyFilter ? { m_unit_bisnis_id: companyFilter } : {}

        Object.entries(tableColumnFilters.value).forEach(([key, value]) => {
            if (value && value.trim()) {
                filters[key] = value.trim()
            }
        })

        const response = await getTPurchaseOrderCloseList(
            page,
            pageSize.value,
            'createdAt',
            'DESC',
            searchApiQuery.value || undefined,
            searchApiQuery.value ? 'no_po_close,catatan,alasan,t_purchase_order.no_po,t_purchase_order.m_supplier.nama_supp,status' : undefined,
            filterCreatedBy,
            undefined, // include
            Object.keys(filters).length > 0 ? filters : undefined,
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
        toast.error('Gagal memuat data Purchase Order Close', {
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
    clearAllSelection(true)

    // Reload data
    await fetchMenuData(1, true)

    toast.success('Data berhasil dimuat ulang')
}

const selectionAnchor = ref<TPurchaseOrderCloseItem | null>(null)

const isDraftStatus = (item?: TPurchaseOrderCloseItem | null) =>
    (item?.status || '').toUpperCase() === 'DRAFT'

const handleSelectionChange = (items: TPurchaseOrderCloseItem[]) => {
    if (items.length === 0) {
        selectionAnchor.value = null
        selectedItems.value = []
        deselectItem()
        return
    }

    const firstItem = items[0]
    if (!firstItem) return
    const prevAnchor = selectionAnchor.value
    const anchor: TPurchaseOrderCloseItem =
        prevAnchor && items.some((i) => i.id === prevAnchor.id) ? prevAnchor : firstItem
    selectionAnchor.value = anchor

    if (!isDraftStatus(anchor)) {
        const anchorItem = items.find((i) => i.id === anchor.id) || anchor
        if (items.length > 1) {
            toast.warning('Tidak dapat memilih item lain', {
                description: `Item berstatus ${anchor.status} hanya dapat dipilih sendiri.`
            })
        }
        selectedItems.value = [anchorItem]
        selectItem(anchorItem, 0)
        return
    }

    const draftOnly = items.filter(isDraftStatus)
    if (items.some((i) => !isDraftStatus(i))) {
        toast.warning('Tidak dapat memilih item lain', {
            description: 'Hanya item berstatus DRAFT yang dapat dipilih bersama.'
        })
    }
    const allowed = draftOnly.length > 0 ? draftOnly : [anchor]
    selectedItems.value = allowed
    selectItem(allowed[allowed.length - 1] ?? anchor, 0)
}

const clearAllSelection = (exitMobileMode: boolean = false) => {
    selectedItems.value = []
    dataTableRef.value?.clearSelection?.()
    deselectItem()

    if (exitMobileMode) {
        isMobileSelectionMode.value = false
    }
}

const isItemSelected = (itemId?: string) => {
    if (!itemId) return false
    return selectedItems.value.some((selected) => selected.id === itemId)
}

const toggleMobileSelectionMode = () => {
    if (isMobileSelectionMode.value) {
        clearAllSelection(true)
        return
    }

    if (!isDraftFilterActive.value) {
        toast.info('Pilih filter DRAFT untuk memilih item')
        return
    }

    clearAllSelection()
    isMobileSelectionMode.value = true
}

const toggleMobileItemSelection = (item: TPurchaseOrderCloseItem) => {
    if (!isDraftItem(item) || !item.id) return

    const index = selectedItems.value.findIndex((selected) => selected.id === item.id)
    if (index !== -1) {
        selectedItems.value.splice(index, 1)
    } else {
        selectedItems.value.push(item)
    }

    deselectItem()
}

watch(filterStatus, () => {
    clearAllSelection(true)
})

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
    clearAllSelection(true)

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
    clearAllSelection(true)
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
                        <h1 class="text-lg font-bold">Transaksi Purchase Order Close</h1>
                        <p class="text-xs text-muted-foreground">Kelola data Purchase Order Close</p>
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
                            {{ isMobileSelectionMode ? 'Selesai' : 'Pilih' }}
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
                        placeholder="Cari no. PO Close, PO, supplier, alasan, catatan, status..."
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
                        <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="clearAllSelection()">
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
                        isMobileSelectionMode && isItemSelected(item.id) ? 'border-primary ring-2 ring-primary/20 shadow-sm' : '',
                    ]"
                    @click="isMobileSelectionMode ? toggleMobileItemSelection(item) : selectItem(item, 0)"
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
                                    <div class="font-semibold text-sm truncate">{{ item.no_po_close || 'Tanpa Nomor' }}</div>
                                    <div class="text-xs text-muted-foreground truncate">
                                        {{ item.tgl_po_close ? new Date(item.tgl_po_close).toLocaleDateString('id-ID') : '-' }}
                                    </div>
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
                            <div v-if="item.catatan" class="truncate">
                                <span class="font-medium">Catatan:</span> {{ item.catatan }}
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div v-if="!isMobileSelectionMode" class="flex items-center gap-1 justify-end pt-2 border-t">
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
                                path="/purchasing/transaksi/t_purchase_order_close"
                                :status="item.status"
                                variant="ghost"
                                size="sm"
                                :showLabel="false"
                                class="h-7 w-7"
                                :disabled="!canSendApproval(item)"
                                @click.stop="openSendApprovalDialog(item)"
                            />
                            <HistoryApprovalButton
                                :record-id="item.id || ''"
                                notification-endpoint="t_purchase_order_close_notifikasi"
                                foreign-key-column="t_purchase_order_close_id"
                                :record-label="item.no_po_close || 'Tanpa Nomor'"
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
                <h1 class="text-2xl font-bold">Transaksi Purchase Order Close</h1>
                <p class="text-sm text-muted-foreground">Kelola data Purchase Order Close</p>
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
                        <Input v-model="searchQuery" placeholder="Cari no. PO Close, PO, supplier, alasan, catatan, status..." class="pl-9 pr-8"
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
                        :disabled="!isActive || !isDraftItem(selectedItem)"
                        @click="() => deleteSelected()" />
                    <BulkDeleteButton
                        v-if="selectedItems.length > 1"
                        v-permission="{ menuId: currentMenuId, action: 'delete' }"
                        :count="selectedDraftCount"
                        :disabled="selectedDraftCount === 0"
                        @click="deleteSelected"
                    />
                    <ViewButton :disabled="!isActive" @click="viewItem()" />
                    <EditButton v-permission="{ menuId: currentMenuId, action: 'update' }" 
                        :status="selectedItem?.status"
                        :disabled="!canEditSelected"
                        @click="editItem()" />
                    <CopyButton v-permission="{ menuId: currentMenuId, action: 'create' }" :disabled="!isActive"
                        @click="copyItem()" />
                    <SendApprovalButton
                        path="/purchasing/transaksi/t_purchase_order_close"
                        :status="selectedItem?.status"
                        variant="default"
                        size="default"
                        :showLabel="true"
                        :disabled="!canSendApprovalSelected"
                        @click="openSendApprovalDialog()"
                    />
                    <HistoryApprovalButton
                        :record-id="selectedItem?.id || ''"
                        notification-endpoint="t_purchase_order_close_notifikasi"
                        foreign-key-column="t_purchase_order_close_id"
                        :record-label="selectedItem?.no_po_close || 'Tanpa Nomor'"
                        variant="outline"
                        size="default"
                        :show-label="true"
                        :disabled="!isActive"
                    />
                </div>
            </div>
        </div>

        <!-- TABLE -->
        <DataTable ref="dataTableRef" :data="filteredData" :columns="columns" :loading="loading" :loading-more="loadingMore"
            :has-more="hasMoreData" :row-select-mode="true" :multi-select-mode="true"
            :selected-items="selectedItems" :selection-checkbox-visible="() => true" :show-select-all="isDraftFilterActive"
            :api-filter-mode="true" @load-more="handleLoadMore" @selection-change="handleSelectionChange"
            @row-select="(item) => selectItem(item, 0)" @row-deselect="deselectItem"
            @filter-change="handleTableFilterChange"
            @refresh-requested="handleRefresh">
            <template #empty>
                Tidak ada data Purchase Order Close
            </template>
        </DataTable>
    </div>

    <!-- ================================================================ -->
    <!-- DELETE CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <GlobalDialog
        :open="isDeleteDialogOpen"
        title="Hapus Purchase Order Close"
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
                    <p class="text-sm font-medium">Purchase Order Close:</p>
                    <p class="text-sm text-muted-foreground">{{ itemToSendApproval.no_po_close || 'Tanpa Nomor' }}</p>
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
