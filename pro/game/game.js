/*
 * BASE GAME (3-ROUND VERSION) - STARTING POINT FOR PRO/PRO+ REBUILD
 * 
 * This is the working Base game code with 3 rounds (maxRounds = 3).
 * Standard game (1 round) is working perfectly and will be deployed separately.
 * Use this 3-round base as the foundation to build Pro/Pro+ features.
 * 
 * WHAT THIS HAS (WORKING):
 * ✅ 3 rounds per game
 * ✅ Score tracking across rounds
 * ✅ Word loading and validation
 * ✅ Guess feedback with arrows
 * ✅ AlphaHint (bold letters)
 * ✅ UI elements (placeholder, round indicator)
 * ✅ Stats tracking
 * ✅ Share functionality
 * 
 * MODIFICATIONS NEEDED FOR PRO:
 * 1. Add gameMode variable: 'pro' or 'proplus'
 * 2. Add playCountProPlus variable (keep existing playCount for Pro)
 * 3. Modify word formula to use different multipliers:
 *    - Pro: ((day + playCount) * 613) + (round * 997)
 *    - Pro+: ((day + playCountProPlus) * 751) + (round * 1009)
 * 4. Add Pro+ arrow validation logic (validateProPlusGuess function)
 * 5. Add AlphaHint disable for Pro+ mode
 * 6. Replace countdown timer with Play Again buttons in showDailyCompleteModal()
 * 7. Add mode toggle buttons in HTML header
 * 8. Add dev console for testing (3-column layout)
 * 9. Add clearGameState() call in resetGame() to prevent saved game restoration
 * 10. Add performModeSwitch() function for Pro ↔ Pro+ switching
 * 
 * See PRO-GAME-REBUILD-HANDOFF.md for complete requirements and testing checklist.
 */

// Game state variables
var targetWord = "";
var answerWords = [];
var validWords = [];
var currentScore = 100;
var totalScore = 0;
var guessCount = 0;
var usedLetters = new Set();
var currentRound = 1;
var maxRounds = 3;
var roundResults = [];
var guessHistory = [];
var guessedWordsThisRound = new Set();
var lastFetchedDefinition = null; // Store definition for reuse

// Pro/Pro+ Mode Variables
var gameMode = 'pro'; // 'pro' or 'proplus'
var playCount = 0; // Play counter for Pro mode
var playCountProPlus = 0; // Separate counter for Pro+ mode
var pendingModeSwitch = null; // Track pending mode switch during confirmation

// Get game day number based on LOCAL midnight (like Wordle)
function getLocalGameDay() {
    var now = new Date();
    var localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // OFFICIAL LAUNCH: January 1, 2026
    var launchDate = new Date(2026, 0, 1); // January 1, 2026 (month is 0-indexed)
    
    var daysSinceLaunch = Math.floor((localMidnight - launchDate) / 86400000);
    return daysSinceLaunch + 1; // Start at Day 1
}

var dailyNumber = getLocalGameDay();
var usingFallbackMode = false; // Track if using fallback words for testing

// Stats variables
var playerStats = {
    // First play dates (shown under headers)
    firstProGameDate: null,      // "March 7, 2026" or null
    firstProPlusGameDate: null,  // "March 10, 2026" or null
    
    // PRO MODE STATS
    pro: {
        gamesPlayed: 0,
        bestScore: 0,
        totalScore: 0,
        
        // Time window totals
        dailyTotal: 0,
        weeklyTotal: 0,
        monthlyTotal: 0,
        annualTotal: 0,
        
        // Tracking (to know when to reset)
        currentDay: null,     // "2026-03-07"
        currentWeek: null,    // "2026-W10"
        currentMonth: null,   // "2026-03"
        currentYear: null,    // "2026"
        
        // Archive previous years
        yearlyArchive: {}  // { "2025": { total: 189450, games: 342 } }
    },
    
    // PRO+ MODE STATS
    proplus: {
        gamesPlayed: 0,
        bestScore: 0,
        totalScore: 0,
        
        // Time window totals
        dailyTotal: 0,
        weeklyTotal: 0,
        monthlyTotal: 0,
        annualTotal: 0,
        
        // Tracking (to know when to reset)
        currentDay: null,
        currentWeek: null,
        currentMonth: null,
        currentYear: null,
        
        // Archive previous years
        yearlyArchive: {}
    }
};

// Helper functions for time periods
function formatDateForDisplay(dateStr) {
    if (!dateStr) return "Not played yet";
    var parts = dateStr.split('-');
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function getDateKey() {
    var d = new Date();
    return d.getFullYear() + '-' + 
           String(d.getMonth() + 1).padStart(2, '0') + '-' + 
           String(d.getDate()).padStart(2, '0');
}

function getWeekKey() {
    var d = new Date();
    var startOfYear = new Date(d.getFullYear(), 0, 1);
    var days = Math.floor((d - startOfYear) / (24 * 60 * 60 * 1000));
    var weekNum = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return d.getFullYear() + '-W' + String(weekNum).padStart(2, '0');
}

function getMonthKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function getYearKey() {
    return new Date().getFullYear().toString();
}


// Fallback word list
var fallbackWords = ['ABOUT','ABOVE','ACTOR','ADMIT','ADOPT','ADULT','AFTER','AGAIN','AGENT','AGREE','AHEAD','ALARM','ALBUM','ALERT','ALIKE','ALIVE','ALLOW','ALONE','ALONG','ALTER','ANGEL','ANGER','ANGLE','ANGRY','APART','APPLE','APPLY','ARENA','ARGUE','ARISE','ARRAY','ASIDE','ASSET','AVOID','AWAKE','AWARD','AWARE','BAKER','BASIC','BEACH','BEGAN','BEING','BELOW','BENCH','BIRTH','BLACK','BLAME','BLANK','BLAST','BLEND','BLIND','BLOCK','BLOOD','BOARD','BOOST','BOUND','BRAIN','BRAND','BRAVE','BREAD','BREAK','BRICK','BRIEF','BRING','BROAD','BROKE','BROWN','BUILD','BUILT','BUYER','CABLE','CARRY','CATCH','CAUSE','CHAIN','CHAIR','CHAOS','CHARM','CHART','CHASE','CHEAP','CHECK','CHEST','CHIEF','CHILD','CHOSE','CLAIM','CLASS','CLEAN','CLEAR','CLIMB','CLOCK','CLOSE','CLOUD','COACH','COAST','COULD','COUNT','COURT','COVER','CRAFT','CRASH','CRAZY','CREAM','CRIME','CROSS','CROWD','CROWN','CURVE','CYCLE','DAILY','DANCE','DEALT','DEATH','DELAY','DEPTH','DIGIT','DIRTY','DOUBT','DOZEN','DRAFT','DRAMA','DRANK','DRAWN','DREAM','DRESS','DRINK','DRIVE','EARLY','EARTH','EIGHT','ELECT','EMPTY','ENEMY','ENJOY','ENTER','ENTRY','EQUAL','ERROR','EVENT','EVERY','EXACT','EXIST','EXTRA','FAITH','FALSE','FAULT','FIELD','FIFTH','FIFTY','FIGHT','FINAL','FIRST','FIXED','FLASH','FLEET','FLOAT','FLOOR','FOCUS','FORCE','FORTY','FOUND','FRAME','FRESH','FRONT','FRUIT','FULLY','FUNNY','GIANT','GIVEN','GLASS','GLOBE','GOING','GRACE','GRADE','GRAIN','GRAND','GRANT','GRASS','GREAT','GREEN','GROSS','GROUP','GROWN','GUARD','GUESS','GUEST','GUIDE','HABIT','HAPPY','HEART','HEAVY','HELLO','HORSE','HOTEL','HOUSE','HUMAN','IDEAL','IMAGE','IMPLY','INDEX','INNER','INPUT','ISSUE','JOINT','JUDGE','KNOWN','LABEL','LARGE','LATER','LAUGH','LAYER','LEARN','LEAST','LEAVE','LEGAL','LEMON','LEVEL','LIGHT','LIMIT','LOCAL','LOGIC','LOWER','LUCKY','LUNCH','MAGIC','MAJOR','MAKER','MARCH','MATCH','MAYBE','MAYOR','MEANT','MEDIA','METAL','MIGHT','MINOR','MINUS','MIXED','MODEL','MONEY','MONTH','MORAL','MOTOR','MOUNT','MOUSE','MOUTH','MOVED','MOVIE','MUSIC'];

// CHANGE THIS TO YOUR ACTUAL GAME URL
var GAME_URL = "https://directionary.net";

// Dev mode password (shows target words)
var DEV_PASSWORD = "0b@ma43evaH!";
var devMode = false;

// Test mode password (uses random words instead of daily words)
var TEST_PASSWORD = "test2025";
var testMode = false;

// Check for dev mode and test mode in URL
var urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('dev') === DEV_PASSWORD) {
    devMode = true;
    console.log("🎯 DEV MODE ENABLED");
}
if (urlParams.get('test') === TEST_PASSWORD) {
    testMode = true;
    console.log("🧪 TEST MODE ENABLED - Using random words");
}

function showDefinition(word) {
    var defBox = document.getElementById('definitionBox');
    var defWord = document.getElementById('defWord');
    var defText = document.getElementById('defText');
    
    defWord.textContent = word.toLowerCase();
    defText.textContent = 'Loading definition...';
    defBox.style.display = 'block';
    
    // Auto-hide after 10 seconds
    setTimeout(function() {
        defBox.style.display = 'none';
    }, 10000);
    
    // Fetch from Free Dictionary API
    fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + word.toLowerCase())
        .then(response => {
            if (!response.ok) {
                throw new Error('Definition not found');
            }
            return response.json();
        })
        .then(data => {
            if (data && data[0] && data[0].meanings && data[0].meanings[0]) {
                var meaning = data[0].meanings[0];
                var partOfSpeech = meaning.partOfSpeech || '';
                var definition = meaning.definitions[0].definition || 'Definition not available';
                
                defText.textContent = (partOfSpeech ? '(' + partOfSpeech + ') ' : '') + definition;
            } else {
                defText.textContent = 'Definition not available';
            }
        })
        .catch(error => {
            console.log('Dictionary API error:', error);
            defText.textContent = 'Definition not available';
        });
}

// Show word definition in modal (for clicked guessed words)
function showWordDefinitionModal(word) {
    document.getElementById('wordDefWord').textContent = word.toLowerCase();
    document.getElementById('wordDefText').textContent = 'Fetching definition...';
    
    // Update the "See full definition" link to Dictionary.com
    var linkElement = document.querySelector('#wordDefLink a');
    if (linkElement) {
        linkElement.href = 'https://www.dictionary.com/browse/' + word.toLowerCase();
    }
    
    document.getElementById('wordDefPanel').style.display = 'flex';
    
    // Fetch from Free Dictionary API
    fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + word.toLowerCase())
        .then(response => {
            if (!response.ok) {
                throw new Error('Definition not found');
            }
            return response.json();
        })
        .then(data => {
            if (data && data[0] && data[0].meanings && data[0].meanings[0]) {
                var meaning = data[0].meanings[0];
                var partOfSpeech = meaning.partOfSpeech || '';
                var definition = meaning.definitions[0].definition || 'Definition not available';
                
                document.getElementById('wordDefText').textContent = (partOfSpeech ? '(' + partOfSpeech + ') ' : '') + definition;
            } else {
                document.getElementById('wordDefText').textContent = 'Definition not available';
            }
        })
        .catch(error => {
            console.log('Dictionary API error:', error);
            document.getElementById('wordDefText').textContent = 'Definition not available';
        });
}

