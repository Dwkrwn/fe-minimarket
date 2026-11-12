<template>
  <div class="space-y-6 p-1 md:p-2">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <span class="px-2.5 py-0.5 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300">
          Modul 3 : Purchasing (1.1)
        </span>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1">Supplier</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Data pemasok/distributor beserta kontak sales dan termin pembayaran (TOP).
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" :disabled="loading" @click="load" class="flex items-center gap-1.5">
          <RefreshCw :class="['w-4 h-4', loading ? 'animate-spin' : '']" />
          <span>Refresh</span>
        </Button>
        <Button
          v-if="canManage"
          size="sm"
          class="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
          @click="router.push('/purchasing/master/suppliers/form')"
        >
          <Plus class="w-4 h-4" />
          <span>Tambah Supplier</span>
        </Button>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Total Supplier</p>
            <h3 class="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{{ suppliers.length }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Terdaftar di sistem</p>
          </div>
          <div class="p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Truck class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Supplier Aktif</p>
            <h3 class="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{{ activeCount }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Siap menerima PO</p>
          </div>
          <div class="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
            <CheckCircle2 class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Rata-rata TOP</p>
            <h3 class="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{{ averageTop }} <span class="text-sm font-normal">hari</span></h3>
            <p class="text-xs text-slate-500 mt-0.5">Term of payment</p>
          </div>
          <div class="p-3 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
            <CalendarClock class="w-6 h-6" />
          </div>
        </CardContent>
      </Card>

      <Card class="border-slate-200 dark:border-slate-800 shadow-xs">
        <CardContent class="p-4 flex items-center justify-between">
          <div>
            <p class="text-xs font-medium text-slate-500 dark:text-slate-400">Non-aktif</p>
            <h3 class="text-2xl font-bold text-slate-500 mt-1">{{ suppliers.length - activeCount }}</h3>
            <p class="text-xs text-slate-500 mt-0.5">Tidak dipakai untuk PO baru</p>
          </div>
          <div class="p-3 bg-slate-100 dark:bg-slate-800/70 text-slate-500 dark:text-slate-300 rounded-xl">
            <Archive class="w-6 h-6" />
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
              placeholder="Cari kode, nama, kontak sales, atau nomor WA..."
              class="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800"
              @keydown.enter="load"
            />
          </div>
          <Button variant="outline" size="sm" :disabled="loading" @click="load">Cari</Button>
          <Button variant="ghost" size="sm" class="text-xs text-slate-500" @click="resetFilter">Reset</Button>
        </div>
      </CardContent>
    </Card>

    <Card class="border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
          <thead class="bg-slate-50 dark:bg-slate-900/80 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th class="px-4 py-3.5">Kode &amp; Nama Supplier</th>
              <th class="px-4 py-3.5">Kontak Sales</th>
              <th class="px-4 py-3.5">Telepon / WA</th>
              <th class="px-4 py-3.5">TOP</th>
              <th class="px-4 py-3.5">Alamat</th>
              <th class="px-4 py-3.5 text-center">Status</th>
              <th class="px-4 py-3.5 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <template v-if="loading">
              <tr v-for="n in 4" :key="'skel-' + n">
                <td colspan="7" class="px-4 py-4"><Skeleton class="h-6 w-full" /></td>
              </tr>
            </template>

            <tr v-else-if="suppliers.length === 0">
              <td colspan="7" class="px-4 py-12 text-center text-slate-500">
                <Truck class="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p class="font-medium text-slate-700 dark:text-slate-300">Belum ada supplier</p>
                <p class="text-xs text-slate-400 mt-1">
                  {{ canManage ? 'Klik "+ Tambah Supplier" untuk mendaftarkan pemasok pertama.' : 'Hubungi admin untuk menambahkan supplier.' }}
                </p>
              </td>
            </tr>

            <tr v-else v-for="supplier in suppliers" :key="supplier.id" class="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors">
              <td class="px-4 py-3.5">
                <div class="font-medium text-slate-900 dark:text-white">{{ supplier.nama_supplier }}</div>
                <span class="inline-flex items-center gap-1 font-mono text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded mt-1">
                  <Hash class="w-3.5 h-3.5 text-slate-400" />
                  {{ supplier.kode_supplier }}
                </span>
              </td>
              <td class="px-4 py-3.5">{{ supplier.kontak_sales || '-' }}</td>
              <td class="px-4 py-3.5">
                <p class="text-xs">{{ supplier.no_telp || '-' }}</p>
                <p v-if="supplier.no_wa" class="text-xs text-emerald-600 dark:text-emerald-400">{{ supplier.no_wa }}</p>
              </td>
              <td class="px-4 py-3.5">
                <Badge variant="outline" class="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                  {{ supplier.term_of_payment }} hari
                </Badge>
              </td>
              <td class="px-4 py-3.5">
                <p class="text-xs text-slate-500 max-w-[240px] truncate" :title="supplier.alamat || ''">
                  {{ supplier.alamat || '-' }}
                </p>
              </td>
              <td class="px-4 py-3.5 text-center">
                <Badge
                  variant="outline"
                  :class="supplier.is_active
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30'"
                >
                  {{ supplier.is_active ? 'Aktif' : 'Non-aktif' }}
                </Badge>
              </td>
              <td class="px-4 py-3.5 text-center">
                <div class="flex items-center justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    title="Detail supplier"
                    @click="router.push(`/purchasing/master/suppliers/view/${supplier.id}`)"
                  >
                    <Eye class="w-4 h-4" />
                  </Button>
                  <Button
                    v-if="canManage"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    title="Edit supplier"
                    @click="router.push(`/purchasing/master/suppliers/form/${supplier.id}`)"
                  >
                    <Edit class="w-4 h-4" />
                  </Button>
                  <Button
                    v-if="canManage"
                    variant="ghost"
                    size="sm"
                    class="h-8 w-8 p-0 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Hapus supplier"
                    @click="openDeleteDialog(supplier)"
                  >
                    <Trash2 class="w-4 h-4" />
                  </Button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>

    <GlobalDialog
      v-model:open="isDeleteDialogOpen"
      title="Hapus Supplier"
      description="Supplier yang sudah dipakai PO tidak dapat dihapus. Non-aktifkan saja agar riwayat tetap utuh."
    >
      <div v-if="supplierToDelete" class="space-y-4">
        <div class="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 rounded-lg text-sm">
          <p class="font-semibold">{{ supplierToDelete.nama_supplier }}</p>
          <p class="text-xs mt-1 font-mono">Kode: {{ supplierToDelete.kode_supplier }}</p>
        </div>
        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" @click="isDeleteDialogOpen = false">Batal</Button>
          <Button variant="destructive" :disabled="isDeleting" @click="confirmDelete" class="flex items-center gap-1.5">
            <RefreshCw v-if="isDeleting" class="w-4 h-4 animate-spin" />
            <span>Ya, Hapus Supplier</span>
          </Button>
        </div>
      </div>
    </GlobalDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { Archive, CalendarClock, CheckCircle2, Edit, Eye, Hash, Plus, RefreshCw, Search, Trash2, Truck } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import { useAuthStore } from "@/stores/auth";
