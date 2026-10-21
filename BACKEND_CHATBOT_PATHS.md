# CHATBOT BACKEND - Path Reference untuk Mas Zefa

## ❗ Path yang BENAR untuk Navigation

### Master Items
```python
# ✅ BENAR - Pilih salah satu:
"nav_path": "/inventory/m_items"
"nav_path": "/purchasing/master/m_items"

# ❌ SALAH - Jangan pakai ini:
"nav_path": "/master/items"  # 404 Error!
"nav_path": "/items"         # 404 Error!
```

### Contoh Response yang Benar

#### 1. Search Item (Finish Good, Segel SS, dll)
```json
{
  "type": "navigation",
  "response": "Tentu! Saya akan arahkan Anda ke menu Master Barang dengan kata kunci 'FINISH GOOD'.",
  "nav_path": "/inventory/m_items",
  "nav_query": {
    "search": "FINISH GOOD"
  }
}
```

#### 2. Search Customer
```json
{
  "type": "navigation",
  "response": "Membuka halaman Customer: PT Jaya",
  "nav_path": "/sales/m_customer",
  "nav_query": {
    "search": "PT Jaya"
  }
}
```

#### 3. Search Supplier
```json
{
  "type": "navigation",
  "response": "Mencari supplier: CV Makmur",
  "nav_path": "/purchasing/m_supplier",
  "nav_query": {
    "search": "CV Makmur"
  }
}
```

---

## 📋 Daftar Lengkap Path yang Valid

| Menu | Path | Contoh Keyword |
|------|------|----------------|
| **Master Items** | `/inventory/m_items` | finish good, klem seling ss, baut m10 |
| **Customer** | `/sales/m_customer` | PT Jaya, CV Mandiri |
| **Supplier** | `/purchasing/m_supplier` | PT Sejahtera |
| **Sales Order** | `/sales/t_sales_order` | SO-001 |
| **Purchase Order** | `/purchasing/transaksi/t_purchase_order` | PO-001 |
| **Stock Opname** | `/inventory/t_stock_opname` | |
| **Stock Adjustment** | `/inventory/t_stock_adj` | |

---

## 🔍 Cara Detect Keywords

### Pattern untuk Items
```python
keywords_item = [
    "tampilkan item", "buka item", "cari item", "lihat item",
    "finish good", "klem", "baut", "mur", "segel", 
    "master barang", "data item"
]

if any(keyword in user_query.lower() for keyword in keywords_item):
    # Extract keyword setelah kata kunci (misal: "finish good")
    search_term = extract_search_term(user_query)
    
    return {
        "type": "navigation",
        "response": f"Membuka Master Barang: {search_term}",
        "nav_path": "/inventory/m_items",
        "nav_query": {"search": search_term}
    }
```

### Pattern untuk Customer
```python
keywords_customer = [
    "customer", "pelanggan", "klien", "buyer"
]
```

### Pattern untuk Supplier
```python
keywords_supplier = [
    "supplier", "vendor", "pemasok"
]
```

---

## ⚠️ Testing Checklist

Sebelum deploy, test ini:

1. ✅ User ketik: "tampilkan item finish good"
   - Response path: `/inventory/m_items?search=finish+good`
   
2. ✅ User ketik: "cari klem seling ss 304"
   - Response path: `/inventory/m_items?search=klem+seling+ss+304`
   
3. ✅ User ketik: "buka customer PT Jaya"
   - Response path: `/sales/m_customer?search=PT+Jaya`

---

## 🐛 Debugging

Jika 404 Error:
1. Cek `nav_path` apakah PERSIS sama dengan yang di daftar
2. Case-sensitive! `/Inventory/M_Items` ≠ `/inventory/m_items`
3. Jangan pakai path `/master/items` (tidak terdaftar!)

---

**Created for:** Backend Chatbot Team  
**Last Update:** March 2, 2026
