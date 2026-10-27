<script setup lang="ts">
import type { SidebarProps } from "@/components/ui/sidebar";
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import NavMain from "@/components/NavMain.vue";
import NavUser from "@/components/NavUser.vue";
import TeamSwitcher from "@/components/TeamSwitcher.vue";
import VoiceMenuSearch from "@/components/VoiceMenuSearch.vue";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getMenuListNoPagination,
  type MenuItem,
} from "@/views/setup/menu/service";
import { getUnifiedNotifications } from "@/views/notifikasi/service";
import { toast } from "vue-sonner";
import { useSidebarRefresh } from "@/composables/useSidebarRefresh";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const NOTIFICATION_STORAGE_KEY = "bb_read_notifications";

const props = withDefaults(defineProps<SidebarProps>(), {
  collapsible: "icon",
});

const route = useRoute();
const authStore = useAuthStore();
const searchQuery = ref("");
const sidebar = useSidebar();
const loading = ref(true);
const refreshing = ref(false);
const dynamicMenus = ref<MenuItem[]>([]);
const selectedRespoId = ref<string>("");

// Notification badge state
const notificationCount = ref(0);
const isLoadingNotifications = ref(false);
const readNotificationIds = ref<Set<string>>(new Set());

// Load read notifications from localStorage
const loadReadNotifications = () => {
  try {
    const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (stored) {
      const ids = JSON.parse(stored) as string[];
      readNotificationIds.value = new Set(ids);
    }
  } catch (e) {
    console.error("Failed to load read notifications from localStorage:", e);
  }
};

// Auto-refresh composable
const { refreshTrigger, resetRefresh } = useSidebarRefresh();

/** Get appropriate icon for each module */
const getModuleIcon = (moduleName: string): string => {
  const iconMap: Record<string, string> = {
    SETUP: "Settings",
    PURCHASING: "ShoppingCart",
    MARKETING: "Megaphone",
    INVENTORY: "Package",
    DEV: "Code2",
    PRODUCTION: "Factory",
    SALES: "TrendingUp",
    FINANCE: "DollarSign",
    HR: "Users",
    LOGISTICS: "Truck",
  };

  return iconMap[moduleName.toUpperCase()] || "Box";
};

const loadMenus = async (showToast = false) => {
  try {
    if (authStore.isSuperAdmin) {
      // SUPER ADMIN: Load all menus from API
      const response = await getMenuListNoPagination();
      if (response.status === "success") {
        dynamicMenus.value = response.data
          .filter((m) => m.is_active)
          .sort((a, b) => {
            const seqA = a.seq.split(".").map((n) => parseInt(n) || 0);
            const seqB = b.seq.split(".").map((n) => parseInt(n) || 0);
            for (let i = 0; i < Math.max(seqA.length, seqB.length); i++) {
              const partA = seqA[i] || 0;
              const partB = seqB[i] || 0;
              if (partA !== partB) {
                return partA - partB;
              }
            }
            return 0;
          });
      }
    } else {
      // NON-SUPER ADMIN: Load menus from SelectRespo in localStorage
      const selectRespoStr = localStorage.getItem("SelectRespo");
      if (selectRespoStr) {
        const selectRespo = JSON.parse(selectRespoStr);
        if (selectRespo.menus && Array.isArray(selectRespo.menus)) {
          dynamicMenus.value = selectRespo.menus.sort((a: any, b: any) => {
            const seqA = a.seq.split(".").map((n: string) => parseInt(n) || 0);
            const seqB = b.seq.split(".").map((n: string) => parseInt(n) || 0);
            for (let i = 0; i < Math.max(seqA.length, seqB.length); i++) {
              const partA = seqA[i] || 0;
              const partB = seqB[i] || 0;
              if (partA !== partB) {
                return partA - partB;
              }
            }
            return 0;
          });
        }
      }
    }

    if (showToast || (!loading.value && refreshing.value)) {
      toast.success("Menu berhasil diperbarui", {
        description: `${dynamicMenus.value.length} menu dimuat`,
      });
    }

    // Reset refresh flag after successful load
    resetRefresh();
  } catch (error) {
    console.error("Failed to load menus:", error);
    toast.error("Gagal memuat menu", {
      description: "Menggunakan menu default",
    });
  }
};

