// POCKETS GAME ENGINE - Core Game Logic
// Fixed round counting: 10 regular rounds + Final Round 11

let gameMode = '2player';
let aiDifficulty = 'easy';
let aiThinking = false;

let gameState = {
    round: 1,
    currentPlayer: 'blue',
    phase: 'rolling', // 'rolling', 'placing', 'scoring', 'pre-final', 'final'
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

// SVG dice creation
function createDieSVG(value, id, isSaved = false) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "60");
    svg.setAttribute("height", "60");
    svg.setAttribute("viewBox", "0 0 60 60");
    svg.classList.add("dice");
    if (isSaved) svg.classList.add("saved-tint");
    svg.setAttribute("data-value", value);
    svg.setAttribute("data-id", id);

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("class", "dice-face");
    rect.setAttribute("x", "5");
    rect.setAttribute("y", "5");
    rect.setAttribute("width", "50");
    rect.setAttribute("height", "50");
    svg.appendChild(rect);

    const dotPositions = {
        1: [[30, 30]],
        2: [[20, 20], [40, 40]],
        3: [[20, 20], [30, 30], [40, 40]],
        4: [[20, 20], [40, 20], [20, 40], [40, 40]],
        5: [[20, 20], [40, 20], [30, 30], [20, 40], [40, 40]],
        6: [[20, 17], [40, 17], [20, 30], [40, 30], [20, 43], [40, 43]]
    };

    dotPositions[value].forEach(([cx, cy]) => {
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("class", "dice-dot");
        dot.setAttribute("cx", cx);
        dot.setAttribute("cy", cy);
        dot.setAttribute("r", "4");
        svg.appendChild(dot);
    });

    return svg;
}

