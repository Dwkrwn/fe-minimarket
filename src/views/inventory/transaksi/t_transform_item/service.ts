import { apiCall } from "@/lib/api";

// ============================================================================
// INTERFACES
// ============================================================================

export interface TransformItemDetailItem {
  id?: string;
  t_transform_item_id?: string;
  qty_transform?: number;
  panjang?: string | number;
  item_id?: string;
  stock_gudang_id?: string;
  rak?: string;
  batch?: string;
  catatan?: string;
  created_by?: string;
  updated_by?: string;
  m_item?: {
    id: string;
    kode_item: string;
    nama_item: string;
    nama_singkat?: string;
    uom?: {
      id: string;
      value1: string;
    };
    mi_uom?: {
      id: string;
      value1: string;
    };
    m_general?: {
      id: string;
      value1: string;
    };
  };
  item_transform?: {
    id: string;
    kode_item: string;
    nama_item: string;
    nama_singkat?: string;
    uom?: {
      id: string;
      value1: string;
    };
    mi_uom?: {
      id: string;
      value1: string;
    };
    m_general?: {
      id: string;
      value1: string;
    };
  };
  m_rak_d?: {
    id: string;
    kode: string;
  };
  m_rak?: {
    id: string;
    kode_rak?: string;
    nama_rak?: string;
  };
  rak_detail?: {
    id: string;
    kode: string;
  };
}

export interface TransformItemItem {
  id: string;
  no_transform_item?: string;
  no_t_transform_item?: string;
  tgl_t_transform_item?: string;
  m_unit_bisnis_id?: string;
  tgl_transform?: string;
  jenis_transform?: string;
  warehouse?: string;
  item_id?: string;
  qty?: number;
  satuan_id?: string;
  pic_id?: string;
  is_pemotongan?: boolean;
  status?: string;
  batch?: string;
  catatan?: string;
  createdAt?: string;
  updatedAt?: string;
  created_by?: string;
  updated_by?: string;
  m_unit_bisnis?: {
    id: string;
    nama_comp: string;
  };
  m_unit_bisni?: {
    id: string;
    nama_comp: string;
  };
  warehouse_rel?: {
    id: string;
    nama_gudang: string;
    kode_gudang: string;
  };
  m_gudang?: {
    id: string;
    nama_gudang: string;
    kode_gudang: string;
  };
  pic?: {
    id: string;
    nama_kary: string;
    kode_kary?: string;
  };
  m_kary?: {
    id: string;
    nama_kary: string;
    kode_kary?: string;
  };
  item?: {
    id: string;
    kode_item: string;
    nama_item: string;
    nama_singkat?: string;
    uom?: {
      id: string;
      value1: string;
    };
    mi_uom?: {
      id: string;
      value1: string;
    };
    m_general?: {
      id: string;
      value1: string;
    };
  };
  m_item?: {
    id: string;
    kode_item: string;
    nama_item: string;
    nama_singkat?: string;
    uom?: {
      id: string;
      value1: string;
    };
    mi_uom?: {
      id: string;
      value1: string;
    };
    m_general?: {
      id: string;
      value1: string;
    };
  };
  jenis_transform_rel?: {
    id: string;
    value1: string;
    code?: string;
  };
  jenis_trans_item?: {
    id: string;
    value1: string;
    code?: string;
  };
  m_jenis_transform?: {
    id: string;
    value1: string;
    code?: string;
  };
  satuan?: {
    id: string;
    value1: string;
  };
  m_satuan?: {
    id: string;
    value1: string;
  };
  t_transform_item_ds?: TransformItemDetailItem[];
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

export interface TransformItemListResponse {
  status: string;
  data: TransformItemItem[];
  pagination: Pagination;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

export async function getTransformItemList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = "createdAt",
  order_type: "ASC" | "DESC" = "DESC",
  search?: string,
  searchfield?: string,
  companyId?: string,
  where?: string,
  columnFilters?: Record<string, string>,
): Promise<TransformItemListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type,
  });

  const sanitizedSearchfield = searchfield
    ?.split(",")
    .map((field) => field.trim())
    .filter(Boolean)
    .filter((field) => field !== "no_t_transform_item")
    .join(",");

  if (search && search.trim()) {
    queryParams.append("search", search.trim());
  }

  if (sanitizedSearchfield) {
    queryParams.append("searchfield", sanitizedSearchfield);
  }

  if (companyId) {
    queryParams.append("filter_column_m_unit_bisnis_id", companyId);
  }

  if (where?.trim()) {
    queryParams.append("where", where.trim());
  }

  if (columnFilters) {
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (value && value.trim()) {
        queryParams.append(`filter_column_${key}`, value.trim());
      }
    });
  }

  queryParams.append(
    "include",
    "m_unit_bisnis,m_gudang,m_kary,m_items,m_general",
  );

  return apiCall<TransformItemListResponse>(
    `/dynamic/t_transform_item?${queryParams}`,
    {
      method: "GET",
    },
  );
}

