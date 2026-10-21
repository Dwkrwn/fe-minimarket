<script setup lang="ts">
import { computed, reactive, ref, onBeforeMount } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, Loader2, Save, Send, Trash2 } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldX, FieldSelect, FieldNumber, FieldDate, FieldTextarea } from "@/components/field";
import AuditInfo from '@/components/AuditInfo.vue';
import { getSalesReturnById } from './service';

type DetailRow = {
  id: string;
  noRef: string;
  kode: string;
  namaItem: string;
  namaAlias: string;
  alasan: string;
  qtySj: number;
  qtySi: number;
  qtyRetur: number;
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

const isViewMode = computed(() => route.name === "SalesReturnView");
const isEditMode = computed(() => !!route.params.id && route.name === "SalesReturnForm");
const isCopyMode = computed(() => route.query.action === "copy" && !!route.query.source);
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true);
const loading = ref(false);

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Sales Retur";
  if (isEditMode.value) return "Edit Sales Retur";
  return "Tambah Sales Retur Baru";
});
const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data Sales Retur";
  if (isEditMode.value) return "Perbarui data Sales Retur";
  return "Buat Sales Retur baru";
});

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

const form = reactive({
  unitBisnis: "Raden Saleh",
  tanggalSr: "2026-01-16",
  noSr: "SR-260116-0005",
  customer: "PT JAYA ABADI",
  noSalesInvoice: "SI-260116-0005",
  noSuratJalan: "SJ-260116-0005",
  totalSi: "10.000.000",
  tipePpn: "Exclude 11%",
  persenPpn: "11",
  nilaiPpn: "0",
  catatan: "Catatan",
});

const detailRows = reactive<DetailRow[]>([
  {
    id: "1",
    noRef: "SO-2601-0001",
    kode: "ITEM-0001",
    namaItem: "SET L S304",
    namaAlias: "SET L S304",
    alasan: "Alasan",
    qtySj: 100,
    qtySi: 100,
    qtyRetur: 0,
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
    noRef: "SO-2601-0002",
    kode: "ITEM-0002",
    namaItem: "NUT NYLON SS304",
    namaAlias: "NUT NYLON SS304",
    alasan: "Alasan",
    qtySj: 100,
    qtySi: 100,
    qtyRetur: 0,
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
]);

const handleCancel = () => {
  router.push("/marketing/transaksi/t_sales_return");
};

// ============================================================================
// LIFECYCLE - LOAD DATA
// ============================================================================
onBeforeMount(async () => {
  const isCopyModeLocal = route.query.action === 'copy' && route.query.source;
  const sourceId = isCopyModeLocal ? String(route.query.source) : (route.params.id as string);

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) return;

  loading.value = true;
  try {
    const res = await getSalesReturnById(sourceId);
    if (res.status !== 'success') throw new Error('Gagal memuat data');

    auditMeta.value = {
      created_by: res.data.createdAt ? (res.data as any).created_by : null,
      createdAt: res.data.createdAt,
      updated_by: (res.data as any).update_by || (res.data as any).updated_by,
      updatedAt: res.data.updatedAt,
    };

    toast.success('Data berhasil dimuat');
  } catch (error) {
    toast.error('Gagal memuat data Sales Return', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
    });
  } finally {
    loading.value = false;
  }
});

const onSave = () => {
  loading.value = true;
  setTimeout(() => {
    loading.value = false;
  }, 500);
};

