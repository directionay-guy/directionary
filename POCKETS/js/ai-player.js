// POCKETS AI PLAYER MODULE — v2.1
// AI always plays as Red. Human always plays as Blue internally.
// If human chose "Play as Red," that's a visual/stats swap only — game logic unchanged.

class PocketsAI {
    constructor(difficulty = 'medium') {
        this.difficulty  = difficulty;
        this.thinking    = false;
        this.personality = this.getPersonality(difficulty);
    }

    getPersonality(difficulty) {
        return {
            easy:   { name: 'Rookie Bot', thinkTime: [700,  1100], randomness: 0.45, aggression: 0.3  },
            medium: { name: 'Clever Bot', thinkTime: [1100, 1700], randomness: 0.18, aggression: 0.6  },
            hard:   { name: 'Master Bot', thinkTime: [1600, 2200], randomness: 0.05, aggression: 0.8  }
        }[difficulty] || { name: 'Clever Bot', thinkTime: [1100, 1700], randomness: 0.18, aggression: 0.6 };
    }

    getThinkTime() {
        const [min, max] = this.personality.thinkTime;
        return Math.random() * (max - min) + min;
    }

    // ── Main entry: pick best die→pocket ─────────────────────────────────────

    calculateBestMove(gameState) {
        const availDice    = [...gameState.redDice];
        const emptyPockets = this.getEmptyPockets();
        if (availDice.length === 0 || emptyPockets.length === 0) { return null; }

        // Hard: holistic — evaluate all assignments, pick best first move
        if (this.difficulty === 'hard') {
            return this.planHolistic(availDice, emptyPockets, gameState);
        }

        // Easy / Medium: independent pair scoring
        let bestMove  = null;
        let bestScore = -Infinity;
        availDice.forEach((dieValue, dieIndex) => {
            emptyPockets.forEach(pocket => {
                let score = this.scorePlacement(dieValue, pocket, gameState);
                score += (Math.random() - 0.5) * this.personality.randomness * 12;
                if (score > bestScore) {
                    bestScore = score;
                    bestMove  = { dieIndex, dieValue, pocket, expectedScore: score };
                }
            });
        });
        return bestMove;
    }

    // ── Holistic planning: enumerate all assignments ──────────────────────────

    planHolistic(availDice, emptyPockets, gameState) {
        const numSlots  = Math.min(availDice.length, emptyPockets.length);
        let bestTotal      = -Infinity;
        let bestAssignment = null;

        this.permute(availDice.map((v, i) => i), numSlots).forEach(dieIndices => {
            let total = 0;
            dieIndices.forEach((dieIdx, slotIdx) => {
                total += this.scorePlacement(availDice[dieIdx], emptyPockets[slotIdx], gameState);
            });
            if (total > bestTotal) {
                bestTotal      = total;
                bestAssignment = dieIndices;
            }
        });

        // Return first move of best plan
        const bestDieIdx = bestAssignment[0];
        return { dieIndex: bestDieIdx, dieValue: availDice[bestDieIdx], pocket: emptyPockets[0], expectedScore: bestTotal };
    }

    permute(arr, length) {
        if (length === 0) { return [[]]; }
        const result = [];
        arr.forEach((val, idx) => {
            const rest = [...arr.slice(0, idx), ...arr.slice(idx + 1)];
            this.permute(rest, length - 1).forEach(sub => result.push([val, ...sub]));
        });
        return result;
    }

    // ── Score a single die→pocket ─────────────────────────────────────────────

    scorePlacement(dieValue, pocket, gameState) {
        const humanPockets = getDiceFromPockets('blue');
        const aiScore      = gameState.redScore  || 0;
        const humanScore   = gameState.blueScore || 0;
        const scoreDiff    = aiScore - humanScore;
        const highScore    = Math.max(aiScore, humanScore);
        const aiCombo      = calculateBonusPoints(gameState.redOriginalRoll || []);
        let score = 0;

        switch (pocket) {
            case 'Keep1':
            case 'Keep2':
                score = dieValue * 2;
                if (dieValue >= 5) { score += 4; }
                if (scoreDiff < -15) { score -= 2; } // behind — Keep less attractive
                break;
            case 'Take':
                score = this.scoreTake(dieValue, humanPockets, aiCombo, scoreDiff);
                break;
            case 'Save':
                score = this.scoreSave(dieValue, highScore);
                break;
        }
        return score;
    }

    // ── Take scoring ─────────────────────────────────────────────────────────

    scoreTake(dieValue, humanPockets, aiCombo, scoreDiff) {
        const humanTakeDie = (humanPockets.take && humanPockets.take.length > 0)
            ? humanPockets.take[0] : null;

        if (humanTakeDie !== null) {
            // Human already placed — we know the result
            if (dieValue > humanTakeDie) {
                const diff = dieValue - humanTakeDie;
                let score  = diff * 5 + aiCombo * 3.5;
                score *= (1 + this.personality.aggression * 0.5);
                return score;
            } else if (dieValue === humanTakeDie) {
                return 0;
            } else {
                return -4 - (humanTakeDie - dieValue) * 2;
            }
        } else {
            // Going first in Take
            if (dieValue >= 5 && aiCombo >= 3) { return dieValue * 4 + aiCombo * 2; }
            if (dieValue >= 5)                  { return dieValue * 3; }
            if (dieValue >= 4)                  { return dieValue * 2; }
            return dieValue - 4; // Low die going first = risky
        }
    }

    // ── Save scoring — score-based thresholds ─────────────────────────────────

    scoreSave(dieValue, highScore) {
        if (highScore >= 80) {
            if (dieValue === 6) { return 22; }
            if (dieValue === 5) { return 14; }
            if (dieValue === 4) { return  4; }
            return -12;
        }
        if (highScore >= 50) {
            if (dieValue >= 5) { return 14; }
            if (dieValue >= 4) { return  7; }
            return -3;
        }
        if (dieValue >= 5) { return 12; }
        if (dieValue >= 4) { return  5; }
        return -2;
    }

    // ── Find empty red pockets ────────────────────────────────────────────────

    getEmptyPockets() {
        return ['Keep1', 'Keep2', 'Take', 'Save'].filter(pocket => {
            const el = document.getElementById('red' + pocket);
            return el && el.querySelectorAll('.dice').length === 0;
        });
    }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let pocketsAI = new PocketsAI('medium');

function setAIDifficulty(difficulty) {
    aiDifficulty = difficulty;
    pocketsAI    = new PocketsAI(difficulty);
    ['easyAI', 'mediumAI', 'hardAI'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) { btn.classList.remove('active'); }
    });
    const btn = document.getElementById(difficulty + 'AI');
    if (btn) { btn.classList.add('active'); }
}

// ── AI move execution ─────────────────────────────────────────────────────────

function makeAIMoveExternal() {
    if (!gameState || !gameMode) { return; }
    if (gameMode !== 'ai' || gameState.currentPlayer !== 'red' || aiThinking) { return; }

    aiThinking = true;
    setTimeout(function() {
        try {
            const move = pocketsAI.calculateBestMove(gameState);
            if (!move) { aiThinking = false; return; }

            const capturedValue = gameState.redDice[move.dieIndex];
            gameState.selectedDie = { player: 'red', index: move.dieIndex, value: capturedValue };

            const pocketEl = document.getElementById('red' + move.pocket);
            if (pocketEl) { placeDieInPocket(pocketEl); }
        } catch (err) {
            console.error('AI move error:', err);
        }
        aiThinking = false;
    }, pocketsAI.getThinkTime());
}
