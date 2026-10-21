<script setup lang="ts">
import { SmoothStepEdge, type EdgeProps } from "@vue-flow/core";

defineOptions({
  name: "CompanyStructureFlowEdge",
});

const props = defineProps<EdgeProps>();
</script>

<template>
  <SmoothStepEdge
    v-bind="props"
    :border-radius="18"
    :offset="18"
  />
</template>
