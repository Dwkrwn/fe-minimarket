<template>
  <div class="space-y-6 p-1 md:p-2">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 3 : Purchasing (4.2)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">Hutang &amp; Pembayaran</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Pantau jatuh tempo tagihan supplier, alarm TOP, dan catat pembayaran bertahap maupun pelunasan.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="loading" @click="load" class="flex items-center gap-1.5">
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
          <span>Refresh</span>
        </Button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Sisa Hutang</p>
            <h3 class="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
              Rp {{ formatNumber(totalRemaining) }}
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">{{ payables.length }} tagihan aktif</p>
          </div>
          <div class="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
            <Wallet class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Terlambat</p>
            <h3 class="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{{ overdueRows.length }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Rp {{ formatNumber(overdueAmount) }}</p>
          </div>
          <div class="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
            <AlertTriangle class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Jatuh Tempo Dekat</p>
            <h3 class="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{{ dueSoonRows.length }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Hari ini / &le; 3 hari</p>
          </div>
          <div class="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
            <CalendarClock class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Sudah Dibayar</p>
            <h3 class="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              Rp {{ formatNumber(totalPaid) }}
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">Akumulasi pembayaran</p>
          </div>
          <div class="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Banknote class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>
    </div>

    <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
      <CardContent class="p-4">
        <div class="flex flex-col md:flex-row md:items-center gap-3">
          <div class="relative w-full md:flex-1">
            <Search class="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              v-model="searchQuery"
              placeholder="Cari nomor nota atau supplier..."
              class="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>
          <select
            v-model="alarmFilter"
            class="h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 md:w-64"
          >
            <option value="">Semua alarm</option>
            <option value="TERLAMBAT_OVERDUE">Terlambat / Overdue</option>
            <option value="JATUH_TEMPO_HARI_INI">Jatuh tempo hari ini</option>
            <option value="SEGERA_JATUH_TEMPO">Segera jatuh tempo (&le; 3 hari)</option>
            <option value="AMAN">Aman</option>
          </select>
          <Button variant="ghost" size="sm" class="text-xs text-slate-500" @click="resetFilter">Reset</Button>
        </div>
      </CardContent>
    </Card>

    <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="px-4 py-3.5">No. Nota / Supplier</th>
              <th class="px-4 py-3.5">Jatuh Tempo</th>
              <th class="px-4 py-3.5 text-right">Tagihan</th>
              <th class="px-4 py-3.5 text-right">Terbayar</th>
              <th class="px-4 py-3.5 text-right">Sisa</th>
              <th class="px-4 py-3.5 text-center">Alarm</th>
              <th class="px-4 py-3.5 text-center">Status</th>
              <th class="px-4 py-3.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <template v-if="loading">
              <tr v-for="n in 4" :key="'skel-' + n">
                <td colspan="8" class="px-4 py-4"><Skeleton class="h-6 w-full" /></td>
              </tr>
            </template>

            <tr v-else-if="filteredPayables.length === 0">
              <td colspan="8" class="px-4 py-12 text-center text-slate-500">
                <CheckCircle2 class="w-10 h-10 mx-auto text-emerald-300 dark:text-emerald-700 mb-2" />
                <p class="font-medium text-slate-700 dark:text-slate-300">Tidak ada hutang aktif</p>
                <p class="text-xs text-slate-400 mt-1">
                  Semua tagihan sudah lunas, atau belum ada nota yang diverifikasi pada 4.1.
                </p>
              </td>
            </tr>

            <tr
              v-else
              v-for="row in filteredPayables"
              :key="row.invoice_id"
              class="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors"
            >
              <td class="px-4 py-3.5">
                <div class="font-mono font-semibold text-slate-900 dark:text-white">{{ row.no_invoice }}</div>
                <div class="text-xs text-slate-500">{{ row.supplier_name }}</div>
                <div class="text-[11px] text-slate-400">{{ formatDate(row.tgl_invoice) }} &middot; TOP {{ row.top_days }} hari</div>
              </td>
              <td class="px-4 py-3.5">
                <div class="text-xs font-medium">{{ formatDate(row.tgl_jatuh_tempo) }}</div>
                <div class="text-[11px]" :class="alarmTextClass(row.alarm_status)">{{ row.alarm_message }}</div>
              </td>
              <td class="px-4 py-3.5 text-right font-mono">Rp {{ formatNumber(row.net_payable) }}</td>
              <td class="px-4 py-3.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                Rp {{ formatNumber(row.total_paid) }}
              </td>
              <td class="px-4 py-3.5 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                Rp {{ formatNumber(row.remaining_payable) }}
              </td>
              <td class="px-4 py-3.5 text-center">
                <Badge variant="outline" :class="alarmBadgeClass(row.alarm_status)">
                  {{ alarmLabel(row.alarm_status) }}
                </Badge>
              </td>
              <td class="px-4 py-3.5 text-center">
                <Badge variant="outline" :class="statusClass(row.status)">{{ statusLabel(row.status) }}</Badge>
              </td>
              <td class="px-4 py-3.5 text-center">
                <div class="flex items-center justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 px-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-1"
                    title="Catat pembayaran"
                    @click="openPaymentDialog(row)"
                  >
                    <Banknote class="w-4 h-4" />
                    <span class="text-xs">Bayar</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 px-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-1"
                    title="Tandai lunas"
                    @click="openMarkPaidDialog(row)"
                  >
                    <CheckCheck class="w-4 h-4" />
                    <span class="text-xs">Lunas</span>
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <GlobalDialog
      v-model:open="paymentDialogOpen"
      title="Catat Pembayaran Supplier"
      :description="selectedPayable
        ? `Nota ${selectedPayable.no_invoice} — sisa Rp ${formatNumber(selectedPayable.remaining_payable)}.`
        : 'Pembayaran sebagian atau penuh untuk tagihan supplier.'"
      type="info"
      content-class="max-w-xl"
      confirm-text="Simpan Pembayaran"
      :is-loading="paying"
      @confirm="submitPayment"
    >
      <form class="space-y-4" @submit.prevent="submitPayment">
        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Nominal Bayar</label>
          <Input
            v-model.number="payForm.jumlah_bayar"
            type="number"
            min="1"
            :max="maxPayable"
            step="100"
            class="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-mono"
          />
          <div class="flex items-center justify-between text-[11px] mt-1">
            <span class="text-slate-400">Maksimal Rp {{ formatNumber(maxPayable) }}</span>
            <button type="button" class="text-emerald-600 hover:underline" @click="payForm.jumlah_bayar = maxPayable">
              Isi sisa penuh
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Metode Bayar</label>
            <select
              v-model="payForm.metode_bayar"
              class="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="TRANSFER">Transfer Bank</option>
              <option value="GIRO">Giro</option>
              <option value="KAS">Kas / Tunai</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">No. Referensi</label>
            <Input
              v-model="payForm.no_referensi"
              placeholder="No. transfer / cek (opsional)"
              maxlength="100"
              class="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Catatan</label>
          <Input
            v-model="payForm.catatan"
            placeholder="Contoh: pembayaran termin 1"
            class="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          />
        </div>

        <p v-if="payError" class="text-xs text-rose-600 dark:text-rose-400">{{ payError }}</p>
      </form>
    </GlobalDialog>

    <GlobalDialog
      v-model:open="markPaidDialogOpen"
      title="Tandai Tagihan Lunas"
      :description="markPaidTarget
        ? `Nota ${markPaidTarget.no_invoice} akan dilunasi sebesar Rp ${formatNumber(markPaidTarget.remaining_payable)}.`
        : 'Seluruh sisa tagihan akan dibayar penuh.'"
      type="success"
      confirm-text="Tandai Lunas"
      :is-loading="markingPaid"
      @confirm="confirmMarkPaid"
    >
      <div class="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm text-emerald-800 dark:text-emerald-300">
        <p class="flex items-center gap-2 font-medium">
          <CheckCircle2 class="w-4 h-4" />
          Pelunasan penuh
        </p>
        <p class="text-xs mt-1">
          Sistem membukukan pembayaran sebesar sisa tagihan dan mengubah status nota menjadi Lunas.
        </p>
      </div>
    </GlobalDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  AlertTriangle,
  Banknote,
  CalendarClock,
  CheckCheck,
  CheckCircle2,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import {
  createPurchasePayment,
  getPayables,
  markInvoicePaid,
  type Payable,
  type PayableAlarmStatus,
  type PayableStatus,
  type PaymentMethod,
} from "./payablesService";

