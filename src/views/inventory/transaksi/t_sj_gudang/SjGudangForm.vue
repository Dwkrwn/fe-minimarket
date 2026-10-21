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
  FieldX,
  FieldNumber,
  FieldStatus,
  FieldSelect,
  FieldDate,
  FieldPopup,
  FieldTextarea,
  FieldRadio,
  FieldUpload,
} from "@/components/field";
import { ButtonMultiSelect } from "@/components/button";
import { DeleteButton } from "@/components/button";
import { ArrowLeft, Save, Loader2 } from "lucide-vue-next";
import { useSjGudangForm } from "./useSjGudangForm";
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
  photoUrl,
  tipeSjGudangOptions,
  pengirimanOptions,
  isEkspedisiValue,
  detailArr,
  errors,
  handleUnitBisnisSelected,
  handleTransferGudangSelect,
  removeDetailArr,
  onSave,
  handleCancel,
} = useSjGudangForm();
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
          <CardTitle>Informasi Surat Jalan Gudang</CardTitle>
          <CardDescription>
            Isi data Surat Jalan Gudang dengan lengkap dan benar
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <!-- Tipe Surat Jalan Radio -->
          <FieldRadio
            id="tipe_sj_gudang"
            label="Tipe Surat Jalan"
            v-model="values.tipe_sj_gudang"
            :options="tipeSjGudangOptions"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            direction="horizontal"
            :required="!isReadOnly"
            :errorname="errors.tipe_sj_gudang ? 'failed' : ''"
            :hints="errors.tipe_sj_gudang"
          />

          <!-- Grid 2 Columns for Desktop -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Company (Unit Bisnis) - Super Admin: Select, User Biasa: Auto -->
            <FieldSelect
              v-if="isSuperAdmin"
              id="m_unit_bisnis_id"
              label="Unit Bisnis"
              v-model="values.m_unit_bisnis_id"
              :errorname="errors.m_unit_bisnis_id ? 'failed' : ''"
              :hints="errors.m_unit_bisnis_id || 'Pilih Unit Bisnis'"
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
              placeholder="Pilih Unit Bisnis"
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

            <!-- Status (readonly, default DRAFT) -->
            <FieldX
              id="status"
              label="Status"
              :value="values.status"
              :disabled="true"
              :readonly="true"
              placeholder="Status"
              hints="Status akan otomatis berubah sesuai proses"
            />

            <FieldX
              id="status_pengiriman_name"
              label="Status Pengiriman"
              :value="values.status_pengiriman_name || '-'"
              :disabled="true"
              :readonly="true"
              placeholder="Status pengiriman"
              hints="Status pengiriman hanya dapat diubah dari halaman landing"
            />

            <!-- No. SJ Gudang (Auto Generated - Readonly) -->
            <FieldX
              id="no_sj_gudang"
              label="No. SJ Gudang"
              v-model="values.no_sj_gudang"
              :disabled="true"
              :readonly="true"
              :hints="'Nomor akan digenerate otomatis oleh sistem'"
              placeholder="Auto generate"
            />

            <!-- Tanggal SJ Gudang -->
            <FieldDate
              id="tgl_sj_gudang"
              label="Tanggal SJ Gudang"
              v-model="values.tgl_sj_gudang"
              :errorname="errors.tgl_sj_gudang ? 'failed' : ''"
              :hints="errors.tgl_sj_gudang"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Pilih tanggal"
            />

            <FieldNumber
              id="total_berat"
              label="Total Berat (KG)"
              :value="values.total_berat"
              :disabled="true"
              :readonly="true"
              placeholder="0"
            />

            <!-- No. Transfer Gudang (FieldPopup) - Hanya tampil jika tipe = TRANSFER GUDANG -->
            <FieldPopup
              v-if="values.tipe_sj_gudang === 'TRANSFER GUDANG'"
              id="t_transfer_gudang_id"
              label="No. Transfer Gudang"
              :value="values.t_transfer_gudang_id"
              @input="
                (v: string) => {
                  values.t_transfer_gudang_id = v;
                  errors.t_transfer_gudang_id = '';
                }
              "
              @update:valueFull="handleTransferGudangSelect"
              :errorText="errors.t_transfer_gudang_id ? 'failed' : ''"
              :hints="
                errors.t_transfer_gudang_id ||
                (!values.m_unit_bisnis_id
                  ? 'Pilih Unit Bisnis terlebih dahulu'
                  : 'Pilih No. Transfer Gudang')
              "
              :required="!isReadOnly"
              :disabled="loading || isReadOnly || !values.m_unit_bisnis_id"
              :readonly="isReadOnly"
              :clearable="!isReadOnly"
              :placeholder="
                !values.m_unit_bisnis_id
                  ? 'Pilih Unit Bisnis terlebih dahulu'
                  : 'Pilih No. Transfer Gudang'
              "
              displayField="no_tw"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/fn/t_transfer_gudang/getDataTWAvailable`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  searchfield: 'no_tw,catatan',
                  m_unit_bisnis_id: values.m_unit_bisnis_id,
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
                  field: 'no_tw',
                  headerName: 'No. Transfer',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                },
                {
                  field: 'tgl_tw',
                  headerName: 'Tanggal',
                  width: '120px',
                },
                {
                  field: 'warehouse_asal.nama_gudang',
                  headerName: 'Gudang Asal',
                  width: '180px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                  render: (row: any) => row.warehouse_asal?.nama_gudang || '-',
                },
                {
                  field: 'warehouse_tujuan.nama_gudang',
                  headerName: 'Gudang Tujuan',
                  width: '180px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                  render: (row: any) =>
                    row.warehouse_tujuan?.nama_gudang || '-',
                },
                {
                  field: 'm_kary.nama_kary',
                  headerName: 'PIC',
                  width: '150px',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter',
                  render: (row: any) => row.m_kary?.nama_kary || '-',
                },
              ]"
            />

            <!-- Warehouse Asal (Read Only - dari Transfer Gudang) -->
            <FieldX
              v-if="values.tipe_sj_gudang === 'TRANSFER GUDANG'"
              id="warehouse_asal"
              label="Gudang Asal"
              :value="values.warehouse_asal_name"
              :readonly="true"
              placeholder="Auto dari No. Transfer Gudang"
              hints="Otomatis terisi dari Transfer Gudang yang dipilih"
            />

            <!-- Warehouse Terima (Read Only - dari Transfer Gudang) -->
            <FieldX
              v-if="values.tipe_sj_gudang === 'TRANSFER GUDANG'"
              id="warehouse_terima"
              label="Gudang Terima"
              :value="values.warehouse_terima_name"
              :readonly="true"
              placeholder="Auto dari No. Transfer Gudang"
              hints="Otomatis terisi dari Transfer Gudang yang dipilih"
            />

            <!-- PIC (Read Only - dari Transfer Gudang) -->
            <!-- <FieldX
              v-if="values.tipe_sj_gudang === 'TRANSFER GUDANG'"
              id="pic_name"
              label="PIC"
              :value="values.pic_name"
              :disabled="true"
              :readonly="true"
              placeholder="Auto dari No. Transfer Gudang"
              hints="PIC dari Transfer Gudang yang dipilih"
            /> -->

            <!-- Pengiriman Radio (is_ekspedisi) -->
            <FieldRadio
              id="is_ekspedisi"
              label="Pengiriman"
              v-model="isEkspedisiValue"
              :options="pengirimanOptions"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              direction="horizontal"
            />

            <!-- Supir (Input manual) - Hanya tampil jika is_ekspedisi = false -->
            <FieldX
              v-if="!values.is_ekspedisi"
              id="supir"
              label="Nama Supir"
              v-model="values.supir"
              :errorname="errors.supir ? 'failed' : ''"
              :hints="errors.supir || 'Masukkan nama supir'"
              :required="!isReadOnly"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Nama supir"
            />

            <div class="flex space-x-3" v-if="!values.is_ekspedisi">
              <!-- Kendaraan (FieldSelect) - Hanya tampil jika is_ekspedisi = false -->
              <FieldSelect
                class="w-1/2"
                id="m_kendaraan_id"
                label="Kendaraan"
                v-model="values.m_kendaraan_id"
                @update:valueFull="
                  (item: any) => {
                    values.kendaraan_no_polisi = item?.no_polisi || '';
                  }
                "
                :errorname="errors.m_kendaraan_id ? 'failed' : ''"
                :hints="errors.m_kendaraan_id || 'Pilih kendaraan'"
                :required="!isReadOnly"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_kendaraan`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    no_pagination: 'true',
                    selectfield: 'id,nama_kendaraan,no_polisi',
                    filter_column_is_active: 'true',
                    filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id,
                  },
                }"
                valueField="id"
                displayField="nama_kendaraan"
                placeholder="Pilih kendaraan"
                :clearable="true"
              />

              <!-- No. Polisi (Read Only - dari Kendaraan) -->
              <FieldX
                id="kendaraan_no_polisi"
                label="No. Polisi"
                :value="values.kendaraan_no_polisi"
                :disabled="true"
                :readonly="true"
                placeholder="Auto dari kendaraan"
                hints="Otomatis terisi dari kendaraan yang dipilih"
              />
            </div>

            <div class="flex space-x-3" v-if="values.is_ekspedisi">
              <!-- Ekspedisi (FieldSelect) - Hanya tampil jika is_ekspedisi = true -->
              <FieldSelect
                id="ekpedisi_id"
                label="Ekspedisi"
                v-model="values.ekpedisi_id"
                :errorname="errors.ekspedisi_id ? 'failed' : ''"
                :hints="errors.ekspedisi_id || 'Pilih ekspedisi'"
                :required="!isReadOnly"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_ekspedisi`,
                  params: {
                    where: 'is_active=true',
                    order: 'value1:asc',
                  },
                }"
                valueField="id"
                displayField="nama"
                placeholder="Pilih ekspedisi"
                :clearable="true"
              />

              <!-- No. Resi -->
              <FieldX
                id="no_resi"
                label="No. Resi"
                v-model="values.no_resi"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="Masukkan nomor resi"
                hints="Nomor resi dari ekspedisi"
              />
            </div>

            <!-- Catatan -->
            <FieldTextarea
              id="catatan"
              label="Catatan (Opsional)"
              v-model="values.catatan"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Catatan tambahan untuk Surat Jalan Gudang ini"
              :rows="3"
            />

            <!-- Foto Bukti (Upload) -->
            <div class="space-y-2">
              <!-- Preview foto yang sudah ada -->
              <div
                v-if="
                  values.bukti_foto &&
                  !values.bukti_foto.startsWith('blob:') &&
                  !values.bukti_foto.startsWith('data:')
                "
                class="mb-3"
              >
                <label class="text-sm font-medium">Foto Bukti Saat Ini:</label>
                <div class="mt-2 border rounded-lg p-3 bg-muted/30">
                  <a :href="photoUrl" target="_blank" class="block">
                    <img
                      :src="photoUrl"
                      alt="Bukti Foto"
                      class="max-w-full h-auto max-h-64 rounded-md object-contain mx-auto cursor-pointer hover:opacity-80 transition-opacity"
                      @error="
                        (e: any) => {
                          console.error('Failed to load image:', photoUrl);
                          e.target.src =
                            'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22100%22%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 fill=%22%23999%22 font-size=%2212%22%3EGambar tidak dapat dimuat%3C/text%3E%3C/svg%3E';
                        }
                      "
                    />
                  </a>
                  <p class="text-xs text-muted-foreground mt-2 text-center">
                    Klik untuk melihat ukuran penuh
                  </p>
                </div>
              </div>

              <FieldUpload
                id="bukti_foto"
                label="Foto Bukti"
                :value="values.bukti_foto"
                @input="(v) => (values.bukti_foto = v)"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                :required="values.is_ekspedisi && !isReadOnly"
                :errorname="errors.bukti_foto ? 'failed' : ''"
                :hints="
                  errors.bukti_foto ||
                  (values.bukti_foto && !values.bukti_foto.startsWith('blob:')
                    ? 'Upload foto baru untuk mengganti foto yang ada'
                    : values.is_ekspedisi
                      ? 'Upload bukti foto pengiriman ekspedisi (max 5MB)'
                      : 'Upload bukti foto pengiriman (opsional, max 5MB)')
                "
                accept="image/*"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- DETAIL TABS -->
      <Tabs default-value="detail1" class="w-full">
        <TabsList
          class="w-full overflow-x-auto flex justify-start scrollbar-hide"
        >
          <TabsTrigger value="detail1">Detail Items</TabsTrigger>
        </TabsList>

        <!-- TAB CONTENT: DETAIL ITEMS -->
        <TabsContent value="detail1" class="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div class="flex items-center justify-between">
                <div>
                  <CardTitle>Detail Items Surat Jalan</CardTitle>
                  <CardDescription>
                    Items otomatis terisi saat memilih No. Transfer Gudang
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
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
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Kode Rak
                      </th>
                      <th
                        class="px-3 py-2 text-left font-medium text-xs sm:text-sm"
                      >
                        Kode Rak D
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
                        class="px-3 py-2 text-right font-medium text-xs sm:text-sm w-28"
                      >
                        Berat Sistem (KG)
                      </th>
                      <th
                        class="px-3 py-2 text-right font-medium text-xs sm:text-sm w-28"
                      >
                        Berat Aktual (KG)
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
                          <p class="text-sm">Belum ada item</p>
                          <p class="text-xs">
                            {{
                              values.t_transfer_gudang_id
                                ? "Transfer Gudang ini tidak memiliki item detail"
                                : "Pilih No. Transfer Gudang untuk menampilkan items"
                            }}
                          </p>
                        </div>
                      </td>
                    </tr>
                    <tr
                      v-for="(detail, idx) in detailArr"
                      :key="detail.t_transfer_gudang_d_id || idx"
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
                        {{ detail.kode_rak_asal || "-" }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        {{ detail.kode_rak_d_asal || "-" }}
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
                      <td
                        class="px-3 py-2 text-xs sm:text-sm text-right font-medium whitespace-nowrap"
                      >
                        {{ Number(detail.qty_sj_gudang) || 0 }}
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldNumber
                          :value="detail.berat"
                          :disabled="true"
                          :readonly="true"
                          :min="0"
                          placeholder="0"
                          class="w-24"
                        />
                      </td>
                      <td class="px-3 py-2 text-xs sm:text-sm">
                        <FieldNumber
                          v-model="detail.berat_aktual"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          :min="0"
                          placeholder="0"
                          class="w-24"
                        />
                      </td>
                      <td class="px-3 py-2">
                        <input
                          v-model="detail.catatan"
                          type="text"
                          :disabled="loading || isReadOnly"
                          :readonly="isReadOnly"
                          placeholder="Catatan..."
                          class="w-full px-2 py-1 text-xs sm:text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
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
