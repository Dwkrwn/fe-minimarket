<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Mic } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { toast } from 'vue-sonner'

const emit = defineEmits(['update:transcript'])

const router = useRouter()

const isListening = ref(false)
const transcript = ref('')
const recognition = ref<any>(null)

// ─── STATIC MENU MAP ───────────────────────────────────────────────────────────
// Source of truth: src/router/crud-routes.ts
// Keywords: Indonesian + English + abbreviations + common typos
interface StaticMenu { name: string; path: string; keywords: string[] }

const staticMenus: StaticMenu[] = [
  // ── ACCOUNTING ──
  {
    name: 'COA / Chart of Account',
    path: '/accounting/master/m_coa',
    keywords: ['coa', 'co a', 'koa', 'jua', 'coa.', 'chart of account', 'chart account', 'akun', 'akuntansi', 'buku besar', 'ledger', 'kode akun', 'daftar akun', 'chart']
  },
  // ── SETUP ──
  {
    name: 'General / Pengaturan Umum',
    path: '/setup/m_general',
    keywords: ['general', 'pengaturan', 'pengaturan umum', 'setting', 'konfigurasi', 'umum']
  },
  {
    name: 'User Default',
    path: '/setup/user_default',
    keywords: ['user', 'pengguna', 'yusr', 'yuser', 'user default', 'default user', 'pengguna default', 'user awal', 'manajemen user', 'data user', 'akun pengguna']
  },
  {
    name: 'Unit Bisnis',
    path: '/setup/m_unit_bisnis',
    keywords: ['unit bisnis', 'bisnis', 'cabang', 'divisi', 'unit', 'business unit']
  },
  {
    name: 'Prefix / Nomor',
    path: '/setup/m_prefix',
    keywords: ['prefix', 'nomor', 'number', 'penomoran', 'format nomor', 'kode dokumen']
  },
  {
    name: 'Role',
    path: '/setup/m_role',
    keywords: ['role', 'rol', 'roll', 'rul', 'roley', 'roles', 'peran', 'hak akses', 'role user', 'jabatan akses', 'akses pengguna', 'atur role']
  },
  {
    name: 'Responsibility',
    path: '/setup/m_respo',
    keywords: ['responsibility', 'respo', 'tanggung jawab', 'akses menu', 'permission', 'izin']
  },
  {
    name: 'Karyawan',
    path: '/setup/m_kary',
    keywords: ['karyawan', 'kary', 'pegawai', 'staff', 'employee', 'sdm', 'sumber daya manusia', 'personalia']
  },
  {
    name: 'Approval',
    path: '/setup/m_approval',
    keywords: ['approval', 'persetujuan', 'approve', 'otorisasi', 'autorisasi', 'validasi dokumen']
  },
  {
    name: 'Currency / Mata Uang',
    path: '/setup/m_currency',
    keywords: ['currency', 'karens', 'kurrens', 'mata uang', 'uang', 'kurs', 'valuta', 'exchange rate', 'rupiah', 'dollar', 'nilai tukar', 'daftar mata uang']
  },
  {
    name: 'Group Item',
    path: '/setup/m_item_group',
    keywords: ['group item', 'item group', 'grup item', 'kategori barang', 'group barang', 'golongan item']
  },
  {
    name: 'Kendaraan',
    path: '/setup/m_kendaraan',
    keywords: ['kendaraan', 'mobil', 'motor', 'armada', 'kendaraan operasional', 'vehicle', 'transportasi']
  },
  // ── PURCHASING MASTER ──
  {
    name: 'Supplier',
    path: '/purchasing/master/m_supplier',
    keywords: ['supplier', 'vendor', 'pemasok', 'rekanan', 'mitra', 'suplier', 'master supplier', 'data supplier', 'daftar supplier']
  },
  {
    name: 'Items / Barang',
    path: '/inventory/master/m_items',
    keywords: ['item', 'items', 'barang', 'produk', 'product', 'material', 'bahan', 'master item', 'master barang', 'katalog']
  },
  // ── PURCHASING TRANSAKSI ──
  {
    name: 'Purchase Request',
    path: '/purchasing/transaksi/t_purchase_request',
    keywords: ['purchase request', 'permintaan pembelian', 'request pembelian', 'permintaan barang', 'buat permintaan beli']
  },
  {
    name: 'Purchase Request Close',
    path: '/purchasing/transaksi/t_purchase_request_close',
    keywords: ['closing pr', 'pr close', 'tutup pr', 'close pr', 'close purchase request', 'purchase request close', 'penutupan pr']
  },
  {
    name: 'Purchase Order',
    path: '/purchasing/transaksi/t_purchase_order',
    keywords: ['purchase order', 'order pembelian', 'pembelian', 'pesan barang', 'buat order beli', 'order beli', 'transaksi pembelian']
  },
  {
    name: 'Purchase Order Close',
    path: '/purchasing/transaksi/t_purchase_order_close',
    keywords: ['closing po', 'po close', 'tutup po', 'close po', 'close purchase order', 'purchase order close', 'penutupan po']
  },
  {
    name: 'Purchase Invoice',
    path: '/purchasing/transaksi/t_purchase_invoice',
    keywords: ['purchase invoice', 'invoice pembelian', 'faktur pembelian', 'tagihan pembelian', 'faktur vendor', 'invoice beli']
  },
  {
    name: 'Purchase Return',
    path: '/purchasing/transaksi/t_purchase_return',
    keywords: ['purchase return', 'return pembelian', 'retur', 'retur barang', 'pengembalian barang', 'return']
  },
  {
    name: 'Penerimaan / LPB',
    path: '/purchasing/transaksi/t_penerimaan',
    keywords: ['penerimaan', 'lpb', 'terima barang', 'penerimaan barang', 'receiving', 'goods receipt', 'good receipt', 'grn penerimaan']
  },
  {
    name: 'RFQ / Request for Quotation',
    path: '/purchasing/transaksi/t_rfq',
    keywords: ['rfq', 'request for quotation', 'request quotation', 'permintaan penawaran harga', 'minta penawaran', 'permohonan penawaran', 'quotation request', 'ar ef ku', 'ar ef queue', 'arfq']
  },
  {
    name: 'Supplier Quotation',
    path: '/purchasing/transaksi/t_supplier_quotation',
    keywords: ['supplier quotation', 'penawaran supplier', 'kuotasi supplier', 'harga penawaran', 'penawaran harga supplier', 'penawaran dari supplier', 'quotation supplier']
  },
  {
    name: 'Biaya Kirim',
    path: '/purchasing/transaksi/t_import_cost',
    keywords: ['Biaya Kirim', 'biaya import', 'biaya impor', 'impor', 'import', 'bea masuk', 'landed cost']
  },
  // ── INVENTORY ──
  {
    name: 'Gudang / Warehouse',
    path: '/inventory/master/m_gudang',
    keywords: ['gudang', 'warehouse', 'wh', 'master gudang', 'lokasi gudang', 'depo']
  },
  {
    name: 'Rak',
    path: '/inventory/master/m_rak',
    keywords: ['rak', 'lokasi rak', 'bin', 'shelf', 'tempat barang', 'lokasi penyimpanan']
  },
  {
    name: 'Stock Opname',
    path: '/inventory/transaksi/t_stock_opname',
    keywords: ['stock opname', 'opname', 'so', 'hitung stok', 'cek stok', 'fisik stok', 'stock count', 'stock take']
  },
  {
    name: 'Stock Adjustment',
    path: '/inventory/transaksi/t_stock_adj',
    keywords: ['stock adjustment', 'adj', 'penyesuaian stok', 'adjustment stok', 'koreksi stok', 'stock adj']
  },
  {
    name: 'Transfer Gudang',
    path: '/inventory/transaksi/t_transfer_gudang',
    keywords: ['transfer gudang', 'transfer warehouse', 'pindah barang', 'mutasi gudang', 'transfer stok', 'pindah stok', 'tg', 'tw']
  },
  {
    name: 'Surat Jalan Gudang',
    path: '/inventory/transaksi/t_sj_gudang',
    keywords: ['surat jalan', 'sj', 'sj gudang', 'surat jalan gudang', 'delivery order', 'do', 'pengiriman']
  },
  {
    name: 'Penerimaan Gudang',
    path: '/inventory/transaksi/t_penerimaan_gudang',
    keywords: ['penerimaan gudang', 'terima gudang', 'receiving gudang', 'goods receipt gudang', 'penerimaan warehouse']
  },
  // ── PURCHASING MASTER tambahan ──
  {
    name: 'Ekspedisi',
    path: '/purchasing/master/m_ekspedisi',
    keywords: ['ekspedisi', 'kurir', 'pengiriman', 'jasa kirim', 'ekspedisi barang', 'logistik', 'cargo']
  },
  // ── MARKETING MASTER ──
  {
    name: 'Customer / Pelanggan',
    path: '/marketing/master/m_customer',
    keywords: ['customer', 'pelanggan', 'konsumen', 'klien', 'client', 'pembeli', 'master customer']
  },
  {
    name: 'Prospek',
    path: '/marketing/master/m_prospek',
    keywords: ['prospek', 'prospect', 'calon pelanggan', 'leads', 'potential customer', 'calon customer']
  },
  // ── MARKETING TRANSAKSI ──
  {
    name: 'Sales Quotation',
    path: '/marketing/transaksi/t_sales_quotation',
    keywords: ['sales quotation', 'customer quotation', 'penawaran penjualan', 'kuotasi penjualan', 'penawaran ke pelanggan', 'penawaran harga jual', 'quotation penjualan', 'penawaran customer']
  },
  {
    name: 'Sales Order',
    path: '/marketing/transaksi/t_sales_order',
    keywords: ['sales order', 'order penjualan', 'pesanan penjualan', 'buat order jual', 'order jual', 'transaksi penjualan']
  },
  {
    name: 'Sales Reservation',
    path: '/marketing/transaksi/t_sales_reservation',
    keywords: ['sales reservation', 'reservasi', 'reservation penjualan', 'booking', 'sales booking', 'reservasi sales']
  },
  {
    name: 'Closing SO / Sales Order Close',
    path: '/marketing/transaksi/t_sales_close',
    keywords: ['closing so', 'so close', 'sales close', 'tutup so', 'close sales order', 'close so', 'sales order close']
  },
  {
    name: 'Surat Jalan',
    path: '/marketing/transaksi/t_surat_jalan',
    keywords: ['surat jalan', 'sj', 'delivery order', 'do', 'pengiriman barang', 'surat pengiriman', 'sj marketing']
  },
  {
    name: 'Sales Invoice',
    path: '/marketing/transaksi/t_sales_invoice',
    keywords: ['sales invoice', 'invoice penjualan', 'faktur penjualan', 'tagihan pelanggan', 'tagihan penjualan', 'invoice jual']
  },
  {
    name: 'Sales Return',
    path: '/marketing/transaksi/t_sales_return',
    keywords: ['sales return', 'return penjualan', 'retur penjualan', 'retur sales', 'pengembalian penjualan']
  },
  // ── INVENTORY LAINNYA ──
  {
    name: 'Info Stock / Stock Per Gudang',
    path: '/inventory/transaksi/stock_gudang',
    keywords: ['info stock', 'stock gudang', 'stok gudang', 'info stok', 'cek stock', 'lihat stock', 'stock per gudang', 'stok per gudang']
  },
  {
    name: 'Info Stock per Item / Stock Per Item',
    path: '/inventory/transaksi/stock_gudang_2',
    keywords: ['info stock per item', 'stock item', 'item stock', 'stok per item', 'lokasi item', 'item location', 'cari item', 'stok barang']
  },
]

