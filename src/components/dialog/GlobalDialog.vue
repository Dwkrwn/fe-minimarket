<script setup lang="ts">
import { AlertTriangle, AlertCircle, CheckCircle, Info } from 'lucide-vue-next'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type AlertType = 'danger' | 'warning' | 'success' | 'info'

interface Props {
  open: boolean
  title: string
  description: string
  type?: AlertType
  contentClass?: string
  confirmText?: string
  cancelText?: string
  isLoading?: boolean
  isDangerous?: boolean
  showCancel?: boolean
  persistent?: boolean
  logoSrc?: string
  logoAlt?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'warning',
  confirmText: undefined,
  cancelText: 'Cancel',
  isLoading: false,
  isDangerous: false,
  showCancel: true,
  persistent: false,
  contentClass: 'max-w-md',
  logoSrc: undefined,
  logoAlt: 'Logo',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
  cancel: []
}>()

const iconMap = {
  danger: AlertTriangle,
  warning: AlertTriangle,
  success: CheckCircle,
  info: Info,
}

const getIconColor = () => {
  switch (props.type) {
    case 'danger':
      return 'text-destructive'
    case 'warning':
      return 'text-amber-600'
    case 'success':
      return 'text-green-600'
    case 'info':
      return 'text-blue-600'
    default:
      return 'text-muted-foreground'
  }
}

const getBackgroundColor = () => {
  switch (props.type) {
    case 'danger':
      return 'bg-destructive/10'
    case 'warning':
      return 'bg-amber-50'
    case 'success':
      return 'bg-green-50'
    case 'info':
      return 'bg-blue-50'
    default:
      return 'bg-muted/10'
  }
}

const getButtonVariant = () => {
  switch (props.type) {
    case 'danger':
      return 'destructive'
    case 'warning':
      return 'destructive'
    case 'success':
      return 'default'
    case 'info':
      return 'default'
    default:
      return 'default'
  }
}

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
  emit('update:open', false)
}

const handleOpenChange = (value: boolean) => {
  if (!value && props.persistent) return
  emit('update:open', value)
}

const handleInteractOutside = (event: Event) => {
  if (props.persistent) {
    event.preventDefault()
    return
  }
  
  // Prevent closing when interacting with teleported FieldSelect dropdowns
  const target = event.target as HTMLElement
  if (target) {
    // Check if click is on a teleported dropdown (by checking specific classes or z-index)
    const isDropdownClick = target.closest('[data-field-select-dropdown]') || 
                           target.closest('.z-9999') ||
                           target.closest('[role="listbox"]') ||
                           target.closest('[role="option"]')
    
    if (isDropdownClick) {
      event.preventDefault()
      return
    }
  }
}

const Icon = computed(() => iconMap[props.type])
</script>

<template>
  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent :class="contentClass" @interactOutside="handleInteractOutside">
      <DialogHeader>
        <div class="flex items-center gap-3 mb-2">
          <div
            v-if="logoSrc"
            class="flex items-center justify-center w-10 h-10 rounded-full border bg-white overflow-hidden"
          >
            <img :src="logoSrc" :alt="logoAlt" class="h-8 w-8 object-contain" />
          </div>
          <div v-else :class="['flex items-center justify-center w-10 h-10 rounded-full', getBackgroundColor()]">
            <component :is="Icon" :class="['w-5 h-5', getIconColor()]" />
          </div>
          <DialogTitle class="text-lg">{{ title }}</DialogTitle>
        </div>
        <DialogDescription class="text-sm text-muted-foreground mt-2">
          {{ description }}
        </DialogDescription>
      </DialogHeader>

      <div class="py-2">
        <slot />
      </div>

      <DialogFooter class="gap-2">
        <Button v-if="showCancel" variant="outline" @click="handleCancel" :disabled="isLoading">
          {{ cancelText }}
        </Button>
        <Button v-if="confirmText !== undefined && confirmText !== null" :variant="getButtonVariant()" @click="handleConfirm" :disabled="isLoading" class="gap-2"
          :class="{ 'w-full': !showCancel }">
          <span v-if="isLoading">{{ confirmText }}...</span>
          <span v-else>{{ confirmText }}</span>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
