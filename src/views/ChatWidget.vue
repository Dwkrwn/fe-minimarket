<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import { useChatbot } from '@/composables/useChatbot';
// Import baru menggunakan Lucide
import {
  Send,
  MessageSquareMore,
  X,
  Minus,
  Trash2,
  Pencil,
  Volume2,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Mic
} from 'lucide-vue-next';
interface Action {
  label: string;
  onClick: () => void;
}

interface Choice {
  title: string;
  id: string | number;
}

interface DevForm {
  question: string;
  keywords: string;
  type: string;
  answer: string;
  saving: boolean;
  saved: boolean;
  error: string;
}

interface Message {
  id: number;
  sender: 'user' | 'bot';
  type: 'text' | 'html' | 'choices' | 'navigation';
  content: string;
  time: string;
  actions?: Action[];
  choices?: Choice[];
  allowFeedback?: boolean;
  feedbackSent?: boolean;
  lastUserQuery?: string;
  showDevForm?: boolean;
  devForm?: DevForm;
  customReadText?: string;
  nav_path?: string;
  nav_query?: Record<string, any>;
}

type MessageType = Message['type'];

const API_BASE = import.meta.env.VITE_CHATBOT_API_BASE_URL;
const ENDPOINTS = {
  CHAT: `${API_BASE}/get_response`,
  FEEDBACK: `${API_BASE}/submit_feedback`,
  ADD_QA: `${API_BASE}/add_custom_qa`,
  TYPES: `${API_BASE}/get_types`
};

const featureInfo: Record<string, any> = {
  'kalkulator': {
    title: '🧮 Kalkulator Sales',
    desc: 'Bantu hitung cepat sales & finance. Contoh: "diskon 20% dari 500rb", "1.1jt inc ppn".',
    examples: ['diskon 20% dari 500rb', '1.110.000 inc ppn', 'ppn dari 100rb']
  },
  'tanggal': {
    title: '📅 Cari Tanggal',
    desc: 'Hitung penanggalan. Contoh: "100 hari lagi", "lusa tanggal berapa?", "kuartal ini".',
    examples: ['100 hari lagi', 'lusa tanggal berapa?', 'kuartal ini']
  },
  'menu': {
    title: '📂 Pencarian Menu',
    desc: 'Cari lokasi menu ERP. Contoh: "Cara buat Sales Order", "Dimana menu stok?".',
    examples: ['Cara buat Sales Order', 'Data Customer', 'Cek stok barang']
  },
  'troubleshoot': {
    title: '🔧 Troubleshooting',
    desc: 'Solusi masalah/error. Contoh: "Lupa password", "Tombol simpan error".',
    examples: ['Data tidak bisa diubah', 'Tombol simpan error', 'Lupa password']
  },
  'general': {
    title: '🧠 Info General',
    desc: 'Tanya istilah umum. Contoh: "Apa itu TOP?", "Beda Draft dan Post".',
    examples: ['Apa itu TOP?', 'Beda Draft dan Post', 'Alur penjualan']
  }
};

const router = useRouter();
const { isOpen, closeChat } = useChatbot();
const isTyping = ref(false);
const userInput = ref('');
const messages = ref<Message[]>([]);
const messagesContainer = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const availableTypes = ref(['general']);
const editTargetId = ref<number | null>(null);
const sessionId = ref(`session_${Date.now()}_${Math.random().toString(36).slice(2)}`);
const isListening = ref(false);
let recognition: any = null;
let msgCounter = 0;


watch(isOpen, (newVal) => {
  if (newVal) {
    if (messages.value.length === 0) {
      welcome();
    }
    scrollToBottom();
    nextTick(() => {
      textareaRef.value?.focus();
    });
  }
});

const getCurrentTime = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

const decodeHtmlEntities = (content: string) => {
  if (!content) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = content;
  return textarea.value;
};

const looksLikeHtml = (content: string) => /<\/?[a-z][\s\S]*>/i.test(content);
const looksLikeEscapedHtml = (content: string) => /&lt;\/?[a-z][\s\S]*&gt;/i.test(content);

const sanitizeHtmlContent = (content: string) => {
  const template = document.createElement('template');
  template.innerHTML = content;

  template.content.querySelectorAll('script, style, iframe, object, embed').forEach((node) => {
    node.remove();
  });

  template.content.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();

      if (name.startsWith('on')) {
        element.removeAttribute(attr.name);
        return;
      }

      if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
        element.removeAttribute(attr.name);
      }
    });
  });

  return template.innerHTML;
};

const normalizeMessagePayload = (type: string, content: string): { type: MessageType; content: string } => {
  if (!content) {
    return { type: 'text', content: '' };
  }

  const normalizedType: MessageType =
    type === 'html' || type === 'choices' || type === 'navigation' ? type : 'text';

  const decodedContent = looksLikeEscapedHtml(content) ? decodeHtmlEntities(content) : content;
  const shouldRenderAsHtml =
    normalizedType === 'html' ||
    normalizedType === 'navigation' ||
    normalizedType === 'choices' ||
    looksLikeHtml(decodedContent);

  return {
    type: shouldRenderAsHtml && normalizedType === 'text' ? 'html' : normalizedType,
    content: shouldRenderAsHtml ? sanitizeHtmlContent(decodedContent) : decodedContent,
  };
};

