'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/auth-context';

export default function AppHome() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    router.replace(user.role === 'ADMIN' ? '/admin/cycles' : '/me');
  }, [user, router]);

  return <p className="text-foreground/60">Redirecionando...</p>;
}
