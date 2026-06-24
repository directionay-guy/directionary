// POCKETS SCORING MODULE - Math and Bonus Calculations
// Protected scoring logic to make casual theft slightly more difficult

function calculateBonusPoints(dice) {
    if (!dice || dice.length === 0) return 0;
    
    const counts = {};
    dice.forEach(die => {
        counts[die] = (counts[die] || 0) + 1;
    });

    const countValues = Object.values(counts).sort((a, b) => b - a);
    
    // Scoring table for combinations
    if (countValues[0] === 5) return 10; // 5 of a kind
    if (countValues[0] === 4) return 6;  // 4 of a kind
    if (countValues[0] === 3 && countValues[1] === 2) return 4; // Full house

    // Straight — ALL dice must be unique and consecutive (no gaps, no leftovers)
    // Regular rounds: all 4 dice sequential (e.g. 2-3-4-5)
    // Finale: all 5 dice sequential (e.g. 1-2-3-4-5 or 2-3-4-5-6)
    const sortedUnique = [...new Set(dice)].sort((a, b) => a - b);
    const isStraight = sortedUnique.length >= 4 &&
        sortedUnique.length === dice.length &&
        sortedUnique[sortedUnique.length - 1] - sortedUnique[0] === sortedUnique.length - 1;
    if (isStraight) return 5; // Straight

    if (countValues[0] === 3) return 3;  // 3 of a kind
    if (countValues[0] === 2 && countValues[1] === 2) return 2; // Two pair
    if (countValues[0] === 2) return 1;  // One pair
    
    return 0; // No combination
}

function getBonusDescription(dice) {
    if (!dice || dice.length === 0) return "No bonus";
    
    const counts = {};
    dice.forEach(die => {
        counts[die] = (counts[die] || 0) + 1;
    });

    const countValues = Object.values(counts).sort((a, b) => b - a);
    const uniqueValues = Object.keys(counts).map(Number).sort((a, b) => counts[b] - counts[a]);
    
    if (countValues[0] === 5) return `5 of a kind (${uniqueValues[0]}s) - 10 pts`;
    if (countValues[0] === 4) return `4 of a kind (${uniqueValues[0]}s) - 6 pts`;
    if (countValues[0] === 3 && countValues[1] === 2) {
        return `Full house (${uniqueValues[0]}s over ${uniqueValues[1]}s) - 4 pts`;
    }

    // Straight check
    const sortedUniqueD = [...new Set(dice)].sort((a, b) => a - b);
    if (sortedUniqueD.length >= 4 &&
        sortedUniqueD.length === dice.length &&
        sortedUniqueD[sortedUniqueD.length - 1] - sortedUniqueD[0] === sortedUniqueD.length - 1) {
        const low = sortedUniqueD[0], high = sortedUniqueD[sortedUniqueD.length - 1];
        return `Straight (${low}-${high}) - 5 pts`;
    }

    if (countValues[0] === 3) return `3 of a kind (${uniqueValues[0]}s) - 3 pts`;
    if (countValues[0] === 2 && countValues[1] === 2) {
        return `Two pair (${uniqueValues[0]}s and ${uniqueValues[1]}s) - 2 pts`;
    }
    if (countValues[0] === 2) return `Pair of ${uniqueValues[0]}s - 1 pt`;
    
    return "No combination - 0 pts";
}

function calculateKeepScore(keep1Dice, keep2Dice) {
    const keep1Total = (keep1Dice || []).reduce((sum, die) => sum + die, 0);
    const keep2Total = (keep2Dice || []).reduce((sum, die) => sum + die, 0);
    return keep1Total + keep2Total;
}

function calculateTakeBonus(blueTakeDie, redTakeDie, originalRoll, isBluePlayer) {
    if (!blueTakeDie || !redTakeDie) return 0;
    
    let bonus = 0;
    
    if (isBluePlayer && blueTakeDie > redTakeDie) {
        bonus = blueTakeDie - redTakeDie;
        bonus += calculateBonusPoints(originalRoll);
    } else if (!isBluePlayer && redTakeDie > blueTakeDie) {
        bonus = redTakeDie - blueTakeDie;
        bonus += calculateBonusPoints(originalRoll);
    }
    
    return bonus;
}

