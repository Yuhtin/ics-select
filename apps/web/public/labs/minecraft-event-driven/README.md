# Lab · Minecraft Event-Driven

Lab ao vivo da aula `minecraft-event-driven`. 3 plugins Paper independentes, cada um com 1 listener no `PlayerJoinEvent`. Quando um voluntário entra no servidor, os 3 disparam em sequência. Você arranca um deles ao vivo pra mostrar isolamento e fan-out.

---

## Setup (faça **antes** da aula)

### 1. Baixar Paper

```bash
curl -o paper.jar https://api.papermc.io/v2/projects/paper/versions/1.21.4/builds/latest
```

(ou pega o build mais recente em https://papermc.io/downloads/paper)

### 2. Subir o servidor uma vez pra gerar configs

```bash
mkdir minecraft-lab && cd minecraft-lab
mv ../paper.jar .
echo "eula=true" > eula.txt
java -Xmx2G -jar paper.jar nogui
```

Depois de subir e gerar o mundo, dê `stop` no console.

### 3. Configurar `server.properties`

Edite as linhas relevantes:

```
online-mode=false          # permite conectar com nick qualquer, sem login Mojang
spawn-protection=0
gamemode=creative
difficulty=peaceful
```

### 4. Os plugins (já compilados)

Os 4 `.jar` prontos estão em `plugins/` neste diretório, já buildados via Maven. Drop-in direto na pasta `plugins/` do Paper.

```
apps/web/public/labs/minecraft-event-driven/
├── pom.xml                                  # parent multi-module
├── welcome-plugin/    src/main/...          # fonte
├── scoreboard-plugin/ src/main/...
├── analytics-plugin/  src/main/...
├── bad-plugin/        src/main/...
└── plugins/                                 # ← OS JARS PRONTOS
    ├── WelcomePlugin.jar
    ├── ScoreboardPlugin.jar
    ├── AnalyticsPlugin.jar
    └── BadPlugin.jar                        # didático · use só pra demo do Beat 5
```

**Pra rebuildar do zero** (caso edite os fontes):

```bash
cd apps/web/public/labs/minecraft-event-driven
mvn clean package
cp welcome-plugin/target/WelcomePlugin.jar plugins/
cp scoreboard-plugin/target/ScoreboardPlugin.jar plugins/
cp analytics-plugin/target/AnalyticsPlugin.jar plugins/
cp bad-plugin/target/BadPlugin.jar plugins/
```

Pré-requisitos: Java 21 + Maven 3.9+. Build de zero leva ~30s, daí baixa paper-api (~5MB) na primeira vez.

### 5. Drop os jars na pasta `plugins/` do Paper

```
minecraft-lab/
├── paper.jar
├── plugins/                                 # crie aqui
│   ├── WelcomePlugin.jar
│   ├── ScoreboardPlugin.jar
│   └── AnalyticsPlugin.jar
├── world/
└── server.properties
```

(`BadPlugin.jar` fica fora · só copie quando for fazer a demo do Beat 5.)

### 6. (Opcional) Instalar PlugMan pra hot-reload de plugin

PlugMan permite carregar/descarregar plugin sem reiniciar o servidor. Útil pro momento de "arrancar o plugin ao vivo".

```bash
curl -L -o plugins/PlugMan.jar https://www.spigotmc.org/resources/plugmanx.27772/download
```

Sem PlugMan, você pode usar `/reload confirm` mas é menos limpo.

### 7. Suba o servidor

```bash
java -Xmx2G -jar paper.jar nogui
```

Console deve mostrar:
```
[INFO]: [WelcomePlugin] Welcome plugin enabled
[INFO]: [ScoreboardPlugin] Scoreboard plugin enabled
[INFO]: [AnalyticsPlugin] Analytics plugin enabled
```

### 9. Teste antes da aula

Entra no Minecraft com seu nick (modo offline funciona porque `online-mode=false`), endereço `localhost`. Console deve cuspir 3 mensagens em sequência:

```
[INFO]: [Welcome] davi entrou. Mandando saudação.
[INFO]: [Scoreboard] davi entrou. Adicionando ao scoreboard.
[INFO]: [Analytics] davi entrou em 2026-05-27T18:33:21. event_id=...
```

Player vê apenas a mensagem de saudação no chat e o scoreboard aparecendo no canto.

---

## Durante a aula

### Beat 4 (Fan-out) — passo a passo do lab

1. **Servidor já rodando** com os 3 plugins. Console projetado.
2. **Voluntário entra** com seu Minecraft. Vê welcome + scoreboard.
3. **Aponta o console** — as 3 linhas em sequência. Comenta: "3 listeners diferentes, mesmo evento, nenhum conhece o outro."
4. **Drop o Welcome** ao vivo:
   ```
   /plugman unload WelcomePlugin
   ```
   (ou `rm plugins/WelcomePlugin.jar` + `/reload confirm`)
5. **Voluntário sai e entra de novo.** Agora só 2 linhas no console: Scoreboard e Analytics. Welcome sumiu.
6. **Volta o Welcome:**
   ```
   /plugman load WelcomePlugin
   ```
7. **Comenta a virada:** "vocês acabaram de ver desacoplamento. Os outros 2 plugins continuaram funcionando, nem souberam que o Welcome saiu."

### Beat 5 (Pegadinhas) — opcional, com plugin "ruim"

Se quiser mostrar a pegadinha de bloquear o main thread, eu deixei um `BadPlugin.java` no diretório com `Thread.sleep(2000)` dentro do listener. Carregue ele, voluntário entra, e `/tps` despenca pra 0 por 2 segundos. Visceral.

---

## Backup plan (se algo dá errado)

- **Servidor não sobe?** Verifica que `eula.txt` tem `eula=true` e Java está em versão 17+.
- **Plugin não carrega?** O console vai dizer o erro. Provavelmente é `main:` incorreto no `plugin.yml` ou versão de Java incompatível.
- **PlugMan não funciona?** Para o servidor com `stop`, remove o jar, sobe de novo. Menos elegante, mas funciona.
- **Voluntário não consegue conectar?** Confirma `online-mode=false` e que o IP que ele tá usando é `localhost` (não o IP do roteador).

---

## Roteiro de fala (caso esqueça da sequência)

> "Olha, aqui não tem mágica. São 3 plugins diferentes, cada um com 1 classe Java. Cada classe tem 1 método anotado com `@EventHandler`. Quando o servidor dispara o `PlayerJoinEvent`, ele itera a lista de listeners inscritos e chama um por um. Cada plugin tem seu próprio jar, foi escrito por alguém diferente, e nenhum deles sabe da existência dos outros. É essa propriedade — desacoplamento por evento — que torna o ecossistema Bukkit possível: 50 mil plugins de devs independentes funcionam juntos sem combinarem nada entre si. Esse é o paradigma."
