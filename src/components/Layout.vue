<script setup lang="ts">
import { computed, ref, onMounted, watch, onUnmounted } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import { SwatchBook, MessageSquare } from "lucide-vue-next";
import AppSidebar from "@/components/AppSidebar.vue";
import { useChatbot } from "@/composables/useChatbot";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { getUnifiedNotifications } from "@/views/notifikasi/service";

const { isOpen, toggleChat } = useChatbot();

const NOTIFICATION_STORAGE_KEY = "bb_read_notifications";
const THEME_STORAGE_KEY = "bb_color_theme";

// Available themes with their display colors
const themes = [
  { name: "default", label: "Default", color: "hsl(213, 94%, 20%)" },
  { name: "zinc", label: "Zinc", color: "hsl(240, 5%, 26%)" },
  { name: "slate", label: "Slate", color: "hsl(215, 20%, 25%)" },
  { name: "stone", label: "Stone", color: "hsl(25, 6%, 25%)" },
  { name: "gray", label: "Gray", color: "hsl(220, 9%, 26%)" },
  { name: "neutral", label: "Neutral", color: "hsl(0, 0%, 23%)" },
  { name: "red", label: "Red", color: "hsl(0, 72%, 51%)" },
  { name: "rose", label: "Rose", color: "hsl(347, 77%, 50%)" },
  { name: "orange", label: "Orange", color: "hsl(25, 95%, 53%)" },
  { name: "green", label: "Green", color: "hsl(142, 71%, 45%)" },
  { name: "blue", label: "Blue", color: "hsl(217, 91%, 60%)" },
  { name: "yellow", label: "Yellow", color: "hsl(48, 96%, 53%)" },
  { name: "violet", label: "Violet", color: "hsl(263, 70%, 50%)" },
];

const currentTheme = ref("default");

const route = useRoute();
const router = useRouter();
const pageTitle = computed(() => route.meta.title || "Dashboard");

// Current date/time
const currentDateTime = ref(new Date());

// Format day name in Indonesian
const dayNames = [
  "Minggu",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
];
const monthNames = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const formattedDate = computed(() => {
  const date = currentDateTime.value;
  const dayName = dayNames[date.getDay()];
  const day = date.getDate().toString().padStart(2, "0");
  const month = monthNames[date.getMonth()]?.toUpperCase() || "";
  const year = date.getFullYear();
  return `${dayName}, ${day}.${month}.${year}`;
});

const formattedTime = computed(() => {
  return currentDateTime.value.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
});

const timeOfDay = computed(() => {
  const hour = currentDateTime.value.getHours();
  if (hour >= 5 && hour < 11) return "Pagi";
  if (hour >= 11 && hour < 15) return "Siang";
  if (hour >= 15 && hour < 18) return "Sore";
  return "Malam";
});

// Update time every second
let timeInterval: ReturnType<typeof setInterval>;

// Notification count
const notificationCount = ref(0);
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
    console.error("Failed to load read notifications:", e);
  }
};

// Fetch notification counts
const fetchNotificationCounts = async (forceRefresh = false) => {
  try {
    loadReadNotifications();

    const unifiedResponse = await getUnifiedNotifications(1, 100, forceRefresh);
    const approvalRows = unifiedResponse.data?.approval || [];
    const revisiRows = unifiedResponse.data?.revisi || [];

    // Collect all valid IDs from API response
    const validIds = new Set<string>(
      (unifiedResponse.active_ids || []).map((id) => String(id)),
    );

    // Remove stale IDs from localStorage that no longer exist in API
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

    const approvalUnread = approvalRows.filter(
      (n: any) => !n.status && !readNotificationIds.value.has(String(n.id)),
    ).length;
    const revisiUnread = revisiRows.filter(
      (n: any) => !n.status && !readNotificationIds.value.has(String(n.id)),
    ).length;

    notificationCount.value = approvalUnread + revisiUnread;
  } catch (error) {
    console.error("Failed to load notification counts:", error);
    notificationCount.value = 0;
  }
};

// Handle notification read event
const handleNotificationRead = () => {
  loadReadNotifications();
  fetchNotificationCounts();
};

const handleNotificationsUpdated = () => {
  fetchNotificationCounts(true);
};

// Handle storage change (cross-tab sync)
const handleStorageChange = (e: StorageEvent) => {
  if (e.key === NOTIFICATION_STORAGE_KEY) {
    loadReadNotifications();
    fetchNotificationCounts();
  }
};

// Go to notifications page
const goToNotifications = () => {
  router.push("/notifikasi");
};

// Dark mode toggle
const isDark = ref(false);