function closeWordDefPanel() {
    document.getElementById('wordDefPanel').style.display = 'none';
}

function updateScoreDisplay() {
    // Calculate total guesses across all rounds
    var totalGuesses = guessCount; // Current round guesses
    for (var i = 0; i < roundResults.length; i++) {
        totalGuesses += roundResults[i].guesses;
    }
    document.getElementById("guessCount").textContent = totalGuesses;
    
    // Show X/300 format for 3-word game
    var totalPossible = maxRounds * 100;
    // Show projected total (totalScore + currentScore) - currentScore is 0 after winning a round
    var currentTotal = totalScore + currentScore;
    document.getElementById("currentScore").textContent = currentTotal + "/" + totalPossible;
}

function updateAlphabetDisplay() {
    var alphabetDiv = document.getElementById("alphabetDisplay");
    if (!alphabetDiv) return;
    
    var spans = alphabetDiv.getElementsByTagName("span");
    for (var i = 0; i < spans.length; i++) {
        var span = spans[i];
        var letter = span.textContent;
        // Only bold used letters in Pro mode, not Pro+
        if (gameMode !== 'proplus' && usedLetters.has(letter)) {
            span.classList.add("used-letter");
        } else {
            span.classList.remove("used-letter");
        }
    }
}

// Beta Banner Management
function showBetaBannerIfEnabled() {
    var betaMode = localStorage.getItem('directionary_base_betaMode') === 'true';
    
    if (betaMode) {
        // Check if banner already exists
        if (document.getElementById('betaBanner')) return;
        
        // Create and insert beta banner at top of page
        var banner = document.createElement('div');
        banner.id = 'betaBanner';
        banner.style.cssText = 'background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); color: white; text-align: center; padding: 12px; font-weight: 600; font-size: 0.95em; box-shadow: 0 2px 8px rgba(0,0,0,0.15); position: sticky; top: 0; z-index: 1000;';
        banner.innerHTML = '🚧 BETA VERSION - Report issues: <a href="mailto:feedback@directionary.net" style="color: white; text-decoration: underline;">feedback@directionary.net</a> 🚧';
        
        // Insert at very top of body
        document.body.insertBefore(banner, document.body.firstChild);
        console.log("Beta banner displayed");
    } else {
        // Remove banner if it exists but beta mode is off
        var existingBanner = document.getElementById('betaBanner');
        if (existingBanner) {
            existingBanner.remove();
            console.log("Beta banner removed");
        }
    }
}

function loadWordList() {
    fetch('words.json')
        .then(response => response.json())
        .then(data => {
            if (data.answers && data.answers.length > 0) {
                answerWords = data.answers.map(w => w.toUpperCase());
                console.log("Loaded " + answerWords.length + " answer words");
            }
            if (data.valid && data.valid.length > 0) {
                validWords = data.valid.map(w => w.toUpperCase());
                console.log("Loaded " + validWords.length + " valid words");
            }
            
            // Merge words added via Word Management Dashboard (admin.html)
            try {
                var addedWordsData = localStorage.getItem('directionary_base_addedWords');
                if (addedWordsData) {
                    var addedWords = JSON.parse(addedWordsData);
                    
                    if (addedWords.answers && addedWords.answers.length > 0) {
                        addedWords.answers.forEach(function(word) {
                            word = word.toUpperCase();
                            if (!answerWords.includes(word)) {
                                answerWords.push(word);
                            }
                        });
                        console.log("Merged " + addedWords.answers.length + " added answer words");
                    }
                    
                    if (addedWords.valid && addedWords.valid.length > 0) {
                        addedWords.valid.forEach(function(word) {
                            word = word.toUpperCase();
                            if (!validWords.includes(word)) {
                                validWords.push(word);
                            }
                        });
                        console.log("Merged " + addedWords.valid.length + " added valid words");
                    }
                }
            } catch (e) {
                console.log("Could not load added words:", e);
            }
            
            startNewGame();
        })
        .catch(error => {
            console.log("Could not load word list, using fallback:", error);
            answerWords = fallbackWords;
            validWords = fallbackWords;
            usingFallbackMode = true;
            console.log("FALLBACK MODE ENABLED - words will use rotation");
            
            try {
                var addedWordsData = localStorage.getItem('directionary_base_addedWords');
                if (addedWordsData) {
                    var addedWords = JSON.parse(addedWordsData);
                    
                    if (addedWords.answers && addedWords.answers.length > 0) {
                        addedWords.answers.forEach(function(word) {
                            word = word.toUpperCase();
                            if (!answerWords.includes(word)) {
                                answerWords.push(word);
                            }
                        });
                        console.log("Merged " + addedWords.answers.length + " added answer words (fallback mode)");
                    }
                    
                    if (addedWords.valid && addedWords.valid.length > 0) {
                        addedWords.valid.forEach(function(word) {
                            word = word.toUpperCase();
                            if (!validWords.includes(word)) {
                                validWords.push(word);
                            }
                        });
                        console.log("Merged " + addedWords.valid.length + " added valid words (fallback mode)");
                    }
                }
            } catch (e) {
                console.log("Could not load added words:", e);
            }
            
            startNewGame();
        });
}

function initGame() {
    console.log("Initializing Directionary PRO...");
    
    // Load play counts for both modes
    var storedPlayCountPro = localStorage.getItem('directionary_pro_playCount');
    playCount = storedPlayCountPro ? parseInt(storedPlayCountPro) : 0;
    
    var storedPlayCountProPlus = localStorage.getItem('directionary_proplus_playCount');
    playCountProPlus = storedPlayCountProPlus ? parseInt(storedPlayCountProPlus) : 0;
    
    console.log("PRO MODE: Play count loaded:", playCount);
    console.log("PRO+ MODE: Play count loaded:", playCountProPlus);
    
    // CRITICAL: Set current day in localStorage FIRST, before day checker starts
    // This prevents false "new day" detection on fresh page loads
    if (!devMode && !testMode) {
        localStorage.setItem('directionary_pro_currentDay', getLocalGameDay());
    }
    
    showBetaBannerIfEnabled();
    
    if (!devMode && !testMode) {
        startDayChangeChecker();
    }
    
    // PRO MODE: No daily limit - unlimited plays allowed
    
    currentRound = 1;
    totalScore = 0;
    roundResults = [];
    guessHistory = [];
    loadWordList();
    
    if (typeof gtag === 'function') {
        gtag('event', 'game_start', {
            'game_version': gameMode === 'proplus' ? 'proplus' : 'pro',
            'game_day': dailyNumber,
            'mode': devMode ? 'dev' : (testMode ? 'test' : 'production')
        });
    }
    
    setTimeout(function() {
        document.getElementById("guessInput").focus();
    }, 100);
}

function startDayChangeChecker() {
    console.log("Day change checker started - will check every minute for new day");
    
    setInterval(function() {
        var currentDay = getLocalGameDay();
        var storedDay = localStorage.getItem('directionary_base_currentDay');
        
        if (!storedDay) {
            localStorage.setItem('directionary_base_currentDay', currentDay);
            console.log("🔧 No stored day - initialized to current day:", currentDay);
            return;
        }
        
        storedDay = parseInt(storedDay);
        
        if (currentDay > storedDay) {
            console.log("New day detected! Old day:", storedDay, "New day:", currentDay);
            console.log("Reloading for fresh puzzle...");
            localStorage.setItem('directionary_base_currentDay', currentDay);
            location.reload();
        }
    }, 10000);
}

function startNewGame() {
    console.log("Starting round " + currentRound + "...");
    
    if (currentRound === 1) {
        var savedState = loadGameState();
        if (savedState) {
            restoreGameState(savedState);
            return;
        }
    }
    
    var wordPool = answerWords.length > 0 ? answerWords : fallbackWords;
    var wordIndex;
    
    if (testMode || devMode || usingFallbackMode) {
        wordIndex = Math.floor(Math.random() * wordPool.length);
        var modeLabel = testMode ? "TEST MODE" : (devMode ? "DEV MODE" : "FALLBACK MODE");
        console.log(modeLabel + ": Random word index:", wordIndex);
    } else {
        // Pro/Pro+ word formulas (different for each mode)
        if (gameMode === 'proplus') {
            wordIndex = (((dailyNumber + playCountProPlus) * 751) + (currentRound * 1009)) % wordPool.length;
            console.log("PRO+ MODE: Word index:", wordIndex, "| Day:", dailyNumber, "| PlayCount:", playCountProPlus, "| Round:", currentRound);
        } else {
            wordIndex = (((dailyNumber + playCount) * 613) + (currentRound * 997)) % wordPool.length;
            console.log("PRO MODE: Word index:", wordIndex, "| Day:", dailyNumber, "| PlayCount:", playCount, "| Round:", currentRound);
        }
    }
    
    var overrides = {};
    try {
        var overrideData = localStorage.getItem('directionary_base_wordOverrides');
        if (overrideData) {
            overrides = JSON.parse(overrideData);
        }
    } catch (e) {
        console.log("Could not load word overrides:", e);
    }
    
    var today = new Date();
    var year = today.getFullYear();
    var month = String(today.getMonth() + 1).padStart(2, '0');
    var day = String(today.getDate()).padStart(2, '0');
    var todayStr = year + '-' + month + '-' + day;
    
    if (overrides[todayStr] && overrides[todayStr][currentRound]) {
        targetWord = overrides[todayStr][currentRound];
        console.log("Using OVERRIDE word for Round " + currentRound + ":", targetWord);
    } else {
        targetWord = wordPool[wordIndex];
    }
    
    if (devMode || testMode) {
        console.log("Target word:", targetWord, "(round", currentRound + ")");
    }
    
    if (devMode) {
        updateDevConsole();
    }
    
    if (testMode) {
        document.getElementById("testModeDisplay").style.display = "block";
    }
    
    currentScore = 100;
    guessCount = 0;
    guessHistory = [];
    guessedWordsThisRound = new Set();
    usedLetters = new Set();
    updateScoreDisplay();
    updateAlphabetDisplay();
    
    document.getElementById('definitionBox').style.display = 'none';
    document.getElementById("guessInput").value = "";
    document.getElementById("guessInput").disabled = false;
    document.getElementById("submitBtn").disabled = false;
    document.getElementById("giveUpBtn").disabled = false;
    document.getElementById("guessInput").focus();
}

