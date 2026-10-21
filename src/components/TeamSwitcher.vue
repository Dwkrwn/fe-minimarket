<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import { API_BASE_URL } from "@/lib/api";
import { ChevronsUpDown } from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const emit = defineEmits<{
  selectRespo: [respoId: string];
}>();

const { isMobile, state } = useSidebar();
const authStore = useAuthStore();
const DEFAULT_COMPANY_LOGO = "/hutomoLogoPutih.png";

// Check if sidebar is collapsed
const isCollapsed = computed(() => state.value === "collapsed");

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

type SidebarTeam = {
  id: string;
  companyName: string;
  unitBisnisName: string;
  logoSrc: string;
  isPrimary: boolean;
  isActive: boolean;
};

// Get respos from auth store
const respos = computed(() => {
  // For SUPER ADMIN, show the virtual respo
  if (authStore.isSuperAdmin) {
    return [
      {
        id: "super-admin-respo",
        companyName: "Bos Baut",
        unitBisnisName: "SUPER ADMIN",
        respoName: "Bos Baut",
        logoSrc: DEFAULT_COMPANY_LOGO,
        isPrimary: true,
        isActive: true,
      },
    ];
  }

  return authStore.userDetails.map((detail: any) => {
    const unitBisnis = detail.m_respo.unit_bisnis;
    const company = unitBisnis?.m_company;

    return {
      id: detail.id,
      companyName: company?.nama || "No Company",
      unitBisnisName: unitBisnis?.nama_comp || "-",
      respoName: detail.m_respo.nama || "-",
      logoSrc: resolveCompanyLogo(company?.logo_img),
      isPrimary: detail.is_primary,
      isActive: detail.is_active,
    };
  });
});

// Set default active team from primary respo
const activeTeam = ref<SidebarTeam>({
  id: "",
  companyName: "Loading...",
  unitBisnisName: "",
  logoSrc: DEFAULT_COMPANY_LOGO,
  isPrimary: false,
  isActive: false,
});

// Initialize active team
const initActiveTeam = () => {
  // Try to get saved respo from localStorage
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

  // Find respo by saved ID or fallback to primary
  let targetRespo =
    respos.value.find((r: any) => r.id === savedRespoId) ||
    respos.value.find((r: any) => r.isPrimary && r.isActive) ||
    respos.value.find((r: any) => r.isActive);

  if (targetRespo) {
    activeTeam.value = targetRespo;
  }
};

// Watch for auth store changes
watch(
  () => authStore.userDetails,
  () => {
    initActiveTeam();
  },
  { immediate: true },
);

// Initialize SelectRespo immediately on mount (untuk pertama kali login)
onMounted(() => {
  if (activeTeam.value.id) {
    const selectRespoData = extractSelectRespoData(activeTeam.value.id);
    localStorage.setItem("SelectRespo", JSON.stringify(selectRespoData));
  }
});

/**
 * Extract complete SelectRespo data:
 * - Respo info
 * - Menus available in the respo
 * - Permissions for each menu
 */
const extractSelectRespoData = (userDetailId: string) => {
  // For SUPER ADMIN, return empty structure
  if (authStore.isSuperAdmin) {
    return {
      respoId: "super-admin-respo",
      respoName: "Bos Baut",
      isPrimary: true,
      companyLegalName: "Bos Baut",
      companyLogo: DEFAULT_COMPANY_LOGO,
      unitBisnisName: "SUPER ADMIN",
      menus: [], // Super admin has access to all menus, will be handled separately
      permissions: {}, // Super admin has all permissions by default
    };
  }

  const userDetail = authStore.userDetails.find(
    (ud: any) => ud.id === userDetailId,
  );
  if (!userDetail?.m_respo) {
    return {
      respoId: userDetailId,
      respoName: "Unknown",
      isPrimary: false,
      menus: [],
      permissions: {},
    };
  }

  const permissions: Record<
    string,
    {
      is_read: boolean;
      is_create: boolean;
      is_update: boolean;
      is_delete: boolean;
      is_print: boolean;
    }
  > = {};

  // Collect unique menus dan permission final
  const menuMap = new Map<string, any>();

  userDetail.m_respo.m_respo_ds?.forEach((respoDetail: any) => {
    if (!respoDetail.is_active || !respoDetail.m_role?.is_active) return;

    respoDetail.m_role.m_role_ds?.forEach((roleDetail: any) => {
      const menuId = roleDetail.m_menu_id;

      // Store menu data
      if (roleDetail.m_menu && !menuMap.has(menuId)) {
        menuMap.set(menuId, {
          id: roleDetail.m_menu.id,
          name: roleDetail.m_menu.name,
          path: roleDetail.m_menu.path,
          icon: roleDetail.m_menu.icon,
          seq: roleDetail.m_menu.seq,
          modul: roleDetail.m_menu.modul,
          // Backend pakai nama field sub_mod, tapi untuk konsistensi
          // di frontend kita simpan sebagai sub_modul
          sub_modul:
            (roleDetail.m_menu as any).sub_mod ??
            (roleDetail.m_menu as any).sub_modul ??
            null,
        });
      }

      // Merge permissions if menu already exists (take most permissive)
      if (permissions[menuId]) {
        permissions[menuId].is_read =
          permissions[menuId].is_read || roleDetail.is_read;
        permissions[menuId].is_create =
          permissions[menuId].is_create || roleDetail.is_create;
        permissions[menuId].is_update =
          permissions[menuId].is_update || roleDetail.is_update;
        permissions[menuId].is_delete =
          permissions[menuId].is_delete || roleDetail.is_delete;
        permissions[menuId].is_print =
          permissions[menuId].is_print || roleDetail.is_print;
      } else {
        permissions[menuId] = {
          is_read: roleDetail.is_read,
          is_create: roleDetail.is_create,
          is_update: roleDetail.is_update,
          is_delete: roleDetail.is_delete,
          is_print: roleDetail.is_print,
        };
      }
    });
  });

  return {
    respoId: userDetail.id,
    respoName: userDetail.m_respo.nama,
    isPrimary: userDetail.is_primary,
    companyId: userDetail.m_respo.unit_bisnis?.id || null,
    companyName: userDetail.m_respo.unit_bisnis?.nama_comp || null,
    unitBisnisName: userDetail.m_respo.unit_bisnis?.nama_comp || null,
    companyLegalId: userDetail.m_respo.unit_bisnis?.m_company?.id || null,
    companyLegalName: userDetail.m_respo.unit_bisnis?.m_company?.nama || null,
    companyLogo: userDetail.m_respo.unit_bisnis?.m_company?.logo_img || null,
    gudangId: (userDetail.m_respo as any).m_gudang_id || null,
    menus: Array.from(menuMap.values()),
    permissions,
  };
};

