import { apiCall } from "@/lib/api";

export interface StockOpnamePeriodeItem {
  id: string;
  no_periode_opname?: string;
  m_unit_bisnis_id?: string;
  tgl_mulai?: string;
  tgl_akhir?: string;
  durasi_manual_hari?: number;
  catatan?: string;
  is_locked?: boolean;
  locked_at?: string;
  printed_at?: string;
  printed_by?: string;
  print_count?: number;
  created_by?: string | null;
  update_by?: string | null;
  updated_by?: string | null;
  createdAt?: string;
  updatedAt?: string;
  m_unit_bisnis?: {
    id: string;
    nama_comp?: string;
  };
}

export interface StockOpnamePeriodeSummary {
  periode: StockOpnamePeriodeItem;
  opnames: any[];
  totals: {
    total_qty_selisih: number;
    total_nilai_selisih: number;
    total_qty_selisih_plus?: number;
    total_qty_selisih_minus?: number;
    total_nilai_selisih_plus?: number;
    total_nilai_selisih_minus?: number;
    total_data_plus?: number;
    total_data_minus?: number;
  };
}

export interface ColumnFilters {
  [key: string]: string;
}

export interface ColumnFilterOperators {
  [key: string]: string;
}

export interface PeriodeFilter {
  key: string;
  value: string;
  operator?: string;
}

export async function getPeriodeList(
  page = 1,
  paginate = 20,
  companyId?: string,
  filters?: PeriodeFilter[] | ColumnFilters,
  columnFilterOperators?: ColumnFilterOperators,
  search?: string,
  searchfield?: string,
  where?: string,
): Promise<{ status: string; data: StockOpnamePeriodeItem[]; pagination?: any }> {
  const params = new URLSearchParams({
    page: String(page),
    paginate: String(paginate),
    order_by: "createdAt",
    order_type: "DESC",
    include: "m_unit_bisnis",
  });
  if (companyId) params.append("filter_column_m_unit_bisnis_id", companyId);
  if (search && search.trim()) params.append("search", search.trim());
  if (searchfield) params.append("searchfield", searchfield);
  if (Array.isArray(filters)) {
    filters.forEach((filter) => {
      if (filter.value && filter.value.trim()) {
        params.append(`filter_column_${filter.key}`, filter.value.trim());
        if (filter.operator) {
          params.append(`filter_operator_${filter.key}`, filter.operator);
        }
      }
    });
  } else if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value && value.trim()) {
        params.append(`filter_column_${key}`, value.trim());
        if (columnFilterOperators?.[key]) {
          params.append(`filter_operator_${key}`, columnFilterOperators[key]);
        }
      }
    });
  }
  if (where) {
    params.append("where", where);
  }
  return apiCall(`/dynamic/t_stock_opname_periode?${params}`, { method: "GET" });
}

export async function getPeriodeById(id: string): Promise<{ status: string; data: StockOpnamePeriodeItem }> {
  return apiCall(`/dynamic/t_stock_opname_periode/${id}?include=m_unit_bisnis`, {
    method: "GET",
  });
}

export async function createPeriode(data: Partial<StockOpnamePeriodeItem>) {
  return apiCall(`/dynamic/t_stock_opname_periode`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePeriode(id: string, data: Partial<StockOpnamePeriodeItem>) {
  return apiCall(`/dynamic/t_stock_opname_periode/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deletePeriode(id: string) {
  return apiCall(`/dynamic/t_stock_opname_periode/${id}`, {
    method: "DELETE",
  });
}

export async function getPeriodeSummary(id: string): Promise<{ status: string; data: StockOpnamePeriodeSummary }> {
  return apiCall(`/fn/t_stock_opname_periode/getSummary?id=${id}`, { method: "GET" });
}

export async function printAndLockPeriode(id: string): Promise<{ status: string; message?: string; data?: any }> {
  return apiCall(`/fn/t_stock_opname_periode/printBeritaAcara?id=${id}`, {
    method: "POST",
  });
}
