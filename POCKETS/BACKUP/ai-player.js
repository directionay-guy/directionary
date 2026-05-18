// POCKETS AI PLAYER MODULE
// Intelligent opponent with multiple difficulty levels.
//
// Updates in this version:
//  1. Renamed entry point to makeAIMoveExternal so game-engine.js actually
//     routes through the smart AI (was being overwritten by game-engine's
//     own makeAIMove and silently falling back to random).
//  2. evaluateSaveMove rebalanced for the 10-round game — early 1-4,
//     mid 5-7, late 8-9 (round 10 is the Grand Finale). 4+ is positively
//     valued throughout, not penalized late.
//  3. Blind Share placement (opponent's Share still empty) now uses a
//     contextual estimate that scales with die strength and combo potential
//     instead of the flat dieValue * 3.
//  4. Share-loss penalty scales with the wasted die: dumping a 6 into a
//     losing share hurts more than dumping a 3.
//  5. Think times cut roughly in half across all difficulties.
//  6. Dead code (selectDie, choosePocket on the class) removed.

class PocketsAI {
    constructor(difficulty = 'medium') {
        this.difficulty = difficulty;
        this.thinking = false;
        this.personality = this.getPersonality(difficulty);
    }

    getPersonality(difficulty) {
        const personalities = {
            easy: {
                name: "Rookie Bot",
                thinkTime: [400, 700],
                randomness: 0.4,
                lookahead: 1,
                aggression: 0.3
            },
            medium: {
                name: "Clever Bot",
                thinkTime: [600, 1000],
                randomness: 0.2,
                lookahead: 2,
                aggression: 0.6
            },
            hard: {
                name: "Master Bot",
                thinkTime: [900, 1400],
                randomness: 0.1,
                lookahead: 3,
                aggression: 0.8
            }
        };
        return personalities[difficulty] || personalities.medium;
    }

    async makeMove(gameState) {
        if (this.thinking) return null;

        this.thinking = true;
        const thinkTime = this.getThinkTime();

        // Simulate thinking delay
        await new Promise(resolve => setTimeout(resolve, thinkTime));

        const move = this.calculateBestMove(gameState);
        this.thinking = false;

        return move;
    }

    getThinkTime() {
        const [min, max] = this.personality.thinkTime;
        return Math.random() * (max - min) + min;
    }

    calculateBestMove(gameState) {
        const availableDice = [...gameState.redDice];
        const emptyPockets = this.getEmptyPockets();

        if (availableDice.length === 0 || emptyPockets.length === 0) {
            return null;
        }

        let bestMove = null;
        let bestScore = -Infinity;

        // Evaluate each possible die placement
        availableDice.forEach((dieValue, dieIndex) => {
            emptyPockets.forEach(pocket => {
                const moveScore = this.evaluateMove(dieValue, pocket, gameState);

                // Add randomness based on difficulty
                const randomFactor = (Math.random() - 0.5) * this.personality.randomness * 10;
                const finalScore = moveScore + randomFactor;

                if (finalScore > bestScore) {
                    bestScore = finalScore;
                    bestMove = {
                        dieIndex,
                        dieValue,
                        pocket,
                        expectedScore: moveScore
                    };
                }
            });
        });

        return bestMove;
    }

    evaluateMove(dieValue, pocket, gameState) {
        const bluePockets = getDiceFromPockets('blue');
        let score = 0;

        switch (pocket) {
            case 'Keep1':
            case 'Keep2':
                // High dice are good for keeping
                score = dieValue * 2;

                // Bonus for very high dice
                if (dieValue >= 5) score += 5;
                break;

            case 'Share':
                score = this.evaluateShareMove(dieValue, bluePockets, gameState);
                break;

            case 'Save':
                score = this.evaluateSaveMove(dieValue, gameState);
                break;
        }

        // Apply difficulty-based adjustments
        if (this.difficulty === 'easy') {
            score *= 0.7; // Reduce strategic thinking
        } else if (this.difficulty === 'hard') {
            score *= 1.3; // Enhance strategic thinking
            score += this.getAdvancedBonus(dieValue, pocket, gameState);
        }

        return score;
    }

    evaluateShareMove(dieValue, bluePockets, gameState) {
        let score = 0;

        if (bluePockets.share && bluePockets.share.length > 0) {
            const blueShareValue = bluePockets.share[0];

            if (dieValue > blueShareValue) {
                // We can win the share battle
                const shareDiff = dieValue - blueShareValue;
                score = shareDiff * 5; // Base share bonus

                // Add combo bonus potential
                const comboBonus = calculateBonusPoints(gameState.redOriginalRoll);
                score += comboBonus * 3;

                // Aggressive AI values share battles more
                score *= (1 + this.personality.aggression);
            } else if (dieValue === blueShareValue) {
                // Tie - neutral
                score = 1;
            } else {
                // We lose - penalty scales with the value of the die wasted.
                // Dumping a 6 into a losing share is much worse than dumping a 3.
                score = -Math.ceil(dieValue * 1.5);
            }
        } else {
            // Blue hasn't placed share yet — estimate value contextually.
            // Higher dice are favored to win; lower dice are likely to lose.
            if (dieValue >= 5) {
                score = dieValue * 4;   // Strong favorite
            } else if (dieValue === 4) {
                score = dieValue * 3;   // Above-average, usually wins
            } else if (dieValue === 3) {
                score = dieValue * 1.5; // Coin flip territory
            } else {
                score = dieValue * 0.5; // Likely loser
            }

            // Combo potential only counts if we can plausibly win the share
            if (dieValue >= 4) {
                const comboBonus = calculateBonusPoints(gameState.redOriginalRoll);
                if (comboBonus > 0) {
                    score += comboBonus * 2;
                }
            }
        }

        return score;
    }

