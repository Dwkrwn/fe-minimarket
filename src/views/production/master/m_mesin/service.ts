import { apiCall } from "@/lib/api";

export interface MesinSubDetail {
  id?: string;
  m_mesin_id?: string;
  status?: boolean;
  code?: string;
  name?: string;
  notes?: string;
}

export interface MesinItemDetail {
  id?: string;
  m_mesin_id?: string;
  m_item_id?: string;
  capacity?: number | string;
  unit_id?: string;
  status?: number | boolean;
  notes?: string;
  m_item?: any;
  m_items?: any;
  m_general?: any;
}

export interface MesinItem {
  id: string;
  m_unit_bisnis_id?: string;
  work_center?: string;
  status?: boolean;
  is_active?: boolean;
  tolerance?: number | string;
  code?: string;
  name?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  m_general?: {
    id?: string;
    group?: string;
    code?: string;
    value1?: string;
    [key: string]: any;
  };
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
  m_mesin_d_subs?: MesinSubDetail[];
  m_mesin_d_items?: MesinItemDetail[];
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

export interface MesinListResponse {
  status: string;
  data: MesinItem[];
  pagination: Pagination;
}

export async function getMesinList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  filters?: Record<string, string>,
  filterOperators?: Record<string, string>,
  where?: string,
): Promise<MesinListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
    include: "m_unit_bisnis,m_general",
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

  return apiCall<MesinListResponse>(`/dynamic/m_mesin?${queryParams}`, {
    method: "GET",
  });
}

export async function getMesinById(
  id: string,
): Promise<{ status: string; data: MesinItem }> {
  return apiCall(
    `/dynamic/m_mesin/${id}?join=all,sub`,
    {
      method: "GET",
    },
  );
}

export async function createMesin(
  data: Partial<MesinItem>,
): Promise<{ status: string; data: MesinItem }> {
  return apiCall("/dynamic/m_mesin/with-details", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateMesin(
  id: string,
  data: Partial<MesinItem>,
): Promise<{ status: string; data: MesinItem }> {
  return apiCall(`/dynamic/m_mesin/with-details/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteMesin(
  id: string,
): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/m_mesin/with-details/${id}`, {
    method: "DELETE",
  });
}

export async function getMesinListNoPagination(): Promise<MesinListResponse> {
  return apiCall<MesinListResponse>("/dynamic/m_mesin?no_pagination=true", {
    method: "GET",
  });
}
