# Admin Experience Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin sidebar+tables UI with a Stripe-like floating navbar, HeroUI-powered modals/tables, and a modern premium visual aligned with the warm coral palette.

**Architecture:** New admin layout with transparent floating navbar replacing the sidebar. All forms migrate to HeroUI Modals. Tables use HeroUI Table with filters. Member detail opens as a slide-in drawer. Existing API endpoints are unchanged — this is purely a frontend redesign.

**Tech Stack:** Next.js 15 App Router, HeroUI (Modal, Table, Input, Select, Button, Card, Chip, Avatar, Progress, Dropdown), Framer Motion (drawer animation), TanStack Query, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-04-12-admin-redesign.md`

---

## File Structure

### New files

```
apps/web/components/admin/
├── navbar-admin.tsx              # Stripe-like floating navbar
├── bottom-tab-bar-admin.tsx      # Mobile bottom nav
├── stat-card.tsx                 # Reusable stat card (icon, value, label, trend)
├── alert-list.tsx                # Dashboard alert list
├── cycle-card.tsx                # Cycle card (active/archived)
├── member-drawer.tsx             # Slide-in member detail drawer
├── create-cycle-modal.tsx        # Create/edit cycle modal
├── add-member-modal.tsx          # Add member to cycle modal
├── create-material-modal.tsx     # Create/edit library item modal
└── import-material-modal.tsx     # Import material by URL modal
```

### Modified files

```
apps/web/app/(app)/layout.tsx                      # Replace sidebar with navbar for admin
apps/web/app/(app)/admin/dashboard/page.tsx         # Full redesign
apps/web/app/(app)/admin/cycles/page.tsx            # Cards instead of table
apps/web/app/(app)/admin/cycles/[id]/page.tsx       # List + timeline + stats
apps/web/app/(app)/admin/members/page.tsx           # HeroUI Table + drawer
apps/web/app/(app)/admin/library/page.tsx           # HeroUI Table with filters
apps/web/app/(app)/admin/plans/[memberId]/page.tsx  # Split view
apps/web/components/shell/sidebar.tsx               # Remove member items (already done), clean admin items
apps/web/tests/visual-audit.spec.ts                 # Update admin test assertions
```

### Deleted files

```
apps/web/app/(app)/admin/ai-usage/page.tsx          # Eliminated per spec
apps/web/app/(app)/admin/members/[id]/page.tsx      # Replaced by drawer
apps/web/app/(app)/admin/library/new/page.tsx       # Replaced by modal
apps/web/app/(app)/admin/library/[id]/page.tsx      # Replaced by modal
```

---

## Phase 1: Admin Layout Shell

### Task 1: Admin Navbar

**Files:**
- Create: `apps/web/components/admin/navbar-admin.tsx`
- Create: `apps/web/components/admin/bottom-tab-bar-admin.tsx`

- [ ] **Step 1: Create the Stripe-like floating navbar**

```tsx
// apps/web/components/admin/navbar-admin.tsx
'use client';

import { BookOpen, Calendar, LayoutDashboard, LogOut, Users } from 'lucide-react';
import { Avatar, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLockup } from '../shell/brand-lockup';

interface NavbarAdminProps {
  userName: string;
  email: string;
  avatarUrl?: string | null;
  onLogout?: () => void;
}

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/cycles', label: 'Ciclos', icon: Calendar },
  { href: '/admin/members', label: 'Membros', icon: Users },
  { href: '/admin/library', label: 'Biblioteca', icon: BookOpen },
] as const;

export function NavbarAdmin({ userName, email, avatarUrl, onLogout }: NavbarAdminProps) {
  const pathname = usePathname();
  const initial = userName.charAt(0).toUpperCase();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 hidden lg:flex items-center justify-between h-14 px-8 backdrop-blur-xl bg-surface/80 border-b border-border/30">
      <BrandLockup size="md" />

      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand/8 text-brand'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-subtle'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <Dropdown placement="bottom-end">
        <DropdownTrigger>
          <button type="button" className="flex items-center gap-2 outline-none">
            <Avatar
              src={avatarUrl ?? undefined}
              name={initial}
              size="sm"
              className="cursor-pointer"
            />
          </button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Menu do usuario">
          <DropdownItem key="profile" isReadOnly className="opacity-100">
            <p className="text-sm font-semibold">{userName}</p>
            <p className="text-xs text-foreground-muted">{email}</p>
          </DropdownItem>
          <DropdownItem
            key="logout"
            color="danger"
            startContent={<LogOut className="h-4 w-4" />}
            onPress={onLogout}
          >
            Sair
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </header>
  );
}
```

- [ ] **Step 2: Create the admin mobile bottom tab bar**

```tsx
// apps/web/components/admin/bottom-tab-bar-admin.tsx
'use client';

