import { ref, reactive, computed, onBeforeMount } from "vue";
import { useRouter, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createStockOpname,
  updateStockOpname,
  getStockOpnameById,
  approveStockOpname,
} from "./service";

interface StockOpnameFormValues {
  no_stock_opname: string;
  m_unit_bisnis_id: string;
  m_gudang_id: string;
  m_rak_id: string;
  t_stock_opname_periode_id: string;
  status: string;
  tgl_opname: string;
  catatan: string;
  pic_opname_id: string;
  created_by: string;
}

interface StockOpnameFormErrors {
  m_unit_bisnis_id: string;
  m_gudang_id: string;
  m_rak_id: string;
  t_stock_opname_periode_id: string;
  tgl_opname: string;
  pic_opname_id: string;
}

const toLocalYmd = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeYmd = (value: unknown): string => {
  if (!value) return "";

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : toLocalYmd(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match?.[1]) {
      return match[1];
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return toLocalYmd(parsed);
    }
  }

  return "";
};

export function useStockOpnameForm() {
  const authStore = useAuthStore();
  const { API_BASE_URL } = useApi();
  const router = useRouter();
  const route = useRoute();

  const loading = ref(false);
  const isEditMode = computed(
    () => !!route.params.id && route.name === "StockOpnameForm",
  );
  const isViewMode = computed(() => route.name === "StockOpnameView");
  const isCopyMode = computed(
    () => route.query.action === "copy" && !!route.query.source,
  );
  const isReadOnly = computed(
    () => isViewMode.value || (route.meta as any).readOnly === true,
  );
  const menuId = computed(() => route.params.id as string);

  const isSuperAdmin = computed(() => {
    const user = authStore.user;
    if (!user || !user.tipe) return false;
    return user.tipe.value1?.toUpperCase() === "SUPER ADMIN";
  });

  const companyNameDisplay = computed(() => {
    if (!isSuperAdmin.value) {
      try {
        const selectRespo = localStorage.getItem("SelectRespo");
        if (selectRespo) {
          const parsed = JSON.parse(selectRespo);
          return parsed.companyName || "-";
        }
      } catch (e) {
        console.error("Failed to parse SelectRespo:", e);
      }
    }
    return "-";
  });

  const pageTitle = computed(() => {
    if (isViewMode.value) return "Detail Stock Opname";
    if (isCopyMode.value) return "Salin Stock Opname";
    if (isEditMode.value) return "Edit Stock Opname";
    return "Tambah Stock Opname Baru";
  });

  const pageDescription = computed(() => {
    if (isViewMode.value) return "Lihat detail data Stock Opname";
    if (isCopyMode.value)
      return "Buat Stock Opname baru dari data yang disalin";
    if (isEditMode.value) return "Perbarui data Stock Opname";
    return "Buat Stock Opname baru";
  });

  const values = reactive<StockOpnameFormValues>({
    no_stock_opname: "",
    m_unit_bisnis_id: "",
    m_gudang_id: "",
    m_rak_id: "",
    t_stock_opname_periode_id: "",
    status: "LOCK",
    tgl_opname: toLocalYmd(new Date()),
    catatan: "",
    pic_opname_id: "",
    created_by: authStore.user?.id || authStore.user?.username || "",
  });

  let initialValues: Record<string, any> = {};
  const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

  const detailItems = ref<any[]>([]);
  const isSuperAdminDialogOpen = ref(false);

  const selectedItemIds = computed(() => {
    return detailItems.value
      .map((item: any) => item.stock_gudang_id)
      .filter(Boolean);
  });

  const rackOptions = ref<{ id: string; label: string }[]>([]);
  const selectedCompanyName = ref<string>("");

  const onUnitBisnisSelected = (selectedData: any) => {
    if (!selectedData) {
      selectedCompanyName.value = "";
      return;
    }
    // Field company dari API /dynamic/m_unit_bisnis ada di m_company.nama
    const full = selectedData.fullData ?? selectedData;
    selectedCompanyName.value =
      full?.m_company?.nama ||
      full?.m_company?.nama_company ||
      full?.company?.nama ||
      full?.company?.nama_company ||
      full?.company_name ||
      "";
  };

  const getRakLabelById = (rakId?: string): string => {
    if (!rakId) return "-";
    return rackOptions.value.find((r) => r.id === rakId)?.label || "-";
  };

  const fetchRackOptionsByGudang = async (gudangId: string) => {
    if (!gudangId) {
      rackOptions.value = [];
      return;
    }
    try {
      const response = await fetch(
        `${API_BASE_URL}/dynamic/m_rak?filter_column_m_gudang_id=${gudangId}&filter_column_is_active=true&filter_column_is_rak_opname=false&no_pagination=true`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authStore.token}`,
          },
        },
      );
      const result = await response.json();
      if (result.status !== "success") {
        rackOptions.value = [];
        return;
      }
      const raks = Array.isArray(result.data) ? result.data : [];
      rackOptions.value = raks.map((rak: any) => ({
        id: rak.id,
        label: rak.nama_rak || rak.kode_rak || "-",
      }));
    } catch (error) {
      rackOptions.value = [];
      console.error("Failed to fetch rack options by gudang:", error);
    }
  };

  const removeDetailItem = (index: number) => {
    detailItems.value.splice(index, 1);
    toast.info("Item detail dihapus");
  };

  const errors = reactive<StockOpnameFormErrors>({
    m_unit_bisnis_id: "",
    m_gudang_id: "",
    m_rak_id: "",
    t_stock_opname_periode_id: "",
    tgl_opname: "",
    pic_opname_id: "",
  });

  const onReset = () => {
    Object.assign(values, {
      no_stock_opname: "",
      m_unit_bisnis_id: "",
      m_gudang_id: "",
    m_rak_id: "",
    t_stock_opname_periode_id: "",
      status: "LOCK",
      tgl_opname: toLocalYmd(new Date()),
      catatan: "",
      pic_opname_id: "",
      created_by: authStore.user?.id || authStore.user?.username || "",
    });

    Object.keys(errors).forEach((key) => {
      errors[key as keyof StockOpnameFormErrors] = "";
    });

    detailItems.value = [];
  };

  onBeforeMount(async () => {
    onReset();

    if (
      !isSuperAdmin.value &&
      !(isEditMode.value || isViewMode.value || isCopyMode.value)
    ) {
      try {
        const selectRespo = localStorage.getItem("SelectRespo");
        if (selectRespo) {
          const parsed = JSON.parse(selectRespo);
          if (parsed.companyId) {
            values.m_unit_bisnis_id = parsed.companyId;
          }
        }
      } catch (e) {
        // ignore parse error
      }
    }

    const isCopyModeLocal = route.query.action === "copy" && route.query.source;
    const sourceId = isCopyModeLocal
      ? String(route.query.source)
      : menuId.value;

    if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
      return;
    }

    loading.value = true;
    try {
      const res = await getStockOpnameById(sourceId);

      if (res.status !== "success") throw new Error("Gagal memuat data");
      initialValues = res.data;
      auditMeta.value = {
        created_by: initialValues.created_by,
        createdAt: initialValues.createdAt,
        updated_by: initialValues.update_by || initialValues.updated_by,
        updatedAt: initialValues.updatedAt,
      };

      if (initialValues.t_stock_opname_ds) {
        detailItems.value = initialValues.t_stock_opname_ds.map((d: any) => {
          const row = {
            ...d,
            batch: d.batch || "",
            is_batch: Boolean(d.item_opname?.is_batch || d.m_item?.is_batch),
            kode_item: d.item_opname?.kode_item || d.m_item?.kode_item || "-",
            nama_item: d.item_opname?.nama_item || d.m_item?.nama_item || "-",
            uom:
              d.item_opname?.m_general?.value1 ||
              d.item_opname?.uom?.value1 ||
              d.item_opname?.mi_uom?.value1 ||
              d.m_item?.m_general?.value1 ||
              d.m_item?.uom?.value1 ||
              "-",
            stock_gudang_id: d.stock_gudang_id || d.item_gudang?.id || null,
            m_rak_d_id:
              d.m_rak_d_id ||
              d.rak_d_opname?.id ||
              d.stock_gudang?.m_rak_d_id ||
              null,
            kode_rak_d:
              d.rak_d_opname?.kode ||
              d.m_rak_d?.kode ||
              d.stock_gudang?.m_rak_d?.kode ||
              "-",
          };

          if (!row.batch && row.stock_gudang_id) {
            fetch(`${API_BASE_URL}/fn/stock_gudang/getBatchesByStockGudang?stock_gudang_id=${row.stock_gudang_id}`, {
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` }
            }).then(r => r.json()).then(res => {
              if (res.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
                const b = res.data[0];
                row.batch = typeof b === 'string' ? b : (b?.batch || '');
              }
            }).catch(() => {});
          }

          return row;
        });
      }

      if (isCopyModeLocal) {
        delete (initialValues as any).id;
        delete (initialValues as any).no_stock_opname;
        delete (initialValues as any).createdAt;
        delete (initialValues as any).updatedAt;

        initialValues.status = "LOCK";

        detailItems.value = detailItems.value.map((item: any) => {
          const { id, t_stock_opname_id, createdAt, updatedAt, ...rest } = item;
          return {
            ...rest,
            created_by: authStore.user?.id || "",
          };
        });
      }

      for (const key in initialValues) {
        if (Object.prototype.hasOwnProperty.call(values, key)) {
          (values as any)[key] = initialValues[key];
        }
      }

      values.tgl_opname = normalizeYmd(initialValues.tgl_opname);

      // Populate company name dari relasi unit bisnis yang sudah ada
      selectedCompanyName.value =
        initialValues.m_unit_bisnis?.m_company?.nama ||
        initialValues.m_unit_bisnis?.m_company?.nama_company ||
        initialValues.m_unit_bisnis?.company?.nama ||
        "";

      if (values.m_gudang_id) {
        await fetchRackOptionsByGudang(values.m_gudang_id);
      }

      if (isCopyModeLocal) {
        toast.success("Data berhasil disalin", {
          description: "Silakan edit dan simpan sebagai Stock Opname baru",
        });
      } else {
        toast.success("Data berhasil dimuat");
      }
    } catch (error) {
      toast.error("Gagal memuat data Stock Opname", {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
        action: {
          label: "Kembali",
          onClick: () => router.push("/inventory/transaksi/t_stock_opname"),
        },
      });
      setTimeout(() => router.push("/inventory/transaksi/t_stock_opname"), 2000);
    } finally {
      loading.value = false;
    }
  });

  const proceedWithSave = async () => {
    loading.value = true;
    try {
      const payload: any = {
        m_unit_bisnis_id: values.m_unit_bisnis_id || null,
        m_gudang_id: values.m_gudang_id || null,
        m_rak_id: values.m_rak_id || null,
        t_stock_opname_periode_id: values.t_stock_opname_periode_id || null,
        status: isSuperAdmin.value ? "APPROVED" : values.status || "LOCK",
        status_checking: isSuperAdmin.value
          ? detailItems.value.every(
              (d: any) =>
                (Number(d.qty_opname) || 0) === (Number(d.qty_system) || 0),
            )
            ? "SELESAI"
            : "PROSES"
          : "PROSES",
        tgl_opname: normalizeYmd(values.tgl_opname) || null,
        catatan: values.catatan || null,
        pic_opname_id: values.pic_opname_id || null,
        no_stock_opname: values.no_stock_opname || null,
        created_by: values.created_by || null,
        t_stock_opname_ds: detailItems.value.map((item: any) => ({
          ...(item.id && { id: item.id }),
          m_items_id: item.m_items_id,
          stock_gudang_id: item.stock_gudang_id || null,
          batch: item.batch || null,
          m_rak_d_id: item.m_rak_d_id || null,
          qty_system: Number(item.qty_system) || 0,
          qty_opname: Number(item.qty_opname) || 0,
          qty_selisih:
            (Number(item.qty_opname) || 0) - (Number(item.qty_system) || 0),
          is_checking:
            (Number(item.qty_opname) || 0) !== (Number(item.qty_system) || 0),
          catatan: item.catatan || null,
          ...(isEditMode.value
            ? { updated_by: authStore.user?.id || "" }
            : { created_by: authStore.user?.id || "" }),
        })),
      };

      let savedId: string | undefined;

      if (isEditMode.value) {
        payload.updated_by = authStore.user?.id || "";
        await updateStockOpname(menuId.value, payload as any);
        savedId = menuId.value;
        toast.success("Stock Opname berhasil diperbarui", {
          description: `Data Stock Opname telah diperbarui${isSuperAdmin.value ? " dengan status APPROVED" : ""}`,
        });
      } else {
        payload.created_by = authStore.user?.id || "";
        const res = await createStockOpname(payload as any);
        savedId = (res as any)?.data?.id;
        toast.success("Stock Opname berhasil dibuat", {
          description: `Data Stock Opname baru telah ditambahkan${isSuperAdmin.value ? " dengan status APPROVED" : ""}`,
        });
      }

      if (isSuperAdmin.value && savedId) {
        try {
          const allApprovals = authStore
            .getApprovalList()
            .filter((a: any) => a.path === "/inventory/transaksi/t_stock_opname");
          const maxLevel =
            allApprovals.length > 0
              ? Math.max(...allApprovals.map((a: any) => a.level ?? 0))
              : 1;
          await approveStockOpname(
            savedId,
            null,
            maxLevel,
            "Auto approved by Super Admin",
          );
        } catch (approvalErr) {
          console.warn("Failed to call approve endpoint:", approvalErr);
        }
      }

      router.replace("/inventory/transaksi/t_stock_opname?reload=" + Date.now());
    } catch (error) {
      toast.error(
        isEditMode.value
          ? "Gagal memperbarui Stock Opname"
          : "Gagal membuat Stock Opname",
        {
          description:
            error instanceof Error ? error.message : "Terjadi kesalahan",
        },
      );
    } finally {
      loading.value = false;
    }
  };

  const onSave = async () => {
    Object.keys(errors).forEach((key) => {
      errors[key as keyof StockOpnameFormErrors] = "";
    });
    let invalid = false;

    if (!values.m_gudang_id) {
      errors.m_gudang_id = "Gudang wajib diisi";
      invalid = true;
    }
    if (!values.m_unit_bisnis_id) {
      errors.m_unit_bisnis_id = "Unit Bisnis wajib diisi";
      invalid = true;
    }
    if (!normalizeYmd(values.tgl_opname)) {
      errors.tgl_opname = "Tanggal stock opname wajib diisi";
      invalid = true;
    } else {
      values.tgl_opname = normalizeYmd(values.tgl_opname);
    }
    if (!values.pic_opname_id) {
      errors.pic_opname_id = "PIC wajib diisi";
      invalid = true;
    }
    if (!values.m_rak_id) {
      errors.m_rak_id = "Rak wajib dipilih";
      invalid = true;
    }
    if (!values.t_stock_opname_periode_id) {
      errors.t_stock_opname_periode_id = "Periode Stock Opname wajib dipilih";
      invalid = true;
    }

    if (detailItems.value.length === 0) {
      toast.error("Validasi gagal", {
        description: "Minimal harus ada 1 item detail",
      });
      return;
    }

    const negativeOpname = detailItems.value.find(
      (d: any) => Number(d.qty_opname) < 0,
    );
    if (negativeOpname) {
      toast.error("Validasi gagal", {
        description: `Qty Opname tidak boleh minus (item ${negativeOpname.kode_item || negativeOpname.nama_item || "-"})`,
      });
      return;
    }

    if (invalid) {
      toast.error("Validasi gagal", {
        description: "Mohon lengkapi semua field yang wajib diisi",
      });
      return;
    }

    if (isSuperAdmin.value) {
      isSuperAdminDialogOpen.value = true;
      return;
    }

    await proceedWithSave();
  };

  const confirmSuperAdminSave = async () => {
    isSuperAdminDialogOpen.value = false;
    await proceedWithSave();
  };

  const cancelSuperAdminSave = () => {
    isSuperAdminDialogOpen.value = false;
  };

  const handleCancel = () => {
    router.push("/inventory/transaksi/t_stock_opname");
  };

  return {
    authStore,
    API_BASE_URL,
    loading,
    isEditMode,
    isViewMode,
    isCopyMode,
    isReadOnly,
    isSuperAdmin,
    companyNameDisplay,
    pageTitle,
    pageDescription,
    values,
    auditMeta,
    errors,
    detailItems,
    isSuperAdminDialogOpen,
    selectedItemIds,
    rackOptions,
    selectedCompanyName,
    onUnitBisnisSelected,
    getRakLabelById,
    fetchRackOptionsByGudang,
    removeDetailItem,
    onSave,
    confirmSuperAdminSave,
    cancelSuperAdminSave,
    handleCancel,
  };
}