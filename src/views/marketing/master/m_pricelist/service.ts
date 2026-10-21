import { API_BASE_URL, apiCall } from "@/lib/api";

export interface PricelistServiceFilterInput {
  unit_bisnis_id?: string;
  kategori_id?: string;
  group1_id?: string;
  group2_id?: string;
  group3_id?: string;
  group4_id?: string;
  group5_id?: string;
  group6_id?: string;
}

export interface PricelistHistoryRequest {
  pricelistId?: string;
  itemsId: string;
  page?: number;
  paginate?: number;
}

export type PricelistSavePayload =
  | Record<string, unknown>
  | Array<Record<string, unknown>>;

export interface PricelistPagination {
  page: number;
  paginate: number;
  total: number;
  total_pages: number;
}

export interface PricelistImportSuccessItem {
  id: string;
  items_id: string;
  qty_konversi: number;
  uom_id: string;
  harga_jual: number;
  hpp: number;
  max_disc_cust_1: number;
  max_disc_cust_2: number;
  max_disc_cust_3: number;
  max_disc_bi_1: number;
  max_disc_bi_2: number;
  max_disc_bi_3: number;
  nama_item?: string;
  kode_item?: string;
  uom?: string;
  uom_nama?: string;
  tanggal_berlaku?: string;
}

export interface PricelistImportErrorItem {
  row: number;
  nama_item?: string;
  message: string;
}

export interface PricelistImportResponse {
  status: string;
  message?: string;
  data?: PricelistImportSuccessItem[];
  errors?: PricelistImportErrorItem[];
}

export interface PricelistServiceResponse<T> {
  status: string;
  data: T;
  message?: string;
  errors?: PricelistImportErrorItem[];
  pagination?: Partial<PricelistPagination>;
  meta?: Partial<PricelistPagination>;
}

const appendIfFilled = (
  query: URLSearchParams,
  key: string,
  value?: string | boolean,
) => {
  if (value === undefined || value === null || value === "") {
    return;
  }

  query.append(key, String(value));
};

const getAuthToken = () => {
  const authData = localStorage.getItem("auth_bb");
  let token = "";

  if (authData) {
    try {
      token = JSON.parse(authData)?.token ?? "";
    } catch {
      token = "";
    }
  }

  return token;
};

const fetchBlob = async (
  endpoint: string,
  options: RequestInit,
  fallbackMessage: string,
): Promise<Blob> => {
  const token = getAuthToken();
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = fallbackMessage;

    try {
      const payload = await response.json();
      message = payload?.message || payload?.error || message;
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  return response.blob();
};

export function buildPricelistItemQuery(
  filters: PricelistServiceFilterInput,
): string {
  const query = new URLSearchParams();

  appendIfFilled(query, "filter_column_kategori_id", filters.kategori_id);
  appendIfFilled(query, "filter_column_group1_id", filters.group1_id);
  appendIfFilled(query, "filter_column_group2_id", filters.group2_id);
  appendIfFilled(query, "filter_column_group3_id", filters.group3_id);
  appendIfFilled(query, "filter_column_group4_id", filters.group4_id);
  appendIfFilled(query, "filter_column_group5_id", filters.group5_id);
  appendIfFilled(query, "filter_column_group6_id", filters.group6_id);
  appendIfFilled(query, "unit_bisnis_id", filters.unit_bisnis_id);

  return query.toString();
}

export async function savePricelist<T = unknown>(
  payload: PricelistSavePayload,
): Promise<PricelistServiceResponse<T>> {
  return apiCall<PricelistServiceResponse<T>>("/fn/m_pricelist/upsertByItems", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getPricelistHistory<T = unknown[]>(
  request: PricelistHistoryRequest,
): Promise<PricelistServiceResponse<T>> {
  const query = new URLSearchParams({
    filter_column_items_id: request.itemsId,
    order_by: "tanggal_berlaku",
    order_type: "DESC",
    page: String(request.page ?? 1),
    paginate: String(request.paginate ?? 10),
  });



  return apiCall<PricelistServiceResponse<T>>(
    `/dynamic/m_pricelist_history?${query.toString()}`,
    {
      method: "GET",
    },
  );
}

export async function uploadPricelistExcel<T = unknown>(
  formData: FormData,
  filters: PricelistServiceFilterInput,
): Promise<PricelistServiceResponse<T>> {
  const query = buildPricelistItemQuery(filters);
  const endpoint = query
    ? `/fn/m_pricelist/importExcel?${query}`
    : "/fn/m_pricelist/importExcel";

  return apiCall<PricelistServiceResponse<T>>(endpoint, {
    method: "POST",
    body: formData,
  });
}

export async function exportPricelistExcel(
  payload: PricelistSavePayload,
): Promise<Blob> {
  return fetchBlob(
    `${API_BASE_URL}/fn/m_pricelist/exportExcel`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Gagal export excel pricelist",
  );
}

export async function downloadPricelistTemplate(
  filters: PricelistServiceFilterInput,
): Promise<Blob> {
  const query = buildPricelistItemQuery(filters);
  const endpoint = query
    ? `${API_BASE_URL}/fn/m_pricelist/downloadTemplate?${query}`
    : `${API_BASE_URL}/fn/m_pricelist/downloadTemplate`;

  return fetchBlob(
    endpoint,
    {
      method: "GET",
    },
    "Gagal download template pricelist",
  );
}
