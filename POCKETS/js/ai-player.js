// POCKETS AI PLAYER MODULE — v4.0
// AI always plays as Red. Human always plays as Blue internally.
// If human chose "Play as Red," that's a visual/stats swap only — game logic unchanged.
//
// DEV NOTE — to future Claude:
// Do NOT compress or minify this file. Do NOT chain ternaries.
// Write one statement per line. Readability = reliability here (see game-engine.js
// for the same standing instruction — it applies equally here).
//
// ─────────────────────────────────────────────────────────────────────────────
// WHAT CHANGED IN v4.0 — READ THIS BEFORE TOUCHING THE SCORING
//
// v3.1's architecture was sound: one shared scoring engine, three lenses, and a
// full-arrangement search. The BUG was in the numbers.
//
// Every score function invented its own currency. Keep paid dieValue*2 (+4 for a
// high die). Take paid dieValue*3 going first, or margin*5 when answering. Save
// paid dieValue*1.5. These units were not comparable to one another, and Take's
// was simply the most inflated — so for ANY 5 or 6, Take outscored Keep before a
// combo or an opponent was even considered:
//
//        die   KEEP   TAKE      the AI would...
//          5     14     15      ...always fight
//          6     16     18      ...always fight
//
// That is why the AI seemed to have exactly one idea: WIN THE TAKE. It wasn't
// choosing to. It was compelled to, every round, at every difficulty, because
// Take was simply the biggest number on its own scoreboard.
//
// v4.0 fixes this by putting every pocket in the SAME unit: REAL EXPECTED POINTS.
//   - Keep pays the die's face value, because that is literally what it scores.
//   - Take pays the expected MARGIN plus the combo, and only when it wins.
//   - Save pays the die's edge over the ~3.5 the AI would have re-rolled anyway.
//
// Crucially, the opportunity cost of a Take fight now falls out FOR FREE. The
// search already compares complete four-die arrangements, so sending the best die
// to Take automatically demotes both Keep dice inside the very same comparison.
// No special rule was needed — the old numbers were just drowning the signal.
//
// The upshot: the AI now fights for Take when the margin plus combo is worth more
// than the Keep points it gives up, and concedes gracefully when it isn't —
// which is exactly what a good human does.
// ─────────────────────────────────────────────────────────────────────────────
//
// TIER ARCHITECTURE (one shared engine, three lenses):
// All three difficulties run through the SAME scorePlacement()/scoreKeep()/
// scoreTake()/scoreSave() logic. What differs between tiers is what each one is
// ALLOWED TO SEE, via the "context" object built per-turn in buildContext().
// A tier that can't see a signal just gets a neutral default for it, which makes
// that part of the scoring math a no-op for that tier.
//
//   - Hard:   full context. Own hand quality, the opponent's round-so-far signal,
//             a REAL calculated rounds-to-close-the-gap, Rolldown proximity, and
//             — new in v4.0 — the opponent's UNPLACED dice. POCKETS is an open-
//             information game: both players' dice sit face-up all round long.
//             Hard now actually looks. That lets it know whether a Take fight is
//             winnable at all before committing a die to it, and to win the
//             pocket with the CHEAPEST die that does the job instead of
//             overpaying with its 6.
//   - Medium: sees its own hand quality and Rolldown proximity. Does NOT read the
//             opponent's dice or pockets at all. Its gap-awareness uses a cruder,
//             coarse-step approximation instead of Hard's real calculation.
//   - Easy:   tutorial tier. Sees only the Rolldown-imminent flag and raw die
//             values, plus a real chance each turn of a recognizable beginner
//             mistake. That mistake layer is intentional — do not remove it.
//
// One piece of game-state awareness is universal across ALL tiers: knowing
// whether the human has already placed a die in Take. That's not a strategic
// skill, it's just visible board state.

class PocketsAI {
    constructor(difficulty = 'medium') {
        this.difficulty  = difficulty;
        this.thinking    = false;
        this.personality = this.getPersonality(difficulty);
    }

