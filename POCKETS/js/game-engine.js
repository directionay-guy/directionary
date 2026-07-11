// POCKETS GAME ENGINE
// Variable rounds — Finale triggers when a player crosses 100pts
//
// DEV NOTE — to future Claude:
// Do NOT compress or minify this file. Do NOT chain ternaries.
// Do NOT use forEach for multi-step logic. Do NOT combine declarations.
// Write one statement per line. This file has repeatedly broken when
// "optimized" for brevity. Readability = reliability here.

let gameMode = '2player';
let aiDifficulty = 'easy';
let aiThinking = false;

let gameState = {
    round: 1,
    currentPlayer: 'blue',
    phase: 'rolling',
    firstPlayer: null,
    blueDice: [],
    redDice: [],
    blueOriginalRoll: [],
    redOriginalRoll: [],
    blueSavedDie: null,
    redSavedDie: null,
    blueScore: 0,
    redScore: 0,
    selectedDie: null,
    diceToPlace: 8,
    placementTurn: 0,
    roundScores: { blue: {}, red: {} },
    blueRolled: false,
    redRolled: false,
    blueFinalRolled: false,
    redFinalRolled: false,
    finaleMode: false,
    finaleRolls: { blue: [], red: [] },
    finaleCurrentPlayer: 'blue',
    rolloffInProgress: false,
    humanColor: 'blue'
};

// =============================================================================
// SVG DIE FACTORY
// =============================================================================

function createDieSVG(value, id, isSaved) {
    if (isSaved === undefined) { isSaved = false; }

    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "44");
    svg.setAttribute("height", "44");
    svg.setAttribute("viewBox", "0 0 60 60");
    svg.classList.add("dice");
    if (isSaved) { svg.classList.add("saved-tint"); }
    svg.setAttribute("data-value", value);
    svg.setAttribute("data-id", id);

    var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("class", "dice-face");
    rect.setAttribute("x", "5");
    rect.setAttribute("y", "5");
    rect.setAttribute("width", "50");
    rect.setAttribute("height", "50");
    svg.appendChild(rect);

    var dotPositions = {
        1: [[30, 30]],
        2: [[20, 20], [40, 40]],
        3: [[20, 20], [30, 30], [40, 40]],
        4: [[20, 20], [40, 20], [20, 40], [40, 40]],
        5: [[20, 20], [40, 20], [30, 30], [20, 40], [40, 40]],
        6: [[20, 17], [40, 17], [20, 30], [40, 30], [20, 43], [40, 43]]
    };

    var positions = dotPositions[value];
    for (var i = 0; i < positions.length; i++) {
        var cx = positions[i][0];
        var cy = positions[i][1];
        var dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("class", "dice-dot");
        dot.setAttribute("cx", cx);
        dot.setAttribute("cy", cy);
        dot.setAttribute("r", "4");
        svg.appendChild(dot);
    }

    return svg;
}

// =============================================================================
// PIP REFRESHER — updates pip layout on an existing die SVG in place.
// Used by the roll animation to cycle random pip counts while the die spins.
// =============================================================================

function refreshDiePips(svgEl, value) {
    var dotPositions = {
        1: [[30, 30]],
        2: [[20, 20], [40, 40]],
        3: [[20, 20], [30, 30], [40, 40]],
        4: [[20, 20], [40, 20], [20, 40], [40, 40]],
        5: [[20, 20], [40, 20], [30, 30], [20, 40], [40, 40]],
        6: [[20, 17], [40, 17], [20, 30], [40, 30], [20, 43], [40, 43]]
    };
    var existing = svgEl.querySelectorAll('.dice-dot');
    for (var i = existing.length - 1; i >= 0; i--) {
        existing[i].parentNode.removeChild(existing[i]);
    }
    var positions = dotPositions[value] || dotPositions[1];
    for (var j = 0; j < positions.length; j++) {
        var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('class', 'dice-dot');
        dot.setAttribute('cx', positions[j][0]);
        dot.setAttribute('cy', positions[j][1]);
        dot.setAttribute('r', '4');
        svgEl.appendChild(dot);
    }
}

// =============================================================================
// SETTINGS PERSISTENCE — first-time visitors default to AI/Medium/Blue (an
// approachable but real opponent, for someone with no partner physically
// present). Returning players always resume whatever they last used.
// =============================================================================

var POCKETS_SETTINGS_KEY = 'pocketsSettings';

function savePocketsSettings() {
    try {
        localStorage.setItem(POCKETS_SETTINGS_KEY, JSON.stringify({
            mode:       gameMode,
            difficulty: (typeof aiDifficulty !== 'undefined') ? aiDifficulty : 'medium',
            color:      gameState.humanColor || 'blue'
        }));
    } catch (e) { /* localStorage unavailable - settings just won't persist, not fatal */ }
}

function loadPocketsSettings() {
    try {
        var raw = localStorage.getItem(POCKETS_SETTINGS_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function applyDefaultOrSavedSettings() {
    var saved = loadPocketsSettings();
    if (saved && saved.mode) {
        setGameMode(saved.mode);
        if (saved.mode === 'ai') {
            if (saved.difficulty) { setAIDifficulty(saved.difficulty); }
            if (saved.color)      { setPlayerColor(saved.color); }
        }
    } else {
        // First-time visitor - no saved settings on record at all.
        setGameMode('ai');
        setAIDifficulty('medium');
        setPlayerColor('blue');
    }
}

function isGameInProgress() {
    return gameState.phase !== 'setup' && gameState.round > 0;
}

// Used for both desktop buttons and the Compact dropdown, so mode-switching
// behaves identically everywhere: confirm + reset when there's real progress
// to lose, apply immediately when there's nothing at stake yet. selectEl is
// optional - pass it for <select> elements so a cancelled change reverts the
// dropdown's displayed value (native selects update visually before any JS
// confirm can intervene).
function showSettingsChangeModal(onConfirm, onCancel) {
    showConfirm(
        'Settings locked during game',
        'Mode, difficulty and color can only change between games.',
        function() { newGame(); if (onConfirm) { onConfirm(); } },
        onCancel,
        'New Game',
        'Cancel'
    );
}

function changeModeWithConfirm(newMode, selectEl) {
    if (gameMode === newMode) { return; }
    var previousMode = gameMode;
    if (isGameInProgress()) {
        showSettingsChangeModal(
            function() { setGameMode(newMode); },
            function() { if (selectEl) { selectEl.value = previousMode; } }
        );
    } else {
        setGameMode(newMode);
    }
}

function changeColorWithConfirm(newColor, selectEl) {
    if (gameState.humanColor === newColor) { return; }
    var previousColor = gameState.humanColor;
    if (isGameInProgress()) {
        showSettingsChangeModal(
            function() { setPlayerColor(newColor); },
            function() { if (selectEl) { selectEl.value = previousColor; } }
        );
    } else {
        setPlayerColor(newColor);
    }
}

function syncCompactAIControlsVisibility() {
    var isAI = (gameMode === 'ai');
    ['cDiff','cPlay'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) { el.style.setProperty('display', isAI ? 'inline-block' : 'none', 'important'); }
    });
    ['cDiffLabel','cPlayLabel'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) { el.style.setProperty('display', isAI ? 'inline' : 'none', 'important'); }
    });
}

function syncUniversalAIControlsVisibility() {
    var isAI = (gameMode === 'ai');
    ['uDiff','uPlay'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) { el.style.setProperty('display', isAI ? 'inline-block' : 'none', 'important'); }
    });
    ['uDiffLabel','uPlayLabel'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) { el.style.setProperty('display', isAI ? 'inline' : 'none', 'important'); }
    });
}

// =============================================================================
// IN-PROGRESS GAME PERSISTENCE — never lose progress on a reload or coming
// back after time away. The ONLY way to discard a saved game is the explicit
// New Game button (handled in newGame() itself). No "resume?" prompt - the
// game silently picks up exactly where it was, since asking still carries a
// real risk of an accidental decline losing real progress.
// =============================================================================

var POCKETS_SAVED_GAME_KEY = 'pocketsSavedGame';
var gameWasRestoredOnLoad  = false;

// Snapshot of what's actually placed in each pocket right now, for both
// players. gameState itself has no clean record of board placement - it only
// lives in the live DOM - so this reads the real source of truth at save time
// rather than trying to track it as a parallel structure that could drift.
function captureBoardPlacements() {
    return { blue: getDiceFromPockets('blue'), red: getDiceFromPockets('red') };
}

function autosaveGame() {
    try {
        localStorage.setItem(POCKETS_SAVED_GAME_KEY, JSON.stringify({
            gameState:  gameState,
            gameMode:   gameMode,
            difficulty: (typeof aiDifficulty !== 'undefined') ? aiDifficulty : 'medium',
            rolloffState: (typeof rolloffState !== 'undefined') ? rolloffState : null,
            board: captureBoardPlacements()
        }));
    } catch (e) { /* localStorage unavailable - not fatal, just won't persist */ }
}

