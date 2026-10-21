<script setup lang="ts">
import { computed } from "vue";
import { Trash2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";

interface BulkDeleteButtonProps {
  /** Menu ID for permission check */
  menuId?: string;
  /** Whether button should be active (enabled) */
  disabled?: boolean;
  /** Selected item count */
  count?: number;
  /** Button size */
  size?: "default" | "sm" | "lg" | "icon";
  /** Button variant */
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  /** Permission behavior: 'disable' (default) or 'hide' */
  behavior?: "disable" | "hide";
  /** Tooltip text */
  tooltip?: string;
}

const props = withDefaults(defineProps<BulkDeleteButtonProps>(), {
  disabled: false,
  count: 0,
  size: "default",
  variant: "destructive",
  behavior: "disable",
  tooltip: "Bulk Delete",
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const buttonTitle = computed(() => {
  if (props.count > 0) {
    return `${props.tooltip} (${props.count})`;
  }

  return props.tooltip;
});

const handleClick = (event: MouseEvent) => {
  emit("click", event);
};
</script>

<template>
  <Button
    v-if="menuId"
    v-permission="{ menuId, action: 'delete', behavior }"
    :variant="variant"
    :size="size"
    :disabled="disabled"
    :title="buttonTitle"
    class="gap-2 whitespace-nowrap"
    :class="{ 'opacity-50 cursor-not-allowed': disabled }"
    @click="handleClick"
  >
    <Trash2 data-icon="inline-start" />
    <span v-if="size !== 'icon'">
      Bulk Delete<span v-if="count > 0"> ({{ count }})</span>
    </span>
  </Button>
  <Button
    v-else
    :variant="variant"
    :size="size"
    :disabled="disabled"
    :title="buttonTitle"
    class="gap-2 whitespace-nowrap"
    :class="{ 'opacity-50 cursor-not-allowed': disabled }"
    @click="handleClick"
  >
    <Trash2 data-icon="inline-start" />
    <span v-if="size !== 'icon'">
      Bulk Delete<span v-if="count > 0"> ({{ count }})</span>
    </span>
  </Button>
</template>
