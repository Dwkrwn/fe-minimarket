<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FieldX,
  FieldNumber,
  FieldDate,
  FieldSelect,
  FieldTextarea,
} from "@/components/field";
import { ButtonMultiSelect } from "@/components/button";
import { DeleteButton } from "@/components/button";
import GlobalDialog from "@/components/dialog/GlobalDialog.vue";
import { ArrowLeft, Save, Loader2, Trash2 } from "lucide-vue-next";
import { usePurchaseRequestSubconForm } from "./usePurchaseRequestSubconForm";
import AuditInfo from '@/components/AuditInfo.vue'

// ============================================================================
// SETUP
// ============================================================================
const {
  API_BASE_URL,
  authStore,
  loading,
  values,
  errors,
  detailArr,
  detailArr2,
  detailArr3,
  isJenisPrSepuh,
  isJenisPrPotong,
  canUseManualJasa,
  isEditMode,
  isReadOnly,
  isSuperAdmin,
  auditMeta,
  isViewMode,
  isCopyMode,
  unitBisnisNameDisplay,
  selectedCompanyNameDisplay,
  handleUnitBisnisSelected,
  pageTitle,
  pageDescription,
  removeDetailArr,
  removeDetailArr2,
  clearDetailArr2,
  removeDetailArr3,
  mapDetailBahan,
  mapDetailFinishGoods,
  mapDetailJasa,
  potongDialogOpen,
  potongDialogType,
  potongDialogTitle,
  potongDialogDescription,
  potongDialogConfirmText,
  potongDialogSummary,
  potongDialogFinishGoods,
  handlePotongDialogConfirm,
  handlePotongDialogClose,
  syncJasaDetailsWithJenis,
  onSave,
  handleCancel,
} = usePurchaseRequestSubconForm();

const getItemKey = (item: any) => {
  const itemId = item.m_items_id || item.m_item_id || item.id;
  if (!itemId) return "";
  const gudangId = item.m_gudang_id || "";
  return `${itemId}_${gudangId}`;
};

const selectedBahanIds = computed(() =>
  detailArr.value.map(getItemKey).filter(Boolean),
);

const selectedJadiIds = computed(() =>
  detailArr2.value.map(getItemKey).filter(Boolean),
);

const excludedBahanIds = computed(() => [
  ...selectedBahanIds.value,
  ...selectedJadiIds.value,
]);

const excludedJadiIds = computed(() => [
  ...selectedJadiIds.value,
  ...selectedBahanIds.value,
]);

