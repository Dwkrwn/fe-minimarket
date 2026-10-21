<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Home, ArrowLeft, Settings, Code } from 'lucide-vue-next'

const router = useRouter()

const currentPath = router.currentRoute.value.fullPath

const goBack = () => {
  router.back()
}

const goHome = () => {
  router.push('/')
}

const contactDeveloper = () => {
  window.open('https://github.com/YutsuriHisekawa/mitravisualgroup/issues', '_blank')
}
</script>

<template>
  <div class="flex items-center justify-center p-6 min-h-[calc(100vh-4rem)]">
    <Card class="w-full max-w-3xl shadow-lg" v-motion :initial="{ opacity: 0, scale: 0.95, y: 30 }" :enter="{
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15
      }
    }">
      <CardHeader class="text-center space-y-4 pb-6">
        <!-- Icon Animation -->
        <div class="flex justify-center" v-motion :initial="{ opacity: 0, scale: 0.5 }" :enter="{
          opacity: 1,
          scale: 1,
          transition: {
            type: 'spring',
            stiffness: 120,
            damping: 10,
            delay: 100
          }
        }">
          <div class="relative">
            <!-- Glow Effect -->
            <div class="absolute inset-0 bg-red-500/20 rounded-full blur-3xl animate-pulse"></div>
            <!-- Icon Container -->
            <div
              class="relative bg-linear-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 p-6 rounded-full border-4 border-red-200 dark:border-red-800">
              <AlertCircle class="h-16 w-16 text-red-600 dark:text-red-400" stroke-width="2.5" />
            </div>
          </div>
        </div>

        <!-- 404 Text -->
        <div v-motion :initial="{ opacity: 0, y: 20 }" :enter="{
          opacity: 1,
          y: 0,
          transition: { delay: 200 }
        }">
          <h1
            class="text-[120px] font-black leading-none bg-linear-to-br from-red-600 to-red-400 dark:from-red-400 dark:to-red-600 bg-clip-text text-transparent">
            404
          </h1>
          <CardTitle class="text-2xl mt-2 font-bold">Halaman Tidak Ditemukan</CardTitle>
          <CardDescription class="text-base mt-2">
            Maaf, halaman yang Anda cari tidak tersedia
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent class="space-y-6" v-motion :initial="{ opacity: 0, y: 20 }" :enter="{
        opacity: 1,
        y: 0,
        transition: { delay: 300 }
      }">
        <!-- Error Message Box -->
        <div class="bg-muted/50 backdrop-blur-sm p-5 rounded-lg border border-border/50 space-y-4">
          <!-- Main Message -->
          <div class="flex items-start gap-3">
            <div class="p-2 bg-primary/10 rounded-md shrink-0">
              <Settings class="h-5 w-5 text-primary" />
            </div>
            <div class="space-y-2 flex-1">
              <p class="text-sm font-semibold text-foreground">
                Route Belum Terdaftar dalam Router
              </p>
              <p class="text-sm text-muted-foreground leading-relaxed">
                Halaman yang Anda cari belum dikonfigurasi dalam sistem routing aplikasi.
                Kemungkinan route ini belum dipasang oleh developer atau masih dalam tahap pengembangan.
              </p>
            </div>
          </div>

          <!-- Developer Note -->
          <div class="pt-3 border-t border-border/50">
            <div class="flex items-start gap-2 text-sm">
              <span class="font-semibold text-foreground shrink-0">Catatan:</span>
              <span class="text-muted-foreground">
                Jika Anda yakin halaman ini seharusnya tersedia, silakan hubungi tim developer
                untuk melakukan konfigurasi route yang diperlukan.
              </span>
            </div>
          </div>
        </div>

        <!-- Path Display -->
        <div class="bg-secondary/50 backdrop-blur-sm p-4 rounded-lg border border-border/50">
          <div class="flex items-center gap-2 mb-2">
            <Code class="h-4 w-4 text-muted-foreground" />
            <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Path yang diminta:
            </p>
          </div>
          <code
            class="text-sm font-mono text-foreground bg-background/50 px-3 py-2 rounded border border-border/50 block break-all">
            {{ currentPath }}
          </code>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-col sm:flex-row gap-3 pt-2">
          <Button @click="goBack" variant="outline" size="lg" class="flex-1 gap-2 group">
            <ArrowLeft class="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            Kembali
          </Button>

          <Button @click="goHome" size="lg"
            class="flex-1 gap-2 group bg-linear-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary">
            <Home class="h-4 w-4" />
            Ke Halaman Utama
          </Button>
        </div>

        <!-- Developer Contact (Optional) -->
        <div class="text-center pt-2">
          <p class="text-xs text-muted-foreground">
            Butuh bantuan?
            <button @click="contactDeveloper" class="text-primary hover:underline font-medium ml-1">
              Hubungi Tim Developer
            </button>
          </p>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
