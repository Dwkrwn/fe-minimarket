<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Button } from '@/components/ui/button'

const router = useRouter()
</script>

<template>
  <div class="p-6 space-y-4">
    <h1 class="text-2xl font-bold">Form Wilayah</h1>
    <p class="text-sm text-muted-foreground">
      Modul Wilayah saat ini menggunakan tampilan map. Form detail belum diaktifkan.
    </p>
    <Button @click="router.push('/marketing/master/m_wilayah')">Kembali ke Map Wilayah</Button>
  </div>
</template>
