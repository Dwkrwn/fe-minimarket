<script setup lang="ts">
import { ref, computed } from 'vue'
import { History, User, Clock, MessageSquare, ShieldCheck } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { getApprovalStatusBadgeClass } from '@/lib/approvalStatus'

// Disable automatic attribute inheritance (we handle it manually)
defineOptions({
    inheritAttrs: false
})

// ============================================================================
// PROPS & EMITS
// ============================================================================
interface Props {
    /** The ID of the record to fetch history for */
    recordId: string
    /** The notification table endpoint (e.g., 't_purchase_request_notifikasi') */
    notificationEndpoint: string
    /** The foreign key column name (e.g., 't_purchase_request_id') */
    foreignKeyColumn: string
    /** Display label for the record (e.g., 'PREQ-0001-301125') */
    recordLabel?: string
    /** Button variant */
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
    /** Button size */
    size?: 'default' | 'sm' | 'lg' | 'icon'
    /** Show label text */
    showLabel?: boolean
    /** Disabled state */
    disabled?: boolean
    /** Document status (e.g., 'APPROVED', 'DRAFT') - used for Super Admin auto-approval display */
    documentStatus?: string
    /** Tipe user who created the document (e.g., 'SUPER ADMIN') */
    createdByTipeUser?: string
    /** Name of user who created the document */
    createdByName?: string
    /** Created at date */
    createdAt?: string
}

const props = withDefaults(defineProps<Props>(), {
    variant: 'outline',
    size: 'default',
    showLabel: true,
    disabled: false,
    recordLabel: '',
    documentStatus: '',
    createdByTipeUser: '',
    createdByName: '',
    createdAt: ''
})

// ============================================================================
// COMPOSABLES
// ============================================================================
const { API_BASE_URL } = useApi()
const authStore = useAuthStore()

// ============================================================================
// STATE
// ============================================================================
interface ApprovalHistoryItem {
    id: string
    title: string
    approval_message: string
    approval_catatan: string | null
    sender_id: string
    approval_level: number
    status: boolean
    status_name: string
    user_approved_id: string | null
    createdAt: string
    updatedAt: string
    user_default?: {
        id: string
        name: string
    }
    // Dynamic fields for sender and approval relations
    // Pattern: {prefix}_sender, {prefix}_approval (e.g., tpr_sender, tpo_sender, tpo_approval, etc.)
    [key: string]: any
}

const isDialogOpen = ref(false)
const approvalHistory = ref<ApprovalHistoryItem[]>([])
const isLoading = ref(false)

// Extract prefix from notification endpoint (e.g., 't_purchase_request_notifikasi' -> 'tpr')
// Used for dynamic relation names (_sender, _approval)
const relationPrefix = computed(() => {
    // Extract table name without '_notifikasi' suffix
    const tableName = props.notificationEndpoint.replace('_notifikasi', '')
    // Create acronym from table name (e.g., 't_purchase_request' -> 'tpr', 't_purchase_order' -> 'tpo')
    const parts = tableName.split('_')
    return parts.map(part => part.charAt(0)).join('')
})

// Check if this is a Super Admin auto-approval (no history but status is APPROVED and created by Super Admin)
const isSuperAdminAutoApproval = computed(() => {
    const isSuperAdmin = props.createdByTipeUser?.toUpperCase() === 'SUPER ADMIN'
    const isApproved = props.documentStatus?.toUpperCase() === 'APPROVED'
    const noHistory = approvalHistory.value.length === 0
    return isSuperAdmin && isApproved && noHistory && !isLoading.value
})

// ============================================================================
// FUNCTIONS
// ============================================================================
/** Open dialog and fetch history */
const openDialog = async () => {
    if (props.disabled || !props.recordId) return
    
    isDialogOpen.value = true
    await fetchHistory()
}

/** Fetch approval history from API */
const fetchHistory = async () => {
    isLoading.value = true
    approvalHistory.value = []
    
    try {
        // Include user_default only - backend will automatically map to aliases like tpo_sender, tpo_approval, etc.
        const response = await fetch(
            `${API_BASE_URL}/dynamic/${props.notificationEndpoint}?include=user_default:id|name&no_pagination=true&filter_column_${props.foreignKeyColumn}=${props.recordId}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authStore.token}`
                }
            }
        )
        
        const result = await response.json()
        
        if (result.status === 'success') {
            // Sort by createdAt descending (newest first)
            approvalHistory.value = (result.data || []).sort((a: ApprovalHistoryItem, b: ApprovalHistoryItem) => 
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )
        } else {
            toast.error('Gagal memuat history approval')
        }
    } catch (error) {
        toast.error('Gagal memuat history approval', {
            description: error instanceof Error ? error.message : 'Terjadi kesalahan'
        })
    } finally {
        isLoading.value = false
    }
}

/** Close dialog */
const closeDialog = () => {
    isDialogOpen.value = false
    approvalHistory.value = []
}

/** Format datetime for display */
const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })
}

/** Get status style for history item */
const getStatusStyle = getApprovalStatusBadgeClass

/** Get sender name - dynamically find field ending with _sender, fallback to user_default */
const getSenderName = (item: ApprovalHistoryItem) => {
    // Find field ending with _sender (e.g., tpr_sender, tpo_sender, etc.)
    const senderKey = Object.keys(item).find(key => key.endsWith('_sender'))
    if (senderKey && (item as any)[senderKey]?.name) {
        return (item as any)[senderKey].name
    }
    // Fallback to user_default
    return item.user_default?.name || '-'
}

