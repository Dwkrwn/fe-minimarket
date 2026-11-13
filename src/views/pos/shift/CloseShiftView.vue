<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  DoorClosed,
  DoorOpen,
  Info,
  ReceiptText,
  ShieldCheck,
  TriangleAlert,
  Wallet,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { closeShift, getActiveShift } from "../service";
import type { CloseShiftResult, PosShift, RekonsiliasiStatus } from "../types";

const router = useRouter();

const loading = ref(true);
const submitting = ref(false);
const activeShift = ref<PosShift | null>(null);
const result = ref<CloseShiftResult | null>(null);
const uangFisik = ref<number | string>("");
const catatan = ref("");

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

const fisikValue = computed(() => Number(uangFisik.value || 0));
const canSubmit = computed(
  () => !!activeShift.value && !submitting.value && fisikValue.value >= 0,
);

const rekonStyle: Record<
  RekonsiliasiStatus,
  { label: string; badge: string; panel: string; icon: typeof CheckCircle2 }
> = {
  SEIMBANG: {
    label: "Seimbang",
    badge:
      "border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    panel:
      "border-emerald-200/70 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/30",
    icon: CheckCircle2,
  },
  LEBIH_KAS: {
    label: "Lebih kas",
    badge:
      "border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    panel:
      "border-amber-200/70 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30",
    icon: TriangleAlert,
  },
  KURANG_KAS: {
    label: "Kurang kas",
    badge:
      "border-rose-300/70 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
    panel:
      "border-rose-200/70 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/30",
    icon: TriangleAlert,
  },
};

function rekonOf(status?: RekonsiliasiStatus) {
  return status ? rekonStyle[status] : rekonStyle.SEIMBANG;
}

async function loadActiveShift() {
  loading.value = true;
  try {
    activeShift.value = await getActiveShift();
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Gagal memuat shift aktif",
    );
  } finally {
    loading.value = false;
  }
}

async function submitCloseShift() {
  if (!activeShift.value || !canSubmit.value) return;

  submitting.value = true;
  try {
    result.value = await closeShift(activeShift.value.id, {
      uang_fisik_laci: fisikValue.value,
      catatan: catatan.value.trim() || undefined,
    });
    activeShift.value = null;
    uangFisik.value = "";
    catatan.value = "";
    toast.success("Shift ditutup dan kas berhasil direkonsiliasi");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Gagal menutup shift");
  } finally {
    submitting.value = false;
  }
}

function goToReport() {
  if (!result.value) return;
  router.push({
    name: "PosShiftReport",
    query: { shift: result.value.id },
  });
}

function goToOpenShift() {
  router.push({ name: "PosShiftOpen" });
}

onMounted(loadActiveShift);
</script>