function loadSavedGame() {
    try {
        var raw = localStorage.getItem(POCKETS_SAVED_GAME_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function clearSavedGame() {
    try { localStorage.removeItem(POCKETS_SAVED_GAME_KEY); } catch (e) { /* not fatal */ }
}

// Places a die into a pocket purely visually, for reconstructing a saved
// board. Deliberately does NOT go through placeDieInPocket()'s game-logic
// side effects (decrementing diceToPlace, advancing placementTurn, checking
// round-completion, cloning pockets to strip listeners) - gameState is being
// restored directly from the save already, so re-deriving any of that here
// would double-count it.
function restorePocketDie(pocketEl, value, isSaved) {
    if (!pocketEl) { return; }
    var pocketDice = pocketEl.querySelector('.pocket-dice');
    if (!pocketDice) { return; }
    var die = createDieSVG(value, pocketEl.id + '-restored-' + Date.now(), !!isSaved);
    die.style.width  = '40px';
    die.style.height = '40px';
    pocketDice.appendChild(die);
}

function restoreBoardPlacements(board) {
    if (!board) { return; }
    ['blue', 'red'].forEach(function(color) {
        var placed = board[color];
        if (!placed) { return; }
        var savedDie = (color === 'blue') ? gameState.blueSavedDie : gameState.redSavedDie;
        ['keep1', 'keep2', 'take', 'save'].forEach(function(pocketKey) {
            if (!placed[pocketKey] || placed[pocketKey].length === 0) { return; }
            var value = placed[pocketKey][0];
            var pocketIdSuffix = pocketKey.charAt(0).toUpperCase() + pocketKey.slice(1);
            var pocketEl = document.getElementById(color + pocketIdSuffix);
            var isSaved  = (pocketKey === 'save' && savedDie === value);
            restorePocketDie(pocketEl, value, isSaved);
        });
    });
}

// Rebuilds the Rolldown (Finale) screen after a reload, from saved gameState.
// Mirrors startFinale()'s visual setup, but uses the dice ALREADY rolled this
// Finale (gameState.finaleRolls) instead of resetting them, so play resumes
// exactly where it left off. Without this, a reload during Rolldown fell
// through to a dead Start Round button and the game became unwinnable.
function restoreFinaleState() {
    document.getElementById('startFinale').classList.add('hidden');
    document.getElementById('startRound').classList.add('hidden');
    document.getElementById('currentRound').textContent = 'Rolldown';
    var suffix = document.getElementById('roundSuffix');
    if (suffix) { suffix.classList.add('hidden'); }
    hidePanelBottom(true);

    // Hide Keep/Take pockets, show the Finale pockets (same as startFinale)
    var keepTake = document.querySelectorAll(
        '.pocket[data-pocket="keep1"], .pocket[data-pocket="keep2"], .pocket[data-pocket="take"]'
    );
    keepTake.forEach(function(p) { p.classList.add('finale-hidden'); });
    document.getElementById('blueFinale').classList.remove('hidden');
    document.getElementById('redFinale').classList.remove('hidden');
    document.getElementById('blueFinaleBonus').textContent = '';
    document.getElementById('redFinaleBonus').textContent  = '';

    // Rebuild each roll bar: solid dice for rolls already made, dimmed
    // placeholders for the rolls still to come, and the running total
    // (saved die + rolls so far) — matching what rollFinale() shows live.
    ['blue', 'red'].forEach(function(color) {
        var area  = document.getElementById(color + 'DiceArea');
        area.innerHTML = '';
        var rolls = (gameState.finaleRolls && gameState.finaleRolls[color]) ? gameState.finaleRolls[color] : [];
        for (var i = 0; i < rolls.length; i++) {
            area.appendChild(createDieSVG(rolls[i], color + '-finale-' + i, false));
        }
        for (var j = rolls.length; j < 4; j++) {
            var dim = createDieSVG(1, color + '-finale-dim-' + j, false);
            dim.classList.add('dimmed-die');
            area.appendChild(dim);
        }
        var savedDie = (color === 'blue') ? (gameState.blueSavedDie || 0) : (gameState.redSavedDie || 0);
        var rollSum  = rolls.reduce(function(a, b) { return a + b; }, 0);
        document.getElementById(color + 'FinaleTotal').textContent = savedDie + rollSum;
    });

    setActionPanelView('rolls');

    var blueDone = (gameState.finaleRolls.blue.length >= 4);
    var redDone  = (gameState.finaleRolls.red.length  >= 4);

    // If both players had already finished all four rolls when the reload hit,
    // the only step left was to tally — do it now. finalizeFinale() adds the
    // Finale points to the scores exactly once (they aren't added until it
    // runs), so this can't double-count.
    if (blueDone && redDone) {
        finalizeFinale();
        return;
    }

    updateFinaleUI();

    // If it's the AI's turn to roll, resume its automatic rolling.
    if (gameMode === 'ai' && gameState.finaleCurrentPlayer === 'red' && !redDone) {
        setTimeout(function() { rollFinale('red'); }, 900);
    }
}

// Restores everything: data (gameState itself, mode, difficulty, rolloff
// state) AND the visual board (placed dice, unplaced dice still waiting to be
// placed, and whichever action-panel view matches where the game actually
// was). Mid-Finale visual state is intentionally not frame-perfectly
// reconstructed here (see session notes) - the underlying scores/data are
// still fully preserved either way, nothing is lost.
function restoreGameFromSave(saved) {
    gameWasRestoredOnLoad = true;
    gameState = saved.gameState;
    gameMode  = saved.gameMode;
    if (typeof rolloffState !== 'undefined' && saved.rolloffState) {
        rolloffState = saved.rolloffState;
    }

    setGameMode(gameMode);
    if (gameMode === 'ai' && saved.difficulty) { setAIDifficulty(saved.difficulty); }
    setPlayerColor(gameState.humanColor || 'blue');

    restoreBoardPlacements(saved.board);

    // renderDiceWithAnimation() clears the tray itself even with zero dice -
    // always call it, regardless of how many are left to place. Skipping it
    // when the array was empty used to leave whatever was already in the DOM
    // untouched, which is exactly how stale/duplicate dice could linger.
    renderDiceWithAnimation('blue', gameState.blueDice || [], true);
    renderDiceWithAnimation('red',  gameState.redDice  || [], true);

    document.getElementById('currentRound').textContent = gameState.round;
    var startRoundBtn = document.getElementById('startRound');
    if (startRoundBtn) { startRoundBtn.textContent = 'Start Round ' + gameState.round; }

    if (gameState.phase === 'gameOver') {
        // Re-display the winner screen exactly as it was. endGame() is safe
        // to call again here - it's guarded against re-recording stats for
        // a game that already finished.
        endGame();
    } else if (gameState.phase === 'scoring') {
        // A reload during the brief "Round complete - calculating scores..."
        // window kills the pending 2-second timer that would have normally
        // advanced things automatically - it never fires again on its own.
        // Finish that transition right now instead of leaving the message
        // (and the old round's pockets) stuck forever.
        check100Trigger();
    } else if (gameState.phase === 'placing') {
        // Matches startPlacement()'s own setActionPanelView('status') call.
        setActionPanelView('status');
    } else if (gameState.phase === 'finale') {
        // Reload during the Rolldown/Finale. Previously there was NO branch for
        // this phase, so it fell through to a dead Start Round button and the
        // game became unwinnable. Rebuild the Finale screen from saved state
        // and resume exactly where it left off.
        restoreFinaleState();
    } else if (gameState.phase === 'rolling' && gameState.firstPlayer) {
        // Rolloff already resolved this round - show the roll-dice buttons,
        // correctly reflecting who's already rolled.
        setActionPanelView('rolls');
        // renderDiceWithAnimation above cleared both trays. The dull placeholder
        // dice are purely visual and aren't stored in the save, so without this
        // a reload in the post-rolloff / pre-roll window leaves the board
        // looking empty until Roll Dice is pressed. Repaint placeholders for any
        // player who hasn't rolled yet; a player who HAS rolled already had
        // their real dice re-rendered above, so leave that tray alone.
        if (!gameState.blueRolled) { showPlaceholderDiceForPlayer('blue'); }
        if (!gameState.redRolled)  { showPlaceholderDiceForPlayer('red'); }
        if (typeof brightenPlaceholderDice === 'function') { brightenPlaceholderDice(); }
        var blueRollBtn = document.getElementById('blueRoll');
        var redRollBtn  = document.getElementById('redRoll');
        // #blueRoll is ALWAYS the human; #redRoll is ALWAYS the AI in AI mode.
        if (blueRollBtn) {
            blueRollBtn.disabled = !!gameState.blueRolled;
            blueRollBtn.classList.remove('roll-prompt-pulse');
            blueRollBtn.classList.remove('hidden');
            blueRollBtn.textContent = gameState.blueRolled
                ? (colorEmoji('blue') + ' ' + colorLabel('blue') + ' Rolled')
                : (colorEmoji('blue') + ' ' + colorLabel('blue') + ' Roll Dice');
        }
        if (redRollBtn) {
            redRollBtn.disabled = !!gameState.redRolled;
            redRollBtn.classList.remove('roll-prompt-pulse');
            redRollBtn.classList.remove('hidden');
            if (gameMode === 'ai') {
                redRollBtn.textContent = gameState.redRolled ? '🤖 AI Rolled' : '🤖 AI Will Roll';
            } else {
                redRollBtn.textContent = gameState.redRolled
                    ? (colorEmoji('red') + ' ' + colorLabel('red') + ' Rolled')
                    : (colorEmoji('red') + ' ' + colorLabel('red') + ' Roll Dice');
            }
        }
        // Pulse the human's button, not the AI's (AI is always red)
        var pulseColor = (gameState.currentPlayer === 'blue' && !gameState.blueRolled) ? 'blue'
                        : (gameState.currentPlayer === 'red'  && !gameState.redRolled)  ? 'red' : null;
        if (pulseColor && !(gameMode === 'ai' && pulseColor === 'red')) {
            var pulseBtn = document.getElementById(pulseColor + 'Roll');
            if (pulseBtn) { pulseBtn.classList.add('roll-prompt-pulse'); }
        }
    } else if (gameState.phase === 'rolling' && !gameState.firstPlayer && gameState.rolloffInProgress) {
        // Reload landed in the middle of the first-player rolloff (including a
        // tie waiting for a re-tap). Re-present the rolloff cleanly so the round
        // continues in place instead of bouncing the player back to Start Round.
        // Re-tapping the rolloff die costs nothing — no score or placement is
        // lost at this point in the round.
        showPlaceholderDice();
        startFirstPlayerRolloff();
        gameState.rolloffInProgress = true;
    } else {
        // Genuinely between rounds — show the Start Round button.
        setActionPanelView('start');
    }

    updateScoreDisplay();
    updateGameStatus();
}

function setGameMode(mode) {
    gameMode = mode;
    document.querySelectorAll('.mode-btn').forEach(function(btn) {
        btn.classList.remove('active');
    });
    var playAsToggle = document.getElementById('playAsToggle');
    if (mode === '2player') {
        document.getElementById('twoPlayerMode').classList.add('active');
        document.getElementById('aiDifficulty').classList.add('hidden');
        if (playAsToggle) { playAsToggle.classList.add('hidden'); }
        setPlayerColor('blue');
    } else {
        document.getElementById('aiMode').classList.add('active');
        document.getElementById('aiDifficulty').classList.remove('hidden');
        if (playAsToggle) { playAsToggle.classList.remove('hidden'); }
        setPlayerColor(gameState.humanColor || 'blue');
    }
    var cModeEl = document.getElementById('cMode');
    if (cModeEl) { cModeEl.value = mode; }
    var uModeEl = document.getElementById('uMode');
    if (uModeEl) { uModeEl.value = mode; }
    syncCompactAIControlsVisibility();
    syncUniversalAIControlsVisibility();
    savePocketsSettings();
}

function setPlayerColor(color) {
    // AI is ALWAYS red internally — this is a visual/stats swap only
    gameState.humanColor = color;
    var container = document.querySelector('.game-container');
    if (container) {
        container.classList.toggle('playing-as-red', color === 'red');
    }

    // Roll dice buttons keep their natural classes: #blueRoll is always the
    // human (blue-btn), #redRoll is always the AI (red-btn). The visual color
    // swap for playing-as-red is handled entirely in CSS (.playing-as-red),
    // and the label swap by colorLabel/colorEmoji — never by swapping IDs.
    var blueRollBtn = document.getElementById('blueRoll');
    var redRollBtn  = document.getElementById('redRoll');
    if (blueRollBtn && redRollBtn) {
        blueRollBtn.classList.add('blue-btn');
        blueRollBtn.classList.remove('red-btn');
        redRollBtn.classList.add('red-btn');
        redRollBtn.classList.remove('blue-btn');
    }

    // Update rolloff die aria-labels for accessibility
    var blueDieBtn = document.getElementById('blueRolloffDie');
    var redDieBtn  = document.getElementById('redRolloffDie');
    if (blueDieBtn) { blueDieBtn.setAttribute('aria-label', colorLabel('blue') + ': roll for first player'); }
    if (redDieBtn)  { redDieBtn.setAttribute('aria-label',  color === 'red' ? 'AI: roll for first player' : colorLabel('red') + ': roll for first player'); }

    // Re-render rolloff dice with correct colors
    if (blueDieBtn && blueDieBtn.innerHTML) { setRolloffDieFadedInPlace(blueDieBtn); }
    if (redDieBtn  && redDieBtn.innerHTML)  { setRolloffDieFadedInPlace(redDieBtn);  }

    var blueBtn = document.getElementById('playAsBlue');
    var redBtn  = document.getElementById('playAsRed');
    if (blueBtn) { blueBtn.classList.toggle('active', color === 'blue'); }
    if (redBtn)  { redBtn.classList.toggle('active', color === 'red');   }
    var cPlayEl = document.getElementById('cPlay');
    if (cPlayEl) { cPlayEl.value = color; }
    var uPlayEl = document.getElementById('uPlay');
    if (uPlayEl) { uPlayEl.value = color; }
    // Blue area is always human's area (left), visually swapped to red when playing as red
    var is2p = (gameMode === '2player');
    document.getElementById('bluePlayerHeader').textContent =
        is2p ? 'BLUE PLAYER' : (color === 'red' ? 'RED PLAYER' : 'BLUE PLAYER');
    document.getElementById('redPlayerHeader').textContent  =
        is2p ? 'RED PLAYER'  : 'AI PLAYER';
    var blueScoreLabel = document.getElementById('blueScoreLabel');
    var redScoreLabel  = document.getElementById('redScoreLabel');
    if (blueScoreLabel) {
        blueScoreLabel.textContent = is2p ? 'Blue Player Score' :
            (color === 'red' ? 'Red Player Score' : 'Blue Player Score');
    }
    if (redScoreLabel) {
        redScoreLabel.textContent  = is2p ? 'Red Player Score' : 'AI Score';
    }

    // Force-refresh rolloff dice with correct visual colors immediately
    var blueDie = document.getElementById('blueRolloffDie');
    var redDie  = document.getElementById('redRolloffDie');
    if (blueDie) { setRolloffDieFaded(blueDie); }
    if (redDie)  { setRolloffDieFaded(redDie);  }
    savePocketsSettings();
}


// Returns the DISPLAY name for an internal color, respecting visual swap
function colorLabel(internalColor) {
    if (gameState.humanColor === 'red') {
        return internalColor === 'blue' ? 'Red' : 'Blue';
    }
    return internalColor === 'blue' ? 'Blue' : 'Red';
}
function colorLabelUpper(internalColor) { return colorLabel(internalColor).toUpperCase(); }
function colorEmoji(internalColor) {
    var isRed = (gameState.humanColor === 'red')
        ? (internalColor === 'blue')   // swapped
        : (internalColor === 'red');
    return isRed ? '🔴' : '🔵';
}
// Mode button click — shows confirm modal so the new mode is always visible
// and clearly applied before the new game starts.
function handleModeButtonClick(newMode) {
    if (newMode === gameMode) { return; }   // no change, nothing to do
    var modeName = (newMode === 'ai') ? 'VS AI' : '2 Players';
    showConfirm(
        'Switch to ' + modeName + '?',
        'Switching to ' + modeName + ' will start a new game. Current progress will be lost.',
        function() {
            setGameMode(newMode);
            newGame();
        }
    );
}

// =============================================================================
// FULL SCREEN — native API on most platforms. On iOS, the real Fullscreen API
// is either unsupported (pre-Safari 17.2) or actively disruptive once it does
// work (iPadOS shows an unskippable "keystrokes may be monitored" security
// warning specifically triggered by rapid tapping, which a tap-heavy dice game
// hits constantly). The actual chrome-free experience on iOS comes from
// installing as a Home Screen web app instead, so guide toward that there
// rather than fighting the platform.
// =============================================================================

function isIOSDevice() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isStandaloneApp() {
    return window.navigator.standalone === true ||
           (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(function(err) {
            console.log('Fullscreen unavailable:', err);
        });
    } else {
        if (document.exitFullscreen) { document.exitFullscreen(); }
    }
}

function showAddToHomeScreenGuidance() {
    alert('For the best full-screen experience on iPhone/iPad:\n\n' +
          '1. Tap the Share button\n' +
          '2. Tap "Add to Home Screen"\n' +
          '3. Launch POCKETS from its new icon — no browser bar!');
}

function injectFullscreenButton() {
    if (document.getElementById('fullscreenBtn')) { return; }
    if (isStandaloneApp()) { return; } // already chrome-free, nothing to offer

    var gameModeEl = document.querySelector('.game-mode');
    if (!gameModeEl) { return; }

    var btn = document.createElement('button');
    btn.id        = 'fullscreenBtn';
    btn.className = 'fullscreen-btn';

    if (isIOSDevice()) {
        btn.textContent = 'Add to Home Screen';
        btn.addEventListener('click', showAddToHomeScreenGuidance);
    } else {
        btn.textContent = 'Full Screen';
        btn.addEventListener('click', toggleFullscreen);
        document.addEventListener('fullscreenchange', function() {
            var b = document.getElementById('fullscreenBtn');
            if (b) { b.textContent = document.fullscreenElement ? 'Exit Full' : 'Full Screen'; }
        });
    }

    gameModeEl.appendChild(btn);
}

// setAIDifficulty() lives in ai-player.js — it needs to recreate the pocketsAI
// instance, not just update the button state, so it must not be duplicated here.
// (A duplicate definition here previously won due to script load order and
// silently broke difficulty switching entirely - removed.)

// =============================================================================
// PANEL BOTTOM STRIP
// =============================================================================

function showPanelBottom(message) {
    var el = document.getElementById('actionTakeResult');
    if (!el) { return; }
    el.textContent = message;
    el.classList.remove('hidden');
    setTimeout(function() { el.classList.add('visible'); }, 10);
}

function hidePanelBottom(instant) {
    var el = document.getElementById('actionTakeResult');
    if (!el) { return; }
    el.classList.remove('visible');
    if (instant) {
        el.classList.add('hidden');
    } else {
        setTimeout(function() { el.classList.add('hidden'); }, 500);
    }
}

// =============================================================================
// ACTION PANEL VIEW MANAGER
// =============================================================================

function setActionPanelView(view) {
    var gameControls  = document.getElementById('gameControls');
    var coinFlip      = document.getElementById('coinFlip');
    var actionStatus  = document.getElementById('actionStatus');
    var winnerDisplay = document.getElementById('winnerDisplay');
    var fpRolloff     = document.getElementById('firstPlayerRolloff');
    var playerRolls   = document.getElementById('playerRolls');

    if (gameControls)  { gameControls.classList.add('hidden'); }
    if (coinFlip)      { coinFlip.classList.add('hidden'); }
    if (actionStatus)  { actionStatus.classList.add('hidden'); }
    if (winnerDisplay) { winnerDisplay.classList.add('hidden'); }

    if (view === 'start') {
        gameControls.classList.remove('hidden');

    } else if (view === 'rolloff') {
        coinFlip.classList.remove('hidden');
        fpRolloff.classList.remove('hidden');
        playerRolls.classList.add('hidden');

    } else if (view === 'rolls') {
        coinFlip.classList.remove('hidden');
        fpRolloff.classList.add('hidden');
        playerRolls.classList.remove('hidden');

    } else if (view === 'status') {
        actionStatus.classList.remove('hidden');

    } else if (view === 'winner') {
        if (winnerDisplay) { winnerDisplay.classList.remove('hidden'); }
    }
}

// =============================================================================
// CONFIRM MODAL
// =============================================================================

function showConfirm(title, message, onConfirm, onCancel, okLabel, cancelLabel) {
    var modal = document.getElementById('confirmModal');
    if (!modal) {
        if (onConfirm) { onConfirm(); }
        return;
    }

    document.getElementById('confirmTitle').textContent   = title;
    document.getElementById('confirmMessage').textContent = message;
    modal.classList.remove('hidden');

    var okBtn     = document.getElementById('confirmOk');
    var cancelBtn = document.getElementById('confirmCancel');
    okBtn.textContent     = okLabel     || 'Confirm';
    cancelBtn.textContent = cancelLabel || 'Cancel';

    function close() {
        modal.classList.add('hidden');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancelClick);
        modal.removeEventListener('click', onBackdrop);
    }
    function onOk()         { close(); if (onConfirm) { onConfirm(); } }
    function onCancelClick(){ close(); if (onCancel)  { onCancel();  } }
    function onBackdrop(e)  { if (e.target === modal) { close(); if (onCancel) { onCancel(); } } }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancelClick);
    modal.addEventListener('click', onBackdrop);
}

// =============================================================================
// START ROUND
// =============================================================================

function startRound() {
    if (gameState.phase !== 'rolling') { return; }

    // firstPlayer must mean "has THIS round's rolloff resolved" - reset it
    // here, at the moment a new round actually begins. It was previously
    // only ever set once per game and never cleared, which made it
    // impossible to reliably tell "between rounds" apart from "rolloff just
    // resolved" - the real cause of restore sometimes skipping straight to
    // Roll Dice and bypassing this function's own pocket-clearing below.
    gameState.firstPlayer = null;

    // Clear take pocket badges at start of new round
    document.getElementById('blueTakeScore').classList.add('hidden');
    document.getElementById('redTakeScore').classList.add('hidden');

    // Clear pockets (Keep Two and Take One only — Save One carries forward)
    var players = ['blue', 'red'];
    var pockets = ['Keep1', 'Keep2', 'Take'];
    for (var p = 0; p < players.length; p++) {
        for (var k = 0; k < pockets.length; k++) {
            var el = document.getElementById(players[p] + pockets[k]);
            el.querySelector('.pocket-dice').innerHTML = '';
        }
        if (gameState.round > 1) {
            var saveEl = document.getElementById(players[p] + 'Save');
            saveEl.querySelector('.pocket-dice').innerHTML = '';
        }
    }

    resetRoundUI();
    gameState.blueRolled = false;
    gameState.redRolled  = false;

    hidePanelBottom(false);
    showPlaceholderDice();
    startFirstPlayerRolloff();
    // From here until the rolloff resolves (a winner is set), a reload should
    // re-present the rolloff rather than dumping the player to Start Round.
    gameState.rolloffInProgress = true;
    autosaveGame();
}

function showPlaceholderDiceForPlayer(player) {
    var area    = document.getElementById(player + 'DiceArea');
    area.innerHTML = '';

    var numNew  = (gameState.round === 1) ? 4 : 3;
    var savedDie = (player === 'blue') ? gameState.blueSavedDie : gameState.redSavedDie;

    for (var i = 0; i < numNew; i++) {
        var die = createDieSVG(1, player + '-ph-' + i, false);
        die.style.opacity       = '0.35';
        die.style.pointerEvents = 'none';
        area.appendChild(die);
    }

    if (gameState.round > 1 && savedDie) {
        var saved = createDieSVG(savedDie, player + '-ph-saved', true);
        saved.style.pointerEvents = 'none';
        area.appendChild(saved);
    }
}

function showPlaceholderDice() {
    showPlaceholderDiceForPlayer('blue');
    showPlaceholderDiceForPlayer('red');
}

function resetRoundUI() {
    document.getElementById('takeDifference').classList.add('hidden');
    // Take pocket badges persist until startRound() — not cleared here
}

// =============================================================================
// FIRST-PLAYER ROLLOFF
// =============================================================================

var rolloffState = { blue: null, red: null, locked: false };

function startFirstPlayerRolloff() {
    rolloffState = { blue: null, red: null, locked: false };
    setActionPanelView('rolloff');

    var blueDie = document.getElementById('blueRolloffDie');
    var redDie  = document.getElementById('redRolloffDie');

    blueDie.classList.remove('parked-left');
    blueDie.classList.remove('parked-right');
    blueDie.classList.remove('spinning-left');
    blueDie.classList.remove('spinning-right');
    blueDie.classList.remove('spinning-in-place');

    redDie.classList.remove('parked-left');
    redDie.classList.remove('parked-right');
    redDie.classList.remove('spinning-left');
    redDie.classList.remove('spinning-right');
    redDie.classList.remove('spinning-in-place');

    var isAIMode = (gameMode === 'ai');
    setRolloffDieFaded(blueDie, false);
    setRolloffDieFaded(redDie, isAIMode);
    blueDie.disabled = false;
    redDie.disabled  = isAIMode;

    var vsEl = document.querySelector('.rolloff-vs');
    if (vsEl) { vsEl.classList.remove('hidden'); }

    var result = document.getElementById('rolloffResult');
    result.textContent = '';
    result.classList.remove('winner');

    document.getElementById('firstPlayerRolloff').classList.remove('hidden');
    document.getElementById('playerRolls').classList.add('hidden');

    if (gameMode === 'ai') {
        document.getElementById('rolloffPrompt').textContent =
            'Tap your ' + colorLabel('blue').toLowerCase() + ' die — AI will roll right after.';
    } else {
        document.getElementById('rolloffPrompt').textContent =
            'Tap your die — higher number goes first!';
    }
}

function setRolloffDieFaded(buttonEl, shouldFade) {
    if (shouldFade === undefined) { shouldFade = true; }
    buttonEl.innerHTML = '';
    if (shouldFade) { buttonEl.classList.add('faded'); }
    else { buttonEl.classList.remove('faded'); }
    var isBlueButton = (buttonEl.id === 'blueRolloffDie');
    var svg = createDieSVG(1, 'rolloff-' + buttonEl.id, false);
    buttonEl.appendChild(svg);

    // Force face+dot colors when swapped
    if (gameState.humanColor === 'red') {
        var cs        = getComputedStyle(document.body);
        var isBitmap  = document.body.classList.contains('theme-bitmap');
        var humanFace, aiFace, humanDot, aiDot;
        if (isBitmap) {
            humanFace = '#f4dddd'; aiFace = '#dde4f4';
            humanDot  = '#800000'; aiDot  = '#000080';
        } else {
            humanFace = cs.getPropertyValue('--burgundy').trim() || '#6e3030';
            aiFace    = cs.getPropertyValue('--navy').trim()     || '#2a3559';
            humanDot  = cs.getPropertyValue('--gold-pale').trim() || '#c8a84b';
            aiDot     = cs.getPropertyValue('--gold-pale').trim() || '#c8a84b';
        }
        // Blue button = human when playing as red
        var faceFill   = isBlueButton ? humanFace : aiFace;
        var faceStroke = isBlueButton ? humanDot  : aiDot;
        var dotFill    = isBlueButton ? humanDot  : aiDot;
        var face = svg.querySelector('.dice-face');
        if (face) {
            face.setAttribute('style', 'fill: ' + faceFill + ' !important; stroke: ' + faceStroke + ' !important;');
        }
        svg.querySelectorAll('.dice-dot').forEach(function(d) {
            d.setAttribute('style', 'fill: ' + dotFill + ' !important;');
        });
    }
}

function setRolloffDieFadedInPlace(buttonEl) {
    buttonEl.innerHTML = '';
    buttonEl.classList.add('faded');
    buttonEl.appendChild(createDieSVG(1, 'rolloff-' + buttonEl.id, false));
    // Apply color swap if playing as Red
    if (gameState.humanColor === 'red') {
        var isBlueButton = (buttonEl.id === 'blueRolloffDie');
        var cs = getComputedStyle(document.body);
        var isBitmap = document.body.classList.contains('theme-bitmap');
        var humanFace = isBitmap ? '#f4dddd' : (cs.getPropertyValue('--burgundy').trim() || '#6e3030');
        var aiFace    = isBitmap ? '#dde4f4' : (cs.getPropertyValue('--navy').trim()     || '#2a3559');
        var humanDot  = isBitmap ? '#800000' : (cs.getPropertyValue('--gold-pale').trim() || '#c8a84b');
        var aiDot     = isBitmap ? '#000080' : (cs.getPropertyValue('--gold-pale').trim() || '#c8a84b');
        var svg = buttonEl.querySelector('svg');
        if (svg) {
            var face = svg.querySelector('.dice-face');
            if (face) {
                face.setAttribute('style', 'fill:' + (isBlueButton ? humanFace : aiFace) + ' !important; stroke:' + (isBlueButton ? humanDot : aiDot) + ' !important;');
            }
            svg.querySelectorAll('.dice-dot').forEach(function(d) {
                d.setAttribute('style', 'fill:' + (isBlueButton ? humanDot : aiDot) + ' !important;');
            });
        }
    }
    // Intentionally keeps parked-left / parked-right — dice stay at sides
}

function rolloffRollDie(player) {
    if (rolloffState.locked) { return; }
    if (rolloffState[player] !== null) { return; }

    var dieEl = document.getElementById(player + 'RolloffDie');
    var parkClass, spinClass;

    if (player === 'blue') {
        parkClass = 'parked-left';
        spinClass = 'spinning-left';
    } else {
        parkClass = 'parked-right';
        spinClass = 'spinning-right';
    }

    var alreadyParked = dieEl.classList.contains(parkClass);

    // Clear the tie text as soon as a die is tapped
    var resultEl = document.getElementById('rolloffResult');
    if (resultEl) { resultEl.textContent = ''; }

    dieEl.disabled = true;
    dieEl.classList.remove('faded');

    var value = Math.floor(Math.random() * 6) + 1;
    var startVal = Math.floor(Math.random() * 6) + 1;
    var rollSvg  = createDieSVG(startVal, 'rolloff-' + player + '-' + Date.now(), false);
    dieEl.innerHTML = '';
    dieEl.appendChild(rollSvg);

    // Force face+dot colors to match visual swap, using theme-aware CSS vars
    if (gameState.humanColor === 'red') {
        var cs       = getComputedStyle(document.body);
        var isBitmap = document.body.classList.contains('theme-bitmap');
        var humanFace, aiFace, humanDot, aiDot;
        if (isBitmap) {
            humanFace = '#f4dddd'; aiFace = '#dde4f4';
            humanDot  = '#800000'; aiDot  = '#000080';
        } else {
            humanFace = cs.getPropertyValue('--burgundy').trim() || '#6e3030';
            aiFace    = cs.getPropertyValue('--navy').trim()     || '#2a3559';
            humanDot  = cs.getPropertyValue('--gold-pale').trim() || '#c8a84b';
            aiDot     = cs.getPropertyValue('--gold-pale').trim() || '#c8a84b';
        }
        // Blue button = human when playing as red
        var isHuman    = (player === 'blue');
        var faceFill   = isHuman ? humanFace : aiFace;
        var faceStroke = isHuman ? humanDot  : aiDot;
        var dotFill    = isHuman ? humanDot  : aiDot;
        var face = rollSvg.querySelector('.dice-face');
        if (face) {
            face.setAttribute('style', 'fill: ' + faceFill + ' !important; stroke: ' + faceStroke + ' !important;');
        }
        rollSvg.querySelectorAll('.dice-dot').forEach(function(d) {
            d.setAttribute('style', 'fill: ' + dotFill + ' !important;');
        });
    }

    if (!alreadyParked) {
        dieEl.classList.add(spinClass);
        var pipIntervalA = setInterval(function() {
            refreshDiePips(rollSvg, Math.floor(Math.random() * 6) + 1);
        }, 80);
        setTimeout(function() {
            clearInterval(pipIntervalA);
            refreshDiePips(rollSvg, value);
            dieEl.classList.remove(spinClass);
            dieEl.classList.add(parkClass);
            rolloffState[player] = value;
            afterRolloffDieSettled(player);
        }, 650);
    } else {
        dieEl.classList.add('spinning-in-place');
        var pipIntervalB = setInterval(function() {
            refreshDiePips(rollSvg, Math.floor(Math.random() * 6) + 1);
        }, 80);
        setTimeout(function() {
            clearInterval(pipIntervalB);
            refreshDiePips(rollSvg, value);
            dieEl.classList.remove('spinning-in-place');
            rolloffState[player] = value;
            afterRolloffDieSettled(player);
        }, 650);
    }
}

function afterRolloffDieSettled(player) {
    autosaveGame();
    if (gameMode === 'ai' && player === 'blue' && rolloffState.red === null) {
        setTimeout(function() { rolloffRollDie('red'); }, 400);
    }
    if (rolloffState.blue !== null && rolloffState.red !== null) {
        setTimeout(resolveRolloff, 400);
    }
}

function resolveRolloff() {
    var blueVal = rolloffState.blue;
    var redVal  = rolloffState.red;
    var result  = document.getElementById('rolloffResult');
    var vsEl    = document.querySelector('.rolloff-vs');

    if (vsEl) { vsEl.classList.add('hidden'); }

    if (blueVal === redVal) {
        rolloffState.locked = true;
        result.textContent = 'Tied at ' + blueVal + ' — tap again!';
        result.classList.remove('winner');

        setTimeout(function() {
            rolloffState = { blue: null, red: null, locked: false };
            var bd = document.getElementById('blueRolloffDie');
            var rd = document.getElementById('redRolloffDie');
            bd.disabled = false;
            rd.disabled = (gameMode === 'ai');
            var isAIModeNow = (gameMode === 'ai');
            bd.classList.remove('faded');
            if (isAIModeNow) { rd.classList.add('faded'); } else { rd.classList.remove('faded'); }
            var vsElAgain = document.querySelector('.rolloff-vs');
            if (vsElAgain) { vsElAgain.classList.remove('hidden'); }
        }, 1200);
        return;
    }

    rolloffState.locked = true;

    var winner;
    if (blueVal > redVal) {
        winner = 'blue';
    } else {
        winner = 'red';
    }

    gameState.firstPlayer   = winner;
    gameState.currentPlayer = winner;
    // Rolloff is resolved — from here the normal 'rolling' restore branch
    // (which keys off firstPlayer) takes over, so this flag goes back down.
    gameState.rolloffInProgress = false;

    var winnerName, winnerColor;
    if (winner === 'blue') {
        winnerName  = colorLabelUpper('blue');
        winnerColor = (gameState.humanColor === 'red') ? '#e24a4a' : '#4a90e2';
    } else if (gameMode === 'ai') {
        winnerName  = 'AI';
        winnerColor = (gameState.humanColor === 'red') ? '#4a90e2' : '#e24a4a';
    } else {
        winnerName  = colorLabelUpper('red');
        winnerColor = '#e24a4a';
    }

    result.classList.add('winner');
    result.innerHTML = '<span style="color:' + winnerColor + '">' + winnerName + '</span> goes first!';

    setTimeout(function() {
        setActionPanelView('rolls');
        // The 4 placeholder dice stay dull through the whole rolloff battle -
        // only brighten them now, the moment Roll Dice buttons actually appear.
        if (typeof brightenPlaceholderDice === 'function') { brightenPlaceholderDice(); }
        var blueBtn = document.getElementById('blueRoll');
        var redBtn  = document.getElementById('redRoll');
        blueBtn.classList.remove('hidden');
        redBtn.classList.remove('hidden');

        // Dim non-first player's button — winner of rolloff goes first
        var secondColor = (winner === 'blue') ? 'red' : 'blue';
        document.getElementById(secondColor + 'Roll').disabled = true;
        // AI is ALWAYS internally red (#redRoll); human ALWAYS internally blue
        // (#blueRoll). Only the visible LABEL/COLOR changes when playing as Red,
        // via colorLabel/colorEmoji + CSS. Never swap which button ID is the AI's.
        if (!(gameMode === 'ai' && winner === 'red')) {
            document.getElementById(winner + 'Roll').classList.add('roll-prompt-pulse');
        }

        if (gameMode === 'ai') {
            document.getElementById('redRoll').textContent  = '🤖 AI Will Roll';
            document.getElementById('blueRoll').textContent = colorEmoji('blue') + ' ' + colorLabel('blue') + ' Roll Dice';
            if (winner === 'red') {
                setTimeout(function() { rollPlayerDice('red'); }, 500);
            }
        } else {
            document.getElementById('blueRoll').textContent = '🔵 Blue Roll Dice';
            document.getElementById('redRoll').textContent  = '🔴 Red Roll Dice';
        }
        updateGameStatus();
        autosaveGame();
    }, 1800);
}

// =============================================================================
// PLAYER DICE ROLLING
// =============================================================================

function rollPlayerDice(player) {
    if (player === 'blue' && gameState.blueRolled) { return; }
    if (player === 'red'  && gameState.redRolled)  { return; }

    var btn = document.getElementById(player + 'Roll');
    btn.disabled = true;
    btn.classList.remove('roll-prompt-pulse');

    var dice = [];
    if (gameState.round === 1) {
        for (var i = 0; i < 4; i++) {
            dice.push(Math.floor(Math.random() * 6) + 1);
        }
    } else {
        for (var j = 0; j < 3; j++) {
            dice.push(Math.floor(Math.random() * 6) + 1);
        }
        var savedDie = (player === 'blue') ? gameState.blueSavedDie : gameState.redSavedDie;
        if (savedDie) { dice.push(savedDie); }
    }

    if (player === 'blue') {
        gameState.blueDice        = dice;
        gameState.blueOriginalRoll = dice.slice();
        gameState.blueRolled      = true;
    } else {
        gameState.redDice        = dice;
        gameState.redOriginalRoll = dice.slice();
        gameState.redRolled      = true;
    }

    renderDiceWithAnimation(player, dice);

    if (player === 'blue') {
        // #blueRoll is ALWAYS the human — never the AI, regardless of humanColor
        btn.textContent = colorEmoji('blue') + ' ' + colorLabel('blue') + ' Rolled';
    } else {
        // #redRoll is ALWAYS the AI in AI mode
        if (gameMode === 'ai') {
            btn.textContent = '🤖 AI Rolled';
        } else {
            btn.textContent = colorEmoji('red') + ' ' + colorLabel('red') + ' Rolled';
        }
    }

    // Enable the other player's button now it's their turn to roll
    var otherColor = (player === 'blue') ? 'red' : 'blue';
    var otherBtn   = document.getElementById(otherColor + 'Roll');
    // The AI is always the red button; only pulse the other button if it's human
    var otherIsAI  = (gameMode === 'ai') && (otherColor === 'red');
    if (otherBtn && !gameState[otherColor + 'Rolled']) {
        otherBtn.disabled = false;
        if (!otherIsAI) {
            otherBtn.classList.add('roll-prompt-pulse');
        }
    }

    if (gameMode === 'ai' && player === 'blue' && !gameState.redRolled) {
        setTimeout(function() { rollPlayerDice('red'); }, 1500);
    }

    if (gameState.blueRolled && gameState.redRolled) {
        setTimeout(function() { startPlacement(); }, 1000);
    }
    autosaveGame();
}

function renderDiceWithAnimation(player, dice, skipAnimation) {
    var diceArea = document.getElementById(player + 'DiceArea');
    diceArea.innerHTML = '';

    for (var i = 0; i < dice.length; i++) {
        var value   = dice[i];
        var isSaved = false;

        if (gameState.round > 1 && i === dice.length - 1) {
            if (player === 'blue' && gameState.blueSavedDie) { isSaved = true; }
            if (player === 'red'  && gameState.redSavedDie)  { isSaved = true; }
        }

        // Saved dice show their correct value immediately — no animation.
        // Non-saved dice normally start random and cycle to the final value,
        // but skipAnimation (used when restoring a saved game) shows the
        // correct value directly - a restore must never look like a fresh
        // roll just happened, even though the underlying data was correct
        // the whole time.
        var startVal = (isSaved || skipAnimation) ? value : Math.floor(Math.random() * 6) + 1;
        var die      = createDieSVG(startVal, player + '-' + i, isSaved);
        die.setAttribute('data-value', value);   // override startVal with correct final value
        if (!isSaved && !skipAnimation) { die.classList.add('rolling'); }  // saved/restored dice don't animate

        // Closure captures die element, final value, saved flag, and index
        (function(dieEl, finalValue, isSavedDie, dieIdx) {
            dieEl.addEventListener('click', function() { selectDie(player, dieIdx); });

            if (!isSavedDie && !skipAnimation) {
                // Cycle random pips every 80ms while the die spins
                var pipInterval = setInterval(function() {
                    refreshDiePips(dieEl, Math.floor(Math.random() * 6) + 1);
                }, 80);
                // Snap to final value just before spin ends, so it's visible landing
                setTimeout(function() {
                    clearInterval(pipInterval);
                    refreshDiePips(dieEl, finalValue);
                }, 680);
            }
        })(die, value, isSaved, i);

        diceArea.appendChild(die);
    }

    setTimeout(function() {
        var allDice = document.querySelectorAll('.dice');
        allDice.forEach(function(d) {
            d.classList.remove('rolling');
            d.classList.remove('jitter');
        });
    }, 800);
}

// =============================================================================
// PLACEMENT
// =============================================================================

function startPlacement() {
    gameState.phase         = 'placing';
    gameState.diceToPlace   = 8;
    gameState.placementTurn = 0;
    setActionPanelView('status');
    updateGameStatus();
    if (gameMode === 'ai' && gameState.currentPlayer === 'red') {
        setTimeout(function() { makeAIMove(); }, 600);
    }
    autosaveGame();
}

function selectDie(player, index) {
    if (gameState.phase !== 'placing') { return; }
    if (player !== gameState.currentPlayer) { return; }

    var allSelected = document.querySelectorAll('.dice.selected');
    allSelected.forEach(function(d) { d.classList.remove('selected'); });

    var dieEl = document.querySelector('[data-id="' + player + '-' + index + '"]');
    if (dieEl && !dieEl.classList.contains('selected')) {
        dieEl.classList.add('selected');
        var capturedValue = parseInt(dieEl.getAttribute('data-value'));
        gameState.selectedDie = { player: player, index: index, value: capturedValue };
        highlightAvailablePockets();
        autosaveGame();
    }
}

function highlightAvailablePockets() {
    var allPockets = document.querySelectorAll('.pocket');
    allPockets.forEach(function(pocket) {
        pocket.classList.remove('active');
        pocket.replaceWith(pocket.cloneNode(true));
    });

    if (!gameState.selectedDie) { return; }

    var player  = gameState.selectedDie.player;
    var pockets = document.querySelectorAll('[data-player="' + player + '"]');

    pockets.forEach(function(pocket) {
        if (pocket.querySelectorAll('.dice').length < 1) {
            pocket.classList.add('active');
            pocket.addEventListener('click', function() { placeDieInPocket(pocket); });
        }
    });
}

function placeDieInPocket(pocketElement) {
    if (!gameState.selectedDie) { return; }

    var player   = gameState.selectedDie.player;
    var index    = gameState.selectedDie.index;
    var dieValue = gameState.selectedDie.value;

    var pocketDie = createDieSVG(dieValue, 'pocket-' + Date.now(), false);
    pocketDie.style.width  = '40px';
    pocketDie.style.height = '40px';
    pocketDie.classList.remove('saved-tint');
    pocketElement.querySelector('.pocket-dice').appendChild(pocketDie);

    updatePocketScore(pocketElement, player);

    var dieEl = document.querySelector('[data-id="' + player + '-' + index + '"]');
    if (dieEl) { dieEl.remove(); }

    if (player === 'blue') {
        gameState.blueDice.splice(index, 1);
    } else {
        gameState.redDice.splice(index, 1);
    }

    gameState.selectedDie = null;

    var allPockets = document.querySelectorAll('.pocket');
    allPockets.forEach(function(p) {
        p.classList.remove('active');
        p.replaceWith(p.cloneNode(true));
    });

    gameState.diceToPlace--;
    gameState.placementTurn++;

    if (gameState.diceToPlace > 0) {
        if (gameState.currentPlayer === 'blue') {
            gameState.currentPlayer = 'red';
        } else {
            gameState.currentPlayer = 'blue';
        }
        renderDice();
        updateGameStatus();
        if (gameMode === 'ai' && gameState.currentPlayer === 'red') {
            setTimeout(function() { makeAIMove(); }, 300);
        }
    } else {
        calculateRoundScore();
    }

    updateTakeDifference();
    autosaveGame();
}

function renderDice() {
    var blueDiceArea = document.getElementById('blueDiceArea');
    var redDiceArea  = document.getElementById('redDiceArea');
    blueDiceArea.innerHTML = '';
    redDiceArea.innerHTML  = '';

    for (var i = 0; i < gameState.blueDice.length; i++) {
        var blueVal   = gameState.blueDice[i];
        var blueIsSaved = (gameState.round > 1 &&
                           i === gameState.blueDice.length - 1 &&
                           gameState.blueSavedDie === blueVal);
        var blueDie = createDieSVG(blueVal, 'blue-' + i, blueIsSaved);
        (function(idx) {
            blueDie.addEventListener('click', function() { selectDie('blue', idx); });
        })(i);
        blueDiceArea.appendChild(blueDie);
    }

    for (var j = 0; j < gameState.redDice.length; j++) {
        var redVal    = gameState.redDice[j];
        var redIsSaved = (gameState.round > 1 &&
                          j === gameState.redDice.length - 1 &&
                          gameState.redSavedDie === redVal);
        var redDie = createDieSVG(redVal, 'red-' + j, redIsSaved);
        (function(idx) {
            redDie.addEventListener('click', function() { selectDie('red', idx); });
        })(j);
        redDiceArea.appendChild(redDie);
    }
}

function updatePocketScore(pocketElement, player) {
    var pocketType = pocketElement.dataset.pocket;
    if (pocketType === 'take') {
        var dicEls = pocketElement.querySelectorAll('.dice');
        if (dicEls.length > 0) {
            var scoreEl = document.getElementById(player + 'TakeScore');
            scoreEl.textContent = dicEls[0].getAttribute('data-value');
            scoreEl.classList.remove('hidden');
        }
    }
}

function updateTakeDifference() {
    var bluePockets = getDiceFromPockets('blue');
    var redPockets  = getDiceFromPockets('red');
    var blueTake   = bluePockets.take || [];
    var redTake    = redPockets.take  || [];

    document.getElementById('takeDifference').classList.add('hidden');

    if (blueTake.length > 0 && redTake.length > 0) {
        var bd   = blueTake[0];
        var rd   = redTake[0];
        var diff = Math.abs(bd - rd);

        if (diff > 0 && bd > rd) {
            document.getElementById('blueTakeScore').textContent = '+' + diff;
        } else {
            document.getElementById('blueTakeScore').textContent = '0';
        }

        if (diff > 0 && rd > bd) {
            document.getElementById('redTakeScore').textContent = '+' + diff;
        } else {
            document.getElementById('redTakeScore').textContent = '0';
        }

        // Take win/loss message removed — redundant, players see pocket numbers
    }
}

function getDiceFromPockets(player) {
    var pockets   = {};
    var pocketTypes = ['keep1', 'keep2', 'take', 'save'];

    for (var i = 0; i < pocketTypes.length; i++) {
        var pt  = pocketTypes[i];
        var cap = pt.charAt(0).toUpperCase() + pt.slice(1);
        var el  = document.getElementById(player + cap);
        var diceEls = el.querySelectorAll('.dice');
        var values  = [];
        diceEls.forEach(function(d) { values.push(parseInt(d.getAttribute('data-value'))); });
        if (values.length > 0) { pockets[pt] = values; }
    }

    return pockets;
}

// =============================================================================
// SCORING
// =============================================================================

function calculateRoundScore() {
    gameState.phase = 'scoring';

    // Belt-and-suspenders: ensure no pockets remain highlighted
    document.querySelectorAll('.pocket.active').forEach(function(p) {
        p.classList.remove('active');
    });

    var bluePockets = getDiceFromPockets('blue');
    var redPockets  = getDiceFromPockets('red');

    var blueKeep1 = bluePockets.keep1 || [];
    var blueKeep2 = bluePockets.keep2 || [];
    var blueKeepScore = blueKeep1.concat(blueKeep2).reduce(function(a, b) { return a + b; }, 0);

    var redKeep1 = redPockets.keep1 || [];
    var redKeep2 = redPockets.keep2 || [];
    var redKeepScore = redKeep1.concat(redKeep2).reduce(function(a, b) { return a + b; }, 0);

    var blueTakeDie = 0;
    var redTakeDie  = 0;
    if (bluePockets.take && bluePockets.take.length > 0) { blueTakeDie = bluePockets.take[0]; }
    if (redPockets.take  && redPockets.take.length  > 0) { redTakeDie  = redPockets.take[0];  }

    var blueBonus      = 0;
    var redBonus       = 0;
    var blueComboBonus = 0;
    var redComboBonus  = 0;

    if (blueTakeDie > redTakeDie) {
        blueBonus      = blueTakeDie - redTakeDie;
        blueComboBonus = calculateBonusPoints(gameState.blueOriginalRoll);
        blueBonus      = blueBonus + blueComboBonus;
    } else if (redTakeDie > blueTakeDie) {
        redBonus      = redTakeDie - blueTakeDie;
        redComboBonus = calculateBonusPoints(gameState.redOriginalRoll);
        redBonus      = redBonus + redComboBonus;
    }

    // Take result element cleared — message removed

    displayRoundScores(blueKeepScore, blueBonus, blueComboBonus,
                       redKeepScore,  redBonus,  redComboBonus);

    gameState.blueScore += blueKeepScore + blueBonus;
    gameState.redScore  += redKeepScore  + redBonus;

    if (bluePockets.save && bluePockets.save.length > 0) {
        gameState.blueSavedDie = bluePockets.save[0];
    } else {
        gameState.blueSavedDie = null;
    }
    if (redPockets.save && redPockets.save.length > 0) {
        gameState.redSavedDie = redPockets.save[0];
    } else {
        gameState.redSavedDie = null;
    }

    updateScoreDisplay();

    setTimeout(function() {
        check100Trigger();
    }, 2000);
}

function displayRoundScores(blueKeep, blueBonus, blueCombo,
                             redKeep,  redBonus,  redCombo) {
    var blueDiceArea = document.getElementById('blueDiceArea');
    var redDiceArea  = document.getElementById('redDiceArea');

    var isBitmap = document.body.classList.contains('theme-bitmap');

    var blueDiv = document.createElement('div');
    blueDiv.className = 'round-score-display';
    var blueText = 'Round Score: ' + (blueKeep + blueBonus) + ' pts';
    if (blueBonus > 0) {
        blueText += '<br>Keep: ' + blueKeep + ', Take: ' + (blueBonus - blueCombo);
        if (blueCombo > 0 && isBitmap)  { blueText += '<br>Bonus: ' + blueCombo; }
        else if (blueCombo > 0)          { blueText += ', Bonus: ' + blueCombo; }
        else if (isBitmap)               { blueText += '<br>Bonus: 0'; }
    } else {
        blueText += '<br>Keep: ' + blueKeep;
        if (isBitmap) { blueText += '<br>Bonus: 0'; }
    }
    blueDiv.innerHTML = blueText;
    blueDiceArea.appendChild(blueDiv);

    var redDiv = document.createElement('div');
    redDiv.className = 'round-score-display';
    var redText = 'Round Score: ' + (redKeep + redBonus) + ' pts';
    if (redBonus > 0) {
        redText += '<br>Keep: ' + redKeep + ', Take: ' + (redBonus - redCombo);
        if (redCombo > 0 && isBitmap)  { redText += '<br>Bonus: ' + redCombo; }
        else if (redCombo > 0)          { redText += ', Bonus: ' + redCombo; }
        else if (isBitmap)              { redText += '<br>Bonus: 0'; }
    } else {
        redText += '<br>Keep: ' + redKeep;
        if (isBitmap) { redText += '<br>Bonus: 0'; }
    }
    redDiv.innerHTML = redText;
    redDiceArea.appendChild(redDiv);
}

// =============================================================================
// 100-POINT TRIGGER
// =============================================================================

function check100Trigger() {
    var blueOver = gameState.blueScore >= 100;
    var redOver  = gameState.redScore  >= 100;

    if (!blueOver && !redOver) {
        nextRound();
        return;
    }

    var msg;
    if (blueOver && redOver) {
        if (gameState.blueScore > gameState.redScore) {
            msg = 'Both players crossed 100 — ' + colorLabel('blue') + ' leads! Click Start Rolldown to begin.';
        } else if (gameState.redScore > gameState.blueScore) {
            msg = 'Both players crossed 100 — ' + colorLabel('red') + ' leads! Click Start Rolldown to begin.';
        } else {
            msg = 'Both players crossed 100 and are tied! Click Start Rolldown.';
        }
    } else if (blueOver) {
        msg = colorLabel('blue') + ' crossed 100 points! Click Start Rolldown to begin.';
    } else {
        msg = colorLabel('red') + ' crossed 100 points! Click Start Rolldown to begin.';
    }

    showPanelBottom(msg);
    document.getElementById('startRound').classList.add('hidden');
    document.getElementById('startFinale').classList.remove('hidden');
    setActionPanelView('start');
}

// =============================================================================
// FINALE — BOARD-BASED FLOW
// =============================================================================

function startFinale() {
    gameState.phase              = 'finale';
    gameState.finaleMode         = true;
    gameState.finaleRolls        = { blue: [], red: [] };
    gameState.finaleCurrentPlayer = gameState.firstPlayer || 'blue';

    document.getElementById('startFinale').classList.add('hidden');
    document.getElementById('startRound').classList.add('hidden');
    document.getElementById('currentRound').textContent = 'Rolldown';

    hidePanelBottom(false);

    // Hide regular pockets — Keep Two and Take One only
    var keepTake = document.querySelectorAll(
        '.pocket[data-pocket="keep1"], .pocket[data-pocket="keep2"], .pocket[data-pocket="take"]'
    );
    keepTake.forEach(function(p) { p.classList.add('finale-hidden'); });

    // Show Finale pocket areas
    document.getElementById('blueFinale').classList.remove('hidden');
    document.getElementById('redFinale').classList.remove('hidden');

    // Reset Finale totals to saved die value
    var blueSaved = gameState.blueSavedDie || 0;
    var redSaved  = gameState.redSavedDie  || 0;
    document.getElementById('blueFinaleTotal').textContent = blueSaved;
    document.getElementById('redFinaleTotal').textContent  = redSaved;
    document.getElementById('blueFinaleBonus').textContent = '';
    document.getElementById('redFinaleBonus').textContent  = '';

    // Clear dice areas and show 4 dimmed dice per player
    document.getElementById('blueDiceArea').innerHTML = '';
    document.getElementById('redDiceArea').innerHTML  = '';
    showDimmedDice('blue');
    showDimmedDice('red');

    setActionPanelView('rolls');   // shows coinFlip + playerRolls, hides firstPlayerRolloff

    // Hide "of 10" suffix — round count irrelevant in Finale
    var suffix = document.getElementById('roundSuffix');
    if (suffix) { suffix.classList.add('hidden'); }

    updateFinaleUI();

    document.getElementById('turnInfo').textContent =
        gameState.finaleCurrentPlayer === 'blue'
            ? colorLabel('blue') + "'s Finale roll"
            : colorLabel('red')  + "'s Finale roll";

    var humanIsRed = (gameState.humanColor === 'red');
    var aiFinaleColor = 'red';
    autosaveGame();
    if (gameMode === 'ai' && gameState.finaleCurrentPlayer === 'red') {
        setTimeout(function() { rollFinale('red'); }, 1200);
    }
}

function showDimmedDice(player) {
    var area = document.getElementById(player + 'DiceArea');
    for (var i = 0; i < 4; i++) {
        var die = createDieSVG(1, player + '-finale-dim-' + i, false);
        die.classList.add('dimmed-die');
        area.appendChild(die);
    }
}

function rollFinale(player) {
    if (!gameState.finaleMode) { return; }
    if (gameState.finaleCurrentPlayer !== player) { return; }
    var rolls = gameState.finaleRolls[player];
    if (rolls.length >= 4) { return; }

    var value = Math.floor(Math.random() * 6) + 1;
    rolls.push(value);

    // Animate the correct dimmed die in roll bar
    var area     = document.getElementById(player + 'DiceArea');
    var dimDice  = area.querySelectorAll('.dimmed-die');
    // Always target the first remaining dimmed die in this player's roll bar
    var targetDie = dimDice[0];

    if (targetDie) {
        targetDie.classList.remove('dimmed-die');
        targetDie.classList.add('rolling');
        targetDie.setAttribute('data-value', value);
        var captured    = value;
        var capturedDie = targetDie;
        // Cycle pips randomly while rolling, then snap to final value
        var pipInterval = setInterval(function() {
            refreshDiePips(capturedDie, Math.floor(Math.random() * 6) + 1);
        }, 80);
        setTimeout(function() {
            clearInterval(pipInterval);
            capturedDie.classList.remove('rolling');
            refreshDiePips(capturedDie, captured);
        }, 680);
    }

    // Update running total in Finale pocket
    var savedDie = (player === 'blue') ? (gameState.blueSavedDie || 0) : (gameState.redSavedDie || 0);
    var rollSum  = rolls.reduce(function(a, b) { return a + b; }, 0);
    var running  = savedDie + rollSum;
    var totalEl  = document.getElementById(player + 'FinaleTotal');
    totalEl.textContent = running;
    totalEl.classList.add('bumped');
    setTimeout(function() { totalEl.classList.remove('bumped'); }, 260);

    // Context message
    var flavor = '';
    if (value === 6) { flavor = ' Big one!'; }
    if (value === 1) { flavor = ' Ouch.'; }
    var label = (player === 'blue') ? 'Blue' : 'Red';
    document.getElementById('turnInfo').textContent =
        label + ' rolled a ' + value + '.' + flavor;

    var blueDone = (gameState.finaleRolls.blue.length >= 4);
    var redDone  = (gameState.finaleRolls.red.length  >= 4);

    if (blueDone && redDone) {
        autosaveGame();
        setTimeout(function() { finalizeFinale(); }, 900);
        return;
    }

    // Alternate players
    var next;
    if (!blueDone && !redDone) {
        next = (player === 'blue') ? 'red' : 'blue';
    } else if (!blueDone) {
        next = 'blue';
    } else {
        next = 'red';
    }

    gameState.finaleCurrentPlayer = next;
    updateFinaleUI();
    autosaveGame();

    if (gameMode === 'ai' && next === 'red') {
        setTimeout(function() { rollFinale('red'); }, 1100);
    }
}

function updateFinaleUI() {
    var player   = gameState.finaleCurrentPlayer;
    var blueBtn  = document.getElementById('blueRoll');
    var redBtn   = document.getElementById('redRoll');
    var blueDone = (gameState.finaleRolls.blue.length >= 4);
    var redDone  = (gameState.finaleRolls.red.length  >= 4);

    blueBtn.classList.remove('hidden');
    redBtn.classList.remove('hidden');

    var blueNum = gameState.finaleRolls.blue.length + 1;
    var redNum  = gameState.finaleRolls.red.length  + 1;

    blueBtn.textContent = blueDone ? colorLabel('blue') + ' Done' : colorLabel('blue') + ' Roll ' + blueNum + ' of 4';
    blueBtn.disabled    = (player !== 'blue') || blueDone;

    if (gameMode === 'ai') {
        redBtn.textContent = (gameState.finaleRolls.red.length >= 4) ? '🤖 AI Done' : '🤖 AI Rolling...';
        redBtn.disabled    = true;
    } else {
        redBtn.textContent = redDone ? colorLabel('red') + ' Done' : colorLabel('red') + ' Roll ' + redNum + ' of 4';
        redBtn.disabled    = (player !== 'red') || redDone;
    }

    document.getElementById('turnInfo').textContent =
        blueDone && redDone ? 'Calculating final scores...' :
        player === 'blue'   ? colorLabel('blue') + "'s Rolldown roll"
                            : colorLabel('red')  + "'s Rolldown roll";
}

function finalizeFinale() {
    var blueHand = gameState.finaleRolls.blue.slice();
    if (gameState.blueSavedDie !== null && gameState.blueSavedDie !== undefined) {
        blueHand.push(gameState.blueSavedDie);
    }
    var redHand = gameState.finaleRolls.red.slice();
    if (gameState.redSavedDie !== null && gameState.redSavedDie !== undefined) {
        redHand.push(gameState.redSavedDie);
    }

    var blueTotal = blueHand.reduce(function(a, b) { return a + b; }, 0);
    var redTotal  = redHand.reduce(function(a, b) { return a + b; }, 0);
    var blueCombo = calculateBonusPoints(blueHand);
    var redCombo  = calculateBonusPoints(redHand);
    var blueFinal = blueTotal + blueCombo;
    var redFinal  = redTotal  + redCombo;

    document.getElementById('blueFinaleTotal').textContent = blueFinal;
    document.getElementById('redFinaleTotal').textContent  = redFinal;

    if (blueCombo > 0) {
        document.getElementById('blueFinaleBonus').textContent = 'With +' + blueCombo + ' bonus';
    }
    if (redCombo > 0) {
        document.getElementById('redFinaleBonus').textContent = 'With +' + redCombo + ' bonus';
    }

    gameState.blueScore += blueFinal;
    gameState.redScore  += redFinal;
    updateScoreDisplay();

    // Hide roll buttons
    document.getElementById('blueRoll').classList.add('hidden');
    document.getElementById('redRoll').classList.add('hidden');

    endGame();
}

// Kept for any legacy HTML references
function proceedToFinalRound()      {}
function startFinalRollDrama()      {}
function rollFinalDie()             {}
function finalizeFinalRoll()        {}
function closeFinalRollModal()      {}
function shareFinalResult()         { shareFinalResultNew(); }

function shareFinalResultNew() {
    var blueTotal = gameState.blueScore;
    var redTotal  = gameState.redScore;
    var resultLine;
    if (blueTotal > redTotal) {
        resultLine = colorLabel('blue') + ' wins ' + blueTotal + ' to ' + redTotal;
    } else if (redTotal > blueTotal) {
        resultLine = colorLabel('red') + ' wins ' + redTotal + ' to ' + blueTotal;
    } else {
        resultLine = 'Tie at ' + blueTotal;
    }
    var text = 'POCKETS — ' + resultLine + '\nA strategic dice game.';
    if (navigator.share) {
        navigator.share({ title: 'POCKETS', text: text }).catch(function() {});
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function() {
            var btn = document.getElementById('shareResultFooter');
            if (btn) {
                var orig = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(function() { btn.textContent = orig; }, 1800);
            }
        });
    }
}

