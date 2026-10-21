<script setup lang="ts">
/**
 * StockOpnamePrintout.vue
 * Formulir kerja (worksheet) Stock Opname untuk diisi orang gudang saat opname.
 * Bukan dokumen formal — ini adalah form yang dibawa ke lapangan.
 */
import { ref, computed, onMounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Loader2 } from "lucide-vue-next";
import { getStockOpnameById } from "../service";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

const route = useRoute();
const router = useRouter();

const loading = ref(true);
const generating = ref(false);
const data = ref<any>(null);
const printRef = ref<HTMLDivElement | null>(null);
const menuId = computed(() => route.params.id as string);

// ── Computed helpers ──────────────────────────────────────────────────────────
const formattedDate = computed(() => {
  if (!data.value?.tgl_opname) return "-";
  return new Date(data.value.tgl_opname).toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
  });
});

const printDate = computed(() =>
  new Date().toLocaleDateString("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }),
);

const gudangName = computed(() =>
  data.value?.gudang_opname?.nama_gudang ||
  data.value?.m_gudang?.nama_gudang || "-"
);

const rakLabel = computed(() => {
  const kode = data.value?.rak_opname?.kode_rak || data.value?.m_rak?.kode_rak || "";
  const nama = data.value?.rak_opname?.nama_rak || data.value?.m_rak?.nama_rak || "";
  if (!kode && !nama) return "-";
  return kode && nama ? `${kode} — ${nama}` : (kode || nama);
});

const picName = computed(() =>
  data.value?.pic_opname?.nama_kary || data.value?.m_kary?.nama_kary || "-"
);

const detailItems = computed<any[]>(() => data.value?.t_stock_opname_ds || []);

// Group by rak detail code
const groupedByRak = computed<{ kodeRak: string; items: any[] }[]>(() => {
  const groups: Record<string, any[]> = {};
  detailItems.value.forEach((item: any) => {
    const kodeRakD =
      item.rak_d_opname?.kode ||
      item.m_rak_d?.kode ||
      "Tanpa Rak";
    if (!groups[kodeRakD]) groups[kodeRakD] = [];
    groups[kodeRakD].push(item);
  });
  return Object.entries(groups).map(([kodeRak, items]) => ({ kodeRak, items }));
});

const getItemNama = (item: any) =>
  item?.item_opname?.nama_item || item?.m_item?.nama_item || "-";

const getItemKode = (item: any) =>
  item?.item_opname?.kode_item || item?.m_item?.kode_item || "-";

const getItemUom = (item: any) =>
  item?.item_opname?.mi_uom?.value1 ||
  item?.item_opname?.m_general?.value1 ||
  item?.m_item?.uom?.value1 || "-";

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  if (!menuId.value) {
    toast.error("ID tidak ditemukan");
    router.push("/inventory/transaksi/t_stock_opname");
    return;
  }
  try {
    const res = await getStockOpnameById(menuId.value);
    if (res.status !== "success") throw new Error("Gagal memuat data");
    data.value = res.data;
  } catch (error) {
    toast.error("Gagal memuat data", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
    setTimeout(() => router.push("/inventory/transaksi/t_stock_opname"), 2000);
  } finally {
    loading.value = false;
  }
});

// ── PDF Export ────────────────────────────────────────────────────────────────
const waitForImages = async (root?: HTMLElement | null) => {
  if (!root) return;
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(images.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); });
  }));
};

