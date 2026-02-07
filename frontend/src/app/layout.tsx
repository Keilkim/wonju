import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Dog Rehab Dashboard',
  description: 'Real-time underwater treadmill rehabilitation analysis for dogs',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  )
}
