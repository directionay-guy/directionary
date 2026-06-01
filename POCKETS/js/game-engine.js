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
}

function setPlayerColor(color) {
    // AI is ALWAYS red internally — this is a visual/stats swap only
    gameState.humanColor = color;
    var container = document.querySelector('.game-container');
    if (container) {
        container.classList.toggle('playing-as-red', color === 'red');
    }

    // Swap roll dice button colors
    var blueRollBtn = document.getElementById('blueRoll');
    var redRollBtn  = document.getElementById('redRoll');
    if (blueRollBtn && redRollBtn) {
        blueRollBtn.classList.toggle('blue-btn', color === 'blue');
        blueRollBtn.classList.toggle('red-btn',  color === 'red');
        redRollBtn.classList.toggle('red-btn',   color === 'blue');
        redRollBtn.classList.toggle('blue-btn',  color === 'red');
    }

    // Update rolloff die aria-labels for accessibility
    var blueDieBtn = document.getElementById('blueRolloffDie');
    var redDieBtn  = document.getElementById('redRolloffDie');
    if (blueDieBtn) { blueDieBtn.setAttribute('aria-label', colorLabel(color === 'red' ? 'blue' : 'blue') + ': roll for first player'); }
    if (redDieBtn)  { redDieBtn.setAttribute('aria-label',  'AI: roll for first player'); }

    var blueBtn = document.getElementById('playAsBlue');
    var redBtn  = document.getElementById('playAsRed');
    if (blueBtn) { blueBtn.classList.toggle('active', color === 'blue'); }
    if (redBtn)  { redBtn.classList.toggle('active', color === 'red');   }
    // Update headers — human is on the BLUE side regardless of chosen color
    var is2p = (gameMode === '2player');
    document.getElementById('bluePlayerHeader').textContent =
        is2p ? 'BLUE PLAYER' : (color === 'red' ? '🔴 RED PLAYER (You)' : 'BLUE PLAYER');
    document.getElementById('redPlayerHeader').textContent  =
        is2p ? 'RED PLAYER'  : (color === 'red' ? '🔵 AI (Blue)'        : 'AI PLAYER');
    // Update score area labels
    var blueScoreLabel = document.getElementById('blueScoreLabel');
    var redScoreLabel  = document.getElementById('redScoreLabel');
    if (blueScoreLabel) {
        blueScoreLabel.textContent = is2p ? 'Blue Player Score' :
            (color === 'red' ? 'Red Player Score (You)' : 'Blue Player Score');
    }
    if (redScoreLabel) {
        redScoreLabel.textContent  = is2p ? 'Red Player Score'  :
            (color === 'red' ? 'AI Score (Blue)'        : 'Red Player Score');
    }

    // Force-refresh rolloff dice with correct visual colors immediately
    var blueDie = document.getElementById('blueRolloffDie');
    var redDie  = document.getElementById('redRolloffDie');
    if (blueDie) { setRolloffDieFaded(blueDie); }
    if (redDie)  { setRolloffDieFaded(redDie);  }
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
// FULL SCREEN — native API (CSS fallback can be added per-platform later)
// =============================================================================

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(function(err) {
            console.log('Fullscreen unavailable:', err);
        });
    } else {
        if (document.exitFullscreen) { document.exitFullscreen(); }
    }
}

function injectFullscreenButton() {
    if (document.getElementById('fullscreenBtn')) { return; }
    var gameModeEl = document.querySelector('.game-mode');
    if (!gameModeEl) { return; }

    var btn = document.createElement('button');
    btn.id          = 'fullscreenBtn';
    btn.className   = 'fullscreen-btn';
    btn.textContent = 'Full Screen';
    btn.addEventListener('click', toggleFullscreen);
    gameModeEl.appendChild(btn);

    document.addEventListener('fullscreenchange', function() {
        var b = document.getElementById('fullscreenBtn');
        if (b) { b.textContent = document.fullscreenElement ? 'Exit Full' : 'Full Screen'; }
    });
}

