/**
 * Smoke test do servidor ICS Minecraft Lab.
 *
 * Sequência:
 *   T+0       conecta como TestBot
 *   T+3s      tenta mandar texto qualquer no chat (deve ser bloqueado)
 *   T+5s      tenta /help (deve ser bloqueado pela PinPlugin)
 *   T+7s      manda PIN errado (deve receber "PIN incorreto")
 *   T+9s      manda PIN certo (6769) → desbloqueia
 *   T+12s     anda pra frente 3s (gera PLAYER_POSITION packets)
 *   T+16s     roda /resumepackets pra ver o ranking
 *   T+19s     disconnect
 */

const mineflayer = require('mineflayer');

const log = (tag, msg) => {
  const t = ((Date.now() - START) / 1000).toFixed(1).padStart(5);
  console.log(`[T+${t}s] [${tag}] ${msg}`);
};

const START = Date.now();

const bot = mineflayer.createBot({
  host: '212.38.89.33',
  port: 25565,
  username: 'TestBot',
  version: '1.21.11', // mesmo protocolo do servidor
  auth: 'offline',
});

bot.on('login',   () => log('CONN', `logged in (gamemode=${bot.game?.gameMode})`));
bot.on('spawn',   () => log('CONN', `spawned at ${bot.entity.position.x.toFixed(1)},${bot.entity.position.y.toFixed(1)},${bot.entity.position.z.toFixed(1)} gm=${bot.game.gameMode}`));
bot.on('death',   () => log('!!',   `bot died`));
bot.on('error',   (e) => log('ERR',  e.message));
bot.on('kicked',  (r) => log('KICK', JSON.stringify(r)));
bot.on('end',     (r) => log('END',  `disconnected (${r ?? 'no reason'})`));

bot.on('message', (msg) => {
  const txt = msg.toString().replace(/\s+/g, ' ').trim();
  log('CHAT', txt);
});

bot.on('title',   (txt) => log('TITLE',  txt));
bot.on('subtitle',(txt) => log('SUBTITLE', txt));

bot.once('spawn', () => {
  setTimeout(() => {
    log('SEND', 'chat: "olá pessoal" (esperando: bloqueado)');
    bot.chat('olá pessoal');
  }, 3000);

  setTimeout(() => {
    log('SEND', 'cmd: /help (esperando: bloqueado pela PinPlugin)');
    bot.chat('/help');
  }, 5000);

  setTimeout(() => {
    log('SEND', 'chat: "12345" (esperando: PIN incorreto)');
    bot.chat('12345');
  }, 7000);

  setTimeout(() => {
    log('SEND', 'chat: "6769" (esperando: UNLOCK)');
    bot.chat('6769');
  }, 9000);

  setTimeout(() => {
    log('SEND', `gamemode atual: ${bot.game.gameMode} (esperando: survival/creative, não spectator)`);
    log('MOVE', 'andando pra frente por 3s — gera PLAYER_POSITION packets');
    bot.setControlState('forward', true);
  }, 12000);

  setTimeout(() => {
    bot.setControlState('forward', false);
    log('SEND', 'cmd: /resumepackets (esperando: ranking de packets)');
    bot.chat('/resumepackets');
  }, 16000);

  setTimeout(() => {
    log('END', 'bye');
    bot.quit();
    setTimeout(() => process.exit(0), 500);
  }, 19000);
});
