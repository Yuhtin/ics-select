// Gera o roteiro em HTML a partir da licao (.ts) + da camada de ensino.
//
//   node apps/web/scripts/roteiro/build-roteiro.mjs
//
// A licao continua sendo a fonte da verdade do CONTEUDO da aula: nada aqui
// reescreve texto de beat. A camada de ensino (teach-*.mjs) so acrescenta o
// andar de baixo, pra quem vai apresentar conseguir aprender antes.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLOSSARY, SKIP_LINKING } from './teach-glossary.mjs';
import { COMO_USAR, PLANO_ESTUDO, FRASES_SEGURANCA, FUNDAMENTOS } from './teach-fundamentos.mjs';
import { TEACH } from './teach-beats.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '../..');
const LESSON_TS = path.join(WEB, 'components/admin/meetings/lessons/noisy-neighbor-ebpf.ts');
const OUT = path.join(WEB, 'public/roteiros/noisy-neighbor-ebpf.html');

// ---------------------------------------------------------------- carregar
function loadLesson() {
  let src = fs.readFileSync(LESSON_TS, 'utf8');
  src = src.replace(/^import type[^\n]*\n/m, '');
  src = src.replace(/^export const noisyNeighborEbpf: Lesson = /m, 'return ');
  // eslint-disable-next-line no-new-func
  return new Function(src)();
}

const lesson = loadLesson();

// ------------------------------------------------------------------ helpers
const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

const paras = (arrOrStr) => {
  const list = Array.isArray(arrOrStr) ? arrOrStr : String(arrOrStr || '').split('\n\n');
  return list.map((p) => `<p>${md(p)}</p>`).join('\n');
};

// ------------------------------------------------------------------ secoes
const SECTION_META = {
  tenancy: ['01', 'A máquina compartilhada'],
  metric: ['02', 'A métrica certa'],
  probe: ['03', 'Medir sem estragar'],
  attrib: ['04', 'De quem é a culpa'],
  pipeline_cloud: ['05', 'Do kernel ao alerta'],
};
const sectionKey = (n) => (n.group === 'pipeline' || n.group === 'cloud' ? 'pipeline_cloud' : n.group);

const nodes = lesson.nodes;
const foundations = nodes.filter((n) => n.group === 'foundations');
const beats = nodes.filter((n) => typeof n.beat === 'number');
const synthesis = nodes.filter((n) => n.group === 'synthesis');

const seasons = [];
for (const n of beats) {
  const k = sectionKey(n);
  if (!seasons.includes(k)) seasons.push(k);
}

// --------------------------------------------------------------- blocos
function blocoDoZero(teach) {
  if (!teach?.doZero) return '';
  return `
      <div class="block learn-only b-dozero">
        <div class="block-label">Do zero <span class="block-hint">comece por aqui</span></div>
        ${paras(teach.doZero)}
      </div>`;
}

function blocoErro(teach) {
  if (!teach?.erro) return '';
  return `
      <div class="block learn-only b-erro">
        <div class="block-label">O erro que você não pode cometer</div>
        <p>${md(teach.erro)}</p>
      </div>`;
}

// aparece em AMBOS os modos (aprender e apresentar): avisa o apresentador
// que o SLIDE tem mais passos, ou uma ordem diferente, do que o texto deste
// beat sugere sozinho, o deck reordenou o Ato 1 pra ensinar fundamentos
// antes de responder a pergunta de abertura, em vez de responder direto.
function blocoFluxoAoVivo(teach) {
  if (!teach?.fluxoAoVivo) return '';
  const f = teach.fluxoAoVivo;
  const passos = (f.passos || [])
    .map((p, i) => `<li><span class="fluxo-n">${i + 1}</span>${md(p)}</li>`)
    .join('');
  return `
      <div class="block b-fluxo">
        <div class="block-label">Sequência ao vivo <span class="block-hint">${md(f.titulo)}</span></div>
        <ol class="fluxo-list">${passos}</ol>
        ${f.onde ? `<div class="reforco-meta"><span class="reforco-k">onde estudar isso</span>${md(f.onde)}</div>` : ''}
      </div>`;
}

function blocoFaq(teach, id) {
  if (!teach?.faq?.length) return '';
  const items = teach.faq
    .map(
      (f, i) => `
        <details class="faq-item" name="faq-${id}">
          <summary class="faq-q">${md(f.q)}</summary>
          <div class="faq-a">${md(f.a)}</div>
        </details>`,
    )
    .join('');
  return `
      <div class="block learn-only b-faq">
        <div class="block-label">Se perguntarem <span class="block-hint">${teach.faq.length} perguntas prováveis, com resposta</span></div>
        <div class="faq-list">${items}</div>
      </div>`;
}

function blocoTeste(teach, id) {
  if (!teach?.testeSe?.length) return '';
  const items = teach.testeSe
    .map(
      (t, i) => `
        <div class="teste-item">
          <div class="teste-q"><span class="teste-n">${i + 1}</span>${md(t.q)}</div>
          <button class="teste-btn" type="button" data-teste="${id}-${i}">Ver resposta</button>
          <div class="teste-a" id="teste-${id}-${i}" hidden>${md(t.a)}</div>
        </div>`,
    )
    .join('');
  return `
      <div class="block learn-only b-teste">
        <div class="block-label">Teste-se <span class="block-hint">responda em voz alta antes de abrir</span></div>
        <div class="teste-list">${items}</div>
      </div>`;
}

function blocoPegadinhas(pass3) {
  if (!pass3?.length) return '';
  const rows = pass3
    .map(
      (p) => `
        <div class="gotcha-row">
          <div class="gotcha-head">${md(p.gotcha)}</div>
          <div class="gotcha-note">${md(p.note)}</div>
        </div>`,
    )
    .join('');
  return `
      <div class="block">
        <div class="block-label">Pegadinhas</div>
        <div class="gotcha-list">${rows}</div>
      </div>`;
}

