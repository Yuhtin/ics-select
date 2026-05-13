export type GlossaryEntry = {
  term: string;
  aliases?: string[];
  definition: string;
};

export const GLOSSARY: GlossaryEntry[] = [
  // ─── Metrics & latency
  {
    term: 'DAU',
    definition:
      'Daily Active Users — usuários únicos que usaram o produto em um dia. Usado pra estimar QPS e dimensionar capacidade.',
  },
  {
    term: 'QPS',
    aliases: ['Queries Per Second'],
    definition:
      'Queries Per Second — número de requests ou operações que o sistema atende por segundo. Métrica central de capacity planning.',
  },
  {
    term: 'p99',
    aliases: ['p95', 'p50'],
    definition:
      'Percentil 99 de latência: tempo dentro do qual 99% das requests respondem. Mede latência da cauda, mais útil que média.',
  },
  {
    term: 'TTL',
    aliases: ['Time To Live'],
    definition:
      'Time To Live — tempo de vida de uma entrada em cache antes de expirar. Define quanto o dado pode ficar stale.',
  },
  {
    term: 'NTP',
    definition:
      'Network Time Protocol — protocolo que sincroniza relógios entre máquinas. Sem NTP, timestamps entre servers ficam fora de fase.',
  },
  {
    term: 'SLA',
    definition:
      'Service Level Agreement — promessa de qualidade do serviço (disponibilidade, latência) acordada com o cliente.',
  },

  // ─── Storage & databases
  {
    term: 'KV',
    aliases: ['KV store', 'Key-Value', 'Key-Value store'],
    definition:
      'Key-Value store — banco simples onde cada chave aponta pra um valor. Exemplos: DynamoDB, Cassandra, Redis. Ótimo pra point lookup.',
  },
  {
    term: 'point lookup',
    definition:
      'Busca por chave exata, sem range scan nem JOIN. É o padrão de acesso mais barato — O(1) em hash partition.',
  },
  {
    term: 'range scan',
    definition:
      'Leitura sequencial de uma faixa de chaves ordenadas. Eficiente em índices ordenados (B-tree, clustering keys em Cassandra).',
  },
  {
    term: 'MVCC',
    aliases: ['Multi-Version Concurrency Control'],
    definition:
      'Multi-Version Concurrency Control — técnica que Postgres e outros usam pra deixar leitura e escrita acontecerem em paralelo, mantendo versões de cada linha.',
  },
  {
    term: 'WAL',
    aliases: ['Write-Ahead Log'],
    definition:
      'Write-Ahead Log — log durável que registra mudanças antes de aplicar no estado. Base pra crash recovery e replicação em bancos relacionais.',
  },
  {
    term: 'GSI',
    aliases: ['Global Secondary Index'],
    definition:
      'Global Secondary Index — índice secundário em DynamoDB que permite query por outro atributo além da partition key. Tem custo separado de storage e throughput.',
  },
  {
    term: 'ACID',
    definition:
      'Atomicity, Consistency, Isolation, Durability — propriedades de transações em bancos relacionais. Garantem que operações são tudo-ou-nada e duráveis.',
  },

  // ─── Concrete products
  {
    term: 'Cassandra',
    definition:
      'Banco wide-column distribuído. Append-only, particionado por hash, ótimo pra write-heavy. Padrão pra timeline de mensagens, feeds, time-series.',
  },
  {
    term: 'DynamoDB',
    definition:
      'KV/document store da AWS, PaaS. Hash partition automática, escala horizontal sem gerenciar nós. Cobra por request + storage.',
  },
  {
    term: 'Redis',
    definition:
      'KV in-memory. Usado como cache, contador atômico, fila simples, pub-sub efêmero. Persistência opcional mas não é primary store por design.',
  },
  {
    term: 'Memcached',
    definition:
      'Cache in-memory distribuído. Mais simples que Redis (só KV de string), mas excelente performance bruta.',
  },
  {
    term: 'Kafka',
    definition:
      'Message queue distribuída, durável, particionada. Padrão pra event streaming, desacoplamento de microservices, pipelines de dados.',
  },
  {
    term: 'Zookeeper',
    definition:
      'Coordenador distribuído. Faz leader election, locks distribuídos, descoberta de serviço. Padrão pra coordenar shards e failover.',
  },
  {
    term: 'Raft',
    definition:
      'Algoritmo de consenso distribuído. Eleger líder e replicar estado entre N nós tolerando falhas. Base do etcd, Consul, CockroachDB.',
  },
  {
    term: 'Twemproxy',
    definition:
      'Proxy do Twitter pra Redis/Memcached. Distribui chaves entre múltiplos nós via consistent hashing, sem o cliente saber.',
  },

  // ─── Hashing & encoding
  {
    term: 'base62',
    definition:
      'Codificação que usa 62 caracteres (a-z, A-Z, 0-9). É URL-safe — não tem `+` ou `/` como base64, então não precisa de encoding extra dentro de uma URL.',
  },
  {
    term: 'base64',
    definition:
      'Codificação que usa 64 caracteres (a-z, A-Z, 0-9, +, /). Inclui símbolos que precisam ser escapados em URL, por isso encurtadores preferem base62.',
  },
  {
    term: 'UUID v4',
    definition:
      'Universally Unique Identifier versão 4 — gerado randomicamente, 128 bits. Único globalmente, mas não ordenável, então perde range scan eficiente.',
  },
  {
    term: 'UUID v7',
    definition:
      'UUID versão 7 — timestamp prefixado + random. Mantém unicidade do v4 mas é ordenável por tempo, permitindo range scan.',
  },
  {
    term: 'Snowflake',
    aliases: ['Snowflake ID'],
    definition:
      'ID 64-bit do Twitter: timestamp (41b) + machine ID (10b) + sequence (12b). Ordenável temporalmente, único sem coordenação central. Padrão pra message_id.',
  },
  {
    term: 'birthday paradox',
    definition:
      'Em um conjunto de N hashes possíveis, colisão fica provável bem antes de N — em torno de √N. Por isso truncar SHA256 pra 7 chars em base62 colide com ~1M URLs.',
  },
  {
    term: 'CAS',
    aliases: ['compare-and-swap'],
    definition:
      'Compare-And-Swap — primitiva atômica: "se o valor atual é X, troca pra Y". Resolve race condition sem lock. Base de UNIQUE constraint, SETNX e similares.',
  },
  {
    term: 'SETNX',
    definition:
      'Comando do Redis: "set if not exists". Operação atômica que escreve só se a chave não existir. Usado pra checar unicidade distribuída.',
  },

  // ─── Caching
  {
    term: 'LRU',
    aliases: ['Least Recently Used'],
    definition:
      'Least Recently Used — política de eviction que descarta o item acessado há mais tempo. Padrão em quase todo cache em produção.',
  },
  {
    term: 'LFU',
    aliases: ['Least Frequently Used'],
    definition:
      'Least Frequently Used — política de eviction que descarta o item com menor número de acessos totais. Útil quando o pareto é estável.',
  },
  {
    term: 'read-through',
    definition:
      'Padrão de cache: request checa cache primeiro, em miss vai no banco, grava no cache e retorna. O cliente vê só o cache.',
  },
  {
    term: 'write-around',
    definition:
      'Padrão de cache: writes vão direto pro banco, sem popular o cache. O cache se enche naturalmente nos reads subsequentes.',
  },
  {
    term: 'write-through',
    definition:
      'Padrão de cache: writes vão pro cache E pro banco ao mesmo tempo. Cache sempre consistente, mas polui RAM com keys que talvez nunca sejam lidas.',
  },
  {
    term: 'thundering herd',
    definition:
      'Quando uma entrada de cache expira durante alta carga, todas as requests pendentes batem no banco simultaneamente. Resolve com single-flight ou lock por key.',
  },
  {
    term: 'single-flight',
    aliases: ['request coalescing'],
    definition:
      'Técnica que consolida múltiplos pedidos simultâneos pra mesma chave numa única chamada ao banco. Os pedidos aguardam o resultado da primeira.',
  },
  {
    term: 'CDN',
    aliases: ['Content Delivery Network'],
    definition:
      'Content Delivery Network — rede de edge servers que cacheia conteúdo perto do usuário. Cloudflare, Akamai, Fastly. Reduz latência e absorve tráfego antes do origin.',
  },

  // ─── Sharding & replication
  {
    term: 'sharding',
    definition:
      'Dividir dados em múltiplas máquinas (shards) pra escalar storage e throughput. A sharding key determina onde cada item vive.',
  },
  {
    term: 'consistent hashing',
    definition:
      'Algoritmo de hash partition que minimiza realocação ao adicionar/remover shards. Só ~1/N das keys se movem quando N muda, vs quase tudo no hash mod N.',
  },
  {
    term: 'hash partition',
    definition:
      'Estratégia de sharding onde a sharding key é o hash de um atributo. Distribui uniformemente, ótimo pra point lookup, péssimo pra range query.',
  },
  {
    term: 'range partition',
    definition:
      'Estratégia de sharding onde cada shard cobre uma faixa de valores (a-f, g-l, ...). Bom pra range scan, ruim pra distribuição uniforme.',
  },
  {
    term: 'hot partition',
    aliases: ['hot shard'],
    definition:
      'Um shard que recebe muito mais tráfego que os outros (URL viral, canal Discord gigante). Detectar e dividir (split) ou replicar é mandatório em produção.',
  },
  {
    term: 'replication',
    definition:
      'Manter cópias dos dados em múltiplas máquinas. Pode ser master+réplicas (writes no master, reads nas réplicas) ou multi-master.',
  },
  {
    term: 'master',
    aliases: ['primary'],
    definition:
      'Nó que aceita writes em uma topologia replicada. Costuma ser único por shard pra evitar conflitos. Réplicas seguem o master via replication log.',
  },
  {
    term: 'locality',
    aliases: ['session affinity'],
    definition:
      'Propriedade que diz "todas as operações relacionadas vivem no mesmo lugar". Em chat, todas as conexões e mensagens da mesma conversa vão pro mesmo servidor.',
  },

  // ─── Consistency
  {
    term: 'eventual consistency',
    definition:
      'Modelo de consistência: depois de um write, leituras podem retornar valor antigo por um tempo, mas convergem. Aceitável quando staleness curta não importa.',
  },
  {
    term: 'strong consistency',
    definition:
      'Modelo de consistência: toda leitura depois de um write vê o valor novo. Mais caro de implementar em sistemas distribuídos (precisa de coordenação).',
  },
  {
    term: 'causal consistency',
    definition:
      'Modelo de consistência: se A causou B, todos os clientes veem A antes de B. Mais frouxo que strong, mas suficiente pra ordering de mensagens dentro de uma conversa.',
  },
  {
    term: 'read-after-write',
    definition:
      'Garantia que o cliente que escreveu lê o valor que ele acabou de escrever. Pode ser implementado lendo do master pra esse cliente dentro de uma janela curta.',
  },

  // ─── Networking & transport
  {
    term: 'WebSocket',
    aliases: ['WS'],
    definition:
      'Protocolo de conexão TCP bidirecional persistente sobre HTTP upgrade. Servidor pode empurrar mensagens pro cliente em tempo real. Padrão pra chat.',
  },
  {
    term: 'SSE',
    aliases: ['Server-Sent Events'],
    definition:
      'Server-Sent Events — stream HTTP só do servidor pro cliente. Mais simples que WebSocket, mas só unidirecional.',
  },
  {
    term: 'long polling',
    definition:
      'Cliente abre HTTP request, servidor segura por até N segundos esperando dado. Responde quando tem ou no timeout. Latência de ms, mas mantém ~1 conn por user.',
  },
  {
    term: 'sticky sessions',
    aliases: ['session stickiness'],
    definition:
      'Load balancer roteia requests do mesmo cliente sempre pro mesmo servidor. Necessário quando o servidor mantém estado in-memory por sessão (ex: WebSocket).',
  },
  {
    term: 'file descriptors',
    aliases: ['FD'],
    definition:
      'Recurso do SO que representa uma conexão TCP aberta (entre outras coisas). Limite por máquina é ulimit + memória. Define quantas conexões WebSocket cabem.',
  },
  {
    term: 'round-robin',
    definition:
      'Estratégia de load balancing que distribui requests sequencialmente entre os servidores disponíveis. Simples, sem estado, falha se o backend precisa de affinity.',
  },

  // ─── Messaging & pub-sub
  {
    term: 'PubSub',
    aliases: ['pub-sub', 'publish-subscribe'],
    definition:
      'Padrão de mensageria: publishers escrevem em tópicos, subscribers recebem. PubSub do Redis é efêmero (perde se sub não estava). Kafka é durável.',
  },
  {
    term: 'fan-out',
    definition:
      'Distribuir uma mensagem pra N destinatários. Pode ser write-time (push) ou read-time (pull/inbox). Custo depende linear ou logaritmicamente do N.',
  },
  {
    term: 'message queue',
    aliases: ['fila durável'],
    definition:
      'Sistema que persiste mensagens em ordem entre producer e consumer. Garante delivery mesmo se o consumer estiver offline. Kafka, RabbitMQ, AWS SQS.',
  },

  // ─── Mobile push & realtime
  {
    term: 'APNS',
    aliases: ['Apple Push Notification Service'],
    definition:
      'Serviço da Apple pra entregar push notifications em iOS. Único canal pra alcançar app fechado no iPhone.',
  },
  {
    term: 'FCM',
    aliases: ['Firebase Cloud Messaging'],
    definition:
      'Serviço do Google pra push notifications em Android (e iOS via APNS). Único canal pra alcançar app fechado no Android.',
  },
  {
    term: 'heartbeat',
    definition:
      'Mensagem periódica do cliente pro servidor pra manter conexão viva ou pra atualizar presence. Sem heartbeat o servidor não sabe quando o cliente caiu.',
  },

  // ─── Misc
  {
    term: 'idempotente',
    aliases: ['idempotency', 'idempotent', 'idempotência'],
    definition:
      'Operação que pode ser repetida sem mudar o resultado. Importante pra retry seguro — `message_id` idempotente evita duplicação quando o cliente recebe a mesma msg duas vezes.',
  },
  {
    term: 'append-only',
    definition:
      'Padrão de storage onde dados só são adicionados, nunca atualizados ou deletados no lugar. Bom pra log, time-series, mensagens. Simplifica replicação e cache.',
  },
];

const TERM_INDEX: { term: string; canonical: string; def: string }[] = (() => {
  const all: { term: string; canonical: string; def: string }[] = [];
  for (const entry of GLOSSARY) {
    all.push({ term: entry.term, canonical: entry.term, def: entry.definition });
    for (const alias of entry.aliases ?? []) {
      all.push({ term: alias, canonical: entry.term, def: entry.definition });
    }
  }
  return all.sort((a, b) => b.term.length - a.term.length);
})();

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const TERM_REGEX = new RegExp(
  `(?<![\\w])(${TERM_INDEX.map((t) => escapeRegex(t.term)).join('|')})(?![\\w])`,
  'gi',
);

export function findFirstGlossaryMatch(
  text: string,
  seen: Set<string>,
): { index: number; length: number; canonical: string; def: string } | null {
  TERM_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TERM_REGEX.exec(text)) !== null) {
    const matched = m[0];
    const entry = TERM_INDEX.find(
      (t) => t.term.toLowerCase() === matched.toLowerCase(),
    );
    if (!entry) continue;
    if (seen.has(entry.canonical)) continue;
    return {
      index: m.index,
      length: matched.length,
      canonical: entry.canonical,
      def: entry.def,
    };
  }
  return null;
}