// Game mode functions
function setGameMode(mode) {
    gameMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
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

function setAIDifficulty(difficulty) {
    aiDifficulty = difficulty;
    document.querySelectorAll('.difficulty-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(difficulty + 'AI').classList.add('active');
}

function startRound() {
    if (gameState.phase !== 'rolling') return;

    // Final round is round 11 (after 10 regular rounds)
    if (gameState.round === 11) {
        finalRound();
        return;
    }

    // Clear all pockets except save pockets
    ['blue', 'red'].forEach(player => {
        ['Keep1', 'Keep2', 'Share'].forEach(pocket => {
            const pocketElement = document.getElementById(`${player}${pocket}`);
            pocketElement.querySelector('.pocket-dice').innerHTML = '';
        });
        
        if (gameState.round > 1) {
            const savePocketElement = document.getElementById(`${player}Save`);
            savePocketElement.querySelector('.pocket-dice').innerHTML = '';
        }
    });

    document.getElementById('blueDiceArea').innerHTML = '';
    document.getElementById('redDiceArea').innerHTML = '';

    // Reset state
    resetRoundUI();
    gameState.blueRolled = false;
    gameState.redRolled = false;

    // CHANGE: Round 10 drama message before rolloff
    if (gameState.round === 10) {
        setActionPanelView('status');
        document.getElementById('turnInfo').textContent =
            'The final round — your Save die carries into the Grand Finale. Choose wisely!';
        setTimeout(() => startFirstPlayerRolloff(), 2400);
    } else {
        startFirstPlayerRolloff();
    }
}

function resetRoundUI() {
    document.getElementById('shareDifference').classList.add('hidden');
    document.getElementById('blueShareScore').classList.add('hidden');
    document.getElementById('redShareScore').classList.add('hidden');
    document.getElementById('blueBonus').textContent = 'Round Bonus: 0 pts';
    document.getElementById('redBonus').textContent = 'Round Bonus: 0 pts';
}

// =====================================================
// FIRST-PLAYER ROLLOFF
// =====================================================

let rolloffState = { blue: null, red: null, locked: false };

function startFirstPlayerRolloff() {
    rolloffState = { blue: null, red: null, locked: false };

    setActionPanelView('rolloff');
    document.getElementById('firstPlayerRolloff').classList.remove('hidden');
    document.getElementById('playerRolls').classList.add('hidden');

    const blueDie = document.getElementById('blueRolloffDie');
    const redDie = document.getElementById('redRolloffDie');

    setRolloffDieFaded(blueDie);
    setRolloffDieFaded(redDie);
    blueDie.disabled = false;
    blueDie.classList.remove('rolling');
    redDie.classList.remove('rolling');

    redDie.disabled = (gameMode === 'ai');

    const result = document.getElementById('rolloffResult');
    result.textContent = '';
    result.classList.remove('winner');

    document.getElementById('rolloffPrompt').textContent =
        gameMode === 'ai'
            ? 'Tap your blue die — AI will roll right after.'
            : 'Tap your die — higher number goes first!';
}

function setRolloffDieFaded(buttonEl) {
    buttonEl.innerHTML = '';
    buttonEl.classList.add('faded');
    const svg = createDieSVG(1, `rolloff-${buttonEl.id}`, false);
    buttonEl.appendChild(svg);
}

function setActionPanelView(view) {
    const gameControls = document.getElementById('gameControls');
    const coinFlip     = document.getElementById('coinFlip');
    const actionStatus = document.getElementById('actionStatus');
    const fpRolloff    = document.getElementById('firstPlayerRolloff');
    const playerRolls  = document.getElementById('playerRolls');

    [gameControls, coinFlip, actionStatus].forEach(el => el && el.classList.add('hidden'));

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
    }
}

function showConfirm(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    if (!modal) { if (onConfirm) onConfirm(); return; }

    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    modal.classList.remove('hidden');

    const okBtn     = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');

    function close() {
        modal.classList.add('hidden');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        modal.removeEventListener('click', onBackdrop);
    }
    function onOk()    { close(); if (onConfirm) onConfirm(); }
    function onCancel(){ close(); }
    function onBackdrop(e){ if (e.target === modal) close(); }

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    modal.addEventListener('click', onBackdrop);
}

function rolloffRollDie(player) {
    if (rolloffState.locked) return;
    if (rolloffState[player] !== null) return;

    const dieEl = document.getElementById(player + 'RolloffDie');
    dieEl.disabled = true;
    dieEl.classList.remove('faded');

    const value = Math.floor(Math.random() * 6) + 1;
    dieEl.innerHTML = '';
    const svg = createDieSVG(value, `rolloff-${player}-${Date.now()}`, false);
    svg.classList.add('rolling');
    dieEl.appendChild(svg);

    setTimeout(() => {
        svg.classList.remove('rolling');
        rolloffState[player] = value;

        if (gameMode === 'ai' && player === 'blue' && rolloffState.red === null) {
            setTimeout(() => rolloffRollDie('red'), 650);
        }

        if (rolloffState.blue !== null && rolloffState.red !== null) {
            setTimeout(resolveRolloff, 750);
        }
    }, 800);
}

function resolveRolloff() {
    const blueVal = rolloffState.blue;
    const redVal  = rolloffState.red;
    const result  = document.getElementById('rolloffResult');

    if (blueVal === redVal) {
        rolloffState.locked = true;
        result.textContent = `Tied at ${blueVal}! Re-rolling…`;
        result.classList.remove('winner');
        setTimeout(() => {
            rolloffState = { blue: null, red: null, locked: false };
            const blueDie = document.getElementById('blueRolloffDie');
            const redDie  = document.getElementById('redRolloffDie');
            setRolloffDieFaded(blueDie);
            setRolloffDieFaded(redDie);
            blueDie.disabled = false;
            redDie.disabled  = (gameMode === 'ai');
            result.textContent = '';
        }, 1200);
        return;
    }

    rolloffState.locked = true;
    const winner = blueVal > redVal ? 'blue' : 'red';
    gameState.firstPlayer = winner;
    gameState.currentPlayer = winner;

    const winnerName = winner === 'blue'
        ? 'BLUE'
        : (gameMode === 'ai' ? 'AI' : 'RED');
    const winnerColor = winner === 'blue' ? '#4a90e2' : '#e24a4a';
    result.classList.add('winner');
    result.innerHTML =
        `🏆 <span style="color:${winnerColor}">${winnerName}</span> goes first! ` +
        `<span style="opacity:0.75">(${blueVal} vs ${redVal})</span>`;

    setTimeout(() => {
        setActionPanelView('rolls');

        document.getElementById('blueRoll').classList.remove('hidden');
        document.getElementById('redRoll').classList.remove('hidden');

        if (gameMode === 'ai') {
            document.getElementById('redRoll').textContent = '🤖 AI Will Roll';
            document.getElementById('redRoll').disabled = true;
        }

        updateGameStatus();
    }, 1500);
}

function rollPlayerDice(player) {
    if ((player === 'blue' && gameState.blueRolled) || (player === 'red' && gameState.redRolled)) {
        return;
    }

    const btn = document.getElementById(player + 'Roll');
    btn.disabled = true;
    
    const dice = [];
    if (gameState.round === 1) {
        for (let i = 0; i < 4; i++) {
            dice.push(Math.floor(Math.random() * 6) + 1);
        }
    } else {
        for (let i = 0; i < 3; i++) {
            dice.push(Math.floor(Math.random() * 6) + 1);
        }
        const savedDie = player === 'blue' ? gameState.blueSavedDie : gameState.redSavedDie;
        if (savedDie) {
            dice.push(savedDie);
        }
    }

    if (player === 'blue') {
        gameState.blueDice = dice;
        gameState.blueOriginalRoll = [...dice];
        gameState.blueRolled = true;
    } else {
        gameState.redDice = dice;
        gameState.redOriginalRoll = [...dice];
        gameState.redRolled = true;
    }

    renderDiceWithAnimation(player, dice);
    
    btn.textContent = player === 'blue' ? '🔵 Blue Rolled' : 
                     (gameMode === 'ai' ? '🤖 AI Rolled' : '🔴 Red Rolled');
    
    if (gameMode === 'ai' && player === 'blue' && !gameState.redRolled) {
        setTimeout(() => {
            rollPlayerDice('red');
        }, 1500);
    }

    if (gameState.blueRolled && gameState.redRolled) {
        setTimeout(() => {
            startPlacement();
        }, 1000);
    }
}

function renderDiceWithAnimation(player, dice) {
    const diceArea = document.getElementById(player + 'DiceArea');
    diceArea.innerHTML = '';

    dice.forEach((value, index) => {
        const isSaved = gameState.round > 1 && index === dice.length - 1 && 
                       ((player === 'blue' && gameState.blueSavedDie) || 
                        (player === 'red' && gameState.redSavedDie));
        const die = createDieSVG(value, `${player}-${index}`, isSaved);
        die.classList.add(isSaved ? 'jitter' : 'rolling');
        die.addEventListener('click', () => selectDie(player, index));
        diceArea.appendChild(die);
    });

    setTimeout(() => {
        document.querySelectorAll('.dice').forEach(die => {
            die.classList.remove('rolling', 'jitter');
        });
    }, 800);
}

function startPlacement() {
    gameState.phase = 'placing';
    gameState.diceToPlace = 8;
    gameState.placementTurn = 0;

    setActionPanelView('status');
    
    updateGameStatus();
    
    if (gameMode === 'ai' && gameState.currentPlayer === 'red') {
        setTimeout(() => makeAIMove(), 1000);
    }
}

function selectDie(player, index) {
    if (gameState.phase !== 'placing') return;
    if (player !== gameState.currentPlayer) return;

    document.querySelectorAll('.dice.selected').forEach(die => {
        die.classList.remove('selected');
    });

    const dieElement = document.querySelector(`[data-id="${player}-${index}"]`);
    if (dieElement && !dieElement.classList.contains('selected')) {
        dieElement.classList.add('selected');
        gameState.selectedDie = { player, index };
        highlightAvailablePockets();
    }
}

function highlightAvailablePockets() {
    document.querySelectorAll('.pocket').forEach(pocket => {
        pocket.classList.remove('active');
        pocket.replaceWith(pocket.cloneNode(true));
    });

    if (!gameState.selectedDie) return;

    const player = gameState.selectedDie.player;
    const pockets = document.querySelectorAll(`[data-player="${player}"]`);
    
    pockets.forEach(pocket => {
        const currentDice = pocket.querySelectorAll('.dice').length;
        if (currentDice < 1) {
            pocket.classList.add('active');
            pocket.addEventListener('click', () => placeDieInPocket(pocket));
        }
    });
}

function placeDieInPocket(pocketElement) {
    if (!gameState.selectedDie) return;

    const { player, index } = gameState.selectedDie;
    const dieValue = player === 'blue' ? gameState.blueDice[index] : gameState.redDice[index];
    
    const pocketDie = createDieSVG(dieValue, `pocket-${Date.now()}`);
    pocketDie.style.width = '40px';
    pocketDie.style.height = '40px';
    pocketDie.classList.remove('saved-tint');
    
    const pocketDiceContainer = pocketElement.querySelector('.pocket-dice');
    pocketDiceContainer.appendChild(pocketDie);

    updatePocketScore(pocketElement, player);

    const dieElement = document.querySelector(`[data-id="${player}-${index}"]`);
    dieElement.remove();

    if (player === 'blue') {
        gameState.blueDice.splice(index, 1);
    } else {
        gameState.redDice.splice(index, 1);
    }

    gameState.selectedDie = null;
    document.querySelectorAll('.pocket').forEach(pocket => {
        pocket.classList.remove('active');
        pocket.replaceWith(pocket.cloneNode(true));
    });

    gameState.diceToPlace--;
    gameState.placementTurn++;

    if (gameState.diceToPlace > 0) {
        gameState.currentPlayer = gameState.currentPlayer === 'blue' ? 'red' : 'blue';
        renderDice();
        updateGameStatus();
        
        if (gameMode === 'ai' && gameState.currentPlayer === 'red') {
            setTimeout(() => makeAIMove(), 500);
        }
    } else {
        calculateRoundScore();
    }
    updateShareDifference();
}

function renderDice() {
    const blueDiceArea = document.getElementById('blueDiceArea');
    const redDiceArea = document.getElementById('redDiceArea');

    blueDiceArea.innerHTML = '';
    redDiceArea.innerHTML = '';

    gameState.blueDice.forEach((value, index) => {
        const isSaved = gameState.round > 1 && index === gameState.blueDice.length - 1 && gameState.blueSavedDie === value;
        const die = createDieSVG(value, `blue-${index}`, isSaved);
        die.addEventListener('click', () => selectDie('blue', index));
        blueDiceArea.appendChild(die);
    });

    gameState.redDice.forEach((value, index) => {
        const isSaved = gameState.round > 1 && index === gameState.redDice.length - 1 && gameState.redSavedDie === value;
        const die = createDieSVG(value, `red-${index}`, isSaved);
        die.addEventListener('click', () => selectDie('red', index));
        redDiceArea.appendChild(die);
    });
}

function updatePocketScore(pocketElement, player) {
    const pocketType = pocketElement.dataset.pocket;
    const dice = Array.from(pocketElement.querySelectorAll('.dice')).map(die => parseInt(die.dataset.value));
    
    if (pocketType === 'share' && dice.length > 0) {
        const scoreElement = document.getElementById(`${player}ShareScore`);
        scoreElement.textContent = dice[0];
        scoreElement.classList.remove('hidden');
    }
}

function updateShareDifference() {
    const blueShareDice = getDiceFromPockets('blue').share || [];
    const redShareDice = getDiceFromPockets('red').share || [];
    
    if (blueShareDice.length > 0 && redShareDice.length > 0) {
        const blueDie = blueShareDice[0];
        const redDie = redShareDice[0];
        const diff = Math.abs(blueDie - redDie);
        
        document.getElementById('blueShareScore').textContent = diff > 0 && blueDie > redDie ? `+${diff}` : (diff === 0 ? '0' : '0');
        document.getElementById('redShareScore').textContent = diff > 0 && redDie > blueDie ? `+${diff}` : (diff === 0 ? '0' : '0');

        // CHANGE: redirect result into action status bar, keep separate strip hidden
        const shareMsg = diff > 0
            ? `Share One: ${blueDie > redDie ? 'Blue' : 'Red'} wins by ${diff} point${diff > 1 ? 's' : ''}`
            : 'Share One: Tied - no bonus';
        document.getElementById('shareDifference').classList.add('hidden');
        setActionPanelView('status');
        document.getElementById('turnInfo').textContent = shareMsg;
    }
}

function getDiceFromPockets(player) {
    const pockets = {};
    ['keep1', 'keep2', 'share', 'save'].forEach(pocketType => {
        const pocketElement = document.getElementById(`${player}${pocketType.charAt(0).toUpperCase() + pocketType.slice(1)}`);
        const dice = Array.from(pocketElement.querySelectorAll('.dice')).map(die => parseInt(die.dataset.value));
        if (dice.length > 0) {
            pockets[pocketType] = dice;
        }
    });
    return pockets;
}

function calculateRoundScore() {
    gameState.phase = 'scoring';

    const bluePockets = getDiceFromPockets('blue');
    const redPockets = getDiceFromPockets('red');

    const blueKeepScore = (bluePockets.keep1 || []).concat(bluePockets.keep2 || []).reduce((a, b) => a + b, 0);
    const redKeepScore = (redPockets.keep1 || []).concat(redPockets.keep2 || []).reduce((a, b) => a + b, 0);

    const blueShareDie = bluePockets.share?.[0] || 0;
    const redShareDie = redPockets.share?.[0] || 0;
    
    let blueBonus = 0;
    let redBonus = 0;
    let blueComboBonus = 0;
    let redComboBonus = 0;

    if (blueShareDie > redShareDie) {
        blueBonus = blueShareDie - redShareDie;
        blueComboBonus = calculateBonusPoints(gameState.blueOriginalRoll);
        blueBonus += blueComboBonus;
        document.getElementById('blueBonus').textContent = `Round Bonus: ${blueComboBonus} pts`;
        document.getElementById('redBonus').textContent = `Round Bonus: 0 pts`;
    } else if (redShareDie > blueShareDie) {
        redBonus = redShareDie - blueShareDie;
        redComboBonus = calculateBonusPoints(gameState.redOriginalRoll);
        redBonus += redComboBonus;
        document.getElementById('redBonus').textContent = `Round Bonus: ${redComboBonus} pts`;
        document.getElementById('blueBonus').textContent = `Round Bonus: 0 pts`;
    } else {
        document.getElementById('blueBonus').textContent = `Round Bonus: 0 pts`;
        document.getElementById('redBonus').textContent = `Round Bonus: 0 pts`;
    }

    const blueTotalRound = blueKeepScore + blueBonus;
    const redTotalRound = redKeepScore + redBonus;

    displayRoundScores(blueKeepScore, blueBonus, blueComboBonus, redKeepScore, redBonus, redComboBonus);

    gameState.blueScore += blueTotalRound;
    gameState.redScore += redTotalRound;

    gameState.blueSavedDie = bluePockets.save?.[0] || null;
    gameState.redSavedDie = redPockets.save?.[0] || null;

    updateScoreDisplay();
    
    setTimeout(() => {
        if (gameState.round < 10) {
            nextRound();
        } else if (gameState.round === 10) {
            showPreFinalScreen();
        } else {
            finalRound();
        }
    }, 2000);
}

function displayRoundScores(blueKeep, blueBonus, blueCombo, redKeep, redBonus, redCombo) {
    const blueDiceArea = document.getElementById('blueDiceArea');
    const redDiceArea = document.getElementById('redDiceArea');

    const blueScoreDiv = document.createElement('div');
    blueScoreDiv.className = 'round-score-display';
    let blueText = `Round Score: ${blueKeep + blueBonus} pts`;
    if (blueBonus > 0) {
        blueText += `<br>Keep: ${blueKeep}, Share: ${blueBonus - blueCombo}`;
        if (blueCombo > 0) blueText += `, Combo: ${blueCombo}`;
    } else {
        blueText += `<br>Keep: ${blueKeep}`;
    }
    blueScoreDiv.innerHTML = blueText;
    blueDiceArea.appendChild(blueScoreDiv);

    const redScoreDiv = document.createElement('div');
    redScoreDiv.className = 'round-score-display';
    let redText = `Round Score: ${redKeep + redBonus} pts`;
    if (redBonus > 0) {
        redText += `<br>Keep: ${redKeep}, Share: ${redBonus - redCombo}`;
        if (redCombo > 0) redText += `, Combo: ${redCombo}`;
    } else {
        redText += `<br>Keep: ${redKeep}`;
    }
    redScoreDiv.innerHTML = redText;
    redDiceArea.appendChild(redScoreDiv);
}

// CHANGE: simplified — no broken roll button references
function showPreFinalScreen() {
    gameState.phase = 'pre-final';
    setActionPanelView('status');
    document.getElementById('turnInfo').textContent = '🎉 Ten rounds complete — the Grand Finale awaits!';
    document.getElementById('preFinalScreen').classList.remove('hidden');
}

// CHANGE: new function wired to the single Proceed button
function proceedToFinalRound() {
    document.getElementById('preFinalScreen').classList.add('hidden');
    startFinalRollDrama();
}

function rollFinalDice(player) {
    if (player === 'blue' && gameState.blueFinalRolled) return;
    if (player === 'red' && gameState.redFinalRolled) return;
    
    const btn = document.getElementById(player + 'FinalRoll');
    btn.disabled = true;
    btn.textContent = player === 'blue' ? '🔵 Blue Rolled!' : 
                     (gameMode === 'ai' ? '🤖 AI Rolled!' : '🔴 Red Rolled!');
    
    if (player === 'blue') {
        gameState.blueFinalRolled = true;
    } else {
        gameState.redFinalRolled = true;
    }
    
    if (gameMode === 'ai' && player === 'blue' && !gameState.redFinalRolled) {
        setTimeout(() => {
            rollFinalDice('red');
        }, 1500);
    }
    
    if (gameState.blueFinalRolled && gameState.redFinalRolled) {
        setTimeout(() => {
            document.getElementById('preFinalScreen').classList.add('hidden');
            startFinalRollDrama();
        }, 1000);
    }
}

// =====================================================
// FINAL ROLL DRAMA
// =====================================================

function startFinalRollDrama() {
    gameState.phase = 'final';
    gameState.round = 11;
    document.getElementById('currentRound').textContent = '11 (FINAL)';

    gameState.finalRoll = {
        blueRolls: [],
        redRolls: [],
        currentPlayer: gameState.firstPlayer || 'blue',
        maxPerPlayer: 4
    };

    setSavedDieSlot('blueSavedDieValue', gameState.blueSavedDie);
    setSavedDieSlot('redSavedDieValue', gameState.redSavedDie);

    document.getElementById('blueRunningTotal').textContent =
        gameState.blueSavedDie || 0;
    document.getElementById('redRunningTotal').textContent =
        gameState.redSavedDie || 0;

    document.getElementById('blueDiceRolled').innerHTML = '';
    document.getElementById('redDiceRolled').innerHTML = '';

    document.getElementById('blueComboBonusDisplay').textContent = '';
    document.getElementById('redComboBonusDisplay').textContent = '';

    document.getElementById('finalCelebration').classList.add('hidden');
    document.getElementById('rollFinalDie').classList.remove('hidden');
    document.getElementById('rollFinalDie').disabled = false;

    document.getElementById('dramaMessage').textContent =
        '🎬 The final showdown begins!';

    setActiveTurnUI(gameState.finalRoll.currentPlayer);

    document.getElementById('finalRollModal').classList.remove('hidden');

    maybeAutoRollForAI();
}

function setSavedDieSlot(slotId, value) {
    const slot = document.getElementById(slotId);
    slot.innerHTML = '';
    if (value != null) {
        const svg = createDieSVG(value, `saved-${slotId}`, true);
        slot.appendChild(svg);
    } else {
        slot.textContent = '—';
    }
}

function setActiveTurnUI(player) {
    const blueCard = document.getElementById('blueFinalCard');
    const redCard = document.getElementById('redFinalCard');
    blueCard.classList.toggle('active-turn', player === 'blue');
    redCard.classList.toggle('active-turn', player === 'red');

    const turnMsg = document.getElementById('currentTurnMessage');
    if (player === 'blue') {
        turnMsg.textContent = "🔵 Blue's turn — tap Roll Die";
    } else if (gameMode === 'ai') {
        turnMsg.textContent = '🤖 AI is rolling...';
    } else {
        turnMsg.textContent = "🔴 Red's turn — tap Roll Die";
    }
}

function maybeAutoRollForAI() {
    const fr = gameState.finalRoll;
    if (!fr) return;
    if (gameMode === 'ai' && fr.currentPlayer === 'red') {
        const btn = document.getElementById('rollFinalDie');
        btn.disabled = true;
        setTimeout(() => {
            rollFinalDie();
        }, 1200);
    }
}

function rollFinalDie() {
    const fr = gameState.finalRoll;
    if (!fr) return;

    if (fr.blueRolls.length >= fr.maxPerPlayer &&
        fr.redRolls.length >= fr.maxPerPlayer) {
        return;
    }

    const player = fr.currentPlayer;
    const value = Math.floor(Math.random() * 6) + 1;

    if (player === 'blue') {
        fr.blueRolls.push(value);
    } else {
        fr.redRolls.push(value);
    }

    const containerId = player === 'blue' ? 'blueDiceRolled' : 'redDiceRolled';
    const dieEl = createDieSVG(value, `final-${player}-${(player === 'blue' ? fr.blueRolls : fr.redRolls).length}`, false);
    dieEl.classList.add('dice-rolled');
    document.getElementById(containerId).appendChild(dieEl);

    const totalId = player === 'blue' ? 'blueRunningTotal' : 'redRunningTotal';
    const totalEl = document.getElementById(totalId);
    const baseSaved = player === 'blue'
        ? (gameState.blueSavedDie || 0)
        : (gameState.redSavedDie || 0);
    const rollsSum = (player === 'blue' ? fr.blueRolls : fr.redRolls)
        .reduce((a, b) => a + b, 0);
    totalEl.textContent = baseSaved + rollsSum;
    totalEl.classList.add('bumped');
    setTimeout(() => totalEl.classList.remove('bumped'), 260);

    updateDramaMessage(player, value);

    const blueDone = fr.blueRolls.length >= fr.maxPerPlayer;
    const redDone = fr.redRolls.length >= fr.maxPerPlayer;

    if (blueDone && redDone) {
        document.getElementById('rollFinalDie').disabled = true;
        setTimeout(finalizeFinalRoll, 900);
        return;
    }

    let next;
    if (!blueDone && !redDone) {
        next = player === 'blue' ? 'red' : 'blue';
    } else if (!blueDone) {
        next = 'blue';
    } else {
        next = 'red';
    }
    fr.currentPlayer = next;
    setActiveTurnUI(next);

    if (gameMode === 'ai' && next === 'red') {
        const btn = document.getElementById('rollFinalDie');
        btn.disabled = true;
        setTimeout(() => {
            btn.disabled = false;
            rollFinalDie();
        }, 1100);
    } else {
        document.getElementById('rollFinalDie').disabled = false;
    }
}

function updateDramaMessage(rollerPlayer, rollValue) {
    const fr = gameState.finalRoll;
    const blueLive =
        (gameState.blueSavedDie || 0) +
        fr.blueRolls.reduce((a, b) => a + b, 0);
    const redLive =
        (gameState.redSavedDie || 0) +
        fr.redRolls.reduce((a, b) => a + b, 0);

    const rollerLabel = rollerPlayer === 'blue' ? '🔵 Blue' : '🔴 Red';
    let flavor = '';
    if (rollValue === 6) flavor = ' Big roll!';
    else if (rollValue === 1) flavor = ' Ouch.';

    let standing;
    if (blueLive === redLive) {
        standing = `Tied at ${blueLive} — anyone's game!`;
    } else if (blueLive > redLive) {
        standing = `Blue leads by ${blueLive - redLive}.`;
    } else {
        standing = `Red leads by ${redLive - blueLive}.`;
    }

    document.getElementById('dramaMessage').textContent =
        `${rollerLabel} rolled a ${rollValue}.${flavor} ${standing}`;
}

function finalizeFinalRoll() {
    const fr = gameState.finalRoll;

    const blueHand = [...fr.blueRolls];
    if (gameState.blueSavedDie != null) blueHand.push(gameState.blueSavedDie);
    const redHand = [...fr.redRolls];
    if (gameState.redSavedDie != null) redHand.push(gameState.redSavedDie);

    const blueDiceTotal = blueHand.reduce((a, b) => a + b, 0);
    const redDiceTotal = redHand.reduce((a, b) => a + b, 0);

    const blueComboBonus = calculateBonusPoints(blueHand);
    const redComboBonus = calculateBonusPoints(redHand);

    const blueFinal = blueDiceTotal + blueComboBonus;
    const redFinal = redDiceTotal + redComboBonus;

    document.getElementById('blueRunningTotal').textContent = blueFinal;
    document.getElementById('redRunningTotal').textContent = redFinal;

    fr.blueHand = blueHand;
    fr.redHand = redHand;
    fr.blueComboBonus = blueComboBonus;
    fr.redComboBonus = redComboBonus;
    fr.blueFinalRoundTotal = blueFinal;
    fr.redFinalRoundTotal = redFinal;

    document.getElementById('blueComboBonusDisplay').textContent =
        blueComboBonus > 0 ? `+${blueComboBonus} combo bonus` : '';
    document.getElementById('redComboBonusDisplay').textContent =
        redComboBonus > 0 ? `+${redComboBonus} combo bonus` : '';

    document.getElementById('dramaMessage').textContent =
        (blueComboBonus === 0 && redComboBonus === 0)
            ? 'No combo bonuses this round.'
            : '';
    document.getElementById('currentTurnMessage').textContent = '';

    const blueGameTotal = gameState.blueScore + blueFinal;
    const redGameTotal = gameState.redScore + redFinal;

    let winnerText, marginText;
    if (blueGameTotal > redGameTotal) {
        winnerText = '🏆 BLUE WINS! 🏆';
        marginText = `Final score: ${blueGameTotal} – ${redGameTotal} ` +
                     `(margin of ${blueGameTotal - redGameTotal})`;
    } else if (redGameTotal > blueGameTotal) {
        winnerText = '🏆 RED WINS! 🏆';
        marginText = `Final score: ${redGameTotal} – ${blueGameTotal} ` +
                     `(margin of ${redGameTotal - blueGameTotal})`;
    } else {
        winnerText = "🤝 IT'S A TIE! 🤝";
        marginText = `Both players ended at ${blueGameTotal} points.`;
    }

    document.getElementById('winnerAnnouncement').textContent = winnerText;
    document.getElementById('finalMargin').textContent = marginText;

    document.getElementById('blueFinalCard').classList.remove('active-turn');
    document.getElementById('redFinalCard').classList.remove('active-turn');
    document.getElementById('rollFinalDie').classList.add('hidden');
    document.getElementById('finalCelebration').classList.remove('hidden');
}

function closeFinalRollModal() {
    const fr = gameState.finalRoll;
    if (!fr || fr.blueFinalRoundTotal == null) {
        document.getElementById('finalRollModal').classList.add('hidden');
        return;
    }

    gameState.blueDice = fr.blueHand;
    gameState.redDice = fr.redHand;

    document.getElementById('finalRollModal').classList.add('hidden');

    document.getElementById('blueDiceArea').innerHTML = '';
    document.getElementById('redDiceArea').innerHTML = '';
    document.querySelectorAll('.pockets').forEach(p => p.style.display = 'none');
    document.getElementById('turnInfo').textContent = 'Final scoring round';
    renderFinalDice();

    const blueDiceTotal = fr.blueHand.reduce((a, b) => a + b, 0);
    const redDiceTotal = fr.redHand.reduce((a, b) => a + b, 0);
    displayFinalScores(
        fr.blueHand, fr.redHand,
        blueDiceTotal, redDiceTotal,
        fr.blueComboBonus, fr.redComboBonus
    );

    gameState.blueScore += fr.blueFinalRoundTotal;
    gameState.redScore += fr.redFinalRoundTotal;
    updateScoreDisplay();

    endGame();
}

function shareFinalResult() {
    const fr = gameState.finalRoll;
    const blueGameTotal = gameState.blueScore +
        (fr && fr.blueFinalRoundTotal ? fr.blueFinalRoundTotal : 0);
    const redGameTotal = gameState.redScore +
        (fr && fr.redFinalRoundTotal ? fr.redFinalRoundTotal : 0);

    let resultLine;
    if (blueGameTotal > redGameTotal) {
        resultLine = `🔵 Blue wins ${blueGameTotal}–${redGameTotal}`;
    } else if (redGameTotal > blueGameTotal) {
        resultLine = `🔴 Red wins ${redGameTotal}–${blueGameTotal}`;
    } else {
        resultLine = `🤝 Tie at ${blueGameTotal}`;
    }

    const text = `🎲 POCKETS — ${resultLine}\nA strategic dice game.`;

    if (navigator.share) {
        navigator.share({ title: 'POCKETS', text }).catch(() => {});
    } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.getElementById('shareResult');
            const original = btn.textContent;
            btn.textContent = '✅ Copied!';
            setTimeout(() => { btn.textContent = original; }, 1800);
        });
    }
}

