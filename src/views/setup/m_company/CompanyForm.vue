<script setup lang="ts">
// ============================================================================
// IMPORTS
// ============================================================================
import { ref, reactive, onBeforeMount, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldX, FieldSelect, FieldUpload, FieldStatus } from '@/components/field'
import { createCompany, updateCompany, getCompanyById } from './service'
import { ArrowLeft, Save, Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'

// ============================================================================
// COMPOSABLES
// ============================================================================
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const { API_BASE_URL } = useApi()

// ============================================================================
// STATE
// ============================================================================
const loading = ref(false)
const groupCompanyOptions = ref<Array<{ value: string; label: string }>>([])
const tipeBisnisOptions = ref<Array<{ value: string; label: string }>>([])
const isEditMode = computed(() => !!route.params.id && route.name === 'CompanyForm')
const isViewMode = computed(() => route.name === 'CompanyView')
const isCopyMode = computed(() => route.query.action === 'copy' && !!route.query.source)
const isReadOnly = computed(() => isViewMode.value || route.meta.readOnly === true)
const menuId = computed(() => route.params.id as string)

const pageTitle = computed(() => {
  if (isViewMode.value) return 'Detail Company'
  if (isCopyMode.value) return 'Salin Company'
  if (isEditMode.value) return 'Edit Company'
  return 'Tambah Company Baru'
})

const pageDescription = computed(() => {
  if (isViewMode.value) return 'Lihat detail data Company'
  if (isCopyMode.value) return 'Buat Company baru dari data yang disalin'
  if (isEditMode.value) return 'Perbarui data Company'
  return 'Buat Company baru'
})

const values = reactive({
  nama: '',
  kode: '',
  group_company: '',
  tipe_bisnis: '',
  kepemilikan_persen: '',
  npwp: '',
  npwp_foto: '',
  idtku: '',
  alamat: '',
  telepon: '',
  provinsi: '',
  kota: '',
  kecamatan: '',
  kode_pos: '',
  logo_img: '',
  status: true,
  catatan: '',
})

let initialValues: Record<string, any> = {}

const errors = reactive({
  nama: '',
  npwp: '',
  idtku: '',
  telepon: '',
  provinsi: '',
  kota: '',
  kode_pos: ''
})

const digitRules = {
  npwp: {
    max: 16,
    limitMessage: 'NPWP maksimal 16 digit angka',
    hint: 'Isi 16 digit angka NPWP'
  },
  idtku: {
    max: 22,
    limitMessage: 'ID TKU maksimal 22 digit angka',
    hint: 'Isi angka ID TKU'
  },
  telepon: {
    max: 15,
    limitMessage: 'Nomor telepon maksimal 15 digit angka',
    hint: 'Isi 8 sampai 15 digit angka'
  },
  kode_pos: {
    max: 5,
    limitMessage: 'Kode pos maksimal 5 digit angka',
    hint: 'Isi 5 digit angka kode pos'
  }
} as const

const digitsOnly = (value: string) => String(value || '').replace(/\D/g, '')

const parseNullableBigInt = (value: string) => {
  const cleaned = digitsOnly(value)
  if (!cleaned || cleaned === '-') return null
  const parsed = Number(cleaned)
  return Number.isNaN(parsed) ? null : parsed
}

const setDigitInput = (
  field: 'npwp' | 'idtku' | 'telepon' | 'kode_pos',
  value: string
) => {
  const cleaned = digitsOnly(value)
  const rule = digitRules[field]

  if (cleaned.length > rule.max) {
    errors[field] = rule.limitMessage
    toast.warning(rule.limitMessage)
    return
  }

  values[field] = cleaned
  errors[field] = ''
}

const showDigitLimitWarning = (field: 'npwp' | 'idtku' | 'telepon' | 'kode_pos') => {
  const rule = digitRules[field]
  errors[field] = rule.limitMessage
  toast.warning(rule.limitMessage)
}

const validateDigitLength = (
  field: 'npwp' | 'idtku' | 'telepon' | 'kode_pos',
  message: string,
  options: { exact?: number; min?: number; max?: number }
) => {
  const value = values[field]
  if (!value) {
    errors[field] = ''
    return true
  }

  const length = value.length
  if (options.exact && length !== options.exact) {
    errors[field] = message
    return false
  }

  if ((options.min && length < options.min) || (options.max && length > options.max)) {
    errors[field] = message
    return false
  }

  return true
}

const validateCompanyNumberFields = () => {
  const checks = [
    validateDigitLength('npwp', 'NPWP harus berisi 16 digit angka', { exact: 16 }),
    validateDigitLength('idtku', 'ID TKU hanya boleh berisi angka sampai 22 digit', { max: 22 }),
    validateDigitLength('telepon', 'Nomor telepon harus berisi 8 sampai 15 digit angka', { min: 8, max: 15 }),
    validateDigitLength('kode_pos', 'Kode pos harus berisi 5 digit angka', { exact: 5 })
  ]

  const valid = checks.every(Boolean)
  if (!valid) {
    toast.error('Periksa kembali data angka', {
      description: 'Beberapa nomor belum sesuai format yang diminta'
    })
    return
  }

  return valid
}

const toBoolean = (value: unknown) => value === true || value === 1 || value === '1'
const setIntegerInput = (field: 'kepemilikan_persen', value: string) => {
  values[field] = digitsOnly(value)
}

// ============================================================================
// RESET FORM HANDLER
// ============================================================================
const onReset = () => {
  Object.assign(values, {
    nama: '',
    kode: '',
    group_company: '',
    tipe_bisnis: '',
    kepemilikan_persen: '',
    npwp: '',
    npwp_foto: '',
    idtku: '',
    alamat: '',
    telepon: '',
    provinsi: '',
    kota: '',
    kecamatan: '',
    kode_pos: '',
    logo_img: '',
    status: true,
    catatan: '',
  })

  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = ''
  })
}