const adjustTextareaHeight = () => {
  if (!textareaRef.value) return;
  textareaRef.value.style.height = 'auto';
  textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 120) + 'px';
};

// Watch for isOpen changes to trigger welcome message
watch(isOpen, (newVal) => {
  if (newVal && messages.value.length === 0) {
    welcome();
  }
  if (newVal) {
    scrollToBottom();
  }
});

const clearChat = () => {
  messages.value = [];
  editTargetId.value = null;
  welcome('clear');
};

const clearInput = () => {
  userInput.value = '';
  nextTick(() => {
    adjustTextareaHeight();
    textareaRef.value?.focus();
  });
};

const startEdit = (msg: Message) => {
  if (msg.sender !== 'user') return;
  editTargetId.value = msg.id;
  userInput.value = msg.content;
  if (!isOpen.value) isOpen.value = true;
  nextTick(() => {
    adjustTextareaHeight();
    textareaRef.value?.focus();
  });
};

const welcome = (type = '') => {
  const greeting = type === 'clear'
    ? `👋 <strong>Layar sudah dibersihkan!</strong><br>Mau saya bantu apa lagi?`
    : `👋 <strong>Halo! Saya Assistant ERP.</strong><br>Saya bisa bantu hitung pajak, cari menu, atau jawab pertanyaan teknis.`;

  const actions: Action[] = [
    { label: '🧮 Kalkulator', onClick: () => showFeature('kalkulator') },
    { label: '📅 Tanggal', onClick: () => showFeature('tanggal') },
    { label: '📂 Cari Menu', onClick: () => showFeature('menu') },
    { label: '🔧 Troubleshoot', onClick: () => showFeature('troubleshoot') },
    { label: '⚡ DEV: Add QA', onClick: () => sendMessage('/dev') },
  ];

  pushMessage('bot', 'html', greeting, { actions });
};

const showFeature = (key: string) => {
  const info = featureInfo[key];
  if (!info) return;
  const htmlContent = `<strong>${info.title}</strong><br><span class="text-gray-700 dark:text-gray-200">${info.desc}</span>`;
  const actions = info.examples.map((ex: string) => ({
    label: ex,
    onClick: () => sendMessage(ex)
  }));
  pushMessage('bot', 'html', htmlContent, { actions, customReadText: `${info.title}. ${info.desc}` });
};

const pushMessage = (sender: 'user' | 'bot', type: string, content: string, extra: Partial<Message> = {}) => {
  const normalized =
    sender === 'bot'
      ? normalizeMessagePayload(type, content)
      : normalizeMessagePayload(type === 'html' ? 'html' : 'text', content);
  messages.value.push({
    id: ++msgCounter,
    sender,
    type: normalized.type,
    content: normalized.content,
    time: getCurrentTime(),
    ...extra
  });
  scrollToBottom();
};

