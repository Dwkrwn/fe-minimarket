<script setup lang="ts">
import { computed, ref } from "vue";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Download,
  History,
  LoaderCircle,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-vue-next";
import ButtonMultiSelect from "@/components/button/ButtonMultiSelect.vue";
import { FieldNumber, FieldSelect } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  usePricelistForm,
  type PricelistDetailRow,
  type PricelistHistoryRow,
} from "./usePricelistForm";

const fileInputRef = ref<HTMLInputElement | null>(null);

const {
  filters,
  bulkValues,
  detailRows,
  detailSearch,
  filteredDetailRows,
  filterApis,
  itemPickerApi,
  itemPickerColumns,
  excludeItemIds,
  selectedRowCount,
  allSelected,
  saving,
  uploading,
  exporting,
  bulkDialogOpen,
  bulkProcessingOpen,
  bulkProcessing,
  bulkProcessingStage,
  bulkProcessingMessage,
  bulkProcessingSummary,
  bulkProcessingError,
  saveProcessingOpen,
  saveProcessing,
  saveProcessingStage,
  saveProcessingMessage,
  saveProcessingSummary,
  saveProcessingError,
  importProcessingOpen,
  importProcessing,
  importProcessingStage,
  importProcessingMessage,
  importProcessingSummary,
  importProcessingError,
  importResultOpen,
  importErrors,
  importErrorMessage,
  historyDialogOpen,
  historyRows,
  historyLoading,
  historyItemName,
  historyItemCode,
  historyPagination,
  historyPageItems,
  isSuperAdmin,
  disableSelectItem,
  canSave,
  handleItemsAdded,
  updateRowValue,
  toggleRowSelection,
  removeRow,
  resetDetailRows,
  openBulkDialog,
  applyBulkUpdate,
  retryBulkUpdate,
  retryImportExcel,
  openHistoryDialog,
  handleHistoryPageChange,
  handleSave,
  handleExportExcel,
  handleUploadExcel,
} = usePricelistForm();

const onPickExcel = () => {
  fileInputRef.value?.click();
};

const onFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  await handleUploadExcel(file);
  target.value = "";
};

const formatNumber = (value: number) => value.toLocaleString("id-ID");
const formatDate = (value: string) => {
  if (!value || value === "-") {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("id-ID");
};

const customerKeys: Array<keyof PricelistDetailRow> = [
  "max_disc_cust_1",
  "max_disc_cust_2",
  "max_disc_cust_3",
];

const bisnisKeys: Array<keyof PricelistDetailRow> = [
  "max_disc_bi_1",
  "max_disc_bi_2",
  "max_disc_bi_3",
];

const historyCustomerKeys: Array<keyof PricelistHistoryRow> = [
  "max_disc_cust_1",
  "max_disc_cust_2",
  "max_disc_cust_3",
];

const historyBisnisKeys: Array<keyof PricelistHistoryRow> = [
  "max_disc_bi_1",
  "max_disc_bi_2",
  "max_disc_bi_3",
];

const processSteps = [
  { key: "preparing", label: "Siapkan" },
  { key: "validating", label: "Validasi" },
  { key: "saving", label: "Simpan" },
  { key: "success", label: "Selesai" },
] as const;

const makeProcessMeta = (
  stage: string,
  working: boolean,
  errorMessage: string,
) => {
  if (stage === "success") {
    return {
      icon: CheckCircle2,
      iconClass:
        "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-300",
      title: "Berhasil disimpan",
      railClass:
        "bg-emerald-500 dark:bg-emerald-400",
      dotClass:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200",
      panelClass:
        "border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-400/20 dark:bg-emerald-500/10",
      footerText: "Dialog akan menutup otomatis setelah proses selesai.",
      errorText: "",
    };
  }

  if (stage === "error") {
    return {
      icon: XCircle,
      iconClass:
        "border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-300",
      title: "Perlu ditinjau ulang",
      railClass: "bg-rose-500 dark:bg-rose-400",
      dotClass:
        "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200",
      panelClass:
        "border-rose-200/70 bg-rose-50/60 dark:border-rose-400/20 dark:bg-rose-500/10",
      footerText: "Periksa pesan error lalu ulangi proses bila diperlukan.",
      errorText: errorMessage,
    };
  }

  return {
    icon: LoaderCircle,
    iconClass:
      "border-primary/25 bg-primary/10 text-primary",
    title: working ? "Sedang memproses" : "Menunggu proses",
    railClass: "bg-primary",
    dotClass:
      "border-primary/25 bg-primary/10 text-primary",
    panelClass: "border-border bg-card",
    footerText: "Mohon tunggu sampai proses selesai.",
    errorText: "",
  };
};

const getStepStateClass = (currentStage: string, stepKey: string, index: number) => {
  const currentIndex = processSteps.findIndex((step) => step.key === currentStage);

  if (currentStage === "success") {
    return "border-emerald-200 bg-emerald-50/70 dark:border-emerald-400/20 dark:bg-emerald-500/10";
  }

  if (currentStage === "error" && stepKey === "saving") {
    return "border-rose-200 bg-rose-50/70 dark:border-rose-400/20 dark:bg-rose-500/10";
  }

  if (stepKey === currentStage) {
    return "border-primary/25 bg-primary/10";
  }

  if (currentIndex > index && currentStage !== "idle") {
    return "border-border bg-muted/40";
  }

  return "border-border bg-background";
};

const getStepDotClass = (currentStage: string, stepKey: string, index: number) => {
  const currentIndex = processSteps.findIndex((step) => step.key === currentStage);

  if (currentStage === "success" || currentIndex > index) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200";
  }

  if (currentStage === "error" && stepKey === "saving") {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200";
  }

  if (stepKey === currentStage) {
    return "border-primary/25 bg-primary/10 text-primary";
  }

  return "border-border bg-muted text-muted-foreground";
};