// Emit respo change and cache complete SelectRespo data
watch(
  () => activeTeam.value,
  (newTeam) => {
    if (newTeam?.id) {
      // Extract complete respo data including menus and permissions
      const selectRespoData = extractSelectRespoData(newTeam.id);
      localStorage.setItem("SelectRespo", JSON.stringify(selectRespoData));

      // Clean up old localStorage keys if they exist
      localStorage.removeItem("selectedRespoId");
      localStorage.removeItem("selectedRespoPermissions");

      // Trigger event untuk notify semua components yang menggunakan permission
      // Send respoId (bukan user_detail.id) untuk tracking changes
      window.dispatchEvent(
        new CustomEvent("respoChanged", { detail: selectRespoData.respoId }),
      );

      emit("selectRespo", newTeam.id);
    }
  },
);
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            :class="[
              'items-start gap-3 py-2 hover:bg-sidebar-header-foreground/10 data-[state=open]:bg-sidebar-header-foreground/20',
              isCollapsed ? 'justify-center px-0' : '',
            ]"
          >
            <div
              :class="[
                'flex shrink-0 items-center justify-center rounded-lg aspect-auto',
                isCollapsed ? 'w-8' : 'w-15',
              ]"
            >
              <img
                :src="activeTeam.logoSrc"
                :alt="activeTeam.companyName"
                class="max-h-9 max-w-full object-contain"
              />
            </div>
            <div
              v-show="!isCollapsed"
              class="grid min-w-0 flex-1 gap-0.5 text-left text-sm leading-tight"
            >
              <span
                class="whitespace-normal break-words font-semibold text-sidebar-header-foreground"
              >
                {{ activeTeam.companyName }}
              </span>
              <span
                class="whitespace-normal break-words text-xs text-sidebar-header-foreground/70"
              >
                {{ activeTeam.unitBisnisName }}
              </span>
            </div>
            <ChevronsUpDown
              v-show="!isCollapsed"
              class="ml-auto size-4 shrink-0 self-start text-sidebar-header-foreground/80"
            />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-[--reka-dropdown-menu-trigger-width] min-w-56 rounded-lg"
          align="start"
          :side="isMobile ? 'bottom' : 'right'"
          :side-offset="4"
        >
          <DropdownMenuLabel class="text-xs text-muted-foreground px-2 py-1.5">
            Responsibility
          </DropdownMenuLabel>
          <DropdownMenuItem
            v-for="(respo, index) in respos"
            :key="respo.id"
            class="px-3 py-2 cursor-pointer flex-col items-start"
            :class="activeTeam.id === respo.id ? 'bg-primary/10' : ''"
            @click="activeTeam = respo"
          >
            <div class="flex w-full items-center justify-between">
              <span
                :class="activeTeam.id === respo.id ? 'font-semibold' : ''"
                >{{ respo.unitBisnisName }}</span
              >
              <DropdownMenuShortcut>⌘{{ index + 1 }}</DropdownMenuShortcut>
            </div>
            <span class="text-xs text-muted-foreground">{{
              respo.respoName
            }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
