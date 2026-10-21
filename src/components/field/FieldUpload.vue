<script setup lang="ts">
import { ref, computed } from 'vue'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, Eye, X, Loader2 } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'

const { API_BASE_URL } = useApi()

interface Props {
  id?: string
  label: string
  value?: string
  disabled?: boolean
  readonly?: boolean
  errorname?: string
  hints?: string
  accept?: string
}

const props = withDefaults(defineProps<Props>(), {
  id: '',
  disabled: false,
  readonly: false,
  errorname: '',
  hints: '',
  accept: '.jpg,.jpeg,.png,.webp'
})

const emit = defineEmits<{
  input: [value: string]
  'update:value': [value: string]
}>()

const authStore = useAuthStore()
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const showPreview = ref(false)

const imageUrl = computed(() => {
  if (!props.value) return ''
  const value = props.value
  // If value is already full URL, use it
  if (value.startsWith('http')) return value
  // Otherwise, construct URL from filename (remove /api from BASE_URL if present)
  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, '')
  // If value already starts with 'uploads/', don't add it again
  if (value.startsWith('uploads/')) {
    return `${baseUrl}/${value}`
  }
  return `${baseUrl}/uploads/${value}`
})

const hasImage = computed(() => !!props.value)

const handleFileSelect = () => {
  fileInput.value?.click()
}

// Compress image while preserving the original format (JPEG → JPEG, PNG → PNG, WebP → WebP).
// Quality param applies to JPEG and WebP (lossy). PNG is lossless so quality is ignored,
// but we still resize it if dimensions exceed maxDimension.
const compressImage = (file: File, maxSizeMB = 5, quality = 0.8): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (e) => {
      const img = new Image()
      img.src = e.target?.result as string
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        // Calculate new dimensions (max 1920px width/height)
        const maxDimension = 1920
        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width
          width = maxDimension
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height
          height = maxDimension
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (ctx) {
          // For JPEG: fill white background to replace transparency
          if (file.type === 'image/jpeg') {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, width, height)
          }
          ctx.drawImage(img, 0, 0, width, height)
        }

        // Preserve original format. PNG stays PNG (lossless), JPEG stays JPEG, WebP stays WebP.
        const outputMime = file.type as 'image/jpeg' | 'image/png' | 'image/webp'
        const extMap: Record<string, string> = {
          'image/jpeg': '.jpg',
          'image/png': '.png',
          'image/webp': '.webp',
        }
        const outputExt = extMap[outputMime] ?? '.jpg'
        const baseName = file.name.replace(/\.[^.]+$/, '')

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Compression failed'))
              return
            }

            // If still too large and quality can be reduced, try lower quality
            // (only effective for JPEG/WebP — PNG is lossless)
            const compressedSizeMB = blob.size / (1024 * 1024)
            if (compressedSizeMB > maxSizeMB && quality > 0.3 && outputMime !== 'image/png') {
              compressImage(file, maxSizeMB, quality - 0.1).then(resolve).catch(reject)
              return
            }

            const compressedFile = new File([blob], `${baseName}${outputExt}`, {
              type: outputMime,
              lastModified: Date.now(),
            })
            resolve(compressedFile)
          },
          outputMime,
          quality
        )
      }
      img.onerror = () => reject(new Error('Failed to load image'))
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
  })
}

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (!file) return

  // Validate file type — only allow jpg, jpeg, png, webp
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  if (!ALLOWED_TYPES.includes(file.type)) {
    toast.error('Format tidak didukung. Gunakan JPG, JPEG, PNG, atau WEBP')
    if (target) target.value = ''
    return
  }

  uploading.value = true

  try {
    // Compress image before upload
    toast.info('Mengkompress gambar...')
    const compressedFile = await compressImage(file, 5, 0.8)
    
    const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2)
    const compressedSizeMB = (compressedFile.size / (1024 * 1024)).toFixed(2)
    
    console.log(`Original: ${originalSizeMB}MB → Compressed: ${compressedSizeMB}MB`)

    const formData = new FormData()
    // Use 'file' as field name to match backend expectation (from FE-MSC reference)
    formData.append('file', compressedFile)

    // Construct upload endpoint
    const uploadEndpoint = `${API_BASE_URL}/dynamic/m_file`

    const response = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authStore.token}`
      },
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Upload error:', errorText)
      throw new Error(`Upload gagal: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    
    // Handle various response structures from backend
    // For m_file endpoint, response is data.file
    const uploadedPath = result.data?.file || result.data?.file_path || result.file || result.file_path || result.data?.filename
    
    if (result.status === 'success' && uploadedPath) {
      // Emit filename/path only, not full URL
      emit('input', uploadedPath)
      emit('update:value', uploadedPath)
      toast.success('File berhasil diupload')
    } else {
      throw new Error(result.message || 'Upload gagal: file_path tidak ditemukan di response')
    }
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Upload gagal')
  } finally {
    uploading.value = false
    // Reset input
    if (target) target.value = ''
  }
}

