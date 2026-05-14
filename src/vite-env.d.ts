/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_360DIALOG_API_KEY: string
  readonly VITE_RESEND_API_KEY: string
  readonly VITE_SLACK_WEBHOOK_URL: string
  readonly VITE_RAZORPAY_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}