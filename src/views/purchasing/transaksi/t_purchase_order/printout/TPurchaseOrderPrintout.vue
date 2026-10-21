<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import PrintPreviewContainer from "@/components/print/PrintPreviewContainer.vue";
import { API_BASE_URL } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { getTPurchaseOrderById, type TPurchaseOrderItem } from "../service";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const loading = ref(true);
const data = ref<TPurchaseOrderItem>({} as TPurchaseOrderItem);
const detailRows = ref<any[]>([]);

const menuId = computed(() => route.params.id as string);
const isWithPrice = computed(() => route.query.withHarga !== "false");

const formatNumber = (val: unknown, digit: number = 2) => {
  if (val === null || val === undefined || val === "") {
    return digit === 0 ? "0" : "0,00";
  }

  return Number(val).toLocaleString("id-ID", {
    minimumFractionDigits: digit,
    maximumFractionDigits: digit,
  });
};

const formattedDate = computed(() => {
  if (!data.value?.tgl_po) return "-";
  return new Date(data.value.tgl_po).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
});

const printDate = computed(() =>
  new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }),
);

const printTime = computed(() =>
  new Date().toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }),
);

const DEFAULT_COMPANY_LOGO = "/hutomoLogoHitam.png";

const resolveCompanyLogo = (logo?: string | null) => {
  if (!logo) return DEFAULT_COMPANY_LOGO;

  const value = String(logo).trim();
  if (!value) return DEFAULT_COMPANY_LOGO;

  if (
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, "").replace(/\/$/, "");

  if (value.startsWith("/")) return `${baseUrl}${value}`;
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length > 80) {
    return `data:image/png;base64,${value}`;
  }

  return `${baseUrl}/${value}`;
};

const unitBisnis = computed(() =>
  (data.value as any)?.m_unit_bisni ||
  (data.value as any)?.m_unit_bisnis ||
  null,
);

const company = computed(() =>
  unitBisnis.value?.m_company ||
  (data.value as any)?.m_company ||
  (data.value as any)?.company ||
  null,
);

const companyName = computed(() => company.value?.nama || unitBisnis.value?.nama_comp || "-");

const companyAddress = computed(() => {
  if (company.value?.alamat) return company.value.alamat;

  const addressParts = [
    company.value?.kecamatan,
    company.value?.kota,
    company.value?.provinsi,
    company.value?.kode_pos,
  ].filter(Boolean);

  return addressParts.length ? addressParts.join(", ") : "-";
});

const companyLogoSrc = computed(() => resolveCompanyLogo(company.value?.logo_img));

const unitBisnisName = computed(() => unitBisnis.value?.nama_comp || "-");

const supplierName = computed(() => data.value?.m_supplier?.nama_supp || "-");
const supplierAddress = computed(
  () =>
    (data.value as any)?.m_supplier?.alamat_supp ||
    (data.value as any)?.m_supplier?.alamat ||
    "-",
);
const ekspedisiName = computed(() => data.value?.po_ekspedisi?.value1 || "-");
const createdBy = computed(
  () =>
    (data.value as any)?.po_ctr?.name ||
    (data.value as any)?.po_ctr?.username ||
    (data.value as any)?.created_user?.name ||
    "admin",
);

const topName = computed(
  () =>
    (data.value as any)?.top_po?.value1 ||
    (data.value as any)?.top?.value1 ||
    "-",
);

const currencyName = computed(
  () =>
    (data.value as any)?.uang_po?.kode_currency ||
    (data.value as any)?.uang_po?.nama_currency ||
    (data.value as any)?.m_currency?.kode_currency ||
    "-",
);

type PurchaseOrderPrintColumn = {
  key: string
  label: string
  align?: "left" | "center" | "right"
}

type PurchaseOrderPrintRow = Record<string, string>

type PurchaseOrderSummary = {
  label: string
  value: string
  bold?: boolean
}

