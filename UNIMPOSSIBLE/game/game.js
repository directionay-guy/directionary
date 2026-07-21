/* ============================================================================
   UNIMPOSSIBLE — vanilla JS engine
   A daily word puzzle by Joel Pickard (JTPgaming).

   Ported faithfully from the React reference. No frameworks, no build step.
   Sections:
     1. Word bank load
     2. Seeded RNG + date key (daily puzzle + midnight rollover)
     3. Generator (placement, decoys, trap-free gate)  -- verbatim algorithms
     4. Anchor (free starting letter)
     5. Game state
     6. Board application + reset
     7. Rendering
     8. Drag & drop interaction
     9. Win/loss, hints, scoring
    10. Modals (help/about/stats/share) + dismissal
    11. Stats (localStorage)
    12. Boot + daily rollover watcher
   ============================================================================ */

(() => {
  'use strict';

  /* ---- constants ---------------------------------------------------------- */
  const LAUNCH_DATE = '2025-01-01';   // puzzle #1 = this date (adjust at launch)
  const START_MOVES = 100;
  const MAX_HINTS = 5;
  const WORD_TRIES = 60;
  const PLACEMENT_TRIES = 25;

  const LANE = {
    top:    { soft: '#7FB0F5', mid: '#3B82F6', deep: '#2563EB', dir: 'blue' },
    left:   { soft: '#74D69B', mid: '#22C55E', deep: '#16A34A', dir: 'green' },
    bottom: { soft: '#F7B25E', mid: '#F97316', deep: '#EA580C', dir: 'orange' },
    right:  { soft: '#F58FC2', mid: '#EC4899', deep: '#DB2777', dir: 'pink' },
  };

  /* ---- 1. word bank ------------------------------------------------------- */
  let WORD_BANK = [];

  /* ---- 2. seeded RNG + date ---------------------------------------------- */
  // Mulberry32 seeded PRNG so every player gets the same daily board.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashStr(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  // ONE source of truth for "today" — used for BOTH the seed and the rollover
  // check, in local time. (This single-source rule is what prevents the
  // Directionary midnight-reload bug.)
  function getTodayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function getPuzzleNumber(dayKey) {
    const launch = new Date(LAUNCH_DATE + 'T00:00:00');
    const today = new Date(dayKey + 'T00:00:00');
    const diff = Math.floor((today - launch) / 86400000);
    return diff + 1;
  }

  // Active RNG — swapped between seeded (daily) and Math.random (dev/Shift+N).
  let rng = Math.random;

  function shuffleArr(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---- 3. generator (verbatim algorithms) -------------------------------- */
  function buildDemands(top, left, bottom, right) {
    const d = [];
    for (let c = 0; c < 6; c++) {
      d.push({ letter: top[c], line: 'col', index: c });
      d.push({ letter: bottom[c], line: 'col', index: c });
    }
    for (let r = 0; r < 6; r++) {
      d.push({ letter: left[r], line: 'row', index: r });
      d.push({ letter: right[r], line: 'row', index: r });
    }
    return d;
  }

  function placeDemands(top, left, bottom, right) {
    const order = shuffleArr(buildDemands(top, left, bottom, right));
    const g = Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => ''));
    const candidates = (d) => {
      const cells = [];
      if (d.line === 'col') { for (let r = 0; r < 6; r++) cells.push({ row: r, col: d.index }); }
      else { for (let c = 0; c < 6; c++) cells.push({ row: d.index, col: c }); }
      return shuffleArr(cells);
    };
    const backtrack = (i) => {
      if (i === order.length) return true;
      const d = order[i];
      for (const cell of candidates(d)) {
        if (g[cell.row][cell.col] === '') {
          g[cell.row][cell.col] = d.letter;
          if (backtrack(i + 1)) return true;
          g[cell.row][cell.col] = '';
        }
      }
      return false;
    };
    if (!backtrack(0)) return null;
    return g;
  }

  function fillDecoys(g, top, left, bottom, right) {
    const realLetters = [...new Set([...top, ...left, ...bottom, ...right])];
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        if (g[r][c] !== '') continue;
        const forbidden = new Set([top[c], bottom[c], left[r], right[r]]);
        const pool = shuffleArr(realLetters.filter((l) => !forbidden.has(l)));
        let chosen = pool[0];
        if (!chosen) {
          const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
          chosen = shuffleArr(alpha.filter((l) => !forbidden.has(l)))[0];
        }
        g[r][c] = chosen;
      }
    }
    return g;
  }

  function validateWinnable(g, top, left, bottom, right) {
    if (!g || !Array.isArray(g)) return false;
    const colHas = (col, letter) => { for (let r = 0; r < 6; r++) if (g[r][col] === letter) return true; return false; };
    const rowHas = (row, letter) => { for (let c = 0; c < 6; c++) if (g[row][c] === letter) return true; return false; };
    for (let c = 0; c < 6; c++) if (!colHas(c, top[c]) || !colHas(c, bottom[c])) return false;
    for (let r = 0; r < 6; r++) if (!rowHas(r, left[r]) || !rowHas(r, right[r])) return false;
    let filled = 0;
    for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) if (g[r][c] !== '') filled++;
    return filled === 36;
  }

  // ---- trap detection ----
  function buildSolveSlots(g, top, left, bottom, right) {
    const colCells = (c, L) => { const o = []; for (let r = 0; r < 6; r++) if (g[r][c] === L) o.push(r + ',' + c); return o; };
    const rowCells = (r, L) => { const o = []; for (let c = 0; c < 6; c++) if (g[r][c] === L) o.push(r + ',' + c); return o; };
    const slots = [];
    for (let c = 0; c < 6; c++) { slots.push(colCells(c, top[c])); slots.push(colCells(c, bottom[c])); }
    for (let r = 0; r < 6; r++) { slots.push(rowCells(r, left[r])); slots.push(rowCells(r, right[r])); }
    return slots;
  }
  function solvableWith(slots, forceIdx, forceCell) {
    const order = slots.map((s, i) => i).sort((a, b) => slots[a].length - slots[b].length);
    const used = new Set();
    if (forceIdx !== undefined) {
      if (!slots[forceIdx].includes(forceCell)) return false;
      used.add(forceCell);
    }
    const seq = order.filter((i) => i !== forceIdx);
    const bt = (k) => {
      if (k === seq.length) return true;
      for (const cell of slots[seq[k]]) {
        if (!used.has(cell)) {
          used.add(cell);
          if (bt(k + 1)) return true;
          used.delete(cell);
        }
      }
      return false;
    };
    return bt(0);
  }
  function isTrapFree(g, top, left, bottom, right) {
    const slots = buildSolveSlots(g, top, left, bottom, right);
    if (!solvableWith(slots)) return false;
    for (let i = 0; i < slots.length; i++) {
      if (slots[i].length <= 1) continue;
      for (const cell of slots[i]) {
        if (!solvableWith(slots, i, cell)) return false;
      }
    }
    return true;
  }

  // Generate one complete, validated, TRAP-FREE puzzle.
  // Order is critical: trap-check the demand grid FIRST, then fill decoys,
  // then validate the full 36-cell grid.
  function generatePuzzle() {
    for (let w = 0; w < WORD_TRIES; w++) {
      const picks = shuffleArr(WORD_BANK).slice(0, 4);
      const [top, left, bottom, right] = picks.map((wd) => wd.split(''));
      for (let t = 0; t < PLACEMENT_TRIES; t++) {
        const placed = placeDemands(top, left, bottom, right);
        if (!placed) break;
        if (!isTrapFree(placed, top, left, bottom, right)) continue;
        fillDecoys(placed, top, left, bottom, right);
        if (!validateWinnable(placed, top, left, bottom, right)) continue;
        return {
          grid: placed,
          words: { topWord: picks[0], leftWord: picks[1], bottomWord: picks[2], rightWord: picks[3] },
        };
      }
    }
    return null;
  }

  /* ---- 4. anchor (free starting letter) ---------------------------------- */
  function chooseAnchor(g, words) {
    const top = words.topWord.split(''), left = words.leftWord.split('');
    const bottom = words.bottomWord.split(''), right = words.rightWord.split('');
    const cands = [];
    const findInCol = (col, letter) => { for (let r = 0; r < 6; r++) if (g[r][col] === letter) return r; return -1; };
    const findInRow = (row, letter) => { for (let c = 0; c < 6; c++) if (g[row][c] === letter) return c; return -1; };
    for (let c = 0; c < 6; c++) {
      const r1 = findInCol(c, top[c]); if (r1 >= 0) cands.push({ key: `top-${c}`, letter: top[c], row: r1, col: c });
      const r2 = findInCol(c, bottom[c]); if (r2 >= 0) cands.push({ key: `bottom-${c}`, letter: bottom[c], row: r2, col: c });
    }
    for (let r = 0; r < 6; r++) {
      const c1 = findInRow(r, left[r]); if (c1 >= 0) cands.push({ key: `left-${r}`, letter: left[r], row: r, col: c1 });
      const c2 = findInRow(r, right[r]); if (c2 >= 0) cands.push({ key: `right-${r}`, letter: right[r], row: r, col: c2 });
    }
    if (cands.length === 0) return null;
    const leverage = (x) => ((x.row >= 1 && x.row <= 4) ? 1 : 0) + ((x.col >= 1 && x.col <= 4) ? 1 : 0);
    const maxLev = Math.max(...cands.map(leverage));
    const best = cands.filter((x) => leverage(x) === maxLev);
    return best[Math.floor(rng() * best.length)];
  }

  /* ---- 5. game state ------------------------------------------------------ */
  const S = {
    grid: [],                 // current 6x6 (letters or '')
    pristineGrid: null,       // full generated grid (for mode toggles)
    anchorChoice: null,       // fixed anchor for this puzzle
    anchorKey: null,          // active locked slot key, e.g. 'top-2'
    words: null,              // { topWord, leftWord, bottomWord, rightWord }
    lanes: { top: [], left: [], bottom: [], right: [] }, // placed letters per lane
    moved: new Map(),         // laneKey -> "row-col" origin (for ghosts + drag-back)
    score: START_MOVES,
    moveCount: 0,
    hintsUsed: 0,
    hasWon: false,
    hasLost: false,
    assistMode: false,        // false = Unimpossible (default). true = Possible.
    highlight: null,          // { row, col, dir } hinted tile
    puzzleNumber: 0,
    dayKey: null,
    dragged: null,            // { letter, source, index?, row?, col? }
  };

  const gameStarted = () => S.moveCount > 0 || S.hintsUsed > 0;

  /* ---- 6. board application + reset -------------------------------------- */
  function applyBoard(sourceGrid, anchor, showAnchor, fullReset) {
    const baseGrid = sourceGrid.map((row) => [...row]);
    const lanes = { top: ['', '', '', '', '', ''], left: ['', '', '', '', '', ''], bottom: ['', '', '', '', '', ''], right: ['', '', '', '', '', ''] };
    const moved = new Map();
    let anchorKey = null;

    if (showAnchor && anchor) {
      const [lane, idxStr] = anchor.key.split('-');
      const idx = parseInt(idxStr, 10);
      lanes[lane][idx] = anchor.letter;
      baseGrid[anchor.row][anchor.col] = '';
      moved.set(anchor.key, `${anchor.row}-${anchor.col}`);
      anchorKey = anchor.key;
    }

    S.grid = baseGrid;
    S.lanes = lanes;
    S.moved = moved;
    S.anchorKey = anchorKey;
    S.highlight = null;
    if (fullReset) {
      S.hasWon = false; S.hasLost = false;
      S.score = START_MOVES; S.moveCount = 0; S.hintsUsed = 0;
    }
    render();
  }

  function loadDailyPuzzle() {
    const dayKey = getTodayKey();
    rng = mulberry32(hashStr('UNIMPOSSIBLE-' + dayKey));
    const puzzle = generatePuzzle();
    if (!puzzle) { console.error('Generator failed.'); return; }
    S.dayKey = dayKey;
    S.puzzleNumber = getPuzzleNumber(dayKey);
    S.words = puzzle.words;
    S.pristineGrid = puzzle.grid.map((r) => [...r]);
    S.anchorChoice = chooseAnchor(puzzle.grid, puzzle.words);
    applyBoard(puzzle.grid, S.anchorChoice, S.assistMode, true);
    updateHeader();
  }

  // Dev / Shift+N: fresh RANDOM puzzle (not seeded).
  function loadRandomPuzzle() {
    rng = Math.random;
    const puzzle = generatePuzzle();
    if (!puzzle) { console.error('Generator failed.'); return; }
    S.words = puzzle.words;
    S.pristineGrid = puzzle.grid.map((r) => [...r]);
    S.anchorChoice = chooseAnchor(puzzle.grid, puzzle.words);
    applyBoard(puzzle.grid, S.anchorChoice, S.assistMode, true);
    updateHeader();
  }

  function applyModeAnchor(newAssist) {
    if (!S.pristineGrid) return;
    S.assistMode = newAssist;
    applyBoard(S.pristineGrid, S.anchorChoice, newAssist, false);
    saveMode(newAssist);
    updateModeUI();
  }

  /* ---- 7. rendering ------------------------------------------------------- */
  const el = (id) => document.getElementById(id);

  // Ghost map: laneKey origin cells -> letter, so the grid shows where a placed
  // tile came from. Keyed "row-col".
  function ghostMap() {
    const m = new Map();
    for (const [laneKey, origin] of S.moved.entries()) {
      const [lane, idxStr] = laneKey.split('-');
      const idx = parseInt(idxStr, 10);
      const letter = S.lanes[lane][idx];
      if (letter) m.set(origin, letter);
    }
    return m;
  }

  function laneConfirmed(lane) {
    if (!S.words) return false;
    const target = { top: S.words.topWord, left: S.words.leftWord, bottom: S.words.bottomWord, right: S.words.rightWord }[lane];
    return S.lanes[lane].join('') === target;
  }

  function tileHTML(letter, opts) {
    // opts: { cls, style, draggable, data }
    const d = opts.data || {};
    const dataAttr = Object.keys(d).map((k) => `data-${k}="${d[k]}"`).join(' ');
    return `<div class="${opts.cls}" style="${opts.style || ''}" ${opts.draggable ? 'draggable="true"' : ''} ${dataAttr}>${letter}</div>`;
  }

  function render() {
    renderLane('top');
    renderLane('left');
    renderLane('right');
    renderLane('bottom');
    renderGrid();
    renderScore();
  }

  function laneSlotStyle(laneKey, filled, confirmed, isAnchor) {
    const c = LANE[laneKey];
    const bg = filled ? 'var(--ivory)' : c.soft;
    const border = (confirmed || isAnchor) ? `3px solid ${c.deep}`
      : filled ? `2px solid ${c.mid}` : `2px solid rgba(22,20,31,0.13)`;
    const shadow = filled ? 'box-shadow:0 2px 4px rgba(22,20,31,0.28);' : '';
    const cursor = isAnchor ? 'cursor:default;' : '';
    return `background:${bg};color:var(--ink);border-radius:4px;border:${border};${shadow}${cursor}`;
  }

  function renderLane(lane) {
    const container = el('lane-' + lane);
    const confirmed = laneConfirmed(lane);
    let html = '';
    for (let i = 0; i < 6; i++) {
      const letter = S.lanes[lane][i];
      const isAnchor = S.anchorKey === `${lane}-${i}`;
      const style = laneSlotStyle(lane, !!letter, confirmed, isAnchor);
      const inner = letter
        ? `<div class="lane-letter" ${isAnchor ? '' : 'draggable="true"'} data-src="${lane}" data-idx="${i}" style="${isAnchor ? 'cursor:default' : 'cursor:grab'}">${letter}</div>`
        : '';
      html += `<div class="slot" data-lane="${lane}" data-idx="${i}" style="${style}">${inner}</div>`;
    }
    container.innerHTML = html;
  }

  function renderGrid() {
    const container = el('grid');
    const ghosts = ghostMap();
    let html = '';
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        const cell = S.grid[r][c];
        const key = `${r}-${c}`;
        const ghost = ghosts.get(key);
        const isHi = S.highlight && S.highlight.row === r && S.highlight.col === c;
        if (cell) {
          const hiColor = isHi ? LANE[dirToLane(S.highlight.dir)].mid : null;
          const shadow = hiColor ? `box-shadow:0 0 0 4px ${hiColor};` : 'box-shadow:0 2px 4px rgba(22,20,31,0.28);';
          const pulse = isHi ? 'grid-pulse' : '';
          html += `<div class="cell" data-row="${r}" data-col="${c}">
            <div class="grid-tile ${pulse}" draggable="true" data-row="${r}" data-col="${c}"
              style="background:var(--ivory);color:var(--ink);font-family:var(--font-mark);border:1px solid rgba(22,20,31,0.13);${shadow}">${cell}</div>
          </div>`;
        } else if (ghost) {
          html += `<div class="cell" data-row="${r}" data-col="${c}">
            <div class="ghost">${ghost}</div>
          </div>`;
        } else {
          html += `<div class="cell empty" data-row="${r}" data-col="${c}"></div>`;
        }
      }
    }
    container.innerHTML = html;
  }

  function dirToLane(dir) {
    return { blue: 'top', green: 'left', orange: 'bottom', pink: 'right' }[dir];
  }

  function renderScore() {
    el('score-value').textContent = S.score;
    updateModeUI();
  }

  function updateModeUI() {
    // middle slot: Hint (Possible) or "no hints" banner (Unimpossible)
    const mid = el('middle-slot');
    if (S.assistMode) {
      const disabled = S.hintsUsed >= MAX_HINTS;
      mid.innerHTML = `
        <div class="hint-row">
          <button id="hint-btn" class="btn-hint rise ${disabled ? 'is-disabled' : ''}" ${disabled ? 'disabled' : ''}>
            <span class="bulb">&#128161;</span> Hint
          </button>
          <span class="hint-note">(${MAX_HINTS - S.hintsUsed} left) uses 1 move each</span>
        </div>`;
      if (!disabled) el('hint-btn').addEventListener('click', giveHint);
    } else {
      mid.innerHTML = `<div class="hardest-banner">&#128293; Unimpossible — no hints</div>`;
    }
    // toggle active states
    el('mode-possible').classList.toggle('active', S.assistMode);
    el('mode-unimpossible').classList.toggle('active', !S.assistMode);
    const lock = el('mode-lock');
    if (lock) lock.style.display = gameStarted() ? 'inline' : 'none';
    el('mode-possible').disabled = gameStarted();
    el('mode-unimpossible').disabled = gameStarted();
    el('toggle-wrap').classList.toggle('locked', gameStarted());
  }

  function updateHeader() {
    el('puzzle-number').textContent = S.puzzleNumber;
  }

  /* ---- 8. drag & drop ----------------------------------------------------- */
  function onDragStart(e) {
    const gt = e.target.closest('.grid-tile');
    const ll = e.target.closest('.lane-letter');
    if (gt) {
      const row = +gt.dataset.row, col = +gt.dataset.col;
      S.dragged = { source: 'grid', letter: S.grid[row][col], row, col };
      e.dataTransfer.setData('text/plain', 'grid');
      // clear hint if this is the hinted tile
      if (S.highlight && S.highlight.row === row && S.highlight.col === col) {
        S.highlight = null; renderGrid();
      }
    } else if (ll) {
      const src = ll.dataset.src, idx = +ll.dataset.idx;
      if (S.anchorKey === `${src}-${idx}`) { e.preventDefault(); return; } // locked anchor
      S.dragged = { source: src, letter: S.lanes[src][idx], index: idx };
      e.dataTransfer.setData('text/plain', 'lane');
    }
  }

  function allowDrop(e) { e.preventDefault(); }

  function onDropLane(e, lane, idx) {
    e.preventDefault();
    const d = S.dragged; if (!d) return;
    // tile must belong to this lane's line: top/bottom => col must equal idx;
    // left/right => row must equal idx. Enforced by origin.
    if (d.source === 'grid') {
      const okCol = (lane === 'top' || lane === 'bottom') && d.col === idx;
      const okRow = (lane === 'left' || lane === 'right') && d.row === idx;
      if (!okCol && !okRow) return;
      if (S.lanes[lane][idx]) return; // slot occupied
      // place
      S.lanes[lane][idx] = d.letter;
      S.grid[d.row][d.col] = '';
      S.moved.set(`${lane}-${idx}`, `${d.row}-${d.col}`);
      registerMove();
    }
    S.dragged = null;
    checkWin();
    render();
  }

  function onDropGrid(e, row, col) {
    e.preventDefault();
    const d = S.dragged; if (!d) return;
    if (d.source === 'grid') { S.dragged = null; return; }
    // returning a lane tile to its ORIGINAL cell only
    const laneKey = `${d.source}-${d.index}`;
    const origin = S.moved.get(laneKey);
    if (!origin) { S.dragged = null; return; }
    if (origin !== `${row}-${col}`) { S.dragged = null; return; } // must be home cell
    if (S.grid[row][col] !== '') { S.dragged = null; return; }
    S.grid[row][col] = d.letter;
    S.lanes[d.source][d.index] = '';
    S.moved.delete(laneKey);
    registerMove();
    S.dragged = null;
    render();
  }

  /* ---- 9. moves, win/loss, hints ----------------------------------------- */
  function registerMove() {
    S.moveCount++;
    S.score = Math.max(0, S.score - 1);
    if (S.score <= 0 && !S.hasWon) triggerLoss();
  }

  function checkWin() {
    if (!S.words) return;
    if (laneConfirmed('top') && laneConfirmed('left') && laneConfirmed('bottom') && laneConfirmed('right')) {
      S.hasWon = true;
      recordStat(true);
      showWinModal();
    }
  }

  function triggerLoss() {
    S.hasLost = true;
    recordStat(false);
    showLossModal();
  }

  function giveHint() {
    if (!S.assistMode || S.hintsUsed >= MAX_HINTS) return;
    // find a correct tile still in the grid that isn't yet placed
    const candidates = [];
    const check = (lane, letters, isCol) => {
      for (let i = 0; i < 6; i++) {
        if (S.lanes[lane][i]) continue; // already placed
        const target = letters[i];
        for (let k = 0; k < 6; k++) {
          const r = isCol ? k : i, c = isCol ? i : k;
          if (S.grid[r][c] === target) {
            candidates.push({ row: r, col: c, dir: LANE[lane].dir });
          }
        }
      }
    };
    check('top', S.words.topWord.split(''), true);
    check('bottom', S.words.bottomWord.split(''), true);
    check('left', S.words.leftWord.split(''), false);
    check('right', S.words.rightWord.split(''), false);
    if (!candidates.length) return;
    S.highlight = candidates[Math.floor(Math.random() * candidates.length)];
    S.hintsUsed++;
    S.score = Math.max(0, S.score - 1);
    if (S.score <= 0 && !S.hasWon) triggerLoss();
    render();
  }

  /* ---- 10. modals --------------------------------------------------------- */
  let activeModal = null;

  function openModal(name) { activeModal = name; renderModal(); }
  function closeModal() { activeModal = null; renderModal(); }

  function renderModal() {
    const overlay = el('modal-overlay');
    if (!activeModal) { overlay.style.display = 'none'; overlay.innerHTML = ''; return; }
    overlay.style.display = 'flex';
    let body = '';
    if (activeModal === 'help') body = helpBody();
    else if (activeModal === 'about') body = aboutBody();
    else if (activeModal === 'stats') body = statsBody();
    else if (activeModal === 'share') body = shareBody();
    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <button class="modal-x rise" id="modal-x" aria-label="Close">&times;</button>
        ${body}
        <div class="modal-foot"><button class="btn-gotit rise" id="modal-gotit">Got it</button></div>
      </div>`;
    el('modal-x').addEventListener('click', closeModal);
    el('modal-gotit').addEventListener('click', closeModal);
    if (activeModal === 'share') el('copy-btn').addEventListener('click', copyShare);
  }

  function helpBody() {
    return `
      <h2 class="modal-title">How to play</h2>
      <p>Drag the scattered letters UP (blue), LEFT (green), DOWN (orange), or RIGHT (pink) to form today's four words. Letters only move along their own row or column, and can be dragged back to their original grid cell. The grid is packed with decoy letters that look correct but belong to none of the target words. <strong>Discover all four words to win.</strong></p>
      <p>You start with 100 moves. Every move costs one — placing a letter, returning it to the grid, or using a hint. Your <strong>remaining moves are your score</strong>: solve it in as few as you can, and don't hit zero.</p>
      <p><strong class="g">Getting started:</strong> look at a colored lane, pick a slot, and find the one tile in that row or column that fits — then check whether it also works for the crossing word. That cross-check is the whole game.</p>
      <p><strong class="g">Possible</strong> — 5 hints and one free starting letter, and each word lights up once it's correct.</p>
      <p><strong class="c">&#128293; Unimpossible</strong> — no hints, no free letter, no confirmation. Pure deduction. This is the default.</p>
      <p><strong class="g">The free letter:</strong> in Possible mode, one correct letter is already locked into its lane to give you a foothold — a way in, so the board isn't a cold start. It's free and doesn't cost a move.</p>
      <p><strong>The words:</strong> everyday words, including some slang. No proper nouns, no swears, no obscure jargon.</p>
      <p class="muted">Pick your mode before your first move; it locks once you start. New puzzle every day at midnight.</p>`;
  }

  function aboutBody() {
    return `
      <h2 class="wordmark-sm"><span class="c">unim</span><span class="bone">possible</span></h2>
      <p class="muted"><span class="strike">unwinnable</span>, but not really.</p>
      <p>A daily word puzzle for people who like it hard. Four words hide around the edges of one shared grid, tangled together and buried in decoys. Slide the right letters to their lanes and solve all four.</p>
      <p>The name is a wink: <em>un-im-possible</em> — two negatives that cancel out. It looks unwinnable. It isn't. <strong>Probably the hardest word puzzle in the whole wide world.</strong></p>
      <p class="muted">Which Way To Words? &nbsp;<strong>#WW2W</strong></p>
      <div class="contact">
        <div class="contact-label">Contact &amp; bug reports</div>
        <img src="images/email-designasaur.png" alt="contact email" class="email-img">
      </div>
      <p class="muted small">&copy; 2025 Joel Pickard. All rights reserved.</p>`;
  }

  function statsBody() {
    const st = loadStats();
    return `
      <h2 class="modal-title">Your stats</h2>
      <div class="stats-grid">
        <div class="stat"><div class="stat-num">${st.played}</div><div class="stat-lbl">Played</div></div>
        <div class="stat"><div class="stat-num">${st.won}</div><div class="stat-lbl">Won</div></div>
        <div class="stat"><div class="stat-num">${st.streak}</div><div class="stat-lbl">Streak</div></div>
        <div class="stat"><div class="stat-num">${st.bestStreak}</div><div class="stat-lbl">Best streak</div></div>
        <div class="stat"><div class="stat-num">${st.best === null ? '—' : st.best}</div><div class="stat-lbl">Best score</div></div>
      </div>
      <p class="muted small">Stats are saved on this device only.</p>`;
  }

  function shareBody() {
    const text = buildShareText();
    return `
      <h2 class="modal-title">Share your result</h2>
      <div class="share-preview">${text.replace(/\n/g, '<br>')}</div>
      <div class="share-actions"><button id="copy-btn" class="btn-copy rise">&#128203; Copy result</button></div>
      <p class="muted small">Paste it anywhere — text, chat, or your favorite app.</p>`;
  }

  /* ---- share -------------------------------------------------------------- */
  function buildShareText() {
    const hintsEmoji = S.hintsUsed === 0 ? '\u2B50' : '\uD83D\uDCA1'.repeat(Math.min(S.hintsUsed, 5));
    const scoreEmoji = S.score >= 90 ? '\uD83C\uDFC6' : S.score >= 70 ? '\uD83E\uDD48' : S.score >= 50 ? '\uD83E\uDD49' : S.hasWon ? '\u2705' : '\u274C';
    const badge = S.assistMode ? '' : ' \uD83D\uDD25';
    let line;
    if (S.hasWon) line = `${S.score}/100 ${scoreEmoji}\nHints: ${S.hintsUsed}/5 ${hintsEmoji}`;
    else if (S.hasLost) line = `DNF ${scoreEmoji}\nHints: ${S.hintsUsed}/5 ${hintsEmoji}`;
    else line = `${S.score}/100 so far\nHints: ${S.hintsUsed}/5 ${hintsEmoji}`;
    return `Unimpossible #${S.puzzleNumber}${badge}\n${line}\n\nunimpossible.game`;
  }

  function shareResult() {
    const text = buildShareText();
    // Native share sheet only on real touch/mobile devices — on desktop it
    // triggers the clunky OS panel (e.g. Windows "add contacts"), so there we
    // always use our own clean copy modal instead.
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
      && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);
    if (isMobile && navigator.share) {
      navigator.share({ title: 'Unimpossible - Daily Word Puzzle', text }).catch(() => openModal('share'));
    } else {
      openModal('share');
    }
  }

  function copyShare() {
    const text = buildShareText();
    const btn = el('copy-btn');
    if (btn) { btn.textContent = '\u2713 Copied!'; btn.classList.add('copied'); setTimeout(() => { btn.innerHTML = '\uD83D\uDCCB Copy result'; btn.classList.remove('copied'); }, 2000); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
    } else { legacyCopy(text); }
  }
  function legacyCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    } catch (e) { /* feedback already shown */ }
  }

  /* ---- win/loss modals ---------------------------------------------------- */
  function showWinModal() {
    const badge = S.assistMode ? `Hints Used: ${S.hintsUsed}/5 ${S.hintsUsed === 0 ? '\u2B50' : ''}` : '\uD83D\uDD25 Solved in Unimpossible Mode \uD83C\uDFC6';
    el('endgame').style.display = 'flex';
    el('endgame').innerHTML = `
      <div class="modal win">
        <button class="modal-x rise" id="win-x" aria-label="Close">&times;</button>
        <div class="big-emoji">\uD83C\uDF89</div>
        <div class="win-title"><span class="c">unim</span>possible — solved</div>
        <div class="muted">Daily Puzzle #${S.puzzleNumber}</div>
        <div class="final">Final Score: <span class="c big">${S.score}</span></div>
        <div class="muted">${badge}</div>
        <div class="modal-foot"><button class="btn-share rise" id="win-share">Share Result</button></div>
        <div class="muted small">Come back tomorrow for a new puzzle!</div>
      </div>`;
    el('win-x').addEventListener('click', () => { el('endgame').style.display = 'none'; });
    el('win-share').addEventListener('click', shareResult);
  }

  function showLossModal() {
    el('endgame').style.display = 'flex';
    el('endgame').innerHTML = `
      <div class="modal loss">
        <div class="big-emoji">\uD83D\uDE14</div>
        <div class="win-title">Out of Moves</div>
        <div class="muted">Unwinnable this time — but not really. Try again tomorrow.</div>
        <div class="answer">
          <div style="color:${LANE.top.soft}">&uarr; ${S.words.topWord}</div>
          <div style="color:${LANE.left.soft}">&larr; ${S.words.leftWord}</div>
          <div style="color:${LANE.bottom.soft}">&darr; ${S.words.bottomWord}</div>
          <div style="color:${LANE.right.soft}">&rarr; ${S.words.rightWord}</div>
        </div>
        <div class="modal-foot"><button class="btn-share rise" id="loss-share">Share Result</button></div>
        <div class="muted small">Come back tomorrow for a new puzzle!</div>`;
    el('loss-share').addEventListener('click', shareResult);
  }

  /* ---- 11. stats + prefs (localStorage) ---------------------------------- */
  const LS = {
    mode: 'unimpossible.mode',
    stats: 'unimpossible.stats',
    lastPlayed: 'unimpossible.lastPlayedDay',
  };
  function saveMode(assist) { try { localStorage.setItem(LS.mode, assist ? 'possible' : 'unimpossible'); } catch (e) {} }
  function loadMode() {
    try { const v = localStorage.getItem(LS.mode); if (v === 'possible') return true; if (v === 'unimpossible') return false; } catch (e) {}
    return false; // first-run default: Unimpossible
  }
  function loadStats() {
    try { const s = JSON.parse(localStorage.getItem(LS.stats)); if (s) return s; } catch (e) {}
    return { played: 0, won: 0, streak: 0, bestStreak: 0, best: null };
  }
  function recordStat(won) {
    // only record once per day
    let last;
    try { last = localStorage.getItem(LS.lastPlayed); } catch (e) {}
    if (last === S.dayKey) return;
    const st = loadStats();
    st.played++;
    if (won) {
      st.won++;
      st.streak++;
      if (st.streak > st.bestStreak) st.bestStreak = st.streak;
      if (st.best === null || S.score > st.best) st.best = S.score;
    } else {
      st.streak = 0;
    }
    try {
      localStorage.setItem(LS.stats, JSON.stringify(st));
      localStorage.setItem(LS.lastPlayed, S.dayKey);
    } catch (e) {}
  }

  /* ---- 12. boot + daily rollover ----------------------------------------- */
  function wireStaticButtons() {
    el('mode-possible').addEventListener('click', () => { if (!gameStarted()) applyModeAnchor(true); });
    el('mode-unimpossible').addEventListener('click', () => { if (!gameStarted()) applyModeAnchor(false); });
    el('help-pill').addEventListener('click', () => openModal('help'));
    el('foot-share').addEventListener('click', shareResult);
    el('foot-stats').addEventListener('click', () => openModal('stats'));
    el('foot-about').addEventListener('click', () => openModal('about'));
    el('foot-help').addEventListener('click', () => openModal('help'));
    el('panel-share').addEventListener('click', shareResult);

    // delegated drag/drop
    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('dragover', (e) => {
      if (e.target.closest('.slot') || e.target.closest('.cell')) allowDrop(e);
    });
    document.addEventListener('drop', (e) => {
      const slot = e.target.closest('.slot');
      const cell = e.target.closest('.cell');
      if (slot) onDropLane(e, slot.dataset.lane, +slot.dataset.idx);
      else if (cell) onDropGrid(e, +cell.dataset.row, +cell.dataset.col);
    });

    // Escape closes modals; Shift+N loads a fresh random puzzle.
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (e.key === 'Escape') { if (activeModal) closeModal(); if (el('endgame').style.display === 'flex') el('endgame').style.display = 'none'; return; }
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (activeModal) return;
      if (e.shiftKey && (e.key === 'N' || e.key === 'n')) { e.preventDefault(); loadRandomPuzzle(); }
    });

    // click-off to close footer modals
    el('modal-overlay').addEventListener('click', (e) => { if (e.target === el('modal-overlay')) closeModal(); });
    el('endgame').addEventListener('click', (e) => { if (e.target === el('endgame')) el('endgame').style.display = 'none'; });
  }

  // Daily rollover: check periodically; only reload on a genuine day change AND
  // when no game is in progress. Single getTodayKey() source prevents the
  // Directionary reload loop.
  function startRolloverWatch() {
    setInterval(() => {
      const today = getTodayKey();
      if (today !== S.dayKey && !gameStarted() && !S.hasWon && !S.hasLost) {
        loadDailyPuzzle();
      }
    }, 30000);
  }

  async function boot() {
    // load word bank
    try {
      const res = await fetch('game/words.json');
      const data = await res.json();
      WORD_BANK = data.words;
    } catch (e) {
      console.error('Could not load words.json', e);
      el('grid').innerHTML = '<div style="color:var(--bone);padding:20px">Could not load word list.</div>';
      return;
    }
    S.assistMode = loadMode();       // returning player's saved mode, else Unimpossible
    wireStaticButtons();
    loadDailyPuzzle();
    startRolloverWatch();
  }

  document.addEventListener('DOMContentLoaded', boot);

  // Minimal dev bridge (optional; remove dev.js + the dev panel for production).
  window.UNIMP_DEV = {
    loadRandom: loadRandomPuzzle,
    generate: generatePuzzle,
    isTrapFree: isTrapFree,
    validateWinnable: validateWinnable,
  };
})();