import { deleteSupplier, getSuppliers, type Supplier } from "./supplierService";

const router = useRouter();
const authStore = useAuthStore();
const canManage = computed(() => authStore.isManager);

const suppliers = ref<Supplier[]>([]);
const loading = ref(false);
const isDeleting = ref(false);
const searchQuery = ref("");

const isDeleteDialogOpen = ref(false);
const supplierToDelete = ref<Supplier | null>(null);

const activeCount = computed(() => suppliers.value.filter((s) => s.is_active).length);
const averageTop = computed(() => {
  if (suppliers.value.length === 0) return 0;
  return Math.round(
    suppliers.value.reduce((acc, s) => acc + Number(s.term_of_payment || 0), 0) / suppliers.value.length,
  );
});

async function load() {
  loading.value = true;
  try {
    suppliers.value = await getSuppliers({ search: searchQuery.value });
  } catch (error: any) {
    console.error("Gagal memuat supplier:", error);
    toast.error(error.message || "Gagal memuat data supplier");
  } finally {
    loading.value = false;
  }
}

function resetFilter() {
  searchQuery.value = "";
  load();
}

function openDeleteDialog(supplier: Supplier) {
  supplierToDelete.value = supplier;
  isDeleteDialogOpen.value = true;
}

async function confirmDelete() {
  if (!supplierToDelete.value) return;
  isDeleting.value = true;
  try {
    await deleteSupplier(supplierToDelete.value.id);
    toast.success(`Supplier ${supplierToDelete.value.nama_supplier} berhasil dihapus`);
    isDeleteDialogOpen.value = false;
    supplierToDelete.value = null;
    await load();
  } catch (error: any) {
    console.error("Gagal menghapus supplier:", error);
    toast.error(error.message || "Gagal menghapus supplier. Non-aktifkan bila sudah dipakai PO.");
  } finally {
    isDeleting.value = false;
  }
}

onMounted(load);
</script>
