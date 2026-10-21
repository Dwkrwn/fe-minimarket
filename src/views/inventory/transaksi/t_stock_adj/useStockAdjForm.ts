import { ref, reactive, onBeforeMount, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createStockAdj,
  updateStockAdj,
  getStockAdjById,
  approveStockAdj,
} from "./service";

export function useStockAdjForm() {
  const authStore = useAuthStore();
  const { API_BASE_URL } = useApi();
  const router = useRouter();
  const route = useRoute();

  const loading = ref(false);
  const isEditMode = computed(
    () => !!route.params.id && route.name === "StockAdjForm",
  );
  const isViewMode = computed(() => route.name === "StockAdjView");
  const isCopyMode = computed(
    () => route.query.action === "copy" && !!route.query.source,
  );
  const isReadOnly = computed(
    () => isViewMode.value || route.meta.readOnly === true,
  );
  const menuId = computed(() => route.params.id as string);

  const isSuperAdmin = computed(() => authStore.isSuperAdmin);

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
    if (isViewMode.value) return "Detail Stock Adjustment";
    if (isCopyMode.value) return "Salin Stock Adjustment";
    if (isEditMode.value) return "Edit Stock Adjustment";
    return "Tambah Stock Adjustment Baru";
  });

  const pageDescription = computed(() => {
    if (isViewMode.value) return "Lihat detail data Stock Adj";
    if (isCopyMode.value) return "Buat Stock Adj baru dari data yang disalin";
    if (isEditMode.value) return "Perbarui data Stock Adj";
    return "Buat Stock Adj baru";
  });

  let values = reactive({
    m_unit_bisnis_id: "",
    no_stock_adj: "",
    status: "DRAFT",
    tgl_adj: new Date().toISOString().split("T")[0],
    m_gudang_id: "",
    m_rak_id: "",
    pic_adj_id: "",
    tipe_referensi: "",
    stock_opname_id: "",
    no_stock_opname_ref: "",
    catatan: "",
    created_by: authStore.user?.id || "",
  });

  const isOpnameReference = computed(() => values.tipe_referensi === "OPNAME");
  const isOpnameUpdateLocked = computed(
    () => isEditMode.value && isOpnameReference.value,
  );
  const isFormReadOnly = computed(
    () => isReadOnly.value || isOpnameUpdateLocked.value,
  );

  let initialValues: Record<string, any> = {};
  const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

  const detailItems = ref<any[]>([]);

  const isSuperAdminDialogOpen = ref(false);

  const selectedItemIds = computed(() => {
    if (values.tipe_referensi === "ADJUSTMENT") {
      return detailItems.value
        .map((item: any) => item.stock_gudang_id)
        .filter(Boolean);
    }
    return detailItems.value
      .map((item: any) => item.m_items_id)
      .filter(Boolean);
  });

  const rackOptions = ref<{ id: string; label: string }[]>([]);
  const selectedCompanyName = ref<string>("");
  const resolvedPicName = ref<string>("");
  const resolvedGudangName = ref<string>("");

  const onUnitBisnisSelected = (selectedData: any) => {
    if (!selectedData) {
      selectedCompanyName.value = "";
      return;
    }
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

  const referensiOptions = [
    { id: "OPNAME", label: "Stok Opname" },
    { id: "ADJUSTMENT", label: "Adjustment" },
  ];

  const removeDetailItem = (index: number) => {
    detailItems.value.splice(index, 1);
    toast.info("Item detail dihapus");
  };

  const mapOpnameDetailToAdjItem = (item: any) => ({
    m_items_id: item.m_items_id,
    t_stock_opname_d_id: item.id || "",
    stock_gudang_id: item.stock_gudang_id || item.stock_gudang?.id || "",
    m_rak_d_id: item.m_rak_d_id || item.rak_d_opname?.id || null,
    kode_rak_d: item.rak_d_opname?.kode || item.m_rak_d?.kode || "-",
    batch: item.batch || item.stock_gudang?.batch || "",
    is_batch: Boolean(item.item_opname?.is_batch || item.m_items?.is_batch),
    qty_before: item.qty_system || 0,
    qty_after: item.qty_opname || 0,
    qty_adj: (item.qty_opname || 0) - (item.qty_system || 0),
    alasan_opname: item.catatan || "",
    catatan_adj: "",
    created_by: authStore.user?.id || "",
    kode_item: item.item_opname?.kode_item || item.m_items?.kode_item || "-",
    nama_item: item.item_opname?.nama_item || item.m_items?.nama_item || "-",
    uom:
      item.item_opname?.m_general?.value1 ||
      item.item_opname?.mi_uom?.value1 ||
      item.m_items?.m_general?.value1 ||
      "-",
  });

  const loadOpnameDetailItems = (opnameDetails?: any[]) => {
    if (!Array.isArray(opnameDetails)) {
      detailItems.value = [];
      return;
    }

    detailItems.value = opnameDetails.map(mapOpnameDetailToAdjItem);

    if (opnameDetails.length > 0) {
      toast.success(
        `${opnameDetails.length} item otomatis dimuat dari Stock Opname`,
      );
    } else {
      toast.info(
        "Stock Opname terpilih tidak memiliki item selisih untuk adjustment",
      );
    }
  };

  const clearRackOptions = () => {
    rackOptions.value = [];
  };

  const clearDetailItems = () => {
    detailItems.value = [];
  };

  const handleCompanyChange = () => {
    values.m_gudang_id = "";
    values.m_rak_id = "";
    values.pic_adj_id = "";
    values.tipe_referensi = "";
    values.stock_opname_id = "";
    values.no_stock_opname_ref = "";
    clearRackOptions();
    clearDetailItems();
  };

  const handleReferensiChange = (_v: string) => {
    values.m_gudang_id = "";
    values.m_rak_id = "";
    clearRackOptions();
    values.stock_opname_id = "";
    values.no_stock_opname_ref = "";
    clearDetailItems();
  };

  const handleStockOpnameValueFull = async (v: any) => {
    values.stock_opname_id = v?.id || "";
    values.no_stock_opname_ref = v?.no_stock_opname || "";
    errors.stock_opname_id = "";

    if (v?.m_gudang_id) {
      values.m_gudang_id = v.m_gudang_id;
      await fetchRackOptionsByGudang(v.m_gudang_id);
    } else {
      values.m_gudang_id = "";
      clearRackOptions();
    }

    if (v?.m_rak_id) {
      values.m_rak_id = v.m_rak_id;
      if (!rackOptions.value.find((r) => r.id === v.m_rak_id)) {
        const namaRak = v?.rak_opname?.nama_rak || "";
        rackOptions.value = [
          ...rackOptions.value,
          {
            id: v.m_rak_id,
            label: namaRak || "Rak tidak diketahui",
          },
        ];
      }
    } else {
      values.m_rak_id = "";
    }

    loadOpnameDetailItems(v?.t_stock_opname_ds);
  };

  const handleGudangChange = (newGudangId: string) => {
    values.m_rak_id = "";
    clearDetailItems();
    fetchRackOptionsByGudang(newGudangId ?? "");
  };

  const handleRakChange = () => {
    clearDetailItems();
  };

  const onReset = () => {
    Object.assign(values, {
      m_unit_bisnis_id: "",
      no_stock_adj: "",
      status: "DRAFT",
      tgl_adj: new Date().toISOString().split("T")[0],
      m_gudang_id: "",
      m_rak_id: "",
      pic_adj_id: "",
      tipe_referensi: "",
      stock_opname_id: "",
      no_stock_opname_ref: "",
      catatan: "",
      created_by: authStore.user?.id || "",
    });

    Object.keys(errors).forEach((key) => {
      errors[key as keyof typeof errors] = "";
    });

    detailItems.value = [];
    selectedCompanyName.value = "";
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
      const res = await getStockAdjById(sourceId);

      if (res.status !== "success") throw new Error("Gagal memuat data");
      initialValues = res.data;
      auditMeta.value = {
        created_by: initialValues.created_by,
        createdAt: initialValues.createdAt,
        updated_by: initialValues.update_by || initialValues.updated_by,
        updatedAt: initialValues.updatedAt,
      };

      const details =
        initialValues.t_stock_adj_ds || initialValues.t_stock_adj_details || [];

      if (details.length > 0) {
        detailItems.value = details.map((d: any) => {
          return {
            ...d,
            kode_item:
              d.m_items?.kode_item ||
              d.m_item?.kode_item ||
              d.item_adj?.kode_item ||
              "-",
            nama_item:
              d.m_items?.nama_item ||
              d.m_item?.nama_item ||
              d.item_adj?.nama_item ||
              "-",
            uom:
              d.m_items?.uom?.value1 ||
              d.m_items?.m_general?.value1 ||
              d.m_item?.uom?.value1 ||
              d.m_item?.m_general?.value1 ||
              d.item_adj?.uom?.value1 ||
              d.item_adj?.m_general?.value1 ||
              d.item_adj?.mi_uom?.value1 ||
              "-",
            t_stock_opname_d_id: d.t_stock_opname_d_id || "",
            stock_gudang_id: d.stock_gudang_id || "",
            m_rak_d_id: d.m_rak_d_id || d.rak_d_adj?.id || null,
            kode_rak_d: d.rak_d_adj?.kode || d.m_rak_d?.kode || "-",
            batch: d.batch || d.stopnamed_adj?.batch || d.t_stock_opname_d?.batch || "",
            is_batch: Boolean(
              d.m_items?.is_batch ||
                d.m_item?.is_batch ||
                d.item_adj?.is_batch,
            ),
            qty_before: d.qty_before || 0,
            qty_after: d.qty_after || 0,
            qty_adj: d.qty_adj || 0,
            alasan_opname: d.alasan_opname || "",
            catatan_adj: d.catatan_adj || "",
          };
        });
      }

      if (isCopyModeLocal) {
        delete (initialValues as any).id;
        delete (initialValues as any).no_stock_adj;
        delete (initialValues as any).createdAt;
        delete (initialValues as any).updatedAt;

        initialValues.status = "DRAFT";

        detailItems.value = detailItems.value.map((item: any) => {
          const {
            id,
            t_stock_adj_id,
            t_stock_opname_d_id,
            createdAt,
            updatedAt,
            ...rest
          } = item;
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

      // Normalize date to YYYY-MM-DD (API may return full ISO datetime string)
      if (values.tgl_adj && values.tgl_adj.length > 10) {
        values.tgl_adj = values.tgl_adj.slice(0, 10);
      }

      // Populate company name — API returns alias m_unit_bisni (no trailing s)
      const unitBisnisRel = initialValues.m_unit_bisnis || initialValues.m_unit_bisni;
      selectedCompanyName.value =
        unitBisnisRel?.m_company?.nama ||
        unitBisnisRel?.m_company?.nama_company ||
        unitBisnisRel?.company?.nama ||
        "";

      // Populate PIC and Gudang display names from API aliases
      resolvedPicName.value = initialValues.pic_adj?.nama_kary || initialValues.m_kary?.nama_kary || "";
      resolvedGudangName.value = initialValues.gudang_adj?.nama_gudang || initialValues.m_gudang?.nama_gudang || "";

      if (values.m_gudang_id) {
        await fetchRackOptionsByGudang(values.m_gudang_id);
      }

      if (initialValues.stock_opname_id && initialValues.t_stock_opname) {
        values.no_stock_opname_ref =
          initialValues.t_stock_opname?.no_stock_opname || "";
      }

      if (
        values.tipe_referensi === "OPNAME" &&
        values.stock_opname_id &&
        detailItems.value.length === 0
      ) {
        loadOpnameDetailItems(initialValues?.t_stock_opname?.t_stock_opname_ds);
      }

      if (isCopyModeLocal) {
        toast.success("Data berhasil disalin", {
          description: "Silakan edit dan simpan sebagai Stock Adj baru",
        });
      } else {
        toast.success("Data berhasil dimuat");
      }
    } catch (error) {
      toast.error("Gagal memuat data Stock Adj", {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
        action: {
          label: "Kembali",
          onClick: () => router.push("/inventory/transaksi/t_stock_adj"),
        },
      });
      setTimeout(() => router.push("/inventory/transaksi/t_stock_adj"), 2000);
    } finally {
      loading.value = false;
    }
  });

  const errors = reactive({
    m_unit_bisnis_id: "",
    m_gudang_id: "",
    m_rak_id: "",
    tgl_adj: "",
    pic_adj_id: "",
    tipe_referensi: "",
    stock_opname_id: "",
  });

  const onSave = async () => {
    Object.keys(errors).forEach((key) => {
      errors[key as keyof typeof errors] = "";
    });
    let invalid = false;

    if (!values.m_unit_bisnis_id) {
      errors.m_unit_bisnis_id = "Unit Bisnis wajib diisi";
      invalid = true;
    }
    if (!values.tgl_adj) {
      errors.tgl_adj = "Tanggal wajib diisi";
      invalid = true;
    }
    if (!values.m_gudang_id) {
      errors.m_gudang_id = "Gudang wajib diisi";
      invalid = true;
    }
    if (!values.m_rak_id) {
      errors.m_rak_id = "Rak wajib dipilih";
      invalid = true;
    }
    if (!values.pic_adj_id) {
      errors.pic_adj_id = "PIC wajib diisi";
      invalid = true;
    }
    if (!values.tipe_referensi) {
      errors.tipe_referensi = "Referensi wajib dipilih";
      invalid = true;
    }
    if (values.tipe_referensi === "OPNAME" && !values.stock_opname_id) {
      errors.stock_opname_id = "No. Stok Opname wajib dipilih";
      invalid = true;
    }

    if (detailItems.value.length === 0) {
      toast.error("Validasi gagal", {
        description: "Minimal harus ada 1 item detail",
      });
      return;
    }

    for (let i = 0; i < detailItems.value.length; i++) {
      const item = detailItems.value[i];
      if (
        item.qty_adj === 0 ||
        item.qty_adj === undefined ||
        item.qty_adj === null
      ) {
        toast.error("Validasi gagal", {
          description: `Qty Adjustment pada item ${i + 1} tidak boleh 0 (qty after harus berbeda dari qty before)`,
        });
        return;
      }
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

  const proceedWithSave = async () => {
    loading.value = true;
    try {
      const payload: any = {
        m_unit_bisnis_id: values.m_unit_bisnis_id || null,
        m_gudang_id: values.m_gudang_id || null,
        m_rak_id: values.m_rak_id || null,
        pic_adj_id: values.pic_adj_id || null,
        tipe_referensi: values.tipe_referensi || null,
        stock_opname_id:
          values.tipe_referensi === "OPNAME"
            ? values.stock_opname_id || null
            : null,
        status: isSuperAdmin.value ? "APPROVED" : values.status || "DRAFT",
        tgl_adj: values.tgl_adj || null,
        catatan: values.catatan || null,
        t_stock_adj_ds: detailItems.value.map((item: any) => ({
          ...(item.id && { id: item.id }),
          m_items_id: item.m_items_id,
          m_rak_d_id: item.m_rak_d_id || null,
          ...(values.tipe_referensi === "OPNAME" && item.t_stock_opname_d_id
            ? { t_stock_opname_d_id: item.t_stock_opname_d_id }
            : {}),
          stock_gudang_id: item.stock_gudang_id || null,
          batch: item.batch || null,
          qty_before: Number(item.qty_before) || 0,
          qty_after: Number(item.qty_after) || 0,
          qty_adj: Number(item.qty_adj) || 0,
          alasan_opname: item.alasan_opname || null,
          catatan_adj: item.catatan_adj || null,
          ...(isEditMode.value
            ? { updated_by: authStore.user?.id || "" }
            : { created_by: authStore.user?.id || "" }),
        })),
      };

      let savedId: string | undefined;

      if (isEditMode.value) {
        payload.updated_by = authStore.user?.id || "";
        await updateStockAdj(menuId.value, payload as any);
        savedId = menuId.value;
        toast.success("Stock Adjustment berhasil diperbarui", {
          description: `Data Stock Adjustment telah diperbarui${isSuperAdmin.value ? " dengan status APPROVED" : ""}`,
        });
      } else {
        payload.created_by = authStore.user?.id || "";
        const res = await createStockAdj(payload as any);
        savedId = (res as any)?.data?.id;
        toast.success("Stock Adjustment berhasil dibuat", {
          description: `Data Stock Adjustment baru telah ditambahkan${isSuperAdmin.value ? " dengan status APPROVED" : ""}`,
        });
      }

      if (isSuperAdmin.value && savedId) {
        try {
          const allApprovals = authStore
            .getApprovalList()
            .filter((a: any) => a.path === "/inventory/transaksi/t_stock_adj");
          const maxLevel =
            allApprovals.length > 0
              ? Math.max(...allApprovals.map((a: any) => a.level ?? 0))
              : 1;
          await approveStockAdj(
            savedId,
            null,
            maxLevel,
            "Auto approved by Super Admin",
          );
        } catch (approvalErr) {
          console.warn("Failed to call approve endpoint:", approvalErr);
        }
      }

      router.replace("/inventory/transaksi/t_stock_adj?reload=" + Date.now());
    } catch (error) {
      toast.error(
        isEditMode.value
          ? "Gagal memperbarui Stock Adjustment"
          : "Gagal membuat Stock Adjustment",
        {
          description:
            error instanceof Error ? error.message : "Terjadi kesalahan",
        },
      );
    } finally {
      loading.value = false;
    }
  };

  const confirmSuperAdminSave = async () => {
    isSuperAdminDialogOpen.value = false;
    await proceedWithSave();
  };

  const cancelSuperAdminSave = () => {
    isSuperAdminDialogOpen.value = false;
  };

  const handleCancel = () => {
    router.push("/inventory/transaksi/t_stock_adj");
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
    isOpnameReference,
    isOpnameUpdateLocked,
    isFormReadOnly,
    detailItems,
    isSuperAdminDialogOpen,
    selectedItemIds,
    rackOptions,
    selectedCompanyName,
    resolvedPicName,
    resolvedGudangName,
    onUnitBisnisSelected,
    referensiOptions,
    errors,
    getRakLabelById,
    fetchRackOptionsByGudang,
    handleCompanyChange,
    handleReferensiChange,
    handleStockOpnameValueFull,
    handleGudangChange,
    handleRakChange,
    removeDetailItem,
    loadOpnameDetailItems,
    onSave,
    confirmSuperAdminSave,
    cancelSuperAdminSave,
    handleCancel,
  };
}