// CHANGE: removed (n/8) counter from placing phase messages
function updateGameStatus() {
    const turnInfo = document.getElementById('turnInfo');

    if (gameState.phase === 'rolling') {
        turnInfo.textContent = '';
    } else if (gameState.phase === 'placing') {
        if (aiThinking && gameState.currentPlayer === 'red' && gameMode === 'ai') {
            turnInfo.textContent = '🤖 AI is thinking…';
        } else {
            const playerName = gameMode === 'ai' && gameState.currentPlayer === 'red'
                ? 'AI'
                : gameState.currentPlayer.charAt(0).toUpperCase() + gameState.currentPlayer.slice(1);
            turnInfo.textContent = `${playerName} places dice`;
        }
    } else if (gameState.phase === 'scoring') {
        turnInfo.textContent = 'Round complete — calculating scores…';
    } else if (gameState.phase === 'pre-final') {
        turnInfo.textContent = '🎉 Ready for the final round!';
    } else if (gameState.phase === 'final') {
        turnInfo.textContent = 'Final scoring round';
    }
}

function updateScoreDisplay() {
    document.getElementById('blueScore').textContent = gameState.blueScore;
    document.getElementById('redScore').textContent = gameState.redScore;
}

function nextRound() {
    gameState.round++;
    gameState.phase = 'rolling';
    gameState.selectedDie = null;
    gameState.diceToPlace = 8;
    gameState.placementTurn = 0;
    gameState.blueRolled = false;
    gameState.redRolled = false;

    resetRoundUI();

    document.getElementById('currentRound').textContent = gameState.round;
    
    if (gameState.round === 10) {
        document.getElementById('startRound').textContent = 'Start Round 10';
    } else {
        document.getElementById('startRound').textContent = `Start Round ${gameState.round}`;
    }
    
    setActionPanelView('start');
    
    resetRollButtons();
    updateGameStatus();
}

