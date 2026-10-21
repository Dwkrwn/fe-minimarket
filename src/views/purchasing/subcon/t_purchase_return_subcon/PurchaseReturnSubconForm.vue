<script setup lang="ts">
import { ref, reactive, onBeforeMount, computed, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FieldX, FieldNumber, FieldPopup, FieldSelect, FieldDate } from '@/components/field'
import { ButtonMultiSelect, DeleteButton } from '@/components/button'
import { ArrowLeft, Save, Loader2 } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { createPurchaseReturnSubcon, updatePurchaseReturnSubcon, getPurchaseReturnSubconById } from './service'
import { getSuratJalanSubconById } from '../t_surat_jalan_subcon/service'
import { getPenerimaanSubconById } from '../t_penerimaan_subcon/service'
import { getPurchaseInvoiceSubconById, getPurchaseInvoiceSubconPopulateByPi } from '../t_purchase_invoice_subcon/service'

const authStore = useAuthStore()
const { API_BASE_URL } = useApi()
const router = useRouter()
const route = useRoute()
const loading = ref(false)
const isInitializing = ref(false)
const isEditMode = computed(() => !!route.params.id && route.name === 'PurchaseReturnSubconForm')
const isViewMode = computed(() => route.name === 'PurchaseReturnSubconView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)

const getDefaultUnitBisnis = () => {
  try {
    const selectRespo = localStorage.getItem('SelectRespo')
    if (!selectRespo) return { id: '', name: '' }
    const parsed = JSON.parse(selectRespo)
    return {
      id: parsed.companyId || parsed.m_unit_bisnis_id || '',
      name: parsed.companyName || parsed.nama_comp || parsed.m_unit_bisnis?.nama_comp || '',
    }
  } catch {
    return { id: '', name: '' }
  }
}

const defaultUnitBisnis = computed(() => getDefaultUnitBisnis())
const isUnitBisnisLocked = computed(() => !!defaultUnitBisnis.value.id)

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Purchase Retur Subcon'
  if (isEditMode.value) return 'Edit Purchase Retur Subcon'
  return 'Tambah Purchase Retur Subcon'
})
const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Purchase Retur Subcon'
  if (isEditMode.value) return 'Perbarui data Purchase Retur Subcon'
  return 'Buat data Purchase Retur Subcon baru'
})

// Tipe retur aktif: PB / PI (SJ retur dinonaktifkan)
const tipeRetur = ref<'SJ' | 'PB' | 'PI'>('PB')

let values = reactive({
  m_unit_bisnis_id: null as string | null,
  tgl_retur: new Date().toISOString().slice(0, 10),
  no_retur_subcon: '',
  m_supplier_id: null as string | null,
  // SJ ref
  t_sj_subcon_id: null as string | null,
  // PB ref
  t_penerimaan_barang_subcon_id: null as string | null,
  // PI ref
  t_purchase_invoice_subcon_id: null as string | null,
  top_id: null as string | null,
  m_currency_id: null as string | null,
  ppn_id: null as string | null,
  pph_id: null as string | null,
  tipe_ppn: '' as string | null,
  tipe_pph: '' as string | null,
  persen_ppn: 0,
  persen_pph: 0,
  catatan: '',
  dpp_lainnya: 0,
  total: 0,
  total_diskon: 0,
  total_ppn: 0,
  total_pph: 0,
  grand_total: 0,
  is_pi_pb: false,
  status: 'DRAFT',
})

const unitBisnisName = ref('')
const supplierName = ref('')
const noSJName = ref('')
const noPBName = ref('')
const noPIName = ref('')
let initialValues: Record<string, any> = {}

const nullableModel = (key: 'm_unit_bisnis_id' | 'm_supplier_id' | 't_penerimaan_barang_subcon_id' | 't_purchase_invoice_subcon_id') => computed<string | number | undefined>({
  get: () => values[key] || undefined,
  set: (value) => {
    values[key] = value ? String(value) : null
  },
})

const unitBisnisModel = nullableModel('m_unit_bisnis_id')
const supplierModel = nullableModel('m_supplier_id')
const pbModel = nullableModel('t_penerimaan_barang_subcon_id')
const piModel = nullableModel('t_purchase_invoice_subcon_id')

// Detail arrays per tipe
const detailSJ = ref<any[]>([])   // detail dari SJ: no_po, kode, nama_item, qty_sj, qty_po, qty_ots, uom, berat_kg, catatan
const detailPB = ref<any[]>([])   // detail dari PB: no_po, tgl_po, kode, nama_item, qty_pb, qty_po, qty_ots, uom, catatan
const detailPI = ref<any[]>([])   // PI Finish Goods
const detailPI2 = ref<any[]>([])  // PI Biaya Jasa
const detailPI3 = ref<any[]>([])  // legacy only, schema retur kirim tidak aktif
const selectedPbItems = ref<any[]>([])
const pbHeaderExcludeIds = computed(() => selectedPbItems.value.map((d: any) => d.id).filter(Boolean))

const errors = reactive({ m_supplier_id: '', tipe_ppn: '', tipe_pph: '' })
const ppnOptions = ['PPN 11%', 'PPN 0%', 'Non PPN']
const pphOptions = ['PPH 23', 'PPH 4(2)', 'Non PPH']

