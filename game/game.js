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
        
        // Get game day number based on LOCAL midnight (like Wordle)
        function getLocalGameDay() {
    var now = new Date();
    var localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // PRIVATE BETA LAUNCH: December 13, 2025
    var launchDate = new Date(2025, 11, 13); // Month is 0-indexed (11 = December)
    
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
        
        // Mock dictionary definitions (to be replaced with API integration later)
        
        function showDefinition(word) {
            var defBox = document.getElementById('definitionBox');
            var defWord = document.getElementById('defWord');
            var defText = document.getElementById('defText');
            
            defWord.textContent = word.toLowerCase();
            defText.textContent = 'Loading definition...';
            defBox.style.display = 'block';
            
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
        
        function updateScoreDisplay() {
            document.getElementById("currentScore").textContent = currentScore;
            document.getElementById("totalScore").textContent = totalScore;
            document.getElementById("guessCount").textContent = guessCount;
            document.getElementById("roundNumber").textContent = currentRound;
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
                                // Add to answerWords if not already present
                                addedWords.answers.forEach(function(word) {
                                    word = word.toUpperCase();
                                    if (!answerWords.includes(word)) {
                                        answerWords.push(word);
                                    }
                                });
                                console.log("Merged " + addedWords.answers.length + " added answer words");
                            }
                            
                            if (addedWords.valid && addedWords.valid.length > 0) {
                                // Add to validWords if not already present
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
                    
                    // Still merge added words from admin dashboard even in fallback mode
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
            
            // Check for beta mode and show banner if enabled
            showBetaBannerIfEnabled();
            
            // Start checking for day change FIRST (only in production mode)
            // This ensures auto-reload works even when game is already completed
            if (!devMode && !testMode) {
                startDayChangeChecker();
            }
            
            // Check if already played today (only in production mode)
            if (!devMode && !testMode) {
                var lastPlayed = localStorage.getItem('directionary_lastPlayed');
                var today = getLocalGameDay();
                
                if (lastPlayed == today) {
                    // Already played today - show completed message
                    showAlreadyPlayedMessage();
                    return;
                }
            }
            
            currentRound = 1;
            totalScore = 0;
            roundResults = [];
            guessHistory = [];
            loadWordList();
            // Focus input field when game starts
            setTimeout(function() {
                document.getElementById("guessInput").focus();
            }, 100);
        }
        
        // Auto-reload when new LOCAL day starts (like Wordle)
        function startDayChangeChecker() {
            console.log("Day change checker started - will check every minute for new day");
            
            // Check every minute if day has changed
            setInterval(function() {
                var currentDay = getLocalGameDay();
                var storedDay = localStorage.getItem('directionary_currentDay');
                
                // Store current day on first check
                if (!storedDay) {
                    localStorage.setItem('directionary_currentDay', currentDay);
                    console.log("Stored current day:", currentDay);
                    return;
                }
                
                storedDay = parseInt(storedDay);
                
                if (currentDay > storedDay) {
                    console.log("New day detected! Old day:", storedDay, "New day:", currentDay);
                    console.log("Reloading for fresh puzzle...");
                    localStorage.setItem('directionary_currentDay', currentDay);
                    location.reload();
                }
            }, 60000); // Check every 60 seconds
        }

        function startNewGame() {
            console.log("Starting round " + currentRound + "...");
            
            var wordPool = answerWords.length > 0 ? answerWords : fallbackWords;
            var daysSinceEpoch = Math.floor(Date.now() / 86400000);
            var wordIndex;
            
            if (testMode || devMode || usingFallbackMode) {
                // Test/Dev mode or Fallback mode: Use random selection
                wordIndex = Math.floor(Math.random() * wordPool.length);
                var modeLabel = testMode ? "TEST MODE" : (devMode ? "DEV MODE" : "FALLBACK MODE");
                console.log(modeLabel + ": Random word index:", wordIndex);
            } else {
                // JSON mode: Use day-based seed with prime number multiplier for variety
                // Each day jumps to different part of word list
                wordIndex = ((daysSinceEpoch * 317) + (currentRound * 773)) % wordPool.length;
                console.log("JSON MODE: Day-based index:", wordIndex, "(varied selection)");
            }
            
            // Check for manual override from Word Management Dashboard (admin.html)
            var overrides = {};
            try {
                var overrideData = localStorage.getItem('directionary_wordOverrides');
                if (overrideData) {
                    overrides = JSON.parse(overrideData);
                }
            } catch (e) {
                console.log("Could not load word overrides:", e);
            }
            
            // Get today's date in LOCAL timezone (not UTC) to match admin page
            var today = new Date();
            var year = today.getFullYear();
            var month = String(today.getMonth() + 1).padStart(2, '0');
            var day = String(today.getDate()).padStart(2, '0');
            var todayStr = year + '-' + month + '-' + day; // YYYY-MM-DD in local time
            
            if (overrides[todayStr] && overrides[todayStr][currentRound]) {
                // Use override word from admin dashboard
                targetWord = overrides[todayStr][currentRound];
                console.log("Using OVERRIDE word for Round " + currentRound + ":", targetWord);
            } else {
                // Use algorithm word
                targetWord = wordPool[wordIndex];
            }
            
            // Only show target word in dev/test modes to prevent cheating
            if (devMode || testMode) {
                console.log("Target word:", targetWord, "(round", currentRound + ")");
            }
            
            // Update dev mode display
            if (devMode) {
                var wordSource = answerWords.length > 0 ? "JSON words" : "Fallback list";
                var devDisplay = document.getElementById("devModeDisplay");
                devDisplay.style.display = "block";
                devDisplay.innerHTML = '🎯 DEV MODE: <span id="devTargetWord">' + targetWord + '</span> <span style="color: #666; font-size: 0.9em;">(from ' + wordSource + ')</span> <button onclick="reloadDevGame()" style="margin-left: 10px; background: #667eea; color: white; border: none; padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 0.9em; font-weight: 600;">🔄 New Game</button>';
            }
            
            // Update test mode display
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
            
            // Hide definition box when starting new round
            document.getElementById('definitionBox').style.display = 'none';
            
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
            
            // Check for duplicate word this round
            if (guessedWordsThisRound.has(guess)) {
                document.getElementById("duplicateWordModal").style.display = "flex";
                input.value = "";
                input.focus();
                return;
            }
            
            guessedWordsThisRound.add(guess);

            guessCount++;
            
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
                var className = feedback[j] === "●" ? " class=\"correct\"" : "";
                arrowSpans += "<span" + className + ">" + feedback[j] + "</span>";
            }
            
            feedbackLine.innerHTML = "<span style=\"color: #bbb; margin-right: 8px;\">" + guessCount + ")</span> <span>" + guess + "</span> <div class=\"feedback-arrows\">" + arrowSpans + "</div>";
            // Insert at the TOP so newest guess is always visible
            feedbackDiv.insertBefore(feedbackLine, feedbackDiv.firstChild);
            
            input.value = "";
            input.focus();

            if (guess === targetWord) {
                totalScore += currentScore;
                updateScoreDisplay();
                
                var roundData = {
                    word: targetWord,
                    score: currentScore,
                    guesses: guessCount,
                    // Show last fail before success, or first guess if won on first try
                    pattern: guessCount > 1 ? guessHistory[guessHistory.length - 2] : guessHistory[0]
                };
                roundResults.push(roundData);
                
                setTimeout(() => {
                    showSuccessModal();
                }, 1500);
            } else {
                // Incorrect guess - deduct points
                currentScore = Math.max(0, 100 - guessCount * 10);
                updateScoreDisplay();
                
                if (currentScore === 0) {
                    setTimeout(() => {
                        showZeroScoreModal();
                    }, 500);
                }
            }
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
            
            // Change title based on round
            var titleElement = document.querySelector("#successModal .success-title");
            if (currentRound >= maxRounds) {
                titleElement.textContent = "YOU WIN!";
            } else {
                titleElement.textContent = "Correct!";
            }
            
            // Populate definition in modal
            document.getElementById("modalDefWord").textContent = targetWord.toLowerCase();
            document.getElementById("modalDefText").textContent = 'Loading definition...';
            
            // Fetch definition from API
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
                        
                        document.getElementById("modalDefText").textContent = (partOfSpeech ? '(' + partOfSpeech + ') ' : '') + definition;
                    } else {
                        document.getElementById("modalDefText").textContent = 'Definition not available';
                    }
                })
                .catch(error => {
                    console.log('Dictionary API error:', error);
                    document.getElementById("modalDefText").textContent = 'Definition not available';
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
            updateStats();
            
            // Save today's completion date and state (only in production mode)
            if (!devMode && !testMode) {
                var today = getLocalGameDay();
                localStorage.setItem('directionary_lastPlayed', today);
                localStorage.setItem('directionary_dailyState', JSON.stringify({
                    roundResults: roundResults,
                    totalScore: totalScore,
                    completedDate: today
                }));
            }
            
            document.getElementById("finalScore").textContent = totalScore;
            
            // Change modal title based on score
            var modalTitle = document.querySelector("#dailyCompleteModal .success-title");
            if (totalScore === 0) {
                modalTitle.textContent = "Game Over - Try Again Tomorrow!";
                modalTitle.style.background = "linear-gradient(135deg, #dc3545 0%, #c82333 100%)";
                modalTitle.style.webkitBackgroundClip = "text";
                modalTitle.style.webkitTextFillColor = "transparent";
            } else if (totalScore < 150) {
                modalTitle.textContent = "Daily Challenge Complete";
            } else {
                modalTitle.textContent = "🏆 Daily Challenge Complete!";
            }
            
            // Update daily indicator to show Game Over
            var dailyIndicator = document.getElementById("dailyIndicator");
            var streakBadge = document.getElementById("streakBadge");
            dailyIndicator.innerHTML = '<span class="game-over-badge">GAME OVER</span> ' + streakBadge.outerHTML;
            
            // Build round summary with two-column layout and dictionary links
            var summary = "";
            var totalGuesses = 0;
            
            if (roundResults.length > 0) {
                summary += '<div style="display: grid; grid-template-columns: 1fr auto; gap: 15px; align-items: center; max-width: 300px; margin: 0 auto;">';
                
                for (var i = 0; i < roundResults.length; i++) {
                    var result = roundResults[i];
                    totalGuesses += result.guesses;
                    
                    // Word with dictionary link
                    summary += '<div style="text-align: left;"><a href="https://www.dictionary.com/browse/' + result.word.toLowerCase() + '" target="_blank" style="color: #667eea; text-decoration: underline; font-weight: 600;">' + result.word + '</a></div>';
                    
                    // Guesses count
                    if (result.score === 0) {
                        summary += '<div style="text-align: right; color: #e53e3e;">Skipped</div>';
                    } else {
                        summary += '<div style="text-align: right; color: #666;">' + result.guesses + ' guess' + (result.guesses === 1 ? '' : 'es') + '</div>';
                    }
                }
                
                // Add total guesses row
                summary += '<div style="text-align: left; font-weight: 700; color: #667eea; border-top: 2px solid #ddd; padding-top: 10px; margin-top: 5px;">TOTAL GUESSES</div>';
                summary += '<div style="text-align: right; font-weight: 700; color: #667eea; border-top: 2px solid #ddd; padding-top: 10px; margin-top: 5px;">' + totalGuesses + '</div>';
                
                summary += '</div>';
            } else {
                summary = "No rounds completed<br>";
            }
            document.getElementById("roundSummary").innerHTML = summary;
            
            // Show "come back tomorrow" message
            showComeBackMessage();
            
            // Definitely show the modal
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
            
            // Hide input and buttons
            document.getElementById("guessInput").style.display = "none";
            document.querySelector(".button-group").style.display = "none";
            
            // Add countdown timer to feedback area - styled like digital clock radio
            var feedbackDiv = document.getElementById("feedback");
            feedbackDiv.innerHTML = '<div id="countdownTimer" style="text-align: center; padding: 25px 30px; font-size: 2em; color: #00ff41; font-weight: 700; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); border-radius: 15px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.5), 0 4px 15px rgba(0,0,0,0.3); font-family: \'Courier New\', Courier, monospace; letter-spacing: 0.1em; text-shadow: 0 0 10px rgba(0,255,65,0.5), 0 0 20px rgba(0,255,65,0.3);"></div>';
            startCountdownTimer();
            
            // Add today's words display with dictionary links and guess counts
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
                    
                    // Word link (left side)
                    html += '<div style="text-align: left;"><a href="' + dictUrl + '" target="_blank" style="text-decoration: underline; color: #667eea; font-weight: 600; font-size: 1.1em;">' + word + '</a></div>';
                    
                    // Guess count (right side)
                    html += '<div style="text-align: right; color: #666; font-size: 0.95em;">' + guesses + ' guess' + (guesses !== 1 ? 'es' : '') + '</div>';
                }
                
                html += '</div>';
                wordsDiv.innerHTML = html;
                buttonGroup.parentNode.insertBefore(wordsDiv, buttonGroup.nextSibling);
            }
            
            // Update the third score item to show TOTAL GUESSES
            var totalGuesses = 0;
            for (var i = 0; i < roundResults.length; i++) {
                totalGuesses += roundResults[i].guesses;
            }
            
            // Update the guessCount element and its label
            var guessCountElement = document.getElementById("guessCount");
            if (guessCountElement && guessCountElement.previousElementSibling) {
                guessCountElement.previousElementSibling.textContent = "Total Guesses";
                guessCountElement.textContent = totalGuesses;
            }
            
            // Change "Current Round" to "Final Round"
            var currentScoreElement = document.getElementById("currentScore");
            if (currentScoreElement && currentScoreElement.previousElementSibling) {
                currentScoreElement.previousElementSibling.textContent = "Final Round";
            }
        }
        
        // Countdown timer to next puzzle
        function startCountdownTimer() {
            function updateCountdown() {
                var now = new Date();
                var tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                var timeUntilMidnight = tomorrow - now;
                
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
            // Load saved stats and results
            loadStats();
            var savedState = localStorage.getItem('directionary_dailyState');
            if (savedState) {
                var state = JSON.parse(savedState);
                roundResults = state.roundResults || [];
                totalScore = state.totalScore || 0;
            }
            
            // Update display to show already played
            var instructions = document.querySelector(".instructions-brief");
            if (!instructions) {
                instructions = document.querySelector(".instructions");
            }
            if (instructions) {
                instructions.innerHTML = "<strong>✨ You've completed today's challenge! Return tomorrow for a new game.</strong>";
                instructions.style.background = "linear-gradient(135deg, #667eea15 0%, #764ba215 100%)";
            }
            
            // Show GAME OVER badge
            var dailyIndicator = document.getElementById("dailyIndicator");
            var streakBadge = document.getElementById("streakBadge");
            dailyIndicator.innerHTML = '<span class="game-over-badge">GAME OVER</span> ' + streakBadge.outerHTML;
            
            // Update streak display
            updateStreakDisplay();
            
            // Hide input and buttons
            document.getElementById("guessInput").style.display = "none";
            document.querySelector(".button-group").style.display = "none";
            
            // Add countdown timer to feedback area - styled like digital clock radio
            var feedbackDiv = document.getElementById("feedback");
            feedbackDiv.innerHTML = '<div id="countdownTimer" style="text-align: center; padding: 25px 30px; font-size: 2em; color: #00ff41; font-weight: 700; background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); border-radius: 15px; box-shadow: inset 0 2px 8px rgba(0,0,0,0.5), 0 4px 15px rgba(0,0,0,0.3); font-family: \'Courier New\', Courier, monospace; letter-spacing: 0.1em; text-shadow: 0 0 10px rgba(0,255,65,0.5), 0 0 20px rgba(0,255,65,0.3);"></div>';
            startCountdownTimer();
            
            // Show today's words with dictionary links and guess counts
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
                    
                    // Word link (left side)
                    html += '<div style="text-align: left;"><a href="' + dictUrl + '" target="_blank" style="text-decoration: underline; color: #667eea; font-weight: 600; font-size: 1.1em;">' + word + '</a></div>';
                    
                    // Guess count (right side)
                    html += '<div style="text-align: right; color: #666; font-size: 0.95em;">' + guesses + ' guess' + (guesses !== 1 ? 'es' : '') + '</div>';
                }
                
                html += '</div>';
                wordsDiv.innerHTML = html;
                buttonGroup.parentNode.insertBefore(wordsDiv, buttonGroup.nextSibling);
                
                // Show final score
                var scoreMessage = document.createElement("div");
                scoreMessage.style.cssText = "text-align: center; margin: 20px 0; font-size: 1.2em; font-weight: 600; color: #667eea;";
                scoreMessage.textContent = "Your Score: " + totalScore + " points";
                wordsDiv.parentNode.insertBefore(scoreMessage, wordsDiv);
            }
            
            // Update score display with final values
            if (roundResults.length > 0) {
                var totalGuesses = 0;
                
                // Calculate total guesses
                for (var i = 0; i < roundResults.length; i++) {
                    totalGuesses += roundResults[i].guesses;
                }
                
                // Update the three score items
                document.getElementById("currentScore").textContent = "---";
                document.getElementById("totalScore").textContent = totalScore;
                
                // Change "Current Round" to "Final Round"
                var currentScoreElement = document.getElementById("currentScore");
                if (currentScoreElement && currentScoreElement.previousElementSibling) {
                    currentScoreElement.previousElementSibling.textContent = "Final Round";
                }
                
                // Change "Guesses" to "Total Guesses" and show total
                var guessCountElement = document.getElementById("guessCount");
                if (guessCountElement && guessCountElement.previousElementSibling) {
                    guessCountElement.previousElementSibling.textContent = "Total Guesses";
                    guessCountElement.textContent = totalGuesses;
                }
            }
        }
        
        function generateShareText() {
            var text = "Directionary (BETA) #" + (dailyNumber % 1000);
            
            // Add streak if greater than 0
            if (playerStats.currentStreak > 0) {
                text += " - 🔥 " + playerStats.currentStreak + " day streak";
            }
            text += "\n\n";
            
            // Show pattern for all rounds
            for (var i = 0; i < roundResults.length; i++) {
                var result = roundResults[i];
                if (result && result.pattern) {
                    // Replace unicode symbols with emoji for sharing
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
        
        // Panel and other functions remain the same...
        
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
            closeAllPanels();
            var helpPanel = document.getElementById("helpPanel");
            if (helpPanel.style.display === "flex") {
                closeHelp();
            } else {
                showHelp();
            }
        }
        
        function toggleStats() {
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
        
        function copyToClipboard() {
            var shareText = document.getElementById("sharePreview").textContent;
            navigator.clipboard.writeText(shareText).then(function() {
                alert("Results copied to clipboard!");
            });
        }
        
        function shareToTwitter() {
            var shareText = document.getElementById("sharePreview").textContent;
            var tweetUrl = "https://twitter.com/intent/tweet?text=" + encodeURIComponent(shareText);
            window.open(tweetUrl, "_blank");
        }
        
        function shareToBluesky() {
            var shareText = document.getElementById("sharePreview").textContent;
            var blueskyUrl = "https://bsky.app/intent/compose?text=" + encodeURIComponent(shareText);
            window.open(blueskyUrl, "_blank");
        }
        
        function shareToFacebook() {
            var shareText = document.getElementById("sharePreview").textContent;
            navigator.clipboard.writeText(shareText).then(function() {
                alert("Results copied to clipboard! Paste into your Facebook post.");
                var facebookUrl = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(GAME_URL);
                window.open(facebookUrl, "_blank");
            });
        }
        
        // All modal and game flow functions...
        function nextWord() {
            document.getElementById("successModal").style.display = "none";
            
            if (currentRound >= maxRounds) {
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
                // Show last attempt before running out of points
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
                // Show last attempt before giving up
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
        
        // Stats functions
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
            if (playerStats.lastPlayed === today - 1) {
                playerStats.currentStreak++;
            } else if (playerStats.lastPlayed !== today) {
                playerStats.currentStreak = 1;
            }
            playerStats.lastPlayed = today;
            playerStats.maxStreak = Math.max(playerStats.maxStreak, playerStats.currentStreak);
            
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

        // Set up event listeners
        window.onload = function() {
            console.log("Directionary loading... [Version: Nov 3, 2025 - Random Words Fixed]");
            loadStats();
            updateStreakDisplay();
            initGame();
            
            document.getElementById("guessInput").addEventListener("keypress", function(event) {
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

        // Dev mode reload function - starts completely fresh game
        function reloadDevGame() {
            if (!devMode) return; // Safety check
            
            console.log("🔄 DEV MODE: Reloading game with new words...");
            
            // Reset all game state
            currentRound = 1;
            totalScore = 0;
            roundResults = [];
            guessHistory = [];
            
            // Clear feedback
            document.getElementById("feedback").innerHTML = "";
            
            // Update round display
            document.getElementById("roundNumber").textContent = currentRound;
            document.getElementById("totalScore").textContent = totalScore;
            
            // Start fresh
            startNewGame();
        }

        // Make functions globally accessible
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
