// POCKETS STATS MODULE — v2.0
// Three separate profiles: Blue player, Red player, AI record
// Blue and Red each have own stats, achievements, clear button
// AI tab is permanent — no clear button

class PocketsStats {
    constructor() {
        this.storageKey = 'pockets-stats-v2';
        this.data = this.loadData();
    }

    loadData() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                return {
                    blue: parsed.blue || this.newProfile(),
                    red:  parsed.red  || this.newProfile(),
                    ai:   parsed.ai   || this.newAIRecord(),
                    version: '2.0.0'
                };
            }
        } catch (e) { console.warn('Stats load failed:', e); }
        return { blue: this.newProfile(), red: this.newProfile(), ai: this.newAIRecord(), version: '2.0.0' };
    }

    saveData() {
        try { localStorage.setItem(this.storageKey, JSON.stringify(this.data)); return true; }
        catch (e) { console.error('Stats save failed:', e); return false; }
    }

    newProfile() {
        return {
            gameHistory: [],
            achievements: [],
            stats: {
                totalGames: 0, gamesWon: 0, gamesLost: 0, gamesTied: 0,
                totalScore: 0, bestScore: 0, averageScore: 0,
                bestWinStreak: 0, currentWinStreak: 0,
                perfectGames: 0, comebackWins: 0,
                vsAIWon: { easy:0, medium:0, hard:0 },
                vsAILost: { easy:0, medium:0, hard:0 }
            }
        };
    }

    newAIRecord() {
        return {
            totalGames: 0,
            byDifficulty: {
                easy:   { wins: 0, losses: 0 },
                medium: { wins: 0, losses: 0 },
                hard:   { wins: 0, losses: 0 }
            }
        };
    }

    saveGameResult(gameResult) {
        const hc     = gameResult.humanColor || 'blue';    // human's color
        const oc     = (hc === 'blue') ? 'red' : 'blue';  // opponent's color
        const hScore = (hc === 'blue') ? gameResult.blueScore : gameResult.redScore;
        const oScore = (hc === 'blue') ? gameResult.redScore  : gameResult.blueScore;
        const hWon   = gameResult.winner === 'Blue'; // human is ALWAYS Blue internally
        const oWon   = gameResult.winner === 'Red';  // opponent always Red internally
        const tied   = gameResult.winner === 'Tie' || gameResult.winner === 'tie';

        // Save to human's profile
        this.recordGame(this.data[hc], gameResult, hScore, oScore, hWon, tied, gameResult.gameMode, gameResult.aiDifficulty);

        // In 2-player, save to opponent's profile too (their perspective)
        if (gameResult.gameMode === '2player') {
            this.recordGame(this.data[oc], gameResult, oScore, hScore, oWon, tied, '2player', null);
        }

        // AI record tab
        if (gameResult.gameMode === 'ai') {
            const diff = gameResult.aiDifficulty || 'easy';
            this.data.ai.totalGames++;
            if (hWon)       { this.data.ai.byDifficulty[diff].wins++;   }
            else if (!tied) { this.data.ai.byDifficulty[diff].losses++; }
        }

        this.saveData();
    }

    recordGame(profile, gameResult, myScore, theirScore, won, tied, mode, diff) {
        profile.gameHistory.push({
            winner:    gameResult.winner,
            myScore, theirScore, mode, diff,
            timestamp: Date.now()
        });
        if (profile.gameHistory.length > 100) {
            profile.gameHistory = profile.gameHistory.slice(-100);
        }

        const s = profile.stats;
        s.totalGames++;
        s.totalScore += myScore;
        if (myScore > s.bestScore)  { s.bestScore = myScore; }
        s.averageScore = Math.round(s.totalScore / s.totalGames);

        if (won) {
            s.gamesWon++;
            s.currentWinStreak++;
            if (s.currentWinStreak > s.bestWinStreak) { s.bestWinStreak = s.currentWinStreak; }
            if (myScore - theirScore >= 30) { s.perfectGames++; }
            if (mode === 'ai' && diff) { s.vsAIWon[diff] = (s.vsAIWon[diff] || 0) + 1; }
        } else if (tied) {
            s.gamesTied++;
            s.currentWinStreak = 0;
        } else {
            s.gamesLost++;
            s.currentWinStreak = 0;
            if (mode === 'ai' && diff) { s.vsAILost[diff] = (s.vsAILost[diff] || 0) + 1; }
        }

        this.checkAchievements(profile, { won, myScore, theirScore, mode, diff });
    }

    checkAchievements(profile, ctx) {
        const s    = profile.stats;
        const add  = (id, title, desc) => {
            if (!profile.achievements.find(a => a.id === id)) {
                profile.achievements.push({ id, title, description: desc, timestamp: Date.now() });
            }
        };
        if (s.totalGames === 1)              add('first-game',   '🎲 First Roll',    'Played your first game!');
        if (s.currentWinStreak === 3)        add('streak-3',     '🔥 Hot Streak',    'Won 3 games in a row!');
        if (s.currentWinStreak === 5)        add('streak-5',     '🌟 Unstoppable',   'Won 5 games in a row!');
        if (ctx.myScore >= 150)              add('score-150',    '💎 High Roller',   'Scored 150+ in a game!');
        if (ctx.myScore >= 200)              add('score-200',    '👑 Dice Master',   'Scored 200+ in a game!');
        if (s.perfectGames >= 1)             add('perfect',      '✨ Perfect Game',  'Won by 30+ points!');
        if (s.gamesWon >= 10)                add('wins-10',      '🏆 Veteran',       'Won 10 games!');
        if (ctx.mode === 'ai' && ctx.won &&
            ctx.diff === 'hard')             add('beat-hard-ai', '🤖 AI Slayer',     'Beat the Hard AI!');
    }

    clearProfile(color) {
        this.data[color] = this.newProfile();
        this.saveData();
    }
}

