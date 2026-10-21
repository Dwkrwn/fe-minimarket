import { ref, reactive, onBeforeMount, computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createTransferGudang,
  updateTransferGudang,
  getTransferGudangById,
} from "./service";

export function useTransferGudangForm() {
  const authStore = useAuthStore();
  const { API_BASE_URL } = useApi();
  const router = useRouter();
  const route = useRoute();

  const loading = ref(false);
  const isEditMode = computed(
    () => !!route.params.id && route.name === "TransferGudangForm",
  );
  const isViewMode = computed(() => route.name === "TransferGudangView");
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
    if (isViewMode.value) return "Detail Transfer Gudang";
    if (isCopyMode.value) return "Salin Transfer Gudang";
    if (isEditMode.value) return "Edit Transfer Gudang";
    return "Tambah Transfer Gudang Baru";
  });

  const pageDescription = computed(() => {
    if (isViewMode.value) return "Lihat detail data Transfer Gudang";
    if (isCopyMode.value)
      return "Buat Transfer Gudang baru dari data yang disalin";
    if (isEditMode.value) return "Perbarui data Transfer Gudang";
    return "Buat Transfer Gudang baru";
  });

  let values = reactive({
    no_tw: "",
    type: "langsung",
    opname_id: "",
    m_unit_bisnis_id: "",
    warehouse_asal_id: "",
    rak_asal: "",
    warehouse_tujuan_id: "",
    status: "DRAFT",
    tgl_tw: new Date().toISOString().split("T")[0],
    catatan: "",
    pic_id: "",
    created_by: authStore.user?.id || "",
  });

  let initialValues: Record<string, any> = {};
  const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

  const detailItems = ref<any[]>([]);
  const warehouseAsalDisplay = ref("");
  const opnameRakDisplay = ref("");
  const opnameNoDisplay = ref("");

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
    values.pic_id = "";
    values.opname_id = "";
    values.warehouse_asal_id = "";
    values.rak_asal = "";
    values.warehouse_tujuan_id = "";
    detailItems.value = [];
    warehouseAsalDisplay.value = "";
    opnameRakDisplay.value = "";
    opnameNoDisplay.value = "";
  };

  const transferTypeOptions = [
    { label: "Langsung", value: "langsung" },
    { label: "Referensi Opname", value: "opname" },
  ];

  const isTypeLangsung = computed(() => values.type === "langsung");
  const isTypeOpname = computed(() => values.type === "opname");
  const isSameWarehouse = computed(() => {
    return (
      !!values.warehouse_asal_id &&
      !!values.warehouse_tujuan_id &&
      values.warehouse_asal_id === values.warehouse_tujuan_id
    );
  });

  const warehouseTujuanDisplay = computed(() => {
    if (!values.warehouse_asal_id) return "-";
    return warehouseAsalDisplay.value || "Sama dengan Gudang Asal";
  });

  const opnameRakDisplayValue = computed(() => {
    if (opnameRakDisplay.value) return opnameRakDisplay.value;

    const firstDetail = detailItems.value[0];
    const fallbackRackName =
      firstDetail?.nama_rak_master ||
      firstDetail?.rak_asal?.nama_rak ||
      firstDetail?.m_rak?.nama_rak ||
      "";

    return fallbackRackName || "-";
  });

  const selectedItemIds = computed(() => {
    return detailItems.value
      .map((item: any) => item.m_items_id)
      .filter(Boolean);
  });

  const toId = (value: any): string => {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "object" && !Array.isArray(value)) {
      return value.id ? String(value.id) : "";
    }
    return String(value);
  };

  const toEntity = (value: any): Record<string, any> | null => {
    if (!value || Array.isArray(value) || typeof value !== "object")
      return null;
    return value;
  };

  const getOpnameQtySystem = (detail: any): number => {
    return Number(detail?.qty_system) || 0;
  };

  const getOpnameQtyOpname = (detail: any): number => {
    return Number(detail?.qty_opname ?? detail?.qty) || 0;
  };

  const getOpnameQtySelisih = (detail: any): number => {
    const rawSelisih = Number(detail?.qty_selisih);
    if (!Number.isNaN(rawSelisih)) return rawSelisih;
    return getOpnameQtyOpname(detail) - getOpnameQtySystem(detail);
  };

  const getTransferQtyFromOpnameDetail = (detail: any): number => {
    return Math.abs(getOpnameQtySelisih(detail));
  };

  const removeDetailItem = (index: number) => {
    detailItems.value.splice(index, 1);
    toast.info("Item detail dihapus");
  };

  const getRakAsalName = (item: any) => {
    const sourceRakId =
      toId(item?.m_rak_id) ||
      toId(item?.rak_asal_id) ||
      toId(item?.rak_asal) ||
      toId(item?.m_rak) ||
      "";

    const rakAsalRel = toEntity(item?.rak_asal) || toEntity(item?.m_rak);
    const rakTujuanRel =
      toEntity(item?.rak_tujuan_rel) || toEntity(item?.rak_tujuan);

    if (item?.nama_rak_master) return item.nama_rak_master;
    if (item?.rak_opname?.nama_rak) return item.rak_opname.nama_rak;

    if (sourceRakId && toId(rakAsalRel) === sourceRakId) {
      return rakAsalRel?.nama_rak || "-";
    }

    if (sourceRakId && toId(rakTujuanRel) === sourceRakId) {
      return rakTujuanRel?.nama_rak || "-";
    }

    return rakAsalRel?.nama_rak || rakTujuanRel?.nama_rak || "-";
  };

  const getRakAsalDetail = (item: any) => {
    const sourceRakDetailId =
      toId(item?.m_rak_d_id) ||
      toId(item?.rak_asal_d_id) ||
      toId(item?.rak_asal_d) ||
      toId(item?.m_rak_d) ||
      "";

    const rakAsalDetailRel =
      toEntity(item?.rak_asal_d) || toEntity(item?.m_rak_d);
    const rakTujuanDetailRel = toEntity(item?.rak_tujuan_d);

    if (sourceRakDetailId && toId(rakAsalDetailRel) === sourceRakDetailId) {
      return rakAsalDetailRel?.kode || "-";
    }

    if (sourceRakDetailId && toId(rakTujuanDetailRel) === sourceRakDetailId) {
      return rakTujuanDetailRel?.kode || "-";
    }

    return (
      item?.kode_rak_d ||
      rakAsalDetailRel?.kode ||
      rakTujuanDetailRel?.kode ||
      item?.rak_d_opname?.kode ||
      item?.rak_opname?.kode_rak ||
      "-"
    );
  };

  const hydrateFreeStockForLoadedDetails = async () => {
    if (!values.warehouse_asal_id || detailItems.value.length === 0) return;

    const missingFreeStock = detailItems.value.some((item: any) => {
      const value = item?.free_stock;
      return value === null || value === undefined || value === "";
    });

    if (!missingFreeStock) return;

    try {
      const query = new URLSearchParams({
        gudang_id: values.warehouse_asal_id,
        filter_column_is_opname: "false",
        searchfield: "kode_item,nama_item,tipe_name,kode_rak_d",
        no_pagination: "true",
      });

      const response = await fetch(
        `${API_BASE_URL}/fn/stock_gudang/stock_item?${query.toString()}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authStore.token}`,
          },
        },
      );

      if (!response.ok) return;

      const payload = await response.json();
      const groupedData = Array.isArray(payload?.data) ? payload.data : [];

      const stockByItemAndRackDetail = new Map<string, number>();
      const stockByItemOnly = new Map<string, number>();

      groupedData.forEach((group: any) => {
        const groupItems = Array.isArray(group?.items) ? group.items : [];
        const groupRakDetailId = toId(group?.m_rak_d_id);

        groupItems.forEach((stockItem: any) => {
          const itemId = toId(stockItem?.m_items_id || stockItem?.m_item_id);
          const itemRakDetailId =
            toId(stockItem?.m_rak_d_id) || groupRakDetailId;
          const freeStock = Number(stockItem?.free_stock);

          if (!itemId || Number.isNaN(freeStock)) return;

          const itemOnlyStock = stockByItemOnly.get(itemId);
          if (itemOnlyStock === undefined || freeStock > itemOnlyStock) {
            stockByItemOnly.set(itemId, freeStock);
          }

          if (itemRakDetailId) {
            stockByItemAndRackDetail.set(
              `${itemId}::${itemRakDetailId}`,
              freeStock,
            );
          }
        });
      });

      detailItems.value = detailItems.value.map((detail: any) => {
        const currentFreeStock = detail?.free_stock;
        if (
          currentFreeStock !== null &&
          currentFreeStock !== undefined &&
          currentFreeStock !== ""
        ) {
          return detail;
        }

        const itemId = toId(detail?.m_items_id);
        const rakDetailId = toId(detail?.m_rak_d_id || detail?.rak_asal_d_id);

        if (!itemId) return detail;

        const stockFromRackDetail = rakDetailId
          ? stockByItemAndRackDetail.get(`${itemId}::${rakDetailId}`)
          : undefined;
        const stockFromItem = stockByItemOnly.get(itemId);
        const resolvedStock =
          stockFromRackDetail !== undefined
            ? stockFromRackDetail
            : stockFromItem;

        if (resolvedStock === undefined) return detail;

        return {
          ...detail,
          free_stock: resolvedStock,
        };
      });
    } catch {
      // Ignore hydration error; form remains usable without stock display enrichment.
    }
  };

  const handleStockOpnameSelect = async (
    item: any,
    opts?: { silent?: boolean; preserveExistingDetails?: boolean },
  ) => {
    if (!item) {
      values.opname_id = "";
      values.warehouse_asal_id = "";
      values.warehouse_tujuan_id = "";
      values.rak_asal = "";
      warehouseAsalDisplay.value = "";
      opnameRakDisplay.value = "";
      opnameNoDisplay.value = "";
      detailItems.value = [];
      return;
    }

    const preserveExistingDetails = !!opts?.preserveExistingDetails;
    const existingDetails = preserveExistingDetails
      ? [...detailItems.value]
      : [];

    values.opname_id = toId(item?.id) || values.opname_id;
    opnameNoDisplay.value = item?.no_stock_opname || opnameNoDisplay.value;

    const gudangId =
      item?.m_gudang_id || item?.gudang_opname?.id || item?.m_gudang?.id || "";
    const gudangName =
      item?.m_gudang?.nama_gudang || item?.gudang_opname?.nama_gudang || "";

    values.warehouse_asal_id = gudangId;
    values.warehouse_tujuan_id = gudangId;
    values.rak_asal = item?.m_rak_id || item?.rak_opname?.id || "";

    warehouseAsalDisplay.value = gudangName;
    opnameRakDisplay.value =
      item?.rak_opname?.nama_rak ||
      item?.rak_opname?.kode_rak ||
      item?.m_rak?.nama_rak ||
      item?.m_rak?.kode_rak ||
      "";

    const opnameDetails = Array.isArray(item.t_stock_opname_ds)
      ? item.t_stock_opname_ds
      : Array.isArray(item.t_stock_opname_d)
        ? item.t_stock_opname_d
        : [];

    const mappedOpnameDetails = opnameDetails
      .filter((detail: any) => getTransferQtyFromOpnameDetail(detail) > 0)
      .map((detail: any) => {
        const itemRef = detail?.item_opname || detail?.m_item || {};
        const rakAsalDetailRef = detail?.rak_d_opname || detail?.m_rak_d || {};
        const rakTujuanRef =
          detail?.rak_tujuan_opname ||
          detail?.rak_tujuan_rel ||
          detail?.m_rak ||
          {};
        const rawRakDetailList =
          rakTujuanRef?.m_rak_ds ||
          rakTujuanRef?.m_rak_d ||
          detail?.m_rak_ds ||
          detail?.m_rak_d ||
          [];
        const rakDetailList = Array.isArray(rawRakDetailList)
          ? rawRakDetailList
          : [];
        const firstRakDetail = rakDetailList[0] || null;

        const rakTujuanId =
          rakTujuanRef?.id || detail?.rak_tujuan || detail?.m_rak_id || "";
        const rakTujuanName =
          rakTujuanRef?.nama_rak || rakTujuanRef?.kode_rak || "-";
        const rakTujuanDetailId =
          detail?.rak_tujuan_d_id || firstRakDetail?.id || "";
        const rakTujuanDetailKode =
          detail?.rak_tujuan_d?.kode || firstRakDetail?.kode || "-";

        const qtySystem = getOpnameQtySystem(detail);
        const qtyOpname = getOpnameQtyOpname(detail);
        const qtySelisih = getOpnameQtySelisih(detail);
        const qtyTransfer = Math.abs(qtySelisih);

        return {
          m_items_id: detail.m_items_id,
          stock_opname_d_id:
            detail.stock_opname_d_id ||
            detail.t_stock_opname_d_id ||
            detail.id ||
            "",
          qty_system: qtySystem,
          qty_opname: qtyOpname,
          qty_selisih: qtySelisih,
          qty: qtyTransfer,
          m_rak_id:
            detail?.m_rak_id ||
            detail?.rak_d_opname?.m_rak_id ||
            detail?.m_rak_d?.m_rak_id ||
            item?.m_rak_id ||
            item?.rak_opname?.id ||
            item?.m_rak?.id ||
            "",
          m_rak_d_id:
            detail?.m_rak_d_id ||
            detail?.rak_d_opname?.id ||
            detail?.m_rak_d?.id ||
            "",
          rak_tujuan: rakTujuanId,
          rak_tujuan_d_id: rakTujuanDetailId,
          nama_rak_tujuan: rakTujuanName,
          kode_rak_tujuan_d: rakTujuanDetailKode,
          batch: detail.batch || "",
          is_batch: Boolean(itemRef?.is_batch),
          catatan: detail.catatan || "",
          created_by: authStore.user?.id || "",
          free_stock: qtyTransfer,
          kode_item: itemRef?.kode_item || "-",
          nama_item: itemRef?.nama_item || "-",
          uom: itemRef?.mi_uom?.value1 || "-",
          nama_rak_master:
            item?.rak_opname?.nama_rak || item?.m_rak?.nama_rak || "Tanpa Rak",
          kode_rak_d:
            rakAsalDetailRef?.kode ||
            item?.rak_opname?.kode_rak ||
            item?.m_rak?.kode_rak ||
            "Tanpa Rak",
        };
      });

    detailItems.value = mappedOpnameDetails;

    if (preserveExistingDetails && existingDetails.length > 0) {
      const mappedByOpnameDetailId = new Map<string, any>();
      mappedOpnameDetails.forEach((mappedDetail: any) => {
        const key = toId(mappedDetail?.stock_opname_d_id);
        if (key) mappedByOpnameDetailId.set(key, mappedDetail);
      });

      detailItems.value = existingDetails.map((existingDetail: any) => {
        const key = toId(
          existingDetail?.stock_opname_d_id ||
            existingDetail?.t_stock_opname_d_id,
        );
        const mappedDetail = key ? mappedByOpnameDetailId.get(key) : null;

        if (!mappedDetail) return existingDetail;

        return {
          ...existingDetail,
          stock_opname_d_id:
            existingDetail?.stock_opname_d_id || mappedDetail.stock_opname_d_id,
          qty_system: mappedDetail.qty_system,
          qty_opname: mappedDetail.qty_opname,
          qty_selisih: mappedDetail.qty_selisih,
          qty: mappedDetail.qty,
          free_stock: mappedDetail.free_stock,
        };
      });
    }

    if (opts?.silent) {
      return;
    }

    if (detailItems.value.length > 0) {
      toast.success(
        `${detailItems.value.length} item berhasil ditambahkan dari Stock Opname`,
      );
    } else {
      toast.warning(
        "Stock Opname yang dipilih tidak memiliki detail qty opname > 0",
      );
    }
  };

  const handleWarehouseAsalSelect = (warehouse: any) => {
    warehouseAsalDisplay.value = warehouse?.nama_gudang || "";
  };

  const getRakTujuanApiConfig = (detail: any): any => ({
    url: `${API_BASE_URL}/dynamic/m_rak`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authStore.token}`,
    },
    params: {
      no_pagination: "true",
      selectfield:
        "id,nama_rak,kode_rak,m_gudang_id,m_unit_bisnis_id,is_rak_opname",
      searchfield: "nama_rak,kode_rak,m_rak_ds.kode",
      join: "true",
      sub: "true",
      filter_column_is_active: "true",
      ...(isTypeOpname.value ? { filter_column_is_rak_opname: "true" } : {}),
      filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
      filter_column_m_gudang_id: isTypeOpname.value
        ? values.warehouse_asal_id
        : values.warehouse_tujuan_id,
    },
    onsuccess: (response: any) => {
      const sourceRakId = detail.m_rak_id || detail.rak_asal_id || "";
      const rackRows = Array.isArray(response?.data) ? response.data : [];

      response.data = sourceRakId
        ? rackRows.filter((rack: any) => rack?.id !== sourceRakId)
        : rackRows;

      return response;
    },
  });

  const getRakTujuanDetailApiConfig = (detail: any): any => ({
    url: `${API_BASE_URL}/dynamic/m_rak_d`,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authStore.token}`,
    },
    params: {
      no_pagination: "true",
      selectfield: "id,kode,baris,kolom,m_rak_id",
      filter_column_m_rak_id: detail.rak_tujuan,
    },
    onsuccess: (response: any) => {
      const sourceRakDetailId = detail.m_rak_d_id || detail.rak_asal_d_id || "";
      const rackDetailRows = Array.isArray(response?.data) ? response.data : [];

      response.data = sourceRakDetailId
        ? rackDetailRows.filter(
            (rackDetail: any) => rackDetail?.id !== sourceRakDetailId,
          )
        : rackDetailRows;

      return response;
    },
  });

  const errors = reactive({
    type: "",
    opname_id: "",
    m_unit_bisnis_id: "",
    warehouse_asal_id: "",
    warehouse_tujuan_id: "",
    tgl_tw: "",
    pic_id: "",
  });

  const resetOnTransferTypeChange = () => {
    const preservedNo = values.no_tw;
    const preservedDate = values.tgl_tw;
    const preservedPic = values.pic_id;
    const preservedUnitBisnis = values.m_unit_bisnis_id;
    const preservedStatus = values.status;

    Object.assign(values, {
      no_tw: preservedNo,
      type: values.type,
      opname_id: "",
      m_unit_bisnis_id: preservedUnitBisnis,
      warehouse_asal_id: "",
      rak_asal: "",
      warehouse_tujuan_id: "",
      status: preservedStatus || "DRAFT",
      tgl_tw: preservedDate,
      catatan: "",
      pic_id: preservedPic,
      created_by: authStore.user?.id || "",
    });

    Object.keys(errors).forEach((key) => {
      errors[key as keyof typeof errors] = "";
    });

    detailItems.value = [];
    warehouseAsalDisplay.value = "";
    opnameRakDisplay.value = "";
  };

  const onReset = () => {
    Object.assign(values, {
      no_tw: "",
      type: "langsung",
      opname_id: "",
      m_unit_bisnis_id: "",
      warehouse_asal_id: "",
      rak_asal: "",
      warehouse_tujuan_id: "",
      status: "DRAFT",
      tgl_tw: new Date().toISOString().split("T")[0],
      catatan: "",
      pic_id: "",
      created_by: authStore.user?.id || "",
    });

    Object.keys(errors).forEach((key) => {
      errors[key as keyof typeof errors] = "";
    });

    detailItems.value = [];
    warehouseAsalDisplay.value = "";
    opnameRakDisplay.value = "";
    opnameNoDisplay.value = "";
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
      const res = await getTransferGudangById(sourceId);

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
        router.replace(`/inventory/transaksi/t_transfer_gudang/view/${menuId.value}`);
        return;
      }

      const transferDetails = Array.isArray(initialValues.t_transfer_gudang_ds)
        ? initialValues.t_transfer_gudang_ds
        : Array.isArray(initialValues.t_transfer_gudang_d)
          ? initialValues.t_transfer_gudang_d
          : [];

      if (transferDetails.length > 0) {
        detailItems.value = transferDetails.map((d: any) => {
          const rakAsalRel = toEntity(d.rak_asal) || toEntity(d.m_rak);
          const rakTujuanRel =
            toEntity(d.rak_tujuan_rel) || toEntity(d.rak_tujuan);
          const rakAsalDetailRel =
            toEntity(d.rak_asal_d) || toEntity(d.m_rak_d);
          const rakTujuanDetailRel = toEntity(d.rak_tujuan_d);

          const sourceRakId =
            toId(d.rak_asal_id) ||
            toId(d.m_rak_id) ||
            toId(rakAsalRel) ||
            (toId(rakTujuanRel) && toId(rakTujuanRel) !== toId(d.rak_tujuan_id)
              ? toId(rakTujuanRel)
              : "") ||
            "";

          const targetRakRelId = toId(d.rak_tujuan) || toId(rakTujuanRel);

          const targetRakId =
            toId(d.rak_tujuan_id) ||
            (targetRakRelId && targetRakRelId !== sourceRakId
              ? targetRakRelId
              : "") ||
            (toId(rakAsalRel) && toId(rakAsalRel) !== sourceRakId
              ? toId(rakAsalRel)
              : "") ||
            "";

          const sourceRakDetailId =
            toId(d.rak_asal_d_id) ||
            toId(d.m_rak_d_id) ||
            toId(rakAsalDetailRel) ||
            "";

          const targetRakDetailRelId =
            toId(d.rak_tujuan_d) || toId(rakTujuanDetailRel);

          const targetRakDetailId =
            toId(d.rak_tujuan_d_id) ||
            (targetRakDetailRelId && targetRakDetailRelId !== sourceRakDetailId
              ? targetRakDetailRelId
              : "") ||
            (toId(rakAsalDetailRel) &&
            toId(rakAsalDetailRel) !== sourceRakDetailId
              ? toId(rakAsalDetailRel)
              : "") ||
            "";

          return {
            ...d,
            stock_opname_d_id:
              toId(d.stock_opname_d_id) || toId(d.t_stock_opname_d_id) || "",
            rak_asal_id: sourceRakId,
            rak_asal_d_id: sourceRakDetailId,
            rak_tujuan: targetRakId,
            rak_tujuan_id: targetRakId,
            rak_tujuan_d: rakTujuanDetailRel || null,
            rak_tujuan_d_id: targetRakDetailId,
            m_rak_id: sourceRakId,
            m_rak_d_id: sourceRakDetailId,
            nama_rak_master: rakAsalRel?.nama_rak || d.nama_rak_master || "-",
            kode_rak_d:
              rakAsalDetailRel?.kode ||
              d.kode_rak_d ||
              rakAsalRel?.kode_rak ||
              "-",
            nama_rak_tujuan: rakTujuanRel?.nama_rak || d.nama_rak_tujuan || "",
            kode_rak_tujuan_d:
              rakTujuanDetailRel?.kode || d.kode_rak_tujuan_d || "",
            kode_item: d.m_item?.kode_item || "-",
            nama_item: d.m_item?.nama_item || "-",
            batch: d.batch || "",
            is_batch: Boolean(d.m_item?.is_batch),
          };
        });
      }

      if (isCopyModeLocal) {
        delete (initialValues as any).id;
        delete (initialValues as any).no_tw;
        delete (initialValues as any).createdAt;
        delete (initialValues as any).updatedAt;

        initialValues.status = "DRAFT";

        detailItems.value = detailItems.value.map((item: any) => {
          const { id, t_transfer_gudang_id, createdAt, updatedAt, ...rest } =
            item;
          return {
            ...rest,
            created_by: authStore.user?.id || "",
          };
        });
      }

      for (const key in initialValues) {
        if (Object.prototype.hasOwnProperty.call(values, key)) {
          // @ts-ignore dynamic assign
          values[key] = initialValues[key];
        }
      }

      values.opname_id = toId(values.opname_id);
      values.opname_id = toId(
        values.opname_id ||
          initialValues?.t_stock_opname_id ||
          initialValues?.stock_opname_id ||
          initialValues?.t_stock_opname?.id,
      );
      values.m_unit_bisnis_id = toId(values.m_unit_bisnis_id);
      values.warehouse_asal_id = toId(values.warehouse_asal_id);
      values.warehouse_tujuan_id = toId(values.warehouse_tujuan_id);
      values.pic_id = toId(values.pic_id);

      selectedUnitBisnis.value =
        initialValues.m_unit_bisnis ||
        initialValues.m_unit_bisni ||
        initialValues.unit_bisnis ||
        selectedUnitBisnis.value;

      if (values.type === "langsung" && detailItems.value.length > 0) {
        await hydrateFreeStockForLoadedDetails();
      }

      opnameNoDisplay.value =
        initialValues?.t_stock_opname?.no_stock_opname ||
        initialValues?.stock_opname?.no_stock_opname ||
        "";

      if (values.type === "opname" && values.opname_id) {
        const includedOpname =
          initialValues?.t_stock_opname ||
          initialValues?.stock_opname ||
          initialValues?.opname ||
          null;

        if (includedOpname) {
          await handleStockOpnameSelect(includedOpname, {
            silent: true,
            preserveExistingDetails: true,
          });
        }
      }

      warehouseAsalDisplay.value =
        initialValues?.warehouse_asal?.nama_gudang ||
        initialValues?.m_gudang?.nama_gudang ||
        "";
      opnameRakDisplay.value =
        initialValues?.rak_opname?.nama_rak ||
        initialValues?.m_rak?.nama_rak ||
        detailItems.value[0]?.nama_rak_master ||
        "";

      if (isCopyModeLocal) {
        toast.success("Data berhasil disalin", {
          description: "Silakan edit dan simpan sebagai Transfer Gudang baru",
        });
      } else {
        toast.success("Data berhasil dimuat");
      }
    } catch (error) {
      toast.error("Gagal memuat data Transfer Gudang", {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
        action: {
          label: "Kembali",
          onClick: () => router.push("/inventory/transaksi/t_transfer_gudang"),
        },
      });
      setTimeout(() => router.push("/inventory/transaksi/t_transfer_gudang"), 2000);
    } finally {
      loading.value = false;
    }
  });

  watch(
    () => values.warehouse_asal_id,
    (newWarehouseId: string, oldWarehouseId: string) => {
      const hasWarehouseChanged = newWarehouseId !== oldWarehouseId;

      if (
        isTypeLangsung.value &&
        hasWarehouseChanged &&
        !!oldWarehouseId &&
        !loading.value
      ) {
        detailItems.value = [];
        toast.info("Detail item direset karena Gudang Asal berubah");
      }

      if (!isTypeOpname.value) {
        values.rak_asal = "";
      }

      if (isTypeOpname.value) {
        values.warehouse_tujuan_id = values.warehouse_asal_id || "";
        return;
      }
    },
  );

  watch(
    () => values.type,
    (newType, oldType) => {
      if (!oldType || newType === oldType || loading.value) return;
      resetOnTransferTypeChange();
    },
  );

  watch(
    () => values.warehouse_tujuan_id,
    (newWarehouseId: string, oldWarehouseId: string) => {
      if (!isTypeOpname.value) {
        values.rak_asal = "";
      }

      if (isTypeOpname.value) {
        values.warehouse_tujuan_id = values.warehouse_asal_id || "";
        return;
      }

      const hasWarehouseChanged = newWarehouseId !== oldWarehouseId;
      if (!hasWarehouseChanged || loading.value || !oldWarehouseId) {
        return;
      }

      detailItems.value = detailItems.value.map((item: any) => ({
        ...item,
        rak_tujuan: "",
        rak_tujuan_d_id: "",
        nama_rak_tujuan: "",
        kode_rak_tujuan_d: "",
      }));
    },
  );

  const onSave = async () => {
    Object.keys(errors).forEach((key) => {
      errors[key as keyof typeof errors] = "";
    });
    let invalid = false;

    if (!values.type) {
      errors.type = "Type Transfer wajib dipilih";
      invalid = true;
    }
    if (values.type === "opname" && !values.opname_id) {
      errors.opname_id = "No. Stock Opname wajib dipilih";
      invalid = true;
    }
    if (!values.m_unit_bisnis_id) {
      errors.m_unit_bisnis_id = "Unit Bisnis wajib diisi";
      invalid = true;
    }
    if (!values.tgl_tw) {
      errors.tgl_tw = "Tanggal Transfer wajib diisi";
      invalid = true;
    }
    if (!values.warehouse_asal_id) {
      errors.warehouse_asal_id = "Gudang Asal wajib diisi";
      invalid = true;
    }
    if (isTypeLangsung.value && !values.warehouse_tujuan_id) {
      errors.warehouse_tujuan_id = "Gudang Tujuan wajib diisi";
      invalid = true;
    }
    if (!values.pic_id) {
      errors.pic_id = "PIC wajib diisi";
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
      const qtyValue =
        values.type === "opname"
          ? getTransferQtyFromOpnameDetail(item)
          : Number(item.qty) || 0;
      if (!item.m_items_id) {
        toast.error("Validasi gagal", {
          description: `Item pada baris ${i + 1} tidak valid`,
        });
        return;
      }
      if (!qtyValue || qtyValue <= 0) {
        toast.error("Validasi gagal", {
          description: `Qty pada item ${i + 1} harus lebih dari 0`,
        });
        return;
      }
      if (isTypeLangsung.value) {
        const hasFreeStockValue =
          item.free_stock !== null &&
          item.free_stock !== undefined &&
          item.free_stock !== "";
        const freeStockValue = Number(item.free_stock) || 0;

        if (hasFreeStockValue && qtyValue > freeStockValue) {
          toast.error("Validasi gagal", {
            description: `Qty pada item ${i + 1} tidak boleh lebih dari stock tersedia (${freeStockValue})`,
          });
          return;
        }
      }
      const isRakTujuanRequired = isSameWarehouse.value;
      if (isRakTujuanRequired && !item.rak_tujuan) {
        toast.error("Validasi gagal", {
          description: `Rak tujuan pada item ${i + 1} wajib dipilih`,
        });
        return;
      }
      const sourceRakId = item.m_rak_id || item.rak_asal_id || "";
      if (
        isRakTujuanRequired &&
        sourceRakId &&
        item.rak_tujuan === sourceRakId
      ) {
        toast.error("Validasi gagal", {
          description: `Rak tujuan pada item ${i + 1} tidak boleh sama dengan Rak Asal`,
        });
        return;
      }
      if (isRakTujuanRequired && !item.rak_tujuan_d_id) {
        toast.error("Validasi gagal", {
          description: `Rak tujuan detail pada item ${i + 1} wajib dipilih`,
        });
        return;
      }
      const sourceRakDetailId = item.m_rak_d_id || item.rak_asal_d_id || "";
      if (
        isRakTujuanRequired &&
        sourceRakDetailId &&
        item.rak_tujuan_d_id === sourceRakDetailId
      ) {
        toast.error("Validasi gagal", {
          description: `Rak tujuan detail pada item ${i + 1} tidak boleh sama dengan Rak Asal Detail`,
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

    loading.value = true;
    try {
      const payload: any = {
        type: values.type || "langsung",
        opname_id: values.type === "opname" ? values.opname_id || null : null,
        m_unit_bisnis_id: values.m_unit_bisnis_id || null,
        warehouse_asal_id: values.warehouse_asal_id || null,
        warehouse_tujuan_id:
          (isTypeOpname.value
            ? values.warehouse_asal_id
            : values.warehouse_tujuan_id) || null,
        status: values.status || "DRAFT",
        tgl_tw: values.tgl_tw || null,
        catatan: values.catatan || null,
        pic_id: values.pic_id || null,
        t_transfer_gudang_ds: detailItems.value.map((item: any) => {
          const sourceRakId = item.m_rak_id || item.rak_asal_id || null;
          const sourceRakDetailId =
            item.m_rak_d_id || item.rak_asal_d_id || null;
          const targetRakId = isSameWarehouse.value
            ? item.rak_tujuan || item.rak_tujuan_id || null
            : null;
          const targetRakDetailId = isSameWarehouse.value
            ? item.rak_tujuan_d_id || item.rak_tujuan_d?.id || null
            : null;

          return {
            ...(item.id && { id: item.id }),
            m_items_id: item.m_items_id,
            qty:
              values.type === "opname"
                ? getTransferQtyFromOpnameDetail(item)
                : Number(item.qty) || 0,
            ...(values.type === "opname" && item.stock_opname_d_id
              ? { stock_opname_d_id: item.stock_opname_d_id }
              : {}),
            batch: item.batch || null,
            m_rak_id: sourceRakId,
            m_rak_d_id: sourceRakDetailId,
            rak_asal_id: sourceRakId,
            rak_asal_d_id: sourceRakDetailId,
            rak_tujuan: targetRakId,
            rak_tujuan_id: targetRakId,
            rak_tujuan_d_id: targetRakDetailId,
            catatan: item.catatan || null,
            ...(isEditMode.value
              ? { updated_by: authStore.user?.id || "" }
              : { created_by: authStore.user?.id || "" }),
          };
        }),
      };

      if (isEditMode.value) {
        payload.updated_by = authStore.user?.id || "";
        await updateTransferGudang(menuId.value, payload as any);
        toast.success("Transfer Gudang berhasil diperbarui", {
          description: "Data Transfer Gudang telah diperbarui",
        });
      } else {
        payload.created_by = authStore.user?.id || "";
        await createTransferGudang(payload as any);
        toast.success("Transfer Gudang berhasil dibuat", {
          description: "Data Transfer Gudang baru telah ditambahkan",
        });
      }
      router.replace("/inventory/transaksi/t_transfer_gudang?reload=" + Date.now());
    } catch (error) {
      toast.error(
        isEditMode.value
          ? "Gagal memperbarui Transfer Gudang"
          : "Gagal membuat Transfer Gudang",
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
    router.push("/inventory/transaksi/t_transfer_gudang");
  };

  return {
    authStore,
    API_BASE_URL,
    loading,
    isEditMode,
    isViewMode,
    isCopyMode,
    isReadOnly,
    menuId,
    isSuperAdmin,
    unitBisnisNameDisplay,
    selectedCompanyNameDisplay,
    pageTitle,
    pageDescription,
    values,
    auditMeta,
    initialValues,
    detailItems,
    warehouseAsalDisplay,
    opnameRakDisplay,
    transferTypeOptions,
    isTypeLangsung,
    isTypeOpname,
    isSameWarehouse,
    warehouseTujuanDisplay,
    opnameRakDisplayValue,
    opnameNoDisplay,
    selectedItemIds,
    toId,
    toEntity,
    removeDetailItem,
    getRakAsalName,
    getRakAsalDetail,
    handleUnitBisnisSelected,
    handleStockOpnameSelect,
    handleWarehouseAsalSelect,
    getRakTujuanApiConfig,
    getRakTujuanDetailApiConfig,
    resetOnTransferTypeChange,
    onReset,
    errors,
    onSave,
    handleCancel,
  };
}
