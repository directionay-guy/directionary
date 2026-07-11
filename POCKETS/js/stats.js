// POCKETS STATS MODULE — v2.0
// Three separate profiles: Blue player, Red player, AI record
// Blue and Red each have own stats, achievements, clear button
// AI tab is permanent — no clear button

// =============================================================================
// ACHIEVEMENT CATALOG — single source of truth.
// Both the awarding logic (checkAchievements) and the gallery read from here,
// so adding a new achievement is a one-line entry plus (for profile-scoped
// ones) a single trigger line in checkAchievements.
//
//   scope: 'profile'  earned by Blue and/or Red individually (stored per color)
//   scope: 'global'   evaluated live across both colors + the AI record
//                     (has a check(data) function; never "stored")
// =============================================================================
const ACHIEVEMENTS = [
    { id:'first-game',   icon:'🎲', title:'First Roll',    desc:'Played your first game.',                         scope:'profile' },
    { id:'first-win',    icon:'🎯', title:'First Win',     desc:'Won your first game.',                            scope:'profile' },
    { id:'nail-biter',   icon:'😅', title:'Nail-Biter',    desc:'Won a game by exactly 1 point.',                  scope:'profile' },
    { id:'perfect',      icon:'✨', title:'Perfect Game',  desc:'Won by 30 or more points.',                       scope:'profile' },
    { id:'blowout',      icon:'💥', title:'Blowout',       desc:'Won by 50 or more points.',                       scope:'profile' },
    { id:'iron-defense', icon:'🛡️', title:'Iron Defense',  desc:'Won while holding the opponent under 50.',        scope:'profile' },
    { id:'streak-3',     icon:'🔥', title:'Hot Streak',    desc:'Won 3 games in a row.',                           scope:'profile' },
    { id:'streak-5',     icon:'🌟', title:'Unstoppable',   desc:'Won 5 games in a row.',                           scope:'profile' },
    { id:'streak-7',     icon:'🚀', title:'Juggernaut',    desc:'Won 7 games in a row.',                           scope:'profile' },
    { id:'score-150',    icon:'💎', title:'High Roller',   desc:'Scored 150+ in a single game.',                   scope:'profile' },
    { id:'score-200',    icon:'👑', title:'Dice Master',   desc:'Scored 200+ in a single game.',                   scope:'profile' },
    { id:'score-250',    icon:'🌋', title:'Legendary',     desc:'Scored 250+ in a single game.',                   scope:'profile' },
    { id:'wins-10',      icon:'🏆', title:'Veteran',       desc:'Won 10 games.',                                   scope:'profile' },
    { id:'games-25',     icon:'🎖️', title:'Marathoner',    desc:'Played 25 games.',                                scope:'profile' },
    { id:'games-100',    icon:'🏅', title:'Centurion',     desc:'Played 100 games.',                               scope:'profile' },
    { id:'beat-hard-ai', icon:'🤖', title:'AI Slayer',     desc:'Beat the Hard AI.',                               scope:'profile' },
    { id:'giant-slayer', icon:'⚔️', title:'Giant Slayer',  desc:'Beat the Hard AI by 30 or more.',                 scope:'profile' },
    { id:'ambidextrous', icon:'🎭', title:'Ambidextrous',  desc:'Won at least one game as Blue and one as Red.',   scope:'global',
      check: (d) => d.blue.stats.gamesWon > 0 && d.red.stats.gamesWon > 0 },
    { id:'clean-sweep',  icon:'🧹', title:'Clean Sweep',   desc:'Beat Easy, Medium, and Hard at least once each.', scope:'global',
      check: (d) => { const b = d.ai.byDifficulty; return b.easy.wins > 0 && b.medium.wins > 0 && b.hard.wins > 0; } }
];

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
        const mode = gameResult.gameMode;
        const tied = gameResult.winner === 'Tie' || gameResult.winner === 'tie';

        if (mode === 'ai') {
            // INTERNALLY the human is ALWAYS Blue and the AI ALWAYS Red.
            // "Play as Red" only swaps the visuals — it never swaps the internal
            // sides — so the human's real score and result ALWAYS come from the
            // BLUE side, no matter which colour they chose to look like.
            //
            // The old code derived these from humanColor, which silently
            // inverted every Play-as-Red game: an AI win (winner === 'Red')
            // matched humanColor === 'red' and got filed as a HUMAN win. That's
            // the "AI tab says the human won" bug. Reading the result from the
            // fixed internal side removes the inversion entirely.
            const humanScore = gameResult.blueScore;
            const aiScore    = gameResult.redScore;
            const humanWon   = gameResult.winner === 'Blue';

            // Which PROFILE the game is filed under is a separate question from
            // who won: file it under the colour the human is PLAYING AS, so a
            // Play-as-Red game still shows up in the Red profile. Only the
            // win/score determination above must use the internal side.
            const profileColor = gameResult.humanColor || 'blue';
            this.recordGame(this.data[profileColor], gameResult, humanScore, aiScore, humanWon, tied, 'ai', gameResult.aiDifficulty);

            // AI record tab. Field meaning (matches the AI-tab display below):
            //   .wins   = HUMAN wins vs AI at this difficulty
            //   .losses = AI wins (i.e. human losses)
            //   .ties   = ties
            const diff = gameResult.aiDifficulty || 'easy';
            this.data.ai.totalGames++;
            if (humanWon)      { this.data.ai.byDifficulty[diff].wins++; }
            else if (tied)     { this.data.ai.byDifficulty[diff].ties = (this.data.ai.byDifficulty[diff].ties || 0) + 1; }
            else               { this.data.ai.byDifficulty[diff].losses++; }
        } else {
            // 2-player: record BOTH players' perspectives. There's no visual
            // swap in 2-player (humanColor is forced to blue), so the internal
            // Blue/Red sides map straight to the Blue/Red profiles — no
            // humanColor juggling needed or wanted here.
            const blueWon = gameResult.winner === 'Blue';
            const redWon  = gameResult.winner === 'Red';
            this.recordGame(this.data.blue, gameResult, gameResult.blueScore, gameResult.redScore, blueWon, tied, '2player', null);
            this.recordGame(this.data.red,  gameResult, gameResult.redScore,  gameResult.blueScore, redWon,  tied, '2player', null);
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
        const add  = (id) => {
            if (!profile.achievements.find(a => a.id === id)) {
                const def = ACHIEVEMENTS.find(a => a.id === id);
                if (def) {
                    profile.achievements.push({
                        id,
                        title:       def.icon + ' ' + def.title,
                        description: def.desc,
                        timestamp:   Date.now()
                    });
                }
            }
        };
        const margin = (ctx.myScore != null && ctx.theirScore != null) ? (ctx.myScore - ctx.theirScore) : 0;

        if (s.totalGames === 1)                                    add('first-game');
        if (ctx.won && s.gamesWon === 1)                           add('first-win');
        if (ctx.won && margin === 1)                               add('nail-biter');
        if (s.perfectGames >= 1)                                   add('perfect');
        if (ctx.won && margin >= 50)                               add('blowout');
        if (ctx.won && ctx.theirScore != null && ctx.theirScore < 50) add('iron-defense');
        if (s.currentWinStreak === 3)                              add('streak-3');
        if (s.currentWinStreak === 5)                              add('streak-5');
        if (s.currentWinStreak >= 7)                               add('streak-7');
        if (ctx.myScore >= 150)                                    add('score-150');
        if (ctx.myScore >= 200)                                    add('score-200');
        if (ctx.myScore >= 250)                                    add('score-250');
        if (s.gamesWon >= 10)                                      add('wins-10');
        if (s.totalGames >= 25)                                    add('games-25');
        if (s.totalGames >= 100)                                   add('games-100');
        if (ctx.mode === 'ai' && ctx.won && ctx.diff === 'hard')   add('beat-hard-ai');
        if (ctx.mode === 'ai' && ctx.won && ctx.diff === 'hard' && margin >= 30) add('giant-slayer');
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
            <button class="stats-tab-btn ${tab==='game'||tab==='trivia'||tab==='achievements'?'active':''}" onclick="switchStatsTab('game')">🎲 Game</button>
        </div>`;

    if (tab === 'ai')    { return tabs + generateAITabHTML(); }
    if (tab === 'game' || tab === 'trivia' || tab === 'achievements')  { return tabs + generateGameTabHTML(tab); }
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

    // Margin & defense stats — derived live from stored game history
    // (myScore/theirScore are recorded per game), so no new tracking needed.
    const hist = profile.gameHistory || [];
    let biggestWin = 0;
    let closestWin = null;
    const winMargins  = [];
    const lossMargins = [];
    const oppScores   = [];
    hist.forEach(g => {
        const my = (g.myScore != null) ? g.myScore : null;
        const th = (g.theirScore != null) ? g.theirScore : null;
        if (my == null || th == null) { return; }
        oppScores.push(th);
        if (my > th) {
            const m = my - th;
            winMargins.push(m);
            if (m > biggestWin) { biggestWin = m; }
            if (closestWin === null || m < closestWin) { closestWin = m; }
        } else if (th > my) {
            lossMargins.push(th - my);
        }
    });
    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const marginCard = hist.length ? `
        <div class="stat-card">
            <h4>📐 Margins &amp; Defense</h4>
            <div class="stat-row"><span>Biggest Win:</span><span class="stat-value">${winMargins.length ? '+' + biggestWin : '—'}</span></div>
            <div class="stat-row"><span>Closest Win:</span><span class="stat-value">${closestWin !== null ? '+' + closestWin : '—'}</span></div>
            <div class="stat-row"><span>Avg Win Margin:</span><span class="stat-value">${winMargins.length ? '+' + avg(winMargins) : '—'}</span></div>
            <div class="stat-row"><span>Avg Loss Margin:</span><span class="stat-value">${lossMargins.length ? '−' + avg(lossMargins) : '—'}</span></div>
            <div class="stat-row"><span>Avg Points Allowed:</span><span class="stat-value">${oppScores.length ? avg(oppScores) : '—'}</span></div>
        </div>` : '';

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
            ${marginCard}
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

    // Rank: driven by the human's win rate at Hard, once there's a sample.
    const hardGames  = byD.hard.wins + byD.hard.losses;
    const hardWinPct = hardGames ? Math.round((byD.hard.wins / hardGames) * 100) : 0;
    function aiRank() {
        if (hardGames < 3)     { return { t: '🎲 Challenger',   d: 'Play a few Hard games to earn a rank' }; }
        if (hardWinPct >= 60)  { return { t: '🏆 AI Nemesis',   d: 'You own the Hard AI' }; }
        if (hardWinPct >= 40)  { return { t: '⚔️ Pocket Sharp', d: 'Holding your own against Hard' }; }
        if (hardWinPct >= 20)  { return { t: '🎯 Contender',    d: 'Closing the gap on Hard' }; }
        return { t: '🌱 Rolldown Rookie', d: 'The Hard AI has your number… for now' };
    }
    const rank = aiRank();
    // Nemesis: the difficulty that beats you most often (needs ≥2 games there).
    function nemesis() {
        let worst = null, worstRate = -1;
        ['easy','medium','hard'].forEach(dd => {
            const g = byD[dd].wins + byD[dd].losses;
            if (g >= 2) {
                const lossRate = byD[dd].losses / g;
                if (lossRate > worstRate) { worstRate = lossRate; worst = dd; }
            }
        });
        return worst ? worst.charAt(0).toUpperCase() + worst.slice(1) : '—';
    }

    return `
        <div class="stats-grid">
            <div class="stat-card">
                <h4>🎖️ Your AI Rank</h4>
                <div class="stat-row"><span class="stat-value" style="font-size:1.05em;">${rank.t}</span></div>
                <div class="stat-row" style="opacity:0.72;font-size:0.85em;"><span>${rank.d}</span></div>
                <div class="stat-row"><span>Toughest for you:</span><span class="stat-value">${nemesis()}</span></div>
            </div>
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

function generateGameTabHTML(inner) {
    inner = inner || 'game';
    const innerTabs = `
        <div class="stats-tabs" style="margin-bottom:10px;">
            <button class="stats-tab-btn ${inner==='game'?'active':''}" onclick="switchStatsTab('game')" style="font-size:0.8em;padding:6px 10px;">📊 Odds</button>
            <button class="stats-tab-btn ${inner==='trivia'?'active':''}" onclick="switchStatsTab('trivia')" style="font-size:0.8em;padding:6px 10px;">✨ Did You Know?</button>
            <button class="stats-tab-btn ${inner==='achievements'?'active':''}" onclick="switchStatsTab('achievements')" style="font-size:0.8em;padding:6px 10px;">🏅 Awards</button>
        </div>`;
    let body;
    if (inner === 'trivia')            { body = generateTriviaHTML(); }
    else if (inner === 'achievements') { body = generateAchievementsGalleryHTML(); }
    else                               { body = generateGameOddsHTML(); }
    return innerTabs + body;
}

// =============================================================================
// ACHIEVEMENT GALLERY — the full catalog, lit if earned, locked if not.
// Profile achievements show 🔵 / 🔴 for who earned them; global ones show 🌐.
// =============================================================================
function generateAchievementsGalleryHTML() {
    const d = pocketsStats.data;
    const blueHas = id => (d.blue.achievements || []).some(a => a.id === id);
    const redHas  = id => (d.red.achievements  || []).some(a => a.id === id);
    let unlocked = 0;

    const rows = ACHIEVEMENTS.map(def => {
        let earned = false, who = '';
        if (def.scope === 'global') {
            earned = !!(def.check && def.check(d));
            who = earned ? '🌐' : '';
        } else {
            const b = blueHas(def.id), r = redHas(def.id);
            earned = b || r;
            who = (b && r) ? '🔵🔴' : b ? '🔵' : r ? '🔴' : '';
        }
        if (earned) { unlocked++; }
        const op   = earned ? '1' : '0.42';
        const icon = earned ? def.icon : '🔒';
        const whoTag = (earned && who) ? ' <span style="font-size:0.85em;opacity:0.9;">' + who + '</span>' : '';
        return `<div style="display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid rgba(200,168,75,0.12);opacity:${op};">
            <div style="font-size:1.5em;width:34px;text-align:center;flex-shrink:0;">${icon}</div>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:bold;font-size:0.95em;">${def.title}${whoTag}</div>
                <div style="font-size:0.8em;opacity:0.75;line-height:1.35;">${def.desc}</div>
            </div>
        </div>`;
    }).join('');

    const total = ACHIEVEMENTS.length;
    const pct   = Math.round((unlocked / total) * 100);
    return `
    <div class="stat-card" style="text-align:center;">
        <h4 style="margin-bottom:6px;">🏅 Achievement Gallery</h4>
        <p style="font-size:0.95em;margin:0 0 8px;"><strong>${unlocked}</strong> of <strong>${total}</strong> unlocked</p>
        <div style="height:9px;background:rgba(0,0,0,0.28);border-radius:5px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#a08540,#e8d8a0);border-radius:5px;transition:width 0.5s ease;"></div>
        </div>
        <p style="font-size:0.72em;opacity:0.6;margin:8px 0 0;">🔵 / 🔴 shows who earned it · 🌐 spans both colours</p>
    </div>
    <div class="stat-card" style="padding-top:2px;padding-bottom:2px;">${rows}</div>`;
}

function generateGameOddsHTML() {
    return `
    <div class="stat-card" style="text-align:center;padding-bottom:6px;">
        <h4 style="margin-bottom:4px;">🎲 The Honest Dice Disclaimer</h4>
        <p style="font-size:0.88em;opacity:0.85;margin:0;">Every die in POCKETS produces a truly random number from 1 to 6. No weighting, no favoritism, no conspiracy. The 1s are just as likely as the 6s.</p>
    </div>

    <div class="stat-card">
        <h4>🎯 Combo Odds — 4 Dice (all random)</h4>
        <p style="font-size:0.8em;opacity:0.7;margin:0 0 8px;">These treat all four dice as fresh random rolls — exactly true in Round 1. From Round 2 on, one of your four is your <em>known</em> saved die, which shifts the numbers below (in your favour if you saved high).</p>
        <div class="stat-row"><span>Any scoring combo (pair or better):</span><span class="stat-value">~78%</span></div>
        <div class="stat-row"><span>Exactly one pair:</span><span class="stat-value">~56%</span></div>
        <div class="stat-row"><span>Two pair:</span><span class="stat-value">~7%</span></div>
        <div class="stat-row"><span>3 of a kind:</span><span class="stat-value">~9%</span></div>
        <div class="stat-row"><span>A straight (4 in sequence):</span><span class="stat-value">~5.6%</span></div>
        <div class="stat-row"><span>4 of a kind:</span><span class="stat-value">~0.46%</span></div>
        <div class="stat-row"><span>No combo at all:</span><span class="stat-value">~22%</span></div>
        <div class="stat-row"><span>Max score — regular round (four 6s: Keep two + win Take by 5 + four-of-a-kind bonus):</span><span class="stat-value">23 pts</span></div>
        <div class="stat-row"><span>Min score — regular round (two 1s Keep, lose the Take):</span><span class="stat-value">2 pts</span></div>
    </div>

    <div class="stat-card">
        <h4>🌌 Combo Odds — Rolldown (5 Dice)</h4>
        <p style="font-size:0.8em;opacity:0.7;margin:0 0 8px;">Your Rolldown hand is 4 fresh dice plus your saved die. These treat all five as random; a high saved die tilts them your way.</p>
        <div class="stat-row"><span>Full house:</span><span class="stat-value">~3.9%</span></div>
        <div class="stat-row"><span>Straight (5 in sequence):</span><span class="stat-value">~3.1%</span></div>
        <div class="stat-row"><span>4 of a kind:</span><span class="stat-value">~1.9%</span></div>
        <div class="stat-row"><span>5 of a kind:</span><span class="stat-value">~0.08%</span></div>
        <div class="stat-row"><span>Max score — Rolldown (five 6s + 5-of-a-kind bonus):</span><span class="stat-value">40 pts</span></div>
        <div class="stat-row"><span>Min score — Rolldown (e.g. 1,1,1,2,2 = full house = 11 pts):</span><span class="stat-value">11 pts</span></div>
    </div>

    <div class="stat-card">
        <h4>📊 Take Battle Odds</h4>
        <div class="stat-row"><span>Win Take (both random dice):</span><span class="stat-value">~42%</span></div>
        <div class="stat-row"><span>Tie Take (zero points both):</span><span class="stat-value">~17%</span></div>
        <div class="stat-row"><span>Lose Take:</span><span class="stat-value">~42%</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;padding-bottom:6px;"><span>The randomness is symmetric. The decisions aren't.</span></div>
        <div class="stat-row"><span>Win by exactly 1 pip:</span><span class="stat-value">~14%</span></div>
        <div class="stat-row"><span>Win by 5 (the biggest possible margin):</span><span class="stat-value">~3%</span></div>
        <div class="stat-row" style="opacity:0.7;font-size:0.82em;padding-top:4px;"><span>Strategy: a bare Take win (no combo) averages ~2.3 pts — less than an average Keep die (3.5). The combo bonus is the real reason to fight for the Take.</span></div>
    </div>

    <div class="stat-card">
        <h4>💾 Save Pocket — Improvement Odds</h4>
        <p style="font-size:0.82em;opacity:0.75;margin-bottom:8px;">Rolling 3 new dice — chance at least one beats your saved die:</p>
        <div class="stat-row"><span>Saved a 1:</span><span class="stat-value">99.5%</span></div>
        <div class="stat-row"><span>Saved a 2:</span><span class="stat-value">96.3%</span></div>
        <div class="stat-row"><span>Saved a 3:</span><span class="stat-value">87.5%</span></div>
        <div class="stat-row"><span>Saved a 4:</span><span class="stat-value">70.4%</span></div>
        <div class="stat-row"><span>Saved a 5:</span><span class="stat-value">42.1%</span></div>
        <div class="stat-row"><span>Saved a 6:</span><span class="stat-value">0%</span></div>
    </div>

    <div class="stat-card">
        <h4>🏅 Your Best New Die — Distribution</h4>
        <p style="font-size:0.82em;opacity:0.75;margin-bottom:8px;">Rolling 3 dice — highest result distribution:</p>
        <div class="stat-row"><span>Best die is a 6:</span><span class="stat-value">42.1%</span></div>
        <div class="stat-row"><span>Best die is a 5:</span><span class="stat-value">28.2%</span></div>
        <div class="stat-row"><span>Best die is a 4:</span><span class="stat-value">17.1%</span></div>
        <div class="stat-row"><span>Best die is a 3:</span><span class="stat-value">8.8%</span></div>
        <div class="stat-row"><span>Best die is a 2:</span><span class="stat-value">3.2%</span></div>
        <div class="stat-row"><span>Best die is a 1:</span><span class="stat-value">0.5%</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;"><span>Average best die: <strong>4.96</strong>. Average worst die: <strong>2.04</strong>. Typical spread: <strong>~2.9 pips</strong>.</span></div>
    </div>`;
}

function generateTriviaHTML() {
    return `
    <div class="stat-card">
        <h4>🤯 Cosmic Rarity Events</h4>
        <div class="stat-row"><span>Both players roll all 6s simultaneously:</span><span class="stat-value">1 in 1,679,616</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;padding-bottom:6px;"><span>About as likely as flipping heads 20 times in a row. If it happens, frame the screenshot.</span></div>
        <div class="stat-row"><span>Both players roll identical 4-die combos:</span><span class="stat-value">1 in 1,296</span></div>
        <div class="stat-row"><span>Rolling four 1s (the nightmare):</span><span class="stat-value">1 in 1,296</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;padding-bottom:6px;"><span>Same odds as four 6s. The dice are indifferent to your feelings.</span></div>
        <div class="stat-row"><span>Five 6s in the Rolldown:</span><span class="stat-value">1 in 7,776</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;"><span>Worth 40 points. Has definitely happened. Probably not to you. Yet.</span></div>
    </div>

    <div class="stat-card">
        <h4>💡 The Saved 6 Insight</h4>
        <div class="stat-row"><span>Chance none of 3 new dice equal or beat a saved 6:</span><span class="stat-value">57.9%</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;padding-bottom:6px;"><span>More than half the time, your saved 6 is the best die in your hand before the roll is even finished.</span></div>
        <div class="stat-row"><span>Chance of rolling another 6 across your 3 new dice:</span><span class="stat-value">~42%</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;"><span>Feels rarer than it is. Save more 6s.</span></div>
    </div>

    <div class="stat-card">
        <h4>🎲 Things That Surprise Everyone</h4>
        <div class="stat-row"><span>You'll have NO combo about this often:</span><span class="stat-value">~1 in 4–5 rounds</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;padding-bottom:6px;"><span>Feels like it happens more. It doesn't. You just remember it more.</span></div>
        <div class="stat-row"><span>Tie the Take on a 1 (both play a 1 — a 1 can't win):</span><span class="stat-value">1 in 6</span></div>
        <div class="stat-row"><span>Your best of 3 dice averages almost exactly:</span><span class="stat-value">5</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;padding-bottom:6px;"><span>Every round your top die is nearly a 5. Plan around it.</span></div>
        <div class="stat-row"><span>A saved 4 will be beaten by a new die:</span><span class="stat-value">7 in 10 rounds</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;"><span>So why are you keeping that 4 in your Save pocket late game?</span></div>
    </div>

    <div class="stat-card">
        <h4>📐 The Keep Math Nobody Does</h4>
        <div class="stat-row"><span>Two 6s in Keep every round:</span><span class="stat-value">12 pts/round</span></div>
        <div class="stat-row"><span>That reaches 100+ in about 9 rounds — on Keep alone, no Take fights.</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;padding-bottom:6px;"><span>Keep is underrated. Not every round needs a Take battle.</span></div>
        <div class="stat-row"><span>Expected Keep score per round (avg 2 dice):</span><span class="stat-value">~7 pts</span></div>
        <div class="stat-row"><span>Expected Take win margin, when you win (random dice):</span><span class="stat-value">~2.3 pips</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;"><span>A 2-pip Take win with no combo is worth less than either Keep die on average. Choose your fights.</span></div>
    </div>

    <div class="stat-card">
        <h4>⏱️ Tempo &amp; Fate</h4>
        <div class="stat-row"><span>Fastest possible game:</span><span class="stat-value">5 rounds</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;padding-bottom:6px;"><span>You'd need a near-perfect 23 every single round to trigger the Rolldown that fast.</span></div>
        <div class="stat-row"><span>A 5-of-a-kind Rolldown:</span><span class="stat-value">~once every 21 years</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;padding-bottom:6px;"><span>1 in 7,776 — at one game a day, roughly once every two decades.</span></div>
        <div class="stat-row"><span>If everyone on Earth played one game right now, both-roll-all-6s would happen:</span><span class="stat-value">~4,700 times</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;"><span>1 in 1.68 million per game. Somewhere, someone would be framing a screenshot.</span></div>
    </div>

    <div class="stat-card">
        <h4>🧠 The Deciding Truth</h4>
        <div class="stat-row"><span>The Take is a coin flip.</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;padding-bottom:6px;"><span>Over a full game you'll win and lose almost exactly as many Take battles. Games are decided by Keep choices and combos — not by the Take itself.</span></div>
        <div class="stat-row"><span>The dice have no memory.</span></div>
        <div class="stat-row" style="opacity:0.65;font-size:0.82em;"><span>Just rolled four 1s? Your next roll is exactly as likely to be four 1s again. The dice don't owe you a thing.</span></div>
    </div>

    <div class="stat-card" style="text-align:center;">
        <h4>🏆 The One True Fact</h4>
        <p style="font-size:0.88em;opacity:0.85;margin:0 0 6px;">"The roll is random. The choices aren't."</p>
        <p style="font-size:0.8em;opacity:0.6;margin:0;">Every number above describes what the dice do on their own. POCKETS is about what you do after that.</p>
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
            },
            null,
            'Clear Stats',
            'Cancel'
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
