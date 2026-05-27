/**
 * Stress test — N bots conectam, mandam PIN, e ficam pulando + girando a cabeça.
 * Mostra TPS caindo + packets subindo.
 *
 * Uso: node stress.js [count] [stagger_ms]
 *   count: número de bots (default 100)
 *   stagger_ms: delay entre conexões (default 80ms)
 */

const mineflayer = require('mineflayer');

const COUNT      = parseInt(process.argv[2] || '100');
const STAGGER_MS = parseInt(process.argv[3] || '80');
const HOST       = '212.38.89.33';
const PORT       = 25565;
const VERSION    = '1.21.11';
const PIN        = '6769';

const START = Date.now();
const log = (tag, msg) => {
  const t = ((Date.now() - START) / 1000).toFixed(1).padStart(6);
  console.log(`[T+${t}s] [${tag}] ${msg}`);
};

const bots = [];
let connected = 0;
let unlocked = 0;
let errors = 0;
let kicked = 0;

log('INFO', `Spawning ${COUNT} bots, stagger ${STAGGER_MS}ms (ramp total ~${(COUNT * STAGGER_MS / 1000).toFixed(0)}s)`);

for (let i = 0; i < COUNT; i++) {
  setTimeout(() => spawn(i), i * STAGGER_MS);
}

function spawn(i) {
  const name = `Bot${i.toString().padStart(3, '0')}`;
  const bot = mineflayer.createBot({
    host: HOST, port: PORT, version: VERSION,
    username: name, auth: 'offline',
    keepAlive: true,
    checkTimeoutInterval: 30_000,
  });

  bot._chaos = null;
  bots.push(bot);

  bot.on('error', (e) => {
    if (e.code === 'ECONNRESET' || e.message?.includes('ECONNRESET')) return;
    errors++;
  });

  bot.on('kicked', (reason) => {
    kicked++;
    if (kicked <= 3) log('KICK', `${name}: ${typeof reason === 'string' ? reason : JSON.stringify(reason).slice(0, 80)}`);
  });

  bot.once('login', () => {
    connected++;
  });

  bot.once('spawn', () => {
    // manda PIN após 1.5s
    setTimeout(() => {
      if (bot.ended) return;
      try { bot.chat(PIN); } catch (e) {}
    }, 1500);

    // inicia chaos após 3s (1.5s pro PIN viajar + processar + restore).
    // PinPlugin detecta nick "Bot###" e teleporta pra dentro da bot pen
    // automaticamente (sem precisar /tp do client, que exige OP).
    setTimeout(() => {
      if (bot.ended) return;
      unlocked++;
      startChaos(bot);
    }, 3000);
  });

  bot.on('end', () => {
    connected = Math.max(0, connected - 1);
    if (bot._chaos) {
      clearInterval(bot._chaos.jumpTimer);
      clearInterval(bot._chaos.lookTimer);
    }
  });
}

function startChaos(bot) {
  // Pulo: a cada 600-900ms tap no jump
  const jumpTimer = setInterval(() => {
    if (bot.ended || !bot.entity) return;
    try {
      bot.setControlState('jump', true);
      setTimeout(() => {
        try { bot.setControlState('jump', false); } catch (e) {}
      }, 80);
    } catch (e) {}
  }, 600 + Math.random() * 300);

  // Olhar randomico: a cada 100ms muda yaw + pitch
  const lookTimer = setInterval(() => {
    if (bot.ended || !bot.entity) return;
    try {
      const yaw = (Math.random() - 0.5) * Math.PI * 2;
      const pitch = (Math.random() - 0.5) * Math.PI / 2;
      bot.look(yaw, pitch, false);
    } catch (e) {}
  }, 100 + Math.random() * 50);

  bot._chaos = { jumpTimer, lookTimer };
}

// Status report a cada 5s
const statusInterval = setInterval(() => {
  log('STAT', `connected=${connected}/${COUNT} · unlocked=${unlocked} · kicked=${kicked} · errors=${errors}`);
}, 5000);

// Shutdown gracioso
function shutdown(signal) {
  log('END', `${signal} — disconnecting all bots`);
  clearInterval(statusInterval);
  let count = 0;
  for (const b of bots) {
    if (!b.ended) {
      try { b.quit(); count++; } catch (e) {}
    }
  }
  log('END', `${count} quits sent · aguardando 3s`);
  setTimeout(() => {
    log('END', `done · final stats: connected=${connected}, unlocked=${unlocked}, kicked=${kicked}, errors=${errors}`);
    process.exit(0);
  }, 3000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Auto-shutdown depois de N segundos se passar `--duration <s>` via env
if (process.env.DURATION_S) {
  const dur = parseInt(process.env.DURATION_S);
  log('INFO', `Auto-shutdown em ${dur}s`);
  setTimeout(() => shutdown('TIMEOUT'), dur * 1000);
}