/** Get approver name - dynamically find field ending with _approval */
const getApproverName = (item: ApprovalHistoryItem) => {
    // Find field ending with _approval (e.g., tpr_approval, tpo_approval, etc.)
    const approvalKey = Object.keys(item).find(key => key.endsWith('_approval'))
    if (approvalKey && (item as any)[approvalKey]?.name) {
        return (item as any)[approvalKey].name
    }
    return null
}
</script>

<template>
    <span class="inline-flex">
        <!-- Button -->
        <Button 
            :variant="variant"
            :size="size"
            :disabled="disabled || !recordId"
            :class="showLabel ? 'gap-2' : ''"
            @click.stop="openDialog"
            title="History Approval"
        >
            <History class="h-4 w-4" />
            <span v-if="showLabel">History</span>
        </Button>

        <!-- Dialog -->
        <Dialog :open="isDialogOpen" @update:open="isDialogOpen = $event">
            <DialogContent class="max-w-lg sm:max-w-xl p-0 gap-0">
                <DialogHeader class="px-4 pt-4 pb-3 border-b">
                    <div class="flex items-center gap-3">
                        <div class="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10">
                            <History class="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <DialogTitle class="text-base">History Approval</DialogTitle>
                            <DialogDescription class="sr-only">
                                Daftar riwayat approval untuk dokumen ini
                            </DialogDescription>
                            <p v-if="recordLabel" class="text-xs text-muted-foreground">
                                {{ recordLabel }}
                            </p>
                        </div>
                    </div>
                </DialogHeader>

                <div class="overflow-y-auto max-h-[50vh] px-4 py-3">
                    <!-- Loading State -->
                    <div v-if="isLoading" class="space-y-3">
                        <div v-for="i in 3" :key="i" class="p-3 border rounded-lg">
                            <Skeleton class="h-4 w-1/3 mb-2" />
                            <Skeleton class="h-3 w-full mb-1" />
                            <Skeleton class="h-3 w-2/3" />
                        </div>
                    </div>

                    <!-- Super Admin Auto-Approval State -->
                    <div v-else-if="isSuperAdminAutoApproval" class="p-4 border rounded-lg bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                        <div class="flex items-start gap-3">
                            <div class="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 shrink-0">
                                <ShieldCheck class="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-2">
                                    <Badge variant="outline" :class="getStatusStyle('APPROVED')" class="text-xs border-0">APPROVED</Badge>
                                    <span class="text-xs text-muted-foreground">Auto-Approval</span>
                                </div>
                                <p class="text-sm font-medium text-green-800 dark:text-green-300">
                                    Approved by Super Admin
                                </p>
                                <div class="flex items-center gap-2 mt-2 text-sm">
                                    <User class="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                                    <span class="font-medium">{{ props.createdByName || 'Super Admin' }}</span>
                                </div>
                                <div v-if="props.createdAt" class="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                    <Clock class="h-3 w-3" />
                                    <span>{{ formatDateTime(props.createdAt) }}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Empty State -->
                    <div v-else-if="approvalHistory.length === 0" class="text-center py-8">
                        <History class="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                        <p class="text-sm text-muted-foreground">Belum ada history approval</p>
                    </div>

                    <!-- History List -->
                    <div v-else class="space-y-3">
                        <div 
                            v-for="item in approvalHistory" 
                            :key="item.id"
                            class="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                            <!-- Header -->
                            <div class="flex items-start justify-between gap-2 mb-2">
                                <div class="flex items-center gap-2">
                                    <div class="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                                        {{ item.approval_level }}
                                    </div>
                                    <Badge variant="outline" :class="getStatusStyle(item.status_name)" class="text-xs border-0">
                                        {{ item.status_name }}
                                    </Badge>
                                </div>
                                <div class="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                                    <Clock class="h-3 w-3" />
                                    {{ formatDateTime(item.createdAt) }}
                                </div>
                            </div>

                            <!-- Content -->
                            <div class="space-y-1.5 ml-7 text-sm">
                                <!-- Sender -->
                                <div class="flex items-center gap-2">
                                    <User class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span class="text-muted-foreground">Pengaju:</span>
                                    <span class="font-medium truncate">{{ getSenderName(item) }}</span>
                                </div>

                                <!-- Approver (if exists) -->
                                <div v-if="getApproverName(item)" class="flex items-center gap-2">
                                    <User class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span class="text-muted-foreground">Approver:</span>
                                    <span class="font-medium truncate">{{ getApproverName(item) }}</span>
                                </div>

                                <!-- Pesan Pengaju (approval_message) - untuk IN APPROVAL -->
                                <div v-if="item.approval_message && item.approval_level === 0" class="flex items-start gap-2">
                                    <MessageSquare class="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                    <div class="min-w-0">
                                        <span class="text-muted-foreground">Pesan:</span>
                                        <p class="text-foreground mt-0.5 wrap-break-word">{{ item.approval_message }}</p>
                                    </div>
                                </div>

                                <!-- Catatan Approver (approval_catatan) - untuk REVISI/APPROVED/REJECT -->
                                <div v-if="item.approval_catatan" class="flex items-start gap-2">
                                    <MessageSquare class="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                    <div class="min-w-0">
                                        <span class="text-muted-foreground">Catatan:</span>
                                        <p class="text-foreground mt-0.5 wrap-break-word">{{ item.approval_catatan }}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter class="px-4 py-3 border-t">
                    <Button variant="outline" size="sm" @click="closeDialog">
                        Tutup
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </span>
</template>
