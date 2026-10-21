<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Book, Code, Database, FileCode, Folder, 
  Layout, Lock, Package, Palette, Server, Settings, 
  Shield, Terminal, Workflow, ChevronRight,
  Copy, Check, ArrowLeft, Moon, Sun, Bell, Layers,
  Zap, Info, CheckCircle, Grid3X3
} from 'lucide-vue-next'

const router = useRouter()
const activeTab = ref('overview')
const copiedCode = ref<string | null>(null)
const isDark = ref(false)

onMounted(() => {
  isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('dark', isDark.value)
})

const toggleDark = () => {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark', isDark.value)
}

const copyCode = async (code: string, id: string) => {
  await navigator.clipboard.writeText(code)
  copiedCode.value = id
  setTimeout(() => copiedCode.value = null, 2000)
}

const goToLogin = () => {
  router.push('/login')
}

// Documentation sections
const sections = [
  { id: 'overview', label: 'Overview', icon: Book },
  { id: 'quickstart', label: 'Quick Start', icon: Zap },
  { id: 'architecture', label: 'Architecture', icon: Layout },
  { id: 'router', label: 'Modular Router', icon: Folder },
  { id: 'shadcn', label: 'Shadcn Vue (Reka UI)', icon: Palette },
  { id: 'generator', label: 'Module Generator', icon: Terminal },
  { id: 'authentication', label: 'Authentication', icon: Lock },
  { id: 'api', label: 'API Layer', icon: Server },
  { id: 'datatable', label: 'AG Grid DataTable', icon: Grid3X3 },
  { id: 'fieldcomponents', label: 'Field Components', icon: Package },
  { id: 'buttoncomponents', label: 'Button Components', icon: Palette },
  { id: 'ui', label: 'UI Components', icon: Palette },
  { id: 'composables', label: 'Composables', icon: Code },
  { id: 'stores', label: 'Pinia Stores', icon: Database },
  { id: 'permissions', label: 'Permissions', icon: Shield },
  { id: 'approval', label: 'Approval Workflow', icon: Workflow },
  { id: 'notification', label: 'Notification', icon: Bell },
  { id: 'templates', label: 'Templates', icon: FileCode },
  { id: 'directives', label: 'Directives', icon: Layers },
  { id: 'conventions', label: 'Conventions', icon: Settings },
]

const techStack = [
  { name: 'Vue 3', desc: 'Composition API + script setup', color: 'bg-green-500' },
  { name: 'TypeScript', desc: 'Type-safe development', color: 'bg-blue-500' },
  { name: 'Vite', desc: 'Next-gen build tool', color: 'bg-purple-500' },
  { name: 'TailwindCSS', desc: 'Utility-first CSS', color: 'bg-cyan-500' },
  { name: 'Pinia', desc: 'State management', color: 'bg-yellow-500' },
  { name: 'Vue Router', desc: 'Official routing', color: 'bg-red-500' },
  { name: 'AG Grid', desc: 'Enterprise data table', color: 'bg-orange-500' },
  { name: 'Reka UI', desc: 'Headless UI (Shadcn Vue)', color: 'bg-pink-500' },
]

// Updated Field Components with detailed props
const fieldComponents = [
  { 
    name: 'FieldX', 
    desc: 'Universal text input component',
    props: 'label, v-model, type (text/email/password/tel/number/decimal), placeholder, hints, errorname, required, disabled, readonly',
    usage: 'For text inputs, passwords, emails, phone numbers. Type "tel" preserves leading zeros, "decimal" allows scientific notation.'
  },
  { 
    name: 'FieldNumber', 
    desc: 'Numeric input with thousand separator formatting',
    props: 'label, v-model, placeholder, hints, errorname, required, disabled, readonly, min, max',
    usage: 'For currency or quantity fields. Automatically formats numbers with thousand separators.'
  },
  { 
    name: 'FieldTextarea', 
    desc: 'Multi-line text input',
    props: 'label, v-model, placeholder, rows, hints, errorname, required, disabled, readonly',
    usage: 'For long text like descriptions, notes, addresses.'
  },
  { 
    name: 'FieldTextareaCustom', 
    desc: 'Customizable textarea with extended features',
    props: 'label, v-model, placeholder, rows, hints, errorname, required, disabled, readonly',
    usage: 'Similar to FieldTextarea but with additional styling options.'
  },
  { 
    name: 'FieldStatus', 
    desc: 'Boolean toggle switch for active/inactive status',
    props: 'label, v-model (boolean), disabled',
    usage: 'For is_active fields. Displays as switch with "Aktif"/"Nonaktif" labels.'
  },
  { 
    name: 'FieldSelect', 
    desc: 'Dropdown select with static options',
    props: 'label, v-model, options (array), placeholder, hints, errorname, required, disabled',
    usage: 'For predefined options like status, type, category.'
  },
  { 
    name: 'FieldSelectIcon', 
    desc: 'Select dropdown with icon display',
    props: 'label, v-model, options, placeholder, required, disabled',
    usage: 'For icon selection from Lucide icons library.'
  },
  { 
    name: 'FieldPopup', 
    desc: 'Searchable popup with AG Grid DataTable',
    props: 'label, v-model, displayField, valueField, displayValue, api (url, headers, params, onsuccess), columns, clearable, placeholder, required, disabled',
    usage: 'For selecting from large datasets. Opens a modal with searchable DataTable. Most complex field component.'
  },
  { 
    name: 'FieldDate', 
    desc: 'Date picker with calendar popup',
    props: 'label, v-model, placeholder, hints, errorname, required, disabled, readonly',
    usage: 'For date selection. Returns ISO date string (YYYY-MM-DD).'
  },
  { 
    name: 'FieldDateTime', 
    desc: 'Date and time picker',
    props: 'label, v-model, placeholder, hints, errorname, required, disabled, readonly',
    usage: 'For datetime selection. Returns ISO datetime string.'
  },
  { 
    name: 'FieldUpload', 
    desc: 'Single file upload with preview',
    props: 'label, v-model, accept, maxSize, hints, errorname, required, disabled',
    usage: 'For uploading single files like images, documents.'
  },
  { 
    name: 'FieldMultiUpload', 
    desc: 'Multiple file upload',
    props: 'label, v-model (array), accept, maxFiles, maxSize, hints, errorname, required, disabled',
    usage: 'For uploading multiple files at once.'
  },
  { 
    name: 'FieldCombo', 
    desc: 'Combobox with search/autocomplete',
    props: 'label, v-model, options, placeholder, searchable, hints, errorname, required, disabled',
    usage: 'For searchable dropdowns with autocomplete functionality.'
  },
  { 
    name: 'FieldRadio', 
    desc: 'Radio button group',
    props: 'label, v-model, options, required, disabled',
    usage: 'For single selection from small set of options (2-5 items).'
  },
  { 
    name: 'MapPicker', 
    desc: 'Map location picker',
    props: 'label, v-model (lat/lng), zoom, disabled',
    usage: 'For selecting geographic coordinates on a map.'
  },
]

