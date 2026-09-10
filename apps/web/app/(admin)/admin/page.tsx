'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminHomeRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/cycle/active');
  }, [router]);
  return (
    <p className="font-sans text-xs font-medium text-fg-mute">
      Loading…
    </p>
  );
}
