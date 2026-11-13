<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import {
  ArrowRight,
  Banknote,
  Barcode,
  CreditCard,
  LogOut,
  Minus,
  PackageOpen,
  Plus,
  Printer,
  QrCode,
  ReceiptText,
  ScanLine,
  Search,
  ShoppingBag,
  Smartphone,
  Trash2,
  Wallet,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  checkout,
  findRakItemByBarcode,
  getActiveShift,
  getRakCatalog,
} from "../service";
import type {
  CartItem,
  PaymentMethod,
  PosOrder,
  PosShift,
  RakStockRow,
} from "../types";

const router = useRouter();

const loading = ref(true);
const shift = ref<PosShift | null>(null);
const catalog = ref<RakStockRow[]>([]);
const search = ref("");
const scan = ref("");
const scanInput = ref<HTMLElement | null>(null);
const scanning = ref(false);

const cart = ref<CartItem[]>([]);
const metode = ref<PaymentMethod>("TUNAI");
const bayar = ref<number | string>("");
const catatan = ref("");
const submitting = ref(false);

const receipt = ref<PosOrder | null>(null);
const receiptOpen = ref(false);

const METODE: Array<{
  value: PaymentMethod;
  label: string;
  icon: typeof Banknote;
  hint: string;
}> = [
  { value: "TUNAI", label: "Tunai", icon: Banknote, hint: "Uang fisik laci" },
  { value: "QRIS", label: "QRIS", icon: QrCode, hint: "Scan aplikasi" },
  { value: "EDC", label: "EDC", icon: CreditCard, hint: "Kartu debit/kredit" },
  { value: "TRANSFER", label: "Transfer", icon: Smartphone, hint: "Mobile banking" },
];

const rupiah = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const catalogFiltered = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  const rows = keyword
    ? catalog.value.filter(
        (row) =>
          String(row.item?.nama_barang || "").toLowerCase().includes(keyword) ||
          String(row.item?.barcode || "").toLowerCase().includes(keyword),
      )
    : catalog.value;
  return rows.slice(0, 60);
});

const totalItem = computed(() =>
  cart.value.reduce((sum, row) => sum + row.qty_pcs, 0),
);

const subtotal = computed(() =>
  cart.value.reduce((sum, row) => sum + row.qty_pcs * row.harga_jual, 0),
);

const totalDiskon = computed(() =>
  cart.value.reduce((sum, row) => sum + Number(row.diskon || 0), 0),
);

const total = computed(() =>
  Math.max(0, subtotal.value - totalDiskon.value),
);

const bayarValue = computed(() => Number(bayar.value || 0));
const kembalian = computed(() => Math.max(0, bayarValue.value - total.value));

const quickAmounts = computed(() => {
  if (total.value <= 0) return [];
  const roundTo = (step: number) => Math.ceil(total.value / step) * step;
  return Array.from(
    new Set([total.value, roundTo(5000), roundTo(10000), roundTo(50000), roundTo(100000)]),
  )
    .filter((amount) => amount >= total.value)
    .slice(0, 4);
});

const canCheckout = computed(
  () =>
    !!shift.value &&
    cart.value.length > 0 &&
    total.value > 0 &&
    bayarValue.value >= total.value &&
    !submitting.value,
);

const lowStockLabel = (row: RakStockRow) =>
  Number(row.qty) <= 5 ? "Stok tipis" : "Tersedia";

function addRow(row: RakStockRow) {
  const item = row.item;
  if (!item) return;
  if (item.is_active === false) {
    toast.error("Barang tidak aktif dan tidak dapat dijual");
    return;
  }

  const stok = Number(row.qty || 0);
  if (stok <= 0) {
    toast.warning(`${item.nama_barang} tidak punya stok di rak`);
    return;
  }

  const existing = cart.value.find((line) => line.item_id === item.id);
  if (existing) {
    if (existing.qty_pcs >= existing.stok_rak) {
      toast.warning(`Stok rak ${item.nama_barang} hanya ${existing.stok_rak}`);
      return;
    }
    existing.qty_pcs += 1;
    return;
  }

  cart.value.push({
    item_id: item.id,
    barcode: item.barcode,
    nama_barang: item.nama_barang,
    harga_jual: Number(item.harga_jual || 0),
    qty_pcs: 1,
    diskon: 0,
    stok_rak: stok,
    satuan: item.uom?.kode_uom || "Pcs",
  });
}

