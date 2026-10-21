<script lang="ts" setup>
import type { CalendarCellTriggerProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { CalendarCellTrigger, useForwardProps } from "reka-ui"
import { cn } from "@/lib/utils"
import { buttonVariants } from '@/components/ui/button'

const props = defineProps<CalendarCellTriggerProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <CalendarCellTrigger
    :class="cn(
      buttonVariants({ variant: 'ghost' }),
      'h-8 w-8 p-0 font-normal',
      '[&[data-today]:not([data-selected])]:border [&[data-today]:not([data-selected])]:border-gray-400 [&[data-today]:not([data-selected])]:bg-gray-100 dark:[&[data-today]:not([data-selected])]:bg-gray-800 dark:[&[data-today]:not([data-selected])]:border-gray-600',
      // Selected (single)
      'data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:opacity-100 data-[selected]:hover:bg-primary data-[selected]:hover:text-primary-foreground data-[selected]:focus:bg-primary data-[selected]:focus:text-primary-foreground',
      // Range selection - Start
      'data-[selection-start]:bg-primary data-[selection-start]:text-primary-foreground data-[selection-start]:rounded-l-md data-[selection-start]:rounded-r-none',
      // Range selection - End
      'data-[selection-end]:bg-primary data-[selection-end]:text-primary-foreground data-[selection-end]:rounded-r-md data-[selection-end]:rounded-l-none',
      // Range selection - Start and End same day
      '[&[data-selection-start][data-selection-end]]:rounded-md',
      // Range selection - Highlighted (between start and end)
      'data-[highlighted]:bg-primary/20 data-[highlighted]:text-foreground data-[highlighted]:rounded-none',
      // Disabled
      'data-[disabled]:text-muted-foreground data-[disabled]:opacity-50',
      // Unavailable
      'data-[unavailable]:text-destructive-foreground data-[unavailable]:line-through',
      // Outside months
      'data-[outside-view]:text-muted-foreground data-[outside-view]:opacity-50 [&[data-outside-view][data-selected]]:bg-accent/50 [&[data-outside-view][data-selected]]:text-muted-foreground [&[data-outside-view][data-selected]]:opacity-30',
      props.class,
    )"
    v-bind="forwardedProps"
  >
    <slot />
  </CalendarCellTrigger>
</template>
