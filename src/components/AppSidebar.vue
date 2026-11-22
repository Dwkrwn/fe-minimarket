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
import { type MenuItem } from "@/views/setup/menu/service";
import { toast } from "vue-sonner";
import { useSidebarRefresh } from "@/composables/useSidebarRefresh";
import { useNotificationBadge } from "@/composables/useNotificationBadge";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

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

// Notification badge is owned by Layout.vue via the shared composable; this
// component only consumes the reactive count (no own fetch/interval/watchers).
const { notificationCount } = useNotificationBadge();

// Auto-refresh composable
const { refreshTrigger, resetRefresh } = useSidebarRefresh();

/** Nama modul dalam bahasa yang mudah dipahami */
const MODULE_LABELS: Record<string, string> = {
  SETUP: "Pengaturan",
  PURCHASING: "Purchasing",
  INVENTORY: "Inventory",
  POS: "Transaksi (POS)",
  MARKETING: "Pemasaran",
  SALES: "Penjualan",
  FINANCE: "Keuangan",
  HR: "Karyawan",
  LOGISTICS: "Logistik",
  PRODUCTION: "Produksi",
  DEV: "Pengembangan",
  OTHER: "Lainnya",
};

/** Nama kelompok menu dalam bahasa yang mudah dipahami */
const SUB_MODULE_LABELS: Record<string, string> = {
  MASTER: "Master",
  PEMESANAN: "Pemesanan",
  PENERIMAAN: "Penerimaan Barang",
  TAGIHAN: "Tagihan",
  LAPORAN: "Laporan",
  KASIR: "Kasir",
  SHIFT: "Shift",
};

