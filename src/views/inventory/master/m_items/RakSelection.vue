<script setup lang="ts">
import { ref, computed } from "vue";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronRight, ChevronDown, Check, Minus, X } from "lucide-vue-next";
import type { UnitBisnis, Gudang, Rak, RakDetail } from "./service";

const props = defineProps<{
  modelValue: string[]; // Array of selected rak_d_ids
  data: UnitBisnis[];
  readOnly?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string[]): void;
}>();

// ============================================================================
// STATE
// ============================================================================

const activeUnitBisnisId = ref<string | null>(null);
const activeGudangId = ref<string | null>(null);
const expandedRaks = ref<Set<string>>(new Set());
const rakSearch = ref("");
const gudangSearch = ref("");
const unitBisnisSearch = ref("");

// ============================================================================
// COMPUTED DATA FOR COLUMNS
// ============================================================================

const activeUnitBisnis = computed(() =>
  props.data.find((ub) => ub.id === activeUnitBisnisId.value),
);

const activeGudang = computed(() =>
  activeUnitBisnis.value?.m_gudangs.find((g) => g.id === activeGudangId.value),
);

const normalizedRakSearch = computed(() => rakSearch.value.trim().toLowerCase());
const normalizedGudangSearch = computed(() => gudangSearch.value.trim().toLowerCase());
const normalizedUnitBisnisSearch = computed(() => unitBisnisSearch.value.trim().toLowerCase());

// Filtered Unit Bisnis based on search
const filteredUnitBisnis = computed(() => {
  const keyword = normalizedUnitBisnisSearch.value;
  if (!keyword) return props.data;

  return props.data.filter((ub) => {
    const ubMatch = ub.nama_comp?.toLowerCase().includes(keyword);
    const kodeMatch = ub.kode_unit_bisnis?.toLowerCase().includes(keyword);
    return ubMatch || kodeMatch;
  });
});

// Filtered Gudang based on search
const filteredGudang = computed(() => {
  const gudangs = activeUnitBisnis.value?.m_gudangs || [];
  const keyword = normalizedGudangSearch.value;

  if (!keyword) return gudangs;

  return gudangs.filter((gudang) => {
    const gudangMatch = gudang.nama_gudang?.toLowerCase().includes(keyword);
    return gudangMatch;
  });
});

