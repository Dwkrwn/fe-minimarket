<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Info, Code, FileText, Settings } from 'lucide-vue-next'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'

interface ComponentDoc {
  title: string
  description: string
  props: Array<{
    name: string
    type: string
    default?: string
    required?: boolean
    description: string
  }>
  events?: Array<{
    name: string
    payload: string
    description: string
  }>
  examples: Array<{
    title: string
    code: string
  }>
  notes?: string[]
}

interface Props {
  componentName: 'FieldX' | 'FieldNumber' | 'FieldTextarea' | 'FieldStatus' | 'FieldSelect' | 'FieldSelectIcon' | 'FieldPopup'
}

const props = defineProps<Props>()

const componentDocs: Record<string, ComponentDoc> = {
  FieldX: {
    title: 'FieldX - Text Input Component',
    description: 'Komponen input teks yang fleksibel dengan support untuk berbagai tipe input (text, email, password, dll), validation, hints, dan required marker.',
    props: [
      { name: 'label', type: 'string', description: 'Label untuk field' },
      { name: 'value / modelValue', type: 'string', description: 'Nilai input (support v-model)' },
      { name: 'type', type: 'string', default: 'text', description: 'Tipe input: text, email, password, tel, url, dll' },
      { name: 'placeholder', type: 'string', description: 'Placeholder text' },
      { name: 'hints', type: 'string', description: 'Pesan hint atau error di bawah field' },
      { name: 'errorname', type: "'failed' | ''", default: "''", description: 'Status error untuk styling' },
      { name: 'required', type: 'boolean', default: 'false', description: 'Menampilkan marker * untuk field required' },
      { name: 'disabled', type: 'boolean', default: 'false', description: 'Menonaktifkan field' },
      { name: 'readonly', type: 'boolean', default: 'false', description: 'Field readonly (bisa fokus tapi tidak bisa edit)' },
      { name: 'id', type: 'string', description: 'ID untuk field' },
      { name: 'class', type: 'string', description: 'Custom CSS class' },
    ],
    events: [
      { name: 'input', payload: 'string', description: 'Dipanggil saat nilai berubah' },
      { name: 'update:modelValue', payload: 'string', description: 'Support v-model' },
    ],
    examples: [
      {
        title: 'Basic Usage',
        code: `<FieldX
  label="Username"
  v-model="username"
  placeholder="Enter username..."
  :required="true"
/>`
      },
      {
        title: 'With Validation',
        code: `<FieldX
  label="Email"
  type="email"
  v-model="email"
  :errorname="errors.email ? 'failed' : ''"
  :hints="errors.email || 'Format: user@example.com'"
  :required="true"
/>`
      },
      {
        title: 'Password Field',
        code: `<FieldX
  label="Password"
  type="password"
  v-model="password"
  placeholder="Enter password..."
/>`
      }
    ],
    notes: [
      'Support untuk password field dengan toggle show/hide',
      'Otomatis handle styling untuk error state',
      'Support v-model untuk two-way binding'
    ]
  },
  FieldNumber: {
    title: 'FieldNumber - Number Input Component',
    description: 'Komponen khusus untuk input angka dengan button increment/decrement, formatting ribuan, dan validasi min/max.',
    props: [
      { name: 'label', type: 'string', description: 'Label untuk field' },
      { name: 'value / modelValue', type: 'number', description: 'Nilai number (support v-model)' },
      { name: 'placeholder', type: 'string', description: 'Placeholder text' },
      { name: 'hints', type: 'string', description: 'Pesan hint atau error' },
      { name: 'errorname', type: "'failed' | ''", default: "''", description: 'Status error' },
      { name: 'required', type: 'boolean', default: 'false', description: 'Field required' },
      { name: 'disabled', type: 'boolean', default: 'false', description: 'Disable field' },
      { name: 'readonly', type: 'boolean', default: 'false', description: 'Readonly field' },
      { name: 'min', type: 'number', description: 'Nilai minimum' },
      { name: 'max', type: 'number', description: 'Nilai maximum' },
      { name: 'step', type: 'number', default: '1', description: 'Step untuk increment/decrement' },
    ],
    events: [
      { name: 'input', payload: 'number', description: 'Dipanggil saat nilai berubah' },
      { name: 'update:modelValue', payload: 'number', description: 'Support v-model' },
    ],
    examples: [
      {
        title: 'Basic Number Input',
        code: `<FieldNumber
  label="Quantity"
  v-model="quantity"
  :min="1"
  :max="100"
  :step="1"
/>`
      },
      {
        title: 'With Validation',
        code: `<FieldNumber
  label="Price"
  v-model="price"
  :errorname="errors.price ? 'failed' : ''"
  :hints="errors.price || 'Harga harus lebih dari 0'"
  :required="true"
/>`
      }
    ],
    notes: [
      'Otomatis format ribuan dengan separator (1,000)',
      'Button +/- untuk increment/decrement',
      'Validasi min/max otomatis'
    ]
  },
  FieldTextarea: {
    title: 'FieldTextarea - Textarea Component',
    description: 'Komponen textarea dengan auto-resize dan character counter.',
    props: [
      { name: 'label', type: 'string', description: 'Label untuk field' },
      { name: 'value / modelValue', type: 'string', description: 'Nilai textarea' },
      { name: 'placeholder', type: 'string', description: 'Placeholder text' },
      { name: 'hints', type: 'string', description: 'Pesan hint atau error' },
      { name: 'errorname', type: "'failed' | ''", default: "''", description: 'Status error' },
      { name: 'required', type: 'boolean', default: 'false', description: 'Field required' },
      { name: 'disabled', type: 'boolean', default: 'false', description: 'Disable field' },
      { name: 'readonly', type: 'boolean', default: 'false', description: 'Readonly field' },
      { name: 'rows', type: 'number', default: '3', description: 'Jumlah baris awal' },
    ],
    events: [
      { name: 'input', payload: 'string', description: 'Dipanggil saat nilai berubah' },
      { name: 'update:modelValue', payload: 'string', description: 'Support v-model' },
    ],
    examples: [
      {
        title: 'Basic Textarea',
        code: `<FieldTextarea
  label="Description"
  v-model="description"
  placeholder="Enter description..."
  :rows="5"
/>`
      },
      {
        title: 'With Validation',
        code: `<FieldTextarea
  label="Notes"
  v-model="notes"
  :errorname="errors.notes ? 'failed' : ''"
  :hints="errors.notes || 'Max 500 characters'"
  :required="true"
/>`
      }
    ],
    notes: [
      'Auto-resize berdasarkan konten',
      'Support multiline text'
    ]
  },
  FieldStatus: {
    title: 'FieldStatus - Toggle Switch Component',
    description: 'Komponen toggle switch untuk boolean values dengan styling modern.',
    props: [
      { name: 'label', type: 'string', description: 'Label untuk switch' },
      { name: 'value / modelValue', type: 'boolean', description: 'Nilai boolean (true/false)' },
      { name: 'hints', type: 'string', description: 'Pesan hint' },
      { name: 'disabled', type: 'boolean', default: 'false', description: 'Disable switch' },
      { name: 'readonly', type: 'boolean', default: 'false', description: 'Readonly switch' },
      { name: 'id', type: 'string', description: 'ID untuk switch' },
    ],
    events: [
      { name: 'input', payload: 'boolean', description: 'Dipanggil saat toggle berubah' },
      { name: 'update:modelValue', payload: 'boolean', description: 'Support v-model' },
    ],
    examples: [
      {
        title: 'Basic Switch',
        code: `<FieldStatus
  label="Active Status"
  v-model="isActive"
  hints="Toggle to activate/deactivate"
/>`
      },
      {
        title: 'Disabled Switch',
        code: `<FieldStatus
  label="Premium Feature"
  :value="true"
  :disabled="true"
  hints="Upgrade to access this feature"
/>`
      }
    ],
    notes: [
      'Animasi smooth saat toggle',
      'Visual indicator untuk on/off state'
    ]
  },
  FieldSelect: {
    title: 'FieldSelect - Dropdown Select Component',
    description: 'Komponen dropdown select dengan support untuk static options atau dynamic data dari API, searchable, dan lazy loading.',
    props: [
      { name: 'label', type: 'string', description: 'Label untuk field' },
      { name: 'value / modelValue', type: 'string | number', description: 'Nilai selected' },
      { name: 'placeholder', type: 'string', default: 'Pilih...', description: 'Placeholder text' },
      { name: 'hints', type: 'string', description: 'Pesan hint atau error' },
      { name: 'errorText', type: "'failed' | ''", default: "''", description: 'Status error' },
      { name: 'required', type: 'boolean', default: 'false', description: 'Field required' },
      { name: 'disabled', type: 'boolean', default: 'false', description: 'Disable select' },
      { name: 'readonly', type: 'boolean', default: 'false', description: 'Readonly select' },
      { name: 'clearable', type: 'boolean', default: 'false', description: 'Menampilkan button clear' },
      { name: 'displayField', type: 'string', default: 'label', description: 'Field name untuk display' },
      { name: 'valueField', type: 'string', default: 'value', description: 'Field name untuk value' },
      { name: 'options', type: 'Array<Record<string, any>>', description: 'Static options array' },
      { name: 'api', type: 'ApiConfig', description: 'Config untuk fetch data dari API' },
    ],
    events: [
      { name: 'input', payload: 'string', description: 'Dipanggil saat value berubah' },
      { name: 'update:modelValue', payload: 'string', description: 'Support v-model' },
    ],
    examples: [
      {
        title: 'Static Options',
        code: `<FieldSelect
  label="Status"
  v-model="status"
  :options="[
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ]"
/>`
      },
      {
        title: 'Dynamic from API',
        code: `<FieldSelect
  label="Category"
  v-model="categoryId"
  :api="{
    url: API_BASE_URL + '/api/setup/m_general',
    params: { searchfield: 'general_name' }
  }"
  displayField="general_name"
  valueField="general_id"
/>`
      }
    ],
    notes: [
      'API hanya dipanggil saat dropdown dibuka (lazy loading)',
      'Data di-refresh setiap kali dropdown dibuka untuk data terbaru',
      'Built-in search/filter untuk options',
      'Support clearable untuk reset value'
    ]
  },
  FieldSelectIcon: {
    title: 'FieldSelectIcon - Icon Picker Component',
    description: 'Komponen khusus untuk memilih icon dari Lucide Icons dengan preview dan search.',
    props: [
      { name: 'label', type: 'string', description: 'Label untuk field' },
      { name: 'value / modelValue', type: 'string', description: 'Nama icon yang dipilih' },
      { name: 'placeholder', type: 'string', description: 'Placeholder text' },
      { name: 'hints', type: 'string', description: 'Pesan hint atau error' },
      { name: 'errorname', type: "'failed' | ''", default: "''", description: 'Status error' },
      { name: 'required', type: 'boolean', default: 'false', description: 'Field required' },
      { name: 'disabled', type: 'boolean', default: 'false', description: 'Disable field' },
      { name: 'readonly', type: 'boolean', default: 'false', description: 'Readonly field' },
      { name: 'clearable', type: 'boolean', default: 'false', description: 'Menampilkan button clear' },
    ],
    events: [
      { name: 'input', payload: 'string', description: 'Dipanggil saat icon dipilih' },
      { name: 'update:modelValue', payload: 'string', description: 'Support v-model' },
    ],
    examples: [
      {
        title: 'Basic Icon Picker',
        code: `<FieldSelectIcon
  label="Menu Icon"
  v-model="menuIcon"
  placeholder="Select an icon..."
  :clearable="true"
/>`
      },
      {
        title: 'With Validation',
        code: `<FieldSelectIcon
  label="Category Icon"
  v-model="categoryIcon"
  :errorname="errors.icon ? 'failed' : ''"
  :hints="errors.icon || 'Choose an icon for this category'"
  :required="true"
/>`
      }
    ],
    notes: [
      'Preview icon secara real-time',
      'Searchable icon list',
      'Grid layout untuk memudahkan pemilihan',
      'Support semua Lucide Icons'
    ]
  },
  FieldPopup: {
    title: 'FieldPopup - Data Picker with Table',
    description: 'Komponen untuk memilih data dari tabel popup dengan infinite scroll, search, dan support API pagination.',
    props: [
      { name: 'label', type: 'string', description: 'Label untuk field' },
      { name: 'value / modelValue', type: 'string', description: 'Nilai selected' },
      { name: 'placeholder', type: 'string', description: 'Placeholder text' },
      { name: 'hints', type: 'string', description: 'Pesan hint atau error' },
      { name: 'errorname', type: "'failed' | ''", default: "''", description: 'Status error' },
      { name: 'required', type: 'boolean', default: 'false', description: 'Field required' },
      { name: 'disabled', type: 'boolean', default: 'false', description: 'Disable field' },
      { name: 'readonly', type: 'boolean', default: 'false', description: 'Readonly field' },
      { name: 'clearable', type: 'boolean', default: 'false', description: 'Menampilkan button clear' },
      { name: 'displayField', type: 'string', default: 'label', description: 'Field untuk display' },
      { name: 'valueField', type: 'string', default: 'value', description: 'Field untuk value' },
      { name: 'columns', type: 'Array<Column>', description: 'Definisi kolom tabel' },
      { name: 'api', type: 'ApiConfig', description: 'Config API untuk fetch data' },
    ],
    events: [
      { name: 'input', payload: 'string', description: 'Dipanggil saat item dipilih' },
      { name: 'update:modelValue', payload: 'string', description: 'Support v-model' },
      { name: 'update:valueFull', payload: 'object', description: 'Return full object data' },
    ],
    examples: [
      {
        title: 'Basic Popup Table',
        code: `<FieldPopup
  label="Select Data"
  v-model="selectedId"
  :api="{
    url: API_BASE_URL + '/api/setup/m_general',
    params: { searchfield: 'general_name' }
  }"
  :columns="[
    { field: 'general_id', headerName: 'ID', width: '100px' },
    { field: 'general_name', headerName: 'Name', flex: 1 }
  ]"
  displayField="general_name"
  valueField="general_id"
/>`
      },
      {
        title: 'With Full Object',
        code: `<FieldPopup
  label="Customer"
  v-model="customerId"
  @update:valueFull="(obj) => customerData = obj"
  :api="{ url: '/api/customers' }"
  :columns="customerColumns"
/>`
      }
    ],
    notes: [
      'Full-screen modal dengan responsive design',
      'Infinite scroll untuk loading data bertahap',
      'Built-in search dengan API integration',
      'Table dengan sorting dan filtering',
      'Support mobile/tablet dengan touch gestures'
    ]
  }
}

