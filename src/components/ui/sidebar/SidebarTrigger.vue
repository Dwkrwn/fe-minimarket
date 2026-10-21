<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"
import { Button } from '@/components/ui/button'
import { useSidebar } from "./utils"
import { ChevronLeft, ChevronRight } from "lucide-vue-next"
import { computed } from "vue"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()

const { toggleSidebar, state, isMobile, openMobile } = useSidebar()

const showOpenArrow = computed(() => {
  return isMobile.value ? !openMobile.value : state.value === 'collapsed'
})
</script>

<template>
  <Button
    data-sidebar="trigger"
    data-slot="sidebar-trigger"
    variant="ghost"
    size="icon"
    :class="
      cn(
        'h-9 w-9 relative rounded-md transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        props.class,
      )
    "
    @click="toggleSidebar"
  >
    <ChevronRight
      v-if="showOpenArrow"
      class="absolute h-5 w-5"
      v-motion
      :initial="{ opacity: 0, x: -4, scale: 0.85 }"
      :enter="{ opacity: 1, x: 0, scale: 1, transition: { duration: 180, ease: 'easeOut' } }"
      :leave="{ opacity: 0, x: 4, scale: 0.85, transition: { duration: 120, ease: 'easeIn' } }"
    />
    <ChevronLeft
      v-else
      class="absolute h-5 w-5"
      v-motion
      :initial="{ opacity: 0, x: 4, scale: 0.85 }"
      :enter="{ opacity: 1, x: 0, scale: 1, transition: { duration: 180, ease: 'easeOut' } }"
      :leave="{ opacity: 0, x: -4, scale: 0.85, transition: { duration: 120, ease: 'easeIn' } }"
    />

    <span class="sr-only">Toggle Sidebar</span>
  </Button>
</template>
