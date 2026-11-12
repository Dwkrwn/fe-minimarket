<template>
  <div class="min-h-screen bg-slate-100 p-4 md:p-8 print:bg-white print:p-0">
    <div class="mx-auto max-w-4xl space-y-4 print:max-w-none">
      <div class="flex items-center justify-between gap-2 print:hidden">
        <Button variant="outline" size="sm" @click="goBack">
          <ArrowLeft class="w-4 h-4 mr-1.5" /> Kembali
        </Button>
        <Button size="sm" class="bg-emerald-600 hover:bg-emerald-700 text-white" :disabled="!po" @click="printPage">
          <Printer class="w-4 h-4 mr-1.5" /> Cetak
        </Button>
      </div>

      <div v-if="loading" class="rounded-lg bg-white p-8 shadow-sm">
        <Skeleton class="h-8 w-1/2 mb-4" />
        <Skeleton v-for="n in 8" :key="n" class="h-4 w-full mb-2" />
      </div>

      <div v-else-if="!po" class="rounded-lg bg-white p-8 text-center text-slate-500 shadow-sm">
        Dokumen Purchase Order tidak ditemukan.
      </div>

      <div v-else class="rounded-lg bg-white p-6 md:p-8 shadow-sm print:shadow-none print:rounded-none">
        <div class="flex items-start justify-between border-b-2 border-slate-800 pb-3">
          <div>
            <h1 class="text-xl font-bold text-slate-900">SURAT PESANAN PEMBELIAN</h1>
            <p class="text-sm text-slate-600">Purchase Order — Minimarket</p>
          </div>
          <div class="text-right text-sm text-slate-700">
            <p class="font-mono font-semibold">{{ po.no_po }}</p>
            <p>{{ formatDate(po.tgl_po) }}</p>
            <p class="uppercase text-xs tracking-wide">{{ po.status }}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 mt-4 text-sm text-slate-700">
          <p><span class="text-slate-500">Kepada:</span> {{ po.supplier?.nama_supplier }}</p>
          <p><span class="text-slate-500">Kontak Sales:</span> {{ po.supplier?.kontak_sales || "-" }}</p>
          <p><span class="text-slate-500">Telepon/WA:</span> {{ po.supplier?.no_wa || po.supplier?.no_telp || "-" }}</p>
          <p><span class="text-slate-500">Termin Pembayaran:</span> TOP {{ po.supplier?.term_of_payment ?? 0 }} hari</p>
          <p><span class="text-slate-500">Estimasi Tiba:</span> {{ formatDate(po.tgl_estimasi_tiba) }}</p>
          <p><span class="text-slate-500">Diterbitkan oleh:</span> {{ po.user?.name || "Sistem" }}</p>
          <p class="col-span-2"><span class="text-slate-500">Alamat:</span> {{ po.supplier?.alamat || "-" }}</p>
          <p class="col-span-2"><span class="text-slate-500">Catatan:</span> {{ po.catatan || "-" }}</p>
        </div>

        <table class="w-full mt-4 text-sm border-collapse">
          <thead>
            <tr class="bg-slate-100 text-xs uppercase text-slate-700">
              <th class="border border-slate-300 px-2 py-1.5 text-left w-10">No</th>
              <th class="border border-slate-300 px-2 py-1.5 text-left">Barcode</th>
              <th class="border border-slate-300 px-2 py-1.5 text-left">Nama Barang</th>
              <th class="border border-slate-300 px-2 py-1.5 text-center">Qty</th>
              <th class="border border-slate-300 px-2 py-1.5 text-center">Pcs</th>
              <th class="border border-slate-300 px-2 py-1.5 text-right">Harga/Pcs</th>
              <th class="border border-slate-300 px-2 py-1.5 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in po.details" :key="row.id || row.item_id">
              <td class="border border-slate-300 px-2 py-1 text-center">{{ index + 1 }}</td>
              <td class="border border-slate-300 px-2 py-1 font-mono text-xs">{{ row.item?.barcode || "-" }}</td>
              <td class="border border-slate-300 px-2 py-1">{{ row.item?.nama_barang || "-" }}</td>
              <td class="border border-slate-300 px-2 py-1 text-center whitespace-nowrap">
                {{ Number(row.qty_order_beli).toLocaleString("id-ID") }}
                {{ row.uom?.satuan_beli || row.item?.uom?.satuan_beli || "Pcs" }}
              </td>
              <td class="border border-slate-300 px-2 py-1 text-center font-mono">
                {{ Number(row.qty_order_pcs).toLocaleString("id-ID") }}
              </td>
              <td class="border border-slate-300 px-2 py-1 text-right font-mono">
                Rp {{ Number(row.harga_satuan).toLocaleString("id-ID") }}
              </td>
              <td class="border border-slate-300 px-2 py-1 text-right font-mono">
                Rp {{ Number(row.subtotal).toLocaleString("id-ID") }}
              </td>
            </tr>
            <tr v-if="!po.details?.length">
              <td colspan="7" class="border border-slate-300 px-2 py-6 text-center text-slate-500">
                Tidak ada baris barang pada dokumen ini.
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="6" class="border border-slate-300 px-2 py-2 text-right font-semibold">Total Estimasi</td>
              <td class="border border-slate-300 px-2 py-2 text-right font-mono font-bold">
                Rp {{ Number(po.total_amount).toLocaleString("id-ID") }}
              </td>
            </tr>
          </tfoot>
        </table>

        <div class="grid grid-cols-3 gap-6 mt-12 text-sm text-slate-700">
          <div class="text-center">
            <p class="mb-16">Dibuat Oleh</p>
            <p class="border-t border-slate-400 pt-1">{{ po.user?.name || "(....................)" }}</p>
          </div>
          <div class="text-center">
            <p class="mb-16">Disetujui</p>
            <p class="border-t border-slate-400 pt-1">(....................)</p>
          </div>
          <div class="text-center">
            <p class="mb-16">Supplier</p>
            <p class="border-t border-slate-400 pt-1">(....................)</p>
          </div>
        </div>

        <p class="mt-6 text-[11px] text-slate-400">
          Dicetak pada {{ printedAt }}. Mohon konfirmasi jadwal pengiriman setelah dokumen diterima.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Printer } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPurchaseOrder, type PurchaseOrder } from "./purchaseOrderService";

const route = useRoute();
const router = useRouter();

const po = ref<PurchaseOrder | null>(null);
const loading = ref(false);
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
    router.push(`/purchasing/order/purchase-orders/view/${id}`);
    return;
  }
  router.push("/purchasing/order/purchase-orders");
}

onMounted(async () => {
  const id = String(route.params.id || "");
  if (!id) return;
  loading.value = true;
  try {
    po.value = await getPurchaseOrder(id);
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Gagal memuat dokumen PO");
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