const currentDoc = computed(() => componentDocs[props.componentName] || componentDocs.FieldX)

// Type guard to ensure currentDoc is not undefined
const doc = computed(() => currentDoc.value!)

// Dialog state management
const open = ref(false)

</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button variant="ghost" size="icon" class="h-8 w-8">
        <Info class="h-4 w-4" />
      </Button>
    </DialogTrigger>
    <DialogContent class="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-2xl">
          <FileText class="h-6 w-6 text-primary" />
          {{ doc.title }}
        </DialogTitle>
        <DialogDescription class="text-base">
          {{ doc.description }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-6 mt-4">
        <!-- Props Section -->
        <div>
          <h3 class="text-lg font-semibold flex items-center gap-2 mb-3">
            <Settings class="h-5 w-5 text-primary" />
            Props
          </h3>
          <div class="space-y-2">
            <div
              v-for="prop in doc.props"
              :key="prop.name"
              class="border rounded-lg p-3 bg-muted/30"
            >
              <div class="flex items-start justify-between gap-2 mb-1">
                <code class="text-sm font-mono text-primary font-semibold">{{ prop.name }}</code>
                <div class="flex gap-1">
                  <Badge variant="secondary" class="text-xs">{{ prop.type }}</Badge>
                  <Badge v-if="prop.required" variant="destructive" class="text-xs">required</Badge>
                </div>
              </div>
              <p class="text-sm text-muted-foreground">{{ prop.description }}</p>
              <p v-if="prop.default" class="text-xs text-muted-foreground mt-1">
                Default: <code class="text-xs bg-background px-1 py-0.5 rounded">{{ prop.default }}</code>
              </p>
            </div>
          </div>
        </div>

        <!-- Events Section -->
        <div v-if="doc.events && doc.events.length > 0">
          <h3 class="text-lg font-semibold mb-3">Events</h3>
          <div class="space-y-2">
            <div
              v-for="event in doc.events"
              :key="event.name"
              class="border rounded-lg p-3 bg-muted/30"
            >
              <div class="flex items-start justify-between gap-2 mb-1">
                <code class="text-sm font-mono text-primary font-semibold">@{{ event.name }}</code>
                <Badge variant="outline" class="text-xs">{{ event.payload }}</Badge>
              </div>
              <p class="text-sm text-muted-foreground">{{ event.description }}</p>
            </div>
          </div>
        </div>

        <!-- Examples Section -->
        <div>
          <h3 class="text-lg font-semibold flex items-center gap-2 mb-3">
            <Code class="h-5 w-5 text-primary" />
            Usage Examples
          </h3>
          <div class="space-y-4">
            <div v-for="(example, index) in doc.examples" :key="index">
              <h4 class="text-sm font-semibold mb-2">{{ example.title }}</h4>
              <pre class="text-xs bg-background border rounded-lg p-4 overflow-x-auto"><code>{{ example.code }}</code></pre>
            </div>
          </div>
        </div>

        <!-- Notes Section -->
        <div v-if="doc.notes && doc.notes.length > 0">
          <h3 class="text-lg font-semibold mb-3">📝 Important Notes</h3>
          <ul class="space-y-2 list-disc list-inside text-sm text-muted-foreground">
            <li v-for="(note, index) in doc.notes" :key="index">{{ note }}</li>
          </ul>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
