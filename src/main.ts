import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { MotionPlugin } from '@vueuse/motion'
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community'

import App from './App.vue'
// Renamed from tailwind.css to main.css
import './styles/main.css'
import router from './router'
import { registerLucide } from './plugins/lucide'
import { ApiPlugin } from './plugins/api'
import { vPermission } from './directives/permission'

// Register AG Grid community modules
ModuleRegistry.registerModules([AllCommunityModule])

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(MotionPlugin)
app.use(ApiPlugin)

// Register global permission directive
app.directive('permission', vPermission)

registerLucide(app)
app.mount('#app')
