# 📌 Chatbot Path Reference - Frontend Bosbaut

**Updated**: 2 Maret 2026  
**Purpose**: Path mapping yang BENAR untuk backend chatbot (app.py)

---

## 🎯 Path yang SERING SALAH

| ❌ Path SALAH (Backend)        | ✅ Path BENAR (Frontend)                          | Menu Name                  |
|--------------------------------|---------------------------------------------------|----------------------------|
| `/purchase-order`              | `/purchasing/transaksi/t_purchase_order`         | Purchase Order (PO)        |
| `/master/items`                | `/purchasing/master/m_items`                     | Master Items               |
| `/purchase-request`            | `/purchasing/transaksi/t_purchase_request`       | Purchase Request (PR)      |
| `/master/customers`            | `/marketing/master/m_customer`                   | Master Customer            |
| `/master/suppliers`            | `/purchasing/master/m_supplier`                  | Master Supplier            |
| `/invoice`                     | `/purchasing/transaksi/t_purchase_invoice`       | Purchase Invoice           |
| `/lpb`                         | `/purchasing/transaksi/t_penerimaan`             | Penerimaan (LPB)           |
| `/stock-inventory`             | `/inventory/t_stock_opname`                      | Stock Opname               |

---

## 📂 COMPLETE PATH LIST (Dari crud-routes.ts)

### SETUP Module
```
/setup/m_general              → General
/setup/user_default           → User Default
/setup/m_unit_bisnis          → Unit Bisnis
/setup/m_prefix               → Prefix
/setup/m_role                 → Role
/setup/m_respo                → Respo
/setup/m_kary                 → Karyawan
/setup/m_approval             → Approval
/setup/m_currency             → Currency
/setup/m_item_group           → Item Group
/setup/m_kendaraan            → Kendaraan
```

### PURCHASING Module
#### Master
```
/purchasing/master/m_supplier → Supplier
/purchasing/master/m_items    → Items (Barang)
```

#### Transaksi
```
/purchasing/transaksi/t_purchase_request        → Purchase Request (PR)
/purchasing/transaksi/t_purchase_request_close  → Purchase Request Close
/purchasing/transaksi/t_purchase_order          → Purchase Order (PO)
/purchasing/transaksi/t_purchase_order_close    → Purchase Order Close
/purchasing/transaksi/t_purchase_invoice        → Purchase Invoice (PI)
/purchasing/transaksi/t_purchase_return         → Purchase Return
/purchasing/transaksi/t_penerimaan              → Penerimaan (LPB)
/purchasing/transaksi/t_rfq                     → Request for Quotation (RFQ)
/purchasing/transaksi/t_supplier_quotation      → Supplier Quotation
/purchasing/transaksi/t_import_cost             → Biaya Kirim
```

### INVENTORY Module
```
/inventory/m_items              → Old Items (alias)
/inventory/t_stock_opname       → Stock Opname
/inventory/t_stock_adj          → Stock Adjustment
/inventory/m_rak                → Rak
/inventory/m_gudang             → Gudang
/inventory/t_transfer_gudang    → Transfer Gudang
/inventory/t_sj_gudang          → Surat Jalan Gudang
/inventory/t_penerimaan_gudang  → Penerimaan Gudang
```

### MARKETING Module
#### Master
```
/marketing/master/m_customer    → Customer (Pelanggan)
/marketing/master/m_prospek     → Prospek
```

#### Transaksi
```
/marketing/transaksi/t_sales_quotation → Sales Quotation
```

### ACCOUNTING Module
```
/accounting/master/m_coa → Chart of Account (COA)
```

---

## 🔧 Cara Update Backend Chatbot (app.py)

### File: `app.py` - Function `handle_smart_navigation()`

Update semua path di sini:

```python
def handle_smart_navigation(user_input):
    text = user_input.lower()

    # --- PURCHASE ORDER ---
    if re.search(r'(?:po|purchase order|pembelian)', text):
        return {
            "type": "navigation",
            "response": "Mengarahkan ke menu Purchase Order...",
            "nav_path": "/purchasing/transaksi/t_purchase_order",  # ✅ BENAR
            "nav_query": {}
        }

    # --- MASTER ITEMS ---
    if re.search(r'(?:item|barang|produk)', text):
        return {
            "type": "navigation",
            "response": "Mengarahkan ke Master Items...",
            "nav_path": "/purchasing/master/m_items",  # ✅ BENAR
            "nav_query": {}
        }

    # --- MASTER CUSTOMER ---
    if re.search(r'(?:customer|pelanggan|konsumen)', text):
        return {
            "type": "navigation",
            "response": "Mengarahkan ke Master Customer...",
            "nav_path": "/marketing/master/m_customer",  # ✅ BENAR
            "nav_query": {}
        }

    # --- MASTER SUPPLIER ---
    if re.search(r'(?:supplier|pemasok|vendor)', text):
        return {
            "type": "navigation",
            "response": "Mengarahkan ke Master Supplier...",
            "nav_path": "/purchasing/master/m_supplier",  # ✅ BENAR
            "nav_query": {}
        }

    # dst...
    return None
```

---

## 🎯 Testing Path

Untuk test apakah path benar, coba buka di browser:
```
http://localhost:5173/purchasing/transaksi/t_purchase_order
```

Kalau muncul halaman PO → path BENAR ✅  
Kalau 404 → path SALAH ❌

---

## 📝 Notes

1. **Semua path dimulai dengan `/`** (forward slash)
2. **Tidak ada trailing slash** di akhir path
3. **Case-sensitive** (pakai lowercase semua)
4. **Prefix `t_`** → Transaksi
5. **Prefix `m_`** → Master
6. **Format**: `/{modul}/{kategori}/{nama_menu}`
   - Contoh: `/purchasing/transaksi/t_purchase_order`
   - Modul: purchasing
   - Kategori: transaksi
   - Nama: t_purchase_order

---

**Dokumentasi ini sync dengan**: `src/router/crud-routes.ts`  
**Untuk update**: Cek file `crud-routes.ts` untuk path terbaru
