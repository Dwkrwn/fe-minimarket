<template>
  <div class="space-y-6 p-1 md:p-2">
    <!-- Header & Action Kembali -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
            Modul 2 : Inventory (1.3)
          </span>
          <Badge
            v-if="uom && (isEdit || readOnly)"
            :class="uom.is_active ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30' : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'"
            variant="outline"
            class="text-xs"
          >
            {{ uom.is_active ? 'Satuan Aktif' : 'Non-aktif' }}
          </Badge>
          <Badge
            v-if="uom && (isEdit || readOnly)"
            variant="outline"
            class="text-xs bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30 font-mono"
          >
            1 {{ uom.satuan_beli }} = {{ uom.rasio_konversi }} {{ uom.satuan_dasar }}
          </Badge>
        </div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">
          {{ readOnly ? "Detail Satuan & Konversi" : isEdit ? "Edit Satuan & Konversi" : "Tambah Satuan & Konversi Baru" }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ readOnly
            ? "Informasi detail konversi satuan beli berjenjang ke satuan dasar kasir (Pcs)."
            : isEdit
              ? "Perbarui rasio konversi satuan beli, nama satuan, atau status aktif."
              : "Definisikan satuan beli dan rasio konversinya ke Pcs untuk pengadaan barang."
          }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          class="flex items-center gap-1.5"
          @click="router.push('/inventory/master/uoms')"
        >
          <ArrowLeft class="w-4 h-4" />
          <span>Kembali</span>
        </Button>

        <Button
          v-if="readOnly && canManage"
          size="sm"
          class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
          @click="router.push(`/inventory/master/uoms/form/${uomId}`)"
        >
          <Edit class="w-4 h-4" />
          <span>Edit Satuan</span>
        </Button>
      </div>
    </div>

    <!-- Skeleton saat memuat data -->
    <div v-if="loading" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card class="lg:col-span-2 border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-6 space-y-4">
          <Skeleton v-for="n in 5" :key="n" class="h-10 w-full" />
        </CardContent>
      </Card>
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-6 space-y-4">
          <Skeleton v-for="n in 3" :key="n" class="h-16 w-full" />
        </CardContent>
      </Card>
    </div>

    <!-- Form Utama & Ringkasan Samping -->
    <form v-else @submit.prevent="handleSubmit" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Kolom Kiri: Form Data Satuan -->
      <div class="lg:col-span-2 space-y-4">
        <!-- Card 1: Identitas Satuan (UOM) -->
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base flex items-center gap-2">
              <Ruler class="w-4 h-4 text-emerald-600" />
              <span>Identitas Satuan (UOM)</span>
            </CardTitle>
            <CardDescription>
              Kode satuan unik dan nama deskripsi kemasan yang dipakai pada katalog barang dan transaksi PO.
            </CardDescription>
          </CardHeader>

          <CardContent class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kode UOM <span class="text-rose-500">*</span>
                </label>
                <Input
                  v-model="form.kode_uom"
                  placeholder="Contoh: KARDUS-24"
                  :disabled="readOnly"
                  required
                  class="font-mono text-sm"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Satuan <span class="text-rose-500">*</span>
                </label>
                <Input
                  v-model="form.nama_uom"
                  placeholder="Contoh: Kardus 24 Pcs"
                  :disabled="readOnly"
                  required
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Card 2: Formula & Rasio Konversi -->
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base flex items-center gap-2">
              <Calculator class="w-4 h-4 text-emerald-600" />
              <span>Formula &amp; Rasio Konversi</span>
            </CardTitle>
            <CardDescription>
              Tentukan satuan pembelian dari distributor dan berapa Pcs isi satuan tersebut saat diurai ke kasir.
            </CardDescription>
          </CardHeader>

          <CardContent class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Satuan Dasar <span class="text-rose-500">*</span>
                </label>
                <Input
                  v-model="form.satuan_dasar"
                  placeholder="Pcs"
                  :disabled="readOnly"
                  required
                  class="bg-slate-50 dark:bg-slate-900"
                />
                <span class="text-[11px] text-slate-400 mt-0.5 block">Satuan eceran kasir</span>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Satuan Beli <span class="text-rose-500">*</span>
                </label>
                <Input
                  v-model="form.satuan_beli"
                  placeholder="Kardus / Dus / Pack"
                  :disabled="readOnly"
                  required
                />
                <span class="text-[11px] text-slate-400 mt-0.5 block">Satuan kulakan PO</span>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Rasio (Pcs) <span class="text-rose-500">*</span>
                </label>
                <Input
                  v-model.number="form.rasio_konversi"
                  type="number"
                  min="1"
                  step="1"
                  :disabled="readOnly"
                  required
                  class="font-mono text-sm"
                />
                <span class="text-[11px] text-slate-400 mt-0.5 block">Isi dalam 1 satuan beli</span>
              </div>
            </div>

            <!-- Preview Box Dinamis -->
            <div class="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <Boxes class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>
                  Preview Konversi:
                  <strong class="font-semibold">
                    1 {{ form.satuan_beli || "satuan beli" }} = {{ Number(form.rasio_konversi) || 0 }} {{ form.satuan_dasar || "Pcs" }}
                  </strong>
                </span>
              </div>
              <Badge variant="outline" class="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-mono">
                Rasio: 1 : {{ Number(form.rasio_konversi) || 0 }}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <!-- Card 3: Catatan Tambahan & Status Aktif -->
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base flex items-center gap-2">
              <FileText class="w-4 h-4 text-emerald-600" />
              <span>Catatan Tambahan &amp; Status</span>
            </CardTitle>
          </CardHeader>

          <CardContent class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Catatan
              </label>
              <textarea
                v-model="form.catatan"
                rows="2"
                :disabled="readOnly"
                placeholder="Keterangan opsional..."
                class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-75 disabled:cursor-not-allowed"
              />
            </div>

            <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                v-model="form.is_active"
                type="checkbox"
                :disabled="readOnly"
                class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Satuan aktif dan bisa dipakai barang baru</span>
            </label>

            <!-- Action Buttons Simpan / Batal -->
            <div v-if="!readOnly" class="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                @click="router.push('/inventory/master/uoms')"
              >
                Batal
              </Button>

              <Button
                type="submit"
                :disabled="isSubmitting"
                class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
              >
                <RefreshCw v-if="isSubmitting" class="w-4 h-4 animate-spin" />
                <span>{{ isEdit ? "Simpan Perubahan" : "Simpan Satuan" }}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Kolom Kanan: Panel Panduan Multi-UOM & Audit Sistem -->
      <div class="space-y-4">
        <!-- Card Panduan Multi-UOM -->
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base flex items-center gap-2">
              <Boxes class="w-4 h-4 text-emerald-600" />
              <span>Panduan Multi-Satuan</span>
            </CardTitle>
            <CardDescription>
              Struktur konversi otomatis inventaris minimarket.
            </CardDescription>
          </CardHeader>

          <CardContent class="space-y-3 text-sm">
            <div class="p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 border-blue-100/70 dark:border-blue-900/40 space-y-1">
              <div class="flex items-center gap-2">
                <Ruler class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span class="font-semibold text-blue-800 dark:text-blue-300 text-xs uppercase tracking-wide">
                  Satuan Beli (PO &amp; Faktur)
                </span>
              </div>
              <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Satuan kemasan distributor (Kardus, Dus, Pack, Bal). Dipakai saat bagian purchasing memesan PO ke supplier.
              </p>
            </div>

            <div class="p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100/70 dark:border-emerald-900/40 space-y-1">
              <div class="flex items-center gap-2">
                <Calculator class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span class="font-semibold text-emerald-800 dark:text-emerald-300 text-xs uppercase tracking-wide">
                  Satuan Dasar (POS &amp; Stok)
                </span>
              </div>
              <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Satuan terkecil yang dijual eceran di kasir POS (Pcs). Saldo stok fisik selalu dihitung dalam satuan Pcs ini.
              </p>
            </div>
          </CardContent>
        </Card>

        <!-- Card Informasi Sistem & Audit (saat edit / view) -->
        <Card v-if="uom && (isEdit || readOnly)" class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-xs uppercase tracking-wider text-slate-400">Informasi Sistem</CardTitle>
          </CardHeader>
          <CardContent class="space-y-2 text-xs text-slate-500">
            <div class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
              <span>Kode UOM:</span>
              <span class="font-mono font-medium text-slate-700 dark:text-slate-300">{{ uom.kode_uom }}</span>
            </div>
            <div class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
              <span>Rasio Konversi:</span>
              <Badge variant="outline" class="font-mono text-[10px] bg-slate-100 dark:bg-slate-800">
                1 {{ uom.satuan_beli }} = {{ uom.rasio_konversi }} {{ uom.satuan_dasar }}
              </Badge>
            </div>
            <div v-if="uom.createdAt" class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
              <span>Didaftarkan:</span>
              <span class="font-medium text-slate-700 dark:text-slate-300">{{ formatDate(uom.createdAt) }}</span>
            </div>
            <div v-if="uom.updatedAt" class="flex justify-between items-center py-1">
              <span>Terakhir diubah:</span>
              <span class="font-medium text-slate-700 dark:text-slate-300">{{ formatDate(uom.updatedAt) }}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ArrowLeft,
  RefreshCw,
  Ruler,
  Calculator,
  Boxes,
  FileText,
  Edit,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth";

