import type { Lesson } from '../lesson-types';

export const ledgerFinanceiro: Lesson = {
  slug: 'ledger-financeiro',
  title: 'Modelando Dinheiro: o Ledger',
  subtitle: 'Por que 0.1 + 0.2 quebra um banco, e como a Uber resolve com double-entry imutável.',
  blurb:
    'Uma curiosidade de console que vira system design. A aula abre digitando 0.1 + 0.2 e olhando o lixo no resultado, estabelece por que dinheiro não mora num float, e mostra que a correção de verdade não é trocar o tipo da coluna: é trocar o modelo. A partir daí a escada tem quatro degraus, e cada um existe porque o anterior quebrou. Double-entry, onde toda transação grava dois entries que somam zero. Append-only, onde nenhuma linha é editada e a correção vira um entry de estorno. Idempotency key, porque a rede reenvia e o sistema não pode cobrar duas vezes. E o fechamento no LedgerStore da Uber, que processa mais de 2 trilhões de índices únicos sobre um log imutável. A frase que sai daqui: o saldo não é um dado guardado, é a soma de um log que nunca é apagado.',
  durationMin: 60,
  audience: 'Hopes and Dreams 2026.3 · Big Tech',
  slidesUrl: '/slides/ledger-financeiro.html',
  nodes: [
    // ──────────────── FOUNDATIONS (study-only) ────────────────
    {
      id: 'f-representacao',
      label: 'Como o computador guarda número',
      group: 'foundations',
      teachFromZero: true,
      oneLine:
        'Um inteiro guarda o valor exato. Um float guarda uma aproximação em notação científica binária, e é dessa aproximação que sai todo bug de dinheiro.',
      pass1:
        'Existem dois jeitos básicos de o computador guardar um número, e a diferença entre eles é a aula inteira em miniatura. Um inteiro guarda o valor exato em binário direto: 5 é 101, 42 é 101010, sem perda em nenhum ponto. Um float guarda número com casa decimal em notação científica binária, com um sinal, um expoente e uma mantissa dentro de 64 bits. Como 64 bits são finitos e a maioria dos decimais que escrevemos não cabe exato em base 2, o que o float guarda é uma aproximação. Muito boa, e ainda assim aproximação.',
      pass2:
        '**O problema é de base, não de linguagem.** Em decimal, 1/3 vira 0.3333... e não termina nunca. Todo mundo aceita isso sem estranhar, porque cresceu na base 10. O que quase ninguém percebe é que a base 2 tem exatamente o mesmo problema, só que com outro conjunto de números.\n\nEm base 2 você representa exato apenas as frações cujo denominador é potência de 2. Por isso 0.5 vira 0.1, 0.25 vira 0.01 e 0.75 vira 0.11, todos limpos. Mas 0.1, um décimo, vira 0.0001100110011... e repete para sempre. O computador corta essa dízima na largura da mantissa e guarda o valor representável mais próximo, que não é 0.1.\n\n**O que o IEEE 754 é e o que ele não é.** Ele é o padrão que define o formato (sinal, expoente, mantissa) e está implementado em praticamente todo processador em uso. Ele não é uma escolha da linguagem, não é configurável pela aplicação e não é um bug: Python, JavaScript, Java, C e Go devolvem o mesmo 0.30000000000000004 porque todos delegam a mesma operação ao mesmo hardware. Trocar de linguagem não muda nada.\n\n**Três decisões que a aproximação já contamina**, e vale ver antes de falar de dinheiro. Comparar com igualdade deixa de ser confiável, porque `0.1 + 0.2 === 0.3` é falso. Somar em ordem diferente pode dar resultado diferente, porque o corte acontece em pontos distintos. E aumentar a precisão (de float 32 para double 64) empurra o erro para uma casa mais distante sem nunca eliminá-lo, porque a dízima continua infinita.\n\n**A consequência que importa para a aula.** Float é a escolha certa em física, gráficos e machine learning, onde um erro na décima sexta casa não muda nenhuma decisão. É a escolha errada em dinheiro, onde o mesmo erro somado um milhão de vezes vira um valor visível no fechamento contábil e alguém precisa explicar de onde ele saiu.',
      visuals: [
        {
          kind: 'image',
          title: 'Os 64 bits de um double, por campo',
          src: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/IEEE_754_Double_Floating_Point_Format.svg',
          alt: 'Diagrama do formato IEEE 754 de precisão dupla, com 1 bit de sinal, 11 bits de expoente e 52 bits de mantissa.',
          caption:
            'Um double são 64 bits divididos em três campos: 1 de sinal, 11 de expoente e 52 de mantissa. O valor é (-1)^sinal × 1,mantissa × 2^(expoente-1023).',
          board:
            'Desenhe a barra e divida em três, marcando 1 / 11 / 52 embaixo. Escreva a fórmula ao lado. Tudo o que vem depois é substituir valores nesses três campos.',
          credit: 'Wikimedia Commons · Codekaizen · CC BY-SA 4.0',
          creditUrl:
            'https://commons.wikimedia.org/wiki/File:IEEE_754_Double_Floating_Point_Format.svg',
        },
        {
          kind: 'ascii',
          title: '0.25 cabe, 0.1 não cabe',
          art: `0.25  =  1,0 x 2^-2       cabe exato

  S  expoente        mantissa (52 bits)
  0  01111111101     0000000000000000000000000000000000000000000000000000
                     tudo zero, porque 1,0 nao tem parte fracionaria


0.1   =  1,6 x 2^-4       nao cabe

  S  expoente        mantissa (52 bits)
  0  01111111011     1001100110011001100110011001100110011001100110011010
                     ^^^^ o bloco 1001 repete para sempre.
                          o hardware corta no bit 52 e arredonda o ultimo.

hex: 0.25 -> 3FD0000000000000     0.1 -> 3FB999999999999A`,
          caption:
            'A diferença não é de tamanho, é de denominador. Base 2 representa exato só as frações cujo denominador é potência de 2, e 1/10 não é.',
          board:
            'Escreva os dois casos um embaixo do outro e circule só a mantissa. A sala vê os zeros de um lado e o padrão repetido do outro sem você precisar explicar.',
        },
      ],
      pass3: [
        {
          gotcha: 'Tratar como bug da linguagem',
          note: 'Não é do Python nem do JavaScript, é do hardware seguindo o IEEE 754. Trocar de linguagem não muda o resultado, porque a dízima de 0.1 em base 2 é a mesma em qualquer lugar. O teste que encerra a discussão é rodar a mesma conta em duas linguagens diferentes.',
        },
        {
          gotcha: 'Confundir precisão com exatidão',
          note: 'Um double tem de 15 a 17 dígitos de precisão, o que é bastante. Precisão alta não é exatidão: 0.1 continua sendo uma aproximação, só que com mais casas antes de o erro aparecer. Precisão adia o problema, exatidão o elimina.',
        },
        {
          gotcha: 'Arredondar na exibição e considerar resolvido',
          note: 'Formatar com duas casas esconde o erro na tela e deixa o valor guardado igual. Somar mil valores sujos e arredondar o total no fim devolve um número diferente de somar mil valores exatos. O arredondamento é apresentação, não correção.',
        },
      ],
      anchor:
        'Por que 0.5 cabe exato em binário e 0.1 não cabe?',
      followup:
        'Se float não serve para dinheiro, o que entra no lugar, e que propriedade esse substituto precisa ter?',
      gotcha:
        'Se alguém disser "é erro de arredondamento do Python", devolva: "abre o console do Chrome e roda a mesma conta. JavaScript devolve idêntico. Se as duas linguagens erram igual, onde está o erro?"',
    },
    // ──────────────── MONEY: o problema ────────────────
    {
      id: 'float-money',
      label: 'O bug de um trilhão de dólares',
      group: 'money',
      beat: 1,
      teachFromZero: true,
      tags: ['ieee-754', 'floating-point', 'rounding-error', 'integer-cents', 'decimal'],
      visuals: [
        {
          kind: 'ascii',
          title: 'Por que 0.1 + 0.2 não dá 0.3',
          art: `o que o hardware guarda de verdade:

  0.1   ->   0.100000000000000005551115123125782
  0.2   ->   0.200000000000000011102230246251565
           + ------------------------------------
             0.300000000000000016653345369377348
             v  arredonda pro double mais proximo
  0.1+0.2 =  0.300000000000000044408920985006261

  0.3   ->   0.299999999999999988897769753748434
             ^ outro numero. por isso === devolve false`,
          caption:
            'Nenhuma das três constantes existe exata na máquina. O erro não nasce na soma, ele já estava dentro de cada parcela antes de somar.',
          board:
            'Escreva só as duas primeiras linhas e pergunte quanto dá. A sala responde 0.3, e aí você escreve a terceira. O silêncio faz o trabalho.',
        },
        {
          kind: 'ascii',
          title: 'A correção: inteiro de centavos',
          art: `R$ 19,90  em float          R$ 19,90  em centavos

   19.899999999999998            1990          <- inteiro exato
   +  0.10000000000000000        +  10
   ------------------            ------
   19.999999999999996            2000          <- soma exata

   formata na saida:  2000 / 100  =  "R$ 20,00"

regra: o valor VIVE como inteiro. a virgula so aparece na tela.`,
          caption:
            'A vírgula deixa de ser propriedade do dado e passa a ser decisão de apresentação. Enquanto o valor circula pelo sistema, ele é um inteiro.',
          board:
            'Faça as duas colunas lado a lado e some as duas na frente da sala. É o argumento mais curto da aula inteira.',
        },
      ],
      oneLine:
        'O resultado de 0.1 + 0.2 carrega lixo na última casa, e esse lixo é a razão de nenhum sistema financeiro sério guardar dinheiro num float.',
      pass1:
        'Abra o console do navegador e digite 0.1 + 0.2. O resultado é 0.30000000000000004. Não é bug do Chrome e não é particularidade de JavaScript: é assim em toda linguagem que use o hardware. Agora coloque esse resíduo dentro de um sistema que move bilhões de reais por dia. Cada operação carrega um erro minúsculo, e quando você soma milhões de operações o erro deixa de ser minúsculo. É daí que sai a primeira regra de qualquer sistema financeiro: dinheiro não mora num float.',
      pass2:
        '**Por que o lixo aparece.** 0.1 e 0.2 são dízimas infinitas em base 2, como visto na fundação. O computador guarda a versão cortada de cada um, soma as duas versões cortadas, e o erro das duas se acumula na décima sétima casa. Isolado, ele é invisível. Repetido, não.\n\n**O experimento que mostra a escala.** Some R$ 0,10 um bilhão de vezes em float. O total não dá R$ 100 milhões cravados, dá algo próximo de R$ 100.000.007. Sete reais que não entraram por nenhuma transação e não saem por nenhuma. Num banco isso é um descasamento de balanço, e alguém tem que explicar a origem do valor.\n\n**O erro já teve consequência física.** Em 1991 uma bateria de mísseis Patriot acumulou erro de ponto flutuante no relógio interno. Depois de cerca de cem horas ligada sem reinício, o desvio acumulado foi suficiente para errar a interceptação de um Scud, e 28 pessoas morreram. O caso é o exemplo canônico de que representação numérica é decisão de engenharia, não detalhe de implementação.\n\n**A correção é parar de usar fração.** Guarde dinheiro como **inteiro de centavos**: R$ 19,90 vira o inteiro 1990, e a vírgula entra só na formatação. Soma e subtração de inteiro são exatas, então nada se acumula. A alternativa é um tipo decimal de precisão arbitrária, DECIMAL no Postgres ou BigDecimal no Java, que guarda o número em base 10 e serve quando você precisa de fração menor que o centavo, como em juros e câmbio.\n\n**O que essa correção não resolve, e é o gancho do resto da aula.** Inteiro de centavos elimina o erro de representação e nada além disso. Ele não diz quem deve quanto a quem, não sobrevive a duas escritas concorrentes na mesma conta, e não guarda o que o valor era ontem. O tipo do dado está resolvido. O modelo, não.',
      pass3: [
        {
          gotcha: 'Usar FLOAT na coluna do banco',
          note: 'Uma coluna de valor declarada FLOAT ou REAL carrega o mesmo erro para dentro do banco, e nenhuma correção na aplicação alcança o dado já gravado. Use BIGINT de centavos ou DECIMAL com precisão e escala declaradas. Deixe FLOAT para medida física.',
        },
        {
          gotcha: 'Comparar dinheiro com igualdade exata',
          note: 'Enquanto o valor for float, `0.1 + 0.2 === 0.3` é falso, e uma condição de "saldo suficiente" pode reprovar uma operação legítima sem erro nenhum aparecer no log. Com inteiro de centavos a comparação volta a ser confiável.',
        },
        {
          gotcha: 'Dividir e perder o centavo',
          note: 'R$ 10,00 divididos entre três pessoas dão 333 + 333 + 333 = 999 centavos, e um centavo fica sem dono. Trocar float por inteiro não resolve isso, só torna a perda visível. A aplicação precisa decidir explicitamente quem recebe a sobra.',
        },
        {
          gotcha: 'Tomar o inteiro de centavos como solução completa',
          note: 'Ele resolve exclusivamente a representação. A concorrência entre duas escritas, a durabilidade quando o processo cai no meio e a reconstrução do histórico continuam abertas, e são o assunto dos próximos beats.',
        },
      ],
      anchor:
        'Abra o console do navegador, digite 0.1 + 0.2 e olhe o resultado. Por que esse resultado é grave para quem move dinheiro, e o que você usaria no lugar de um float?',
      askWho: [
        {
          name: 'open',
          why: 'Beat de abertura e ciclo novo, então ninguém tem vantagem de repertório aqui. A pergunta é para a sala inteira rodar junto no console, e a reação ao resultado vale mais que a explicação.',
        },
        {
          name: 'open',
          why: 'Para a segunda tentativa, chame quem já tiver mexido com base binária ou conversão de base em alguma matéria. Essa pessoa costuma chegar sozinha na ideia de dízima.',
        },
        {
          name: 'open',
          why: 'Se ninguém arriscar o porquê, aceite a observação sem a causa e ensine a dízima binária direto. É conteúdo de fundação, não de cobrança.',
        },
      ],
      followup:
        'Guardamos tudo como inteiro de centavos e o erro de representação acabou. O que ainda pode dar errado quando esse dinheiro precisa SAIR de uma conta e ENTRAR em outra?',
      gotcha:
        'Quando alguém disser "é só arredondar para duas casas", devolva: "arredonda em que momento? Se é na hora de exibir, o valor guardado continua com o resíduo e a soma de mil deles continua errada. Se é na hora de gravar, você acabou de escolher jogar dinheiro fora em qual direção?"',
      scenarios: {
        right: {
          shape:
            'Reconhece que 0.1 não cabe exato em binário, que o erro acumula em escala, e propõe inteiro de centavos ou tipo decimal de precisão arbitrária. Bônus se cita que é IEEE 754, não bug de linguagem.',
          redirect:
            'Confirme com a sala e empurre pro próximo problema: "ótimo, dinheiro agora é inteiro exato. Mas guardar UM número não é o mesmo que MOVER dinheiro entre contas. Como você modela uma transferência?"',
        },
        close: {
          shape:
            'Sabe que float dá problema com dinheiro mas não sabe explicar a causa (acha que é arredondamento genérico), ou propõe "usar mais casas decimais", que só adia o erro.',
          redirect:
            'Pergunte a origem: "por que MAIS casas não resolve? 1/3 em decimal melhora se você usa mais casas?" Force a conexão com a dízima.',
        },
        wayOff: {
          shape:
            'Acha que é bug específico do JavaScript, ou que basta usar == com tolerância, ou parte pra "uso string pra guardar dinheiro" sem pensar em como soma string.',
          redirect:
            'Não corrija direto. Pergunte: "se é bug do JS, por que Python e Java dão o mesmo 0.30000000000000004?" Deixe a contradição aparecer.',
        },
      },
    },
    {
      id: 'naive-balance',
      label: 'A coluna balance que mente',
      group: 'money',
      beat: 2,
      tags: ['mutable-state', 'atomicity', 'lost-update', 'audit-trail', 'race-condition'],
      visuals: [
        {
          kind: 'ascii',
          title: 'Lost update, passo a passo no tempo',
          art: `tempo ->

  T1                          T2                    saldo no banco
  --------------------------  --------------------  --------------
  le saldo = 100                                          100
                              le saldo = 100               100
  calcula 100 - 50 = 50                                    100
                              calcula 100 - 50 = 50        100
  grava 50                                                  50
                              grava 50                      50
                                                             ^
  esperado: 0          obtido: 50          R$ 50 do nada`,
          caption:
            'As duas leituras acontecem antes de qualquer escrita. Nesse intervalo as duas transações enxergam o mesmo mundo, e a segunda escrita apaga a primeira.',
          board:
            'Desenhe as duas colunas e vá preenchendo linha a linha, perguntando o saldo a cada passo. A sala percebe o furo na terceira linha, antes de você chegar ao fim.',
        },
        {
          kind: 'ascii',
          title: 'Os três defeitos e o que cada remendo cobre',
          art: `defeito            remendo                    o que fica de pe
-----------------  -------------------------  ------------------
concorrencia       SELECT ... FOR UPDATE      conta virou gargalo
durabilidade       transacao de banco         (resolvido)
auditoria          tabela de log paralela     duas fontes de
                                              verdade sem criterio
                                              de desempate

                   e nenhum deles responde:
                   "qual era o saldo dia 14 as 15h?"`,
          caption:
            'Os três remendos funcionam de verdade, e é por isso que o modelo sobrevive tanto tempo em produção antes de dar problema.',
          board:
            'Faça a tabela em três colunas e preencha a terceira junto com a sala. A última linha é a que muda a conversa.',
        },
      ],
      oneLine:
        'O modelo ingênuo guarda o saldo numa coluna e dá UPDATE. Ele quebra em concorrência, não sobrevive a uma queda no meio e apaga o histórico ao escrever.',
      pass1:
        'O primeiro instinto de qualquer pessoa é uma tabela de contas com uma coluna de saldo. Transferir R$ 50 da Ana para o Beto vira uma sequência de quatro passos: ler o saldo da Ana, gravar o saldo menos 50, ler o saldo do Beto, gravar o saldo mais 50. Dois UPDATEs e acabou. O modelo parece óbvio, e é essa obviedade que o torna perigoso: ele tem três defeitos independentes, e nenhum deles aparece em teste com um usuário só.',
      pass2:
        '**Defeito 1: concorrência.** Duas transferências saem da conta da Ana no mesmo instante. As duas leem o saldo de 100 antes de qualquer uma gravar, as duas calculam 100 menos 50, e as duas gravam 50. O resultado correto seria 0, e a Ana termina com 50. Cinquenta reais passaram a existir sem que nenhuma transação os tenha criado. Isso se chama **lost update**: a segunda escrita passa por cima da primeira, e o que a primeira tirou volta.\n\n**Defeito 2: durabilidade no meio da operação.** O processo cai depois de gravar o débito da Ana e antes de gravar o crédito do Beto. A Ana perdeu 50 e o Beto não recebeu nada. Os dois lados precisam acontecer juntos ou nenhum acontecer, e duas escritas soltas em duas linhas não dão essa garantia por si mesmas.\n\n**Defeito 3: auditoria.** Um UPDATE sobrescreve o valor anterior, então o valor anterior deixa de existir. Quando o regulador perguntar, seis meses depois, por que o saldo daquela conta mudou no dia 14, a resposta honesta é que ninguém sabe: o banco só guarda o número de agora. Em sistema financeiro isso não é uma limitação incômoda, é descumprimento de obrigação legal de retenção.\n\n**Os três têm remendo, e é importante saber qual é.** Concorrência se resolve com `SELECT ... FOR UPDATE` ou nível de isolamento serializável, ao custo de throughput. Durabilidade se resolve envolvendo os dois UPDATEs numa transação ACID. Auditoria se resolve com uma tabela de log paralela. Nenhum dos três está errado, e é justamente por isso que o modelo sobrevive tanto tempo em produção antes de dar problema.\n\n**O que os remendos não resolvem.** A tabela de log paralela cria uma segunda fonte de verdade, e quando ela discordar da coluna de saldo não existe critério para decidir quem está certo. O lock serializa a conta, então uma conta movimentada vira gargalo. E os três remendos juntos ainda deixam de pé a pergunta que ninguém consegue responder: qual era o saldo às 15h do dia 14. A pergunta produtiva deixa de ser como consertar o UPDATE e passa a ser o que acontece se o UPDATE for proibido.',
      pass3: [
        {
          gotcha: 'Tomar BEGIN e COMMIT como solução de concorrência',
          note: 'Uma transação garante atomicidade, que é tudo ou nada, e isso resolve o defeito 2. Ela não impede o lost update se a leitura do saldo aconteceu sem lock: as duas transações leem o mesmo valor e as duas fazem COMMIT sem conflito. Atomicidade e isolamento são garantias diferentes, e só a segunda resolve a corrida.',
        },
        {
          gotcha: 'Tratar a tabela de log paralela como auditoria',
          note: 'Com o saldo numa coluna e o histórico numa tabela separada, os dois podem divergir por um bug em qualquer um dos dois caminhos de escrita. Não existe critério para decidir quem está certo, porque nenhum dos dois deriva do outro. Um log que é cópia não é prova.',
        },
        {
          gotcha: 'Autorizar com base no saldo lido antes',
          note: 'Ler o saldo, concluir que há valor suficiente e só depois debitar abre uma janela em que outra transação esvazia a conta. A decisão e a escrita precisam acontecer na mesma operação atômica, senão a autorização se baseia num saldo que já não existe.',
        },
      ],
      anchor:
        'Você modela conta como uma tabela com coluna de saldo. Duas transferências de R$ 50 saem da mesma conta de R$ 100 no mesmo milissegundo. Desenhe o que cada uma lê e o que cada uma grava, e diga com quanto a conta termina.',
      askWho: [
        {
          name: 'open',
          why: 'Chame quem já tiver visto transação de banco de dados em alguma matéria ou estágio. Quem conhece BEGIN e COMMIT normalmente enxerga o defeito 2 antes dos outros dois, e isso já abre a conversa.',
        },
        {
          name: 'open',
          why: 'Segunda tentativa com quem tiver mexido com concorrência em qualquer linguagem, mesmo fora de banco. Quem já debugou race condition em thread reconhece o padrão sem precisar do nome formal.',
        },
        {
          name: 'open',
          why: 'Se ninguém chegar, conduza o traço no quadro passo a passo. Escreva as quatro operações em ordem e deixe a sala ler o resultado, em vez de anunciar o lost update.',
        },
      ],
      followup:
        'Os três defeitos têm uma raiz só, que é o UPDATE apagar informação ao escrever. Se a regra passasse a ser que nenhuma linha de dinheiro pode ser alterada, como você registraria a transferência?',
      gotcha:
        'Quando alguém disser "é só botar um lock", devolva: "lock na conta da Ana resolve a corrida, concordo. Agora o processo cai entre o débito dela e o crédito do Beto. O lock devolve o dinheiro para alguém?"',
      scenarios: {
        right: {
          shape:
            'Identifica que as duas leem 100, ambas gravam 50, e a conta termina com 50 em vez de 0. Nomeia lost update. Bônus se também aponta o risco da queda no meio dos dois UPDATEs.',
          redirect:
            'Confirme e generalize: "esse é só um dos três furos. Tem o da queda no meio e o de apagar o histórico. Todos saem do UPDATE. Como seria o modelo se UPDATE fosse proibido?"',
        },
        close: {
          shape:
            'Vê que tem algo errado na concorrência mas conclui "termina com 0" sem perceber que a leitura suja deixa em 50, ou resolve só com "usa transação" sem ver a corrida na leitura.',
          redirect:
            'Force o passo a passo: "as duas leem o saldo ANTES de qualquer uma gravar. Que número as duas leram? Então que número as duas gravam?"',
        },
        wayOff: {
          shape:
            'Acha o modelo da coluna saldo perfeito, ou propõe resolver tudo com "um mutex global no sistema" sem ver que isso mata o throughput e ainda não trata a durabilidade.',
          redirect:
            'Puxe pro custo: "mutex global serializa o banco inteiro, um pagamento por vez no mundo. Aguenta a Uber com isso? E mesmo serializado, a queda no meio ainda perde dinheiro. Por quê?"',
        },
      },
    },
    // ──────────────── LEDGER: a solução ────────────────
    {
      id: 'double-entry',
      label: 'Double-entry: todo dinheiro vem de algum lugar',
      group: 'ledger',
      beat: 3,
      tags: ['double-entry', 'debit-credit', 'balanced-transaction', 'zero-sum', 'derived-balance'],
      visuals: [
        {
          kind: 'ascii',
          title: 'Uma transação, dois entries, soma zero',
          art: `transacao #8841        R$ 50, da Ana para o Beto
  |
  +-- entry   conta:ana     debito    -50
  +-- entry   conta:beto    credito   +50
                                      ----
                            soma        0    <- so entra se der zero


e a mesma regra no sistema inteiro:

  soma de TODOS os entries de TODAS as contas  =  0

  deu outro numero?  existe bug, e voce descobriu
  sem saber qual transacao causou.`,
          caption:
            'A soma global ser zero não é uma verificação que alguém lembrou de escrever. É consequência aritmética de toda transação somar zero.',
          board:
            'Desenhe a transação com as duas ramificações e escreva a soma embaixo. Depois pergunte o que acontece se você somar o sistema inteiro.',
        },
        {
          kind: 'ascii',
          title: 'Onde o saldo foi parar',
          art: `ANTES                        DEPOIS
tabela de saldos             tabela de movimentos

conta   saldo                conta      valor
-----   -----                --------   -----
ana       100                ana         +48
beto       36                ana         -12
^^^^^^^^^^^^^                ana         -50
uma linha que                beto        +50
alguem sobrescreve           ...
                             so cresce, nunca muda

saldo da ana = le a linha    saldo da ana = SELECT sum(valor)
                                            WHERE conta='ana'`,
          caption:
            'O saldo deixa de ser uma linha que alguém sobrescreve e vira uma pergunta feita ao log. Não existe mais o que duas transações concorrentes disputem.',
          board:
            'Faça as duas tabelas lado a lado. A da esquerda cabe em quatro linhas, a da direita não para de crescer, e é exatamente esse o ponto.',
        },
      ],
      oneLine:
        'A regra que a contabilidade escreveu em 1494: toda transação grava dois entries que se cancelam, e a soma de todos os entries do sistema é sempre zero.',
      pass1:
        'A saída não veio da computação, veio da contabilidade italiana do século XV. O double-entry parte de uma observação simples: dinheiro não aparece nem desaparece, ele muda de lugar. Então todo movimento tem dois lados, de onde saiu e para onde foi. Transferir R$ 50 da Ana para o Beto deixa de ser uma operação que altera duas contas e passa a ser uma **transação** com dois **entries**: um débito de 50 na conta da Ana e um crédito de 50 na conta do Beto. Os dois somam zero. Uma transação cujos entries não somam zero é inválida e não entra no ledger.',
      pass2:
        '**O modelo de dado.** Uma transação é um grupo de entries. Cada entry tem três campos que importam: a conta, o valor e o lado, débito ou crédito. A regra de integridade é que, dentro de uma mesma transação, a soma dos débitos iguala a soma dos créditos, então o delta é zero.\n\nA transferência fica assim, gravada de uma vez:\n\n```\ntransação #8841   R$ 50, da Ana para o Beto\n  entry  conta:ana    débito   -50\n  entry  conta:beto   crédito  +50\n  soma dos entries = 0\n```\n\n**A propriedade que vem junto sem custo.** Se toda transação soma zero, a soma de todos os entries de todas as contas do sistema também é zero. Quando essa soma global der qualquer outro valor, existe um bug, e você descobre isso sem precisar saber qual transação o causou. É um teste de integridade que roda sobre o banco inteiro, e ele funciona porque é consequência aritmética do modelo, não uma verificação que alguém lembrou de escrever.\n\n**O que essa tabela é e o que ela não é.** Ela é uma tabela de movimentos. Ela não é uma tabela de saldos, não é um log auxiliar ao lado de uma coluna de saldo, e não é uma cópia de auditoria de outra coisa. O saldo da Ana não está gravado em lugar nenhum: ele é a soma dos entries da conta dela, calculada quando alguém pergunta.\n\n**Por que isso já resolve dois dos três defeitos do beat anterior.** Não existe mais uma coluna que duas transações concorrentes disputem, porque ninguém escreve sobre valor existente, então o lost update não tem onde acontecer. E os dois entries entram na mesma transação de banco, então ou os dois existem ou nenhum existe. Sobra o terceiro defeito, a auditoria, e ele é o assunto do próximo beat.',
      pass3: [
        {
          gotcha: 'Ler débito como negativo e crédito como positivo',
          note: 'O sinal do valor depende do tipo da conta na contabilidade, e um crédito num passivo aumenta o passivo. Para esta aula o que importa é que os dois entries de uma transação se cancelam. Vale dizer isso em uma frase e seguir, porque a tabela contábil completa custa dez minutos e não muda nenhuma decisão de design aqui.',
        },
        {
          gotcha: 'Esquecer a conta de contrapartida',
          note: 'Quando dinheiro entra no sistema pela primeira vez, num depósito por cartão, o crédito na conta do usuário precisa de um débito em algum lugar, tipicamente uma conta que representa o gateway ou a própria empresa. Sem essa conta, a transação não soma zero e o sistema passa a criar dinheiro na fronteira.',
        },
        {
          gotcha: 'Guardar saldo e entries sem declarar a fonte de verdade',
          note: 'Materializar o saldo numa coluna para ler rápido é legítimo, e essa coluna é cache derivado. A verdade continua sendo a soma dos entries. Quando os dois divergirem, o cache é reconstruído a partir dos entries, nunca o contrário. Sem essa regra escrita, o modelo volta a ter duas fontes de verdade e o defeito do beat anterior reaparece.',
        },
        {
          gotcha: 'Validar a soma zero apenas na aplicação',
          note: 'Se a regra mora só no código do serviço, qualquer caminho que escreva por fora dele passa por cima: um script de correção, uma migration, um job de importação. Declarada como CHECK constraint no banco, ela vale para todo mundo que escrever ali, inclusive para quem você não previu.',
        },
      ],
      anchor:
        'Esqueça a coluna de saldo. Modele a transferência de R$ 50 da Ana para o Beto como entries num ledger, e não como UPDATEs. Quantas linhas você grava, e quanto elas somam?',
      askWho: [
        {
          name: 'open',
          why: 'Quem já modelou tabela em qualquer projeto consegue propor as duas linhas. A pergunta é de modelagem, não de contabilidade, e não exige repertório financeiro nenhum.',
        },
        {
          name: 'open',
          why: 'Segunda tentativa com quem tiver estudado normalização ou constraint de banco. Essa pessoa costuma perguntar sozinha quem garante a soma zero, que é exatamente onde o beat quer chegar.',
        },
        {
          name: 'open',
          why: 'Se a sala travar, escreva o bloco de código do pass2 no quadro sem a linha da soma e peça para completarem. Chegar em zero por conta própria vale mais que ouvir a regra.',
        },
      ],
      followup:
        'Se o saldo é a soma dos entries e não um número guardado, o que você faz quando descobre que um entry de ontem entrou errado?',
      gotcha:
        'Quando a sala aceitar rápido demais, cobre o custo: "se o saldo é a soma de todos os entries da conta, quanto custa ler o saldo de uma conta com 10 milhões de entries? Isso escala para a Uber?"',
      scenarios: {
        right: {
          shape:
            'Grava duas entries (débito -50 na Ana, crédito +50 no Beto) num mesmo lançamento atômico, soma zero. Sacou que não existe coluna saldo, que o saldo é a soma das entries.',
          redirect:
            'Confirme a invariante: "as pernas somam zero, e a soma global do sistema também. Isso te dá verificação grátis. Agora, e quando essa entry de ontem estava errada?"',
        },
        close: {
          shape:
            'Cria as duas entries mas ainda guarda um saldo em paralelo e dá UPDATE nele, ou esquece que as duas pernas precisam somar zero dentro do mesmo lançamento.',
          redirect:
            'Aponte a duplicidade: "se você tem as entries E uma coluna saldo, qual é a verdade quando discordam? Por que guardar as duas?"',
        },
        wayOff: {
          shape:
            'Volta pro UPDATE de saldo, ou cria só uma linha ("Beto recebeu 50") sem a perna de débito da Ana, quebrando a conservação.',
          redirect:
            'Puxe a contrapartida: "esse +50 do Beto veio de onde? Se você não registra de onde saiu, como o sistema sabe que não imprimiu dinheiro?"',
        },
      },
    },
    {
      id: 'append-only',
      label: 'Append-only: você nunca edita, só adiciona o oposto',
      group: 'ledger',
      beat: 4,
      tags: ['immutability', 'append-only', 'reversal-entry', 'snapshot', 'event-sourcing'],
      visuals: [
        {
          kind: 'ascii',
          title: 'Quatro formas de corrigir, e só uma serve',
          art: `linha errada:  #8902  cobranca de assinatura   -30

  DELETE na linha      -> o erro some, a prova some junto
  UPDATE valor = 0     -> mesma coisa, outro nome
  UPDATE flag=cancel   -> ainda e UPDATE, so disfarcado
  INSERT do oposto     -> unica que nao toca na linha original


como fica no ledger:

  #8877  repasse da corrida 91c7        +62
  #8902  cobranca de assinatura         -30   <- fica aqui pra sempre
  #8903  estorno da transacao #8902     +30   <- a correcao
                                        ---
                              saldo se ajusta pela soma`,
          caption:
            'As três primeiras opções alteram uma linha existente. A quarta adiciona uma linha nova, que é a única operação que um ledger permite.',
          board:
            'Liste as quatro opções e vá riscando as três primeiras junto com a sala, perguntando o que cada uma destrói.',
        },
        {
          kind: 'ascii',
          title: 'Saldo é um fold, e o snapshot é o atalho',
          art: `sem snapshot:  soma tudo, sempre

  [e1][e2][e3][e4] ... [e9.999.998][e9.999.999][e10.000.000]
  \\________________________ 10 milhoes de somas _________/
                                                          v
                                                        saldo


com snapshot:  soma o que veio depois do ultimo

  [e1] ... [e9.999.900]  ->  SNAPSHOT = 4.812,00
                             (gravado ontem a noite)
                                  +
                         [e9.999.901] ... [e10.000.000]
                          \\___ 100 somas ___/
                                  =
                               saldo


o snapshot e cache derivado. divergiu?  reconstroi do log.`,
          caption:
            'O append-only barateia a escrita e encarece a leitura do saldo. O snapshot é onde esse custo é pago de volta, e ele nunca vira fonte de verdade.',
          board:
            'Desenhe a fita de entries e marque o corte do snapshot. A comparação de 10 milhões de somas contra 100 dispensa qualquer explicação.',
        },
      ],
      oneLine:
        'Num ledger, um entry gravado é imutável. A correção de um erro não altera a linha errada, ela adiciona um entry de estorno logo abaixo dela.',
      pass1:
        'Esta é a regra que soa estranha na primeira vez e óbvia na segunda: num ledger, nenhum entry recebe UPDATE ou DELETE, nunca. Uma cobrança de R$ 30 que entrou errada ontem não é editada nem apagada. Você adiciona um entry de estorno, que é o oposto exato, e em seguida o entry correto se houver um. O erro continua visível na tabela, e a correção fica registrada logo abaixo dele. A tabela só cresce. Isso é **append-only**.',
      pass2:
        '**Por que a imutabilidade é o requisito, e não uma preferência.** Cada linha do ledger é a afirmação de um fato datado: neste instante, isto aconteceu. Um fato não é reescrito. Se qualquer linha pudesse ser alterada, a pergunta "qual era o saldo no dia 14 às 15h" deixaria de ter resposta confiável, porque nada garantiria que o passado lido é o passado que ocorreu. A auditoria não depende de o sistema guardar o histórico, depende de o histórico não poder ter sido mexido.\n\n**O que o saldo passa a ser.** O saldo é a soma dos entries da conta até um instante. O saldo de hoje é a soma até hoje, o saldo de terça é a mesma soma parando na terça, e o mesmo log responde as duas perguntas porque nunca descartou nada. O nome desse padrão de percorrer uma sequência acumulando é **fold**.\n\n**Três coisas que se parecem com estorno e não são.** Dar DELETE na linha errada apaga a prova de que o erro existiu. Dar UPDATE no valor para zero é a mesma coisa com outro nome. Marcar a linha com uma flag de cancelada também é um UPDATE, só que disfarçado de metadado, e quebra a imutabilidade do mesmo jeito. O estorno é a única das quatro opções que não toca na linha original.\n\n**O padrão tem nome fora de dinheiro.** Guardar um log imutável de eventos e derivar o estado atual a partir dele é **event sourcing**, e o estorno é o que esse mundo chama de evento compensatório. O ledger é a aplicação desse padrão a dinheiro, escrita cinco séculos antes de o padrão ganhar nome.\n\n**Como a Uber fecha a brecha que sobra.** Append-only por convenção depende de todo mundo respeitar a convenção. No LedgerStore, intervalos antigos do log são selados e ganham verificação por hash, então uma alteração posterior num entry velho quebra a conferência e fica detectável. A garantia deixa de ser disciplina de equipe e passa a ser propriedade verificável.',
      pass3: [
        {
          gotcha: 'Apagar o entry errado para limpar a tabela',
          note: 'O DELETE remove a prova de que o erro existiu e quebra qualquer soma histórica que já tenha sido calculada. O entry errado permanece, e o estorno o neutraliza. A tabela precisa contar a história inteira, inclusive as partes que ninguém quer mostrar.',
        },
        {
          gotcha: 'Recalcular o saldo desde o primeiro entry a cada leitura',
          note: 'Somar 10 milhões de entries a cada consulta de saldo não sustenta produção. A saída é gravar snapshots periódicos e somar apenas o delta desde o último. O snapshot é cache derivado do log: se ele divergir, é ele que é reconstruído.',
        },
        {
          gotcha: 'Confundir transação pendente com entry imutável',
          note: 'Uma transação ainda não postada pode ser cancelada, porque o movimento não aconteceu. Depois de postada, ela é imutável. A imutabilidade vale para o fato consumado, não para o rascunho, e confundir os dois leva a proibir cancelamentos legítimos.',
        },
        {
          gotcha: 'Assumir que append-only é mais lento',
          note: 'É a escrita mais barata que um banco tem: sem lock de linha existente, sem leitura prévia, sem reescrita de página. O custo não desaparece, ele migra para a leitura do saldo, e é lá que o snapshot entra. Toda escolha de modelo move o custo de lugar, e saber para onde ele foi é metade do design.',
        },
      ],
      anchor:
        'Um cliente reclama de uma cobrança de R$ 30 que entrou errada ontem. No seu ledger você não pode dar UPDATE nem DELETE. O que você grava para deixar a conta certa?',
      askWho: [
        {
          name: 'open',
          why: 'A resposta é alcançável por raciocínio puro, sem repertório. Quem entendeu que o saldo é a soma dos entries chega no estorno sozinho, e é isso que o beat quer verificar.',
        },
        {
          name: 'open',
          why: 'Se vier a proposta de marcar a linha com uma flag, aproveite em vez de corrigir. É o erro mais instrutivo do beat, porque é um UPDATE que não parece um UPDATE.',
        },
        {
          name: 'open',
          why: 'Terceira tentativa com quem já tiver usado git. A analogia do revert, que adiciona um commit em vez de reescrever a história, costuma destravar a sala inteira de uma vez.',
        },
      ],
      followup:
        'O log imutável resolveu auditoria e concorrência dentro do sistema. Entre o app do passageiro e o servidor tem uma rede, que perde e reenvia mensagem. Como você impede que um reenvio vire cobrança dupla?',
      gotcha:
        'Quando alguém propuser editar só neste caso, devolva: "abrindo exceção para editar um entry, o que você ainda consegue provar sobre os outros? A auditoria vale para todos ou para nenhum. Compensa?"',
      scenarios: {
        right: {
          shape:
            'Adiciona um lançamento de estorno (oposto exato dos R$ 30) e, se for o caso, o lançamento correto depois. Deixa o erro original na tabela. Sacou que o saldo se ajusta pela soma, sem tocar no passado.',
          redirect:
            'Confirme e puxe o custo: "perfeito, a tabela só cresce. Mas se saldo é a soma de tudo, ler vira caro. Como a Uber lê saldo rápido sem somar 10 milhões de linhas?" (snapshot).',
        },
        close: {
          shape:
            'Entende que não pode editar, mas tenta "marcar a entry como cancelada" com uma flag (que é um UPDATE disfarçado), ou esquece de registrar o lançamento certo depois do estorno.',
          redirect:
            'Aponte o UPDATE escondido: "marcar com flag é dar UPDATE na linha. Quebrou a imutabilidade. Como você neutraliza os 30 sem TOCAR na linha original?"',
        },
        wayOff: {
          shape:
            'Quer dar DELETE na cobrança errada, ou UPDATE no valor pra 0, argumentando que "é mais limpo".',
          redirect:
            'Use a auditoria: "o regulador pergunta por que essa conta mudou no dia 14. Se você deletou, qual a sua resposta? O erro precisa ficar visível, com a correção do lado."',
        },
      },
    },
    {
      id: 'idempotency',
      label: 'Idempotência: a rede vai te trair',
      group: 'ledger',
      beat: 5,
      teachFromZero: true,
      tags: ['idempotency-key', 'retry', 'dedup', 'at-least-once', 'exactly-once'],
      visuals: [
        {
          kind: 'ascii',
          title: 'A resposta que se perde, e o reenvio',
          art: `APP                                        SERVIDOR
 |                                             |
 |-- pagar 30, key=a1b2 --------------------->|
 |                                             | grava a transacao  OK
 |         X  resposta se perde na volta  <----|
 |                                             |
 | (nao sei se processou ou se so a resposta   |
 |  sumiu. se eu nao reenviar, posso ter       |
 |  perdido o pagamento)                       |
 |                                             |
 |-- pagar 30, key=a1b2 --------------------->|
 |                        MESMA key            | key ja existe:
 |                                             | nao grava nada
 |<-- devolve o resultado da 1a tentativa -----|
 |                                             |
 cobrado: R$ 30                        entries gravados: 1`,
          caption:
            'O cliente não tem como distinguir "não processou" de "processou e a resposta sumiu". Por isso ele reenvia, e por isso o problema tem que ser resolvido no servidor.',
          board:
            'Desenhe as duas colunas e o X na seta de volta. Pergunte à sala o que o app deveria fazer ali, e deixe alguém dizer "tentar de novo".',
        },
        {
          kind: 'ascii',
          title: 'A janela entre checar e gravar',
          art: `ERRADO: duas operacoes

  R1: SELECT key? -> nao existe
  R2: SELECT key? -> nao existe        <- janela aberta aqui
  R1: INSERT                  OK
  R2: INSERT                  OK       <- cobrou duas vezes


CERTO: uma operacao so

  R1: INSERT ... ON CONFLICT (key) DO NOTHING   -> gravou
  R2: INSERT ... ON CONFLICT (key) DO NOTHING   -> nao gravou

  a checagem acontece DENTRO da escrita.
  nao existe intervalo entre uma coisa e outra.`,
          caption:
            'É o mesmo lost update do beat 2, agora na tabela de chaves. A constraint UNIQUE não é otimização, é o que fecha a janela.',
          board:
            'Escreva o bloco ERRADO e pergunte onde está o furo. Quem acertou o beat 2 reconhece o padrão na hora.',
        },
      ],
      oneLine:
        'O app manda pagar R$ 30, a rede cai antes da resposta voltar, o app tenta de novo. Sem uma idempotency key, o passageiro paga duas vezes.',
      pass1:
        'Double-entry e append-only resolvem o que acontece dentro do sistema. Entre o celular do passageiro e o servidor existe uma rede, e rede perde mensagem, entrega em duplicidade e atrasa. O cenário é sempre o mesmo: o app manda pagar R$ 30, o servidor processa e grava a transação, e a resposta se perde na volta. O app não recebeu confirmação e não tem como saber se o servidor processou ou se só a resposta sumiu, então ele reenvia. Agora chegaram duas requisições idênticas, e gravar as duas cobra R$ 60. **Idempotência** é a propriedade de uma operação que pode ser repetida sem mudar o resultado.',
      pass2:
        '**A ferramenta.** O cliente gera um identificador único para aquela operação, tipicamente um UUID, e envia junto na requisição. Toda tentativa seguinte reenvia a mesma chave, porque a intenção de quem apertou o botão não mudou. Essa chave é a **idempotency key**.\n\n**O mecanismo, passo a passo.**\n\n1. O cliente gera a chave antes do primeiro envio e a guarda enquanto a operação não fecha.\n2. A requisição chega ao servidor trazendo a chave.\n3. O servidor tenta gravar a transação e a chave na mesma operação atômica.\n4. Se a chave é nova, a gravação acontece e o resultado é guardado junto dela.\n5. Se a chave já existe, nada é gravado e o servidor devolve o resultado da primeira tentativa.\n6. A décima tentativa cai no passo 5 igual à segunda, então o número de reenvios deixa de importar.\n\n**O detalhe que faz o mecanismo funcionar ou falhar.** A checagem e a gravação precisam ser a mesma operação. Fazer um SELECT para ver se a chave existe e depois um INSERT abre exatamente a mesma janela do beat 2: as duas tentativas consultam antes de qualquer uma gravar, as duas veem que não existe, e as duas gravam. A saída é declarar a chave como constraint UNIQUE e deixar o banco recusar a segunda escrita, porque aí a checagem acontece dentro da própria escrita e não existe intervalo entre as duas.\n\n**O que "exactly-once" quer dizer de verdade.** A rede entrega **at-least-once**: o cliente reenvia até ter certeza, então a mensagem chega uma ou mais vezes. O servidor faz **dedup** pela chave, descartando as repetições. A soma das duas coisas é o que o usuário percebe como exactly-once. Ninguém entrega exactly-once no transporte, e prometer isso numa entrevista costuma render a pergunta seguinte. O que se entrega é: reenvie quantas vezes quiser, o efeito conta uma vez só.',
      pass3: [
        {
          gotcha: 'Gerar a chave no servidor',
          note: 'Se o servidor gera, cada tentativa do cliente chega com chave diferente e é tratada como pagamento novo. A chave representa a intenção de quem apertou o botão, e essa intenção nasce no cliente. Gerar no servidor não é uma variação da técnica, é a técnica sem o que a faz funcionar.',
        },
        {
          gotcha: 'Checar e depois gravar em duas operações',
          note: 'É o lost update do beat 2 aparecendo de novo, agora na tabela de chaves. Use UNIQUE na coluna e trate a violação como "já processei", ou `INSERT ... ON CONFLICT DO NOTHING`. A escrita precisa ser a checagem.',
        },
        {
          gotcha: 'Confundir idempotência com retry',
          note: 'Reenviar sem chave não é idempotência, é duplicação garantida com mais passos. O que torna o reenvio seguro é a chave estável somada ao dedup no servidor. O retry sozinho é o problema, não a solução.',
        },
        {
          gotcha: 'Reaproveitar a chave entre operações diferentes',
          note: 'Se dois pagamentos distintos usam a mesma chave, o segundo é descartado como repetição e o dinheiro legítimo não entra. A chave é por operação, e costuma ter janela de expiração para a tabela não crescer para sempre. O erro é silencioso, porque do lado do servidor ele parece dedup funcionando.',
        },
      ],
      anchor:
        'O app do passageiro manda pagar R$ 30. A rede cai antes da resposta voltar. O app reenvia automaticamente. Como o servidor garante que essa cobrança acontece uma vez só?',
      askWho: [
        {
          name: 'open',
          why: 'Esta é a melhor pergunta da aula para floor aberto. A resposta se alcança por raciocínio, e quem propuser qualquer forma de identificador estável acertou o núcleo mesmo sem conhecer o termo.',
        },
        {
          name: 'open',
          why: 'Se aparecer alguém que já integrou API de pagamento, Stripe ou Mercado Pago, puxe essa pessoa. As duas mandam um header de idempotency key, e ela provavelmente já usou sem saber o nome.',
        },
        {
          name: 'open',
          why: 'Terceira tentativa focando quem respondeu bem o beat 2. A janela entre checar e gravar é literalmente o mesmo defeito, e reconhecer isso vale mais do que chegar na chave.',
        },
      ],
      followup:
        'As quatro peças estão na mesa: inteiro de centavos, double-entry, append-only e idempotency key. Como elas se organizam na arquitetura de um pagamento real da Uber?',
      gotcha:
        'Quando alguém disser "é só o cliente não reenviar", devolva: "o cliente não sabe se você processou, porque foi a resposta que se perdeu. Se ele não reenviar, o pagamento pode simplesmente não ter acontecido. O problema é seu, no servidor."',
      scenarios: {
        right: {
          shape:
            'Propõe uma chave de idempotência gerada pelo cliente, mandada em todo retry, e dedup no servidor. Bônus se aponta que a checagem precisa ser atômica (UNIQUE constraint) pra não ter corrida na própria chave.',
          redirect:
            'Confirme e feche o conceito: "exatamente, at-least-once do cliente + dedup pela chave = exactly-once na prática. Agora junta tudo: desenha o caminho do pagamento na Uber, ponta a ponta."',
        },
        close: {
          shape:
            'Chega na ideia de "detectar duplicata" mas quer gerar a chave no servidor, ou faz SELECT antes do INSERT sem perceber a corrida entre os dois.',
          redirect:
            'Cutuque os dois furos: "quem gera a chave, cliente ou servidor? E se dois retries checam ao mesmo tempo e os dois veem que não existe?"',
        },
        wayOff: {
          shape:
            'Resolve com "timeout maior" ou "o cliente espera mais antes de reenviar", que não impede a duplicata, só a torna mais rara.',
          redirect:
            'Mostre que não fecha: "timeout maior diminui a chance, não zera. No dia que a resposta se perder mesmo assim, você cobra dobrado. Como você torna IMPOSSÍVEL, não raro?"',
        },
      },
    },
    // ──────────────── ARQUITETURA (mandatory) ────────────────
    {
      id: 'arquitetura',
      label: 'Arquitetura: o fluxo completo na Uber',
      group: 'ledger',
      beat: 6,
      tags: ['write-path', 'read-path', 'materialized-view', 'two-phase-commit', 'hot-cold-tiering'],
      visuals: [
        {
          kind: 'ascii',
          title: 'Write path e read path, lado a lado',
          art: `WRITE PATH                      READ PATH
(fim da corrida)                (motorista abre o app)

  requisicao + idempotency key      abre o app e ve o historico
            |                                 |
            v                                 v
  1. essa key ja veio antes?      le de uma COPIA do dado,
     |                            preparada pra leitura e
     nao                          atualizada em 2o plano
     |                            (materialized view)
     v                                        |
  2. monta a transacao                        v
     debito + credito = 0          saldo = snapshot + delta
     |                                        |
     v                                        v
  3. grava append-only                     resposta
     |
     v
  4. confirma de um jeito que a
     proxima leitura enxergue
     (two-phase commit)
     so a cobranca do cartao
     precisa disso
     |
     v
   confirmado

precisa estar certo AGORA       pode chegar atrasado
= strongly consistent           = eventually consistent`,
          caption:
            'Os dois caminhos leem e escrevem o mesmo log. O que muda é a garantia que cada um precisa, e é a garantia que define o custo.',
          board:
            'Faça as duas colunas e peça para a sala preencher a da direita depois que você fizer a da esquerda. A assimetria aparece sozinha.',
        },
        {
          kind: 'ascii',
          title: 'Um log, três índices e dois níveis de armazenamento',
          art: `                    LEDGER append-only
                   (a unica fonte de verdade)
                            |
        +-------------------+-------------------+
        |                   |                   |
  precisa estar       pode chegar          consulta por
  certo AGORA         atrasado             faixa de tempo
  = strongly          = eventually         (quebra o log
    consistent          consistent          por data)
        |                   |                   |
        v                   v                   v
  cobranca do         app do motorista     auditor pede
  cartao              historico e saldo    "marco inteiro"


armazenamento por idade do dado (hot/cold tiering):

  menos de 3 meses  ---> armazenamento rapido e caro
  mais de 1 ano     ---> armazenamento lento e barato
                         mesmo log, preco por idade`,
          caption:
            'Os três índices são derivados do log e podem ser reconstruídos a partir dele. Se um índice corrompe, ele é refeito, e o ledger não é tocado.',
          board:
            'Desenhe o log em cima e as três setas descendo. Para cada seta, pergunte qual pergunta ela responde antes de escrever o nome.',
        },
      ],
      oneLine:
        'Passageiro encerra a corrida e o dinheiro atravessa todas as camadas até virar entry imutável. O caminho de escrita e o de leitura são propositalmente diferentes.',
      pass1:
        'Hora de juntar as quatro peças num desenho. O passageiro encerra a corrida e, a partir dali, o dinheiro atravessa uma sequência de camadas até virar um par de entries imutáveis e depois aparecer como saldo para o motorista. A decisão que organiza todo o resto é separar o **write path**, que grava o pagamento e precisa ser exato e durável, do **read path**, que mostra histórico e saldo e tolera atraso. Os dois têm requisitos opostos, então recebem soluções diferentes. O sistema que faz isso na Uber é o LedgerStore, com mais de 2 trilhões de índices únicos sobre um log imutável.',
      pass2:
        'Este beat introduz três termos e nenhum deles pode ser dito antes de a ideia estar de pé. A ordem é sempre a mesma: primeiro o problema em português, depois o nome em inglês colado nele.\n\n**Ideia 1: escrever e ler pedem coisas diferentes.** No começo da corrida o Payment Service salva um **hold** no ledger, que é a reserva no cartão. No fim da corrida ele procura esse hold para cobrar de verdade. Se a busca não achar, o fluxo cria uma cobrança nova e o passageiro paga duas vezes. Então essa leitura precisa enxergar, na hora, o que a escrita acabou de gravar. Do outro lado, o motorista abrindo o app para ver o histórico pode esperar alguns segundos sem que nada quebre. Mesma base de dados, duas exigências opostas.\n\n**Ideia 2: o que precisa estar certo agora é caro.** Uma leitura que enxerga na hora o que acabou de ser escrito é o tipo caro de garantia, e o nome disso é **strongly consistent**. Vale dizer o nome só depois da sala ter entendido o caso do hold.\n\n**Ideia 3: o que pode atrasar fica barato copiando.** O histórico não sai do mesmo lugar onde a escrita acontece. Ele sai de uma cópia do dado, preparada para leitura e atualizada em segundo plano, fora do caminho da escrita. Essa cópia tem nome, **materialized view**, e a garantia dela é que o dado sempre chega, só nem sempre na mesma hora. Isso é **eventually consistent**.\n\n**O falso cognato, e vale gastar trinta segundos nele.** "Eventually" em inglês quer dizer que chega. "Eventualmente" em português quer dizer de vez em quando. É o oposto, e é erro comum de quem traduz o termo em entrevista.\n\n**Como se garante o strongly consistent.** A figura 2 do post da Uber mostra: grava primeiro a intenção (vou gravar isso), depois o registro, e só então confirma a intenção. Se a intenção falhar, a operação inteira falha. Se alguém ler no meio e achar uma intenção não confirmada, vai ao registro decidir: existe, confirma; não existe, desfaz. Esse jeito de gravar em duas fases tem nome, **two-phase commit**, e é ele que torna esse caminho o mais caro do sistema.\n\n**Guardar tudo no rápido é caro demais.** Consulta por faixa de tempo (`WHERE LedgerTime BETWEEN t1 AND t2`) é o que permite decidir o que sai do armazenamento caro. Na Uber o corte é concreto: menos de 3 meses fica no rápido, mais de 1 ano vai para o barato. Guardar o dado novo no caro e o velho no barato tem nome, **hot/cold tiering**.\n\n**A escala.** Mais de 2 trilhões de índices únicos, seis meses em produção sem uma inconsistência detectada, e cerca de US$ 6 milhões por ano economizados com a saída do DynamoDB.\n\n**O que esse desenho não faz.** Não elimina o custo de ler saldo, só o empurra para o snapshot. Não dispensa a idempotency key na borda, porque nenhuma camada de baixo distingue reenvio de pagamento novo. E não sobrevive a alguém escrever no banco por fora do serviço, que é exatamente por que a soma zero precisa estar declarada lá dentro.',
      pass3: [
        {
          gotcha: 'Usar consistência forte no caminho inteiro',
          note: 'Só a cobrança do cartão precisa enxergar na hora o que acabou de ser gravado. Estender essa garantia à leitura de histórico paga latência e custo onde nada exigia.',
        },
        {
          gotcha: 'Somar o saldo desde o início no read path',
          note: 'Snapshot mais delta, sempre. Sem isso, mostrar saldo vira a query mais cara do sistema justamente na tela mais aberta.',
        },
        {
          gotcha: 'Tratar o índice como fonte de verdade',
          note: 'Os índices são derivados do log. Um índice corrompido é reconstruído a partir dos entries, e nunca o contrário.',
        },
        {
          gotcha: 'Guardar tudo no armazenamento quente',
          note: 'Dado de dois anos atrás não precisa da mesma latência do dado de hoje. O hot/cold tiering é o que segura a conta em escala de petabyte.',
        },
      ],
      anchor:
        'A corrida acabou e o motorista abre o app para ver quanto entrou. Desenhe cada camada que o dado atravessa, e separe explicitamente o write path do read path.',
      askWho: [
        {
          name: 'open',
          why: 'Beat de integração, então quem falou mais nos beats anteriores tem vantagem real aqui. Chame quem acertou o beat 3 ou o 4, porque o desenho é a junção dos dois.',
        },
        {
          name: 'open',
          why: 'Segunda tentativa com quem já tiver visto cache ou réplica de leitura em algum projeto. A intuição de que leitura e escrita pedem coisas diferentes normalmente vem daí.',
        },
        {
          name: 'open',
          why: 'Se ninguém arriscar o desenho completo, quebre em duas perguntas: primeiro só o write path, depois só o read path. O beat funciona igual e a sala participa mais.',
        },
      ],
      followup:
        'Diagrama no quadro. Para cada caixa desse desenho, qual serviço gerenciado da AWS entra, e qual característica da carga justifica a escolha?',
      gotcha:
        'Quando o desenho misturar leitura e escrita numa coisa só, devolva: "a autorização de cartão precisa ler na hora o que acabou de gravar. O histórico do motorista não precisa. Por que dar a mesma garantia, e pagar o mesmo preço, nos dois?"',
      scenarios: {
        right: {
          shape:
            'Desenha write path (idempotência → lançamento double-entry → append-only com índice forte pra auth) separado do read path (materialized view eventual pra histórico, snapshot+delta pro saldo) e menciona tiering quente/frio.',
          redirect:
            'Confirme a separação e empurre pra nuvem: "ótimo, dois caminhos com garantias diferentes. Agora mapeia cada caixa pra um serviço gerenciado da AWS."',
        },
        close: {
          shape:
            'Desenha o write path certo mas trata a leitura igual à escrita (consistência forte em tudo), ou esquece o snapshot e soma o saldo do zero.',
          redirect:
            'Aponte o exagero: "o motorista olhando o histórico precisa do último milissegundo? Se não, por que pagar two-phase commit nessa leitura? E somar 10 milhões de entries por GET, escala?"',
        },
        wayOff: {
          shape:
            'Volta pra "API → banco com coluna saldo", perdendo tudo que foi construído, ou desenha um monolito sem separar leitura de escrita.',
          redirect:
            'Resgate as peças: "cadê o append-only? Cadê a idempotência na entrada? Refaz começando pela requisição que chega COM a chave de idempotência. O que acontece primeiro?"',
        },
      },
    },
    // ──────────────── AWS (mandatory) ────────────────
    {
      id: 'aws',
      label: 'AWS: cada caixa, um managed service',
      group: 'cloud',
      beat: 7,
      tags: ['dynamodb', 'qldb', 'aurora', 's3-glacier', 'kinesis'],
      visuals: [
        {
          kind: 'ascii',
          title: 'Cada caixa, o perfil de carga e o serviço',
          art: `caixa do desenho      perfil de carga        servico
--------------------  ---------------------  ----------------
ledger append-only    escrita quente,        DynamoDB
                      idempotente, volume    (conditional
                      altissimo              write = UNIQUE)

invariante soma zero  transacao ACID,        Aurora
                      regra no banco         PostgreSQL
                                             (CHECK constraint)

stream de eventos     alimenta as            Kinesis / MSK
                      materialized views

arquivo de            lido quase nunca,      S3 + Glacier
compliance            nao pode sumir         (= TerraBlob)


a caixa dita o servico. a sua familiaridade nao entra na conta.`,
          caption:
            'A pergunta parece ser sobre conhecer o catálogo da AWS. Quem escolhe três serviços e justifica cada um pela carga vai melhor do que quem lista seis.',
          board:
            'Faça a tabela com as duas primeiras colunas preenchidas e a terceira vazia. A sala preenche a terceira, e você só valida.',
        },
        {
          kind: 'ascii',
          title: 'A curva de custo que fez a Uber sair do DynamoDB',
          art: `custo
  ^
  |                                    in-house
  |                              . - '
  |                        . - '
  |                  . - '     gerenciado
  |            . - '     _ - ~
  |      . - '   _ - ~
  |  _ -~ - ~
  | ~
  +--------------|--------------------------> volume
                 ^
          onde as curvas se cruzam

abaixo do cruzamento: gerenciado ganha quase sempre
acima:                a Uber saiu e economizou ~US$ 6 mi/ano

o QLDB era o servico feito pra ledger. descontinuado em 2024.
o produto morreu, o padrao continua rodando sobre Aurora.`,
          caption:
            'Gerenciado não é caro nem barato em abstrato. Existe uma fronteira de escala em que a conta inverte, e saber que ela existe vale mais que ter preferência.',
          board:
            'Duas curvas e um ponto de cruzamento. Pergunte de que lado do cruzamento está o projeto que a pessoa faz hoje.',
        },
      ],
      oneLine:
        'Pra cada caixa do ledger existe um serviço gerenciado da AWS, e a escolha é ditada pelo perfil de carga da caixa, não pela sua familiaridade.',
      pass1:
        'Com o diagrama no quadro, a pergunta muda: se isso subisse na AWS amanhã, qual serviço gerenciado entra em cada caixa? A regra é a mesma que guiou a aula inteira, o perfil de carga da caixa decide. Escrita append-only de volume altíssimo pede uma coisa, leitura de histórico tolerante a atraso pede outra, e arquivo de compliance lido uma vez por trimestre pede uma terceira. Mapear caixa a serviço é o passo que transforma um desenho num sistema que alguém consegue construir.',
      pass2:
        '**O ledger append-only: escrita quente, idempotente, throughput alto.** O candidato natural é o **DynamoDB**, com escrita rápida, escala horizontal e um recurso que encaixa exatamente aqui: o conditional write grava só se a chave ainda não existir, cumprindo o papel da constraint UNIQUE sobre a idempotency key. Foi onde a Uber começou o LedgerStore em 2017.\n\nO desdobramento é a parte que ensina. A Uber depois saiu do DynamoDB e construiu o store próprio, porque na escala de trilhão de entries o custo gerenciado passou a ser maior que o custo de manter em casa. A migração economizou cerca de US$ 6 milhões por ano. A conclusão não é que gerenciado é caro: é que existe uma fronteira de escala em que a conta inverte, e conhecer essa fronteira vale mais do que ter preferência por um dos lados.\n\n**O serviço que foi feito exatamente para isso, e morreu.** A AWS teve o **QLDB**, Quantum Ledger Database: append-only por construção, imutável, com verificação criptográfica embutida. Era a resposta pronta para esta aula. A AWS anunciou a descontinuação em 2024, e a orientação passou a ser implementar o padrão ledger sobre Aurora PostgreSQL. Quem tinha aprendido o padrão trocou o banco embaixo e seguiu. Quem tinha aprendido o produto começou de novo.\n\n**A invariante garantida pelo banco: Aurora PostgreSQL.** Uma transação ACID grava os dois entries ou nenhum. Uma CHECK constraint recusa qualquer transação cujos entries não somem zero. E SQL resolve a materialização dos saldos. É a escolha quando você quer que a regra mais importante do sistema não dependa do código da aplicação estar correto.\n\n**Stream de eventos: Kinesis ou MSK.** Eles carregam o fluxo de entries até os consumidores que constroem as materialized views do read path. **Arquivo frio: S3 com Glacier**, equivalente direto do TerraBlob da Uber, a centavos por GB por mês para dado que quase nunca é lido e não pode sumir.\n\n**A armadilha da pergunta.** Ela parece ser sobre conhecer o catálogo da AWS, e não é. Um candidato que lista seis serviços sem justificar perde para um que escolhe três e explica qual característica da carga levou a cada um.',
      pass3: [
        {
          gotcha: 'Escolher o serviço pela familiaridade',
          note: 'Colocar tudo no RDS porque a pessoa sabe SQL ignora que append-only de volume alto tem perfil diferente de leitura relacional. A caixa dita o serviço.',
        },
        {
          gotcha: 'Assumir que gerenciado é sempre mais barato',
          note: 'Gerenciado ganha no começo e no meio. Em escala extrema a conta inverte, e a saída da Uber do DynamoDB é o exemplo.',
        },
        {
          gotcha: 'Citar QLDB como solução atual',
          note: 'Foi descontinuado em 2024. A resposta forte é dizer que era o serviço purpose-built, que a AWS aposentou, e que hoje o padrão roda sobre Aurora.',
        },
        {
          gotcha: 'Deixar a soma zero só na aplicação',
          note: 'Uma CHECK constraint no banco vale também para migration, script de correção e job de importação. O código do serviço não alcança esses caminhos.',
        },
      ],
      anchor:
        'Com o diagrama do beat anterior no quadro: para cada caixa, ledger append-only, leitura de histórico, arquivo de compliance e stream de eventos, qual serviço da AWS você escolhe e qual característica da carga justifica?',
      askWho: [
        {
          name: 'open',
          why: 'Chame quem tiver certificação AWS ou experiência de estágio em cloud, se houver alguém. Esse é o único beat da aula em que conhecer catálogo dá vantagem legítima.',
        },
        {
          name: 'open',
          why: 'Se ninguém tiver AWS, a pergunta funciona igual sem nome de serviço. Peça a característica da carga de cada caixa e forneça você o nome do serviço que casa.',
        },
        {
          name: 'open',
          why: 'Terceira tentativa provocando com uma escolha errada de propósito: proponha colocar tudo no mesmo banco e peça para a sala derrubar a ideia.',
        },
      ],
      followup:
        'Olhando o sistema inteiro: o que mudou em relação ao modelo de coluna de saldo do começo da aula, e qual foi a decisão que destravou todo o resto?',
      gotcha:
        'Quando alguém colocar tudo no RDS, devolva: "5 bilhões de escritas por dia no mesmo Postgres que serve as consultas de histórico do app. Qual dos dois degrada primeiro, e o que acontece com o outro quando isso ocorre?"',
      scenarios: {
        right: {
          shape:
            'Mapeia DynamoDB (ou store dedicado) pro append quente idempotente, Aurora pra invariante relacional, S3/Glacier pro frio, Kinesis/MSK pro stream. Justifica cada um pelo perfil de carga. Bônus se cita o QLDB descontinuado e o tradeoff managed vs in-house.',
          redirect:
            'Feche o arco: "cada caixa pelo perfil, não pela familiaridade. Agora a pergunta de síntese: o que destravou TUDO isso lá no começo?" (foi proibir o UPDATE).',
        },
        close: {
          shape:
            'Escolhe serviços razoáveis mas justifica por familiaridade ("uso Postgres") em vez de perfil de carga, ou esquece o tier frio e bota histórico de anos no store quente.',
          redirect:
            'Puxe pro perfil: "por que append-only de 5 bilhões/dia tem o MESMO serviço que a query de compliance que roda 1x por mês? Separa pela carga."',
        },
        wayOff: {
          shape:
            'Joga tudo num RDS único, ou propõe QLDB como solução atual sem saber que foi aposentado, ou escolhe serviços sem relacionar com nada do que foi construído.',
          redirect:
            'Reancore no perfil: "esquece o nome do serviço por um segundo. Essa caixa faz o quê, escreve muito e barato ou lê pouco e forte? Agora escolhe o serviço que casa com ISSO."',
        },
      },
    },
    // ──────────────── SYNTHESIS (study-only) ────────────────
    {
      id: 'synthesis',
      label: 'Dinheiro é um log, não um número',
      group: 'synthesis',
      oneLine:
        'A virada da aula inteira cabe numa frase: o saldo não é um dado que você guarda, é a soma de um log que você nunca apaga.',
      pass1:
        'A aula abriu numa curiosidade de console e fechou no LedgerStore da Uber. O que liga as duas pontas é uma troca só: parar de tratar dinheiro como um número que se atualiza e passar a tratá-lo como um log que só cresce. Quase toda dificuldade de sistema financeiro se dissolve depois dessa troca, e o que não se dissolve muda de lugar de forma previsível.',
      pass2:
        '**A escada, degrau por degrau.** Float não serve porque o erro acumula, então o valor vira inteiro de centavos. Um número exato numa coluna ainda quebra em concorrência, durabilidade e auditoria, porque o UPDATE apaga ao escrever. Double-entry resolve os dois primeiros, porque ninguém escreve sobre valor existente e as duas pontas entram juntas. Append-only resolve o terceiro, porque o passado deixa de ser alterável. E aí o saldo deixa de ser dado e vira cálculo.\n\n**Três coisas que ficaram fáceis.** A auditoria sai de graça, porque o passado inteiro continua lá. A correção vira um entry de estorno, e nunca uma edição. E a invariante de soma zero se verifica sozinha sobre o banco inteiro, denunciando bug sem ninguém precisar procurar a transação culpada.\n\n**O custo não sumiu, mudou de lugar.** Ler saldo ficou caro, porque somar um log grande é caro, e a saída é snapshot mais delta. A rede passou a ameaçar duplicar escrita, e a saída é idempotency key mais dedup. Reconhecer para onde o custo foi é o que separa quem entendeu o modelo de quem decorou o nome dele.\n\n**Onde isso vale fora de dinheiro.** O padrão se chama event sourcing: estado atual como soma de um log imutável de eventos. Ele serve para carrinho de compras, histórico de pedido, versionamento de documento e qualquer domínio em que como se chegou aqui importa tanto quanto onde se está. O double-entry é a versão que a contabilidade escreveu cinco séculos antes de a computação existir.',
      pass3: [
        {
          gotcha: 'Sair com apenas "não use float para dinheiro"',
          note: 'Essa é a primeira frase da aula, não a conclusão. O miolo é que o saldo é derivado de um log imutável.',
        },
        {
          gotcha: 'Achar que append-only é coisa de dinheiro',
          note: 'É event sourcing. Dinheiro é o caso mais antigo e mais rígido, e não o único.',
        },
        {
          gotcha: 'Esquecer que o custo migra',
          note: 'Append-only barateia escrita e auditoria e encarece a leitura do saldo. Toda escolha de modelo move o custo, e saber para onde é metade do design.',
        },
      ],
      visuals: [
        {
          kind: 'ascii',
          title: 'A escada inteira numa figura',
          art: `float                     erro acumula
  |
  v
inteiro de centavos       valor exato
  |                       ...mas UPDATE ainda apaga
  v
double-entry              dois entries, soma zero
  |                       resolve concorrencia e durabilidade
  v
append-only               nada e editado
  |                       resolve auditoria
  v
saldo = soma do log       estado virou calculo


o que essa escada cobrou:

  leitura de saldo ficou cara  ->  snapshot + delta
  rede duplica escrita         ->  idempotency key + dedup`,
          caption:
            'Cada degrau existe porque o anterior quebrou em algum ponto específico. É essa cadeia, e não a lista de conceitos, que uma entrevista quer ouvir.',
          board:
            'Esta é a última coisa a ficar no quadro. Construa de cima para baixo perguntando, a cada degrau, o que ainda estava quebrado.',
        },
      ],
      anchor:
        'Em uma frase, sem usar a palavra "número": o que é o saldo de uma conta num ledger?',
      followup:
        'Onde, fora de dinheiro, você usaria esse mesmo padrão de "estado é a soma de um log imutável"?',
      gotcha:
        'Se a síntese da sala for "não usa float", devolva: "isso é o minuto 1 da aula. O que a gente passou os outros 55 construindo?"',
    },
  ],

  glossary: [
    {
      title: 'Como o número é guardado',
      terms: [
        { term: 'float', definition: 'Número com vírgula guardado em base 2, no padrão IEEE 754. Todo processador faz igual, então trocar de linguagem não resolve nada.' },
        { term: 'IEEE 754', definition: 'O padrão que define esse formato. É ele que faz 0.1 + 0.2 devolver 0.30000000000000004 em qualquer lugar.' },
        { term: 'dízima binária', definition: 'Em base 2, o número 0.1 não termina nunca. O computador corta a dízima e guarda o valor mais próximo que consegue, que não é 0.1.' },
        { term: 'inteiro de centavos', definition: 'Guardar R$ 19,90 como o inteiro 1990. Soma de inteiro é exata, e a vírgula entra só na hora de exibir.' },
        { term: 'DECIMAL', definition: 'Tipo de base 10 com precisão arbitrária. DECIMAL no Postgres, BigDecimal no Java. A saída quando você precisa de fração menor que o centavo.' },
        { term: 'BIGINT', definition: 'Inteiro de 64 bits. É o tipo da coluna quando você escolhe guardar centavos, e aguenta valor muito além de qualquer saldo real.' },
      ],
    },
    {
      title: 'Quando o modelo ingênuo quebra',
      terms: [
        { term: 'lost update', definition: 'Duas transações leem o mesmo valor e a segunda escrita passa por cima da primeira. O dinheiro que a primeira tirou volta a existir.' },
        { term: 'race condition', definition: 'O resultado depende de quem chegou primeiro. Aqui ele aparece como R$ 50 saindo do nada.' },
        { term: 'atomicidade', definition: 'O débito e o crédito acontecem juntos ou nenhum dos dois acontece. É o A de ACID.' },
        { term: 'durabilidade', definition: 'O que foi confirmado sobrevive à queda do servidor. É o D de ACID.' },
        { term: 'ACID', definition: 'As quatro garantias de uma transação de banco: atomicidade, consistência, isolamento e durabilidade.' },
        { term: 'audit trail', definition: 'O rastro que permite responder o que aconteceu e quando. Um UPDATE apaga esse rastro, porque sobrescreve o valor anterior.' },
      ],
    },
    {
      title: 'O ledger',
      terms: [
        { term: 'ledger', definition: 'O livro onde cada movimento vira uma linha nova. Nada é editado, e o saldo sai da soma das linhas.' },
        { term: 'double-entry', definition: 'Todo movimento grava dois lados, um que sai e um que entra. Foi escrito em 1494 e continua sendo o modelo.' },
        { term: 'entry', definition: 'Uma linha do ledger: conta, valor e sinal. É a unidade que o sistema realmente grava.' },
        { term: 'transação', definition: 'O grupo de entries que representa um movimento. A transferência da Ana para o Beto é uma transação com dois entries.' },
        { term: 'débito e crédito', definition: 'Os dois lados de uma transação. Os nomes vêm da contabilidade e não do sentido do dinheiro na sua conta.' },
        { term: 'soma zero', definition: 'Os entries de uma transação somam zero, e a soma de todos os entries do sistema também. Quando não dá zero, existe bug.' },
        { term: 'saldo derivado', definition: 'O saldo não é uma coluna, é a soma dos entries. Como ninguém escreve nele, duas transações não têm o que disputar.' },
        { term: 'estorno', definition: 'O entry oposto que corrige um erro. O erro continua no ledger, e a correção fica registrada logo abaixo dele.' },
      ],
    },
    {
      title: 'Append-only',
      terms: [
        { term: 'append-only', definition: 'Você só adiciona linhas, nunca edita nem apaga. É a escrita mais barata do banco e a única que preserva o passado.' },
        { term: 'event sourcing', definition: 'Guardar o log de eventos e derivar o estado a partir dele. O ledger é a versão disso para dinheiro.' },
        { term: 'fold', definition: 'Percorrer o log somando até chegar no estado. O saldo de terça é o mesmo fold, parando na terça.' },
        { term: 'snapshot', definition: 'O saldo salvo num instante, para a leitura não somar 10 milhões de entries. O saldo atual é o snapshot mais o que entrou depois dele.' },
        { term: 'selagem por hash', definition: 'Fechar um intervalo antigo do log e guardar o hash dele. Se alguém alterar um entry velho, a conta do hash não fecha mais.' },
        { term: 'imutabilidade', definition: 'A linha gravada não muda mais. É o que transforma o log numa prova, e não só num registro.' },
      ],
    },
    {
      title: 'Idempotência',
      terms: [
        { term: 'idempotência', definition: 'A propriedade de uma operação que pode ser repetida sem mudar o resultado. Apertar pagar duas vezes cobra uma vez só.' },
        { term: 'idempotency key', definition: 'A chave que o cliente gera e repete em toda tentativa. Ela representa a intenção, e a intenção não mudou entre um retry e outro.' },
        { term: 'retry', definition: 'Reenviar a requisição quando a resposta não chegou. O cliente não sabe se o servidor processou ou se só a resposta se perdeu.' },
        { term: 'at-least-once', definition: 'A garantia de que a mensagem chega, podendo chegar mais de uma vez. É o que a rede te entrega de fato.' },
        { term: 'exactly-once', definition: 'A garantia de que ela chega uma vez só. Não existe na rede: você constrói com at-least-once mais dedup.' },
        { term: 'dedup', definition: 'Descartar a repetição. Aqui, reconhecendo a idempotency key que já foi vista antes.' },
        { term: 'UNIQUE', definition: 'A constraint que recusa a chave repetida. Como a checagem acontece dentro da própria escrita, não sobra janela entre checar e gravar.' },
        { term: 'ON CONFLICT', definition: 'A cláusula do Postgres que trata essa recusa sem estourar erro. Com DO NOTHING, o segundo INSERT simplesmente não grava.' },
      ],
    },
    {
      title: 'Como isso vira arquitetura',
      terms: [
        { term: 'write path', definition: 'O caminho da escrita. Precisa ser exato e durável, e é o lado caro do sistema.' },
        { term: 'read path', definition: 'O caminho da leitura. Tolera atraso, e é onde o volume de verdade está.' },
        { term: 'two-phase commit', definition: 'O protocolo que sincroniza uma escrita em mais de um lugar. É o que sustenta o índice forte, e é o que o torna caro.' },
        { term: 'strongly consistent', definition: 'Uma leitura enxerga a escrita que acabou de acontecer. A autorização de cartão depende disso.' },
        { term: 'eventually consistent', definition: 'A leitura converge para o valor certo, com atraso. "Eventually" aqui quer dizer que chega, e não que acontece de vez em quando.' },
        { term: 'materialized view', definition: 'Uma projeção do log mantida à parte e atualizada de forma assíncrona. É o que serve o histórico e o saldo.' },
        { term: 'hot/cold tiering', definition: 'Dado novo no armazenamento rápido, dado velho no barato. Mesmo log, com custo por idade do dado.' },
        { term: 'partição por tempo', definition: 'O log cortado por timestamp. O auditor pede março e a consulta lê só as partições de março.' },
      ],
    },
    {
      title: 'Os nomes próprios',
      terms: [
        { term: 'LedgerStore', definition: 'O ledger da Uber. Mais de 2 trilhões de índices únicos, e seis meses em produção sem uma inconsistência de dado detectada.' },
        { term: 'Docstore', definition: 'O banco interno da Uber. É dele que vem o recurso de Materialized Views usado nos índices eventually consistent, e é ele o hot storage, com menos de 3 meses de dado.' },
        { term: 'TerraBlob', definition: 'O armazenamento barato da Uber. É o cold storage, para onde vai o dado com mais de 1 ano.' },
        { term: 'DynamoDB', definition: 'Banco de chave-valor da AWS. Foi onde a Uber começou em 2017, e de onde saiu por custo na escala do trilhão.' },
        { term: 'conditional write', definition: 'A escrita que só acontece se a condição valer. No DynamoDB é ela que faz o papel da constraint UNIQUE.' },
        { term: 'Aurora PostgreSQL', definition: 'O Postgres gerenciado da AWS. Hoje é onde o padrão ledger costuma morar.' },
        { term: 'CHECK constraint', definition: 'A regra declarada no banco. É onde a soma zero precisa viver para valer até para um script rodando por fora da aplicação.' },
        { term: 'QLDB', definition: 'O banco de ledger dedicado da AWS, com append-only e verificação criptográfica. Descontinuação anunciada em 2024, e o padrão sobreviveu sem ele.' },
      ],
    },
  ],
};