function changeQty(line: CartItem, delta: number) {
  const next = line.qty_pcs + delta;
  if (next <= 0) {
    removeLine(line);
    return;
  }
  if (next > line.stok_rak) {
    toast.warning(`Stok rak ${line.nama_barang} hanya ${line.stok_rak}`);
    return;
  }
  line.qty_pcs = next;
}

function removeLine(line: CartItem) {
  cart.value = cart.value.filter((row) => row.item_id !== line.item_id);
}

function setDiskon(line: CartItem, value: string) {
  const max = line.qty_pcs * line.harga_jual;
  line.diskon = Math.min(Math.max(Number(value || 0), 0), max);
}

function setMetode(value: PaymentMethod) {
  metode.value = value;
  if (value !== "TUNAI") {
    bayar.value = total.value;
  }
}

function focusScan() {
  scanInput.value?.querySelector<HTMLInputElement>("input")?.focus();
}

function resetCart() {
  cart.value = [];
  bayar.value = "";
  catatan.value = "";
  metode.value = "TUNAI";
}

async function handleScan() {
  const code = scan.value.trim();
  if (!code) return;
  scanning.value = true;
  try {
    const row = await findRakItemByBarcode(code);
    if (!row) {
      toast.error(`Barcode ${code} tidak ditemukan`);
      return;
    }
    addRow(row);
    scan.value = "";
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Gagal membaca barcode");
  } finally {
    scanning.value = false;
    await nextTick();
    focusScan();
  }
}

async function loadData() {
  loading.value = true;
  try {
    const [active, rows] = await Promise.all([getActiveShift(), getRakCatalog()]);
    shift.value = active;
    catalog.value = rows;
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Gagal memuat data kasir",
    );
  } finally {
    loading.value = false;
    await nextTick();
    focusScan();
  }
}

async function submitCheckout() {
  if (!shift.value) {
    toast.error("Buka shift terlebih dahulu");
    return;
  }
  if (cart.value.length === 0) {
    toast.warning("Keranjang masih kosong");
    return;
  }
  if (bayarValue.value < total.value) {
    toast.warning("Uang pembayaran kurang dari total belanja");
    return;
  }

  submitting.value = true;
  try {
    const order = await checkout({
      shift_id: shift.value.id,
      items: cart.value.map((line) => ({
        item_id: line.item_id,
        qty_pcs: line.qty_pcs,
        diskon: Number(line.diskon || 0),
      })),
      bayar: bayarValue.value,
      metode_bayar: metode.value,
      catatan: catatan.value || undefined,
    });

    receipt.value = order;
    receiptOpen.value = true;
    resetCart();
    await loadData();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Checkout gagal");
  } finally {
    submitting.value = false;
  }
}

function printReceipt() {
  window.print();
}

function goToOpenShift() {
  router.push({ name: "PosShiftOpen" });
}

function goToCloseShift() {
  router.push({ name: "PosShiftClose" });
}

function exitKasir() {
  router.push({ name: "Dashboard" });
}

watch(total, (value) => {
  if (metode.value !== "TUNAI") {
    bayar.value = value;
  }
});

onMounted(loadData);
</script>

