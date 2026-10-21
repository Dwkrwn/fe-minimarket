<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import type { ApprovalData } from '@/stores/auth'

interface SendApprovalButtonProps {
  /** Current page path untuk matching dengan approval data */
  path?: string
  /** Current item status */
  status?: string | null
  /** Disabled state */
  disabled?: boolean
  /** Loading state */
  loading?: boolean
  /** Variant button */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  /** Size button */
  size?: 'default' | 'sm' | 'lg' | 'icon'
  /** Show label text */
  showLabel?: boolean
  /** Custom class */
  class?: string
  /** Ignore permission check */
  ignorePermission?: boolean
  /** Custom label */
  label?: string
}

const props = withDefaults(defineProps<SendApprovalButtonProps>(), {
  variant: 'default',
  size: 'default',
  showLabel: true,
  disabled: false,
  loading: false,
  status: null,
  ignorePermission: false,
  label: 'Send Approval'
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const authStore = useAuthStore()
const normalizePath = (path?: string | null) => {
  const cleaned = (path || '').trim().replace(/\/+$/, '').toLowerCase()
  if (!cleaned) return ''
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`
}
const isMengajukanType = (tipe?: string | null) => (tipe || '').trim().toUpperCase() === 'MENGAJUKAN'

// Get approval list from localStorage
const approvalList = computed((): ApprovalData[] => {
  return authStore.getApprovalList()
})

// Check if user has "MENGAJUKAN" approval for current path
const hasMengajukanApproval = computed((): boolean => {
  if (props.ignorePermission) return true
  if (!props.path) return false
  const currentPath = normalizePath(props.path)

  return approvalList.value.some((approval: ApprovalData) => {
    const pathMatch = normalizePath(approval.path) === currentPath
    const isMengajukan = isMengajukanType(approval.tipe_approve)

    return pathMatch && isMengajukan
  })
})

// Get approval data for current path with MENGAJUKAN type
const currentApproval = computed((): ApprovalData | undefined => {
  if (!props.path) return undefined
  const currentPath = normalizePath(props.path)

  return approvalList.value.find((approval: ApprovalData) => {
    const pathMatch = normalizePath(approval.path) === currentPath
    const isMengajukan = isMengajukanType(approval.tipe_approve)

    return pathMatch && isMengajukan
  })
})


// Check if status is IN APPROVAL, APPROVED, or REJECT
// REVISE status should allow send approval
const isApprovalLocked = computed((): boolean => {
  const s = props.status?.toUpperCase() || ''
  // If ignorePermission is true, allow POSTED to lock it? Or just let parent handle?
  // User wants to update to 'post', so 'POSTED' should probably be locked?
  // But let's keep original logic + POSTED if needed.
  // Standard SendApproval locks on IN APPROVAL, APPROVED, REJECT.
  // We'll keep it as is.
  return s === 'IN APPROVAL' || s === 'APPROVED' || s === 'REJECT' || s === 'POSTED'
})

// Button is enabled only if user has MENGAJUKAN approval and NOT locked
const isEnabled = computed((): boolean => {
  return hasMengajukanApproval.value && !props.disabled && !props.loading && !isApprovalLocked.value
})

// Tooltip message
const tooltipMessage = computed((): string => {
  if (props.loading) return 'Loading...'
  if (isApprovalLocked.value) {
    if (props.status?.toUpperCase() === 'APPROVED') return 'Item sudah APPROVED'
    if (props.status?.toUpperCase() === 'REJECT') return 'Item sudah REJECTED'
    if (props.status?.toUpperCase() === 'POSTED') return 'Item sudah POSTED'
    return 'Item sudah dalam proses approval'
  }
  if (props.disabled) return 'Tombol tidak aktif'
  if (!hasMengajukanApproval.value) return 'Anda tidak memiliki hak untuk mengajukan approval'
  return props.label
})

const handleClick = (event: MouseEvent) => {
  if (isEnabled.value) {
    emit('click', event)
  }
}
</script>

<template>
  <Button :variant="variant" :size="size" :disabled="!isEnabled" :class="[
    'gap-2',
    props.class,
    !isEnabled && 'cursor-not-allowed opacity-50'
  ]" :title="tooltipMessage" @click="handleClick">
    <Send :class="[
      'h-4 w-4',
      loading && 'animate-pulse'
    ]" />
    <span v-if="showLabel">{{ loading ? 'Mengirim...' : label }}</span>
  </Button>
</template>

<style scoped>
/* Add smooth transition */
button {
  transition: all 0.2s ease;
}
</style>
