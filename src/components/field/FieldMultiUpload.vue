<script setup lang="ts">
import { ref, computed } from 'vue'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, Eye, X, Loader2, ChevronLeft, ChevronRight, Trash2, FileText, FileDown } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth'
import { useApi } from '@/composables/useApi'

const { API_BASE_URL } = useApi()

interface ImageItem {
  gambar: string
  lampiran?: string
  file_type?: string
  file_name?: string
}

interface Props {
  id?: string
  label: string
  value?: ImageItem[]
  disabled?: boolean
  readonly?: boolean
  errorname?: string
  hints?: string
  accept?: string
  maxImages?: number
}

const props = withDefaults(defineProps<Props>(), {
  id: '',
  disabled: false,
  readonly: false,
  errorname: '',
  hints: '',
  accept: '.jpg,.jpeg,.png,.webp',
  maxImages: 10
})

const emit = defineEmits<{
  input: [value: ImageItem[]]
  'update:value': [value: ImageItem[]]
}>()

const authStore = useAuthStore()
const fileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const showPreview = ref(false)
const currentPreviewIndex = ref(0)

const images = computed(() => props.value || [])
const hasImages = computed(() => images.value.length > 0)
const canAddMore = computed(() => images.value.length < props.maxImages)

const getImageUrl = (imagePath?: string) => {
  if (!imagePath) return ''
  // If value is already full URL, use it
  if (imagePath.startsWith('http')) return imagePath
  // Otherwise, construct URL from filename
  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, '')
  // If value already starts with 'uploads/', don't add it again
  if (imagePath.startsWith('uploads/')) {
    return `${baseUrl}/${imagePath}`
  }
  return `${baseUrl}/uploads/${imagePath}`
}

const isImageFile = (item?: ImageItem) => {
  if (!item) return false
  const path = item.gambar || item.lampiran || ''
  const fileType = item.file_type || ''
  return fileType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp|avif|svg)$/i.test(path)
}

const isPdfFile = (item?: ImageItem) => {
  if (!item) return false
  const path = item.gambar || item.lampiran || ''
  const fileType = item.file_type || ''
  return fileType === 'application/pdf' || path.toLowerCase().endsWith('.pdf')
}

const getFileName = (item?: ImageItem) => {
  if (!item) return 'file'
  if (item.file_name) return item.file_name
  const path = item.gambar || item.lampiran || ''
  return path.split('/').pop() || 'file'
}

const currentPreviewUrl = computed(() => {
  if (!hasImages.value) return ''
  return getImageUrl(images.value[currentPreviewIndex.value]?.gambar || '')
})

const handleFileSelect = () => {
  if (!canAddMore.value) {
    toast.warning(`Maksimal ${props.maxImages} gambar`)
    return
  }
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
  const files = target.files

  if (!files || files.length === 0) return

  // Check if adding these files would exceed max
  if (images.value.length + files.length > props.maxImages) {
    toast.warning(`Maksimal ${props.maxImages} gambar. Anda bisa menambahkan ${props.maxImages - images.value.length} gambar lagi`)
    return
  }

  uploading.value = true
  const uploadedImages: ImageItem[] = []

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      if (!file) continue

      // Validate file type — only allow jpg, jpeg, png, webp
      const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`Format tidak didukung: ${file.name}. Gunakan JPG, JPEG, PNG, atau WEBP`)
        continue
      }

      // Validate file size (max 5MB)
      const fileSizeMB = file.size / (1024 * 1024)
      if (fileSizeMB > 5) {
        toast.error(`File ${file.name} terlalu besar (max 5MB)`)
        continue
      }

      toast.info(`Mengkompress gambar ${i + 1}/${files.length}...`)
      const compressedFile = await compressImage(file, 5, 0.8)

      const originalSizeMB = (file.size / (1024 * 1024)).toFixed(2)
      const compressedSizeMB = (compressedFile.size / (1024 * 1024)).toFixed(2)
      console.log(`${file.name}: ${originalSizeMB}MB → ${compressedSizeMB}MB`)

      const fileToUpload = compressedFile

      const formData = new FormData()
      formData.append('file', fileToUpload)

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
      const uploadedPath = result.data?.file || result.data?.file_path || result.file || result.file_path || result.data?.filename

      if (result.status === 'success' && uploadedPath) {
        uploadedImages.push({
          gambar: uploadedPath,
          lampiran: uploadedPath,
          file_type: fileToUpload.type,
          file_name: fileToUpload.name
        })
      } else {
        throw new Error(result.message || 'Upload gagal: file_path tidak ditemukan di response')
      }
    }

    // Add new images to existing array
    const updatedImages = [...images.value, ...uploadedImages]
    emit('input', updatedImages)
    emit('update:value', updatedImages)

    toast.success(`${uploadedImages.length} gambar berhasil diupload`)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Upload gagal')
  } finally {
    uploading.value = false
    // Reset input
    if (target) target.value = ''
  }
}

