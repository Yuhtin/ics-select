import type { Lesson } from '../lesson-types';

export const deployJourney: Lesson = {
  slug: 'deploy-journey',
  title: 'Do npm run dev ao Deploy',
  subtitle: 'Containers, Cloud & DevOps',
  blurb:
    'Uma jornada linear: o backend funciona localmente, um segundo dev entra, ele não sobe, e a gente resolve cada problema do jeito certo — Docker, secrets, cloud, load balancer, CI/CD, observabilidade.',
  durationMin: 120,
  audience: 'Hot Stuff 2026.2',
  nodes: [
    // ─── Foundation ───────────────────────────────────────────────────────────
    {
      id: 'process-port',
      label: 'Processo, porta e servidor',
      group: 'foundations',
      teachFromZero: true,
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
          note: 'O OS mantém sockets em TIME_WAIT por até 2 minutos após fechar uma conexão TCP (four-way handshake pendente). Reiniciar imediatamente pode levar a EADDRINUSE por alguns segundos.',
        },
      ],
      anchor: 'O que é uma porta? Por que o seu servidor escuta na 3000 e não na 80?',
      askWho: [
        {
          name: 'open',
          why: 'Pergunta de fundação — qualquer um pode tentar. Emergir quem tem intuição de rede antes de começar os beats.',
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
      oneLine:
        'Rodar npm run dev na sua máquina é o ponto zero — e já carrega premissas invisíveis que quebram no próximo computador.',
      pass1:
        'Quando você executa npm run dev, o Node.js lê o package.json, instala/verifica dependências, compila o código se necessário, e sobe um processo na porta configurada. Tudo funciona porque sua máquina tem a versão certa do runtime, o .env correto, e todos os serviços dependentes rodando. Mova esse comando para outro computador e cada uma dessas premissas pode falhar silenciosamente.',
      pass2:
        '**O que acontece internamente**: npm lê o campo `scripts.dev` do package.json e executa o comando. Frameworks como NestJS ou Next.js sobem um watcher que recompila arquivos ao salvar. O resultado é um processo Node.js com um PID escutando em :3000 (ou o que for configurado).\n\n**As cinco premissas invisíveis**: (1) Versão do runtime — Node 20 vs Node 18 têm comportamentos diferentes em alguns módulos. (2) node_modules — `npm install` resolveu o lock file na sua máquina; num clone fresco pode baixar versões diferentes se o lock não foi commitado. (3) Variáveis de ambiente — tudo que o app lê de `process.env` precisa estar definido. (4) Serviços externos — banco, Redis, APIs locais precisam estar rodando e acessíveis. (5) Módulos nativos — bibliotecas como `bcrypt` ou `sharp` são compiladas em C++ para a arquitetura do host; um node_modules de Mac ARM não funciona em Linux x86.\n\n**Por que isso importa agora**: enquanto você trabalha sozinho, essas premissas nunca aparecem — você as satisfaz sem perceber. Quando um segundo dev entra, cada uma vira um ponto de falha. A pergunta que vai levar à primeira solução real é: como você garante que esses cinco itens são idênticos em todas as máquinas?',
      pass3: [
        {
          gotcha: 'npm install sem --frozen-lockfile pode instalar versões diferentes',
          note: 'Se o package-lock.json ou pnpm-lock.yaml não está commitado, npm resolve as faixas do package.json na hora, podendo instalar minor/patch mais recentes que mudam comportamento. Use --frozen-lockfile (pnpm) ou --ci (npm) em ambientes compartilhados.',
        },
        {
          gotcha: 'NODE_ENV undefined vs development tem efeitos diferentes',
          note: 'Express, NestJS e muitas libs têm código condicional em NODE_ENV. Em `development`, stack traces aparecem em respostas de erro. Em `undefined`, o comportamento é imprevisível — algumas libs tratam como production, outras como development.',
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
      anchor:
        'O que acontece entre você apertar Enter em npm run dev e conseguir fazer uma requisição em localhost:3000?',
      askWho: [
        {
          name: 'open',
          why: 'Pergunta introdutória — todo mundo está no mesmo ponto. Roda voz para emergir quem já pensou nisso antes.',
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
      oneLine:
        'Diagnosticar por que um projeto funciona numa máquina e não em outra é o segundo exercício mais importante de qualquer dev de backend — o primeiro é ter prevenido o problema.',
      pass1:
        'Um novo dev clonou o repositório, rodou npm install, e o backend não sobe. O sistema de diagnóstico tem cinco camadas, e resolver pela camada errada desperdiça horas. O objetivo deste beat é construir esse checklist de dentro para fora: runtime → dependências → ambiente → serviços → plataforma.',
      pass2:
        '**Camada 1 — Runtime**: versão de Node.js diferente. `node --version` em cada máquina. Solução direta: `.nvmrc` ou `.node-version` na raiz do projeto; nvm (ou fnm) lê esse arquivo e usa a versão correta automaticamente.\n\n**Camada 2 — Dependências nativas**: módulos como `bcrypt`, `argon2`, `sharp`, `canvas` são compilados em C++ na hora do npm install. Um node_modules de Mac ARM não funciona em Linux x86. Solução: nunca commitar node_modules; sempre rodar npm install na máquina destino.\n\n**Camada 3 — Variáveis de ambiente**: o app lê `DB_URL`, `JWT_SECRET`, `PORT` de process.env. Se .env não existe no clone do colega, esses valores são `undefined` e o app pode falhar silenciosamente ou gerar comportamentos estranhos. Solução imediata: commitar um `.env.example` com as chaves (sem valores reais); o README instrui a copiar e preencher.\n\n**Camada 4 — Serviços externos**: o backend precisa de banco, Redis, filas. Se esses não estão rodando localmente, as conexões falham. O erro pode ser confundido com erro de código. Solução: docker-compose com os serviços de infraestrutura (beat 5).\n\n**Camada 5 — Plataforma**: permissões de arquivo, case sensitivity do filesystem (macOS é case-insensitive por padrão, Linux não), paths com espaços. Menos frequente mas difícil de diagnosticar.',
      pass3: [
        {
          gotcha: '.env.example commitado com valores de produção é um leak',
          note: 'O exemplo deve ter as chaves, não os valores. Escreva `DB_URL=` ou `DB_URL=postgres://user:pass@localhost/dev` — nunca credenciais reais. Um mistake comum é copiar o .env de prod para criar o .env.example.',
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
  Check -->|Não| L2["node_modules nativo?\\nrm -rf node_modules && npm i"]
  Check -->|Não| L3[".env existe?\\ncp .env.example .env"]
  Check -->|Não| L4["Banco rodando?\\ndocker compose up -d"]
  L1 & L2 & L3 & L4 --> Retry["Tenta de novo"]
  Retry --> Check`,
      anchor:
        'Seu colega clonou o mesmo repositório, rodou npm install, e o backend não sobe. Quais são as perguntas que você faz antes de qualquer outra coisa?',
      askWho: [
        {
          name: 'Eduardo',
          why: 'Estudou networking e security — pensa em camadas e ambientes. Provável que nomeie versão de runtime ou variáveis de ambiente.',
        },
        {
          name: 'Maria Clara',
          why: 'Networking coberto — vai considerar o lado de conexão com serviços externos.',
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
      oneLine:
        'Um container empacota o código junto com o runtime, as dependências e as configs de sistema — o ambiente deixa de ser implícito e passa a ser versionado junto com o código.',
      pass1:
        'Docker não é uma máquina virtual. É um processo do Linux com isolamento extra — namespace (visão isolada de rede, processos, filesystem) e cgroups (limites de CPU/memória). O container compartilha o kernel do host mas enxerga apenas os processos e arquivos que foram declarados na sua imagem. O resultado: o app roda da mesma forma em qualquer máquina que tenha Docker, independente de OS, versão de Node instalada, ou variáveis globais do sistema.',
      pass2:
        '**Container vs máquina virtual**: uma VM emula hardware inteiro (incluindo BIOS, kernel, disco virtual). É pesada — alguns GB de overhead. Um container compartilha o kernel do host e isola só o espaço de usuário. Um container Node.js padrão tem ~120MB; uma VM equivalente teria 2-4GB.\n\n**Namespace e cgroups**: o Linux oferece dois primitivos de isolamento. Namespace dá ao processo uma "visão" separada de rede (IP próprio), processos (não enxerga o PID 1 do host), e filesystem (raiz separada). Cgroups limita quantos recursos o processo pode consumir — CPU, RAM, disco.\n\n**Imagem vs container**: uma imagem é um snapshot imutável em camadas — é como um template de disco. Um container é uma instância dessa imagem em execução — é o processo vivo. Você pode rodar 10 containers a partir da mesma imagem, cada um isolado dos outros.\n\n**O que isso resolve das 5 camadas**: versão de Node (está na imagem), módulos nativos compilados (compilados durante o build, para a arquitetura correta), e divergência de plataforma. Serviços externos e variáveis de ambiente ainda precisam de tratamento separado — vamos cobrir isso nos próximos beats.',
      pass3: [
        {
          gotcha: 'Docker Desktop no Mac não usa o kernel do Mac',
          note: 'macOS não tem namespaces Linux nativos. Docker Desktop roda uma VM Linux leve (via HyperKit/VZ) e os containers vivem dentro dessa VM. Por isso o overhead em Mac é maior que em Linux, e alguns comportamentos de rede são diferentes (ex: host.docker.internal).',
        },
        {
          gotcha: 'Container parado não é container deletado',
          note: 'docker stop para o processo mas mantém o container com seu estado de filesystem. docker rm remove o container (mas não a imagem). docker rmi remove a imagem. É fácil acumular containers parados e encher o disco — use docker container prune periodicamente.',
        },
        {
          gotcha: 'Imagem sem versão pinada vai mudar de baixo dos seus pés',
          note: 'FROM node:20 e FROM node:20-alpine são diferentes. E FROM node:latest vai mudar quando Node 22 virar LTS. Sempre pin a versão minor: FROM node:20.18-alpine3.20. Isso garante reprodutibilidade do build.',
        },
      ],
      diagram: `flowchart TD
  DF["📄 Dockerfile\\n(receita)"] -->|docker build| IMG["📦 Image\\n(snapshot imutável em camadas)"]
  IMG -->|docker run| C1["🟢 Container A\\n(processo isolado)"]
  IMG -->|docker run| C2["🟢 Container B\\n(outro processo isolado)"]
  C1 -.->|compartilha| K["🐧 Kernel Linux\\n(do host)"]
  C2 -.->|compartilha| K`,
      anchor:
        'Qual é a diferença entre rodar um processo direto no OS e rodar esse mesmo processo dentro de um container?',
      askWho: [
        {
          name: 'Livia',
          why: 'Única no cohort com containers na bagagem. É O beat dela — pede pra ela explicar antes de você. Ver até onde o conhecimento dela vai.',
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
            'Exato. E se a imagem é imutável, onde o container escreve os dados que precisa persistir em runtime? Num banco, num volume — o que mais?',
        },
        close: {
          shape:
            'Fala que container é "como uma VM mais leve", sem distinguir o modelo de compartilhamento de kernel.',
          redirect:
            'Chegou na leveza — boa intuição. Mas por que um container é mais leve que uma VM? O que ele não precisa carregar que a VM precisa?',
        },
        wayOff: {
          shape:
            'Confunde container com namespace de usuário ou com processo normal sem isolamento.',
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
      oneLine:
        'Um Dockerfile é a receita declarativa para construir uma imagem — cada instrução vira uma camada imutável e cacheada no disco.',
      pass1:
        'O Dockerfile lista instruções em ordem: qual imagem base usar, quais arquivos copiar, quais comandos executar durante o build, e qual comando iniciar quando o container subir. O Docker executa cada instrução numa camada separada — e cacheia cada camada. Se só o código mudou mas as dependências não, o docker build pula as camadas de npm install e vai direto para o COPY do código. Esse cache é o que torna builds rápidos.',
      pass2:
        '**Instrução por instrução**:\n```\nFROM node:20-alpine          # imagem base (Node 20 no Alpine Linux ~50MB)\nWORKDIR /app                 # diretório de trabalho dentro do container\nCOPY package*.json ./        # copia só os manifests de deps\nRUN npm ci --omit=dev        # instala deps (camada cacheada)\nCOPY . .                     # copia o código (camada que muda a cada commit)\nRUN npm run build            # compila TypeScript → dist/\nEXPOSE 3000                  # documentação: essa porta vai ser usada\nCMD ["node", "dist/main.js"] # comando padrão ao iniciar o container\n```\n\n**Por que COPY package.json antes do COPY .?**: Docker invalida o cache de uma camada quando qualquer entrada dela muda. Se você copia tudo de uma vez (`COPY . .`) e depois faz `RUN npm install`, qualquer mudança de código invalida o npm install também — rebuild de minutos a cada commit. A separação garante que npm install só refaz quando package.json mudar.\n\n**Multi-stage build**: para apps que precisam compilar (TypeScript, Go, Rust), um multi-stage separa o ambiente de build do de runtime. Estágio builder tem todas as devDependencies e TypeScript; estágio runtime copia só dist/ e node_modules de produção. Resultado: imagem final sem ferramentas de compilação — tipicamente 50-70% menor.\n\n**.dockerignore**: análogo ao .gitignore, lista o que não copiar no COPY. Sempre incluir `node_modules`, `.git`, `.env`, `dist/`. Um node_modules local copiado para a imagem entra em conflito com o npm ci e pode incluir módulos nativos da máquina host.',
      pass3: [
        {
          gotcha: 'CMD vs ENTRYPOINT têm semântica diferente',
          note: 'CMD define o comando padrão — pode ser substituído com `docker run image outro-cmd`. ENTRYPOINT define o executável fixo — argumentos extras são anexados a ele. Para aplicações, CMD é suficiente. Para scripts de entrada (como um migration runner), combinar ENTRYPOINT + CMD é o padrão.',
        },
        {
          gotcha: 'EXPOSE não publica a porta — só documenta',
          note: 'EXPOSE é metadado. A porta só fica acessível fora do container se você usar `-p 3000:3000` no docker run (ou `ports:` no compose). É uma pegadinha clássica: o Dockerfile tem EXPOSE 3000 mas o container não é acessível porque faltou o -p.',
        },
        {
          gotcha: 'npm ci vs npm install dentro do Dockerfile',
          note: 'Dentro do container, sempre use npm ci — ele lê o lock file exato, é mais rápido, e falha se o lock file não está sincronizado com o package.json. npm install dentro do build pode instalar versões ligeiramente diferentes e quebrar a reprodutibilidade.',
        },
      ],
      diagram: `flowchart TD
  DF["📄 Dockerfile"]
  subgraph layers["Camadas (cached)"]
    L1["FROM node:20-alpine"]
    L2["COPY package*.json + RUN npm ci"]
    L3["COPY . . + RUN npm run build"]
  end
  DF --> L1 --> L2 --> L3
  L3 -->|docker build| IMG["📦 Image (~120MB)"]
  IMG -->|docker run -p 3000:3000| C["🟢 Container\\n(acessível em localhost:3000)"]`,
      anchor:
        'Se você mudar só uma linha de código TypeScript e rodar docker build de novo, quais camadas do Dockerfile precisam ser reexecutadas?',
      askWho: [
        {
          name: 'Livia',
          why: 'Containers estudados — pode ser chamada novamente para falar sobre o sistema de camadas.',
        },
        {
          name: 'Eduardo',
          why: 'Background técnico amplo — vai intuir sobre cache e invalidação.',
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
            'Acha que o docker build reexecuta o npm install sempre, independente de mudanças.',
          redirect:
            'Faz sentido pensar assim — npm install é demorado. Mas Docker tem um mecanismo pra evitar isso. O que ele poderia usar para saber que o package.json não mudou?',
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
      oneLine:
        'Docker Compose define múltiplos containers como um conjunto declarativo — um único arquivo orquestra API, banco e qualquer serviço de infraestrutura localmente.',
      pass1:
        'Sua API precisa de banco. Você poderia rodar dois docker run separados com flags e variáveis na mão, mas é frágil e difícil de reproduzir. O Docker Compose lê um arquivo YAML que declara todos os services, suas imagens, portas, variáveis de ambiente, volumes e dependências de inicialização. `docker compose up` sobe tudo de uma vez. `docker compose down` derruba tudo. Um novo dev só precisa desse arquivo.',
      pass2:
        '**Estrutura básica**:\n```yaml\nservices:\n  api:\n    build: .\n    ports: ["3000:3000"]\n    environment:\n      - DATABASE_URL=postgres://ics:dev@db:5432/ics_dev\n    depends_on: [db]\n  db:\n    image: postgres:16\n    environment:\n      - POSTGRES_USER=ics\n      - POSTGRES_PASSWORD=dev\n      - POSTGRES_DB=ics_dev\n    volumes:\n      - pgdata:/var/lib/postgresql/data\nvolumes:\n  pgdata:\n```\n\n**Rede interna**: o Compose cria uma rede bridge privada para os serviços. Dentro dessa rede, os containers se alcançam pelo nome do serviço — a API conecta no banco com host `db:5432`, não com `localhost:5432`. De fora da rede (do seu browser), só as portas mapeadas em `ports:` são acessíveis.\n\n**Volumes**: dados do banco precisam persistir entre restarts. `pgdata:` é um named volume gerenciado pelo Docker — fica no disco do host fora do container. Sem volume, toda vez que você derruba o banco, todos os dados somem.\n\n**depends_on não espera o banco estar pronto**: `depends_on: [db]` garante que o container do banco inicia antes da API, mas não espera o Postgres terminar de inicializar (o processo pode subir em 0.5s mas o Postgres aceita conexões só depois de 2s). A solução é um retry na conexão ou um wait-for-it script — ou confiar no sistema de reconnect do ORM.',
      pass3: [
        {
          gotcha: 'localhost dentro de um container não é o localhost do host',
          note: 'Dentro do container api, `localhost` aponta para o próprio container da API — não para o host nem para o container db. Use o nome do serviço (`db`) ou, para acessar o host a partir do container no Mac, use `host.docker.internal`.',
        },
        {
          gotcha: 'depends_on não garante que o serviço está pronto para aceitar conexões',
          note: 'O Postgres pode demorar 1-2s pós-container-start para aceitar conexões. depends_on só aguarda o container iniciar, não o processo interno estar pronto. Use um health check no serviço e `condition: service_healthy` no depends_on para garantia real.',
        },
        {
          gotcha: 'docker compose up --build não é o mesmo que docker compose build + up',
          note: '--build força rebuild das imagens declaradas com `build:`. Sem --build, o Compose usa imagens já buildadas localmente — código novo não entra. Em dev, sempre use --build ou configure `watch` no compose.',
        },
      ],
      diagram: `flowchart LR
  subgraph compose["docker-compose.yml (rede interna)"]
    direction LR
    API["🟢 api\\n:3000"] <-->|db:5432| DB["🐘 postgres\\n:5432\\n(volume pgdata)"]
  end
  Browser["🌐 Browser"] -->|localhost:3000| API
  Browser -.->|❌ sem acesso direto| DB`,
      anchor:
        'Se sua API e seu banco estão cada um em seu container, como a API sabe o endereço do banco? Ela usa localhost?',
      askWho: [
        {
          name: 'Eduardo',
          why: 'Networking estudado — vai intuir sobre resolução de nomes e redes Docker.',
        },
        {
          name: 'Livia',
          why: 'Containers cobertos — segunda vez que aparece, agora com mais contexto de rede.',
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
      teachFromZero: false,
      oneLine:
        'Mandar credenciais pelo WhatsApp não é só inconveniente — é um risco de segurança real com consequências difíceis de reverter.',
      pass1:
        'Você tem DB_URL, JWT_SECRET, chave de API do OpenAI. O colega precisa desses valores para rodar o projeto. O WhatsApp parece conveniente — mas cria três problemas que não desaparecem: (1) quem mais está no grupo viu a mensagem, (2) se alguém sair da empresa, as credenciais não são revogadas porque ninguém sabe quem tem o quê, e (3) se um dos celulares for comprometido, todas as credenciais daquele chat vazam juntas.',
      pass2:
        '**O problema do histórico do git**: se em algum momento alguém commitou o .env (por acidente ou preguiça), as credenciais estão no histórico — mesmo depois de remover o arquivo e fazer um novo commit. Git history é imutável por design. A única solução é reescrever o histórico (git filter-branch, BFG Repo-Cleaner) e fazer um force push, o que quebra o histórico de todos que já clonaram. E você ainda precisa trocar todas as credenciais expostas.\n\n**O problema de rotação**: quando uma credencial vaza ou um dev sai, você precisa trocar as senhas. Com .env via WhatsApp, você não sabe quantas cópias existem nem quem tem cada uma. Não tem como confirmar que todos trocaram.\n\n**O problema de produção vs desenvolvimento**: sua máquina local tem credenciais de dev. O servidor de produção tem credenciais reais. Misturar os dois por acidente (rodar código de prod apontando para banco de dev, ou pior, código de dev apontando para banco de prod) é uma das formas mais comuns de perda de dados.\n\n**O que precisamos**: um lugar centralizado onde as credenciais vivem, com controle de acesso (quem pode ler o quê), auditoria (quem leu quando), e rotação sem precisar avisar todo mundo no WhatsApp.',
      pass3: [
        {
          gotcha: 'Deletar o arquivo .env do git não remove do histórico',
          note: 'git rm .env && git commit faz o arquivo sumir do working tree, mas git log --all -p -- .env ainda mostra os valores. Para limpar de verdade, use BFG Repo-Cleaner ou git filter-repo — e ainda assim, todo clone existente precisa ser atualizado.',
        },
        {
          gotcha: '.env no .gitignore não protege se você fez git add -f uma vez',
          note: 'Uma vez que um arquivo rastreado pelo git é adicionado com -f (force), o .gitignore para de ignorar aquele arquivo. Checar se .env está rastreado: `git ls-files .env`. Se aparecer, está rastreado e vai para o próximo commit.',
        },
        {
          gotcha: 'Credenciais em variáveis de ambiente são visíveis para o processo filho',
          note: 'Variáveis de ambiente são herdadas por subprocessos. Um require() que spawna algo com child_process.exec() herda todo process.env. Em containers, env vars aparecem em `docker inspect`. Secrets verdadeiramente sensíveis (private keys, tokens) devem ser montados como arquivos via volume, não como env vars.',
        },
      ],
      diagram: `flowchart LR
  Dev1["💻 Dev 1"]
  Dev2["💻 Dev 2"]
  Dev1 -->|"WhatsApp:\\n.env com DB_PASS=abc123"| Dev2
  Dev1 -->|"git commit .env ❌"| Repo["📚 Git History\\n(permanente!)"]
  Repo -.->|"qualquer clone\\nvê as credenciais"| Any["👀 Qualquer pessoa\\ncom acesso ao repo"]`,
      anchor:
        'Quais são os riscos práticos de mandar um .env com credenciais de produção pelo WhatsApp para um colega?',
      askWho: [
        {
          name: 'Eduardo',
          why: 'Security estudada — vai nomear riscos como histórico, acesso não-controlado, rotação difícil.',
        },
        {
          name: 'Maria Clara',
          why: 'Security e networking — vai pensar em vetores de vazamento e superfície de ataque.',
        },
      ],
      followup:
        'O que você precisaria para resolver esses três problemas ao mesmo tempo: acesso controlado, auditoria, e rotação fácil?',
      gotcha:
        'Se a solução é não commitar .env, como o servidor de produção sabe as credenciais? Onde elas vivem se não em arquivo?',
      scenarios: {
        right: {
          shape:
            'Nomeia pelo menos dois dos três riscos (histórico git, falta de controle de acesso/rotação, propagação não-controlada) e conclui que precisa de um sistema centralizado.',
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
            'Acha que o problema é só "não committar o .env" e que mandar pelo WhatsApp é OK.',
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
      oneLine:
        'O Parameter Store é um cofre de configurações da AWS — credenciais ficam centralizadas, criptografadas, com controle de acesso via IAM e sem precisar de WhatsApp.',
      pass1:
        'O AWS Systems Manager Parameter Store é um serviço de armazenamento de configurações e secrets. Você guarda um parâmetro com um nome (ex: /prod/DB_URL) e o app busca em runtime via SDK. O acesso é controlado por IAM Role — o servidor de produção tem uma role que permite ler /prod/*, o computador do dev não tem. Quando um dev sai, você revoga a role dele. Quando uma senha troca, você atualiza no Parameter Store e o próximo deploy pega automaticamente.',
      pass2:
        '**Parameter Store vs Secrets Manager**: ambos armazenam strings seguras. O Secrets Manager adiciona rotação automática (ele mesmo troca a senha do banco em intervalos configurados) e tem custo por secret. O Parameter Store é gratuito para parâmetros padrão e suficiente para a maioria dos casos. Use Secrets Manager quando você precisar de rotação automática (tokens de longa duração, chaves de API com expiração).\n\n**Hierarquia de nomes**: `/prod/database/url`, `/dev/database/url`, `/prod/jwt/secret`. A hierarquia por path facilita dar permissão de leitura só para um ambiente (`/prod/*` para o servidor de produção, `/dev/*` para devs).\n\n**Acesso via IAM Role**: em vez de passar chave de acesso AWS como variável de ambiente (o que seria o mesmo problema do .env), o servidor EC2 ou container ECS assume uma IAM Role automaticamente. Essa role tem policy `ssm:GetParameter` para os paths necessários. O SDK detecta as credenciais da role automaticamente via instance metadata.\n\n**Uso no código**:\n```typescript\nconst ssm = new SSMClient({ region: "us-east-1" });\nconst param = await ssm.send(new GetParameterCommand({\n  Name: "/prod/database/url",\n  WithDecryption: true,\n}));\nconst dbUrl = param.Parameter!.Value;\n```\n\n**Desenvolvimento local**: seu computador não tem IAM Role de servidor. Para dev local, continue usando .env — mas nunca coloque credenciais de produção nele.',
      pass3: [
        {
          gotcha: 'IAM Role vs IAM User — não use User com access key em produção',
          note: 'IAM User gera access key + secret que você copia para env vars — voltamos ao problema inicial. IAM Role é temporária e rotacionada automaticamente pelo AWS STS. Em produção, sempre use Role (instance profile para EC2, task role para ECS).',
        },
        {
          gotcha: 'SecureString usa KMS e tem custo por decriptação',
          note: 'Parâmetros do tipo SecureString são criptografados com KMS. Cada GetParameter com WithDecryption:true consome uma operação KMS (~R$0.03 por 10.000 chamadas no KMS padrão). Para configs que mudam raramente, o padrão é cachear o valor na inicialização do app, não buscar a cada request.',
        },
        {
          gotcha: 'Parâmetro Standard tem limite de 4KB por valor',
          note: 'O tipo Standard (gratuito) suporta até 4KB por parâmetro. Certificados TLS, chaves privadas e configs grandes precisam de Advanced (~$0.05/param/mês). Se o valor é muito grande para um parâmetro, quebre em múltiplos ou use Secrets Manager.',
        },
      ],
      diagram: `flowchart LR
  Dev["💻 Dev\\n(local .env apenas)"]
  Dev -->|aws ssm put-parameter| SSM["🔐 AWS SSM\\nParameter Store\\n/prod/db/url\\n/prod/jwt/secret"]
  App["🟢 Container\\n(ECS Task)"] -->|SDK GetParameter| SSM
  IAM["🛡️ IAM Role\\n(Task Role)"] -->|permite leitura /prod/*| App
  SSM -.->|KMS decrypt| App`,
      anchor:
        'Por que usar um serviço de secrets centralizado em vez de passar variáveis de ambiente diretamente no servidor ou no docker run?',
      askWho: [
        {
          name: 'open',
          why: 'Primeiro contato do cohort com cloud. Pergunta aberta para emergir quem pensou em auditoria, rotação ou princípio do menor privilégio.',
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
            'Acha que ainda vão usar env vars normais, mas guardadas "em outro lugar" — não entendeu o modelo de acesso via SDK.',
          redirect:
            'Faz sentido querer guardar em algum lugar. Mas se você guardar numa env var num servidor, quem mais consegue ler aquela env var? O SSM tem um modelo diferente de acesso.',
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
      oneLine:
        'A diferença entre EC2 e ECS Fargate é a diferença entre alugar um servidor e alugar um serviço — o segundo te livra de gerenciar OS, patching e reinicialização de containers.',
      pass1:
        'Você tem um Dockerfile funcionando localmente. Para rodar em produção, você precisa de uma máquina na internet. A opção mais bruta é EC2 — uma VM Linux da AWS onde você instala Docker, faz docker pull, e roda docker run na mão. A opção gerenciada é ECS Fargate — você dá o Dockerfile (ou a imagem) e o Fargate aloca compute, roda o container, reinicia se ele morrer, e você não gerencia o OS. Para a maioria dos backends, Fargate é a escolha certa.',
      pass2:
        '**EC2 (Elastic Compute Cloud)**: você provisiona uma VM Linux, escolhe tipo de instância (CPU/RAM), e tem acesso root completo. Bom para workloads que precisam de configuração de OS específica, acesso a hardware especial (GPUs), ou para times que já têm expertise em Linux server admin. Desvantagens: você gerencia tudo — updates de segurança, restart de processo se o container morrer, Auto Scaling Group configurado manualmente.\n\n**ECS Fargate (Elastic Container Service)**: você define uma Task Definition (imagem Docker, CPU, memória, env vars, IAM role, portas) e o Fargate cria e gerencia a infraestrutura subjacente. Quando o container morre, o ECS reinicia automaticamente. Scaling é configurado via Service. Você nunca faz SSH em nada — o container é sua unidade de deploy.\n\n**ECR (Elastic Container Registry)**: onde suas imagens Docker ficam na AWS. O pipeline de CI faz docker build + docker push para o ECR. O ECS Task Definition referencia a imagem pelo URI do ECR. É o equivalente do Docker Hub mas privado e dentro da sua conta AWS.\n\n**Task Definition vs Service**: a Task Definition é o spec do container (imagem, CPU, memória, env, portas). O Service define quantas Tasks rodar simultaneamente e como fazer o deploy de novas versões (rolling update). Quando você faz deploy de uma nova imagem, o Service sobe tasks com a nova versão e derruba as antigas gradualmente.',
      pass3: [
        {
          gotcha: 'Task com 256 CPU units não é "256 vCPUs"',
          note: 'CPU no Fargate é medida em unidades (1024 units = 1 vCPU). Uma task com 256 CPU é 0.25 vCPU — suficiente para APIs simples em baixo tráfego, insuficiente para processamento CPU-intenso. Monitorar CPU Utilization no CloudWatch para confirmar o tamanho certo.',
        },
        {
          gotcha: 'ECS Fargate não tem disco persistente — o container é efêmero',
          note: 'O filesystem do container é descartado quando a task para. Qualquer dado que precisa persistir deve ir para S3, RDS, ElastiCache ou EFS — nunca para o filesystem local do container. Upload de arquivos direto para disco local em ECS vai sumir na próxima task.',
        },
        {
          gotcha: 'Pulling imagem ECR dentro de VPC precisa de endpoint ou NAT Gateway',
          note: 'Por padrão, o ECS em subnet privada não consegue fazer pull de imagens do ECR sem um de dois caminhos: (1) NAT Gateway na subnet pública ($0.045/h + $0.045/GB), ou (2) VPC Endpoints para ECR, S3 e CloudWatch Logs. Sem isso, o container fica preso em PENDING.',
        },
      ],
      diagram: `flowchart LR
  Dev["💻 git push"] --> CI["⚙️ CI/CD\\n(GitHub Actions)"]
  CI -->|docker build + push| ECR["📦 ECR\\n(registry privado)"]
  ECR -->|pull| Fargate["⚡ ECS Fargate\\nTask: api:3000\\n(AWS gerencia o OS)"]
  Fargate -->|executa| App["🟢 Container\\nem produção"]`,
      anchor:
        'Você tem um Dockerfile funcionando localmente. Quais são as suas opções para rodar isso em produção, e qual pergunta você faria pra escolher entre elas?',
      askWho: [
        {
          name: 'open',
          why: 'Primeiro contato do cohort com compute cloud. Emergir intuições antes de apresentar EC2 vs ECS — o que alguém proporia naturalmente?',
        },
      ],
      followup:
        'Você tem um container rodando em produção. Agora o produto faz sucesso e começa a receber muito mais tráfego. O que acontece?',
      gotcha:
        'Se você tem uma task ECS rodando e a CPU chega a 100%, o que acontece com as requisições que chegam depois? E com as que já estão sendo processadas?',
      scenarios: {
        right: {
          shape:
            'Distingue EC2 (você gerencia OS, instala Docker) de ECS/Fargate (AWS gerencia infra, você só dá o container), e menciona trade-off de controle vs conveniência.',
          redirect:
            'Perfeito. E qual é o componente que faz o tráfego da internet chegar até o seu container? O IP da task muda a cada deploy — alguém precisa resolver isso.',
        },
        close: {
          shape:
            'Sabe que vai "subir numa VM na AWS" mas não diferencia EC2 de ECS, trata como a mesma coisa.',
          redirect:
            'EC2 é uma VM — você está certo. Mas existe um modo onde a AWS gerencia a VM pra você e você só dá o container. O que você ganha e o que você perde com isso?',
        },
        wayOff: {
          shape:
            'Propõe usar Heroku, Railway, ou VPS genérico — não conhece AWS especificamente.',
          redirect:
            'Esses serviços fazem algo similar. O conceito é o mesmo: alguém gerencia o servidor por você. Na AWS, como isso se chama? E o que você configuraria no mínimo pra subir um container?',
        },
      },
    },

    // ─── Beat 9: Load Balancer ────────────────────────────────────────────────
    {
      id: 'load-balancer',
      label: 'Load Balancer',
      group: 'scale',
      beat: 9,
      teachFromZero: true,
      oneLine:
        'Um load balancer é o ponto único de entrada que distribui o tráfego entre múltiplas instâncias — e remove instâncias mortas sem o cliente perceber.',
      pass1:
        'Com um único container, você tem um único ponto de falha: se ele morrer, o serviço cai. E tem um teto de capacidade: uma instância só aguenta N requisições simultâneas. O Application Load Balancer da AWS senta na frente de várias tasks ECS, distribui as requisições em round-robin, verifica a saúde de cada task via health check, e para de mandar tráfego para tasks que não respondem. O cliente nunca sabe quantos servidores existem nem quando um morreu.',
      pass2:
        '**ALB vs NLB**: o Application Load Balancer opera na camada 7 (HTTP/HTTPS) — ele lê o path, os headers, pode rotear /api para um serviço e /web para outro. O Network Load Balancer opera na camada 4 (TCP/UDP) — mais rápido, melhor para conexões de longa duração (WebSocket, gRPC). Para APIs REST comuns, use ALB.\n\n**Health check**: o ALB chama `GET /health` em cada target a cada 30s (configurável). Se o target responder 200 OK, está saudável. Se falhar 3 vezes consecutivas (thresholds configuráveis), o ALB remove da rotação. Quando voltar a responder, é readicionado automaticamente. O endpoint `/health` deve ser barato — só verifica se o processo está vivo, sem abrir conexão com banco.\n\n**Target Group**: o ALB não fala diretamente com as tasks — ele fala com um Target Group que lista os targets (IPs:porta das tasks ECS). O ECS register/deregister targets automaticamente conforme tasks sobem e descem.\n\n**SSL Termination**: o ALB decripta HTTPS e passa HTTP puro para as tasks. Sua aplicação não precisa lidar com certificado TLS — isso fica no ALB. O certificado fica no ACM (AWS Certificate Manager) e o ACM pode renová-lo automaticamente.',
      pass3: [
        {
          gotcha: 'Round-robin distribui requisições, não conexões TCP',
          note: 'O ALB distribui cada requisição HTTP separada entre os targets, não conexões TCP. Com HTTP/2 ou keep-alive, múltiplas requisições vão pela mesma conexão TCP — o ALB ainda as distribui por requisição, não por conexão.',
        },
        {
          gotcha: 'Sessão com estado no servidor quebra com múltiplos targets',
          note: 'Se seu backend guarda sessão em memória (`req.session` em memória), um usuário autenticado na Task 1 perde a sessão na próxima requisição que vai para a Task 2. Solução: sticky sessions (ALB roteia o mesmo usuário para o mesmo target via cookie) ou, melhor, sessão stateless (JWT) ou centralizada (Redis/ElastiCache).',
        },
        {
          gotcha: 'ALB tem custo por hora + por LCU (Load Balancer Capacity Unit)',
          note: 'O ALB custa ~$0.025/hora (~R$15/mês) mais $0.008/LCU/hora. LCU é calculado por conexões novas, bandwidth, e regras. Para APIs pequenas, o custo fixo domina. Para alto tráfego, o custo por LCU domina. Sempre compare com o custo de uma instância EC2 com Nginx fazendo load balance manualmente.',
        },
      ],
      diagram: `flowchart LR
  Client["🌐 Cliente"] -->|HTTPS :443| ALB["⚖️ ALB\\n(Application Load Balancer)"]
  ALB -->|round-robin| T1["🟢 ECS Task 1\\n:3000"]
  ALB -->|round-robin| T2["🟢 ECS Task 2\\n:3000"]
  ALB -->|"GET /health → 200?"| T1
  ALB -->|"GET /health → 200?"| T2
  ALB -.->|remove se falhar 3x| Dead["💀 Task morta"]`,
      anchor:
        'Você tem dois servidores rodando o mesmo backend. O cliente manda uma requisição para o sistema. Como ele sabe qual dos dois chamar?',
      askWho: [
        {
          name: 'Messias',
          why: 'Networking estudado — vai intuir sobre roteamento e ponto único de entrada.',
        },
        {
          name: 'Eduardo',
          why: 'Networking + security — pode trazer perspectiva de ponto único de entrada e terminação SSL.',
        },
      ],
      followup:
        'Você tem o ALB distribuindo entre N tasks. Como o sistema decide quando adicionar ou remover tasks? Precisa ser manual?',
      gotcha:
        'Se o ALB distribui requisições em round-robin e seu backend tem sessão em memória (req.session), o que acontece com um usuário logado?',
      scenarios: {
        right: {
          shape:
            'Propõe um intermediário (load balancer, proxy, DNS) que o cliente chama e que distribui para os servidores internos.',
          redirect:
            'Exato — o load balancer é esse intermediário. E como ele sabe que um dos servidores morreu e deve parar de mandar tráfego pra ele?',
        },
        close: {
          shape:
            'Propõe DNS round-robin ou múltiplos IPs no DNS — sabe que precisa de distribuição mas não menciona health check.',
          redirect:
            'DNS round-robin funciona. Qual é o problema se um dos IPs parar de responder? O DNS sabe disso?',
        },
        wayOff: {
          shape:
            'Acha que o cliente deve fazer retry automaticamente no segundo servidor se o primeiro falhar.',
          redirect:
            'Retry no cliente é uma solução. Qual o custo de colocar essa lógica em todo cliente? E se forem 50 serviços diferentes consumindo a API?',
        },
      },
    },

    // ─── Beat 10: Auto Scaling ────────────────────────────────────────────────
    {
      id: 'auto-scaling',
      label: 'Auto Scaling',
      group: 'scale',
      beat: 10,
      teachFromZero: true,
      oneLine:
        'Auto Scaling monitora métricas e ajusta a frota automaticamente — você define a política uma vez e o sistema reage a tráfego real sem intervenção manual.',
      pass1:
        'Com o load balancer distribuindo entre tasks, você ainda precisa decidir quantas tasks rodar. Poucas → sobrecarga em pico. Muitas → custo desnecessário em vale. O ECS Application Auto Scaling monitora métricas no CloudWatch (CPU, memória, requisições por segundo) e ajusta o desired count do Service automaticamente dentro dos limites que você configura.',
      pass2:
        '**Política de scaling**: você define uma métrica alvo. Exemplo: "mantenha CPU média em 60%". Se a CPU média das tasks sobe acima de 60%, o Auto Scaling calcula quantas tasks a mais são necessárias para baixar a CPU para 60% e as cria. Se cai abaixo de 60%, tasks são terminadas (scale in) até o mínimo configurado.\n\n**Scale out vs scale in**: scale out é adicionar tasks — rápido (40-60s para uma nova task ECS Fargate subir). Scale in é remover tasks — tem um cooldown padrão de 5 minutos para evitar thrashing (escalar pra cima e pra baixo repetidamente). Você pode configurar scale out mais agressivo e scale in mais conservador.\n\n**Scheduled scaling**: se você sabe que todo dia às 9h o tráfego dobra (horário comercial, abertura de mercado), pode configurar uma regra que adiciona tasks preventivamente antes do pico, sem esperar a CPU subir.\n\n**Limites min/max**: sempre configure um mínimo de pelo menos 2 tasks (disponibilidade mínima — se uma task morrer enquanto está no mínimo, o serviço não fica com 0) e um máximo para controlar custos. O Auto Scaling nunca passa do max, mesmo sob carga extrema.',
      pass3: [
        {
          gotcha: 'Auto Scaling não resolve gargalo de banco de dados',
          note: 'Se o gargalo está no banco (queries lentas, pool esgotado), adicionar tasks só aumenta a carga no banco. Scaling horizontal funciona para camadas stateless. O banco, por ser stateful, escala diferente — read replicas, pool de conexão (PgBouncer), cache.',
        },
        {
          gotcha: 'Cooldown muito curto causa thrashing',
          note: 'Se o cooldown de scale in é muito curto (ex: 30s), o Auto Scaling pode terminar uma task, ver CPU subindo novamente, adicionar de volta, e assim em loop. O padrão de 300s (5 min) existe por uma razão — respeite-o para workloads variáveis.',
        },
        {
          gotcha: 'Desired count manual é sobrescrito pelo Auto Scaling',
          note: 'Se você tem Auto Scaling ativo e muda o desired count manualmente no console, o Auto Scaling vai sobrescrever sua mudança na próxima avaliação de métrica. Para mudanças permanentes, altere o min/max do scaling policy, não o desired count.',
        },
      ],
      diagram: `flowchart LR
  CW["📊 CloudWatch\\nCPU avg > 70%"] -->|alarm| AS["📈 Auto Scaling\\nPolicy"]
  AS -->|scale out: +2 tasks| ECS["⚡ ECS Service"]
  ECS --> T1["🟢 Task 1"]
  ECS --> T2["🟢 Task 2"]
  ECS --> T3["🟢 Task 3 (nova)"]
  ECS --> T4["🟢 Task 4 (nova)"]
  CW2["📊 CloudWatch\\nCPU avg < 30%"] -->|alarm| AS2["📉 Scale in"]
  AS2 -->|remove tasks| ECS`,
      anchor:
        'Seu produto faz sucesso de repente e o tráfego triplica. O que você quer que aconteça automaticamente no sistema, e como o sistema sabe que é hora de agir?',
      askWho: [
        {
          name: 'open',
          why: 'Conceito novo para o cohort. Pergunta aberta — emergir quem pensa em feedback loop e automação.',
        },
      ],
      followup:
        'Ótimo. Agora que você tem tasks escalando, todas elas precisam conectar no mesmo banco. O banco também precisa escalar?',
      gotcha:
        'Se o Auto Scaling adiciona tasks quando CPU > 70%, e cada nova task aumenta a carga no banco, o que acontece com o banco quando você dobra as tasks?',
      scenarios: {
        right: {
          shape:
            'Fala em monitorar métricas (CPU, tráfego) e adicionar instâncias/containers automaticamente com base nessas métricas.',
          redirect:
            'Exato — é um feedback loop. O que você faz quando o tráfego cai? Você quer manter as tasks extras rodando?',
        },
        close: {
          shape:
            'Propõe adicionar manualmente mais servidores quando perceber o aumento de carga — sabe que precisa de mais mas não menciona automação.',
          redirect:
            'Manual funciona se você está acordado e percebe o problema. O que acontece com o tráfego enquanto você configura a nova instância? Leva quanto tempo?',
        },
        wayOff: {
          shape:
            'Propõe usar uma máquina maior (vertical scaling) em vez de mais máquinas.',
          redirect:
            'Vertical scaling (máquina maior) é uma opção. Qual é o teto disso? E o que acontece com disponibilidade enquanto você faz resize da instância?',
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
      oneLine:
        'CI/CD elimina o deploy manual — um commit no main dispara um pipeline que testa, builda a imagem Docker, faz push para o ECR, e atualiza o serviço ECS automaticamente.',
      pass1:
        'Sem automação, o deploy é assim: você roda os testes manualmente, faz docker build, faz docker push para o ECR, vai no console da AWS, atualiza a Task Definition, force-deploya o Service. Qualquer passo esquecido ou errado vai para produção. CI/CD automatiza cada passo e adiciona um portão: o deploy só avança se os testes passarem.',
      pass2:
        '**CI (Continuous Integration)**: toda vez que alguém faz push, um runner (GitHub Actions, GitLab CI, CircleCI) clona o repo, instala deps, roda lint, typecheck, testes unitários, testes de integração. Se qualquer coisa falhar, o pipeline para e você é notificado. O objetivo: detectar regressões antes de chegar em produção.\n\n**CD (Continuous Delivery/Deployment)**: depois do CI passar, o pipeline faz o deploy. Delivery = pipeline coloca o artefato pronto para deploy mas um humano aprova a promoção para produção. Deployment = o pipeline faz o deploy automaticamente. A maioria dos times usa Delivery para produção (uma aprovação antes de ir) e Deployment para staging/preview.\n\n**O pipeline típico para ECS**:\n```yaml\n# .github/workflows/deploy.yml\njobs:\n  test:\n    steps: [checkout, npm ci, npm test]\n  build-push:\n    needs: test\n    steps:\n      - docker build -t $ECR_URI:$SHA .\n      - docker push $ECR_URI:$SHA\n  deploy:\n    needs: build-push\n    steps:\n      - aws ecs update-service \\\n          --cluster prod \\\n          --service api \\\n          --force-new-deployment\n```\n\n**Rolling deployment**: ao atualizar o ECS Service, o ECS sobe tasks com a nova imagem gradualmente, verifica o health check, e termina as tasks antigas. Em nenhum momento o serviço fica com zero tasks rodando. Se as novas tasks falharem no health check, o ECS para o rolling update e você não perde o serviço.',
      pass3: [
        {
          gotcha: 'Tag :latest não permite rollback confiável',
          note: 'Se você sempre faz push para ECR com tag :latest e o novo deploy quebra, você não sabe qual imagem é a "anterior" para reverter. Use o SHA do commit como tag da imagem ($GITHUB_SHA). Rollback é apenas trocar o Service para usar a task definition com a imagem de um commit anterior.',
        },
        {
          gotcha: 'Secrets do CI não devem ser hardcoded nos workflows',
          note: 'AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY e outras credenciais devem ficar em GitHub Secrets (Settings > Secrets > Actions), não no arquivo YAML do workflow. O YAML fica no repo — qualquer pessoa com acesso lê. O Secret fica criptografado e só disponível como env var durante a execução.',
        },
        {
          gotcha: 'force-new-deployment sem nova imagem não faz nada útil',
          note: 'Se você mudou a Task Definition mas não alterou a imagem, o ECS pode reutilizar a imagem em cache e nada muda. Sempre altere alguma coisa rastreável na Task Definition — a tag da imagem com o SHA do commit garante que cada deploy usa exatamente o código daquele commit.',
        },
      ],
      diagram: `flowchart LR
  Code["💻 git push\\nmain"] -->|trigger| GH["⚙️ GitHub Actions"]
  GH -->|"npm test\\n(CI gate)"| Tests{{"✅ Passed?"}}
  Tests -->|sim| Build["docker build\\n:sha-abc123"]
  Build -->|docker push| ECR["📦 ECR\\nregistry"]
  ECR -->|ecs update-service| ECS["⚡ ECS Service\\n(rolling deploy)"]
  Tests -->|não| Stop["🛑 Pipeline para\\nnotifica o dev"]`,
      anchor:
        'Você faz um commit. Quantas etapas manuais existem até esse código estar em produção hoje? Como você eliminaria cada etapa manual?',
      askWho: [
        {
          name: 'open',
          why: 'Ninguém do cohort estudou CI/CD. Pergunta introdutória que emerge o problema antes de apresentar a solução.',
        },
      ],
      followup:
        'Você tem CI/CD funcionando e as tasks escalando. Algo dá errado às 3h da manhã. Como você sabe o que aconteceu?',
      gotcha:
        'O pipeline passou em todos os testes mas a produção está quebrada. Como isso é possível?',
      scenarios: {
        right: {
          shape:
            'Lista as etapas manuais (testes, build, push, update service) e propõe um trigger automático no commit para fazer tudo em sequência.',
          redirect:
            'Perfeito. E o portão de qualidade — o que deve impedir o código de chegar em produção se algo estiver errado?',
        },
        close: {
          shape:
            'Fala em "automatizar o deploy" mas não menciona o portão de CI (testes passando antes do deploy).',
          redirect:
            'Automatizar o deploy é o CD. O que vem antes? O que garante que o código que vai ser deployado realmente funciona?',
        },
        wayOff: {
          shape:
            'Propõe usar deploy manual mas com checklist documentado — formaliza o processo mas não o automatiza.',
          redirect:
            'Checklist ajuda. Mas qual é o risco de uma etapa manual em um processo que acontece dezenas de vezes por semana?',
        },
      },
    },

    // ─── Beat 12: Arquitetura — fluxo completo ────────────────────────────────
    {
      id: 'full-architecture',
      label: 'Arquitetura — o fluxo completo',
      group: 'synthesis',
      beat: 12,
      oneLine:
        'Uma request traversa DNS, CDN, load balancer, compute, cache, banco primário, e replica — o fluxo de leitura e o de escrita são assimétricos por design.',
      pass1:
        'Cada componente que vimos existe para resolver um problema específico. Agora vamos colocar todos juntos e traçar o caminho de uma requisição do browser até o banco e de volta. Separar leitura de escrita é crítico porque elas têm perfis completamente diferentes: leitura é frequente e pode ser stale; escrita é menos frequente mas precisa ser durável e consistente.',
      pass2:
        '**Fluxo de leitura** (GET /api/plans):\n1. Browser resolve `api.example.com` via Route53 (DNS authoritative da AWS)\n2. CloudFront (CDN) verifica o cache — se hit, retorna sem tocar o backend\n3. Se miss, CloudFront encaminha para o ALB\n4. ALB roteia para uma das ECS Tasks disponíveis (health check OK)\n5. A Task busca o token SSM do banco (cacheado na inicialização)\n6. A Task tenta ElastiCache (Redis) — cache hit retorna em <1ms\n7. Cache miss: consulta o RDS Read Replica (leitura pode ser stale de até ~1s)\n8. Resultado sobe pela stack, CloudFront cacheia por 60s\n\n**Fluxo de escrita** (POST /api/plans):\n1-4. Mesmo path até a ECS Task\n5. Task valida o body, escreve no RDS Primary (escrita vai para o primário sempre)\n6. Invalida cache (ElastiCache DEL, CloudFront invalidation)\n7. RDS Primary replica para a Read Replica assincronamente\n\n**Por que a assimetria importa**: leituras podem ir para a replica e para o CDN porque toleram stale por alguns segundos. Escritas precisam ir para o primário porque precisam ser duráveis — a replica pode estar alguns milissegundos atrás. Tratar leituras como escritas (tudo no primário) desperdiça a capacidade das réplicas e sobrecarrega o primário.',
      pass3: [
        {
          gotcha: 'CDN cache + write → dados stale visíveis ao usuário',
          note: 'Se o CloudFront cacheia GET /api/plans por 5 minutos e um admin cria um novo plano, o usuário vai ver dados antigos por até 5 minutos. A solução é cache invalidation após writes — mas lembre: cache invalidation é um dos dois problemas difíceis da computação.',
        },
        {
          gotcha: 'Read replica lag pode ser visível ao usuário logo após write',
          note: 'Depois de um POST (escrita no primário), um GET imediato pode ir para a replica que ainda não recebeu a replicação (~100ms de lag). O usuário escreveu um item e imediatamente não o vê. Solução: para o usuário que acabou de escrever, roteie a leitura imediata para o primário (read-after-write consistency).',
        },
        {
          gotcha: 'Health check leve no /health pode esconder problemas reais',
          note: 'Se /health retorna 200 sem checar conexão com banco e cache, o ALB acha que a task está saudável mesmo quando o banco está inacessível. Um health check mais rico verifica as dependências críticas. Mas cuidado: um health check pesado que abre conexão com banco a cada 10s adiciona carga desnecessária.',
        },
      ],
      diagram: `flowchart TD
  Browser["🌐 Browser"] --> R53["🌐 Route53\\n(DNS)"]
  R53 --> CF["⚡ CloudFront\\n(CDN + SSL)"]
  CF -->|cache miss| ALB["⚖️ ALB\\n(Load Balancer)"]
  ALB --> T1["🟢 ECS Task 1"]
  ALB --> T2["🟢 ECS Task 2"]
  T1 -->|leitura| Cache["🔴 ElastiCache\\n(Redis)"]
  T1 -->|cache miss| RR["📖 RDS Read Replica"]
  T1 -->|escrita| Primary["📝 RDS Primary"]
  Primary -.->|replicação assíncrona| RR
  T1 -->|secrets| SSM["🔐 SSM\\nParameter Store"]
  T1 -->|logs + métricas| CW["📊 CloudWatch"]`,
      anchor:
        'Uma request GET chega no sistema. Desenha cada camada que ela atravessa — do DNS até o banco. Depois, faz o mesmo para um POST.',
      askWho: [
        {
          name: 'Livia',
          why: 'Containers + security — pode traçar da borda ao banco. Ela fez a jornada completa mais de perto.',
        },
        {
          name: 'Eduardo',
          why: 'Networking + databases — complementa com perspectiva de rede e armazenamento.',
        },
      ],
      followup:
        'Para cada caixa que você acabou de desenhar, qual AWS managed service você colocaria? E qual é a lógica que guia cada escolha?',
      gotcha:
        'O CloudFront cacheou uma resposta. O usuário faz um PUT e os dados mudam. O que acontece com o cache?',
      scenarios: {
        right: {
          shape:
            'Traça pelo menos 5 camadas para GET (DNS, CDN, LB, compute, cache/DB) e diferencia escrita indo para primário vs leitura indo para replica.',
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
      oneLine:
        'Cada caixa da arquitetura mapeia para um AWS managed service — a escolha é guiada pelo perfil de carga, não por familiaridade.',
      pass1:
        'AWS tem um serviço gerenciado para cada camada da arquitetura. "Gerenciado" significa que a AWS cuida de patching, alta disponibilidade, backups e scaling da infraestrutura — você configura, não opera. A lógica de escolha não é "qual serviço é mais popular" mas "qual perfil de workload esse serviço foi otimizado para".',
      pass2:
        '**DNS**: Route53 — DNS autoritative com health check integrado e roteamento por geolocalização/latência.\n\n**CDN**: CloudFront — rede de 400+ pontos de presença globais. Cache de objetos estáticos e respostas de API. Integração nativa com ACM para HTTPS.\n\n**Load Balancer**: ALB para HTTP/HTTPS (Layer 7, path-based routing, WebSocket, autenticação via Cognito). NLB para TCP/UDP de alta performance (Layer 4, conexões de longa duração, IP estático).\n\n**Compute**: ECS Fargate para containers stateless sem gerenciar EC2. EC2 + Auto Scaling Group para workloads que precisam de GPU, acesso a hardware específico, ou são muito CPU-intensivos. Lambda para funções event-driven de curta duração (<15 min) — não adequado para um server HTTP com warm connections.\n\n**Banco relacional**: RDS (PostgreSQL/MySQL/Aurora) — Multi-AZ por padrão em produção (failover automático em ~30s). Aurora PostgreSQL tem até 5x o throughput do RDS Postgres padrão e storage que cresce automaticamente.\n\n**Cache**: ElastiCache Redis — sub-milissegundo para cache de sessão, rate limiting, leaderboards, pub/sub. ElastiCache Memcached para cache puro de objetos sem estruturas complexas.\n\n**Secrets**: SSM Parameter Store (gratuito, sem rotação automática) ou Secrets Manager (rotação automática, $0.40/secret/mês).\n\n**Registry**: ECR — privado, integrado com IAM, escaneia vulnerabilidades de imagem, replicação cross-region.\n\n**Observabilidade**: CloudWatch Logs + Metrics (nativo AWS), ou DataDog/Grafana para quem precisa de correlação cross-serviço e alertas mais ricos.',
      pass3: [
        {
          gotcha: 'Lambda não é o padrão para backends HTTP',
          note: 'Lambda foi otimizado para funções curtas e event-driven. Para um servidor HTTP persistente com conexão de banco via pool, o cold start mata o pool, e a latência de inicialização (~200-500ms) aparece nas p99. ECS Fargate é a escolha certa para backends HTTP tradicionais.',
        },
        {
          gotcha: 'RDS Multi-AZ ≠ Read Replica',
          note: 'Multi-AZ cria um standby síncrono para failover (alta disponibilidade) — ele não aceita leituras. Read Replica é uma cópia assíncrona para distribuir carga de leitura — não faz failover automático. Produção precisa dos dois: Multi-AZ para HA, Read Replica para performance de leitura.',
        },
        {
          gotcha: 'ElastiCache sem cluster mode não é altamente disponível',
          note: 'Um cluster Redis com replication group mas sem cluster mode tem um único shard com um primary e réplicas. O primary é um único ponto de falha se não tiver Multi-AZ habilitado. Redis Cluster mode distribui os keys entre múltiplos shards — mais complexo mas escala horizontalmente.',
        },
      ],
      diagram: `flowchart TD
  Browser["🌐 Browser"] --> R53["Route53\\nDNS"]
  R53 --> CF["CloudFront\\nCDN"]
  CF --> ALB["ALB\\nLayer 7 LB"]
  ALB --> ECS["ECS Fargate\\nStateless compute"]
  ECS --> EC["ElastiCache Redis\\nCache sub-ms"]
  ECS --> RDS["RDS Aurora\\nPrimary (writes)"]
  RDS -.->|async repl| RDSr["RDS Aurora\\nRead Replica"]
  ECS --> SSM["SSM\\nSecrets"]
  ECS --> ECR["ECR\\nImage registry"]
  ECS --> CW["CloudWatch\\nLogs + Metrics + Alarms"]
  CW --> AS["Auto Scaling\\nScale in/out"]`,
      anchor:
        'Para cada caixa da arquitetura que desenhamos, qual AWS managed service você usaria? E qual é a lógica — não o nome — que guia cada escolha?',
      askWho: [
        {
          name: 'open',
          why: 'Síntese final — todos fizeram a jornada. Distribui voz: cada pessoa pode nomear uma camada.',
        },
      ],
      followup:
        'Essa arquitetura toda, do zero, custa quanto por mês na AWS? Qual componente é o mais caro?',
      gotcha:
        'Você precisa de baixa latência global para usuários no Brasil e no Japão ao mesmo tempo. O que você mudaria nessa arquitetura?',
      scenarios: {
        right: {
          shape:
            'Nomeia pelo menos 5 serviços corretamente e articula a lógica de pelo menos uma escolha (ex: "ECS Fargate porque não quero gerenciar EC2", "ElastiCache porque precisa de sub-ms").',
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
