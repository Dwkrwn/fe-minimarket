<script setup lang="ts">
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface HistoryDialogProps {
  open: boolean;
}

const props = withDefaults(defineProps<HistoryDialogProps>(), {
  open: false,
});

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
}>();
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="!max-w-[65vw] w-[95vw] max-h-[95vh] overflow-y-auto">
      <slot />
    </DialogContent>
  </Dialog>
</template>
