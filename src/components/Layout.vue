<script setup lang="ts">
import { computed, ref, onMounted, watch, onUnmounted } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import { Bell, MessageSquare, Moon, Sun } from "lucide-vue-next";
import AppSidebar from "@/components/AppSidebar.vue";
import { useChatbot } from "@/composables/useChatbot";
import { useNotificationBadge } from "@/composables/useNotificationBadge";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const { isOpen, toggleChat } = useChatbot();

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
  Dashboard: "Dashboard",
  Documentation: "Panduan",
  Login: "Masuk",
};
const pageTitle = computed(
  () => pageTitleMap[route.meta.title as string] || (route.meta.title as string) || "Dashboard",
);

// Layar kasir tampil fullscreen: sidebar & header disembunyikan agar fokus.
const isFullscreen = computed(() => route.meta.fullscreen === true);

/** Ikon notifikasi di header disembunyikan; user memakai menu Notifikasi di sidebar. */
const SHOW_HEADER_NOTIFICATION = false;

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

// Notifikasi — state + polling dimiliki oleh composable bersama supaya
// Layout dan AppSidebar tidak melakukan fetch ganda.
const {
  notificationCount,
  start: startNotificationBadge,
  stop: stopNotificationBadge,
} = useNotificationBadge();

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
  startNotificationBadge();

  timeInterval = setInterval(() => {
    currentDateTime.value = new Date();
  }, 15000);
});

onUnmounted(() => {
  stopNotificationBadge();
  clearInterval(timeInterval);
});

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
  <!-- Mode fullscreen (mis. Mesin Kasir): tanpa sidebar & header. -->
  <div v-if="isFullscreen" class="relative min-h-screen bg-background">
    <RouterView v-slot="{ Component, route: currentRoute }">
      <Transition name="page">
        <div :key="currentRoute.path" class="min-h-screen">
          <component :is="Component" v-if="Component" />
        </div>
      </Transition>
    </RouterView>
  </div>

  <SidebarProvider v-else :default-open="true">
    <AppSidebar />
    <SidebarInset class="min-w-0 overflow-hidden bg-background">
      <header
        class="sticky top-0 z-10 border-b border-border/70 bg-background/85 px-4 py-3 backdrop-blur-sm supports-[backdrop-filter]:bg-background/70 md:px-6"
      >
        <div class="flex items-center gap-3">
          <SidebarTrigger
            class="h-10 w-10 shrink-0 rounded-xl border border-border/70 bg-card text-foreground shadow-sm transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
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
              v-if="SHOW_HEADER_NOTIFICATION"
              type="button"
              class="relative flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
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
              class="flex h-10 w-10 items-center justify-center rounded-xl transition-colors"
              :class="
                isOpen
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground'
              "
              title="Buka asisten"
              aria-label="Buka asisten"
              @click="toggleChat"
            >
              <MessageSquare class="h-5 w-5" />
            </button>

            <button
              type="button"
              class="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
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

      <main class="relative flex-1">
        <RouterView v-slot="{ Component, route: currentRoute }">
          <Transition name="page">
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
.page-enter-active {
  transition: opacity 0.12s ease;
}

/* Keep the outgoing page out of the layout so the incoming page can render
   immediately (no mode="out-in" delay, no height jump). */
.page-leave-active {
  transition: opacity 0.12s ease;
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.page-enter-from,
.page-leave-to {
  opacity: 0;
}
</style>