const speak = (msg: Message) => {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  let text = msg.customReadText || msg.content;
  if (msg.type === 'html' || msg.type === 'navigation') {
    const div = document.createElement('div');
    div.innerHTML = text;
    text = div.textContent || div.innerText || '';
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'id-ID';
  u.rate = 1.0;
  window.speechSynthesis.speak(u);
};

// Koreksi path salah dari backend chatbot → path frontend yang benar
const pathCorrections: Record<string, string> = {
  // ── PURCHASING ──
  '/purchase-order': '/purchasing/transaksi/t_purchase_order',
  '/po': '/purchasing/transaksi/t_purchase_order',
  '/purchase-request': '/purchasing/transaksi/t_purchase_request',
  '/pr': '/purchasing/transaksi/t_purchase_request',
  '/purchase-invoice': '/purchasing/transaksi/t_purchase_invoice',
  '/pi': '/purchasing/transaksi/t_purchase_invoice',
  '/invoice': '/purchasing/transaksi/t_purchase_invoice',
  '/purchase-return': '/purchasing/transaksi/t_purchase_return',
  '/purchase-request-close': '/purchasing/transaksi/t_purchase_request_close',
  '/request-close': '/purchasing/transaksi/t_purchase_request_close',
  '/close-pr': '/purchasing/transaksi/t_purchase_request_close',
  '/purchase-order-close': '/purchasing/transaksi/t_purchase_order_close',
  '/po-close': '/purchasing/transaksi/t_purchase_order_close',
  '/closing-po': '/purchasing/transaksi/t_purchase_order_close',
  '/close-po': '/purchasing/transaksi/t_purchase_order_close',
  '/penerimaan': '/purchasing/transaksi/t_penerimaan',
  '/lpb': '/purchasing/transaksi/t_penerimaan',
  '/grn': '/purchasing/transaksi/t_penerimaan',
  '/goods-receipt': '/purchasing/transaksi/t_penerimaan',
  '/rfq': '/purchasing/transaksi/t_rfq',
  '/supplier-quotation': '/purchasing/transaksi/t_supplier_quotation',
  '/import-cost': '/purchasing/transaksi/t_import_cost',
  // ── PURCHASING MASTER ──
  '/master/items': '/inventory/master/m_items',
  '/master/item': '/inventory/master/m_items',
  '/items': '/inventory/master/m_items',
  '/item': '/inventory/master/m_items',
  '/master/suppliers': '/purchasing/master/m_supplier',
  '/master/supplier': '/purchasing/master/m_supplier',
  '/supplier': '/purchasing/master/m_supplier',
  '/ekspedisi': '/purchasing/master/m_ekspedisi',
  '/master/ekspedisi': '/purchasing/master/m_ekspedisi',
  // ── MARKETING ──
  '/sales-quotation': '/marketing/transaksi/t_sales_quotation',
  '/sq': '/marketing/transaksi/t_sales_quotation',
  '/sales-order': '/marketing/transaksi/t_sales_order',
  '/so': '/marketing/transaksi/t_sales_order',
  '/sales-reservation': '/marketing/transaksi/t_sales_reservation',
  '/reservation': '/marketing/transaksi/t_sales_reservation',
  '/sales-close': '/marketing/transaksi/t_sales_close',
  '/closing-so': '/marketing/transaksi/t_sales_close',
  '/close-so': '/marketing/transaksi/t_sales_close',
  '/so-close': '/marketing/transaksi/t_sales_close',
  '/surat-jalan': '/marketing/transaksi/t_surat_jalan',
  '/sj': '/marketing/transaksi/t_surat_jalan',
  '/delivery-order': '/marketing/transaksi/t_surat_jalan',
  '/sales-invoice': '/marketing/transaksi/t_sales_invoice',
  '/si': '/marketing/transaksi/t_sales_invoice',
  '/sales-return': '/marketing/transaksi/t_sales_return',
  '/master/customers': '/marketing/master/m_customer',
  '/master/customer': '/marketing/master/m_customer',
  '/customer': '/marketing/master/m_customer',
  '/prospek': '/marketing/master/m_prospek',
  '/prospect': '/marketing/master/m_prospek',
  // ── INVENTORY ──
  '/stock-inventory': '/inventory/transaksi/t_stock_opname',
  '/stock-opname': '/inventory/transaksi/t_stock_opname',
  '/opname': '/inventory/transaksi/t_stock_opname',
  '/stock-adjustment': '/inventory/transaksi/t_stock_adj',
  '/stock-adj': '/inventory/transaksi/t_stock_adj',
  '/transfer-gudang': '/inventory/transaksi/t_transfer_gudang',
  '/transfer-warehouse': '/inventory/transaksi/t_transfer_gudang',
  '/sj-gudang': '/inventory/transaksi/t_sj_gudang',
  '/penerimaan-gudang': '/inventory/transaksi/t_penerimaan_gudang',
  '/info-stock': '/inventory/transaksi/stock_gudang',
  '/stock-gudang': '/inventory/transaksi/stock_gudang',
  '/info-stock-2': '/inventory/transaksi/stock_gudang_2',
  '/stock-gudang-2': '/inventory/transaksi/stock_gudang_2',
  '/gudang': '/inventory/master/m_gudang',
  // ── SETUP ──
  '/karyawan': '/setup/m_kary',
  '/kary': '/setup/m_kary',
  '/role': '/setup/m_role',
  '/responsibility': '/setup/m_respo',
  '/respo': '/setup/m_respo',
  '/approval': '/setup/m_approval',
  '/currency': '/setup/m_currency',
  '/unit-bisnis': '/setup/m_unit_bisnis',
  '/item-group': '/setup/m_item_group',
  '/group-item': '/setup/m_item_group',
  '/kendaraan': '/setup/m_kendaraan',
  '/prefix': '/setup/m_prefix',
  '/general': '/setup/m_general',
  '/user': '/setup/user_default',
  // ── ACCOUNTING ──
  '/coa': '/accounting/master/m_coa',
  '/chart-of-account': '/accounting/master/m_coa',
  '/acct/bkk': '/accounting/master/m_coa',
  // ── LEGACY / GENERIC ──
  '/report/sales-trx': '/marketing/transaksi/t_sales_quotation',
  '/transactions/list': '/purchasing/transaksi/t_purchase_order',
}

const executeNavigation = (path?: string, query?: Record<string, any>) => {
  if (!path) return;

  // Koreksi path salah dari backend chatbot
  const correctedPath = pathCorrections[path] ?? path;

  // Navigate dengan query params (untuk auto-search/filter)
  router.push({ path: correctedPath, query: query || {} });

  // Close chatbot setelah navigation
  isOpen.value = false;

  // Info toast jika ada search query
  if (query?.search) {
    setTimeout(() => {
      toast('🔍 Mencari: ' + query.search, {
        description: 'Gunakan filter atau search manual jika tidak ditemukan.'
      });
    }, 300);
  }
};

// ─── LOCAL MENU NAVIGATOR ───────────────────────────────────────────────────
// Intercept "tampilkan menu X" / "buka X" SEBELUM kirim ke backend
// supaya tidak salah interpretasi oleh Python chatbot
interface LocalMenu { name: string; path: string; keywords: string[] }

const localMenus: LocalMenu[] = [
  // SETUP
  { name: 'General', path: '/setup/m_general', keywords: ['general', 'pengaturan', 'pengaturan umum', 'setting', 'konfigurasi'] },
  { name: 'Group Item', path: '/setup/m_item_group', keywords: ['group item', 'item group', 'grup item', 'kategori barang', 'golongan item'] },
  { name: 'Kendaraan', path: '/setup/m_kendaraan', keywords: ['kendaraan', 'mobil', 'armada', 'vehicle'] },
  { name: 'Prefix / Nomor', path: '/setup/m_prefix', keywords: ['prefix', 'nomor', 'penomoran', 'format nomor', 'kode dokumen'] },
  { name: 'Unit Bisnis', path: '/setup/m_unit_bisnis', keywords: ['unit bisnis', 'bisnis', 'cabang', 'divisi'] },
  { name: 'Role', path: '/setup/m_role', keywords: ['role', 'peran', 'hak akses'] },
  { name: 'Responsibility', path: '/setup/m_respo', keywords: ['responsibility', 'respo', 'tanggung jawab', 'permission', 'izin'] },
  { name: 'Karyawan', path: '/setup/m_kary', keywords: ['karyawan', 'kary', 'pegawai', 'staff', 'employee', 'sdm'] },
  { name: 'User', path: '/setup/user_default', keywords: ['user', 'pengguna', 'user default'] },
  { name: 'Approval', path: '/setup/m_approval', keywords: ['approval', 'persetujuan', 'approve', 'otorisasi'] },
  { name: 'Currency', path: '/setup/m_currency', keywords: ['currency', 'mata uang', 'kurs', 'valuta'] },
  // PURCHASING MASTER
  { name: 'Supplier', path: '/purchasing/master/m_supplier', keywords: ['supplier', 'vendor', 'pemasok', 'rekanan'] },
  { name: 'Item / Barang', path: '/inventory/master/m_items', keywords: ['item', 'items', 'barang', 'produk', 'material', 'katalog'] },
  { name: 'Ekspedisi', path: '/purchasing/master/m_ekspedisi', keywords: ['ekspedisi', 'kurir', 'jasa kirim', 'logistik', 'cargo'] },
  // PURCHASING TRANSAKSI
  { name: 'Purchase Request', path: '/purchasing/transaksi/t_purchase_request', keywords: ['purchase request', 'pr', 'permintaan pembelian', 'permintaan barang'] },
  { name: 'Request Close', path: '/purchasing/transaksi/t_purchase_request_close', keywords: ['request close', 'pr close', 'close pr', 'tutup pr', 'purchase request close', 'closing pr'] },
  { name: 'Purchase Order', path: '/purchasing/transaksi/t_purchase_order', keywords: ['purchase order', 'po', 'order pembelian', 'pembelian', 'pesanan'] },
  { name: 'Closing PO', path: '/purchasing/transaksi/t_purchase_order_close', keywords: ['closing po', 'po close', 'close po', 'tutup po', 'purchase order close', 'close purchase order'] },
  { name: 'Penerimaan / LPB', path: '/purchasing/transaksi/t_penerimaan', keywords: ['penerimaan', 'lpb', 'laporan penerimaan barang', 'terima barang', 'goods receipt', 'grn', 'receiving'] },
  { name: 'Purchase Invoice', path: '/purchasing/transaksi/t_purchase_invoice', keywords: ['purchase invoice', 'pi', 'invoice pembelian', 'faktur pembelian', 'tagihan pembelian'] },
  { name: 'Purchase Return', path: '/purchasing/transaksi/t_purchase_return', keywords: ['purchase return', 'retur', 'return pembelian', 'pengembalian barang'] },
  { name: 'RFQ', path: '/purchasing/transaksi/t_rfq', keywords: ['rfq', 'request for quotation', 'permintaan penawaran'] },
  { name: 'Supplier Quotation', path: '/purchasing/transaksi/t_supplier_quotation', keywords: ['supplier quotation', 'sq', 'penawaran supplier', 'quotation supplier'] },
  { name: 'Biaya Kirim', path: '/purchasing/transaksi/t_import_cost', keywords: ['Biaya Kirim', 'biaya import', 'biaya impor', 'impor', 'landed cost'] },
  // INVENTORY
  { name: 'Gudang', path: '/inventory/master/m_gudang', keywords: ['gudang', 'warehouse', 'master gudang'] },
  { name: 'Rak', path: '/inventory/master/m_rak', keywords: ['rak', 'bin', 'shelf', 'lokasi penyimpanan'] },
  { name: 'Stock Opname', path: '/inventory/transaksi/t_stock_opname', keywords: ['stock opname', 'opname', 'so', 'hitung stok', 'fisik stok', 'stock count'] },
  { name: 'Stock Adjustment', path: '/inventory/transaksi/t_stock_adj', keywords: ['stock adjustment', 'adj', 'penyesuaian stok', 'koreksi stok'] },
  { name: 'Transfer Gudang', path: '/inventory/transaksi/t_transfer_gudang', keywords: ['transfer gudang', 'transfer warehouse', 'pindah barang', 'mutasi gudang'] },
  { name: 'Surat Jalan Gudang', path: '/inventory/transaksi/t_sj_gudang', keywords: ['surat jalan gudang', 'sj gudang', 'sj inventory'] },
  { name: 'Penerimaan Gudang', path: '/inventory/transaksi/t_penerimaan_gudang', keywords: ['penerimaan gudang', 'terima gudang', 'receiving gudang'] },
  { name: 'Info Stock', path: '/inventory/transaksi/stock_gudang', keywords: ['info stock', 'stock gudang', 'stok gudang', 'cek stock', 'lihat stock', 'info stok'] },
  { name: 'Info Stock per Item', path: '/inventory/transaksi/stock_gudang_2', keywords: ['info stock per item', 'stock item', 'item stock', 'stok per item', 'lokasi item', 'item location', 'cari item'] },
  // MARKETING
  { name: 'Customer', path: '/marketing/master/m_customer', keywords: ['customer', 'pelanggan', 'konsumen', 'klien', 'pembeli'] },
  { name: 'Prospek', path: '/marketing/master/m_prospek', keywords: ['prospek', 'prospect', 'calon pelanggan', 'leads'] },
  { name: 'Sales Quotation', path: '/marketing/transaksi/t_sales_quotation', keywords: ['sales quotation', 'sq penawaran', 'penawaran penjualan', 'quotation penjualan'] },
  { name: 'Sales Order', path: '/marketing/transaksi/t_sales_order', keywords: ['sales order', 'so', 'order penjualan', 'pesanan penjualan'] },
  { name: 'Sales Reservation', path: '/marketing/transaksi/t_sales_reservation', keywords: ['sales reservation', 'reservasi', 'booking', 'reservation penjualan'] },
  { name: 'Closing SO', path: '/marketing/transaksi/t_sales_close', keywords: ['closing so', 'so close', 'close so', 'tutup so', 'sales close', 'close sales order'] },
  { name: 'Surat Jalan', path: '/marketing/transaksi/t_surat_jalan', keywords: ['surat jalan', 'sj marketing', 'delivery order', 'do', 'pengiriman'] },
  { name: 'Sales Invoice', path: '/marketing/transaksi/t_sales_invoice', keywords: ['sales invoice', 'invoice penjualan', 'faktur penjualan', 'tagihan penjualan'] },
  { name: 'Sales Return', path: '/marketing/transaksi/t_sales_return', keywords: ['sales return', 'return penjualan', 'retur penjualan'] },
  // ACCOUNTING
  { name: 'COA', path: '/accounting/master/m_coa', keywords: ['coa', 'chart of account', 'akun', 'buku besar', 'kode akun'] },
  // DEV
  { name: 'Component', path: '/dev/component', keywords: ['component', 'komponen', 'dev', 'showcase'] },
];

// Pola kalimat navigasi yang dikenal
const NAV_PATTERNS = [
  /^tampilkan\s+menu\s+(.+)$/i,
  /^buka\s+menu\s+(.+)$/i,
  /^ke\s+menu\s+(.+)$/i,
  /^pergi\s+ke\s+menu\s+(.+)$/i,
  /^menu\s+(.+)$/i,
  /^tampilkan\s+(.+)$/i,
  /^buka\s+(.+)$/i,
  /^navigate\s+ke\s+(.+)$/i,
  /^pergi\s+ke\s+(.+)$/i,
  /^open\s+menu\s+(.+)$/i,
  /^show\s+menu\s+(.+)$/i,
  /^lihat\s+menu\s+(.+)$/i,
  /^akses\s+menu\s+(.+)$/i,
];

const tryLocalNavigation = (text: string): LocalMenu | null => {
  const t = text.toLowerCase().trim();
  let query = '';

  for (const pattern of NAV_PATTERNS) {
    const m = t.match(pattern);
    if (m?.[1]) { query = m[1].trim(); break; }
  }

  if (!query) return null;

  const qCompact = query.replace(/\s/g, '');
  let best: LocalMenu | null = null;
  let bestScore = 0;

  for (const menu of localMenus) {
    let score = 0;
    for (const kw of menu.keywords) {
      const k = kw.toLowerCase();
      const kc = k.replace(/\s/g, '');
      if (query === k) { score = Math.max(score, 100); break }
      if (query.includes(k) && k.length >= 2) { score = Math.max(score, 85) }
      if (k.includes(query) && query.length >= 2) { score = Math.max(score, 75) }
      if (qCompact === kc) { score = Math.max(score, 95) }
      if (qCompact.includes(kc) && kc.length >= 2) { score = Math.max(score, 65) }
      if (kc.includes(qCompact) && qCompact.length >= 2) { score = Math.max(score, 55) }
    }
    if (score > bestScore) { bestScore = score; best = menu; }
  }

  return bestScore >= 55 ? best : null;
};

const sendMessage = async (forcedText: string | null = null, selectionId: string | number | null = null) => {
  const text = (forcedText ?? userInput.value).trim();
  if (!text || isTyping.value) return;

  if (text === '/dev') {
    if (forcedText === null) clearInput();
    showDevForm();
    return;
  }

  // ─── LOCAL NAVIGATION INTERCEPTOR ─────────────────────────────────────────
  // Kalau user ketik "tampilkan menu X" / "buka X" dll,
  // langsung navigate tanpa kirim ke backend (hindari salah interpretasi)
  if (!selectionId) {
    const localMatch = tryLocalNavigation(text);
    if (localMatch) {
      pushMessage('user', 'text', text);
      if (forcedText === null) clearInput();
      pushMessage('bot', 'html', `✅ Membuka menu <b>${localMatch.name}</b>...`, { allowFeedback: false });
      setTimeout(() => { executeNavigation(localMatch.path); }, 500);
      return;
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  if (forcedText === null && editTargetId.value) {
    const idx = messages.value.findIndex(m => m.id === editTargetId.value);
    if (idx >= 0) {
      const targetMessage = messages.value[idx];
      if (targetMessage) targetMessage.content = text;
    }
    editTargetId.value = null;
  } else {
    pushMessage('user', 'text', text);
  }

  if (forcedText === null) clearInput();
  isTyping.value = true;
  scrollToBottom();

  try {
    const response = await fetch(ENDPOINTS.CHAT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg: text, session_id: sessionId.value, selection_id: selectionId }),
    });

    const data = await response.json();

    if (data.response?.toLowerCase().includes("layar chat sudah dibersihkan")) {
      clearChat();
      return;
    }

    if (data.type === 'navigation') {
      // Render response sebagai HTML, langsung navigate tanpa button
      pushMessage('bot', 'html', data.response || '✅ Mengarahkan ke menu...', {
        allowFeedback: false
      });

      // Auto-execute navigation langsung (tidak ada button)
      setTimeout(() => {
        executeNavigation(data.nav_path, data.nav_query);
      }, 600);

    } else if (data.type === 'choices' && Array.isArray(data.options)) {

      // Auto-navigate kalau cuma 1 pilihan
      if (data.options.length === 1) {
        const singleChoice = data.options[0];

        pushMessage('bot', 'text', `${data.response || 'Membuka'} <b>${singleChoice.title}</b>...`, {
          allowFeedback: false
        });

        // Kirim choice ke bot untuk proses navigate
        setTimeout(() => {
          sendMessage(singleChoice.title, singleChoice.id);
        }, 400);

      } else {
        // Lebih dari 1 pilihan, tampilin choices
        pushMessage('bot', 'choices', data.response || 'Maksud Anda...', {
          choices: data.options,
          allowFeedback: true,
          lastUserQuery: text
        });
      }

    } else {
      const showForm = !!data.dev_mode && !!data.is_fallback;
      pushMessage('bot', data.type || 'text', data.response || '', {
        allowFeedback: true,
        lastUserQuery: text,
        showDevForm: showForm,
        devForm: showForm ? makeDevForm(data.failed_query || text) : undefined
      });
    }
  } catch (err) {
    pushMessage('bot', 'text', '⚠️ Maaf, server tidak merespon.');
  } finally {
    isTyping.value = false;
    scrollToBottom();
  }
};

