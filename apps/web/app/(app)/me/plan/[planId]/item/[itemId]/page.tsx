'use client';

import { Button, Card, CardBody, CardHeader, Chip, Textarea } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { apiFetch } from '../../../../../../../lib/api/client';

type Plan = {
  id: string;
  items: Array<{
    id: string;
    status: string;
    stuck: boolean;
    difficultyRating: 'EASY' | 'HARD' | null;
    reflection: string | null;
    libraryItem: {
      id: string;
      title: string;
      description: string | null;
      url: string | null;
      estimatedMinutes: number;
      format: string;
    };
  }>;
};

export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ planId: string; itemId: string }>;
}) {
  const { planId, itemId } = use(params);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ['plan', planId],
    queryFn: () => apiFetch<Plan>(`/plans/${planId}`),
  });
  const item = data?.items.find((i) => i.id === itemId);

  const [rating, setRating] = useState<'EASY' | 'HARD' | null>(null);
  const [reflection, setReflection] = useState('');

  const doneMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/plans/${planId}/items/${itemId}/done`, {
        method: 'POST',
        body: JSON.stringify({ rating: rating ?? undefined, reflection: reflection || undefined }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
      queryClient.invalidateQueries({ queryKey: ['me-week'] });
      router.push('/me');
    },
  });

  const stuckMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/plans/${planId}/items/${itemId}/stuck`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
      queryClient.invalidateQueries({ queryKey: ['me-week'] });
    },
  });

  if (!item) return <p>Carregando...</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">{item.libraryItem.title}</h1>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="flat">{item.libraryItem.format}</Chip>
            <Chip size="sm" variant="flat">{item.libraryItem.estimatedMinutes}min</Chip>
            {item.stuck && <Chip size="sm" color="warning">Travei</Chip>}
          </div>
          {item.libraryItem.description && (
            <p className="text-sm text-foreground-muted">{item.libraryItem.description}</p>
          )}
          {item.libraryItem.url && (
            <a
              href={item.libraryItem.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary underline"
            >
              Abrir material
            </a>
          )}

          {item.status === 'PENDING' && (
            <div className="space-y-3 pt-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">Dificuldade:</span>
                <Button
                  size="sm"
                  variant={rating === 'EASY' ? 'solid' : 'flat'}
                  onPress={() => setRating('EASY')}
                >
                  Fácil
                </Button>
                <Button
                  size="sm"
                  variant={rating === 'HARD' ? 'solid' : 'flat'}
                  onPress={() => setRating('HARD')}
                >
                  Difícil
                </Button>
              </div>
              <Textarea
                label="Reflexão (opcional)"
                placeholder="Principal insight, o que ainda confunde..."
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
              />
              <div className="flex gap-2">
                <Button color="primary" isLoading={doneMutation.isPending} onPress={() => doneMutation.mutate()}>
                  Marcar feito
                </Button>
                <Button color="warning" variant="flat" isLoading={stuckMutation.isPending} onPress={() => stuckMutation.mutate()}>
                  Travei
                </Button>
              </div>
            </div>
          )}

          {item.status === 'DONE' && (
            <div className="pt-2">
              <Chip color="success">Feito</Chip>
              {item.difficultyRating && <Chip size="sm" variant="flat" className="ml-2">{item.difficultyRating}</Chip>}
              {item.reflection && <p className="mt-2 text-sm text-foreground-muted">{item.reflection}</p>}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