const pocketsStats = new PocketsStats();

// =============================================================================
// STATS PANEL UI
// =============================================================================

let currentStatsTab = 'blue';

function toggleStatsPanel() {
    const panel = document.getElementById('statsPanel');
    if (panel.classList.contains('hidden')) { showStatsPanel(); } else { hideStatsPanel(); }
}

function showStatsPanel() {
    const panel   = document.getElementById('statsPanel');
    const content = document.getElementById('statsContent');
    panel.classList.remove('hidden');
    content.innerHTML = generateStatsHTML(currentStatsTab);
    var btn = document.getElementById('viewStats');
    if (btn) { btn.textContent = 'Hide Stats'; }
}

function hideStatsPanel() {
    document.getElementById('statsPanel').classList.add('hidden');
    var btn = document.getElementById('viewStats');
    if (btn) { btn.textContent = 'View Stats'; }
}

function switchStatsTab(tab) {
    currentStatsTab = tab;
    const content = document.getElementById('statsContent');
    if (content) { content.innerHTML = generateStatsHTML(tab); }
}

function generateStatsHTML(tab) {
    tab = tab || 'blue';
    const tabs = `
        <div class="stats-tabs">
            <button class="stats-tab-btn ${tab==='blue'?'active':''}" onclick="switchStatsTab('blue')">🔵 Blue</button>
            <button class="stats-tab-btn ${tab==='red'?'active':''}"  onclick="switchStatsTab('red')">🔴 Red</button>
            <button class="stats-tab-btn ${tab==='ai'?'active':''}"   onclick="switchStatsTab('ai')">🤖 AI</button>
        </div>`;

    if (tab === 'ai') { return tabs + generateAITabHTML(); }
    return tabs + generatePlayerTabHTML(tab);
}

function generatePlayerTabHTML(color) {
    const profile = pocketsStats.data[color];
    const s       = profile.stats;
    const label   = color === 'blue' ? '🔵 Blue Player' : '🔴 Red Player';
    const winRate = s.totalGames > 0 ? Math.round((s.gamesWon / s.totalGames) * 100) : 0;
    const recentGames = profile.gameHistory.slice(-10);
    const recentWins  = recentGames.filter(g => g.won).length;
    const recentWR    = recentGames.length > 0 ? Math.round((recentWins / recentGames.length) * 100) : 0;
    const recentAvg   = recentGames.length > 0
        ? Math.round(recentGames.reduce((a,g) => a + g.myScore, 0) / recentGames.length) : 0;

    // VS AI stats
    const vsAI = s.vsAIWon && s.vsAILost ? `
        <div class="stat-card">
            <h4>🤖 vs AI Record</h4>
            ${['easy','medium','hard'].map(d => `
            <div class="stat-row">
                <span>${d.charAt(0).toUpperCase()+d.slice(1)}:</span>
                <span class="stat-value">${s.vsAIWon[d]||0}W-${s.vsAILost[d]||0}L</span>
            </div>`).join('')}
        </div>` : '';

    const dots = recentGames.map((g, idx) => {
        const emoji = g.won ? (color==='blue'?'🔵':'🔴') : (g.tied ? '🟨' : (color==='blue'?'🔴':'🔵'));
        const br = (idx > 0 && idx % 5 === 0) ? '<br>' : '';
        return br + `<span class="game-result" title="${g.myScore}-${g.theirScore}">${emoji}</span>`;
    }).join('');

    const achievements = profile.achievements.slice(-4);
    const achHTML = achievements.length === 0
        ? '<div class="no-achievements">No achievements yet — keep playing!</div>'
        : achievements.map(a => `<div class="achievement-item"><strong>${a.title}</strong><div class="achievement-description">${a.description}</div></div>`).join('');

    const allAchHTML = profile.achievements.length === 0
        ? '<div class="no-achievements">No achievements yet</div>'
        : profile.achievements.slice().reverse().map(a =>
            `<div class="achievement-item"><strong>${a.title}</strong><div class="achievement-description">${a.description}</div></div>`
          ).join('');

    return `
        <div class="stats-grid">
            <div class="stat-card">
                <h4>🏆 ${label}</h4>
                <div class="stat-row"><span>Games Played:</span><span class="stat-value">${s.totalGames}</span></div>
                <div class="stat-row"><span>Win Rate:</span><span class="stat-value">${winRate}%</span></div>
                <div class="stat-row"><span>Average Score:</span><span class="stat-value">${s.averageScore}</span></div>
                <div class="stat-row"><span>Best Score:</span><span class="stat-value">${s.bestScore}</span></div>
                <div class="stat-row"><span>Current Streak:</span><span class="stat-value">${s.currentWinStreak}</span></div>
                <div class="stat-row"><span>Best Streak:</span><span class="stat-value">${s.bestWinStreak}</span></div>
            </div>
            ${vsAI}
            <div class="stat-card">
                <h4>🏅 Special Stats</h4>
                <div class="stat-row"><span>Achievements:</span><span class="stat-value">${profile.achievements.length}</span></div>
                <div class="stat-row"><span>Perfect Games:</span><span class="stat-value">${s.perfectGames}</span></div>
                <div class="stat-row"><span>Comeback Wins:</span><span class="stat-value">${s.comebackWins||0}</span></div>
            </div>
            <div class="stat-card">
                <h4>📈 Recent Form (Last 10)</h4>
                <div class="stat-row"><span>Win Rate:</span><span class="stat-value">${recentWR}%</span></div>
                <div class="stat-row"><span>Avg Score:</span><span class="stat-value">${recentAvg}</span></div>
                <div class="recent-games">${dots || '<div class="no-games">No recent games</div>'}</div>
            </div>
        </div>
        <div class="achievements-section">
            <h4>🏆 Achievements</h4>
            <div class="achievements-list">${allAchHTML}</div>
        </div>
        <div class="stats-footer">
            <button class="btn stats-clear-btn" onclick="clearPlayerStats('${color}')">
                Clear ${color.charAt(0).toUpperCase()+color.slice(1)} Stats
            </button>
        </div>`;
}

