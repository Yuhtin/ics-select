'use client';

import { useEffect } from 'react';
import { Avatar, Button, Chip, Progress } from '@heroui/react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiFetch } from '../../lib/api/client';

type Overview = {
  user: { id: string; name: string; email: string; pictureUrl: string | null };
  plans: Array<{ id: string; weekStart: string; weekEnd: string; status: string; doneCount: number; totalCount: number }>;
  topicCoverage: Array<{ tag: string; done: number; total: number }>;
};

interface MemberDrawerProps {
  memberId: string | null;
  onClose: () => void;
}

export function MemberDrawer({ memberId, onClose }: MemberDrawerProps) {
  const { data } = useQuery({
    queryKey: ['member-overview', memberId],
    queryFn: () => apiFetch<Overview>(`/admin/members/${memberId}/overview`),
    enabled: !!memberId,
  });

  useEffect(() => {
    if (!memberId) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [memberId, onClose]);

  return (
    <AnimatePresence>
      {memberId && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 z-50 h-full w-[450px] max-w-[90vw] bg-surface border-l border-border shadow-xl overflow-y-auto"
          >
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">Detalhe do membro</h2>
                <button type="button" onClick={onClose} className="text-foreground-muted hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {data && (
                <>
                  <div className="flex items-center gap-4">
                    <Avatar src={data.user.pictureUrl ?? undefined} name={data.user.name.charAt(0)} size="lg" />
                    <div>
                      <p className="font-bold text-foreground">{data.user.name}</p>
                      <p className="text-sm text-foreground-muted">{data.user.email}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-foreground mb-3">Historico de planos</h3>
                    <div className="space-y-2">
                      {data.plans.map((p) => {
                        const pct = p.totalCount === 0 ? 0 : Math.round((p.doneCount / p.totalCount) * 100);
                        return (
                          <div key={p.id} className="flex items-center gap-3 p-3 bg-surface-subtle rounded-xl">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-foreground-muted">
                                {new Date(p.weekStart).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' })} — {new Date(p.weekEnd).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                              </p>
                              <Progress value={pct} color="primary" size="sm" className="mt-1" />
                            </div>
                            <Chip size="sm" variant="flat" color={p.status === 'PUBLISHED' ? 'primary' : 'default'}>
                              {pct}%
                            </Chip>
                          </div>
                        );
                      })}
                      {data.plans.length === 0 && (
                        <p className="text-xs text-foreground-muted">Nenhum plano ainda.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-foreground mb-3">Cobertura de topicos</h3>
                    <div className="flex flex-wrap gap-2">
                      {data.topicCoverage.map((t) => {
                        const pct = t.total === 0 ? 0 : Math.round((t.done / t.total) * 100);
                        const color = pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'default';
                        return (
                          <Chip key={t.tag} size="sm" variant="flat" color={color}>
                            {t.tag} {pct}%
                          </Chip>
                        );
                      })}
                      {data.topicCoverage.length === 0 && (
                        <p className="text-xs text-foreground-muted">Nenhum topico rastreado.</p>
                      )}
                    </div>
                  </div>

                  <Button as={Link} href={`/admin/plans/${data.user.id}`} color="primary" variant="bordered" className="w-full">
                    Ver planos
                  </Button>
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
