import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import Layout from "@/components/Layout.vue";
import Dashboard from "@/views/dashboard/Dashboard.vue";
import Login from "@/views/login/login.vue";
import Documentation from "@/views/document.vue";

// Import modular routes
import { notificationRoutes } from "./notifications";
import { crudRoutes } from "./crud-routes";
import { showConfirmDialog } from "@/lib/navigationGuard";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // ============================================================================
    // PUBLIC ROUTES (No Authentication Required)
    // ============================================================================
    {
      path: "/docs",
      name: "Documentation",
      component: Documentation,
      meta: { title: "Documentation", requiresAuth: false },
    },
    {
      path: "/login",
      name: "Login",
      component: Login,
      meta: { title: "Login", requiresAuth: false },
    },

    // ============================================================================
    // AUTHENTICATED ROUTES
    // ============================================================================
    {
      path: "/",
      component: Layout,
      meta: { requiresAuth: true },
      children: [
        // Dashboard
        {
          path: "",
          name: "Dashboard",
          component: Dashboard,
          meta: { title: "Dashboard", requiresAuth: true },
        },

        // Notification Routes
        ...notificationRoutes,

        // Menu Management (Super Admin only)
        {
          path: "/setup/menu",
          name: "Menu",
          component: () => import("@/views/setup/menu/MenuLanding.vue"),
          meta: {
            title: "Master Menu",
            requiresAuth: true,
            requiresSuperAdmin: true,
          },
        },
        {
          path: "/setup/menu/form/:id?",
          name: "MenuForm",
          component: () => import("@/views/setup/menu/MenuForm.vue"),
          meta: {
            title: "Form Menu",
            requiresAuth: true,
            requiresSuperAdmin: true,
          },
        },
        {
          path: "/setup/menu/view/:id",
          name: "MenuView",
          component: () => import("@/views/setup/menu/MenuForm.vue"),
          meta: {
            title: "Detail Menu",
            requiresAuth: true,
            requiresSuperAdmin: true,
            readOnly: true,
          },
        },

        // Format Nomor (shares active state with Prefix)
        {
          path: "/setup/m_format_nomor",
          name: "FormatNomor",
          component: () =>
            import("@/views/setup/m_prefix/FormatNomorLanding.vue"),
          meta: {
            title: "Format Nomor",
            requiresAuth: true,
            parentMenu: "Prefix",
          },
        },
        {
          path: "/setup/m_format_nomor/form/:id?",
          name: "FormatNomorForm",
          component: () => import("@/views/setup/m_prefix/FormatNomor.vue"),
          meta: {
            title: "Form Format Nomor",
            requiresAuth: true,
            parentMenu: "Prefix",
          },
        },
        {
          path: "/setup/m_format_nomor/view/:id",
          name: "FormatNomorView",
          component: () => import("@/views/setup/m_prefix/FormatNomor.vue"),
          meta: {
            title: "Detail Format Nomor",
            requiresAuth: true,
            readOnly: true,
            parentMenu: "Prefix",
          },
        },

        // Price List
        {
          path: "/purchasing/master/m_price_list",
          name: "PriceList",
          component: () =>
            import("@/views/purchasing/master/m_price_list/PriceList.vue"),
          meta: {
            title: "Master Price List",
            requiresAuth: true,
          },
        },

        // Company Structure (Single page custom hierarchy view)
        {
          path: "/setup/m_company_structure",
          name: "CompanyStructure",
          component: () =>
            import("@/views/setup/m_company_structure/CompanyStructureView.vue"),
          meta: {
            title: "Master Company Structure",
            requiresAuth: true,
          },
        },

        // Setting Dashboard (per role)
        {
          path: "/setup/m_dashboard",
          name: "DashboardSetup",
          component: () =>
            import("@/views/setup/m_dashboard/DashboardSetup.vue"),
          meta: {
            title: "Setting Dashboard",
            requiresAuth: true,
          },
        },

        // Component Showcase (Dev)
        {
          path: "/dev/component",
          name: "Component",
          component: () => import("@/views/dev/component/ComponentLanding.vue"),
          meta: {
            title: "Component Showcase",
            requiresAuth: true,
          },
        },

        // Auto-generated CRUD routes (Setup, Purchasing, Inventory, Marketing)
        ...crudRoutes,

        // Surat Jalan Gudang - Print Route
        {
          path: "/inventory/transaksi/t_sj_gudang/print/:id",
          name: "SjGudangPrint",
          component: () =>
            import("@/views/inventory/transaksi/t_sj_gudang/printout/SjGudangPrintout.vue"),
          meta: {
            title: "Cetak Surat Jalan Gudang",
            requiresAuth: true,
          },
        },

        // Surat Jalan Subcon - Print Route
        {
          path: "/purchasing/subcon/t_surat_jalan_subcon/print/:id",
          name: "SjSubconPrint",
          component: () =>
            import("@/views/purchasing/subcon/t_surat_jalan_subcon/printout/SjSubconPrintout.vue"),
          meta: {
            title: "Cetak Surat Jalan Subcon",
            requiresAuth: true,
          },
        },

        {
          path: "/purchasing/transaksi/t_purchase_order/print/:id",
          name: "TPurchaseOrderPrint",
          component: () =>
            import("@/views/purchasing/transaksi/t_purchase_order/printout/TPurchaseOrderPrintout.vue"),
          meta: {
            title: "Cetak Purchase Order",
            requiresAuth: true,
          },
        },
        // Quality Control - Print Route
        {
          path: "/production/transaksi/t_qc/print/:id",
          name: "QcPrint",
          component: () =>
            import("@/views/production/transaksi/t_qc/printout/QcPrintout.vue"),
          meta: {
            title: "Cetak Formulir Quality Control",
            requiresAuth: true,
          },
        },

        // Stock Opname - Print Route
        {
          path: "/inventory/transaksi/t_stock_opname/print/:id",
          name: "StockOpnamePrint",
          component: () =>
            import("@/views/inventory/transaksi/t_stock_opname/printout/StockOpnamePrintout.vue"),
          meta: {
            title: "Cetak Formulir Stock Opname",
            requiresAuth: true,
          },
        },
        {
          path: "/inventory/transaksi/t_stock_opname_periode/print/:id",
          name: "StockOpnamePeriodePrint",
          component: () =>
            import("@/views/inventory/transaksi/t_stock_opname_periode/printout/StockOpnamePeriodePrintout.vue"),
          meta: {
            title: "Cetak Berita Acara Periode Stock Opname",
            requiresAuth: true,
          },
        },

        // Info Stock Gudang (Single page view, no form/view)
        {
          path: "/inventory/transaksi/stock_gudang",
          name: "StockGudang",
          component: () =>
            import("@/views/inventory/transaksi/info_stock/InfoStockView.vue"),
          meta: {
            title: "Info Stock Gudang",
            requiresAuth: true,
          },
        },

        // Info Stock per Item (Single page view, no form/view)
        {
          path: "/inventory/transaksi/stock_gudang_2",
          name: "StockGudang2",
          component: () =>
            import("@/views/inventory/transaksi/info_stock_2/InfoStock2View.vue"),
          meta: {
            title: "Info Stock per Item",
            requiresAuth: true,
          },
        },

        // master pricelist form
        {
          path: "/marketing/master/m_pricelist",
          name: "Pricelist",
          component: () =>
            import("@/views/marketing/master/m_pricelist/PricelistForm.vue"),
          meta: {
            title: "Master Price List",
            requiresAuth: true,
          },
        },

        // ============================================================================
        // 404 NOT FOUND - CATCH ALL ROUTE (MUST BE LAST IN CHILDREN)
        // ============================================================================
        {
          path: "/:pathMatch(.*)*",
          name: "NotFound",
          component: () => import("@/views/NotFound.vue"),
          meta: {
            title: "404 - Halaman Tidak Ditemukan",
            requiresAuth: true,
          },
        },
      ],
    },
  ],
});

