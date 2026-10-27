<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()
</script>

<template>
  <th :class="cn('h-11 px-3.5 text-left align-middle text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 bg-muted/30 border-b border-border/80 [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-0.5', props.class)">
    <slot />
  </th>
</template>
