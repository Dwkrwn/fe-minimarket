<template>
  <div class="space-y-6 p-1 md:p-2">
    <!-- Header & Action Kembali -->
    <div
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
    >
      <div>
        <div class="flex items-center gap-2">
          <span
            class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
          >
            Modul 2 : Inventory (1.2)
          </span>
          <Badge
            v-if="rack && (isEdit || readOnly)"
            :class="
              rack.is_active
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'
            "
            variant="outline"
            class="text-xs"
          >
            {{ rack.is_active ? "Zona Aktif" : "Non-aktif" }}
          </Badge>
          <Badge
            v-if="rack && (isEdit || readOnly)"
            variant="outline"
            :class="
              rack.tipe_zona === 'RAK'
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
            "
            class="text-xs"
          >
            {{ rack.tipe_zona === "RAK" ? "RAK PAJANGAN" : "GUDANG BUFFER" }}
          </Badge>
        </div>
        <h1
          class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1"
        >
          {{
            readOnly
              ? "Detail Kategori & Rak"
              : isEdit
                ? "Edit Kategori & Rak"
                : "Tambah Kategori / Rak Baru"
          }}
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{
            readOnly
              ? "Informasi lengkap zona penyimpanan, penempatan rak display toko vs blok gudang."
              : isEdit
                ? "Perbarui identitas zona penyimpanan, lokasi penempatan, atau status aktif."
                : "Tentukan kode, nama, tipe zona penyimpanan baru, dan lokasi penempatan barang."
          }}
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          class="flex items-center gap-1.5"
          @click="router.push('/inventory/master/category-racks')"
        >
          <ArrowLeft class="w-4 h-4" />
          <span>Kembali</span>
        </Button>

        <Button
          v-if="readOnly && canManage"
          size="sm"
          class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
          @click="
            router.push(`/inventory/master/category-racks/form/${rackId}`)
          "
        >
          <Edit class="w-4 h-4" />
          <span>Edit Zona</span>
        </Button>
      </div>
    </div>

    <!-- Skeleton saat memuat data -->
    <div v-if="loading" class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card
        class="lg:col-span-2 border-slate-200 dark:border-slate-800 shadow-xs"
      >
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
    <form
      v-else
      @submit.prevent="handleSubmit"
      class="grid grid-cols-1 lg:grid-cols-3 gap-4"
    >
      <!-- Kolom Kiri: Form Data Zona -->
      <div class="lg:col-span-2 space-y-4">
        <!-- Card 1: Identitas Zona Penyimpanan -->
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base flex items-center gap-2">
              <Layers class="w-4 h-4 text-emerald-600" />
              <span>Identitas Zona Penyimpanan</span>
            </CardTitle>
            <CardDescription>
              Kode zona unik, nama kategori/rak, tipe peruntukan zona, dan
              lokasi lorong penempatan.
            </CardDescription>
          </CardHeader>

          <CardContent class="space-y-4">
            <!-- Kode & Nama Zona -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Kode Zona <span class="text-rose-500">*</span>
                </label>
                <div class="relative group">
                  <Input
                    v-model="form.kode"
                    :placeholder="dynamicPlaceholder"
                    :disabled="readOnly"
                    readonly
                    required
                    class="font-mono text-sm pr-10 bg-slate-50 dark:bg-slate-900/60 cursor-default select-all"
                  />
                  <!-- Tombol panah hanya muncul ketika di-hover pada input kode (baik saat edit maupun membuat data baru) -->
                  <!-- <div class="absolute right-1.5 top-1.5 flex items-center">
                    <button
                      v-if="form.kode"
                      type="button"
                      @click="copyCode(form.kode)"
                      class="h-7 w-7 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-opacity flex items-center justify-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      title="Salin kode zona"
                      aria-label="Salin kode zona"
                    >
                      <ArrowRight class="w-4 h-4" />
                    </button>
                  </div> -->

                  <!-- [CADANGAN / COMMENTED]: Tombol Acak & Salin jika nanti ingin diaktifkan kembali
                  <div class="absolute right-1 top-1.5 flex items-center gap-1">
                    <button
                      v-if="!isEdit && !readOnly"
                      type="button"
                      :disabled="isGeneratingCode"
                      @click="generateAutoCode(form.tipe_zona)"
                      class="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                      title="Generate ulang kode otomatis"
                    >
                      <RefreshCw
                        v-if="isGeneratingCode"
                        class="w-3 h-3 animate-spin"
                      />
                      <span>Acak</span>
                    </button>
                    <button
                      v-if="form.kode && (isEdit || readOnly)"
                      type="button"
                      @click="copyCode(form.kode)"
                      class="text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded flex items-center gap-1"
                      title="Salin kode zona"
                    >
                      <Copy class="w-3.5 h-3.5" />
                      <span>Salin</span>
                    </button>
                  </div>
                  -->
                </div>
                <!-- [CADANGAN / COMMENTED]: Opsi Input Manual jika nanti dibutuhkan
                <div v-if="!isEdit && !readOnly" class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
                  <span>Mode input kode manual aktif</span>
                  <button
                    type="button"
                    class="text-emerald-600 dark:text-emerald-400 hover:underline font-medium text-[11px]"
                  >
                    Input Manual?
                  </button>
                </div>
                -->
              </div>

              <div>
                <label
                  class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Nama Zona <span class="text-rose-500">*</span>
                </label>
                <Input
                  v-model="form.nama"
                  placeholder="Contoh: Rak Minuman / Gudang Kering"
                  :disabled="readOnly"
                  required
                />
              </div>
            </div>

            <!-- Tipe Zona & Lokasi/Blok -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Tipe Zona <span class="text-rose-500">*</span>
                </label>
                <select
                  v-model="form.tipe_zona"
                  :disabled="readOnly"
                  @change="handleTipeZonaChange"
                  class="w-full text-sm rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  <option value="RAK">RAK - Pajangan Toko</option>
                  <option value="GUDANG">GUDANG - Penyimpanan Belakang</option>
                </select>
              </div>

              <div>
                <label
                  class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                >
                  Lokasi / Blok
                </label>
                <Input
                  v-model="form.lokasi"
                  placeholder="Contoh: Lorong 1 / Blok B2"
                  :disabled="readOnly"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Card 2: Catatan Tambahan & Status Aktif -->
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base flex items-center gap-2">
              <FileText class="w-4 h-4 text-emerald-600" />
              <span>Catatan Tambahan &amp; Status</span>
            </CardTitle>
          </CardHeader>

          <CardContent class="space-y-4">
            <div>
              <label
                class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
              >
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

            <label
              class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer"
            >
              <input
                v-model="form.is_active"
                type="checkbox"
                :disabled="readOnly"
                class="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Zona aktif dan bisa dipakai penempatan barang</span>
            </label>

            <!-- Action Buttons Simpan / Batal -->
            <div
              v-if="!readOnly"
              class="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800"
            >
              <Button
                type="button"
                variant="outline"
                @click="router.push('/inventory/master/category-racks')"
              >
                Batal
              </Button>

              <Button
                type="submit"
                :disabled="isSubmitting"
                class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
              >
                <RefreshCw v-if="isSubmitting" class="w-4 h-4 animate-spin" />
                <span>{{ isEdit ? "Simpan Perubahan" : "Simpan Zona" }}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- Kolom Kanan: Panel Panduan & Audit Sistem -->
      <div class="space-y-4">
        <!-- Card Panduan Tipe Zona -->
        <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
          <CardHeader class="pb-2">
            <CardTitle class="text-base flex items-center gap-2">
              <Store class="w-4 h-4 text-emerald-600" />
              <span>Panduan Tipe Zona</span>
            </CardTitle>
            <CardDescription>
              Struktur pembagian penempatan barang di minimarket.
            </CardDescription>
          </CardHeader>

          <CardContent class="space-y-3 text-sm">
            <div
              class="p-3 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100/70 dark:border-emerald-900/40 space-y-1"
            >
              <div class="flex items-center gap-2">
                <Store class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span
                  class="font-semibold text-emerald-800 dark:text-emerald-300 text-xs uppercase tracking-wide"
                >
                  RAK - Pajangan Toko
                </span>
              </div>
              <p
                class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed"
              >
                Area display penjualan toko. Stok di rak ini siap di-scan
                langsung oleh kasir POS saat transaksi belanja konsumen.
              </p>
            </div>

            <div
              class="p-3 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-100/70 dark:border-amber-900/40 space-y-1"
            >
              <div class="flex items-center gap-2">
                <Warehouse class="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span
                  class="font-semibold text-amber-800 dark:text-amber-300 text-xs uppercase tracking-wide"
                >
                  GUDANG - Buffer Belakang
                </span>
              </div>
              <p
                class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed"
              >
                Area cadangan stok kardusan di ruang belakang. Digunakan untuk
                mutasi pengisian stok berkala ke rak pajangan toko.
              </p>
            </div>
          </CardContent>
        </Card>

        <!-- Card Informasi Sistem & Audit (saat edit / view) -->
        <Card
          v-if="rack && (isEdit || readOnly)"
          class="border-slate-200 dark:border-slate-800 shadow-xs"
        >
          <CardHeader class="pb-2">
            <CardTitle class="text-xs uppercase tracking-wider text-slate-400"
              >Informasi Sistem</CardTitle
            >
          </CardHeader>
          <CardContent class="space-y-2 text-xs text-slate-500">
            <div
              class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800"
            >
              <span>Kode Zona:</span>
              <span
                class="font-mono font-medium text-slate-700 dark:text-slate-300"
                >{{ rack.kode }}</span
              >
            </div>
            <div
              class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800"
            >
              <span>Tipe Peruntukan:</span>
              <Badge
                variant="outline"
                :class="
                  rack.tipe_zona === 'RAK'
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                "
                class="text-[10px]"
              >
                {{ rack.tipe_zona === "RAK" ? "RAK PAJANGAN" : "GUDANG" }}
              </Badge>
            </div>
            <div
              v-if="rack.createdAt"
              class="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800"
            >
              <span>Didaftarkan:</span>
              <span class="font-medium text-slate-700 dark:text-slate-300">{{
                formatDate(rack.createdAt)
              }}</span>
            </div>
            <div
              v-if="rack.updatedAt"
              class="flex justify-between items-center py-1"
            >
              <span>Terakhir diubah:</span>
              <span class="font-medium text-slate-700 dark:text-slate-300">{{
                formatDate(rack.updatedAt)
              }}</span>
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
  ArrowRight,
  RefreshCw,
  Layers,
  FileText,
  Store,
  Warehouse,
  Edit,
  Copy,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth";

