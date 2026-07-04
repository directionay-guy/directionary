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
                easy:   { wins: 0, losses: 0, ties: 0 },
                medium: { wins: 0, losses: 0, ties: 0 },
                hard:   { wins: 0, losses: 0, ties: 0 }
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
            if (hWon)        { this.data.ai.byDifficulty[diff].wins++; }
            else if (tied)   { this.data.ai.byDifficulty[diff].ties = (this.data.ai.byDifficulty[diff].ties || 0) + 1; }
            else             { this.data.ai.byDifficulty[diff].losses++; }
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
            <button class="stats-tab-btn ${tab==='odds'?'active':''}" onclick="switchStatsTab('odds')">🎲 Odds</button>
        </div>`;

    if (tab === 'ai')   { return tabs + generateAITabHTML(); }
    if (tab === 'odds') { return tabs + generateOddsTabHTML(); }
    return tabs + generatePlayerTabHTML(tab);
}

function generatePlayerTabHTML(color) {
    const profile = pocketsStats.data[color];
    const s       = profile.stats;
    const label   = color === 'blue' ? '🔵 Blue Player' : '🔴 Red Player';
    const winRate = s.totalGames > 0
        ? Math.round((s.gamesWon / s.totalGames) * 100)
        : 0;
    const decidedGames = s.totalGames - (s.gamesTied || 0);
    const winRateExTies = decidedGames > 0
        ? Math.round((s.gamesWon / decidedGames) * 100)
        : 0;
    const showTieRate = (s.gamesTied || 0) > 0;

    // VS AI stats
    const vsAI = s.vsAIWon && s.vsAILost ? `
        <div class="stat-card">
            <h4>🤖 vs AI Record</h4>
            ${['easy','medium','hard'].map(d => {
                const byD = pocketsStats.data.ai.byDifficulty[d];
                const t = byD ? (byD.ties || 0) : 0;
                const tieStr = t > 0 ? `-${t}T` : '';
                return `
            <div class="stat-row">
                <span>${d.charAt(0).toUpperCase()+d.slice(1)}:</span>
                <span class="stat-value">${s.vsAIWon[d]||0}W-${s.vsAILost[d]||0}L${tieStr}</span>
            </div>`;
            }).join('')}
        </div>` : '';

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
                <div class="stat-row"><span>Games Won:</span><span class="stat-value">${s.gamesWon}</span></div>
                ${showTieRate ? `<div class="stat-row"><span>Games Tied:</span><span class="stat-value">${s.gamesTied}</span></div>` : ''}
                <div class="stat-row"><span>Win Rate${showTieRate ? ' (excl. ties)' : ''}:</span><span class="stat-value">${showTieRate ? winRateExTies : winRate}%</span></div>
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

function generateOddsTabHTML() {
    return `
    <div class="stat-card" style="text-align:center;padding-bottom:6px;">
        <h4 style="margin-bottom:4px;">🎲 The Honest Dice Disclaimer</h4>
        <p style="font-size:0.88em;opacity:0.85;margin:0;">Every die in POCKETS is programmed to produce a truly random number from 1 to 6. No weighting, no favoritism, no conspiracy. The 1s are just as likely as the 6s. We checked. Repeatedly. While losing.</p>
    </div>

    <div class="stat-card">
        <h4>🎯 Single Round Odds (4 dice)</h4>
        <div class="stat-row"><span>Rolling a specific number on one die:</span><span class="stat-value">1 in 6</span></div>
        <div class="stat-row"><span>One pair (any):</span><span class="stat-value">~1 in 1.3</span></div>
        <div class="stat-row"><span>Two pair:</span><span class="stat-value">~1 in 8</span></div>
        <div class="stat-row"><span>3 of a kind:</span><span class="stat-value">~1 in 10</span></div>
        <div class="stat-row"><span>A straight (e.g. 2-3-4-5):</span><span class="stat-value">~1 in 18</span></div>
        <div class="stat-row"><span>4 of a kind:</span><span class="stat-value">1 in 216</span></div>
        <div class="stat-row"><span>All four dice showing 6:</span><span class="stat-value">1 in 1,296</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;"><span colspan="2">That's about once every 18 hours of continuous play. Keep rolling.</span></div>
    </div>

    <div class="stat-card">
        <h4>🌌 Rolldown Round Odds (5 dice)</h4>
        <div class="stat-row"><span>Any 5 of a kind (the holy grail):</span><span class="stat-value">1 in 1,296</span></div>
        <div class="stat-row"><span>Five 6s specifically:</span><span class="stat-value">1 in 7,776</span></div>
        <div class="stat-row"><span>4 of a kind:</span><span class="stat-value">~1 in 45</span></div>
        <div class="stat-row"><span>Full house:</span><span class="stat-value">~1 in 26</span></div>
        <div class="stat-row"><span>A straight (5 dice, any run of 5):</span><span class="stat-value">~1 in 13</span></div>
        <div class="stat-row"><span>Max possible score (five 6s + bonus):</span><span class="stat-value">40 pts</span></div>
        <div class="stat-row"><span>Min possible score (five 1s, no combo):</span><span class="stat-value">5 pts</span></div>
    </div>

    <div class="stat-card">
        <h4>🤯 Cosmic Rarity Events</h4>
        <div class="stat-row"><span>Both players roll all 6s simultaneously:</span><span class="stat-value">1 in 1,679,616</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;padding-bottom:6px;"><span>About as likely as flipping heads 20 times in a row.</span></div>
        <div class="stat-row"><span>Both players roll identical 4-die combinations:</span><span class="stat-value">1 in 1,296</span></div>
        <div class="stat-row"><span>Winning Take with a 1 (opponent rolls 1 too):</span><span class="stat-value">1 in 6</span></div>
        <div class="stat-row"><span>Saving a 6, then rolling another 6 next round:</span><span class="stat-value">1 in 6</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;padding-bottom:6px;"><span>Feels rarer. It isn't. Save more 6s.</span></div>
        <div class="stat-row"><span>Rolling four 1s (the nightmare):</span><span class="stat-value">1 in 1,296</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;"><span>Same odds as rolling four 6s. The dice are indifferent to your feelings.</span></div>
    </div>

    <div class="stat-card">
        <h4>📊 Take Battle Odds</h4>
        <div class="stat-row"><span>Winning Take if you both roll randomly:</span><span class="stat-value">~42%</span></div>
        <div class="stat-row"><span>Tying Take (zero points for both):</span><span class="stat-value">~17%</span></div>
        <div class="stat-row"><span>Losing Take:</span><span class="stat-value">~42%</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;padding-bottom:6px;"><span>The randomness is symmetric. The decisions aren't.</span></div>
        <div class="stat-row"><span>Winning Take by 5+ pips:</span><span class="stat-value">~14%</span></div>
        <div class="stat-row"><span>Winning Take by exactly 1 pip:</span><span class="stat-value">~14%</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;"><span>A win is a win, but a 5-pip win with a straight bonus (+5) scores very differently than a 1-pip win with no combo.</span></div>
    </div>

    <div class="stat-card">
        <h4>💾 The Save Pocket — By The Numbers</h4>
        <p style="font-size:0.82em;opacity:0.75;margin-bottom:8px;">You saved a die. Next round you roll 3 new ones. Here's what the math says about improving it:</p>
        <div class="stat-row" style="font-size:0.8em;opacity:0.6;"><span><strong>Saved die</strong></span><span><strong>Chance a new die beats it</strong></span></div>
        <div class="stat-row"><span>Saved a 1</span><span class="stat-value">99.5%</span></div>
        <div class="stat-row"><span>Saved a 2</span><span class="stat-value">96.3%</span></div>
        <div class="stat-row"><span>Saved a 3</span><span class="stat-value">87.5%</span></div>
        <div class="stat-row"><span>Saved a 4</span><span class="stat-value">70.4%</span></div>
        <div class="stat-row"><span>Saved a 5</span><span class="stat-value">42.1%</span></div>
        <div class="stat-row"><span>Saved a 6</span><span class="stat-value">0%</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;padding-bottom:6px;"><span>A saved 5 has less than even odds of being beaten by any of your 3 new dice. Save 5s and 6s confidently.</span></div>
        <div class="stat-row" style="font-size:0.8em;opacity:0.6;"><span><strong>Saved a 6? Chance all 3 new dice miss it:</strong></span><span><strong>57.9%</strong></span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;"><span>More than half the time, your saved 6 is the best die in your hand next round before the roll is even finished.</span></div>
    </div>

    <div class="stat-card">
        <h4>🏅 What Your Best New Die Will Be</h4>
        <p style="font-size:0.82em;opacity:0.75;margin-bottom:8px;">Rolling 3 dice — what's the highest one likely to be?</p>
        <div class="stat-row"><span>Best die is a 6:</span><span class="stat-value">42.1%</span></div>
        <div class="stat-row"><span>Best die is a 5:</span><span class="stat-value">28.2%</span></div>
        <div class="stat-row"><span>Best die is a 4:</span><span class="stat-value">17.1%</span></div>
        <div class="stat-row"><span>Best die is a 3:</span><span class="stat-value">8.8%</span></div>
        <div class="stat-row"><span>Best die is a 2:</span><span class="stat-value">3.2%</span></div>
        <div class="stat-row"><span>Best die is a 1 (ouch):</span><span class="stat-value">0.5%</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;padding-bottom:6px;"><span>Average best die across 3 rolls: <strong>4.96</strong> — nearly a 5 every round.</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;"><span>Your worst die averages <strong>2.04</strong>. The spread between best and worst is about <strong>2.9 pips</strong> per round. Plan accordingly.</span></div>
    </div>

    <div class="stat-card" style="text-align:center;">
        <h4>🏆 The One True Fact</h4>
        <p style="font-size:0.88em;opacity:0.85;margin:0 0 6px;">"The roll is random. The choices aren't."</p>
        <p style="font-size:0.8em;opacity:0.6;margin:0;">Every statistic above describes what the dice do on their own. POCKETS is about what you do after that.</p>
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

// View Stats button is wired in game-engine.js which loads after this file
