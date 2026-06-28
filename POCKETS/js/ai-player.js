// POCKETS AI PLAYER MODULE — v3.1
// AI always plays as Red. Human always plays as Blue internally.
// If human chose "Play as Red," that's a visual/stats swap only — game logic unchanged.
//
// DEV NOTE — to future Claude:
// Do NOT compress or minify this file. Do NOT chain ternaries.
// Write one statement per line. Readability = reliability here (see game-engine.js
// for the same standing instruction — it applies equally here).
//
// TIER ARCHITECTURE (v3.1 — one shared engine, three lenses):
// All three difficulties run through the SAME scorePlacement()/scoreKeep()/
// scoreTake()/scoreSave() logic. What differs between tiers is what each one is
// ALLOWED TO SEE, via the "context" object built per-turn in buildContext().
// A tier that can't see a signal just gets a neutral default for it, which makes
// that part of the scoring math a no-op for that tier. This means a future tweak
// to how Take or Save is scored improves all three tiers at once, instead of
// needing to be re-derived three separate times.
//
//   - Hard:   full context. Own hand quality, the opponent's round-so-far signal,
//             a REAL calculated rounds-to-close-the-gap (recomputed fresh from the
//             live score every decision, never a stored counter), and Rolldown
//             proximity. No deliberate mistakes — natural dice variance is what
//             keeps Hard beatable, not artificial sandbagging.
//   - Medium: a genuine middle lens, not "old buggy Hard." Sees its own hand
//             quality and Rolldown proximity, same as Hard. Does NOT read the
//             opponent's placed dice at all. Its gap-awareness uses a CRUDER,
//             coarse-step approximation instead of Hard's real calculation —
//             principled simplification, not leftover bugs.
//   - Easy:   tutorial tier. Sees only the Rolldown-imminent flag (just "is the
//             score getting close to 100" — the kind of thing even a brand new
//             player notices on screen) and raw die values. No hand-quality
//             awareness, no opponent awareness, no gap calculation at all. On top
//             of that limited lens, it has a real chance each turn of making a
//             RECOGNIZABLE beginner mistake (wasting a strong die in Save, or
//             risking Take with the weak die while a strong one sits unused) —
//             that part is an intentional add-on, not something to remove.
//
// One piece of game-state awareness is universal across ALL tiers, not gated by
// difficulty at all: knowing whether the human has already placed a die in Take.
// That's not a strategic skill, it's just visible board state — any player at
// any skill level can see it, so every tier gets it.

class PocketsAI {
    constructor(difficulty = 'medium') {
        this.difficulty  = difficulty;
        this.thinking    = false;
        this.personality = this.getPersonality(difficulty);
    }

    getPersonality(difficulty) {
        return {
            easy:   { name: 'Rookie Bot', thinkTime: [700,  1100], mistakeChance: 0.30 },
            medium: { name: 'Clever Bot', thinkTime: [1100, 1700] },
            hard:   { name: 'Master Bot', thinkTime: [1400, 2000] }
        }[difficulty] || { name: 'Clever Bot', thinkTime: [1100, 1700] };
    }

    getThinkTime() {
        const [min, max] = this.personality.thinkTime;
        return Math.random() * (max - min) + min;
    }

    // =============================================================================
    // MAIN ENTRY
    // =============================================================================

    calculateBestMove(gameState) {
        const availDice    = [...gameState.redDice];
        const emptyPockets = this.getEmptyPockets();
        if (availDice.length === 0 || emptyPockets.length === 0) { return null; }

        const context = this.buildContext(availDice, gameState);

        if (this.difficulty === 'easy') {
            return this.calculateGreedyMove(availDice, emptyPockets, context);
        }
        return this.calculateHolisticMove(availDice, emptyPockets, context);
    }

    // =============================================================================
    // CONTEXT BUILDER — this is where the three tiers actually diverge.
    // Everything below scores moves identically regardless of difficulty; only
    // what goes INTO the context differs.
    // =============================================================================