// DEV CONSOLE: Show Pro and Pro+ words side-by-side
function updateDevConsole() {
    var wordPool = answerWords.length > 0 ? answerWords : fallbackWords;
    var wordSource = answerWords.length > 0 ? "JSON words" : "Fallback list";
    
    // Calculate Pro word
    var proIndex = (((dailyNumber + playCount) * 613) + (currentRound * 997)) % wordPool.length;
    var proWord = wordPool[proIndex];
    
    // Calculate Pro+ word
    var proPlusIndex = (((dailyNumber + playCountProPlus) * 751) + (currentRound * 1009)) % wordPool.length;
    var proPlusWord = wordPool[proPlusIndex];
    
    var devDisplay = document.getElementById("devModeDisplay");
    devDisplay.style.display = "block";
    
    var html = '<div style="display: grid; grid-template-columns: auto 1fr 1fr; gap: 10px; align-items: center; padding: 10px; background: #f8f9fa; border-radius: 8px; font-size: 0.9em;">';
    html += '<div style="font-weight: 700; color: #667eea;">Round ' + currentRound + ':</div>';
    html += '<div style="text-align: center;"><div style="font-size: 0.8em; color: #666; margin-bottom: 4px;">PRO' + (gameMode === 'pro' ? ' ⬅ Active' : '') + '</div><div style="font-weight: 700; font-size: 1.1em; color: ' + (gameMode === 'pro' ? '#667eea' : '#999') + ';">' + proWord + '</div><div style="font-size: 0.75em; color: #999;">Play #' + playCount + '</div></div>';
    html += '<div style="text-align: center;"><div style="font-size: 0.8em; color: #666; margin-bottom: 4px;">PRO+' + (gameMode === 'proplus' ? ' ⬅ Active' : '') + '</div><div style="font-weight: 700; font-size: 1.1em; color: ' + (gameMode === 'proplus' ? '#667eea' : '#999') + ';">' + proPlusWord + '</div><div style="font-size: 0.75em; color: #999;">Play #' + playCountProPlus + '</div></div>';
    html += '</div>';
    html += '<div style="text-align: center; margin-top: 8px; font-size: 0.85em; color: #666;">' + wordSource + ' | Day ' + dailyNumber + '</div>';
    html += '<div style="text-align: center; margin-top: 8px;"><button onclick="reloadDevGame()" style="background: #667eea; color: white; border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer; font-size: 0.9em; font-weight: 600;">🔄 New Game</button></div>';
    
    devDisplay.innerHTML = html;
}

// PRO+ MODE: Validate guess respects arrow constraints
function validateProPlusGuess(guess) {
    if (gameMode !== 'proplus') return true; // Not in Pro+ mode
    if (guessHistory.length === 0) return true; // No previous guesses yet
    
    var lastGuess = guessHistory[guessHistory.length - 1];
    if (!lastGuess) return true;
    
    // Get the last guess word and feedback
    var feedbackDiv = document.getElementById("feedback");
    var lastLine = feedbackDiv.querySelector('.feedback-line:first-child');
    if (!lastLine) return true;
    
    var lastWord = lastLine.querySelector('.feedback-word').textContent;
    var symbols = lastLine.querySelectorAll('.overlay-symbol');
    
    for (var i = 0; i < 5; i++) {
        var lastLetter = lastWord[i];
        var newLetter = guess[i];
        var symbol = symbols[i] ? symbols[i].textContent.trim() : '';
        
        if (symbol === '●' || symbol === '🟢') {
            // Must keep same letter
            if (newLetter !== lastLetter) return false;
        } else if (symbol === '►' || symbol === '▶') {
            // Target is AFTER this letter - new guess must be later in alphabet
            if (newLetter <= lastLetter) return false;
        } else if (symbol === '◄' || symbol === '◀') {
            // Target is BEFORE this letter - new guess must be earlier in alphabet
            if (newLetter >= lastLetter) return false;
        }
    }
    
    return true;
}

function submitGuess() {
    var input = document.getElementById("guessInput");
    var guess = input.value.trim().toUpperCase();
    var errorDiv = document.getElementById("errorMessage");
    
    errorDiv.innerHTML = "";
    
    if (!guess || guess.length === 0) return;
    
    if (guess.length !== 5) {
        showError("Please enter a 5-letter word");
        return;
    }
    
    var validList = validWords.length > 0 ? validWords : fallbackWords;
    if (!validList.includes(guess)) {
        showError('"' + guess + '" is not in the word list. Try another word!');
        input.value = "";
        input.focus();
        return;
    }
    
    if (guessedWordsThisRound.has(guess)) {
        document.getElementById("duplicateWordModal").style.display = "flex";
        input.value = "";
        input.focus();
        return;
    }
    
    // Pro+ Mode: Validate guess respects arrow constraints
    if (!validateProPlusGuess(guess)) {
        showError("Pro+ Mode: Your guess must follow the arrow clues from your previous guess.");
        input.value = "";
        input.focus();
        return;
    }
    
    guessedWordsThisRound.add(guess);

    guessCount++;
    
    // PRO MODE: No streak tracking - unlimited play model
    
    usedLetters.clear();
    
    for (var i = 0; i < guess.length; i++) {
        usedLetters.add(guess[i]);
    }
    updateAlphabetDisplay();

    var feedback = "";
    var spacedFeedback = "";
    for (var i = 0; i < 5; i++) {
        var g = guess[i];
        var t = targetWord[i];
        
        if (g === t) {
            feedback += "●";
            spacedFeedback += "● ";
        } else if (g < t) {
            feedback += "►";
            spacedFeedback += "▶ ";
        } else {
            feedback += "◄";
            spacedFeedback += "◀ ";
        }
    }
    spacedFeedback = spacedFeedback.trim();
    guessHistory.push(spacedFeedback);

    var feedbackDiv = document.getElementById("feedback");
    var feedbackLine = document.createElement("div");
    feedbackLine.className = "feedback-line";
    
    var arrowSpans = "";
    for (var j = 0; j < feedback.length; j++) {
        var letter = guess[j];
        var symbolClass = feedback[j] === "●" ? "correct" : (feedback[j] === "►" ? "later" : "earlier");
        arrowSpans += '<div class="symbol-with-letter">';
        arrowSpans += '<span class="background-letter">' + letter + '</span>';
        arrowSpans += '<span class="overlay-symbol ' + symbolClass + '" data-position="' + j + '">' + feedback[j] + '</span>';
        arrowSpans += '</div>';
    }
    
    // Make word clickable for definition
    feedbackLine.innerHTML = "<span style=\"color: #bbb; margin-right: 8px;\">" + guessCount + ")</span> <span class=\"feedback-word\" onclick=\"showWordDefinitionModal('" + guess + "')\">" + guess + "</span> <div class=\"feedback-arrows\">" + arrowSpans + "</div>";
    feedbackDiv.insertBefore(feedbackLine, feedbackDiv.firstChild);
    
    // Remove placeholder demo after first guess
    var placeholder = document.getElementById("placeholderGuess");
    if (placeholder) {
        placeholder.remove();
    }
    
    // Mark all previous guesses as inactive (muted styling)
    var allLines = feedbackDiv.querySelectorAll('.feedback-line');
    allLines.forEach(function(line, index) {
        if (index > 0) { // Skip first line (latest guess)
            line.classList.add('inactive-guess');
        }
    });
    
    // Attach AlphaHint handlers to latest guess only
    attachAlphaHintHandlers();
    
    input.value = "";
    input.focus();

    if (guess === targetWord) {
        var roundData = {
            word: targetWord,
            score: currentScore,
            guesses: guessCount,
            pattern: guessCount > 1 ? guessHistory[guessHistory.length - 2] : guessHistory[0]
        };
        roundResults.push(roundData);
        
        totalScore += currentScore;
        currentScore = 0; // Reset to prevent double-counting in display
        guessCount = 0; // Reset to prevent double-counting in total guesses display
        updateScoreDisplay();
        
        setTimeout(() => {
            showSuccessModal();
        }, 1500);
    } else {
        currentScore = Math.max(0, 100 - guessCount * 10);
        updateScoreDisplay();
        saveGameState();
        
        if (currentScore === 0) {
            setTimeout(() => {
                showZeroScoreModal();
            }, 500);
        }
    }
}

// LENIENT STREAK SYSTEM
function trackFirstGuess() {
    var today = getLocalGameDay();
    var gameStartedDay = localStorage.getItem('directionary_base_gameStartedDay');
    var gameCompletedDay = localStorage.getItem('directionary_base_gameCompletedDay');
    var lastStreakDay = localStorage.getItem('directionary_base_lastStreakDay');
    
    // Check for abandonment from previous day
    if (gameStartedDay && gameStartedDay != today) {
        // Started on a different day
        if (!gameCompletedDay || gameCompletedDay != gameStartedDay) {
            // Never completed that day = ABANDONMENT
            console.log("⚠️ Abandonment detected - resetting streak");
            playerStats.currentStreak = 0;
            saveStats();
        }
    }
    
    // Mark game started today
    localStorage.setItem('directionary_base_gameStartedDay', today);
    localStorage.removeItem('directionary_base_gameCompletedDay');
    
    // Increment streak if new day
    if (lastStreakDay != today) {
        playerStats.currentStreak++;
        localStorage.setItem('directionary_base_lastStreakDay', today);
        
        if (playerStats.currentStreak > playerStats.maxStreak) {
            playerStats.maxStreak = playerStats.currentStreak;
        }
        
        saveStats();
        // updateStreakDisplay();  // PRO MODE: No streaks - unlimited play model
        console.log("🔥 Streak incremented:", playerStats.currentStreak);
    }
}

// AlphaHint™ - COMPLETE IMPLEMENTATION
function attachAlphaHintHandlers() {
    // AlphaHint not available in Pro+ mode
    if (gameMode === 'proplus') return;
    
    var feedbackDiv = document.getElementById("feedback");
    var allLines = feedbackDiv.querySelectorAll('.feedback-line');
    
    // Remove handlers from PREVIOUS guesses only (not latest)
    allLines.forEach(function(line, index) {
        // Skip the first line (latest guess - index 0)
        if (index === 0) return;
        
        var containers = line.querySelectorAll('.symbol-with-letter');
        containers.forEach(function(container) {
            // Remove pointer cursor from old guesses
            container.style.cursor = 'default';
            // Clone and replace to remove all event listeners
            var newContainer = container.cloneNode(true);
            container.parentNode.replaceChild(newContainer, container);
        });
    });
    
    // Attach handlers ONLY to the LATEST guess (first child, most recent)
    var latestLine = feedbackDiv.firstElementChild;
    if (!latestLine || !latestLine.classList.contains('feedback-line')) return;
    
    var containers = latestLine.querySelectorAll('.symbol-with-letter');
    
    containers.forEach(function(container) {
        var symbol = container.querySelector('.overlay-symbol');
        if (!symbol) return;
        
        // Only attach to arrows, not dots
        var symbolText = symbol.textContent.trim();
        if (symbolText === '●') {
            container.style.cursor = 'default';
            return; // Skip green dots
        }
        
        // Show pointer cursor on entire container (letter + arrow)
        container.style.cursor = 'pointer';
        
        var position = parseInt(symbol.getAttribute('data-position'));
        
        // Mouse events on entire container
        container.addEventListener('mousedown', function(e) {
            e.preventDefault();
            showAlphaHint(position);
        });
        
        container.addEventListener('mouseup', clearAlphaHint);
        container.addEventListener('mouseleave', clearAlphaHint);
        
        // Touch events on entire container
        container.addEventListener('touchstart', function(e) {
            e.preventDefault();
            showAlphaHint(position);
        });
        
        container.addEventListener('touchend', clearAlphaHint);
        container.addEventListener('touchcancel', clearAlphaHint);
    });
}

