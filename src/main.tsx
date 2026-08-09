import { createRoot } from 'react-dom/client'
import './index.css'
import { TRPCProvider } from "@/providers/trpc"
import App from './App.tsx'

// بدون StrictMode — يتسبب في تكرار تأثيرات الرسم والحركة (react-dev.md)
createRoot(document.getElementById('root')!).render(
  <TRPCProvider>
    <App />
  </TRPCProvider>,
)
