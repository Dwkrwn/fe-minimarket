<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FieldX,
  FieldNumber,
  FieldSelect,
  FieldDate,
  FieldTextarea,
  FieldPopup,
} from "@/components/field";
import { ButtonMultiSelect, DeleteButton } from "@/components/button";
import { ArrowLeft, Save, Loader2 } from "lucide-vue-next";
import { useTransferGudangForm } from "./useTransferGudangForm";
import AuditInfo from "@/components/AuditInfo.vue";

const {
  authStore,
  API_BASE_URL,
  loading,
  isEditMode,
  isViewMode,
  isCopyMode,
  isReadOnly,
  isSuperAdmin,
  unitBisnisNameDisplay,
  selectedCompanyNameDisplay,
  pageTitle,
  pageDescription,
  values,
  auditMeta,
  detailItems,
  warehouseAsalDisplay,
  transferTypeOptions,
  isTypeLangsung,
  isTypeOpname,
  isSameWarehouse,
  warehouseTujuanDisplay,
  opnameRakDisplayValue,
  opnameNoDisplay,
  selectedItemIds,
  removeDetailItem,
  getRakAsalName,
  getRakAsalDetail,
  handleUnitBisnisSelected,
  handleStockOpnameSelect,
  handleWarehouseAsalSelect,
  getRakTujuanApiConfig,
  getRakTujuanDetailApiConfig,
  errors,
  onSave,
  handleCancel,
} = useTransferGudangForm();
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
    <!-- ================================================================ -->
    <!-- HEADER SECTION -->
    <!-- ================================================================ -->
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

    <!-- ================================================================ -->
    <!-- FORM SECTION -->
    <!-- ================================================================ -->
    <form class="space-y-6" @submit.prevent>
      <!-- HEADER CARD -->
      <Card>
        <CardHeader>
          <CardTitle>Informasi Transfer Gudang</CardTitle>
          <CardDescription>
            Isi data Transfer Gudang dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 3 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Company (Unit Bisnis) - Super Admin: Select, User Biasa: Auto dari auth -->
            <FieldSelect
              v-if="isSuperAdmin"
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              v-model="values.m_unit_bisnis_id"
              :errorname="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id || 'Pilih unit bisnis'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  join: 'true',
                  filter_column_is_active: 'true',
                },
              }"
              @update:valueFull="handleUnitBisnisSelected"
              valueField="id"
              displayField="nama_comp"
              placeholder="Pilih unit bisnis"
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
              hints="Unit Bisnis dari akun Anda"
            />

            <FieldX
              id="company_display"
              label="Company"
              :value="selectedCompanyNameDisplay"
              :disabled="true"
              :readonly="true"
              placeholder="Company dari Unit Bisnis"
              hints="Company otomatis dari Unit Bisnis yang dipilih"
            />

            <!-- No. Transfer Gudang (Auto Generated - Readonly) -->
            <FieldX
              id="no_tw"
              label="No. Transfer Gudang"
              v-model="values.no_tw"
              :disabled="true"
              :readonly="true"
              :hints="'Nomor akan digenerate otomatis oleh sistem'"
              placeholder="Auto generate"
            />

            <!-- Status (readonly, default DRAFT) -->
            <FieldX
              id="status"
              label="Status"
              :value="values.status"
              :disabled="loading"
              :readonly="true"
              placeholder="Status Transfer"
              hints="Status akan otomatis berubah sesuai proses"
            />

            <!-- Tanggal Transfer -->
            <FieldDate
              id="tgl_tw"
              label="Tanggal Transfer"
              v-model="values.tgl_tw"
              :errorname="errors.tgl_tw ? 'failed' : ''"
              :hints="errors.tgl_tw"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih tanggal transfer"
            />

            <!-- PIC (Person In Charge) -->
            <FieldSelect
              id="pic_id"
              label="PIC (Person In Charge)"
              v-model="values.pic_id"
              :errorname="errors.pic_id ? 'failed' : ''"
              :hints="errors.pic_id || 'Pilih karyawan sebagai PIC'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_kary`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  // selectfield: 'id,nama_kary,kode_kary',
                  filter_column_is_active: 'true',
                  filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
                },
              }"
              valueField="id"
              displayField="nama_kary"
              placeholder="Pilih PIC"
              :clearable="true"
            />

            <!--- Tipe Transfer Gudang -->
            <FieldSelect
              id="type"
              label="Type Transfer"
              v-model="values.type"
              :options="transferTypeOptions"
              valueField="value"
              displayField="label"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :required="!isReadOnly"
              :errorname="errors.type ? 'failed' : ''"
              :hints="errors.type || 'Pilih type transfer gudang'"
              placeholder="Pilih type transfer gudang"
              :clearable="false"
            />

            <FieldX
              v-if="isTypeOpname && isReadOnly"
              id="opname_id_info"
              label="No. Stock Opname"
              :value="opnameNoDisplay || '-'"
              :disabled="true"
              :readonly="true"
              hints="Referensi stock opname"
            />

            <FieldPopup
              v-else-if="isTypeOpname"
              id="opname_id"
              label="No. Stock Opname"
              v-model="values.opname_id"
              :display-value="opnameNoDisplay"
              @update:valueFull="handleStockOpnameSelect"
              :errorText="errors.opname_id ? 'failed' : ''"
              :hints="
                errors.opname_id ||
                (!values.m_unit_bisnis_id
                  ? 'Pilih Unit Bisnis terlebih dahulu'
                  : 'Pilih data stock opname, Gudang Asal akan terisi otomatis')
              "
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || !values.m_unit_bisnis_id"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              :api="{
                url: `${API_BASE_URL}/fn/t_stock_opname/getStockOpnameAvailable`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  mode: 'tw',
                  searchfield: 'no_stock_opname',
                  // filter_column_status: 'APPROVED',
                  filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page
                    ? true
                    : false;
                  return response;
                },
              }"
              :columns="[
                {
                  field: 'no_stock_opname',
                  headerName: 'No. Stock Opname',
                  width: '200px',
                },
                {
                  field: 'tgl_opname',
                  headerName: 'Tgl Opname',
                  width: '130px',
                },
                {
                  field: 'gudang',
                  headerName: 'Gudang',
                  width: '160px',
                  valueGetter: ({ data }: any) =>
                    data?.m_gudang?.nama_gudang ||
                    data?.gudang_opname?.nama_gudang ||
                    '-',
                },
                {
                  field: 'rak',
                  headerName: 'Rak',
                  width: '180px',
                  valueGetter: ({ data }: any) => {
                    const namaRak =
                      data?.rak_opname?.nama_rak || data?.m_rak?.nama_rak;
                    if (namaRak) return `${namaRak}`;
                    return '-';
                  },
                },
                {
                  field: 'pic',
                  headerName: 'PIC',
                  width: '150px',
                  valueGetter: ({ data }: any) =>
                    data?.m_kary?.nama_kary ||
                    data?.pic_opname?.nama_kary ||
                    '-',
                },
                { field: 'status', headerName: 'Status', width: '120px' },
              ]"
              valueField="id"
              displayField="no_stock_opname"
              placeholder="Pilih no. stock opname"
            />

            <!-- Warehouse Asal -->
            <FieldSelect
              v-if="isTypeLangsung"
              id="warehouse_asal_id"
              label="Gudang Asal"
              v-model="values.warehouse_asal_id"
              @update:valueFull="handleWarehouseAsalSelect"
              :errorname="errors.warehouse_asal_id ? 'failed' : ''"
              :hints="
                errors.warehouse_asal_id ||
                (!values.m_unit_bisnis_id
                  ? 'Pilih Unit Bisnis terlebih dahulu'
                  : 'Pilih gudang asal')
              "
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || !values.m_unit_bisnis_id"
              :readonly="isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_gudang`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  selectfield: 'id,nama_gudang,kode_gudang',
                  filter_column_is_active: 'true',
                  filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
                },
              }"
              valueField="id"
              displayField="nama_gudang"
              placeholder="Pilih gudang asal"
              :clearable="true"
            />

            <FieldX
              v-else
              id="warehouse_asal_info"
              label="Gudang Asal"
              :value="warehouseAsalDisplay || '-'"
              :disabled="true"
              :readonly="true"
              :hints="
                values.opname_id
                  ? 'Auto dari stock opname terpilih'
                  : 'Pilih stock opname terlebih dahulu'
              "
            />

            <!-- Warehouse Tujuan -->
            <FieldSelect
              v-if="isTypeLangsung"
              id="warehouse_tujuan_id"
              label="Gudang Tujuan"
              v-model="values.warehouse_tujuan_id"
              :errorname="errors.warehouse_tujuan_id ? 'failed' : ''"
              :hints="errors.warehouse_tujuan_id || 'Pilih gudang tujuan'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_gudang`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  selectfield: 'id,nama_gudang,kode_gudang',
                  filter_column_is_active: 'true',
                  filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
                  filter_column_is_gudang_transit: 'false'
                },
              }"
              valueField="id"
              displayField="nama_gudang"
              placeholder="Pilih gudang tujuan"
              :clearable="true"
            />

            <FieldX
              v-else
              id="warehouse_tujuan_info"
              label="Gudang Tujuan"
              :value="warehouseTujuanDisplay"
              :disabled="true"
              :readonly="true"
              hints="Untuk type opname, gudang tujuan mengikuti gudang asal"
            />

            <FieldX
              v-if="isTypeOpname"
              id="rak_asal_info"
              label="Rak Asal Opname"
              :value="opnameRakDisplayValue"
              :disabled="true"
              :readonly="true"
              hints="Rak dari referensi opname"
            />

            <!-- Catatan (spanning 2 columns) -->
            <div class="md:col-span-2">
              <FieldTextarea
                id="catatan"
                label="Catatan"
                v-model="values.catatan"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="Catatan tambahan untuk Transfer Gudang ini"
                :rows="3"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- DETAIL TABS -->
      <Tabs default-value="items" class="w-full">
        <TabsList
          class="w-full overflow-x-auto flex justify-start scrollbar-hide"
        >
          <TabsTrigger value="items">Detail Items</TabsTrigger>
        </TabsList>

        <!-- TAB: DETAIL ITEMS (t_transfer_gudang_ds) -->
        <TabsContent value="items" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Items Transfer Gudang</CardTitle>
                  <CardDescription>
                    {{
                      values.warehouse_asal_id
                        ? "Kelola item yang akan ditransfer"
                        : "Pilih Gudang Asal terlebih dahulu untuk memilih items"
                    }}
                  </CardDescription>
                </div>
                <ButtonMultiSelect
                  v-if="!isReadOnly"
                  title="Pilih Items"
                  @add="
                    (items: any[]) => {
                      items.forEach((item) => {
                        if (
                          !detailItems.find(
                            (d: any) => d.m_items_id === item.m_items_id,
                          )
                        ) {
                          const newRow = reactive({
                            m_items_id: item.m_items_id,
                            qty: 1,
                            batch: item.batch || '',
                            is_batch: Boolean(item.is_batch),
                            stock_gudang_id: item.id || '',
                            rak_tujuan: '',
                            rak_tujuan_d_id: '',
                            catatan: '',
                            created_by: authStore.user?.id || '',
                            // Untuk display (data sudah flat dari API)
                            free_stock: item.free_stock,
                            kode_item: item.kode_item,
                            nama_item: item.nama_item,
                            uom: item.uom || item.uom_name,
                            m_rak_id: item.m_rak_id || '',
                            m_rak_d_id: item.m_rak_d_id || '',
                            nama_rak_master:
                              item.nama_rak_master || 'Tanpa Rak',
                            kode_rak_d: item.kode_rak_d || 'Tanpa Rak',
                          });
                          detailItems.push(newRow);

                          if (newRow.is_batch && newRow.stock_gudang_id && !newRow.batch) {
                            fetch(`${API_BASE_URL}/fn/stock_gudang/getBatchesByStockGudang?stock_gudang_id=${newRow.stock_gudang_id}`, {
                              headers: { Authorization: `Bearer ${authStore.token}` },
                            })
                              .then((r) => r.json())
                              .then((res) => {
                                if (res.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
                                  newRow.batch = res.data[0].batch;
                                }
                              })
                              .catch(() => {});
                          }
                        }
                      });
                    }
                  "
                  :api="{
                    url: `${API_BASE_URL}/fn/stock_gudang/stock_item`,
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authStore.token}`,
                    },
                    params: {
                      gudang_id: values.warehouse_asal_id,
                      filter_column_is_opname: false,
                      searchfield: 'kode_item,nama_item,tipe_name,kode_rak_d',
                      no_pagination: 'false',
                    },
                    onsuccess: (response: any) => {
                      const groupedData = Array.isArray(response?.data)
                        ? response.data
                        : [];

                      response.data = groupedData.flatMap((group: any) => {
                        const groupItems = Array.isArray(group?.items)
                          ? group.items
                          : [];

                        return groupItems
                          .filter((item: any) => Number(item?.free_stock) > 0)
                          .map((item: any) => ({
                            ...item,
                            // Keep rack metadata from group level so the row remains self-contained.
                            m_rak_d_id: group?.m_rak_d_id ?? null,
                            m_rak_id: group?.m_rak_id ?? null,
                            kode_rak_d: group?.kode_rak_d || 'Tanpa Rak',
                            nama_rak_master:
                              group?.nama_rak_master || 'Tanpa Rak',
                            uom: item?.uom_name || item?.uom || '-',
                          }));
                      });

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
                      width: '250px',
                      sortable: true,
                      filterable: true,
                    },
                    {
                      field: 'tipe_name',
                      headerName: 'Tipe Item',
                      width: '130px',
                      sortable: true,
                      filterable: true,
                    },
                    {
                      field: 'nama_rak_master',
                      headerName: 'Rak Asal',
                      width: '140px',
                      sortable: true,
                      filterable: true,
                    },
                    {
                      field: 'kode_rak_d',
                      headerName: 'Kode Rak Detail',
                      width: '140px',
                      sortable: true,
                      filterable: true,
                      valueGetter: ({ data }: any) =>
                        data?.kode_rak_d ||
                        data?.m_rak_d?.kode ||
                        data?.rak_kode ||
                        '-',
                    },
                    {
                      field: 'free_stock',
                      headerName: 'Stock',
                      width: '100px',
                      sortable: true,
                      filterable: false,
                    },
                  ]"
                  :excludeIds="selectedItemIds"
                  :disabled="
                    loading || isTypeOpname || !values.warehouse_asal_id
                  "
                />
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-auto max-h-[70vh]">
                <Table class="min-w-[1650px] [&_th]:whitespace-nowrap [&_td]:align-top">
                  <TableHeader>
                    <TableRow>
                      <TableHead class="w-12">No</TableHead>
                      <TableHead class="w-24">Kode</TableHead>
                      <TableHead class="w-64">Nama Item</TableHead>
                      <TableHead class="w-64">Rak Asal</TableHead>
                      <TableHead class="w-64">Rak Asal Detail</TableHead>
                      <TableHead class="w-36">Batch</TableHead>
                      <TableHead v-if="isTypeLangsung" class="w-28"
                        >Stock</TableHead
                      >
                      <TableHead v-if="isTypeOpname" class="w-28"
                        >Qty System</TableHead
                      >
                      <TableHead v-if="isTypeOpname" class="w-28"
                        >Qty Opname</TableHead
                      >
                      <!-- <TableHead v-if="isTypeOpname" class="w-28"
                        >Qty Selisih</TableHead
                      > -->
                      <TableHead class="w-32">Qty</TableHead>
                      <TableHead v-if="isSameWarehouse" class="w-64"
                        >Rak Tujuan</TableHead
                      >
                      <TableHead v-if="isSameWarehouse" class="w-64"
                        >Rak Tujuan Detail</TableHead
                      >
                      <TableHead class="w-[320px]">Catatan</TableHead>
                      <TableHead v-if="!isReadOnly && isTypeLangsung" class="w-20 text-center"
                        >Aksi</TableHead
                      >
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-if="detailItems.length === 0">
                      <TableCell
                        :colspan="
                          (!isReadOnly
                            ? isSameWarehouse
                              ? isTypeLangsung
                                ? 12
                                : 11
                              : isTypeLangsung
                                ? 10
                                : 9
                            : isSameWarehouse
                              ? isTypeLangsung
                                ? 11
                                : 10
                              : isTypeLangsung
                                ? 9
                                : 8) + (isTypeOpname ? 3 : 0)
                        "
                        class="text-center py-16 text-muted-foreground"
                      >
                        <div
                          class="flex flex-col items-center justify-center gap-2"
                        >
                          <p class="text-sm">Belum ada item dipilih</p>
                          <p class="text-xs">
                            Pilih Gudang Asal terlebih dahulu, lalu klik tombol
                            "Pilih Items"
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                    <TableRow
                      v-for="(detail, idx) in detailItems"
                      :key="`${detail.m_items_id || 'item'}-${detail.m_rak_d_id || detail.rak_asal_d_id || 'rak'}-${idx}`"
                      class="hover:bg-muted/50"
                    >
                      <TableCell>{{ idx + 1 }}</TableCell>
                      <TableCell>{{ detail.kode_item || "-" }}</TableCell>
                      <TableCell>{{ detail.nama_item || "-" }}</TableCell>
                      <TableCell>{{ getRakAsalName(detail) }}</TableCell>
                      <TableCell>{{ getRakAsalDetail(detail) }}</TableCell>
                      <TableCell>
                        <span
                          v-if="detail.is_batch"
                          class="font-mono text-xs bg-muted px-2 py-1 rounded"
                        >
                          {{ detail.batch || "-" }}
                        </span>
                        <span v-else class="text-muted-foreground text-xs">
                          -
                        </span>
                      </TableCell>
                      <TableCell v-if="isTypeLangsung">
                        <span class="text-sm text-muted-foreground">
                          {{
                            detail.free_stock !== undefined &&
                            detail.free_stock !== null &&
                            detail.free_stock !== ""
                              ? detail.free_stock
                              : "-"
                          }}
                        </span>
                      </TableCell>
                      <TableCell v-if="isTypeOpname">
                        <span class="text-sm text-muted-foreground">
                          {{
                            detail.qty_system !== undefined &&
                            detail.qty_system !== null
                              ? detail.qty_system
                              : "-"
                          }}
                        </span>
                      </TableCell>
                      <TableCell v-if="isTypeOpname">
                        <span class="text-sm text-muted-foreground">
                          {{
                            detail.qty_opname !== undefined &&
                            detail.qty_opname !== null
                              ? detail.qty_opname
                              : "-"
                          }}
                        </span>
                      </TableCell>
                      <!-- <TableCell v-if="isTypeOpname">
                        <span class="text-sm text-muted-foreground">
                          {{
                            detail.qty_selisih !== undefined &&
                            detail.qty_selisih !== null
                              ? detail.qty_selisih
                              : "-"
                          }}
                        </span>
                      </TableCell> -->
                      <TableCell>
                        <FieldNumber
                          v-model="detail.qty"
                          :disabled="loading || isReadOnly || isTypeOpname"
                          :readonly="isReadOnly || isTypeOpname"
                          :min="1"
                          :max="Number(detail.free_stock) || 999999"
                          placeholder="0"
                        />
                      </TableCell>

                      <TableCell v-if="isSameWarehouse">
                        <FieldX
                          v-if="isTypeOpname"
                          :value="
                            detail.nama_rak_tujuan || detail.rak_tujuan || '-'
                          "
                          :disabled="true"
                          :readonly="true"
                        />
                        <FieldSelect
                          v-else
                          v-model="detail.rak_tujuan"
                          :required="!isReadOnly && isSameWarehouse"
                          :disabled="
                            loading ||
                            isReadOnly ||
                            isTypeOpname ||
                            (isTypeLangsung
                              ? !values.warehouse_tujuan_id || !isSameWarehouse
                              : !values.warehouse_asal_id)
                          "
                          :readonly="isReadOnly || isTypeOpname"
                          :hints="
                            isTypeLangsung
                              ? !values.warehouse_tujuan_id
                                ? 'Pilih Gudang Tujuan terlebih dahulu'
                                : !isSameWarehouse
                                  ? 'Rak tujuan dipilih jika Gudang Asal dan Tujuan sama'
                                  : ''
                              : !values.warehouse_asal_id
                                ? 'Pilih Gudang Asal terlebih dahulu'
                                : ''
                          "
                          :api="getRakTujuanApiConfig(detail)"
                          valueField="id"
                          displayField="nama_rak"
                          @update:modelValue="
                            () => {
                              detail.rak_tujuan_d_id = '';
                            }
                          "
                          placeholder="Pilih rak tujuan"
                          :clearable="true"
                        />
                      </TableCell>

                      <TableCell v-if="isSameWarehouse">
                        <FieldX
                          v-if="isTypeOpname"
                          :value="
                            detail.kode_rak_tujuan_d ||
                            detail.rak_tujuan_d?.kode ||
                            detail.rak_tujuan_d_id ||
                            '-'
                          "
                          :disabled="true"
                          :readonly="true"
                        />
                        <FieldSelect
                          v-else
                          v-model="detail.rak_tujuan_d_id"
                          :required="!isReadOnly && isSameWarehouse"
                          :disabled="
                            loading ||
                            isReadOnly ||
                            isTypeOpname ||
                            !detail.rak_tujuan
                          "
                          :readonly="isReadOnly || isTypeOpname"
                          :hints="
                            !detail.rak_tujuan
                              ? 'Pilih Rak Tujuan terlebih dahulu'
                              : ''
                          "
                          :api="getRakTujuanDetailApiConfig(detail)"
                          valueField="id"
                          displayField="kode"
                          placeholder="Pilih rak tujuan detail"
                          :clearable="true"
                        />
                      </TableCell>

                      <TableCell class="min-w-[320px]">
                        <textarea
                          v-model="detail.catatan"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          placeholder="Catatan item"
                          class="w-full min-w-[280px] h-20 max-h-40 overflow-y-auto resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </TableCell>
                      <TableCell v-if="!isReadOnly && isTypeLangsung" class="text-center">
                        <DeleteButton
                          variant="ghost"
                          size="sm"
                          @click="removeDetailItem(idx)"
                        />
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
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
