// Capitulo 00: o andar de baixo da aula.
//
// O roteiro original comeca no beat 1 assumindo que quem le sabe o que e um
// processo, um kernel, um container e um percentil. Este capitulo existe pra
// quem NAO sabe. Ele nao vai ser apresentado: e o material de estudo de quem
// vai apresentar, pra chegar na aula entendendo o que esta dizendo.
//
// Ordem importa: cada secao so usa conceito que a anterior ja explicou.

export const COMO_USAR = {
  id: 'como-usar',
  title: 'Como usar este roteiro',
  body: [
    'Este documento tem dois modos, e o botão no topo da barra lateral alterna entre eles.',
    '**Modo aprender** mostra tudo: os fundamentos, as explicações do zero, as perguntas que a turma pode fazer e os testes. É o modo pra estudar nos dias antes da aula.',
    '**Modo apresentar** esconde o material de estudo e deixa só o que você usa com a sala na frente: a pergunta que abre cada beat, quem chamar, os três cenários de resposta e a ponte pro próximo beat. É o modo pra deixar aberto no notebook durante a aula.',
    'Toda palavra técnica com **linha pontilhada embaixo** é clicável e abre a explicação sem tirar você do lugar. São mais de 80 termos, e vários deles têm um bloco de aprofundamento que não entra na aula, mas que serve pra você responder pergunta de aluno.',
    'A caixinha ao lado do título de cada beat marca o que você já estudou. Fica salva no seu navegador, então você pode fechar e voltar depois.',
  ],
};

export const PLANO_ESTUDO = {
  id: 'plano-estudo',
  title: 'Plano de estudo em 5 dias',
  intro: 'Estudar tudo na véspera não funciona pra material técnico. A ordem abaixo respeita a dependência entre os conceitos: cada dia só usa o que o dia anterior já construiu.',
  dias: [
    {
      dia: 'Dia 1',
      dur: '~50 min',
      titulo: 'Capítulo 00 inteiro',
      desc: 'Só os fundamentos, sem olhar nenhum beat. Ao terminar, você deve conseguir explicar em voz alta, sem ler, o que é um processo, o que o kernel faz e por que um servidor tem vários containers. Se não conseguir, releia antes de seguir.',
    },
    {
      dia: 'Dia 2',
      dur: '~40 min',
      titulo: 'Temporadas 01 e 02 (beats 1 a 4)',
      desc: 'O problema e a métrica certa. É a parte mais conceitual e a mais importante: se você entender que utilização e espera são coisas diferentes, o resto da aula se sustenta sozinho.',
    },
    {
      dia: 'Dia 3',
      dur: '~45 min',
      titulo: 'Temporada 03 (beats 5 a 7)',
      desc: 'A parte mais técnica, sobre eBPF. Você não precisa saber programar isso. Precisa entender por que medir é caro e quais três truques deixaram barato.',
    },
    {
      dia: 'Dia 4',
      dur: '~40 min',
      titulo: 'Temporadas 04 e 05 (beats 8 a 11) e a síntese',
      desc: 'A atribuição de culpa, o desenho completo e a AWS. O beat 9 é o clímax da aula: se você só tiver tempo pra decorar uma coisa, decore que uma métrica sozinha não distingue throttling de vizinho.',
    },
    {
      dia: 'Dia 5',
      dur: '~30 min',
      titulo: 'Só os "Teste-se", de trás pra frente',
      desc: 'Responda cada um em voz alta ANTES de abrir a resposta. Errar aqui é o ponto: o que você errar hoje é exatamente o que você precisa revisar. Tentar lembrar antes de ver a resposta fixa muito mais do que reler.',
    },
  ],
};

export const FRASES_SEGURANCA = {
  id: 'frases-seguranca',
  title: 'O que dizer quando você não souber',
  intro: 'Você vai apresentar pra uma turma que estudou sistemas. Alguém vai perguntar algo que você não sabe, e isso é absolutamente normal, inclusive pra gente sênior. O que derruba a credibilidade não é não saber: é inventar. Estas frases resolvem sem desgaste.',
  frases: [
    {
      situacao: 'Não sei a resposta e não faço ideia',
      frase: '"Boa pergunta, e eu não sei. Vou anotar e trago a resposta." E anote de verdade, na frente deles.',
      porque: 'Assumir e registrar transmite mais autoridade do que chutar. E cumprir depois vale mais que ter acertado na hora.',
    },
    {
      situacao: 'Não sei, mas dá pra pensar junto',
      frase: '"Não sei de cabeça. Mas vamos raciocinar: o que a gente já sabe é X. Isso te leva a alguma hipótese?"',
      porque: 'Esta aula é socrática por natureza. Devolver a pergunta pra sala não é fuga, é o formato. Vários beats já são desenhados pra isso.',
    },
    {
      situacao: 'A pergunta é muito mais profunda que a aula',
      frase: '"Isso vai fundo demais pro escopo de hoje, mas o caminho pra investigar é X. Fica de estudo pra quem quiser."',
      porque: 'Delimitar escopo é trabalho de quem conduz. Não é sinal de fraqueza, é sinal de controle da aula.',
    },
    {
      situacao: 'Um aluno sabe mais que você naquele ponto',
      frase: '"Você conhece isso melhor que eu, explica pra gente?" E depois: "ótimo, isso conecta com o beat X."',
      porque: 'Numa turma técnica isso vai acontecer, e recuperar o fio depois é o que importa. Puxar o aluno pra explicar aumenta o engajamento da sala inteira.',
    },
    {
      situacao: 'Você percebeu que falou algo errado',
      frase: '"Corrigindo o que eu disse há pouco: o certo é X."',
      porque: 'Corrigir na hora custa cinco segundos. Deixar passar custa a confiança no resto da aula.',
    },
  ],
};