<template>
  <div class="space-y-6 p-1 md:p-2">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <span
          class="rounded-md bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800 dark:bg-violet-950/50 dark:text-violet-300"
        >
          Modul 4 : Transaksi (2.2)
        </span>
        <h1 class="mt-1 text-2xl font-bold tracking-tight text-foreground">
          Tutup Shift &amp; Rekonsiliasi Kas
        </h1>
        <p class="text-sm text-muted-foreground">
          Hitung uang fisik laci tanpa melihat ekspektasi sistem lebih dulu.
        </p>
      </div>

      <Badge
        v-if="activeShift"
        variant="outline"
        class="w-fit gap-1.5 rounded-full border-primary/30 bg-primary/5 px-3 py-1 text-primary"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-primary" />
        {{ activeShift.no_shift }}
      </Badge>
    </header>

    <div v-if="loading" class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div class="h-80 animate-pulse rounded-2xl bg-muted/60" />
      <div class="h-80 animate-pulse rounded-2xl bg-muted/60" />
    </div>

    <!-- Hasil rekonsiliasi -->
    <template v-else-if="result">
      <Card
        class="rounded-3xl border shadow-sm"
        :class="rekonOf(result.status_rekonsiliasi).panel"
      >
        <CardContent class="p-5 md:p-6">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="flex items-start gap-3">
              <div class="rounded-2xl bg-card/80 p-3 text-primary shadow-sm">
                <component :is="rekonOf(result.status_rekonsiliasi).icon" class="h-6 w-6" />
              </div>
              <div>
                <p class="text-sm text-muted-foreground">Shift {{ result.no_shift }} ditutup</p>
                <h2 class="text-xl font-semibold text-foreground">
                  Rekonsiliasi {{ rekonOf(result.status_rekonsiliasi).label }}
                </h2>
                <p class="mt-1 text-sm text-muted-foreground">
                  {{ result.user?.name || "Kasir" }} · {{ formatDateTime(result.closed_at) }}
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              class="w-fit rounded-full px-3 py-1"
              :class="rekonOf(result.status_rekonsiliasi).badge"
            >
              {{ result.status_rekonsiliasi.replace("_", " ") }}
            </Badge>
          </div>

          <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-2xl border border-border/60 bg-card/80 p-4">
              <p class="text-xs text-muted-foreground">Modal awal</p>
              <p class="mt-1 text-lg font-semibold text-foreground">
                {{ rupiah(result.modal_awal) }}
              </p>
            </div>
            <div class="rounded-2xl border border-border/60 bg-card/80 p-4">
              <p class="text-xs text-muted-foreground">Ekspektasi kas laci</p>
              <p class="mt-1 text-lg font-semibold text-foreground">
                {{ rupiah(result.ekspektasi_kas_laci) }}
              </p>
            </div>
            <div class="rounded-2xl border border-border/60 bg-card/80 p-4">
              <p class="text-xs text-muted-foreground">Uang fisik</p>
              <p class="mt-1 text-lg font-semibold text-foreground">
                {{ rupiah(result.uang_fisik_laci) }}
              </p>
            </div>
            <div class="rounded-2xl border border-border/60 bg-card/80 p-4">
              <p class="text-xs text-muted-foreground">Selisih</p>
              <p
                class="mt-1 text-lg font-semibold"
                :class="
                  Number(result.selisih) === 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : Number(result.selisih) > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-rose-600 dark:text-rose-400'
                "
              >
                {{ rupiah(result.selisih) }}
              </p>
            </div>
          </div>

          <div class="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button class="rounded-xl" @click="goToReport">
              <ReceiptText class="h-4 w-4" />
              Lihat Laporan Shift
              <ArrowRight class="h-4 w-4" />
            </Button>
            <Button variant="outline" class="rounded-xl" @click="goToOpenShift">
              <DoorOpen class="h-4 w-4" />
              Buka Shift Baru
            </Button>
          </div>
        </CardContent>
      </Card>
    </template>

    <!-- Tidak ada shift aktif -->
    <template v-else-if="!activeShift">
      <Card class="rounded-3xl border-border/60 bg-card/85 shadow-sm">
        <CardContent class="flex flex-col items-center justify-center px-6 py-14 text-center">
          <div class="rounded-full bg-muted/70 p-4">
            <DoorClosed class="h-9 w-9 text-muted-foreground/60" />
          </div>
          <h2 class="mt-4 text-lg font-semibold text-foreground">
            Tidak ada shift yang sedang berjalan
          </h2>
          <p class="mt-1 max-w-md text-sm text-muted-foreground">
            Buka shift terlebih dahulu untuk mulai melayani transaksi. Setelah
            shift ditutup, laporan rekonsiliasi dapat dilihat pada menu laporan.
          </p>
          <div class="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button class="rounded-xl" @click="goToOpenShift">
              <DoorOpen class="h-4 w-4" />
              Buka Shift
            </Button>
            <Button
              variant="outline"
              class="rounded-xl"
              @click="router.push({ name: 'PosShiftReport' })"
            >
              <ReceiptText class="h-4 w-4" />
              Laporan Shift
            </Button>
          </div>
        </CardContent>
      </Card>
    </template>

    <!-- Form tutup shift -->
    <div v-else class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card class="rounded-3xl border-border/60 bg-card/85 shadow-sm">
        <CardContent class="space-y-5 p-5 md:p-6">
          <div class="flex items-start gap-3">
            <div class="rounded-2xl bg-violet-100 p-3 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
              <DoorClosed class="h-6 w-6" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-foreground">Formulir tutup shift</h2>
              <p class="text-sm text-muted-foreground">
                Hitung seluruh uang tunai di laci, lalu masukkan jumlahnya.
              </p>
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-2xl border border-border/60 bg-muted/30 p-4">
              <p class="text-xs text-muted-foreground">Nomor shift</p>
              <p class="mt-1 font-semibold text-foreground">{{ activeShift.no_shift }}</p>
            </div>
            <div class="rounded-2xl border border-border/60 bg-muted/30 p-4">
              <p class="text-xs text-muted-foreground">Dibuka</p>
              <p class="mt-1 font-semibold text-foreground">
                {{ formatDateTime(activeShift.opened_at) }}
              </p>
            </div>
            <div class="rounded-2xl border border-border/60 bg-muted/30 p-4">
              <p class="text-xs text-muted-foreground">Modal awal</p>
              <p class="mt-1 font-semibold text-foreground">
                {{ rupiah(activeShift.modal_awal) }}
              </p>
            </div>
            <div class="rounded-2xl border border-border/60 bg-muted/30 p-4">
              <p class="text-xs text-muted-foreground">Kasir</p>
              <p class="mt-1 font-semibold text-foreground">
                {{ activeShift.user?.name || "-" }}
              </p>
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-foreground">
              Uang fisik laci
            </label>
            <div class="relative">
              <span class="pointer-events-none absolute left-3 top-2.5 text-sm text-muted-foreground">
                Rp
              </span>
              <Input
                v-model="uangFisik"
                type="number"
                min="0"
                placeholder="0"
                class="h-12 rounded-xl pl-9 text-right text-xl font-semibold"
              />
            </div>
            <p class="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Info class="h-3.5 w-3.5" />
              Ekspektasi kas laci disembunyikan sampai shift ditutup (blind closing).
            </p>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-foreground">
              Catatan <span class="text-xs font-normal text-muted-foreground">(opsional)</span>
            </label>
            <textarea
              v-model="catatan"
              rows="3"
              placeholder="Contoh: selisih karena uang receh habis"
              class="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div class="flex flex-col gap-2 sm:flex-row">
            <Button
              class="h-11 rounded-xl px-6"
              :disabled="!canSubmit"
              @click="submitCloseShift"
            >
              <DoorClosed class="h-4 w-4" />
              {{ submitting ? "Menutup shift..." : "Tutup Shift & Hitung Selisih" }}
            </Button>
            <Button
              variant="outline"
              class="h-11 rounded-xl"
              @click="router.push({ name: 'PosKasir' })"
            >
              Kembali ke Kasir
            </Button>
          </div>
        </CardContent>
      </Card>

      <div class="space-y-4">
        <Card class="rounded-3xl border-border/60 bg-gradient-to-br from-violet-50 via-card to-sky-50 shadow-sm dark:from-violet-950/20 dark:via-card dark:to-sky-950/20">
          <CardContent class="p-5">
            <div class="flex items-center gap-2 text-violet-700 dark:text-violet-300">
              <ShieldCheck class="h-5 w-5" />
              <h3 class="text-sm font-semibold">Mengapa blind closing?</h3>
            </div>
            <p class="mt-2 text-sm text-muted-foreground">
              Kasir menghitung uang fisik secara independen. Selisih baru
              dihitung sistem setelah angka disubmit, sehingga hasil rekonsiliasi
              lebih jujur.
            </p>
          </CardContent>
        </Card>

        <Card class="rounded-3xl border-border/60 bg-card/85 shadow-sm">
          <CardContent class="space-y-2 p-5 text-sm">
            <div class="flex items-center gap-2 text-muted-foreground">
              <Wallet class="h-4 w-4" />
              <p class="text-xs font-semibold uppercase tracking-wide">Rumus rekonsiliasi</p>
            </div>
            <p class="text-muted-foreground">
              Ekspektasi laci = modal awal + penjualan tunai.
            </p>
            <p class="text-muted-foreground">
              Selisih = uang fisik − ekspektasi laci.
            </p>
            <div class="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
              <Clock3 class="h-3.5 w-3.5" />
              Hasil langsung tersimpan pada laporan shift.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
