import type { RouteRecordRaw } from "vue-router";
import { generateCrudRoutes } from "./helpers";

/**
 * Configuration for auto-generated CRUD routes
 * Each entry will generate 3 routes: Landing, Form, and View
 */
const crudRoutesConfig = [
  {
    path: "/accounting/master/m_coa",
    name: "Coa",
    title: "Coa",
    basePath: "/accounting/master/m_coa",
  },
  {
    path: "/inventory/transaksi/t_packing_plan",
    name: "PackingPlan",
    title: "Packing Plan",
    basePath: "/inventory/transaksi/t_packing_plan",
  },
  {
    path: "/purchasing/subcon/t_surat_jalan_subcon",
    name: "SuratJalanSubcon",
    title: "Surat Jalan Subcon",
    basePath: "/purchasing/subcon/t_surat_jalan_subcon",
  },
  {
    path: "/production/master/m_mesin",
    name: "Mesin",
    title: "Mesin",
    basePath: "/production/master/m_mesin",
  },
  {
    path: "/production/master/m_routing",
    name: "Routing",
    title: "Routing",
    basePath: "/production/master/m_routing",
  },
  {
    path: "/production/master/m_bom",
    name: "Bom",
    title: "Bom",
    basePath: "/production/master/m_bom",
  },
  {
    path: '/production/transaksi/t_io',
    name: 'Io',
    title: 'Internal Order',
    basePath: '/production/transaksi/t_io',
  },
  {
    path: '/production/transaksi/t_wo',
    name: 'Wo',
    title: 'Work Order',
    basePath: '/production/transaksi/t_wo',
  },
  {
    path: '/production/transaksi/t_wo_wip',
    name: 'WoWip',
    title: 'Work Order WIP',
    basePath: '/production/transaksi/t_wo_wip',
  },
  {
    path: '/production/transaksi/t_mrq',
    name: 'Mrq',
    title: 'Material Request',
    basePath: '/production/transaksi/t_mrq',
  },
  {
    path: '/production/transaksi/t_mtf',
    name: 'Mtf',
    title: 'Material Transfer',
    basePath: '/production/transaksi/t_mtf',
  },
  {
    path: '/production/transaksi/t_rc',
    name: 'Rc',
    title: 'Result Confirmation',
    basePath: '/production/transaksi/t_rc',
    prefix: ' ',
  },
  {
    path: '/production/transaksi/t_pres_wip',
    name: 'PresWip',
    title: 'Production Result WIP',
    basePath: '/production/transaksi/t_pres_wip',
  },
  {
    path: '/production/transaksi/t_ba',
    name: 'Ba',
    title: 'Berita Acara',
    basePath: '/production/transaksi/t_ba',
  },
  {
    path: '/production/transaksi/t_rc_wip',
    name: 'RcWip',
    title: 'Result Confirmation WIP',
    basePath: '/production/transaksi/t_rc_wip',
  },
  {
    path: '/production/transaksi/t_pres',
    name: 'Pres',
    title: 'Production Result',
    basePath: '/production/transaksi/t_pres',
  },
  {
    path: '/production/transaksi/t_mret',
    name: 'Mret',
    title: 'Material Return',
    basePath: '/production/transaksi/t_mret',
  },
  {
    path: '/production/transaksi/t_precost',
    name: 'Precost',
    title: 'Precost',
    basePath: '/production/transaksi/t_precost',
  },
  {
    path: '/production/transaksi/t_treq',
    name: 'Treq',
    title: 'WO Transfer Request',
    basePath: '/production/transaksi/t_treq',
  },
  {
    path: '/production/transaksi/t_qc',
    name: 'Qc',
    title: 'Qc',
    basePath: '/production/transaksi/t_qc',
  },
  {
    path: '/accounting/master/m_interface',
    name: 'Interface',
    title: 'Interface',
    basePath: '//accounting/master/m_interface',
  },
  {
    path: '/production/transaksi/t_mrp',
    name: 'Mrp',
    title: 'Mrp',
    basePath: '/production/transaksi/t_mrp',
  },
  // Setup Routes
  { 
    path: "/setup/m_general",
    name: "General",
    title: "General",
    basePath: "/setup/m_general",
  },
  {
    path: "/setup/user_default",
    name: "UserDefault",
    title: "UserDefault",
    basePath: "/setup/user_default",
  },
  {
    path: "/setup/m_unit_bisnis",
    name: "UnitBisnis",
    title: "UnitBisnis",
    basePath: "/setup/m_unit_bisnis",
  },
  {
    path: "/setup/m_prefix",
    name: "Prefix",
    title: "Prefix",
    basePath: "/setup/m_prefix",
  },
  {
    path: "/setup/m_role",
    name: "Role",
    title: "Role",
    basePath: "/setup/m_role",
  },
  {
    path: "/setup/m_respo",
    name: "Respo",
    title: "Respo",
    basePath: "/setup/m_respo",
  },
  {
    path: "/setup/m_kary",
    name: "Kary",
    title: "Karyawan",
    basePath: "/setup/m_kary",
  },
  {
    path: "/setup/m_approval",
    name: "Approval",
    title: "Approval",
    basePath: "/setup/m_approval",
  },
  {
    path: "/setup/m_currency",
    name: "Currency",
    title: "Currency",
    basePath: "/setup/m_currency",
  },
  {
    path: "/setup/m_item_group",
    name: "ItemGroup",
    title: "Item Group",
    basePath: "/setup/m_item_group",
  },
  {
    path: "/setup/m_kendaraan",
    name: "Kendaraan",
    title: "Kendaraan",
    basePath: "/setup/m_kendaraan",
  },
  {
    path: "/inventory/master/m_gudang",
    name: "Gudang",
    title: "Gudang",
    basePath: "/inventory/master/m_gudang",
  },
  {
    path: "/setup/m_company",
    name: "Company",
    title: "Company",
    basePath: "/setup/m_company",
  },
  // Purchasing Routes
  {
    path: "/purchasing/master/m_supplier",
    name: "Supplier",
    title: "Supplier",
    basePath: "/purchasing/master/m_supplier",
  },
  {
    path: "/inventory/master/m_items",
    name: "Items",
    title: "Items",
    basePath: "/inventory/master/m_items",
  },
  {
    path: "/purchasing/transaksi/t_purchase_request",
    name: "TPurchaseRequest",
    title: "Purchase Request",
    basePath: "/purchasing/transaksi/t_purchase_request",
  },
  {
    path: "/purchasing/transaksi/t_purchase_request_close",
    name: "TPurchaseRequestClose",
    title: "Purchase Request Close",
    basePath: "/purchasing/transaksi/t_purchase_request_close",
  },
  {
    path: "/purchasing/transaksi/t_purchase_order",
    name: "TPurchaseOrder",
    title: "Purchase Order",
    basePath: "/purchasing/transaksi/t_purchase_order",
  },
  {
    path: "/purchasing/transaksi/t_purchase_order_close",
    name: "TPurchaseOrderClose",
    title: "Purchase Order Close",
    basePath: "/purchasing/transaksi/t_purchase_order_close",
  },
  {
    path: "/purchasing/transaksi/t_purchase_invoice",
    name: "TPurchaseInvoice",
    title: "Purchase Invoice",
    basePath: "/purchasing/transaksi/t_purchase_invoice",
  },
  {
    path: "/purchasing/transaksi/t_purchase_return",
    name: "TPurchaseReturn",
    title: "Purchase Return",
    basePath: "/purchasing/transaksi/t_purchase_return",
  },
  {
    path: "/purchasing/transaksi/t_penerimaan",
    name: "TPenerimaan",
    title: "Penerimaan",
    basePath: "/purchasing/transaksi/t_penerimaan",
  },
  {
    path: "/purchasing/transaksi/t_rfq",
    name: "Rfq",
    title: "Rfq",
    basePath: "/purchasing/transaksi/t_rfq",
  },
  {
    path: "/purchasing/transaksi/t_supplier_quotation",
    name: "SupplierQuotation",
    title: "Supplier Quotation",
    basePath: "/purchasing/transaksi/t_supplier_quotation",
  },
  {
    path: "/purchasing/transaksi/t_import_cost",
    name: "ImportCost",
    title: "Biaya Kirim",
    basePath: "/purchasing/transaksi/t_import_cost",
  },
  {
    path: "/purchasing/master/m_ekspedisi",
    name: "Ekspedisi",
    title: "Ekspedisi",
    basePath: "/purchasing/master/m_ekspedisi",
  },
  {
    path: "/purchasing/subcon/t_purchase_request_subcon",
    name: "PurchaseRequestSubcon",
    title: "Purchase Request Subcon",
    basePath: "/purchasing/subcon/t_purchase_request_subcon",
  },
  {
    path: "/purchasing/subcon/t_purchase_order_subcon",
    name: "PurchaseOrderSubcon",
    title: "Purchase Order Subcon",
    basePath: "/purchasing/subcon/t_purchase_order_subcon",
  },
  {
    path: "/purchasing/subcon/t_penerimaan_subcon",
    name: "PenerimaanSubcon",
    title: "Penerimaan Subcon",
    basePath: "/purchasing/subcon/t_penerimaan_subcon",
  },
  {
    path: "/purchasing/subcon/t_biaya_kirim_subcon",
    name: "BiayaKirimSubcon",
    title: "Biaya Kirim Subcon",
    basePath: "/purchasing/subcon/t_biaya_kirim_subcon",
  },
  {
    path: "/purchasing/subcon/t_purchase_invoice_subcon",
    name: "PurchaseInvoiceSubcon",
    title: "Purchase Invoice Subcon",
    basePath: "/purchasing/subcon/t_purchase_invoice_subcon",
  },
  {
    path: "/purchasing/subcon/t_purchase_return_subcon",
    name: "PurchaseReturnSubcon",
    title: "Purchase Return Subcon",
    basePath: "/purchasing/subcon/t_purchase_return_subcon",
  },
  // Inventory Routes
  // m_items dipindah ke /inventory/master/m_items
  {
    path: "/inventory/master/m_transform",
    name: "Transform",
    title: "Transform",
    basePath: "/inventory/master/m_transform",
  },
  {
    path: "/inventory/master_group/m_g_category",
    name: "GCategory",
    title: "Category",
    basePath: "/inventory/master_group/m_g_category",
  },
  {
    path: "/inventory/master_group/m_g1_type",
    name: "G1Type",
    title: "G1 Type",
    basePath: "/inventory/master_group/m_g1_type",
  },
  {
    path: "/inventory/master_group/m_g2_material",
    name: "G2Material",
    title: "G2 Material",
    basePath: "/inventory/master_group/m_g2_material",
  },
  {
    path: "/inventory/master_group/m_g3_standard",
    name: "G3Standard",
    title: "G3 Standard",
    basePath: "/inventory/master_group/m_g3_standard",
  },
  {
    path: "/inventory/master_group/m_g4_subtype",
    name: "G4Subtype",
    title: "G4 Subtype",
    basePath: "/inventory/master_group/m_g4_subtype",
  },
  {
    path: "/inventory/master_group/m_g5_finishing",
    name: "G5Finishing",
    title: "G5 Finishing",
    basePath: "/inventory/master_group/m_g5_finishing",
  },
  {
    path: "/inventory/master_group/m_g6_merk",
    name: "G6Merk",
    title: "G6 Merk",
    basePath: "/inventory/master_group/m_g6_merk",
  },
  {
    path: "/inventory/master_group/m_g_ukuran",
    name: "GUkuran",
    title: "G Ukuran",
    basePath: "/inventory/master_group/m_g_ukuran",
  },
  // {
  //   path: "/inventory/m_items",
  //   name: "Items",
  //   title: "Items (Inventory)",
  //   basePath: "/inventory/m_items",
  //   activePath: "/inventory/m_items",
  // },
  {
    path: "/inventory/transaksi/t_stock_opname",
    name: "StockOpname",
    title: "Stock Opname",
    basePath: "/inventory/transaksi/t_stock_opname",
  },
  {
    path: "/inventory/transaksi/t_stock_opname_periode",
    name: "StockOpnamePeriode",
    title: "Periode Stock Opname",
    basePath: "/inventory/transaksi/t_stock_opname_periode",
  },
  {
    path: "/inventory/transaksi/t_stock_adj",
    name: "StockAdj",
    title: "Stock Adjustment",
    basePath: "/inventory/transaksi/t_stock_adj",
  },
  {
    path: "/inventory/master/m_rak",
    name: "Rak",
    title: "Rak",
    basePath: "/inventory/master/m_rak",
  },
  {
    path: "/inventory/transaksi/t_transform_item",
    name: "TransformItem",
    title: "Transform Item",
    basePath: "/inventory/transaksi/t_transform_item",
  },
  // Inventory - Warehouse
  {
    path: "/inventory/master/m_gudang",
    name: "Gudang",
    title: "Gudang",
    basePath: "/inventory/master/m_gudang",
  },
  {
    path: "/inventory/transaksi/t_transfer_gudang",
    name: "TransferGudang",
    title: "Transfer Gudang",
    basePath: "/inventory/transaksi/t_transfer_gudang",
  },
  {
    path: "/inventory/transaksi/t_sj_gudang",
    name: "SjGudang",
    title: "Surat Jalan Gudang",
    basePath: "/inventory/transaksi/t_sj_gudang",
  },
  {
    path: "/inventory/transaksi/t_penerimaan_gudang",
    name: "PenerimaanGudang",
    title: "Penerimaan Gudang",
    basePath: "/inventory/transaksi/t_penerimaan_gudang",
  },
  // Marketing Routes
  {
    path: "/marketing/master/m_customer",
    name: "Customer",
    title: "Customer",
    basePath: "/marketing/master/m_customer",
  },
  {
    path: "/marketing/master/m_prospek",
    name: "Prospek",
    title: "Prospek",
    basePath: "/marketing/master/m_prospek",
  },
  {
    path: "/marketing/transaksi/t_sales_quotation",
    name: "SalesQuotation",
    title: "Sales Quotation",
    basePath: "/marketing/transaksi/t_sales_quotation",
  },
  {
    path: "/marketing/master/m_customer_group",
    name: "CustomerGroup",
    title: "Customer Group",
    basePath: "/marketing/master/m_customer_group",
  },
  {
    path: "/marketing/master/m_wilayah",
    name: "Wilayah",
    title: "Wilayah",
    basePath: "/marketing/master/m_wilayah",
  },
  {
    path: "/marketing/transaksi/t_sales_order",
    name: "SalesOrder",
    title: "Sales Order",
    basePath: "/marketing/transaksi/t_sales_order",
  },
  {
    path: "/marketing/transaksi/t_sales_close",
    name: "SalesClose",
    title: "Sales Close",
    basePath: "/marketing/transaksi/t_sales_close",
  },
  {
    path: "/marketing/transaksi/t_sales_invoice",
    name: "SalesInvoice",
    title: "Sales Invoice",
    basePath: "/marketing/transaksi/t_sales_invoice",
  },
  {
    path: "/marketing/transaksi/t_sales_return",
    name: "SalesReturn",
    title: "Sales Return",
    basePath: "/marketing/transaksi/t_sales_return",
  },
  {
    path: "/marketing/transaksi/t_sales_reservation",
    name: "SalesReservation",
    title: "Sales Reservation",
    basePath: "/marketing/transaksi/t_sales_reservation",
  },
  {
    path: "/marketing/transaksi/t_surat_jalan",
    name: "SuratJalan",
    title: "Surat Jalan",
    basePath: "/marketing/transaksi/t_surat_jalan",
  },
];

/**
 * Generate all CRUD routes from config
 */
export const crudRoutes: RouteRecordRaw[] = crudRoutesConfig.flatMap((config) =>
  generateCrudRoutes(config),
);