function resetRollButtons() {
    document.getElementById('blueRoll').disabled = false;
    document.getElementById('blueRoll').textContent = '🔵 Blue Roll Dice';
    document.getElementById('redRoll').disabled = false;
    document.getElementById('redRoll').textContent = gameMode === 'ai' ? '🤖 AI Will Roll' : '🔴 Red Roll Dice';
    document.getElementById('blueRoll').classList.add('hidden');
    document.getElementById('redRoll').classList.add('hidden');
}

function finalRound() {
    gameState.round = 11;
    gameState.phase = 'final';
    document.getElementById('currentRound').textContent = '11 (FINAL)';
    document.getElementById('turnInfo').textContent = 'Final scoring round';

    document.querySelectorAll('.pockets').forEach(pocketContainer => {
        pocketContainer.style.display = 'none';
    });

    document.getElementById('blueDiceArea').innerHTML = '';
    document.getElementById('redDiceArea').innerHTML = '';

    gameState.blueDice = [];
    gameState.redDice = [];
    
    for (let i = 0; i < 4; i++) {
        gameState.blueDice.push(Math.floor(Math.random() * 6) + 1);
        gameState.redDice.push(Math.floor(Math.random() * 6) + 1);
    }

    if (gameState.blueSavedDie) {
        gameState.blueDice.push(gameState.blueSavedDie);
    }
    if (gameState.redSavedDie) {
        gameState.redDice.push(gameState.redSavedDie);
    }

    renderFinalDice();

    const blueDiceTotal = gameState.blueDice.reduce((a, b) => a + b, 0);
    const redDiceTotal = gameState.redDice.reduce((a, b) => a + b, 0);

    const blueComboBonus = calculateBonusPoints(gameState.blueDice);
    const redComboBonus = calculateBonusPoints(gameState.redDice);

    const blueFinalTotal = blueDiceTotal + blueComboBonus;
    const redFinalTotal = redDiceTotal + redComboBonus;

    displayFinalScores(gameState.blueDice, gameState.redDice, blueDiceTotal, redDiceTotal, blueComboBonus, redComboBonus);

    gameState.blueScore += blueFinalTotal;
    gameState.redScore += redFinalTotal;

    updateScoreDisplay();

    setTimeout(() => {
        endGame();
    }, 3000);
}