// =============================================================================
// GAME STATUS TEXT
// =============================================================================

function updateGameStatus() {
    var turnInfo = document.getElementById('turnInfo');

    if (gameState.phase === 'rolling') {
        turnInfo.textContent = '';
    } else if (gameState.phase === 'placing') {
        var playerName;
        if (gameMode === 'ai' && gameState.currentPlayer === 'red') {
            if (aiThinking) {
                turnInfo.textContent = 'AI is thinking...';
                return;
            }
            playerName = 'AI';
        } else {
            playerName = colorLabel(gameState.currentPlayer);
        }
        turnInfo.textContent = playerName + ' places a die';
        var isHumanTurn = (gameMode !== 'ai') || (gameState.currentPlayer === 'blue');
        var showHint    = (gameState.round === 1) && isHumanTurn &&
                          (gameState.placementTurn === 0 ||
                           gameState.placementTurn === 1);
        if (showHint) {
            var hintHtml = playerName + ' places a die';
            hintHtml += '<br><span class="placement-hint">Tap a die · then tap a pocket</span>';
            turnInfo.innerHTML = hintHtml;
        }
    } else if (gameState.phase === 'scoring') {
        turnInfo.textContent = 'Round complete — calculating scores...';
    } else if (gameState.phase === 'finale') {
        // handled by updateFinaleUI
    }
}

