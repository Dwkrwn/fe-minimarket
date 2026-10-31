<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import PrintPreviewContainer from "@/components/print/PrintPreviewContainer.vue";
import { API_BASE_URL } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { getSuratJalanSubconById } from "../service";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const loading = ref(true);
const data = ref<any>(null);
const detailRows = ref<any[]>([]);

const menuId = computed(() => route.params.id as string);

const formattedDate = computed(() => {
  if (!data.value?.tgl_sj_subcon) return "-";
  return new Date(data.value.tgl_sj_subcon).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
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

const supplierName = computed(() => {
  const firstDetail = detailRows.value[0] || getHeaderDetailCandidates(data.value)[0];
  return (
    data.value?.m_supplier?.nama_supp ||
    data.value?.m_supplier?.nama_supplier ||
    data.value?.m_supplier?.nama ||
    data.value?.supplier?.nama_supp ||
    data.value?.supplier?.nama_supplier ||
    data.value?.supplier?.nama ||
    firstDetail?.t_purchase_order_subcon?.m_supplier?.nama_supp ||
    firstDetail?.t_purchase_order_subcon?.m_supplier?.nama_supplier ||
    firstDetail?.t_purchase_order_subcon?.m_supplier?.nama ||
    firstDetail?.t_purchase_order_subcon?.supplier?.nama_supp ||
    firstDetail?.t_purchase_order_subcon?.supplier?.nama_supplier ||
    firstDetail?.t_purchase_order_subcon?.supplier?.nama ||
    "-"
  );
});

const DEFAULT_COMPANY_LOGO = "/miniMarketLogo.png";

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

  if (value.startsWith("/")) {
    return `${baseUrl}${value}`;
  }

  if (/^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length > 80) {
    return `data:image/png;base64,${value}`;
  }

  return `${baseUrl}/${value}`;
};

const unitBisnis = computed(() =>
  data.value?.m_unit_bisnis ||
  data.value?.m_unit_bisni ||
  null,
);

const company = computed(() =>
  unitBisnis.value?.m_company ||
  data.value?.m_company ||
  data.value?.company ||
  null,
);

const companyName = computed(() =>
  company.value?.nama ||
  "-",
);

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

const unitBisnisName = computed(() =>
  data.value?.m_unit_bisnis?.nama_comp ||
  data.value?.unit_bisnis?.nama_comp ||
  data.value?.m_unit_bisni?.nama_comp ||
  "-",
);

const gudangName = computed(() =>
  data.value?.m_gudang?.nama_gudang ||
  data.value?.gudang?.nama_gudang ||
  data.value?.m_gudang?.kode_gudang ||
  "-",
);

const isEkspedisi = computed(() => Boolean(data.value?.is_ekspedisi));

const noPolisi = computed(() =>
  isEkspedisi.value
    ? "-"
    : data.value?.kendaraan_sj_subcon?.no_polisi ||
      data.value?.m_kendaraan?.no_polisi ||
      "-",
);

const supirName = computed(() => (isEkspedisi.value ? "-" : data.value?.supir || "-"));

const ekspedisiName = computed(() =>
  !isEkspedisi.value
    ? "-"
    : data.value?.ekspedisi?.value1 ||
      data.value?.ekspedisi?.nama ||
      data.value?.m_ekspedisi?.nama_ekspedisi ||
      "-",
);

const deliveryTypeLabel = computed(() => (isEkspedisi.value ? "Ekspedisi" : "Dikirim Sendiri"));
const vehicleLabel = computed(() => (isEkspedisi.value ? "Ekspedisi" : "Kendaraan"));
const vehicleValue = computed(() => {
  if (isEkspedisi.value) return ekspedisiName.value;
  return (
    data.value?.kendaraan_sj_subcon?.nama_kendaraan ||
    data.value?.m_kendaraan?.nama_kendaraan ||
    "-"
  );
});

const alamatTujuan = computed(() =>
  data.value?.alamat ||
  data.value?.m_supplier?.alamat_supp ||
  data.value?.m_supplier?.alamat ||
  "-",
);

const tujuanKirim = computed(() => data.value?.alamat || alamatTujuan.value || "-");
const detailItems = computed(() => detailRows.value);

const getHeaderDetailCandidates = (source: any) => {
  const candidates = [
    source?.t_sj_subcon_ds,
    source?.t_sj_subcon_d,
    source?.sj_subcon_ds,
    source?.sj_subcon_d,
    source?.details,
  ];

  return candidates.find((item) => Array.isArray(item)) || [];
};

const fetchSjSubconDetails = async (sjSubconId: string) => {
  const query = new URLSearchParams({
    no_pagination: "true",
    filter_column_t_sj_subcon_id: sjSubconId,
    include:
      "m_item,m_items,m_item>m_general,m_items>m_general,m_item>mi_uom,m_items>mi_uom,m_general,t_purchase_order_subcon,t_purchase_order_subcon>m_supplier,t_purchase_order_subcon_bahan,t_purchase_order_subcon_bahan>m_items,stock_gudang,stock_gudang>m_rak_d,stock_gudang>m_rak_d>m_rak",
  });

  const response = await fetch(
    `${API_BASE_URL}/dynamic/t_sj_subcon_d?${query.toString()}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authStore.token}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Gagal memuat detail Surat Jalan Subcon");
  }

  const result = await response.json();
  return result?.status === "success" && Array.isArray(result?.data)
    ? result.data
    : [];
};

const loadDetailRows = async (sjSubcon: any) => {
  const headerDetails = getHeaderDetailCandidates(sjSubcon);
  detailRows.value = headerDetails;

  if (!sjSubcon?.id) return;

  try {
    const fetchedDetails = await fetchSjSubconDetails(sjSubcon.id);
    if (fetchedDetails.length >= headerDetails.length) {
      detailRows.value = fetchedDetails;
    }
  } catch (error) {
    console.error("Failed to load SJ Subcon details:", error);
    if (headerDetails.length === 0) {
      toast.error("Gagal memuat detail item", {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      });
    }
  }
};

const getItemNama = (item: any) =>
  item?.t_purchase_order_subcon_bahan?.m_items?.nama_item ||
  item?.m_item?.nama_item ||
  item?.m_items?.nama_item ||
  item?.nama_item ||
  "-";
const getItemUom = (item: any) =>
  item?.t_purchase_order_subcon_bahan?.m_items?.uom?.value1 ||
  item?.t_purchase_order_subcon_bahan?.m_items?.mi_uom?.value1 ||
  item?.m_uom?.value1 ||
  item?.uom?.value1 ||
  item?.m_item?.uom?.value1 ||
  item?.m_items?.uom?.value1 ||
  item?.m_item?.mi_uom?.value1 ||
  item?.m_items?.mi_uom?.value1 ||
  item?.m_general?.value1 ||
  "-";
const getItemKode = (item: any) =>
  item?.t_purchase_order_subcon_bahan?.m_items?.kode_item ||
  item?.m_item?.kode_item ||
  item?.m_items?.kode_item ||
  item?.kode_item ||
  "-";
const getItemNoPo = (item: any) =>
  item?.t_purchase_order_subcon?.no_po ||
  item?.t_purchase_order?.no_po ||
  item?.purchase_order?.no_po ||
  item?.t_purchase_order_subcon_bahan?.t_purchase_order_subcon?.no_po ||
  item?.t_purchase_order_subcon_bahan?.no_po ||
  item?.no_po ||
  item?.t_purchase_order_bahan?.no_po ||
  "-";

const createdBy = computed(() =>
  data.value?.cr_sjs?.name ||
  data.value?.cr_sjs?.username ||
  data.value?.created_user?.name ||
  "admin",
);

const columns = [
  { key: "no", label: "NO", align: "center" as const },
  { key: "noPo", label: "NO PO", align: "center" as const },
  { key: "kodeBarang", label: "KODE BARANG", align: "center" as const },
  { key: "namaBarang", label: "NAMA BARANG", align: "center" as const },
  { key: "jumlahBarang", label: "JUMLAH BARANG", align: "center" as const },
];

type SuratJalanSubconPrintRow = Record<string, string>

const rows = computed<SuratJalanSubconPrintRow[]>(() =>
  detailItems.value.map((item: any, index: number) => ({
    no: String(index + 1),
    noPo: getItemNoPo(item),
    kodeBarang: getItemKode(item),
    namaBarang: getItemNama(item),
    jumlahBarang: `${item.qty_sj || 0} ${getItemUom(item)}`,
  })),
);

const signatures = computed(() => [
  { label: "Penerima" },
  { label: "Sopir" },
  { label: "Security" },
  { label: "Hormat Kami", name: createdBy.value, hint: "PIC :" },
]);

const footerLeft = computed(() => `Dicetak pada: ${printDate.value} pukul ${printTime.value}`);
const footerRight = computed(() => `${companyName.value} - Dokumen digenerate oleh sistem`);

const leftInfoRows = computed(() => [
  { label: "Tanggal", value: formattedDate.value },
  { label: "Tipe", value: "SURAT JALAN SUBCON" },
  { label: "Gudang", value: gudangName.value },
  { label: "Kepada", value: supplierName.value },
  { label: "Dikirim ke", value: tujuanKirim.value },
]);

const rightInfoRows = computed(() => [
  { label: "Pengiriman", value: deliveryTypeLabel.value, hide: false },
  { label: vehicleLabel.value, value: vehicleValue.value, hide: false },
  { label: "No. Resi", value: data.value?.no_resi || "-", hide: !isEkspedisi.value },
  { label: "No. Polisi", value: noPolisi.value, hide: isEkspedisi.value },
  { label: "Supir", value: supirName.value, hide: isEkspedisi.value },
  { label: "PIC", value: createdBy.value, hide: false },
]);

const alignClass = (align?: "left" | "center" | "right") => {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
};

onMounted(async () => {
  if (!menuId.value) {
    toast.error("ID tidak ditemukan");
    router.push("/purchasing/subcon/t_surat_jalan_subcon");
    return;
  }

  try {
    const res = await getSuratJalanSubconById(menuId.value);
    if (res.status !== "success") throw new Error("Gagal memuat data");
    data.value = res.data;
    await loadDetailRows(res.data);
    toast.success("Data berhasil dimuat");
  } catch (error) {
    toast.error("Gagal memuat data", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
    setTimeout(() => router.push("/purchasing/subcon/t_surat_jalan_subcon"), 2000);
  } finally {
    loading.value = false;
  }
});

const handleBack = () => {
  router.push("/purchasing/subcon/t_surat_jalan_subcon");
};
</script>

<template>
  <PrintPreviewContainer
    :loading="loading"
    :file-name="`${data?.no_sj_subcon || 'surat-jalan-subcon'}.pdf`"
    title="Cetak Surat Jalan Subcon"
    description="Preview dan cetak dokumen"
    :show-back-button="true"
    preview-class="w-[210mm] mx-auto p-0 print:p-0 pdf-content"
    content-class="w-full bg-white border rounded-lg shadow-sm print:border-0 print:shadow-none print:rounded-none overflow-hidden"
    inner-class="sj-subcon-printout box-border w-full min-h-[297mm] text-gray-900 bg-white overflow-hidden"
    download-text="Download PDF"
    @back="handleBack"
  >
    <div v-if="data" class="document-page text-gray-900">
      <div class="document-main">
      <div class="document-header grid grid-cols-[minmax(0,1fr)_210px] items-start gap-6">
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
            <p class="text-sm text-gray-700 mt-1">Surat Jalan Subcon</p>
          </div>
        </div>

        <div class="text-right min-w-0">
          <h2 class="text-2xl font-extrabold text-gray-950 tracking-wide whitespace-nowrap">SURAT JALAN</h2>
          <p class="text-lg font-semibold text-orange-600 mt-2 break-words">
            {{ data.no_sj_subcon || "-" }}
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
            v-for="(row, index) in rightInfoRows.filter((item) => !item.hide)"
            :key="`${row.label}-${index}`"
            class="info-row"
          >
            <span class="info-label">{{ row.label }}</span>
            <span class="info-colon">:</span>
            <span class="info-value">{{ row.value || "-" }}</span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <table class="detail-table w-full border-collapse text-sm" style="border: 1px solid #9ca3af;">
          <colgroup>
            <col class="col-no" />
            <col class="col-no-po" />
            <col class="col-kode-barang" />
            <col class="col-nama-barang" />
            <col class="col-jumlah" />
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
          <div class="px-3 py-2 text-sm">
            <span class="text-gray-600">Catatan : </span>
            <span>{{ data?.catatan || "-" }}</span>
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
.sj-subcon-printout {
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
  width: 10mm;
}

.col-no-po {
  width: 31mm;
}

.col-kode-barang {
  width: 31mm;
}

.col-nama-barang {
  width: 76mm;
}

.col-jumlah {
  width: 32mm;
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

.pdf-content .text-primary { color: #ef6c00 !important; }
.pdf-content .bg-green-100 { background-color: #dcfce7 !important; }
.pdf-content .text-green-800 { color: #166534 !important; }
.pdf-content .bg-yellow-100 { background-color: #fef9c3 !important; }
.pdf-content .text-yellow-800 { color: #854d0e !important; }
.pdf-content .bg-gray-100 { background-color: #f3f4f6 !important; }
.pdf-content .bg-gray-50 { background-color: #f9fafb !important; }
.pdf-content .bg-white { background-color: #ffffff !important; }
.pdf-content .text-orange-600 { color: #ea580c !important; }
.pdf-content .text-gray-950 { color: #030712 !important; }
.pdf-content .text-gray-900 { color: #111827 !important; }
.pdf-content .text-gray-800 { color: #1f2937 !important; }
.pdf-content .text-gray-700 { color: #374151 !important; }
.pdf-content .text-gray-600 { color: #4b5563 !important; }
.pdf-content .text-gray-500 { color: #6b7280 !important; }
.pdf-content .text-gray-400 { color: #9ca3af !important; }
.pdf-content .border { border-color: #e5e7eb !important; }
.pdf-content .border-t { border-top-color: #e5e7eb !important; }
.pdf-content .border-b { border-bottom-color: #e5e7eb !important; }
.pdf-content .border-b-2 { border-bottom-color: #1f2937 !important; }
.pdf-content .border-gray-800 { border-color: #1f2937 !important; }
.pdf-content .border-gray-400 { border-color: #9ca3af !important; }
.pdf-content .border-gray-300 { border-color: #d1d5db !important; }

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

  .sj-subcon-printout {
    padding: 0 !important;
  }

  .document-page {
    min-height: auto !important;
  }
}
</style>