const handleRefreshMenu = async () => {
  refreshing.value = true;
  await loadMenus(true);
  refreshing.value = false;
};

/** Fetch notification counts */
const fetchNotificationCounts = async (forceRefresh = false) => {
  if (isLoadingNotifications.value) return;

  try {
    isLoadingNotifications.value = true;

    // Reload read notifications from localStorage
    loadReadNotifications();

    const unifiedResponse = await getUnifiedNotifications(1, 100, forceRefresh);
    const approvalRows = unifiedResponse.data?.approval || [];
    const revisiRows = unifiedResponse.data?.revisi || [];

    // Cleanup stale IDs that no longer exist in backend response
    const validIds = new Set(
      (unifiedResponse.active_ids || []).map((id) => String(id)),
    );
    const cleanedIds = [...readNotificationIds.value].filter((id) =>
      validIds.has(id),
    );
    if (cleanedIds.length !== readNotificationIds.value.size) {
      readNotificationIds.value = new Set(cleanedIds);
      localStorage.setItem(
        NOTIFICATION_STORAGE_KEY,
        JSON.stringify(cleanedIds),
      );
    }

    // Count unread notifications (check both API status and localStorage)
    const approvalUnread = approvalRows.filter(
      (n: any) => !n.status && !readNotificationIds.value.has(String(n.id)),
    ).length;
    const revisiUnread = revisiRows.filter(
      (n: any) => !n.status && !readNotificationIds.value.has(String(n.id)),
    ).length;

    notificationCount.value = approvalUnread + revisiUnread;
  } catch (error) {
    console.error("Failed to load notification counts:", error);
    // Don't show error toast, just fail silently
    notificationCount.value = 0;
  } finally {
    isLoadingNotifications.value = false;
  }
};

// Watch for auto-refresh trigger from other components
watch(refreshTrigger, async (newVal) => {
  if (newVal > 0) {
    await loadMenus(true);
  }
});

// Listen for notification read events (custom event from notifikasi.vue)
const handleNotificationRead = () => {
  // Reload read notifications from localStorage and recalculate count
  loadReadNotifications();
  fetchNotificationCounts();
};

// Listen for notification data updates (e.g. send approval success)
const handleNotificationsUpdated = () => {
  fetchNotificationCounts(true);
};

// Listen to storage changes (for cross-tab sync)
const handleStorageChange = (e: StorageEvent) => {
  if (e.key === NOTIFICATION_STORAGE_KEY) {
    loadReadNotifications();
    fetchNotificationCounts();
  }
};

// Listen to respoChanged event to reload menus for non-super admin
const handleRespoChanged = async () => {
  if (!authStore.isSuperAdmin) {
    await loadMenus(false);
  }
};

onMounted(() => {
  window.addEventListener("respoChanged", handleRespoChanged);
  window.addEventListener("notificationRead", handleNotificationRead);
  window.addEventListener("notificationsUpdated", handleNotificationsUpdated);
  window.addEventListener("storage", handleStorageChange);
});

onUnmounted(() => {
  window.removeEventListener("respoChanged", handleRespoChanged);
  window.removeEventListener("notificationRead", handleNotificationRead);
  window.removeEventListener(
    "notificationsUpdated",
    handleNotificationsUpdated,
  );
  window.removeEventListener("storage", handleStorageChange);
});

// Setup interval to refresh notification counts every 5 minutes
const notificationInterval = setInterval(() => {
  fetchNotificationCounts();
}, 300000); // 5 minutes (300000ms)

// Cleanup interval on unmount
onUnmounted(() => {
  clearInterval(notificationInterval);
});

onMounted(async () => {
  // For SUPER ADMIN, set respo to virtual one
  if (authStore.isSuperAdmin) {
    selectedRespoId.value = "super-admin-respo";
  } else {
    // Initialize selected respo from SelectRespo localStorage
    const savedSelectRespo = localStorage.getItem("SelectRespo");
    let savedRespoId: string | null = null;

    if (savedSelectRespo) {
      try {
        const parsed = JSON.parse(savedSelectRespo);
        savedRespoId = parsed.respoId;
      } catch (e) {
        // Invalid JSON, ignore
      }
    }

    if (
      savedRespoId &&
      authStore.userDetails.some((d: any) => d.id === savedRespoId)
    ) {
      // Use saved respo if it still exists
      selectedRespoId.value = savedRespoId;
    } else {
      // Use primary respo or first active
      const primaryRespo = authStore.userDetails.find(
        (d: any) => d.is_primary && d.is_active,
      );
      selectedRespoId.value =
        primaryRespo?.id || authStore.userDetails[0]?.id || "";
    }

    // Wait for SelectRespo to be ready (TeamSwitcher will create it)
    // Retry beberapa kali kalau belum ada
    let retries = 0;
    while (!localStorage.getItem("SelectRespo") && retries < 10) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      retries++;
    }
  }

  await loadMenus();
  loading.value = false;

  // Fetch notification counts after menu loads
  await fetchNotificationCounts(true);
});