function toSentenceCase(value: string): string {
  const text = String(value || "").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function moduleLabel(name: string): string {
  return (
    MODULE_LABELS[String(name || "").toUpperCase()] || toSentenceCase(name)
  );
}

function subModuleLabel(name: string): string {
  return (
    SUB_MODULE_LABELS[String(name || "").toUpperCase()] || toSentenceCase(name)
  );
}

/** Get appropriate icon for each module */
const getModuleIcon = (moduleName: string): string => {
  const iconMap: Record<string, string> = {
    SETUP: "Settings",
    PURCHASING: "ShoppingCart",
    MARKETING: "Megaphone",
    INVENTORY: "Package",
    POS: "ScanLine",
    DEV: "Code2",
    PRODUCTION: "Factory",
    SALES: "TrendingUp",
    FINANCE: "DollarSign",
    HR: "Users",
    LOGISTICS: "Truck",
    PENGATURAN: "Settings",
    PEMBELIAN: "ShoppingCart",
    PERSEDIAAN: "Package",
    PEMASARAN: "Megaphone",
    PENJUALAN: "TrendingUp",
    KEUANGAN: "DollarSign",
    KARYAWAN: "Users",
    LOGISTIK: "Truck",
    PRODUKSI: "Factory",
    PENGEMBANGAN: "Code2",
    LAINNYA: "Box",
  };

  return iconMap[moduleName.toUpperCase()] || "Box";
};

const loadMenus = async (showToast = false) => {
  try {
    dynamicMenus.value = [...(authStore.user?.menus || [])]
      .map((menu) => ({
        ...menu,
        desc: "",
        icon: menu.icon || "",
        modul: menu.modul || "",
        sub_modul: menu.sub_modul || "",
        is_active: true,
        createdAt: "",
        updatedAt: "",
      }))
      .sort((a, b) => a.seq.localeCompare(b.seq, undefined, { numeric: true }));

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

const refreshSession = async () => {
  try {
    // Throttled (5 min TTL) so focus/interval does not hammer /auth/me.
    const refreshed = await authStore.refreshUserDataIfStale();
    if (refreshed) await loadMenus();
  } catch {
    /* API layer handles expired sessions. */
  }
};
let sessionInterval: ReturnType<typeof setInterval>;
onMounted(() => {
  window.addEventListener("focus", refreshSession);
  sessionInterval = setInterval(refreshSession, 300000);
});
onUnmounted(() => {
  window.removeEventListener("focus", refreshSession);
  clearInterval(sessionInterval);
});

const handleRefreshMenu = async () => {
  refreshing.value = true;
  await authStore.refreshUserData();
  await loadMenus(true);
  refreshing.value = false;
};

// Watch for auto-refresh trigger from other components
watch(refreshTrigger, async (newVal) => {
  if (newVal > 0) {
    await loadMenus(true);
  }
});

// Listen to respoChanged event to reload menus for non-super admin
const handleRespoChanged = async () => {
  if (!authStore.isSuperAdmin) {
    await loadMenus(false);
  }
};

onMounted(() => {
  window.addEventListener("respoChanged", handleRespoChanged);
});

onUnmounted(() => {
  window.removeEventListener("respoChanged", handleRespoChanged);
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
});

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
const isMenuItemActive = (itemPath: string, itemName?: string): boolean => {
  const pathMatch =
    route.path === itemPath || route.path.startsWith(itemPath + "/");

  // Also check if current route has parentMenu meta that matches this item
  const parentMenuMeta = (route.meta?.parentMenu as string) || "";
  const parentMatch =
    !!itemName && parentMenuMeta.toLowerCase() === itemName.toLowerCase();

  return pathMatch || parentMatch;
};

// Static menu items (always visible)
const staticMenuItems = [
  {
    title: "Notifikasi",
    url: "/notifikasi",
    icon: "Bell",
    modul: null,
    superAdminOnly: false,
  },
  {
    title: "Dashboard",
    url: "/",
    icon: "LayoutDashboard",
    modul: null,
    superAdminOnly: false,
  },
  {
    title: "Menu",
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
          title: subModuleLabel(subModul),
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
        title: moduleLabel("SETUP"),
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
          title: subModuleLabel(subModul),
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
      title: moduleLabel(modulName),
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
      parent: menu.sub_modul
        ? `${moduleLabel(menu.modul)} > ${subModuleLabel(menu.sub_modul)}`
        : moduleLabel(menu.modul),
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
          parent: moduleLabel("SETUP"),
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
        name: "Mini Market",
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
      ? filteredMenuItems.value
          .filter((item: any) =>
            String(item.title || "")
              .toLowerCase()
              .includes(searchQuery.value.trim().toLowerCase()),
          )
          .filter((item: any) => item.url)
          .map((item: any) => ({
            title: item.title,
            url: item.url,
            icon: item.icon,
            isActive:
              route.path === item.url || route.path.startsWith(item.url + "/"),
            badge:
              item.url === "/notifikasi" && notificationCount.value > 0
                ? notificationCount.value
                : undefined,
          }))
      : [
          // Static items first
          {
            title: "Notifikasi",
            url: "/notifikasi",
            icon: "Bell",
            isActive: route.path === "/notifikasi",
            badge:
              notificationCount.value > 0 ? notificationCount.value : undefined,
          },
          {
            title: "Dashboard",
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
// const appVersion = __APP_VERSION__;
// const appReleaseDate = __APP_RELEASE_DATE__;
// const appVersionCompact = `v${appVersion.split(".")[0] ?? appVersion}`;
// const formattedReleaseDate = appReleaseDate
//   ? new Intl.DateTimeFormat("id-ID", {
//       day: "2-digit",
//       month: "short",
//       year: "numeric",
//     }).format(new Date(appReleaseDate))
//   : "-";
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarHeader
      class="border-b border-sidebar-border/70 bg-sidebar-header px-2 py-2.5 text-sidebar-header-foreground"
    >
      <TeamSwitcher
        @selectRespo="
          (respoId) => {
            selectedRespoId = respoId;
          }
        "
      />
    </SidebarHeader>

    <SidebarContent class="gap-1">
      <div class="px-3 pb-1 pt-3 group-data-[collapsible=icon]:px-2">
        <div class="relative flex items-center gap-2">
          <div class="relative flex-1">
            <Search
              class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/80 group-data-[collapsible=icon]:left-2"
            />
            <Input
              v-model="searchQuery"
              placeholder="Cari menu..."
              class="h-10 rounded-xl border-sidebar-border/70 bg-card/80 pl-9 pr-9 text-sm text-foreground shadow-sm shadow-black/[0.02] transition-colors placeholder:text-muted-foreground focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/30 group-data-[collapsible=icon]:cursor-pointer group-data-[collapsible=icon]:pl-8 group-data-[collapsible=icon]:pr-8"
              @focus="handleSearchFocus"
              @click="handleSearchFocus"
              :readonly="sidebar.state.value === 'collapsed'"
            />
            <button
              v-if="searchQuery"
              type="button"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:right-2"
              aria-label="Hapus pencarian"
              @mousedown.prevent
              @click="searchQuery = ''"
            >
              <X class="h-4 w-4" />
            </button>
          </div>

          <!-- Pencarian suara -->
          <div class="group-data-[collapsible=icon]:hidden">
            <VoiceMenuSearch @update:transcript="searchQuery = $event" />
          </div>
        </div>

        <!-- Muat ulang menu -->
        <button
          type="button"
          class="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-2 py-2 text-sm font-medium text-muted-foreground/85 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:px-2"
          :disabled="refreshing || loading"
          title="Muat ulang daftar menu"
          @click="handleRefreshMenu"
        >
          <RefreshCw :class="['h-4 w-4', refreshing ? 'animate-spin' : '']" />
          <span class="group-data-[collapsible=icon]:hidden">
            {{ refreshing ? "Memuat ulang..." : "Muat ulang menu" }}
          </span>
        </button>

        <div
          v-if="searchQuery.trim()"
          class="mt-2 px-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden"
        >
          {{ filteredMenuItems.length }} menu ditemukan
        </div>
      </div>

      <!-- Skeleton Loading -->
      <div v-if="loading" class="px-3 space-y-2">
        <div class="space-y-1">
          <Skeleton class="h-4 w-16 mb-2" />
          <Skeleton class="h-10 w-full" />
          <Skeleton class="h-10 w-full" />
          <Skeleton class="h-10 w-full" />
          <Skeleton class="h-10 w-full" />
        </div>
      </div>

      <!-- Actual Menu -->
      <NavMain v-else :items="data.navMain" />
    </SidebarContent>

    <SidebarFooter
      class="gap-2 border-t border-sidebar-border/70 bg-sidebar/80 px-2 pb-2.5 pt-2 backdrop-blur"
    >
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

        <!-- <div
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
            </div> -->
        <!-- <div
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
        </div> -->
      </template>
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>
</template>
