<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Search, Loader2 } from "lucide-vue-next";
import DataTableMultiSelect from "@/components/table/DataTableMultiSelect.vue";
import { apiCall } from "@/lib/api";

interface ApiConfig {
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  onsuccess?: (response: any) => any;
}

interface Column {
  key?: string;
  field?: string;
  label?: string;
  headerName?: string;
  width?: string | number;
  flex?: number;
  sortable?: boolean;
  filterable?: boolean;
  filter?: string;
  resizable?: boolean;
  wrapText?: boolean;
  cellClass?: string[];
  valueGetter?: (params: any) => any;
  valueFormatter?: (params: any) => any;
  render?: (item: any, index: number) => any;
  renderHtml?: (item: any, index: number) => string;
  checkboxSelection?: boolean;
  headerCheckboxSelection?: boolean;
}

interface Props {
  title?: string;
  api?: ApiConfig;
  columns?: Column[];
  disabled?: boolean;
  buttonClass?: string;
  excludeIds?: string[];
  searchKey?: string; // Field to search by (e.g., 'name', 'modul,name')
  displayKey?: string;
  uniqueKey?: string;
  singleSelect?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  title: "Add To List",
  disabled: false,
  buttonClass: "",
  columns: () => [],
  excludeIds: () => [],
  searchKey: "name",
  displayKey: "name",
  uniqueKey: "id",
  singleSelect: false,
});

const emit = defineEmits<{
  add: [items: any[]];
}>();

const loading = ref(false);
const loadingMore = ref(false);
const loadingSelectAll = ref(false);
const tableData = ref<any[]>([]);
const searchQuery = ref("");
const open = ref(false);
const hasMore = ref(true);
const currentPage = ref(1);
const selectedRows = ref<any[]>([]);
const tableRef = ref<any>(null);

// Filter data to exclude already selected items
const filteredTableData = computed(() => {
  if (!props.excludeIds || props.excludeIds.length === 0) {
    return tableData.value;
  }
  return tableData.value.filter(
    (item) => !props.excludeIds.includes(item[props.uniqueKey]),
  );
});

// Watch filtered data and auto-load more if too few items visible
watch(filteredTableData, async (newFilteredData: any[]) => {
  // If we have less than 10 visible items and there's more data available and not currently loading
  if (
    newFilteredData.length < 10 &&
    hasMore.value &&
    !loading.value &&
    !loadingMore.value &&
    open.value
  ) {
    // Auto load more to fill the view
    await handleLoadMore();
  }
});

// Transform columns to DataTable format
const tableColumns = computed(() => {
  const getNestedValue = (obj: any, path: string) => {
    if (!obj || !path) return "";
    const val = path.split(".").reduce((acc, part) => acc && acc[part], obj);
    return val !== undefined && val !== null ? val : "";
  };

  return props.columns.map((col) => {
    const key = col.field || col.key || "";
    const label = col.headerName || col.label || key;

    return {
      key,
      label,
      width: col.width ? String(col.width) : col.flex ? "100%" : undefined,
      sortable: col.sortable !== false,
      filterable: col.filter === "ColFilter",
      checkboxSelection: col.checkboxSelection,
      headerCheckboxSelection: col.headerCheckboxSelection,
      renderHtml: col.renderHtml,
      render: (item: any, index: number) => {
        if (col.valueGetter) {
          return col.valueGetter({
            node: { rowIndex: index },
            data: item,
          });
        }
        if (col.valueFormatter) {
          return col.valueFormatter({ value: getNestedValue(item, key) });
        }
        if (col.render) {
          return col.render(item, index);
        }
        return getNestedValue(item, key);
      },
    };
  });
});

const openDialog = () => {
  if (props.disabled) return;
  open.value = true;
  currentPage.value = 1;
  searchQuery.value = "";
  selectedRows.value = [];
  fetchData(true);
};

const closeDialog = () => {
  open.value = false;
  selectedRows.value = [];
};

const handleSearch = () => {
  currentPage.value = 1;
  tableData.value = [];
  fetchData(true);
};

