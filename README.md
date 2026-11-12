# 🛒 Frontend Sistem Manajemen Minimarket (Mini-Market)

[![Vue 3](https://img.shields.io/badge/Vue-3.5.x-4FC08D?style=for-the-badge&logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-4.x-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Pinia](https://img.shields.io/badge/Pinia-3.x-F7D336?style=for-the-badge&logo=vue.js&logoColor=white)](https://pinia.vuejs.org/)

Aplikasi web front-end modern untuk **Sistem Informasi & Manajemen Operasional Minimarket**. Dibangun menggunakan arsitektur modular berbasis **Vue 3 (Composition API)**, **TypeScript**, **Vite**, dan **Tailwind CSS**, sistem ini dirancang untuk memfasilitasi operasional retail minimarket secara efisien, akurat, dan terintegrasi secara real-time dengan backend API.

---

## 📋 Daftar Isi

- [Tentang Aplikasi](#-tentang-aplikasi)
- [Fitur Utama](#-fitur-utama)
  - [1. Dashboard & Analitik](#1-dashboard--analitik)
  - [2. Modul Inventory (Manajemen Stok)](#2-modul-inventory-manajemen-stok)
  - [3. Modul Purchasing (Pengadaan & Pembelian)](#3-modul-purchasing-pengadaan--pembelian)
  - [4. Modul Setup & Kontrol Akses (RBAC)](#4-modul-setup--kontrol-akses-rbac)
  - [5. Alur Persetujuan & Notifikasi](#5-alur-persetujuan--notifikasi)
  - [6. Keamanan & Keandalan UX](#6-keamanan--keandalan-ux)
- [Teknologi yang Digunakan](#-teknologi-yang-digunakan)
- [Struktur Direktori](#-struktur-direktori)
- [Prasyarat Sistem](#-prasyarat-sistem)
- [Panduan Instalasi & Konfigurasi](#-panduan-instalasi--konfigurasi)
- [Perintah yang Tersedia (NPM/PNPM Scripts)](#-perintah-yang-tersedia-npmpnpm-scripts)
- [Integrasi Backend](#-integrasi-backend)
- [Lisensi](#-lisensi)

---

## 🏬 Tentang Aplikasi

Aplikasi Frontend Minimarket ini menangani siklus operasional bisnis ritel secara menyeluruh, mulai dari:
1. **Pengelolaan Barang Dagangan**: Barcode/SKU, penetapan margin keuntungan, multi-satuan (UOM), dan zonasi penataan barang (rak toko vs. gudang penyimpanan).
2. **Pengadaan Barang (Procurement)**: Rekomendasi otomatis berdasarkan Reorder Point (ROP), penerbitan Purchase Order (PO), penerimaan barang masuk, pencocokan tagihan (3-way matching), hingga penanganan retur supplier.
3. **Pengendalian Stok Real-Time**: Mutasi barang dari gudang ke rak display, penanganan barang rusak/kadaluwarsa, kartu stok kronologis, serta sesi stock opname dengan lembar hitung fisik dan penyesuaian stok (adjustment).
4. **Alur Validasi & Persetujuan (Approval Workflow)**: Memastikan transaksi pengadaan dan penyesuaian persediaan memiliki audit trail yang jelas dan terlindungi dari manipulasi data.

---

## ✨ Fitur Utama

### 1. Dashboard & Analitik
- **Widget KPI Real-time**: Memantau metrik utama minimarket seperti total pesanan pembelian (PO), barang dengan stok menipis (di bawah ROP), total nilai persediaan, dan volume mutasi barang.
- **Visualisasi Data Interaktif**: Grafik statistik belanja, tren persediaan, dan performa supplier dengan integrasi **Chart.js**.
- **Konfigurasi Dashboard per Role**: Tampilan widget dan grafik yang dapat disesuaikan untuk masing-masing hak akses pengguna (Owner/Manager, Admin Purchasing, Staf Gudang, dll.).

### 2. Modul Inventory (Manajemen Stok)
- **Master Barang Minimarket**: Pengelolaan katalog produk lengkap dengan kode barcode, SKU, nama barang, harga beli terakhir, harga jual eceran, estimasi margin, dan gambar produk.
- **Kategori & Rak (Zonasi Display & Gudang)**: Manajemen kategori barang serta pemetaan posisi rak display di area penjualan dan lorong penyimpanan di gudang.
- **Satuan & Multi-UOM**: Mendukung multi satuan (contoh: Pcs, Dus, Karton, Lusin, Pack) dengan faktor konversi otomatis saat transaksi atau penerimaan.
- **Batas Pemesanan (Reorder Point / ROP)**: Parameter batas minimum stok, lead time supplier, dan safety stock untuk mencegah kekosongan barang di etalase.
- **Posisi Stok Real-Time**: Pemantauan kuantitas barang secara terpisah antara stok siap jual di rak toko dan stok cadangan di gudang.
- **Mutasi Stok Antar-Zona**: Fitur pencatatan pemindahan barang dari gudang ke rak display penjualan dengan validasi kuantitas.
- **Pencatatan Barang Rusak / Kadaluwarsa**: Dokumentasi barang cacat pabrik, rusak saat penanganan, atau melewati batas expired date lengkap dengan bukti dokumentasi.
- **Kartu Stok Kronologis**: Audit trail mutasi keluar-masuk per barang beserta referensi nomor dokumen (PO, GR, Penjualan, Mutasi, Opname) dan saldo akhir.
- **Stock Opname (Hitung Fisik)**:
  - Pembukaan sesi stock opname terjadwal per kategori/zona rak.
  - Cetak formulir lembar hitung fisik untuk staf lapangan.
  - Input hasil hitung fisik dan kalkulasi otomatis selisih sistem vs. fisik.
- **Penyesuaian Stok (Stock Adjustment)**: Pengajuan persetujuan dan eksekusi penyesuaian stok berdasarkan hasil stock opname.

### 3. Modul Purchasing (Pengadaan & Pembelian)
- **Data Pemasok (Supplier)**: Manajemen direktori rekanan vendor, kontak person, alamat, termin pembayaran (TOP), dan status legalitas.
- **Katalog Harga Supplier**: Arsip histori penawaran dan katalog harga per produk dari masing-masing supplier untuk perbandingan harga terbaik.
- **Rekomendasi Belanja Otomatis (Auto-PR)**: Deteksi otomatis barang yang sudah menyentuh batas ROP untuk dijadikan draf permohonan pengadaan barang.
- **Purchase Order (PO)**: Penerbitan dokumen pemesanan resmi, form pemesanan multi-item, alur approval, dan fasilitas cetak dokumen PO standar ritel.
- **Tracking Pemesanan (PO Tracking)**: Pemantauan status pemesanan (Draft, Menunggu Approval, Dikirim Supplier, Diterima Sebagian, Selesai).
- **Penerimaan Barang (Goods Receipt)**: Penerimaan barang fisik dari supplier yang dicocokkan langsung terhadap nomor PO, termasuk verifikasi batch dan tanggal kadaluwarsa.
- **Retur Pembelian (Purchase Return)**: Pembuatan dokumen retur barang rusak atau tidak sesuai pesanan kembali ke supplier.
- **Verifikasi Nota Supplier (3-Way Matching)**: Validasi kesesuaian antara dokumen PO, dokumen penerimaan (GR), dan invoice/faktur dari supplier sebelum diteruskan ke bagian keuangan.
- **Hutang & Pembayaran (Payables)**: Pengelolaan jadwal jatuh tempo pembayaran invoice supplier untuk menjaga likuiditas usaha.
- **Laporan Riwayat Pembelian**: Rekapitulasi transaksi pembelian barang berdasarkan periode tanggal, supplier, atau kelompok kategori.

### 4. Modul Setup & Kontrol Akses (RBAC)
- **Manajemen Pengguna (User Management)**: Pembuatan dan pengelolaan akun staf minimarket.
- **Manajemen Role**: Konfigurasi hak akses berbasis peran (Super Admin, Manager Operasional, Purchasing, Staf Gudang, Kasir).
- **Manajemen Menu Dinamis**: Pengaturan hierarki navigasi sidebar, ikon menu, dan hak visibilitas halaman secara fleksibel.
- **Pengaturan Dashboard**: Kustomisasi tata letak widget dashboard untuk setiap role yang terdaftar.

### 5. Alur Persetujuan & Notifikasi
- **Sistem Approval Bertingkat**: Mendukung validasi dokumen berjenjang dengan status `DRAFT` ➔ `IN APPROVAL` ➔ `APPROVED` / `REJECT` / `REVISI`.
- **Status Data Lock**: Dokumen yang sudah disetujui (`APPROVED`) atau ditolak (`REJECT`) secara otomatis dikunci menjadi mode *read-only* guna menjaga integritas data.
- **Workflow Revisi**: Fasilitas pengembalian dokumen untuk perbaikan dengan input catatan revisi wajib dan pengajuan ulang otomatis setelah disimpan.
- **Pusat Notifikasi**: Notifikasi terpusat untuk item yang membutuhkan perhatian atau persetujuan segera.

### 6. Keamanan & Keandalan UX
- **Proteksi Data Form Belum Tersimpan (Dirty Form Guard)**: Mencegah hilangnya data saat pengguna berpindah halaman tanpa sengaja ketika form sedang diedit.
- **Auto-Logout / AFK Inactivity Timeout**: Otomatis mengunci sesi jika terminal minimarket tidak aktif dalam durasi tertentu (konfigurasi via env).
- **Format Mata Uang & Angka Standar Indonesia**: Penulisan nominal Rupiah, pemisah ribuan, dan kuantitas presisi tinggi.
- **Ekspor Dokumen**: Mendukung ekspor data tabel ke format Excel/CSV serta cetak cetakan resmi langsung ke PDF/Printer.

---

## 🛠️ Teknologi yang Digunakan

| Kategori | Teknologi | Deskripsi |
|---|---|---|
| **Core Framework** | [Vue 3](https://vuejs.org/) (v3.5+) | Framework JavaScript progresif dengan Composition API |
| **Language** | [TypeScript](https://www.typescriptlang.org/) (v5.9+) | Static typing untuk kode yang aman dan minim bug |
| **Build Tool** | [Vite](https://vitejs.dev/) (v7.x) | Bundler generasi terbaru yang super cepat |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) (v4.x) | Utility-first modern CSS framework |
| **UI Components** | [Reka UI](https://reka-ui.com/) / Shadcn-vue | Komponen UI aksesibel dan konsisten |
| **State Management** | [Pinia](https://pinia.vuejs.org/) (v3.x) | Penyimpanan state terpusat dan reaktif |
| **Routing** | [Vue Router](https://router.vuejs.org/) (v4.x) | Routing modular dengan role-based guard |
| **Icons** | [Lucide Vue Next](https://lucide.dev/) | Kumpulan ikon grafis modern |
| **Tables & Data** | [AG-Grid Community](https://www.ag-grid.com/) | Grid data berkinerja tinggi untuk tabel data masif |
| **Charts** | [Chart.js](https://www.chartjs.org/) | Visualisasi grafik data untuk analitik dashboard |
| **Form Validation** | [Vee-Validate](https://vee-validate.logaretm.com/) & [Zod](https://zod.dev/) | Validasi form dengan skema berbasis schema-first |
| **Notifications** | [Vue Sonner](https://vue-sonner.vercel.app/) | Notifikasi pop-up toast yang elegan |

---

## 📁 Struktur Direktori

```text
fe-minimarket/
├── public/                     # Aset statis publik (favicon, logo minimarket, dll.)
├── src/
│   ├── assets/                 # Aset gambar, font, dan style dasar
│   ├── components/             # Komponen UI Vue yang dapat digunakan ulang
│   │   ├── dashboard/          # Komponen widget & grafik dashboard
│   │   ├── dialog/             # Modal & popup dialog interaktif
│   │   ├── field/              # Komponen form input, dropdown, autocomplete
│   │   ├── table/              # Komponen tabel dan pagination
│   │   └── ui/                 # Komponen dasar (Button, Card, Input, Badge, dsb.)
│   ├── composables/            # Vue composables (logika reaktif terpisah)
│   ├── lib/                    # Library utilitas (klien API, format mata uang, helpers)
│   │   ├── access.ts           # Logika pengecekan otorisasi dan role
│   │   ├── api.ts              # Konfigurasi fetch HTTP client & token bearer
│   │   ├── navigationGuard.ts  # Pelindung rute form belum tersimpan (dirty check)
│   │   └── utils.ts            # Helper manipulasi string, angka, dan class merger
│   ├── router/                 # Konfigurasi rute Vue Router secara modular
│   │   ├── index.ts            # Entri utama router, routing guard & proteksi sesi
│   │   ├── crud-routes.ts      # Rute CRUD terstandarisasi untuk modul setup
│   │   ├── helpers.ts          # Generator rute modular otomatis
│   │   └── notifications.ts    # Rute untuk pusat notifikasi & approval
│   ├── stores/                 # State management Pinia (auth, user session, preferences)
│   ├── styles/                 # Styling global Tailwind CSS
│   ├── views/                  # Halaman tampilan modul bisnis minimarket
│   │   ├── dashboard/          # Tampilan dashboard utama minimarket
│   │   ├── inventory/          # Halaman modul persediaan & inventaris
│   │   │   ├── master/         # Master Barang, Kategori & Rak, Satuan (UOM), ROP
│   │   │   ├── opname/         # Stock Opname (Hitung fisik, formulir cetak, adjustment)
│   │   │   └── stok/           # Posisi stok real-time, kartu stok, mutasi, barang rusak
│   │   ├── login/              # Halaman login otentikasi staf minimarket
│   │   ├── notifikasi/         # Halaman daftar approval & notifikasi operasional
│   │   ├── purchasing/         # Halaman modul pengadaan & pembelian
│   │   │   ├── invoicing/      # Verifikasi nota (3-way match) & jadwal hutang dagang
│   │   │   ├── master/         # Master data supplier & katalog harga produk
│   │   │   ├── order/          # Rekomendasi auto-PR, pembuatan PO, tracking PO
│   │   │   ├── receiving/      # Penerimaan barang fisik & retur supplier
│   │   │   └── reports/        # Laporan riwayat pembelian barang
│   │   └── setup/              # Setup sistem (Menu, Role wewenang, User akun, Dashboard)
│   ├── App.vue                 # Root komponen Vue
│   └── main.ts                 # Titik masuk utama aplikasi (entry point)
├── add_route.cjs               # Script utilitas generator CRUD dan rute baru
├── components.json             # Konfigurasi Shadcn / Reka UI
├── package.json                # Dependensi proyek & daftar script perintah
├── tsconfig.json               # Konfigurasi compiler TypeScript
└── vite.config.ts              # Konfigurasi bundler Vite
```

---

## 🔧 Prasyarat Sistem

Sebelum menjalankan aplikasi, pastikan perangkat Anda telah memenuhi prasyarat berikut:

- **Node.js**: Versi `^20.19.0` atau `>= 22.12.0` (LTS disarankan).
- **Package Manager**: [pnpm](https://pnpm.io/) (versi 8 atau lebih baru) atau `npm`.

Untuk memasang `pnpm` secara global (opsional namun disarankan):
```bash
npm install -g pnpm
```

---

## 🚀 Panduan Instalasi & Konfigurasi

### 1. Salin Konfigurasi Environment
Salin file template `.env.example` menjadi `.env` di dalam direktori `fe-minimarket`:

```bash
cp .env.example .env
```

Sesuaikan nilai variabel lingkungan pada file `.env`:
```env
# URL endpoint backend API Minimarket
VITE_API_BASE_URL=http://localhost:5000/api

# Waktu inaktivitas otomatis logout (dalam milidetik, contoh: 1 jam = 3600000)
VITE_AFK_TIMEOUT_MS=3600000
```

> **Catatan**: Jika backend minimarket Anda berjalan di port yang berbeda atau domain server staging/production, arahkan `VITE_API_BASE_URL` sesuai alamat server backend Anda.

### 2. Pasang Dependensi
Jalankan perintah berikut untuk mengunduh seluruh dependensi proyek:

```bash
pnpm install
# atau menggunakan npm:
npm install
```

### 3. Jalankan Server Development
Mulai server pengembangan lokal:

```bash
pnpm dev
# atau:
npm run dev
```

Secara default, aplikasi akan dapat diakses melalui peramban web pada alamat:
```
http://localhost:5173
```

---

## 💻 Perintah yang Tersedia (NPM/PNPM Scripts)

| Perintah | Deskripsi |
|---|---|
| `pnpm dev` | Menjalankan local development server Vite dengan Hot Module Replacement (HMR). |
| `pnpm build` | Memeriksa tipe data TypeScript dan melakukan kompilasi bundel production ke direktori `dist/`. |
| `pnpm preview` | Menjalankan server lokal untuk menguji hasil build direktori `dist/`. |
| `pnpm type-check` | Menjalankan pengecekan tipe data TypeScript tanpa melakukan build (`vue-tsc --build`). |
| `pnpm test:unit` | Menjalankan pengujian unit berbasis Vitest. |
| `pnpm test:auth` | Menguji alur otentikasi lokal melalui skrip pengujian khusus. |
| `pnpm version:patch` | Mengotomatisasi penambahan versi patch pada `package.json` dan metadata rilis. |

---

## ⚡ Generator Modul Rute Cepat

Untuk mempercepat pengembangan modul baru dengan format standar CRUD (Landing Page, Form Input, dan View Detail), tersedia script generator:

```bash
# Menambahkan modul CRUD baru
node add_route.cjs <kategori>/<nama_modul>

# Contoh: Menambahkan modul master kategori rak baru
node add_route.cjs inventory/master/m_sample
```

Skrip ini akan secara otomatis:
1. Membuat struktur folder komponen yang sesuai standar.
2. Menyiapkan berkas tampilan daftar (Landing Table), form entri, dan berkas service API.
3. Mendaftarkan rute baru secara otomatis ke dalam `src/router/crud-routes.ts`.

---

## 🔗 Integrasi Backend

Frontend ini terintegrasi langsung dengan backend repository pendamping: **`be-minimarket`**.
- Backend mengelola basis data menggunakan **PostgreSQL/Supabase** dan **Prisma 7**.
- Komunikasi pertukaran data menggunakan format **RESTful JSON API** dengan prefix `/api/v1/`.
- Otentikasi sesi mengandalkan **Bearer JWT Token** yang disimpan pada penyimpanan lokal yang aman dan diverifikasi pada setiap request HTTP.

---

## 📄 Lisensi

Proyek ini bersifat tertutup (proprietary) dan dikembangkan khusus untuk sistem manajemen operasional internal minimarket. Hak cipta dilindungi undang-undang.