const filteredRaks = computed(() => {
  const racks = activeGudang.value?.m_raks || [];
  const keyword = normalizedRakSearch.value;

  if (!keyword) return racks;

  return racks.filter((rak) => {
    const rakMatch = rak.nama_rak?.toLowerCase().includes(keyword);
    const detailMatch = rak.m_rak_ds.some((detail) => {
      const detailText = [
        detail.kode,
        `b${detail.baris}`,
        `k${detail.kolom}`,
        `b${detail.baris}:k${detail.kolom}`,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return detailText.includes(keyword);
    });

    return rakMatch || detailMatch;
  });
});

// List helper to flatten all selectable IDs
// Returns Set of IDs
const getAllChildIds = (item: UnitBisnis | Gudang | Rak): string[] => {
  const ids: string[] = [];

  if ("m_gudangs" in item) {
    // Unit Bisnis
    item.m_gudangs.forEach((g) => ids.push(...getAllChildIds(g)));
  } else if ("m_raks" in item) {
    // Gudang
    item.m_raks.forEach((r) => ids.push(...getAllChildIds(r)));
  } else if ("m_rak_ds" in item) {
    // Rak
    item.m_rak_ds.forEach((rd) => ids.push(rd.id));
  }

  return ids;
};

// ============================================================================
// SELECTION LOGIC
// ============================================================================

const isSelected = (id: string) => props.modelValue.includes(id);

const toggleSelection = (ids: string[], checked: boolean) => {
  if (props.readOnly) return;
  const currentSet = new Set(props.modelValue);
  if (checked) {
    ids.forEach((id) => currentSet.add(id));
  } else {
    ids.forEach((id) => currentSet.delete(id));
  }
  emit("update:modelValue", Array.from(currentSet));
};

// CHECKBOX STATES (Checked, Unchecked, Indeterminate)

const getSelectionState = (item: UnitBisnis | Gudang | Rak) => {
  const allIds = getAllChildIds(item);
  if (allIds.length === 0) return "unchecked";

  const selectedCount = allIds.filter((id) =>
    props.modelValue.includes(id),
  ).length;

  if (selectedCount === 0) return "unchecked";
  if (selectedCount === allIds.length) return "checked";
  return "indeterminate";
};

const getSelectedCount = (item: UnitBisnis | Gudang | Rak) => {
  const allIds = getAllChildIds(item);
  return allIds.filter((id) => props.modelValue.includes(id)).length;
};

// Count gudang yang memiliki minimal 1 rak terpilih (untuk badge Unit Bisnis)
const getSelectedGudangCount = (ub: UnitBisnis) => {
  return ub.m_gudangs.filter((g) =>
    getAllChildIds(g).some((id) => props.modelValue.includes(id)),
  ).length;
};

// Count rak yang memiliki minimal 1 rak_d terpilih (untuk badge Gudang)
const getSelectedRakCount = (gudang: Gudang) => {
  return gudang.m_raks.filter((r) =>
    getAllChildIds(r).some((id) => props.modelValue.includes(id)),
  ).length;
};

// HANDLERS

const handleUnitBisnisClick = (ub: UnitBisnis) => {
  activeUnitBisnisId.value = ub.id;
  // Auto select first gudang if available? Optional.
  activeGudangId.value = null; // Reset gudang selection
};

const handleGudangClick = (g: Gudang) => {
  activeGudangId.value = g.id;
};

const toggleRakExpand = (rakId: string) => {
  const newSet = new Set(expandedRaks.value);
  if (newSet.has(rakId)) {
    newSet.delete(rakId);
  } else {
    newSet.add(rakId);
  }
  expandedRaks.value = newSet;
};

const handleCheckboxChange = (
  item: UnitBisnis | Gudang | Rak | RakDetail,
  checked: boolean,
) => {
  // If RakDetail (leaf node)
  if (
    "kolom" in item ||
    (!("m_gudangs" in item) && !("m_raks" in item) && !("m_rak_ds" in item))
  ) {
    toggleSelection([(item as RakDetail).id], checked);
    return;
  }

  // If Parent (UnitBisnis, Gudang, Rak)
  const allIds = getAllChildIds(item as UnitBisnis | Gudang | Rak);
  toggleSelection(allIds, checked);
};
</script>

<template>
  <div class="overflow-hidden rounded-lg border bg-background shadow-sm">
    <div
      class="grid grid-cols-1 divide-y md:h-[560px] md:grid-cols-[minmax(190px,0.9fr)_minmax(230px,1fr)_minmax(360px,1.45fr)] md:divide-x md:divide-y-0"
    >
      <!-- COLUMN 1: UNIT BISNIS -->
      <div class="flex min-h-[260px] min-w-0 flex-col md:h-full">
        <div class="sticky top-0 z-10 border-b bg-muted/40 p-3 text-sm font-semibold">
          Unit Bisnis
        </div>
        <ScrollArea class="h-[220px] md:h-full md:flex-1">
          <div class="p-2 space-y-1">
            <!-- Search Input for Unit Bisnis -->
            <div class="sticky top-0 z-10 bg-background pb-2">
              <div class="relative">
                <Input
                  v-model="unitBisnisSearch"
                  placeholder="Cari unit bisnis..."
                  class="h-9 pr-9"
                  :disabled="readOnly && data.length === 0"
                />
                <button
                  v-if="unitBisnisSearch"
                  type="button"
                  class="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-white"
                  @click="unitBisnisSearch = ''"
                >
                  <X class="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <!-- Unit Bisnis List -->
            <div
              v-for="ub in filteredUnitBisnis"
              :key="ub.id"
              class="flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors text-sm"
              :class="
                activeUnitBisnisId === ub.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted'
              "
              @click="handleUnitBisnisClick(ub)"
            >
              <span class="truncate font-medium">{{ ub.nama_comp }}</span>
              <div class="flex shrink-0 items-center gap-2">
                <Badge
                  v-if="getSelectedGudangCount(ub) > 0"
                  variant="secondary"
                  class="text-xs px-1.5 h-5"
                  title="Jumlah gudang terpilih"
                >
                  {{ getSelectedGudangCount(ub) }}
                </Badge>
                <ChevronRight class="h-4 w-4 opacity-50" />
              </div>
            </div>

            <!-- Empty State for Unit Bisnis -->
            <div
              v-if="filteredUnitBisnis.length === 0"
              class="flex flex-col items-center justify-center p-8 text-muted-foreground text-center"
            >
              <span class="text-sm">Unit bisnis tidak ditemukan</span>
            </div>
          </div>
        </ScrollArea>
      </div>

      <!-- COLUMN 2: GUDANG -->
      <div class="flex min-h-[300px] min-w-0 flex-col md:h-full">
        <div class="sticky top-0 z-10 border-b bg-muted/40 p-3 text-sm font-semibold">Gudang</div>
        <ScrollArea class="h-[260px] md:h-full md:flex-1">
          <div v-if="activeUnitBisnis" class="p-2 space-y-1">
            <!-- Search Input for Gudang -->
            <div class="sticky top-0 z-10 bg-background pb-2">
              <div class="relative">
                <Input
                  v-model="gudangSearch"
                  placeholder="Cari gudang..."
                  class="h-9 pr-9"
                  :disabled="readOnly && activeUnitBisnis.m_gudangs.length === 0"
                />
                <button
                  v-if="gudangSearch"
                  type="button"
                  class="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-white"
                  @click="gudangSearch = ''"
                >
                  <X class="h-4 w-4" />
                </button>
              </div>
            </div>

            <!-- Gudang List -->
            <div
              v-for="gudang in filteredGudang"
              :key="gudang.id"
              class="group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors text-sm"
              :class="
                activeGudangId === gudang.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-muted'
              "
              @click="handleGudangClick(gudang)"
            >
              <div class="flex items-center gap-3 overflow-hidden flex-1">
                <div
                  v-if="!readOnly"
                  @click.stop="
                    handleCheckboxChange(
                      gudang,
                      getSelectionState(gudang) !== 'checked',
                    )
                  "
                  class="flex items-center cursor-pointer"
                >
                  <div
                    class="grid place-content-center h-4 w-4 shrink-0 rounded-sm border border-primary shadow pointer-events-none transition-colors"
                    :class="
                      getSelectionState(gudang) === 'checked' ||
                      getSelectionState(gudang) === 'indeterminate'
                        ? 'bg-primary text-primary-foreground'
                        : ''
                    "
                  >
                    <Check
                      v-if="getSelectionState(gudang) === 'checked'"
                      class="h-3 w-3"
                    />
                    <Minus
                      v-if="getSelectionState(gudang) === 'indeterminate'"
                      class="h-3 w-3"
                    />
                  </div>
                </div>
                <label
                  class="truncate font-medium cursor-pointer flex-1"
                  @click.stop="
                    handleCheckboxChange(
                      gudang,
                      getSelectionState(gudang) !== 'checked',
                    )
                  "
                  >{{ gudang.nama_gudang }}</label
                >
              </div>
              <div class="flex shrink-0 items-center gap-2">
                <Badge
                  v-if="getSelectedRakCount(gudang) > 0"
                  variant="secondary"
                  class="text-xs px-1.5 h-5"
                  title="Jumlah rak terpilih"
                >
                  {{ getSelectedRakCount(gudang) }}
                </Badge>
                <ChevronRight class="h-4 w-4 opacity-50" />
              </div>
            </div>

            <!-- Empty State for Gudang -->
            <div
              v-if="activeUnitBisnis.m_gudangs.length === 0"
              class="flex flex-col items-center justify-center p-8 text-muted-foreground text-center"
            >
              <span class="text-sm">Tidak ada gudang di unit bisnis ini</span>
            </div>
            <div
              v-else-if="filteredGudang.length === 0"
              class="flex flex-col items-center justify-center p-8 text-muted-foreground text-center"
            >
              <span class="text-sm">Gudang tidak ditemukan</span>
            </div>
          </div>
          <div
            v-else
            class="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center"
          >
            <span class="text-sm">Pilih Unit Bisnis</span>
          </div>
        </ScrollArea>
      </div>

      <!-- COLUMN 3: RAK -->
      <div class="flex min-h-[360px] min-w-0 flex-col md:h-full">
        <div class="sticky top-0 z-10 border-b bg-muted/40 p-3 text-sm font-semibold">Rak</div>
        <ScrollArea class="h-[340px] md:h-full md:flex-1">
          <div v-if="activeGudang" class="p-2 space-y-1">
            <div class="sticky top-0 z-10 bg-background pb-2">
              <div class="relative">
                <Input
                  v-model="rakSearch"
                  placeholder="Cari rak / detail rak..."
                  class="h-9 pr-9"
                  :disabled="readOnly && activeGudang.m_raks.length === 0"
                />
                <button
                  v-if="rakSearch"
                  type="button"
                  class="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-white"
                  @click="rakSearch = ''"
                >
                  <X class="h-4 w-4" />
                </button>
              </div>
            </div>
            <div
              v-for="rak in filteredRaks"
              :key="rak.id"
              class="space-y-1"
            >
              <!-- Rak Header -->
              <div
                class="flex items-center justify-between p-2 rounded-md hover:bg-muted cursor-pointer transition-colors text-sm"
                :class="expandedRaks.has(rak.id) ? 'bg-muted/50' : ''"
                @click="toggleRakExpand(rak.id)"
              >
                <div class="flex items-center gap-3 overflow-hidden flex-1">
                  <div
                    v-if="!readOnly"
                    @click.stop="
                      handleCheckboxChange(
                        rak,
                        getSelectionState(rak) !== 'checked',
                      )
                    "
                    class="flex items-center cursor-pointer"
                  >
                    <div
                      class="grid place-content-center h-4 w-4 shrink-0 rounded-sm border border-primary shadow pointer-events-none transition-colors"
                      :class="
                        getSelectionState(rak) === 'checked' ||
                        getSelectionState(rak) === 'indeterminate'
                          ? 'bg-primary text-primary-foreground'
                          : ''
                      "
                    >
                      <Check
                        v-if="getSelectionState(rak) === 'checked'"
                        class="h-3 w-3"
                      />
                      <Minus
                        v-if="getSelectionState(rak) === 'indeterminate'"
                        class="h-3 w-3"
                      />
                    </div>
                  </div>
                  <label
                    class="truncate font-medium cursor-pointer flex-1"
                    @click.stop="
                      handleCheckboxChange(
                        rak,
                        getSelectionState(rak) !== 'checked',
                      )
                    "
                    >{{ rak.nama_rak }}</label
                  >
                </div>
                <div class="flex items-center gap-2">
                  <Badge
                    v-if="getSelectedCount(rak) > 0"
                    variant="secondary"
                    class="text-xs px-1.5 h-5"
                    title="Jumlah detail rak terpilih"
                  >
                    {{ getSelectedCount(rak) }}
                  </Badge>
                  <ChevronDown
                    class="h-4 w-4 transition-transform duration-200"
                    :class="expandedRaks.has(rak.id) ? 'rotate-180' : ''"
                  />
                </div>
              </div>

              <!-- Rak Details (Children) -->
              <div
                v-if="expandedRaks.has(rak.id)"
                class="space-y-1 pb-2 pl-6 pr-1 sm:pl-9 sm:pr-2"
              >
                <div
                  v-for="detail in rak.m_rak_ds"
                  :key="detail.id"
                  class="flex items-center gap-3 p-1.5 rounded-md hover:bg-muted text-sm"
                  @click.stop="
                    handleCheckboxChange(detail, !isSelected(detail.id))
                  "
                >
                  <div
                    v-if="!readOnly"
                    @click.stop="
                      handleCheckboxChange(detail, !isSelected(detail.id))
                    "
                    class="flex items-center cursor-pointer"
                  >
                    <div
                      class="grid place-content-center h-4 w-4 shrink-0 rounded-sm border border-primary shadow pointer-events-none transition-colors"
                      :class="
                        isSelected(detail.id)
                          ? 'bg-primary text-primary-foreground'
                          : ''
                      "
                    >
                      <Check v-if="isSelected(detail.id)" class="h-3 w-3" />
                    </div>
                  </div>
                  <div
                    request-selection-indicator
                    v-else-if="isSelected(detail.id)"
                    class="text-primary font-bold"
                  >
                    ✓
                  </div>
                  <label
                    class="min-w-0 flex-1 cursor-pointer select-none break-words text-muted-foreground"
                    @click.stop
                  >
                    {{ detail.kode }}
                    <span class="text-xs opacity-70 ml-1"
                      >(B{{ detail.baris }}:K{{ detail.kolom }})</span
                    >
                  </label>
                </div>
                <div
                  v-if="rak.m_rak_ds.length === 0"
                  class="text-xs text-muted-foreground italic py-1"
                >
                  Tidak ada detail rak
                </div>
              </div>
            </div>
            <div
              v-if="activeGudang.m_raks.length === 0"
              class="flex flex-col items-center justify-center p-8 text-muted-foreground text-center"
            >
              <span class="text-sm">Tidak ada data Rak di gudang ini</span>
            </div>
            <div
              v-else-if="filteredRaks.length === 0"
              class="flex flex-col items-center justify-center p-8 text-muted-foreground text-center"
            >
              <span class="text-sm">Rak tidak ditemukan</span>
            </div>
          </div>
          <div
            v-else
            class="flex flex-col items-center justify-center h-full text-muted-foreground p-4 text-center"
          >
            <span class="text-sm">Pilih Gudang</span>
          </div>
        </ScrollArea>
      </div>
    </div>
  </div>
</template>