onMounted(() => {
  // Check if user has a preference in localStorage
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    isDark.value = true;
    document.documentElement.classList.add("dark");
  } else if (savedTheme === "light") {
    isDark.value = false;
    document.documentElement.classList.remove("dark");
  } else {
    // Check system preference
    isDark.value = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (isDark.value) {
      document.documentElement.classList.add("dark");
    }
  }

  // Load color theme
  loadColorTheme();

  // Fetch notification counts
  fetchNotificationCounts(true);

  // Start time interval
  timeInterval = setInterval(() => {
    currentDateTime.value = new Date();
  }, 1000);

  // Listen for notification events
  window.addEventListener("notificationRead", handleNotificationRead);
  window.addEventListener("notificationsUpdated", handleNotificationsUpdated);
  window.addEventListener("storage", handleStorageChange);
});

onUnmounted(() => {
  window.removeEventListener("notificationRead", handleNotificationRead);
  window.removeEventListener(
    "notificationsUpdated",
    handleNotificationsUpdated,
  );
  window.removeEventListener("storage", handleStorageChange);
  clearInterval(timeInterval);
});

// Refresh notification counts periodically every 5 minutes
const notificationInterval = setInterval(fetchNotificationCounts, 300000); // 5 minutes (300000ms)
onUnmounted(() => clearInterval(notificationInterval));

// Watch route changes to refresh notification counts on every menu change
watch(
  () => route.path,
  async () => {
    await fetchNotificationCounts(true);
  },
);

const toggleTheme = () => {
  isDark.value = !isDark.value;
  if (isDark.value) {
    document.documentElement.classList.add("dark");
    localStorage.setItem("theme", "dark");
  } else {
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }
};

// Color theme handling
const loadColorTheme = () => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme && themes.some((t) => t.name === savedTheme)) {
    currentTheme.value = savedTheme;
    applyColorTheme(savedTheme);
  }
};

const applyColorTheme = (themeName: string) => {
  // Remove all theme classes
  themes.forEach((t) => {
    document.documentElement.classList.remove(`theme-${t.name}`);
  });

  // Add new theme class (except default which has no class)
  if (themeName !== "default") {
    document.documentElement.classList.add(`theme-${themeName}`);
  }
};

const setColorTheme = (themeName: string) => {
  currentTheme.value = themeName;
  localStorage.setItem(THEME_STORAGE_KEY, themeName);
  applyColorTheme(themeName);
};

const getCurrentThemeColor = computed(() => {
  const theme = themes.find((t) => t.name === currentTheme.value);
  return theme?.color || "hsl(213, 94%, 20%)";
});

// Page transition animations
const onBeforeEnter = (el: Element) => {
  const element = el as HTMLElement;
  element.style.opacity = "0";
  element.style.transform = "translateY(10px)";
};

const onEnter = (el: Element, done: () => void) => {
  const element = el as HTMLElement;
  element.style.transition = "opacity 0.3s ease-out, transform 0.3s ease-out";

  requestAnimationFrame(() => {
    element.style.opacity = "1";
    element.style.transform = "translateY(0)";
  });

  setTimeout(done, 300);
};

const onLeave = (el: Element, done: () => void) => {
  const element = el as HTMLElement;
  element.style.transition = "opacity 0.2s ease-in, transform 0.2s ease-in";
  element.style.opacity = "0";
  element.style.transform = "translateY(-10px)";

  setTimeout(done, 200);
};

// Auto-close sidebar on mobile when route changes
// Watch route changes to close mobile sidebar
watch(
  () => route.path,
  (newPath) => {
    // Close mobile sidebar on route change immediately
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      const event = new CustomEvent("closeMobileSidebar");
      window.dispatchEvent(event);

      // Also try to close by finding and clicking the overlay/trigger
      setTimeout(() => {
        // Find sidebar overlay and click it to close
        const overlay = document.querySelector('[data-sidebar="overlay"]');
        if (overlay) {
          (overlay as HTMLElement).click();
        }
      }, 50);
    }
  },
  { flush: "post" },
);
</script>