const clearSearch = () => {
  searchQuery.value = "";
  handleSearch();
};

const handleLoadMore = () => {
  if (!loadingMore.value && hasMore.value) {
    currentPage.value++;
    fetchData(false);
  }
};

const handleSelectionChange = (rows: any[]) => {
  selectedRows.value = props.singleSelect ? rows.slice(0, 1) : rows;
};

const handleAdd = () => {
  if (selectedRows.value.length === 0) {
    return;
  }

  const items = [...selectedRows.value];
  closeDialog();
  try {
    emit("add", items);
  } catch (err) {
    console.error("Error in ButtonMultiSelect @add handler:", err);
  }
};

// Select all: fetch semua data tanpa pagination lalu langsung emit add
const handleSelectAll = async () => {
  if (!props.api) return;
  loadingSelectAll.value = true;
  try {
    const url = new URL(props.api.url);
    const endpoint = url.pathname.replace("/api", "");
    const queryParams = new URLSearchParams();
    if (props.api.params) {
      Object.entries(props.api.params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }
    // Override agar ambil semua tanpa pagination
    queryParams.set("no_pagination", "true");
    queryParams.delete("page");
    queryParams.delete("paginate");
    // Tambahkan search query jika ada
    if (searchQuery.value.trim()) {
      queryParams.set("search", searchQuery.value.trim());
    }
    let response: any = await apiCall(`${endpoint}?${queryParams.toString()}`, {
      method: "GET",
      headers: props.api.headers,
    });
    if (props.api.onsuccess) {
      response = props.api.onsuccess(response);
    }
    if (response.status === "success" && response.data) {
      const allItems: any[] = Array.isArray(response.data) ? response.data : [];
      const filtered = props.excludeIds?.length
        ? allItems.filter(
            (item: any) => !props.excludeIds!.includes(item[props.uniqueKey]),
          )
        : allItems;
      emit("add", filtered);
      closeDialog();
    }
  } catch (e) {
    console.error("Failed to select all items", e);
  } finally {
    loadingSelectAll.value = false;
  }
};

// Fetch data from API
const fetchData = async (reset = false) => {
  if (!props.api) return;

  if (reset) {
    loading.value = true;
    tableData.value = [];
  } else {
    loadingMore.value = true;
  }

  try {
    // Extract endpoint from full URL
    const url = new URL(props.api.url);
    const endpoint = url.pathname.replace("/api", "");

    // Build query params
    const queryParams = new URLSearchParams();

    // Add API params
    if (props.api.params) {
      Object.entries(props.api.params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          queryParams.append(key, String(value));
        }
      });
    }

    // Add pagination
    queryParams.append("page", String(currentPage.value));
    queryParams.append("paginate", "20");

    // Always add searchfield from params if exists (for backend filtering/searching)
    // Prioritize api.params.searchfield over props.searchKey to allow explicit configuration
    const searchField = props.api.params?.searchfield || props.searchKey;
    if (searchField) {
      // Remove searchfield from params if it was already added to avoid duplication
      queryParams.delete("searchfield");
      queryParams.append("searchfield", searchField);
    }

    // Add search query if exists
    if (searchQuery.value.trim()) {
      queryParams.append("search", searchQuery.value.trim());
    }

    const fullEndpoint = `${endpoint}?${queryParams.toString()}`;

    // Call API
    let response: any = await apiCall(fullEndpoint, {
      method: "GET",
      headers: props.api.headers,
    });

    // Apply onsuccess transformation if provided
    if (props.api.onsuccess) {
      response = props.api.onsuccess(response);
    }

    if (response.status === "success" && response.data) {
      const newData = Array.isArray(response.data) ? response.data : [];

      if (reset) {
        tableData.value = newData;
      } else {
        tableData.value = [...tableData.value, ...newData];
      }

      // Check if has more data
      if (response.hasNext !== undefined) {
        hasMore.value = response.hasNext;
      } else if (response.pagination?.next_page) {
        hasMore.value = true;
      } else {
        hasMore.value = newData.length >= 20;
      }
    } else {
      if (reset) {
        tableData.value = [];
      }
      hasMore.value = false;
    }
  } catch (error) {
    console.error("Failed to fetch data:", error);
    if (reset) {
      tableData.value = [];
    }
    hasMore.value = false;
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
};
</script>

