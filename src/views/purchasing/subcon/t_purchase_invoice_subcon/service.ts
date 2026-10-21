import { apiCall } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface PurchaseInvoiceSubconItem {
  tgl_pi: any;
  id: string;
  no_pi_subcon: string;
  no_t_purchase_invoice_subcon: string;
  tgl_t_purchase_invoice_subcon: string;
  m_unit_bisnis_id?: string;
  m_unit_bisnis?: any;
  m_supplier_id?: string;
  m_supplier?: any;
  top?: string;
  top_id?: string;
  tipe_ppn?: string;
  ppn_id?: string;
  persen_ppn?: number;
  nilai_ppn?: number;
  total_ppn?: number;
  tipe_pph?: string;
  pph_id?: string;
  persen_pph?: number;
  nilai_pph?: number;
  total_pph?: number;
  no_referensi?: string;
  catatan?: string;
  dpp?: number;
  dpp_lainnya?: number;
  total?: number;
  total_diskon?: number;
  grand_total?: number;
  status?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: any;
  // Detail items aktif
  t_purchase_invoice_subcon_jadis?: any[]; // Detail Finish Goods
  t_purchase_invoice_subcon_jasas?: any[]; // Detail Biaya Jasa
  // legacy field (data lama)
  t_purchase_invoice_subcon_details3?: any[]; // Deprecated: Detail Biaya Kirim
}

export interface Pagination {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
  currentRowsCount: number;
  next_page: number | null;
  prev_page: number | null;
}

export interface PurchaseInvoiceSubconListResponse {
  status: string;
  data: PurchaseInvoiceSubconItem[];
  pagination: Pagination;
  message?: string;
}

export interface PurchaseInvoiceSubconFilter {
  key: string;
  value: string;
  operator?: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

export async function getPurchaseInvoiceSubconList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  filter_created_by?: string,
  filters?: PurchaseInvoiceSubconFilter[] | Record<string, string>,
  where?: string,
): Promise<PurchaseInvoiceSubconListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    include: "m_unit_bisnis,m_supplier,m_general",
  });
  if (search?.trim()) queryParams.append("search", search.trim());
  if (searchfield) queryParams.append("searchfield", searchfield);
  if (filter_created_by)
    queryParams.append("filter_column_created_by", filter_created_by);

  if (Array.isArray(filters)) {
    filters.forEach((filter) => {
      if (filter.value && filter.value.trim()) {
        queryParams.append(`filter_column_${filter.key}`, filter.value.trim());
        if (filter.operator) {
          queryParams.append(`filter_operator_${filter.key}`, filter.operator);
        }
      }
    });
  } else if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value.trim()) {
        queryParams.append(`filter_column_${key}`, value.trim());
      }
    });
  }

  if (where?.trim()) {
    queryParams.append("where", where.trim());
  }

  return apiCall<PurchaseInvoiceSubconListResponse>(
    `/dynamic/t_purchase_invoice_subcon?${queryParams}`,
    { method: "GET" },
  );
}

export async function getPurchaseInvoiceSubconById(
  id: string,
): Promise<{ status: string; data: PurchaseInvoiceSubconItem }> {
  return apiCall(
    `/dynamic/t_purchase_invoice_subcon/${id}?include=m_unit_bisnis,m_supplier,m_general,t_penerimaan_barang_subcon,t_purchase_invoice_subcon_jadi>t_purchase_order_subcon,t_purchase_invoice_subcon_jadi>t_penerimaan_barang_subcon,t_purchase_invoice_subcon_jadi>m_items,t_purchase_invoice_subcon_jadi>m_general,t_purchase_invoice_subcon_jasa>t_purchase_order_subcon,t_purchase_invoice_subcon_jasa>t_penerimaan_barang_subcon,t_purchase_invoice_subcon_jasa>m_items,t_purchase_invoice_subcon_jasa>m_general`,
    { method: "GET" },
  );
}

export async function getPurchaseInvoiceSubconPopulateByPi(
  id: string,
): Promise<{ status: string; data: PurchaseInvoiceSubconItem }> {
  return apiCall(
    `/fn/t_purchase_invoice_subcon/getPopulateByPi?id=${encodeURIComponent(id)}`,
    { method: "GET" },
  );
}

export async function createPurchaseInvoiceSubcon(
  data: Partial<PurchaseInvoiceSubconItem>,
): Promise<{ status: string; data: PurchaseInvoiceSubconItem }> {
  const hasDetails = !!(
    (data.t_purchase_invoice_subcon_jadis &&
      data.t_purchase_invoice_subcon_jadis.length > 0) ||
    (data.t_purchase_invoice_subcon_jasas &&
      data.t_purchase_invoice_subcon_jasas.length > 0) ||
    (data.t_purchase_invoice_subcon_details3 &&
      data.t_purchase_invoice_subcon_details3.length > 0)
  );
  const endpoint = hasDetails
    ? "/dynamic/t_purchase_invoice_subcon/with-details"
    : "/dynamic/t_purchase_invoice_subcon";
  return apiCall(endpoint, { method: "POST", body: JSON.stringify(data) });
}

export async function updatePurchaseInvoiceSubcon(
  id: string,
  data: Partial<PurchaseInvoiceSubconItem>,
): Promise<{ status: string; data: PurchaseInvoiceSubconItem }> {
  const hasDetails = !!(
    data.t_purchase_invoice_subcon_jadis ||
    data.t_purchase_invoice_subcon_jasas ||
    data.t_purchase_invoice_subcon_details3
  );
  const endpoint = hasDetails
    ? `/dynamic/t_purchase_invoice_subcon/with-details/${id}`
    : `/dynamic/t_purchase_invoice_subcon/${id}`;
  return apiCall(endpoint, { method: "PUT", body: JSON.stringify(data) });
}

export async function deletePurchaseInvoiceSubcon(
  id: string,
): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/t_purchase_invoice_subcon/with-details/${id}`, {
    method: "DELETE",
  });
}

export async function getPurchaseInvoiceSubconListNoPagination(): Promise<PurchaseInvoiceSubconListResponse> {
  return apiCall<PurchaseInvoiceSubconListResponse>(
    "/dynamic/t_purchase_invoice_subcon?no_pagination=true",
    { method: "GET" },
  );
}