const sendChoice = (choice: Choice) => sendMessage(choice.title, choice.id);

const makeDevForm = (q = ''): DevForm => ({
  question: q, keywords: '', type: 'general', answer: '', saving: false, saved: false, error: ''
});

const showDevForm = () => {
  pushMessage('bot', 'text', '🛠️ DEV MODE aktif. Silakan isi form:', {
    showDevForm: true,
    devForm: makeDevForm(),
    allowFeedback: false
  });
};

const submitCustomQA = async (msg: Message) => {
  const f = msg.devForm;
  if (!f) return;
  f.error = ''; f.saved = false; f.saving = true;
  try {
    await fetch(ENDPOINTS.ADD_QA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: f.question, answer: f.answer, keywords: f.keywords, type: f.type })
    });
    f.saved = true;
  } catch (e) {
    f.error = 'Gagal menyimpan.';
  } finally {
    f.saving = false;
  }
};

const sendFeedback = async (type: 'positive' | 'negative', msg: Message) => {
  if (!msg || msg.feedbackSent) return;
  try {
    await fetch(ENDPOINTS.FEEDBACK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, user_query: msg.lastUserQuery, bot_response: msg.content })
    });
    msg.feedbackSent = true;
  } catch (_) { }
};

const initSpeechRecognition = () => {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.log('Browser ini tidak mendukung Web Speech API');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'id-ID';
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  recognition.onstart = () => {
    isListening.value = true;
    userInput.value = '';
    nextTick(() => adjustTextareaHeight());
  };

  recognition.onresult = (event: any) => {
    let finalTranscript = '';
    let interimTranscript = '';
    for (let i = 0; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalTranscript += transcript;
      else interimTranscript += transcript;
    }
    userInput.value = finalTranscript + interimTranscript;
    nextTick(() => adjustTextareaHeight());
  };

  recognition.onerror = (event: any) => {
    isListening.value = false;

    // Only show error for critical issues, ignore no-speech and aborted
    if (event.error !== 'aborted' && event.error !== 'no-speech' && event.error !== 'audio-capture') {
      console.error('Speech recognition error:', event.error);
      toast.error('Gagal mengenali suara', {
        description: 'Pastikan izin mikrofon aktif.'
      });
    }
  };

  recognition.onend = () => {
    isListening.value = false;
    nextTick(() => {
      adjustTextareaHeight();
      textareaRef.value?.focus();
    });
  };
};