watch(
  () => route.path,
  async () => {
    await fetchNotificationCounts(true);
  },
);

// Watch selectedRespoId - SelectRespo is now managed by TeamSwitcher
watch(selectedRespoId, (newVal) => {
  if (newVal) {
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent("respoChanged", { detail: newVal }));
  }
});

const handleSearchFocus = () => {
  if (sidebar.state.value === "collapsed") {
    sidebar.toggleSidebar();
  }
};

// Helper function to check if a menu item should be active
// Checks both direct path match and route meta.parentMenu for related routes
// Also supports child routes (e.g., /setup/m_format_nomor is child of /setup/m_prefix)
const isMenuItemActive = (itemPath: string, itemName?: string): boolean => {
  const pathMatch =
    route.path === itemPath || route.path.startsWith(itemPath + "/");

  // Also check if current route has parentMenu meta that matches this item
  const parentMenuMeta = (route.meta?.parentMenu as string) || "";
  const parentMatch =
    !!itemName && parentMenuMeta.toLowerCase() === itemName.toLowerCase();

  // Special handling: check if current route is /setup/m_format_nomor and item is /setup/m_prefix
  // This handles related routes under same module
  const relatedRouteMatch =
    (route.path === "/setup/m_format_nomor" ||
      route.path.startsWith("/setup/m_format_nomor/")) &&
    itemPath === "/setup/m_prefix";

  return pathMatch || parentMatch || relatedRouteMatch;
};

// Static menu items (always visible)
const staticMenuItems = [
  {
    title: "NOTIFIKASI",
    url: "/notifikasi",
    icon: "Bell",
    modul: null,
    superAdminOnly: false,
  },
  {
    title: "DASHBOARD",
    url: "/",
    icon: "LayoutDashboard",
    modul: null,
    superAdminOnly: false,
  },
  {
    title: "MENU",
    url: "/setup/menu",
    icon: "List",
    modul: "SETUP",
    superAdminOnly: true,
  }, // Only SUPER ADMIN can access
];

