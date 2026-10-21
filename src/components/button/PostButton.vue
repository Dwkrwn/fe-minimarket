<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Send } from 'lucide-vue-next'

interface PostButtonProps {
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
  /** Loading state */
  loading?: boolean
  /** Show label text next to icon */
  showLabel?: boolean
  /** Custom label text */
  label?: string
}

withDefaults(defineProps<PostButtonProps>(), {
  disabled: false,
  size: 'default',
  variant: 'default',
  behavior: 'disable',
  loading: false,
  showLabel: true,
  label: 'Post'
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
    v-permission="{ menuId, action: 'update', behavior }"
    :variant="variant"
    :size="size"
    :disabled="disabled || loading"
    :class="['gap-2', { 'opacity-50 cursor-not-allowed': disabled }]"
    @click="handleClick"
    title="Post / Kirim"
  >
    <Send class="h-4 w-4" :class="{ 'animate-pulse': loading }" />
    <span v-if="showLabel">{{ loading ? 'Memposting...' : label }}</span>
  </Button>
  <Button
    v-else
    :variant="variant"
    :size="size"
    :disabled="disabled || loading"
    :class="['gap-2', { 'opacity-50 cursor-not-allowed': disabled }]"
    @click="handleClick"
    title="Post / Kirim"
  >
    <Send class="h-4 w-4" :class="{ 'animate-pulse': loading }" />
    <span v-if="showLabel">{{ loading ? 'Memposting...' : label }}</span>
  </Button>
</template>
