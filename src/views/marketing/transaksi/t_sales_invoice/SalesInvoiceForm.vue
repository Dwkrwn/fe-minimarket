<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowLeft,
  Calendar,
  Loader2,
  Search,
  Send,
  Save,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import AuditInfo from '@/components/AuditInfo.vue'
import { Input } from "@/components/ui/input";

type DetailRow = {
  id: string;
  code: string;
  namaItem: string;
  namaAlias: string;
  qtySo: number;
  qtySj: number;
  qtySjRetur: number;
  qtySi: number;
  uom: string;
  harga: string;
  subTotal: string;
  disc1: number;
  disc2: number;
  disc3: number;
  discAmt: number;
  totalDisc: number;
  totalPpn: string;
  total: string;
  catatan: string;
};

const route = useRoute();
const router = useRouter();

const isViewMode = computed(() => route.name === "SalesInvoiceView");
const isEditMode = computed(() => !!route.params.id && route.name === "SalesInvoiceForm");
const isCopyMode = computed(() => route.query.action === "copy" && !!route.query.source);
const isSaving = reactive({ value: false });

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

const form = reactive({
  unitBisnis: "Raden Saleh",
  tanggalSi: "16/01/2026",
  noSi: "SI-260116-0005",
  customer: "PT JAYA ABADI",
  noSuratJalan: "SJ-260116-0005",
  top: "7 Hari",
  caraBayar: "Transfer",
  tipePpn: "Exclude 11%",
  persenPpn: "11",
  nilaiPpn: "0",
  ekspedisi: "JnT",
  dueDate: "23/01/2026",
  totalBerat: "30",
  sales: "Diana",
  catatan: "Catatan",
});

const detailRows: DetailRow[] = [
  {
    id: "1",
    code: "ITEM-0001",
    namaItem: "SET L S304",
    namaAlias: "SET L S304",
    qtySo: 100,
    qtySj: 100,
    qtySjRetur: 0,
    qtySi: 100,
    uom: "PCS",
    harga: "35.000",
    subTotal: "3.500.000",
    disc1: 0,
    disc2: 0,
    disc3: 0,
    discAmt: 0,
    totalDisc: 0,
    totalPpn: "385.000",
    total: "3.885.000",
    catatan: "Catatan",
  },
  {
    id: "2",
    code: "ITEM-0002",
    namaItem: "NUT NYLON SS304",
    namaAlias: "NUT NYLON SS304",
    qtySo: 100,
    qtySj: 100,
    qtySjRetur: 0,
    qtySi: 100,
    uom: "PCS",
    harga: "10.000",
    subTotal: "1.000.000",
    disc1: 0,
    disc2: 0,
    disc3: 0,
    discAmt: 0,
    totalDisc: 0,
    totalPpn: "110.000",
    total: "1.110.000",
    catatan: "Catatan",
  },
];

const handleBack = () => {
  router.push("/marketing/transaksi/t_sales_invoice");
};

const handleSave = async () => {
  isSaving.value = true;
  setTimeout(() => {
    isSaving.value = false;
  }, 500);
};

const fieldClass =
  "h-10 border-slate-200 bg-slate-50 text-sm text-slate-700 shadow-sm disabled:opacity-100";

const labelClass = "mb-1 block text-xs font-semibold text-slate-700";
</script>