const payables = ref<Payable[]>([]);
const loading = ref(false);
const searchQuery = ref("");
const alarmFilter = ref("");

const paymentDialogOpen = ref(false);
const selectedPayable = ref<Payable | null>(null);
const paying = ref(false);
const payForm = ref<{
  jumlah_bayar: number;
  metode_bayar: PaymentMethod;
  no_referensi: string;
  catatan: string;
}>({
  jumlah_bayar: 0,
  metode_bayar: "TRANSFER",
  no_referensi: "",
  catatan: "",
});

const markPaidDialogOpen = ref(false);
const markPaidTarget = ref<Payable | null>(null);
const markingPaid = ref(false);

const totalRemaining = computed(() =>
  payables.value.reduce((acc, row) => acc + Number(row.remaining_payable || 0), 0),
);
const totalPaid = computed(() =>
  payables.value.reduce((acc, row) => acc + Number(row.total_paid || 0), 0),
);
const overdueRows = computed(() =>
  payables.value.filter((row) => row.alarm_status === "TERLAMBAT_OVERDUE"),
);
const overdueAmount = computed(() =>
  overdueRows.value.reduce((acc, row) => acc + Number(row.remaining_payable || 0), 0),
);
const dueSoonRows = computed(() =>
  payables.value.filter(
    (row) =>
      row.alarm_status === "JATUH_TEMPO_HARI_INI" ||
      row.alarm_status === "SEGERA_JATUH_TEMPO",
  ),
);

