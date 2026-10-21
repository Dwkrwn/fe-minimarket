# 🚀 Add Route Script - Dokumentasi

Script untuk membuat module baru secara otomatis dengan struktur file dan route registration.

**Tersedia 2 versi:**
- 🔵 **PowerShell** (`add_route.ps1`) - Untuk Windows dengan PowerShell 7+
- 🟢 **Node.js** (`add_route.cjs`) - Cross-platform, **recommended untuk PowerShell 5.1 atau lebih lama**

## ⚡ NEW: Modular Router Architecture

Script sekarang mendukung **modular router architecture** yang baru! Routes akan ditambahkan ke file-file terpisah untuk kemudahan maintenance:

- 📁 **`router/crud-routes.ts`** - Auto-generated CRUD routes (Landing, Form, View)
- 📁 **`router/notifications.ts`** - Notification routes
- 📁 **`router/special-routes.ts`** - Special non-CRUD routes
- 📁 **`router/helpers.ts`** - Helper functions untuk route generation
- 📁 **`router/index.ts`** - Main router (lebih simple, hanya 249 lines!)

### Keuntungan Struktur Baru:
✅ **82% lebih sedikit kode** di main router  
✅ **Lebih mudah dibaca dan maintain**  
✅ **Auto-generate** CRUD routes dengan config  
✅ **Terorganisir by module** (Setup, Purchasing, Inventory, Marketing)  
✅ **Type-safe** dengan TypeScript helpers  

## 📋 Fitur

- ✅ Membuat struktur folder otomatis
- ✅ Copy template dari folder `template/`
- ✅ Rename file sesuai module name (PascalCase)
- ✅ Replace content dalam file
- ✅ **🆕 Register routes otomatis ke `router/crud-routes.ts`** (CRUD) atau `router/notifications.ts` (Notification)
- ✅ Support nested module (module/submodule/name)
- ✅ **Support approval workflow** (DRAFT, IN APPROVAL, APPROVED, REJECT, REVISE)
- ✅ **🆕 Auto-generate Notification files** (Detail page + Service file)
- ✅ **🆕 Auto-register notification routes** ke router modular
- ✅ Support detail tables (Add To List & Multi Select)
- ✅ Konfirmasi sebelum overwrite

## 🆕 Approval Workflow Feature

Script sekarang mendukung pembuatan form dengan approval workflow! Fitur ini cocok untuk transaksi yang memerlukan proses approval seperti:
- Purchase Request
- Purchase Order
- Sales Order
- Leave Request
- Expense Claim
- dll.

### Apa yang Didapatkan dengan Approval Workflow?

Jika Anda memilih **"YES"** saat ditanya approval workflow, maka:

#### 1. **Status System**
- Status: `DRAFT`, `IN APPROVAL`, `APPROVED`, `REJECT`, `REVISE`
- Status filter buttons dengan warna badge:
  - 🟤 DRAFT (Gray)
  - 🔵 IN APPROVAL (Blue)
  - 🟢 APPROVED (Green)
  - 🔴 REJECT (Red)
  - 🟡 REVISE (Yellow)

#### 2. **Send Approval Button**
- Tombol "Send Approval" pada Landing page
- Hanya muncul untuk status `DRAFT`
- Modal dengan textarea untuk catatan approval
- Otomatis update status menjadi `IN APPROVAL`

#### 3. **Auto-filled User Fields**
- Field `req_type_user` (readonly) - Diisi otomatis dari user tipe (e.g., "SUPER ADMIN")
- Field `req_user_by` (readonly) - Diisi otomatis dari nama user (e.g., "Tetsuya")

#### 4. **Action Button Logic**
- Edit & Delete hanya untuk status `DRAFT`
- View untuk semua status
- Copy untuk semua status (dengan role permission)

#### 5. **Notification Files (🆕 NEW)**
Jika approval workflow diaktifkan, script akan otomatis generate:

- **Notifikasi[Module]Detail.vue** - Halaman detail approval notification
  - Location: `src/views/notifikasi/Notifikasi{PascalName}Detail.vue`
  - Responsive design (mobile-first)
  - Approval buttons (Approve/Revise)
  - Status badge dengan warna

- **service.[module].ts** - Service file untuk notification
  - Location: `src/views/notifikasi/service.{module_lower}.ts`
  - Get notifications for approval
  - Approve/Revise functions
  - Get revisi notifications

- **Router registration**
  - Route: `/notifikasi/{notification_type}/:id`
  - Component: `Notifikasi{PascalName}Detail.vue`

#### 6. **Template Files**
Menggunakan template khusus:
- `LandingWithApproval.txt` - Landing dengan filter status & send approval
- `FormWithApproval.txt` - Form dengan readonly user fields & status
- `NotifikasiDetail.txt` - 🆕 Template untuk notification detail page
- `NotifikasiService.txt` - 🆕 Template untuk notification service file