<template>
  <div>
    <!-- Trigger Button -->
    <div @click="openDialog">
      <slot>
        <Button
          type="button"
          :disabled="disabled"
          :class="buttonClass"
        >
          {{ title }}
        </Button>
      </slot>
    </div>

    <!-- Modal Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="open"
          class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
          @click.self="closeDialog"
        >
          <!-- Backdrop -->
          <div
            class="absolute inset-0 bg-black/50 backdrop-blur-sm"
            @click="closeDialog"
          ></div>

          <!-- Modal Content -->
          <div
            class="relative w-full max-w-7xl h-[95vh] sm:h-[90vh] bg-background rounded-lg sm:rounded-xl shadow-2xl flex flex-col overflow-hidden z-10"
          >
            <!-- Header -->
            <div
              class="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b bg-background shrink-0"
            >
              <div class="flex-1 min-w-0">
                <h2
                  class="text-lg sm:text-xl font-bold text-foreground truncate"
                >
                  {{ title }}
                </h2>
                <p
                  class="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate"
                >
                  {{
                    singleSelect
                      ? "Pilih satu item yang ingin ditambahkan"
                      : "Pilih item yang ingin ditambahkan (bisa lebih dari satu)"
                  }}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                @click="closeDialog"
                class="h-9 w-9 sm:h-10 sm:w-10 rounded-full hover:bg-destructive/10 shrink-0 ml-2"
              >
                <X class="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>

            <!-- Search Bar -->
            <div
              class="px-4 py-3 sm:px-6 sm:py-4 border-b bg-muted/20 shrink-0"
            >
              <div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div class="relative flex-1">
                  <Input
                    v-model="searchQuery"
                    placeholder="Ketik untuk mencari data..."
                    class="pr-9 text-sm sm:text-base"
                    @keydown.enter="handleSearch"
                  />
                  <Button
                    v-if="searchQuery"
                    type="button"
                    size="icon"
                    variant="ghost"
                    class="absolute right-0 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-white"
                    @click="clearSearch"
                  >
                    <X class="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  @click="handleSearch"
                  :disabled="loading"
                  class="w-full sm:w-auto px-4 sm:px-6 text-sm sm:text-base"
                >
                  <Search class="h-4 w-4 mr-2" />
                  Cari
                </Button>
              </div>
            </div>

            <!-- Data Table -->
            <div
              class="flex-1 min-h-0 px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 overflow-hidden"
            >
              <DataTableMultiSelect
                ref="tableRef"
                :data="filteredTableData"
                :columns="tableColumns"
                :loading="loading"
                :loading-more="loadingMore"
                :has-more="hasMore"
                :single-select="singleSelect"
                @load-more="handleLoadMore"
                @selection-change="handleSelectionChange"
              />
            </div>

            <!-- Footer Actions -->
            <div
              class="px-4 py-3 sm:px-6 sm:py-4 border-t bg-background shrink-0"
            >
              <div class="flex items-center justify-between gap-3">
                <Button
                  v-if="!singleSelect"
                  variant="outline"
                  @click="handleSelectAll"
                  :disabled="loadingSelectAll || loading"
                  class="px-6 gap-2"
                >
                  <Loader2
                    v-if="loadingSelectAll"
                    class="h-4 w-4 animate-spin"
                  />
                  Pilih Semua
                </Button>
                <div v-else></div>
                <div class="flex items-center gap-3">
                  <Button variant="outline" @click="closeDialog" class="px-6">
                    Batal
                  </Button>
                  <Button
                    @click="handleAdd"
                    :disabled="selectedRows.length === 0"
                    class="px-6"
                  >
                    Tambahkan ({{ selectedRows.length }})
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
