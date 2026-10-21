<script setup lang="ts">
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
} from "@/components/field";
import { ButtonMultiSelect, DeleteButton } from "@/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Save, Loader2 } from "lucide-vue-next";
import { useStockOpnameForm } from "./useStockOpnameForm";
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
  errors,
  detailItems,
  isSuperAdminDialogOpen,
  selectedItemIds,
  rackOptions,
  selectedCompanyName,
  onUnitBisnisSelected,
  getRakLabelById,
  fetchRackOptionsByGudang,
  removeDetailItem,
  onSave,
  confirmSuperAdminSave,
  cancelSuperAdminSave,
  handleCancel,
} = useStockOpnameForm();
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
          <CardTitle>Informasi Stock Opname</CardTitle>
          <CardDescription>
            Isi data Stock Opname dengan lengkap dan benar
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
                  searchfield: 'nama_comp',
                  filter_column_is_active: true,
                  join: true,
                  paginate: 999,
                },
              }"
              valueField="id"
              displayField="nama_comp"
              placeholder="Pilih unit bisnis"
              :clearable="true"
              @update:modelValue="
                () => {
                  values.m_gudang_id = '';
                  values.m_rak_id = '';
                  values.pic_opname_id = '';
                  fetchRackOptionsByGudang('');
                }
              "
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
              id="m_unit_bisnis_id_display"
              label="Unit Bisnis"
              :value="companyNameDisplay"
              :disabled="true"
              :readonly="true"
              placeholder="-"
              hints="Unit Bisnis dari akun Anda"
            />

            <!-- No. Stock Opname (Auto Generated - Readonly) -->
            <FieldX
              id="no_stock_opname"
              label="No. Stock Opname"
              :value="values.no_stock_opname || 'Auto generate'"
              :disabled="true"
              :readonly="true"
              placeholder="Auto generate"
            />

            <!-- Tanggal Stock Opname -->
            <FieldDate
              id="tgl_opname"
              label="Tgl Stock Opname"
              v-model="values.tgl_opname"
              :errorname="errors.tgl_opname ? 'failed' : ''"
              :hints="errors.tgl_opname || 'Pilih tanggal stock opname'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih tanggal stock opname"
            />

            <!-- PIC (Person In Charge) -->
            <FieldSelect
              id="pic_opname_id"
              label="PIC"
              v-model="values.pic_opname_id"
              :errorname="errors.pic_opname_id ? 'failed' : ''"
              :hints="errors.pic_opname_id || 'Pilih PIC'"
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
              placeholder="Pilih PIC"
              :clearable="true"
            />

            <!-- Warehouse -->
            <FieldSelect
              id="m_gudang_id"
              label="Warehouse"
              v-model="values.m_gudang_id"
              :errorname="errors.m_gudang_id ? 'failed' : ''"
              :hints="
                errors.m_gudang_id ||
                (!values.m_unit_bisnis_id
                  ? 'Pilih Unit Bisnis terlebih dahulu'
                  : 'Pilih gudang')
              "
              :required="!isReadOnly"
              :disabled="
                loading ||
                isReadOnly ||
                isEditMode ||
                !values.m_unit_bisnis_id
              "
              :readonly="isReadOnly || isEditMode"
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
              placeholder="Pilih gudang"
              :clearable="true"
              @update:modelValue="
                (newGudangId: string) => {
                  values.m_rak_id = '';
                  fetchRackOptionsByGudang(newGudangId ?? '');
                }
              "
            />

            <!-- Rak (Master Rak) -->
            <FieldX
              v-if="isReadOnly || isEditMode"
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
                (!values.m_gudang_id
                  ? 'Pilih Gudang terlebih dahulu'
                  : rackOptions.length === 0
                    ? 'Tidak ada rak tersedia untuk gudang ini'
                    : 'Pilih rak')
              "
              :required="!isReadOnly"
              :disabled="
                loading || !values.m_gudang_id || rackOptions.length === 0
              "
              :options="rackOptions"
              displayField="label"
              valueField="id"
              placeholder="Pilih rak"
              :clearable="true"
            />

            <!-- Periode Stock Opname -->
            <FieldSelect
              id="t_stock_opname_periode_id"
              label="Periode Stock Opname"
              v-model="values.t_stock_opname_periode_id"
              :errorname="errors.t_stock_opname_periode_id ? 'failed' : ''"
              :hints="
                errors.t_stock_opname_periode_id ||
                (!values.m_unit_bisnis_id
                  ? 'Pilih Unit Bisnis terlebih dahulu'
                  : 'Pilih periode aktif')
              "
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || !values.m_unit_bisnis_id"
              :readonly="isReadOnly"
              :api="{
                url: `${API_BASE_URL}/fn/t_stock_opname_periode/getAvailable`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'no_periode_opname',
                  filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
                },
              }"
              valueField="id"
              displayField="no_periode_opname"
              placeholder="Pilih periode stock opname"
              :clearable="true"
            />

            <FieldX
              id="status"
              label="Status"
              :value="values.status"
              :disabled="true"
              :readonly="true"
              placeholder="LOCK"
              hints="Status akan otomatis berubah sesuai proses"
            />

            <!-- Catatan (spanning 2 columns) -->
            <div class="md:col-span-2">
              <FieldTextarea
                id="catatan"
                label="Catatan (Opsional)"
                v-model="values.catatan"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="Catatan tambahan untuk stock opname ini"
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

        <!-- TAB: DETAIL ITEMS (t_stock_opname_details) -->
        <TabsContent value="items" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Stock Opname Detail</CardTitle>
                  <CardDescription>
                    {{
                      values.m_gudang_id
                        ? "Kelola item yang akan di stock opname"
                        : "Pilih Gudang terlebih dahulu untuk memilih items"
                    }}
                  </CardDescription>
                </div>
                <div class="flex gap-2" v-if="!isReadOnly">
                  <ButtonMultiSelect
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
                            const stockGudangId = item.id || item.stock_gudang_id || null;
                            const newItem: any = {
                              m_items_id: item.m_items_id,
                              stock_gudang_id: stockGudangId,
                              m_rak_d_id: item.m_rak_d_id || null,
                              kode_rak_d:
                                item.kode_rak_d || item.m_rak_d?.kode || '-',
                              batch: item.batch || '',
                              is_batch: Boolean(item.is_batch),
                              qty_system: item.free_stock || 0,
                              qty_opname: null,
                              qty_selisih: null,
                              is_checking: null,
                              catatan: '',
                              created_by: authStore.user?.id || '',
                              free_stock: item.free_stock,
                              kode_item: item.kode_item,
                              nama_item: item.nama_item,
                              uom: item.uom_name || item.uom?.value1 || '-',
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
                        searchfield: 'kode_item,nama_item,tipe_name,kode_rak_d,batch',
                        no_pagination: 'false',
                        filter_column_is_opname: false,
                        ...(values.m_rak_id
                          ? { m_rak_id: values.m_rak_id }
                          : {}),
                      },
                      onsuccess: (response: any) => {
                        // API returns grouped by m_rak_d_id, flatten into item list
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
                        field: 'tipe_name',
                        headerName: 'Tipe Item',
                        width: '130px',
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
                        field: 'batch',
                        headerName: 'Batch',
                        width: '150px',
                        sortable: true,
                        filterable: true,
                        valueGetter: ({ data }: any) => data?.batch || '-',
                      },
                      {
                        field: 'last_opname',
                        headerName: 'Last Opname',
                        width: '150px',
                        sortable: true,
                        filterable: false,
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
                        sortable: false,
                        filterable: false,
                      },
                    ]"
                    :excludeIds="selectedItemIds"
                    uniqueKey="id"
                    :disabled="loading || !values.m_gudang_id"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead class="w-12">No</TableHead>
                      <TableHead>Kode</TableHead>
                      <TableHead>Nama Item</TableHead>
                      <TableHead>Kode Rak Detail</TableHead>
                      <TableHead class="w-36">Batch</TableHead>
                      <TableHead class="w-28">Qty System</TableHead>
                      <TableHead class="w-28">Qty Opname</TableHead>
                      <TableHead class="w-28">Selisih</TableHead>
                      <TableHead class="w-36">Checking</TableHead>
                      <TableHead>Satuan</TableHead>
                      <TableHead>Catatan</TableHead>
                      <TableHead v-if="!isReadOnly" class="w-20 text-center"
                        >Action</TableHead
                      >
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-if="detailItems.length === 0">
                      <TableCell
                        colspan="12"
                        class="text-center py-8 text-muted-foreground"
                      >
                        Belum ada item dipilih. Klik "Pilih Item" untuk
                        menambahkan.
                      </TableCell>
                    </TableRow>
                    <TableRow
                      v-for="(item, idx) in detailItems"
                      :key="item.m_items_id || idx"
                    >
                      <TableCell class="font-medium">{{ idx + 1 }}</TableCell>
                      <TableCell>{{ item.kode_item }}</TableCell>
                      <TableCell>{{ item.nama_item }}</TableCell>
                      <TableCell>{{ item.kode_rak_d || "-" }}</TableCell>
                      <TableCell class="font-mono text-xs">{{ item.batch || "-" }}</TableCell>
                      <TableCell>
                        <span>{{ item.qty_system }}</span>
                      </TableCell>
                      <TableCell>
                        <FieldNumber
                          v-model="item.qty_opname"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          :min="0"
                          placeholder="0"
                          class="w-full"
                        />
                      </TableCell>
                      <TableCell
                        class="font-medium text-center"
                        :class="{
                          'text-destructive':
                            item.qty_opname !== null &&
                            (item.qty_opname || 0) - (item.qty_system || 0) < 0,
                          'text-green-600':
                            item.qty_opname !== null &&
                            (item.qty_opname || 0) - (item.qty_system || 0) > 0,
                          'text-muted-foreground':
                            item.qty_opname !== null &&
                            (item.qty_opname || 0) - (item.qty_system || 0) ===
                              0,
                        }"
                      >
                        <span v-if="item.qty_opname !== null">
                          {{ (item.qty_opname || 0) - (item.qty_system || 0) }}
                        </span>
                        <span v-else class="text-muted-foreground">—</span>
                      </TableCell>
                      <TableCell>
                        <template v-if="item.qty_opname !== null">
                          <!-- Proses Checking: is_checking true, atau fallback qty berbeda jika is_checking null -->
                          <span
                            v-if="
                              item.is_checking === true ||
                              (item.is_checking == null &&
                                (Number(item.qty_opname) || 0) !==
                                  (Number(item.qty_system) || 0))
                            "
                            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
                          >
                            Proses Checking
                          </span>
                          <!-- Selesai Checking: is_checking false, atau fallback qty sama jika is_checking null -->
                          <span
                            v-else
                            class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                          >
                            Selesai Checking
                          </span>
                        </template>
                        <span v-else class="text-muted-foreground text-xs"
                          >—</span
                        >
                      </TableCell>
                      <TableCell>{{ item.uom }}</TableCell>
                      <TableCell>
                        <FieldX
                          v-model="item.catatan"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          placeholder="Catatan"
                          class="w-full"
                        />
                      </TableCell>
                      <TableCell v-if="!isReadOnly" class="text-center">
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