function calculateRoundTotal(keepScore, takeBonus) {
    return keepScore + takeBonus;
}

function calculateFinalRoundScore(allDice) {
    const diceTotal = allDice.reduce((sum, die) => sum + die, 0);
    const comboBonus = calculateBonusPoints(allDice);
    return {
        diceTotal,
        comboBonus,
        total: diceTotal + comboBonus
    };
}

function getScoreBreakdown(pockets, originalRoll, opponentTakeDie) {
    const keepScore = calculateKeepScore(pockets.keep1, pockets.keep2);
    const takeBonus = calculateTakeBonus(
        pockets.take?.[0], 
        opponentTakeDie, 
        originalRoll, 
        true
    );
    
    return {
        keep: keepScore,
        takeBonus,
        total: keepScore + takeBonus,
        comboDescription: takeBonus > 0 ? getBonusDescription(originalRoll) : "No take bonus"
    };
}

// Emoji generation for sharing (like Wordle)
function generateGameEmoji(gameResults) {
    const { rounds, finalScore, winner } = gameResults;
    let emoji = "🎲 POCKETS GAME 🎲\n\n";
    
    rounds.forEach((round, index) => {
        const roundNum = (index + 1).toString().padStart(2, '0');
        const blueWon = round.blueScore > round.redScore;
        const tied = round.blueScore === round.redScore;
        
        if (tied) {
            emoji += `${roundNum}: 🟨`;
        } else if (blueWon) {
            emoji += `${roundNum}: 🔵`;
        } else {
            emoji += `${roundNum}: 🔴`;
        }
        
        if ((index + 1) % 5 === 0) emoji += "\n";
    });
    
    emoji += `\n\nFinal: ${finalScore.blue}-${finalScore.red}`;
    emoji += winner === 'Blue' ? " 🔵🏆" : winner === 'Red' ? " 🔴🏆" : " 🤝";
    emoji += "\n\nPlay at [your-website-here]";
    
    return emoji;
}

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            document.body.removeChild(textArea);
            return Promise.resolve();
        } catch (err) {
            document.body.removeChild(textArea);
            return Promise.reject(err);
        }
    }
}

// Validation functions
function validateDiceRoll(dice) {
    if (!Array.isArray(dice)) return false;
    return dice.every(die => Number.isInteger(die) && die >= 1 && die <= 6);
}

function validatePocketPlacement(pockets) {
    const requiredPockets = ['keep1', 'keep2', 'take', 'save'];
    return requiredPockets.every(pocket => {
        if (!pockets[pocket]) return true; // Empty pocket is valid
        return validateDiceRoll(pockets[pocket]);
    });
}

function validateGameState(state) {
    const requiredFields = ['round', 'blueScore', 'redScore', 'phase'];
    return requiredFields.every(field => state.hasOwnProperty(field));
}

// Statistical analysis functions
function analyzePlayerPerformance(gameHistory) {
    if (!gameHistory || gameHistory.length === 0) {
        return {
            totalGames: 0,
            wins: 0,
            losses: 0,
            ties: 0,
            averageScore: 0,
            bestScore: 0,
            winRate: 0
        };
    }
    
    const stats = {
        totalGames: gameHistory.length,
        wins: 0,
        losses: 0,
        ties: 0,
        totalScore: 0,
        bestScore: 0,
        averageScore: 0,
        winRate: 0
    };
    
    gameHistory.forEach(game => {
        if (game.winner === 'Blue') stats.wins++;
        else if (game.winner === 'Red') stats.losses++;
        else stats.ties++;
        
        stats.totalScore += game.blueScore;
        if (game.blueScore > stats.bestScore) {
            stats.bestScore = game.blueScore;
        }
    });
    
    stats.averageScore = Math.round(stats.totalScore / stats.totalGames);
    stats.winRate = Math.round((stats.wins / stats.totalGames) * 100);
    
    return stats;
}

