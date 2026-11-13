<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import {
  ArrowRight,
  Clock3,
  DoorOpen,
  Lock,
  ScanLine,
  ShieldCheck,
  Wallet,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getActiveShift, openShift } from "../service";
import type { PosShift } from "../types";

const router = useRouter();

const loading = ref(true);
const submitting = ref(false);
const activeShift = ref<PosShift | null>(null);
const modalAwal = ref<number | string>("");
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

const modalValue = computed(() => Number(modalAwal.value || 0));
const canSubmit = computed(() => !submitting.value && modalValue.value >= 0);

const quickModal = [100000, 200000, 300000, 500000];

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

async function submitOpenShift() {
  if (!canSubmit.value) return;

  submitting.value = true;
  try {
    await openShift({
      modal_awal: modalValue.value,
      catatan: catatan.value.trim() || undefined,
    });
    toast.success("Shift kasir berhasil dibuka");
    router.push({ name: "PosKasir" });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Gagal membuka shift");
  } finally {
    submitting.value = false;
  }
}

function goToKasir() {
  router.push({ name: "PosKasir" });
}

function goToCloseShift() {
  router.push({ name: "PosShiftClose" });
}

onMounted(loadActiveShift);
</script>

<template>
  <div class="space-y-6 p-1 md:p-2">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <span
          class="rounded-md bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800 dark:bg-sky-950/50 dark:text-sky-300"
        >
          Modul 4 : Transaksi (2.1)
        </span>
        <h1 class="mt-1 text-2xl font-bold tracking-tight text-foreground">
          Buka Shift Kasir
        </h1>
        <p class="text-sm text-muted-foreground">
          Mulai sesi kasir dengan mencatat modal awal uang di laci.
        </p>
      </div>

      <Badge
        v-if="activeShift"
        variant="secondary"
        class="w-fit gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-3 py-1 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Shift aktif
      </Badge>
    </header>

    <div
      v-if="loading"
      class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div class="h-72 animate-pulse rounded-2xl bg-muted/60" />
      <div class="h-72 animate-pulse rounded-2xl bg-muted/60" />
    </div>

    <!-- Sudah ada shift aktif -->
    <Card
      v-else-if="activeShift"
      class="overflow-hidden rounded-3xl border-border/60 bg-card/85 shadow-sm"
    >
      <CardContent class="p-5 md:p-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div class="flex items-start gap-3">
            <div class="rounded-2xl bg-emerald-100 p-3 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <DoorOpen class="h-6 w-6" />
            </div>
            <div>
              <p class="text-sm text-muted-foreground">Shift yang sedang berjalan</p>
              <h2 class="text-xl font-semibold text-foreground">
                {{ activeShift.no_shift }}
              </h2>
              <p class="mt-1 text-sm text-muted-foreground">
                Kasir {{ activeShift.user?.name || "-" }} · dibuka
                {{ formatDateTime(activeShift.opened_at) }}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            class="w-fit rounded-full border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            OPEN
          </Badge>
        </div>

        <div class="mt-5 grid gap-3 sm:grid-cols-2">
          <div class="rounded-2xl border border-border/60 bg-muted/30 p-4">
            <p class="text-xs text-muted-foreground">Modal awal laci</p>
            <p class="mt-1 text-lg font-semibold text-foreground">
              {{ rupiah(activeShift.modal_awal) }}
            </p>
          </div>
          <div class="rounded-2xl border border-border/60 bg-muted/30 p-4">
            <p class="text-xs text-muted-foreground">Catatan shift</p>
            <p class="mt-1 line-clamp-2 text-sm text-foreground">
              {{ activeShift.catatan || "Tidak ada catatan" }}
            </p>
          </div>
        </div>

        <div
          class="mt-5 flex items-start gap-2 rounded-2xl border border-sky-200/70 bg-sky-50/70 p-3 text-xs text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-300"
        >
          <ShieldCheck class="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Satu kasir hanya boleh punya satu shift OPEN. Tutup shift berjalan
            sebelum membuka shift baru.
          </p>
        </div>

        <div class="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button class="rounded-xl" @click="goToKasir">
            <ScanLine class="h-4 w-4" />
            Masuk Mesin Kasir
            <ArrowRight class="h-4 w-4" />
          </Button>
          <Button variant="outline" class="rounded-xl" @click="goToCloseShift">
            <Lock class="h-4 w-4" />
            Tutup Shift
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- Belum ada shift -->
    <div v-else class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card class="rounded-3xl border-border/60 bg-card/85 shadow-sm">
        <CardContent class="space-y-5 p-5 md:p-6">
          <div class="flex items-start gap-3">
            <div class="rounded-2xl bg-sky-100 p-3 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
              <DoorOpen class="h-6 w-6" />
            </div>
            <div>
              <h2 class="text-lg font-semibold text-foreground">Formulir buka shift</h2>
              <p class="text-sm text-muted-foreground">
                Masukkan jumlah uang tunai yang benar-benar ada di laci.
              </p>
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-foreground">
              Modal awal laci
            </label>
            <div class="relative">
              <span class="pointer-events-none absolute left-3 top-2.5 text-sm text-muted-foreground">
                Rp
              </span>
              <Input
                v-model="modalAwal"
                type="number"
                min="0"
                placeholder="0"
                class="h-11 rounded-xl pl-9 text-right text-lg font-semibold"
              />
            </div>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <button
                v-for="amount in quickModal"
                :key="amount"
                type="button"
                class="rounded-full border border-border/70 bg-card px-3 py-1 text-xs font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5"
                @click="modalAwal = amount"
              >
                {{ rupiah(amount) }}
              </button>
            </div>
          </div>

          <div>
            <label class="mb-1.5 block text-sm font-medium text-foreground">
              Catatan <span class="text-xs font-normal text-muted-foreground">(opsional)</span>
            </label>
            <textarea
              v-model="catatan"
              rows="3"
              placeholder="Contoh: serah terima laci dari shift pagi"
              class="w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div class="flex flex-col gap-2 sm:flex-row">
            <Button
              class="h-11 rounded-xl px-6"
              :disabled="!canSubmit"
              @click="submitOpenShift"
            >
              <DoorOpen class="h-4 w-4" />
              {{ submitting ? "Membuka shift..." : "Buka Shift Sekarang" }}
            </Button>
            <Button
              variant="outline"
              class="h-11 rounded-xl"
              @click="router.push({ name: 'Dashboard' })"
            >
              Batal
            </Button>
          </div>
        </CardContent>
      </Card>

      <div class="space-y-4">
        <Card class="rounded-3xl border-border/60 bg-gradient-to-br from-sky-50 via-card to-violet-50 shadow-sm dark:from-sky-950/20 dark:via-card dark:to-violet-950/20">
          <CardContent class="p-5">
            <div class="flex items-center gap-2 text-sky-700 dark:text-sky-300">
              <ShieldCheck class="h-5 w-5" />
              <h3 class="text-sm font-semibold">Blind closing</h3>
            </div>
            <p class="mt-2 text-sm text-muted-foreground">
              Selama shift berjalan, kasir tidak melihat akumulasi omzet maupun
              ekspektasi uang laci. Angka rekonsiliasi baru terbuka saat shift
              ditutup.
            </p>
          </CardContent>
        </Card>

        <Card class="rounded-3xl border-border/60 bg-card/85 shadow-sm">
          <CardContent class="space-y-3 p-5">
            <div class="flex items-center gap-2 text-muted-foreground">
              <Clock3 class="h-4 w-4" />
              <p class="text-xs font-semibold uppercase tracking-wide">Alur shift</p>
            </div>
            <ol class="space-y-3 text-sm">
              <li class="flex gap-2">
                <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">1</span>
                <span class="text-muted-foreground">Hitung dan isi modal awal laci.</span>
              </li>
              <li class="flex gap-2">
                <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">2</span>
                <span class="text-muted-foreground">Layani transaksi di mesin kasir.</span>
              </li>
              <li class="flex gap-2">
                <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">3</span>
                <span class="text-muted-foreground">Tutup shift dan cocokkan uang fisik.</span>
              </li>
            </ol>
          </CardContent>
        </Card>

        <div class="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          <Wallet class="h-4 w-4 shrink-0" />
          Modal awal menjadi dasar perhitungan ekspektasi kas laci saat tutup shift.
        </div>
      </div>
    </div>
  </div>
</template>
