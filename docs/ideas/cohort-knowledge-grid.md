# Cohort Knowledge Grid

## A ideia em uma frase

Uma view no admin onde eu bato o olho e vejo, em formato de grid, **quem do cohort estudou o quê** — sem precisar abrir o cockpit de cada pessoa.

## Por que eu quero isso

Quando estou preparando aula, hoje eu não tenho como saber:

- Quem pode responder a pergunta X (porque já estudou o topic Y)?
- Existe alguém que dominou um topic que ninguém mais tocou? (o "especialista" do cohort)
- Qual topic ninguém estudou ainda? (gap que a aula precisa ensinar from zero)
- Quem está atrasado em relação ao grupo num topic específico?

Tudo isso aparece pra mim só rodando SQL na unha. Quero ver no frontend.

## Como eu imagino a view

**Uma tabela grande, membros nas linhas, topics nas colunas.**

```
                hashmap  db   cache  shard  repl   net    mq   pubsub  ...
Eduardo Izawa     —      ●●    ●●    ●●     ●●    ●●     —     —
Maria Clara       ●●     —     —     —      —     ●     —     ●●
Lorena Garcia     ●●     ●●    —     —      —     —     —     —
Leunam Sousa      —      ●     ●     —      —     —     —     —
Lucas Faria       ●●     —     —     —      —     —     —     —
...
```

A célula não precisa ser número cru. Pode ser:

- **vazio** = nunca tocou
- **um ponto pequeno** = começou (1 item)
- **dois pontos** = pegou bem (2+ items)
- **um ponto vermelho ou amarelo** = ficou STUCK ou marcou DOUBTS — atenção

Tipo um heatmap discreto. Não quero ler números, quero ver padrão.

## Coisas que seriam ouro ter

- **Hover na célula**: mostra quais items específicos a pessoa completou nesse topic + outcome de cada um
- **Hover no nome do topic na header**: lista todos os items do library naquele topic (pra eu lembrar do que se trata)
- **Click no nome do membro**: vai pro cockpit dela
- **Filtro por topic**: marcar 3-4 topics e a tabela esconde o resto — fica fácil ver "quem tem essa combinação"
- **Ordenar coluna**: clicar num topic ordena os membros por quem mais estudou aquilo (acha o owner rápido)
- **Linha de totais embaixo**: "X de 12 membros pegaram esse topic" — encontra os gaps de cohort
- **Coluna de totais à direita**: "essa pessoa estudou Y topics" — encontra os adiantados

## Detalhes que importam

- Topics agrupados por área (estruturas → fundamentos SD → cases) na ordem do `Topic.order`, com separadores visuais sutis entre grupos
- Versão "compacta" e versão "expandida" — compacta cabe na tela inteira sem scroll; expandida mostra mais detalhe por célula
- Filtro por ciclo (default = ciclo ativo)
- Filtro por track opcional (só Big Tech, só Consulting, etc.)

## O que NÃO quero

- Não quero gráfico bonitinho de barras ou pizza — quero a matriz crua
- Não quero ranking ou score em cima disso — já tem o engagement score pra isso, esse é um lente diferente
- Não quero "recomendação automática" do tipo "esse member precisa estudar X" — quero ver o dado e decidir eu mesmo
- Não precisa ser realtime — atualiza quando a página carrega, ok

## Onde mora no admin

Provavelmente uma seção dentro de `/admin/cycle/[id]`, abaixo (ou ao lado) do Engagement ranking. Ou uma rota nova `/admin/cycle/[id]/knowledge` se for grande demais pra caber no overview.
