<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { LMap, LTileLayer, LMarker } from '@vue-leaflet/vue-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MapPin, Search, Loader2, Check, X } from 'lucide-vue-next'

// Fix default marker icon issue in Leaflet
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

interface Props {
  latitude?: string | number | null
  longitude?: string | number | null
  address?: string | null
  disabled?: boolean
  readonly?: boolean
  buttonText?: string
  buttonVariant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive'
}

const props = withDefaults(defineProps<Props>(), {
  latitude: null,
  longitude: null,
  address: '',
  disabled: false,
  readonly: false,
  buttonText: 'Pilih Lokasi di Peta',
  buttonVariant: 'outline',
})

const emit = defineEmits<{
  'update:latitude': [value: string]
  'update:longitude': [value: string]
  'update:address': [value: string]
  'confirm': [data: { lat: string; lng: string; address: string }]
}>()

// Default Jakarta coordinates
const DEFAULT_LAT = -6.2088
const DEFAULT_LNG = 106.8456
const DEFAULT_ZOOM = 13

// State
const isOpen = ref(false)
const mapRef = ref<any>(null)
const center = ref<[number, number]>([DEFAULT_LAT, DEFAULT_LNG])
const marker = ref<[number, number] | null>(null)
const zoom = ref(DEFAULT_ZOOM)
const isSearching = ref(false)
const searchQuery = ref('')
const detectedAddress = ref('')

// Temporary values before confirmation
const tempMarker = ref<[number, number] | null>(null)
const tempAddress = ref('')
const tempCenter = ref<[number, number]>([DEFAULT_LAT, DEFAULT_LNG])

// Display values for the button
const displayText = computed(() => {
  if (props.address) return props.address
  if (props.latitude && props.longitude) {
    return `Lat: ${props.latitude}, Lng: ${props.longitude}`
  }
  return 'Belum ada lokasi dipilih'
})

// Parse coordinates from props
const parseCoordinate = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'string' ? parseFloat(value) : value
  return isNaN(num) ? null : num
}

// Initialize marker from props
const initializeMarker = () => {
  const lat = parseCoordinate(props.latitude)
  const lng = parseCoordinate(props.longitude)
  
  if (lat !== null && lng !== null) {
    marker.value = [lat, lng]
    tempMarker.value = [lat, lng]
    center.value = [lat, lng]
    tempCenter.value = [lat, lng]
    if (props.address) {
      detectedAddress.value = props.address
      tempAddress.value = props.address
    }
  } else {
    // Default to Jakarta if no coordinates provided
    marker.value = null
    tempMarker.value = null
    center.value = [DEFAULT_LAT, DEFAULT_LNG]
    tempCenter.value = [DEFAULT_LAT, DEFAULT_LNG]
  }
}

// Open dialog and initialize map
const openDialog = () => {
  if (props.disabled || props.readonly) return
  
  // Initialize temp values from current props
  initializeMarker()
  isOpen.value = true
  
  // Force map to refresh after dialog opens
  nextTick(() => {
    if (mapRef.value?.leafletObject) {
      setTimeout(() => {
        mapRef.value.leafletObject.invalidateSize()
        if (tempMarker.value) {
          mapRef.value.leafletObject.setView(tempMarker.value, 15)
        }
      }, 100)
    }
  })
  
  // Auto-load current location if no marker exists
  if (!tempMarker.value) {
    setTimeout(() => {
      getCurrentLocation()
    }, 200)
  }
}

// Watch for external prop changes
watch(() => [props.latitude, props.longitude, props.address], () => {
  if (!isOpen.value) {
    initializeMarker()
  }
}, { immediate: true })

// Handle map click to set marker
const onMapClick = async (event: any) => {
  if (props.disabled || props.readonly) return
  
  const { lat, lng } = event.latlng
  tempMarker.value = [lat, lng]
  
  // Reverse geocoding to get address
  await reverseGeocode(lat, lng)
}

// Reverse geocoding using Nominatim API
const reverseGeocode = async (lat: number, lng: number) => {
  try {
    isSearching.value = true
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
    )
    const data = await response.json()
    
    if (data.display_name) {
      tempAddress.value = data.display_name
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error)
  } finally {
    isSearching.value = false
  }
}

