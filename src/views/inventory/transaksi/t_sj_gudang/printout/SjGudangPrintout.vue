<script setup lang="ts">
/**
 * SjGudangPrintout.vue
 * Component for printing/exporting Surat Jalan Gudang as PDF
 * Uses jsPDF + html2canvas (full JS)
 */
import { ref, computed, onMounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Loader2 } from "lucide-vue-next";
import { API_BASE_URL } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { getSjGudangById } from "../service";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

// ============================================================================
// SETUP
// ============================================================================
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

// ============================================================================
// STATE
// ============================================================================
const loading = ref(true);
const generating = ref(false);
const data = ref<any>(null);
const detailRows = ref<any[]>([]);
const printRef = ref<HTMLDivElement | null>(null);

const menuId = computed(() => route.params.id as string);

// ============================================================================
// COMPUTED
// ============================================================================
const formattedDate = computed(() => {
  if (!data.value?.tgl_sj_gudang) return "-";
  const date = new Date(data.value.tgl_sj_gudang);
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
});

const printDate = computed(() => {
  return new Date().toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
});

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
  data.value?.as_unit ||
  null,
);

const company = computed(() =>
  unitBisnis.value?.m_company ||
  data.value?.m_company ||
  data.value?.company ||
  null,
);

const companyName = computed(() => company.value?.nama || "-");

