<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldX, FieldNumber, FieldPopup, FieldDate, FieldTextarea, FieldSelect, FieldRadio } from '@/components/field'
import { ButtonMultiSelect, DeleteButton } from '@/components/button'
import { Plus, Trash2, ArrowLeft, Save, Loader2 } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import {
  createImportCost,
  updateImportCost,
  getImportCostById,
  type ImportCostDetail
} from './service'
import AuditInfo from '@/components/AuditInfo.vue'

// ============================================================================
// SETUP
// ============================================================================
const authStore = useAuthStore()
const { API_BASE_URL } = useApi()
const router = useRouter()
const route = useRoute()

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false)
const isEditMode = computed(() => !!route.params.id && route.name === 'ImportCostForm')
const isViewMode = computed(() => route.name === 'ImportCostView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Biaya Kirim'
  if (isCopyMode.value) return 'Salin Biaya Kirim'
  if (isEditMode.value) return 'Edit Biaya Kirim'
  return 'Tambah Biaya Kirim Baru'
})

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Biaya Kirim'
  if (isCopyMode.value) return 'Buat Biaya Kirim baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Biaya Kirim'
  return 'Buat data Biaya Kirim baru'
})

// Form values
const values = reactive({
  m_unit_bisnis_id: '',
  no_import_cost: '',
  supplier_id: '',
  t_penerimaan_barangs_id: '',
  m_currency_id: '',
  rate: 0,
  catatan: '',
  is_ekspedisi: true, // Default to Ekspedisi
  m_ekspedisi_id: ''
})

// Display values for FieldPopup
const displayValues = reactive({
  supplier: '',
  penerimaan: '',
  currency: '',
  ekspedisi: ''
})

// Track if PO is import (to hide Forwarder option)
const isPOImport = ref(false)

// Radio options for Ekspedisi/Forwarder - computed to filter based on PO import status
const jenisKirimOptions = computed(() => {
  const baseOptions = [
    { label: 'Ekspedisi', value: 'true' },
    { label: 'Forwarder', value: 'false' }
  ]
  
  // If PO is NOT import, only show Ekspedisi option
  if (!isPOImport.value) {
    return baseOptions.filter(opt => opt.value === 'true')
  }
  
  return baseOptions
})

// Computed for is_ekspedisi radio (boolean <-> string conversion)
const jenisKirimValue = computed({
  get: () => String(values.is_ekspedisi),
  set: (val: string) => {
    values.is_ekspedisi = val === 'true'
    // Reset related fields when switching
    if (values.is_ekspedisi) {
      values.supplier_id = ''
      displayValues.supplier = ''
    } else {
      values.m_ekspedisi_id = ''
      displayValues.ekspedisi = ''
    }
  }
})

// Super Admin check
const isSuperAdmin = computed(() => {
  const user = authStore.user as any
  return user?.tipe?.value1?.toUpperCase() === 'SUPER ADMIN'
})
const selectedUnitBisnis = ref<any | null>(null)

const getCompanyIdFromSelectRespo = (): string => {
  try {
    const selectRespo = localStorage.getItem('SelectRespo')
    if (!selectRespo) return ''
    const parsed = JSON.parse(selectRespo)
    return parsed?.m_unit_bisnis_id || parsed?.companyId || ''
  } catch (e) {
    return ''
  }
}

// Company info dari SelectRespo (untuk non-super admin)
const companyNameDisplay = computed(() => {
  if (!isSuperAdmin.value) {
    try {
      const selectRespo = localStorage.getItem('SelectRespo')
      if (selectRespo) {
        const parsed = JSON.parse(selectRespo)
        // Auto-set m_unit_bisnis_id for non-super admin
        const companyId = parsed?.m_unit_bisnis_id || parsed?.companyId
        if (companyId && !values.m_unit_bisnis_id) {
          values.m_unit_bisnis_id = companyId
        }
        return parsed.companyName || ''
      }
    } catch (e) {
      console.error('Failed to parse SelectRespo:', e)
    }
  }
  return ''
})

const selectedCompanyNameDisplay = computed(() => {
  return (
    selectedUnitBisnis.value?.m_company?.nama ||
    selectedUnitBisnis.value?.company?.nama ||
    selectedUnitBisnis.value?.m_company?.name ||
    '-'
  )
})

const handleUnitBisnisSelected = (unitBisnis: any | null) => {
  selectedUnitBisnis.value = unitBisnis || null
}

