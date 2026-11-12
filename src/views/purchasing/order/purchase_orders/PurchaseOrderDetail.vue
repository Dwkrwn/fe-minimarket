<template>
  <div class="space-y-6 p-1 md:p-2">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 3 : Purchasing (2.2)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          {{ po?.no_po || "Detail Purchase Order" }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Rincian pesanan, riwayat penerimaan, retur, dan status tagihan.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" class="flex items-center gap-1.5" @click="router.push('/purchasing/order/purchase-orders')">
          <ArrowLeft class="w-4 h-4" />
          <span>Kembali</span>
        </Button>
        <Button variant="outline" size="sm" class="flex items-center gap-1.5" :disabled="!po" @click="openPrint">
          <Printer class="w-4 h-4" />
          <span>Cetak</span>
        </Button>
        <Button variant="outline" size="sm" class="flex items-center gap-1.5" :disabled="!po" @click="openSendDialog">
          <Send class="w-4 h-4" />
          <span>Kirim</span>
        </Button>
        <Button
          v-if="canReceive && po && po.status !== 'COMPLETED' && po.status !== 'CANCELLED'"
          size="sm"
          class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
          @click="router.push({ path: '/purchasing/receiving/goods-receipts/form', query: { po: po.id } })"
        >
          <PackagePlus class="w-4 h-4" />
          <span>Terima Barang</span>
        </Button>
      </div>
    </div>

    <div v-if="loading" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card class="lg:col-span-2 border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-6 space-y-3">
          <Skeleton v-for="n in 6" :key="n" class="h-8 w-full" />
        </CardContent>
      </Card>
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-6 space-y-3">
          <Skeleton v-for="n in 4" :key="n" class="h-8 w-full" />
        </CardContent>
      </Card>
    </div>

    <div v-else-if="!po" class="py-16 text-center text-slate-500">
      <ClipboardList class="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
      <p class="font-medium">Purchase Order tidak ditemukan</p>
    </div>

    <template v-else>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Status PO</p>
            <Badge variant="outline" :class="statusClass(po.status)" class="mt-2">{{ po.status_label }}</Badge>
            <p v-if="po.tgl_estimasi_tiba" class="text-xs text-slate-500 mt-2">
              ETA {{ formatDate(po.tgl_estimasi_tiba) }}
            </p>
          </CardContent>
        </Card>
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Supplier</p>
            <p class="font-semibold text-slate-900 dark:text-white mt-1">{{ po.supplier?.nama_supplier }}</p>
            <p class="text-xs text-slate-500">TOP {{ po.supplier?.term_of_payment ?? 0 }} hari</p>
          </CardContent>
        </Card>
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Tanggal PO</p>
            <p class="font-semibold text-slate-900 dark:text-white mt-1">{{ formatDate(po.tgl_po) }}</p>
            <p class="text-xs text-slate-500">Oleh {{ po.user?.name || "-" }}</p>
          </CardContent>
        </Card>
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total Nilai</p>
            <p class="text-xl font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              Rp {{ formatNumber(po.total_amount) }}
            </p>
            <p class="text-xs text-slate-500">{{ po.details?.length ?? 0 }} baris barang</p>
          </CardContent>
        </Card>
      </div>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Rincian Barang Dipesan</CardTitle>
        </CardHeader>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
              <tr>
                <th class="px-4 py-3">Barang</th>
                <th class="px-4 py-3 text-center">Qty Pesan</th>
                <th class="px-4 py-3 text-center">Qty (Pcs)</th>
                <th class="px-4 py-3 text-right">Harga / Pcs</th>
                <th class="px-4 py-3 text-right">Subtotal</th>
                <th class="px-4 py-3 text-center">Diterima</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr v-for="detail in po.details" :key="detail.id || detail.item_id">
                <td class="px-4 py-3">
                  <div class="font-medium text-slate-900 dark:text-white">{{ detail.item?.nama_barang }}</div>
                  <span class="font-mono text-xs text-slate-500">{{ detail.item?.barcode }}</span>
                </td>
                <td class="px-4 py-3 text-center">
                  {{ formatNumber(detail.qty_order_beli) }}
                  <span class="text-xs text-slate-500">{{ detail.uom?.satuan_beli || detail.item?.uom?.satuan_beli || "Pcs" }}</span>
                </td>
                <td class="px-4 py-3 text-center font-semibold">{{ formatNumber(detail.qty_order_pcs) }}</td>
                <td class="px-4 py-3 text-right font-mono">Rp {{ formatNumber(detail.harga_satuan) }}</td>
                <td class="px-4 py-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                  Rp {{ formatNumber(detail.subtotal) }}
                </td>
                <td class="px-4 py-3 text-center">
                  <span :class="receivedPcs(detail.item_id) >= Number(detail.qty_order_pcs) ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-600 dark:text-slate-300'">
                    {{ formatNumber(receivedPcs(detail.item_id)) }}
                  </span>
                  <span class="text-xs text-slate-400"> / {{ formatNumber(detail.qty_order_pcs) }}</span>
                </td>
              </tr>
            </tbody>
            <tfoot class="bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800">
              <tr>
                <td colspan="4" class="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Total</td>
                <td class="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  Rp {{ formatNumber(po.total_amount) }}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card class="lg:col-span-2 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base">Riwayat Penerimaan Barang</CardTitle>
            <CardDescription>Setiap penerimaan menambah stok gudang dan memperbarui status PO.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-2">
            <div v-if="!po.goods_receipts?.length" class="py-6 text-center text-sm text-slate-500">
              <PackageOpen class="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              Belum ada penerimaan barang.
            </div>
            <button
              v-for="gr in po.goods_receipts"
              :key="gr.id"
              type="button"
              class="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors"
              @click="router.push(`/purchasing/receiving/goods-receipts/view/${gr.id}`)"
            >
              <div class="flex items-center justify-between gap-2">
                <div>
                  <p class="font-mono text-sm font-semibold text-slate-900 dark:text-white">{{ gr.no_gr }}</p>
                  <p class="text-xs text-slate-500">
                    {{ formatDate(gr.tgl_gr) }} &middot; SJ {{ gr.no_surat_jalan || "-" }}
                  </p>
                </div>
                <ChevronRight class="w-4 h-4 text-slate-400" />
              </div>
            </button>
          </CardContent>
        </Card>

        <div class="space-y-4">
          <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
            <CardHeader class="pb-2">
              <CardTitle class="text-base">Retur Pembelian</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2">
              <div v-if="!po.purchase_returns?.length" class="text-sm text-slate-500 py-2">Tidak ada retur.</div>
              <div
                v-for="ret in po.purchase_returns"
                :key="ret.id"
                class="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-sm"
              >
                <div class="flex items-center justify-between">
                  <span class="font-mono text-xs font-semibold">{{ ret.no_retur }}</span>
                  <span class="font-mono text-xs text-rose-600 dark:text-rose-400">
                    -Rp {{ formatNumber(ret.total_potongan) }}
                  </span>
                </div>
                <p class="text-xs text-slate-500 mt-1">{{ formatDate(ret.tgl_retur) }} &middot; {{ ret.status }}</p>
              </div>
            </CardContent>
          </Card>

          <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
            <CardHeader class="pb-2">
              <CardTitle class="text-base">Tagihan</CardTitle>
            </CardHeader>
            <CardContent class="space-y-2">
              <div v-if="!po.invoices?.length" class="text-sm text-slate-500 py-2">
                Belum diverifikasi. Verifikasi nota tersedia setelah PO selesai.
              </div>
              <div v-for="invoice in po.invoices" :key="invoice.id" class="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 text-sm">
                <div class="flex items-center justify-between">
                  <span class="font-mono text-xs font-semibold">{{ invoice.no_invoice }}</span>
                  <Badge variant="outline" class="text-[10px]">{{ invoice.status }}</Badge>
                </div>
                <p class="font-mono text-xs mt-1">Rp {{ formatNumber(invoice.net_payable) }}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card v-if="po.catatan" class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 text-sm">
          <p class="text-xs font-semibold uppercase text-slate-500 mb-1">Catatan PO</p>
          <p class="text-slate-700 dark:text-slate-200 whitespace-pre-line">{{ po.catatan }}</p>
        </CardContent>
      </Card>
    </template>

    <GlobalDialog
      v-model:open="isSendDialogOpen"
      title="Kirim Purchase Order"
      description="Draft pesan WhatsApp siap dikirim. Cetak dokumen bila diperlukan."
      type="info"
      content-class="max-w-2xl"
    >
      <div v-if="sending" class="py-8 text-center text-sm text-slate-500">
        <RefreshCw class="w-6 h-6 animate-spin mx-auto mb-2" />
        Menyiapkan draft pesan...
      </div>
      <div v-else-if="sendResult" class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
            <p class="text-xs text-slate-500">Supplier</p>
            <p class="font-semibold text-slate-900 dark:text-white">{{ sendResult.supplier_name }}</p>
          </div>
          <div class="p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
            <p class="text-xs text-slate-500">Nomor Tujuan</p>
            <p class="font-mono font-semibold text-slate-900 dark:text-white">{{ sendResult.target_wa || "-" }}</p>
          </div>
        </div>
        <textarea
          v-model="sendMessage"
          rows="10"
          class="w-full text-xs font-mono rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div class="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" class="flex items-center gap-1.5" @click="copyMessage">
            <Copy class="w-4 h-4" />
            <span>Salin Pesan</span>
          </Button>
          <Button variant="outline" class="flex items-center gap-1.5" @click="openPrint">
            <Printer class="w-4 h-4" />
            <span>Cetak PO</span>
          </Button>
          <a
            v-if="waLink"
            :href="waLink"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
          >
            <Send class="w-4 h-4" />
            Buka WhatsApp
          </a>
        </div>
      </div>
    </GlobalDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  Copy,
  PackageOpen,
  PackagePlus,
  Printer,
  RefreshCw,
  Send,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import { useAuthStore } from "@/stores/auth";
import {
  getPurchaseOrder,
  sendPurchaseOrder,
  type PurchaseOrder,
  type PurchaseOrderStatus,
  type SendPurchaseOrderResult,
} from "./purchaseOrderService";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const po = ref<PurchaseOrder | null>(null);
const loading = ref(false);
const isSendDialogOpen = ref(false);
const sending = ref(false);
const sendResult = ref<SendPurchaseOrderResult | null>(null);
const sendMessage = ref("");

const canReceive = computed(() => authStore.isManager || authStore.user?.role.system_key === "GUDANG");
const poId = computed(() => String(route.params.id || ""));

const waLink = computed(() => {
  if (!sendResult.value?.target_wa) return "";
  const phone = String(sendResult.value.target_wa).replace(/[^0-9]/g, "").replace(/^0/, "62");
  return `https://wa.me/${phone}?text=${encodeURIComponent(sendMessage.value)}`;
});

function formatNumber(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("id-ID");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function statusClass(status: PurchaseOrderStatus) {
  switch (status) {
    case "COMPLETED":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "PARTIAL_RECEIVED":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
    case "CANCELLED":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
    default:
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  }
}

function receivedPcs(itemId: string) {
  return (po.value?.goods_receipts || []).reduce((acc, gr) => {
    const line = (gr.details || []).find((detail) => detail.item_id === itemId);
    return acc + Number(line?.qty_bagus_pcs || 0);
  }, 0);
}

async function load() {
  if (!poId.value) return;
  loading.value = true;
  try {
    po.value = await getPurchaseOrder(poId.value);
  } catch (error: any) {
    console.error("Gagal memuat detail PO:", error);
    toast.error(error.message || "Gagal memuat detail Purchase Order");
  } finally {
    loading.value = false;
  }
}

function openPrint() {
  if (!po.value) return;
  window.open(`/purchasing/order/purchase-orders/print/${po.value.id}`, "_blank");
}

async function openSendDialog() {
  if (!po.value) return;
  isSendDialogOpen.value = true;
  sending.value = true;
  sendResult.value = null;
  sendMessage.value = "";
  try {
    const result = await sendPurchaseOrder(po.value.id);
    sendResult.value = result;
    sendMessage.value = result.message_draft;
  } catch (error: any) {
    console.error("Gagal menyiapkan draft PO:", error);
    toast.error(error.message || "Gagal menyiapkan draft pesan PO");
    isSendDialogOpen.value = false;
  } finally {
    sending.value = false;
  }
}

async function copyMessage() {
  try {
    await navigator.clipboard.writeText(sendMessage.value);
    toast.success("Draft pesan disalin");
  } catch {
    toast.error("Gagal menyalin pesan. Salin manual dari kotak draft.");
  }
}

onMounted(load);
</script>