const toggleMic = () => {
  if (!recognition) {
    alert('Browser ini tidak mendukung fitur Voice Input.');
    return;
  }
  if (isListening.value) recognition.stop();
  else recognition.start();
};

onMounted(async () => {
  try {
    const res = await fetch(ENDPOINTS.TYPES);
    const data = await res.json();
    if (data.types) availableTypes.value = data.types;
  } catch (_) { }
  initSpeechRecognition();
});
</script>

<template>
  <transition
    enter-active-class="transition ease-out duration-300"
    enter-from-class="opacity-0 translate-y-10 sm:translate-y-5 sm:scale-95"
    enter-to-class="opacity-100 translate-y-0 sm:scale-100"
    leave-active-class="transition ease-in duration-200"
    leave-from-class="opacity-100 translate-y-0 sm:scale-100"
    leave-to-class="opacity-0 translate-y-10 sm:translate-y-5 sm:scale-95"
  >
    <div
      v-if="isOpen"
      class="fixed inset-0 sm:inset-auto sm:right-6 sm:bottom-6 sm:w-[400px] sm:h-[620px] sm:max-h-[85vh] w-full h-[100dvh] bg-card/95 backdrop-blur-2xl sm:rounded-3xl shadow-2xl border-0 sm:border border-border/80 flex flex-col overflow-hidden z-[10000] origin-bottom sm:origin-bottom-right print:hidden"
    >
      
      <div class="bg-gradient-to-r from-primary via-primary/95 to-primary/90 px-5 py-4 text-primary-foreground flex items-center gap-3 shrink-0 shadow-sm z-10">
        <div class="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
          <MessageSquareMore class="w-5 h-5 text-white" />
        </div>
        <div class="flex-1">
          <h3 class="font-bold text-base leading-tight">ERP Assistant</h3>
          <p class="text-xs text-blue-100 opacity-90 flex items-center gap-1">
            <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            Online
          </p>
        </div>
        <button @click="clearChat" class="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-white" title="Bersihkan Chat">
          <Trash2 class="w-5 h-5" />
        </button>
        <button @click="closeChat" class="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-white" title="Tutup">
          <X class="w-5 h-5" />
        </button>
      </div>

      <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
        <div v-for="msg in messages" :key="msg.id" class="flex flex-col max-w-[90%]" :class="msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'">
          
          <div 
            class="relative px-4 py-3 text-sm leading-relaxed shadow-sm group"
            :class="[
              msg.sender === 'user' 
                ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm' 
                : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 rounded-2xl rounded-bl-sm',
              msg.type === 'navigation' ? 'border-l-4 border-l-green-500' : ''
            ]"
          >
            <div v-if="msg.sender === 'user'" class="absolute -left-8 top-1 opacity-0 group-hover:opacity-100 transition">
              <button @click="startEdit(msg)" class="p-1.5 bg-gray-200 dark:bg-gray-600 rounded-full hover:bg-blue-100 hover:text-blue-600 text-gray-500">
                <Pencil class="w-3.5 h-3.5" />
              </button>
            </div>
            <div v-if="msg.sender === 'bot'" class="absolute -right-8 top-1 opacity-0 group-hover:opacity-100 transition">
              <button @click="speak(msg)" class="p-1.5 bg-gray-200 dark:bg-gray-600 rounded-full hover:bg-blue-100 hover:text-blue-600 text-gray-500">
                <Volume2 class="w-3.5 h-3.5" />
              </button>
            </div>

            <template v-if="msg.type === 'navigation'">
              <div v-html="msg.content" class="chatbot-html-content mb-3"></div>
              <button 
                @click="executeNavigation(msg.nav_path, msg.nav_query)"
                class="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors shadow-sm"
              >
                <ExternalLink class="w-4 h-4" />
                Buka Menu Sekarang
              </button>
            </template>
            <template v-else>
              <div v-if="msg.type === 'html' || msg.type === 'choices'" v-html="msg.content" class="chatbot-html-content"></div>
              <div v-else class="whitespace-pre-wrap break-words">{{ msg.content }}</div>
            </template>
          </div>

          <span class="text-[10px] text-gray-400 dark:text-gray-500 mt-1 px-1">
            {{ msg.time }}
          </span>

          <div v-if="msg.actions && msg.actions.length" class="flex flex-wrap gap-2 mt-1">
            <button 
              v-for="(act, idx) in msg.actions" :key="idx" 
              @click="act.onClick"
              class="px-3 py-1.5 text-xs bg-white dark:bg-gray-700 border border-blue-200 dark:border-gray-600 text-blue-600 dark:text-blue-400 rounded-full hover:bg-blue-50 dark:hover:bg-gray-600 transition shadow-sm"
            >
              {{ act.label }}
            </button>
          </div>

          <div v-if="msg.choices && msg.choices.length" class="flex flex-col gap-2 mt-2 max-w-full">
            <button
              v-for="(choice, idx) in msg.choices"
              :key="idx"
              @click="sendChoice(choice)"
              class="px-4 py-2.5 text-xs text-left bg-white dark:bg-gray-700 border border-blue-200 dark:border-gray-600 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-600 hover:border-blue-400 transition shadow-sm hover:shadow-md w-full break-words"
            >
              {{ choice.title }}
            </button>
          </div>

          <div v-if="msg.allowFeedback && !msg.feedbackSent" class="flex gap-2 mt-1">
            <button @click="sendFeedback('positive', msg)" class="p-1 text-gray-400 hover:text-green-500 transition">
              <ThumbsUp class="w-4 h-4"/>
            </button>
            <button @click="sendFeedback('negative', msg)" class="p-1 text-gray-400 hover:text-red-500 transition">
              <ThumbsDown class="w-4 h-4"/>
            </button>
          </div>
          
        </div>

        <div v-if="isTyping" class="flex items-center gap-1 p-3 bg-white dark:bg-gray-700 w-fit rounded-2xl rounded-bl-none shadow-sm border border-gray-100 dark:border-gray-600">
          <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
          <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></span>
          <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></span>
        </div>
      </div>

      <div class="p-3.5 bg-card border-t border-border/80 z-10">
        
        <div v-if="isListening" class="flex items-center justify-center gap-2 text-red-500 text-xs font-semibold mb-2">
            <span class="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce"></span>
            <span class="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style="animation-delay:.15s"></span>
            <span class="w-1.5 h-1.5 bg-red-500 rounded-full animate-bounce" style="animation-delay:.3s"></span>
            <span>Mendengarkan... Silakan bicara.</span>
        </div>

        <div class="flex items-end gap-1.5 bg-muted/40 border border-border/80 rounded-2xl p-1.5 pr-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          
          <textarea
            ref="textareaRef"
            v-model="userInput"
            @input="adjustTextareaHeight"
            @keydown.enter.prevent="sendMessage(null)"
            :placeholder="isListening ? 'Sedang mendengarkan...' : 'Ketik pesan...'"
            rows="1"
            class="flex-1 bg-transparent border-none focus:ring-0 text-sm px-3 py-2.5 max-h-[120px] resize-none dark:text-white placeholder-gray-400"
          ></textarea>
          
          <button
              v-show="userInput.trim().length > 0"
              @click="clearInput()"
              class="mb-1 p-1.5 rounded-full flex-shrink-0 bg-red-100 hover:bg-red-500 text-red-400 hover:text-white transition"
              title="Hapus teks" type="button">
              <X class="w-4 h-4" />
          </button>

          <button
              @click="toggleMic()"
              :class="isListening
                ? 'mb-1 p-2 rounded-full transition flex-shrink-0 bg-red-500 text-white mic-pulse'
                : 'mb-1 p-2 rounded-full transition flex-shrink-0 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-500 hover:text-blue-600'"
              title="Voice Input"
              type="button"
            >
              <Mic class="w-5 h-5" />
          </button>

          <button 
            @click="sendMessage(null)"
            :disabled="!userInput.trim() || isTyping"
            class="mb-1 p-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs flex-shrink-0"
          >
            <Send class="w-5 h-5 ml-0.5" />
          </button>
        </div>
        <div class="text-[10px] text-center text-gray-400 dark:text-gray-500 mt-2">
          AI Assistant dapat membuat kesalahan. Harap verifikasi data sensitif.
        </div>
      </div>
      
    </div>
  </transition>
