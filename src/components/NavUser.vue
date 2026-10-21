<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
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
const DEFAULT_COMPANY_LOGO = "/hutomoLogoPutih.png";

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
  if (!value) return DEFAULT_COMPANY_LOGO;
  if (value === DEFAULT_COMPANY_LOGO) return DEFAULT_COMPANY_LOGO;

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
    if (!selectRespo) return { name: "Bos Baut", logo: DEFAULT_COMPANY_LOGO };

    const parsed = JSON.parse(selectRespo);
    return {
      name: parsed.companyLegalName || parsed.companyName || "Bos Baut",
      logo: resolveCompanyLogo(parsed.companyLogo),
      nameRespo: parsed.respoName || "Bos Baut",
    };
  } catch {
    return { name: "Bos Baut", logo: DEFAULT_COMPANY_LOGO };
  }
});

// Get initials for avatar fallback
const userInitials = computed(() => {
  const name = authStore.user?.name || authStore.user?.username || "U";
  return name.substring(0, 2).toUpperCase();
});

const logoutDialogDescription = computed(() => {
  const userName = authStore.user?.name || "User";
  return `Apakah Anda yakin ingin logout? Anda akan dikembalikan ke halaman login.`;
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

    toast.success("Logout Berhasil", {
      description: `Sampai jumpa, ${userName}!`,
    });
    router.push("/login");
  } catch (error) {
    toast.error("Logout Gagal", {
      description: "Terjadi kesalahan saat logout",
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
            class="hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground transition-all duration-200"
          >
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-semibold">{{ displayName }}</span>
              <span class="truncate text-xs opacity-80">{{
                selectedCompany.nameRespo || "Bos Baut"
              }}</span>
            </div>
            <ChevronsUpDown
              class="ml-auto size-4 opacity-60 group-hover:opacity-100 transition-opacity"
            />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-[--reka-dropdown-menu-trigger-width] min-w-56 rounded-lg"
          :side="isMobile ? 'bottom' : 'right'"
          align="end"
          :side-offset="4"
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
                  selectedCompany.nameRespo || "Bos Baut"
                }}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            @click="showLogoutDialog"
            class="hover:bg-destructive/10 hover:text-destructive cursor-pointer transition-colors"
          >
            <LogOut class="opacity-60" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>

  <!-- Logout Confirmation Dialog -->
  <GlobalDialog
    :open="isLogoutDialogOpen"
    title="Logout"
    :description="logoutDialogDescription"
    type="warning"
    confirm-text="Logout"
    cancel-text="Batal"
    :is-loading="isLoggingOut"
    :logo-src="selectedCompany.logo"
    :logo-alt="selectedCompany.name"
    @confirm="handleLogout"
    @update:open="isLogoutDialogOpen = $event"
  />
</template>
