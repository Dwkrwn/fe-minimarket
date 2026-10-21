<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-vue-next";
import { FieldDate, FieldNumber, FieldSelect, FieldTextarea, FieldX } from "@/components/field";
import { useApi } from "@/composables/useApi";
import { useAuthStore } from "@/stores/auth";
import { createPeriode, getPeriodeById, getPeriodeSummary, updatePeriode } from "./service";
import AuditInfo from "@/components/AuditInfo.vue";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { API_BASE_URL } = useApi();

const loading = ref(false);
const isEdit = computed(() => !!route.params.id && route.name === "StockOpnamePeriodeForm");
const isView = computed(() => route.name === "StockOpnamePeriodeView");
const isSuperAdmin = computed(() => authStore.isSuperAdmin);

const values = reactive({
  no_periode_opname: "",
  m_unit_bisnis_id: "",
  tgl_mulai: "",
  tgl_akhir: "",
  durasi_manual_hari: 0 as number | null,
  catatan: "",
  is_locked: false,
});
const isUnitBisnisReadonly = computed(() => isView.value || values.is_locked || !isSuperAdmin.value);

const errors = reactive({
  m_unit_bisnis_id: "",
  tgl_mulai: "",
  tgl_akhir: "",
  durasi_manual_hari: "",
});
const summary = ref<any>(null);
const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({});

// Nama company (perusahaan induk) dari Unit Bisnis yang dipilih.
// Selalu tampil sebagai field readonly di sebelah Unit Bisnis.
const selectedUnitBisnisCompanyName = ref<string>("");
const selectedUnitBisnisName = ref<string>("");

const handleUnitBisnisSelected = (item: any) => {
  selectedUnitBisnisName.value = item?.nama_comp || "";
  selectedUnitBisnisCompanyName.value =
    item?.m_company?.nama || item?.m_company?.kode || "";
};

const applyCurrentUserUnitBisnis = () => {
  if (isSuperAdmin.value) return;

  try {
    const selectRespo = localStorage.getItem("SelectRespo");
    if (!selectRespo) return;

    const parsed = JSON.parse(selectRespo);
    values.m_unit_bisnis_id = parsed.companyId || "";
    selectedUnitBisnisName.value =
      parsed.unitBisnisName || parsed.companyName || "";
    selectedUnitBisnisCompanyName.value =
      parsed.companyLegalName || selectedUnitBisnisCompanyName.value;
  } catch {
    // ignore
  }
};

// Untuk mode Edit/View atau saat unit bisnis terisi otomatis dari akun,
// FieldSelect tidak meng-emit valueFull saat load awal, jadi ambil nama
// company-nya via API sekali saja.
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
      selectedUnitBisnisName.value =
        result.data?.nama_comp ||
        result.data?.nama_unit_bisnis ||
        selectedUnitBisnisName.value;
      selectedUnitBisnisCompanyName.value =
        result.data?.m_company?.nama ||
        result.data?.m_company?.kode ||
        "-";
    }
  } catch {
    // ignore, field will just stay empty
  }
};

const splitSummary = computed(() => {
  const rows = summary.value?.opnames || [];
  const totals = summary.value?.totals || {};
  const fallback = rows.reduce(
    (acc: any, row: any) => {
      const details = row.t_stock_opname_ds || [];
      for (const detail of details) {
        const qtySelisih = Number(detail.qty_selisih || 0);
        const nilaiSelisih = Number(detail.nilai_selisih || 0);
        if (qtySelisih > 0) {
          acc.total_qty_selisih_plus += qtySelisih;
          acc.total_nilai_selisih_plus += nilaiSelisih;
          acc.total_data_plus += 1;
        } else if (qtySelisih < 0) {
          acc.total_qty_selisih_minus += Math.abs(qtySelisih);
          acc.total_nilai_selisih_minus += Math.abs(nilaiSelisih);
          acc.total_data_minus += 1;
        }
      }
      return acc;
    },
    {
      total_qty_selisih_plus: 0,
      total_qty_selisih_minus: 0,
      total_nilai_selisih_plus: 0,
      total_nilai_selisih_minus: 0,
      total_data_plus: 0,
      total_data_minus: 0,
    },
  );

  return {
    total_qty_selisih_plus: totals.total_qty_selisih_plus ?? fallback.total_qty_selisih_plus,
    total_qty_selisih_minus: totals.total_qty_selisih_minus ?? fallback.total_qty_selisih_minus,
    total_nilai_selisih_plus: totals.total_nilai_selisih_plus ?? fallback.total_nilai_selisih_plus,
    total_nilai_selisih_minus: totals.total_nilai_selisih_minus ?? fallback.total_nilai_selisih_minus,
    total_data_plus: totals.total_data_plus ?? fallback.total_data_plus,
    total_data_minus: totals.total_data_minus ?? fallback.total_data_minus,
  };
});
const autoDurasiHari = computed(() => {
  if (!values.tgl_mulai || !values.tgl_akhir) return 0;
  const start = new Date(values.tgl_mulai);
  const end = new Date(values.tgl_akhir);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 0;
});

