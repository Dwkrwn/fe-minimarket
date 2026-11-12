import type { RouteRecordRaw } from "vue-router";
import { generateNotificationRoutes } from "./helpers";

/**
 * Notification routes
 *
 * Detail route hanya untuk modul yang masih ada di frontend minimarket:
 * item, purchase request, purchase order, purchase invoice, purchase return,
 * penerimaan gudang, dan supplier. Notifikasi stock opname diarahkan langsung ke
 * halaman Hitung Fisik (/inventory/opname/fisik/:id).
 */
export const notificationRoutes: RouteRecordRaw[] = [
  {
    path: "/notifikasi",
    name: "Notifikasi",
    component: () => import("@/views/notifikasi/notifikasi.vue"),
    meta: {
      title: "Notifikasi",
      requiresAuth: true,
    },
  },
  ...generateNotificationRoutes([
    {
      path: "",
      name: "NotifikasiItemDetail",
      component: "item/NotifikasItemDetail.vue",
      title: "Notifikasi Detail",
    },
    {
      path: "purchase-request",
      name: "NotifikasiPRDetail",
      component: "pr/NotifikasiPRDetail.vue",
      title: "Notifikasi Purchase Request",
    },
    {
      path: "purchase-order",
      name: "NotifikasiPODetail",
      component: "po/NotifikasiPODetail.vue",
      title: "Notifikasi Purchase Order",
    },
    {
      path: "purchase_invoice",
      name: "NotifikasiPIDetail",
      component: "pi/NotifikasiPIDetail.vue",
      title: "Notifikasi Purchase Invoice",
    },
    {
      path: "purchase-return",
      name: "NotifikasiPReturnDetail",
      component: "purchase_retrun/NotifikasiPReturnDetail.vue",
      title: "Notifikasi Purchase Return",
    },
    {
      path: "penerimaan_gudang",
      name: "NotifikasiPenerimaanGudangDetail",
      component: "t_penerimaan_gudang/NotifikasiPenerimaanGudangDetail.vue",
      title: "Notifikasi Penerimaan Gudang",
    },
    {
      path: "supplier",
      name: "NotifikasiSupplierDetail",
      component: "supplier/NotifikasiSuppDetail.vue",
      title: "Notifikasi Supplier",
    },
  ]),
];
