<script setup lang="ts">
import { computed } from "vue";
import { Trash2 } from "lucide-vue-next";
import { Button } from "@/components/ui/button";

interface DeleteButtonProps {
  /** Menu ID for permission check */
  menuId?: string;
  /** Whether button should be active (enabled) */
  disabled?: boolean;
  /** Document status to determine locked state */
  status?: string | null;
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

const props = withDefaults(defineProps<DeleteButtonProps>(), {
  disabled: false,
  size: "icon",
  variant: "destructive",
  behavior: "disable",
  tooltip: "Delete",
});

const isLocked = computed(() => {
  if (!props.status) return false;
  const statusUpper = props.status.toUpperCase();
  return [
    "POST",
    "APPROVED",
    "APPROVED SYSTEM",
    "CONFIRM",
    "REVISI",
    "REVISE",
    "REVISIED",
    "IN APPROVAL",
    "REJECT",
  ].includes(statusUpper);
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const handleClick = (event: MouseEvent) => {
  emit("click", event);
};
</script>

<template>
  <template v-if="!isLocked">
    <Button
      v-if="menuId"
      v-permission="{ menuId, action: 'delete', behavior }"
      :variant="variant"
      :size="size"
      :disabled="disabled"
      :class="{ 'opacity-50 cursor-not-allowed': disabled }"
      :title="tooltip"
      @click="handleClick"
    >
      <Trash2 class="h-4 w-4" />
    </Button>
    <Button
      v-else
      :variant="variant"
      :size="size"
      :disabled="disabled"
      :class="{ 'opacity-50 cursor-not-allowed': disabled }"
      :title="tooltip"
      @click="handleClick"
    >
      <Trash2 class="h-4 w-4" />
    </Button>
  </template>
</template>

