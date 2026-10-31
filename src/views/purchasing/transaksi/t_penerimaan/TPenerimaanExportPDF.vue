<script setup>
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { ref, nextTick, computed, defineProps } from "vue";

const props = defineProps({
  data: {
    type: Object,
    default: {},
  },
});

const contentRef = ref();

const generatePDF = async () => {
  await nextTick();

  const element = contentRef.value;
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const pdf = new jsPDF("portrait", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  // Berapa pixel canvas per mm halaman PDF
  const pxPerMm = canvasWidth / pageWidth;
  const pageHeightPx = pageHeight * pxPerMm;

  let yOffsetPx = 0;

  while (yOffsetPx < canvasHeight) {
    // Crop canvas untuk halaman ini
    const sliceHeight = Math.min(pageHeightPx, canvasHeight - yOffsetPx);

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvasWidth;
    pageCanvas.height = pageHeightPx; // tetap full agar tidak meregang

    const ctx = pageCanvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(
      canvas,
      0,
      yOffsetPx, // source x, y
      canvasWidth,
      sliceHeight, // source width, height
      0,
      0, // dest x, y
      canvasWidth,
      sliceHeight, // dest width, height
    );

    const pageImg = pageCanvas.toDataURL("image/png");
    if (yOffsetPx > 0) pdf.addPage();
    pdf.addImage(pageImg, "PNG", 0, 0, pageWidth, pageHeight);

    yOffsetPx += pageHeightPx;
  }

  const url = URL.createObjectURL(pdf.output("blob"));
  window.open(url);
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

// Company address formatted
const companyAddress = computed(() => {
  const unit = props.data?.m_unit_bisni;
  if (!unit) return "-";

  const parts = [];
  if (unit.kecamatan) parts.push(unit.kecamatan);
  if (unit.kota) parts.push(unit.kota);
  if (unit.provinsi) parts.push(unit.provinsi);
  if (unit.kodepos) parts.push(unit.kodepos);

  return parts.length > 0 ? parts.join(", ") : "-";
});

// Get PO number from first item
const noPO = computed(() => {
  const items = props.data?.t_penerimaan_barang_ds;
  if (items && items.length > 0) {
    return items[0]?.t_purchase_order?.no_po || "";
  }
  return "";
});

// Page count for multiple pages
const pageInfo = computed(() => {
  return "1 of 1"; // Can be enhanced for multi-page support
});

defineExpose({ generatePDF });
</script>

<template>
  <div class="po-wrapper">
    <div class="po-document" ref="contentRef">
      <!-- Header with Company Info -->
      <div class="company-header">
        <div class="company-info">
          <h1 class="company-name">
            {{ data?.m_unit_bisni?.nama_comp || "PT. COMPANY NAME" }}
          </h1>
          <p class="company-address">{{ companyAddress }}</p>
          <p class="company-contact">
            {{
              data?.m_unit_bisni?.no_telp_pic ||
              data?.m_unit_bisni?.email ||
              "-"
            }}
          </p>
        </div>
        <div class="document-info">
          <table class="doc-info-table">
            <tr>
              <td class="doc-label">Nomer</td>
              <td class="doc-sep">:</td>
              <td class="doc-value">
                <strong>{{ data?.no_penerimaan || "-" }}</strong>
              </td>
              <td class="doc-page">{{ pageInfo }}</td>
            </tr>
            <tr>
              <td class="doc-label">Tanggal</td>
              <td class="doc-sep">:</td>
              <td class="doc-value">{{ formatDate(data?.tgl_penerimaan) }}</td>
              <td></td>
            </tr>
            <tr>
              <td class="doc-label">No. PO</td>
              <td class="doc-sep">:</td>
              <td class="doc-value">{{ noPO }}</td>
              <td></td>
            </tr>
            <tr>
              <td class="doc-label">Supplier</td>
              <td class="doc-sep">:</td>
              <td class="doc-value">
                {{ data?.m_supplier?.nama_supp || "-" }}
              </td>
              <td></td>
            </tr>
            <tr>
              <td class="doc-label">No. SJ</td>
              <td class="doc-sep">:</td>
              <td class="doc-value">{{ data?.no_sj_supp || "-" }}</td>
              <td></td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Document Title -->
      <div class="document-title">
        <h2>LAPORAN PENERIMAAN BARANG (LPB)</h2>
      </div>

      <!-- Items Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th class="col-no">NO</th>
            <th class="col-code">KODE</th>
            <th class="col-name">NAMA BARANG</th>
            <th class="col-qty">QTY</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(item, index) in data?.t_penerimaan_barang_ds"
            :key="index"
          >
            <td class="text-center">{{ index + 1 }}</td>
            <td>{{ item?.m_item?.kode_item || "-" }}</td>
            <td>{{ item?.m_item?.nama_item || "-" }}</td>
            <td class="text-right">
              {{ item?.qty_diterima || 0 }}
              {{ item?.m_item?.mi_uom?.value1 || "" }}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Signatures -->
      <div class="signatures-section">
        <div class="signature-row">
          <div class="signature-label">admin gudang,</div>
          <div class="signature-label">Penerimaan Gudang,</div>
          <div class="signature-label">Penata Gudang,</div>
          <div class="signature-label">Mengetahui,</div>
        </div>
        <div class="signature-row signature-names">
          <div class="signature-name">
            <span>(</span>
            <span class="name-placeholder">HG</span>
            <span>)</span>
          </div>
          <div class="signature-name">
            <span>(</span>
            <span class="name-placeholder"></span>
            <span>)</span>
          </div>
          <div class="signature-name">
            <span>(</span>
            <span class="name-placeholder"></span>
            <span>)</span>
          </div>
          <div class="signature-name">
            <span>(</span>
            <span class="name-placeholder"></span>
            <span>)</span>
          </div>
        </div>
        <div class="print-timestamp">
          {{ formatDateTime(new Date().toISOString()) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Reset & Base ── */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.po-wrapper {
  background: #555;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 32px 16px;
  font-family: "Arial", sans-serif;
}

/* ── Document ── */
.po-document {
  background: #fff;
  width: 210mm;
  /* A4 width */
  min-height: 275mm;
  /* Adjusted to fit content in one page */
  padding: 20mm 15mm;
  font-size: 10px;
  color: #000;
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.35);
  position: relative;
  display: flex;
  flex-direction: column;
}

/* ── Company Header ── */
.company-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  border-bottom: 2px solid #000;
  padding-bottom: 8px;
}

.company-info {
  flex: 1;
}

.company-name {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 2px;
  text-transform: uppercase;
}

.company-address,
.company-contact {
  font-size: 9px;
  line-height: 1.4;
  margin-bottom: 1px;
}

.document-info {
  min-width: 240px;
}

.doc-info-table {
  width: 100%;
  font-size: 9px;
}

.doc-info-table td {
  padding: 1px 0;
  vertical-align: top;
}

.doc-label {
  width: 60px;
  font-weight: 400;
}

.doc-sep {
  width: 10px;
  text-align: center;
}

.doc-value {
  font-weight: 400;
}

.doc-page {
  text-align: right;
  font-size: 8px;
  padding-left: 8px;
}

/* ── Document Title ── */
.document-title {
  text-align: center;
  margin-bottom: 16px;
}

.document-title h2 {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

/* ── Items Table ── */
.items-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 24px;
  font-size: 9px;
}

.items-table th,
.items-table td {
  border: 1px solid #000;
  padding: 4px 6px;
  text-align: left;
  vertical-align: top;
}

.items-table th {
  background: #fff;
  font-weight: 600;
  text-align: center;
  font-size: 9px;
}

.items-table .col-no {
  width: 30px;
}

.items-table .col-code {
  width: 100px;
}

.items-table .col-name {
  /* flex width - will take remaining space */
  min-width: 150px;
}

.items-table .col-qty {
  width: 100px;
}

.text-center {
  text-align: center !important;
}

.text-right {
  text-align: right !important;
}

/* ── Signatures Section ── */
.signatures-section {
  margin-top: auto;
  padding-top: 20px;
  position: relative;
}

.signature-row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
}

.signature-label {
  flex: 1;
  text-align: center;
  font-size: 9px;
  margin-bottom: 30px;
}

.signature-names {
  margin-top: 30px;
}

.signature-name {
  flex: 1;
  text-align: center;
  font-size: 9px;
  display: flex;
  justify-content: center;
  gap: 4px;
}

.name-placeholder {
  min-width: 60px;
  display: inline-block;
}

.print-timestamp {
  position: absolute;
  right: 0;
  bottom: -20px;
  font-size: 8px;
  color: #666;
}

/* ── Print ── */
@media print {
  .po-wrapper {
    background: none;
    padding: 0;
  }

  .po-document {
    box-shadow: none;
    width: 100%;
    padding: 15mm;
  }
}
</style>
