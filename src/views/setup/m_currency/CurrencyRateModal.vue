<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FieldDateTime, FieldNumber } from '@/components/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getCurrencyRates, createCurrencyRate, updateCurrencyRate } from './service'
import { Loader2 } from 'lucide-vue-next'

interface Props {
  isOpen: boolean
  currencyId?: string
  currencyName?: string
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
})

const emit = defineEmits<{
  close: []
  success: [data: any]
}>()

const loading = ref(false)
const existingRates = ref<any[]>([])
const loadingRates = ref(false)

// Form state - selalu fresh untuk POST baru
const formData = reactive({
  tgl_mulai: '',
  rate: 0,
  catatan: '',
})

const errors = reactive({
  tgl_mulai: '',
  rate: ''
})

// Fetch existing rates untuk currency yang dipilih
const fetchExistingRates = async () => {
  if (!props.currencyId) {
    console.log('No currencyId provided')
    return
  }
  
  loadingRates.value = true
  try {
    console.log('Fetching rates for currencyId:', props.currencyId)
    const response = await getCurrencyRates(props.currencyId)
    console.log('Fetched rates response:', response)
    
    // Sort berdasarkan createdAt terbaru (descending)
    const sorted = (response.data || []).sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || 0).getTime()
      const dateB = new Date(b.createdAt || 0).getTime()
      return dateB - dateA
    })
    
    existingRates.value = sorted
    console.log('Set existingRates (sorted) to:', existingRates.value)
  } catch (error) {
    console.error('Error fetching rates:', error)
    toast.error('Gagal memuat data rate', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
    existingRates.value = []
  } finally {
    loadingRates.value = false
  }
}

// Watch untuk fetch data saat modal dibuka dan set default form value
watch(() => props.isOpen, (newVal) => {
  console.log('isOpen changed to:', newVal, 'currencyId:', props.currencyId)
  if (newVal && props.currencyId) {
    // Set default tanggal & jam sekarang
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const date = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    
    formData.tgl_mulai = `${year}-${month}-${date}T${hours}:${minutes}`
    
    fetchExistingRates()
  }
})

// Computed untuk button label
const submitButtonLabel = computed(() => {
  return 'Tambah Rate'
})

// Computed untuk modal title
const modalTitle = computed(() => {
  if (props.currencyName) {
    return `Tambah Rate ${props.currencyName}`
  }
  return `Tambah Rate`
})

// Validasi form
const validateForm = () => {
  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })

  let isValid = true

  if (!formData.tgl_mulai?.trim()) {
    errors.tgl_mulai = 'Tanggal mulai wajib diisi'
    isValid = false
  }

  if (!formData.rate || formData.rate === 0) {
    errors.rate = 'Rate wajib diisi dan tidak boleh 0'
    isValid = false
  }

  return isValid
}

// Handle submit
const handleSubmit = async () => {
  if (!validateForm()) {
    toast.error('Validasi gagal', { description: 'Mohon lengkapi semua field dengan benar' })
    return
  }

  if (!props.currencyId) {
    toast.error('Currency ID tidak ditemukan')
    return
  }

  loading.value = true
  try {
    // Jika ada rate active sebelumnya, update tgl_selesai dan is_active menjadi false
    const activeRate = existingRates.value.find((r: any) => r.is_active === true)
    if (activeRate && activeRate.id) {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const date = String(now.getDate()).padStart(2, '0')
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      
      await updateCurrencyRate(activeRate.id, {
        tgl_selesai: `${year}-${month}-${date}T${hours}:${minutes}`,
        is_active: false,
      })
    }

    // POST untuk create rate baru
    const payload = {
      m_currency_id: props.currencyId!,
      tgl_mulai: formData.tgl_mulai,
      rate: Number(formData.rate),
      catatan: formData.catatan || undefined,
      is_active: true,
    }

    const response = await createCurrencyRate(payload)
    
    toast.success('Rate berhasil ditambahkan', {
      description: `Rate Rp ${Number(formData.rate).toLocaleString('id-ID')} untuk ${props.currencyName || 'currency'} telah ditambahkan`
    })

    emit('success', response.data)
    handleClose()
  } catch (error) {
    toast.error('Gagal menambah rate', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan'
    })
  } finally {
    loading.value = false
  }
}