import {
  getUomById,
  createUom,
  updateUom,
  type Uom,
} from "./uomService";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const canManage = computed(() => authStore.isManager);
const uomId = computed(() => (route.params.id ? String(route.params.id) : ""));
const isEdit = computed(() => !!uomId.value && !route.meta.readOnly);
const readOnly = computed(() => Boolean(route.meta.readOnly));

// State
const loading = ref(false);
const isSubmitting = ref(false);
const uom = ref<Uom | null>(null);

// Form model
const form = ref({
  kode_uom: "",
  nama_uom: "",
  satuan_dasar: "Pcs",
  satuan_beli: "",
  rasio_konversi: 1,
  catatan: "",
  is_active: true,
});

function formatDate(dateStr?: string): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return dateStr;
  }
}

// Load detail satuan jika mode edit / view
async function load() {
  if (!uomId.value) return;
  loading.value = true;
  try {
    const data = await getUomById(uomId.value);
    uom.value = data;
    form.value = {
      kode_uom: data.kode_uom,
      nama_uom: data.nama_uom,
      satuan_dasar: data.satuan_dasar,
      satuan_beli: data.satuan_beli,
      rasio_konversi: Number(data.rasio_konversi) || 1,
      catatan: data.catatan || "",
      is_active: data.is_active,
    };
  } catch (error: any) {
    console.error("Gagal memuat data satuan:", error);
    toast.error(error.message || "Gagal memuat data satuan");
  } finally {
    loading.value = false;
  }
}

