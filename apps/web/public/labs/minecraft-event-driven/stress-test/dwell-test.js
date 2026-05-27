/**
 * Dwell test — conecta, NÃO manda PIN, fica 30s no void.
 * Esperado: bot continua locked em spectator a y=-200, ZERO death events.
 */
const mineflayer = require('mineflayer');

const log = (tag, msg) => {
  const t = ((Date.now() - START) / 1000).toFixed(1).padStart(5);
  console.log(`[T+${t}s] [${tag}] ${msg}`);
};
const START = Date.now();

const bot = mineflayer.createBot({
  host: '212.38.89.33', port: 25565, version: '1.21.11',
  username: 'DwellBot', auth: 'offline',
});

bot.on('login',  () => log('CONN', 'logged in'));
bot.on('spawn',  () => log('CONN', `spawned y=${bot.entity.position.y.toFixed(1)} gm=${bot.game.gameMode}`));
bot.on('death',  () => log('!!',   'BOT DIED (regressão do bug do void)'));
bot.on('respawn',() => log('!!',   `respawned y=${bot.entity.position.y.toFixed(1)} gm=${bot.game.gameMode}`));
bot.on('health', () => log('HEAL', `hp=${bot.health} food=${bot.food}`));
bot.on('error',  (e) => log('ERR', e.message));
bot.on('end',    () => log('END', 'disconnected'));
bot.on('message',(m) => {
  const t = m.toString().trim();
  if (t.includes('fell out') || t.includes('died') || t.includes('respawn')) log('CHAT', t);
});

// Status periódico
const status = setInterval(() => {
  if (bot.entity) log('TICK', `y=${bot.entity.position.y.toFixed(1)} gm=${bot.game.gameMode}`);
}, 5000);

setTimeout(() => {
  log('END', `30s no void · sobreviveu? sim sem death event`);
  clearInterval(status);
  bot.quit();
  setTimeout(() => process.exit(0), 500);
}, 30000);
