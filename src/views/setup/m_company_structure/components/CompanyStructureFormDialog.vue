<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogScrollContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FieldX,
  FieldSelect,
  FieldStatus,
  FieldDate,
  FieldTextarea,
  FieldNumber,
} from "@/components/field";
import type { CompanyStructureFormValues } from "../service";
import { useAuthStore } from "@/stores/auth";

const props = defineProps<{
  open: boolean;
  title: string;
  description: string;
  mode: "create" | "edit" | "view";
  readonly?: boolean;
  form: CompanyStructureFormValues;
  excludedParentIds: string[];
  submitting?: boolean;
  errorMessage?: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  submit: [];
}>();

const authStore = useAuthStore();
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const filterParentResponse = (response: {
  data?: Record<string, unknown>[];
}) => ({
  ...response,
  data: (response?.data ?? []).filter((item) => {
    const id = String(item.id ?? "");
    return id && !props.excludedParentIds.includes(id);
  }),
});
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogScrollContent class="!max-w-5xl w-[96vw]">
      <DialogHeader>
        <DialogTitle class="text-xl font-semibold">
          {{ title }}
        </DialogTitle>
        <DialogDescription>
          {{ description }}
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="errorMessage"
        class="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground"
      >
        {{ errorMessage }}
      </div>

      <div class="grid gap-6 py-2">
        <div class="grid gap-6 md:grid-cols-3">
          <FieldSelect
            label="Company"
            v-model="form.companyId"
            :api="{
              url: `${API_BASE_URL}/dynamic/m_company`,
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authStore.token}`,
              },
              params: {
                no_pagination: 'true',
                searchfield: 'nama,kode',
                filter_column_status: true,
              },
            }"
            valueField="id"
            displayField="nama"
            :disabled="mode === 'edit' || readonly"
            placeholder="Pilih company"
            class="w-full"
          />

          <FieldSelect
            :model-value="form.unitBisnisId ?? ''"
            @update:model-value="(v) => (form.unitBisnisId = v || null)"
            label="Unit Bisnis"
            :api="{
              url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authStore.token}`,
              },
              params: {
                no_pagination: 'true',
                filter_column_is_active: 'true',
                searchfield: 'nama_comp,kode_unit_bisnis',
                filter_column_company_id: form.companyId || undefined,
              },
            }"
            valueField="id"
            displayField="nama_comp"
            :disabled="!form.companyId || readonly"
            clearable
            placeholder="Opsional, pilih cabang"
            class="w-full"
          />

          <FieldSelect
            label="Parent Position"
            :model-value="form.parentId ?? ''"
            @update:model-value="(v) => (form.parentId = v || null)"
            :api="{
              url: `${API_BASE_URL}/dynamic/m_company_structure`,
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authStore.token}`,
              },
              params: {
                no_pagination: 'true',
                order_by: 'sequence',
                order_type: 'ASC',
                include: 'user_default:id|name|username',
                searchfield: 'jabatan',
                filter_column_company_id: form.companyId,
              },
              onsuccess: filterParentResponse,
            }"
            valueField="id"
            displayField="jabatan"
            :disabled="!form.companyId || readonly"
            clearable
            placeholder="Root Position"
            class="w-full"
          />
        </div>

        <div class="grid gap-6 md:grid-cols-[minmax(0,1fr)_140px_140px]">
          <FieldX
            label="Jabatan"
            v-model="form.jabatan"
            :readonly="readonly"
            placeholder="Contoh: Head of Finance"
            class="w-full"
          />

          <FieldX label="Level" :value="form.level" readonly class="w-full" />

          <FieldNumber
            label="Sequence"
            :value="form.sequence"
            :min="1"
            readonly
            placeholder="Urutan"
            class="w-full"
          />
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <FieldSelect
            label="User"
            :disabled="
              (!form.unitBisnisId && !form.companyId) || mode === 'edit' || readonly
            "
            :model-value="form.userDefaultId ?? ''"
            @update:model-value="(v) => (form.userDefaultId = v || null)"
            :api="{
              url: `${API_BASE_URL}/dynamic/user_default`,
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${authStore.token}`,
              },
              params: {
                no_pagination: 'true',
                filter_column_is_active: 'true',
                filter_column_m_kary_id: null,
                filter_operator_m_kary_id: '<>',
                join: 'true',
                'filter_column_m_kary.m_unit_bisnis_id': form.unitBisnisId,
                'filter_column_m_kary.company_id': form.companyId,
                searchfield: 'name,username',
              },
            }"
            valueField="id"
            displayField="name"
            clearable
            placeholder="Pilih user"
            class="w-full"
          />

          <FieldStatus
            label="Status aktif"
            v-model="form.isActive"
            active-text="Aktif"
            inactive-text="Tidak Aktif"
            :disabled="readonly"
          />
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <FieldDate
            label="Effective Start"
            :value="form.effectiveStart"
            @input="(v) => (form.effectiveStart = v || null)"
            placeholder="Tanggal mulai"
            clearable
            :disabled="readonly"
            class="w-full"
          />

          <FieldDate
            label="Effective End"
            :value="form.effectiveEnd"
            @input="(v) => (form.effectiveEnd = v || null)"
            placeholder="Tanggal selesai"
            clearable
            :disabled="readonly"
            class="w-full"
          />
        </div>

        <FieldTextarea
          label="Catatan"
          v-model="form.catatan"
          :readonly="readonly"
          placeholder="Tambahkan catatan posisi, area kerja, atau aturan khusus..."
          :rows="4"
          class="w-full"
        />
      </div>

      <DialogFooter class="gap-2 sm:justify-between">
        <p class="text-xs text-muted-foreground">
          {{
            readonly
              ? "Mode baca aktif. Tutup dialog ini untuk kembali ke chart."
              : "Perubahan struktur akan langsung memengaruhi tampilan chart company."
          }}
        </p>

        <div class="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            @click="emit('update:open', false)"
          >
            {{ readonly ? "Tutup" : "Batal" }}
          </Button>
          <Button v-if="!readonly" type="button" :disabled="submitting" @click="emit('submit')">
            {{
              submitting
                ? "Menyimpan..."
                : mode === "create"
                  ? "Simpan Struktur"
                  : "Update Struktur"
            }}
          </Button>
        </div>
      </DialogFooter>
    </DialogScrollContent>
  </Dialog>
</template>