const handlePrint = async () => {
  if (!printRef.value) return;
  try {
    generating.value = true;
    await nextTick();
    const el = printRef.value;
    el.classList.add("pdf-mode");
    await nextTick();
    await waitForImages(el);

    const canvas = await html2canvas(el, {
      scale: 2, useCORS: true, allowTaint: true, backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const ih = (canvas.height * pw) / canvas.width;
    let hl = ih;
    let pos = 0;
    pdf.addImage(imgData, "PNG", 0, pos, pw, ih);
    hl -= ph;
    while (hl > 0) { pos = hl - ih; pdf.addPage(); pdf.addImage(imgData, "PNG", 0, pos, pw, ih); hl -= ph; }
    pdf.save(`${data.value?.no_stock_opname || "opname-form"}.pdf`);
    toast.success("PDF berhasil didownload");
  } catch (e) {
    toast.error("Gagal membuat PDF");
  } finally {
    printRef.value?.classList.remove("pdf-mode");
    generating.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <!-- Toolbar (tidak ikut dicetak) -->
    <div class="sticky top-0 z-10 bg-background/95 backdrop-blur border-b p-3 no-print">
      <div class="flex items-center justify-between max-w-3xl mx-auto">
        <div class="flex items-center gap-3">
          <Button variant="ghost" size="icon" @click="$router.push('/inventory/transaksi/t_stock_opname')">
            <ArrowLeft class="h-5 w-5" />
          </Button>
          <div>
            <p class="font-semibold text-sm">Formulir Opname</p>
            <p class="text-xs text-muted-foreground">{{ data?.no_stock_opname || '...' }}</p>
          </div>
        </div>
        <Button @click="handlePrint" :disabled="loading || generating" size="sm" class="gap-2">
          <Loader2 v-if="generating" class="h-4 w-4 animate-spin" />
          <Printer v-else class="h-4 w-4" />
          Download PDF
        </Button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center min-h-[60vh]">
      <Loader2 class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <!-- ================================================================ -->
    <!-- FORM CONTENT                                                      -->
    <!-- ================================================================ -->
    <div
      v-else-if="data"
      ref="printRef"
      class="form-root max-w-3xl mx-auto my-6 bg-white shadow-lg print:shadow-none print:my-0 print:max-w-none"
    >
      <div class="p-8 print:p-6">

        <!-- ── JUDUL FORMULIR ─────────────────────────────────────────── -->
        <div class="relative mb-6 pb-4 border-b-2 border-black">
          <div class="absolute left-0 top-0">
            <img
              src="/hutomoLogoHitam.png"
              alt="Logo Hutomo"
              class="h-14 w-14 object-contain"
            />
          </div>
          <div class="text-center px-16">
            <div class="text-xs font-bold tracking-widest text-gray-500 uppercase mb-1">
              PT. Hutomo Baut Indonesia
            </div>
            <h1 class="text-2xl font-bold tracking-wide uppercase">
              Formulir Stock Opname
            </h1>
            <div class="text-xs text-gray-500 mt-1">
              Isi dengan teliti · Gunakan pulpen · Jangan dikosongkan
            </div>
          </div>
        </div>

        <!-- ── HEADER INFO FORM ───────────────────────────────────────── -->
        <table class="w-full mb-6 text-sm border-collapse">
          <tbody>
            <tr>
              <td class="py-1.5 pr-2 text-gray-600 font-medium w-36">No. Opname</td>
              <td class="py-1.5 pr-6">
                <div class="field-value font-bold">{{ data.no_stock_opname || '-' }}</div>
              </td>
              <td class="py-1.5 pr-2 text-gray-600 font-medium w-36">Gudang</td>
              <td class="py-1.5">
                <div class="field-value font-bold">{{ gudangName }}</div>
              </td>
            </tr>
            <tr>
              <td class="py-1.5 pr-2 text-gray-600 font-medium">Tgl Opname</td>
              <td class="py-1.5 pr-6">
                <div class="field-value font-bold">{{ formattedDate }}</div>
              </td>
              <td class="py-1.5 pr-2 text-gray-600 font-medium">Rak Opname</td>
              <td class="py-1.5">
                <div class="field-value font-bold">{{ rakLabel }}</div>
              </td>
            </tr>
            <tr>
              <td class="py-1.5 pr-2 text-gray-600 font-medium">PIC / Petugas</td>
              <td class="py-1.5 pr-6">
                <div class="field-value font-bold">{{ picName }}</div>
              </td>
              <td class="py-1.5 pr-2 text-gray-600 font-medium">Dicetak</td>
              <td class="py-1.5">
                <div class="field-value text-gray-500 text-xs">{{ printDate }}</div>
              </td>
            </tr>
          </tbody>
        </table>


        <!-- ── DAFTAR ITEM PER RAK ─────────────────────────────────────── -->
        <div v-if="groupedByRak.length === 0" class="text-center py-10 text-gray-400 text-sm border-2 border-dashed rounded">
          Tidak ada item dalam Stock Opname ini
        </div>

        <div v-else class="space-y-8">
          <div v-for="(group, gIdx) in groupedByRak" :key="group.kodeRak">

            <!-- Rak Label -->
            <div class="flex items-center gap-2 mb-2">
              <div class="text-xs font-bold uppercase tracking-widest text-gray-500">
                Detail Rak {{ gIdx + 1 }}
              </div>
              <div class="flex-1 border-t border-gray-300"></div>
              <div class="inline-flex h-8 min-w-[104px] items-center justify-center rounded border border-gray-400 bg-gray-50 px-3 text-center text-sm font-bold leading-none">
                {{ group.kodeRak }}
              </div>
            </div>

            <!-- Items Table -->
            <table class="w-full border-collapse text-sm opname-items-table">
              <thead>
                <tr class="border-y-2 border-gray-800">
                  <th class="py-2 px-2 text-left font-bold text-xs w-8">No</th>
                  <th class="py-2 px-2 text-left font-bold text-xs w-28">Kode Item</th>
                  <th class="py-2 px-2 text-left font-bold text-xs">Nama Item</th>
                  <th class="py-2 px-2 text-center font-bold text-xs w-20 uom-col">UoM</th>
                  <th class="py-2 px-2 text-center font-bold text-xs w-24 bg-yellow-50">
                    Qty Aktual ✎
                  </th>
                  <th class="py-2 px-2 text-left font-bold text-xs">Catatan ✎</th>
                  <th class="py-2 px-2 text-center font-bold text-xs w-14">Paraf ✎</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, idx) in group.items"
                  :key="item.id || idx"
                  class="border-b border-gray-200"
                  :class="idx % 2 === 1 ? 'bg-gray-50' : 'bg-white'"
                >
                  <td class="py-3 px-2 text-center text-gray-400 text-xs">{{ idx + 1 }}</td>
                  <td class="py-3 px-2 font-mono text-xs text-gray-600">{{ getItemKode(item) }}</td>
                  <td class="py-3 px-2 font-medium">{{ getItemNama(item) }}</td>
                  <td class="py-3 px-2 text-center text-gray-600 text-xs uom-col">{{ getItemUom(item) }}</td>
                  <!-- Qty Aktual: kotak besar untuk ditulis tangan -->
                  <td class="py-1 px-2 bg-yellow-50 qty-col">
                    <div class="write-box-lg"></div>
                  </td>
                  <!-- Catatan: garis panjang -->
                  <td class="py-1 px-2">
                    <div class="write-line mb-1"></div>
                    <div class="write-line"></div>
                  </td>
                  <!-- Paraf -->
                  <td class="py-1 px-2">
                    <div class="write-box-sq mx-auto"></div>
                  </td>
                </tr>

                <!-- Row kosong cadangan -->
                <tr class="border-b border-dashed border-gray-200" v-for="n in 2" :key="`blank-${n}`">
                  <td class="py-3 px-2 text-center text-gray-300 text-xs">{{ group.items.length + n }}</td>
                  <td class="py-1 px-2"><div class="write-line"></div></td>
                  <td class="py-1 px-2"><div class="write-line"></div></td>
                  <td class="py-1 px-2 uom-col"><div class="write-box-sm mx-auto"></div></td>
                  <td class="py-1 px-2 bg-yellow-50 qty-col"><div class="write-box-lg"></div></td>
                  <td class="py-1 px-2">
                    <div class="write-line mb-1"></div>
                    <div class="write-line"></div>
                  </td>
                  <td class="py-1 px-2"><div class="write-box-sq mx-auto"></div></td>
                </tr>
              </tbody>
            </table>

            <!-- Summary rak -->
            <div class="flex justify-end mt-1 text-xs text-gray-500">
              Jumlah baris: {{ group.items.length }} item + 2 baris cadangan
            </div>
          </div>
        </div>

        <!-- ── KOLOM KETERANGAN UMUM ───────────────────────────────────── -->
        <div class="mt-8 border-t border-gray-300 pt-4">
          <p class="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">Keterangan / Temuan Umum</p>
          <div class="space-y-2">
            <div class="write-line-long"></div>
            <div class="write-line-long"></div>
            <div class="write-line-long"></div>
          </div>
        </div>

        <!-- ── TANDA TANGAN ────────────────────────────────────────────── -->
        <div class="mt-10 grid grid-cols-3 gap-6">
          <!-- Petugas -->
          <div class="text-center">
            <p class="text-xs font-bold uppercase tracking-wide text-gray-600 mb-1">Petugas Opname</p>
            <p class="text-sm font-semibold mb-10">{{ picName }}</p>
            <div class="border-t border-gray-500 mx-4 pt-1">
              <p class="text-xs text-gray-500">Tanda tangan &amp; tanggal</p>
            </div>
          </div>
          <!-- Pemeriksa -->
          <div class="text-center">
            <p class="text-xs font-bold uppercase tracking-wide text-gray-600 mb-1">Diperiksa Oleh</p>
            <div class="write-line mx-4 mb-10 mt-4"></div>
            <div class="border-t border-gray-500 mx-4 pt-1">
              <p class="text-xs text-gray-500">Nama &amp; tanda tangan</p>
            </div>
          </div>
          <!-- Disetujui -->
          <div class="text-center">
            <p class="text-xs font-bold uppercase tracking-wide text-gray-600 mb-1">Disetujui Oleh</p>
            <div class="write-line mx-4 mb-10 mt-4"></div>
            <div class="border-t border-gray-500 mx-4 pt-1">
              <p class="text-xs text-gray-500">Nama &amp; tanda tangan</p>
            </div>
          </div>
        </div>

        <!-- ── FOOTER ─────────────────────────────────────────────────── -->
        <div class="mt-8 pt-3 border-t border-gray-200 flex justify-between text-xs text-gray-300">
          <span>{{ data.no_stock_opname }} · Dicetak {{ printDate }}</span>
          <span>Formulir ini milik PT. Hutomo Baut Indonesia</span>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Writing boxes & lines ───────────────────────────────────────────── */
.write-box-lg {
  border: 2px solid #8a8a8a;
  border-radius: 3px;
  height: 32px;
  width: 100%;
  box-sizing: border-box;
  display: block;
  background: #fffdf0;
}

.write-box-sm {
  border: 1.5px solid #aaa;
  border-radius: 3px;
  height: 28px;
  width: 52px;
}

.write-box-sq {
  border: 1.5px solid #aaa;
  border-radius: 3px;
  height: 36px;
  width: 40px;
}

.write-line {
  border-bottom: 1.5px solid #bbb;
  height: 18px;
  width: 100%;
}

.write-line-long {
  border-bottom: 1.5px solid #ccc;
  height: 22px;
  width: 100%;
}

.field-value {
  border-bottom: 1.5px solid #333;
  min-width: 140px;
  padding-bottom: 2px;
  display: inline-block;
}

.opname-items-table {
  table-layout: fixed;
}

.opname-items-table th,
.opname-items-table td {
  vertical-align: middle;
}

.uom-col {
  min-width: 80px;
}

/* .qty-col {
  border-left: 1.5px solid #d1d5db;
  border-right: 1.5px solid #d1d5db;
} */

/* ── Force Light Theme inside Form ────────────────────────────────────────── */
.form-root {
  --primary: #ef6c00 !important;
  --destructive: #dc2626 !important;
  --muted: #f3f4f6 !important;
  --muted-foreground: #6b7280 !important;
  --foreground: #111827 !important;
  --background: #ffffff !important;
  --border: #e5e7eb !important;
  color: #111827 !important;
}

.form-root .text-gray-900 { color: #111827 !important; }
.form-root .text-gray-800 { color: #1f2937 !important; }
.form-root .text-gray-700 { color: #374151 !important; }
.form-root .text-gray-600 { color: #4b5563 !important; }
.form-root .text-gray-500 { color: #6b7280 !important; }
.form-root .text-gray-400 { color: #9ca3af !important; }
.form-root .text-gray-300 { color: #d1d5db !important; }

.form-root .bg-white { background-color: #ffffff !important; }
.form-root .bg-gray-50 { background-color: #f9fafb !important; }
.form-root .bg-yellow-50 { background-color: #fefce8 !important; }
.form-root .bg-amber-50 { background-color: #fffbeb !important; }

.form-root .border-gray-800 { border-color: #1f2937 !important; }
.form-root .border-gray-500 { border-color: #6b7280 !important; }
.form-root .border-gray-400 { border-color: #9ca3af !important; }
.form-root .border-gray-300 { border-color: #d1d5db !important; }
.form-root .border-gray-200 { border-color: #e5e7eb !important; }
.form-root .border-amber-300 { border-color: #fcd34d !important; }

.form-root .text-amber-800 { color: #92400e !important; }

/* ── PDF override ────────────────────────────────────────────────────── */
.form-root.pdf-mode * {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

/* ── Print media ─────────────────────────────────────────────────────── */
@media print {
  @page { size: A4; margin: 10mm; }
  html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .no-print { display: none !important; }
}
</style>