<template>
  <SidebarProvider :default-open="true" ref="sidebarProvider">
    <AppSidebar />
    <SidebarInset class="overflow-hidden">
      <!-- Topbar -->
      <header
        class="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-6"
      >
        <SidebarTrigger />
        <Separator orientation="vertical" class="h-6" />

        <div class="flex flex-1 items-center justify-between">
          <div class="flex items-center gap-2">
            <h1 class="text-lg font-semibold">{{ pageTitle }}</h1>
          </div>

          <div class="flex items-center gap-2">
            <!-- Notification Bell -->
            <button
              @click="goToNotifications"
              class="group relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-primary/10 transition-all duration-200"
              title="Notifications"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="text-muted-foreground group-hover:text-primary transition-all duration-300"
                :class="{ 'animate-wiggle': notificationCount > 0 }"
              >
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              <!-- Badge -->
              <span
                v-if="notificationCount > 0"
                class="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground"
              >
                {{ notificationCount > 99 ? "99+" : notificationCount }}
              </span>
            </button>

            <!-- Chatbot Button -->
            <button
              @click="toggleChat"
              :class="[
                'group relative flex h-9 w-9 items-center justify-center rounded-md transition-all duration-200 z-[10001]',
                isOpen
                  ? 'bg-blue-600 shadow-md shadow-blue-500/20' /* Menyala Biru Solid SAAT DIBUKA */
                  : 'hover:bg-blue-500/20' /* Transparan SAAT DITUTUP */,
              ]"
              title="Chat Assistant"
            >
              <MessageSquare
                :class="[
                  'h-[18px] w-[18px] transition-all duration-300',
                  isOpen
                    ? 'text-white'
                    : 'text-muted-foreground group-hover:text-blue-700',
                ]"
              />
            </button>
            <!-- Theme Color Switcher -->
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <button
                  class="group flex h-9 items-center gap-2 px-2 rounded-md hover:bg-primary/10 transition-all duration-200"
                  title="Change Theme Color"
                >
                  <SwatchBook
                    class="h-[18px] w-[18px] text-muted-foreground group-hover:text-primary transition-all duration-300"
                  />
                  <span
                    class="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground group-hover:text-primary transition-all duration-300"
                  >
                    <span
                      class="h-3 w-3 rounded-full border border-border shadow-sm"
                      :style="{ backgroundColor: getCurrentThemeColor }"
                    ></span>
                    {{
                      themes.find((t) => t.name === currentTheme)?.label ||
                      "Default"
                    }}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" class="w-48 p-0">
                <DropdownMenuLabel class="px-3 py-2"
                  >Theme Color</DropdownMenuLabel
                >
                <DropdownMenuSeparator class="m-0" />
                <div class="max-h-[168px] overflow-y-auto theme-scrollbar">
                  <DropdownMenuRadioGroup :model-value="currentTheme">
                    <DropdownMenuRadioItem
                      v-for="theme in themes"
                      :key="theme.name"
                      :value="theme.name"
                      @click="setColorTheme(theme.name)"
                      class="flex items-center gap-2 cursor-pointer"
                    >
                      <span
                        class="h-4 w-4 rounded-full border border-border shadow-sm"
                        :style="{ backgroundColor: theme.color }"
                      ></span>
                      <span>{{ theme.label }}</span>
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <!-- Dark/Light Mode Toggle -->
            <button
              @click="toggleTheme"
              class="group flex h-9 w-9 items-center justify-center rounded-md hover:bg-primary/10 transition-all duration-200"
              :title="isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
            >
              <!-- Sun Icon (Light Mode) -->
              <svg
                v-if="!isDark"
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="text-muted-foreground group-hover:text-primary group-hover:rotate-45 transition-all duration-300"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>

              <!-- Moon Icon (Dark Mode) -->
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="text-muted-foreground group-hover:text-primary group-hover:rotate-[-15deg] transition-all duration-300"
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            </button>

            <!-- Date & Time Display -->
            <div class="hidden md:block w-px h-8 bg-primary/50"></div>
            <div
              class="hidden md:flex flex-col items-end text-right leading-tight"
            >
              <span class="text-xs font-medium text-foreground">{{
                formattedDate
              }}</span>
              <div class="w-full h-px bg-primary/50 my-0.5"></div>
              <div class="flex items-center gap-1">
                <span class="text-xs text-muted-foreground"
                  >{{ timeOfDay }},</span
                >
                <span class="text-xs font-mono text-primary font-medium">{{
                  formattedTime
                }}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="flex-1">
        <RouterView v-slot="{ Component, route }">
          <Transition
            name="page"
            mode="out-in"
            @before-enter="onBeforeEnter"
            @enter="onEnter"
            @leave="onLeave"
          >
            <div :key="route.path">
              <component :is="Component" v-if="Component" />
            </div>
          </Transition>
        </RouterView>
      </main>
    </SidebarInset>
  </SidebarProvider>
</template>

<style scoped>
@keyframes wiggle {
  0%,
  100% {
    transform: rotate(0deg);
  }

  25% {
    transform: rotate(-10deg);
  }

  50% {
    transform: rotate(10deg);
  }

  75% {
    transform: rotate(-5deg);
  }
}

.animate-wiggle {
  animation: wiggle 0.5s ease-in-out infinite;
  animation-delay: 2s;
  animation-iteration-count: 3;
}

/* Theme-aware scrollbar */
:deep(.theme-scrollbar) {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--primary)) transparent;
}

:deep(.theme-scrollbar)::-webkit-scrollbar {
  width: 6px;
}

:deep(.theme-scrollbar)::-webkit-scrollbar-track {
  background: transparent;
}

:deep(.theme-scrollbar)::-webkit-scrollbar-thumb {
  background-color: hsl(var(--primary));
  border-radius: 3px;
}

:deep(.theme-scrollbar)::-webkit-scrollbar-thumb:hover {
  background-color: hsl(var(--primary) / 0.8);
}
</style>
