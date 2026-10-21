<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from "vue";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Loader2, ChevronDown, Check } from "lucide-vue-next";
import { apiCall } from "@/lib/api";

interface ApiConfig {
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  fullUrl?: boolean; // If true, use URL as-is without baseURL
  onsuccess?: (response: any) => any;
}

interface FieldSelectProps {
  /** Field label */
  label?: string;
  /** Input value */
  value?: string | number;
  /** Input value (for v-model support) */
  modelValue?: string | number;
  /** Placeholder text */
  placeholder?: string;
  /** Error message or hint */
  hints?: string;
  /** Error state name */
  errorText?: "failed" | "";
  errorname?: "failed" | "";
  /** Is field required */
  required?: boolean;
  /** Is field disabled */
  disabled?: boolean;
  /** Is field readonly */
  readonly?: boolean;
  /** Custom class */
  class?: string;
  /** Field ID */
  id?: string;
  /** Display field name from API response */
  displayField?: string;
  /** Value field name from API response */
  valueField?: string;
  /** API configuration */
  api?: ApiConfig;
  /** Static options (if not using API) */
  options?: Array<Record<string, any>>;
  /** Allow clearable */
  clearable?: boolean;
  /** Additional bind props */
  bind?: Record<string, any>;
  /** Pre-loaded display label override (shown when selectOptions is empty or item not found) */
  displayValue?: string;
}

const props = withDefaults(defineProps<FieldSelectProps>(), {
  required: false,
  disabled: false,
  readonly: false,
  errorText: "",
  errorname: "",
  displayField: "label",
  valueField: "value",
  clearable: false,
  placeholder: "Pilih...",
});

const emit = defineEmits<{
  input: [value: string];
  "update:modelValue": [value: string];
  "update:valueFull": [item: Record<string, any> | null];
}>();

const loading = ref(false);
const selectOptions = ref<Array<Record<string, any>>>([]);
const searchQuery = ref("");
const open = ref(false);
const dropdownRef = ref<HTMLElement | null>(null); // trigger wrapper
const dropdownDirection = ref<"above" | "below">("below");
const overlayPos = ref({ top: 0, left: 0, width: 0 });
// Limit visible option count to 4 rows
const OPTION_ROW_HEIGHT = 40; // px, approximate row height
const optionsMaxHeight = computed(() => `${OPTION_ROW_HEIGHT * 4}px`);
const hasError = computed(() => props.errorText === "failed" || props.errorname === "failed");
const apiRequestKey = computed(() => {
  if (!props.api) return "";

  return JSON.stringify({
    url: props.api.url,
    fullUrl: Boolean(props.api.fullUrl),
    headers: props.api.headers || {},
    params: props.api.params || {},
  });
});

// Update overlay position relative to trigger
const updateOverlayPosition = () => {
  if (!dropdownRef.value) return;
  const rect = dropdownRef.value.getBoundingClientRect();
  overlayPos.value = {
    top: dropdownDirection.value === "below" ? rect.bottom + 6 : rect.top,
    left: rect.left,
    width: rect.width,
  };
};

// Decide dropdown direction (above/below) and update position
watch(open, (isOpen) => {
  if (isOpen && dropdownRef.value) {
    const rect = dropdownRef.value.getBoundingClientRect();
    const maxDropdownHeight = window.innerHeight * 0.6;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const showAbove = spaceBelow < 200 && spaceAbove > spaceBelow;
    dropdownDirection.value = showAbove ? "above" : "below";
    updateOverlayPosition();
    window.addEventListener("scroll", updateOverlayPosition, true);
    window.addEventListener("resize", updateOverlayPosition);
  } else {
    window.removeEventListener("scroll", updateOverlayPosition, true);
    window.removeEventListener("resize", updateOverlayPosition);
  }
});

// Support both value prop and modelValue prop
const currentValue = computed(() => {
  const val = props.modelValue ?? props.value ?? "";
  return String(val);
});

// Get display text for selected value
const displayText = computed(() => {
  if (!currentValue.value) return props.placeholder;

  const selected = selectOptions.value.find(
    (opt) => String(opt[props.valueField]) === currentValue.value,
  );

  return selected ? selected[props.displayField] : (props.displayValue || props.placeholder);
});

// Filtered options based on search query
const filteredOptions = computed(() => {
  if (!searchQuery.value) return selectOptions.value;

  const query = searchQuery.value.toLowerCase();
  return selectOptions.value.filter((opt) => {
    const displayValue = String(opt[props.displayField]).toLowerCase();
    return displayValue.includes(query);
  });
});

const handleValueChange = (newValue: any) => {
  const value = newValue ? String(newValue) : "";

  // Find full object
  const selectedObject = selectOptions.value.find(
    (opt) => String(opt[props.valueField]) === value,
  );

  emit("input", value);
  emit("update:modelValue", value);
  emit("update:valueFull", selectedObject || null);

  open.value = false;
  searchQuery.value = "";
};

