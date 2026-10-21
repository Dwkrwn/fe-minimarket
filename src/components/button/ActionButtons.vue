<script setup lang="ts">
import { Trash2, FileDown, Edit, Copy } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

interface ActionButtonsProps {
  /** Menu ID for permission check */
  menuId?: string
  /** Whether action buttons should be active (enabled) */
  isActive?: boolean
  /** Show delete button */
  showDelete?: boolean
  /** Show export button */
  showExport?: boolean
  /** Show edit button */
  showEdit?: boolean
  /** Show copy button */
  showCopy?: boolean
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon'
  /** Permission behavior: 'disable' (default) or 'hide' */
  behavior?: 'disable' | 'hide'
}

withDefaults(defineProps<ActionButtonsProps>(), {
  isActive: false,
  showDelete: true,
  showExport: true,
  showEdit: true,
  showCopy: true,
  size: 'icon',
  behavior: 'disable'
})

const emit = defineEmits<{
  delete: []
  export: []
  edit: []
  copy: []
}>()
</script>

<template>
  <div class="flex items-center gap-2">
    <!-- Delete Button (requires 'delete' permission) -->
    <Button
      v-if="showDelete && menuId"
      v-permission="{ menuId, action: 'delete', behavior }"
      variant="destructive"
      :size="size"
      :disabled="!isActive"
      :class="{ 'opacity-50 cursor-not-allowed': !isActive }"
      @click="emit('delete')"
    >
      <Trash2 class="h-4 w-4" />
    </Button>
    <Button
      v-else-if="showDelete && !menuId"
      variant="destructive"
      :size="size"
      :disabled="!isActive"
      :class="{ 'opacity-50 cursor-not-allowed': !isActive }"
      @click="emit('delete')"
    >
      <Trash2 class="h-4 w-4" />
    </Button>

    <!-- Export Button (requires 'print' permission) -->
    <Button
      v-if="showExport && menuId"
      v-permission="{ menuId, action: 'print', behavior }"
      variant="outline"
      :size="size"
      @click="emit('export')"
    >
      <FileDown class="h-4 w-4" />
    </Button>
    <Button
      v-else-if="showExport && !menuId"
      variant="outline"
      :size="size"
      @click="emit('export')"
    >
      <FileDown class="h-4 w-4" />
    </Button>

    <!-- Edit Button (requires 'update' permission) -->
    <Button
      v-if="showEdit && menuId"
      v-permission="{ menuId, action: 'update', behavior }"
      variant="outline"
      :size="size"
      :disabled="!isActive"
      :class="{ 'opacity-50 cursor-not-allowed': !isActive }"
      @click="emit('edit')"
    >
      <Edit class="h-4 w-4" />
    </Button>
    <Button
      v-else-if="showEdit && !menuId"
      variant="outline"
      :size="size"
      :disabled="!isActive"
      :class="{ 'opacity-50 cursor-not-allowed': !isActive }"
      @click="emit('edit')"
    >
      <Edit class="h-4 w-4" />
    </Button>

    <!-- Copy Button (requires 'create' permission) -->
    <Button
      v-if="showCopy && menuId"
      v-permission="{ menuId, action: 'create', behavior }"
      variant="outline"
      :size="size"
      :disabled="!isActive"
      :class="{ 'opacity-50 cursor-not-allowed': !isActive }"
      @click="emit('copy')"
    >
      <Copy class="h-4 w-4" />
    </Button>
    <Button
      v-else-if="showCopy && !menuId"
      variant="outline"
      :size="size"
      :disabled="!isActive"
      :class="{ 'opacity-50 cursor-not-allowed': !isActive }"
      @click="emit('copy')"
    >
      <Copy class="h-4 w-4" />
    </Button>
  </div>
</template>
