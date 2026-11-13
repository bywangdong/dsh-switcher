// Motion self-check for the browser prototype (loaded only with ?selftest=1).
// Prints raw measurements on the page so they can be read from a screenshot.
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const frame = () => new Promise(resolve => requestAnimationFrame(() => resolve()));
const block = '[data-edition-block=kibutsu]';
const lens = () => document.querySelector(`${block} .dsh-switcher-lens`);
const tx = () => Math.round(new DOMMatrix(getComputedStyle(lens()).transform).m41 * 10) / 10;
const key = k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
const labels = () => [...document.querySelectorAll(`${block} .dsh-switcher-status-label`)].map(e => e.textContent).join(' / ');
const iconSnapshot = cardIdx => {
  const card = document.querySelectorAll(`${block} .dsh-switcher-card`)[cardIdx];
  return [...card.querySelectorAll('.dsh-switcher-icon svg path')].slice(0, 8)
    .map(p => `${p.getAttribute('d')}|${p.getAttribute('opacity')}`).join(';');
};

export async function runSelftest() {
  const out = [];
  const log = (name, value, pass) => out.push(`${pass === undefined ? '·' : pass ? 'PASS' : 'FAIL'}  ${name}: ${value}`);
  await sleep(260);

  // 1. Icon motion checks in default `balanced` mode (0:idle, 1:running, 2:approval, 3:unread, 4:draft)
  const snapA = [0, 1, 2, 3, 4].map(iconSnapshot);
  await sleep(240);
  const snapB = [0, 1, 2, 3, 4].map(iconSnapshot);
  const moved = snapA.map((s, i) => s !== snapB[i]);
  log('balanced icon motion [idle,run,wait,unread,draft]', moved.map(Number).join(','),
    !moved[0] && moved[1] && moved[2] && !moved[3] && !moved[4]);

  // 2. `running-only` mode: running moves, approval settles & stays still
  document.querySelector('button[data-icon-motion="running-only"]').click();
  await sleep(360);
  const roA = [1, 2].map(iconSnapshot);
  await sleep(200);
  const roB = [1, 2].map(iconSnapshot);
  log('running-only [run,wait]', `${Number(roA[0] !== roB[0])},${Number(roA[1] !== roB[1])}`,
    roA[0] !== roB[0] && roA[1] === roB[1]);

  // 3. Restore `balanced` & test selection lens + live status shift
  document.querySelector('button[data-icon-motion="balanced"]').click();
  await sleep(360);

  const first = document.querySelector(`${block} .dsh-switcher-card`);
  first.__tag = 1;
  key('ArrowRight'); await sleep(50); const mid = tx(); await sleep(380); const end = tx();
  log('lens slide 2→3 (50ms → end)', `${mid} → ${end}`, mid > 182 && mid < 364 && end === 364);
  key('ArrowRight'); await sleep(260); key('ArrowRight'); await sleep(260);
  key('ArrowRight'); await frame(); const wrapped = tx();
  log('wrap 5→1 instant', wrapped, wrapped === 0);
  key('ArrowRight'); await sleep(360);

  document.getElementById('simulate').click(); await frame();
  const anims = document.getAnimations().filter(a => a.effect?.target?.classList?.contains('dsh-switcher-status-label'));
  log('live shift anims + DOM kept', `${anims.length} anims, kept=${first.__tag === 1}`, anims.length > 0 && first.__tag === 1);
  await sleep(300);
  document.getElementById('simulate').click(); await sleep(340);

  // 4. `off` (`全静`) mode: both icons & lens freeze immediately
  document.querySelector('button[data-icon-motion="off"]').click();
  const offA = [1, 2].map(iconSnapshot);
  key('ArrowRight'); await sleep(25); const offTx = tx();
  await sleep(150);
  const offB = [1, 2].map(iconSnapshot);
  log('off mode (lens 25ms & icons still)', `tx=${offTx}, icons=${Number(offA[0] !== offB[0])},${Number(offA[1] !== offB[1])}`,
    offTx === 364 && offA[0] === offB[0] && offA[1] === offB[1]);

  // Restore clean default state
  key('ArrowLeft'); await sleep(25);
  document.querySelector('button[data-icon-motion="balanced"]').click();
  log('restored default', `mode=${document.body.dataset.iconMotion} lens=${tx()} labels=${labels()}`,
    document.body.dataset.iconMotion === 'balanced' && tx() === 182);

  const pre = document.createElement('pre');
  pre.id = 'selftest-result';
  pre.textContent = out.join('\n');
  pre.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:99;margin:0;padding:10px 12px;max-width:680px;font:12px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap;background:#000d;color:#fff;border-radius:8px';
  document.body.append(pre);
}
