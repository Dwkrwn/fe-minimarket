import { apiCall } from "@/lib/api";

export interface RoutingMesinDetail {
  id?: string;
  m_routing_id?: string;
  sequence?: number;
  m_mesin_id?: string;
  notes?: string;
  m_mesin?: any;
}

export interface RoutingJobDetail {
  id?: string;
  m_routing_id?: string;
  sequence?: number;
  job_id?: string;
  notes?: string;
  m_general?: any;
}

export interface RoutingItemDetail {
  id?: string;
  m_routing_id?: string;
  sequence?: number;
  m_item_id?: string;
  m_item?: any;
}

export interface RoutingItem {
  id: string;
  m_unit_bisnis_id: string;
  code: string;
  name: string;
  is_mesin: boolean;
  note: string;
  status: boolean;
  is_active?: boolean;
  createdAt: string;
  updatedAt: string;
  m_unit_bisni?: {
    id?: string;
    nama_comp?: string;
    kode_unit_bisnis?: string;
  };
  m_unit_bisnis?: {
    id?: string;
    nama_comp?: string;
    kode_unit_bisnis?: string;
  };
  m_routing_d_mesin?: RoutingMesinDetail[];
  m_routing_d_job?: RoutingJobDetail[];
  m_routing_d_item?: RoutingItemDetail[];
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

export interface RoutingListResponse {
  status: string;
  data: RoutingItem[];
  pagination: Pagination;
}

export async function getRoutingList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  filters?: Record<string, string>,
  filterOperators?: Record<string, string>,
  where?: string,
): Promise<RoutingListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    include: "m_unit_bisnis",
  });

  if (search && search.trim()) {
    queryParams.append("search", search.trim());
  }

  if (searchfield) {
    queryParams.append("searchfield", searchfield);
  }

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_column_${key}`, value);
      }
    });
  }

  if (filterOperators) {
    Object.entries(filterOperators).forEach(([key, value]) => {
      if (value) {
        queryParams.append(`filter_operator_${key}`, value);
      }
    });
  }

  if (where) {
    queryParams.append("where", where);
  }

  return apiCall<RoutingListResponse>(`/dynamic/m_routing?${queryParams}`, {
    method: "GET",
  });
}

export async function getRoutingById(
  id: string,
): Promise<{ status: string; data: RoutingItem }> {
  return apiCall(
    `/dynamic/m_routing/${id}?join=all,sub`,
    {
      method: "GET",
    },
  );
}

export async function createRouting(
  data: Partial<RoutingItem>,
): Promise<{ status: string; data: RoutingItem }> {
  return apiCall("/dynamic/m_routing/with-details", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateRouting(
  id: string,
  data: Partial<RoutingItem>,
): Promise<{ status: string; data: RoutingItem }> {
  return apiCall(`/dynamic/m_routing/with-details/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteRouting(
  id: string,
): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_routing/with-details/${id}`, {
    method: "DELETE",
  });
}

export async function getRoutingListNoPagination(): Promise<RoutingListResponse> {
  return apiCall<RoutingListResponse>("/dynamic/m_routing?no_pagination=true", {
    method: "GET",
  });
}
