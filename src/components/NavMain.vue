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
</script>

<template>
  <SidebarGroup class="px-2 py-0">
    <SidebarGroupLabel class="px-2 text-xs font-medium text-muted-foreground">
      Menu
    </SidebarGroupLabel>
    <SidebarMenu class="gap-0.5">
      <template v-for="item in items" :key="item.title">
        <!-- Menu tanpa sub-menu -->
        <SidebarMenuItem v-if="!item.items">
          <SidebarMenuButton :tooltip="item.title" :is-active="item.isActive" as-child class="h-10 rounded-lg text-sm">
            <RouterLink
              :to="item.url"
              class="flex items-center gap-3 px-3 font-medium"
              :class="item.isActive
                ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'"
            >
              <component :is="item.icon" v-if="item.icon" class="h-[18px] w-[18px] shrink-0" />
              <span v-show="!isCollapsed" class="truncate">{{ item.title }}</span>
              <Badge
                v-if="item.badge && item.badge > 0 && !isCollapsed"
                variant="destructive"
                class="ml-auto h-5 min-w-5 px-1.5 text-xs"
              >
                {{ item.badge }}
              </Badge>
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
                class="h-10 rounded-lg px-3 text-sm"
                :class="item.isActive
                  ? 'bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                  : 'font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'"
                @click="toggleParentMenu(item.title)"
              >
                <component :is="item.icon" v-if="item.icon" class="h-[18px] w-[18px] shrink-0" />
                <span v-show="!isCollapsed" class="truncate">{{ item.title }}</span>
                <ChevronRight
                  v-show="!isCollapsed"
                  class="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                />
              </SidebarMenuButton>
            </CollapsibleTrigger>

            <CollapsibleContent v-show="!isCollapsed" class="overflow-hidden">
              <SidebarMenuSub class="my-1 ml-4 gap-0.5 border-l border-sidebar-border pl-2">
                <template v-for="subItem in item.items" :key="subItem.title">
                  <!-- Sub-menu biasa -->
                  <SidebarMenuSubItem v-if="!subItem.items">
                    <SidebarMenuSubButton as-child :is-active="subItem.isActive" class="h-9 rounded-lg text-sm">
                      <RouterLink
                        :to="subItem.url"
                        class="flex items-center gap-2.5 px-2.5"
                        :class="subItem.isActive
                          ? 'font-semibold text-sidebar-accent-foreground'
                          : 'font-normal text-sidebar-foreground/70 hover:text-sidebar-foreground'"
                      >
                        <component :is="subItem.icon" v-if="subItem.icon" class="h-4 w-4 shrink-0" />
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
                        <SidebarMenuSubButton class="flex h-9 items-center gap-2 rounded-lg text-sm">
                          <component :is="subItem.icon" v-if="subItem.icon" class="h-4 w-4 shrink-0" />
                          <span class="truncate">{{ subItem.title }}</span>
                          <ChevronRight class="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible-sub:rotate-90" />
                        </SidebarMenuSubButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent class="overflow-hidden">
                        <SidebarMenuSub class="mx-1 gap-0.5 pl-2">
                          <SidebarMenuSubItem v-for="nestedItem in subItem.items" :key="nestedItem.title">
                            <SidebarMenuSubButton as-child :is-active="nestedItem.isActive" class="h-9 rounded-lg text-sm">
                              <RouterLink
                                :to="nestedItem.url"
                                class="flex items-center gap-2.5 px-2.5"
                                :class="nestedItem.isActive
                                  ? 'font-semibold text-sidebar-accent-foreground'
                                  : 'font-normal text-sidebar-foreground/70 hover:text-sidebar-foreground'"
                              >
                                <component :is="nestedItem.icon" v-if="nestedItem.icon" class="h-4 w-4 shrink-0" />
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