watch(
  () => [values.tgl_mulai, values.tgl_akhir],
  () => {
    values.durasi_manual_hari = autoDurasiHari.value;
  },
  { immediate: true },
);

watch(
  () => values.tgl_mulai,
  () => {
    if (values.tgl_mulai && values.tgl_akhir && values.tgl_akhir < values.tgl_mulai) {
      values.tgl_akhir = "";
    }
  },
);

const validate = () => {
  errors.m_unit_bisnis_id = values.m_unit_bisnis_id ? "" : "Unit Bisnis wajib";
  errors.tgl_mulai = values.tgl_mulai ? "" : "Tgl mulai wajib";
  errors.tgl_akhir = values.tgl_akhir ? "" : "Tgl akhir wajib";
  if (values.tgl_mulai && values.tgl_akhir && values.tgl_akhir < values.tgl_mulai) {
    errors.tgl_akhir = "Tgl akhir tidak boleh sebelum tgl mulai";
  }
  errors.durasi_manual_hari =
    values.durasi_manual_hari !== null && Number(values.durasi_manual_hari) >= 0
      ? ""
      : "Durasi wajib >= 0";
  return !errors.m_unit_bisnis_id && !errors.tgl_mulai && !errors.tgl_akhir && !errors.durasi_manual_hari;
};

