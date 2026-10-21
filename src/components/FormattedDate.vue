<script setup lang="ts">
import { computed } from "vue";
import { formatDate } from "@/lib/date";

const props = defineProps<{
  date?: string | Date | number | null;
}>();

const formatted = computed(() => formatDate(props.date));
</script>

<template>
  <span>{{ formatted }}</span>
</template>