// Handle close
const handleClose = () => {
  // Reset form
  formData.tgl_mulai = ''
  formData.rate = 0
  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
  
  emit('close')
}
</script>

<template>
  <Dialog :open="isOpen" @update:open="handleClose">
    <DialogContent class="max-w-4xl!">
      <DialogHeader>
        <DialogTitle>{{ modalTitle }}</DialogTitle>
        <DialogDescription>
          Kelola exchange rate untuk currency ini
        </DialogDescription>
      </DialogHeader>

      <!-- 2 Column Layout -->
      <div class="grid grid-cols-2 gap-6">
        <!-- LEFT: Form untuk tambah/edit rate -->
        <div class="space-y-4">
          <div class="text-sm font-semibold">Tambah Rate Baru</div>
          
          <form @submit.prevent="handleSubmit" class="space-y-4">
            <!-- Tanggal Mulai -->
            <FieldDateTime
              id="tgl_mulai"
              label="Tanggal Mulai"
              :value="formData.tgl_mulai"
              @input="(v: string) => formData.tgl_mulai = v"
              :errorname="errors.tgl_mulai ? 'failed' : ''"
              :hints="errors.tgl_mulai"
              placeholder="Pilih tanggal & jam"
              :disabled="true"
              clearable
            />

            <!-- Rate -->
            <FieldNumber
              id="rate"
              label="Rate"
              type="decimal"
              :value="formData.rate"
              @input="(v: string) => formData.rate = Number(v)"
              :errorname="errors.rate ? 'failed' : ''"
              :hints="errors.rate || `Rp ${formData.rate.toLocaleString('id-ID')}`"
              placeholder="0.00"
              :disabled="loading"
            />

            <!-- Catatan -->
            <div class="space-y-2">
              <Label for="catatan" class="text-sm font-medium">Catatan (Opsional)</Label>
              <Input
                id="catatan"
                v-model="formData.catatan"
                type="text"
                placeholder="Tambahkan catatan untuk rate ini"
                :disabled="loading"
              />
            </div>

            <!-- Action Buttons -->
            <div class="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                @click="handleClose"
                :disabled="loading"
              >
                Batal
              </Button>
              <Button
                type="submit"
                :disabled="loading"
                class="gap-2"
              >
                <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
                {{ submitButtonLabel }}
              </Button>
            </div>
          </form>
        </div>

        <!-- RIGHT: List existing rates -->
        <div class="space-y-4 border-l pl-6">
          <div class="text-sm font-semibold">Rate yang Sudah Ada</div>
          
          <div v-if="loadingRates" class="text-sm text-muted-foreground py-4">
            <div class="animate-pulse">Memuat data...</div>
          </div>
          <div v-else-if="existingRates.length > 0" class="space-y-2 max-h-64 overflow-y-auto">
            <div 
              v-for="rate in existingRates" 
              :key="rate.id"
              class="p-3 bg-muted rounded text-sm hover:bg-muted/80 transition-colors space-y-1"
            >
              <div class="flex flex-col">
                <span class="font-medium text-base">Rp {{ Number(rate.rate).toLocaleString('id-ID') }}</span>
                <span class="text-xs text-muted-foreground">
                  Mulai: {{ new Date(rate.tgl_mulai).toLocaleDateString('id-ID') }} {{ new Date(rate.tgl_mulai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }}
                </span>
                <span v-if="rate.tgl_selesai" class="text-xs text-muted-foreground">
                  Selesai: {{ new Date(rate.tgl_selesai).toLocaleDateString('id-ID') }} {{ new Date(rate.tgl_selesai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }}
                </span>
                <span v-if="rate.catatan" class="text-xs text-muted-foreground italic">
                  Catatan: {{ rate.catatan }}
                </span>
                <span :class="['text-xs font-semibold', rate.is_active ? 'text-green-600' : 'text-red-600']">
                  {{ rate.is_active ? 'Aktif' : 'Tidak Aktif' }}
                </span>
              </div>
            </div>
          </div>
          <div v-else class="text-sm text-muted-foreground py-8 text-center">
            Tidak ada rate yang tersimpan
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