import { BookOpen, Calendar, LayoutDashboard, User, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/cycles', label: 'Ciclos', icon: Calendar },
  { href: '/admin/members', label: 'Membros', icon: Users },
  { href: '/admin/library', label: 'Biblioteca', icon: BookOpen },
] as const;

export function BottomTabBarAdmin() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden flex items-center justify-around h-16 bg-surface/90 backdrop-blur-xl border-t border-border/40 pb-[env(safe-area-inset-bottom)]">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors ${
              active ? 'text-brand' : 'text-foreground-muted'
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/admin/
git commit -m "feat(web): add admin navbar and bottom tab bar"
```

---

### Task 2: Replace Sidebar with Navbar in Admin Layout

**Files:**
- Modify: `apps/web/app/(app)/layout.tsx`

- [ ] **Step 1: Update the (app) layout to use navbar for admin**

The current layout wraps everything in `AppShell` (sidebar + topbar). We need to conditionally render: if admin, use `NavbarAdmin` + `BottomTabBarAdmin`; the `(app)` group is now admin-only since members use `(member)`.

Replace the entire `apps/web/app/(app)/layout.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/auth-context';
import { NavbarAdmin } from '../../components/admin/navbar-admin';
import { BottomTabBarAdmin } from '../../components/admin/bottom-tab-bar-admin';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace('/login');
    else if (!user.privacyAcceptedAt) router.replace('/privacy');
    else if (user.role === 'MEMBER') router.replace('/map');
  }, [user, isLoading, router]);

  if (isLoading || !user || !user.privacyAcceptedAt || user.role === 'MEMBER') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-foreground-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavbarAdmin
        userName={user.name}
        email={user.email}
        avatarUrl={user.pictureUrl}
        onLogout={() => { void logout(); }}
      />
      <main className="pt-14 lg:pt-14 pb-20 lg:pb-0">
        <div className="mx-auto max-w-6xl px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
      <BottomTabBarAdmin />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @ics-select/web build`
Expected: Build succeeds. Admin pages now use navbar instead of sidebar.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(app\)/layout.tsx
git commit -m "feat(web): replace admin sidebar with floating navbar"
```

---

## Phase 2: Shared Admin Components

### Task 3: Stat Card Component

**Files:**
- Create: `apps/web/components/admin/stat-card.tsx`

- [ ] **Step 1: Create the reusable stat card**

```tsx
// apps/web/components/admin/stat-card.tsx
'use client';

import { Card, CardBody } from '@heroui/react';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  iconClassName?: string;
}

export function StatCard({ icon: Icon, label, value, iconClassName = 'text-brand' }: StatCardProps) {
  return (
    <Card shadow="sm">
      <CardBody className="flex flex-row items-center gap-4 p-5">
        <div className="h-11 w-11 rounded-xl bg-surface-subtle flex items-center justify-center flex-shrink-0">
          <Icon className={`h-5 w-5 ${iconClassName}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-foreground-muted">{label}</p>
        </div>
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/admin/stat-card.tsx
git commit -m "feat(web): add reusable stat card component"
```

---

### Task 4: Create Cycle Modal

**Files:**
- Create: `apps/web/components/admin/create-cycle-modal.tsx`

- [ ] **Step 1: Create the modal**

```tsx
// apps/web/components/admin/create-cycle-modal.tsx
'use client';

import { useState } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api/client';

