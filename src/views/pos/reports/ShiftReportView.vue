<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import {
  Banknote,
  CreditCard,
  DoorOpen,
  Info,
  Printer,
  QrCode,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  Wallet,
} from "lucide-vue-next";
import { ApiRequestError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getLastClosedShiftId, getShiftReport } from "../service";
import type { PaymentMethod, ShiftReport } from "../types";

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const report = ref<ShiftReport | null>(null);
const errorMessage = ref("");
const lastShiftId = ref<string | null>(null);

const rupiah = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "-";

const METODE: Array<{
  value: PaymentMethod;
  label: string;
  icon: typeof Banknote;
}> = [
  { value: "TUNAI", label: "Tunai", icon: Banknote },
  { value: "QRIS", label: "QRIS", icon: QrCode },
  { value: "EDC", label: "EDC", icon: CreditCard },
  { value: "TRANSFER", label: "Transfer", icon: Smartphone },
];

const requestedShiftId = computed(() => {
  const queryShift = String(route.query.shift || "").trim();
  return queryShift || lastShiftId.value || "";
});

const isBalanced = computed(
  () => Number(report.value?.rekonsiliasi_kas.selisih_kas || 0) === 0,
);

const selisihClass = computed(() => {
  const value = Number(report.value?.rekonsiliasi_kas.selisih_kas || 0);
  if (value === 0) return "text-emerald-600 dark:text-emerald-400";
  if (value > 0) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
});

async function loadReport() {
  const shiftId = requestedShiftId.value;
  errorMessage.value = "";

  if (!shiftId) {
    report.value = null;
    return;
  }

  loading.value = true;
  try {
    report.value = await getShiftReport(shiftId);
  } catch (error) {
    report.value = null;
    if (error instanceof ApiRequestError) {
      if (error.statusCode === 403) {
        errorMessage.value =
          "Laporan shift belum dapat dibuka. Shift masih berjalan atau laporan ini milik kasir lain.";
      } else if (error.statusCode === 404) {
        errorMessage.value = "Shift tidak ditemukan atau sudah tidak tersedia.";
      } else {
        errorMessage.value = error.message;
      }
    } else {
      errorMessage.value =
        error instanceof Error ? error.message : "Gagal memuat laporan shift";
    }
    toast.error(errorMessage.value);
  } finally {
    loading.value = false;
  }
}

function printReport() {
  window.print();
}

function goToOpenShift() {
  router.push({ name: "PosShiftOpen" });
}

onMounted(() => {
  lastShiftId.value = getLastClosedShiftId();
  void loadReport();
});
</script>

