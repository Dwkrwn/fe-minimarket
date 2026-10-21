import type { RouteRecordRaw } from "vue-router";
import { generateNotificationRoutes } from "./helpers";

/**
 * Notification routes
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
      path: "stock_opname",
      name: "NotifikasiStockOpnameDetail",
      component: "stock_opname/NotifikasiStockOpnameDetail.vue",
      title: "Notifikasi StockOpname",
    },
    {
      path: "stock_adj",
      name: "NotifikasiStockAdjDetail",
      component: "stock_adjustment/NotifikasiStockAdjDetail.vue",
      title: "Notifikasi StockAdj",
    },
    {
      path: "transfer_gudang",
      name: "NotifikasiTransferGudangDetail",
      component: "transfer_gudang/NotifikasiTransferGudangDetail.vue",
      title: "Notifikasi Transfer Gudang",
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
      path: "purchase_order_close",
      name: "NotifikasiTPurchaseOrderCloseDetail",
      component: "purchase_order_close/NotifikasiTPurchaseOrderCloseDetail.vue",
      title: "Notifikasi TPurchaseOrderClose",
    },
    {
      path: "purchase_request_close",
      name: "NotifikasiTPurchaseRequestCloseDetail",
      component:
        "purchase_request_close/NotifikasiTPurchaseRequestCloseDetail.vue",
      title: "Notifikasi Purchase Request Close",
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
    {
      path: "transform_item",
      name: "NotifikasiTransformItemDetail",
      component: "NotifikasiTransformItemDetail.vue",
      title: "Notifikasi Transform Item",
    },
    {
      path: "internal_order",
      name: "NotifikasiIoDetail",
      component: "NotifikasiIoDetail.vue",
      title: "Notifikasi Internal Order",
    },
    {
      path: "purchase_request_subcon",
      name: "NotifikasiPurchaseRequestSubconDetail",
      component:
        "purchase_request_subcon/NotifikasiPurchaseRequestSubconDetail.vue",
      title: "Notifikasi Purchase Request Subcon",
    },
    {
      path: "purchase_order_subcon",
      name: "NotifikasiPurchaseOrderSubconDetail",
      component:
        "purchase_order_subcon/NotifikasiPurchaseOrderSubconDetail.vue",
      title: "Notifikasi Purchase Order Subcon",
    },
    {
      path: "purchase_invoice_subcon",
      name: "NotifikasiPISubconDetail",
      component: "purchase_invoice_subcon/NotifikasiPISubconDetail.vue",
      title: "Notifikasi Purchase Invoice Subcon",
    },
    {
      path: "purchase_return_subcon",
      name: "NotifikasiPurchaseReturnSubconDetail",
      component: "NotifikasiPurchaseReturnSubconDetail.vue",
      title: "Notifikasi Purchase Return Subcon",
    },
    {
      path: "m_customer",
      name: "NotifikasiCustomerDetail",
      component: "m_customer/NotifikasiCustomerDetail.vue",
      title: "Notifikasi Customer",
    },
    {
      path: "m_customer_change",
      name: "NotifikasiCustomerChangeDetail",
      component: "m_customer_change/NotifikasiCustomerChangeDetail.vue",
      title: "Notifikasi Perubahan Customer",
    },
    {
      path: "work_order",
      name: "NotifikasiWoDetail",
      component: "wo/NotifikasiWoDetail.vue",
      title: "Notifikasi Work Order",
    },
    {
      path: "work_order_wip",
      name: "NotifikasiWoWipDetail",
      component: "NotifikasiWoWipDetail.vue",
      title: "Notifikasi Work Order WIP",
    },
    {
      path: "precost",
      name: "NotifikasiPrecostDetail",
      component: "precost/NotifikasiPrecostDetail.vue",
      title: "Notifikasi Precost",
    },
    {
      path: "material_transfer",
      name: "NotifikasiMtfDetail",
      component: "NotifikasiMtfDetail.vue",
      title: "Notifikasi Material Transfer",
    },
    {
      path: "material_request",
      name: "NotifikasiMrqDetail",
      component: "NotifikasiMrqDetail.vue",
      title: "Notifikasi Material Request",
    },
    {
      path: "result_confirmation",
      name: "NotifikasiRcDetail",
      component: "NotifikasiRcDetail.vue",
      title: "Notifikasi Result Confirmation",
    },
  ]),
];


