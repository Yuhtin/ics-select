import type { Metadata } from 'next'
import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import type { ReactNode } from 'react'
import 'nextra-theme-docs/style.css'

export const metadata: Metadata = {
  title: {
    default: 'ICS Select — Documentation',
    template: '%s · ICS Select'
  },
  description:
    'How ICS Select prepares Inteli students for top-tier tech interviews — product tour, architecture, AI, and deployment.'
}

const navbar = (
  <Navbar
    logo={
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <strong style={{ fontFamily: 'Georgia, "Source Serif 4", serif', fontSize: 18 }}>
          ICS Select
        </strong>
        <span style={{ fontSize: 12, opacity: 0.55 }}>docs</span>
      </span>
    }
    projectLink="https://github.com/Yuhtin/ics-select"
  />
)

const footer = (
  <Footer>
    <span style={{ fontSize: 13, opacity: 0.7 }}>
      Built by Davi Duarte for the Inteli Consulting Society · {new Date().getFullYear()}
    </span>
  </Footer>
)

export default async function RootLayout({ children }: { children: ReactNode }) {
  const pageMap = await getPageMap()
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head faviconGlyph="◆" />
      <body>
        <Layout
          navbar={navbar}
          footer={footer}
          pageMap={pageMap}
          docsRepositoryBase="https://github.com/Yuhtin/ics-select/tree/main/apps/docs"
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