    getPersonality(difficulty) {
        return {
            easy:   { name: 'Rookie Bot', thinkTime: [400,  700],  mistakeChance: 0.30 },
            medium: { name: 'Clever Bot', thinkTime: [700,  1100] },
            hard:   { name: 'Master Bot', thinkTime: [900,  1400] }
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

        // Neutral defaults — a tier that doesn't earn a signal below just keeps
        // these, which makes the corresponding scoring adjustments no-ops for it.
        const context = {
            aiCombo:          calculateBonusPoints(gameState.redOriginalRoll || []),
            humanTakeDie:     humanTakeDie, // universal: visible board state, not a skill
            humanUnplaced:    null,         // Hard only — see note below
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
            // POCKETS is an open-information game — the human's unplaced dice are
            // face-up on the board all round long. Hard is the tier that actually
            // reads them. This is not cheating: it is looking at what any player
            // can already see, and what a good human absolutely does look at.
            context.humanUnplaced    = [...(gameState.blueDice || [])];
        } else if (this.difficulty === 'medium') {
            context.ownHandQuality   = this.getHandQuality(availDice);
            // opponentSignal stays neutral — Medium doesn't read the opponent.
            context.roundsToClose    = this.estimateRoundsToCloseGapCrude(scoreDiff);
            context.rolldownImminent = Math.max(aiScore, humanScore) >= 80;
        } else {
            // Easy: only the simple Rolldown flag, same as a beginner glancing
            // at the score.
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
    // current gap. Recomputed fresh from the live score every single call.
    estimateRoundsToCloseGap(scoreDiff) {
        if (scoreDiff >= 0) { return 0; }
        const TYPICAL_ROUND_GAIN = 16; // internal yardstick only, not a game rule
        return (-scoreDiff) / TYPICAL_ROUND_GAIN;
    }

    // MEDIUM's cruder lens on the same idea — coarse steps, not a smooth curve.
    estimateRoundsToCloseGapCrude(scoreDiff) {
        if (scoreDiff >= 0) { return 0; }
        const deficit = -scoreDiff;
        if (deficit > 40) { return 3; }
        if (deficit > 20) { return 2; }
        if (deficit > 8)  { return 1; }
        return 0;
    }

    // =============================================================================
    // SHARED SCORING ENGINE — every function below returns REAL EXPECTED POINTS.
    // That single common unit is what makes the pockets comparable to each other,
    // and it is what lets the arrangement search price a Take fight's true cost
    // without ever being told about it.
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

    // A Keep die scores its face value. Exactly that. No multiplier, no high-die
    // bonus — inflating this was half of what made the old numbers incomparable.
    scoreKeep(dieValue, context) {
        let score = dieValue;

        // Opponent looks to be having a strong round — guaranteed points matter a
        // little more. A nudge, not a thumb on the scale. (No-op without the signal.)
        if (context.opponentSignal >= 4.5) { score += 0.4; }

        return score;
    }

    // Take pays the MARGIN you win by, plus your combo — and only if you win.
    // Lose it and the pocket scores nothing at all. That's the real rule, and now
    // it is finally the real number.
    scoreTake(dieValue, context) {
        // ── Answering: the human has already committed a die to Take. ──
        // Universal across tiers — plain visible board state, not a skill.
        if (context.humanTakeDie !== null) {
            const diff = dieValue - context.humanTakeDie;
            if (diff > 0) {
                return diff + context.aiCombo;   // won: margin + combo, in points
            }
            return 0;                            // tied or lost: Take pays nothing
        }

        // ── Going first: the outcome isn't known yet, so estimate it. ──

        // HARD: it can see the human's unplaced dice, so it doesn't have to guess.
        if (context.humanUnplaced !== null && context.humanUnplaced.length > 0) {
            const theirBest  = Math.max.apply(null, context.humanUnplaced);
            const theirWorst = Math.min.apply(null, context.humanUnplaced);

            if (dieValue > theirBest) {
                // Unbeatable. They cannot answer this die, so they will concede
                // with their worst one. That margin isn't a hope — it's arithmetic.
                return (dieValue - theirWorst) + context.aiCombo;
            }
            // They still hold something that beats or ties this. Assume they'll use
            // it if it's worth their while, so this Take is probably dead. Value it
            // near zero — which quietly lets the search prefer parking a LOW die
            // here and banking the good ones, exactly as a strong human would.
            return 0.3;
        }

        // MEDIUM / EASY: no read on the opponent, so fall back to honest
        // probability against a uniform 1–6 answer.
        //   P(win)                    = (d − 1) / 6
        //   E[margin], summed over all = d(d − 1) / 12
        const pWin      = (dieValue - 1) / 6;
        const expMargin = (dieValue * (dieValue - 1)) / 12;
        let   base      = expMargin + (context.aiCombo * pWin);

        // Own hand is weak overall — a strong die is worth more banked than risked
        // on a Take battle with thin backup. (No-op without ownHandQuality.)
        if (context.ownHandQuality < 3 && dieValue >= 5) { base -= 1.5; }

        return base;
    }

    // A saved die replaces a die the AI would otherwise have ROLLED next round,
    // and a rolled die averages 3.5. So the true value of saving is the EDGE over
    // that 3.5 — which is precisely why saving a 2 is genuinely bad and saving a
    // 6 is genuinely good.
    scoreSave(dieValue, context) {
        let score = dieValue - 3.5;

        // Behind — a guaranteed strong die next round is worth more when there's
        // ground to make up. Scales with how far behind this tier thinks it is.
        if (context.roundsToClose > 0 && dieValue >= 4) {
            score += Math.min(context.roundsToClose, 3) * 0.5;
        }

        // The Rolldown is close, and whatever sits in Save when it triggers becomes
        // a guaranteed-scoring 5th die there. Worth real points — and all three
        // tiers can see this one.
        if (context.rolldownImminent) {
            score += (dieValue - 3.5) * 1.2;
        }

        return score;
    }

    // =============================================================================
    // SEARCH STRATEGIES — Easy reasons greedily (one die at a time, no lookahead);
    // Medium and Hard both search every possible full arrangement and play the
    // first move of the best one. This is a second, separate axis from the context
    // lenses above — "how hard does it think," not "what does it see."
    //
    // This search is also what prices the cost of a Take fight. Because it totals
    // a COMPLETE arrangement, sending the best die to Take is automatically
    // compared against the Keep points that same die would have earned instead.
    // Now that every pocket finally speaks in points, that comparison means
    // something.
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
    const uDiffEl = document.getElementById('uDiff');
    if (uDiffEl) { uDiffEl.value = difficulty; }
    if (typeof savePocketsSettings === 'function') { savePocketsSettings(); }
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
