# Marca · Inteli Blockchain

Assets oficiais do clube, usados pelo deck da aula em `/slides/websocket-rpc-blockchain.html`.

**Origem:** `Identidade.zip`, entregue pelo clube. Os arquivos vêm do *Guia de Estilos Inteli
Blockchain 2025*. O padding transparente do export do Canva foi removido (crop pelo bbox);
nenhum pixel de arte foi alterado.

> Atenção à versão: o `DESIGN_SYSTEM.md` do clube cita o *Guia de Estilos - Blockchain 2026*
> (Giovanna Neves, 12 páginas). Estes assets são do guia **2025**. Se existir arte nova em 2026,
> substituir por ela.

## Qual usar

| Arquivo | Fundo | Quando |
| --- | --- | --- |
| `lockup-gradiente-fundo-escuro.png` | escuro | **Preferencial.** É o que o deck usa na capa. |
| `lockup-branco.png` | escuro | Quando o gradiente competiria: sobre foto, sobre cor, ou em tamanho pequeno. |
| `lockup-gradiente-fundo-claro.png` | claro | Texto preto. Nunca sobre fundo escuro. |
| `lockup-preto-fundo-claro.png` | claro | Texto preto, símbolo à direita. Nunca sobre fundo escuro. |
| `simbolo-branco.png` | escuro | Símbolo isolado, quando o nome do clube já está claro pelo contexto. O deck usa na barra de conexão. |
| `simbolo-gradiente.png` | escuro | Símbolo isolado com mais destaque. |
| `monograma-ibc.png` | qualquer | Espaço muito reduzido: favicon, avatar, selo. |
| `mascote.png` | qualquer | Comunicação e comunidade: boas-vindas, estado vazio, erro, evento. Nunca como ícone funcional. |
| `padrao-geometrico.png` | escuro | Decorativo. Abaixo de 8% de opacidade e **nunca atrás de texto corrido**. |

## Regras (DESIGN_SYSTEM.md §5.2)

- **Área de proteção:** margem livre em volta igual à altura do símbolo dividida por 2.
- **Tamanho mínimo:** 24px de altura para o símbolo isolado; 120px de largura para o lockup com texto.
- **Não faça:** esticar sem manter proporção · recolorir fora das variantes acima · aplicar sombra
  ou contorno · rotacionar · **reconstruir o gradiente à mão em vez de usar o arquivo** · colocar
  a variante preta sobre fundo escuro.

## Gradiente

O símbolo vai de ciano (canto inferior esquerdo) a roxo (canto superior direito), a cerca de 135°.

| Fonte | Início | Fim |
| --- | --- | --- |
| Amostrado de `simbolo-gradiente.png` | `#68bcc8` | `#914bab` |
| Documentado no `DESIGN_SYSTEM.md` §1.2 | `#63b4c4` | `#8c4ca9` |

A diferença é de 5 a 8 por canal, então o valor documentado serve para UI. Para material impresso,
pegue os valores reais no Canva com a Giovanna: a pendência 1 do design system continua aberta.

## Pendência

Estes arquivos são **PNG**. A pendência 2 do `DESIGN_SYSTEM.md` pede as variantes em **SVG**, que
ainda não existem versionadas em lugar nenhum. O símbolo isolado tem 385px de lado, o que basta
para tela e não basta para impresso.