const fetchSelectedUnitBisnis = async (unitBisnisId?: string | null) => {
  if (!unitBisnisId) {
    selectedUnitBisnis.value = null
    return
  }

  if (selectedUnitBisnis.value?.id === unitBisnisId) return

  try {
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_unit_bisnis/${unitBisnisId}?include=m_company`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    )
    const result = await response.json()
    selectedUnitBisnis.value = result.status === 'success' ? result.data : null
  } catch (error) {
    console.error('Failed to load selected unit bisnis company:', error)
    selectedUnitBisnis.value = null
  }
}

// Temp data
let initialValues: Record<string, any> = {}

const auditMeta = ref<{ created_by?: string | null; createdAt?: string | null; updated_by?: string | null; updatedAt?: string | null }>({})

// Detail arrays
const detailItems = ref<ImportCostDetail[]>([])

// Currency data
const selectedCurrencyData = ref<any>(null)

// Currency display helpers
const currencySymbol = computed(() => {
  const code = selectedCurrencyData.value?.money?.value5 || 'IDR'
  const name = selectedCurrencyData.value?.money?.value1 || 'Indonesian Rupiah'

  // Force 'Rp' untuk Rupiah (IDR)
  if (
    code.toUpperCase() === 'IDR' ||
    name.toLowerCase().includes('rupiah')
  ) {
    return 'Rp'
  }

  return selectedCurrencyData.value?.money?.value2 || 'Rp'
})

const currencyName = computed(
  () => selectedCurrencyData.value?.money?.value1 || 'Indonesian Rupiah',
)

const currencyCode = computed(
  () => selectedCurrencyData.value?.money?.value5 || 'IDR',
)

// Exchange rate dari API atau default
const exchangeRateDisplay = computed(() => {
  // Prioritas: gunakan nilai manual dari form jika ada
  if (values.rate && values.rate > 0) {
    return values.rate
  }

  // Fallback ke data dari API
  if (
    selectedCurrencyData.value &&
    selectedCurrencyData.value.m_currency_ds &&
    selectedCurrencyData.value.m_currency_ds.length > 0
  ) {
    // Cari yang aktif (is_active = true) atau ambil yang pertama
    const activeRate = selectedCurrencyData.value.m_currency_ds.find(
      (d: any) => d.is_active === true,
    )
    if (activeRate && activeRate.rate) {
      return Number(activeRate.rate)
    }

    // Fallback ke yang pertama
    const firstRate = selectedCurrencyData.value.m_currency_ds[0]
    if (firstRate && firstRate.rate) {
      return Number(firstRate.rate)
    }
  }
  return 1
})

const exchangeRateDate = computed(() => {
  if (
    selectedCurrencyData.value &&
    selectedCurrencyData.value.m_currency_ds &&
    selectedCurrencyData.value.m_currency_ds.length > 0
  ) {
    const activeRate = selectedCurrencyData.value.m_currency_ds.find(
      (d: any) => d.is_active === true,
    )
    const rateData = activeRate || selectedCurrencyData.value.m_currency_ds[0]
    if (rateData && rateData.tgl) {
      const date = new Date(rateData.tgl)
      return date.toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    }
  }
  return new Date().toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

// Total cost calculation
const totalCost = computed(() => {
  return detailItems.value.reduce((sum, item) => sum + (item.amount || 0), 0)
})

// ============================================================================
// NUMBER FORMATTING HELPERS
// ============================================================================
/** Format number with thousand separator (dots) */
const formatNumber = (value: number | undefined | null): string => {
  if (!value && value !== 0) return ''
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/** Parse formatted number string to number */
const parseNumber = (value: string): number => {
  if (!value) return 0
  // Remove dots and parse to number
  const cleaned = value.replace(/\./g, '').replace(/-/g, '')
  return Math.max(0, parseFloat(cleaned) || 0)
}

/** Handle input for amount field with formatting */
const handleAmountInput = (event: Event, detail: ImportCostDetail) => {
  const input = event.target as HTMLInputElement
  const cursorPos = input.selectionStart || 0
  const oldValue = input.value
  const oldLength = oldValue.length

  // Parse number from formatted string
  const numericValue = parseNumber(input.value)
  detail.amount = numericValue

  // Format and update display
  const formatted = formatNumber(numericValue)
  input.value = formatted

  // Restore cursor position (adjust for added/removed dots)
  const newLength = formatted.length
  const diff = newLength - oldLength
  const newCursorPos = Math.max(0, Math.min(cursorPos + diff, newLength))

  setTimeout(() => {
    input.setSelectionRange(newCursorPos, newCursorPos)
  }, 0)
}

// ============================================================================
// CURRENCY DATA FETCHING
// ============================================================================
const fetchCurrencyData = async (currencyId: string) => {
  if (!currencyId) {
    selectedCurrencyData.value = null
    return
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/dynamic/m_currency/${currencyId}?join=true`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
      },
    )

    if (!response.ok) {
      throw new Error('Failed to fetch currency data')
    }

    const result = await response.json()

    if (result.status === 'success' && result.data) {
      selectedCurrencyData.value = result.data

      // Auto-fill exchange rate dari API hanya jika rate belum diisi atau = 0
      // Dan tidak dalam mode edit/view (untuk preserve existing data)
      if ((!values.rate || values.rate === 0) && !isEditMode.value && !isViewMode.value) {
        const apiRate = exchangeRateDisplay.value
        if (apiRate && apiRate > 0) {
          values.rate = apiRate
          toast.success('Exchange rate berhasil dimuat', {
            description: `Rate: ${apiRate.toLocaleString('id-ID')} (${exchangeRateDate.value})`,
          })
        }
      }
    }
  } catch (error) {
    console.error('Error fetching currency data:', error)
    toast.error('Gagal memuat data currency', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
    })
  }
}