    buildContext(availDice, gameState) {
        const aiScore       = gameState.redScore  || 0;
        const humanScore    = gameState.blueScore || 0;
        const scoreDiff     = aiScore - humanScore;
        const humanPockets  = getDiceFromPockets('blue');
        const humanTakeDie  = (humanPockets.take && humanPockets.take.length > 0)
            ? humanPockets.take[0] : null;

        // Neutral defaults — a tier that doesn't earn a signal below just keeps these,
        // which makes the corresponding scoring adjustments no-ops for that tier.
        const context = {
            aiCombo:          calculateBonusPoints(gameState.redOriginalRoll || []),
            humanTakeDie:     humanTakeDie, // universal: visible board state, not a skill
            ownHandQuality:   3.5,
            opponentSignal:   3.5,
            roundsToClose:    0,
            rolldownImminent: false
        };

        if (this.difficulty === 'hard') {
            context.ownHandQuality   = this.getHandQuality(availDice);
            context.opponentSignal   = this.getOpponentRoundSignal(humanPockets);
            context.roundsToClose    = this.estimateRoundsToCloseGap(scoreDiff);
            context.rolldownImminent = Math.max(aiScore, humanScore) >= 80;
        } else if (this.difficulty === 'medium') {
            context.ownHandQuality   = this.getHandQuality(availDice);
            // opponentSignal stays neutral — Medium doesn't read the opponent's pockets.
            context.roundsToClose    = this.estimateRoundsToCloseGapCrude(scoreDiff);
            context.rolldownImminent = Math.max(aiScore, humanScore) >= 80;
        } else {
            // Easy: only the simple Rolldown flag, same as a beginner glancing at the score.
            context.rolldownImminent = Math.max(aiScore, humanScore) >= 80;
        }

        return context;
    }

    // Average value of the AI's currently-unplaced dice this round.
    getHandQuality(availDice) {
        if (availDice.length === 0) { return 3.5; }
        const sum = availDice.reduce((a, b) => a + b, 0);
        return sum / availDice.length;
    }

    // What has the human placed so far THIS round, averaged across all their
    // filled pockets? Higher = opponent appears to be having a strong round.
    getOpponentRoundSignal(humanPockets) {
        const placed = [];
        ['keep1', 'keep2', 'take', 'save'].forEach(function(pt) {
            if (humanPockets[pt]) { placed.push.apply(placed, humanPockets[pt]); }
        });
        if (placed.length === 0) { return 3.5; }
        return placed.reduce((a, b) => a + b, 0) / placed.length;
    }

    // HARD's real calculation — how many "typical good rounds" would close the
    // current gap. Recomputed fresh from the live score every single call, never
    // stored, so one big round that closes the gap reduces this back toward zero
    // on the very next decision with no separate "stop now" rule needed.
    estimateRoundsToCloseGap(scoreDiff) {
        if (scoreDiff >= 0) { return 0; }
        const TYPICAL_ROUND_GAIN = 16; // internal yardstick only, not a game rule
        return (-scoreDiff) / TYPICAL_ROUND_GAIN;
    }

    // MEDIUM's cruder lens on the same idea — recognizes being behind only in
    // coarse steps rather than Hard's smooth calculation. A real simplification,
    // not a stand-in for a bug.
    estimateRoundsToCloseGapCrude(scoreDiff) {
        if (scoreDiff >= 0) { return 0; }
        const deficit = -scoreDiff;
        if (deficit > 40) { return 3; }
        if (deficit > 20) { return 2; }
        if (deficit > 8)  { return 1; }
        return 0;
    }

    // =============================================================================
    // SHARED SCORING ENGINE — identical for every tier. Tier differences come
    // entirely from what's in `context`, never from branching on difficulty here.
    // =============================================================================

    scorePlacement(dieValue, pocket, context) {
        switch (pocket) {
            case 'Keep1':
            case 'Keep2':
                return this.scoreKeep(dieValue, context);
            case 'Take':
                return this.scoreTake(dieValue, context);
            case 'Save':
                return this.scoreSave(dieValue, context);
        }
        return 0;
    }

    scoreKeep(dieValue, context) {
        let score = dieValue * 2;
        if (dieValue >= 5) { score += 4; }

        // Opponent appears to be having a strong round — guaranteed points matter
        // more (race dynamic). No-op for tiers without opponentSignal access.
        if (context.opponentSignal >= 4.5) { score += 2; }

        // Meaningfully behind and this die is modest — worth slightly less here
        // than it would be banked toward closing the gap.
        if (context.roundsToClose > 1.5 && dieValue <= 3) { score -= 1; }

        return score;
    }

    scoreTake(dieValue, context) {
        // Universal: if the human has already committed to Take, the outcome is
        // knowable to any player at any skill level — this isn't gated by tier.
        if (context.humanTakeDie !== null) {
            if (dieValue > context.humanTakeDie) {
                const diff = dieValue - context.humanTakeDie;
                return diff * 5 + context.aiCombo * 3.5;
            }
            if (dieValue === context.humanTakeDie) { return 0; }
            return -4 - (context.humanTakeDie - dieValue) * 2;
        }

        // Going first — no flat "always favor the high die" rule. Weighed against
        // hand quality and opponent signal, where the current tier has access to them.
        let base;
        if (dieValue >= 5)       { base = dieValue * 3; }
        else if (dieValue === 4) { base = dieValue * 1.5; }
        else                     { base = dieValue - 4; }

        // Own hand this round is weak overall — a strong die is worth more kept
        // safe than risked on a Take battle with thin backup. No-op without
        // ownHandQuality access (stays at the neutral 3.5 default).
        if (context.ownHandQuality < 3 && dieValue >= 5) { base -= 4; }

        // Opponent's round looks weak so far — Take is a safer bet even with a
        // modest die. No-op without opponentSignal access.
        if (context.opponentSignal < 3 && dieValue >= 4) { base += 3; }

        return base;
    }