export const FUNDAMENTOS = [
  {
    id: 'f00-servidor',
    n: '00.1',
    title: 'O que é um servidor, e por que existem milhares',
    body: [
      'Um **servidor** é um computador feito pra ficar ligado o tempo todo atendendo outros computadores pela rede. Não tem monitor nem teclado. Quando você aperta play na Netflix, seu celular manda um pedido pela internet, e do outro lado tem um servidor recebendo esse pedido e respondendo.',
      'Um servidor sozinho não dá conta da Netflix inteira, então existem milhares deles trabalhando juntos. E a Netflix não é dona desses galpões: ela aluga máquinas da **AWS**, a divisão de infraestrutura da Amazon. Isso não é detalhe: é o que faz a conta de custo importar tanto no resto da aula.',
      '**Por que isso importa pra sua aula:** o problema inteiro nasce de uma decisão econômica. Uma máquina alugada e parada custa o mesmo que uma máquina alugada e cheia. Então a Netflix coloca vários serviços diferentes na mesma máquina, pra não desperdiçar. É essa decisão que cria o vizinho barulhento.',
    ],
  },
  {
    id: 'f00-cpu',
    n: '00.2',
    title: 'Dentro da máquina: CPU, núcleos e o limite duro',
    body: [
      'A **CPU** é a parte do computador que executa as instruções. Tudo o que um programa faz vira uma lista de instruções, e a CPU executa uma de cada vez, bilhões por segundo.',
      'Uma CPU moderna é dividida em **núcleos** (cores). Cada núcleo executa uma coisa por vez. Um servidor com 16 núcleos consegue fazer 16 coisas ao mesmo tempo de verdade. Não 17.',
      'Guarde esse limite, porque ele é a origem de tudo: se numa máquina existem 400 programas querendo rodar e só 16 núcleos, então 384 deles estão esperando neste exato instante. A sensação de que o computador faz tudo ao mesmo tempo é uma ilusão criada por alguém trocando de tarefa muito, muito rápido.',
      '**Por que isso importa pra sua aula:** quando um aluno perguntar "mas por que existe fila?", a resposta é literalmente essa. Não é bug nem má configuração. É aritmética: mais candidatos do que cadeiras.',
    ],
  },
  {
    id: 'f00-processo',
    n: '00.3',
    title: 'Programa e processo: a diferença que muda tudo',
    body: [
      'Um **programa** é o arquivo parado no disco. Enquanto ninguém abre, ele não faz nada. É a receita escrita no livro.',
      'Um **processo** é esse programa em execução: carregado na memória, com estado próprio, fazendo coisas agora. É você cozinhando a receita, com as panelas no fogo.',
      'Um servidor comum tem centenas de processos vivos ao mesmo tempo: o serviço principal, o banco de dados, um programa que coleta logs, outro que coleta métricas, além de tarefas internas do próprio sistema. Todos eles disputam os mesmos núcleos.',
      'Cada processo recebe um número de identificação, o **PID**. Uma coisa importante e que volta no beat 8: esses números são reciclados. Quando um processo morre, o número volta pro bolo e outro processo pode recebê-lo depois.',
      '**Por que isso importa pra sua aula:** o vizinho barulhento nem sempre é outro time. No caso real do artigo, quem estava comendo a CPU eram os programas auxiliares do próprio sistema. Se você não souber que eles existem, a história não fecha.',
    ],
  },
  {
    id: 'f00-kernel',
    n: '00.4',
    title: 'O kernel: o gerente que ninguém vê',
    body: [
      'Se centenas de processos disputam os mesmos núcleos, alguém precisa organizar. Esse alguém é o **kernel**, o núcleo do sistema operacional.',
      'O kernel é o programa que manda em todos os outros. Ele decide quem usa a CPU, quem acessa o disco, quem fala com a rede. Nenhum programa comum toca no hardware diretamente: todos pedem pro kernel, através de uma **syscall**. Pense num síndico de prédio: ninguém mexe na caixa d\'água por conta própria.',
      'Isso divide o mundo em dois andares. O **userspace** é onde rodam os programas comuns. O espaço do kernel é onde roda o gerente. A fronteira entre os dois é atravessada o tempo todo, e atravessar custa.',
      '**Por que isso importa pra sua aula:** o ponto mais contraintuitivo do dia inteiro é que uma máquina com trinta containers tem UM kernel só, compartilhado por todos. O isolamento entre containers é uma regra que esse kernel aplica, não uma parede física. É exatamente por isso que um container consegue atrapalhar o outro.',
    ],
  },
  {
    id: 'f00-scheduler',
    n: '00.5',
    title: 'O scheduler e a fila que ninguém olha',
    body: [
      'A parte do kernel que decide quem usa a CPU agora chama-se **scheduler**, ou escalonador. Ele dá uma fatia de tempo pra um processo, e quando essa fatia acaba (ou quando o processo pede algo e fica bloqueado), ele guarda o estado daquele processo e coloca outro no lugar. Essa troca chama-se **context switch**, e acontece centenas de milhares de vezes por segundo.',
      'Um processo passa a vida alternando entre três estados, e a diferença entre dois deles é o coração da aula:',
      '**Running:** está de fato ocupando um núcleo agora.',
      '**Sleeping (dormindo):** pediu algo e está bloqueado esperando resposta de fora, como o disco ou a rede. Não é culpa de contenção de CPU.',
      '**Runnable (pronto):** tem tudo o que precisa pra trabalhar e só falta a vez na CPU. Está numa fila chamada **run queue**, e existe uma fila dessas por núcleo.',
      'Runnable é o estado que quase nenhum painel mostra, e é onde a aula inteira mora. É a diferença entre "estou esperando o banco de dados responder" (problema seu) e "estou pronto pra trabalhar e não me dão CPU" (possivelmente problema do vizinho).',
      '**Por que isso importa pra sua aula:** se você confundir sleeping com runnable na hora de explicar, transforma um banco de dados lento numa acusação injusta contra a plataforma. É o erro conceitual mais fácil de cometer nesta aula.',
    ],
  },
  {
    id: 'f00-container',
    n: '00.6',
    title: 'Container: o que é de verdade',
    body: [
      'Um **container** é uma forma de empacotar um programa com tudo o que ele precisa pra rodar, isolado dos outros programas da mesma máquina. É o que permite colocar o serviço do time A e o do time B na mesma máquina sem que um quebre o outro.',
      'Agora a parte que quase todo mundo erra: **para o kernel, container não existe.** O que existe são processos comuns com duas etiquetas.',
      'O **namespace** limita o que aquele grupo de processos consegue ENXERGAR: quais outros processos, qual rede, quais arquivos. É uma parede divisória num escritório aberto.',
      'O **cgroup** limita quanto aquele grupo pode CONSUMIR: quanta CPU, quanta memória. É o limite do cartão de crédito de cada um. E o cgroup tem um número de identificação, que é a chave que faz esta aula funcionar: é ele que permite dizer de qual serviço foi a espera.',
      'A cota de CPU do cgroup funciona por janela: você declara um período (por padrão 100 milissegundos) e quanto pode usar dentro dele. Se gastar tudo antes da janela acabar, o kernel simplesmente para de te escalonar até a próxima. Isso chama-se **throttling**.',
      '**Por que isso importa pra sua aula:** cota é TETO, não é reserva. Ter direito a 2 núcleos não garante que existam 2 núcleos livres quando você precisar. E o throttling produz exatamente o mesmo gráfico que o vizinho barulhento, o que é o clímax do beat 9. Se alguém disser "container é uma VM leve", a correção é: quantos kernels rodam num servidor com trinta containers? Um.',
    ],
  },
  {
    id: 'f00-metrica',
    n: '00.7',
    title: 'Métrica: como se mede um sistema',
    body: [
      'Uma **métrica** é um número medido de tempos em tempos e guardado pra você olhar depois. Uso de CPU, tempo de resposta, quantidade de erros. Guardadas em sequência ao longo do tempo, formam uma **série temporal**.',
      'Numa métrica você pendura **etiquetas** pra poder filtrar depois: de qual container, de qual região, de qual versão. E aqui vem um custo que não é óbvio: cada combinação diferente de etiquetas vira uma série separada, com armazenamento e consulta próprios. Isso chama-se **cardinalidade**.',
      'Métrica é uma das três formas de observar um sistema. As outras duas são o log (o registro textual de eventos individuais) e o trace (o caminho completo de uma requisição atravessando vários serviços). Métrica é barata e agregada. Log e trace são caros e detalhados. Essa diferença decide o que pode virar etiqueta e o que não pode.',
      '**Por que isso importa pra sua aula:** o beat 8 inteiro é sobre isso. Etiquetar por container passa. Etiquetar por PID destrói o sistema de métricas, porque PID é reciclado e praticamente infinito ao longo de um dia.',
    ],
  },
  {
    id: 'f00-tempo',
    n: '00.8',
    title: 'A escala do tempo: mili, micro, nano',
    body: [
      'Computação acontece numa escala de tempo que não temos intuição nenhuma, e esta aula usa as três unidades pequenas o tempo todo. Vale decorar a escada:',
      '**1 segundo = 1.000 milissegundos = 1.000.000 microssegundos = 1.000.000.000 nanossegundos.**',
      'Cada degrau é mil vezes. Uma referência pra ancorar: um piscar de olhos leva de 100 a 150 **milissegundos**. Uma boa analogia pra escala: se um nanossegundo fosse um segundo, um segundo de verdade seria 31 anos.',
      'Os números da aula, na mesma régua: o normal saudável era 83 **microssegundos** de espera. O pico durante o incidente foi 131 **milissegundos**, que é praticamente um piscar de olhos de atraso. E o orçamento pra medir tudo isso era de 600 **nanossegundos** por evento.',
      '**Por que isso importa pra sua aula:** o contraste entre 83 microssegundos e 131 milissegundos é o momento mais impactante da aula, e só impacta se a sala sentir que são mais de mil vezes de diferença. Se você falar os dois números sem marcar a mudança de unidade, o efeito se perde completamente.',
    ],
  },
  {
    id: 'f00-percentil',
    n: '00.9',
    title: 'Média mente, percentil não',
    body: [
      'A **média** soma tudo e divide pela quantidade. O problema dela é diluir o evento raro, e é justamente o evento raro que dói num sistema.',
      'Faça a conta da aula: dez mil esperas de 80 microssegundos, mais cem esperas de 131 milissegundos, no mesmo minuto. A média sai perto de 1,4 milissegundo, que parece ótimo. Um alerta configurado pra disparar acima de 5 milissegundos fica em silêncio, enquanto cem requisições levaram um tapa enorme.',
      'O **percentil** resolve isso olhando pro corte em vez da soma. O **p99** é o valor abaixo do qual estão 99% das medições: 99% foram mais rápidas que ele, 1% foi mais lento. Numa prova com 100 alunos, é a nota do segundo melhor.',
      'Duas armadilhas que valem ouro. Primeira: p99 **não é o pior caso**. Se acontecem dez mil eventos por segundo, cem por segundo ficam piores que o p99. Segunda: **percentil não soma e não tira média**. O p99 de dez máquinas não vira o p99 da frota tirando a média dos dez; é preciso somar os histogramas e recalcular o corte.',
      'E como se calcula percentil sem guardar seiscentos mil números por minuto? Com um **histograma**: em vez de guardar cada medição, você guarda contadores por faixa de valor, e tira o corte da distribuição acumulada.',
      '**Por que isso importa pra sua aula:** o beat 4 é inteiro sobre isso, e a armadilha do "p99 é o pior caso" é a correção que mais aparece em entrevista. Se você chegar sabendo só isso, já entregou valor pra turma.',
    ],
  },
  {
    id: 'f00-producao',
    n: '00.10',
    title: 'O que é "produção", e por que isso muda tudo',
    body: [
      '**Produção** é o ambiente real, com usuários de verdade usando o sistema agora. É diferente do ambiente de teste, onde errar não machuca ninguém.',
      'Toda a dificuldade técnica da aula vem dessa palavra. Existem ferramentas ótimas pra investigar desempenho, mas que custam caro demais pra ficar ligadas em produção o tempo todo. A ferramenta tradicional do Linux pra isso chama-se **perf**, e tem dois problemas: o custo é alto, e normalmente ela é acionada DEPOIS que o problema aconteceu, quando o pico já passou.',
      'Aí aparece um paradoxo bonito, que vale usar na aula: se você só liga a medição durante o incidente, você não tem **baseline**. Os 83 microssegundos do artigo só existem como referência porque a coleta já estava ligada antes de dar problema. Sem número normal, você não sabe se o número de hoje é ruim.',
      'E existe um segundo paradoxo, esse ainda mais importante: quem mede faz parte do sistema. Um coletor pesado numa máquina que já está sofrendo vira ele mesmo o vizinho barulhento, e piora exatamente o incidente que veio investigar. Isso chama-se **efeito observador**.',
      '**Por que isso importa pra sua aula:** os beats 5, 6 e 7 são inteiramente sobre resolver esses dois paradoxos. Se a sala entender que o desafio é "medir tudo, o tempo todo, sem estragar", a temporada 03 inteira faz sentido sozinha.',
    ],
  },
];
