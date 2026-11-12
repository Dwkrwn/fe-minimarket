<template>
  <div class="min-h-screen bg-slate-100 p-4 md:p-8 print:bg-white print:p-0">
    <div class="mx-auto max-w-4xl space-y-4 print:max-w-none">
      <div class="flex items-center justify-between gap-2 print:hidden">
        <Button variant="outline" size="sm" @click="goBack">
          <ArrowLeft class="w-4 h-4 mr-1.5" /> Kembali
        </Button>
        <Button size="sm" class="bg-emerald-600 hover:bg-emerald-700 text-white" :disabled="!opname" @click="printPage">
          <Printer class="w-4 h-4 mr-1.5" /> Cetak
        </Button>
      </div>

      <div v-if="loading" class="rounded-lg bg-white p-8 shadow-sm">
        <Skeleton class="h-8 w-1/2 mb-4" />
        <Skeleton class="h-4 w-full mb-2" v-for="n in 8" :key="n" />
      </div>

      <div v-else-if="!opname" class="rounded-lg bg-white p-8 text-center text-slate-500 shadow-sm">
        Dokumen stock opname tidak ditemukan.
      </div>

      <div v-else class="rounded-lg bg-white p-6 md:p-8 shadow-sm print:shadow-none print:rounded-none">
        <!-- Letterhead -->
        <div class="flex items-start justify-between border-b-2 border-slate-800 pb-3">
          <div>
            <h1 class="text-xl font-bold text-slate-900">FORMULIR STOCK OPNAME</h1>
            <p class="text-sm text-slate-600">Hitung Fisik Barang — Minimarket</p>
          </div>
          <div class="text-right text-sm text-slate-700">
            <p class="font-mono font-semibold">{{ opname.no_opname }}</p>
            <p>{{ formatDate(opname.tgl_opname || opname.createdAt) }}</p>
            <p class="uppercase text-xs tracking-wide">{{ opname.status }}</p>
          </div>
        </div>

        <!-- Meta -->
        <div class="grid grid-cols-2 gap-2 mt-4 text-sm text-slate-700">
          <p><span class="text-slate-500">Lokasi:</span> {{ locationLabel }}</p>
          <p><span class="text-slate-500">Dibuat oleh:</span> {{ opname.user?.name || "Sistem" }}</p>
          <p><span class="text-slate-500">Total baris:</span> {{ opname.details.length }}</p>
          <p><span class="text-slate-500">Baris selisih:</span> {{ selisihCount }}</p>
          <p class="col-span-2"><span class="text-slate-500">Catatan:</span> {{ opname.catatan || "-" }}</p>
        </div>

        <!-- Table -->
        <table class="w-full mt-4 text-sm border-collapse">
          <thead>
            <tr class="bg-slate-100 text-xs uppercase text-slate-700">
              <th class="border border-slate-300 px-2 py-1.5 text-left w-10">No</th>
              <th class="border border-slate-300 px-2 py-1.5 text-left">Barcode</th>
              <th class="border border-slate-300 px-2 py-1.5 text-left">Nama Barang</th>
              <th class="border border-slate-300 px-2 py-1.5 text-left">Rak</th>
              <th class="border border-slate-300 px-2 py-1.5 text-right">Sistem</th>
              <th class="border border-slate-300 px-2 py-1.5 text-right">Fisik</th>
              <th class="border border-slate-300 px-2 py-1.5 text-right">Selisih</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in opname.details" :key="row.id">
              <td class="border border-slate-300 px-2 py-1 text-center">{{ index + 1 }}</td>
              <td class="border border-slate-300 px-2 py-1 font-mono text-xs">{{ row.item?.barcode || "-" }}</td>
              <td class="border border-slate-300 px-2 py-1">{{ row.item?.nama_barang || "-" }}</td>
              <td class="border border-slate-300 px-2 py-1 text-xs">
                {{ row.category_rack?.nama || row.item?.category_rack?.nama || "-" }}
              </td>
              <td class="border border-slate-300 px-2 py-1 text-right font-mono">
                {{ Number(row.qty_sistem).toLocaleString("id-ID") }}
              </td>
              <td class="border border-slate-300 px-2 py-1 text-right font-mono">
                {{ Number(row.qty_fisik).toLocaleString("id-ID") }}
              </td>
              <td class="border border-slate-300 px-2 py-1 text-right font-mono">
                {{ row.selisih > 0 ? "+" : "" }}{{ row.selisih.toLocaleString("id-ID") }}
              </td>
            </tr>
            <tr v-if="opname.details.length === 0">
              <td colspan="7" class="border border-slate-300 px-2 py-6 text-center text-slate-500">
                Tidak ada baris barang pada dokumen ini.
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Totals -->
        <div class="flex justify-end mt-3">
          <table class="text-sm">
            <tbody>
              <tr>
                <td class="pr-4 text-slate-500">Total Qty Sistem</td>
                <td class="text-right font-mono font-semibold">{{ totalSistem.toLocaleString("id-ID") }} Pcs</td>
              </tr>
              <tr>
                <td class="pr-4 text-slate-500">Total Qty Fisik</td>
                <td class="text-right font-mono font-semibold">{{ totalFisik.toLocaleString("id-ID") }} Pcs</td>
              </tr>
              <tr>
                <td class="pr-4 text-slate-500">Total Selisih</td>
                <td class="text-right font-mono font-semibold">
                  {{ totalSelisih > 0 ? "+" : "" }}{{ totalSelisih.toLocaleString("id-ID") }} Pcs
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Signatures -->
        <div class="grid grid-cols-3 gap-6 mt-12 text-sm text-slate-700">
          <div class="text-center">
            <p class="mb-16">Petugas Hitung</p>
            <p class="border-t border-slate-400 pt-1">(....................)</p>
          </div>
          <div class="text-center">
            <p class="mb-16">Supervisor</p>
            <p class="border-t border-slate-400 pt-1">(....................)</p>
          </div>
          <div class="text-center">
            <p class="mb-16">Admin/Gudang</p>
            <p class="border-t border-slate-400 pt-1">{{ opname.approver?.name || "(....................)" }}</p>
          </div>
        </div>

        <p class="mt-6 text-[11px] text-slate-400">
          Dicetak pada {{ printedAt }}. Dokumen ini dihasilkan sistem dan sah tanpa tanda tangan basah
          hanya untuk keperluan arsip internal.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Printer } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getStockOpnameDetail, type OpnameDetail } from "../opnameService";

