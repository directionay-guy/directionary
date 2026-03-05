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
var playCount = 0; // PRO MODE: Track number of games played for word selection
var playCountProPlus = 0; // PRO+ MODE: Separate counter for hard mode
var gameMode = 'pro'; // 'pro' or 'proplus' - Default to Pro mode

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
    gamesPlayed: 0,
    gamesCompleted: 0,
    totalScore: 0,
    bestScore: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastPlayed: null
};

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
    
    // PRO+ MODE: Don't bold used letters
    if (gameMode === 'proplus') {
        var spans = alphabetDiv.getElementsByTagName("span");
        for (var i = 0; i < spans.length; i++) {
            spans[i].classList.remove("used-letter");
        }
        return;
    }
    
    var spans = alphabetDiv.getElementsByTagName("span");
    for (var i = 0; i < spans.length; i++) {
        var span = spans[i];
        var letter = span.textContent;
        if (usedLetters.has(letter)) {
            span.classList.add("used-letter");
        } else {
            span.classList.remove("used-letter");
        }
    }
}

// Beta Banner Management
function showBetaBannerIfEnabled() {
    var betaMode = localStorage.getItem('directionary_pro_betaMode') === 'true';
    
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
    console.log(">>> loadWordList CALLED - fetching words.json...");
    fetch('game/words.json')
        .then(response => {
            console.log(">>> loadWordList: words.json fetched successfully");
            return response.json();
        })
        .then(data => {
            console.log(">>> loadWordList: words.json parsed successfully");
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
                var addedWordsData = localStorage.getItem('directionary_pro_addedWords');
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
            
            console.log(">>> loadWordList: Calling startNewGame...");
            startNewGame();
            console.log(">>> loadWordList: startNewGame returned");
        })
        .catch(error => {
            console.log("Could not load word list, using fallback:", error);
            answerWords = fallbackWords;
            validWords = fallbackWords;
            usingFallbackMode = true;
            console.log("FALLBACK MODE ENABLED - words will use rotation");
            
            try {
                var addedWordsData = localStorage.getItem('directionary_pro_addedWords');
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
    console.log("Initializing Directionary...");
    
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
    
    if (!devMode && !testMode) {
        // PRO MODE: No daily limit - unlimited plays allowed
    }
    
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
        var storedDay = localStorage.getItem('directionary_pro_currentDay');
        
        if (!storedDay) {
            localStorage.setItem('directionary_pro_currentDay', currentDay);
            console.log("🔧 No stored day - initialized to current day:", currentDay);
            return;
        }
        
        storedDay = parseInt(storedDay);
        
        if (currentDay > storedDay) {
            console.log("New day detected! Old day:", storedDay, "New day:", currentDay);
            console.log("Reloading for fresh puzzle...");
            localStorage.setItem('directionary_pro_currentDay', currentDay);
            location.reload();
        }
    }, 10000);
}

function startNewGame() {
    console.log(">>> >>> startNewGame CALLED <<<");
    console.log(">>> Starting round " + currentRound + "...");
    console.log(">>> Game mode:", gameMode);
    console.log(">>> Play counts - Pro:", playCount, "Pro+:", playCountProPlus);
    
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
        // Use correct playCount and formula based on mode
        if (gameMode === 'proplus') {
            wordIndex = (((dailyNumber + playCountProPlus) * 751) + (currentRound * 1009)) % wordPool.length;
            console.log("PRO+ MODE: Word index:", wordIndex, "(day:", dailyNumber, "playCount:", playCountProPlus, "round:", currentRound, ")");
        } else {
            wordIndex = (((dailyNumber + playCount) * 613) + (currentRound * 997)) % wordPool.length;
            console.log("PRO MODE: Word index:", wordIndex, "(day:", dailyNumber, "playCount:", playCount, "round:", currentRound, ")");
        }
    }
    
    var overrides = {};
    try {
        var overrideData = localStorage.getItem('directionary_pro_wordOverrides');
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
        console.log("=== TARGET WORD ASSIGNED ===");
        console.log("Mode:", gameMode);
        console.log("Word Pool Index:", wordIndex);
        console.log("Target Word:", targetWord);
        console.log("Formula used: dailyNumber=" + dailyNumber + ", playCount=" + (gameMode === 'proplus' ? playCountProPlus : playCount) + ", round=" + currentRound);
        console.log("===========================");
    }
    
    if (devMode || testMode) {
        console.log("Target word:", targetWord, "(round", currentRound + ")");
    }
    
    if (devMode) {
        var wordSource = answerWords.length > 0 ? "JSON words" : "Fallback list";
        var devDisplay = document.getElementById("devModeDisplay");
        devDisplay.style.display = "block";
        devDisplay.innerHTML = '🎯 DEV MODE: <span id="devTargetWord">' + targetWord + '</span> <span style="color: #666; font-size: 0.9em;">(from ' + wordSource + ')</span> <button onclick="reloadDevGame()" style="margin-left: 10px; background: #667eea; color: white; border: none; padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 0.9em; font-weight: 600;">🔄 New Game</button>';
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
    
    // Clean up any old round indicators and ensure current one is visible
    var feedbackDiv = document.getElementById('feedback');
    var allIndicators = feedbackDiv.querySelectorAll('.new-game-message');
    
    // Remove old round indicators from previous rounds
    allIndicators.forEach(function(indicator) {
        if (indicator.id && indicator.id.match(/^round\d+Indicator$/)) {
            var indicatorRound = parseInt(indicator.id.replace('round', '').replace('Indicator', ''));
            if (indicatorRound !== currentRound) {
                indicator.remove();
                console.log("startNewGame: Removed old round indicator:", indicator.id);
            }
        }
    });
    
    // Ensure current round indicator exists
    var roundIndicatorId = "round" + currentRound + "Indicator";
    var roundIndicator = document.getElementById(roundIndicatorId);
    if (!roundIndicator) {
        console.warn("startNewGame: Round indicator missing for Round", currentRound, "- adding it");
        var newIndicator = document.createElement('div');
        newIndicator.className = 'new-game-message';
        newIndicator.id = roundIndicatorId;
        newIndicator.innerHTML = '◄ ● Round ' + currentRound + ' of ' + maxRounds + ' ● ►';
        feedbackDiv.appendChild(newIndicator);
    }
    
    // Update dev console
    if (typeof updateDevConsole === 'function') {
        updateDevConsole();
    }
    
    console.log(">>> >>> startNewGame COMPLETED <<<");
}

// PRO+ MODE: Validate guess respects arrow constraints
function validateProPlusGuess(guess) {
    if (gameMode !== 'proplus' || guessHistory.length === 0) {
        return true; // Not in Pro+ mode or no previous guesses
    }
    
    // Check the most recent guess for constraints
    var lastGuess = guessHistory[guessHistory.length - 1];
    if (!lastGuess || !lastGuess.feedback) return true;
    
    for (var i = 0; i < 5; i++) {
        var newLetter = guess[i];
        var feedback = lastGuess.feedback[i];
        var oldLetter = lastGuess.word[i];
        
        if (feedback === '●') {
            // Must use same letter
            if (newLetter !== oldLetter) {
                return false;
            }
        } else if (feedback === '►') {
            // Must use later letter
            if (newLetter <= oldLetter) {
                return false;
            }
        } else if (feedback === '◄') {
            // Must use earlier letter
            if (newLetter >= oldLetter) {
                return false;
            }
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
    
    // PRO+ MODE: Validate guess respects arrow constraints
    if (!validateProPlusGuess(guess)) {
        showError("Guess must follow arrow clues in Pro+");
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
    
    guessedWordsThisRound.add(guess);

    guessCount++;
    
    // Track first guess for lenient streak system
    if (!devMode && !testMode && guessCount === 1) {
        trackFirstGuess();
    }
    
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
    
    // Store both word and feedback for Pro+ validation
    guessHistory.push({
        word: guess,
        feedback: feedback,
        display: spacedFeedback
    });

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
    
    // Ensure round indicator is visible (for any round)
    // First, remove ANY old round indicators that might exist
    var allIndicators = feedbackDiv.querySelectorAll('.new-game-message');
    allIndicators.forEach(function(indicator) {
        // Remove if it's a round indicator (has an ID like "roundXIndicator")
        if (indicator.id && indicator.id.match(/^round\d+Indicator$/)) {
            var indicatorRound = parseInt(indicator.id.replace('round', '').replace('Indicator', ''));
            // Keep only the current round's indicator
            if (indicatorRound !== currentRound) {
                indicator.remove();
                console.log("submitGuess: Removed old round indicator:", indicator.id);
            }
        }
    });
    
    // Now ensure the current round indicator is at the end
    var roundIndicatorId = "round" + currentRound + "Indicator";
    var roundIndicator = document.getElementById(roundIndicatorId);
    if (roundIndicator) {
        // Make sure it's at the end of the feedback div
        feedbackDiv.appendChild(roundIndicator);
        console.log("submitGuess: Round indicator preserved for Round", currentRound);
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
            pattern: guessCount > 1 ? guessHistory[guessHistory.length - 2].display : guessHistory[0].display
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
    var gameStartedDay = localStorage.getItem('directionary_pro_gameStartedDay');
    var gameCompletedDay = localStorage.getItem('directionary_pro_gameCompletedDay');
    var lastStreakDay = localStorage.getItem('directionary_pro_lastStreakDay');
    
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
    localStorage.setItem('directionary_pro_gameStartedDay', today);
    localStorage.removeItem('directionary_pro_gameCompletedDay');
    
    // Increment streak if new day
    if (lastStreakDay != today) {
        playerStats.currentStreak++;
        localStorage.setItem('directionary_pro_lastStreakDay', today);
        
        if (playerStats.currentStreak > playerStats.maxStreak) {
            playerStats.maxStreak = playerStats.currentStreak;
        }
        
        saveStats();
        updateStreakDisplay();
        console.log("🔥 Streak incremented:", playerStats.currentStreak);
    }
}

// AlphaHint™ - COMPLETE IMPLEMENTATION
function attachAlphaHintHandlers() {
    // PRO+ MODE: Disable AlphaHint entirely
    if (gameMode === 'proplus') {
        return;
    }
    
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
            'game_version': gameMode === 'proplus' ? 'proplus' : 'pro',
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
    
    updateStats();
    
    if (!devMode && !testMode) {
        var today = getLocalGameDay();
        localStorage.setItem('directionary_pro_lastPlayed', today);
        localStorage.setItem('directionary_pro_gameCompletedDay', today);
        localStorage.setItem('directionary_pro_dailyState', JSON.stringify({
            roundResults: roundResults,
            totalScore: totalScore,
            completedDate: today
        }));
        
        // Increment correct play count based on mode
        if (gameMode === 'proplus') {
            playCountProPlus++;
            localStorage.setItem('directionary_proplus_playCount', playCountProPlus);
            console.log("PRO+ MODE: Play count incremented to:", playCountProPlus);
        } else {
            playCount++;
            localStorage.setItem('directionary_pro_playCount', playCount);
            console.log("PRO MODE: Play count incremented to:", playCount);
        }
    }
    
    document.getElementById("finalScore").textContent = totalScore;
    
    var modalTitle = document.querySelector("#dailyCompleteModal .success-title");
    var modeLabel = gameMode === 'proplus' ? 'PRO+' : 'PRO';
    
    if (totalScore === 0) {
        modalTitle.textContent = "Game Over - Try Again!";
        modalTitle.style.background = "linear-gradient(135deg, #dc3545 0%, #c82333 100%)";
        modalTitle.style.webkitBackgroundClip = "text";
        modalTitle.style.webkitTextFillColor = "transparent";
        
        // Reset streak for catastrophic failure
        if (!devMode && !testMode) {
            playerStats.currentStreak = 0;
            saveStats();
            updateStreakDisplay();
        }
    } else if (totalScore < 150) {
        modalTitle.textContent = modeLabel + " Game Complete";
    } else {
        modalTitle.textContent = "🏆 " + modeLabel + " Game Complete!";
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
    } else {
        summary = "No rounds completed<br>";
    }
    document.getElementById("roundSummary").innerHTML = summary;
    
    showPlayAgainButtons();
    
    // Update dev console with new play counts
    if (typeof updateDevConsole === 'function') {
        updateDevConsole();
    }
    
    document.getElementById("dailyCompleteModal").style.display = "flex";
}

function showPlayAgainButtons() {
    var instructions = document.querySelector(".instructions-brief");
    if (!instructions) {
        instructions = document.querySelector(".instructions");
    }
    if (instructions) {
        var modeLabel = gameMode === 'proplus' ? 'PRO+' : 'PRO';
        instructions.innerHTML = "<strong>✨ " + modeLabel + " game complete! Play as many times as you want.</strong>";
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
    
    // Create play again buttons instead of countdown
    var feedbackDiv = document.getElementById("feedback");
    var currentMode = gameMode === 'proplus' ? 'PRO+' : 'PRO';
    var otherMode = gameMode === 'proplus' ? 'PRO' : 'PRO+';
    
    feedbackDiv.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 12px; padding: 20px;">
            <button onclick="playAgainSameMode()" style="
                padding: 16px 24px;
                font-size: 1.1em;
                font-weight: 700;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                border-radius: 12px;
                cursor: pointer;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                transition: all 0.3s ease;
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.5)';" 
               onmouseout="this.style.transform=''; this.style.boxShadow='0 4px 15px rgba(102, 126, 234, 0.4)';">
                ▶ Play Another ${currentMode} Game
            </button>
            <button onclick="playAgainOtherMode()" style="
                padding: 14px 24px;
                font-size: 1em;
                font-weight: 600;
                background: white;
                color: #667eea;
                border: 2px solid #667eea;
                border-radius: 12px;
                cursor: pointer;
                transition: all 0.3s ease;
            " onmouseover="this.style.background='rgba(102, 126, 234, 0.1)';" 
               onmouseout="this.style.background='white';">
                Try ${otherMode} Mode
            </button>
        </div>
    `;
    
    if (roundResults.length > 0) {
        var buttonGroup = document.querySelector(".button-group");
        var wordsDiv = document.createElement("div");
        wordsDiv.id = "yourWordsDisplay";
        wordsDiv.style.cssText = "text-align: center; padding: 15px 20px; background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%); border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); margin: 15px 0;";
        
        var html = '<h3 style="margin: 0 0 12px 0; color: #667eea; font-size: 1.1em;">Your Words</h3>';
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

function playAgainSameMode() {
    try {
        console.log("=== PLAY AGAIN SAME MODE BUTTON CLICKED ===");
        console.log("Current mode:", gameMode);
        console.log("Current playCount (Pro):", playCount);
        console.log("Current playCount (Pro+):", playCountProPlus);
        
        console.log("Step 1: Closing daily modal...");
        closeDailyModal();
        console.log("Step 1: Modal closed");
        
        console.log("Step 2: Calling resetGame...");
        resetGame();
        console.log("Step 2: resetGame completed");
        
        console.log("=== PLAY AGAIN SAME MODE COMPLETED ===");
    } catch (error) {
        console.error("ERROR in playAgainSameMode:", error);
        alert("Error starting new game: " + error.message);
    }
}

function playAgainOtherMode() {
    try {
        var targetMode = gameMode === 'proplus' ? 'pro' : 'proplus';
        console.log("=== PLAY AGAIN OTHER MODE BUTTON CLICKED ===");
        console.log("Switching from", gameMode, "to", targetMode);
        console.log("Current playCount (Pro):", playCount);
        console.log("Current playCount (Pro+):", playCountProPlus);
        
        console.log("Step 1: Closing daily modal...");
        closeDailyModal();
        console.log("Step 1: Modal closed");
        
        console.log("Step 2: Switching mode to", targetMode);
        performModeSwitch(targetMode);
        console.log("Step 2: Mode switched");
        
        console.log("Step 3: Calling resetGame...");
        resetGame();
        console.log("Step 3: resetGame completed");
        
        console.log("=== PLAY AGAIN OTHER MODE COMPLETED ===");
    } catch (error) {
        console.error("ERROR in playAgainOtherMode:", error);
        alert("Error starting new game: " + error.message);
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
            localStorage.setItem('directionary_pro_currentDay', tomorrowDay);
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
    var savedState = localStorage.getItem('directionary_pro_dailyState');
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
    
    updateStreakDisplay();
    
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
    var modeLabel = gameMode === 'proplus' ? 'PRO+' : 'PRO';
    var text = "Directionary " + modeLabel + " #" + (dailyNumber % 1000);
    
    if (playerStats.currentStreak > 0) {
        text += " - 🔥 " + playerStats.currentStreak + " day streak";
    }
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
        gtag('event', 'modal_open', {
            'game_version': gameMode === 'proplus' ? 'proplus' : 'pro',
            'modal_type': 'help'
        });
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
        gtag('event', 'modal_open', {
            'game_version': gameMode === 'proplus' ? 'proplus' : 'pro',
            'modal_type': 'stats'
        });
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
        gtag('event', 'modal_open', {
            'game_version': gameMode === 'proplus' ? 'proplus' : 'pro',
            'modal_type': 'about'
        });
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
        gtag('event', 'share', {
            'game_version': gameMode === 'proplus' ? 'proplus' : 'pro',
            'method': 'clipboard'
        });
    }
    
    var shareText = document.getElementById("sharePreview").textContent;
    navigator.clipboard.writeText(shareText).then(function() {
        alert("Results copied to clipboard!");
    });
}

function shareToTwitter() {
    if (typeof gtag === 'function') {
        gtag('event', 'share', {
            'game_version': gameMode === 'proplus' ? 'proplus' : 'pro',
            'method': 'twitter'
        });
    }
    
    var shareText = document.getElementById("sharePreview").textContent;
    var tweetUrl = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(shareText);
    window.open(tweetUrl, "_blank");
}

function shareToBluesky() {
    if (typeof gtag === 'function') {
        gtag('event', 'share', {
            'game_version': gameMode === 'proplus' ? 'proplus' : 'pro',
            'method': 'bluesky'
        });
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
        gtag('event', 'share', {
            'game_version': gameMode === 'proplus' ? 'proplus' : 'pro',
            'method': 'facebook'
        });
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
    
    // Clean up any lingering round indicators from previous rounds (safety check)
    var allIndicators = document.querySelectorAll('.new-game-message');
    allIndicators.forEach(function(indicator) {
        if (indicator.id && indicator.id.match(/^round\d+Indicator$/)) {
            indicator.remove();
            console.log("nextWord: Cleaned up lingering indicator:", indicator.id);
        }
    });
    
    // Create new round indicator
    var newGameLine = document.createElement("div");
    newGameLine.className = "new-game-message";
    newGameLine.id = "round" + currentRound + "Indicator"; // Add ID for each round
    newGameLine.innerHTML = "◄ ● Round " + currentRound + " of " + maxRounds + " ● ►";
    feedbackDiv.appendChild(newGameLine);
    
    console.log("nextWord: Round indicator added for Round", currentRound);
    
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
        pattern: guessHistory.length > 0 ? guessHistory[guessHistory.length - 1].display : "⚫ ⚫ ⚫ ⚫ ⚫"
    });
    nextWord();
}

function giveUp() {
    document.getElementById("giveUpModal").style.display = "flex";
    document.getElementById("guessInput").disabled = true;
    document.getElementById("submitBtn").disabled = true;
    document.getElementById("giveUpBtn").disabled = true;
}

function confirmGiveUp() {
    if (typeof gtag === 'function') {
        gtag('event', 'give_up', {
            'game_version': gameMode === 'proplus' ? 'proplus' : 'pro',
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
        pattern: guessHistory.length > 0 ? guessHistory[guessHistory.length - 1].display : "⚫ ⚫ ⚫ ⚫ ⚫"
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

function viewResults() {
    document.getElementById("dailyCompleteModal").style.display = "none";
    toggleShare();
}

function closeDailyModal() {
    document.getElementById("dailyCompleteModal").style.display = "none";
}

function loadStats() {
    var saved = localStorage.getItem('directionary_pro_Stats');
    if (saved) {
        playerStats = JSON.parse(saved);
    }
}

function saveStats() {
    localStorage.setItem('directionary_pro_Stats', JSON.stringify(playerStats));
}

function updateStats() {
    playerStats.gamesPlayed++;
    if (roundResults.length === 3) {
        playerStats.gamesCompleted++;
    }
    playerStats.totalScore += totalScore;
    playerStats.bestScore = Math.max(playerStats.bestScore, totalScore);
    
    var today = Math.floor(Date.now() / 86400000);
    playerStats.lastPlayed = today;
    
    saveStats();
    updateStatsDisplay();
    updateStreakDisplay();
}

function updateStatsDisplay() {
    document.getElementById('statGamesPlayed').textContent = playerStats.gamesPlayed;
    document.getElementById('statBestScore').textContent = playerStats.bestScore;
    var avg = playerStats.gamesPlayed > 0 ? Math.round(playerStats.totalScore / playerStats.gamesPlayed) : 0;
    document.getElementById('statAvgScore').textContent = avg;
    document.getElementById('statStreak').textContent = playerStats.currentStreak;
    document.getElementById('statMaxStreak').textContent = playerStats.maxStreak;
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
        localStorage.setItem('directionary_pro_gameState', JSON.stringify(state));
        console.log("💾 Game state saved");
    } catch (e) {
        console.log("Could not save game state:", e);
    }
}

function loadGameState() {
    if (devMode || testMode) return null;
    
    try {
        var saved = localStorage.getItem('directionary_pro_gameState');
        if (!saved) return null;
        
        var state = JSON.parse(saved);
        
        if (state.gameDay !== dailyNumber) {
            console.log("Saved game is from different day, starting fresh");
            clearGameState();
            return null;
        }
        
        var lastPlayed = localStorage.getItem('directionary_pro_lastPlayed');
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
        localStorage.removeItem('directionary_pro_gameState');
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

window.onload = function() {
    console.log("Directionary loading... [Version: Jan 18, 2026 - Phase 1 Master Base]");
    loadStats();
    updateStreakDisplay();
    initGame();
    
    // Initialize mode description and AlphaHint text for default Pro mode
    updateAlphaHintText('pro');
    
    // Attach placeholder event handlers
    attachPlaceholderHandlers();
    
    // Initialize dev console
    setTimeout(function() {
        if (typeof updateDevConsole === 'function') {
            updateDevConsole();
        }
    }, 500);
    
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
    if (e.key === 'Enter') {
        var successModal = document.getElementById('successModal');
        if (successModal && successModal.style.display === 'flex') {
            nextWord();
            return;
        }
        
        var completeModal = document.getElementById('dailyCompleteModal');
        if (completeModal && completeModal.style.display === 'flex') {
            closeDailyModal();
            toggleStats();
            return;
        }
        
        var zeroScoreModal = document.getElementById('zeroScoreModal');
        if (zeroScoreModal && zeroScoreModal.style.display === 'flex') {
            skipRound();
            return;
        }
        
        var duplicateModal = document.getElementById('duplicateWordModal');
        if (duplicateModal && duplicateModal.style.display === 'flex') {
            closeDuplicateModal();
            return;
        }
    }
    
    if (e.key === 'Escape') {
        var statsPanel = document.getElementById('statsPanel');
        var helpPanel = document.getElementById('helpPanel');
        var aboutPanel = document.getElementById('aboutPanel');
        var sharePanel = document.getElementById('sharePanel');
        var streakPanel = document.getElementById('streakPanel');
        var wordDefPanel = document.getElementById('wordDefPanel');
        
        if (statsPanel && statsPanel.style.display === 'flex') {
            toggleStats();
        } else if (helpPanel && helpPanel.style.display === 'flex') {
            toggleHelp();
        } else if (aboutPanel && aboutPanel.style.display === 'flex') {
            toggleAbout();
        } else if (sharePanel && sharePanel.style.display === 'flex') {
            toggleShare();
        } else if (streakPanel && streakPanel.style.display === 'flex') {
            closeStreakPanel();
        } else if (wordDefPanel && wordDefPanel.style.display === 'flex') {
            closeWordDefPanel();
        }
    }
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

// Pro/Pro+ Mode Switching
var pendingModeSwitch = null; // Track which mode user wants to switch to

function switchToProMode() {
    // If already in Pro mode, do nothing
    if (gameMode === 'pro') return;
    
    // Check if game is in progress
    if (guessCount > 0) {
        // Show confirmation modal
        pendingModeSwitch = 'pro';
        document.getElementById('modeSwitchTitle').textContent = 'Switch to PRO Mode?';
        document.getElementById('modeSwitchMessage').textContent = 'This will restart your current game.';
        document.getElementById('modeSwitchDescription').textContent = 'PRO mode: AlphaHint enabled, bold letters show used letters, any guess allowed.';
        document.getElementById('modeSwitchModal').style.display = 'flex';
    } else {
        // No game in progress, just switch
        performModeSwitch('pro');
    }
}

function switchToProPlusMode() {
    // If already in Pro+ mode, do nothing
    if (gameMode === 'proplus') return;
    
    // Check if game is in progress
    if (guessCount > 0) {
        // Show confirmation modal
        pendingModeSwitch = 'proplus';
        document.getElementById('modeSwitchTitle').textContent = 'Switch to PRO+ Mode?';
        document.getElementById('modeSwitchMessage').textContent = 'This will restart your current game.';
        document.getElementById('modeSwitchDescription').textContent = 'PRO+ mode removes AlphaHint and all guesses must adhere to arrow clues.';
        document.getElementById('modeSwitchModal').style.display = 'flex';
    } else {
        // No game in progress, just switch
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
    var modal = document.getElementById('modeSwitchModal');
    if (modal) {
        modal.style.display = 'none';
    }
    pendingModeSwitch = null;
    
    // Focus input after cancel
    setTimeout(function() {
        document.getElementById("guessInput").focus();
    }, 100);
}

function performModeSwitch(newMode) {
    gameMode = newMode;
    
    // Update button states
    if (newMode === 'pro') {
        document.getElementById('proModeBtn').classList.add('active');
        document.getElementById('proPlusModeBtn').classList.remove('active');
        document.getElementById('modeDescription').innerHTML = '<strong>PRO Mode:</strong> AlphaHint enabled, bold letters, any guess allowed';
        updateAlphaHintText('pro');
        console.log("Switched to PRO mode");
    } else {
        document.getElementById('proPlusModeBtn').classList.add('active');
        document.getElementById('proModeBtn').classList.remove('active');
        document.getElementById('modeDescription').innerHTML = '<strong>PRO+ Mode:</strong> Removes AlphaHint, all guesses must adhere to arrow clues';
        updateAlphaHintText('proplus');
        console.log("Switched to PRO+ mode (Hard Mode)");
    }
    
    // Restart game if in progress
    if (guessCount > 0) {
        resetGame();
    } else {
        // Even if no guesses made, ensure round indicator is visible
        var roundIndicator = document.getElementById('round1Indicator');
        console.log("Mode switch: Checking round indicator, found:", !!roundIndicator);
        if (!roundIndicator) {
            // Round indicator missing, add it
            console.log("Mode switch: Adding missing round indicator");
            var feedbackDiv = document.getElementById('feedback');
            var newIndicator = document.createElement('div');
            newIndicator.className = 'new-game-message';
            newIndicator.id = 'round1Indicator';
            newIndicator.innerHTML = '◄ ● Round 1 of 3 ● ►';
            feedbackDiv.appendChild(newIndicator);
        }
    }
    
    // Update alphabet display
    updateAlphabetDisplay();
    
    // Update dev console
    if (typeof updateDevConsole === 'function') {
        updateDevConsole();
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
            alphaHintText.style.color = '';
            alphaHintText.style.fontStyle = '';
        }
    }
}

function attachPlaceholderHandlers() {
    var placeholder = document.getElementById("placeholderGuess");
    if (!placeholder) return;
    
    var placeholderDots = placeholder.querySelectorAll('.symbol-with-letter');
    var alphahintText = document.querySelector('.alphahint-text');
    
    placeholderDots.forEach(function(dot) {
        // Mouse events
        dot.addEventListener('mousedown', function(e) {
            e.preventDefault();
            if (alphahintText && gameMode !== 'proplus') {
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
            if (alphahintText && gameMode !== 'proplus') {
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
        
        // Add cursor pointer to show it's interactive (but not in Pro+ mode)
        dot.style.cursor = gameMode !== 'proplus' ? 'pointer' : 'default';
    });
}

function resetGame() {
    console.log("resetGame: Starting game reset");
    
    // Clear game state
    currentRound = 1;
    totalScore = 0;
    guessCount = 0;
    roundResults = [];
    guessHistory = [];
    guessedWordsThisRound.clear();
    usedLetters.clear();
    
    // Clear UI
    document.getElementById("feedback").innerHTML = "";
    document.getElementById("guessInput").value = "";
    document.getElementById("guessCount").textContent = "0";
    document.getElementById("currentScore").textContent = "100";
    document.getElementById("totalScore").textContent = "0";
    document.getElementById("errorMessage").innerHTML = "";
    
    // Restore placeholder and round indicator
    var feedbackDiv = document.getElementById("feedback");
    feedbackDiv.innerHTML = `
        <div class="feedback-line placeholder-guess" id="placeholderGuess">
            <span style="color: #bbb; margin-right: 8px;">1)</span>
            <span class="feedback-word" onclick="showPlaceholderModal()" style="cursor: pointer; color: #999;">GUESS</span>
            <div class="feedback-arrows">
                <div class="symbol-with-letter">
                    <span class="background-letter" style="color: #ccc;">G</span>
                    <span class="overlay-symbol" style="color: #333;">◄</span>
                </div>
                <div class="symbol-with-letter">
                    <span class="background-letter" style="color: #ccc;">U</span>
                    <span class="overlay-symbol" style="color: #333;">►</span>
                </div>
                <div class="symbol-with-letter">
                    <span class="background-letter" style="color: #ccc;">E</span>
                    <span class="overlay-symbol" style="color: #333;">◄</span>
                </div>
                <div class="symbol-with-letter">
                    <span class="background-letter" style="color: #ccc;">S</span>
                    <span class="overlay-symbol" style="color: #333;">►</span>
                </div>
                <div class="symbol-with-letter">
                    <span class="background-letter" style="color: #ccc;">S</span>
                    <span class="overlay-symbol" style="color: #333;">►</span>
                </div>
            </div>
        </div>
        <div class="new-game-message" id="round1Indicator">◄ ● Round 1 of 3 ● ►</div>
    `;
    
    console.log("resetGame: HTML restored, round indicator should be present");
    
    console.log("resetGame: Re-showing input and buttons...");
    // Re-show input and buttons (hidden by showPlayAgainButtons)
    document.getElementById("guessInput").style.display = "";
    document.querySelector(".button-group").style.display = "";
    console.log("resetGame: Input display:", document.getElementById("guessInput").style.display);
    console.log("resetGame: Button group display:", document.querySelector(".button-group").style.display);
    
    // Re-enable input and buttons
    document.getElementById("guessInput").disabled = false;
    document.getElementById("submitBtn").disabled = false;
    document.getElementById("giveUpBtn").disabled = false;
    console.log("resetGame: Controls re-enabled");
    
    // Update instructions to default
    var instructions = document.querySelector(".instructions-brief");
    if (!instructions) {
        instructions = document.querySelector(".instructions");
    }
    if (instructions) {
        var modeLabel = gameMode === 'proplus' ? 'PRO+' : 'PRO';
        instructions.innerHTML = "<strong>Guess the 5-letter word!</strong> Use the arrows to guide you.";
        instructions.style.background = "";
        console.log("resetGame: Instructions updated");
    }
    
    // Remove "Your Words" display if it exists
    var wordsDisplay = document.getElementById("yourWordsDisplay");
    if (wordsDisplay) {
        wordsDisplay.remove();
        console.log("resetGame: Your Words display removed");
    }
    
    // Re-attach placeholder event handlers
    console.log("resetGame: Attaching placeholder handlers...");
    attachPlaceholderHandlers();
    console.log("resetGame: Placeholder handlers attached");
    
    // Reset alphabet
    console.log("resetGame: Updating alphabet display...");
    updateAlphabetDisplay();
    console.log("resetGame: Alphabet display updated");
    
    // Load new word for current mode
    console.log("resetGame: Calling loadWordList...");
    loadWordList();
    console.log("resetGame: loadWordList called - COMPLETED");
}

window.switchToProMode = switchToProMode;
window.switchToProPlusMode = switchToProPlusMode;
window.confirmModeSwitch = confirmModeSwitch;
window.cancelModeSwitch = cancelModeSwitch;
window.playAgainSameMode = playAgainSameMode;
window.playAgainOtherMode = playAgainOtherMode;

// DEV CONSOLE - REMOVE BEFORE PUBLIC LAUNCH
function updateDevConsole() {
    var devConsole = document.getElementById('devConsole');
    if (!devConsole) return;
    
    // Update mode
    document.getElementById('devMode').textContent = gameMode === 'proplus' ? 'PRO+' : 'PRO';
    
    // Update round
    document.getElementById('devRound').textContent = currentRound;
    
    // Update target word
    document.getElementById('devTarget').textContent = targetWord || '-----';
    
    // Calculate all 3 words for this game
    var wordPool = answerWords.length > 0 ? answerWords : fallbackWords;
    var words = ['-----', '-----', '-----'];
    
    // Get the ACTIVE playCount for current mode
    var activePlayCount = gameMode === 'proplus' ? playCountProPlus : playCount;
    
    console.log("=== DEV CONSOLE UPDATE ===");
    console.log("Mode:", gameMode);
    console.log("DailyNumber:", dailyNumber);
    console.log("Active PlayCount:", activePlayCount);
    console.log("Current Round:", currentRound);
    console.log("Target Word:", targetWord);
    
    if (!testMode && !devMode && !usingFallbackMode && wordPool.length > 0) {
        for (var r = 1; r <= 3; r++) {
            var wordIndex;
            if (gameMode === 'proplus') {
                wordIndex = (((dailyNumber + playCountProPlus) * 751) + (r * 1009)) % wordPool.length;
                console.log("PRO+ R" + r + " calc: ((" + dailyNumber + " + " + playCountProPlus + ") * 751) + (" + r + " * 1009) = index " + wordIndex);
            } else {
                wordIndex = (((dailyNumber + playCount) * 613) + (r * 997)) % wordPool.length;
                console.log("PRO R" + r + " calc: ((" + dailyNumber + " + " + playCount + ") * 613) + (" + r + " * 997) = index " + wordIndex);
            }
            words[r - 1] = wordPool[wordIndex];
            console.log("R" + r + " word:", words[r - 1]);
        }
    }
    
    document.getElementById('devWord1').textContent = words[0];
    document.getElementById('devWord2').textContent = words[1];
    document.getElementById('devWord3').textContent = words[2];
    
    // Update play counts
    document.getElementById('devPlayCountPro').textContent = playCount;
    document.getElementById('devPlayCountProPlus').textContent = playCountProPlus;
    
    console.log("=========================");
}

window.updateDevConsole = updateDevConsole;

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