const handleClear = () => {
  emit('input', '')
  emit('update:value', '')
  toast.info('File dihapus')
}

const handlePreview = () => {
  if (!hasImage.value) return
  showPreview.value = true
}
</script>

<template>
  <div class="space-y-2">
    <Label v-if="label" :for="id || label.toLowerCase().replace(/\s+/g, '-')">
      {{ label }}
    </Label>
    
    <div v-if="!readonly || !hasImage" class="flex gap-2">
      <!-- Hidden file input -->
      <input
        ref="fileInput"
        type="file"
        :accept="accept"
        class="hidden"
        :disabled="disabled || readonly || uploading"
        @change="handleFileChange"
      />

      <!-- Upload button -->
      <Button
        type="button"
        variant="outline"
        :disabled="disabled || readonly || uploading"
        @click="handleFileSelect"
        class="flex-1"
      >
        <Upload v-if="!uploading" class="h-4 w-4 mr-2" />
        <Loader2 v-else class="h-4 w-4 mr-2 animate-spin" />
        {{ uploading ? 'Mengupload...' : hasImage ? 'Ganti File' : (readonly ? 'Tidak ada file' : 'Upload File') }}
      </Button>

      <!-- Preview button -->
      <Button
        v-if="hasImage && !readonly"
        type="button"
        variant="outline"
        size="icon"
        @click="handlePreview"
        title="Preview"
      >
        <Eye class="h-4 w-4" />
      </Button>

      <!-- Clear button -->
      <Button
        v-if="hasImage && !readonly"
        type="button"
        variant="outline"
        size="icon"
        :disabled="disabled || uploading"
        @click="handleClear"
        title="Hapus"
      >
        <X class="h-4 w-4" />
      </Button>
    </div>

    <!-- Image Preview Inline -->
    <div v-if="hasImage" class="mt-2">
      <div 
        class="relative inline-block border rounded-md overflow-hidden cursor-pointer group bg-muted/30"
        :class="readonly ? 'max-w-full' : 'w-32 h-32'"
        @click="handlePreview"
      >
        <img 
          :src="imageUrl" 
          :alt="label" 
          class="transition-transform group-hover:scale-105" 
          :class="readonly ? 'max-h-64 w-auto object-contain' : 'w-full h-full object-cover'"
          @error="() => toast.error('Gagal memuat gambar')"
        />
        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Eye class="h-6 w-6 text-white" />
        </div>
      </div>
    </div>

    <!-- Current filename display -->
    <p v-if="hasImage && !readonly" class="text-xs text-muted-foreground truncate">
      File: {{ value }}
    </p>

    <!-- Hints or error message -->
    <p v-if="hints && !readonly" :class="['text-xs', errorname === 'failed' ? 'text-destructive' : 'text-muted-foreground']">
      {{ hints }}
    </p>

    <!-- Preview Popup -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showPreview"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 dark:bg-black/95 p-4 overflow-hidden"
          @click="showPreview = false"
        >
          <div class="relative w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col items-center justify-center gap-4">
            <!-- Close button -->
            <Button
              variant="ghost"
              size="icon"
              class="absolute top-0 right-0 text-white hover:bg-white/20 dark:hover:bg-white/10 z-10"
              @click="showPreview = false"
            >
              <X class="h-6 w-6" />
            </Button>
            
            <!-- Image container -->
            <div class="flex items-center justify-center rounded-lg bg-white dark:bg-gray-900 p-4 max-w-full max-h-full overflow-hidden">
              <img 
                :src="imageUrl" 
                :alt="label"
                class="max-w-[90vw] max-h-[85vh] w-auto h-auto object-contain"
                @click.stop
                @error="() => toast.error('Gagal memuat gambar')"
              />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>