const route = useRoute();
const router = useRouter();

const opname = ref<OpnameDetail | null>(null);
const loading = ref(false);

const selisihCount = computed(
  () => (opname.value?.details || []).filter((row) => row.selisih !== 0).length,
);
const totalSistem = computed(() =>
  (opname.value?.details || []).reduce((sum, row) => sum + Number(row.qty_sistem || 0), 0),
);
const totalFisik = computed(() =>
  (opname.value?.details || []).reduce((sum, row) => sum + Number(row.qty_fisik || 0), 0),
);
const totalSelisih = computed(() =>
  (opname.value?.details || []).reduce((sum, row) => sum + Number(row.selisih || 0), 0),
);
const locationLabel = computed(() => {
  const locations = [...new Set((opname.value?.details || []).map((row) => row.location))];
  return locations.length > 0 ? locations.join(" / ") : "-";
});
const printedAt = new Date().toLocaleString("id-ID");

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

function printPage() {
  window.print();
}

function goBack() {
  const id = String(route.params.id || "");
  if (id) {
    router.push({ name: "InventoryOpnameCount", params: { id } });
    return;
  }
  router.push({ name: "InventoryOpnameFisik" });
}

onMounted(async () => {
  const id = String(route.params.id || "");
  if (!id) return;
  loading.value = true;
  try {
    opname.value = await getStockOpnameDetail(id);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Gagal memuat dokumen opname");
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
@media print {
  @page {
    size: A4 portrait;
    margin: 12mm;
  }
}
</style>
