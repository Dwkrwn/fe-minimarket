<script setup lang="ts">
import { Printer } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

interface PrintButtonProps {
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
}

withDefaults(defineProps<PrintButtonProps>(), {
  disabled: false,
  size: 'icon',
  variant: 'outline',
  behavior: 'disable'
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
    :class="{ 'opacity-50 cursor-not-allowed': disabled }"
    :disabled="disabled"
    @click="handleClick"
    title="Cetak / Print"
  >
    <Printer class="h-4 w-4" />
  </Button>
  <Button
    v-else
    :variant="variant"
    :size="size"
    :class="{ 'opacity-50 cursor-not-allowed': disabled }"
    :disabled="disabled"
    @click="handleClick"
    title="Cetak / Print"
  >
    <Printer class="h-4 w-4" />
  </Button>
</template>
