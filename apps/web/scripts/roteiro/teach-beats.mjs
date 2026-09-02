// Camada de ensino por beat.
//
// O arquivo .ts da licao guarda o roteiro de QUEM CONDUZ: pergunta-ancora,
// quem chamar, cenarios de resposta. Este arquivo guarda o que falta pra
// alguem pouco tecnica conseguir CHEGAR nesse ponto:
//
//   doZero   a ideia do beat explicada sem jargao, com analogia. E a primeira
//            coisa a ler de cada beat, antes do texto original.
//   erro     a armadilha especifica de QUEM APRESENTA, nao do aluno. Coisas
//            que soam certas e estao erradas.
//   faq      o que a turma provavelmente pergunta, com a resposta. Aqui mora
//            de proposito conteudo que NAO entra na aula: e o material que
//            permite responder em vez de travar.
//   testeSe  recall ativo. Pergunta com resposta escondida. Tentar lembrar
//            antes de ver a resposta fixa muito mais do que reler.

export const TEACH = {
  // ============================================================ FOUNDATIONS
  'f-scheduler': {
    doZero: [
      'Um servidor tem poucos núcleos e centenas de programas querendo rodar. Como todo mundo parece rodar ao mesmo tempo se cada núcleo só faz uma coisa por vez? Porque alguém troca de tarefa muito rápido, centenas de milhares de vezes por segundo.',
      'Esse alguém é o **scheduler**. Ele dá uma fatia de tempo pra um processo, e quando a fatia acaba, guarda tudo o que aquele processo estava fazendo e coloca outro no lugar.',
      'O que você precisa levar deste bloco é a diferença entre dois estados. Um processo **dormindo** pediu algo de fora (disco, rede) e está bloqueado esperando: a culpa é de quem ele está esperando. Um processo **runnable** tem tudo o que precisa e só falta a vez na CPU: aí sim pode ser contenção. A aula inteira mede o segundo caso.',
    ],
    erro: 'Não diga que o scheduler "divide a CPU igualmente". Ele considera prioridade e quanto cada processo já consumiu. E principalmente: ele não garante um mínimo pra ninguém, o que é a raiz do problema da aula.',
    faq: [
      {
        q: 'Se o context switch custa caro, por que o sistema faz tanto?',
        a: 'Porque a alternativa é pior. Sem troca, um programa que trava a máquina inteira até terminar. A troca é o preço de manter todo mundo respondendo. O kernel já tenta evitar trocas desnecessárias justamente porque elas custam.',
      },
      {
        q: 'Mais núcleos não resolveria o problema da fila?',
        a: 'Dilui, não zera. Cada núcleo tem a própria fila. Se o total de processos prontos passa o total de núcleos, alguém espera. E como você paga por núcleo, a empresa vai naturalmente empacotar mais trabalho até voltar a apertar.',
      },
      {
        q: 'O que exatamente custa num context switch?',
        a: 'Duas coisas. O custo direto é salvar registradores e trocar o mapa de memória. O custo indireto, e frequentemente maior, é que o processo novo entra com os caches da CPU frios, então as primeiras instruções dele são mais lentas. Junto, dá alguns microssegundos.',
      },
      {
        q: 'O Linux escalona processos ou threads?',
        a: 'Threads. O roteiro diz "processo" o tempo todo porque é mais fácil de acompanhar, e a lógica é idêntica. Se um aluno apontar isso, ele está certo, confirme e siga.',
      },
    ],
    testeSe: [
      {
        q: 'Qual a diferença entre um processo dormindo e um processo runnable, e por que ela importa aqui?',
        a: 'Dormindo está bloqueado esperando algo de fora (disco, rede, um lock). Runnable tem tudo o que precisa e só falta CPU. Só o segundo é sintoma de contenção; confundir os dois faz você culpar a plataforma quando o problema era o banco de dados.',
      },
      {
        q: 'Por que 16 núcleos e 400 processos gera fila, sem nada estar quebrado?',
        a: 'Porque cada núcleo executa uma coisa por vez. Com 400 querendo rodar e 16 lugares, 384 esperam neste instante. É aritmética, não defeito.',
      },
    ],
  },

  'f-cgroup': {
    doZero: [
      'Container parece uma caixa fechada, mas não é. Para o kernel, container não existe: existem processos comuns com duas etiquetas.',
      'A primeira etiqueta é o **namespace**, que limita o que aqueles processos conseguem ENXERGAR. A segunda é o **cgroup**, que limita quanto eles podem CONSUMIR de CPU e memória.',
      'A cota de CPU funciona por janela de tempo. Você declara um período (por padrão 100 milissegundos) e quanto pode usar dentro dele. Gastou tudo antes da janela virar? O kernel te congela até a próxima. Isso chama-se **throttling**, e guarde bem, porque o beat 9 depende disso.',
      'E o detalhe que quase todo mundo erra: cota é **teto, não é reserva**. Ter direito a 2 núcleos não significa que existam 2 núcleos livres quando você precisar.',
    ],
    erro: 'Se você disser "container é uma máquina virtual leve", está errado e um aluno técnico vai corrigir. VM tem kernel próprio. Container compartilha o kernel do host. Essa diferença é literalmente a causa do problema da aula.',
    faq: [
      {
        q: 'Então container não isola nada?',
        a: 'Isola bastante: visão (namespace) e consumo (cgroup). O que ele não isola é o hardware físico nem o kernel. Você não consegue ver nem invadir o vizinho, mas consegue atrapalhá-lo disputando os mesmos núcleos.',
      },
      {
        q: 'Por que a cota é teto e não reserva? Não daria pra reservar?',
        a: 'Dá, existe o mecanismo de cpu shares e é possível fixar processos em núcleos específicos (isso chama-se CPU pinning). Mas reservar desperdiça: o núcleo reservado fica ocioso quando o dono não usa. É o mesmo trade-off da aula inteira, utilização contra previsibilidade.',
      },
      {
        q: 'Por que usar cgroup como chave da métrica em vez de PID?',
        a: 'Porque PID é reciclado e morre rápido: um agregador que acumula por PID mistura processos diferentes no mesmo balde ao longo do dia, e cria séries infinitas. O cgroup vive enquanto o container vive. PID serve só como chave temporária de correlação dentro do kernel.',
      },
      {
        q: 'O que acontece se o container estoura a memória em vez da CPU?',
        a: 'Comportamento completamente diferente, e vale citar como contraste: memória tem limite duro, então o kernel mata o processo (o famoso OOM kill). CPU não tem limite duro, ela é disputada instante a instante, e por isso você não "estoura" CPU, você só espera mais. É exatamente por isso que CPU é a fonte mais frequente de vizinho barulhento.',
      },
    ],
    testeSe: [
      {
        q: 'Quantos kernels rodam num servidor com trinta containers?',
        a: 'Um só. Todos compartilham o mesmo kernel e o mesmo escalonador. É por isso que o vizinho barulhento existe.',
      },
      {
        q: 'Um container está com 100% da própria cota. Ele está esperando por causa do vizinho?',
        a: 'Não. Está sendo freado pela própria cota (throttling). O gráfico de espera fica igual ao do vizinho barulhento, e é justamente essa ambiguidade que o beat 9 resolve.',
      },
    ],
  },

  // ============================================================ TEMPORADA 01
  'maquina-dividida': {
    doZero: [
      'Imagine um prédio de apartamentos. Sai muito mais barato que uma casa por família, e o preço é ouvir o vizinho furar a parede às dez da noite. A Netflix faz exatamente isso com servidores.',
      'A plataforma onde os serviços deles rodam chama-se **Titus**, e ela coloca containers de times diferentes na mesma máquina física. Isso não é preguiça de arquitetura, é economia: uma máquina alugada e ociosa custa igual a uma máquina alugada e cheia.',
      'O efeito colateral é o **vizinho barulhento**: um container consome recurso demais e degrada os vizinhos. E a primeira coisa que ele quebra não é o desempenho, é a capacidade de investigar. O sintoma aparece inteiro dentro do seu serviço (a latência da sua API subiu), mas a causa está inteira fora dele.',
      'É por isso que o beat abre com aquele cenário contraditório: o serviço está lento e a CPU do container está em 20%. Contradição aparente é o melhor gancho que existe.',
    ],
    erro: 'Não venda "vizinho barulhento" como algo que só acontece na nuvem pública ou com clientes desconhecidos. A Netflix roda em instâncias dedicadas da AWS e tem o problema mesmo assim, porque ela mesma coloca vários containers por instância. O vizinho pode ser do seu próprio time.',
    fluxoAoVivo: {
      titulo: 'Este beat abre a aula inteira, e no slide ele é bem mais longo que o texto abaixo sugere',
      passos: [
        'A pergunta que puxa tudo, logo na primeira tela: p99 dobrou, ninguém fez deploy, CPU do container em 20%. Ainda sem nenhuma arquitetura explicada.',
        'Um slide ensinando o que é CPU, processo e kernel: vocabulário mínimo, sem o qual a pergunta não tem por onde ser atacada. O último parágrafo dele já encaixa, em uma frase, como a Netflix organiza os servidores (multi-tenancy): não é um slide à parte, é só uma frase a mais.',
        'Um slide ensinando container x VM: por que dividir a máquina cria o risco em primeiro lugar.',
        'Uma pergunta ("quantos dos 400 processos rodam agora?") seguida da revelação de paralelismo x concorrência, com a conexão explícita com o que a turma já estudou.',
        'A volta EXPLÍCITA pra pergunta original: "com o que vocês já sabem agora, onde você olha primeiro?", e deixe a sala tentar de verdade antes de seguir.',
      ],
      onde:
        'O conteúdo dos passos 2, 3 e 4 é o mesmo dos capítulos 00.2 (CPU e núcleos), 00.6 (container) e a distinção de paralelismo/concorrência que aparece no 00.5. Revise aqueles antes da aula: é o trecho mais longo e mais importante de toda a apresentação, porque tudo o que vem depois depende desse vocabulário ter pegado.',
    },
    faq: [
      {
        q: 'Por que não dar uma máquina inteira pra cada serviço?',
        a: 'Resolve o problema e cria um pior. A utilização despenca e o custo multiplica: você passa a pagar por dezenas de máquinas que ficam quase paradas. A meta é empacotar bem, não parar de empacotar. Observabilidade existe justamente pra permitir densidade com segurança.',
      },
      {
        q: 'Como a plataforma decide o que colocar junto?',
        a: 'Isso chama-se bin packing, e é um problema clássico de otimização. Boas plataformas consideram o perfil de carga: evitam juntar dois serviços que picam no mesmo horário, e separam workload sensível a latência de workload em lote. Não entra na aula, mas é ótima resposta se perguntarem.',
      },
      {
        q: 'Só CPU dá vizinho barulhento?',
        a: 'Não, também acontece com memória, disco e rede. Mas CPU é a fonte mais frequente segundo a Netflix, e a razão é boa: memória tem limite duro (estourou, o kernel mata), disco e rede costumam ter cota mais visível. CPU é fungível e disputada instante a instante, e por isso você não estoura, só espera mais.',
      },
      {
        q: 'Existe algum jeito de eliminar isso de vez?',
        a: 'Existe, e o preço é alto: um container por máquina, ou serviços com isolamento por micro-VM como o Fargate. Você troca interferência por custo e densidade. O beat 11 volta nessa mesma escolha.',
      },
      {
        q: 'Se ninguém fez deploy, o problema não pode ser do código?',
        a: 'Pode sim, e vale dizer isso pra sala. Código não mudar não significa carga não mudar: pode ter chegado mais tráfego, um cache pode ter esvaziado, um cliente pode ter mudado o padrão de uso. "Ninguém deployou" reduz a lista de suspeitos, não a zera.',
      },
    ],
    testeSe: [
      {
        q: 'Explique o vizinho barulhento sem usar a palavra "container".',
        a: 'Vários programas de donos diferentes dividem a mesma máquina física. Um deles consome recurso demais e os outros ficam lentos, sem terem mudado nada. Quem sofre olha o próprio código e não acha nada, porque a causa está fora dele.',
      },
      {
        q: 'Por que a empresa aceita conviver com esse problema?',
        a: 'Porque a alternativa (uma máquina por serviço) multiplica o custo. Máquina parada custa igual a máquina cheia, então empacotar é dinheiro. A observabilidade existe pra permitir empacotar sem voar às cegas.',
      },
    ],
  },

  'cpu-mente': {
    doZero: [
      'Este beat desmonta o gráfico em que todo mundo confia. **Utilização** de CPU responde uma pergunta só: que fração do tempo os núcleos ficaram ocupados. Ela mede quem CONSEGUIU usar a CPU, e é completamente cega pra quem tentou e ficou na fila.',
      'A analogia que gruda é a fila do caixa. Utilização é a fração do tempo em que o caixa esteve atendendo alguém. **Saturação** é o tamanho da fila esperando. Um caixa com 60% de utilização e vinte pessoas na fila existe: ele atende rápido e para, atende rápido e para, mas os clientes chegam em rajada. Se você só olha o caixa, jura que está tudo bem. As vinte pessoas discordam.',
      'Por isso utilização baixa junto com latência alta não é contradição. É a assinatura clássica de contenção, e é o sinal mais forte de que vale medir a espera.',
    ],
    erro: 'Cuidado com a base do percentual. "20% do meu limite de 2 núcleos" e "20% dos 16 núcleos da máquina" são números completamente diferentes. Se você misturar os dois na explicação, a sala se perde e com razão.',
    fluxoAoVivo: {
      titulo: 'Depois do compare utilização x saturação, tem mais um slide antes do intervalo',
      passos: [
        'Um slide juntando runnable x sleeping (só o segundo é saturação de verdade) com throttling (a própria cota estourada gera o mesmo efeito de "preso na fila").',
        'Esse slide fecha com uma resposta "mais ou menos" pra pergunta do beat 1: pode ser a própria cota, pode ser o vizinho, e só de olhar não dá pra saber qual. Isso é o gancho pra entrar em métricas.',
      ],
      onde:
        'Conteúdo equivalente ao capítulo 00.5 (scheduler, runnable x sleeping) e 00.6 (cgroup, throttling). Não entregue ainda qual das duas causas é: essa distinção só se resolve de verdade no beat 9, com as duas métricas.',
    },
    faq: [
      {
        q: 'Load average não resolveria?',
        a: 'Chega mais perto, porque ele conta processos prontos pra rodar. Mas falha por dois motivos: é da máquina inteira, então não diz de qual container é a fila; e vem em médias de 1, 5 e 15 minutos, o que apaga completamente um pico de 131 milissegundos.',
      },
      {
        q: 'Por que não medir utilização com mais frequência, tipo a cada segundo?',
        a: 'Ajuda a ver picos, mas não resolve o problema de fundo: mesmo com granularidade perfeita, utilização continua medindo ocupação e não espera. Um container throttled aparece com utilização baixa porque ele literalmente não está usando CPU. Ele está preso, não descansando.',
      },
      {
        q: 'Isso vale pra outros recursos além de CPU?',
        a: 'Vale, e é a generalização mais valiosa da aula. Existe uma receita clássica chamada método USE: pra todo recurso, meça Utilização, Saturação e Erros. Serve pra pool de conexão de banco, thread pool de servidor web, fila de mensagens, GPU compartilhada. A pergunta "quanto tempo esperando?" falta em quase todo painel.',
      },
      {
        q: 'Se utilização engana tanto, por que todo mundo usa?',
        a: 'Porque é fácil de coletar e fácil de entender, e funciona bem pra planejamento de capacidade. O erro não é usá-la, é usá-la sozinha pra diagnosticar. Ela é ótima pra responder "quanto sobra?" e péssima pra responder "por que está lento?".',
      },
    ],
    testeSe: [
      {
        q: 'Descreva um cenário em que a utilização está baixa e o serviço está lento pelo mesmo motivo.',
        a: 'Container throttled: gastou a cota nos primeiros 30ms de uma janela de 100ms e fica congelado nos 70ms restantes. Nesse tempo os processos estão prontos e sem CPU. A utilização medida fica baixa porque ele de fato não está usando CPU, mas ele não está ocioso, está preso.',
      },
      {
        q: 'Qual a diferença de uma frase entre utilização e saturação?',
        a: 'Utilização mede quem conseguiu usar o recurso. Saturação mede quanto trabalho ficou esperando a vez.',
      },
    ],
  },

  // ============================================================ TEMPORADA 02
  'run-queue-latency': {
    doZero: [
      'Se utilização não responde, o que responde? O tempo de espera. A Netflix instrumentou uma métrica por container chamada **run queue latency**: o tempo entre o processo ficar pronto pra rodar e efetivamente receber CPU.',
      'É a senha do banco. O cronômetro começa quando você pega a senha (você já está pronto pra ser atendido) e para quando o painel chama seu número. O que acontece nesse meio não é culpa sua.',
      'Duas coisas fazem essa métrica valer ouro. Ela é **por container**, então serve de evidência numa conversa entre times. E ela é **em unidade de tempo**, não em porcentagem, então X microssegundos de espera viram X microssegundos a mais na latência que o usuário sente.',
      'Os números do artigo dão a dimensão: no servidor tranquilo, o p99 era **83 microssegundos**. Quando subiram um container que ocupou todos os núcleos, saltou pra **131 milissegundos**. Mude a unidade devagar quando falar isso: é mais de mil vezes.',
    ],
    erro: 'Não venda espera alta como prova de vizinho barulhento. Não é. Throttling da própria cota produz o mesmo gráfico. Se você cravar a acusação aqui, o beat 9 perde o efeito e, pior, você ensina um diagnóstico errado.',
    faq: [
      {
        q: 'Qual a diferença entre isso e a latência da minha API?',
        a: 'A latência da API é o total: tempo de fila mais tempo processando mais tempo esperando banco e rede. A run queue latency é só um pedaço dela, o tempo em que o processo queria trabalhar e não tinha CPU. Separar esse pedaço é o que permite dizer de quem é a culpa.',
      },
      {
        q: 'Por que não medir isso dentro da aplicação?',
        a: 'Porque o seu código só roda quando já tem CPU. O tempo que você quer medir é exatamente aquele em que o seu código não estava rodando. Quem estava acordado nesse intervalo era o kernel, então a medição precisa nascer lá.',
      },
      {
        q: 'Isso existe fora do Linux?',
        a: 'O conceito sim, a implementação não. Windows e macOS também têm escalonador e fila. O que é específico do Linux é o eBPF, que permite instrumentar isso barato. Em outros sistemas você depende do que o fornecedor expõe.',
      },
      {
        q: 'E se o processo nunca chegar a rodar?',
        a: 'Aí não existe par pra fechar a conta, e o evento simplesmente não é reportado. É um detalhe importante de implementação, que aparece no beat 6: quando falta o par, você ignora o evento. Reportar zero afundaria o percentil e mentiria pra você.',
      },
      {
        q: 'Esse conceito serve pra alguma coisa fora de CPU?',
        a: 'Serve, e é a melhor generalização pra entrevista. Todo recurso disputado tem um tempo entre "pedi" e "fui atendido", e esse tempo quase nunca está no painel: pool de conexão do banco, fila de threads de um servidor web, consumidor de fila de mensagens. É a mesma métrica com outro nome.',
      },
    ],
    testeSe: [
      {
        q: 'Onde exatamente o cronômetro começa e onde ele para?',
        a: 'Começa quando o processo fica runnable (acordou, tem trabalho, quer CPU) e para quando o escalonador efetivamente o coloca num núcleo. Dois instantes e uma subtração.',
      },
      {
        q: 'Espera alta com consumo abaixo da cota significa o quê?',
        a: 'Que o tempo dele está sendo consumido por processos de outro cgroup. É a combinação que vira evidência, não a espera sozinha.',
      },
      {
        q: 'Qual foi o baseline e qual foi o pico, com as unidades certas?',
        a: '83 microssegundos de p99 no normal; 131 milissegundos no incidente. Mais de mil vezes de diferença.',
      },
    ],
  },

  p99: {
    doZero: [
      'Você tem a métrica certa. Agora: qual número mandar pro painel? A resposta é **percentil**, e não média, e a razão é aritmética.',
      'Faça a conta na frente da sala. Dez mil esperas de 80 microssegundos, mais cem esperas de 131 milissegundos, no mesmo minuto. A média sai perto de 1,4 milissegundo. Se o alerta dispara acima de 5 milissegundos, ele fica calado enquanto cem requisições levaram um tapa enorme.',
      'O **p99** lê literalmente: 99% das medições foram mais rápidas que esse valor, 1% foi mais lento. Numa prova com 100 alunos, é a nota do segundo melhor.',
      'Contenção não é uma degradação uniforme, é uma pancada ocasional. Média mede o dia comum. Percentil alto mede o dia que dá problema.',
    ],
    erro: 'Não chame p99 de "pior caso". É a correção mais comum em entrevista e você não quer ensinar errado. Se acontecem dez mil eventos por segundo, cem por segundo ficam piores que o p99. Pior caso é o máximo, que é outra métrica e costuma ser puro ruído.',
    faq: [
      {
        q: 'Por que não usar o máximo, já que é ele que dói?',
        a: 'Porque o máximo de um minuto com seiscentos mil eventos é um evento só, e pode ser puro ruído: uma pausa de coleta de lixo, uma interrupção de hardware. Você não vai acordar o plantão por causa de um outlier. O percentil descarta o ruído e mantém o padrão.',
      },
      {
        q: 'Como se calcula percentil sem guardar todas as amostras?',
        a: 'Com histograma: em vez de guardar cada medição, você guarda contadores por faixa de valor e tira o corte da distribuição acumulada. O preço é que o resultado é aproximado, limitado pela largura da faixa. Por isso as faixas precisam começar em microssegundos quando o normal é dezenas de microssegundos.',
      },
      {
        q: 'Como eu calculo o p99 da frota inteira a partir do p99 de cada máquina?',
        a: 'Você não calcula. Percentil não soma e não tira média: a média dos p99 de dez máquinas não é o p99 das dez juntas. Pra agregar corretamente é preciso somar os histogramas e recalcular o corte. Esse erro quebra painel de frota em muita empresa.',
      },
      {
        q: 'Por que p99 e não p50 ou p999?',
        a: 'É uma escolha de sensibilidade. p50 (a mediana) descreve o caso típico e ignora o problema. p999 pega ainda mais cauda, mas fica instável com pouco volume, porque poucos eventos definem o corte. p99 é o ponto de equilíbrio mais usado. Em serviços muito críticos usa-se p999 junto.',
      },
      {
        q: 'Se todo sistema tem cauda, quando o p99 é problema?',
        a: 'Quando ele foge do baseline dele, não quando passa de um número universal. É por isso que o artigo começa estabelecendo os 83 microssegundos: sem régua não existe diagnóstico.',
      },
      {
        q: 'Por que a cauda de um componente vira o caso comum do usuário?',
        a: 'Isso chama-se amplificação de cauda. Se atender uma requisição exige vinte chamadas internas, a chance de encostar na cauda de pelo menos uma delas é alta. Um p99 ruim num componente pequeno vira p50 ruim na ponta.',
      },
    ],
    testeSe: [
      {
        q: 'Traduza "p99 = 131ms" em uma frase, sem jargão.',
        a: '99% das esperas foram mais rápidas que 131 milissegundos, e 1% foi mais lenta que isso.',
      },
      {
        q: 'A média ficou em 1ms o dia inteiro e o time reclamou de lentidão. Como as duas coisas são verdade?',
        a: 'Porque poucos eventos muito lentos quase não movem a média, mas dominam a cauda. As requisições que caíram nesses eventos sentiram muito, e elas não aparecem num número que dilui tudo.',
      },
      {
        q: 'Verdadeiro ou falso: p99 é o pior caso.',
        a: 'Falso. 1% dos eventos é pior que o p99. Com dez mil eventos por segundo, isso é cem eventos por segundo piores que ele.',
      },
    ],
  },

  // ============================================================ TEMPORADA 03
  'medir-sem-estragar': {
    doZero: [
      'Aqui a aula muda de assunto: sai do "o que medir" e entra no "como medir sem quebrar tudo". E o problema é real.',
      'Trocas de contexto acontecem centenas de milhares de vezes por segundo, por núcleo, o dia inteiro. Qualquer código que você coloque nesse ponto roda nessa frequência. A ferramenta tradicional do Linux pra isso, o **perf**, funciona, mas com custo alto demais pra ficar ligada sempre, e normalmente só é acionada depois do incidente, quando o pico já passou.',
      'A resposta é o **eBPF**: uma tecnologia que permite rodar programinhas seus DENTRO do kernel, em pontos específicos, com custo baixíssimo. É como instalar um sensor dentro do motor de um carro em movimento, sem desligar o carro.',
      'O que torna isso aceitável é o **verifier**: antes de aceitar o programa, o kernel prova que ele termina e não acessa memória proibida. Não passou, não carrega. É essa prova que permite rodar código assim em produção sem plano de emergência.',
      'E o número que fecha o beat: menos de **600 nanossegundos** por evento. Num evento que custa alguns microssegundos, a medição fica na casa de poucos por cento do que ela observa.',
    ],
    erro: 'Não diga que eBPF é "um módulo de kernel". Módulo roda código nativo sem rede de proteção, e um bug derruba a máquina inteira. eBPF roda numa máquina virtual verificada, e é essa verificação que muda tudo. Confundir os dois apaga o motivo pelo qual a tecnologia existe.',
    faq: [
      {
        q: 'Rodar código dentro do kernel não é perigoso?',
        a: 'Seria, sem o verifier. Ele prova estaticamente, antes de carregar, que o programa termina (nada de loop infinito) e que não acessa memória fora do permitido. Programa que não passa simplesmente não é carregado. É isso que permite ligar isso em produção.',
      },
      {
        q: 'O verifier garante que meu código está certo?',
        a: 'Não, e essa distinção vale ouro. Ele garante segurança de memória e término, não corretude da lógica nem custo baixo. Overhead se mede, não se deduz, e foi exatamente pra isso que a Netflix construiu o bpftop.',
      },
      {
        q: 'De onde vem esse nome estranho?',
        a: 'De extended Berkeley Packet Filter, herdado de quando a tecnologia só filtrava pacotes de rede. Hoje é base de ferramentas de observabilidade, rede e segurança em praticamente toda empresa grande de infraestrutura.',
      },
      {
        q: 'Roda no Windows?',
        a: 'Existe um projeto de eBPF para Windows, mas o ecossistema maduro é do Linux, e o artigo é sobre Linux. Se perguntarem, essa é a resposta honesta e suficiente.',
      },
      {
        q: '600 nanossegundos parece nada. É pouco mesmo?',
        a: 'Faça a multiplicação com a sala, é o melhor momento do beat. 600 nanossegundos vezes quinhentos mil eventos por segundo dá 0,3 segundo de CPU por segundo, quase um terço de um núcleo. Pouco em cada evento, relevante no total. É esse raciocínio que separa quem entende de quem decorou.',
      },
      {
        q: 'Por que não ligar a medição só quando dá problema?',
        a: 'Por dois motivos. O pico dura milissegundos e a investigação começa horas depois, então você perde o evento. E sem coleta contínua você não tem baseline: os 83 microssegundos só existem porque a medição já estava ligada antes.',
      },
    ],
    testeSe: [
      {
        q: 'Por que o perf não serve pra esse caso?',
        a: 'Custo alto demais pra ficar ligado o tempo todo, e normalmente é acionado depois do incidente, quando o pico já passou e não há baseline pra comparar.',
      },
      {
        q: 'O que exatamente o verifier prova, e o que ele não prova?',
        a: 'Prova que o programa termina e não acessa memória indevida. Não prova que a lógica está certa nem que o custo é baixo.',
      },
    ],
  },

  'dois-hooks-um-mapa': {
    doZero: [
      'Este beat é mais simples do que o assunto sugere, e é um padrão que você já usou sem saber: o cartão de estacionamento.',
      'Na entrada você pega um ticket com a hora. Na saída, a cancela lê o ticket, subtrai da hora atual e sabe quanto tempo você ficou. Só isso.',
      'O kernel avisa em dois momentos. Quando um processo fica pronto pra rodar (**sched_wakeup**), você anota a hora numa tabela, usando o número do processo como chave. Quando a CPU troca de processo (**sched_switch**), você olha quem está ENTRANDO, busca a hora dele na tabela, subtrai, e apaga a entrada.',
      'A tabela é um **hash map**: uma estrutura que acha qualquer chave quase instantaneamente, sem varrer o resto. É a agenda do celular, onde você vai direto no M pra achar a Maria.',
      'Três detalhes que parecem chatos e são o beat inteiro: vale o **primeiro** wakeup (senão você mede só o último pedaço da espera); use quem está **entrando** na CPU (não quem saiu); e **apague** a entrada, senão a tabela cresce até estourar.',
    ],
    erro: 'Se alguém propuser guardar isso numa lista em vez de um mapa, não deixe passar batido só porque "funciona". Busca em lista é proporcional ao tamanho dela, num trecho executado quinhentas mil vezes por segundo. É a diferença entre viável e inviável.',
    faq: [
      {
        q: 'Por que hash map e não uma lista?',
        a: 'Porque busca em lista exige varrer os elementos, e o custo cresce com o tamanho. Hash map acha em tempo praticamente constante. Num caminho executado quinhentas mil vezes por segundo, essa diferença é a diferença entre funcionar e derrubar a máquina.',
      },
      {
        q: 'O que acontece se o processo morre antes de ganhar CPU?',
        a: 'A entrada dele fica órfã no mapa. É por isso que a Netflix teve que dimensionar o mapa com folga: entradas órfãs se acumulam. Eles chegaram a considerar um tipo de mapa que descarta entradas velhas sozinho (o LRU_HASH), mas ele custava de 40 a 50 nanossegundos a mais por operação, o que é quase 10% do orçamento.',
      },
      {
        q: 'Por que não usar o cgroup como chave em vez do PID?',
        a: 'Porque a conta é por processo: você precisa casar o wakeup e o switch do MESMO processo. Vários processos do mesmo container estariam na mesma chave e as contas se misturariam. O PID é a chave de correlação; o cgroup entra depois, como etiqueta da métrica.',
      },
      {
        q: 'O que acontece se o switch não achar o par no mapa?',
        a: 'Você ignora o evento. Pode faltar par porque o programa foi carregado no meio do caminho, ou porque o processo foi preemptado e voltou sem novo wakeup. O erro grave aqui seria reportar zero: isso despeja zeros no histograma e afunda artificialmente o p99.',
      },
      {
        q: 'Por que "vale o primeiro wakeup" e não o último?',
        a: 'Porque o que você quer medir é desde o instante em que o processo ficou pronto. Se ele receber vários avisos antes de rodar e você sobrescrever a hora a cada um, você mede só o último trecho e apaga exatamente o caso ruim, a espera longa.',
      },
      {
        q: 'Eles escolheram esse tipo de mapa por quê?',
        a: 'Por medição, não por intuição, e essa é a melhor lição do beat. Testaram várias opções: o hash comum foi o mais rápido; o TASK_STORAGE, que parecia a escolha natural, ficou quase duas vezes mais lento. Otimização em hot path é empírica.',
      },
    ],
    testeSe: [
      {
        q: 'Descreva o algoritmo inteiro em duas frases.',
        a: 'No aviso de "ficou pronto", guardo a hora atual numa tabela indexada pelo número do processo. No aviso de "a CPU trocou", busco a hora de quem está entrando, subtraio da hora atual e apago a entrada.',
      },
      {
        q: 'Por que apagar a entrada não é só higiene?',
        a: 'Porque processos nascem e morrem o tempo todo. Sem apagar, a tabela cresce até o limite e passa a falhar em silêncio. E o sintoma é traiçoeiro: a métrica não some, ela fica boa demais.',
      },
      {
        q: 'Você usa o número de quem está entrando ou de quem está saindo da CPU?',
        a: 'De quem está entrando. A espera que acabou de terminar é a dele.',
      },
    ],
  },

  'coletor-nao-come-cpu': {
    doZero: [
      'Aqui acontece a virada mais bonita da aula: o programa funcionava, e mesmo assim quebrou a promessa. O volume de eventos era tão grande que o programa que só lia e agregava passou a consumir CPU demais. A ferramenta de detectar vizinho barulhento estava virando o vizinho barulhento.',
      'A correção tem três partes, e todas seguem o mesmo princípio: **jogue o dado fora o mais cedo possível, e mova o mínimo de bytes.**',
      'Primeiro, **rate limit dentro do kernel**: antes de montar o evento, o programa checa se já emitiu um evento recente daquele container. Se sim, descarta ali mesmo. E repare na chave: o limite é por container, não global. Se fosse global, um container muito ativo consumiria toda a cota de amostragem e os outros sumiriam do painel.',
      'Segundo, **ring buffer**: uma área de memória circular compartilhada, por onde os eventos saem sem uma chamada de sistema pra cada um. É a esteira rolante entre a cozinha e o salão.',
      'Terceiro, **desistir cedo**: os avisos também disparam pras tarefas internas do kernel, que não interessam. Checar isso antes de tocar em qualquer estrutura é lucro, porque comparar dois números é quase de graça e buscar num mapa não é.',
    ],
    erro: 'Não apresente amostragem como se fosse de graça. Ela tem preço explícito: a métrica passa a servir pra detectar e comparar, e deixa de servir pra contar exatamente quantas vezes algo aconteceu. Dizer isso na aula aumenta sua credibilidade, não diminui.',
    faq: [
      {
        q: 'Quanto se perde amostrando?',
        a: 'Você perde a contagem exata, e mantém a forma da distribuição. Para detectar contenção e comparar containers, isso basta. Para responder "quantas vezes exatamente isso aconteceu", não serve. Saber o que a métrica não responde é parte de usá-la bem.',
      },
      {
        q: 'Por que limitar por container em vez de globalmente?',
        a: 'Porque a chave da amostragem precisa ser a mesma dimensão pela qual você agrega. Um container que gera 90% dos eventos da máquina consumiria toda a cota global, e os outros doze sumiriam do gráfico. Você economizaria volume e perderia exatamente os casos que importam.',
      },
      {
        q: 'Por que não fazer o rate limit do lado de fora, que é mais fácil?',
        a: 'Porque se o evento já foi montado e atravessou o buffer, o custo já foi pago. O descarte precisa acontecer antes de gerar o dado, senão você só economiza a parte barata.',
      },
      {
        q: 'O que é um ring buffer, na prática?',
        a: 'Uma área de memória circular compartilhada entre o kernel e o programa de fora. O programa reserva espaço, escreve o registro no lugar e confirma; o leitor lê direto dali. Sem cópia intermediária e sem uma chamada de sistema por evento. Circular quer dizer que ao chegar no fim ele volta ao começo, e se o leitor não der conta, eventos são descartados.',
      },
      {
        q: 'Por que a ordem das verificações importa tanto?',
        a: 'Porque cada verificação tem um custo diferente. Comparar dois inteiros é quase de graça; buscar num mapa custa. Perguntar primeiro o que é barato e sair no primeiro "não interessa" economiza o caro. Num trecho executado quinhentas mil vezes por segundo, a ordem das perguntas é a otimização.',
      },
      {
        q: 'Não daria pra só desligar a coleta quando a máquina estivesse carregada?',
        a: 'Aí você desliga a medição exatamente quando o problema acontece, que é o único momento em que ela importa. É o paradoxo que vale devolver pra sala se alguém propuser isso.',
      },
    ],
    testeSe: [
      {
        q: 'Qual o princípio único por trás dos três cortes?',
        a: 'Descartar o mais cedo possível e mover o mínimo de bytes. Filtrar no kernel é mais barato que filtrar no agente, que é mais barato que filtrar depois da rede.',
      },
      {
        q: 'Por que a chave do rate limit é o cgroup?',
        a: 'Porque é a mesma dimensão pela qual a métrica é agregada. Amostrar por outra chave apagaria containers inteiros do painel.',
      },
    ],
  },

  // ============================================================ TEMPORADA 04
  'cgroup-cardinalidade': {
    doZero: [
      'Uma latência sem dono não serve pra nada. Pra virar uma conversa entre times, cada medição precisa carregar de quem ela é.',
      'O kernel só conhece números: o PID do processo e o número do cgroup. O painel fala outra língua: "checkout-service, versão 42". Alguém precisa traduzir, e essa tradução acontece no **agente** que roda em cada máquina, porque só ali existe o inventário de quais containers estão naquele host.',
      'E aí vem a sacada: como o aviso do kernel entrega também quem estava na CPU ANTES, a métrica pode ser etiquetada com a **causa** da preempção. São três casos: outro processo do mesmo container, outro container, ou um serviço do sistema. É essa etiqueta que transforma "estou sofrendo" em "estou sofrendo por causa daquilo ali".',
      'O preço aparece aqui, e cai em entrevista: cada combinação diferente de etiquetas vira uma **série temporal** separada, com custo próprio de armazenar e consultar. Isso chama-se **cardinalidade**. Etiqueta boa tem poucos valores, estáveis, e serve pra filtrar.',
    ],
    erro: 'Não trate cardinalidade só como problema de custo em dinheiro. É também problema de latência de consulta: um painel que precisa varrer milhões de séries demora ou falha exatamente durante o incidente, que é quando você mais precisa dele.',
    faq: [
      {
        q: 'Por que não etiquetar por PID, se é mais preciso?',
        a: 'Porque PID é reciclado e efetivamente ilimitado ao longo de um dia. Cada PID novo cria uma série temporal nova que nunca mais recebe um ponto. Num host que cria mil processos por hora, você gera milhares de séries mortas por dia, e o backend cai.',
      },
      {
        q: 'Qual a diferença entre métrica, log e trace?',
        a: 'Métrica é número agregado ao longo do tempo: barata, ótima pra alertar, ruim pra investigar caso individual. Log é o registro textual de eventos: caro, ótimo pra investigar. Trace é o caminho de uma requisição atravessando vários serviços. Dimensão de alta cardinalidade (requisição, usuário) vive em log e trace, nunca em métrica.',
      },
      {
        q: 'Por que traduzir o número em nome no host, e não num serviço central?',
        a: 'Porque o mapeamento é local e muda a cada container que sobe ou morre. Resolver longe da origem exigiria mandar dado cru pela rede e consultar um catálogo global sempre desatualizado, o que produz métrica órfã sempre que o container já morreu quando o dado chegou.',
      },
      {
        q: 'Quanto custa cardinalidade alta na prática?',
        a: 'Depende do sistema, mas a ordem de grandeza é assustadora: sistemas de métrica costumam cobrar por série ativa, e uma etiqueta de mil valores multiplicada por outra de mil vira um milhão de séries. É por isso que o CloudWatch, que cobra por métrica customizada e por dimensão, fica caro rápido nesse tipo de uso.',
      },
      {
        q: 'Se eu precisar mesmo saber qual requisição sofreu, o que faço?',
        a: 'Aí você não está mais no mundo de métricas, e está no mundo de traces. É uma resposta legítima e mostra que você entendeu a fronteira: a métrica te diz que existe um problema e de qual serviço; o trace te diz qual requisição específica.',
      },
    ],
    testeSe: [
      {
        q: 'Por que o cgroup é uma boa etiqueta e o PID é uma péssima?',
        a: 'Cgroup tem poucos valores, estáveis, e vive enquanto o container vive. PID é reciclado, efetivamente ilimitado, e cada um novo cria uma série que nunca mais recebe dado.',
      },
      {
        q: 'O que a segunda etiqueta (a causa da preempção) permite dizer que a primeira não permite?',
        a: 'De quem é a culpa. Sem ela você sabe que sofreu; com ela você sabe se foi o próprio container, outro container ou um serviço do sistema.',
      },
    ],
  },

  'duas-metricas': {
    doZero: [
      'Este é o clímax da aula, e a ideia é mais simples do que parece: **febre não diz se você está gripado ou se acabou de correr.** Um sintoma, duas causas opostas.',
      'A espera disparou. Existem duas histórias que produzem exatamente o mesmo gráfico.',
      '**História A, throttling.** O container gastou a própria cota nos primeiros milissegundos da janela e o kernel o congelou. Os processos ficam prontos e sem CPU, então a espera dispara. Mas ninguém tirou nada dele. O tratamento é aumentar a cota ou otimizar o serviço.',
      '**História B, vizinho.** O container está longe da cota, mas toda vez que seus processos ficam prontos, os núcleos estão ocupados por outro container. A espera dispara E o contador de preempções por outro cgroup dispara junto. O tratamento é da plataforma.',
      'A primeira métrica diz que dói. A segunda diz de quem é a culpa. **Uma métrica descreve, duas diagnosticam.** Se você levar uma única frase desta aula, leve essa.',
      'E tem a ironia do caso real: no artigo, o contador apontou que a maior parte das preempções veio de processos do SISTEMA, não do container novo. O container novo encheu a máquina, e isso fez os serviços do host disputarem CPU muito mais. Causa direta e causa raiz não são a mesma coisa.',
    ],
    erro: 'Existem três casos, não dois. O terceiro é a preempção vir de outro processo do MESMO container, o que não é vizinho nem cota, é concorrência interna, e o tratamento é no próprio código. Se você apresentar só dois, alguém vai achar o buraco.',
    faq: [
      {
        q: 'Throttling é ruim? Deveria ser desligado?',
        a: 'Não é ruim, é o mecanismo funcionando: é o que garante que um container não coma a máquina inteira. O problema não é o throttling existir, é você não saber que está sendo throttled e acusar o vizinho por isso.',
      },
      {
        q: 'E se as duas coisas acontecerem ao mesmo tempo?',
        a: 'Acontece, e a leitura continua funcionando: se o contador de preempções por outro cgroup subiu, existe interferência externa, independentemente de você também estar batendo na cota. A segunda métrica é evidência positiva de uma das causas, não prova de exclusão da outra.',
      },
      {
        q: 'Como eu chego na causa raiz, e não só na causa direta?',
        a: 'A métrica aponta o executor, não o instigador. No caso do artigo, os serviços do sistema preemptavam, mas quem os fez disputar tanto foi o container que encheu a máquina. Chegar na raiz exige correlacionar no tempo: o que mudou naquele host naquele minuto. Isso é trabalho humano de investigação, e vale dizer isso pra sala.',
      },
      {
        q: 'Esse padrão tem nome? Serve pra outras coisas?',
        a: 'É a ideia de métrica discriminante: quando um sintoma tem mais de uma causa possível, procure a segunda métrica que só se move em uma delas. Latência alta de API pode ser fila ou processamento lento, e o que separa é medir o tempo de fila em separado. Cache com hit rate baixo pode ser cache pequeno ou tráfego novo, e o que separa é a taxa de eviction.',
      },
      {
        q: 'Por que não simplesmente olhar a utilização do host pra saber se está cheio?',
        a: 'Porque isso te dá suspeita, não prova, e não atribui evento a evento. O host pode estar cheio sem que o SEU container esteja sendo prejudicado. O aviso do kernel já entrega quem estava na CPU antes, então dá pra ter atribuição direta em vez de correlação indireta.',
      },
    ],
    testeSe: [
      {
        q: 'Quais são as três causas possíveis de espera alta?',
        a: 'Throttling da própria cota, vizinho barulhento (outro cgroup), e concorrência interna (outro processo do mesmo container).',
      },
      {
        q: 'Como as duas métricas se comportam em cada caso?',
        a: 'Nos três, a espera sobe. O contador de preempção por OUTRO cgroup só sobe no caso do vizinho. É a coluna que desempata.',
      },
      {
        q: 'Qual a regra geral que essa história ensina, fora de Linux?',
        a: 'Quando um sintoma tem mais de uma causa possível, procure a segunda métrica que só se move em uma delas. Uma métrica descreve, duas diagnosticam.',
      },
    ],
  },

  // ============================================================ TEMPORADA 05
  arquitetura: {
    doZero: [
      'Hora de juntar tudo num desenho. Pense nos correios: coleta na ponta, triagem, transporte, entrega. Cada etapa reduz e organiza o volume.',
      'O **caminho de escrita** tem cinco estágios, e cada um corta volume. O aviso do kernel dispara centenas de milhares de vezes por segundo. As verificações no kernel descartam o que não interessa. O que sobra vira um registro pequeno no ring buffer. O **agente** que roda naquela máquina lê, traduz número de cgroup em nome de serviço e **agrega numa janela de tempo**, produzindo um histograma em vez de um ponto por evento. Só o resultado agregado sobe pela rede.',
      'A redução é de várias ordens de grandeza, e é de propósito: filtrar no kernel é mais barato que filtrar no agente, que é mais barato que filtrar depois da rede.',
      'O **caminho de leitura** vai na direção oposta e tem perfil oposto: poucas consultas, cada uma tocando muitos pontos, com tolerância a demora bem maior. Reconhecer essa assimetria é metade da resposta numa entrevista de system design.',
      'E uma decisão que parece detalhe e não é: se o backend cair, o agente segura um pouco em memória e depois **desiste**. Métrica velha tem valor decrescente, e segurar dados até estourar a memória do host transformaria o coletor no próximo incidente. Descartar aqui é decisão de projeto, não falha.',
    ],
    erro: 'Não desenhe o agente como opcional nem como um serviço central. Um por máquina é uma consequência técnica, não preferência: o evento nasce dentro do kernel local e a tradução de cgroup pra nome só existe ali.',
    faq: [
      {
        q: 'Por que agregar no host em vez de mandar tudo e agregar depois?',
        a: 'Faça a conta com a sala: quinhentos mil eventos por segundo, vezes milhares de hosts. Nenhuma ingestão aguenta, e você pagaria rede e armazenamento por dado que ia ser agregado de qualquer forma. Agregar na borda é o que torna o sistema viável.',
      },
      {
        q: 'O que acontece se o backend de métricas cair?',
        a: 'O agente segura um buffer curto em memória e depois descarta. Buffer sem teto no host transformaria uma falha de observabilidade numa falha de produção, que é muito pior. Métrica antiga vale cada vez menos.',
      },
      {
        q: 'E se o agente cair?',
        a: 'Aquele host fica cego e os outros seguem normalmente. É uma propriedade boa da arquitetura: a falha é isolada por máquina, não global.',
      },
      {
        q: 'Por que dimensionar leitura e escrita separadamente?',
        a: 'Porque os perfis são opostos. Escrita é volume alto e constante. Leitura é volume baixo e em rajada, e explode justamente durante o incidente, quando a escrita também está no pico. Tratar como um problema só deixa os dois ruins.',
      },
      {
        q: 'Que estado precisa sobreviver a um reinício?',
        a: 'Só o banco de séries temporais. Dentro do kernel são dois mapas pequenos e efêmeros; no agente é o inventário local e o histograma da janela atual, tudo descartável. Se o agente reinicia, você perde uma janela, não o histórico. Saber o que é descartável define quanta confiabilidade cada pedaço precisa.',
      },
    ],
    testeSe: [
      {
        q: 'Cite os cinco estágios do caminho de escrita, em ordem.',
        a: 'Tracepoint dispara, guardas e rate limit no kernel descartam, o que sobra vai pro ring buffer, o agente local traduz e agrega em janela, e só o agregado sobe pela rede pro banco de séries temporais.',
      },
      {
        q: 'Por que o caminho de leitura não pode ser dimensionado junto com o de escrita?',
        a: 'Perfis opostos: escrita é volume alto e constante, leitura é baixa e em rajada, e explode durante o incidente, exatamente quando a escrita também está no pico.',
      },
    ],
  },

  aws: {
    doZero: [
      'A pergunta deste beat é: se eu fosse montar isso na Amazon, o que eu usaria em cada caixa do desenho? E a lição de fundo é que **o perfil de carga escolhe o serviço, não a familiaridade de quem escolhe.**',
      'A primeira linha não é nem um trade-off, é um corte. O agente precisa carregar programa no kernel da máquina. No **Fargate** e no **Lambda** você não tem a máquina: cada tarefa roda numa micro-VM isolada e o kernel não é seu. Logo: **EC2**, com o agente rodando um por nó. Isso elimina serverless da conversa antes de qualquer comparação de preço.',
      'A ironia bonita, que vale contar: no Fargate você não tem esse problema de vizinho barulhento no mesmo kernel, justamente porque o isolamento é maior. Você paga por isso em densidade e em preço. É a mesma escolha entre utilização e previsibilidade que aparece na aula inteira.',
      'Para as métricas agregadas, um banco de séries temporais gerenciado (o **AMP**, que é o Prometheus da Amazon), painel no **Grafana** gerenciado, alerta saindo pelo **SNS**. E se alguém quiser guardar amostras cruas pra investigação, isso NÃO passa pelo banco de métricas: vai por **Firehose** pro **S3**, consultado sob demanda pelo **Athena**. Perfil oposto: escrita alta, leitura rara.',
    ],
    erro: 'Não justifique escolha de serviço por familiaridade ("já usei"). Numa entrevista isso é reprovação direta. A justificativa tem que sair de uma característica da carga: volume de escrita, padrão de leitura, necessidade de acesso ao kernel.',
    fluxoAoVivo: {
      titulo: 'Container x VM já foi ensinado lá no beat 1, aqui é só callback',
      passos: [
        'O console "Caixa a caixa" já fecha com a conexão pronta: "é a mesma diferença entre container e VM que vimos lá no começo". Não precisa reabrir o assunto do zero, só apontar de volta.',
        'Se a sala não lembrar, é um bom momento pra perguntar de volta: "container compartilha o quê com os vizinhos, mesmo?" antes de você mesmo responder.',
      ],
      onde: 'O ensino completo de container x VM está no beat 1 (capítulo 00.6). Aqui é reforço, não ensino novo.',
    },
    faq: [
      {
        q: 'Por que exatamente o Fargate não serve?',
        a: 'Porque eBPF exige carregar programa no kernel do host, com permissões privilegiadas. No Fargate cada tarefa roda numa micro-VM gerenciada pela Amazon, e esse kernel não é seu. É restrição de capacidade, não de custo.',
      },
      {
        q: 'O que é "serverless", afinal?',
        a: 'Modelo em que você entrega só o código ou o container, e o provedor cuida da máquina. O servidor existe, você é que não o administra. O nome é péssimo e confunde muita gente: não é que não tem servidor, é que não é seu.',
      },
      {
        q: 'Por que não mandar tudo pro CloudWatch, que já vem integrado?',
        a: 'Porque ele cobra por métrica customizada e por dimensão. Nesse tipo de uso, com etiqueta por container, a fatura cresce mais rápido que a frota. Ele é a opção mais fácil e a mais cara aqui.',
      },
      {
        q: 'Por que separar o caminho da métrica do caminho do dado cru?',
        a: 'Porque os perfis são opostos. Métrica agregada quer índice por etiqueta e leitura rápida, o que pede banco de séries temporais. Amostra crua quer ingestão barata e leitura rara, o que pede fila mais armazenamento barato. Forçar um caminho só deixa os dois ruins.',
      },
      {
        q: 'Onde o Kubernetes entra nisso?',
        a: 'O EKS é o Kubernetes gerenciado da Amazon, e roda sobre EC2. O agente entraria como um daemon por nó, que é literalmente o desenho do beat anterior. O problema e a solução são idênticos: a causa é o kernel compartilhado, não a plataforma que organiza os containers.',
      },
      {
        q: 'Um agente por container não seria mais preciso?',
        a: 'Não, seria pior. A instrumentação é do kernel do host e já enxerga todos os cgroups de uma vez. Um agente por container multiplicaria o overhead e coletaria dado redundante.',
      },
    ],
    testeSe: [
      {
        q: 'Qual das escolhas deste beat não é trade-off, e por quê?',
        a: 'EC2 em vez de Fargate ou Lambda. Sem acesso ao kernel do host não existe eBPF. É corte de capacidade, e elimina a opção antes de qualquer comparação de preço.',
      },
      {
        q: 'Por que amostra crua não vai pelo mesmo caminho da métrica?',
        a: 'Perfis opostos. Métrica quer leitura rápida por etiqueta; amostra crua tem escrita alta e leitura rara, então pede ingestão barata mais armazenamento barato, consultado sob demanda.',
      },
    ],
  },

  // ================================================================ SÍNTESE
  synthesis: {
    doZero: [
      'O fechamento existe pra tirar a aula do Linux. O que a Netflix construiu não foi uma ferramenta, foi um método, e nenhum passo dele depende de eBPF.',
      'Escolher a métrica que responde a pergunta certa: espera, não uso. Reportar na estatística que enxerga o evento raro: percentil, não média. Medir sem virar parte do problema: orçamento em nanossegundos, descarte na origem. Carregar atribuição junto do número: cgroup, não PID. E aceitar que um número sozinho é ambíguo, procurando o segundo que desempata.',
      'A frase que fecha tudo, e que vale ser a última coisa dita na sala: **uma métrica sozinha te faz culpar a pessoa errada.**',
    ],
    erro: 'Não deixe a sala sair achando que a aula foi sobre eBPF. eBPF é o instrumento. Em entrevista, quem só fala da ferramenta perde o ponto; quem fala do método (medir espera, atribuir, desempatar) mostra que entendeu.',
    faq: [
      {
        q: 'Onde mais existe uma fila invisível que ninguém mede?',
        a: 'Pool de conexões do banco (quanto tempo a query esperou uma conexão livre), thread pool de servidor web, consumidor de fila de mensagens, GPU compartilhada. Em todos, a pergunta "quanto tempo esperando?" é mais informativa que "quanto por cento ocupado?", e em quase nenhum ela está no painel.',
      },
      {
        q: 'Detectar resolve o problema?',
        a: 'Não. A métrica identifica o vizinho; resolver ainda exige mudar o empacotamento, isolar melhor ou mexer na política de CPU. Observabilidade compra decisão informada, não conserto automático. Vale dizer isso pra não vender mágica.',
      },
      {
        q: 'Como isso cairia numa entrevista de system design?',
        a: 'De duas formas. Direta: "como você investigaria um serviço lento com CPU baixa?". Indireta e mais comum: você propõe uma arquitetura e o entrevistador pergunta como você saberia que ela está sofrendo. Responder "meço utilização" é raso; responder "meço tempo de espera na fila, em percentil, atribuído por serviço" muda o nível da conversa.',
      },
    ],
    testeSe: [
      {
        q: 'Resuma o método em cinco passos, sem citar eBPF.',
        a: 'Escolher a métrica que responde a pergunta (espera, não uso). Reportar em percentil. Medir barato o bastante pra ficar sempre ligado. Carregar atribuição junto do número. Procurar a segunda métrica que desempata entre as causas.',
      },
    ],
  },
};