// Build hierarchical menu structure from flat dynamic menus
const buildMenuStructure = computed(() => {
  // Group by modul
  const modulesMap = new Map<string, any[]>();

  dynamicMenus.value.forEach((menu: any) => {
    const modul = menu.modul || "OTHER";
    if (!modulesMap.has(modul)) {
      modulesMap.set(modul, []);
    }
    modulesMap.get(modul)!.push(menu);
  });

  // Build menu items per module
  const result: any[] = [];

  // === SETUP MODULE ===
  // Only show SETUP module if:
  // 1. User is SUPER ADMIN, OR
  // 2. User has SETUP menus in their SelectRespo
  const setupMenus = modulesMap.get("SETUP") || [];
  const hasSetupAccess = authStore.isSuperAdmin || setupMenus.length > 0;

  if (hasSetupAccess) {
    const setupSubModulMap = new Map<string, any[]>();

    setupMenus.forEach((menu) => {
      const subModul = menu.sub_modul?.trim() || "_root";
      if (!setupSubModulMap.has(subModul)) {
        setupSubModulMap.set(subModul, []);
      }
      setupSubModulMap.get(subModul)!.push(menu);
    });

    const setupItems: any[] = [
      ...staticMenuItems
        .filter((s) => s.modul === "SETUP")
        .filter((s) => !s.superAdminOnly || authStore.isSuperAdmin) // Filter SUPER ADMIN only menus
        .map((s) => ({
          title: s.title,
          url: s.url,
          icon: s.icon,
          isActive: isMenuItemActive(s.url, s.title),
        })),
    ];

    // Add dynamic SETUP menus if exist
    setupSubModulMap.forEach((items, subModul) => {
      if (subModul === "_root") {
        // No sub-modul, add directly
        items.forEach((item) => {
          setupItems.push({
            title: item.name,
            url: item.path,
            icon: item.icon?.trim() || "FileText",
            isActive: isMenuItemActive(item.path, item.name),
          });
        });
      } else {
        // Has sub-modul, create nested structure
        setupItems.push({
          title: subModul,
          url: "#",
          icon: "Folder",
          isActive: items.some((i) => isMenuItemActive(i.path, i.name)),
          items: items.map((item) => ({
            title: item.name,
            url: item.path,
            icon: item.icon?.trim() || "FileText",
            isActive: isMenuItemActive(item.path, item.name),
          })),
        });
      }
    });

    // Only add SETUP module if it has items to show
    if (setupItems.length > 0) {
      result.push({
        title: "SETUP",
        url: "#",
        icon: getModuleIcon("SETUP"),
        isActive: route.path.startsWith("/setup"),
        items: setupItems,
      });
    }
  }

  // === OTHER DYNAMIC MODULES ===
  modulesMap.forEach((menus, modulName) => {
    if (modulName === "SETUP") {
      return; // Skip, already added above
    }

    // Group by sub_mod within each modul
    const subModulMap = new Map<string, any[]>();

    menus.forEach((menu) => {
      const subModul = menu.sub_modul?.trim() || "_root"; // _root for menus without sub_modul
      if (!subModulMap.has(subModul)) {
        subModulMap.set(subModul, []);
      }
      subModulMap.get(subModul)!.push(menu);
    });

    const moduleItems: any[] = [];

    subModulMap.forEach((items, subModul) => {
      if (subModul === "_root" || subModul === "") {
        // No sub-modul
        items.forEach((item) => {
          moduleItems.push({
            title: item.name,
            url: item.path,
            icon: item.icon?.trim() || "FileText",
            isActive: isMenuItemActive(item.path, item.name),
          });
        });
      } else {
        // Has sub-modul
        moduleItems.push({
          title: subModul,
          url: "#",
          icon: "Folder",
          isActive: items.some((i) => isMenuItemActive(i.path, i.name)),
          items: items.map((item) => ({
            title: item.name,
            url: item.path,
            icon: item.icon?.trim() || "FileText",
            isActive: isMenuItemActive(item.path, item.name),
          })),
        });
      }
    });

    result.push({
      title: modulName,
      url: "#",
      icon: getModuleIcon(modulName),
      isActive: moduleItems.some(
        (i) =>
          i.isActive || (i.items && i.items.some((sub: any) => sub.isActive)),
      ),
      items: moduleItems,
    });
  });

  return result;
});

// All menu items for search
const allMenuItems = computed(() => {
  const items: any[] = [];

  // Check if user has SETUP access
  const hasSetupAccess =
    authStore.isSuperAdmin ||
    dynamicMenus.value.some((m) => m.modul === "SETUP");

  // Add static non-module items (filter SUPER ADMIN only menus)
  staticMenuItems
    .filter((s) => !s.modul)
    .filter((s) => !s.superAdminOnly || authStore.isSuperAdmin)
    .forEach((s) => {
      items.push({
        title: s.title,
        url: s.url,
        icon: s.icon,
        parent: null,
      });
    });

  // Add all dynamic menus flattened
  dynamicMenus.value.forEach((menu) => {
    items.push({
      title: menu.name,
      url: menu.path,
      icon: menu.icon?.trim() || "FileText",
      parent: menu.sub_modul ? `${menu.modul} > ${menu.sub_modul}` : menu.modul,
    });
  });

  // Add static SETUP menu only if user has SETUP access (filter SUPER ADMIN only menus)
  if (hasSetupAccess) {
    staticMenuItems
      .filter((s) => s.modul === "SETUP")
      .filter((s) => !s.superAdminOnly || authStore.isSuperAdmin)
      .forEach((s) => {
        items.push({
          title: s.title,
          url: s.url,
          icon: s.icon,
          parent: "SETUP",
        });
      });
  }

  return items;
});