function blocoAskWho(askWho) {
  if (!askWho?.length) return '';
  const rows = askWho
    .map((a, i) => {
      const open = a.name === 'open';
      return `
        <div class="ask-row">
          <div class="ask-rank ${open ? 'ask-open' : ''}">${open ? 'ABERTA' : `#${i + 1}`}</div>
          <div>
            <div class="ask-name">${esc(open ? 'Pergunta aberta ao grupo' : a.name)}</div>
            <div class="ask-why">${md(a.why)}</div>
          </div>
        </div>`;
    })
    .join('');
  return `
      <div class="block">
        <div class="block-label">Quem chamar</div>
        <div class="ask-list">${rows}</div>
      </div>`;
}

function blocoCenarios(sc) {
  if (!sc) return '';
  const order = [
    ['right', 'Acertou', 'sc-right'],
    ['close', 'Tá quase', 'sc-close'],
    ['wayOff', 'Passou longe', 'sc-wayoff'],
  ];
  const cards = order
    .filter(([k]) => sc[k])
    .map(
      ([k, label, cls]) => `
        <div class="sc-card ${cls}">
          <div class="sc-label">${label}</div>
          <div class="sc-field"><span class="sc-field-k">forma</span>${md(sc[k].shape)}</div>
          <div class="sc-field"><span class="sc-field-k">redireciona</span>${md(sc[k].redirect)}</div>
        </div>`,
    )
    .join('');
  return `
      <div class="block">
        <div class="block-label">Cenários de resposta</div>
        <div class="sc-grid">${cards}</div>
      </div>`;
}

function blocoVisuals(visuals) {
  if (!visuals?.length) return '';
  const out = visuals
    .map((v) => {
      if (v.kind === 'ascii') {
        return `
        <div class="ascii-card">
          <div class="ascii-title">${esc(v.title)}</div>
          <pre class="ascii-art">${esc(v.art)}</pre>
          ${v.caption ? `<div class="ascii-caption">${md(v.caption)}</div>` : ''}
          ${v.board ? `<div class="ascii-board"><span class="ascii-board-k">no quadro</span>${md(v.board)}</div>` : ''}
        </div>`;
      }
      return `
        <div class="ascii-card">
          <div class="ascii-title">${esc(v.title)}</div>
          <img class="visual-img" src="${esc(v.src)}" alt="${esc(v.alt)}" loading="lazy" />
          ${v.caption ? `<div class="ascii-caption">${md(v.caption)}</div>` : ''}
          <div class="ascii-caption ascii-credit">Crédito: ${esc(v.credit)}</div>
        </div>`;
    })
    .join('');
  return `
      <div class="block">
        <div class="block-label">Visual pro quadro</div>
        ${out}
      </div>`;
}

// ------------------------------------------------------------------- node
function renderNode(n, kind) {
  const teach = TEACH[n.id];
  let eyebrow;
  if (kind === 'foundation') eyebrow = 'Antes de começar &middot; conceito base';
  else if (kind === 'synthesis') eyebrow = 'Síntese final';
  else {
    const [num, label] = SECTION_META[sectionKey(n)];
    eyebrow = `Temporada ${num} &middot; Episódio ${String(n.beat).padStart(2, '0')} &middot; ${esc(label)}`;
  }

  const tags = n.tags?.length
    ? `<div class="tag-row">${n.tags.map((t) => `<span class="tag-chip">${esc(t)}</span>`).join('')}</div>`
    : '';

  return `
    <section id="${n.id}" class="node-section" data-node="${n.id}">
      <div class="node-head">
        <div class="node-head-main">
          <div class="node-eyebrow">${eyebrow}${n.teachFromZero ? '<span class="badge-teach">ensinar do zero</span>' : ''}</div>
          <h2 class="node-title">${esc(n.label)}</h2>
        </div>
        <label class="done-check" title="Marcar como estudado">
          <input type="checkbox" data-done="${n.id}" />
          <span>estudei</span>
        </label>
      </div>
      <p class="node-oneline">${md(n.oneLine)}</p>
      ${tags}

      ${blocoDoZero(teach)}
      ${blocoFluxoAoVivo(teach)}

      <div class="block learn-only">
        <div class="block-label">Overview</div>
        ${paras(n.pass1)}
      </div>

      <div class="block learn-only">
        <div class="block-label">Deep dive</div>
        ${paras(n.pass2)}
      </div>

      ${blocoVisuals(n.visuals)}
      ${blocoErro(teach)}
      ${blocoPegadinhas(n.pass3)}
      ${blocoFaq(teach, n.id)}

      <div class="block block-anchor">
        <div class="block-label">Pergunta&#8209;âncora</div>
        <p class="anchor-text">&ldquo;${md(n.anchor)}&rdquo;</p>
      </div>

      ${blocoAskWho(n.askWho)}
      ${blocoCenarios(n.scenarios)}

      <div class="block-pair">
        <div class="block block-half">
          <div class="block-label">Se travar</div>
          <p>${md(n.gotcha)}</p>
        </div>
        <div class="block block-half block-followup">
          <div class="block-label">Próxima pergunta</div>
          <p>${md(n.followup)}</p>
        </div>
      </div>

      ${blocoTeste(teach, n.id)}
    </section>`;
}

// -------------------------------------------------------------- fundamentos
const fundamentosHtml = FUNDAMENTOS.map(
  (f) => `
    <section id="${f.id}" class="node-section fundamento learn-only" data-node="${f.id}">
      <div class="node-head">
        <div class="node-head-main">
          <div class="node-eyebrow">Capítulo 00 &middot; fundamentos</div>
          <h2 class="node-title"><span class="fund-num">${f.n}</span>${esc(f.title)}</h2>
        </div>
        <label class="done-check" title="Marcar como estudado">
          <input type="checkbox" data-done="${f.id}" />
          <span>estudei</span>
        </label>
      </div>
      <div class="block">${paras(f.body)}</div>
    </section>`,
).join('');

// ---------------------------------------------------------------- sidebar
const navItems = [];
navItems.push('<div class="nav-group-label">Comece aqui</div>');
navItems.push(`<a class="nav-item" href="#${COMO_USAR.id}"><span class="nav-item-dot"></span>Como usar este roteiro</a>`);
navItems.push(`<a class="nav-item" href="#${PLANO_ESTUDO.id}"><span class="nav-item-dot"></span>Plano de estudo em 5 dias</a>`);
navItems.push(`<a class="nav-item" href="#${FRASES_SEGURANCA.id}"><span class="nav-item-dot"></span>Quando você não souber</a>`);

navItems.push('<div class="nav-group-label learn-only">Capítulo 00 &middot; fundamentos</div>');
for (const f of FUNDAMENTOS) {
  navItems.push(
    `<a class="nav-item learn-only" href="#${f.id}"><span class="nav-item-num">${f.n}</span>${esc(f.title)}</a>`,
  );
}

navItems.push('<div class="nav-group-label">Antes de começar</div>');
for (const n of foundations) {
  navItems.push(`<a class="nav-item" href="#${n.id}"><span class="nav-item-dot"></span>${esc(n.label)}</a>`);
}

for (const key of seasons) {
  const [num, label] = SECTION_META[key];
  navItems.push(`<div class="nav-group-label">Temporada ${num} &middot; ${esc(label)}</div>`);
  for (const n of beats.filter((b) => sectionKey(b) === key)) {
    navItems.push(
      `<a class="nav-item" href="#${n.id}"><span class="nav-item-num">E${String(n.beat).padStart(2, '0')}</span>${esc(n.label)}</a>`,
    );
  }
}

navItems.push('<div class="nav-group-label">Fechamento</div>');
for (const n of synthesis) {
  navItems.push(`<a class="nav-item" href="#${n.id}"><span class="nav-item-dot"></span>${esc(n.label)}</a>`);
}
navItems.push(`<a class="nav-item" href="#glossario"><span class="nav-item-dot"></span>Glossário (${Object.keys(GLOSSARY).length} termos)</a>`);

// ------------------------------------------------------------------ corpo
const corpo = [];

corpo.push(`
  <section id="${COMO_USAR.id}" class="node-section intro-section">
    <div class="node-eyebrow">Leia primeiro</div>
    <h2 class="node-title">${esc(COMO_USAR.title)}</h2>
    <div class="block">${paras(COMO_USAR.body)}</div>
  </section>`);

corpo.push(`
  <section id="${PLANO_ESTUDO.id}" class="node-section intro-section learn-only">
    <div class="node-eyebrow">Leia primeiro</div>
    <h2 class="node-title">${esc(PLANO_ESTUDO.title)}</h2>
    <p class="node-oneline">${md(PLANO_ESTUDO.intro)}</p>
    <div class="plano-list">
      ${PLANO_ESTUDO.dias
        .map(
          (d) => `
      <div class="plano-row">
        <div class="plano-dia"><span class="plano-dia-n">${esc(d.dia)}</span><span class="plano-dur">${esc(d.dur)}</span></div>
        <div>
          <div class="plano-titulo">${esc(d.titulo)}</div>
          <div class="plano-desc">${md(d.desc)}</div>
        </div>
      </div>`,
        )
        .join('')}
    </div>
  </section>`);

corpo.push(`
  <section id="${FRASES_SEGURANCA.id}" class="node-section intro-section">
    <div class="node-eyebrow">Leia primeiro</div>
    <h2 class="node-title">${esc(FRASES_SEGURANCA.title)}</h2>
    <p class="node-oneline">${md(FRASES_SEGURANCA.intro)}</p>
    <div class="frases-list">
      ${FRASES_SEGURANCA.frases
        .map(
          (f) => `
      <div class="frase-row">
        <div class="frase-sit">${esc(f.situacao)}</div>
        <div class="frase-txt">${md(f.frase)}</div>
        <div class="frase-why">${md(f.porque)}</div>
      </div>`,
        )
        .join('')}
    </div>
  </section>`);

corpo.push(`
  <div class="season-divider learn-only" id="cap00">
    <div class="season-num">00</div>
    <div><div class="season-label">Fundamentos</div><div class="season-sub">O andar de baixo. Isso não vai ser apresentado: é o que você precisa saber pra entender o resto.</div></div>
  </div>`);
corpo.push(fundamentosHtml);

corpo.push(`
  <div class="season-divider">
    <div class="season-num">&mdash;</div>
    <div><div class="season-label">Antes de começar</div><div class="season-sub">Conceitos que a turma também não viu, e que você ensina do zero se precisar.</div></div>
  </div>`);
for (const n of foundations) corpo.push(renderNode(n, 'foundation'));

for (const key of seasons) {
  const [num, label] = SECTION_META[key];
  corpo.push(`
  <div class="season-divider" id="season-${key}">
    <div class="season-num">${num}</div>
    <div><div class="season-label">${esc(label)}</div></div>
  </div>`);
  for (const n of beats.filter((b) => sectionKey(b) === key)) corpo.push(renderNode(n, 'beat'));
}

for (const n of synthesis) corpo.push(renderNode(n, 'synthesis'));

// --------------------------------------------------------------- glossario
const glossOrdered = Object.entries(GLOSSARY).sort((a, b) =>
  a[1].t.localeCompare(b[1].t, 'pt-BR'),
);
const glossHtml = glossOrdered
  .map(
    ([k, v]) => `
      <div class="gl-card" id="gl-${k}">
        <div class="gl-term">${esc(v.t)}</div>
        <div class="gl-def">${md(v.d)}</div>
        ${v.a ? `<div class="gl-analogy"><span class="gl-k">como se fosse</span>${md(v.a)}</div>` : ''}
        ${v.x ? `<div class="gl-deep"><span class="gl-k">pra ir além</span>${md(v.x)}</div>` : ''}
      </div>`,
  )
  .join('');

// ------------------------------------------------------------------ totais
const totalNodes = FUNDAMENTOS.length + nodes.length;

const HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Roteiro &middot; ${esc(lesson.title)}</title>
<link href="https://fonts.googleapis.com" rel="preconnect" />
<link crossorigin="" href="https://fonts.gstatic.com" rel="preconnect" />
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
<style>
  :root {
    --black:#000; --canvas:#141414; --card:#181818; --card-hi:#1f1f1f;
    --line:#2b2b2b; --ink:#fff; --muted:#b3b3b3; --faint:#7a7a7a;
    --red:#e50914; --green:#2ecc71; --amber:#e5a000; --blue:#5b9dd9;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { margin:0; background:var(--canvas); color:var(--ink); font-family:'Inter',system-ui,sans-serif; display:flex; min-height:100vh; }
  .display { font-family:'Archivo',sans-serif; font-weight:800; letter-spacing:-0.015em; }
  .mono { font-family:'JetBrains Mono',monospace; }
  .cap { text-transform:uppercase; letter-spacing:0.14em; font-weight:600; }
  a { color:inherit; }

  /* ---------- sidebar ---------- */
  #sidebar { width:326px; flex:0 0 326px; background:var(--black); border-right:1px solid var(--line);
    position:sticky; top:0; height:100vh; overflow-y:auto; padding-bottom:40px; }
  .sb-top { position:sticky; top:0; background:var(--black); padding:24px 22px 16px; border-bottom:1px solid var(--line); z-index:2; }
  .sb-brand { display:flex; align-items:baseline; gap:9px; margin-bottom:16px; }
  .sb-brand .mark { font-family:'Archivo',sans-serif; font-weight:800; font-size:19px; letter-spacing:0.12em; color:var(--red); }
  .sb-brand .role { font-size:10.5px; letter-spacing:0.12em; text-transform:uppercase; color:var(--faint); }
  .mode-toggle { display:flex; background:var(--card); border-radius:4px; padding:3px; margin-bottom:14px; }
  .mode-btn { flex:1; border:none; background:transparent; color:var(--faint); font-family:inherit; font-size:12px;
    font-weight:600; padding:7px 6px; border-radius:3px; cursor:pointer; }
  .mode-btn.on { background:var(--red); color:#fff; }
  .prog-wrap { font-size:11px; color:var(--faint); }
  .prog-bar { height:4px; background:var(--line); border-radius:2px; overflow:hidden; margin-top:6px; }
  .prog-fill { height:100%; width:0%; background:var(--green); transition:width .25s ease; }

  .nav-group-label { font-size:10.5px; letter-spacing:0.12em; text-transform:uppercase; color:var(--faint); padding:16px 22px 7px; font-weight:600; }
  .nav-item { display:flex; align-items:center; gap:9px; padding:6px 22px; font-size:13px; color:var(--muted);
    text-decoration:none; border-left:2px solid transparent; }
  .nav-item:hover { color:var(--ink); background:rgba(255,255,255,0.05); }
  .nav-item.here { color:#fff; border-left-color:var(--red); background:rgba(255,255,255,0.05); }
  .nav-item.ok .nav-item-dot, .nav-item.ok .nav-item-num { color:var(--green); }
  .nav-item.ok .nav-item-dot { background:var(--green); }
  .nav-item-dot { width:5px; height:5px; border-radius:50%; background:var(--faint); flex:0 0 auto; }
  .nav-item-num { font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--faint); width:30px; flex:0 0 auto; }

  /* ---------- main ---------- */
  #main { flex:1; min-width:0; }
  .cover { padding:80px 68px 56px; background:radial-gradient(120% 100% at 80% 0%, rgba(229,9,20,0.15), transparent 62%), var(--canvas); border-bottom:1px solid var(--line); }
  .cover-eyebrow { font-size:11.5px; color:var(--red); margin-bottom:16px; }
  .cover h1 { font-size:50px; line-height:1.08; margin:0 0 18px; max-width:20ch; }
  .cover-sub { font-size:18px; color:var(--muted); max-width:66ch; margin:0 0 26px; line-height:1.5; }
  .cover-meta { display:flex; gap:26px; flex-wrap:wrap; }
  .cover-meta-k { font-size:10.5px; color:var(--faint); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:3px; }
  .cover-meta-v { font-family:'JetBrains Mono',monospace; font-size:14px; }

  .season-divider { display:flex; align-items:center; gap:20px; padding:52px 68px 18px; border-top:1px solid var(--line); margin-top:10px; }
  .season-num { font-family:'Archivo',sans-serif; font-weight:800; font-size:44px; color:transparent; -webkit-text-stroke:2px var(--red); flex:0 0 auto; }
  .season-label { font-family:'Archivo',sans-serif; font-weight:700; font-size:23px; }
  .season-sub { font-size:13.5px; color:var(--faint); margin-top:4px; max-width:70ch; }

  .node-section { padding:40px 68px 44px; border-top:1px solid var(--line); scroll-margin-top:16px; }
  .node-head { display:flex; align-items:flex-start; gap:24px; justify-content:space-between; }
  .node-eyebrow { font-size:11.5px; letter-spacing:0.1em; text-transform:uppercase; color:var(--faint); margin-bottom:9px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .badge-teach { font-family:'JetBrains Mono',monospace; font-size:9.5px; text-transform:none; letter-spacing:0.02em; color:var(--amber); border:1px solid rgba(229,160,0,.4); border-radius:3px; padding:2px 7px; }
  .node-title { font-family:'Archivo',sans-serif; font-weight:800; font-size:31px; margin:0 0 10px; letter-spacing:-0.01em; }
  .fund-num { font-family:'JetBrains Mono',monospace; font-size:16px; color:var(--red); margin-right:12px; font-weight:700; }
  .node-oneline { font-size:17px; color:var(--muted); max-width:76ch; line-height:1.55; margin:0 0 16px; }
  .tag-row { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:24px; }
  .tag-chip { font-family:'JetBrains Mono',monospace; font-size:11px; background:var(--card-hi); color:var(--muted); border-radius:3px; padding:3px 8px; }

  .done-check { display:flex; align-items:center; gap:7px; font-size:11.5px; color:var(--faint); cursor:pointer; flex:0 0 auto;
    border:1px solid var(--line); border-radius:999px; padding:6px 13px; user-select:none; white-space:nowrap; }
  .done-check:hover { color:var(--muted); border-color:var(--faint); }
  .done-check input { accent-color:var(--green); margin:0; cursor:pointer; }
  .done-check.on { color:var(--green); border-color:rgba(46,204,113,.45); }

  .block { max-width:84ch; margin:24px 0; }
  .block-label { font-size:10.5px; letter-spacing:0.12em; text-transform:uppercase; color:var(--red); font-weight:600; margin-bottom:9px; display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
  .block-hint { text-transform:none; letter-spacing:0; color:var(--faint); font-weight:400; font-size:11.5px; }
  .block p { font-size:15.5px; line-height:1.72; color:#e8e8e8; margin:0 0 13px; }
  .block p:last-child { margin-bottom:0; }
  .block strong { color:var(--ink); font-weight:600; }

  .b-dozero { background:var(--card); border-left:3px solid var(--blue); border-radius:4px; padding:20px 24px; }
  .b-dozero .block-label { color:var(--blue); }
  .b-erro { background:var(--card); border-left:3px solid var(--amber); border-radius:4px; padding:18px 24px; }
  .b-erro .block-label { color:var(--amber); }
  .b-fluxo { background:var(--card); border-left:3px solid var(--green); border-radius:4px; padding:19px 24px; }
  .b-fluxo .block-label { color:var(--green); }
  .reforco-meta { font-size:13.5px; color:var(--muted); line-height:1.6; margin-top:11px; }
  .reforco-k { display:block; font-family:'JetBrains Mono',monospace; font-size:10px; text-transform:uppercase; color:var(--green); margin-bottom:4px; letter-spacing:.06em; }
  .fluxo-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px; }
  .fluxo-list li { display:flex; gap:12px; font-size:14.5px; color:#dcdcdc; line-height:1.6; }
  .fluxo-n { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--green); padding-top:2px; flex:0 0 auto; }
  .block-anchor { background:var(--card); border-left:3px solid var(--red); border-radius:4px; padding:20px 24px; }
  .anchor-text { font-family:'Archivo',sans-serif; font-weight:600; font-size:19px; line-height:1.5; margin:0; }

  .ascii-card { background:var(--black); border-left:3px solid var(--red); border-radius:4px; padding:20px 24px; margin-bottom:14px; }
  .ascii-title { font-size:12.5px; font-weight:600; color:var(--muted); margin-bottom:11px; }
  .ascii-art { font-family:'JetBrains Mono',monospace; font-size:12.5px; line-height:1.55; color:#d8d8d8; margin:0; overflow-x:auto; white-space:pre; }
  .ascii-caption { font-size:13.5px; color:var(--muted); margin-top:13px; line-height:1.55; }
  .ascii-board { font-size:13.5px; color:var(--faint); margin-top:8px; line-height:1.55; }
  .ascii-board-k, .gl-k { font-family:'JetBrains Mono',monospace; font-size:10px; text-transform:uppercase; color:var(--red); margin-right:8px; letter-spacing:.06em; }
  .ascii-credit { opacity:.6; }
  .visual-img { max-width:100%; border-radius:4px; }

  .gotcha-list, .ask-list { display:flex; flex-direction:column; gap:12px; }
  .gotcha-row, .ask-row { background:var(--card); border-radius:4px; padding:14px 18px; }
  .gotcha-head { font-family:'Archivo',sans-serif; font-weight:700; font-size:14.5px; color:var(--amber); margin-bottom:5px; }
  .gotcha-note { font-size:14px; color:var(--muted); line-height:1.6; }
  .ask-row { display:flex; gap:15px; align-items:flex-start; }
  .ask-rank { font-family:'JetBrains Mono',monospace; font-size:10.5px; color:var(--red); font-weight:700; padding-top:2px; width:46px; flex:0 0 auto; }
  .ask-rank.ask-open { color:var(--faint); }
  .ask-name { font-family:'Archivo',sans-serif; font-weight:700; font-size:15.5px; margin-bottom:3px; }
  .ask-why { font-size:13.5px; color:var(--muted); line-height:1.6; }

  .sc-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:13px; max-width:104ch; }
  .sc-card { background:var(--card); border-radius:4px; padding:15px 17px; border-top:3px solid var(--line); }
  .sc-right { border-top-color:var(--green); } .sc-close { border-top-color:var(--amber); } .sc-wayoff { border-top-color:var(--red); }
  .sc-label { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; margin-bottom:9px; color:var(--faint); }
  .sc-right .sc-label { color:var(--green); } .sc-close .sc-label { color:var(--amber); } .sc-wayoff .sc-label { color:var(--red); }
  .sc-field { font-size:13.5px; line-height:1.55; color:#e0e0e0; margin-bottom:9px; }
  .sc-field:last-child { margin-bottom:0; }
  .sc-field-k { display:block; font-family:'JetBrains Mono',monospace; font-size:9.5px; text-transform:uppercase; color:var(--faint); margin-bottom:3px; }

  .block-pair { display:flex; gap:22px; max-width:104ch; flex-wrap:wrap; }
  .block-half { flex:1 1 330px; margin-top:24px; }
  .block-followup .block-label { color:var(--muted); }
  .block-followup p { color:var(--muted); font-style:italic; }

  /* faq */
  .faq-list { display:flex; flex-direction:column; gap:8px; }
  .faq-item { background:var(--card); border-radius:4px; border-left:3px solid var(--line); }
  .faq-item[open] { border-left-color:var(--red); }
  .faq-q { cursor:pointer; padding:13px 17px; font-size:14.5px; font-weight:500; list-style:none; color:#ededed; }
  .faq-q::-webkit-details-marker { display:none; }
  .faq-q::before { content:'?'; font-family:'JetBrains Mono',monospace; color:var(--red); font-weight:700; margin-right:11px; }
  .faq-a { padding:0 17px 15px 41px; font-size:14px; color:var(--muted); line-height:1.68; }

  /* teste-se */
  .b-teste { background:var(--card); border-radius:4px; padding:20px 24px; border-left:3px solid var(--green); }
  .b-teste .block-label { color:var(--green); }
  .teste-list { display:flex; flex-direction:column; gap:16px; }
  .teste-q { font-size:15px; line-height:1.6; margin-bottom:8px; display:flex; gap:11px; }
  .teste-n { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--green); padding-top:3px; }
  .teste-btn { background:transparent; border:1px solid var(--line); color:var(--faint); font-family:inherit; font-size:11.5px;
    padding:5px 12px; border-radius:999px; cursor:pointer; margin-left:22px; }
  .teste-btn:hover { color:var(--ink); border-color:var(--faint); }
  .teste-a { margin:10px 0 0 22px; padding:12px 15px; background:rgba(46,204,113,.07); border-left:2px solid var(--green);
    border-radius:3px; font-size:14px; color:#dcdcdc; line-height:1.65; }

  /* plano + frases */
  .plano-list, .frases-list { display:flex; flex-direction:column; gap:2px; max-width:96ch; }
  .plano-row { display:flex; gap:24px; padding:16px 0; border-bottom:1px solid var(--line); }
  .plano-dia { width:130px; flex:0 0 auto; }
  .plano-dia-n { display:block; font-family:'Archivo',sans-serif; font-weight:700; font-size:16px; }
  .plano-dur { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--faint); }
  .plano-titulo { font-weight:600; font-size:15.5px; margin-bottom:4px; }
  .plano-desc { font-size:14px; color:var(--muted); line-height:1.62; }
  .frase-row { padding:16px 0; border-bottom:1px solid var(--line); }
  .frase-sit { font-size:11px; text-transform:uppercase; letter-spacing:.1em; color:var(--faint); margin-bottom:7px; }
  .frase-txt { font-family:'Archivo',sans-serif; font-weight:600; font-size:16.5px; line-height:1.5; margin-bottom:6px; }
  .frase-why { font-size:13.5px; color:var(--muted); line-height:1.6; }

  /* glossario */
  .glossary-wrap { padding:52px 68px 110px; border-top:1px solid var(--line); }
  .gl-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:14px; margin-top:26px; }
  .gl-card { background:var(--card); border-radius:4px; padding:16px 18px; border-left:3px solid var(--line); scroll-margin-top:16px; }
  .gl-card:target { border-left-color:var(--red); }
  .gl-term { font-family:'Archivo',sans-serif; font-weight:700; font-size:15.5px; margin-bottom:7px; }
  .gl-def { font-size:14px; color:#dcdcdc; line-height:1.62; }
  .gl-analogy, .gl-deep { font-size:13px; color:var(--muted); line-height:1.6; margin-top:10px; }
  .gl-deep { color:var(--faint); }

  /* termos clicaveis */
  .term { background:none; border:none; padding:0; margin:0; font:inherit; color:inherit; cursor:pointer;
    border-bottom:1px dotted rgba(229,9,20,.75); }
  .term:hover, .term.act { color:#fff; background:rgba(229,9,20,.16); border-bottom-color:var(--red); }
  /* absolute, e nao fixed: o popover fica colado ao termo em coordenadas do
     documento, entao rola junto com a pagina sem depender de evento de scroll */
  #pop { position:absolute; z-index:60; width:340px; max-width:calc(100vw - 32px); background:#1c1c1c; border:1px solid var(--line);
    border-top:3px solid var(--red); border-radius:5px; padding:16px 18px; box-shadow:0 16px 40px rgba(0,0,0,.6); display:none; }
  #pop.on { display:block; }
  #pop .p-term { font-family:'Archivo',sans-serif; font-weight:700; font-size:15.5px; margin-bottom:7px; }
  #pop .p-def { font-size:13.5px; color:#dcdcdc; line-height:1.6; }
  #pop .p-a, #pop .p-x { font-size:12.5px; color:var(--muted); line-height:1.55; margin-top:10px; padding-top:10px; border-top:1px solid var(--line); }
  #pop .p-x { color:var(--faint); }
  #pop .p-see { margin-top:11px; display:flex; flex-wrap:wrap; gap:6px; }
  #pop .p-see button { background:var(--card-hi); border:none; color:var(--muted); font:inherit; font-size:11.5px;
    padding:3px 9px; border-radius:3px; cursor:pointer; }
  #pop .p-see button:hover { color:#fff; }

  #top-btn { position:fixed; right:26px; bottom:26px; background:var(--red); color:#fff; border:none; border-radius:999px;
    width:42px; height:42px; display:flex; align-items:center; justify-content:center; cursor:pointer; opacity:0;
    pointer-events:none; transition:opacity .2s; box-shadow:0 8px 20px rgba(0,0,0,.5); z-index:50; }
  #top-btn.show { opacity:1; pointer-events:auto; }

  /* modo apresentar */
  body.mode-present .learn-only { display:none !important; }
  body.mode-present .done-check { display:none; }

  @media (max-width:1000px) {
    body { flex-direction:column; }
    #sidebar { width:100%; flex:none; height:auto; position:relative; }
    .cover,.season-divider,.node-section,.glossary-wrap { padding-left:22px; padding-right:22px; }
    .sc-grid { grid-template-columns:1fr; }
  }
  @media print {
    body { display:block; background:#fff; color:#111; }
    #sidebar,#top-btn,#pop,.done-check,.teste-btn { display:none !important; }
    .learn-only { display:block !important; }
    .node-section,.season-divider,.gl-card,.faq-item { break-inside:avoid; }
    .faq-a,.teste-a { display:block !important; }
    .term { border-bottom:none; }
  }
</style>
</head>
<body>

<nav id="sidebar">
  <div class="sb-top">
    <div class="sb-brand"><span class="mark">ICS</span><span class="role">roteiro do facilitador</span></div>
    <div class="mode-toggle">
      <button class="mode-btn on" data-mode="learn" type="button">Aprender</button>
      <button class="mode-btn" data-mode="present" type="button">Apresentar</button>
    </div>
    <div class="prog-wrap">
      <span id="prog-txt">0 de ${totalNodes} estudados</span>
      <div class="prog-bar"><div class="prog-fill" id="prog-fill"></div></div>
    </div>
  </div>
  ${navItems.join('\n  ')}
</nav>

<main id="main">
  <div class="cover">
    <div class="cover-eyebrow cap">Roteiro do facilitador &middot; versão de estudo</div>
    <h1 class="display">${esc(lesson.title)}</h1>
    <p class="cover-sub">${esc(lesson.subtitle)}</p>
    <div class="cover-meta">
      <div><div class="cover-meta-k">Duração</div><div class="cover-meta-v">${lesson.durationMin} min</div></div>
      <div><div class="cover-meta-k">Turma</div><div class="cover-meta-v">${esc(lesson.audience)}</div></div>
      <div><div class="cover-meta-k">Beats</div><div class="cover-meta-v">${beats.length} episódios</div></div>
      <div><div class="cover-meta-k">Termos explicados</div><div class="cover-meta-v">${Object.keys(GLOSSARY).length}</div></div>
    </div>
  </div>

  ${corpo.join('\n')}

  <div class="glossary-wrap" id="glossario">
    <div class="season-label display">Glossário</div>
    <div class="season-sub">Todo termo com linha pontilhada no texto abre aqui. Os blocos "pra ir além" não entram na aula: existem pra você responder pergunta de aluno.</div>
    <div class="gl-grid">${glossHtml}</div>
  </div>
</main>

<div id="pop" role="dialog" aria-live="polite"></div>

<button id="top-btn" aria-label="Voltar ao topo">
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
</button>

<script>
const GLOSSARY = ${JSON.stringify(GLOSSARY)};
const SKIP = ${JSON.stringify([...SKIP_LINKING])};
const STORE = 'roteiro:noisy-neighbor-ebpf';

/* ---------------- 1. transformar termos do texto em botoes ---------------- */
(function linkTerms() {
  const skip = new Set(SKIP);
  const surfaces = [];
  for (const [key, v] of Object.entries(GLOSSARY)) {
    if (skip.has(key)) continue;
    const forms = new Set([v.t, key.replace(/-/g, ' '), ...(v.alt || [])]);
    for (const f of forms) {
      const s = String(f).trim();
      if (s.length < 2) continue;
      surfaces.push({ key, s });
    }
  }
  surfaces.sort((a, b) => b.s.length - a.s.length);
  const esc = (s) => s.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
  const re = new RegExp('(?<![\\\\w\\u00C0-\\u024F])(' + surfaces.map((x) => esc(x.s)).join('|') + ')(?![\\\\w\\u00C0-\\u024F])', 'gi');
  const bySurface = new Map(surfaces.map((x) => [x.s.toLowerCase(), x.key]));

  const SKIP_TAGS = new Set(['PRE','CODE','BUTTON','A','SCRIPT','STYLE','H1','H2','SUMMARY','TEXTAREA','INPUT','LABEL']);
  const SKIP_CLASS = ['ascii-art','tag-chip','block-label','sc-label','ask-rank','gl-term','nav-item','sc-field-k','ascii-board-k','gl-k','cover-meta-k','plano-dur','node-eyebrow','frase-sit','teste-n','badge-teach'];

  document.querySelectorAll('.node-section, .glossary-wrap').forEach((section) => {
    const used = new Set(); // um link por termo por secao, pra nao poluir
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.trim().length < 3) return NodeFilter.FILTER_REJECT;
        let p = node.parentElement;
        while (p && p !== section) {
          if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
          for (const c of SKIP_CLASS) if (p.classList.contains(c)) return NodeFilter.FILTER_REJECT;
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const targets = [];
    let n;
    while ((n = walker.nextNode())) targets.push(n);

    for (const node of targets) {
      const text = node.nodeValue;
      re.lastIndex = 0;
      let m, last = 0, frag = null;
      while ((m = re.exec(text))) {
        const key = bySurface.get(m[0].toLowerCase());
        if (!key || used.has(key)) continue;
        used.add(key);
        frag = frag || document.createDocumentFragment();
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const b = document.createElement('button');
        b.className = 'term';
        b.type = 'button';
        b.dataset.k = key;
        b.textContent = m[0];
        frag.appendChild(b);
        last = m.index + m[0].length;
      }
      if (frag) {
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
      }
    }
  });
})();

/* ---------------- 2. popover ---------------- */
const pop = document.getElementById('pop');
let popAnchor = null;

function showPop(key, el) {
  const v = GLOSSARY[key];
  if (!v) return;
  const see = (v.see || []).filter((k) => GLOSSARY[k]);
  pop.innerHTML =
    '<div class="p-term">' + v.t + '</div>' +
    '<div class="p-def">' + v.d + '</div>' +
    (v.a ? '<div class="p-a"><span class="gl-k">como se fosse</span>' + v.a + '</div>' : '') +
    (v.x ? '<div class="p-x"><span class="gl-k">pra ir além</span>' + v.x + '</div>' : '') +
    (see.length ? '<div class="p-see">' + see.map((k) => '<button type="button" data-go="' + k + '">' + GLOSSARY[k].t + '</button>').join('') + '</div>' : '');
  pop.classList.add('on');

  document.querySelectorAll('.term.act').forEach((t) => t.classList.remove('act'));
  el.classList.add('act');
  popAnchor = el;
  place();
}

function place() {
  if (!popAnchor) return;
  const r = popAnchor.getBoundingClientRect();
  const h = pop.offsetHeight;
  const w = pop.offsetWidth;

  // decide na coordenada da JANELA (pra caber na tela agora)...
  let left = Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
  let top = r.bottom + 10;
  if (top + h > window.innerHeight - 12) top = r.top - h - 10; // nao coube: vai pra cima
  top = Math.max(12, Math.min(top, Math.max(12, window.innerHeight - h - 12)));

  // ...e converte pra coordenada do DOCUMENTO, pra rolar junto com a pagina
  pop.style.left = left + window.scrollX + 'px';
  pop.style.top = top + window.scrollY + 'px';
}
function hidePop() {
  pop.classList.remove('on');
  document.querySelectorAll('.term.act').forEach((t) => t.classList.remove('act'));
  popAnchor = null;
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('.term');
  if (t) { e.preventDefault(); showPop(t.dataset.k, t); return; }
  const go = e.target.closest('[data-go]');
  if (go && popAnchor) { showPop(go.dataset.go, popAnchor); return; }
  if (!e.target.closest('#pop')) hidePop();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePop(); });
// Nada de listener de scroll: o popover esta em coordenada de documento, entao
// rola junto com o termo sozinho. Fechar em qualquer scroll (versao anterior)
// fazia o leitor perder o popover no menor toque de trackpad.
window.addEventListener('resize', () => { if (popAnchor) place(); });

/* ---------------- 3. teste-se ---------------- */
document.addEventListener('click', (e) => {
  const b = e.target.closest('.teste-btn');
  if (!b) return;
  const a = document.getElementById('teste-' + b.dataset.teste);
  if (!a) return;
  a.hidden = !a.hidden;
  b.textContent = a.hidden ? 'Ver resposta' : 'Esconder';
});

/* ---------------- 4. modo aprender / apresentar ---------------- */
const modeBtns = [...document.querySelectorAll('.mode-btn')];
function setMode(m) {
  document.body.classList.toggle('mode-present', m === 'present');
  modeBtns.forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  try { localStorage.setItem(STORE + ':mode', m); } catch (err) {}
}
modeBtns.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
try { setMode(localStorage.getItem(STORE + ':mode') || 'learn'); } catch (err) { setMode('learn'); }

/* ---------------- 5. progresso ---------------- */
const checks = [...document.querySelectorAll('[data-done]')];
const progTxt = document.getElementById('prog-txt');
const progFill = document.getElementById('prog-fill');
function readDone() {
  try { return JSON.parse(localStorage.getItem(STORE + ':done') || '[]'); } catch (err) { return []; }
}
function paint() {
  const done = new Set(readDone());
  checks.forEach((c) => {
    const on = done.has(c.dataset.done);
    c.checked = on;
    c.closest('.done-check').classList.toggle('on', on);
    const link = document.querySelector('.nav-item[href="#' + c.dataset.done + '"]');
    if (link) link.classList.toggle('ok', on);
  });
  const n = checks.filter((c) => done.has(c.dataset.done)).length;
  progTxt.textContent = n + ' de ' + checks.length + ' estudados';
  progFill.style.width = (checks.length ? (n / checks.length) * 100 : 0) + '%';
}
checks.forEach((c) =>
  c.addEventListener('change', () => {
    const done = new Set(readDone());
    if (c.checked) done.add(c.dataset.done); else done.delete(c.dataset.done);
    try { localStorage.setItem(STORE + ':done', JSON.stringify([...done])); } catch (err) {}
    paint();
  }),
);
paint();

/* ---------------- 6. item ativo na sidebar ---------------- */
const links = new Map([...document.querySelectorAll('.nav-item')].map((a) => [a.getAttribute('href').slice(1), a]));
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      const l = links.get(e.target.id);
      if (l) l.classList.toggle('here', e.isIntersecting);
    });
  },
  { rootMargin: '-8% 0px -80% 0px' },
);
document.querySelectorAll('.node-section, .glossary-wrap').forEach((el) => io.observe(el));

/* ---------------- 7. voltar ao topo ---------------- */
const topBtn = document.getElementById('top-btn');
topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
window.addEventListener('scroll', () => topBtn.classList.toggle('show', window.scrollY > 700), { passive: true });
</script>
</body>
</html>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, HTML, 'utf8');
console.log('roteiro gerado:', OUT);
console.log('  nós:', nodes.length, '| fundamentos:', FUNDAMENTOS.length, '| termos:', Object.keys(GLOSSARY).length);