function showAlphaHint(position) {
    // Get all feedback lines
    var feedbackDiv = document.getElementById("feedback");
    var allLines = feedbackDiv.querySelectorAll('.feedback-line');
    
    // Collect constraints for this position from ALL guesses
    var lowerBound = null; // Highest letter with ►
    var upperBound = null; // Lowest letter with ◄
    var solved = null; // If any guess has ●
    
    allLines.forEach(function(line) {
        var wordSpan = line.querySelector('.feedback-word');
        if (!wordSpan) return;
        var word = wordSpan.textContent;
        var symbols = line.querySelectorAll('.overlay-symbol');
        
        if (symbols[position]) {
            var symbol = symbols[position].textContent.trim();
            var letter = word[position];
            
            if (symbol === '●') {
                solved = letter;
            } else if (symbol === '►' || symbol === '▶') {
                // Target is AFTER this letter
                if (!lowerBound || letter > lowerBound) {
                    lowerBound = letter;
                }
            } else if (symbol === '◄' || symbol === '◀') {
                // Target is BEFORE this letter
                if (!upperBound || letter < upperBound) {
                    upperBound = letter;
                }
            }
        }
    });
    
    // Hide invalid letters in alphabet (instead of highlighting valid ones)
    var alphabetDiv = document.getElementById("alphabetDisplay");
    var letters = alphabetDiv.querySelectorAll('span');
    
    // Add hint-active class to remove bold from all letters
    alphabetDiv.classList.add('hint-active');
    
    if (solved) {
        // Hide all letters except the solved one
        letters.forEach(function(span) {
            if (span.textContent !== solved) {
                span.classList.add('hint-hidden');
            }
        });
    } else {
        // Hide invalid letters (keep valid range visible)
        letters.forEach(function(span) {
            var letter = span.textContent;
            var valid = true;
            
            if (lowerBound && letter <= lowerBound) valid = false;
            if (upperBound && letter >= upperBound) valid = false;
            
            if (!valid) {
                span.classList.add('hint-hidden');
            }
        });
    }
    
    // Highlight constraint arrows in previous guesses
    allLines.forEach(function(line) {
        var wordSpan = line.querySelector('.feedback-word');
        if (!wordSpan) return;
        var word = wordSpan.textContent;
        var symbols = line.querySelectorAll('.overlay-symbol');
        
        if (symbols[position]) {
            var letter = word[position];
            if (letter === lowerBound || letter === upperBound) {
                symbols[position].classList.add('hint-constraint');
            }
        }
    });
    
    // Update AlphaHint text to show which position
    var alphahintText = document.querySelector('.alphahint-text');
    if (alphahintText) {
        var ordinals = ['1st', '2nd', '3rd', '4th', '5th'];
        alphahintText.textContent = 'Options for the ' + ordinals[position] + ' letter';
        // Enlarge text like in placeholder demo
        alphahintText.classList.add('demo-active');
    }
}

function clearAlphaHint() {
    // Remove alphabet hidden classes
    var alphabetDiv = document.getElementById("alphabetDisplay");
    
    // Remove hint-active class to restore bold on used letters
    alphabetDiv.classList.remove('hint-active');
    
    var letters = alphabetDiv.querySelectorAll('span');
    letters.forEach(function(span) {
        span.classList.remove('hint-hidden');
    });
    
    // Remove constraint highlights
    var feedbackDiv = document.getElementById("feedback");
    var allSymbols = feedbackDiv.querySelectorAll('.overlay-symbol');
    allSymbols.forEach(function(symbol) {
        symbol.classList.remove('hint-constraint');
    });
    
    // Reset AlphaHint text to default
    var alphahintText = document.querySelector('.alphahint-text');
    if (alphahintText) {
        alphahintText.textContent = 'AlphaHint™: Hold arrow for letter options';
        // Remove enlarged state
        alphahintText.classList.remove('demo-active');
    }
}

function showError(message) {
    var errorDiv = document.getElementById("errorMessage");
    errorDiv.innerHTML = '<div class="error-message">' + message + '</div>';
    setTimeout(() => { errorDiv.innerHTML = ""; }, 3000);
}

function showSuccessModal() {
    // Get the score from the just-saved roundData (currentScore was reset to 0)
    var lastRoundScore = roundResults.length > 0 ? roundResults[roundResults.length - 1].score : 0;
    
    document.getElementById("modalWord").textContent = targetWord;
    document.getElementById("modalScore").textContent = lastRoundScore;
    document.getElementById("modalTotal").textContent = totalScore;
    
    if (typeof gtag === 'function') {
        gtag('event', 'round_complete', {
            'round_number': currentRound,
            'score': lastRoundScore,
            'guesses_used': roundResults.length > 0 ? roundResults[roundResults.length - 1].guesses : 0,
            'target_word': targetWord
        });
    }
    
    var titleElement = document.querySelector("#successModal .success-title");
    if (currentRound >= maxRounds) {
        titleElement.textContent = "YOU WIN!";
    } else {
        titleElement.textContent = "Correct!";
    }
    
    // Fetch and store definition
    document.getElementById("modalDefWord").textContent = targetWord.toLowerCase();
    document.getElementById("modalDefText").textContent = 'Loading definition...';
    
    fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + targetWord.toLowerCase())
        .then(response => {
            if (!response.ok) {
                throw new Error('Definition not found');
            }
            return response.json();
        })
        .then(data => {
            if (data && data[0] && data[0].meanings && data[0].meanings[0]) {
                var meaning = data[0].meanings[0];
                var partOfSpeech = meaning.partOfSpeech || '';
                var definition = meaning.definitions[0].definition || 'Definition not available';
                
                var fullDef = (partOfSpeech ? '(' + partOfSpeech + ') ' : '') + definition;
                document.getElementById("modalDefText").textContent = fullDef;
                
                // Store for reuse in daily complete modal
                lastFetchedDefinition = {
                    word: targetWord,
                    text: fullDef
                };
            } else {
                document.getElementById("modalDefText").textContent = 'Definition not available';
                lastFetchedDefinition = null;
            }
        })
        .catch(error => {
            console.log('Dictionary API error:', error);
            document.getElementById("modalDefText").textContent = 'Definition not available';
            lastFetchedDefinition = null;
        });
    
    if (currentRound >= maxRounds) {
        document.querySelector("#successModal .success-btn").textContent = "View Results";
    } else {
        document.querySelector("#successModal .success-btn").textContent = "Next Round →";
    }
    
    document.getElementById("successModal").style.display = "flex";
    
    document.getElementById("guessInput").disabled = true;
    document.getElementById("submitBtn").disabled = true;
    document.getElementById("giveUpBtn").disabled = true;
}

function showDailyCompleteModal() {
    if (typeof gtag === 'function') {
        gtag('event', 'daily_complete', {
            'game_version': gameMode === 'proplus' ? 'proplus' : 'pro',
            'total_score': totalScore,
            'rounds_completed': roundResults.length,
            'game_day': dailyNumber
        });
    }
    
    // PRO MODE: No streak tracking - unlimited play model
    
    // PRO MODE: Increment play count for current mode BEFORE showing buttons
    if (gameMode === 'proplus') {
        playCountProPlus++;
        localStorage.setItem('directionary_proplus_playCount', playCountProPlus);
        console.log("Pro+ game complete - playCount now:", playCountProPlus);
    } else {
        playCount++;
        localStorage.setItem('directionary_pro_playCount', playCount);
        console.log("Pro game complete - playCount now:", playCount);
    }
    
    // Apply Pro+ 2x score multiplier for stats tracking
    var displayScore = totalScore;
    if (gameMode === 'proplus') {
        displayScore = totalScore * 2;
    }
    
    // Update stats with the final score (including Pro+ multiplier)
    updateStats(displayScore);
    
    // Clear game state so Play Again starts fresh
    clearGameState();
    if (gameMode === 'proplus') {
        displayScore = totalScore * 2;
    }
    
    document.getElementById("finalScore").textContent = displayScore;
    
    var modalTitle = document.querySelector("#dailyCompleteModal .success-title");
    if (totalScore === 0) {
        modalTitle.textContent = "Game Over!";
        modalTitle.style.background = "linear-gradient(135deg, #dc3545 0%, #c82333 100%)";
        modalTitle.style.webkitBackgroundClip = "text";
        modalTitle.style.webkitTextFillColor = "transparent";
    } else if (gameMode === 'proplus') {
        modalTitle.textContent = "🏆 PRO+ Game Complete!";
    } else if (totalScore < 150) {
        modalTitle.textContent = "PRO Game Complete";
    } else {
        modalTitle.textContent = "🏆 PRO Game Complete!";
    }
    
    var summary = "";
    var totalGuesses = 0;
    
    if (roundResults.length > 0) {
        summary += '<div style="display: grid; grid-template-columns: 1fr auto; gap: 15px; align-items: center; max-width: 300px; margin: 0 auto;">';
        
        for (var i = 0; i < roundResults.length; i++) {
            var result = roundResults[i];
            totalGuesses += result.guesses;
            
            summary += '<div style="text-align: left;"><a href="https://www.dictionary.com/browse/' + result.word.toLowerCase() + '" target="_blank" style="color: #667eea; text-decoration: underline; font-weight: 600;">' + result.word + '</a></div>';
            
            if (result.score === 0) {
                summary += '<div style="text-align: right; color: #e53e3e;">Skipped</div>';
            } else {
                summary += '<div style="text-align: right; color: #666;">' + result.guesses + ' guess' + (result.guesses === 1 ? '' : 'es') + '</div>';
            }
        }
        
        summary += '<div style="text-align: left; font-weight: 700; color: #667eea; border-top: 2px solid #ddd; padding-top: 10px; margin-top: 5px;">TOTAL GUESSES</div>';
        summary += '<div style="text-align: right; font-weight: 700; color: #667eea; border-top: 2px solid #ddd; padding-top: 10px; margin-top: 5px;">' + totalGuesses + '</div>';
        
        summary += '</div>';
        
        // Pro+ score display (show 2x multiplier)
        if (gameMode === 'proplus' && totalScore > 0) {
            summary += '<div style="margin-top: 20px; padding: 15px; background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border-radius: 12px;">';
            summary += '<div style="font-weight: 700; color: #667eea; margin-bottom: 8px;">🏆 PRO+ Bonus</div>';
            summary += '<div style="display: grid; grid-template-columns: 1fr auto; gap: 10px; max-width: 200px; margin: 0 auto;">';
            summary += '<div>Base Score:</div><div style="font-weight: 600;">' + totalScore + '</div>';
            summary += '<div>PRO+ Multiplier:</div><div style="font-weight: 600;">×2</div>';
            summary += '<div style="border-top: 2px solid #667eea; padding-top: 8px; font-weight: 700; color: #667eea;">Final Score:</div>';
            summary += '<div style="border-top: 2px solid #667eea; padding-top: 8px; font-weight: 700; color: #667eea;">' + displayScore + '</div>';
            summary += '</div></div>';
        }
        
        // Add Play Again buttons
        var currentMode = gameMode === 'proplus' ? 'PRO+' : 'PRO';
        var otherMode = gameMode === 'proplus' ? 'PRO' : 'PRO+';
        
        summary += '<div style="margin-top: 25px; display: flex; flex-direction: column; gap: 12px;">';
        summary += '<button onclick="playAgainSameMode()" style="padding: 16px 24px; font-size: 1.1em; font-weight: 700; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">▶ Play Another ' + currentMode + ' Game</button>';
        summary += '<button onclick="playAgainOtherMode()" style="padding: 14px 24px; font-size: 1em; font-weight: 600; background: white; color: #667eea; border: 2px solid #667eea; border-radius: 12px; cursor: pointer;">Try ' + otherMode + ' Mode</button>';
        summary += '</div>';
    } else {
        summary = "No rounds completed<br>";
    }
    document.getElementById("roundSummary").innerHTML = summary;
    
    document.getElementById("dailyCompleteModal").style.display = "flex";
}

function playAgainSameMode() {
    console.log("Play Again: Same mode (" + gameMode + ")");
    
    // Close modal
    document.getElementById("dailyCompleteModal").style.display = "none";
    
    // Play counts already incremented in showDailyCompleteModal
    // Just reset and start new game
    resetGame();
    
    if (typeof gtag === 'function') {
        gtag('event', 'play_again_same_mode', {
            'game_version': gameMode === 'proplus' ? 'proplus' : 'pro',
            'play_count': gameMode === 'proplus' ? playCountProPlus : playCount
        });
    }
}