const filteredPayables = computed(() => {
  const term = searchQuery.value.trim().toLowerCase();
  return payables.value.filter((row) => {
    const matchesTerm =
      !term ||
      row.no_invoice.toLowerCase().includes(term) ||
      row.supplier_name.toLowerCase().includes(term);
    const matchesAlarm = !alarmFilter.value || row.alarm_status === alarmFilter.value;
    return matchesTerm && matchesAlarm;
  });
});

const maxPayable = computed(() => Number(selectedPayable.value?.remaining_payable || 0));
const payError = computed(() => {
  if (!selectedPayable.value) return "";
  const nominal = Number(payForm.value.jumlah_bayar || 0);
  if (nominal <= 0) return "Nominal pembayaran harus lebih dari 0.";
  if (nominal > maxPayable.value) return `Nominal melebihi sisa tagihan Rp ${formatNumber(maxPayable.value)}.`;
  return "";
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

function alarmLabel(status: PayableAlarmStatus) {
  switch (status) {
    case "TERLAMBAT_OVERDUE":
      return "Terlambat";
    case "JATUH_TEMPO_HARI_INI":
      return "Hari Ini";
    case "SEGERA_JATUH_TEMPO":
      return "Segera";
    default:
      return "Aman";
  }
}

function alarmBadgeClass(status: PayableAlarmStatus) {
  switch (status) {
    case "TERLAMBAT_OVERDUE":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
    case "JATUH_TEMPO_HARI_INI":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
    case "SEGERA_JATUH_TEMPO":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    default:
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
  }
}

function alarmTextClass(status: PayableAlarmStatus) {
  switch (status) {
    case "TERLAMBAT_OVERDUE":
      return "text-rose-600 dark:text-rose-400 font-semibold";
    case "JATUH_TEMPO_HARI_INI":
    case "SEGERA_JATUH_TEMPO":
      return "text-amber-600 dark:text-amber-400 font-semibold";
    default:
      return "text-slate-500";
  }
}

function statusClass(status: PayableStatus) {
  switch (status) {
    case "PARTIAL":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
    case "OVERDUE":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
    default:
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
  }
}

function statusLabel(status: PayableStatus) {
  switch (status) {
    case "PARTIAL":
      return "🟠 Sebagian";
    case "OVERDUE":
      return "🔴 Overdue";
    default:
      return "🟡 Belum Bayar";
  }
}

function resetFilter() {
  searchQuery.value = "";
  alarmFilter.value = "";
}

function openPaymentDialog(row: Payable) {
  selectedPayable.value = row;
  payForm.value = {
    jumlah_bayar: Number(row.remaining_payable || 0),
    metode_bayar: "TRANSFER",
    no_referensi: "",
    catatan: "",
  };
  paymentDialogOpen.value = true;
}

function openMarkPaidDialog(row: Payable) {
  markPaidTarget.value = row;
  markPaidDialogOpen.value = true;
}

async function submitPayment() {
  if (!selectedPayable.value || payError.value) return;
  paying.value = true;
  try {
    const result = await createPurchasePayment({
      invoice_id: selectedPayable.value.invoice_id,
      jumlah_bayar: Number(payForm.value.jumlah_bayar),
      metode_bayar: payForm.value.metode_bayar,
      no_referensi: payForm.value.no_referensi.trim() || undefined,
      catatan: payForm.value.catatan.trim() || undefined,
    });
    toast.success("Pembayaran berhasil dibukukan", {
      description: `Status nota ${result.status_label}. Sisa tagihan Rp ${formatNumber(result.remaining_payable)}.`,
    });
    paymentDialogOpen.value = false;
    await load();
  } catch (error: any) {
    console.error("Gagal membukukan pembayaran:", error);
    toast.error(error.message || "Gagal membukukan pembayaran supplier");
  } finally {
    paying.value = false;
  }
}

async function confirmMarkPaid() {
  if (!markPaidTarget.value) return;
  markingPaid.value = true;
  try {
    const result = await markInvoicePaid(markPaidTarget.value.invoice_id);
    toast.success("Tagihan ditandai lunas", {
      description: `Pembayaran Rp ${formatNumber(markPaidTarget.value.remaining_payable)} tercatat. Sisa Rp ${formatNumber(result.remaining_payable)}.`,
    });
    markPaidDialogOpen.value = false;
    await load();
  } catch (error: any) {
    console.error("Gagal menandai lunas:", error);
    toast.error(error.message || "Gagal menandai tagihan lunas");
  } finally {
    markingPaid.value = false;
  }
}

async function load() {
  loading.value = true;
  try {
    payables.value = await getPayables();
  } catch (error: any) {
    console.error("Gagal memuat jadwal hutang:", error);
    toast.error(error.message || "Gagal memuat jadwal hutang supplier");
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
