/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_JAMENDO_CLIENT_ID?: string
  readonly VITE_PEXELS_API_KEY?: string
  readonly VITE_PIXABAY_API_KEY?: string
  readonly VITE_SMITHSONIAN_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
