<script setup lang="ts">
import { computed, ref, onMounted, watch, onUnmounted } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import { Bell, MessageSquare, Moon, Sun } from "lucide-vue-next";
import AppSidebar from "@/components/AppSidebar.vue";
import { useAuthStore } from "@/stores/auth";
import { useChatbot } from "@/composables/useChatbot";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getUnifiedNotifications } from "@/views/notifikasi/service";

const { isOpen, toggleChat } = useChatbot();

const NOTIFICATION_STORAGE_KEY = "bb_read_notifications";
const LEGACY_THEME_KEY = "bb_color_theme";
const LEGACY_THEME_NAMES = [
  "zinc",
  "slate",
  "stone",
  "gray",
  "neutral",
  "red",
  "rose",
  "orange",
  "green",
  "blue",
  "yellow",
  "violet",
];

const route = useRoute();
const router = useRouter();

const pageTitleMap: Record<string, string> = {
  Dashboard: "Dasbor",
  Documentation: "Panduan",
  Login: "Masuk",
};
const pageTitle = computed(
  () => pageTitleMap[route.meta.title as string] || (route.meta.title as string) || "Dasbor",
);

// Tanggal & jam dalam bahasa Indonesia
const currentDateTime = ref(new Date());
const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
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
  return `${dayNames[date.getDay()]}, ${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
});

const formattedTime = computed(() =>
  currentDateTime.value.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }),
);

const timeOfDay = computed(() => {
  const hour = currentDateTime.value.getHours();
  if (hour >= 5 && hour < 11) return "Pagi";
  if (hour >= 11 && hour < 15) return "Siang";
  if (hour >= 15 && hour < 18) return "Sore";
  return "Malam";
});

let timeInterval: ReturnType<typeof setInterval>;

// Notifikasi
const notificationCount = ref(0);
const readNotificationIds = ref<Set<string>>(new Set());

const loadReadNotifications = () => {
  try {
    const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (stored) {
      readNotificationIds.value = new Set(JSON.parse(stored) as string[]);
    }
  } catch (e) {
    console.error("Gagal membaca status notifikasi:", e);
  }
};

const fetchNotificationCounts = async (forceRefresh = false) => {
  if (!useAuthStore().user?.capabilities?.notifications) return;
  try {
    loadReadNotifications();

    const unifiedResponse = await getUnifiedNotifications(1, 100, forceRefresh);
    const approvalRows = unifiedResponse.data?.approval || [];
    const revisiRows = unifiedResponse.data?.revisi || [];

    const validIds = new Set<string>(
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

    const approvalUnread = approvalRows.filter(
      (n: any) => !n.status && !readNotificationIds.value.has(String(n.id)),
    ).length;
    const revisiUnread = revisiRows.filter(
      (n: any) => !n.status && !readNotificationIds.value.has(String(n.id)),
    ).length;

    notificationCount.value = approvalUnread + revisiUnread;
  } catch (error) {
    console.error("Gagal memuat jumlah notifikasi:", error);
    notificationCount.value = 0;
  }
};

const handleNotificationRead = () => {
  loadReadNotifications();
  fetchNotificationCounts();
};

const handleNotificationsUpdated = () => {
  fetchNotificationCounts(true);
};

const handleStorageChange = (e: StorageEvent) => {
  if (e.key === NOTIFICATION_STORAGE_KEY) {
    loadReadNotifications();
    fetchNotificationCounts();
  }
};

const goToNotifications = () => {
  router.push("/notifikasi");
};

// Mode gelap/terang
const isDark = ref(false);

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

// Bersihkan sisa pemilih warna tema lama agar tampilan kembali netral
const cleanupLegacyThemes = () => {
  LEGACY_THEME_NAMES.forEach((name) => {
    document.documentElement.classList.remove(`theme-${name}`);
  });
  localStorage.removeItem(LEGACY_THEME_KEY);
};

onMounted(() => {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    isDark.value = true;
    document.documentElement.classList.add("dark");
  } else if (savedTheme === "light") {
    isDark.value = false;
    document.documentElement.classList.remove("dark");
  } else {
    isDark.value = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (isDark.value) {
      document.documentElement.classList.add("dark");
    }
  }

  cleanupLegacyThemes();
  fetchNotificationCounts(true);

  timeInterval = setInterval(() => {
    currentDateTime.value = new Date();
  }, 15000);

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

const notificationInterval = setInterval(fetchNotificationCounts, 300000);
onUnmounted(() => clearInterval(notificationInterval));

watch(
  () => route.path,
  async () => {
    await fetchNotificationCounts(true);
  },
);

// Tutup sidebar di layar kecil saat pindah halaman
watch(
  () => route.path,
  () => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      window.dispatchEvent(new CustomEvent("closeMobileSidebar"));
      setTimeout(() => {
        const overlay = document.querySelector('[data-sidebar="overlay"]');
        if (overlay) (overlay as HTMLElement).click();
      }, 50);
    }
  },
  { flush: "post" },
);
</script>

<template>
  <SidebarProvider :default-open="true">
    <AppSidebar />
    <SidebarInset class="min-w-0 overflow-hidden bg-background">
      <header
        class="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur md:px-6"
      >
        <div class="flex items-center gap-3">
          <SidebarTrigger
            class="h-10 w-10 shrink-0 rounded-lg border border-border bg-card text-foreground hover:bg-muted"
          />

          <div class="min-w-0 flex-1">
            <p class="hidden text-xs text-muted-foreground sm:block">
              {{ formattedDate }} &middot; {{ timeOfDay }} {{ formattedTime }}
            </p>
            <h1 class="truncate text-lg font-semibold text-foreground md:text-xl">
              {{ pageTitle }}
            </h1>
          </div>

          <div class="flex items-center gap-1.5">
            <button
              type="button"
              class="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Buka notifikasi"
              aria-label="Buka notifikasi"
              @click="goToNotifications"
            >
              <Bell class="h-5 w-5" />
              <span
                v-if="notificationCount > 0"
                class="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-destructive-foreground"
              >
                {{ notificationCount > 99 ? "99+" : notificationCount }}
              </span>
            </button>

            <button
              type="button"
              class="flex h-10 w-10 items-center justify-center rounded-lg transition-colors"
              :class="
                isOpen
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              "
              title="Buka asisten"
              aria-label="Buka asisten"
              @click="toggleChat"
            >
              <MessageSquare class="h-5 w-5" />
            </button>

            <button
              type="button"
              class="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              :title="isDark ? 'Gunakan mode terang' : 'Gunakan mode gelap'"
              :aria-label="isDark ? 'Gunakan mode terang' : 'Gunakan mode gelap'"
              @click="toggleTheme"
            >
              <Sun v-if="isDark" class="h-5 w-5" />
              <Moon v-else class="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main class="flex-1">
        <RouterView v-slot="{ Component, route: currentRoute }">
          <Transition name="page" mode="out-in">
            <div :key="currentRoute.path">
              <component :is="Component" v-if="Component" />
            </div>
          </Transition>
        </RouterView>
      </main>
    </SidebarInset>
  </SidebarProvider>
</template>

<style scoped>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.15s ease;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
}
</style>