function updateScoreDisplay() {
    document.getElementById('blueScore').textContent = gameState.blueScore;
    document.getElementById('redScore').textContent  = gameState.redScore;
}

// =============================================================================
// NEXT ROUND
// =============================================================================

function nextRound() {
    gameState.round++;
    gameState.phase         = 'rolling';
    gameState.selectedDie   = null;
    gameState.diceToPlace   = 8;
    gameState.placementTurn = 0;
    gameState.blueRolled    = false;
    gameState.redRolled     = false;
    // Reset the moment THIS round ends, not just when Start Round is next
    // clicked - a save captured in the gap between "round ended" and
    // "Start Round clicked" (e.g. closing the app right after a round)
    // would otherwise still carry the previous round's stale value,
    // making restore incorrectly think rolloff already happened.
    gameState.firstPlayer   = null;

    resetRoundUI();
    document.getElementById('currentRound').textContent = gameState.round;
    document.getElementById('startRound').textContent   = 'Start Round ' + gameState.round;
    setActionPanelView('start');
    resetRollButtons();
    updateGameStatus();
    autosaveGame();
}

function resetRollButtons() {
    var blueBtn = document.getElementById('blueRoll');
    var redBtn  = document.getElementById('redRoll');

    // Human is ALWAYS #blueRoll, AI is ALWAYS #redRoll. Positions and button
    // IDs never swap. Color reflects humanColor via CSS (.playing-as-red);
    // label reflects it via colorLabel/colorEmoji.
    blueBtn.classList.add('blue-btn');    blueBtn.classList.remove('red-btn');
    redBtn.classList.add('red-btn');      redBtn.classList.remove('blue-btn');

    blueBtn.disabled = false;
    redBtn.disabled  = false;

    if (gameMode === 'ai') {
        blueBtn.textContent = colorEmoji('blue') + ' ' + colorLabel('blue') + ' Roll Dice';
        redBtn.textContent  = '🤖 AI Will Roll';
    } else {
        blueBtn.textContent = colorEmoji('blue') + ' ' + colorLabel('blue') + ' Roll Dice';
        redBtn.textContent  = colorEmoji('red')  + ' ' + colorLabel('red')  + ' Roll Dice';
    }

    blueBtn.classList.add('hidden');
    redBtn.classList.add('hidden');
}