const handleRemove = (index: number) => {
  const updatedImages = images.value.filter((_, i) => i !== index)
  emit('input', updatedImages)
  emit('update:value', updatedImages)
  toast.info('Gambar dihapus')
}

const handlePreview = (index: number) => {
  currentPreviewIndex.value = index
  showPreview.value = true
}

const nextImage = () => {
  if (currentPreviewIndex.value < images.value.length - 1) {
    currentPreviewIndex.value++
  } else {
    currentPreviewIndex.value = 0 // Loop back to first
  }
}

const prevImage = () => {
  if (currentPreviewIndex.value > 0) {
    currentPreviewIndex.value--
  } else {
    currentPreviewIndex.value = images.value.length - 1 // Loop to last
  }
}

const handleKeyPress = (event: KeyboardEvent) => {
  if (!showPreview.value) return

  if (event.key === 'ArrowRight') {
    nextImage()
  } else if (event.key === 'ArrowLeft') {
    prevImage()
  } else if (event.key === 'Escape') {
    showPreview.value = false
  }
}
</script>

<template>
  <div class="space-y-2">
    <Label v-if="label" :for="id || label.toLowerCase().replace(/\s+/g, '-')">
      {{ label }}
    </Label>

    <div v-if="!readonly || !hasImages" class="flex gap-2">
      <!-- Hidden file input -->
      <input ref="fileInput" type="file" :accept="accept" multiple class="hidden"
        :disabled="disabled || readonly || uploading || !canAddMore" @change="handleFileChange" />

      <!-- Upload button -->
      <Button type="button" variant="outline" :disabled="disabled || readonly || uploading || !canAddMore"
        @click="handleFileSelect" class="flex-1">
        <Upload v-if="!uploading" class="h-4 w-4 mr-2" />
        <Loader2 v-else class="h-4 w-4 mr-2 animate-spin" />
        {{ uploading ? 'Mengupload...' : (readonly ? 'Tidak ada file' : `Upload File (${images.length}/${maxImages})`) }}
      </Button>

      <!-- View Button -->
      <Button v-if="hasImages && !readonly" type="button" variant="secondary" size="icon" @click="handlePreview(0)"
        title="Lihat Gambar">
        <Eye class="h-4 w-4" />
      </Button>
    </div>

    <!-- Image/File Thumbnails Inline -->
    <div v-if="hasImages" class="mt-2 flex flex-wrap gap-2">
      <div 
        v-for="(img, index) in images" :key="index"
        class="relative inline-block border rounded-md overflow-hidden cursor-pointer group bg-muted/30"
        :class="readonly && images.length === 1 ? 'max-w-full' : 'w-24 h-24'"
        @click="handlePreview(index)"
      >
        <img 
          v-if="isImageFile(img)" 
          :src="getImageUrl(img.gambar || img.lampiran)" 
          :alt="`Thumbnail ${index + 1}`" 
          class="transition-transform group-hover:scale-105" 
          :class="readonly && images.length === 1 ? 'max-h-64 w-auto object-contain' : 'w-full h-full object-cover'"
          @error="(e) => (e.target as HTMLElement).style.display = 'none'"
        />
        <div v-else class="w-full h-full flex flex-col items-center justify-center bg-muted">
          <FileText class="h-8 w-8 text-muted-foreground" />
          <span class="text-[10px] mt-1 text-muted-foreground truncate w-full text-center px-1">{{ getFileName(img) }}</span>
        </div>
        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Eye class="h-6 w-6 text-white" />
        </div>
      </div>
    </div>

    <!-- Hints or error message -->
    <p v-if="hints && !readonly" :class="['text-xs', errorname === 'failed' ? 'text-destructive' : 'text-muted-foreground']">
      {{ hints }}
    </p>

    <!-- Preview Carousel Popup -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showPreview"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 dark:bg-black/95 p-4 overflow-hidden"
          @click="showPreview = false" @keydown="handleKeyPress" tabindex="0">
          <div class="relative w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col items-center justify-center gap-4">
            <!-- Close button -->
            <Button variant="ghost" size="icon"
              class="absolute top-4 right-4 text-white hover:bg-white/20 dark:hover:bg-white/10 z-10"
              @click="showPreview = false">
              <X class="h-6 w-6" />
            </Button>

            <!-- Previous button -->
            <Button v-if="images.length > 1" variant="ghost" size="icon"
              class="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 dark:hover:bg-white/10 z-10"
              @click.stop="prevImage">
              <ChevronLeft class="h-8 w-8" />
            </Button>

            <!-- Next button -->
            <Button v-if="images.length > 1" variant="ghost" size="icon"
              class="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 dark:hover:bg-white/10 z-10"
              @click.stop="nextImage">
              <ChevronRight class="h-8 w-8" />
            </Button>

            <!-- Image/File container -->
            <div class="flex flex-col items-center justify-center gap-3 w-full h-full px-4 pb-4">
              <!-- Image preview -->
              <div v-if="isImageFile(images[currentPreviewIndex])"
                class="flex items-center justify-center rounded-lg bg-white dark:bg-gray-900 p-4 max-w-full"
                style="max-height: calc(95vh - 200px);">
                <img :src="currentPreviewUrl" :alt="`Image ${currentPreviewIndex + 1}`"
                  class="max-w-[85vw] w-auto h-auto object-contain" style="max-height: calc(95vh - 220px);" @click.stop
                  @error="() => toast.error('Gagal memuat gambar')" />
              </div>

              <!-- PDF preview -->
              <div v-else-if="isPdfFile(images[currentPreviewIndex])"
                class="flex flex-col items-center justify-center gap-2 w-full" style="max-height: calc(95vh - 200px);">
                <embed :src="currentPreviewUrl + '#toolbar=0'" type="application/pdf" class="w-[85vw] rounded-lg"
                  style="height: calc(95vh - 280px);" @click.stop />
                <div class="flex gap-2">
                  <a :href="currentPreviewUrl" target="_blank"
                    class="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 transition-colors"
                    @click.stop>
                    <Eye class="h-3 w-3" />
                    Buka di Tab Baru
                  </a>
                  <a :href="currentPreviewUrl" :download="getFileName(images[currentPreviewIndex])"
                    class="inline-flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground text-sm rounded-md hover:bg-secondary/90 transition-colors"
                    @click.stop>
                    <FileDown class="h-3 w-3" />
                    Download
                  </a>
                </div>
              </div>

              <!-- Other file types -->
              <div v-else
                class="flex flex-col items-center justify-center gap-4 bg-white dark:bg-gray-900 p-8 rounded-lg">
                <FileText class="h-24 w-24 text-muted-foreground" />
                <p class="text-lg font-medium">{{ getFileName(images[currentPreviewIndex]) }}</p>
                <a :href="currentPreviewUrl" target="_blank" download
                  class="text-white hover:underline flex items-center gap-2" @click.stop>
                  <Eye class="h-4 w-4" />
                  Download File
                </a>
              </div>

              <!-- Image counter and actions -->
              <div class="flex items-center gap-2">
                <div class="text-white text-sm bg-black/60 px-4 py-2 rounded-full">
                  {{ currentPreviewIndex + 1 }} / {{ images.length }}
                </div>

                <Button v-if="!readonly" type="button" variant="destructive" size="icon" class="rounded-full h-9 w-9"
                  @click.stop="() => {
                    handleRemove(currentPreviewIndex);
                    if (images.length === 0) showPreview = false;
                    else if (currentPreviewIndex >= images.length) currentPreviewIndex = images.length - 1;
                  }" title="Hapus Gambar">
                  <Trash2 class="h-4 w-4" />
                </Button>
              </div>

              <!-- Thumbnail navigation -->
              <div v-if="images.length > 1" class="flex gap-2 overflow-x-auto max-w-full px-4">
                <button v-for="(img, index) in images" :key="index" type="button"
                  class="shrink-0 w-16 h-16 rounded border-2 overflow-hidden transition-all flex items-center justify-center bg-muted"
                  :class="index === currentPreviewIndex ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'"
                  @click.stop="currentPreviewIndex = index">
                  <img v-if="isImageFile(img)" :src="getImageUrl(img.gambar || img.lampiran)"
                    :alt="`Thumbnail ${index + 1}`" class="w-full h-full object-cover" />
                  <FileText v-else class="h-8 w-8 text-white" />
                </button>
              </div>
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