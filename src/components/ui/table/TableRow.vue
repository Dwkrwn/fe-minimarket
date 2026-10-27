<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <tr :class="cn('border-b border-border/60 transition-colors duration-150 hover:bg-muted/40 data-[state=selected]:bg-primary/10', props.class)">
    <slot />
  </tr>
</template>
