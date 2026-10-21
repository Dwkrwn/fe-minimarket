import { ref, reactive, onBeforeMount, computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createPenerimaanGudang,
  updatePenerimaanGudang,
  getPenerimaanGudangById,
} from "./service";

export function usePenerimaanGudangForm() {
  const authStore = useAuthStore();
  const { API_BASE_URL } = useApi();
  const router = useRouter();
  const route = useRoute();

  const loading = ref(false);
  const isEditMode = computed(
    () => !!route.params.id && route.name === "PenerimaanGudangForm",
  );
  const isViewMode = computed(() => route.name === "PenerimaanGudangView");
  const isCopyMode = computed(
    () => route.query.action === "copy" && !!route.query.source,
  );
  const isReadOnly = computed(
    () => isViewMode.value || route.meta.readOnly === true,
  );
  const menuId = computed(() => route.params.id as string);

  const isSuperAdmin = computed(() => {
    const user = authStore.user;
    if (!user || !user.tipe) return false;
    return user.tipe.value1?.toUpperCase() === "SUPER ADMIN";
  });

  const selectedUnitBisnis = ref<any | null>(null);

  const fallbackUnitBisnisNameDisplay = computed(() => {
    if (!isSuperAdmin.value) {
      try {
        const selectRespo = localStorage.getItem("SelectRespo");
        if (selectRespo) {
          const parsed = JSON.parse(selectRespo);
          return parsed.companyName || parsed.nama_comp || "-";
        }
      } catch (e) {
        console.error("Failed to parse SelectRespo:", e);
      }
    }
    return "-";
  });

  const unitBisnisNameDisplay = computed(() => {
    return (
      selectedUnitBisnis.value?.nama_comp ||
      selectedUnitBisnis.value?.nama_unit_bisnis ||
      selectedUnitBisnis.value?.nama ||
      fallbackUnitBisnisNameDisplay.value ||
      "-"
    );
  });

  const selectedCompanyNameDisplay = computed(() => {
    return (
      selectedUnitBisnis.value?.m_company?.nama ||
      selectedUnitBisnis.value?.company?.nama ||
      selectedUnitBisnis.value?.company_name ||
      "-"
    );
  });

  const pageTitle = computed(() => {
    if (isViewMode.value) return "Detail Penerimaan Gudang";
    if (isCopyMode.value) return "Salin Penerimaan Gudang";
    if (isEditMode.value) return "Edit Penerimaan Gudang";
    return "Tambah Penerimaan Gudang Baru";
  });

  const pageDescription = computed(() => {
    if (isViewMode.value) return "Lihat detail data Penerimaan Gudang";
    if (isCopyMode.value)
      return "Buat Penerimaan Gudang baru dari data yang disalin";
    if (isEditMode.value) return "Perbarui data Penerimaan Gudang";
    return "Buat Penerimaan Gudang baru";
  });

  const values = reactive({
    no_penerimaan_gudang: "",
    m_unit_bisnis_id: "",
    status: "DRAFT",
    tgl_penerimaan_gudang: new Date().toISOString().split("T")[0],
    pic_penerima_id: "",
    pic_penerima_name: "",
    catatan: "",
    t_sj_gudang_id: "",
    sj_gudang_no: "",
    warehouse_asal_id: "",
    warehouse_asal_name: "",
    warehouse_terima_id: "",
    warehouse_terima_name: "",
    created_by: "",
  });

  let initialValues: Record<string, any> = {};
  const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});
  const detailArr = ref<any[]>([]);
  const fotoArr = ref<any[]>([]);

  const fetchUnitBisnisById = async (unitBisnisId: string) => {
    if (!unitBisnisId) return null;

    try {
      const response = await fetch(
        `${API_BASE_URL}/dynamic/m_unit_bisnis/${unitBisnisId}?join=true`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authStore.token}`,
          },
        },
      );
      const result = await response.json();
      return result.status === "success" ? result.data : null;
    } catch (error) {
      console.error("Failed to fetch unit bisnis detail:", error);
      return null;
    }
  };

  const handleUnitBisnisSelected = (unitBisnis: any | null) => {
    selectedUnitBisnis.value = unitBisnis || null;
    values.pic_penerima_id = "";
    values.pic_penerima_name = "";
    values.t_sj_gudang_id = "";
    values.sj_gudang_no = "";
    values.warehouse_asal_id = "";
    values.warehouse_asal_name = "";
    values.warehouse_terima_id = "";
    values.warehouse_terima_name = "";
    detailArr.value = [];
  };

  const errors = reactive({
    m_unit_bisnis_id: "",
    tgl_penerimaan_gudang: "",
    t_sj_gudang_id: "",
    pic_penerima_id: "",
  });

  const mapSjDetailToPenerimaanDetail = (detail: any) => {
    const itemRef =
      detail.m_item ||
      detail.t_transfer_gudang_d?.m_item ||
      detail.transfer_gudang_d?.m_item ||
      detail.t_transfer_gudang_d?.m_items ||
      {};

    const qtySj =
      Number(detail.qty_sj_gudang ?? detail.qty_sj ?? detail.qty ?? 0) || 0;

    return {
      t_sj_gudang_d_id: detail.id || detail.t_sj_gudang_d_id || "",
      m_items_id: detail.m_items_id || itemRef.id || null,
      m_rak_id: "",
      m_rak_d_id: "",
      batch: detail.batch || detail.t_transfer_gudang_d?.batch || "",
      is_batch: Boolean(itemRef.is_batch),
      qty_diterima: qtySj,
      catatan: detail.catatan || "",
      created_by: authStore.user?.id || "",
      kode_item: itemRef.kode_item || detail.kode_item || "-",
      nama_item: itemRef.nama_item || detail.nama_item || "-",
      batch_name: itemRef.m_group_batch?.nama_batch || detail.batch_name || "-",
      uom: itemRef.mi_uom?.value1 || itemRef.uom?.value1 || detail.uom || "-",
      qty_sj: qtySj,
    };
  };

  const fetchSjDetails = async (sjGudangId: string): Promise<any[]> => {
    const query = new URLSearchParams({
      no_pagination: "true",
      filter_column_t_sj_gudang_id: sjGudangId,
      include:
        "m_item,m_item>m_group_batch,m_item>mi_uom,t_transfer_gudang_d,t_transfer_gudang_d>m_item,t_transfer_gudang_d>m_item>m_group_batch,t_transfer_gudang_d>m_item>mi_uom",
    });

    const response = await fetch(
      `${API_BASE_URL}/dynamic/t_sj_gudang_d?${query.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error("Gagal memuat detail Surat Jalan");
    }

    const result = await response.json();
    if (result?.status === "success" && Array.isArray(result?.data)) {
      return result.data;
    }

    return [];
  };

  const handleSjGudangSelect = async (item: any) => {
    if (item) {
      values.t_sj_gudang_id = item.id || values.t_sj_gudang_id;
      values.sj_gudang_no = item.no_sj_gudang || "";
      values.warehouse_asal_id = item.warehouse_asal_id || "";
      values.warehouse_asal_name =
        item.sj_gd_asl?.nama_gudang || item.warehouse_asal?.nama_gudang || "-";
      values.warehouse_terima_id = item.warehouse_terima_id || "";
      values.warehouse_terima_name =
        item.sj_gd_trm?.nama_gudang ||
        item.warehouse_tujuan?.nama_gudang ||
        "-";

      detailArr.value = [];

      try {
        const selectedDetails = Array.isArray(item.t_sj_gudang_ds)
          ? item.t_sj_gudang_ds
          : Array.isArray(item.t_sj_gudang_d)
            ? item.t_sj_gudang_d
            : [];

        const detailsSource =
          selectedDetails.length > 0
            ? selectedDetails
            : await fetchSjDetails(item.id || values.t_sj_gudang_id);

        detailArr.value = detailsSource.map(mapSjDetailToPenerimaanDetail);

        if (detailArr.value.length > 0) {
          toast.success(
            `${detailArr.value.length} item otomatis dimuat dari Surat Jalan Gudang`,
          );
        } else {
          toast.warning("Surat Jalan Gudang ini tidak memiliki detail item");
        }
      } catch (error) {
        toast.error("Gagal memuat detail Surat Jalan Gudang", {
          description:
            error instanceof Error ? error.message : "Terjadi kesalahan",
        });
      }
    } else {
      values.t_sj_gudang_id = "";
      values.sj_gudang_no = "";
      values.warehouse_asal_id = "";
      values.warehouse_asal_name = "";
      values.warehouse_terima_id = "";
      values.warehouse_terima_name = "";
      detailArr.value = [];
    }
  };

  const removeDetailArr = (index: number) => {
    detailArr.value.splice(index, 1);
    toast.info("Detail dihapus");
  };

  const onReset = () => {
    Object.assign(values, {
      no_penerimaan_gudang: "",
      m_unit_bisnis_id: "",
      status: "DRAFT",
      tgl_penerimaan_gudang: new Date().toISOString().split("T")[0],
      pic_penerima_id: "",
      pic_penerima_name: "",
      catatan: "",
      t_sj_gudang_id: "",
      sj_gudang_no: "",
      warehouse_asal_id: "",
      warehouse_asal_name: "",
      warehouse_terima_id: "",
      warehouse_terima_name: "",
      created_by: authStore.user?.id || "",
    });

    Object.keys(errors).forEach((key) => {
      errors[key as keyof typeof errors] = "";
    });

    detailArr.value = [];
    fotoArr.value = [];
    selectedUnitBisnis.value = null;
  };

  watch(
    () => values.m_unit_bisnis_id,
    async (unitBisnisId) => {
      if (!unitBisnisId) {
        selectedUnitBisnis.value = null;
        return;
      }

      const selectedId = String(selectedUnitBisnis.value?.id || "");
      if (
        selectedId === String(unitBisnisId) &&
        selectedUnitBisnis.value?.m_company
      ) {
        return;
      }

      selectedUnitBisnis.value = await fetchUnitBisnisById(unitBisnisId);
    },
  );

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
      } catch {
        // ignore parse error
      }
    }

    // Handle pre-fill dari history pengiriman (query param t_sj_gudang_id)
    const prefilledSjId = route.query.t_sj_gudang_id as string;
    if (prefilledSjId && !isEditMode.value && !isViewMode.value && !isCopyMode.value) {
      values.t_sj_gudang_id = prefilledSjId;
      // Fetch SJ details untuk pre-fill
      try {
        const sjResponse = await fetch(
          `${API_BASE_URL}/fn/t_sj_gudang/getSjAvailable?filter_column_id=${prefilledSjId}&no_pagination=true`,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authStore.token}`,
            },
          }
        );
        const sjResult = await sjResponse.json();
        if (sjResult?.status === 'success' && sjResult?.data?.length > 0) {
          await handleSjGudangSelect(sjResult.data[0]);
        }
      } catch {
        // Ignore prefill error — user can select manually
      }
    }

    const isCopyModeLocal =
      route.query.action === "copy" && !!route.query.source;
    const sourceId = isCopyModeLocal
      ? String(route.query.source)
      : menuId.value;

    if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
      return;
    }

    loading.value = true;
    try {
      const res = await getPenerimaanGudangById(sourceId);

      if (res.status !== "success") throw new Error("Gagal memuat data");
      initialValues = res.data;
      auditMeta.value = {
        created_by: initialValues.created_by || initialValues.createdBy || null,
        createdAt: initialValues.createdAt || null,
        updated_by: initialValues.updated_by || initialValues.update_by || initialValues.edited_by || null,
        updatedAt: initialValues.updatedAt || null,
      };

      if (initialValues.t_penerimaan_gudang_ds) {
        detailArr.value = initialValues.t_penerimaan_gudang_ds.map(
          (item: any) => ({
            id: item.id,
            t_sj_gudang_d_id: item.t_sj_gudang_d_id,
            m_items_id: item.m_items_id || item.m_item?.id || null,
            m_rak_id: item.m_rak_id || "",
            m_rak_d_id: item.m_rak_d_id || "",
            qty_diterima: item.qty_diterima || 0,
            catatan: item.catatan || "",
            kode_item: item.m_item?.kode_item || "",
            nama_item: item.m_item?.nama_item || "",
            batch: item.batch || "",
            is_batch: Boolean(item.m_item?.is_batch),
            batch_name: item.m_item?.m_group_batch?.nama_batch || "-",
            uom: item.m_item?.mi_uom?.value1 || "",
            qty_sj: item.detail_sj?.qty_sj_gudang || 0,
          }),
        );
      }

      if (initialValues.t_penerimaan_gudang_foto) {
        fotoArr.value = initialValues.t_penerimaan_gudang_foto.map(
          (item: any) => ({
            gambar: item.foto_bukti_terima,
            lampiran: item.foto_bukti_terima,
          }),
        );
      }

      if (isCopyModeLocal) {
        delete (initialValues as any).id;
        delete (initialValues as any).no_penerimaan_gudang;
        delete (initialValues as any).createdAt;
        delete (initialValues as any).updatedAt;
        initialValues.status = "DRAFT";

        detailArr.value = detailArr.value.map((item: any) => ({
          t_sj_gudang_d_id: item.t_sj_gudang_d_id,
          m_items_id: item.m_items_id || null,
          m_rak_id: item.m_rak_id || "",
          m_rak_d_id: item.m_rak_d_id || "",
          qty_diterima: item.qty_diterima || 0,
          catatan: item.catatan || "",
          kode_item: item.kode_item,
          nama_item: item.nama_item,
          batch_name: item.batch_name,
          uom: item.uom,
          qty_sj: item.qty_sj,
          created_by: authStore.user?.id || "",
        }));
      }

      for (const key in initialValues) {
        if (Object.prototype.hasOwnProperty.call(values, key)) {
          (values as any)[key] = initialValues[key];
        }
      }

      selectedUnitBisnis.value =
        initialValues.m_unit_bisnis ||
        initialValues.m_unit_bisni ||
        initialValues.unit_bisnis ||
        selectedUnitBisnis.value;

      if (initialValues.surat_jalan_gudang) {
        values.sj_gudang_no =
          initialValues.surat_jalan_gudang.no_sj_gudang || "";
      }
      if (initialValues.pic_penerima_gudang) {
        values.pic_penerima_name =
          initialValues.pic_penerima_gudang.nama_kary || "";
      }
      if (initialValues.pen_gd_asl) {
        values.warehouse_asal_name = initialValues.pen_gd_asl.nama_gudang || "";
      }
      if (initialValues.pen_gd_trm) {
        values.warehouse_terima_name =
          initialValues.pen_gd_trm.nama_gudang || "";
      }

      if (isCopyModeLocal) {
        toast.success("Data berhasil disalin", {
          description: "Silakan edit dan simpan sebagai Penerimaan Gudang baru",
        });
      } else {
        toast.success("Data berhasil dimuat");
      }
    } catch (error) {
      toast.error("Gagal memuat data Penerimaan Gudang", {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
        action: {
          label: "Kembali",
          onClick: () => router.push("/inventory/transaksi/t_penerimaan_gudang"),
        },
      });
      setTimeout(() => router.push("/inventory/transaksi/t_penerimaan_gudang"), 2000);
    } finally {
      loading.value = false;
    }
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
    if (!values.tgl_penerimaan_gudang) {
      errors.tgl_penerimaan_gudang = "Tanggal wajib diisi";
      invalid = true;
    }
    if (!values.t_sj_gudang_id) {
      errors.t_sj_gudang_id = "Surat Jalan Gudang wajib dipilih";
      invalid = true;
    }
    if (!values.pic_penerima_id) {
      errors.pic_penerima_id = "PIC Penerima wajib dipilih";
      invalid = true;
    }

    if (invalid) {
      toast.error("Validasi gagal", {
        description: "Mohon lengkapi semua field yang wajib diisi",
      });
      return;
    }

    if (detailArr.value.length === 0) {
      toast.error("Validasi gagal", {
        description: "Minimal harus ada 1 item detail",
      });
      return;
    }

    for (let i = 0; i < detailArr.value.length; i++) {
      const item = detailArr.value[i];
      if ((item.qty_diterima || 0) > 0 && !item.m_rak_id) {
        toast.error("Validasi gagal", {
          description: `Rak pada item ${i + 1} wajib dipilih`,
        });
        return;
      }
      if ((item.qty_diterima || 0) > 0 && !item.m_rak_d_id) {
        toast.error("Validasi gagal", {
          description: `Rak detail pada item ${i + 1} wajib dipilih`,
        });
        return;
      }
    }

    // Validasi qty_diterima tidak boleh negatif atau melebihi qty_sj
    for (let i = 0; i < detailArr.value.length; i++) {
      const item = detailArr.value[i];
      const qtyDiterima = Number(item.qty_diterima || 0);
      const qtySj = Number(item.qty_sj || 0);

      if (qtyDiterima < 0) {
        toast.error("Validasi gagal", {
          description: `Qty diterima tidak boleh bernilai negatif pada item ${item.nama_item || (i + 1)}`,
        });
        return;
      }

      if (qtyDiterima > qtySj) {
        toast.error("Validasi gagal", {
          description: `Qty diterima tidak boleh melebihi qty SJ untuk item ${item.nama_item || (i + 1)}`,
        });
        return;
      }
    }

    // Hitung has_selisih: true jika ada item dengan qty_diterima < qty_sj
    const hasSelisih = detailArr.value.some(
      (item: any) => Number(item.qty_diterima || 0) < Number(item.qty_sj || 0)
    );

    loading.value = true;
    try {
      const detailItems = detailArr.value.map((item: any) => ({
        id: item.id,
        t_sj_gudang_d_id: item.t_sj_gudang_d_id,
        m_items_id: item.m_items_id || null,
        m_rak_id: item.m_rak_id || null,
        m_rak_d_id: item.rak_d_id || item.m_rak_d_id || null,
        batch: item.batch || null,
        qty_diterima: item.qty_diterima || 0,
        qty_sisa: (item.qty_sj || 0) - (item.qty_diterima || 0),
        catatan: item.catatan || "",
      }));

      const fotoItems = fotoArr.value.map((item: any) => ({
        foto_bukti_terima: item.gambar || item.lampiran || "",
      }));

      const payload: any = {
        m_unit_bisnis_id: values.m_unit_bisnis_id || null,
        status: values.status || "DRAFT",
        tgl_penerimaan_gudang: values.tgl_penerimaan_gudang || null,
        pic_penerima_id: values.pic_penerima_id || null,
        catatan: values.catatan?.trim() || null,
        t_sj_gudang_id: values.t_sj_gudang_id || null,
        warehouse_asal_id: values.warehouse_asal_id || null,
        warehouse_terima_id: values.warehouse_terima_id || null,
        has_selisih: hasSelisih,
        t_penerimaan_gudang_d: detailItems,
        t_penerimaan_gudang_foto: fotoItems,
      };

      if (isEditMode.value) {
        payload.updated_by = authStore.user?.id || null;
        await updatePenerimaanGudang(menuId.value, payload as any);
        toast.success("Penerimaan Gudang berhasil diperbarui", {
          description: "Data telah diperbarui",
        });
      } else {
        payload.created_by = authStore.user?.id || null;
        payload.updated_by = authStore.user?.id || null;
        await createPenerimaanGudang(payload as any);
        toast.success("Penerimaan Gudang berhasil dibuat", {
          description: "Data baru telah ditambahkan",
        });
      }

      router.replace("/inventory/transaksi/t_penerimaan_gudang?reload=" + Date.now());
    } catch (error) {
      toast.error(
        isEditMode.value
          ? "Gagal memperbarui Penerimaan Gudang"
          : "Gagal membuat Penerimaan Gudang",
        {
          description:
            error instanceof Error ? error.message : "Terjadi kesalahan",
        },
      );
    } finally {
      loading.value = false;
    }
  };

  const handleCancel = () => {
    router.push("/inventory/transaksi/t_penerimaan_gudang");
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
    unitBisnisNameDisplay,
    selectedCompanyNameDisplay,
    pageTitle,
    pageDescription,
    values,
    auditMeta,
    detailArr,
    fotoArr,
    errors,
    handleUnitBisnisSelected,
    handleSjGudangSelect,
    removeDetailArr,
    onSave,
    handleCancel,
  };
}
