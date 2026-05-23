// POCKETS STATS & PERSISTENCE MODULE
// Player statistics, preferences, and data management

class PocketsStats {
    constructor() {
        this.storageKey = 'pockets-game-data';
        this.data = this.loadData();
    }

    loadData() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                return {
                    preferences: parsed.preferences || this.getDefaultPreferences(),
                    gameHistory: parsed.gameHistory || [],
                    achievements: parsed.achievements || [],
                    stats: parsed.stats || this.getDefaultStats(),
                    version: parsed.version || '1.0.0'
                };
            }
        } catch (error) {
            console.warn('Failed to load saved data:', error);
        }
        
        return {
            preferences: this.getDefaultPreferences(),
            gameHistory: [],
            achievements: [],
            stats: this.getDefaultStats(),
            version: '1.0.0'
        };
    }

    saveData() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.data));
            return true;
        } catch (error) {
            console.error('Failed to save data:', error);
            return false;
        }
    }

    getDefaultPreferences() {
        return {
            theme: 'victorian',
            aiDifficulty: 'medium',
            soundEnabled: true,
            animationsEnabled: true,
            autoSaveStats: true,
            shareFormat: 'emoji'
        };
    }

    getDefaultStats() {
        return {
            totalGames: 0,
            gamesWon: 0,
            gamesLost: 0,
            gamesTied: 0,
            totalScore: 0,
            bestScore: 0,
            worstScore: Infinity,
            averageScore: 0,
            bestWinStreak: 0,
            currentWinStreak: 0,
            favoriteTheme: 'victorian',
            totalPlayTime: 0,
            roundsPlayed: 0,
            perfectGames: 0, // Games won by 30+ points
            comebackWins: 0, // Wins when behind by 15+ at round 10
            aiGamesWon: { easy: 0, medium: 0, hard: 0 },
            aiGamesLost: { easy: 0, medium: 0, hard: 0 }
        };
    }

    saveGameResult(gameResult) {
        // Add to game history
        this.data.gameHistory.push({
            ...gameResult,
            timestamp: Date.now(),
            id: this.generateGameId()
        });

        // Update statistics
        this.updateStats(gameResult);

        // Check for achievements
        this.checkAchievements(gameResult);

        // Keep only last 100 games to manage storage
        if (this.data.gameHistory.length > 100) {
            this.data.gameHistory = this.data.gameHistory.slice(-100);
        }

        this.saveData();
    }

    updateStats(gameResult) {
        const stats = this.data.stats;
        
        stats.totalGames++;
        stats.totalScore += gameResult.blueScore;
        stats.roundsPlayed += 13; // Always 13 rounds + final

        // Update best/worst scores
        if (gameResult.blueScore > stats.bestScore) {
            stats.bestScore = gameResult.blueScore;
        }
        if (gameResult.blueScore < stats.worstScore) {
            stats.worstScore = gameResult.blueScore;
        }

        // Update win/loss records
        if (gameResult.winner === 'Blue') {
            stats.gamesWon++;
            stats.currentWinStreak++;
            if (stats.currentWinStreak > stats.bestWinStreak) {
                stats.bestWinStreak = stats.currentWinStreak;
            }

            // Check for special wins
            if (gameResult.blueScore - gameResult.redScore >= 30) {
                stats.perfectGames++;
            }

            // AI difficulty tracking
            if (gameResult.gameMode === 'ai') {
                stats.aiGamesWon[gameResult.aiDifficulty]++;
            }
        } else if (gameResult.winner === 'Red') {
            stats.gamesLost++;
            stats.currentWinStreak = 0;

            if (gameResult.gameMode === 'ai') {
                stats.aiGamesLost[gameResult.aiDifficulty]++;
            }
        } else {
            stats.gamesTied++;
            stats.currentWinStreak = 0;
        }

        // Calculate average score
        stats.averageScore = Math.round(stats.totalScore / stats.totalGames);
    }

    checkAchievements(gameResult) {
        const achievements = [];

        // First game
        if (this.data.stats.totalGames === 1) {
            achievements.push({
                id: 'first-game',
                title: '🎲 First Roll',
                description: 'Played your first game of Pockets!',
                timestamp: Date.now()
            });
        }

        // Win streaks
        if (this.data.stats.currentWinStreak === 3) {
            achievements.push({
                id: 'win-streak-3',
                title: '🔥 Hot Streak',
                description: 'Won 3 games in a row!',
                timestamp: Date.now()
            });
        }

        if (this.data.stats.currentWinStreak === 5) {
            achievements.push({
                id: 'win-streak-5',
                title: '🌟 Unstoppable',
                description: 'Won 5 games in a row!',
                timestamp: Date.now()
            });
        }

        // High scores
        if (gameResult.blueScore >= 150) {
            achievements.push({
                id: 'high-score-150',
                title: '💎 High Roller',
                description: 'Scored 150+ points in a single game!',
                timestamp: Date.now()
            });
        }

        if (gameResult.blueScore >= 200) {
            achievements.push({
                id: 'high-score-200',
                title: '👑 Dice Master',
                description: 'Scored 200+ points in a single game!',
                timestamp: Date.now()
            });
        }

        // Perfect games
        if (gameResult.blueScore - gameResult.redScore >= 50) {
            achievements.push({
                id: 'domination',
                title: '⚡ Domination',
                description: 'Won by 50+ points!',
                timestamp: Date.now()
            });
        }

        // AI victories
        if (gameResult.gameMode === 'ai' && gameResult.winner === 'Blue') {
            if (gameResult.aiDifficulty === 'hard') {
                achievements.push({
                    id: 'beat-hard-ai',
                    title: '🤖 AI Crusher',
                    description: 'Defeated the Hard AI!',
                    timestamp: Date.now()
                });
            }
        }

        // Game milestones
        if (this.data.stats.totalGames === 10) {
            achievements.push({
                id: 'veteran',
                title: '🎖️ Veteran Player',
                description: 'Played 10 games!',
                timestamp: Date.now()
            });
        }

        if (this.data.stats.totalGames === 50) {
            achievements.push({
                id: 'dedicated',
                title: '🏆 Dedicated Player',
                description: 'Played 50 games!',
                timestamp: Date.now()
            });
        }

        // Add new achievements (avoid duplicates)
        achievements.forEach(achievement => {
            if (!this.data.achievements.find(a => a.id === achievement.id)) {
                this.data.achievements.push(achievement);
                this.showAchievementNotification(achievement);
            }
        });
    }

    showAchievementNotification(achievement) {
        // Create and show achievement popup
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-content">
                <h3>🏆 Achievement Unlocked!</h3>
                <div class="achievement-title">${achievement.title}</div>
                <div class="achievement-description">${achievement.description}</div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove after 4 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 4000);
    }

    generateGameId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    getPerformanceData() {
        const stats = this.data.stats;
        const recent = this.data.gameHistory.slice(-10);
        
        return {
            overall: {
                winRate: stats.totalGames > 0 ? Math.round((stats.gamesWon / stats.totalGames) * 100) : 0,
                averageScore: stats.averageScore,
                bestScore: stats.bestScore,
                gamesPlayed: stats.totalGames,
                currentStreak: stats.currentWinStreak,
                bestStreak: stats.bestWinStreak
            },
            recent: {
                games: recent,
                winRate: recent.length > 0 ? Math.round((recent.filter(g => g.winner === 'Blue').length / recent.length) * 100) : 0,
                averageScore: recent.length > 0 ? Math.round(recent.reduce((sum, g) => sum + g.blueScore, 0) / recent.length) : 0
            },
            ai: {
                easy: {
                    wins: stats.aiGamesWon.easy,
                    losses: stats.aiGamesLost.easy,
                    winRate: this.calculateAIWinRate('easy')
                },
                medium: {
                    wins: stats.aiGamesWon.medium,
                    losses: stats.aiGamesLost.medium,
                    winRate: this.calculateAIWinRate('medium')
                },
                hard: {
                    wins: stats.aiGamesWon.hard,
                    losses: stats.aiGamesLost.hard,
                    winRate: this.calculateAIWinRate('hard')
                }
            },
            achievements: this.data.achievements.length,
            specialStats: {
                perfectGames: stats.perfectGames,
                comebackWins: stats.comebackWins,
                roundsPlayed: stats.roundsPlayed
            }
        };
    }

    calculateAIWinRate(difficulty) {
        const wins = this.data.stats.aiGamesWon[difficulty];
        const losses = this.data.stats.aiGamesLost[difficulty];
        const total = wins + losses;
        return total > 0 ? Math.round((wins / total) * 100) : 0;
    }

    savePreference(key, value) {
        this.data.preferences[key] = value;
        this.saveData();
    }

    getPreference(key) {
        return this.data.preferences[key];
    }

    exportData() {
        const exportData = {
            ...this.data,
            exportDate: new Date().toISOString(),
            gameVersion: '1.0.0'
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `pockets-stats-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        return dataStr;
    }

    importData(jsonString) {
        try {
            const importedData = JSON.parse(jsonString);
            
            // Validate data structure
            if (this.validateImportData(importedData)) {
                // Merge with existing data (keeping newer records)
                this.mergeImportedData(importedData);
                this.saveData();
                return { success: true, message: 'Data imported successfully!' };
            } else {
                return { success: false, message: 'Invalid data format.' };
            }
        } catch (error) {
            return { success: false, message: 'Failed to parse data file.' };
        }
    }

    validateImportData(data) {
        return data.hasOwnProperty('gameHistory') && 
               data.hasOwnProperty('stats') && 
               data.hasOwnProperty('preferences') && 
               Array.isArray(data.gameHistory);
    }

    mergeImportedData(importedData) {
        // Merge game history (avoid duplicates by ID)
        const existingIds = new Set(this.data.gameHistory.map(g => g.id));
        const newGames = importedData.gameHistory.filter(g => !existingIds.has(g.id));
        this.data.gameHistory.push(...newGames);
        
        // Merge achievements (avoid duplicates by ID)
        const existingAchievements = new Set(this.data.achievements.map(a => a.id));
        const newAchievements = importedData.achievements.filter(a => !existingAchievements.has(a.id));
        this.data.achievements.push(...newAchievements);
        
        // Update stats with combined data
        this.recalculateStats();
        
        // Merge preferences (imported takes precedence)
        this.data.preferences = { ...this.data.preferences, ...importedData.preferences };
    }

    recalculateStats() {
        const stats = this.getDefaultStats();
        
        this.data.gameHistory.forEach(game => {
            this.updateStatsFromGame(stats, game);
        });
        
        this.data.stats = stats;
    }

    updateStatsFromGame(stats, game) {
        stats.totalGames++;
        stats.totalScore += game.blueScore;
        
        if (game.blueScore > stats.bestScore) stats.bestScore = game.blueScore;
        if (game.blueScore < stats.worstScore) stats.worstScore = game.blueScore;
        
        if (game.winner === 'Blue') {
            stats.gamesWon++;
            if (game.gameMode === 'ai') {
                stats.aiGamesWon[game.aiDifficulty]++;
            }
        } else if (game.winner === 'Red') {
            stats.gamesLost++;
            if (game.gameMode === 'ai') {
                stats.aiGamesLost[game.aiDifficulty]++;
            }
        } else {
            stats.gamesTied++;
        }
        
        stats.averageScore = Math.round(stats.totalScore / stats.totalGames);
    }

    clearAllData() {
        if (confirm('Are you sure you want to clear all your game data? This cannot be undone.')) {
            this.data = {
                preferences: this.getDefaultPreferences(),
                gameHistory: [],
                achievements: [],
                stats: this.getDefaultStats(),
                version: '1.0.0'
            };
            this.saveData();
            return true;
        }
        return false;
    }

    generateShareText(gameResult) {
        const format = this.getPreference('shareFormat') || 'emoji';
        
        if (format === 'emoji') {
            return this.generateEmojiShare(gameResult);
        } else {
            return this.generateTextShare(gameResult);
        }
    }

    generateEmojiShare(gameResult) {
        const rounds = gameResult.roundHistory || [];
        let emoji = "🎲 POCKETS DICE GAME 🎲\n\n";
        
        // Generate round results
        for (let i = 0; i < 13; i++) {
            const round = rounds[i];
            if (round) {
                if (round.blueScore > round.redScore) {
                    emoji += "🔵";
                } else if (round.redScore > round.blueScore) {
                    emoji += "🔴";
                } else {
                    emoji += "🟨";
                }
            } else {
                emoji += "⚫"; // Unplayed round
            }
            
            if ((i + 1) % 5 === 0) emoji += "\n";
        }
        
        emoji += `\nFinal: ${gameResult.blueScore}-${gameResult.redScore}`;
        
        if (gameResult.winner === 'Blue') {
            emoji += " 🔵🏆";
        } else if (gameResult.winner === 'Red') {
            emoji += " 🔴🏆";
        } else {
            emoji += " 🤝";
        }
        
        emoji += "\n\nPlay Pockets at [your-site.com]";
        
        return emoji;
    }

    generateTextShare(gameResult) {
        let text = `🎲 Just played Pockets!\n\n`;
        text += `Final Score: ${gameResult.blueScore} - ${gameResult.redScore}\n`;
        
        if (gameResult.winner === 'Blue') {
            text += `🏆 I won by ${gameResult.blueScore - gameResult.redScore} points!\n`;
        } else if (gameResult.winner === 'Red') {
            if (gameResult.gameMode === 'ai') {
                text += `🤖 AI won by ${gameResult.redScore - gameResult.blueScore} points\n`;
            } else {
                text += `Opponent won by ${gameResult.redScore - gameResult.blueScore} points\n`;
            }
        } else {
            text += `🤝 It was a tie!\n`;
        }
        
        text += `\nPlay Pockets at [your-site.com]`;
        
        return text;
    }
}

// Global stats instance
const pocketsStats = new PocketsStats();

// UI Functions for stats panel
function toggleStatsPanel() {
    const panel = document.getElementById('statsPanel');
    if (panel.classList.contains('hidden')) {
        showStatsPanel();
    } else {
        hideStatsPanel();
    }
}

function showStatsPanel() {
    const panel = document.getElementById('statsPanel');
    const content = document.getElementById('statsContent');
    
    panel.classList.remove('hidden');
    content.innerHTML = generateStatsHTML();
}

function hideStatsPanel() {
    const panel = document.getElementById('statsPanel');
    panel.classList.add('hidden');
}

function generateStatsHTML() {
    const data = pocketsStats.getPerformanceData();
    
    return `
        <div class="stats-grid">
            <div class="stat-card">
                <h4>🏆 Overall Performance</h4>
                <div class="stat-row">
                    <span>Games Played:</span>
                    <span class="stat-value">${data.overall.gamesPlayed}</span>
                </div>
                <div class="stat-row">
                    <span>Win Rate:</span>
                    <span class="stat-value">${data.overall.winRate}%</span>
                </div>
                <div class="stat-row">
                    <span>Average Score:</span>
                    <span class="stat-value">${data.overall.averageScore}</span>
                </div>
                <div class="stat-row">
                    <span>Best Score:</span>
                    <span class="stat-value">${data.overall.bestScore}</span>
                </div>
                <div class="stat-row">
                    <span>Current Streak:</span>
                    <span class="stat-value">${data.overall.currentStreak}</span>
                </div>
                <div class="stat-row">
                    <span>Best Streak:</span>
                    <span class="stat-value">${data.overall.bestStreak}</span>
                </div>
            </div>
            
            <div class="stat-card">
                <h4>🤖 AI Performance</h4>
                <div class="stat-row">
                    <span>Easy:</span>
                    <span class="stat-value">${data.ai.easy.wins}W-${data.ai.easy.losses}L (${data.ai.easy.winRate}%)</span>
                </div>
                <div class="stat-row">
                    <span>Medium:</span>
                    <span class="stat-value">${data.ai.medium.wins}W-${data.ai.medium.losses}L (${data.ai.medium.winRate}%)</span>
                </div>
                <div class="stat-row">
                    <span>Hard:</span>
                    <span class="stat-value">${data.ai.hard.wins}W-${data.ai.hard.losses}L (${data.ai.hard.winRate}%)</span>
                </div>
            </div>
            
            <div class="stat-card">
                <h4>🏅 Achievements</h4>
                <div class="stat-row">
                    <span>Unlocked:</span>
                    <span class="stat-value">${data.achievements}/20</span>
                </div>
                <div class="stat-row">
                    <span>Perfect Games:</span>
                    <span class="stat-value">${data.specialStats.perfectGames}</span>
                </div>
                <div class="stat-row">
                    <span>Comeback Wins:</span>
                    <span class="stat-value">${data.specialStats.comebackWins}</span>
                </div>
            </div>
            
            <div class="stat-card">
                <h4>📈 Recent Form (Last 10)</h4>
                <div class="stat-row">
                    <span>Win Rate:</span>
                    <span class="stat-value">${data.recent.winRate}%</span>
                </div>
                <div class="stat-row">
                    <span>Average Score:</span>
                    <span class="stat-value">${data.recent.averageScore}</span>
                </div>
                <div class="recent-games">
                    ${generateRecentGamesHTML(data.recent.games)}
                </div>
            </div>
        </div>
        
        <div class="achievements-section">
            <h4>🏆 Recent Achievements</h4>
            <div class="achievements-list">
                ${generateAchievementsHTML()}
            </div>
        </div>
    `;
}

function generateRecentGamesHTML(games) {
    if (games.length === 0) return '<div class="no-games">No recent games</div>';

    var dots = games.slice(-10).map(function(game, idx) {
        var result = game.winner === 'Blue' ? '🔵' : game.winner === 'Red' ? '🔴' : '🟨';
        var score  = game.blueScore + '-' + game.redScore;
        var br     = (idx > 0 && idx % 5 === 0) ? '<br>' : '';
        return br + '<span class="game-result" title="' + score + '">' + result + '</span>';
    });
    return dots.join('');
}

function generateAchievementsHTML() {
    const achievements = pocketsStats.data.achievements.slice(-5); // Show last 5
    
    if (achievements.length === 0) {
        return '<div class="no-achievements">No achievements yet - keep playing!</div>';
    }
    
    return achievements.map(achievement => `
        <div class="achievement-item">
            <div class="achievement-title">${achievement.title}</div>
            <div class="achievement-description">${achievement.description}</div>
        </div>
    `).join('');
}

function exportStats() {
    try {
        pocketsStats.exportData();
        showNotification('Stats exported successfully!', 'success');
    } catch (error) {
        showNotification('Failed to export stats', 'error');
    }
}

function clearStats() {
    if (pocketsStats.clearAllData()) {
        hideStatsPanel();
        showNotification('All stats cleared', 'info');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

function saveGameStats(gameResult) {
    pocketsStats.saveGameResult(gameResult);
}

// Event listeners for stats panel
document.addEventListener('DOMContentLoaded', () => {
    // Load saved preferences
    const savedTheme = pocketsStats.getPreference('theme');
    if (savedTheme && document.getElementById('themeSelector')) {
        document.getElementById('themeSelector').value = savedTheme;
    }
    
    const savedDifficulty = pocketsStats.getPreference('aiDifficulty');
    if (savedDifficulty) {
        aiDifficulty = savedDifficulty;
        if (typeof updateAIDifficulty === 'function') {
            updateAIDifficulty(savedDifficulty);
        }
    }
    
    // Wire View Stats button directly — belt and suspenders for iOS Safari
    const viewStatsBtn = document.getElementById('viewStats');
    if (viewStatsBtn) {
        viewStatsBtn.addEventListener('click', toggleStatsPanel);
    }

    // Set up export/clear buttons
    const exportBtn = document.getElementById('exportStats');
    const clearBtn  = document.getElementById('clearStats');
    
    if (exportBtn) exportBtn.addEventListener('click', exportStats);
    if (clearBtn) clearBtn.addEventListener('click', clearStats);
});

// Export for use in other modules
window.PocketsStats = {
    pocketsStats,
    toggleStatsPanel,
    showStatsPanel,
    hideStatsPanel,
    saveGameStats,
    exportStats,
    clearStats
};