// Watch m_currency_id untuk fetch currency data
watch(
  () => values.m_currency_id,
  async (newCurrencyId) => {
    if (newCurrencyId) {
      await fetchCurrencyData(newCurrencyId)
    } else {
      selectedCurrencyData.value = null
    }
  },
)

watch(
  () => values.m_unit_bisnis_id || '',
  async (id: string) => {
    await fetchSelectedUnitBisnis(id)
  },
  { immediate: true },
)

// Watch t_penerimaan_barangs_id untuk reset isPOImport ketika penerimaan di-clear
watch(
  () => values.t_penerimaan_barangs_id,
  (newValue) => {
    if (!newValue) {
      // Reset isPOImport when penerimaan is cleared
      isPOImport.value = false
    }
  }
)

// ============================================================================
// PENERIMAAN SELECTION HANDLER - Auto-fill Currency from First PO
// ============================================================================
const handlePenerimaanSelect = async (penerimaanItem: any) => {
  console.log('handlePenerimaanSelect called with:', penerimaanItem)

  // Update display value
  displayValues.penerimaan = penerimaanItem?.no_penerimaan || ''

  // Don't auto-fill in edit or view mode to preserve existing data
  if (isEditMode.value || isViewMode.value) {
    return
  }

  // Try to get currency from first PO in penerimaan details
  // Data already joined from FieldPopup API call
  try {
    let firstDetail = null

    // Check both possible field names (API might use different naming)
    if (penerimaanItem?.t_penerimaan_barang_ds && Array.isArray(penerimaanItem.t_penerimaan_barang_ds) && penerimaanItem.t_penerimaan_barang_ds.length > 0) {
      firstDetail = penerimaanItem.t_penerimaan_barang_ds[0]
      console.log('Found detail in t_penerimaan_barang_ds:', firstDetail)
    } else if (penerimaanItem?.t_penerimaan_barang_d && Array.isArray(penerimaanItem.t_penerimaan_barang_d) && penerimaanItem.t_penerimaan_barang_d.length > 0) {
      firstDetail = penerimaanItem.t_penerimaan_barang_d[0]
      console.log('Found detail in t_penerimaan_barang_d:', firstDetail)
    }

    if (!firstDetail) {
      console.warn('No detail items found in penerimaan')
      toast.info('Tidak ada detail PO ditemukan', {
        description: 'Silakan pilih currency secara manual',
      })
      // Reset is_import flag
      isPOImport.value = false
      return
    }

    // Check if PO is import
    const isImport = firstDetail.t_purchase_order?.is_import || false
    isPOImport.value = isImport
    console.log('PO is_import:', isImport)
    
    // If PO is NOT import, force Ekspedisi mode
    if (!isImport) {
      values.is_ekspedisi = true
      // Clear forwarder/supplier selection
      values.supplier_id = ''
      displayValues.supplier = ''
      
      toast.info('PO Lokal terdeteksi', {
        description: 'Hanya bisa menggunakan Ekspedisi untuk PO Lokal'
      })
    }

    // Get currency_id from first PO
    const currencyId = firstDetail.t_purchase_order?.m_currency_id
    console.log('Currency ID from PO:', currencyId)

    if (currencyId) {
      // Set currency as default
      values.m_currency_id = currencyId

      // Fetch currency name for display
      const currencyResponse = await fetch(
        `${API_BASE_URL}/dynamic/m_currency/${currencyId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authStore.token}`,
          },
        },
      )

      if (currencyResponse.ok) {
        const currencyResult = await currencyResponse.json()
        if (currencyResult.status === 'success' && currencyResult.data) {
          displayValues.currency = currencyResult.data.nama_currency || ''
          toast.success('Currency berhasil dimuat dari PO', {
            description: `${currencyResult.data.nama_currency}`,
          })
        }
      }
    } else {
      console.warn('Currency ID is null in PO')
      toast.info('PO tidak memiliki currency', {
        description: 'Silakan pilih currency secara manual',
      })
    }
  } catch (error) {
    console.error('Error loading currency from PO:', error)
    toast.error('Gagal memuat currency dari PO', {
      description: 'Silakan pilih currency secara manual',
    })
  }
}