// Button Components
const buttonComponents = [
  { 
    name: 'ActionButtons', 
    desc: 'Container for row action buttons in toolbar',
    props: 'None - wraps child buttons',
    usage: 'Place in toolbar area to group edit/delete/copy buttons. Buttons inside auto-enable when row is selected.'
  },
  { 
    name: 'DeleteButton', 
    desc: 'Red trash icon button for delete action',
    props: '@click, disabled, variant, size',
    usage: 'Standard delete button. Use with v-permission directive for access control.'
  },
  { 
    name: 'EditButton', 
    desc: 'Pencil icon button for edit action',
    props: '@click, disabled, variant, size',
    usage: 'Navigate to form page in edit mode. Typically: router.push(`/path/form/${id}`)'
  },
  { 
    name: 'CopyButton', 
    desc: 'Copy/duplicate icon button',
    props: '@click, disabled, variant, size',
    usage: 'Navigate to form with copied data. Use query param: router.push(`/path/form?action=copy&source=${id}`)'
  },
  { 
    name: 'ViewButton', 
    desc: 'Eye icon button for view details',
    props: '@click, disabled, variant, size',
    usage: 'Navigate to form in read-only mode: router.push(`/path/view/${id}`)'
  },
  { 
    name: 'ExportButton', 
    desc: 'Download icon button for export',
    props: '@click, disabled, variant, size, format',
    usage: 'Export table data to Excel/PDF/CSV.'
  },
  { 
    name: 'ButtonMultiSelect', 
    desc: 'Multi-select popup with DataTable',
    props: 'title, @add (items array), api, columns, disabled',
    usage: 'For adding multiple items to a detail table. Opens modal with multi-select DataTable.'
  },
  { 
    name: 'SendApprovalButton', 
    desc: 'Send document for approval workflow',
    props: '@click, disabled, status',
    usage: 'Only shown for DRAFT or REVISI status documents. Initiates approval process.'
  },
  { 
    name: 'HistoryApprovalButton', 
    desc: 'View approval history',
    props: '@click, disabled, documentId',
    usage: 'Shows modal with approval history timeline.'
  },
  { 
    name: 'PostButton', 
    desc: 'Post/submit transaction',
    props: '@click, disabled',
    usage: 'For posting approved transactions to accounting.'
  },
  { 
    name: 'OutstandingButton', 
    desc: 'View outstanding items',
    props: '@click, disabled',
    usage: 'Shows outstanding/unpaid items related to transaction.'
  },
  { 
    name: 'RateButton', 
    desc: 'Rate/exchange rate action',
    props: '@click, disabled',
    usage: 'For currency rate related actions.'
  },
]

// Composables
const composables = [
  { 
    name: 'useActionButtons', 
    desc: 'Manages row selection state for CRUD toolbar actions',
    returns: 'selectedItem, selectedIndex, isActive, selectItem, deselectItem, handleEdit, handleDelete, handleCopy',
    example: `const { selectedItem, isActive, selectItem, deselectItem } = useActionButtons()

// In DataTable
@rowSelect="(item, idx) => selectItem(item, idx)"
@rowDeselect="deselectItem"

// In buttons
<EditButton :disabled="!isActive" @click="handleEdit()" />`
  },
  { 
    name: 'useApi', 
    desc: 'Provides global API_BASE_URL from environment variable',
    returns: 'API_BASE_URL',
    example: `const { API_BASE_URL } = useApi()
// Use in API calls
fetch(\`\${API_BASE_URL}/dynamic/endpoint\`)`
  },
  { 
    name: 'usePermission', 
    desc: 'Checks current page permissions from cached SelectRespo in localStorage',
    returns: 'currentMenuId, canRead, canCreate, canUpdate, canDelete, canPrint, isSuperAdmin, findMenuIdByPath',
    example: `const { canCreate, canUpdate, canDelete, currentMenuId, isSuperAdmin } = usePermission()

// Conditional rendering
<Button v-if="canCreate" @click="goToForm">Tambah Baru</Button>

// Super admin bypasses all permission checks`
  },
  { 
    name: 'useSidebarRefresh', 
    desc: 'Triggers sidebar menu reload after CRUD operations that affect menu data',
    returns: 'triggerRefresh, resetRefresh',
    example: `const { triggerRefresh } = useSidebarRefresh()
// After saving menu/role data
await saveData()
triggerRefresh()`
  },
  { 
    name: 'useTokenExpiredHandler', 
    desc: 'Handles 401/403 token expired errors, triggers auto-logout',
    returns: 'handleApiError',
    example: `const { handleApiError } = useTokenExpiredHandler()
try {
  await apiCall('/endpoint')
} catch (error) {
  handleApiError(error)
}`
  },
  { 
    name: 'useDataTableFilters', 
    desc: 'Manages DataTable filter state for API-based filtering',
    returns: 'filters, updateFilter, clearFilters, buildQueryParams',
    example: `const { filters, updateFilter, buildQueryParams } = useDataTableFilters()
// Pass to DataTable
:apiFilterMode="true"
@filterChange="updateFilter"`
  },
]

