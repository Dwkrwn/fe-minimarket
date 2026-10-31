<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import PrintPreviewContainer from "@/components/print/PrintPreviewContainer.vue";
import { API_BASE_URL, apiCall } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { getQcById, type QcItem, type QcDetailItem, type DynamicResponse } from "../service";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const loading = ref(true);
const qcData = ref<QcItem | null>(null);
const headerPoNo = ref<string>("");
const headerSjNo = ref<string>("");
const headerSupplierName = ref<string>("");

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
  if (value.startsWith("/")) return `${baseUrl}${value}`;
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length > 80) {
    return `data:image/png;base64,${value}`;
  }
  return `${baseUrl}/${value}`;
};

const formattedDate = computed(() => {
  if (!qcData.value?.date) return "-";
  return new Date(qcData.value.date).toLocaleDateString("id-ID", {
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

const unitBisnis = computed(() => qcData.value?.m_unit_bisnis || null);
const company = computed(() => unitBisnis.value?.m_company || null);
const companyName = computed(() => company.value?.nama || unitBisnis.value?.nama_comp || "PT. KARYA USAHA ANEKA TERJAYA");
const companyLogoSrc = computed(() => resolveCompanyLogo(company.value?.logo_img));

const displaySupplier = computed(() => {
  if (headerSupplierName.value) return headerSupplierName.value;
  if ((qcData.value as any)?.supplier_name) return (qcData.value as any).supplier_name;
  if ((qcData.value as any)?.ref_doc?.m_supplier?.nama) return (qcData.value as any).ref_doc.m_supplier.nama;
  if ((qcData.value as any)?.ref_doc?.m_supplier?.nama_supp) return (qcData.value as any).ref_doc.m_supplier.nama_supp;
  return "-";
});

const displayWarehouse = computed(() => qcData.value?.m_gudang?.nama_gudang || "-");
const displayPic = computed(() => qcData.value?.m_kary?.nama_kary || "-");

// Mapping kolom kriteria sesuai format standar formulir lapangan
const getCritValue = (item: QcDetailItem, code: 'SI' | 'A' | 'B' | 'C' | 'D' | 'E' | 'HI' | 'SB'): string => {
  if (!item.t_qc_sd_crits || item.t_qc_sd_crits.length === 0) return "";

  const crits = item.t_qc_sd_crits;
  let targetCrit: any = null;

  if (code === 'SI') {
    targetCrit = crits.find((c) => {
      const name = (c.qc_criteria?.value1 || c.qc_criteria?.value2 || '').toLowerCase();
      return name.includes('status inspeksi') || name.includes('si');
    });
  } else if (code === 'A') {
    targetCrit = crits.find((c) => {
      const name = (c.qc_criteria?.value1 || c.qc_criteria?.value2 || '').toLowerCase();
      return name.includes('spesifikasi') || name.includes('kesesuaian spesifikasi');
    });
  } else if (code === 'B') {
    targetCrit = crits.find((c) => {
      const name = (c.qc_criteria?.value1 || c.qc_criteria?.value2 || '').toLowerCase();
      return name.includes('ketepatan waktu') || name.includes('waktu penerimaan');
    });
  } else if (code === 'C') {
    targetCrit = crits.find((c) => {
      const name = (c.qc_criteria?.value1 || c.qc_criteria?.value2 || '').toLowerCase();
      return name.includes('expired') || name.includes('kadaluarsa') || name.includes('batas waktu');
    });
  } else if (code === 'D') {
    targetCrit = crits.find((c) => {
      const name = (c.qc_criteria?.value1 || c.qc_criteria?.value2 || '').toLowerCase();
      return name.includes('kemasan') || name.includes('segel') || name.includes('tidak rusak');
    });
  } else if (code === 'E') {
    targetCrit = crits.find((c) => {
      const name = (c.qc_criteria?.value1 || c.qc_criteria?.value2 || '').toLowerCase();
      return name.includes('acuan') || name.includes('standart') || name.includes('standard acuan');
    });
  } else if (code === 'HI') {
    targetCrit = crits.find((c) => {
      const name = (c.qc_criteria?.value1 || c.qc_criteria?.value2 || '').toLowerCase();
      return name.includes('hasil inspeksi') || name.includes('hi');
    });
  } else if (code === 'SB') {
    targetCrit = crits.find((c) => {
      const name = (c.qc_criteria?.value1 || c.qc_criteria?.value2 || '').toLowerCase();
      return name.includes('diterima') || name.includes('barang bisa diterima') || name.includes('sb');
    });
  }

  if (!targetCrit) return "";

  // 1. Jika ada nilai pilihan dari master (qc_value)
  if (targetCrit.qc_value?.value1) {
    return targetCrit.qc_value.value1;
  }

  // 2. Jika tidak ada qc_value, periksa Qty Pass / Qty Not Pass
  const pass = parseFloat(String(targetCrit.qty_pass)) || 0;
  const noPass = parseFloat(String(targetCrit.qty_nopass)) || 0;

  if (pass > 0 && noPass === 0) {
    if (code === 'HI') return '0'; // 0 = tidak ada masalah
    if (code === 'SB') return 'OK';
    return '✓';
  } else if (noPass > 0) {
    if (code === 'HI') return '1'; // 1 = ada temuan
    if (code === 'SB') return 'REJECT';
    return 'X';
  }

  return "";
};

// Jumlah minimal baris tabel untuk cetakan lembar kerja lapangan (minimal 12 baris)
const minDisplayRows = 12;

const itemsList = computed(() => {
  return qcData.value?.t_qc_d_items || [];
});

const emptyRowsCount = computed(() => {
  const currentCount = itemsList.value.length;
  return Math.max(0, minDisplayRows - currentCount);
});

const fetchQcData = async () => {
  const qcId = route.params.id as string;
  if (!qcId) {
    toast.error("ID Quality Control tidak valid");
    loading.value = false;
    return;
  }

  try {
    loading.value = true;
    const res = await getQcById(qcId);
    if (res.status === "success" && res.data) {
      qcData.value = res.data;

      // Jika ada referensi ke penerimaan atau WO, ambil detail PO & SJ jika belum terisi
      if (res.data.ref_id) {
        if (res.data.flag === 'INCOMING') {
          try {
            const pRes = await apiCall<DynamicResponse<any>>(`/dynamic/t_penerimaan_barangs/${res.data.ref_id}?include=m_supplier,m_gudang,t_penerimaan_barang_d>t_purchase_order`);
            if (pRes.status === 'success' && pRes.data) {
              headerSupplierName.value = pRes.data.m_supplier?.nama || pRes.data.m_supplier?.nama_supp || "";
              headerSjNo.value = pRes.data.no_sj_supp || pRes.data.no_penerimaan || "";
              const poObj = pRes.data.t_penerimaan_barang_ds?.[0]?.t_purchase_order;
              headerPoNo.value = poObj?.no_po || poObj?.no || "";
            }
          } catch (e) {
            console.error("Failed fetching incoming ref for print:", e);
          }
        } else if (res.data.flag === 'FINAL') {
          try {
            const woRes = await apiCall<DynamicResponse<any>>(`/dynamic/t_wo/${res.data.ref_id}`);
            if (woRes.status === 'success' && woRes.data) {
              headerPoNo.value = woRes.data.no || "";
            }
          } catch (e) {
            console.error("Failed fetching wo ref for print:", e);
          }
        }
      }
    } else {
      toast.error("Gagal memuat data Quality Control");
    }
  } catch (err) {
    console.error("Error fetching QC print detail:", err);
    toast.error("Terjadi kesalahan saat memuat data Quality Control");
  } finally {
    loading.value = false;
  }
};

const handleBack = () => {
  router.back();
};

onMounted(() => {
  fetchQcData();
});
</script>

<template>
  <PrintPreviewContainer
    title="Cetak Formulir Quality Control Lapangan"
    description="Formulir lembar inspeksi Quality Control lapangan"
    :file-name="`QC_LAPANGAN_${qcData?.no || 'DOKUMEN'}`"
    :loading="loading"
    page-class="min-h-screen bg-slate-100 py-6 print:py-0 print:bg-white"
    preview-class="w-[297mm] max-w-full mx-auto p-4 print:p-0 pdf-content"
    content-class="w-full bg-white border border-gray-300 rounded shadow-sm print:border-0 print:shadow-none print:rounded-none overflow-hidden"
    inner-class="qc-field-printout box-border w-full text-gray-900 bg-white p-6 print:p-0"
    :show-back-button="true"
    @back="handleBack"
  >
    <div v-if="qcData" class="document-page text-black font-sans leading-tight">
      <!-- ============================================================ -->
      <!-- HEADER KOP & JUDUL DOKUMEN -->
      <!-- ============================================================ -->
      <div class="header-section pb-2 border-b-2 border-black flex justify-between items-start">
        <div class="flex items-center gap-3">
          <img
            v-if="companyLogoSrc"
            :src="companyLogoSrc"
            alt="Logo"
            class="h-10 w-auto object-contain print:h-9"
          />
          <div>
            <h1 class="text-sm font-bold uppercase tracking-wide leading-none">{{ companyName }}</h1>
            <p class="text-[10px] text-gray-700 mt-0.5 leading-none">Divisi Quality Control & Assurance</p>
          </div>
        </div>

        <div class="text-right">
          <h2 class="text-base font-extrabold tracking-tight uppercase leading-none">LEMBAR INSPEKSI QUALITY CONTROL (QC)</h2>
          <p class="text-[10px] text-gray-600 mt-1">No. QC: <span class="font-bold text-black">{{ qcData.no || '-' }}</span> | Status: <span class="font-semibold">{{ qcData.status || 'DRAFT' }}</span></p>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- KOTAK INFO SESUAI GAMBAR DOKUMEN LAPANGAN -->
      <!-- ============================================================ -->
      <div class="meta-section my-2.5 flex justify-between items-start text-[11px] leading-tight">
        <!-- Kiri -->
        <div class="space-y-1 w-1/3">
          <div class="flex">
            <span class="w-16 font-medium">Tanggal</span>
            <span class="w-3 text-center">:</span>
            <span class="font-semibold">{{ formattedDate }}</span>
          </div>
          <div class="flex">
            <span class="w-16 font-medium">Rev / tgl</span>
            <span class="w-3 text-center">:</span>
            <span>-</span>
          </div>
          <div class="flex">
            <span class="w-16 font-medium">Tipe QC</span>
            <span class="w-3 text-center">:</span>
            <span class="font-semibold uppercase">{{ qcData.flag || 'INCOMING' }}</span>
          </div>
        </div>

        <!-- Tengah / Kanan -->
        <div class="space-y-1 w-2/3 pl-8">
          <div class="flex">
            <span class="w-24 font-medium">Supplier</span>
            <span class="w-3 text-center">:</span>
            <span class="font-bold text-black">{{ displaySupplier }}</span>
          </div>
          <div class="flex">
            <span class="w-24 font-medium">Warehouse</span>
            <span class="w-3 text-center">:</span>
            <span>{{ displayWarehouse }}</span>
          </div>
          <div class="flex">
            <span class="w-24 font-medium">Inspector / PIC</span>
            <span class="w-3 text-center">:</span>
            <span class="font-semibold">{{ displayPic }}</span>
          </div>
        </div>
      </div>

      <!-- ============================================================ -->
      <!-- TABEL UTAMA LEMBAR INSPEKSI LAPANGAN (SESUAI GAMBAR 2) -->
      <!-- ============================================================ -->
      <div class="table-container border-2 border-black">
        <table class="w-full border-collapse text-[10px] text-center">
          <thead>
            <tr class="bg-slate-100 print:bg-slate-100 font-bold border-b border-black text-black">
              <th class="border-r border-black py-1.5 px-1.5 min-w-[75px] max-w-[90px] text-center font-bold">No. SJ</th>
              <th class="border-r border-black py-1.5 px-1.5 min-w-[75px] max-w-[90px] text-center font-bold">No. PO</th>
              <th class="border-r border-black py-1.5 px-2 text-left min-w-[150px] font-bold">Jenis Barang</th>
              <th class="border-r border-black py-1.5 px-1.5 text-left min-w-[110px] font-bold">Merk/Type Produk</th>
              <th class="border-r border-black py-1.5 px-1 text-center min-w-[70px] font-bold">No. Batch/Packing</th>
              <th class="border-r border-black py-1.5 px-1 text-right min-w-[50px] font-bold">Jumlah</th>
              <th class="border-r border-black py-1.5 px-1 text-center min-w-[45px] font-bold">Ukuran</th>
              <!-- Kolom Kriteria Master -->
              <th class="border-r border-black py-1.5 px-1 text-center w-8 font-bold" title="Status Inspeksi (SI)">SI</th>
              <th class="border-r border-black py-1.5 px-1 text-center w-8 font-bold" title="Kesesuaian Spesifikasi (A)">A</th>
              <th class="border-r border-black py-1.5 px-1 text-center w-8 font-bold" title="Ketepatan Waktu (B)">B</th>
              <th class="border-r border-black py-1.5 px-1 text-center w-8 font-bold" title="Batas Kadaluarsa / Expired (C)">C</th>
              <th class="border-r border-black py-1.5 px-1 text-center w-8 font-bold" title="Kemasan & Segel (D)">D</th>
              <th class="border-r border-black py-1.5 px-1 text-center w-8 font-bold" title="Standar Acuan Mutu (E)">E</th>
              <th class="border-r border-black py-1.5 px-1 text-center w-8 font-bold" title="Hasil Inspeksi (HI)">HI</th>
              <th class="border-r border-black py-1.5 px-1 text-center w-8 font-bold" title="Barang Diterima? (SB)">SB</th>
              <th class="py-1.5 px-2 text-left min-w-[100px] font-bold">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            <!-- DATA BARIS ITEM MATERIAL -->
            <tr
              v-for="(row, idx) in itemsList"
              :key="idx"
              class="border-b border-black text-black leading-tight h-7"
            >
              <!-- No. SJ -->
              <td class="border-r border-black px-1.5 text-center truncate">
                {{ row.sj_no || headerSjNo || '-' }}
              </td>

              <!-- No. PO -->
              <td class="border-r border-black px-1.5 text-center truncate">
                {{ row.po_no || headerPoNo || '-' }}
              </td>

              <!-- Jenis Barang -->
              <td class="border-r border-black px-2 text-left font-medium">
                {{ row.nama_item || row.m_item?.nama_item || '-' }}
              </td>

              <!-- Merk/Type Produk -->
              <td class="border-r border-black px-1.5 text-left font-mono text-[9px]">
                {{ row.kode_item || row.m_item?.kode_item || '-' }}
              </td>

              <!-- No. Batch/Packing -->
              <td class="border-r border-black px-1 text-center">
                {{ (row as any).batch_no || '-' }}
              </td>

              <!-- Jumlah -->
              <td class="border-r border-black px-1 text-right font-semibold">
                {{ row.qty || row.ref_qty || 0 }}
              </td>

              <!-- Ukuran (Satuan) -->
              <td class="border-r border-black px-1 text-center">
                {{ row.uom_name || row.m_general?.value1 || row.m_item?.mi_uom?.value1 || 'PCS' }}
              </td>

              <!-- Kriteria SI, A, B, C, D, E, HI, SB -->
              <td class="border-r border-black px-0.5 text-center font-bold">
                {{ getCritValue(row, 'SI') }}
              </td>
              <td class="border-r border-black px-0.5 text-center font-bold">
                {{ getCritValue(row, 'A') }}
              </td>
              <td class="border-r border-black px-0.5 text-center font-bold">
                {{ getCritValue(row, 'B') }}
              </td>
              <td class="border-r border-black px-0.5 text-center font-bold">
                {{ getCritValue(row, 'C') }}
              </td>
              <td class="border-r border-black px-0.5 text-center font-bold">
                {{ getCritValue(row, 'D') }}
              </td>
              <td class="border-r border-black px-0.5 text-center font-bold">
                {{ getCritValue(row, 'E') }}
              </td>
              <td class="border-r border-black px-0.5 text-center font-bold">
                {{ getCritValue(row, 'HI') }}
              </td>
              <td class="border-r border-black px-0.5 text-center font-bold">
                {{ getCritValue(row, 'SB') }}
              </td>

              <!-- Keterangan -->
              <td class="px-2 text-left truncate text-[9px] text-gray-700">
                {{ row.notes || '-' }}
              </td>
            </tr>

            <!-- BARIS KOSONG BERGARIS (UNTUK CATATAN / ISIAN LAPANGAN) -->
            <tr
              v-for="emptyIdx in emptyRowsCount"
              :key="`empty-${emptyIdx}`"
              class="border-b border-black h-6 text-transparent select-none"
            >
              <td class="border-r border-black">&nbsp;</td>
              <td class="border-r border-black">&nbsp;</td>
              <td class="border-r border-black">&nbsp;</td>
              <td class="border-r border-black">&nbsp;</td>
              <td class="border-r border-black">&nbsp;</td>
              <td class="border-r border-black">&nbsp;</td>
              <td class="border-r border-black">&nbsp;</td>
              <td class="border-r border-black">&nbsp;</td>
              <td class="border-r border-black">&nbsp;</td>
              <td class="border-r border-black">&nbsp;</td>
              <td class="border-r border-black">&nbsp;</td>
              <td class="border-r border-black">&nbsp;</td>
              <td class="border-r border-black">&nbsp;</td>
              <td class="border-r border-black">&nbsp;</td>
              <td class="border-r border-black">&nbsp;</td>
              <td>&nbsp;</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ============================================================ -->
      <!-- KOTAK LEGENDA (PERSIS SEPERTI GAMBAR 2) -->
      <!-- ============================================================ -->
      <div class="legend-box border-2 border-t-0 border-black p-2 bg-white text-[10px] leading-tight flex justify-between">
        <!-- Kolom Legenda Kiri -->
        <div class="w-1/2 space-y-0.5 pr-4 border-r border-black">
          <p class="font-bold underline mb-1">Legenda:</p>
          <p><strong class="inline-block w-4">A</strong> = Kesesuaian spesifikasi Material dengan surat jalan?</p>
          <p><strong class="inline-block w-4">B</strong> = Ketepatan waktu penerimaan dengan yang diminta di PO?</p>
          <p><strong class="inline-block w-4">C</strong> = Batas Waktu Kadaluarsa / Expired?</p>
          <p><strong class="inline-block w-4">D</strong> = Kemasan dan segel tidak rusak?</p>
          <p><strong class="inline-block w-4">E</strong> = Kesesuaian dengan Standard Acuan Mutu?</p>
        </div>

        <!-- Kolom Legenda Kanan -->
        <div class="w-1/2 space-y-0.5 pl-4 pt-4">
          <p><strong class="inline-block w-6">SI</strong> = Status Inspeksi yang dilakukan (A= Longgar, B= Normal, C=Ketat)</p>
          <p><strong class="inline-block w-6">HI</strong> = Hasil Inspeksi (0= Jika tidak ada masalah, 1 = Jika ada temuan)</p>
          <p><strong class="inline-block w-6">SB</strong> = Apakah barang dapat diterima?</p>
        </div>
      </div>

      <!-- Footnote instruksi -->
      <div class="text-[9px] text-gray-700 italic mt-1 px-1 flex justify-between">
        <span>* Inspeksi Material dilakukan tiap penerimaan barang.</span>
        <span>Dicetak pada: {{ printDate }} {{ printTime }}</span>
      </div>

      <!-- ============================================================ -->
      <!-- TANDA TANGAN PENANGGUNG JAWAB LAPANGAN -->
      <!-- ============================================================ -->
      <div class="signature-section mt-5 grid grid-cols-3 gap-6 text-center text-[10px]">
        <div>
          <p class="font-semibold text-gray-700">Diperiksa / Diinspeksi Oleh:</p>
          <div class="h-14 border-b border-black mt-2"></div>
          <p class="mt-1 font-bold">{{ displayPic }}</p>
          <p class="text-[9px] text-gray-500">Quality Control Inspector</p>
        </div>

        <div>
          <p class="font-semibold text-gray-700">Diterima / Diketahui Oleh:</p>
          <div class="h-14 border-b border-black mt-2"></div>
          <p class="mt-1 font-bold">(...................................................)</p>
          <p class="text-[9px] text-gray-500">Bagian Gudang / Penerimaan</p>
        </div>

        <div>
          <p class="font-semibold text-gray-700">Disetujui Oleh:</p>
          <div class="h-14 border-b border-black mt-2"></div>
          <p class="mt-1 font-bold">(...................................................)</p>
          <p class="text-[9px] text-gray-500">QC Supervisor / Manager</p>
        </div>
      </div>
    </div>
  </PrintPreviewContainer>
</template>

<style scoped>
@media print {
  @page {
    size: A4 landscape;
    margin: 8mm;
  }

  html,
  body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    background: #ffffff !important;
  }

  .qc-field-printout {
    padding: 0 !important;
    width: 100% !important;
  }

  .document-page {
    min-height: auto !important;
  }
}
</style>
