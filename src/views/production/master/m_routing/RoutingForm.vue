<script setup lang="ts">
import AuditInfo from '@/components/AuditInfo.vue'
const auditMeta = ref<any>({})

import { ref, reactive, onBeforeMount, computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FieldPopup, FieldSelect, FieldStatus, FieldTextarea, FieldX } from "@/components/field";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-vue-next";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import { ButtonMultiSelect } from "@/components/button";
import { createRouting, getRoutingById, updateRouting, type RoutingItem, type RoutingJobDetail, type RoutingItemDetail, type RoutingMesinDetail } from "./service";

const router = useRouter();
const route = useRoute();
const { API_BASE_URL } = useApi();
const authStore = useAuthStore();

const loading = ref(false);
const isEditMode = computed(() => !!route.params.id && route.name === "RoutingForm");
const isViewMode = computed(() => route.name === "RoutingView");
const isCopyMode = computed(() => route.query.action === "copy" && !!route.query.source);
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true);
const menuId = computed(() => route.params.id as string);

const pageTitle = computed(() => {
  if (isViewMode.value) return "Detail Routing";
  if (isCopyMode.value) return "Salin Routing";
  if (isEditMode.value) return "Edit Routing";
  return "Tambah Routing";
});

const pageDescription = computed(() => {
  if (isViewMode.value) return "Lihat detail data routing";
  if (isCopyMode.value) return "Buat routing baru dari data yang disalin";
  if (isEditMode.value) return "Perbarui data routing";
  return "Buat data routing baru";
});

const values = reactive({
  m_unit_bisnis_id: "",
  code: "",
  name: "",
  is_mesin: false,
  note: "",
  status: true,
});

const errors = reactive({
  m_unit_bisnis_id: "",
  code: "",
  name: "",
});

const mesinDetails = ref<RoutingMesinDetail[]>([]);
const jobDetails = ref<RoutingJobDetail[]>([]);
const itemDetails = ref<RoutingItemDetail[]>([]);

const activeTab = ref(values.is_mesin ? "mesin" : "job");

watch(
  () => values.is_mesin,
  (newVal) => {
    if (newVal) {
      activeTab.value = "mesin";
    } else {
      if (activeTab.value === "mesin") {
        activeTab.value = "job";
      }
    }
  }
);

const selectedUnitBisnisCompanyName = ref<string>("");

const selectedMesinIds = computed(() => {
  return mesinDetails.value.map((m: any) => m.m_mesin_id).filter(Boolean);
});

const addSelectedMesin = (items: any[]) => {
  items.forEach((item) => {
    if (!mesinDetails.value.find((d: any) => d.m_mesin_id === item.id)) {
      mesinDetails.value.push({
        sequence: mesinDetails.value.length + 1,
        m_mesin_id: item.id,
        notes: "",
        m_mesin: item,
      });
    }
  });
};

const selectedItemIds = computed(() => {
  return itemDetails.value.map((item: any) => item.m_item_id).filter(Boolean);
});

const addSelectedItems = (items: any[]) => {
  items.forEach((item) => {
    if (!itemDetails.value.find((d: any) => d.m_item_id === item.id)) {
      itemDetails.value.push({
        sequence: itemDetails.value.length + 1,
        m_item_id: item.id,
        m_item: item,
      });
    }
  });
};

const handleUnitBisnisSelected = (item: any) => {
  selectedUnitBisnisCompanyName.value =
    item?.m_company?.nama || item?.m_company?.kode || "";
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

const newMesinDetail = (): RoutingMesinDetail => ({
  sequence: mesinDetails.value.length + 1,
  m_mesin_id: "",
  notes: "",
});

const newJobDetail = (): RoutingJobDetail => ({
  sequence: jobDetails.value.length + 1,
  job_id: "",
  notes: "",
});

const newItemDetail = (): RoutingItemDetail => ({
  sequence: itemDetails.value.length + 1,
  m_item_id: "",
});

const addMesinRow = () => mesinDetails.value.push(newMesinDetail());
const addJobRow = () => jobDetails.value.push(newJobDetail());
const addItemRow = () => itemDetails.value.push(newItemDetail());

const removeMesinRow = (index: number) => {
  mesinDetails.value.splice(index, 1);
  mesinDetails.value = mesinDetails.value.map((row, idx) => ({ ...row, sequence: idx + 1 }));
};

const removeJobRow = (index: number) => {
  jobDetails.value.splice(index, 1);
  jobDetails.value = jobDetails.value.map((row, idx) => ({ ...row, sequence: idx + 1 }));
};

const removeItemRow = (index: number) => {
  itemDetails.value.splice(index, 1);
  itemDetails.value = itemDetails.value.map((row, idx) => ({ ...row, sequence: idx + 1 }));
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
    code: "",
    name: "",
    is_mesin: false,
    note: "",
    status: true,
  });
  Object.assign(errors, {
    m_unit_bisnis_id: "",
    code: "",
    name: "",
  });
  selectedUnitBisnisCompanyName.value = "";
  mesinDetails.value = [];
  jobDetails.value = [];
  itemDetails.value = [];
  activeTab.value = values.is_mesin ? "mesin" : "job";

  applyCurrentUserUnitBisnis();
};