// ─── SPEECH RECOGNITION ────────────────────────────────────────────────────────

const initSpeechRecognition = () => {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SpeechRecognition) return

  recognition.value = new SpeechRecognition()
  recognition.value.lang = 'id-ID'
  recognition.value.continuous = false

  recognition.value.interimResults = true

  recognition.value.onstart = () => {
    isListening.value = true
    transcript.value = ''
    emit('update:transcript', '')
  }

  recognition.value.onresult = (event: any) => {
    let interimTranscript = ''
    let finalTranscript = ''

    // 3. LOGIKA UNTUK MEMBACA TEKS SEMENTARA & FINAL
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript
      } else {
        interimTranscript += event.results[i][0].transcript
      }
    }

    const currentText = finalTranscript + interimTranscript
    transcript.value = currentText
    
    // Kirim teks yang sedang diucapkan ke searchbar Sidebar
    emit('update:transcript', currentText)

    // Jika user sudah selesai bicara, baru eksekusi pencariannya
    if (finalTranscript) {
      handleVoiceSearch(finalTranscript)
    }
  }

  recognition.value.onerror = (event: any) => {
    isListening.value = false
    if (!['aborted', 'no-speech', 'audio-capture'].includes(event.error)) {
      toast.error('Gagal mengenali suara', { description: 'Pastikan mikrofon aktif dan coba lagi.' })
    }
  }

  recognition.value.onend = () => {
    isListening.value = false
    // Selalu clear transcript saat mic berhenti agar sidebar bersih
    transcript.value = ''
    emit('update:transcript', '')
  }
}

