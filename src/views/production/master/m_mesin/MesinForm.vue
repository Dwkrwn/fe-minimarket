<script setup lang="ts">
import AuditInfo from '@/components/AuditInfo.vue'
const auditMeta = ref<any>({})

import { ref, reactive, onBeforeMount, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FieldNumber, FieldPopup, FieldSelect, FieldStatus, FieldTextarea, FieldX } from "@/components/field";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import { ButtonMultiSelect } from "@/components/button";
import {
  createMesin,
  getMesinById,
  updateMesin,
  type MesinItem,
  type MesinItemDetail,
  type MesinSubDetail,
} from "./service";

const router = useRouter();
const route = useRoute();
const { API_BASE_URL } = useApi();
const authStore = useAuthStore();

const loading = ref(false);
const isEditMode = computed(() => !!route.params.id && route.name === "MesinForm");
const isViewMode = computed(() => route.name === "MesinView");
const isCopyMode = computed(() => route.query.action === "copy" && !!route.query.source);
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true);
const menuId = computed(() => route.params.id as string);

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Mesin";
  if (isCopyMode.value) return "Salin Mesin";
  if (isEditMode.value) return "Edit Mesin";
  return "Tambah Mesin";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data mesin";
  if (isCopyMode.value) return "Buat mesin baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data mesin";
  return "Buat data mesin baru";
});

const values = reactive({
  m_unit_bisnis_id: "",
  status: true,
  work_center: "",
  work_center_name: "",
  tolerance: "0",
  code: "",
  name: "",
  notes: "",
});

const errors = reactive({
  m_unit_bisnis_id: "",
  name: "",
});

const subDetails = ref<MesinSubDetail[]>([]);
const itemDetails = ref<MesinItemDetail[]>([]);

const selectedItemIds = computed(() => {
  return itemDetails.value.map((item: any) => item.m_item_id).filter(Boolean);
});

const selectedUnitBisnisCompanyName = ref<string>("");

const handleUnitBisnisSelected = (item: any) => {
  selectedUnitBisnisCompanyName.value =
    item?.m_company?.nama || item?.m_company?.kode || "";
};

const handleWorkCenterSelected = (item: any) => {
  values.work_center_name = item?.value1 || "";
};

