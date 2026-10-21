<script setup lang="ts">
import { toast } from "vue-sonner";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useStockAdjForm } from "./useStockAdjForm";
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
  companyNameDisplay,
  pageTitle,
  pageDescription,
  values,
  auditMeta,
  isFormReadOnly,
  detailItems,
  isSuperAdminDialogOpen,
  selectedItemIds,
  rackOptions,
  selectedCompanyName,
  resolvedPicName,
  resolvedGudangName,
  onUnitBisnisSelected,
  referensiOptions,
  errors,
  getRakLabelById,
  fetchRackOptionsByGudang,
  removeDetailItem,
  loadOpnameDetailItems,
  handleCompanyChange,
  handleReferensiChange,
  handleStockOpnameValueFull,
  handleGudangChange,
  handleRakChange,
  onSave,
  confirmSuperAdminSave,
  cancelSuperAdminSave,
  handleCancel,
} = useStockAdjForm();
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
    <!-- Form tanpa submit default; penyimpanan melalui tombol onSave -->
    <form class="space-y-6" @submit.prevent>
      <!-- HEADER CARD (tanpa tab) -->
      <Card>
        <CardHeader>
          <CardTitle>Informasi Stock Adjustment</CardTitle>
          <CardDescription>
            Isi data Stock Adjustment dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Company (Unit Bisnis) - Super Admin: Select, User Biasa: Auto dari auth -->
            <FieldSelect
              v-if="isSuperAdmin"
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              v-model="values.m_unit_bisnis_id"
              :errorname="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id || 'Pilih unit bisnis'"
              :required="!isFormReadOnly"
              :disabled="loading || isFormReadOnly"
              :readonly="isFormReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  selectfield: 'id,nama_comp',
                  filter_column_is_active: 'true',
                  join: true,
                },
              }"
              valueField="id"
              displayField="nama_comp"
              placeholder="Pilih unit bisnis"
              :clearable="true"
              @update:modelValue="handleCompanyChange"
              @update:valueFull="onUnitBisnisSelected"
            />
            <!-- Company (auto-fill readonly) untuk Super Admin -->
            <FieldX
              v-if="isSuperAdmin"
              id="company_name_display"
              label="Company"
              :value="selectedCompanyName || '-'"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              hints="Company dari Unit Bisnis yang dipilih"
            />
            <FieldX
              v-else
              id="m_unit_bisnis_display"
              label="Unit Bisnis"
              :value="companyNameDisplay"
              :disabled="true"
              :readonly="true"
              placeholder="Auto dari akun"
              hints="Unit Bisnis dari akun Anda"
            />

            <!-- No. Stock Adjustment (Auto Generated - Readonly) -->
            <FieldX
              id="no_stock_adj"
              label="No. Stok Adjustment"
              v-model="values.no_stock_adj"
              :disabled="true"
              :readonly="true"
              :hints="'Nomor akan digenerate otomatis oleh sistem'"
              placeholder="Auto generate"
            />

            <!-- Tanggal Stock Adjustment -->
            <FieldDate
              id="tgl_adj"
              label="Tanggal"
              v-model="values.tgl_adj"
              :errorname="errors.tgl_adj ? 'failed' : ''"
              :hints="errors.tgl_adj"
              :required="!isFormReadOnly"
              :disabled="loading || isFormReadOnly"
              :readonly="isFormReadOnly"
              placeholder="Pilih tanggal"
            />

            <!-- PIC -->
            <FieldSelect
              id="pic_adj_id"
              label="PIC"
              v-model="values.pic_adj_id"
              :errorname="errors.pic_adj_id ? 'failed' : ''"
              :hints="errors.pic_adj_id || 'Pilih PIC'"
              :required="!isFormReadOnly"
              :disabled="loading || isFormReadOnly"
              :readonly="isFormReadOnly"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_kary`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'nama_kary,kode_kary',
                  filter_column_is_active: true,
                  ...(values.m_unit_bisnis_id
                    ? {
                        filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
                      }
                    : {}),
                },
              }"
              valueField="id"
              displayField="nama_kary"
              :display-value="resolvedPicName"
              placeholder="Pilih PIC"
              :clearable="true"
            />

            <!-- Referensi (Tipe Referensi) -->
            <FieldSelect
              id="tipe_referensi"
              label="Referensi Adjustment"
              v-model="values.tipe_referensi"
              :errorname="errors.tipe_referensi ? 'failed' : ''"
              :hints="errors.tipe_referensi || 'Pilih tipe referensi'"
              :required="!isFormReadOnly"
              :disabled="loading || isFormReadOnly"
              :readonly="isFormReadOnly"
              :options="referensiOptions"
              valueField="id"
              displayField="label"
              placeholder="Pilih referensi"
              :clearable="true"
              @update:modelValue="handleReferensiChange"
            />

            <!-- No. Stok Opname (hanya tampil jika tipe_referensi = OPNAME) -->
            <FieldPopup
              v-if="values.tipe_referensi === 'OPNAME'"
              id="stock_opname_id"
              label="No. Stok Opname"
              v-model="values.stock_opname_id"
              :display-value="values.no_stock_opname_ref"
              :errorname="errors.stock_opname_id ? 'failed' : ''"
              :hints="errors.stock_opname_id || 'Pilih No. Stok Opname'"
              :required="!isFormReadOnly"
              :disabled="loading || isFormReadOnly"
              :readonly="isFormReadOnly"
              @update:valueFull="handleStockOpnameValueFull"
              :api="{
                url: `${API_BASE_URL}/fn/t_stock_opname/getStockOpnameAvailable`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  // include: 'm_gudang,m_kary',
                  mode: 'adjust',
                  searchfield: 'no_stock_opname',
                  filter_column_status: 'APPROVED',
                  ...(values.m_unit_bisnis_id
                    ? {
                        filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
                      }
                    : {}),
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
                    const namaRak = data?.rak_opname?.nama_rak;
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
              display-field="no_stock_opname"
              placeholder="Pilih No. Stok Opname"
              class="w-full"
            />

            <FieldSelect
              id="m_gudang_id"
              label="Warehouse"
              v-model="values.m_gudang_id"
              :errorname="errors.m_gudang_id ? 'failed' : ''"
              :hints="
                errors.m_gudang_id ||
                (values.tipe_referensi === 'OPNAME'
                  ? 'Gudang terisi otomatis dari referensi Opname'
                  : !values.m_unit_bisnis_id
                    ? 'Pilih Unit Bisnis terlebih dahulu'
                    : 'Pilih gudang')
              "
              :required="!isFormReadOnly"
              :disabled="
                loading ||
                isFormReadOnly ||
                !values.m_unit_bisnis_id ||
                values.tipe_referensi === 'OPNAME'
              "
              :readonly="isFormReadOnly"
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
                  filter_column_is_gudang_transit: false,
                },
              }"
              valueField="id"
              displayField="nama_gudang"
              :display-value="resolvedGudangName"
              placeholder="Pilih gudang"
              :clearable="true"
              @update:modelValue="handleGudangChange"
            />

            <!-- Rak (Master Rak) -->
            <FieldX
              v-if="isFormReadOnly"
              id="m_rak_id_view"
              label="Rak"
              :value="getRakLabelById(values.m_rak_id)"
              :readonly="true"
              :disabled="true"
            />
            <FieldSelect
              v-else
              id="m_rak_id"
              label="Rak"
              v-model="values.m_rak_id"
              :errorname="errors.m_rak_id ? 'failed' : ''"
              :hints="
                errors.m_rak_id ||
                (values.tipe_referensi === 'OPNAME'
                  ? 'Rak terisi otomatis dari referensi Opname'
                  : !values.m_gudang_id
                    ? 'Pilih Gudang terlebih dahulu'
                    : rackOptions.length === 0
                      ? 'Tidak ada rak tersedia untuk gudang ini'
                      : 'Pilih rak')
              "
              :required="!isFormReadOnly"
              :disabled="
                loading ||
                !values.m_gudang_id ||
                isFormReadOnly ||
                values.tipe_referensi === 'OPNAME' ||
                rackOptions.length === 0
              "
              :options="rackOptions"
              displayField="label"
              valueField="id"
              placeholder="Pilih rak"
              :clearable="true"
              @update:modelValue="handleRakChange"
            />

            <!-- Status (readonly, default DRAFT) -->
            <FieldX
              id="status"
              label="Status"
              :value="values.status"
              :disabled="loading"
              :readonly="true"
              placeholder="Status"
              hints="Status akan otomatis berubah sesuai proses"
            />

            <!-- Catatan (spanning 2 columns) -->
            <div class="md:col-span-2">
              <FieldTextarea
                id="catatan"
                label="Catatan"
                v-model="values.catatan"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="Catatan tambahan untuk Stock Adjustment ini"
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

        <!-- TAB: DETAIL ITEMS (t_stock_adj_details) -->
        <TabsContent value="items" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Items Stock Adjustment</CardTitle>
                  <CardDescription>
                    {{
                      values.m_gudang_id
                        ? "Kelola item untuk stock adjustment"
                        : "Pilih Gudang terlebih dahulu untuk memilih items"
                    }}
                  </CardDescription>
                </div>
                <!-- OPNAME: item otomatis dari detail stock opname -->
                <div
                  v-if="!isFormReadOnly && values.tipe_referensi === 'OPNAME'"
                  class="text-xs text-muted-foreground border rounded-md px-3 py-2"
                >
                  Item akan otomatis dimuat dari Stock Opname terpilih.
                </div>

                <!-- ADJUSTMENT: fetch dari stock gudang -->
                <ButtonMultiSelect
                  v-else-if="
                    !isFormReadOnly && values.tipe_referensi === 'ADJUSTMENT'
                  "
                  title="Pilih Items"
                  @add="
                    (items: any[]) => {
                      items.forEach((item) => {
                        if (
                          !detailItems.find(
                            (d: any) =>
                              d.m_items_id === item.m_items_id &&
                              d.m_rak_d_id === (item.m_rak_d_id || null),
                          )
                        ) {
                          const stockGudangId = item.id || item.stock_gudang_id || '';
                          const newItem: any = {
                            m_items_id: item.m_items_id,
                            stock_gudang_id: stockGudangId,
                            m_rak_d_id: item.m_rak_d_id || null,
                            kode_rak_d:
                              item.kode_rak_d || item.m_rak_d?.kode || '-',
                            batch: item.batch || '',
                            is_batch: Boolean(item.is_batch),
                            qty_before: item.free_stock || 0,
                            qty_after: 0,
                            qty_adj: 0,
                            alasan_opname: '',
                            catatan_adj: '',
                            created_by: authStore.user?.id || '',
                            kode_item: item.kode_item,
                            nama_item: item.nama_item,
                            uom:
                              item.uom ||
                              item.uom_name ||
                              item.uom?.value1 ||
                              '',
                          };
                          detailItems.push(newItem);
                          if (!newItem.batch && stockGudangId) {
                            fetch(`${API_BASE_URL}/fn/stock_gudang/getBatchesByStockGudang?stock_gudang_id=${stockGudangId}`, {
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` }
                            }).then(r => r.json()).then(res => {
                              if (res.status === 'success' && Array.isArray(res.data) && res.data.length > 0) {
                                const b = res.data[0];
                                newItem.batch = typeof b === 'string' ? b : (b?.batch || '');
                              }
                            }).catch(() => {});
                          }
                        }
                      });
                      toast.success(`${items.length} item ditambahkan`);
                    }
                  "
                  :api="{
                    url: `${API_BASE_URL}/fn/stock_gudang/stock_item`,
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authStore.token}`,
                    },
                    params: {
                      gudang_id: values.m_gudang_id,
                      filter_column_is_opname: false,
                      searchfield: 'kode_item,nama_item,tipe_name,kode_rak_d,batch',
                      no_pagination: 'false',
                      ...(values.m_rak_id ? { m_rak_id: values.m_rak_id } : {}),
                    },
                    onsuccess: (response: any) => {
                      const groups = Array.isArray(response.data)
                        ? response.data
                        : [];
                      response.data = groups.flatMap((group: any) =>
                        (group.items || []).map((item: any) => ({
                          ...item,
                          m_rak_d_id: group.m_rak_d_id,
                          kode_rak_d:
                            group.kode_rak_d || group.nama_rak_master || '-',
                        })),
                      );
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
                      width: '220px',
                      sortable: true,
                      filterable: true,
                    },
                    {
                      field: 'kode_rak_d',
                      headerName: 'Kode Rak Detail',
                      width: '140px',
                      sortable: false,
                      filterable: false,
                      valueGetter: ({ data }: any) =>
                        data?.kode_rak_d || data?.m_rak_d?.kode || '-',
                    },
                    {
                      field: 'batch',
                      headerName: 'Batch',
                      width: '150px',
                      sortable: true,
                      filterable: true,
                      valueGetter: ({ data }: any) => data?.batch || '-',
                    },
                    {
                      field: 'free_stock',
                      headerName: 'Stock',
                      width: '100px',
                      sortable: true,
                      filterable: false,
                    },
                    {
                      field: 'uom_name',
                      headerName: 'Satuan',
                      width: '100px',
                    },
                  ]"
                  :excludeIds="selectedItemIds"
                  uniqueKey="id"
                  :disabled="loading || !values.m_gudang_id"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
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
                        Kode Rak Detail
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Batch
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Qty Before
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Qty After
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Qty Adj.
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Satuan
                      </th>
                      <th
                        v-if="values.tipe_referensi === 'OPNAME'"
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Catatan Opname
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Catatan Adj.
                      </th>
                      <th
                        v-if="
                          !isFormReadOnly && values.tipe_referensi !== 'OPNAME'
                        "
                        class="px-2 py-2 text-center font-medium text-xs sm:text-sm"
                      >
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailItems.length === 0">
                      <td
                        :colspan="values.tipe_referensi === 'OPNAME' ? 11 : 10"
                        class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                      >
                        {{
                          values.tipe_referensi === "OPNAME"
                            ? "Belum ada item dari Stock Opname yang dipilih."
                            : 'Belum ada item. Pilih Gudang terlebih dahulu, lalu klik "Pilih Items" untuk menambahkan.'
                        }}
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, idx) in detailItems"
                      :key="detail.m_items_id || idx"
                      class="border-t hover:bg-muted/50"
                    >
                      <td
                        class="px-3 py-2 text-xs sm:text-sm whitespace-nowrap"
                      >
                        {{ idx + 1 }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.kode_item || "-" }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.nama_item || "-" }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.kode_rak_d || "-" }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm font-mono">
                        {{ detail.batch || "-" }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <span>{{ detail.qty_before }}</span>
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <span
                          v-if="
                            isFormReadOnly || values.tipe_referensi === 'OPNAME'
                          "
                          >{{ detail.qty_after }}</span
                        >
                        <FieldNumber
                          v-else
                          v-model="detail.qty_after"
                          :min="0"
                          placeholder="0"
                          class="w-28"
                          @update:modelValue="
                            () => {
                              detail.qty_adj =
                                (detail.qty_after || 0) -
                                (detail.qty_before || 0);
                            }
                          "
                        />
                      </td>
                      <td
                        class="px-3 py-2 text-xs sm:text-sm font-medium"
                        :class="{
                          'text-destructive': detail.qty_adj < 0,
                          'text-green-600': detail.qty_adj > 0,
                          'text-muted-foreground': detail.qty_adj === 0,
                        }"
                      >
                        {{ detail.qty_adj }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.uom || "-" }}
                      </td>
                      <td
                        v-if="values.tipe_referensi === 'OPNAME'"
                        class="px-3 py-2 text-xs sm:text-sm"
                      >
                        <span>{{ detail.alasan_opname || "-" }}</span>
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldX
                          v-if="!isReadOnly"
                          v-model="detail.catatan_adj"
                          placeholder="Catatan adj."
                          class="w-40"
                        />
                        <span v-else>{{ detail.catatan_adj || "-" }}</span>
                      </td>
                      <td
                        v-if="
                          !isFormReadOnly && values.tipe_referensi !== 'OPNAME'
                        "
                        class="px-2 py-2 text-center"
                      >
                        <DeleteButton
                          variant="ghost"
                          size="sm"
                          @click="removeDetailItem(idx)"
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

    <!-- ================================================================ -->
    <!-- SUPER ADMIN CONFIRMATION DIALOG -->
    <!-- ================================================================ -->
    <Dialog
      :open="isSuperAdminDialogOpen"
      @update:open="isSuperAdminDialogOpen = $event"
    >
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2">
            <span class="text-yellow-600">⚠️</span>
            Konfirmasi Super Admin
          </DialogTitle>
          <DialogDescription>
            Anda login sebagai
            <span class="font-semibold text-primary">SUPER ADMIN</span>.
          </DialogDescription>
        </DialogHeader>

        <div class="py-4 space-y-4">
          <div
            class="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg"
          >
            <p class="text-sm text-yellow-800 dark:text-yellow-200">
              Data yang Anda {{ isEditMode ? "perbarui" : "buat" }} akan
              langsung memiliki status
              <span class="font-bold text-green-600 dark:text-green-400"
                >APPROVED</span
              >
              tanpa melalui proses approval.
            </p>
          </div>

          <div class="space-y-2 text-sm text-muted-foreground">
            <p>Informasi:</p>
            <ul class="list-disc list-inside space-y-1 ml-2">
              <li>
                Status akan langsung
                <span class="font-semibold text-green-600">APPROVED</span>
              </li>
              <li>Tidak perlu menunggu approval dari atasan</li>
              <li>Data dapat langsung digunakan untuk proses selanjutnya</li>
            </ul>
          </div>
        </div>

        <DialogFooter class="gap-2">
          <Button
            variant="outline"
            @click="cancelSuperAdminSave"
            :disabled="loading"
          >
            Batal
          </Button>
          <Button
            variant="default"
            @click="confirmSuperAdminSave"
            :disabled="loading"
            class="gap-2 bg-green-600 hover:bg-green-700"
          >
            <Save class="h-4 w-4" />
            <span>{{
              loading ? "Menyimpan..." : "Ya, Simpan dengan APPROVED"
            }}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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