function renderFinalDice() {
    const blueDiceArea = document.getElementById('blueDiceArea');
    const redDiceArea = document.getElementById('redDiceArea');

    gameState.blueDice.forEach((value, index) => {
        const isSaved = index === gameState.blueDice.length - 1 && gameState.blueSavedDie;
        const die = createDieSVG(value, `blue-final-${index}`, isSaved);
        die.classList.add(isSaved ? 'jitter' : 'rolling');
        blueDiceArea.appendChild(die);
    });

    gameState.redDice.forEach((value, index) => {
        const isSaved = index === gameState.redDice.length - 1 && gameState.redSavedDie;
        const die = createDieSVG(value, `red-final-${index}`, isSaved);
        die.classList.add(isSaved ? 'jitter' : 'rolling');
        redDiceArea.appendChild(die);
    });

    setTimeout(() => {
        document.querySelectorAll('.dice').forEach(die => {
            die.classList.remove('rolling', 'jitter');
        });
    }, 800);
}

function displayFinalScores(blueDice, redDice, blueTotal, redTotal, blueBonus, redBonus) {
    const bluePlayerArea = document.querySelector('.player-area.blue');
    const redPlayerArea = document.querySelector('.player-area.red');

    const blueScoreDiv = document.createElement('div');
    blueScoreDiv.className = 'final-score-display';
    blueScoreDiv.innerHTML = `
        <div class="final-score-title">FINAL ROUND</div>
        <div class="final-score-breakdown">5 Dice Total: ${blueTotal}</div>
        <div class="final-score-breakdown">Dice: [${blueDice.join(', ')}]</div>
        <div class="final-score-breakdown">Combo Bonus: +${blueBonus}</div>
        <div class="final-score-total">FINAL ROUND TOTAL: ${blueTotal + blueBonus} pts</div>
    `;
    bluePlayerArea.appendChild(blueScoreDiv);

    const redScoreDiv = document.createElement('div');
    redScoreDiv.className = 'final-score-display';
    redScoreDiv.innerHTML = `
        <div class="final-score-title">FINAL ROUND</div>
        <div class="final-score-breakdown">5 Dice Total: ${redTotal}</div>
        <div class="final-score-breakdown">Dice: [${redDice.join(', ')}]</div>
        <div class="final-score-breakdown">Combo Bonus: +${redBonus}</div>
        <div class="final-score-total">FINAL ROUND TOTAL: ${redTotal + redBonus} pts</div>
    `;
    redPlayerArea.appendChild(redScoreDiv);
}