// =============================================================================
// END GAME
// =============================================================================

function endGame() {
    gameState.phase = 'gameOver';

    var winner;
    if (gameState.blueScore > gameState.redScore) {
        winner = 'Blue';
    } else if (gameState.redScore > gameState.blueScore) {
        winner = 'Red';
    } else {
        winner = 'Tie';
    }

    // Big pulsing winner text in the green panel
    var pulseEl = document.getElementById('winnerPulseText');
    if (pulseEl) {
        if (winner === 'Tie') {
            pulseEl.textContent = "IT'S A TIE!";
            pulseEl.className   = 'winner-pulse silver-pulse';
        } else {
            pulseEl.textContent = colorLabel(winner.toLowerCase()).toUpperCase() + ' WINS!';
            pulseEl.className   = 'winner-pulse silver-pulse';
        }
    }
    setActionPanelView('winner');

    // Keep brass number styling — add class on top, don't replace
    document.getElementById('blueScore').classList.add('final-total');
    document.getElementById('redScore').classList.add('final-total');

    var blueArea = document.querySelector('.scores .score-area:first-child');
    var redArea  = document.querySelector('.scores .score-area:last-child');

    if (winner === 'Blue' || winner === 'Tie') {
        blueArea.classList.add('winner');
        addWinnerText(blueArea);
    }
    if (winner === 'Red' || winner === 'Tie') {
        redArea.classList.add('winner');
        addWinnerText(redArea);
    }

    // Show take button in footer
    var shareFooter = document.getElementById('shareResultFooter');
    if (shareFooter) { shareFooter.classList.remove('hidden'); }

    // Guard against double-recording: endGame() also runs when a finished
    // game's winner screen gets re-displayed on restore, but that's a replay
    // of an already-recorded result, not a second game.
    if (typeof saveGameStats === 'function' && !gameState.statsAlreadySaved) {
        gameState.statsAlreadySaved = true;
        saveGameStats({
            winner:       winner,
            blueScore:    gameState.blueScore,
            redScore:     gameState.redScore,
            gameMode:     gameMode,
            aiDifficulty: (gameMode === 'ai') ? aiDifficulty : null,
            humanColor:   gameState.humanColor || 'blue',
            date:         new Date().toISOString()
        });
    }

    autosaveGame();
}