</template>

<style scoped>
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 20px;
}

@keyframes micPulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
  }

  70% {
    transform: scale(1.1);
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
  }

  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
  }
}

.mic-pulse {
  animation: micPulse 1.5s infinite;
}

.chatbot-html-content {
  line-height: 1.7;
  word-break: break-word;
}

.chatbot-html-content :deep(p) {
  margin: 0 0 0.75rem;
}

.chatbot-html-content :deep(p:last-child) {
  margin-bottom: 0;
}

.chatbot-html-content :deep(br) {
  line-height: 1.7;
}

.chatbot-html-content :deep(hr) {
  margin: 0.9rem 0;
  border: 0;
  border-top: 1px solid #dbeafe;
}

.chatbot-html-content :deep(strong) {
  font-weight: 700;
}

.chatbot-html-content :deep(ul),
.chatbot-html-content :deep(ol) {
  margin: 0.75rem 0;
  padding-left: 1.1rem;
}

.chatbot-html-content :deep(li) {
  margin: 0.3rem 0;
}

.chatbot-html-content :deep(.bot-card) {
  overflow: hidden;
  border: 1px solid #dbeafe;
  border-radius: 1rem;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
}

.chatbot-html-content :deep(.bot-card.warning) {
  border-color: #fcd34d;
  background: linear-gradient(180deg, #fffdf5 0%, #fff7db 100%);
}

.chatbot-html-content :deep(.bot-card .card-header) {
  padding: 0.8rem 1rem;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: #92400e;
  background: rgba(251, 191, 36, 0.18);
  border-bottom: 1px solid rgba(251, 191, 36, 0.3);
}

.chatbot-html-content :deep(.bot-card .card-body) {
  padding: 0.95rem 1rem 1rem;
  color: #1f2937;
}
</style>
