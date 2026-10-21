# Voice Menu Search - User Guide

## 🎙️ Overview

Fitur Voice Menu Search memungkinkan user untuk **mencari dan membuka menu menggunakan suara**, tanpa perlu mengetik atau scroll manual.

---

## 🚀 Cara Menggunakan

### 1. Buka Sidebar
Pastikan sidebar terlihat (tidak collapsed).

### 2. Klik Icon Microphone
Di samping search box, ada icon **🎤 Microphone**. Klik icon tersebut.

### 3. Izinkan Akses Mikrofon
Browser akan meminta izin untuk mengakses mikrofon. Klik **Allow/Izinkan**.

### 4. Bicara Nama Menu
Setelah icon berubah merah dan menampilkan "Mendengarkan...", sebutkan nama menu yang ingin dibuka.

**Contoh:**
- "Sales Order"
- "Customer"
- "Items"
- "Purchase Order"
- "Stock Opname"

### 5. Otomatis Navigasi
Sistem akan otomatis:
- ✅ Mendeteksi menu yang cocok
- ✅ Menampilkan notifikasi
- ✅ Navigate ke halaman menu tersebut

---

## 📋 Contoh Penggunaan

### Example 1: Buka Menu Sales Order
1. Klik icon 🎤
2. Bicara: **"Sales Order"**
3. Sistem navigate ke `/sales/t_sales_order`

### Example 2: Buka Menu Master Items
1. Klik icon 🎤
2. Bicara: **"Items"** atau **"Master Barang"**
3. Sistem navigate ke `/inventory/m_items`

### Example 3: Buka Menu Customer
1. Klik icon 🎤
2. Bicara: **"Customer"** atau **"Pelanggan"**
3. Sistem navigate ke `/sales/m_customer`

---

## 🎯 Tips untuk Hasil Terbaik

### 1. Bicara dengan Jelas
- Artikulasi yang baik
- Volume normal (jangan terlalu pelan/keras)
- Hindari background noise

### 2. Sebutkan Nama Menu yang Tepat
- Gunakan nama menu yang sesuai dengan yang ada di sidebar
- Bisa sebutkan modul (contoh: "Sales") atau submenu (contoh: "Sales Order")

### 3. Jika Gagal:
- Coba lagi dengan pronounciation yang berbeda
- Gunakan alternatif nama menu (contoh: "Barang" daripada "Items")
- Atau fallback ke manual search dengan keyboard

---

## 🔧 Technical Details

### Browser Support
Voice Menu Search menggunakan **Web Speech API** yang didukung oleh:
- ✅ Chrome/Edge (recommended)
- ✅ Safari (iOS 14.5+)
- ⚠️ Firefox (limited support)

### Bahasa
- **Primary:** Bahasa Indonesia (id-ID)
- Voice recognition di-optimize untuk accent Indonesia

### Matching Algorithm
Sistem akan match voice input dengan:
1. **Nama Menu** (contoh: "Sales Order")
2. **Modul** (contoh: "SALES")
3. **Sub Modul** (contoh: "Transaksi")

Match menggunakan **substring matching**, jadi tidak perlu perfect match.

---

## ⚠️ Troubleshooting

### Problem: "Voice Search tidak didukung"
**Solution:** 
- Gunakan browser Chrome/Edge versi terbaru
- Update browser ke versi latest

### Problem: Mikrofon tidak terdeteksi
**Solution:**
- Check browser permission (Settings → Privacy → Microphone)
- Pastikan mikrofon device terhubung dan aktif
- Restart browser

### Problem: Menu tidak ditemukan
**Solution:**
- Coba sebutkan dengan nama yang berbeda
- Pastikan menu memang ada di sidebar (user punya akses)
- Gunakan manual search sebagai fallback

### Problem: Akurasi rendah
**Solution:**
- Bicara lebih pelan dan jelas
- Kurangi background noise
- Gunakan headset dengan mic yang baik
- Coba setting mikrofon sensitivity di OS

---

## 🎨 UI States

### 1. Normal State
- Icon: 🎤 (Grey)
- Tooltip: "Voice Menu Search"

### 2. Listening State
- Icon: 🔴 (Red, pulsing)
- Text: "Mendengarkan..."
- Animasi: Pulse effect dengan 3 dots

### 3. Success State
- Toast notification: "Membuka menu: [Nama Menu]"
- Auto-navigate dalam 0.5 detik

### 4. Error State
- Toast notification: "Menu tidak ditemukan"
- Description: voice input yang terdeteksi

---

## 🔐 Privacy & Security

- ✅ Voice input **tidak disimpan** di server
- ✅ Voice recognition proses di **browser** (Web Speech API native)
- ✅ Tidak ada recording atau tracking
- ✅ Hanya diproses untuk menu matching saja

---

## 📱 Mobile Support

Voice Menu Search juga berfungsi di **mobile browser**, dengan notes:
- Pastikan permission mikrofon sudah granted
- Hasil lebih baik di environment yang tenang
- iOS Safari membutuhkan user interaction first (tap mic icon)

---

## 🚀 Future Enhancements

Potential improvements:
1. **Multi-language support** (English, etc.)
2. **Voice commands** (contoh: "tutup", "kembali", "refresh")
3. **Voice shortcuts** (contoh: "dashboard", "notifikasi")
4. **Fuzzy matching** untuk typo/salah ucap
5. **History** voice searches

---

**Created:** March 2, 2026  
**Version:** 1.0  
**Component:** `src/components/VoiceMenuSearch.vue`