// Forward geocoding to search address
const searchAddress = async () => {
  if (!searchQuery.value.trim() || props.disabled || props.readonly) return
  
  try {
    isSearching.value = true
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.value)}&limit=1`
    )
    const data = await response.json()
    
    if (data.length > 0) {
      const { lat, lon, display_name } = data[0]
      const latitude = parseFloat(lat)
      const longitude = parseFloat(lon)
      
      tempMarker.value = [latitude, longitude]
      tempCenter.value = [latitude, longitude]
      tempAddress.value = display_name
      
      // Center map to new location
      if (mapRef.value?.leafletObject) {
        mapRef.value.leafletObject.setView([latitude, longitude], 15)
      }
    }
  } catch (error) {
    console.error('Search error:', error)
  } finally {
    isSearching.value = false
  }
}

// Get current location
const getCurrentLocation = () => {
  if (props.disabled || props.readonly) return
  
  if ('geolocation' in navigator) {
    isSearching.value = true
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        
        tempMarker.value = [lat, lng]
        tempCenter.value = [lat, lng]
        
        if (mapRef.value?.leafletObject) {
          mapRef.value.leafletObject.setView([lat, lng], 15)
        }
        
        await reverseGeocode(lat, lng)
        isSearching.value = false
      },
      (error) => {
        console.error('Geolocation error:', error)
        isSearching.value = false
      }
    )
  }
}

// Confirm selection and close dialog
const confirmSelection = () => {
  if (!tempMarker.value) return
  
  const lat = tempMarker.value[0].toFixed(6)
  const lng = tempMarker.value[1].toFixed(6)
  const address = tempAddress.value
  
  // Update permanent values
  marker.value = tempMarker.value
  detectedAddress.value = tempAddress.value
  
  // Emit updates
  emit('update:latitude', lat)
  emit('update:longitude', lng)
  emit('update:address', address)
  emit('confirm', { lat, lng, address })
  
  // Close dialog
  isOpen.value = false
}

// Cancel and close dialog
const cancelSelection = () => {
  // Reset temp values to original
  initializeMarker()
  isOpen.value = false
}
</script>

<template>
  <div class="space-y-2">
    <!-- Display current location -->
    <div v-if="props.latitude && props.longitude" class="p-3 bg-muted rounded-md text-sm">
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 space-y-1">
          <p class="font-medium flex items-center gap-2">
            <MapPin class="h-4 w-4" />
            Lokasi Terpilih
          </p>
          <p class="text-muted-foreground text-xs">{{ displayText }}</p>
          <div class="flex gap-4 text-xs text-muted-foreground">
            <span>Lat: {{ props.latitude }}</span>
            <span>Lng: {{ props.longitude }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Dialog Trigger Button -->
    <Dialog v-model:open="isOpen">
      <DialogTrigger as-child>
        <Button
          :variant="props.buttonVariant"
          :disabled="props.disabled || props.readonly"
          @click="openDialog"
          class="w-full"
        >
          <MapPin class="h-4 w-4 mr-2" />
          {{ props.buttonText }}
        </Button>
      </DialogTrigger>
      
      <DialogContent class="!max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader class="flex-shrink-0">
          <DialogTitle class="flex items-center gap-2">
            <MapPin class="h-5 w-5" />
            Pilih Lokasi di Peta
          </DialogTitle>
          <DialogDescription>
            Klik pada peta untuk memilih lokasi, atau cari alamat menggunakan kotak pencarian
          </DialogDescription>
        </DialogHeader>
        
        <div class="flex-1 space-y-4 overflow-y-auto pr-2">
          <!-- Search Bar and Location Button -->
          <div class="flex gap-2">
            <div class="relative flex-1">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Cari alamat..."
                class="w-full px-3 py-2 pr-9 border rounded-md text-sm"
                @keyup.enter="searchAddress"
              />
              <button
                v-if="searchQuery"
                type="button"
                class="absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-muted-foreground hover:text-white"
                @click="searchQuery = ''"
              >
                <X class="h-4 w-4" />
              </button>
            </div>
            <Button
              @click="searchAddress"
              size="sm"
              :disabled="isSearching || !searchQuery.trim()"
            >
              <Search class="h-4 w-4" />
            </Button>
            <Button
              @click="getCurrentLocation"
              size="sm"
              variant="outline"
              :disabled="isSearching"
            >
              <Loader2 v-if="isSearching" class="h-4 w-4 animate-spin" />
              <MapPin v-else class="h-4 w-4" />
            </Button>
          </div>
          
          <!-- Map Container -->
          <div class="border rounded-lg overflow-hidden" style="height: 450px;">
            <LMap
              ref="mapRef"
              v-model:zoom="zoom"
              v-model:center="tempCenter"
              :use-global-leaflet="false"
              @click="onMapClick"
              style="height: 100%; width: 100%;"
            >
              <LTileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                layer-type="base"
                name="OpenStreetMap"
              />
              
              <LMarker
                v-if="tempMarker"
                :lat-lng="tempMarker"
              />
            </LMap>
          </div>
          
          <!-- Address Display -->
          <div v-if="tempAddress" class="p-3 bg-muted rounded-md text-sm">
            <p class="font-medium mb-1">Alamat Terdeteksi:</p>
            <p class="text-muted-foreground">{{ tempAddress }}</p>
          </div>
          
          <!-- Coordinates Display -->
          <div v-if="tempMarker" class="grid grid-cols-2 gap-2 text-sm">
            <div class="p-2 bg-muted rounded-md">
              <span class="font-medium">Latitude:</span>
              <span class="ml-2 text-muted-foreground">{{ tempMarker[0].toFixed(6) }}</span>
            </div>
            <div class="p-2 bg-muted rounded-md">
              <span class="font-medium">Longitude:</span>
              <span class="ml-2 text-muted-foreground">{{ tempMarker[1].toFixed(6) }}</span>
            </div>
          </div>
        </div>
        
        <DialogFooter class="flex-shrink-0 gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            @click="cancelSelection"
          >
            <X class="h-4 w-4 mr-2" />
            Batal
          </Button>
          <Button
            type="button"
            @click="confirmSelection"
            :disabled="!tempMarker"
          >
            <Check class="h-4 w-4 mr-2" />
            Konfirmasi Lokasi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
/* Leaflet map styling adjustments */
:deep(.leaflet-container) {
  font-family: inherit;
}

:deep(.leaflet-popup-content-wrapper) {
  border-radius: 8px;
}

:deep(.leaflet-control-zoom) {
  border: none;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

:deep(.leaflet-control-zoom a) {
  border-radius: 0;
}

:deep(.leaflet-control-zoom a:first-child) {
  border-radius: 8px 8px 0 0;
}

:deep(.leaflet-control-zoom a:last-child) {
  border-radius: 0 0 8px 8px;
}
</style>
