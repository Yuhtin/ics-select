import type { Lesson } from '../lesson-types';

// Fontes: Uber Eng H3 (uber.com/blog/h3) - Medium "smooth real-time map" (ndriqim.muhadri99)
// - Geohash (Wikipedia) - Redis GEO docs - highscalability "How Uber scales their real-time market platform"
export const motoristaMaisPerto: Lesson = {
  slug: 'motorista-mais-perto',
  title: 'Como a Uber Acha o Motorista Mais Perto',
  subtitle: 'Busca espacial: de Haversine em todos a geohash, quadtree e o hexágono H3.',
  blurb:
    'A curiosidade que vira system design. Você pede um Uber e em milissegundos ele acha os motoristas mais perto entre milhões rodando no mundo. A gente parte do jeito ingênuo (medir a distância pra todos) e descobre que ele derrete por dois motivos que se somam: a leitura O(N) e o lado que todo mundo esquece, o firehose de localização (cada motorista manda GPS a cada ~4s, ~1 milhão de writes por segundo). A saída é transformar 2D num índice: geohash (proximidade vira prefixo de string), quadtree (grade que se adapta à densidade) e o H3 da Uber (grade de hexágonos, onde todo vizinho fica à mesma distância). No clímax, o DISCO mostra que o índice só acha CANDIDATOS, e quem escolhe é o ETA na malha viária, porque perto em linha reta mente. A regra que sai daqui: proximidade é um problema 1D disfarçado, e busca por vizinho é sempre filtro grosso mais rank fino.',
  durationMin: 60,
  audience: 'Hot Stuff 2026.2 · Big Tech',
  slidesUrl: '/slides/motorista-mais-perto.html',
  nodes: [
    // ──────────────── FOUNDATIONS (study-only) ────────────────
    {
      id: 'f-latlong',
      label: 'O mundo em dois números',
      group: 'foundations',
      teachFromZero: true,
      oneLine:
        'Toda posição na Terra é um par (latitude, longitude). A distância entre dois pares se mede com Haversine, não com Pitágoras, porque a Terra é curva, e calcular isso milhões de vezes é o problema da aula.',
      pass1:
        'Antes de "achar o mais perto", você precisa saber como uma posição vira número. Latitude diz o quão ao norte ou sul você está (de -90 no polo sul a +90 no norte). Longitude diz o quão a leste ou oeste (de -180 a +180). Qualquer ponto do planeta é um par desses dois. O motorista e o passageiro são, cada um, um par (lat, long). A pergunta "quem está mais perto" vira "qual par tem a menor distância até o meu par".',
      pass2:
        'O detalhe que pega gente desavisada: a Terra é uma esfera, então a distância entre dois pontos segue a curvatura. É a **distância de grande círculo**, calculada pela fórmula de **Haversine**, que usa seno, cosseno e raiz quadrada pra medir o arco sobre a superfície curva.\n\nPra distâncias curtas (dentro de uma cidade) Pitágoras até aproxima, mas o jeito correto e usado em produção é Haversine. A aula não pede a fórmula decorada. O que importa é sacar que **cada cálculo de distância custa trigonometria**, várias operações de ponto flutuante caras.\n\nGuarde dois fatos: trig é cara por par, e tem milhões de pares. Multiplicados, eles são o problema da aula inteira: como NÃO rodar Haversine contra todo mundo.',
      pass3: [
        {
          gotcha: 'Usar Pitágoras em escala global',
          note: 'Em distâncias grandes a curvatura da Terra importa e Pitágoras erra feio. Haversine (grande círculo) é o correto. Dentro de um bairro a diferença é pequena, mas o reflexo certo é Haversine.',
        },
        {
          gotcha: 'Achar que lat e long têm a mesma "largura"',
          note: 'Um grau de longitude encolhe conforme você sobe pro polo (as linhas convergem). Perto do equador um grau de long é ~111km, perto do polo é quase nada. Isso volta a morder quando a gente fatiar o mapa em células.',
        },
        {
          gotcha: 'Tratar distância como o gargalo',
          note: 'A trig é cara, mas o que mata é rodar a conta N vezes. Guarde isso: o inimigo é o N, não o Haversine.',
        },
      ],
      anchor:
        'Passageiro em (-23.55, -46.63), motorista em (-23.55, -46.64), ~1 km de distância. Você escreve raiz de (Δlat² + Δlong²) e multiplica por 111km. Onde essa conta começa a mentir, e o que você usa no lugar?',
      followup: 'Haversine é umas doze operações de ponto flutuante. O que acontece quando você roda isso contra 2 milhões de motoristas, 1 milhão de vezes por segundo?',
      gotcha:
        'Se alguém disser "é só raiz de (x² + y²)", devolva: "isso num mapa plano. A Terra é esfera. Dois pontos no mesmo meridiano a 1000km, Pitágoras te dá o quê?"',
    },
    // ──────────────── NEAREST: o problema ────────────────
    {
      id: 'o-problema',
      label: 'O problema do mais perto',
      group: 'nearest',
      beat: 1,
      teachFromZero: true,
      tags: ['nearest-neighbor', 'haversine', 'lat-long', 'escala'],
      oneLine:
        'Cerca de 2 milhões de motoristas online no pico. Achar os mais perto de você em milissegundos, sem medir a distância pra todos os 2 milhões.',
      pass1:
        'Você aperta "pedir Uber". Nesse instante tem na ordem de 2 milhões de motoristas online rodando pelo mundo. O app precisa te devolver os mais próximos em uma fração de segundo, porque você está olhando a tela esperando o carrinho aparecer. A pergunta da aula é direta: como achar os k motoristas mais perto de um ponto, entre milhões, em milissegundos? O jeito óbvio (medir a distância pra todos e pegar os menores) é exatamente o que NÃO escala, e entender por que ele quebra é o primeiro passo.',
      pass2:
        'O instinto de todo mundo é direto: pega o meu (lat, long), calcula a distância Haversine até cada motorista online, ordena, devolve os 3 mais perto. Funciona lindamente num protótipo com 50 carros. O problema aparece quando os 50 viram milhões.\n\nVamos cravar a escala real pra sala sentir o tamanho. No pico, a Uber tem cerca de **2 milhões de motoristas online** (esse é o N), e roda na ordem de **40 milhões de corridas por dia**. O sistema de matching responde algo como **1 milhão de requisições por segundo**, com orçamento de latência de **centenas de milissegundos**. Repare numa assimetria que volta no próximo beat: pedidos de corrida são só ~230 por segundo, mas a posição dos motoristas é reescrita o tempo todo.\n\nReescrevendo o problema com nome técnico: isso é uma busca de **vizinho mais próximo** (nearest neighbor) sobre um conjunto de pontos que, ainda por cima, se mexem o tempo todo. Os dois adjetivos (em escala, e em movimento) são o que torna o ingênuo inviável.\n\nO próximo beat vai abrir o ingênuo em câmera lenta e mostrar que ele tem DOIS furos, não um. O furo óbvio é a leitura. O furo que derruba 90% das respostas de entrevista é o outro.',
      pass3: [
        {
          gotcha: 'Subestimar a escala',
          note: '"Uns milhares de motoristas" muda completamente a resposta. São milhões online e ~1 milhão de requisições de matching por segundo. A solução pra milhares (medir pra todos) é a errada pra milhões.',
        },
        {
          gotcha: 'Esquecer que os pontos se mexem',
          note: 'Não é uma busca num conjunto fixo, tipo lojas num mapa. Motorista é um ponto que anda. Isso muda o tipo de estrutura que você precisa, e é o que quase ninguém considera de cara.',
        },
        {
          gotcha: 'Confundir "mais perto" com "melhor"',
          note: 'Mais perto em linha reta nem sempre é o melhor motorista (segura essa, é o clímax da aula). Por enquanto o objetivo é só achar candidatos perto, rápido.',
        },
      ],
      anchor:
        'Você aperta "pedir Uber". Tem ~2 milhões de motoristas online. Como o app acha os 3 mais perto de você em milissegundos sem calcular distância pra todos os 2 milhões?',
      askWho: [
        {
          name: 'open',
          why: 'Beat de abertura, é o enunciado do problema. Deixe a sala propor o jeito ingênuo (medir pra todos), porque é dele que a aula parte. Ninguém estudou case-maps-rideshare, então é território novo pra todos.',
        },
        {
          name: 'Maria Clara',
          why: 'Maior breadth do cohort (16 tópicos). Se precisar puxar alguém pra enunciar a versão ingênua com clareza, ela tem a base mais ampla.',
        },
      ],
      followup: 'Esse jeito de medir pra todos, quanto custa quando "todos" são 2 milhões e eles se mexem a cada segundo?',
      gotcha:
        'Quando alguém disser "uso um banco com índice", devolva: "índice em qual coluna? Em latitude? E aí os milhares de motoristas na mesma latitude que você, mas do outro lado do país?"',
      scenarios: {
        right: {
          shape:
            'Enuncia o jeito ingênuo (Haversine pra todos, ordena, pega os k) e já desconfia que O(N) não cabe em milissegundos com milhões. Bônus se nota que os motoristas se movem.',
          redirect:
            'Confirme o enunciado e empurre pro custo: "perfeito, esse é o ponto de partida. Agora vamos cronometrar: medir pra 2 milhões, quanto custa por request? E quantos requests por segundo?"',
        },
        close: {
          shape:
            'Propõe medir pra todos mas acha que "com um banco rápido resolve", sem perceber que a busca é O(N) e bidimensional.',
          redirect:
            'Cutuque a dimensão: "banco rápido roda a MESMA conta N vezes. E um índice comum é 1D, sua busca é 2D. Como um índice em latitude te ajuda a achar quem está perto em latitude E longitude?"',
        },
        wayOff: {
          shape:
            'Pula pra "usa machine learning" ou "cacheia os resultados" sem ter o modelo do problema, ou acha que dá pra pré-computar pares de distância.',
          redirect:
            'Traga de volta ao concreto: "pré-computar distância entre quem e quem? Os pontos se mexem a cada 4 segundos. O que você cachearia que não fica velho em 4s?"',
        },
      },
    },
    {
      id: 'naive-derrete',
      label: 'Por que o ingênuo derrete',
      group: 'nearest',
      beat: 2,
      tags: ['O(n)', 'write-firehose', 'read-vs-write', 'in-memory', 'two-workloads'],
      oneLine:
        'O ingênuo quebra por dois motivos que se somam: a leitura é O(N) e, pior, cada motorista escreve a posição a cada ~4s, gerando ~1 milhão de writes por segundo.',
      pass1:
        'O jeito ingênuo tem dois furos, e a maioria das pessoas só enxerga o primeiro. Furo um, a leitura: calcular Haversine pra todos os N motoristas é O(N) por request, e Haversine é caro (trigonometria). Multiplica por ~1 milhão de requests por segundo e já não fecha. Furo dois, o que derruba a resposta de entrevista: cada motorista online manda a posição por GPS a cada ~4 segundos. Isso é um rio de escritas constante batendo na mesma estrutura que serve as leituras. O gargalo de verdade não está na conta. São os dois workloads (ler e escrever) colidindo numa estrutura que muda o tempo todo.',
      pass2:
        'A leitura primeiro. Um índice de banco comum (B-tree) em latitude OU longitude não salva: ele estreita UMA dimensão e te deixa milhares de candidatos na outra. Proximidade é 2D por natureza, e um índice 1D não consegue limitar as duas dimensões juntas. Então a busca ingênua continua varrendo perto de N de qualquer jeito.\n\nAgora o furo que importa, a escrita. Cada um dos ~2 milhões de motoristas online manda localização a cada ~4 segundos. Faça a conta: isso é da ordem de **500 mil a 1 milhão de escritas por segundo**, contínuas, na mesma estrutura. Compare com a demanda do usuário: são só ~230 pedidos de corrida por segundo. **A escrita domina a leitura por ordens de magnitude.** Quase todo mundo desenha um índice de leitura bonito e esquece que ele tem que engolir esse firehose ao mesmo tempo.\n\nUm banco relacional durável não aguenta ~1 milhão de writes aleatórios por segundo: cada commit durável precisa de WAL e fsync mais manutenção de índice por linha. Trava antes mesmo de a leitura virar problema. A pista que destrava: localização pode ficar **~30 segundos desatualizada** sem ninguém morrer. Se o dado tolera ficar velho, você não precisa de durabilidade forte no caminho quente: o índice vive **em memória** e o histórico é persistido de forma assíncrona, fora do caminho crítico.\n\nJuntando: você precisa de uma estrutura espacial, em memória, que faça a leitura tocar só uma vizinhança (não todos os N) E absorva o rio de escritas como uma operação barata. É exatamente pra isso que servem os índices espaciais dos próximos beats.',
      pass3: [
        {
          gotcha: 'Só adicionar índice em lat e long',
          note: 'Um B-tree por coluna resolve 1 dimensão e deixa a outra aberta. Você ainda varre uma das dimensões inteira. Proximidade 2D exige um índice espacial (uma estrutura que indexa as duas dimensões juntas), não dois índices 1D.',
        },
        {
          gotcha: 'Otimizar o Haversine em vez do N',
          note: 'Trocar Haversine por distância ao quadrado economiza um fator constante. O assassino é rodar a conta N vezes. Depois de um índice de células, calcular Haversine exato em algumas centenas de candidatos é trivial.',
        },
        {
          gotcha: 'Esquecer o lado da escrita',
          note: 'O erro número um. Cada motorista escreve a cada ~4s. O índice engole ~500k a 1M writes/s. Um índice otimizado só pra leitura colapsa sob esse churn.',
        },
        {
          gotcha: 'Inverter as magnitudes de QPS',
          note: 'Pedido de corrida é ~230/s. Update de localização é ~500k a 1M/s. O tráfego dominante são as escritas de posição, não os pedidos do usuário. Erre essa e você dimensiona o sistema errado.',
        },
        {
          gotcha: 'Querer durabilidade forte no caminho quente',
          note: 'Localização tolera ~30s de atraso. Tratar cada ping como linha durável de banco mata o write. O índice quente fica em memória, sharded por região, e o histórico vai pra fila e é persistido depois.',
        },
      ],
      anchor:
        'O jeito ingênuo é Haversine pra todos. Cronometre os DOIS lados: a leitura O(N), e a escrita. Cada motorista manda GPS a cada ~4s. Quantas escritas por segundo o índice precisa aguentar?',
      askWho: [
        {
          name: 'Eduardo Hirohito',
          why: 'Cobertura real de escala: estudou "20 System Design Concepts", "Como Escalar Banco de Dados?" e sharding. É quem melhor articula por que O(N) não fecha e por que um banco durável não aguenta o write rate.',
        },
        {
          name: 'Lorena Garcia',
          why: 'Fez System Design Basics + scalability. Boa pra puxar o lado da leitura e a ideia de que índice 1D não resolve busca 2D.',
        },
        {
          name: 'Maria Clara',
          why: 'Breadth ampla + scalability (overview). Backup pra estimar as magnitudes de QPS de leitura vs escrita.',
        },
      ],
      followup:
        'Concordamos: precisa de uma estrutura em memória onde a leitura toca só uma vizinhança. Como você transforma um ponto 2D numa chave que um índice comum consiga buscar por proximidade?',
      gotcha:
        'Quando a sala focar só na leitura, devolva: "beleza, resolveu a leitura. Mas 2 milhões de motoristas mandando posição a cada 4 segundos. Seu índice lindo aguenta 1 milhão de writes por segundo?"',
      scenarios: {
        right: {
          shape:
            'Separa os dois workloads: leitura O(N) que um índice 1D não resolve, E escrita ~1M/s do firehose de localização. Conclui que precisa de índice espacial em memória, e que a tolerância a staleness libera persistir o histórico async.',
          redirect:
            'Confirme e avance: "exato, é um problema de DOIS workloads. Agora a peça central: como transformar (lat, long) numa chave que um índice comum busca por proximidade?"',
        },
        close: {
          shape:
            'Identifica que O(N) é ruim e propõe índice espacial, mas não menciona o lado da escrita, ou acha que dá pra guardar tudo num Postgres com índice espacial.',
          redirect:
            'Traga o write: "ótimo pra leitura. Agora 1 milhão de updates de posição por segundo. Postgres durável aguenta esse write? O que você sacrifica pra aguentar?"',
        },
        wayOff: {
          shape:
            'Insiste que "com hardware suficiente Haversine pra todos resolve", ou propõe cachear distâncias entre pontos que se movem.',
          redirect:
            'Mostre o limite: "cache de distância entre dois pontos que andam a cada 4s vale por quanto tempo? E hardware pra rodar trig 2 milhões de vezes, 1 milhão de vezes por segundo, custa o quê?"',
        },
      },
    },
    // ──────────────── INDEX: a solução ────────────────
    {
      id: 'geohash',
      label: 'Geohash: 2D vira prefixo 1D',
      group: 'index',
      beat: 3,
      teachFromZero: true,
      tags: ['geohash', 'z-order', 'prefixo', 'borda', '9-celulas'],
      oneLine:
        'Geohash intercala os bits de lat e long num único string ordenável, onde prefixo compartilhado significa proximidade. Aí busca por vizinho vira range query.',
      pass1:
        'A virada é transformar duas dimensões numa só. Geohash pega (lat, long) e produz um único string curto tipo "6gycfx". O truque: ele faz busca binária em latitude e em longitude separadamente, gerando dois fluxos de bits, e INTERCALA os dois (um bit de long, um bit de lat, alternando) num único número. Esse número vira base32. A propriedade mágica: quanto MAIOR o prefixo que dois geohashes compartilham, mais perto eles estão no mapa. Com isso, "achar quem está perto" deixa de ser conta de distância 2D e vira uma busca por prefixo num índice ordenado comum, que qualquer B-tree faz voando.',
      pass2:
        'O bit interleaving é o coração. Cada bit de latitude responde "tá na metade de cima ou de baixo do intervalo atual?", e o mesmo pra longitude. Intercalando lat e long, o string traça uma **curva Z** (Morton) que serpenteia pelo plano de um jeito que mantém pontos próximos quase sempre próximos na sequência. Os bits viram caracteres de um alfabeto base32 (os dígitos 0-9 mais letras, sem a/i/l/o pra evitar confusão visual).\n\nA precisão é um botão que você gira pelo comprimento. Cada caractere adiciona 5 bits e encolhe a célula. Tabela pra ter na cabeça: **5 caracteres ~5km**, **6 ~1.2km**, **7 ~150m**, **8 ~40m**. Você escolhe o comprimento conforme o raio da busca: pra achar carros num raio de ~1km, 6 caracteres serve. Proximidade virou `WHERE geohash LIKE \'6gkzw%\'`.\n\nMas tem uma armadilha que separa quem entende de quem decorou: a regra "prefixo longo implica perto" é **de mão única**. Perto NÃO implica prefixo compartilhado. Dois pontos colados, mas em lados opostos de uma borda de célula, podem ter prefixos completamente diferentes, porque um tem binário 011111... e o vizinho 100000..., e quase todo bit vira. Exemplo real: duas cidades na França a ~30km uma da outra têm geohashes que não compartilham NENHUM caractere, porque caíram em lados opostos de uma célula de topo.\n\nO conserto padrão: não consulte só a sua célula, consulte ela mais as **8 vizinhas** (um bloco 3x3 de 9 prefixos). Isso garante que quem está perto atravessando qualquer borda seja capturado. Depois desse filtro grosso e barato de 9 prefixos, você roda Haversine exato só nos poucos candidatos que voltaram, pra ranquear, porque a célula é um retângulo e inclui cantos mais longe que o raio real. Geohash é o pré-filtro, não o ranking final.',
      pass3: [
        {
          gotcha: 'Confiar no prefixo de mão dupla',
          note: 'Prefixo longo => perto é verdade. Perto => prefixo compartilhado é FALSO. Esse é o problema da borda. Consultar só a própria célula perde vizinhos do outro lado da linha.',
        },
        {
          gotcha: 'Pular a consulta das 9 células',
          note: 'A célula central sozinha vaza nas bordas. O padrão de produção (qualquer índice geo sério) é célula + 8 vizinhas = 3x3. Sem isso, o carro a 10 metros de você do outro lado da borda some.',
        },
        {
          gotcha: 'Tratar a célula como círculo',
          note: 'Célula geohash é um retângulo. Os cantos estão mais longe que o raio que você quer. Por isso depois do filtro por prefixo você roda Haversine exato nos candidatos e corta os de fora do raio.',
        },
        {
          gotcha: 'Ignorar a distorção perto dos polos',
          note: 'Como longitude converge nos polos, as células geohash não são quadradas e encolhem em largura conforme sobe. Em escala global isso importa; numa cidade, menos.',
        },
      ],
      anchor:
        'Você quer guardar a posição de cada motorista numa coluna que um índice comum consiga buscar por "quem está perto". Como você transforma (lat, long) num único valor ordenável onde perto fica perto?',
      askWho: [
        {
          name: 'Rayssa Guedes',
          why: 'Cobertura REAL de hashing: implementou hashmap do zero, fez hash functions, hash tables e Consistent Hashing. Geohash é literalmente hashing espacial (transformar coordenada em chave bucketizável). É o beat dela, começa com ela.',
        },
        {
          name: 'Lorena Garcia',
          why: 'Fez Binary Search (e variações no LeetCode). O geohash É busca binária em cada eixo. Ela tem o modelo mental de "interval halving" pra entender o encoding e a virada pra range query.',
        },
        {
          name: 'Leunam Sousa',
          why: 'Estudou trie (em "5 wild data structures"), que é busca por prefixo. Bom pra ancorar a ideia de "prefixo compartilhado = proximidade".',
        },
      ],
      followup:
        'Geohash é uma grade de tamanho fixo. O que acontece no centro lotado da cidade, onde 5 mil carros caem na mesma célula?',
      gotcha:
        'Quando a sala aceitar o prefixo rápido demais, devolva: "dois pontos a 10 metros, um de cada lado de uma borda de célula. Quanto prefixo eles compartilham? Pode ser zero. E agora?"',
      scenarios: {
        right: {
          shape:
            'Chega na ideia de codificar (lat,long) num string ordenável onde prefixo = proximidade (geohash), e sacou que isso vira range/prefix query num B-tree. Bônus se levanta o problema da borda e propõe as 9 células.',
          redirect:
            'Confirme e adicione a armadilha se faltou: "perfeito, 2D virou prefixo 1D. Mas a regra é de mão única. Dois pontos colados na borda podem ter zero prefixo comum. Como você não perde esse vizinho?" (9 células).',
        },
        close: {
          shape:
            'Propõe uma grade de células e olhar a célula do usuário, mas esquece as vizinhas (problema da borda), ou trata a célula como se fosse um raio exato.',
          redirect:
            'Puxe a borda e o re-rank: "e o carro a 10m, do outro lado da linha da célula? E a célula é retângulo, o canto está mais longe que o raio. Como você corrige os dois?"',
        },
        wayOff: {
          shape:
            'Quer indexar lat e long em duas colunas separadas e cruzar, ou propõe um id de cidade/bairro manual em vez de uma codificação espacial.',
          redirect:
            'Mostre o furo do 1D: "índice em lat te dá todo mundo na sua latitude, do Brasil ao Japão. Como uma única chave captura as DUAS dimensões de uma vez?"',
        },
      },
    },
    {
      id: 'quadtree-h3',
      label: 'Grades melhores: quadtree e o hexágono H3',
      group: 'index',
      beat: 4,
      teachFromZero: true,
      tags: ['quadtree', 'h3', 'hexagono', 'resolucao', 'hotspot'],
      oneLine:
        'Grade fixa sofre com hotspot (centro lotado). Quadtree se adapta à densidade; o H3 da Uber usa hexágonos, onde todo vizinho fica à mesma distância.',
      pass1:
        'Geohash é uma grade de tamanho fixo, e isso machuca no centro da cidade: numa célula do centro às vezes caem milhares de carros, em outra no subúrbio cai nenhum. Duas ideias resolvem isso por caminhos diferentes. Quadtree: uma árvore que subdivide UMA célula em 4 só onde a densidade pede, então o centro lotado vira muitas células pequenas e o subúrbio vazio fica uma célula grande. H3, o índice da Uber: troca o quadrado pelo hexágono, e a sacada é geométrica, todo vizinho de um hexágono fica exatamente à mesma distância, o que limpa as contas de raio e de movimento.',
      pass2:
        'O **quadtree** é uma árvore onde cada nó é uma região, e quando uma região fica densa demais ela se divide em 4 quadrantes filhos, recursivamente. Áreas vazias ficam rasas (poucos nós), áreas lotadas ficam profundas. Isso resolve o hotspot do centro de graça, porque a estrutura se adapta à densidade. O custo: quando os pontos se movem muito, a árvore precisa ser rebalanceada/reconstruída, e isso pesa.\n\nO **H3** da Uber ataca por outro ângulo: hexágonos em vez de quadrados. Por que hexágono? Porque a distância do centro de um hexágono pra cada um dos 6 vizinhos é a MESMA (uma só distância). Num quadrado tem duas distâncias: os 4 vizinhos de lado estão mais perto que os 4 de canto. Essa ambiguidade de duas distâncias suja toda conta de raio e de vizinhança. Com hexágono, "pegue tudo num raio de k células" (o k-ring) vira um círculo limpo: k=1 te dá 7 hexágonos (você mais 6 vizinhos), k=2 dá 19, todos sempre à mesma distância. O erro quando um carro cruza de célula é mínimo, porque o hexágono é o polígono que mais parece um círculo e ainda ladrilha o plano.\n\nNúmeros pra dar concretude: H3 tem **16 resoluções** (0 grossa a 15 fininha), cada célula é um **inteiro de 64 bits**, e cada resolução é ~1/7 da área da anterior. Pra intuição: resolução 7 ~5km² (uma vizinhança), resolução 8 ~0.74km² (um distrito), resolução 9 ~0.1km² (um quarteirão). Pra subir de nível (zoom out) você praticamente trunca os bits do índice, hierarquia barata.\n\nDois trade-offs honestos do H3: como não dá pra ladrilhar uma esfera só com hexágonos, ele tem exatamente **12 pentágonos** em cada resolução (colocados sobre oceanos pra atrapalhar pouco), e os filhos NÃO encaixam perfeito dentro do pai (diferente do quadtree, onde 4 quadrados enchem o quadrado pai certinho). Ou seja, a hierarquia do H3 é aproximada. Você troca o encaixe perfeito do quadrado pela distância uniforme do hexágono. A Uber usa H3 pra surge pricing (medir oferta vs demanda por hexágono) e pra analytics do mapa.',
      pass3: [
        {
          gotcha: 'Achar que hexágono encaixa igual quadrado',
          note: 'Quadtree: 4 quadrados filhos enchem o pai perfeito. H3: um hexágono não se divide em 7 hexágonos certinhos, os filhos cruzam a borda do pai. A hierarquia do H3 é aproximada. Esse é o preço da distância uniforme.',
        },
        {
          gotcha: 'Dizer que quadrado tem 4 vizinhos',
          note: 'Pra adjacência são 8 (4 de lado + 4 de canto), em DUAS distâncias diferentes (o viés de canto). Essa ambiguidade é justamente por que o hexágono (uma distância só) ganha. Contar só os 4 de lado some com o motivo do problema.',
        },
        {
          gotcha: 'Esquecer os 12 pentágonos',
          note: 'Existem em TODA resolução, não só na 0. Um pentágono tem 5 vizinhos e geometria distorcida. Código de k-ring que assume sempre 6 vizinhos quebra perto deles. A Uber os esconde sobre oceano.',
        },
        {
          gotcha: 'Quadtree em conjunto que se move muito',
          note: 'A força do quadtree (adaptar à densidade) vira fraqueza quando os pontos andam: a árvore desbalanceia e precisa reconstruir. Pra motoristas em movimento, o custo de manutenção é real.',
        },
      ],
      anchor:
        'Geohash é grade fixa, e no centro da cidade uma célula tem 5 mil carros. Proponha DUAS formas de melhorar isso, uma que adapta o tamanho da célula e uma que troca o formato dela.',
      askWho: [
        {
          name: 'Lorena Garcia',
          why: 'Única com cobertura REAL de árvore: fez "Data structures: Binary Search Tree" além de "5 wild data structures". Quadtree é uma árvore de subdivisão, então ela é a âncora natural aqui.',
        },
        {
          name: 'Leunam Sousa',
          why: 'Fez "5 wild data structures" (tree + trie). Bom segundo pra parte de estruturas e subdivisão recursiva.',
        },
        {
          name: 'open',
          why: 'Árvore é fina no cohort (a maioria só viu o vídeo de overview "10 Key Data Structures") e H3 ninguém estudou. Depois da Lorena, abra: o "por que hexágono" se resolve raciocinando, não lembrando. Quem sacar a distância uniforme acertou o coração.',
        },
      ],
      followup:
        'Agora você acha os candidatos perto rápido. Mas o motorista do outro lado do rio está perto no mapa e longe no trânsito. Quem está "mais perto" de verdade?',
      gotcha:
        'Quando alguém disser "hexágono é firula", devolva: "qual a distância do centro de um quadrado pros vizinhos? Tem duas: lado e canto. E do hexágono? Uma só. Isso muda a conta de raio. Firula?"',
      scenarios: {
        right: {
          shape:
            'Propõe quadtree (subdivisão adaptativa por densidade) pra resolver o hotspot, E hexágono/H3 (uma distância de vizinho) pra limpar as contas de raio. Bônus se cita o trade-off do encaixe aproximado ou os 12 pentágonos.',
          redirect:
            'Confirme os dois ângulos: "isso, adaptar o tamanho (quadtree) ou trocar o formato (hexágono). Agora o pulo final: achar candidatos perto resolve metade. O motorista do outro lado do rio está perto?"',
        },
        close: {
          shape:
            'Chega no quadtree pra densidade mas não vê o ângulo do formato (hexágono), ou cita H3 sem saber explicar por que hexágono ganha do quadrado.',
          redirect:
            'Puxe a geometria: "por que a Uber escolheu hexágono e não quadrado? Conta os vizinhos de um quadrado e mede as distâncias. Quantas distâncias diferentes? E do hexágono?"',
        },
        wayOff: {
          shape:
            'Quer só diminuir o tamanho da célula geohash uniformemente (que cria células de menos no subúrbio e ainda lota o centro), ou acha que troca de estrutura resolve o problema da escrita.',
          redirect:
            'Mostre o limite da grade uniforme: "célula menor pra todo mundo lota a memória com células vazias no subúrbio e ainda pode lotar o centro. Como você deixa a ESTRUTURA decidir onde subdividir?"',
        },
      },
    },
    // ──────────────── DISPATCH: o clímax ────────────────
    {
      id: 'disco-eta',
      label: 'DISCO: o índice acha candidatos, o ETA escolhe',
      group: 'dispatch',
      beat: 5,
      teachFromZero: true,
      tags: ['candidate-vs-rank', 'eta', 'crow-flies', 'road-graph', 'retrieve-then-rank'],
      oneLine:
        'O índice espacial só gera CANDIDATOS. Quem escolhe é o ETA na malha viária, porque perto em linha reta mente: o motorista do outro lado do rio está perto e demora.',
      pass1:
        'Aqui mora a sacada que separa uma resposta boa de uma medíocre. Tudo que a gente construiu (geohash, quadtree, H3) só faz UMA coisa: achar rápido um punhado de motoristas que estão fisicamente perto. Isso é geração de candidatos, não a escolha final. O sistema de dispatch da Uber (historicamente o DISCO) faz duas etapas: primeiro o índice espacial filtra os candidatos por proximidade aproximada; depois esses poucos candidatos vão pro serviço de roteamento, que calcula o tempo de chegada (ETA) pela malha viária real e ordena por isso. Porque perto em linha reta engana: um carro do outro lado do rio, ou na contramão de uma avenida de mão única, está coladinho no mapa e a 8 minutos de você.',
      pass2:
        'A regra de ouro: **o índice é um filtro, não o ranqueador**. Ele existe pra baratar, transformar milhões de motoristas num punhado na sua vizinhança. A conta cara e precisa (roteamento pela malha viária) roda só nesse punhado, nunca em todos.\n\nPor que linha reta mente, em concreto: distância de grande círculo ignora o grafo de ruas. Rio no meio, canteiro central de uma via dividida, labirinto de mão única. Dois pontos a 200 metros em linha reta podem estar a 5 minutos de carro. O ETA pela malha captura isso, o índice sozinho não. O DISCO chega a preferir um motorista que está TERMINANDO uma corrida perto de você a um motorista ocioso mais longe, porque o objetivo é minimizar seu tempo de espera, não a distância no instante.\n\nComo o ETA é calculado: a cidade vira um **grafo direcionado e ponderado**, onde cruzamentos são nós e trechos de rua são arestas com peso (tempo, misturando velocidade histórica e trânsito ao vivo). Achar o caminho mais curto é um problema de grafo. Dijkstra puro roda em tempo proporcional a (nós + arestas)·log, lento demais no tamanho de uma metrópole (a Bay Area tem ~500 mil cruzamentos), então a Uber particiona o grafo e pré-computa caminhos dentro das partições, derrubando a busca de ~500 mil nós pra ~700 por consulta.\n\nO nome desse padrão, e a coisa mais transferível da aula toda: **retrieve-then-rank** (recupera, depois ranqueia). Um filtro grosso e barato gera candidatos, um score caro e preciso escolhe entre eles. Vale pra Uber, pra busca, pra recomendação, pra qualquer sistema onde rodar o score caro em tudo seria inviável.',
      pass3: [
        {
          gotcha: 'Deixar o índice ser o ranqueador',
          note: 'Se você ordena por distância de célula/linha reta e para por aí, você entrega o bug do "do outro lado do rio". O índice gera candidatos; o ranking de verdade é o ETA pela malha viária.',
        },
        {
          gotcha: 'Confundir distância com tempo',
          note: '200m em linha reta podem ser 5+ minutos de carro (rio, via dividida, mão única). Distância é um proxy barato pra montar o candidato, nunca o score final.',
        },
        {
          gotcha: 'Achar que o ocioso mais perto é sempre o melhor',
          note: 'O DISCO pode escolher um motorista terminando uma corrida ali perto em vez de um ocioso mais longe. O objetivo é minimizar espera/eficiência do sistema via ETA previsto, não a ociosidade do instante.',
        },
        {
          gotcha: 'Rodar Dijkstra puro na cidade inteira',
          note: 'Tempo proporcional a (nós + arestas)·log sobre ~500 mil nós por request não fecha. Particionar o grafo e pré-computar caminhos dentro das partições derruba a busca pra centenas de nós. Roteamento em escala é grafo + pré-computação.',
        },
      ],
      anchor:
        'Seu índice devolve os 10 motoristas mais perto em linha reta. O número 1 está a 200m, do outro lado de um rio, a 8 minutos. O número 4 está a 600m, a 3 minutos. Quem o app deve mandar, e como ele sabe disso?',
      askWho: [
        {
          name: 'open',
          why: 'Grafo é um BURACO no cohort: todo mundo que "tem" graph pegou só do vídeo de overview "10 Key Data Structures", ninguém fez travessia/roteamento de verdade. Abra pra sala raciocinar sobre "perto != rápido", é a sacada central e se resolve pensando.',
        },
        {
          name: 'Maria Clara',
          why: 'Maior breadth do cohort, mas o graph dela é só o overview (10 Key Data Structures), não travessia nem roteamento real. Use como backup pra ENQUADRAR a cidade como grafo em palavras de system design. O raciocínio "perto não é rápido" fica com a sala (open), não com ela.',
        },
        {
          name: 'Cauan da Rocha',
          why: 'Também viu o overview de graph (tem tree+hashmap+graph do mesmo vídeo). Vale chamar pra trazer voz nova: esse beat premia raciocínio na hora, não memória de estudo prévio.',
        },
      ],
      followup:
        'Temos as peças: índice em memória, células, candidatos, ranking por ETA. Hora de montar. Desenha o caminho de um pedido de corrida, ponta a ponta.',
      gotcha:
        'Quando alguém ordenar por distância e parar, devolva: "o mais perto está do outro lado do rio, a 8 minutos. O quarto mais perto chega em 3. Distância escolheu errado. O que o app deveria ter medido?"',
      scenarios: {
        right: {
          shape:
            'Manda o de 3 minutos e explica: distância em linha reta é só pra gerar candidatos, o ranking é por ETA na malha viária (grafo de ruas). Nomeia retrieve-then-rank: filtro grosso barato, score caro só nos candidatos.',
          redirect:
            'Confirme e feche o conceito: "exato, o índice acha candidatos, o ETA escolhe. Esse é o padrão retrieve-then-rank. Agora junta tudo num diagrama: o pedido entra, e daí?"',
        },
        close: {
          shape:
            'Sente que o mais perto nem sempre é o melhor mas resolve com "raio maior" ou "mais candidatos", sem chegar no roteamento por ETA na malha.',
          redirect:
            'Puxe pro tempo: "mais candidatos não conserta que linha reta mente. O que faz o carro do outro lado do rio parecer perto? Como você mede o tempo REAL até você?"',
        },
        wayOff: {
          shape:
            'Insiste em ordenar por distância de célula/linha reta, ou acha que o índice espacial já entrega o melhor match sozinho.',
          redirect:
            'Force o contraexemplo: "o índice diz que o número 1 está a 200m. Mas tem um rio no meio. O índice sabe do rio? Quem sabe do rio?"',
        },
      },
    },
    // ──────────────── ARQUITETURA (mandatory) ────────────────
    {
      id: 'arquitetura',
      label: 'Arquitetura: o fluxo completo',
      group: 'dispatch',
      beat: 6,
      tags: ['write-path', 'read-path', 'shard-by-cell', 'in-memory', 'async-persist'],
      oneLine:
        'O pedido de corrida atravessa duas trilhas opostas: o firehose de localização (escrita) e a busca de candidatos mais ranking por ETA (leitura), num índice em memória sharded por célula.',
      pass1:
        'Hora de montar o diagrama. Tem duas trilhas correndo o tempo todo, com perfis opostos. A trilha de ESCRITA é o firehose: ~2 milhões de motoristas mandando posição a cada ~4s, atualizando o índice espacial em memória. A trilha de LEITURA é o pedido de corrida: pega a célula do passageiro mais as vizinhas, busca os candidatos, manda pro roteamento ranquear por ETA, oferta pro motorista. O segredo do design é que o índice espacial é o ponto onde as duas trilhas se encontram, e ele é sharded pela própria célula (o cell id é a chave de shard), o que faz cada região cair num conjunto de nós dedicado.',
      pass2:
        '**Write path** (o motorista anda). O ping de GPS chega a cada ~4s. Em vez de gravar numa linha durável de banco, ele atualiza o índice espacial **em memória**: tira o motorista da célula antiga, põe na nova (um delete + insert barato). Como localização tolera ~30s de atraso, o histórico vai pra uma **fila** e é persistido de forma assíncrona, fora do caminho quente. O índice é **sharded pelo cell id**, então o write de cada motorista bate só no shard da região dele.\n\n**Read path** (o passageiro pede). Calcula a célula do passageiro, monta o conjunto de células que cobrem o raio de busca (a central mais as vizinhas), e faz **fan-out só pra esses shards**, não pro mundo todo. Cada shard devolve os motoristas da sua célula. Isso reduz a busca de ~2 milhões pra alguns milhares de candidatos, em sub-milissegundo.\n\n**Ranking.** Os candidatos vão pro serviço de roteamento, que calcula ETA na malha viária e ordena. Só então a oferta é feita ao melhor motorista. Filtro grosso (índice) e rank fino (ETA), exatamente o retrieve-then-rank do beat anterior, agora desenhado.\n\n**Como sharda e se mantém de pé.** O cell id é a chave natural de shard (no dispatch da Uber, historicamente uma célula S2, enquanto o H3 move surge e analytics). A Uber distribui esses shards com **consistent hashing** e membership por gossip (a lib ringpop, estilo SWIM), pra adicionar/remover nós sem reembaralhar tudo. É o mesmo consistent hashing de antes, agora aplicado à célula. A escala que isso sustenta: ~40 milhões de corridas por dia, ~1 milhão de requisições por segundo no caminho de matching.',
      pass3: [
        {
          gotcha: 'Tratar o write como linha durável de banco',
          note: 'Gravar cada ping num banco durável mata o sistema (WAL/fsync em 1M writes/s). O caminho quente é índice em memória; durabilidade vem depois, async, via fila. Staleness de ~30s é o que libera isso.',
        },
        {
          gotcha: 'Fan-out de leitura pra todos os shards',
          note: 'A leitura deve tocar só os shards das células que cobrem o raio (central + vizinhas), não todos. O cell id como chave de shard é o que permite o fan-out cirúrgico.',
        },
        {
          gotcha: 'Misturar ranking dentro do índice',
          note: 'O índice devolve candidatos. O ETA ranqueia. Se você tentar ranquear por ETA dentro do shard espacial, mistura duas responsabilidades e perde a separação que deixa cada parte escalar sozinha.',
        },
        {
          gotcha: 'Esquecer o rebalanceamento ao escalar nós',
          note: 'Shard por célula com hash comum reembaralha tudo ao adicionar um nó. Consistent hashing (ringpop) move só uma fração das células. É o mesmo motivo de usar consistent hashing em cache distribuído.',
        },
      ],
      anchor:
        'Desenhe o caminho completo: do motorista mandando GPS a cada 4s até o passageiro recebendo a oferta. Separe a trilha de escrita da de leitura, e diga onde o índice espacial vive e por qual chave ele é sharded.',
      askWho: [
        {
          name: 'Eduardo Hirohito',
          why: 'O perfil de infra mais completo: sharding ("Como Escalar Banco de Dados?"), scalability, databases. É quem desenha write path e read path separados e justifica o shard por célula. Começa com ele.',
        },
        {
          name: 'Rayssa Guedes',
          why: 'Fez Consistent Hashing, que é exatamente como o índice é distribuído por nós (ringpop). Âncora perfeita pra parte de "shard pela célula sem reembaralhar".',
        },
        {
          name: 'Lorena Garcia',
          why: 'databases + scalability. Boa pra puxar a separação leitura/escrita e a ideia de persistir histórico async fora do caminho quente.',
        },
      ],
      followup:
        'Diagrama no quadro. Pra cada caixa (ingest de localização, índice em memória, estado do motorista, roteamento), qual managed service da AWS, e por quê?',
      gotcha:
        'Quando o desenho gravar localização num Postgres, devolva: "1 milhão de updates de posição por segundo num banco durável. Quanto tempo até o WAL te derrubar? Onde esse dado realmente precisa viver?"',
      scenarios: {
        right: {
          shape:
            'Desenha write path (ping ~4s → índice em memória, delete+insert na célula, histórico async via fila) separado do read path (célula + vizinhas → fan-out só nos shards → candidatos → ETA rank). Diz que o cell id é a chave de shard e cita consistent hashing.',
          redirect:
            'Confirme a separação e empurre pra nuvem: "perfeito, duas trilhas, índice em memória sharded por célula. Agora mapeia cada caixa pra um serviço da AWS."',
        },
        close: {
          shape:
            'Acerta o read path (células + candidatos + ETA) mas trata o write como gravação durável de banco, ou não diz por qual chave sharda.',
          redirect:
            'Puxe write e shard: "1M writes/s num banco durável aguenta? E quando você adiciona um nó, quantas células reembaralham? Qual a chave de shard que evita isso?"',
        },
        wayOff: {
          shape:
            'Desenha um monolito com tudo num banco, sem separar as trilhas, ou faz a leitura varrer todos os shards.',
          redirect:
            'Resgate as peças: "cadê o índice em memória? Cadê o fan-out só nas células vizinhas? Refaz começando pelo ping de GPS: ele chega, e atualiza o quê, onde?"',
        },
      },
    },
    // ──────────────── AWS (mandatory) ────────────────
    {
      id: 'aws',
      label: 'AWS: cada caixa, um managed service',
      group: 'cloud',
      beat: 7,
      tags: ['kinesis', 'elasticache-redis', 'dynamodb', 's3', 'geosearch'],
      oneLine:
        'Pra cada caixa do diagrama existe um serviço gerenciado da AWS, e a escolha é ditada pelo perfil de carga: firehose de escrita, índice em memória, estado, histórico frio.',
      pass1:
        'Com o diagrama no quadro, a pergunta: se fosse subir na AWS amanhã, qual serviço gerenciado entra em cada caixa? A bússola é a mesma da aula: o perfil de carga da caixa manda. Firehose de localização pede uma coisa, índice geo em memória pede outra, estado do motorista outra, histórico frio outra. E tem uma escolha que parece óbvia e é uma armadilha: por que NÃO botar tudo num Postgres com extensão geográfica.',
      pass2:
        '**Ingest de localização (firehose de ~1M writes/s)**: um **stream**, Kinesis Data Streams ou MSK (Kafka gerenciado). Absorve o rio de pings, desacopla o produtor (apps dos motoristas) dos consumidores (o índice e o persistidor de histórico), e deixa você reprocessar.\n\n**O índice geo em memória**: **ElastiCache for Redis**. O Redis tem comandos geo nativos (GEOADD pra indexar a posição, GEOSEARCH pra buscar num raio/caixa ordenado por distância), com latência sub-milissegundo. E o pulo do gato que amarra a aula toda: por baixo, o Redis GEO é um sorted set cujo SCORE é um geohash de 52 bits da coordenada. O índice da Uber É o geohash do beat 3, dentro do Redis.\n\n**Estado do motorista e da corrida** (online/offline, corrida atual, perfil): **DynamoDB**, chave-valor de baixa latência e alto throughput, sharda sozinho. **Histórico de localização** (o persistido async pra analytics e auditoria): **S3** (com Glacier pro frio), centavos por GB pra dado que quase nunca é lido. **Serviço de matching e roteamento** (stateful, latência baixa, conexões vivas): **ECS/EC2** com auto scaling, não Lambda, porque você quer processos quentes segurando o índice e as conexões, não cold starts.\n\n**A armadilha do PostGIS.** Postgres com a extensão PostGIS e um índice GIST faz busca espacial muito bem, e pra um app de bairro é a resposta certa. Mas no perfil da Uber, ~1 milhão de updates de localização por segundo, o banco durável morre no write (WAL/fsync por linha). PostGIS é ótimo pra dados espaciais que mudam devagar (lojas, imóveis, zonas), péssimo pro firehose de pontos que andam. O perfil de ESCRITA é o que elimina o candidato mais óbvio.',
      pass3: [
        {
          gotcha: 'Botar o índice geo num Postgres/PostGIS',
          note: 'PostGIS é excelente pra dados espaciais que mudam devagar. Pro firehose de ~1M writes/s de localização, o banco durável trava. O índice quente vai pra memória (Redis GEO); PostGIS fica pra dado geográfico estável.',
        },
        {
          gotcha: 'Usar Lambda pro serviço de matching',
          note: 'Matching é stateful e sensível a latência, quer processos quentes segurando índice e conexões. Cold start de Lambda mata o p99. ECS/EC2 com ASG cabe melhor; Lambda brilha em carga esporádica e stateless.',
        },
        {
          gotcha: 'Gravar localização direto no DynamoDB por ping',
          note: 'DynamoDB guarda bem estado (online, corrida atual), mas escrever cada ping de posição direto nele é caro e desnecessário, o quente é o Redis em memória. Histórico vai pro S3 via stream, async.',
        },
        {
          gotcha: 'Esquecer que Redis GEO é geohash por baixo',
          note: 'GEOADD/GEOSEARCH parecem mágica, mas o score do sorted set é um geohash de 52 bits. É o mesmo conceito do beat 3. Saber disso te deixa raciocinar sobre precisão e limites, não só chamar o comando.',
        },
      ],
      anchor:
        'Diagrama do beat anterior no quadro. Pra cada caixa (firehose de localização, índice geo em memória, estado do motorista, histórico), qual serviço da AWS, e por que o perfil de carga justifica? E por que NÃO um Postgres com PostGIS pra tudo?',
      askWho: [
        {
          name: 'Rayssa Guedes',
          why: 'Fez "AWS do Zero: Os Únicos Serviços que Você Precisa Conhecer", a única com exposição real a cloud no cohort. Começa com ela pra mapear caixa a serviço.',
        },
        {
          name: 'Maria Clara',
          why: 'Maior breadth (16 tópicos). Forte pra justificar Kinesis vs banco e a separação de serviços por perfil de carga.',
        },
        {
          name: 'Eduardo Hirohito',
          why: 'Infra completa (sharding, scalability, databases). Bom pra cravar por que PostGIS não aguenta o write e por que ECS/EC2 e não Lambda.',
        },
      ],
      followup:
        'Olhando o sistema inteiro: o que se repetiu em relação a outros designs (URL Shortener, Chat, Ledger)? Qual foi a virada que destravou tudo aqui?',
      gotcha:
        'Quando alguém botar PostGIS pra tudo, devolva: "PostGIS aguenta as lojas de uma cidade lindamente. Aguenta 1 milhão de pontos que andam, reescrevendo a posição a cada 4 segundos? Quem trava primeiro?"',
      scenarios: {
        right: {
          shape:
            'Mapeia Kinesis/MSK pro firehose, ElastiCache Redis (GEO) pro índice quente, DynamoDB pro estado, S3 pro histórico frio, ECS/EC2 pro matching. Justifica pelo perfil de carga e explica por que PostGIS não aguenta o write. Bônus: Redis GEO é geohash por baixo.',
          redirect:
            'Feche o arco: "cada caixa pelo perfil, não pela familiaridade. Pergunta de síntese: o que se repetiu dos outros designs, e qual foi a virada aqui?" (transformar 2D em chave 1D + retrieve-then-rank).',
        },
        close: {
          shape:
            'Escolhe serviços razoáveis mas justifica por familiaridade, ou bota o índice quente no DynamoDB/Postgres sem ver que o firehose pede memória.',
          redirect:
            'Puxe o perfil: "o índice recebe 1M writes/s e responde em sub-ms. Isso é perfil de banco durável ou de memória? E o histórico que quase nunca é lido, paga storage quente?"',
        },
        wayOff: {
          shape:
            'Joga tudo num PostGIS único, ou usa Lambda pro matching, ou escolhe serviços sem ligar com o diagrama.',
          redirect:
            'Reancore: "esquece o nome do serviço. Essa caixa escreve 1M/s e lê em sub-ms (memória), ou guarda estado (kv), ou arquiva frio (object store)? Escolhe o serviço que casa com ISSO."',
        },
      },
    },
    // ──────────────── SYNTHESIS (study-only) ────────────────
    {
      id: 'synthesis',
      label: 'Proximidade é um problema 1D disfarçado',
      group: 'synthesis',
      oneLine:
        'A aula inteira cabe em duas frases: transforme o espaço 2D numa chave ordenável, e nunca deixe o filtro grosso ser o ranking fino.',
      pass1:
        'A gente começou com uma curiosidade (como acha o motorista mais perto?) e terminou no DISCO da Uber. Dois fios conectam tudo. Primeiro: proximidade parece um problema de geometria 2D, mas a sacada é transformá-la numa chave 1D ordenável (geohash, célula H3, score do Redis), porque aí qualquer índice comum resolve a busca. Segundo: achar quem está perto é só o filtro; quem decide é o score caro (ETA), rodado só nos candidatos. Quase todo sistema de "ache o X perto de mim" é essa dupla.',
      pass2:
        'Reconstruindo a escada: medir distância pra todos é O(N) e, pior, o firehose de localização (~1M writes/s) colide com a leitura numa estrutura mutável. A saída é um índice espacial em memória. Geohash mostra o truque central, intercalar os bits de lat e long num string onde prefixo é proximidade, então 2D vira range query 1D. A grade fixa sofre com hotspot, então quadtree adapta o tamanho à densidade e o H3 troca o quadrado pelo hexágono (uma distância de vizinho, contas de raio limpas).\n\nUma vez que você tem candidatos baratos, o problema migra: perto em linha reta mente. O motorista do outro lado do rio está colado e distante. Por isso o índice só FILTRA, e o ETA na malha viária (um grafo de ruas, com Dijkstra particionado) RANQUEIA. Esse é o **retrieve-then-rank**, o padrão mais transferível da aula.\n\nE o que se repete dos outros designs: o **consistent hashing** volta (a célula é a chave de shard, ringpop distribui sem reembaralhar); a separação **write path vs read path** volta (o firehose em memória persistido async, a leitura tocando só as células vizinhas); e a regra de que **o perfil de carga dita a tecnologia** volta (1M writes/s tira o Postgres da mesa). Sistema diferente, primitivas iguais.\n\nO pulo final, pra fora de mapas: "transforme o caro multi-dimensional numa chave ordenável + filtro grosso + rank fino" descreve busca textual (índice invertido + BM25 rerank), recomendação (candidate generation + modelo de ranking), e qualquer k-NN em escala. Geohash é a versão geográfica de uma ideia que está em todo lugar.',
      pass3: [
        {
          gotcha: 'Levar só "usa geohash"',
          note: 'Geohash é a casca. O miolo é "2D vira chave 1D ordenável, e busca por vizinho é filtro grosso + rank fino". Quem sai só com o nome da estrutura perdeu o padrão que a aula existe pra entregar.',
        },
        {
          gotcha: 'Achar que o índice resolve o matching',
          note: 'O índice acha candidatos perto. Perto não é melhor (o rio). O matching de verdade é o ETA ranqueando os candidatos. Filtro e ranking são etapas diferentes, com tecnologias diferentes.',
        },
        {
          gotcha: 'Esquecer que o custo migrou',
          note: 'O índice barateia a busca, mas o problema vira o firehose de escrita e o ranking por ETA. Todo design move o custo de lugar. Maturidade é saber pra onde ele foi.',
        },
      ],
      anchor:
        'Um recrutador pede a regra geral em uma frase, sem dizer "distância": o índice espacial faz O QUÊ com os 2 milhões de motoristas, e o que ele explicitamente NÃO decide?',
      followup:
        'Onde, fora de mapas, você usaria "transformar o caro em chave ordenável + filtro grosso + rank fino"?',
      gotcha:
        'Se a síntese da sala for "usa geohash", devolva: "geohash é o minuto 10. E o motorista do outro lado do rio? O que a aula passou os outros 50 minutos construindo?"',
    },
  ],
};
