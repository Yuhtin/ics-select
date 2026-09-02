import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: 32, marginBottom: 16 }}>Page not found</h1>
      <p style={{ marginBottom: 24, opacity: 0.7 }}>The page you are looking for does not exist.</p>
      <Link href="/" style={{ textDecoration: 'underline' }}>
        Back to the introduction
      </Link>
    </div>
  )
}
