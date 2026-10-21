<script setup lang="ts">
import { computed } from "vue";
import { Edit } from "lucide-vue-next";
import { Button } from "@/components/ui/button";

interface EditButtonProps {
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

const props = withDefaults(defineProps<EditButtonProps>(), {
  disabled: false,
  size: "icon",
  variant: "outline",
  behavior: "disable",
  tooltip: "Edit",
});

const isLocked = computed(() => {
  if (!props.status) return false;
  const statusUpper = props.status.toUpperCase();
  return [
    "POST",
    "APPROVED",
    "APPROVED SYSTEM",
    "CONFIRM",
    "IN APPROVAL",
    "REJECT",
  ].includes(statusUpper);
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const handleClick = (e: MouseEvent) => {
  emit("click", e);
};
</script>

<template>
  <template v-if="!isLocked">
    <Button
      v-if="menuId"
      v-permission="{ menuId, action: 'update', behavior }"
      :variant="variant"
      :size="size"
      :disabled="disabled"
      :class="{ 'opacity-50 cursor-not-allowed': disabled }"
      :title="tooltip"
      @click="handleClick"
    >
      <Edit class="h-4 w-4" />
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
      <Edit class="h-4 w-4" />
    </Button>
  </template>
</template>

