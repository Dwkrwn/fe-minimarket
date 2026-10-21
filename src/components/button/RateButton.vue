<script setup lang="ts">
import { DollarSign } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

interface RateButtonProps {
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

withDefaults(defineProps<RateButtonProps>(), {
  disabled: false,
  size: 'icon',
  variant: 'outline',
  behavior: 'disable'
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const handleClick = (e: MouseEvent) => {
  emit('click', e)
}
</script>

<template>
  <Button
    v-if="menuId"
    v-permission="{ menuId, action: 'create', behavior }"
    :variant="variant"
    :size="size"
    :disabled="disabled"
    :class="{ 'opacity-50 cursor-not-allowed': disabled }"
    title="Tambah Rate"
    @click="handleClick"
  >
    <DollarSign class="h-4 w-4" />
  </Button>
  <Button
    v-else
    :variant="variant"
    :size="size"
    :disabled="disabled"
    :class="{ 'opacity-50 cursor-not-allowed': disabled }"
    title="Tambah Rate"
    @click="handleClick"
  >
    <DollarSign class="h-4 w-4" />
  </Button>
</template>