// ============================================================================
// LIFECYCLE
// ============================================================================
onBeforeMount(async () => {
  onReset()

  try {
    const [groupCompanyResponse, tipeBisnisResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/dynamic/m_general?no_pagination=true&filter_column_is_active=true&filter_column_key1=group_company`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.token}`
        }
      }),
      fetch(`${API_BASE_URL}/dynamic/m_general?no_pagination=true&filter_column_is_active=true&filter_column_key1=tipe_bisnis`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authStore.token}`
        }
      })
    ])

    const [groupCompanyResult, tipeBisnisResult] = await Promise.all([
      groupCompanyResponse.json(),
      tipeBisnisResponse.json()
    ])

    groupCompanyOptions.value = Array.isArray(groupCompanyResult?.data)
      ? groupCompanyResult.data.map((item: any) => ({
          value: item.id,
          label: item.value1 || item.code || item.id
        }))
      : []

    tipeBisnisOptions.value = Array.isArray(tipeBisnisResult?.data)
      ? tipeBisnisResult.data.map((item: any) => ({
          value: item.id,
          label: item.value1 || item.code || item.id
        }))
      : []
  } catch (error) {
    console.error('Failed to load company master options:', error)
  }

  const isCopyModeLocal = route.query.action === 'copy' && route.query.source
  const sourceId = isCopyModeLocal ? String(route.query.source) : menuId.value

  if (!(isEditMode.value || isViewMode.value || isCopyModeLocal)) {
    return
  }

  loading.value = true
  try {
    const res = await getCompanyById(sourceId)

    if (res.status !== 'success') throw new Error('Gagal memuat data')
    initialValues = res.data

    if (isCopyModeLocal) {
      delete (initialValues as any).id
      delete (initialValues as any).createdAt
      delete (initialValues as any).updatedAt
      delete (initialValues as any).created_by
      delete (initialValues as any).updated_by
    }

    initialValues.npwp = initialValues.npwp === null || initialValues.npwp === undefined ? '' : String(initialValues.npwp)
    initialValues.idtku = initialValues.idtku === null || initialValues.idtku === undefined ? '' : String(initialValues.idtku)
    initialValues.telepon = initialValues.telepon === null || initialValues.telepon === undefined ? '' : String(initialValues.telepon)
    initialValues.kode_pos = initialValues.kode_pos === null || initialValues.kode_pos === undefined ? '' : String(initialValues.kode_pos)
    initialValues.kepemilikan_persen = initialValues.kepemilikan_persen === null || initialValues.kepemilikan_persen === undefined ? '' : String(initialValues.kepemilikan_persen)
    initialValues.status = initialValues.status === undefined || initialValues.status === null ? true : toBoolean(initialValues.status)

    for (const key in initialValues) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        ;(values as any)[key] = initialValues[key]
      }
    }

    if (isCopyModeLocal) {
      toast.success('Data berhasil disalin', {
        description: 'Silakan edit dan simpan sebagai Company baru'
      })
    } else {
      toast.success('Data berhasil dimuat')
    }
  } catch (error) {
    toast.error('Gagal memuat data Company', {
      description: error instanceof Error ? error.message : 'Terjadi kesalahan',
      action: {
        label: 'Kembali',
        onClick: () => router.push('/setup/m_company')
      }
    })
    setTimeout(() => router.push('/setup/m_company'), 2000)
  } finally {
    loading.value = false
  }
})

// ============================================================================
// SAVE HANDLER
// ============================================================================
const onSave = async () => {
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof errors] = ''
  })

  if (!validateCompanyNumberFields()) {
    return
  }

  loading.value = true
  try {
    const payload = {
      kode: values.kode?.trim() || null,
      group_company: values.group_company?.trim() || null,
      tipe_bisnis: values.tipe_bisnis?.trim() || null,
      kepemilikan_persen: values.kepemilikan_persen ? Number(values.kepemilikan_persen) : null,
      npwp: parseNullableBigInt(values.npwp),
      npwp_foto: values.npwp_foto?.trim() || null,
      idtku: parseNullableBigInt(values.idtku),
      telepon: parseNullableBigInt(values.telepon),
      kode_pos: parseNullableBigInt(values.kode_pos),
      nama: values.nama?.trim() || null,
      kota: values.kota?.trim() || null,
      kecamatan: values.kecamatan?.trim() || null,
      alamat: values.alamat?.trim() || null,
      logo_img: values.logo_img?.trim() || null,
      provinsi: values.provinsi?.trim() || null,
      status: values.status,
      catatan: values.catatan?.trim() || null,
    }

    if (isEditMode.value) {
      ;(payload as any).updated_by = authStore.user?.id || null
      await updateCompany(menuId.value, payload as any)
      toast.success('Company berhasil diperbarui', {
        description: `Company "${values.nama || 'tanpa nama'}" telah diperbarui`
      })
    } else {
      ;(payload as any).created_by = authStore.user?.id || null
      await createCompany(payload as any)
      toast.success('Company berhasil dibuat', {
        description: `Company "${values.nama || 'tanpa nama'}" telah ditambahkan`
      })
    }

    router.replace('/setup/m_company?reload=' + Date.now())
  } catch (error) {
    toast.error(isEditMode.value ? 'Gagal memperbarui Company' : 'Gagal membuat Company', {
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
  router.push('/setup/m_company')
}
</script>

<template>
  <div class="p-6 space-y-6 mx-auto">
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

    <form class="space-y-6" @submit.prevent>
      <Card>
        <CardHeader>
          <CardTitle>Informasi Company</CardTitle>
          <CardDescription>
            Isi data company sesuai struktur master company.
          </CardDescription>
        </CardHeader>
        <CardContent class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FieldX
              id="kode"
              label="Kode Company"
              :value="values.kode"
              @input="v => values.kode = v"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Kode company"
              class="w-full"
            />

            <FieldX
              id="nama"
              label="Nama Company"
              :value="values.nama"
              :errorname="errors.nama ? 'failed' : ''"
              @input="v => values.nama = v"
              :hints="errors.nama"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Nama company"
              class="w-full"
            />

            <FieldSelect
              id="group_company"
              label="Group Company"
              :value="values.group_company"
              @input="(v: any) => values.group_company = v"
              :options="groupCompanyOptions"
              :bind="{ disabled: loading || isReadOnly, clearable: true }"
              placeholder="Pilih group company"
              class="w-full"
            />

            <FieldSelect
              id="tipe_bisnis"
              label="Tipe Bisnis"
              :value="values.tipe_bisnis"
              @input="(v: any) => values.tipe_bisnis = v"
              :options="tipeBisnisOptions"
              :bind="{ disabled: loading || isReadOnly, clearable: true }"
              placeholder="Pilih tipe bisnis"
              class="w-full"
            />

            <FieldX
              id="kepemilikan_persen"
              label="Kepemilikan (%)"
              type="tel"
              :value="values.kepemilikan_persen"
              @input="v => setIntegerInput('kepemilikan_persen', v)"
              inputmode="numeric"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Persentase kepemilikan"
              class="w-full"
            />

            <FieldX
              id="npwp"
              label="NPWP"
              type="tel"
              :value="values.npwp"
              @input="v => setDigitInput('npwp', v)"
              :errorname="errors.npwp ? 'failed' : ''"
              :hints="errors.npwp || digitRules.npwp.hint"
              :maxlength="digitRules.npwp.max"
              inputmode="numeric"
              @input-limit="showDigitLimitWarning('npwp')"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="NPWP company"
              class="w-full"
            />

            <FieldUpload
              id="npwp_foto"
              label="Foto NPWP"
              :value="values.npwp_foto"
              @input="v => values.npwp_foto = v"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              hints="Upload foto NPWP (.jpg, .jpeg, .png, .webp, max 5MB)"
              accept="image/*"
              class="w-full"
            />

            <FieldX
              id="idtku"
              label="ID TKU"
              type="tel"
              :value="values.idtku"
              @input="v => setDigitInput('idtku', v)"
              :errorname="errors.idtku ? 'failed' : ''"
              :hints="errors.idtku || digitRules.idtku.hint"
              :maxlength="digitRules.idtku.max"
              inputmode="numeric"
              @input-limit="showDigitLimitWarning('idtku')"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="ID TKU"
              class="w-full"
            />

            <FieldX
              id="telepon"
              label="Telepon"
              type="tel"
              :value="values.telepon"
              @input="v => setDigitInput('telepon', v)"
              :errorname="errors.telepon ? 'failed' : ''"
              :hints="errors.telepon || digitRules.telepon.hint"
              :maxlength="digitRules.telepon.max"
              inputmode="numeric"
              @input-limit="showDigitLimitWarning('telepon')"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="Nomor telepon"
              class="w-full"
            />

            <FieldSelect
              id="provinsi"
              label="Provinsi"
              :value="values.provinsi"
              @input="(v: any) => { values.provinsi = v; values.kota = ''; values.kecamatan = '' }"
              @update:valueFull="(objVal: any) => { if (!objVal) { values.kota = ''; values.kecamatan = '' } }"
              :api="{
                url: 'https://backend.qqltech.com/kodepos/region/provinsi',
                params: { search: '', searchfield: 'name', selectfield: 'name,id', paginate: 35 },
                fullUrl: true
              } as any"
              :bind="{ disabled: loading || isReadOnly, clearable: true }"
              :errorname="errors.provinsi ? 'failed' : ''"
              :hints="errors.provinsi"
              :required="false"
              placeholder="Pilih Provinsi"
              class="w-full"
            />

            <FieldSelect
              id="kota"
              label="Kota"
              :value="values.kota"
              @input="(v: any) => { values.kota = v; values.kecamatan = '' }"
              @update:valueFull="(objVal: any) => { if (!objVal) values.kecamatan = '' }"
              :api="{
                url: 'https://backend.qqltech.com/kodepos/region/kabupaten-kota',
                params: {
                  provinsi: values.provinsi,
                  search: '',
                  searchfield: 'name',
                  selectfield: 'name,id',
                  paginate: 35
                },
                fullUrl: true
              } as any"
              :bind="{ disabled: !values.provinsi || loading || isReadOnly, clearable: true }"
              :errorname="errors.kota ? 'failed' : ''"
              :hints="errors.kota"
              :required="false"
              placeholder="Pilih Kota"
              class="w-full"
            />

            <FieldSelect
              id="kecamatan"
              label="Kecamatan (Opsional)"
              :value="values.kecamatan"
              @input="(v: any) => values.kecamatan = v"
              :api="{
                url: 'https://backend.qqltech.com/kodepos/region/kecamatan',
                params: { kota: values.kota },
                fullUrl: true
              } as any"
              valueField="key"
              displayField="key"
              :bind="{ disabled: !values.kota || loading || isReadOnly, clearable: true }"
              placeholder="Pilih Kecamatan"
              class="w-full"
            />

            <FieldX
              id="kode_pos"
              label="Kode Pos"
              type="tel"
              :value="values.kode_pos"
              @input="v => setDigitInput('kode_pos', v)"
              :errorname="errors.kode_pos ? 'failed' : ''"
              :hints="errors.kode_pos || digitRules.kode_pos.hint"
              :maxlength="digitRules.kode_pos.max"
              inputmode="numeric"
              @input-limit="showDigitLimitWarning('kode_pos')"
              :required="false"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              placeholder="12345"
              class="w-full"
            />

            <FieldUpload
              id="logo_img"
              label="Logo Image"
              :value="values.logo_img"
              @input="v => values.logo_img = v"
              :disabled="loading || isReadOnly"
              :readonly="isReadOnly"
              hints="Upload logo company (.jpg, .jpeg, .png, .webp, max 5MB)"
              accept="image/*"
              class="w-full"
            />

            <FieldStatus
              label="Status"
              name="status"
              v-model="values.status"
              :disabled="loading"
              :readonly="isReadOnly"
              active-text="Aktif"
              inactive-text="Tidak Aktif"
            />
          </div>

          <FieldX
            id="alamat"
            type="textarea"
            label="Alamat"
            v-model="values.alamat"
            :required="false"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            placeholder="Alamat company"
            class="w-full"
          />

          <FieldX
            id="catatan"
            type="textarea"
            label="Catatan"
            v-model="values.catatan"
            :required="false"
            :disabled="loading || isReadOnly"
            :readonly="isReadOnly"
            placeholder="Catatan tambahan"
            class="w-full"
          />
        </CardContent>
      </Card>

      <div
        class="flex flex-col-reverse sm:flex-row items-center gap-3 sm:justify-end sticky bottom-0 bg-background/95 backdrop-blur py-4 border-t sm:border-0 -mx-6 px-6 sm:mx-0 sm:px-0 sm:bg-transparent sm:backdrop-blur-none sm:py-0 sm:static"
      >
        <Button type="button" variant="outline" @click="handleCancel" :disabled="loading" class="w-full sm:w-auto">
          {{ isReadOnly ? 'Kembali' : 'Batal' }}
        </Button>
        <Button v-if="!isReadOnly" type="button" @click="onSave" :disabled="loading" class="gap-2 w-full sm:w-auto">
          <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          {{ isEditMode ? 'Perbarui' : 'Simpan' }}
        </Button>
      </div>
    </form>
  </div>
</template>