interface CreateCycleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateCycleModal({ isOpen, onClose }: CreateCycleModalProps) {
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch('/cycles', {
        method: 'POST',
        body: JSON.stringify({ name, startsAt, endsAt }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
      setName('');
      setStartsAt('');
      setEndsAt('');
      onClose();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        <ModalHeader>Novo ciclo</ModalHeader>
        <ModalBody className="space-y-4">
          <Input
            label="Nome"
            placeholder="Ex: Ciclo 2026.1"
            value={name}
            onValueChange={setName}
            variant="bordered"
          />
          <Input
            label="Inicio"
            type="date"
            value={startsAt}
            onValueChange={setStartsAt}
            variant="bordered"
          />
          <Input
            label="Fim"
            type="date"
            value={endsAt}
            onValueChange={setEndsAt}
            variant="bordered"
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>Cancelar</Button>
          <Button
            color="primary"
            onPress={() => mutation.mutate()}
            isLoading={mutation.isPending}
            isDisabled={!name || !startsAt || !endsAt}
          >
            Criar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/admin/create-cycle-modal.tsx
git commit -m "feat(web): add create cycle modal with HeroUI"
```

---

### Task 5: Create Material Modal

**Files:**
- Create: `apps/web/components/admin/create-material-modal.tsx`

- [ ] **Step 1: Create the modal**

```tsx
// apps/web/components/admin/create-material-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem, Textarea } from '@heroui/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api/client';

const FORMATS = [
  { key: 'VIDEO', label: 'Video' },
  { key: 'ARTICLE', label: 'Artigo' },
  { key: 'PROBLEM', label: 'Problema' },
  { key: 'BOOK', label: 'Livro' },
  { key: 'OTHER', label: 'Outro' },
];

const DIFFICULTIES = [
  { key: 'EASY', label: 'Facil' },
  { key: 'MEDIUM', label: 'Medio' },
  { key: 'HARD', label: 'Dificil' },
];

type Item = {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
  format: string;
  difficulty: string;
  estimatedMinutes: number;
  tags: string[];
};

interface CreateMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: Item | null;
}

export function CreateMaterialModal({ isOpen, onClose, editItem }: CreateMaterialModalProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');
  const [tags, setTags] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (editItem) {
      setTitle(editItem.title);
      setUrl(editItem.url ?? '');
      setDescription(editItem.description ?? '');
      setFormat(editItem.format);
      setDifficulty(editItem.difficulty);
      setEstimatedMinutes(String(editItem.estimatedMinutes));
      setTags(editItem.tags.join(', '));
    } else {
      setTitle(''); setUrl(''); setDescription(''); setFormat('');
      setDifficulty(''); setEstimatedMinutes(''); setTags('');
    }
  }, [editItem, isOpen]);

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        title, url: url || null, description: description || null,
        format, difficulty,
        estimatedMinutes: Number(estimatedMinutes),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      };
      if (editItem) {
        return apiFetch(`/library/${editItem.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      }
      return apiFetch('/library', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      onClose();
    },
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>{editItem ? 'Editar material' : 'Novo material'}</ModalHeader>
        <ModalBody className="space-y-4">
          <Input label="Titulo" value={title} onValueChange={setTitle} variant="bordered" />
          <Input label="URL" value={url} onValueChange={setUrl} variant="bordered" placeholder="https://..." />
          <Textarea label="Descricao" value={description} onValueChange={setDescription} variant="bordered" />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Formato" selectedKeys={format ? [format] : []} onSelectionChange={(keys) => setFormat([...keys][0] as string)} variant="bordered">
              {FORMATS.map((f) => <SelectItem key={f.key}>{f.label}</SelectItem>)}
            </Select>
            <Select label="Dificuldade" selectedKeys={difficulty ? [difficulty] : []} onSelectionChange={(keys) => setDifficulty([...keys][0] as string)} variant="bordered">
              {DIFFICULTIES.map((d) => <SelectItem key={d.key}>{d.label}</SelectItem>)}
            </Select>
          </div>
          <Input label="Tempo estimado (min)" type="number" value={estimatedMinutes} onValueChange={setEstimatedMinutes} variant="bordered" />
          <Input label="Tags (separadas por virgula)" value={tags} onValueChange={setTags} variant="bordered" />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>Cancelar</Button>
          <Button color="primary" onPress={() => mutation.mutate()} isLoading={mutation.isPending} isDisabled={!title || !format || !difficulty}>
            {editItem ? 'Salvar' : 'Criar'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/admin/create-material-modal.tsx
git commit -m "feat(web): add create/edit material modal with HeroUI"
```

---

### Task 6: Cycle Card + Member Drawer

**Files:**
- Create: `apps/web/components/admin/cycle-card.tsx`
- Create: `apps/web/components/admin/member-drawer.tsx`

- [ ] **Step 1: Create cycle card**

```tsx
// apps/web/components/admin/cycle-card.tsx
'use client';

import { Button, Card, CardBody, Chip, Progress } from '@heroui/react';
import { Calendar, Users } from 'lucide-react';
import Link from 'next/link';

interface CycleCardProps {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: 'ACTIVE' | 'ARCHIVED';
  memberCount?: number;
  avgProgress?: number;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));
  } catch { return iso; }
}

export function CycleCard({ id, name, startsAt, endsAt, status, memberCount = 0, avgProgress = 0 }: CycleCardProps) {
  const isActive = status === 'ACTIVE';

  return (
    <Card
      shadow="sm"
      className={isActive ? 'border-2 border-brand/40 ring-2 ring-brand/10' : 'opacity-75'}
    >
      <CardBody className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">{name}</h3>
          <Chip size="sm" color={isActive ? 'primary' : 'default'} variant="flat">
            {isActive ? 'Ativo' : 'Arquivado'}
          </Chip>
        </div>

        <div className="flex items-center gap-4 text-sm text-foreground-muted">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {formatDate(startsAt)} — {formatDate(endsAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            {memberCount} membros
          </span>
        </div>

        {isActive && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-foreground-muted">
              <span>Progresso medio</span>
              <span>{avgProgress}%</span>
            </div>
            <Progress value={avgProgress} color="primary" size="sm" />
          </div>
        )}

        <Button as={Link} href={`/admin/cycles/${id}`} variant={isActive ? 'solid' : 'bordered'} color={isActive ? 'primary' : 'default'} size="sm" className="w-full">
          Gerenciar
        </Button>
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 2: Create member drawer**

```tsx
// apps/web/components/admin/member-drawer.tsx
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
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/admin/cycle-card.tsx apps/web/components/admin/member-drawer.tsx
git commit -m "feat(web): add cycle card and member drawer components"
```

---

## Phase 3: Page Redesigns

### Task 7: Dashboard Redesign

**Files:**
- Modify: `apps/web/app/(app)/admin/dashboard/page.tsx`
- Create: `apps/web/components/admin/alert-list.tsx`

- [ ] **Step 1: Create the alert list component**

```tsx
// apps/web/components/admin/alert-list.tsx
'use client';

import { Avatar, Card, CardBody, Chip } from '@heroui/react';

type Alert = {
  id: string;
  name: string;
  pictureUrl: string | null;
  type: 'stuck' | 'behind' | 'complete';
  message: string;
};

interface AlertListProps {
  members: Array<{
    id: string;
    name: string;
    pictureUrl: string | null;
    stats: { doneItems: number; stuckItems: number; plansCount: number };
  }>;
}

const ALERT_CONFIG = {
  stuck: { color: 'danger' as const, label: 'Travou' },
  behind: { color: 'warning' as const, label: 'Atrasado' },
  complete: { color: 'success' as const, label: 'Completo' },
};

export function AlertList({ members }: AlertListProps) {
  const alerts: Alert[] = [];

  for (const m of members) {
    if (m.stats.stuckItems > 0) {
      alerts.push({ id: m.id, name: m.name, pictureUrl: m.pictureUrl, type: 'stuck', message: `${m.stats.stuckItems} item(ns) travado(s)` });
    } else if (m.stats.doneItems === 0 && m.stats.plansCount > 0) {
      alerts.push({ id: m.id, name: m.name, pictureUrl: m.pictureUrl, type: 'behind', message: 'Nao iniciou o plano' });
    }
  }

  if (alerts.length === 0) {
    return <p className="text-sm text-foreground-muted">Nenhum alerta no momento.</p>;
  }

  return (
    <Card shadow="sm">
      <CardBody className="p-0 divide-y divide-border/50">
        {alerts.map((a) => (
          <div key={`${a.id}-${a.type}`} className="flex items-center gap-3 px-5 py-3">
            <Avatar src={a.pictureUrl ?? undefined} name={a.name.charAt(0)} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{a.name}</p>
              <p className="text-xs text-foreground-muted">{a.message}</p>
            </div>
            <Chip size="sm" color={ALERT_CONFIG[a.type].color} variant="flat">
              {ALERT_CONFIG[a.type].label}
            </Chip>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 2: Rewrite the dashboard page**

Replace the entire `apps/web/app/(app)/admin/dashboard/page.tsx` with:

```tsx
'use client';

import { Activity, AlertTriangle, CheckCircle, TrendingUp, Users } from 'lucide-react';
import { Avatar, Chip, Progress, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../../../../lib/api/client';
import { StatCard } from '../../../../components/admin/stat-card';
import { AlertList } from '../../../../components/admin/alert-list';

type Member = {
  id: string;
  name: string;
  email: string;
  pictureUrl: string | null;
  role: 'ADMIN' | 'MEMBER';
  stats: { plansCount: number; doneItems: number; stuckItems: number; totalItems: number };
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => apiFetch<Member[]>('/admin/dashboard'),
  });

  if (isLoading) {
    return <p className="text-sm text-foreground-muted">Carregando dashboard...</p>;
  }

  const members = (data ?? []).filter((m) => m.role === 'MEMBER');
  const totalMembers = members.length;
  const totalDone = members.reduce((s, m) => s + m.stats.doneItems, 0);
  const totalItems = members.reduce((s, m) => s + (m.stats.totalItems ?? m.stats.doneItems + m.stats.stuckItems), 0);
  const avgProgress = totalItems === 0 ? 0 : Math.round((totalDone / totalItems) * 100);
  const stuckCount = members.filter((m) => m.stats.stuckItems > 0).length;
  const onTrack = members.filter((m) => m.stats.stuckItems === 0 && m.stats.doneItems > 0).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-foreground-muted mt-1">Visao geral do ciclo ativo</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Progresso medio" value={`${avgProgress}%`} />
        <StatCard icon={Users} label="Membros" value={totalMembers} />
        <StatCard icon={CheckCircle} label="On track" value={onTrack} iconClassName="text-success" />
        <StatCard icon={AlertTriangle} label="Travados" value={stuckCount} iconClassName="text-danger" />
      </div>

      <div>
        <h2 className="text-base font-bold text-foreground mb-3">Alertas</h2>
        <AlertList members={members} />
      </div>

      <div>
        <h2 className="text-base font-bold text-foreground mb-3">Membros</h2>
        <Table aria-label="Membros do ciclo" shadow="sm" isStriped>
          <TableHeader>
            <TableColumn>Membro</TableColumn>
            <TableColumn>Progresso</TableColumn>
            <TableColumn>Modulos</TableColumn>
            <TableColumn>Status</TableColumn>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const total = m.stats.totalItems ?? m.stats.doneItems + m.stats.stuckItems;
              const pct = total === 0 ? 0 : Math.round((m.stats.doneItems / total) * 100);
              const statusColor = m.stats.stuckItems > 0 ? 'danger' : m.stats.doneItems > 0 ? 'success' : 'warning';
              const statusLabel = m.stats.stuckItems > 0 ? 'Travou' : m.stats.doneItems > 0 ? 'On track' : 'Atrasado';
              return (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => router.push(`/admin/plans/${m.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar src={m.pictureUrl ?? undefined} name={m.name.charAt(0)} size="sm" />
                      <div>
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-foreground-muted">{m.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="w-32">
                      <Progress value={pct} color="primary" size="sm" />
                      <p className="text-xs text-foreground-muted mt-0.5">{pct}%</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{m.stats.doneItems}/{total}</span>
                  </TableCell>
                  <TableCell>
                    <Chip size="sm" color={statusColor} variant="flat">{statusLabel}</Chip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @ics-select/web build`

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/admin/dashboard/page.tsx apps/web/components/admin/alert-list.tsx
git commit -m "feat(web): redesign admin dashboard with stats, alerts, and member table"
```

---

### Task 8: Cycles List Page

**Files:**
- Modify: `apps/web/app/(app)/admin/cycles/page.tsx`

- [ ] **Step 1: Rewrite cycles page with cards + modal**

Replace the entire file with a page that:
- Shows cards grid (CycleCard) instead of table
- Uses CreateCycleModal instead of inline form
- Has a header with "Novo ciclo" button that opens modal
- Active cycles first, archived below

The page fetches `/cycles`, renders `CycleCard` for each, and uses `useDisclosure` for the modal.

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @ics-select/web build`

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(app\)/admin/cycles/page.tsx
git commit -m "feat(web): redesign cycles page with cards and HeroUI modal"
```

---

### Task 9: Cycle Detail Page

**Files:**
- Modify: `apps/web/app/(app)/admin/cycles/[id]/page.tsx`

- [ ] **Step 1: Rewrite cycle detail with stats + member list + plan timeline**

The page should have:
- Header: cycle name + status chip + dates + action buttons (Edit → modal, Archive → confirm)
- Stats row: 3 StatCards (members, avg progress, plans published)
- Members: HeroUI Table with avatar, name, email, progress bar, remove button
- Plan timeline: vertical list of weeks with status chips, progress %, clickable

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @ics-select/web build`

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(app\)/admin/cycles/\[id\]/page.tsx
git commit -m "feat(web): redesign cycle detail with member table and plan timeline"
```

---

### Task 10: Members Page with Drawer

**Files:**
- Modify: `apps/web/app/(app)/admin/members/page.tsx`
- Delete: `apps/web/app/(app)/admin/members/[id]/page.tsx`

- [ ] **Step 1: Rewrite members page with HeroUI Table + drawer**

The page should:
- Use HeroUI Table with: Avatar+Name, Email, Role chip, Actions (click row opens drawer)
- Search Input at top to filter by name/email
- MemberDrawer component for detail view
- State: `selectedMemberId` controls drawer

- [ ] **Step 2: Delete the old member detail page**

```bash
rm apps/web/app/\(app\)/admin/members/\[id\]/page.tsx
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @ics-select/web build`

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/admin/members/
git commit -m "feat(web): redesign members page with HeroUI table and slide-in drawer"
```

---

### Task 11: Library Page

**Files:**
- Modify: `apps/web/app/(app)/admin/library/page.tsx`
- Delete: `apps/web/app/(app)/admin/library/new/page.tsx`
- Delete: `apps/web/app/(app)/admin/library/[id]/page.tsx`

- [ ] **Step 1: Rewrite library page with HeroUI Table + modals**

The page should:
- HeroUI Table with: Title, Format chip (color-coded), Difficulty chip, Time, Actions (edit/delete)
- Header: search Input + format Select + difficulty Select + "Novo material" button
- CreateMaterialModal for create/edit
- Delete: confirmation dialog
- State: `editItem` controls modal in edit mode

- [ ] **Step 2: Delete old library new/edit pages**

```bash
rm apps/web/app/\(app\)/admin/library/new/page.tsx
rm apps/web/app/\(app\)/admin/library/\[id\]/page.tsx
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @ics-select/web build`

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/admin/library/
git commit -m "feat(web): redesign library page with HeroUI table and modal forms"
```

---

### Task 12: Plans Page (Split View)

**Files:**
- Modify: `apps/web/app/(app)/admin/plans/[memberId]/page.tsx`

- [ ] **Step 1: Rewrite plans page with split view**

Layout:
- Left panel (~300px): list of plans by week, ordered desc. Each item shows week range, status chip. Active plan highlighted. Clickable.
- Right panel: detail of selected plan with:
  - Header: dates + status + Publish button (if DRAFT)
  - Admin notes (editable textarea)
  - HeroUI Table of items: order, title, format chip, time, student status chip
  - "Adicionar material" button opens library search modal

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @ics-select/web build`

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(app\)/admin/plans/
git commit -m "feat(web): redesign plans page with split view"
```

---

## Phase 4: Cleanup

### Task 13: Remove AI Usage Page + Update Tests

**Files:**
- Delete: `apps/web/app/(app)/admin/ai-usage/page.tsx`
- Modify: `apps/web/tests/visual-audit.spec.ts`

- [ ] **Step 1: Delete ai-usage page**

```bash
rm apps/web/app/\(app\)/admin/ai-usage/page.tsx
```

- [ ] **Step 2: Update visual-audit tests**

Update the admin dashboard test assertions to match the new UI:
- Change heading assertion from `'Dashboard do Ciclo'` to `'Dashboard'`
- Change text assertions to match new stats: `'Progresso medio'`, `'On track'`, `'Alertas'`, `'Membros'`
- Remove any tests referencing ai-usage page
- Update auth-flow test if needed (admin now uses navbar, not sidebar)

- [ ] **Step 3: Verify tests pass locally**

Run: `pnpm --filter @ics-select/web test`

- [ ] **Step 4: Full build verification**

Run: `pnpm build && pnpm typecheck`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(web): remove ai-usage page, update Playwright tests for admin redesign"
```
