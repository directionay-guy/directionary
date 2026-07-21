/* Optional dev panel — remove this file and the dev markup for production.
   Uses the window.UNIMP_DEV bridge exposed by game.js. */
(() => {
  const el = (id) => document.getElementById(id);
  const toggle = el('dev-toggle');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    el('dev-panel').classList.toggle('open');
  });

  el('dev-new').addEventListener('click', () => {
    window.UNIMP_DEV.loadRandom();
    el('dev-result').textContent = 'Loaded a fresh random puzzle.';
  });

  el('dev-test').addEventListener('click', () => {
    const N = 20;
    let win = 0, trap = 0, bad = 0;
    for (let i = 0; i < N; i++) {
      const p = window.UNIMP_DEV.generate();
      if (!p) { bad++; continue; }
      const T = p.words.topWord.split(''), L = p.words.leftWord.split('');
      const B = p.words.bottomWord.split(''), R = p.words.rightWord.split('');
      if (window.UNIMP_DEV.validateWinnable(p.grid, T, L, B, R)) win++;
      if (window.UNIMP_DEV.isTrapFree(p.grid, T, L, B, R)) trap++; else bad++;
    }
    el('dev-result').textContent =
      `Winnable: ${win}/${N}\nTrap-free: ${trap}/${N}\nProblems: ${bad}`;
  });
})();