const removeRow = (id: string) => {
  const index = detailRows.findIndex((row) => row.id === id);
  if (index >= 0) detailRows.splice(index, 1);
};
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
    <!-- HEADER SECTION -->
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="icon" @click="handleCancel">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div>
        <h1 class="text-2xl font-bold text-foreground">{{ pageTitle }}</h1>
        <p class="text-sm text-muted-foreground">{{ pageDescription }}</p>
      </div>
    </div>

    <!-- FORM SECTION -->
    <form class="space-y-6" @submit.prevent>
      <Card>
        <CardHeader>
          <CardTitle>Informasi Sales Retur</CardTitle>
          <CardDescription>Isi data Sales Retur dengan lengkap dan benar</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FieldX
              id="unitBisnis"
              label="Unit Bisnis"
              :value="form.unitBisnis"
              @input="(v) => (form.unitBisnis = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Unit Bisnis"
              class="w-full"
            />

            <FieldX
              id="tanggalSr"
              label="Tanggal Sales Retur"
              :value="form.tanggalSr"
              @input="(v) => (form.tanggalSr = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Tanggal"
              class="w-full"
            />

            <FieldX
              id="noSr"
              label="No. Sales Retur"
              :value="form.noSr"
              :disabled="true"
              :readonly="true"
              placeholder="Auto-generated"
              class="w-full"
            />

            <FieldX
              id="customer"
              label="Customer"
              :value="form.customer"
              @input="(v) => (form.customer = v)"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih customer"
              class="w-full"
            />

            <FieldX
              id="noSalesInvoice"
              label="No. Sales Invoice"
              :value="form.noSalesInvoice"
              @input="(v) => (form.noSalesInvoice = v)"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih Sales Invoice"
              class="w-full"
            />

            <FieldX
              id="noSuratJalan"
              label="No. Surat Jalan"
              :value="form.noSuratJalan"
              @input="(v) => (form.noSuratJalan = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="No. Surat Jalan"
              class="w-full"
            />

            <FieldX
              id="totalSi"
              label="Total SI"
              :value="form.totalSi"
              :disabled="true"
              :readonly="true"
              placeholder="0"
              class="w-full"
            />

            <FieldX
              id="tipePpn"
              label="Tipe PPN"
              :value="form.tipePpn"
              @input="(v) => (form.tipePpn = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Tipe PPN"
              class="w-full"
            />

            <div class="md:col-span-2">
              <FieldTextarea
                id="catatan"
                label="Catatan"
                :value="form.catatan"
                @input="(v) => (form.catatan = v)"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="Catatan"
                class="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- DETAIL TABLE -->
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <div>
              <CardTitle>Detail Sales Retur</CardTitle>
              <CardDescription>Data item yang diretur</CardDescription>
            </div>
            <Button v-if="!isReadOnly" type="button" variant="outline" size="sm" :disabled="loading">
              + Load
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div v-if="detailRows.length > 0" class="border rounded-lg overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-muted/50">
                  <tr>
                    <th class="px-3 py-3 text-center font-medium w-[50px]">No</th>
                    <th class="px-3 py-3 text-left font-medium">No. Ref</th>
                    <th class="px-3 py-3 text-left font-medium">Kode</th>
                    <th class="px-3 py-3 text-left font-medium">Nama Item</th>
                    <th class="px-3 py-3 text-left font-medium">Alasan</th>
                    <th class="px-3 py-3 text-right font-medium">Qty SJ</th>
                    <th class="px-3 py-3 text-right font-medium">Qty SI</th>
                    <th class="px-3 py-3 text-right font-medium">Qty Retur</th>
                    <th class="px-3 py-3 text-left font-medium">UoM</th>
                    <th class="px-3 py-3 text-right font-medium">Harga</th>
                    <th class="px-3 py-3 text-right font-medium">Sub Total</th>
                    <th class="px-3 py-3 text-right font-medium">Total PPN</th>
                    <th class="px-3 py-3 text-right font-medium">Total</th>
                    <th class="px-3 py-3 text-left font-medium">Catatan</th>
                    <th class="px-3 py-3 text-center font-medium w-[60px]">Aksi</th>
                  </tr>
                </thead>
                <tbody class="divide-y">
                  <tr v-for="(row, index) in detailRows" :key="row.id" class="hover:bg-muted/30">
                    <td class="px-3 py-2 text-center">{{ index + 1 }}</td>
                    <td class="px-3 py-2">{{ row.noRef }}</td>
                    <td class="px-3 py-2">{{ row.kode }}</td>
                    <td class="px-3 py-2">{{ row.namaItem }}</td>
                    <td class="px-3 py-2">{{ row.alasan }}</td>
                    <td class="px-3 py-2 text-right">{{ row.qtySj }}</td>
                    <td class="px-3 py-2 text-right">{{ row.qtySi }}</td>
                    <td class="px-3 py-2 text-right">{{ row.qtyRetur }}</td>
                    <td class="px-3 py-2">{{ row.uom }}</td>
                    <td class="px-3 py-2 text-right">{{ row.harga }}</td>
                    <td class="px-3 py-2 text-right">{{ row.subTotal }}</td>
                    <td class="px-3 py-2 text-right">{{ row.totalPpn }}</td>
                    <td class="px-3 py-2 text-right">{{ row.total }}</td>
                    <td class="px-3 py-2">{{ row.catatan }}</td>
                    <td class="px-3 py-2 text-center">
                      <Button
                        v-if="!isReadOnly"
                        type="button"
                        variant="ghost"
                        size="icon"
                        @click="removeRow(row.id)"
                        :disabled="loading"
                      >
                        <Trash2 class="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div v-else class="text-center py-8 text-muted-foreground">
            Belum ada data detail. Klik tombol "Load" untuk memuat item.
          </div>
        </CardContent>
      </Card>

      <AuditInfo
        v-if="(isViewMode || isEditMode) && !isCopyMode"
        :created-by="auditMeta.created_by"
        :created-at="auditMeta.createdAt"
        :updated-by="auditMeta.updated_by"
        :updated-at="auditMeta.updatedAt"
      />

      <!-- ACTION BUTTONS -->
      <div
        class="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-end sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t sm:border-0 -mx-6 px-6 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:static"
      >
        <Button type="button" variant="outline" @click="handleCancel" :disabled="loading" class="w-full sm:w-auto">
          {{ isReadOnly ? 'Kembali' : 'Batal' }}
        </Button>
        <Button v-if="!isReadOnly" type="button" @click="onSave" :disabled="loading" class="gap-2 w-full sm:w-auto">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          {{ isEditMode ? 'Perbarui' : 'Simpan' }}
        </Button>
      </div>
    </form>
  </div>
</template>