// ============================================================================
// DETAIL METHODS
// ============================================================================
const removeDetailItem = (index: number) => {
  detailItems.value.splice(index, 1)
  toast.info('Detail item dihapus')
}

// Add COA to details from ButtonMultiSelect
const handleCOASelect = (items: any[]) => {
  items.forEach(item => {
    const exists = detailItems.value.some(d => d.m_coa_id === item.id)
    if (!exists) {
      detailItems.value.push({
        m_coa_id: item.id,
        kode_coa: item.kode,
        nama_coa: item.nama,
        amount: 0,
        catatan: ''
      })
    }
  })
}

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  const defaultCompanyId = !isSuperAdmin.value ? getCompanyIdFromSelectRespo() : ''

  Object.assign(values, {
    m_unit_bisnis_id: defaultCompanyId,
    no_import_cost: '',
    supplier_id: '',
    t_penerimaan_barangs_id: '',
    m_currency_id: '',
    rate: 0,
    catatan: '',
    is_ekspedisi: true,
    m_ekspedisi_id: ''
  })

  Object.assign(displayValues, {
    supplier: '',
    penerimaan: '',
    currency: '',
    ekspedisi: ''
  })

  detailItems.value = []
  isPOImport.value = false

  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
}

// ============================================================================
// LIFECYCLE HOOKS
// ============================================================================
onBeforeMount(async () => {
  onReset()

  // Auto-set company for non-super admin
  if (!isSuperAdmin.value) {
    const defaultCompanyId = getCompanyIdFromSelectRespo()
    if (defaultCompanyId && !values.m_unit_bisnis_id) {
      values.m_unit_bisnis_id = defaultCompanyId
    }
  }

  const isCopyModeLocal = route.query.action === 'copy' && route.query.source
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return
  }

  loading.value = true
  try {
    const res = await getImportCostById(sourceId)

    if (res.status !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data

    auditMeta.value = {
      created_by: initialValues.created_by || initialValues.createdBy || null,
      createdAt: initialValues.createdAt || null,
      updated_by: initialValues.updated_by || initialValues.update_by || initialValues.edited_by || null,
      updatedAt: initialValues.updatedAt || null,
    }

    // Extract display values from nested objects
    if (initialValues.m_supplier?.nama_supp) {
      displayValues.supplier = initialValues.m_supplier.nama_supp
    }
    if (initialValues.t_penerimaan_barang?.no_penerimaan) {
      displayValues.penerimaan = initialValues.t_penerimaan_barang.no_penerimaan
    }
    if (initialValues.m_currency?.nama_currency) {
      displayValues.currency = initialValues.m_currency.nama_currency
    }

    // Load detail items
    if (initialValues.t_import_cost_ds && Array.isArray(initialValues.t_import_cost_ds)) {
      detailItems.value = initialValues.t_import_cost_ds.map((d: any) => ({
        id: d.id,
        m_coa_id: d.m_coa_id,
        kode_coa: d.m_coa?.kode || '',
        nama_coa: d.m_coa?.nama || '',
        amount: d.amount || 0,
        catatan: d.catatan || ''
      }))
    }

    // Mode copy: hapus id dan timestamps
    if (isCopyModeLocal) {
      delete (initialValues as any).id
      delete (initialValues as any).createdAt
      delete (initialValues as any).updatedAt
      // Reset no for copy
      initialValues.no_import_cost = ''
      // Reset status to DRAFT when copying
      initialValues.status = 'DRAFT'
    }

    // Check if trying to edit a POST item - redirect to view
    if (isEditMode.value && initialValues.status === 'POST') {
      toast.error('Tidak dapat mengedit', {
        description: 'Data yang sudah POST tidak bisa diedit. Membuka halaman view...'
      })
      setTimeout(() => router.replace(`/purchasing/transaksi/t_import_cost/view/${menuId.value}`), 1500)
      return
    }

    // Assign to reactive values
    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        (values as any)[key] = initialValues[key] || ''
      }
    }

    // Fetch currency data if m_currency_id exists (for edit/view/copy mode)
    if (values.m_currency_id) {
      await fetchCurrencyData(values.m_currency_id)
    }

    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai Biaya Kirim baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Biaya Kirim', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/purchasing/transaksi/t_import_cost')
      }
    })
    setTimeout(() => router.push('/purchasing/transaksi/t_import_cost'), 2000)
  } finally {
    loading.value = false
  }
})

