<template>
  <div class="space-y-6 p-1 md:p-2">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 3 : Purchasing (4.1)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          {{ preview?.no_po ? `Verifikasi Nota ${preview.no_po}` : "Verifikasi Nota Supplier" }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Bandingkan pesanan, bukti penerimaan, dan retur sebelum tagihan dikunci.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          class="flex items-center gap-1.5"
          @click="router.push('/purchasing/invoicing/invoices')"
        >
          <ArrowLeft class="w-4 h-4" />
          <span>Kembali</span>
        </Button>
        <Button variant="outline" size="sm" :disabled="loading" @click="load" class="flex items-center gap-1.5">
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
          <span>Muat Ulang</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="flex items-center gap-1.5"
          @click="router.push(`/purchasing/order/purchase-orders/view/${poId}`)"
        >
          <ClipboardList class="w-4 h-4" />
          <span>Buka PO</span>
        </Button>
      </div>
    </div>

    <div v-if="loading" class="space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card v-for="n in 4" :key="'skel-card-' + n" class="border-slate-200 dark:border-slate-800">
          <CardContent class="p-4 space-y-2">
            <Skeleton class="h-4 w-24" />
            <Skeleton class="h-7 w-32" />
          </CardContent>
        </Card>
      </div>
      <Card class="border-slate-200 dark:border-slate-800">
        <CardContent class="p-6 space-y-3">
          <Skeleton v-for="n in 8" :key="'skel-row-' + n" class="h-8 w-full" />
        </CardContent>
      </Card>
    </div>

    <Card v-else-if="errorMessage" class="border-rose-200 dark:border-rose-900">
      <CardContent class="p-10 text-center">
        <AlertTriangle class="w-12 h-12 mx-auto text-rose-400 mb-3" />
        <p class="font-semibold text-slate-900 dark:text-white">Verifikasi nota tidak dapat ditampilkan</p>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">{{ errorMessage }}</p>
        <Button variant="outline" size="sm" class="mt-4" @click="load">Coba Lagi</Button>
      </CardContent>
    </Card>

    <template v-else-if="preview">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total Pesanan Awal</p>
            <p class="text-xl font-mono font-bold text-slate-800 dark:text-slate-100 mt-1">
              Rp {{ formatNumber(summary.total_pesanan_awal_po) }}
            </p>
            <p class="text-xs text-slate-500 mt-0.5">{{ preview.matching_lines.length }} baris barang</p>
          </CardContent>
        </Card>

        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Bukti Masuk Bagus</p>
            <p class="text-xl font-mono font-bold text-blue-600 dark:text-blue-400 mt-1">
              Rp {{ formatNumber(summary.total_bukti_masuk_bagus_gr) }}
            </p>
            <p class="text-xs text-slate-500 mt-0.5">{{ summary.jumlah_goods_receipt }} dokumen penerimaan</p>
          </CardContent>
        </Card>

        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Potongan Retur</p>
            <p class="text-xl font-mono font-bold text-rose-600 dark:text-rose-400 mt-1">
              -Rp {{ formatNumber(summary.total_potongan_nota_retur) }}
            </p>
            <p class="text-xs text-slate-500 mt-0.5">{{ summary.jumlah_retur }} retur ikut dihitung</p>
          </CardContent>
        </Card>

        <Card class="border-emerald-300 dark:border-emerald-800 shadow-xs bg-emerald-50/60 dark:bg-emerald-950/20">
          <CardContent class="p-4">
            <p class="text-xs font-medium text-emerald-700 dark:text-emerald-300">Total Bersih Dikunci</p>
            <p class="text-xl font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-1">
              Rp {{ formatNumber(summary.total_bersih_dikunci) }}
            </p>
            <p class="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Menjadi nilai tagihan supplier</p>
          </CardContent>
        </Card>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card class="lg:col-span-2 border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Supplier</p>
              <p class="font-semibold text-slate-900 dark:text-white mt-1">
                {{ preview.supplier?.nama_supplier || "-" }}
              </p>
            </div>
            <div>
              <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Term of Payment</p>
              <p class="font-semibold text-slate-900 dark:text-white mt-1">
                {{ preview.supplier?.term_of_payment ?? 0 }} hari
              </p>
            </div>
            <div>
              <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Estimasi Jatuh Tempo</p>
              <p class="font-semibold text-slate-900 dark:text-white mt-1">{{ estimatedDueDate }}</p>
            </div>
          </CardContent>
        </Card>

        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardContent class="p-4">
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Status Kelengkapan</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline" :class="preview.has_receipts ? okBadge : badBadge">
                {{ preview.has_receipts ? "GR tersedia" : "GR belum ada" }}
              </Badge>
              <Badge variant="outline" :class="unmatchedReceipts.length === 0 ? okBadge : badBadge">
                {{ unmatchedReceipts.length === 0 ? "Barang GR sesuai" : "Barang GR menyimpang" }}
              </Badge>
              <Badge variant="outline" :class="unmatchedReturns.length === 0 ? okBadge : badBadge">
                {{ unmatchedReturns.length === 0 ? "Barang retur sesuai" : "Barang retur menyimpang" }}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div
        v-if="preview.has_receipts && unmatchedReceipts.length === 0 && unmatchedReturns.length === 0 && summary.total_bersih_dikunci > 0"
        class="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/20 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300 flex items-start gap-2"
      >
        <ShieldCheck class="w-5 h-5 flex-none mt-0.5" />
        <span>{{ preview.keterangan_sistem }}</span>
      </div>

      <div
        v-else
        class="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 space-y-1"
      >
        <div class="flex items-start gap-2">
          <AlertTriangle class="w-5 h-5 flex-none mt-0.5" />
          <span>Nota belum dapat dikunci. Periksa temuan berikut:</span>
        </div>
        <ul class="list-disc pl-9 space-y-0.5">
          <li v-if="!preview.has_receipts">PO belum memiliki dokumen Goods Receipt.</li>
          <li v-if="unmatchedReceipts.length > 0">
            Barang GR di luar PO: <span class="font-mono">{{ unmatchedReceipts.join(", ") }}</span>
          </li>
          <li v-if="unmatchedReturns.length > 0">
            Barang retur di luar PO: <span class="font-mono">{{ unmatchedReturns.join(", ") }}</span>
          </li>
          <li v-if="summary.total_bersih_dikunci <= 0">Total bersih tagihan tidak lebih dari nol.</li>
        </ul>
      </div>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <CardHeader class="pb-2">
          <CardTitle class="text-base">3-Way Matching</CardTitle>
          <CardDescription>
            Pesanan (PO), bukti terima gudang (GR), dan potongan retur dihitung per barang dalam satuan Pcs.
          </CardDescription>
        </CardHeader>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-y border-slate-200 dark:border-slate-800">
              <tr>
                <th class="px-4 py-3">Barang</th>
                <th class="px-4 py-3 text-right">Pesanan</th>
                <th class="px-4 py-3 text-right">Terima Bagus</th>
                <th class="px-4 py-3 text-center">Ditolak</th>
                <th class="px-4 py-3 text-right">Retur</th>
                <th class="px-4 py-3 text-right">Bersih Dibayar</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr v-for="line in preview.matching_lines" :key="line.item_id">
                <td class="px-4 py-3">
                  <div class="font-medium text-slate-900 dark:text-white">{{ line.nama_barang || "-" }}</div>
                  <div class="font-mono text-xs text-slate-500">{{ line.barcode || "-" }}</div>
                  <div class="text-xs text-slate-500">Rp {{ formatNumber(line.harga_satuan) }} / Pcs</div>
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="font-semibold">{{ formatNumber(line.bukti_1_pesanan.qty_pcs) }} Pcs</div>
                  <div class="font-mono text-xs text-slate-500">
                    Rp {{ formatNumber(line.bukti_1_pesanan.subtotal) }}
                  </div>
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="font-semibold text-blue-600 dark:text-blue-400">
                    {{ formatNumber(line.bukti_2_terima_gudang.qty_bagus_pcs) }} Pcs
                  </div>
                  <div class="font-mono text-xs text-slate-500">
                    Rp {{ formatNumber(line.bukti_2_terima_gudang.subtotal) }}
                  </div>
                </td>
                <td class="px-4 py-3 text-center">
                  <span
                    :class="line.bukti_2_terima_gudang.qty_reject_pcs > 0
                      ? 'text-rose-600 dark:text-rose-400 font-semibold'
                      : 'text-slate-400'"
                  >
                    {{ formatNumber(line.bukti_2_terima_gudang.qty_reject_pcs) }} Pcs
                  </span>
                </td>
                <td class="px-4 py-3 text-right">
                  <div
                    class="font-semibold"
                    :class="line.bukti_3_retur_gudang.qty_retur_pcs > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'"
                  >
                    {{ formatNumber(line.bukti_3_retur_gudang.qty_retur_pcs) }} Pcs
                  </div>
                  <div class="font-mono text-xs text-rose-600/80 dark:text-rose-400/80">
                    -Rp {{ formatNumber(line.bukti_3_retur_gudang.subtotal_potongan) }}
                  </div>
                </td>
                <td class="px-4 py-3 text-right">
                  <div class="font-semibold text-emerald-600 dark:text-emerald-400">
                    {{ formatNumber(line.kalkulasi_bersih.qty_bersih_pcs) }} Pcs
                  </div>
                  <div class="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Rp {{ formatNumber(line.kalkulasi_bersih.nominal_bersih_bayar) }}
                  </div>
                </td>
              </tr>
            </tbody>
            <tfoot class="bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800">
              <tr>
                <td class="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Total</td>
                <td class="px-4 py-3 text-right font-mono font-semibold">
                  Rp {{ formatNumber(summary.total_pesanan_awal_po) }}
                </td>
                <td class="px-4 py-3 text-right font-mono font-semibold">
                  Rp {{ formatNumber(summary.total_bukti_masuk_bagus_gr) }}
                </td>
                <td></td>
                <td class="px-4 py-3 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                  -Rp {{ formatNumber(summary.total_potongan_nota_retur) }}
                </td>
                <td class="px-4 py-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  Rp {{ formatNumber(summary.total_bersih_dikunci) }}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card
        v-if="existingInvoice"
        class="border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs"
      >
        <CardContent class="p-5">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div class="flex items-start gap-3">
              <div class="p-2 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                <FileCheck2 class="w-5 h-5" />
              </div>
              <div>
                <p class="font-semibold text-slate-900 dark:text-white">Nota sudah dikunci</p>
                <p class="text-sm text-slate-600 dark:text-slate-300">
                  <span class="font-mono">{{ existingInvoice.no_invoice }}</span> &middot;
                  Rp {{ formatNumber(existingInvoice.net_payable) }} &middot;
                  {{ statusLabel(existingInvoice.status) }}
                </p>
                <p class="text-xs text-slate-500 mt-0.5">
                  Jatuh tempo {{ formatDate(existingInvoice.tgl_jatuh_tempo) }}. Satu PO hanya boleh memiliki satu nota.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
              @click="router.push('/purchasing/invoicing/payables')"
            >
              <Wallet class="w-4 h-4" />
              <span>Buka Hutang</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card v-else class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Kunci Nilai Tagihan</CardTitle>
          <CardDescription>
            Nilai bersih di atas akan disimpan sebagai tagihan PO ini. Nomor nota supplier opsional.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form class="grid grid-cols-1 md:grid-cols-2 gap-4" @submit.prevent="submitInvoice">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                No. Nota Supplier <span class="font-normal text-slate-400">(opsional)</span>
              </label>
              <Input
                v-model="form.no_invoice_supplier"
                placeholder="Contoh: SUP/2026/001 — kosongkan untuk otomatis"
                maxlength="50"
                class="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              />
              <p class="text-[11px] text-slate-400 mt-1">Nomor nota harus unik bila diisi.</p>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Catatan Verifikasi
              </label>
              <Input
                v-model="form.catatan"
                placeholder="Contoh: sesuai surat jalan, retur sudah dicek"
                class="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              />
            </div>

            <div class="md:col-span-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div class="text-sm">
                <span class="text-slate-500">Nilai yang akan dikunci: </span>
                <span class="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  Rp {{ formatNumber(summary.total_bersih_dikunci) }}
                </span>
              </div>
              <Button
                type="submit"
                :disabled="!canSubmit || submitting"
                class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
              >
                <RefreshCw v-if="submitting" class="w-4 h-4 animate-spin" />
                <Lock v-else class="w-4 h-4" />
                <span>{{ submitting ? "Mengunci..." : "Kunci Tagihan" }}</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardList,
  FileCheck2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth";
import {
  getPurchaseOrder,
  type PurchaseOrder,
} from "../../order/purchase_orders/purchaseOrderService";
import {
  createPurchaseInvoice,
  getMatchingPreview,
  type MatchingPreview,
  type PurchaseInvoice,
} from "./purchaseInvoiceService";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const preview = ref<MatchingPreview | null>(null);
const existingInvoice = ref<PurchaseInvoice | null>(null);
const loading = ref(false);
const submitting = ref(false);
const errorMessage = ref("");

const form = ref({
  no_invoice_supplier: "",
  catatan: "",
});

const poId = computed(() => String(route.params.poId || ""));
const summary = computed(
  () =>
    preview.value?.summary_verifikasi || {
      jumlah_goods_receipt: 0,
      jumlah_retur: 0,
      total_pesanan_awal_po: 0,
      total_bukti_masuk_bagus_gr: 0,
      total_potongan_nota_retur: 0,
      total_bersih_dikunci: 0,
    },
);
const unmatchedReceipts = computed(() => preview.value?.unmatched_receipt_item_ids || []);
const unmatchedReturns = computed(() => preview.value?.unmatched_return_item_ids || []);

const okBadge = "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
const badBadge = "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";

const canSubmit = computed(
  () =>
    !!preview.value &&
    authStore.isManager &&
    !existingInvoice.value &&
    preview.value.has_receipts &&
    unmatchedReceipts.value.length === 0 &&
    unmatchedReturns.value.length === 0 &&
    summary.value.total_bersih_dikunci > 0,
);

const estimatedDueDate = computed(() => {
  if (!preview.value) return "-";
  const date = new Date();
  date.setDate(date.getDate() + Number(preview.value.supplier?.term_of_payment || 0));
  return formatDate(date.toISOString());
});

function formatNumber(value: number | string | null | undefined) {
  return Number(value || 0).toLocaleString("id-ID");
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function statusLabel(status: string) {
  switch (status) {
    case "PAID":
      return "🟢 Lunas";
    case "PARTIAL":
      return "🟠 Sebagian";
    case "OVERDUE":
      return "🔴 Overdue";
    default:
      return "🟡 Belum Bayar";
  }
}

async function load() {
  if (!poId.value) {
    errorMessage.value = "Purchase Order tidak valid.";
    return;
  }

  loading.value = true;
  errorMessage.value = "";
  try {
    const [previewData, poData] = await Promise.all([
      getMatchingPreview(poId.value),
      getPurchaseOrder(poId.value).catch(() => null as PurchaseOrder | null),
    ]);
    preview.value = previewData;
    existingInvoice.value = (poData?.invoices?.[0] as PurchaseInvoice | undefined) || null;
  } catch (error: any) {
    console.error("Gagal memuat preview 3-way matching:", error);
    errorMessage.value = error.message || "Gagal memuat preview verifikasi nota";
    toast.error(errorMessage.value);
  } finally {
    loading.value = false;
  }
}

async function submitInvoice() {
  if (!canSubmit.value || !preview.value) return;
  submitting.value = true;
  try {
    const invoice = await createPurchaseInvoice({
      po_id: poId.value,
      no_invoice_supplier: form.value.no_invoice_supplier.trim() || undefined,
      catatan: form.value.catatan.trim() || undefined,
    });
    toast.success(`Nota ${invoice.no_invoice} berhasil dikunci`, {
      description: `Nilai tagihan bersih Rp ${formatNumber(invoice.net_payable)} dan jadwal jatuh tempo sudah dibuat.`,
    });
    router.push("/purchasing/invoicing/invoices");
  } catch (error: any) {
    console.error("Gagal mengunci nota:", error);
    toast.error(error.message || "Gagal mengunci nota supplier");
  } finally {
    submitting.value = false;
  }
}

onMounted(load);
</script>
