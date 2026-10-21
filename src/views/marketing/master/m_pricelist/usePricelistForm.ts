import { computed, onBeforeMount, reactive, ref } from "vue";
import { useAuthStore } from "@/stores/auth";
import { toast } from "vue-sonner";
import { useApi } from "@/composables/useApi";
import {
  exportPricelistExcel,
  getPricelistHistory,
  savePricelist,
  uploadPricelistExcel,
  type PricelistImportErrorItem,
  type PricelistImportResponse,
  type PricelistImportSuccessItem,
  type PricelistPagination,
  type PricelistServiceFilterInput,
} from "./service";

export interface PricelistFilterValues {
  unit_bisnis_id: string;
  kategori_id: string;
  group1_id: string;
  group2_id: string;
  group3_id: string;
  group4_id: string;
  group5_id: string;
  group6_id: string;
}

export interface PricelistItemOption {
  id: string;
  items_id: string;
  pricelist_id: string;
  kode_item: string;
  nama_item: string;
  qty_konversi: number;
  uom_id: string;
  uom_nama: string;
  konversi_label: string;
  harga_jual: number;
  hpp: number;
  max_disc_cust_1: number;
  max_disc_cust_2: number;
  max_disc_cust_3: number;
  max_disc_bi_1: number;
  max_disc_bi_2: number;
  max_disc_bi_3: number;
}

export interface PricelistDetailRow extends PricelistItemOption {
  row_id: string;
  selected: boolean;
}

export interface PricelistBulkUpdateValues {
  harga_jual: string;
  max_disc_cust_1: string;
  max_disc_cust_2: string;
  max_disc_cust_3: string;
  max_disc_bi_1: string;
  max_disc_bi_2: string;
  max_disc_bi_3: string;
}

export type ProcessingStage =
  | "idle"
  | "preparing"
  | "validating"
  | "saving"
  | "success"
  | "error";

export interface ProcessDialogSummary {
  itemCount: number;
  updatedFields: string[];
  previewItems: string[];
}

export interface PricelistHistoryRow {
  id: string;
  tanggal_berlaku: string;
  hpp: number;
  harga_jual: number;
  max_disc_cust_1: number;
  max_disc_cust_2: number;
  max_disc_cust_3: number;
  max_disc_bi_1: number;
  max_disc_bi_2: number;
  max_disc_bi_3: number;
}

export interface PricelistPayloadItem {
  [key: string]: unknown;
  created_by?: string;
  items_id?: string;
  qty_konversi?: number;
  uom_id?: string;
  harga_jual?: number;
  hpp?: number;
  max_disc_cust_1?: number;
  max_disc_cust_2?: number;
  max_disc_cust_3?: number;
  max_disc_bi_1?: number;
  max_disc_bi_2?: number;
  max_disc_bi_3?: number;
}

interface SelectRespoPayload {
  companyId?: string;
  m_unit_bisnis_id?: string;
  companyName?: string;
  nama_comp?: string;
}

interface BulkOperationContext {
  updatedRows: PricelistDetailRow[];
  summary: ProcessDialogSummary;
}

const FILTER_DEFAULTS: PricelistFilterValues = {
  unit_bisnis_id: "",
  kategori_id: "",
  group1_id: "",
  group2_id: "",
  group3_id: "",
  group4_id: "",
  group5_id: "",
  group6_id: "",
};

const BULK_DEFAULTS: PricelistBulkUpdateValues = {
  harga_jual: "",
  max_disc_cust_1: "",
  max_disc_cust_2: "",
  max_disc_cust_3: "",
  max_disc_bi_1: "",
  max_disc_bi_2: "",
  max_disc_bi_3: "",
};

const PROCESS_DEFAULT_MESSAGE =
  "Menyiapkan proses penyimpanan pricelist.";
const IMPORT_DEFAULT_MESSAGE =
  "Menyiapkan file excel untuk divalidasi.";

const GROUP_FILTERS = [
  { key: "group1", group: "GROUP_ITEM_1", searchfield: "value1" },
  { key: "group2", group: "GROUP_ITEM_2", searchfield: "value1" },
  { key: "group3", group: "GROUP_ITEM_3", searchfield: "value1" },
  { key: "group4", group: "GROUP_ITEM_4", searchfield: "value1" },
  { key: "group5", group: "GROUP_ITEM_5", searchfield: "value1" },
  { key: "group6", group: "GROUP_ITEM_6", searchfield: "value1" },
] as const;

