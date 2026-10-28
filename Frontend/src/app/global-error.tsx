'use client'

/** Last-resort boundary for errors in the root layout. Keeps its own minimal styling. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100dvh', margin: 0 }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
          <p style={{ color: '#555' }}>Please try again.</p>
          <button
            onClick={reset}
            style={{ marginTop: 16, padding: '10px 18px', borderRadius: 10, border: 0, background: '#9b1b24', color: '#fff', fontSize: 16 }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