const columns = computed<PurchaseOrderPrintColumn[]>(() => {
  const base = [
    { key: "no", label: "NO", align: "center" as const },
    { key: "kodeBarang", label: "KODE BARANG", align: "center" as const },
    { key: "namaBarang", label: "NAMA BARANG", align: "center" as const },
    { key: "qty", label: "QTY", align: "center" as const },
  ];

  if (!isWithPrice.value) {
    return [...base, { key: "catatan", label: "CATATAN", align: "center" as const }];
  }

  return [
    base[0]!,
    base[1]!,
    base[2]!,
    { key: "catatan", label: "CATATAN", align: "center" as const },
    base[3]!,
    { key: "harga", label: "HARGA SAT.", align: "center" as const },
    { key: "disc1", label: "% 1", align: "center" as const },
    { key: "disc2", label: "% 2", align: "center" as const },
    { key: "jumlah", label: "JUMLAH", align: "center" as const },
  ];
});

const getHeaderDetailCandidates = (source: any) => {
  const candidates = [
    source?.t_purchase_order_ds,
    source?.t_purchase_order_d,
    source?.purchase_order_ds,
    source?.purchase_order_d,
    source?.details,
  ];

  return candidates.find((item) => Array.isArray(item)) || [];
};

const fetchPurchaseOrderDetails = async (purchaseOrderId: string) => {
  const query = new URLSearchParams({
    no_pagination: "true",
    filter_column_t_purchase_order_id: purchaseOrderId,
    include:
      "m_item,m_items,t_purchase_request_d,t_purchase_request_d>m_general",
  });

  const response = await fetch(
    `${API_BASE_URL}/dynamic/t_purchase_order_d?${query.toString()}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authStore.token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Gagal memuat detail Purchase Order");
  }

  const result = await response.json();
  return result?.status === "success" && Array.isArray(result?.data)
    ? result.data
    : [];
};

const loadDetailRows = async (purchaseOrder: any) => {
  const headerDetails = getHeaderDetailCandidates(purchaseOrder);
  detailRows.value = headerDetails;

  if (!purchaseOrder?.id) return;

  try {
    const fetchedDetails = await fetchPurchaseOrderDetails(purchaseOrder.id);
    if (fetchedDetails.length >= headerDetails.length) {
      detailRows.value = fetchedDetails;
    }
  } catch (error) {
    console.error("Failed to load Purchase Order details:", error);
    if (headerDetails.length === 0) {
      toast.error("Gagal memuat detail item", {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      });
    }
  }
};

const detailItems = computed(() => detailRows.value);

const getItemKode = (item: any) =>
  item?.m_item?.kode_item ||
  item?.m_items?.kode_item ||
  item?.kode_item ||
  "-";

const getItemNama = (item: any) =>
  item?.m_item?.nama_item ||
  item?.m_items?.nama_item ||
  item?.nama_barang ||
  item?.nama_item ||
  "-";

const getItemUom = (item: any) =>
  item?.m_item?.mi_uom?.value1 ||
  item?.m_items?.mi_uom?.value1 ||
  item?.m_item?.uom?.value1 ||
  item?.m_items?.uom?.value1 ||
  item?.uom ||
  "PCS";

const rows = computed<PurchaseOrderPrintRow[]>(() =>
  detailItems.value.map((item: any, index: number) => ({
    no: String(index + 1),
    kodeBarang: getItemKode(item),
    namaBarang: getItemNama(item),
    catatan: item?.catatan || "-",
    qty: `${formatNumber(item?.qty_po || item?.qty, 0)} ${getItemUom(item)}`,
    harga: formatNumber(item?.harga || 0),
    disc1: formatNumber(item?.disc_1 || 0),
    disc2: formatNumber(item?.disc_2 || 0),
    jumlah: formatNumber(item?.sub_total || 0),
  })),
);

const summaries = computed<PurchaseOrderSummary[]>(() => {
  if (!isWithPrice.value) return [];

  const items: PurchaseOrderSummary[] = [
    { label: "Sub Total", value: formatNumber(data.value?.total || 0) },
  ];

  if (data.value?.ppn_po?.key1 !== "NONE") {
    items.push({ label: "PPN", value: formatNumber(data.value?.total_ppn || 0) });
  }

  items.push({
    label: "Total",
    value: formatNumber(data.value?.grand_total || 0),
    bold: true,
  });

  return items;
});

const signatures = computed(() => [
  { label: "Dibuat Oleh", name: createdBy.value },
  { label: "Disetujui Oleh" },
  { label: "Supplier" },
  { label: "Hormat Kami", name: createdBy.value, hint: "PIC :" },
]);

const footerLeft = computed(() => `Dicetak pada: ${printDate.value} pukul ${printTime.value}`);
const footerRight = computed(() => `${companyName.value} - Dokumen digenerate oleh sistem`);

const leftInfoRows = computed(() => [
  { label: "Tanggal", value: formattedDate.value },
  { label: "No. PO", value: data.value?.no_po || "-" },
  { label: "Unit Bisnis", value: unitBisnisName.value },
  { label: "Supplier", value: supplierName.value },
]);

const rightInfoRows = computed(() => [
  { label: "TOP", value: topName.value },
  { label: "Currency", value: currencyName.value },
  { label: "Ekspedisi", value: ekspedisiName.value },
  { label: "Alamat", value: supplierAddress.value },
]);

const alignClass = (align?: "left" | "center" | "right") => {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
};

onMounted(async () => {
  if (!menuId.value) {
    toast.error("ID tidak ditemukan");
    router.push("/purchasing/transaksi/t_purchase_order");
    return;
  }

  try {
    const response = await getTPurchaseOrderById(menuId.value);
    if (!response?.data) {
      throw new Error("Data print preview tidak ditemukan");
    }

    data.value = response.data;
    await loadDetailRows(response.data);
    toast.success("Data berhasil dimuat");
  } catch (error) {
    toast.error("Gagal memuat data", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
    setTimeout(() => router.push("/purchasing/transaksi/t_purchase_order"), 2000);
  } finally {
    loading.value = false;
  }
});

const handleBack = () => {
  router.push("/purchasing/transaksi/t_purchase_order");
};
</script>

<template>
  <PrintPreviewContainer
    :loading="loading"
    :file-name="`${data?.no_po || 'purchase-order'}.pdf`"
    title="Cetak Purchase Order"
    :description="
      isWithPrice
        ? 'Preview dan cetak dokumen dengan harga'
        : 'Preview dan cetak dokumen tanpa harga'
    "
    :show-back-button="true"
    preview-class="w-[210mm] mx-auto p-0 print:p-0 pdf-content"
    content-class="w-full bg-white border rounded-lg shadow-sm print:border-0 print:shadow-none print:rounded-none overflow-hidden"
    inner-class="purchase-order-printout box-border w-full min-h-[297mm] text-gray-900 bg-white overflow-hidden"
    @back="handleBack"
  >
    <div v-if="!loading" class="document-page text-gray-900">
      <div class="document-main">
        <div class="document-header grid grid-cols-[minmax(0,1fr)_245px] items-start gap-6">
          <div class="flex items-center gap-5 min-w-0">
            <img
              :src="companyLogoSrc"
              :alt="companyName"
              class="h-16 w-16 object-contain shrink-0"
            />
            <div class="min-w-0">
              <h1 class="text-xl font-extrabold text-gray-950 leading-tight uppercase break-words">
                {{ companyName }}
              </h1>
              <p class="text-xs text-gray-600 mt-1">{{ companyAddress }}</p>
              <p class="text-xs text-gray-600">{{ unitBisnisName }}</p>
              <p class="text-sm text-gray-700 mt-1">
                Purchase Order {{ isWithPrice ? "Dengan Harga" : "Tanpa Harga" }}
              </p>
            </div>
          </div>

          <div class="text-right min-w-0">
            <h2 class="document-title text-gray-950">
              PURCHASE ORDER
            </h2>
            <p class="text-lg font-semibold text-orange-600 mt-2 break-words">
              {{ data.no_po || "-" }}
            </p>
          </div>
        </div>

        <div class="document-info grid grid-cols-2 gap-x-10 gap-y-3">
          <div class="space-y-4">
            <div
              v-for="row in leftInfoRows"
              :key="row.label"
              class="info-row"
            >
              <span class="info-label">{{ row.label }}</span>
              <span class="info-colon">:</span>
              <span class="info-value">{{ row.value || "-" }}</span>
            </div>
          </div>

          <div class="space-y-4">
            <div
              v-for="row in rightInfoRows"
              :key="row.label"
              class="info-row"
            >
              <span class="info-label">{{ row.label }}</span>
              <span class="info-colon">:</span>
              <span class="info-value">{{ row.value || "-" }}</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <table
            class="detail-table w-full border-collapse text-sm"
            :class="isWithPrice ? 'with-price' : 'without-price'"
            style="border: 1px solid #9ca3af;"
          >
            <colgroup v-if="isWithPrice">
              <col class="col-no" />
              <col class="col-kode" />
              <col class="col-nama" />
              <col class="col-catatan" />
              <col class="col-qty" />
              <col class="col-harga" />
              <col class="col-disc" />
              <col class="col-disc" />
              <col class="col-jumlah" />
            </colgroup>
            <colgroup v-else>
              <col class="col-no" />
              <col class="col-kode-no-price" />
              <col class="col-nama-no-price" />
              <col class="col-qty-no-price" />
              <col class="col-catatan-no-price" />
            </colgroup>
            <thead>
              <tr class="bg-gray-100">
                <th
                  v-for="column in columns"
                  :key="column.key"
                  class="px-2 py-2 font-semibold text-gray-800 text-center"
                  style="border: 1px solid #9ca3af;"
                >
                  {{ column.label }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="rows.length === 0">
                <td
                  :colspan="columns.length"
                  class="px-2 py-8 text-center text-gray-500"
                  style="border: 1px solid #9ca3af;"
                >
                  Tidak ada item
                </td>
              </tr>
              <tr v-for="(row, rowIndex) in rows" :key="rowIndex" class="align-top">
                <td
                  v-for="column in columns"
                  :key="`${column.key}-${rowIndex}`"
                  class="px-2 py-2 text-sm text-gray-700 break-words"
                  :class="alignClass(column.align)"
                  style="border: 1px solid #9ca3af;"
                >
                  {{ row[column.key] || "-" }}
                </td>
              </tr>
            </tbody>
          </table>

          <div style="border: 1px solid #9ca3af; border-top: none; margin-top: -1px;">
            <div class="notes-summary px-3 py-2 text-sm">
              <div class="notes-box">
                <span class="text-gray-600">Catatan : </span>
                <span>{{ data?.catatan || "-" }}</span>
              </div>
              <div v-if="summaries.length" class="summary-box">
                <div
                  v-for="(summary, index) in summaries"
                  :key="`${summary.label}-${index}`"
                  class="summary-row"
                  :class="summary.bold ? 'font-semibold border-t mt-1 pt-1' : ''"
                >
                  <span>{{ summary.label }}</span>
                  <span>{{ summary.value }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="document-footer">
        <div class="signature-section grid grid-cols-4 gap-4 pt-5 border-t">
          <div
            v-for="(signature, index) in signatures"
            :key="`${signature.label}-${index}`"
            class="signature-box"
          >
            <p class="signature-title">{{ signature.label }}</p>
            <div class="signature-space"></div>
            <div class="signature-line"></div>
            <p v-if="signature.name" class="signature-name">{{ signature.name }}</p>
            <p v-if="signature.hint" class="signature-hint">{{ signature.hint }}</p>
          </div>
        </div>

        <div class="document-print-footer pt-3 border-t text-xs text-gray-500 flex justify-between gap-4">
          <span>{{ footerLeft }}</span>
          <span class="text-right">{{ footerRight }}</span>
        </div>
      </div>
    </div>
  </PrintPreviewContainer>
</template>

<style scoped>
.purchase-order-printout {
  padding: 15mm;
  font-size: 12px;
  line-height: 1.45;
}

.document-page {
  min-height: calc(297mm - 30mm);
  display: flex;
  flex-direction: column;
}

.document-main {
  flex: 1 1 auto;
}

.document-header {
  border-bottom: 2px solid #111827;
  margin-bottom: 7mm;
  padding-bottom: 4mm;
}

.document-title {
  font-size: 22px;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: 0;
  white-space: nowrap;
}

.document-info {
  break-inside: avoid;
  margin-bottom: 11mm;
}

.info-row {
  display: grid;
  grid-template-columns: 30mm 4mm minmax(0, 1fr);
  column-gap: 1.5mm;
  align-items: start;
  min-height: 5.5mm;
}

.info-label {
  color: #4b5563;
  font-size: 12px;
  line-height: 1.35;
  white-space: nowrap;
}

.info-colon {
  color: #111827;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  text-align: center;
}

.info-value {
  color: #111827;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
  word-break: normal;
}

.detail-section {
  margin-bottom: 9mm;
}

.detail-table {
  table-layout: fixed;
}

.detail-table th,
.detail-table td {
  vertical-align: middle;
  overflow-wrap: anywhere;
  word-break: normal;
  line-height: 1.35;
}

.col-no {
  width: 12mm;
}

.col-kode {
  width: 23mm;
}

.col-nama {
  width: 43mm;
}

.col-catatan {
  width: 24mm;
}

.col-qty {
  width: 18mm;
}

.col-harga {
  width: 22mm;
}

.col-disc {
  width: 13mm;
}

.col-jumlah {
  width: 25mm;
}

.col-kode-no-price {
  width: 35mm;
}

.col-nama-no-price {
  width: 72mm;
}

.col-qty-no-price {
  width: 28mm;
}

.col-catatan-no-price {
  width: 36mm;
}

.notes-summary {
  display: flex;
  gap: 8mm;
  align-items: flex-start;
}

.notes-box {
  flex: 1 1 auto;
  min-width: 0;
}

.summary-box {
  width: 52mm;
  flex: 0 0 52mm;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  gap: 4mm;
  padding: 0.5mm 0;
}

.document-footer {
  margin-top: auto;
  min-height: 64mm;
  padding-top: 5mm;
  break-inside: avoid;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.signature-section {
  break-inside: avoid;
}

.signature-box {
  min-height: 42mm;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: stretch;
}

.signature-title {
  color: #111827;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  margin: 0;
}

.signature-space {
  height: 27mm;
}

.signature-line {
  height: 1px;
  background: #9ca3af;
  margin: 0 6mm 2.5mm;
}

.signature-name {
  color: #111827;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  min-height: 4mm;
  margin: 0 0 1.5mm;
}

.signature-hint {
  color: #6b7280;
  font-size: 11px;
  line-height: 1.2;
  min-height: 4mm;
  margin: 0;
}

.pdf-generating .border,
.pdf-generating .rounded-lg,
.pdf-generating .shadow-sm {
  border: none !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}

.pdf-content {
  --primary: #ef6c00 !important;
  --destructive: #dc2626 !important;
  --muted: #f3f4f6 !important;
  --muted-foreground: #6b7280 !important;
  --foreground: #111827 !important;
  --background: #ffffff !important;
  --border: #e5e7eb !important;
}

.pdf-content .bg-gray-100 { background-color: #f3f4f6 !important; }
.pdf-content .bg-white { background-color: #ffffff !important; }
.pdf-content .text-orange-600 { color: #ea580c !important; }
.pdf-content .text-gray-950 { color: #030712 !important; }
.pdf-content .text-gray-900 { color: #111827 !important; }
.pdf-content .text-gray-800 { color: #1f2937 !important; }
.pdf-content .text-gray-700 { color: #374151 !important; }
.pdf-content .text-gray-600 { color: #4b5563 !important; }
.pdf-content .text-gray-500 { color: #6b7280 !important; }
.pdf-content .border { border-color: #e5e7eb !important; }
.pdf-content .border-t { border-top-color: #e5e7eb !important; }

@media print {
  @page {
    size: A4;
    margin: 10mm;
  }

  html,
  body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .no-print {
    display: none !important;
  }

  .purchase-order-printout {
    padding: 0 !important;
  }

  .document-page {
    min-height: auto !important;
  }
}
</style>