// ─── MATCHING ──────────────────────────────────────────────────────────────────

const handleVoiceSearch = (query: string) => {
  console.log('[VoiceSearch] speech returned:', query)
  // Strip tanda baca (titik, koma, tanda tanya, dll) yang sering ditambahkan speech API
  const q = query.toLowerCase().trim().replace(/[.,!?;:"']/g, '').replace(/\s+/g, ' ').trim()
  const qCompact = q.replace(/\s/g, '')

  // Score each menu — higher score = better match
  let bestMenu: StaticMenu | null = null
  let bestScore = 0

  for (const menu of staticMenus) {
    let score = 0
    for (const kw of menu.keywords) {
      const k = kw.toLowerCase()
      const kCompact = k.replace(/\s/g, '')

        // Exact match — selalu menang
      if (q === k || qCompact === kCompact) { score = 100; break }

      // Substring match HANYA untuk keyword >= 4 karakter
      // Cegah 'pi','so','pr' dll false-match ke query lain
      if (k.length >= 4) {
        if (q.includes(k))                        score = Math.max(score, 85)
        if (k.includes(q) && q.length >= 4)       score = Math.max(score, 75)
      }
      if (kCompact.length >= 4) {
        if (qCompact.includes(kCompact))          score = Math.max(score, 80)
        if (kCompact.includes(qCompact) && qCompact.length >= 4) score = Math.max(score, 65)
      }
    }
    if (score > bestScore) { bestScore = score; bestMenu = menu }
    if (bestScore === 100) break  // exact match, berhenti langsung
  }

  if (bestMenu && bestScore >= 65) {
    toast.success(`Membuka: ${bestMenu.name}`)
    // Clear transcript agar sidebar tidak terfilter
    transcript.value = ''
    emit('update:transcript', '')
    setTimeout(() => { router.push(bestMenu!.path) }, 400)
  } else {
    transcript.value = ''
    emit('update:transcript', '')
    toast.error('Menu tidak ditemukan', {
      description: `"${query}" — coba kata lain seperti "purchase order", "karyawan", dll.`
    })
  }
}

// ─── CONTROLS ──────────────────────────────────────────────────────────────────

const toggleVoiceSearch = () => {
  if (!recognition.value) {
    toast.error('Voice Search tidak didukung', { description: 'Browser tidak mendukung Web Speech API.' })
    return
  }
  if (isListening.value) {
    recognition.value.stop()
  } else {
    recognition.value.start()
    toast.info('🎤 Mendengarkan...', { description: 'Sebutkan nama menu, misal: "purchase order"' })
  }
}

const stopListening = () => {
  if (recognition.value && isListening.value) recognition.value.stop()
}

onMounted(() => {
  initSpeechRecognition()
})
</script>

<template>
  <div class="relative flex-shrink-0">
    <!-- Voice Search Button - Normal State -->
    <Button
      v-if="!isListening"
      @click="toggleVoiceSearch"
      variant="ghost"
      size="icon"
      class="relative h-9 w-9"
      title="Voice Menu Search"
    >
      <Mic class="h-5 w-5" />
    </Button>

    <!-- Voice Search Button - Listening State (Animated Mic) -->
    <Button
      v-else
      @click="stopListening"
      variant="ghost"
      size="icon"
      class="relative h-9 w-9 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30"
      title="Stop Listening"
    >
      <Mic class="h-5 w-5 text-red-600 dark:text-red-400 animate-pulse-mic" />
    </Button>
  </div>
</template>

<style scoped>
@keyframes pulse-mic {
  0%, 100% { 
    transform: scale(1);
    opacity: 1;
  }
  50% { 
    transform: scale(1.2);
    opacity: 0.7;
  }
}

.animate-pulse-mic {
  animation: pulse-mic 1s ease-in-out infinite;
}
</style>