// Errors object
const errors = reactive({
  m_unit_bisnis_id: '',
  supplier_id: '',
  m_ekspedisi_id: '',
  t_penerimaan_barangs_id: '',
  m_currency_id: '',
  rate: ''
})

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  // Normalize incoming values from popup/select controls
  values.m_unit_bisnis_id = String(values.m_unit_bisnis_id || '').trim()
  values.supplier_id = String(values.supplier_id || '').trim()
  values.t_penerimaan_barangs_id = String(values.t_penerimaan_barangs_id || '').trim()
  values.m_currency_id = String(values.m_currency_id || '').trim()

  // Validasi required
  Object.keys(errors).forEach(key => { errors[key as keyof typeof errors] = '' })
  let invalid = false

  if (!values.m_unit_bisnis_id) { errors.m_unit_bisnis_id = 'Unit Bisnis wajib diisi'; invalid = true }
  
  // Validate ekspedisi or forwarder based on is_ekspedisi flag
  if (values.is_ekspedisi) {
    // Mode Ekspedisi: m_ekspedisi_id is required
    if (!values.m_ekspedisi_id) { errors.m_ekspedisi_id = 'Ekspedisi wajib diisi'; invalid = true }
  } else {
    // Mode Forwarder: supplier_id (forwarder) is required
    if (!values.supplier_id) { errors.supplier_id = 'Forwarder wajib diisi'; invalid = true }
  }
  
  if (!values.t_penerimaan_barangs_id) { errors.t_penerimaan_barangs_id = 'No. Penerimaan Barang wajib diisi'; invalid = true }
  if (!values.m_currency_id) { errors.m_currency_id = 'Currency wajib diisi'; invalid = true }
  if (values.rate === undefined || values.rate === null || values.rate <= 0) {
    errors.rate = 'Rate wajib diisi dan harus > 0';
    invalid = true
  }

  if (invalid) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field yang wajib diisi' })
    return
  }

  // Validate details
  if (detailItems.value.length === 0) {
    toast.error('Detail Biaya Kirim kosong', { description: 'Mohon tambahkan minimal 1 COA' })
    return
  }

  const invalidAmountItems = detailItems.value.filter((item) => Number(item.amount || 0) <= 0)
  if (invalidAmountItems.length > 0) {
    toast.error('Amount tidak boleh 0', {
      description: `${invalidAmountItems.length} detail biaya masih memiliki amount kosong/0`,
    })
    return
  }

  loading.value = true
  try {
    const payload = {
      m_unit_bisnis_id: values.m_unit_bisnis_id || null,
      no_import_cost: values.no_import_cost?.trim() || null,
      is_ekspedisi: values.is_ekspedisi,
      m_ekspedisi_id: values.is_ekspedisi ? (values.m_ekspedisi_id || null) : null,
      supplier_id: !values.is_ekspedisi ? (values.supplier_id || null) : null,
      t_penerimaan_barangs_id: values.t_penerimaan_barangs_id || null,
      m_currency_id: values.m_currency_id || null,
      rate: values.rate || 0,
      total_cost: totalCost.value || 0,
      catatan: values.catatan?.trim() || null,
      t_import_cost_ds: detailItems.value.map(d => ({
        m_coa_id: d.m_coa_id,
        amount: d.amount || 0,
        catatan: d.catatan?.trim() || null
      }))
    }

    if (isEditMode.value) {
      (payload as any).updated_by = authStore.user?.id || null;
      await updateImportCost(menuId.value, payload)
      toast.success('Biaya Kirim berhasil diperbarui', { description: `Biaya Kirim "${values.no_import_cost}" telah diperbarui` })
    } else {
      (payload as any).created_by = authStore.user?.id || null;
      (payload as any).updated_by = authStore.user?.id || null;
      await createImportCost(payload)
      toast.success('Biaya Kirim berhasil dibuat', { description: `Biaya Kirim "${values.no_import_cost}" telah ditambahkan` })
    }
    router.replace('/purchasing/transaksi/t_import_cost?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Biaya Kirim' : 'Gagal membuat Biaya Kirim', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
  } finally {
    loading.value = false
  }
}

