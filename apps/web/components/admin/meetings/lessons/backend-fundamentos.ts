import type { Lesson } from '../lesson-types';

export const backendFundamentos: Lesson = {
  slug: 'backend-fundamentos',
  title: 'Backend de Verdade, REST, Express + MVC e NestJS',
  subtitle: 'Backend · Fundamentos',
  blurb:
    'Como um backend funciona na prática: REST como padrão, Express + MVC como o que vocês já usam no módulo, NestJS como a evolução opinada que vocês vão ver em produção. Foco em ler doc de API, estruturar features, e entender pra onde o request vai depois de chegar no servidor.',
  durationMin: 90,
  audience: 'Empresa Jr · Calouros',
  slidesUrl: '/slides/backend-fundamentos.html',
  nodes: [
    // ─── Foundation A: HTTP em 2 minutos ──────────────────────────────────────
    {
      id: 'http-foundation',
      label: 'HTTP em 2 minutos',
      group: 'foundations',
      teachFromZero: true,
      tags: ['http', 'verbo', 'status-code', 'header', 'body', 'request', 'response'],
      oneLine:
        'HTTP é uma conversa de texto entre cliente e servidor. Toda comunicação web é um request (pergunta) e uma response (resposta) seguindo o mesmo formato.',
      pass1:
        'Cliente manda um request com verbo (GET, POST, etc.), caminho (/users/42), headers e opcionalmente body. Servidor responde com status code (200, 404, 500), headers e body. Esse loop é literalmente a internet inteira que você consome, e é o que você vai escrever quando criar um backend.',
      pass2:
        '**Anatomia do request**: a primeira linha é `GET /users/42 HTTP/1.1`. Depois vêm headers (`Authorization: Bearer ...`, `Content-Type: application/json`). Se for POST ou PUT, vem um body (geralmente JSON). Cada parte tem um papel claro.\n\n**Verbos comuns**: `GET` lê, `POST` cria, `PUT` substitui, `PATCH` atualiza parcial, `DELETE` apaga. Você vai usar GET e POST 90% do tempo.\n\n**Status codes em famílias**: `2xx` deu certo (200 OK, 201 Created, 204 No Content). `4xx` erro do cliente (400 Bad Request, 401 sem auth, 403 sem permissão, 404 não existe). `5xx` erro do servidor (500 deu ruim). Saber dizer o status correto é metade da qualidade de uma API.\n\n**Stateless**: cada request carrega tudo que precisa pra ser entendido. O servidor não lembra que você fez um request 2 segundos atrás. Por isso autenticação vai em header (`Authorization`) em todo request, não numa sessão escondida.',
      pass3: [
        {
          gotcha: '404 é "não existe", não "deu erro"',
          note: 'Se o usuário /users/42 não existe, retorna 404. Se a query do banco quebrou, retorna 500. Misturar os dois esconde bugs reais como "rota errada".',
        },
        {
          gotcha: 'GET não tem body (na prática)',
          note: 'Tecnicamente a spec HTTP permite, mas servidores e libs frequentemente ignoram body em GET. Filtros vão em query string (`?status=active`), não em body.',
        },
        {
          gotcha: 'OPTIONS aparece sozinho antes do POST de fetch',
          note: 'Browser dispara um OPTIONS (preflight CORS) antes de POST/PUT/DELETE em domínio diferente. Se sua API não responde OPTIONS, o POST real nunca acontece.',
        },
      ],
      anchor:
        'Você abre o DevTools, aba Network, e clica num botão de qualquer site. Aparece uma linha. Quais campos dessa linha são a "conversa" entre browser e servidor?',
      followup:
        'OK, você sabe a forma de um request. Agora o que vai dentro dele? Como você manda dados estruturados?',
      gotcha:
        'Se HTTP é texto, como o servidor sabe se o body é JSON, XML, ou um upload de imagem?',
    },

    // ─── Foundation B: JSON em 2 minutos ──────────────────────────────────────
    {
      id: 'json-foundation',
      label: 'JSON em 2 minutos',
      group: 'foundations',
      teachFromZero: true,
      tags: ['json', 'object', 'array', 'content-type', 'parse', 'stringify'],
      oneLine:
        'JSON é o formato texto que virou universal pra troca de dados entre cliente e servidor. Object, array, string, number, boolean, null. Só isso.',
      pass1:
        'JSON nasceu do JavaScript mas hoje é falado por toda linguagem. Backend serializa um objeto em JSON, manda no body do response, frontend faz parse e vira objeto de novo. A API moderna fala JSON por padrão, `Content-Type: application/json` é o cabeçalho mais comum da web.',
      pass2:
        '**Tipos suportados**: objeto `{}`, array `[]`, string, number, boolean (true/false), e null. Não tem `undefined`. Não tem data nativa (vira string). Não tem comentário. Não pode ter vírgula sobrando depois do último item.\n\n**Em código**: `JSON.stringify(obj)` transforma objeto em string. `JSON.parse(str)` faz o caminho inverso. Esses dois você vai chamar centenas de vezes.\n\n**Header obrigatório**: quando você manda JSON no body, precisa setar `Content-Type: application/json`. Sem isso, o servidor pode tratar o body como texto puro e nunca parsear. Frameworks como NestJS já configuram isso automaticamente.\n\n**Não é texto qualquer**: JSON tem regras de sintaxe. Chave precisa estar entre aspas duplas, string também. Aspa simples não vale. Validador online (jsonlint) é seu amigo quando der erro de parse.',
      pass3: [
        {
          gotcha: '`Date` em JSON vira string ISO',
          note: '`JSON.stringify(new Date())` produz `"2026-05-21T10:30:00.000Z"`. Você precisa converter de volta com `new Date(str)` ao parsear.',
        },
        {
          gotcha: '`undefined` some no stringify',
          note: 'Se você tem `{ name: "Ana", age: undefined }`, o JSON gerado é `{"name":"Ana"}`. O campo desaparece. Use `null` se quiser preservar.',
        },
        {
          gotcha: 'Trailing comma quebra o parse',
          note: '`{"a": 1, "b": 2,}` é JavaScript válido mas JSON inválido. Tipo de bug chato de pegar olhando.',
        },
      ],
      anchor:
        'Você tem um objeto `{ nome: "Ana", idade: 22 }` no backend. Como ele chega no frontend e vira um objeto JavaScript de novo?',
      followup:
        'HTTP + JSON é a base. Agora como organizamos as rotas pra não virar bagunça?',
      gotcha:
        'Se JSON não suporta Date, como APIs grandes (Stripe, GitHub) lidam com datas?',
    },

    // ─── Beat 1: REST como padrão ──────────────────────────────────────────────
    {
      id: 'rest-padrao',
      label: 'REST: o padrão',
      group: 'api',
      beat: 1,
      teachFromZero: true,
      tags: ['rest', 'resource', 'http-verb', 'status-code', 'uri', 'stateless', 'crud'],
      oneLine:
        'REST é uma convenção: URL nomeia recursos (nouns), verbo HTTP diz a ação. Não inventa, segue o padrão que o mundo todo já fala.',
      pass1:
        'Antes de REST, cada API inventava seus próprios verbos: `/pegarUsuario`, `/criarPedido`, `/atualizarEndereco`. Tudo via POST. REST diz: a URL é o substantivo (`/users`, `/orders`), o verbo HTTP é a ação. Resultado: menos decisão, mais consistência, doc menor.',
      pass2:
        '**Resource-oriented**: pensa em substantivos. `/users` (a coleção), `/users/42` (um usuário), `/users/42/orders` (pedidos desse usuário). Verbo dá a ação: `GET /users/42` lê, `POST /users` cria, `PATCH /users/42` atualiza, `DELETE /users/42` apaga.\n\n**Status codes corretos**: `201 Created` quando POST criou algo (não 200). `204 No Content` quando DELETE deu certo (sem body). `404` quando o ID não existe. `400` quando o body é inválido. `401` sem token, `403` com token mas sem permissão. A diferença é doc viva da sua API.\n\n**Stateless por design**: cada request leva consigo a autenticação (token no header). O servidor não mantém sessão pendurada. Permite que qualquer instância atenda qualquer request, o que torna escalar trivial.\n\n**Convenções de URL**: plural sempre (`/users`, não `/user`). Hifen separa palavras (`/study-sessions`, não `/studySessions`). Filtros e ordenação vão em query string (`?status=active&sort=-createdAt`).\n\n**O que REST não é**: REST não é "API que retorna JSON". Não é "API que tem versão". É um conjunto de convenções sobre URLs, verbos e status codes. Você pode quebrar REST e ter uma API funcional, mas vai gastar mais doc.',
      pass3: [
        {
          gotcha: 'PUT substitui inteiro, PATCH atualiza parte',
          note: 'PUT `/users/42` com `{name: "Ana"}` deveria substituir o usuário inteiro (email some). PATCH atualiza só os campos enviados. Na prática muita gente usa PUT como PATCH e ninguém reclama, mas a spec é clara.',
        },
        {
          gotcha: 'Verbos no URL é code smell',
          note: '`POST /createUser` ou `POST /users/delete/42` violam REST. Se você vê isso na sua API, é sinal pra refatorar. A exceção comum é ação que não é CRUD (ex: `POST /users/42/reset-password`).',
        },
        {
          gotcha: 'Status 200 pra erro é o pior dos mundos',
          note: 'Algumas APIs retornam `200 OK` com `{ error: "Not found" }` no body. Quebra tudo: cliente acha que deu certo, monitoring não conta como erro. Sempre use status code certo.',
        },
      ],
      diagram: `flowchart LR
  C["Cliente"]
  C -->|GET /users/42| S["Servidor"]
  S -->|200 OK + JSON| C
  C -->|POST /users + body| S
  S -->|201 Created| C
  C -->|DELETE /users/42| S
  S -->|204 No Content| C`,
      anchor:
        'Você vai criar a API de um sistema de tarefas. Como você nomeia a rota pra: criar tarefa, listar todas, ver uma, atualizar, deletar?',
      followup:
        'Você sabe nomear suas rotas. Agora você precisa CONSUMIR uma API que alguém já escreveu. Por onde começa?',
      gotcha:
        'Se REST é só convenção, por que não inventar minhas próprias regras? Quem perde?',
    },

    // ─── Beat 2: Lendo doc de API ──────────────────────────────────────────────
    {
      id: 'lendo-doc',
      label: 'Lendo doc de API',
      group: 'api',
      beat: 2,
      teachFromZero: true,
      tags: ['doc', 'reference', 'endpoint', 'auth', 'query-param', 'response-schema', 'openweather'],
      oneLine:
        'Toda doc de API responde 4 perguntas: qual é o endpoint, como autenticar, quais parâmetros aceitar, qual é o formato da resposta. Saber pular pro "Reference" é uma habilidade.',
      pass1:
        'Você precisa pegar a previsão do tempo de São Paulo. A maioria começa no Google ou no Stack Overflow. O atalho real é: vai direto na doc oficial, seção Reference (não Get Started), procura o endpoint, identifica auth, manda um request de teste. Isso leva 5 minutos, não 30.',
      pass2:
        '**Exemplo prático: OpenWeather Current Weather**. URL `openweathermap.org/api`. Cada endpoint mostra 4 coisas: o path (`/data/2.5/weather`), os query params aceitos (`q` cidade, `appid` chave, `units` métrica), o exemplo de resposta JSON, e os possíveis erros (401 sem chave, 404 cidade não existe).\n\n**Como achar o que importa rápido**: pula tudo que é overview marketing. Vai direto em "API Reference" ou "Endpoints". Procura o verbo HTTP e o path. Lê a tabela de parameters. Olha o exemplo de response.\n\n**Autenticação muda tudo**: APIs públicas básicas usam query param (`?appid=xxx` no OpenWeather). APIs mais sérias usam header (`Authorization: Bearer xxx`). Algumas usam OAuth (3 redirects e um token). Saber qual desses muda como você testa.\n\n**Response shape é contrato**: o JSON que volta tem estrutura previsível. Ex: OpenWeather retorna `{ main: { temp, humidity }, weather: [{ description }], name }`. Você lê uma vez e sabe acessar `data.main.temp` no código.\n\n**Rate limits e free tier**: toda API séria tem limite. OpenWeather free: 60 calls/min, 1M/mês. Excedeu, volta 429. Sempre checa esse número antes de fazer loop com fetch.',
      pass3: [
        {
          gotcha: 'API key no frontend é leak garantido',
          note: 'Se você puser `appid=xxx` em código JavaScript do browser, qualquer pessoa abre DevTools e copia. Use proxy backend ou keys com domínio restrito. Free keys frequentemente não dão essa opção, não use em produção.',
        },
        {
          gotcha: 'Doc desatualizada é regra, não exceção',
          note: 'O response real pode ter campos a mais ou menos que a doc diz. Sempre faz um curl/Postman primeiro e olha o JSON real antes de modelar no código.',
        },
        {
          gotcha: 'OpenWeather free tem delay de até 2h pra ativar a key',
          note: 'Cadastrou agora e recebeu 401? Não é sua chave errada, é a API ativando. Acontece em muita API free.',
        },
      ],
      diagram: `flowchart TD
  Need["Preciso de\\ndados de tempo"] --> Doc["openweathermap.org/api"]
  Doc --> Ref["API Reference\\n(pula o marketing)"]
  Ref --> Q1["1. Qual endpoint?\\nGET /data/2.5/weather"]
  Ref --> Q2["2. Como autenticar?\\nappid=KEY (query param)"]
  Ref --> Q3["3. Quais params?\\nq=cidade, units=metric"]
  Ref --> Q4["4. Response shape?\\n{ main, weather, name }"]`,
      anchor:
        'Você precisa da previsão do tempo de São Paulo agora. Tem a doc do OpenWeather aberta. Quais são as primeiras 4 informações que você procura?',
      followup:
        'Você decifrou a doc. Como você TESTA que a sua chave funciona ANTES de escrever uma linha de código no app?',
      gotcha:
        'A doc diz que o response tem o campo "weather". Você acessa `data.weather` e ele vem como um array de 1 elemento. Por quê?',
    },

    // ─── Beat 3: Consumindo API ao vivo ────────────────────────────────────────
    {
      id: 'consumindo-api',
      label: 'Consumindo API: curl, Postman, fetch',
      group: 'api',
      beat: 3,
      teachFromZero: true,
      tags: ['curl', 'postman', 'fetch', 'devtools-network', 'request-method', 'http-header', 'cors'],
      oneLine:
        'Três ferramentas pra mesma tarefa. curl no terminal pra reproduzir, Postman pra explorar e salvar, fetch pra codar. Cada uma tem seu momento.',
      pass1:
        'Antes de escrever uma linha de fetch no React, você prova que a API funciona com curl ou Postman. Isso isola: se o curl funciona e o fetch não, o problema é seu código (não a API). Sem essa separação você gasta horas debugando coisa errada.',
      pass2:
        '**curl no terminal**: `curl "https://api.openweathermap.org/data/2.5/weather?q=Sao Paulo&appid=KEY"`. Vantagem: rapidíssimo, copia/cola entre devs, perfeito pra reproduzir bug em ticket. Desvantagem: query complexa fica feia, fácil errar aspas.\n\n**Postman**: GUI desktop. Você salva coleções de requests, define environments (dev/staging/prod), share com o time. Vantagem: explorar API nova, documentar pra colegas, automatizar testes. Desvantagem: ferramenta a mais pra abrir.\n\n**fetch no código**: dentro do app (React, Node, etc.). `await fetch(url, { headers, method, body })`. Vantagem: é o código que vai pra produção. Desvantagem: erros aparecem misturados com bugs do seu app, daí a importância de testar antes com curl/Postman.\n\n**DevTools Network**: terceira ferramenta complementar. Toda request que o browser faz aparece ali com URL completa, headers, body, response, timing. Botão direito → "Copy as cURL" reproduz exatamente em terminal. Indispensável quando o fetch tá quebrando.\n\n**Fluxo recomendado pra calouro**: (1) ler doc, (2) testar com curl ou Postman, (3) confirmar response shape, (4) escrever fetch no app, (5) usar DevTools Network pra confirmar que tá igual ao curl.\n\n**Demo na aula**: abre o terminal e manda um curl pra OpenWeather agora. A sala inteira vê o JSON real aparecendo.',
      pass3: [
        {
          gotcha: 'CORS bloqueia fetch do browser mas não bloqueia curl',
          note: 'curl não tem origem, então a API responde direto. Browser tem origem (`localhost:3000`), se a API não retorna `Access-Control-Allow-Origin`, o fetch falha mesmo com a chamada chegando no servidor. Erro confuso pra calouro.',
        },
        {
          gotcha: 'Postman Desktop e Postman Web têm comportamentos diferentes',
          note: 'O Web roda no browser e sofre CORS. O Desktop não. Se um funciona e o outro não, geralmente é CORS.',
        },
        {
          gotcha: '`fetch` não dá throw em 404/500 por padrão',
          note: '`await fetch()` só dá throw em erro de rede. 404 ou 500 chegam normalmente, você precisa checar `response.ok` manualmente. Calouros perdem horas debugando isso.',
        },
      ],
      diagram: `flowchart LR
  Doc["Doc lida"] --> Test{"Como testar?"}
  Test --> Curl["curl no terminal\\n(rápido, scriptável)"]
  Test --> Postman["Postman\\n(salva, share, organiza)"]
  Curl & Postman --> OK{"Funcionou?"}
  OK -->|sim| Code["fetch() no app\\n(produção)"]
  OK -->|não| Doc
  Code --> DevTools["DevTools Network\\n(debug)"]`,
      anchor:
        'Você leu a doc do OpenWeather. Tem a API key. Antes de abrir o VS Code, qual ferramenta você abre primeiro pra testar que a key funciona?',
      followup:
        'Você consumiu API alheia. Agora você vai ESCREVER uma. No módulo de vocês, vocês usam Express. Como organizar isso pra não virar bagunça?',
      gotcha:
        'O curl funcionou perfeitamente. Você copia a mesma URL pro fetch no React e ele dá erro CORS. O que mudou?',
    },

    // ─── Beat 4: ExpressJS + MVC ──────────────────────────────────────────────
    {
      id: 'express-mvc',
      label: 'Express + MVC: o que vocês usam hoje',
      group: 'nestjs',
      beat: 4,
      teachFromZero: true,
      tags: ['express', 'mvc', 'middleware', 'route-handler', 'controller', 'model', 'view', 'app.use'],
      oneLine:
        'Express é a lib minimalista de Node mais usada no mundo. Você compõe rotas e middlewares na mão. MVC é o padrão que separa essas peças por responsabilidade.',
      pass1:
        'No módulo de vocês, vocês usam Express. Express é uma lib mínima: dá as rotas (`app.get`, `app.post`) e um sistema de middleware. O resto é sua decisão. Sem opinião, sem estrutura imposta. Por isso é importante saber MVC: o padrão que diz "separa por responsabilidade", Controller (HTTP), Model (dados/lógica), View (resposta). Juntos, Express + MVC é o backend que 80% dos projetos de aula são feitos hoje.',
      pass2:
        '**Express: 2 conceitos chave**\n\n**Rotas**: você registra um verbo HTTP + path + handler.\n```js\napp.get("/users/:id", (req, res) => res.json({ id: req.params.id }));\napp.post("/users", (req, res) => { /* cria user */ });\n```\n\n**Middlewares**: funções que rodam ANTES do handler. CORS, body parser, auth. Você empilha com `app.use()`. A ordem importa.\n```js\napp.use(cors());\napp.use(express.json());      // parse body\napp.use(authMiddleware);       // verifica token\napp.get("/users", listUsers);  // só chega aqui se passou pelos 3\n```\n\n**MVC: 3 camadas, 1 responsabilidade cada**\n\n- **Controller**, fala HTTP. Extrai params, chama Model, retorna response.\n- **Model**, fala dados. Sabe SQL, sabe regra de negócio, NÃO sabe HTTP.\n- **View**, fala resposta. Em APIs, é o JSON que volta. Em fullstack tradicional, era o HTML renderizado no servidor.\n\n**Por que isso importa**: Express sem MVC vira um arquivo `server.js` de 1000 linhas com rotas misturadas com queries de banco. MVC força você a separar. Quando vocês forem pra NestJS, vão ver que ele já vem com essa separação imposta, sem decisão.\n\n**Estrutura mínima MVC em Express**:\n```\nsrc/\n├── controllers/\n│   └── users.controller.js\n├── models/\n│   └── users.model.js\n├── routes/\n│   └── users.routes.js\n└── server.js\n```',
      pass3: [
        {
          gotcha: 'Middleware sem `next()` trava a request',
          note: 'Toda middleware precisa chamar `next()` pra passar pro próximo. Se você esquece, a request fica pendurada eternamente. Bug clássico em código de calouro.',
        },
        {
          gotcha: '`res.send()` chamado duas vezes lança erro',
          note: '"Cannot set headers after they are sent" significa que você chamou `res.send/json/end` mais de uma vez na mesma request. Geralmente esqueceu um `return` antes do segundo send.',
        },
        {
          gotcha: 'MVC clássico tem "View", em APIs ela vira JSON',
          note: 'O V de MVC nasceu pra apps onde o servidor renderiza HTML. Em APIs REST modernas, "View" virou só "como você serializa o response", geralmente JSON. Não procure um arquivo .view.js no seu projeto.',
        },
      ],
      diagram: `flowchart LR
  R["Request"] --> M1["app.use(cors)"]
  M1 --> M2["app.use(json)"]
  M2 --> M3["app.use(auth)"]
  M3 --> H["app.get(handler)"]
  H --> Res["Response"]`,
      anchor:
        'No seu módulo, vocês escreveram um `server.js` com Express. Se eu pedir pra você organizar essa rota num modelo MVC, em quantos arquivos ela vira?',
      followup:
        'Express + MVC funciona. Por que então as empresas migram pra NestJS? O que ele economiza?',
      gotcha:
        'Se MVC já existe, qual é o problema de continuar com Express + MVC pra sempre? O que NestJS adiciona que Express + MVC não tem?',
    },

    // ─── Beat 5: NestJS, por que ───────────────────────────────────────────────
    {
      id: 'nestjs-por-que',
      label: 'NestJS: por que',
      group: 'nestjs',
      beat: 5,
      teachFromZero: true,
      tags: ['nestjs', 'framework', 'decorator', 'typescript', 'opinado', 'modular', 'express'],
      oneLine:
        'NestJS é Node.js opinado e tipado. Você troca "vou decidir tudo" por "framework decide estrutura, eu decido o quê". Em projeto grande, isso ganha rápido.',
      pass1:
        'Com Express você escreve um backend funcionando em 10 linhas. Com NestJS são 30 linhas pra mesma coisa. Por que alguém escolheria mais código? Porque em projeto de 50 rotas a "liberdade do Express" vira "cada dev organizou diferente, ninguém entende o do outro". NestJS dá guard rails.',
      pass2:
        '**O que NestJS dá grátis**: estrutura padrão de pastas (Module/Controller/Service), dependency injection nativo, decorators pra rota e validação, integração pronta com TypeORM/Prisma/Mongoose, OpenAPI/Swagger gerado automático, testes com mocks fáceis, suporte a WebSocket/GraphQL/microservices no mesmo framework.\n\n**Express vs NestJS, lado a lado**:\n- Express: lib mínima, você junta middlewares na mão, decide nome de pastas, escreve sua própria validação, monta seu próprio DI ou vive sem.\n- NestJS: framework opinado, gera scaffold com `nest g resource users`, todos os arquivos no mesmo lugar com mesmo nome, validação via decorators.\n\n**Trade-off honesto**: NestJS NÃO é melhor que Express em tudo. Pra API de 3 rotas, scripts simples, ou prototipo de fim de semana, Express é mais rápido. Pra produto que vai durar anos e múltiplos devs vão tocar, NestJS economiza meses de decisões repetidas.\n\n**TypeScript não é opcional**: o framework foi desenhado em torno de tipos. Tentar usar NestJS com JavaScript puro é desperdiçar a metade do que ele oferece. Se o time não conhece TS, isso vira pré-requisito.\n\n**Quem usa NestJS**: Adidas, Roche, Capgemini, e muitos backends BR de empresas como iFood, Stone, Nubank em partes. Não é nicho, é padrão Node.js corporativo.',
      pass3: [
        {
          gotcha: 'NestJS é overkill pra script de 3 rotas',
          note: 'Se você precisa de um webhook pequeno ou script de migração, Express ou Fastify direto resolve. Não invoque framework pesado pra problema simples.',
        },
        {
          gotcha: 'Decorators do NestJS são TypeScript experimental',
          note: 'Precisa `experimentalDecorators` e `emitDecoratorMetadata` no tsconfig. NestJS já vem assim, mas migrar Express existente pra Nest exige ajuste.',
        },
        {
          gotcha: 'Build TypeScript é obrigatório',
          note: 'NestJS não roda direto do .ts em produção (precisa compilar pra .js). Adiciona um passo de build no deploy. Express puro consegue rodar via ts-node, NestJS não recomenda.',
        },
      ],
      diagram: `flowchart LR
  Express["Express\\n(lib mínima)"] -->|"você decide:\\nestrutura, DI,\\nvalidação, etc"| Result1["funciona\\ncada dev faz diferente"]
  Nest["NestJS\\n(framework opinado)"] -->|"framework decide:\\nestrutura, DI,\\nvalidação, decorators"| Result2["guard rails\\ntime grande converge"]`,
      anchor:
        'Você pode escrever um backend Node em 10 linhas com Express. Por que alguém escolheria NestJS, que parece bem mais código pra mesma coisa?',
      followup:
        'OK, você comprou a ideia de framework opinado. Agora qual é a anatomia básica de uma feature em NestJS? Quais arquivos você cria?',
      gotcha:
        'Se NestJS é tão organizado, por que algumas empresas grandes ainda usam Express? Tem caso onde NestJS é a escolha errada?',
    },

    // ─── Beat 6: Anatomia de uma feature ──────────────────────────────────────
    {
      id: 'anatomia-feature',
      label: 'Anatomia: Controller, Service, Module, DTO',
      group: 'nestjs',
      beat: 6,
      teachFromZero: true,
      tags: ['controller', 'service', 'module', 'dto', 'decorator', 'class-validator', 'separation'],
      oneLine:
        'Uma feature em NestJS são 4 arquivos com responsabilidades separadas: Controller fala HTTP, Service tem a lógica, Module agrupa, DTO valida o input. Misturar é o que vira código ruim.',
      pass1:
        'Quando você gera a feature "users", aparece um Controller, um Service, um Module e DTOs. Não é burocracia: é separação que paga dividendos quando o projeto cresce. Controller só pensa em HTTP. Service só pensa em regra de negócio. Module conecta. DTO garante que o que chega tá no formato certo.',
      pass2:
        '**Controller, porta de entrada HTTP**:\n```ts\n@Controller("users")\nexport class UsersController {\n  constructor(private users: UsersService) {}\n\n  @Get()\n  list() { return this.users.findAll(); }\n\n  @Post()\n  create(@Body() dto: CreateUserDto) {\n    return this.users.create(dto);\n  }\n}\n```\nDecorators (`@Controller`, `@Get`, `@Post`, `@Body`) fazem o mapeamento de URL → método. O controller NÃO tem lógica, só extrai dados do request e chama o Service.\n\n**Service, onde mora a lógica**:\n```ts\n@Injectable()\nexport class UsersService {\n  findAll() { /* busca no banco */ }\n  create(dto: CreateUserDto) { /* valida regra, salva */ }\n}\n```\nO Service não sabe que HTTP existe. Você poderia chamar `usersService.create({...})` de um cron job, de um teste, ou de outro service, funciona igual.\n\n**Module, a cola**:\n```ts\n@Module({\n  controllers: [UsersController],\n  providers: [UsersService],\n  exports: [UsersService],\n})\nexport class UsersModule {}\n```\nDeclara o que pertence a essa feature e o que ela exporta pra outras features usarem.\n\n**DTO, formato do request**:\n```ts\nexport class CreateUserDto {\n  @IsString() @MinLength(2)\n  name: string;\n\n  @IsEmail()\n  email: string;\n}\n```\nClasse simples com decorators de `class-validator`. Quando combinado com `ValidationPipe` global, valida o body automaticamente, request inválido vira 400 antes de chegar no Controller.\n\n**Demo na aula**: roda `nest g resource users` no terminal e mostra os 4 arquivos sendo criados em tempo real.',
      pass3: [
        {
          gotcha: 'Service tocando `res.json()` é code smell',
          note: 'Se você ver `@Res() res` ou chamadas a `res.send`/`res.json` dentro do Service, refatora. Service não conhece HTTP. Quem responde é o Controller (e geralmente Nest faz isso automaticamente quando você retorna).',
        },
        {
          gotcha: 'DTO sem ValidationPipe não valida nada',
          note: 'Os decorators do class-validator só rodam se o `ValidationPipe` estiver registrado (global em `main.ts` ou por rota). Sem ele, `@IsEmail()` vira só comentário.',
        },
        {
          gotcha: 'Esquecer de declarar no Module = "Nest can\'t resolve dependencies"',
          note: 'Provider esquecido em `providers: []` causa esse erro críptico no startup. Sempre adiciona Service ao array do Module.',
        },
      ],
      diagram: `flowchart TB
  R["Request HTTP\\nPOST /users"] --> Mod["UsersModule"]
  Mod --> Ctrl["UsersController\\n@Post(), @Body(dto)"]
  Ctrl -->|chama| Svc["UsersService\\n@Injectable()"]
  Svc --> DB[("Postgres")]
  DTO["CreateUserDto\\n@IsEmail, @MinLength"] -.->|valida body antes| Ctrl`,
      anchor:
        'Você vai criar a feature "users" no NestJS. Quais arquivos você espera ver na pasta `src/users/`? E qual é a responsabilidade de cada um?',
      followup:
        'Você viu `constructor(private users: UsersService)` no Controller. Como o NestJS sabe o que passar nesse parâmetro? Quem instancia o Service?',
      gotcha:
        'Por que separar Controller de Service? Não dava pra fazer tudo no Controller e economizar arquivo?',
    },

    // ─── Beat 7: Dependency Injection ──────────────────────────────────────────
    {
      id: 'dependency-injection',
      label: 'Dependency Injection',
      group: 'nestjs',
      beat: 7,
      teachFromZero: true,
      tags: ['dependency-injection', 'di-container', 'injectable', 'provider', 'singleton', 'testability'],
      oneLine:
        'DI = você declara o que precisa, framework te entrega. NestJS lê o tipo do parâmetro, procura no container, instancia uma vez (singleton) e injeta. Você nunca escreve `new` no Service.',
      pass1:
        'No Beat 5 você viu `constructor(private users: UsersService) {}` no Controller. Não tem `new UsersService()` em lugar nenhum. Quem cria? O container de DI do NestJS. Ele lê o tipo, acha o provider registrado, e instancia. Singleton por padrão, a mesma instância é reusada em tudo que pedir.',
      pass2:
        '**Como NestJS resolve a injeção**:\n1. `@Injectable()` marca a classe como elegível pra ser instanciada pelo container.\n2. `@Module({ providers: [UsersService] })` registra a classe no escopo do módulo.\n3. Outro componente declara `constructor(private users: UsersService)`, NestJS lê o tipo `UsersService`, procura no container do módulo, e injeta a instância.\n4. Se a classe nunca foi instanciada, o container cria uma. Se já foi, reusa (singleton).\n\n**Por que isso muda tudo**:\n- **Testabilidade**: no teste do Controller, você passa um mock no construtor. Não precisa subir o banco.\n  ```ts\n  const fakeUsers = { findAll: () => [{ id: 1 }] } as any;\n  const ctrl = new UsersController(fakeUsers);\n  expect(ctrl.list()).toEqual([{ id: 1 }]);\n  ```\n- **Reúso**: 3 controllers podem injetar o mesmo `MailService`, todos compartilham a mesma instância, mesma config.\n- **Inversão de controle**: você não decide quando o Service é criado, o framework decide. Centraliza ciclo de vida.\n\n**Singleton significa estado compartilhado**: cuidado em propriedades de instância (`this.cache = []` no Service). Como é singleton, esse cache é compartilhado entre TODAS as requests simultâneas. Geralmente é o que você quer; quando não é, marca o Service como `@Injectable({ scope: Scope.REQUEST })` pra nova instância por request.\n\n**Sem DI seria assim**: você escreveria `new UsersService(new UserRepository(new PrismaClient()))` em cada lugar que precisa. Mudança no construtor = caçar 30 arquivos. DI elimina isso.',
      pass3: [
        {
          gotcha: '@Injectable() esquecido = "Nest can\'t resolve dependencies"',
          note: 'Toda classe que vai pro `providers` do Module precisa ter `@Injectable()`. Sem o decorator, NestJS não consegue ler metadata e dá esse erro críptico.',
        },
        {
          gotcha: 'Dependência circular entre Modules trava o startup',
          note: 'Se ModuleA injeta de ModuleB e ModuleB injeta de ModuleA, NestJS não consegue resolver. Use `forwardRef(() => ModuleB)` ou refatora pra extrair o que ambos usam pra um terceiro módulo.',
        },
        {
          gotcha: 'Singleton + propriedade de instância = bug compartilhado',
          note: 'Se você guarda `this.currentUser` no Service, o próximo request vê o user anterior. Sempre passa o context como argumento, nunca guarda em `this`.',
        },
      ],
      diagram: `flowchart LR
  Mod["Module\\nproviders: [UsersService]"]
  Mod -->|registra| Container["DI Container\\n(mantém singletons)"]
  Ctrl["Controller\\nconstructor(private u: UsersService)"]
  Ctrl -.->|"pede UsersService"| Container
  Container -.->|"entrega a instância"| Ctrl`,
      anchor:
        'No Controller você escreveu `constructor(private users: UsersService) {}`. Você não chamou `new UsersService()` em lugar nenhum. Como o NestJS sabe o que passar nesse parâmetro?',
      followup:
        'Você tem Controller, Service, Module, DTO, DI. Tudo organizado dentro de uma feature. E quando você tem 30 features? Como você organiza as PASTAS?',
      gotcha:
        'Se Service é singleton e você guarda `this.cache` nele, o que acontece quando 2 requests chegam ao mesmo tempo?',
    },

    // ─── Beat 8: Organização de pastas ─────────────────────────────────────────
    {
      id: 'feature-folders',
      label: 'Organização de pastas: feature folders',
      group: 'nestjs',
      beat: 8,
      teachFromZero: true,
      tags: ['feature-folders', 'layered', 'cohesion', 'shared-folder', 'monorepo', 'src-organization'],
      oneLine:
        'Duas escolas: layered (controllers/, services/) ou feature folders (users/, auth/). Feature folders ganha em quase tudo, coesão, onboarding, refator localizado.',
      pass1:
        'Seu projeto tem 30 features. Cada uma tem Controller, Service, Module, DTO. Onde você coloca os arquivos? Modelo antigo MVC junta tudo por tipo (controllers/UsersController.ts, services/UsersService.ts). Modelo moderno junta por feature (users/users.controller.ts, users/users.service.ts). A diferença parece estética. Não é.',
      pass2:
        '**Feature folders (recomendado)**:\n```\nsrc/\n├── users/\n│   ├── users.module.ts\n│   ├── users.controller.ts\n│   ├── users.service.ts\n│   ├── users.repository.ts\n│   └── dto/\n│       ├── create-user.dto.ts\n│       └── update-user.dto.ts\n├── auth/\n│   ├── auth.module.ts\n│   ├── auth.controller.ts\n│   ├── auth.service.ts\n│   └── strategies/\n│       └── jwt.strategy.ts\n├── orders/\n│   └── ...\n└── app.module.ts\n```\n\n**Por que feature folders ganha**:\n- **Deletar uma feature = deletar uma pasta**. Em layered você caça arquivo por arquivo em 4 pastas diferentes.\n- **Onboarding novo entende o domínio só olhando `src/`**. A árvore conta a história do produto (tem users, auth, orders, payments).\n- **PR menor e mais coeso**. Mudou a feature "users"? O diff fica todo na pasta `users/`. Em layered, mexe em 4 pastas.\n- **Refator localizado**. Renomear `UsersService` pra `MembersService` mexe só dentro da pasta.\n\n**Layered (tradicional MVC)**:\n```\nsrc/\n├── controllers/\n│   ├── users.controller.ts\n│   ├── auth.controller.ts\n│   └── orders.controller.ts\n├── services/\n│   ├── users.service.ts\n│   └── ...\n└── dtos/\n```\nAinda usado em projetos pequenos (3-5 features) ou times que vieram de Rails/Spring tradicional. Em projeto pequeno funciona; em grande vira caos de imports cruzados.\n\n**A pasta `shared/` ou `common/`**: pra código realmente cross-feature (decorators custom, filtros globais, util de data). Cuidado: vira "lixão de tudo que não sei onde colocar" se não tiver critério claro. Regra de bolso: se 3+ features importam, vai pra shared. Se só uma usa, mora na pasta dela.\n\n**Convenção de nome de arquivo**: NestJS usa `<feature>.<tipo>.ts` (`users.controller.ts`, `users.service.ts`). Consistente, grep-amigável. Não inventa.',
      pass3: [
        {
          gotcha: 'shared/ vira lixão sem critério',
          note: 'Se qualquer dúvida vai pra shared/, em 6 meses você tem 80 arquivos lá. Define a regra: "só vai se 3+ features importam". Quando uma feature deixa de usar, considera mover de volta.',
        },
        {
          gotcha: 'Cross-feature import esconde coupling',
          note: 'Se `orders.service.ts` importa direto de `users.service.ts`, você acoplou as features. NestJS recomenda exportar via Module (`exports: [UsersService]`) e importar via `imports: [UsersModule]`. Explícito.',
        },
        {
          gotcha: 'Naming inconsistente quebra grep',
          note: 'Se metade dos services chama `*.service.ts` e a outra metade `*Service.ts`, você não consegue achar tudo. Padroniza no início e mantém.',
        },
      ],
      diagram: `flowchart TB
  subgraph layered["Layered (MVC tradicional)"]
    LC["controllers/"]
    LS["services/"]
    LD["dtos/"]
    LM["modules/"]
  end
  subgraph feature["Feature folders (recomendado)"]
    F1["users/"]
    F2["auth/"]
    F3["orders/"]
    SH["shared/"]
  end
  layered -.->|"projeto cresceu"| Caos["Cross-imports,\\nPR enormes,\\nrenomes em 4 lugares"]
  feature -.->|"projeto cresceu"| OK["Deleta pasta = deleta feature\\nPR coeso\\nOnboarding lê src/"]`,
      anchor:
        'Seu projeto tem 30 features. Você organiza por TIPO (controllers/, services/, dtos/) ou por FEATURE (users/, auth/, orders/)? Por quê?',
      followup:
        'Você tem feature folders. Cada feature tem o pipeline NestJS (Controller, Service, Module, DTO). Agora um request POST chega no servidor. Por onde ele passa antes de chegar no Controller?',
      gotcha:
        'Quando feature folders pode dar errado? Tem um cenário onde layered seria a escolha melhor?',
    },

    // ─── Beat 9: Arquitetura, o fluxo completo (obrigatório) ──────────────────
    {
      id: 'full-architecture',
      label: 'Arquitetura: o fluxo completo',
      group: 'synthesis',
      beat: 9,
      tags: ['middleware', 'guard', 'pipe', 'interceptor', 'exception-filter', 'controller', 'service', 'repository'],
      oneLine:
        'Um request HTTP atravessa um pipeline declarativo no NestJS: Middleware → Guard → Interceptor → Pipe → Controller → Service → Repository → DB. Resposta sobe pelo Interceptor. Erro vira ExceptionFilter.',
      pass1:
        'Você já viu Controller, Service, Module, DTO, DI, feature folders. Falta colar tudo: quando um POST chega no servidor, por onde ele passa? NestJS tem um pipeline de "lifecycle hooks". Cada etapa tem responsabilidade clara. Saber a ordem é o que separa "consigo fazer funcionar" de "sei diagnosticar quando quebra".',
      pass2:
        '**Caminho de ida (request → DB)**:\n1. **Middleware**, primeira camada, herdada do Express. CORS, body parser, logging. Roda antes de tudo.\n2. **Guard**, autoriza. Lê o JWT, checa role, decide se request passa. Retorna 401/403 se não.\n3. **Interceptor (pre)**, observa ou transforma. Logging de timing, transform de input, rate limit.\n4. **Pipe**, valida e transforma o body/params com o DTO + class-validator. Inválido vira 400 automaticamente.\n5. **Controller**, extrai params (`@Body`, `@Param`, `@Query`), chama o Service. Não tem regra de negócio.\n6. **Service**, regra de negócio. Chama o Repository pra persistir.\n7. **Repository**, fala com o banco via Prisma (ou TypeORM). SQL é gerado.\n8. **Postgres**, executa SQL, retorna dados.\n\n**Caminho de volta (DB → response)**:\n- Resposta sobe pelo Service → Controller.\n- Passa pelo **Interceptor (post)**, pode transformar output, adicionar headers, logar timing.\n- Vira HTTP response: status, headers, body JSON.\n\n**Quando algo quebra**:\n- **ExceptionFilter**, captura qualquer exceção lançada (HttpException, erro custom, erro do banco). Mapeia pra HTTP status + body padronizado. Sem isso, erro vira 500 genérico com stack trace exposta.\n\n**Por que a ordem importa**:\n- Guard ANTES de Pipe: não faz sentido validar body de quem nem deveria ter acesso.\n- Pipe ANTES de Controller: Controller recebe DTO já validado, código fica limpo.\n- Interceptor envolve TUDO: ideal pra cross-cutting (auth log, timing, error tracking).\n\n**Comparação com Express puro**: em Express, você empilha middlewares na mão (`app.use(cors())`, `app.use(json())`, `app.use(auth)`). Ordem é manual, erros vão pra `(err, req, res, next)`. NestJS abstrai isso em camadas nomeadas, você decora, ele monta o pipeline.',
      pass3: [
        {
          gotcha: 'Ordem do Guard antes de Pipe é importante',
          note: 'Se você troca pra Pipe primeiro, o usuário não autenticado consegue forçar erros de validação caros (ex: bcrypt de senha inválida). Sempre Guard primeiro.',
        },
        {
          gotcha: 'ExceptionFilter sem propagação certa esconde bug',
          note: 'Filter genérico que faz `return { error: "Algo deu errado" }` pra TUDO mata sua observabilidade. Sempre logue o erro original antes de retornar mensagem amigável.',
        },
        {
          gotcha: 'Interceptor async sem await vira race condition',
          note: 'Se você usa `intercept(ctx, next)` e esquece de `await next.handle().toPromise()`, o Interceptor "pós" roda antes da response. Bug clássico de transform/log.',
        },
      ],
      diagram: `flowchart TB
  R["Request\\nPOST /users"] --> MW["Middleware\\n(CORS, logger)"]
  MW --> G["Guard\\n(JWT, role)"]
  G --> I1["Interceptor pre\\n(timing, transform)"]
  I1 --> P["Pipe + DTO\\n(class-validator)"]
  P --> Ctrl["Controller\\n@Post(), @Body()"]
  Ctrl --> Svc["Service\\n(regra de negócio)"]
  Svc --> Repo["Repository\\n(Prisma)"]
  Repo --> DB[("Postgres")]
  DB --> Repo --> Svc --> Ctrl --> I2["Interceptor post\\n(transform output)"]
  I2 --> Res["Response\\n201 Created"]
  G -.->|"falha"| EF["ExceptionFilter\\n(401/403/500)"]
  P -.->|"inválido"| EF
  Svc -.->|"throw"| EF
  EF --> Res`,
      anchor:
        'Um POST /users chega no seu NestJS. Desenha cada etapa que ele atravessa, do momento que entra no servidor até a resposta voltar.',
      followup:
        'OK, diagrama no quadro. Pra cada caixa (servidor, banco), qual managed service da AWS faz esse trabalho na produção?',
      gotcha:
        'Em qual etapa do pipeline você bota o código que verifica se o usuário é admin? Guard, Interceptor, Pipe, Controller ou Service?',
    },

    // ─── Beat 10: AWS managed services (obrigatório) ───────────────────────────
    {
      id: 'aws-services',
      label: 'AWS: onde NestJS roda',
      group: 'synthesis',
      beat: 10,
      tags: ['route53', 'alb', 'ec2', 'ecs-fargate', 'lambda', 'rds', 'ecr', 'cloudwatch', 'ssm'],
      oneLine:
        'Cada caixa do diagrama mapeia pra um managed service da AWS. A escolha não é qual é mais novo, é qual perfil de carga aquela peça atende.',
      pass1:
        'AWS tem um managed service pra cada peça da arquitetura. "Managed" significa que a AWS cuida de patching, alta disponibilidade, backup e scaling, você configura, não opera. A lógica de escolha não é "qual é o mais hype" mas "qual perfil de workload essa peça tem".',
      pass2:
        '**DNS, Route 53**: traduz `api.suaej.com` em IP. Health check integrado, roteamento por geolocalização. ~$0.50/mês por zona hospedada.\n\n**Load Balancer, ALB**: distribui requests entre múltiplas instâncias do seu backend. Layer 7 (HTTP), path-based routing, suporta WebSocket. ~$16/mês fixo + tráfego.\n\n**Compute pra NestJS, 3 opções**:\n- **EC2 + PM2**: VM Linux Ubuntu, você instala Node, roda `pm2 start dist/main.js`. Máximo controle, você gerencia OS, patching, restart manual. ~$8/mês t3.micro.\n- **ECS Fargate** (recomendado): você empacota o NestJS num container Docker, escreve uma Task Definition, AWS aloca compute. Restart automático se cair, escala horizontal trivial. ~$15/mês mínimo. Escolha default pra NestJS em produção.\n- **Lambda**: serverless, evento dispara função. **NestJS via Lambda tem cold start ruim e pool de banco quebra**, não é o padrão pra HTTP backend persistente. Bom pra webhook ou job event-driven; ruim pra API principal.\n\n**Banco, RDS PostgreSQL**: Postgres gerenciado. Multi-AZ pra failover automático (~30s). Read Replica pra escalar leituras. Backup automático. ~$15-30/mês pra db.t3.micro.\n\n**Container registry, ECR**: onde sua imagem Docker fica privada na AWS. CI builda → `docker push` → ECS puxa. Integra com IAM, escaneia vulnerabilidades.\n\n**Logs, CloudWatch Logs**: stdout do container vai automaticamente. Query com CloudWatch Insights. ~$0.50/GB ingerido. Pra observabilidade mais rica, time grande vai pra DataDog/Grafana.\n\n**Secrets, SSM Parameter Store**: variáveis sensíveis (DB password, JWT secret) ficam aqui criptografadas. Container lê via SDK, IAM Role autoriza. Gratuito até 10k params padrão.\n\n**Decision tree pra EJ**:\n- MVP/prototipo → Render ou Railway (PaaS, sem AWS, deploy em 5 min)\n- Backend NestJS em produção → ECS Fargate + RDS + ALB + Route 53\n- Job event-driven (webhook, processamento async) → Lambda\n- Workload pesado custom → EC2',
      pass3: [
        {
          gotcha: 'Lambda pra HTTP backend persistente é antipadrão',
          note: 'Cold start 200-500ms aparece nas p99, pool de conexão com banco quebra a cada invocation, monitoring custa caro. NestJS via serverless-adapter funciona MAS é mais dor de cabeça que valor. Use ECS Fargate pra HTTP persistente.',
        },
        {
          gotcha: 'RDS sem Multi-AZ = downtime garantido em failure',
          note: 'Single-AZ é o default barato. Quando a AZ cai (raro mas acontece), seu banco fica fora até a AWS subir de novo. Multi-AZ replica sincronamente pra outra AZ, failover em ~30s. Em produção, sempre Multi-AZ.',
        },
        {
          gotcha: 'ECR pull dentro de VPC privada precisa NAT ou VPC Endpoint',
          note: 'Container ECS em subnet privada não consegue puxar imagem do ECR sem rota pra fora. NAT Gateway custa $0.045/h (~$33/mês). Alternativa: VPC Endpoint pra ECR (mais barato em escala).',
        },
      ],
      diagram: `flowchart TB
  Browser["Browser"] --> R53["Route 53\\nDNS"]
  R53 --> ALB["ALB\\nLayer 7"]
  ALB --> ECS["ECS Fargate\\n(seu NestJS)"]
  ECS --> RDS["RDS Postgres\\nMulti-AZ"]
  RDS -.->|read scale| RR["RDS Read Replica"]
  ECS --> SSM["SSM\\nSecrets"]
  ECS --> ECR["ECR\\nDocker image"]
  ECS --> CW["CloudWatch\\nLogs"]`,
      anchor:
        'Olha o diagrama do pipeline NestJS que você desenhou. Pra cada peça (servidor, banco, secrets), qual AWS managed service faz esse trabalho em produção?',
      followup:
        'Você sabe REST, NestJS, organização e deploy. Qual é o próximo passo prático? O que você faz na segunda-feira pra começar a construir?',
      gotcha:
        'Por que ECS Fargate em vez de Lambda pro backend NestJS principal? O que muda no perfil de carga?',
    },

    // ─── Synthesis ─────────────────────────────────────────────────────────────
    {
      id: 'synthesis',
      label: 'Backend não é mágica',
      group: 'synthesis',
      tags: ['rest', 'nestjs', 'feature-folders', 'di', 'aws', 'next-steps'],
      oneLine:
        'Backend é HTTP + JSON + REST + uma estrutura que se repete. NestJS dá os guard rails. AWS dá onde rodar. O resto é prática.',
      pass1:
        'Você começou achando que backend era um monstro misterioso. Saiu com 4 mapas: como funciona HTTP, como ler doc de API alheia, como estruturar a sua, e onde subir. Cada camada tem nome, cada decisão tem trade-off conhecido. A próxima etapa é construir.',
      pass2:
        '**O que você consolidou hoje**:\n- HTTP é texto previsível: verbo + path + headers + body, status code de volta.\n- JSON virou o formato universal, `JSON.stringify`/`JSON.parse` são as 2 funções mais chamadas da sua carreira.\n- REST nomeia recursos (nouns), verbo HTTP é a ação. Convenção em vez de invenção.\n- Ler doc é uma habilidade: vai direto no Reference, identifica endpoint/auth/params/response.\n- 3 ferramentas pra consumir: curl rápido, Postman pra explorar, fetch no código.\n- Express + MVC é o que você usa hoje: rotas + middleware + Controller/Model/View separados.\n- NestJS troca liberdade por estrutura, vale em projeto longo e time grande.\n- 4 arquivos por feature: Controller (HTTP), Service (lógica), Module (cola), DTO (validação).\n- DI = você declara, framework instancia (singleton).\n- Feature folders > layered. Deletar pasta = deletar feature.\n- Pipeline NestJS: Middleware → Guard → Pipe → Controller → Service → Repository → DB.\n- AWS: ECS Fargate pro NestJS, RDS Postgres pro banco, Route 53 + ALB pra rede.\n\n**Próximos passos na segunda-feira**:\n1. `npx @nestjs/cli new minha-api`, gera projeto rodando em 2 minutos.\n2. `nest g resource users`, gera CRUD completo com Controller/Service/Module/DTO.\n3. Leia a doc de uma API que te interessa (Spotify, GitHub, Stripe). Mande um curl. Veja o JSON.\n4. Adiciona Prisma ao seu projeto. Conecta num Postgres local via Docker.\n5. Sobe num PaaS (Render, Railway) antes de tentar AWS. Cada passo é uma aula.\n\n**O que NÃO cobrimos hoje** (intencionalmente, fica pra próximas aulas):\n- Autenticação com JWT e refresh tokens.\n- Testes automatizados (unit + e2e).\n- Migrations de banco com Prisma.\n- WebSocket pra real-time.\n- CI/CD com GitHub Actions.\n- Observabilidade séria (logs estruturados, traces, métricas).',
      pass3: [
        {
          gotcha: 'Querer entender tudo antes de codar trava',
          note: 'Backend tem profundidade infinita. Você vai aprender 80% codando, 20% lendo. Começa hoje com um projeto pequeno (gerenciador de tarefas, lista de filmes, qualquer coisa).',
        },
        {
          gotcha: 'Copiar e colar sem entender vira castelo de cartas',
          note: 'Vai dar pra fazer muita coisa copiando do ChatGPT. Mas quando quebrar, você não vai saber consertar. Sempre tenta entender por que aquele código tá ali antes de aceitar.',
        },
        {
          gotcha: 'AWS console parece intimidador, mas mover é a única forma',
          note: 'Cria uma conta free tier. Sobe um EC2 t3.micro só pra brincar. Mata depois. A familiaridade só vem com clicar.',
        },
      ],
      anchor:
        'Você sai dessa aula sabendo backend. Qual o primeiro projeto pequeno que você vai construir essa semana pra começar a praticar?',
      followup:
        'Próxima aula: como esse backend é testado, autenticado, e como o CI/CD garante que ele não quebra em produção.',
      gotcha:
        'Se você só tem 2 horas por semana pra estudar backend, no que você investe esse tempo? Tutorial novo, projeto próprio, ou leitura de código alheio?',
    },
  ],
};