const filteredMenuItems = computed(() => {
  if (!searchQuery.value.trim()) {
    return allMenuItems.value;
  }

  const query = searchQuery.value.toLowerCase();
  return allMenuItems.value.filter(
    (item: any) =>
      item.title.toLowerCase().includes(query) ||
      (item.parent && item.parent.toLowerCase().includes(query)),
  );
});

const data = computed(() => {
  return {
    teams: [
      {
        name: "Bos Baut",
        logo: "Building2",
        plan: "Enterprise",
      },
      {
        name: "Production Team",
        logo: "Factory",
        plan: "Professional",
      },
      {
        name: "Sales Team",
        logo: "Store",
        plan: "Business",
      },
    ],

    navMain: searchQuery.value.trim()
      ? (() => {
          // Group filtered items by their parent (Module > SubModule)
          const grouped: Record<string, any[]> = {};

          // Only include items that match the search query
          const query = searchQuery.value.toLowerCase();
          const matchedItems = filteredMenuItems.value.filter((item: any) =>
            item.title.toLowerCase().includes(query),
          );

          matchedItems.forEach((item: any) => {
            const parentKey = item.parent || "OTHER";
            if (!grouped[parentKey]) {
              grouped[parentKey] = [];
            }
            grouped[parentKey].push({
              title: item.title,
              url: item.url,
              icon: item.icon,
              isActive:
                route.path === item.url ||
                route.path.startsWith(item.url + "/"),
              badge:
                item.url === "/notifikasi" && notificationCount.value > 0
                  ? notificationCount.value
                  : undefined,
            });
          });

          // Convert grouped to menu structure - merge same modules
          const moduleMap: Record<string, any> = {};

          Object.entries(grouped).forEach(([parent, items]) => {
            const parts = parent.split(" > ");
            const moduleName = parts[0] || "OTHER";
            const subModuleName = parts[1];

            if (!moduleMap[moduleName]) {
              moduleMap[moduleName] = {
                title: moduleName,
                icon: getModuleIcon(moduleName),
                isActive: false,
                items: [],
              };
            }

            if (subModuleName) {
              // Check if submodule already exists
              let subModule = moduleMap[moduleName].items.find(
                (s: any) => s.title === subModuleName,
              );
              if (!subModule) {
                subModule = {
                  title: subModuleName,
                  icon: "FolderOpen",
                  isActive: false,
                  items: [],
                };
                moduleMap[moduleName].items.push(subModule);
              }
              subModule.items.push(...items);
              subModule.isActive = subModule.items.some((i: any) => i.isActive);
            } else {
              // Direct children of module
              moduleMap[moduleName].items.push(...items);
            }

            moduleMap[moduleName].isActive = moduleMap[moduleName].items.some(
              (i: any) => i.isActive,
            );
          });

          return Object.values(moduleMap);
        })()
      : [
          // Static items first
          {
            title: "NOTIFIKASI",
            url: "/notifikasi",
            icon: "Bell",
            isActive: route.path === "/notifikasi",
            badge:
              notificationCount.value > 0 ? notificationCount.value : undefined,
          },
          {
            title: "DASHBOARD",
            url: "/",
            icon: "LayoutDashboard",
            isActive: route.path === "/",
          },
          // Then dynamic modules
          ...buildMenuStructure.value,
        ],
    projects: [],
  };
});