// ============================================================================
// FORM DIRTY CHECKING LOGIC
// ============================================================================

export let isFormDirty = false;
export let isSaving = false;

export const markFormDirty = () => {
  const currentRoute = router.currentRoute.value;
  if (isFormRoute(currentRoute) && !currentRoute.meta?.readOnly) {
    isFormDirty = true;
  }
};

export const resetFormDirty = () => {
  isFormDirty = false;
};

const isFormRoute = (route: any) => {
  if (!route) return false;
  const path = route.path || "";
  const name = (route.name || "").toString();
  const title = (route.meta?.title || "").toString();

  return (
    path.includes("/form") ||
    name.endsWith("Form") ||
    title.toLowerCase().startsWith("form ") ||
    title.toLowerCase().includes(" form") ||
    path.includes("/m_pricelist")
  );
};

if (typeof window !== "undefined") {
  // Listen to input and change events to detect form modifications
  const markAsDirty = () => {
    const currentRoute = router.currentRoute.value;
    if (isFormRoute(currentRoute) && !currentRoute.meta?.readOnly && !isSaving) {
      isFormDirty = true;
    }
  };

  window.addEventListener("input", markAsDirty, true);
  window.addEventListener("change", markAsDirty, true);

  // Catch clicks on form controls, inputs, selects, dropdowns, popups, and detail rows
  window.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (!target) return;

    const currentRoute = router.currentRoute.value;
    if (!isFormRoute(currentRoute) || currentRoute.meta?.readOnly) return;

    const text = (target.textContent || "").trim().toLowerCase();
    const closestBtnText = target.closest("button")?.textContent?.toLowerCase() || "";

    const isSaveButton =
      text.includes("simpan") ||
      text.includes("perbarui") ||
      text.includes("save") ||
      text.includes("submit") ||
      closestBtnText.includes("simpan") ||
      closestBtnText.includes("perbarui") ||
      closestBtnText.includes("save") ||
      closestBtnText.includes("submit");

    if (isSaveButton) {
      isSaving = true;
      setTimeout(() => {
        isSaving = false;
      }, 3000);
      return;
    }

    const isBatalButton =
      text === "batal" ||
      text === "kembali" ||
      closestBtnText === "batal" ||
      closestBtnText === "kembali";

    if (isBatalButton) {
      return;
    }

    // Check if click was inside a form field, input, select, dialog, popup, or table in form
    const isFormFieldClick =
      target.closest("form") !== null ||
      target.closest("input") !== null ||
      target.closest("select") !== null ||
      target.closest("textarea") !== null ||
      target.closest("[role='combobox']") !== null ||
      target.closest("[role='option']") !== null ||
      target.closest("[role='listbox']") !== null ||
      target.closest("[role='dialog']") !== null ||
      target.closest(".field-x") !== null ||
      target.closest("table") !== null;

    if (isFormFieldClick) {
      isFormDirty = true;
    }
  }, true);

  // Detect keyboard shortcuts for saving (Ctrl+S or Cmd+S)
  window.addEventListener("keydown", (e) => {
    const currentRoute = router.currentRoute.value;
    if (isFormRoute(currentRoute) && !currentRoute.meta?.readOnly && !isSaving) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        isSaving = true;
        setTimeout(() => {
          isSaving = false;
        }, 3000);
      } else if (e.key.length === 1 || e.key === "Backspace" || e.key === "Delete") {
        isFormDirty = true;
      }
    }
  }, true);

  // Intercept browser tab close or reload
  window.addEventListener("beforeunload", (e) => {
    const currentRoute = router.currentRoute.value;
    if (isFormDirty && isFormRoute(currentRoute) && !currentRoute.meta?.readOnly && !isSaving) {
      e.preventDefault();
      e.returnValue = "";
      return "";
    }
  });
}