const bulkProcessMeta = computed(() =>
  makeProcessMeta(
    bulkProcessingStage.value,
    bulkProcessing.value,
    bulkProcessingError.value || "Terjadi kendala saat menyimpan bulk update.",
  ),
);

const saveProcessMeta = computed(() =>
  makeProcessMeta(
    saveProcessingStage.value,
    saveProcessing.value,
    saveProcessingError.value || "Terjadi kendala saat menyimpan pricelist.",
  ),
);

const importProcessMeta = computed(() =>
  makeProcessMeta(
    importProcessingStage.value,
    importProcessing.value,
    importProcessingError.value || importErrorMessage.value || "Terjadi kendala saat import excel.",
  ),
);
</script>

<template>
  <div class="mx-auto space-y-6 p-6">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="space-y-1">
        <h1 class="text-2xl font-semibold tracking-tight">Master Pricelist</h1>
        <p class="text-sm text-muted-foreground">
          Atur harga jual, HPP, dan diskon untuk setiap item. Gunakan filter
          untuk menampilkan item yang relevan dengan cepat.
        </p>
      </div>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept=".xlsx,.xls"
      class="hidden"
      @change="onFileChange"
    />

    <Card>
      <CardHeader class="pb-4">
        <CardTitle>Filter Pricelist</CardTitle>
        <CardDescription>
          Filter ini dipakai langsung saat popup item dibuka, jadi item yang
          dipilih langsung relevan.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FieldSelect
            v-if="isSuperAdmin"
            v-model="filters.unit_bisnis_id"
            label="Unit Bisnis"
            placeholder="Pilih Unit Bisnis"
            :api="filterApis.unitBisnis"
            valueField="id"
            displayField="nama_comp"
          />
          <FieldSelect
            v-else
            v-model="filters.unit_bisnis_id"
            label="Unit Bisnis"
            placeholder="Pilih Unit Bisnis"
            :api="filterApis.unitBisnis"
            valueField="id"
            displayField="nama_comp"
            disabled
          />
          <FieldSelect
            v-model="filters.kategori_id"
            label="Kategori"
            placeholder="Pilih Kategori"
            :api="filterApis.kategori"
            valueField="id"
            displayField="value1"
          />
          <FieldSelect
            v-model="filters.group1_id"
            label="Group 1"
            placeholder="Pilih Group 1"
            :api="filterApis.group1"
            valueField="id"
            displayField="value1"
          />
          <FieldSelect
            v-model="filters.group2_id"
            label="Group 2"
            placeholder="Pilih Group 2"
            :api="filterApis.group2"
            valueField="id"
            displayField="value1"
          />
          <FieldSelect
            v-model="filters.group3_id"
            label="Group 3"
            placeholder="Pilih Group 3"
            :api="filterApis.group3"
            valueField="id"
            displayField="value1"
          />
          <FieldSelect
            v-model="filters.group4_id"
            label="Group 4"
            placeholder="Pilih Group 4"
            :api="filterApis.group4"
            valueField="id"
            displayField="value1"
          />
          <FieldSelect
            v-model="filters.group5_id"
            label="Group 5"
            placeholder="Pilih Group 5"
            :api="filterApis.group5"
            valueField="id"
            displayField="value1"
          />
          <FieldSelect
            v-model="filters.group6_id"
            label="Group 6"
            placeholder="Pilih Group 6"
            :api="filterApis.group6"
            valueField="id"
            displayField="value1"
          />
        </div>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="destructive"
            class="gap-2"
            :disabled="detailRows.length === 0"
            @click="resetDetailRows"
          >
            <Trash2 class="h-4 w-4" />
            Reset Detail
          </Button>
          <ButtonMultiSelect
            title="Pilih Item"
            :api="itemPickerApi"
            :columns="itemPickerColumns"
            :exclude-ids="excludeItemIds"
            search-key="nama_item,kode_item"
            display-key="nama_item"
            unique-key="items_id"
            :disabled="disableSelectItem"
            @add="handleItemsAdded"
          />
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="pb-4">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="space-y-1">
            <CardTitle>Detail Pricelist</CardTitle>
            <CardDescription>
              Update harga jual, HPP, dan diskon customer atau bisnis unit per
              item.
            </CardDescription>
          </div>
          <div class="flex flex-wrap items-center gap-2 lg:justify-end">
            <span class="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground">
              Total Item: {{ detailRows.length }}
            </span>
            <span class="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
              Terpilih: {{ selectedRowCount }}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div class="w-full max-w-md">
            <div class="relative">
              <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                v-model="detailSearch"
                class="h-9 border-border/80 bg-background pl-10 pr-9"
                placeholder="Cari nama item atau kode item"
              />
              <Button
                v-if="detailSearch"
                type="button"
                size="icon"
                variant="ghost"
                class="absolute right-0 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-white"
                @click="detailSearch = ''"
              >
                <X class="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              class="gap-2"
              :disabled="uploading"
              @click="onPickExcel"
            >
              <Upload class="h-4 w-4" />
              {{ uploading ? "Uploading..." : "Upload Excel" }}
            </Button>

            <Button
              type="button"
              variant="outline"
              class="gap-2"
              :disabled="exporting"
              @click="handleExportExcel"
            >
              <Download class="h-4 w-4" />
              {{ exporting ? "Exporting..." : "Export Excel" }}
            </Button>

            <Button
              v-if="selectedRowCount > 0"
              type="button"
              class="gap-2 shadow-sm"
              @click="openBulkDialog"
            >
              Update Massal
            </Button>
          </div>
        </div>

        <div class="rounded-xl border border-border bg-card">
          <div class="max-h-[560px] overflow-x-auto overflow-y-auto">
            <Table class="min-w-[1760px] text-sm">
              <TableHeader class="sticky top-0 z-10 bg-muted shadow-[0_1px_0_0_hsl(var(--border))] backdrop-blur">
                <TableRow class="border-b border-border/80 bg-transparent hover:bg-transparent">
                  <TableHead class="h-12 px-3 text-center whitespace-nowrap font-semibold bg-muted">
                    <input
                      v-model="allSelected"
                      type="checkbox"
                      class="h-4 w-4 rounded border-gray-300 accent-primary"
                    />
                  </TableHead>
                  <TableHead class="h-12 px-3 text-left whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200">No</TableHead>
                  <TableHead class="h-12 px-3 text-left whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200">Nama Item</TableHead>
                  <TableHead class="h-12 px-3 text-left whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200">Konversi</TableHead>
                  <TableHead class="h-12 px-3 text-left whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200">HPP</TableHead>
                  <TableHead class="h-12 px-3 text-left whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200">Harga Jual</TableHead>
                  <TableHead class="h-12 px-3 text-center whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200" colspan="3">Max Disc. Customer (%)</TableHead>
                  <TableHead class="h-12 px-3 text-center whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200" colspan="3">Max Disc. Bisnis Unit (%)</TableHead>
                  <TableHead class="h-12 px-3 text-center whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200">Histori</TableHead>
                  <TableHead class="h-12 px-3 text-center whitespace-nowrap font-semibold text-slate-700 dark:text-slate-200">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="filteredDetailRows.length === 0">
                  <TableCell colspan="14" class="p-0">
                    <div class="flex min-h-[112px] items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground">
                      {{
                        detailSearch
                          ? "Tidak ada item yang cocok dengan pencarian."
                          : "Belum ada item pricelist."
                      }}
                    </div>
                  </TableCell>
                </TableRow>

                <TableRow
                  v-for="(row, index) in filteredDetailRows"
                  :key="row.row_id"
                  class="align-top transition-colors hover:bg-muted/20"
                >
                  <TableCell class="px-3 py-3 text-center">
                    <input
                      :checked="row.selected"
                      type="checkbox"
                      class="h-4 w-4 rounded border-gray-300 accent-primary"
                      @change="
                        toggleRowSelection(
                          row.row_id,
                          ($event.target as HTMLInputElement).checked,
                        )
                      "
                    />
                  </TableCell>
                  <TableCell class="px-3 py-3">{{ index + 1 }}</TableCell>
                  <TableCell class="min-w-[220px] px-4 py-4">
                    <div class="font-medium">{{ row.nama_item }}</div>
                    <div class="text-xs text-muted-foreground">
                      {{ row.kode_item }}
                    </div>
                  </TableCell>
                  <TableCell class="min-w-[88px] px-4 py-4">
                    {{ row.konversi_label }}
                  </TableCell>
                  <TableCell class="min-w-[152px] px-4 py-4">
                    <FieldNumber
                      :model-value="String(row.hpp)"
                      :min="0"
                      readonly
                      disabled
                      class="w-32"
                    />
                  </TableCell>
                  <TableCell class="min-w-[172px] px-4 py-4">
                    <FieldNumber
                      :model-value="String(row.harga_jual)"
                      :min="0"
                      class="w-36"
                      @update:model-value="updateRowValue(row.row_id, 'harga_jual', $event)"
                    />
                  </TableCell>
                  <TableCell
                    v-for="key in customerKeys"
                    :key="`${row.row_id}-${String(key)}`"
                    class="min-w-[132px] px-4 py-4"
                  >
                    <FieldNumber
                      :model-value="String(row[key])"
                      :min="0"
                      :step="0.01"
                      type="decimal"
                      :use-grouping="false"
                      class="w-24"
                      @update:model-value="updateRowValue(row.row_id, key, $event)"
                    />
                  </TableCell>
                  <TableCell
                    v-for="key in bisnisKeys"
                    :key="`${row.row_id}-${String(key)}`"
                    class="min-w-[132px] px-4 py-4"
                  >
                    <FieldNumber
                      :model-value="String(row[key])"
                      :min="0"
                      :step="0.01"
                      type="decimal"
                      :use-grouping="false"
                      class="w-24"
                      @update:model-value="updateRowValue(row.row_id, key, $event)"
                    />
                  </TableCell>
                  <TableCell class="px-4 py-4 text-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      class="gap-2"
                      @click="openHistoryDialog(row)"
                    >
                      <History class="h-4 w-4" />
                      Histori
                    </Button>
                  </TableCell>
                  <TableCell class="px-4 py-4 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      class="text-rose-500 hover:text-rose-600"
                      @click="removeRow(row.row_id)"
                    >
                      <Trash2 class="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>

    <Dialog v-model:open="bulkDialogOpen">
      <DialogContent class="sm:max-w-[560px]">
        <DialogHeader class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <div class="space-y-1">
              <DialogTitle>Edit Massal</DialogTitle>
              <DialogDescription>
                Update field numerik untuk item yang tercentang.
              </DialogDescription>
            </div>
            <Badge variant="outline" class="rounded-full px-3 py-1 text-[11px] font-semibold">
              Item dipilih: {{ selectedRowCount }}
            </Badge>
          </div>
        </DialogHeader>

        <div class="space-y-4">
          <div class="rounded-xl border border-border bg-card p-4">
            <label class="mb-2 block text-sm font-medium">Harga Jual (Rp)</label>
            <FieldNumber v-model="bulkValues.harga_jual" :min="0" />
          </div>

          <div class="rounded-xl border border-border bg-card p-4">
            <label class="mb-3 block text-sm font-medium">Max Disc. Customer (%)</label>
            <div class="grid gap-3 sm:grid-cols-3">
              <FieldNumber v-model="bulkValues.max_disc_cust_1" :min="0" :step="0.01" type="decimal" :use-grouping="false" />
              <FieldNumber v-model="bulkValues.max_disc_cust_2" :min="0" :step="0.01" type="decimal" :use-grouping="false" />
              <FieldNumber v-model="bulkValues.max_disc_cust_3" :min="0" :step="0.01" type="decimal" :use-grouping="false" />
            </div>
          </div>

          <div class="rounded-xl border border-border bg-card p-4">
            <label class="mb-3 block text-sm font-medium">Max Disc. Bisnis Unit (%)</label>
            <div class="grid gap-3 sm:grid-cols-3">
              <FieldNumber v-model="bulkValues.max_disc_bi_1" :min="0" :step="0.01" type="decimal" :use-grouping="false" />
              <FieldNumber v-model="bulkValues.max_disc_bi_2" :min="0" :step="0.01" type="decimal" :use-grouping="false" />
              <FieldNumber v-model="bulkValues.max_disc_bi_3" :min="0" :step="0.01" type="decimal" :use-grouping="false" />
            </div>
          </div>
        </div>

        <DialogFooter class="gap-2">
          <Button type="button" variant="outline" @click="bulkDialogOpen = false">
            Batal
          </Button>
          <Button type="button" class="gap-2" :disabled="bulkProcessing" @click="applyBulkUpdate">
            <Sparkles class="h-4 w-4" />
            Proses &amp; Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="bulkProcessingOpen">
      <DialogContent class="w-[min(94vw,760px)] max-w-[760px]">
        <DialogHeader class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <div class="space-y-1">
              <DialogTitle>Progress Bulk Update</DialogTitle>
              <DialogDescription>{{ bulkProcessingMessage }}</DialogDescription>
            </div>
            <Badge variant="outline" class="rounded-full px-3 py-1 text-[11px] font-semibold">
              {{ bulkProcessingSummary.itemCount }} item
            </Badge>
          </div>
        </DialogHeader>

        <div class="space-y-4">
          <div class="rounded-2xl border p-4" :class="bulkProcessMeta.panelClass">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl border" :class="bulkProcessMeta.iconClass">
                <component :is="bulkProcessMeta.icon" class="h-5 w-5" :class="{ 'animate-spin': bulkProcessingStage !== 'success' && bulkProcessingStage !== 'error' }" />
              </div>
              <div class="min-w-0">
                <p class="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Status Proses</p>
                <p class="text-base font-semibold text-foreground">{{ bulkProcessMeta.title }}</p>
              </div>
            </div>

            <div class="mt-4 grid gap-2 sm:grid-cols-4">
              <div
                v-for="(step, index) in processSteps"
                :key="step.key"
                class="rounded-xl border px-3 py-2.5"
                :class="getStepStateClass(bulkProcessingStage, step.key, index)"
              >
                <div class="flex items-center gap-2.5">
                  <div class="flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold" :class="getStepDotClass(bulkProcessingStage, step.key, index)">
                    {{ index + 1 }}
                  </div>
                  <p class="text-sm font-medium text-foreground">{{ step.label }}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-[0.9fr,1.1fr]">
            <div class="rounded-xl border border-border bg-card p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Field</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <span
                  v-for="field in bulkProcessingSummary.updatedFields"
                  :key="field"
                  class="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground"
                >
                  {{ field }}
                </span>
              </div>
            </div>

            <div class="rounded-xl border border-border bg-card p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Sampel Item</p>
              <div class="mt-3 space-y-2">
                <div
                  v-for="item in bulkProcessingSummary.previewItems"
                  :key="item"
                  class="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
                >
                  {{ item }}
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="bulkProcessingStage === 'error'"
            class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
          >
            {{ bulkProcessMeta.errorText }}
          </div>
        </div>

        <DialogFooter class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-xs text-muted-foreground">
            {{ bulkProcessMeta.footerText }}
          </p>
          <div class="flex items-center gap-2">
            <Button
              v-if="bulkProcessingStage === 'error'"
              type="button"
              variant="outline"
              :disabled="bulkProcessing"
              @click="bulkProcessingOpen = false"
            >
              Tutup
            </Button>
            <Button
              v-if="bulkProcessingStage === 'error'"
              type="button"
              class="gap-2"
              :disabled="bulkProcessing"
              @click="retryBulkUpdate"
            >
              <Sparkles class="h-4 w-4" />
              Coba Lagi
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="saveProcessingOpen">
      <DialogContent class="w-[min(94vw,720px)] max-w-[720px]">
        <DialogHeader class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <div class="space-y-1">
              <DialogTitle>Proses Simpan Pricelist</DialogTitle>
              <DialogDescription>{{ saveProcessingMessage }}</DialogDescription>
            </div>
            <Badge variant="outline" class="rounded-full px-3 py-1 text-[11px] font-semibold">
              {{ saveProcessingSummary.itemCount }} item
            </Badge>
          </div>
        </DialogHeader>

        <div class="space-y-4">
          <div class="rounded-2xl border p-4" :class="saveProcessMeta.panelClass">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl border" :class="saveProcessMeta.iconClass">
                <component :is="saveProcessMeta.icon" class="h-5 w-5" :class="{ 'animate-spin': saveProcessingStage !== 'success' && saveProcessingStage !== 'error' }" />
              </div>
              <div class="min-w-0">
                <p class="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Status Proses</p>
                <p class="text-base font-semibold text-foreground">{{ saveProcessMeta.title }}</p>
              </div>
            </div>

            <div class="mt-4 grid gap-2 sm:grid-cols-4">
              <div
                v-for="(step, index) in processSteps"
                :key="step.key"
                class="rounded-xl border px-3 py-2.5"
                :class="getStepStateClass(saveProcessingStage, step.key, index)"
              >
                <div class="flex items-center gap-2.5">
                  <div class="flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold" :class="getStepDotClass(saveProcessingStage, step.key, index)">
                    {{ index + 1 }}
                  </div>
                  <p class="text-sm font-medium text-foreground">{{ step.label }}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-[0.9fr,1.1fr]">
            <div class="rounded-xl border border-border bg-card p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Field</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <span
                  v-for="field in saveProcessingSummary.updatedFields"
                  :key="field"
                  class="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground"
                >
                  {{ field }}
                </span>
              </div>
            </div>

            <div class="rounded-xl border border-border bg-card p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Sampel Item</p>
              <div class="mt-3 space-y-2">
                <div
                  v-for="item in saveProcessingSummary.previewItems"
                  :key="item"
                  class="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
                >
                  {{ item }}
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="saveProcessingStage === 'error'"
            class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
          >
            {{ saveProcessMeta.errorText }}
          </div>
        </div>

        <DialogFooter class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-xs text-muted-foreground">
            {{ saveProcessMeta.footerText }}
          </p>
          <Button
            v-if="saveProcessingStage === 'error'"
            type="button"
            variant="outline"
            :disabled="saveProcessing"
            @click="saveProcessingOpen = false"
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="importProcessingOpen">
      <DialogContent class="w-[min(94vw,720px)] max-w-[720px]">
        <DialogHeader class="space-y-3">
          <div class="flex items-center justify-between gap-3">
            <div class="space-y-1">
              <DialogTitle>Proses Import Excel</DialogTitle>
              <DialogDescription>{{ importProcessingMessage }}</DialogDescription>
            </div>
            <Badge variant="outline" class="rounded-full px-3 py-1 text-[11px] font-semibold">
              {{ importProcessingSummary.itemCount || 0 }} item
            </Badge>
          </div>
        </DialogHeader>

        <div class="space-y-4">
          <div class="rounded-2xl border p-4" :class="importProcessMeta.panelClass">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-xl border" :class="importProcessMeta.iconClass">
                <component :is="importProcessMeta.icon" class="h-5 w-5" :class="{ 'animate-spin': importProcessingStage !== 'success' && importProcessingStage !== 'error' }" />
              </div>
              <div class="min-w-0">
                <p class="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">Status Proses</p>
                <p class="text-base font-semibold text-foreground">{{ importProcessMeta.title }}</p>
              </div>
            </div>

            <div class="mt-4 grid gap-2 sm:grid-cols-4">
              <div
                v-for="(step, index) in processSteps"
                :key="step.key"
                class="rounded-xl border px-3 py-2.5"
                :class="getStepStateClass(importProcessingStage, step.key, index)"
              >
                <div class="flex items-center gap-2.5">
                  <div class="flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold" :class="getStepDotClass(importProcessingStage, step.key, index)">
                    {{ index + 1 }}
                  </div>
                  <p class="text-sm font-medium text-foreground">{{ step.label }}</p>
                </div>
              </div>
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-[0.9fr,1.1fr]">
            <div class="rounded-xl border border-border bg-card p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Field</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <span
                  v-for="field in importProcessingSummary.updatedFields"
                  :key="field"
                  class="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground"
                >
                  {{ field }}
                </span>
              </div>
            </div>

            <div class="rounded-xl border border-border bg-card p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Sampel Item</p>
              <div class="mt-3 space-y-2">
                <div
                  v-for="item in importProcessingSummary.previewItems"
                  :key="item"
                  class="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
                >
                  {{ item }}
                </div>
                <p
                  v-if="importProcessingSummary.previewItems.length === 0"
                  class="text-sm text-muted-foreground"
                >
                  Menunggu hasil import dari server.
                </p>
              </div>
            </div>
          </div>

          <div
            v-if="importProcessingStage === 'error'"
            class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-500/10 dark:text-rose-200"
          >
            {{ importProcessMeta.errorText }}
          </div>
        </div>

        <DialogFooter class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-xs text-muted-foreground">
            {{ importProcessMeta.footerText }}
          </p>
          <div class="flex items-center gap-2">
            <Button
              v-if="importProcessingStage === 'error'"
              type="button"
              variant="outline"
              :disabled="importProcessing"
              @click="importProcessingOpen = false"
            >
              Tutup
            </Button>
            <Button
              v-if="importProcessingStage === 'error'"
              type="button"
              class="gap-2"
              :disabled="importProcessing"
              @click="retryImportExcel"
            >
              <Sparkles class="h-4 w-4" />
              Coba Lagi
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="importResultOpen">
      <DialogContent class="w-[min(94vw,760px)] max-w-[760px]">
        <DialogHeader class="space-y-2">
          <DialogTitle>Import Excel Gagal</DialogTitle>
          <DialogDescription>
            {{ importErrorMessage || "Silakan perbaiki data excel anda sebelum import." }}
          </DialogDescription>
        </DialogHeader>

        <div class="rounded-xl border border-border bg-card">
          <div class="max-h-[360px] overflow-auto">
            <Table class="min-w-full text-sm">
              <TableHeader class="sticky top-0 bg-muted">
                <TableRow class="hover:bg-transparent">
                  <TableHead class="w-20">Row</TableHead>
                  <TableHead class="min-w-[200px]">Nama Item</TableHead>
                  <TableHead>Pesan Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="importErrors.length === 0">
                  <TableCell colspan="3" class="py-10 text-center text-muted-foreground">
                    Belum ada detail error import.
                  </TableCell>
                </TableRow>
                <TableRow v-for="error in importErrors" :key="`${error.row}-${error.nama_item}-${error.message}`">
                  <TableCell>{{ error.row }}</TableCell>
                  <TableCell>{{ error.nama_item || "-" }}</TableCell>
                  <TableCell>{{ error.message }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter class="gap-2">
          <Button type="button" variant="outline" @click="importResultOpen = false">
            Tutup
          </Button>
          <Button type="button" class="gap-2" :disabled="importProcessing" @click="retryImportExcel">
            <Sparkles class="h-4 w-4" />
            Coba Lagi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="historyDialogOpen">
      <DialogContent class="w-[min(96vw,1180px)] max-w-[1180px] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Histori Pricelist</DialogTitle>
          <DialogDescription>
            {{ historyItemName || "-" }}
            <span v-if="historyItemCode" class="ml-1">({{ historyItemCode }})</span>
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-4">
          <div class="flex flex-col gap-4 rounded-2xl border border-border bg-muted/30 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 flex-1 space-y-1">
              <p class="text-sm font-semibold text-foreground">Riwayat harga item terpilih.</p>
              <p class="text-xs leading-5 text-muted-foreground">
                Menampilkan histori harga jual, HPP, dan batas diskon yang pernah tersimpan.
              </p>
            </div>

            <div class="flex shrink-0 flex-wrap items-center gap-2 text-xs font-medium lg:justify-end">
              <span class="rounded-full border border-border bg-background px-2.5 py-1 text-foreground">
                Total Data: {{ historyPagination.total }}
              </span>
              <span class="rounded-full border border-border bg-background px-2.5 py-1 text-foreground">
                Halaman {{ historyPagination.page }} / {{ historyPagination.total_pages }}
              </span>
            </div>
          </div>

          <div class="w-full max-w-full overflow-x-auto rounded-xl border border-border bg-card">
            <Table class="min-w-[1080px] text-sm">
              <TableHeader class="sticky top-0 z-10 bg-muted shadow-[0_1px_0_0_hsl(var(--border))]">
                <TableRow class="border-b border-border/80 bg-transparent hover:bg-transparent">
                  <TableHead class="h-11 w-20 whitespace-nowrap px-4 text-left font-semibold text-slate-700 dark:text-slate-200">No</TableHead>
                  <TableHead class="h-11 w-44 whitespace-nowrap px-4 text-left font-semibold text-slate-700 dark:text-slate-200">Tanggal</TableHead>
                  <TableHead class="h-11 w-36 whitespace-nowrap px-4 text-left font-semibold text-slate-700 dark:text-slate-200">HPP</TableHead>
                  <TableHead class="h-11 w-36 whitespace-nowrap px-4 text-left font-semibold text-slate-700 dark:text-slate-200">Harga Jual</TableHead>
                  <TableHead class="h-11 whitespace-nowrap px-4 text-center font-semibold text-slate-700 dark:text-slate-200" colspan="3">Max Disc. Customer (%)</TableHead>
                  <TableHead class="h-11 whitespace-nowrap px-4 text-center font-semibold text-slate-700 dark:text-slate-200" colspan="3">Max Disc. Bisnis Unit (%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-if="historyLoading">
                  <TableCell colspan="10" class="px-4 py-10 text-center text-sm text-muted-foreground">
                    Memuat history...
                  </TableCell>
                </TableRow>
                <TableRow v-else-if="historyRows.length === 0">
                  <TableCell colspan="10" class="px-4 py-10 text-center text-sm text-muted-foreground">
                    Belum ada histori.
                  </TableCell>
                </TableRow>
                <TableRow
                  v-for="(row, index) in historyRows"
                  :key="row.id"
                  class="align-top transition-colors hover:bg-muted/20"
                >
                  <TableCell class="px-4 py-3">
                    {{ (historyPagination.page - 1) * historyPagination.paginate + index + 1 }}
                  </TableCell>
                  <TableCell class="px-4 py-3 whitespace-nowrap">
                    {{ formatDate(row.tanggal_berlaku) }}
                  </TableCell>
                  <TableCell class="px-4 py-3 whitespace-nowrap">
                    {{ formatNumber(row.hpp) }}
                  </TableCell>
                  <TableCell class="px-4 py-3 whitespace-nowrap">
                    {{ formatNumber(row.harga_jual) }}
                  </TableCell>
                  <TableCell
                    v-for="key in historyCustomerKeys"
                    :key="`${row.id}-${String(key)}`"
                    class="px-4 py-3 text-center whitespace-nowrap"
                  >
                    {{ formatNumber(Number(row[key])) }}
                  </TableCell>
                  <TableCell
                    v-for="key in historyBisnisKeys"
                    :key="`${row.id}-${String(key)}`"
                    class="px-4 py-3 text-center whitespace-nowrap"
                  >
                    {{ formatNumber(Number(row[key])) }}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div
            v-if="historyPagination.total_pages > 1"
            class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <p class="text-xs text-muted-foreground">
              Menampilkan {{ historyRows.length }} data dari total
              {{ historyPagination.total }} histori.
            </p>

            <div class="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-8 rounded-lg px-3"
                :disabled="historyPagination.page <= 1 || historyLoading"
                @click="handleHistoryPageChange(historyPagination.page - 1)"
              >
                Sebelumnya
              </Button>

              <template v-for="item in historyPageItems" :key="`${item.type}-${item.value}`">
                <span v-if="item.type === 'ellipsis'" class="px-1 text-xs text-muted-foreground">
                  ...
                </span>
                <Button
                  v-else
                  type="button"
                  size="sm"
                  :variant="item.value === historyPagination.page ? 'default' : 'outline'"
                  class="h-8 min-w-8 rounded-lg px-2.5"
                  :disabled="historyLoading"
                  @click="handleHistoryPageChange(item.value)"
                >
                  {{ item.value }}
                </Button>
              </template>

              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-8 rounded-lg px-3"
                :disabled="historyPagination.page >= historyPagination.total_pages || historyLoading"
                @click="handleHistoryPageChange(historyPagination.page + 1)"
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            @click="historyDialogOpen = false"
          >
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <div class="sticky bottom-0 z-10 -mx-2 border-t border-border bg-background/95 px-2 pb-2 pt-4 backdrop-blur">
      <div class="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4 shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div class="space-y-1">
          <p class="text-sm font-semibold text-foreground">Simpan Pricelist</p>
          <p class="text-xs text-muted-foreground">
            Simpan perubahan setelah detail item selesai diperiksa.
          </p>
        </div>

        <Button
          type="button"
          class="gap-2 sm:min-w-36"
          :disabled="saving || !canSave"
          @click="handleSave"
        >
          <Save class="h-4 w-4" />
          {{ saving ? "Menyimpan..." : "Simpan" }}
        </Button>
      </div>
    </div>
  </div>
</template>