function getPerformanceTrend(recentGames, lookback = 5) {
    if (!recentGames || recentGames.length < lookback) return "Insufficient data";
    
    const recent = recentGames.slice(-lookback);
    const wins = recent.filter(game => game.winner === 'Blue').length;
    const winRate = (wins / lookback) * 100;
    
    if (winRate >= 80) return "🔥 On fire!";
    if (winRate >= 60) return "📈 Strong performance";
    if (winRate >= 40) return "⚖️ Balanced play";
    if (winRate >= 20) return "📉 Struggling";
    return "💭 Needs practice";
}

function calculateOptimalStrategy(diceRoll, gameState) {
    // Advanced AI helper function for strategy recommendations
    const dice = [...diceRoll].sort((a, b) => b - a);
    const suggestions = [];
    
    // Analyze dice for best keep combinations
    const highDice = dice.filter(d => d >= 4);
    const lowDice = dice.filter(d => d <= 3);
    
    if (highDice.length >= 2) {
        suggestions.push({
            action: "Keep high dice",
            reason: `Place ${highDice[0]} and ${highDice[1]} in Keep pockets for guaranteed points`,
            priority: "high"
        });
    }
    
    // Check for combinations
    const bonus = calculateBonusPoints(dice);
    if (bonus > 0) {
        suggestions.push({
            action: "Take for combo bonus",
            reason: `${getBonusDescription(dice)} - use highest die in Take pocket`,
            priority: "medium"
        });
    }
    
    // Save strategy
    if (gameState.round <= 10) {
        const bestSave = Math.max(...dice);
        if (bestSave >= 5) {
            suggestions.push({
                action: "Save high die",
                reason: `Save ${bestSave} for final rounds`,
                priority: "medium"
            });
        }
    }
    
    return suggestions;
}

// Advanced scoring predictions
function predictRoundOutcome(blueDice, redDice, blueStrategy, redStrategy) {
    const scenarios = [];
    
    // Simulate different placement strategies
    const blueOptions = generatePlacementOptions(blueDice);
    const redOptions = generatePlacementOptions(redDice);
    
    blueOptions.forEach(bluePlace => {
        redOptions.forEach(redPlace => {
            const blueScore = calculateScenarioScore(bluePlace, redPlace.take?.[0] || 0, blueDice);
            const redScore = calculateScenarioScore(redPlace, bluePlace.take?.[0] || 0, redDice);
            
            scenarios.push({
                blueScore,
                redScore,
                bluePlacement: bluePlace,
                redPlacement: redPlace,
                advantage: blueScore - redScore
            });
        });
    });
    
    // Return best and worst case scenarios
    scenarios.sort((a, b) => b.advantage - a.advantage);
    
    return {
        bestCase: scenarios[0],
        worstCase: scenarios[scenarios.length - 1],
        averageAdvantage: scenarios.reduce((sum, s) => sum + s.advantage, 0) / scenarios.length
    };
}

function generatePlacementOptions(dice) {
    const options = [];
    
    // Generate all valid combinations of dice placement
    for (let i = 0; i < dice.length; i++) {
        for (let j = i + 1; j < dice.length; j++) {
            for (let k = 0; k < dice.length; k++) {
                if (k === i || k === j) continue;
                for (let l = 0; l < dice.length; l++) {
                    if (l === i || l === j || l === k) continue;
                    
                    options.push({
                        keep1: [dice[i]],
                        keep2: [dice[j]],
                        take: [dice[k]],
                        save: [dice[l]]
                    });
                }
            }
        }
    }
    
    return options;
}

function calculateScenarioScore(placement, opponentTake, originalDice) {
    const keepScore = calculateKeepScore(placement.keep1, placement.keep2);
    const takeBonus = calculateTakeBonus(
        placement.take?.[0],
        opponentTake,
        originalDice,
        true
    );
    return keepScore + takeBonus;
}

// Export functions for use in other modules
window.PocketsScoring = {
    calculateBonusPoints,
    getBonusDescription,
    calculateKeepScore,
    calculateTakeBonus,
    calculateRoundTotal,
    calculateFinalRoundScore,
    getScoreBreakdown,
    generateGameEmoji,
    copyToClipboard,
    validateDiceRoll,
    validatePocketPlacement,
    validateGameState,
    analyzePlayerPerformance,
    getPerformanceTrend,
    calculateOptimalStrategy,
    predictRoundOutcome
};