// ============================================================================
// NAVIGATION GUARDS
// ============================================================================

router.beforeEach(async (to, from, next) => {
  console.log("Router guard transition:", {
    to: to.path,
    from: from.path,
    isFormDirty,
    isSaving,
    toIsForm: isFormRoute(to),
    fromIsForm: isFormRoute(from)
  });

  // If we are saving, ensure dirty state is cleared
  if (isSaving) {
    isFormDirty = false;
  }

  // Intercept navigation if leaving a dirty form and not saving
  if (isFormRoute(from) && !from.meta?.readOnly && isFormDirty && !isSaving) {
    console.log("Intercepting navigation away from dirty form");
    
    // Exception: Allow redirect to login without prompting (e.g., session expired)
    if (to.name === "Login") {
      isFormDirty = false;
      next();
      return;
    }

    const confirmLeave = await showConfirmDialog();
    console.log("Confirm dialog result:", confirmLeave);
    if (!confirmLeave) {
      console.log("User chose to stay, aborting navigation");
      next(false);
      return;
    }
    isFormDirty = false;
  }

  const authStore = useAuthStore();

  // CRITICAL: Check if user has valid session from localStorage
  authStore.checkAuth();

  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) {
      next({ name: "Login", query: { redirect: to.fullPath } });
      return;
    }

    // Check for Super Admin requirement
    if (to.meta.requiresSuperAdmin) {
      if (!authStore.isSuperAdmin) {
        console.warn(`Super Admin access required for: ${to.path}`);
        next({ name: "Dashboard" });
        return;
      }
    }

    // Check menu access permissions for regular users
    if (!authStore.isSuperAdmin) {
      // Routes yang tidak perlu cek menu permission (public untuk authenticated users)
      const publicRoutes = ["Dashboard", "Notifikasi", "NotifikasiItemDetail"];

      // Cek apakah route adalah bagian dari notifikasi (path dimulai dengan /notifikasi/)
      const isNotificationRoute = to.path.startsWith("/notifikasi");

      if (!publicRoutes.includes(to.name as string) && !isNotificationRoute) {
        const selectRespoData = localStorage.getItem("SelectRespo");

        if (selectRespoData) {
          try {
            const selectRespo = JSON.parse(selectRespoData);
            const userMenus = selectRespo.menus || [];

            let hasAccess = userMenus.some((menu: any) => {
              return (
                to.path === menu.path || to.path.startsWith(menu.path + "/")
              );
            });

            // Check parent menu for child routes
            if (!hasAccess && to.meta.parentMenu) {
              const parentMenuName = to.meta.parentMenu as string;
              hasAccess = userMenus.some((menu: any) => {
                if (
                  menu.name &&
                  menu.name.toLowerCase().includes(parentMenuName.toLowerCase())
                ) {
                  return true;
                }
                return false;
              });
            }

            // Check child route mapping
            if (!hasAccess) {
              const CHILD_ROUTE_MAPPING: Record<string, string> = {
                "/setup/m_format_nomor": "/setup/m_prefix",
              };

              const basePath = "/" + to.path.split("/").slice(1, 3).join("/");
              const parentPath = CHILD_ROUTE_MAPPING[basePath];

              if (parentPath) {
                hasAccess = userMenus.some((menu: any) => {
                  return (
                    menu.path === parentPath ||
                    to.path.startsWith(parentPath + "/")
                  );
                });
              }
            }

            if (!hasAccess) {
              console.warn(`Access denied to route: ${to.path}`);
              next({ name: "Dashboard" });
              return;
            }
          } catch (e) {
            console.error("Error parsing SelectRespo:", e);
          }
        }
      }
    }
  } else if (to.name === "Login" && authStore.isAuthenticated) {
    // Redirect to dashboard if already logged in and trying to access login
    next({ name: "Dashboard" });
    return;
  }

  next();
});

// Update document title on route change
router.afterEach((to) => {
  if (!isFormRoute(to)) {
    isFormDirty = false;
    isSaving = false;
  }
  const title = to.meta.title as string;
  document.title = title ? `HG - ${title}` : "HG - Hutomo Group";
});

export default router;
