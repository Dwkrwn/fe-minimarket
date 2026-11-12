<template>
  <div class="space-y-6 p-1 md:p-2">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 3 : Purchasing (1.1)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          {{ readOnly ? "Detail Supplier" : isEdit ? "Edit Supplier" : "Tambah Supplier" }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Lengkapi identitas pemasok, kontak sales, dan termin pembayaran.
        </p>
      </div>
      <Button variant="outline" size="sm" class="flex items-center gap-1.5" @click="router.push('/purchasing/master/suppliers')">
        <ArrowLeft class="w-4 h-4" />
        <span>Kembali</span>
      </Button>
    </div>

    <div v-if="loading" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card class="lg:col-span-2 border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-6 space-y-3">
          <Skeleton v-for="n in 6" :key="n" class="h-10 w-full" />
        </CardContent>
      </Card>
    </div>

    <form v-else @submit.prevent="handleSubmit" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card class="lg:col-span-2 border-slate-200 dark:border-slate-800 shadow-xs">
        <CardHeader class="pb-2">
          <CardTitle class="text-base">Identitas Supplier</CardTitle>
          <CardDescription>Kode supplier harus unik dan dipakai pada dokumen PO.</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Kode Supplier <span class="text-rose-500">*</span>
              </label>
              <Input v-model="form.kode_supplier" placeholder="Contoh: SUP-001" required :disabled="readOnly" class="font-mono" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Nama Supplier <span class="text-rose-500">*</span>
              </label>
              <Input v-model="form.nama_supplier" placeholder="Contoh: PT Sumber Rejeki Makmur" required :disabled="readOnly" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Kontak Sales</label>
              <Input v-model="form.kontak_sales" placeholder="Nama sales distributor" :disabled="readOnly" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Termin Pembayaran (TOP)</label>
              <div class="flex items-center gap-2">
                <Input v-model.number="form.term_of_payment" type="number" min="0" :disabled="readOnly" />
                <span class="text-xs text-slate-500 whitespace-nowrap">hari</span>
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">No. Telepon</label>
              <Input v-model="form.no_telp" placeholder="021-xxxxxxx" :disabled="readOnly" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">No. WhatsApp</label>
              <Input v-model="form.no_wa" placeholder="628xxxxxxxxxx" :disabled="readOnly" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Alamat</label>
            <textarea
              v-model="form.alamat"
              rows="2"
              :disabled="readOnly"
              placeholder="Alamat lengkap gudang/distributor"
              class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Catatan</label>
            <textarea
              v-model="form.catatan"
              rows="2"
              :disabled="readOnly"
              placeholder="Keterangan tambahan..."
              class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input v-model="form.is_active" type="checkbox" :disabled="readOnly" class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
            Supplier aktif dan dapat dipilih pada PO baru
          </label>

          <div v-if="!readOnly" class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button type="button" variant="outline" @click="router.push('/purchasing/master/suppliers')">Batal</Button>
            <Button type="submit" :disabled="isSubmitting" class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5">
              <RefreshCw v-if="isSubmitting" class="w-4 h-4 animate-spin" />
              <span>{{ isEdit ? "Simpan Perubahan" : "Simpan Supplier" }}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div class="space-y-4">
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base">Ringkasan</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3 text-sm">
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Total PO</span>
              <span class="font-semibold">{{ supplier?._count?.purchase_orders ?? 0 }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Total Retur</span>
              <span class="font-semibold">{{ supplier?._count?.purchase_returns ?? 0 }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500">Barang di Katalog</span>
              <span class="font-semibold">{{ supplier?.catalogs?.length ?? 0 }}</span>
            </div>
          </CardContent>
        </Card>

        <Card v-if="supplier?.catalogs?.length" class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base">Harga Katalog</CardTitle>
            <CardDescription>Harga beli per Pcs yang tercatat untuk supplier ini.</CardDescription>
          </CardHeader>
          <CardContent class="space-y-2 max-h-72 overflow-y-auto">
            <div v-for="catalog in supplier.catalogs" :key="catalog.id" class="flex items-center justify-between gap-3 text-sm border-b border-slate-100 dark:border-slate-800 pb-2 last:border-0">
              <span class="truncate">{{ catalog.item?.nama_barang || "-" }}</span>
              <span class="font-mono text-xs whitespace-nowrap">Rp {{ Number(catalog.harga_modal).toLocaleString("id-ID") }}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ArrowLeft, RefreshCw } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createSupplier, getSupplierDetail, updateSupplier, type Supplier } from "./supplierService";

const route = useRoute();
const router = useRouter();

const supplierId = computed(() => (route.params.id ? String(route.params.id) : ""));
const isEdit = computed(() => !!supplierId.value);
const readOnly = computed(() => route.meta.readOnly === true);

const loading = ref(false);
const isSubmitting = ref(false);
const supplier = ref<Supplier | null>(null);

const form = ref({
  kode_supplier: "",
  nama_supplier: "",
  kontak_sales: "",
  no_telp: "",
  no_wa: "",
  alamat: "",
  term_of_payment: 0,
  catatan: "",
  is_active: true,
});

async function load() {
  if (!supplierId.value) return;
  loading.value = true;
  try {
    const data = await getSupplierDetail(supplierId.value);
    supplier.value = data;
    form.value = {
      kode_supplier: data.kode_supplier,
      nama_supplier: data.nama_supplier,
      kontak_sales: data.kontak_sales || "",
      no_telp: data.no_telp || "",
      no_wa: data.no_wa || "",
      alamat: data.alamat || "",
      term_of_payment: Number(data.term_of_payment || 0),
      catatan: data.catatan || "",
      is_active: data.is_active,
    };
  } catch (error: any) {
    console.error("Gagal memuat supplier:", error);
    toast.error(error.message || "Gagal memuat supplier");
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  if (!form.value.kode_supplier.trim() || !form.value.nama_supplier.trim()) {
    toast.error("Kode dan nama supplier wajib diisi");
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = {
      kode_supplier: form.value.kode_supplier.trim(),
      nama_supplier: form.value.nama_supplier.trim(),
      kontak_sales: form.value.kontak_sales.trim() || null,
      no_telp: form.value.no_telp.trim() || null,
      no_wa: form.value.no_wa.trim() || null,
      alamat: form.value.alamat.trim() || null,
      term_of_payment: Number(form.value.term_of_payment) || 0,
      catatan: form.value.catatan.trim() || null,
      is_active: form.value.is_active,
    };

    if (isEdit.value) {
      await updateSupplier(supplierId.value, payload);
      toast.success("Supplier berhasil diperbarui");
    } else {
      await createSupplier(payload);
      toast.success("Supplier berhasil didaftarkan");
    }
    router.push("/purchasing/master/suppliers");
  } catch (error: any) {
    console.error("Gagal menyimpan supplier:", error);
    toast.error(error.message || "Gagal menyimpan supplier");
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(load);
</script>