function playAgainOtherMode() {
    console.log("Play Again: Switching to other mode");
    
    // Close modal
    document.getElementById("dailyCompleteModal").style.display = "none";
    
    // Switch to other mode
    var newMode = (gameMode === 'proplus') ? 'pro' : 'proplus';
    performModeSwitch(newMode);
    
    if (typeof gtag === 'function') {
        gtag('event', 'play_again_switch_mode', {
            'from_mode': gameMode,
            'to_mode': newMode
        });
    }
}

function showComeBackMessage() {
    var instructions = document.querySelector(".instructions-brief");
    if (!instructions) {
        instructions = document.querySelector(".instructions");
    }
    if (instructions) {
        instructions.innerHTML = "<strong>✨ You've completed today's challenge! Return after midnight for tomorrow's game.</strong>";
        instructions.style.background = "linear-gradient(135deg, #667eea15 0%, #764ba215 100%)";
    }
    
    usedLetters.clear();
    var alphabetDiv = document.getElementById("alphabetDisplay");
    if (alphabetDiv) {
        var spans = alphabetDiv.getElementsByTagName("span");
        for (var i = 0; i < spans.length; i++) {
            spans[i].classList.remove("used-letter");
        }
    }
    
    document.getElementById("guessInput").style.display = "none";
    document.querySelector(".button-group").style.display = "none";
    
    var feedbackDiv = document.getElementById("feedback");
    feedbackDiv.innerHTML = '<div id="countdownTimer" style="text-align: center; padding: 25px 30px; font-size: 2em; color: #00ff41; font-weight: 700; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); border-radius: 15px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.5), 0 4px 15px rgba(0,0,0,0.3); font-family: \'Courier New\', Courier, monospace; letter-spacing: 0.1em; text-shadow: 0 0 10px rgba(0,255,65,0.5), 0 0 20px rgba(0,255,65,0.3);"></div>';
    startCountdownTimer();
    
    if (roundResults.length > 0) {
        var buttonGroup = document.querySelector(".button-group");
        var wordsDiv = document.createElement("div");
        wordsDiv.id = "todaysWordsDisplay";
        wordsDiv.style.cssText = "text-align: center; padding: 15px 20px; background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); margin: 15px 0;";
        
        var html = '<h3 style="margin: 0 0 12px 0; color: #667eea; font-size: 1.1em;">Today\'s Words</h3>';
        html += '<div style="display: grid; grid-template-columns: 1fr auto; gap: 10px 20px; max-width: 250px; margin: 0 auto;">';
        
        for (var i = 0; i < roundResults.length; i++) {
            var word = roundResults[i].word;
            var guesses = roundResults[i].guesses;
            var dictUrl = 'https://www.dictionary.com/browse/' + word.toLowerCase();
            
            html += '<div style="text-align: left;"><a href="' + dictUrl + '" target="_blank" style="text-decoration: underline; color: #667eea; font-weight: 600; font-size: 1.1em;">' + word + '</a></div>';
            html += '<div style="text-align: right; color: #666; font-size: 0.95em;">' + guesses + ' guess' + (guesses !== 1 ? 'es' : '') + '</div>';
        }
        
        html += '</div>';
        wordsDiv.innerHTML = html;
        buttonGroup.parentNode.insertBefore(wordsDiv, buttonGroup.nextSibling);
    }
}

