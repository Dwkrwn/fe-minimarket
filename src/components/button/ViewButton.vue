<script setup lang="ts">
import { Eye } from "lucide-vue-next";
import { Button } from "@/components/ui/button";

interface ViewButtonProps {
  /** Menu ID for permission check */
  menuId?: string;
  /** Whether button should be active (enabled) */
  disabled?: boolean;
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

withDefaults(defineProps<ViewButtonProps>(), {
  disabled: false,
  size: "icon",
  variant: "outline",
  behavior: "disable",
  tooltip: "View",
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const handleClick = (e: MouseEvent) => {
  emit("click", e);
};
</script>

<template>
  <Button
    v-if="menuId"
    v-permission="{ menuId, action: 'read', behavior }"
    :variant="variant"
    :size="size"
    :disabled="disabled"
    :class="{ 'opacity-50 cursor-not-allowed': disabled }"
    :title="tooltip"
    @click="handleClick"
  >
    <Eye class="h-4 w-4" />
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
    <Eye class="h-4 w-4" />
  </Button>
</template>