function setAIDifficulty(difficulty) {
    aiDifficulty = difficulty;
    document.querySelectorAll('.difficulty-btn').forEach(function(btn) {
        btn.classList.remove('active');
    });
    document.getElementById(difficulty + 'AI').classList.add('active');
}

// =============================================================================
// PANEL BOTTOM STRIP
// =============================================================================

function showPanelBottom(message) {
    var el = document.getElementById('actionShareResult');
    if (!el) { return; }
    el.textContent = message;
    el.classList.remove('hidden');
    setTimeout(function() { el.classList.add('visible'); }, 10);
}

function hidePanelBottom(instant) {
    var el = document.getElementById('actionShareResult');
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

function showConfirm(title, message, onConfirm) {
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

    function close() {
        modal.classList.add('hidden');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        modal.removeEventListener('click', onBackdrop);
    }
    function onOk()        { close(); if (onConfirm) { onConfirm(); } }
    function onCancel()    { close(); }
    function onBackdrop(e) { if (e.target === modal) { close(); } }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
}

// =============================================================================
// START ROUND
// =============================================================================

function startRound() {
    if (gameState.phase !== 'rolling') { return; }

    // Clear share pocket badges at start of new round
    document.getElementById('blueShareScore').classList.add('hidden');
    document.getElementById('redShareScore').classList.add('hidden');

    // Clear pockets (Keep Two and Share One only — Save One carries forward)
    var players = ['blue', 'red'];
    var pockets = ['Keep1', 'Keep2', 'Share'];
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
}

function showPlaceholderDice() {
    var players = ['blue', 'red'];
    for (var p = 0; p < players.length; p++) {
        var player  = players[p];
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
}

function resetRoundUI() {
    document.getElementById('shareDifference').classList.add('hidden');
    // Share pocket badges persist until startRound() — not cleared here
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

    setRolloffDieFaded(blueDie);
    setRolloffDieFaded(redDie);
    blueDie.disabled = false;
    redDie.disabled  = (gameMode === 'ai');

    var vsEl = document.querySelector('.rolloff-vs');
    if (vsEl) { vsEl.classList.remove('hidden'); }

    var result = document.getElementById('rolloffResult');
    result.textContent = '';
    result.classList.remove('winner');

    document.getElementById('firstPlayerRolloff').classList.remove('hidden');
    document.getElementById('playerRolls').classList.add('hidden');

    // Always set from current gameMode — fixes the AI->2player bug
    if (gameMode === 'ai') {
        var humanLabel = (gameState.humanColor === 'red') ? 'red' : 'blue';
        document.getElementById('rolloffPrompt').textContent =
            'Tap your ' + humanLabel + ' die — AI will roll right after.';
    } else {
        document.getElementById('rolloffPrompt').textContent =
            'Tap your die — higher number goes first!';
    }
}

function setRolloffDieFaded(buttonEl) {
    buttonEl.innerHTML = '';
    buttonEl.classList.add('faded');
    var isBlueButton = (buttonEl.id === 'blueRolloffDie');
    var showAsBlue   = (gameState.humanColor === 'red') ? !isBlueButton : isBlueButton;
    var svg = createDieSVG(1, 'rolloff-' + buttonEl.id, showAsBlue);
    buttonEl.appendChild(svg);

    // Force face+dot colors when swapped — reads theme CSS vars so each theme looks right
    if (gameState.humanColor === 'red') {
        var cs        = getComputedStyle(document.body);
        var isBitmap  = document.body.classList.contains('theme-bitmap');
        var humanFace, aiFace, humanDot, aiDot;
        if (isBitmap) {
            humanFace = '#f4dddd';
            aiFace    = '#dde4f4';
            humanDot  = '#800000';
            aiDot     = '#000080';
        } else {
            humanFace = cs.getPropertyValue('--burgundy').trim() || '#6e3030';
            aiFace    = cs.getPropertyValue('--navy').trim()     || '#2a3559';
            humanDot  = cs.getPropertyValue('--gold-pale').trim() || '#c8a84b';
            aiDot     = cs.getPropertyValue('--gold-pale').trim() || '#c8a84b';
        }
        var faceFill   = isBlueButton ? humanFace : aiFace;
        var faceStroke = isBlueButton ? humanDot  : aiDot;  // stroke matches dot color
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
    var showAsBlue = (gameState.humanColor === 'red') ? (player !== 'blue') : (player === 'blue');
    var rollSvg  = createDieSVG(startVal, 'rolloff-' + player + '-' + Date.now(), showAsBlue);
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
            // Keep dice showing their actual tied values — just re-fade them.
            // Resetting to placeholder 1s caused the "Tied at X but I see 1s" confusion.
            bd.classList.add('faded');
            rd.classList.add('faded');
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

    var winnerName, winnerColor;
    if (winner === 'blue') {
        winnerName  = colorLabelUpper('blue');
        winnerColor = (gameState.humanColor === 'red') ? '#e24a4a' : '#4a90e2';
    } else if (gameMode === 'ai') {
        winnerName  = 'AI';
        winnerColor = (gameState.humanColor === 'red') ? '#4a90e2' : '#e24a4a';
    } else {
        winnerName  = colorLabelUpper('red');
        winnerColor = (gameState.humanColor === 'red') ? '#4a90e2' : '#e24a4a';
    }

    result.classList.add('winner');
    result.innerHTML = '🏆 <span style="color:' + winnerColor + '">' + winnerName + '</span> goes first!';

    setTimeout(function() {
        setActionPanelView('rolls');
        var blueBtn = document.getElementById('blueRoll');
        var redBtn  = document.getElementById('redRoll');
        blueBtn.classList.remove('hidden');
        redBtn.classList.remove('hidden');

        // Dim non-first player's button — winner of rolloff goes first
        var secondColor = (winner === 'blue') ? 'red' : 'blue';
        document.getElementById(secondColor + 'Roll').disabled = true;

        if (gameMode === 'ai') {
            document.getElementById('redRoll').textContent = '🤖 AI Will Roll';
            if (winner === 'red') {
                setTimeout(function() { rollPlayerDice('red'); }, 900);
            }
        }
        updateGameStatus();
    }, 2000);
}

// =============================================================================
// PLAYER DICE ROLLING
// =============================================================================

function rollPlayerDice(player) {
    if (player === 'blue' && gameState.blueRolled) { return; }
    if (player === 'red'  && gameState.redRolled)  { return; }

    var btn = document.getElementById(player + 'Roll');
    btn.disabled = true;

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
        btn.textContent = colorEmoji('blue') + ' ' + colorLabel('blue') + ' Rolled';
    } else if (gameMode === 'ai') {
        btn.textContent = '🤖 AI Rolled';
    } else {
        btn.textContent = colorEmoji('red') + ' ' + colorLabel('red') + ' Rolled';
    }

    // Enable the other player's button now it's their turn to roll
    var otherColor = (player === 'blue') ? 'red' : 'blue';
    var otherBtn   = document.getElementById(otherColor + 'Roll');
    if (otherBtn && !gameState[otherColor + 'Rolled']) {
        otherBtn.disabled = false;
    }

    if (gameMode === 'ai' && player === 'blue' && !gameState.redRolled) {
        setTimeout(function() { rollPlayerDice('red'); }, 1500);
    }

    if (gameState.blueRolled && gameState.redRolled) {
        setTimeout(function() { startPlacement(); }, 1000);
    }
}

function renderDiceWithAnimation(player, dice) {
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
        // Non-saved dice start random and cycle to the final value.
        var startVal = isSaved ? value : Math.floor(Math.random() * 6) + 1;
        var die      = createDieSVG(startVal, player + '-' + i, isSaved);
        die.setAttribute('data-value', value);   // override startVal with correct final value
        if (!isSaved) { die.classList.add('rolling'); }  // saved dice don't animate

        // Closure captures die element, final value, saved flag, and index
        (function(dieEl, finalValue, isSavedDie, dieIdx) {
            dieEl.addEventListener('click', function() { selectDie(player, dieIdx); });

            if (!isSavedDie) {
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
        setTimeout(function() { makeAIMove(); }, 1000);
    }
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
            setTimeout(function() { makeAIMove(); }, 500);
        }
    } else {
        calculateRoundScore();
    }

    updateShareDifference();
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
    if (pocketType === 'share') {
        var dicEls = pocketElement.querySelectorAll('.dice');
        if (dicEls.length > 0) {
            var scoreEl = document.getElementById(player + 'ShareScore');
            scoreEl.textContent = dicEls[0].getAttribute('data-value');
            scoreEl.classList.remove('hidden');
        }
    }
}

function updateShareDifference() {
    var bluePockets = getDiceFromPockets('blue');
    var redPockets  = getDiceFromPockets('red');
    var blueShare   = bluePockets.share || [];
    var redShare    = redPockets.share  || [];

    document.getElementById('shareDifference').classList.add('hidden');

    if (blueShare.length > 0 && redShare.length > 0) {
        var bd   = blueShare[0];
        var rd   = redShare[0];
        var diff = Math.abs(bd - rd);

        if (diff > 0 && bd > rd) {
            document.getElementById('blueShareScore').textContent = '+' + diff;
        } else {
            document.getElementById('blueShareScore').textContent = '0';
        }

        if (diff > 0 && rd > bd) {
            document.getElementById('redShareScore').textContent = '+' + diff;
        } else {
            document.getElementById('redShareScore').textContent = '0';
        }

        // Share win/loss message removed — redundant, players see pocket numbers
    }
}

function getDiceFromPockets(player) {
    var pockets   = {};
    var pocketTypes = ['keep1', 'keep2', 'share', 'save'];

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

    var blueShareDie = 0;
    var redShareDie  = 0;
    if (bluePockets.share && bluePockets.share.length > 0) { blueShareDie = bluePockets.share[0]; }
    if (redPockets.share  && redPockets.share.length  > 0) { redShareDie  = redPockets.share[0];  }

    var blueBonus      = 0;
    var redBonus       = 0;
    var blueComboBonus = 0;
    var redComboBonus  = 0;

    if (blueShareDie > redShareDie) {
        blueBonus      = blueShareDie - redShareDie;
        blueComboBonus = calculateBonusPoints(gameState.blueOriginalRoll);
        blueBonus      = blueBonus + blueComboBonus;
    } else if (redShareDie > blueShareDie) {
        redBonus      = redShareDie - blueShareDie;
        redComboBonus = calculateBonusPoints(gameState.redOriginalRoll);
        redBonus      = redBonus + redComboBonus;
    }

    // Share result element cleared — message removed

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

    var blueDiv = document.createElement('div');
    blueDiv.className = 'round-score-display';
    var blueText = 'Round Score: ' + (blueKeep + blueBonus) + ' pts';
    if (blueBonus > 0) {
        blueText += '<br>Keep: ' + blueKeep + ', Share: ' + (blueBonus - blueCombo);
        if (blueCombo > 0) { blueText += ', Bonus: ' + blueCombo; }
    } else {
        blueText += '<br>Keep: ' + blueKeep;
    }
    blueDiv.innerHTML = blueText;
    blueDiceArea.appendChild(blueDiv);

    var redDiv = document.createElement('div');
    redDiv.className = 'round-score-display';
    var redText = 'Round Score: ' + (redKeep + redBonus) + ' pts';
    if (redBonus > 0) {
        redText += '<br>Keep: ' + redKeep + ', Share: ' + (redBonus - redCombo);
        if (redCombo > 0) { redText += ', Bonus: ' + redCombo; }
    } else {
        redText += '<br>Keep: ' + redKeep;
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

    // Hide regular pockets — Keep Two and Share One only
    var keepShare = document.querySelectorAll(
        '.pocket[data-pocket="keep1"], .pocket[data-pocket="keep2"], .pocket[data-pocket="share"]'
    );
    keepShare.forEach(function(p) { p.classList.add('finale-hidden'); });

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
        gameState.finaleCurrentPlayer === 'blue' ? "Blue's Finale roll" : "Red's Finale roll";

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
        document.getElementById('redRoll').textContent = (gameState.finaleRolls.red.length >= 4) ? 'AI Done' : 'AI Rolling...';
        redBtn.disabled    = true;
    } else {
        redBtn.textContent = redDone ? colorLabel('red') + ' Done' : colorLabel('red') + ' Roll ' + redNum + ' of 4';
        redBtn.disabled    = (player !== 'red') || redDone;
    }

    document.getElementById('turnInfo').textContent =
        blueDone && redDone ? 'Calculating final scores...' :
        player === 'blue'   ? "Blue's Rolldown roll" : "Red's Rolldown roll";
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

    resetRoundUI();
    document.getElementById('currentRound').textContent = gameState.round;
    document.getElementById('startRound').textContent   = 'Start Round ' + gameState.round;
    setActionPanelView('start');
    resetRollButtons();
    updateGameStatus();
}

function resetRollButtons() {
    var blueBtn    = document.getElementById('blueRoll');
    var redBtn     = document.getElementById('redRoll');
    var humanIsRed = (gameState.humanColor === 'red');

    // Enforce correct color classes every round
    blueBtn.classList.toggle('blue-btn', !humanIsRed);
    blueBtn.classList.toggle('red-btn',   humanIsRed);
    redBtn.classList.toggle('red-btn',   !humanIsRed);
    redBtn.classList.toggle('blue-btn',   humanIsRed);

    blueBtn.disabled    = false;
    blueBtn.textContent = colorLabel('blue') + ' Roll Dice';
    blueBtn.classList.add('hidden');

    redBtn.disabled    = false;
    redBtn.textContent = colorLabel('red') + ' Roll Dice';
    redBtn.classList.add('hidden');
}

// =============================================================================
// END GAME
// =============================================================================

function endGame() {
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

    // Show share button in footer
    var shareFooter = document.getElementById('shareResultFooter');
    if (shareFooter) { shareFooter.classList.remove('hidden'); }

    if (typeof saveGameStats === 'function') {
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
    document.getElementById('blueShareScore').classList.add('hidden');
    document.getElementById('redShareScore').classList.add('hidden');

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
    var keepShare = document.querySelectorAll('.pocket.finale-hidden');
    keepShare.forEach(function(p) { p.classList.remove('finale-hidden'); });

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
    document.getElementById('shareDifference').classList.add('hidden');

    resetRoundUI();
    updateScoreDisplay();
    updateGameStatus();
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
        playAsBlue.addEventListener('click', function() {
            if (gameState.humanColor === 'blue') { return; } // already blue, no-op
            showConfirm(
                'Switch to Blue?',
                'Switching colors will start a new game. Current progress will be lost.',
                function() { setPlayerColor('blue'); newGame(); }
            );
        });
    }
    if (playAsRed) {
        playAsRed.addEventListener('click', function() {
            if (gameState.humanColor === 'red') { return; } // already red, no-op
            showConfirm(
                'Switch to Red?',
                'Switching colors will start a new game. Current progress will be lost.',
                function() { setPlayerColor('red'); newGame(); }
            );
        });
    }

    document.getElementById('twoPlayerMode').addEventListener('click', function() { setGameMode('2player'); });
    document.getElementById('aiMode').addEventListener('click',        function() { setGameMode('ai');      });

    document.getElementById('easyAI').addEventListener('click',   function() { setAIDifficulty('easy');   });
    document.getElementById('mediumAI').addEventListener('click', function() { setAIDifficulty('medium'); });
    document.getElementById('hardAI').addEventListener('click',   function() { setAIDifficulty('hard');   });

    document.getElementById('viewStats').addEventListener('click', function() {
        if (typeof toggleStatsPanel === 'function') {
            toggleStatsPanel();
        } else if (window.PocketsStats && typeof window.PocketsStats.toggleStatsPanel === 'function') {
            window.PocketsStats.toggleStatsPanel();
        }
    });

    updateScoreDisplay();
    updateGameStatus();
    injectFullscreenButton();
}