const showJasaQtyColumn = computed(
  () => !canUseManualJasa.value || detailArr3.value.some((detail) => !detail.is_manual),
);
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
    <!-- ================================================================ -->
    <!-- HEADER SECTION -->
    <!-- ================================================================ -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <Button variant="ghost" size="icon" @click="handleCancel">
          <ArrowLeft class="h-5 w-5" />
        </Button>
        <div>
          <h1 class="text-2xl font-bold text-foreground">
            {{ pageTitle }}
          </h1>
          <p class="text-sm text-muted-foreground">
            {{ pageDescription }}
          </p>
        </div>
      </div>
      <Badge variant="secondary" class="uppercase">{{
        values.status || "DRAFT"
      }}</Badge>
    </div>

    <!-- ================================================================ -->
    <!-- FORM SECTION -->
    <!-- ================================================================ -->
    <!-- Form tanpa submit default; penyimpanan melalui tombol onSave -->
    <form class="space-y-6" @submit.prevent>
      <!-- HEADER CARD (tanpa tab) -->
      <Card>
        <CardHeader>
          <CardTitle>Informasi Purchase Request Subcon</CardTitle>
          <CardDescription>
            Isi data PurchaseRequestSubcon dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Unit Bisnis -->
            <FieldSelect
              v-if="isSuperAdmin"
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              v-model="values.m_unit_bisnis_id"
              :errorname="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              @update:value-full="handleUnitBisnisSelected"
              :readonly="isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  filter_column_is_active: 'true',
                  join: 'true',
                },
              }"
              valueField="id"
              displayField="nama_comp"
              placeholder="Pilih unit bisnis"
              class="w-full"
              :clearable="true"
            />
            <FieldX
              v-else
              id="m_unit_bisnis_display"
              label="Unit Bisnis"
              :value="unitBisnisNameDisplay"
              :disabled="true"
              :readonly="true"
              placeholder="Auto dari akun"
              hints="Unit bisnis dari akun Anda"
              class="w-full"
            />

            <FieldX
              id="company_display"
              label="Company"
              :value="selectedCompanyNameDisplay"
              :disabled="true"
              :readonly="true"
              placeholder="Auto dari unit bisnis"
              hints="Company terisi otomatis dari unit bisnis"
              class="w-full"
            />

            <!-- Tanggal PR Subcon -->
            <FieldDate
              id="tgl_pr_subcon"
              label="Tanggal PR Subcon"
              :value="values.tgl_pr_subcon"
              :errorname="errors.tgl_pr_subcon ? 'failed' : ''"
              @input="(v) => (values.tgl_pr_subcon = v)"
              :hints="errors.tgl_pr_subcon"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              class="w-full"
            />

            <!-- Tanggal Dibutuhkan -->
            <FieldDate
              id="tgl_butuh"
              label="Tanggal Dibutuhkan"
              :value="values.tgl_butuh"
              :errorname="errors.tgl_butuh ? 'failed' : ''"
              @input="(v) => (values.tgl_butuh = v)"
              :hints="errors.tgl_butuh"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              class="w-full"
            />

            <!-- No. PR Subcon -->
            <FieldX
              id="no_pr_subcon"
              label="No. PR Subcon"
              v-model="values.no_pr_subcon"
              :errorname="errors.no_pr_subcon ? 'failed' : ''"
              :hints="errors.no_pr_subcon"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="!isReadOnly"
              placeholder="Auto generate sistem"
              class="w-full"
            />

            <!-- Gudang -->
            <FieldSelect
              id="m_gudang_id"
              label="Gudang"
              v-model="values.m_gudang_id"
              :errorname="errors.m_gudang_id ? 'failed' : ''"
              :hints="
                errors.m_gudang_id ||
                (values.m_unit_bisnis_id
                  ? 'Pilih Gudang'
                  : 'Pilih unit bisnis terlebih dahulu')
              "
              :required="!isReadOnly"
              @update:value-full="
                (v) => {
                  detailArr = [];
                  detailArr2 = [];
                }
              "
              :disabled="loading || isReadOnly || !values.m_unit_bisnis_id"
              :readonly="isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_gudang`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'kode_gudang,nama_gudang',
                  filter_column_is_active: 'true',
                  filter_column_is_gudang_transit: false,
                  filter_column_m_unit_bisnis_id:
                    values.m_unit_bisnis_id || undefined,
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page
                    ? true
                    : false;
                  return response;
                },
              }"
              valueField="id"
              displayField="nama_gudang"
              placeholder="Pilih Gudang"
              :clearable="true"
              class="w-full"
              :key="`gudang-${values.m_unit_bisnis_id}`"
            />

            <FieldSelect
              id="jenis_pr_subcon"
              label="Jenis PR Subcon"
              v-model="values.jenis_pr_subcon"
              :errorname="errors.jenis_pr_subcon ? 'failed' : ''"
              :hints="errors.jenis_pr_subcon"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              @update:value-full="() => syncJasaDetailsWithJenis()"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  selectfield: 'id,value1',
                  filter_column_group: 'TIPE PR SUBCON',
                  filter_column_is_active: 'true',
                },
              }"
              valueField="id"
              displayField="value1"
              placeholder="Pilih jenis PR subcon"
              class="w-full"
              :clearable="true"
            />
          </div>

          <!-- Catatan (paling bawah) -->
          <FieldTextarea
            id="catatan"
            label="Catatan"
            v-model="values.catatan"
            :errorname="errors.catatan ? 'failed' : ''"
            :hints="errors.catatan"
            :required="false"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            placeholder="Catatan"
            class="w-full"
            :rows="3"
          />
        </CardContent>
      </Card>

      <!-- DETAIL TABS (di bawah header card) -->
      <Tabs default-value="detail1" class="w-full">
        <TabsList
          class="w-full overflow-x-auto flex justify-start scrollbar-hide"
        >
          <TabsTrigger value="detail1">Detail Bahan</TabsTrigger>
          <TabsTrigger value="detail2">Detail Finish Goods</TabsTrigger>
          <TabsTrigger value="detail3">Detail Jasa</TabsTrigger>
        </TabsList>

        <!-- DETAIL TAB CONTENTS - DYNAMIC GENERATION -->

        <!-- TAB CONTENT: DETAIL 1 (MULTI-SELECT) -->
        <TabsContent value="detail1" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Bahan</CardTitle>
                  <CardDescription
                    >Detail bahan hanya boleh 1 item per PR
                    subcon</CardDescription
                  >
                </div>
                <ButtonMultiSelect
                  v-if="!isReadOnly && detailArr.length === 0"
                  title="+ Add to List"
                  :singleSelect="true"
                  :excludeIds="excludedBahanIds"
                  @add="
                    (items: any[]) => {
                      const [item] = items || [];
                      if (item) {
                        detailArr = [mapDetailBahan(item)];
                      }
                    }
                  "
                  :api="{
                    url: `${API_BASE_URL}/fn/stock_gudang/stock_item_grouped`,
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authStore.token}`,
                    },
                    params: {
                      searchfield: 'kode_item,nama_item,tipe_name,nama_gudang',
                      filter_column_m_unit_bisnis_id:
                        values.m_unit_bisnis_id || undefined,
                      filter_column_m_gudang_id:
                        values.m_gudang_id || undefined,
                      all_data:false,
                    },
                    onsuccess: (response: any) => {
                      if (response.data && Array.isArray(response.data)) {
                        response.data = response.data.map((item: any) => ({
                          ...item,
                          id: item.m_items_id + '_' + (item.m_gudang_id || ''),
                        }));
                      }
                      response.hasNext = response.pagination?.next_page
                        ? true
                        : false;
                      return response;
                    },
                  }"
                  :columns="[
                    {
                      field: 'kode_item',
                      headerName: 'Kode',
                      width: '150px',
                      sortable: true,
                      filterable: true,
                    },
                    {
                      field: 'nama_item',
                      headerName: 'Nama Material',
                      width: '180px',
                      sortable: true,
                      filterable: true,
                    },
                    {
                      field: 'nama_gudang',
                      headerName: 'Nama Gudang',
                      width: '180px',
                      sortable: true,
                      filterable: true,
                    },
                    {
                      field: 'uom_name',
                      headerName: 'UoM',
                      width: '100px',
                      sortable: false,
                      filterable: false,
                    },
                    {
                      field: 'free_stock',
                      headerName: 'Free Stock',
                      width: '120px',
                      sortable: false,
                      filterable: false,
                    },
                  ]"
                  :disabled="loading || !values.m_gudang_id"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full min-w-[980px] text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        No
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Kode
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Nama Material
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Qty
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        UoM
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Free Stock
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Rak
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Catatan
                      </th>
                      <th
                        v-if="!isReadOnly"
                        class="px-2 py-2 text-center font-medium text-xs sm:text-sm"
                      >
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr.length === 0">
                      <td
                        colspan="9"
                        class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                      >
                        Belum ada item dipilih. Klik "Add to List" untuk
                        menambahkan.
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, idx) in detailArr"
                      :key="detail.id || idx"
                      class="border-t hover:bg-muted/50"
                    >
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ idx + 1 }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.kode }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.nama_material }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldNumber
                          v-model="detail.qty"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          :min="0"
                          :max="detail.qty_free_stok || 0"
                          placeholder="0"
                          class="w-24"
                        />
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.uom }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.qty_free_stok }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldSelect
                          v-model="detail.stock_gudang_id"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          :options="
                            (detail.rak_list || [])
                              .filter(
                                (rak: any) =>
                                  Number(
                                    rak?.qty_free_stok ?? rak?.free_stock ?? 0,
                                  ) > 0,
                              )
                              .map((rak: any) => ({
                                label: `${rak.kode_rak_d || '-'} (${rak.nama_rak || 'Tanpa Rak'})`,
                                value: rak.stock_gudang_id,
                              }))
                          "
                          @update:model-value="
                            (selectedStockGudangId) => {
                              const selectedRak = (detail.rak_list || [])
                                .filter(
                                  (rak: any) =>
                                    Number(
                                      rak?.qty_free_stok ??
                                        rak?.free_stock ??
                                        0,
                                    ) > 0,
                                )
                                .find(
                                  (rak: any) =>
                                    String(rak.stock_gudang_id) ===
                                    String(selectedStockGudangId),
                                );
                              detail.qty_free_stok = Number(
                                selectedRak?.qty_free_stok ??
                                  selectedRak?.free_stock ??
                                  0,
                              );
                            }
                          "
                          valueField="value"
                          displayField="label"
                          placeholder="Pilih Rak"
                          :clearable="false"
                          class="w-56"
                        />
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldTextarea
                          v-model="detail.catatan"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          placeholder="Catatan"
                          :rows="2"
                          class="min-w-[220px]"
                        />
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                        <DeleteButton
                          variant="ghost"
                          size="sm"
                          @click="removeDetailArr(idx)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- TAB CONTENT: DETAIL 2 (MULTI-SELECT) -->
        <TabsContent value="detail2" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Finish Goods</CardTitle>
                  <CardDescription
                    >{{
                      isJenisPrPotong
                        ? 'Pastikan hasil potong sesuai batas toleransi.'
                        : 'Kelola item detail finish goods dengan multi select'
                    }}</CardDescription
                  >
                </div>
                <div class="flex items-center gap-2">
                  <Button
                    v-if="!isReadOnly && detailArr2.length > 0"
                    type="button"
                    variant="destructive"
                    size="sm"
                    class="gap-1.5 font-medium"
                    @click="clearDetailArr2"
                  >
                    <Trash2 class="h-4 w-4" />
                    Clear All
                  </Button>
                  <ButtonMultiSelect
                    v-if="!isReadOnly"
                    title="+ Add to List"
                    :excludeIds="excludedJadiIds"
                    @add="
                      (items: any[]) => {
                        items.forEach((item) => {
                          if (
                            !detailArr2.find(
                              (d: any) =>
                                d.m_items_id === item.m_items_id &&
                                d.m_gudang_id === item.m_gudang_id,
                            )
                          ) {
                            detailArr2.push(mapDetailFinishGoods(item));
                          }
                        });
                      }
                    "
                    :api="{
                      url: `${API_BASE_URL}/fn/stock_gudang/stock_item_grouped`,
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${authStore.token}`,
                      },
                      params: {
                        searchfield: 'kode_item,nama_item,tipe_name,nama_gudang',
                        filter_column_m_unit_bisnis_id:
                          values.m_unit_bisnis_id || undefined,
                        filter_column_m_gudang_id:
                          values.m_gudang_id || undefined,
                          all_data: true,
                      },
                      onsuccess: (response: any) => {
                        if (response.data && Array.isArray(response.data)) {
                          response.data = response.data.map((item: any) => ({
                            ...item,
                            id: item.m_items_id + '_' + (item.m_gudang_id || ''),
                          }));
                        }
                        response.hasNext = response.pagination?.next_page
                          ? true
                          : false;
                        return response;
                      },
                    }"
                    :columns="[
                      {
                        field: 'kode_item',
                        headerName: 'Kode',
                        width: '150px',
                        sortable: true,
                        filterable: true,
                      },
                      {
                        field: 'nama_item',
                        headerName: 'Nama Item',
                        width: '180px',
                        sortable: true,
                        filterable: true,
                      },
                      {
                        field: 'nama_gudang',
                        headerName: 'Nama Gudang',
                        width: '180px',
                        sortable: true,
                        filterable: true,
                      },
                      {
                        field: 'uom_name',
                        headerName: 'UoM',
                        width: '100px',
                        sortable: false,
                        filterable: false,
                      },
                      {
                        field: 'free_stock',
                        headerName: 'Free Stock',
                        width: '120px',
                        sortable: false,
                        filterable: false,
                      },
                    ]"
                    :disabled="loading || !values.m_gudang_id"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full min-w-[900px] text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        No
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Kode
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Nama Item
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Qty
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        UoM
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Free Stock
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Catatan
                      </th>
                      <th
                        v-if="!isReadOnly"
                        class="px-2 py-2 text-center font-medium text-xs sm:text-sm"
                      >
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr2.length === 0">
                      <td
                        colspan="8"
                        class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                      >
                        Belum ada item dipilih. Klik "Add to List" untuk
                        menambahkan.
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, idx) in detailArr2"
                      :key="detail.id || idx"
                      class="border-t hover:bg-muted/50"
                    >
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ idx + 1 }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.kode }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.nama_item }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldNumber
                          v-model="detail.qty"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          :min="0"
                          placeholder="0"
                          class="w-24"
                        />
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.uom }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.qty_free_stok }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldTextarea
                          v-model="detail.catatan"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          placeholder="Catatan"
                          :rows="2"
                          class="min-w-[220px]"
                        />
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                        <DeleteButton
                          variant="ghost"
                          size="sm"
                          @click="removeDetailArr2(idx)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <!-- TAB CONTENT: DETAIL 3 (MULTI-SELECT) -->
        <TabsContent value="detail3" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Jasa</CardTitle>
                  <CardDescription
                    >Tipe SEPUH default UoM KG, POTONG default
                    UoM PCS</CardDescription
                  >
                </div>
                <ButtonMultiSelect
                  v-if="!isReadOnly"
                  title="+ Add to List"
                  @add="
                    (items: any[]) => {
                      items.forEach((item) => {
                        if (!detailArr3.find((d: any) => d.id === item.id)) {
                          detailArr3.push(mapDetailJasa(item));
                        }
                      });
                    }
                  "
                  :api="{
                    url: `${API_BASE_URL}/dynamic/m_items`,
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authStore.token}`,
                    },
                    params: {
                      searchfield:
                        'kode_item,nama_item,mi_tipe.value1,mi_uom.value1',
                      filter_column_is_active: true,
                      join: true,
                      'filter_column_mi_tipe.value1': 'JASA',
                    },
                    onsuccess: (response: any) => {
                      if (response.data && Array.isArray(response.data)) {
                        response.data = response.data.map((item: any) => ({
                          ...item,
                          tipe_name: item.mi_tipe?.value1 || '-',
                          uom_name: item.mi_uom?.value1 || '-',
                        }));
                      }
                      response.hasNext = response.pagination?.next_page
                        ? true
                        : false;
                      return response;
                    },
                  }"
                  :columns="[
                    {
                      field: 'kode_item',
                      headerName: 'Kode',
                      width: '150px',
                      sortable: true,
                      filterable: true,
                    },
                    {
                      field: 'nama_item',
                      headerName: 'Nama Jasa',
                      flex: 1,
                      sortable: true,
                      filterable: true,
                    },
                    {
                      field: 'tipe_name',
                      headerName: 'Tipe',
                      width: '120px',
                      sortable: true,
                      filterable: true,
                    },
                    {
                      field: 'uom_name',
                      headerName: 'UoM',
                      width: '100px',
                      sortable: false,
                      filterable: false,
                    },
                  ]"
                  :disabled="loading || !values.jenis_pr_subcon"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full min-w-[920px] text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        No
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Kode
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Nama Jasa
                      </th>
                        <th
                        v-if="canUseManualJasa"
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Manual
                      </th>
                      <th
                        v-if="showJasaQtyColumn"
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Qty
                      </th>
                    
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        UoM
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Catatan
                      </th>
                      <th
                        v-if="!isReadOnly"
                        class="px-2 py-2 text-center font-medium text-xs sm:text-sm"
                      >
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr3.length === 0">
                      <td
                        :colspan="showJasaQtyColumn ? (canUseManualJasa ? 8 : 7) : 6"
                        class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                      >
                        Belum ada item dipilih. Klik "Add to List" untuk
                        menambahkan.
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, idx) in detailArr3"
                      :key="detail.id || idx"
                      class="border-t hover:bg-muted/50"
                    >
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ idx + 1 }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.kode }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.nama_jasa }}
                      </td>
                      <td
                        v-if="canUseManualJasa"
                        class="px-3 py-2 text-xs sm:text-sm"
                      >
                        <div class="flex items-center gap-2">
                          <Switch
                            :model-value="!!detail.is_manual"
                            :disabled="loading || isReadOnly"
                            @update:model-value="
                              (checked) => {
                                detail.is_manual = checked;
                                if (checked) detail.qty = 1;
                                syncJasaDetailsWithJenis();
                              }
                            "
                          />
                          <span class="text-xs sm:text-sm">
                            {{ detail.is_manual ? 'Manual' : 'Qty' }}
                          </span>
                        </div>
                      </td>
                      <td
                        v-if="showJasaQtyColumn"
                        class="px-3 py-2 text-xs sm:text-sm"
                      >
                        <FieldNumber
                          v-if="!(canUseManualJasa && detail.is_manual)"
                          v-model="detail.qty"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          :min="0"
                          placeholder="0"
                          class="w-24"
                        />
                      </td>
                      
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.uom }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldTextarea
                          v-model="detail.catatan"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          placeholder="Catatan"
                          :rows="2"
                          class="min-w-[220px]"
                        />
                      </td>
                      <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                        <DeleteButton
                          variant="ghost"
                          size="sm"
                          @click="removeDetailArr3(idx)"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AuditInfo
        v-if="(isViewMode || isEditMode) && !isCopyMode"
        :created-by="auditMeta.created_by"
        :created-at="auditMeta.createdAt"
        :updated-by="auditMeta.updated_by"
        :updated-at="auditMeta.updatedAt"
      />

      <!-- ================================================================ -->
      <!-- ACTION BUTTONS -->
      <!-- ================================================================ -->
      <div
        class="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-end sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t sm:border-0 -mx-6 px-6 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:static"
      >
        <Button
          type="button"
          variant="outline"
          @click="handleCancel"
          :disabled="loading"
          class="w-full sm:w-auto"
        >
          {{ isReadOnly ? "Kembali" : "Batal" }}
        </Button>
        <Button
          v-if="!isReadOnly"
          type="button"
          @click="onSave"
          :disabled="loading"
          class="gap-2 w-full sm:w-auto"
        >
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          {{ isEditMode ? "Perbarui" : "Simpan" }}
        </Button>
      </div>
    </form>

    <GlobalDialog
      :open="potongDialogOpen"
      :title="potongDialogTitle"
      :description="potongDialogDescription"
      :type="potongDialogType"
      :confirm-text="potongDialogConfirmText"
      content-class="max-w-4xl"
      :show-cancel="potongDialogType !== 'danger'"
      cancel-text="Batal"
      @confirm="handlePotongDialogConfirm"
      @cancel="handlePotongDialogClose"
      @update:open="(value) => !value && handlePotongDialogClose()"
    >
      <div class="space-y-5">
        <div
          class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3"
          v-if="potongDialogSummary.length > 0"
        >
          <div
            v-for="item in potongDialogSummary"
            :key="item.label"
            class="rounded-xl border border-border/70 bg-muted/30 px-4 py-3"
          >
            <p class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              {{ item.label }}
            </p>
            <p class="mt-1 text-sm font-medium leading-snug text-foreground break-words">
              {{ item.value }}
            </p>
          </div>
        </div>

        <div
          v-if="potongDialogFinishGoods.length > 0"
          class="rounded-xl border border-border/70 overflow-hidden"
        >
          <div class="flex items-center justify-between bg-muted/35 px-4 py-3">
            <div>
              <p class="text-sm font-semibold text-foreground">
                Detail Finish Goods
              </p>
              <p class="text-xs text-muted-foreground">
                Tinjau rincian item hasil potong sebelum melanjutkan.
              </p>
            </div>
            <Badge variant="secondary">
              {{ potongDialogFinishGoods.length }} item
            </Badge>
          </div>

          <div class="max-h-[320px] overflow-auto">
            <table class="w-full min-w-[620px] text-sm">
              <thead class="bg-muted/20 sticky top-0">
                <tr>
                  <th class="px-4 py-3 text-left font-medium text-xs text-muted-foreground uppercase tracking-wide">
                    Nama Item
                  </th>
                  <th class="px-4 py-3 text-right font-medium text-xs text-muted-foreground uppercase tracking-wide">
                    Ukuran
                  </th>
                  <th class="px-4 py-3 text-right font-medium text-xs text-muted-foreground uppercase tracking-wide">
                    Qty
                  </th>
                  <th class="px-4 py-3 text-right font-medium text-xs text-muted-foreground uppercase tracking-wide">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, idx) in potongDialogFinishGoods"
                  :key="`${item.name}-${idx}`"
                  class="border-t border-border/60"
                >
                  <td class="px-4 py-3 align-top text-foreground">
                    {{ item.name }}
                  </td>
                  <td class="px-4 py-3 align-top text-right text-foreground">
                    {{ item.ukuran }}
                  </td>
                  <td class="px-4 py-3 align-top text-right text-foreground">
                    {{ item.qty }}
                  </td>
                  <td class="px-4 py-3 align-top text-right font-medium text-foreground">
                    {{ item.total }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </GlobalDialog>
  </div>
</template>

<style scoped>
.required::after {
  content: " *";
  color: hsl(var(--destructive));
}

/* Hide scrollbar but keep scrollable functionality */
.scrollbar-hide {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}

.scrollbar-hide::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}
</style>
