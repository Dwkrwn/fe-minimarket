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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FieldX,
  FieldSelect,
  FieldDate,
  FieldPopup,
  FieldTextarea,
} from "@/components/field";
import { DeleteButton } from "@/components/button";
import { ArrowLeft, Save, Loader2 } from "lucide-vue-next";
import { usePenerimaanGudangForm } from "./usePenerimaanGudangForm";
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
  detailArr,
  errors,
  handleUnitBisnisSelected,
  handleSjGudangSelect,
  removeDetailArr,
  onSave,
  handleCancel,
} = usePenerimaanGudangForm();
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
          <CardTitle>Informasi Penerimaan Gudang</CardTitle>
          <CardDescription>
            Isi data penerimaan gudang dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Unit Bisnis - Super Admin: Select, User Biasa: Auto dari SelectRespo -->
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
              placeholder="Unit bisnis dari respo"
              hints="Unit bisnis otomatis dari respo yang dipilih"
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

            <!-- No. Penerimaan Gudang (Auto Generated - Read Only) -->
            <FieldX
              id="no_penerimaan_gudang"
              label="No. Penerimaan Gudang"
              :value="values.no_penerimaan_gudang"
              :disabled="true"
              :readonly="true"
              placeholder="Auto Generated"
              hints="Nomor akan digenerate otomatis oleh sistem"
            />

            <!-- Tanggal Penerimaan Gudang -->
            <FieldDate
              id="tgl_penerimaan_gudang"
              label="Tanggal Penerimaan"
              v-model="values.tgl_penerimaan_gudang"
              :errorname="errors.tgl_penerimaan_gudang ? 'failed' : ''"
              :hints="errors.tgl_penerimaan_gudang"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih tanggal penerimaan"
            />

            <!-- PIC Penerima (FieldSelect ke m_kary) -->
            <FieldSelect
              id="pic_penerima_id"
              label="PIC Penerima"
              v-model="values.pic_penerima_id"
              :erroname="errors.pic_penerima_id ? 'failed' : ''"
              :required="!isReadOnly"
              :hints="'Pilih karyawan sebagai PIC penerima'"
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
                  selectfield: 'id,nama_kary,kode_kary',
                  filter_column_is_active: 'true',
                  filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
                },
              }"
              valueField="id"
              displayField="nama_kary"
              placeholder="Pilih PIC Penerima"
              :clearable="true"
            />

            <!-- No. Surat Jalan Gudang (FieldPopup) -->
            <FieldPopup
              id="t_sj_gudang_id"
              label="No. Surat Jalan Gudang"
              :value="values.t_sj_gudang_id"
              @input="
                (v: string) => {
                  values.t_sj_gudang_id = v;
                  errors.t_sj_gudang_id = '';
                }
              "
              @update:valueFull="handleSjGudangSelect"
              :errorText="errors.t_sj_gudang_id ? 'failed' : ''"
              :hints="
                errors.t_sj_gudang_id ||
                (!values.m_unit_bisnis_id
                  ? 'Pilih unit bisnis terlebih dahulu'
                  : 'Pilih Surat Jalan Gudang yang akan diterima')
              "
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || !values.m_unit_bisnis_id"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              :placeholder="
                !values.m_unit_bisnis_id
                  ? 'Pilih unit bisnis terlebih dahulu'
                  : 'Pilih No. Surat Jalan Gudang'
              "
              displayField="no_sj_gudang"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/fn/t_sj_gudang/getSjAvailable`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
                  searchfield: 'no_sj_gudang',
                  order_by: 'createdAt',
                  order_type: 'DESC',
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
                  field: 'no_sj_gudang',
                  headerName: 'No. SJ Gudang',
                  width: '200px',
                  sortable: true,
                  filterable: true,
                },
                {
                  field: 'tgl_sj_gudang',
                  headerName: 'Tanggal',
                  width: '120px',
                  sortable: true,
                  filterable: false,
                },
                {
                  field: 'tipe_sj_gudang',
                  headerName: 'Tipe',
                  width: '150px',
                  sortable: true,
                  filterable: false,
                },
                {
                  field: 'sj_gd_asl.nama_gudang',
                  headerName: 'Warehouse Asal',
                  width: '200px',
                  sortable: false,
                  filterable: false,
                },
                {
                  field: 'sj_gd_trm.nama_gudang',
                  headerName: 'Warehouse Terima',
                  width: '200px',
                  sortable: false,
                  filterable: false,
                },
                {
                  field: 'status',
                  headerName: 'Status',
                  width: '100px',
                  sortable: false,
                  filterable: false,
                },
              ]"
              :key="`sj-gudang-${values.m_unit_bisnis_id}`"
            />

            <!-- Warehouse Asal (Read Only - dari Surat Jalan) -->
            <FieldX
              id="warehouse_asal"
              label="Warehouse Asal"
              :value="values.warehouse_asal_name"
              :disabled="true"
              :readonly="true"
              placeholder="Auto dari Surat Jalan"
              hints="Otomatis terisi dari Surat Jalan Gudang yang dipilih"
            />

            <!-- Warehouse Terima (Read Only - dari Surat Jalan) -->
            <FieldX
              id="warehouse_terima"
              label="Warehouse Terima"
              :value="values.warehouse_terima_name"
              :disabled="true"
              :readonly="true"
              placeholder="Auto dari Surat Jalan"
              hints="Otomatis terisi dari Surat Jalan Gudang yang dipilih"
            />
          </div>

          <!-- Catatan (Full Width) -->
          <FieldTextarea
            id="catatan"
            label="Catatan (Opsional)"
            v-model="values.catatan"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            placeholder="Catatan tambahan untuk penerimaan gudang ini"
            :rows="3"
          />
        </CardContent>
      </Card>

      <!-- DETAIL TABS -->
      <Tabs default-value="detail" class="w-full">
        <TabsList
          class="w-full overflow-x-auto flex justify-start scrollbar-hide"
        >
          <TabsTrigger value="detail">Detail Items</TabsTrigger>
          <!-- <TabsTrigger value="foto">Foto Bukti Penerimaan</TabsTrigger> -->
        </TabsList>

        <!-- TAB CONTENT: DETAIL ITEMS -->
        <TabsContent value="detail" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Items Penerimaan</CardTitle>
                  <CardDescription>
                    {{
                      values.t_sj_gudang_id
                        ? "Item otomatis dimuat dari detail Surat Jalan Gudang"
                        : "Pilih No. Surat Jalan Gudang terlebih dahulu"
                    }}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full min-w-max text-sm">
                  <thead class="bg-muted">
                    <tr>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm w-12"
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
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm w-36"
                      >
                        Batch
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm w-16"
                      >
                        UOM
                      </th>
                      <th
                        class="px-3 py-2 text-right font-medium text-xs sm:text-sm w-20"
                      >
                        Qty SJ
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm w-28"
                      >
                        Qty Terima
                      </th>
                      <th
                        class="px-3 py-2 text-right font-medium text-xs sm:text-sm w-20"
                      >
                        Qty Sisa
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm w-48"
                      >
                        Rak
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm w-48"
                      >
                        Rak Detail
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Catatan
                      </th>
                      <th
                        v-if="!isReadOnly"
                        class="px-2 py-2 text-center font-medium text-xs sm:text-sm w-16"
                      >
                        Aksi
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="detailArr.length === 0">
                      <td
                        :colspan="isReadOnly ? 11 : 12"
                        class="text-center py-8 text-muted-foreground text-xs sm:text-sm"
                      >
                        <div
                          class="flex flex-col items-center justify-center gap-2"
                        >
                          <p class="text-sm">Belum ada item dipilih</p>
                          <p class="text-xs">
                            {{
                              values.t_sj_gudang_id
                                ? "Surat Jalan Gudang ini tidak memiliki detail item"
                                : "Pilih No. Surat Jalan Gudang terlebih dahulu"
                            }}
                          </p>
                        </div>
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, idx) in detailArr"
                      :key="detail.t_sj_gudang_d_id || idx"
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
                        <span
                          v-if="detail.is_batch"
                          class="font-mono text-xs bg-muted px-2 py-1 rounded"
                        >
                          {{ detail.batch || "-" }}
                        </span>
                        <span v-else class="text-muted-foreground text-xs">
                          -
                        </span>
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.uom || "-" }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm text-right">
                        {{ detail.qty_sj || 0 }}
                      </td>
                      <td class="px-3 py-2">
                        <input
                          v-if="!isReadOnly"
                          type="number"
                          v-model.number="detail.qty_diterima"
                          class="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-primary focus:border-primary bg-background"
                          :max="detail.qty_sj"
                          min="0"
                          @input="
                            (e: any) => {
                              const val = parseFloat(e.target.value) || 0;
                              if (val < 0) {
                                detail.qty_diterima = 0;
                                toast.warning(
                                  'Qty Terima tidak boleh minus',
                                );
                              } else if (val > detail.qty_sj) {
                                detail.qty_diterima = detail.qty_sj;
                                toast.warning(
                                  'Qty Terima tidak boleh lebih dari Qty SJ',
                                );
                              }
                              // Auto-calculate qty_sisa
                              detail.qty_sisa =
                                (detail.qty_sj || 0) -
                                (detail.qty_diterima || 0);
                            }
                          "
                        />
                        <span v-else class="text-xs sm:text-sm">{{
                          detail.qty_diterima || 0
                        }}</span>
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm text-right">
                        {{ (detail.qty_sj || 0) - (detail.qty_diterima || 0) }}
                      </td>
                      <td class="px-3 py-2">
                        <FieldSelect
                          v-model="detail.m_rak_id"
                          :disabled="
                            loading || isReadOnly || !values.warehouse_terima_id
                          "
                          :readonly="isReadOnly"
                          :hints="''"
                          :api="{
                            url: `${API_BASE_URL}/dynamic/m_rak`,
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${authStore.token}`,
                            },
                            params: {
                              no_pagination: 'true',
                              selectfield:
                                'id,nama_rak,kode_rak,m_gudang_id,m_unit_bisnis_id,is_rak_opname',
                              searchfield: 'nama_rak,kode_rak,m_rak_ds.kode',
                              join: 'true',
                              sub: 'true',
                              filter_column_m_gudang_id:
                                values.warehouse_terima_id,
                            },
                          }"
                          @update:modelValue="
                            () => {
                              detail.m_rak_d_id = '';
                            }
                          "
                          valueField="id"
                          displayField="nama_rak"
                          placeholder="Pilih rak"
                          :clearable="true"
                        />
                      </td>
                      <td class="px-3 py-2">
                        <FieldSelect
                          v-model="detail.m_rak_d_id"
                          :disabled="loading || isReadOnly || !detail.m_rak_id"
                          :readonly="isReadOnly"
                          :hints="''"
                          :api="{
                            url: `${API_BASE_URL}/dynamic/m_rak_d`,
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${authStore.token}`,
                            },
                            params: {
                              no_pagination: 'true',
                              selectfield: 'id,kode,baris,kolom,m_rak_id',
                              filter_column_m_rak_id: detail.m_rak_id,
                            },
                          }"
                          valueField="id"
                          displayField="kode"
                          placeholder="Pilih rak detail"
                          :clearable="true"
                        />
                      </td>
                      <td class="px-3 py-2 min-w-[320px]">
                        <!-- <input
                          v-if="!isReadOnly"
                          type="text"
                          v-model="detail.catatan"
                          class="w-full px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-primary focus:border-primary bg-background"
                          placeholder="Catatan..."
                        />
                        <span v-else class="text-xs sm:text-sm">{{
                          detail.catatan || "-"
                        }}</span> -->
                        <textarea
                          v-model="detail.catatan"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          placeholder="Catatan item"
                          class="w-full min-w-[280px] h-20 max-h-40 overflow-y-auto resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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

        <!-- TAB CONTENT: FOTO BUKTI PENERIMAAN -->
        <!-- <TabsContent value="foto" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Foto Bukti Penerimaan</CardTitle>
              <CardDescription
                >Upload foto bukti penerimaan barang (opsional)</CardDescription
              >
            </CardHeader>
            <CardContent>
              <FieldMultiUpload
                id="foto_bukti_penerimaan"
                label="Foto Bukti Penerimaan"
                :value="fotoArr"
                @input="(v) => (fotoArr = v)"
                :hints="'Upload foto bukti penerimaan (jpg, png, max 5MB per gambar, maksimal 10 gambar)'"
                :required="false"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                accept="image/*"
                :maxImages="10"
                class="w-full"
              />
            </CardContent>
          </Card>
        </TabsContent> -->
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
