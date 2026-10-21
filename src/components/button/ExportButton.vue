<script setup lang="ts">
import { FileDown } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

interface ExportButtonProps {
  /** Menu ID for permission check */
  menuId?: string
  /** Whether button should be active (enabled) */
  disabled?: boolean
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon'
  /** Button variant */
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  /** Permission behavior: 'disable' (default) or 'hide' */
  behavior?: 'disable' | 'hide'
  /** Tooltip text */
  tooltip?: string
}

withDefaults(defineProps<ExportButtonProps>(), {
  disabled: false,
  size: 'icon',
  variant: 'outline',
  behavior: 'disable',
  tooltip: 'Download'
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const handleClick = (event: MouseEvent) => {
  emit('click', event)
}
</script>

<template>
  <Button
    v-if="menuId"
    v-permission="{ menuId, action: 'print', behavior }"
    :variant="variant"
    :size="size"
    :disabled="disabled"
    :title="tooltip"
    @click="handleClick"
  >
    <FileDown class="h-4 w-4" />
  </Button>
  <Button
    v-else
    :variant="variant"
    :size="size"
    :disabled="disabled"
    :title="tooltip"
    @click="handleClick"
  >
    <FileDown class="h-4 w-4" />
  </Button>
</template>
