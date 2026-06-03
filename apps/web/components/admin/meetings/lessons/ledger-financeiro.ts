import type { Lesson } from '../lesson-types';

export const ledgerFinanceiro: Lesson = {
  slug: 'ledger-financeiro',
  title: 'Modelando Dinheiro: o Ledger',
  subtitle: 'Por que 0.1 + 0.2 quebra um banco, e como a Uber resolve com double-entry imutável.',
  blurb:
    'Uma curiosidade que vira system design. A gente começa com o susto de digitar 0.1 + 0.2 no console e ver lixo no resultado, entende por que ninguém guarda dinheiro em float, e descobre que a solução de verdade não é trocar o tipo da coluna, é trocar o modelo. A partir daí: double-entry (a regra de 500 anos onde todo lançamento tem dois lados que se cancelam), append-only (você nunca edita um registro de dinheiro, só adiciona o oposto), idempotência (a rede vai te trair e você não pode cobrar duas vezes), e o clímax no LedgerStore da Uber, que processa 5 bilhões de eventos por dia sobre 1 trilhão de entries imutáveis. A regra que sai daqui: saldo não é um número que você guarda, é um fold sobre um log que você nunca apaga.',
  durationMin: 60,
  audience: 'Hot Stuff 2026.2 · Big Tech',
  slidesUrl: '/slides/ledger-financeiro.html',
  nodes: [
    // ──────────────── FOUNDATIONS (study-only) ────────────────
    {
      id: 'f-representacao',
      label: 'Como o computador guarda número',
      group: 'foundations',
      teachFromZero: true,
      oneLine:
        'Um int guarda valor exato. Um float guarda uma aproximação em notação científica binária, e essa aproximação é a origem de todo bug de dinheiro.',
      pass1:
        'O computador tem dois jeitos básicos de guardar um número. Inteiro (int) guarda um valor exato em binário direto: 5 é 101, 42 é 101010, sem perda. Ponto flutuante (float, double) guarda número com casa decimal, e pra isso usa notação científica binária: um sinal, um expoente e uma mantissa, tudo em 64 bits. O problema é que 64 bits são finitos, e a maioria dos decimais que a gente escreve não cabe exato em binário. O resultado é uma aproximação muito boa, mas aproximação.',
      pass2:
        'Em decimal, 1/3 não tem representação finita: 0.3333... nunca termina. A gente aceita isso numa boa porque cresceu na base 10. O ponto que quase ninguém percebe é que a base 2 tem o mesmo problema, só que com números diferentes.\n\nNa base 2, você só consegue representar exato as frações cujo denominador é potência de 2. Então 0.5 é 0.1, 0.25 é 0.01, 0.75 é 0.11, tudo limpo. Mas 0.1 (um décimo) em binário vira 0.000110011001100110011... uma dízima que repete pra sempre. O computador corta num ponto e guarda o mais perto que cabe.\n\n**IEEE 754** é o padrão que define esse formato (sinal, expoente, mantissa) e está em praticamente todo hardware do planeta. Não é bug de linguagem nenhuma: Python, JavaScript, Java, C, Go, todos dão o mesmo 0.30000000000000004 porque todos usam o mesmo padrão de hardware.\n\nA consequência prática que importa pra aula: float é ótimo pra física, gráficos, machine learning, onde um erro na 16ª casa não muda nada. É péssimo pra dinheiro, onde um centavo somado um milhão de vezes vira um buraco no balanço.',
      pass3: [
        {
          gotcha: 'Achar que é bug da linguagem',
          note: 'Não é do Python nem do JS. É do hardware seguindo o IEEE 754. Trocar de linguagem não resolve, o mesmo 0.1 dá a mesma dízima binária em qualquer lugar.',
        },
        {
          gotcha: 'Confundir precisão com exatidão',
          note: 'double tem 15 a 17 dígitos de precisão, o que é muita coisa. Mas precisão alta não é exatidão: 0.1 continua sendo uma aproximação, por mais casas que tenha.',
        },
        {
          gotcha: 'Achar que arredondar na exibição resolve',
          note: 'Mostrar R$ 0,10 com toFixed(2) esconde o erro na tela, mas o valor guardado continua sujo. Quando você soma mil desses, o erro acumulado aparece de novo, agora visível.',
        },
      ],
      anchor:
        'Por que 0.5 cabe exato em binário mas 0.1 não?',
      followup: 'Se float não serve pra dinheiro, o que você usa no lugar?',
      gotcha:
        'Se alguém disser "é erro de arredondamento do Python", devolva: "abre o console do Chrome e digita lá. JavaScript dá o mesmo. Por quê?"',
    },
    // ──────────────── MONEY: o problema ────────────────
    {
      id: 'float-money',
      label: 'O bug de um trilhão de dólares',
      group: 'money',
      beat: 1,
      teachFromZero: true,
      tags: ['ieee-754', 'floating-point', 'rounding-error', 'centavos-inteiros', 'precision'],
      oneLine:
        'O resultado de 0.1 + 0.2 tem lixo no final, e esse lixo é a razão pela qual ninguém sério guarda dinheiro num float.',
      pass1:
        'Abre o console do navegador e digita 0.1 + 0.2. O resultado é 0.30000000000000004. Não é zoeira, não é bug do Chrome, é assim em toda linguagem. Agora imagina esse errinho dentro de um sistema que move bilhões de reais por dia. Cada operação carrega um resíduo minúsculo, e quando você soma milhões de operações, o resíduo vira dinheiro de verdade que não bate. É por isso que a primeira regra de qualquer sistema financeiro é: dinheiro nunca, jamais, em hipótese alguma, mora num float.',
      pass2:
        'O lixo aparece porque 0.1 e 0.2 são dízimas infinitas em binário (visto nas foundations). O computador guarda a versão cortada de cada um, soma as duas versões cortadas, e o erro das duas aparece na 17ª casa. Sozinho é invisível. Em escala, não.\n\nO caso clássico de prova: um sistema que soma R$ 0,10 um bilhão de vezes. Em float, o total não dá R$ 100 milhões cravados, dá algo tipo R$ 100.000.007,12. Sete reais e doze centavos saídos do nada. Pra um banco, isso é um descasamento de balanço, um auditor batendo na porta.\n\nO erro não é teórico. O **míssil Patriot** em 1991 acumulou erro de ponto flutuante no relógio interno: depois de 100 horas ligado, o desvio foi grande o bastante pra ele errar a interceptação de um Scud, e 28 pessoas morreram. O índice da bolsa de **Vancouver** nos anos 80 perdeu metade do valor de tanto truncar float a cada recálculo. Erro de representação tem corpo.\n\nA correção mais simples: pare de usar fração. Guarde dinheiro como **inteiro de centavos**. R$ 19,90 vira o inteiro 1990. Soma de inteiro é exata, sem dízima, sem lixo. Divisão você trata explícito, decidindo pra quem vai o centavo que sobra. Bancos de verdade usam isso ou um tipo decimal de precisão arbitrária (DECIMAL no Postgres, BigDecimal no Java), nunca float.',
      pass3: [
        {
          gotcha: 'Usar FLOAT na coluna do banco',
          note: 'Coluna money como FLOAT ou REAL no Postgres carrega o mesmo problema do código. Use DECIMAL(precisão, escala) ou BIGINT de centavos. FLOAT pra dinheiro é bug esperando data pra acontecer.',
        },
        {
          gotcha: 'Comparar dinheiro com ==',
          note: 'Se ainda estiver em float, 0.1 + 0.2 == 0.3 é false. Comparar saldo com igualdade exata em float quebra silencioso. Com inteiro de centavos, == volta a ser confiável.',
        },
        {
          gotcha: 'Dividir e perder o centavo',
          note: 'R$ 10,00 dividido entre 3 pessoas dá 333 + 333 + 333 = 999 centavos. Sumiu 1 centavo. Em dinheiro você precisa decidir explicitamente quem leva a sobra, não deixar o float "resolver".',
        },
        {
          gotcha: 'Achar que centavo inteiro resolve TUDO',
          note: 'Inteiro de centavos mata o erro de representação, mas não responde "quem deve quanto a quem" nem "como desfaço uma transação errada". Esse é o pulo pro resto da aula.',
        },
      ],
      anchor:
        'Abra o console do navegador, digite 0.1 + 0.2 e olhe o resultado. Por que isso é aterrorizante pra quem move dinheiro, e o que você usaria no lugar de um float?',
      askWho: [
        {
          name: 'open',
          why: 'Beat de abertura, é curiosidade pura. Todo mundo abre o console e roda junto. Ninguém estudou bit-manipulation no ciclo, então a graça é ver a sala reagir ao resultado antes de explicar.',
        },
        {
          name: 'Maria Clara',
          why: 'Maior breadth do cohort (16 tópicos, incluindo math e scalability). Se precisar puxar alguém pra arriscar o "porquê", ela tem a base mais ampla pra chutar representação binária.',
        },
        {
          name: 'Eduardo Hirohito',
          why: 'Perfil técnico mais completo no resto da aula. Bom pra ancorar a ponte "float não serve, então usa inteiro" antes de descer pro modelo.',
        },
      ],
      followup:
        'Beleza, guardamos tudo como inteiro de centavos. Problema resolvido? O que ainda pode dar errado quando você MOVE esse dinheiro de uma conta pra outra?',
      gotcha:
        'Quando alguém disser "é só arredondar pra 2 casas", devolva: "arredonda onde? Se arredonda na hora de mostrar, o valor guardado continua sujo e soma errado mil vezes depois."',
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
      oneLine:
        'O modelo ingênuo guarda um saldo numa coluna e dá UPDATE. Ele quebra em concorrência, perde o histórico, e não sobrevive a uma queda no meio.',
      pass1:
        'O primeiro instinto de todo mundo é uma tabela conta com uma coluna saldo. Transferir R$ 50 da Ana pra o Beto é: lê o saldo da Ana, subtrai 50, dá UPDATE; lê o saldo do Beto, soma 50, dá UPDATE. Dois UPDATEs e pronto. Esse modelo parece óbvio e é exatamente por isso que ele é uma armadilha. Ele tem três defeitos que só aparecem quando vira dinheiro de verdade: concorrência, durabilidade e auditoria.',
      pass2:
        'Defeito 1, **concorrência**. Duas transferências da Ana ao mesmo tempo leem o saldo de 100, cada uma subtrai 50, cada uma grava 50. As duas deveriam deixar a Ana com 0, mas como leram o mesmo 100, ela termina com 50. Você acabou de criar R$ 50 do nada. Isso é o lost update clássico, e em dinheiro é fraude acidental.\n\nDefeito 2, **durabilidade no meio da operação**. O servidor cai depois do UPDATE da Ana e antes do UPDATE do Beto. A Ana perdeu 50, o Beto não recebeu. Dinheiro evaporou. Você precisa que os dois lados aconteçam juntos ou nenhum, e uma coluna mutável solta não te dá isso de graça.\n\nDefeito 3, **auditoria**. O UPDATE destrói o valor anterior. Pergunta do regulador seis meses depois: "por que o saldo dessa conta mudou no dia 14?" A resposta honesta é "não sei, o número antigo foi sobrescrito". Num sistema financeiro, perder o histórico não é inconveniência, é ilegal.\n\nDá pra remendar os três (lock pessimista pra concorrência, transação ACID pra durabilidade, tabela de log paralela pra auditoria), mas repare que você está empilhando remendo em cima de um modelo que, no fundo, é o modelo errado. A pergunta certa não é "como conserto o UPDATE", é "e se eu nunca der UPDATE?"',
      pass3: [
        {
          gotcha: 'Achar que BEGIN/COMMIT resolve concorrência sozinho',
          note: 'Transação garante atomicidade (tudo ou nada), mas não impede o lost update se você leu o saldo antes do BEGIN ou sem lock. Precisa de SELECT FOR UPDATE ou nível de isolamento serializável, e aí você paga em throughput.',
        },
        {
          gotcha: 'Tabela de log "paralela" como fonte de verdade',
          note: 'Se o saldo está numa coluna e o histórico numa tabela separada, os dois podem divergir. Qual está certo quando discordam? Se o log é só "cópia", ele não é auditoria de verdade.',
        },
        {
          gotcha: 'Confiar no saldo lido pra autorizar',
          note: 'Ler saldo, decidir "tem grana", e só depois debitar abre janela pra corrida. Entre a leitura e a escrita, outra transação esvaziou a conta. A decisão e o débito precisam ser atômicos.',
        },
      ],
      anchor:
        'Você modela conta como uma tabela com coluna saldo. Duas transferências de R$ 50 saem da mesma conta de R$ 100 no mesmo milissegundo. Desenhe o que cada uma lê e grava, e diga com quanto a conta termina.',
      askWho: [
        {
          name: 'Eduardo Hirohito',
          why: 'Estudou databases e replication, então entende escrita concorrente e o que acontece quando duas transações disputam a mesma linha. É quem mais consegue nomear "lost update".',
        },
        {
          name: 'Livia Tavares',
          why: 'Databases na bagagem (12 tópicos no total). Boa pra puxar a parte de transação ACID e o que COMMIT garante e o que não garante.',
        },
        {
          name: 'Rayssa Guedes',
          why: 'Databases + sharding. Backup forte se os dois acima travarem na parte de concorrência.',
        },
      ],
      followup:
        'Os três defeitos têm uma raiz comum: o UPDATE apaga informação. E se a regra fosse que você NUNCA pode dar UPDATE numa linha de dinheiro?',
      gotcha:
        'Quando alguém disser "é só botar um lock", devolva: "lock na conta da Ana resolve a corrida. E quando o servidor cai entre o débito dela e o crédito do Beto, o lock te devolve o dinheiro do Beto?"',
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
      tags: ['double-entry', 'debit-credit', 'transacao-balanceada', 'conservacao', 'contas'],
      oneLine:
        'A regra de 500 anos da contabilidade: todo lançamento tem dois lados que se cancelam, e a soma de tudo no sistema é sempre zero.',
      pass1:
        'A solução não veio da computação, veio da contabilidade italiana do século XV. A ideia do double-entry (partida dobrada) é que dinheiro nunca aparece nem some, ele só MUDA DE LUGAR. Então todo movimento tem dois lados: de onde saiu e pra onde foi. Transferir R$ 50 da Ana pro Beto não é "uma operação que mexe em duas contas", é um lançamento com duas pernas: debita 50 da Ana, credita 50 no Beto. As duas pernas somam zero. Se não somam zero, o lançamento é inválido e nem entra.',
      pass2:
        'Cada movimento vira um conjunto de **entries** (lançamentos), e cada entry tem uma conta, um valor, e um lado (débito ou crédito). A regra de ferro: dentro de uma mesma transação, a soma dos débitos é igual à soma dos créditos. O delta total é sempre zero.\n\nIsso te dá uma propriedade linda de graça: a soma de TODOS os saldos do sistema inteiro é sempre zero (ou constante, se você modela o mundo externo como uma conta também). Se um dia a soma global não der zero, você sabe na hora que tem bug, sem precisar saber qual transação quebrou. É uma invariante que se verifica sozinha.\n\nA transferência de R$ 50 vira algo assim, atômico:\n\n```\nlançamento #8841  (R$ 50, transferência Ana → Beto)\n  débito   conta:ana    -50\n  crédito  conta:beto   +50\n  soma = 0  ✓\n```\n\nRepare que isso não é uma tabela de saldos, é uma tabela de MOVIMENTOS. O saldo da Ana não está guardado em lugar nenhum como número, ele é a soma de todas as entries da conta dela. Saldo deixou de ser um dado e virou uma conta (no sentido de cálculo). Esse é o pulo mental da aula, e o próximo beat leva ele às últimas consequências.',
      pass3: [
        {
          gotcha: 'Achar que débito é "negativo" e crédito é "positivo"',
          note: 'Débito e crédito não são sinais universais, dependem do tipo de conta (ativo, passivo). Pro nível da aula, o que importa é que as duas pernas se cancelam dentro do lançamento. Não enrole a sala com a tabela contábil completa.',
        },
        {
          gotcha: 'Esquecer a conta de contrapartida',
          note: 'Quando dinheiro entra no sistema (depósito via cartão), a perna de crédito na conta do usuário precisa de uma perna de débito em algum lugar (conta do gateway, conta da empresa). Sem contrapartida, a soma não fecha em zero.',
        },
        {
          gotcha: 'Guardar o saldo E as entries sem definir a fonte de verdade',
          note: 'Se você materializa o saldo numa coluna pra ler rápido, ele é cache, não verdade. A verdade é a soma das entries. Se os dois divergem, as entries ganham, sempre.',
        },
        {
          gotcha: 'Validar o "soma zero" só na aplicação',
          note: 'Se a regra de balanceamento mora só no código, um bug ou um path alternativo fura. O ideal é o banco recusar (constraint, trigger) qualquer lançamento que não some zero.',
        },
      ],
      anchor:
        'Esqueça a coluna saldo. Modele a transferência de R$ 50 da Ana pro Beto como LANÇAMENTOS, não como UPDATEs. Quantas linhas você grava, e quanto elas somam?',
      askWho: [
        {
          name: 'Lorena Garcia',
          why: 'Databases + cap-consistency + scalability. Tem a base pra entender modelagem e a invariante de soma global. Boa voz pra conduzir o "saldo é derivado".',
        },
        {
          name: 'Livia Tavares',
          why: 'Databases sólido. Consegue traduzir o conceito contábil em "tabela de movimentos" sem se perder.',
        },
        {
          name: 'Leunam Sousa',
          why: 'Databases na bagagem (9 tópicos). Backup pra parte de modelagem se as duas acima já tiverem falado bastante.',
        },
      ],
      followup:
        'Se o saldo é a soma das entries e não um número guardado, o que acontece quando você precisa CORRIGIR uma entry errada de ontem?',
      gotcha:
        'Quando a sala aceitar rápido demais, jogue: "se saldo é a soma de TODAS as entries da conta, ler o saldo de uma conta com 10 milhões de lançamentos custa o quê? Como a Uber não morre nisso?"',
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
      tags: ['immutability', 'append-only', 'estorno', 'saldo-como-fold', 'event-sourcing'],
      oneLine:
        'Num ledger, registro de dinheiro é imutável. Errou? Você não corrige a linha, você adiciona um lançamento de estorno e depois o certo.',
      pass1:
        'Aqui está a regra que parece estranha na primeira vez e óbvia na segunda: num ledger de verdade, você NUNCA dá UPDATE nem DELETE numa entry. O registro é imutável. Cobrou R$ 30 errado ontem? Você não edita o lançamento de 30 nem apaga ele. Você adiciona um novo lançamento que estorna os 30 (o oposto exato), e depois adiciona o lançamento certo. O erro continua lá, visível, e a correção também. A tabela só cresce, nunca encolhe nem muda. É append-only.',
      pass2:
        'Por que tanta cerimônia? Porque a imutabilidade é o que torna a auditoria possível. Cada linha é um fato histórico: "nesse instante, isso aconteceu". Fato não se reescreve. Se você pudesse editar, a pergunta "qual era o saldo no dia 14 às 15h?" não teria resposta confiável, porque o passado teria sido alterado. Append-only te dá uma máquina do tempo: o estado em qualquer momento é a soma das entries até aquele instante.\n\nIsso muda o que "saldo" significa de vez. Saldo não é um número guardado, é um **fold**: você pega todas as entries da conta e soma. Saldo de hoje é a soma até hoje. Saldo de terça passada é a soma até terça passada. O mesmo log responde qualquer pergunta temporal, porque ele nunca perdeu nada.\n\nQuem já viu **event sourcing** reconhece o padrão na hora: o estado atual é a redução (fold) de um log imutável de eventos. Ledger é event sourcing aplicado a dinheiro, com 500 anos de vantagem. A correção por estorno é exatamente o "evento compensatório" desse mundo.\n\nA Uber leva isso a sério a ponto de **selar** dados históricos e verificar integridade por hash: uma vez que um intervalo de tempo é selado, qualquer alteração posterior é detectável. O log não é só append-only por convenção, é append-only com prova criptográfica de que ninguém mexeu no passado.',
      pass3: [
        {
          gotcha: 'Deletar a entry errada "pra limpar"',
          note: 'DELETE quebra a auditoria e a soma histórica. A entry errada FICA. Você neutraliza com um estorno (lançamento oposto). A tabela conta a história inteira, inclusive os erros.',
        },
        {
          gotcha: 'Recalcular o saldo do zero toda vez',
          note: 'Fold sobre 10 milhões de entries a cada leitura é inviável. Na prática você materializa saldos parciais (snapshot por período) e soma só o delta desde o último snapshot. O snapshot é cache derivado, não a verdade.',
        },
        {
          gotcha: 'Confundir "pending" com "imutável"',
          note: 'Antes de postado, um lançamento ainda pode ser cancelado (a transferência nem saiu). Depois de postado, vira imutável. A imutabilidade vale pro fato consumado, não pro rascunho.',
        },
        {
          gotcha: 'Achar que append-only é mais lento e pronto',
          note: 'Append-only é a operação MAIS rápida que existe num banco: sem lock de update, sem leitura prévia, só insere no fim. O custo migra pra leitura do saldo, e é lá que você otimiza com snapshots.',
        },
      ],
      anchor:
        'Um cliente reclama de uma cobrança de R$ 30 que entrou errada ontem. No seu ledger, você NÃO pode dar UPDATE nem DELETE. O que você grava pra deixar a conta certa?',
      askWho: [
        {
          name: 'Maria Clara',
          why: 'Maior breadth do cohort e estudou cap-consistency. É quem melhor conecta imutabilidade com a ideia de estado consistente derivado de um log.',
        },
        {
          name: 'Eduardo Hirohito',
          why: 'cap-consistency + replication. Entende por que um log imutável é mais fácil de replicar e auditar que um estado mutável.',
        },
        {
          name: 'Lorena Garcia',
          why: 'cap-consistency + databases. Boa pra puxar a parte de "saldo é fold" e o custo de leitura que vem junto.',
        },
      ],
      followup:
        'O log imutável resolve auditoria e concorrência. Mas a rede entre o app do passageiro e o seu servidor é um inferno. Como você garante que um retry não vira cobrança dupla?',
      gotcha:
        'Quando alguém propuser editar "só esse caso", devolva: "se você abre exceção pra editar UMA entry, perdeu a prova de que NENHUMA outra foi editada. A auditoria vale tudo ou nada. Vale a exceção?"',
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
      tags: ['idempotency-key', 'retry', 'deduplicacao', 'exactly-once', 'rede'],
      oneLine:
        'O app manda "pagar R$ 30", a rede cai antes da resposta, o app tenta de novo. Sem uma chave de idempotência, você cobra duas vezes.',
      pass1:
        'Imutabilidade e double-entry resolvem o que acontece DENTRO do seu sistema. Mas entre o celular do passageiro e o seu servidor tem uma rede, e rede é um lugar onde mensagens se perdem, chegam duas vezes, e atrasam. Cenário clássico: o app manda "pagar R$ 30", o seu servidor processa e grava o lançamento, mas a resposta se perde na volta. O app, sem receber confirmação, tenta de novo. Agora você tem duas requisições idênticas. Se gravar as duas, o passageiro pagou R$ 60. Idempotência é como você garante que mandar a mesma coisa duas vezes tem o mesmo efeito que mandar uma vez.',
      pass2:
        'A ferramenta é a **chave de idempotência**: o cliente gera um identificador único pra aquela operação (um UUID, por exemplo) e manda junto na requisição. O retry usa a MESMA chave, porque é a mesma intenção.\n\nNo servidor, antes de gravar o lançamento, você checa: já existe uma operação com essa chave? Se não, processa e guarda a chave junto com o resultado. Se sim, NÃO processa de novo, só devolve o resultado que já tinha. A segunda, terceira, décima tentativa com a mesma chave caem todas no mesmo lugar e não geram lançamento novo.\n\nO detalhe que separa quem entende de quem decorou: a checagem da chave e a gravação do lançamento precisam ser **atômicas**. Se você checa "não existe", e entre a checagem e a gravação chega o retry e checa "não existe" também, as duas gravam. Voltou o lost update, agora na chave. Por isso a chave costuma virar uma constraint UNIQUE no banco: o segundo insert com a mesma chave falha por violação, e você trata isso como "já processei".\n\nIsso te dá o que a galera chama de **exactly-once**, que tecnicamente é at-least-once (o cliente reenvia até ter certeza) somado a deduplicação no servidor (a chave descarta as repetições). Ninguém entrega exactly-once de verdade na rede. Você entrega "tente quantas vezes quiser, eu só conto uma".',
      pass3: [
        {
          gotcha: 'Gerar a chave no servidor',
          note: 'Se o servidor gera a chave, cada retry do cliente é uma operação "nova" e você cobra de novo. A chave PRECISA nascer no cliente e ser a mesma em todos os retries da mesma intenção.',
        },
        {
          gotcha: 'Checar-depois-gravar sem atomicidade',
          note: 'SELECT "existe?" seguido de INSERT abre janela de corrida. Use UNIQUE constraint na chave e deixe o banco rejeitar o segundo, ou um INSERT ... ON CONFLICT DO NOTHING. A própria gravação é a checagem.',
        },
        {
          gotcha: 'Confundir idempotência com retry cego',
          note: 'Reenviar sem chave não é idempotência, é duplicação garantida. O que torna o retry seguro é a chave estável + a dedup no servidor, não o retry em si.',
        },
        {
          gotcha: 'Chave sem prazo de validade ou escopo',
          note: 'Reusar a mesma chave pra duas intenções diferentes faz a segunda ser descartada como "duplicata" e o pagamento legítimo some. A chave é por operação, e geralmente tem janela de expiração.',
        },
      ],
      anchor:
        'O app do passageiro manda pagar R$ 30. A rede cai antes da resposta voltar. O app tenta de novo automaticamente. Como você garante, no servidor, que ele paga UMA vez e não duas?',
      askWho: [
        {
          name: 'Eduardo Hirohito',
          why: 'cap-consistency + replication. Ninguém no cohort estudou idempotency direto, mas ele é quem mais chega perto: já pensou em escrita distribuída e no que acontece quando a mensagem chega duas vezes.',
        },
        {
          name: 'Maria Clara',
          why: 'Maior breadth. Backup pra puxar a ideia de "dedup pela chave" mesmo sem ter visto o termo formal.',
        },
        {
          name: 'open',
          why: 'Tópico que ninguém estudou. Vale abrir pra sala depois das duas tentativas acima: é uma daquelas que a pessoa resolve raciocinando, não lembrando. Quem chutar "chave única" acertou o coração.',
        },
      ],
      followup:
        'Temos as quatro peças: inteiro de centavos, double-entry, append-only, idempotência. Hora de montar o sistema inteiro. Como isso vira a arquitetura de um pagamento na Uber?',
      gotcha:
        'Quando alguém disser "é só o cliente não reenviar", devolva: "o cliente NÃO sabe se você processou, a resposta se perdeu. Ele tem que reenviar pra não perder o pagamento. O problema é seu, no servidor."',
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
      oneLine:
        'Passageiro encerra a corrida e o dinheiro atravessa todas as camadas até virar entry imutável. O caminho de escrita e o de leitura são propositalmente diferentes.',
      pass1:
        'Hora de juntar tudo num diagrama. O passageiro encerra a corrida, e a partir daí o dinheiro percorre uma sequência de camadas até virar um par de lançamentos imutáveis no ledger, e depois aparecer como saldo pro motorista. O segredo do design é separar o caminho de ESCRITA (gravar o pagamento, que precisa ser exato e durável) do caminho de LEITURA (mostrar histórico e saldo, que pode tolerar um pequeno atraso). Os dois têm requisitos opostos, então têm soluções diferentes. É o LedgerStore da Uber: imutável, com 5 bilhões de eventos por dia sobre mais de 1 trilhão de entries.',
      pass2:
        '**Write path** (a corrida acabou, cobra o cartão). A requisição chega com a chave de idempotência. O serviço de pagamento valida, monta o lançamento double-entry (débito no passageiro, crédito no motorista e na Uber, somando zero) e grava append-only. Pra autorização de cartão, que exige read-your-write na hora (você precisa ler de volta o que acabou de gravar), a Uber usa um **índice fortemente consistente** com two-phase commit: grava a intenção do índice, grava o registro, e confirma de forma assíncrona. A leitura resolve intenções pendentes consultando o store principal. Sem isso, uma segunda autorização poderia não enxergar a primeira.\n\n**Read path** (o motorista abre o app e vê o histórico). Aqui não precisa de consistência imediata, ver um lançamento 200ms depois é aceitável. Então a Uber usa **índices eventualmente consistentes**, materialized views que atualizam em background. O saldo não é somado do zero a cada abertura: vem de snapshots periódicos mais o delta recente. Caminho barato pra uma leitura que não exige o último milissegundo.\n\n**Compliance e histórico antigo** usam um terceiro tipo, o **índice por intervalo de tempo**: particiona por timestamp, lê por prefixo de tempo com scatter-gather entre shards. É o que responde "todas as transações de março" pro auditor sem varrer o banco inteiro.\n\n**Tiering quente/frio**. Dado novo e quente fica no store rápido (a Uber começou no DynamoDB, depois migrou pro Docstore in-house). Dado frio, com semanas de idade, desce pra storage barato (o TerraBlob deles, equivalente a um object store). Mesmo log, custos diferentes por temperatura. A escala fala por si: a migração moveu 1.2 petabyte comprimido, mais de 1 trilhão de entries, com zero inconsistência detectada em seis meses de validação.',
      pass3: [
        {
          gotcha: 'Usar consistência forte no caminho todo',
          note: 'Forçar two-phase commit também na leitura de histórico paga latência sem necessidade. Só a autorização precisa de read-your-write. Mistura os dois e você fica caro e lento onde não precisava.',
        },
        {
          gotcha: 'Somar o saldo do zero no read path',
          note: 'Conta com milhões de entries não pode ser somada a cada GET de saldo. Snapshot periódico + delta. Esquecer isso transforma "mostrar saldo" na query mais cara do sistema.',
        },
        {
          gotcha: 'Tratar o índice como fonte de verdade',
          note: 'Os índices (materialized views) são derivados do log. Se um índice corrompe, você reconstrói a partir das entries. A verdade nunca está no índice, está no ledger append-only.',
        },
        {
          gotcha: 'Ignorar o tiering e pagar storage quente pra tudo',
          note: 'Dado de 2 anos atrás no mesmo store caro do dado de hoje é desperdício. O tiering quente/frio é o que segura o custo em escala de petabyte. Foi parte do que economizou US$ 6 milhões por ano.',
        },
      ],
      anchor:
        'A corrida acabou. Desenhe CADA camada que o dinheiro atravessa, do "encerrar corrida" no app até o motorista ver o saldo. Separe explicitamente o caminho de escrita do de leitura.',
      askWho: [
        {
          name: 'Eduardo Hirohito',
          why: 'O perfil distribuído mais completo do cohort: databases + replication + sharding + scalability + cap-consistency. É quem tem o mapa mental do stack inteiro pra desenhar write path e read path separados. Começa com ele.',
        },
        {
          name: 'Maria Clara',
          why: 'Maior breadth (16 tópicos) + cap-consistency + scalability. Backup forte pra parte de consistência e pra ver por que os dois caminhos divergem.',
        },
        {
          name: 'Lorena Garcia',
          why: 'databases + cap-consistency + scalability. Boa pra puxar a parte de materialized view e snapshot de saldo.',
        },
      ],
      followup:
        'Diagrama no quadro. Pra cada caixa desse desenho, qual managed service da AWS, e por que o perfil de carga manda na escolha?',
      gotcha:
        'Quando o desenho misturar leitura e escrita numa coisa só, devolva: "a autorização do cartão precisa ler na hora o que gravou. O histórico do motorista, não. Por que você daria a MESMA garantia (e o mesmo custo) pros dois?"',
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
      oneLine:
        'Pra cada caixa do ledger existe um serviço gerenciado da AWS, e a escolha é ditada pelo perfil de carga da caixa, não pela sua familiaridade.',
      pass1:
        'Com o diagrama no quadro, a pergunta é: se fosse subir na AWS amanhã, qual serviço gerenciado entra em cada caixa? A regra que guia tudo é a mesma da aula: o perfil de carga da caixa manda na escolha. Escrita append-only de altíssimo volume pede uma coisa, leitura de histórico tolerante a atraso pede outra, arquivo frio de compliance pede outra. Mapear caixa a serviço é o que transforma o desenho num sistema que existe.',
      pass2:
        '**O ledger append-only (escrita quente, idempotente, alto throughput)**. O candidato natural é o **DynamoDB**: escrita rápida, escala horizontal, e o UNIQUE da chave de idempotência vira uma conditional write (grava só se a chave não existe). Foi exatamente onde a Uber começou em 2017. Curiosidade que ensina: a Uber DEPOIS saiu do DynamoDB e construiu o próprio store, porque em escala de trilhão de entries o custo gerenciado ficou alto. A migração economizou US$ 6 milhões por ano. Managed é ótimo até a conta de escala virar maior que o custo de fazer em casa.\n\n**O caso do serviço feito pra isso**. A AWS teve o **QLDB** (Quantum Ledger Database), um banco imutável, append-only, com verificação criptográfica embutida, literalmente desenhado pra ledger. Era a resposta de catálogo pra esta aula. Detalhe honesto: a AWS descontinuou o QLDB (anúncio de fim de suporte em 2024), e a orientação atual é fazer o padrão ledger sobre Aurora PostgreSQL. Bom lembrete de que serviço gerenciado também morre, e o PADRÃO (append-only, double-entry) sobrevive ao produto que o implementava.\n\n**A leitura relacional com soma-zero forte**. **Aurora / RDS PostgreSQL**: transação ACID pra gravar as duas pernas atômicas, constraint pra recusar lançamento que não some zero, e SQL pra materializar saldos. É a escolha quando você quer a invariante garantida pelo banco, não pela aplicação.\n\n**Stream de eventos e materialized views** (atualizar os índices eventuais do read path): **Kinesis** ou **MSK** (Kafka gerenciado) carregam o fluxo de entries pros consumidores que constroem as views. **Arquivo frio de compliance**: **S3** com **Glacier** pro histórico antigo, o equivalente direto do TerraBlob da Uber. Centavos por GB pra dado que quase nunca é lido mas não pode sumir.',
      pass3: [
        {
          gotcha: 'Escolher o serviço pela familiaridade',
          note: 'Botar tudo no RDS porque "sei SQL" ignora que o append-only de alto volume tem perfil diferente da leitura relacional. A caixa dita o serviço, não o seu conforto.',
        },
        {
          gotcha: 'Assumir que managed é sempre mais barato',
          note: 'A Uber saiu do DynamoDB justamente porque, no volume deles, o gerenciado custava mais que o in-house. Managed ganha no começo e no médio. Em escala extrema, a conta inverte.',
        },
        {
          gotcha: 'Apontar QLDB sem saber que foi descontinuado',
          note: 'Em entrevista hoje, citar QLDB como solução atual pega mal. O elegante é: "era o serviço purpose-built, a AWS aposentou, hoje se faz o mesmo padrão sobre Aurora". Mostra que você acompanha.',
        },
        {
          gotcha: 'Esquecer a constraint de soma-zero no banco',
          note: 'Se a regra "débitos = créditos" mora só na aplicação, um path bugado fura. Em Aurora dá pra forçar via constraint/trigger. A invariante mais importante do sistema não pode depender só do código.',
        },
      ],
      anchor:
        'Diagrama do beat anterior no quadro. Pra cada caixa (ledger append-only, leitura de histórico, arquivo de compliance, stream de eventos), qual serviço da AWS você escolhe, e qual perfil de carga justifica?',
      askWho: [
        {
          name: 'Maria Clara',
          why: 'Maior breadth do cohort (16 tópicos). Maior chance de ter cloud na bagagem e de mapear caixa a serviço com fluência. Começa com ela.',
        },
        {
          name: 'Eduardo Hirohito',
          why: 'Perfil de infra mais completo (databases, replication, sharding, scalability). Forte pra justificar DynamoDB vs Aurora pelo perfil de escrita vs leitura.',
        },
        {
          name: 'Rayssa Guedes',
          why: 'databases + sharding. Boa pra puxar a parte de particionamento do store quente e o tiering pro frio.',
        },
      ],
      followup:
        'Olhando o sistema inteiro: o que mudou em relação ao modelo ingênuo da coluna saldo do começo da aula? Qual foi a decisão que destravou todo o resto?',
      gotcha:
        'Quando alguém botar tudo no RDS, devolva: "5 bilhões de escritas append por dia no mesmo Postgres que serve as queries de histórico. Quem aguenta o tranco primeiro?"',
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
        'A virada da aula inteira cabe numa frase: saldo não é um dado que você guarda, é um fold sobre um log que você nunca apaga.',
      pass1:
        'A aula começou com uma curiosidade boba (0.1 + 0.2 dá lixo) e terminou no LedgerStore da Uber. O fio que conecta os dois é uma única troca de mentalidade: parar de pensar em dinheiro como um NÚMERO que você atualiza, e começar a pensar nele como um LOG que você só estende. Quase tudo de difícil em sistema financeiro se dissolve quando você faz essa virada.',
      pass2:
        'Reconstruindo a escada: float não serve porque o erro acumula, então dinheiro vira inteiro de centavos. Mas guardar um número exato numa coluna ainda quebra em concorrência, durabilidade e auditoria, porque o UPDATE apaga informação. A saída é o double-entry, onde todo movimento tem dois lados que somam zero, e o append-only, onde você nunca edita, só adiciona. Aí saldo deixa de ser um dado e vira um cálculo: a soma das entries.\n\nUma vez que o estado é um fold sobre um log imutável, três coisas ficam fáceis que antes eram difíceis. **Auditoria** é grátis, o passado está todo lá. **Correção** é só mais uma entry (o estorno), nunca uma edição. E a **invariante global** (soma de tudo é zero) se verifica sozinha, denunciando qualquer bug sem você caçar a transação culpada.\n\nO que sobra de difícil migra de lugar: a leitura do saldo fica cara (somar um log gigante) e a rede ameaça duplicar escritas. A primeira você resolve com snapshot mais delta. A segunda com chave de idempotência e dedup. A Uber faz isso em escala de 5 bilhões de eventos por dia, separando write path forte de read path eventual, com tiering quente/frio pra segurar custo.\n\nE o pulo final, o que vale pra fora de dinheiro: esse padrão é **event sourcing**. Estado atual como redução de um log de eventos imutável serve pra carrinho de compras, histórico de pedidos, versionamento de documento, qualquer domínio onde "como chegou aqui" importa tanto quanto "onde está agora". Double-entry é só a versão que a contabilidade descobriu 500 anos antes da gente.',
      pass3: [
        {
          gotcha: 'Levar só "não use float pra dinheiro"',
          note: 'Essa é a casca. O miolo é "saldo é derivado de um log imutável". Quem sai com só a regra do float perdeu a virada de modelo que a aula inteira existe pra entregar.',
        },
        {
          gotcha: 'Achar que append-only é exclusivo de dinheiro',
          note: 'É event sourcing. O mesmo padrão modela qualquer estado que se beneficia de histórico completo e correção sem edição. Dinheiro é o exemplo mais antigo e mais rígido, não o único.',
        },
        {
          gotcha: 'Esquecer que o custo não some, ele migra',
          note: 'Append-only barateia a escrita e a auditoria, mas encarece a leitura do saldo. Toda escolha de modelo move o custo de lugar. Saber PRA ONDE ele foi é o que separa o design maduro.',
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
};