<template>
  <div
    class="min-h-screen bg-[radial-gradient(circle_at_8%_4%,hsl(var(--primary)/0.10),transparent_42%),radial-gradient(circle_at_92%_8%,hsl(var(--accent)/0.16),transparent_38%)]"
  >
    <!-- Top bar fullscreen -->
    <header
      class="sticky top-0 z-20 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur-md md:px-6"
    >
      <div class="mx-auto flex max-w-[1600px] items-center gap-3">
        <div
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner"
        >
          <ScanLine class="h-6 w-6" />
        </div>

        <div class="min-w-0 flex-1">
          <p class="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Modul 4 · Transaksi
          </p>
          <h1 class="truncate text-lg font-semibold text-foreground md:text-xl">
            Mesin Kasir
          </h1>
        </div>

        <div class="hidden items-center gap-2 sm:flex">
          <Badge
            v-if="shift"
            variant="secondary"
            class="gap-1.5 rounded-full border border-emerald-200/70 bg-emerald-50 px-3 py-1 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Shift {{ shift.no_shift }}
          </Badge>
          <Badge
            v-else
            variant="outline"
            class="rounded-full border-destructive/30 bg-destructive/5 text-destructive"
          >
            Shift belum dibuka
          </Badge>
        </div>

        <Button
          variant="outline"
          class="h-10 gap-2 rounded-xl"
          title="Keluar dari layar kasir"
          @click="exitKasir"
        >
          <LogOut class="h-4 w-4" />
          <span class="hidden sm:inline">Keluar</span>
        </Button>
      </div>
    </header>

    <main
      class="mx-auto grid max-w-[1600px] gap-4 p-4 md:p-6 lg:grid-cols-[minmax(0,1fr)_400px]"
    >
      <!-- Kiri: scan & katalog -->
      <section class="min-w-0 space-y-4">
        <Card class="rounded-3xl border-border/60 bg-card/85 shadow-sm backdrop-blur">
          <CardContent class="p-4 md:p-5">
            <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <label class="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Scan barcode
                </label>
                <div ref="scanInput" class="relative">
                  <Barcode class="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    v-model="scan"
                    placeholder="Scan atau ketik barcode lalu Enter"
                    class="h-10 rounded-xl pl-9"
                    :disabled="!shift"
                    @keydown.enter.prevent="handleScan"
                  />
                </div>
              </div>
              <Button
                class="h-10 self-end rounded-xl px-5 md:mb-0"
                :disabled="!shift || !scan.trim() || scanning"
                @click="handleScan"
              >
                {{ scanning ? "Mencari..." : "Tambah" }}
              </Button>
            </div>

            <div class="relative mt-3">
              <Search class="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                v-model="search"
                placeholder="Cari nama barang atau barcode..."
                class="h-10 rounded-xl pl-9"
              />
            </div>
          </CardContent>
        </Card>

        <Card
          v-if="!shift && !loading"
          class="rounded-3xl border-destructive/25 bg-destructive/5"
        >
          <CardContent class="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div class="flex items-start gap-3">
              <div class="rounded-2xl bg-destructive/10 p-2 text-destructive">
                <Wallet class="h-5 w-5" />
              </div>
              <div>
                <p class="font-semibold text-foreground">Shift kasir belum dibuka</p>
                <p class="text-sm text-muted-foreground">
                  Buka shift dan isi modal awal laci sebelum melayani transaksi.
                </p>
              </div>
            </div>
            <Button class="rounded-xl" @click="goToOpenShift">
              Buka Shift
              <ArrowRight class="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card class="rounded-3xl border-border/60 bg-card/85 shadow-sm">
          <CardContent class="p-4 md:p-5">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 class="text-sm font-semibold text-foreground">Katalog Rak</h2>
                <p class="text-xs text-muted-foreground">
                  {{ catalogFiltered.length }} barang ditampilkan · stok siap jual
                </p>
              </div>
              <Badge variant="secondary" class="rounded-full">
                <PackageOpen class="mr-1 h-3.5 w-3.5" />
                RAK
              </Badge>
            </div>

            <div
              v-if="loading"
              class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
            >
              <div
                v-for="n in 8"
                :key="'skel-' + n"
                class="h-28 animate-pulse rounded-2xl bg-muted/60"
              />
            </div>

            <div
              v-else-if="catalogFiltered.length === 0"
              class="rounded-2xl border border-dashed border-border/70 px-4 py-12 text-center"
            >
              <PackageOpen class="mx-auto mb-2 h-10 w-10 text-muted-foreground/50" />
              <p class="font-medium text-foreground">Barang tidak ditemukan</p>
              <p class="mt-1 text-xs text-muted-foreground">
                Pastikan barang sudah punya slot stok di rak pajangan.
              </p>
            </div>

            <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              <button
                v-for="row in catalogFiltered"
                :key="row.id"
                type="button"
                class="group flex h-full flex-col rounded-2xl border border-border/60 bg-card p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="!shift || Number(row.qty) <= 0"
                @click="addRow(row)"
              >
                <div class="flex items-start justify-between gap-2">
                  <p class="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-foreground">
                    {{ row.item?.nama_barang }}
                  </p>
                  <span
                    class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground"
                  >
                    <Plus class="h-4 w-4" />
                  </span>
                </div>
                <p class="mt-1 truncate text-[11px] text-muted-foreground">
                  {{ row.item?.barcode }} · {{ row.item?.uom?.kode_uom || "Pcs" }}
                </p>
                <div class="mt-auto flex items-end justify-between gap-2 pt-3">
                  <p class="text-sm font-semibold text-primary">
                    {{ rupiah(row.item?.harga_jual) }}
                  </p>
                  <Badge
                    variant="outline"
                    class="rounded-full px-2 py-0 text-[10px]"
                    :class="
                      Number(row.qty) <= 5
                        ? 'border-amber-300/70 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                        : 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                    "
                  >
                    {{ lowStockLabel(row) }} · {{ row.qty }}
                  </Badge>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </section>

      <!-- Kanan: keranjang & pembayaran -->
      <aside class="min-w-0">
        <Card
          class="flex max-h-[calc(100vh-7.5rem)] flex-col overflow-hidden rounded-3xl border-border/60 bg-card/90 shadow-lg shadow-primary/5 backdrop-blur lg:sticky lg:top-[5.5rem]"
        >
          <div class="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
            <div class="flex items-center gap-2">
              <ShoppingBag class="h-5 w-5 text-primary" />
              <h2 class="text-sm font-semibold text-foreground">Keranjang</h2>
              <Badge variant="secondary" class="rounded-full">
                {{ totalItem }}
              </Badge>
            </div>
            <Button
              v-if="cart.length"
              variant="ghost"
              size="sm"
              class="h-7 rounded-lg text-xs text-muted-foreground"
              @click="resetCart"
            >
              Kosongkan
            </Button>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            <div
              v-if="cart.length === 0"
              class="flex h-full min-h-[180px] flex-col items-center justify-center px-4 text-center"
            >
              <div class="rounded-full bg-muted/70 p-4">
                <ShoppingBag class="h-8 w-8 text-muted-foreground/60" />
              </div>
              <p class="mt-3 text-sm font-medium text-foreground">Keranjang kosong</p>
              <p class="mt-1 text-xs text-muted-foreground">
                Scan barcode atau klik barang di katalog.
              </p>
            </div>

            <ul v-else class="space-y-2">
              <li
                v-for="line in cart"
                :key="line.item_id"
                class="rounded-2xl border border-border/60 bg-background/70 p-3"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-foreground">
                      {{ line.nama_barang }}
                    </p>
                    <p class="text-[11px] text-muted-foreground">
                      {{ rupiah(line.harga_jual) }} / {{ line.satuan }}
                    </p>
                  </div>
                  <button
                    type="button"
                    class="rounded-lg p-1 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Hapus item"
                    @click="removeLine(line)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>

                <div class="mt-2 flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      class="h-7 w-7 rounded-lg"
                      @click="changeQty(line, -1)"
                    >
                      <Minus class="h-3.5 w-3.5" />
                    </Button>
                    <span class="w-8 text-center text-sm font-semibold text-foreground">
                      {{ line.qty_pcs }}
                    </span>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      class="h-7 w-7 rounded-lg"
                      @click="changeQty(line, 1)"
                    >
                      <Plus class="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div class="flex items-center gap-1.5">
                    <span class="text-[11px] text-muted-foreground">Diskon</span>
                    <Input
                      :model-value="line.diskon"
                      type="number"
                      min="0"
                      class="h-7 w-24 rounded-lg px-2 text-right text-xs"
                      @update:model-value="setDiskon(line, String($event))"
                    />
                  </div>
                </div>

                <div class="mt-2 flex items-center justify-between text-sm">
                  <span class="text-xs text-muted-foreground">
                    Stok rak {{ line.stok_rak }}
                  </span>
                  <span class="font-semibold text-foreground">
                    {{ rupiah(line.qty_pcs * line.harga_jual - Number(line.diskon || 0)) }}
                  </span>
                </div>
              </li>
            </ul>
          </div>

          <div class="border-t border-border/60 bg-muted/20 px-4 py-3">
            <div class="space-y-1.5 text-sm">
              <div class="flex items-center justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{{ rupiah(subtotal) }}</span>
              </div>
              <div class="flex items-center justify-between text-muted-foreground">
                <span>Diskon</span>
                <span class="text-rose-600 dark:text-rose-400">-{{ rupiah(totalDiskon) }}</span>
              </div>
              <div class="flex items-center justify-between border-t border-border/60 pt-2">
                <span class="font-semibold text-foreground">Total</span>
                <span class="text-lg font-bold text-primary">{{ rupiah(total) }}</span>
              </div>
            </div>

            <div class="mt-3 grid grid-cols-2 gap-2">
              <button
                v-for="option in METODE"
                :key="option.value"
                type="button"
                class="flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition"
                :class="
                  metode === option.value
                    ? 'border-primary/50 bg-primary/10 text-primary shadow-sm'
                    : 'border-border/60 bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground'
                "
                @click="setMetode(option.value)"
              >
                <component :is="option.icon" class="h-4 w-4 shrink-0" />
                <span class="min-w-0">
                  <span class="block truncate text-xs font-semibold">{{ option.label }}</span>
                  <span class="block truncate text-[10px] opacity-70">{{ option.hint }}</span>
                </span>
              </button>
            </div>

            <div class="mt-3">
              <label class="mb-1 block text-xs font-medium text-muted-foreground">
                Uang diterima
              </label>
              <Input
                v-model="bayar"
                type="number"
                min="0"
                class="h-10 rounded-xl text-right text-base font-semibold"
                :disabled="metode !== 'TUNAI'"
                placeholder="0"
              />
              <div v-if="metode === 'TUNAI' && quickAmounts.length" class="mt-2 flex flex-wrap gap-1.5">
                <button
                  v-for="amount in quickAmounts"
                  :key="amount"
                  type="button"
                  class="rounded-full border border-border/70 bg-card px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:border-primary/40 hover:bg-primary/5"
                  @click="bayar = amount"
                >
                  {{ amount === total ? "Uang pas" : rupiah(amount) }}
                </button>
              </div>
            </div>

            <div class="mt-2 flex items-center justify-between rounded-xl bg-card px-3 py-2 text-sm">
              <span class="text-muted-foreground">Kembalian</span>
              <span class="font-semibold text-emerald-600 dark:text-emerald-400">
                {{ rupiah(kembalian) }}
              </span>
            </div>

            <Button
              class="mt-3 h-11 w-full rounded-xl text-base font-semibold"
              :disabled="!canCheckout"
              @click="submitCheckout"
            >
              <ReceiptText class="h-5 w-5" />
              {{ submitting ? "Memproses..." : "Bayar & Cetak Struk" }}
            </Button>

            <div class="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                Modal awal {{ shift ? rupiah(shift.modal_awal) : "-" }} · buka
                {{ formatTime(shift?.opened_at) }}
              </span>
              <button
                v-if="shift"
                type="button"
                class="font-medium text-primary hover:underline"
                @click="goToCloseShift"
              >
                Tutup shift
              </button>
            </div>
          </div>
        </Card>
      </aside>
    </main>

    <!-- Struk -->
    <Dialog v-model:open="receiptOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <ReceiptText class="h-5 w-5 text-primary" />
            Transaksi Berhasil
          </DialogTitle>
          <DialogDescription>
            Struk {{ receipt?.no_struk }} tersimpan dan stok rak sudah dipotong.
          </DialogDescription>
        </DialogHeader>

        <div class="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          <div class="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
            <div class="flex justify-between gap-2">
              <span class="text-muted-foreground">Metode</span>
              <span class="font-medium">{{ receipt?.metode_bayar }}</span>
            </div>
            <div class="mt-1 flex justify-between gap-2">
              <span class="text-muted-foreground">Total</span>
              <span class="font-semibold">{{ rupiah(receipt?.total_amount) }}</span>
            </div>
            <div class="mt-1 flex justify-between gap-2">
              <span class="text-muted-foreground">Dibayar</span>
              <span class="font-medium">{{ rupiah(receipt?.bayar) }}</span>
            </div>
            <div class="mt-1 flex justify-between gap-2">
              <span class="text-muted-foreground">Kembalian</span>
              <span class="font-semibold text-emerald-600 dark:text-emerald-400">
                {{ rupiah(receipt?.kembalian) }}
              </span>
            </div>
          </div>

          <ul class="space-y-1.5 text-sm">
            <li
              v-for="detail in receipt?.details || []"
              :key="detail.id"
              class="flex items-start justify-between gap-3"
            >
              <span class="min-w-0">
                <span class="block truncate font-medium">{{ detail.item?.nama_barang }}</span>
                <span class="text-[11px] text-muted-foreground">
                  {{ detail.qty_pcs }} × {{ rupiah(detail.harga_satuan) }}
                  <template v-if="Number(detail.diskon) > 0">
                    · diskon {{ rupiah(detail.diskon) }}
                  </template>
                </span>
              </span>
              <span class="shrink-0 font-medium">{{ rupiah(detail.subtotal) }}</span>
            </li>
          </ul>
        </div>

        <DialogFooter class="gap-2 sm:justify-between">
          <Button variant="outline" class="rounded-xl" @click="printReceipt">
            <Printer class="h-4 w-4" />
            Cetak Struk
          </Button>
          <Button class="rounded-xl" @click="receiptOpen = false">
            Transaksi Baru
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Area cetak (hanya tampil saat print) -->
    <div v-if="receipt" id="pos-receipt-print" class="hidden print:block">
      <div style="max-width: 320px; margin: 0 auto; font-family: monospace; color: #111">
        <h2 style="text-align: center; margin: 0 0 4px">MINI MARKET</h2>
        <p style="text-align: center; margin: 0 0 8px; font-size: 12px">
          Struk {{ receipt.no_struk }}
        </p>
        <p style="font-size: 11px; margin: 0 0 8px">
          {{ new Date(receipt.createdAt).toLocaleString("id-ID") }}
        </p>
        <hr />
        <div
          v-for="detail in receipt.details"
          :key="detail.id"
          style="font-size: 12px; margin: 6px 0"
        >
          <div>{{ detail.item?.nama_barang }}</div>
          <div style="display: flex; justify-content: space-between">
            <span>{{ detail.qty_pcs }} x {{ rupiah(detail.harga_satuan) }}</span>
            <span>{{ rupiah(detail.subtotal) }}</span>
          </div>
        </div>
        <hr />
        <div style="display: flex; justify-content: space-between; font-size: 12px">
          <span>Total</span>
          <strong>{{ rupiah(receipt.total_amount) }}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px">
          <span>{{ receipt.metode_bayar }}</span>
          <span>{{ rupiah(receipt.bayar) }}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 12px">
          <span>Kembali</span>
          <span>{{ rupiah(receipt.kembalian) }}</span>
        </div>
        <p style="text-align: center; font-size: 11px; margin-top: 12px">
          Terima kasih telah berbelanja
        </p>
      </div>
    </div>
  </div>
</template>

<style>
@media print {
  body * {
    visibility: hidden !important;
  }
  #pos-receipt-print,
  #pos-receipt-print * {
    visibility: visible !important;
  }
  #pos-receipt-print {
    position: absolute;
    inset: 0;
    width: 100%;
    background: #fff;
  }
}
</style>