// Approval statuses
const approvalStatuses = [
  { status: 'DRAFT', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200', desc: 'Initial state. Document can be freely edited or deleted.' },
  { status: 'IN APPROVAL', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', desc: 'Awaiting approver action. Document is LOCKED - cannot edit or delete.' },
  { status: 'APPROVED', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', desc: 'Approved by all approvers. Document is LOCKED permanently.' },
  { status: 'REJECT', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', desc: 'Rejected by approver. Document is LOCKED - cannot be resubmitted.' },
  { status: 'REVISI', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', desc: 'Returned for revision. Can edit, then auto-sends for re-approval on save.' },
]

// Templates
const templates = [
  { 
    name: 'Landing.txt', 
    desc: 'Basic list page with AG Grid DataTable',
    generates: '{Module}Landing.vue',
    features: 'Search, filters, pagination, CRUD buttons, row selection'
  },
  { 
    name: 'LandingWithApproval.txt', 
    desc: 'List page with approval status filters',
    generates: '{Module}Landing.vue',
    features: 'Same as Landing + status tabs (Draft/In Approval/Approved/Rejected)'
  },
  { 
    name: 'Form.txt', 
    desc: 'Basic create/edit/view form',
    generates: '{Module}Form.vue',
    features: 'Form fields, validation, save/cancel, edit/view mode detection'
  },
  { 
    name: 'FormWithApproval.txt', 
    desc: 'Form with approval workflow fields',
    generates: '{Module}Form.vue',
    features: 'Same as Form + approval_status, approval buttons, status locking'
  },
  { 
    name: 'FormWithDetail.txt', 
    desc: 'Form with tabbed detail tables',
    generates: '{Module}Form.vue',
    features: 'Header + multiple detail tabs. Supports manual add or multi-select mode.'
  },
  { 
    name: 'service.txt', 
    desc: 'API service file with CRUD functions',
    generates: 'service.ts',
    features: 'TypeScript interfaces, getList, getById, create, update, delete functions'
  },
  { 
    name: 'NotifikasiService.txt', 
    desc: 'Notification service for approval modules',
    generates: 'service.{module}.ts in notifikasi folder',
    features: 'Get pending approvals, revisions, mark as read'
  },
  { 
    name: 'NotifikasiDetail.txt', 
    desc: 'Notification detail panel component',
    generates: 'Notifikasi{Module}Detail.vue',
    features: 'Approval actions (approve/reject/revise), history view'
  },
]

// UI Components (shadcn-vue style)
const uiComponents = [
  { name: 'Button', desc: 'Primary action button with variants (default/secondary/outline/ghost/destructive/link) and sizes (sm/default/lg/icon)' },
  { name: 'Card', desc: 'Container with CardHeader, CardTitle, CardDescription, CardContent, CardFooter' },
  { name: 'Dialog', desc: 'Modal dialog with DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter' },
  { name: 'Input', desc: 'Basic text input field' },
  { name: 'Label', desc: 'Form field label with required indicator support' },
  { name: 'Badge', desc: 'Status/tag indicator with variants (default/secondary/outline/destructive)' },
  { name: 'Tabs', desc: 'Tab navigation with TabsList, TabsTrigger, TabsContent' },
  { name: 'Table', desc: 'Basic HTML table with Table, TableHeader, TableBody, TableRow, TableHead, TableCell' },
  { name: 'Select', desc: 'Dropdown select with SelectTrigger, SelectContent, SelectItem, SelectValue' },
  { name: 'Switch', desc: 'Toggle switch component' },
  { name: 'Skeleton', desc: 'Loading placeholder animation' },
  { name: 'Separator', desc: 'Visual divider line (horizontal/vertical)' },
  { name: 'Sheet', desc: 'Slide-out panel from edge of screen' },
  { name: 'Sidebar', desc: 'Navigation sidebar with collapsible groups' },
  { name: 'Tooltip', desc: 'Hover tooltip with TooltipProvider, TooltipTrigger, TooltipContent' },
  { name: 'Popover', desc: 'Click-triggered popover with PopoverTrigger, PopoverContent' },
  { name: 'DropdownMenu', desc: 'Dropdown menu with DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem' },
  { name: 'Accordion', desc: 'Collapsible sections with AccordionItem, AccordionTrigger, AccordionContent' },
  { name: 'Avatar', desc: 'User avatar with AvatarImage, AvatarFallback' },
  { name: 'Breadcrumb', desc: 'Navigation breadcrumb trail' },
  { name: 'Calendar', desc: 'Date picker calendar component' },
  { name: 'Collapsible', desc: 'Collapsible content section' },
  { name: 'Form', desc: 'Form validation components with FormField, FormItem, FormLabel, FormControl, FormMessage' },
  { name: 'RadioGroup', desc: 'Radio button group with RadioGroupItem' },
  { name: 'Textarea', desc: 'Multi-line text input' },
  { name: 'Sonner', desc: 'Toast notification system - use toast.success(), toast.error(), toast.info()' },
]

// DataTable features (AG Grid based)
const dataTableFeatures = [
  { name: 'AG Grid Community', desc: 'Built on AG Grid Vue 3 integration (ag-grid-vue3). Enterprise-grade data grid.' },
  { name: 'Infinite Scroll', desc: 'Automatic load-more on scroll. Triggered when scrolling near bottom.' },
  { name: 'Row Selection', desc: 'Single row selection mode with checkbox. Selected row highlighted with primary color.' },
  { name: 'Floating Filters', desc: 'Per-column text search filters in header row. Type "text" or "date" filter types.' },
  { name: 'Date Range Filter', desc: 'Custom DateRangeFilterFloating component for date columns with from/to picker.' },
  { name: 'Column Sorting', desc: 'Click column header to sort. Supports multi-column sort with Shift+click.' },
  { name: 'Column Resizing', desc: 'Drag column borders to resize. Double-click to auto-fit content.' },
  { name: 'Custom Cell Render', desc: 'Use renderHtml() function to return custom HTML for cell content.' },
  { name: 'Action Buttons Column', desc: 'Add actionButtons array to column config for in-row action icons.' },
  { name: 'Row Spanning', desc: 'Use spanRows property to merge cells with same value vertically.' },
  { name: 'Dark Mode Support', desc: 'Automatic theme switching based on document dark mode class.' },
  { name: 'Auto Size to Fit', desc: 'Columns auto-resize to fit container width on grid ready.' },
  { name: 'API Filter Mode', desc: 'Set apiFilterMode=true to emit filter changes for server-side filtering.' },
  { name: 'Word Wrap', desc: 'wrapText property (default true) enables multi-line cell content.' },
]

// Pinia stores
const storesList = [
  { 
    name: 'auth', 
    desc: 'Authentication & user management store',
    state: 'token, user, isAuthenticated, isSuperAdmin',
    actions: 'login(credentials), logout(), checkAuth(), getApprovalList(), getMenuPermissions()',
    getters: 'isAuthenticated, isSuperAdmin, currentUser'
  },
]

// Code examples
const codeExamples = {
  generatorBasic: `# Basic usage - generate module in folder
node add_route.cjs setup/m_general

# This will prompt for:
# 1. API Endpoint (default: m_general)
# 2. Route Path (default: /setup/m_general)
# 3. Has Detail Tables? (y/n)
# 4. Has Approval Workflow? (y/n)`,

  generatorAdvanced: `# Advanced usage - with custom endpoint and route
node add_route.cjs purchasing/master/m_supplier m_supplier /purchasing/master/m_supplier

# With detail tables (will prompt for detail config):
# - Detail table name
# - Detail type: "manual" (add row button) or "multi-select" (popup picker)

# Generated files:
# └── src/views/purchasing/master/m_supplier/
#     ├── MSupplierLanding.vue   # List page
#     ├── MSupplierForm.vue      # Form page  
#     └── service.ts             # API service

# If approval enabled, also generates:
# └── src/views/notifikasi/
#     ├── service.supplier.ts
#     └── NotifikasiSupplierDetail.vue`,

  generatorDetails: `# Detail table configuration:
# 
# Type "manual" - user manually adds rows:
#   - Shows "Tambah" button
#   - Empty row form with input fields
#   - Good for: custom line items
#
# Type "multi-select" - pick from existing data:
#   - Uses ButtonMultiSelect component  
#   - Opens popup with DataTable
#   - Picks multiple items at once
#   - Good for: selecting products, items`,

  dataTableBasic: `<DataTable
  :data="menuData"
  :columns="columns"
  :loading="loading"
  :loadingMore="loadingMore"
  :hasMore="hasMoreData"
  rowSelectMode
  @loadMore="loadMoreData"
  @rowSelect="selectItem"
  @rowDeselect="deselectItem"
/>`,

  dataTableColumns: `// Column configuration
const columns = [
  { 
    key: 'kode',           // Field name from data
    label: 'Kode',         // Header text
    width: '120px',        // Fixed width
    filterable: true,      // Enable column filter
    sortable: true         // Enable sorting (default: true)
  },
  { 
    key: 'nama', 
    label: 'Nama', 
    flex: 1,               // Flexible width (fills remaining space)
    filterable: true,
    wrapText: true         // Enable word wrap (default: true)
  },
  { 
    key: 'tanggal',
    label: 'Tanggal',
    width: '150px',
    filterType: 'date',    // Use date range filter
    render: (item) => formatDate(item.tanggal)  // Value formatter
  },
  { 
    key: 'is_active', 
    label: 'Status', 
    width: '100px',
    align: 'center',       // Text alignment: left/center/right
    renderHtml: (item) => item.is_active 
      ? '<span class="text-green-600 font-bold">Aktif</span>' 
      : '<span class="text-red-600 font-bold">Nonaktif</span>'
  },
  {
    key: 'actions',
    label: 'Aksi',
    width: '120px',
    sortable: false,
    filterable: false,
    actionButtons: [
      { 
        icon: 'Eye',            // Lucide icon name
        title: 'View',
        variant: 'ghost',       // Button variant
        onClick: (item) => router.push(\`/path/view/\${item.id}\`)
      },
      { 
        icon: 'Pencil',
        title: 'Edit',
        onClick: (item) => router.push(\`/path/form/\${item.id}\`)
      }
    ]
  }
]`,

  dataTableApi: `// Using with API (server-side filtering)
<DataTable
  :data="menuData"
  :columns="columns"
  :loading="loading"
  apiFilterMode
  @filterChange="handleFilterChange"
  @loadMore="loadMoreData"
/>

// Handle filter changes
const handleFilterChange = (filters: {
  column: Record<string, string>,      // Column text filters
  dateRange: Record<string, {from, to}>, // Date range filters
  where: string                         // Built WHERE clause
}) => {
  tableColumnFilters.value = filters.column
  tableDateRangeFilters.value = filters.dateRange
  // Refetch data with new filters
  fetchData()
}`,

  fieldPopup: `<FieldPopup
  label="Pilih Item"
  v-model="values.item_id"
  displayField="nama"
  valueField="id"
  :displayValue="values.item_nama"
  required
  :api="{
    url: \`\${API_BASE_URL}/dynamic/m_items\`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${authStore.token}\`
    },
    params: { 
      searchfield: 'nama,kode',
      filter_column_is_active: true 
    },
    onsuccess: (response) => { 
      response.hasNext = !!response.pagination?.next_page
      return response 
    }
  }"
  :columns="[
    { field: 'kode', headerName: 'Kode', width: '120px', filterable: true },
    { field: 'nama', headerName: 'Nama', flex: 1, filterable: true }
  ]"
  @update:valueFull="(item) => { values.item_nama = item?.nama }"
/>`,

  fieldXExamples: `<!-- Text input -->
<FieldX 
  label="Nama" 
  v-model="values.nama" 
  placeholder="Masukkan nama"
  required 
  :errorname="errors.nama ? 'failed' : ''"
  :hints="errors.nama"
/>

<!-- Phone number (preserves leading zeros) -->
<FieldX 
  label="No. Telepon" 
  v-model="values.phone" 
  type="tel"
  placeholder="08xxxxxxxxxx"
/>

<!-- Number (digits only) -->
<FieldX 
  label="Kode" 
  v-model="values.kode" 
  type="number"
/>

<!-- Password with toggle visibility -->
<FieldX 
  label="Password" 
  v-model="values.password" 
  type="password"
  required
/>`,

  apiCall: `// API utility function (src/lib/api.ts)
import { apiCall, API_BASE_URL } from '@/lib/api'

// GET request
const response = await apiCall<ResponseType>('/dynamic/m_items?page=1&paginate=20')

// POST request
const createResponse = await apiCall('/dynamic/m_items', {
  method: 'POST',
  body: JSON.stringify({ nama: 'New Item', is_active: true })
})

// PUT request  
const updateResponse = await apiCall(\`/dynamic/m_items/\${id}\`, {
  method: 'PUT',
  body: JSON.stringify(updatedData)
})

// DELETE request
const deleteResponse = await apiCall(\`/dynamic/m_items/\${id}\`, {
  method: 'DELETE'
})

// Token auto-attached from localStorage 'auth_bb'
// 401/403 triggers global token expired handler`,

  servicePattern: `// service.ts pattern
import { apiCall } from '@/lib/api'

// TypeScript interface for the entity
export interface MSupplierItem {
  id: string
  kode: string
  nama: string
  alamat: string
  is_active: boolean
}

// Get paginated list
export async function getMSupplierList(page = 1, paginate = 20) {
  return apiCall(\`/dynamic/m_supplier?page=\${page}&paginate=\${paginate}\`)
}

// Get single item by ID
export async function getMSupplierById(id: string) {
  return apiCall(\`/dynamic/m_supplier/\${id}\`)
}

// Create new item
export async function createMSupplier(data: Partial<MSupplierItem>) {
  return apiCall('/dynamic/m_supplier', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  })
}

// Update existing item
export async function updateMSupplier(id: string, data: Partial<MSupplierItem>) {
  return apiCall(\`/dynamic/m_supplier/\${id}\`, { 
    method: 'PUT', 
    body: JSON.stringify(data) 
  })
}

// Delete item
export async function deleteMSupplier(id: string) {
  return apiCall(\`/dynamic/m_supplier/\${id}\`, { method: 'DELETE' })
}`,

  composableUsage: `// Import composables
import { usePermission } from '@/composables/usePermission'
import { useActionButtons } from '@/composables/useActionButtons'
import { useApi } from '@/composables/useApi'

// Setup
const { canCreate, canUpdate, canDelete, currentMenuId } = usePermission()
const { selectedItem, isActive, selectItem, deselectItem } = useActionButtons()
const { API_BASE_URL } = useApi()

// Usage in template
<Button v-if="canCreate" @click="router.push('/path/form')">
  Tambah Baru
</Button>

<EditButton 
  :disabled="!isActive || !canUpdate" 
  @click="router.push(\`/path/form/\${selectedItem.id}\`)"
/>`,

  permission: `<!-- v-permission directive usage -->

<!-- Disable button if no create permission (default) -->
<Button v-permission="{ menuId: currentMenuId, action: 'create' }">
  Tambah Baru
</Button>

<!-- Hide button completely if no delete permission -->
<Button 
  v-permission="{ menuId: currentMenuId, action: 'delete', behavior: 'hide' }"
  variant="destructive"
>
  Hapus
</Button>

<!-- Permission actions: 'read', 'create', 'update', 'delete', 'print' -->
<!-- Super Admin bypasses all checks -->`,

  globalDialog: `<GlobalDialog 
  :open="isDeleteDialogOpen" 
  title="Hapus Data" 
  :description="\`Apakah Anda yakin menghapus '\${itemToDelete?.nama}'?\`"
  type="danger"
  confirm-text="Hapus" 
  cancel-text="Batal" 
  :is-loading="isDeleting" 
  @confirm="confirmDelete"
  @cancel="isDeleteDialogOpen = false" 
/>

<!-- Dialog types: 'danger', 'warning', 'info', 'success' -->`,

  formPattern: `// Form component pattern
const router = useRouter()
const route = useRoute()

// Form state
const loading = ref(false)
const values = reactive({ nama: '', kode: '', is_active: true })
const errors = reactive({ nama: '', kode: '' })

// Mode detection
const isEditMode = computed(() => !!route.params.id && route.name === 'ModuleForm')
const isViewMode = computed(() => route.name === 'ModuleView')
const isCopyMode = computed(() => route.query.action === 'copy')
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly)

// Load data on mount
onBeforeMount(async () => {
  const id = isCopyMode.value ? route.query.source : route.params.id
  if (id) {
    loading.value = true
    const response = await getModuleById(String(id))
    if (response.status === 'success') {
      Object.assign(values, response.data)
    }
    loading.value = false
  }
})

// Save handler
const onSave = async () => {
  if (!validate()) return
  loading.value = true
  const response = isEditMode.value 
    ? await updateModule(route.params.id, values)
    : await createModule(values)
  if (response.status === 'success') {
    toast.success('Data berhasil disimpan')
    router.push('/module-path')
  }
  loading.value = false
}`,

  toastNotification: `import { toast } from 'vue-sonner'

toast.success('Berhasil', { description: 'Data tersimpan' })
toast.error('Gagal', { description: 'Terjadi kesalahan' })
toast.info('Informasi', { description: 'Proses berjalan' })
toast.warning('Peringatan', { description: 'Pastikan data benar' })`,
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
      <div class="container flex h-16 items-center justify-between px-4 md:px-8">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <div class="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Book class="h-4 w-4 text-primary-foreground" />
            </div>
            <span class="font-bold text-xl">FE Docs</span>
          </div>
          <Badge variant="secondary">v2.0.0</Badge>
        </div>
        <div class="flex items-center gap-2">
          <Button variant="ghost" size="icon" @click="toggleDark">
            <Sun v-if="isDark" class="h-5 w-5" />
            <Moon v-else class="h-5 w-5" />
          </Button>
          <Button variant="outline" @click="goToLogin" class="gap-2">
            <ArrowLeft class="h-4 w-4" />
            Back to App
          </Button>
        </div>
      </div>
    </header>

    <div class="container px-4 md:px-8 py-8">
      <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <!-- Sidebar Navigation -->
        <aside class="hidden lg:block">
          <nav class="sticky top-24 space-y-1 max-h-[calc(100vh-8rem)] overflow-y-auto">
            <div class="text-sm font-medium text-muted-foreground mb-4">📚 Documentation</div>
            <button
              v-for="section in sections"
              :key="section.id"
              @click="activeTab = section.id"
              :class="[
                'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors',
                activeTab === section.id 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              ]"
            >
              <component :is="section.icon" class="h-4 w-4" />
              {{ section.label }}
            </button>
          </nav>
        </aside>

        <!-- Mobile Tab Navigation -->
        <div class="lg:hidden overflow-x-auto pb-4">
          <div class="flex gap-2 min-w-max">
            <button
              v-for="section in sections"
              :key="section.id"
              @click="activeTab = section.id"
              :class="[
                'flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors whitespace-nowrap',
                activeTab === section.id 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'
              ]"
            >
              <component :is="section.icon" class="h-4 w-4" />
              {{ section.label }}
            </button>
          </div>
        </div>

        <!-- Main Content -->
        <main class="min-w-0">
          <!-- OVERVIEW -->
          <section v-show="activeTab === 'overview'" class="space-y-8">
            <div>
              <h1 class="text-4xl font-bold mb-4">Frontend Documentation</h1>
              <p class="text-xl text-muted-foreground">
                Dokumentasi lengkap untuk pengembangan frontend aplikasi. Panduan ini ditujukan untuk developer baru.
              </p>
            </div>

            <Card class="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
              <CardContent class="pt-6">
                <div class="flex items-start gap-3">
                  <Info class="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <h3 class="font-semibold text-blue-900 dark:text-blue-100">Untuk Developer Baru</h3>
                    <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Mulai dari section <strong>"Quick Start"</strong> untuk membuat module baru dengan cepat.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card v-for="tech in techStack" :key="tech.name">
                <CardContent class="pt-6">
                  <div :class="['w-3 h-3 rounded-full mb-3', tech.color]"></div>
                  <h3 class="font-semibold">{{ tech.name }}</h3>
                  <p class="text-xs text-muted-foreground mt-1">{{ tech.desc }}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle class="flex items-center gap-2"><Folder class="h-5 w-5" /> Project Structure</CardTitle>
              </CardHeader>
              <CardContent>
                <pre class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>src/
├── main.ts                 # Entry point
├── App.vue                 # Root component
├── composables/            # Reusable composition functions
├── components/             # UI Components
│   ├── field/              # Form field components (15 types)
│   ├── button/             # Action button components (12 types)
│   ├── table/              # AG Grid DataTable components
│   └── ui/                 # Base shadcn-vue components
├── stores/                 # Pinia stores (auth.ts)
├── lib/                    # Utilities (api.ts, utils.ts)
├── router/                 # Vue Router config
├── directives/             # Custom directives (v-permission)
└── views/                  # Page components

template/                   # Code generation templates
add_route.cjs               # Module generator CLI</code></pre>
              </CardContent>
            </Card>
          </section>

          <!-- QUICK START -->
          <section v-show="activeTab === 'quickstart'" class="space-y-8">
            <div>
              <h1 class="text-3xl font-bold mb-4">🚀 Quick Start</h1>
              <p class="text-muted-foreground">Panduan cepat membuat module baru dengan auto-generator.</p>
            </div>

            <Card class="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
              <CardContent class="pt-6">
                <div class="flex items-start gap-3">
                  <CheckCircle class="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                  <div>
                    <h3 class="font-semibold text-green-900 dark:text-green-100">Best Practice</h3>
                    <p class="text-sm text-green-700 dark:text-green-300 mt-1">
                      Selalu gunakan <code class="bg-green-200 dark:bg-green-800 px-1 rounded">add_route.cjs</code> untuk membuat module baru.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Step 1: Jalankan Generator</CardTitle></CardHeader>
              <CardContent>
                <pre class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>node add_route.cjs purchasing/master/m_supplier</code></pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Step 2: Jawab Prompt</CardTitle></CardHeader>
              <CardContent class="space-y-3">
                <div class="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Badge variant="outline">1</Badge>
                  <div><p class="font-medium">API Endpoint</p><p class="text-sm text-muted-foreground">Nama endpoint API</p></div>
                </div>
                <div class="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Badge variant="outline">2</Badge>
                  <div><p class="font-medium">Route Path</p><p class="text-sm text-muted-foreground">Path URL (sesuai menu di database)</p></div>
                </div>
                <div class="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Badge variant="outline">3</Badge>
                  <div><p class="font-medium">Has Detail Tables?</p><p class="text-sm text-muted-foreground">Apakah form punya tabel detail?</p></div>
                </div>
                <div class="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Badge variant="outline">4</Badge>
                  <div><p class="font-medium">Has Approval Workflow?</p><p class="text-sm text-muted-foreground">Apakah perlu approval?</p></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Step 3: File yang Dihasilkan</CardTitle></CardHeader>
              <CardContent>
                <pre class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>src/views/purchasing/master/m_supplier/
├── MSupplierLanding.vue   # List page
├── MSupplierForm.vue      # Form page  
└── service.ts             # API service</code></pre>
              </CardContent>
            </Card>
          </section>

          <!-- ARCHITECTURE -->
          <section v-show="activeTab === 'architecture'" class="space-y-8">
            <div>
              <h1 class="text-3xl font-bold mb-4">Architecture</h1>
              <p class="text-muted-foreground">Arsitektur aplikasi dan pattern yang digunakan.</p>
            </div>

            <Card>
              <CardHeader><CardTitle>Data Flow</CardTitle></CardHeader>
              <CardContent>
                <div class="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline">View</Badge>
                  <ChevronRight class="h-4 w-4" />
                  <Badge variant="outline">Composable</Badge>
                  <ChevronRight class="h-4 w-4" />
                  <Badge variant="outline">Service (API)</Badge>
                  <ChevronRight class="h-4 w-4" />
                  <Badge variant="outline">Backend</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Module Pattern</CardTitle></CardHeader>
              <CardContent>
                <pre class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>views/{folder}/{module}/
├── {Module}Landing.vue   # List with DataTable
├── {Module}Form.vue      # Create/Edit/View form
└── service.ts            # API functions

# Form Modes:
# CREATE: /path/form
# EDIT: /path/form/:id
# VIEW: /path/view/:id (readonly)
# COPY: /path/form?action=copy&source=:id</code></pre>
              </CardContent>
            </Card>
          </section>

          <!-- MODULAR ROUTER -->
          <section v-show="activeTab === 'router'" class="space-y-8">
            <div>
              <h1 class="text-3xl font-bold mb-4">Modular Router Architecture</h1>
              <p class="text-muted-foreground">Router modular dengan auto-generated CRUD routes.</p>
            </div>

            <Card>
              <CardHeader><CardTitle>📊 File Structure</CardTitle></CardHeader>
              <CardContent>
                <pre class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>src/router/
├── index.ts              (249 lines) - Main router + guards
├── helpers.ts            (125 lines) - Route generators
├── crud-routes.ts        (207 lines) - CRUD route configs
├── notifications.ts       (73 lines) - Notification routes
└── special-routes.ts      (17 lines) - Special routes

OLD: 1,429 lines in 1 file
NEW: 671 lines in 5 files (53% reduction)</code></pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>✨ Benefits</CardTitle></CardHeader>
              <CardContent class="space-y-2">
                <div class="flex items-start gap-2">
                  <CheckCircle class="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p class="font-medium">82% Less Code</p>
                    <p class="text-sm text-muted-foreground">Main router hanya 249 baris</p>
                  </div>
                </div>
                <div class="flex items-start gap-2">
                  <CheckCircle class="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p class="font-medium">Auto-Generated Routes</p>
                    <p class="text-sm text-muted-foreground">1 config = 3 routes (Landing, Form, View)</p>
                  </div>
                </div>
                <div class="flex items-start gap-2">
                  <CheckCircle class="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p class="font-medium">Organized by Module</p>
                    <p class="text-sm text-muted-foreground">Setup, Purchasing, Inventory, Marketing</p>
                  </div>
                </div>
                <div class="flex items-start gap-2">
                  <CheckCircle class="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p class="font-medium">Type-Safe Helpers</p>
                    <p class="text-sm text-muted-foreground">TypeScript with RouteRecordRaw</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>🚀 Adding CRUD Routes</CardTitle></CardHeader>
              <CardContent>
                <p class="text-sm mb-4">Edit <code class="bg-muted px-2 py-1 rounded">crud-routes.ts</code> dan tambahkan config:</p>
                <pre class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>const crudRoutesConfig = [
  // ... existing configs
  {
    path: '/setup/m_new_module',
    name: 'NewModule',
    title: 'New Module',
    basePath: '/setup/m_new_module',
  },
]

// Auto-generates:
// - GET  /setup/m_new_module           (Landing)
// - GET  /setup/m_new_module/form/:id? (Form)
// - GET  /setup/m_new_module/view/:id  (View)</code></pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>🔔 Adding Notification Routes</CardTitle></CardHeader>
              <CardContent>
                <p class="text-sm mb-4">Edit <code class="bg-muted px-2 py-1 rounded">notifications.ts</code>:</p>
                <pre class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>...generateNotificationRoutes([
  // ... existing routes
  {
    path: 'your_module',
    name: 'NotifikasiYourModuleDetail',
    component: 'NotifikasiYourModuleDetail.vue',
    title: 'Notifikasi Your Module',
  },
])

// Auto-generates:
// - GET /notifikasi/your_module/:id</code></pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>🔧 add_route.cjs Integration</CardTitle></CardHeader>
              <CardContent class="space-y-4">
                <p class="text-sm">Script <code class="bg-muted px-2 py-1 rounded">add_route.cjs</code> automatically adds to appropriate file:</p>
                
                <div>
                  <p class="font-medium text-sm mb-2">For CRUD Modules:</p>
                  <pre class="bg-muted p-3 rounded-lg text-sm"><code>node add_route.cjs setup/m_supplier

✅ Adds config to crud-routes.ts
✅ Auto-generates 3 routes</code></pre>
                </div>

                <div>
                  <p class="font-medium text-sm mb-2">For Approval Workflow:</p>
                  <pre class="bg-muted p-3 rounded-lg text-sm"><code>node add_route.cjs purchasing/transaksi/t_purchase_order
# Choose YES for approval

✅ Adds to crud-routes.ts
✅ Adds to notifications.ts
✅ Generates notification components</code></pre>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>📚 Documentation</CardTitle></CardHeader>
              <CardContent>
                <p class="text-sm">Lihat dokumentasi lengkap di:</p>
                <ul class="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
                  <li><code>MODULAR_ROUTER_MIGRATION.md</code> - Migration guide</li>
                  <li><code>ADD_ROUTE_README.md</code> - Script documentation</li>
                  <li><code>src/router/index.ts.backup</code> - Original router backup</li>
                </ul>
              </CardContent>
            </Card>
          </section>

          <!-- SHADCN VUE (REKA UI) -->
          <section v-show="activeTab === 'shadcn'" class="space-y-8">
            <div>
              <h1 class="text-3xl font-bold mb-4">Shadcn Vue (Reka UI)</h1>
              <p class="text-muted-foreground">Beautiful, accessible components built with Reka UI & TailwindCSS.</p>
            </div>

            <Card>
              <CardHeader><CardTitle>🎨 What is Shadcn Vue?</CardTitle></CardHeader>
              <CardContent class="space-y-4">
                <p class="text-sm">
                  Shadcn Vue adalah collection of reusable components yang:
                </p>
                <ul class="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                  <li><strong>Tidak di-install sebagai dependency</strong> - Copy source code langsung ke project</li>
                  <li><strong>Full ownership</strong> - Customize sesuka hati tanpa khawatir breaking changes</li>
                  <li><strong>Built with Reka UI</strong> - Headless UI primitives (fork dari Radix Vue)</li>
                  <li><strong>Styled with TailwindCSS</strong> - Utility-first CSS framework</li>
                  <li><strong>Accessible by default</strong> - WAI-ARIA compliant</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>📦 Package Used: Reka UI</CardTitle></CardHeader>
              <CardContent class="space-y-4">
                <p class="text-sm">
                  Project ini menggunakan <strong>Reka UI</strong> (<code class="bg-muted px-2 py-1 rounded">reka-ui</code>) 
                  sebagai headless UI primitives:
                </p>
                <pre class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>// package.json
"dependencies": {
  "reka-ui": "^2.6.0",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "tailwind-merge": "^2.5.4"
}</code></pre>
                <p class="text-sm text-muted-foreground">
                  Reka UI adalah Vue port dari Radix UI (React), menyediakan unstyled, accessible components.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>🧩 Available Components</CardTitle></CardHeader>
              <CardContent>
                <p class="text-sm mb-3">Semua components ada di <code class="bg-muted px-2 py-1 rounded">src/components/ui/</code>:</p>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <Badge variant="outline">Accordion</Badge>
                  <Badge variant="outline">Alert</Badge>
                  <Badge variant="outline">Avatar</Badge>
                  <Badge variant="outline">Badge</Badge>
                  <Badge variant="outline">Button</Badge>
                  <Badge variant="outline">Calendar</Badge>
                  <Badge variant="outline">Card</Badge>
                  <Badge variant="outline">Checkbox</Badge>
                  <Badge variant="outline">Collapsible</Badge>
                  <Badge variant="outline">Command</Badge>
                  <Badge variant="outline">Dialog</Badge>
                  <Badge variant="outline">Dropdown Menu</Badge>
                  <Badge variant="outline">Input</Badge>
                  <Badge variant="outline">Label</Badge>
                  <Badge variant="outline">Popover</Badge>
                  <Badge variant="outline">Radio Group</Badge>
                  <Badge variant="outline">ScrollArea</Badge>
                  <Badge variant="outline">Select</Badge>
                  <Badge variant="outline">Separator</Badge>
                  <Badge variant="outline">Sheet</Badge>
                  <Badge variant="outline">Sonner (Toast)</Badge>
                  <Badge variant="outline">Switch</Badge>
                  <Badge variant="outline">Table</Badge>
                  <Badge variant="outline">Tabs</Badge>
                  <Badge variant="outline">Textarea</Badge>
                  <Badge variant="outline">Toggle</Badge>
                  <Badge variant="outline">Tooltip</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>💡 Usage Example</CardTitle></CardHeader>
              <CardContent>
                <pre class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>&lt;script setup&gt;
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const open = ref(false)
&lt;/script&gt;

&lt;template&gt;
  &lt;Dialog v-model:open="open"&gt;
    &lt;DialogTrigger as-child&gt;
      &lt;Button&gt;Open Dialog&lt;/Button&gt;
    &lt;/DialogTrigger&gt;
    &lt;DialogContent&gt;
      &lt;DialogHeader&gt;
        &lt;DialogTitle&gt;Edit Profile&lt;/DialogTitle&gt;
        &lt;DialogDescription&gt;
          Make changes to your profile here.
        &lt;/DialogDescription&gt;
      &lt;/DialogHeader&gt;
      &lt;div class="space-y-4"&gt;
        &lt;div&gt;
          &lt;Label for="name"&gt;Name&lt;/Label&gt;
          &lt;Input id="name" v-model="name" /&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/DialogContent&gt;
  &lt;/Dialog&gt;
&lt;/template&gt;</code></pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>🎯 Custom Components</CardTitle></CardHeader>
              <CardContent class="space-y-3">
                <p class="text-sm">Project ini juga punya wrapper components yang sudah disesuaikan:</p>
                <ul class="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  <li><strong>Field Components</strong> - FieldX, FieldNumber, FieldDate, FieldSelect, dll</li>
                  <li><strong>Button Components</strong> - EditButton, DeleteButton, CopyButton, dll</li>
                  <li><strong>DataTable</strong> - Wrapper untuk AG Grid dengan Shadcn styling</li>
                  <li><strong>Global Dialog</strong> - Centralized dialog untuk konfirmasi</li>
                </ul>
                <p class="text-sm mt-3">
                  Semua wrapper ini menggunakan Shadcn UI components sebagai basis.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>🔗 Resources</CardTitle></CardHeader>
              <CardContent class="space-y-2">
                <div class="flex items-center gap-2">
                  <Badge>Shadcn Vue</Badge>
                  <a href="https://www.shadcn-vue.com" target="_blank" class="text-sm text-blue-500 hover:underline">
                    shadcn-vue.com
                  </a>
                </div>
                <div class="flex items-center gap-2">
                  <Badge>Reka UI</Badge>
                  <a href="https://reka-ui.com" target="_blank" class="text-sm text-blue-500 hover:underline">
                    reka-ui.com
                  </a>
                </div>
                <div class="flex items-center gap-2">
                  <Badge>TailwindCSS</Badge>
                  <a href="https://tailwindcss.com" target="_blank" class="text-sm text-blue-500 hover:underline">
                    tailwindcss.com
                  </a>
                </div>
              </CardContent>
            </Card>
          </section>

          <!-- MODULE GENERATOR -->
          <section v-show="activeTab === 'generator'" class="space-y-8">
            <div>
              <h1 class="text-3xl font-bold mb-4">Module Generator (add_route.cjs)</h1>
              <p class="text-muted-foreground">CLI tool untuk generate module baru otomatis.</p>
            </div>

            <Card>
              <CardHeader>
                <div class="flex items-center justify-between">
                  <CardTitle>Basic Usage</CardTitle>
                  <Button variant="ghost" size="sm" @click="copyCode(codeExamples.generatorBasic, 'genBasic')">
                    <Check v-if="copiedCode === 'genBasic'" class="h-4 w-4" /><Copy v-else class="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{{ codeExamples.generatorBasic }}</code></pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div class="flex items-center justify-between">
                  <CardTitle>Advanced Usage</CardTitle>
                  <Button variant="ghost" size="sm" @click="copyCode(codeExamples.generatorAdvanced, 'genAdv')">
                    <Check v-if="copiedCode === 'genAdv'" class="h-4 w-4" /><Copy v-else class="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{{ codeExamples.generatorAdvanced }}</code></pre>
              </CardContent>
            </Card>
          </section>

          <!-- AUTHENTICATION -->
          <section v-show="activeTab === 'authentication'" class="space-y-8">
            <div>
              <h1 class="text-3xl font-bold mb-4">Authentication System</h1>
              <p class="text-muted-foreground">Sistem autentikasi berbasis JWT.</p>
            </div>

            <Card>
              <CardHeader><CardTitle>Login Flow</CardTitle></CardHeader>
              <CardContent>
                <ol class="list-decimal list-inside space-y-2 text-sm">
                  <li>User submit credentials → POST /auth/login</li>
                  <li>Server returns JWT token + user data</li>
                  <li>authStore.login() saves to localStorage (auth_bb)</li>
                  <li>Fetch user permissions, save to SelectRespo</li>
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>User Types</CardTitle></CardHeader>
              <CardContent class="space-y-3">
                <div class="flex items-start gap-3">
                  <Badge class="bg-red-500">SUPER ADMIN</Badge>
                  <span class="text-sm">Full access, bypasses all permission checks</span>
                </div>
                <div class="flex items-start gap-3">
                  <Badge class="bg-blue-500">Regular User</Badge>
                  <span class="text-sm">Access based on Responsibility → Role → Menu Permissions</span>
                </div>
              </CardContent>
            </Card>
          </section>

          <!-- API LAYER -->
          <section v-show="activeTab === 'api'" class="space-y-8">
            <div>
              <h1 class="text-3xl font-bold mb-4">API Layer</h1>
              <p class="text-muted-foreground">Centralized API client dengan authentication.</p>
            </div>

            <Card>
              <CardHeader>
                <div class="flex items-center justify-between">
                  <CardTitle>apiCall Function</CardTitle>
                  <Button variant="ghost" size="sm" @click="copyCode(codeExamples.apiCall, 'apiCall')">
                    <Check v-if="copiedCode === 'apiCall'" class="h-4 w-4" /><Copy v-else class="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{{ codeExamples.apiCall }}</code></pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div class="flex items-center justify-between">
                  <CardTitle>Service Pattern</CardTitle>
                  <Button variant="ghost" size="sm" @click="copyCode(codeExamples.servicePattern, 'svcPat')">
                    <Check v-if="copiedCode === 'svcPat'" class="h-4 w-4" /><Copy v-else class="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{{ codeExamples.servicePattern }}</code></pre>
              </CardContent>
            </Card>
          </section>

          <!-- AG GRID DATATABLE -->
          <section v-show="activeTab === 'datatable'" class="space-y-8">
            <div>
              <h1 class="text-3xl font-bold mb-4">AG Grid DataTable</h1>
              <p class="text-muted-foreground">DataTable menggunakan <strong>AG Grid Community Edition</strong>.</p>
            </div>

            <Card class="border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950">
              <CardContent class="pt-6">
                <div class="flex items-start gap-3">
                  <Grid3X3 class="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                  <div>
                    <h3 class="font-semibold text-orange-900 dark:text-orange-100">AG Grid Integration</h3>
                    <p class="text-sm text-orange-700 dark:text-orange-300 mt-1">
                      File: <code class="bg-orange-200 dark:bg-orange-800 px-1 rounded">src/components/table/DataTable.vue</code>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Features</CardTitle></CardHeader>
              <CardContent>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div v-for="feature in dataTableFeatures" :key="feature.name" class="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <CheckCircle class="h-4 w-4 text-green-500 mt-0.5" />
                    <div>
                      <span class="font-medium text-sm">{{ feature.name }}</span>
                      <p class="text-sm text-muted-foreground">{{ feature.desc }}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div class="flex items-center justify-between">
                  <CardTitle>Column Configuration</CardTitle>
                  <Button variant="ghost" size="sm" @click="copyCode(codeExamples.dataTableColumns, 'dtCol')">
                    <Check v-if="copiedCode === 'dtCol'" class="h-4 w-4" /><Copy v-else class="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{{ codeExamples.dataTableColumns }}</code></pre>
              </CardContent>
            </Card>
          </section>

          <!-- FIELD COMPONENTS -->
          <section v-show="activeTab === 'fieldcomponents'" class="space-y-8">
            <div>
              <h1 class="text-3xl font-bold mb-4">Field Components</h1>
              <p class="text-muted-foreground">Komponen form field. Lokasi: src/components/field/</p>
            </div>

            <Card>
              <CardHeader>
                <div class="flex items-center justify-between">
                  <CardTitle>FieldPopup Example</CardTitle>
                  <Button variant="ghost" size="sm" @click="copyCode(codeExamples.fieldPopup, 'fp')">
                    <Check v-if="copiedCode === 'fp'" class="h-4 w-4" /><Copy v-else class="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{{ codeExamples.fieldPopup }}</code></pre>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>All Field Components</CardTitle></CardHeader>
              <CardContent>
                <div class="space-y-4">
                  <div v-for="field in fieldComponents" :key="field.name" class="p-4 rounded-lg bg-muted/50 space-y-2">
                    <div class="flex items-center gap-2">
                      <Badge variant="outline" class="font-mono">{{ field.name }}</Badge>
                      <span class="text-sm font-medium">{{ field.desc }}</span>
                    </div>
                    <p class="text-xs text-muted-foreground"><strong>Props:</strong> {{ field.props }}</p>
                    <p class="text-xs text-muted-foreground"><strong>Usage:</strong> {{ field.usage }}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <!-- BUTTON COMPONENTS -->
          <section v-show="activeTab === 'buttoncomponents'" class="space-y-8">
            <div>
              <h1 class="text-3xl font-bold mb-4">Button Components</h1>
              <p class="text-muted-foreground">Komponen button. Lokasi: src/components/button/</p>
            </div>

            <Card>
              <CardHeader><CardTitle>All Button Components</CardTitle></CardHeader>
              <CardContent>
                <div class="space-y-4">
                  <div v-for="btn in buttonComponents" :key="btn.name" class="p-4 rounded-lg bg-muted/50 space-y-2">
                    <div class="flex items-center gap-2">
                      <Badge variant="outline" class="font-mono">{{ btn.name }}</Badge>
                      <span class="text-sm font-medium">{{ btn.desc }}</span>
                    </div>
                    <p class="text-xs text-muted-foreground"><strong>Props:</strong> {{ btn.props }}</p>
                    <p class="text-xs text-muted-foreground"><strong>Usage:</strong> {{ btn.usage }}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <!-- UI COMPONENTS -->
          <section v-show="activeTab === 'ui'" class="space-y-8">
            <div>
              <h1 class="text-3xl font-bold mb-4">UI Components (shadcn-vue)</h1>
              <p class="text-muted-foreground">Base UI components. Lokasi: src/components/ui/</p>
            </div>

            <Card>
              <CardHeader><CardTitle>Component List</CardTitle></CardHeader>
              <CardContent>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div v-for="ui in uiComponents" :key="ui.name" class="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                    <Badge variant="outline" class="shrink-0">{{ ui.name }}</Badge>
                    <span class="text-xs text-muted-foreground">{{ ui.desc }}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div class="flex items-center justify-between">
                  <CardTitle>Toast Notifications</CardTitle>
                  <Button variant="ghost" size="sm" @click="copyCode(codeExamples.toastNotification, 'toast')">
                    <Check v-if="copiedCode === 'toast'" class="h-4 w-4" /><Copy v-else class="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{{ codeExamples.toastNotification }}</code></pre>
              </CardContent>
            </Card>
          </section>

          <!-- COMPOSABLES -->
          <section v-show="activeTab === 'composables'" class="space-y-8">
            <div>
              <h1 class="text-3xl font-bold mb-4">Composables</h1>
              <p class="text-muted-foreground">Reusable composition functions. Lokasi: src/composables/</p>
            </div>

            <div class="space-y-4">
              <Card v-for="comp in composables" :key="comp.name">
                <CardHeader>
                  <CardTitle class="font-mono text-lg">{{ comp.name }}</CardTitle>
                  <CardDescription>{{ comp.desc }}</CardDescription>
                </CardHeader>
                <CardContent class="space-y-4">
                  <div>
                    <p class="text-sm font-medium mb-2">Returns:</p>
                    <div class="flex flex-wrap gap-2">
                      <Badge v-for="ret in comp.returns.split(', ')" :key="ret" variant="secondary" class="font-mono text-xs">{{ ret }}</Badge>
                    </div>
                  </div>
                  <div>
                    <p class="text-sm font-medium mb-2">Example:</p>
                    <pre class="bg-muted p-3 rounded-lg text-xs overflow-x-auto"><code>{{ comp.example }}</code></pre>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <!-- PINIA STORES -->
          <section v-show="activeTab === 'stores'" class="space-y-8">
            <div>
              <h1 class="text-3xl font-bold mb-4">Pinia Stores</h1>
              <p class="text-muted-foreground">Global state management. Lokasi: src/stores/</p>
            </div>

            <Card v-for="store in storesList" :key="store.name">
              <CardHeader>
                <CardTitle class="font-mono">{{ store.name }}.ts</CardTitle>
                <CardDescription>{{ store.desc }}</CardDescription>
              </CardHeader>
              <CardContent class="space-y-4">
                <div>
                  <p class="text-sm font-medium mb-2">State:</p>
                  <div class="flex flex-wrap gap-2">
                    <Badge v-for="s in store.state.split(', ')" :key="s" variant="outline" class="font-mono text-xs">{{ s }}</Badge>
                  </div>
                </div>
                <div>
                  <p class="text-sm font-medium mb-2">Actions:</p>
                  <div class="flex flex-wrap gap-2">
                    <Badge v-for="a in store.actions.split(', ')" :key="a" variant="secondary" class="font-mono text-xs">{{ a }}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <!-- PERMISSIONS -->
          <section v-show="activeTab === 'permissions'" class="space-y-8">
            <div>
              <h1 class="text-3xl font-bold mb-4">Permission System</h1>
              <p class="text-muted-foreground">Role-based access control.</p>
            </div>

            <Card>
              <CardHeader><CardTitle>Permission Hierarchy</CardTitle></CardHeader>
              <CardContent>
                <div class="flex flex-wrap items-center gap-2 text-sm">
                  <Badge>User</Badge>
                  <ChevronRight class="h-4 w-4" />
                  <Badge variant="secondary">Responsibility</Badge>
                  <ChevronRight class="h-4 w-4" />
                  <Badge variant="secondary">Role</Badge>
                  <ChevronRight class="h-4 w-4" />
                  <Badge variant="outline">Menu Permissions</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div class="flex items-center justify-between">
                  <CardTitle>v-permission Directive</CardTitle>
                  <Button variant="ghost" size="sm" @click="copyCode(codeExamples.permission, 'perm')">
                    <Check v-if="copiedCode === 'perm'" class="h-4 w-4" /><Copy v-else class="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{{ codeExamples.permission }}</code></pre>
              </CardContent>
            </Card>
          </section>

          <!-- APPROVAL WORKFLOW -->
          <section v-show="activeTab === 'approval'" class="space-y-8">
            <div>
              <h1 class="text-3xl font-bold mb-4">Approval Workflow</h1>
              <p class="text-muted-foreground">Multi-level approval system.</p>
            </div>

            <Card>
              <CardHeader><CardTitle>Status Flow</CardTitle></CardHeader>
              <CardContent>
                <div class="flex flex-wrap items-center gap-2 text-sm">
                  <Badge class="bg-gray-500">DRAFT</Badge>
                  <ChevronRight class="h-4 w-4" />
                  <Badge class="bg-blue-500">IN APPROVAL</Badge>
                  <ChevronRight class="h-4 w-4" />
                  <Badge class="bg-green-500">APPROVED</Badge>
                  <span class="text-muted-foreground">or</span>
                  <Badge class="bg-red-500">REJECT</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Status Descriptions</CardTitle></CardHeader>
              <CardContent>
                <div class="space-y-3">
                  <div v-for="status in approvalStatuses" :key="status.status" class="flex items-center gap-3">
                    <Badge :class="status.color" class="w-28 justify-center">{{ status.status }}</Badge>
                    <span class="text-sm text-muted-foreground">{{ status.desc }}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <!-- NOTIFICATION -->
          <section v-show="activeTab === 'notification'" class="space-y-8">
            <div>
              <h1 class="text-3xl font-bold mb-4">Notification System</h1>
              <p class="text-muted-foreground">In-app notification untuk approvals. Lokasi: src/views/notifikasi/</p>
            </div>

            <Card>
              <CardHeader><CardTitle>Notification Types</CardTitle></CardHeader>
              <CardContent class="space-y-3">
                <div class="flex items-center gap-3">
                  <Badge class="bg-blue-500">Pending Approval</Badge>
                  <span class="text-sm text-muted-foreground">Dokumen menunggu approval</span>
                </div>
                <div class="flex items-center gap-3">
                  <Badge class="bg-yellow-500">Revisi</Badge>
                  <span class="text-sm text-muted-foreground">Dokumen dikembalikan untuk revisi</span>
                </div>
              </CardContent>
            </Card>
          </section>

          <!-- TEMPLATES -->
          <section v-show="activeTab === 'templates'" class="space-y-8">
            <div>
              <h1 class="text-3xl font-bold mb-4">Template System</h1>
              <p class="text-muted-foreground">Code templates untuk generator. Lokasi: template/</p>
            </div>

            <Card>
              <CardHeader><CardTitle>Available Templates</CardTitle></CardHeader>
              <CardContent>
                <div class="space-y-4">
                  <div v-for="tpl in templates" :key="tpl.name" class="p-4 rounded-lg bg-muted/50 space-y-2">
                    <div class="flex items-center gap-2">
                      <FileCode class="h-4 w-4 text-muted-foreground" />
                      <code class="font-medium">{{ tpl.name }}</code>
                    </div>
                    <p class="text-sm text-muted-foreground">{{ tpl.desc }}</p>
                    <p class="text-xs text-muted-foreground"><strong>Generates:</strong> {{ tpl.generates }}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <!-- DIRECTIVES -->
          <section v-show="activeTab === 'directives'" class="space-y-8">
            <div>
              <h1 class="text-3xl font-bold mb-4">Custom Directives</h1>
              <p class="text-muted-foreground">Vue custom directives. Lokasi: src/directives/</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>v-permission</CardTitle>
                <CardDescription>Kontrol visibility element berdasarkan permission</CardDescription>
              </CardHeader>
              <CardContent class="space-y-2 text-sm">
                <div class="grid grid-cols-[100px_1fr] gap-2">
                  <code class="bg-muted px-2 py-0.5 rounded">menuId</code>
                  <span class="text-muted-foreground">Menu ID untuk check permission</span>
                </div>
                <div class="grid grid-cols-[100px_1fr] gap-2">
                  <code class="bg-muted px-2 py-0.5 rounded">action</code>
                  <span class="text-muted-foreground">'create' | 'read' | 'update' | 'delete' | 'print'</span>
                </div>
                <div class="grid grid-cols-[100px_1fr] gap-2">
                  <code class="bg-muted px-2 py-0.5 rounded">behavior</code>
                  <span class="text-muted-foreground">'disable' (default) | 'hide'</span>
                </div>
              </CardContent>
            </Card>
          </section>

          <!-- CONVENTIONS -->
          <section v-show="activeTab === 'conventions'" class="space-y-8">
            <div>
              <h1 class="text-3xl font-bold mb-4">Conventions & Patterns</h1>
              <p class="text-muted-foreground">Coding standards dan patterns.</p>
            </div>

            <Card>
              <CardHeader><CardTitle>File Naming</CardTitle></CardHeader>
              <CardContent class="space-y-2 text-sm">
                <div class="grid grid-cols-[150px_1fr] gap-2">
                  <span class="font-medium">Components</span>
                  <code class="bg-muted px-2 py-0.5 rounded">PascalCase.vue</code>
                </div>
                <div class="grid grid-cols-[150px_1fr] gap-2">
                  <span class="font-medium">Composables</span>
                  <code class="bg-muted px-2 py-0.5 rounded">useXxx.ts</code>
                </div>
                <div class="grid grid-cols-[150px_1fr] gap-2">
                  <span class="font-medium">Views</span>
                  <code class="bg-muted px-2 py-0.5 rounded">{Module}Landing.vue, {Module}Form.vue</code>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div class="flex items-center justify-between">
                  <CardTitle>Form Pattern</CardTitle>
                  <Button variant="ghost" size="sm" @click="copyCode(codeExamples.formPattern, 'formPat')">
                    <Check v-if="copiedCode === 'formPat'" class="h-4 w-4" /><Copy v-else class="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre class="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{{ codeExamples.formPattern }}</code></pre>
              </CardContent>
            </Card>
          </section>
        </main>
      </div>
    </div>

    <!-- Footer -->
    <footer class="border-t mt-16">
      <div class="container px-4 md:px-8 py-8">
        <div class="flex flex-col md:flex-row items-center justify-between gap-4">
          <div class="flex items-center gap-2">
            <div class="h-6 w-6 rounded bg-primary flex items-center justify-center">
              <Book class="h-3 w-3 text-primary-foreground" />
            </div>
            <span class="text-sm text-muted-foreground">FE Docs - Frontend Documentation</span>
          </div>
          <div class="text-sm text-muted-foreground">Built with Vue 3 + TypeScript + Vite + AG Grid</div>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
code {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace;
}
pre code {
  white-space: pre;
}
</style>
