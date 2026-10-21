<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, X } from 'lucide-vue-next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  open: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const { API_BASE_URL } = useApi()
const authStore = useAuthStore()

const loading = ref(false)
const items = ref<Array<any>>([])
const searchQuery = ref('')

const filteredItems = computed(() => {
  if (!searchQuery.value.trim()) return items.value
  const q = searchQuery.value.toLowerCase()
  return items.value.filter(m => {
    const code = (m.code || m.key1 || '').toLowerCase()
    const symbol = (m.value2 || '').toLowerCase()
    const currency = (m.value1 || '').toLowerCase()
    const name = (m.value3 || '').toLowerCase()
    const country = (m.value4 || '').toLowerCase()
    return code.includes(q) || symbol.includes(q) || currency.includes(q) || name.includes(q) || country.includes(q)
  })
})

const fetchMoney = async () => {
  loading.value = true
  try {
    const url = new URL(`${API_BASE_URL}/dynamic/money`)
    url.searchParams.set('no_pagination', 'true')
    const res = await fetch(url.toString(), {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
    })
    const data = await res.json()
    items.value = Array.isArray(data?.data) ? data.data : []
  } catch (e) {
    items.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  (val) => {
    if (val) fetchMoney()
  }
)

onMounted(() => {
  if (props.open) fetchMoney()
})

const close = () => emit('update:open', false)
</script>

<template>
  <Dialog :open="open" @update:open="(v) => emit('update:open', v)">
    <DialogContent class="max-w-6xl!">
      <DialogHeader>
        <DialogTitle class="text-lg">Daftar Currency (Money)</DialogTitle>
      </DialogHeader>

      <div class="flex items-center gap-2 mb-3">
        <div class="flex-1 relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            placeholder="Cari berdasarkan kode, simbol, atau negara..."
            class="pl-9 pr-9"
          />
          <Button
            v-if="searchQuery"
            type="button"
            size="icon"
            variant="ghost"
            class="absolute right-0 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-white"
            @click="searchQuery = ''"
          >
            <X class="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div class="border rounded-md overflow-hidden">
        <div class="max-h-[60vh] overflow-auto">
          <table class="w-full text-sm">
            <thead class="bg-muted/50">
              <tr>
                <th class="text-left px-3 py-2 w-[140px]">Code</th>
                <th class="text-left px-3 py-2 w-[100px]">Simbol</th>
                <th class="text-left px-3 py-2">Mata Uang</th>
                <th class="text-left px-3 py-2">Nama</th>
                <th class="text-left px-3 py-2">Negara</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loading">
                <td colspan="5" class="px-3 py-4 text-center text-muted-foreground">Memuat data...</td>
              </tr>
              <tr v-else-if="!filteredItems.length">
                <td colspan="5" class="px-3 py-4 text-center text-muted-foreground">{{ searchQuery ? 'Tidak ada hasil pencarian' : 'Tidak ada data' }}</td>
              </tr>
              <tr v-else v-for="m in filteredItems" :key="m.id" class="border-t">
                <td class="px-3 py-2 font-medium">{{ m.code || m.key1 }}</td>
                <td class="px-3 py-2">{{ m.value2 }}</td>
                <td class="px-3 py-2">{{ m.value1 }}</td>
                <td class="px-3 py-2">{{ m.value3 }}</td>
                <td class="px-3 py-2">{{ m.value4 }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-3">
        <Button variant="outline" @click="close">Tutup</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