const fetchUnitBisnisCompanyName = async (unitBisnisId: string) => {
  if (!unitBisnisId) {
    selectedUnitBisnisCompanyName.value = "";
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_unit_bisnis/${unitBisnisId}?join=true`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    );
    const result = await response.json();
    if (result?.status === "success" && result.data) {
      selectedUnitBisnisCompanyName.value =
        result.data?.m_company?.nama || result.data?.m_company?.kode || "-";
    }
  } catch (err) {
    console.error("Gagal mengambil nama company:", err);
  }
};

const normalizeBoolean = (value: unknown) =>
  value === true || value === 1 || value === "1" || value === "true";

const asArray = (value: unknown) => (Array.isArray(value) ? value : []);

const toNumberOrUndefined = (value: unknown) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const addSubMesin = () => {
  subDetails.value.push({ code: "", name: "", notes: "", status: true });
};

const removeSubMesin = (index: number) => {
  subDetails.value.splice(index, 1);
};

const addSelectedItems = (items: any[]) => {
  items.forEach((item) => {
    if (!itemDetails.value.find((d: any) => d.m_item_id === item.id)) {
      itemDetails.value.push({
        m_item_id: item.id,
        capacity: "",
        unit_id: "",
        status: true,
        notes: "",
        m_item: item,
      });
    }
  });
};

const removeItem = (index: number) => {
  itemDetails.value.splice(index, 1);
};

const isSuperAdmin = computed(() => {
  return authStore.user?.tipe?.value1?.toUpperCase() === 'SUPER ADMIN';
});

const isUnitBisnisReadonly = computed(() => {
  return !isSuperAdmin.value || isEditMode.value || isViewMode.value;
});

const getSelectRespoData = () => {
  try {
    const raw = localStorage.getItem('SelectRespo');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse SelectRespo:', err);
    return null;
  }
};

const applyCurrentUserUnitBisnis = () => {
  if (isSuperAdmin.value) return;
  const selectRespo = getSelectRespoData();
  const ubId = selectRespo?.companyId || selectRespo?.m_unit_bisnis_id || selectRespo?.unitBisnisId || "";
  if (ubId) {
    values.m_unit_bisnis_id = String(ubId);
    fetchUnitBisnisCompanyName(String(ubId));
  }
};

const resetForm = () => {
  Object.assign(values, {
    m_unit_bisnis_id: "",
    status: true,
    work_center: "",
    work_center_name: "",
    tolerance: "0",
    code: "",
    name: "",
    notes: "",
  });
  Object.assign(errors, {
    m_unit_bisnis_id: "",
    name: "",
  });
  selectedUnitBisnisCompanyName.value = "";
  subDetails.value = [];
  itemDetails.value = [];

  applyCurrentUserUnitBisnis();
};

const normalizeSubDetails = (rows: any[] = []) =>
  rows.map((row: any) => ({
    id: row.id,
    m_mesin_id: row.m_mesin_id,
    status: normalizeBoolean(row.status ?? row.is_active),
    code: row.code ?? "",
    name: row.name ?? "",
    notes: row.notes ?? row.note ?? row.catatan ?? "",
  }));

const normalizeItemDetails = (rows: any[] = []) =>
  rows.map((row: any) => ({
    id: row.id,
    m_mesin_id: row.m_mesin_id,
    m_item_id: row.m_item_id ?? row.m_items_id ?? row.m_item?.id ?? row.m_items?.id ?? "",
    capacity: row.capacity ?? row.kapasitas ?? "",
    unit_id: row.unit_id ?? row.m_general?.id ?? "",
    status: normalizeBoolean(row.status ?? row.is_active),
    notes: row.notes ?? row.note ?? row.catatan ?? "",
    m_item: row.m_item ?? row.m_items,
    m_general: row.m_general,
  }));

const onReset = () => resetForm();

onBeforeMount(async () => {
  onReset();

  const isCopyModeLocal = route.query.action === "copy" && route.query.source;
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value;

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) return;

  loading.value = true;
  try {
    const res = await getMesinById(sourceId);
    if (res && res.data) {
      const rawData = res.data as any;
      auditMeta.value = {
        created_by: rawData.mesin_ctr?.name || rawData.mesin_ctr?.username || rawData.created_by,
        createdAt: rawData.createdAt,
        updated_by: rawData.mesin_updt?.name || rawData.mesin_updt?.username || rawData.update_by || rawData.updated_by,
        updatedAt: rawData.updatedAt,
      }
    }
    
    if (res.status !== "success") throw new Error("Gagal memuat data");

    const raw: any = res.data || {};
    values.m_unit_bisnis_id = raw.m_unit_bisnis_id ?? raw.group ?? values.m_unit_bisnis_id;
    if (values.m_unit_bisnis_id) {
      fetchUnitBisnisCompanyName(values.m_unit_bisnis_id);
    }
    values.status = normalizeBoolean(raw.status ?? raw.is_active);
    values.work_center = raw.work_center ?? raw.m_general?.id ?? "";
    values.work_center_name = raw.m_general?.value1 ?? "";
    values.tolerance = raw.tolerance !== null && raw.tolerance !== undefined && raw.tolerance !== "" 
      ? String(raw.tolerance) 
      : "0";
    values.code = raw.code ?? "";
    values.name = raw.name ?? raw.value1 ?? "";
    values.notes = raw.notes ?? raw.note ?? raw.value2 ?? "";

    const rawSubs = asArray(raw.m_mesin_d_subs || raw.m_mesin_d_sub || raw.SubMesin || raw.m_mesin_details);
    const rawItems = asArray(raw.m_mesin_d_items || raw.m_mesin_d_item || raw.Item || raw.m_mesin_details2);

    subDetails.value = normalizeSubDetails(rawSubs);
    itemDetails.value = normalizeItemDetails(rawItems);

    if (isCopyModeLocal) {
      delete raw.id;
      delete raw.createdAt;
      delete raw.updatedAt;
      values.code = "";
      subDetails.value.forEach((r: any) => {
        delete r.id;
        delete r.m_mesin_id;
      });
      itemDetails.value.forEach((r: any) => {
        delete r.id;
        delete r.m_mesin_id;
      });
    }

    toast.success(isCopyModeLocal ? "Data berhasil disalin" : "Data berhasil dimuat");
  } catch (error) {
    toast.error("Gagal memuat data Mesin", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
    setTimeout(() => router.push("/production/master/m_mesin"), 2000);
  } finally {
    loading.value = false;
  }
});

const buildSubPayload = () =>
  subDetails.value
    .filter((row) => row.code?.trim() || row.name?.trim() || row.notes?.trim())
    .map((row) => ({
      status: row.status ?? true,
      code: row.code?.trim() || undefined,
      name: row.name?.trim() || undefined,
      notes: row.notes?.trim() || undefined,
    }));

const buildItemPayload = () =>
  itemDetails.value
    .filter((row) => row.m_item_id || row.capacity || row.unit_id || row.notes?.trim())
    .map((row) => ({
      m_item_id: row.m_item_id || undefined,
      capacity: toNumberOrUndefined(row.capacity),
      unit_id: row.unit_id || undefined,
      status: row.status ?? true,
      notes: row.notes?.trim() || undefined,
    }));

const onSave = async () => {
  Object.assign(errors, {
    m_unit_bisnis_id: "",
    name: "",
  });

  let invalid = false;
  if (!values.m_unit_bisnis_id) {
    errors.m_unit_bisnis_id = "Company wajib diisi";
    invalid = true;
  }
  if (!values.name?.trim()) {
    errors.name = "Nama Mesin wajib diisi";
    invalid = true;
  }

  if (invalid) {
    toast.error("Validasi gagal", {
      description: "Mohon lengkapi semua field yang wajib diisi",
    });
    return;
  }

  loading.value = true;
  try {
    const payload: Partial<MesinItem> = {
      m_unit_bisnis_id: values.m_unit_bisnis_id || undefined,
      status: values.status,
      work_center: values.work_center || null,
      tolerance: values.tolerance !== "" && values.tolerance !== null && values.tolerance !== undefined
        ? Number(String(values.tolerance).replace(',', '.'))
        : 0,
      code: isEditMode.value ? (values.code?.trim() || undefined) : undefined,
      name: values.name?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
      m_mesin_d_subs: buildSubPayload(),
      m_mesin_d_items: buildItemPayload(),
    };

    if (isEditMode.value) {
      await updateMesin(menuId.value, payload);
      toast.success("Mesin berhasil diperbarui");
    } else {
      await createMesin(payload);
      toast.success("Mesin berhasil dibuat");
    }

    router.replace("/production/master/m_mesin?reload=" + Date.now());
  } catch (error) {
    toast.error(isEditMode.value ? "Gagal memperbarui Mesin" : "Gagal membuat Mesin", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => router.push("/production/master/m_mesin");
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="icon" @click="handleCancel">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div>
        <h1 class="text-2xl font-bold">{{ pageTitle }}</h1>
        <p class="text-sm text-muted-foreground">{{ pageDescription }}</p>
      </div>
    </div>

    <form class="space-y-6" @submit.prevent>
      <Card>
        <CardHeader>
          <CardTitle>Informasi Mesin</CardTitle>
          <CardDescription>Isi data mesin sesuai struktur tabel</CardDescription>
        </CardHeader>
        <CardContent class="pt-0">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
            <div class="space-y-4">
              <FieldSelect
                id="m_unit_bisnis_id"
                label="Unit Bisnis"
                :value="values.m_unit_bisnis_id"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    no_pagination: 'true',
                    searchfield: 'kode_unit_bisnis,nama_comp',
                    join: 'true',
                  },
                }"
                display-field="nama_comp"
                value-field="id"
                placeholder="Pilih Unit Bisnis"
                :required="!isReadOnly"
                :disabled="loading || isReadOnly || isUnitBisnisReadonly"
                :readonly="isReadOnly || isUnitBisnisReadonly"
                :clearable="!isUnitBisnisReadonly"
                :errorText="errors.m_unit_bisnis_id ? 'failed' : ''"
                :hints="errors.m_unit_bisnis_id || (isUnitBisnisReadonly ? 'Unit bisnis otomatis dari user login' : 'Pilih unit bisnis untuk mesin ini')"
                @input="(v) => (values.m_unit_bisnis_id = v)"
                @update:valueFull="handleUnitBisnisSelected"
                class="w-full"
              />

              <FieldX
                id="company_display"
                label="Company"
                :value="selectedUnitBisnisCompanyName || '-'"
                :disabled="true"
                :readonly="true"
                placeholder="-"
                hints="Company otomatis dari user login"
                class="w-full opacity-70"
              />

              <FieldX
                id="code"
                label="Kode"
                :value="values.code || 'Auto Generate'"
                :required="false"
                :disabled="true"
                :readonly="true"
                placeholder="Auto Generate"
                class="w-full opacity-70"
              />
            </div>

            <div class="space-y-4">
              <FieldX
                id="name"
                label="Nama Mesin"
                :value="values.name"
                :errorname="errors.name ? 'failed' : ''"
                @input="(v) => (values.name = v)"
                :hints="errors.name || 'Masukkan nama mesin'"
                :required="!isReadOnly"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="Mesin A"
                class="w-full"
              />

              <FieldSelect
                id="work_center"
                label="Work Center"
                :value="values.work_center"
                :api="{
                  url: `${API_BASE_URL}/dynamic/m_general`,
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authStore.token}`,
                  },
                  params: {
                    no_pagination: 'true',
                    filter_column_group: 'work_center',
                    selectfield: 'id,code,value1',
                    searchfield: 'value1,code',
                  },
                }"
                display-field="value1"
                value-field="id"
                placeholder="Pilih Work Center"
                :clearable="true"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                :display-value="values.work_center_name"
                @input="(v) => (values.work_center = v)"
                @update:valueFull="handleWorkCenterSelected"
                class="w-full"
              />

              <div class="flex items-end gap-4">
                <div class="relative w-48">
                  <FieldNumber
                    id="tolerance"
                    label="Tolerance(%)"
                    :value="values.tolerance"
                    :use-grouping="false"
                    @input="(v) => {
                      const num = parseFloat(String(v).replace(',', '.'));
                      values.tolerance = !isNaN(num) && num > 100 ? '100' : String(v);
                    }"
                    @update:modelValue="(v) => {
                      const num = parseFloat(String(v).replace(',', '.'));
                      values.tolerance = !isNaN(num) && num > 100 ? '100' : String(v);
                    }"
                    :disabled="loading || isReadOnly"
                    :readonly="isReadOnly"
                    placeholder="0"
                    type="decimal"
                    :min="0"
                    :max="100"
                    class="w-full [&_input]:pr-8"
                  />
                  <span class="pointer-events-none absolute right-3 top-[31px] text-sm text-muted-foreground font-medium">
                    %
                  </span>
                </div>

                <FieldStatus
                  label="Status"
                  name="status"
                  v-model="values.status"
                  :disabled="loading"
                  :readonly="isReadOnly"
                  active-text="Aktif"
                  inactive-text="Tidak Aktif"
                />
              </div>
            </div>
          </div>

          <div class="mt-4">
            <FieldTextarea
              id="notes"
              label="Catatan"
              :value="values.notes"
              @input="(v) => (values.notes = v)"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Catatan"
              :rows="3"
              class="w-full"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mesin Detail</CardTitle>
          <CardDescription>Kelola data sub mesin dan item terkait</CardDescription>
        </CardHeader>
        <CardContent class="pt-0 space-y-4">
          <Tabs default-value="sub-mesin" class="w-full">
            <TabsList class="bg-muted/60 w-full justify-start">
              <TabsTrigger value="sub-mesin">Sub Mesin</TabsTrigger>
              <TabsTrigger value="item">Item</TabsTrigger>
            </TabsList>

            <TabsContent value="sub-mesin" class="mt-4 space-y-3">
              <div v-if="!isReadOnly">
                <Button type="button" size="sm" @click="addSubMesin" class="gap-1">
                  <Plus class="h-4 w-4" />
                  Add to List
                </Button>
              </div>

              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted/60">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium w-12">No</th>
                      <th class="px-3 py-2 text-left font-medium w-36">Kode</th>
                      <th class="px-3 py-2 text-left font-medium">Nama Sub Mesin</th>
                      <th class="px-3 py-2 text-left font-medium">Catatan</th>
                      <th class="px-3 py-2 text-left font-medium w-32">Status</th>
                      <th v-if="!isReadOnly" class="px-3 py-2 text-center font-medium w-16">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="subDetails.length === 0">
                      <td :colspan="isReadOnly ? 5 : 6" class="text-center py-8 text-muted-foreground text-sm">
                        Belum ada Sub Mesin ditambahkan
                      </td>
                    </tr>
                    <tr v-for="(row, index) in subDetails" :key="index" class="border-t hover:bg-muted/30 transition-colors">
                      <td class="px-3 py-2 text-muted-foreground">{{ index + 1 }}</td>
                      <td class="px-3 py-2">
                        <input v-if="!isReadOnly" v-model="row.code" type="text" class="w-full px-2 py-1 border rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Auto/Kode" />
                        <span v-else>{{ row.code || "-" }}</span>
                      </td>
                      <td class="px-3 py-2">
                        <input v-if="!isReadOnly" v-model="row.name" type="text" class="w-full px-2 py-1 border rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Nama Sub Mesin" />
                        <span v-else>{{ row.name || "-" }}</span>
                      </td>
                      <td class="px-3 py-2">
                        <input v-if="!isReadOnly" v-model="row.notes" type="text" class="w-full px-2 py-1 border rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Catatan" />
                        <span v-else>{{ row.notes || "-" }}</span>
                      </td>
                      <td class="px-3 py-2">
                        <FieldStatus
                          label=""
                          name="sub_status"
                          v-model="row.status"
                          :disabled="loading"
                          :readonly="isReadOnly"
                          active-text="Aktif"
                          inactive-text="Tidak Aktif"
                        />
                      </td>
                      <td v-if="!isReadOnly" class="px-3 py-2 text-center">
                        <Button type="button" variant="ghost" size="icon" class="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" @click="removeSubMesin(index)">
                          <Trash2 class="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="item" class="mt-4 space-y-3">
              <div v-if="!isReadOnly">
                <ButtonMultiSelect
                  title="Pilih Items"
                  :disabled="loading || !values.m_unit_bisnis_id"
                  uniqueKey="id"
                  :excludeIds="selectedItemIds"
                  :api="{
                    url: `${API_BASE_URL}/dynamic/m_items`,
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authStore.token}`,
                    },
                    params: {
                      selectfield: 'id,kode_item,nama_item',
                      searchfield: 'kode_item,nama_item',
                      include: 'm_items_unit_bisnis',
                      'filter_column_m_items_unit_bisnis.unit_bisnis_id': values.m_unit_bisnis_id || undefined,
                    },
                    onsuccess: (response: any) => {
                      response.hasNext = response.pagination?.next_page ? true : false;
                      return response;
                    },
                  }"
                  :columns="[
                    { field: 'kode_item', headerName: 'Kode', width: '160px', sortable: true, filterable: true },
                    { field: 'nama_item', headerName: 'Nama', flex: 1, sortable: true, filterable: true },
                  ]"
                  @add="addSelectedItems"
                />
              </div>

              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted/60">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium w-12">No</th>
                      <th class="px-3 py-2 text-left font-medium">Kode / Nama Item</th>
                      <th class="px-3 py-2 text-right font-medium w-44">Capacity</th>
                      <th class="px-3 py-2 text-left font-medium w-44">Unit</th>
                      <th class="px-3 py-2 text-left font-medium">Catatan</th>
                      <th class="px-3 py-2 text-left font-medium w-32">Status</th>
                      <th v-if="!isReadOnly" class="px-3 py-2 text-center font-medium w-16">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="itemDetails.length === 0">
                      <td :colspan="isReadOnly ? 6 : 7" class="text-center py-8 text-muted-foreground text-sm">
                        Belum ada Item ditambahkan
                      </td>
                    </tr>
                    <tr v-for="(row, index) in itemDetails" :key="index" class="border-t hover:bg-muted/30 transition-colors">
                      <td class="px-3 py-2 text-muted-foreground">{{ index + 1 }}</td>
                      <td class="px-3 py-2">
                        <span>
                          {{
                            row.m_item
                              ? `${row.m_item.kode || row.m_item.kode_item || "-"} - ${row.m_item.nama || row.m_item.nama_item || "-"}`
                              : row.m_item_id || "-"
                          }}
                        </span>
                      </td>
                      <td class="px-3 py-2">
                        <input v-if="!isReadOnly" v-model="row.capacity" type="number" min="0" class="w-full px-2 py-1 border rounded text-sm bg-background text-right focus:outline-none focus:ring-1 focus:ring-ring" placeholder="0" />
                        <span v-else class="block text-right">{{ row.capacity || "0" }}</span>
                      </td>
                      <td class="px-3 py-2">
                        <FieldSelect
                          v-if="!isReadOnly"
                          :id="`unit_${index}`"
                          :value="row.unit_id || ''"
                          :api="{
                            url: `${API_BASE_URL}/dynamic/m_general`,
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${authStore.token}`,
                            },
                            params: {
                              no_pagination: 'true',
                              filter_column_group: 'UOM',
                              selectfield: 'id,value1',
                              searchfield: 'value1',
                            },
                          }"
                          display-field="value1"
                          value-field="id"
                          placeholder="Pilih Unit"
                          :clearable="true"
                          @input="(v) => (row.unit_id = v)"
                          @update:valueFull="(item) => (row.m_general = item || undefined)"
                          class="w-full"
                        />
                        <span v-else>{{ row.m_general?.value1 || row.unit_id || "-" }}</span>
                      </td>
                      <td class="px-3 py-2">
                        <input v-if="!isReadOnly" v-model="row.notes" type="text" class="w-full px-2 py-1 border rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Catatan" />
                        <span v-else>{{ row.notes || "-" }}</span>
                      </td>
                      <td class="px-3 py-2">
                        <FieldStatus
                          label=""
                          name="item_status"
                          v-model="row.status"
                          :disabled="loading"
                          :readonly="isReadOnly"
                          active-text="Aktif"
                          inactive-text="Tidak Aktif"
                        />
                      </td>
                      <td v-if="!isReadOnly" class="px-3 py-2 text-center">
                        <Button type="button" variant="ghost" size="icon" class="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" @click="removeItem(index)">
                          <Trash2 class="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      <AuditInfo
        v-if="isViewMode || isEditMode"
        :created-by="auditMeta.created_by"
        :created-at="auditMeta.createdAt"
        :updated-by="auditMeta.updated_by"
        :updated-at="auditMeta.updatedAt"
        class="mt-6"
      />

      <div class="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-end sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t -mx-6 px-6 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:static sm:border-0">
        <Button type="button" variant="outline" @click="handleCancel" :disabled="loading" class="w-full sm:w-auto">
          {{ isReadOnly ? "Kembali" : "Batal" }}
        </Button>
        <Button v-if="!isReadOnly" type="button" @click="onSave" :disabled="loading" class="gap-2 w-full sm:w-auto">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          {{ isEditMode ? "Perbarui" : "Simpan" }}
        </Button>
      </div>
    </form>
  </div>
</template>