### Contoh Penggunaan Approval Workflow

```bash
# Jalankan script
node add_route.cjs purchasing/transaksi/t_purchase_order

# Pertanyaan yang akan muncul:
# 1. API Endpoint: t_purchase_order
# 2. Route Path: /purchasing/transaksi/t_purchase_order
# 3. Detail Items? y/n: y  (jika butuh detail table)
# 4. Berapa detail table? 2
# 5. Gunakan approval workflow? y/n: y  ← PILIH YES untuk approval
```

Output yang dihasilkan:
```
✅ PurchaseOrderLanding.vue (with approval workflow)
✅ PurchaseOrderForm.vue (with approval fields)
✅ service.ts
✅ Status: DRAFT, IN APPROVAL, APPROVED, REJECT, REVISE
✅ Send Approval Button
✅ Auto-filled: req_type_user, req_user_by

🔔 Notification Files:
   ✅ src/views/notifikasi/NotifikasiPurchaseOrderDetail.vue
   ✅ src/views/notifikasi/service.purchaseorder.ts
   ✅ Route: /notifikasi/purchase_order/:id
```

## 📝 Workflow - Step by Step

### Step 1: Tambah Menu di Web (WAJIB!)

**Sebelum menjalankan script, HARUS input menu dulu di aplikasi web!**

#### A. Login & Buka Menu Management