const handleClear = (e: Event) => {
  e.stopPropagation();
  emit("input", "");
  emit("update:modelValue", "");
  emit("update:valueFull", null);
  open.value = false;
  searchQuery.value = "";
};

const toggleDropdown = () => {
  if (props.disabled || props.readonly || loading.value) return;

  // Fetch fresh data every time dropdown is opened
  if (!open.value) {
    fetchOptions();
  }

  open.value = !open.value;
  if (open.value) {
    setTimeout(() => {
      const searchInput = dropdownRef.value?.querySelector("input");
      searchInput?.focus();
    }, 50);
  }
};

// Close dropdown when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Node;

  // Check if click is inside trigger button
  if (dropdownRef.value && dropdownRef.value.contains(target)) {
    return;
  }

  // Check if click is inside any teleported dropdown (checking the actual target's closest parent)
  const clickedElement = event.target as HTMLElement;
  if (
    clickedElement.closest &&
    clickedElement.closest("[data-field-select-dropdown]")
  ) {
    return;
  }

  // Click is outside both - close dropdown
  open.value = false;
  searchQuery.value = "";
};

// Fetch data from API
const fetchOptions = async () => {
  if (!props.api) {
    // Use static options if provided
    if (props.options) {
      selectOptions.value = props.options;
    }
    return;
  }

  loading.value = true;
  try {
    let fullEndpoint: string;

    if (props.api.fullUrl) {
      // Use full URL as-is (for external APIs)
      const queryParams = new URLSearchParams();
      if (props.api.params) {
        Object.entries(props.api.params).forEach(([key, value]) => {
          queryParams.append(key, String(value));
        });
      }
      const separator = props.api.url.includes("?") ? "&" : "?";
      fullEndpoint = `${props.api.url}${separator}${queryParams.toString()}`;

      // Fetch directly without apiCall helper
      const response = await fetch(fullEndpoint, {
        method: "GET",
        headers: props.api.headers,
      });
      let data: any = await response.json();

      // Apply response transform if provided
      if (props.api.onsuccess) {
        data = props.api.onsuccess(data);
      }

      if (Array.isArray(data)) {
        // If array of strings, convert to array of objects
        if (data.length > 0 && typeof data[0] === "string") {
          selectOptions.value = data.map((item) => ({
            [props.valueField]: item,
            [props.displayField]: item,
          }));
        } else {
          selectOptions.value = data;
        }
      } else if (data.data && Array.isArray(data.data)) {
        selectOptions.value = data.data;
      } else {
        selectOptions.value = [];
        console.error("Invalid API response format", data);
      }
    } else {
      // Use internal API with baseURL
      const url = new URL(props.api.url);
      const endpoint = url.pathname.replace("/api", "");

      // Build query params
      const queryParams = new URLSearchParams();
      if (props.api.params) {
        Object.entries(props.api.params).forEach(([key, value]) => {
          queryParams.append(key, String(value));
        });
      }

      fullEndpoint = `${endpoint}?${queryParams.toString()}`;

      // Call API using apiCall helper
      let response: any = await apiCall(fullEndpoint, {
        method: "GET",
        headers: props.api.headers,
      });

      // Apply response transform if provided
      if (props.api.onsuccess) {
        response = props.api.onsuccess(response);
      }

      if (response.status === "success" && response.data) {
        selectOptions.value = Array.isArray(response.data) ? response.data : [];
      } else {
        selectOptions.value = [];
        console.error("Invalid API response format", response);
      }
    }
  } catch (error) {
    console.error("Failed to fetch select options:", error);
    selectOptions.value = [];
  } finally {
    loading.value = false;
  }
};

// Load static options on mount if provided
onMounted(() => {
  // Load static options
  if (props.options && props.options.length > 0) {
    selectOptions.value = props.options;
  }

  // Auto-fetch options if value exists but options are empty (for edit/view mode)
  // Optimization: Do NOT auto-fetch if displayValue is already provided, as it will fetch when opened anyway.
  if (currentValue.value && selectOptions.value.length === 0 && props.api && !props.displayValue) {
    fetchOptions();
  }

  document.addEventListener("click", handleClickOutside);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside);
});

// Watch value changes to fetch data when value is set (for edit/view mode)
watch(
  () => props.options,
  (newOptions) => {
    if (Array.isArray(newOptions)) {
      selectOptions.value = newOptions;
    } else if (!props.api) {
      selectOptions.value = [];
    }
  },
  { deep: true },
);

// Watch for value changes - auto-fetch if value exists but options are empty
watch(
  () => currentValue.value,
  (newValue) => {
    if (newValue && selectOptions.value.length === 0 && props.api && !loading.value && !props.displayValue) {
      fetchOptions();
    }
  },
);

