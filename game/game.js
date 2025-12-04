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
        var dailyNumber = Math.floor(Date.now() / 86400000);
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
            console.log("ðŸŽ¯ DEV MODE ENABLED");
        }
        if (urlParams.get('test') === TEST_PASSWORD) {
            testMode = true;
            console.log("ðŸ§ª TEST MODE ENABLED - Using random words");
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
                    startNewGame();
                })
                .catch(error => {
                    console.log("Could not load word list, using fallback:", error);
                    answerWords = fallbackWords;
                    validWords = fallbackWords;
                    usingFallbackMode = true;
                    console.log("FALLBACK MODE ENABLED - words will use rotation");
                    startNewGame();
                });
        }
        
        function initGame() {
            console.log("Initializing Directionary...");
            document.getElementById("gameLink").href = GAME_URL;
            document.getElementById("gameLink").textContent = GAME_URL;
            
            // Check if already played today (only in production mode)
            if (!devMode && !testMode) {
                var lastPlayed = localStorage.getItem('directionary_lastPlayed');
                var today = Math.floor(Date.now() / 86400000);
                
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

        function startNewGame() {
            console.log("Starting round " + currentRound + "...");
            
            var wordPool = answerWords.length > 0 ? answerWords : fallbackWords;
            var daysSinceEpoch = Math.floor(Date.now() / 86400000);
            var wordIndex;
            
            if (testMode || usingFallbackMode) {
                // Test mode or Fallback mode: Use random selection
                wordIndex = Math.floor(Math.random() * wordPool.length);
                console.log(testMode ? "TEST MODE: Random word index:" : "FALLBACK MODE: Random word index:", wordIndex);
            } else {
                // JSON mode: Use day-based seed with large round offset to spread across list
                // 90-day rotation: cycles through list every ~3 months
                var rotationPeriod = 90;
                wordIndex = ((daysSinceEpoch % rotationPeriod) + (currentRound * 773)) % wordPool.length;
                console.log("JSON MODE: Day-based index:", wordIndex, "(90-day rotation)");
            }
            
            targetWord = wordPool[wordIndex];
            console.log("Target word:", targetWord, "(round", currentRound + ")");
            
            // Update dev mode display
            if (devMode) {
                document.getElementById("devModeDisplay").style.display = "block";
                document.getElementById("devTargetWord").textContent = targetWord;
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
                    feedback += "â—";
                    spacedFeedback += "â— ";
                } else if (g < t) {
                    feedback += "â–º";
                    spacedFeedback += "â–¶ ";
                } else {
                    feedback += "â—„";
                    spacedFeedback += "â—€ ";
                }
            }
            spacedFeedback = spacedFeedback.trim();
            guessHistory.push(spacedFeedback);

            var feedbackDiv = document.getElementById("feedback");
            var feedbackLine = document.createElement("div");
            feedbackLine.className = "feedback-line";
            
            var arrowSpans = "";
            for (var j = 0; j < feedback.length; j++) {
                var className = feedback[j] === "â—" ? " class=\"correct\"" : "";
                arrowSpans += "<span" + className + ">" + feedback[j] + "</span>";
            }
            
            feedbackLine.innerHTML = "<span style=\"color: #bbb; margin-right: 8px;\">" + guessCount + ")</span> <span>" + guess + "</span> <div class=\"feedback-arrows\">" + arrowSpans + "</div>";
            feedbackDiv.appendChild(feedbackLine);
            feedbackDiv.scrollTop = feedbackDiv.scrollHeight;
            
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
                document.querySelector("#successModal .success-btn").textContent = "Next Round â†’";
            }
            
            document.getElementById("successModal").style.display = "flex";
            
            // Add Enter key listener for Next Round button
            var enterHandler = function(e) {
                if (e.key === 'Enter') {
                    document.removeEventListener('keydown', enterHandler);
                    nextWord();
                }
            };
            document.addEventListener('keydown', enterHandler);
            
            document.getElementById("guessInput").disabled = true;
            document.getElementById("submitBtn").disabled = true;
            document.getElementById("giveUpBtn").disabled = true;
        }
        
        function showDailyCompleteModal() {
            updateStats();
            
            // Save today's completion date and state (only in production mode)
            if (!devMode && !testMode) {
                var today = Math.floor(Date.now() / 86400000);
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
                modalTitle.textContent = "Daily Puzzle Complete";
            } else {
                modalTitle.textContent = "ðŸ† Daily Puzzle Complete!";
            }
            
            // Update daily indicator to show Game Over
            var dailyIndicator = document.getElementById("dailyIndicator");
            var streakBadge = document.getElementById("streakBadge");
            dailyIndicator.innerHTML = '<span style="display: inline-block; background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 8px 16px; border-radius: 20px; font-size: 1em; font-weight: 600;">GAME OVER</span> ' + streakBadge.outerHTML;
            
            // Build round summary
            var summary = "";
            if (roundResults.length > 0) {
                for (var i = 0; i < roundResults.length; i++) {
                    summary += "Round " + (i + 1) + ": " + roundResults[i].word + " - " + roundResults[i].score + " points<br>";
                }
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
            var instructions = document.querySelector(".instructions");
            instructions.innerHTML = "<strong>âœ¨ You've completed today's challenge! Return after midnight for tomorrow's game.</strong>";
            instructions.style.background = "linear-gradient(135deg, #667eea15 0%, #764ba215 100%)";
            
            // Hide input and buttons
            document.getElementById("guessInput").style.display = "none";
            document.querySelector(".button-group").style.display = "none";
            
            // Add today's words display (only if we have results)
            if (roundResults.length > 0) {
                var buttonGroup = document.querySelector(".button-group");
                var wordsDiv = document.createElement("div");
                wordsDiv.id = "todaysWordsDisplay";
                wordsDiv.style.cssText = "text-align: center; padding: 20px; background: white; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); margin: 15px 0;";
                
                var html = '<h3 style="margin: 0 0 15px 0; color: #667eea;">Today\'s Words</h3>';
                for (var i = 0; i < roundResults.length; i++) {
                    html += '<div style="font-size: 1.2em; font-weight: 600; margin: 8px 0; color: #333;">';
                    html += (i + 1) + '. ' + roundResults[i].word;
                    html += '</div>';
                }
                wordsDiv.innerHTML = html;
                buttonGroup.parentNode.insertBefore(wordsDiv, buttonGroup.nextSibling);
            }
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
            var instructions = document.querySelector(".instructions");
            instructions.innerHTML = "<strong>âœ¨ You've already completed today's challenge! Return tomorrow for a new game.</strong>";
            instructions.style.background = "linear-gradient(135deg, #667eea15 0%, #764ba215 100%)";
            
            // Show GAME OVER badge
            var dailyIndicator = document.getElementById("dailyIndicator");
            var streakBadge = document.getElementById("streakBadge");
            dailyIndicator.innerHTML = '<span style="display: inline-block; background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 8px 16px; border-radius: 20px; font-size: 1em; font-weight: 600;">GAME OVER</span> ' + streakBadge.outerHTML;
            
            // Update streak display
            updateStreakDisplay();
            
            // Hide input and buttons
            document.getElementById("guessInput").style.display = "none";
            document.querySelector(".button-group").style.display = "none";
            
            // Show today's words if available
            if (roundResults.length > 0) {
                var buttonGroup = document.querySelector(".button-group");
                var wordsDiv = document.createElement("div");
                wordsDiv.style.cssText = "text-align: center; padding: 20px; background: white; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); margin: 15px 0;";
                
                var html = '<h3 style="margin: 0 0 15px 0; color: #667eea;">Today\'s Words</h3>';
                for (var i = 0; i < roundResults.length; i++) {
                    html += '<div style="font-size: 1.2em; font-weight: 600; margin: 8px 0; color: #333;">';
                    html += (i + 1) + '. ' + roundResults[i].word;
                    html += '</div>';
                }
                wordsDiv.innerHTML = html;
                buttonGroup.parentNode.insertBefore(wordsDiv, buttonGroup.nextSibling);
                
                // Show final score
                var scoreMessage = document.createElement("div");
                scoreMessage.style.cssText = "text-align: center; margin: 20px 0; font-size: 1.2em; font-weight: 600; color: #667eea;";
                scoreMessage.textContent = "Your Score: " + totalScore + " points";
                wordsDiv.parentNode.insertBefore(scoreMessage, wordsDiv);
            }
        }
        
        function generateShareText() {
            var text = "Directionary #" + (dailyNumber % 1000);
            
            // Add streak if greater than 0
            if (playerStats.currentStreak > 0) {
                text += " - ðŸ”¥ " + playerStats.currentStreak + " day streak";
            }
            text += "\n\n";
            
            // Show pattern for all rounds
            for (var i = 0; i < roundResults.length; i++) {
                var result = roundResults[i];
                if (result && result.pattern) {
                    // Replace unicode symbols with emoji for sharing
                    var sharePattern = result.pattern
                        .replace(/â—/g, "ðŸŸ¢")
                        .replace(/â–º/g, "â–¶ï¸")
                        .replace(/â–¶/g, "â–¶ï¸")
                        .replace(/â—„/g, "â—€ï¸")
                        .replace(/â—€/g, "â—€ï¸");
                    text += sharePattern + "\n";
                }
            }
            
            text += "\nScore: " + totalScore + "\n\n";
            text += GAME_URL;
            
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
            newGameLine.innerHTML = "â—„ â— Round " + currentRound + " of " + maxRounds + " â— â–º";
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
                pattern: guessHistory.length > 0 ? guessHistory[guessHistory.length - 1] : "âš« âš« âš« âš« âš«"
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
                pattern: guessHistory.length > 0 ? guessHistory[guessHistory.length - 1] : "âš« âš« âš« âš« âš«"
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
        window.shareToFacebook = shareToFacebook;
    };