1. **Login ke aplikasi** (http://localhost:5173/login)
2. **Buka halaman:** `SETUP > MENU`
3. **Klik tombol:** `"Tambah Menu Baru"` (tombol biru di kanan atas)

#### B. Isi Form Menu

Form menu memiliki beberapa field penting:

| Field | Type | Required | Keterangan |
|-------|------|----------|------------|
| **Nama Menu** | Text | ✅ | Nama yang muncul di sidebar |
| **Modul** | Text | ✅ | Kategori utama (SETUP, PURCHASING, dll) |
| **Sub Modul** | Text | ❌ | Sub kategori (opsional, untuk nested menu) |
| **Path** | Text | ✅ | ⚠️ **PALING PENTING!** Route path aplikasi |
| **Icon** | Select | ✅ | Icon dari Lucide Icons |
| **Deskripsi** | Textarea | ❌ | Deskripsi menu |
| **Seq** | Number | ✅ | Urutan tampil (semakin kecil, semakin atas) |
| **Status** | Toggle | ✅ | Aktif/Nonaktif |

#### C. Contoh Input Menu

##### Contoh 1: General Setting (Single Level - No Sub Module)

**Scenario:** Membuat menu General di bawah SETUP

| Field | Value | Keterangan |
|-------|-------|------------|
| **Nama Menu** | `General` | Nama yang muncul di sidebar |
| **Modul** | `SETUP` | Kategori utama |
| **Sub Modul** | _(kosong)_ | Tidak ada sub modul |
| **Path** | `/setup/m_general` | ⚠️ **PENTING!** Route path |
| **Icon** | `Settings` | Icon Lucide |
| **Deskripsi** | `Master data general setting` | Deskripsi menu |
| **Seq** | `10` | Urutan tampil |
| **Status** | `Aktif` ✅ | Status menu aktif |

**Result di Sidebar:**
```
SETUP
  ├─ MENU
  └─ General    ← Menu baru
```

##### Contoh 2: Supplier (Multi Level - With Sub Module)

**Scenario:** Membuat menu Supplier di bawah PURCHASING > MASTER

| Field | Value | Keterangan |
|-------|-------|------------|
| **Nama Menu** | `Supplier` | Nama yang muncul di sidebar |
| **Modul** | `PURCHASING` | Kategori utama |
| **Sub Modul** | `MASTER` | Sub kategori |
| **Path** | `/purchasing/master/m_supplier` | ⚠️ **PENTING!** Route path |
| **Icon** | `Truck` | Icon Lucide |
| **Deskripsi** | `Master data supplier` | Deskripsi menu |
| **Seq** | `10` | Urutan tampil |
| **Status** | `Aktif` ✅ | Status menu aktif |

**Result di Sidebar:**
```
PURCHASING
  └─ MASTER
       └─ Supplier    ← Menu baru
```

##### Contoh 3: Stock (Single Level Under New Module)

**Scenario:** Membuat menu Stock di bawah INVENTORY (module baru)

| Field | Value | Keterangan |
|-------|-------|------------|
| **Nama Menu** | `Stock` | Nama yang muncul di sidebar |
| **Modul** | `INVENTORY` | Kategori utama (baru) |
| **Sub Modul** | _(kosong)_ | Tidak ada sub modul |
| **Path** | `/inventory/m_stock` | ⚠️ **PENTING!** Route path |
| **Icon** | `Package` | Icon Lucide |
| **Deskripsi** | `Master data stock inventory` | Deskripsi menu |
| **Seq** | `10` | Urutan tampil |
| **Status** | `Aktif` ✅ | Status menu aktif |

**Result di Sidebar:**
```
INVENTORY          ← Module baru
  └─ Stock         ← Menu baru
```

#### D. Simpan & Verifikasi

1. **Klik tombol "Simpan"**
2. **Tunggu toast notification:** "Menu berhasil dibuat"
3. **Refresh Sidebar:** Klik tombol "Refresh Menu" di sidebar (tombol dengan icon refresh)
4. **Verifikasi:** Menu baru harus muncul di sidebar sesuai hierarchy

#### E. ⚠️ **PENTING - Format Path yang BENAR!**

Path adalah field **PALING PENTING** karena:
- ✅ Menentukan URL route aplikasi
- ✅ Digunakan sebagai parameter script
- ✅ Harus konsisten antara database dan script

**Format Path:**
```
/module[/submodule]/m_name
```

**Rules:**
1. ✅ **HARUS** diawali dengan `/` (leading slash)
2. ✅ **HARUS** pakai prefix `m_` untuk nama module
3. ✅ **HARUS** lowercase semua
4. ✅ **TIDAK BOLEH** ada trailing `/` di akhir
5. ✅ **TIDAK BOLEH** ada spasi
6. ✅ Gunakan `/` sebagai separator level
7. ✅ Gunakan `_` untuk multi-word: `m_purchase_order`

**Table Validasi:**

| Status | Example | Reason |
|--------|---------|--------|
| ✅ BENAR | `/setup/m_general` | Perfect! |
| ✅ BENAR | `/setup/master/m_general` | Perfect! Multi-level |
| ✅ BENAR | `/purchasing/master/m_supplier` | Perfect! |
| ✅ BENAR | `/inventory/m_stock` | Perfect! |
| ✅ BENAR | `/sales/transaction/m_purchase_order` | Perfect! Multi-word |
| ❌ SALAH | `/setup/general` | ❌ Tidak pakai prefix `m_` |
| ❌ SALAH | `/Setup/m_general` | ❌ Pakai huruf besar |
| ❌ SALAH | `/setup/m_general/` | ❌ Ada trailing slash |
| ❌ SALAH | `setup/m_general` | ❌ Tidak ada leading slash |
| ❌ SALAH | `/setup/m general` | ❌ Ada spasi |
| ❌ SALAH | `/setup/General` | ❌ Huruf besar |
| ❌ SALAH | `/setup/m-general` | ❌ Pakai dash, harusnya underscore |

### Step 2: Jalankan Script

Setelah menu terdaftar di database, jalankan script untuk generate files dan routes.

**⚠️ Pastikan Step 1 (Input Menu di Web) sudah dilakukan!**

## 🎯 Cara Penggunaan Script

### Pilih Versi Script

**🔵 PowerShell Version (`add_route.ps1`)**

Cocok untuk:
- ✅ Windows dengan PowerShell 7.0 atau lebih baru
- ✅ Sudah familiar dengan PowerShell scripting

**Check versi PowerShell Anda:**
```powershell
$PSVersionTable
# Lihat PSVersion: jika 7.x.x → OK
# Jika 5.1.x → Gunakan Node.js version
```

**🟢 Node.js Version (`add_route.cjs`) - RECOMMENDED**

Cocok untuk:
- ✅ **Windows dengan PowerShell 5.1 atau lebih lama** (default Windows 10/11)
- ✅ Cross-platform (Windows, Linux, macOS)
- ✅ Lebih mudah troubleshooting
- ✅ Tidak ada masalah string escaping

**Requirements:**
```bash
node --version
# Minimal: Node.js v16.0.0 atau lebih baru
```

**⚠️ PENTING:** Jika Anda mengalami error parsing atau syntax error dengan PowerShell, **gunakan Node.js version!**

### Format Dasar

**🔵 PowerShell Version:**
```powershell
# Format 1: Interactive mode - Script akan menanyakan API endpoint dan route path
.\add_route.ps1 module[/submodule]/name

# Format 2: Specify API endpoint saja - Script akan menanyakan route path
.\add_route.ps1 module[/submodule]/name api_endpoint

# Format 3: Full specification - Semua parameter langsung
.\add_route.ps1 module[/submodule]/name api_endpoint /route/path
```

**🟢 Node.js Version:**
```bash
# Format 1: Interactive mode - Script akan menanyakan API endpoint dan route path
node add_route.cjs module[/submodule]/name

# Format 2: Specify API endpoint saja - Script akan menanyakan route path
node add_route.cjs module[/submodule]/name api_endpoint

# Format 3: Full specification - Semua parameter langsung
node add_route.cjs module[/submodule]/name api_endpoint /route/path
```

**PENTING:** 
- Path parameter (`module[/submodule]/name`) adalah lokasi folder tempat files akan digenerate
- Route path adalah URL route yang **HARUS SAMA PERSIS** dengan path yang diinput di form menu web (dengan leading slash `/`)

### Input API Endpoint

Script akan menanyakan API endpoint yang akan digunakan. Format endpoint:

```
/dynamic/{nama_endpoint}
```

**Contoh:**
- Input: `m_general` → Endpoint: `/dynamic/m_general`
- Input: `m_supplier` → Endpoint: `/dynamic/m_supplier`
- Input: `m_stock` → Endpoint: `/dynamic/m_stock`

**⚠️ PENTING - Rules API Endpoint:**
- ✅ Endpoint akan otomatis diubah ke **lowercase**
- ✅ Jika tidak diisi, akan menggunakan nama module sebagai default
- ✅ Pastikan endpoint sesuai dengan yang ada di backend API
- ✅ Format: huruf kecil semua, gunakan underscore untuk separator
- ⚠️ Siapa tau nama file berbeda dengan nama endpoint API di backend

### Input Route Path

**⚠️ FITUR BARU!** Script akan menanyakan route path yang akan digunakan untuk routing aplikasi.

**SANGAT PENTING:** Route path yang diinput di script **HARUS SAMA PERSIS** dengan path yang diinput di Form Menu (SETUP > MENU).

**Cara Kerja:**
1. Script akan menampilkan **default suggestion** berdasarkan module path
2. Anda bisa **ENTER** untuk pakai default, atau **ketik manual** jika berbeda
3. Script akan menampilkan **WARNING** untuk memastikan path sesuai dengan database

**Contoh Interaksi:**

```powershell
.\add_route.ps1 setup/m_general

🛣️  Route Path Configuration
   ⚠️  Route path harus sama dengan yang Anda input di Form Menu!
   Path yang diinput di web: SETUP > MENU > Tambah Menu > Field 'Path'

   Format: /module[/submodule]/name
   Contoh: /setup/m_general, /purchasing/master/m_supplier

Masukkan route path [/setup/m_general]: ← ENTER untuk default
```

**Format Route Path:**
- ✅ **HARUS** diawali dengan `/` (leading slash)
- ✅ **HARUS** lowercase semua
- ✅ **TIDAK BOLEH** ada trailing `/` di akhir
- ✅ Gunakan `/` sebagai separator level
- ✅ Gunakan `_` untuk multi-word: `/sales/m_purchase_order`

**Kenapa Perlu Input Manual?**
- 📌 Kadang structure folder tidak sama dengan route path di database
- 📌 Mencegah typo atau kesalahan path
- 📌 Memberikan kontrol penuh atas route registration
- 📌 Memastikan konsistensi antara menu database dan router

**Table Validasi Route Path:**

| Status | Example Input | Result | Valid? |
|--------|---------------|--------|--------|
| ✅ | `/setup/m_general` | `/setup/m_general` | ✅ Perfect! |
| ✅ | `/Setup/m_general` | `/setup/m_general` | ✅ Auto-lowercase |
| ✅ | `setup/m_general` | `/setup/m_general` | ✅ Auto-add leading `/` |
| ✅ | `/setup/m_general/` | `/setup/m_general` | ✅ Auto-remove trailing `/` |
| ⚠️ | (kosong - ENTER) | `/setup/m_general` | ✅ Pakai default |
| ❌ | `/setup/m general` | - | ❌ Ada spasi (script error) |
| ❌ | `/setup/General` | `/setup/general` | ⚠️ Auto-lowercase tapi bisa salah!

### Contoh Penggunaan

#### 1. Module Setup - General (Single Level)

**Menu yang sudah diinput:**
- Path di web: `/setup/m_general`

**Command script (Interactive - RECOMMENDED):**

🔵 PowerShell:
```powershell
.\add_route.ps1 setup/m_general
```

🟢 Node.js:
```bash
node add_route.cjs setup/m_general
```

Script akan bertanya:
```
# 1. API Endpoint
Masukkan nama endpoint API [m_general]: m_general
# (Tekan Enter untuk pakai default)

# 2. Route Path
🛣️  Route Path Configuration
   ⚠️  Route path harus sama dengan yang Anda input di Form Menu!
Masukkan route path [/setup/m_general]: ← ENTER (pakai default)
```

**Command script (Direct - Semua parameter):**

🔵 PowerShell:
```powershell
.\add_route.ps1 setup/m_general m_general /setup/m_general
```

🟢 Node.js:
```bash
node add_route.cjs setup/m_general m_general /setup/m_general
```

**Hasil:**
- Folder: `src/views/setup/m_general/`
- Files:
  - `GeneralLanding.vue`
  - `GeneralForm.vue`
  - `service.ts` (dengan endpoint `/dynamic/m_general`)
- Routes:
  - `/setup/m_general` → GeneralLanding
  - `/setup/m_general/form/:id?` → GeneralForm
  - `/setup/m_general/view/:id` → GeneralForm (readOnly)
- API Endpoint: `/dynamic/m_general`

#### 2. Module Purchasing - Master Supplier (Multi Level)

**Menu yang sudah diinput:**
- Path di web: `/purchasing/master/m_supplier`

**Command script (Interactive):**

🔵 PowerShell:
```powershell
.\add_route.ps1 purchasing/master/m_supplier
```

🟢 Node.js:
```bash
node add_route.cjs purchasing/master/m_supplier
```

**Command script (Direct):**

🔵 PowerShell:
```powershell
.\add_route.ps1 purchasing/master/m_supplier m_supplier /purchasing/master/m_supplier
```

🟢 Node.js:
```bash
node add_route.cjs purchasing/master/m_supplier m_supplier /purchasing/master/m_supplier
```

**Hasil:**
- Folder: `src/views/purchasing/master/m_supplier/`
- Files:
  - `SupplierLanding.vue`
  - `SupplierForm.vue`
  - `service.ts` (dengan endpoint `/dynamic/m_supplier`)
- Routes:
  - `/purchasing/master/m_supplier` → SupplierLanding
  - `/purchasing/master/m_supplier/form/:id?` → SupplierForm
  - `/purchasing/master/m_supplier/view/:id` → SupplierForm (readOnly)
- API Endpoint: `/dynamic/m_supplier`

#### 3. Module Inventory - Stock (Custom Endpoint)

**Menu yang sudah diinput:**
- Path di web: `/inventory/m_stock`

**Command script (Custom API endpoint berbeda dari default):**

🔵 PowerShell:
```powershell
.\add_route.ps1 inventory/m_stock
```

🟢 Node.js:
```bash
node add_route.cjs inventory/m_stock
```

Script akan bertanya:
```
# 1. API Endpoint (ketik custom endpoint)
Masukkan nama endpoint API [m_stock]: inventory_stock

# 2. Route Path
Masukkan route path [/inventory/m_stock]: ← ENTER (pakai default)
```

**Hasil:**
- Folder: `src/views/inventory/m_stock/`
- Files:
  - `StockLanding.vue`
  - `StockForm.vue`
  - `service.ts` (dengan endpoint `/dynamic/inventory_stock`)
- Routes:
  - `/inventory/m_stock` → StockLanding
  - `/inventory/m_stock/form/:id?` → StockForm
  - `/inventory/m_stock/view/:id` → StockForm (readOnly)
- API Endpoint: `/dynamic/inventory_stock` ← **Beda dari nama module!**

#### 4. Module Sales - Transaction Order (Custom Route Path)

**Menu yang sudah diinput:**
- Path di web: `/sales/m_order` (berbeda dari folder structure!)

**Command script:**

🔵 PowerShell:
```powershell
.\add_route.ps1 sales/transaction/m_order
```

🟢 Node.js:
```bash
node add_route.cjs sales/transaction/m_order
```

Script akan bertanya:
```
# 1. API Endpoint
Masukkan nama endpoint API [m_order]: m_sales_order

# 2. Route Path (PENTING: Ketik manual sesuai database!)
Masukkan route path [/sales/transaction/m_order]: /sales/m_order
# ↑ OVERRIDE default karena path di database berbeda!
```

**Hasil:**
- Folder: `src/views/sales/transaction/m_order/`
- Files generated dengan route path `/sales/m_order`
- Routes:
  - `/sales/m_order` → OrderLanding ← **Path berbeda dari folder!**
  - `/sales/m_order/form/:id?` → OrderForm
  - `/sales/m_order/view/:id` → OrderForm (readOnly)
- API Endpoint: `/dynamic/m_sales_order`

**⚠️ Contoh ini menunjukkan kenapa input route path penting:**
- Folder structure: `sales/transaction/m_order/`
- Route path: `/sales/m_order` (lebih pendek!)
- Menu path di database: `/sales/m_order`

Jika tidak ada input manual, route akan jadi `/sales/transaction/m_order` (SALAH!)

## 📝 Naming Convention

### Module Name
- Prefix `m_` akan otomatis dihapus saat generate PascalCase
- Underscore `_` akan dikonversi ke PascalCase

**Contoh:**
- `m_general` → `General`
- `m_supplier` → `Supplier`
- `m_purchase_order` → `PurchaseOrder`
- `m_stock_opname` → `StockOpname`

### File Names
Script akan generate 3 file:

1. **{PascalName}Landing.vue** - Halaman list/table
2. **{PascalName}Form.vue** - Form add/edit/view
3. **service.ts** - API service functions

## 🔧 Template Source

Template diambil dari folder: `src/views/setup/m_general/`

File template:
- `GeneralLanding.vue`
- `GeneralForm.vue`
- `service.ts`

**⚠️ Important:** Template `m_general` sudah include:
- ✅ Auto-refresh sidebar setelah create/update/delete
- ✅ Composable `useSidebarRefresh` untuk trigger refresh otomatis
- ✅ Toast notifications yang informatif
- ✅ Best practices untuk CRUD operations

## ⚙️ Kustomisasi Setelah Generate

**Setelah script selesai, ada 3 file yang perlu dikustomisasi:**

### 1. Update `service.ts`

File ini berisi API service functions. Anda perlu update:

```typescript
// Ganti endpoint API sesuai module Anda
export async function getGeneralList(
  page: number = 1,
  paginate: number = 10,
  order_by: string = 'createdAt',
  order_type: 'ASC' | 'DESC' = 'DESC'
): Promise<GeneralListResponse> {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    paginate: paginate.toString(),
    order_by,
    order_type
  })

  // ⚠️ UPDATE ENDPOINT INI
  return await apiCall<GeneralListResponse>(`/api/v1/general?${queryParams}`)
}
```

**Yang perlu diupdate:**
- ✅ Function names (getGeneralList, createGeneral, etc)
- ✅ Interface/Type definitions
- ✅ API endpoints (`/api/v1/general`)
- ✅ Request/Response structure

### 2. Update `{Name}Landing.vue`

File ini adalah halaman list/table. Customize:

**Kolom Table:**
```typescript
const columns = [
  { key: 'id', label: 'ID', sortable: true },
  { key: 'name', label: 'Name', sortable: true },
  // ⚠️ TAMBAH/UBAH KOLOM SESUAI DATA ANDA
  { key: 'description', label: 'Description' },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'actions', label: 'Actions', sortable: false },
]
```

**Filter & Search:**
```typescript
// Tambah filter sesuai kebutuhan
const filterStatus = ref<'Aktif' | 'Nonaktif' | null>(null)
const filterCategory = ref<string | null>(null) // contoh filter tambahan
```

### 3. Update `{Name}Form.vue`

File ini adalah form add/edit/view. Customize:

**Form Fields:**
```typescript
let values = reactive({
  name: '',
  description: '',
  // ⚠️ TAMBAH/UBAH FIELD SESUAI KEBUTUHAN
  category: '',
  price: 0,
  stock: 0,
  is_active: true,
  seq: '0',
})
```

**Form Layout:**
```vue
<template>
  <div class="grid gap-6">
    <FieldX label="Nama" v-model="values.name" :readonly="isReadOnly" required />
    <FieldTextarea label="Deskripsi" v-model="values.description" :readonly="isReadOnly" />
    
    <!-- ⚠️ TAMBAH FIELD BARU DI SINI -->
    <FieldX label="Kategori" v-model="values.category" :readonly="isReadOnly" />
    <FieldNumber label="Harga" v-model="values.price" :readonly="isReadOnly" />
    
    <FieldStatus label="Status" v-model="values.is_active" :readonly="isReadOnly" />
  </div>
</template>
```

### Step 3: Test & Refresh

1. **Restart Development Server** (jika perlu)
   ```powershell
   # Stop: Ctrl+C
   # Start:
   npm run dev
   ```

2. **Refresh Sidebar**
   - Klik tombol "Refresh Menu" di sidebar
   - Menu baru akan muncul sesuai yang diinput di Step 1

3. **Test Route**
   - Klik menu baru di sidebar
   - Test form: Add, Edit, View
   - Test table: Search, Filter, Sort, Pagination

## 🔄 Complete Workflow Summary

```
1. Web App (Input Menu)
   ↓
   Login → SETUP > MENU → Tambah Menu
   Input: Name, Path (/setup/m_general), Modul, Icon, etc.
   Save → Refresh Sidebar
   
2. Run Script (Generate Files)
   ↓
   🔵 PowerShell:  .\add_route.ps1 setup/m_general
   🟢 Node.js:     node add_route.cjs setup/m_general
   
   Interactive Prompts:
   - API Endpoint: m_general [ENTER untuk default]
   - Route Path: /setup/m_general [ENTER untuk default]
   
   ⚠️ PENTING: Route path HARUS sama dengan path di Step 1!
   
3. Customize (Update Files)
   ↓
   - service.ts → API endpoints & interfaces
   - {Name}Landing.vue → Table columns & filters
   - {Name}Form.vue → Form fields & validation
   
4. Test (Browser)
   ↓
   Refresh → Click menu → Test CRUD
```

## 🎯 Best Practices

### 1. Route Path Consistency

**ATURAN EMAS:** Route path di script **HARUS SAMA PERSIS** dengan path di form menu!

| Step | Location | Example | Status |
|------|----------|---------|--------|
| 1 | Web Form (SETUP > MENU) | `/setup/m_general` | Input di database |
| 2 | Script Prompt | `/setup/m_general` | ✅ SAMA - Perfect! |
| ❌ | Script Prompt (SALAH) | `/setup/General` | ❌ BEDA - Error! |

### 2. Interactive vs Direct Mode

**Kapan pakai Interactive Mode:**
- ✅ First time generate module baru
- ✅ Tidak yakin API endpoint atau route path
- ✅ Ingin review configuration sebelum generate

**Kapan pakai Direct Mode:**
- ✅ Sudah tahu semua parameter
- ✅ Batch generation (multiple modules)
- ✅ Automation/scripting

**Contoh:**

🔵 PowerShell:
```powershell
# Interactive - RECOMMENDED untuk manual work
.\add_route.ps1 setup/m_general

# Direct - Good untuk automation
.\add_route.ps1 setup/m_general m_general /setup/m_general
```

🟢 Node.js:
```bash
# Interactive - RECOMMENDED untuk manual work
node add_route.cjs setup/m_general

# Direct - Good untuk automation
node add_route.cjs setup/m_general m_general /setup/m_general
```

### 3. Validation Checklist

Setelah script selesai, cek:

- [ ] ✅ Files generated di folder yang benar
- [ ] ✅ Routes terdaftar di `router/index.ts` dengan comment block
- [ ] ✅ Route path sesuai dengan menu di database
- [ ] ✅ API endpoint lowercase dan benar
- [ ] ✅ PascalCase naming correct (GeneralLanding, GeneralForm)
- [ ] ✅ No TypeScript errors

**Command untuk cek:**
```powershell
# List generated files
ls src/views/setup/m_general

# Check router registration
code src/router/index.ts

# Test di browser
npm run dev
# Buka http://localhost:5173 → klik menu baru
```

## ⚠️ Catatan Penting

1. **Overwrite Warning**
   - Jika folder sudah ada, script akan konfirmasi
   - Jika route sudah ada, script akan konfirmasi

2. **Prerequisites**
   - Template folder harus ada: `src/views/setup/m_general/`
   - Router file harus ada: `src/router/index.ts`

3. **Format Module Path**
   - Minimal 2 parts: `module/name`
   - Max depth: unlimited
   - Separator: slash `/`

4. **⚠️ Route Path vs Module Path**
   - **Module Path** (parameter 1): Lokasi folder tempat files digenerate
     - Contoh: `setup/m_general` → `src/views/setup/m_general/`
   - **Route Path** (parameter 3): URL route di aplikasi dan database
     - Contoh: `/setup/m_general` → URL: `http://localhost:5173/setup/m_general`
   - **Biasanya SAMA**, tapi bisa BERBEDA! Oleh karena itu perlu input manual.

5. **Auto-Normalization**
   - API endpoint → otomatis lowercase
   - Route path → otomatis lowercase
   - Route path → otomatis tambah leading `/` jika tidak ada
   - Route path → otomatis hapus trailing `/` jika ada

6. **Auto-Refresh Feature**
   - ✅ Module yang digenerate sudah include auto-refresh sidebar
   - ✅ Sidebar otomatis refresh setelah create/update/delete
   - ✅ Tidak perlu klik tombol refresh manual lagi!

## 🐛 Troubleshooting

### PowerShell: Parse Error / Syntax Error / String Escaping Error

**Gejala:**
```
At G:\my project\mitravisualgroup\add_route.ps1:160 char:93
+ ... uter\.push\('/setup/m_general/form/", "router.push('$RoutePath/form/"
+                                                         ~~~~~~~~~~~~~~~~~
Unexpected token '$RoutePath/form/"
```

**Penyebab:** PowerShell 5.1 (default Windows) memiliki masalah dengan string escaping yang kompleks.

**Solusi:** **Gunakan Node.js version!**

```bash
# Check PowerShell version
$PSVersionTable
# Jika PSVersion = 5.1.x → Gunakan Node.js

# Gunakan Node.js version
node add_route.cjs setup/m_general
```

**Alternatif Solusi:**
1. **Upgrade PowerShell ke 7.x** (recommended untuk long-term)
   ```powershell
   winget install Microsoft.PowerShell
   ```

2. **Atau gunakan Node.js version** (quick fix, cross-platform)

### Error: Template folder tidak ditemukan

**Solusi:** Pastikan folder `src/views/setup/m_general/` exists dengan file template (GeneralLanding.vue, GeneralForm.vue, service.ts).

### Error: Could not find insertion point in router

**Solusi:** Pastikan `router/index.ts` memiliki struktur yang benar dengan children array.

### Route tidak muncul di aplikasi

**Solusi:** 
1. Cek apakah route sudah terdaftar di `router/index.ts`
2. Restart development server
3. Clear browser cache

### Menu tidak muncul di sidebar setelah generate

**Solusi:**
1. **Pastikan menu sudah diinput di database** (Step 1 - Web App)
2. Klik tombol **"Refresh Menu"** di sidebar (icon refresh)
3. Check console browser untuk error
4. Verify path di database = path di router

**Debug command:**
```powershell
# Check if route exists
code src/router/index.ts
# Search for your route path

# Check API response
# Buka browser console → Network tab → Filter: m_menu
# Response harus include menu baru
```

### Route path tidak sesuai dengan menu database

**Gejala:** Menu ada di sidebar, tapi klik menu → 404 Not Found

**Penyebab:** Route path di script berbeda dengan path di database

**Solusi:**
1. Cek path di database:
   - Login → SETUP > MENU
   - Edit menu yang bermasalah
   - Lihat field "Path" → contoh: `/setup/m_general`

2. Cek route di router:
   - Buka `src/router/index.ts`
   - Search route name
   - Bandingkan path

3. Jika BEDA → Generate ulang:
   
   🔵 PowerShell:
   ```powershell
   # Hapus folder lama
   rm -r src/views/setup/m_general
   
   # Generate ulang dengan route path yang benar
   .\add_route.ps1 setup/m_general m_general /setup/m_general
   ```
   
   🟢 Node.js:
   ```bash
   # Hapus folder lama
   rm -r src/views/setup/m_general
   
   # Generate ulang dengan route path yang benar
   node add_route.cjs setup/m_general m_general /setup/m_general
   ```

### API Endpoint masih uppercase

**Gejala:** Endpoint jadi `/dynamic/M_General` atau `/dynamic/M_GENERAL`

**Solusi:** Script versi baru sudah auto-lowercase. Update script:
```powershell
git pull origin main
```

Atau edit manual `service.ts` → ubah semua endpoint ke lowercase.

## 📚 Structure Example

```
src/
  views/
    setup/                    # Module: setup
      menu/                   # Template source
      m_general/              # Generated: setup/m_general
        GeneralLanding.vue
        GeneralForm.vue
        service.ts
      master/                 # Sub-module: master
        m_general/            # Generated: setup/master/m_general
          GeneralLanding.vue
          GeneralForm.vue
          service.ts
    purchasing/               # Module: purchasing
      master/                 # Sub-module: master
        m_supplier/           # Generated: purchasing/master/m_supplier
          SupplierLanding.vue
          SupplierForm.vue
          service.ts
```

## 🎨 Tips & Best Practices

1. **Naming Convention**
   - Gunakan prefix `m_` untuk module
   - Gunakan underscore untuk multi-word: `m_purchase_order`
   - Lowercase untuk module name

2. **Module Organization**
   - Group related modules dalam sub-folder
   - Contoh: `setup/master/`, `purchasing/transaction/`

3. **After Generation**
   - Selalu review generated files
   - Update API endpoints immediately
   - Test routes sebelum continue development

4. **Route Path Validation**
   - ✅ Always check path di Form Menu sebelum run script
   - ✅ Use interactive mode untuk first-time generation
   - ✅ Verify route registration di `router/index.ts`
   - ✅ Test navigation: list → form → view

5. **Development Workflow**
   ```
   Input Menu (Web) → Generate Files (Script) → Customize (Code) → Test (Browser)
   ↑                                                                            ↓
   └────────────────────────── Fix & Iterate ──────────────────────────────────┘
   ```

6. **Git Best Practice**
   ```powershell
   # Before generate
   git status  # Make sure working tree is clean
   
   # After generate
   git add .
   git commit -m "feat: add m_general module"
   
   # If mistake
   git reset --hard HEAD  # Revert changes
   .\add_route.ps1 setup/m_general  # Generate lagi
   ```

## 🤝 Contributing

Jika ada bug atau saran improvement, silakan hubungi team developer.

---

**Last Updated:** November 29, 2025  
**Version:** 2.2.0  
**Author:** HG Development Team

**Changelog:**
- **v2.2.0** (Nov 29, 2025): 
  - 🆕 Added auto-generation of Notification files when approval workflow is enabled
  - 🆕 Creates `Notifikasi{Module}Detail.vue` for approval page
  - 🆕 Creates `service.{module}.ts` for notification service
  - 🆕 Auto-registers notification route in `router/index.ts`
  - Added templates: `NotifikasiDetail.txt`, `NotifikasiService.txt`
- **v2.1.0** (Nov 9, 2025): 
  - Added Node.js version (`add_route.cjs`) for PowerShell 5.1 compatibility
  - Fixed string escaping issues in PowerShell version
  - Updated documentation with both PowerShell and Node.js examples
  - Added troubleshooting for PowerShell version conflicts
- **v2.0.0** (Nov 9, 2025): Added interactive route path input with validation
- **v1.0.0** (Nov 2025): Initial release with basic module generation
