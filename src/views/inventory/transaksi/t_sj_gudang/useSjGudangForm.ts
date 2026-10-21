import { ref, reactive, onBeforeMount, computed, watch, watchEffect } from "vue";
import { useRouter, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import { createSjGudang, updateSjGudang, getSjGudangById } from "./service";

export function useSjGudangForm() {
  const authStore = useAuthStore();
  const { API_BASE_URL } = useApi();
  const router = useRouter();
  const route = useRoute();

  const loading = ref(false);
  const isEditMode = computed(
    () => !!route.params.id && route.name === "SjGudangForm",
  );
  const isViewMode = computed(() => route.name === "SjGudangView");
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
    if (isViewMode.value) return "Detail Surat Jalan Gudang";
    if (isCopyMode.value) return "Salin Surat Jalan Gudang";
    if (isEditMode.value) return "Edit Surat Jalan Gudang";
    return "Tambah Surat Jalan Gudang Baru";
  });

  const pageDescription = computed(() => {
    if (isViewMode.value) return "Lihat detail data Surat Jalan Gudang";
    if (isCopyMode.value)
      return "Buat Surat Jalan Gudang baru dari data yang disalin";
    if (isEditMode.value) return "Perbarui data Surat Jalan Gudang";
    return "Buat Surat Jalan Gudang baru";
  });

  const values = reactive({
    no_sj_gudang: "",
    m_unit_bisnis_id: "",
    status: "DRAFT",
    status_pengiriman_name: "",
    tipe_sj_gudang: "TRANSFER GUDANG",
    tgl_sj_gudang: new Date().toISOString().split("T")[0],
    total_berat: 0,
    t_transfer_gudang_id: "",
    warehouse_asal_id: "",
    warehouse_asal_name: "",
    warehouse_terima_id: "",
    warehouse_terima_name: "",
    m_pic_id: "",
    pic_name: "",
    is_ekspedisi: false,
    supir: "",
    m_kendaraan_id: "",
    kendaraan_no_polisi: "",
    ekpedisi_id: "",
    no_resi: "",
    bukti_foto: "",
    catatan: "",
    created_by: "",
  });

  const photoUrl = computed(() => {
    if (!values.bukti_foto) return "";

    if (
      values.bukti_foto.startsWith("blob:") ||
      values.bukti_foto.startsWith("data:")
    ) {
      return values.bukti_foto;
    }

    if (
      values.bukti_foto.startsWith("http://") ||
      values.bukti_foto.startsWith("https://")
    ) {
      return values.bukti_foto;
    }

    let baseUrl = API_BASE_URL.endsWith("/")
      ? API_BASE_URL.slice(0, -1)
      : API_BASE_URL;
    baseUrl = baseUrl.replace(/\/api$/, "");

    const photoPath = values.bukti_foto.startsWith("/")
      ? values.bukti_foto
      : `/${values.bukti_foto}`;
    return `${baseUrl}${photoPath}`;
  });

  const tipeSjGudangOptions = [
    { value: "TRANSFER GUDANG", label: "Transfer Gudang" },
    { value: "PACKING LIST", label: "Packing List" },
  ];

  const pengirimanOptions = [
    { value: "false", label: "Dikirim Sendiri" },
    { value: "true", label: "Ekspedisi" },
  ];

  const isEkspedisiValue = computed({
    get: () => String(values.is_ekspedisi),
    set: (val: string) => {
      values.is_ekspedisi = val === "true";
      if (val === "true") {
        values.supir = "";
        values.m_kendaraan_id = "";
        values.kendaraan_no_polisi = "";
      } else {
        values.ekpedisi_id = "";
        values.no_resi = "";
      }
    },
  });

  let initialValues: Record<string, any> = {};
  const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});
  const detailArr = ref<any[]>([]);

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
    values.t_transfer_gudang_id = "";
    values.warehouse_asal_id = "";
    values.warehouse_asal_name = "";
    values.warehouse_terima_id = "";
    values.warehouse_terima_name = "";
    values.m_pic_id = "";
    values.pic_name = "";
    detailArr.value = [];
  };

  const round2 = (value: number) => Number(Number(value || 0).toFixed(2));
  const numberOrFallback = (...values: any[]) => {
    const value = values.find(
      (item) => item !== undefined && item !== null && item !== "",
    );
    return Number(value) || 0;
  };

  watch(
    () => detailArr.value,
    (newDetails) => {
      if (loading.value || isReadOnly.value) return;

      newDetails.forEach((detail: any) => {
        const qtySj = Number(detail.qty_sj_gudang) || 0;
        const qtyTg = Number(detail.qty_tg) || 0;
        const berat = Number(detail.berat) || 0;
        const beratAktual = Number(detail.berat_aktual) || 0;

        if (qtyTg > 0 && qtySj > qtyTg) {
          detail.qty_sj_gudang = qtyTg;
          toast.warning("Qty SJ disesuaikan", {
            description: `Qty SJ untuk ${detail.nama_item || "item"} tidak boleh lebih dari ${qtyTg}`,
          });
        }

        if (qtySj < 0) {
          detail.qty_sj_gudang = 0;
        }

        if (berat < 0) {
          detail.berat = 0;
        }

        if (beratAktual < 0) {
          detail.berat_aktual = 0;
        }
      });
    },
    { deep: true },
  );

  watchEffect(() => {
    values.total_berat = round2(
      detailArr.value.reduce(
        (sum, detail) => sum + (Number(detail.berat_aktual) || 0),
        0,
      ),
    );
  });

  const handleTransferGudangSelect = (item: any) => {
    if (item) {
      values.t_transfer_gudang_id = item.id || values.t_transfer_gudang_id;

      values.warehouse_asal_id = item.warehouse_asal_id || "";
      values.warehouse_asal_name =
        item.warehouse_asal?.nama_gudang || item.warehouse_asal_name || "-";

      values.warehouse_terima_id = item.warehouse_tujuan_id || "";
      values.warehouse_terima_name =
        item.warehouse_tujuan?.nama_gudang || item.warehouse_tujuan_name || "-";

      values.m_pic_id = item.pic_id || "";
      values.pic_name = item.m_kary?.nama_kary || item.pic_name || "-";

      const transferDetails = Array.isArray(item.t_transfer_gudang_details)
        ? item.t_transfer_gudang_details
        : Array.isArray(item.t_transfer_gudang_ds)
          ? item.t_transfer_gudang_ds
          : Array.isArray(item.t_transfer_gudang_d)
            ? item.t_transfer_gudang_d
            : [];

      detailArr.value = transferDetails.map((detail: any) => {
        const qtyTw = Number(detail.qty) || 0;
        return {
          t_transfer_gudang_d_id: detail.id,
          m_items_id: detail.m_items_id || detail.m_item?.id,
          qty_sj_gudang: qtyTw,
          berat: round2(
            numberOrFallback(detail.berat, detail.m_item?.berat_bersih),
          ),
          berat_aktual: round2(
            numberOrFallback(detail.berat, detail.m_item?.berat_bersih),
          ),
          catatan: detail.catatan || "",
          created_by: authStore.user?.id || "",
          kode_item: detail.m_item?.kode_item || "-",
          nama_item: detail.m_item?.nama_item || "-",
          batch: detail.batch || "",
          is_batch: Boolean(detail.m_item?.is_batch),
          no_packing: detail.no_packing || detail.batch_name || "-",
          uom:
            detail.m_item?.uom?.value1 || detail.m_item?.mi_uom?.value1 || "-",
          qty_tg: qtyTw,
          rak_id:
            detail.rak_id ||
            detail.rak_asal_id ||
            detail.m_rak_id ||
            detail.m_rak_d?.m_rak_id ||
            "",
          rak_d_id:
            detail.rak_d_id || detail.rak_asal_d_id || detail.m_rak_d_id || "",
          rak_asal_id:
            detail.rak_asal_id ||
            detail.m_rak_id ||
            detail.m_rak_d?.m_rak_id ||
            "",
          rak_asal_d_id: detail.rak_asal_d_id || detail.m_rak_d_id || "",
          kode_rak_asal:
            detail.m_rak?.kode_rak ||
            detail.rak_asal?.kode_rak ||
            detail.m_rak_d?.m_rak?.kode_rak ||
            "-",
          kode_rak_d_asal:
            detail.m_rak_d?.kode ||
            detail.rak_asal_d?.kode ||
            detail.kode_rak_d ||
            "-",
        };
      });

      if (detailArr.value.length > 0) {
        toast.success(
          `${detailArr.value.length} item berhasil ditambahkan dari Transfer Gudang`,
        );
      } else {
        toast.warning("Transfer Gudang ini tidak memiliki item detail");
      }
    } else {
      values.t_transfer_gudang_id = "";
      values.warehouse_asal_id = "";
      values.warehouse_asal_name = "";
      values.warehouse_terima_id = "";
      values.warehouse_terima_name = "";
      values.m_pic_id = "";
      values.pic_name = "";
      detailArr.value = [];
    }
  };

  const removeDetailArr = (index: number) => {
    detailArr.value.splice(index, 1);
    toast.info("Detail dihapus");
  };

  const onReset = () => {
    Object.assign(values, {
      no_sj_gudang: "",
      m_unit_bisnis_id: "",
      status: "DRAFT",
      status_pengiriman_name: "",
      tipe_sj_gudang: "TRANSFER GUDANG",
      tgl_sj_gudang: new Date().toISOString().split("T")[0],
      total_berat: 0,
      t_transfer_gudang_id: "",
      warehouse_asal_id: "",
      warehouse_asal_name: "",
      warehouse_terima_id: "",
      warehouse_terima_name: "",
      is_ekspedisi: false,
      supir: "",
      m_kendaraan_id: "",
      kendaraan_no_polisi: "",
      ekpedisi_id: "",
      no_resi: "",
      bukti_foto: "",
      catatan: "",
      created_by: authStore.user?.id || "",
    });

    Object.keys(errors).forEach((key) => {
      errors[key as keyof typeof errors] = "";
    });

    detailArr.value = [];
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

    const isCopyModeLocal = route.query.action === "copy" && route.query.source;
    const sourceId = isCopyModeLocal
      ? String(route.query.source)
      : menuId.value;

    if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
      return;
    }

    loading.value = true;
    try {
      const res = await getSjGudangById(sourceId);

      if (res.status !== "success") throw new Error("Gagal memuat data");
      initialValues = res.data;
      auditMeta.value = {
        created_by: initialValues.created_by,
        createdAt: initialValues.createdAt,
        updated_by: initialValues.update_by || initialValues.updated_by,
        updatedAt: initialValues.updatedAt,
      };

      if (isEditMode.value && initialValues.status?.toUpperCase() === "POST") {
        toast.error("Data sudah di-POST", {
          description:
            "Data yang sudah POST tidak bisa diedit, dialihkan ke mode view",
        });
        router.replace(`/inventory/transaksi/t_sj_gudang/view/${menuId.value}`);
        return;
      }

      if (initialValues.t_sj_gudang_ds) {
        detailArr.value = initialValues.t_sj_gudang_ds.map((item: any) => {
          const transferDetail =
            item.transfer_gudang_d || item.t_transfer_gudang_d || {};
          const itemRef =
            transferDetail.m_item ||
            transferDetail.m_items ||
            item.m_item ||
            item.m_items ||
            {};
          const rakRef =
            transferDetail.m_rak ||
            transferDetail.rak_asal ||
            item.rak_sj ||
            {};
          const rakDRef =
            transferDetail.m_rak_d ||
            transferDetail.rak_asal_d ||
            item.rak_sj_d ||
            {};

          const qtySj = Number(item.qty_sj_gudang) || 0;
          const qtyTg = Number(transferDetail.qty ?? item.qty_tg ?? qtySj) || 0;

          return {
            id: item.id,
            t_transfer_gudang_d_id:
              item.t_transfer_gudang_d_id || transferDetail.id || "",
            m_items_id:
              item.m_items_id ||
              transferDetail.m_items_id ||
              itemRef.id ||
              null,
            qty_sj_gudang: qtySj,
            berat: round2(
              Number(item.berat) ||
                Number(transferDetail.berat) ||
                Number(itemRef.berat_bersih) ||
                0,
            ),
            berat_aktual: round2(
              numberOrFallback(
                item.berat_aktual,
                item.berat,
                transferDetail.berat,
                itemRef.berat_bersih,
              ),
            ),
            catatan: item.catatan || "",
            kode_item: item.kode_item || itemRef.kode_item || "-",
            nama_item: item.nama_item || itemRef.nama_item || "-",
            batch: item.batch || transferDetail.batch || "",
            is_batch: Boolean(itemRef.is_batch),
            no_packing:
              item.no_packing ||
              transferDetail.no_packing ||
              item.batch_name ||
              "-",
            uom:
              item.uom ||
              itemRef.uom?.value1 ||
              itemRef.mi_uom?.value1 ||
              itemRef.m_general?.value1 ||
              "-",
            qty_tg: qtyTg,
            rak_id:
              item.rak_id ||
              transferDetail.rak_asal_id ||
              transferDetail.m_rak_id ||
              rakDRef.m_rak_id ||
              rakRef.id ||
              "",
            rak_d_id:
              item.rak_d_id ||
              transferDetail.rak_asal_d_id ||
              transferDetail.m_rak_d_id ||
              rakDRef.id ||
              "",
            rak_asal_id:
              item.rak_asal_id ||
              transferDetail.rak_asal_id ||
              transferDetail.m_rak_id ||
              rakDRef.m_rak_id ||
              rakRef.id ||
              "",
            rak_asal_d_id:
              item.rak_asal_d_id ||
              transferDetail.rak_asal_d_id ||
              transferDetail.m_rak_d_id ||
              rakDRef.id ||
              "",
            kode_rak_asal:
              item.kode_rak_asal ||
              transferDetail.kode_rak ||
              transferDetail.m_rak?.kode_rak ||
              transferDetail.rak_asal?.kode_rak ||
              rakRef.kode_rak ||
              "-",
            kode_rak_d_asal:
              item.kode_rak_d_asal ||
              transferDetail.kode_rak_d ||
              transferDetail.m_rak_d?.kode ||
              transferDetail.rak_asal_d?.kode ||
              rakDRef.kode ||
              "-",
          };
        });
      }

      if (isCopyModeLocal) {
        delete (initialValues as any).id;
        delete (initialValues as any).no_sj_gudang;
        delete (initialValues as any).createdAt;
        delete (initialValues as any).updatedAt;
        initialValues.status = "DRAFT";

        detailArr.value = detailArr.value.map((item: any) => ({
          t_transfer_gudang_d_id: item.t_transfer_gudang_d_id,
          m_items_id: item.m_items_id || null,
          qty_sj_gudang: item.qty_sj_gudang || 0,
          berat: round2(Number(item.berat) || 0),
          berat_aktual: round2(
            numberOrFallback(item.berat_aktual, item.berat),
          ),
          catatan: item.catatan || "",
          kode_item: item.kode_item,
          nama_item: item.nama_item,
          batch_name: item.batch_name,
          uom: item.uom,
          qty_tg: item.qty_tg,
          rak_id: item.rak_id || item.rak_asal_id || "",
          rak_d_id: item.rak_d_id || item.rak_asal_d_id || "",
          rak_asal_id: item.rak_asal_id || "",
          rak_asal_d_id: item.rak_asal_d_id || "",
          kode_rak_asal: item.kode_rak_asal || "-",
          kode_rak_d_asal: item.kode_rak_d_asal || "-",
          created_by: authStore.user?.id || "",
        }));
      }

      for (const key in initialValues) {
        if (Object.prototype.hasOwnProperty.call(values, key)) {
          // @ts-ignore dynamic assign
          values[key] = initialValues[key];
        }
      }

      selectedUnitBisnis.value =
        initialValues.m_unit_bisnis ||
        initialValues.m_unit_bisni ||
        initialValues.as_unit ||
        initialValues.unit_bisnis ||
        selectedUnitBisnis.value;

      values.status_pengiriman_name =
        initialValues.status_pengiriman?.value1 || "";

      values.warehouse_asal_id =
        values.warehouse_asal_id ||
        initialValues.sj_gd_asl?.id ||
        initialValues.warehouse_asal?.id ||
        initialValues.no_tg?.warehouse_asal_id ||
        initialValues.no_tg?.warehouse_asal?.id ||
        initialValues.t_transfer_gudang?.warehouse_asal_id ||
        initialValues.t_transfer_gudang?.warehouse_asal?.id ||
        "";

      values.warehouse_terima_id =
        values.warehouse_terima_id ||
        initialValues.sj_gd_trm?.id ||
        initialValues.warehouse_tujuan?.id ||
        initialValues.no_tg?.warehouse_tujuan?.id ||
        initialValues.t_transfer_gudang?.warehouse_tujuan_id ||
        initialValues.t_transfer_gudang?.warehouse_tujuan?.id ||
        "";

      values.warehouse_asal_name =
        values.warehouse_asal_name ||
        initialValues.sj_gd_asl?.nama_gudang ||
        initialValues.warehouse_asal?.nama_gudang ||
        initialValues.no_tg?.warehouse_asal?.nama_gudang ||
        initialValues.t_transfer_gudang?.warehouse_asal?.nama_gudang ||
        "";

      values.warehouse_terima_name =
        values.warehouse_terima_name ||
        initialValues.sj_gd_trm?.nama_gudang ||
        initialValues.warehouse_tujuan?.nama_gudang ||
        initialValues.no_tg?.warehouse_tujuan?.nama_gudang ||
        initialValues.t_transfer_gudang?.warehouse_tujuan?.nama_gudang ||
        "";

      if (initialValues.kendaraan_sj_gudang?.no_polisi) {
        values.kendaraan_no_polisi =
          initialValues.kendaraan_sj_gudang.no_polisi;
      }

      if (isCopyModeLocal) {
        toast.success("Data berhasil disalin", {
          description:
            "Silakan edit dan simpan sebagai Surat Jalan Gudang baru",
        });
      } else {
        toast.success("Data berhasil dimuat");
      }
    } catch (error) {
      toast.error("Gagal memuat data Surat Jalan Gudang", {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
        action: {
          label: "Kembali",
          onClick: () => router.push("/inventory/transaksi/t_sj_gudang"),
        },
      });
      setTimeout(() => router.push("/inventory/transaksi/t_sj_gudang"), 2000);
    } finally {
      loading.value = false;
    }
  });

  const errors = reactive({
    m_unit_bisnis_id: "",
    tipe_sj_gudang: "",
    tgl_sj_gudang: "",
    t_transfer_gudang_id: "",
    supir: "",
    m_kendaraan_id: "",
    ekspedisi_id: "",
    bukti_foto: "",
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
    if (!values.tipe_sj_gudang) {
      errors.tipe_sj_gudang = "Tipe Surat Jalan wajib dipilih";
      invalid = true;
    }
    if (!values.tgl_sj_gudang) {
      errors.tgl_sj_gudang = "Tanggal wajib diisi";
      invalid = true;
    }

    if (
      values.tipe_sj_gudang === "TRANSFER GUDANG" &&
      !values.t_transfer_gudang_id
    ) {
      errors.t_transfer_gudang_id = "No. Transfer Gudang wajib dipilih";
      invalid = true;
    }

    if (!values.is_ekspedisi) {
      if (!values.supir?.trim()) {
        errors.supir = "Nama Supir wajib diisi";
        invalid = true;
      }
      if (!values.m_kendaraan_id) {
        errors.m_kendaraan_id = "Kendaraan wajib dipilih";
        invalid = true;
      }
    } else {
      if (!values.ekpedisi_id) {
        errors.ekspedisi_id = "Ekspedisi wajib dipilih";
        invalid = true;
      }
      if (!values.bukti_foto?.trim()) {
        errors.bukti_foto = "Foto bukti wajib diupload untuk ekspedisi";
        invalid = true;
      }
    }

    if (invalid) {
      toast.error("Validasi gagal", {
        description: "Mohon lengkapi semua field yang wajib diisi",
      });
      return;
    }

    if (detailArr.value.length > 0) {
      for (let i = 0; i < detailArr.value.length; i++) {
        const detail = detailArr.value[i];
        const qtySj = Number(detail.qty_sj_gudang) || 0;
        const qtyTg = Number(detail.qty_tg) || 0;

        if (qtySj <= 0) {
          toast.error("Validasi Detail Gagal", {
            description: `Item baris ${i + 1}: Qty SJ harus lebih dari 0`,
          });
          return;
        }

        if (qtySj > qtyTg) {
          toast.error("Validasi Detail Gagal", {
            description: `Item baris ${i + 1}: Qty SJ (${qtySj}) tidak boleh lebih besar dari Qty TG (${qtyTg})`,
          });
          return;
        }
      }
    }

    loading.value = true;
    try {
      const detailItems = detailArr.value.map((item: any) => {
        const detailPayload: any = {
          id: item.id,
          t_transfer_gudang_d_id: item.t_transfer_gudang_d_id,
          m_items_id: item.m_items_id || null,
          rak_id: item.rak_id || item.rak_asal_id || null,
          rak_d_id: item.rak_d_id || item.rak_asal_d_id || null,
          batch: item.batch || null,
          qty_sj_gudang: item.qty_sj_gudang || 0,
          berat: Number(item.berat) || 0,
          berat_aktual: Number(item.berat_aktual) || 0,
          catatan: item.catatan || "",
        };

        if (isEditMode.value) {
          detailPayload.updated_by = authStore.user?.id || "";
        } else {
          detailPayload.created_by = authStore.user?.id || "";
        }

        return detailPayload;
      });

      const payload: any = {
        m_unit_bisnis_id: values.m_unit_bisnis_id || null,
        status: values.status || "DRAFT",
        tipe_sj_gudang: values.tipe_sj_gudang || null,
        tgl_sj_gudang: values.tgl_sj_gudang || null,
        total_berat: values.total_berat || 0,
        t_transfer_gudang_id: values.t_transfer_gudang_id || null,
        warehouse_asal_id: values.warehouse_asal_id || null,
        warehouse_terima_id: values.warehouse_terima_id || null,
        is_ekspedisi: values.is_ekspedisi,
        supir: values.supir?.trim() || null,
        m_kendaraan_id: values.m_kendaraan_id || null,
        ekpedisi_id: values.ekpedisi_id || null,
        no_resi: values.no_resi?.trim() || null,
        bukti_foto: values.bukti_foto || null,
        catatan: values.catatan?.trim() || null,
        t_sj_gudang_ds: detailItems,
      };

      if (isEditMode.value) {
        payload.updated_by = authStore.user?.id || "";
        await updateSjGudang(menuId.value, payload as any);
        toast.success("Surat Jalan Gudang berhasil diperbarui", {
          description: "Data telah diperbarui",
        });
      } else {
        payload.created_by = authStore.user?.id || "";
        await createSjGudang(payload as any);
        toast.success("Surat Jalan Gudang berhasil dibuat", {
          description: "Data baru telah ditambahkan",
        });
      }
      router.replace("/inventory/transaksi/t_sj_gudang?reload=" + Date.now());
    } catch (error) {
      toast.error(
        isEditMode.value
          ? "Gagal memperbarui Surat Jalan Gudang"
          : "Gagal membuat Surat Jalan Gudang",
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
    router.push("/inventory/transaksi/t_sj_gudang");
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
    photoUrl,
    tipeSjGudangOptions,
    pengirimanOptions,
    isEkspedisiValue,
    detailArr,
    errors,
    handleUnitBisnisSelected,
    handleTransferGudangSelect,
    removeDetailArr,
    onSave,
    handleCancel,
  };
}