    evaluateSaveMove(dieValue, gameState) {
        let score = 0;

        // Early game (rounds 1-4): save high dice generously
        if (gameState.round <= 4) {
            if (dieValue === 6)      score = 18;
            else if (dieValue === 5) score = 12;
            else if (dieValue === 4) score = 6;
            else if (dieValue === 3) score = -2;
            else                     score = -5;
        }
        // Mid game (rounds 5-7): still solidly value saves
        else if (gameState.round <= 7) {
            if (dieValue === 6)      score = 15;
            else if (dieValue === 5) score = 10;
            else if (dieValue === 4) score = 5;
            else if (dieValue === 3) score = -3;
            else                     score = -6;
        }
        // Late game (rounds 8-9): a saved 4+ is still gold for the Grand Finale
        else {
            if (dieValue === 6)      score = 15;
            else if (dieValue === 5) score = 10;
            else if (dieValue === 4) score = 5;
            else if (dieValue === 3) score = -2;
            else if (dieValue === 2) score = -5;
            else                     score = -8;
        }

        return score;
    }

    getAdvancedBonus(dieValue, pocket, gameState) {
        let bonus = 0;

        // Look ahead to future rounds (10-round game)
        if (this.personality.lookahead >= 2) {
            const remainingRounds = 10 - gameState.round;

            // Value keeping high dice more in early game
            if (pocket.includes('Keep') && remainingRounds > 5) {
                bonus += dieValue * 0.5;
            }

            // Consider current score difference
            const scoreDiff = gameState.redScore - gameState.blueScore;
            if (scoreDiff < 0) {
                // We're behind - be more aggressive
                if (pocket === 'Share') bonus += 3;
            } else if (scoreDiff > 10) {
                // We're ahead - play safer
                if (pocket.includes('Keep')) bonus += 2;
            }
        }

        // Pattern recognition (hard difficulty only)
        if (this.difficulty === 'hard') {
            bonus += this.getPatternBonus(dieValue, pocket, gameState);
        }

        return bonus;
    }

    getPatternBonus(dieValue, pocket, gameState) {
        let bonus = 0;

        const bluePockets = getDiceFromPockets('blue');

        // If blue often saves low dice, we should be more aggressive in shares
        if (pocket === 'Share' && gameState.blueSavedDie && gameState.blueSavedDie <= 3) {
            bonus += 2;
        }

        // If we have combo potential, prioritize share placement
        const comboValue = calculateBonusPoints(gameState.redOriginalRoll);
        if (comboValue > 0 && pocket === 'Share') {
            bonus += comboValue;
        }

        // Endgame strategy adjustments — shifted earlier for the 10-round game
        if (gameState.round >= 7) {
            const scoreDiff = gameState.redScore - gameState.blueScore;

            if (scoreDiff < -15) {
                // Desperate - take risks
                if (pocket === 'Share') bonus += 5;
            } else if (scoreDiff > 15) {
                // Comfortable lead - play safe
                if (pocket.includes('Keep')) bonus += 3;
            }
        }

        return bonus;
    }

    getEmptyPockets() {
        const emptyPockets = [];
        const pocketNames = ['Keep1', 'Keep2', 'Share', 'Save'];

        pocketNames.forEach(pocket => {
            const pocketElement = document.getElementById(`red${pocket}`);
            if (pocketElement && pocketElement.querySelectorAll('.dice').length === 0) {
                emptyPockets.push(pocket);
            }
        });

        return emptyPockets;
    }
}

// Create global AI instance
let pocketsAI = new PocketsAI('medium');

// AI entry point for game-engine.js.
//
// IMPORTANT: This function is intentionally named makeAIMoveExternal rather
// than makeAIMove. game-engine.js declares its own makeAIMove (a random
// fallback) and, because it loads after ai-player.js, would overwrite any
// makeAIMove we defined here. The engine then specifically looks for
// makeAIMoveExternal and delegates to it. Keep this name.
async function makeAIMoveExternal() {
    if (gameMode !== 'ai' || gameState.currentPlayer !== 'red' || aiThinking) {
        return;
    }

    aiThinking = true;
    updateGameStatus();

    try {
        const move = await pocketsAI.makeMove(gameState);

        if (move && move.dieIndex !== null && move.pocket) {
            gameState.selectedDie = { player: 'red', index: move.dieIndex };
            const pocketElement = document.getElementById(`red${move.pocket}`);
            if (pocketElement) {
                placeDieInPocket(pocketElement);
            }
        }
    } catch (error) {
        console.error('AI move failed:', error);
        // Fallback to simple random move
        const dieIndex = Math.floor(Math.random() * gameState.redDice.length);
        const emptyPockets = pocketsAI.getEmptyPockets();
        if (emptyPockets.length > 0) {
            gameState.selectedDie = { player: 'red', index: dieIndex };
            const pocket = emptyPockets[Math.floor(Math.random() * emptyPockets.length)];
            const pocketElement = document.getElementById(`red${pocket}`);
            if (pocketElement) {
                placeDieInPocket(pocketElement);
            }
        }
    }

    aiThinking = false;
}

function updateAIDifficulty(difficulty) {
    pocketsAI = new PocketsAI(difficulty);
    aiDifficulty = difficulty;
}

// Expose to the global scope so game-engine.js's
// `typeof makeAIMoveExternal === 'function'` check succeeds, and so the
// instance is reachable from dev tools for debugging.
window.makeAIMoveExternal = makeAIMoveExternal;
window.pocketsAI = pocketsAI;
window.PocketsAI = {
    PocketsAI,
    makeAIMoveExternal,
    updateAIDifficulty
};