function generateAITabHTML() {
    const ai   = pocketsStats.data.ai;
    const byD  = ai.byDifficulty;
    const total = ai.totalGames;
    const aiWinRate = d => {
        const g = (byD[d].wins + byD[d].losses);
        return g > 0 ? Math.round((byD[d].losses / g) * 100) : 0; // AI wins = human losses
    };

    return `
        <div class="stats-grid">
            <div class="stat-card">
                <h4>🤖 AI Record</h4>
                <div class="stat-row"><span>Total Games:</span><span class="stat-value">${total}</span></div>
                <div class="stat-row"><span>Easy — AI wins:</span><span class="stat-value">${byD.easy.losses}W / Human ${byD.easy.wins}W</span></div>
                <div class="stat-row"><span>Medium — AI wins:</span><span class="stat-value">${byD.medium.losses}W / Human ${byD.medium.wins}W</span></div>
                <div class="stat-row"><span>Hard — AI wins:</span><span class="stat-value">${byD.hard.losses}W / Human ${byD.hard.wins}W</span></div>
            </div>
            <div class="stat-card">
                <h4>📊 Human Win Rate vs AI</h4>
                <div class="stat-row"><span>vs Easy:</span><span class="stat-value">${100-aiWinRate('easy')}%</span></div>
                <div class="stat-row"><span>vs Medium:</span><span class="stat-value">${100-aiWinRate('medium')}%</span></div>
                <div class="stat-row"><span>vs Hard:</span><span class="stat-value">${100-aiWinRate('hard')}%</span></div>
            </div>
        </div>
        <div class="stats-footer" style="opacity:0.5;font-size:0.85em;text-align:center;padding:8px;">
            AI record is permanent — no clear button
        </div>`;
}

function clearPlayerStats(color) {
    if (typeof showConfirm === 'function') {
        const label = color.charAt(0).toUpperCase() + color.slice(1);
        showConfirm(
            'Clear ' + label + ' Stats?',
            'This will permanently erase all ' + label + ' player statistics. Cannot be undone.',
            function() {
                pocketsStats.clearProfile(color);
                switchStatsTab(color);
            }
        );
    } else {
        if (confirm('Clear ' + color + ' stats? Cannot be undone.')) {
            pocketsStats.clearProfile(color);
            switchStatsTab(color);
        }
    }
}

// Called from game-engine.js endGame()
function saveGameStats(gameResult) {
    pocketsStats.saveGameResult(gameResult);
}

// Export for compatibility
window.PocketsStats = {
    pocketsStats,
    toggleStatsPanel,
    showStatsPanel,
    hideStatsPanel,
    saveGameStats,
    clearPlayerStats,
    switchStatsTab
};

// Wire up View Stats button directly for iOS Safari reliability
document.addEventListener('DOMContentLoaded', function() {
    const viewStatsBtn = document.getElementById('viewStats');
    if (viewStatsBtn) { viewStatsBtn.addEventListener('click', toggleStatsPanel); }
});