// App version (semantic versioning) injected from package.json at build time
const appVersion = __APP_VERSION__;
const appReleaseDate = __APP_RELEASE_DATE__;
const appVersionCompact = `v${appVersion.split(".")[0] ?? appVersion}`;
const formattedReleaseDate = appReleaseDate
  ? new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(appReleaseDate))
  : "-";
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarHeader class="bg-sidebar-header text-sidebar-header-foreground">
      <TeamSwitcher
        @selectRespo="
          (respoId) => {
            selectedRespoId = respoId;
          }
        "
      />
    </SidebarHeader>

    <SidebarContent class="space-y-2 !bg-white !text-slate-800 dark:!bg-white dark:!text-slate-800">
      <div class="px-3 py-2 group-data-[collapsible=icon]:px-2">
        <div class="relative flex items-center gap-2">
          <div class="relative flex-1">
            <Search
              class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-data-[collapsible=icon]:left-2 pointer-events-none"
            />
            <Input
              v-model="searchQuery"
              :placeholder="
                sidebar.state.value === 'collapsed'
                  ? 'Click to search...'
                  : 'Search menu...'
              "
              class="pl-9 pr-9 h-9.5 rounded-xl !bg-slate-50 !border-slate-200 !text-slate-800 placeholder:!text-slate-400 focus:!bg-white focus:!border-primary/50 focus:ring-2 focus:ring-primary/20 shadow-xs group-data-[collapsible=icon]:pl-8 group-data-[collapsible=icon]:pr-8 group-data-[collapsible=icon]:cursor-pointer transition-all duration-200 text-xs"
              @focus="handleSearchFocus"
              @click="handleSearchFocus"
              :readonly="sidebar.state.value === 'collapsed'"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 group-data-[collapsible=icon]:right-2"
              aria-label="Clear search"
              @mousedown.prevent
              @click="searchQuery = ''"
            >
              <X class="h-4 w-4" />
            </button>
          </div>

          <!-- Voice Menu Search Button -->
          <div class="group-data-[collapsible=icon]:hidden">
            <VoiceMenuSearch @update:transcript="searchQuery = $event" />
          </div>
        </div>

        <!-- Refresh Button -->
        <Button
          variant="outline"
          size="sm"
          class="w-full justify-center gap-2 h-9 rounded-xl text-xs font-semibold !text-slate-700 !border-slate-200 !bg-slate-50 hover:!bg-slate-100 hover:!text-slate-900 transition-all mt-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 shadow-xs"
          @click="handleRefreshMenu"
          :disabled="refreshing || loading"
        >
          <component
            :is="refreshing ? 'Loader2' : 'RefreshCw'"
            :class="['h-4 w-4', refreshing ? 'animate-spin' : '']"
          />
          <span class="group-data-[collapsible=icon]:hidden">
            {{ refreshing ? "Memperbarui..." : "Refresh Menu" }}
          </span>
        </Button>

        <div
          v-if="searchQuery.trim()"
          class="mt-2 px-1 group-data-[collapsible=icon]:hidden"
        >
          <div
            class="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200"
          >
            {{ filteredMenuItems.length }} result{{
              filteredMenuItems.length !== 1 ? "s" : ""
            }}
            found
          </div>
        </div>
      </div>

      <!-- Skeleton Loading -->
      <div v-if="loading" class="px-3 space-y-2">
        <div class="space-y-1">
          <Skeleton class="h-4 w-16 mb-2" />
          <Skeleton class="h-9 w-full" />
          <Skeleton class="h-9 w-full" />
          <Skeleton class="h-9 w-full" />
          <Skeleton class="h-9 w-full" />
        </div>
      </div>

      <!-- Actual Menu -->
      <NavMain v-else :items="data.navMain" />
    </SidebarContent>

    <SidebarFooter class="gap-2 pb-2 !bg-white !text-slate-800 dark:!bg-white dark:!text-slate-800 border-t border-slate-100">
      <div v-if="loading" class="px-3 py-2">
        <div class="flex items-center gap-2">
          <Skeleton class="h-8 w-8 rounded-full" />
          <div class="flex-1 space-y-1">
            <Skeleton class="h-3 w-24" />
            <Skeleton class="h-2 w-32" />
          </div>
        </div>
      </div>
      <template v-else>
        <NavUser />

        <div
          class="mt-auto rounded-2xl !border-slate-200 !bg-slate-50 px-3 py-2 text-slate-800 transition-all duration-200 group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:py-1.5 shadow-xs"
          :title="`ERP Version ${appVersion} • Release ${formattedReleaseDate}`"
        >
          <div
            class="flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center"
          >
            <div class="min-w-0 group-data-[collapsible=icon]:hidden">
              <p class="text-[9px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/60">
                ERP Version
              </p>
              <p class="mt-0.5 text-[11px] font-medium text-sidebar-foreground/60">
                Release {{ formattedReleaseDate }}
              </p>
            </div>
            <div
              class="flex h-7 min-w-7 items-center justify-center rounded-md border border-sidebar-border bg-sidebar px-1.5 text-[10px] font-semibold text-sidebar-foreground shadow-sm shadow-sidebar-border/20"
            >
              <span class="group-data-[collapsible=icon]:hidden">
                v{{ appVersion }}
              </span>
              <span class="hidden group-data-[collapsible=icon]:inline">
                {{ appVersionCompact }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>
</template>
