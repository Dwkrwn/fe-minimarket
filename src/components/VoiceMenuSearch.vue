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
  // ── SETUP ──
  {
    name: 'User Default',
    path: '/setup/user_default',
    keywords: ['user', 'pengguna', 'yusr', 'yuser', 'user default', 'default user', 'pengguna default', 'manajemen user', 'data user', 'akun pengguna']
  },
  {
    name: 'Role',
    path: '/setup/m_role',
    keywords: ['role', 'rol', 'roll', 'rul', 'roles', 'peran', 'hak akses', 'role user', 'atur role']
  },
  {
    name: 'Master Menu',
    path: '/setup/menu',
    keywords: ['menu', 'master menu', 'navigasi', 'sidebar', 'menu aplikasi']
  },
  {
    name: 'Setting Dashboard',
    path: '/setup/m_dashboard',
    keywords: ['dashboard', 'setting dashboard', 'pengaturan dashboard', 'widget', 'beranda']
  },
  {
    name: 'Notifikasi',
    path: '/notifikasi',
    keywords: ['notifikasi', 'notification', 'pemberitahuan', 'approval', 'persetujuan']
  },
  // ── PURCHASING MASTER ──
  {
    name: 'Supplier',
    path: '/purchasing/master/suppliers',
    keywords: ['supplier', 'vendor', 'pemasok', 'rekanan', 'mitra', 'suplier', 'master supplier', 'data supplier', 'daftar supplier']
  },
  {
    name: 'Katalog Harga Supplier',
    path: '/purchasing/master/supplier-catalogs',
    keywords: ['price list', 'daftar harga', 'harga beli', 'pricelist', 'katalog harga', 'harga supplier']
  },
  // ── INVENTORY MASTER ──
  {
    name: 'Items / Barang',
    path: '/inventory/master/m_items',
    keywords: ['item', 'items', 'barang', 'produk', 'product', 'material', 'bahan', 'master item', 'master barang', 'katalog']
  },
  // ── PURCHASING ──
  {
    name: 'Rekomendasi Belanja',
    path: '/purchasing/order/auto-pr',
    keywords: ['purchase request', 'permintaan pembelian', 'request pembelian', 'rekomendasi belanja', 'auto pr', 'permintaan barang']
  },
  {
    name: 'Purchase Order',
    path: '/purchasing/order/purchase-orders',
    keywords: ['purchase order', 'order pembelian', 'pembelian', 'pesan barang', 'buat order beli', 'order beli', 'transaksi pembelian', 'po']
  },
  {
    name: 'Tracking PO',
    path: '/purchasing/order/tracking',
    keywords: ['tracking po', 'progres po', 'status po', 'pemenuhan po', 'sisa barang']
  },
  {
    name: 'Retur Pembelian',
    path: '/purchasing/receiving/purchase-returns',
    keywords: ['purchase return', 'return pembelian', 'retur', 'retur barang', 'pengembalian barang', 'return']
  },
  {
    name: 'Penerimaan Barang',
    path: '/purchasing/receiving/goods-receipts',
    keywords: ['penerimaan', 'lpb', 'terima barang', 'penerimaan barang', 'receiving', 'goods receipt', 'good receipt', 'grn penerimaan']
  },
  // ── INVENTORY TRANSAKSI ──
  {
    name: 'Stock Opname',
    path: '/inventory/opname/fisik',
    keywords: ['stock opname', 'opname', 'so', 'hitung stok', 'cek stok', 'fisik stok', 'stock count', 'stock take']
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