export async function getTransformItemById(
  id: string,
): Promise<{ status: string; data: TransformItemItem }> {
  const includes = [
    "m_unit_bisnis",
    "m_gudang",
    "m_kary",
    "m_items:id|kode_item|nama_item|ukuran>m_general:id|value1",
    "m_general:id|value1|code",
    "t_transform_item_d>m_items:id|kode_item|nama_item>m_general:id|value1",
    "t_transform_item_d>stock_gudang",
  ].join(",");

  return apiCall(`/dynamic/t_transform_item/${id}?include=${includes}`, {
    method: "GET",
  });
}

export async function createTransformItem(
  data: Partial<TransformItemItem>,
): Promise<{ status: string; data: TransformItemItem }> {
  const hasDetails = !!(
    data.t_transform_item_ds && data.t_transform_item_ds.length > 0
  );
  const endpoint = hasDetails
    ? "/dynamic/t_transform_item/with-details"
    : "/dynamic/t_transform_item";

  return apiCall(endpoint, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTransformItem(
  id: string,
  data: Partial<TransformItemItem>,
): Promise<{ status: string; data: TransformItemItem }> {
  const hasDetails = !!(
    data.t_transform_item_ds && data.t_transform_item_ds.length > 0
  );
  const endpoint = hasDetails
    ? `/dynamic/t_transform_item/with-details/${id}`
    : `/dynamic/t_transform_item/${id}`;

  return apiCall(endpoint, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

function getApprovalByPath(
  path: string,
): { level: number; sender_id: string; id: string | null } | null {
  const approvalListStr = localStorage.getItem("approval_list");
  const authData = localStorage.getItem("auth_bb");

  if (!approvalListStr || !authData) return null;

  try {
    const approvalList = JSON.parse(approvalListStr);
    const auth = JSON.parse(authData);

    const approval = approvalList.find(
      (a: any) =>
        a.path === path && a.tipe_approve?.toUpperCase() === "MENYETUJUI",
    );

    if (!approval) return null;

    return {
      level: approval.level,
      sender_id: auth.user?.id || "",
      id: approval.id || null,
    };
  } catch {
    return null;
  }
}

export async function approveTransformItem(
  t_transform_item_id: string,
  t_transform_item_notifikasi_id: string | null,
  approval_level: number,
  approval_catatan: string | null,
): Promise<{ status: string; message?: string; data?: any }> {
  const approvalData = getApprovalByPath("/inventory/transaksi/t_transform_item");

  let fallbackUserId: string | null = null;
  if (!approvalData) {
    try {
      const authData = localStorage.getItem("auth_bb");
      if (authData) {
        const auth = JSON.parse(authData);
        fallbackUserId = auth.user?.id || null;
      }
    } catch {
      // ignore
    }
  }

  return apiCall("/fn/t_transform_item/approve", {
    method: "POST",
    body: JSON.stringify({
      t_transform_item_id,
      t_transform_item_notifikasi_id,
      approval_level: approvalData?.level ?? approval_level,
      approval_catatan,
      user_approved_id: approvalData?.sender_id ?? fallbackUserId,
      sender_id: approvalData?.sender_id ?? fallbackUserId,
      m_approval_id: approvalData?.id ?? null,
    }),
  });
}

export async function rejectTransformItem(
  t_transform_item_id: string,
  t_transform_item_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string | null,
): Promise<{ status: string; message?: string; data?: any }> {
  const approvalData = getApprovalByPath("/inventory/transaksi/t_transform_item");

  let fallbackUserId: string | null = null;
  if (!approvalData) {
    try {
      const authData = localStorage.getItem("auth_bb");
      if (authData) {
        const auth = JSON.parse(authData);
        fallbackUserId = auth.user?.id || null;
      }
    } catch {
      // ignore
    }
  }

  return apiCall("/fn/t_transform_item/reject", {
    method: "POST",
    body: JSON.stringify({
      t_transform_item_id,
      t_transform_item_notifikasi_id,
      approval_level: approvalData?.level ?? approval_level,
      approval_catatan,
      user_approved_id: approvalData?.sender_id ?? fallbackUserId,
    }),
  });
}

export async function revisiTransformItem(
  t_transform_item_id: string,
  t_transform_item_notifikasi_id: string,
  approval_level: number,
  approval_catatan: string | null,
): Promise<{ status: string; message?: string; data?: any }> {
  const approvalData = getApprovalByPath("/inventory/transaksi/t_transform_item");

  let fallbackUserId: string | null = null;
  if (!approvalData) {
    try {
      const authData = localStorage.getItem("auth_bb");
      if (authData) {
        const auth = JSON.parse(authData);
        fallbackUserId = auth.user?.id || null;
      }
    } catch {
      // ignore
    }
  }

  return apiCall("/fn/t_transform_item/revisi", {
    method: "POST",
    body: JSON.stringify({
      t_transform_item_id,
      t_transform_item_notifikasi_id,
      approval_level: approvalData?.level ?? approval_level,
      approval_catatan,
      user_approved_id: approvalData?.sender_id ?? fallbackUserId,
    }),
  });
}

export async function deleteTransformItem(
  id: string,
): Promise<{ status: string; message: string }> {
  return apiCall(`/dynamic/t_transform_item/with-details/${id}`, {
    method: "DELETE",
  });
}

export async function getTransformItemListNoPagination(): Promise<TransformItemListResponse> {
  return apiCall<TransformItemListResponse>(
    "/dynamic/t_transform_item?no_pagination=true",
    {
      method: "GET",
    },
  );
}

export async function getTransformItemLogs(
  targetId: string,
): Promise<{ status: string; data: any[] }> {
  if (!targetId) {
    return { status: "success", data: [] };
  }

  // 1. Primary endpoint: t_transform_item_logs dengan foreign key transform_item_id (sesuai structureTabel.md)
  try {
    const res = await apiCall<{ status: string; data: any[] }>(
      `/dynamic/t_transform_item_logs?filter_column_transform_item_id=${targetId}&order_by=createdAt&order_type=DESC&join=true`,
      {
        method: "GET",
      },
    );
    if (res?.status === "success" && Array.isArray(res.data)) {
      return res;
    }
  } catch {
    // Abaikan jika kolom transform_item_id berbeda, coba kolom alternatif di bawah
  }

  // 2. Fallback: jika di database kolom foreign key menggunakan prefix t_ (t_transform_item_id) pada model yang sama
  try {
    const fallbackRes = await apiCall<{ status: string; data: any[] }>(
      `/dynamic/t_transform_item_logs?filter_column_t_transform_item_id=${targetId}&order_by=createdAt&order_type=DESC&join=true`,
      {
        method: "GET",
      },
    );
    if (fallbackRes?.status === "success" && Array.isArray(fallbackRes.data)) {
      return fallbackRes;
    }
  } catch {
    // 3. Fallback tanpa join=true jika relasi include gagal
    try {
      const noJoinRes = await apiCall<{ status: string; data: any[] }>(
        `/dynamic/t_transform_item_logs?filter_column_transform_item_id=${targetId}&order_by=createdAt&order_type=DESC`,
        {
          method: "GET",
        },
      );
      if (noJoinRes?.status === "success" && Array.isArray(noJoinRes.data)) {
        return noJoinRes;
      }
    } catch {
      // Return empty array jika belum ada data log
    }
  }

  return { status: "success", data: [] };
}