<template>
  <div class="space-y-6 p-1 md:p-2">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <span
          class="rounded-md bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
        >
          Modul 4 : Transaksi (3.1)
        </span>
        <h1 class="mt-1 text-2xl font-bold tracking-tight text-foreground">
          Laporan Penjualan Shift Terkini
        </h1>
        <p class="text-sm text-muted-foreground">
          Rekap transaksi dan rekonsiliasi kas dari shift yang sudah ditutup.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          class="rounded-xl"
          :disabled="loading || !requestedShiftId"
          @click="loadReport"
        >
          <RefreshCw :class="['h-4 w-4', loading ? 'animate-spin' : '']" />
          Muat ulang
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="rounded-xl"
          :disabled="!report"
          @click="printReport"
        >
          <Printer class="h-4 w-4" />
          Cetak
        </Button>
      </div>
    </header>

    <div v-if="loading" class="grid gap-4">
      <div class="h-36 animate-pulse rounded-2xl bg-muted/60" />
      <div class="h-64 animate-pulse rounded-2xl bg-muted/60" />
    </div>

    <!-- Belum ada shift yang bisa dilaporkan -->
    <Card
      v-else-if="!requestedShiftId"
      class="rounded-3xl border-border/60 bg-card/85 shadow-sm"
    >
      <CardContent class="flex flex-col items-center justify-center px-6 py-14 text-center">
        <div class="rounded-full bg-muted/70 p-4">
          <ReceiptText class="h-9 w-9 text-muted-foreground/60" />
        </div>
        <h2 class="mt-4 text-lg font-semibold text-foreground">
          Belum ada laporan shift
        </h2>
        <p class="mt-1 max-w-md text-sm text-muted-foreground">
          Laporan terbuka setelah shift ditutup. Selesaikan tutup shift terlebih
          dahulu, atau buka laporan lewat tautan dari halaman tutup shift.
        </p>
        <div class="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button class="rounded-xl" @click="router.push({ name: 'PosShiftClose' })">
            <ShieldCheck class="h-4 w-4" />
            Tutup Shift
          </Button>
          <Button variant="outline" class="rounded-xl" @click="goToOpenShift">
            <DoorOpen class="h-4 w-4" />
            Buka Shift
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Error akses / belum ditutup -->
    <Card
      v-else-if="errorMessage"
      class="rounded-3xl border-amber-200/70 bg-amber-50/60 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20"
    >
      <CardContent class="flex flex-col items-start gap-3 p-5 md:flex-row md:items-center md:justify-between">
        <div class="flex items-start gap-3">
          <div class="rounded-2xl bg-amber-100 p-2.5 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <Info class="h-5 w-5" />
          </div>
          <div>
            <p class="font-semibold text-foreground">Laporan belum tersedia</p>
            <p class="text-sm text-muted-foreground">{{ errorMessage }}</p>
          </div>
        </div>
        <Button variant="outline" class="rounded-xl" @click="router.push({ name: 'PosShiftClose' })">
          Ke Tutup Shift
        </Button>
      </CardContent>
    </Card>

    <template v-else-if="report">
      <!-- Ringkasan -->
      <Card class="overflow-hidden rounded-3xl border-border/60 bg-gradient-to-br from-emerald-50/80 via-card to-sky-50/80 shadow-sm dark:from-emerald-950/20 dark:via-card dark:to-sky-950/20">
        <CardContent class="p-5 md:p-6">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="flex items-start gap-3">
              <div class="rounded-2xl bg-card p-3 text-emerald-600 shadow-sm dark:text-emerald-400">
                <ReceiptText class="h-6 w-6" />
              </div>
              <div>
                <p class="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {{ report.no_shift }}
                </p>
                <h2 class="text-xl font-semibold text-foreground">
                  Ringkasan Shift {{ report.kasir }}
                </h2>
                <p class="mt-1 text-sm text-muted-foreground">
                  {{ formatDateTime(report.opened_at) }} — {{ formatDateTime(report.closed_at) }}
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              class="w-fit rounded-full px-3 py-1"
              :class="
                report.status === 'CLOSED'
                  ? 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
              "
            >
              {{ report.status }}
            </Badge>
          </div>

          <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-2xl border border-border/60 bg-card/80 p-4">
              <p class="text-xs text-muted-foreground">Total omzet</p>
              <p class="mt-1 text-xl font-bold text-foreground">{{ rupiah(report.total_omzet) }}</p>
            </div>
            <div class="rounded-2xl border border-border/60 bg-card/80 p-4">
              <p class="text-xs text-muted-foreground">Jumlah transaksi</p>
              <p class="mt-1 text-xl font-bold text-foreground">{{ report.total_transaksi }}</p>
            </div>
            <div class="rounded-2xl border border-border/60 bg-card/80 p-4">
              <p class="text-xs text-muted-foreground">Penjualan tunai</p>
              <p class="mt-1 text-xl font-bold text-foreground">
                {{ rupiah(report.rekonsiliasi_kas.penjualan_tunai) }}
              </p>
            </div>
            <div class="rounded-2xl border border-border/60 bg-card/80 p-4">
              <p class="text-xs text-muted-foreground">Selisih kas</p>
              <p class="mt-1 text-xl font-bold" :class="selisihClass">
                {{ rupiah(report.rekonsiliasi_kas.selisih_kas) }}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <!-- Omzet per metode -->
        <Card class="rounded-3xl border-border/60 bg-card/85 shadow-sm">
          <CardContent class="p-5 md:p-6">
            <div class="mb-4 flex items-center gap-2">
              <TrendingUp class="h-5 w-5 text-primary" />
              <h3 class="text-sm font-semibold text-foreground">Omzet per metode bayar</h3>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div
                v-for="metode in METODE"
                :key="metode.value"
                class="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/25 px-4 py-3"
              >
                <div class="flex items-center gap-2 text-muted-foreground">
                  <component :is="metode.icon" class="h-4 w-4" />
                  <span class="text-sm">{{ metode.label }}</span>
                </div>
                <span class="text-sm font-semibold text-foreground">
                  {{ rupiah(report.omzet_per_metode[metode.value] || 0) }}
                </span>
              </div>
            </div>

            <div class="mt-4 flex items-start gap-2 rounded-2xl border border-sky-200/70 bg-sky-50/60 p-3 text-xs text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-300">
              <Info class="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Hanya transaksi berstatus COMPLETED yang dihitung. Omzet non-tunai
                tidak menambah ekspektasi uang fisik laci.
              </p>
            </div>
          </CardContent>
        </Card>

        <!-- Rekonsiliasi -->
        <Card class="rounded-3xl border-border/60 bg-card/85 shadow-sm">
          <CardContent class="p-5 md:p-6">
            <div class="mb-4 flex items-center gap-2">
              <Wallet class="h-5 w-5 text-primary" />
              <h3 class="text-sm font-semibold text-foreground">Rekonsiliasi kas laci</h3>
            </div>

            <dl class="space-y-3 text-sm">
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted-foreground">Modal awal</dt>
                <dd class="font-medium text-foreground">
                  {{ rupiah(report.rekonsiliasi_kas.modal_awal) }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted-foreground">Penjualan tunai</dt>
                <dd class="font-medium text-foreground">
                  {{ rupiah(report.rekonsiliasi_kas.penjualan_tunai) }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                <dt class="font-medium text-foreground">Ekspektasi laci</dt>
                <dd class="font-semibold text-foreground">
                  {{ rupiah(report.rekonsiliasi_kas.ekspektasi_kas_laci) }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="text-muted-foreground">Uang fisik</dt>
                <dd class="font-medium text-foreground">
                  {{ rupiah(report.rekonsiliasi_kas.uang_fisik_laci) }}
                </dd>
              </div>
              <div
                class="flex items-center justify-between gap-3 rounded-2xl border p-3"
                :class="
                  isBalanced
                    ? 'border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                    : 'border-amber-200/70 bg-amber-50/60 dark:border-amber-900/60 dark:bg-amber-950/20'
                "
              >
                <dt class="font-semibold text-foreground">Selisih kas</dt>
                <dd class="text-base font-bold" :class="selisihClass">
                  {{ rupiah(report.rekonsiliasi_kas.selisih_kas) }}
                </dd>
              </div>
            </dl>

            <p class="mt-4 text-[11px] text-muted-foreground">
              Selisih = uang fisik − ekspektasi laci. Nilai positif berarti lebih
              kas, negatif berarti kurang kas.
            </p>
          </CardContent>
        </Card>
      </div>
    </template>

    <!-- Area cetak -->
    <div v-if="report" id="shift-report-print" class="hidden print:block">
      <div style="max-width: 640px; margin: 0 auto; font-family: sans-serif; color: #111">
        <h2 style="text-align: center; margin: 0">LAPORAN PENJUALAN SHIFT</h2>
        <p style="text-align: center; margin: 4px 0 16px; font-size: 12px">
          {{ report.no_shift }} · {{ report.kasir }}
        </p>
        <p style="font-size: 12px; margin: 2px 0">
          Dibuka: {{ formatDateTime(report.opened_at) }}
        </p>
        <p style="font-size: 12px; margin: 2px 0 12px">
          Ditutup: {{ formatDateTime(report.closed_at) }}
        </p>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px">
          <tbody>
            <tr>
              <td style="padding: 4px 0">Total omzet</td>
              <td style="padding: 4px 0; text-align: right">{{ rupiah(report.total_omzet) }}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0">Jumlah transaksi</td>
              <td style="padding: 4px 0; text-align: right">{{ report.total_transaksi }}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0">Tunai</td>
              <td style="padding: 4px 0; text-align: right">
                {{ rupiah(report.omzet_per_metode.TUNAI) }}
              </td>
            </tr>
            <tr>
              <td style="padding: 4px 0">QRIS</td>
              <td style="padding: 4px 0; text-align: right">
                {{ rupiah(report.omzet_per_metode.QRIS) }}
              </td>
            </tr>
            <tr>
              <td style="padding: 4px 0">EDC</td>
              <td style="padding: 4px 0; text-align: right">
                {{ rupiah(report.omzet_per_metode.EDC) }}
              </td>
            </tr>
            <tr>
              <td style="padding: 4px 0">Transfer</td>
              <td style="padding: 4px 0; text-align: right">
                {{ rupiah(report.omzet_per_metode.TRANSFER) }}
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0 4px; border-top: 1px solid #999">Ekspektasi laci</td>
              <td style="padding: 8px 0 4px; border-top: 1px solid #999; text-align: right">
                {{ rupiah(report.rekonsiliasi_kas.ekspektasi_kas_laci) }}
              </td>
            </tr>
            <tr>
              <td style="padding: 4px 0">Uang fisik</td>
              <td style="padding: 4px 0; text-align: right">
                {{ rupiah(report.rekonsiliasi_kas.uang_fisik_laci) }}
              </td>
            </tr>
            <tr>
              <td style="padding: 4px 0; font-weight: bold">Selisih kas</td>
              <td style="padding: 4px 0; text-align: right; font-weight: bold">
                {{ rupiah(report.rekonsiliasi_kas.selisih_kas) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style>
@media print {
  body * {
    visibility: hidden !important;
  }
  #shift-report-print,
  #shift-report-print * {
    visibility: visible !important;
  }
  #shift-report-print {
    position: absolute;
    inset: 0;
    width: 100%;
    background: #fff;
  }
}
</style>
