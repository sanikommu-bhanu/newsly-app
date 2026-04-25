import type { Metadata, Viewport } from 'next'
import { Playfair_Display, DM_Sans } from 'next/font/google'
import './globals.css'
import PWARegister from '@/components/PWARegister'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['300', '400', '500', '600'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'Newsly', template: '%s · Newsly' },
  description:
    'Understand the news clearly. Personalised, AI-powered, distraction-free.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg', other: [{ rel: 'icon', url: '/favicon.svg' }] },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Newsly',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAFA' },
    { media: '(prefers-color-scheme: dark)', color: '#0C0C0D' },
  ],
}

// Inline script injected before hydration — prevents dark mode flash on refresh.
// Reads the persisted Zustand value from localStorage key "newsly-v1".
const DARK_INIT_SCRIPT = `
(function(){
  try {
    var s = localStorage.getItem('newsly-v1');
    if (s) {
      var d = JSON.parse(s);
      if (d && d.state && d.state.darkMode === true) {
        document.documentElement.classList.add('dark');
      }
    }
  } catch(e){}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Blocking script — must execute before paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: DARK_INIT_SCRIPT }} />
      </head>
      <body className={`${playfair.variable} ${dmSans.variable} min-h-screen`}>
        <PWARegister />
        {children}
      </body>
    </html>
  )
}