function addWinnerText(scoreArea) {
    var el = document.createElement('div');
    el.className   = 'winner-text';
    el.textContent = 'WINNER!';
    scoreArea.appendChild(el);
}

// =============================================================================
// NEW GAME
// =============================================================================

function newGame() {
    clearSavedGame();
    gameState = {
        round: 1, currentPlayer: 'blue', phase: 'rolling', firstPlayer: null,
        blueDice: [], redDice: [], blueOriginalRoll: [], redOriginalRoll: [],
        blueSavedDie: null, redSavedDie: null, blueScore: 0, redScore: 0,
        selectedDie: null, diceToPlace: 8, placementTurn: 0,
        roundScores: { blue: {}, red: {} },
        blueRolled: false, redRolled: false, blueFinalRolled: false, redFinalRolled: false,
        finaleMode: false,
        finaleRolls: { blue: [], red: [] },
        finaleCurrentPlayer: 'blue',
        rolloffInProgress: false,
        humanColor: gameState.humanColor || 'blue'
    };

    document.getElementById('startRound').textContent   = 'Start Round 1';
    document.getElementById('currentRound').textContent = '1';
    var suffix = document.getElementById('roundSuffix');
    if (suffix) { suffix.classList.remove('hidden'); }

    resetRollButtons();
    rolloffState = { blue: null, red: null, locked: false };

    var blueDie = document.getElementById('blueRolloffDie');
    var redDie  = document.getElementById('redRolloffDie');
    blueDie.classList.remove('parked-left');
    blueDie.classList.remove('parked-right');
    blueDie.classList.remove('spinning-left');
    blueDie.classList.remove('spinning-right');
    blueDie.classList.remove('spinning-in-place');
    redDie.classList.remove('parked-left');
    redDie.classList.remove('parked-right');
    redDie.classList.remove('spinning-left');
    redDie.classList.remove('spinning-right');
    redDie.classList.remove('spinning-in-place');

    var vsEl = document.querySelector('.rolloff-vs');
    if (vsEl) { vsEl.classList.remove('hidden'); }

    document.getElementById('firstPlayerRolloff').classList.remove('hidden');
    document.getElementById('playerRolls').classList.add('hidden');
    document.getElementById('rolloffResult').textContent = '';
    document.getElementById('rolloffResult').classList.remove('winner');

    setRolloffDieFaded(blueDie);
    setRolloffDieFaded(redDie);

    // Fix AI->2player prompt bug — always reset from current gameMode
    if (gameMode === 'ai') {
        var humanLabel = (gameState.humanColor === 'red') ? 'red' : 'blue';
        document.getElementById('rolloffPrompt').textContent =
            'Tap your ' + humanLabel + ' die — AI will roll right after.';
    } else {
        document.getElementById('rolloffPrompt').textContent =
            'Tap your die — higher number goes first!';
    }

    hidePanelBottom(true);
    document.getElementById('blueTakeScore').classList.add('hidden');
    document.getElementById('redTakeScore').classList.add('hidden');

    setActionPanelView('start');
    document.getElementById('preFinalScreen').classList.add('hidden');
    document.getElementById('finalRollModal').classList.add('hidden');
    document.getElementById('finalCelebration').classList.add('hidden');

    document.getElementById('blueRollFinalDie').classList.remove('hidden');
    document.getElementById('redRollFinalDie').classList.remove('hidden');
    document.getElementById('blueRollFinalDie').disabled = false;
    document.getElementById('redRollFinalDie').disabled  = false;

    var finalScores = document.querySelectorAll('.final-score-display');
    finalScores.forEach(function(el) { el.remove(); });

    // Restore regular pockets hidden during Finale
    var keepTake = document.querySelectorAll('.pocket.finale-hidden');
    keepTake.forEach(function(p) { p.classList.remove('finale-hidden'); });

    // Hide Finale pocket areas
    var blueFinale = document.getElementById('blueFinale');
    var redFinale  = document.getElementById('redFinale');
    if (blueFinale) { blueFinale.classList.add('hidden'); }
    if (redFinale)  { redFinale.classList.add('hidden');  }

    // Reset Start Finale button
    var startFinaleBtn = document.getElementById('startFinale');
    if (startFinaleBtn) { startFinaleBtn.classList.add('hidden'); }
    document.getElementById('startRound').classList.remove('hidden');

    var scoreAreas = document.querySelectorAll('.score-area');
    scoreAreas.forEach(function(area) {
        area.classList.remove('winner');
        var wt = area.querySelector('.winner-text');
        if (wt) { wt.remove(); }
    });

    document.getElementById('blueScore').classList.remove('final-total');
    document.getElementById('redScore').classList.remove('final-total');

    var shareFooter = document.getElementById('shareResultFooter');
    if (shareFooter) { shareFooter.classList.add('hidden'); }

    var pocketContainers = document.querySelectorAll('.pockets');
    pocketContainers.forEach(function(p) { p.style.display = 'grid'; });

    var pocketDice = document.querySelectorAll('.pocket-dice');
    pocketDice.forEach(function(c) { c.innerHTML = ''; });

    // Clear any lingering active/highlighted state from previous game
    document.querySelectorAll('.pocket.active').forEach(function(p) {
        p.classList.remove('active');
    });

    document.getElementById('blueDiceArea').innerHTML = '';
    document.getElementById('redDiceArea').innerHTML  = '';
    document.getElementById('takeDifference').classList.add('hidden');

    resetRoundUI();
    updateScoreDisplay();
    updateGameStatus();
    autosaveGame();
}

