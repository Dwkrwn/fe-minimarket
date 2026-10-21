<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { reactive } from "vue";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FieldX,
  FieldNumber,
  FieldTextarea,
  FieldStatus,
  FieldSelect,
  FieldSelectIcon,
  FieldPopup,
} from "@/components/field";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/stores/auth";
import { API_BASE_URL } from "@/lib/api";
import ComponentInfo from "./ComponentInfo.vue";

// ============================================================================
// STORES
// ============================================================================
const authStore = useAuthStore();

// ============================================================================
// STATE - Initial Values (Data dari API)
// ============================================================================
let initialValues: Record<string, any> = {
  text_field: "Sample Text",
  email_field: "user@example.com",
  password_field: "",
  number_field: 100,
  textarea_field: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
  is_active: true,
  icon_field: "Home",
  general_select: "",
  popup_general: "",
};

// ============================================================================
// STATE - Reactive Form Values
// ============================================================================
let values = reactive({
  text_field: "",
  email_field: "",
  password_field: "",
  number_field: 0,
  textarea_field: "",
  is_active: false,
  icon_field: "",
  general_select: "",
  popup_general: "",
});

// ============================================================================
// STATE - Errors untuk validasi
// ============================================================================
const errors = reactive({
  text_field: "",
  email_field: "",
  password_field: "",
  number_field: "",
  textarea_field: "",
  icon_field: "",
  general_select: "",
  popup_general: "",
});

// ============================================================================
// SIMULATE DATA LOADING (seperti dari API)
// ============================================================================
// Mapping initialValues ke values (seperti di GeneralForm.vue)
for (const key in initialValues) {
  if (Object.prototype.hasOwnProperty.call(values, key)) {
    // @ts-ignore dynamic assign
    values[key] = initialValues[key];
  }
}

// ============================================================================
// HANDLERS
// ============================================================================
const handleReset = () => {
  // Reset ke initial values
  for (const key in initialValues) {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      // @ts-ignore dynamic assign
      values[key] = initialValues[key];
    }
  }

  // Clear errors
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });
};