const normalizeBoolean = (value: unknown) =>
  value === true || value === 1 || value === "1" || value === "true";

const asArray = (value: unknown) => (Array.isArray(value) ? value : []);

const normalizeMesinDetails = (rows: any[] = []) =>
  rows.map((row: any, index: number) => ({
    id: row.id,
    m_routing_id: row.m_routing_id,
    sequence: row.sequence ?? index + 1,
    m_mesin_id: row.m_mesin_id ?? row.m_mesin?.id ?? "",
    notes: row.notes ?? row.note ?? "",
    m_mesin: row.m_mesin,
  }));

const normalizeJobDetails = (rows: any[] = []) =>
  rows.map((row: any, index: number) => ({
    id: row.id,
    m_routing_id: row.m_routing_id,
    sequence: row.sequence ?? index + 1,
    job_id: row.job_id ?? row.m_general?.id ?? row.m_gen?.id ?? "",
    notes: row.notes ?? row.note ?? "",
    m_general: row.m_general ?? row.m_gen,
  }));

const normalizeItemDetails = (rows: any[] = []) =>
  rows.map((row: any, index: number) => ({
    id: row.id,
    m_routing_id: row.m_routing_id,
    sequence: row.sequence ?? index + 1,
    m_item_id: row.m_item_id ?? row.m_items_id ?? row.m_items?.id ?? row.m_item?.id ?? "",
    m_item: row.m_item ?? row.m_items,
  }));

const onReset = () => resetForm();

onBeforeMount(async () => {
  onReset();

  const isCopyModeLocal = route.query.action === "copy" && route.query.source;
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value;

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) return;

  loading.value = true;
  try {
    const res = await getRoutingById(sourceId);
    if (res && res.data) {
      const rawData = res.data as any;
      auditMeta.value = {
        created_by: rawData.routing_ctr?.name || rawData.routing_ctr?.username || rawData.created_by,
        createdAt: rawData.createdAt,
        updated_by: rawData.routing_updt?.name || rawData.routing_updt?.username || rawData.update_by || rawData.updated_by,
        updatedAt: rawData.updatedAt,
      }
    }
    
    if (res.status !== "success") throw new Error("Gagal memuat data");

    const raw: any = res.data || {};
    values.m_unit_bisnis_id = raw.m_unit_bisnis_id ?? values.m_unit_bisnis_id;
    if (values.m_unit_bisnis_id) {
      fetchUnitBisnisCompanyName(values.m_unit_bisnis_id);
    }
    values.code = raw.code ?? "";
    values.name = raw.name ?? "";
    values.is_mesin = normalizeBoolean(raw.is_mesin ?? raw.key1);
    activeTab.value = values.is_mesin ? "mesin" : "job";
    values.note = raw.note ?? "";
    values.status = normalizeBoolean(raw.status ?? raw.is_active);

    const rawMesin = asArray(raw.m_routing_d_mesin || raw.m_routing_d_mesins || raw.Mesin || raw.m_routing_details);
    const rawJob = asArray(raw.m_routing_d_job || raw.m_routing_d_jobs || raw.Job || raw.m_routing_details2);
    const rawItem = asArray(raw.m_routing_d_item || raw.m_routing_d_items || raw.Item || raw.m_routing_details3);

    mesinDetails.value = normalizeMesinDetails(rawMesin);
    jobDetails.value = normalizeJobDetails(rawJob);
    itemDetails.value = normalizeItemDetails(rawItem);

    if (isCopyModeLocal) {
      delete raw.id;
      delete raw.createdAt;
      delete raw.updatedAt;
      values.code = "";
      mesinDetails.value.forEach((r: any) => {
        delete r.id;
        delete r.m_routing_id;
      });
      jobDetails.value.forEach((r: any) => {
        delete r.id;
        delete r.m_routing_id;
      });
      itemDetails.value.forEach((r: any) => {
        delete r.id;
        delete r.m_routing_id;
      });
    }

    toast.success(isCopyModeLocal ? "Data berhasil disalin" : "Data berhasil dimuat");
  } catch (error) {
    toast.error("Gagal memuat data Routing", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
    setTimeout(() => router.push("/production/master/m_routing"), 2000);
  } finally {
    loading.value = false;
  }
});