import {
  getCategoryRackById,
  getNextCategoryRackCode,
  createCategoryRack,
  updateCategoryRack,
  type CategoryRack,
  type ZoneType,
} from "./categoryRackService";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const canManage = computed(() => authStore.isManager);
const rackId = computed(() => (route.params.id ? String(route.params.id) : ""));
const isEdit = computed(() => !!rackId.value && !route.meta.readOnly);
const readOnly = computed(() => Boolean(route.meta.readOnly));

// State
const loading = ref(false);
const isSubmitting = ref(false);
const isGeneratingCode = ref(false);
const isCustomCode = ref(false);
const rack = ref<CategoryRack | null>(null);

// Form model
const form = ref({
  kode: "",
  nama: "",
  tipe_zona: "RAK" as ZoneType,
  lokasi: "",
  catatan: "",
  is_active: true,
});

// Dynamic placeholder menyesuaikan tipe zona
const dynamicPlaceholder = computed(() => {
  return form.value.tipe_zona === "GUDANG"
    ? "Contoh: GDG-001"
    : "Contoh: RAK-001";
});

// function copyCode(code: string) {
//   navigator.clipboard.writeText(code);
//   toast.success(`Kode ${code} disalin ke clipboard!`);
// }

// Generate kode otomatis dari backend/sistem
async function generateAutoCode(tipe: ZoneType) {
  if (isEdit.value || readOnly.value) return;
  isGeneratingCode.value = true;
  try {
    const code = await getNextCategoryRackCode(tipe);
    form.value.kode = code;
  } catch (err: any) {
    console.error("Gagal generate kode otomatis:", err);
  } finally {
    isGeneratingCode.value = false;
  }
}