const save = async () => {
  if (isView.value || values.is_locked) return;
  if (!validate()) {
    toast.error("Validasi gagal");
    return;
  }

  loading.value = true;
  try {
    const payload: any = {
      ...values,
      durasi_manual_hari: Number(values.durasi_manual_hari || 0),
      created_by: authStore.user?.id || null,
      updated_by: authStore.user?.id || null,
    };

    if (isEdit.value) {
      await updatePeriode(String(route.params.id), payload);
      toast.success("Periode diperbarui");
    } else {
      if (!payload.no_periode_opname) {
        const date = new Date();
        const mm = String(date.getMonth() + 1).padStart(2, "0");
        const yy = String(date.getFullYear()).slice(-2);
        payload.no_periode_opname = `PRD-OPN-${yy}${mm}-${Date.now().toString().slice(-4)}`;
      }
      await createPeriode(payload);
      toast.success("Periode dibuat");
    }

    router.push("/inventory/transaksi/t_stock_opname_periode");
  } catch (error: any) {
    toast.error("Gagal simpan periode", { description: error?.message || "Error" });
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  if (!isEdit.value && !isView.value) {
    applyCurrentUserUnitBisnis();
    if (values.m_unit_bisnis_id) {
      fetchUnitBisnisCompanyName(values.m_unit_bisnis_id);
    }
    return;
  }
  loading.value = true;
  try {
    const res = await getPeriodeById(String(route.params.id));
    Object.assign(values, res.data || {});
    auditMeta.value = {
      created_by: res.data?.created_by,
      createdAt: res.data?.createdAt,
      updated_by: res.data?.update_by || res.data?.updated_by,
      updatedAt: res.data?.updatedAt,
    };
    if (values.m_unit_bisnis_id) {
      fetchUnitBisnisCompanyName(values.m_unit_bisnis_id);
    }
    const summaryRes = await getPeriodeSummary(String(route.params.id));
    summary.value = summaryRes.data;
  } catch {
    toast.error("Gagal memuat data");
    router.push("/inventory/transaksi/t_stock_opname_periode");
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="icon" @click="router.push('/inventory/transaksi/t_stock_opname_periode')">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <h1 class="text-2xl font-bold">
        {{
          isView ? "Detail Periode Stock Opname" : isEdit ? "Edit Periode Stock Opname" : "Tambah Periode Stock Opname"
        }}
      </h1>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Informasi Periode</CardTitle>
      </CardHeader>
      <CardContent class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FieldX id="no_periode_opname" label="No. Periode" :value="values.no_periode_opname || 'Auto'" :disabled="true" :readonly="true" />
        <FieldX id="is_locked" label="Status Lock" :value="values.is_locked ? 'LOCKED' : 'OPEN'" :disabled="true" :readonly="true" />

        <FieldSelect
          v-if="isSuperAdmin"
          id="m_unit_bisnis_id"
          label="Unit Bisnis"
          v-model="values.m_unit_bisnis_id"
          :errorname="errors.m_unit_bisnis_id ? 'failed' : ''"
          :hints="errors.m_unit_bisnis_id || (isSuperAdmin ? 'Pilih unit bisnis' : 'Unit bisnis otomatis dari user login')"
          :disabled="loading || isUnitBisnisReadonly"
          :readonly="isUnitBisnisReadonly"
          :api="{
            url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
            params: { filter_column_is_active: true, searchfield: 'nama_comp', join: 'true', paginate: 999 },
          }"
          valueField="id"
          displayField="nama_comp"
          placeholder="Pilih unit bisnis"
          :clearable="isSuperAdmin"
          @update:valueFull="handleUnitBisnisSelected"
        />
        <FieldX
          v-else
          id="m_unit_bisnis_id_display"
          label="Unit Bisnis"
          :value="selectedUnitBisnisName || '-'"
          :disabled="true"
          :readonly="true"
          placeholder="-"
          :hints="errors.m_unit_bisnis_id || 'Unit bisnis otomatis dari user login'"
          :errorname="errors.m_unit_bisnis_id ? 'failed' : ''"
        />

        <!-- Asal Company dari Unit Bisnis yang dipilih (selalu tampil, readonly) -->
        <FieldX
          id="m_unit_bisnis_company_display"
          label="Company"
          :value="selectedUnitBisnisCompanyName || '-'"
          :disabled="true"
          :readonly="true"
          placeholder="-"
          hints="Company dari Unit Bisnis yang dipilih"
        />

        <FieldNumber
          id="durasi_manual_hari"
          label="Durasi Periode (Hari)"
          v-model="values.durasi_manual_hari"
          :errorname="errors.durasi_manual_hari ? 'failed' : ''"
          :hints="errors.durasi_manual_hari || 'Otomatis dari tanggal mulai dan akhir'"
          :disabled="true"
          :readonly="true"
        />

        <FieldDate
          id="tgl_mulai"
          label="Tanggal Mulai"
          v-model="values.tgl_mulai"
          :errorname="errors.tgl_mulai ? 'failed' : ''"
          :hints="errors.tgl_mulai || 'Pilih tanggal mulai'"
          :disabled="loading || isView || values.is_locked"
        />
        <FieldDate
          id="tgl_akhir"
          label="Tanggal Akhir"
          v-model="values.tgl_akhir"
          :min="values.tgl_mulai"
          :errorname="errors.tgl_akhir ? 'failed' : ''"
          :hints="errors.tgl_akhir || 'Pilih tanggal akhir'"
          :disabled="loading || isView || values.is_locked"
        />

        <div class="md:col-span-2">
          <FieldTextarea
            id="catatan"
            label="Catatan"
            v-model="values.catatan"
            :disabled="loading || isView || values.is_locked"
            :rows="3"
          />
        </div>
      </CardContent>
    </Card>

    <Card v-if="summary">
      <CardHeader>
        <CardTitle>Ringkasan Opname APPROVED</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div>Jumlah Data +: <b>{{ splitSummary.total_data_plus || 0 }}</b></div>
          <div>Jumlah Data -: <b>{{ splitSummary.total_data_minus || 0 }}</b></div>
          <div>Total Qty Selisih +: <b>{{ splitSummary.total_qty_selisih_plus || 0 }}</b></div>
          <div>Total Qty Selisih -: <b>{{ splitSummary.total_qty_selisih_minus || 0 }}</b></div>
          <div>
            Total Nilai Selisih +:
            <b>Rp {{ Number(splitSummary.total_nilai_selisih_plus || 0).toLocaleString('id-ID') }}</b>
          </div>
          <div>
            Total Nilai Selisih -:
            <b>Rp {{ Number(splitSummary.total_nilai_selisih_minus || 0).toLocaleString('id-ID') }}</b>
          </div>
        </div>
        <div class="border rounded overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b">
                <th class="text-left p-2">No Stock Opname</th>
                <th class="text-left p-2">Tanggal</th>
                <th class="text-right p-2">Qty +</th>
                <th class="text-right p-2">Qty -</th>
                <th class="text-right p-2">Nilai +</th>
                <th class="text-right p-2">Nilai -</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="(summary?.opnames || []).length === 0">
                <td colspan="6" class="p-2 text-center text-muted-foreground">Belum ada opname APPROVED</td>
              </tr>
              <tr v-for="row in summary?.opnames || []" :key="row.id" class="border-b">
                <td class="p-2">{{ row.no_stock_opname || "-" }}</td>
                <td class="p-2">{{ row.tgl_opname || "-" }}</td>
                <td class="p-2 text-right">{{ row.total_qty_selisih_plus || 0 }}</td>
                <td class="p-2 text-right">{{ row.total_qty_selisih_minus || 0 }}</td>
                <td class="p-2 text-right">{{ Number(row.total_nilai_selisih_plus || 0).toLocaleString("id-ID") }}</td>
                <td class="p-2 text-right">{{ Number(row.total_nilai_selisih_minus || 0).toLocaleString("id-ID") }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <AuditInfo
      v-if="isView || isEdit"
      :created-by="auditMeta.created_by"
      :created-at="auditMeta.createdAt"
      :updated-by="auditMeta.updated_by"
      :updated-at="auditMeta.updatedAt"
    />

    <div class="flex justify-end gap-2" v-if="!isView">
      <Button @click="save" :disabled="loading || values.is_locked">Simpan</Button>
    </div>
  </div>
</template>
