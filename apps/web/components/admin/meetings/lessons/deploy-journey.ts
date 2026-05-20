import type { Lesson } from '../lesson-types';

export const deployJourney: Lesson = {
  slug: 'deploy-journey',
  title: 'Do npm run dev ao Deploy',
  subtitle: 'System Design · Deploy',
  blurb:
    'Uma jornada linear: o backend funciona localmente, um segundo dev entra, ele não sobe, e a gente resolve cada problema do jeito certo — Docker, secrets, cloud, decisões de infra, CI/CD.',
  durationMin: 120,
  audience: 'Hot Stuff 2026.2',
  nodes: [
    // ─── Foundation ───────────────────────────────────────────────────────────
    {
      id: 'process-port',
      label: 'Processo, porta e servidor',
      group: 'foundations',
      teachFromZero: true,
      tags: ['processo', 'programa', 'porta', 'tcp', 'socket', 'pid', 'bind', 'listener'],
      oneLine:
        'Um processo é um programa em execução — ele pede uma porta ao OS e fica escutando conexões TCP. Entender isso é o fundamento de tudo que vem a seguir.',
      pass1:
        'Quando você executa qualquer programa de rede, o OS cria um processo com um PID e aloca memória. Esse processo abre um socket TCP numa porta (um número de 1 a 65535) e espera por conexões. Porta é só uma convenção para distinguir serviços num mesmo host.',
      pass2:
        '**Processo vs programa**: um programa é código em disco; um processo é esse código carregado na memória e sendo executado. O OS gerencia múltiplos processos ao mesmo tempo via scheduler.\n\n**Porta**: é um número que identifica um serviço dentro de um host. HTTP usa 80, HTTPS usa 443, Postgres usa 5432 — mas você pode usar qualquer número de 1024 a 65535 sem precisar de permissão de root. Abaixo de 1024 (well-known ports) você precisa de privilégios elevados.\n\n**Socket TCP**: quando um processo abre uma porta, ele cria um socket — um endpoint de comunicação bidirecional. O servidor escuta (listen), o cliente conecta (connect), e a partir daí os dois trocam bytes. Um `GET /` do browser é literalmente bytes TCP chegando nesse socket.\n\n**Servidor**: no contexto de software, "servidor" é qualquer processo que escuta conexões e responde a requisições. Pode ser seu Node.js local, um Nginx num VPS, ou um container ECS na AWS — o conceito é o mesmo.',
      pass3: [
        {
          gotcha: 'Porta < 1024 retorna EACCES sem sudo',
          note: 'Portas de 0 a 1023 são reservadas pelo OS (well-known ports). Tentar bind em :80 ou :443 sem root resulta em EACCES. É por isso que apps em dev rodam em :3000, :8080 etc.',
        },
        {
          gotcha: 'Dois processos tentam a mesma porta → EADDRINUSE',
          note: 'Cada combinação (IP, protocolo, porta) pode ter no máximo um listener por vez. Se você rodar npm run dev duas vezes, o segundo processo não consegue bind e joga EADDRINUSE.',
        },
        {
          gotcha: 'Processo morreu mas a porta ainda aparece em uso',
          note: 'O OS mantém sockets em TIME_WAIT por até 2 minutos após fechar uma conexão TCP. Reiniciar imediatamente pode levar a EADDRINUSE por alguns segundos.',
        },
      ],
      anchor: 'O que é uma porta? Por que o seu servidor escuta na 3000 e não na 80?',
      askWho: [
        {
          name: 'Eduardo',
          why: 'Networking estudado — de longe quem mais estudou o tema. Começa com ele.',
        },
        {
          name: 'Maria Clara',
          why: 'Networking coberto — segunda escolha natural para completar o que Eduardo não cobrir.',
        },
        {
          name: 'Messias',
          why: 'Networking estudado — terceira voz para o debate. Pode trazer ângulo diferente.',
        },
      ],
      followup: 'OK. Agora você sabe o que é um processo e uma porta. Vamos rodar um.',
      gotcha:
        'Se porta é um número que você escolhe, o que impede dois processos diferentes de pedirem a mesma porta simultaneamente?',
    },

    // ─── Beat 1: npm run dev ───────────────────────────────────────────────────
    {
      id: 'npm-run-dev',
      label: 'npm run dev',
      group: 'local',
      beat: 1,
      teachFromZero: true,
      tags: ['npm', 'node.js', 'processo', 'porta', 'localhost', 'env-var', 'runtime'],
      oneLine:
        'Rodar npm run dev na sua máquina é o ponto zero — e já carrega premissas invisíveis que quebram no próximo computador.',
      pass1:
        'Quando você executa npm run dev, o Node.js lê o package.json, instala/verifica dependências, compila o código se necessário, e sobe um processo na porta configurada. Tudo funciona porque sua máquina tem a versão certa do runtime, o .env correto, e todos os serviços dependentes rodando. Mova esse comando para outro computador e cada uma dessas premissas pode falhar silenciosamente.',
      pass2:
        '**O que acontece internamente**: npm lê o campo `scripts.dev` do package.json e executa o comando. Frameworks como NestJS ou Next.js sobem um watcher que recompila arquivos ao salvar. O resultado é um processo Node.js com um PID escutando em :3000 (ou o que for configurado).\n\n**As cinco premissas invisíveis**: (1) Versão do runtime — Node 20 vs Node 18 têm comportamentos diferentes em alguns módulos. (2) node_modules — npm install resolveu o lock file na sua máquina; num clone fresco pode baixar versões diferentes se o lock não foi commitado. (3) Variáveis de ambiente — tudo que o app lê de process.env precisa estar definido. (4) Serviços externos — banco, Redis, APIs locais precisam estar rodando e acessíveis. (5) Módulos nativos — bibliotecas como bcrypt ou sharp são compiladas em C++ para a arquitetura do host; um node_modules de Mac ARM não funciona em Linux x86.\n\n**Por que isso importa agora**: enquanto você trabalha sozinho, essas premissas nunca aparecem — você as satisfaz sem perceber. Quando um segundo dev entra, cada uma vira um ponto de falha.',
      pass3: [
        {
          gotcha: 'npm install sem --frozen-lockfile pode instalar versões diferentes',
          note: 'Se o package-lock.json não está commitado, npm resolve as faixas do package.json na hora, podendo instalar minor/patch mais recentes que mudam comportamento. Use --frozen-lockfile (pnpm) ou --ci (npm) em ambientes compartilhados.',
        },
        {
          gotcha: 'NODE_ENV undefined vs development tem efeitos diferentes',
          note: 'Express, NestJS e muitas libs têm código condicional em NODE_ENV. Em `development`, stack traces aparecem em respostas de erro. Em `undefined`, o comportamento é imprevisível.',
        },
        {
          gotcha: '.env local nunca deve ser commitado no git',
          note: 'Se .env está no .gitignore, cada dev precisa criar o seu. Se não está, credenciais de banco/API vão para o histórico do git — e git history é permanente mesmo depois de remover o arquivo.',
        },
      ],
      diagram: `flowchart LR
  Dev["💻 Developer\\n(localhost)"]
  Dev -->|npm run dev| Node["⚙️ Node.js process\\n:3000"]
  Browser["🌐 Browser"] -->|HTTP GET localhost:3000| Node`,
      diagramUrl: '/diagrams/deploy-journey/npm-run-dev.png',
      anchor:
        'O que acontece entre você apertar Enter em npm run dev e conseguir fazer uma requisição em localhost:3000?',
      askWho: [
        {
          name: 'Eduardo',
          why: 'Estudou mais topics que qualquer outro no cohort — bom ponto de partida.',
        },
        {
          name: 'Livia',
          why: 'Containers estudados — já pensa em ambientes diferentes. Segunda escolha.',
        },
        {
          name: 'Messias',
          why: 'Networking coberto — vai trazer ângulo de rede e conectividade.',
        },
      ],
      followup:
        'OK, funcionou na sua máquina. Você manda o repo para um colega. Ele roda npm install && npm run dev. O que pode dar errado?',
      gotcha:
        'Se o processo está rodando na sua máquina, o que impede alguém de fora da sua rede de acessar localhost:3000?',
      scenarios: {
        right: {
          shape:
            'Fala sobre processo Node.js, porta TCP, e menciona pelo menos uma das premissas (versão, node_modules, env vars).',
          redirect:
            'Exato. E dessas premissas, qual você acha que é a mais comum de causar problema quando um segundo dev entra no projeto?',
        },
        close: {
          shape:
            'Fala que "o servidor sobe e fica escutando na porta 3000", mas não vai fundo nas premissas implícitas.',
          redirect:
            'Chegou na parte de porta. O que faz esse processo ouvir nessa porta? De onde vem o número 3000?',
        },
        wayOff: {
          shape:
            'Confunde processo local com servidor remoto — responde que "o servidor na internet processa a requisição".',
          redirect:
            'Boa intuição sobre servidores. Mas onde esse servidor está rodando agora? Está na sua máquina ou em algum lugar na internet?',
        },
      },
    },

    // ─── Beat 2: Works on my machine ──────────────────────────────────────────
    {
      id: 'works-on-my-machine',
      label: '"Funciona no meu PC"',
      group: 'local',
      beat: 2,
      teachFromZero: true,
      tags: ['runtime', 'node_modules', '.env', 'native-modules', '.nvmrc', 'reproducibility', 'dep-tree'],
      oneLine:
        'Diagnosticar por que um projeto funciona numa máquina e não em outra é o segundo exercício mais importante de qualquer dev de backend — o primeiro é ter prevenido o problema.',
      pass1:
        'Um novo dev clonou o repositório, rodou npm install, e o backend não sobe. O sistema de diagnóstico tem cinco camadas, e resolver pela camada errada desperdiça horas. O objetivo deste beat é construir esse checklist de dentro para fora: runtime → dependências → ambiente → serviços → plataforma.',
      pass2:
        '**Camada 1 — Runtime**: versão de Node.js diferente. `node --version` em cada máquina. Solução direta: `.nvmrc` ou `.node-version` na raiz do projeto; nvm (ou fnm) lê esse arquivo e usa a versão correta automaticamente.\n\n**Camada 2 — Dependências nativas**: módulos como bcrypt, argon2, sharp, canvas são compilados em C++ na hora do npm install. Um node_modules de Mac ARM não funciona em Linux x86. Solução: nunca commitar node_modules; sempre rodar npm install na máquina destino.\n\n**Camada 3 — Variáveis de ambiente**: o app lê DB_URL, JWT_SECRET, PORT de process.env. Se .env não existe no clone do colega, esses valores são undefined e o app pode falhar silenciosamente. Solução imediata: commitar um `.env.example` com as chaves (sem valores reais); o README instrui a copiar e preencher.\n\n**Camada 4 — Serviços externos**: o backend precisa de banco, Redis, filas. Se esses não estão rodando localmente, as conexões falham. O erro pode ser confundido com erro de código. Solução: docker-compose com os serviços de infraestrutura (beat 5).\n\n**Camada 5 — Plataforma**: permissões de arquivo, case sensitivity do filesystem (macOS é case-insensitive por padrão, Linux não), paths com espaços.',
      pass3: [
        {
          gotcha: '.env.example commitado com valores de produção é um leak',
          note: 'O exemplo deve ter as chaves, não os valores. Escreva `DB_URL=` ou `DB_URL=postgres://user:pass@localhost/dev` — nunca credenciais reais.',
        },
        {
          gotcha: 'npm ci vs npm install têm comportamentos diferentes',
          note: 'npm ci sempre lê o package-lock.json e instala versões exatas — ideal para CI e onboarding. npm install pode atualizar o lock file se as faixas do package.json forem satisfeitas por versões mais novas.',
        },
        {
          gotcha: 'Módulo nativo compilado para a arquitetura errada dá erro críptico',
          note: 'O erro típico é "invalid ELF header" ou "was compiled against a different Node.js version". Sempre delete node_modules e reinstale na máquina destino ao mudar de OS, versão de Node, ou arquitetura (Intel ↔ ARM).',
        },
      ],
      diagram: `flowchart TD
  Clone["📁 git clone"] --> NI["npm install"]
  NI --> Check{"Sobe?"}
  Check -->|Não| L1["Versão do Node?\\nnvm use"]
  Check -->|Não| L2["node_modules nativo?\\nrm -rf + npm i"]
  Check -->|Não| L3[".env existe?\\ncp .env.example .env"]
  Check -->|Não| L4["Banco rodando?\\ndocker compose up -d"]
  L1 & L2 & L3 & L4 --> Retry["Tenta de novo"]
  Retry --> Check`,
      diagramUrl: '/diagrams/deploy-journey/works-on-my-machine.png',
      anchor:
        'Seu colega clonou o mesmo repositório, rodou npm install, e o backend não sobe. Quais são as perguntas que você faz antes de qualquer outra coisa?',
      askWho: [
        {
          name: 'Eduardo',
          why: 'Networking + security + databases — maior breadth do cohort. Vai nomear camadas metodicamente.',
        },
        {
          name: 'Maria Clara',
          why: 'Networking + security — segunda maior breadth. Foco em ambiente e conexão.',
        },
        {
          name: 'Messias',
          why: 'Networking + databases — vai pensar em serviços externos e conectividade.',
        },
      ],
      followup:
        'Você tem o checklist. Qual dessas cinco camadas pode ser resolvida de uma vez, para qualquer máquina, com uma única ferramenta? Spoiler: Docker.',
      gotcha:
        'Se você resolver todas as cinco camadas na mão, o que acontece quando um terceiro dev entra semanas depois? E um quarto?',
      scenarios: {
        right: {
          shape:
            'Nomeia pelo menos três das cinco camadas (versão de Node, deps nativas, .env, serviços, plataforma) e sugere um checklist sistemático.',
          redirect:
            'Perfeito. Agora imagina que você não quer resolver isso na mão toda vez que alguém entra. Existe uma ferramenta que garante que camadas 1, 2 e 5 são idênticas em todas as máquinas — qual você acha que é?',
        },
        close: {
          shape:
            'Fala de versão de Node e .env, mas não menciona dependências nativas ou serviços externos.',
          redirect:
            'Você cobriu runtime e variáveis — boa base. Mas e o código C++ dentro do node_modules? Ele é o mesmo em Mac e Linux?',
        },
        wayOff: {
          shape:
            'Vai direto para "reinstala o Node" sem fazer diagnóstico — trata como problema de instalação genérico.',
          redirect:
            'Faz sentido testar. Mas se reinstalar o Node não resolver, o que você checaria em seguida? Existe uma ordem lógica pra esse diagnóstico?',
        },
      },
    },

    // ─── Beat 3: O que é um container ─────────────────────────────────────────
    {
      id: 'docker-container',
      label: 'O que é um container',
      group: 'containers',
      beat: 3,
      teachFromZero: true,
      tags: ['container', 'imagem', 'dockerfile', 'namespace', 'cgroups', 'kernel', 'layer', 'isolamento'],
      oneLine:
        'Um container empacota o código junto com o runtime, as dependências e as configs de sistema — o ambiente deixa de ser implícito e passa a ser versionado junto com o código.',
      pass1:
        'Docker não é uma máquina virtual. É um processo do Linux com isolamento extra — namespace (visão isolada de rede, processos, filesystem) e cgroups (limites de CPU/memória). O container compartilha o kernel do host mas enxerga apenas os processos e arquivos que foram declarados na sua imagem. O resultado: o app roda da mesma forma em qualquer máquina que tenha Docker, independente de OS, versão de Node instalada, ou variáveis globais do sistema.',
      pass2:
        '**Container vs máquina virtual**: uma VM emula hardware inteiro (incluindo BIOS, kernel, disco virtual). É pesada — alguns GB de overhead. Um container compartilha o kernel do host e isola só o espaço de usuário. Um container Node.js padrão tem ~120MB; uma VM equivalente teria 2-4GB.\n\n**Namespace e cgroups**: o Linux oferece dois primitivos de isolamento. Namespace dá ao processo uma "visão" separada de rede (IP próprio), processos (não enxerga o PID 1 do host), e filesystem (raiz separada). Cgroups limita quantos recursos o processo pode consumir — CPU, RAM, disco.\n\n**Imagem vs container**: uma imagem é um snapshot imutável em camadas — é como um template de disco. Um container é uma instância dessa imagem em execução — é o processo vivo. Você pode rodar 10 containers a partir da mesma imagem, cada um isolado dos outros.\n\n**O que isso resolve das 5 camadas**: versão de Node (está na imagem), módulos nativos compilados (compilados durante o build, para a arquitetura correta), e divergência de plataforma. Serviços externos e variáveis de ambiente ainda precisam de tratamento separado.',
      pass3: [
        {
          gotcha: 'Docker Desktop no Mac não usa o kernel do Mac',
          note: 'macOS não tem namespaces Linux nativos. Docker Desktop roda uma VM Linux leve e os containers vivem dentro dessa VM. Por isso o overhead em Mac é maior que em Linux.',
        },
        {
          gotcha: 'Container parado não é container deletado',
          note: 'docker stop para o processo mas mantém o container. docker rm remove o container (mas não a imagem). docker rmi remove a imagem. Use docker container prune periodicamente.',
        },
        {
          gotcha: 'Imagem sem versão pinada vai mudar de baixo dos seus pés',
          note: 'FROM node:20 e FROM node:latest são diferentes. node:latest vai mudar quando Node 22 virar LTS. Sempre pin a versão minor: FROM node:20.18-alpine3.20.',
        },
      ],
      diagram: `flowchart TD
  DF["📄 Dockerfile\\n(receita)"] -->|docker build| IMG["📦 Image\\n(snapshot imutável)"]
  IMG -->|docker run| C1["🟢 Container A\\n(processo isolado)"]
  IMG -->|docker run| C2["🟢 Container B\\n(outro processo isolado)"]
  C1 -.->|"compartilha kernel"| K["🐧 Kernel Linux\\n(do host)"]
  C2 -.->|"compartilha kernel"| K`,
      diagramUrl: '/diagrams/deploy-journey/docker-container.png',
      anchor:
        'Qual é a diferença entre rodar um processo direto no OS e rodar esse mesmo processo dentro de um container?',
      askWho: [
        {
          name: 'Livia',
          why: 'Única no cohort com containers na bagagem — É O beat dela. Pede pra ela explicar antes de você.',
        },
        {
          name: 'Eduardo',
          why: 'Maior breadth geral — complementa Livia com visão de sistema e isolamento.',
        },
        {
          name: 'Messias',
          why: 'Networking estudado — vai trazer a perspectiva de rede e isolamento de processo.',
        },
      ],
      followup:
        'Você entendeu o que é uma imagem e um container. Agora como você cria uma imagem a partir do seu próprio código? O que você precisa escrever?',
      gotcha:
        'Se dois containers rodam a partir da mesma imagem e um deles escreve um arquivo no disco, o outro container enxerga esse arquivo?',
      scenarios: {
        right: {
          shape:
            'Diferencia processo isolado de VM, menciona namespace/cgroups ou "isolamento de filesystem", e entende que a imagem é imutável.',
          redirect:
            'Exato. E se a imagem é imutável, onde o container escreve os dados que precisa persistir em runtime?',
        },
        close: {
          shape:
            'Fala que container é "como uma VM mais leve", sem distinguir o modelo de compartilhamento de kernel.',
          redirect:
            'Chegou na leveza — boa intuição. Mas por que um container é mais leve que uma VM? O que ele não precisa carregar que a VM precisa?',
        },
        wayOff: {
          shape:
            'Confunde container com processo normal sem isolamento.',
          redirect:
            'Faz sentido — é um processo. O que o torna diferente de um processo comum? O que o Linux adicionou para isolar ele?',
        },
      },
    },

    // ─── Beat 4: Dockerfile ───────────────────────────────────────────────────
    {
      id: 'dockerfile',
      label: 'Escrevendo um Dockerfile',
      group: 'containers',
      beat: 4,
      teachFromZero: true,
      tags: ['FROM', 'COPY', 'RUN', 'CMD', 'EXPOSE', 'layer-cache', 'multi-stage', '.dockerignore'],
      oneLine:
        'Um Dockerfile é a receita declarativa para construir uma imagem — cada instrução vira uma camada imutável e cacheada no disco.',
      pass1:
        'O Dockerfile lista instruções em ordem: qual imagem base usar, quais arquivos copiar, quais comandos executar durante o build, e qual comando iniciar quando o container subir. O Docker executa cada instrução numa camada separada — e cacheia cada camada. Se só o código mudou mas as dependências não, o docker build pula as camadas de npm install e vai direto para o COPY do código.',
      pass2:
        '**Instrução por instrução**:\n```\nFROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --omit=dev\nCOPY . .\nRUN npm run build\nEXPOSE 3000\nCMD ["node", "dist/main.js"]\n```\n\n**Por que COPY package.json antes do COPY .?**: Docker invalida o cache de uma camada quando qualquer entrada dela muda. Se você copia tudo de uma vez (`COPY . .`) e depois faz `RUN npm install`, qualquer mudança de código invalida o npm install também — rebuild de minutos a cada commit. A separação garante que npm install só refaz quando package.json mudar.\n\n**Multi-stage build**: para apps que precisam compilar (TypeScript, Go, Rust), um multi-stage separa o ambiente de build do de runtime. Estágio builder tem todas as devDependencies e TypeScript; estágio runtime copia só dist/ e node_modules de produção. Resultado: imagem final sem ferramentas de compilação — tipicamente 50-70% menor.\n\n**.dockerignore**: análogo ao .gitignore, lista o que não copiar no COPY. Sempre incluir node_modules, .git, .env, dist/.',
      pass3: [
        {
          gotcha: 'CMD vs ENTRYPOINT têm semântica diferente',
          note: 'CMD define o comando padrão — pode ser substituído com `docker run image outro-cmd`. ENTRYPOINT define o executável fixo. Para scripts de entrada (como um migration runner), combinar ENTRYPOINT + CMD é o padrão.',
        },
        {
          gotcha: 'EXPOSE não publica a porta — só documenta',
          note: 'EXPOSE é metadado. A porta só fica acessível fora do container se você usar `-p 3000:3000` no docker run (ou `ports:` no compose).',
        },
        {
          gotcha: 'npm ci vs npm install dentro do Dockerfile',
          note: 'Dentro do container, sempre use npm ci — ele lê o lock file exato, é mais rápido, e falha se o lock file não está sincronizado com o package.json.',
        },
      ],
      diagram: `flowchart TD
  subgraph layers["Camadas (cached)"]
    L1["FROM node:20-alpine"]
    L2["COPY package*.json\\n+ RUN npm ci"]
    L3["COPY . .\\n+ RUN npm run build"]
  end
  L1 --> L2 --> L3 -->|docker build| IMG["📦 Image (~120MB)"]
  IMG -->|"docker run -p 3000:3000"| C["🟢 Container"]`,
      diagramUrl: '/diagrams/deploy-journey/dockerfile.png',
      anchor:
        'Se você mudar só uma linha de código TypeScript e rodar docker build de novo, quais camadas do Dockerfile precisam ser reexecutadas?',
      askWho: [
        {
          name: 'Livia',
          why: 'Containers estudados — segunda vez que aparece. Pode avançar para o detalhe de cache.',
        },
        {
          name: 'Eduardo',
          why: 'Background amplo — vai intuir sobre cache e invalidação de dependências.',
        },
        {
          name: 'Maria Clara',
          why: 'Security estudada — pode trazer perspectiva de imagem mínima e superfície de ataque.',
        },
      ],
      followup:
        'Você tem sua API em container. Mas ela precisa de um banco de dados. Como você roda os dois juntos localmente?',
      gotcha:
        'Qual é o problema de rodar npm install (não npm ci) dentro do Dockerfile de CI?',
      scenarios: {
        right: {
          shape:
            'Entende que só as camadas após o COPY . . são invalidadas — FROM, npm ci continuam cacheadas.',
          redirect:
            'Exato. Isso é o que torna o build rápido em dev. Agora o que acontece com esse cache quando você muda o package.json?',
        },
        close: {
          shape:
            'Diz "refaz tudo" — sabe que mudou algo mas não entendeu a granularidade por camadas.',
          redirect:
            'Perto. Docker não refaz tudo — só o que mudou e o que depende do que mudou. Qual é a primeira camada que vê a mudança de código TypeScript?',
        },
        wayOff: {
          shape:
            'Acha que o docker build reexecuta o npm install sempre.',
          redirect:
            'Faz sentido pensar assim. Mas Docker tem um mecanismo para evitar isso. O que ele poderia usar para saber que o package.json não mudou?',
        },
      },
    },

    // ─── Beat 5: Docker Compose ───────────────────────────────────────────────
    {
      id: 'docker-compose',
      label: 'Docker Compose',
      group: 'containers',
      beat: 5,
      teachFromZero: true,
      tags: ['compose', 'service', 'bridge-network', 'volume', 'depends_on', 'named-volume', 'port-mapping'],
      oneLine:
        'Docker Compose define múltiplos containers como um conjunto declarativo — um único arquivo orquestra API, banco e qualquer serviço de infraestrutura localmente.',
      pass1:
        'Sua API precisa de banco. Você poderia rodar dois docker run separados com flags e variáveis na mão, mas é frágil e difícil de reproduzir. O Docker Compose lê um arquivo YAML que declara todos os services, suas imagens, portas, variáveis de ambiente, volumes e dependências de inicialização. `docker compose up` sobe tudo de uma vez. `docker compose down` derruba tudo.',
      pass2:
        '**Estrutura básica**:\n```yaml\nservices:\n  api:\n    build: .\n    ports: ["3000:3000"]\n    environment:\n      - DATABASE_URL=postgres://ics:dev@db:5432/ics_dev\n    depends_on: [db]\n  db:\n    image: postgres:16\n    environment:\n      - POSTGRES_USER=ics\n      - POSTGRES_PASSWORD=dev\n    volumes:\n      - pgdata:/var/lib/postgresql/data\nvolumes:\n  pgdata:\n```\n\n**Rede interna**: o Compose cria uma rede bridge privada. Dentro dela, containers se alcançam pelo nome do serviço — a API conecta no banco com host `db:5432`, não com `localhost:5432`. De fora (do seu browser), só as portas mapeadas em `ports:` são acessíveis.\n\n**Volumes**: dados do banco precisam persistir entre restarts. `pgdata:` é um named volume gerenciado pelo Docker — fica no disco do host fora do container. Sem volume, toda vez que você derruba o banco, todos os dados somem.\n\n**depends_on não espera o banco estar pronto**: depends_on garante que o container do banco inicia antes da API, mas não espera o Postgres terminar de inicializar (~2s). A solução é um retry na conexão ou um health check com `condition: service_healthy`.',
      pass3: [
        {
          gotcha: 'localhost dentro de um container não é o localhost do host',
          note: 'Dentro do container api, `localhost` aponta para o próprio container da API — não para o host nem para o container db. Use o nome do serviço (`db`) ou, para acessar o host a partir do container no Mac, use `host.docker.internal`.',
        },
        {
          gotcha: 'depends_on não garante que o serviço está pronto para aceitar conexões',
          note: 'O Postgres pode demorar 1-2s pós-container-start para aceitar conexões. depends_on só aguarda o container iniciar, não o processo interno estar pronto.',
        },
        {
          gotcha: 'docker compose up --build não é o mesmo que docker compose up',
          note: '--build força rebuild das imagens declaradas com `build:`. Sem --build, o Compose usa imagens já buildadas localmente — código novo não entra. Em dev, sempre use --build.',
        },
      ],
      diagram: `flowchart LR
  subgraph compose["docker-compose.yml (rede interna)"]
    direction LR
    API["🟢 api\\n:3000"] <-->|db:5432| DB["🐘 postgres\\n(volume pgdata)"]
  end
  Browser["🌐 Browser"] -->|localhost:3000| API
  Browser -.->|❌ sem acesso direto| DB`,
      diagramUrl: '/diagrams/deploy-journey/docker-compose.png',
      anchor:
        'Se sua API e seu banco estão cada um em seu container, como a API sabe o endereço do banco? Ela usa localhost?',
      askWho: [
        {
          name: 'Eduardo',
          why: 'Networking estudado — vai intuir sobre resolução de nomes e redes Docker.',
        },
        {
          name: 'Livia',
          why: 'Containers cobertos — terceira vez que aparece, agora com contexto de rede.',
        },
        {
          name: 'Messias',
          why: 'Networking estudado — pode reforçar a perspectiva de bridge network e DNS interno.',
        },
      ],
      followup:
        'Ótimo — agora dois devs rodam o mesmo ambiente local. Mas tem um problema que o Compose não resolve: as variáveis de ambiente com credenciais. Como vocês compartilham isso com segurança?',
      gotcha:
        'O que acontece com os dados do banco quando você roda `docker compose down -v`?',
      scenarios: {
        right: {
          shape:
            'Explica que containers na mesma rede Compose se alcançam pelo nome do serviço, não por localhost.',
          redirect:
            'Perfeito. E fora dessa rede — o seu browser alcança o banco diretamente?',
        },
        close: {
          shape:
            'Sabe que não é localhost, mas acha que é o IP do container (ex: 172.18.0.3).',
          redirect:
            'IP funciona, mas é imprático — o IP muda a cada restart. O Compose tem um mecanismo mais robusto. O que ele usa para estabilizar esse endereço?',
        },
        wayOff: {
          shape:
            'Acha que a API usa localhost:5432 porque "estão na mesma máquina".',
          redirect:
            'Faz sentido intuitivamente. Mas cada container tem sua própria pilha de rede — localhost dentro do container da API aponta para quem?',
        },
      },
    },

    // ─── Beat 6: O problema dos secrets ───────────────────────────────────────
    {
      id: 'secrets-problem',
      label: 'O problema dos secrets',
      group: 'cloud',
      beat: 6,
      tags: ['secret', '.env', 'git-history', 'credencial', 'rotação', 'least-privilege', 'audit-trail'],
      oneLine:
        'Mandar credenciais pelo WhatsApp não é só inconveniente — é um risco de segurança real com consequências difíceis de reverter.',
      pass1:
        'Você tem DB_URL, JWT_SECRET, chave de API do OpenAI. O colega precisa desses valores. O WhatsApp parece conveniente — mas cria três problemas que não desaparecem: quem mais está no grupo viu a mensagem, se alguém sair da empresa as credenciais não são revogadas, e se um celular for comprometido, todas as credenciais daquele chat vazam juntas.',
      pass2:
        '**O problema do histórico do git**: se em algum momento alguém commitou o .env (por acidente), as credenciais estão no histórico — mesmo depois de remover o arquivo e fazer um novo commit. Git history é imutável por design. A única solução é reescrever o histórico e trocar todas as credenciais expostas.\n\n**O problema de rotação**: quando uma credencial vaza ou um dev sai, você precisa trocar as senhas. Com .env via WhatsApp, você não sabe quantas cópias existem nem quem tem cada uma.\n\n**O problema de produção vs desenvolvimento**: sua máquina local tem credenciais de dev. O servidor de produção tem credenciais reais. Misturar os dois por acidente é uma das formas mais comuns de perda de dados.\n\n**O que precisamos**: um lugar centralizado onde as credenciais vivem, com controle de acesso, auditoria, e rotação sem precisar avisar todo mundo no WhatsApp.',
      pass3: [
        {
          gotcha: 'Deletar o arquivo .env do git não remove do histórico',
          note: 'git rm .env && git commit faz o arquivo sumir do working tree, mas git log --all -p -- .env ainda mostra os valores. Para limpar de verdade, use BFG Repo-Cleaner ou git filter-repo.',
        },
        {
          gotcha: '.env no .gitignore não protege se você fez git add -f uma vez',
          note: 'Uma vez que um arquivo rastreado é adicionado com -f, o .gitignore para de ignorar aquele arquivo. Checar se .env está rastreado: `git ls-files .env`.',
        },
        {
          gotcha: 'Credenciais em variáveis de ambiente são visíveis para o processo filho',
          note: 'Variáveis de ambiente são herdadas por subprocessos. Em containers, env vars aparecem em `docker inspect`. Secrets verdadeiramente sensíveis devem ser montados como arquivos via volume.',
        },
      ],
      diagram: `flowchart LR
  Dev1["💻 Dev 1"]
  Dev1 -->|"WhatsApp: .env"| Dev2["💻 Dev 2"]
  Dev1 -->|"git commit .env ❌"| Repo["📚 Git History\\n(permanente!)"]
  Repo -.->|"qualquer clone\\nvê as credenciais"| Any["👀 Qualquer pessoa\\ncom acesso ao repo"]`,
      diagramUrl: '/diagrams/deploy-journey/secrets-problem.png',
      anchor:
        'Quais são os riscos práticos de mandar um .env com credenciais de produção pelo WhatsApp para um colega?',
      askWho: [
        {
          name: 'Eduardo',
          why: 'Security + networking + databases estudados — vai nomear riscos como histórico, acesso não-controlado, rotação difícil.',
        },
        {
          name: 'Maria Clara',
          why: 'Security + networking — vai pensar em vetores de vazamento e superfície de ataque.',
        },
        {
          name: 'Livia',
          why: 'Security estudada — terceiro ângulo. Pode trazer perspectiva de containers e variáveis de ambiente.',
        },
      ],
      followup:
        'O que você precisaria para resolver esses três problemas ao mesmo tempo: acesso controlado, auditoria, e rotação fácil?',
      gotcha:
        'Se a solução é não commitar .env, como o servidor de produção sabe as credenciais? Onde elas vivem se não em arquivo?',
      scenarios: {
        right: {
          shape:
            'Nomeia pelo menos dois dos três riscos e conclui que precisa de um sistema centralizado.',
          redirect:
            'Exato. E esse sistema centralizado já existe como managed service na AWS. Vamos ver como ele funciona.',
        },
        close: {
          shape:
            'Fala que "é inseguro porque qualquer um no chat pode ver" mas não vai fundo em histórico ou rotação.',
          redirect:
            'Você cobriu a parte de quem vê. E se esse dev sair da empresa semanas depois? Como você revoga o acesso dele às credenciais que recebeu pelo WhatsApp?',
        },
        wayOff: {
          shape:
            'Acha que o problema é só "não commitar o .env" e que mandar pelo WhatsApp é OK.',
          redirect:
            'Certo, não commitar é uma camada de proteção. Mas e o histórico de mensagens do WhatsApp? E se o celular do seu colega for comprometido?',
        },
      },
    },

    // ─── Beat 7: AWS SSM Parameter Store ──────────────────────────────────────
    {
      id: 'aws-ssm',
      label: 'AWS SSM Parameter Store',
      group: 'cloud',
      beat: 7,
      teachFromZero: true,
      tags: ['ssm', 'parameter-store', 'iam-role', 'kms', 'secrets-manager', 'aws-sdk', 'aws'],
      oneLine:
        'O Parameter Store é um cofre de configurações da AWS — credenciais ficam centralizadas, criptografadas, com controle de acesso via IAM e sem precisar de WhatsApp.',
      pass1:
        'O AWS Systems Manager Parameter Store armazena configurações e secrets. Você guarda um parâmetro com um nome (ex: /prod/DB_URL) e o app busca em runtime via SDK. O acesso é controlado por IAM Role — o servidor de produção tem uma role que permite ler /prod/*, o computador do dev não tem. Quando um dev sai, você revoga a role. Quando uma senha troca, você atualiza no Parameter Store e o próximo deploy pega automaticamente.',
      pass2:
        '**Parameter Store vs Secrets Manager**: ambos armazenam strings seguras. O Secrets Manager adiciona rotação automática e tem custo por secret. O Parameter Store é gratuito para parâmetros padrão e suficiente para a maioria dos casos.\n\n**Hierarquia de nomes**: `/prod/database/url`, `/dev/database/url`, `/prod/jwt/secret`. A hierarquia por path facilita dar permissão de leitura só para um ambiente.\n\n**Acesso via IAM Role**: em vez de passar chave de acesso AWS como variável de ambiente (o que seria o mesmo problema do .env), o servidor EC2 ou container ECS assume uma IAM Role automaticamente. Essa role tem policy `ssm:GetParameter` para os paths necessários. O SDK detecta as credenciais da role via instance metadata.\n\n**Uso no código**:\n```typescript\nconst ssm = new SSMClient({ region: "us-east-1" });\nconst param = await ssm.send(new GetParameterCommand({\n  Name: "/prod/database/url",\n  WithDecryption: true,\n}));\nconst dbUrl = param.Parameter!.Value;\n```\n\n**Desenvolvimento local**: seu computador não tem IAM Role de servidor. Para dev local, continue usando .env — mas nunca coloque credenciais de produção nele.',
      pass3: [
        {
          gotcha: 'IAM Role vs IAM User — não use User com access key em produção',
          note: 'IAM User gera access key + secret que você copia para env vars — voltamos ao problema inicial. IAM Role é temporária e rotacionada automaticamente pelo AWS STS. Em produção, sempre use Role.',
        },
        {
          gotcha: 'SecureString usa KMS e tem custo por decriptação',
          note: 'Cada GetParameter com WithDecryption:true consome uma operação KMS. Para configs que mudam raramente, o padrão é cachear o valor na inicialização do app, não buscar a cada request.',
        },
        {
          gotcha: 'Parâmetro Standard tem limite de 4KB por valor',
          note: 'O tipo Standard (gratuito) suporta até 4KB por parâmetro. Certificados TLS e chaves privadas precisam de Advanced (~$0.05/param/mês).',
        },
      ],
      diagram: `flowchart LR
  Dev["💻 Dev\\n(local .env)"] -->|aws ssm put-parameter| SSM["🔐 AWS SSM\\nParameter Store"]
  App["🟢 Container\\n(ECS Task)"] -->|SDK GetParameter| SSM
  IAM["🛡️ IAM Role\\n(Task Role)"] -->|permite /prod/*| App`,
      diagramUrl: '/diagrams/deploy-journey/aws-ssm.png',
      anchor:
        'Por que usar um serviço de secrets centralizado em vez de passar variáveis de ambiente diretamente no servidor?',
      askWho: [
        {
          name: 'Eduardo',
          why: 'Security + databases + networking — vai conectar IAM com o problema de rotação discutido no beat anterior.',
        },
        {
          name: 'Messias',
          why: 'Networking + databases — vai pensar em acesso e autenticação de serviço a serviço.',
        },
        {
          name: 'Livia',
          why: 'Security estudada — vai trazer perspectiva de containers e como o app consome os secrets.',
        },
      ],
      followup:
        'Agora temos secrets centralizados. O próximo problema: onde o container vai rodar? Sua máquina local ou algum servidor na AWS?',
      gotcha:
        'Se o app busca o secret no Parameter Store a cada request HTTP, qual é o problema de performance? Como você resolve?',
      scenarios: {
        right: {
          shape:
            'Menciona controle de acesso granular (IAM), auditoria de quem leu o quê, e rotação sem precisar atualizar todos os envs manualmente.',
          redirect:
            'Perfeito. E como o container na AWS sabe que tem permissão de ler esses parâmetros, sem ter uma senha de AWS explícita?',
        },
        close: {
          shape:
            'Fala que "é mais seguro porque fica na AWS", mas não especifica por que é mais seguro que env var.',
          redirect:
            'Bom instinto. O que "mais seguro" significa concretamente? Quais problemas do .env via WhatsApp isso resolve?',
        },
        wayOff: {
          shape:
            'Acha que ainda vão usar env vars normais, mas guardadas "em outro lugar".',
          redirect:
            'Faz sentido querer guardar em algum lugar. Mas se você guardar numa env var num servidor, quem mais consegue ler aquela env var?',
        },
      },
    },

    // ─── Beat 8: Deploy na nuvem ──────────────────────────────────────────────
    {
      id: 'cloud-deploy',
      label: 'Deploy na nuvem — EC2 vs ECS',
      group: 'cloud',
      beat: 8,
      teachFromZero: true,
      tags: ['ec2', 'ecs', 'fargate', 'ecr', 'task-definition', 'rolling-deploy', 'container-registry'],
      oneLine:
        'A diferença entre EC2 e ECS Fargate é a diferença entre alugar um servidor e alugar um serviço — o segundo te livra de gerenciar OS, patching e reinicialização de containers.',
      pass1:
        'Você tem um Dockerfile funcionando localmente. Para rodar em produção, você precisa de uma máquina na internet. A opção mais bruta é EC2 — uma VM Linux da AWS onde você instala Docker e roda docker run na mão. A opção gerenciada é ECS Fargate — você dá o Dockerfile (ou a imagem) e o Fargate aloca compute, roda o container, reinicia se ele morrer, e você não gerencia o OS.',
      pass2:
        '**EC2 (Elastic Compute Cloud)**: você provisiona uma VM Linux, escolhe tipo de instância (CPU/RAM), e tem acesso root completo. Bom para workloads que precisam de configuração de OS específica, acesso a hardware especial (GPUs), ou para times que já têm expertise em Linux server admin. Desvantagens: você gerencia tudo — updates de segurança, restart de processo se o container morrer.\n\n**ECS Fargate (Elastic Container Service)**: você define uma Task Definition (imagem Docker, CPU, memória, env vars, IAM role, portas) e o Fargate cria e gerencia a infraestrutura subjacente. Quando o container morre, o ECS reinicia automaticamente. Você nunca faz SSH em nada — o container é sua unidade de deploy.\n\n**ECR (Elastic Container Registry)**: onde suas imagens Docker ficam na AWS. O pipeline de CI faz docker build + docker push para o ECR. O ECS Task Definition referencia a imagem pelo URI do ECR. É o equivalente do Docker Hub mas privado e dentro da sua conta AWS.\n\n**Task Definition vs Service**: a Task Definition é o spec do container (imagem, CPU, memória, env, portas). O Service define quantas Tasks rodar e como fazer o deploy de novas versões (rolling update).',
      pass3: [
        {
          gotcha: 'Task com 256 CPU units não é "256 vCPUs"',
          note: 'CPU no Fargate é medida em unidades (1024 units = 1 vCPU). Uma task com 256 CPU é 0.25 vCPU — suficiente para APIs simples em baixo tráfego.',
        },
        {
          gotcha: 'ECS Fargate não tem disco persistente — o container é efêmero',
          note: 'O filesystem do container é descartado quando a task para. Qualquer dado que precisa persistir deve ir para S3, RDS, ElastiCache ou EFS.',
        },
        {
          gotcha: 'Pulling imagem ECR dentro de VPC precisa de endpoint ou NAT Gateway',
          note: 'Por padrão, o ECS em subnet privada não consegue fazer pull de imagens do ECR sem um NAT Gateway ($0.045/h) ou VPC Endpoints. Sem isso, o container fica preso em PENDING.',
        },
      ],
      diagram: `flowchart LR
  Dev["💻 git push"] --> CI["⚙️ CI/CD"]
  CI -->|docker build + push| ECR["📦 ECR\\n(registry)"]
  ECR -->|pull| Fargate["⚡ ECS Fargate\\n(AWS gerencia o OS)"]
  Fargate --> App["🟢 Container\\nem produção"]`,
      diagramUrl: '/diagrams/deploy-journey/cloud-deploy.png',
      anchor:
        'Você tem um Dockerfile funcionando localmente. Quais são as suas opções para rodar isso em produção, e qual pergunta você faria pra escolher entre elas?',
      askWho: [
        {
          name: 'Eduardo',
          why: 'Maior breadth do cohort — vai trazer visão de tradeoffs EC2 vs ECS vs outros.',
        },
        {
          name: 'Livia',
          why: 'Containers estudados — vai conectar o Dockerfile com a infraestrutura de produção.',
        },
        {
          name: 'Messias',
          why: 'Networking + databases — vai pensar em conectividade e persistência de dados.',
        },
      ],
      followup:
        'Você tem um container rodando em produção. Agora o produto faz sucesso e começa a receber muito mais tráfego. O que acontece?',
      gotcha:
        'Se você tem uma task ECS rodando e a CPU chega a 100%, o que acontece com as requisições que chegam depois?',
      scenarios: {
        right: {
          shape:
            'Distingue EC2 (você gerencia OS) de ECS/Fargate (AWS gerencia infra), e menciona trade-off de controle vs conveniência.',
          redirect:
            'Perfeito. E qual é o componente que faz o tráfego da internet chegar até o seu container? O IP da task muda a cada deploy.',
        },
        close: {
          shape:
            'Sabe que vai "subir numa VM na AWS" mas não diferencia EC2 de ECS.',
          redirect:
            'EC2 é uma VM — você está certo. Mas existe um modo onde a AWS gerencia a VM pra você e você só dá o container. O que você ganha e perde?',
        },
        wayOff: {
          shape:
            'Propõe usar Heroku ou VPS genérico sem conhecer AWS.',
          redirect:
            'Esses serviços fazem algo similar — o conceito é o mesmo. Na AWS, como isso se chama? E o que você configuraria no mínimo pra subir um container?',
        },
      },
    },

    // ─── Beat 9: Compute Decisions ────────────────────────────────────────────
    {
      id: 'compute-decisions',
      label: 'Compute — Vercel vs ECS vs EC2',
      group: 'infra',
      beat: 9,
      teachFromZero: true,
      tags: ['vercel', 'ecs', 'ec2', 'fargate', 'serverless', 'paas', 'vps', 'deployment-target'],
      oneLine:
        'Para cada tipo de projeto existe um compute ideal — Vercel para apps serverless/Next.js, ECS para backends com estado, EC2 quando você precisa de controle total.',
      pass1:
        'Você terminou o backend da EJ e precisa colocar no ar. Três caminhos principais: Vercel Functions (serverless gerenciado), ECS Fargate (Docker sem gerenciar OS), ou EC2 (VM completa, você gerencia tudo). A maioria dos projetos de EJ começa no Vercel e migra para ECS quando a arquitetura fica mais complexa. A decisão não é sobre qual ferramenta você conhece melhor — é sobre o perfil do workload.',
      pass2:
        '**Vercel**: para Next.js, frontends, e APIs que funcionam como funções stateless. Zero config, deploy via git push, HTTPS automático. Gratuito para começar. Limitações reais: máximo 300s de execução por função, sem conexão TCP persistente (cada invocation é independente), sem controle de rede, custos sobem rápido em alto tráfego ($0.40/milhão de invocações após o free tier). O pooling de banco não funciona bem porque cada função pode abrir uma nova conexão.\n\n**ECS Fargate**: você escreve um Dockerfile, define uma Task Definition, e a AWS roda o container sem você gerenciar EC2. Suporta processos long-running, conexões persistentes (WebSocket, pool de banco poolado), e escala via Service. Mais setup que Vercel mas mais controle. Custo ~$15/mês para 0.25 vCPU + 512MB — razoável para um backend de EJ em produção.\n\n**EC2**: VM Linux completa, acesso root. Flexível mas trabalhoso — você gerencia patching de OS, reinicialização do processo, updates de segurança. Escolha EC2 para GPU, acesso a hardware específico, ou otimização de custo em altíssima escala.\n\n**Decision tree para EJ**:\n- Frontend + API simples → Vercel (começa grátis, deploya em 2 minutos)\n- Backend Node.js com banco poolado + WebSocket + filas → ECS Fargate\n- Processamento ML/GPU ou requisitos de rede específicos → EC2\n- "Quero o menor custo possível" → compare Vercel free vs ECS (~$15/mês) vs EC2 t3.micro (~$8/mês)',
      pass3: [
        {
          gotcha: 'Vercel Functions não suportam conexão de banco poolada',
          note: 'Cada Function invocation pode criar uma nova conexão com o banco. Em alto tráfego, isso esgota o max_connections do Postgres. Use PgBouncer ou Supabase connection pooling, ou migre para ECS.',
        },
        {
          gotcha: 'ECS Fargate cold start não é zero',
          note: 'Uma nova task ECS Fargate leva 40-60s para subir (pull de imagem + init). Para APIs que precisam de resposta sub-segundo em scale-out, isso importa. EC2 com containers pré-aquecidos é mais rápido.',
        },
        {
          gotcha: 'Vercel free tier tem limites que pegam de surpresa',
          note: '100GB/mês de bandwidth e 100h de edge compute no free tier. Um projeto de EJ com tráfego real pode ultrapassar. Sempre configure billing alerts na Vercel dashboard.',
        },
      ],
      diagram: `flowchart LR
  EJ["🏗️ Projeto EJ\\n(Dockerfile pronto)"]
  EJ -->|"Frontend/API\\nsimples (stateless)"| Vercel["⚡ Vercel\\nFunctions\\nGrátis + fácil"]
  EJ -->|"Backend com banco\\nWebSocket + estado"| Fargate["🐳 ECS Fargate\\nDocker gerenciado\\n~$15/mês"]
  EJ -->|"GPU / config\\ncustom"| EC2["☁️ EC2\\nVM completa\\n~$8/mês"]
  Vercel -.->|"Cresce muito"| Fargate`,
      diagramUrl: '/diagrams/deploy-journey/compute-decisions.png',
      anchor:
        'Você terminou o backend da EJ. Precisa colocar no ar agora. Quais são suas opções e o que faz você escolher uma sobre a outra?',
      askWho: [
        {
          name: 'Eduardo',
          why: 'Maior breadth do cohort — vai articular tradeoffs de controle vs conveniência.',
        },
        {
          name: 'Livia',
          why: 'Containers estudados — vai defender ECS/Docker como caminho natural pós-Dockerfile.',
        },
        {
          name: 'Messias',
          why: 'Networking + databases — vai pensar em persistência e conectividade ao escolher compute.',
        },
      ],
      followup:
        'OK — você escolheu onde rodar o compute. Agora precisa de banco. Mesma lógica: quais são as opções e quando usar cada uma?',
      gotcha:
        'Se o Vercel é tão fácil, por que alguém usaria ECS? O que o Vercel não consegue fazer que você precisaria num backend de verdade?',
      scenarios: {
        right: {
          shape:
            'Fala de trade-offs reais (Vercel fácil mas stateless, ECS mais controle com persistência, EC2 máximo controle), usa perfil de workload para escolher.',
          redirect:
            'Perfeito. Agora — compute escolhido. Você precisa de banco. Quais são as opções e qual escolheria para começar um projeto de EJ?',
        },
        close: {
          shape:
            'Fala "usar Vercel porque é mais fácil" sem entender os limites técnicos de pooling e estado.',
          redirect:
            'Vercel é uma boa escolha para começar. Mas e o pool de conexões com o banco? O que acontece com as conexões quando cada function invocation é independente?',
        },
        wayOff: {
          shape:
            'Propõe "só usar EC2 para tudo" sem considerar o overhead de gerenciamento.',
          redirect:
            'EC2 dá controle total — faz sentido. Qual é o custo de tempo disso? Quantas horas por semana você quer gastar administrando o OS da VM em vez de escrever código?',
        },
      },
    },

    // ─── Beat 10: Banco e Cache ───────────────────────────────────────────────
    {
      id: 'db-cache',
      label: 'Banco e Cache — Supabase vs RDS vs Redis',
      group: 'infra',
      beat: 10,
      teachFromZero: true,
      tags: ['supabase', 'rds', 'postgresql', 'redis', 'upstash', 'elasticache', 'managed-db', 'cache-layer'],
      oneLine:
        'Para projetos de EJ: Supabase resolve banco + auth + storage em um lugar; Redis (Upstash) resolve cache e sessões sem pagar quando idle.',
      pass1:
        'A base de dados é o estado do seu sistema — a escolha importa mais que compute porque migrar banco em produção é doloroso. Para projetos de EJ, a pergunta é: quanto overhead de infraestrutura você quer gerenciar em troca de quanto controle? Supabase resolve isso para a maioria dos casos.',
      pass2:
        '**Supabase**: PostgreSQL gerenciado com auth, storage de arquivos, realtime subscriptions via WebSocket, e Row Level Security. Dashboard visual para ver os dados. Free tier com 500MB e 2 projetos. Ideal para MVPs e projetos de EJ — você conecta em 5 minutos e já tem banco + auth + storage. Limitação: vendor lock-in nos features built-in; pode ficar caro em escala; projetos inativos por 7 dias são pausados no free tier.\n\n**RDS**: PostgreSQL ou MySQL gerenciado pela AWS. Você controla versão, tamanho de instância, backups, e tem integração nativa com outros serviços AWS (ECS, Lambda, Secrets Manager). Sem auth/storage built-in. Mais setup mas mais controle. Use RDS quando já está na AWS e o projeto cresceu além do Supabase.\n\n**Redis — ElastiCache vs Upstash**:\n- **ElastiCache**: Redis gerenciado pela AWS, always-on, latência ultra-baixa dentro da VPC. Custa $0.04/hora (~$29/mês) mesmo sem uso. Ideal para sistemas de alto tráfego onde Redis está sempre quente.\n- **Upstash**: Redis serverless — você paga por request ($0.2 por 100k requests), sem cobrança quando idle. Free tier de 10k requests/dia. Perfeito para EJ projects com tráfego variável. Use Upstash para começar, migre para ElastiCache se o tráfego justificar.\n\n**Decision tree**:\n- MVP ou EJ project → Supabase (PostgreSQL + auth + storage em um lugar)\n- Já na AWS, projeto cresceu → RDS\n- "Preciso de MongoDB" → 99% não precisam; PostgreSQL com JSONB é mais flexível\n- Cache/sessions, tráfego baixo → Upstash (paga pelo uso, zero quando idle)\n- Cache com alto tráfego constante → ElastiCache',
      pass3: [
        {
          gotcha: 'Supabase free tier pausa projetos inativos após 7 dias',
          note: 'Projetos no free tier que não recebem requests por 7 dias são pausados. A primeira requisição pode levar 20-30s para "acordar". Configure um cron job para fazer um ping a cada 6 dias.',
        },
        {
          gotcha: 'Trocar de Supabase para RDS em produção é difícil',
          note: 'Supabase usa Row Level Security, realtime, e auth.users table com schema específico. Migrar para RDS significa reescrever a camada de auth. Decida cedo se vai ficar no Supabase.',
        },
        {
          gotcha: 'Redis não é um banco de dados primário',
          note: 'Redis perde dados não-persistidos em restart por padrão. Use Redis para cache, sessões, rate limiting, filas de curta duração — não como substituto de Postgres.',
        },
      ],
      diagram: `flowchart TD
  EJ["🏗️ Projeto EJ"]
  EJ --> Q{"Quanto overhead\\nde infra aceito?"}
  Q -->|"Mínimo\\n(começa aqui)"| Supa["🟢 Supabase\\nPostgreSQL + Auth\\n+ Storage + Realtime"]
  Q -->|"Mais controle\\n+ AWS-native"| RDS["🐘 RDS\\nPostgreSQL gerenciado"]
  Q -->|"Cache/Sessão\\n(tráfego baixo)"| Up["⚡ Upstash Redis\\npaga por request"]
  Q -->|"Cache/Sessão\\n(alto tráfego)"| EC["🔴 ElastiCache\\n~$29/mês always-on"]
  Supa -.->|"Cresce além do free"| RDS`,
      diagramUrl: '/diagrams/deploy-journey/db-cache.png',
      anchor:
        'Você precisa de banco de dados para o projeto. Tem Supabase, RDS, e Redis na mesa. O que você escolheria para um projeto de EJ e por quê?',
      askWho: [
        {
          name: 'Eduardo',
          why: 'Databases + networking + security — vai articular os tradeoffs Supabase vs RDS com mais contexto.',
        },
        {
          name: 'Messias',
          why: 'Databases + networking — vai pensar em acesso e latência de banco em produção.',
        },
        {
          name: 'Rayssa',
          why: 'Databases estudados — representante do grupo que só estudou banco. Perspectiva de quem priorizou essa camada.',
        },
      ],
      followup:
        'Você escolheu Supabase para começar. O projeto cresceu e agora precisa migrar para RDS. O que é diferente, o que você perde, e por onde começa?',
      gotcha:
        'Se Supabase é PostgreSQL e RDS também é PostgreSQL, por que a migração é difícil?',
      scenarios: {
        right: {
          shape:
            'Fala de trade-offs concretos (Supabase para começar rápido, RDS para mais controle), menciona auth/realtime como diferenciais do Supabase.',
          redirect:
            'Exato. E para cache — sessões de usuário, rate limiting — qual você usaria num EJ project que tem tráfego irregular?',
        },
        close: {
          shape:
            'Fala "usar Postgres" sem diferenciar as opções gerenciadas.',
          redirect:
            'PostgreSQL é a escolha certa para o banco relacional. Mas existem várias formas de rodar Postgres. O que a Supabase adiciona que RDS não tem? E o contrário?',
        },
        wayOff: {
          shape:
            'Propõe MongoDB porque "o schema vai mudar muito".',
          redirect:
            'Schema flexível é um argumento para NoSQL. Mas o PostgreSQL tem JSONB — uma coluna que guarda JSON arbitrário e é indexável. Qual seria um caso onde MongoDB seria realmente necessário sobre Postgres + JSONB?',
        },
      },
    },

    // ─── Beat 11: CI/CD ───────────────────────────────────────────────────────
    {
      id: 'cicd',
      label: 'CI/CD — do commit ao deploy',
      group: 'devops',
      beat: 11,
      teachFromZero: true,
      tags: ['ci', 'cd', 'github-actions', 'pipeline', 'sha-tag', 'build-artifact', 'deploy-gate'],
      oneLine:
        'CI/CD elimina o deploy manual — um commit no main dispara um pipeline que testa, builda a imagem Docker, faz push para o ECR, e atualiza o serviço ECS automaticamente.',
      pass1:
        'Sem automação, o deploy é assim: você roda os testes manualmente, faz docker build, docker push para o ECR, vai no console da AWS, atualiza a Task Definition, force-deploya o Service. Qualquer passo esquecido ou errado vai para produção. CI/CD automatiza cada passo e adiciona um portão: o deploy só avança se os testes passarem.',
      pass2:
        '**CI (Continuous Integration)**: toda vez que alguém faz push, um runner (GitHub Actions, GitLab CI) clona o repo, instala deps, roda lint, typecheck, testes unitários, testes de integração. Se qualquer coisa falhar, o pipeline para e você é notificado. Detecta regressões antes de chegar em produção.\n\n**CD (Continuous Delivery/Deployment)**: depois do CI passar, o pipeline faz o deploy. Delivery = coloca o artefato pronto mas um humano aprova. Deployment = deploy automático. A maioria dos times usa Delivery para produção e Deployment para staging.\n\n**O pipeline típico para ECS**:\n```yaml\njobs:\n  test:\n    steps: [checkout, npm ci, npm test]\n  build-push:\n    needs: test\n    steps:\n      - docker build -t $ECR_URI:$SHA .\n      - docker push $ECR_URI:$SHA\n  deploy:\n    needs: build-push\n    steps:\n      - aws ecs update-service --force-new-deployment\n```\n\n**Rolling deployment**: ao atualizar o ECS Service, o ECS sobe tasks com a nova imagem gradualmente, verifica o health check, e termina as tasks antigas. Nunca com zero tasks rodando.',
      pass3: [
        {
          gotcha: 'Tag :latest não permite rollback confiável',
          note: 'Se você sempre faz push para ECR com tag :latest e o novo deploy quebra, você não sabe qual imagem é a "anterior". Use o SHA do commit como tag ($GITHUB_SHA). Rollback é apenas trocar para a task definition com o SHA anterior.',
        },
        {
          gotcha: 'Secrets do CI não devem ser hardcoded nos workflows',
          note: 'AWS_ACCESS_KEY_ID e outras credenciais devem ficar em GitHub Secrets (Settings > Secrets > Actions), não no arquivo YAML do workflow. O YAML fica no repo — qualquer pessoa com acesso lê.',
        },
        {
          gotcha: 'force-new-deployment sem nova imagem não faz nada útil',
          note: 'Se você mudou a Task Definition mas não alterou a imagem (manteve a mesma tag), o ECS pode reutilizar a imagem em cache. Sempre altere a tag da imagem — o SHA do commit garante unicidade.',
        },
      ],
      diagram: `flowchart LR
  Code["💻 git push main"] -->|trigger| GH["⚙️ GitHub Actions"]
  GH -->|"npm test\\n(CI gate)"| Tests{{"✅ Passed?"}}
  Tests -->|sim| Build["docker build\\n:sha-abc123"]
  Build -->|docker push| ECR["📦 ECR"]
  ECR -->|ecs update-service| ECS["⚡ ECS\\n(rolling deploy)"]
  Tests -->|não| Stop["🛑 Pipeline para"]`,
      diagramUrl: '/diagrams/deploy-journey/cicd.png',
      anchor:
        'Você faz um commit. Quantas etapas manuais existem até esse código estar em produção hoje? Como você eliminaria cada etapa manual?',
      askWho: [
        {
          name: 'Eduardo',
          why: 'Maior breadth — vai articular a diferença CI vs CD e o conceito de portão de qualidade.',
        },
        {
          name: 'Messias',
          why: 'Networking + databases — vai pensar em artefatos e o que precisa estar testado antes de deploy.',
        },
        {
          name: 'Livia',
          why: 'Containers estudados — vai conectar docker build + push com o pipeline automatizado.',
        },
      ],
      followup:
        'Você tem CI/CD funcionando. Algo dá errado às 3h da manhã. Como você sabe o que aconteceu?',
      gotcha:
        'O pipeline passou em todos os testes mas a produção está quebrada. Como isso é possível?',
      scenarios: {
        right: {
          shape:
            'Lista as etapas manuais e propõe um trigger automático no commit para fazer tudo em sequência com portão de testes.',
          redirect:
            'Perfeito. E o portão de qualidade — o que deve impedir o código de chegar em produção se algo estiver errado?',
        },
        close: {
          shape:
            'Fala em "automatizar o deploy" mas não menciona o portão de CI.',
          redirect:
            'Automatizar o deploy é o CD. O que vem antes? O que garante que o código que vai ser deployado realmente funciona?',
        },
        wayOff: {
          shape:
            'Propõe checklist manual documentado mas não automatizado.',
          redirect:
            'Checklist ajuda. Mas qual é o risco de uma etapa manual num processo que acontece dezenas de vezes por semana?',
        },
      },
    },

    // ─── Beat 12: Arquitetura — fluxo completo ────────────────────────────────
    {
      id: 'full-architecture',
      label: 'Arquitetura — o fluxo completo',
      group: 'synthesis',
      beat: 12,
      tags: ['dns', 'cdn', 'alb', 'read-path', 'write-path', 'cache-invalidation', 'replica-lag', 'stateless'],
      oneLine:
        'Uma request atravessa DNS, CDN, load balancer, compute, cache, banco primário, e replica — o fluxo de leitura e o de escrita são assimétricos por design.',
      pass1:
        'Cada componente que vimos existe para resolver um problema específico. Agora vamos colocar todos juntos e traçar o caminho de uma requisição do browser até o banco e de volta. Separar leitura de escrita é crítico porque elas têm perfis completamente diferentes: leitura é frequente e pode ser stale; escrita é menos frequente mas precisa ser durável e consistente.',
      pass2:
        '**Fluxo de leitura** (GET /api/plans):\n1. Browser resolve api.example.com via Route53\n2. CloudFront verifica o cache — se hit, retorna sem tocar o backend\n3. Se miss, CloudFront encaminha para o ALB\n4. ALB roteia para uma das ECS Tasks disponíveis\n5. A Task tenta ElastiCache (Redis) — cache hit retorna em <1ms\n6. Cache miss: consulta o RDS Read Replica\n7. Resultado sobe pela stack, CloudFront cacheia por 60s\n\n**Fluxo de escrita** (POST /api/plans):\n1-4. Mesmo path até a ECS Task\n5. Task valida o body, escreve no RDS Primary (escrita vai para o primário sempre)\n6. Invalida cache (Redis DEL, CloudFront invalidation)\n7. RDS Primary replica para a Read Replica assincronamente\n\n**Por que a assimetria importa**: leituras podem ir para a replica e para o CDN porque toleram stale por alguns segundos. Escritas precisam ir para o primário porque precisam ser duráveis. Tratar leituras como escritas (tudo no primário) desperdiça a capacidade das réplicas e sobrecarrega o primário.',
      pass3: [
        {
          gotcha: 'CDN cache + write → dados stale visíveis ao usuário',
          note: 'Se o CloudFront cacheia GET /api/plans por 5 minutos e um admin cria um novo plano, o usuário vê dados antigos por até 5 minutos. A solução é cache invalidation após writes — mas cache invalidation é um dos dois problemas difíceis da computação.',
        },
        {
          gotcha: 'Read replica lag pode ser visível ao usuário logo após write',
          note: 'Depois de um POST, um GET imediato pode ir para a replica que ainda não recebeu a replicação (~100ms de lag). O usuário escreveu um item e imediatamente não o vê. Solução: read-after-write consistency roteando a leitura imediata para o primário.',
        },
        {
          gotcha: 'Health check leve pode esconder problemas reais',
          note: 'Se /health retorna 200 sem checar conexão com banco e cache, o ALB acha que a task está saudável mesmo quando o banco está inacessível. Um health check mais rico verifica as dependências críticas, mas adiciona carga.',
        },
      ],
      diagram: `flowchart TD
  Browser["🌐 Browser"] --> R53["Route53\\n(DNS)"]
  R53 --> CF["CloudFront\\n(CDN)"]
  CF -->|cache miss| ALB["ALB\\n(Load Balancer)"]
  ALB --> T1["ECS Task 1"]
  ALB --> T2["ECS Task 2"]
  T1 -->|leitura| Cache["ElastiCache\\n(Redis)"]
  T1 -->|cache miss| RR["RDS Read Replica"]
  T1 -->|escrita| Primary["RDS Primary"]
  Primary -.->|replicação async| RR
  T1 --> SSM["SSM\\n(Secrets)"]
  T1 --> CW["CloudWatch\\n(Logs)"]`,
      diagramUrl: '/diagrams/deploy-journey/full-architecture.png',
      anchor:
        'Uma request GET chega no sistema. Desenha cada camada que ela atravessa — do DNS até o banco. Depois, faz o mesmo para um POST.',
      askWho: [
        {
          name: 'Eduardo',
          why: 'Networking + databases + security — maior breadth, vai traçar o caminho mais completo.',
        },
        {
          name: 'Livia',
          why: 'Containers + security — vai conectar os containers ECS com as camadas de rede ao redor.',
        },
        {
          name: 'Messias',
          why: 'Networking + databases — vai focar na assimetria de leitura/escrita e replicação.',
        },
      ],
      followup:
        'Para cada caixa que você acabou de desenhar, qual AWS managed service você colocaria? E qual é a lógica que guia cada escolha?',
      gotcha:
        'O CloudFront cacheou uma resposta. O usuário faz um PUT e os dados mudam. O que acontece com o cache?',
      scenarios: {
        right: {
          shape:
            'Traça pelo menos 5 camadas para GET e diferencia escrita indo para primário vs leitura indo para replica.',
          redirect:
            'Perfeito. Agora coloca o nome dos serviços AWS em cada caixa. Qual você usaria para cada componente?',
        },
        close: {
          shape:
            'Traça browser → LB → servidor → banco, mas sem CDN, cache, ou réplica.',
          redirect:
            'Boa base. Esse caminho é completo para um MVP. O que você adicionaria se 90% das requests fossem leituras dos mesmos dados?',
        },
        wayOff: {
          shape:
            'Não diferencia leitura de escrita — manda tudo para o mesmo banco.',
          redirect:
            'Funciona. Qual é o problema quando as leituras aumentam 10x e o banco começa a travar? Onde você botaria um alívio?',
        },
      },
    },

    // ─── Beat 13: AWS managed services por camada ─────────────────────────────
    {
      id: 'aws-services',
      label: 'AWS — services por camada',
      group: 'synthesis',
      beat: 13,
      tags: ['route53', 'cloudfront', 'alb', 'ecs-fargate', 'rds-aurora', 'elasticache', 'ssm', 'ecr', 'cloudwatch'],
      oneLine:
        'Cada caixa da arquitetura mapeia para um AWS managed service — a escolha é guiada pelo perfil de carga, não por familiaridade.',
      pass1:
        'AWS tem um serviço gerenciado para cada camada da arquitetura. "Gerenciado" significa que a AWS cuida de patching, alta disponibilidade, backups e scaling da infraestrutura — você configura, não opera. A lógica de escolha não é "qual serviço é mais popular" mas "qual perfil de workload esse serviço foi otimizado para".',
      pass2:
        '**DNS**: Route53 — DNS autoritative com health check integrado e roteamento por geolocalização/latência.\n\n**CDN**: CloudFront — rede de 400+ pontos de presença globais. Cache de objetos estáticos e respostas de API. Integração nativa com ACM para HTTPS.\n\n**Load Balancer**: ALB para HTTP/HTTPS (Layer 7, path-based routing, WebSocket). NLB para TCP/UDP de alta performance (Layer 4, conexões de longa duração, IP estático).\n\n**Compute**: ECS Fargate para containers stateless sem gerenciar EC2. Lambda para funções event-driven de curta duração (<15 min) — não adequado para servidor HTTP com warm connections.\n\n**Banco relacional**: RDS (PostgreSQL/MySQL/Aurora) — Multi-AZ por padrão em produção (failover automático em ~30s). Aurora PostgreSQL tem até 5x o throughput do RDS Postgres padrão.\n\n**Cache**: ElastiCache Redis — sub-milissegundo para cache de sessão, rate limiting, leaderboards, pub/sub. Upstash como alternativa serverless para tráfego variável.\n\n**Secrets**: SSM Parameter Store (gratuito, sem rotação automática) ou Secrets Manager (rotação automática, $0.40/secret/mês).\n\n**Registry**: ECR — privado, integrado com IAM, escaneia vulnerabilidades de imagem.\n\n**Observabilidade**: CloudWatch Logs + Metrics (nativo AWS), ou DataDog/Grafana para correlação cross-serviço mais rica.',
      pass3: [
        {
          gotcha: 'Lambda não é o padrão para backends HTTP',
          note: 'Lambda foi otimizado para funções curtas e event-driven. Para um servidor HTTP persistente com pool de banco, o cold start mata o pool, e a latência de inicialização (~200-500ms) aparece nas p99. ECS Fargate é a escolha certa para backends HTTP tradicionais.',
        },
        {
          gotcha: 'RDS Multi-AZ ≠ Read Replica',
          note: 'Multi-AZ cria um standby síncrono para failover (alta disponibilidade) — ele não aceita leituras. Read Replica é uma cópia assíncrona para distribuir carga de leitura. Produção precisa dos dois.',
        },
        {
          gotcha: 'ElastiCache sem cluster mode não é altamente disponível',
          note: 'Um cluster Redis com replication group mas sem cluster mode tem um único shard com um primary. O primary é um único ponto de falha se não tiver Multi-AZ habilitado.',
        },
      ],
      diagram: `flowchart TD
  Browser["🌐 Browser"] --> R53["Route53\\nDNS"]
  R53 --> CF["CloudFront\\nCDN"]
  CF --> ALB["ALB\\nLayer 7"]
  ALB --> ECS["ECS Fargate\\nCompute"]
  ECS --> EC["ElastiCache\\nRedis"]
  ECS --> RDS["RDS Aurora\\nPrimary"]
  RDS -.->|async| RDSr["RDS Aurora\\nReplica"]
  ECS --> SSM["SSM\\nSecrets"]
  ECS --> ECR["ECR\\nRegistry"]
  ECS --> CW["CloudWatch\\nObservabilidade"]`,
      diagramUrl: '/diagrams/deploy-journey/aws-services.png',
      anchor:
        'Para cada caixa da arquitetura que desenhamos, qual AWS managed service você usaria? E qual é a lógica — não o nome — que guia cada escolha?',
      askWho: [
        {
          name: 'Eduardo',
          why: 'Maior breadth — vai articular lógica de escolha por perfil de workload, não só nomear serviços.',
        },
        {
          name: 'Messias',
          why: 'Networking + databases — vai focar nas camadas de banco e rede da arquitetura.',
        },
        {
          name: 'Maria Clara',
          why: 'Networking + security — vai trazer perspectiva de edge, CDN e terminação TLS.',
        },
      ],
      followup:
        'Essa arquitetura toda, do zero, custa quanto por mês na AWS? Qual componente é o mais caro?',
      gotcha:
        'Você precisa de baixa latência global para usuários no Brasil e no Japão ao mesmo tempo. O que você mudaria nessa arquitetura?',
      scenarios: {
        right: {
          shape:
            'Nomeia pelo menos 5 serviços corretamente e articula a lógica de pelo menos uma escolha.',
          redirect:
            'Excelente. Agora o que essa arquitetura inteira custa? O que você cortaria num MVP para reduzir custo sem comprometer disponibilidade?',
        },
        close: {
          shape:
            'Nomeia os serviços corretamente mas não articula a lógica — só lista nomes.',
          redirect:
            'Certo nos nomes. Agora por que ECS Fargate e não Lambda para o backend? Qual é a diferença de perfil de workload?',
        },
        wayOff: {
          shape:
            'Coloca Lambda para o backend HTTP ou usa S3 para banco de dados.',
          redirect:
            'S3 e Lambda são serviços importantes. Para qual tipo de workload Lambda foi otimizado? Qual é o problema de usar ele para um servidor HTTP persistente?',
        },
      },
    },
  ],
};