<template>
  <div class="min-h-screen bg-white p-6">
    <div class="max-w-[1280px] space-y-4">
      <div class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div class="flex items-start gap-3">
            <Button type="button" variant="ghost" size="icon" class="mt-1 h-8 w-8" @click="handleBack">
              <ArrowLeft class="h-4 w-4" />
            </Button>
            <div>
              <h1 class="text-xl font-bold text-slate-800">Detail Sales Invoice</h1>
              <p class="text-sm text-slate-500">Detail data Sales Invoice baru</p>
            </div>
          </div>
          <span class="rounded bg-blue-50 px-4 py-3 text-xs font-bold text-blue-600">POSTED</span>
        </div>

        <div class="grid grid-cols-1 gap-x-8 gap-y-3 lg:grid-cols-2">
          <div class="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
            <label>
              <span :class="labelClass">Unit Bisnis</span>
              <select v-model="form.unitBisnis" :disabled="isViewMode" :class="fieldClass" class="w-full rounded-md px-3">
                <option>Raden Saleh</option>
                <option>Raya Bibis</option>
                <option>Cimone</option>
              </select>
            </label>

            <label>
              <span :class="labelClass">Tanggal Sales Invoice</span>
              <div class="relative">
                <Input v-model="form.tanggalSi" :disabled="isViewMode" :class="fieldClass" />
                <Calendar class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </label>

            <label class="md:col-span-2">
              <span :class="labelClass">Customer <span class="text-red-500">*</span></span>
              <div class="flex">
                <Input v-model="form.customer" :disabled="isViewMode" :class="fieldClass" class="rounded-r-none" />
                <Button type="button" variant="outline" size="icon" class="h-10 rounded-l-none border-slate-200 bg-slate-50">
                  <Search class="h-4 w-4 text-slate-400" />
                </Button>
              </div>
            </label>

            <label>
              <span :class="labelClass">ToP</span>
              <select v-model="form.top" :disabled="isViewMode" :class="fieldClass" class="w-full rounded-md px-3">
                <option>7 Hari</option>
                <option>14 Hari</option>
                <option>30 Hari</option>
              </select>
            </label>

            <label>
              <span :class="labelClass">Cara Bayar</span>
              <select v-model="form.caraBayar" :disabled="isViewMode" :class="fieldClass" class="w-full rounded-md px-3">
                <option>Transfer</option>
                <option>Cash</option>
                <option>Giro</option>
              </select>
            </label>

            <label>
              <span :class="labelClass">Ekspedisi</span>
              <select v-model="form.ekspedisi" :disabled="isViewMode" :class="fieldClass" class="w-full rounded-md px-3">
                <option>JnT</option>
                <option>JNE</option>
                <option>Internal</option>
              </select>
            </label>

            <label>
              <span :class="labelClass">Due Date</span>
              <div class="relative">
                <Input v-model="form.dueDate" :disabled="isViewMode" :class="fieldClass" />
                <Calendar class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </label>

            <label class="md:col-span-2">
              <span :class="labelClass">Catatan</span>
              <textarea
                v-model="form.catatan"
                :disabled="isViewMode"
                class="min-h-[68px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                placeholder="Catatan"
              />
            </label>
          </div>

          <div class="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
            <label class="md:col-span-2">
              <span :class="labelClass">No. Sales Invoice</span>
              <Input v-model="form.noSi" disabled :class="fieldClass" />
            </label>

            <label class="md:col-span-2">
              <span :class="labelClass">No. Surat Jalan <span class="text-red-500">*</span></span>
              <div class="flex">
                <Input v-model="form.noSuratJalan" :disabled="isViewMode" :class="fieldClass" class="rounded-r-none" />
                <Button type="button" variant="outline" size="icon" class="h-10 rounded-l-none border-slate-200 bg-slate-50">
                  <Search class="h-4 w-4 text-slate-400" />
                </Button>
              </div>
            </label>

            <label>
              <span :class="labelClass">Tipe PPN</span>
              <select v-model="form.tipePpn" :disabled="isViewMode" :class="fieldClass" class="w-full rounded-md px-3">
                <option>Exclude 11%</option>
                <option>Include 11%</option>
                <option>Non PPN</option>
              </select>
            </label>

            <div>
              <span :class="labelClass">&nbsp;</span>
              <div class="grid grid-cols-[70px_36px_1fr] gap-2">
                <Input v-model="form.persenPpn" :disabled="isViewMode" :class="fieldClass" class="text-right" />
                <div class="flex h-10 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-500">%</div>
                <Input v-model="form.nilaiPpn" disabled :class="fieldClass" class="text-right" />
              </div>
            </div>

            <label>
              <span :class="labelClass">Total Berat (Kg)</span>
              <Input v-model="form.totalBerat" disabled :class="fieldClass" />
            </label>

            <label>
              <span :class="labelClass">Sales</span>
              <select v-model="form.sales" :disabled="isViewMode" :class="fieldClass" class="w-full rounded-md px-3">
                <option>Diana</option>
                <option>Andi</option>
                <option>Raka</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-lg font-bold text-slate-800">Detail Sales Invoice</h2>
        </div>
        <Button type="button" class="mb-3 h-10 bg-blue-600 px-4 hover:bg-blue-700">+ Load</Button>

        <div class="overflow-x-auto">
          <table class="min-w-[1720px] border-collapse text-sm">
            <thead>
              <tr class="bg-slate-50 text-slate-800">
                <th class="border border-slate-200 px-3 py-2 text-center">No</th>
                <th class="border border-slate-200 px-3 py-2 text-left">Kode</th>
                <th class="border border-slate-200 px-3 py-2 text-left">Nama Item</th>
                <th class="border border-slate-200 px-3 py-2 text-left">Nama Alias</th>
                <th class="border border-slate-200 px-3 py-2 text-right">Qty SO</th>
                <th class="border border-slate-200 px-3 py-2 text-right">Qty SJ</th>
                <th class="border border-slate-200 px-3 py-2 text-right">Qty SJ Retur</th>
                <th class="border border-slate-200 px-3 py-2 text-right">Qty SI</th>
                <th class="border border-slate-200 px-3 py-2 text-left">UoM</th>
                <th class="border border-slate-200 px-3 py-2 text-right">Harga</th>
                <th class="border border-slate-200 px-3 py-2 text-right">Sub Total</th>
                <th class="border border-slate-200 px-3 py-2 text-right">Disc. 1 (%)</th>
                <th class="border border-slate-200 px-3 py-2 text-right">Disc. 2 (%)</th>
                <th class="border border-slate-200 px-3 py-2 text-right">Disc. 3 (%)</th>
                <th class="border border-slate-200 px-3 py-2 text-right">Disc. Amt.</th>
                <th class="border border-slate-200 px-3 py-2 text-right">Total Disc.</th>
                <th class="border border-slate-200 px-3 py-2 text-right">Total PPN</th>
                <th class="border border-slate-200 px-3 py-2 text-right">Total</th>
                <th class="border border-slate-200 px-3 py-2 text-left">Catatan</th>
              </tr>
              <tr>
                <th class="border border-slate-200 px-2 py-1"></th>
                <th v-for="i in 18" :key="i" class="border border-slate-200 px-2 py-1">
                  <input class="h-7 w-full border border-slate-200 px-2 text-xs outline-none" />
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, index) in detailRows" :key="row.id">
                <td class="border border-slate-200 px-3 py-2 text-center">{{ index + 1 }}</td>
                <td class="border border-slate-200 px-3 py-2">{{ row.code }}</td>
                <td class="border border-slate-200 px-3 py-2">{{ row.namaItem }}</td>
                <td class="border border-slate-200 px-3 py-2">{{ row.namaAlias }}</td>
                <td class="border border-slate-200 px-3 py-2 text-right">{{ row.qtySo }}</td>
                <td class="border border-slate-200 px-3 py-2 text-right">{{ row.qtySj }}</td>
                <td class="border border-slate-200 px-3 py-2 text-right">{{ row.qtySjRetur }}</td>
                <td class="border border-slate-200 px-3 py-2 text-right">{{ row.qtySi }}</td>
                <td class="border border-slate-200 px-3 py-2">{{ row.uom }}</td>
                <td class="border border-slate-200 px-3 py-2 text-right">{{ row.harga }}</td>
                <td class="border border-slate-200 px-3 py-2 text-right">{{ row.subTotal }}</td>
                <td class="border border-slate-200 px-3 py-2 text-right">{{ row.disc1 }}</td>
                <td class="border border-slate-200 px-3 py-2 text-right">{{ row.disc2 }}</td>
                <td class="border border-slate-200 px-3 py-2 text-right">{{ row.disc3 }}</td>
                <td class="border border-slate-200 px-3 py-2 text-right">{{ row.discAmt }}</td>
                <td class="border border-slate-200 px-3 py-2 text-right">{{ row.totalDisc }}</td>
                <td class="border border-slate-200 px-3 py-2 text-right">{{ row.totalPpn }}</td>
                <td class="border border-slate-200 px-3 py-2 text-right">{{ row.total }}</td>
                <td class="border border-slate-200 px-3 py-2">{{ row.catatan }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <AuditInfo
        v-if="isViewMode || isEditMode"
        :created-by="auditMeta.created_by"
        :created-at="auditMeta.createdAt"
        :updated-by="auditMeta.updated_by"
        :updated-at="auditMeta.updatedAt"
      />

      <div class="flex items-center justify-end rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div class="flex items-center gap-2">
          <Button type="button" variant="outline" @click="handleBack">Batal</Button>
          <Button v-if="!isViewMode" type="button" class="gap-2 bg-green-600 hover:bg-green-700" @click="handleSave">
            <Loader2 v-if="isSaving.value" class="h-4 w-4 animate-spin" />
            <Save v-else class="h-4 w-4" />
            Simpan
          </Button>
          <Button v-if="!isViewMode" type="button" class="gap-2 bg-blue-600 hover:bg-blue-700">
            <Send class="h-4 w-4" />
            Send Approval
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
