# Admin Experience Redesign

**Data:** 2026-04-12
**Escopo:** Redesign completo das telas admin do ICS Select. Migrar de sidebar + tabelas cruas para navbar flutuante estilo Stripe + modais HeroUI + visual premium alinhado com a nova paleta quente.

---

## 1. Layout Geral — Navbar Flutuante Stripe-like

Eliminar a sidebar esquerda para admins. Substituir por uma **navbar flutuante transparente** no topo, estilo Stripe.

### Navbar

- Fixa no topo com `backdrop-blur-xl` e fundo `bg-surface/80` semi-transparente
- Borda inferior sutil `border-b border-border/30`
- **Esquerda:** logo `BrandLockup` size md
- **Centro:** 4 itens de navegacao como links com icone + label, espacamento generoso, font-medium. Ao hover, background sutil arredondado. Item ativo com `text-brand` + `bg-brand/8`
  - Dashboard (LayoutDashboard)
  - Ciclos (Calendar)
  - Membros (Users)
  - Biblioteca (BookOpen)
- **Direita:** avatar clicavel com dropdown (Sair)
- **Mobile:** bottom tab bar com os 4 itens + Perfil

### Container de conteudo

- `max-w-6xl mx-auto px-6 lg:px-8 py-8`
- Sem sidebar — conteudo ocupa largura total
- Background `bg-background` (creme `#FDF8F3`)

### Componente

Criar `apps/web/components/admin/navbar-admin.tsx` — nao reutilizar o `TopbarMember` (a nav admin tem itens diferentes e pode evoluir separadamente).

---

## 2. Formularios — Modais HeroUI

Todos os formularios admin abrem como **modais HeroUI**:
- `Modal`, `ModalContent`, `ModalHeader`, `ModalBody`, `ModalFooter` do `@heroui/react`
- Inputs: `Input`, `Textarea`, `Select`, `SelectItem` do HeroUI
- Datas: `input type="date"` estilizado com classes HeroUI (HeroUI nao tem DatePicker nativo adequado)
- Botoes: `Button` do HeroUI com `color="primary"` (coral) para acao principal, `variant="light"` para cancelar
- Tamanho do modal: `size="lg"` para formularios com multiplos campos

### Modais necessarios

| Modal | Campos | Usado em |
|---|---|---|
| Criar/editar ciclo | Nome (Input), Inicio (date), Fim (date) | `/admin/cycles` |
| Adicionar membro ao ciclo | Select de usuarios disponiveis | `/admin/cycles/[id]` |
| Criar/editar material | Titulo, URL, Descricao, Formato (Select), Dificuldade (Select), Tempo estimado, Tags | `/admin/library` |
| Importar material por URL | URL (Input) + preview dos campos extraidos | `/admin/library` |

---

## 3. Dashboard (`/admin/dashboard`)

Tela principal do admin. Focada no ciclo ativo.

### Layout

**Header:** titulo "Dashboard" + nome do ciclo ativo + badge de status

**Stats row (4 cards HeroUI em grid):**
- Progresso medio (porcentagem, ring pequeno)
- Membros on track (numero + icone verde)
- Membros atrasados/travados (numero + icone vermelho)
- Total de modulos publicados na semana

**Alertas (card com lista):**
- Lista de alertas recentes: quem travou, quem nao comecou o plano, quem completou tudo
- Cada alerta e uma row com avatar, nome, descricao, timestamp
- Badge de severidade (vermelho = travou, amarelo = nao comecou, verde = completou)

**Lista de membros com progresso:**
- HeroUI `Table` com colunas: Avatar+Nome, Progresso (barra), Modulos (X/Y), Status (chip), Acoes
- Status chip: On Track (verde), Atrasado (amarelo), Travou (vermelho), Completo (azul)
- Acao: botao para ver plano do membro
- Ordenado por progresso ascendente (quem precisa de atencao primeiro)

---

## 4. Ciclos (`/admin/cycles`)

### Lista de ciclos

Cards grandes em grid (1 coluna mobile, 2 desktop):

**Card de ciclo ativo:**
- Borda `border-brand` com glow sutil
- Badge "Ativo" em coral
- Nome do ciclo, datas formatadas, contagem de membros
- Barra de progresso medio da turma
- Botao "Gerenciar" que navega para `/admin/cycles/[id]`

**Card de ciclo arquivado:**
- Visual opaco, sem borda colorida
- Badge "Arquivado" em cinza
- Mesma info mas sem barra de progresso
- Clicavel para ver detalhes

**Botao "Novo ciclo":** no header da pagina, abre modal de criacao

### Detalhe do ciclo (`/admin/cycles/[id]`)

**Header:** nome do ciclo + badge de status + datas + botoes (Editar → modal, Arquivar → confirmacao)

**Stats row:** membros total, progresso medio, planos publicados

**Lista de membros:**
- HeroUI `Table`: Avatar+Nome, Email, Progresso semanal (barra), Acao (ver plano, remover)
- Botao "Adicionar membro" abre modal com select de usuarios

**Timeline de planos semanais:**
- Lista vertical cronologica de todas as semanas do ciclo
- Cada semana: label "Semana de X a Y", status (Rascunho/Publicado/Completo), progresso medio
- Clicavel para navegar ao plano

---

## 5. Membros (`/admin/members`)

### Lista

HeroUI `Table` com colunas: Avatar+Nome, Email, Ciclo ativo, Progresso semanal (barra), Status

Filtros no topo: busca por nome/email (Input), filtro por ciclo (Select)

### Detalhe (drawer lateral)

Ao clicar num membro, abre **drawer da direita** (slide-in, ~450px largura):

