import { createRouter, createWebHistory } from "vue-router";
import { canVisit } from "@/lib/access";
import { useAuthStore } from "@/stores/auth";
import Layout from "@/components/Layout.vue";

// Lazily load the heavier top-level views so they are not part of the entry
// chunk (Dashboard, Login and the 79 KB documentation page).
const Dashboard = () => import("@/views/dashboard/Dashboard.vue");
const Login = () => import("@/views/login/login.vue");
const Documentation = () => import("@/views/document.vue");

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

        // ====================================================================
        // MODUL 3 : PURCHASING
        // ====================================================================

        // 1.1 Data Pemasok
        {
          path: "/purchasing/master/suppliers",
          name: "PurchasingSuppliers",
          component: () =>
            import("@/views/purchasing/master/suppliers/SupplierLanding.vue"),
          meta: {
            title: "Supplier",
            requiresAuth: true,
          },
        },
        {
          path: "/purchasing/master/suppliers/form/:id?",
          name: "PurchasingSupplierForm",
          component: () =>
            import("@/views/purchasing/master/suppliers/SupplierForm.vue"),
          meta: {
            title: "Form Supplier",
            requiresAuth: true,
          },
        },
        {
          path: "/purchasing/master/suppliers/view/:id",
          name: "PurchasingSupplierView",
          component: () =>
            import("@/views/purchasing/master/suppliers/SupplierForm.vue"),
          meta: {
            title: "Detail Supplier",
            requiresAuth: true,
            readOnly: true,
          },
        },

        // 1.2 Katalog Harga & Produk Supplier
        {
          path: "/purchasing/master/supplier-catalogs",
          name: "PurchasingSupplierCatalogs",
          component: () =>
            import("@/views/purchasing/master/supplier_catalogs/SupplierCatalogView.vue"),
          meta: {
            title: "Katalog Harga Supplier",
            requiresAuth: true,
          },
        },
        {
          path: "/purchasing/master/supplier_catalogs",
          name: "PurchasingSupplierCatalogsUnderscore",
          redirect: { name: "PurchasingSupplierCatalogs" },
        },

        // 2.1 Rekomendasi Belanja Otomatis (Auto-PR)
        {
          path: "/purchasing/order/auto-pr",
          name: "PurchasingAutoPr",
          component: () =>
            import("@/views/purchasing/order/auto_pr/AutoPrLanding.vue"),
          meta: {
            title: "Rekomendasi Belanja",
            requiresAuth: true,
          },
        },
        {
          path: "/purchasing/order/auto_pr",
          name: "PurchasingAutoPrUnderscore",
          redirect: { name: "PurchasingAutoPr" },
        },

        // 2.2 Buat & Kelola Purchase Order (PO)
        {
          path: "/purchasing/order/purchase-orders",
          name: "PurchasingPurchaseOrders",
          component: () =>
            import("@/views/purchasing/order/purchase_orders/PurchaseOrderLanding.vue"),
          meta: {
            title: "Purchase Order",
            requiresAuth: true,
          },
        },
        {
          path: "/purchasing/order/purchase-orders/form",
          name: "PurchasingPurchaseOrderForm",
          component: () =>
            import("@/views/purchasing/order/purchase_orders/PurchaseOrderForm.vue"),
          meta: {
            title: "Form Purchase Order",
            requiresAuth: true,
          },
        },
        {
          path: "/purchasing/order/purchase-orders/view/:id",
          name: "PurchasingPurchaseOrderView",
          component: () =>
            import("@/views/purchasing/order/purchase_orders/PurchaseOrderDetail.vue"),
          meta: {
            title: "Detail Purchase Order",
            requiresAuth: true,
            readOnly: true,
          },
        },
        {
          path: "/purchasing/order/purchase-orders/print/:id",
          name: "PurchasingPurchaseOrderPrint",
          component: () =>
            import("@/views/purchasing/order/purchase_orders/PurchaseOrderPrintout.vue"),
          meta: {
            title: "Cetak Purchase Order",
            requiresAuth: true,
            readOnly: true,
          },
        },
        {
          path: "/purchasing/order/purchase_orders",
          name: "PurchasingPurchaseOrdersUnderscore",
          redirect: { name: "PurchasingPurchaseOrders" },
        },

        // 2.3 Pantau Status Pesanan (Tracking PO)
        {
          path: "/purchasing/order/tracking",
          name: "PurchasingPoTracking",
          component: () =>
            import("@/views/purchasing/order/tracking/PoTrackingView.vue"),
          meta: {
            title: "Tracking PO",
            requiresAuth: true,
          },
        },

        // 3.1 Input Barang Masuk (Goods Receipt)
        {
          path: "/purchasing/receiving/goods-receipts",
          name: "PurchasingGoodsReceipts",
          component: () =>
            import("@/views/purchasing/receiving/goods_receipts/GoodsReceiptLanding.vue"),
          meta: {
            title: "Penerimaan Barang",
            requiresAuth: true,
          },
        },
        {
          path: "/purchasing/receiving/goods-receipts/form",
          name: "PurchasingGoodsReceiptForm",
          component: () =>
            import("@/views/purchasing/receiving/goods_receipts/GoodsReceiptForm.vue"),
          meta: {
            title: "Form Penerimaan Barang",
            requiresAuth: true,
          },
        },
        {
          path: "/purchasing/receiving/goods-receipts/view/:id",
          name: "PurchasingGoodsReceiptView",
          component: () =>
            import("@/views/purchasing/receiving/goods_receipts/GoodsReceiptDetail.vue"),
          meta: {
            title: "Detail Penerimaan Barang",
            requiresAuth: true,
            readOnly: true,
          },
        },
        {
          path: "/purchasing/receiving/goods_receipts",
          name: "PurchasingGoodsReceiptsUnderscore",
          redirect: { name: "PurchasingGoodsReceipts" },
        },

        // 3.2 Retur Pembelian (Barang Rusak / Expired)
        {
          path: "/purchasing/receiving/purchase-returns",
          name: "PurchasingPurchaseReturns",
          component: () =>
            import("@/views/purchasing/receiving/purchase_returns/PurchaseReturnLanding.vue"),
          meta: {
            title: "Retur Pembelian",
            requiresAuth: true,
          },
        },
        {
          path: "/purchasing/receiving/purchase-returns/form",
          name: "PurchasingPurchaseReturnForm",
          component: () =>
            import("@/views/purchasing/receiving/purchase_returns/PurchaseReturnForm.vue"),
          meta: {
            title: "Form Retur Pembelian",
            requiresAuth: true,
          },
        },

        // 4.1 Verifikasi Nota Supplier (3-Way Matching)
        {
          path: "/purchasing/invoicing/invoices",
          name: "PurchasingPurchaseInvoices",
          component: () =>
            import("@/views/purchasing/invoicing/invoices/PurchaseInvoiceLanding.vue"),
          meta: {
            title: "Verifikasi Nota Supplier",
            requiresAuth: true,
          },
        },
        {
          path: "/purchasing/invoicing/invoices/verify/:poId",
          name: "PurchasingPurchaseInvoiceVerify",
          component: () =>
            import("@/views/purchasing/invoicing/invoices/PurchaseInvoiceVerify.vue"),
          meta: {
            title: "Verifikasi Nota Supplier",
            requiresAuth: true,
          },
        },

        // 4.2 Jadwal Jatuh Tempo & Status Bayar
        {
          path: "/purchasing/invoicing/payables",
          name: "PurchasingPayables",
          component: () =>
            import("@/views/purchasing/invoicing/payables/PayablesLanding.vue"),
          meta: {
            title: "Hutang & Pembayaran",
            requiresAuth: true,
          },
        },

        // 5.1 Laporan Riwayat Pembelian
        {
          path: "/purchasing/reports/purchase-history",
          name: "PurchasingPurchaseHistoryReport",
          component: () =>
            import("@/views/purchasing/reports/purchase_history/PurchaseHistoryReport.vue"),
          meta: {
            title: "Laporan Riwayat Pembelian",
            requiresAuth: true,
          },
        },

        // --------------------------------------------------------------------
        // Alias path Purchasing (pola sama seperti Inventory)
        // Supaya path yang diketik di Setup Menu tetap valid walau memakai
        // underscore atau hanya sampai level grup.
        // --------------------------------------------------------------------
        {
          path: "/purchasing",
          redirect: { name: "PurchasingSuppliers" },
        },
        {
          path: "/purchasing/master",
          redirect: { name: "PurchasingSuppliers" },
        },
        {
          path: "/purchasing/order",
          redirect: { name: "PurchasingAutoPr" },
        },
        {
          path: "/purchasing/receiving",
          redirect: { name: "PurchasingGoodsReceipts" },
        },
        {
          path: "/purchasing/receiving/purchase_returns",
          name: "PurchasingPurchaseReturnsUnderscore",
          redirect: { name: "PurchasingPurchaseReturns" },
        },
        {
          path: "/purchasing/invoicing",
          redirect: { name: "PurchasingPurchaseInvoices" },
        },
        {
          path: "/purchasing/reports",
          redirect: { name: "PurchasingPurchaseHistoryReport" },
        },
        {
          path: "/purchasing/reports/purchase_history",
          name: "PurchasingPurchaseHistoryReportUnderscore",
          redirect: { name: "PurchasingPurchaseHistoryReport" },
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

        // ====================================================================
        // MODUL 2 : INVENTORY - DAFTAR BARANG MINIMARKET (1.1)
        // Mendukung path standar /inventory/master/items dan /inventory/master/m_items
        // ====================================================================
        {
          path: "/inventory/master/items",
          name: "MinimarketItems",
          component: () =>
            import("@/views/inventory/master/m_items/MinimarketItemsView.vue"),
          meta: {
            title: "Daftar Barang Minimarket",
            requiresAuth: true,
          },
        },
        {
          path: "/inventory/master/items/form/:id?",
          name: "MinimarketItemForm",
          component: () =>
            import("@/views/inventory/master/m_items/MinimarketItemForm.vue"),
          meta: {
            title: "Form Barang Minimarket",
            requiresAuth: true,
          },
        },
        {
          path: "/inventory/master/items/view/:id",
          name: "MinimarketItemView",
          component: () =>
            import("@/views/inventory/master/m_items/MinimarketItemForm.vue"),
          meta: {
            title: "Detail Barang Minimarket",
            requiresAuth: true,
            readOnly: true,
          },
        },
        {
          path: "/inventory/master/m_items",
          name: "MinimarketItemsLegacyPath",
          component: () =>
            import("@/views/inventory/master/m_items/MinimarketItemsView.vue"),
          meta: {
            title: "Daftar Barang Minimarket",
            requiresAuth: true,
          },
        },
        {
          path: "/inventory/master/m_items/form/:id?",
          redirect: (to) => ({
            name: "MinimarketItemForm",
            params: to.params,
          }),
        },
        {
          path: "/inventory/master/m_items/view/:id",
          redirect: (to) => ({
            name: "MinimarketItemView",
            params: to.params,
          }),
        },

        // Inventory 1.2 - Kategori & Rak (zona RAK / GUDANG)
        {
          path: "/inventory/master/category-racks",
          name: "InventoryCategoryRacks",
          component: () =>
            import("@/views/inventory/master/category_racks/CategoryRackView.vue"),
          meta: {
            title: "Kategori & Rak",
            requiresAuth: true,
          },
        },
        {
          path: "/inventory/master/category-racks/form/:id?",
          name: "InventoryCategoryRackForm",
          component: () =>
            import("@/views/inventory/master/category_racks/CategoryRackForm.vue"),
          meta: {
            title: "Form Kategori & Rak",
            requiresAuth: true,
          },
        },
        {
          path: "/inventory/master/category-racks/view/:id",
          name: "InventoryCategoryRackView",
          component: () =>
            import("@/views/inventory/master/category_racks/CategoryRackForm.vue"),
          meta: {
            title: "Detail Kategori & Rak",
            requiresAuth: true,
            readOnly: true,
          },
        },
        {
          path: "/inventory/master/category_racks",
          name: "InventoryCategoryRacksUnderscore",
          redirect: { name: "InventoryCategoryRacks" },
        },
        {
          path: "/inventory/master/category_racks/form/:id?",
          redirect: (to) => ({
            name: "InventoryCategoryRackForm",
            params: to.params,
          }),
        },
        {
          path: "/inventory/master/category_racks/view/:id",
          redirect: (to) => ({
            name: "InventoryCategoryRackView",
            params: to.params,
          }),
        },

        // Inventory 1.3 - Satuan & Konversi (multi-UOM)
        {
          path: "/inventory/master/uoms",
          name: "InventoryUoms",
          component: () =>
            import("@/views/inventory/master/uoms/UomView.vue"),
          meta: {
            title: "Satuan & Konversi",
            requiresAuth: true,
          },
        },
        {
          path: "/inventory/master/uoms/form/:id?",
          name: "InventoryUomForm",
          component: () =>
            import("@/views/inventory/master/uoms/UomForm.vue"),
          meta: {
            title: "Form Satuan & Konversi",
            requiresAuth: true,
          },
        },
        {
          path: "/inventory/master/uoms/view/:id",
          name: "InventoryUomView",
          component: () =>
            import("@/views/inventory/master/uoms/UomForm.vue"),
          meta: {
            title: "Detail Satuan & Konversi",
            requiresAuth: true,
            readOnly: true,
          },
        },
        {
          path: "/inventory/master/m_uoms",
          redirect: { name: "InventoryUoms" },
        },
        {
          path: "/inventory/master/m_uoms/form/:id?",
          redirect: (to) => ({
            name: "InventoryUomForm",
            params: to.params,
          }),
        },
        {
          path: "/inventory/master/m_uoms/view/:id",
          redirect: (to) => ({
            name: "InventoryUomView",
            params: to.params,
          }),
        },

        // Inventory 1.4 - Batas Pemesanan Barang (ROP)
        {
          path: "/inventory/rop",
          name: "InventoryRop",
          component: () =>
            import("@/views/inventory/master/rop/RopView.vue"),
          meta: {
            title: "Batas Pemesanan (ROP)",
            requiresAuth: true,
          },
        },
        {
          path: "/inventory/master/rop",
          redirect: { name: "InventoryRop" },
        },

        // Inventory 2.1 - Posisi Stok Real-Time
        {
          path: "/inventory/stok/positions",
          name: "InventoryStockPositions",
          component: () =>
            import("@/views/inventory/stok/positions/StockPositionView.vue"),
          meta: {
            title: "Posisi Stok",
            requiresAuth: true,
          },
        },

        // Inventory 2.4 - Kartu Stok Kronologis
        {
          path: "/inventory/stok/cards",
          name: "InventoryStockCards",
          component: () =>
            import("@/views/inventory/stok/cards/StockCardView.vue"),
          meta: {
            title: "Kartu Stok",
            requiresAuth: true,
          },
        },

        // Inventory 2.2 - Mutasi Gudang ke Rak (GUDANG/ADMIN/SUPER_ADMIN)
        {
          path: "/inventory/stok/mutations",
          name: "InventoryStockMutations",
          component: () =>
            import("@/views/inventory/stok/mutations/StockMutationView.vue"),
          meta: {
            title: "Mutasi Stok",
            requiresAuth: true,
          },
        },

        // Inventory 2.3 - Barang Rusak / Hilang
        {
          path: "/inventory/stok/damaged",
          name: "InventoryDamagedStock",
          component: () =>
            import("@/views/inventory/stok/damaged/DamagedStockView.vue"),
          meta: {
            title: "Barang Rusak",
            requiresAuth: true,
          },
        },

        // Inventory 3.1 - Hitung Fisik / Stock Opname
        {
          path: "/inventory/opname/fisik",
          name: "InventoryOpnameFisik",
          component: () =>
            import("@/views/inventory/opname/fisik/OpnameLanding.vue"),
          meta: {
            title: "Hitung Fisik",
            requiresAuth: true,
          },
        },
        {
          path: "/inventory/opname/fisik/print/:id",
          name: "InventoryOpnamePrint",
          component: () =>
            import("@/views/inventory/opname/print/OpnamePrintout.vue"),
          meta: {
            title: "Cetak Formulir Opname",
            requiresAuth: true,
          },
        },
        {
          path: "/inventory/opname/fisik/:id",
          name: "InventoryOpnameCount",
          component: () =>
            import("@/views/inventory/opname/fisik/OpnameCount.vue"),
          meta: {
            title: "Formulir Hitung Fisik",
            requiresAuth: true,
          },
        },
        {
          path: "/inventory/opname",
          redirect: { name: "InventoryOpnameFisik" },
        },

        // Inventory 3.2 - Penyesuaian Stok
        {
          path: "/inventory/opname/adjustment",
          name: "InventoryOpnameAdjustment",
          component: () =>
            import("@/views/inventory/opname/adjustment/AdjustmentLanding.vue"),
          meta: {
            title: "Penyesuaian Stok",
            requiresAuth: true,
          },
        },
        {
          path: "/inventory/opname/adjustments",
          redirect: { name: "InventoryOpnameAdjustment" },
        },

        // ====================================================================
        // MODUL 4 : POS / TRANSAKSI
        // 5 halaman final: mesin kasir, buka/tutup shift, 2 laporan.
        // ====================================================================

        // 1.1 Mesin Kasir (fullscreen fokus, sidebar & header disembunyikan)
        {
          path: "/pos/kasir",
          name: "PosKasir",
          component: () => import("@/views/pos/kasir/KasirView.vue"),
          meta: {
            title: "Mesin Kasir",
            requiresAuth: true,
            fullscreen: true,
          },
        },

        // 2.1 Buka Shift
        {
          path: "/pos/shift/buka",
          name: "PosShiftOpen",
          component: () => import("@/views/pos/shift/OpenShiftView.vue"),
          meta: {
            title: "Buka Shift",
            requiresAuth: true,
          },
        },

        // 2.2 Tutup Shift (blind closing)
        {
          path: "/pos/shift/tutup",
          name: "PosShiftClose",
          component: () => import("@/views/pos/shift/CloseShiftView.vue"),
          meta: {
            title: "Tutup Shift",
            requiresAuth: true,
          },
        },

        // 3.1 Laporan Penjualan Shift Terkini
        {
          path: "/pos/reports/shift",
          name: "PosShiftReport",
          component: () => import("@/views/pos/reports/ShiftReportView.vue"),
          meta: {
            title: "Laporan Penjualan Shift",
            requiresAuth: true,
          },
        },

        // 3.2 Rekap Penjualan Harian Toko (hanya Admin/Super Admin)
        {
          path: "/pos/reports/harian",
          name: "PosDailySales",
          component: () => import("@/views/pos/reports/DailySalesView.vue"),
          meta: {
            title: "Rekap Penjualan Harian",
            requiresAuth: true,
          },
        },

        {
          path: "/pos",
          redirect: { name: "PosKasir" },
        },
        {
          path: "/pos/shift",
          redirect: { name: "PosShiftOpen" },
        },
        {
          path: "/pos/reports",
          redirect: { name: "PosShiftReport" },
        },

        // Auto-generated CRUD routes (Setup)
        ...crudRoutes,

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
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const currentRoute = router.currentRoute.value;
    if (!isFormRoute(currentRoute) || currentRoute.meta?.readOnly) return;

    // Only buttons carry the save/cancel labels we care about. Reading
    // textContent from arbitrary containers walks the whole subtree, so avoid it.
    const buttonText = (target.closest("button")?.textContent || "").trim().toLowerCase();
    const leafText = target.children.length === 0 ? (target.textContent || "").trim().toLowerCase() : "";
    const text = buttonText || leafText;

    if (/simpan|perbarui|save|submit/.test(text)) {
      isSaving = true;
      setTimeout(() => {
        isSaving = false;
      }, 3000);
      return;
    }

    if (text === "batal" || text === "kembali") {
      return;
    }

    // Single closest() call instead of one per selector.
    const isFormFieldClick =
      target.closest(
        "form, input, select, textarea, [role='combobox'], [role='option'], [role='listbox'], [role='dialog'], .field-x, table"
      ) !== null;

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
  // If we are saving, ensure dirty state is cleared
  if (isSaving) {
    isFormDirty = false;
  }

  // Intercept navigation if leaving a dirty form and not saving
  if (isFormRoute(from) && !from.meta?.readOnly && isFormDirty && !isSaving) {
    // Exception: Allow redirect to login without prompting (e.g., session expired)
    if (to.name === "Login") {
      isFormDirty = false;
      next();
      return;
    }

    const confirmLeave = await showConfirmDialog();
    if (!confirmLeave) {
      next(false);
      return;
    }
    isFormDirty = false;
  }

  const authStore = useAuthStore();

  // IMPORTANT: do not await /auth/me here. Blocking the navigation on a network
  // round-trip is what made page changes feel sluggish. Session validity is
  // enforced by the API layer (401 -> logout), and the profile is refreshed in
  // the background by refreshUserDataIfStale() in afterEach.
  authStore.checkAuth();

  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) { next({ name: 'Login', query: { redirect: to.fullPath } }); return; }
    if (!authStore.user || !canVisit(authStore.user, to.path, String(to.name), !!to.params.id, to.meta.requiresSuperAdmin === true)) {
      next({ name: 'Dashboard' }); return;
    }
  } else if (to.name === 'Login' && authStore.isAuthenticated) { next({ name: 'Dashboard' }); return; }

  next();
});

// Update document title on route change
router.afterEach((to) => {
  if (!isFormRoute(to)) {
    isFormDirty = false;
    isSaving = false;
  }
  const title = to.meta.title as string;
  document.title = title ? `Mini Market - ${title}` : "Mini Market";

  // Refresh the session profile at most once every few minutes, off the
  // navigation critical path.
  if (to.meta.requiresAuth) void useAuthStore().refreshUserDataIfStale();
});

export default router;
