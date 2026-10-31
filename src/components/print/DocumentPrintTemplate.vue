<script setup lang="ts">
type HeaderField = {
  label: string;
  value: string;
  colSpan?: 1 | 2;
};

type TableColumn = {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  widthClass?: string;
};

type SummaryRow = {
  label: string;
  value: string;
  bold?: boolean;
};

type SignatureItem = {
  label: string;
  name?: string;
  hint?: string;
};

const props = withDefaults(
  defineProps<{
    title: string;
    headerFields: HeaderField[];
    columns: TableColumn[];
    rows: Record<string, string>[];
    notes?: string;
    summaries?: SummaryRow[];
    signatures?: SignatureItem[];
    footerLeft?: string;
    footerRight?: string;
    emptyText?: string;
    logoSrc?: string;
    logoAlt?: string;
  }>(),
  {
    notes: "",
    summaries: () => [],
    signatures: () => [],
    footerLeft: "",
    footerRight: "",
    emptyText: "Tidak ada item",
    logoSrc: "/miniMarketLogo.png",
    logoAlt: "Logo",
  },
);

const alignClass = (align?: "left" | "center" | "right") => {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
};
</script>

<template>
  <div>
    <div class="flex items-start pb-3 border-b border-gray-300">
      <img
        :src="logoSrc"
        :alt="logoAlt"
        class="h-18 w-18 object-contain shrink-0"
      />
      <br>
      <div class="flex-1">
        <h1 class="text-2xl font-bold text-gray-900 tracking-[0.14em] text-center">
          {{ title }}
        </h1>
        <br></br>
        <div class="grid grid-cols-2 gap-x-12 gap-y-1.5 mt-4 text-sm text-gray-700">
          <div
            v-for="(field, index) in headerFields"
            :key="`${field.label}-${index}`"
            class="flex gap-2"
            :class="field.colSpan === 2 ? 'col-span-2' : ''"
          >
            <span class="w-24 shrink-0">{{ field.label }}</span>
            <span class="font-medium text-gray-900">: {{ field.value || "-" }}</span>
          </div>
        </div>
      </div>
    </div>

    <table class="w-full border-collapse text-sm mt-3" style="border: 1px solid #9ca3af;">
      <thead>
        <tr class="bg-gray-100">
          <th
            v-for="column in columns"
            :key="column.key"
            class="px-3 py-2 font-semibold text-gray-800"
            :class="[alignClass(column.align), column.widthClass]"
            style="border: 1px solid #9ca3af;"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="rows.length === 0">
          <td
            :colspan="columns.length"
            class="px-3 py-8 text-center text-gray-500"
            style="border: 1px solid #9ca3af;"
          >
            {{ emptyText }}
          </td>
        </tr>
        <tr v-for="(row, rowIndex) in rows" :key="rowIndex" class="align-top">
          <td
            v-for="column in columns"
            :key="`${column.key}-${rowIndex}`"
            class="px-3 py-2 text-sm text-gray-700"
            :class="alignClass(column.align)"
            style="border: 1px solid #9ca3af;"
          >
            {{ row[column.key] || "-" }}
          </td>
        </tr>
      </tbody>
    </table>

    <div style="border: 1px solid #9ca3af; border-top: none; margin-top: -1px;">
      <div class="px-3 py-2 text-sm flex justify-between gap-6">
        <div class="flex-1">
          <span class="text-gray-600">Catatan : </span>
          <span>{{ notes || "-" }}</span>
        </div>
        <div v-if="summaries.length" class="w-[280px]">
          <div
            v-for="(summary, index) in summaries"
            :key="`${summary.label}-${index}`"
            class="flex items-center justify-between gap-3 py-0.5"
            :class="summary.bold ? 'font-semibold border-t mt-1 pt-1' : ''"
          >
            <span>{{ summary.label }}</span>
            <span>{{ summary.value }}</span>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="signatures.length"
      class="mt-6"
      :class="signatures.length === 4 ? 'grid grid-cols-4 gap-4' : 'grid grid-cols-3 gap-4'"
    >
      <div
        v-for="(signature, index) in signatures"
        :key="`${signature.label}-${index}`"
        class="text-center"
      >
        <p class="text-sm font-medium mb-1">{{ signature.label }}</p>
        <p
          v-if="signature.name"
          class="text-sm font-semibold text-gray-900 mb-10"
        >
          {{ signature.name }}
        </p>
        <div v-else class="mb-16"></div>
        <div class="border-t border-gray-400 pt-2 mx-2">
          <p class="text-sm text-gray-500">{{ signature.hint || "(____________)" }}</p>
        </div>
      </div>
    </div>

    <div
      v-if="footerLeft || footerRight"
      class="mt-6 pt-3 border-t text-xs text-gray-400 flex justify-between gap-4"
    >
      <span>{{ footerLeft }}</span>
      <span class="text-right">{{ footerRight }}</span>
    </div>
  </div>
</template>