// =============================================================================
// AI MOVE (basic fallback — full AI in ai-player.js)
// =============================================================================

function makeAIMove() {
    if (typeof makeAIMoveExternal === 'function') {
        makeAIMoveExternal();
        return;
    }
    if (gameState.redDice.length > 0) {
        var idx = Math.floor(Math.random() * gameState.redDice.length);
        selectDie('red', idx);
        setTimeout(function() {
            var emptyPockets = document.querySelectorAll('[data-player="red"].active');
            if (emptyPockets.length > 0) {
                var pick = Math.floor(Math.random() * emptyPockets.length);
                placeDieInPocket(emptyPockets[pick]);
            }
        }, 500);
    }
}

// =============================================================================
// INITIALISE
// =============================================================================

function initializeGame() {
    // Save state the instant the page loses focus or is about to go away -
    // a phone call, text alert, doorbell, switching apps, locking the phone,
    // closing the tab. This is the real safety net: it doesn't matter which
    // specific action the player was mid-way through, because it isn't tied
    // to any one button or tap. Anything this misses is also covered by the
    // explicit autosaveGame() calls throughout the rest of the file, but this
    // is what actually makes interruption-at-any-moment safe.
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') { autosaveGame(); }
    });
    window.addEventListener('pagehide', function() { autosaveGame(); });

    document.getElementById('startRound').addEventListener('click', startRound);

    document.getElementById('blueRoll').addEventListener('click', function() {
        if (gameState.finaleMode) { rollFinale('blue'); } else { rollPlayerDice('blue'); }
    });
    document.getElementById('redRoll').addEventListener('click', function() {
        if (gameState.finaleMode) { rollFinale('red'); } else { rollPlayerDice('red'); }
    });

    var startFinaleBtn = document.getElementById('startFinale');
    if (startFinaleBtn) { startFinaleBtn.addEventListener('click', startFinale); }

    document.getElementById('newGame').addEventListener('click', function() {
        showConfirm(
            'Start a new game?',
            'This will end the current game and reset the board. Are you sure?',
            newGame
        );
    });

    document.getElementById('blueRolloffDie').addEventListener('click', function() { rolloffRollDie('blue'); });
    document.getElementById('redRolloffDie').addEventListener('click',  function() { rolloffRollDie('red');  });

    var proceedBtn = document.getElementById('proceedFinalBtn');
    if (proceedBtn) { proceedBtn.addEventListener('click', proceedToFinalRound); }

    // Legacy modal buttons — stubs, kept for safety
    var blueModalBtn = document.getElementById('blueRollFinalDie');
    var redModalBtn  = document.getElementById('redRollFinalDie');
    if (blueModalBtn) { blueModalBtn.addEventListener('click', function() {}); }
    if (redModalBtn)  { redModalBtn.addEventListener('click',  function() {}); }

    var closeModal = document.getElementById('closeFinalModal');
    if (closeModal) { closeModal.addEventListener('click', closeFinalRollModal); }

    var shareBtn = document.getElementById('shareResult');
    if (shareBtn) { shareBtn.addEventListener('click', shareFinalResult); }

    var shareFooter = document.getElementById('shareResultFooter');
    if (shareFooter) { shareFooter.addEventListener('click', shareFinalResult); }

    var playAsBlue = document.getElementById('playAsBlue');
    var playAsRed  = document.getElementById('playAsRed');
    if (playAsBlue) {
        playAsBlue.addEventListener('click', function() { changeColorWithConfirm('blue'); });
    }
    if (playAsRed) {
        playAsRed.addEventListener('click', function() { changeColorWithConfirm('red'); });
    }

    document.getElementById('twoPlayerMode').addEventListener('click', function() {
        changeModeWithConfirm('2player');
    });
    document.getElementById('aiMode').addEventListener('click', function() {
        changeModeWithConfirm('ai');
    });

    function isDifficultyChangeSafe() {
        // "Safe" here means "a real game is under way, so a change must warn
        // and start a new game" — matching how mode and colour are guarded.
        // The old version only inspected the CURRENT round's roll/placement
        // state, so the window BEFORE rolling in any later round (e.g. Round 7
        // pre-roll) slipped through and silently changed difficulty with no
        // confirm modal. Anything past a fresh, untouched Round 1 now counts.
        return gameState.round > 1 ||
               gameState.blueRolled || gameState.redRolled ||
               gameState.phase === 'placing' ||
               gameState.phase === 'scoring' ||
               gameState.phase === 'finale' ||
               gameState.phase === 'gameOver' ||
               gameState.blueScore > 0 || gameState.redScore > 0;
    }
    function changeDifficultyGuarded(difficulty, revertEl) {
        if (isDifficultyChangeSafe()) {
            showSettingsChangeModal(
                function() { setAIDifficulty(difficulty); },
                function() { if (revertEl) { revertEl.value = (typeof aiDifficulty !== 'undefined') ? aiDifficulty : 'medium'; } }
            );
            return;
        }
        setAIDifficulty(difficulty);
    }

    document.getElementById('easyAI').addEventListener('click',   function() { changeDifficultyGuarded('easy');   });
    document.getElementById('mediumAI').addEventListener('click', function() { changeDifficultyGuarded('medium'); });
    document.getElementById('hardAI').addEventListener('click',   function() { changeDifficultyGuarded('hard');   });

    // Compact + Bitmap short-label dropdowns
    var cMode = document.getElementById('cMode');
    var cDiff = document.getElementById('cDiff');
    var cPlay = document.getElementById('cPlay');
    if (cMode) {
        cMode.addEventListener('change', function() { changeModeWithConfirm(this.value, cMode); });
    }
    if (cDiff) {
        cDiff.addEventListener('change', function() { changeDifficultyGuarded(this.value, cDiff); });
    }
    if (cPlay) {
        cPlay.addEventListener('change', function() { changeColorWithConfirm(this.value, cPlay); });
    }

    // Universal full-label dropdowns (Victorian, Steampunk, Art Deco, Cosmic, Dark)
    var uMode = document.getElementById('uMode');
    var uDiff = document.getElementById('uDiff');
    var uPlay = document.getElementById('uPlay');
    if (uMode) {
        uMode.addEventListener('change', function() { changeModeWithConfirm(this.value, uMode); });
    }
    if (uDiff) {
        uDiff.addEventListener('change', function() { changeDifficultyGuarded(this.value, uDiff); });
    }
    if (uPlay) {
        uPlay.addEventListener('change', function() { changeColorWithConfirm(this.value, uPlay); });
    }

    document.getElementById('viewStats').addEventListener('click', function() {
        if (typeof toggleStatsPanel === 'function') {
            toggleStatsPanel();
        } else if (window.PocketsStats && typeof window.PocketsStats.toggleStatsPanel === 'function') {
            window.PocketsStats.toggleStatsPanel();
        }
    });

    var savedGame = loadSavedGame();
    if (savedGame && savedGame.gameState) {
        restoreGameFromSave(savedGame);
    } else {
        applyDefaultOrSavedSettings();
    }

    syncCompactAIControlsVisibility();
    syncUniversalAIControlsVisibility();
    updateScoreDisplay();
    updateGameStatus();
    injectFullscreenButton();
}
