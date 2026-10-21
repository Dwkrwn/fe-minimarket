<script setup lang="ts">
import { Truck, Package, ArrowRight } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { SjGudangHistoryItem } from "./service";

interface Props {
  open: boolean;
  items: SjGudangHistoryItem[];
  loading: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  "select-sj": [sj: SjGudangHistoryItem];
}>();

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getStatusVariant = (status: string) => {
  const s = status?.toUpperCase();
  if (s === "POST") return "default";
  if (s === "DIKIRIM") return "default";
  if (s === "SELESAI") return "secondary";
  return "outline";
};
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-3xl max-h-[80vh] flex flex-col">
      <DialogHeader>
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50">
            <Truck class="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <DialogTitle>History Pengiriman</DialogTitle>
            <DialogDescription>
              Surat jalan yang sedang dalam perjalanan menuju gudang Anda
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto mt-4">
        <!-- Loading State -->
        <div v-if="loading" class="space-y-3">
          <div v-for="i in 3" :key="i" class="flex items-center gap-3 p-3 border rounded-lg">
            <Skeleton class="h-4 w-32" />
            <Skeleton class="h-4 w-24" />
            <Skeleton class="h-4 w-28" />
            <Skeleton class="h-4 w-28" />
            <Skeleton class="h-6 w-16 ml-auto" />
          </div>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="items.length === 0"
          class="flex flex-col items-center justify-center py-12 text-center"
        >
          <Package class="w-12 h-12 text-muted-foreground mb-3" />
          <p class="text-sm font-medium text-muted-foreground">
            Tidak ada pengiriman yang sedang dalam perjalanan
          </p>
          <p class="text-xs text-muted-foreground mt-1">
            Semua surat jalan sudah diterima atau belum ada pengiriman aktif
          </p>
        </div>

        <!-- Table -->
        <div v-else class="border rounded-lg overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-muted">
              <tr>
                <th class="px-3 py-2 text-left font-medium text-xs">No. SJ Gudang</th>
                <th class="px-3 py-2 text-left font-medium text-xs">Tanggal</th>
                <th class="px-3 py-2 text-left font-medium text-xs">Gudang Asal</th>
                <th class="px-3 py-2 text-left font-medium text-xs">Gudang Tujuan</th>
                <th class="px-3 py-2 text-center font-medium text-xs">Status</th>
                <th class="px-3 py-2 text-center font-medium text-xs">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="sj in items"
                :key="sj.id"
                class="border-t hover:bg-muted/50 transition-colors"
              >
                <td class="px-3 py-2 font-medium text-xs">
                  {{ sj.no_sj_gudang || "-" }}
                </td>
                <td class="px-3 py-2 text-xs text-muted-foreground">
                  {{ formatDate(sj.tgl_sj_gudang) }}
                </td>
                <td class="px-3 py-2 text-xs">
                  {{ sj.gudang_asal?.nama_gudang || "-" }}
                </td>
                <td class="px-3 py-2 text-xs">
                  <div class="flex items-center gap-1">
                    <ArrowRight class="w-3 h-3 text-muted-foreground shrink-0" />
                    {{ sj.gudang_tujuan?.nama_gudang || "-" }}
                  </div>
                </td>
                <td class="px-3 py-2 text-center">
                  <Badge :variant="getStatusVariant(sj.status)" class="text-xs">
                    {{ sj.status || "-" }}
                  </Badge>
                </td>
                <td class="px-3 py-2 text-center">
                  <Button
                    size="sm"
                    variant="outline"
                    class="h-7 text-xs gap-1"
                    @click="emit('select-sj', sj)"
                  >
                    Buat Penerimaan
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