- **Header:** avatar grande, nome, email, role badge
- **Stats:** planos completados, modulos feitos total, taxa de conclusao
- **Plano atual:** resumo do plano semanal ativo com barra de progresso
- **Historico:** lista compacta de planos anteriores com porcentagem
- **Acoes:** ver plano completo (navega), diagnostico IA (botao)

Usar Framer Motion para a animacao de slide-in do drawer.

---

## 6. Biblioteca (`/admin/library`)

### Lista

HeroUI `Table` com:
- Colunas: Titulo, Formato (chip com cor), Dificuldade (chip), Tempo, Plataforma, Acoes
- Chip de formato: VIDEO (roxo), ARTICLE (azul), PROBLEM (laranja), BOOK (verde)
- Acoes: Editar (abre modal), Excluir (confirmacao)
- Header: busca (Input) + filtro formato (Select) + filtro dificuldade (Select) + botao "Novo material" (abre modal)

### Modal criar/editar material

Campos: Titulo (Input), URL (Input), Descricao (Textarea), Formato (Select com opcoes VIDEO/ARTICLE/PROBLEM/BOOK/OTHER), Dificuldade (Select EASY/MEDIUM/HARD), Tempo estimado em minutos (Input type number), Tags (Input com chips)

### Modal importar por URL

Campo URL + botao "Importar". Mostra preview dos campos extraidos pela IA, editaveis antes de confirmar.

---

## 7. Planos do Membro (`/admin/plans/[memberId]`)

### Layout split

**Esquerda (~300px):** lista de planos semanais do membro, ordenados por data descendente. Cada item: "Semana de X a Y", status chip, clicavel. Plano ativo em destaque.

**Direita (restante):** detalhe do plano selecionado:
- Header: datas + status + botoes (Publicar se DRAFT, Editar se DRAFT)
- Notas do admin (editaveis inline)
- Lista de itens do plano: HeroUI Table com Ordem, Titulo do material, Formato (chip), Tempo, Status do aluno (chip), Acoes (remover item)
- Botao "Adicionar material" abre modal com busca na biblioteca
- Drag-and-drop para reordenar itens (opcional, pode ser botoes seta)

---

## 8. Responsividade

| Componente | Desktop | Mobile |
|---|---|---|
| Navbar | Fixa no topo, itens + labels | Bottom tab bar |
| Dashboard stats | Grid 4 colunas | Grid 2 colunas |
| Tables | Colunas completas | Colunas reduzidas, scroll horizontal |
| Modais | `size="lg"` centrado | Fullscreen (`size="full"`) |
| Drawer de membro | Slide-in direita 450px | Fullscreen |
| Split view planos | Side-by-side | Stacked (lista em cima, detalhe embaixo) |
| Cards de ciclo | Grid 2 colunas | Stack 1 coluna |

---

## 9. Componentes HeroUI a utilizar

| Componente | Uso |
|---|---|
| `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`, `TableColumn` | Todas as listas (membros, biblioteca, itens do plano, alertas) |
| `Modal`, `ModalContent`, `ModalHeader`, `ModalBody`, `ModalFooter` | Todos os formularios |
| `Input`, `Textarea`, `Select`, `SelectItem` | Campos de formulario |
| `Button` | Acoes primarias/secundarias |
| `Chip` | Status, formato, dificuldade |
| `Avatar` | Fotos de membros |
| `Card`, `CardBody`, `CardHeader` | Stats, ciclos, alertas |
| `Dropdown`, `DropdownTrigger`, `DropdownMenu`, `DropdownItem` | Menu do avatar, acoes em tabela |
| `Progress` | Barras de progresso |
| `Tooltip` | Infos adicionais on hover |

---

## 10. Paginas/rotas eliminadas

- `/admin/ai-usage` — removida (nao prioritaria)

---

## 11. Arquivos novos

```
apps/web/components/admin/
├── navbar-admin.tsx              # Navbar flutuante Stripe-like
├── bottom-tab-bar-admin.tsx      # Mobile bottom nav admin
├── stat-card.tsx                 # Card de estatistica reutilizavel
├── alert-list.tsx                # Lista de alertas do dashboard
├── cycle-card.tsx                # Card de ciclo (ativo/arquivado)
├── member-drawer.tsx             # Drawer lateral de detalhe do membro
├── create-cycle-modal.tsx        # Modal criar/editar ciclo
├── add-member-modal.tsx          # Modal adicionar membro ao ciclo
├── create-material-modal.tsx     # Modal criar/editar material
├── import-material-modal.tsx     # Modal importar material por URL
├── plan-split-view.tsx           # Split view de planos do membro
└── plan-item-row.tsx             # Row de item no plano (com acoes)
```

### Arquivos modificados

```
apps/web/app/(app)/layout.tsx                    # Usar navbar admin ao inves de sidebar
apps/web/app/(app)/admin/dashboard/page.tsx       # Redesign completo
apps/web/app/(app)/admin/cycles/page.tsx          # Cards ao inves de tabela
apps/web/app/(app)/admin/cycles/[id]/page.tsx     # Lista + timeline + stats
apps/web/app/(app)/admin/members/page.tsx         # Tabela HeroUI + drawer
apps/web/app/(app)/admin/members/[id]/page.tsx    # Pode ser eliminada (drawer substitui)
apps/web/app/(app)/admin/library/page.tsx         # Tabela HeroUI com filtros
apps/web/app/(app)/admin/library/new/page.tsx     # Pode ser eliminada (modal substitui)
apps/web/app/(app)/admin/library/[id]/page.tsx    # Pode ser eliminada (modal substitui)
apps/web/app/(app)/admin/plans/[memberId]/page.tsx # Split view
```

---

## 12. Fora de escopo

- Dark mode
- AI usage page (eliminada)
- Notificacoes push
- Drag-and-drop nos itens do plano (usar botoes de reordenacao por enquanto)
- Redesign da pagina de login (ja esta ok)