// Submit form
async function handleSubmit() {
  if (readOnly.value) return;

  if (!form.value.kode_uom.trim() || !form.value.nama_uom.trim() || !form.value.satuan_beli.trim()) {
    toast.error("Kode, nama satuan, dan satuan beli wajib diisi");
    return;
  }
  if (!form.value.rasio_konversi || form.value.rasio_konversi < 1) {
    toast.error("Rasio konversi minimal 1 Pcs");
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = {
      kode_uom: form.value.kode_uom.trim(),
      nama_uom: form.value.nama_uom.trim(),
      satuan_dasar: form.value.satuan_dasar.trim() || "Pcs",
      satuan_beli: form.value.satuan_beli.trim(),
      rasio_konversi: Number(form.value.rasio_konversi),
      catatan: form.value.catatan.trim() || null,
      is_active: form.value.is_active,
    };

    if (isEdit.value) {
      await updateUom(uomId.value, payload);
      toast.success("Satuan konversi berhasil diperbarui");
    } else {
      await createUom(payload);
      toast.success("Satuan konversi baru berhasil dibuat");
    }

    router.push("/inventory/master/uoms");
  } catch (error: any) {
    console.error("Gagal menyimpan satuan:", error);
    toast.error(error.message || "Gagal menyimpan satuan");
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(load);
</script>
