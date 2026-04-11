'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setAccessToken } from '../../../lib/api/client';

function AuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setAccessToken(token);
    router.replace('/');
  }, [params, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-foreground/60">Conectando...</p>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-foreground/60">Conectando...</p>
        </main>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
