/*
 * DIRECTIONARY PRO - game.js
 * 
 * FIXES IN THIS VERSION:
 * ✅ Dev mode now uses formula words (not random) so dev console matches game
 * ✅ Feedback area always shows placeholder + round indicator on new game / reset / mode switch
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
var lastFetchedDefinition = null;

// Pro/Pro+ Mode Variables
var gameMode = 'pro'; // 'pro' or 'proplus'
var playCount = 0;
var playCountProPlus = 0;
var pendingModeSwitch = null;

// Get game day number based on LOCAL midnight
function getLocalGameDay() {
    var now = new Date();
    var localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var launchDate = new Date(2026, 0, 1);
    var daysSinceLaunch = Math.floor((localMidnight - launchDate) / 86400000);
    return daysSinceLaunch + 1;
}

var dailyNumber = getLocalGameDay();
var usingFallbackMode = false;

// Stats variables
var playerStats = {
    firstProGameDate: null,
    firstProPlusGameDate: null,
    pro: {
        gamesPlayed: 0,
        bestScore: 0,
        totalScore: 0,
        dailyTotal: 0,
        weeklyTotal: 0,
        monthlyTotal: 0,
        annualTotal: 0,
        currentDay: null,
        currentWeek: null,
        currentMonth: null,
        currentYear: null,
        yearlyArchive: {}
    },
    proplus: {
        gamesPlayed: 0,
        bestScore: 0,
        totalScore: 0,
        dailyTotal: 0,
        weeklyTotal: 0,
        monthlyTotal: 0,
        annualTotal: 0,
        currentDay: null,
        currentWeek: null,
        currentMonth: null,
        currentYear: null,
        yearlyArchive: {}
    }
};

function formatDateForDisplay(dateStr) {
    if (!dateStr) return "Not played yet";
    var parts = dateStr.split('-');
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function getDateKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
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

var fallbackWords = ['ABOUT','ABOVE','ACTOR','ADMIT','ADOPT','ADULT','AFTER','AGAIN','AGENT','AGREE','AHEAD','ALARM','ALBUM','ALERT','ALIKE','ALIVE','ALLOW','ALONE','ALONG','ALTER','ANGEL','ANGER','ANGLE','ANGRY','APART','APPLE','APPLY','ARENA','ARGUE','ARISE','ARRAY','ASIDE','ASSET','AVOID','AWAKE','AWARD','AWARE','BAKER','BASIC','BEACH','BEGAN','BEING','BELOW','BENCH','BIRTH','BLACK','BLAME','BLANK','BLAST','BLEND','BLIND','BLOCK','BLOOD','BOARD','BOOST','BOUND','BRAIN','BRAND','BRAVE','BREAD','BREAK','BRICK','BRIEF','BRING','BROAD','BROKE','BROWN','BUILD','BUILT','BUYER','CABLE','CARRY','CATCH','CAUSE','CHAIN','CHAIR','CHAOS','CHARM','CHART','CHASE','CHEAP','CHECK','CHEST','CHIEF','CHILD','CHOSE','CLAIM','CLASS','CLEAN','CLEAR','CLIMB','CLOCK','CLOSE','CLOUD','COACH','COAST','COULD','COUNT','COURT','COVER','CRAFT','CRASH','CRAZY','CREAM','CRIME','CROSS','CROWD','CROWN','CURVE','CYCLE','DAILY','DANCE','DEALT','DEATH','DELAY','DEPTH','DIGIT','DIRTY','DOUBT','DOZEN','DRAFT','DRAMA','DRANK','DRAWN','DREAM','DRESS','DRINK','DRIVE','EARLY','EARTH','EIGHT','ELECT','EMPTY','ENEMY','ENJOY','ENTER','ENTRY','EQUAL','ERROR','EVENT','EVERY','EXACT','EXIST','EXTRA','FAITH','FALSE','FAULT','FIELD','FIFTH','FIFTY','FIGHT','FINAL','FIRST','FIXED','FLASH','FLEET','FLOAT','FLOOR','FOCUS','FORCE','FORTY','FOUND','FRAME','FRESH','FRONT','FRUIT','FULLY','FUNNY','GIANT','GIVEN','GLASS','GLOBE','GOING','GRACE','GRADE','GRAIN','GRAND','GRANT','GRASS','GREAT','GREEN','GROSS','GROUP','GROWN','GUARD','GUESS','GUEST','GUIDE','HABIT','HAPPY','HEART','HEAVY','HELLO','HORSE','HOTEL','HOUSE','HUMAN','IDEAL','IMAGE','IMPLY','INDEX','INNER','INPUT','ISSUE','JOINT','JUDGE','KNOWN','LABEL','LARGE','LATER','LAUGH','LAYER','LEARN','LEAST','LEAVE','LEGAL','LEMON','LEVEL','LIGHT','LIMIT','LOCAL','LOGIC','LOWER','LUCKY','LUNCH','MAGIC','MAJOR','MAKER','MARCH','MATCH','MAYBE','MAYOR','MEANT','MEDIA','METAL','MIGHT','MINOR','MINUS','MIXED','MODEL','MONEY','MONTH','MORAL','MOTOR','MOUNT','MOUSE','MOUTH','MOVED','MOVIE','MUSIC'];

var GAME_URL = "https://directionary.net";

var devMode = false;
var testMode = false;
var TEST_PASSWORD = "test2025";

var urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('dev') === 'true') {
    devMode = true;
    console.log("🎯 DEV MODE ENABLED");
}
if (urlParams.get('test') === TEST_PASSWORD) {
    testMode = true;
    console.log("🧪 TEST MODE ENABLED - Using random words");
}

// =============================================
// FIX #2: Rebuild placeholder + round indicator
// Called whenever feedback area is cleared
// =============================================
function initFeedbackDisplay() {
    var feedbackDiv = document.getElementById("feedback");
    if (!feedbackDiv) return;

    // Build placeholder guess HTML
    var placeholderHTML = `
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
        <div class="new-game-message" id="round1Indicator">◄ ● Round ${currentRound} of ${maxRounds} ● ►</div>
    `;

    feedbackDiv.innerHTML = placeholderHTML;

    // Reattach placeholder demo AlphaHint handlers
    var placeholder = document.getElementById("placeholderGuess");
    if (placeholder) {
        var placeholderDots = placeholder.querySelectorAll('.symbol-with-letter');
        var alphahintText = document.querySelector('.alphahint-text');
        placeholderDots.forEach(function(dot) {
            dot.style.cursor = 'pointer';
            dot.addEventListener('mousedown', function(e) {
                e.preventDefault();
                if (alphahintText) alphahintText.classList.add('demo-active');
            });
            dot.addEventListener('mouseup', function() {
                if (alphahintText) alphahintText.classList.remove('demo-active');
            });
            dot.addEventListener('mouseleave', function() {
                if (alphahintText) alphahintText.classList.remove('demo-active');
            });
            dot.addEventListener('touchstart', function(e) {
                e.preventDefault();
                if (alphahintText) alphahintText.classList.add('demo-active');
            });
            dot.addEventListener('touchend', function() {
                if (alphahintText) alphahintText.classList.remove('demo-active');
            });
            dot.addEventListener('touchcancel', function() {
                if (alphahintText) alphahintText.classList.remove('demo-active');
            });
        });
    }
}

function showDefinition(word) {
    var defBox = document.getElementById('definitionBox');
    var defWord = document.getElementById('defWord');
    var defText = document.getElementById('defText');
    defWord.textContent = word.toLowerCase();
    defText.textContent = 'Loading definition...';
    defBox.style.display = 'block';
    setTimeout(function() { defBox.style.display = 'none'; }, 10000);
    fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + word.toLowerCase())
        .then(response => { if (!response.ok) throw new Error('Not found'); return response.json(); })
        .then(data => {
            if (data && data[0] && data[0].meanings && data[0].meanings[0]) {
                var meaning = data[0].meanings[0];
                var pos = meaning.partOfSpeech || '';
                var def = meaning.definitions[0].definition || 'Definition not available';
                defText.textContent = (pos ? '(' + pos + ') ' : '') + def;
            } else { defText.textContent = 'Definition not available'; }
        })
        .catch(() => { defText.textContent = 'Definition not available'; });
}

function showWordDefinitionModal(word) {
    document.getElementById('wordDefWord').textContent = word.toLowerCase();
    document.getElementById('wordDefText').textContent = 'Fetching definition...';
    var linkElement = document.querySelector('#wordDefLink a');
    if (linkElement) linkElement.href = 'https://www.dictionary.com/browse/' + word.toLowerCase();
    document.getElementById('wordDefPanel').style.display = 'flex';
    fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + word.toLowerCase())
        .then(response => { if (!response.ok) throw new Error('Not found'); return response.json(); })
        .then(data => {
            if (data && data[0] && data[0].meanings && data[0].meanings[0]) {
                var meaning = data[0].meanings[0];
                var pos = meaning.partOfSpeech || '';
                var def = meaning.definitions[0].definition || 'Definition not available';
                document.getElementById('wordDefText').textContent = (pos ? '(' + pos + ') ' : '') + def;
            } else { document.getElementById('wordDefText').textContent = 'Definition not available'; }
        })
        .catch(() => { document.getElementById('wordDefText').textContent = 'Definition not available'; });
}

function closeWordDefPanel() {
    document.getElementById('wordDefPanel').style.display = 'none';
}

function updateScoreDisplay() {
    var totalGuesses = guessCount;
    for (var i = 0; i < roundResults.length; i++) totalGuesses += roundResults[i].guesses;
    document.getElementById("guessCount").textContent = totalGuesses;
    var totalPossible = maxRounds * 100;
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
        if (gameMode !== 'proplus' && usedLetters.has(letter)) {
            span.classList.add("used-letter");
        } else {
            span.classList.remove("used-letter");
        }
    }
}

function showBetaBannerIfEnabled() {
    var betaMode = localStorage.getItem('directionary_base_betaMode') === 'true';
    if (betaMode) {
        if (document.getElementById('betaBanner')) return;
        var banner = document.createElement('div');
        banner.id = 'betaBanner';
        banner.style.cssText = 'background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%); color: white; text-align: center; padding: 12px; font-weight: 600; font-size: 0.95em; box-shadow: 0 2px 8px rgba(0,0,0,0.15); position: sticky; top: 0; z-index: 1000;';
        banner.innerHTML = '🚧 BETA VERSION - Report issues: <a href="mailto:feedback@directionary.net" style="color: white; text-decoration: underline;">feedback@directionary.net</a> 🚧';
        document.body.insertBefore(banner, document.body.firstChild);
    } else {
        var existingBanner = document.getElementById('betaBanner');
        if (existingBanner) existingBanner.remove();
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
            mergeAddedWords();
            startNewGame();
        })
        .catch(error => {
            console.log("Could not load word list, using fallback:", error);
            answerWords = fallbackWords;
            validWords = fallbackWords;
            usingFallbackMode = true;
            mergeAddedWords();
            startNewGame();
        });
}

function mergeAddedWords() {
    try {
        var addedWordsData = localStorage.getItem('directionary_base_addedWords');
        if (addedWordsData) {
            var addedWords = JSON.parse(addedWordsData);
            if (addedWords.answers) addedWords.answers.forEach(function(word) {
                word = word.toUpperCase();
                if (!answerWords.includes(word)) answerWords.push(word);
            });
            if (addedWords.valid) addedWords.valid.forEach(function(word) {
                word = word.toUpperCase();
                if (!validWords.includes(word)) validWords.push(word);
            });
        }
    } catch (e) { console.log("Could not load added words:", e); }
}

function initGame() {
    console.log("Initializing Directionary PRO...");
    var storedPlayCountPro = localStorage.getItem('directionary_pro_playCount');
    playCount = storedPlayCountPro ? parseInt(storedPlayCountPro) : 0;
    var storedPlayCountProPlus = localStorage.getItem('directionary_proplus_playCount');
    playCountProPlus = storedPlayCountProPlus ? parseInt(storedPlayCountProPlus) : 0;
    console.log("PRO play count:", playCount, "| PRO+ play count:", playCountProPlus);

    if (!devMode && !testMode) {
        localStorage.setItem('directionary_pro_currentDay', getLocalGameDay());
    }
    showBetaBannerIfEnabled();
    if (!devMode && !testMode) startDayChangeChecker();

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
    setTimeout(function() { document.getElementById("guessInput").focus(); }, 100);
}

function startDayChangeChecker() {
    setInterval(function() {
        var currentDay = getLocalGameDay();
        var storedDay = localStorage.getItem('directionary_base_currentDay');
        if (!storedDay) { localStorage.setItem('directionary_base_currentDay', currentDay); return; }
        storedDay = parseInt(storedDay);
        if (currentDay > storedDay) {
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

    // =============================================
    // FIX #1: Dev mode now uses formula (not random)
    // so dev console words match the actual game.
    // Only testMode and usingFallbackMode use random.
    // =============================================
    if (testMode || usingFallbackMode) {
        wordIndex = Math.floor(Math.random() * wordPool.length);
        var modeLabel = testMode ? "TEST MODE" : "FALLBACK MODE";
        console.log(modeLabel + ": Random word index:", wordIndex);
    } else {
        if (gameMode === 'proplus') {
            wordIndex = (((dailyNumber + playCountProPlus) * 751) + (currentRound * 1009)) % wordPool.length;
            console.log("PRO+ MODE: Word index:", wordIndex, "| Day:", dailyNumber, "| PlayCount:", playCountProPlus, "| Round:", currentRound);
        } else {
            wordIndex = (((dailyNumber + playCount) * 613) + (currentRound * 997)) % wordPool.length;
            console.log("PRO MODE: Word index:", wordIndex, "| Day:", dailyNumber, "| PlayCount:", playCount, "| Round:", currentRound);
        }
    }

    // Check for word overrides
    var overrides = {};
    try {
        var overrideData = localStorage.getItem('directionary_base_wordOverrides');
        if (overrideData) overrides = JSON.parse(overrideData);
    } catch (e) { console.log("Could not load word overrides:", e); }

    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

    if (overrides[todayStr] && overrides[todayStr][currentRound]) {
        targetWord = overrides[todayStr][currentRound];
        console.log("Using OVERRIDE word for Round " + currentRound + ":", targetWord);
    } else {
        targetWord = wordPool[wordIndex];
    }

    if (devMode || testMode) {
        console.log("Target word:", targetWord, "(round", currentRound + ")");
    }

    if (devMode) updateFullDevConsole();
    if (testMode) document.getElementById("testModeDisplay").style.display = "block";

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

    // FIX #2: Always ensure feedback area has placeholder + round indicator
    var feedbackDiv = document.getElementById("feedback");
    var hasContent = feedbackDiv && feedbackDiv.querySelector('.feedback-line, .new-game-message');
    if (!hasContent) {
        initFeedbackDisplay();
    }
}

function updateFullDevConsole() {
    if (!devMode) return;
    var wordPool = answerWords.length > 0 ? answerWords : fallbackWords;
    var devConsole = document.getElementById("devConsole");
    if (devConsole) devConsole.style.display = "block";

    document.getElementById("devActiveMode").textContent = gameMode === 'proplus' ? 'PRO+' : 'PRO';
    document.getElementById("devRound").textContent = currentRound;
    document.getElementById("devPlayCountPro").textContent = playCount;
    document.getElementById("devPlayCountProPlus").textContent = playCountProPlus;

    for (var round = 1; round <= 3; round++) {
        var proIndex = (((dailyNumber + playCount) * 613) + (round * 997)) % wordPool.length;
        var proWord = wordPool[proIndex];
        var proSpan = document.getElementById("devProWord" + round);
        if (proSpan) {
            proSpan.textContent = proWord;
            proSpan.style.color = (round === currentRound && gameMode === 'pro') ? '#00ff41' : '#ff6b6b';
            proSpan.style.textDecoration = (round === currentRound && gameMode === 'pro') ? 'underline' : 'none';
        }
    }

    for (var round = 1; round <= 3; round++) {
        var proPlusIndex = (((dailyNumber + playCountProPlus) * 751) + (round * 1009)) % wordPool.length;
        var proPlusWord = wordPool[proPlusIndex];
        var proPlusSpan = document.getElementById("devProPlusWord" + round);
        if (proPlusSpan) {
            proPlusSpan.textContent = proPlusWord;
            proPlusSpan.style.color = (round === currentRound && gameMode === 'proplus') ? '#00ff41' : '#ff6b6b';
            proPlusSpan.style.textDecoration = (round === currentRound && gameMode === 'proplus') ? 'underline' : 'none';
        }
    }

    var proPlayCountSpan = document.getElementById("devProPlayCount");
    var proPlusPlayCountSpan = document.getElementById("devProPlusPlayCount");
    if (proPlayCountSpan) proPlayCountSpan.textContent = playCount;
    if (proPlusPlayCountSpan) proPlusPlayCountSpan.textContent = playCountProPlus;

    var proColumn = document.getElementById("devProColumn");
    var proPlusColumn = document.getElementById("devProPlusColumn");
    if (proColumn) proColumn.style.opacity = gameMode === 'pro' ? '1' : '0.5';
    if (proPlusColumn) proPlusColumn.style.opacity = gameMode === 'proplus' ? '1' : '0.5';
}

function validateProPlusGuess(guess) {
    if (gameMode !== 'proplus') return true;
    if (guessHistory.length === 0) return true;
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
            if (newLetter !== lastLetter) return false;
        } else if (symbol === '►' || symbol === '▶') {
            if (newLetter <= lastLetter) return false;
        } else if (symbol === '◄' || symbol === '◀') {
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
    if (guess.length !== 5) { showError("Please enter a 5-letter word"); return; }
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
    if (!validateProPlusGuess(guess)) {
        showError("Pro+ Mode: Your guess must follow the arrow clues from your previous guess.");
        input.value = "";
        input.focus();
        return;
    }
    guessedWordsThisRound.add(guess);
    guessCount++;
    usedLetters.clear();
    for (var i = 0; i < guess.length; i++) usedLetters.add(guess[i]);
    updateAlphabetDisplay();

    var feedback = "";
    var spacedFeedback = "";
    for (var i = 0; i < 5; i++) {
        var g = guess[i];
        var t = targetWord[i];
        if (g === t) { feedback += "●"; spacedFeedback += "● "; }
        else if (g < t) { feedback += "►"; spacedFeedback += "▶ "; }
        else { feedback += "◄"; spacedFeedback += "◀ "; }
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
    feedbackLine.innerHTML = "<span style=\"color: #bbb; margin-right: 8px;\">" + guessCount + ")</span> <span class=\"feedback-word\" onclick=\"showWordDefinitionModal('" + guess + "')\">" + guess + "</span> <div class=\"feedback-arrows\">" + arrowSpans + "</div>";
    feedbackDiv.insertBefore(feedbackLine, feedbackDiv.firstChild);

    // Remove placeholder after first real guess
    var placeholder = document.getElementById("placeholderGuess");
    if (placeholder) placeholder.remove();
    // Remove round indicator after first guess too
    var roundIndicator = document.getElementById("round1Indicator");
    if (roundIndicator) roundIndicator.remove();

    var allLines = feedbackDiv.querySelectorAll('.feedback-line');
    allLines.forEach(function(line, index) {
        if (index > 0) line.classList.add('inactive-guess');
    });
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
        currentScore = 0;
        guessCount = 0;
        updateScoreDisplay();
        setTimeout(() => { showSuccessModal(); }, 1500);
    } else {
        currentScore = Math.max(0, 100 - guessCount * 10);
        updateScoreDisplay();
        saveGameState();
        if (currentScore === 0) {
            setTimeout(() => { showZeroScoreModal(); }, 500);
        }
    }
}

function attachAlphaHintHandlers() {
    if (gameMode === 'proplus') return;
    var feedbackDiv = document.getElementById("feedback");
    var allLines = feedbackDiv.querySelectorAll('.feedback-line');
    allLines.forEach(function(line, index) {
        if (index === 0) return;
        var containers = line.querySelectorAll('.symbol-with-letter');
        containers.forEach(function(container) {
            container.style.cursor = 'default';
            var newContainer = container.cloneNode(true);
            container.parentNode.replaceChild(newContainer, container);
        });
    });
    var latestLine = feedbackDiv.firstElementChild;
    if (!latestLine || !latestLine.classList.contains('feedback-line')) return;
    var containers = latestLine.querySelectorAll('.symbol-with-letter');
    containers.forEach(function(container) {
        var symbol = container.querySelector('.overlay-symbol');
        if (!symbol) return;
        var symbolText = symbol.textContent.trim();
        if (symbolText === '●') { container.style.cursor = 'default'; return; }
        container.style.cursor = 'pointer';
        var position = parseInt(symbol.getAttribute('data-position'));
        container.addEventListener('mousedown', function(e) { e.preventDefault(); showAlphaHint(position); });
        container.addEventListener('mouseup', clearAlphaHint);
        container.addEventListener('mouseleave', clearAlphaHint);
        container.addEventListener('touchstart', function(e) { e.preventDefault(); showAlphaHint(position); });
        container.addEventListener('touchend', clearAlphaHint);
        container.addEventListener('touchcancel', clearAlphaHint);
    });
}

function showAlphaHint(position) {
    var feedbackDiv = document.getElementById("feedback");
    var allLines = feedbackDiv.querySelectorAll('.feedback-line');
    var lowerBound = null, upperBound = null, solved = null;
    allLines.forEach(function(line) {
        var wordSpan = line.querySelector('.feedback-word');
        if (!wordSpan) return;
        var word = wordSpan.textContent;
        var symbols = line.querySelectorAll('.overlay-symbol');
        if (symbols[position]) {
            var symbol = symbols[position].textContent.trim();
            var letter = word[position];
            if (symbol === '●') { solved = letter; }
            else if (symbol === '►' || symbol === '▶') { if (!lowerBound || letter > lowerBound) lowerBound = letter; }
            else if (symbol === '◄' || symbol === '◀') { if (!upperBound || letter < upperBound) upperBound = letter; }
        }
    });
    var alphabetDiv = document.getElementById("alphabetDisplay");
    var letters = alphabetDiv.querySelectorAll('span');
    alphabetDiv.classList.add('hint-active');
    if (solved) {
        letters.forEach(function(span) { if (span.textContent !== solved) span.classList.add('hint-hidden'); });
    } else {
        letters.forEach(function(span) {
            var letter = span.textContent;
            var valid = true;
            if (lowerBound && letter <= lowerBound) valid = false;
            if (upperBound && letter >= upperBound) valid = false;
            if (!valid) span.classList.add('hint-hidden');
        });
    }
    allLines.forEach(function(line) {
        var wordSpan = line.querySelector('.feedback-word');
        if (!wordSpan) return;
        var word = wordSpan.textContent;
        var symbols = line.querySelectorAll('.overlay-symbol');
        if (symbols[position]) {
            var letter = word[position];
            if (letter === lowerBound || letter === upperBound) symbols[position].classList.add('hint-constraint');
        }
    });
    var alphahintText = document.querySelector('.alphahint-text');
    if (alphahintText) {
        var ordinals = ['1st', '2nd', '3rd', '4th', '5th'];
        alphahintText.textContent = 'Options for the ' + ordinals[position] + ' letter';
        alphahintText.classList.add('demo-active');
    }
}

function clearAlphaHint() {
    var alphabetDiv = document.getElementById("alphabetDisplay");
    alphabetDiv.classList.remove('hint-active');
    var letters = alphabetDiv.querySelectorAll('span');
    letters.forEach(function(span) { span.classList.remove('hint-hidden'); });
    var feedbackDiv = document.getElementById("feedback");
    var allSymbols = feedbackDiv.querySelectorAll('.overlay-symbol');
    allSymbols.forEach(function(symbol) { symbol.classList.remove('hint-constraint'); });
    var alphahintText = document.querySelector('.alphahint-text');
    if (alphahintText) {
        alphahintText.textContent = 'AlphaHint™: Hold arrow for letter options';
        alphahintText.classList.remove('demo-active');
    }
}

function showError(message) {
    var errorDiv = document.getElementById("errorMessage");
    errorDiv.innerHTML = '<div class="error-message">' + message + '</div>';
    setTimeout(() => { errorDiv.innerHTML = ""; }, 3000);
}

function showSuccessModal() {
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
    titleElement.textContent = currentRound >= maxRounds ? "YOU WIN!" : "Correct!";
    document.getElementById("modalDefWord").textContent = targetWord.toLowerCase();
    document.getElementById("modalDefText").textContent = 'Loading definition...';
    fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + targetWord.toLowerCase())
        .then(response => { if (!response.ok) throw new Error('Not found'); return response.json(); })
        .then(data => {
            if (data && data[0] && data[0].meanings && data[0].meanings[0]) {
                var meaning = data[0].meanings[0];
                var pos = meaning.partOfSpeech || '';
                var def = meaning.definitions[0].definition || 'Definition not available';
                var fullDef = (pos ? '(' + pos + ') ' : '') + def;
                document.getElementById("modalDefText").textContent = fullDef;
                lastFetchedDefinition = { word: targetWord, text: fullDef };
            } else {
                document.getElementById("modalDefText").textContent = 'Definition not available';
                lastFetchedDefinition = null;
            }
        })
        .catch(() => {
            document.getElementById("modalDefText").textContent = 'Definition not available';
            lastFetchedDefinition = null;
        });
    document.querySelector("#successModal .success-btn").textContent = currentRound >= maxRounds ? "View Results" : "Next Round →";
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

    if (gameMode === 'proplus') {
        playCountProPlus++;
        localStorage.setItem('directionary_proplus_playCount', playCountProPlus);
        console.log("Pro+ game complete - playCount now:", playCountProPlus);
    } else {
        playCount++;
        localStorage.setItem('directionary_pro_playCount', playCount);
        console.log("Pro game complete - playCount now:", playCount);
    }

    var displayScore = gameMode === 'proplus' ? totalScore * 2 : totalScore;
    updateStats(displayScore);
    clearGameState();

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
    document.getElementById("dailyCompleteModal").style.display = "none";
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
    document.getElementById("dailyCompleteModal").style.display = "none";
    var newMode = (gameMode === 'proplus') ? 'pro' : 'proplus';
    performModeSwitch(newMode);
    if (typeof gtag === 'function') {
        gtag('event', 'play_again_switch_mode', { 'from_mode': gameMode, 'to_mode': newMode });
    }
}

function showComeBackMessage() {
    var instructions = document.querySelector(".instructions-brief") || document.querySelector(".instructions");
    if (instructions) {
        instructions.innerHTML = "<strong>✨ You've completed today's challenge! Return after midnight for tomorrow's game.</strong>";
        instructions.style.background = "linear-gradient(135deg, #667eea15 0%, #764ba215 100%)";
    }
    usedLetters.clear();
    var alphabetDiv = document.getElementById("alphabetDisplay");
    if (alphabetDiv) {
        var spans = alphabetDiv.getElementsByTagName("span");
        for (var i = 0; i < spans.length; i++) spans[i].classList.remove("used-letter");
    }
    document.getElementById("guessInput").style.display = "none";
    document.querySelector(".button-group").style.display = "none";
    var feedbackDiv = document.getElementById("feedback");
    feedbackDiv.innerHTML = '<div id="countdownTimer" style="text-align: center; padding: 25px 30px; font-size: 2em; color: #00ff41; font-weight: 700; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); border-radius: 15px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.5), 0 4px 15px rgba(0,0,0,0.3); font-family: \'Courier New\', Courier, monospace; letter-spacing: 0.1em; text-shadow: 0 0 10px rgba(0,255,65,0.5), 0 0 20px rgba(0,255,65,0.3);"></div>';
    startCountdownTimer();
}

function startCountdownTimer() {
    function updateCountdown() {
        var now = new Date();
        var tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        var timeLeft = tomorrow - now;
        if (timeLeft <= 1000) {
            localStorage.setItem('directionary_base_currentDay', getLocalGameDay() + 1);
            location.reload();
            return;
        }
        var hours = Math.floor(timeLeft / (1000 * 60 * 60));
        var minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
        var countdownEl = document.getElementById("countdownTimer");
        if (countdownEl) {
            countdownEl.innerHTML = '<span style="color: #FF9F00; font-size: 0.5em; text-shadow: 0 0 8px rgba(255,159,0,0.4);">Next puzzle in:</span><br>' +
                String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
        }
    }
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

function generateShareText() {
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
    if (sharePanel.style.display === "flex") { closeShare(); } else { showShare(); }
}

function toggleHelp() {
    if (typeof gtag === 'function') gtag('event', 'modal_open', {'modal_type': 'help'});
    closeAllPanels();
    var helpPanel = document.getElementById("helpPanel");
    if (helpPanel.style.display === "flex") { closeHelp(); } else { showHelp(); }
}

function toggleStats() {
    if (typeof gtag === 'function') gtag('event', 'modal_open', {'modal_type': 'stats'});
    closeAllPanels();
    var statsPanel = document.getElementById("statsPanel");
    if (statsPanel.style.display === "flex") { closeStats(); } else { updateStatsDisplay(); statsPanel.style.display = "flex"; }
}

function toggleInfo() {
    if (typeof gtag === 'function') gtag('event', 'modal_open', {'modal_type': 'about'});
    closeAllPanels();
    var infoPanel = document.getElementById("infoPanel");
    if (infoPanel.style.display === "flex") { closeInfo(); } else { infoPanel.style.display = "flex"; }
}

function closeAllPanels() {
    ['sharePanel', 'helpPanel', 'statsPanel', 'infoPanel', 'streakPanel', 'wordDefPanel'].forEach(function(id) {
        var panel = document.getElementById(id);
        if (panel) panel.style.display = "none";
    });
}

function showShare() {
    var shareText = generateShareText();
    document.getElementById("sharePreview").textContent = shareText;
    document.getElementById("sharePanel").style.display = "flex";
}
function closeShare() { document.getElementById("sharePanel").style.display = "none"; }
function showHelp() { document.getElementById("helpPanel").style.display = "flex"; }
function closeHelp() { document.getElementById("helpPanel").style.display = "none"; }
function closeStats() { document.getElementById("statsPanel").style.display = "none"; }
function closeInfo() { document.getElementById("infoPanel").style.display = "none"; }

function copyToClipboard() {
    if (typeof gtag === 'function') gtag('event', 'share', {'method': 'clipboard'});
    var shareText = document.getElementById("sharePreview").textContent;
    navigator.clipboard.writeText(shareText).then(function() { alert("Results copied to clipboard!"); });
}

function shareToTwitter() {
    if (typeof gtag === 'function') gtag('event', 'share', {'method': 'twitter'});
    var shareText = document.getElementById("sharePreview").textContent;
    window.open("https://twitter.com/intent/tweet?text=" + encodeURIComponent(shareText), "_blank");
}

function shareToBluesky() {
    if (typeof gtag === 'function') gtag('event', 'share', {'method': 'bluesky'});
    var shareText = document.getElementById("sharePreview").textContent;
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        navigator.clipboard.writeText(shareText).then(function() {
            alert("Results copied! Opening Bluesky - paste into your post.");
            window.open("https://bsky.app", "_blank");
        }).catch(function() { window.open("https://bsky.app", "_blank"); });
    } else {
        window.open("https://bsky.app/intent/compose?text=" + encodeURIComponent(shareText), "_blank");
    }
}

function shareToFacebook() {
    if (typeof gtag === 'function') gtag('event', 'share', {'method': 'facebook'});
    var shareText = document.getElementById("sharePreview").textContent;
    navigator.clipboard.writeText(shareText).then(function() {
        alert("Results copied to clipboard! Paste into your Facebook post.");
        window.open("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(GAME_URL), "_blank");
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
    // FIX #2: Clear and reinitialize feedback with new round indicator
    var feedbackDiv = document.getElementById("feedback");
    feedbackDiv.innerHTML = "";
    initFeedbackDisplay();
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
    if (gameMode === 'proplus') { console.log("Pro+ Mode: Skipping not allowed"); return; }
    document.getElementById("giveUpModal").style.display = "flex";
    document.getElementById("guessInput").disabled = true;
    document.getElementById("submitBtn").disabled = true;
    document.getElementById("giveUpBtn").disabled = true;
}

function confirmGiveUp() {
    if (typeof gtag === 'function') gtag('event', 'give_up', {'round_number': currentRound, 'guesses_used': guessCount});
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
    setTimeout(() => { nextWord(); }, 4000);
}

function cancelGiveUp() {
    document.getElementById("giveUpModal").style.display = "none";
    document.getElementById("guessInput").disabled = false;
    document.getElementById("submitBtn").disabled = false;
    document.getElementById("giveUpBtn").disabled = false;
    document.getElementById("guessInput").focus();
}

function closeDuplicateModal() { document.getElementById("duplicateWordModal").style.display = "none"; document.getElementById("guessInput").focus(); }
function showPlaceholderModal() { document.getElementById("placeholderModal").style.display = "flex"; }
function closePlaceholderModal() { document.getElementById("placeholderModal").style.display = "none"; document.getElementById("guessInput").focus(); }
function closeSuccessModal() { document.getElementById("successModal").style.display = "none"; document.getElementById("guessInput").focus(); }
function closeZeroScoreModal() { document.getElementById("zeroScoreModal").style.display = "none"; document.getElementById("guessInput").focus(); }
function viewResults() { document.getElementById("dailyCompleteModal").style.display = "none"; toggleShare(); }
function closeDailyModal() { document.getElementById("dailyCompleteModal").style.display = "none"; }

function loadStats() {
    var saved = localStorage.getItem('directionary_base_Stats');
    if (saved) playerStats = JSON.parse(saved);
}
function saveStats() { localStorage.setItem('directionary_base_Stats', JSON.stringify(playerStats)); }

function updateStats(score) {
    var modeStats = gameMode === 'proplus' ? playerStats.proplus : playerStats.pro;
    var firstDateKey = gameMode === 'proplus' ? 'firstProPlusGameDate' : 'firstProGameDate';
    if (!playerStats[firstDateKey]) playerStats[firstDateKey] = getDateKey();
    var dayKey = getDateKey(), weekKey = getWeekKey(), monthKey = getMonthKey(), yearKey = getYearKey();
    if (modeStats.currentDay !== dayKey) { modeStats.dailyTotal = 0; modeStats.currentDay = dayKey; }
    if (modeStats.currentWeek !== weekKey) { modeStats.weeklyTotal = 0; modeStats.currentWeek = weekKey; }
    if (modeStats.currentMonth !== monthKey) { modeStats.monthlyTotal = 0; modeStats.currentMonth = monthKey; }
    if (modeStats.currentYear !== yearKey) {
        if (modeStats.currentYear && modeStats.annualTotal > 0) {
            modeStats.yearlyArchive[modeStats.currentYear] = { total: modeStats.annualTotal, games: modeStats.gamesPlayed };
        }
        modeStats.annualTotal = 0;
        modeStats.currentYear = yearKey;
    }
    modeStats.dailyTotal += score;
    modeStats.weeklyTotal += score;
    modeStats.monthlyTotal += score;
    modeStats.annualTotal += score;
    modeStats.totalScore += score;
    modeStats.gamesPlayed++;
    if (score > modeStats.bestScore) modeStats.bestScore = score;
    saveStats();
    updateStatsDisplay();
}

function updateStatsDisplay() {
    function fmt(num) { return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
    document.getElementById('firstProDate').textContent = formatDateForDisplay(playerStats.firstProGameDate);
    document.getElementById('firstProPlusDate').textContent = formatDateForDisplay(playerStats.firstProPlusGameDate);
    document.getElementById('proGamesPlayed').textContent = fmt(playerStats.pro.gamesPlayed);
    document.getElementById('proBestScore').textContent = fmt(playerStats.pro.bestScore);
    document.getElementById('proTotalScore').textContent = fmt(playerStats.pro.totalScore);
    document.getElementById('proDailyTotal').textContent = fmt(playerStats.pro.dailyTotal);
    document.getElementById('proWeeklyTotal').textContent = fmt(playerStats.pro.weeklyTotal);
    document.getElementById('proMonthlyTotal').textContent = fmt(playerStats.pro.monthlyTotal);
    document.getElementById('proAnnualTotal').textContent = fmt(playerStats.pro.annualTotal);
    var proArchiveHtml = '';
    Object.keys(playerStats.pro.yearlyArchive).sort().reverse().forEach(function(year) {
        proArchiveHtml += '<div class="archive-year">' + year + ': ' + fmt(playerStats.pro.yearlyArchive[year].total) + '</div>';
    });
    document.getElementById('proYearlyArchive').innerHTML = proArchiveHtml || '<div class="no-archive">No archived years</div>';
    document.getElementById('proplusGamesPlayed').textContent = fmt(playerStats.proplus.gamesPlayed);
    document.getElementById('proplusBestScore').textContent = fmt(playerStats.proplus.bestScore);
    document.getElementById('proplusTotalScore').textContent = fmt(playerStats.proplus.totalScore);
    document.getElementById('proplusDailyTotal').textContent = fmt(playerStats.proplus.dailyTotal);
    document.getElementById('proplusWeeklyTotal').textContent = fmt(playerStats.proplus.weeklyTotal);
    document.getElementById('proplusMonthlyTotal').textContent = fmt(playerStats.proplus.monthlyTotal);
    document.getElementById('proplusAnnualTotal').textContent = fmt(playerStats.proplus.annualTotal);
    var proplusArchiveHtml = '';
    Object.keys(playerStats.proplus.yearlyArchive).sort().reverse().forEach(function(year) {
        proplusArchiveHtml += '<div class="archive-year">' + year + ': ' + fmt(playerStats.proplus.yearlyArchive[year].total) + '</div>';
    });
    document.getElementById('proplusYearlyArchive').innerHTML = proplusArchiveHtml || '<div class="no-archive">No archived years</div>';
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
    try { localStorage.setItem('directionary_base_gameState', JSON.stringify(state)); } catch (e) { console.log("Could not save game state:", e); }
}

function loadGameState() {
    if (devMode || testMode) return null;
    try {
        var saved = localStorage.getItem('directionary_base_gameState');
        if (!saved) return null;
        var state = JSON.parse(saved);
        if (state.gameDay !== dailyNumber) { clearGameState(); return null; }
        return state;
    } catch (e) { return null; }
}

function clearGameState() {
    try { localStorage.removeItem('directionary_base_gameState'); } catch (e) {}
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
        initFeedbackDisplay();
    }
    attachAlphaHintHandlers();
    console.log("✅ Game state restored: Round " + currentRound + ", Score " + totalScore);
}

function resetGame() {
    currentRound = 1;
    totalScore = 0;
    guessCount = 0;
    roundResults = [];
    guessHistory = [];
    guessedWordsThisRound.clear();
    usedLetters.clear();
    clearGameState();

    // FIX #2: Reinitialize feedback display after clearing
    var feedbackEl = document.getElementById("feedback");
    if (feedbackEl) feedbackEl.innerHTML = "";

    var guessInputEl = document.getElementById("guessInput");
    if (guessInputEl) { guessInputEl.value = ""; guessInputEl.disabled = false; }
    var submitBtnEl = document.getElementById("submitBtn");
    if (submitBtnEl) submitBtnEl.disabled = false;
    var giveUpBtnEl = document.getElementById("giveUpBtn");
    if (giveUpBtnEl) giveUpBtnEl.disabled = false;
    var errorMessageEl = document.getElementById("errorMessage");
    if (errorMessageEl) errorMessageEl.innerHTML = "";
    var currentScoreEl = document.getElementById("currentScore");
    if (currentScoreEl) currentScoreEl.textContent = "100";
    var guessCountEl = document.getElementById("guessCount");
    if (guessCountEl) guessCountEl.textContent = "0";

    loadWordList();
}

function switchToProMode() {
    if (gameMode === 'pro') return;
    var gameInProgress = roundResults.length > 0 || guessCount > 0;
    if (gameInProgress) { showError("⚠️ Finish or abandon your current game before switching modes"); return; }
    performModeSwitch('pro');
}

function switchToProPlusMode() {
    if (gameMode === 'proplus') return;
    var gameInProgress = roundResults.length > 0 || guessCount > 0;
    if (gameInProgress) { showError("⚠️ Finish or abandon your current game before switching modes"); return; }
    performModeSwitch('proplus');
}

function confirmModeSwitch() {
    var modal = document.getElementById('modeSwitchModal');
    if (modal) modal.style.display = 'none';
    if (pendingModeSwitch) performModeSwitch(pendingModeSwitch);
    pendingModeSwitch = null;
    setTimeout(function() { document.getElementById("guessInput").focus(); }, 100);
}

function cancelModeSwitch() {
    document.getElementById('modeSwitchModal').style.display = 'none';
    pendingModeSwitch = null;
    document.getElementById("guessInput").focus();
}

function showAbandonModal() {
    document.getElementById('abandonGameModal').style.display = 'flex';
    if (typeof gtag === 'function') {
        gtag('event', 'abandon_modal_opened', {
            'game_version': gameMode === 'proplus' ? 'proplus' : 'pro',
            'current_round': currentRound,
            'total_guesses': guessCount
        });
    }
}

function closeAbandonModal() {
    document.getElementById('abandonGameModal').style.display = 'none';
    document.getElementById("guessInput").focus();
}

function confirmAbandonGame() {
    document.getElementById('abandonGameModal').style.display = 'none';
    if (typeof gtag === 'function') {
        gtag('event', 'game_abandoned', {
            'game_version': gameMode === 'proplus' ? 'proplus' : 'pro',
            'rounds_completed': roundResults.length,
            'current_round': currentRound,
            'total_score': totalScore
        });
    }
    resetGame();
}

function performModeSwitch(newMode) {
    console.log("Performing mode switch from", gameMode, "to", newMode);
    gameMode = newMode;
    if (newMode === 'pro') {
        document.getElementById('proModeBtn').classList.add('active');
        document.getElementById('proPlusModeBtn').classList.remove('active');
        document.getElementById('modeDescription').innerHTML = '<strong>PRO Mode:</strong> AlphaHint enabled, bold letters, any guess allowed';
    } else {
        document.getElementById('proPlusModeBtn').classList.add('active');
        document.getElementById('proModeBtn').classList.remove('active');
        document.getElementById('modeDescription').innerHTML = '<strong>PRO+ Mode:</strong> ⭐ <strong>DOUBLE POINTS</strong> ⭐ | No AlphaHint | No skipping rounds | Must follow arrow clues';
    }
    updateAlphaHintText(newMode);
    updateSkipButtonStyling(newMode);
    if (devMode) updateFullDevConsole();
    updateAlphabetDisplay();
    resetGame();
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
    console.log("Directionary PRO loading... [Version: March 19, 2026 - Bug fixes: dev mode formula + blank feedback]");
    loadStats();
    initGame();

    var guessInput = document.getElementById("guessInput");
    guessInput.addEventListener("input", function() {
        var cleaned = this.value.replace(/[^A-Za-z]/g, '').toUpperCase().substring(0, 5);
        if (this.value !== cleaned) this.value = cleaned;
    });
    guessInput.addEventListener("keypress", function(event) {
        if (event.key === "Enter" && !this.disabled) { event.preventDefault(); submitGuess(); }
    });
    document.getElementById("submitBtn").addEventListener("click", function() { if (!this.disabled) submitGuess(); });
    document.getElementById("giveUpBtn").addEventListener("click", function() { if (!this.disabled) giveUp(); });
};

function reloadDevGame() {
    if (!devMode) return;
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
        var guessInput = document.getElementById('guessInput');
        if (guessInput && document.activeElement === guessInput && !guessInput.disabled) return;
        e.preventDefault();
        var checks = [
            {id: 'successModal', fn: nextWord},
            {id: 'zeroScoreModal', fn: skipRound},
            {id: 'giveUpModal', fn: cancelGiveUp},
            {id: 'modeSwitchModal', fn: cancelModeSwitch},
            {id: 'abandonGameModal', fn: closeAbandonModal},
            {id: 'placeholderModal', fn: closePlaceholderModal},
            {id: 'statsPanel', fn: closeStats},
            {id: 'helpPanel', fn: closeHelp},
            {id: 'infoPanel', fn: closeInfo},
            {id: 'sharePanel', fn: closeShare},
            {id: 'wordDefPanel', fn: closeWordDefPanel}
        ];
        for (var i = 0; i < checks.length; i++) {
            var el = document.getElementById(checks[i].id);
            if (el && el.style.display === 'flex') { checks[i].fn(); return; }
        }
    }
    if (e.key === 'Escape') {
        e.preventDefault();
        var escChecks = [
            {id: 'successModal', fn: closeSuccessModal},
            {id: 'dailyCompleteModal', fn: closeDailyModal},
            {id: 'zeroScoreModal', fn: closeZeroScoreModal},
            {id: 'giveUpModal', fn: cancelGiveUp},
            {id: 'modeSwitchModal', fn: cancelModeSwitch},
            {id: 'abandonGameModal', fn: closeAbandonModal},
            {id: 'placeholderModal', fn: closePlaceholderModal},
            {id: 'statsPanel', fn: closeStats},
            {id: 'helpPanel', fn: closeHelp},
            {id: 'infoPanel', fn: closeInfo},
            {id: 'sharePanel', fn: closeShare},
            {id: 'wordDefPanel', fn: closeWordDefPanel}
        ];
        for (var i = 0; i < escChecks.length; i++) {
            var el = document.getElementById(escChecks[i].id);
            if (el && el.style.display === 'flex') { escChecks[i].fn(); return; }
        }
    }
});

document.addEventListener('DOMContentLoaded', function() {
    var panels = [
        {id: 'sharePanel', close: closeShare},
        {id: 'statsPanel', close: closeStats},
        {id: 'wordDefPanel', close: closeWordDefPanel},
        {id: 'infoPanel', close: closeInfo},
        {id: 'helpPanel', close: closeHelp}
    ];
    panels.forEach(function(panel) {
        var el = document.getElementById(panel.id);
        if (el) el.addEventListener('click', function(e) { if (e.target === el) panel.close(); });
    });
    var modals = [
        {id: 'successModal', close: closeSuccessModal},
        {id: 'dailyCompleteModal', close: closeDailyModal},
        {id: 'zeroScoreModal', close: closeZeroScoreModal},
        {id: 'giveUpModal', close: cancelGiveUp},
        {id: 'modeSwitchModal', close: cancelModeSwitch},
        {id: 'abandonGameModal', close: closeAbandonModal},
        {id: 'placeholderModal', close: closePlaceholderModal}
    ];
    modals.forEach(function(modal) {
        var el = document.getElementById(modal.id);
        if (el) el.addEventListener('click', function(e) { if (e.target === el) modal.close(); });
    });
});

// Window assignments
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
window.showWordDefinitionModal = showWordDefinitionModal;
window.closeWordDefPanel = closeWordDefPanel;
window.showPlaceholderModal = showPlaceholderModal;
window.closePlaceholderModal = closePlaceholderModal;
window.closeSuccessModal = closeSuccessModal;
window.closeZeroScoreModal = closeZeroScoreModal;
window.switchToProMode = switchToProMode;
window.switchToProPlusMode = switchToProPlusMode;
window.confirmModeSwitch = confirmModeSwitch;
window.cancelModeSwitch = cancelModeSwitch;
window.showAbandonModal = showAbandonModal;
window.closeAbandonModal = closeAbandonModal;
window.confirmAbandonGame = confirmAbandonGame;
window.updateFullDevConsole = updateFullDevConsole;
window.playAgainSameMode = playAgainSameMode;
window.playAgainOtherMode = playAgainOtherMode;