const apiHeaders = computed(() => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${authStore.token}`
}))

const sjParams = computed(() => ({
  searchfield: 'no_sj_subcon',
  filter_column_status: 'POST',
  ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
  ...(values.m_supplier_id ? { filter_column_m_supplier_id: values.m_supplier_id } : {}),
  join: true
}))

const pbParams = computed(() => ({
  searchfield: 'no_penerimaan',
  filter_column_status: 'POST',
  ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
  ...(values.m_supplier_id ? { filter_column_m_supplier_id: values.m_supplier_id } : {}),
  join: true
}))

const piParams = computed(() => ({
  searchfield: 'no_pi_subcon',
  filter_column_status: 'APPROVED',
  ...(values.m_unit_bisnis_id ? { filter_column_m_unit_bisnis_id: values.m_unit_bisnis_id } : {}),
  ...(values.m_supplier_id ? { filter_column_m_supplier_id: values.m_supplier_id } : {}),
  join: true
}))

const applyDefaultUnitBisnis = () => {
  if (!defaultUnitBisnis.value.id) return
  values.m_unit_bisnis_id = defaultUnitBisnis.value.id
  unitBisnisName.value = defaultUnitBisnis.value.name
}

const getArray = (obj: any, keys: string[]) => {
  for (const k of keys) {
    const v = obj?.[k]
    if (Array.isArray(v)) return v
  }
  return []
}

const applyTaxFromSource = (source: any) => {
  values.ppn_id = source?.ppn_id || source?.ppn?.id || null
  values.pph_id = source?.pph_id || source?.pph?.id || null
  values.tipe_ppn = source?.ppn?.value1 || source?.tipe_ppn || ''
  values.tipe_pph = source?.pph?.value1 || source?.tipe_pph || ''
  values.persen_ppn = Number(source?.persen_ppn) || Number(source?.ppn?.value3) || 0
  values.persen_pph = Number(source?.persen_pph) || Number(source?.pph?.value3) || 0
}

const populateSjDetails = (source: any) => {
  const sjDetails = getArray(source, [
    't_sj_subcon_ds',
    't_sj_subcon_d',
    't_surat_jalan_subcon_ds',
    't_surat_jalan_subcon_details',
  ])
  detailSJ.value = sjDetails.map((d: any) => mapSJ({
    ...d,
    no_po: d.t_purchase_order_subcon?.no_po || d.t_purchase_order_subcon_bahan?.no_po || d.no_po,
    kode: d.m_item?.kode_item || d.kode || d.kode_item,
    nama_item: d.m_item?.nama_item || d.nama_item || d.nama_material,
    uom: d.m_general?.value1 || d.uom,
    qty_ots: d.qty_po_ots ?? d.qty_ots,
    berat_kg: d.qty_berat_kg ?? d.berat_kg,
    catatan: d.catatan || '',
  }))
}

const appendPbDetails = (source: any) => {
  const pbJadiDetails = getArray(source, [
    't_penerimaan_barang_subcon_jadis',
    't_penerimaan_barang_subcon_jadi_ds',
  ])
  const pbJasaDetails = getArray(source, [
    't_penerimaan_barang_subcon_jasas',
    't_penerimaan_barang_subcon_jasa_ds',
  ])
  pbJadiDetails.forEach((d: any) => {
    if (detailSJ.value.find((row: any) => row.t_penerimaan_barang_subcon_jadi_id === d.id)) return
    detailSJ.value.push(mapSJ({
      ...d,
      qty_sj: d.qty_diterima,
      qty_pb: d.qty_diterima,
      no_penerimaan: source.no_penerimaan,
      t_penerimaan_barang_subcon: source,
      no_po: d.t_purchase_order_subcon?.no_po || d.no_po,
      kode: d.m_item?.kode_item || d.kode || d.kode_item,
      nama_item: d.m_item?.nama_item || d.nama_item,
      uom: d.m_general?.value1 || d.uom,
    }))
  })
  pbJasaDetails.forEach((d: any) => {
    if (detailPB.value.find((row: any) => row.t_penerimaan_barang_subcon_jasa_id === d.id)) return
    detailPB.value.push(mapPB({
      ...d,
      qty_pb: d.qty_diterima,
      no_penerimaan: source.no_penerimaan,
      t_penerimaan_barang_subcon: source,
      no_po: d.t_purchase_order_subcon?.no_po || d.no_po,
      kode: d.m_item?.kode_item || d.kode || d.kode_item,
      nama_item: d.m_item?.nama_item || d.nama_item,
      uom: d.m_general?.value1 || d.uom,
    }))
  })
}

const populatePbDetails = (source: any) => {
  detailSJ.value = []
  detailPB.value = []
  appendPbDetails(source)
}

const onSelectPbHeaders = async (items: any[]) => {
  for (const item of items) {
    if (!item?.id) continue
    if (!selectedPbItems.value.find((row: any) => row.id === item.id)) {
      selectedPbItems.value.push({
        id: item.id,
        no_penerimaan: item.no_penerimaan,
      })
    }
    let source = item
    const hasDetails =
      getArray(source, ['t_penerimaan_barang_subcon_jadis', 't_penerimaan_barang_subcon_jadi_ds']).length > 0 ||
      getArray(source, ['t_penerimaan_barang_subcon_jasas', 't_penerimaan_barang_subcon_jasa_ds']).length > 0
    if (!hasDetails) {
      const res = await getPenerimaanSubconById(item.id)
      if (res?.status === 'success') source = res.data
    }
    appendPbDetails(source)
  }
}

const populatePiDetails = (source: any) => {
  const piJadiDetails = getArray(source, [
    't_purchase_invoice_subcon_jadis',
    't_purchase_invoice_subcon_jadi',
    't_purchase_invoice_subcon_details',
  ])
  const piJasaDetails = getArray(source, [
    't_purchase_invoice_subcon_jasas',
    't_purchase_invoice_subcon_jasa',
    't_purchase_invoice_subcon_details2',
  ])
  detailPI.value = piJadiDetails.map((d: any) => mapPI({
    ...d,
    no_po: d.t_purchase_order_subcon?.no_po || d.no_po,
    no_penerimaan: d.t_penerimaan_barang_subcon?.no_penerimaan || d.no_penerimaan,
    kode: d.m_item?.kode_item || d.kode || d.kode_item,
    finish_goods: d.m_item?.nama_item || d.finish_goods,
    qty: d.qty || d.qty_pi,
    uom: d.m_general?.value1 || d.uom,
  }))
  detailPI2.value = piJasaDetails.map((d: any) => mapPI2({
    ...d,
    kode: d.m_item?.kode_item || d.kode || d.kode_item,
    material: d.m_item?.nama_item || d.material,
    jasa: d.nama_jasa || d.jasa,
    qty: d.qty || d.qty_pi,
    qty_biaya: d.qty_biaya || d.qty_jasa || d.qty || d.qty_pi,
    uom: d.m_general?.value1 || d.uom,
  }))
  detailPI3.value = []
}

const enrichPiReturDisplayFields = (source: any) => {
  const piJadiDetails = getArray(source, [
    't_purchase_invoice_subcon_jadis',
    't_purchase_invoice_subcon_jadi',
    't_purchase_invoice_subcon_details',
  ])
  const piJasaDetails = getArray(source, [
    't_purchase_invoice_subcon_jasas',
    't_purchase_invoice_subcon_jasa',
    't_purchase_invoice_subcon_details2',
  ])

  const jadiMap = new Map<any, any>(piJadiDetails.map((d: any) => [d.id, d]))
  const jasaMap = new Map<any, any>(piJasaDetails.map((d: any) => [d.id, d]))
  console.log('[Retur PI Enrich] source summary', {
    jadiCount: piJadiDetails.length,
    jasaCount: piJasaDetails.length,
    jadiIds: piJadiDetails.map((d: any) => d?.id),
    jasaIds: piJasaDetails.map((d: any) => d?.id),
  })

  detailPI.value = detailPI.value.map((row: any) => {
    const lookupKey =
      row.t_purchase_invoice_subcon_jadi_id ||
      row.t_purchase_invoice_subcon_jadi_i ||
      row.t_purchase_invoice_subcon_detail_id
    const src = jadiMap.get(
      row.t_purchase_invoice_subcon_jadi_id ||
      row.t_purchase_invoice_subcon_jadi_i ||
      row.t_purchase_invoice_subcon_detail_id
    )
    console.log('[Retur PI Enrich] FG match', {
      rowId: row.id,
      lookupKey,
      found: !!src,
      rowKeys: {
        t_purchase_invoice_subcon_jadi_id: row.t_purchase_invoice_subcon_jadi_id,
        t_purchase_invoice_subcon_jadi_i: row.t_purchase_invoice_subcon_jadi_i,
        t_purchase_invoice_subcon_detail_id: row.t_purchase_invoice_subcon_detail_id,
      },
      rowDisplayBefore: {
        no_po: row.no_po,
        no_penerimaan: row.no_penerimaan,
        kode: row.kode,
        finish_goods: row.finish_goods,
        uom: row.uom,
      }
    })
    if (!src) return row
    const merged = mapPI({
      ...src,
      qty_retur: row.qty_retur,
      harga: row.harga,
      qty_pb: row.qty_pb,
      qty_pi: row.qty_pi,
      catatan: row.catatan,
      t_purchase_invoice_subcon_jadi_id:
        row.t_purchase_invoice_subcon_jadi_id || row.t_purchase_invoice_subcon_jadi_i || src.id,
      t_purchase_invoice_subcon_detail_id:
        row.t_purchase_invoice_subcon_detail_id || row.id || null,
    })
    console.log('[Retur PI Enrich] FG merged', {
      rowId: row.id,
      lookupKey,
      mergedDisplay: {
        no_po: merged.no_po,
        no_penerimaan: merged.no_penerimaan,
        kode: merged.kode,
        finish_goods: merged.finish_goods,
        uom: merged.uom,
      }
    })
    return {
      ...row,
      no_po: merged.no_po,
      no_penerimaan: merged.no_penerimaan,
      kode: merged.kode,
      finish_goods: merged.finish_goods,
      uom: merged.uom,
    }
  })

  detailPI2.value = detailPI2.value.map((row: any) => {
    const lookupKey =
      row.t_purchase_invoice_subcon_jasa_id ||
      row.t_purchase_invoice_subcon_jasa_i ||
      row.t_purchase_invoice_subcon_detail2_id
    const src = jasaMap.get(
      row.t_purchase_invoice_subcon_jasa_id ||
      row.t_purchase_invoice_subcon_jasa_i ||
      row.t_purchase_invoice_subcon_detail2_id
    )
    console.log('[Retur PI Enrich] Jasa match', {
      rowId: row.id,
      lookupKey,
      found: !!src,
      rowKeys: {
        t_purchase_invoice_subcon_jasa_id: row.t_purchase_invoice_subcon_jasa_id,
        t_purchase_invoice_subcon_jasa_i: row.t_purchase_invoice_subcon_jasa_i,
        t_purchase_invoice_subcon_detail2_id: row.t_purchase_invoice_subcon_detail2_id,
      },
      rowDisplayBefore: {
        no_po: row.no_po,
        no_penerimaan: row.no_penerimaan,
        kode: row.kode,
        material: row.material,
        finish_goods: row.finish_goods,
        jasa: row.jasa,
        uom: row.uom,
      }
    })
    if (!src) return row
    const merged = mapPI2({
      ...src,
      qty_retur: row.qty_retur,
      harga: row.harga,
      qty_pb: row.qty_pb,
      qty_pi: row.qty_pi,
      catatan: row.catatan,
      subtotal: row.subtotal,
      t_purchase_invoice_subcon_jasa_id:
        row.t_purchase_invoice_subcon_jasa_id || row.t_purchase_invoice_subcon_jasa_i || src.id,
      t_purchase_invoice_subcon_detail2_id:
        row.t_purchase_invoice_subcon_detail2_id || row.id || null,
    })
    console.log('[Retur PI Enrich] Jasa merged', {
      rowId: row.id,
      lookupKey,
      mergedDisplay: {
        no_po: merged.no_po,
        no_penerimaan: merged.no_penerimaan,
        kode: merged.kode,
        material: merged.material,
        finish_goods: merged.finish_goods,
        jasa: merged.jasa,
        uom: merged.uom,
      }
    })
    return {
      ...row,
      no_po: merged.no_po,
      no_penerimaan: merged.no_penerimaan,
      kode: merged.kode,
      material: merged.material,
      finish_goods: merged.finish_goods,
      jasa: merged.jasa,
      uom: merged.uom,
    }
  })
}

const handleSjSelect = async (item: any) => {
  if (!item) {
    values.t_sj_subcon_id = null
    noSJName.value = ''
    detailSJ.value = []
    return
  }
  values.t_sj_subcon_id = item.id || null
  noSJName.value = item.no_sj_subcon || ''
  values.m_unit_bisnis_id = item.m_unit_bisnis_id || item.m_unit_bisni?.id || null
  values.m_supplier_id = item.m_supplier_id || item.m_supplier?.id || null
  unitBisnisName.value = item.m_unit_bisni?.nama_comp || ''
  supplierName.value = item.m_supplier?.nama_supp || ''
  applyTaxFromSource(item)
  populateSjDetails(item)
  if (detailSJ.value.length > 0) return
  try {
    const res = await getSuratJalanSubconById(item.id)
    if (res?.status === 'success') {
      applyTaxFromSource(res.data)
      populateSjDetails(res.data)
    }
  } catch {
    toast.error('Gagal memuat detail SJ')
  }
}

const handlePbSelect = async (item: any) => {
  if (!item) {
    values.t_penerimaan_barang_subcon_id = null
    noPBName.value = ''
    detailPB.value = []
    detailSJ.value = []
    return
  }
  values.t_penerimaan_barang_subcon_id = item.id || null
  noPBName.value = item.no_penerimaan || ''
  values.m_unit_bisnis_id = item.m_unit_bisnis_id || item.m_unit_bisni?.id || null
  values.m_supplier_id = item.m_supplier_id || item.m_supplier?.id || null
  unitBisnisName.value = item.m_unit_bisni?.nama_comp || ''
  supplierName.value = item.m_supplier?.nama_supp || ''
  applyTaxFromSource(item)
  populatePbDetails(item)
  if (detailSJ.value.length > 0 || detailPB.value.length > 0) return
  try {
    const res = await getPenerimaanSubconById(item.id)
    if (res?.status === 'success') {
      applyTaxFromSource(res.data)
      populatePbDetails(res.data)
    }
  } catch {
    toast.error('Gagal memuat detail penerimaan')
  }
}

const handlePiSelect = async (item: any) => {
  if (!item) {
    values.t_purchase_invoice_subcon_id = null
    noPIName.value = ''
    detailPI.value = []
    detailPI2.value = []
    detailPI3.value = []
    return
  }
  values.t_purchase_invoice_subcon_id = item.id || null
  noPIName.value = item.no_pi_subcon || ''
  values.m_unit_bisnis_id = item.m_unit_bisnis_id || item.m_unit_bisni?.id || null
  values.m_supplier_id = item.m_supplier_id || item.m_supplier?.id || null
  values.t_penerimaan_barang_subcon_id = item.t_penerimaan_id || item.t_penerimaan_barang_subcon?.id || null
  values.top_id = item.top_id || item.top?.id || null
  values.m_currency_id = item.m_supplier?.m_currency_id || null
  unitBisnisName.value = item.m_unit_bisni?.nama_comp || ''
  supplierName.value = item.m_supplier?.nama_supp || ''
  applyTaxFromSource(item)
  populatePiDetails(item)
  if (detailPI.value.length > 0 || detailPI2.value.length > 0 || detailPI3.value.length > 0) return
  try {
    const res = await getPurchaseInvoiceSubconPopulateByPi(item.id)
    if (res?.status === 'success') {
      applyTaxFromSource(res.data)
      populatePiDetails(res.data)
    }
  } catch {
    toast.error('Gagal memuat detail PI')
  }
}

// Detail SJ methods
const removeSJ = (i: number) => { detailSJ.value.splice(i, 1); toast.info('Detail dihapus') }
const mapSJ = (item: any) => ({
  t_surat_jalan_subcon_detail_id: item.t_surat_jalan_subcon_detail_id || null,
  t_penerimaan_barang_subcon_jadi_id:
    item.t_penerimaan_barang_subcon_jadi_id ||
    item.t_penerimaan_barang_subcon_jadi_ ||
    (item.t_purchase_return_subcon_id ? null : item.id) ||
    null,
  t_penerimaan_barang_subcon_id:
    item.t_penerimaan_barang_subcon_id ||
    item.t_penerimaan_barang_subcon?.id ||
    null,
  t_purchase_invoice_subcon_jadi_id: null,
  m_items_id: item.m_items_id || null,
  rak_d_id: item.rak_d_id || null,
  uom_id: item.uom_id || item.m_uom_id || null,
  qty_retur: Number(item.qty_retur) || 0,
  qty_pb: Number(item.qty_pb) || Number(item.qty_sj) || Number(item.qty_diterima) || 0,
  qty_pi: Number(item.qty_pi) || 0,
  harga: Number(item.harga) || 0,
  alasan: item.alasan || null,
  r_disc1: Number(item.r_disc1) || 0,
  r_disc2: Number(item.r_disc2) || 0,
  r_disc3: Number(item.r_disc3) || 0,
  disc_amt: Number(item.disc_amt) || 0,
  total_diskon: Number(item.total_diskon) || 0,
  subtotal: Number(item.subtotal) || 0,
  ppn_amt: Number(item.ppn_amt) || 0,
  pph_amt: Number(item.pph_amt) || 0,
  ppn_id: item.ppn_id || null,
  pph_id: item.pph_id || null,
  grand_total: Number(item.grand_total) || 0,
  no_po: item.no_po || item.t_purchase_order_subcon?.no_po || item.t_purchase_order_subcon_jadi?.t_purchase_order_subcon?.no_po || item.t_purchase_order_subcon_bahan?.no_po || item.no_t_purchase_order_subcon || '-',
  no_penerimaan: item.no_penerimaan || item.t_penerimaan_barang_subcon?.no_penerimaan || '-',
  kode: item.kode || item.kode_item || item.m_item?.kode_item || item.m_items?.kode_item || '-',
  nama_item: item.nama_item || item.nama_material || item.m_item?.nama_item || item.m_items?.nama_item || '-',
  qty_sj: Number(item.qty_sj) || 0,
  qty_po: Number(item.qty_po) || Number(item.qty) || Number(item.qty_diterima) || 0,
  qty_ots: Number(item.qty_ots ?? item.qty_po_ots) || 0,
  uom: item.uom || item.m_general?.value1 || '-',
  berat_kg: Number(item.berat_kg ?? item.qty_berat_kg) || 0,
  catatan: item.catatan || '',
})

// Detail PB methods
const removePB = (i: number) => { detailPB.value.splice(i, 1); toast.info('Detail dihapus') }
const mapPB = (item: any) => ({
  t_penerimaan_subcon_detail_id: item.t_penerimaan_subcon_detail_id || null,
  t_penerimaan_barang_subcon_jasa_id:
    item.t_penerimaan_barang_subcon_jasa_id ||
    item.t_penerimaan_barang_subcon_jasa_ ||
    (item.t_purchase_return_subcon_id ? null : item.id) ||
    null,
  t_penerimaan_barang_subcon_id:
    item.t_penerimaan_barang_subcon_id ||
    item.t_penerimaan_barang_subcon?.id ||
    null,
  t_purchase_invoice_subcon_jasa_id: null,
  m_items_id: item.m_items_id || null,
  rak_d_id: item.rak_d_id || null,
  uom_id: item.uom_id || null,
  qty_retur: Number(item.qty_retur) || 0,
  qty_pb: Number(item.qty_pb) || Number(item.qty_diterima) || 0,
  qty_pi: Number(item.qty_pi) || 0,
  r_disc1: Number(item.r_disc1) || 0,
  r_disc2: Number(item.r_disc2) || 0,
  r_disc3: Number(item.r_disc3) || 0,
  alasan: item.alasan || null,
  disc_amt: Number(item.disc_amt) || 0,
  total_diskon: Number(item.total_diskon) || 0,
  subtotal: Number(item.subtotal) || 0,
  ppn_amt: Number(item.ppn_amt) || 0,
  pph_amt: Number(item.pph_amt) || 0,
  ppn_id: item.ppn_id || null,
  pph_id: item.pph_id || null,
  grand_total: Number(item.grand_total) || 0,
  harga: Number(item.harga) || Number(item.t_purchase_order_subcon_jasa?.harga) || 0,
  no_po: item.no_po || item.t_purchase_order_subcon?.no_po || item.t_purchase_order_subcon_jasa?.t_purchase_order_subcon?.no_po || '-',
  no_penerimaan: item.no_penerimaan || item.t_penerimaan_barang_subcon?.no_penerimaan || '-',
  tgl_po: item.tgl_po || item.t_purchase_order_subcon?.tgl_po || item.t_purchase_order_subcon_jasa?.t_purchase_order_subcon?.tgl_po || '',
  kode: item.kode || item.kode_item || item.m_item?.kode_item || item.m_items?.kode_item || '-',
  nama_item: item.nama_item || item.m_item?.nama_item || item.m_items?.nama_item || item.jasa || '-',
  uom: item.uom || item.m_general?.value1 || '-',
  catatan: item.catatan || '',
})

const fetchPbDetail = async (type: 'jadi' | 'jasa', id: string) => {
  const endpoint = type === 'jadi' ? 't_penerimaan_barang_subcon_jadi' : 't_penerimaan_barang_subcon_jasa'
  const include = type === 'jadi'
    ? 't_purchase_order_subcon_jadi>t_purchase_order_subcon,m_items,m_general,t_penerimaan_barang_subcon'
    : 't_purchase_order_subcon_jasa>t_purchase_order_subcon,m_items,m_general,t_penerimaan_barang_subcon'
  try {
    console.log('[Retur PB Enrich] fetch detail', { type, id, endpoint, include })
    const params = new URLSearchParams({ include })
    const response = await fetch(`${API_BASE_URL}/dynamic/${endpoint}/${id}?${params}`, { headers: apiHeaders.value })
    if (!response.ok) {
      console.log('[Retur PB Enrich] fetch failed', { type, id, status: response.status })
      return null
    }
    const payload = await response.json()
    console.log('[Retur PB Enrich] fetch success', { type, id, data: payload?.data })
    return payload?.data || null
  } catch (error) {
    console.log('[Retur PB Enrich] fetch error', { type, id, error })
    return null
  }
}

const enrichPbReturDisplayFields = async () => {
  console.log('[Retur PB Enrich] start', {
    fgCount: detailSJ.value.length,
    jasaCount: detailPB.value.length,
    fgRows: detailSJ.value.map((row: any) => ({
      id: row.id,
      t_penerimaan_barang_subcon_jadi_id: row.t_penerimaan_barang_subcon_jadi_id,
      no_penerimaan: row.no_penerimaan,
      no_po: row.no_po,
      kode: row.kode,
      nama_item: row.nama_item,
      uom: row.uom,
    })),
    jasaRows: detailPB.value.map((row: any) => ({
      id: row.id,
      t_penerimaan_barang_subcon_jasa_id: row.t_penerimaan_barang_subcon_jasa_id,
      no_penerimaan: row.no_penerimaan,
      no_po: row.no_po,
      kode: row.kode,
      nama_item: row.nama_item,
      uom: row.uom,
    })),
  })

  detailSJ.value = await Promise.all(detailSJ.value.map(async (row: any) => {
    const pbDetailId = row.t_penerimaan_barang_subcon_jadi_id
    if (!pbDetailId) {
      console.log('[Retur PB Enrich] FG skip no FK', { row })
      return row
    }
    const src = await fetchPbDetail('jadi', pbDetailId)
    if (!src) return row
    const merged = mapSJ({
      ...src,
      qty_retur: row.qty_retur,
      qty_pb: row.qty_pb || src.qty_diterima,
      qty_pi: row.qty_pi,
      harga: row.harga,
      catatan: row.catatan,
    })
    console.log('[Retur PB Enrich] FG merged', {
      pbDetailId,
      before: { no_penerimaan: row.no_penerimaan, no_po: row.no_po, kode: row.kode, nama_item: row.nama_item, uom: row.uom },
      after: { no_penerimaan: merged.no_penerimaan, no_po: merged.no_po, kode: merged.kode, nama_item: merged.nama_item, uom: merged.uom },
    })
    return { ...row, ...merged }
  }))

  detailPB.value = await Promise.all(detailPB.value.map(async (row: any) => {
    const pbDetailId = row.t_penerimaan_barang_subcon_jasa_id
    if (!pbDetailId) {
      console.log('[Retur PB Enrich] Jasa skip no FK', { row })
      return row
    }
    const src = await fetchPbDetail('jasa', pbDetailId)
    if (!src) return row
    const merged = mapPB({
      ...src,
      qty_retur: row.qty_retur,
      qty_pb: row.qty_pb || src.qty_diterima,
      qty_pi: row.qty_pi,
      harga: row.harga,
      catatan: row.catatan,
    })
    console.log('[Retur PB Enrich] Jasa merged', {
      pbDetailId,
      before: { no_penerimaan: row.no_penerimaan, no_po: row.no_po, kode: row.kode, nama_item: row.nama_item, uom: row.uom },
      after: { no_penerimaan: merged.no_penerimaan, no_po: merged.no_po, kode: merged.kode, nama_item: merged.nama_item, uom: merged.uom },
    })
    return { ...row, ...merged }
  }))
}

// Detail PI methods
const removePI = (i: number) => { detailPI.value.splice(i, 1); toast.info('Detail dihapus') }
const removePI2 = (i: number) => { detailPI2.value.splice(i, 1); toast.info('Detail dihapus') }
const removePI3 = (i: number) => { detailPI3.value.splice(i, 1); toast.info('Detail dihapus') }
const getNetto = (d: any) => (Number(d.qty_retur) || 0) * (Number(d.harga) || 0)
const getTotal2 = (d: any) => (Number(d.qty_retur) || 0) * (Number(d.harga ?? d.biaya_unit) || 0)
const getTotal3 = (d: any) => (Number(d.qty_kirim) || 0) * (Number(d.biaya_kirim) || 0)
const dppCalc = computed(() => (
  detailSJ.value.reduce((s, d) => s + getNetto(d), 0) +
  detailPB.value.reduce((s, d) => s + getTotal2(d), 0) +
  detailPI.value.reduce((s, d) => s + getNetto(d), 0) +
  detailPI2.value.reduce((s, d) => s + getTotal2(d), 0)
))
const ppnCalc = computed(() => dppCalc.value * (Number(values.persen_ppn) || 0) / 100)
const pphCalc = computed(() => dppCalc.value * (Number(values.persen_pph) || 0) / 100)
const grandTotalCalc = computed(() => dppCalc.value + ppnCalc.value - pphCalc.value)
const mapPI = (item: any) => ({
  t_purchase_invoice_subcon_detail_id: item.id || null,
  t_penerimaan_barang_subcon_jadi_id: item.t_penerimaan_barang_subcon_jadi_id || item.t_penerimaan_barang_subcon_jadi_ || null,
  t_purchase_invoice_subcon_jadi_id: item.t_purchase_invoice_subcon_jadi_id || item.t_purchase_invoice_subcon_jadi_i || item.id || null,
  m_items_id: item.m_items_id || null,
  rak_d_id: item.rak_d_id || null,
  uom_id: item.uom_id || null,
  qty_retur: Number(item.qty_retur) || 0,
  qty_pb: Number(item.qty_pb) || 0,
  qty_pi: Number(item.qty_pi) || Number(item.qty) || 0,
  harga: Number(item.harga) || Number(item.t_purchase_order_subcon_jadi?.harga) || 0,
  alasan: item.alasan || null,
  r_disc1: Number(item.r_disc1) || 0,
  r_disc2: Number(item.r_disc2) || 0,
  r_disc3: Number(item.r_disc3) || 0,
  disc_amt: Number(item.disc_amt) || 0,
  total_diskon: Number(item.total_diskon) || 0,
  subtotal: Number(item.subtotal) || 0,
  ppn_amt: Number(item.ppn_amt) || 0,
  pph_amt: Number(item.pph_amt) || 0,
  ppn_id: item.ppn_id || null,
  pph_id: item.pph_id || null,
  grand_total: Number(item.grand_total) || 0,
  no_po:
    item.no_po ||
    item.t_purchase_order_subcon?.no_po ||
    item.t_purchase_invoice_subcon_jadi?.t_purchase_order_subcon?.no_po ||
    item.t_purchase_invoice_subcon_jadi?.t_purchase_order_subcon?.no_po ||
    item.t_penerimaan_barang_subcon_jadi?.t_purchase_order_subcon_jadi?.t_purchase_order_subcon?.no_po ||
    '-',
  no_penerimaan:
    item.no_penerimaan ||
    item.no_p ||
    item.no_t_penerimaan_subcon ||
    item.t_penerimaan_barang_subcon?.no_penerimaan ||
    item.t_penerimaan_barang_subcon?.no_p ||
    item.t_penerimaan_barang_subcon?.no_t_penerimaan_subcon ||
    item.t_purchase_invoice_subcon_jadi?.t_penerimaan_barang_subcon?.no_penerimaan ||
    item.t_purchase_invoice_subcon_jadi?.t_penerimaan_barang_subcon?.no_p ||
    item.t_purchase_invoice_subcon_jadi?.t_penerimaan_barang_subcon?.no_t_penerimaan_subcon ||
    item.t_penerimaan_barang_subcon_jadi?.t_penerimaan_barang_subcon?.no_penerimaan ||
    item.t_penerimaan_barang_subcon_jadi?.t_penerimaan_barang_subcon?.no_p ||
    item.t_penerimaan_barang_subcon_jadi?.t_penerimaan_barang_subcon?.no_t_penerimaan_subcon ||
    '-',
  kode: item.kode || item.kode_item || item.m_item?.kode_item || item.m_items?.kode_item || '-',
  finish_goods:
    item.finish_goods ||
    item.nama_item ||
    item.m_item?.nama_item ||
    item.m_items?.nama_item ||
    item.t_purchase_invoice_subcon_jadi?.m_item?.nama_item ||
    item.t_purchase_invoice_subcon_jadi?.m_items?.nama_item ||
    '-',
  qty: Number(item.qty) || Number(item.qty_pi) || 0,
  uom:
    item.uom ||
    item.m_general?.value1 ||
    item.t_purchase_invoice_subcon_jadi?.m_general?.value1 ||
    '-',
  catatan: '',
})
const mapPI2 = (item: any) => ({
  t_purchase_invoice_subcon_detail2_id: item.id || null,
  t_penerimaan_barang_subcon_jasa_id: item.t_penerimaan_barang_subcon_jasa_id || item.t_penerimaan_barang_subcon_jasa_ || null,
  t_purchase_invoice_subcon_jasa_id: item.t_purchase_invoice_subcon_jasa_id || item.t_purchase_invoice_subcon_jasa_i || item.id || null,
  m_items_id: item.m_items_id || null,
  rak_d_id: item.rak_d_id || null,
  uom_id: item.uom_id || null,
  qty_retur: Number(item.qty_retur) || 0,
  qty_pb: Number(item.qty_pb) || 0,
  qty_pi: Number(item.qty_pi) || Number(item.qty_jasa) || Number(item.qty) || 0,
  r_disc1: Number(item.r_disc1) || 0,
  r_disc2: Number(item.r_disc2) || 0,
  r_disc3: Number(item.r_disc3) || 0,
  alasan: item.alasan || null,
  disc_amt: Number(item.disc_amt) || 0,
  total_diskon: Number(item.total_diskon) || 0,
  subtotal: Number(item.subtotal) || 0,
  ppn_amt: Number(item.ppn_amt) || 0,
  pph_amt: Number(item.pph_amt) || 0,
  ppn_id: item.ppn_id || null,
  pph_id: item.pph_id || null,
  grand_total: Number(item.grand_total) || 0,
  harga: Number(item.harga) || Number(item.biaya_unit) || 0,
  no_po:
    item.no_po ||
    item.t_purchase_order_subcon?.no_po ||
    item.t_purchase_invoice_subcon_jasa?.t_purchase_order_subcon?.no_po ||
    item.t_penerimaan_barang_subcon_jasa?.t_purchase_order_subcon_jasa?.t_purchase_order_subcon?.no_po ||
    '-',
  no_penerimaan:
    item.no_penerimaan ||
    item.no_p ||
    item.no_t_penerimaan_subcon ||
    item.t_penerimaan_barang_subcon?.no_penerimaan ||
    item.t_penerimaan_barang_subcon?.no_p ||
    item.t_penerimaan_barang_subcon?.no_t_penerimaan_subcon ||
    item.t_purchase_invoice_subcon_jasa?.t_penerimaan_barang_subcon?.no_penerimaan ||
    item.t_purchase_invoice_subcon_jasa?.t_penerimaan_barang_subcon?.no_p ||
    item.t_purchase_invoice_subcon_jasa?.t_penerimaan_barang_subcon?.no_t_penerimaan_subcon ||
    item.t_penerimaan_barang_subcon_jasa?.t_penerimaan_barang_subcon?.no_penerimaan ||
    item.t_penerimaan_barang_subcon_jasa?.t_penerimaan_barang_subcon?.no_p ||
    item.t_penerimaan_barang_subcon_jasa?.t_penerimaan_barang_subcon?.no_t_penerimaan_subcon ||
    '-',
  kode: item.kode || item.kode_item || item.m_item?.kode_item || item.m_items?.kode_item || '-',
  material:
    item.material ||
    item.nama_item ||
    item.m_item?.nama_item ||
    item.m_items?.nama_item ||
    item.t_purchase_invoice_subcon_jasa?.m_item?.nama_item ||
    item.t_purchase_invoice_subcon_jasa?.m_items?.nama_item ||
    '-',
  finish_goods: item.finish_goods || '-',
  jasa: item.jasa || '-',
  qty: Number(item.qty) || Number(item.qty_jasa) || Number(item.qty_pi) || 0,
  qty_biaya: Number(item.qty_biaya) || Number(item.qty_jasa) || Number(item.qty) || Number(item.qty_pi) || 0,
  uom:
    item.uom ||
    item.m_general?.value1 ||
    item.t_purchase_invoice_subcon_jasa?.m_general?.value1 ||
    '-',
  biaya_unit: Number(item.biaya_unit) || Number(item.harga) || 0,
  catatan: '',
})
const mapPI3 = (item: any) => ({
  t_purchase_invoice_subcon_detail3_id: item.id,
  kode: item.kode || '-',
  barang: item.barang || '-',
  ekspedisi: item.ekspedisi || '-',
  qty_konversi: Number(item.qty_konversi) || 0,
  qty_kirim: Number(item.qty_kirim) || 0,
  uom: item.uom || '-',
  biaya_kirim: Number(item.biaya_kirim) || 0,
  catatan: '',
})

const formatNum = (n: number) => n.toLocaleString('id-ID')
const formatDate = (d: string) => d ? new Date(d).toLocaleDateString('id-ID') : '-'

const onReset = () => {
  Object.assign(values, {
    m_unit_bisnis_id: null, tgl_retur: new Date().toISOString().slice(0, 10),
    no_retur_subcon: '', m_supplier_id: null,
    t_sj_subcon_id: null, t_penerimaan_barang_subcon_id: null, t_purchase_invoice_subcon_id: null,
    top_id: null, m_currency_id: null, ppn_id: null, pph_id: null, tipe_ppn: '', tipe_pph: '', persen_ppn: 0, persen_pph: 0,
    catatan: '', dpp_lainnya: 0, total: 0, total_diskon: 0, total_ppn: 0, total_pph: 0, grand_total: 0, is_pi_pb: false, status: 'DRAFT',
  })
  unitBisnisName.value = ''; supplierName.value = ''; noSJName.value = ''; noPBName.value = ''; noPIName.value = ''
  Object.keys(errors).forEach(k => { errors[k as keyof typeof errors] = '' })
  detailSJ.value = []; detailPB.value = []; detailPI.value = []; detailPI2.value = []; detailPI3.value = []
  selectedPbItems.value = []
  applyDefaultUnitBisnis()
}

onBeforeMount(async () => {
  isInitializing.value = true
  onReset()
  const isCopyModeLocal = route.query.action === 'copy' && route.query.source
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value
  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    isInitializing.value = false
    return
  }
  loading.value = true
  try {
    const res = await getPurchaseReturnSubconById(sourceId)
    if (res.status !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data
    if (initialValues.tipe_retur) {
      tipeRetur.value = initialValues.tipe_retur === 'SJ' ? 'PB' : initialValues.tipe_retur
    } else if (initialValues.is_pi_pb === true || initialValues.t_purchase_invoice_subcon_id) {
      tipeRetur.value = 'PI'
    } else if (initialValues.t_penerimaan_barang_subcon_id) {
      tipeRetur.value = 'PB'
    } else {
      tipeRetur.value = 'PB'
    }

    const returJadis = getArray(initialValues, [
      't_purchase_return_subcon_jadis',
      't_purchase_return_subcon_jadi',
      't_purchase_return_subcon_details',
      't_purchase_return_subcon_details3',
    ])
    const returJasas = getArray(initialValues, [
      't_purchase_return_subcon_jasas',
      't_purchase_return_subcon_jasa',
      't_purchase_return_subcon_details2',
      't_purchase_return_subcon_details4',
    ])
    const returKirim = getArray(initialValues, [
      't_purchase_return_subcon_details5',
    ])
    const hasExistingReturDetails = returJadis.length > 0 || returJasas.length > 0 || returKirim.length > 0

    if (returJadis.length > 0) {
      if (tipeRetur.value === 'PI') detailPI.value = returJadis.map((d: any) => mapPI(d))
      else detailSJ.value = returJadis.map((d: any) => mapSJ(d))
    }
    if (returJasas.length > 0) {
      if (tipeRetur.value === 'PI') detailPI2.value = returJasas.map((d: any) => mapPI2(d))
      else detailPB.value = returJasas.map((d: any) => mapPB(d))
    }
    if (returKirim.length > 0) detailPI3.value = returKirim
    if (isCopyModeLocal) { delete (initialValues as any).id; delete (initialValues as any).createdAt; delete (initialValues as any).updatedAt; delete (initialValues as any).no_retur_subcon; delete (initialValues as any).no_t_purchase_return_subcon }
    for (const k in initialValues) { if (Object.prototype.hasOwnProperty.call(values, k)) (values as any)[k] = initialValues[k] }
    // pastikan foreign key referensi terisi walau response pakai alias relasi baru
    values.t_purchase_invoice_subcon_id =
      values.t_purchase_invoice_subcon_id ||
      initialValues.pi_sc?.id ||
      initialValues.t_purchase_invoice_subcon?.id ||
      initialValues.t_purchase_invoice_subcon_id ||
      null
    values.t_penerimaan_barang_subcon_id =
      values.t_penerimaan_barang_subcon_id ||
      initialValues.pb_sc?.id ||
      initialValues.t_penerimaan_barang_subcon?.id ||
      initialValues.t_penerimaan_barang_subcon_id ||
      null
    if (initialValues.m_unit_bisni || initialValues.m_unit_bisnis) {
      const unit = initialValues.m_unit_bisni || initialValues.m_unit_bisnis
      unitBisnisName.value = unit.nama_comp || unit.nama || ''
    }
    if (initialValues.m_supplier) supplierName.value = initialValues.m_supplier.nama_supp || initialValues.m_supplier.nama || ''
    if (initialValues.t_sj_subcon || initialValues.sj_sc) noSJName.value = (initialValues.t_sj_subcon?.no_sj_subcon || initialValues.sj_sc?.no_sj_subcon || '')
    if (initialValues.t_penerimaan_barang_subcon || initialValues.pb_sc) noPBName.value = (initialValues.t_penerimaan_barang_subcon?.no_penerimaan || initialValues.pb_sc?.no_penerimaan || '')
    if (initialValues.t_purchase_invoice_subcon || initialValues.pi_sc) {
      noPIName.value = initialValues.t_purchase_invoice_subcon?.no_pi_subcon || initialValues.pi_sc?.no_pi_subcon || ''
    }
    // fallback terakhir untuk field popup No. PI
    if (!noPIName.value && values.t_purchase_invoice_subcon_id && initialValues.pi_sc?.no_pi_subcon) {
      noPIName.value = initialValues.pi_sc.no_pi_subcon
    }
    applyTaxFromSource(initialValues.pi_sc || initialValues)

    // hard fallback untuk mode edit PI dengan struktur relasi baru (pi_sc)
    if (tipeRetur.value === 'PI') {
      const piSource = initialValues.pi_sc || initialValues.t_purchase_invoice_subcon || null
      values.t_purchase_invoice_subcon_id = values.t_purchase_invoice_subcon_id || piSource?.id || initialValues.t_purchase_invoice_subcon_id || null
      noPIName.value = noPIName.value || piSource?.no_pi_subcon || ''
      if (piSource) {
        applyTaxFromSource(piSource)
      }
      if (!values.persen_pph && piSource?.persen_pph !== undefined) {
        values.persen_pph = Number(piSource.persen_pph) || 0
      }
      if (!values.persen_ppn && piSource?.persen_ppn !== undefined) {
        values.persen_ppn = Number(piSource.persen_ppn) || 0
      }
    }
    // fallback: jika detail retur belum ada di payload edit, ambil dari dokumen referensi
    if (tipeRetur.value === 'PI' && values.t_purchase_invoice_subcon_id) {
      try {
        const piRes = await getPurchaseInvoiceSubconPopulateByPi(values.t_purchase_invoice_subcon_id)
        if (piRes?.status === 'success') {
          noPIName.value = noPIName.value || (piRes.data as any)?.no_pi_subcon || ''
          applyTaxFromSource(piRes.data)
          if (!hasExistingReturDetails && detailPI.value.length === 0) {
            populatePiDetails(piRes.data)
          } else {
            enrichPiReturDisplayFields(piRes.data)
          }
        }
      } catch { }
    }
    if (tipeRetur.value === 'PB') {
      try {
        if (detailSJ.value.length > 0 || detailPB.value.length > 0) {
          await enrichPbReturDisplayFields()
        } else if (values.t_penerimaan_barang_subcon_id) {
          const pbRes = await getPenerimaanSubconById(values.t_penerimaan_barang_subcon_id)
          if (pbRes?.status === 'success') populatePbDetails(pbRes.data)
        }
        selectedPbItems.value = Array.from(new Map(
          [...detailSJ.value, ...detailPB.value]
            .filter((row: any) => row.no_penerimaan && row.no_penerimaan !== '-')
            .map((row: any) => [row.no_penerimaan, { id: row.t_penerimaan_barang_subcon_id || row.no_penerimaan, no_penerimaan: row.no_penerimaan }])
        ).values())
      } catch (error) {
        console.log('[Retur PB Enrich] failed', error)
      }
    }
    toast.success(isCopyModeLocal ? 'Data berhasil disalin' : 'Data berhasil dimuat')
    // pastikan value popup PI tidak kosong setelah seluruh preload selesai
    if (tipeRetur.value === 'PI') {
      await nextTick()
      values.t_purchase_invoice_subcon_id =
        values.t_purchase_invoice_subcon_id ||
        initialValues.pi_sc?.id ||
        initialValues.t_purchase_invoice_subcon_id ||
        null
      noPIName.value =
        noPIName.value ||
        initialValues.pi_sc?.no_pi_subcon ||
        initialValues.t_purchase_invoice_subcon?.no_pi_subcon ||
        ''
    }
  } catch (e) {
    toast.error('Gagal memuat data', { description: e instanceof Error ? e.message : 'Terjadi kesalahan' })
    setTimeout(() => router.push('/purchasing/subcon/t_purchase_return_subcon'), 2000)
  } finally {
    loading.value = false
    isInitializing.value = false
  }
})

const onSave = async () => {
  Object.keys(errors).forEach(k => { errors[k as keyof typeof errors] = '' })
  let invalid = false
  if (!values.m_supplier_id) { errors.m_supplier_id = 'Supplier wajib diisi'; invalid = true }
  if (invalid) { toast.error('Validasi gagal', { description: 'Mohon lengkapi field wajib' }); return }
  loading.value = true
  try {
    const payload: any = {
      is_pi_pb: tipeRetur.value === 'PI',
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      tgl_retur: values.tgl_retur || null,
      m_supplier_id: values.m_supplier_id || null,
      t_purchase_invoice_subcon_id: values.t_purchase_invoice_subcon_id || null,
      t_penerimaan_barang_subcon_id: values.t_penerimaan_barang_subcon_id || null,
      m_currency_id: values.m_currency_id || null,
      top_id: values.top_id || null,
      no_retur_subcon: values.no_retur_subcon || null,
      ppn_id: values.ppn_id || null,
      pph_id: values.pph_id || null,
      persen_ppn: Number(values.persen_ppn) || 0,
      persen_pph: Number(values.persen_pph) || 0,
      catatan: values.catatan?.trim() || null,
      dpp_lainnya: dppCalc.value,
      total: dppCalc.value,
      total_diskon: 0,
      total_ppn: ppnCalc.value,
      total_pph: pphCalc.value,
      grand_total: grandTotalCalc.value,
      t_purchase_return_subcon_jadis: tipeRetur.value === 'PI' ? detailPI.value : detailSJ.value,
      t_purchase_return_subcon_jasas: tipeRetur.value === 'PI' ? detailPI2.value : detailPB.value,
    }
    if (isEditMode.value) { await updatePurchaseReturnSubcon(menuId.value, payload); toast.success('Berhasil diperbarui') }
    else { await createPurchaseReturnSubcon(payload); toast.success('Berhasil dibuat') }
    router.replace('/purchasing/subcon/t_purchase_return_subcon?reload=' + Date.now())
  } catch (e) { toast.error('Gagal menyimpan', { description: e instanceof Error ? e.message : 'Terjadi kesalahan' }) }
  finally { loading.value = false }
}
const handleCancel = () => router.push('/purchasing/subcon/t_purchase_return_subcon')
const createdByLabel = computed(() => {
  if (!initialValues.createdBy && !initialValues.createdAt) return ''
  const name = initialValues.createdBy?.name || initialValues.createdBy?.username || 'admin'
  const dt = initialValues.createdAt ? new Date(initialValues.createdAt).toLocaleString('en-US') : ''
  return `Created By ${name} On ${dt}`
})

watch(tipeRetur, () => {
  if (isInitializing.value) return
  values.t_sj_subcon_id = null
  values.t_penerimaan_barang_subcon_id = null
  values.t_purchase_invoice_subcon_id = null
  noSJName.value = ''
  noPBName.value = ''
  noPIName.value = ''
  values.ppn_id = null
  values.pph_id = null
  values.tipe_ppn = ''
  values.tipe_pph = ''
  values.persen_ppn = 0
  values.persen_pph = 0
  detailSJ.value = []
  detailPB.value = []
  detailPI.value = []
  detailPI2.value = []
  detailPI3.value = []
})
</script>
<template>
  <div class="p-6 space-y-6 mx-auto">
    <!-- Header -->
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <Button variant="ghost" size="icon" @click="handleCancel">
          <ArrowLeft class="h-5 w-5" />
        </Button>
        <div>
          <h1 class="text-2xl font-bold">{{ pageTitle }}</h1>
          <p class="text-sm text-muted-foreground">{{ pageDescription }}</p>
        </div>
      </div>
      <span class="px-3 py-1 text-xs font-semibold rounded border bg-muted text-muted-foreground uppercase">{{
        values.status ||'DRAFT' }}</span>
    </div>

    <form class="space-y-6" @submit.prevent>
      <!-- Header Card -->
      <Card>
        <CardContent class="pt-6 space-y-4">
          <!-- Radio Tipe -->
          <div class="flex items-center gap-6">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="tipeRetur" value="PB" :disabled="loading || isReadOnly"
                class="accent-primary" />
              <span class="text-sm font-medium">PB Subcon</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="tipeRetur" value="PI" :disabled="loading || isReadOnly"
                class="accent-primary" />
              <span class="text-sm font-medium">PI Subcon</span>
            </label>
          </div>

          <!-- Row 1 -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FieldSelect id="unit_bisnis" label="Unit Bisnis" v-model="unitBisnisModel"
              :disabled="loading || isReadOnly || isUnitBisnisLocked" :readonly="isReadOnly || isUnitBisnisLocked"
              placeholder="Pilih Unit Bisnis"
              :api="{ url: `${API_BASE_URL}/dynamic/m_unit_bisnis`, headers: apiHeaders, params: { searchfield: 'nama_comp,nama', filter_column_is_active: true }, onsuccess: (r: any) => { r.hasNext = !!r.pagination?.next_page; return r } }"
              displayField="nama_comp" valueField="id" class="w-full"
              @update:valueFull="(i: any) => { unitBisnisName = i?.nama_comp || i?.nama || '' }" />
            <FieldDate id="tgl" label="Tanggal Purchase Retur Subcon" type="date" :value="values.tgl_retur"
              @input="v => values.tgl_retur = v" :disabled="loading || isReadOnly" :readonly="isReadOnly" class="w-full" />
            <FieldX id="no_pr" label="No. Purchase Retur Subcon" :value="values.no_retur_subcon" :disabled="true"
              :readonly="true" placeholder="Otomatis dibuat sistem" class="w-full" />
          </div>

          <!-- Row 2 -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldSelect id="supplier" label="Supplier" v-model="supplierModel"
              :errorText="errors.m_supplier_id ? 'failed' : ''" :hints="errors.m_supplier_id" :required="!isReadOnly"
              :disabled="loading || isReadOnly" :readonly="isReadOnly" placeholder="Supplier A"
              :api="{ url: `${API_BASE_URL}/dynamic/m_supplier`, headers: apiHeaders, params: { searchfield: 'nama_supp,nama', filter_column_is_active: true }, onsuccess: (r: any) => { r.hasNext = !!r.pagination?.next_page; return r } }"
              displayField="nama_supp" valueField="id" class="w-full"
              @update:valueFull="(i: any) => { supplierName = i?.nama_supp || i?.nama || '' }" />

            <FieldX v-if="tipeRetur === 'PB'" id="pb_info" label="PB Source" value="Pilih detail dari tombol Add to List"
              :disabled="true" :readonly="true" class="w-full" />

            <!-- PI ref -->
            <FieldPopup v-if="tipeRetur === 'PI'" id="no_pi" label="No. PI" v-model="piModel" :displayValue="noPIName"
              :required="!isReadOnly" :disabled="loading || isReadOnly" :readonly="isReadOnly" placeholder="Pilih No. PI"
              :api="{ url: `${API_BASE_URL}/dynamic/t_purchase_invoice_subcon`, headers: apiHeaders, params: piParams }"
              displayField="no_pi_subcon" valueField="id" :columns="[
                { field: 'no_pi_subcon', headerName: 'No. PI', width: '180px', sortable: true, filterable: true },
                { field: 'tgl_pi', headerName: 'Tanggal', width: '140px', sortable: true, filterable: true },
                { field: 'm_supplier.nama_supp', headerName: 'Supplier', width: '220px', sortable: true, filterable: true },
                { field: 'm_unit_bisni.nama_comp', headerName: 'Unit Bisnis', width: '260px', sortable: true, filterable: true }
              ]" @update:valueFull="handlePiSelect" />
          </div>

          <!-- Row 3: Tipe PPN + PPH -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="block text-sm font-medium">Tipe PPN</label>
              <div class="flex items-center gap-2">
                <FieldX :value="values.tipe_ppn || '-'" :disabled="true" :readonly="true" class="flex-1" />
                <FieldNumber v-model="values.persen_ppn" :disabled="true" :readonly="true" :min="0" :max="100"
                  placeholder="0" class="w-20" />
                <span class="text-sm">%</span>
                <div class="flex-1 border border-input rounded-md px-3 py-2 text-sm bg-muted text-right">{{
                  formatNum(ppnCalc) }}</div>
              </div>
            </div>
            <div class="space-y-1">
              <label class="block text-sm font-medium">Tipe PPH</label>
              <div class="flex items-center gap-2">
                <FieldX :value="values.tipe_pph || '-'" :disabled="true" :readonly="true" class="flex-1" />
                <FieldNumber v-model="values.persen_pph" :disabled="true" :readonly="true" :min="0" :max="100"
                  placeholder="0" class="w-20" />
                <span class="text-sm">%</span>
                <div class="flex-1 border border-input rounded-md px-3 py-2 text-sm bg-muted text-right">{{
                  formatNum(pphCalc) }}</div>
              </div>
            </div>
          </div>

          <!-- Catatan -->
          <FieldX id="catatan" label="Catatan" type="textarea" :value="values.catatan" @input="v => values.catatan = v"
            :disabled="loading || isReadOnly" :readonly="isReadOnly" placeholder="Catatan" :rows="3"
            class="w-full max-w-lg" />
        </CardContent>
      </Card>

      <!-- =================== DETAIL: PB =================== -->
      <Card v-if="tipeRetur === 'PB'">
        <CardHeader>
          <div class="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Purchase Retur Detail</CardTitle>
              <CardDescription>Finish Goods dan Jasa dari Penerimaan Subcon</CardDescription>
            </div>
            <ButtonMultiSelect v-if="!isReadOnly" title="+ Add PB" :excludeIds="pbHeaderExcludeIds"
              @add="onSelectPbHeaders"
              :api="{ url: `${API_BASE_URL}/dynamic/t_penerimaan_barang_subcon`, headers: apiHeaders, params: { ...pbParams, include: 't_penerimaan_barang_subcon_jadi>t_purchase_order_subcon_jadi>t_purchase_order_subcon,t_penerimaan_barang_subcon_jadi>m_items,t_penerimaan_barang_subcon_jadi>m_general,t_penerimaan_barang_subcon_jasa>t_purchase_order_subcon_jasa>t_purchase_order_subcon,t_penerimaan_barang_subcon_jasa>m_items,t_penerimaan_barang_subcon_jasa>m_general,m_supplier,m_unit_bisnis' }, onsuccess: (r: any) => { r.hasNext = !!r.pagination?.next_page; return r } }"
              :columns="[
                { field: 'no_penerimaan', headerName: 'No. PB', width: '180px', sortable: true, filterable: true },
                { field: 'tgl_penerimaan', headerName: 'Tanggal', width: '140px', sortable: true, filterable: true },
                { field: 'm_supplier.nama_supp', headerName: 'Supplier', width: '220px', sortable: true, filterable: true },
                { field: 'm_unit_bisni.nama_comp', headerName: 'Unit Bisnis', width: '220px', sortable: true, filterable: true }
              ]" :disabled="loading || !values.m_unit_bisnis_id || !values.m_supplier_id" />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs default-value="fg" class="w-full">
            <TabsList class="mb-4">
              <TabsTrigger value="fg">Detail Finish Goods</TabsTrigger>
              <TabsTrigger value="jasa">Detail Jasa</TabsTrigger>
            </TabsList>

            <TabsContent value="fg" class="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <div class="flex items-center justify-between">
                    <CardTitle>Detail Finish Goods</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div class="border rounded-lg overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead class="bg-muted">
                        <tr>
                          <th class="px-3 py-2 text-left text-xs font-medium">No</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">No. PB</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">No. PO</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Kode</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Finish Goods</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Qty PB</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Qty Retur</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">UoM</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Harga</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Total</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Catatan</th>
                          <th v-if="!isReadOnly" class="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="detailSJ.length === 0">
                          <td colspan="12" class="text-center py-8 text-muted-foreground text-xs">Belum ada finish
                            goods.</td>
                        </tr>
                        <tr v-for="(d, i) in detailSJ" :key="i" class="border-t hover:bg-muted/50">
                          <td class="px-3 py-2 text-xs">{{ i + 1 }}</td>
                          <td class="px-3 py-2 text-xs">{{ d.no_penerimaan }}</td>
                          <td class="px-3 py-2 text-xs">{{ d.no_po }}</td>
                          <td class="px-3 py-2 text-xs">{{ d.kode }}</td>
                          <td class="px-3 py-2 text-xs">{{ d.nama_item }}</td>
                          <td class="px-3 py-2 text-xs text-right">{{ formatNum(d.qty_pb) }}</td>
                          <td class="px-3 py-2 text-xs">
                            <FieldNumber v-model="d.qty_retur" :disabled="loading || isReadOnly" :readonly="isReadOnly"
                              :min="0" placeholder="0" class="w-20" />
                          </td>
                          <td class="px-3 py-2 text-xs">{{ d.uom }}</td>
                          <td class="px-3 py-2 text-xs">
                            <FieldNumber v-model="d.harga" :disabled="loading || isReadOnly" :readonly="isReadOnly"
                              :min="0" placeholder="0" class="w-24" />
                          </td>
                          <td class="px-3 py-2 text-xs text-right">{{ formatNum(getNetto(d)) }}</td>
                          <td class="px-3 py-2 text-xs">
                            <FieldX v-model="d.catatan" :disabled="loading || isReadOnly" :readonly="isReadOnly"
                              placeholder="Catatan" />
                          </td>
                          <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                            <DeleteButton variant="ghost" size="sm" @click="removeSJ(i)" />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="jasa" class="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <div class="flex items-center justify-between">
                    <CardTitle>Detail Jasa</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div class="border rounded-lg overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead class="bg-muted">
                        <tr>
                          <th class="px-3 py-2 text-left text-xs font-medium">No</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">No. PB</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">No. PO</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Kode</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Jasa/Material</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Qty PB</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Qty Retur</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">UoM</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Harga</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Total</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Catatan</th>
                          <th v-if="!isReadOnly" class="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="detailPB.length === 0">
                          <td colspan="12" class="text-center py-8 text-muted-foreground text-xs">Belum ada jasa.</td>
                        </tr>
                        <tr v-for="(d, i) in detailPB" :key="i" class="border-t hover:bg-muted/50">
                          <td class="px-3 py-2 text-xs">{{ i + 1 }}</td>
                          <td class="px-3 py-2 text-xs">{{ d.no_penerimaan }}</td>
                          <td class="px-3 py-2 text-xs">{{ d.no_po }}</td>
                          <td class="px-3 py-2 text-xs">{{ d.kode }}</td>
                          <td class="px-3 py-2 text-xs">{{ d.nama_item }}</td>
                          <td class="px-3 py-2 text-xs text-right">{{ formatNum(d.qty_pb) }}</td>
                          <td class="px-3 py-2 text-xs">
                            <FieldNumber v-model="d.qty_retur" :disabled="loading || isReadOnly" :readonly="isReadOnly"
                              :min="0" placeholder="0" class="w-20" />
                          </td>
                          <td class="px-3 py-2 text-xs">{{ d.uom }}</td>
                          <td class="px-3 py-2 text-xs">
                            <FieldNumber v-model="d.harga" :disabled="loading || isReadOnly" :readonly="isReadOnly"
                              :min="0" placeholder="0" class="w-24" />
                          </td>
                          <td class="px-3 py-2 text-xs text-right">{{ formatNum(getTotal2(d)) }}</td>
                          <td class="px-3 py-2 text-xs">
                            <FieldX v-model="d.catatan" :disabled="loading || isReadOnly" :readonly="isReadOnly"
                              placeholder="Catatan" />
                          </td>
                          <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                            <DeleteButton variant="ghost" size="sm" @click="removePB(i)" />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <!-- =================== DETAIL: PI (3 tabs) =================== -->
      <Card v-if="tipeRetur === 'PI'">
        <CardHeader>
          <CardTitle>Purchase Retur Detail</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs default-value="fg" class="w-full">
            <TabsList class="mb-4">
              <TabsTrigger value="fg">Detail Finish Goods</TabsTrigger>
              <TabsTrigger value="jasa">Detail Biaya Jasa</TabsTrigger>
            </TabsList>

            <!-- Tab FG -->
            <TabsContent value="fg" class="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <div class="flex items-center justify-between">
                    <CardTitle>Detail Finish Goods</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div class="border rounded-lg overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead class="bg-muted">
                        <tr>
                          <th class="px-3 py-2 text-left text-xs font-medium">No</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">No. PO</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">No. PB</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Kode</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Finish Goods</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Qty PI</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Qty Retur</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">UoM</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Harga</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Netto</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Catatan</th>
                          <th v-if="!isReadOnly" class="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="detailPI.length === 0">
                          <td colspan="12" class="text-center py-8 text-muted-foreground text-xs">Belum ada item.</td>
                        </tr>
                        <tr v-for="(d, i) in detailPI" :key="i" class="border-t hover:bg-muted/50">
                          <td class="px-3 py-2 text-xs">{{ i + 1 }}</td>
                          <td class="px-3 py-2 text-xs">{{ d.no_po }}</td>
                          <td class="px-3 py-2 text-xs">{{ d.no_penerimaan }}</td>
                          <td class="px-3 py-2 text-xs">{{ d.kode }}</td>
                          <td class="px-3 py-2 text-xs">{{ d.finish_goods }}</td>
                          <td class="px-3 py-2 text-xs text-right">{{ formatNum(d.qty_pi) }}</td>
                          <td class="px-3 py-2 text-xs">
                            <FieldNumber v-model="d.qty_retur" :disabled="loading || isReadOnly" :readonly="isReadOnly"
                              :min="0" placeholder="0" class="w-20" />
                          </td>
                          <td class="px-3 py-2 text-xs">{{ d.uom }}</td>
                          <td class="px-3 py-2 text-xs">
                            <FieldNumber v-model="d.harga" :disabled="true" :readonly="true"
                              :min="0" placeholder="0" class="w-24" />
                          </td>
                          <td class="px-3 py-2 text-xs text-right">{{ formatNum(getNetto(d)) }}</td>
                          <td class="px-3 py-2 text-xs">
                            <FieldX v-model="d.catatan" :disabled="loading || isReadOnly" :readonly="isReadOnly"
                              placeholder="Catatan" />
                          </td>
                          <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                            <DeleteButton variant="ghost" size="sm" @click="removePI(i)" />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <!-- Tab Biaya Jasa -->
            <TabsContent value="jasa" class="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <div class="flex items-center justify-between">
                    <CardTitle>Detail Biaya Jasa</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div class="border rounded-lg overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead class="bg-muted">
                        <tr>
                          <th class="px-3 py-2 text-left text-xs font-medium">No</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Kode</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">No. PB</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Material</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Finish Goods</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Jasa</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Qty PI</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Qty Retur</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">UoM</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Harga</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Total</th>
                          <th class="px-3 py-2 text-left text-xs font-medium">Catatan</th>
                          <th v-if="!isReadOnly" class="px-2 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-if="detailPI2.length === 0">
                          <td colspan="13" class="text-center py-8 text-muted-foreground text-xs">Belum ada item.</td>
                        </tr>
                        <tr v-for="(d, i) in detailPI2" :key="i" class="border-t hover:bg-muted/50">
                          <td class="px-3 py-2 text-xs">{{ i + 1 }}</td>
                          <td class="px-3 py-2 text-xs">{{ d.kode }}</td>
                          <td class="px-3 py-2 text-xs">{{ d.no_penerimaan }}</td>
                          <td class="px-3 py-2 text-xs">{{ d.material }}</td>
                          <td class="px-3 py-2 text-xs">{{ d.finish_goods }}</td>
                          <td class="px-3 py-2 text-xs">{{ d.jasa }}</td>
                          <td class="px-3 py-2 text-xs text-right">{{ formatNum(d.qty_pi) }}</td>
                          <td class="px-3 py-2 text-xs">
                            <FieldNumber v-model="d.qty_retur" :disabled="loading || isReadOnly" :readonly="isReadOnly"
                              :min="0" placeholder="0" class="w-20" />
                          </td>
                          <td class="px-3 py-2 text-xs">{{ d.uom }}</td>
                          <td class="px-3 py-2 text-xs">
                            <FieldNumber v-model="d.harga" :disabled="true" :readonly="true"
                              :min="0" placeholder="0" class="w-24" />
                          </td>
                          <td class="px-3 py-2 text-xs text-right">{{ formatNum(getTotal2(d)) }}</td>
                          <td class="px-3 py-2 text-xs">
                            <FieldX v-model="d.catatan" :disabled="loading || isReadOnly" :readonly="isReadOnly"
                              placeholder="Catatan" />
                          </td>
                          <td v-if="!isReadOnly" class="px-2 py-2 text-center">
                            <DeleteButton variant="ghost" size="sm" @click="removePI2(i)" />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>

          <!-- Summary -->
          <div class="mt-6 grid grid-cols-2 gap-x-4 gap-y-1 max-w-xs">
            <span class="text-sm text-muted-foreground">DPP</span>
            <span class="text-sm text-right font-medium">{{ formatNum(dppCalc) }}</span>
            <span class="text-sm text-muted-foreground">PPN {{ values.persen_ppn || 0 }}%</span>
            <span class="text-sm text-right font-medium">{{ formatNum(ppnCalc) }}</span>
            <span class="text-sm text-muted-foreground">PPH {{ values.persen_pph || 0 }}%</span>
            <span class="text-sm text-right font-medium">{{ formatNum(pphCalc) }}</span>
            <span class="text-sm font-semibold border-t pt-1">Grand Total</span>
            <span class="text-sm text-right font-semibold border-t pt-1">{{ formatNum(grandTotalCalc) }}</span>
          </div>
        </CardContent>
      </Card>

      <!-- Footer -->
      <div
        class="flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t -mx-6 px-6 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:static">
        <span class="text-xs text-muted-foreground">{{ createdByLabel }}</span>
        <div class="flex items-center gap-2">
          <Button type="button" variant="outline" @click="handleCancel" :disabled="loading">{{
            isReadOnly ? 'Kembali' :'Batal' }}</Button>
          <Button v-if="!isReadOnly" type="button" @click="onSave" :disabled="loading" class="gap-2">
            <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
            <Save v-else class="h-4 w-4" />
            {{ isEditMode ? 'Perbarui' : 'Simpan' }}
          </Button>
        </div>
      </div>
    </form>
  </div>
</template>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