// Reload when API config changes
watch(
  () => apiRequestKey.value,
  (newKey, oldKey) => {
    if (!newKey || newKey === oldKey) return;

    // Reload only when the dropdown is open OR when value exists (for edit mode)
    if (open.value || (currentValue.value && !props.displayValue)) {
      fetchOptions();
    }
  },
);

// Cleanup on unmount
onBeforeUnmount(() => {
  window.removeEventListener("scroll", updateOverlayPosition, true);
  window.removeEventListener("resize", updateOverlayPosition);
});
</script>

<template>
  <div :class="[props.class, { 'has-custom-height': props.class && /\bh-\d+/.test(props.class) }]">
    <Label
      v-if="label"
      :for="id"
      :class="{ required: required }"
      class="mb-2 block"
    >
      {{ label }}
    </Label>

    <div class="relative" ref="dropdownRef">
      <Button
        :id="id"
        type="button"
        variant="outline"
        role="combobox"
        :aria-expanded="open"
        :disabled="disabled || readonly || loading"
        :class="[
          'h-10 w-full justify-between font-normal hover:bg-primary/10 hover:text-foreground',
          { 'border-destructive': hasError },
          { 'pr-16': clearable && currentValue },
          !currentValue && 'text-muted-foreground',
        ]"
        v-bind="bind"
        @click="toggleDropdown"
      >
        <div class="flex items-center gap-2 flex-1 overflow-hidden text-left">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin shrink-0" />
          <span class="truncate" :title="String(displayText || '')">{{ displayText }}</span>
        </div>
        <ChevronDown
          :class="[
            'ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform',
            open && 'rotate-180',
          ]"
        />
      </Button>

      <!-- Clear Button -->
      <button
        v-if="clearable && currentValue && !disabled && !readonly"
        type="button"
        class="absolute right-8 top-0 h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-destructive z-10"
        @click="handleClear"
      >
        <X class="h-4 w-4" />
      </button>

      <!-- Dropdown Content via Teleport to avoid clipping -->
      <Teleport to="body">
        <div
          v-if="open"
          data-field-select-dropdown
          class="fixed z-9999 rounded-md border bg-popover shadow-md outline-none animate-in fade-in-0 zoom-in-95 pointer-events-auto"
          :style="{
            width: overlayPos.width + 'px',
            top: overlayPos.top + 'px',
            left: overlayPos.left + 'px',
            transform:
              dropdownDirection === 'above'
                ? 'translateY(calc(-100% - 6px))'
                : 'none',
          }"
          :class="
            dropdownDirection === 'above' ? 'origin-bottom' : 'origin-top'
          "
          @click.stop
        >
          <div class="flex flex-col p-0">
            <!-- Search Input -->
            <div class="border-b p-2">
              <div class="relative">
                <Input
                  v-model="searchQuery"
                  placeholder="Cari..."
                  class="h-9 pr-9"
                  @keydown.escape="open = false"
                  @click.stop
                />
                <button
                  v-if="searchQuery"
                  type="button"
                  class="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-white"
                  @click.stop="searchQuery = ''"
                >
                  <X class="h-4 w-4" />
                </button>
              </div>
            </div>

            <!-- Options List (max 4 rows, then scroll) -->
            <div
              class="overflow-y-auto p-1 scrollbar-thin"
              :style="{ maxHeight: optionsMaxHeight }"
              @wheel.stop
              @click.stop
            >
              <div
                v-if="filteredOptions.length === 0 && !loading"
                class="py-6 text-center text-sm text-muted-foreground"
              >
                {{ searchQuery ? "Tidak ditemukan" : "Tidak ada data" }}
              </div>

              <div
                v-for="option in filteredOptions"
                :key="option[valueField]"
                @click="handleValueChange(option[valueField])"
                :class="[
                  'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none transition-colors',
                  String(option[valueField]) === currentValue
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground',
                ]"
              >
                <Check
                  :class="[
                    'mr-2 h-4 w-4',
                    String(option[valueField]) === currentValue
                      ? 'opacity-100'
                      : 'opacity-0',
                  ]"
                />
                <span class="truncate" :title="String(option[displayField] || '')">{{ option[displayField] }}</span>
              </div>
            </div>
          </div>
        </div>
      </Teleport>
    </div>

    <p
      v-if="hints"
      :class="hasError ? 'text-destructive' : 'text-muted-foreground'"
      class="text-sm mt-1"
    >
      {{ hints }}
    </p>
  </div>
</template>

<style scoped>
.required::after {
  content: " *";
  color: #ef4444;
  font-weight: bold;
}

/* Smooth scrollbar */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.3);
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.5);
}

/* Firefox scrollbar */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent;
}

.has-custom-height .relative {
  height: 100%;
}

.has-custom-height button[role="combobox"] {
  height: 100% !important;
  min-height: 0 !important;
}

.has-custom-height button.absolute.right-8 {
  height: 100% !important;
  width: 2.5rem !important;
  top: 0 !important;
}
</style>
