// POCKETS GAME ENGINE
// 10 regular rounds + Grand Finale (Round 11)
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
    redFinalRolled: false
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
    if (mode === '2player') {
        document.getElementById('twoPlayerMode').classList.add('active');
        document.getElementById('aiDifficulty').classList.add('hidden');
        document.getElementById('redPlayerHeader').textContent = 'RED PLAYER';
    } else {
        document.getElementById('aiMode').classList.add('active');
        document.getElementById('aiDifficulty').classList.remove('hidden');
        document.getElementById('redPlayerHeader').textContent = 'AI PLAYER';
    }
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
// FULL SCREEN
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
    btn.id        = 'fullscreenBtn';
    btn.className = 'fullscreen-btn';
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
    // Pre-final phase: "Start Final Round" button was clicked
    if (gameState.phase === 'pre-final') {
        hidePanelBottom(false);
        startFinalRollDrama();
        return;
    }

    if (gameState.phase !== 'rolling') { return; }

    // Clear share pocket badges at start of new round
    document.getElementById('blueShareScore').classList.add('hidden');
    document.getElementById('redShareScore').classList.add('hidden');

    // Clear pockets
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

    if (gameState.round === 10) {
        setActionPanelView('status');
        document.getElementById('turnInfo').textContent =
            'The final round — your Save die carries into the Grand Finale. Choose wisely!';
        setTimeout(function() { startFirstPlayerRolloff(); }, 2400);
    } else {
        startFirstPlayerRolloff();
    }
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
        document.getElementById('rolloffPrompt').textContent =
            'Tap your blue die — AI will roll right after.';
    } else {
        document.getElementById('rolloffPrompt').textContent =
            'Tap your die — higher number goes first!';
    }
}

