<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

export interface ChartDataset {
  label?: string
  data: number[]
  backgroundColor?: string | string[]
  borderColor?: string | string[]
  borderWidth?: number
  fill?: boolean
  tension?: number
}

const props = withDefaults(
  defineProps<{
    type: 'bar' | 'line' | 'doughnut' | 'pie' | 'area'
    labels: string[]
    datasets?: ChartDataset[]
    data?: number[]
    datasetLabel?: string
    colorTheme?: 'blue' | 'emerald' | 'purple' | 'amber' | 'rose'
    height?: number
    animate?: boolean
  }>(),
  {
    datasets: undefined,
    data: undefined,
    datasetLabel: 'Data',
    colorTheme: 'blue',
    height: 280,
    animate: true,
  }
)

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null
let themeObserver: MutationObserver | null = null

const isDark = ref(false)

function checkDarkMode() {
  if (typeof document !== 'undefined') {
    isDark.value = document.documentElement.classList.contains('dark')
  }
}

// Color schemes
const THEMES = {
  blue: {
    primary: '#3b82f6',
    secondary: '#38bdf8',
    bg: 'rgba(59, 130, 246, 0.2)',
    border: '#3b82f6',
    palette: ['#3b82f6', '#38bdf8', '#6366f1', '#0ea5e9', '#60a5fa', '#1d4ed8']
  },
  emerald: {
    primary: '#10b981',
    secondary: '#34d399',
    bg: 'rgba(16, 185, 129, 0.2)',
    border: '#10b981',
    palette: ['#10b981', '#059669', '#34d399', '#6ee7b7', '#047857', '#059669']
  },
  purple: {
    primary: '#8b5cf6',
    secondary: '#a78bfa',
    bg: 'rgba(139, 92, 246, 0.2)',
    border: '#8b5cf6',
    palette: ['#8b5cf6', '#7c3aed', '#a78bfa', '#c084fc', '#6d28d9', '#a855f7']
  },
  amber: {
    primary: '#f59e0b',
    secondary: '#fbbf24',
    bg: 'rgba(245, 158, 11, 0.2)',
    border: '#f59e0b',
    palette: ['#f59e0b', '#d97706', '#fbbf24', '#fcd34d', '#b45309', '#eab308']
  },
  rose: {
    primary: '#f43f5e',
    secondary: '#fb7185',
    bg: 'rgba(244, 63, 94, 0.2)',
    border: '#f43f5e',
    palette: ['#f43f5e', '#e11d48', '#fb7185', '#fda4af', '#be123c', '#ec4899']
  }
}

const activeTheme = computed(() => THEMES[props.colorTheme] || THEMES.blue)

// Build normalized datasets
const normalizedDatasets = computed(() => {
  const isCircle = props.type === 'doughnut' || props.type === 'pie'
  const isArea = props.type === 'area'
  const circleBorder = isDark.value ? '#1e1e1e' : '#ffffff'

  if (props.datasets && props.datasets.length > 0) {
    return props.datasets.map((ds, idx) => {
      const palette = activeTheme.value.palette
      const fallbackColor = palette[idx % palette.length]
      return {
        ...ds,
        backgroundColor: ds.backgroundColor || (isCircle ? palette : isArea ? activeTheme.value.bg : fallbackColor),
        borderColor: ds.borderColor || (isCircle ? circleBorder : fallbackColor),
        borderWidth: ds.borderWidth ?? (isCircle ? 2 : 2),
        fill: isArea ? true : (ds.fill ?? false),
        tension: ds.tension ?? 0.35,
        borderRadius: props.type === 'bar' ? 6 : undefined,
      }
    })
  }

  // Single dataset from props.data
  const values = props.data || []
  return [
    {
      label: props.datasetLabel,
      data: values,
      backgroundColor: isCircle ? activeTheme.value.palette : isArea ? activeTheme.value.bg : activeTheme.value.primary,
      borderColor: isCircle ? circleBorder : activeTheme.value.border,
      borderWidth: isCircle ? 2 : 2,
      fill: isArea,
      tension: 0.35,
      borderRadius: props.type === 'bar' ? 6 : undefined,
    }
  ]
})

function renderChart() {
  if (!canvasRef.value) return

  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  const isCircle = props.type === 'doughnut' || props.type === 'pie'
  const actualType = props.type === 'area' ? 'line' : props.type

  const textColor = isDark.value ? '#cbd5e1' : '#475569'
  const gridColor = isDark.value ? 'rgba(255, 255, 255, 0.08)' : 'rgba(156, 163, 175, 0.15)'
  const tooltipBg = isDark.value ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.95)'
  const tooltipBorder = isDark.value ? 'rgba(255, 255, 255, 0.1)' : 'transparent'

  chartInstance = new Chart(canvasRef.value, {
    type: actualType,
    data: {
      labels: props.labels,
      datasets: normalizedDatasets.value as any,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: props.animate ? { duration: 500 } : false,
      plugins: {
        legend: {
          display: isCircle || (props.datasets && props.datasets.length > 1),
          position: isCircle ? 'right' : 'top',
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            padding: 12,
            color: textColor,
            font: { size: 12 }
          }
        },
        tooltip: {
          backgroundColor: tooltipBg,
          borderColor: tooltipBorder,
          borderWidth: isDark.value ? 1 : 0,
          titleColor: '#f8fafc',
          bodyColor: '#f1f5f9',
          titleFont: { size: 13, weight: 'bold' },
          bodyFont: { size: 12 },
          padding: 10,
          cornerRadius: 6,
        }
      },
      scales: isCircle
        ? {}
        : {
            x: {
              grid: { display: false },
              ticks: {
                color: textColor,
                font: { size: 11 }
              }
            },
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: {
                color: textColor,
                font: { size: 11 }
              }
            }
          }
    }
  })
}

onMounted(() => {
  checkDarkMode()
  renderChart()

  if (typeof document !== 'undefined') {
    themeObserver = new MutationObserver(() => {
      const darkNow = document.documentElement.classList.contains('dark')
      if (darkNow !== isDark.value) {
        isDark.value = darkNow
        renderChart()
      }
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })
  }
})

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
  if (themeObserver) {
    themeObserver.disconnect()
    themeObserver = null
  }
})

watch(
  () => [props.type, props.labels, props.datasets, props.data, props.colorTheme, isDark.value],
  () => {
    renderChart()
  },
  { deep: true }
)
</script>

<template>
  <div class="relative w-full" :style="{ height: `${height}px` }">
    <canvas ref="canvasRef"></canvas>
  </div>
</template>