const buildMesinPayload = () =>
  mesinDetails.value
    .filter((row) => row.m_mesin_id || row.notes?.trim())
    .map((row, index) => ({
      m_mesin_id: row.m_mesin_id || undefined,
      sequence: index + 1,
      notes: row.notes?.trim() || undefined,
    }));

const buildJobPayload = () =>
  jobDetails.value
    .filter((row) => row.job_id || row.notes?.trim())
    .map((row, index) => ({
      job_id: row.job_id || undefined,
      sequence: index + 1,
      notes: row.notes?.trim() || undefined,
    }));

const buildItemPayload = () =>
  itemDetails.value
    .filter((row) => row.m_item_id)
    .map((row, index) => ({
      m_item_id: row.m_item_id || undefined,
      sequence: index + 1,
    }));

const onSave = async () => {
  Object.assign(errors, {
    m_unit_bisnis_id: "",
    code: "",
    name: "",
  });

  let invalid = false;
  if (!values.m_unit_bisnis_id) {
    errors.m_unit_bisnis_id = "Company wajib diisi";
    invalid = true;
  }
  if (!values.name?.trim()) {
    errors.name = "Nama Routing wajib diisi";
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
    const payload: Partial<RoutingItem> = {
      m_unit_bisnis_id: values.m_unit_bisnis_id || undefined,
      code: isEditMode.value ? (values.code?.trim() || undefined) : undefined,
      name: values.name?.trim() || undefined,
      is_mesin: values.is_mesin,
      note: values.note?.trim() || undefined,
      status: values.status,
      m_routing_d_mesin: values.is_mesin ? buildMesinPayload() : [],
      m_routing_d_job: values.is_mesin ? [] : buildJobPayload(),
      m_routing_d_item : buildItemPayload(),
    };

    if (isEditMode.value) {
      await updateRouting(menuId.value, payload);
      toast.success("Routing berhasil diperbarui");
    } else {
      await createRouting(payload);
      toast.success("Routing berhasil dibuat");
    }

    router.replace("/production/master/m_routing?reload=" + Date.now());
  } catch (error) {
    toast.error(isEditMode.value ? "Gagal memperbarui Routing" : "Gagal membuat Routing", {
      description: error instanceof Error ? error.message : "Terjadi kesalahan",
    });
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => router.push("/production/master/m_routing");
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
          <CardTitle>Informasi Routing</CardTitle>
          <CardDescription>Isi data routing sesuai struktur tabel</CardDescription>
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
                :hints="errors.m_unit_bisnis_id || (isUnitBisnisReadonly ? 'Unit bisnis otomatis dari user login' : 'Pilih unit bisnis untuk routing ini')"
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
                label="Routing Code"
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
                label="Route Name"
                :value="values.name"
                :errorname="errors.name ? 'failed' : ''"
                @input="(v) => (values.name = v)"
                :hints="errors.name || 'Masukkan nama routing'"
                :required="!isReadOnly"
                :disabled="loading || isReadOnly"
                :readonly="isReadOnly"
                placeholder="Routing A"
                class="w-full"
              />

              <div class="flex items-end gap-8">
                <FieldStatus
                  label="Is Machine"
                  name="is_mesin"
                  v-model="values.is_mesin"
                  :disabled="loading"
                  :readonly="isReadOnly"
                  active-text="Ya"
                  inactive-text="Tidak"
                />

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
              id="note"
              label="Catatan"
              :value="values.note"
              @input="(v) => (values.note = v)"
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
          <CardTitle>Routing Detail</CardTitle>
          <CardDescription>Kelola detail mesin, job, dan item</CardDescription>
        </CardHeader>
        <CardContent class="pt-0 space-y-4">
          <Tabs v-model="activeTab" class="w-full">
            <TabsList class="bg-muted/60 w-full justify-start">
              <TabsTrigger v-if="values.is_mesin" value="mesin">Mesin</TabsTrigger>
              <TabsTrigger v-if="!values.is_mesin" value="job">Job</TabsTrigger>
              <TabsTrigger  value="item">Item</TabsTrigger>
            </TabsList>

            <TabsContent v-if="values.is_mesin" value="mesin" class="mt-4 space-y-3">
              <div v-if="!isReadOnly">
                <ButtonMultiSelect
                  title="Pilih Mesin"
                  :disabled="loading || !values.m_unit_bisnis_id"
                  uniqueKey="id"
                  :excludeIds="selectedMesinIds"
                  :api="{
                    url: `${API_BASE_URL}/dynamic/m_mesin`,
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${authStore.token}`,
                    },
                    params: {
                      selectfield: 'id,code,name',
                      searchfield: 'code,name',
                      filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id || undefined,
                      join: 'true',
                    },
                    onsuccess: (response: any) => {
                      response.hasNext = response.pagination?.next_page ? true : false;
                      return response;
                    },
                  }"
                  :columns="[
                    { field: 'code', headerName: 'Kode', width: '160px', sortable: true, filterable: true },
                    { field: 'name', headerName: 'Nama Mesin', flex: 1, sortable: true, filterable: true },
                  ]"
                  @add="addSelectedMesin"
                />
              </div>

              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted/60">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium w-12">No</th>
                      <th class="px-3 py-2 text-left font-medium">Machine</th>
                      <th class="px-3 py-2 text-left font-medium">Notes</th>
                      <th v-if="!isReadOnly" class="px-3 py-2 text-center font-medium w-16">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="mesinDetails.length === 0">
                      <td :colspan="isReadOnly ? 3 : 4" class="text-center py-8 text-muted-foreground text-sm">
                        Belum ada mesin ditambahkan
                      </td>
                    </tr>
                    <tr v-for="(row, index) in mesinDetails" :key="index" class="border-t hover:bg-muted/30 transition-colors">
                      <td class="px-3 py-2 text-muted-foreground">{{ index + 1 }}</td>
                      <td class="px-3 py-2">
                        <span>{{ row.m_mesin?.name || row.m_mesin?.code || row.m_mesin_id || "-" }}</span>
                      </td>
                      <td class="px-3 py-2">
                        <input
                          v-if="!isReadOnly"
                          v-model="row.notes"
                          type="text"
                          class="w-full px-2 py-1 border rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="Notes"
                        />
                        <span v-else>{{ row.notes || "-" }}</span>
                      </td>
                      <td v-if="!isReadOnly" class="px-3 py-2 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          class="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          @click="removeMesinRow(index)"
                        >
                          <Trash2 class="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent v-if="!values.is_mesin" value="job" class="mt-4 space-y-3">
              <div v-if="!isReadOnly">
                <Button type="button" size="sm" @click="addJobRow" class="gap-1">
                  <Plus class="h-4 w-4" />
                  Add to List
                </Button>
              </div>

              <div class="border rounded-lg overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-muted/60">
                    <tr>
                      <th class="px-3 py-2 text-left font-medium w-12">No</th>
                      <th class="px-3 py-2 text-left font-medium">Job</th>
                      <th class="px-3 py-2 text-left font-medium">Notes</th>
                      <th v-if="!isReadOnly" class="px-3 py-2 text-center font-medium w-16">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="jobDetails.length === 0">
                      <td :colspan="isReadOnly ? 3 : 4" class="text-center py-8 text-muted-foreground text-sm">
                        Belum ada job ditambahkan
                      </td>
                    </tr>
                    <tr v-for="(row, index) in jobDetails" :key="index" class="border-t hover:bg-muted/30 transition-colors">
                      <td class="px-3 py-2 text-muted-foreground">{{ index + 1 }}</td>
                      <td class="px-3 py-2">
                        <FieldSelect
                          v-if="!isReadOnly"
                          :id="`job_${index}`"
                          :value="row.job_id || ''"
                          :api="{
                            url: `${API_BASE_URL}/dynamic/m_general`,
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${authStore.token}`,
                            },
                            params: {
                              no_pagination: 'true',
                              filter_column_group: 'JOB',
                              selectfield: 'id,value1,value2',
                              searchfield: 'value1,value2',
                            },
                          }"
                          display-field="value1"
                          value-field="id"
                          placeholder="Pilih Job"
                          :clearable="true"
                          @input="(v) => (row.job_id = v)"
                          @update:valueFull="(item) => (row.m_general = item || undefined)"
                          class="w-full"
                        />
                        <span v-else>{{ row.m_general?.value1 || row.job_id || "-" }}</span>
                      </td>
                      <td class="px-3 py-2">
                        <input
                          v-if="!isReadOnly"
                          v-model="row.notes"
                          type="text"
                          class="w-full px-2 py-1 border rounded text-sm bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="Notes"
                        />
                        <span v-else>{{ row.notes || "-" }}</span>
                      </td>
                      <td v-if="!isReadOnly" class="px-3 py-2 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          class="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          @click="removeJobRow(index)"
                        >
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
                      <th v-if="!isReadOnly" class="px-3 py-2 text-center font-medium w-16">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-if="itemDetails.length === 0">
                      <td :colspan="isReadOnly ? 2 : 3" class="text-center py-8 text-muted-foreground text-sm">
                        Belum ada item ditambahkan
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
                      <td v-if="!isReadOnly" class="px-3 py-2 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          class="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          @click="removeItemRow(index)"
                        >
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
