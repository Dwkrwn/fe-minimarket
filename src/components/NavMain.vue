<script setup lang="ts">
import type { Component } from 'vue'
import { ref, watch, computed } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { iconMap } from '@/plugins/lucide'

interface MenuItem {
  title: string
  url: string
  icon?: Component | string
  isActive?: boolean
  items?: MenuItem[]
  badge?: number
}

const props = defineProps<{
  items: MenuItem[]
}>()

const route = useRoute()
const { state } = useSidebar()
const isCollapsed = computed(() => state.value === 'collapsed')

// Hanya satu grup menu yang terbuka pada satu waktu
const openParentMenu = ref<string | null>(null)

watch(() => route.path, () => {
  const activeItem = props.items.find(item => item.isActive && item.items)
  if (activeItem) {
    openParentMenu.value = activeItem.title
  }
}, { immediate: true })

const toggleParentMenu = (title: string) => {
  openParentMenu.value = openParentMenu.value === title ? null : title
}

const isParentOpen = (title: string) => openParentMenu.value === title

/**
 * Menu icons come from the database as strings. Resolve them against the
 * locally registered icon set so an unknown/legacy name still renders a
 * placeholder instead of an empty slot (and never pulls in the full library).
 */
const resolveIcon = (icon?: Component | string) => {
  if (!icon) return undefined
  if (typeof icon !== 'string') return icon
  return iconMap[icon as keyof typeof iconMap] ?? iconMap.Circle
}
</script>

<template>
  <SidebarGroup class="px-2 py-0">
    <SidebarGroupLabel class="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/75">
      Menu
    </SidebarGroupLabel>
    <SidebarMenu class="gap-1">
      <template v-for="item in items" :key="item.title">
        <!-- Menu tanpa sub-menu -->
        <SidebarMenuItem v-if="!item.items">
          <SidebarMenuButton :tooltip="item.title" :is-active="item.isActive" as-child class="h-10 rounded-xl text-sm">
            <RouterLink
              :to="item.url"
              class="group/link relative flex items-center gap-3 px-3 font-medium transition-colors duration-150"
              :class="item.isActive
                ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.6)]'
                : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground'"
            >
              <span
                class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-150"
                :class="item.isActive
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-sidebar-foreground/55 group-hover/link:bg-card/60 group-hover/link:text-sidebar-accent-foreground'"
              >
                <component :is="resolveIcon(item.icon)" v-if="item.icon" class="h-[17px] w-[17px] shrink-0" />
              </span>
              <span v-show="!isCollapsed" class="truncate">{{ item.title }}</span>
              <Badge
                v-if="item.badge && item.badge > 0 && !isCollapsed"
                variant="destructive"
                class="ml-auto h-5 min-w-5 rounded-full px-1.5 text-xs"
              >
                {{ item.badge }}
              </Badge>
              <span
                v-if="item.isActive && !isCollapsed"
                class="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary"
                aria-hidden="true"
              />
            </RouterLink>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <!-- Menu dengan sub-menu -->
        <Collapsible
          v-else
          as-child
          :open="isParentOpen(item.title) && !isCollapsed"
          class="group/collapsible"
        >
          <SidebarMenuItem>
            <CollapsibleTrigger as-child>
              <SidebarMenuButton
                :tooltip="item.title"
                class="group/link relative h-10 rounded-xl px-3 text-sm transition-colors duration-150"
                :class="item.isActive
                  ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.6)]'
                  : 'font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground'"
                @click="toggleParentMenu(item.title)"
              >
                <span
                  class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-150"
                  :class="item.isActive
                    ? 'bg-card text-primary shadow-sm'
                    : 'text-sidebar-foreground/55 group-hover/link:bg-card/60 group-hover/link:text-sidebar-accent-foreground'"
                >
                  <component :is="resolveIcon(item.icon)" v-if="item.icon" class="h-[17px] w-[17px] shrink-0" />
                </span>
                <span v-show="!isCollapsed" class="truncate">{{ item.title }}</span>
                <ChevronRight
                  v-show="!isCollapsed"
                  class="ml-auto h-4 w-4 shrink-0 text-muted-foreground/70 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                />
                <span
                  v-if="item.isActive && !isCollapsed"
                  class="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary"
                  aria-hidden="true"
                />
              </SidebarMenuButton>
            </CollapsibleTrigger>

            <CollapsibleContent v-show="!isCollapsed" class="overflow-hidden">
              <SidebarMenuSub class="my-1.5 ml-4 gap-1 border-l border-sidebar-border/80 pl-2.5">
                <template v-for="subItem in item.items" :key="subItem.title">
                  <!-- Sub-menu biasa -->
                  <SidebarMenuSubItem v-if="!subItem.items">
                    <SidebarMenuSubButton as-child :is-active="subItem.isActive" class="h-9 rounded-lg text-sm">
                      <RouterLink
                        :to="subItem.url"
                        class="group/sublink flex items-center gap-2.5 rounded-lg px-2.5 transition-colors duration-150"
                        :class="subItem.isActive
                          ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-[inset_0_1px_0_hsl(0_0%_100%/0.6)]'
                          : 'font-normal text-sidebar-foreground/70 hover:bg-sidebar-accent/45 hover:text-sidebar-foreground'"
                      >
                        <component
                          :is="resolveIcon(subItem.icon)"
                          v-if="subItem.icon"
                          class="h-4 w-4 shrink-0 transition-colors"
                          :class="subItem.isActive ? 'text-primary' : 'text-sidebar-foreground/45 group-hover/sublink:text-sidebar-accent-foreground'"
                        />
                        <span class="truncate">{{ subItem.title }}</span>
                      </RouterLink>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>

                  <!-- Sub-menu bertingkat -->
                  <Collapsible
                    v-else
                    as-child
                    :default-open="subItem.isActive"
                    class="group/collapsible-sub"
                  >
                    <SidebarMenuSubItem>
                      <CollapsibleTrigger as-child>
                        <SidebarMenuSubButton class="flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm">
                          <component :is="resolveIcon(subItem.icon)" v-if="subItem.icon" class="h-4 w-4 shrink-0 text-sidebar-foreground/45" />
                          <span class="truncate">{{ subItem.title }}</span>
                          <ChevronRight class="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible-sub:rotate-90" />
                        </SidebarMenuSubButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent class="overflow-hidden">
                        <SidebarMenuSub class="mx-1 gap-1 pl-2">
                          <SidebarMenuSubItem v-for="nestedItem in subItem.items" :key="nestedItem.title">
                            <SidebarMenuSubButton as-child :is-active="nestedItem.isActive" class="h-9 rounded-lg text-sm">
                              <RouterLink
                                :to="nestedItem.url"
                                class="group/sublink flex items-center gap-2.5 rounded-lg px-2.5 transition-colors duration-150"
                                :class="nestedItem.isActive
                                  ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                                  : 'font-normal text-sidebar-foreground/70 hover:bg-sidebar-accent/45 hover:text-sidebar-foreground'"
                              >
                                <component
                                  :is="resolveIcon(nestedItem.icon)"
                                  v-if="nestedItem.icon"
                                  class="h-4 w-4 shrink-0"
                                  :class="nestedItem.isActive ? 'text-primary' : 'text-sidebar-foreground/45 group-hover/sublink:text-sidebar-accent-foreground'"
                                />
                                <span class="truncate">{{ nestedItem.title }}</span>
                              </RouterLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuSubItem>
                  </Collapsible>
                </template>
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      </template>
    </SidebarMenu>
  </SidebarGroup>
</template>
