'use client'

import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
      <Toaster
        position="top-center"
        closeButton
        toastOptions={{
          classNames: {
            toast:
              '!rounded-xl !border !border-border !bg-popover !text-foreground !shadow-[var(--shadow-lift)] !font-sans',
            description: '!text-muted-foreground',
          },
        }}
      />
    </ThemeProvider>
  )
}
