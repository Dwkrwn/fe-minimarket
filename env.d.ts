/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    $API_BASE_URL: string
  }
}

declare global {
  // Injected by Vite from package.json version (see vite.config.ts)
  const __APP_VERSION__: string
  const __APP_RELEASE_DATE__: string

  interface Window {
    API_BASE_URL: string
  }

  // eslint-disable-next-line no-var
  var API_BASE_URL: string

  // Make API_BASE_URL available in templates without $ prefix
  const API_BASE_URL: string
}

export { }