function startCountdownTimer() {
    function updateCountdown() {
        var now = new Date();
        var tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        var timeUntilMidnight = tomorrow - now;

        if (timeUntilMidnight <= 1000) {
            console.log("⏰ Midnight reached! Reloading for new puzzle...");
            // Set to TOMORROW's day (current + 1) since we're reloading into the new day
            var tomorrowDay = getLocalGameDay() + 1;
            localStorage.setItem('directionary_base_currentDay', tomorrowDay);
            location.reload();
            return;
        }
        
        var hours = Math.floor(timeUntilMidnight / (1000 * 60 * 60));
        var minutes = Math.floor((timeUntilMidnight % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((timeUntilMidnight % (1000 * 60)) / 1000);
        
        var countdownEl = document.getElementById("countdownTimer");
        if (countdownEl) {
            countdownEl.innerHTML = '<span style="color: #FF9F00; font-size: 0.5em; text-shadow: 0 0 8px rgba(255,159,0,0.4);">Next puzzle in:</span><br>' + 
                String(hours).padStart(2, '0') + ':' + 
                String(minutes).padStart(2, '0') + ':' + 
                String(seconds).padStart(2, '0');
        }
    }
    
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

function showAlreadyPlayedMessage() {
    loadStats();
    var savedState = localStorage.getItem('directionary_base_dailyState');
    if (savedState) {
        var state = JSON.parse(savedState);
        roundResults = state.roundResults || [];
        totalScore = state.totalScore || 0;
        currentScore = 0; // Set to 0 since game is complete
    }
    
    updateScoreDisplay(); // Update the score display with correct totals
    
    var instructions = document.querySelector(".instructions-brief");
    if (!instructions) {
        instructions = document.querySelector(".instructions");
    }
    if (instructions) {
        instructions.innerHTML = "<strong>✨ You've completed today's challenge! Return tomorrow for a new game.</strong>";
        instructions.style.background = "linear-gradient(135deg, #667eea15 0%, #764ba215 100%)";
    }
    
    usedLetters.clear();
    var alphabetDiv = document.getElementById("alphabetDisplay");
    if (alphabetDiv) {
        var spans = alphabetDiv.getElementsByTagName("span");
        for (var i = 0; i < spans.length; i++) {
            spans[i].classList.remove("used-letter");
        }
    }
    
    // updateStreakDisplay();  // PRO MODE: No streaks - unlimited play model
    
    // Hide AlphaHint instruction text since game is complete
    var alphahintText = document.querySelector(".alphahint-text");
    if (alphahintText) {
        alphahintText.style.display = "none";
    }
    
    document.getElementById("guessInput").style.display = "none";
    document.querySelector(".button-group").style.display = "none";
    
    var feedbackDiv = document.getElementById("feedback");
    feedbackDiv.innerHTML = '<div id="countdownTimer" style="text-align: center; padding: 25px 30px; font-size: 2em; color: #00ff41; font-weight: 700; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); border-radius: 15px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.5), 0 4px 15px rgba(0,0,0,0.3); font-family: \'Courier New\', Courier, monospace; letter-spacing: 0.1em; text-shadow: 0 0 10px rgba(0,255,65,0.5), 0 0 20px rgba(0,255,65,0.3);"></div>';
    startCountdownTimer();
    
    if (roundResults.length > 0) {
        var buttonGroup = document.querySelector(".button-group");
        var wordsDiv = document.createElement("div");
        wordsDiv.style.cssText = "text-align: center; padding: 15px 20px; background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); margin: 15px 0;";
        
        var html = '<h3 style="margin: 0 0 12px 0; color: #667eea; font-size: 1.1em;">Today\'s Words</h3>';
        html += '<div style="display: grid; grid-template-columns: 1fr auto; gap: 10px 20px; max-width: 250px; margin: 0 auto;">';
        
        for (var i = 0; i < roundResults.length; i++) {
            var word = roundResults[i].word;
            var guesses = roundResults[i].guesses;
            var dictUrl = 'https://www.dictionary.com/browse/' + word.toLowerCase();
            
            html += '<div style="text-align: left;"><a href="' + dictUrl + '" target="_blank" style="text-decoration: underline; color: #667eea; font-weight: 600; font-size: 1.1em;">' + word + '</a></div>';
            html += '<div style="text-align: right; color: #666; font-size: 0.95em;">' + guesses + ' guess' + (guesses !== 1 ? 'es' : '') + '</div>';
        }
        
        html += '</div>';
        wordsDiv.innerHTML = html;
        buttonGroup.parentNode.insertBefore(wordsDiv, buttonGroup.nextSibling);
        
        var scoreMessage = document.createElement("div");
        scoreMessage.style.cssText = "text-align: center; margin: 20px 0; font-size: 1.2em; font-weight: 600; color: #667eea;";
        scoreMessage.textContent = "Your Score: " + totalScore + " points";
        wordsDiv.parentNode.insertBefore(scoreMessage, wordsDiv);
    }
}

function generateShareText() {
    // PRO MODE: Show mode in share text, no streak (unlimited play model)
    var modeLabel = gameMode === 'proplus' ? ' PRO+' : ' PRO';
    var text = "Directionary" + modeLabel + " #" + (dailyNumber % 1000);
    text += "\n\n";
    
    for (var i = 0; i < roundResults.length; i++) {
        var result = roundResults[i];
        if (result && result.pattern) {
            var sharePattern = result.pattern
                .replace(/●/g, "🟢")
                .replace(/►/g, "▶️")
                .replace(/▶/g, "▶️")
                .replace(/◄/g, "◀️")
                .replace(/◀/g, "◀️");
            text += sharePattern + "\n";
        }
    }
    
    text += "\nScore: " + totalScore + " out of 300\n\n";
    text += "#WW2W " + GAME_URL;
    
    return text;
}

function toggleShare() {
    closeAllPanels();
    var sharePanel = document.getElementById("sharePanel");
    if (sharePanel.style.display === "flex") {
        closeShare();
    } else {
        showShare();
    }
}

function toggleHelp() {
    if (typeof gtag === 'function') {
        gtag('event', 'modal_open', {'modal_type': 'help'});
    }
    
    closeAllPanels();
    var helpPanel = document.getElementById("helpPanel");
    if (helpPanel.style.display === "flex") {
        closeHelp();
    } else {
        showHelp();
    }
}

function toggleStats() {
    if (typeof gtag === 'function') {
        gtag('event', 'modal_open', {'modal_type': 'stats'});
    }
    
    closeAllPanels();
    var statsPanel = document.getElementById("statsPanel");
    if (statsPanel.style.display === "flex") {
        closeStats();
    } else {
        updateStatsDisplay();
        statsPanel.style.display = "flex";
    }
}

function toggleInfo() {
    if (typeof gtag === 'function') {
        gtag('event', 'modal_open', {'modal_type': 'about'});
    }
    
    closeAllPanels();
    var infoPanel = document.getElementById("infoPanel");
    if (infoPanel.style.display === "flex") {
        closeInfo();
    } else {
        infoPanel.style.display = "flex";
    }
}

function closeAllPanels() {
    document.getElementById("sharePanel").style.display = "none";
    document.getElementById("helpPanel").style.display = "none";
    document.getElementById("statsPanel").style.display = "none";
    document.getElementById("infoPanel").style.display = "none";
    document.getElementById("streakPanel").style.display = "none";
    document.getElementById("wordDefPanel").style.display = "none";
}

function showShare() {
    var shareText = generateShareText();
    document.getElementById("sharePreview").textContent = shareText;
    document.getElementById("sharePanel").style.display = "flex";
}

function closeShare() {
    document.getElementById("sharePanel").style.display = "none";
}

function showHelp() {
    document.getElementById("helpPanel").style.display = "flex";
}

function closeHelp() {
    document.getElementById("helpPanel").style.display = "none";
}

function closeStats() {
    document.getElementById("statsPanel").style.display = "none";
}

function closeInfo() {
    document.getElementById("infoPanel").style.display = "none";
}

// Streak Modal Functions
function openStreakPanel() {
    closeAllPanels();
    
    document.getElementById('streakModalCurrent').textContent = playerStats.currentStreak;
    document.getElementById('streakModalBest').textContent = playerStats.maxStreak;
    
    var lastPlayed = playerStats.lastPlayed;
    var today = Math.floor(Date.now() / 86400000);
    var lastText = lastPlayed === today ? "Today" : 
                   lastPlayed === today - 1 ? "Yesterday" : 
                   lastPlayed ? Math.abs(today - lastPlayed) + " days ago" : "Never";
    document.getElementById('streakModalLast').textContent = lastText;
    
    document.getElementById('streakPanel').style.display = 'flex';
}

function closeStreakPanel() {
    document.getElementById('streakPanel').style.display = 'none';
}

function copyToClipboard() {
    if (typeof gtag === 'function') {
        gtag('event', 'share', {'method': 'clipboard'});
    }
    
    var shareText = document.getElementById("sharePreview").textContent;
    navigator.clipboard.writeText(shareText).then(function() {
        alert("Results copied to clipboard!");
    });
}

function shareToTwitter() {
    if (typeof gtag === 'function') {
        gtag('event', 'share', {'method': 'twitter'});
    }
    
    var shareText = document.getElementById("sharePreview").textContent;
    var tweetUrl = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(shareText);
    window.open(tweetUrl, "_blank");
}

function shareToBluesky() {
    if (typeof gtag === 'function') {
        gtag('event', 'share', {'method': 'bluesky'});
    }
    
    var shareText = document.getElementById("sharePreview").textContent;
    
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        navigator.clipboard.writeText(shareText).then(function() {
            alert("Results copied! Opening Bluesky - paste into your post.");
            window.open("https://bsky.app", "_blank");
        }).catch(function() {
            window.open("https://bsky.app", "_blank");
        });
    } else {
        var blueskyUrl = "https://bsky.app/intent/compose?text=" + encodeURIComponent(shareText);
        window.open(blueskyUrl, "_blank");
    }
}

function shareToFacebook() {
    if (typeof gtag === 'function') {
        gtag('event', 'share', {'method': 'facebook'});
    }
    
    var shareText = document.getElementById("sharePreview").textContent;
    navigator.clipboard.writeText(shareText).then(function() {
        alert("Results copied to clipboard! Paste into your Facebook post.");
        var facebookUrl = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(GAME_URL);
        window.open(facebookUrl, "_blank");
    });
}

function nextWord() {
    document.getElementById("successModal").style.display = "none";
    
    if (currentRound >= maxRounds) {
        clearGameState();
        showDailyCompleteModal();
        return;
    }
    
    currentRound++;
    document.getElementById("feedback").innerHTML = "";
    
    var feedbackDiv = document.getElementById("feedback");
    var newGameLine = document.createElement("div");
    newGameLine.className = "new-game-message";
    newGameLine.innerHTML = "◄ ● Round " + currentRound + " of " + maxRounds + " ● ►";
    feedbackDiv.appendChild(newGameLine);
    
    startNewGame();
    saveGameState();
}

function showZeroScoreModal() {
    document.getElementById("zeroScoreModal").style.display = "flex";
    document.getElementById("guessInput").disabled = true;
    document.getElementById("submitBtn").disabled = true;
    document.getElementById("giveUpBtn").disabled = true;
}

       function skipRound() {
    document.getElementById("zeroScoreModal").style.display = "none";
    roundResults.push({
word: targetWord,
score: 0,
guesses: guessCount,
pattern: guessHistory.length > 0 ? guessHistory[guessHistory.length - 1] : "⚫ ⚫ ⚫ ⚫ ⚫"
    });
    nextWord();
}

function giveUp() {
    // Pro+ Mode: Cannot skip rounds
    if (gameMode === 'proplus') {
        console.log("Pro+ Mode: Skipping not allowed");
        return;
    }
    
    document.getElementById("giveUpModal").style.display = "flex";
    document.getElementById("guessInput").disabled = true;
    document.getElementById("submitBtn").disabled = true;
    document.getElementById("giveUpBtn").disabled = true;
}

function confirmGiveUp() {
    if (typeof gtag === 'function') {
        gtag('event', 'give_up', {
            'round_number': currentRound,
            'guesses_used': guessCount
        });
    }
    
    document.getElementById("giveUpModal").style.display = "none";
    
    var feedbackDiv = document.getElementById("feedback");
    var giveUpMessage = document.createElement("div");
    giveUpMessage.className = "new-game-message";
    giveUpMessage.innerHTML = "The word was: " + targetWord;
    feedbackDiv.appendChild(giveUpMessage);
    
    showDefinition(targetWord);
    
    roundResults.push({
        word: targetWord,
        score: 0,
        guesses: guessCount,
        pattern: guessHistory.length > 0 ? guessHistory[guessHistory.length - 1] : "⚫ ⚫ ⚫ ⚫ ⚫"
    });
    
    setTimeout(() => {
        nextWord();
    }, 4000);
}

function cancelGiveUp() {
    document.getElementById("giveUpModal").style.display = "none";
    document.getElementById("guessInput").disabled = false;
    document.getElementById("submitBtn").disabled = false;
    document.getElementById("giveUpBtn").disabled = false;
    document.getElementById("guessInput").focus();
}

function closeDuplicateModal() {
    document.getElementById("duplicateWordModal").style.display = "none";
    document.getElementById("guessInput").focus();
}

function showPlaceholderModal() {
    document.getElementById("placeholderModal").style.display = "flex";
}

function closePlaceholderModal() {
    document.getElementById("placeholderModal").style.display = "none";
    document.getElementById("guessInput").focus();
}

function closeSuccessModal() {
    document.getElementById("successModal").style.display = "none";
    document.getElementById("guessInput").focus();
}

function closeZeroScoreModal() {
    document.getElementById("zeroScoreModal").style.display = "none";
    document.getElementById("guessInput").focus();
}

function viewResults() {
    document.getElementById("dailyCompleteModal").style.display = "none";
    toggleShare();
}

function closeDailyModal() {
    document.getElementById("dailyCompleteModal").style.display = "none";
}

function loadStats() {
    var saved = localStorage.getItem('directionary_base_Stats');
    if (saved) {
        playerStats = JSON.parse(saved);
    }
}

function saveStats() {
    localStorage.setItem('directionary_base_Stats', JSON.stringify(playerStats));
}

function updateStats(score) {
    // Determine which mode's stats to update
    var modeStats = gameMode === 'proplus' ? playerStats.proplus : playerStats.pro;
    var firstDateKey = gameMode === 'proplus' ? 'firstProPlusGameDate' : 'firstProGameDate';
    
    // Set first played date if not set
    if (!playerStats[firstDateKey]) {
        playerStats[firstDateKey] = getDateKey();
    }
    
    // Get current time keys
    var dayKey = getDateKey();
    var weekKey = getWeekKey();
    var monthKey = getMonthKey();
    var yearKey = getYearKey();
    
    // Check if we need to reset any time windows
    if (modeStats.currentDay !== dayKey) {
        modeStats.dailyTotal = 0;
        modeStats.currentDay = dayKey;
    }
    
    if (modeStats.currentWeek !== weekKey) {
        modeStats.weeklyTotal = 0;
        modeStats.currentWeek = weekKey;
    }
    
    if (modeStats.currentMonth !== monthKey) {
        modeStats.monthlyTotal = 0;
        modeStats.currentMonth = monthKey;
    }
    
    if (modeStats.currentYear !== yearKey) {
        // Archive previous year before resetting
        if (modeStats.currentYear && modeStats.annualTotal > 0) {
            modeStats.yearlyArchive[modeStats.currentYear] = {
                total: modeStats.annualTotal,
                games: modeStats.gamesPlayed  // Snapshot of games at year end
            };
        }
        modeStats.annualTotal = 0;
        modeStats.currentYear = yearKey;
    }
    
    // Add score to all time windows
    modeStats.dailyTotal += score;
    modeStats.weeklyTotal += score;
    modeStats.monthlyTotal += score;
    modeStats.annualTotal += score;
    modeStats.totalScore += score;
    modeStats.gamesPlayed++;
    
    // Update best score
    if (score > modeStats.bestScore) {
        modeStats.bestScore = score;
    }
    
    saveStats();
    updateStatsDisplay();
}

function updateStatsDisplay() {
    // Format number with commas
    function formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    
    // Update first played dates
    document.getElementById('firstProDate').textContent = formatDateForDisplay(playerStats.firstProGameDate);
    document.getElementById('firstProPlusDate').textContent = formatDateForDisplay(playerStats.firstProPlusGameDate);
    
    // PRO MODE stats
    document.getElementById('proGamesPlayed').textContent = formatNumber(playerStats.pro.gamesPlayed);
    document.getElementById('proBestScore').textContent = formatNumber(playerStats.pro.bestScore);
    document.getElementById('proTotalScore').textContent = formatNumber(playerStats.pro.totalScore);
    document.getElementById('proDailyTotal').textContent = formatNumber(playerStats.pro.dailyTotal);
    document.getElementById('proWeeklyTotal').textContent = formatNumber(playerStats.pro.weeklyTotal);
    document.getElementById('proMonthlyTotal').textContent = formatNumber(playerStats.pro.monthlyTotal);
    document.getElementById('proAnnualTotal').textContent = formatNumber(playerStats.pro.annualTotal);
    
    // PRO MODE yearly archive
    var proArchiveHtml = '';
    var proYears = Object.keys(playerStats.pro.yearlyArchive).sort().reverse();
    for (var i = 0; i < proYears.length; i++) {
        var year = proYears[i];
        var data = playerStats.pro.yearlyArchive[year];
        proArchiveHtml += '<div class="archive-year">' + year + ': ' + formatNumber(data.total) + '</div>';
    }
    document.getElementById('proYearlyArchive').innerHTML = proArchiveHtml || '<div class="no-archive">No archived years</div>';
    
    // PRO+ MODE stats
    document.getElementById('proplusGamesPlayed').textContent = formatNumber(playerStats.proplus.gamesPlayed);
    document.getElementById('proplusBestScore').textContent = formatNumber(playerStats.proplus.bestScore);
    document.getElementById('proplusTotalScore').textContent = formatNumber(playerStats.proplus.totalScore);
    document.getElementById('proplusDailyTotal').textContent = formatNumber(playerStats.proplus.dailyTotal);
    document.getElementById('proplusWeeklyTotal').textContent = formatNumber(playerStats.proplus.weeklyTotal);
    document.getElementById('proplusMonthlyTotal').textContent = formatNumber(playerStats.proplus.monthlyTotal);
    document.getElementById('proplusAnnualTotal').textContent = formatNumber(playerStats.proplus.annualTotal);
    
    // PRO+ MODE yearly archive
    var proplusArchiveHtml = '';
    var proplusYears = Object.keys(playerStats.proplus.yearlyArchive).sort().reverse();
    for (var i = 0; i < proplusYears.length; i++) {
        var year = proplusYears[i];
        var data = playerStats.proplus.yearlyArchive[year];
        proplusArchiveHtml += '<div class="archive-year">' + year + ': ' + formatNumber(data.total) + '</div>';
    }
    document.getElementById('proplusYearlyArchive').innerHTML = proplusArchiveHtml || '<div class="no-archive">No archived years</div>';
    
    // First played date
    if (playerStats.firstPlayed) {
        document.getElementById('statFirstPlayed').textContent = formatDate(playerStats.firstPlayed);
    }
    
    // Daily total (today)
    var dayKey = getDateKey();
    var dailyStats = playerStats.daily[dayKey] || { games: 0, score: 0, best: 0 };
    document.getElementById('statDailyGames').textContent = dailyStats.games;
    document.getElementById('statDailyScore').textContent = dailyStats.score;
    document.getElementById('statDailyBest').textContent = dailyStats.best;
    
    // Weekly total
    var weekKey = getWeekKey();
    var weeklyStats = playerStats.weekly[weekKey] || { games: 0, score: 0, best: 0 };
    document.getElementById('statWeeklyGames').textContent = weeklyStats.games;
    document.getElementById('statWeeklyScore').textContent = weeklyStats.score;
    document.getElementById('statWeeklyBest').textContent = weeklyStats.best;
    
    // Monthly total
    var monthKey = getMonthKey();
    var monthlyStats = playerStats.monthly[monthKey] || { games: 0, score: 0, best: 0 };
    document.getElementById('statMonthlyGames').textContent = monthlyStats.games;
    document.getElementById('statMonthlyScore').textContent = monthlyStats.score;
    document.getElementById('statMonthlyBest').textContent = monthlyStats.best;
    
    // Annual totals (all years, newest first)
    var yearsContainer = document.getElementById('annualStatsContainer');
    if (yearsContainer) {
        var years = Object.keys(playerStats.annual).sort().reverse(); // Newest first
        var html = '';
        years.forEach(function(year) {
            var stats = playerStats.annual[year];
            var avgScore = stats.games > 0 ? Math.round(stats.score / stats.games) : 0;
            html += '<div class="annual-year-block">';
            html += '<h4>' + year + '</h4>';
            html += '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; text-align: center;">';
            html += '<div><strong>' + stats.games + '</strong><br>Games</div>';
            html += '<div><strong>' + stats.score + '</strong><br>Total Score</div>';
            html += '<div><strong>' + stats.best + '</strong><br>Best Score</div>';
            html += '</div>';
            html += '</div>';
        });
        yearsContainer.innerHTML = html || '<p style="color: #999;">No annual stats yet</p>';
    }
}

function formatDate(dateStr) {
    // Input: "YYYY-MM-DD", Output: "Jan 15, 2026"
    var parts = dateStr.split('-');
    var year = parts[0];
    var month = parseInt(parts[1]) - 1;
    var day = parseInt(parts[2]);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month] + ' ' + day + ', ' + year;
}

function updateStreakDisplay() {
    document.getElementById('streakDisplay').textContent = playerStats.currentStreak;
}

function saveGameState() {
    if (devMode || testMode) return;
    
    var state = {
        gameDay: dailyNumber,
        currentRound: currentRound,
        currentScore: currentScore,
        totalScore: totalScore,
        guessCount: guessCount,
        targetWord: targetWord,
        guessHistory: guessHistory,
        feedbackHtml: document.getElementById("feedback").innerHTML,
        roundResults: roundResults,
        usedLetters: Array.from(usedLetters),
        guessedWordsThisRound: Array.from(guessedWordsThisRound),
        timestamp: Date.now()
    };
    
    try {
        localStorage.setItem('directionary_base_gameState', JSON.stringify(state));
        console.log("💾 Game state saved");
    } catch (e) {
        console.log("Could not save game state:", e);
    }
}

function loadGameState() {
    if (devMode || testMode) return null;
    
    try {
        var saved = localStorage.getItem('directionary_base_gameState');
        if (!saved) return null;
        
        var state = JSON.parse(saved);
        
        if (state.gameDay !== dailyNumber) {
            console.log("Saved game is from different day, starting fresh");
            clearGameState();
            return null;
        }
        
        var lastPlayed = localStorage.getItem('directionary_base_lastPlayed');
        if (lastPlayed == dailyNumber) {
            console.log("Game already completed today");
            return null;
        }
        
        console.log("📂 Restoring game state from Round", state.currentRound);
        return state;
    } catch (e) {
        console.log("Could not load game state:", e);
        return null;
    }
}

function clearGameState() {
    try {
        localStorage.removeItem('directionary_base_gameState');
        console.log("🗑️ Game state cleared");
    } catch (e) {
        console.log("Could not clear game state:", e);
    }
}

function restoreGameState(state) {
    currentRound = state.currentRound;
    currentScore = state.currentScore;
    totalScore = state.totalScore;
    guessCount = state.guessCount;
    targetWord = state.targetWord;
    guessHistory = state.guessHistory || [];
    roundResults = state.roundResults || [];
    usedLetters = new Set(state.usedLetters || []);
    guessedWordsThisRound = new Set(state.guessedWordsThisRound || []);
    
    updateScoreDisplay();
    updateAlphabetDisplay();
    
    var feedbackDiv = document.getElementById("feedback");
    if (state.feedbackHtml) {
        feedbackDiv.innerHTML = state.feedbackHtml;
    } else {
        feedbackDiv.innerHTML = "";
    }
    
    // Reattach AlphaHint handlers after restoring
    attachAlphaHintHandlers();
    
    console.log("✅ Game state restored: Round " + currentRound + ", Score " + totalScore + ", " + guessCount + " guesses");
}

function resetGame() {
    console.log("resetGame: Starting game reset");
    
    // Clear game state variables
    currentRound = 1;
    totalScore = 0;
    guessCount = 0;
    roundResults = [];
    guessHistory = [];
    guessedWordsThisRound.clear();
    usedLetters.clear();
    
    // CRITICAL: Clear saved game state from localStorage
    // Otherwise startNewGame() will restore old game with wrong mode's word!
    clearGameState();
    console.log("resetGame: Saved game state cleared");
    
    // Clear UI
    var feedbackEl = document.getElementById("feedback");
    if (feedbackEl) feedbackEl.innerHTML = "";
    
    var guessInputEl = document.getElementById("guessInput");
    if (guessInputEl) guessInputEl.value = "";
    
    var guessCountEl = document.getElementById("guessCount");
    if (guessCountEl) guessCountEl.textContent = "0";
    
    var currentScoreEl = document.getElementById("currentScore");
    if (currentScoreEl) currentScoreEl.textContent = "100";
    
    var totalScoreEl = document.getElementById("totalScore");
    if (totalScoreEl) totalScoreEl.textContent = "0";
    
    var errorMessageEl = document.getElementById("errorMessage");
    if (errorMessageEl) errorMessageEl.innerHTML = "";
    
    console.log("resetGame: UI elements cleared");
    
    // Re-enable input and buttons
    var inputEl = document.getElementById("guessInput");
    if (inputEl) inputEl.disabled = false;
    
    var submitBtnEl = document.getElementById("submitBtn");
    if (submitBtnEl) submitBtnEl.disabled = false;
    
    var giveUpBtnEl = document.getElementById("giveUpBtn");
    if (giveUpBtnEl) giveUpBtnEl.disabled = false;
    
    console.log("resetGame: Controls re-enabled");
    
    // Then load new word
    console.log("resetGame: Calling loadWordList...");
    loadWordList();
}

// MODE SWITCHING FUNCTIONS

function switchToProMode() {
    if (gameMode === 'pro') return; // Already in Pro mode
    
    if (guessCount > 0) {
        // User has made guesses - show confirmation
        pendingModeSwitch = 'pro';
        document.getElementById('modeSwitchModal').style.display = 'flex';
    } else {
        // No guesses yet - switch immediately
        performModeSwitch('pro');
    }
}

function switchToProPlusMode() {
    if (gameMode === 'proplus') return; // Already in Pro+ mode
    
    if (guessCount > 0) {
        // User has made guesses - show confirmation
        pendingModeSwitch = 'proplus';
        document.getElementById('modeSwitchModal').style.display = 'flex';
    } else {
        // No guesses yet - switch immediately
        performModeSwitch('proplus');
    }
}

function confirmModeSwitch() {
    console.log("Confirm mode switch clicked, pending mode:", pendingModeSwitch);
    
    // Close modal immediately
    var modal = document.getElementById('modeSwitchModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Then perform the switch
    if (pendingModeSwitch) {
        performModeSwitch(pendingModeSwitch);
    }
    
    pendingModeSwitch = null;
    
    // Focus input after switch
    setTimeout(function() {
        document.getElementById("guessInput").focus();
    }, 100);
}

function cancelModeSwitch() {
    console.log("Cancel mode switch clicked");
    document.getElementById('modeSwitchModal').style.display = 'none';
    pendingModeSwitch = null;
    document.getElementById("guessInput").focus();
}

// ABANDON GAME FUNCTIONS (escape hatch for stuck players)

function showAbandonModal() {
    console.log("Abandon game modal opened");
    document.getElementById('abandonGameModal').style.display = 'flex';
    
    if (typeof gtag === 'function') {
        gtag('event', 'abandon_modal_opened', {
            'game_version': gameMode === 'proplus' ? 'proplus' : 'pro',
            'current_round': currentRound,
            'total_guesses': guessCount,
            'current_score': currentScore
        });
    }
}

function closeAbandonModal() {
    console.log("Abandon game modal closed - cancelled");
    document.getElementById('abandonGameModal').style.display = 'none';
    document.getElementById("guessInput").focus();
}

function confirmAbandonGame() {
    console.log("Abandon game confirmed - restarting");
    
    // Close modal
    document.getElementById('abandonGameModal').style.display = 'none';
    
    // Track abandonment (but don't increment play count!)
    if (typeof gtag === 'function') {
        gtag('event', 'game_abandoned', {
            'game_version': gameMode === 'proplus' ? 'proplus' : 'pro',
            'rounds_completed': roundResults.length,
            'current_round': currentRound,
            'total_guesses': guessCount,
            'total_score': totalScore
        });
    }
    
    // Reset game WITHOUT incrementing play count
    // This is key: they didn't complete the game, so don't count it
    console.log("Abandoning game - play count NOT incremented");
    resetGame();
}

function performModeSwitch(newMode) {
    console.log("Performing mode switch from", gameMode, "to", newMode);
    
    gameMode = newMode;
    
    // Update button states
    if (newMode === 'pro') {
        document.getElementById('proModeBtn').classList.add('active');
        document.getElementById('proPlusModeBtn').classList.remove('active');
        document.getElementById('modeDescription').innerHTML = '<strong>PRO Mode:</strong> AlphaHint enabled, bold letters, any guess allowed';
    } else {
        document.getElementById('proPlusModeBtn').classList.add('active');
        document.getElementById('proModeBtn').classList.remove('active');
        document.getElementById('modeDescription').innerHTML = '<strong>PRO+ Mode:</strong> ⭐ <strong>DOUBLE POINTS</strong> ⭐ | No AlphaHint | No skipping rounds | Must follow arrow clues';
    }
    
    // Update AlphaHint text
    updateAlphaHintText(newMode);
    
    // Update Skip button styling
    updateSkipButtonStyling(newMode);
    
    // ALWAYS reload the game when switching modes (word formula is different!)
    console.log("Mode switch: Reloading game with new word formula...");
    resetGame();
    
    // Update alphabet display (safe to do immediately)
    updateAlphabetDisplay();
}

function updateSkipButtonStyling(mode) {
    var giveUpBtn = document.getElementById('giveUpBtn');
    if (giveUpBtn) {
        if (mode === 'proplus') {
            giveUpBtn.style.textDecoration = 'line-through';
            giveUpBtn.style.opacity = '0.5';
            giveUpBtn.style.cursor = 'not-allowed';
            giveUpBtn.title = 'Skipping rounds not allowed in Pro+ mode';
        } else {
            giveUpBtn.style.textDecoration = 'none';
            giveUpBtn.style.opacity = '1';
            giveUpBtn.style.cursor = 'pointer';
            giveUpBtn.title = '';
        }
    }
}

function updateAlphaHintText(mode) {
    var alphaHintText = document.querySelector('.alphahint-text');
    if (alphaHintText) {
        if (mode === 'proplus') {
            alphaHintText.textContent = 'AlphaHint™: Not available in Pro+ mode';
            alphaHintText.style.color = '#999';
            alphaHintText.style.fontStyle = 'italic';
        } else {
            alphaHintText.textContent = 'AlphaHint™: Hold arrow for letter options';
            alphaHintText.style.color = '#666';
            alphaHintText.style.fontStyle = 'normal';
        }
    }
}

window.onload = function() {
    console.log("Directionary loading... [Version: Jan 18, 2026 - Phase 1 Master Base]");
    loadStats();
    // updateStreakDisplay();  // PRO MODE: No streaks - unlimited play model
    initGame();
    
    // Placeholder dots demo - highlight AlphaHint text when held
    var placeholder = document.getElementById("placeholderGuess");
    if (placeholder) {
        var placeholderDots = placeholder.querySelectorAll('.symbol-with-letter');
        var alphahintText = document.querySelector('.alphahint-text');
        
        placeholderDots.forEach(function(dot) {
            // Mouse events
            dot.addEventListener('mousedown', function(e) {
                e.preventDefault();
                if (alphahintText) {
                    alphahintText.classList.add('demo-active');
                }
            });
            
            dot.addEventListener('mouseup', function() {
                if (alphahintText) {
                    alphahintText.classList.remove('demo-active');
                }
            });
            
            dot.addEventListener('mouseleave', function() {
                if (alphahintText) {
                    alphahintText.classList.remove('demo-active');
                }
            });
            
            // Touch events
            dot.addEventListener('touchstart', function(e) {
                e.preventDefault();
                if (alphahintText) {
                    alphahintText.classList.add('demo-active');
                }
            });
            
            dot.addEventListener('touchend', function() {
                if (alphahintText) {
                    alphahintText.classList.remove('demo-active');
                }
            });
            
            dot.addEventListener('touchcancel', function() {
                if (alphahintText) {
                    alphahintText.classList.remove('demo-active');
                }
            });
            
            // Add cursor pointer to show it's interactive
            dot.style.cursor = 'pointer';
        });
    }
    
    // Input validation - only allow A-Z letters
    var guessInput = document.getElementById("guessInput");
    
    guessInput.addEventListener("input", function(event) {
        // Remove anything that's not a letter A-Z
        var cleaned = this.value.replace(/[^A-Za-z]/g, '');
        // Convert to uppercase
        cleaned = cleaned.toUpperCase();
        // Limit to 5 characters
        if (cleaned.length > 5) {
            cleaned = cleaned.substring(0, 5);
        }
        // Update the input if it changed
        if (this.value !== cleaned) {
            this.value = cleaned;
        }
    });
    
    guessInput.addEventListener("keypress", function(event) {
        if (event.key === "Enter" && !this.disabled) {
            event.preventDefault();
            submitGuess();
        }
    });
    
    document.getElementById("submitBtn").addEventListener("click", function() {
        if (!this.disabled) {
            submitGuess();
        }
    });
    
    document.getElementById("giveUpBtn").addEventListener("click", function() {
        if (!this.disabled) {
            giveUp();
        }
    });
};

function reloadDevGame() {
    if (!devMode) return;
    
    console.log("🔄 DEV MODE: Reloading game with new words...");
    
    currentRound = 1;
    totalScore = 0;
    roundResults = [];
    guessHistory = [];
    
    document.getElementById("feedback").innerHTML = "";
    updateScoreDisplay();
    
    startNewGame();
}

document.addEventListener('keydown', function(e) {
    // ENTER KEY - Check input first, then handle modals/panels
    if (e.key === 'Enter') {
        var guessInput = document.getElementById('guessInput');
        
        // If input has focus and is enabled, let it submit naturally
        if (guessInput && document.activeElement === guessInput && !guessInput.disabled) {
            return;
        }
        
        e.preventDefault(); // Prevent any default Enter behavior
        
        // Check all modals (in priority order)
        var successModal = document.getElementById('successModal');
        if (successModal && successModal.style.display === 'flex') {
            nextWord();
            return;
        }
        
        var completeModal = document.getElementById('dailyCompleteModal');
        if (completeModal && completeModal.style.display === 'flex') {
            // Don't auto-close - has Play Again buttons
            return;
        }
        
        var zeroScoreModal = document.getElementById('zeroScoreModal');
        if (zeroScoreModal && zeroScoreModal.style.display === 'flex') {
            skipRound();
            return;
        }
        
        var giveUpModal = document.getElementById('giveUpModal');
        if (giveUpModal && giveUpModal.style.display === 'flex') {
            cancelGiveUp();
            return;
        }
        
        var modeSwitchModal = document.getElementById('modeSwitchModal');
        if (modeSwitchModal && modeSwitchModal.style.display === 'flex') {
            cancelModeSwitch();
            return;
        }
        
        var abandonModal = document.getElementById('abandonGameModal');
        if (abandonModal && abandonModal.style.display === 'flex') {
            closeAbandonModal();
            return;
        }
        
        var placeholderModal = document.getElementById('placeholderModal');
        if (placeholderModal && placeholderModal.style.display === 'flex') {
            closePlaceholderModal();
            return;
        }
        
        // Check all panels
        var statsPanel = document.getElementById('statsPanel');
        if (statsPanel && statsPanel.style.display === 'flex') {
            closeStats();
            return;
        }
        
        var helpPanel = document.getElementById('helpPanel');
        if (helpPanel && helpPanel.style.display === 'flex') {
            closeHelp();
            return;
        }
        
        var infoPanel = document.getElementById('infoPanel');
        if (infoPanel && infoPanel.style.display === 'flex') {
            closeInfo();
            return;
        }
        
        var sharePanel = document.getElementById('sharePanel');
        if (sharePanel && sharePanel.style.display === 'flex') {
            closeShare();
            return;
        }
        
        var wordDefPanel = document.getElementById('wordDefPanel');
        if (wordDefPanel && wordDefPanel.style.display === 'flex') {
            closeWordDefPanel();
            return;
        }
    }
    
    // ESCAPE KEY - Close any open modal/panel using close() functions
    if (e.key === 'Escape') {
        e.preventDefault();
        
        // Check modals first (higher priority)
        var successModal = document.getElementById('successModal');
        if (successModal && successModal.style.display === 'flex') {
            closeSuccessModal();
            return;
        }
        
        var completeModal = document.getElementById('dailyCompleteModal');
        if (completeModal && completeModal.style.display === 'flex') {
            closeDailyModal();
            return;
        }
        
        var zeroScoreModal = document.getElementById('zeroScoreModal');
        if (zeroScoreModal && zeroScoreModal.style.display === 'flex') {
            closeZeroScoreModal();
            return;
        }
        
        var giveUpModal = document.getElementById('giveUpModal');
        if (giveUpModal && giveUpModal.style.display === 'flex') {
            cancelGiveUp();
            return;
        }
        
        var modeSwitchModal = document.getElementById('modeSwitchModal');
        if (modeSwitchModal && modeSwitchModal.style.display === 'flex') {
            cancelModeSwitch();
            return;
        }
        
        var abandonModal = document.getElementById('abandonGameModal');
        if (abandonModal && abandonModal.style.display === 'flex') {
            closeAbandonModal();
            return;
        }
        
        var placeholderModal = document.getElementById('placeholderModal');
        if (placeholderModal && placeholderModal.style.display === 'flex') {
            closePlaceholderModal();
            return;
        }
        
        // Check panels
        var statsPanel = document.getElementById('statsPanel');
        if (statsPanel && statsPanel.style.display === 'flex') {
            closeStats();
            return;
        }
        
        var helpPanel = document.getElementById('helpPanel');
        if (helpPanel && helpPanel.style.display === 'flex') {
            closeHelp();
            return;
        }
        
        var infoPanel = document.getElementById('infoPanel');
        if (infoPanel && infoPanel.style.display === 'flex') {
            closeInfo();
            return;
        }
        
        var sharePanel = document.getElementById('sharePanel');
        if (sharePanel && sharePanel.style.display === 'flex') {
            closeShare();
            return;
        }
        
        var wordDefPanel = document.getElementById('wordDefPanel');
        if (wordDefPanel && wordDefPanel.style.display === 'flex') {
            closeWordDefPanel();
            return;
        }
    }
});

// BACKDROP CLICK - Click outside modal/panel to close
document.addEventListener('DOMContentLoaded', function() {
    // All panels with backdrop close
    var panels = [
        {id: 'sharePanel', close: closeShare},
        {id: 'statsPanel', close: closeStats},
        {id: 'wordDefPanel', close: closeWordDefPanel},
        {id: 'infoPanel', close: closeInfo},
        {id: 'helpPanel', close: closeHelp}
    ];
    
    panels.forEach(function(panel) {
        var el = document.getElementById(panel.id);
        if (el) {
            el.addEventListener('click', function(e) {
                if (e.target === el) {
                    panel.close();
                }
            });
        }
    });
    
    // All modals with backdrop close
    var modals = [
        {id: 'successModal', close: closeSuccessModal},
        {id: 'dailyCompleteModal', close: closeDailyModal},
        {id: 'zeroScoreModal', close: closeZeroScoreModal},
        {id: 'giveUpModal', close: cancelGiveUp},
        {id: 'modeSwitchModal', close: cancelModeSwitch},
        {id: 'abandonGameModal', close: cancelAbandonGame},
        {id: 'placeholderModal', close: closePlaceholderModal}
    ];
    
    modals.forEach(function(modal) {
        var el = document.getElementById(modal.id);
        if (el) {
            el.addEventListener('click', function(e) {
                if (e.target === el) {
                    modal.close();
                }
            });
        }
    });
});

window.nextWord = nextWord;
window.confirmGiveUp = confirmGiveUp;
window.cancelGiveUp = cancelGiveUp;
window.closeDuplicateModal = closeDuplicateModal;
window.skipRound = skipRound;
window.viewResults = viewResults;
window.closeDailyModal = closeDailyModal;
window.toggleShare = toggleShare;
window.toggleHelp = toggleHelp;
window.toggleStats = toggleStats;
window.toggleInfo = toggleInfo;
window.closeShare = closeShare;
window.closeHelp = closeHelp;
window.closeStats = closeStats;
window.closeInfo = closeInfo;
window.copyToClipboard = copyToClipboard;
window.shareToTwitter = shareToTwitter;
window.shareToBluesky = shareToBluesky;
window.reloadDevGame = reloadDevGame;
window.shareToFacebook = shareToFacebook;
window.openStreakPanel = openStreakPanel;
window.closeStreakPanel = closeStreakPanel;
window.showWordDefinitionModal = showWordDefinitionModal;
window.closeWordDefPanel = closeWordDefPanel;

// Show "Coming Soon!" when PRO link is clicked
function showComingSoon(event) {
    // Work with either the clicked element (from onclick) or the element with id
    var target = event ? event.target : document.getElementById('proLink');
    if (target) {
        target.textContent = 'Coming Soon!';
        target.style.cursor = 'default';
        target.onclick = null;
        setTimeout(function() {
            target.textContent = 'Directionary PRO';
            target.style.cursor = 'pointer';
            target.onclick = showComingSoon;
        }, 2000);
    }
}
window.showComingSoon = showComingSoon;
