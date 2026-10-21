<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-vue-next";
import { getPeriodeSummary, printAndLockPeriode } from "../service";

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const printing = ref(false);
const summary = ref<any>(null);

const periode = computed(() => summary.value?.periode || null);
const companyName = computed(
  () =>
    periode.value?.m_unit_bisni?.nama_comp ||
    periode.value?.m_unit_bisnis?.nama_comp ||
    "-",
);
const opnames = computed(() => summary.value?.opnames || []);
const totals = computed(
  () =>
    summary.value?.totals || {
      total_qty_selisih: 0,
      total_nilai_selisih: 0,
    },
);
const splitSummary = computed(() => {
  const fallback = opnames.value.reduce(
    (acc: any, row: any) => {
      const details = row.t_stock_opname_ds || [];
      for (const detail of details) {
        const qtySelisih = Number(detail.qty_selisih || 0);
        const nilaiSelisih = Number(detail.nilai_selisih || 0);
        if (qtySelisih > 0) {
          acc.total_qty_selisih_plus += qtySelisih;
          acc.total_nilai_selisih_plus += nilaiSelisih;
          acc.total_data_plus += 1;
        } else if (qtySelisih < 0) {
          acc.total_qty_selisih_minus += Math.abs(qtySelisih);
          acc.total_nilai_selisih_minus += Math.abs(nilaiSelisih);
          acc.total_data_minus += 1;
        }
      }
      return acc;
    },
    {
      total_qty_selisih_plus: 0,
      total_qty_selisih_minus: 0,
      total_nilai_selisih_plus: 0,
      total_nilai_selisih_minus: 0,
      total_data_plus: 0,
      total_data_minus: 0,
    },
  );

  return {
    total_qty_selisih_plus: totals.value.total_qty_selisih_plus ?? fallback.total_qty_selisih_plus,
    total_qty_selisih_minus: totals.value.total_qty_selisih_minus ?? fallback.total_qty_selisih_minus,
    total_nilai_selisih_plus: totals.value.total_nilai_selisih_plus ?? fallback.total_nilai_selisih_plus,
    total_nilai_selisih_minus: totals.value.total_nilai_selisih_minus ?? fallback.total_nilai_selisih_minus,
    total_data_plus: totals.value.total_data_plus ?? fallback.total_data_plus,
    total_data_minus: totals.value.total_data_minus ?? fallback.total_data_minus,
  };
});

onMounted(async () => {
  try {
    const res = await getPeriodeSummary(String(route.params.id));
    summary.value = res.data;
  } catch {
    toast.error("Gagal memuat ringkasan periode");
    router.push("/inventory/transaksi/t_stock_opname_periode");
  } finally {
    loading.value = false;
  }
});

const doPrint = async () => {
  if (!periode.value?.id) return;
  printing.value = true;
  try {
    await printAndLockPeriode(periode.value.id);
    window.print();
    toast.success("Berita acara dicetak, periode di-lock");
    router.push("/inventory/transaksi/t_stock_opname_periode?reload=" + Date.now());
  } catch (error: any) {
    toast.error("Gagal cetak berita acara", {
      description: error?.message || "Error",
    });
  } finally {
    printing.value = false;
  }
};
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto bg-white text-black print-area">
    <div class="flex items-center justify-between mb-6 no-print">
      <Button variant="outline" @click="router.push('/inventory/transaksi/t_stock_opname_periode')">
        <ArrowLeft class="h-4 w-4 mr-1" /> Kembali
      </Button>
      <Button @click="doPrint" :disabled="loading || printing">
        <Printer class="h-4 w-4 mr-1" /> Cetak & Lock Periode
      </Button>
    </div>

    <div v-if="loading">Loading...</div>
    <div v-else>
      <h1 class="text-2xl font-bold text-center">BERITA ACARA STOCK OPNAME</h1>
      <p class="text-center text-sm mb-6">Periode Stock Opname</p>

      <div class="grid grid-cols-2 gap-2 text-sm mb-6">
        <div>No Periode: {{ periode?.no_periode_opname || "-" }}</div>
        <div>Company: {{ companyName }}</div>
        <div>Tanggal Mulai: {{ periode?.tgl_mulai || "-" }}</div>
        <div>Tanggal Akhir: {{ periode?.tgl_akhir || "-" }}</div>
        <div>Durasi Manual: {{ periode?.durasi_manual_hari || 0 }} Hari</div>
        <div>Status: {{ periode?.is_locked ? "LOCKED" : "OPEN" }}</div>
      </div>

      <table class="w-full border border-black border-collapse text-sm">
        <thead>
          <tr>
            <th class="border border-black p-2">No</th>
            <th class="border border-black p-2">No Stock Opname</th>
            <th class="border border-black p-2">Tanggal</th>
            <th class="border border-black p-2">Qty +</th>
            <th class="border border-black p-2">Qty -</th>
            <th class="border border-black p-2">Nilai +</th>
            <th class="border border-black p-2">Nilai -</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="opnames.length === 0">
            <td colspan="7" class="border border-black p-2 text-center">Tidak ada data opname APPROVED</td>
          </tr>
          <tr v-for="(row, idx) in opnames" :key="row.id || idx">
            <td class="border border-black p-2">{{ Number(idx) + 1 }}</td>
            <td class="border border-black p-2">{{ row.no_stock_opname || "-" }}</td>
            <td class="border border-black p-2">{{ row.tgl_opname || "-" }}</td>
            <td class="border border-black p-2 text-right">{{ row.total_qty_selisih_plus || 0 }}</td>
            <td class="border border-black p-2 text-right">{{ row.total_qty_selisih_minus || 0 }}</td>
            <td class="border border-black p-2 text-right">
              {{ Number(row.total_nilai_selisih_plus || 0).toLocaleString("id-ID") }}
            </td>
            <td class="border border-black p-2 text-right">
              {{ Number(row.total_nilai_selisih_minus || 0).toLocaleString("id-ID") }}
            </td>
          </tr>
        </tbody>
      </table>

      <div class="mt-4 grid grid-cols-2 gap-1 text-sm">
        <div>Jumlah Data +: <b>{{ splitSummary.total_data_plus || 0 }}</b></div>
        <div>Jumlah Data -: <b>{{ splitSummary.total_data_minus || 0 }}</b></div>
        <div>Total Qty Selisih +: <b>{{ splitSummary.total_qty_selisih_plus || 0 }}</b></div>
        <div>Total Qty Selisih -: <b>{{ splitSummary.total_qty_selisih_minus || 0 }}</b></div>
        <div>
          Total Nilai Selisih +:
          <b>Rp {{ Number(splitSummary.total_nilai_selisih_plus || 0).toLocaleString("id-ID") }}</b>
        </div>
        <div>
          Total Nilai Selisih -:
          <b>Rp {{ Number(splitSummary.total_nilai_selisih_minus || 0).toLocaleString("id-ID") }}</b>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-8 mt-16 text-center text-sm">
        <div>
          <p>Dibuat Oleh</p>
          <div class="h-16"></div>
          <p>(__________________)</p>
        </div>
        <div>
          <p>Diperiksa Oleh</p>
          <div class="h-16"></div>
          <p>(__________________)</p>
        </div>
        <div>
          <p>Disetujui Oleh</p>
          <div class="h-16"></div>
          <p>(__________________)</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media print {
  .no-print {
    display: none !important;
  }
}
</style>

<style>
@media print {
  body * {
    visibility: hidden !important;
  }

  .print-area,
  .print-area * {
    visibility: visible !important;
  }

  .print-area {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    margin: 0 !important;
    padding: 16px !important;
    background: #fff !important;
  }
}
</style>
