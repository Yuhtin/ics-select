'use client';

import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { apiFetch } from '../../../lib/api/client';
import { useAuth } from '../../../lib/auth/auth-context';
import { MemberMuralCard } from '../../../components/member/member-mural-card';

type MemberProgress = {
  userId: string;
  name: string;
  pictureUrl: string | null;
  done: number;
  total: number;
  percent: number;
};

export default function MembersPage() {
  const { user } = useAuth();

  const { data: members, isLoading } = useQuery({
    queryKey: ['cohort-progress'],
    queryFn: () => apiFetch<MemberProgress[]>('/me/cohort/progress'),
  });

  if (isLoading) {
    return <p className="text-sm text-foreground-muted p-8">Carregando turma...</p>;
  }

  return (
    <div className="px-4 lg:px-8 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Users className="h-5 w-5 text-brand" />
        <div>
          <h1 className="text-lg font-bold text-foreground">Minha Turma</h1>
          <p className="text-sm text-foreground-muted">{members?.length ?? 0} membros</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {members?.map((m, i) => (
          <MemberMuralCard
            key={m.userId}
            name={m.name}
            pictureUrl={m.pictureUrl}
            done={m.done}
            total={m.total}
            percent={m.percent}
            rank={i + 1}
            isCurrentUser={m.userId === user?.id}
          />
        ))}
      </div>
    </div>
  );
}
