// POCKETS AI PLAYER MODULE
// Intelligent opponent with multiple difficulty levels

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
                thinkTime: [800, 1200],
                randomness: 0.4,
                lookahead: 1,
                aggression: 0.3
            },
            medium: {
                name: "Clever Bot", 
                thinkTime: [1200, 1800],
                randomness: 0.2,
                lookahead: 2,
                aggression: 0.6
            },
            hard: {
                name: "Master Bot",
                thinkTime: [1800, 2500],
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
                // We lose - penalty
                score = -5;
            }
        } else {
            // Blue hasn't placed share yet - estimate value
            if (dieValue >= 4) {
                score = dieValue * 3; // Good positioning
            } else {
                score = dieValue; // Weak positioning
            }
        }

        return score;
    }

    evaluateSaveMove(dieValue, gameState) {
        let score = 0;
        const currentScore = gameState.redScore;

        // Early game (below 50pts): save high dice for Finale potential
        if (currentScore < 50) {
            if (dieValue >= 5) {
                score = 15; // Very valuable to save high dice early
            } else if (dieValue >= 4) {
                score = 8;
            } else {
                score = -2; // Don't save low dice early
            }
        }
        // Mid game (50-80pts): be more selective
        else if (currentScore < 80) {
            if (dieValue >= 6) {
                score = 12;
            } else if (dieValue >= 5) {
                score = 6;
            } else {
                score = -5; // Strongly avoid saving low dice
            }
        }
        // Late game (80-100+): save high or nothing — Finale is coming
        else {
            if (dieValue === 6) {
                score = 8;
            } else if (dieValue === 5) {
                score = 4;
            } else {
                score = -10; // Almost never save low in late game
            }
        }

        return score;
    }

    getAdvancedBonus(dieValue, pocket, gameState) {
        let bonus = 0;

        // Look ahead — estimate rounds remaining based on scoring pace
        if (this.personality.lookahead >= 2) {
            const pointsToFinale = Math.max(0, 100 - gameState.redScore);
            const isLateGame = gameState.redScore >= 80 || gameState.blueScore >= 80;
            const isEarlyGame = gameState.redScore < 50 && gameState.blueScore < 50;

            // Value keeping high dice more in early game
            if (pocket.includes('Keep') && isEarlyGame) {
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

        // Analyze opponent's tendencies
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

        // Endgame strategy — when either player is close to 100
        const isLateGame = gameState.redScore >= 80 || gameState.blueScore >= 80;
        if (isLateGame) {
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

    // Public interface for the game engine
    selectDie() {
        if (this.difficulty === 'easy') {
            // Random selection for easy AI
            return Math.floor(Math.random() * gameState.redDice.length);
        } else {
            // Strategic selection for medium/hard AI
            const diceWithIndex = gameState.redDice.map((value, index) => ({ value, index }));
            
            if (this.difficulty === 'medium') {
                // Prefer higher dice but with some randomness
                diceWithIndex.sort((a, b) => b.value - a.value);
                const useTopHalf = Math.random() < 0.7;
                const halfSize = Math.ceil(diceWithIndex.length / 2);
                const selection = useTopHalf ? diceWithIndex.slice(0, halfSize) : diceWithIndex.slice(halfSize);
                return selection[Math.floor(Math.random() * selection.length)].index;
            } else {
                // Hard AI uses optimal selection
                return this.selectOptimalDie();
            }
        }
    }

    selectOptimalDie() {
        const bluePockets = getDiceFromPockets('blue');
        const diceWithIndex = gameState.redDice.map((value, index) => ({ value, index }));
        const emptyPockets = this.getEmptyPockets();
        
        // If we can win share battle, prioritize that die
        if (emptyPockets.includes('Share') && bluePockets.share) {
            const blueShareValue = bluePockets.share[0];
            const beatingDice = diceWithIndex.filter(d => d.value > blueShareValue);
            if (beatingDice.length > 0) {
                return beatingDice.reduce((best, current) => 
                    current.value > best.value ? current : best
                ).index;
            }
        }
        
        // If keep pockets available, use highest dice
        if (emptyPockets.some(p => p.includes('Keep'))) {
            diceWithIndex.sort((a, b) => b.value - a.value);
            return diceWithIndex[0].index;
        }
        
        // Default to highest available die
        diceWithIndex.sort((a, b) => b.value - a.value);
        return diceWithIndex[0].index;
    }

    choosePocket(dieValue) {
        const emptyPockets = this.getEmptyPockets();
        if (emptyPockets.length === 0) return null;

        if (this.difficulty === 'easy') {
            // Random choice for easy AI
            return emptyPockets[Math.floor(Math.random() * emptyPockets.length)];
        } else {
            // Strategic choice using move evaluation
            const move = this.calculateBestMove(gameState);
            return move ? move.pocket : emptyPockets[0];
        }
    }

    getStatusMessage() {
        const messages = {
            easy: ["Thinking...", "Hmm...", "Let me see..."],
            medium: ["Calculating...", "Analyzing options...", "Planning strategy..."],
            hard: ["Deep analysis...", "Considering all possibilities...", "Optimizing placement..."]
        };
        
        const options = messages[this.difficulty] || messages.medium;
        return options[Math.floor(Math.random() * options.length)];
    }
}

// Create global AI instance
let pocketsAI = new PocketsAI('medium');

// AI interface functions for the game engine
async function makeAIMove() {
    if (gameMode !== 'ai' || gameState.currentPlayer !== 'red' || aiThinking) {
        return;
    }
    // Don't interfere during Finale — Finale has its own roll flow
    if (gameState.finaleMode) { return; }

    aiThinking = true;
    updateGameStatus();

    try {
        const move = await pocketsAI.makeMove(gameState);

        if (move && move.dieIndex !== null && move.pocket) {
            // Capture value at selection time — required by placeDieInPocket
            const capturedValue = gameState.redDice[move.dieIndex];
            gameState.selectedDie = { player: 'red', index: move.dieIndex, value: capturedValue };
            const pocketElement = document.getElementById(`red${move.pocket}`);
            if (pocketElement) {
                placeDieInPocket(pocketElement);
            }
        }
    } catch (error) {
        console.error('AI move failed:', error);
        // Fallback to simple random move
        const dieIndex = Math.floor(Math.random() * gameState.redDice.length);
        const capturedValue = gameState.redDice[dieIndex];
        const emptyPockets = pocketsAI.getEmptyPockets();
        if (emptyPockets.length > 0) {
            gameState.selectedDie = { player: 'red', index: dieIndex, value: capturedValue };
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

// Export for use in other modules
window.PocketsAI = {
    PocketsAI,
    makeAIMove,
    updateAIDifficulty
};