const unitBisnisName = computed(() =>
  data.value?.m_unit_bisnis?.nama_comp ||
  data.value?.as_unit?.nama_comp ||
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

// Warehouse tujuan from relation
const gudangTujuan = computed(() => {
  return (
    data.value?.t_transfer_gudang?.warehouse_tujuan?.nama_gudang ||
    data.value?.gudang_sj_tujuan?.nama_gudang ||
    data.value?.no_tg?.warehouse_tujuan?.nama_gudang ||
    "-"
  );
});

// PIC from relation
const picName = computed(() => {
  return (
    data.value?.no_tg?.m_kary?.nama_kary ||
    data.value?.t_transfer_gudang?.m_kary?.nama_kary ||
    data.value?.t_transfer_gudang?.pic?.nama_kary ||
    data.value?.pic?.nama_kary ||
    "-"
  );
});

// Kendaraan info
const kendaraanInfo = computed(() => {
  if (data.value?.is_ekspedisi) {
    return {
      type: "Ekspedisi",
      name: data.value?.ekspedisi?.value1 || "-",
      noPolisi: "",
      supir: "",
      noResi: data.value?.no_resi || "",
    };
  }
  const kendaraan = data.value?.kendaraan_sj_gudang || data.value?.m_kendaraan;
  return {
    type: "Kendaraan",
    name: kendaraan?.nama_kendaraan || "-",
    noPolisi: kendaraan?.no_polisi || "-",
    supir: data.value?.supir || "-",
    noResi: "",
  };
});

// Detail items
const detailItems = computed(() => {
  return detailRows.value;
});

const getHeaderDetailCandidates = (source: any) => {
  const candidates = [
    source?.t_sj_gudang_ds,
    source?.t_sj_gudang_d,
    source?.sj_gudang_ds,
    source?.sj_gudang_d,
    source?.details,
  ];

  return candidates.find((item) => Array.isArray(item)) || [];
};

const fetchSjGudangDetails = async (sjGudangId: string) => {
  const query = new URLSearchParams({
    no_pagination: "true",
    filter_column_t_sj_gudang_id: sjGudangId,
    include:
      "m_item,m_items,m_item>m_general,m_items>m_general,m_item>mi_uom,m_items>mi_uom,m_rak,m_rak_d,t_transfer_gudang_d,t_transfer_gudang_d>m_item,t_transfer_gudang_d>m_items,t_transfer_gudang_d>m_item>m_general,t_transfer_gudang_d>m_items>m_general,t_transfer_gudang_d>m_item>mi_uom,t_transfer_gudang_d>m_items>mi_uom,t_transfer_gudang_d>m_rak,t_transfer_gudang_d>m_rak_d",
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
    throw new Error("Gagal memuat detail Surat Jalan Gudang");
  }

  const result = await response.json();
  return result?.status === "success" && Array.isArray(result?.data)
    ? result.data
    : [];
};

const loadDetailRows = async (sjGudang: any) => {
  const headerDetails = getHeaderDetailCandidates(sjGudang);
  detailRows.value = headerDetails;

  if (!sjGudang?.id) return;

  try {
    const fetchedDetails = await fetchSjGudangDetails(sjGudang.id);
    if (fetchedDetails.length >= headerDetails.length) {
      detailRows.value = fetchedDetails;
    }
  } catch (error) {
    console.error("Failed to load SJ Gudang details:", error);
    if (headerDetails.length === 0) {
      toast.error("Gagal memuat detail item", {
        description:
          error instanceof Error ? error.message : "Terjadi kesalahan",
      });
    }
  }
};

const getItemKode = (item: any) => {
  return (
    item?.transfer_gudang_d?.m_item?.kode_item ||
    item?.transfer_gudang_d?.m_items?.kode_item ||
    item?.t_transfer_gudang_d?.m_item?.kode_item ||
    item?.t_transfer_gudang_d?.m_items?.kode_item ||
    item?.m_item?.kode_item ||
    item?.m_items?.kode_item ||
    item?.kode_item ||
    "-"
  );
};

const getItemNama = (item: any) => {
  return (
    item?.transfer_gudang_d?.m_item?.nama_item ||
    item?.transfer_gudang_d?.m_items?.nama_item ||
    item?.t_transfer_gudang_d?.m_item?.nama_item ||
    item?.t_transfer_gudang_d?.m_items?.nama_item ||
    item?.m_item?.nama_item ||
    item?.m_items?.nama_item ||
    item?.nama_item ||
    "-"
  );
};

const getItemUom = (item: any) => {
  return (
    item?.transfer_gudang_d?.m_item?.uom?.value1 ||
    item?.transfer_gudang_d?.m_items?.uom?.value1 ||
    item?.t_transfer_gudang_d?.m_item?.uom?.value1 ||
    item?.t_transfer_gudang_d?.m_items?.uom?.value1 ||
    item?.t_transfer_gudang_d?.m_item?.mi_uom?.value1 ||
    item?.t_transfer_gudang_d?.m_items?.mi_uom?.value1 ||
    item?.m_item?.uom?.value1 ||
    item?.m_items?.uom?.value1 ||
    item?.m_item?.mi_uom?.value1 ||
    item?.m_items?.mi_uom?.value1 ||
    item?.uom ||
    "-"
  );
};

const getKodeRak = (item: any) => {
  return (
    item?.kode_rak_asal ||
    item?.rak_sj?.kode_rak ||
    item?.m_rak?.kode_rak ||
    item?.transfer_gudang_d?.m_rak?.kode_rak ||
    item?.t_transfer_gudang_d?.m_rak?.kode_rak ||
    item?.transfer_gudang_d?.rak_asal?.kode_rak ||
    item?.t_transfer_gudang_d?.rak_asal?.kode_rak ||
    "-"
  );
};

const getKodeRakDetail = (item: any) => {
  return (
    item?.kode_rak_d_asal ||
    item?.rak_sj_d?.kode ||
    item?.m_rak_d?.kode ||
    item?.transfer_gudang_d?.m_rak_d?.kode ||
    item?.t_transfer_gudang_d?.m_rak_d?.kode ||
    item?.transfer_gudang_d?.rak_asal_d?.kode ||
    item?.t_transfer_gudang_d?.rak_asal_d?.kode ||
    "-"
  );
};

// Creator name (dari cr_sjg alias)
const createdBy = computed(() => {
  const creator = data.value?.cr_sjg;
  if (!creator) return "-";
  return creator.name || creator.username || "-";
});

// Creator name
// const createdBy = computed(() => {
//   return data.value?.user_default?.name ||
//          data.value?.default_user?.name ||
//          '-'
// })

// ============================================================================
// LIFECYCLE
// ============================================================================
onMounted(async () => {
  if (!menuId.value) {
    toast.error("ID tidak ditemukan");
    router.push("/inventory/transaksi/t_sj_gudang");
    return;
  }

  try {
    const res = await getSjGudangById(menuId.value);
    if (res.status !== "success") throw new Error("Gagal memuat data");
    data.value = res.data;
    await loadDetailRows(res.data);
    toast.success("Data berhasil dimuat");
  } catch (error) {
    toast.error("Gagal memuat data", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
    setTimeout(() => router.push("/inventory/transaksi/t_sj_gudang"), 2000);
  } finally {
    loading.value = false;
  }
});

// ============================================================================
// METHODS
// ============================================================================
const waitForImages = async (root?: HTMLElement | null) => {
  if (!root) return;
  const images = Array.from(root.querySelectorAll("img"));
  if (images.length === 0) return;

  await Promise.all(
    images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
    }),
  );
};

// html2canvas cannot parse oklch() colors (used by Tailwind/shadcn CSS vars).
// Walk the cloned DOM and replace any computed oklch color with a hex fallback.
const sanitizeUnsupportedColors = (element: HTMLElement) => {
  const clonedWindow = element.ownerDocument.defaultView;
  if (!clonedWindow) return;

  const fallbackByProperty: Record<string, string> = {
    color: "#111827",
    backgroundColor: "transparent",
    borderColor: "#e5e7eb",
    borderTopColor: "#e5e7eb",
    borderRightColor: "#e5e7eb",
    borderBottomColor: "#e5e7eb",
    borderLeftColor: "#e5e7eb",
    outlineColor: "#e5e7eb",
    textDecorationColor: "#111827",
  };

  const nodes = [
    element,
    ...Array.from(element.querySelectorAll<HTMLElement>("*")),
  ];

  nodes.forEach((node) => {
    const styles = clonedWindow.getComputedStyle(node);

    Object.entries(fallbackByProperty).forEach(([property, fallback]) => {
      const value = styles[property as keyof CSSStyleDeclaration];
      if (typeof value === "string" && value.includes("oklch")) {
        node.style.setProperty(
          property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
          fallback,
        );
      }
    });

    const boxShadow = styles.boxShadow;
    if (boxShadow?.includes("oklch")) {
      node.style.boxShadow = "none";
    }
  });
};

const handlePrint = async () => {
  if (!printRef.value) {
    toast.error("Gagal membuat PDF", { description: "Konten belum siap" });
    return;
  }

  try {
    generating.value = true;
    await nextTick();
    const el = printRef.value;
    if (!el) {
      toast.error("Gagal membuat PDF", { description: "Konten belum siap" });
      return;
    }

    await nextTick();
    await waitForImages(el);

    // Capture the fixed A4 element at its natural size (210mm x 297mm).
    // windowWidth/Height are pinned so the capture is independent of the
    // actual browser viewport — preview and export use the same element & size.
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      width: el.offsetWidth,
      height: el.offsetHeight,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
      onclone: (_document, clonedElement) => {
        sanitizeUnsupportedColors(clonedElement as HTMLElement);
      },
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${data.value?.no_sj_gudang || "surat-jalan"}.pdf`);
    toast.success("PDF berhasil didownload");
  } catch (error) {
    console.error("PDF export error:", error);
    toast.error("Gagal membuat PDF", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    generating.value = false;
  }
};

const handleBack = () => {
  router.push("/inventory/transaksi/t_sj_gudang");
};
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- HEADER - Hidden when printing -->
    <div
      class="sticky top-0 z-10 bg-background/95 backdrop-blur border-b p-4 no-print"
    >
      <div class="flex items-center justify-between max-w-4xl mx-auto">
        <div class="flex items-center gap-4">
          <Button variant="ghost" size="icon" @click="handleBack">
            <ArrowLeft class="h-5 w-5" />
          </Button>
          <div>
            <h1 class="text-xl font-bold">Cetak Surat Jalan Gudang</h1>
            <p class="text-sm text-muted-foreground">
              Preview dan cetak dokumen
            </p>
          </div>
        </div>
        <Button
          @click="handlePrint"
          :disabled="loading || generating"
          class="gap-2"
        >
          <Loader2 v-if="generating" class="h-4 w-4 animate-spin" />
          <Printer v-else class="h-4 w-4" />
          Download PDF
        </Button>
      </div>
    </div>

    <!-- LOADING STATE -->
    <div v-if="loading" class="flex items-center justify-center min-h-[60vh]">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- PRINT CONTENT -->
    <!-- Outer wrapper only centers the page on screen; it is NOT captured. -->
    <div v-else-if="data" class="flex justify-center py-6 px-4 print:p-0 print:block">
      <!-- A4 PAGE: fixed width/height, captured as-is for both preview & export -->
      <div
        ref="printRef"
        class="a4-page pdf-content text-gray-900"
      >
        <div class="document-main">
        <!-- HEADER SECTION -->
        <div
          class="document-header flex items-start justify-between pb-4"
        >
          <!-- Logo & Company -->
          <div class="flex items-center gap-4">
            <img
              :src="companyLogoSrc"
              :alt="companyName"
              class="h-16 w-16 object-contain"
            />
            <div>
              <h1 class="text-xl font-bold text-gray-900">{{ companyName }}</h1>
              <p class="text-xs text-gray-500">{{ companyAddress }}</p>
              <p class="text-xs text-gray-500">{{ unitBisnisName }}</p>
              <p class="text-sm text-gray-600">Surat Jalan Gudang</p>
            </div>
          </div>
          <!-- Document Info -->
          <div class="text-right">
            <div class="text-2xl font-bold text-gray-900">SURAT JALAN</div>
              <div class="text-lg font-semibold text-primary mt-1">
                {{ data.no_sj_gudang || "-" }}
              </div>
            </div>
          </div>

          <!-- INFO SECTION -->
          <div class="document-info grid grid-cols-2 gap-x-10 gap-y-2 mb-6">
            <!-- Left Column -->
            <div class="space-y-2">
              <div class="info-row">
                <span class="info-label">Tanggal</span>
                <span class="info-colon">:</span>
                <span class="info-value">{{ formattedDate }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">Tipe</span>
                <span class="info-colon">:</span>
                <span class="info-value">{{ data.tipe_sj_gudang || "-" }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">No. Transfer</span>
                <span class="info-colon">:</span>
                <span class="info-value">
                  {{
                    data.no_tg?.no_tw || data.t_transfer_gudang?.no_tw || "-"
                  }}
                </span>
              </div>
              <div class="info-row">
                <span class="info-label">Gudang Tujuan</span>
                <span class="info-colon">:</span>
                <span class="info-value">{{ gudangTujuan }}</span>
              </div>
            </div>

            <!-- Right Column -->
            <div class="space-y-2">
              <div class="info-row">
                <span class="info-label">Pengiriman</span>
                <span class="info-colon">:</span>
                <span class="info-value">
                  {{ data.is_ekspedisi ? "Ekspedisi" : "Dikirim Sendiri" }}
                </span>
              </div>
              <div class="info-row">
                <span class="info-label">{{ kendaraanInfo.type }}</span>
                <span class="info-colon">:</span>
                <span class="info-value">{{ kendaraanInfo.name }}</span>
              </div>
              <div v-if="kendaraanInfo.noPolisi" class="info-row">
                <span class="info-label">No. Polisi</span>
                <span class="info-colon">:</span>
                <span class="info-value">{{ kendaraanInfo.noPolisi }}</span>
              </div>
              <div v-if="kendaraanInfo.supir" class="info-row">
                <span class="info-label">Supir</span>
                <span class="info-colon">:</span>
                <span class="info-value">{{ kendaraanInfo.supir }}</span>
              </div>
              <div v-if="kendaraanInfo.noResi" class="info-row">
                <span class="info-label">No. Resi</span>
                <span class="info-colon">:</span>
                <span class="info-value">{{ kendaraanInfo.noResi }}</span>
              </div>
              <div class="info-row">
                <span class="info-label">PIC</span>
                <span class="info-colon">:</span>
                <span class="info-value">{{ picName }}</span>
              </div>
            </div>
          </div>

          <!-- DETAIL ITEMS TABLE -->
          <div class="detail-section">
            <h3 class="text-sm font-semibold text-gray-700 mb-2 uppercase">
              Detail Items
            </h3>
            <table
              class="detail-table w-full border-collapse border border-gray-300 text-sm"
            >
              <colgroup>
                <col class="col-no" />
                <col class="col-kode-item" />
                <col class="col-nama-item" />
                <col class="col-kode-rak" />
                <col class="col-kode-rak-d" />
                <col class="col-qty" />
                <col class="col-uom" />
                <col class="col-catatan" />
              </colgroup>
              <thead>
                <tr class="bg-gray-100">
                  <th
                    class="border border-gray-300 px-2 py-2 text-center font-semibold"
                  >
                    No
                  </th>
                  <th
                    class="border border-gray-300 px-2 py-2 text-center font-semibold"
                  >
                    Kode Item
                  </th>
                  <th
                    class="border border-gray-300 px-2 py-2 text-center font-semibold"
                  >
                    Nama Item
                  </th>
                  <th
                    class="border border-gray-300 px-2 py-2 text-center font-semibold"
                  >
                    Kode Rak
                  </th>
                  <th
                    class="border border-gray-300 px-2 py-2 text-center font-semibold"
                  >
                    Kode Rak D
                  </th>
                  <th
                    class="border border-gray-300 px-2 py-2 text-center font-semibold"
                  >
                    Qty
                  </th>
                  <th
                    class="border border-gray-300 px-2 py-2 text-center font-semibold"
                  >
                    UOM
                  </th>
                  <th
                    class="border border-gray-300 px-2 py-2 text-center font-semibold"
                  >
                    Catatan
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="detailItems.length === 0">
                  <td
                    colspan="8"
                    class="border border-gray-300 px-3 py-4 text-center text-gray-500"
                  >
                    Tidak ada item
                  </td>
                </tr>
                <tr v-for="(item, idx) in detailItems" :key="item.id || idx">
                  <td class="border border-gray-300 px-2 py-2 text-center">
                    {{ Number(idx) + 1 }}
                  </td>
                  <td class="border border-gray-300 px-2 py-2 text-center">
                    {{ getItemKode(item) }}
                  </td>
                  <td class="border border-gray-300 px-2 py-2 text-center">
                    {{ getItemNama(item) }}
                  </td>
                  <td class="border border-gray-300 px-2 py-2 text-center">
                    {{ getKodeRak(item) }}
                  </td>
                  <td class="border border-gray-300 px-2 py-2 text-center">
                    {{ getKodeRakDetail(item) }}
                  </td>
                  <td class="border border-gray-300 px-2 py-2 text-center">
                    {{ item.qty_sj_gudang || item.qty || 0 }}
                  </td>
                  <td class="border border-gray-300 px-2 py-2 text-center">
                    {{ getItemUom(item) }}
                  </td>
                  <td class="border border-gray-300 px-2 py-2 text-center">
                    {{ item.catatan || "-" }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- CATATAN SECTION -->
          <div v-if="data.catatan" class="mb-6">
            <h3 class="text-sm font-semibold text-gray-700 mb-2 uppercase">
              Catatan
            </h3>
            <div class="p-3 bg-gray-50 border rounded text-sm">
              {{ data.catatan }}
            </div>
          </div>
        </div>

        <div class="document-footer">
          <!-- SIGNATURE SECTION -->
          <div class="signature-section grid grid-cols-3 gap-8 pt-5 border-t">
            <div class="signature-box">
              <p class="signature-title">Dibuat Oleh</p>
              <div class="signature-space"></div>
              <div class="signature-line"></div>
              <p class="signature-name">{{ createdBy }}</p>
            </div>
            <div class="signature-box">
              <p class="signature-title">Dikirim Oleh</p>
              <div class="signature-space"></div>
              <div class="signature-line"></div>
            </div>
            <div class="signature-box">
              <p class="signature-title">Diterima Oleh</p>
              <div class="signature-space"></div>
              <div class="signature-line"></div>
            </div>
          </div>

          <!-- FOOTER -->
          <div
            class="document-print-footer pt-3 border-t text-xs text-gray-500 flex justify-between"
          >
            <span>Dicetak pada: {{ printDate }}</span>
            <span>Dokumen ini digenerate oleh sistem</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ==========================================================================
   FIXED A4 PAGE
   The same element is used for on-screen preview AND html2canvas export.
   Width/height are fixed in mm so the layout never depends on viewport width.
   ========================================================================== */
.a4-page {
  width: 210mm;
  min-height: 297mm;
  padding: 15mm;
  box-sizing: border-box;
  background: #ffffff;
  /* Pin a base font so text size is identical in preview & PDF */
  font-size: 12px;
  line-height: 1.45;
  /* Shadow only on screen; removed for print via @media print below */
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}

.document-main {
  flex: 1 1 auto;
}

.document-header {
  border-bottom: 2px solid #111827;
  margin-bottom: 7mm;
}

.detail-section {
  margin-bottom: 6mm;
}

.document-footer {
  margin-top: auto;
  min-height: 72mm;
  padding-top: 4mm;
  break-inside: avoid;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
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

.col-kode-item {
  width: 27mm;
}

.col-nama-item {
  width: 44mm;
}

.col-kode-rak {
  width: 15mm;
}

.col-kode-rak-d {
  width: 24mm;
}

.col-qty {
  width: 14mm;
}

.col-uom {
  width: 17mm;
}

.col-catatan {
  width: 29mm;
}

.document-info {
  break-inside: avoid;
}

.info-row {
  display: grid;
  grid-template-columns: 34mm 4mm minmax(0, 1fr);
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

.signature-name {
  color: #111827;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  min-height: 4mm;
  margin: 0 0 2mm;
}

.signature-line {
  height: 1px;
  background: #9ca3af;
  margin: 0 8mm 2.5mm;
}

.signature-placeholder {
  color: #111827;
  font-size: 11px;
  line-height: 1.2;
  margin: 0;
}

/* On-screen: scale down so the full A4 width fits narrow viewports
   WITHOUT changing the document's internal layout (transform, not width). */
@media screen and (max-width: 820px) {
  .a4-page {
    transform: scale(calc((100vw - 2rem) / 210mm));
    transform-origin: top center;
  }
}

/* Override oklch colors for html2canvas compatibility */
.pdf-content {
  --primary: #ef6c00 !important;
  --destructive: #dc2626 !important;
  --muted: #f3f4f6 !important;
  --muted-foreground: #6b7280 !important;
  --foreground: #111827 !important;
  --background: #ffffff !important;
  --border: #e5e7eb !important;
}

.pdf-content .text-primary {
  color: #ef6c00 !important;
}

.pdf-content .bg-green-100 {
  background-color: #dcfce7 !important;
}

.pdf-content .text-green-800 {
  color: #166534 !important;
}

.pdf-content .bg-yellow-100 {
  background-color: #fef9c3 !important;
}

.pdf-content .text-yellow-800 {
  color: #854d0e !important;
}

.pdf-content .bg-gray-100 {
  background-color: #f3f4f6 !important;
}

.pdf-content .bg-gray-50 {
  background-color: #f9fafb !important;
}

.pdf-content .text-gray-900 {
  color: #111827 !important;
}

.pdf-content .text-gray-800 {
  color: #1f2937 !important;
}

.pdf-content .text-gray-700 {
  color: #374151 !important;
}

.pdf-content .text-gray-600 {
  color: #4b5563 !important;
}

.pdf-content .text-gray-500 {
  color: #6b7280 !important;
}

.pdf-content .border-gray-800 {
  border-color: #1f2937 !important;
}

.pdf-content .border-gray-400 {
  border-color: #9ca3af !important;
}

.pdf-content .border-gray-300 {
  border-color: #d1d5db !important;
}

/* Print styles */
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

  /* Native print: A4 page must not be scaled or shadowed */
  .a4-page {
    transform: none !important;
    box-shadow: none !important;
    width: 100% !important;
    min-height: auto !important;
    padding: 0 !important;
  }
}
</style>
