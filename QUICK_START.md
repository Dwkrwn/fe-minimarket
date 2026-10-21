# 🚀 Quick Start - Add Route Script

## ⚠️ PENTING: Workflow 2 Langkah

### Step 1: Input Menu di Web (WAJIB!)

1. **Login** → **SETUP** → **MENU**
2. **Klik "Tambah Menu Baru"**
3. **Isi form:**

| Field | Contoh Value | Keterangan |
|-------|--------------|------------|
| Nama Menu | `Supplier` | Nama di sidebar |
| Modul | `PURCHASING` | Kategori utama |
| Sub Modul | `MASTER` | Opsional |
| **Path** | `/purchasing/master/m_supplier` | ⚠️ **PENTING!** |
| Icon | `Truck` | Icon Lucide |
| Seq | `10` | Urutan |
| Status | `Aktif` | Status |

4. **Simpan** → **Refresh Sidebar**

### Step 2: Jalankan Script PowerShell

```powershell
# Format: sama dengan path di menu (tanpa leading /)
.\add_route.ps1 module/path/name [api_endpoint]
```

**Script akan menanyakan API endpoint:**
- Default: nama module (otomatis lowercase)
- Contoh: `m_general`, `m_supplier`, `inventory_stock`
- Endpoint akan menjadi: `/dynamic/{api_endpoint}`

## 📋 Contoh Lengkap

### Example 1: Setup > General

**Step 1 - Input di Web:**
- Path: `/setup/m_general`

**Step 2 - Jalankan Script:**
```powershell
.\add_route.ps1 setup/m_general
```

### Example 2: Purchasing > Master > Supplier

**Step 1 - Input di Web:**
- Path: `/purchasing/master/m_supplier`

**Step 2 - Jalankan Script:**
```powershell
.\add_route.ps1 purchasing/master/m_supplier
```

### Example 3: Inventory > Stock

**Step 1 - Input di Web:**
- Path: `/inventory/m_stock`

**Step 2 - Jalankan Script:**
```powershell
.\add_route.ps1 inventory/m_stock
```

## Simple Usage (Copy-Paste & Run)

**⚠️ Pastikan menu sudah diinput di web terlebih dahulu!**

```powershell
# Example 1: Create Setup > General
# Menu path di web: /setup/m_general
.\add_route.ps1 setup/m_general
# Ketika ditanya endpoint, ketik: m_general (atau tekan Enter untuk default)

# Example 2: Create Purchasing > Master > Supplier
# Menu path di web: /purchasing/master/m_supplier
.\add_route.ps1 purchasing/master/m_supplier m_supplier

# Example 3: Create Inventory > Stock (endpoint berbeda)
# Menu path di web: /inventory/m_stock
.\add_route.ps1 inventory/m_stock inventory_stock

# Example 4: Create Sales > Transaction > Order
# Menu path di web: /sales/transaction/m_order
.\add_route.ps1 sales/transaction/m_order m_sales_order
```

## ✅ Path Format Rules

| ✅ BENAR | ❌ SALAH | Alasan |
|---------|---------|--------|
| `/setup/m_general` | `/setup/general` | Harus pakai prefix `m_` |
| `/purchasing/master/m_supplier` | `/Purchasing/Master/m_supplier` | Harus lowercase |
| `/inventory/m_stock` | `/inventory/m_stock/` | Jangan ada trailing `/` |
| `/sales/m_order` | `sales/m_order` | Harus ada leading `/` |

## What Gets Created?

### Command:
```powershell
.\add_route.ps1 setup/m_general
```

### Creates:
```
src/views/setup/m_general/
├── GeneralLanding.vue    (List/Table page)
├── GeneralForm.vue       (Add/Edit/View form)
└── service.ts            (API functions)
```

### Routes registered:
```
/setup/m_general              → List page
/setup/m_general/form/:id?    → Add/Edit form
/setup/m_general/view/:id     → View detail (read-only)
```

## Quick Reference

| Command Format | Example | Result Folder | Result Route |
|---------------|---------|---------------|--------------|
| `module/name` | `setup/m_general` | `setup/m_general/` | `/setup/m_general` |
| `module/sub/name` | `setup/master/m_general` | `setup/master/m_general/` | `/setup/master/m_general` |
| `module/sub/name` | `purchasing/master/m_supplier` | `purchasing/master/m_supplier/` | `/purchasing/master/m_supplier` |

## After Generation - Next Steps

1. **Update `service.ts`** → Change API endpoints
2. **Update `{Name}Landing.vue`** → Customize table columns  
3. **Update `{Name}Form.vue`** → Customize form fields
4. **Refresh Sidebar** → Click refresh button to see new menu
5. **Test in Browser** → Click menu and test CRUD operations

## 🔄 Complete Workflow

```
┌─────────────────────────────────────────┐
│  STEP 1: Web App (Input Menu)          │
├─────────────────────────────────────────┤
│  1. Login to app                        │
│  2. Go to SETUP > MENU                  │
│  3. Click "Tambah Menu Baru"            │
│  4. Fill form:                          │
│     - Name: Supplier                    │
│     - Modul: PURCHASING                 │
│     - Sub Modul: MASTER                 │
│     - Path: /purchasing/master/m_supplier│
│     - Icon: Truck                       │
│  5. Save                                │
│  6. Refresh Sidebar                     │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  STEP 2: PowerShell (Generate Files)    │
├─────────────────────────────────────────┤
│  .\add_route.ps1 purchasing/master/m_supplier│
│                                         │
│  Creates:                               │
│  - SupplierLanding.vue                  │
│  - SupplierForm.vue                     │
│  - service.ts                           │
│  - Auto register routes                 │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  STEP 3: Customize (Update Files)      │
├─────────────────────────────────────────┤
│  1. service.ts → API endpoints          │
│  2. SupplierLanding.vue → Table         │
│  3. SupplierForm.vue → Form fields      │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│  STEP 4: Test (Browser)                │
├─────────────────────────────────────────┤
│  1. Refresh browser                     │
│  2. Click menu                          │
│  3. Test CRUD operations                │
└─────────────────────────────────────────┘
```

## Need Help?

Read full documentation: `ADD_ROUTE_README.md`