function setRolloffDieFaded(buttonEl) {
    buttonEl.innerHTML = '';
    buttonEl.classList.add('faded');
    buttonEl.appendChild(createDieSVG(1, 'rolloff-' + buttonEl.id, false));
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
    var rollSvg  = createDieSVG(startVal, 'rolloff-' + player + '-' + Date.now(), false);
    dieEl.innerHTML = '';
    dieEl.appendChild(rollSvg);

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
        winnerName  = 'BLUE';
        winnerColor = '#4a90e2';
    } else if (gameMode === 'ai') {
        winnerName  = 'AI';
        winnerColor = '#e24a4a';
    } else {
        winnerName  = 'RED';
        winnerColor = '#e24a4a';
    }

    result.classList.add('winner');
    result.innerHTML = '🏆 <span style="color:' + winnerColor + '">' + winnerName + '</span> goes first!';

    setTimeout(function() {
        setActionPanelView('rolls');
        document.getElementById('blueRoll').classList.remove('hidden');
        document.getElementById('redRoll').classList.remove('hidden');
        if (gameMode === 'ai') {
            document.getElementById('redRoll').textContent = '🤖 AI Will Roll';
            document.getElementById('redRoll').disabled = true;
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
        btn.textContent = '🔵 Blue Rolled';
    } else if (gameMode === 'ai') {
        btn.textContent = '🤖 AI Rolled';
    } else {
        btn.textContent = '🔴 Red Rolled';
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
        die.dataset.value = value;   // store actual value on element — immune to array splice shifting
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
        gameState.selectedDie = { player: player, index: index };
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
    // Read value from the die element itself — array indices shift after each splice
    var selectedEl = document.querySelector('[data-id="' + player + '-' + index + '"]');
    var dieValue = selectedEl ? parseInt(selectedEl.dataset.value)
                              : ((player === 'blue') ? gameState.blueDice[index] : gameState.redDice[index]);

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
            scoreEl.textContent = dicEls[0].dataset.value;
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

        var shareMsg;
        if (diff === 0) {
            shareMsg = 'Share: Tied — no bonus';
        } else if (bd > rd) {
            shareMsg = 'Share: Blue wins by ' + diff + (diff === 1 ? ' point' : ' points');
        } else {
            shareMsg = 'Share: Red wins by ' + diff + (diff === 1 ? ' point' : ' points');
        }

        showPanelBottom(shareMsg);
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
        diceEls.forEach(function(d) { values.push(parseInt(d.dataset.value)); });
        if (values.length > 0) { pockets[pt] = values; }
    }

    return pockets;
}

// =============================================================================
// SCORING
// =============================================================================

function calculateRoundScore() {
    gameState.phase = 'scoring';

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

    // Update share bottom strip with bonus info now that scoring is done
    var shareEl = document.getElementById('actionShareResult');
    if (shareEl && !shareEl.classList.contains('hidden')) {
        if (blueShareDie > redShareDie) {
            var bd   = blueShareDie - redShareDie;
            var bTxt = (blueComboBonus > 0) ? ' + ' + blueComboBonus + ' bonus' : ' no bonus';
            shareEl.textContent = 'Share: Blue wins by ' + bd +
                (bd === 1 ? ' point' : ' points') + ' ' + bTxt;
        } else if (redShareDie > blueShareDie) {
            var rd   = redShareDie - blueShareDie;
            var rTxt = (redComboBonus > 0) ? ' + ' + redComboBonus + ' bonus' : ' no bonus';
            shareEl.textContent = 'Share: Red wins by ' + rd +
                (rd === 1 ? ' point' : ' points') + ' ' + rTxt;
        }
    }

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
        if (gameState.round < 9) {
            nextRound();
        } else if (gameState.round === 9) {
            nextRound();
            setTimeout(function() {
                showPanelBottom('Round 10 next — the last before the Grand Finale. Choose your Save wisely!');
            }, 400);
        } else if (gameState.round === 10) {
            showPreFinalInPanel();
        } else {
            finalRound();
        }
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
// PRE-FINAL (in-panel flow — no modal)
// =============================================================================

function showPreFinalInPanel() {
    gameState.phase = 'pre-final';

    setActionPanelView('status');
    document.getElementById('turnInfo').textContent =
        'The Grand Finale awaits — all scores settled!';

    setTimeout(function() {
        showPanelBottom('The Grand Finale awaits — all scores settled!');
        document.getElementById('turnInfo').textContent = '';
        setActionPanelView('start');
        document.getElementById('startRound').textContent = 'Start Final Round';
    }, 1800);
}

// Kept for proceedFinalBtn HTML compatibility
function proceedToFinalRound() {
    hidePanelBottom(false);
    startFinalRollDrama();
}

// =============================================================================
// FINAL ROLL DRAMA
// =============================================================================

function startFinalRollDrama() {
    gameState.phase = 'final';
    gameState.round = 11;
    document.getElementById('currentRound').textContent = '11 (FINAL)';

    gameState.finalRoll = {
        blueRolls:     [],
        redRolls:      [],
        currentPlayer: gameState.firstPlayer || 'blue',
        maxPerPlayer:  4
    };

    setSavedDieSlot('blueSavedDieValue', gameState.blueSavedDie);
    setSavedDieSlot('redSavedDieValue',  gameState.redSavedDie);

    document.getElementById('blueRunningTotal').textContent =
        gameState.blueSavedDie ? gameState.blueSavedDie : 0;
    document.getElementById('redRunningTotal').textContent =
        gameState.redSavedDie  ? gameState.redSavedDie  : 0;

    document.getElementById('blueDiceRolled').innerHTML      = '';
    document.getElementById('redDiceRolled').innerHTML       = '';
    document.getElementById('blueComboBonusDisplay').textContent = '';
    document.getElementById('redComboBonusDisplay').textContent  = '';

    document.getElementById('finalCelebration').classList.add('hidden');
    document.getElementById('blueRollFinalDie').classList.remove('hidden');
    document.getElementById('redRollFinalDie').classList.remove('hidden');
    document.getElementById('dramaMessage').textContent = 'The final showdown begins!';

    // Strip any emoji from the modal title for themed builds
    var finalTitle = document.querySelector('#finalRollModal h2');
    if (finalTitle) {
        finalTitle.textContent = 'FINAL ROUND';
    }

    setActiveTurnUI(gameState.finalRoll.currentPlayer);
    document.getElementById('finalRollModal').classList.remove('hidden');
    maybeAutoRollForAI();
}

function setSavedDieSlot(slotId, value) {
    var slot = document.getElementById(slotId);
    slot.innerHTML = '';
    if (value !== null && value !== undefined) {
        slot.appendChild(createDieSVG(value, 'saved-' + slotId, true));
    } else {
        slot.textContent = '—';
    }
}

function setActiveTurnUI(player) {
    var blueCard = document.getElementById('blueFinalCard');
    var redCard  = document.getElementById('redFinalCard');

    if (player === 'blue') {
        blueCard.classList.add('active-turn');
        redCard.classList.remove('active-turn');
    } else {
        redCard.classList.add('active-turn');
        blueCard.classList.remove('active-turn');
    }

    var msg = document.getElementById('currentTurnMessage');
    if (player === 'blue') {
        msg.textContent = "Blue's turn — tap your button";
    } else if (gameMode === 'ai') {
        msg.textContent = 'AI is rolling...';
    } else {
        msg.textContent = "Red's turn — tap your button";
    }

    var blueBtn = document.getElementById('blueRollFinalDie');
    var redBtn  = document.getElementById('redRollFinalDie');
    if (blueBtn) { blueBtn.disabled = (player !== 'blue'); }
    if (redBtn)  { redBtn.disabled  = (player !== 'red') || (gameMode === 'ai'); }
}

function maybeAutoRollForAI() {
    var fr = gameState.finalRoll;
    if (!fr) { return; }
    if (gameMode === 'ai' && fr.currentPlayer === 'red') {
        document.getElementById('redRollFinalDie').disabled = true;
        setTimeout(function() { rollFinalDie(); }, 1200);
    }
}

function rollFinalDie() {
    var fr = gameState.finalRoll;
    if (!fr) { return; }
    if (fr.blueRolls.length >= fr.maxPerPlayer &&
        fr.redRolls.length  >= fr.maxPerPlayer) { return; }

    var player = fr.currentPlayer;
    var value  = Math.floor(Math.random() * 6) + 1;

    if (player === 'blue') {
        fr.blueRolls.push(value);
    } else {
        fr.redRolls.push(value);
    }

    var containerId = (player === 'blue') ? 'blueDiceRolled' : 'redDiceRolled';
    var rollCount   = (player === 'blue') ? fr.blueRolls.length : fr.redRolls.length;
    var dieEl       = createDieSVG(value, 'final-' + player + '-' + rollCount, false);
    dieEl.classList.add('dice-rolled');
    document.getElementById(containerId).appendChild(dieEl);

    var totalId   = (player === 'blue') ? 'blueRunningTotal' : 'redRunningTotal';
    var totalEl   = document.getElementById(totalId);
    var baseSaved = (player === 'blue') ? (gameState.blueSavedDie || 0) : (gameState.redSavedDie || 0);
    var rolls     = (player === 'blue') ? fr.blueRolls : fr.redRolls;
    var rollsSum  = rolls.reduce(function(a, b) { return a + b; }, 0);
    totalEl.textContent = baseSaved + rollsSum;
    totalEl.classList.add('bumped');
    setTimeout(function() { totalEl.classList.remove('bumped'); }, 260);

    updateDramaMessage(player, value);

    var blueDone = (fr.blueRolls.length >= fr.maxPerPlayer);
    var redDone  = (fr.redRolls.length  >= fr.maxPerPlayer);

    if (blueDone) { document.getElementById('blueRollFinalDie').classList.add('hidden'); }
    if (redDone)  { document.getElementById('redRollFinalDie').classList.add('hidden');  }

    if (blueDone && redDone) {
        setTimeout(function() { finalizeFinalRoll(); }, 900);
        return;
    }

    var next;
    if (!blueDone && !redDone) {
        next = (player === 'blue') ? 'red' : 'blue';
    } else if (!blueDone) {
        next = 'blue';
    } else {
        next = 'red';
    }

    fr.currentPlayer = next;
    setActiveTurnUI(next);

    if (gameMode === 'ai' && next === 'red') {
        document.getElementById('redRollFinalDie').disabled = true;
        setTimeout(function() { rollFinalDie(); }, 1100);
    }
}

function updateDramaMessage(rollerPlayer, rollValue) {
    var fr      = gameState.finalRoll;
    var blueSum = fr.blueRolls.reduce(function(a, b) { return a + b; }, 0);
    var redSum  = fr.redRolls.reduce(function(a, b) { return a + b; }, 0);
    var blueLive = (gameState.blueSavedDie || 0) + blueSum;
    var redLive  = (gameState.redSavedDie  || 0) + redSum;

    var label  = (rollerPlayer === 'blue') ? 'Blue' : 'Red';
    var flavor = '';
    if (rollValue === 6) { flavor = ' Big roll!'; }
    if (rollValue === 1) { flavor = ' Ouch.'; }

    var standing;
    if (blueLive === redLive) {
        standing = 'Tied at ' + blueLive + ' — anyone\'s game!';
    } else if (blueLive > redLive) {
        standing = 'Blue leads by ' + (blueLive - redLive) + '.';
    } else {
        standing = 'Red leads by ' + (redLive - blueLive) + '.';
    }

    document.getElementById('dramaMessage').textContent =
        label + ' rolled a ' + rollValue + '.' + flavor + ' ' + standing;
}

function finalizeFinalRoll() {
    var fr = gameState.finalRoll;

    var blueHand = fr.blueRolls.slice();
    if (gameState.blueSavedDie !== null && gameState.blueSavedDie !== undefined) {
        blueHand.push(gameState.blueSavedDie);
    }

    var redHand = fr.redRolls.slice();
    if (gameState.redSavedDie !== null && gameState.redSavedDie !== undefined) {
        redHand.push(gameState.redSavedDie);
    }

    var blueDiceTotal  = blueHand.reduce(function(a, b) { return a + b; }, 0);
    var redDiceTotal   = redHand.reduce(function(a, b) { return a + b; }, 0);
    var blueComboBonus = calculateBonusPoints(blueHand);
    var redComboBonus  = calculateBonusPoints(redHand);
    var blueFinal      = blueDiceTotal + blueComboBonus;
    var redFinal       = redDiceTotal  + redComboBonus;

    document.getElementById('blueRunningTotal').textContent = blueFinal;
    document.getElementById('redRunningTotal').textContent  = redFinal;

    fr.blueHand           = blueHand;
    fr.redHand            = redHand;
    fr.blueComboBonus     = blueComboBonus;
    fr.redComboBonus      = redComboBonus;
    fr.blueFinalRoundTotal = blueFinal;
    fr.redFinalRoundTotal  = redFinal;

    if (blueComboBonus > 0) {
        document.getElementById('blueComboBonusDisplay').textContent = '+' + blueComboBonus + ' bonus';
    } else {
        document.getElementById('blueComboBonusDisplay').textContent = '';
    }
    if (redComboBonus > 0) {
        document.getElementById('redComboBonusDisplay').textContent = '+' + redComboBonus + ' bonus';
    } else {
        document.getElementById('redComboBonusDisplay').textContent = '';
    }

    if (blueComboBonus === 0 && redComboBonus === 0) {
        document.getElementById('dramaMessage').textContent = 'No bonus points this round.';
    } else {
        document.getElementById('dramaMessage').textContent = '';
    }
    document.getElementById('currentTurnMessage').textContent = '';

    var blueGameTotal = gameState.blueScore + blueFinal;
    var redGameTotal  = gameState.redScore  + redFinal;

    var winnerText, marginText;
    if (blueGameTotal > redGameTotal) {
        winnerText  = 'BLUE WINS!';
        marginText  = 'Final score: ' + blueGameTotal + ' to ' + redGameTotal +
                      ' (margin of ' + (blueGameTotal - redGameTotal) + ')';
    } else if (redGameTotal > blueGameTotal) {
        winnerText  = 'RED WINS!';
        marginText  = 'Final score: ' + redGameTotal + ' to ' + blueGameTotal +
                      ' (margin of ' + (redGameTotal - blueGameTotal) + ')';
    } else {
        winnerText  = "IT'S A TIE!";
        marginText  = 'Both players ended at ' + blueGameTotal + ' points.';
    }

    document.getElementById('winnerAnnouncement').textContent = winnerText;
    document.getElementById('finalMargin').textContent        = marginText;

    document.getElementById('blueFinalCard').classList.remove('active-turn');
    document.getElementById('redFinalCard').classList.remove('active-turn');
    document.getElementById('finalCelebration').classList.remove('hidden');
}

function closeFinalRollModal() {
    var fr = gameState.finalRoll;
    if (!fr || fr.blueFinalRoundTotal === null || fr.blueFinalRoundTotal === undefined) {
        document.getElementById('finalRollModal').classList.add('hidden');
        return;
    }

    gameState.blueDice = fr.blueHand;
    gameState.redDice  = fr.redHand;

    document.getElementById('finalRollModal').classList.add('hidden');
    document.getElementById('blueDiceArea').innerHTML = '';
    document.getElementById('redDiceArea').innerHTML  = '';

    var allPockets = document.querySelectorAll('.pockets');
    allPockets.forEach(function(p) { p.style.display = 'none'; });

    renderFinalDice();

    var blueDiceTotal = fr.blueHand.reduce(function(a, b) { return a + b; }, 0);
    var redDiceTotal  = fr.redHand.reduce(function(a, b) { return a + b; }, 0);
    displayFinalScores(fr.blueHand, fr.redHand, blueDiceTotal, redDiceTotal,
                       fr.blueComboBonus, fr.redComboBonus);

    gameState.blueScore += fr.blueFinalRoundTotal;
    gameState.redScore  += fr.redFinalRoundTotal;
    updateScoreDisplay();
    endGame();
}

function shareFinalResult() {
    var fr = gameState.finalRoll;
    var blueTotal = gameState.blueScore;
    var redTotal  = gameState.redScore;
    if (fr && fr.blueFinalRoundTotal) { blueTotal += fr.blueFinalRoundTotal; }
    if (fr && fr.redFinalRoundTotal)  { redTotal  += fr.redFinalRoundTotal;  }

    var resultLine;
    if (blueTotal > redTotal) {
        resultLine = 'Blue wins ' + blueTotal + ' to ' + redTotal;
    } else if (redTotal > blueTotal) {
        resultLine = 'Red wins ' + redTotal + ' to ' + blueTotal;
    } else {
        resultLine = 'Tie at ' + blueTotal;
    }

    var text = 'POCKETS — ' + resultLine + '\nA strategic dice game.';

    if (navigator.share) {
        navigator.share({ title: 'POCKETS', text: text }).catch(function() {});
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function() {
            var ids = ['shareResult', 'shareResultFooter'];
            for (var i = 0; i < ids.length; i++) {
                var btn = document.getElementById(ids[i]);
                if (btn && !btn.classList.contains('hidden')) {
                    (function(b) {
                        var orig = b.textContent;
                        b.textContent = 'Copied!';
                        setTimeout(function() { b.textContent = orig; }, 1800);
                    })(btn);
                }
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
            playerName = gameState.currentPlayer.charAt(0).toUpperCase() +
                         gameState.currentPlayer.slice(1);
        }
        turnInfo.textContent = playerName + ' places a die';
        var showHint = (gameState.round === 1) &&
                       ((gameState.placementTurn === 0) ||
                        (gameState.placementTurn === 1 && gameMode !== 'ai'));
        if (showHint) {
            var hintHtml = playerName + ' places a die';
            hintHtml += '<br><span class="placement-hint">Tap a die · then tap a pocket</span>';
            turnInfo.innerHTML = hintHtml;
        }
    } else if (gameState.phase === 'scoring') {
        turnInfo.textContent = 'Round complete — calculating scores...';
    } else if (gameState.phase === 'pre-final') {
        turnInfo.textContent = '';
    } else if (gameState.phase === 'final') {
        turnInfo.textContent = 'Final scoring round';
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
    var blueBtn = document.getElementById('blueRoll');
    var redBtn  = document.getElementById('redRoll');

    blueBtn.disabled    = false;
    blueBtn.textContent = 'Blue Roll Dice';
    blueBtn.classList.add('hidden');

    redBtn.disabled = false;
    if (gameMode === 'ai') {
        redBtn.textContent = 'AI Will Roll';
    } else {
        redBtn.textContent = 'Red Roll Dice';
    }
    redBtn.classList.add('hidden');
}

// =============================================================================
// FINAL ROUND (auto-roll fallback, used if drama modal skipped)
// =============================================================================

function finalRound() {
    gameState.round = 11;
    gameState.phase = 'final';
    document.getElementById('currentRound').textContent = '11 (FINAL)';

    var allPockets = document.querySelectorAll('.pockets');
    allPockets.forEach(function(p) { p.style.display = 'none'; });

    document.getElementById('blueDiceArea').innerHTML = '';
    document.getElementById('redDiceArea').innerHTML  = '';

    gameState.blueDice = [];
    gameState.redDice  = [];

    for (var i = 0; i < 4; i++) {
        gameState.blueDice.push(Math.floor(Math.random() * 6) + 1);
        gameState.redDice.push(Math.floor(Math.random() * 6) + 1);
    }
    if (gameState.blueSavedDie) { gameState.blueDice.push(gameState.blueSavedDie); }
    if (gameState.redSavedDie)  { gameState.redDice.push(gameState.redSavedDie);   }

    renderFinalDice();

    var blueDiceTotal  = gameState.blueDice.reduce(function(a,b){return a+b;},0);
    var redDiceTotal   = gameState.redDice.reduce(function(a,b){return a+b;},0);
    var blueComboBonus = calculateBonusPoints(gameState.blueDice);
    var redComboBonus  = calculateBonusPoints(gameState.redDice);

    displayFinalScores(gameState.blueDice, gameState.redDice,
                       blueDiceTotal, redDiceTotal,
                       blueComboBonus, redComboBonus);

    gameState.blueScore += blueDiceTotal + blueComboBonus;
    gameState.redScore  += redDiceTotal  + redComboBonus;
    updateScoreDisplay();

    setTimeout(function() { endGame(); }, 3000);
}

function renderFinalDice() {
    var blueDiceArea = document.getElementById('blueDiceArea');
    var redDiceArea  = document.getElementById('redDiceArea');

    for (var i = 0; i < gameState.blueDice.length; i++) {
        var bVal    = gameState.blueDice[i];
        var bSaved  = (i === gameState.blueDice.length - 1 && gameState.blueSavedDie);
        var bDie    = createDieSVG(bVal, 'blue-final-' + i, bSaved);
        bDie.classList.add(bSaved ? 'jitter' : 'rolling');
        blueDiceArea.appendChild(bDie);
    }

    for (var j = 0; j < gameState.redDice.length; j++) {
        var rVal   = gameState.redDice[j];
        var rSaved = (j === gameState.redDice.length - 1 && gameState.redSavedDie);
        var rDie   = createDieSVG(rVal, 'red-final-' + j, rSaved);
        rDie.classList.add(rSaved ? 'jitter' : 'rolling');
        redDiceArea.appendChild(rDie);
    }

    setTimeout(function() {
        var all = document.querySelectorAll('.dice');
        all.forEach(function(d) {
            d.classList.remove('rolling');
            d.classList.remove('jitter');
        });
    }, 800);
}

function displayFinalScores(blueDice, redDice, blueTotal, redTotal, blueBonus, redBonus) {
    var blueArea = document.querySelector('.player-area.blue');
    var redArea  = document.querySelector('.player-area.red');

    var blueDiv = document.createElement('div');
    blueDiv.className = 'final-score-display';
    blueDiv.innerHTML =
        '<div class="final-score-title">FINAL ROUND</div>' +
        '<div class="final-score-breakdown">5 Dice Total: ' + blueTotal + '</div>' +
        '<div class="final-score-breakdown">Dice: [' + blueDice.join(', ') + ']</div>' +
        '<div class="final-score-breakdown">Bonus Points: +' + blueBonus + '</div>' +
        '<div class="final-score-total">FINAL ROUND TOTAL: ' + (blueTotal + blueBonus) + ' pts</div>';
    blueArea.appendChild(blueDiv);

    var redDiv = document.createElement('div');
    redDiv.className = 'final-score-display';
    redDiv.innerHTML =
        '<div class="final-score-title">FINAL ROUND</div>' +
        '<div class="final-score-breakdown">5 Dice Total: ' + redTotal + '</div>' +
        '<div class="final-score-breakdown">Dice: [' + redDice.join(', ') + ']</div>' +
        '<div class="final-score-breakdown">Bonus Points: +' + redBonus + '</div>' +
        '<div class="final-score-total">FINAL ROUND TOTAL: ' + (redTotal + redBonus) + ' pts</div>';
    redArea.appendChild(redDiv);
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
            pulseEl.textContent = winner.toUpperCase() + ' WINS!';
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
        blueRolled: false, redRolled: false, blueFinalRolled: false, redFinalRolled: false
    };

    document.getElementById('startRound').textContent   = 'Start Round 1';
    document.getElementById('currentRound').textContent = '1';

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
        document.getElementById('rolloffPrompt').textContent =
            'Tap your blue die — AI will roll right after.';
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
    document.getElementById('blueRoll').addEventListener('click', function() { rollPlayerDice('blue'); });
    document.getElementById('redRoll').addEventListener('click',  function() { rollPlayerDice('red');  });

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

    document.getElementById('blueRollFinalDie').addEventListener('click', rollFinalDie);
    document.getElementById('redRollFinalDie').addEventListener('click',  rollFinalDie);

    document.getElementById('closeFinalModal').addEventListener('click', closeFinalRollModal);
    document.getElementById('shareResult').addEventListener('click', shareFinalResult);

    var shareFooter = document.getElementById('shareResultFooter');
    if (shareFooter) { shareFooter.addEventListener('click', shareFinalResult); }

    document.getElementById('twoPlayerMode').addEventListener('click', function() { setGameMode('2player'); });
    document.getElementById('aiMode').addEventListener('click',        function() { setGameMode('ai');      });

    document.getElementById('easyAI').addEventListener('click',   function() { setAIDifficulty('easy');   });
    document.getElementById('mediumAI').addEventListener('click', function() { setAIDifficulty('medium'); });
    document.getElementById('hardAI').addEventListener('click',   function() { setAIDifficulty('hard');   });

    document.getElementById('viewStats').addEventListener('click', function() {
        if (typeof toggleStatsPanel === 'function') { toggleStatsPanel(); }
    });

    updateScoreDisplay();
    updateGameStatus();
    injectFullscreenButton();
}
