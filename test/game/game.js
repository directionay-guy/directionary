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
    var betaMode = localStorage.getItem('directionary_betaMode') === 'true';
    
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
    fetch('game/words.json')
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
                var addedWordsData = localStorage.getItem('directionary_addedWords');
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
                var addedWordsData = localStorage.getItem('directionary_addedWords');
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
    
    showBetaBannerIfEnabled();
    
    if (!devMode && !testMode) {
        startDayChangeChecker();
    }
    
    if (!devMode && !testMode) {
        var lastPlayed = localStorage.getItem('directionary_lastPlayed');
        var today = getLocalGameDay();
        
        if (lastPlayed == today) {
            showAlreadyPlayedMessage();
            return;
        }
    }
    
    currentRound = 1;
    totalScore = 0;
    roundResults = [];
    guessHistory = [];
    loadWordList();
    
    if (typeof gtag === 'function') {
        gtag('event', 'game_start', {
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
        var storedDay = localStorage.getItem('directionary_currentDay');
        
        if (!storedDay) {
            var yesterday = currentDay - 1;
            localStorage.setItem('directionary_currentDay', yesterday);
            console.log("🔧 No stored day - initialized to yesterday:", yesterday, "(will reload on next check)");
            return;
        }
        
        storedDay = parseInt(storedDay);
        
        if (currentDay > storedDay) {
            console.log("New day detected! Old day:", storedDay, "New day:", currentDay);
            console.log("Reloading for fresh puzzle...");
            localStorage.setItem('directionary_currentDay', currentDay);
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
        wordIndex = ((dailyNumber * 317) + (currentRound * 773)) % wordPool.length;
        console.log("JSON MODE: Day-based index:", wordIndex, "(varied selection)");
    }
    
    var overrides = {};
    try {
        var overrideData = localStorage.getItem('directionary_wordOverrides');
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
    var gameStartedDay = localStorage.getItem('directionary_gameStartedDay');
    var gameCompletedDay = localStorage.getItem('directionary_gameCompletedDay');
    var lastStreakDay = localStorage.getItem('directionary_lastStreakDay');
    
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
    localStorage.setItem('directionary_gameStartedDay', today);
    localStorage.removeItem('directionary_gameCompletedDay');
    
    // Increment streak if new day
    if (lastStreakDay != today) {
        playerStats.currentStreak++;
        localStorage.setItem('directionary_lastStreakDay', today);
        
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
    var feedbackDiv = document.getElementById("feedback");
    var allLines = feedbackDiv.querySelectorAll('.feedback-line');
    
    // Remove handlers from PREVIOUS guesses only (not latest)
    allLines.forEach(function(line, index) {
        // Skip the first line (latest guess - index 0)
        if (index === 0) return;
        
        var symbols = line.querySelectorAll('.overlay-symbol');
        symbols.forEach(function(symbol) {
            // Remove pointer cursor from old guesses
            symbol.style.cursor = 'default';
            // Clone and replace to remove all event listeners
            var newSymbol = symbol.cloneNode(true);
            symbol.parentNode.replaceChild(newSymbol, symbol);
        });
    });
    
    // Attach handlers ONLY to the LATEST guess (first child, most recent)
    var latestLine = feedbackDiv.firstElementChild;
    if (!latestLine || !latestLine.classList.contains('feedback-line')) return;
    
    var symbols = latestLine.querySelectorAll('.overlay-symbol');
    
    symbols.forEach(function(symbol) {
        // Only attach to arrows, not dots
        var symbolText = symbol.textContent.trim();
        if (symbolText === '●') {
            symbol.style.cursor = 'default';
            return; // Skip green dots
        }
        
        // Show pointer cursor on latest guess arrows
        symbol.style.cursor = 'pointer';
        
        var position = parseInt(symbol.getAttribute('data-position'));
        
        // Mouse events
        symbol.addEventListener('mousedown', function(e) {
            e.preventDefault();
            showAlphaHint(position);
        });
        
        symbol.addEventListener('mouseup', clearAlphaHint);
        symbol.addEventListener('mouseleave', clearAlphaHint);
        
        // Touch events
        symbol.addEventListener('touchstart', function(e) {
            e.preventDefault();
            showAlphaHint(position);
        });
        
        symbol.addEventListener('touchend', clearAlphaHint);
        symbol.addEventListener('touchcancel', clearAlphaHint);
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
}

function clearAlphaHint() {
    // Remove alphabet hidden classes
    var alphabetDiv = document.getElementById("alphabetDisplay");
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
}

function showError(message) {
    var errorDiv = document.getElementById("errorMessage");
    errorDiv.innerHTML = '<div class="error-message">' + message + '</div>';
    setTimeout(() => { errorDiv.innerHTML = ""; }, 3000);
}

function showSuccessModal() {
    document.getElementById("modalWord").textContent = targetWord;
    document.getElementById("modalScore").textContent = currentScore;
    document.getElementById("modalTotal").textContent = totalScore;
    
    if (typeof gtag === 'function') {
        gtag('event', 'round_complete', {
            'round_number': currentRound,
            'score': currentScore,
            'guesses_used': guessCount,
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
            'total_score': totalScore,
            'rounds_completed': roundResults.length,
            'game_day': dailyNumber
        });
    }
    
    updateStats();
    
    if (!devMode && !testMode) {
        var today = getLocalGameDay();
        localStorage.setItem('directionary_lastPlayed', today);
        localStorage.setItem('directionary_gameCompletedDay', today);
        localStorage.setItem('directionary_dailyState', JSON.stringify({
            roundResults: roundResults,
            totalScore: totalScore,
            completedDate: today
        }));
    }
    
    document.getElementById("finalScore").textContent = totalScore;
    
    var modalTitle = document.querySelector("#dailyCompleteModal .success-title");
    if (totalScore === 0) {
        modalTitle.textContent = "Game Over - Try Again Tomorrow!";
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
        modalTitle.textContent = "Daily Challenge Complete";
    } else {
        modalTitle.textContent = "🏆 Daily Challenge Complete!";
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
        
        // Add cross-promotion
        summary += '<div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 12px; font-size: 0.9em; color: #666;">';
        summary += '<p>Want more challenge right now?<br><span class="cross-promo-link" onclick="showComingSoon(event)" style="color: #667eea; text-decoration: underline; font-weight: 600; cursor: pointer;">Directionary PRO</span> - unlimited 3-word puzzles</p>';
        summary += '</div>';
    } else {
        summary = "No rounds completed<br>";
    }
    document.getElementById("roundSummary").innerHTML = summary;
    
    showComeBackMessage();
    
    document.getElementById("dailyCompleteModal").style.display = "flex";
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
    var savedState = localStorage.getItem('directionary_dailyState');
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
    var text = "Directionary #" + (dailyNumber % 1000);
    
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

function viewResults() {
    document.getElementById("dailyCompleteModal").style.display = "none";
    toggleShare();
}

function closeDailyModal() {
    document.getElementById("dailyCompleteModal").style.display = "none";
}

function loadStats() {
    var saved = localStorage.getItem('directionaryStats');
    if (saved) {
        playerStats = JSON.parse(saved);
    }
}

function saveStats() {
    localStorage.setItem('directionaryStats', JSON.stringify(playerStats));
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
        localStorage.setItem('directionary_gameState', JSON.stringify(state));
        console.log("💾 Game state saved");
    } catch (e) {
        console.log("Could not save game state:", e);
    }
}

function loadGameState() {
    if (devMode || testMode) return null;
    
    try {
        var saved = localStorage.getItem('directionary_gameState');
        if (!saved) return null;
        
        var state = JSON.parse(saved);
        
        if (state.gameDay !== dailyNumber) {
            console.log("Saved game is from different day, starting fresh");
            clearGameState();
            return null;
        }
        
        var lastPlayed = localStorage.getItem('directionary_lastPlayed');
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
        localStorage.removeItem('directionary_gameState');
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

(function() {
    function dismissRotateOverlay() {
var overlay = document.getElementById("rotateOverlay");
if (overlay) {
    overlay.classList.add('dismissed');
    sessionStorage.setItem('dismissedRotateOverlay', 'true');
}
    }
    
    function initRotateOverlay() {
var overlay = document.getElementById("rotateOverlay");
if (!overlay) return;

if (sessionStorage.getItem('dismissedRotateOverlay') === 'true') {
    overlay.classList.add('dismissed');
}

var btn = overlay.querySelector('.dismiss-rotate-btn');
if (btn) {
    btn.addEventListener('click', dismissRotateOverlay);
}
    }
    
    if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', initRotateOverlay);
    } else {
initRotateOverlay();
    }
    
    window.dismissRotateOverlay = dismissRotateOverlay;
})();
