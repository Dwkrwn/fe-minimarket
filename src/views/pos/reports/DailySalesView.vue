<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { toast } from "vue-sonner";
import {
  CalendarDays,
  Download,
  Info,
  PackageCheck,
  RefreshCw,
  ShoppingBasket,
  Sparkles,
  TriangleAlert,
  TrendingUp,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getDailySales } from "../service";
import type { DailySalesReport } from "../types";

const loading = ref(false);
const evaluating = ref(false);
const report = ref<DailySalesReport | null>(null);
const daysWindow = ref(1);

const rupiah = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const numberFormat = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("id-ID").format(Number(value || 0));

const rekap = computed(() => report.value?.rekap_penjualan_toko);
const evaluations = computed(() => report.value?.evaluasi_stok_rop || []);
const perluRestock = computed(
  () => evaluations.value.filter((row) => row.status_stok === "PERLU_RESTOCK").length,
);
const autoPrBaru = computed(() => report.value?.antrean_auto_pr_baru?.length || 0);

async function loadReport(triggerAutoPr = false) {
  if (triggerAutoPr) {
    evaluating.value = true;
  } else {
    loading.value = true;
  }

  try {
    report.value = await getDailySales({
      days_window: daysWindow.value,
      trigger_auto_pr: triggerAutoPr,
    });
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Gagal memuat rekap harian",
    );
  } finally {
    loading.value = false;
    evaluating.value = false;
  }
}

async function runEvaluation() {
  const confirmed = window.confirm(
    "Jalankan evaluasi ROP dan picu Auto-PR? Sistem dapat membuat purchase request otomatis untuk barang yang berada di bawah ROP.",
  );
  if (!confirmed) return;

  await loadReport(true);
  toast.success(
    autoPrBaru.value > 0
      ? `${autoPrBaru.value} Auto-PR baru dibuat`
      : "Evaluasi ROP selesai, tidak ada Auto-PR baru",
  );
}

function prLabel(pr: Record<string, unknown>): string {
  return String(pr.no_pr || pr.no_dokumen || pr.id || "Purchase request");
}