function endGame() {
    const winner = gameState.blueScore > gameState.redScore ? 'Blue' : 
                  gameState.redScore > gameState.blueScore ? 'Red' : 'Tie';
    
    const winnerText = winner === 'Tie' ? `Game Over! It's a tie at ${gameState.blueScore} points each!` : 
                      `Game Over! ${winner} player wins with ${winner === 'Blue' ? gameState.blueScore : gameState.redScore} points!`;
    
    document.getElementById('turnInfo').textContent = winnerText;

    const blueScoreArea = document.querySelector('.scores .score-area:first-child');
    const redScoreArea = document.querySelector('.scores .score-area:last-child');
    
    document.getElementById('blueScore').className = 'final-total';
    document.getElementById('redScore').className = 'final-total';
    
    if (winner === 'Blue') {
        blueScoreArea.classList.add('winner');
        addWinnerText(blueScoreArea);
    } else if (winner === 'Red') {
        redScoreArea.classList.add('winner');
        addWinnerText(redScoreArea);
    } else {
        blueScoreArea.classList.add('winner');
        redScoreArea.classList.add('winner');
    }

    if (typeof saveGameStats === 'function') {
        saveGameStats({
            winner,
            blueScore: gameState.blueScore,
            redScore: gameState.redScore,
            gameMode,
            aiDifficulty: gameMode === 'ai' ? aiDifficulty : null,
            date: new Date().toISOString()
        });
    }
}