    scoreSave(dieValue, context) {
        let score = dieValue * 1.5;

        // Calculated banking — value scales with how far behind the AI actually
        // is right now (using whichever gap-estimate this tier has access to).
        if (context.roundsToClose > 0) {
            score += Math.min(context.roundsToClose, 3) * dieValue * 1.2;
        }

        // Rolldown approaching — a saved die becomes a guaranteed-scoring 5th die
        // there. Available to all three tiers, including Easy's simple flag version.
        if (context.rolldownImminent && dieValue >= 4) {
            score += dieValue * 1.5;
        }

        // Already ahead or even — no reason to over-bank a weak die.
        if (context.roundsToClose === 0 && dieValue <= 3) { score -= 2; }

        return score;
    }

    // =============================================================================
    // SEARCH STRATEGIES — Easy reasons greedily (one die at a time, no lookahead
    // across its own remaining dice); Medium and Hard both search every possible
    // full arrangement and play the first move of the best one. This is a second,
    // separate axis from the context lenses above — "how hard does it think,"
    // not "what does it see."
    // =============================================================================

    calculateGreedyMove(availDice, emptyPockets, context) {
        if (Math.random() < this.personality.mistakeChance) {
            const mistake = this.makeObviousMistake(availDice, emptyPockets);
            if (mistake) { return mistake; }
        }

        let bestMove  = null;
        let bestScore = -Infinity;
        availDice.forEach((dieValue, dieIndex) => {
            emptyPockets.forEach(pocket => {
                const score = this.scorePlacement(dieValue, pocket, context);
                if (score > bestScore) {
                    bestScore = score;
                    bestMove  = { dieIndex, dieValue, pocket, expectedScore: score };
                }
            });
        });
        return bestMove;
    }

    calculateHolisticMove(availDice, emptyPockets, context) {
        const numSlots = Math.min(availDice.length, emptyPockets.length);
        let bestTotal      = -Infinity;
        let bestAssignment = null;

        this.permute(availDice.map((v, i) => i), numSlots).forEach(dieIndices => {
            let total = 0;
            dieIndices.forEach((dieIdx, slotIdx) => {
                total += this.scorePlacement(availDice[dieIdx], emptyPockets[slotIdx], context);
            });
            if (total > bestTotal) {
                bestTotal      = total;
                bestAssignment = dieIndices;
            }
        });

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

    // =============================================================================
    // EASY's deliberate mistake layer — intentional, not something to remove.
    // Recognizable beginner errors, visible even to someone who only skimmed the
    // rules: wasting the best die in Save, or risking Take with the weakest die
    // while a stronger one sits unused.
    // =============================================================================

    makeObviousMistake(availDice, emptyPockets) {
        const sorted     = [...availDice].sort((a, b) => b - a);
        const highest    = sorted[0];
        const lowest     = sorted[sorted.length - 1];
        const highestIdx = availDice.indexOf(highest);
        const lowestIdx  = availDice.indexOf(lowest);

        if (emptyPockets.includes('Save') && highest >= 4) {
            return { dieIndex: highestIdx, dieValue: highest, pocket: 'Save', expectedScore: 0 };
        }
        if (emptyPockets.includes('Take') && availDice.length > 1 && highest !== lowest) {
            return { dieIndex: lowestIdx, dieValue: lowest, pocket: 'Take', expectedScore: 0 };
        }
        return null;
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
    const cDiffEl = document.getElementById('cDiff');
    if (cDiffEl) { cDiffEl.value = difficulty; }
    if (typeof savePocketsSettings === 'function') { savePocketsSettings(); }
    if (typeof showDifficultyToast === 'function') { showDifficultyToast(difficulty); }
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

            // Exactly the same sequence a human's own click gives: glow the
            // chosen die, then highlight the available pockets for that side
            // (the same per-theme "active" outline, not a separate invented
            // visual). placeDieInPocket() naturally clears all of it via its
            // own pocket-reset-via-cloning, same as it does for a human turn.
            var dieEl = document.querySelector('[data-id="red-' + move.dieIndex + '"]');
            if (dieEl) { dieEl.classList.add('selected'); }
            if (typeof highlightAvailablePockets === 'function') { highlightAvailablePockets(); }

            setTimeout(function() {
                if (dieEl) { dieEl.classList.remove('selected'); }
                var pocketEl = document.getElementById('red' + move.pocket);
                if (pocketEl) { placeDieInPocket(pocketEl); }
                aiThinking = false;
            }, 500);
        } catch (err) {
            console.error('AI move error:', err);
            aiThinking = false;
        }
    }, pocketsAI.getThinkTime());
}
