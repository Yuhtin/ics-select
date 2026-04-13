'use client';

import { useState } from 'react';
import { Avatar, Chip, Input, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../../lib/api/client';

type Member = {
  id: string;
  email: string;
  name: string;
  pictureUrl: string | null;
  role: 'ADMIN' | 'MEMBER';
};

export default function MembersPage() {
  const [search, setSearch] = useState('');
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => apiFetch<Member[]>('/members'),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-40 skeleton-pulse rounded-lg" />
          <div className="h-4 w-56 skeleton-pulse rounded-lg mt-2" />
        </div>
        <div className="h-10 w-80 skeleton-pulse rounded-lg" />
        <div className="glass rounded-xl h-64 skeleton-pulse" />
      </div>
    );
  }

  const members = (data ?? []).filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Membros</h1>
        <p className="text-sm text-foreground-muted mt-1">Todos os usuarios da plataforma</p>
      </div>

      <Input
        placeholder="Buscar por nome ou email..."
        value={search}
        onValueChange={setSearch}
        startContent={<Search className="h-4 w-4 text-foreground-muted" />}
        variant="bordered"
        className="max-w-md"
      />

      <div className="glass rounded-xl overflow-hidden">
        <Table aria-label="Lista de membros" shadow="none" isStriped selectionMode="single" onRowAction={(key) => router.push(`/admin/members/${key}`)}>
          <TableHeader>
            <TableColumn>Membro</TableColumn>
            <TableColumn>Email</TableColumn>
            <TableColumn>Tipo</TableColumn>
          </TableHeader>
          <TableBody emptyContent="Nenhum membro encontrado.">
            {members.map((m) => (
              <TableRow key={m.id} className="cursor-pointer">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar src={m.pictureUrl ?? undefined} name={m.name.charAt(0)} size="sm" />
                    <span className="text-sm font-medium">{m.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-foreground-muted">{m.email}</span>
                </TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat" color={m.role === 'ADMIN' ? 'primary' : 'default'}>
                    {m.role === 'ADMIN' ? 'Admin' : 'Membro'}
                  </Chip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

    </div>
  );
}
