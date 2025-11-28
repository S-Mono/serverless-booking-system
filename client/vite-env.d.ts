/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LIFF_ID: string
  readonly VITE_ADMIN_KEY: string
  // 他に使う環境変数があればここに追加
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