// ============================================================================
// CANCEL HANDLER
// ============================================================================
const handleCancel = () => {
  router.push('/purchasing/transaksi/t_import_cost')
}
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
    <!-- HEADER -->
    <div class="flex items-center gap-4">
      <Button variant="ghost" size="icon" @click="handleCancel">
        <ArrowLeft class="h-5 w-5" />
      </Button>
      <div>
        <h1 class="text-2xl font-bold text-foreground">
          {{ pageTitle }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ pageDescription }}
        </p>
      </div>
    </div>

    <!-- FORM -->
    <form @submit.prevent="onSave" class="space-y-6">
      <!-- MAIN CARD -->
      <Card>
        <CardHeader>
          <CardTitle>Informasi Biaya Kirim</CardTitle>
          <CardDescription>Isi data Biaya Kirim dengan lengkap dan benar</CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

            <!-- Unit Bisnis -->
            <div v-if="isSuperAdmin" class="space-y-2">
              <FieldSelect id="m_unit_bisnis_id" label="Unit Bisnis" v-model="values.m_unit_bisnis_id"
                :errorText="errors.m_unit_bisnis_id ? 'failed' : ''"
                @update:valueFull="handleUnitBisnisSelected"
                :hints="errors.m_unit_bisnis_id" :required="!isReadOnly" :disabled="loading || isReadOnly"
                :readonly="isReadOnly" :clearable="!isReadOnly" placeholder="Pilih Business Unit"
                displayField="nama_comp" valueField="id" :api="{
                  url: `${API_BASE_URL}/dynamic/m_unit_bisnis`,
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authStore.token}`
                  },
                  params: {
                    searchfield: 'nama_comp,kode_unit_bisnis',
                    filter_column_is_active: true,
                    no_pagination: 'true',
                    include: 'm_company'
                  },
                }" />
            </div>
            <div v-else class="space-y-2">
              <FieldX id="unit_bisnis_display" label="Unit Bisnis" :value="companyNameDisplay" :disabled="true"
                :readonly="true" class="w-full" />
            </div>

            <FieldX id="company_display" label="Company" :value="selectedCompanyNameDisplay" :disabled="true"
              :readonly="true" placeholder="Company otomatis dari unit bisnis" class="w-full" />

            <!-- No. Biaya Kirim (Auto-generated) -->
            <FieldX id="no_import_cost" label="No. Biaya Kirim" :value="values.no_import_cost"
              @input="v => values.no_import_cost = v" :disabled="loading || isReadOnly" :readonly="true"
              placeholder="Auto-generated" class="w-full" />

                          <!-- No. Penerimaan Barang -->
            <FieldPopup id="t_penerimaan_barangs_id" label="No. Penerimaan Barang"
              :value="values.t_penerimaan_barangs_id" :displayValue="displayValues.penerimaan"
              :errorText="errors.t_penerimaan_barangs_id ? 'failed' : ''"
              @input="(v: string) => { values.t_penerimaan_barangs_id = v; if (!v) displayValues.penerimaan = '' }"
              @update:valueFull="handlePenerimaanSelect" :hints="errors.t_penerimaan_barangs_id" :required="!isReadOnly"
              :disabled="loading || isReadOnly" :readonly="isReadOnly" :clearable="!isReadOnly"
              placeholder="Pilih No. Penerimaan Barang" displayField="no_penerimaan" valueField="id" :api="{
                url: `${API_BASE_URL}/dynamic/t_penerimaan_barangs`,
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authStore.token}`
                },
                params: {
                  include: 't_penerimaan_barang_d>t_purchase_order,m_supplier,m_gudang',
                  searchfield: 'no_penerimaan,no_sj_supp',
                  where: 'status:WAITING_BIAYA_KIRIM',
                  join: 'true'
                },
                onsuccess: (response: any) => {
                  // Add virtual field for PO type (IMPORT/LOKAL)
                  if (response.data && Array.isArray(response.data)) {
                    response.data = response.data.map((item: any) => {
                      const firstDetail = item.t_penerimaan_barang_ds?.[0] || item.t_penerimaan_barang_d?.[0]
                      const isImport = firstDetail?.t_purchase_order?.is_import || false
                      return {
                        ...item,
                        po_type: isImport ? 'IMPORT' : 'LOKAL'
                      }
                    })
                  }
                  response.hasNext = response.pagination?.next_page ? true : false
                  return response
                }
              }" :columns="[
                { field: 'no_penerimaan', headerName: 'No. Penerimaan', width: '180px' },
                { field: 'tgl_penerimaan', headerName: 'Tanggal', width: '120px' },
                { field: 'po_type', headerName: 'Tipe PO', width: '100px' },
                { field: 'm_supplier.nama_supp', headerName: 'Supplier', flex: 1 },
                { field: 'm_gudang.nama_gudang', headerName: 'Gudang', width: '180px' },
                { field: 'no_kontainer', headerName: 'No. Kontainer', width: '140px' },
                { field: 'no_sj_supp', headerName: 'No. SJ Supplier', width: '150px' }
              ]" />

            <!-- Jenis Kirim: Ekspedisi atau Forwarder -->
            <div class="space-y-2">
              <FieldRadio id="jenis_kirim" label="Jenis Kirim" v-model="jenisKirimValue" :options="jenisKirimOptions"
                :disabled="loading || isReadOnly || !isPOImport" :required="!isReadOnly" />
              <p v-if="!isPOImport" class="text-xs text-amber-600 dark:text-amber-400 mt-1">
                PO Lokal hanya bisa menggunakan Ekspedisi
              </p>
            </div>

            <!-- Ekspedisi (if is_ekspedisi = true) -->
            <FieldPopup v-if="values.is_ekspedisi" id="m_ekspedisi_id" label="Ekspedisi" :value="values.m_ekspedisi_id"
              :displayValue="displayValues.ekspedisi" :errorText="errors.m_ekspedisi_id ? 'failed' : ''"
              @input="(v: string) => { values.m_ekspedisi_id = v; if (!v) displayValues.ekspedisi = '' }"
              @update:valueFull="(item: any) => displayValues.ekspedisi = item?.nama || ''"
              :hints="errors.m_ekspedisi_id" :required="!isReadOnly" :disabled="loading || isReadOnly"
              :readonly="isReadOnly" :clearable="!isReadOnly" placeholder="Pilih Ekspedisi" displayField="nama"
              valueField="id" :api="{
                url: `${API_BASE_URL}/dynamic/m_ekspedisi`,
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authStore.token}`
                },
                params: {
                  searchfield: 'nama,kode_ekspedisi',
                  filter_column_is_active: true
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page ? true : false
                  return response
                }
              }" :columns="[
                { field: 'kode_ekspedisi', headerName: 'Kode', width: '150px' },
                { field: 'nama', headerName: 'Nama Ekspedisi', flex: 1 }
              ]" />

            <!-- Forwarder/Supplier (if is_ekspedisi = false) -->
            <FieldPopup v-else id="supplier_id" label="Forwarder" :value="values.supplier_id"
              :displayValue="displayValues.supplier" :errorText="errors.supplier_id ? 'failed' : ''"
              @input="(v: string) => { values.supplier_id = v; if (!v) displayValues.supplier = '' }"
              @update:valueFull="(item: any) => displayValues.supplier = item?.nama_supp || ''"
              :hints="errors.supplier_id" :required="!isReadOnly" :disabled="loading || isReadOnly"
              :readonly="isReadOnly" :clearable="!isReadOnly" placeholder="Pilih Forwarder" displayField="nama_supp"
              valueField="id" :api="{
                url: `${API_BASE_URL}/dynamic/m_supplier`,
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authStore.token}`
                },
                params: {
                  join: true,
                  searchfield: 'nama_supp,kode_supp',
                  filter_column_is_active: true,
                  filter_column_value1: 'FORWARDER'
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page ? true : false
                  return response
                }
              }" :columns="[
                { field: 'kode_supp', headerName: 'Kode', width: '120px' },
                { field: 'nama_supp', headerName: 'Nama Supplier', flex: 1 },
                { field: 'value1', headerName: 'Tipe', width: '120px' }
              ]" />

            <!-- Currency -->
            <FieldPopup id="m_currency_id" label="Currency" :value="values.m_currency_id"
              :displayValue="displayValues.currency" :errorText="errors.m_currency_id ? 'failed' : ''"
              @input="(v: string) => { values.m_currency_id = v; if (!v) displayValues.currency = '' }"
              @update:valueFull="(item: any) => displayValues.currency = item?.nama_currency || ''"
              :hints="errors.m_currency_id" :required="!isReadOnly" :disabled="loading || isReadOnly"
              :readonly="isReadOnly" :clearable="!isReadOnly" placeholder="Pilih Currency" displayField="nama_currency"
              valueField="id" :api="{
                url: `${API_BASE_URL}/dynamic/m_currency`,
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${authStore.token}`
                },
                params: {
                  searchfield: 'nama_currency,kode_currency'
                },
                onsuccess: (response: any) => {
                  response.hasNext = response.pagination?.next_page ? true : false
                  return response
                }
              }" :columns="[
                { field: 'kode_currency', headerName: 'Kode', width: '100px' },
                { field: 'nama_currency', headerName: 'Currency', flex: 1 }
              ]" />

            <!-- Rate -->
            <div>
              <FieldNumber id="rate" label="Rate" :value="values.rate" :errorname="errors.rate ? 'failed' : ''"
                @input="v => values.rate = Number(v)"
                :hints="errors.rate || `Exchange rate terakhir: ${exchangeRateDisplay.toLocaleString('id-ID')} (${exchangeRateDate})`"
                :required="!isReadOnly" :disabled="loading || isReadOnly" :readonly="isReadOnly" placeholder="0"
                class="w-full" />
              <p v-if="selectedCurrencyData && currencyCode !== 'IDR'" class="text-xs text-muted-foreground mt-1">
                Masukkan nilai exchange rate secara manual (contoh: 15000 untuk 1 USD = Rp 15.000)
              </p>
            </div>

            <!-- Total Cost (Read Only - Calculated) -->
            <FieldNumber id="total_cost" label="Total Cost" :value="totalCost" :disabled="true" :readonly="true"
              placeholder="0" class="w-full" />

          </div>

          <!-- Catatan (Full Width) -->
          <FieldTextarea id="catatan" label="Catatan" :value="values.catatan" @input="v => values.catatan = v"
            :disabled="loading || isReadOnly" :readonly="isReadOnly" placeholder="Tambahkan catatan" class="w-full" />

        </CardContent>
      </Card>

      <!-- DETAIL CARD -->
      <Card>
        <CardHeader>
          <div class="flex items-center justify-between">
            <div>
              <CardTitle>Biaya Kirim Detail</CardTitle>
              <CardDescription>Kelola detail COA untuk biaya import</CardDescription>
            </div>
            <ButtonMultiSelect v-if="!isReadOnly" title="Pilih COA" @add="handleCOASelect" :api="{
              url: `${API_BASE_URL}/dynamic/m_coa`,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authStore.token}`
              },
              params: {
                searchfield: 'nama,kode',
                filter_column_status: true
              },
              onsuccess: (response: any) => {
                response.hasNext = response.pagination?.next_page ? true : false
                return response
              }
            }" :columns="[
              { field: 'kode', headerName: 'Kode COA', width: '150px', sortable: true },
              { field: 'nama', headerName: 'Nama COA', flex: 1, sortable: true }
            ]" :disabled="loading" />
          </div>
        </CardHeader>
        <CardContent>
          <div class="border rounded-lg overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-muted">
                <tr>
                  <th class="px-3 py-2 text-left font-medium">No</th>
                  <th class="px-3 py-2 text-left font-medium">No. Account</th>
                  <th class="px-3 py-2 text-left font-medium">Nama Account</th>
                  <th class="px-3 py-2 text-left font-medium">Amount</th>
                  <th class="px-3 py-2 text-left font-medium">Catatan</th>
                  <th v-if="!isReadOnly" class="px-3 py-2 text-center font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="detailItems.length === 0">
                  <td colspan="6" class="text-center py-8 text-muted-foreground">
                    Belum ada COA dipilih. Klik "Add to List" untuk menambahkan.
                  </td>
                </tr>
                <tr v-for="(detail, idx) in detailItems" :key="idx" class="border-t hover:bg-muted/50">
                  <td class="px-3 py-2">{{ idx + 1 }}</td>
                  <td class="px-3 py-2">{{ detail.kode_coa }}</td>
                  <td class="px-3 py-2">{{ detail.nama_coa }}</td>
                  <td class="px-3 py-2">
                    <input v-if="!isReadOnly" type="text" :value="formatNumber(detail.amount)"
                      @input="handleAmountInput($event, detail)" class="w-full px-2 py-1 border rounded text-sm"
                      placeholder="0" />
                    <span v-else>{{ formatNumber(detail.amount) }}</span>
                  </td>
                  <td class="px-3 py-2">
                    <input v-if="!isReadOnly" type="text" v-model="detail.catatan"
                      class="w-full px-2 py-1 border rounded text-sm" placeholder="Catatan" />
                    <span v-else>{{ detail.catatan || '-' }}</span>
                  </td>
                  <td v-if="!isReadOnly" class="px-3 py-2 text-center">
                    <DeleteButton variant="ghost" size="sm" @click="removeDetailItem(idx)" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AuditInfo
        v-if="(isViewMode || isEditMode) && !isCopyMode"
        :created-by="auditMeta.created_by"
        :created-at="auditMeta.createdAt"
        :updated-by="auditMeta.updated_by"
        :updated-at="auditMeta.updatedAt"
      />

      <!-- ACTION BUTTONS -->
      <div
        class="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-end sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t sm:border-0 -mx-6 px-6 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:static">
        <Button type="button" variant="outline" @click="handleCancel" :disabled="loading" class="w-full sm:w-auto">
          {{ isReadOnly ? 'Kembali' : 'Batal' }}
        </Button>
        <Button v-if="!isReadOnly" type="submit" :disabled="loading" class="gap-2 w-full sm:w-auto">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          {{ isEditMode ? 'Perbarui' : 'Simpan' }}
        </Button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.required::after {
  content: " *";
  color: hsl(var(--destructive));
}

/* Hide scrollbar but keep scrollable functionality */
.scrollbar-hide {
  -ms-overflow-style: none;
  /* IE and Edge */
  scrollbar-width: none;
  /* Firefox */
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
  /* Chrome, Safari, Opera */
}
</style>