const BULK_FIELD_LABELS: Record<keyof PricelistBulkUpdateValues, string> = {
  harga_jual: "Harga Jual",
  max_disc_cust_1: "Disc. Customer 1",
  max_disc_cust_2: "Disc. Customer 2",
  max_disc_cust_3: "Disc. Customer 3",
  max_disc_bi_1: "Disc. Bisnis Unit 1",
  max_disc_bi_2: "Disc. Bisnis Unit 2",
  max_disc_bi_3: "Disc. Bisnis Unit 3",
};

const BULK_PROGRESS_DELAY = 240;

const toNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const toStringValue = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
};

const createRowId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `row-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

const mapItemToOption = (
  item: Record<string, unknown>,
): PricelistItemOption => {
  const itemsId =
    toStringValue(item.items_id) || toStringValue(item.id) || createRowId();
  const qtyKonversi =
    toNumber(item.qty_konversi) ||
    toNumber(item.qty) ||
    toNumber(item.konversi_qty) ||
    1;
  const uomName =
    toStringValue(item.uom_nama) ||
    toStringValue(item.nama_uom) ||
    toStringValue(item.uom_label) ||
    toStringValue(item.uom);

  return {
    id: toStringValue(item.id) || itemsId,
    items_id: itemsId,
    pricelist_id:
      toStringValue(item.pricelist_id) || toStringValue(item.m_pricelist_id),
    kode_item: toStringValue(item.kode_item) || toStringValue(item.kode) || "-",
    nama_item: toStringValue(item.nama_item) || toStringValue(item.nama) || "-",
    qty_konversi: qtyKonversi,
    uom_id: toStringValue(item.uom_id),
    uom_nama: uomName,
    konversi_label:
      toStringValue(item.konversi_label) ||
      `${qtyKonversi} ${uomName || "PCS"}`.trim(),
    harga_jual: toNumber(item.harga_jual),
    hpp: toNumber(item.hpp),
    max_disc_cust_1: toNumber(item.max_disc_cust_1),
    max_disc_cust_2: toNumber(item.max_disc_cust_2),
    max_disc_cust_3: toNumber(item.max_disc_cust_3),
    max_disc_bi_1: toNumber(item.max_disc_bi_1),
    max_disc_bi_2: toNumber(item.max_disc_bi_2),
    max_disc_bi_3: toNumber(item.max_disc_bi_3),
  };
};

const mapHistoryRow = (item: Record<string, unknown>): PricelistHistoryRow => ({
  id: toStringValue(item.id) || createRowId(),
  tanggal_berlaku:
    toStringValue(item.tanggal_berlaku) || toStringValue(item.createdAt) || "-",
  hpp: toNumber(item.hpp),
  harga_jual: toNumber(item.harga_jual),
  max_disc_cust_1: toNumber(item.max_disc_cust_1),
  max_disc_cust_2: toNumber(item.max_disc_cust_2),
  max_disc_cust_3: toNumber(item.max_disc_cust_3),
  max_disc_bi_1: toNumber(item.max_disc_bi_1),
  max_disc_bi_2: toNumber(item.max_disc_bi_2),
  max_disc_bi_3: toNumber(item.max_disc_bi_3),
});

const getSelectRespoDefaults = (): {
  unitBisnisId: string;
  companyName: string;
} => {
  try {
    const selectRespo = localStorage.getItem("SelectRespo");
    if (!selectRespo) {
      return { unitBisnisId: "", companyName: "-" };
    }

    const parsed = JSON.parse(selectRespo) as SelectRespoPayload;

    return {
      unitBisnisId:
        toStringValue(parsed.companyId) ||
        toStringValue(parsed.m_unit_bisnis_id),
      companyName:
        toStringValue(parsed.companyName) ||
        toStringValue(parsed.nama_comp) ||
        "-",
    };
  } catch {
    return { unitBisnisId: "", companyName: "-" };
  }
};

const createSummaryFromRows = (
  rows: PricelistDetailRow[],
  fields: string[],
): ProcessDialogSummary => ({
  itemCount: rows.length,
  updatedFields: fields,
  previewItems: rows
    .slice(0, 3)
    .map((row) => `${row.kode_item} - ${row.nama_item}`),
});

const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
};

export function usePricelistForm() {
  const authStore = useAuthStore();
  const { API_BASE_URL } = useApi();
  const filters = reactive<PricelistFilterValues>({ ...FILTER_DEFAULTS });
  const bulkValues = reactive<PricelistBulkUpdateValues>({ ...BULK_DEFAULTS });
  const detailRows = ref<PricelistDetailRow[]>([]);
  const detailSearch = ref("");
  const saving = ref(false);
  const uploading = ref(false);
  const exporting = ref(false);
  const historyLoading = ref(false);

  const bulkDialogOpen = ref(false);
  const bulkProcessingOpen = ref(false);
  const bulkProcessing = ref(false);
  const bulkProcessingStage = ref<ProcessingStage>("idle");
  const bulkProcessingMessage = ref(
    "Siapkan perubahan yang ingin diterapkan ke item terpilih.",
  );
  const bulkProcessingError = ref("");
  const bulkProcessingSummary = ref<ProcessDialogSummary>({
    itemCount: 0,
    updatedFields: [],
    previewItems: [],
  });

  const saveProcessingOpen = ref(false);
  const saveProcessing = ref(false);
  const saveProcessingStage = ref<ProcessingStage>("idle");
  const saveProcessingMessage = ref(PROCESS_DEFAULT_MESSAGE);
  const saveProcessingError = ref("");
  const saveProcessingSummary = ref<ProcessDialogSummary>({
    itemCount: 0,
    updatedFields: [],
    previewItems: [],
  });

  const importProcessingOpen = ref(false);
  const importProcessing = ref(false);
  const importProcessingStage = ref<ProcessingStage>("idle");
  const importProcessingMessage = ref(IMPORT_DEFAULT_MESSAGE);
  const importProcessingError = ref("");
  const importProcessingSummary = ref<ProcessDialogSummary>({
    itemCount: 0,
    updatedFields: ["Harga Jual", "HPP", "Diskon Customer", "Diskon Bisnis Unit"],
    previewItems: [],
  });
  const importResultOpen = ref(false);
  const importErrors = ref<PricelistImportErrorItem[]>([]);
  const importErrorMessage = ref("");
  const lastImportFile = ref<File | null>(null);

  const historyDialogOpen = ref(false);
  const historyRows = ref<PricelistHistoryRow[]>([]);
  const historyItemName = ref("");
  const historyItemCode = ref("");
  const historyItemId = ref("");
  const historyPricelistId = ref("");
  const historyPagination = reactive<PricelistPagination>({
    page: 1,
    paginate: 10,
    total: 0,
    total_pages: 1,
  });
  const lastBulkOperation = ref<BulkOperationContext | null>(null);

  const isSuperAdmin = computed(() => {
    const user = authStore.user;
    if (!user || !user.tipe) return false;
    return user.tipe.value1?.toUpperCase() === "SUPER ADMIN";
  });

  const disableSelectItem = computed(() => {
    const hasFilter =
      filters.unit_bisnis_id || filters.kategori_id || filters.group1_id;
    return !hasFilter;
  });

  const canSave = computed(() => detailRows.value.length > 0);

  const companyNameDisplay = computed(() => {
    if (!isSuperAdmin.value) {
      return getSelectRespoDefaults().companyName;
    }
    return "-";
  });

  const normalizedFilters = computed<PricelistServiceFilterInput>(() => ({
    unit_bisnis_id: filters.unit_bisnis_id,
    kategori_id: filters.kategori_id,
    group1_id: filters.group1_id,
    group2_id: filters.group2_id,
    group3_id: filters.group3_id,
    group4_id: filters.group4_id,
    group5_id: filters.group5_id,
    group6_id: filters.group6_id,
  }));

  const itemPickerApi = computed(() => ({
    url: `${API_BASE_URL}/fn/m_pricelist/itemPriceList`,
    params: {
      ...(normalizedFilters.value.unit_bisnis_id && {
        unit_bisnis_id: normalizedFilters.value.unit_bisnis_id,
      }),
      ...(normalizedFilters.value.kategori_id && {
        filter_column_kategori_id: normalizedFilters.value.kategori_id,
      }),
      ...(normalizedFilters.value.group1_id && {
        filter_column_group1_id: normalizedFilters.value.group1_id,
      }),
      ...(normalizedFilters.value.group2_id && {
        filter_column_group2_id: normalizedFilters.value.group2_id,
      }),
      ...(normalizedFilters.value.group3_id && {
        filter_column_group3_id: normalizedFilters.value.group3_id,
      }),
      ...(normalizedFilters.value.group4_id && {
        filter_column_group4_id: normalizedFilters.value.group4_id,
      }),
      ...(normalizedFilters.value.group5_id && {
        filter_column_group5_id: normalizedFilters.value.group5_id,
      }),
      ...(normalizedFilters.value.group6_id && {
        filter_column_group6_id: normalizedFilters.value.group6_id,
      }),
    },
  }));

  const itemPickerColumns = [
    { label: "Kode Item", key: "kode_item" },
    { label: "Nama Item", key: "nama_item" },
    {
      label: "Kategori",
      key: "kategori",
      render: (item: Record<string, unknown>) =>
        (item.kategori as { value1?: string } | null)?.value1 || "-",
    },
    {
      label: "Tipe",
      key: "mi_tipe",
      render: (item: Record<string, unknown>) =>
        (item.mi_tipe as { value1?: string } | null)?.value1 || "-",
    },
    {
      label: "Active",
      key: "is_active",
      render: (item: Record<string, unknown>) =>
        item.is_active ? "Yes" : "No",
    },
  ];

  const excludeItemIds = computed(() =>
    detailRows.value.map((row) => row.items_id || row.id),
  );

  const selectedRowCount = computed(
    () => detailRows.value.filter((row) => row.selected).length,
  );

  const filteredDetailRows = computed(() => {
    const keyword = detailSearch.value.trim().toLowerCase();

    if (!keyword) {
      return detailRows.value;
    }

    return detailRows.value.filter((row) => {
      const namaItem = row.nama_item.toLowerCase();
      const kodeItem = row.kode_item.toLowerCase();

      return namaItem.includes(keyword) || kodeItem.includes(keyword);
    });
  });

  const historyPageItems = computed(() => {
    const totalPages = Math.max(historyPagination.total_pages, 1);
    const currentPage = historyPagination.page;
    const pages = new Set<number>([1, totalPages, currentPage]);

    for (let offset = 1; offset <= 1; offset += 1) {
      if (currentPage - offset > 1) pages.add(currentPage - offset);
      if (currentPage + offset < totalPages) pages.add(currentPage + offset);
    }

    return Array.from(pages)
      .sort((a, b) => a - b)
      .reduce<Array<{ type: "page" | "ellipsis"; value: number }>>(
        (acc, page, index, array) => {
          const previousPage = array[index - 1];

          if (previousPage !== undefined && page - previousPage > 1) {
            acc.push({ type: "ellipsis", value: page });
          }

          acc.push({ type: "page", value: page });
          return acc;
        },
        [],
      );
  });

  const allSelected = computed({
    get: () =>
      detailRows.value.length > 0 &&
      detailRows.value.every((row) => row.selected === true),
    set: (value: boolean) => {
      detailRows.value = detailRows.value.map((row) => ({
        ...row,
        selected: value,
      }));
    },
  });

  const filterApis: Record<
    string,
    {
      url: string;
      headers: { "Content-Type": string };
      params: Record<string, string>;
    }
  > = {
    unitBisnis: {
      url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
      headers: { "Content-Type": "application/json" },
      params: {
        searchfield: "nama_comp",
        no_pagination: "true",
        filter_column_is_active: "true",
      },
    },
    kategori: {
      url: `${API_BASE_URL}/dynamic/m_general`,
      headers: { "Content-Type": "application/json" },
      params: {
        searchfield: "value1",
        filter_column_group: "TIPE_ITEM",
        no_pagination: "true",
        filter_column_is_active: "true",
        filter_column_value1: "JASA",
        filter_operator_value1: "<>",
      },
    },
    ...Object.fromEntries(
      GROUP_FILTERS.map((entry) => [
        entry.key,
        {
          url: `${API_BASE_URL}/dynamic/m_general`,
          headers: { "Content-Type": "application/json" },
          params: {
            searchfield: entry.searchfield,
            filter_column_group: entry.group,
            no_pagination: "true",
            filter_column_is_active: "true",
          },
        },
      ]),
    ),
  };

  const buildPayloadFromRows = (
    rows: PricelistDetailRow[],
  ): PricelistPayloadItem[] =>
    rows.map((row) => ({
      created_by: toStringValue(authStore.user?.id) || undefined,
      items_id: row.items_id,
      qty_konversi: row.qty_konversi,
      uom_id: row.uom_id,
      harga_jual: row.harga_jual,
      hpp: row.hpp,
      max_disc_cust_1: row.max_disc_cust_1,
      max_disc_cust_2: row.max_disc_cust_2,
      max_disc_cust_3: row.max_disc_cust_3,
      max_disc_bi_1: row.max_disc_bi_1,
      max_disc_bi_2: row.max_disc_bi_2,
      max_disc_bi_3: row.max_disc_bi_3,
    }));

  const buildPayload = (): PricelistPayloadItem[] =>
    buildPayloadFromRows(detailRows.value);

  const delay = (ms = BULK_PROGRESS_DELAY) =>
    new Promise((resolve) => window.setTimeout(resolve, ms));

  const getSelectedRows = () => detailRows.value.filter((row) => row.selected);

  const getBulkUpdates = () =>
    Object.entries(bulkValues).filter(
      ([, value]) => value !== "",
    ) as Array<[keyof PricelistBulkUpdateValues, string]>;

  const createUpdatedRows = (
    rows: PricelistDetailRow[],
    updates: Array<[keyof PricelistBulkUpdateValues, string]>,
  ) =>
    rows.map((row) => {
      const nextRow = { ...row };

      updates.forEach(([key, value]) => {
        nextRow[key as keyof PricelistDetailRow] = toNumber(value) as never;
      });

      return nextRow;
    });

  const syncRowsAfterBulkSave = (updatedRows: PricelistDetailRow[]) => {
    const updatedMap = new Map(updatedRows.map((row) => [row.row_id, row]));

    detailRows.value = detailRows.value.map((row) => {
      const updated = updatedMap.get(row.row_id);
      return updated ? { ...updated, selected: false } : row;
    });
  };

  const applyImportedRows = (rows: PricelistImportSuccessItem[]) => {
    detailRows.value = rows.map((item) => ({
      ...mapItemToOption(item as unknown as Record<string, unknown>),
      row_id: createRowId(),
      selected: false,
    }));
  };

  const setBulkProcessingState = (
    stage: ProcessingStage,
    message: string,
  ) => {
    bulkProcessingStage.value = stage;
    bulkProcessingMessage.value = message;
  };

  const setSaveProcessingState = (
    stage: ProcessingStage,
    message: string,
  ) => {
    saveProcessingStage.value = stage;
    saveProcessingMessage.value = message;
  };

  const setImportProcessingState = (
    stage: ProcessingStage,
    message: string,
  ) => {
    importProcessingStage.value = stage;
    importProcessingMessage.value = message;
  };

  const createBulkSummary = (
    rows: PricelistDetailRow[],
    updates: Array<[keyof PricelistBulkUpdateValues, string]>,
  ): ProcessDialogSummary =>
    createSummaryFromRows(
      rows,
      updates.map(([key]) => BULK_FIELD_LABELS[key]),
    );

  const runBulkOperation = async (operation: BulkOperationContext) => {
    bulkProcessingOpen.value = true;
    bulkProcessing.value = true;
    bulkProcessingError.value = "";
    bulkProcessingSummary.value = operation.summary;
    setBulkProcessingState(
      "preparing",
      "Menyiapkan perubahan untuk item terpilih...",
    );
    await delay();
    setBulkProcessingState(
      "validating",
      `Memvalidasi ${operation.summary.itemCount} item yang akan diperbarui...`,
    );
    await delay();
    setBulkProcessingState("saving", "Menyimpan perubahan ke server...");

    try {
      await savePricelist(buildPayloadFromRows(operation.updatedRows));
      syncRowsAfterBulkSave(operation.updatedRows);
      Object.assign(bulkValues, BULK_DEFAULTS);
      lastBulkOperation.value = operation;
      setBulkProcessingState("success", "Bulk update berhasil disimpan.");
      toast.success("Bulk update berhasil disimpan");
      await delay(900);
      bulkProcessingOpen.value = false;
    } catch (error) {
      bulkProcessingError.value =
        error instanceof Error ? error.message : "Gagal menyimpan bulk update";
      setBulkProcessingState(
        "error",
        "Proses bulk update belum berhasil. Silakan coba lagi.",
      );
      throw error;
    } finally {
      bulkProcessing.value = false;
    }
  };

  const runSaveOperation = async (rows: PricelistDetailRow[]) => {
    const summary = createSummaryFromRows(rows, [
      "Harga Jual",
      "HPP",
      "Diskon Customer",
      "Diskon Bisnis Unit",
    ]);

    saveProcessingOpen.value = true;
    saveProcessing.value = true;
    saveProcessingError.value = "";
    saveProcessingSummary.value = summary;
    setSaveProcessingState("preparing", "Menyiapkan data pricelist...");
    await delay();
    setSaveProcessingState(
      "validating",
      `Memvalidasi ${summary.itemCount} item sebelum disimpan...`,
    );
    await delay();
    setSaveProcessingState("saving", "Menyimpan pricelist ke server...");

    try {
      await savePricelist(buildPayloadFromRows(rows));
      setSaveProcessingState("success", "Pricelist berhasil disimpan.");
      toast.success("Pricelist berhasil disimpan");
      await delay(900);
      saveProcessingOpen.value = false;
    } catch (error) {
      saveProcessingError.value =
        error instanceof Error ? error.message : "Gagal simpan pricelist";
      setSaveProcessingState(
        "error",
        "Penyimpanan pricelist belum berhasil. Silakan coba lagi.",
      );
      throw error;
    } finally {
      saveProcessing.value = false;
    }
  };

  const runImportOperation = async (file: File) => {
    const formData = new FormData();
    formData.append("excelImport", file);

    importProcessingOpen.value = true;
    importProcessing.value = true;
    importProcessingError.value = "";
    importErrors.value = [];
    importErrorMessage.value = "";
    importResultOpen.value = false;
    lastImportFile.value = file;
    setImportProcessingState("preparing", "Menyiapkan file excel untuk diproses...");
    await delay();
    setImportProcessingState("validating", "Memvalidasi isi file excel...");
    await delay();
    setImportProcessingState("saving", "Mengirim file import ke server...");

    try {
      const response = await uploadPricelistExcel<PricelistImportResponse>(
        formData,
        normalizedFilters.value,
      );

      const importedRows = Array.isArray(response?.data) ? response.data : [];
      importProcessingSummary.value = createSummaryFromRows(
        importedRows.map((item) => ({
          ...mapItemToOption(item as unknown as Record<string, unknown>),
          row_id: createRowId(),
          selected: false,
        })),
        ["Harga Jual", "HPP", "Diskon Customer", "Diskon Bisnis Unit"],
      );

      applyImportedRows(importedRows);
      setImportProcessingState(
        "success",
        response?.message || "Import excel berhasil disimpan.",
      );
      toast.success(response?.message || "Import excel berhasil disimpan");
      await delay(900);
      importProcessingOpen.value = false;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal upload excel";
      const errorPayload =
        (
          error as {
            response?: { data?: Partial<PricelistImportResponse> };
            errors?: PricelistImportResponse["errors"];
            message?: string;
          }
        )?.response?.data ??
        {
          errors: (
            error as {
              errors?: PricelistImportResponse["errors"];
            }
          )?.errors,
          message: (
            error as {
              message?: string;
            }
          )?.message,
        };

      importErrors.value = Array.isArray(errorPayload?.errors)
        ? errorPayload.errors
        : [];
      importErrorMessage.value =
        errorPayload?.message || message || "Import excel gagal diproses.";
      importProcessingError.value = importErrorMessage.value;
      setImportProcessingState(
        "error",
        "Import excel perlu diperiksa ulang sebelum dilanjutkan.",
      );
      if (importErrors.value.length > 0 || importErrorMessage.value) {
        importResultOpen.value = true;
      }
      throw error;
    } finally {
      importProcessing.value = false;
    }
  };

  const handleItemsAdded = (items: Record<string, unknown>[]) => {
    const mapped = items.map(mapItemToOption);
    const existing = new Set(detailRows.value.map((row) => row.items_id));
    const freshRows = mapped
      .filter((item) => !existing.has(item.items_id))
      .map((item) => ({
        ...item,
        row_id: createRowId(),
        selected: false,
      }));

    if (freshRows.length === 0) {
      toast.info("Item sudah ada di detail");
      return;
    }

    detailRows.value = [...detailRows.value, ...freshRows];
    toast.success(`${freshRows.length} item ditambahkan`);
  };

  const updateRowValue = (
    rowId: string,
    key: keyof PricelistDetailRow,
    value: string | number,
  ) => {
    detailRows.value = detailRows.value.map((row) =>
      row.row_id === rowId
        ? {
            ...row,
            [key]:
              typeof row[key] === "number"
                ? toNumber(value)
                : typeof value === "number"
                  ? String(value)
                  : value,
          }
        : row,
    );
  };

  const toggleRowSelection = (rowId: string, checked: boolean) => {
    detailRows.value = detailRows.value.map((row) =>
      row.row_id === rowId ? { ...row, selected: checked } : row,
    );
  };

  const removeRow = (rowId: string) => {
    detailRows.value = detailRows.value.filter((row) => row.row_id !== rowId);
  };

  const resetDetailRows = () => {
    if (detailRows.value.length === 0) {
      toast.info("Belum ada item untuk direset");
      return;
    }

    detailRows.value = [];
    detailSearch.value = "";
    bulkDialogOpen.value = false;
    bulkProcessingOpen.value = false;
    saveProcessingOpen.value = false;
    importProcessingOpen.value = false;
    importResultOpen.value = false;
    bulkProcessingError.value = "";
    saveProcessingError.value = "";
    importProcessingError.value = "";
    importErrors.value = [];
    importErrorMessage.value = "";
    bulkProcessingStage.value = "idle";
    saveProcessingStage.value = "idle";
    importProcessingStage.value = "idle";
    bulkProcessingMessage.value =
      "Siapkan perubahan yang ingin diterapkan ke item terpilih.";
    saveProcessingMessage.value = PROCESS_DEFAULT_MESSAGE;
    importProcessingMessage.value = IMPORT_DEFAULT_MESSAGE;
    lastBulkOperation.value = null;
    lastImportFile.value = null;
    Object.assign(bulkValues, BULK_DEFAULTS);
    toast.success("Semua item detail berhasil direset");
  };

  const openBulkDialog = () => {
    if (selectedRowCount.value === 0) {
      toast.error("Pilih minimal 1 item");
      return;
    }

    Object.assign(bulkValues, BULK_DEFAULTS);
    bulkDialogOpen.value = true;
  };

  const applyBulkUpdate = async () => {
    const selectedRows = getSelectedRows();

    if (selectedRows.length === 0) {
      toast.error("Tidak ada item terpilih");
      return;
    }

    const updates = getBulkUpdates();

    if (updates.length === 0) {
      toast.error("Isi minimal 1 field update massal");
      return;
    }

    bulkDialogOpen.value = false;
    const operation: BulkOperationContext = {
      updatedRows: createUpdatedRows(selectedRows, updates),
      summary: createBulkSummary(selectedRows, updates),
    };

    lastBulkOperation.value = operation;

    try {
      await runBulkOperation(operation);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan bulk update",
      );
    }
  };

  const retryBulkUpdate = async () => {
    if (!lastBulkOperation.value || bulkProcessing.value) {
      return;
    }

    try {
      await runBulkOperation(lastBulkOperation.value);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan bulk update",
      );
    }
  };

  const retryImportExcel = async () => {
    if (!lastImportFile.value || importProcessing.value) {
      return;
    }

    try {
      await runImportOperation(lastImportFile.value);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal upload excel",
      );
    }
  };

  const syncHistoryPagination = (
    pagination?: Partial<PricelistPagination> | null,
  ) => {
    const paginationRecord = (pagination ?? {}) as Record<string, unknown>;
    const page =
      toNumber(pagination?.page) ||
      toNumber(paginationRecord.current_page) ||
      1;
    const paginate =
      toNumber(pagination?.paginate) ||
      toNumber(paginationRecord.per_page) ||
      toNumber(paginationRecord.limit) ||
      10;
    const total =
      toNumber(pagination?.total) || toNumber(paginationRecord.total_data);
    const totalPages =
      toNumber(pagination?.total_pages) ||
      toNumber(paginationRecord.last_page) ||
      toNumber(paginationRecord.pageCount) ||
      (paginate > 0 && total > 0 ? Math.ceil(total / paginate) : 1);

    historyPagination.page = page;
    historyPagination.paginate = paginate;
    historyPagination.total = total;
    historyPagination.total_pages = Math.max(totalPages, 1);
  };

  const fetchHistory = async (page = 1) => {
    historyLoading.value = true;

    try {
      const response = await getPricelistHistory<Record<string, unknown>[]>({
        itemsId: historyItemId.value,
        pricelistId: historyPricelistId.value || undefined,
        page,
        paginate: historyPagination.paginate,
      });

      historyRows.value = Array.isArray(response?.data)
        ? response.data.map(mapHistoryRow)
        : [];

      syncHistoryPagination(response?.pagination ?? response?.meta);
    } catch (error) {
      historyRows.value = [];
      syncHistoryPagination({
        page,
        paginate: historyPagination.paginate,
        total: 0,
        total_pages: 1,
      });
      toast.error(
        error instanceof Error ? error.message : "Gagal memuat history",
      );
    } finally {
      historyLoading.value = false;
    }
  };

  const openHistoryDialog = async (row: PricelistDetailRow) => {
    historyDialogOpen.value = true;
    historyItemName.value = row.nama_item;
    historyItemCode.value = row.kode_item;
    historyItemId.value = row.items_id;
    historyPricelistId.value = row.pricelist_id || row.id;
    historyPagination.page = 1;
    historyPagination.total = 0;
    historyPagination.total_pages = 1;
    await fetchHistory(1);
  };

  const handleHistoryPageChange = async (page: number) => {
    if (
      page < 1 ||
      page > historyPagination.total_pages ||
      page === historyPagination.page ||
      historyLoading.value
    ) {
      return;
    }

    await fetchHistory(page);
  };

  const handleSave = async () => {
    if (detailRows.value.length === 0) {
      toast.error("Detail pricelist masih kosong");
      return;
    }

    saving.value = true;

    try {
      await runSaveOperation(detailRows.value);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal simpan");
    } finally {
      saving.value = false;
    }
  };

  const handleExportExcel = async () => {
    if (detailRows.value.length === 0) {
      toast.error("Belum ada detail pricelist untuk diexport");
      return;
    }

    exporting.value = true;

    try {
      const blob = await exportPricelistExcel(buildPayload());
      triggerBlobDownload(blob, "pricelist-export.xlsx");
      toast.success("Export excel berhasil");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal export excel",
      );
    } finally {
      exporting.value = false;
    }
  };

  const handleUploadExcel = async (file?: File | null) => {
    if (!file) {
      return;
    }

    uploading.value = true;

    try {
      await runImportOperation(file);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal upload excel",
      );
    } finally {
      uploading.value = false;
    }
  };

  onBeforeMount(() => {
    if (!isSuperAdmin.value) {
      const { unitBisnisId } = getSelectRespoDefaults();
      if (unitBisnisId) {
        filters.unit_bisnis_id = unitBisnisId;
      }
    }
  });

  return {
    filters,
    bulkValues,
    detailRows,
    detailSearch,
    filteredDetailRows,
    filterApis,
    itemPickerApi,
    itemPickerColumns,
    excludeItemIds,
    selectedRowCount,
    allSelected,
    saving,
    uploading,
    exporting,
    bulkDialogOpen,
    bulkProcessingOpen,
    bulkProcessing,
    bulkProcessingStage,
    bulkProcessingMessage,
    bulkProcessingSummary,
    bulkProcessingError,
    saveProcessingOpen,
    saveProcessing,
    saveProcessingStage,
    saveProcessingMessage,
    saveProcessingSummary,
    saveProcessingError,
    importProcessingOpen,
    importProcessing,
    importProcessingStage,
    importProcessingMessage,
    importProcessingSummary,
    importProcessingError,
    importResultOpen,
    importErrors,
    importErrorMessage,
    historyDialogOpen,
    historyRows,
    historyLoading,
    historyItemName,
    historyItemCode,
    historyItemId,
    historyPagination,
    historyPageItems,
    isSuperAdmin,
    companyNameDisplay,
    disableSelectItem,
    canSave,
    buildPayload,
    handleItemsAdded,
    updateRowValue,
    toggleRowSelection,
    removeRow,
    resetDetailRows,
    openBulkDialog,
    applyBulkUpdate,
    retryBulkUpdate,
    retryImportExcel,
    openHistoryDialog,
    handleHistoryPageChange,
    handleSave,
    handleExportExcel,
    handleUploadExcel,
  };
}