function addWinnerText(scoreArea) {
    const winnerText = document.createElement('div');
    winnerText.className = 'winner-text';
    winnerText.textContent = '🏆 WINNER! 🏆';
    scoreArea.appendChild(winnerText);
}

function newGame() {
    gameState = {
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

    document.getElementById('startRound').textContent = 'Start Round 1';
    document.getElementById('currentRound').textContent = '1';
    
    resetRollButtons();

    rolloffState = { blue: null, red: null, locked: false };
    document.getElementById('firstPlayerRolloff').classList.remove('hidden');
    document.getElementById('playerRolls').classList.add('hidden');
    document.getElementById('rolloffResult').textContent = '';
    document.getElementById('rolloffResult').classList.remove('winner');
    setRolloffDieFaded(document.getElementById('blueRolloffDie'));
    setRolloffDieFaded(document.getElementById('redRolloffDie'));

    setActionPanelView('start');
    document.getElementById('preFinalScreen').classList.add('hidden');
    document.getElementById('finalRollModal').classList.add('hidden');
    document.getElementById('finalCelebration').classList.add('hidden');
    document.getElementById('rollFinalDie').classList.remove('hidden');
    document.getElementById('rollFinalDie').disabled = false;

    document.querySelectorAll('.final-score-display').forEach(el => el.remove());
    document.querySelectorAll('.score-area').forEach(area => {
        area.classList.remove('winner');
        const winnerText = area.querySelector('.winner-text');
        if (winnerText) winnerText.remove();
    });

    document.getElementById('blueScore').className = 'score-display';
    document.getElementById('redScore').className = 'score-display';

    document.querySelectorAll('.pockets').forEach(pocketContainer => {
        pocketContainer.style.display = 'grid';
    });

    document.querySelectorAll('.pocket-dice').forEach(container => {
        container.innerHTML = '';
    });
    document.getElementById('blueDiceArea').innerHTML = '';
    document.getElementById('redDiceArea').innerHTML = '';
    
    resetRoundUI();
    updateScoreDisplay();
    updateGameStatus();
}

// Event listeners
function initializeGame() {
    document.getElementById('startRound').addEventListener('click', startRound);
    document.getElementById('blueRoll').addEventListener('click', () => rollPlayerDice('blue'));
    document.getElementById('redRoll').addEventListener('click', () => rollPlayerDice('red'));
    document.getElementById('newGame').addEventListener('click', () => {
        showConfirm(
            'Start a new game?',
            'This will end the current game and reset the board. Are you sure?',
            newGame
        );
    });
    document.getElementById('blueRolloffDie').addEventListener('click', () => rolloffRollDie('blue'));
    document.getElementById('redRolloffDie').addEventListener('click', () => rolloffRollDie('red'));

    // CHANGE: replaced broken blueFinalRoll/redFinalRoll listeners with proceedFinalBtn
    const proceedBtn = document.getElementById('proceedFinalBtn');
    if (proceedBtn) proceedBtn.addEventListener('click', proceedToFinalRound);

    document.getElementById('rollFinalDie').addEventListener('click', rollFinalDie);
    document.getElementById('closeFinalModal').addEventListener('click', closeFinalRollModal);
    document.getElementById('shareResult').addEventListener('click', shareFinalResult);

    document.getElementById('twoPlayerMode').addEventListener('click', () => setGameMode('2player'));
    document.getElementById('aiMode').addEventListener('click', () => setGameMode('ai'));

    document.getElementById('easyAI').addEventListener('click', () => setAIDifficulty('easy'));
    document.getElementById('mediumAI').addEventListener('click', () => setAIDifficulty('medium'));
    document.getElementById('hardAI').addEventListener('click', () => setAIDifficulty('hard'));

    document.getElementById('viewStats').addEventListener('click', () => {
        if (typeof toggleStatsPanel === 'function') {
            toggleStatsPanel();
        }
    });

    updateScoreDisplay();
    updateGameStatus();
}
