import { computed, onBeforeMount, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import {
  createPurchaseRequestSubcon,
  getPurchaseRequestSubconById,
  updatePurchaseRequestSubcon,
} from "./service";

const POTONG_SISA_THRESHOLD_PERCENT = 2;

const getDefaultValues = () => ({
  m_unit_bisnis_id: "",
  m_gudang_id: "",
  jenis_pr_subcon: "",
  tgl_pr_subcon: new Date().toISOString().split("T")[0],
  no_pr_subcon: "",
  tgl_butuh: "",
  catatan: "",
  status: "DRAFT",
  is_active: true,
});

const getDefaultErrors = () => ({
  m_unit_bisnis_id: "",
  m_gudang_id: "",
  jenis_pr_subcon: "",
  tgl_pr_subcon: "",
  no_pr_subcon: "",
  tgl_butuh: "",
  catatan: "",
});

export function usePurchaseRequestSubconForm() {
  type PotongDialogType = "info" | "warning" | "danger";
  type PotongValidationStatus = "valid" | "warning" | "blocked";
  interface PotongDialogFinishGoodsItem {
    name: string;
    ukuran: number;
    qty: number;
    total: number;
  }

  interface PotongDialogSummaryItem {
    label: string;
    value: string;
  }

  interface PotongValidationResult {
    status: PotongValidationStatus;
    title: string;
    description: string;
    qtyBahan: number;
    ukuranBahan: number;
    totalBahanUkuran: number;
    minimumFinishGoodsUkuran: number;
    maximumFinishGoodsUkuran: number;
    totalFinishGoodsQty: number;
    totalFinishGoodsUkuran: number;
    sisaQty: number;
    sisaPersen: number;
    bahanName: string;
    finishGoodsNames: string[];
    finishGoodsDetails: PotongDialogFinishGoodsItem[];
  }

  const authStore = useAuthStore();
  const { API_BASE_URL } = useApi();
  const router = useRouter();
  const route = useRoute();

  type FormValues = ReturnType<typeof getDefaultValues>;

  const loading = ref(false);
  const detailArr = ref<any[]>([]);
  const detailArr2 = ref<any[]>([]);
  const detailArr3 = ref<any[]>([]);
  const jenisPrSubconMap = ref<Record<string, string>>({});
  const uomMap = ref<Record<string, string>>({});
  const potongDialogOpen = ref(false);
  const potongDialogType = ref<PotongDialogType>("info");
  const potongDialogTitle = ref("");
  const potongDialogDescription = ref("");
  const potongDialogConfirmText = ref<string | undefined>(undefined);
  const potongDialogSummary = ref<PotongDialogSummaryItem[]>([]);
  const potongDialogFinishGoods = ref<PotongDialogFinishGoodsItem[]>([]);
  const pendingPotongSaveAction = ref<null | (() => Promise<void>)>(null);
  const selectedUnitBisnis = ref<any | null>(null);

  const values = reactive<FormValues>(getDefaultValues());
  const errors = reactive(getDefaultErrors());

  let initialValues: Record<string, any> = {};

  const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

  const isEditMode = computed(
    () => !!route.params.id && route.name === "PurchaseRequestSubconForm",
  );
  const isViewMode = computed(() => route.name === "PurchaseRequestSubconView");
  const isCopyMode = computed(
    () => route.query.action === "copy" && !!route.query.source,
  );
  const isReadOnly = computed(
    () => isViewMode.value || route.meta.readOnly === true ||
      (isEditMode.value && ["APPROVED", "IN APPROVAL"].includes((values.status || "").toUpperCase())),
  );
  const menuId = computed(() => route.params.id as string);
  const jenisPrSubconLabel = computed(
    () => jenisPrSubconMap.value[values.jenis_pr_subcon] || "",
  );
  const isJenisPrSepuh = computed(
    () => jenisPrSubconLabel.value.toUpperCase() === "SEPUH",
  );
  const isJenisPrPotong = computed(
    () => jenisPrSubconLabel.value.toUpperCase() === "POTONG",
  );
  const canUseManualJasa = computed(() =>
    ["SEPUH", "POTONG"].includes(jenisPrSubconLabel.value.toUpperCase()),
  );

  const getStockItemKey = (item: any, gudangFallback?: string) => {
    const itemId = item.m_items_id || item.m_item_id || item.id;
    if (!itemId) return "";
    const gudangId = gudangFallback || "";
    return `${itemId}_${gudangId}`;
  };

  const filterAvailableRakList = (rakList: any[] = []) =>
    rakList.filter(
      (rak: any) => Number(rak?.qty_free_stok ?? rak?.free_stock ?? 0) > 0,
    );

  const resolveSelectedRak = (rakList: any[], selectedStockGudangId: any) => {
    const selected =
      rakList.find(
        (rak: any) =>
          String(rak?.stock_gudang_id) === String(selectedStockGudangId),
      ) || rakList[0];
    return selected;
  };

  const isSuperAdmin = computed(() => {
    const user = authStore.user;
    if (!user || !user.tipe) return false;
    return user.tipe.value1?.toUpperCase() === "SUPER ADMIN";
  });

  const fallbackUnitBisnisNameDisplay = computed(() => {
    if (isSuperAdmin.value) return "-";

    try {
      const selectRespo = localStorage.getItem("SelectRespo");
      if (!selectRespo) return "-";
      const parsed = JSON.parse(selectRespo);
      return parsed.companyName || parsed.nama_comp || "-";
    } catch {
      return "-";
    }
  });

  const unitBisnisNameDisplay = computed(() => {
    return (
      selectedUnitBisnis.value?.nama_comp ||
      selectedUnitBisnis.value?.nama_unit_bisnis ||
      selectedUnitBisnis.value?.nama ||
      fallbackUnitBisnisNameDisplay.value
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
    if (isViewMode.value) return "Detail Purchase Request Subcon";
    if (isCopyMode.value) return "Salin Purchase Request Subcon";
    if (isEditMode.value) return "Edit Purchase Request Subcon";
    return "Tambah Purchase Request Subcon Baru";
  });

  const pageDescription = computed(() => {
    if (isViewMode.value) return "Lihat detail data Purchase Request Subcon";
    if (isCopyMode.value)
      return "Buat Purchase Request Subcon baru dari data yang disalin";
    if (isEditMode.value) return "Perbarui data Purchase Request Subcon";
    return "Buat Purchase Request Subcon baru";
  });

  const fetchGeneralOptions = async (group: string) => {
    const params = new URLSearchParams({
      no_pagination: "true",
      selectfield: "id,value1",
      filter_column_group: group,
      filter_column_is_active: "true",
    });
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_general?${params.toString()}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Gagal memuat data ${group}`);
    }

    const json = await response.json();
    return Array.isArray(json?.data) ? json.data : [];
  };

  const loadGeneralLookups = async () => {
    try {
      const [jenisOptions, uomOptions] = await Promise.all([
        fetchGeneralOptions("TIPE PR SUBCON"),
        fetchGeneralOptions("UOM"),
      ]);

      jenisPrSubconMap.value = Object.fromEntries(
        jenisOptions.map((item: any) => [String(item.id), item.value1 || ""]),
      );
      uomMap.value = Object.fromEntries(
        uomOptions.map((item: any) => [
          String(item.value1 || "").toUpperCase(),
          String(item.id),
        ]),
      );
    } catch (error) {
      toast.error("Gagal memuat referensi PR Subcon", {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      });
    }
  };

  const resolveDefaultJasaUom = () => {
    const jenis = jenisPrSubconLabel.value.toUpperCase();
    if (jenis === "SEPUH") return { label: "KG", id: uomMap.value.KG || null };
    if (jenis === "POTONG")
      return { label: "PCS", id: uomMap.value.PCS || null };
    return { label: "", id: null };
  };

  const resolveManualJasaUom = () => ({
    label: "BORONGAN",
    id: uomMap.value.BORONGAN || null,
  });

  const syncJasaDetailsWithJenis = () => {
    const defaultUom = resolveDefaultJasaUom();
    const manualUom = resolveManualJasaUom();
    detailArr3.value = detailArr3.value.map((detail) => ({
      ...detail,
      is_manual: canUseManualJasa.value ? !!detail.is_manual : false,
      uom_id:
        canUseManualJasa.value && detail.is_manual
          ? manualUom.id || detail.uom_id || null
          : defaultUom.id || detail.uom_id || null,
      uom:
        canUseManualJasa.value && detail.is_manual
          ? manualUom.label
          : defaultUom.label || detail.uom || "-",
      qty:
        canUseManualJasa.value && detail.is_manual
          ? 1
          : Math.max(Number(detail.qty_pr_jasa ?? detail.qty) || 0, 1),
    }));
  };

  const isUuid = (value: unknown) =>
    typeof value === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
      value,
    );

  const resetErrors = () => {
    Object.keys(errors).forEach((key) => {
      errors[key as keyof typeof errors] = "";
    });
  };

  const initializeUnitBisnis = () => {
    if (isSuperAdmin.value) return;

    try {
      const selectRespo = localStorage.getItem("SelectRespo");
      if (!selectRespo) return;

      const parsed = JSON.parse(selectRespo);
      const unitBisnisId = parsed.companyId || parsed.m_unit_bisnis_id || "";
      if (unitBisnisId) {
        values.m_unit_bisnis_id = unitBisnisId;
      }
    } catch {
      // ignore parse error
    }
  };

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
      return result.status === "success" ? result.data || null : null;
    } catch {
      return null;
    }
  };

  const handleUnitBisnisSelected = (unitBisnis: any | null) => {
    selectedUnitBisnis.value = unitBisnis || null;
    values.m_gudang_id = "";
    detailArr.value = [];
    detailArr2.value = [];
  };

  const addDetailArr = () => {
    detailArr.value.push({
      kode: "",
      nama_material: "",
      qty: 0,
      uom: "",
      qty_free_stok: 0,
      stock_gudang_id: "",
      rak_list: [],
      catatan: "",
    });
  };

  const removeDetailArr = (index: number) => {
    detailArr.value.splice(index, 1);
    toast.info("Detail dihapus");
  };

  const addDetailArr2 = () => {
    detailArr2.value.push({
      kode: "",
      nama_item: "",
      qty: 0,
      uom: "",
      qty_free_stok: 0,
      catatan: "",
    });
  };

  const removeDetailArr2 = (index: number) => {
    detailArr2.value.splice(index, 1);
    toast.info("Detail dihapus");
  };

  const clearDetailArr2 = () => {
    detailArr2.value = [];
    toast.info("Semua detail finish goods berhasil dihapus");
  };

  const addDetailArr3 = () => {
    const defaultUom = resolveDefaultJasaUom();
    detailArr3.value.push({
      kode: "",
      nama_jasa: "",
      qty: 0,
      uom_id: defaultUom.id,
      uom: defaultUom.label || "",
      is_manual: false,
      catatan: "",
    });
  };

  const formatPotongNumber = (value: number) =>
    Number.isFinite(value)
      ? Number(value).toLocaleString("id-ID", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
      : "0";

  const buildPotongDialogDescription = (params: {
    bahanName: string;
    qtyBahan: number;
    ukuranBahan: number;
    totalBahanUkuran: number;
    totalFinishGoodsQty: number;
    totalFinishGoodsUkuran: number;
    sisaQty: number;
    sisaPersen: number;
    finishGoodsNames: string[];
    extraMessage: string;
  }) => {
    const finishGoodsLabel = params.finishGoodsNames.length
      ? params.finishGoodsNames.join(", ")
      : "-";

    return [
      params.extraMessage,
      `Bahan: ${params.bahanName}.`,
      `Qty Bahan: ${formatPotongNumber(params.qtyBahan)}.`,
      `Ukuran Bahan: ${formatPotongNumber(params.ukuranBahan)}.`,
      `Total Bahan (ukuran x qty): ${formatPotongNumber(params.totalBahanUkuran)}.`,
      `Total Qty Finish Goods: ${formatPotongNumber(params.totalFinishGoodsQty)}.`,
      `Total Finish Goods (ukuran x qty): ${formatPotongNumber(params.totalFinishGoodsUkuran)}.`,
      `Sisa Qty: ${formatPotongNumber(params.sisaQty)}.`,
      `Sisa Persentase: ${formatPotongNumber(params.sisaPersen)}%.`,
      `Finish Goods: ${finishGoodsLabel}.`,
    ].join(" ");
  };

  const closePotongDialog = () => {
    potongDialogOpen.value = false;
    pendingPotongSaveAction.value = null;
    potongDialogSummary.value = [];
    potongDialogFinishGoods.value = [];
  };

  const openPotongDialog = ({
    type,
    title,
    description,
    summary,
    finishGoods,
    confirmText,
    onConfirm,
  }: {
    type: PotongDialogType;
    title: string;
    description: string;
    summary?: PotongDialogSummaryItem[];
    finishGoods?: PotongDialogFinishGoodsItem[];
    confirmText?: string;
    onConfirm?: () => Promise<void>;
  }) => {
    potongDialogType.value = type;
    potongDialogTitle.value = title;
    potongDialogDescription.value = description;
    potongDialogSummary.value = summary || [];
    potongDialogFinishGoods.value = finishGoods || [];
    potongDialogConfirmText.value = confirmText;
    pendingPotongSaveAction.value = onConfirm || null;
    potongDialogOpen.value = true;
  };

  const buildPotongDialogSummary = (result: PotongValidationResult) => [
    { label: "Bahan", value: result.bahanName },
    {
      label: "Qty Bahan",
      value: formatPotongNumber(result.qtyBahan),
    },
    {
      label: "Ukuran Bahan",
      value: formatPotongNumber(result.ukuranBahan),
    },
    {
      label: "Total Bahan",
      value: formatPotongNumber(result.totalBahanUkuran),
    },
    {
      label: "Total Finish Goods",
      value: formatPotongNumber(result.totalFinishGoodsUkuran),
    },
    {
      label: "Batas Minimum",
      value: formatPotongNumber(result.minimumFinishGoodsUkuran),
    },
    {
      label: "Batas Maksimum",
      value: formatPotongNumber(result.maximumFinishGoodsUkuran),
    },
    {
      label: "Sisa",
      value: formatPotongNumber(result.sisaQty),
    },
    {
      label: "Sisa %",
      value: `${formatPotongNumber(result.sisaPersen)}%`,
    },
    {
      label: "Status",
      value:
        result.status === "blocked"
          ? "Di luar batas toleransi"
          : "Masih sesuai batas toleransi",
    },
  ];

  const validatePotongBeforeSave = (): PotongValidationResult => {
    if (!isJenisPrPotong.value) {
      return {
        status: "valid",
        title: "",
        description: "",
        qtyBahan: 0,
        ukuranBahan: 0,
        totalBahanUkuran: 0,
        minimumFinishGoodsUkuran: 0,
        maximumFinishGoodsUkuran: 0,
        totalFinishGoodsQty: 0,
        totalFinishGoodsUkuran: 0,
        sisaQty: 0,
        sisaPersen: 0,
        bahanName: "",
        finishGoodsNames: [],
        finishGoodsDetails: [],
      };
    }

    const bahan = detailArr.value[0];
    if (!bahan || detailArr2.value.length === 0) {
      return {
        status: "valid",
        title: "",
        description: "",
        qtyBahan: 0,
        ukuranBahan: 0,
        totalBahanUkuran: 0,
        minimumFinishGoodsUkuran: 0,
        maximumFinishGoodsUkuran: 0,
        totalFinishGoodsQty: 0,
        totalFinishGoodsUkuran: 0,
        sisaQty: 0,
        sisaPersen: 0,
        bahanName: "",
        finishGoodsNames: [],
        finishGoodsDetails: [],
      };
    }

    const qtyBahan = Number(bahan.qty) || 0;
    const ukuranBahan = Number(bahan.ukuran) || 0;
    const totalBahanUkuran = ukuranBahan * qtyBahan;
    const minimumFinishGoodsUkuran =
      totalBahanUkuran * (1 - POTONG_SISA_THRESHOLD_PERCENT / 100);
    const maximumFinishGoodsUkuran = totalBahanUkuran;
    const totalFinishGoodsQty = detailArr2.value.reduce(
      (sum, detail) => sum + (Number(detail.qty) || 0),
      0,
    );
    const totalFinishGoodsUkuran = detailArr2.value.reduce(
      (sum, detail) =>
        sum + (Number(detail.ukuran) || 0) * (Number(detail.qty) || 0),
      0,
    );
    const sisaQty = totalBahanUkuran - totalFinishGoodsUkuran;
    const sisaPersen =
      totalBahanUkuran > 0 ? (sisaQty / totalBahanUkuran) * 100 : 0;
    const bahanName = bahan.nama_material || bahan.nama_item || bahan.kode || "-";
    const finishGoodsNames = detailArr2.value.map(
      (detail) =>
        `${detail.nama_item || detail.kode || "Item"} (${formatPotongNumber(
          Number(detail.ukuran) || 0,
        )} x ${formatPotongNumber(Number(detail.qty) || 0)})`,
    );
    const finishGoodsDetails = detailArr2.value.map((detail) => ({
      name: detail.nama_item || detail.kode || "Item",
      ukuran: Number(detail.ukuran) || 0,
      qty: Number(detail.qty) || 0,
      total: (Number(detail.ukuran) || 0) * (Number(detail.qty) || 0),
    }));

    if (qtyBahan <= 0 || ukuranBahan <= 0 || totalBahanUkuran <= 0) {
      return {
        status: "blocked",
        title: "Data Bahan Tidak Valid",
        description: buildPotongDialogDescription({
          bahanName,
          qtyBahan,
          ukuranBahan,
          totalBahanUkuran,
          totalFinishGoodsQty,
          totalFinishGoodsUkuran,
          sisaQty,
          sisaPersen,
          finishGoodsNames,
          extraMessage:
            "PR Subcon tipe POTONG tidak bisa disimpan karena qty dan ukuran bahan harus lebih dari 0.",
        }),
        qtyBahan,
        ukuranBahan,
        totalBahanUkuran,
        minimumFinishGoodsUkuran,
        maximumFinishGoodsUkuran,
        totalFinishGoodsQty,
        totalFinishGoodsUkuran,
        sisaQty,
        sisaPersen,
        bahanName,
        finishGoodsNames,
        finishGoodsDetails,
      };
    }

    if (totalFinishGoodsUkuran > maximumFinishGoodsUkuran || sisaQty < 0) {
      return {
        status: "blocked",
        title: "Total Finish Goods Melebihi Bahan",
        description: buildPotongDialogDescription({
          bahanName,
          qtyBahan,
          ukuranBahan,
          totalBahanUkuran,
          totalFinishGoodsQty,
          totalFinishGoodsUkuran,
          sisaQty,
          sisaPersen,
          finishGoodsNames,
          extraMessage:
            "PR Subcon tipe POTONG tidak bisa disimpan karena total finish goods melebihi total bahan.",
        }),
        qtyBahan,
        ukuranBahan,
        totalBahanUkuran,
        minimumFinishGoodsUkuran,
        maximumFinishGoodsUkuran,
        totalFinishGoodsQty,
        totalFinishGoodsUkuran,
        sisaQty,
        sisaPersen,
        bahanName,
        finishGoodsNames,
        finishGoodsDetails,
      };
    }

    if (totalFinishGoodsUkuran < minimumFinishGoodsUkuran) {
      return {
        status: "blocked",
        title: "Total Finish Goods Di Bawah Batas Minimum",
        description: buildPotongDialogDescription({
          bahanName,
          qtyBahan,
          ukuranBahan,
          totalBahanUkuran,
          totalFinishGoodsQty,
          totalFinishGoodsUkuran,
          sisaQty,
          sisaPersen,
          finishGoodsNames,
          extraMessage: `PR Subcon tipe POTONG tidak bisa disimpan karena total finish goods masih di bawah batas minimum toleransi ${POTONG_SISA_THRESHOLD_PERCENT}%.`,
        }),
        qtyBahan,
        ukuranBahan,
        totalBahanUkuran,
        minimumFinishGoodsUkuran,
        maximumFinishGoodsUkuran,
        totalFinishGoodsQty,
        totalFinishGoodsUkuran,
        sisaQty,
        sisaPersen,
        bahanName,
        finishGoodsNames,
        finishGoodsDetails,
      };
    }

    return {
      status: "warning",
      title: "Konfirmasi Hasil POTONG",
      description: buildPotongDialogDescription({
        bahanName,
        qtyBahan,
        ukuranBahan,
        totalBahanUkuran,
        totalFinishGoodsQty,
        totalFinishGoodsUkuran,
        sisaQty,
        sisaPersen,
        finishGoodsNames,
        extraMessage: `Data hasil potong masih sesuai batas toleransi ${POTONG_SISA_THRESHOLD_PERCENT}%. Silakan pastikan kembali sebelum menyimpan.`,
      }),
      qtyBahan,
      ukuranBahan,
      totalBahanUkuran,
      minimumFinishGoodsUkuran,
      maximumFinishGoodsUkuran,
      totalFinishGoodsQty,
      totalFinishGoodsUkuran,
      sisaQty,
      sisaPersen,
      bahanName,
      finishGoodsNames,
      finishGoodsDetails,
    };
  };

  const removeDetailArr3 = (index: number) => {
    detailArr3.value.splice(index, 1);
    toast.info("Detail dihapus");
  };

  const mapDetailBahan = (item: any) => {
    const rakList = filterAvailableRakList(item.rak_list || []);
    const selectedRak = resolveSelectedRak(rakList, item.stock_gudang_id);

    return {
      id: item.id,
      m_items_id: item.m_items_id || item.m_item_id || item.id || null,
      m_gudang_id: item.m_gudang_id || null,
      uom_id: item.uom_id || item.uomId || null,
      stock_gudang_id: selectedRak?.stock_gudang_id || null,
      kode: item.kode_item || item.kode || item.code || "-",
      nama_material:
        item.nama_material || item.nama_item || item.value1 || "-",
      ukuran: Number(item.ukuran) || 0,
      qty: Number(item.qty) || 1,
      uom: item.uom || item.uom_name || item.value2 || "-",
      qty_free_stok:
        Number(
          selectedRak?.qty_free_stok ??
            selectedRak?.free_stock ??
            item.qty_free_stok ??
            item.free_stock,
        ) || 0,
      rak_list: rakList,
      catatan: "",
    };
  };

  const mapDetailFinishGoods = (item: any) => ({
    id: item.id,
    m_items_id: item.m_items_id || item.m_item_id || item.id || null,
    m_gudang_id: item.m_gudang_id || null,
    uom_id: item.uom_id || item.uomId || null,
    kode: item.kode_item || item.kode || item.code || "-",
    nama_item: item.nama_item || item.nama_material || item.value1 || "-",
    ukuran: Number(item.ukuran) || 0,
    qty: Number(item.qty) || 1,
    uom: item.uom || item.uom_name || item.value2 || "-",
    qty_free_stok: Number(item.free_stock) || 0,
    catatan: "",
  });

  const mapDetailJasa = (item: any) => {
    const defaultUom = resolveDefaultJasaUom();
    return {
      id: item.id,
      m_items_id: item.m_items_id || item.m_item_id || item.id || null,
      uom_id: defaultUom.id || item.uom_id || item.uomId || null,
      kode: item.kode_item || item.kode || item.code || "-",
      nama_jasa: item.nama_jasa || item.nama_item || item.value1 || "-",
      qty: Number(item.qty) || 1,
      uom: defaultUom.label || item.uom || item.uom_name || item.value2 || "-",
      is_manual: false,
      catatan: "",
    };
  };

  const mapDetailBahanFromDb = (item: any) => {
    const rakList = filterAvailableRakList(item.rak_list || []);
    const selectedRak = resolveSelectedRak(
      rakList,
      item.stock_gudang_id || item.rak_list?.[0]?.stock_gudang_id,
    );

    return {
      id: item.id,
      m_items_id: item.m_items_id || item.m_item_id || item.id || null,
      m_gudang_id: item.m_gudang_id || null,
      uom_id: item.uom_id || item.uomId || null,
      stock_gudang_id: selectedRak?.stock_gudang_id || null,
      kode:
        item.kode_item ||
        item.kode ||
        item.code ||
        item.m_items?.kode_item ||
        item.m_items?.kode ||
        "-",
      nama_material:
        item.nama_material ||
        item.nama_item ||
        item.value1 ||
        item.m_items?.nama_item ||
        "-",
      ukuran: Number(item.ukuran ?? item.m_items?.ukuran) || 0,
      qty: Number(item.qty_pr_bahan ?? item.qty) || 0,
      uom: item.uom || item.uom_name || item.uom?.nama || item.value2 || "-",
      qty_free_stok:
        Number(
          selectedRak?.qty_free_stok ??
            selectedRak?.free_stock ??
            item.qty_free_stok ??
            item.free_stock,
        ) || 0,
      rak_list: rakList,
      catatan: item.catatan || "",
    };
  };

  const mapDetailJadiFromDb = (item: any) => ({
    id: item.id,
    m_items_id: item.m_items_id || item.m_item_id || item.id || null,
    m_gudang_id: item.m_gudang_id || null,
    uom_id: item.uom_id || item.uomId || null,
    kode:
      item.kode_item ||
      item.kode ||
      item.code ||
      item.m_items?.kode_item ||
      item.m_items?.kode ||
      "-",
    nama_item:
      item.nama_item ||
      item.nama_material ||
      item.value1 ||
      item.m_items?.nama_item ||
      "-",
    ukuran: Number(item.ukuran ?? item.m_items?.ukuran) || 0,
    qty: Number(item.qty_pr_jadi ?? item.qty) || 0,
    uom: item.uom || item.uom_name || item.uom?.nama || item.value2 || "-",
    qty_free_stok: Number(item.qty_free_stok ?? item.free_stock) || 0,
    catatan: item.catatan || "",
  });

  const mapDetailJasaFromDb = (item: any) => ({
    id: item.id,
    m_items_id: item.m_items_id || item.m_item_id || item.id || null,
    uom_id: item.uom_id || item.uomId || null,
    kode:
      item.kode_item ||
      item.kode ||
      item.code ||
      item.m_items?.kode_item ||
      item.m_items?.kode ||
      "-",
    nama_jasa:
      item.nama_jasa ||
      item.nama_item ||
      item.value1 ||
      item.m_items?.nama_item ||
      "-",
    qty: Number(item.qty_pr_jasa ?? item.qty) || 0,
    uom: item.uom || item.uom_name || item.uom?.nama || item.value2 || "-",
    is_manual: item.is_manual === true || item.is_manual === 1 || item.is_manual === "1",
    catatan: item.catatan || "",
  });

  const mapDetailBahanToDb = (item: any) => ({
    // ...(isUuid(item.id) ? { id: item.id } : {}),
    m_items_id: item.m_items_id || item.m_item_id || null,
    uom_id: item.uom_id || item.uomId || null,
    stock_gudang_id:
      item.stock_gudang_id ||
      item.m_rak_d_id ||
      item.rak_list?.[0]?.stock_gudang_id ||
      null,
    qty_pr_bahan: Number(item.qty) || 0,
    qty_free_stok: Number(item.qty_free_stok) || 0,
    catatan: item.catatan || "",
    created_by: item.created_by || authStore.user?.id || null,
    ...(isEditMode.value && { updated_by: authStore.user?.id || null }),
  });

  const mapDetailJadiToDb = (item: any) => ({
    // ...(isUuid(item.id) ? { id: item.id } : {}),
    m_items_id: item.m_items_id || item.m_item_id || null,
    uom_id: item.uom_id || item.uomId || null,
    qty_pr_jadi: Number(item.qty) || 0,
    qty_free_stok: Number(item.qty_free_stok) || 0,
    catatan: item.catatan || "",
    created_by: item.created_by || authStore.user?.id || null,
    ...(isEditMode.value && { updated_by: authStore.user?.id || null }),
  });

  const mapDetailJasaToDb = (item: any) => ({
    // ...(isUuid(item.id) ? { id: item.id } : {}),
    m_items_id: item.m_items_id || item.m_item_id || null,
    uom_id: item.uom_id || item.uomId || null,
    qty_pr_jasa: item.is_manual ? 1 : Number(item.qty) || 0,
    is_manual: !!item.is_manual,
    catatan: item.catatan || "",
    created_by: item.created_by || authStore.user?.id || null,
    ...(isEditMode.value && { updated_by: authStore.user?.id || null }),
  });

  const onReset = () => {
    Object.assign(values, getDefaultValues());
    resetErrors();
    detailArr.value = [];
    detailArr2.value = [];
    detailArr3.value = [];
    initializeUnitBisnis();
  };

  const loadFormData = async () => {
    const isCopyModeLocal = route.query.action === "copy" && route.query.source;
    const sourceId = isCopyModeLocal
      ? String(route.query.source)
      : menuId.value;

    if (
      !(isEditMode.value || isViewMode.value || isCopyModeLocal) ||
      !sourceId
    ) {
      return;
    }

    loading.value = true;
    try {
      const res = await getPurchaseRequestSubconById(sourceId);

      if (res.status !== "success") throw new Error("Gagal memuat data");
      initialValues = res.data;

      auditMeta.value = {
        created_by: initialValues.created_by,
        createdAt: initialValues.createdAt,
        updated_by: initialValues.update_by || initialValues.updated_by,
        updatedAt: initialValues.updatedAt,
      };

      if (initialValues.is_active !== undefined) {
        const activeValue = initialValues.is_active;
        initialValues.is_active =
          activeValue === true || activeValue === 1 || activeValue === "1";
      } else {
        initialValues.is_active = true;
      }
      if (
        initialValues.jenis_pr_subcon?.id &&
        initialValues.jenis_pr_subcon?.value1
      ) {
        jenisPrSubconMap.value = {
          ...jenisPrSubconMap.value,
          [String(initialValues.jenis_pr_subcon.id)]:
            initialValues.jenis_pr_subcon.value1,
        };
        initialValues.jenis_pr_subcon = String(initialValues.jenis_pr_subcon.id);
      }
      // 🧱 Detail Bahan
      if (initialValues.t_purchase_request_subcon_bahans) {
        detailArr.value = initialValues.t_purchase_request_subcon_bahans.map(
          ({ id, ...row }: any) => ({
            ...row,
            kode: row.m_item?.kode_item || "-",
            nama_material: row.m_item?.nama_item || "-",
            ukuran: Number(row.ukuran ?? row.m_item?.ukuran) || 0,
            uom: row.prqb_sc_uom?.value1 || "-",
            qty: parseFloat(row.qty_pr_bahan) || 0,
            stock_gudang_id: row.stock_gudang_id || row.m_rak_d_id || "",
          }),
        );
      } else if (initialValues["Detail Bahan"]) {
        detailArr.value = initialValues["Detail Bahan"].map(
          ({ id, ...row }: any) => ({
            ...row,
            kode: row.m_item?.kode_item || "-",
            nama_material: row.m_item?.nama_item || "-",
            ukuran: Number(row.ukuran ?? row.m_item?.ukuran) || 0,
            uom: row.prqb_sc_uom?.value1 || "-",
            qty: parseFloat(row.qty_pr_bahan) || 0,
            stock_gudang_id: row.stock_gudang_id || row.m_rak_d_id || "",
          }),
        );
      }

      // 🧱 Detail Finish Goods
      if (initialValues.t_purchase_request_subcon_jadis) {
        detailArr2.value = initialValues.t_purchase_request_subcon_jadis.map(
          ({ id, ...row }: any) => ({
            ...row,
            kode: row.m_item?.kode_item || "-",
            nama_item: row.m_item?.nama_item || "-",
            ukuran: Number(row.ukuran ?? row.m_item?.ukuran) || 0,
            uom: row.prqj_sc_uom?.value1 || "-",
            qty: parseFloat(row.qty_pr_jadi) || 0,
          }),
        );
      } else if (initialValues["Detail Finish Goods"]) {
        detailArr2.value = initialValues["Detail Finish Goods"].map(
          ({ id, ...row }: any) => ({
            ...row,
            kode: row.m_item?.kode_item || "-",
            nama_item: row.m_item?.nama_item || "-",
            ukuran: Number(row.ukuran ?? row.m_item?.ukuran) || 0,
            uom: row.prqj_sc_uom?.value1 || "-",
            qty: parseFloat(row.qty_pr_jadi) || 0,
          }),
        );
      }

      // 🧱 Detail Jasa
      if (initialValues.t_purchase_request_subcon_jasas) {
        detailArr3.value = initialValues.t_purchase_request_subcon_jasas.map(
          ({ id, ...row }: any) => ({
            ...row,
            kode: row.m_item?.kode_item || "-",
            nama_jasa: row.m_item?.nama_item || "-",
            uom: row.m_general?.value1 || "-",
            uom_id: row.uom_id || null,
            is_manual:
              row.is_manual === true ||
              row.is_manual === 1 ||
              row.is_manual === "1",
            catatan: row.catatan || "",
            qty: parseFloat(row.qty_pr_jasa) || 0,
          }),
        );
      } else if (initialValues["Detail Jasa"]) {
        detailArr3.value = initialValues["Detail Jasa"].map(
          ({ id, ...row }: any) => ({
            ...row,
            kode: row.m_item?.kode_item || "-",
            nama_jasa: row.m_item?.nama_item || "-",
            uom: row.m_general?.value1 || "-",
            uom_id: row.uom_id || null,
            is_manual:
              row.is_manual === true ||
              row.is_manual === 1 ||
              row.is_manual === "1",
            catatan: row.catatan || "",
            qty: parseFloat(row.qty_pr_jasa) || 0,
          }),
        );
      }
      if (isCopyModeLocal) {
        delete initialValues.id;
        delete initialValues.createdAt;
        delete initialValues.updatedAt;
        initialValues.status = "DRAFT";
      }

      const valueKeys = Object.keys(getDefaultValues());
      const picked = Object.fromEntries(
        valueKeys
          .filter((key) => initialValues[key] !== undefined)
          .map((key) => [key, initialValues[key]]),
      );
      Object.assign(values, picked);

      selectedUnitBisnis.value =
        initialValues.m_unit_bisnis ||
        initialValues.unit_bisnis ||
        selectedUnitBisnis.value;

      if (!isSuperAdmin.value && !values.m_unit_bisnis_id) {
        initializeUnitBisnis();
      }

      // Fetch stock grouped data to populate rak_list for existing detail items.
      if (detailArr.value.length > 0) {
        await enrichDetailRakList();
      }
      syncJasaDetailsWithJenis();

      if (isCopyModeLocal) {
        toast.success("Data berhasil disalin", {
          description:
            "Silakan edit dan simpan sebagai Purchase Request Subcon baru",
        });
      } else {
        toast.success("Data berhasil dimuat");
      }
    } catch (error) {
      toast.error("Gagal memuat data Purchase Request Subcon", {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
        action: {
          label: "Kembali",
          onClick: () =>
            router.push("/purchasing/subcon/t_purchase_request_subcon"),
        },
      });
      setTimeout(
        () => router.push("/purchasing/subcon/t_purchase_request_subcon"),
        2000,
      );
    } finally {
      loading.value = false;
    }
  };

  const validateForm = () => {
    resetErrors();
    let invalid = false;

    if (isSuperAdmin.value && !values.m_unit_bisnis_id?.trim()) {
      errors.m_unit_bisnis_id = "Unit Bisnis wajib dipilih";
      invalid = true;
    }
    if (!values.m_gudang_id?.trim()) {
      errors.m_gudang_id = "Gudang wajib dipilih";
      invalid = true;
    }
    if (!values.jenis_pr_subcon?.trim()) {
      errors.jenis_pr_subcon = "Jenis PR Subcon wajib dipilih";
      invalid = true;
    }
    if (!values.tgl_pr_subcon?.trim()) {
      errors.tgl_pr_subcon = "Tanggal PR Subcon wajib diisi";
      invalid = true;
    }
    if (!values.tgl_butuh?.trim()) {
      errors.tgl_butuh = "Tanggal dibutuhkan wajib diisi";
      invalid = true;
    } else if (
      values.tgl_pr_subcon &&
      values.tgl_butuh < values.tgl_pr_subcon
    ) {
      errors.tgl_butuh =
        "Tanggal dibutuhkan harus lebih besar dari Tanggal PR Subcon";
      invalid = true;
    }

    if (detailArr.value.length === 0) {
      invalid = true;
    }

    if (detailArr2.value.length === 0) {
      invalid = true;
    }

    if (detailArr3.value.length === 0) {
      invalid = true;
    }

    detailArr3.value.forEach((detail) => {
      if (!detail.m_items_id) invalid = true;
      if (!detail.uom_id) invalid = true;
      if (!detail.is_manual && Number(detail.qty) <= 0) invalid = true;
    });

    if (invalid) {
      toast.error("Validasi gagal", {
        description:
          "Mohon lengkapi semua field wajib dan pastikan detail bahan, finish goods, dan jasa sudah sesuai aturan",
      });
      return false;
    }

    return true;
  };

  const validateFreeStockBeforeSave = () => {
    const invalidItems: string[] = [];
    detailArr.value.forEach((d: any, i: number) => {
      const qty = Number(d.qty) || 0;
      const free = Number(d.qty_free_stok) || 0;
      if (qty > free) {
        invalidItems.push(
          `${d.kode || d.nama_material || "Item"} (qty ${qty} > free ${free})`,
        );
      }
    });
    // detailArr2.value.forEach((d: any, i: number) => {
    //   const qty = Number(d.qty) || 0;
    //   const free = Number(d.qty_free_stok) || 0;
    //   if (qty > free) {
    //     invalidItems.push(
    //       `${d.kode || d.nama_item || "Item"} (qty ${qty} > free ${free})`,
    //     );
    //   }
    // });

    if (invalidItems.length > 0) {
      toast.error("Qty melebihi Free Stock", {
        description:
          invalidItems.slice(0, 5).join(", ") +
          (invalidItems.length > 5
            ? `, dan ${invalidItems.length - 5} item lainnya`
            : ""),
      });
      return false;
    }

    return true;
  };

  const proceedSave = async () => {
    loading.value = true;
    try {
      const payload = {
        m_unit_bisnis_id: values.m_unit_bisnis_id?.trim() || null,
        m_gudang_id: values.m_gudang_id?.trim() || null,
        jenis_pr_subcon: values.jenis_pr_subcon?.trim() || null,
        tgl_pr_subcon: values.tgl_pr_subcon?.trim() || null,
        no_pr_subcon: values.no_pr_subcon?.trim() || null,
        tgl_butuh: values.tgl_butuh?.trim() || null,
        catatan: values.catatan?.trim() || null,
        status: values.status || "DRAFT",
        is_active: values.is_active,
        t_purchase_request_subcon_bahan:
          detailArr.value.map(mapDetailBahanToDb),
        t_purchase_request_subcon_jadi: detailArr2.value.map(mapDetailJadiToDb),
        t_purchase_request_subcon_jasa: detailArr3.value.map(mapDetailJasaToDb),
        created_by: authStore.user?.id || null,
        ...(isEditMode.value && { updated_by: authStore.user?.id || null }),
      };

      if (isEditMode.value) {
        await updatePurchaseRequestSubcon(menuId.value, payload as any);
        toast.success("Purchase Request Subcon berhasil diperbarui", {
          description: `No. PR Subcon "${values.no_pr_subcon}" telah diperbarui`,
        });
      } else {
        await createPurchaseRequestSubcon(payload as any);
        toast.success("Purchase Request Subcon berhasil dibuat", {
          description: `No. PR Subcon "${values.no_pr_subcon}" telah ditambahkan`,
        });
      }

      router.replace(
        "/purchasing/subcon/t_purchase_request_subcon?reload=" + Date.now(),
      );
    } catch (error) {
      toast.error(
        isEditMode.value
          ? "Gagal memperbarui Purchase Request Subcon"
          : "Gagal membuat Purchase Request Subcon",
        {
          description:
            error instanceof Error ? error.message : "Terjadi kesalahan",
        },
      );
    } finally {
      loading.value = false;
    }
  };

  const handlePotongDialogConfirm = async () => {
    const action = pendingPotongSaveAction.value;
    closePotongDialog();
    if (action) {
      await action();
    }
  };

  const handlePotongDialogClose = () => {
    closePotongDialog();
  };

  const onSave = async () => {
    if (isReadOnly.value) {
      toast.error("Data tidak dapat diedit", {
        description: `Status "${values.status}" tidak mengizinkan perubahan data`,
      });
      return;
    }
    if (!validateForm()) return;
    if (!validateFreeStockBeforeSave()) return;

    const potongValidation = validatePotongBeforeSave();
    if (potongValidation.status === "blocked") {
      openPotongDialog({
        type: "danger",
        title: potongValidation.title,
        description:
          "Data hasil potong berada di luar batas toleransi dan tidak bisa disimpan.",
        summary: buildPotongDialogSummary(potongValidation),
        finishGoods: potongValidation.finishGoodsDetails,
        confirmText: "Tutup",
      });
      return;
    }

    if (potongValidation.status === "warning") {
      openPotongDialog({
        type: "info",
        title: potongValidation.title,
        description:
          "Data hasil potong masih sesuai batas toleransi. Pastikan ringkasannya sudah benar sebelum melanjutkan simpan.",
        summary: buildPotongDialogSummary(potongValidation),
        finishGoods: potongValidation.finishGoodsDetails,
        confirmText: "Yakin Simpan",
        onConfirm: proceedSave,
      });
      return;
    }

    await proceedSave();
  };

  const handleCancel = () => {
    router.push("/purchasing/subcon/t_purchase_request_subcon");
  };

  watch(
    () => values.jenis_pr_subcon,
    () => {
      syncJasaDetailsWithJenis();
    },
  );

  watch(
    () => values.m_unit_bisnis_id,
    async (unitBisnisId) => {
      if (!unitBisnisId) {
        selectedUnitBisnis.value = null;
        return;
      }

      if (
        String(selectedUnitBisnis.value?.id || "") === String(unitBisnisId) &&
        selectedUnitBisnis.value?.m_company
      ) {
        return;
      }

      const unitBisnis = await fetchUnitBisnisById(unitBisnisId);
      selectedUnitBisnis.value = unitBisnis;
    },
  );

  onBeforeMount(async () => {
    onReset();
    await loadGeneralLookups();
    await loadFormData();
  });

  const fetchStockItemGrouped = async () => {
    if (!values.m_unit_bisnis_id || !values.m_gudang_id) return [];

    const params = new URLSearchParams({
      searchfield: "kode_item,nama_item,tipe_name,nama_gudang",
      filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
      filter_column_m_gudang_id: values.m_gudang_id,
      paginate: "100",
    });

    let page = 1;
    const items: any[] = [];

    while (true) {
      params.set("page", String(page));
      const response = await fetch(
        `${API_BASE_URL}/fn/stock_gudang/stock_item_grouped?${params.toString()}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authStore.token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Gagal memuat data stok gudang");
      }

      const json = await response.json();
      if (Array.isArray(json?.data)) {
        items.push(...json.data);
      }

      const nextPage = json?.pagination?.next_page;
      if (!nextPage || nextPage === page) break;
      page = nextPage;
    }

    return items;
  };

  const enrichDetailRakList = async () => {
    try {
      const stockItems = await fetchStockItemGrouped();
      if (!stockItems.length) return;

      const stockMap = new Map(
        stockItems
          .map((item: any) =>
            getStockItemKey(item, values.m_gudang_id)
              ? [getStockItemKey(item, values.m_gudang_id), item]
              : null,
          )
          .filter(Boolean) as [string, any][],
      );
      detailArr.value = detailArr.value.map((detail) => {
        const key = getStockItemKey(detail, values.m_gudang_id);
        const stockItem = key ? stockMap.get(key) : undefined;
        const rakList = filterAvailableRakList(stockItem?.rak_list || []);
        const matchedRak = resolveSelectedRak(rakList, detail.stock_gudang_id);
        return {
          ...detail,
          stock_gudang_id: matchedRak?.stock_gudang_id || null,
          rak_list: rakList,
          qty_free_stok:
            Number(
              matchedRak?.qty_free_stok ??
                matchedRak?.free_stock ??
                detail.qty_free_stok,
            ) || 0,
        };
      });
    } catch (error) {
      toast.error("Gagal memuat data rak", {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      });
    }
  };

  return {
    API_BASE_URL,
    authStore,
    loading,
    values,
    errors,
    detailArr,
    detailArr2,
    detailArr3,
    jenisPrSubconLabel,
    isJenisPrSepuh,
    isJenisPrPotong,
    canUseManualJasa,
    isEditMode,
    isViewMode,
    isCopyMode,
    isReadOnly,
    isSuperAdmin,
    auditMeta,
    unitBisnisNameDisplay,
    selectedCompanyNameDisplay,
    handleUnitBisnisSelected,
    pageTitle,
    pageDescription,
    addDetailArr,
    removeDetailArr,
    addDetailArr2,
    removeDetailArr2,
    clearDetailArr2,
    addDetailArr3,
    removeDetailArr3,
    mapDetailBahan,
    mapDetailFinishGoods,
    mapDetailJasa,
    syncJasaDetailsWithJenis,
    potongDialogOpen,
    potongDialogType,
    potongDialogTitle,
    potongDialogDescription,
    potongDialogConfirmText,
    potongDialogSummary,
    potongDialogFinishGoods,
    handlePotongDialogConfirm,
    handlePotongDialogClose,
    onReset,
    onSave,
    handleCancel,
  };
}
