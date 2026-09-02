import type { Lesson } from '../lesson-types';

// Fonte principal: Netflix TechBlog, "Noisy Neighbor Detection with eBPF"
// (Jose Fernandez, Sebastien Dabdoub, Jason Koch, Artem Tkachuk, set/2024).
// Complementos: docs do kernel sobre sched tracepoints e cgroup v2, ebpf.io,
// Brendan Gregg (runqlat / BPF Performance Tools), bpftop (github.com/Netflix/bpftop),
// Andrii Nakryiko sobre tp_btf e BPF_CORE_READ, docs da AWS (AMP, Managed Grafana,
// CloudWatch agent, Kinesis Firehose, Fargate isolation model).
//
// Convencao de escrita: termo tecnico fica em ingles quando e assim que a turma
// vai encontrar na documentacao (run queue, scheduler, tracepoint, ring buffer,
// cardinality). Frase completa, lida em voz alta na frente da sala.
export const noisyNeighborEbpf: Lesson = {
  slug: 'noisy-neighbor-ebpf',
  title: 'O Vizinho Barulhento',
  subtitle:
    'A Netflix instrumentou o scheduler do Linux com eBPF pra responder se a culpa é do seu código ou do vizinho.',
  blurb:
    'Toda empresa grande coloca vários containers na mesma máquina, porque máquina parada é dinheiro queimado. O preço disso é o vizinho barulhento: o container ao lado consome tudo e o seu fica lento sem ter mudado uma linha. A aula começa no pior lugar possível pra um engenheiro, o dashboard que mostra CPU em 20% e um serviço lento ao mesmo tempo, e persegue a pergunta "de quem é a culpa" até o fim. Descobrimos que utilização mede quem usou e não quem esperou, achamos a métrica que responde de verdade (run queue latency, o tempo entre estar pronto pra rodar e receber CPU), vemos por que ela só faz sentido em p99 (a Netflix tinha 83 microssegundos de baseline e levou um pico de 131 milissegundos), e aí caímos no problema mais bonito da aula: como medir todas as trocas de processo de uma máquina, o dia inteiro, em produção, sem virar você mesmo o vizinho barulhento. A resposta é eBPF, com um orçamento de menos de 600 nanossegundos por evento, rate limit dentro do kernel e um ring buffer pra sair de lá. Fecha com a regra que vale pra qualquer sistema, não só pra Linux: uma métrica sozinha te faz culpar a pessoa errada.',
  durationMin: 90,
  audience: 'Hot Stuff 2026.2 · Big Tech',
  slidesUrl: '/slides/noisy-neighbor-ebpf.html',
  nodes: [
    // ──────────────── FOUNDATIONS (study-only) ────────────────
    {
      id: 'f-scheduler',
      label: 'Um core, muitos processos',
      group: 'foundations',
      teachFromZero: true,
      tags: ['processo', 'scheduler', 'time-slice', 'context-switch', 'runnable'],
      oneLine:
        'A máquina tem poucos cores e centenas de processos. O scheduler do kernel é o porteiro que decide quem senta na CPU e por quanto tempo.',
      pass1:
        'Um core executa uma coisa de cada vez. Se a máquina tem 16 cores e 400 processos querendo rodar, alguém precisa decidir a ordem. Esse alguém é o scheduler do kernel do Linux. Ele dá pra cada processo uma fatia de tempo, e quando a fatia acaba (ou quando o processo pede pra dormir esperando disco, rede ou um lock) o kernel salva o estado dele e coloca outro no lugar. Essa troca se chama context switch e acontece milhares de vezes por segundo em qualquer servidor real.',
      pass2:
        'Um processo passa a vida alternando entre três estados que importam pra esta aula. **Running**: está de fato ocupando um core agora. **Sleeping**: pediu algo e está bloqueado esperando (um pacote de rede chegar, o disco responder, um mutex liberar). **Runnable**: já tem tudo o que precisa pra trabalhar e só falta a CPU. Runnable é o estado que quase ninguém olha, e é onde esta aula inteira mora.\n\nQuando um processo dormindo recebe o que estava esperando, o kernel o marca como runnable e o coloca numa fila, a **run queue**. Existe uma run queue por core. O scheduler escolhe dessa fila quem vai rodar em seguida, usando prioridade e quanto tempo cada um já consumiu (no Linux moderno, o CFS e depois o EEVDF fazem essa conta).\n\nO context switch em si não é de graça: o kernel salva registradores, troca o mapa de memória, e o processo novo entra com os caches de CPU frios. A ordem de grandeza é de alguns microssegundos. Isso importa porque significa que trocar de processo o tempo todo é caro, e também porque qualquer instrumentação colocada nesse ponto está num **hot path**, um trecho executado tantas vezes por segundo que microssegundos de overhead viram porcentagem de máquina.\n\nUm detalhe que volta no fim: o kernel também tem processos dele mesmo, tarefas internas que aparecem no scheduler como qualquer outra. Eles têm PID 0 e passam pela mesma fila.',
      pass3: [
        {
          gotcha: 'Confundir sleeping com runnable',
          note: 'Sleeping é "não posso trabalhar ainda, estou esperando algo de fora". Runnable é "posso trabalhar agora, só falta CPU". Só o segundo é culpa de contenção. Misturar os dois é o erro que faz alguém acusar o vizinho quando o problema era o banco lento.',
        },
        {
          gotcha: 'Achar que mais cores elimina a fila',
          note: 'Cada core tem a sua run queue. Mais cores diluem, não zeram. Se o total de processos runnable passa o total de cores, alguém espera, sempre.',
        },
        {
          gotcha: 'Tratar context switch como grátis',
          note: 'Tem custo direto (salvar e restaurar estado) e indireto (cache frio). Por isso o Linux evita trocar à toa, e por isso instrumentar esse ponto exige orçamento de nanossegundos, não de milissegundos.',
        },
      ],
      anchor:
        'Você tem 16 cores e 400 processos querendo rodar agora. Quem decide a ordem, e o que acontece com os 384 que ficaram de fora nesse instante?',
      followup:
        'Se o processo está pronto e só falta CPU, existe algum contador padrão do sistema que te diz há quanto tempo ele está nesse estado?',
      gotcha:
        'Se alguém disser "é só o sistema operacional dividir igual", devolva: "igual pra quem? O processo que acabou de acordar e o que já rodou 200ms merecem a mesma vez?"',
      visuals: [
        {
          kind: 'ascii',
          title: 'Os três estados que importam',
          art: `        pediu rede/disco/lock
   RUNNING ───────────────────────> SLEEPING
      ^                                 |
      |                                 | chegou o que esperava
      | scheduler escolheu              v
      |                             RUNNABLE
      +---------------------------- (na run queue)

  RUNNABLE  =  pronto pra trabalhar, so falta CPU
              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
              o tempo parado AQUI e a metrica da aula`,
          caption:
            'Utilização de CPU mede o tempo em RUNNING. O tempo em RUNNABLE é o que ninguém mede e o que denuncia contenção.',
          board:
            'Desenhe o triângulo e circule RUNNABLE. Diga: "o dashboard de todo mundo mede a seta de cima. A aula é sobre a caixa de baixo."',
        },
      ],
    },
    {
      id: 'f-cgroup',
      label: 'cgroup: a cota que o kernel conhece',
      group: 'foundations',
      teachFromZero: true,
      tags: ['cgroup', 'container', 'cpu-quota', 'throttling', 'namespace'],
      oneLine:
        'Container não é uma caixa mágica, é um processo comum com duas etiquetas do kernel: namespace (o que ele enxerga) e cgroup (quanto ele pode consumir).',
      pass1:
        'Do ponto de vista do scheduler, não existe container. Existe processo. O que transforma um punhado de processos em "um container" são dois mecanismos do kernel. Namespace isola a visão: o processo enxerga só a própria árvore de processos, a própria rede, o próprio sistema de arquivos. cgroup (control group) isola o consumo: quanta CPU, quanta memória, quanto I/O aquele grupo pode usar. Todo processo pertence a exatamente um cgroup, e esse cgroup tem um identificador numérico. Guarde esse identificador, ele é a chave que faz o resto da aula funcionar.',
      pass2:
        'A cota de CPU do cgroup funciona por janela. Você declara duas coisas: um **período** (por padrão 100 milissegundos) e uma **quota** dentro desse período. Se o cgroup pede quota de 200ms num período de 100ms, ele pode usar 2 cores cheios. Quando os processos daquele cgroup gastam a quota antes do período acabar, o kernel simplesmente para de escaloná-los até a próxima janela. Esse freio tem nome: **throttling**.\n\nO efeito do throttling é cruel e importante pra esta aula: um processo throttled fica **runnable e sem CPU**, exatamente como um processo que perdeu a CPU pro vizinho. O sintoma no gráfico é o mesmo. A causa é oposta (um é culpa sua, o outro é culpa do vizinho). Guarde essa ambiguidade, o clímax da aula é resolvê-la.\n\nO identificador do cgroup é o que permite atribuir um evento do kernel a um container do seu inventário. O kernel trabalha com PID e cgroup id. Seu dashboard trabalha com "checkout-service, versão 42". Alguém precisa fazer essa tradução, e ela não é grátis.\n\nDetalhe prático: PID é reciclado e some rápido (processo morre, número volta pro pool). cgroup id vive enquanto o container vive. Por isso o cgroup é a chave boa pra agregar métrica, e o PID é só a chave temporária pra correlacionar dois eventos próximos no tempo.',
      pass3: [
        {
          gotcha: 'Achar que container tem kernel próprio',
          note: 'Não tem. Todos os containers de um host dividem o MESMO kernel e o MESMO scheduler. É exatamente por isso que existe vizinho barulhento: o isolamento é de visão e de cota, não de hardware.',
        },
        {
          gotcha: 'Confundir limite com reserva',
          note: 'A quota do cgroup é um teto, não um piso garantido. Ter quota de 2 cores não significa que 2 cores estarão livres quando você precisar. Você pode estar abaixo da quota e mesmo assim esperando.',
        },
        {
          gotcha: 'Usar PID como chave de métrica',
          note: 'PID é reciclado. Um agregador que acumula por PID mistura dois processos diferentes num mesmo bucket ao longo do dia. Use PID só como chave curta de correlação e agregue por cgroup.',
        },
      ],
      anchor:
        'Você sobe dois containers no mesmo servidor. O que exatamente o kernel faz de diferente com os processos de cada um?',
      followup:
        'Se a cota é um teto e não uma reserva, o que acontece com o seu container quando o vizinho decide usar tudo o que sobra?',
      gotcha:
        'Se a sala disser "container é uma VM leve", devolva: "quantos kernels rodam nesse servidor com 30 containers? Um. Então o que exatamente está isolado?"',
      visuals: [
        {
          kind: 'ascii',
          title: 'Um kernel, muitos cgroups',
          art: `  container A        container B        servicos do host
  (cgroup 4711)      (cgroup 4712)      (cgroup 1)
  pid 1201,1202      pid 1330..1420     pid 88, 91, 140
       |                   |                  |
       +---------+---------+------------------+
                 |
         MESMO scheduler, MESMA run queue por core
                 |
              16 cores

  quota do cgroup A: 200ms a cada 100ms  ->  teto de 2 cores
  teto NAO e reserva: os 2 cores podem estar ocupados pelo B`,
          caption:
            'O isolamento é de visão (namespace) e de teto (cgroup). O recurso físico continua compartilhado, e é aí que o vizinho barulhento vive.',
          board:
            'Desenhe as três colunas convergindo pro mesmo scheduler. A seta que junta tudo num ponto só é o argumento inteiro da aula.',
        },
      ],
    },

    // ──────────────── TENANCY: o problema ────────────────
    {
      id: 'maquina-dividida',
      label: 'A máquina que você divide',
      group: 'tenancy',
      beat: 1,
      teachFromZero: true,
      tags: ['multi-tenancy', 'noisy-neighbor', 'bin-packing', 'utilizacao', 'titus'],
      oneLine:
        'Empresa grande empacota vários containers por máquina porque servidor ocioso é dinheiro queimado. O preço é o vizinho barulhento.',
      pass1:
        'A Netflix roda os workloads dela no Titus, uma plataforma multi-tenant: vários containers de times diferentes na mesma máquina física. Isso não é preguiça de arquitetura, é economia. Servidor comprado e ocioso custa igual a servidor comprado e cheio, então o objetivo é empacotar o máximo de trabalho por máquina. O efeito colateral aparece quando um container consome recurso demais e degrada os vizinhos. Esse é o problema do vizinho barulhento, e a primeira coisa que ele quebra não é a performance, é a capacidade de investigar.',
      pass2:
        'O time de performance da Netflix descreve o trabalho deles como uma triagem: quando um serviço fica lento, **a primeira pergunta é se o problema veio da aplicação ou da infraestrutura**. Se veio da aplicação, o dono do serviço investiga o código dele. Se veio da infra, é a plataforma que precisa agir. Errar essa bifurcação custa dias de investigação no lugar errado.\n\nO vizinho barulhento é justamente o caso que embaralha a bifurcação, porque o sintoma aparece inteiro dentro do seu serviço (latência da sua API subiu) e a causa está inteira fora dele (o container ao lado ligou um batch job). O dono do serviço olha o próprio código, não acha nada, e a conversa trava.\n\nCPU é a fonte mais frequente desse problema, segundo o post. Faz sentido: memória tem limite duro (estourou, o kernel mata), disco e rede costumam ter quota mais visível, mas CPU é fungível e disputada instante a instante. Você não "estoura" CPU, você só espera mais.\n\nVale registrar quem mais mora na máquina: além dos containers dos outros times, existem os **serviços do sistema** (agentes de log, coleta de métricas, daemons da plataforma). No caso real que a Netflix mostra, o vizinho barulhento acabou sendo esse grupo, não outro container. Guarde isso, a resposta óbvia nem sempre é a certa.',
      pass3: [
        {
          gotcha: 'Achar que vizinho barulhento é problema de cloud pública',
          note: 'A Netflix roda em instâncias dedicadas da AWS e tem o problema mesmo assim, porque ELA mesma coloca vários containers por instância. O vizinho pode ser do seu próprio time.',
        },
        {
          gotcha: 'Propor "um container por máquina" como solução',
          note: 'Resolve o problema e cria um pior: utilização despenca e o custo multiplica. A meta é empacotar bem, não parar de empacotar. Observabilidade existe pra permitir densidade com segurança.',
        },
        {
          gotcha: 'Esquecer os serviços do sistema',
          note: 'Agentes de log, de métrica e daemons da plataforma competem por CPU com os containers. No incidente do post, foram eles os barulhentos, disparados indiretamente pelo container que encheu a máquina.',
        },
      ],
      anchor:
        'São 10:35. O p99 da sua API dobrou. Ninguém deployou nada, e o gráfico de CPU do seu container está em 20%. Onde você olha primeiro, e por quê?',
      askWho: [
        {
          name: 'open',
          why: 'Beat de abertura e o enunciado do problema. Deixe a sala listar suspeitos (banco, rede, GC, deploy), porque a lista vai omitir exatamente "o vizinho", e essa omissão é o gancho da aula.',
        },
        {
          name: 'Eduardo Hirohito',
          why: 'Perfil de infra mais completo do cohort (scalability, sharding, databases, HTTP 1/2/3). Se ninguém puxar a hipótese de infraestrutura compartilhada, ele é quem tem repertório pra chegar lá.',
        },
        {
          name: 'Maria Clara',
          why: 'Maior breadth do cohort. Boa pra enunciar com clareza a bifurcação "é meu código ou é a plataforma", que é a moldura do beat inteiro.',
        },
      ],
      followup:
        'Você disse que a CPU está em 20%. Que pergunta esse número responde, e que pergunta ele não responde?',
      gotcha:
        'Quando alguém propuser "então é só dar uma máquina inteira pra cada serviço", devolva: "quanto sobe a sua conta da AWS amanhã? E qual era a utilização média antes?"',
      scenarios: {
        right: {
          shape:
            'Levanta a hipótese de recurso compartilhado e nota que 20% de utilização com lentidão é contraditório. Bônus se separa explicitamente "problema no meu código" de "problema na plataforma".',
          redirect:
            'Confirme a bifurcação e aperte: "ótimo, você suspeita da plataforma. Agora prove. Que número no seu dashboard sustenta essa acusação hoje?"',
        },
        close: {
          shape:
            'Vai atrás de banco lento, GC, rede ou dependência externa. Tudo hipótese razoável, mas todas são "dentro do meu serviço" e nenhuma explica a contradição do gráfico.',
          redirect:
            'Puxe pro externo: "suponha que você checou o banco, a rede e o GC, tudo normal. O que mais existe nessa máquina além do seu container?"',
        },
        wayOff: {
          shape:
            'Propõe escalar horizontalmente ou aumentar a quota do container antes de saber a causa, ou conclui que 20% de CPU significa que o problema não é CPU.',
          redirect:
            'Exponha a contradição: "se o problema não é CPU, por que a lentidão sumiu quando o container ao lado terminou o job dele? E o que 20% está medindo, exatamente?"',
        },
      },
    },
    {
      id: 'cpu-mente',
      label: 'CPU em 20% e mesmo assim lento',
      group: 'tenancy',
      beat: 2,
      tags: ['utilizacao', 'saturacao', 'espera', 'use-method', 'load-average'],
      oneLine:
        'Utilização mede quem usou a CPU. Não mede quem quis usar e não conseguiu. O tempo de espera é invisível nesse gráfico.',
      pass1:
        'Utilização de CPU responde uma pergunta só: que fração do tempo os cores ficaram ocupados. É uma medida de quem conseguiu. Ela é cega pra quem tentou e ficou na fila. Um container pode passar o dia inteiro em 20% de utilização e ainda assim ter os processos dele esperando muito, porque cada vez que eles acordam com trabalho pra fazer precisam disputar a CPU com dezenas de processos de outros cgroups. Utilização baixa com latência alta não é contradição, é a assinatura de contenção.',
      pass2:
        'A analogia que gruda é a fila do caixa. **Utilização** é a fração do tempo em que o caixa esteve atendendo alguém. **Saturação** é o tamanho da fila esperando. Um caixa com 60% de utilização e fila de 20 pessoas existe: ele atende rápido e para, atende rápido e para, mas os clientes chegam em rajada. Se você só olha a utilização do caixa, jura que está tudo bem, e os 20 na fila discordam.\n\nO caso do container throttled é o exemplo mais claro. Um container com quota de 2 cores que gasta a quota nos primeiros 30ms de cada janela de 100ms fica parado nos 70ms restantes. Nesses 70ms os processos dele estão runnable e sem CPU. Se você medir utilização sobre o total da máquina, esse container aparece baixo. Ele não está descansando, ele está preso.\n\nLoad average, o número clássico do `uptime`, chega mais perto porque conta os processos runnable, mas tem dois problemas pra este caso: é agregado por máquina inteira (não te diz de qual container é a fila) e vem suavizado em janelas de 1, 5 e 15 minutos, o que apaga picos curtos. Um pico de 131 milissegundos some completamente numa média de 1 minuto.\n\nA regra geral, que vale muito além de CPU: **para todo recurso, meça utilização, saturação e erros**. Utilização sozinha é a métrica mais popular e a mais enganosa, porque ela é a única que fica bonita quando o sistema está sofrendo por espera.',
      pass3: [
        {
          gotcha: 'Ler utilização de container como se fosse da máquina',
          note: 'São bases diferentes. 20% "do meu limite de 2 cores" e 20% "dos 16 cores do host" são números completamente distintos. Muito diagnóstico errado nasce de comparar os dois no mesmo gráfico.',
        },
        {
          gotcha: 'Confiar em load average pra container',
          note: 'É por host, não por cgroup, e é média móvel. Não te diz de quem é a fila nem mostra pico curto. Serve como sinal de "a máquina está apertada", não como prova de quem sofreu.',
        },
        {
          gotcha: 'Achar que utilização baixa exclui CPU do rol de suspeitos',
          note: 'É exatamente o contrário: utilização baixa COM latência alta é o padrão mais típico de contenção ou throttling. É o sinal mais forte de que a espera vale ser medida.',
        },
        {
          gotcha: 'Medir CPU em janela grossa',
          note: 'Uma amostra a cada 60 segundos não enxerga um pico de 131 milissegundos. A granularidade da coleta define o tamanho do problema que você é capaz de ver.',
        },
      ],
      anchor:
        'Utilização de CPU mede o tempo em que os cores estiveram ocupados. Descreva um cenário em que esse número fica baixo e o serviço fica lento pelo mesmo motivo.',
      askWho: [
        {
          name: 'Lorena Garcia',
          why: 'Fez System Design Basics e scalability. Tem o vocabulário de gargalo e de fila pra separar "quanto usei" de "quanto esperei" sem precisar do termo técnico.',
        },
        {
          name: 'Livia Tavares',
          why: 'Estudou Load Balancer, onde a distinção entre capacidade e fila é o assunto central. A analogia do caixa é o mundo dela.',
        },
        {
          name: 'Eduardo Hirohito',
          why: 'Scalability e "20 System Design Concepts". Bom pra puxar a versão formal (utilização, saturação, erros) depois que a sala chegar na intuição.',
        },
      ],
      followup:
        'Se o que interessa é o tempo esperando pela CPU, onde exatamente esse tempo começa e onde ele termina?',
      gotcha:
        'Se alguém disser "então é só olhar o load average", devolva: "load average de qual container? E ele é média de 1 minuto. Um pico de 131 milissegundos aparece nesse número?"',
      scenarios: {
        right: {
          shape:
            'Separa "usou" de "esperou" com um exemplo concreto (throttling, rajada, disputa com outro cgroup) e percebe que utilização é cega pra fila.',
          redirect:
            'Nomeie o que ele achou: "isso tem nome, é saturação. Agora a parte difícil: como você mede o tamanho dessa fila POR CONTAINER?"',
        },
        close: {
          shape:
            'Sente que falta algo e propõe load average, número de threads ou context switches por segundo. Está no bairro certo, mas nenhuma dessas responde "quanto tempo o MEU container esperou".',
          redirect:
            'Aperte a atribuição e a unidade: "load average é da máquina toda e vem em média de minuto. Eu quero tempo, em microssegundos, por container. Que evento marca o começo e o fim dessa espera?"',
        },
        wayOff: {
          shape:
            'Insiste que utilização baixa prova que CPU não é o problema, e migra a investigação pra rede ou banco.',
          redirect:
            'Force a simulação: "o processo acordou pronto pra rodar e a CPU estava ocupada por outro cgroup. Ele aparece nos 20%? Então onde ele aparece?"',
        },
      },
    },

    // ──────────────── METRIC: a métrica certa ────────────────
    {
      id: 'run-queue-latency',
      label: 'A fila que ninguém olha',
      group: 'metric',
      beat: 3,
      teachFromZero: true,
      tags: ['run-queue-latency', 'runnable', 'scheduling-delay', 'fila', 'wakeup'],
      oneLine:
        'Run queue latency é o tempo entre "estou pronto pra rodar" e "recebi a CPU". É a métrica que responde de quem é a culpa.',
      pass1:
        'A Netflix escolheu instrumentar uma métrica por container: **run queue latency**, o tempo que os processos passam na fila de escalonamento antes de serem despachados pra CPU. O nome descreve exatamente o que é. O relógio começa quando o processo fica runnable (acordou, tem trabalho, quer CPU) e para quando o scheduler efetivamente o coloca num core. Se esse número está alto enquanto o container nem chegou perto da própria cota de CPU, você tem evidência de que alguém de fora está atrapalhando. Essa é a frase que destrava a conversa entre o time do serviço e o time da plataforma.',
      pass2:
        'Repare no que essa métrica tem e as outras não: ela é **por container e em unidade de tempo**. Não é uma porcentagem agregada da máquina, é "os processos do checkout-service esperaram X microssegundos". Isso serve direto pra conversa com o dono do serviço, porque X microssegundos de espera na fila viram X microssegundos a mais na latência da API dele.\n\nA condição que transforma o número em acusação é a combinação: **espera alta com consumo abaixo da cota**. Se o container está usando tudo o que tem direito, esperar é normal e esperado, é a fila dele mesmo. Se ele está usando 20% do que tem direito e ainda assim espera, o tempo dele está sendo comido por processos de outro cgroup.\n\nA escala é a parte que impressiona. No servidor saudável do post, o p99 de run queue latency de um container sozinho ficou em **83,4 microssegundos**, com picos ocasionais até 400 microssegundos. Isso é ruído, invisível pra qualquer usuário. Quando subiram um segundo container que ocupou todos os cores, o p99 do primeiro pulou pra **131 milissegundos**, ou seja, 131 mil microssegundos. É um fator de mais de 1500 vezes, e nessa faixa qualquer requisição HTTP servida por aquele container sente.\n\nO conceito é mais geral do que Linux. Toda vez que existe um recurso disputado, existe um tempo entre "pedi" e "fui atendido", e esse tempo quase nunca é medido. Vale pra pool de conexões do banco, pra fila de threads de um servidor web, pra consumidor de fila de mensagens. A pergunta "quanto tempo esperando?" é a pergunta que falta em quase todo dashboard.',
      pass3: [
        {
          gotcha: 'Confundir com tempo bloqueado em I/O',
          note: 'Esperar o disco responder é sleeping, não runnable, e não entra nessa conta. Run queue latency mede só o tempo em que o processo poderia trabalhar e não recebeu CPU. Misturar os dois transforma problema de banco em acusação de vizinho.',
        },
        {
          gotcha: 'Achar que espera alta prova vizinho barulhento',
          note: 'Não prova. Throttling do próprio cgroup produz exatamente o mesmo gráfico. A métrica sozinha é ambígua, e desfazer essa ambiguidade é o clímax da aula.',
        },
        {
          gotcha: 'Medir em milissegundos',
          note: 'O baseline saudável é da ordem de dezenas de microssegundos. Um histograma com bucket mínimo de 1ms joga o dia inteiro no primeiro bucket e você perde toda a resolução do normal.',
        },
        {
          gotcha: 'Somar em vez de distribuir',
          note: 'Tempo total de espera cresce com o número de processos e com o tempo de observação. A grandeza que se compara entre containers e entre dias é a distribuição por evento, não a soma.',
        },
      ],
      anchor:
        'Um processo do seu container acorda pronto pra rodar às 10:35:02,000 e só recebe CPU às 10:35:02,131. Que nome você dá pra esses 131 milissegundos, e o que precisa acontecer no kernel pra você conseguir medi-los?',
      askWho: [
        {
          name: 'Livia Tavares',
          why: 'Load Balancer é a matéria de "chegou, entrou na fila, foi atendido". Ela é a pessoa com mais chance de nomear tempo de espera como métrica de primeira classe, e não como detalhe.',
        },
        {
          name: 'Lorena Garcia',
          why: 'System Design Basics e scalability. Boa pra amarrar o tempo de fila à latência que o usuário final sente, que é o argumento que convence o dono do serviço.',
        },
        {
          name: 'Eduardo Hirohito',
          why: 'Repertório de escala pra generalizar: a mesma métrica existe em pool de conexão, thread pool e consumidor de fila. Chame-o pra tirar o conceito do Linux.',
        },
      ],
      followup:
        'Você vai medir isso milhares de vezes por segundo. Que número você manda pro dashboard: a média dessas esperas ou outra coisa?',
      gotcha:
        'Quando a sala aceitar a métrica rápido demais, devolva: "run queue latency do meu container disparou. Provei que o vizinho é culpado?" (não provou, throttling faz o mesmo gráfico).',
      visuals: [
        {
          kind: 'ascii',
          title: 'Onde o cronômetro começa e onde ele para',
          art: `  processo dormindo
        |
        | chegou o pacote de rede  -> ficou RUNNABLE
        v
      [ t0 ]==========================[ t1 ]
             esperando na run queue          |
             (pronto, sem CPU)               v
                                        RUNNING

  run queue latency = t1 - t0

  saudavel (host tranquilo) : p99 = 83 us
  com vizinho ocupando tudo : p99 = 131.000 us`,
          caption:
            'Dois instantes e uma subtração. Toda a engenharia do resto da aula existe pra capturar t0 e t1 sem custar caro.',
          board:
            'Desenhe a linha do tempo e marque t0 e t1. Escreva os dois p99 embaixo, um do lado do outro, e deixe o contraste falar.',
        },
      ],
      scenarios: {
        right: {
          shape:
            'Chama de tempo de espera na fila do scheduler e percebe que medir exige dois eventos do kernel (ficou pronto, entrou na CPU) e uma subtração.',
          redirect:
            'Confirme e avance pro problema real: "exato, dois carimbos de tempo e uma subtração. Agora: isso acontece milhares de vezes por segundo. Que número você reporta?"',
        },
        close: {
          shape:
            'Entende que é tempo esperando, mas quer medir de fora (amostrar o estado do processo de tempos em tempos) ou olhar quantos processos estão na fila em vez do tempo de cada um.',
          redirect:
            'Puxe a diferença entre tamanho e tempo: "contar quantos estão na fila é uma foto. Eu quero saber quanto TEMPO este processo esperou. Quem sabe a hora exata em que ele entrou e saiu da fila?"',
        },
        wayOff: {
          shape:
            'Propõe medir dentro da aplicação (timestamp no começo e no fim do handler) ou confunde com tempo de resposta do banco.',
          redirect:
            'Mostre o ponto cego: "seu código só roda quando já tem CPU. O tempo que você quer medir é justamente aquele em que o seu código não estava rodando. Quem estava acordado nesse intervalo?"',
        },
      },
    },
    {
      id: 'p99',
      label: 'p99, não média',
      group: 'metric',
      beat: 4,
      tags: ['p99', 'percentil', 'cauda', 'histograma', 'media'],
      oneLine:
        'A média de latência esconde exatamente o evento que dói. Contenção é um fenômeno de cauda, então a métrica precisa ser percentil.',
      pass1:
        'A Netflix emite run queue latency como um **percentile timer**, não como média. O motivo é aritmético: se o container faz milhares de trocas de contexto por segundo e a esmagadora maioria espera microssegundos, alguns eventos de 131 milissegundos somem completamente na média. E são justamente esses que fazem alguma requisição estourar o SLA. Contenção não é uma degradação uniforme, é uma pancada ocasional. Média mede o dia comum. Percentil alto mede o dia que dá problema.',
      pass2:
        'A conta que convence: imagine 10.000 esperas de 80 microssegundos e 100 esperas de 131 milissegundos no mesmo minuto. A média sai perto de 1,4 milissegundo. Se o seu alerta dispara acima de 5 milissegundos, ele fica calado enquanto 100 requisições levaram um tapa de 131ms cada. O **p99** dessa mesma amostra está lá em cima, porque 1% de 10.100 eventos é justamente a região onde os picos moram.\n\nA leitura correta de p99 é literal: **99% dos eventos foram mais rápidos que esse valor, 1% foi mais lento**. Não é "o pior caso" e não é "quase todo mundo está bem". Se o seu serviço faz 20 chamadas internas pra responder uma requisição, a chance dessa requisição encostar no p99 de alguma delas é alta, e por isso a cauda de um componente vira o caso comum do usuário.\n\nComo isso é implementado importa. Guardar todas as amostras pra ordenar depois não escala. O padrão é **histograma com buckets** (contadores por faixa de valor), e o percentil sai da distribuição acumulada. O preço é que o resultado é aproximado, com a precisão limitada pela largura do bucket, e essa é a razão de escolher buckets logarítmicos e começar em microssegundos quando o baseline é de dezenas de microssegundos.\n\nUm cuidado que derruba muita gente em entrevista: **percentil não soma e não faz média**. A média dos p99 de dez hosts não é o p99 da frota. Pra agregar corretamente é preciso somar os histogramas e recalcular, não fazer média dos resultados.',
      pass3: [
        {
          gotcha: 'Tratar p99 como pior caso',
          note: 'p99 é o corte de 1%. Se acontecem 10 mil eventos por segundo, 100 eventos por segundo ficam PIORES que o p99. Pior caso é o máximo, que é outra métrica e costuma ser puro ruído.',
        },
        {
          gotcha: 'Tirar média de percentis',
          note: 'p99 de A e p99 de B não formam o p99 de A+B. Isso quebra dashboard de frota inteira. Agregue somando os histogramas e recalculando o corte.',
        },
        {
          gotcha: 'Bucket com resolução errada',
          note: 'Baseline de 83 microssegundos com bucket mínimo de 1 milissegundo joga tudo no primeiro bucket. Você perde a capacidade de ver o normal degradar antes de virar incidente.',
        },
        {
          gotcha: 'Achar que percentil alto é sempre problema',
          note: 'Cauda existe em todo sistema saudável. O que importa é o p99 comparado ao baseline DELE, não a um número absoluto universal. Por isso o post começa estabelecendo os 83 microssegundos.',
        },
      ],
      anchor:
        'A média de run queue latency do container ficou em 1 milissegundo o dia inteiro, e mesmo assim o time reclamou de lentidão intermitente. Explique como as duas coisas são verdade ao mesmo tempo.',
      askWho: [
        {
          name: 'Maria Clara',
          why: 'Maior breadth do cohort e base de matemática. É quem tem mais chance de formalizar por que uma cauda pequena move pouco a média e muito o percentil.',
        },
        {
          name: 'Lorena Garcia',
          why: 'System Design Basics costuma cobrir SLA e latência de cauda. Boa pra ligar p99 do componente à experiência do usuário final.',
        },
        {
          name: 'Leunam Sousa',
          why: 'Especialista de caching, onde a conversa de hit rate e cauda de latência é diária. Bom pra puxar "o caso raro é o que o usuário lembra".',
        },
      ],
      followup:
        'Beleza, você sabe o que medir e como reportar. Agora o problema de verdade: quem carimba a hora exata em que o processo entrou e saiu da fila?',
      gotcha:
        'Se alguém propuser "então usa o máximo", devolva: "o máximo de um minuto com 600 mil eventos é um evento. Você vai acordar o plantão por causa de um outlier?"',
      scenarios: {
        right: {
          shape:
            'Explica que poucos eventos muito lentos não movem a média mas dominam a cauda, e propõe percentil (p99 ou p999) como a métrica de alerta.',
          redirect:
            'Confirme e cutuque a agregação: "certo. E se você tem 3 mil hosts, como você calcula o p99 da frota inteira a partir dos p99 de cada um?" (não calcula, precisa somar histogramas).',
        },
        close: {
          shape:
            'Percebe que a média esconde picos mas propõe o máximo, ou propõe percentil sem saber explicar como calcular sem guardar todas as amostras.',
          redirect:
            'Empurre pra implementação: "máximo é um evento só, puro ruído. E pra calcular percentil sem guardar 600 mil números por minuto, que estrutura você usa?"',
        },
        wayOff: {
          shape:
            'Sugere aumentar a janela de agregação pra "estabilizar" o gráfico, ou conclui que a média baixa prova que não há problema.',
          redirect:
            'Inverta: "janela maior deixa o gráfico mais liso e o pico mais invisível. Você quer suavizar justamente o evento que te acordou de madrugada?"',
        },
      },
    },

    // ──────────────── PROBE: como medir ────────────────
    {
      id: 'medir-sem-estragar',
      label: 'Medir sem estragar o que se mede',
      group: 'probe',
      beat: 5,
      teachFromZero: true,
      tags: ['observer-effect', 'hot-path', 'perf', 'ebpf', 'verifier'],
      oneLine:
        'Instrumentar o scheduler é entrar no caminho mais quente do kernel. eBPF existe porque a alternativa é escolher entre não medir e degradar o que você mede.',
      pass1:
        'A ideia de medir toda troca de contexto tem um problema óbvio: trocas de contexto acontecem milhares de vezes por segundo, por core, o dia inteiro. Qualquer código que você coloque nesse ponto é executado nessa frequência. Ferramentas tradicionais de análise, como o `perf`, conseguem fazer isso mas com overhead que a Netflix descreve como significativo, com risco de degradar ainda mais um sistema que já está sofrendo. E tem o problema de tempo: essas ferramentas normalmente são acionadas depois do incidente, quando o pico já passou. eBPF resolve os dois: overhead baixo o suficiente pra ficar ligado o tempo todo.',
      pass2:
        '**eBPF é uma máquina virtual dentro do kernel do Linux.** Você escreve um programa pequeno, compila pra um bytecode próprio, e pede pro kernel anexá-lo a um ponto de interesse. A partir daí, toda vez que aquele ponto é atingido, o seu código roda em contexto de kernel, sem context switch e sem cópia de dados pra userspace.\n\nO que torna isso aceitável é o **verifier**. Antes de aceitar o programa, o kernel prova estaticamente que ele termina (nada de loop não limitado), que não acessa memória fora do permitido e que não deixa o kernel em estado inválido. É por isso que dá pra rodar código de terceiros dentro do kernel em produção sem derrubar a máquina. Programa que não passa no verifier simplesmente não é carregado.\n\nOs pontos de anexação usados aqui são **tracepoints do scheduler**, marcadores estáveis que o próprio kernel expõe em eventos como "processo virou runnable" e "a CPU trocou de processo". A variante moderna, `tp_btf`, entrega ponteiros pras estruturas reais do kernel, o que dá acesso a informação rica (inclusive o cgroup do processo) sem cópia intermediária.\n\nO ponto que fecha o beat: **isto é um hot path e o orçamento é em nanossegundos**. A Netflix construiu uma ferramenta própria, o bpftop, só pra medir o custo do próprio código eBPF, e chegou a menos de 600 nanossegundos por hook. Pra dar dimensão, um context switch inteiro custa alguns microssegundos, então a instrumentação fica na casa de poucos por cento do evento que ela observa. Em teste com um serviço Java em container, a diferença com a instrumentação ligada e desligada não foi mensurável em milissegundos.',
      pass3: [
        {
          gotcha: 'Achar que eBPF é um módulo de kernel',
          note: 'Módulo roda código nativo sem rede de proteção e um bug derruba a máquina. eBPF roda numa VM verificada. É essa verificação que permite ligar em produção sem plano de rollback de kernel.',
        },
        {
          gotcha: 'Ignorar o efeito observador',
          note: 'Instrumentação em hot path é parte do sistema, não um espectador. Um coletor pesado num host contendido vira ele mesmo o vizinho barulhento e piora o incidente que veio investigar.',
        },
        {
          gotcha: 'Instrumentar só durante o incidente',
          note: 'O pico dura milissegundos e a investigação começa horas depois. Sem baseline contínuo você não tem com o que comparar. Os 83 microssegundos só existem porque a coleta estava ligada antes.',
        },
        {
          gotcha: 'Confiar que o verifier garante correção',
          note: 'Ele garante segurança de memória e terminação, não que a sua lógica está certa nem que o custo é baixo. Overhead é medido, não deduzido, e foi pra isso que o bpftop existe.',
        },
      ],
      anchor:
        'Você quer medir TODA troca de processo, em toda máquina da frota, o dia inteiro, em produção. Antes de pensar em como, diga o que pode dar errado nesse plano.',
      askWho: [
        {
          name: 'open',
          why: 'eBPF ninguém no cohort estudou, e não precisa: o efeito observador se deduz. Abra e deixe a sala chegar em "medir vai custar CPU". Quem enunciar isso sozinho ganhou o beat.',
        },
        {
          name: 'Eduardo Hirohito',
          why: 'Maior repertório de infra e escala. Depois que a sala levantar o custo, ele é quem consegue estimar a ordem de grandeza (quantos eventos por segundo, quanto orçamento sobra por evento).',
        },
        {
          name: 'Maria Clara',
          why: 'Maior breadth. Boa pra formalizar o trade-off entre cobertura contínua e amostragem pontual, que é a decisão de fundo deste beat.',
        },
      ],
      followup:
        'Suponha que você tem um jeito barato de rodar código dentro do kernel. Em que momentos exatos você quer ser avisado pra conseguir a sua subtração?',
      gotcha:
        'Se a sala achar barato demais, devolva: "600 nanossegundos por evento parece nada. Multiplica por 500 mil eventos por segundo. Quanto de um core isso é?"',
      visuals: [
        {
          kind: 'ascii',
          title: 'Onde o seu código roda',
          art: `  USERSPACE     agente Go            <- le eventos ja prontos
  ------------  ^ ring buffer  -------------------------------
  KERNEL        |
                | seu programa eBPF (verificado)
                |     roda AQUI, no evento, sem context switch
                v
            [ tracepoint do scheduler ]
            sched_wakeup / sched_switch

  orcamento por evento: < 600 ns
  custo de um context switch: alguns microssegundos`,
          caption:
            'O programa roda dentro do kernel, no próprio evento. Nada de acordar processo, nada de syscall por amostra.',
          board:
            'Desenhe a linha horizontal separando kernel e userspace, e coloque o programa embaixo dela. Quase todo mundo desenha instrumentação em cima, e é aí que a ficha cai.',
        },
      ],
      scenarios: {
        right: {
          shape:
            'Levanta o efeito observador (o coletor consome o recurso que mede) e nota que a frequência do evento é o que define o orçamento por amostra.',
          redirect:
            'Confirme e dê o número: "a Netflix chegou em menos de 600 nanossegundos por hook, e construiu uma ferramenta só pra medir isso. Agora: onde no kernel você se pendura?"',
        },
        close: {
          shape:
            'Preocupa-se com volume de dados e custo de armazenamento, mas não com o custo de CPU no momento da coleta. Ou propõe amostrar de tempos em tempos e perde os picos.',
          redirect:
            'Traga pro instante da coleta: "antes do armazenamento, o custo é na hora. E se você amostra a cada 10 segundos, o que acontece com um pico de 131 milissegundos?"',
        },
        wayOff: {
          shape:
            'Propõe instrumentar dentro da aplicação, ou ligar o profiler só quando houver reclamação, ou logar cada troca de contexto em arquivo.',
          redirect:
            'Mostre o furo: "logar cada troca de contexto é escrever milhares de linhas por segundo por core. Quem paga esse I/O? E o profiler ligado depois pega o pico de ontem?"',
        },
      },
    },
    {
      id: 'dois-hooks-um-mapa',
      label: 'Dois hooks e um mapa',
      group: 'probe',
      beat: 6,
      tags: ['sched-wakeup', 'sched-switch', 'bpf-map', 'hash-map', 'timestamp'],
      oneLine:
        'sched_wakeup grava o timestamp num hash map com o PID como chave. sched_switch busca esse timestamp e subtrai. É o padrão "tabela de horários de entrada".',
      pass1:
        'A implementação é mais simples do que o assunto sugere, e é um padrão que você já usou. Três tracepoints entram na história: `sched_wakeup` e `sched_wakeup_new` disparam quando um processo passa de dormindo pra pronto, e `sched_switch` dispara quando a CPU troca de processo. No wakeup você pega o relógio do kernel e guarda numa tabela, indexada pelo PID. No switch você olha quem está entrando na CPU, busca o timestamp daquele PID na tabela, subtrai do relógio atual e apaga a entrada. A diferença é a run queue latency.',
      pass2:
        'A estrutura de dados é um **BPF map**, a memória compartilhada entre o programa no kernel e o mundo de fora. Aqui o tipo escolhido foi hash map, chave de 32 bits (o PID), valor de 64 bits (o timestamp em nanossegundos). É literalmente um dicionário `pid -> instante em que ficou pronto`.\n\nNo wakeup a operação é uma escrita com a flag de "só insira se não existir". Isso importa: um processo pode receber vários eventos de wakeup antes de rodar, e o relógio que interessa é o do **primeiro**, o instante em que ele ficou pronto. Sobrescrever com o wakeup mais recente encurtaria artificialmente a espera medida e esconderia justamente o caso ruim.\n\nNo switch, o tracepoint entrega ponteiros pra duas tarefas: a que está saindo da CPU e a que está entrando. Você usa o PID da que está **entrando** pra fazer o lookup. Se não achar nada na tabela, você simplesmente ignora o evento: aquele processo entrou na CPU sem ter passado por um wakeup que você observou (o programa pode ter sido carregado no meio do caminho). Achou, calcula a diferença e apaga a chave. **Apagar não é higiene, é sobrevivência**: PID nasce e morre o tempo todo, e um mapa que só cresce estoura o tamanho máximo e passa a rejeitar inserções em silêncio.\n\nA escolha do tipo de mapa foi medida, não adivinhada, e os números são um ótimo exemplo de otimização guiada por dado. Hash map comum foi o mais rápido. `TASK_STORAGE`, que parece a escolha natural por associar dado direto à tarefa, ficou quase duas vezes mais lento. `LRU_HASH`, que resolveria a preocupação de crescimento descartando entradas velhas sozinho, custou 40 a 50 nanossegundos a mais por operação, e num orçamento de 600 nanossegundos isso é quase 10%. A decisão final foi ficar com o hash comum e aumentar o tamanho máximo pra absorver a rotatividade de PIDs.',
      pass3: [
        {
          gotcha: 'Sobrescrever o timestamp a cada wakeup',
          note: 'Vale o PRIMEIRO wakeup. Usar o último mede só o último trecho da espera e some com o pico. Por isso a inserção usa a flag de "não sobrescreva".',
        },
        {
          gotcha: 'Esquecer de apagar a chave',
          note: 'Sem o delete no switch, o mapa cresce até o limite e passa a falhar em silêncio. O sintoma é traiçoeiro: a métrica não some, ela fica boa demais, porque só os eventos antigos continuam sendo casados.',
        },
        {
          gotcha: 'Usar o PID de quem está saindo',
          note: 'O switch entrega os dois lados. A espera que terminou é a de quem está ENTRANDO na CPU. Trocar os dois inverte a métrica e nem sempre gera número absurdo, o que faz o bug sobreviver.',
        },
        {
          gotcha: 'Assumir que todo switch tem um wakeup casado',
          note: 'Vai faltar par: o programa foi carregado no meio, ou o processo foi preemptado e voltou sem novo wakeup. Trate o lookup vazio como "ignore", nunca como zero, senão você despeja zeros no histograma e afunda o p99.',
        },
      ],
      anchor:
        'O kernel te avisa em dois momentos: quando o processo fica pronto pra rodar, e quando a CPU troca de processo. Só com esses dois avisos, monte o algoritmo que calcula quanto tempo cada processo esperou.',
      askWho: [
        {
          name: 'Rayssa Guedes',
          why: 'Cobertura REAL de hashing: implementou hashmap do zero, fez hash functions, hash tables e Consistent Hashing. Este beat é exatamente um hash map de chave PID com insert, lookup e delete num caminho crítico. É o beat dela, comece por ela.',
        },
        {
          name: 'Lorena Garcia',
          why: 'Binary Search e BST, além de databases. Boa pra puxar o lado do ciclo de vida da entrada (quando insere, quando apaga) e o que acontece quando a tabela enche.',
        },
        {
          name: 'Leunam Sousa',
          why: 'Especialista de caching (invalidation, estratégias, Redis). O mapa de PIDs é um cache com problema de expiração, então ele é a âncora natural pra "e quem limpa isso?".',
        },
      ],
      followup:
        'Funciona. Agora você tem centenas de milhares desses eventos por segundo querendo sair do kernel. Como eles chegam no seu programa lá fora?',
      gotcha:
        'Quando fecharem o algoritmo, pergunte: "e o processo que morreu antes de ganhar a CPU? A entrada dele fica no mapa até quando?"',
      visuals: [
        {
          kind: 'ascii',
          title: 'Insere no wakeup, subtrai no switch',
          art: `  sched_wakeup(pid=1201)
      map[1201] = 10:35:02.000000000        insere se nao existir

           ... processo espera na run queue ...

  sched_switch(prev=98, next=1201)
      t0 = map[1201]            lookup
      lat = agora - t0          131.000.000 ns
      delete map[1201]          libera a chave

  lookup vazio  ->  ignora o evento, NUNCA reporta zero`,
          caption:
            'Um dicionário PID para timestamp, com insert num tracepoint e lookup mais delete no outro. O padrão vale pra qualquer par "começou / terminou".',
          board:
            'Escreva as duas chamadas em cima e embaixo, com a fila no meio. Depois pergunte quem apaga a chave, e deixe a sala descobrir o vazamento sozinha.',
        },
      ],
      scenarios: {
        right: {
          shape:
            'Propõe uma tabela PID para timestamp, escreve no wakeup, lê e subtrai no switch usando a tarefa que está entrando, e lembra de remover a entrada.',
          redirect:
            'Confirme e cutuque os casos de borda: "e se chegarem dois wakeups antes de rodar? E se o switch não achar a chave?" (primeiro wakeup vale, lookup vazio se ignora).',
        },
        close: {
          shape:
            'Chega na ideia dos dois pontos e da subtração, mas guarda em lista ou não pensa em remover, ou usa o PID de quem está saindo da CPU.',
          redirect:
            'Puxe a estrutura e o ciclo de vida: "busca por PID em lista é O(n) num caminho executado 500 mil vezes por segundo. Que estrutura resolve isso, e quando a entrada some?"',
        },
        wayOff: {
          shape:
            'Propõe varrer periodicamente o estado dos processos (estilo `/proc`) pra ver quem está runnable, em vez de reagir aos eventos.',
          redirect:
            'Ataque a amostragem: "varrer a cada 100 milissegundos enxerga uma espera de 83 microssegundos? E quanto custa varrer 400 processos, 10 vezes por segundo?"',
        },
      },
    },
    {
      id: 'coletor-nao-come-cpu',
      label: 'O coletor não pode comer a CPU',
      group: 'probe',
      beat: 7,
      tags: ['rate-limit', 'sampling', 'ring-buffer', 'early-exit', 'overhead'],
      oneLine:
        'Emitir todo evento fez o processo em userspace consumir CPU demais. A correção foi limitar a taxa dentro do kernel, antes de gerar o dado.',
      pass1:
        'O programa funcionava e mesmo assim quebrou a promessa. O volume de eventos era tão grande que o programa em userspace, que só lia e agregava, passou a consumir CPU demais. Ou seja: a ferramenta de detectar vizinho barulhento estava virando o vizinho barulhento. A correção tem três partes, e todas seguem o mesmo princípio: **jogue o dado fora o mais cedo possível, e mova o mínimo de bytes**. Rate limit dentro do kernel, saída por ring buffer e desistência antecipada pros eventos que não interessam.',
      pass2:
        '**Rate limit no kernel.** Antes de montar o evento, o programa consulta um segundo mapa que guarda, por cgroup e por CPU, o instante do último evento emitido. Se passou menos que o intervalo mínimo, o evento é descartado ali mesmo, sem gerar nada. Repare no desenho: a chave é por cgroup, não global. Isso preserva a representatividade de cada container, e um container muito ativo não afoga a amostragem dos outros. É amostragem com atribuição preservada, e é a diferença entre "descartei 90% dos eventos" e "perdi 90% dos containers".\n\n**Ring buffer pra sair do kernel.** O caminho de saída é um buffer circular compartilhado entre kernel e userspace. O programa reserva espaço, escreve o registro no lugar e confirma. O leitor lê direto dessa memória. Não tem cópia intermediária, não tem uma syscall por evento, e o buffer aceita registros de tamanho variável. O evento em si é minúsculo: cgroup de quem entrou, cgroup de quem saiu, a latência e o timestamp.\n\n**Desistir cedo.** Os tracepoints do scheduler também disparam pras tarefas internas do kernel, identificáveis pelo PID 0. Elas passam pela fila como qualquer processo, mas monitorá-las não serve pro objetivo. O programa checa isso antes de tocar em qualquer mapa, porque acesso a mapa é a operação cara. A regra que sai daqui: **em hot path, ordene as condições da mais barata pra mais cara**, e saia no primeiro "não interessa".\n\nDuas otimizações menores fecham o quadro e mostram o nível de detalhe. Ler campos da estrutura do kernel pelo helper portável custava 20 a 30 nanossegundos por chamada, e com tracepoints do tipo `tp_btf` dá pra acessar os campos direto, com segurança. E o acesso ao cgroup precisa acontecer dentro de uma seção protegida (um lock de leitura do kernel), o que é feito chamando funções do próprio kernel a partir do programa eBPF. Nada disso é firula: cada nanossegundo aqui é multiplicado por centenas de milhares de eventos por segundo.',
      pass3: [
        {
          gotcha: 'Fazer rate limit em userspace',
          note: 'Se o evento já foi montado e atravessou o buffer, você já pagou o custo inteiro. Descarte precisa acontecer antes de gerar o dado, senão o rate limit só economiza a parte barata.',
        },
        {
          gotcha: 'Rate limit global em vez de por cgroup',
          note: 'Um único container muito ativo consumiria toda a cota de amostragem e os outros sumiriam do dashboard. A chave da amostragem tem que ser a mesma dimensão pela qual você agrega.',
        },
        {
          gotcha: 'Ler amostragem como métrica exata',
          note: 'Com rate limit, o percentil é estimado sobre uma fração dos eventos. Serve pra detectar e comparar, e não serve pra contar quantas vezes exatamente aconteceu.',
        },
        {
          gotcha: 'Checar a condição cara primeiro',
          note: 'Buscar no mapa e depois descobrir que era tarefa do kernel paga o custo à toa. Comparação de inteiro é quase de graça, acesso a mapa não é. A ordem das condições é a otimização.',
        },
      ],
      anchor:
        'Seu programa no kernel funciona, mas o processo em userspace que lê os eventos começou a comer CPU sozinho. Você virou o vizinho barulhento. Onde você corta, e por quê aí?',
      askWho: [
        {
          name: 'Livia Tavares',
          why: 'Load Balancer é onde rate limiting e proteção de capacidade aparecem primeiro. Ela tem o modelo mental de "descarte na entrada, não no fim da fila", que é a resposta exata do beat.',
        },
        {
          name: 'Leunam Sousa',
          why: 'Caching e invalidação: decidir o que guardar, o que descartar e com que chave é a matéria dele. A escolha de limitar por cgroup e não global é uma decisão de chave.',
        },
        {
          name: 'Messias Olivindo',
          why: 'WebSockets crash course, onde a conversa de conexão viva e de buffer que enche já apareceu. Bom pra puxar a parte do ring buffer e o que acontece quando o consumidor não dá conta.',
        },
      ],
      followup:
        'O evento saiu do kernel com um número de cgroup. Seu dashboard mostra nomes de serviço. Quem faz essa ponte, e o que ela pode quebrar?',
      gotcha:
        'Se propuserem amostrar 1 a cada N eventos globalmente, devolva: "um container faz 90% dos eventos da máquina. Quantas amostras sobram pros outros doze?"',
      visuals: [
        {
          kind: 'ascii',
          title: 'A ordem das perguntas é a otimização',
          art: `  sched_switch dispara
        |
        v
  next.pid == 0 ?  ------- sim -> return   (comparacao de inteiro, ~0 ns)
        | nao
        v
  achou t0 no mapa ? ----- nao -> return   (1 lookup)
        | sim
        v
  passou RATE_LIMIT_NS
  desde o ultimo evento
  DESTE cgroup ?  -------- nao -> return   (1 lookup, descarta aqui)
        | sim
        v
  reserva no ring buffer, escreve 32 bytes, submit

  barato primeiro, caro depois. cada saida antecipada e lucro.`,
          caption:
            'Quatro linhas de guarda antes de qualquer trabalho real. O descarte acontece antes de o evento existir, e não depois de ele atravessar o buffer.',
          board:
            'Desenhe a escada de guardas com as saídas laterais. Pergunte o que muda se você inverter a primeira com a terceira, e o custo aparece sozinho.',
        },
      ],
      scenarios: {
        right: {
          shape:
            'Propõe amostrar ou limitar taxa AINDA no kernel, antes de montar o evento, e percebe que a chave do limite deve ser o cgroup pra não perder containers silenciosos.',
          redirect:
            'Confirme e traga o preço: "certo. E o que você perde quando amostra? Que perguntas essa métrica deixa de responder?" (contagem exata, sim; detecção e comparação, não).',
        },
        close: {
          shape:
            'Quer reduzir volume mas resolve do lado de fora (agregar em userspace, aumentar o buffer, escalar o coletor) ou propõe amostragem global 1 em N.',
          redirect:
            'Empurre o descarte pra trás: "se o evento já saiu do kernel, o custo já foi pago. Onde é o ponto mais cedo possível pra dizer não? E se a amostragem for global, quem some do gráfico?"',
        },
        wayOff: {
          shape:
            'Propõe desligar a coleta quando a máquina estiver carregada, ou mover o agente pra outra máquina.',
          redirect:
            'Mostre o paradoxo: "você desliga a medição justamente quando o problema acontece. E o evento nasce dentro deste kernel. Como ele chega na outra máquina sem passar por aqui?"',
        },
      },
    },

    // ──────────────── ATTRIB: de quem é a culpa ────────────────
    {
      id: 'cgroup-cardinalidade',
      label: 'De quem é a CPU: cgroup e cardinalidade',
      group: 'attrib',
      beat: 8,
      tags: ['cgroup-id', 'atribuicao', 'tag', 'cardinalidade', 'series-temporal'],
      oneLine:
        'O kernel fala PID e cgroup. O dashboard fala nome de serviço. Essa tradução é o que transforma um número em acusação, e é onde a cardinalidade explode.',
      pass1:
        'Latência de fila sem dono não serve pra nada. Pra virar uma conversa entre times, cada amostra precisa carregar de quem ela é. O programa no kernel resolve isso pegando o identificador do cgroup direto da estrutura da tarefa, tanto de quem entra na CPU quanto de quem sai. O agente em userspace traduz esse número pro container correspondente naquele host. Quando não existe container associado, ele classifica como serviço do sistema. E aí vem a parte que dá a resposta: como o evento carrega também o cgroup de quem estava na CPU antes, a métrica pode ser etiquetada com a **causa** da preempção.',
      pass2:
        'A ponte tem duas pontas e uma delas é local. O kernel só conhece números; o inventário de "cgroup 4711 é o checkout-service versão 42" mora no agente, que conhece os containers daquele host. Isso é uma decisão de arquitetura: a tradução acontece na borda, o mais perto possível da origem, e o que sobe pra rede já vai nomeado. Traduzir no centro exigiria mandar identificadores crus e resolver depois, com um catálogo global sempre desatualizado.\n\nAs métricas que saem são duas. `runq.latency`, o percentil de espera do container. E `sched.switch.out`, um contador de quantas vezes processos daquele container foram tirados da CPU. Esse segundo é etiquetado com o cgroup anterior, o que permite classificar cada preempção em três casos: **outro processo do mesmo container**, **outro container** ou **um serviço do sistema**. É essa etiqueta que transforma "estou sofrendo" em "estou sofrendo por causa daquilo ali".\n\nAgora o preço, e ele é a parte que cai em entrevista. Cada combinação distinta de etiquetas vira uma **série temporal** separada no backend de métricas, com custo próprio de armazenamento, de ingestão e de consulta. Isso é **cardinalidade**. Etiquetar por container já multiplica bastante. Etiquetar por container mais causa da preempção multiplica de novo. Etiquetar por PID seria catastrófico, porque PID é reciclado e efetivamente ilimitado ao longo do dia: cada PID novo cria uma série nova que nunca mais recebe um ponto.\n\nA regra prática: **etiqueta boa tem conjunto de valores pequeno, estável e que alguém vai usar pra filtrar**. Container passa. Causa da preempção, com três valores, passa com folga. PID, requisição, usuário e timestamp não passam, e por isso essas dimensões vivem em log ou trace, não em métrica.',
      pass3: [
        {
          gotcha: 'Agregar por PID',
          note: 'PID é reciclado e some. Como etiqueta, cria série infinita e derruba o backend; como chave de agregação, mistura processos diferentes no mesmo bucket. Serve só como chave curta de correlação dentro do kernel.',
        },
        {
          gotcha: 'Traduzir cgroup para nome no centro',
          note: 'O mapeamento é local e muda a cada container que sobe ou morre. Resolver longe da origem exige catálogo global e produz métrica órfã sempre que o container já morreu quando o dado chegou.',
        },
        {
          gotcha: 'Achar cardinalidade um problema de custo apenas',
          note: 'É também de latência de consulta e de confiabilidade. Um dashboard que precisa varrer milhões de séries demora ou falha exatamente durante o incidente, quando você mais precisa dele.',
        },
        {
          gotcha: 'Perder o cgroup anterior',
          note: 'Sem saber quem estava na CPU antes, você sabe que sofreu e não sabe de quem. Metade do valor da instrumentação está nesse segundo campo, que o tracepoint entrega de graça.',
        },
      ],
      anchor:
        'Você tem a latência de espera, e ela nasceu de um PID. O dashboard precisa mostrar por container, e o alerta precisa dizer quem causou. Como o número atravessa essa ponte, e o que explode se você exagerar nas etiquetas?',
      askWho: [
        {
          name: 'Rayssa Guedes',
          why: 'Fez Consistent Hashing e hash functions, então a conversa de "qual é a chave e quantos valores ela tem" é a dela. Cardinalidade é literalmente o tamanho do espaço de chaves.',
        },
        {
          name: 'Lorena Garcia',
          why: 'databases e System Design Basics. Boa pra ver série temporal como tabela indexada e entender por que uma coluna de alta cardinalidade destrói o índice.',
        },
        {
          name: 'Eduardo Hirohito',
          why: 'sharding e scalability. Âncora pra ligar cardinalidade a custo de armazenamento e de consulta na frota inteira, e pra defender a tradução na borda.',
        },
      ],
      followup:
        'Agora você tem espera com dono e com causa. Se o gráfico de espera de um container dispara, já dá pra acusar o vizinho?',
      gotcha:
        'Quando propuserem etiquetar com mais uma dimensão, pergunte: "quantos valores diferentes essa etiqueta tem num mês? Multiplica pelas outras. Quantas séries você acabou de criar?"',
      scenarios: {
        right: {
          shape:
            'Propõe agregar por cgroup traduzido pra container no agente local, guarda também o cgroup anterior pra atribuir causa, e levanta o limite de cardinalidade das etiquetas.',
          redirect:
            'Confirme e teste o limite: "e se eu quiser saber qual REQUISIÇÃO sofreu a espera? Isso vira etiqueta?" (não vira, isso é trace, não métrica).',
        },
        close: {
          shape:
            'Chega no cgroup como chave certa mas esquece de guardar quem estava na CPU antes, ou não vê problema em etiquetar com PID e com hostname junto.',
          redirect:
            'Puxe a causa e o custo: "você sabe que sofreu. De quem foi a CPU? E quantas séries nascem se cada PID virar etiqueta num host que cria mil processos por hora?"',
        },
        wayOff: {
          shape:
            'Quer mandar cada evento cru pro backend e agregar na consulta, ou resolver o nome do container depois, num serviço central.',
          redirect:
            'Faça a conta com ele: "500 mil eventos por segundo por host, vezes 3 mil hosts. Quantos pontos por segundo chegam no backend? E quem sabe o nome do container que morreu há dez minutos?"',
        },
      },
    },
    {
      id: 'duas-metricas',
      label: 'Uma métrica mente, duas contam a verdade',
      group: 'attrib',
      beat: 9,
      tags: ['throttling', 'ambiguidade', 'correlacao', 'sched-switch-out', 'diagnostico'],
      oneLine:
        'Espera alta tem duas causas opostas: o vizinho comeu sua CPU, ou você bateu na própria cota. Só a segunda métrica separa as duas.',
      pass1:
        'Este é o clímax da aula e a parte que o post faz questão de destacar. Olhar só `runq.latency` leva a diagnóstico errado. Quando um container encosta na própria cota de CPU, o kernel para de escaloná-lo, e a espera na fila dispara. O gráfico fica idêntico ao de um container preemptado pelo vizinho. A conclusão apressada é acusar a plataforma quando a verdade é que o serviço precisa de mais quota. A segunda métrica, o contador de preempções etiquetado com quem estava na CPU antes, é o que desempata: **espera alta junto de preempções causadas por outro cgroup é vizinho barulhento; espera alta sozinha é cota.**',
      pass2:
        'Vale desenhar as duas histórias lado a lado, porque elas produzem a mesma linha subindo.\n\n**História A, throttling.** O container gasta a quota nos primeiros milissegundos da janela. O kernel o congela até a janela virar. Os processos ficam runnable e sem CPU, então a espera medida dispara. Mas ninguém tirou nada dele: não há preempção causada por terceiro. O contador de preempções por outro cgroup fica parado. O tratamento é aumentar a quota ou otimizar o serviço.\n\n**História B, vizinho.** O container está longe da cota. Mesmo assim, sempre que seus processos ficam prontos, encontram os cores ocupados por processos de outro cgroup. A espera dispara E o contador de preempções por outro cgroup dispara junto. O tratamento é da plataforma: mudar o empacotamento, isolar, mexer na política de CPU.\n\nNo caso real do post, o desfecho tem uma ironia útil. Subiram um segundo container que ocupou todos os cores da máquina, e o p99 do primeiro pulou de 83 microssegundos pra 131 milissegundos. Mas o contador apontou que a maior parte das preempções veio de **processos do sistema**, não do container novo. A leitura: o container novo encheu a máquina, e isso fez os serviços do host (que também precisam de CPU) competirem muito mais. **A causa direta e a causa raiz não são a mesma coisa**, e a métrica te dá a direta. A raiz continua sendo trabalho de investigação humana.\n\nO padrão generaliza e é o que vale levar pra entrevista: quando um sintoma tem mais de uma causa possível, **procure a segunda métrica que só se move em uma delas**. Latência alta de API pode ser fila ou processamento lento, e o que separa é o tempo de fila medido separadamente. Cache com hit rate baixo pode ser cache pequeno ou tráfego novo, e o que separa é a taxa de eviction. Uma métrica descreve. Duas diagnosticam.',
      pass3: [
        {
          gotcha: 'Acusar o vizinho com uma métrica só',
          note: 'Throttling e preempção produzem o mesmo gráfico de espera. Sem o contador de preempções por causa, você tem 50% de chance de mandar o time errado investigar.',
        },
        {
          gotcha: 'Confundir causa direta com causa raiz',
          note: 'No caso do post, quem preemptou foram serviços do sistema. Quem provocou foi o container que encheu a máquina. A métrica aponta o dedo pro executor, não pro instigador.',
        },
        {
          gotcha: 'Correlacionar séries com granularidade diferente',
          note: 'Espera vem de amostragem com rate limit; preempção é contador. Comparar em janelas diferentes gera coincidência falsa. Alinhe a janela antes de concluir qualquer coisa.',
        },
        {
          gotcha: 'Esquecer o caso "eu mesmo"',
          note: 'A preempção pode vir de outro processo do MESMO container. Isso não é vizinho nem cota, é concorrência interna, e o tratamento é no seu próprio código. São três casos, não dois.',
        },
      ],
      anchor:
        'A run queue latency do container disparou. Antes de acusar o vizinho, qual outra explicação produz exatamente esse mesmo gráfico, e que segunda métrica separa as duas?',
      askWho: [
        {
          name: 'open',
          why: 'É o clímax e a resposta se deduz do que já foi ensinado (a cota do cgroup apareceu nas foundations e no beat 2). Abra e deixe a sala achar a ambiguidade sozinha. Quem lembrar do throttling ganhou a aula.',
        },
        {
          name: 'Maria Clara',
          why: 'Maior breadth do cohort. Se a sala travar, ela é quem consegue enunciar a ideia geral de "sintoma com duas causas precisa de um discriminante", que é a regra que a aula quer deixar.',
        },
        {
          name: 'Livia Tavares',
          why: 'Load Balancer: a diferença entre "a fila cresceu porque chegou mais gente" e "a fila cresceu porque o atendente parou" é o mesmo par de histórias. Boa pra fechar com a analogia.',
        },
      ],
      followup:
        'Você tem as duas métricas nascendo dentro do kernel de milhares de máquinas. Desenha o caminho inteiro até virar um alerta na tela de alguém.',
      gotcha:
        'Se cravarem "vizinho" de primeira, devolva: "seu container está em 100% da própria cota. Quem está te atrapalhando?" (ninguém, é a cota).',
      visuals: [
        {
          kind: 'ascii',
          title: 'Mesmo gráfico, duas causas',
          art: `                    runq.latency    sched.switch.out
                    (espera)         por OUTRO cgroup
                    ------------     -----------------
  throttling da
  propria cota          SOBE              parado

  vizinho
  barulhento            SOBE               SOBE

  concorrencia
  interna               SOBE          parado (mas sobe
                                      no MESMO cgroup)

  a coluna da esquerda e igual nos tres. quem decide e a direita.`,
          caption:
            'A primeira métrica diz que dói. A segunda diz de quem é a culpa. Sozinha, a primeira manda o time errado investigar.',
          board:
            'Desenhe a tabela com a coluna da esquerda toda igual. O silêncio quando a sala percebe que a coluna 1 não distingue nada é o momento da aula.',
        },
      ],
      scenarios: {
        right: {
          shape:
            'Lembra do throttling do próprio cgroup como explicação alternativa e propõe uma segunda métrica que só se move quando há preempção por terceiro.',
          redirect:
            'Confirme e adicione o terceiro caso: "faltou um. E se quem me preemptou foi outro processo do MEU container?" (concorrência interna, tratamento no próprio código).',
        },
        close: {
          shape:
            'Sente que falta contexto e propõe cruzar com utilização de CPU do host ou com a utilização do vizinho. Ajuda, mas é indireto e não atribui a causa evento a evento.',
          redirect:
            'Puxe pra atribuição direta: "utilização do host alta te dá suspeita, não prova. O tracepoint já te entrega quem estava na CPU antes. Como você usa isso?"',
        },
        wayOff: {
          shape:
            'Conclui direto que é vizinho e parte pra ação (migrar o container, aumentar a máquina), ou propõe alertar em qualquer pico de espera.',
          redirect:
            'Force o contraexemplo: "o container está batendo na própria cota o dia inteiro. Migrar ele de máquina resolve? O que o gráfico de espera parece nesse caso?"',
        },
      },
    },

    // ──────────────── PIPELINE: o desenho completo ────────────────
    {
      id: 'arquitetura',
      label: 'Arquitetura: do tracepoint ao alerta',
      group: 'pipeline',
      beat: 10,
      tags: ['agent', 'daemonset', 'ingest', 'tsdb', 'alerta', 'read-path'],
      oneLine:
        'O caminho de escrita nasce dentro do kernel de cada host e afunila até um banco de séries temporais. O de leitura vai na direção oposta e tem outro perfil.',
      pass1:
        'Hora de juntar tudo num desenho. Do lado da escrita, o evento nasce no scheduler, é filtrado e amostrado dentro do kernel, atravessa o ring buffer, é traduzido e agregado por um agente que roda em cada host, e sobe pra um backend de séries temporais (na Netflix, o Atlas). Do lado da leitura, alguém abre um dashboard ou uma regra de alerta dispara, e a consulta vai do painel pro backend, que varre séries e devolve percentis. São dois caminhos com perfis opostos, e reconhecer essa assimetria é metade da resposta numa entrevista de system design.',
      pass2:
        '**Caminho de escrita.** Cinco estágios, cada um reduzindo volume. (1) O tracepoint dispara, na casa de centenas de milhares de vezes por segundo por host. (2) As guardas no kernel descartam tarefa do kernel, evento sem par e evento fora da cota de amostragem. (3) O que sobreviveu vira um registro pequeno no ring buffer. (4) O agente local, um processo por host, lê do buffer, traduz cgroup pra nome de container, e **agrega em janela** (um histograma de latência e contadores por container, não um ponto por evento). (5) Só o resultado agregado sobe pela rede, em intervalo fixo. A redução total é de várias ordens de grandeza, e ela acontece de propósito o mais cedo possível: filtrar no kernel é mais barato que filtrar no agente, que é mais barato que filtrar depois da rede.\n\n**Onde o estado mora.** No kernel, dois mapas pequenos e efêmeros (PID para timestamp, cgroup para último envio). No agente, o inventário local de containers e o histograma da janela atual, tudo em memória e descartável (se o agente reinicia, você perde uma janela, não o histórico). O único estado durável é o backend de séries temporais. Reconhecer o que é descartável define quanta confiabilidade cada pedaço precisa.\n\n**Caminho de leitura.** O painel pede "p99 de espera do checkout-service na última hora", ou a regra de alerta faz a mesma pergunta a cada minuto. O backend resolve as séries pelas etiquetas, agrega e devolve. O perfil é o oposto do write path: poucas consultas, cada uma tocando muitos pontos, com tolerância a latência bem maior. É por isso que os dois lados não podem ser dimensionados pela mesma métrica de carga.\n\n**O que acontece quando quebra.** Se o agente cai, aquele host fica cego, e os outros seguem. Se a rede pro backend cai, o agente pode manter um buffer curto em memória e depois desistir, porque métrica antiga tem valor decrescente e segurar dados até estourar a memória do host transformaria o coletor no próximo incidente. **Nesse pipeline, descartar é uma decisão de projeto, não uma falha.**',
      pass3: [
        {
          gotcha: 'Mandar evento cru pra rede',
          note: 'Centenas de milhares de eventos por segundo por host, vezes milhares de hosts, saturam qualquer ingestão. A agregação tem que acontecer no host, antes da rede.',
        },
        {
          gotcha: 'Um agente central em vez de um por host',
          note: 'O evento nasce dentro do kernel local e o mapeamento cgroup para container é local. Centralizar exige mandar dado cru e resolver nome com catálogo desatualizado, o pior dos dois mundos.',
        },
        {
          gotcha: 'Dimensionar leitura e escrita juntos',
          note: 'Escrita é volume alto e constante. Leitura é volume baixo e em rajada, e explode durante incidente, justo quando a escrita também está no pico. São dois problemas distintos.',
        },
        {
          gotcha: 'Bufferizar indefinidamente quando o backend cai',
          note: 'Buffer sem teto no host transforma falha de observabilidade em falha de produção. Teto pequeno mais descarte explícito, sempre.',
        },
      ],
      anchor:
        'Uma troca de contexto acontece agora, num host qualquer da frota. Desenha CADA camada que esse evento atravessa até virar um alerta na tela de alguém. Depois desenha o caminho de volta, o da consulta.',
      askWho: [
        {
          name: 'Eduardo Hirohito',
          why: 'O perfil de infra mais completo do cohort: scalability, sharding, databases, HTTP 1/2/3. É quem desenha o pipeline inteiro sem travar e quem consegue separar write path de read path com vocabulário próprio.',
        },
        {
          name: 'Maria Clara',
          why: 'Maior breadth. Forte pra puxar onde o estado mora em cada estágio e o que é descartável, que é a pergunta que separa desenho bonito de desenho operável.',
        },
        {
          name: 'Livia Tavares',
          why: 'Load Balancer. Âncora natural pra camada de ingestão: como milhares de agentes distribuem carga no backend e o que acontece quando todos tentam reenviar ao mesmo tempo.',
        },
      ],
      followup:
        'Diagrama no quadro. Pra cada caixa, qual managed service da AWS, e o que te obriga a escolher esse e não o outro?',
      gotcha:
        'Quando o desenho ficar pronto, aponte pra seta que sai do host e pergunte: "o backend caiu por 20 minutos. O que acontece com essa seta, e quem paga a conta?"',
      visuals: [
        {
          kind: 'ascii',
          title: 'Write path e read path',
          art: `  WRITE PATH  (por host, volume caindo a cada estagio)

  tracepoint  ~500k ev/s
      |  guardas + rate limit no kernel
      v
  ring buffer  ~alguns mil ev/s
      |  agente local: cgroup -> nome, agrega em janela
      v
  1 histograma + contadores por container, a cada 30s
      |  rede
      v
  [ backend de series temporais ]  <---- estado duravel


  READ PATH  (poucas consultas, cada uma toca muitos pontos)

  dashboard / regra de alerta
      |  "p99 de checkout-service na ultima hora"
      v
  [ backend de series temporais ]
      |
      v
  alerta -> plantao`,
          caption:
            'Cinco estágios de redução na escrita, um salto só na leitura. Perfis opostos, e por isso escalados separadamente.',
          board:
            'Desenhe a escada descendo com os volumes anotados em cada degrau. A queda de 500 mil pra um histograma a cada 30 segundos é o argumento da agregação na borda.',
        },
      ],
      scenarios: {
        right: {
          shape:
            'Desenha agente por host, agregação local antes da rede, backend de séries temporais como único estado durável, e separa explicitamente o caminho de consulta.',
          redirect:
            'Confirme e teste a falha: "backend fora por 20 minutos. O que o agente faz com os dados nesse período?" (buffer curto e descarte, nunca crescimento sem teto).',
        },
        close: {
          shape:
            'Desenha o fluxo principal certo mas manda evento por evento pra rede, ou esquece o caminho de leitura, ou trata o agente como opcional.',
          redirect:
            'Aperte o volume e o retorno: "500 mil eventos por segundo vezes 3 mil hosts chegando no backend. Cabe? E depois de tudo armazenado, quem faz a pergunta, e como?"',
        },
        wayOff: {
          shape:
            'Propõe um serviço central que consulta os hosts sob demanda, ou salvar os eventos em log e processar depois em batch.',
          redirect:
            'Ataque o tempo de detecção: "o pico dura 131 milissegundos. Um batch que roda de hora em hora detecta isso? E consultar 3 mil hosts sob demanda durante o incidente custa o quê pra eles?"',
        },
      },
    },
    {
      id: 'aws',
      label: 'AWS: cada caixa, um managed service',
      group: 'cloud',
      beat: 11,
      tags: ['ec2', 'fargate', 'daemonset', 'amp', 'firehose', 'managed-grafana'],
      oneLine:
        'O perfil de carga escolhe o serviço, não a familiaridade. E aqui tem uma restrição dura: sem acesso ao kernel do host, essa aula inteira não roda.',
      pass1:
        'Mapeando caixa por caixa. O agente precisa rodar em cada host, com privilégio pra carregar programas eBPF, o que significa **EC2** (via ECS ou EKS com o agente como daemon por nó), e não Fargate nem Lambda. A ingestão de métrica agregada vai pro **Amazon Managed Service for Prometheus** (AMP), que é o equivalente gerenciado mais próximo do Atlas. Painel e alerta ficam no **Amazon Managed Grafana**, com notificação via **SNS**. Se você quiser guardar amostras cruas pra análise posterior, aí sim entra **Kinesis Data Firehose** despejando em **S3**, e consulta ocasional via **Athena**.',
      pass2:
        '**Compute, e a restrição que decide tudo.** eBPF exige carregar programa no kernel do host, com capacidades privilegiadas. No **Fargate** e no **Lambda** você não tem o host, e essa é a razão técnica de fundo: o modelo de isolamento deles roda cada tarefa numa fronteira de microVM, e o kernel não é seu pra instrumentar. Então: **EC2**, com ECS ou EKS por cima, e o agente como daemon por nó (um por host, exatamente o desenho do beat anterior). O detalhe bonito é que no Fargate você não tem esse problema porque não tem vizinho no mesmo kernel, e paga por isso em densidade e em preço por vCPU. A decisão "instância cheia de containers" versus "isolamento por tarefa" é a mesma decisão de sempre entre utilização e blast radius.\n\n**Ingestão e armazenamento de métrica.** **AMP** é a escolha padrão: nasceu pra séries temporais com etiquetas, o modelo de dados bate exatamente com o do beat 8, e o custo é por amostra ingerida e por consulta, o que dá um preço explícito pra cardinalidade. **CloudWatch Metrics** é a alternativa mais integrada, mas cobra por métrica customizada e por dimensão, e nesse esquema alta cardinalidade fica cara rápido. **Timestream** aguenta o volume mas o modelo de consulta é SQL, distante do que dashboards de observabilidade esperam.\n\n**Visualização e alerta.** **Amazon Managed Grafana** consulta o AMP direto, e as regras de alerta vivem ali ou no próprio AMP (com Alertmanager gerenciado). O alerta sai por **SNS** pro plantão. Nada exótico, e é justamente o ponto: o read path é volume baixo, então não precisa de nada especial.\n\n**O caminho de dado cru, quando precisa.** Se o time quiser guardar amostras individuais pra investigação profunda, não passe isso pelo backend de métrica. **Firehose** aceita alta taxa de ingestão, faz buffer por tempo ou tamanho, e entrega em **S3** particionado. **Athena** consulta sob demanda, e você paga por consulta em vez de manter índice quente. Perfil oposto ao das métricas: escrita alta, leitura rara, latência de consulta irrelevante.\n\n**A regra que fecha:** olhe o perfil de carga antes do catálogo de serviços. Escrita contínua e alta com leitura por etiqueta pede banco de série temporal. Escrita alta com leitura rara pede fila mais objeto barato. Processo que precisa viver junto do kernel do host pede EC2 e elimina serverless da conversa antes de qualquer comparação de preço.',
      pass3: [
        {
          gotcha: 'Propor Fargate ou Lambda pro agente',
          note: 'Sem acesso ao kernel do host, não existe eBPF. É uma restrição de capacidade, não de custo, e elimina a opção antes de qualquer comparação de preço.',
        },
        {
          gotcha: 'Mandar amostra crua pro CloudWatch',
          note: 'A cobrança é por métrica customizada e por dimensão. Enviar por evento, ou etiquetar com dimensão de alta cardinalidade, gera fatura que cresce mais rápido que a frota.',
        },
        {
          gotcha: 'Um agente por container em vez de um por nó',
          note: 'A instrumentação é do kernel do host e enxerga todos os cgroups de uma vez. Um agente por container multiplica o overhead e ainda coleta dado redundante.',
        },
        {
          gotcha: 'Usar o mesmo caminho pra métrica e pra dado cru',
          note: 'São perfis opostos. Métrica agregada quer índice por etiqueta e leitura rápida. Amostra crua quer ingestão barata e leitura rara. Forçar um caminho só deixa os dois ruins.',
        },
      ],
      anchor:
        'Você vai montar esse pipeline na AWS. Pra cada caixa do desenho, escolha um managed service e diga o que te OBRIGA a escolher esse e não o outro.',
      askWho: [
        {
          name: 'Rayssa Guedes',
          why: 'Fez "AWS do Zero: Os Únicos Serviços que Você Precisa Conhecer". É quem tem o catálogo na cabeça pra mapear caixa a serviço com fluência e começar o beat sem travar.',
        },
        {
          name: 'Eduardo Hirohito',
          why: 'Infra completa (scalability, sharding, databases). Forte pra cravar a restrição do EC2 versus Fargate e pra justificar a separação entre o caminho de métrica e o de dado cru.',
        },
        {
          name: 'Leunam Sousa',
          why: 'Especialista de caching e de estratégias de armazenamento. Âncora pra escolher entre banco de série temporal quente e objeto barato em S3 pelo perfil de leitura.',
        },
      ],
      followup:
        'Quais dessas escolhas mudariam se o sistema fosse o oposto, escrita rara e leitura constante?',
      gotcha:
        'Se alguém propuser Fargate, devolva: "carrega um programa eBPF no kernel do host de uma task Fargate. Qual host?"',
      visuals: [
        {
          kind: 'ascii',
          title: 'Caixa a caixa',
          art: `  kernel + agente por no      EC2 (ECS ou EKS), daemon por no
                              Fargate/Lambda: impossivel, sem kernel

  metrica agregada            Amazon Managed Service for Prometheus
                              alt: CloudWatch (caro por dimensao)

  painel e alerta             Amazon Managed Grafana  ->  SNS

  amostra crua (opcional)     Kinesis Firehose -> S3 -> Athena
                              escrita alta, leitura rara`,
          caption:
            'Uma restrição dura (kernel do host) e três decisões por perfil de carga. Nenhuma delas é por familiaridade.',
          board:
            'Escreva as quatro linhas e circule a primeira. Ela não é um trade-off, é um corte: elimina serverless antes da conversa começar.',
        },
      ],
      scenarios: {
        right: {
          shape:
            'Crava EC2 pela restrição de kernel, escolhe banco de série temporal gerenciado pra métrica, Grafana gerenciado pro painel, e separa o caminho de dado cru se mencionar um.',
          redirect:
            'Confirme e inverta: "e se fosse escrita rara e leitura constante? O que muda?" (some a necessidade de agregação na borda, e o custo migra pra leitura).',
        },
        close: {
          shape:
            'Escolhe serviços razoáveis mas justifica por familiaridade ("já usei"), ou não vê que Fargate está descartado por capacidade e não por preço.',
          redirect:
            'Force a justificativa pelo perfil: "esquece o que você já usou. Qual característica DESSA carga escolhe o serviço? E o agente precisa de quê que o Fargate não tem?"',
        },
        wayOff: {
          shape:
            'Propõe Lambda pro agente, ou um RDS pra guardar as métricas, ou monta tudo em EC2 sem serviço gerenciado nenhum.',
          redirect:
            'Ataque o modelo de dado: "métrica é escrita contínua, append-only, consultada por etiqueta e por janela de tempo. Isso parece uma tabela relacional com índice B-tree pra você?"',
        },
      },
    },

    // ──────────────── SYNTHESIS ────────────────
    {
      id: 'synthesis',
      label: 'Uma métrica sozinha te faz culpar a pessoa errada',
      group: 'synthesis',
      tags: ['discriminante', 'saturacao', 'efeito-observador', 'amostragem', 'atribuicao'],
      oneLine:
        'A aula inteira é uma investigação de responsabilidade, e todo passo dela reaparece em problema que não tem nada a ver com Linux.',
      pass1:
        'O que a Netflix construiu não foi uma ferramenta de Linux, foi um método. Escolher a métrica que responde a pergunta certa (espera, não uso). Reportar na estatística que enxerga o evento raro (percentil, não média). Medir sem virar parte do problema (orçamento de nanossegundos, descarte na origem). Carregar atribuição junto do número (cgroup, não PID). E, no fim, aceitar que um número sozinho é ambíguo e procurar o segundo que desempata. Nenhum desses passos depende de eBPF.',
      pass2:
        '**Utilização engana, saturação denuncia.** Todo recurso disputado tem uma fila, e o tempo nessa fila quase nunca está no dashboard. Pool de conexões do banco, thread pool do servidor, consumidor de fila de mensagens, GPU compartilhada: em todos, a pergunta "quanto tempo esperando?" é mais informativa que "quanto por cento ocupado?".\n\n**Quem mede faz parte do sistema.** Instrumentação em caminho quente é código de produção com orçamento de custo explícito. Isso vale pra log em loop apertado, pra tracing distribuído sem amostragem, pra query de monitoramento que roda a cada segundo. A pergunta a fazer sempre: quantas vezes por segundo isso executa, e quanto de máquina isso é?\n\n**Descarte cedo e com a chave certa.** Amostrar é normal, e amostrar mal apaga justamente quem estava quieto. A chave da amostragem tem que ser a mesma dimensão pela qual você agrega, senão você economiza volume e perde os casos que importam.\n\n**Etiqueta é chave, e chave tem cardinalidade.** O que você pendura na métrica define o custo e a velocidade da consulta. Poucos valores, estáveis e usados pra filtrar. O resto vive em log ou trace.\n\n**A regra que fecha a aula:** quando um sintoma tem mais de uma causa possível, uma métrica descreve e duas diagnosticam. Procure a segunda métrica que só se move em uma das histórias. É isso que separa "está lento" de "está lento por causa daquilo", e é a diferença entre abrir um incidente e resolver um.',
      pass3: [
        {
          gotcha: 'Sair daqui achando que o assunto é eBPF',
          note: 'eBPF é o instrumento. O assunto é medir espera, atribuir responsabilidade e desambiguar com uma segunda métrica. Em entrevista, quem só fala da ferramenta perde o ponto.',
        },
        {
          gotcha: 'Achar que o método precisa de kernel',
          note: 'O mesmo raciocínio se aplica a fila de mensagens, pool de conexão e thread pool, tudo em espaço de aplicação. O que muda é onde fica o cronômetro.',
        },
        {
          gotcha: 'Confundir detectar com resolver',
          note: 'A métrica identifica o vizinho. Resolver ainda exige mudar empacotamento, isolamento ou política de CPU. Observabilidade compra decisão informada, não conserto automático.',
        },
      ],
      anchor:
        'Fora do Linux, cite um sistema que você conhece onde existe uma fila invisível e ninguém mede o tempo de espera nela.',
      followup:
        'Nesse sistema que você citou, qual seria a segunda métrica que desempata entre duas causas do mesmo sintoma?',
      gotcha:
        'Feche com a pergunta que amarra tudo: "seu serviço está lento. Você tem um número que prova de quem é a culpa, ou só um que prova que dói?"',
    },
  ],
  glossary: [
    {
      title: 'O problema',
      terms: [
        {
          term: 'Multi-tenancy',
          definition:
            'Vários inquilinos (containers de times diferentes) rodando na mesma máquina física, pra aproveitar o hardware. É o que torna o vizinho barulhento possível.',
        },
        {
          term: 'Noisy neighbor (vizinho barulhento)',
          definition:
            'Container ou serviço do sistema que consome recurso demais e degrada a performance dos vizinhos na mesma máquina, sem que eles tenham mudado nada.',
        },
        {
          term: 'cgroup',
          definition:
            'Mecanismo do kernel Linux que agrupa processos e limita quanto de CPU, memória e I/O aquele grupo pode consumir. Todo container é um cgroup, com um id numérico.',
        },
        {
          term: 'Throttling',
          definition:
            'O kernel para de escalonar os processos de um cgroup que já gastou a quota de CPU da janela atual. Produz espera alta com causa interna, não externa.',
        },
      ],
    },
    {
      title: 'A métrica',
      terms: [
        {
          term: 'Run queue',
          definition:
            'Fila por core com os processos que estão prontos pra rodar e aguardam a vez. O scheduler escolhe dela quem ocupa a CPU em seguida.',
        },
        {
          term: 'Run queue latency',
          definition:
            'Tempo entre o processo ficar pronto pra rodar (runnable) e efetivamente receber CPU. É a métrica central da aula. Baseline saudável no post: 83 microssegundos de p99.',
        },
        {
          term: 'Utilização x saturação',
          definition:
            'Utilização é a fração do tempo em que o recurso esteve ocupado. Saturação é o quanto de trabalho ficou esperando. Utilização baixa com latência alta é assinatura de saturação.',
        },
        {
          term: 'p99',
          definition:
            'Valor abaixo do qual ficam 99% das amostras. Enxerga a cauda que a média apaga. Percentis não podem ser somados nem promediados entre hosts.',
        },
      ],
    },
    {
      title: 'A instrumentação',
      terms: [
        {
          term: 'eBPF',
          definition:
            'Máquina virtual dentro do kernel do Linux que roda programas verificados em pontos de interesse, com overhead baixo o bastante pra ficar ligada em produção.',
        },
        {
          term: 'Verifier',
          definition:
            'Componente do kernel que prova, antes de carregar, que o programa eBPF termina e não acessa memória indevida. É o que permite rodar código de terceiros no kernel.',
        },
        {
          term: 'Tracepoint',
          definition:
            'Ponto de instrumentação estável exposto pelo próprio kernel. Aqui interessam sched_wakeup (ficou pronto) e sched_switch (a CPU trocou de processo).',
        },
        {
          term: 'BPF map',
          definition:
            'Estrutura de dados compartilhada entre o programa no kernel e o mundo de fora. Nesta aula, um hash map de PID para timestamp e outro de cgroup para último envio.',
        },
        {
          term: 'Ring buffer',
          definition:
            'Buffer circular compartilhado que leva eventos do kernel pro userspace sem cópia extra e sem uma syscall por evento.',
        },
        {
          term: 'Cardinalidade',
          definition:
            'Número de combinações distintas de etiquetas de uma métrica. Cada combinação vira uma série temporal com custo próprio. Etiquetar por PID ou por requisição explode o backend.',
        },
      ],
    },
  ],
};
