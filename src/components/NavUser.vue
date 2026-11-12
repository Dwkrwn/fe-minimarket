<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { LogOut } from "lucide-vue-next";
import { useAuthStore } from "@/stores/auth";
import { API_BASE_URL } from "@/lib/api";
import { toast } from "vue-sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";

const router = useRouter();
const authStore = useAuthStore();
const { isMobile } = useSidebar();
const DEFAULT_COMPANY_LOGO = "/miniMarketLogo.png";

// Logout dialog state
const isLogoutDialogOpen = ref(false);
const isLoggingOut = ref(false);

// Get name and username from auth store
const displayName = computed(
  () => authStore.user?.name || authStore.user?.username || "User",
);
const username = computed(() => authStore.user?.username || "User");
const userType = computed(() => authStore.user?.tipe?.value1 || "User");

const resolveCompanyLogo = (logo?: string | null) => {
  if (!logo) return DEFAULT_COMPANY_LOGO;

  const value = String(logo).trim();
  if (!value || value === DEFAULT_COMPANY_LOGO || value === "/hutomoLogoPutih.png" || value === "/hutomoLogoHitam.png") {
    return DEFAULT_COMPANY_LOGO;
  }

  if (
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  if (value.startsWith("/")) {
    const baseUrl = API_BASE_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");
    return `${baseUrl}${value}`;
  }

  if (/^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length > 80) {
    return `data:image/png;base64,${value}`;
  }

  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");
  return `${baseUrl}/${value}`;
};

const selectedCompany = computed(() => {
  try {
    const selectRespo = localStorage.getItem("SelectRespo");
    if (!selectRespo) return { name: "Mini Market", logo: DEFAULT_COMPANY_LOGO, nameRespo: "Mini Market" };

    const parsed = JSON.parse(selectRespo);
    const rawName = parsed.companyLegalName || parsed.companyName || "Mini Market";
    const rawRespo = parsed.respoName || "Mini Market";
    return {
      name: (rawName === "Bos Baut" ? "Mini Market" : rawName),
      logo: resolveCompanyLogo(parsed.companyLogo),
      nameRespo: (rawRespo === "Bos Baut" ? "Mini Market" : rawRespo),
    };
  } catch {
    return { name: "Mini Market", logo: DEFAULT_COMPANY_LOGO, nameRespo: "Mini Market" };
  }
});

// Get initials for avatar fallback
const userInitials = computed(() => {
  const name = authStore.user?.name || authStore.user?.username || "U";
  return name.substring(0, 2).toUpperCase();
});

const logoutDialogDescription = computed(() => {
  return `Anda akan keluar dari akun ini dan kembali ke halaman masuk.`;
});

const showLogoutDialog = () => {
  isLogoutDialogOpen.value = true;
};

const handleLogout = async () => {
  isLoggingOut.value = true;
  try {
    const userName = authStore.user?.name || "User";
    authStore.logout();

    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 500));

    toast.success("Berhasil keluar", {
      description: `Sampai jumpa, ${userName}.`,
    });
    router.push("/login");
  } catch (error) {
    toast.error("Gagal keluar", {
      description: "Terjadi kesalahan saat keluar. Silakan coba lagi.",
    });
  } finally {
    isLoggingOut.value = false;
    isLogoutDialogOpen.value = false;
  }
};
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            class="h-auto rounded-lg p-2 transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:p-1.5"
          >
            <Avatar class="h-9 w-9 shrink-0 rounded-lg border border-sidebar-border bg-card">
              <AvatarImage
                :src="selectedCompany.logo"
                :alt="selectedCompany.name"
              />
              <AvatarFallback class="rounded-lg bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
                {{ userInitials }}
              </AvatarFallback>
            </Avatar>
            <div class="ml-2 grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
              <span class="truncate text-sm font-semibold text-sidebar-foreground">{{ displayName }}</span>
              <span class="truncate text-xs text-muted-foreground">{{
                selectedCompany.nameRespo || "Mini Market"
              }}</span>
            </div>
            <ChevronsUpDown
              class="ml-auto size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"
            />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="min-w-56 rounded-lg p-1.5 shadow-lg"
          :side="isMobile ? 'bottom' : 'right'"
          align="end"
          :side-offset="6"
        >
          <DropdownMenuLabel class="p-0 font-normal">
            <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar class="h-8 w-8 rounded-lg">
                <AvatarImage
                  :src="selectedCompany.logo"
                  :alt="selectedCompany.name"
                />
                <AvatarFallback class="rounded-lg">
                  {{ userInitials }}
                </AvatarFallback>
              </Avatar>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-semibold">{{ displayName }}</span>
                <span class="truncate text-xs">{{
                  selectedCompany.nameRespo || "Mini Market"
                }}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            class="cursor-pointer text-sm text-destructive focus:bg-destructive/10 focus:text-destructive"
            @click="showLogoutDialog"
          >
            <LogOut class="opacity-70" />
            Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>

  <!-- Logout Confirmation Dialog -->
  <GlobalDialog
    :open="isLogoutDialogOpen"
    title="Keluar dari aplikasi"
    :description="logoutDialogDescription"
    type="warning"
    confirm-text="Keluar"
    cancel-text="Batal"
    :is-loading="isLoggingOut"
    :logo-src="selectedCompany.logo"
    :logo-alt="selectedCompany.name"
    @confirm="handleLogout"
    @update:open="isLogoutDialogOpen = $event"
  />
</template>