// Handler saat dropdown tipe zona diganti
async function handleTipeZonaChange() {
  if (!isEdit.value && !readOnly.value && !isCustomCode.value) {
    await generateAutoCode(form.value.tipe_zona);
  }
}

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

// Load detail zona jika mode edit / view, atau generate auto code jika mode tambah baru
async function load() {
  if (!rackId.value) {
    // Mode tambah baru: auto-generate kode pertama kali
    await generateAutoCode(form.value.tipe_zona);
    return;
  }
  loading.value = true;
  try {
    const data = await getCategoryRackById(rackId.value);
    rack.value = data;
    form.value = {
      kode: data.kode,
      nama: data.nama,
      tipe_zona: data.tipe_zona,
      lokasi: data.lokasi || "",
      catatan: data.catatan || "",
      is_active: data.is_active,
    };
  } catch (error: any) {
    console.error("Gagal memuat kategori / rak:", error);
    toast.error(error.message || "Gagal memuat data kategori / rak");
  } finally {
    loading.value = false;
  }
}

// Submit form
async function handleSubmit() {
  if (readOnly.value) return;

  if (!form.value.kode.trim() || !form.value.nama.trim()) {
    toast.error("Kode dan nama zona wajib diisi");
    return;
  }

  isSubmitting.value = true;
  try {
    const payload = {
      kode: form.value.kode.trim(),
      nama: form.value.nama.trim(),
      tipe_zona: form.value.tipe_zona,
      lokasi: form.value.lokasi.trim() || null,
      catatan: form.value.catatan.trim() || null,
      is_active: form.value.is_active,
    };

    if (isEdit.value) {
      await updateCategoryRack(rackId.value, payload);
      toast.success("Kategori / rak berhasil diperbarui");
    } else {
      await createCategoryRack(payload);
      toast.success("Kategori / rak baru berhasil dibuat");
    }

    router.push("/inventory/master/category-racks");
  } catch (error: any) {
    console.error("Gagal menyimpan kategori / rak:", error);
    toast.error(error.message || "Gagal menyimpan kategori / rak");
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(load);
</script>