const handleValidate = () => {
  // Clear errors first
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = "";
  });

  // Simple validation
  let invalid = false;
  if (!values.text_field?.trim()) {
    errors.text_field = "Text field wajib diisi";
    invalid = true;
  }
  if (!values.email_field?.trim()) {
    errors.email_field = "Email field wajib diisi";
    invalid = true;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email_field)) {
    errors.email_field = "Format email tidak valid";
    invalid = true;
  }
  if (values.number_field < 1) {
    errors.number_field = "Number harus lebih dari 0";
    invalid = true;
  }
  if (!values.textarea_field?.trim()) {
    errors.textarea_field = "Textarea wajib diisi";
    invalid = true;
  }

  if (!invalid) {
    alert("✅ Validasi berhasil!\n\nData:\n" + JSON.stringify(values, null, 2));
  }
};
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
    <!-- ================================================================ -->
    <!-- HEADER SECTION -->
    <!-- ================================================================ -->
    <div>
      <h1 class="text-3xl font-bold text-foreground">
        Field Components Showcase
      </h1>
      <p class="text-sm text-muted-foreground mt-2">
        Koleksi field components yang tersedia dengan reactive binding dan
        validation
      </p>
    </div>

    <Separator />

    <!-- ================================================================ -->
    <!-- CURRENT VALUES DISPLAY -->
    <!-- ================================================================ -->
    <Card class="bg-muted/50">
      <CardHeader>
        <CardTitle class="text-lg">Current Values (Reactive)</CardTitle>
        <CardDescription
          >Data ini update secara real-time saat Anda mengubah field di
          bawah</CardDescription
        >
      </CardHeader>
      <CardContent>
        <pre class="text-xs bg-background p-4 rounded-md overflow-x-auto">{{
          JSON.stringify(values, null, 2)
        }}</pre>
      </CardContent>
    </Card>

    <!-- ================================================================ -->
    <!-- FIELD COMPONENTS SECTION -->
    <!-- ================================================================ -->
    <div class="space-y-6">
      <!-- FieldX - Text Input -->
      <Card>
        <CardHeader>
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 space-y-1.5">
              <CardTitle>FieldX - Text Input</CardTitle>
              <CardDescription>
                Field teks standar dengan support untuk validation, hints, dan
                required marker
              </CardDescription>
            </div>
            <div class="shrink-0">
              <ComponentInfo component-name="FieldX" />
            </div>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Basic Text Field -->
            <FieldX
              id="text_field"
              label="Text Field"
              :value="values.text_field"
              @input="(v) => (values.text_field = v)"
              :errorname="errors.text_field ? 'failed' : ''"
              :hints="errors.text_field || 'Contoh field teks biasa'"
              :required="true"
              placeholder="Masukkan teks..."
            />

            <!-- Email Field -->
            <FieldX
              id="email_field"
              label="Email Field"
              type="email"
              :value="values.email_field"
              @input="(v) => (values.email_field = v)"
              :errorname="errors.email_field ? 'failed' : ''"
              :hints="errors.email_field || 'Format: user@example.com'"
              :required="true"
              placeholder="your@email.com"
            />

            <!-- Password Field -->
            <FieldX
              id="password_field"
              label="Password Field"
              type="password"
              :value="values.password_field"
              @input="(v) => (values.password_field = v)"
              :errorname="errors.password_field ? 'failed' : ''"
              :hints="errors.password_field || 'Password dengan icon show/hide'"
              :required="true"
              placeholder="Enter your password..."
            />

            <!-- Disabled Field Example -->
            <FieldX
              id="disabled_field"
              label="Disabled Field"
              value="This field is disabled"
              :disabled="true"
              hints="Field ini tidak bisa diedit"
              placeholder="Disabled..."
            />

            <!-- Readonly Field Example -->
            <FieldX
              id="readonly_field"
              label="Readonly Field"
              value="This field is readonly"
              :readonly="true"
              hints="Field ini readonly (bisa fokus tapi tidak bisa edit)"
              placeholder="Readonly..."
            />
          </div>
        </CardContent>
      </Card>

      <!-- FieldNumber -->
      <Card>
        <CardHeader>
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 space-y-1.5">
              <CardTitle>FieldNumber - Number Input</CardTitle>
              <CardDescription>
                Field khusus untuk input angka dengan kontrol increment/decrement
              </CardDescription>
            </div>
            <div class="shrink-0">
              <ComponentInfo component-name="FieldNumber" />
            </div>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldNumber
              id="number_field"
              label="Number Field"
              :value="values.number_field"
              @input="(v: string) => values.number_field = Number(v)"
              :errorname="errors.number_field ? 'failed' : ''"
              :hints="
                errors.number_field || 'Gunakan tombol +/- atau ketik langsung'
              "
              :required="true"
              :min="0"
              :max="1000"
              :step="10"
            />

            <FieldNumber
              id="number_readonly"
              label="Readonly Number"
              :value="42"
              :readonly="true"
              hints="Number field dalam mode readonly"
            />
          </div>
        </CardContent>
      </Card>

      <!-- FieldTextarea -->
      <Card>
        <CardHeader>
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 space-y-1.5">
              <CardTitle>FieldTextarea - Multi-line Text</CardTitle>
              <CardDescription>
                Field untuk input teks panjang dengan banyak baris
              </CardDescription>
            </div>
            <div class="shrink-0">
              <ComponentInfo component-name="FieldTextarea" />
            </div>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <FieldTextarea
            id="textarea_field"
            label="Textarea Field"
            :value="values.textarea_field"
            @input="(v) => (values.textarea_field = v)"
            :errorname="errors.textarea_field ? 'failed' : ''"
            :hints="errors.textarea_field || 'Masukkan teks panjang di sini'"
            :required="true"
            :rows="4"
            placeholder="Ketik deskripsi panjang di sini..."
          />

          <FieldTextarea
            id="textarea_disabled"
            label="Disabled Textarea"
            value="Textarea ini dalam mode disabled dan tidak bisa diedit."
            :disabled="true"
            hints="Textarea dalam mode disabled"
            :rows="2"
          />
        </CardContent>
      </Card>

      <!-- FieldStatus - Toggle/Switch -->
      <Card>
        <CardHeader>
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 space-y-1.5">
              <CardTitle>FieldStatus - Boolean Toggle</CardTitle>
              <CardDescription>
                Field untuk toggle status aktif/tidak aktif dengan switch UI
              </CardDescription>
            </div>
            <div class="shrink-0">
              <ComponentInfo component-name="FieldStatus" />
            </div>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldStatus
              label="Status Aktif"
              name="is_active"
              v-model="values.is_active"
              active-text="Aktif"
              inactive-text="Tidak Aktif"
            />

            <FieldStatus
              label="Readonly Status"
              name="readonly_status"
              :modelValue="true"
              :readonly="true"
              active-text="Selalu Aktif"
              inactive-text="Nonaktif"
            />
          </div>
        </CardContent>
      </Card>

      <!-- FieldSelect (API Driven) -->
      <Card>
        <CardHeader>
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 space-y-1.5">
              <CardTitle>FieldSelect - API Driven Select (NEW)</CardTitle>
              <CardDescription>
                Field select dengan data dari API - support clearable, custom
                displayField/valueField
              </CardDescription>
            </div>
            <div class="shrink-0">
              <ComponentInfo component-name="FieldSelect" />
            </div>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Select dengan API dari m_general -->
            <FieldSelect
              id="general_select"
              label="General Select (dari API)"
              :value="values.general_select"
              @input="(v: string) => values.general_select = v"
              :errorText="errors.general_select ? 'failed' : ''"
              :hints="
                errors.general_select ||
                'Data dari m_general dengan clearable button'
              "
              :required="true"
              :clearable="true"
              displayField="value1"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${authStore.token}`,
                },
                params: {
                  no_pagination: 'true',
                  selectfield:'id,value1'
                },
              }"
              placeholder="Pilih dari m_general"
            />

            <!-- Static Options Example -->
            <FieldSelect
              id="static_select"
              label="Static Options Select"
              :value="values.general_select"
              @input="(v: string) => values.general_select = v"
              displayField="label"
              valueField="value"
              :options="[
                { value: '1', label: 'Option 1' },
                { value: '2', label: 'Option 2' },
                { value: '3', label: 'Option 3' },
              ]"
              placeholder="Pilih opsi statis"
              hints="Select dengan static options (tidak dari API)"
            />

            <!-- Readonly Example -->
            <FieldSelect
              id="readonly_select"
              label="Readonly Select"
              value="1"
              :readonly="true"
              displayField="label"
              valueField="value"
              :options="[
                { value: '1', label: 'Read Only Value' },
                { value: '2', label: 'Option 2' },
              ]"
              hints="Select dalam mode readonly"
            />
          </div>
        </CardContent>
      </Card>

      <!-- FieldSelectIcon (Icon Selector) -->
      <Card>
        <CardHeader>
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 space-y-1.5">
              <CardTitle>FieldSelectIcon - Icon Selector</CardTitle>
              <CardDescription>
                Field untuk memilih icon dari library Lucide Icons
              </CardDescription>
            </div>
            <div class="shrink-0">
              <ComponentInfo component-name="FieldSelectIcon" />
            </div>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldSelectIcon
              id="icon_field"
              label="Select Icon"
              :value="values.icon_field"
              @input="(v: string) => values.icon_field = v"
              :errorname="errors.icon_field ? 'failed' : ''"
              :hints="errors.icon_field || 'Pilih icon dari dropdown'"
              :required="false"
              placeholder="Pilih icon..."
            />

            <FieldSelectIcon
              id="icon_readonly"
              label="Readonly Icon"
              value="Star"
              :readonly="true"
              hints="Icon selector dalam mode readonly"
            />
          </div>
        </CardContent>
      </Card>

      <!-- FieldPopup (Popup Table Selector) -->
      <Card>
        <CardHeader>
          <div class="flex items-start justify-between gap-4">
            <div class="flex-1 space-y-1.5">
              <CardTitle>FieldPopup - Popup Table Selector (NEW)</CardTitle>
              <CardDescription>
                Field dengan popup table untuk memilih data - support infinite scroll, search, dan custom columns
              </CardDescription>
            </div>
            <div class="shrink-0">
              <ComponentInfo component-name="FieldPopup" />
            </div>
          </div>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <!-- Popup dengan Data Table -->
            <FieldPopup
              id="popup_general"
              label="General Data (Popup Table)"
              :value="values.popup_general"
              @input="(v: string) => values.popup_general = v"
              @update:valueFull="(obj: any) => {
                console.log('Selected full object:', obj)
              }"
              :errorText="errors.popup_general ? 'failed' : ''"
              :hints="errors.popup_general || 'Klik untuk membuka popup table'"
              :required="true"
              :clearable="true"
              displayField="value1"
              valueField="id"
              :api="{
                url: `${API_BASE_URL}/dynamic/m_general`,
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authStore.token}`
                },
                params: {
                  searchfield: 'group,code,value1'
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page ? true : false
                  return response
                }
              }"
              :columns="[
                {
                  key: 'index',
                  label: 'No',
                  width: '60px',
                  sortable: false,
                  filterable: false,
                  render: (item: any, index: number) => index + 1
                },
                {
                  field: 'group',
                  headerName: 'Group',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter'
                },
                {
                  field: 'code',
                  headerName: 'Code',
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter'
                },
                {
                  field: 'value1',
                  headerName: 'Nama',
                  flex: 1,
                  sortable: true,
                  filterable: true,
                  filter: 'ColFilter'
                }
              ]"
              placeholder="Pilih data dari table"
            />

            <!-- Popup Readonly -->
            <FieldPopup
              id="popup_readonly"
              label="Readonly Popup"
              value="test-value"
              :readonly="true"
              displayField="value1"
              valueField="id"
              hints="Field popup dalam mode readonly"
              placeholder="Data readonly"
            />
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- ================================================================ -->
    <!-- ACTION BUTTONS -->
    <!-- ================================================================ -->
    <!-- <Card>
      <CardContent class="pt-6">
        <div class="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-end">
          <button
            type="button"
            @click="handleReset"
            class="w-full sm:w-auto px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground rounded-md text-sm font-medium transition-colors"
          >
            Reset to Initial
          </button>
          <button
            type="button"
            @click="handleValidate"
            class="w-full sm:w-auto px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md text-sm font-medium transition-colors"
          >
            Validate & Show Data
          </button>
        </div>
      </CardContent>
    </Card> -->

    <!-- ================================================================ -->
    <!-- DOCUMENTATION -->
    <!-- ================================================================ -->
    <Card class="border-dashed">
      <CardHeader>
        <CardTitle>📚 Usage Notes</CardTitle>
      </CardHeader>
      <CardContent class="space-y-3 text-sm">
        <div>
          <strong class="text-primary">Reactive Binding:</strong>
          <p class="text-muted-foreground mt-1">
            Semua field menggunakan
            <code class="bg-muted px-1 py-0.5 rounded">reactive()</code> untuk
            state management. Data mapping menggunakan pattern seperti di
            GeneralForm.vue.
          </p>
        </div>
        <div>
          <strong class="text-primary">v-model Support:</strong>
          <p class="text-muted-foreground mt-1">
            Field components support both
            <code class="bg-muted px-1 py-0.5 rounded">:value/@input</code>
            (legacy) dan
            <code class="bg-muted px-1 py-0.5 rounded">v-model</code> (Vue 3).
          </p>
        </div>
        <div>
          <strong class="text-primary">Validation:</strong>
          <p class="text-muted-foreground mt-1">
            Gunakan
            <code class="bg-muted px-1 py-0.5 rounded">errorname="failed"</code>
            untuk menampilkan error state dan
            <code class="bg-muted px-1 py-0.5 rounded">hints</code> untuk pesan
            error/hint.
          </p>
        </div>
        <div>
          <strong class="text-primary">Required Marker:</strong>
          <p class="text-muted-foreground mt-1">
            Set
            <code class="bg-muted px-1 py-0.5 rounded">:required="true"</code>
            untuk menampilkan asterisk merah (*) pada label field.
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
code {
  font-family: "Courier New", monospace;
  font-size: 0.875em;
}
</style>