function exportCsv() {
  if (!evaluations.value.length) return;

  const header = [
    "Barcode",
    "Nama Barang",
    "Penjualan Periode (Pcs)",
    "Kecepatan Jual Harian",
    "Total Stok Toko (Pcs)",
    "Batas ROP (Pcs)",
    "Status Stok",
  ];
  const rows = evaluations.value.map((row) => [
    row.barcode,
    row.nama_barang,
    row.penjualan_periode_pcs,
    row.kecepatan_jual_harian,
    row.total_stok_toko_pcs,
    row.batas_rop_pcs,
    row.status_stok,
  ]);

  const csv = [header, ...rows]
    .map((cols) => cols.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rekap-harian-pos-${daysWindow.value}hari.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

onMounted(() => loadReport());
</script>

<template>
  <div class="space-y-6 p-1 md:p-2">
    <header class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <span
          class="rounded-md bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
        >
          Modul 4 : Transaksi (3.2)
        </span>
        <h1 class="mt-1 text-2xl font-bold tracking-tight text-foreground">
          Rekap Penjualan Harian Toko
        </h1>
        <p class="text-sm text-muted-foreground">
          Rekap omzet toko dan evaluasi stok untuk pemicu ROP / Auto-PR.
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-1 rounded-xl border border-border/70 bg-card p-1">
          <button
            v-for="option in [1, 7, 30]"
            :key="option"
            type="button"
            class="rounded-lg px-3 py-1.5 text-xs font-medium transition"
            :class="
              daysWindow === option
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted'
            "
            @click="daysWindow = option; loadReport()"
          >
            {{ option }} hari
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          class="rounded-xl"
          :disabled="loading || evaluating"
          @click="loadReport()"
        >
          <RefreshCw :class="['h-4 w-4', loading ? 'animate-spin' : '']" />
          Muat ulang
        </Button>

        <Button
          variant="outline"
          size="sm"
          class="rounded-xl"
          :disabled="!evaluations.length"
          @click="exportCsv"
        >
          <Download class="h-4 w-4" />
          CSV
        </Button>

        <Button
          size="sm"
          class="rounded-xl"
          :disabled="evaluating"
          @click="runEvaluation"
        >
          <Sparkles :class="['h-4 w-4', evaluating ? 'animate-pulse' : '']" />
          {{ evaluating ? "Mengevaluasi..." : "Evaluasi ROP + Auto-PR" }}
        </Button>
      </div>
    </header>

    <div v-if="loading" class="grid gap-4">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div v-for="n in 4" :key="'kpi-' + n" class="h-28 animate-pulse rounded-2xl bg-muted/60" />
      </div>
      <div class="h-80 animate-pulse rounded-2xl bg-muted/60" />
    </div>

    <template v-else-if="report">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card class="rounded-3xl border-border/60 bg-gradient-to-br from-emerald-50/80 via-card to-card shadow-sm dark:from-emerald-950/20">
          <CardContent class="flex items-center justify-between p-5">
            <div>
              <p class="text-xs text-muted-foreground">Total omzet</p>
              <p class="mt-1 text-xl font-bold text-foreground">
                {{ rupiah(rekap?.total_omzet) }}
              </p>
              <p class="mt-0.5 text-[11px] text-muted-foreground">
                {{ rekap?.periode_hari }} hari terakhir
              </p>
            </div>
            <div class="rounded-2xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <TrendingUp class="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card class="rounded-3xl border-border/60 bg-card/85 shadow-sm">
          <CardContent class="flex items-center justify-between p-5">
            <div>
              <p class="text-xs text-muted-foreground">Jumlah transaksi</p>
              <p class="mt-1 text-xl font-bold text-foreground">
                {{ numberFormat(rekap?.total_transaksi) }}
              </p>
              <p class="mt-0.5 text-[11px] text-muted-foreground">Struk COMPLETED</p>
            </div>
            <div class="rounded-2xl bg-sky-100 p-3 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
              <ShoppingBasket class="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card class="rounded-3xl border-border/60 bg-card/85 shadow-sm">
          <CardContent class="flex items-center justify-between p-5">
            <div>
              <p class="text-xs text-muted-foreground">Perlu restock</p>
              <p class="mt-1 text-xl font-bold text-foreground">{{ perluRestock }}</p>
              <p class="mt-0.5 text-[11px] text-muted-foreground">SKU di bawah ROP</p>
            </div>
            <div class="rounded-2xl bg-amber-100 p-3 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
              <TriangleAlert class="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card class="rounded-3xl border-border/60 bg-card/85 shadow-sm">
          <CardContent class="flex items-center justify-between p-5">
            <div>
              <p class="text-xs text-muted-foreground">Auto-PR baru</p>
              <p class="mt-1 text-xl font-bold text-foreground">{{ autoPrBaru }}</p>
              <p class="mt-0.5 text-[11px] text-muted-foreground">Antrean pembelian</p>
            </div>
            <div class="rounded-2xl bg-violet-100 p-3 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
              <PackageCheck class="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div class="flex items-start gap-2 rounded-2xl border border-sky-200/70 bg-sky-50/60 p-3 text-xs text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-300">
        <Info class="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Membuka rekap memperbarui rata-rata penjualan dan batas ROP. Auto-PR
          hanya dibuat saat tombol <strong>Evaluasi ROP + Auto-PR</strong> dijalankan,
          sehingga pemuatan halaman biasa tidak mengubah antrean pembelian.
        </p>
      </div>

      <Card class="overflow-hidden rounded-3xl border-border/60 bg-card/85 shadow-sm">
        <div class="flex flex-col gap-2 border-b border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-2">
            <CalendarDays class="h-5 w-5 text-primary" />
            <div>
              <h2 class="text-sm font-semibold text-foreground">Evaluasi stok &amp; ROP</h2>
              <p class="text-xs text-muted-foreground">
                {{ evaluations.length }} SKU dievaluasi berdasarkan penjualan periode ini
              </p>
            </div>
          </div>
          <Badge variant="secondary" class="w-fit rounded-full">
            {{ rekap?.periode_hari }} hari
          </Badge>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th class="px-4 py-3 font-semibold">Barang</th>
                <th class="px-4 py-3 text-center font-semibold">Terjual</th>
                <th class="px-4 py-3 text-center font-semibold">Harian</th>
                <th class="px-4 py-3 text-center font-semibold">Stok</th>
                <th class="px-4 py-3 text-center font-semibold">ROP</th>
                <th class="px-4 py-3 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border/60">
              <tr v-if="evaluations.length === 0">
                <td colspan="6" class="px-4 py-12 text-center">
                  <PackageCheck class="mx-auto mb-2 h-9 w-9 text-muted-foreground/50" />
                  <p class="font-medium text-foreground">Belum ada penjualan pada periode ini</p>
                  <p class="mt-1 text-xs text-muted-foreground">
                    Evaluasi tetap dihitung dari stok dan ROP setiap barang.
                  </p>
                </td>
              </tr>

              <tr
                v-for="row in evaluations"
                :key="row.item_id"
                class="transition-colors hover:bg-muted/30"
              >
                <td class="px-4 py-3">
                  <p class="font-medium text-foreground">{{ row.nama_barang }}</p>
                  <p class="text-[11px] text-muted-foreground">{{ row.barcode }}</p>
                </td>
                <td class="px-4 py-3 text-center text-foreground">
                  {{ numberFormat(row.penjualan_periode_pcs) }}
                </td>
                <td class="px-4 py-3 text-center text-foreground">
                  {{ Number(row.kecepatan_jual_harian).toFixed(2) }}
                </td>
                <td class="px-4 py-3 text-center text-foreground">
                  {{ numberFormat(row.total_stok_toko_pcs) }}
                </td>
                <td class="px-4 py-3 text-center text-foreground">
                  {{ numberFormat(row.batas_rop_pcs) }}
                </td>
                <td class="px-4 py-3 text-center">
                  <Badge
                    variant="outline"
                    class="rounded-full px-2.5 py-0.5 text-[10px]"
                    :class="
                      row.status_stok === 'PERLU_RESTOCK'
                        ? 'border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                        : 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                    "
                  >
                    {{ row.status_stok === "PERLU_RESTOCK" ? "Perlu restock" : "Aman" }}
                  </Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        v-if="autoPrBaru > 0"
        class="rounded-3xl border-violet-200/70 bg-violet-50/60 shadow-sm dark:border-violet-900/60 dark:bg-violet-950/20"
      >
        <CardContent class="p-5">
          <div class="flex items-center gap-2 text-violet-700 dark:text-violet-300">
            <Sparkles class="h-5 w-5" />
            <h3 class="text-sm font-semibold">Auto-PR baru dibuat</h3>
          </div>
          <ul class="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <li
              v-for="(pr, index) in report.antrean_auto_pr_baru"
              :key="index"
              class="rounded-xl border border-border/60 bg-card/70 px-3 py-2"
            >
              {{ prLabel(pr) }}
            </li>
          </ul>
        </CardContent>
      </Card>
    </template>

    <Card
      v-else
      class="rounded-3xl border-border/60 bg-card/85 shadow-sm"
    >
      <CardContent class="flex flex-col items-center justify-center px-6 py-14 text-center">
        <div class="rounded-full bg-muted/70 p-4">
          <CalendarDays class="h-9 w-9 text-muted-foreground/60" />
        </div>
        <h2 class="mt-4 text-lg font-semibold text-foreground">Rekap belum dimuat</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Muat ulang untuk mengambil rekap penjualan harian toko.
        </p>
        <Button class="mt-4 rounded-xl" @click="loadReport()">
          <RefreshCw class="h-4 w-4" />
          Muat Rekap
        </Button>
      </CardContent>
    </Card>
  </div>
</template>
